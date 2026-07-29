# WAAPC American School — Faculty Recruitment Portal

An 11-stage teacher recruitment platform: English/ICT/Cognitive/Instructional Strategies
quizzes, a personality inventory, an essay, a case study, interview scheduling, HR and board
interview confirmations, and a live HR roster with real-time scores, full responses, and
CSV/JSON export.

Candidate quiz grading happens **server-side only** — the browser never receives correct
answers, only questions and options.

## Setup

```bash
npm install
cp .env.example .env
```

Edit `.env`:

- `SESSION_SECRET` — any long random string.
- `ADMIN_USERNAME` / `ADMIN_PASSWORD` — used **once**, to create the first HR account when the
  server starts and no HR account exists yet. Change the password after first login isn't
  built in yet — for now, changing `.env` and deleting `server/data/recruitment.db` will
  reseed it (this also wipes all candidate data, so only do that before real use).
- `PORT` / `BASE_URL` — defaults are fine for local use (`http://localhost:3000`).
- `SMTP_*` — not used yet. Automated invite emails are on hold; HR currently generates a
  candidate link from the roster view and sends it manually (copy/paste into email, WhatsApp,
  etc.).

## Run

```bash
npm start
```

Open `http://localhost:3000`. HR roster is at the same URL — click "HR roster view" in the top
bar and sign in with the admin account from `.env`.

## How candidates get in

Two ways:

1. **HR-initiated** (recommended): in the roster view, use "Add a candidate" to create the
   record and get a link like `http://localhost:3000/?email=jane@example.com`. Send that link
   to the candidate yourself — opening it drops them straight into their application, no form
   to fill in.
2. **Self-service**: a candidate can go to the root URL directly and enter their own name/email
   on the gate screen. Re-entering the same email later resumes exactly where they left off.

## Data & security notes

- All candidate and HR data lives in `server/data/recruitment.db` (SQLite). Back this file up
  before any risky operation — deleting it wipes every candidate record.
- Quiz answer keys live only in `server/quizzes.js` and are never sent to the browser.
- A candidate's own browser cannot clear a security lock on itself or edit its own quiz score —
  only the authoritative `/submit-quiz` endpoint (server-graded) and HR's unlock action can
  change those.
- This is still a **client-side anti-cheat** system (as the original spec notes): it blocks
  copy/paste, tab-switching, right-click, and devtools shortcuts, and logs every attempt, but
  it cannot stop a second device or a phone camera pointed at the screen. Real proctoring
  assurance would need dedicated proctoring software.
- Candidate access is link/email-based, not password-based, matching the "one link" design —
  anyone who has a candidate's exact email can resume that candidate's application.

## Project layout

```
server/
  index.js         Express app entry
  db.js            SQLite connection + schema
  auth.js          HR session auth
  quizzes.js        Private quiz question bank + grading
  stages.js          Shared stage id list
  lib/                candidateState.js, candidateReport.js, csv.js helpers
  routes/
    content.js        Public quiz/likert/essay content (no answer key)
    candidates.js      Candidate create/resume/save/submit-quiz
    admin.js            HR login, roster, candidate detail, exports, unlock, invite
public/
  index.html, styles.css, app.js   Single-page frontend
  assets/logo.jpg                    School crest
```
