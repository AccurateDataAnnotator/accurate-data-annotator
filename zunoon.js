/* ============================================================
   ZUNOON — ADA Platform JavaScript
   Page-aware: activates only what each page needs
   ============================================================ */

(function () {
  'use strict';

  // ── ADA Notifications & Video Upload Config ─────────────────
  // Fill these in once you've created your EmailJS account/template
  // and deployed the Google Apps Script (see setup notes provided).
  const ADA_CONFIG = {
    EMAILJS_PUBLIC_KEY:  '0goZo5JRe5Unj1wFv',
    EMAILJS_SERVICE_ID:  'service_ex4c2j9',
    EMAILJS_TEMPLATE_ID: 'template_97niz6f',
    DRIVE_UPLOAD_URL:    'https://script.google.com/macros/s/AKfycbyqhGaTvF9T_fHRmzabR4BttBeCuq-EYst55zvec7xyDBf84K5IvNEkF2zYsJZ8_9lv/exec',
  };

  // Loads the EmailJS SDK once, only if not already present.
  function loadEmailJS(cb) {
    if (window.emailjs) { cb(); return; }
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/@emailjs/browser@3/dist/email.min.js';
    s.onload = () => {
      try { window.emailjs.init({ publicKey: ADA_CONFIG.EMAILJS_PUBLIC_KEY }); } catch (e) {}
      cb();
    };
    s.onerror = () => {};
    document.head.appendChild(s);
  }

  // Sends a notification email to ADA (batoul.hassaballa@gmail.com via
  // the EmailJS template). Fails silently if not configured yet, so it
  // never blocks or breaks the candidate's flow.
  function notifyADA(params) {
    if (ADA_CONFIG.EMAILJS_PUBLIC_KEY.startsWith('YOUR_')) return; // not configured yet
    loadEmailJS(() => {
      try {
        window.emailjs.send(ADA_CONFIG.EMAILJS_SERVICE_ID, ADA_CONFIG.EMAILJS_TEMPLATE_ID, params);
      } catch (e) {}
    });
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
  // control (there is no backend), matching the same approach already
  // used for the registration invite gate.
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

  // ── Registration Invitation Gate ────────────────────────────
  // NOTE: This is a client-side convenience gate only — it keeps casual
  // visitors from stumbling into the application form, but it is NOT secure
  // (anyone can read this file). Do not treat it as real access control.
  // To add/remove codes, edit VALID_INVITE_CODES below. Codes are matched
  // case-insensitively and trimmed.
  const VALID_INVITE_CODES = [
    'ADA-2026',
    'ADA-COHORT1',
    'ZUNOON-VIP',
  ];

  const inviteInput  = $('#invite-code-input');
  const inviteBtn    = $('#invite-submit-btn');
  const inviteStatus = $('#invite-status');
  const inviteGate   = $('#invite-gate');
  const regActionBox = $('#registration-action-box');

  if (inviteBtn && inviteInput && regActionBox) {
    const UNLOCK_KEY = 'ada_invite_verified';

    function unlockRegistration(silent) {
      regActionBox.classList.remove('locked');
      inviteStatus.textContent = 'Code accepted — you can now fill out the application form below.';
      inviteStatus.className = 'status-ok';
      inviteInput.disabled = true;
      inviteBtn.disabled = true;
      const postNote = $('#post-register-note');
      if (postNote) postNote.style.display = 'block';
    }

    // Restore prior verification for this browser (convenience only)
    try {
      if (localStorage.getItem(UNLOCK_KEY) === '1') unlockRegistration(true);
    } catch (e) {}

    function tryUnlock() {
      const entered = inviteInput.value.trim().toUpperCase();
      const isValid = VALID_INVITE_CODES.some(c => c.toUpperCase() === entered);

      if (!entered) {
        inviteStatus.textContent = 'Please enter your invitation code.';
        inviteStatus.className = 'status-error';
        return;
      }

      if (isValid) {
        try { localStorage.setItem(UNLOCK_KEY, '1'); } catch (e) {}
        unlockRegistration(false);
      } else {
        inviteInput.classList.add('input-error');
        setTimeout(() => inviteInput.classList.remove('input-error'), 400);
        inviteStatus.textContent = 'That code isn\'t recognized. Double-check the email from ADA, or contact us if you believe this is an error.';
        inviteStatus.className = 'status-error';
      }
    }

    inviteBtn.addEventListener('click', tryUnlock);
    inviteInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); tryUnlock(); }
    });

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
