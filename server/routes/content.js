const express = require('express');
const { publicQuiz, LIKERT_STATEMENTS, LONGFORM } = require('../quizzes');

const router = express.Router();
const QUIZ_STAGE_IDS = ['english', 'ict', 'cognitive', 'instructional'];

// Public content for rendering stages — quiz questions/options only, never the
// correct-answer key. Fetched once by the client on boot.
router.get('/', (req, res) => {
  const quizzes = {};
  for (const id of QUIZ_STAGE_IDS) quizzes[id] = publicQuiz(id);
  res.json({ quizzes, likertStatements: LIKERT_STATEMENTS, longform: LONGFORM });
});

module.exports = router;
