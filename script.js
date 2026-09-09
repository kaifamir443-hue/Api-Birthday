(() => {
  'use strict';

  const PIN = '0909';
  let enteredPin = '';
  let isMuted = false;

  const screens = document.querySelectorAll('.screen');
  const audio = document.getElementById('birthdaySong');
  const muteBtn = document.getElementById('muteBtn');

  function showScreen(name) {
    screens.forEach(s => s.classList.toggle('is-active', s.dataset.screen === name));
    window.scrollTo(0, 0);
  }

  /* =========================================================
     SOUND ENGINE — short synthesized tones/effects, no files needed
     ========================================================= */

  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  const actx = AudioCtx ? new AudioCtx() : null;

  function unlockAudio() {
    if (actx && actx.state === 'suspended') actx.resume();
  }
  ['pointerdown', 'keydown'].forEach(evt => document.addEventListener(evt, unlockAudio, { once: true }));

  function tone({ freq = 440, duration = 0.15, type = 'sine', peak = 0.16, delay = 0, glideTo = null }) {
    if (!actx || isMuted) return;
    const t0 = actx.currentTime + delay;
    const osc = actx.createOscillator();
    const gain = actx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (glideTo) osc.frequency.exponentialRampToValueAtTime(glideTo, t0 + duration);
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(peak, t0 + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    osc.connect(gain).connect(actx.destination);
    osc.start(t0);
    osc.stop(t0 + duration + 0.05);
  }

  function chord(freqs, duration = 0.5, delay = 0, peak = 0.12) {
    freqs.forEach(f => tone({ freq: f, duration, peak, delay, type: 'sine' }));
  }

  function noiseBurst({ duration = 0.25, peak = 0.18, filterFreq = 1800, delay = 0 } = {}) {
    if (!actx || isMuted) return;
    const t0 = actx.currentTime + delay;
    const bufferSize = actx.sampleRate * duration;
    const buffer = actx.createBuffer(1, bufferSize, actx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
    const src = actx.createBufferSource();
    src.buffer = buffer;
    const filter = actx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = filterFreq;
    const gain = actx.createGain();
    gain.gain.setValueAtTime(peak, t0);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    src.connect(filter).connect(gain).connect(actx.destination);
    src.start(t0);
  }

  const sfx = {
    click: () => tone({ freq: 1050, duration: 0.06, type: 'sine', peak: 0.14 }),
    back: () => tone({ freq: 420, duration: 0.07, type: 'sine', peak: 0.12 }),
    error: () => { tone({ freq: 300, duration: 0.18, type: 'sawtooth', peak: 0.1 }); tone({ freq: 220, duration: 0.22, type: 'sawtooth', peak: 0.1, delay: 0.15 }); },
    success: () => chord([523.25, 659.25, 783.99], 0.5),
    warning: () => tone({ freq: 160, duration: 0.9, type: 'triangle', peak: 0.1, glideTo: 90 }),
    tick: () => tone({ freq: 900, duration: 0.04, type: 'square', peak: 0.05 }),
    fanfare: () => { chord([523.25, 659.25, 783.99, 1046.5], 0.7, 0, 0.11); noiseBurst({ duration: 0.4, peak: 0.12, delay: 0.05 }); },
    pop: () => noiseBurst({ duration: 0.2, peak: 0.16, filterFreq: 2400 }),
    notification: () => { tone({ freq: 880, duration: 0.14, peak: 0.13 }); tone({ freq: 1174.7, duration: 0.18, peak: 0.13, delay: 0.12 }); },
    ding: () => tone({ freq: 1318.5, duration: 0.4, type: 'sine', peak: 0.14 }),
    connect: () => tone({ freq: 700, duration: 0.12, peak: 0.13, glideTo: 1000 }),
    hangup: () => tone({ freq: 500, duration: 0.3, peak: 0.12, glideTo: 200 }),
    pageTurn: () => noiseBurst({ duration: 0.35, peak: 0.09, filterFreq: 3200 }),
    whoosh: () => tone({ freq: 300, duration: 0.25, type: 'sine', peak: 0.1, glideTo: 700 }),
  };

  let ringInterval = null;
  function startRingtone() {
    if (isMuted) return;
    stopRingtone();
    const ringOnce = () => { tone({ freq: 900, duration: 0.4, peak: 0.13 }); tone({ freq: 900, duration: 0.4, peak: 0.13, delay: 0.5 }); };
    ringOnce();
    ringInterval = setInterval(ringOnce, 1900);
  }
  function stopRingtone() {
    if (ringInterval) { clearInterval(ringInterval); ringInterval = null; }
  }

  /* =========================================================
     VOICE ENGINE — speechSynthesis with a graceful fallback
     ========================================================= */

  const hasSpeech = 'speechSynthesis' in window;
  let chosenVoice = null;

  function pickVoice() {
    if (!hasSpeech) return;
    const voices = speechSynthesis.getVoices();
    if (!voices.length) return;
    chosenVoice = voices.find(v => /female/i.test(v.name) && /en/i.test(v.lang))
      || voices.find(v => /en-US|en_US/i.test(v.lang))
      || voices.find(v => /en/i.test(v.lang))
      || voices[0];
  }
  if (hasSpeech) {
    pickVoice();
    speechSynthesis.addEventListener('voiceschanged', pickVoice);
  }

  // Speak a single line, fire-and-forget alongside animations that don't need to sync to it.
  function speak(text) {
    if (isMuted || !hasSpeech) return;
    const utter = new SpeechSynthesisUtterance(text);
    if (chosenVoice) utter.voice = chosenVoice;
    utter.rate = 0.97;
    utter.pitch = 1.05;
    utter.volume = 0.95;
    speechSynthesis.speak(utter);
  }

  // Speak a sequence of lines, revealing each one (via revealFn) exactly when it starts
  // being spoken. Falls back to timed reveals if speech is unavailable or muted.
  function speakSequence(lines, revealFn, doneFn) {
    if (isMuted || !hasSpeech) {
      lines.forEach((line, i) => setTimeout(() => revealFn(line, i), i * 950));
      setTimeout(() => doneFn && doneFn(), lines.length * 950 + 500);
      return;
    }
    speechSynthesis.cancel();
    lines.forEach((line, i) => {
      const text = typeof line === 'string' ? line : line.text;
      const utter = new SpeechSynthesisUtterance(text);
      if (chosenVoice) utter.voice = chosenVoice;
      utter.rate = 0.97;
      utter.pitch = 1.05;
      utter.volume = 0.95;
      utter.onstart = () => revealFn(line, i);
      if (i === lines.length - 1) {
        utter.onend = () => doneFn && doneFn();
        utter.onerror = () => doneFn && doneFn();
      }
      speechSynthesis.speak(utter);
    });
  }

  // Reveal a sequence of lines on a timer, with no speech synthesis involved.
  // Used for every narrated section except the fake call, which is the only
  // place the voice should still be heard.
  function revealSequence(lines, revealFn, doneFn, gap = 950) {
    lines.forEach((line, i) => setTimeout(() => revealFn(line, i), i * gap));
    setTimeout(() => doneFn && doneFn(), lines.length * gap + 500);
  }

  /* =========================================================
     MUTE CONTROL
     ========================================================= */

  muteBtn.addEventListener('click', () => {
    isMuted = !isMuted;
    muteBtn.textContent = isMuted ? '🔇' : '🔊';
    stopRingtone();
    if (hasSpeech) speechSynthesis.cancel();
    audio.muted = isMuted;
    if (!isMuted && !audio.paused) audio.play().catch(() => {});
  });

  /* ---------------- SCREEN 1 : LOCK ---------------- */

  const dotsWrap = document.getElementById('dots');
  const dots = dotsWrap.querySelectorAll('.dot');
  const lockStatus = document.getElementById('lockStatus');
  const keypad = document.getElementById('keypad');

  function refreshDots() {
    dots.forEach((d, i) => d.classList.toggle('is-filled', i < enteredPin.length));
  }

  function resetPin() {
    enteredPin = '';
    refreshDots();
  }

  function handleKey(key) {
    if (key === 'back') {
      sfx.back();
      enteredPin = enteredPin.slice(0, -1);
      refreshDots();
      return;
    }
    if (key === 'clear') {
      sfx.back();
      resetPin();
      lockStatus.textContent = '';
      lockStatus.className = 'status';
      return;
    }
    if (enteredPin.length >= 4) return;
    sfx.click();
    enteredPin += key;
    refreshDots();

    if (enteredPin.length === 4) {
      setTimeout(checkPin, 200);
    }
  }

  function checkPin() {
    if (enteredPin === PIN) {
      sfx.success();
      lockStatus.textContent = '🔓 ACCESS GRANTED — Welcome, Birthday Queen 👑';
      lockStatus.className = 'status status--success';
      keypad.querySelectorAll('.key').forEach(k => k.disabled = true);
      setTimeout(() => {
        showScreen('drama');
        runDramaSequence();
      }, 1700);
    } else {
      sfx.error();
      lockStatus.textContent = '❌ ACCESS DENIED — Api… seriously? 😭';
      lockStatus.className = 'status status--error';
      setTimeout(() => {
        resetPin();
        lockStatus.textContent = "Hint: It's September 9th 👀";
        lockStatus.className = 'status';
      }, 1300);
    }
  }

  keypad.addEventListener('click', (e) => {
    const btn = e.target.closest('.key');
    if (!btn) return;
    handleKey(btn.dataset.key);
  });

  window.addEventListener('keydown', (e) => {
    if (!document.querySelector('[data-screen="lock"]').classList.contains('is-active')) return;
    if (/^[0-9]$/.test(e.key)) handleKey(e.key);
    if (e.key === 'Backspace') handleKey('back');
  });

  /* ---------------- SCREEN 2 : DRAMA ---------------- */

  const dramaSteps = {
    warning: document.querySelector('[data-step="warning"]'),
    loading: document.querySelector('[data-step="loading"]'),
    reveal: document.querySelector('[data-step="reveal"]'),
  };
  const loadingFill = document.getElementById('loadingFill');
  const loadingPct = document.getElementById('loadingPct');
  const toHomeBtn = document.getElementById('toHomeBtn');

  function runDramaSequence() {
    dramaSteps.warning.hidden = false;
    dramaSteps.loading.hidden = true;
    dramaSteps.reveal.hidden = true;
    loadingFill.style.width = '0%';
    loadingPct.textContent = '0%';

    sfx.warning();

    setTimeout(() => {
      dramaSteps.warning.hidden = true;
      dramaSteps.loading.hidden = false;
      let pct = 0;
      const step = setInterval(() => {
        pct += 4 + Math.random() * 6;
        sfx.tick();
        if (pct >= 100) {
          pct = 100;
          clearInterval(step);
          setTimeout(() => {
            dramaSteps.loading.hidden = true;
            dramaSteps.reveal.hidden = false;
            sfx.fanfare();
            burstConfetti();
          }, 350);
        }
        loadingFill.style.width = pct + '%';
        loadingPct.textContent = Math.round(pct) + '%';
      }, 110);
    }, 1900);
  }

  toHomeBtn.addEventListener('click', () => { sfx.click(); showScreen('home'); playHomeArrival(); });

  /* ---------------- SCREEN 3 : HOME ---------------- */

  function playHomeArrival() {
    setTimeout(() => {
      sfx.notification();
    }, 350);
  }

  // Track whether awards/call/secret were opened from the home icon (so back button works)
  // vs from the linear notification flow (where they chain to each other).
  let fromHomeIcon = false;

  function goBackToHome() {
    sfx.back();
    stopRingtone();
    if (hasSpeech) speechSynthesis.cancel();
    fromHomeIcon = false;
    showScreen('home');
  }

  // Wire the 4 app-icon buttons on the home screen
  document.querySelector('.app-grid').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-app]');
    if (!btn) return;
    sfx.click();
    fromHomeIcon = true;
    const app = btn.dataset.app;
    if (app === 'awards') { showScreen('awards'); startAwards(); }
    if (app === 'call')   { showScreen('call'); startRinging(); }
    if (app === 'secret') { resetSecretScreen(); showScreen('secret'); }
    if (app === 'gift')   { showScreen('gift'); startGifts(); }
  });

  document.getElementById('openNotifBtn').addEventListener('click', () => {
    sfx.click();
    fromHomeIcon = false;
    showScreen('awards');
    startAwards();
  });

  /* ---------------- SCREEN 4 : AWARDS ---------------- */

  const awards = [
    { emoji: '🏆', title: 'BEST API AWARD', desc: 'Because obviously. There was literally no competition. 😂' },
    { emoji: '😤', title: 'PROFESSIONAL GUSSA SPECIALIST', desc: 'Years of experience. Zero competition. 😂' },
    { emoji: '🗣️', title: "WORLD'S BEST ADVICE GIVER", desc: 'Advice nobody asked for… but somehow was always needed. 😂' },
    { emoji: '😂', title: '"MERI BAAT SUNO."', desc: 'A legendary phrase. Heard approximately 8,492 times. 😭' },
    { emoji: '🍕', title: 'BEST TREAT AVOIDER', desc: 'Birthday treat pending since… forever. 😂' },
    { emoji: '👑', title: 'CEO OF BEING RIGHT', desc: 'Qualification: Api hona. Experience: Apparently unlimited. 😭😂' },
  ];
  let awardIndex = 0;

  const awardCard = document.getElementById('awardCard');
  const awardEmoji = document.getElementById('awardEmoji');
  const awardTitle = document.getElementById('awardTitle');
  const awardDesc = document.getElementById('awardDesc');
  const awardCongrats = document.getElementById('awardCongrats');
  const awardNextBtn = document.getElementById('awardNextBtn');

  function startAwards() {
    awardIndex = 0;
    awardCongrats.hidden = true;
    awardCard.hidden = false;
    renderAward();
    awardNextBtn.textContent = 'NEXT →';
  }

  function renderAward() {
    const a = awards[awardIndex];
    awardEmoji.textContent = a.emoji;
    awardTitle.textContent = a.title;
    awardDesc.textContent = a.desc;
    awardCard.style.animation = 'none';
    void awardCard.offsetWidth;
    awardCard.style.animation = '';
    sfx.ding();
  }

  awardNextBtn.addEventListener('click', () => {
    sfx.click();
    if (awardCongrats.hidden === false) {
      if (fromHomeIcon) { goBackToHome(); return; }
      showScreen('call');
      startRinging();
      return;
    }
    awardIndex++;
    if (awardIndex >= awards.length) {
      awardCard.hidden = true;
      awardCongrats.hidden = false;
      awardNextBtn.textContent = fromHomeIcon ? '← Back to Phone' : 'NEXT SURPRISE →';
      sfx.fanfare();
    } else {
      renderAward();
    }
  });

  document.getElementById('awardBackBtn').addEventListener('click', goBackToHome);

  /* ---------------- SCREEN 5 : CALL ---------------- */

  const callStates = {
    ringing: document.querySelector('[data-state="ringing"]'),
    nag: document.querySelector('[data-state="nag"]'),
    connected: document.querySelector('[data-state="connected"]'),
  };
  const callTranscript = document.getElementById('callTranscript');
  const endCallBtn = document.getElementById('endCallBtn');

  function showCallState(name) {
    Object.entries(callStates).forEach(([k, el]) => el.hidden = k !== name);
  }

  function startRinging() {
    showCallState('ringing');
    startRingtone();
  }

  document.getElementById('callInner').addEventListener('click', (e) => {
    const action = e.target.closest('[data-action]')?.dataset.action;
    if (!action) return;
    sfx.click();
    if (action === 'decline') showCallState('nag');
    if (action === 'decline-again') showCallState('nag');
    if (action === 'answer') { stopRingtone(); sfx.connect(); startTranscript(); }
  });

  const transcriptLines = [
    { text: 'Hello Api…' },
    { text: 'This is an automated birthday call.' },
    { text: 'We have an important announcement for you.' },
    { text: 'Today is your birthday.' },
    { text: 'Yes, we checked.' },
    { text: 'Your birthday status has been upgraded to:' },
    { text: 'Birthday Queen.', emph: true },
    { text: 'Thank you for choosing our birthday service.' },
    { text: 'Have a wonderful day.' },
  ];

  function startTranscript() {
    showCallState('connected');
    callTranscript.innerHTML = '';
    endCallBtn.hidden = true;

    speakSequence(
      transcriptLines,
      (line) => {
        const p = document.createElement('p');
        p.className = 'call-line' + (line.emph ? ' call-line--emph' : '');
        p.textContent = line.text;
        callTranscript.appendChild(p);
        requestAnimationFrame(() => p.classList.add('is-visible'));
      },
      () => { endCallBtn.hidden = false; }
    );
  }

  endCallBtn.addEventListener('click', () => {
    sfx.hangup();
    if (fromHomeIcon) { goBackToHome(); return; }
    showScreen('secret');
  });

  document.getElementById('callBackBtn').addEventListener('click', () => {
    stopRingtone();
    if (hasSpeech) speechSynthesis.cancel();
    goBackToHome();
  });

  /* ---------------- SCREEN 6 : SECRET MESSAGE ---------------- */

  const secretIntro = document.getElementById('secretIntro');
  const letterEl = document.getElementById('letter');
  const letterLines = document.getElementById('letterLines');
  const toFinalBtn = document.getElementById('toFinalBtn');

  const messageParagraphs = [
    'Happy Birthday Apiii!',
    "Allah aapko hamesha khush rakhe, sehat, sukoon aur bohat saari khushiyan de. Aapki har dua qabool ho aur aapki life mein hamesha happiness rahe.",
    "Waise toh aaj aapka birthday hai, isliye aaj ke din main aapki tareef hi karunga… warna baaki 364 din toh aapko tang karna mera farz hai. Aap officially ek saal aur experienced ho gayi ho, lekin tension lene ki zaroorat nahi… age sirf ek number hai, aur main woh number kisi ko nahi bataunga.",
    "I hope aapka ye saal pichle saal se bhi zyada amazing ho, bohat saari achi memories banein, aur aapko woh sab mile jo aap deserve karti ho.",
    "Aur haan, birthday treat ka intezam jaldi karna… birthday aapka hai, lekin excitement mujhe treat ki hai.",
    "Once again, Happy Birthday Api! Allah hamesha aapko khush rakhe aur aapki smile kabhi kam na ho. Love youuu!",
  ];
  // Full text with emojis is what's displayed; speech uses the plain versions above for clean narration.
  const messageDisplay = [
    'Happy Birthday Apiii! 🥳❤️😂',
    "Allah aapko hamesha khush rakhe, sehat, sukoon aur bohat saari khushiyan de. Aapki har dua qabool ho aur aapki life mein hamesha happiness rahe. ❤️✨",
    "Waise toh aaj aapka birthday hai, isliye aaj ke din main aapki tareef hi karunga… warna baaki 364 din toh aapko tang karna mera farz hai. 😂😭 Aap officially ek saal aur experienced ho gayi ho, lekin tension lene ki zaroorat nahi… age sirf ek number hai, aur main woh number kisi ko nahi bataunga. 🤐🤣",
    "I hope aapka ye saal pichle saal se bhi zyada amazing ho, bohat saari achi memories banein, aur aapko woh sab mile jo aap deserve karti ho. 🫶🏻✨",
    "Aur haan, birthday treat ka intezam jaldi karna… birthday aapka hai, lekin excitement mujhe treat ki hai. 😌😂",
    "Once again, Happy Birthday Api! 🥳❤️ Allah hamesha aapko khush rakhe aur aapki smile kabhi kam na ho. Love youuu! ❤️🫶🏻😂",
  ];

  function resetSecretScreen() {
    secretIntro.hidden = false;
    letterEl.hidden = true;
    letterLines.innerHTML = '';
    toFinalBtn.hidden = true;
  }

  document.getElementById('secretBackBtn').addEventListener('click', goBackToHome);

  document.getElementById('openMessageBtn').addEventListener('click', () => {
    sfx.click();
    sfx.pageTurn();
    secretIntro.hidden = true;
    letterEl.hidden = false;
    letterLines.innerHTML = '';
    toFinalBtn.hidden = true;

    const speechLines = messageParagraphs.map((text, i) => ({ text, i }));
    revealSequence(
      speechLines,
      (line) => {
        const p = document.createElement('p');
        p.className = 'letter-line';
        p.textContent = messageDisplay[line.i];
        letterLines.appendChild(p);
        requestAnimationFrame(() => p.classList.add('is-visible'));
      },
      () => { toFinalBtn.hidden = false; }
    );
  });

  toFinalBtn.addEventListener('click', () => {
    sfx.click();
    if (fromHomeIcon) { goBackToHome(); return; }
    showScreen('final');
    startBalloons();
    startAmbientScraps();
  });

  /* ---------------- SCREEN 6b : GIFT ---------------- */

  const giftMessages = [
    'Your first gift:\nA lifetime supply of my annoying presence. 😂',
    'Your second gift:\nUnlimited birthday wishes and duas. ❤️',
    'Your FINAL gift:\nA very special message…',
  ];

  let giftsOpened = 0;
  const giftReveal = document.getElementById('giftReveal');
  const giftRevealText = document.getElementById('giftRevealText');
  const giftFinal = document.getElementById('giftFinal');
  const giftLoadingFill = document.getElementById('giftLoadingFill');
  const giftError = document.getElementById('giftError');

  function startGifts() {
    giftsOpened = 0;
    giftReveal.hidden = true;
    giftFinal.hidden = true;
    giftError.hidden = true;
    giftLoadingFill.style.width = '0%';
    document.querySelectorAll('.gift-box').forEach(b => {
      b.disabled = false;
      b.classList.remove('is-opened');
    });
  }

  document.getElementById('giftGrid').addEventListener('click', (e) => {
    const box = e.target.closest('.gift-box');
    if (!box || box.disabled) return;
    const idx = parseInt(box.dataset.gift, 10) - 1;
    sfx.pop();
    box.classList.add('is-opened');
    box.disabled = true;
    giftsOpened++;

    // Show the message for this gift
    giftReveal.hidden = false;
    giftRevealText.textContent = giftMessages[idx];
    giftReveal.style.animation = 'none';
    void giftReveal.offsetWidth;
    giftReveal.style.animation = '';

    // After all three opened, trigger the fake loading
    if (giftsOpened === 3) {
      setTimeout(() => {
        giftReveal.hidden = true;
        giftFinal.hidden = false;
        giftError.hidden = true;
        giftLoadingFill.style.width = '0%';
        // Fake loading bar
        let pct = 0;
        const fill = setInterval(() => {
          pct += 3 + Math.random() * 5;
          sfx.tick();
          if (pct >= 100) {
            pct = 100;
            clearInterval(fill);
            setTimeout(() => { giftError.hidden = false; sfx.error(); }, 400);
          }
          giftLoadingFill.style.width = pct + '%';
        }, 90);
      }, 1400);
    }
  });

  document.getElementById('giftBackBtn').addEventListener('click', goBackToHome);

  /* ---------------- SCREEN 7 : FINAL ---------------- */

  const cakeBtn = document.getElementById('cakeBtn');
  const finalCakeWrap = document.getElementById('finalCakeWrap');
  const finalReveal = document.getElementById('finalReveal');
  const flames = document.querySelectorAll('.flame');
  const balloonsWrap = document.getElementById('balloonsWrap');
  const popperLeft = document.getElementById('popperLeft');
  const popperRight = document.getElementById('popperRight');
  let wishMade = false;

  const balloonColors = ['#f2a7c3', '#e0779a', '#f6d3e2', '#cb9b57', '#ffd27a', '#ffffff'];
  let balloonInterval = null;

  function spawnBalloon() {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || !balloonsWrap) return;
    const b = document.createElement('div');
    b.className = 'balloon';
    const size = 34 + Math.random() * 22;
    const duration = 9 + Math.random() * 6;
    b.style.left = (4 + Math.random() * 88) + 'vw';
    b.style.width = size + 'px';
    b.style.height = (size * 1.25) + 'px';
    b.style.background = balloonColors[Math.floor(Math.random() * balloonColors.length)];
    b.style.animationDuration = duration + 's';
    balloonsWrap.appendChild(b);
    setTimeout(() => b.remove(), duration * 1000 + 200);
  }

  function startBalloons() {
    if (balloonInterval || !balloonsWrap) return;
    for (let i = 0; i < 5; i++) setTimeout(spawnBalloon, i * 550);
    balloonInterval = setInterval(spawnBalloon, 1300);
  }

  function firePoppers() {
    if (!popperLeft || !popperRight) return;
    [popperLeft, popperRight].forEach(p => {
      p.classList.remove('is-popping');
      void p.offsetWidth;
      p.classList.add('is-popping');
    });
  }

  cakeBtn.addEventListener('click', () => {
    if (wishMade) return;
    wishMade = true;
    flames.forEach((f, i) => {
      setTimeout(() => { f.classList.add('is-lit'); sfx.whoosh(); }, i * 300);
    });
    setTimeout(() => {
      finalCakeWrap.hidden = true;
      finalReveal.hidden = false;
      sfx.fanfare();
      burstConfetti();
      burstPoppers();
      firePoppers();
      setTimeout(() => startMusic(), 1800);
    }, flames.length * 300 + 500);
  });

  function startMusic() {
    audio.volume = 0.75;
    audio.muted = isMuted;
    audio.play().catch(() => { /* autoplay may still be blocked; mute button lets user retry */ });
  }

  /* ---------------- CONFETTI ---------------- */

  const canvas = document.getElementById('confettiCanvas');
  const ctx = canvas.getContext('2d');
  let particles = [];
  let confettiRunning = false;

  function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  window.addEventListener('resize', resizeCanvas);
  resizeCanvas();

  const confettiColors = ['#e0779a', '#f2c46d', '#f6a5c0', '#cb9b57', '#ffffff', '#e3c48a'];

  function burstConfetti(opts = {}) {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const originX = opts.x ?? canvas.width / 2;
    const originY = opts.y ?? canvas.height * 0.35;
    const count = opts.count ?? 90;
    const spreadX = opts.spreadX ?? 120;
    const vxBias = opts.vxBias ?? 0;
    const vxRange = opts.vxRange ?? 8;
    const vyBase = opts.vyBase ?? -8;
    for (let i = 0; i < count; i++) {
      particles.push({
        x: originX + (Math.random() - 0.5) * spreadX,
        y: originY,
        vx: vxBias + (Math.random() - 0.5) * vxRange,
        vy: Math.random() * vyBase - 2,
        size: 5 + Math.random() * 5,
        color: confettiColors[Math.floor(Math.random() * confettiColors.length)],
        rotation: Math.random() * 360,
        rotSpeed: (Math.random() - 0.5) * 10,
        life: 0,
      });
    }
    if (!confettiRunning) {
      confettiRunning = true;
      requestAnimationFrame(animateConfetti);
    }
  }

  // Two little "party poppers" firing confetti diagonally in from the bottom corners.
  function burstPoppers() {
    burstConfetti({ x: canvas.width * 0.06, y: canvas.height * 0.94, count: 60, vxBias: 7, vxRange: 6, vyBase: -12, spreadX: 30 });
    burstConfetti({ x: canvas.width * 0.94, y: canvas.height * 0.94, count: 60, vxBias: -7, vxRange: 6, vyBase: -12, spreadX: 30 });
  }

  function animateConfetti() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    particles.forEach(p => {
      if (p.drift) {
        p.sway += 0.05;
        p.x += Math.sin(p.sway) * 0.6 + p.vx;
        p.y += p.vy;
        p.rotation += p.rotSpeed;
      } else {
        p.vy += 0.18;
        p.x += p.vx;
        p.y += p.vy;
        p.rotation += p.rotSpeed;
      }
      p.life++;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate((p.rotation * Math.PI) / 180);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
      ctx.restore();
    });
    particles = particles.filter(p => p.y < canvas.height + 40 && p.life < (p.drift ? 1200 : 400));
    if (particles.length > 0) {
      requestAnimationFrame(animateConfetti);
    } else {
      confettiRunning = false;
    }
  }

  // Slow, colorful paper scraps drifting down continuously (ambient, not a burst).
  function spawnAmbientScrap() {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    particles.push({
      x: Math.random() * canvas.width,
      y: -20,
      vx: (Math.random() - 0.5) * 0.4,
      vy: 1 + Math.random() * 1.4,
      size: 5 + Math.random() * 4,
      color: confettiColors[Math.floor(Math.random() * confettiColors.length)],
      rotation: Math.random() * 360,
      rotSpeed: (Math.random() - 0.5) * 6,
      life: 0,
      drift: true,
      sway: Math.random() * Math.PI * 2,
    });
    if (!confettiRunning) {
      confettiRunning = true;
      requestAnimationFrame(animateConfetti);
    }
  }

  let ambientScrapInterval = null;
  function startAmbientScraps() {
    if (ambientScrapInterval) return;
    for (let i = 0; i < 10; i++) setTimeout(spawnAmbientScrap, i * 120);
    ambientScrapInterval = setInterval(spawnAmbientScrap, 260);
  }

  /* ---------------- INIT ---------------- */

  showScreen('lock');
})();
