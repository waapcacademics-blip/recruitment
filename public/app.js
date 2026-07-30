/* =========================================================
   WAAPC AMERICAN SCHOOL — FACULTY RECRUITMENT PORTAL
   Client app. Talks to the Express/SQLite backend in server/
   over fetch() — no data lives in the browser. Quiz grading
   happens server-side; this file only renders/collects answers.
   ========================================================= */

const SCHOOL_NAME = "WAAPC American School";

const STAGES = [
  { id:'consent',         label:'Consent & Overview',      sub:'Process overview & data consent',       type:'consent' },
  { id:'english',        label:'English Proficiency',    sub:'Written & usage test · 10 items',       type:'quiz' },
  { id:'ict',             label:'ICT Assessment',          sub:'Digital literacy test · 10 items',      type:'quiz' },
  { id:'cognitive',       label:'Cognitive Ability',       sub:'Reasoning test · 10 items',             type:'quiz' },
  { id:'instructional',   label:'Instructional Strategies',sub:'Safeguarding, differentiation & management · 10 items', type:'quiz' },
  { id:'personality',     label:'Personality Profile',     sub:'Self-report inventory',                 type:'likert' },
  { id:'essay',           label:'Essay Writing',           sub:'Teaching philosophy',                   type:'essay' },
  { id:'casestudy',       label:'Case Study',              sub:'International students scenario',       type:'case' },
  { id:'video',           label:'Teaching Demo Video',     sub:'~5 minute video link',                  type:'video' },
  { id:'shortlist',       label:'Application Review',      sub:'Human review before interview',          type:'shortlist' },
  { id:'schedule',        label:'Interview Scheduling',    sub:'Pick your interview day',                type:'calendar' },
  { id:'hr',              label:'HR Interview',            sub:'Orientation & fit',                      type:'hr' },
  { id:'board',           label:'Board Interview',         sub:'Final panel round',                      type:'board' },
  { id:'complete',        label:'Application Complete',    sub:'Summary & next steps',                   type:'summary' },
];

// 'consent' and 'video' were added after real candidates were already
// mid-application on the original 11-stage flow. Rather than retroactively
// inserting new required steps into an application already in progress, any
// candidate whose saved state predates this change (no 'consent' key in
// their completed map) stays on the exact sequence they started — only
// candidates created from now on go through the full new sequence.
function stagesFor(c){
  if(!c || !c.completed) return STAGES;
  const isLegacy = !Object.prototype.hasOwnProperty.call(c.completed, 'consent');
  return isLegacy ? STAGES.filter(s => s.id !== 'consent' && s.id !== 'video' && s.id !== 'shortlist') : STAGES;
}

const PASS_THRESHOLD = 0.7;
const SECONDS_PER_QUESTION = 45;
const MAX_VIOLATIONS_BEFORE_LOCK = 3;
const QUIZ_STAGE_IDS = ['english', 'ict', 'cognitive', 'instructional'];
const LIKERT_LABELS = ["Strongly disagree","Disagree","Neutral","Agree","Strongly agree"];

let CONTENT = null; // { quizzes, likertStatements, longform } — loaded once from /api/content

/* ---------------- API layer ---------------- */
async function loadContent(){
  const res = await fetch('/api/content');
  CONTENT = await res.json();
}
async function apiCreateOrResume(name, email){
  const res = await fetch('/api/candidates', {
    method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({ name, email }),
  });
  const data = await res.json();
  if(!res.ok) throw new Error(data.error || 'Could not start your application.');
  return data; // { state, resumed }
}
async function apiLoadCandidate(email){
  const res = await fetch('/api/candidates/' + encodeURIComponent(email));
  if(!res.ok) return null;
  const data = await res.json();
  return data.state;
}
async function saveCandidate(){
  if(!candidate) return;
  try{
    const res = await fetch('/api/candidates/' + encodeURIComponent(candidate.email), {
      method:'PUT', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ state: candidate }),
    });
    if(!res.ok) return;
    const data = await res.json();
    candidate = data.state;
  }catch(e){ console.error('save failed', e); }
}
async function apiSubmitQuiz(stageId, answers){
  const res = await fetch(`/api/candidates/${encodeURIComponent(candidate.email)}/submit-quiz/${stageId}`, {
    method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({ answers }),
  });
  const data = await res.json();
  if(!res.ok) throw new Error(data.error || 'Could not submit this section.');
  return data; // { state, score }
}

/* ---- Admin API ---- */
async function apiAdminSession(){
  const res = await fetch('/api/admin/session');
  return res.json();
}
async function apiAdminLogin(username, password){
  const res = await fetch('/api/admin/login', {
    method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({ username, password }),
  });
  const data = await res.json();
  if(!res.ok) throw new Error(data.error || 'Sign-in failed.');
  return data;
}
async function apiAdminLogout(){
  await fetch('/api/admin/logout', { method:'POST' });
}
async function apiAdminRoster(){
  const res = await fetch('/api/admin/roster');
  if(!res.ok) return null;
  return (await res.json()).roster;
}
async function apiAdminCandidateDetail(id){
  const res = await fetch('/api/admin/candidates/' + id);
  if(!res.ok) return null;
  return (await res.json()).report;
}
async function apiAdminUnlock(id, stageId){
  await fetch(`/api/admin/candidates/${id}/unlock`, {
    method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({ stageId }),
  });
}
async function apiAdminShortlistDecision(id, decision){
  await fetch(`/api/admin/candidates/${id}/shortlist`, {
    method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({ decision }),
  });
}
async function apiAdminSendRejectionEmail(id){
  const res = await fetch(`/api/admin/candidates/${id}/send-rejection-email`, { method:'POST' });
  const data = await res.json();
  if(!res.ok) throw new Error(data.error || 'Could not send the email.');
  return data; // { ok, alreadySent, sentAt }
}
async function apiAdminInvite(name, email){
  const res = await fetch('/api/admin/invite', {
    method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({ name, email }),
  });
  const data = await res.json();
  if(!res.ok) throw new Error(data.error || 'Could not create candidate.');
  return data; // { link, alreadyExists }
}

/* ---------------- Small helpers ---------------- */
function toast(msg){
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(window.__toastTimer);
  window.__toastTimer = setTimeout(()=> t.classList.remove('show'), 2200);
}
function escapeHtml(s){
  return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function formatClock(totalSeconds){
  const m = Math.floor(totalSeconds/60), sec = totalSeconds%60;
  return `${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
}

/* ---------------- Crest (WAAPC American School seal) ---------------- */
function renderCrest(size, idSuffix){
  return `<img class="crest" src="/assets/logo.jpg" alt="${escapeHtml(SCHOOL_NAME)} crest" width="${size}" height="${size}" style="width:${size}px;height:${size}px;object-fit:contain;">`;
}

/* =========================================================
   SECURITY / ANTI-CHEAT ENGINE
   ========================================================= */
let secureActive = false;
let secureStageId = null;

function violationLimit(){ return MAX_VIOLATIONS_BEFORE_LOCK; }

function showViolation(msg){
  let el = document.getElementById('violation-toast');
  if(!el){
    el = document.createElement('div');
    el.id = 'violation-toast';
    el.className = 'violation-toast';
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(window.__violationTimer);
  window.__violationTimer = setTimeout(()=> el.classList.remove('show'), 2600);
}

async function recordViolation(type, label){
  if(!secureActive || !candidate) return;
  const stageId = secureStageId;
  candidate.integrity = candidate.integrity || { violationsByStage:{}, lockedStages:{}, log:[] };
  const vbs = candidate.integrity.violationsByStage;
  vbs[stageId] = (vbs[stageId] || 0) + 1;
  candidate.integrity.log.push({ stageId, type, at: new Date().toISOString() });
  showViolation(`${label} — logged (${vbs[stageId]}/${violationLimit()}). Repeated attempts will lock this section.`);
  updateSecureBanner();
  if(vbs[stageId] >= violationLimit()){
    candidate.integrity.lockedStages[stageId] = true;
    await saveCandidate();
    render();
    return;
  }
  await saveCandidate();
}

function updateSecureBanner(){
  const el = document.getElementById('sb-flags');
  if(el && candidate){
    const n = candidate.integrity.violationsByStage[secureStageId] || 0;
    el.textContent = `${n}/${violationLimit()} flags`;
  }
}

function onSecureKeydown(e){
  const k = e.key ? e.key.toLowerCase() : '';
  const combo = (e.ctrlKey || e.metaKey);
  if(combo && ['c','x','v','p','u','s'].includes(k)){
    e.preventDefault();
    recordViolation('shortcut', k==='v' ? 'Pasting is disabled during this section' : 'Copy/print shortcuts are disabled during this section');
    return false;
  }
  if(k === 'f12' || (combo && e.shiftKey && ['i','j','c'].includes(k))){
    e.preventDefault();
    recordViolation('devtools', 'Developer tools are disabled during this section');
    return false;
  }
  // Best-effort only: most browsers (notably Chrome/Windows) never deliver a
  // keydown event for PrintScreen at all, so this can't reliably prevent or
  // even detect a screenshot — it only catches it on the browsers/OSes that
  // do expose the key. The watermark is the real mitigation for screenshots.
  if(k === 'printscreen'){
    recordViolation('screenshot_key', 'A screenshot key press was detected and logged');
  }
}
function onSecureCopyCut(e){ e.preventDefault(); recordViolation('copy', 'Copying question content is disabled during this section'); }
function onSecurePaste(e){ e.preventDefault(); recordViolation('paste', 'Pasting is disabled — please type your own response'); }
function onSecureContextMenu(e){ e.preventDefault(); recordViolation('contextmenu', 'Right-click is disabled during this section'); }

/* Tab-switch / minimize detection.
   Only document.visibilitychange is trustworthy here — it fires exclusively
   when the actual browser tab is hidden (switched away, minimized, screen
   locked). We deliberately do NOT use window "blur", because blur fires on
   completely ordinary things (clicking an address bar, a browser extension)
   and was flagging candidates for routine, harmless actions.
   On top of that we add:
   - a debounce: the tab must stay hidden for HIDE_CONFIRM_MS before it counts,
     so a brief flicker never triggers a flag.
   - a cooldown: once a violation fires, we ignore further hide events for
     VIOLATION_COOLDOWN_MS so one switch-away doesn't get logged multiple times. */
const HIDE_CONFIRM_MS = 62000; // 1 minute 2 seconds
const VIOLATION_COOLDOWN_MS = 10000; // 10 seconds
let hideConfirmTimer = null;
let lastViolationAt = 0;

function onSecureVisibility(){
  if(document.hidden){
    if(hideConfirmTimer) clearTimeout(hideConfirmTimer);
    hideConfirmTimer = setTimeout(() => {
      hideConfirmTimer = null;
      if(!document.hidden || !secureActive) return; // came back before it was confirmed
      const now = Date.now();
      if(now - lastViolationAt < VIOLATION_COOLDOWN_MS) return; // still in cooldown from the last flag
      lastViolationAt = now;
      recordViolation('tabswitch', 'Leaving this tab or window during a secured section is flagged');
    }, HIDE_CONFIRM_MS);
  } else {
    if(hideConfirmTimer){ clearTimeout(hideConfirmTimer); hideConfirmTimer = null; }
  }
}
function onSecureBeforeUnload(e){
  if(!secureActive) return;
  e.preventDefault();
  e.returnValue = '';
  return '';
}

function attachSecurity(stageId){
  secureActive = true;
  secureStageId = stageId;
  lastViolationAt = 0;
  document.addEventListener('keydown', onSecureKeydown, true);
  document.addEventListener('copy', onSecureCopyCut, true);
  document.addEventListener('cut', onSecureCopyCut, true);
  document.addEventListener('paste', onSecurePaste, true);
  document.addEventListener('contextmenu', onSecureContextMenu, true);
  document.addEventListener('visibilitychange', onSecureVisibility, true);
  window.addEventListener('beforeunload', onSecureBeforeUnload);
}
function detachSecurity(){
  secureActive = false;
  secureStageId = null;
  if(hideConfirmTimer){ clearTimeout(hideConfirmTimer); hideConfirmTimer = null; }
  document.removeEventListener('keydown', onSecureKeydown, true);
  document.removeEventListener('copy', onSecureCopyCut, true);
  document.removeEventListener('cut', onSecureCopyCut, true);
  document.removeEventListener('paste', onSecurePaste, true);
  document.removeEventListener('contextmenu', onSecureContextMenu, true);
  document.removeEventListener('visibilitychange', onSecureVisibility, true);
  window.removeEventListener('beforeunload', onSecureBeforeUnload);
}

/* Watermark: browsers cannot block screenshots or a phone camera pointed at
   the screen — no website can. What this does instead is make a leaked
   screenshot traceable: every secured stage is stamped, faintly and
   repeatedly, with the candidate's name, ID, and a live timestamp. It won't
   stop a capture, but it removes any deniability about where it came from
   and discourages sharing since it's tied to one person. */
function renderWatermark(){
  if(!candidate) return '';
  const stamp = `${candidate.candidateId} · ${candidate.name} · ${new Date().toLocaleString()}`;
  const row = `<span class="wm-row">${escapeHtml(stamp)}&emsp;&emsp;${escapeHtml(stamp)}&emsp;&emsp;${escapeHtml(stamp)}</span>`;
  return `<div class="watermark-overlay">${Array(7).fill(row).join('')}</div>`;
}

function renderSecureBanner(timeLabel, timeLow){
  const flags = candidate.integrity.violationsByStage[secureStageId] || 0;
  return `
    <div class="secure-banner no-select">
      <div class="sb-left">
        <span class="sb-dot"></span>
        <span>Secured section — copy, paste, and right-click are disabled. Leaving this tab is logged.</span>
      </div>
      <div style="display:flex;align-items:center;gap:16px;">
        <span class="sb-timer ${timeLow?'low':''}" id="sb-timer">${timeLabel}</span>
        <span class="sb-flags" id="sb-flags">${flags}/${violationLimit()} flags</span>
      </div>
    </div>`;
}

/* ---------------- App state ---------------- */
let view = 'gate';        // 'gate' | 'portal' | 'admin-login' | 'admin'
let candidate = null;
let draft = {};
let activeCountdown = null;
let rosterPollTimer = null;
let admin = { authenticated:false, username:null };
let adminState = { roster:[], loadingRoster:false, detailId:null, detail:null, inviteResult:null, loginError:null };

function stageIndex(id){ return stagesFor(candidate).findIndex(s => s.id === id); }
function nextStageId(currentId){
  const list = stagesFor(candidate);
  const idx = list.findIndex(s => s.id === currentId);
  return list[idx+1] ? list[idx+1].id : null;
}
function isStageUnlocked(id){
  const list = stagesFor(candidate);
  const idx = list.findIndex(s => s.id === id);
  if(idx === 0) return true;
  const prev = list[idx-1];
  return !!candidate.completed[prev.id];
}

/* ---------------- Root render ---------------- */
function render(){
  const app = document.getElementById('app');
  if(view === 'gate'){ app.innerHTML = renderGate(); bindGate(); return; }
  if(view === 'admin-login'){ app.innerHTML = renderAdminLogin(); bindAdminLogin(); return; }
  if(view === 'admin'){ app.innerHTML = renderAdminShell(); bindTopbar(); bindAdminShell(); refreshRoster(); startRosterPolling(); return; }
  stopRosterPolling();
  app.innerHTML = renderPortalShell();
  bindTopbar();
  bindSidebar();
  renderStageBody();
}

function renderTopbar(){
  return `
    <div class="topbar">
      <div class="brand">
        ${renderCrest(40, 'topbar')}
        <div class="brand-text">
          <div class="school">${SCHOOL_NAME}</div>
          <div class="dept">Faculty Recruitment</div>
        </div>
      </div>
      <div class="topbar-right">
        ${candidate && (view==='portal') ? `
          <div class="who">
            <span class="name">${escapeHtml(candidate.name)}</span>
            <span class="cid">${candidate.candidateId}</span>
          </div>
        ` : ''}
        ${admin.authenticated && view==='admin' ? `<span>Signed in as ${escapeHtml(admin.username)}</span>` : ''}
        <button class="linklike" id="btn-admin-toggle">${view==='admin' ? 'Candidate view' : 'HR roster view'}</button>
        ${view==='admin' ? `<button class="linklike" id="btn-admin-logout">Sign out</button>` : ''}
      </div>
    </div>`;
}

function inProgressGuardActive(){
  return view === 'portal' && !!draft.started;
}

function bindTopbar(){
  const btn = document.getElementById('btn-admin-toggle');
  if(btn) btn.onclick = () => {
    if(inProgressGuardActive()){
      showViolation('Finish this timed section before switching views — it will auto-submit when the clock runs out.');
      return;
    }
    if(view === 'admin'){
      view = candidate ? 'portal' : 'gate';
    }else{
      view = admin.authenticated ? 'admin' : 'admin-login';
    }
    render();
  };
  const logout = document.getElementById('btn-admin-logout');
  if(logout) logout.onclick = async () => {
    await apiAdminLogout();
    admin = { authenticated:false, username:null };
    view = 'admin-login';
    render();
  };
}

/* ---------------- Gate screen ---------------- */
function renderGate(){
  const prefillEmail = draft.gateEmail || '';
  return `
    ${renderTopbar()}
    <div class="gate-wrap">
      <div class="gate-card">
        <div class="gate-crest">${renderCrest(88, 'gate')}</div>
        <div class="gate-eyebrow">One-link application access</div>
        <h1>Begin your faculty application</h1>
        <p class="lead">Enter your details below. Your one link takes you through every stage in order — assessments, essay, interview scheduling, HR orientation, and the board interview. Progress is saved automatically, so you can leave and come back to this same link.</p>
        <div class="field">
          <label for="in-name">Full name</label>
          <input id="in-name" type="text" placeholder="e.g. Amara Diallo" autocomplete="name">
        </div>
        <div class="field">
          <label for="in-email">Email address</label>
          <input id="in-email" type="email" placeholder="you@example.com" autocomplete="email" value="${escapeHtml(prefillEmail)}">
        </div>
        <div id="gate-err" class="err" style="display:none;"></div>
        <button class="btn gold" id="btn-enter" style="width:100%;margin-top:6px;">Access my application</button>
        <div class="gate-foot">Already started? Enter the same email to resume exactly where you left off.</div>
      </div>
    </div>`;
}

function bindGate(){
  bindTopbar();
  document.getElementById('btn-enter').onclick = async () => {
    const name = document.getElementById('in-name').value.trim();
    const email = document.getElementById('in-email').value.trim().toLowerCase();
    const errEl = document.getElementById('gate-err');
    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    if(!name || !emailOk){
      errEl.textContent = 'Please enter your full name and a valid email address.';
      errEl.style.display = 'block';
      return;
    }
    errEl.style.display = 'none';
    try{
      const { state, resumed } = await apiCreateOrResume(name, email);
      candidate = state;
      if(resumed) toast('Welcome back — resuming your application.');
      view = 'portal';
      render();
    }catch(e){
      errEl.textContent = e.message;
      errEl.style.display = 'block';
    }
  };
}

/* ---------------- Portal shell (sidebar + content) ---------------- */
function renderPortalShell(){
  return `
    ${renderTopbar()}
    <div class="layout">
      <div class="transcript">
        <div class="transcript-title">Application Transcript</div>
        ${stagesFor(candidate).map((s, i) => renderStageItem(s, i)).join('')}
      </div>
      <div class="content" id="stage-content"></div>
    </div>`;
}

function renderStageItem(s, i){
  const unlocked = isStageUnlocked(s.id);
  const done = !!candidate.completed[s.id];
  const held = !done && !!candidate.integrity.lockedStages[s.id];
  const active = candidate.currentStageId === s.id;
  const cls = ['stage-item'];
  if(active) cls.push('active');
  if(done) cls.push('done');
  if(held) cls.push('flagged');
  if(!unlocked) cls.push('locked');
  const rail = i < stagesFor(candidate).length - 1 ? `<div class="rail-line"></div>` : '';
  return `
    <div>
      <div class="${cls.join(' ')}" data-stage="${s.id}" data-unlocked="${unlocked}">
        <div class="stage-num">${done ? '✓' : (held ? '!' : (i+1))}</div>
        <div>
          <div class="stage-label">${s.label}</div>
          <div class="stage-sub">${held ? 'On hold — security flag' : s.sub}</div>
        </div>
        ${done ? `<div class="stamp">DONE</div>` : (held ? `<div class="stamp flag">HOLD</div>` : '')}
      </div>
      ${rail}
    </div>`;
}

function bindSidebar(){
  document.querySelectorAll('.stage-item').forEach(el => {
    el.onclick = () => {
      if(el.dataset.unlocked !== 'true') return;
      if(el.dataset.stage !== candidate.currentStageId && inProgressGuardActive()){
        showViolation('You can\'t leave a timed section once it has started — finish it or let the clock run out.');
        return;
      }
      candidate.currentStageId = el.dataset.stage;
      draft = {};
      render();
    };
  });
}

/* ---------------- Stage router ---------------- */
const SECURED_TYPES = ['quiz','essay','case'];

function renderStageBody(){
  const s = STAGES.find(x => x.id === candidate.currentStageId);
  const host = document.getElementById('stage-content');
  if(!s){ host.innerHTML = ''; return; }

  if(activeCountdown){ clearInterval(activeCountdown); activeCountdown = null; }
  const needsSecurity = SECURED_TYPES.includes(s.type) && !candidate.completed[s.id] && !candidate.integrity.lockedStages[s.id];
  if(needsSecurity){ if(!secureActive || secureStageId !== s.id) attachSecurity(s.id); }
  else { if(secureActive) detachSecurity(); }

  if(candidate.integrity.lockedStages[s.id] && !candidate.completed[s.id]){
    host.innerHTML = renderLockedStage(s);
    bindLockedStage(s);
    return;
  }

  switch(s.type){
    case 'consent': host.innerHTML = renderConsentStage(s); bindConsentStage(s); break;
    case 'quiz': host.innerHTML = renderQuizStage(s); bindQuizStage(s); break;
    case 'likert': host.innerHTML = renderLikertStage(s); bindLikertStage(s); break;
    case 'essay': host.innerHTML = renderLongformStage(s); bindLongformStage(s); break;
    case 'case': host.innerHTML = renderLongformStage(s); bindLongformStage(s); break;
    case 'video': host.innerHTML = renderVideoStage(s); bindVideoStage(s); break;
    case 'shortlist': host.innerHTML = renderShortlistStage(s); bindShortlistStage(s); break;
    case 'calendar': host.innerHTML = renderCalendarStage(s); bindCalendarStage(s); break;
    case 'hr': host.innerHTML = renderHrStage(s); bindHrStage(s); break;
    case 'board': host.innerHTML = renderBoardStage(s); bindBoardStage(s); break;
    case 'summary': host.innerHTML = renderSummaryStage(s); bindSummaryStage(s); break;
  }
}

/* ---------------- Consent & Overview stage ---------------- */
function renderConsentStage(s){
  const done = candidate.completed[s.id];
  if(done){
    return `
      <div class="card">
        <div class="stage-head">
          <div class="stage-eyebrow">Stage ${stageIndex(s.id)+1} of ${stagesFor(candidate).length}</div>
          <h2>${s.label}</h2>
        </div>
        <span class="pill pass">Consent recorded</span>
        <p class="stage-desc" style="margin-top:14px;">Thank you — recorded on ${new Date(candidate.consent.agreedAt).toLocaleString()}.</p>
        ${renderForwardNav(s.id)}
      </div>`;
  }
  return `
    <div class="card">
      <div class="stage-head">
        <div class="stage-eyebrow">Stage ${stageIndex(s.id)+1} of ${stagesFor(candidate).length}</div>
        <h2>${s.label}</h2>
      </div>
      <p class="stage-desc">Before you begin, here's the full shape of this application so there are no surprises along the way:</p>
      <ul class="info-list">
        <li><span class="ico">1</span> Four short tests: English Proficiency, ICT, Cognitive Ability, and Instructional Strategies (10 questions each, timed).</li>
        <li><span class="ico">2</span> A Personality Profile — a short self-report inventory, not scored pass/fail.</li>
        <li><span class="ico">3</span> A teaching-philosophy essay and an international-students case study, both written responses.</li>
        <li><span class="ico">4</span> A link to a short (~5 minute) teaching demonstration video that you host and share with us.</li>
        <li><span class="ico">5</span> A human review of your application by our hiring team before any interview is scheduled.</li>
        <li><span class="ico">6</span> Interview-day scheduling, an HR orientation conversation, and a board interview.</li>
      </ul>
      <p class="stage-desc">Your responses, scores, essay/case-study text, and demo video link will be visible to WAAPC American School's HR team and hiring committee for the purpose of evaluating your application. Timed sections are monitored for academic integrity (tab-switching, copy/paste, and screenshot attempts are logged) — see the notice on each of those stages for details.</p>
      <div class="checkline">
        <input type="checkbox" id="consent-confirm">
        <label for="consent-confirm">I have read the above, understand how my information will be used, and consent to proceed with this application.</label>
      </div>
      ${stageActionsHtml(false, 'Agree & begin application')}
    </div>`;
}
function bindConsentStage(s){
  if(candidate.completed[s.id]){ bindForwardNav(s.id); return; }
  const cb = document.getElementById('consent-confirm');
  const submit = document.getElementById('btn-submit-stage');
  cb.onchange = () => { submit.disabled = !cb.checked; };
  submit.onclick = async () => {
    candidate.consent = { agreedAt: new Date().toISOString() };
    candidate.completed[s.id] = true;
    const nid = nextStageId(s.id);
    if(nid) candidate.currentStageId = nid;
    draft = {};
    await saveCandidate();
    toast('Thanks — your application has begun.');
    render();
  };
}

/* ---------------- Teaching demo video stage ---------------- */
function isPlausibleUrl(v){
  try{ const u = new URL(v); return u.protocol === 'http:' || u.protocol === 'https:'; }catch(e){ return false; }
}
function renderVideoStage(s){
  const done = candidate.completed[s.id];
  if(done){
    return `
      <div class="card">
        <div class="stage-head">
          <div class="stage-eyebrow">Stage ${stageIndex(s.id)+1} of ${stagesFor(candidate).length}</div>
          <h2>${s.label}</h2>
        </div>
        <span class="pill pass">Submitted</span>
        <p class="stage-desc" style="margin-top:14px;">Your video link was submitted: <a href="${escapeHtml(candidate.demoVideo.url)}" target="_blank" rel="noopener">${escapeHtml(candidate.demoVideo.url)}</a></p>
        ${renderForwardNav(s.id)}
      </div>`;
  }
  if(!draft.videoUrl && draft.videoUrl !== '') draft.videoUrl = '';
  if(!draft.videoNotes && draft.videoNotes !== '') draft.videoNotes = '';
  const ok = isPlausibleUrl(draft.videoUrl);
  return `
    <div class="card">
      <div class="stage-head">
        <div class="stage-eyebrow">Stage ${stageIndex(s.id)+1} of ${stagesFor(candidate).length}</div>
        <h2>${s.label}</h2>
      </div>
      <p class="stage-desc">Record a short (around 5 minute) teaching demonstration — any subject/age group you're comfortable with — and host it somewhere you can share a link to (e.g. an unlisted YouTube video, Google Drive, or Loom). Paste that link below.</p>
      <div class="field">
        <label for="video-url">Video link</label>
        <input id="video-url" type="url" placeholder="https://..." value="${escapeHtml(draft.videoUrl)}">
      </div>
      <div class="field">
        <label for="video-notes">Notes for the reviewer (optional)</label>
        <textarea id="video-notes" rows="3" placeholder="Anything you'd like us to know before watching (subject, age group, context)...">${escapeHtml(draft.videoNotes)}</textarea>
      </div>
      ${stageActionsHtml(ok, 'Submit video link')}
    </div>`;
}
function bindVideoStage(s){
  if(candidate.completed[s.id]){ bindForwardNav(s.id); return; }
  const urlInput = document.getElementById('video-url');
  const notesInput = document.getElementById('video-notes');
  urlInput.oninput = () => {
    draft.videoUrl = urlInput.value.trim();
    const submitBtn = document.getElementById('btn-submit-stage');
    if(submitBtn) submitBtn.disabled = !isPlausibleUrl(draft.videoUrl);
  };
  notesInput.oninput = () => { draft.videoNotes = notesInput.value; };
  const submit = document.getElementById('btn-submit-stage');
  if(submit) submit.onclick = async () => {
    candidate.demoVideo = { url: draft.videoUrl, notes: draft.videoNotes || '', submittedAt: new Date().toISOString() };
    candidate.completed[s.id] = true;
    const nid = nextStageId(s.id);
    if(nid) candidate.currentStageId = nid;
    draft = {};
    await saveCandidate();
    toast('Video link submitted and saved.');
    render();
  };
}

/* ---------------- Human shortlist review stage ----------------
   No action for the candidate to take here — this just waits for HR to
   record a decision (from the roster/candidate detail view). "Check again"
   re-fetches the candidate's own state; if HR has since advanced them, this
   also applies the decision (marks the stage complete and moves on) without
   requiring another click. A rejection is terminal — there's nothing further
   to do or check. */
function renderShortlistStage(s){
  const decision = candidate.shortlist && candidate.shortlist.decision;
  if(decision === 'reject'){
    return `
      <div class="card">
        <div class="stage-head">
          <div class="stage-eyebrow">Stage ${stageIndex(s.id)+1} of ${stagesFor(candidate).length}</div>
          <h2>${s.label}</h2>
        </div>
        <p class="stage-desc">Thank you for the time and care you put into this application. After review, we won't be moving forward with your application on this occasion. We're grateful for your interest in ${SCHOOL_NAME} and wish you the best in your search.</p>
      </div>`;
  }
  return `
    <div class="card">
      <div class="stage-head">
        <div class="stage-eyebrow">Stage ${stageIndex(s.id)+1} of ${stagesFor(candidate).length}</div>
        <h2>${s.label}</h2>
      </div>
      <p class="stage-desc">Your application is complete and is now with our hiring team for review. There's nothing further needed from you right now — once a decision is made, checking back here (or clicking below) will move you forward to interview scheduling.</p>
      <div class="actions">
        <span></span>
        <div class="actions-right">
          <button class="btn secondary" id="btn-check-shortlist">Check again</button>
        </div>
      </div>
    </div>`;
}
async function applyShortlistDecision(s, freshCandidate){
  candidate = freshCandidate;
  if(candidate.shortlist && candidate.shortlist.decision === 'advance' && !candidate.completed[s.id]){
    candidate.completed[s.id] = true;
    const nid = nextStageId(s.id);
    if(nid) candidate.currentStageId = nid;
    await saveCandidate();
  }
}
function bindShortlistStage(s){
  // If HR had already decided before the candidate even arrived here
  // (e.g. reviewed the case study/video earlier), apply it immediately
  // rather than waiting for a manual "check again" click.
  if(candidate.shortlist && candidate.shortlist.decision === 'advance' && !candidate.completed[s.id]){
    applyShortlistDecision(s, candidate).then(render);
    return;
  }
  const btn = document.getElementById('btn-check-shortlist');
  if(btn) btn.onclick = async () => {
    const fresh = await apiLoadCandidate(candidate.email);
    if(!fresh) return;
    const hadDecision = fresh.shortlist && fresh.shortlist.decision;
    await applyShortlistDecision(s, fresh);
    if(hadDecision === 'advance') toast('Good news — moving you to interview scheduling.');
    else if(hadDecision === 'reject') toast('A decision has been recorded on your application.');
    else toast('Still under review — check back later.');
    render();
  };
}

function renderLockedStage(s){
  const n = candidate.integrity.violationsByStage[s.id] || 0;
  return `
    <div class="card locked-card">
      <div class="stage-eyebrow" style="color:var(--crimson-dark);">Section locked</div>
      <h2>${s.label} is locked for review</h2>
      <p class="stage-desc" style="color:#4A1520;">This section was paused after ${n} security flags (tab switches, copy/paste attempts, or window changes) were logged. That's expected behavior, not a punishment — it protects the integrity of your results. A recruiter needs to unlock this section before you can continue.</p>
      <div class="actions">
        <button class="linklike" id="btn-check-unlock">I've been unlocked — check again</button>
        <div class="actions-right">
          <button class="btn secondary" id="btn-request-unlock">Notify HR to unlock this section</button>
        </div>
      </div>
    </div>`;
}
function bindLockedStage(s){
  const btn = document.getElementById('btn-request-unlock');
  if(btn) btn.onclick = async () => {
    candidate.integrity.log.push({ stageId: s.id, type:'unlock_requested', at: new Date().toISOString() });
    await saveCandidate();
    toast('HR has been notified. They can review and unlock this section from the roster.');
  };
  const chk = document.getElementById('btn-check-unlock');
  if(chk) chk.onclick = async () => {
    const fresh = await apiLoadCandidate(candidate.email);
    if(fresh && !fresh.integrity.lockedStages[s.id]){
      candidate = fresh;
      toast('This section has been unlocked — you can continue.');
      render();
    }else{
      toast('Still locked. Ask your recruiter to unlock it from the roster view.');
    }
  };
}

function advanceTo(nextId){
  candidate.currentStageId = nextId;
  draft = {};
  render();
}

function stageActionsHtml(canSubmit, submitLabel){
  return `
    <div class="actions">
      <span></span>
      <div class="actions-right">
        <button class="btn gold" id="btn-submit-stage" ${canSubmit ? '' : 'disabled'}>${submitLabel}</button>
      </div>
    </div>`;
}
function renderForwardNav(currentId){
  const nid = nextStageId(currentId);
  if(!nid) return '';
  return `
    <div class="actions">
      <span></span>
      <div class="actions-right">
        <button class="btn secondary" id="btn-forward">Continue to next stage →</button>
      </div>
    </div>`;
}
function bindForwardNav(currentId){
  const btn = document.getElementById('btn-forward');
  if(btn) btn.onclick = () => { advanceTo(nextStageId(currentId)); };
}

/* ---------------- Quiz stages ---------------- */
function renderQuizStage(s){
  const done = candidate.completed[s.id];
  const quiz = CONTENT.quizzes[s.id];
  if(done){
    const score = candidate.scores[s.id];
    const pct = score.correct / score.total;
    const passed = pct >= PASS_THRESHOLD;
    return `
      <div class="card">
        <div class="stage-head">
          <div class="stage-eyebrow">Stage ${stageIndex(s.id)+1} of ${stagesFor(candidate).length}</div>
          <h2>${s.label}</h2>
        </div>
        <span class="pill ${passed?'pass':'pending'}" style="${passed?'':'background:var(--crimson-soft);color:var(--crimson-dark);'}">${passed ? 'Meets benchmark' : 'Below benchmark'}</span>
        <p class="stage-desc" style="margin-top:14px;">You scored <strong>${score.correct} / ${score.total}</strong> (benchmark: ${Math.round(PASS_THRESHOLD*100)}%). Responses are locked once submitted.</p>
        ${renderForwardNav(s.id)}
      </div>`;
  }

  if(!draft.started){
    return `
      <div class="card">
        <div class="stage-head">
          <div class="stage-eyebrow">Stage ${stageIndex(s.id)+1} of ${stagesFor(candidate).length} · Advanced</div>
          <h2>${s.label}</h2>
        </div>
        <p class="stage-desc">This is a secured, timed section: ${quiz.questions.length} questions, one at a time, ${SECONDS_PER_QUESTION} seconds each. Once you start a question you cannot go back to change an earlier answer, and you cannot preview later questions. Copying, pasting, right-click, and switching tabs are disabled and logged.</p>
        <div class="gate-notice">
          <span>🔒</span>
          <span>Find a quiet, uninterrupted space before you begin. Every question is watermarked with your name, candidate ID, and a timestamp — leaving this window or exceeding ${MAX_VIOLATIONS_BEFORE_LOCK} flags will lock the section until a recruiter reviews it.</span>
        </div>
        <div class="actions"><span></span><div class="actions-right">
          <button class="btn gold" id="btn-start-quiz">Begin timed section</button>
        </div></div>
      </div>`;
  }

  const qi = draft.qIndex || 0;
  const q = quiz.questions[qi];
  const total = quiz.questions.length;
  const selected = draft.answers[qi];
  const isLast = qi === total - 1;
  const timeLeft = draft.qTimeLeft;
  const timeLow = timeLeft <= 10;

  return `
    <div class="card">
      ${renderWatermark()}
      <div class="stage-head">
        <div class="stage-eyebrow">Stage ${stageIndex(s.id)+1} of ${stagesFor(candidate).length} · Advanced</div>
        <h2>${s.label}</h2>
      </div>
      ${renderSecureBanner(formatClock(timeLeft), timeLow)}
      <div class="qprogress-track"><div class="qprogress-fill" style="width:${Math.round(((qi)/total)*100)}%;"></div></div>
      <div class="q-block no-select">
        <div class="q-index">Question ${qi+1} of ${total} — no going back once you continue</div>
        <div class="q-text">${escapeHtml(q.q)}</div>
        ${q.options.map((opt,oi) => `
          <label class="opt ${selected===oi ? 'selected':''}" data-oi="${oi}">
            <input type="radio" name="qopt" ${selected===oi?'checked':''} style="pointer-events:none;">
            <span>${escapeHtml(opt)}</span>
          </label>`).join('')}
      </div>
      ${stageActionsHtml(selected !== null && selected !== undefined, isLast ? 'Submit section' : 'Next question →')}
    </div>`;
}

function bindQuizStage(s){
  if(candidate.completed[s.id]){ bindForwardNav(s.id); return; }
  const quiz = CONTENT.quizzes[s.id];

  const startBtn = document.getElementById('btn-start-quiz');
  if(startBtn){
    startBtn.onclick = () => {
      draft.started = true;
      draft.qIndex = 0;
      draft.answers = new Array(quiz.questions.length).fill(null);
      draft.qTimeLeft = SECONDS_PER_QUESTION;
      renderStageBody();
      startQuestionTimer(s);
    };
    return;
  }

  document.querySelectorAll('.opt[data-oi]').forEach(el => {
    el.onclick = () => {
      draft.answers[draft.qIndex] = +el.dataset.oi;
      renderStageBody();
    };
  });

  const submit = document.getElementById('btn-submit-stage');
  if(submit) submit.onclick = () => advanceQuizQuestion(s);

  startQuestionTimer(s, draft.qTimeLeft);
}

function startQuestionTimer(s, resumeFrom){
  if(activeCountdown) clearInterval(activeCountdown);
  if(typeof resumeFrom === 'number') draft.qTimeLeft = resumeFrom;
  const tick = () => {
    const el = document.getElementById('sb-timer');
    if(el){ el.textContent = formatClock(draft.qTimeLeft); el.classList.toggle('low', draft.qTimeLeft <= 10); }
  };
  tick();
  activeCountdown = setInterval(() => {
    draft.qTimeLeft -= 1;
    if(draft.qTimeLeft <= 0){
      clearInterval(activeCountdown);
      activeCountdown = null;
      advanceQuizQuestion(s, true);
      return;
    }
    tick();
  }, 1000);
}

async function advanceQuizQuestion(s, timedOut){
  if(activeCountdown){ clearInterval(activeCountdown); activeCountdown = null; }
  const quiz = CONTENT.quizzes[s.id];
  const isLast = draft.qIndex === quiz.questions.length - 1;
  if(!isLast){
    draft.qIndex += 1;
    draft.qTimeLeft = SECONDS_PER_QUESTION;
    renderStageBody();
    startQuestionTimer(s);
    if(timedOut) toast('Time expired for that question — moving on.');
    return;
  }
  try{
    const { state } = await apiSubmitQuiz(s.id, draft.answers);
    candidate = state;
    draft = {};
    toast('Section submitted and saved.');
    render();
  }catch(e){
    toast(e.message);
  }
}

/* ---------------- Personality (Likert) stage ---------------- */
function renderLikertStage(s){
  const done = candidate.completed[s.id];
  const statements = CONTENT.likertStatements;
  if(done){
    return `
      <div class="card">
        <div class="stage-head">
          <div class="stage-eyebrow">Stage ${stageIndex(s.id)+1} of ${stagesFor(candidate).length}</div>
          <h2>${s.label}</h2>
        </div>
        <span class="pill pass">Submitted</span>
        <p class="stage-desc" style="margin-top:14px;">Thank you — your personality inventory has been recorded. This isn't scored pass/fail; it helps the hiring team understand your working style.</p>
        ${renderForwardNav(s.id)}
      </div>`;
  }
  if(!draft.likert) draft.likert = new Array(statements.length).fill(null);
  const answeredAll = draft.likert.every(a => a !== null);
  return `
    <div class="card">
      <div class="stage-head">
        <div class="stage-eyebrow">Stage ${stageIndex(s.id)+1} of ${stagesFor(candidate).length}</div>
        <h2>${s.label}</h2>
      </div>
      <p class="stage-desc">Rate how much you agree with each statement. There are no right or wrong answers — respond honestly.</p>
      ${statements.map((stmt, i) => `
        <div class="likert-row">
          <div class="likert-text">${i+1}. ${escapeHtml(stmt.statement)}</div>
          <div class="likert-scale">
            ${LIKERT_LABELS.map((lab, li) => `
              <div class="likert-opt ${draft.likert[i]===li?'selected':''}" data-si="${i}" data-li="${li}">${lab}</div>
            `).join('')}
          </div>
        </div>
      `).join('')}
      ${stageActionsHtml(answeredAll, 'Submit inventory')}
    </div>`;
}

function bindLikertStage(s){
  if(candidate.completed[s.id]){ bindForwardNav(s.id); return; }
  document.querySelectorAll('.likert-opt[data-si]').forEach(el => {
    el.onclick = () => {
      draft.likert[+el.dataset.si] = +el.dataset.li;
      renderStageBody();
    };
  });
  const submit = document.getElementById('btn-submit-stage');
  if(submit) submit.onclick = async () => {
    const statements = CONTENT.likertStatements;
    const avg = draft.likert.reduce((a,b)=>a+b,0) / draft.likert.length;

    const byTrait = {};
    statements.forEach((stmt, i) => {
      if(!byTrait[stmt.trait]) byTrait[stmt.trait] = [];
      byTrait[stmt.trait].push(draft.likert[i]);
    });
    const traitScores = {};
    for(const [trait, vals] of Object.entries(byTrait)){
      traitScores[trait] = Math.round((vals.reduce((a,b)=>a+b,0) / vals.length) * 10) / 10;
    }

    candidate.personality = {
      responses: statements.map((stmt, i) => ({ trait: stmt.trait, statement: stmt.statement, answerIndex: draft.likert[i] })),
      traitAvg: Math.round(avg*10)/10,
      traitScores,
    };
    candidate.completed[s.id] = true;
    const nid = nextStageId(s.id);
    if(nid) candidate.currentStageId = nid;
    draft = {};
    await saveCandidate();
    toast('Inventory submitted and saved.');
    render();
  };
}

/* ---------------- Longform secured stages (essay + case study) ---------------- */
function countWords(text){
  const t = text.trim();
  return t.length ? t.split(/\s+/).length : 0;
}
const LONGFORM_FIELD = { essay: 'essay', casestudy: 'casestudy' };

function renderLongformStage(s){
  const cfg = CONTENT.longform[s.id];
  const done = candidate.completed[s.id];
  const field = LONGFORM_FIELD[s.id];
  if(done){
    const rec = candidate[field];
    return `
      <div class="card">
        <div class="stage-head">
          <div class="stage-eyebrow">Stage ${stageIndex(s.id)+1} of ${stagesFor(candidate).length}</div>
          <h2>${s.label}</h2>
        </div>
        <span class="pill pass">Submitted</span>
        <p class="stage-desc" style="margin-top:14px;">Your response (${rec.wordCount} words) was submitted and is locked for review.</p>
        ${renderForwardNav(s.id)}
      </div>`;
  }

  if(!draft.started){
    return `
      <div class="card">
        <div class="stage-head">
          <div class="stage-eyebrow">Stage ${stageIndex(s.id)+1} of ${stagesFor(candidate).length}</div>
          <h2>${s.label}</h2>
        </div>
        <p class="stage-desc"><strong>Prompt:</strong> ${escapeHtml(cfg.prompt).replace(/\n/g,'<br>')}</p>
        <div class="gate-notice">
          <span>🔒</span>
          <span>Secured section: minimum ${cfg.minWords} words, ${Math.round(cfg.timeLimitSeconds/60)} minutes on the clock once you start. Pasting is disabled — write in your own words. Your response screen is watermarked with your name and candidate ID. The timer auto-submits your response when it reaches zero, so pace yourself.</span>
        </div>
        <div class="actions"><span></span><div class="actions-right">
          <button class="btn gold" id="btn-start-longform">Start writing</button>
        </div></div>
      </div>`;
  }

  const wc = countWords(draft.lfText || '');
  const ok = wc >= cfg.minWords;
  const timeLeft = draft.lfTimeLeft;
  const timeLow = timeLeft <= 60;
  return `
    <div class="card">
      ${renderWatermark()}
      <div class="stage-head">
        <div class="stage-eyebrow">Stage ${stageIndex(s.id)+1} of ${stagesFor(candidate).length}</div>
        <h2>${s.label}</h2>
      </div>
      ${renderSecureBanner(formatClock(timeLeft), timeLow)}
      <p class="stage-desc"><strong>Prompt:</strong> ${escapeHtml(cfg.prompt).replace(/\n/g,'<br>')}</p>
      <textarea class="essay field" id="lf-text" placeholder="Start writing here...">${escapeHtml(draft.lfText || '')}</textarea>
      <div class="word-count ${ok?'ok':''}"><span>${wc} words</span><span>Minimum ${cfg.minWords} words</span></div>
      ${stageActionsHtml(ok, 'Submit response')}
    </div>`;
}

function bindLongformStage(s){
  if(candidate.completed[s.id]){ bindForwardNav(s.id); return; }
  const cfg = CONTENT.longform[s.id];

  const startBtn = document.getElementById('btn-start-longform');
  if(startBtn){
    startBtn.onclick = () => {
      draft.started = true;
      draft.lfText = '';
      draft.lfTimeLeft = cfg.timeLimitSeconds;
      renderStageBody();
      startLongformTimer(s);
    };
    return;
  }

  const ta = document.getElementById('lf-text');
  if(ta){
    ta.oninput = () => {
      draft.lfText = ta.value;
      const wc = countWords(draft.lfText);
      const ok = wc >= cfg.minWords;
      document.querySelector('.word-count span').textContent = wc + ' words';
      document.querySelector('.word-count').classList.toggle('ok', ok);
      const submitBtn = document.getElementById('btn-submit-stage');
      if(submitBtn) submitBtn.disabled = !ok;
    };
  }
  const submit = document.getElementById('btn-submit-stage');
  if(submit) submit.onclick = () => submitLongform(s);

  startLongformTimer(s, draft.lfTimeLeft);
}

function startLongformTimer(s, resumeFrom){
  if(activeCountdown) clearInterval(activeCountdown);
  if(typeof resumeFrom === 'number') draft.lfTimeLeft = resumeFrom;
  const tick = () => {
    const el = document.getElementById('sb-timer');
    if(el){ el.textContent = formatClock(draft.lfTimeLeft); el.classList.toggle('low', draft.lfTimeLeft <= 60); }
  };
  tick();
  activeCountdown = setInterval(() => {
    draft.lfTimeLeft -= 1;
    if(draft.lfTimeLeft <= 0){
      clearInterval(activeCountdown);
      activeCountdown = null;
      submitLongform(s, true);
      return;
    }
    tick();
  }, 1000);
}

async function submitLongform(s, timedOut){
  if(activeCountdown){ clearInterval(activeCountdown); activeCountdown = null; }
  const field = LONGFORM_FIELD[s.id];
  const text = draft.lfText || '';
  candidate[field] = { text, wordCount: countWords(text), submittedAt: new Date().toISOString(), timedOut: !!timedOut };
  candidate.completed[s.id] = true;
  const nid = nextStageId(s.id);
  if(nid) candidate.currentStageId = nid;
  draft = {};
  await saveCandidate();
  toast(timedOut ? 'Time expired — your response was submitted automatically.' : 'Response submitted and saved.');
  render();
}

/* ---------------- Calendar / interview scheduling stage ---------------- */
const DOW = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const SLOT_TIMES = ['9:00 AM','11:30 AM','2:00 PM'];
function buildCalendarDays(){
  const days = [];
  let d = new Date();
  d.setDate(d.getDate() + 1);
  while(days.length < 8){
    if(d.getDay() !== 0 && d.getDay() !== 6){
      const dateStr = d.toISOString().slice(0,10);
      days.push({
        dateStr,
        display: d.toLocaleDateString('en-US', { month:'short', day:'numeric' }),
        dow: DOW[d.getDay()],
        slots: SLOT_TIMES.map((t, ti) => {
          const seed = (d.getDate()*3 + ti*7) % 5;
          return { time: t, booked: seed === 0 };
        })
      });
    }
    d = new Date(d.getTime() + 86400000);
  }
  return days;
}
function renderCalendarStage(s){
  const done = candidate.completed[s.id];
  if(done){
    const iv = candidate.interview;
    return `
      <div class="card">
        <div class="stage-head">
          <div class="stage-eyebrow">Stage ${stageIndex(s.id)+1} of ${stagesFor(candidate).length}</div>
          <h2>${s.label}</h2>
        </div>
        <span class="pill pass">Confirmed</span>
        <p class="stage-desc" style="margin-top:14px;">Your interview day is booked for <strong>${iv.dow}, ${iv.display}</strong> at <strong>${iv.slot}</strong>. This block covers both your HR interview and, if you advance, the board interview.</p>
        ${renderForwardNav(s.id)}
      </div>`;
  }
  if(!draft.calDays) draft.calDays = buildCalendarDays();
  const picked = draft.calPick;
  return `
    <div class="card">
      <div class="stage-head">
        <div class="stage-eyebrow">Stage ${stageIndex(s.id)+1} of ${stagesFor(candidate).length}</div>
        <h2>${s.label}</h2>
      </div>
      <p class="stage-desc">Choose one available slot. This single booking covers your on-site interview day: an HR conversation followed by the board panel round.</p>
      <div class="cal-grid">
        ${draft.calDays.map(day => `
          <div class="cal-day">
            <div class="cal-date">${day.display}</div>
            <div class="cal-dow">${day.dow}</div>
            ${day.slots.map(sl => `
              <button class="slot ${picked && picked.dateStr===day.dateStr && picked.slot===sl.time ? 'picked':''}"
                data-date="${day.dateStr}" data-display="${day.display}" data-dow="${day.dow}" data-slot="${sl.time}"
                ${sl.booked ? 'disabled' : ''}>
                ${sl.time} ${sl.booked ? '· booked' : ''}
              </button>
            `).join('')}
          </div>
        `).join('')}
      </div>
      ${stageActionsHtml(!!picked, 'Confirm interview day')}
    </div>`;
}
function bindCalendarStage(s){
  if(candidate.completed[s.id]){ bindForwardNav(s.id); return; }
  document.querySelectorAll('.slot[data-date]').forEach(el => {
    el.onclick = () => {
      draft.calPick = { dateStr: el.dataset.date, display: el.dataset.display, dow: el.dataset.dow, slot: el.dataset.slot };
      renderStageBody();
    };
  });
  const submit = document.getElementById('btn-submit-stage');
  if(submit) submit.onclick = async () => {
    candidate.interview = { date: draft.calPick.dateStr, display: draft.calPick.display, dow: draft.calPick.dow, slot: draft.calPick.slot };
    candidate.completed[s.id] = true;
    const nid = nextStageId(s.id);
    if(nid) candidate.currentStageId = nid;
    draft = {};
    await saveCandidate();
    toast('Interview day confirmed.');
    render();
  };
}

/* ---------------- HR interview / orientation stage ---------------- */
function renderHrStage(s){
  const done = candidate.completed[s.id];
  const iv = candidate.interview;
  if(done){
    return `
      <div class="card">
        <div class="stage-head">
          <div class="stage-eyebrow">Stage ${stageIndex(s.id)+1} of ${stagesFor(candidate).length}</div>
          <h2>${s.label}</h2>
        </div>
        <span class="pill pass">Confirmed</span>
        <p class="stage-desc" style="margin-top:14px;">Orientation acknowledged. Your board interview follows in the same on-site block.</p>
        ${renderForwardNav(s.id)}
      </div>`;
  }
  return `
    <div class="card">
      <div class="stage-head">
        <div class="stage-eyebrow">Stage ${stageIndex(s.id)+1} of ${stagesFor(candidate).length}</div>
        <h2>${s.label}</h2>
      </div>
      <p class="stage-desc">On <strong>${iv.dow}, ${iv.display}</strong> at <strong>${iv.slot}</strong>, you'll meet with HR for an orientation conversation before your board round. Here's what it covers:</p>
      <ul class="info-list">
        <li><span class="ico">1</span> Overview of ${SCHOOL_NAME}'s mission, curriculum framework, and campus culture.</li>
        <li><span class="ico">2</span> A walkthrough of compensation, housing/relocation support (if applicable), and benefits.</li>
        <li><span class="ico">3</span> A conversation about your background, availability, and grade/subject preferences.</li>
        <li><span class="ico">4</span> Time for your questions about life at the school and in the city.</li>
      </ul>
      <div class="checkline">
        <input type="checkbox" id="hr-confirm">
        <label for="hr-confirm">I understand this is the HR orientation stage of my interview day and I'll come prepared with questions about the role.</label>
      </div>
      ${stageActionsHtml(false, 'Confirm & continue to board interview')}
    </div>`;
}
function bindHrStage(s){
  if(candidate.completed[s.id]){ bindForwardNav(s.id); return; }
  const cb = document.getElementById('hr-confirm');
  const submit = document.getElementById('btn-submit-stage');
  cb.onchange = () => { submit.disabled = !cb.checked; };
  submit.onclick = async () => {
    candidate.hrConfirmed = true;
    candidate.completed[s.id] = true;
    const nid = nextStageId(s.id);
    if(nid) candidate.currentStageId = nid;
    draft = {};
    await saveCandidate();
    toast('HR stage confirmed.');
    render();
  };
}

/* ---------------- Board interview stage ---------------- */
function renderBoardStage(s){
  const done = candidate.completed[s.id];
  const iv = candidate.interview;
  if(done){
    return `
      <div class="card">
        <div class="stage-head">
          <div class="stage-eyebrow">Stage ${stageIndex(s.id)+1} of ${stagesFor(candidate).length}</div>
          <h2>${s.label}</h2>
        </div>
        <span class="pill pass">Confirmed</span>
        <p class="stage-desc" style="margin-top:14px;">Board interview confirmed. Your full application is now complete.</p>
        ${renderForwardNav(s.id)}
      </div>`;
  }
  return `
    <div class="card">
      <div class="stage-head">
        <div class="stage-eyebrow">Stage ${stageIndex(s.id)+1} of ${stagesFor(candidate).length}</div>
        <h2>${s.label}</h2>
      </div>
      <p class="stage-desc">The final round, on <strong>${iv.dow}, ${iv.display}</strong> right after your HR conversation, is a panel interview with school board members. This is where they evaluate long-term fit and vision alignment.</p>
      <ul class="info-list">
        <li><span class="ico">1</span> Expect 3–4 board members, roughly 45 minutes.</li>
        <li><span class="ico">2</span> Bring one example of how you've handled a challenging classroom situation.</li>
        <li><span class="ico">3</span> Questions typically cover educational philosophy, community values, and long-term commitment.</li>
      </ul>
      <div class="checkline">
        <input type="checkbox" id="board-confirm">
        <label for="board-confirm">I confirm my availability for the board interview at the scheduled time above.</label>
      </div>
      ${stageActionsHtml(false, 'Confirm & finish application')}
    </div>`;
}
function bindBoardStage(s){
  if(candidate.completed[s.id]){ bindForwardNav(s.id); return; }
  const cb = document.getElementById('board-confirm');
  const submit = document.getElementById('btn-submit-stage');
  cb.onchange = () => { submit.disabled = !cb.checked; };
  submit.onclick = async () => {
    candidate.board = { confirmed: true };
    candidate.completed[s.id] = true;
    candidate.completedAt = new Date().toISOString();
    const nid = nextStageId(s.id);
    if(nid) candidate.currentStageId = nid;
    draft = {};
    await saveCandidate();
    toast('Board interview confirmed — application complete!');
    render();
  };
}

/* ---------------- Summary stage ---------------- */
function renderSummaryStage(s){
  const c = candidate;
  const traitAvg = c.personality ? c.personality.traitAvg : null;
  const flagsTotal = Object.values(c.integrity.violationsByStage).reduce((a,b)=>a+b,0);
  const scoreCell = (id,label) => {
    const sc = c.scores[id];
    const pct = sc.correct / sc.total;
    const passed = pct >= PASS_THRESHOLD;
    return `<div class="summary-item"><div class="label">${label}</div><div class="value">${sc.correct} / ${sc.total}</div><div style="margin-top:6px;"><span class="pill ${passed?'pass':'pending'}" style="${passed?'':'background:var(--crimson-soft);color:var(--crimson-dark);'}">${passed?'Meets benchmark':'Below benchmark'}</span></div></div>`;
  };
  return `
    <div class="card">
      <div class="stage-head">
        <div class="stage-eyebrow">Final Stage</div>
        <h2>Application Summary</h2>
      </div>
      <p class="stage-desc">Here's everything on file for ${escapeHtml(c.name)} (${c.candidateId}). The hiring committee will review this alongside your interview outcomes.</p>
      <div class="summary-grid">
        ${scoreCell('english','English Proficiency')}
        ${scoreCell('ict','ICT Assessment')}
        ${scoreCell('cognitive','Cognitive Ability')}
        ${scoreCell('instructional','Instructional Strategies')}
        <div class="summary-item"><div class="label">Personality Profile</div><div class="value">${traitAvg !== null ? traitAvg + ' / 4' : '—'}</div></div>
        <div class="summary-item"><div class="label">Essay</div><div class="value">${c.essay.wordCount} words</div></div>
        <div class="summary-item"><div class="label">Case Study</div><div class="value">${c.casestudy.wordCount} words</div></div>
        ${c.demoVideo ? `<div class="summary-item"><div class="label">Teaching Demo Video</div><div class="value" style="font-size:14px;word-break:break-all;">Submitted</div></div>` : ''}
        <div class="summary-item"><div class="label">Interview Day</div><div class="value" style="font-size:15px;">${c.interview.dow}, ${c.interview.display} · ${c.interview.slot}</div></div>
        <div class="summary-item"><div class="label">Security flags logged</div><div class="value">${flagsTotal}</div></div>
      </div>
      <div class="final-seal">
        ${renderCrest(72, 'final')}
        <div style="font-family:'Fraunces',serif;font-weight:600;font-size:18px;margin-bottom:6px;">Application complete</div>
        <p style="color:var(--ink-soft);font-size:13.5px;max-width:440px;margin:0 auto;">Thank you for completing every stage. ${SCHOOL_NAME}'s hiring committee will follow up by email after your board interview.</p>
      </div>
    </div>`;
}
function bindSummaryStage(s){ /* nothing interactive */ }

/* =========================================================
   ADMIN / HR
   ========================================================= */
function renderAdminLogin(){
  return `
    ${renderTopbar()}
    <div class="login-wrap">
      <div class="gate-card" style="max-width:400px;">
        <div class="gate-crest">${renderCrest(72, 'login')}</div>
        <div class="gate-eyebrow">Recruiter access</div>
        <h1 style="font-size:22px;">HR sign-in</h1>
        <p class="lead" style="margin-bottom:20px;">Sign in to view live candidate progress, scores, and responses.</p>
        <div class="field">
          <label for="admin-username">Username</label>
          <input id="admin-username" type="text" autocomplete="username">
        </div>
        <div class="field">
          <label for="admin-password">Password</label>
          <input id="admin-password" type="password" autocomplete="current-password">
        </div>
        <div id="admin-login-err" class="err" style="display:none;"></div>
        <button class="btn gold" id="btn-admin-login" style="width:100%;">Sign in</button>
      </div>
    </div>`;
}
function bindAdminLogin(){
  bindTopbar();
  const btn = document.getElementById('btn-admin-login');
  const submit = async () => {
    const username = document.getElementById('admin-username').value.trim();
    const password = document.getElementById('admin-password').value;
    const err = document.getElementById('admin-login-err');
    try{
      const data = await apiAdminLogin(username, password);
      admin = { authenticated:true, username: data.username };
      view = 'admin';
      render();
    }catch(e){
      err.textContent = e.message;
      err.style.display = 'block';
    }
  };
  btn.onclick = submit;
  document.getElementById('admin-password').addEventListener('keydown', (e) => { if(e.key === 'Enter') submit(); });
}

function renderAdminShell(){
  return `
    ${renderTopbar()}
    <div class="admin-wrap">
      <div class="stage-head" style="margin-bottom:10px;">
        <div class="stage-eyebrow">Recruiter view</div>
        <h2 style="font-family:'Fraunces',serif;font-size:24px;font-weight:600;margin:6px 0 4px;">Candidate Roster</h2>
        <p class="stage-desc" style="margin-bottom:0;">Live scores, progress, and security flags for every candidate. Click a row to review full responses.</p>
      </div>
      <div class="admin-toolbar">
        <span class="live-dot"><span class="dot"></span> Live — refreshes every 5s</span>
        <div style="display:flex;gap:10px;align-items:center;">
          <a class="btn secondary" href="/api/admin/roster/export" target="_blank" rel="noopener">Download roster CSV</a>
        </div>
      </div>
      <div class="card" style="padding:20px 22px;margin-bottom:22px;">
        <div style="font-weight:600;font-size:13.5px;margin-bottom:10px;">Add a candidate</div>
        <div class="invite-form">
          <input id="invite-name" type="text" placeholder="Full name">
          <input id="invite-email" type="email" placeholder="Email address">
          <button class="btn gold" id="btn-invite">Create application link</button>
        </div>
        <div id="invite-result" style="margin-top:12px;"></div>
      </div>
      <div id="admin-body"></div>
    </div>
    <div id="detail-host"></div>`;
}

function bindAdminShell(){
  const btn = document.getElementById('btn-invite');
  btn.onclick = async () => {
    const name = document.getElementById('invite-name').value.trim();
    const email = document.getElementById('invite-email').value.trim().toLowerCase();
    const resultEl = document.getElementById('invite-result');
    try{
      const { link, alreadyExists } = await apiAdminInvite(name, email);
      resultEl.innerHTML = `
        <div class="checkline" style="align-items:center;">
          <span style="flex:1;">${alreadyExists ? 'That candidate already has an application. Their link:' : 'Application created. Send this link to the candidate:'}</span>
        </div>
        <div style="display:flex;gap:8px;margin-top:8px;">
          <input readonly id="invite-link" value="${escapeHtml(link)}" style="flex:1;padding:9px 12px;border:1px solid var(--line);border-radius:3px;font-family:'IBM Plex Mono',monospace;font-size:12.5px;">
          <button class="btn secondary" id="btn-copy-link">Copy</button>
        </div>`;
      document.getElementById('btn-copy-link').onclick = () => {
        navigator.clipboard.writeText(link).then(() => toast('Link copied.'));
      };
      document.getElementById('invite-name').value = '';
      document.getElementById('invite-email').value = '';
      refreshRoster();
    }catch(e){
      resultEl.innerHTML = `<div class="err">${escapeHtml(e.message)}</div>`;
    }
  };
}

function startRosterPolling(){
  stopRosterPolling();
  rosterPollTimer = setInterval(() => { if(view === 'admin' && !adminState.detailId) refreshRoster(); }, 5000);
}
function stopRosterPolling(){
  if(rosterPollTimer){ clearInterval(rosterPollTimer); rosterPollTimer = null; }
}

async function refreshRoster(){
  const roster = await apiAdminRoster();
  if(roster === null){
    admin = { authenticated:false, username:null };
    view = 'admin-login';
    render();
    return;
  }
  adminState.roster = roster;
  renderRosterTable();
}

function renderRosterTable(){
  const host = document.getElementById('admin-body');
  if(!host) return;
  const roster = adminState.roster;
  if(!roster.length){
    host.innerHTML = `<div class="empty-state">No candidates have started an application yet.</div>`;
    return;
  }
  host.innerHTML = `
    <table class="roster">
      <thead><tr><th>Candidate</th><th>ID</th><th>Current stage</th><th>Progress</th><th>Scores</th><th>Decision</th><th>Security</th><th>Last activity</th></tr></thead>
      <tbody>
        ${roster.map(r => {
          const stage = STAGES.find(s => s.id === r.currentStage);
          const updated = new Date(r.updatedAt);
          const locked = r.lockedStages || [];
          const flags = r.flagsTotal || 0;
          const scoresSummary = QUIZ_STAGE_IDS.filter(id => r.scores[id]).map(id => {
            const sc = r.scores[id];
            const passed = sc.correct/sc.total >= PASS_THRESHOLD;
            return `<span class="pill ${passed?'pass':'pending'}" style="${passed?'':'background:var(--crimson-soft);color:var(--crimson-dark);'}margin:1px 2px;">${id.slice(0,3).toUpperCase()} ${sc.correct}/${sc.total}</span>`;
          }).join('') || '<span style="color:var(--ink-soft);font-size:12px;">—</span>';
          const security = locked.length
            ? locked.map(sid => {
                const st = STAGES.find(x=>x.id===sid);
                return `<button class="btn secondary" style="padding:5px 10px;font-size:11.5px;margin:2px 4px 2px 0;" data-unlock-id="${r.id}" data-unlock-stage="${sid}">Unlock ${st?st.label:sid}</button>`;
              }).join('')
            : (flags > 0
                ? `<span class="pill pending" style="border-color:var(--gold);color:var(--gold-dark);">${flags} flag${flags===1?'':'s'}</span>`
                : `<span class="pill pass">Clean</span>`);
          const decision = r.shortlistDecision === 'advance'
            ? `<span class="pill pass">Advancing</span>`
            : r.shortlistDecision === 'reject'
              ? `<span class="pill pending" style="border-color:var(--crimson);color:var(--crimson-dark);">Rejected</span>`
              : r.awaitingShortlist
                ? `<span class="pill pending" style="border-color:var(--gold);color:var(--gold-dark);">Pending review</span>`
                : `<span style="color:var(--ink-soft);font-size:12px;">—</span>`;
          return `<tr data-row-id="${r.id}">
            <td>${escapeHtml(r.name)}<br><span style="color:var(--ink-soft);font-size:12px;">${escapeHtml(r.email)}</span></td>
            <td class="mono">${r.candidateId}</td>
            <td>${stage ? stage.label : r.currentStage}</td>
            <td class="mono">${r.completedCount} / ${r.totalStages}</td>
            <td>${scoresSummary}</td>
            <td>${decision}</td>
            <td>${security}</td>
            <td style="color:var(--ink-soft);font-size:12.5px;">${updated.toLocaleDateString()} ${updated.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}</td>
          </tr>`;
        }).join('')}
      </tbody>
    </table>`;
  host.querySelectorAll('tr[data-row-id]').forEach(tr => {
    tr.addEventListener('click', (e) => {
      if(e.target.closest('button')) return;
      openCandidateDetail(tr.dataset.rowId);
    });
  });
  host.querySelectorAll('[data-unlock-id]').forEach(btn => {
    btn.onclick = async (e) => {
      e.stopPropagation();
      btn.disabled = true; btn.textContent = 'Unlocking…';
      await apiAdminUnlock(btn.dataset.unlockId, btn.dataset.unlockStage);
      toast('Section unlocked. The candidate can continue next time they check.');
      refreshRoster();
    };
  });
}

async function openCandidateDetail(id){
  adminState.detailId = id;
  stopRosterPolling();
  const report = await apiAdminCandidateDetail(id);
  adminState.detail = report;
  renderCandidateDetail();
}
function closeCandidateDetail(){
  adminState.detailId = null;
  adminState.detail = null;
  document.getElementById('detail-host').innerHTML = '';
  startRosterPolling();
}

function renderCandidateDetail(){
  const host = document.getElementById('detail-host');
  const r = adminState.detail;
  if(!r){ host.innerHTML = ''; return; }

  const quizSection = (stageId) => {
    const q = r.quizzes[stageId];
    if(!q.completed) return `<p class="stage-desc">Not yet completed.</p>`;
    const passed = q.passed;
    return `
      <div style="margin-bottom:6px;">
        <span class="pill ${passed?'pass':'pending'}" style="${passed?'':'background:var(--crimson-soft);color:var(--crimson-dark);'}">${q.score.correct} / ${q.score.total} — ${passed?'Meets benchmark':'Below benchmark'}</span>
      </div>
      ${q.questions.map((row,i) => `
        <div class="qa-row ${row.isCorrect?'correct':'incorrect'}">
          <div class="qa-q">Q${i+1}. ${escapeHtml(row.question)}</div>
          <div class="qa-a">Candidate answered: <strong>${row.selectedText != null ? escapeHtml(row.selectedText) : '—'}</strong>${row.isCorrect ? '' : ` · Correct: ${escapeHtml(row.correctText)}`}</div>
        </div>
      `).join('')}`;
  };

  host.innerHTML = `
    <div class="detail-backdrop" id="detail-backdrop">
      <div class="detail-panel">
        <button class="linklike detail-close" id="detail-close">Close ✕</button>
        <div class="stage-eyebrow">Candidate detail</div>
        <h2 style="font-family:'Fraunces',serif;font-size:24px;margin:6px 0 2px;">${escapeHtml(r.name)}</h2>
        <div style="color:var(--ink-soft);font-size:13.5px;">${escapeHtml(r.email)} · <span class="mono">${r.candidateId}</span></div>
        <div style="margin-top:8px;">
          ${r.consent
            ? `<span class="pill pass">Consent given · ${new Date(r.consent.agreedAt).toLocaleDateString()}</span>`
            : r.currentStageId === 'consent'
              ? `<span class="pill pending">Consent pending — still on this step</span>`
              : `<span class="pill pending">No consent record (started before this was added)</span>`}
        </div>
        <div style="margin-top:14px;display:flex;gap:10px;">
          <a class="btn secondary" href="/api/admin/candidates/${r.id}/export?format=json" target="_blank" rel="noopener">Download JSON</a>
          <a class="btn secondary" href="/api/admin/candidates/${r.id}/export?format=csv" target="_blank" rel="noopener">Download CSV</a>
        </div>

        ${QUIZ_STAGE_IDS.map(id => `
          <div class="detail-section">
            <h3>${r.quizzes[id].label}</h3>
            ${quizSection(id)}
          </div>
        `).join('')}

        <div class="detail-section">
          <h3>Personality Profile</h3>
          ${r.personality ? `
            <p class="stage-desc" style="margin-bottom:10px;">Overall average: <strong>${r.personality.traitAvg} / 4</strong></p>
            ${r.personality.traitScores ? `
              <div class="summary-grid" style="margin-bottom:16px;">
                ${r.personality.traitScores.map(t => `<div class="summary-item"><div class="label">${escapeHtml(t.trait)}</div><div class="value">${t.score} / 4</div></div>`).join('')}
              </div>
            ` : `<p class="stage-desc" style="font-style:italic;">No per-trait breakdown — this inventory was submitted before target-trait scoring was added.</p>`}
            ${r.personality.responses.map(resp => `<div class="qa-row"><div class="qa-q">${escapeHtml(resp.statement)}${resp.trait ? ` <span style="color:var(--ink-soft);font-weight:400;">(${escapeHtml(resp.trait)})</span>` : ''}</div><div class="qa-a">${LIKERT_LABELS[resp.answerIndex] ?? '—'}</div></div>`).join('')}
          ` : `<p class="stage-desc">Not yet completed.</p>`}
        </div>

        <div class="detail-section">
          <h3>Essay — Teaching Philosophy</h3>
          ${r.essay ? `<div class="longform-box">${escapeHtml(r.essay.text)}</div><p class="stage-desc" style="margin-top:8px;margin-bottom:0;">${r.essay.wordCount} words${r.essay.timedOut ? ' · auto-submitted at time limit' : ''}</p>` : `<p class="stage-desc">Not yet completed.</p>`}
        </div>

        <div class="detail-section">
          <h3>Case Study — International Students</h3>
          ${r.casestudy ? `<div class="longform-box">${escapeHtml(r.casestudy.text)}</div><p class="stage-desc" style="margin-top:8px;margin-bottom:0;">${r.casestudy.wordCount} words${r.casestudy.timedOut ? ' · auto-submitted at time limit' : ''}</p>` : `<p class="stage-desc">Not yet completed.</p>`}
        </div>

        <div class="detail-section">
          <h3>Teaching Demo Video</h3>
          ${r.demoVideo
            ? `<p class="stage-desc" style="margin-bottom:6px;"><a href="${escapeHtml(r.demoVideo.url)}" target="_blank" rel="noopener">${escapeHtml(r.demoVideo.url)}</a></p>${r.demoVideo.notes ? `<p class="stage-desc" style="margin-bottom:0;">${escapeHtml(r.demoVideo.notes)}</p>` : ''}`
            : `<p class="stage-desc">Not yet submitted.</p>`}
        </div>

        ${r.demoVideo ? `
        <div class="detail-section">
          <h3>Shortlist Decision</h3>
          <p class="stage-desc" style="margin-bottom:12px;">
            ${r.shortlist
              ? `Current decision: <strong>${r.shortlist.decision === 'advance' ? 'Advance to interview' : 'Rejected'}</strong> (${new Date(r.shortlist.decidedAt).toLocaleString()}). You can change this below if needed.`
              : `Awaiting your decision — the candidate sees a "your application is under review" screen until you choose one of the options below.`}
          </p>
          <div style="display:flex;gap:10px;">
            <button class="btn gold" id="btn-shortlist-advance" ${r.shortlist && r.shortlist.decision === 'advance' ? 'disabled' : ''}>Advance to interview</button>
            <button class="btn secondary" id="btn-shortlist-reject" style="border-color:var(--crimson);color:var(--crimson-dark);" ${r.shortlist && r.shortlist.decision === 'reject' ? 'disabled' : ''}>Reject application</button>
          </div>
          ${r.shortlist && r.shortlist.decision === 'reject' ? `
            <div style="margin-top:14px;padding-top:14px;border-top:1px dashed var(--line-soft);">
              ${r.rejectionEmail
                ? `<p class="stage-desc" style="margin-bottom:0;">✓ Rejection email sent ${new Date(r.rejectionEmail.sentAt).toLocaleString()}.</p>`
                : `
                  <button class="btn secondary" id="btn-send-rejection-email" style="border-color:var(--crimson);color:var(--crimson-dark);">Send rejection email to candidate</button>
                  <p class="stage-desc" style="margin-top:8px;margin-bottom:0;font-size:12.5px;">Sends a brief, generic email — no specific reason is included. This can only be sent once.</p>
                `}
            </div>
          ` : ''}
        </div>
        ` : ''}

        <div class="detail-section">
          <h3>Interview & Confirmations</h3>
          <p class="stage-desc" style="margin-bottom:6px;">${r.interview ? `${r.interview.dow}, ${r.interview.display} at ${r.interview.slot}` : 'Not yet scheduled.'}</p>
          <p class="stage-desc" style="margin-bottom:0;">HR confirmed: <strong>${r.hrConfirmed ? 'Yes' : 'No'}</strong> · Board confirmed: <strong>${r.board && r.board.confirmed ? 'Yes' : 'No'}</strong></p>
        </div>

        <div class="detail-section">
          <h3>Security Log</h3>
          ${Object.keys(r.integrity.lockedStages||{}).length ? `<p class="stage-desc">Currently locked: ${Object.keys(r.integrity.lockedStages).join(', ')}</p>` : ''}
          ${r.integrity.log.length ? `<ul class="integrity-log">${r.integrity.log.slice().reverse().map(l => `<li>${new Date(l.at).toLocaleString()} — ${escapeHtml(l.stageId)} — ${escapeHtml(l.type)}</li>`).join('')}</ul>` : `<p class="stage-desc">No flags logged.</p>`}
        </div>
      </div>
    </div>`;

  document.getElementById('detail-close').onclick = closeCandidateDetail;
  document.getElementById('detail-backdrop').addEventListener('click', (e) => {
    if(e.target.id === 'detail-backdrop') closeCandidateDetail();
  });

  const advanceBtn = document.getElementById('btn-shortlist-advance');
  const rejectBtn = document.getElementById('btn-shortlist-reject');
  if(advanceBtn) advanceBtn.onclick = async () => {
    await apiAdminShortlistDecision(r.id, 'advance');
    toast('Candidate advanced to interview scheduling.');
    await openCandidateDetail(r.id);
    refreshRoster();
  };
  if(rejectBtn) rejectBtn.onclick = async () => {
    await apiAdminShortlistDecision(r.id, 'reject');
    toast('Decision recorded.');
    await openCandidateDetail(r.id);
    refreshRoster();
  };
  const sendEmailBtn = document.getElementById('btn-send-rejection-email');
  if(sendEmailBtn) sendEmailBtn.onclick = async () => {
    if(!confirm(`Send the rejection email to ${r.email} now? This can only be sent once.`)) return;
    sendEmailBtn.disabled = true;
    sendEmailBtn.textContent = 'Sending…';
    try{
      const result = await apiAdminSendRejectionEmail(r.id);
      toast(result.alreadySent ? 'Already sent earlier.' : 'Rejection email sent.');
      await openCandidateDetail(r.id);
    }catch(e){
      toast(e.message);
      sendEmailBtn.disabled = false;
      sendEmailBtn.textContent = 'Send rejection email to candidate';
    }
  };
}

/* ---------------- Boot ---------------- */
async function boot(){
  await loadContent();
  const session = await apiAdminSession();
  admin = { authenticated: !!session.authenticated, username: session.username || null };

  const params = new URLSearchParams(window.location.search);
  const emailParam = params.get('email');
  if(emailParam){
    const state = await apiLoadCandidate(emailParam);
    if(state){
      candidate = state;
      view = 'portal';
    }else{
      draft.gateEmail = emailParam;
    }
  }
  render();
}
boot();
