const { QUIZZES, LIKERT_STATEMENTS } = require('../quizzes');

const QUIZ_STAGE_IDS = ['english', 'ict', 'cognitive', 'instructional'];
const PASS_THRESHOLD = 0.7;

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

  const personality = state.personality
    ? {
        traitAvg: state.personality.traitAvg,
        responses: LIKERT_STATEMENTS.map((stmt, i) => ({
          statement: stmt,
          answerIndex: state.personality.answers[i],
        })),
      }
    : null;

  return {
    id: row.id,
    candidateId: state.candidateId,
    name: state.name,
    email: state.email,
    currentStageId: state.currentStageId,
    startedAt: state.startedAt,
    completedAt: state.completedAt,
    quizzes,
    personality,
    essay: state.essay,
    casestudy: state.casestudy,
    interview: state.interview,
    hrConfirmed: state.hrConfirmed,
    board: state.board,
    integrity: state.integrity,
  };
}

module.exports = { buildCandidateReport, QUIZ_STAGE_IDS, PASS_THRESHOLD };
