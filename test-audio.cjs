'use strict';
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const { test } = require('node:test');
const { harness } = require('./test.cjs');
const source = fs.readFileSync(__dirname + '/audio.js', 'utf8');
const KEY = 'brpg-audio-v1';
const flush = async () => { await Promise.resolve(); await Promise.resolve(); };

function setup(saved, options = {}) {
  const store = new Map(saved === undefined ? [] : [[KEY, saved]]);
  const listeners = new Map(), media = [], controls = [], muteButtons = [];
  function control(dataset) {
    return { dataset, value: '', attrs: {}, setAttribute(k, v) { this.attrs[k] = v; }, closest() { return this; } };
  }
  controls.push(control({ audioVolume: 'bgm' }), control({ audioVolume: 'se' }));
  muteButtons.push(control({ audioMute: 'bgm' }), control({ audioMute: 'se' }));
  const legacy = { ...control({}), textContent: '' }, status = { textContent: '' };
  const document = {
    hidden: false,
    addEventListener(type, fn) { if (!listeners.has(type)) listeners.set(type, []); listeners.get(type).push(fn); },
    querySelectorAll(selector) {
      return selector === '[data-audio-volume]' ? controls : selector === '[data-audio-mute]' ? muteButtons : [legacy];
    },
    getElementById() { return status; }
  };
  class Audio {
    constructor() { this.calls = []; this.paused = true; this.events = {}; this.currentTime = 0; media.push(this); }
    addEventListener(type, fn) { this.events[type] = fn; }
    play() {
      if (options.throwPlay) throw Error('media failure');
      this.paused = false;
      return new Promise((resolve, reject) => this.calls.push({ resolve: () => { this.paused = false; resolve(); }, reject }));
    }
    pause() { this.paused = true; }
  }
  const box = {
    document, Audio: options.noAudio ? undefined : Audio,
    localStorage: {
      getItem(k) { if (options.storageThrows) throw Error('denied'); return store.get(k) ?? null; },
      setItem(k, v) { if (options.storageThrows) throw Error('denied'); store.set(k, v); }
    },
    s: { battle: options.battle ? {} : null, ext: { soundOn: options.legacySoundOn } }, render() { return 42; }
  };
  vm.createContext(box);
  vm.runInContext(source, box, { filename: 'audio.js' });
  const emit = (type, event = {}) => { for (const fn of listeners.get(type) || []) fn({ type, ...event }); };
  return { box, audio: box.BRPGAudio, media, store, document, controls, muteButtons, legacy, status, emit };
}

test('waits for trusted gesture, loops metadata-only, and does not restart on render', async () => {
  const h = setup();
  h.box.render();
  h.emit('pointerdown', { isTrusted: false });
  h.emit('keydown', { key: 'Shift' });
  h.emit('keydown', { key: 'a', repeat: true });
  assert.equal(h.media.length, 0);
  h.emit('keydown', { key: 'Enter', isTrusted: true });
  const m = h.media[0];
  assert.equal(m.src, 'The_Wayfarer_s_Morning.mp3');
  assert.equal(m.preload, 'metadata');
  assert.equal(m.loop, true);
  assert.equal(m.volume, 0.5);
  m.calls[0].resolve(); await flush();
  for (let i = 0; i < 20; i++) assert.equal(h.box.render(), 42);
  assert.equal(m.calls.length, 1);
});

test('autoplay rejection is handled without render retries; next gesture retries', async () => {
  const h = setup(); h.emit('pointerdown');
  const m = h.media[0]; m.calls[0].reject(Error('NotAllowedError')); await flush();
  for (let i = 0; i < 20; i++) h.box.render();
  assert.equal(m.calls.length, 1);
  assert(m.paused);
  h.emit('keydown', { key: 'Enter' });
  assert.equal(m.calls.length, 2);
  m.calls[1].resolve(); await flush();
  assert(!m.paused);
});

test('BGM and SE settings are independent, persisted and reflected in controls', async () => {
  const h = setup(); h.emit('pointerdown');
  const m = h.media[0]; m.calls[0].resolve(); await flush();
  h.controls[0].value = '23'; h.emit('input', { target: h.controls[0] });
  assert.equal(m.volume, 0.23);
  assert.equal(h.audio.settings.seVolume, 0.7);
  h.emit('click', { target: h.muteButtons[0] });
  assert(m.paused);
  assert.equal(h.muteButtons[0].attrs['aria-pressed'], 'true');
  h.audio.set('seMuted', true);
  assert.equal(h.legacy.textContent, 'SE OFF');
  const reloaded = setup(h.store.get(KEY));
  assert.deepEqual(JSON.parse(JSON.stringify(reloaded.audio.settings)), JSON.parse(h.store.get(KEY)));
  assert.equal(reloaded.media.length, 0);
  h.audio.set('bgmMuted', false);
  assert.equal(m.calls.length, 2);
  m.calls[1].resolve(); await flush();
  h.audio.set('bgmVolume', 0); assert(m.paused);
  h.audio.set('bgmVolume', 0.3); assert.equal(m.calls.length, 3);
});

test('existing saved SE mute migrates once without overriding independent preferences', () => {
  const h = setup(undefined, { legacySoundOn: false });
  assert(h.audio.settings.seMuted);
  assert.equal(JSON.parse(h.store.get(KEY)).seMuted, true);
  const reloaded = setup(h.store.get(KEY), { legacySoundOn: true });
  assert(reloaded.audio.settings.seMuted);
  const explicit = setup(JSON.stringify({ seMuted: false }), { legacySoundOn: false });
  assert.equal(explicit.audio.settings.seMuted, false);
});

test('rapid context switches retire stale play completions and stale rejections', async () => {
  const h = setup(); h.emit('pointerdown');
  const town = h.media[0];
  h.box.s.battle = {}; h.box.render(); const battle = h.media[1];
  assert(town.paused);
  assert.equal(battle.src, 'Cath_Slan_na_n_Og.mp3');
  h.box.s.battle = null; h.box.render(); const current = h.media[2];
  current.calls[0].resolve(); await flush();
  town.calls[0].resolve(); battle.calls[0].reject(Error('stale')); await flush();
  assert(town.paused && battle.paused && !current.paused);
  assert.equal(h.media.filter(m => !m.paused).length, 1);
  for (let i = 0; i < 5; i++) h.box.render();
  assert.equal(h.media.length, 3);
});

test('hidden tab pauses; context changes while hidden resume only intended track', async () => {
  const h = setup(); h.emit('pointerdown');
  const town = h.media[0]; town.calls[0].resolve(); await flush(); town.currentTime = 12;
  h.document.hidden = true; h.emit('visibilitychange'); assert(town.paused);
  h.document.hidden = false; h.emit('visibilitychange');
  assert.equal(h.media.length, 1); assert.equal(town.currentTime, 12);
  town.calls[1].resolve(); await flush();
  h.document.hidden = true; h.emit('visibilitychange');
  h.box.s.battle = {}; h.box.render(); assert.equal(h.media.length, 1);
  h.document.hidden = false; h.emit('visibilitychange');
  const battle = h.media[1]; assert.equal(battle.src, 'Cath_Slan_na_n_Og.mp3');
  battle.calls[0].resolve(); await flush();
  h.audio.set('bgmMuted', true);
  h.document.hidden = true; h.emit('visibilitychange');
  h.document.hidden = false; h.emit('visibilitychange');
  assert(battle.paused); assert.equal(battle.calls.length, 1);
});

test('pending play is retired on mute/hidden and cannot pause a fresh attempt', async () => {
  for (const reason of ['mute', 'hidden']) {
    const h = setup(); h.emit('pointerdown'); const stale = h.media[0];
    if (reason === 'mute') h.audio.set('bgmMuted', true);
    else { h.document.hidden = true; h.emit('visibilitychange'); }
    if (reason === 'mute') h.audio.set('bgmMuted', false);
    else { h.document.hidden = false; h.emit('visibilitychange'); }
    const current = h.media[1]; current.calls[0].resolve(); await flush();
    stale.calls[0].resolve(); await flush();
    assert(stale.paused && !current.paused);
  }
});

test('invalid preferences and blocked storage do not break startup or setters', () => {
  for (const saved of ['{oops', 'null', '[]', 'true', '3', JSON.stringify({ bgmVolume: '0.4', seVolume: 2, bgmMuted: 1, seMuted: 'false' })]) {
    const h = setup(saved);
    assert.equal(h.audio.settings.bgmVolume, 0.5);
    assert.equal(h.audio.settings.seVolume, 0.7);
    assert.equal(h.audio.settings.bgmMuted, false);
    assert.equal(h.audio.settings.seMuted, false);
  }
  const h = setup(JSON.stringify({ bgmVolume: 0, seMuted: true, ignored: 1 }));
  assert.equal(h.audio.settings.bgmVolume, 0); assert(h.audio.settings.seMuted);
  for (const [key, value] of [['bgmVolume', NaN], ['seVolume', Infinity], ['bgmVolume', -1], ['seMuted', 1], ['bogus', 1], ['__proto__', true]]) assert.equal(h.audio.set(key, value), false);
  assert.throws(() => { h.audio.settings.bgmVolume = 1; }, TypeError);
  const denied = setup(undefined, { storageThrows: true });
  assert(denied.audio.set('seMuted', true)); assert(denied.audio.settings.seMuted);
});

test('missing Audio, synchronous failure and media error are contained', async () => {
  for (const options of [{ noAudio: true }, { throwPlay: true }]) {
    const h = setup(undefined, options); h.emit('pointerdown');
    assert.doesNotThrow(() => h.box.render());
  }
  const h = setup(); h.emit('pointerdown'); const m = h.media[0];
  m.events.error(); m.calls[0].resolve(); await flush();
  h.box.render(); assert.equal(m.calls.length, 1); assert(m.paused);
});

test('restored battle starts the battle track only after gesture', () => {
  const h = setup(undefined, { battle: true }); assert.equal(h.media.length, 0);
  h.emit('pointerdown'); assert.equal(h.media[0].src, 'Cath_Slan_na_n_Og.mp3');
});

test('SE common gain updates active sounds and closure callers ignore old save gating', () => {
  const h = harness(), gains = [], oscillators = [];
  class AudioContext {
    constructor() { this.currentTime = 10; this.state = 'suspended'; this.destination = {}; }
    resume() { return Promise.reject(Error('blocked')); }
    createGain() {
      const g = { value: null, gain: { setValueAtTime(v) { g.value = v; }, exponentialRampToValueAtTime() {} }, connect(to) { this.to = to; }, disconnect() {} };
      gains.push(g); return g;
    }
    createOscillator() {
      const osc = { frequency: { setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect(to) { this.to = to; }, start() {}, stop() {}, disconnect() {} };
      oscillators.push(osc); return osc;
    }
  }
  h.box.AudioContext = AudioContext;
  vm.runInContext(source, h.box, { filename: 'audio.js' });
  h.run(`s.ext={...(s.ext||{}),soundOn:false}; playSE('encounter');`);
  assert.equal(oscillators.length, 2);
  assert.equal(gains[0].value, 0.7);
  assert.equal(gains[1].to, gains[0]);
  h.run(`BRPGAudio.set('seVolume',0.2);`); assert.equal(gains[0].value, 0.2);
  h.run(`BRPGAudio.set('seMuted',true); playSE('attack');`);
  assert.equal(gains[0].value, 0); assert.equal(oscillators.length, 2);
  h.run(`s=fresh(); render(); save(); s=JSON.parse(localStorage.getItem(KEY)); render();`);
  assert.equal(h.box.BRPGAudio.settings.seMuted, true);
  h.run(`BRPGAudio.set('seMuted',false); s.ext.soundOn=false; globalThis.playSE=()=>{}; s.roster[0].hp=1; useItem('potion',s.roster[0].id);`);
  assert.equal(oscillators.length, 5, 'Closure playSE used by items also uses shared preferences');
  assert.equal(gains[0].value, 0.2);
});

test('legacy SE toggle delegates without resetting independent preferences', () => {
  const h = harness(), clicks = [];
  h.box.document.addEventListener = (type, fn) => { if (type === 'click') clicks.push(fn); };
  vm.runInContext(source, h.box, { filename: 'audio.js' });
  h.run('boot(); BRPGAudio.set("bgmVolume",0.21);');
  const button = { dataset: { action: 'toggle-se' }, disabled: false };
  const event = { target: { closest(selector) { return selector === '[data-action]' ? button : null; } } };
  for (const listener of clicks) listener(event);
  assert.equal(h.box.BRPGAudio.settings.seMuted, true);
  assert.equal(h.box.BRPGAudio.settings.bgmVolume, 0.21);
});

test('minimal game harness without Audio/createElement and documentless load stay safe', () => {
  const h = harness(); vm.runInContext(source, h.box, { filename: 'audio.js' });
  h.run(`s=fresh();render();enterMap('forest_edge');encounter();stopAll();playSE('encounter');BRPGAudio.set('bgmMuted',true);`);
  const box = vm.createContext({}); vm.runInContext(source, box);
  assert(box.BRPGAudio.set('seVolume', 0.1));
});

test('exploration in forest_edge plays Sho_lah_Beneath_the_Moon.mp3', async () => {
  const h = setup();
  h.box.s.view = 'explore';
  h.box.s.dungeon = { mapId: 'forest_edge' };
  h.box.render();
  h.emit('pointerdown');
  assert.equal(h.media[0].src, 'Sho_lah_Beneath_the_Moon.mp3');
  // Transition to battle switches to battle track
  h.box.s.battle = { turn: 1 };
  h.box.render();
  assert.equal(h.media[1].src, 'Cath_Slan_na_n_Og.mp3');
  // Ending battle switches back to dungeon track
  h.box.s.battle = null;
  h.box.render();
  assert.equal(h.media[2].src, 'Sho_lah_Beneath_the_Moon.mp3');
  // Returning to town switches to town track
  h.box.s.view = 'town';
  h.box.s.dungeon = null;
  h.box.render();
  assert.equal(h.media[3].src, 'The_Wayfarer_s_Morning.mp3');
});
