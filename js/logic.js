// Harmonium BD \u2014 pure logic (no DOM, no audio). Safe to require() in Node.
// MIDI note numbers: C4 (middle C, Sa at default octave) = 60.
'use strict';
(function (root) {
  var WESTERN = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  // Sargam per pitch class. '-' = komal (flat), '+' = tivra (sharp).
  var SARGAM = ['Sa', 'Re-', 'Re', 'Ga-', 'Ga', 'Ma', 'Ma+', 'Pa', 'Dha-', 'Dha', 'Ni-', 'Ni'];
  var WHITE_PC = { 0: true, 2: true, 4: true, 5: true, 7: true, 9: true, 11: true };

  function freqOf(midi) {
    return 440 * Math.pow(2, (midi - 69) / 12);
  }
  function pcOf(midi) { return ((midi % 12) + 12) % 12; }
  function octaveOf(midi) { return Math.floor(midi / 12) - 1; }
  function isWhite(midi) { return !!WHITE_PC[pcOf(midi)]; }
  function labelOf(midi, mode) {
    var pc = pcOf(midi);
    var name = (mode === 'western') ? WESTERN[pc] : SARGAM[pc];
    return name + octaveOf(midi);
  }
  function sargamOf(midi) { return SARGAM[pcOf(midi)]; }
  function westernOf(midi) { return WESTERN[pcOf(midi)]; }

  // Octave shift: -1 => Sa = C3 (48), 0 => C4 (60), +1 => C5 (72).
  function baseMidiForShift(shift) {
    var s = Math.max(-1, Math.min(1, shift || 0));
    return 60 + s * 12;
  }
  function clampShift(shift) { return Math.max(-1, Math.min(1, shift || 0)); }
  function clampVolume(v) {
    var n = Math.round(Number(v));
    if (isNaN(n)) return 70;
    return Math.max(0, Math.min(100, n));
  }

  // Computer-keyboard map: semitone offset from the current base note.
  // Lower row plays octave 1, upper row plays octave 2.
  var KEY_MAP = {
    z: 0, s: 1, x: 2, d: 3, c: 4, v: 5, g: 6, b: 7, h: 8, n: 9, j: 10, m: 11,
    q: 12, '2': 13, w: 14, '3': 15, e: 16, r: 17, '5': 18, t: 19, '6': 20, y: 21, '7': 22, u: 23
  };
  function midiForKey(key, baseMidi) {
    if (typeof key !== 'string') return null;
    var off = KEY_MAP[key.toLowerCase()];
    if (off === undefined) return null;
    return baseMidi + off;
  }
  function keyForOffset(off) {
    for (var k in KEY_MAP) { if (KEY_MAP[k] === off) return k; }
    return null;
  }

  // Recording: { events: [{midi, at}] }, at = ms since recording start.
  function createRecording() { return { events: [] }; }
  function addEvent(rec, midi, at) {
    if (!rec || !Array.isArray(rec.events)) return false;
    midi = Math.round(Number(midi)); at = Number(at);
    if (isNaN(midi) || midi < 0 || midi > 127 || isNaN(at) || at < 0) return false;
    rec.events.push({ midi: midi, at: Math.round(at) });
    return true;
  }
  function recordingDuration(rec) {
    if (!rec || !rec.events.length) return 0;
    var last = rec.events[rec.events.length - 1];
    return last.at + 400; // trailing ring-out allowance
  }
  function serializeRecording(rec) { return JSON.stringify(rec); }
  function parseRecording(json) {
    try {
      var obj = JSON.parse(json);
      if (!obj || !Array.isArray(obj.events) || obj.events.length > 5000) return null;
      for (var i = 0; i < obj.events.length; i++) {
        var e = obj.events[i];
        if (!e || !Number.isInteger(e.midi) || e.midi < 0 || e.midi > 127 ||
            typeof e.at !== 'number' || e.at < 0) return null;
      }
      return { events: obj.events.map(function (e) { return { midi: e.midi, at: Math.round(e.at) }; }) };
    } catch (e) { return null; }
  }

  // Practice exercises: semitone offsets from the base note. All original
  // practice patterns (scales / alankars), not transcriptions of songs.
  var EXERCISES = {
    scale: [0, 2, 4, 5, 7, 9, 11, 12, 12, 11, 9, 7, 5, 4, 2, 0],
    alankar: [0, 2, 4, 2, 0, 2, 4, 5, 4, 2, 4, 5, 7, 5, 4, 5, 7, 9, 7, 5],
    phrase: [7, 5, 4, 2, 0, 0, 2, 4, 5, 7, 7, 9, 11, 12, 11, 9, 7, 5, 4, 2, 0]
  };
  var TEMPOS = { slow: 420, medium: 260, fast: 160 };
  function exerciseNotes(id, baseMidi) {
    var seq = EXERCISES[id];
    if (!seq) return null;
    return seq.map(function (off) { return baseMidi + off; });
  }

  var api = {
    WESTERN: WESTERN, SARGAM: SARGAM, KEY_MAP: KEY_MAP, EXERCISES: EXERCISES, TEMPOS: TEMPOS,
    freqOf: freqOf, pcOf: pcOf, octaveOf: octaveOf, isWhite: isWhite,
    labelOf: labelOf, sargamOf: sargamOf, westernOf: westernOf,
    baseMidiForShift: baseMidiForShift, clampShift: clampShift, clampVolume: clampVolume,
    midiForKey: midiForKey, keyForOffset: keyForOffset,
    createRecording: createRecording, addEvent: addEvent,
    recordingDuration: recordingDuration, serializeRecording: serializeRecording,
    parseRecording: parseRecording, exerciseNotes: exerciseNotes
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.HarmoniumLogic = api;
})(typeof window !== 'undefined' ? window : globalThis);
