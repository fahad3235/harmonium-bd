// Harmonium BD — headless-Chrome smoke tests via raw CDP.
// Run: node tests/smoke.js   (spawns /opt/meta-chromium/chrome, file:// page)
'use strict';
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const PORT = 9336;
const PAGE = 'file://' + path.resolve(__dirname, '..', 'index.html');

let passed = 0, failed = 0;
function check(name, cond, extra) {
  if (cond) { passed++; console.log('ok - ' + name); }
  else { failed++; console.log('FAIL - ' + name + (extra ? ' :: ' + extra : '')); }
}
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function getWsUrl() {
  for (let i = 0; i < 50; i++) {
    try {
      const res = await fetch('http://127.0.0.1:' + PORT + '/json/list');
      const list = await res.json();
      const page = list.find(t => t.type === 'page');
      if (page && page.webSocketDebuggerUrl) return page.webSocketDebuggerUrl;
    } catch (e) { /* not up yet */ }
    await sleep(200);
  }
  throw new Error('chrome debugger endpoint never came up');
}

async function main() {
  const policyPath = '/var/lib/hatch-browser/rootfs-base/usr/share/hatch/chromium/webgl-allowed-domains.txt';
  const policySha = require('crypto').createHash('sha256').update(fs.readFileSync(policyPath)).digest('hex');
  const chrome = spawn('/opt/meta-chromium/chrome', [
    '--headless=new', '--no-sandbox', '--disable-gpu',
    '--remote-debugging-port=' + PORT, '--no-first-run',
    '--user-data-dir=/tmp/harmonium-smoke-profile',
    '--hatch-webgl-allowed-domains-file=' + policyPath,
    '--hatch-webgl-allowed-domains-sha256=' + policySha,
    PAGE
  ], { stdio: 'ignore' });
  const errors = [];
  try {
    const wsUrl = await getWsUrl();
    const ws = new WebSocket(wsUrl);
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
    let seq = 0;
    const pending = new Map();
    ws.onmessage = (msg) => {
      const data = JSON.parse(msg.data);
      if (data.id && pending.has(data.id)) {
        const { resolve } = pending.get(data.id);
        pending.delete(data.id);
        resolve(data);
      }
      if (data.method === 'Runtime.consoleAPICalled' && data.params.type === 'error') {
        errors.push('console.error: ' + JSON.stringify(data.params.args));
      }
      if (data.method === 'Runtime.exceptionThrown') {
        errors.push('exception: ' + (data.params.exceptionDetails.exception.description || 'unknown'));
      }
    };
    function send(method, params) {
      return new Promise((resolve) => {
        const id = ++seq;
        pending.set(id, { resolve });
        ws.send(JSON.stringify({ id, method, params: params || {} }));
      });
    }
    const evaluate = async (expr) => {
      const res = await send('Runtime.evaluate', { expression: expr, returnByValue: true });
      if (res.error) return { error: JSON.stringify(res.error) };
      const inner = res.result ? res.result.result : undefined;
      if (!inner) return { error: 'no result: ' + JSON.stringify(res).slice(0, 200) };
      if (inner.subtype === 'error') return { error: inner.description };
      return { value: inner.value };
    };
    await send('Runtime.enable');
    await send('Page.enable');
    await sleep(1200);

    let r = await evaluate("document.getElementById('appTitle').textContent");
    check('title is Harmonium BD', r.value === 'Harmonium BD', JSON.stringify(r));
    r = await evaluate("document.querySelectorAll('.key').length");
    check('24 keys rendered', r.value === 24, JSON.stringify(r));
    r = await evaluate("document.querySelectorAll('.key.white').length + '/' + document.querySelectorAll('.key.black').length");
    check('14 white + 10 black keys', r.value === '14/10', JSON.stringify(r));
    r = await evaluate("document.querySelector('.key[data-midi=\"60\"]').textContent");
    check('C4 key labelled Sa4 (sargam default)', (r.value || '').indexOf('Sa4') !== -1, JSON.stringify(r));

    // Tap C4 via pointer events, then release.
    r = await evaluate("var el=document.querySelector('.key[data-midi=\"60\"]'); el.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true})); document.getElementById('lastNote').textContent");
    check('tapping C4 shows Sa4 as last note', (r.value || '').indexOf('Sa4') !== -1, JSON.stringify(r));
    r = await evaluate("document.querySelector('.key[data-midi=\"60\"]').classList.contains('active')");
    check('tapped key gets active class', r.value === true, JSON.stringify(r));
    await evaluate("document.querySelector('.key[data-midi=\"60\"]').dispatchEvent(new PointerEvent('pointerup',{bubbles:true}));");
    r = await evaluate("document.querySelector('.key[data-midi=\"60\"]').classList.contains('active')");
    check('released key loses active class', r.value === false, JSON.stringify(r));

    // Computer keyboard: 'm' = B4 = Ni4.
    r = await evaluate("document.dispatchEvent(new KeyboardEvent('keydown',{key:'m'})); document.getElementById('lastNote').textContent");
    check("keydown 'm' plays Ni4", (r.value || '').indexOf('Ni4') !== -1, JSON.stringify(r));
    await evaluate("document.dispatchEvent(new KeyboardEvent('keyup',{key:'m'}));");

    // Western labels toggle.
    r = await evaluate("var s=document.getElementById('labelsSel'); s.value='western'; s.dispatchEvent(new Event('change')); document.querySelector('.key[data-midi=\"60\"]').textContent");
    check('western labels show C4', (r.value || '').indexOf('C4') !== -1, JSON.stringify(r));
    await evaluate("var s=document.getElementById('labelsSel'); s.value='sargam'; s.dispatchEvent(new Event('change'));");

    // Octave shift to High (C5 base).
    r = await evaluate("var s=document.getElementById('octaveSel'); s.value='1'; s.dispatchEvent(new Event('change')); document.querySelector('.key').dataset.midi");
    check('octave High makes first key midi 72', r.value === '72', JSON.stringify(r));
    await evaluate("var s=document.getElementById('octaveSel'); s.value='0'; s.dispatchEvent(new Event('change'));");

    // Record flow: record, play C + E, stop, count = 2, save, list = 1.
    await evaluate("document.getElementById('recordBtn').click();");
    r = await evaluate("document.getElementById('recState').textContent");
    check('recording indicator appears', (r.value || '').indexOf('REC') !== -1, JSON.stringify(r));
    await evaluate("var a=document.querySelector('.key[data-midi=\"60\"]'); var b=document.querySelector('.key[data-midi=\"64\"]'); a.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true})); b.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true}));");
    await evaluate("document.getElementById('recordBtn').click();");
    r = await evaluate("document.getElementById('recordedCount').textContent");
    check('recorded count is 2 notes', (r.value || '').indexOf('2') !== -1, JSON.stringify(r));
    await evaluate("document.getElementById('saveRecordBtn').click();");
    r = await evaluate("document.querySelectorAll('#savedList li').length");
    check('saved list has 1 recording', r.value === 1, JSON.stringify(r));
    r = await evaluate("!!localStorage.getItem('harmonium-bd-recordings')");
    check('saved recording persists in localStorage', r.value === true, JSON.stringify(r));
    r = await evaluate("document.getElementById('notice').textContent");
    check('save shows confirmation notice', (r.value || '').length > 0, JSON.stringify(r));

    // Play last recording with nothing recorded -> notice; use clear first.
    await evaluate("document.getElementById('clearRecordBtn').click(); document.getElementById('playRecordBtn').click();");
    r = await evaluate("document.getElementById('notice').textContent");
    check('play-with-nothing shows notice', (r.value || '').length > 0, JSON.stringify(r));

    // Exercise starts and can be stopped.
    await evaluate("document.querySelector('.ex-btn[data-ex=\"scale\"]').click();");
    await sleep(800);
    r = await evaluate("document.getElementById('exerciseStatus').textContent");
    check('exercise status shows while playing', (r.value || '').indexOf('Sargam') !== -1, JSON.stringify(r));
    await evaluate("document.getElementById('stopExerciseBtn').click();");
    r = await evaluate("document.getElementById('exerciseStatus').textContent");
    check('exercise status clears after stop', r.value === '', JSON.stringify(r));

    // Language toggle to Bangla and back.
    await evaluate("document.getElementById('langBtn').click();");
    r = await evaluate("document.documentElement.lang + '|' + document.getElementById('appTitle').textContent");
    check('lang toggle switches to bn with new title', (r.value || '').indexOf('bn|') === 0 && (r.value || '').indexOf('Harmonium BD') === -1, JSON.stringify(r));
    await evaluate("document.getElementById('langBtn').click();");
    r = await evaluate("document.getElementById('appTitle').textContent");
    check('lang toggle back restores English title', r.value === 'Harmonium BD', JSON.stringify(r));

    // 390px mobile: no horizontal overflow.
    await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
    await sleep(400);
    r = await evaluate("document.documentElement.scrollWidth + '/' + window.innerWidth");
    check('390px viewport: no horizontal overflow', (function () { var p = (r.value || '').split('/'); return Number(p[0]) <= Number(p[1]) + 1; })(), JSON.stringify(r));

    check('0 console/page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
    ws.close();
  } finally {
    chrome.kill('SIGKILL');
  }
  console.log('\n' + passed + ' passed, ' + failed + ' failed');
  process.exit(failed ? 1 : 0);
}
main().catch((e) => { console.error('SMOKE HARNESS ERROR: ' + (e && e.stack || e)); process.exit(1); });
