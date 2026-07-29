const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { pool } = require('../db');
const { freshCandidateState, deriveRosterFields } = require('../lib/candidateState');
const { gradeQuiz } = require('../quizzes');
const { STAGE_IDS } = require('../stages');

const router = express.Router();
const QUIZ_STAGE_IDS = ['english', 'ict', 'cognitive', 'instructional'];

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}
function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
async function findByEmail(email) {
  const { rows } = await pool.query('SELECT * FROM candidates WHERE email = $1', [email]);
  return rows[0];
}
function rowToState(row) {
  return JSON.parse(row.state);
}
async function persist(row, state) {
  const derived = deriveRosterFields(state);
  await pool.query(
    `UPDATE candidates SET name=$1, current_stage=$2, completed_count=$3, flags_total=$4, state=$5, updated_at=$6
     WHERE id=$7`,
    [state.name, derived.currentStage, derived.completedCount, derived.flagsTotal, JSON.stringify(state), new Date().toISOString(), row.id]
  );
}

// Create-or-resume — the gate screen.
router.post('/', async (req, res) => {
  const name = String(req.body.name || '').trim();
  const email = normalizeEmail(req.body.email);
  if (!name || !isValidEmail(email)) {
    return res.status(400).json({ error: 'A full name and valid email are required.' });
  }

  const existing = await findByEmail(email);
  if (existing) {
    return res.json({ state: rowToState(existing), resumed: true });
  }

  const state = freshCandidateState(name, email);
  const now = new Date().toISOString();
  const derived = deriveRosterFields(state);
  await pool.query(
    `INSERT INTO candidates (id, candidate_id, name, email, current_stage, completed_count, flags_total, state, created_at, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
    [uuidv4(), state.candidateId, name, email, derived.currentStage, derived.completedCount, derived.flagsTotal, JSON.stringify(state), now, now]
  );
  res.json({ state, resumed: false });
});

router.get('/:email', async (req, res) => {
  const email = normalizeEmail(req.params.email);
  const row = await findByEmail(email);
  if (!row) return res.status(404).json({ error: 'No application found for that email.' });
  res.json({ state: rowToState(row) });
});

// Save non-scored progress (personality, essay/case-study text, interview pick,
// hr/board confirmations, currentStageId, integrity log). Quiz scores and the
// completed-flag for quiz stages are NOT trusted from the client here — they can
// only change via the /submit-quiz endpoint below, which grades server-side.
router.put('/:email', async (req, res) => {
  const email = normalizeEmail(req.params.email);
  const row = await findByEmail(email);
  if (!row) return res.status(404).json({ error: 'No application found for that email.' });

  const existingState = rowToState(row);
  const incoming = req.body && req.body.state;
  if (!incoming || typeof incoming !== 'object') {
    return res.status(400).json({ error: 'Missing state payload.' });
  }

  const nextState = { ...incoming };
  nextState.email = existingState.email;
  nextState.candidateId = existingState.candidateId;
  nextState.scores = existingState.scores;
  nextState.completed = { ...(incoming.completed || {}) };
  for (const id of QUIZ_STAGE_IDS) {
    nextState.completed[id] = existingState.completed[id];
  }

  // A locked section can only be cleared by HR (admin unlock endpoint) — the
  // candidate's own client is never allowed to remove itself from lockedStages,
  // and reported violation counts can only go up, never down, via this route.
  const existingIntegrity = existingState.integrity || { violationsByStage: {}, lockedStages: {}, log: [] };
  const incomingIntegrity = incoming.integrity || { violationsByStage: {}, lockedStages: {}, log: [] };
  const mergedViolations = { ...incomingIntegrity.violationsByStage };
  for (const [stageId, count] of Object.entries(existingIntegrity.violationsByStage || {})) {
    mergedViolations[stageId] = Math.max(count, mergedViolations[stageId] || 0);
  }
  nextState.integrity = {
    violationsByStage: mergedViolations,
    lockedStages: { ...(incomingIntegrity.lockedStages || {}), ...existingIntegrity.lockedStages },
    log: (incomingIntegrity.log || []).length >= (existingIntegrity.log || []).length
      ? incomingIntegrity.log
      : existingIntegrity.log,
  };

  await persist(row, nextState);
  res.json({ state: nextState });
});

// Authoritative quiz grading. Client sends raw selected-option indices; server
// grades against its private answer key and advances the candidate.
router.post('/:email/submit-quiz/:stageId', async (req, res) => {
  const email = normalizeEmail(req.params.email);
  const stageId = req.params.stageId;
  const row = await findByEmail(email);
  if (!row) return res.status(404).json({ error: 'No application found for that email.' });
  if (!QUIZ_STAGE_IDS.includes(stageId)) return res.status(400).json({ error: 'Unknown quiz stage.' });

  const state = rowToState(row);
  if (state.completed[stageId]) {
    return res.status(409).json({ error: 'This section was already submitted.', state });
  }

  const answers = Array.isArray(req.body.answers) ? req.body.answers : [];
  const score = gradeQuiz(stageId, answers);
  state.scores[stageId] = score;
  state.quizAnswers = state.quizAnswers || {};
  state.quizAnswers[stageId] = answers;
  state.completed[stageId] = true;
  const idx = STAGE_IDS.indexOf(stageId);
  const nextId = STAGE_IDS[idx + 1];
  if (nextId) state.currentStageId = nextId;

  await persist(row, state);
  res.json({ state, score });
});

module.exports = router;
