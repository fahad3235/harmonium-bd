# TEST RESULTS — harmonium-bd (factory run, 2026-10-30 12:00 slot)

## Unit tests (real, run 2026-10-30)

Command: `node tests/test.js` — **48/48 passed, 0 failed.**

Hand-verified values asserted by the tests:
- A4 = 440 Hz exactly; C4 = 261.63 Hz; C5 = 523.25 Hz; C3 = 130.81 Hz
  (all within 0.01 Hz); octave doubling and semitone ratio exact.
- Sargam labels: C4 = Sa4, C#4 = Re-4 (komal Re), F#4 = Ma+4 (tivra Ma),
  A#4 = Ni-4 (komal Ni); all 12 pitch-class labels distinct.
- Octave shift: -1 → base 48 (C3), 0 → 60 (C4), +1 → 72 (C5); out-of-range
  shifts clamp to [-1, +1].
- Computer-key map: z = C4, m = B4, q = C5, u = B5, s = C#4; unknown key
  ('p') → null; all 24 offsets covered; map follows the base octave.
- Volume clamp: 150 → 100, -5 → 0, non-numeric → 70.
- Recording: valid events accepted, midi 200 and negative times rejected,
  duration = last event time + 400 ms ring-out; JSON round-trip exact;
  malformed JSON / bad midi / non-array events rejected.
- Exercises: scale = 16 notes starting and ending on Sa, peaking at Sa an
  octave up; alankar = 20 notes all inside the 2-octave range; phrase =
  21 notes starting on Pa ending on Sa; unknown exercise → null.

## Headless-Chrome smoke tests (real, run 2026-10-30)

Command: `node tests/smoke.js` (raw CDP, /opt/meta-chromium/chrome,
file:// page) — **22/22 passed, 0 failed, 0 console/page errors.**

Coverage: title, 24 keys (14 white + 10 black), default sargam label Sa4,
pointer tap → last-note display + active class on/off, keydown 'm' → Ni4,
Western-label toggle (C4), octave shift to High (first key midi 72),
record indicator, 2-note take counted, save → 1 item in saved list +
localStorage persistence, save notice, play-with-nothing notice, exercise
start (status shows) + stop (status clears), বাংলা toggle (lang=bn, title
changes) and back to English, 390 px viewport with no horizontal overflow.

Repairs: 0 app-logic bugs in either suite. (Two app issues were caught
during authoring before the test runs: stopping a recording used to
discard the take, and Clear left a stale REC indicator — both fixed in
js/app.js before testing; see the recordingActive flag.)

## Source hygiene

- All pushed sources are pure ASCII (verified with `grep -P '[^\x00-\x7F]'`):
  Bengali strings live in js/i18n.js as \uXXXX escapes and are decoded by
  the browser at runtime, so the push transport cannot corrupt them.
- `node --check` passes on js/logic.js, js/i18n.js, js/app.js.
- Zero runtime network requests by design (no CDN, no fonts, no APIs).
