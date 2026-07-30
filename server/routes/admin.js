const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { pool } = require('../db');
const { requireAdmin, verifyAdminLogin } = require('../auth');
const { freshCandidateState, deriveRosterFields } = require('../lib/candidateState');
const { buildCandidateReport, QUIZ_STAGE_IDS, PASS_THRESHOLD } = require('../lib/candidateReport');
const { toCsv } = require('../lib/csv');
const { STAGE_IDS, stageIdsFor } = require('../stages');
const { TARGET_TRAITS } = require('../quizzes');

const router = express.Router();

async function selectAll() {
  const { rows } = await pool.query('SELECT * FROM candidates ORDER BY updated_at DESC');
  return rows;
}
async function selectById(id) {
  const { rows } = await pool.query('SELECT * FROM candidates WHERE id = $1', [id]);
  return rows[0];
}
async function selectByEmail(email) {
  const { rows } = await pool.query('SELECT * FROM candidates WHERE email = $1', [email]);
  return rows[0];
}

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}
function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// ---- Auth ----
router.post('/login', async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password || !(await verifyAdminLogin(username, password))) {
    return res.status(401).json({ error: 'Invalid username or password.' });
  }
  req.session.adminUsername = username;
  res.json({ ok: true, username });
});

router.post('/logout', (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

router.get('/session', (req, res) => {
  res.json({ authenticated: !!(req.session && req.session.adminUsername), username: req.session && req.session.adminUsername });
});

// Everything below requires an HR session.
router.use(requireAdmin);

// ---- Roster (polled by the admin view for a near-real-time list) ----
router.get('/roster', async (req, res) => {
  const rows = await selectAll();
  const roster = rows.map((row) => {
    const state = JSON.parse(row.state);
    const stage = STAGE_IDS.includes(state.currentStageId) ? state.currentStageId : row.current_stage;
    return {
      id: row.id,
      candidateId: row.candidate_id,
      name: row.name,
      email: row.email,
      currentStage: stage,
      completedCount: row.completed_count,
      totalStages: stageIdsFor(state).length,
      flagsTotal: row.flags_total,
      lockedStages: Object.keys(state.integrity.lockedStages || {}),
      startedAt: state.startedAt,
      completedAt: state.completedAt,
      updatedAt: row.updated_at,
      scores: state.scores,
      shortlistDecision: state.shortlist ? state.shortlist.decision : null,
      awaitingShortlist: state.currentStageId === 'shortlist' && !state.shortlist,
    };
  });
  res.json({ roster });
});

// ---- Candidate detail (full responses) ----
router.get('/candidates/:id', async (req, res) => {
  const row = await selectById(req.params.id);
  if (!row) return res.status(404).json({ error: 'Candidate not found.' });
  const state = JSON.parse(row.state);
  res.json({ report: buildCandidateReport(row, state) });
});

// ---- Shortlist decision (advance to interview scheduling, or reject) ----
// This only records the decision — it does not send the candidate anything.
// The candidate's own client picks it up and advances itself (or shows a
// rejection message) next time it checks in from the shortlist stage.
router.post('/candidates/:id/shortlist', async (req, res) => {
  const row = await selectById(req.params.id);
  if (!row) return res.status(404).json({ error: 'Candidate not found.' });
  const decision = req.body && req.body.decision;
  if (!['advance', 'reject'].includes(decision)) {
    return res.status(400).json({ error: 'decision must be "advance" or "reject".' });
  }

  const state = JSON.parse(row.state);
  state.shortlist = { decision, decidedAt: new Date().toISOString() };

  const derived = deriveRosterFields(state);
  await pool.query(
    `UPDATE candidates SET current_stage=$1, completed_count=$2, flags_total=$3, state=$4, updated_at=$5 WHERE id=$6`,
    [derived.currentStage, derived.completedCount, derived.flagsTotal, JSON.stringify(state), new Date().toISOString(), row.id]
  );
  res.json({ ok: true });
});

// ---- Unlock a locked section ----
router.post('/candidates/:id/unlock', async (req, res) => {
  const row = await selectById(req.params.id);
  if (!row) return res.status(404).json({ error: 'Candidate not found.' });
  const stageId = req.body && req.body.stageId;
  if (!stageId) return res.status(400).json({ error: 'stageId is required.' });

  const state = JSON.parse(row.state);
  delete state.integrity.lockedStages[stageId];
  state.integrity.violationsByStage[stageId] = 0;

  const derived = deriveRosterFields(state);
  await pool.query(
    `UPDATE candidates SET current_stage=$1, completed_count=$2, flags_total=$3, state=$4, updated_at=$5 WHERE id=$6`,
    [derived.currentStage, derived.completedCount, derived.flagsTotal, JSON.stringify(state), new Date().toISOString(), row.id]
  );
  res.json({ ok: true });
});

// ---- Create a candidate record and hand back a link for HR to send manually ----
// (Automated email delivery is on hold — HR copies/sends this link themselves for now.)
router.post('/invite', async (req, res) => {
  const name = String(req.body.name || '').trim();
  const email = normalizeEmail(req.body.email);
  if (!name || !isValidEmail(email)) {
    return res.status(400).json({ error: 'A full name and valid email are required.' });
  }
  const existing = await selectByEmail(email);
  if (existing) {
    const base = process.env.BASE_URL || '';
    return res.json({ link: `${base}/?email=${encodeURIComponent(email)}`, alreadyExists: true });
  }

  const state = freshCandidateState(name, email);
  const now = new Date().toISOString();
  const derived = deriveRosterFields(state);
  await pool.query(
    `INSERT INTO candidates (id, candidate_id, name, email, current_stage, completed_count, flags_total, state, created_at, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
    [uuidv4(), state.candidateId, name, email, derived.currentStage, derived.completedCount, derived.flagsTotal, JSON.stringify(state), now, now]
  );
  await pool.query('INSERT INTO invites (email, sent_at) VALUES ($1, $2)', [email, now]);

  const base = process.env.BASE_URL || '';
  res.json({ link: `${base}/?email=${encodeURIComponent(email)}`, alreadyExists: false });
});

// ---- Exports ----
router.get('/roster/export', async (req, res) => {
  const rows = await selectAll();
  const records = rows.map((row) => ({ row, state: JSON.parse(row.state) }));
  const columns = [
    { label: 'Candidate ID', value: (r) => r.row.candidate_id },
    { label: 'Name', value: (r) => r.state.name },
    { label: 'Email', value: (r) => r.state.email },
    { label: 'Current Stage', value: (r) => r.row.current_stage },
    { label: 'Completed Stages', value: (r) => `${r.row.completed_count}/${stageIdsFor(r.state).length}` },
    ...QUIZ_STAGE_IDS.map((id) => ({
      label: id[0].toUpperCase() + id.slice(1) + ' Score',
      value: (r) => (r.state.scores[id] ? `${r.state.scores[id].correct}/${r.state.scores[id].total}` : ''),
    })),
    ...QUIZ_STAGE_IDS.map((id) => ({
      label: id[0].toUpperCase() + id.slice(1) + ' Passed',
      value: (r) =>
        r.state.scores[id] ? (r.state.scores[id].correct / r.state.scores[id].total >= PASS_THRESHOLD ? 'Yes' : 'No') : '',
    })),
    { label: 'Personality Avg', value: (r) => (r.state.personality ? r.state.personality.traitAvg : '') },
    ...Object.entries(TARGET_TRAITS).map(([key, label]) => ({
      label: `Trait: ${label}`,
      value: (r) => (r.state.personality && r.state.personality.traitScores ? r.state.personality.traitScores[key] ?? '' : ''),
    })),
    { label: 'Essay Word Count', value: (r) => (r.state.essay ? r.state.essay.wordCount : '') },
    { label: 'Case Study Word Count', value: (r) => (r.state.casestudy ? r.state.casestudy.wordCount : '') },
    { label: 'Demo Video Link', value: (r) => (r.state.demoVideo ? r.state.demoVideo.url : '') },
    { label: 'Shortlist Decision', value: (r) => (r.state.shortlist ? r.state.shortlist.decision : '') },
    { label: 'Consent Given', value: (r) => (r.state.consent ? 'Yes' : 'No') },
    { label: 'Consent At', value: (r) => (r.state.consent ? r.state.consent.agreedAt : '') },
    { label: 'Interview Day', value: (r) => (r.state.interview ? `${r.state.interview.dow} ${r.state.interview.display}` : '') },
    { label: 'Interview Slot', value: (r) => (r.state.interview ? r.state.interview.slot : '') },
    { label: 'HR Confirmed', value: (r) => (r.state.hrConfirmed ? 'Yes' : 'No') },
    { label: 'Board Confirmed', value: (r) => (r.state.board && r.state.board.confirmed ? 'Yes' : 'No') },
    { label: 'Security Flags', value: (r) => r.row.flags_total },
    { label: 'Locked Stages', value: (r) => Object.keys(r.state.integrity.lockedStages || {}).join('; ') },
    { label: 'Started At', value: (r) => r.state.startedAt },
    { label: 'Completed At', value: (r) => r.state.completedAt || '' },
    { label: 'Last Updated', value: (r) => r.row.updated_at },
  ];
  const csv = toCsv(records, columns);
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="candidate-roster.csv"');
  res.send(csv);
});

router.get('/candidates/:id/export', async (req, res) => {
  const row = await selectById(req.params.id);
  if (!row) return res.status(404).json({ error: 'Candidate not found.' });
  const state = JSON.parse(row.state);
  const report = buildCandidateReport(row, state);
  const format = req.query.format === 'csv' ? 'csv' : 'json';

  const safeName = report.name.replace(/[^a-z0-9]+/gi, '_');

  if (format === 'json') {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${safeName}_${report.candidateId}.json"`);
    return res.send(JSON.stringify(report, null, 2));
  }

  // CSV: one row per quiz question, plus summary rows for everything else.
  const rows = [];
  for (const stageId of QUIZ_STAGE_IDS) {
    const quiz = report.quizzes[stageId];
    quiz.questions.forEach((q, i) => {
      rows.push({
        section: quiz.label,
        item: `Q${i + 1}: ${q.question}`,
        response: q.selectedText || '',
        correct: q.correctText,
        result: q.selectedText == null ? '' : q.isCorrect ? 'Correct' : 'Incorrect',
      });
    });
  }
  if (report.personality) {
    report.personality.responses.forEach((r) => {
      rows.push({ section: 'Personality', item: r.statement, response: String(r.answerIndex), correct: '', result: r.trait || '' });
    });
    if (report.personality.traitScores) {
      report.personality.traitScores.forEach((t) => {
        rows.push({ section: 'Personality — Trait Score', item: t.trait, response: String(t.score), correct: '', result: '' });
      });
    }
  }
  if (report.essay) {
    rows.push({ section: 'Essay', item: 'Response text', response: report.essay.text, correct: '', result: `${report.essay.wordCount} words` });
  }
  if (report.casestudy) {
    rows.push({ section: 'Case Study', item: 'Response text', response: report.casestudy.text, correct: '', result: `${report.casestudy.wordCount} words` });
  }
  if (report.demoVideo) {
    rows.push({ section: 'Demo Video', item: 'Link', response: report.demoVideo.url, correct: '', result: report.demoVideo.notes || '' });
  }
  rows.push({ section: 'Consent', item: 'Consent given', response: report.consent ? 'Yes' : 'No', correct: '', result: report.consent ? report.consent.agreedAt : '' });
  if (report.shortlist) {
    rows.push({ section: 'Shortlist', item: 'Decision', response: report.shortlist.decision, correct: '', result: report.shortlist.decidedAt });
  }
  const columns = [
    { label: 'Section', value: (r) => r.section },
    { label: 'Item', value: (r) => r.item },
    { label: 'Response', value: (r) => r.response },
    { label: 'Correct Answer', value: (r) => r.correct },
    { label: 'Result', value: (r) => r.result },
  ];
  const csv = toCsv(rows, columns);
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="${safeName}_${report.candidateId}.csv"`);
  res.send(csv);
});

module.exports = router;
