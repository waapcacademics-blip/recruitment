const { QUIZZES, LEGACY_LIKERT_STATEMENTS, TARGET_TRAITS } = require('../quizzes');

const QUIZ_STAGE_IDS = ['english', 'ict', 'cognitive', 'instructional'];
const PASS_THRESHOLD = 0.7;

function buildPersonalitySection(personality) {
  if (!personality) return null;

  // New shape: self-describing responses (trait + statement stored per
  // answer at submission time), plus a per-trait score breakdown.
  if (Array.isArray(personality.responses)) {
    return {
      traitAvg: personality.traitAvg,
      traitScores: personality.traitScores
        ? Object.entries(personality.traitScores).map(([key, value]) => ({
            trait: TARGET_TRAITS[key] || key,
            score: value,
          }))
        : null,
      responses: personality.responses.map((r) => ({
        statement: r.statement,
        trait: TARGET_TRAITS[r.trait] || null,
        answerIndex: r.answerIndex,
      })),
    };
  }

  // Legacy shape: submitted before target-trait scoring existed — a bare
  // answers array paired positionally with the original statement set.
  // No per-trait breakdown was ever collected for these.
  return {
    traitAvg: personality.traitAvg,
    traitScores: null,
    responses: LEGACY_LIKERT_STATEMENTS.map((stmt, i) => ({
      statement: stmt,
      trait: null,
      answerIndex: personality.answers ? personality.answers[i] : null,
    })),
  };
}

// Builds the full, HR-facing view of a candidate: scores with per-question
// review (using the private answer key), essay/case-study text, personality
// answers, interview details, and the integrity/security log. Used for both
// the admin detail screen and the export endpoints.
function buildCandidateReport(row, state) {
  const quizzes = {};
  for (const stageId of QUIZ_STAGE_IDS) {
    const quiz = QUIZZES[stageId];
    const score = state.scores[stageId];
    const rawAnswers = (state.quizAnswers && state.quizAnswers[stageId]) || null;
    quizzes[stageId] = {
      label: quiz.label,
      completed: !!state.completed[stageId],
      score: score || null,
      passed: score ? score.correct / score.total >= PASS_THRESHOLD : null,
      questions: rawAnswers
        ? quiz.questions.map((q, i) => ({
            question: q.q,
            options: q.options,
            selectedIndex: rawAnswers[i] ?? null,
            selectedText: rawAnswers[i] != null ? q.options[rawAnswers[i]] : null,
            correctIndex: q.correct,
            correctText: q.options[q.correct],
            isCorrect: rawAnswers[i] === q.correct,
          }))
        : [],
    };
  }

  return {
    id: row.id,
    candidateId: state.candidateId,
    name: state.name,
    email: state.email,
    currentStageId: state.currentStageId,
    startedAt: state.startedAt,
    completedAt: state.completedAt,
    consent: state.consent || null,
    quizzes,
    personality: buildPersonalitySection(state.personality),
    essay: state.essay,
    casestudy: state.casestudy,
    demoVideo: state.demoVideo || null,
    shortlist: state.shortlist || null,
    rejectionEmail: state.rejectionEmail || null,
    aiScreening: state.aiScreening || null,
    interview: state.interview,
    hrConfirmed: state.hrConfirmed,
    board: state.board,
    integrity: state.integrity,
  };
}

module.exports = { buildCandidateReport, QUIZ_STAGE_IDS, PASS_THRESHOLD };
