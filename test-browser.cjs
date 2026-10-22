'use strict';
// Real Chromium smoke tests. Uses an isolated profile and Node 22+ built-ins only.
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const { once } = require('node:events');

async function main() {
  const browser = process.env.BRPG_BROWSER || [
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
  ].find(existsSync);
  assert(browser, 'Set BRPG_BROWSER to a Chromium executable');
  const root = path.resolve(__dirname, process.argv.includes('--dist') ? 'dist' : '.');
  const temporaryRoot = existsSync(path.join(os.tmpdir(), 'opencode')) ? path.join(os.tmpdir(), 'opencode') : os.tmpdir();
  const profile = mkdtempSync(path.join(temporaryRoot, 'brpg-browser-'));
  const errors = [], pending = new Map();
  let child, socket, sequence = 0, session;
  const server = http.createServer((req, res) => {
    const name = decodeURIComponent(new URL(req.url, 'http://localhost').pathname).slice(1) || 'index.html';
    if (name.includes('/') || name.includes('\\') || name.startsWith('.')) { res.writeHead(404).end(); return; }
    try {
      const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.mp3': 'audio/mpeg' };
      const type = types[path.extname(name)];
      if (!type) { res.writeHead(404).end(); return; }
      res.writeHead(200, { 'Content-Type': type }); res.end(readFileSync(path.join(root, name)));
    } catch { res.writeHead(404).end(); }
  });
  function send(method, params = {}, sessionId = session) {
    const id = ++sequence;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { pending.delete(id); reject(Error('CDP timeout: ' + method)); }, 15000);
      pending.set(id, { resolve, reject, timer });
      socket.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
    });
  }
  async function evaluate(expression) {
    const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    assert(!result.exceptionDetails, result.exceptionDetails?.exception?.description || 'Browser evaluation failed');
    return result.result.value;
  }
  async function waitFor(expression, label) {
    for (let attempt = 0; attempt < 100; attempt++) {
      if (await evaluate(expression)) return;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    throw Error('Timed out: ' + label + '; media=' + JSON.stringify(await evaluate(`__brpgMedia.map(m=>({src:m.src,paused:m.paused,ready:m.readyState,error:m.error?.code}))`)));
  }
  async function click(selector) {
    const point = await evaluate(`(() => {
      const el = document.querySelector(${JSON.stringify(selector)});
      if (!el || el.disabled) throw Error('Missing/disabled control: ' + ${JSON.stringify(selector)});
      el.scrollIntoView({block:'center'});
      const r = el.getBoundingClientRect(), x = r.x+r.width/2, y = r.y+r.height/2;
      if (!r.width || !r.height || !el.contains(document.elementFromPoint(x,y))) throw Error('Control not visible: ' + ${JSON.stringify(selector)});
      return {x,y};
    })()`);
    await send('Input.dispatchMouseEvent', { type: 'mousePressed', button: 'left', clickCount: 1, ...point });
    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', button: 'left', clickCount: 1, ...point });
  }
  async function layout(label) {
    await evaluate('new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))');
    const size = await evaluate(`({width:document.documentElement.clientWidth,page:document.documentElement.scrollWidth,dialog:document.querySelector('dialog[open]') ? {width:document.querySelector('dialog[open]').clientWidth,content:document.querySelector('dialog[open]').scrollWidth} : null})`);
    if (size.page > size.width + 1 || size.dialog?.content > size.dialog?.width + 1) {
      console.log('Overflow elements:', await evaluate(`Array.from(document.querySelectorAll('dialog[open] *')).filter(el=>el.getBoundingClientRect().right>innerWidth).map(el=>({tag:el.tagName,class:el.className,width:el.getBoundingClientRect().width,text:el.textContent.slice(0,60)})).slice(0,12)`));
    }
    assert(size.page <= size.width + 1, label + ': page overflows ' + JSON.stringify(size));
    if (size.dialog) assert(size.dialog.content <= size.dialog.width + 1, label + ': dialog overflows ' + JSON.stringify(size));
  }
  async function screenshot(name) {
    if (!process.argv.includes('--screenshots')) return;
    await evaluate(`scrollTo(0,0);document.querySelector('dialog[open]')?.scrollTo(0,0);new Promise(resolve => requestAnimationFrame(resolve))`);
    const result = await send('Page.captureScreenshot', { format: 'png' });
    const file = path.join(temporaryRoot, 'brpg-' + name + '.png');
    writeFileSync(file, Buffer.from(result.data, 'base64')); console.log('Screenshot: ' + file);
  }
  try {
    server.listen(0, '127.0.0.1'); await once(server, 'listening');
    const url = 'http://127.0.0.1:' + server.address().port;
    child = spawn(browser, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--remote-debugging-address=127.0.0.1', '--remote-debugging-port=0', '--user-data-dir=' + profile, 'about:blank'], { stdio: ['ignore', 'ignore', 'pipe'] });
    const endpoint = await new Promise((resolve, reject) => {
      let output = '';
      const timer = setTimeout(() => reject(Error('Chromium startup timeout')), 20000);
      child.stderr.on('data', chunk => {
        output += chunk;
        const match = output.match(/DevTools listening on (ws:\/\/[^\s]+)/);
        if (match) { clearTimeout(timer); resolve(match[1]); }
      });
      child.once('error', error => { clearTimeout(timer); reject(error); });
      child.once('exit', code => { clearTimeout(timer); reject(Error('Chromium exited: ' + code)); });
    });
    socket = new WebSocket(endpoint); await once(socket, 'open');
    socket.addEventListener('message', event => {
      const message = JSON.parse(event.data), item = pending.get(message.id);
      if (item) {
        pending.delete(message.id); clearTimeout(item.timer);
        if (message.error) item.reject(Error(message.error.message)); else item.resolve(message.result);
      }
      if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails.exception?.description || message.params.exceptionDetails.text);
    });
    const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
    session = (await send('Target.attachToTarget', { targetId, flatten: true })).sessionId;
    await send('Runtime.enable'); await send('Page.enable');
    // Observe native media elements, not mocks, so fetch/decode/play failures remain visible.
    await send('Page.addScriptToEvaluateOnNewDocument', { source: `
      window.__brpgMedia=[];window.__brpgOscillators=0;
      const NativeAudio=window.Audio;
      window.Audio=function(...args){const media=new NativeAudio(...args);__brpgMedia.push(media);return media;};
      window.Audio.prototype=NativeAudio.prototype;
      const context=window.AudioContext||window.webkitAudioContext;
      if(context){const create=context.prototype.createOscillator;context.prototype.createOscillator=function(...args){__brpgOscillators++;return create.apply(this,args);};}
    ` });
    await send('Page.navigate', { url });
    for (let attempt = 0; attempt < 100; attempt++) {
      if (await evaluate(`typeof BRPGFormation !== 'undefined' && document.getElementById('app').children.length > 0`)) break;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    assert(await evaluate(`typeof BRPGFormation !== 'undefined'`), 'Game did not boot');
    assert.equal(await evaluate('__brpgMedia.length'), 0, 'BGM waits for the first real gesture');
    await click('#audio-controls summary');
    await waitFor(`__brpgMedia.some(m=>m.src.endsWith('The_Wayfarer_s_Morning.mp3')&&!m.paused&&m.readyState>=2&&m.currentTime>0)`, 'native town BGM playback');
    await evaluate(`document.querySelector('#audio-bgm-volume').value='31';document.querySelector('#audio-bgm-volume').dispatchEvent(new Event('input',{bubbles:true}));document.querySelector('#audio-se-volume').value='17';document.querySelector('#audio-se-volume').dispatchEvent(new Event('input',{bubbles:true}));`);
    assert.equal(await evaluate('__brpgMedia.at(-1).volume'), 0.31);
    await click('[data-audio-mute="bgm"]');
    assert(await evaluate('__brpgMedia.every(m=>m.paused)'));
    await click('[data-audio-mute="se"]');
    assert(await evaluate('BRPGAudio.settings.seMuted'));
    const silentCount = await evaluate('__brpgOscillators');
    await evaluate(`playSE('encounter')`);
    assert.equal(await evaluate('__brpgOscillators'), silentCount, 'Muted SE produces no oscillators');
    await click('[data-audio-mute="se"]');
    await click('[data-audio-mute="bgm"]');
    await waitFor(`__brpgMedia.some(m=>!m.paused&&m.readyState>=2)`, 'unmuted native BGM');
    await send('Page.reload');
    await waitFor(`typeof BRPGAudio!=='undefined'&&document.querySelector('#app').children.length>0`, 'reload with persisted audio preferences');
    assert.equal(await evaluate('__brpgMedia.length'), 0);
    assert.equal(await evaluate('BRPGAudio.settings.bgmVolume'), 0.31);
    assert.equal(await evaluate('BRPGAudio.settings.seVolume'), 0.17);
    await click('#audio-controls summary');
    await waitFor(`__brpgMedia.some(m=>!m.paused&&m.readyState>=2)`, 'native BGM after reload gesture');
    for (const width of [1280, 390, 320]) {
      await send('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: width < 600 });
      await evaluate(`stopAll(); s=fresh(); notice=''; render();`);
      await layout(width + ' audio controls');
      assert.equal(await evaluate('document.querySelectorAll("#audio-controls").length'), 1);
      await evaluate(`document.querySelector('#audio-controls').open=false`);
      for (const view of ['town', 'guild', 'party', 'tavern', 'supplies', 'forge', 'atlas', 'journal']) {
        await evaluate(`moveView(${JSON.stringify(view)})`); await layout(width + ' ' + view);
      }
      await evaluate(`(() => {const select=document.querySelector('#monster-sheet-select');select.value='catalog-02';select.dispatchEvent(new Event('change',{bubbles:true}));})()`);
      await waitFor(`document.querySelector('#monster-sheet-preview').complete&&document.querySelector('#monster-sheet-preview').naturalWidth===1145`, 'native original-sheet image decode');
      await evaluate(`(() => {const select=document.querySelector('#monster-sheet-select');select.value='catalog-14-alt';select.dispatchEvent(new Event('change',{bubbles:true}));})()`);
      await waitFor(`document.querySelector('#monster-sheet-preview').complete&&document.querySelector('#monster-sheet-preview').naturalWidth===1875`, 'irregular alternate original preview');
      assert(await evaluate(`document.querySelector('#monster-sheet-warning').textContent.includes('横長')`));
      await layout(width + ' original artwork preview');
      await click('#monster-sheet-details summary');
      await layout(width + ' closed artwork preview');
      await evaluate('render()');
      assert.equal(await evaluate(`document.querySelector('#monster-sheet-details').open`), false, 'Closing preview survives rerender');
      await evaluate(`catalogScreen();s.ext.catalogTab='cat_mon';s.ext.discoveredMonsters={M0031:1,M0061:2,M0001:1};moveView('catalog')`);
      assert.equal(await evaluate(`document.querySelectorAll('#app .monster-thumb').length`), 2);
      await waitFor(`performance.getEntriesByType('resource').some(r=>r.name.endsWith('monsters_sheet02_M0031-M0060.png'))`, 'SVG sprite source fetched');
      await layout(width + ' reviewed sprite crops');
      await screenshot(width + '-catalog-art');
      await evaluate(`moveView('party')`);
      await click('[data-action="save-preset"][data-slot="1"]');
      await evaluate('s.active=[1];render()');
      await click('[data-action="load-preset"][data-slot="1"]');
      assert.equal(await evaluate('s.active.length'), 4);
      await evaluate('openCharacter(1)'); await layout(width + ' equipment');
      await click('[data-action="character-slot"][data-slot="weapon"]');
      await click('[data-action="character-unequip"][data-slot="weapon"]');
      assert.equal(await evaluate('s.roster[0].weapon'), null);
      await click('[data-action="character-equip"]');
      assert(await evaluate('s.roster[0].weapon'));
      await evaluate(`s.roster[0].name='W'.repeat(24);render()`);
      await layout(width + ' maximum-length name');
      await evaluate(`s.roster[0].name='アッシュ';render()`);
      await screenshot(width + '-equipment');
      await click('#character-close');
      await evaluate(`moveView('tavern')`);
      await click('[data-action="tavern-job-hero"][data-id="1"]');
      await evaluate(`(() => {const select=document.querySelector('[data-character-change="job-preview"]');select.value='priest';select.dispatchEvent(new Event('change',{bubbles:true}));})()`);
      await layout(width + ' job preview');
      await click('[data-action="tavern-job-confirm"]');
      assert.equal(await evaluate('s.roster[0].job'), 'priest');
      await evaluate(`moveView('supplies')`);
      await click('[data-action="shop-tab"][data-id="sell"]'); await layout(width + ' shop sell');
      await click('[data-action="shop-tab"][data-id="buy"]');
      await click('[data-action="shop-category"][data-id="weapon"]'); await layout(width + ' shop weapons');
      assert(await evaluate(`document.querySelector('#shop-panel-buy [data-action="merchant-buy-gear"]') !== null`));
      await evaluate('s.gold=100000;render()');
      const gearCount = await evaluate('s.gear.length');
      await click('#shop-panel-buy [data-action="merchant-buy-gear"]');
      assert.equal(await evaluate('s.gear.length'), gearCount + 1, 'Merchant purchase creates equipment');
      await evaluate(`moveView('forge');s.craftMaterial='wood';addMaterial('wood',20,1);render()`);
      await click('[data-action="commission-workshop"]');
      assert.equal(await evaluate('s.gear.length'), gearCount + 2, 'Workshop commission creates equipment');
      await layout(width + ' crafted equipment');
      await click('#save-settings'); await layout(width + ' save settings');
      await click('#save-close');
      await evaluate(`stopAll();s=fresh();enterMap('forest_edge');stopAll();render();scrollTo(0,0)`);
      const beforeEncounter = await evaluate(`({party:document.querySelector('.exp-workspace>.exp-party').getBoundingClientRect().top+scrollY,oscillators:__brpgOscillators})`);
      assert(await evaluate(`document.querySelector('.exp-workspace>.exp-party').getBoundingClientRect().height < ${width < 760 ? 360 : 220}`), 'Compact party leaves room for the encounter');
      await evaluate(`(() => {encounter();stopAll();
        const sample=s.battle.enemies[0];s.battle.enemies=[{...sample,key:0,row:'front',hp:500,maxhp:500},{...sample,key:1,row:'back',hp:500,maxhp:500}];render();})()`);
      assert.equal(await evaluate(`document.querySelector('.exp-workspace>.exp-party').getBoundingClientRect().top+scrollY`), beforeEncounter.party, 'Party position is unchanged on encounter');
      assert.equal(await evaluate('__brpgOscillators'), beforeEncounter.oscillators + 2, 'Encounter SE fires once');
      await waitFor(`__brpgMedia.some(m=>m.src.endsWith('Cath_Slan_na_n_Og.mp3')&&!m.paused&&m.readyState>=2)`, 'native battle BGM playback');
      assert.equal(await evaluate('__brpgMedia.filter(m=>!m.paused).length'), 1, 'Only one BGM plays');
      assert(await evaluate(`document.querySelector('#exp-map-view').hidden&&!document.querySelector('#exp-enemy-view').hidden`));
      await click('#exp-view-map');
      assert(await evaluate(`!document.querySelector('#exp-map-view').hidden&&document.querySelector('#exp-enemy-view').hidden`));
      await click('#exp-view-enemies');
      assert.equal(await evaluate('__brpgOscillators'), beforeEncounter.oscillators + 2, 'Display switching does not replay encounter SE');
      await layout(width + ' battle');
      await screenshot(width + '-battle');
      await click('[data-action="command"][data-command="attack"]');
      assert(await evaluate(`document.querySelector('.exp-workspace>.exp-party').getBoundingClientRect().top>=-1`), 'Party remains visible while scrolling battle controls');
      assert.equal(await evaluate(`document.querySelectorAll('[data-action="exp-command-target"]').length`), 1);
      await click('[data-action="exp-command-target"][data-id="0"]');
      await click('[data-action="exp-command-confirm"]');
      assert.equal(await evaluate('s.battle.plans[s.roster[0].id].target'), 0);
      await click('[data-action="template"]');
      const turn = await evaluate('s.battle.turn');
      await click('[data-action="execute"]');
      assert.equal(await evaluate('s.battle.turn'), turn + 1, 'Confirmed commands advance a real browser turn');
      assert(await evaluate('validSave(s)'));
      await evaluate(`s.battle=null;render()`);
      await waitFor(`__brpgMedia.some(m=>m.src.endsWith('The_Wayfarer_s_Morning.mp3')&&!m.paused&&m.readyState>=2)`, 'town BGM restored after battle');
      console.log('PASS: Chromium ' + width + 'px audio playback/settings, artwork preview/crops, stable party, MAP/enemy switching, encounter SE, equipment/facilities/save and battle turn.');
    }
    assert.deepEqual(errors, [], 'Uncaught browser errors');
  } finally {
    if (socket?.readyState === WebSocket.OPEN) {
      await send('Browser.close', {}, null).catch(() => {}); socket.close();
    }
    if (child && child.exitCode === null) {
      const exited = once(child, 'exit'); child.kill(); await exited;
    }
    for (const item of pending.values()) { clearTimeout(item.timer); item.reject(Error('Browser closed')); }
    server.close(); await once(server, 'close');
    rmSync(profile, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
