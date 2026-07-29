// Mirrors the STAGES ids in public/app.js — kept in one place server-side so
// derived roster fields (completed_count, current_stage validity) agree with
// what the client renders. If a stage is added/removed in app.js, update here too.
const STAGE_IDS = [
  'english',
  'ict',
  'cognitive',
  'instructional',
  'personality',
  'essay',
  'casestudy',
  'schedule',
  'hr',
  'board',
  'complete',
];

module.exports = { STAGE_IDS };
