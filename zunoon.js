/* ============================================================
   ZUNOON — ADA Platform JavaScript
   Page-aware: activates only what each page needs
   ============================================================ */

(function () {
  'use strict';

  // ── ADA Notifications & Video Upload Config ─────────────────
  // Notifications and video uploads both go through the same Google
  // Apps Script Web App (see GOOGLE_APPS_SCRIPT_setup.gs / SETUP_INSTRUCTIONS.md).
  const ADA_CONFIG = {
    DRIVE_UPLOAD_URL: 'https://script.google.com/macros/s/AKfycbyqhGaTvF9T_fHRmzabR4BttBeCuq-EYst55zvec7xyDBf84K5IvNEkF2zYsJZ8_9lv/exec',
  };

  // Sends a notification email to ADA via the Apps Script Web App.
  // Fails silently for the candidate (never blocks their flow), but
  // logs success/failure to the console so it can be debugged.
  function notifyADA(params) {
    fetch(ADA_CONFIG.DRIVE_UPLOAD_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' }, // avoids CORS preflight on Apps Script
      body: JSON.stringify(Object.assign({ action: 'notify' }, params)),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data && data.ok) console.log('[ADA notify] sent OK:', params.event_type);
        else console.error('[ADA notify] FAILED to send:', params.event_type, data);
      })
      .catch((err) => console.error('[ADA notify] request failed:', params.event_type, err));
  }

  function formatDuration(ms) {
    const mins = Math.round(ms / 60000);
    if (mins < 60) return mins + ' min';
    const h = Math.floor(mins / 60), m = mins % 60;
    return h + 'h ' + m + 'm';
  }

  // ── Utility ────────────────────────────────────────────────
  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];

  // ── Sticky nav shadow ──────────────────────────────────────
  const header = $('#main-header');
  if (header) {
    window.addEventListener('scroll', () => {
      header.classList.toggle('scrolled', window.scrollY > 10);
    }, { passive: true });
  }

  // ── Mobile hamburger ───────────────────────────────────────
  function initHamburger() {
    const nav = $('.navbar');
    if (!nav) return;

    const menu = $('.nav-menu', nav);
    if (!menu) return;

    const btn = document.createElement('button');
    btn.className = 'nav-hamburger';
    btn.setAttribute('aria-label', 'Toggle navigation');
    btn.innerHTML = '<span></span><span></span><span></span>';
    $('.nav-container', nav).appendChild(btn);

    btn.addEventListener('click', () => {
      const open = menu.classList.toggle('open');
      btn.classList.toggle('open', open);
      btn.setAttribute('aria-expanded', open);
    });

    // Close on outside click
    document.addEventListener('click', (e) => {
      if (!nav.contains(e.target)) {
        menu.classList.remove('open');
        btn.classList.remove('open');
      }
    });
  }
  initHamburger();

  // ── Candidate Journey Tracker ───────────────────────────────
  // NOTE: This is a client-side (localStorage) convenience tracker only.
  // It helps candidates see where they are in the process and softly
  // encourages completing steps in order — it is NOT secure access
  // control (there is no backend), matching the same approach used for
  // the Live Training access gate.
  const JOURNEY_KEY = 'ada_journey_progress';

  const JOURNEY_STEPS = [
    { key: 'register',    label: 'Registration',   pages: ['register.html'] },
    { key: 'screening',   label: 'Screening',      pages: ['screening.html'] },
    { key: 'english',     label: 'English Test',   pages: ['english-test.html'] },
    { key: 'llm',         label: 'LLM Assessment', pages: ['llm.html', 'bilingual-llm.html'] },
    { key: 'training',    label: 'Live Training',  pages: ['training.html'] },
    { key: 'certificate', label: 'Certificate',    pages: ['certificate.html'] },
  ];

  function getJourney() {
    try { return JSON.parse(localStorage.getItem(JOURNEY_KEY) || '{}'); }
    catch (e) { return {}; }
  }

  function markStepComplete(key, extra) {
    try {
      const data = getJourney();
      const isFirstTime = !(data[key] && data[key].done);
      data[key] = Object.assign({}, (typeof data[key] === 'object' ? data[key] : {}), { done: true, at: Date.now() }, extra || {});
      localStorage.setItem(JOURNEY_KEY, JSON.stringify(data));

      // Email notifications: candidate started (registration) / finished (certificate)
      if (isFirstTime && key === 'register') {
        notifyADA({
          event_type: 'Candidate started',
          candidate_name: 'Not yet provided (registers via Google Form)',
          timestamp: new Date().toLocaleString(),
          duration: '—',
        });
      }
      if (isFirstTime && key === 'training') {
        const startedAt = data.register && data.register.at;
        const duration = startedAt ? formatDuration(Date.now() - startedAt) : 'Unknown (started on a different device/browser)';
        notifyADA({
          event_type: 'Candidate finished Live Training',
          candidate_name: 'Not yet provided (name is captured later at Certificate step)',
          timestamp: new Date().toLocaleString(),
          duration: duration,
        });
      }
      if (isFirstTime && key === 'certificate') {
        const startedAt = data.register && data.register.at;
        const duration = startedAt ? formatDuration(Date.now() - startedAt) : 'Unknown (started on a different device/browser)';
        notifyADA({
          event_type: 'Candidate finished',
          candidate_name: (extra && extra.candidateName) || 'Unknown',
          timestamp: new Date().toLocaleString(),
          duration: duration,
        });
      }
    } catch (e) {}
    renderJourneyTracker();
  }

  function isStepDone(key) {
    const data = getJourney();
    return !!(data[key] && data[key].done);
  }

  function currentPageFile() {
    return (location.pathname.split('/').pop() || 'index.html').toLowerCase();
  }

  function renderJourneyTracker() {
    const mount = $('#journey-tracker');
    if (!mount) return;
    const page = currentPageFile();

    const html = JOURNEY_STEPS.map((step, i) => {
      const done = isStepDone(step.key);
      const isCurrent = step.pages.includes(page);
      const cls = ['journey-step'];
      if (done) cls.push('done');
      if (isCurrent) cls.push('current');
      const icon = done ? '<i class="fa-solid fa-check"></i>' : (i + 1);
      const connector = i < JOURNEY_STEPS.length - 1 ? '<div class="journey-connector"></div>' : '';
      return `
        <div class="${cls.join(' ')}">
          <span class="step-dot">${icon}</span>
          <span class="step-label">${step.label}</span>
        </div>
        ${connector}
      `;
    }).join('');

    const anyProgress = JOURNEY_STEPS.some(step => isStepDone(step.key));
    const resetHTML = anyProgress ? `
      <div id="journey-reset-row">
        <button type="button" id="journey-reset-btn">New candidate on this device? Start fresh →</button>
      </div>` : '';

    mount.innerHTML = `<div class="journey-track">${html}</div>${resetHTML}`;

    const resetBtn = $('#journey-reset-btn');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        if (confirm("This clears this browser's saved progress (steps completed, saved test drafts) so a new candidate can start clean. It does not delete anything already submitted to ADA. Continue?")) {
          clearDeviceProgress();
          location.reload();
        }
      });
    }
  }

  // Wipes all Zunoon localStorage state for this browser — used when a new
  // candidate is using a shared/public computer and needs a clean slate.
  function clearDeviceProgress() {
    try {
      const keys = [];
      for (let i = 0; i < localStorage.length; i++) keys.push(localStorage.key(i));
      keys.filter(k => k && k.startsWith('ada_')).forEach(k => localStorage.removeItem(k));
    } catch (e) {}
  }
  renderJourneyTracker();

  // ── Contact form (index.html) ──────────────────────────────
  const contactForm = $('#contact-form');
  if (contactForm) {
    contactForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const name    = $('#contact-name').value.trim();
      const email   = $('#contact-email').value.trim();
      const message = $('#contact-message').value.trim();

      if (!name || !email || !message) return;

      const subject = encodeURIComponent(`ADA Inquiry from ${name}`);
      const body    = encodeURIComponent(`Name: ${name}\nEmail: ${email}\n\n${message}`);
      window.location.href = `mailto:info@accuratedataannotator.com?subject=${subject}&body=${body}`;
    });
  }

  // ── Registration (open to everyone — no invite code required) ──
  // Registration, Screening, English Test, and the LLM Assessment are free
  // and open by default.
  //
  // The founder code (hash stored below) is Batoul's own private code — it is the ONLY
  // free bypass at the Live Training paywall now. The old public codes
  // (ADA-2026, ADA-COHORT1, ZUNOON-VIP) are retired as of 2026-08-11: they
  // were already sent to 21 candidates, so leaving them active would let
  // anyone who has one skip payment forever. Per Batoul's decision, this
  // applies with no exceptions — including the 14 candidates already
  // mid-journey on an old code; they now pay $3 like any new candidate.
  // Keep this array to a single, unpublished code — do not add more.
  // The founder code is NOT stored in plain text. Only its SHA-256 hash is kept
  // here, so reading this file does not reveal the code. Rotated 2026-10-02:
  // the previous founder code is retired and no longer works anywhere.
  const FOUNDER_CODE_HASH = '159ea881b3661edbaaaad147b8cc07043a30fc1a4bb59f75574f301b82c4773f';

  // Compact synchronous SHA-256 (works on http, https and file:// pages).
  function sha256Hex(str) {
    const K = [
      0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,
      0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,
      0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,
      0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,
      0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,
      0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,
      0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,
      0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2
    ];
    const bytes = Array.from(new TextEncoder().encode(str));
    const bitLen = bytes.length * 8;
    bytes.push(0x80);
    while (bytes.length % 64 !== 56) bytes.push(0);
    for (let i = 7; i >= 0; i--) bytes.push(i >= 4 ? 0 : (bitLen >>> (i * 8)) & 0xff);
    const H = [0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19];
    const rotr = (x, n) => (x >>> n) | (x << (32 - n));
    for (let o = 0; o < bytes.length; o += 64) {
      const w = new Array(64);
      for (let i = 0; i < 16; i++) {
        w[i] = (bytes[o+i*4] << 24) | (bytes[o+i*4+1] << 16) | (bytes[o+i*4+2] << 8) | bytes[o+i*4+3];
      }
      for (let i = 16; i < 64; i++) {
        const s0 = rotr(w[i-15], 7) ^ rotr(w[i-15], 18) ^ (w[i-15] >>> 3);
        const s1 = rotr(w[i-2], 17) ^ rotr(w[i-2], 19) ^ (w[i-2] >>> 10);
        w[i] = (w[i-16] + s0 + w[i-7] + s1) | 0;
      }
      let [a, b, c, d, e, f, g, h] = H;
      for (let i = 0; i < 64; i++) {
        const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
        const ch = (e & f) ^ (~e & g);
        const t1 = (h + S1 + ch + K[i] + w[i]) | 0;
        const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
        const maj = (a & b) ^ (a & c) ^ (b & c);
        const t2 = (S0 + maj) | 0;
        h = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b; b = a; a = (t1 + t2) | 0;
      }
      H[0] = (H[0] + a) | 0; H[1] = (H[1] + b) | 0; H[2] = (H[2] + c) | 0; H[3] = (H[3] + d) | 0;
      H[4] = (H[4] + e) | 0; H[5] = (H[5] + f) | 0; H[6] = (H[6] + g) | 0; H[7] = (H[7] + h) | 0;
    }
    return H.map(x => (x >>> 0).toString(16).padStart(8, '0')).join('');
  }

  const regActionBox = $('#registration-action-box');

  if (regActionBox) {
    const confirmRegBtn = $('#confirm-registration-btn');
    if (confirmRegBtn) {
      confirmRegBtn.addEventListener('click', () => {
        markStepComplete('register');
        $('#post-register-note').style.display = 'none';
        const banner = $('#register-confirmation-banner');
        banner.style.display = 'flex';
        banner.scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
    }
  }

  // ── English Placement Test ─────────────────────────────────
  const englishForm = $('#english-assessment-form');
  if (englishForm) {
    initEnglishTest();
  }

  function initEnglishTest() {
    // ---- Timer (90 minutes) ----
    const DURATION = 90 * 60;
    let remaining  = DURATION;
    let timerEl    = null;
    let timerInt   = null;

    // Build timer bar
    const timerHTML = `
      <div id="exam-timer">
        <span class="timer-icon"><i class="fa-solid fa-clock"></i></span>
        <span>Time Remaining:</span>
        <span id="timer-display">90:00</span>
      </div>
      <div id="progress-bar-wrap"><div id="progress-bar"></div></div>
    `;
    const assessSection = $('#assessment-container');
    assessSection.insertAdjacentHTML('afterbegin', timerHTML);
    timerEl = $('#timer-display');

    function formatTime(s) {
      const m = Math.floor(s / 60);
      const sec = s % 60;
      return `${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
    }

    function tickTimer() {
      remaining--;
      timerEl.textContent = formatTime(remaining);
      const pct = ((DURATION - remaining) / DURATION) * 100;
      $('#progress-bar').style.width = pct + '%';

      if (remaining <= 300) timerEl.classList.add('warning');
      if (remaining <= 60)  timerEl.classList.add('critical');

      if (remaining <= 0) {
        clearInterval(timerInt);
        submitEnglishTest(true);
      }
    }
    timerInt = setInterval(tickTimer, 1000);

    // ---- Correct answers key ----
    const ANSWERS = {
      q1:  'C', q2:  'B', q3:  'B', q4:  'C', q5:  'C',
      q6:  'B', q7:  'C', q8:  'C', q9:  'B', q10: 'A',
      q11: 'B', q12: 'B', q13: 'A', q14: 'C', q15: 'B',
      q16: 'B', q17: 'A', q18: 'B', q19: 'B', q20: 'B',
      q21: 'B', q22: 'C', q23: 'B', q24: 'B', q25: 'B',
      q26: 'B', q27: 'B', q28: 'C', q29: 'A', q30: 'B',
      q31: 'B', q32: 'A', q33: 'C', q34: 'B', q35: 'B',
      q36: 'B', q37: 'C', q38: 'B', q39: 'B', q40: 'A',
      q41: 'A', q42: 'A', q43: 'C', q44: 'C', q45: 'A',
      q46: 'A', q47: 'A', q48: 'A', q49: 'A', q50: 'B',
      q51: 'C', q52: 'A', q53: 'B', q54: 'C', q55: 'B',
      q56: 'C', q57: 'B', q58: 'C', q59: 'B', q60: 'C',
      // Comprehension MC
      comp_mc1: 'C', comp_mc2: 'B', comp_mc3: 'C',
      // True/False
      comp_tf1: 'FALSE', comp_tf2: 'TRUE', comp_tf3: 'TRUE',
    };

    // CEFR bands
    function getCEFR(score, total) {
      const pct = (score / total) * 100;
      if (pct >= 90) return { level: 'C1 – Advanced',       desc: 'Excellent command of English. You are ready for professional annotation tasks at the highest level.' };
      if (pct >= 75) return { level: 'B2 – Upper-Intermediate', desc: 'Strong English proficiency. Well-suited for bilingual annotation and LLM evaluation tasks.' };
      if (pct >= 60) return { level: 'B1 – Intermediate',   desc: 'Good foundational English. Some review of complex grammar structures is recommended.' };
      if (pct >= 45) return { level: 'A2 – Elementary',     desc: 'Basic English level. Focused language practice is advised before assessment tasks.' };
      return { level: 'A1 – Beginner', desc: 'Beginner level detected. English language training is strongly recommended.' };
    }

    function submitEnglishTest(timedOut = false) {
      clearInterval(timerInt);

      const data     = new FormData(englishForm);
      const gradeable = Object.keys(ANSWERS);
      let correct = 0;

      gradeable.forEach(name => {
        const given  = data.get(name);
        const answer = ANSWERS[name];
        if (given && given.toUpperCase() === answer) correct++;
      });

      // Visual review
      gradeable.forEach(name => {
        const given  = data.get(name);
        const answer = ANSWERS[name];
        const inputs = $$(`input[name="${name}"]`, englishForm);
        inputs.forEach(input => {
          const lbl = input.closest('label');
          if (!lbl) return;
          if (input.value === answer) lbl.classList.add('correct');
          else if (given && input.value === given) lbl.classList.add('incorrect');
        });
      });

      const total = gradeable.length;
      const pct   = Math.round((correct / total) * 100);
      const cefr  = getCEFR(correct, total);

      markStepComplete('english', { score: pct });

      // Show modal
      showScoreModal({
        title: timedOut ? "⏱ Time's Up!" : '✓ Test Submitted',
        score: pct,
        subtitle: cefr.level,
        desc: `You answered ${correct} of ${total} questions correctly. ${cefr.desc}`,
        continueLinks: [
          { href: 'llm.html', label: 'Continue → LLM Assessment (English)' },
          { href: 'bilingual-llm.html', label: 'Continue → LLM Assessment (Bilingual AR/EN)' },
        ],
      });
    }

    englishForm.addEventListener('submit', (e) => {
      e.preventDefault();
      submitEnglishTest(false);
    });
  }

  // ── LLM Assessment ─────────────────────────────────────────
  const llmForm = $('#llm-evaluation-form') || $('#bilingual-llm-form');
  if (llmForm) {
    initLLMAssessment();
  }

  function initLLMAssessment() {
    const STORAGE_KEY = 'ada_llm_progress_' + (llmForm.id || 'default');

    function visibleFieldNames() {
      const names = new Set();
      $$('li:not(.level-hidden) input, li:not(.level-hidden) textarea, li:not(.level-hidden) select', llmForm).forEach(inp => {
        if (inp.type !== 'submit' && inp.name) names.add(inp.name);
      });
      return names;
    }

    let TOTAL = visibleFieldNames().size;

    // Inject sticky progress bar above the hub
    const hub = $('#llm-assessment-hub');
    const progressHTML = `
      <div id="llm-progress-bar">
        <div id="llm-progress-inner">
          <span id="llm-progress-label">0 / ${TOTAL} answered</span>
          <div id="llm-bar-track"><div id="llm-bar-fill"></div></div>
        </div>
      </div>
    `;
    hub.insertAdjacentHTML('beforebegin', progressHTML);

    const fillEl  = $('#llm-bar-fill');
    const labelEl = $('#llm-progress-label');

    // ── Difficulty-level toggle (llm.html only — no-op elsewhere) ──
    const levelToggle = $('#llm-level-toggle');
    if (levelToggle) {
      $$('button', levelToggle).forEach(btn => {
        btn.addEventListener('click', () => {
          const filter = btn.dataset.levelFilter;
          $$('button', levelToggle).forEach(b => b.classList.toggle('active', b === btn));
          $$('li[data-level]', llmForm).forEach(li => {
            const show = filter === 'all' || li.dataset.level === filter;
            li.classList.toggle('level-hidden', !show);
          });
          TOTAL = visibleFieldNames().size;
          updateLLMProgress();
        });
      });
    }

    function updateLLMProgress() {
      const visible = visibleFieldNames();
      const inputs  = $$('li:not(.level-hidden) input, li:not(.level-hidden) textarea, li:not(.level-hidden) select', llmForm);
      let answered  = 0;
      const counted = new Set();

      inputs.forEach(inp => {
        if (!visible.has(inp.name)) return;
        if (inp.type === 'radio') {
          const group = inp.name;
          if (!counted.has(group) && $(`input[name="${group}"]:checked`, llmForm)) {
            counted.add(group);
            answered++;
          }
        } else if (inp.type !== 'submit') {
          if (!counted.has(inp.name) && inp.value.trim()) {
            counted.add(inp.name);
            answered++;
          }
        }
      });

      const pct = TOTAL ? Math.min((answered / TOTAL) * 100, 100) : 0;
      fillEl.style.width = pct + '%';
      labelEl.textContent = `${answered} / ${TOTAL} answered`;

      // Auto-save to localStorage
      try {
        const data = new FormData(llmForm);
        const saved = {};
        for (let [k, v] of data.entries()) { saved[k] = v; }
        localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
      } catch(e) {}
    }

    // Restore saved progress
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      Object.entries(saved).forEach(([name, value]) => {
        const el = llmForm.querySelector(`[name="${name}"]`);
        if (!el) return;
        if (el.type === 'radio') {
          const radio = llmForm.querySelector(`input[name="${name}"][value="${value}"]`);
          if (radio) radio.checked = true;
        } else {
          el.value = value;
        }
      });
    } catch(e) {}

    llmForm.addEventListener('input', updateLLMProgress);
    llmForm.addEventListener('change', updateLLMProgress);
    updateLLMProgress();

    // ── Junk/low-effort answer detection ──────────────────────
    // Applies only to free-text fields (radio/select choices are always
    // legitimate — there's nothing "junk" about picking an option).
    // Flags: empty, too short, a single repeated character ("aaaa"),
    // or keyboard-mash-style input with no real word content.
    function isJunkTextAnswer(value) {
      const v = (value || '').trim();
      if (!v) return true;
      if (v.replace(/\s/g, '').length < 8) return true;           // too short to be a real answer
      if (/^(.)\1*$/.test(v.replace(/\s/g, ''))) return true;      // "aaaaa", "nnnn"
      const words = v.split(/\s+/).filter(w => w.length > 1);
      if (words.length < 2) return true;                           // single token, e.g. "asdf"
      return false;
    }

    function fieldKind(name) {
      const el = llmForm.querySelector(`[name="${name}"]`);
      if (!el) return 'other';
      if (el.tagName === 'TEXTAREA') return 'text';
      if (el.type === 'text') return 'text';
      return 'choice'; // radio/select
    }

    llmForm.addEventListener('submit', (e) => {
      e.preventDefault();

      // Count completed (only among currently visible/selected-track questions)
      const visible = visibleFieldNames();
      const data    = new FormData(llmForm);
      const counted = new Set();
      let completed = 0;
      let meaningful = 0;
      const junkFields = [];

      for (let [k, v] of data.entries()) {
        if (!visible.has(k) || counted.has(k) || !v.trim()) continue;
        counted.add(k);
        completed++;

        if (fieldKind(k) === 'text' && isJunkTextAnswer(v)) {
          junkFields.push(k);
        } else {
          meaningful++;
        }
      }

      // If there are low-effort text answers, stop and ask the candidate
      // to fix them before we accept the submission as final.
      if (junkFields.length && !llmForm.dataset.confirmJunkSubmit) {
        $$('.answer-flag-junk', llmForm).forEach(el => el.classList.remove('answer-flag-junk'));
        junkFields.forEach(name => {
          const el = llmForm.querySelector(`[name="${name}"]`);
          const li = el && el.closest('li');
          if (li) li.classList.add('answer-flag-junk');
        });
        const firstBad = llmForm.querySelector(`[name="${junkFields[0]}"]`);
        if (firstBad) firstBad.closest('li').scrollIntoView({ behavior: 'smooth', block: 'center' });

        showScoreModal({
          title: '⚠ A few answers need more detail',
          score: null,
          subtitle: `${junkFields.length} response${junkFields.length > 1 ? 's' : ''} look too short or incomplete`,
          desc: 'These questions are reviewed by a human evaluator, so single letters or placeholder text won\'t give an accurate picture of your skills. Please go back and give a real answer to the highlighted question(s) — or submit anyway if you\'re intentionally leaving them brief.',
          noReview: true,
          continueLinks: [],
          extraButtonLabel: 'Submit anyway',
          onExtra: () => { llmForm.dataset.confirmJunkSubmit = '1'; llmForm.requestSubmit(); },
        });
        return;
      }

      delete llmForm.dataset.confirmJunkSubmit;
      try { localStorage.removeItem(STORAGE_KEY); } catch(e) {}

      markStepComplete('llm', { track: llmForm.id, completed, meaningful, total: TOTAL });

      const pct = TOTAL ? Math.round((completed / TOTAL) * 100) : 0;
      showScoreModal({
        title: '✓ Assessment Submitted',
        score: pct,
        scoreLabel: 'Completion',
        subtitle: `${completed} of ${TOTAL} questions completed`,
        desc: 'This reflects how much of the assessment you completed, not a graded score — these are open evaluation questions reviewed by a human at ADA, who will contact you with next steps.',
        noReview: true,
        continueLinks: [{ href: 'training.html', label: 'Continue → Live Annotation Training' }],
      });
    });
  }

  // ── Score Modal (shared) ────────────────────────────────────
  function showScoreModal({ title, score, scoreLabel, subtitle, desc, noReview, continueLinks, extraButtonLabel, onExtra }) {
    const existing = $('#score-modal');
    if (existing) existing.remove();

    const continueHTML = (continueLinks || []).map(l =>
      `<a href="${l.href}" class="btn btn-primary" style="margin-top:10px;width:100%;justify-content:center;">${l.label}</a>`
    ).join('');

    const scoreHTML = (score === null || score === undefined) ? '' : `
      ${scoreLabel ? `<div class="score-tag">${escapeHtml(scoreLabel)}</div>` : ''}
      <div class="score-big">${score}%</div>
    `;

    const modal = document.createElement('div');
    modal.id = 'score-modal';
    modal.className = 'active';
    modal.innerHTML = `
      <div class="score-card">
        <h2>${title}</h2>
        ${scoreHTML}
        <div class="score-level">${subtitle}</div>
        <p class="score-desc">${desc}</p>
        ${!noReview ? `<button class="btn btn-primary" id="review-btn">Review Answers</button>` : ''}
        ${continueHTML}
        ${extraButtonLabel ? `<button class="btn btn-outline-dark" id="extra-modal-btn" style="margin-top:10px;width:100%;justify-content:center;">${extraButtonLabel}</button>` : ''}
        <button class="btn btn-submit" id="close-modal-btn" style="margin-top:12px;">Close</button>
      </div>
    `;
    document.body.appendChild(modal);

    $('#close-modal-btn').addEventListener('click', () => modal.remove());

    if (!noReview) {
      $('#review-btn').addEventListener('click', () => {
        modal.remove();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
    }

    if (extraButtonLabel && onExtra) {
      $('#extra-modal-btn').addEventListener('click', () => {
        modal.remove();
        onExtra();
      });
    }

    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.remove();
    });
  }

  // ── Screening / Camera ─────────────────────────────────────
  const recordBtn = $('#start-recording-trigger');
  if (recordBtn) {
    initCamera();
  }

  // Uploads the screening recording to ADA's Google Drive folder via a
  // Google Apps Script Web App (no backend server needed). Fails silently
  // if not configured yet — the candidate's local download still works
  // either way, so this never blocks their progress.
  function uploadScreeningVideo(blob) {
    if (ADA_CONFIG.DRIVE_UPLOAD_URL.startsWith('YOUR_')) return; // not configured yet
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = String(reader.result).split(',')[1];
      fetch(ADA_CONFIG.DRIVE_UPLOAD_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' }, // avoids CORS preflight on Apps Script
        body: JSON.stringify({
          filename: 'ADA-screening-' + Date.now() + '.webm',
          mimeType: 'video/webm',
          data: base64,
        }),
      }).catch(() => {}); // best-effort; local download is the fallback
    };
    reader.readAsDataURL(blob);
  }

  function initCamera() {
    const container = $('.video-container-placeholder');
    let stream      = null;
    let recorder    = null;
    let chunks      = [];
    let isRecording = false;

    // Inject video element and status
    container.insertAdjacentHTML('afterbegin', `
      <video id="camera-preview" autoplay muted playsinline></video>
      <div id="recording-status">Recording</div>
    `);

    const videoEl  = $('#camera-preview');
    const statusEl = $('#recording-status');

    recordBtn.addEventListener('click', async () => {
      if (!stream) {
        // Request camera
        try {
          stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
          videoEl.srcObject = stream;
          videoEl.classList.add('active');
          recordBtn.textContent = 'Start Recording';
        } catch (err) {
          alert('Camera access denied. Please allow camera permissions to continue.');
          return;
        }
      }

      if (!isRecording) {
        // Start recording
        chunks    = [];
        recorder  = new MediaRecorder(stream);
        recorder.ondataavailable = (e) => chunks.push(e.data);
        recorder.onstop = () => {
          const blob = new Blob(chunks, { type: 'video/webm' });
          const url  = URL.createObjectURL(blob);
          const a    = document.createElement('a');
          a.href     = url;
          a.download = 'ADA-screening-recording.webm';
          a.click();
          URL.revokeObjectURL(url);

          uploadScreeningVideo(blob);

          markStepComplete('screening');
          const banner = $('#screening-confirmation-banner');
          if (banner) {
            banner.style.display = 'flex';
            banner.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        };
        recorder.start();
        isRecording = true;
        recordBtn.textContent   = 'Stop & Save Recording';
        recordBtn.style.background = '#b71c1c';
        statusEl.classList.add('active');
      } else {
        // Stop
        recorder.stop();
        isRecording = false;
        recordBtn.textContent   = 'Start New Recording';
        recordBtn.style.background = '';
        statusEl.classList.remove('active');
      }
    });
  }

  const GH_RAW_BASE = 'https://raw.githubusercontent.com/AccurateDataAnnotator/accurate-data-annotator/main/';

  function ghUrl(path) {
    return GH_RAW_BASE + path.split('/').map(encodeURIComponent).join('/');
  }

  function escapeHtml(str) {
    return String(str == null ? '' : str).replace(/[&<>"']/g, c => (
      { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
    ));
  }

  // Fetch with a hard timeout so a slow/stalled connection can never leave
  // the UI spinning forever — it always resolves to either data or an error.
  async function fetchWithTimeout(url, ms = 15000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), ms);
    try {
      const res = await fetch(url, { signal: controller.signal });
      return res;
    } catch (err) {
      if (err.name === 'AbortError') {
        throw new Error('The dataset took too long to load. Check your connection and try again.');
      }
      throw new Error('Could not reach the dataset (network error). Check your connection and try again.');
    } finally {
      clearTimeout(timer);
    }
  }

  // ── Live Training: Payment Gate ─────────────────────────────
  // NOTE: this is a client-side convenience gate only, not real access
  // control (no backend exists). Entering the founder code (see FOUNDER_CODE_HASH) here is the
  // ONLY free bypass — reserved for Batoul as founder/monitor. Everyone
  // else pays $3 via PayPal and gets a training access code by email,
  // added to VALID_TRAINING_CODES. To add a new paying candidate's code,
  // add it to VALID_TRAINING_CODES.
  const VALID_TRAINING_CODES = [
    'ADA-PAID-0001',
  ];

  const paymentGate      = $('#payment-gate');
  const trainingBox      = $('#training-content-box');
  const trainingAccessIn = $('#training-access-input');
  const trainingAccessBt = $('#training-access-btn');
  const trainingAccessSt = $('#training-access-status');

  if (paymentGate && trainingBox && trainingAccessIn && trainingAccessBt) {
    const TRAINING_UNLOCK_KEY = 'ada_training_unlocked';

    function unlockTraining(silent) {
      trainingBox.classList.remove('locked');
      paymentGate.innerHTML = `
        <div class="cert-gate-banner cert-gate-ok">
          <i class="fa-solid fa-circle-check"></i>
          <div><strong>Access unlocked</strong> — you're all set to start Live Training below.</div>
        </div>`;
    }

    // Unlock state is stored as a hash of the code that was entered, and is
    // re-checked against the CURRENT valid codes on every page load. If a code
    // is retired or rotated, any browser that unlocked with it is locked again.
    // Older builds saved a plain '1' flag, which cannot be verified, so those
    // legacy flags are cleared and the candidate re-enters their code once.
    const TRAINING_UNLOCK_HASH_KEY = 'ada_training_unlock_hash';
    function validCodeHashes() {
      return [FOUNDER_CODE_HASH].concat(VALID_TRAINING_CODES.map(c => sha256Hex(c.trim().toUpperCase())));
    }
    function isValidEntered(enteredUpper) {
      return validCodeHashes().includes(sha256Hex(enteredUpper));
    }

    try {
      localStorage.removeItem('ada_invite_verified');
      localStorage.removeItem(TRAINING_UNLOCK_KEY);
      const savedHash = localStorage.getItem(TRAINING_UNLOCK_HASH_KEY);
      if (savedHash && validCodeHashes().includes(savedHash)) {
        unlockTraining(true);
      } else if (savedHash) {
        localStorage.removeItem(TRAINING_UNLOCK_HASH_KEY);
      }
    } catch (e) {}

    function tryUnlockTraining() {
      const entered = trainingAccessIn.value.trim().toUpperCase();
      const isValid = !!entered && isValidEntered(entered);

      if (!entered) {
        trainingAccessSt.textContent = 'Please enter your access or invitation code.';
        trainingAccessSt.className = 'status-error';
        return;
      }

      if (isValid) {
        try { localStorage.setItem(TRAINING_UNLOCK_HASH_KEY, sha256Hex(entered)); } catch (e) {}
        unlockTraining(false);
      } else {
        trainingAccessIn.classList.add('input-error');
        setTimeout(() => trainingAccessIn.classList.remove('input-error'), 400);
        trainingAccessSt.textContent = 'That code isn\'t recognized. Check the email from ADA after payment, or contact us if you believe this is an error.';
        trainingAccessSt.className = 'status-error';
      }
    }

    trainingAccessBt.addEventListener('click', tryUnlockTraining);
    trainingAccessIn.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); tryUnlockTraining(); }
    });
  }

  // ── Training / Live Annotation Sandbox (multi-modality) ─────
  const trainingWorkspace = $('#training-workspace');
  if (trainingWorkspace) {
    initAnnotationSandbox();
  }

  // Minimal RFC4180-ish CSV parser (handles quoted fields with commas/newlines)
  function parseCSV(text) {
    const rows = [];
    let field = '', row = [], inQuotes = false, i = 0;
    const pushField = () => { row.push(field); field = ''; };
    const pushRow = () => { rows.push(row); row = []; };
    while (i < text.length) {
      const c = text[i];
      if (inQuotes) {
        if (c === '"') {
          if (text[i + 1] === '"') { field += '"'; i += 2; continue; }
          inQuotes = false; i++; continue;
        }
        field += c; i++; continue;
      } else {
        if (c === '"') { inQuotes = true; i++; continue; }
        if (c === ',') { pushField(); i++; continue; }
        if (c === '\r') { i++; continue; }
        if (c === '\n') { pushField(); pushRow(); i++; continue; }
        field += c; i++; continue;
      }
    }
    if (field.length || row.length) { pushField(); pushRow(); }
    const header = (rows.shift() || []).map(h => h.trim());
    return rows
      .filter(r => r.length === header.length && r.some(v => v !== ''))
      .map(r => {
        const obj = {};
        header.forEach((h, idx) => { obj[h] = (r[idx] || '').trim(); });
        return obj;
      });
  }

  function initAnnotationSandbox() {
    const root       = $('#training-modality-root');
    const sourceNote = $('#dataset-source-note');
    const tabs       = $$('.modality-tab');

    const IMAGE_CATEGORIES = ['Healthcare/Medical', 'Education/Classroom', 'Domestic/Daily Life', 'Traffic/Urban Scene', 'Leisure/Outdoor', 'Commercial/Workplace'];
    const AUDIO_CATEGORIES = ['Human Voice', 'Nature/Environmental', 'Urban/Transport', 'Ambient/Crowd Noise'];
    const VIDEO_CATEGORIES = ['Traffic/Urban Scene', 'Sports/Recreation', 'Education/People Activity', 'Workplace/Professional', 'Transport/Vehicle'];

    const IMAGE_MANIFEST = [
      { file: 'Image-1.jpg',  title: 'Patient Lying in Hospital Bed with Nurse Checking Vitals', category: 'Healthcare/Medical' },
      { file: 'Image-2.jpg',  title: 'Doctor Examining a Child in a Hospital Room', category: 'Healthcare/Medical' },
      { file: 'Image-3.jpg',  title: 'Teacher Standing in Front of a Classroom Teaching Students', category: 'Education/Classroom' },
      { file: 'Image-4.jpg',  title: 'Student Reading a Book at a Desk in a School Library', category: 'Education/Classroom' },
      { file: 'Image-5.jpg',  title: 'Family Eating Dinner Together at Home in the Dining Room', category: 'Domestic/Daily Life' },
      { file: 'Image-6.jpg',  title: 'Person Drinking Coffee at a Kitchen Table in the Morning', category: 'Domestic/Daily Life' },
      { file: 'Image-7.jpg',  title: 'Woman Relaxing on a Sofa Watching TV at Home', category: 'Domestic/Daily Life' },
      { file: 'Image-8.jpg', title: 'Busy City Street Intersection with Moving Cars and Traffic Lights', category: 'Traffic/Urban Scene' },
      { file: 'Image-9.jpg',  title: 'Pedestrian Crossing a Busy Road at a Crosswalk', category: 'Traffic/Urban Scene' },
      { file: 'Image-10.jpg', title: 'Man Waiting at a Bus Stop in an Urban Area', category: 'Traffic/Urban Scene' },
      { file: 'Image-11.jpg', title: 'Elderly Person Walking with a Cane in a Park', category: 'Leisure/Outdoor' },
      { file: 'Image-12.jpg', title: 'Young Woman Using a Laptop While Sitting on Her Bed', category: 'Domestic/Daily Life' },
      { file: 'Image-13.jpg', title: 'Children Playing Soccer in a School Playground', category: 'Leisure/Outdoor' },
      { file: 'Image-14.jpg', title: 'Chef Cooking in a Restaurant Kitchen', category: 'Commercial/Workplace' },
      { file: 'Image-15.jpg', title: 'Shopper Carrying Bags Inside a Busy Shopping Mall', category: 'Commercial/Workplace' },
    ].map((s, i) => ({ id: 'img_' + (i + 1), url: ghUrl('dataset/imagesDataset/' + s.file), title: s.title, category: s.category }));

    const AUDIO_MANIFEST = [
      { file: 'A man voice.mp3', category: 'Human Voice' },
      { file: 'A woman Voice.mp3', category: 'Human Voice' },
      { file: 'baby-crying.mp3', category: 'Human Voice' },
      { file: 'Restaurant-talking-people-ambience.mp3', category: 'Ambient/Crowd Noise' },
      { file: 'City-Traffic-Sound.mp3', category: 'Urban/Transport' },
      { file: 'airplane-flying.mp3', category: 'Urban/Transport' },
      { file: 'birds sound.mp3', category: 'Nature/Environmental' },
      { file: 'rain-sound.mp3', category: 'Nature/Environmental' },
      { file: 'wind-blowing.mp3', category: 'Nature/Environmental' },
    ].map((s, i) => ({ id: 'aud_' + (i + 1), url: ghUrl('dataset/audioDataset/' + s.file), title: s.file.replace(/\.mp3$/i, '').trim(), category: s.category }));

    const VIDEO_MANIFEST = [
      { file: '3Airplane taking off .mp4', category: 'Transport/Vehicle' },
      { file: 'A group of students running to school entrance..mp4', category: 'Education/People Activity' },
      { file: 'Football Match.mp4', category: 'Sports/Recreation' },
      { file: 'Pedestrians-across-street .mp4', category: 'Traffic/Urban Scene' },
      { file: 'Person giving a presentation –.mp4', category: 'Workplace/Professional' },
      { file: 'cars stuck in heavy traffic .mp4', category: 'Traffic/Urban Scene' },
    ].map((s, i) => ({ id: 'vid_' + (i + 1), url: ghUrl('dataset/videoDataset/' + s.file), title: s.file.replace(/\.mp4$/i, '').trim(), category: s.category }));

    let TEXT_INTENTS = []; // populated once CSV loads

    const MODALITIES = {
      text: {
        label: 'Text Annotation',
        note: 'Live from dataset/textDataset/ADA_Text_Data_Cleaned.csv on GitHub.',
        load: async () => {
          const res = await fetchWithTimeout(ghUrl('dataset/textDataset/ADA_Text_Data_Cleaned.csv'));
          if (!res.ok) throw new Error('Could not fetch text dataset (' + res.status + ')');
          const rows = parseCSV(await res.text());
          TEXT_INTENTS = [...new Set(rows.map(r => r.Primary_Intent).filter(Boolean))].sort();
          return rows.slice(0, 15).map(r => ({ id: r.Record_ID, ...r }));
        },
        renderTask: (s) => `
          <div class="task-label">${escapeHtml(s.Text_Type)}</div>
          <div class="task-text">${escapeHtml(s.Source_Text)}</div>
          <div class="task-meta">
            <span class="task-tag">${escapeHtml(s.Text_Type)}</span>
            <span class="task-tag">Record ${escapeHtml(s.Record_ID)}</span>
          </div>
          <p style="margin-top:16px;font-size:14px;color:var(--gray-60)">Read the text, classify its sentiment and primary intent, then note any named entities you spot.</p>
        `,
        renderAnswerForm: () => `
          <div class="answer-field">
            <label for="ans-sentiment">Sentiment</label>
            <select id="ans-sentiment">
              <option value="">Select sentiment…</option>
              <option>Positive</option><option>Negative</option><option>Neutral</option><option>Mixed</option>
            </select>
          </div>
          <div class="answer-field">
            <label for="ans-intent">Primary Intent</label>
            <select id="ans-intent">
              <option value="">Select intent…</option>
              ${TEXT_INTENTS.map(v => `<option>${escapeHtml(v)}</option>`).join('')}
            </select>
          </div>
          <div class="answer-field">
            <label for="ans-entities">Named Entities (comma-separated, e.g. "wireless headphones [PROD]")</label>
            <input type="text" id="ans-entities" placeholder="Type any entities you notice…">
          </div>
        `,
        checkAnswer: (s) => {
          const mySent = $('#ans-sentiment').value;
          const myIntent = $('#ans-intent').value;
          const myEntities = $('#ans-entities').value.trim();
          const rows = [
            { label: 'Sentiment', mine: mySent || '—', gold: s.Sentiment_Label, correct: mySent === s.Sentiment_Label },
            { label: 'Primary Intent', mine: myIntent || '—', gold: s.Primary_Intent, correct: myIntent === s.Primary_Intent },
            { label: 'Named Entities', mine: myEntities || '—', gold: s.NER_Entities || '—', correct: null },
          ];
          return rows;
        },
      },

      image: {
        label: 'Image Annotation',
        note: 'Live image files from dataset/imagesDataset/ on GitHub.',
        load: async () => IMAGE_MANIFEST,
        renderTask: (s) => `
          <div class="media-preview"><img src="${s.url}" alt="${escapeHtml(s.title)}" loading="lazy"></div>
          <div class="task-label">${escapeHtml(s.title)}</div>
          <div class="task-meta"><span class="task-tag">${s.id}</span></div>
        `,
        renderAnswerForm: () => `
          <div class="answer-field">
            <label for="ans-category">Scene Category</label>
            <select id="ans-category">
              <option value="">Select category…</option>
              ${IMAGE_CATEGORIES.map(v => `<option>${v}</option>`).join('')}
            </select>
          </div>
        `,
        checkAnswer: (s) => {
          const mine = $('#ans-category').value;
          return [{ label: 'Category', mine: mine || '—', gold: s.category, correct: mine === s.category }];
        },
      },

      audio: {
        label: 'Audio Annotation',
        note: 'Live audio files from dataset/audioDataset/ on GitHub.',
        load: async () => AUDIO_MANIFEST,
        renderTask: (s) => `
          <div class="media-preview"><audio controls preload="none" src="${s.url}"></audio></div>
          <div class="task-label">${escapeHtml(s.title)}</div>
          <div class="task-meta"><span class="task-tag">${s.id}</span></div>
          <p style="margin-top:16px;font-size:14px;color:var(--gray-60)">Listen to the clip and classify the sound category.</p>
        `,
        renderAnswerForm: () => `
          <div class="answer-field">
            <label for="ans-category">Sound Category</label>
            <select id="ans-category">
              <option value="">Select category…</option>
              ${AUDIO_CATEGORIES.map(v => `<option>${v}</option>`).join('')}
            </select>
          </div>
        `,
        checkAnswer: (s) => {
          const mine = $('#ans-category').value;
          return [{ label: 'Category', mine: mine || '—', gold: s.category, correct: mine === s.category }];
        },
      },

      video: {
        label: 'Video Annotation',
        note: 'Live video files from dataset/videoDataset/ on GitHub.',
        load: async () => VIDEO_MANIFEST,
        renderTask: (s) => `
          <div class="media-preview"><video controls preload="none" src="${s.url}"></video></div>
          <div class="task-label">${escapeHtml(s.title)}</div>
          <div class="task-meta"><span class="task-tag">${s.id}</span></div>
          <p style="margin-top:16px;font-size:14px;color:var(--gray-60)">Watch the clip and tag the primary activity or scene.</p>
        `,
        renderAnswerForm: () => `
          <div class="answer-field">
            <label for="ans-category">Activity / Scene Tag</label>
            <select id="ans-category">
              <option value="">Select tag…</option>
              ${VIDEO_CATEGORIES.map(v => `<option>${v}</option>`).join('')}
            </select>
          </div>
        `,
        checkAnswer: (s) => {
          const mine = $('#ans-category').value;
          return [{ label: 'Activity/Scene', mine: mine || '—', gold: s.category, correct: mine === s.category }];
        },
      },
    };

    const state = {}; // per-modality: { samples, index, loaded, loading, error, submitted: Set }
    Object.keys(MODALITIES).forEach(k => { state[k] = { samples: [], index: 0, loaded: false, loading: false, error: null, submitted: new Set() }; });

    let currentModality = 'text';

    function setActiveTab(name) {
      tabs.forEach(t => t.classList.toggle('active', t.dataset.modality === name));
    }

    async function switchModality(name) {
      currentModality = name;
      setActiveTab(name);

      if (name === 'multimodal') {
        sourceNote.textContent = 'Multimodal dataset folder exists in the repo but has no live samples yet — roadmap item.';
        root.innerHTML = `
          <div class="multimodal-soon">
            <i class="fa-solid fa-layer-group"></i>
            <h3>Multimodal Annotation — Coming Soon</h3>
            <p>The <code>dataset/multimodalDataset</code> folder is reserved in the GitHub repo for combined text+image / text+audio annotation tasks. It's currently empty, so this module isn't live yet. In the meantime, practice each modality separately using the tabs above.</p>
          </div>`;
        return;
      }

      const mod = MODALITIES[name];
      const st  = state[name];
      sourceNote.textContent = mod.note;

      if (!st.loaded && !st.loading) {
        st.loading = true;
        root.innerHTML = `<div class="modality-loading"><i class="fa-solid fa-spinner fa-spin"></i>Loading live ${mod.label.toLowerCase()} samples from GitHub…</div>`;
        try {
          st.samples = await mod.load();
          st.loaded  = true;
        } catch (err) {
          st.error = err.message || 'Failed to load dataset.';
          st.loading = false;
          root.innerHTML = `<div class="modality-error"><i class="fa-solid fa-triangle-exclamation"></i> ${escapeHtml(st.error)}<br><button class="btn btn-outline-dark" id="retry-load-btn" style="margin-top:14px;">Retry</button></div>`;
          const retryBtn = $('#retry-load-btn');
          if (retryBtn) retryBtn.addEventListener('click', () => { st.error = null; switchModality(name); });
          return;
        }
        st.loading = false;
      }

      renderSample(name);
    }

    function renderSample(name) {
      const mod = MODALITIES[name];
      const st  = state[name];
      const s   = st.samples[st.index];
      if (!s) {
        root.innerHTML = `<div class="modality-error">No samples available for this modality yet.</div>`;
        return;
      }

      const completed = st.submitted.size;
      const total = st.samples.length;
      const pct = Math.round((completed / total) * 100);

      root.innerHTML = `
        <div id="training-progress-bar">
          <div id="training-progress-inner">
            <span id="training-progress-label">${completed} / ${total} completed</span>
            <div id="training-bar-track"><div id="training-bar-fill" style="width:${pct}%"></div></div>
          </div>
        </div>
        <div id="annotation-sandbox" class="active">
          <div class="sandbox-header">
            <span>Live Annotation Sandbox · Zunoon — ${mod.label}</span>
            <span class="sandbox-badge">LIVE DATASET</span>
          </div>
          <div class="sandbox-body">
            <div class="task-panel">${mod.renderTask(s)}</div>
            <div class="answer-panel">
              <h4>Your Annotation</h4>
              ${mod.renderAnswerForm(s)}
              <div class="check-answer-row">
                <button class="btn btn-outline-dark" id="check-answer-btn">Check Against Reference Label</button>
              </div>
              <div class="gold-compare" id="gold-compare-content" style="display:none;"></div>
            </div>
            <div class="sandbox-nav">
              <button class="sandbox-btn prev" id="prev-sample" ${st.index === 0 ? 'disabled' : ''}>← Previous</button>
              <span class="sandbox-counter">${st.index + 1} / ${total}</span>
              <button class="sandbox-btn ${st.index === total - 1 ? 'finish' : 'next'}" id="next-sample">${st.index === total - 1 ? 'Finish Session ✓' : 'Next →'}</button>
            </div>
          </div>
        </div>
      `;

      $('#check-answer-btn').addEventListener('click', () => {
        const rows = mod.checkAnswer(s);
        const html = rows.map(r => {
          const cls = r.correct === null ? '' : (r.correct ? 'correct' : 'incorrect');
          return `
            <div class="compare-row ${cls}">
              <span class="compare-mine">You: ${escapeHtml(r.mine)}</span>
              <span class="compare-gold">Reference: ${escapeHtml(r.gold)}</span>
            </div>`;
        }).join('');
        $('#gold-compare-content').innerHTML = html;
        $('#gold-compare-content').style.display = 'block';
        st.submitted.add(s.id);
        const label = $('#training-progress-label');
        const fill  = $('#training-bar-fill');
        if (label) label.textContent = `${st.submitted.size} / ${total} completed`;
        if (fill) fill.style.width = Math.round((st.submitted.size / total) * 100) + '%';
      });

      $('#prev-sample').addEventListener('click', () => {
        if (st.index > 0) { st.index--; renderSample(name); }
      });

      $('#next-sample').addEventListener('click', () => {
        if (st.index < total - 1) {
          st.index++;
          renderSample(name);
        } else {
          showModalitySummary(name);
        }
      });
    }

    function showModalitySummary(name) {
      const mod = MODALITIES[name];
      const st  = state[name];

      const journey = getJourney();
      const completedModalities = new Set((journey.training && journey.training.modalities) || []);
      completedModalities.add(name);
      markStepComplete('training', { modalities: [...completedModalities] });

      const accuracyKnown = [...st.submitted].length > 0;
      root.innerHTML = `
        <div id="session-summary" class="active">
          <h3>Session Complete 🎉</h3>
          <p>You've gone through all ${st.samples.length} live ${mod.label.toLowerCase()} samples in this set.</p>
          <div class="summary-stats">
            <div class="stat-item">
              <span class="stat-num">${st.submitted.size}</span>
              <span class="stat-desc">Samples Checked</span>
            </div>
            <div class="stat-item">
              <span class="stat-num">${st.samples.length}</span>
              <span class="stat-desc">Total in Set</span>
            </div>
          </div>
          <p style="color:var(--gray-60);font-size:14px;">Switch modality tabs above to keep training on another modality, or restart this set.</p>
          <button class="btn btn-primary" id="restart-modality" style="margin-top:24px;">Annotate Again</button>
          <a href="certificate.html" class="btn btn-outline-dark" style="margin-top:12px;display:inline-flex;">Continue → Certificate ✓</a>
        </div>`;
      $('#restart-modality').addEventListener('click', () => {
        st.index = 0;
        st.submitted = new Set();
        renderSample(name);
      });
    }

    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        if (tab.dataset.modality === currentModality) return;
        switchModality(tab.dataset.modality);
      });
    });

    switchModality('text');
  }

  // ── Knowledge Library ────────────────────────────────────────
  const libraryGrid = $('#library-grid');
  if (libraryGrid) {
    const LIB_BASE = 'https://raw.githubusercontent.com/AccurateDataAnnotator/accurate-data-annotator/main/library/';
    const LIBRARY_MANIFEST = [
      { icon: 'fa-book-open',      title: 'Annotation Guideline Manual',        desc: 'Core annotation standards and labeling conventions for ADA projects.', en: 'ADA_Annotation_Guideline_Manual.pdf', bi: 'ADA_Annotation_Guideline_Bilingual_Manual.pdf' },
      { icon: 'fa-clipboard-check',title: 'QA Beginner Manual',                 desc: 'Quality-assurance checklist and review process for new annotators.', en: 'ADA_QA_Beginner_Manual_English_Only.pdf', bi: 'ADA_QA_Beginner__Bilingual_Manual.pdf' },
      { icon: 'fa-shield-halved',  title: 'Content Moderation Guide',           desc: 'Policy framework and edge-case handling for content moderation tasks.', en: 'ADA_Content_Moderation_Guide_English.pdf', bi: 'ADA_Content_Moderation_Guide_Bilingual.pdf' },
      { icon: 'fa-brain',          title: 'LLM Evaluation & RLHF Manual',       desc: 'Rating dimensions and best practices for LLM response evaluation.', en: 'ADA_LLM_Evaluation_RLHF_Manual.pdf', bi: 'ADA_LLM_Evaluation_RLHF_Bilingual_Manual.pdf' },
      { icon: 'fa-terminal',       title: 'Prompt Engineering Basics',          desc: 'Foundational prompt-writing techniques used across ADA workflows.', en: 'ADA_Prompt_Engineering_Basics_EN.pdf', bi: 'ADA_Prompt_Engineering_Basics_Bilingual.pdf' },
      { icon: 'fa-user-shield',    title: 'AI Security & Privacy Manual',       desc: 'Data handling, privacy, and security practices for annotators.', en: 'ADA_AI_Security_Privacy_Manual.pdf', bi: 'ADA_AI_Security_Privacy__Bilingual-Manual.pdf' },
      { icon: 'fa-route',          title: 'Beginner Roadmap',                   desc: 'A step-by-step orientation guide for candidates starting at ADA.', en: 'ADA_Beginner_Roadmap.pdf', bi: null },
    ];

    libraryGrid.innerHTML = LIBRARY_MANIFEST.map(item => `
      <div class="library-card">
        <i class="fa-solid ${item.icon} library-card-icon"></i>
        <h3>${item.title}</h3>
        <p>${item.desc}</p>
        <div class="library-links">
          <a href="${LIB_BASE + encodeURIComponent(item.en)}" target="_blank"><i class="fa-solid fa-download"></i> English</a>
          ${item.bi ? `<a href="${LIB_BASE + encodeURIComponent(item.bi)}" target="_blank" class="bilingual"><i class="fa-solid fa-download"></i> Bilingual (AR/EN)</a>` : ''}
        </div>
      </div>
    `).join('');
  }

  // ── Homepage: Live Sample Dataset Preview ───────────────────
  const samplePreviewGrid = $('#sample-preview-grid');
  if (samplePreviewGrid) {
    const RAW_BASE = 'https://raw.githubusercontent.com/AccurateDataAnnotator/accurate-data-annotator/main/';

    (async () => {
      try {
        const res = await fetch(RAW_BASE + 'dataset/textDataset/ADA_Text_Data_Cleaned.csv');
        const text = await res.text();
        const lines = text.split(/\r?\n/).filter(Boolean);
        const rows = lines.slice(1, 3); // header + first 2 data rows for a quick preview
        const cards = rows.map(line => {
          // naive split is fine here since we only display a short excerpt
          const match = line.match(/^([^,]*),([^,]*),"?(.*?)"?,([^,]*),/);
          const type = match ? match[2] : 'Sample';
          const snippet = match ? match[3].slice(0, 140) : line.slice(0, 140);
          return `
            <div class="sample-preview-card">
              <h4>Text Dataset</h4>
              <p class="preview-text">"${snippet}${snippet.length >= 140 ? '…' : ''}"</p>
              <div class="preview-tags"><span class="task-tag">${type}</span></div>
            </div>`;
        }).join('');

        samplePreviewGrid.innerHTML = cards + `
          <div class="sample-preview-card">
            <h4>Audio Dataset</h4>
            <audio controls preload="none" src="${RAW_BASE}dataset/audioDataset/${encodeURIComponent('A woman Voice.mp3')}"></audio>
            <p class="preview-text">Real annotated audio clip from our training corpus.</p>
          </div>
          <div class="sample-preview-card">
            <img src="${RAW_BASE}dataset/imagesDataset/Image-3.jpg" alt="Sample annotated image" loading="lazy">
            <p class="preview-text">Teacher standing in front of a classroom teaching students — Education/Classroom category.</p>
          </div>
        `;
      } catch (err) {
        samplePreviewGrid.innerHTML = `<p style="color:var(--gray-60);">Live samples are temporarily unavailable — please check back shortly.</p>`;
      }
    })();
  }

  // ── Certificate Generator ───────────────────────────────────
  const certGenBtn = $('#generate-cert-btn');
  if (certGenBtn) {
    initCertificateGenerator();
  }

  function initCertificateGenerator() {
    // ── Eligibility hard-gate ────────────────────────────────────────
    // NOTE: this platform has no backend, so this cannot stop someone
    // from editing localStorage in devtools. What it DOES do is stop the
    // normal path: the Generate/Download buttons are actually disabled
    // (not just a warning) until every required step shows complete on
    // this browser and the English score is at least 60%.
    const gateMount = $('#cert-gate-banner-mount');
    const requiredSteps = [
      { key: 'register', label: 'Registration' },
      { key: 'screening', label: 'Screening' },
      { key: 'english', label: 'English Test' },
      { key: 'llm', label: 'LLM Assessment' },
      { key: 'training', label: 'Live Training' },
    ];

    function checkEligibility() {
      const journey = getJourney();
      const missing = requiredSteps.filter(s => !isStepDone(s.key));
      const englishScore = journey.english && journey.english.score;
      const englishMissing = typeof englishScore !== 'number';
      const belowPassMark = !englishMissing && englishScore < 60;
      return {
        eligible: !missing.length && !belowPassMark && !englishMissing,
        missing, belowPassMark, englishMissing, englishScore,
      };
    }

    function renderGate() {
      const status = checkEligibility();

      if (gateMount) {
        gateMount.innerHTML = status.eligible ? `
          <div class="cert-gate-banner cert-gate-ok">
            <i class="fa-solid fa-circle-check"></i>
            <div><strong>All requirements met</strong> — you're eligible to generate your certificate.</div>
          </div>` : `
          <div class="cert-gate-banner cert-gate-blocked">
            <i class="fa-solid fa-lock"></i>
            <div>
              <strong>Certificate locked — finish these first</strong>
              All steps below must be complete on this browser before a certificate can be generated:
              <ul>
                ${status.missing.map(s => `<li>${s.label} — not yet marked complete</li>`).join('')}
                ${status.belowPassMark ? `<li>English Test score (${status.englishScore}%) is below the 60% minimum</li>` : ''}
                ${status.englishMissing ? `<li>English Test — no score recorded yet</li>` : ''}
              </ul>
            </div>
          </div>`;
      }

      if (certGenBtn) {
        certGenBtn.disabled = !status.eligible;
        certGenBtn.classList.toggle('btn-disabled', !status.eligible);
        certGenBtn.title = status.eligible ? '' : 'Complete all steps (and score 60%+ on the English Test) to unlock';
      }

      return status.eligible;
    }

    renderGate();

    const canvas   = $('#cert-canvas');
    const ctx      = canvas.getContext('2d');
    const nameEl   = $('#cert-name');
    const trackEl  = $('#cert-track');
    const dateEl   = $('#cert-date');
    const actions  = $('#cert-actions');

    // Default date = today
    dateEl.value = new Date().toISOString().split('T')[0];

    const logo = new Image();
    logo.crossOrigin = 'anonymous';
    logo.src = 'https://raw.githubusercontent.com/AccurateDataAnnotator/accurate-data-annotator/main/ADALogo/ADA-Logo.png';

    // CEO signature, embedded (light ink, transparent) so it always renders and
    // never taints the canvas for PNG/PDF export.
    const sigImg = new Image();
    sigImg.src = 'data:image/png;base64,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';

    function genCertId(name) {
      const stamp = Date.now().toString(36).toUpperCase();
      const initials = (name || 'XX').trim().split(/\s+/).map(w => w[0] || '').join('').toUpperCase().slice(0, 3);
      return `ADA-${initials}-${stamp}`;
    }

    function formatDate(iso) {
      if (!iso) return '';
      const d = new Date(iso + 'T00:00:00');
      return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    }

    function drawCertificate() {
      const W = canvas.width, H = canvas.height;
      const name  = nameEl.value.trim() || 'Candidate Name';
      const track = trackEl.value;
      const date  = formatDate(dateEl.value);
      const certId = genCertId(name);
      canvas.dataset.certId = certId;

      // Background
      ctx.fillStyle = '#0a0a0a';
      ctx.fillRect(0, 0, W, H);

      // Subtle gray inner panel
      ctx.fillStyle = '#111111';
      ctx.fillRect(28, 28, W - 56, H - 56);

      // Red border line
      ctx.strokeStyle = '#D32F2F';
      ctx.lineWidth = 3;
      ctx.strokeRect(28, 28, W - 56, H - 56);

      // Corner brackets (brand signature)
      const bracket = (x, y, dx, dy) => {
        ctx.beginPath();
        ctx.moveTo(x, y + dy * 50);
        ctx.lineTo(x, y);
        ctx.lineTo(x + dx * 50, y);
        ctx.strokeStyle = '#D32F2F';
        ctx.lineWidth = 4;
        ctx.stroke();
      };
      bracket(50, 50, 1, 1);
      bracket(W - 50, 50, -1, 1);
      bracket(50, H - 50, 1, -1);
      bracket(W - 50, H - 50, -1, -1);

      // Logo (if loaded)
      if (logo.complete && logo.naturalWidth > 0) {
        const lw = 90, lh = 90;
        ctx.drawImage(logo, W / 2 - lw / 2, 70, lw, lh);
      }

      // Header
      ctx.textAlign = 'center';
      ctx.fillStyle = '#888888';
      ctx.font = '600 18px "DM Sans", sans-serif';
      ctx.fillText('ACCURATE DATA ANNOTATOR', W / 2, 195);

      ctx.fillStyle = '#D32F2F';
      ctx.font = '700 16px "DM Sans", sans-serif';
      ctx.fillText('CERTIFICATE OF COMPLETION', W / 2, 225);

      // "This certifies that"
      ctx.fillStyle = '#cccccc';
      ctx.font = '400 18px "DM Sans", sans-serif';
      ctx.fillText('This certifies that', W / 2, 300);

      // Name
      ctx.fillStyle = '#ffffff';
      let nameSize = 56;
      ctx.font = `800 ${nameSize}px "Syne", sans-serif`;
      while (ctx.measureText(name).width > W - 200 && nameSize > 28) {
        nameSize -= 2;
        ctx.font = `800 ${nameSize}px "Syne", sans-serif`;
      }
      ctx.fillText(name, W / 2, 375);

      // Underline
      const lineW = Math.min(ctx.measureText(name).width + 40, W - 160);
      ctx.strokeStyle = '#D32F2F';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(W / 2 - lineW / 2, 400);
      ctx.lineTo(W / 2 + lineW / 2, 400);
      ctx.stroke();

      // Track line
      ctx.fillStyle = '#cccccc';
      ctx.font = '400 18px "DM Sans", sans-serif';
      ctx.fillText('has successfully completed the ADA candidate certification program as a', W / 2, 450);

      ctx.fillStyle = '#ffffff';
      ctx.font = '700 26px "Syne", sans-serif';
      ctx.fillText(track, W / 2, 490);

      // Description line
      ctx.fillStyle = '#888888';
      ctx.font = '400 15px "DM Sans", sans-serif';
      ctx.fillText('Covering bilingual Arabic-English annotation, LLM evaluation, and live annotation training.', W / 2, 530);

      // Date + Cert ID row
      ctx.font = '500 15px "DM Sans", sans-serif';
      ctx.fillStyle = '#cccccc';
      ctx.textAlign = 'left';
      ctx.fillText(`Date Issued: ${date}`, 90, H - 110);
      ctx.textAlign = 'right';
      ctx.fillText(`Certificate ID: ${certId}`, W - 90, H - 110);

      // CEO signature (drawn just above the signature line)
      if (sigImg.complete && sigImg.naturalWidth > 0) {
        const sw = 190, sh = sw * (sigImg.naturalHeight / sigImg.naturalWidth);
        ctx.drawImage(sigImg, W / 2 - sw / 2, H - 150 - sh + 8, sw, sh);
      }

      // Signature line
      ctx.textAlign = 'center';
      ctx.strokeStyle = '#555555';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(W / 2 - 110, H - 150);
      ctx.lineTo(W / 2 + 110, H - 150);
      ctx.stroke();
      ctx.fillStyle = '#ffffff';
      ctx.font = '700 16px "Syne", sans-serif';
      ctx.fillText('Batoul Hassaballa', W / 2, H - 125);
      ctx.fillStyle = '#888888';
      ctx.font = '400 13px "DM Sans", sans-serif';
      ctx.fillText('Founder & CEO, Accurate Data Annotator', W / 2, H - 105);

      actions.style.display = 'flex';
    }

    function ensureName() {
      if (!nameEl.value.trim()) {
        nameEl.focus();
        nameEl.classList.add('input-error');
        setTimeout(() => nameEl.classList.remove('input-error'), 1200);
        return false;
      }
      return true;
    }

    certGenBtn.addEventListener('click', () => {
      if (!renderGate()) return; // re-check eligibility even if disabled state was bypassed
      if (!ensureName()) return;
      drawCertificate();
      markStepComplete('certificate', { candidateName: nameEl.value.trim() });
    });

    // Redraw live as fields change once first generated
    [nameEl, trackEl, dateEl].forEach(el => {
      el.addEventListener('input', () => {
        if (actions.style.display !== 'none') drawCertificate();
      });
      el.addEventListener('change', () => {
        if (actions.style.display !== 'none') drawCertificate();
      });
    });

    logo.onload = () => {
      if (actions.style.display !== 'none') drawCertificate();
    };
    sigImg.onload = () => {
      if (actions.style.display !== 'none') drawCertificate();
    };

    $('#download-png-btn').addEventListener('click', () => {
      if (!ensureName()) return;
      const link = document.createElement('a');
      link.download = `ADA-Certificate-${(nameEl.value.trim() || 'candidate').replace(/\s+/g, '-')}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    });

    $('#download-pdf-btn').addEventListener('click', () => {
      if (!ensureName()) return;
      try {
        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF({ orientation: 'landscape', unit: 'px', format: [canvas.width, canvas.height] });
        const imgData = canvas.toDataURL('image/png');
        pdf.addImage(imgData, 'PNG', 0, 0, canvas.width, canvas.height);
        pdf.save(`ADA-Certificate-${(nameEl.value.trim() || 'candidate').replace(/\s+/g, '-')}.pdf`);
      } catch (err) {
        alert('PDF export failed to load. Please try the PNG download instead.');
      }
    });

    $('#share-linkedin-btn').addEventListener('click', () => {
      if (!ensureName()) return;
      // Download the image first so the candidate can attach it manually —
      // LinkedIn's share intent cannot pull in a locally generated image directly.
      const link = document.createElement('a');
      link.download = `ADA-Certificate-${(nameEl.value.trim() || 'candidate').replace(/\s+/g, '-')}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();

      const text = encodeURIComponent(
        `I'm proud to share that I've completed the ADA ${trackEl.value} certification program with Accurate Data Annotator! 🎉\n\n#DataAnnotation #LLM #AI #ADA`
      );
      setTimeout(() => {
        alert('Your certificate image has been downloaded. LinkedIn will now open a new post — attach the downloaded image to complete your share.');
        window.open(`https://www.linkedin.com/feed/?shareActive=true&text=${text}`, '_blank');
      }, 400);
    });
  }

})();
