// Authoritative quiz question banks. Correct answers live only here, server-side —
// never sent to the browser. Clients fetch a "public" version (question + options,
// no `correct` field) and submit raw answer indices for server-side grading.
const QUIZZES = {
  english: {
    label: 'English Proficiency',
    questions: [
      { q: "Choose the sentence that correctly uses the subjunctive mood.",
        options: ["If I was the department head, I would revise the assessment policy.", "If I were the department head, I would revise the assessment policy.", "If I am the department head, I would revise the assessment policy.", "If I be the department head, I would revise the assessment policy."],
        correct: 1 },
      { q: "Which sentence uses the semicolon correctly?",
        options: ["The students finished the exam; and left the room.", "The students finished the exam; they left the room quietly.", "The students finished the exam, they left; the room.", "The students; finished the exam and left the room."],
        correct: 1 },
      { q: "Which sentence contains a dangling modifier?",
        options: ["Having reviewed the lesson plan, the teacher felt prepared.", "Having reviewed the lesson plan, the classroom felt ready for the students.", "After reviewing the lesson plan, the teacher revised two activities.", "The teacher, having reviewed the lesson plan, felt prepared."],
        correct: 1 },
      { q: "Choose the word that best completes: 'The rubric was designed to ___ ambiguity in grading.'",
        options: ["eliminate", "illuminate", "elicit", "emulate"],
        correct: 0 },
      { q: "Select the sentence with correct use of an appositive.",
        options: ["Ms. Rivera the new science coordinator will lead the training.", "Ms. Rivera, the new science coordinator, will lead the training.", "Ms. Rivera, the new science coordinator will lead, the training.", "Ms. Rivera the new, science coordinator, will lead the training."],
        correct: 1 },
      { q: "Which sentence correctly uses parallel structure?",
        options: ["The teacher's duties include planning lessons, grading assignments, and to supervise recess.", "The teacher's duties include planning lessons, grading assignments, and supervising recess.", "The teacher's duties include to plan lessons, grading, and supervise recess.", "The teacher's duties include planning, to grade, and supervising."],
        correct: 1 },
      { q: "Choose the correct word: 'Poor sleep can negatively ___ a student's concentration.'",
        options: ["effect", "affect", "affects", "effecting"],
        correct: 1 },
      { q: "Which sentence correctly uses a colon?",
        options: ["The syllabus lists: three components, readings and exams.", "The syllabus lists three components: readings, assignments, and exams.", "The syllabus: lists three components readings, assignments, and exams.", "The syllabus lists three components readings: assignments, and exams."],
        correct: 1 },
      { q: "Choose the best synonym for 'ubiquitous' as used in: 'Formative assessment has become ubiquitous in modern classrooms.'",
        options: ["rare", "controversial", "widespread", "optional"],
        correct: 2 },
      { q: "Which sentence is grammatically correct?",
        options: ["Neither the principal nor the teachers was informed.", "Neither the principal nor the teachers were informed.", "Neither the principal or the teachers were informed.", "Neither the principal nor teachers was informed."],
        correct: 1 },
    ],
  },
  ict: {
    label: 'ICT Assessment',
    questions: [
      { q: "A teacher wants real-time formative feedback during a live lesson without printing anything. Which tool type fits best?",
        options: ["A live polling/quiz tool", "A static PDF handout", "Offline flashcards", "A printed worksheet"],
        correct: 0 },
      { q: "Which practice best protects student data privacy when adopting a new classroom app?",
        options: ["Use personal email addresses for all student accounts", "Review the app's data privacy policy and use school-managed accounts", "Share login credentials publicly for convenience", "Store all student data in a personal cloud drive"],
        correct: 1 },
      { q: "A gradebook spreadsheet shows a #REF! error after a column was deleted. What does this indicate?",
        options: ["A formula was referencing the deleted cells", "The file is corrupted beyond repair", "The spreadsheet has a virus", "The internet connection dropped"],
        correct: 0 },
      { q: "What is the most effective way to differentiate digital content for students with varying reading levels?",
        options: ["Use text-to-speech and adjustable reading-level materials", "Assign the same PDF to everyone", "Remove all text and use only video", "Increase font size only"],
        correct: 0 },
      { q: "Which best describes a Learning Management System (LMS)?",
        options: ["A single classroom projector's software", "A platform to organize, deliver, and track coursework and assessments online", "A firewall for the school WiFi", "A physical server room"],
        correct: 1 },
      { q: "A classroom projector shows 'No Signal.' What is the correct first troubleshooting step?",
        options: ["Replace the projector", "Check the cable connection and input source", "Reinstall the operating system", "Call the internet provider"],
        correct: 1 },
      { q: "What is a key risk of using unvetted third-party apps with students?",
        options: ["Faster grading turnaround", "Possible data privacy violations or inappropriate content exposure", "Improved bandwidth", "There is no risk if the app is free"],
        correct: 1 },
      { q: "Which digital citizenship habit should a teacher model when discussing online sources with students?",
        options: ["Copy-pasting information without attribution", "Evaluating credibility and citing sources properly", "Ignoring the publication date of a source", "Sharing information without verifying it"],
        correct: 1 },
      { q: "Two students editing a shared cloud document keep overwriting each other's work. What best explains a fix?",
        options: ["Turn off version history entirely", "Use real-time collaborative editing so both can see live cursors and comments", "Email the file back and forth instead", "Print separate copies for each student"],
        correct: 1 },
      { q: "Which is the strongest password practice to teach students?",
        options: ["Reuse the same password everywhere for consistency", "Write passwords on a sticky note taped to the device", "Use a unique passphrase with a mix of character types", "Use a birthdate as the password so it's memorable"],
        correct: 2 },
    ],
  },
  cognitive: {
    label: 'Cognitive Ability',
    questions: [
      { q: "Complete the sequence: 3, 7, 15, 31, 63, ?",
        options: ["95", "111", "127", "135"],
        correct: 2 },
      { q: "A class of 20 students has an average score of 72. One student's score of 52 is removed. What is the new average of the remaining 19 students? (round to the nearest whole number)",
        options: ["71", "72", "73", "74"],
        correct: 2 },
      { q: "Thermometer is to temperature as scale is to:",
        options: ["Length", "Weight", "Volume", "Time"],
        correct: 1 },
      { q: "All Fen are Dor. No Dor are Kel. Which statement must be true?",
        options: ["No Fen are Kel", "Some Fen are Kel", "All Kel are Fen", "Some Dor are Fen only"],
        correct: 0 },
      { q: "Which word does not belong with the others?",
        options: ["Democracy", "Monarchy", "Oligarchy", "Symphony"],
        correct: 3 },
      { q: "Complete the sequence: 5, 11, 23, 47, 95, ?",
        options: ["143", "167", "191", "199"],
        correct: 2 },
      { q: "If 5 machines make 5 widgets in 5 minutes, how long would it take 100 machines to make 100 widgets?",
        options: ["5 minutes", "20 minutes", "100 minutes", "500 minutes"],
        correct: 0 },
      { q: "A teacher wants to split 30 students into equal groups with none left over. Which group size works?",
        options: ["4", "6", "7", "9"],
        correct: 1 },
      { q: "'If it is a professional development day, school is closed to students. School is closed to students today. Therefore, today is a professional development day.' This reasoning is:",
        options: ["Valid and sound", "A logical fallacy (affirming the consequent)", "Circular reasoning", "An analogy"],
        correct: 1 },
      { q: "What number continues the pattern: 1, 4, 9, 16, 25, ?",
        options: ["30", "32", "36", "49"],
        correct: 2 },
    ],
  },
  instructional: {
    label: 'Instructional Strategies',
    questions: [
      { q: "A 9-year-old student discloses that a family member hurts them at home. What is the teacher's FIRST responsibility?",
        options: ["Promise complete confidentiality and take no further action", "Follow the school's child protection policy and report to the designated safeguarding lead", "Confront the family member directly", "Discuss the disclosure with other staff informally in a group chat"],
        correct: 1 },
      { q: "Which best describes a core principle of child safeguarding in schools?",
        options: ["Safeguarding is solely the school counselor's responsibility", "Every staff member shares responsibility for identifying and reporting concerns", "Only physical abuse needs to be reported", "Concerns should be fully investigated by the teacher before reporting"],
        correct: 1 },
      { q: "A student frequently arrives with unexplained bruises and seems fearful of going home. What is the appropriate next step?",
        options: ["Assume it is an accident and say nothing", "Document factual observations and report to the designated safeguarding lead", "Ask the parents directly and confront them", "Discuss the situation openly with other students"],
        correct: 1 },
      { q: "When taking photographs of students for a school newsletter, what should a teacher ensure first?",
        options: ["Post the photos immediately on personal social media", "Proper consent has been obtained and the school's photography/data policy is followed", "Photos can be used however seen fit", "No safeguards are needed for a newsletter"],
        correct: 1 },
      { q: "A class has students reading three grade levels apart. Which strategy best differentiates instruction while keeping a shared learning goal?",
        options: ["Teach only to the middle of the class", "Provide tiered texts and tasks matched to readiness, tied to a common objective", "Give the advanced readers unstructured free time", "Assign the identical worksheet to every student"],
        correct: 1 },
      { q: "Content, process, and product are three common ways to differentiate instruction. Which option below is an example of differentiating by PROCESS?",
        options: ["Giving some students an audiobook version of the same text", "Letting students choose between writing an essay or recording a video to show learning", "Grouping students for guided practice with varying levels of teacher support", "Assigning a shorter reading passage to struggling readers"],
        correct: 2 },
      { q: "A gifted student consistently finishes tasks early and becomes disruptive. What is the best differentiation response?",
        options: ["Assign extra busywork at the same difficulty level", "Provide extension tasks that deepen or extend the learning goal", "Ignore the disruptive behavior", "Move the student to a lower grade-level class"],
        correct: 1 },
      { q: "A student repeatedly calls out answers without raising a hand. Which response best reflects positive classroom management?",
        options: ["Publicly embarrass the student in front of peers", "Calmly restate the expected procedure and acknowledge students who raise their hands", "Ignore the behavior indefinitely", "Remove the student from class permanently"],
        correct: 1 },
      { q: "What is the primary purpose of establishing classroom routines at the start of the year?",
        options: ["To limit student creativity", "To reduce transition time and behavioral disruptions by creating predictability", "To give teachers something to enforce", "Routines mainly matter for younger students"],
        correct: 1 },
      { q: "A conflict arises between two students during group work. What is the most effective FIRST step?",
        options: ["Separate the students immediately without discussion", "Calmly de-escalate, hear both perspectives, and guide them toward a resolution", "Assign blame based on who complained first", "Cancel group work for the rest of the term"],
        correct: 1 },
    ],
  },
};

// Each statement is tagged to one of four target traits the hiring
// committee wants a read on. Two statements per trait; the candidate never
// sees the trait labels, only the statement — scoring per trait happens
// after submission (see submitLikert in candidates.js / app.js).
const TARGET_TRAITS = {
  openMindedness: 'Open-Mindedness',
  collaboration: 'Collaboration',
  diversityAcceptance: 'Acceptance of Diversity',
  adaptability: 'Adaptability',
};

// Original (pre-target-traits) statement set, kept only so HR can still see
// a correct statement/answer pairing for personality inventories that were
// already submitted before this change — see buildCandidateReport().
const LEGACY_LIKERT_STATEMENTS = [
  "I stay calm when a lesson plan doesn't go as expected.",
  "I enjoy adapting my teaching style to different learners.",
  "I prefer clear routines over improvising in the classroom.",
  "I find it easy to give constructive feedback to colleagues.",
  "I actively seek feedback on my own teaching.",
  "I feel energized after collaborating with a team.",
  "I stay organized even during high-pressure weeks.",
  "I'm comfortable using new technology in my teaching.",
];

const LIKERT_STATEMENTS = [
  { statement: "I enjoy considering teaching approaches that are different from my own.", trait: 'openMindedness' },
  { statement: "I'm willing to change my opinion when presented with a good argument.", trait: 'openMindedness' },
  { statement: "I feel energized after collaborating with a team.", trait: 'collaboration' },
  { statement: "I find it easy to give constructive feedback to colleagues.", trait: 'collaboration' },
  { statement: "I adapt my communication style to work effectively with people from different cultural backgrounds.", trait: 'diversityAcceptance' },
  { statement: "I believe a classroom benefits from students and staff with diverse perspectives and backgrounds.", trait: 'diversityAcceptance' },
  { statement: "I stay calm when a lesson plan doesn't go as expected.", trait: 'adaptability' },
  { statement: "I adjust my plans quickly when circumstances change unexpectedly.", trait: 'adaptability' },
];

const LONGFORM = {
  essay: {
    title: "Essay Writing",
    prompt: "Describe your teaching philosophy and how you would build an inclusive classroom at an international school. Include a specific example from your experience.",
    minWords: 150,
    timeLimitSeconds: 25 * 60,
  },
  casestudy: {
    title: "Case Study — International Students",
    prompt: "You are a Grade 6 homeroom teacher at an international school with a highly mobile, diverse student population. This term you have three newly arrived international students:\n\n• Yuki (Japan) — fluent in academic English, but reluctant to speak up in class discussions due to cultural norms around not wanting to appear boastful.\n• Diego (Mexico) — academic English still developing; his parents, who speak limited English, have not responded to your emails about a pattern of missing homework.\n• Amara (Nigeria) — has changed schools four times in three years, is struggling to build friendships, and appears withdrawn during group work.\n\nThe three families also differ sharply: one expects frequent formal progress reports, one is anxious about being contacted at all after a negative experience at a previous school, and one is currently unreachable by email.\n\nIn a well-structured response, address ALL of the following:\n1. How would you adapt your teaching and classroom practices to support these three students' learning and language needs?\n2. How would you build effective communication and trust with each family, given their different needs and backgrounds?\n3. How would you help these students integrate socially and emotionally into the classroom community?",
    minWords: 200,
    timeLimitSeconds: 35 * 60,
  },
};

function publicQuiz(stageId) {
  const quiz = QUIZZES[stageId];
  if (!quiz) return null;
  return {
    label: quiz.label,
    questions: quiz.questions.map((q) => ({ q: q.q, options: q.options })),
  };
}

function gradeQuiz(stageId, answers) {
  const quiz = QUIZZES[stageId];
  if (!quiz) return null;
  let correct = 0;
  quiz.questions.forEach((q, i) => {
    if (Array.isArray(answers) && answers[i] === q.correct) correct++;
  });
  return { correct, total: quiz.questions.length };
}

module.exports = { QUIZZES, LIKERT_STATEMENTS, LEGACY_LIKERT_STATEMENTS, TARGET_TRAITS, LONGFORM, publicQuiz, gradeQuiz };
