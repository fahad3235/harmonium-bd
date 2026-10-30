// Harmonium BD \u2014 DOM + WebAudio app. Keys always update UI state even if
// audio is unavailable, so recording / exercises work in any browser.
'use strict';
(function () {
  var L = window.HarmoniumLogic;
  var I18N = window.HarmoniumI18N.I18N;
  var SARGAM_BN = window.HarmoniumI18N.SARGAM_BN;
  var LS_LANG = 'harmonium-bd-lang';
  var LS_SAVED = 'harmonium-bd-recordings';

  var lang = 'en';
  try { lang = localStorage.getItem(LS_LANG) || 'en'; } catch (e) { lang = 'en'; }
  if (lang !== 'bn') lang = 'en';
  var shift = 0, labelMode = 'sargam', volume = 70, sustain = false;
  var baseMidi = L.baseMidiForShift(shift);

  var audioCtx = null, masterGain = null, audioFailed = false;
  var voices = {}; // midi -> {osc1, osc2, gain}
  var recording = null, recordingActive = false, recStart = 0, recTimer = null;
  var saved = [];
  try { saved = JSON.parse(localStorage.getItem(LS_SAVED) || '[]'); if (!Array.isArray(saved)) saved = []; } catch (e) { saved = []; }
  var exerciseTimers = [], exercisePlaying = false;

  function $(id) { return document.getElementById(id); }
  function t(key) { return (I18N[lang] && I18N[lang][key]) || I18N.en[key] || key; }
  function bnDigits(s) {
    if (lang !== 'bn') return s;
    var map = ['\u09e6', '\u09e7', '\u09e8', '\u09e9', '\u09ea', '\u09eb', '\u09ec', '\u09ed', '\u09ee', '\u09ef'];
    return String(s).replace(/[0-9]/g, function (d) { return map[Number(d)]; });
  }
  function showNotice(key) { $('notice').textContent = t(key); }
  function keyLabel(midi) {
    if (labelMode === 'western') return L.westernOf(midi) + L.octaveOf(midi);
    if (lang === 'bn') return SARGAM_BN[L.pcOf(midi)] + ' ' + bnDigits(L.octaveOf(midi));
    return L.sargamOf(midi) + L.octaveOf(midi);
  }
  function kbdHintFor(offset) {
    var k = L.keyForOffset(offset);
    return k ? k.toUpperCase() : '';
  }

  function ensureAudio() {
    if (audioCtx || audioFailed) return audioCtx;
    try {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) throw new Error('no AudioContext');
      audioCtx = new AC();
      masterGain = audioCtx.createGain();
      masterGain.gain.value = volume / 100;
      masterGain.connect(audioCtx.destination);
    } catch (e) {
      audioFailed = true;
      showNotice('noticeAudio');
    }
    return audioCtx;
  }
  function noteOn(midi) {
    var el = document.querySelector('.key[data-midi="' + midi + '"]');
    if (el) el.classList.add('active');
    var freq = L.freqOf(midi);
    var name = (labelMode === 'western' ? L.westernOf(midi) : L.sargamOf(midi)) + L.octaveOf(midi);
    $('lastNote').textContent = name + ' (' + freq.toFixed(2) + ' Hz)';
    if (recordingActive && recording) L.addEvent(recording, midi, performance.now() - recStart);
    updateRecordedCount();
    if (!ensureAudio()) return;
    try {
      if (audioCtx.state === 'suspended') audioCtx.resume();
      stopVoice(midi, true);
      var osc1 = audioCtx.createOscillator(), osc2 = audioCtx.createOscillator();
      var gain = audioCtx.createGain();
      osc1.type = 'sawtooth'; osc2.type = 'triangle';
      osc1.frequency.value = freq; osc2.frequency.value = freq * 1.003;
      var g2 = audioCtx.createGain(); g2.gain.value = 0.4;
      osc1.connect(gain); osc2.connect(g2); g2.connect(gain);
      gain.connect(masterGain);
      var now = audioCtx.currentTime;
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.5, now + 0.015);
      osc1.start(now); osc2.start(now);
      voices[midi] = { osc1: osc1, osc2: osc2, gain: gain };
    } catch (e) { /* UI state already updated; audio is best-effort */ }
  }
  function stopVoice(midi, immediate) {
    var v = voices[midi];
    if (!v) return;
    delete voices[midi];
    try {
      var now = audioCtx.currentTime;
      var hold = sustain && !immediate ? 1.0 : 0.12;
      v.gain.gain.cancelScheduledValues(now);
      v.gain.gain.setValueAtTime(v.gain.gain.value, now);
      v.gain.gain.linearRampToValueAtTime(0, now + hold);
      v.osc1.stop(now + hold + 0.05); v.osc2.stop(now + hold + 0.05);
    } catch (e) { try { v.osc1.stop(); v.osc2.stop(); } catch (e2) {} }
  }
  function noteOff(midi) {
    var el = document.querySelector('.key[data-midi="' + midi + '"]');
    if (el) el.classList.remove('active');
    if (audioCtx) stopVoice(midi, false);
  }
  function stopAllVoices() {
    Object.keys(voices).forEach(function (m) { stopVoice(Number(m), true); });
    document.querySelectorAll('.key.active').forEach(function (el) { el.classList.remove('active'); });
  }

  function buildKeyboard() {
    var kb = $('keyboard');
    kb.innerHTML = '';
    baseMidi = L.baseMidiForShift(shift);
    var whites = 0;
    for (var m = baseMidi; m < baseMidi + 24; m++) if (L.isWhite(m)) whites++;
    var whiteIdx = 0;
    for (var midi = baseMidi; midi < baseMidi + 24; midi++) {
      var el = document.createElement('button');
      el.type = 'button';
      el.className = 'key ' + (L.isWhite(midi) ? 'white' : 'black');
      el.dataset.midi = String(midi);
      el.setAttribute('aria-label', keyLabel(midi));
      var off = midi - baseMidi;
      el.innerHTML = '';
      var nameSpan = document.createElement('span');
      nameSpan.textContent = keyLabel(midi);
      el.appendChild(nameSpan);
      var kbdSpan = document.createElement('span');
      kbdSpan.className = 'kbd';
      kbdSpan.textContent = kbdHintFor(off);
      el.appendChild(kbdSpan);
      if (!L.isWhite(midi)) {
        el.style.left = (whiteIdx / whites * 100) + '%';
        el.style.transform = 'translateX(-50%)';
      } else {
        whiteIdx++;
      }
      (function (mm) {
        el.addEventListener('pointerdown', function (ev) { ev.preventDefault(); noteOn(mm); });
        ['pointerup', 'pointerleave', 'pointercancel'].forEach(function (evt) {
          el.addEventListener(evt, function () { noteOff(mm); });
        });
      })(midi);
      kb.appendChild(el);
    }
  }

  function updateRecordedCount() {
    var n = recording ? recording.events.length : 0;
    $('recordedCount').textContent = n ? bnDigits(n) + ' ' + t('recordedNotes') : '';
    var st = $('recState');
    st.textContent = recordingActive ? '\u25cf REC' : '';
    st.className = 'rec-state' + (recordingActive ? ' recording' : '');
  }
  function renderSaved() {
    var list = $('savedList');
    list.innerHTML = '';
    $('noSaved').style.display = saved.length ? 'none' : '';
    saved.forEach(function (item) {
      var li = document.createElement('li');
      var span = document.createElement('span');
      span.textContent = item.name + ' (' + bnDigits(item.events.length) + ' ' + t('recordedNotes') + ')';
      var btns = document.createElement('span');
      var play = document.createElement('button');
      play.type = 'button'; play.textContent = t('playSaved');
      play.addEventListener('click', function () { playRecording(item.events); });
      var del = document.createElement('button');
      del.type = 'button'; del.textContent = t('deleteSaved');
      del.addEventListener('click', function () {
        saved = saved.filter(function (s) { return s.id !== item.id; });
        persistSaved(); renderSaved(); showNotice('noticeDeleted');
      });
      btns.appendChild(play); btns.appendChild(del);
      li.appendChild(span); li.appendChild(btns);
      list.appendChild(li);
    });
  }
  function persistSaved() {
    try { localStorage.setItem(LS_SAVED, JSON.stringify(saved)); } catch (e) {}
  }
  function playRecording(events) {
    if (!events || !events.length) { showNotice('noticeNothingToPlay'); return; }
    stopExercise();
    events.forEach(function (e) {
      setTimeout(function () { noteOn(e.midi); setTimeout(function () { noteOff(e.midi); }, 380); }, e.at);
    });
  }

  function stopExercise() {
    exerciseTimers.forEach(function (id) { clearTimeout(id); });
    exerciseTimers = [];
    exercisePlaying = false;
    document.querySelectorAll('.key.playing').forEach(function (el) { el.classList.remove('playing'); });
    $('exerciseStatus').textContent = '';
  }
  function playExercise(id) {
    var notes = L.exerciseNotes(id, baseMidi);
    if (!notes) return;
    stopExercise();
    exercisePlaying = true;
    var stepMs = L.TEMPOS[$('tempoSel').value] || 260;
    $('exerciseStatus').textContent = t('ex' + id.charAt(0).toUpperCase() + id.slice(1)) + ' ...';
    notes.forEach(function (midi, i) {
      exerciseTimers.push(setTimeout(function () {
        var el = document.querySelector('.key[data-midi="' + midi + '"]');
        if (el) el.classList.add('playing');
        noteOn(midi);
        setTimeout(function () { noteOff(midi); if (el) el.classList.remove('playing'); }, Math.min(stepMs - 20, 400));
        if (i === notes.length - 1) {
          exerciseTimers.push(setTimeout(function () { stopExercise(); showNotice('noticeExerciseDone'); }, stepMs));
        }
      }, i * stepMs));
    });
  }

  function applyLang() {
    document.querySelectorAll('[data-i18n]').forEach(function (el) {
      var key = el.getAttribute('data-i18n');
      el.textContent = t(key);
    });
    $('langBtn').textContent = t('langBtn');
    if (recordingActive) $('recordBtn').textContent = t('stopRecordBtn');
    try { localStorage.setItem(LS_LANG, lang); } catch (e) {}
    buildKeyboard();
    updateRecordedCount();
    renderSaved();
    document.documentElement.lang = lang === 'bn' ? 'bn' : 'en';
  }

  // Wiring
  $('langBtn').addEventListener('click', function () {
    lang = (lang === 'en') ? 'bn' : 'en';
    applyLang();
  });
  $('octaveSel').addEventListener('change', function () {
    shift = L.clampShift(parseInt(this.value, 10));
    stopAllVoices(); stopExercise(); buildKeyboard();
  });
  $('labelsSel').addEventListener('change', function () { labelMode = this.value; buildKeyboard(); });
  $('volumeRange').addEventListener('input', function () {
    volume = L.clampVolume(this.value);
    $('volumeVal').textContent = bnDigits(volume) + '%';
    if (masterGain) masterGain.gain.value = volume / 100;
  });
  $('sustainChk').addEventListener('change', function () { sustain = this.checked; });
  $('recordBtn').addEventListener('click', function () {
    if (recordingActive) {
      recordingActive = false;
      if (recTimer) clearInterval(recTimer);
      this.textContent = t('recordBtn');
      updateRecordedCount();
    } else {
      stopExercise();
      recording = L.createRecording();
      recordingActive = true;
      recStart = performance.now();
      this.textContent = t('stopRecordBtn');
      updateRecordedCount();
    }
  });
  $('playRecordBtn').addEventListener('click', function () {
    if (!recording || !recording.events.length) { showNotice('noticeNoRecording'); return; }
    playRecording(recording.events);
  });
  $('saveRecordBtn').addEventListener('click', function () {
    if (!recording || !recording.events.length) { showNotice('noticeNoRecording'); return; }
    var item = {
      id: Date.now(),
      name: 'Recording ' + (saved.length + 1) + ' - ' + new Date().toLocaleString(),
      events: recording.events.slice()
    };
    saved.push(item); persistSaved(); renderSaved(); showNotice('noticeSaved');
  });
  $('clearRecordBtn').addEventListener('click', function () {
    recording = null; recordingActive = false;
    $('recordBtn').textContent = t('recordBtn');
    updateRecordedCount(); showNotice('noticeCleared');
  });
  document.querySelectorAll('.ex-btn').forEach(function (btn) {
    btn.addEventListener('click', function () { playExercise(btn.getAttribute('data-ex')); });
  });
  $('stopExerciseBtn').addEventListener('click', function () { stopExercise(); showNotice('noticeExerciseStopped'); });
  document.addEventListener('keydown', function (ev) {
    if (ev.repeat || ev.metaKey || ev.ctrlKey || ev.altKey) return;
    var tag = (ev.target && ev.target.tagName) || '';
    if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
    var midi = L.midiForKey(ev.key, baseMidi);
    if (midi !== null) noteOn(midi);
  });
  document.addEventListener('keyup', function (ev) {
    var midi = L.midiForKey(ev.key, baseMidi);
    if (midi !== null) noteOff(midi);
  });

  applyLang();
})();
