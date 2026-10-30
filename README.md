# Harmonium BD

An offline, bilingual (English / বাংলা) playable harmonium for the browser.
Tap the keys, practise sargam, record your playing, and play it back —
no account, no internet connection, nothing uploaded.

Live demo: https://fahad3235.github.io/harmonium-bd/

## Features

1. **Playable 2-octave keyboard** — 24 keys (C–B across two octaves) with
   mouse, touch, and computer-keyboard input. Lower computer row (Z–M) plays
   the first octave; upper row (Q–U) plays the second.
2. **Sargam + Western labels** — toggle between sargam (Sa, komal Re, Ga,
   tivra Ma, Pa, komal Dha, komal Ni) and Western note names (C, C#, D …).
   Bengali sargam syllables (সা রে গা মা পা ধা নি) appear in বাংলা mode.
3. **Octave shift** — Sa can sit at C3, C4 (default), or C5.
4. **Reed-style synthesized sound** — WebAudio sawtooth + triangle voices
   with volume control and an optional sustain mode. Audio is best-effort:
   if a browser blocks audio, keys still light up and recording still works.
5. **Record, save, and play back** — record a take, play it back, save named
   takes to localStorage, delete them, and clear the current take.
6. **Practice exercises** — three original practice patterns (sargam scale
   up & down, an alankar pattern, and a practice phrase) at Slow / Medium /
   Fast speeds, with the playing key highlighted as it sounds.
7. **Bilingual UI** — full English / বাংলা toggle, persisted in
   localStorage, with Bengali digits in বাংলা mode. Responsive down to
   390 px wide.

## Stack

Vanilla HTML, CSS, and JavaScript. No frameworks, no build step, no network
requests at runtime. Sound uses the WebAudio API only.

## Run locally

```sh
# Any static server works, or just open the file:
python3 -m http.server 8000
# then open http://localhost:8000/
```

Or open `index.html` directly in a browser (audio requires a user gesture,
so tap a key first — that is standard browser autoplay policy).

## Tests

```sh
node tests/test.js    # pure-logic unit tests (frequencies, labels, key map, recording, exercises)
node tests/smoke.js   # headless-Chrome smoke tests via raw CDP (spawns /opt/meta-chromium/chrome)
```

## Project layout

```
index.html        page structure
style.css         layout + keyboard styling
js/logic.js       pure logic: frequencies, sargam, key map, recording, exercises
js/i18n.js        English / বাংলা strings (Bengali stored as \uXXXX escapes in source)
js/app.js         DOM + WebAudio: keyboard, sound, recording, exercises, language
tests/test.js     node unit tests
tests/smoke.js    headless-Chrome smoke tests
```

## Limitations

- This is a practice instrument, not a substitute for a teacher or a real
  harmonium: it uses equal temperament at A4 = 440 Hz and a synthesized
  reed-like voice, not sampled harmonium reeds.
- The exercises are original scale/alankar practice patterns, not
  transcriptions of songs.
- Recordings live only in the browser's localStorage on the device that
  made them; there is no account or cloud sync.
- Sound needs a browser with WebAudio; very old browsers will still show
  the keyboard and recording UI but stay silent.
