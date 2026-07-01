/* ============================================================
   ZUNOON — ADA Platform JavaScript
   Page-aware: activates only what each page needs
   ============================================================ */

(function () {
  'use strict';

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
      window.location.href = `mailto:batoul.hassaballa@gmail.com?subject=${subject}&body=${body}`;
    });
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
      q26: 'D', q27: 'B', q28: 'C', q29: 'A', q30: 'B',
      q31: 'B', q32: 'A', q33: 'C', q34: 'B', q35: 'B',
      q36: 'B', q37: 'C', q38: 'B', q39: 'B', q40: 'A',
      q41: 'A', q42: 'A', q43: 'C', q44: 'C', q45: 'A',
      q46: 'A', q47: 'A', q48: 'A', q49: 'A', q50: 'B',
      q51: 'B', q52: 'B', q53: 'B', q54: 'C', q55: 'B',
      q56: 'A', q57: 'B', q58: 'C', q59: 'B', q60: 'C',
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

      // Show modal
      showScoreModal({
        title: timedOut ? "⏱ Time's Up!" : '✓ Test Submitted',
        score: pct,
        subtitle: cefr.level,
        desc: `You answered ${correct} of ${total} questions correctly. ${cefr.desc}`,
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
    const allFieldNames = new Set();
    $$('input, textarea, select', llmForm).forEach(inp => {
      if (inp.type !== 'submit' && inp.name) allFieldNames.add(inp.name);
    });
    const TOTAL = allFieldNames.size;

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

    function updateLLMProgress() {
      const inputs  = $$('input, textarea, select', llmForm);
      let answered  = 0;
      const counted = new Set();

      inputs.forEach(inp => {
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

      const pct = Math.min((answered / TOTAL) * 100, 100);
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

    llmForm.addEventListener('submit', (e) => {
      e.preventDefault();

      // Count completed
      const data    = new FormData(llmForm);
      const counted = new Set();
      let completed = 0;

      for (let [k] of data.entries()) {
        if (!counted.has(k) && data.get(k).trim()) {
          counted.add(k);
          completed++;
        }
      }

      try { localStorage.removeItem(STORAGE_KEY); } catch(e) {}

      showScoreModal({
        title: '✓ Assessment Submitted',
        score: Math.round((completed / TOTAL) * 100),
        subtitle: `${completed} of ${TOTAL} questions completed`,
        desc: 'Your LLM evaluation responses have been recorded. ADA will review your submission and contact you with next steps.',
        noReview: true,
      });
    });
  }

  // ── Score Modal (shared) ────────────────────────────────────
  function showScoreModal({ title, score, subtitle, desc, noReview }) {
    const existing = $('#score-modal');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.id = 'score-modal';
    modal.className = 'active';
    modal.innerHTML = `
      <div class="score-card">
        <h2>${title}</h2>
        <div class="score-big">${score}%</div>
        <div class="score-level">${subtitle}</div>
        <p class="score-desc">${desc}</p>
        ${!noReview ? `<button class="btn btn-primary" id="review-btn">Review Answers</button>` : ''}
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

    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.remove();
    });
  }

  // ── Screening / Camera ─────────────────────────────────────
  const recordBtn = $('#start-recording-trigger');
  if (recordBtn) {
    initCamera();
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

  // ── Training / Annotation Sandbox ──────────────────────────
  const trainingWorkspace = $('#training-workspace');
  if (trainingWorkspace) {
    initAnnotationSandbox();
  }

  function initAnnotationSandbox() {
    // Real annotation samples from ADA dataset.
    // NOTE: embedded here for now. To swap in the live GitHub dataset
    // (dataset/textDataset), replace this array with a fetch() against
    // the raw.githubusercontent.com JSON file — sample shape (id/type/
    // language/text/task) is designed to match the repo dataset format.
    const SAMPLES = [
      {
        id: 1,
        type: 'Customer Review',
        language: 'English',
        text: 'The product arrived two days late and the packaging was damaged, but the item itself was in perfect condition. Customer service was helpful when I called to complain. Overall a 3-star experience.',
        task: 'Rate this customer review on the following quality dimensions for LLM training data.',
        gold: { Relevance: 5, Fluency: 5, Accuracy: 4, Completeness: 4 },
        tip: 'Mixed-sentiment reviews (late delivery + good product) should still score high on Relevance/Accuracy — annotators often under-rate these by mistake.',
      },
      {
        id: 2,
        type: 'Social Media Comment',
        language: 'English',
        text: 'Can\'t believe how good this coffee is!! I\'ve tried SO many brands and nothing compares 😍 literally my morning is ruined without it lol. 10/10 would recommend to literally everyone.',
        task: 'Evaluate this social media comment for sentiment accuracy and annotation quality.',
        gold: { Relevance: 5, Fluency: 3, Accuracy: 5, Completeness: 3 },
        tip: 'Informal tone, emoji, and exaggeration ("ruined without it") lower Fluency/Completeness scores even when sentiment is clearly positive — don\'t conflate enthusiasm with quality.',
      },
      {
        id: 3,
        type: 'Product Description',
        language: 'English',
        text: 'Premium stainless steel water bottle with double-wall vacuum insulation. Keeps beverages cold for 24 hours or hot for 12 hours. BPA-free, leak-proof lid. Available in 5 colors. Capacity: 750ml.',
        task: 'Assess this product description for factual clarity, completeness, and annotation value.',
        gold: { Relevance: 5, Fluency: 5, Accuracy: 5, Completeness: 5 },
        tip: 'Clean, specific, verifiable specs (capacity, duration, materials) with no ambiguity — this is a near-ideal reference example for "Completeness."',
      },
      {
        id: 4,
        type: 'Support Ticket',
        language: 'English',
        text: 'Hi I need help. My account has been locked for 3 days and nobody is responding to my emails. I have an urgent deadline and I can\'t access my files. Please this is very important.',
        task: 'Rate this support ticket for urgency detection and tone annotation quality.',
        gold: { Relevance: 5, Fluency: 4, Accuracy: 4, Completeness: 3 },
        tip: 'Urgency markers ("3 days", "urgent deadline") are explicit and should be flagged. Completeness is capped because the ticket lacks an account ID or order number.',
      },
      {
        id: 5,
        type: 'Bilingual Text',
        language: 'Arabic–English',
        text: 'هذا المنتج ممتاز! The quality exceeded my expectations. سأشتري مرة أخرى بالتأكيد. Highly recommended for anyone looking for a reliable option.',
        task: 'Evaluate this bilingual Arabic-English text for code-switching accuracy and annotation completeness.',
        gold: { Relevance: 5, Fluency: 4, Accuracy: 5, Completeness: 4 },
        tip: 'Natural code-switching (not translation-pair text) — both languages carry independent meaning. Fluency is scored per-language, not penalized for switching itself.',
      },
      {
        id: 6,
        type: 'LLM Response Evaluation',
        language: 'English',
        text: 'User asked: "What is photosynthesis?" \n\nModel responded: "Photosynthesis is the process by which plants, algae, and some bacteria convert light energy—usually from the sun—into chemical energy stored as glucose. This process uses carbon dioxide and water, and releases oxygen as a byproduct."',
        task: 'Rate this LLM response for relevance, accuracy, fluency, and completeness.',
        gold: { Relevance: 5, Fluency: 5, Accuracy: 5, Completeness: 4 },
        tip: 'Factually correct and well-written. Completeness held at 4 — a strong answer could also mention chlorophyll/light-dependent vs. light-independent reactions.',
      },
      {
        id: 7,
        type: 'LLM Response Evaluation',
        language: 'English',
        text: 'User asked: "Write me a professional email declining a meeting." \n\nModel responded: "hey cant make it to the meeting tomorrow something came up. maybe next time? thanks"',
        task: 'Evaluate this LLM response. Does it follow the instruction? Rate each quality dimension.',
        gold: { Relevance: 3, Fluency: 2, Accuracy: 3, Completeness: 2 },
        tip: 'Instruction said "professional" — the response is casual, lowercase, no subject/greeting/sign-off. This is a clear instruction-following failure, not a borderline case.',
      },
      {
        id: 8,
        type: 'Customer Review',
        language: 'Arabic',
        text: 'المنتج وصل في الوقت المحدد والتغليف كان ممتازاً. الجودة أفضل بكثير مما توقعت بالنظر للسعر. سأوصي به لجميع أصدقائي. شكراً للبائع على الخدمة الرائعة.',
        task: 'Rate this Arabic customer review for sentiment clarity and annotation quality.',
        gold: { Relevance: 5, Fluency: 5, Accuracy: 5, Completeness: 4 },
        tip: 'Clear positive sentiment with specific reasons (timing, packaging, value-for-price). Grammatically clean Arabic — strong reference example.',
      },
    ];

    const DIMENSIONS  = ['Relevance', 'Fluency', 'Accuracy', 'Completeness'];
    const CONFIDENCE_LEVELS = ['Very confident', 'Somewhat confident', 'Unsure'];
    const SAVE_KEY     = 'ada_training_progress_v1';
    let currentIndex = 0;
    const ratings    = {}; // { sampleId: { dims, flagged, notes, confidence, submitted } }

    // Restore any saved session
    try {
      const saved = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null');
      if (saved && typeof saved === 'object') {
        if (saved.ratings) Object.assign(ratings, saved.ratings);
        if (Number.isInteger(saved.currentIndex) && saved.currentIndex >= 0 && saved.currentIndex < SAMPLES.length) {
          currentIndex = saved.currentIndex;
        }
      }
    } catch (e) {}

    function persistProgress() {
      try {
        localStorage.setItem(SAVE_KEY, JSON.stringify({ currentIndex, ratings }));
      } catch (e) {}
    }

    // Replace placeholder with sandbox
    const placeholder = $('.live-stream-placeholder');
    if (placeholder) placeholder.style.display = 'none';

    const sandboxHTML = `
      <div id="training-progress-bar">
        <div id="training-progress-inner">
          <span id="training-progress-label">0 / ${SAMPLES.length} completed</span>
          <div id="training-bar-track"><div id="training-bar-fill"></div></div>
        </div>
      </div>
      <div id="annotation-sandbox" class="active">
        <div class="sandbox-header">
          <span>Live Annotation Sandbox · Zunoon</span>
          <span class="sandbox-badge">TRAINING MODE</span>
        </div>
        <div class="sandbox-body">
          <div class="task-panel">
            <div class="task-label" id="sample-type">—</div>
            <div class="task-text" id="sample-text">Loading...</div>
            <div class="task-meta" id="sample-meta"></div>
            <p style="margin-top:16px;font-size:14px;color:var(--gray-60)" id="task-instruction"></p>
          </div>
          <div class="rating-panel">
            <h4>Rate This Sample</h4>
            <div id="rating-rows"></div>
            <div class="confidence-row">
              <span class="confidence-label">How confident are you?</span>
              <div class="confidence-opts" id="confidence-opts"></div>
            </div>
          </div>
          <div class="notes-panel">
            <textarea id="annotator-notes" placeholder="Add notes, flag reasons, or edge-case observations…" rows="3"></textarea>
          </div>
          <div class="feedback-panel" id="feedback-panel">
            <button class="btn btn-outline-dark" id="show-feedback-btn">Compare to Reference Annotation</button>
            <div id="feedback-content" style="display:none;"></div>
          </div>
          <div class="sandbox-nav">
            <button class="sandbox-btn prev" id="prev-sample" disabled>← Previous</button>
            <span class="sandbox-counter" id="sandbox-counter">1 / ${SAMPLES.length}</span>
            <button class="sandbox-btn next" id="next-sample">Next →</button>
          </div>
        </div>
      </div>
      <div id="session-summary">
        <h3>Session Complete 🎉</h3>
        <p>You have annotated all samples in this training session.</p>
        <div class="summary-stats">
          <div class="stat-item">
            <span class="stat-num" id="stat-annotated">0</span>
            <span class="stat-desc">Samples Annotated</span>
          </div>
          <div class="stat-item">
            <span class="stat-num" id="stat-flagged">0</span>
            <span class="stat-desc">Items Flagged</span>
          </div>
          <div class="stat-item">
            <span class="stat-num" id="stat-avg">—</span>
            <span class="stat-desc">Avg. Rating</span>
          </div>
        </div>
        <p style="color:var(--gray-60);font-size:14px;">Great work, annotator. Your session data has been recorded locally.</p>
        <button class="btn btn-primary" id="restart-sandbox" style="margin-top:24px;">Annotate Again</button>
      </div>
    `;
    trainingWorkspace.insertAdjacentHTML('beforeend', sandboxHTML);

    function buildRatingRows() {
      const container = $('#rating-rows');
      container.innerHTML = '';
      DIMENSIONS.forEach(dim => {
        const row = document.createElement('div');
        row.className = 'rating-row';
        row.dataset.dim = dim;

        const label = document.createElement('span');
        label.className = 'rating-label';
        label.textContent = dim;

        const stars = document.createElement('div');
        stars.className = 'rating-stars';
        for (let i = 1; i <= 5; i++) {
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'star-btn';
          btn.dataset.value = i;
          btn.textContent = '★';
          btn.title = `${i} star${i > 1 ? 's' : ''}`;
          btn.addEventListener('click', () => {
            $$('.star-btn', stars).forEach(b => b.classList.toggle('selected', +b.dataset.value <= i));
            saveCurrentRating(dim, i);
          });
          stars.appendChild(btn);
        }

        const flagBtn = document.createElement('button');
        flagBtn.type = 'button';
        flagBtn.className = 'flag-btn';
        flagBtn.innerHTML = '<i class="fa-solid fa-flag"></i> Flag';
        flagBtn.addEventListener('click', () => {
          flagBtn.classList.toggle('flagged');
          saveCurrentFlag(flagBtn.classList.contains('flagged'));
        });

        row.appendChild(label);
        row.appendChild(stars);
        row.appendChild(flagBtn);
        container.appendChild(row);
      });

      // Confidence selector
      const confContainer = $('#confidence-opts');
      confContainer.innerHTML = '';
      CONFIDENCE_LEVELS.forEach(level => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'confidence-btn';
        btn.dataset.level = level;
        btn.textContent = level;
        btn.addEventListener('click', () => {
          $$('.confidence-btn', confContainer).forEach(b => b.classList.remove('selected'));
          btn.classList.add('selected');
          saveCurrentConfidence(level);
        });
        confContainer.appendChild(btn);
      });
    }

    function saveCurrentRating(dim, value) {
      const id = SAMPLES[currentIndex].id;
      if (!ratings[id]) ratings[id] = { dims: {}, flagged: false, notes: '', confidence: null };
      ratings[id].dims[dim] = value;
      persistProgress();
      updateProgressBar();
    }

    function saveCurrentFlag(flagged) {
      const id = SAMPLES[currentIndex].id;
      if (!ratings[id]) ratings[id] = { dims: {}, flagged: false, notes: '', confidence: null };
      ratings[id].flagged = flagged;
      persistProgress();
    }

    function saveCurrentConfidence(level) {
      const id = SAMPLES[currentIndex].id;
      if (!ratings[id]) ratings[id] = { dims: {}, flagged: false, notes: '', confidence: null };
      ratings[id].confidence = level;
      persistProgress();
    }

    function saveNotes() {
      const id = SAMPLES[currentIndex].id;
      if (!ratings[id]) ratings[id] = { dims: {}, flagged: false, notes: '', confidence: null };
      ratings[id].notes = $('#annotator-notes').value;
      persistProgress();
    }

    function isSampleRated(id) {
      const r = ratings[id];
      return !!r && DIMENSIONS.every(d => r.dims && r.dims[d]);
    }

    function updateProgressBar() {
      const completed = SAMPLES.filter(s => isSampleRated(s.id)).length;
      const pct = Math.round((completed / SAMPLES.length) * 100);
      const fill = $('#training-bar-fill');
      const label = $('#training-progress-label');
      if (fill) fill.style.width = pct + '%';
      if (label) label.textContent = `${completed} / ${SAMPLES.length} completed`;
    }

    function restoreState() {
      const id   = SAMPLES[currentIndex].id;
      const state = ratings[id] || { dims: {}, flagged: false, notes: '', confidence: null };

      // Restore star ratings
      DIMENSIONS.forEach(dim => {
        const savedVal = state.dims[dim] || 0;
        const rows = $$('.rating-row', $('#rating-rows'));
        rows.forEach(row => {
          if (row.dataset.dim !== dim) return;
          $$('.star-btn', row).forEach(btn => {
            btn.classList.toggle('selected', +btn.dataset.value <= savedVal);
          });
          // Restore flag
          const flagBtn = $('.flag-btn', row);
          if (flagBtn) flagBtn.classList.toggle('flagged', state.flagged);
        });
      });

      // Restore confidence
      $$('.confidence-btn', $('#confidence-opts')).forEach(btn => {
        btn.classList.toggle('selected', btn.dataset.level === state.confidence);
      });

      $('#annotator-notes').value = state.notes || '';

      // Reset feedback panel for this sample
      $('#feedback-content').style.display = 'none';
      $('#feedback-content').innerHTML = '';
      $('#show-feedback-btn').style.display = 'inline-block';
    }

    function renderFeedback() {
      const s = SAMPLES[currentIndex];
      const id = s.id;
      const state = ratings[id] || { dims: {} };
      const rowsHTML = DIMENSIONS.map(dim => {
        const mine = state.dims[dim] || '—';
        const gold = s.gold[dim];
        const diff = (typeof mine === 'number') ? Math.abs(mine - gold) : null;
        const matchClass = diff === null ? '' : diff === 0 ? 'match' : diff === 1 ? 'close' : 'off';
        return `
          <div class="feedback-row ${matchClass}">
            <span class="feedback-dim">${dim}</span>
            <span class="feedback-mine">You: ${mine}★</span>
            <span class="feedback-gold">Reference: ${gold}★</span>
          </div>`;
      }).join('');

      $('#feedback-content').innerHTML = `
        ${rowsHTML}
        <p class="feedback-tip"><strong>Guideline note:</strong> ${s.tip}</p>
      `;
      $('#feedback-content').style.display = 'block';
      $('#show-feedback-btn').style.display = 'none';
    }

    function renderSample() {
      const s = SAMPLES[currentIndex];
      $('#sample-type').textContent  = s.type;
      $('#sample-text').textContent  = s.text;
      $('#task-instruction').textContent = s.task;
      $('#sandbox-counter').textContent  = `${currentIndex + 1} / ${SAMPLES.length}`;

      // Meta tags
      const meta = $('#sample-meta');
      meta.innerHTML = `
        <span class="task-tag">${s.type}</span>
        <span class="task-tag">${s.language}</span>
        <span class="task-tag">Sample #${s.id}</span>
      `;

      buildRatingRows();
      restoreState();
      updateProgressBar();

      $('#prev-sample').disabled = currentIndex === 0;
      $('#next-sample').textContent = currentIndex === SAMPLES.length - 1 ? 'Finish Session ✓' : 'Next →';
      $('#next-sample').className = currentIndex === SAMPLES.length - 1
        ? 'sandbox-btn finish' : 'sandbox-btn next';

      persistProgress();
    }

    function showSummary() {
      saveNotes();
      document.getElementById('annotation-sandbox').style.display = 'none';
      const bar = $('#training-progress-bar');
      if (bar) bar.style.display = 'none';

      const total      = SAMPLES.length;
      const annotated  = Object.keys(ratings).length;
      const flaggedCt  = Object.values(ratings).filter(r => r.flagged).length;

      let totalStars = 0, starCount = 0;
      Object.values(ratings).forEach(r => {
        Object.values(r.dims).forEach(v => { totalStars += v; starCount++; });
      });
      const avg = starCount ? (totalStars / starCount).toFixed(1) : '—';

      $('#stat-annotated').textContent = annotated;
      $('#stat-flagged').textContent   = flaggedCt;
      $('#stat-avg').textContent       = avg;
      $('#session-summary').classList.add('active');

      // Try to save to localStorage
      try {
        localStorage.setItem('ada_session_' + Date.now(), JSON.stringify({
          date: new Date().toISOString(),
          annotated, flaggedCt, avg, ratings,
        }));
        localStorage.removeItem(SAVE_KEY);
      } catch(e) {}
    }

    // Event: Next / Finish
    $('#next-sample').addEventListener('click', () => {
      saveNotes();
      if (currentIndex < SAMPLES.length - 1) {
        currentIndex++;
        renderSample();
      } else {
        showSummary();
      }
    });

    // Event: Previous
    $('#prev-sample').addEventListener('click', () => {
      saveNotes();
      if (currentIndex > 0) {
        currentIndex--;
        renderSample();
      }
    });

    // Auto-save notes on change
    $('#annotator-notes').addEventListener('input', saveNotes);

    // Compare to reference annotation
    $('#show-feedback-btn').addEventListener('click', renderFeedback);

    // Restart
    $('#restart-sandbox').addEventListener('click', () => {
      currentIndex = 0;
      Object.keys(ratings).forEach(k => delete ratings[k]);
      try { localStorage.removeItem(SAVE_KEY); } catch (e) {}
      $('#session-summary').classList.remove('active');
      document.getElementById('annotation-sandbox').style.display = 'block';
      const bar = $('#training-progress-bar');
      if (bar) bar.style.display = 'block';
      renderSample();
    });

    renderSample();
  }

  // ── Certificate Generator ───────────────────────────────────
  const certGenBtn = $('#generate-cert-btn');
  if (certGenBtn) {
    initCertificateGenerator();
  }

  function initCertificateGenerator() {
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
      if (!ensureName()) return;
      drawCertificate();
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
