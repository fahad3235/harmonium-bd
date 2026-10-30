// Harmonium BD — node unit tests. Run: node tests/test.js
'use strict';
const L = require('../js/logic.js');
let passed = 0, failed = 0;
function check(name, cond, extra) {
  if (cond) { passed++; console.log('ok - ' + name); }
  else { failed++; console.log('FAIL - ' + name + (extra ? ' :: ' + extra : '')); }
}
function close(a, b, tol) { return Math.abs(a - b) <= tol; }

// Frequencies (hand-verified: A4 = 440, C4 = 261.63, C5 = 523.25)
check('A4 = 440 Hz', close(L.freqOf(69), 440, 0.001));
check('C4 = 261.63 Hz', close(L.freqOf(60), 261.63, 0.01));
check('C5 = 523.25 Hz', close(L.freqOf(72), 523.25, 0.01));
check('C3 = 130.81 Hz', close(L.freqOf(48), 130.81, 0.01));
check('octave doubles frequency', close(L.freqOf(72), L.freqOf(60) * 2, 0.01));
check('semitone ratio', close(L.freqOf(61) / L.freqOf(60), Math.pow(2, 1 / 12), 0.0001));

// Labels
check('C4 sargam = Sa4', L.labelOf(60, 'sargam') === 'Sa4');
check('C#4 sargam = Re-4 (komal Re)', L.labelOf(61, 'sargam') === 'Re-4');
check('F#4 sargam = Ma+4 (tivra Ma)', L.labelOf(66, 'sargam') === 'Ma+4');
check('A#4 sargam = Ni-4 (komal Ni)', L.labelOf(70, 'sargam') === 'Ni-4');
check('C4 western = C4', L.labelOf(60, 'western') === 'C4');
check('F#4 western = F#4', L.labelOf(66, 'western') === 'F#4');
check('all 12 sargam labels distinct', new Set([0,1,2,3,4,5,6,7,8,9,10,11].map(function (pc) { return L.SARGAM[pc]; })).size === 12);
check('C is white, C# is black', L.isWhite(60) === true && L.isWhite(61) === false);
check('B is white', L.isWhite(71) === true);
check('octaveOf C4 = 4, B3 = 3', L.octaveOf(60) === 4 && L.octaveOf(59) === 3);

// Octave shift
check('shift -1 => base 48 (C3)', L.baseMidiForShift(-1) === 48);
check('shift 0 => base 60 (C4)', L.baseMidiForShift(0) === 60);
check('shift +1 => base 72 (C5)', L.baseMidiForShift(1) === 72);
check('shift clamped to [-1,1]', L.baseMidiForShift(5) === 72 && L.baseMidiForShift(-9) === 48);

// Computer-key map
check("key 'z' => base (C)", L.midiForKey('z', 60) === 60);
check("key 'm' => B4 (71)", L.midiForKey('m', 60) === 71);
check("key 'q' => C5 (72)", L.midiForKey('q', 60) === 72);
check("key 'u' => B5 (83)", L.midiForKey('u', 60) === 83);
check("key 's' => C#4 (61)", L.midiForKey('s', 60) === 61);
check('unknown key => null', L.midiForKey('p', 60) === null);
check('map covers all 24 offsets', [0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23].every(function (o) { return L.keyForOffset(o) !== null; }));
check('map shifts with base (z at C3 = 48)', L.midiForKey('z', 48) === 48);

// Volume clamp
check('volume 70 stays 70', L.clampVolume(70) === 70);
check('volume 150 clamps to 100', L.clampVolume(150) === 100);
check('volume -5 clamps to 0', L.clampVolume(-5) === 0);
check('volume NaN defaults 70', L.clampVolume('abc') === 70);

// Recording
const rec = L.createRecording();
check('new recording empty', rec.events.length === 0);
check('addEvent accepts valid', L.addEvent(rec, 60, 0) === true && L.addEvent(rec, 64, 500) === true);
check('addEvent rejects midi 200', L.addEvent(rec, 200, 900) === false);
check('addEvent rejects negative time', L.addEvent(rec, 60, -5) === false);
check('duration = last at + 400', L.recordingDuration(rec) === 900);
const ser = L.serializeRecording(rec);
const back = L.parseRecording(ser);
check('serialize/parse round-trip', back !== null && back.events.length === 2 && back.events[1].midi === 64);
check('parse rejects bad midi', L.parseRecording('{"events":[{"midi":300,"at":0}]}') === null);
check('parse rejects malformed JSON', L.parseRecording('not json') === null);
check('parse rejects non-array', L.parseRecording('{"events":42}') === null);

// Exercises
const scale = L.exerciseNotes('scale', 60);
check('scale has 16 notes, starts+ends on Sa', scale.length === 16 && scale[0] === 60 && scale[15] === 60);
check('scale peaks at Sa one octave up', scale[7] === 72 && scale[8] === 72);
const alankar = L.exerciseNotes('alankar', 60);
check('alankar has 20 notes, all in 2-octave range', alankar.length === 20 && alankar.every(function (m) { return m >= 60 && m <= 83; }));
const phrase = L.exerciseNotes('phrase', 60);
check('phrase has 21 notes, starts on Pa ends on Sa', phrase.length === 21 && phrase[0] === 67 && phrase[20] === 60);
check('unknown exercise => null', L.exerciseNotes('nope', 60) === null);
check('tempos ordered slow > medium > fast', L.TEMPOS.slow > L.TEMPOS.medium && L.TEMPOS.medium > L.TEMPOS.fast);
check('exercise shifts with base (scale at C3 starts 48)', L.exerciseNotes('scale', 48)[0] === 48);

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
