// Mirrors the STAGES ids in public/app.js — kept in one place server-side so
// derived roster fields (completed_count, current_stage validity) agree with
// what the client renders. If a stage is added/removed in app.js, update here too.
//
// 'consent' and 'video' were added after real candidates were already mid-flow
// on the previous 11-stage sequence. The client detects legacy candidates
// (state.completed has no 'consent' key) and keeps them on the original
// sequence rather than retroactively inserting new required steps into an
// application already in progress — see stagesFor() in public/app.js. This
// server-side list only needs to reflect the CURRENT (new-candidate) sequence:
// the one server-side consumer of stage order (quiz submission's "what's
// next" lookup) only concerns the four quiz stages, whose relative order to
// each other is unchanged by these insertions.
const STAGE_IDS = [
  'consent',
  'english',
  'ict',
  'cognitive',
  'instructional',
  'personality',
  'essay',
  'casestudy',
  'video',
  'schedule',
  'hr',
  'board',
  'complete',
];

const LEGACY_STAGE_IDS = STAGE_IDS.filter((id) => id !== 'consent' && id !== 'video');

// Mirrors stagesFor() in public/app.js — legacy candidates (state.completed
// has no 'consent' key) never see the new stages, so their total-stage count
// should reflect the sequence they actually started, not the current one.
function stageIdsFor(state) {
  const isLegacy = !Object.prototype.hasOwnProperty.call(state.completed || {}, 'consent');
  return isLegacy ? LEGACY_STAGE_IDS : STAGE_IDS;
}

module.exports = { STAGE_IDS, LEGACY_STAGE_IDS, stageIdsFor };
