const { STAGE_IDS } = require('../stages');

function candidateIdFrom(email) {
  let hash = 0;
  for (let i = 0; i < email.length; i++) {
    hash = (hash * 31 + email.charCodeAt(i)) >>> 0;
  }
  return 'WAS-' + (1000 + (hash % 9000));
}

function freshCandidateState(name, email) {
  return {
    name,
    email,
    candidateId: candidateIdFrom(email),
    currentStageId: STAGE_IDS[0],
    completed: Object.fromEntries(STAGE_IDS.map((id) => [id, false])),
    scores: {},
    quizAnswers: {},
    consent: null,      // { agreedAt }
    personality: null,
    essay: null,
    casestudy: null,
    demoVideo: null,    // { url, notes, submittedAt }
    interview: null,
    hrConfirmed: false,
    board: null,
    completedAt: null,
    startedAt: new Date().toISOString(),
    integrity: {
      violationsByStage: {},
      lockedStages: {},
      log: [],
    },
  };
}

function deriveRosterFields(state) {
  const completedCount = Object.values(state.completed || {}).filter(Boolean).length;
  const flagsTotal = Object.values((state.integrity && state.integrity.violationsByStage) || {}).reduce(
    (a, b) => a + b,
    0
  );
  return {
    currentStage: state.currentStageId || STAGE_IDS[0],
    completedCount,
    flagsTotal,
  };
}

module.exports = { candidateIdFrom, freshCandidateState, deriveRosterFields };
