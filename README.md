# WAAPC American School — Faculty Recruitment Portal

A teacher recruitment platform: a consent/process-overview screen, English/ICT/Cognitive/
Instructional Strategies quizzes, a personality inventory scored against four named target
traits, an essay, a case study, a teaching demo video link, a human shortlist review before
interview scheduling, HR and board interview confirmations, and a live HR roster with
real-time scores, full responses, CSV/JSON export, and optional rejection emails.

Candidates created before these later additions (consent, demo video, shortlist review) stay
on the original 11-stage sequence they started — see `stagesFor()` in `public/app.js` and
`stageIdsFor()` in `server/stages.js`.

Candidate quiz grading happens **server-side only** — the browser never receives correct
answers, only questions and options.

## Setup

```bash
npm install
cp .env.example .env
```

Edit `.env`:

- `DATABASE_URL` — a Postgres connection string (Supabase's free tier works well; see
  [DEPLOY.md](DEPLOY.md) for exactly where to get this). Tables are created automatically on
  first boot.
- `SESSION_SECRET` — any long random string.
- `ADMIN_USERNAME` / `ADMIN_PASSWORD` — used **once**, to create the first HR account when the
  server starts and no HR account exists yet. Changing the password after first login isn't
  built in yet — for now, changing `.env` and clearing the `hr_users` table in the database
  will reseed it.
- `PORT` / `BASE_URL` — `BASE_URL` should be the real public URL once deployed (it's used to
  build the links HR sends candidates).
- `SMTP_*` — optional. Only needed for the "Send rejection email" button in the candidate
  detail view (candidate invite links are still generated manually by HR, not emailed
  automatically). Leave unset and that button shows a clear error instead of failing silently.
  Gmail works with an [App Password](https://myaccount.google.com/apppasswords); any standard
  SMTP provider (SendGrid, Resend, Postmark, etc.) works too.
- `ANTHROPIC_API_KEY` — optional. Powers an advisory-only "AI reading aid" HR sees alongside
  the essay/case study text (does it address the prompt, how substantial is it, any generic/
  off-topic red flags). **It never scores, grades, or recommends a decision** — automated
  employment-decision tools are legally regulated in several jurisdictions, so the only thing
  that actually gates progression is the human shortlist decision. Leave unset and the reading
  aid section just won't appear.

## Run

```bash
npm start
```

Open `http://localhost:3000`. HR roster is at the same URL — click "HR roster view" in the top
bar and sign in with the admin account from `.env`.

## Deploying it for real

See [DEPLOY.md](DEPLOY.md) for step-by-step instructions to put this on a public URL using
Supabase + Render + GitHub (and optionally Cloudflare for a custom domain).

## How candidates get in

Two ways:

1. **HR-initiated** (recommended): in the roster view, use "Add a candidate" to create the
   record and get a link like `http://localhost:3000/?email=jane@example.com`. Send that link
   to the candidate yourself — opening it drops them straight into their application, no form
   to fill in.
2. **Self-service**: a candidate can go to the root URL directly and enter their own name/email
   on the gate screen. Re-entering the same email later resumes exactly where they left off.

## Data & security notes

- All candidate and HR data lives in the Postgres database pointed to by `DATABASE_URL`. Export
  what you need (roster CSV, per-candidate exports) before deleting that database/project.
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
  db.js            Postgres pool + schema
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
