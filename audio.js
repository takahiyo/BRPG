/* Classic script: load after formation.js and before save-manager.js. */
'use strict';
(() => {
  const STORAGE_KEY = 'brpg-audio-v1';
  const defaults = { bgmVolume: 0.5, seVolume: 0.7, bgmMuted: false, seMuted: false };
  const tracks = {
    town: 'audio/bgm/Solas_na_Sraide.mp3',
    battle: 'audio/bgm/Cath_Slan_na_n_Og.mp3',
    forest_edge: 'audio/bgm/Sho_lah_Beneath_the_Moon.mp3',
    rocky_path: 'audio/bgm/Sli_na_Cloch.mp3',
    dungeon_default: 'audio/bgm/Sho_lah_Beneath_the_Moon.mp3'
  };
  const doc = globalThis.document;
  let settings = { ...defaults };
  function valid(key, value) {
    return key.endsWith('Volume') ? typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1 : typeof value === 'boolean';
  }
  try {
    const raw = globalThis.localStorage?.getItem(STORAGE_KEY);
    // Respect the shipped save's SE mute only when independent preferences do not yet exist.
    if (raw == null && typeof s !== 'undefined' && s?.ext?.soundOn === false) {
      settings.seMuted = true;
      globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify(settings));
    }
    const saved = JSON.parse(raw || 'null');
    if (saved && typeof saved === 'object' && !Array.isArray(saved)) {
      for (const key of Object.keys(defaults)) if (valid(key, saved[key])) settings[key] = saved[key];
    }
  } catch {}
  settings = Object.freeze(settings);
  let intended = 'town', unlocked = false, active = null, seOutput = null, seContext = null;
  let message = '操作するとBGMを再生します';
  function nodes(selector) { return doc?.querySelectorAll?.(selector) || []; }
  function syncControls() {
    for (const node of nodes('[data-audio-volume]')) {
      const key = node.dataset.audioVolume + 'Volume';
      if (key in defaults) {
        node.value = String(Math.round(settings[key] * 100));
        node.setAttribute?.('aria-valuetext', node.value + '%');
      }
    }
    for (const node of nodes('[data-audio-mute]')) {
      const key = node.dataset.audioMute + 'Muted';
      if (key in defaults) node.setAttribute?.('aria-pressed', String(settings[key]));
    }
    // Legacy buttons are rendered from game-save data; preferences are not.
    for (const node of nodes('[data-action="toggle-se"]')) {
      node.textContent = settings.seMuted ? 'SE OFF' : 'SE ON';
      node.setAttribute?.('aria-pressed', String(settings.seMuted));
    }
    const status = doc?.getElementById?.('audio-status');
    if (status && status.textContent !== message) status.textContent = message;
  }
  function pause() {
    if (!active) return;
    try { active.media.pause(); } catch {}
    // A pending play() may resolve after pause(). Retire its element so its
    // completion cannot pause a newer attempt on the same media element.
    if (active.state === 'pending') active = null;
    else if (active.state !== 'failed') active.state = 'paused';
  }
  function reconcile(retry = false) {
    if (!unlocked || doc?.hidden || settings.bgmMuted || settings.bgmVolume === 0) {
      pause();
      message = settings.bgmMuted || settings.bgmVolume === 0 ? 'BGM消音中' : doc?.hidden ? 'BGM一時停止中' : '操作するとBGMを再生します';
      syncControls();
      return;
    }
    try {
      if (!active) {
        if (typeof globalThis.Audio !== 'function') {
          message = 'この環境ではBGMを再生できません';
          syncControls();
          return;
        }
        const media = new globalThis.Audio();
        media.preload = 'metadata';
        media.loop = true;
        media.src = tracks[intended];
        active = { media, state: 'paused' };
        const entry = active;
        media.addEventListener?.('error', () => {
          if (active !== entry) return;
          entry.state = 'failed';
          try { media.pause(); } catch {}
          message = 'BGMを再生できません。音声操作で再試行します';
          syncControls();
        });
      }
      const entry = active;
      entry.media.volume = settings.bgmVolume;
      if (entry.state === 'playing' || entry.state === 'pending' || entry.state === 'failed' && !retry) return;
      entry.state = 'pending';
      Promise.resolve(entry.media.play()).then(() => {
        if (active !== entry) { try { entry.media.pause(); } catch {} return; }
        if (entry.state === 'failed') { try { entry.media.pause(); } catch {} return; }
        entry.state = 'playing';
        message = intended === 'battle' ? '戦闘BGM再生中' : intended === 'forest_edge' ? '灰灯の林縁BGM再生中' : intended in tracks && intended !== 'town' ? '探索BGM再生中' : '街BGM再生中';
        syncControls();
      }, () => {
        if (active !== entry) { try { entry.media.pause(); } catch {} return; }
        entry.state = 'failed';
        try { entry.media.pause(); } catch {}
        message = 'BGMを再生できません。音声操作で再試行します';
        syncControls();
      });
    } catch {
      if (active) active.state = 'failed';
      pause();
      message = 'この環境ではBGMを再生できません';
      syncControls();
    }
  }
  function applySE() {
    if (!seOutput) return;
    try {
      seOutput.gain.setValueAtTime(settings.seMuted ? 0 : settings.seVolume, seContext.currentTime);
    } catch {}
  }
  function set(key, value) {
    if (!Object.hasOwn(defaults, key) || !valid(key, value)) return false;
    settings = Object.freeze({ ...settings, [key]: value });
    try { globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify(settings)); } catch {}
    applySE();
    reconcile(true);
    syncControls();
    return true;
  }
  function resolveContext(context) {
    if (context === 'battle') return 'battle';
    if (context && tracks[context]) return context;
    if (typeof s !== 'undefined' && s) {
      if (s.battle) return 'battle';
      if (s.view === 'explore' && s.dungeon?.mapId && tracks[s.dungeon.mapId]) return s.dungeon.mapId;
      if (s.view === 'explore' && s.dungeon) return 'dungeon_default';
    }
    return 'town';
  }
  function setContext(context) {
    const next = resolveContext(context);
    if (intended === next) return;
    pause();
    active = null;
    intended = next;
    reconcile();
  }
  function gesture(event) {
    if (event.isTrusted === false || event.type === 'keydown' && (event.repeat || ['Shift', 'Control', 'Alt', 'Meta', 'Escape'].includes(event.key))) return;
    const first = !unlocked;
    unlocked = true;
    // Resume SE from the gesture too, not only from later automatic game actions.
    try { if (seContext?.state === 'suspended') seContext.resume()?.catch(() => {}); } catch {}
    if (first || active?.state === 'failed') reconcile(true);
  }
  globalThis.BRPGAudio = Object.freeze({
    get settings() { return settings; },
    set, setContext,
    registerSEOutput(context, output) { seContext = context; seOutput = output; applySE(); }
  });
  doc?.addEventListener?.('pointerdown', gesture, true);
  doc?.addEventListener?.('keydown', gesture, true);
  doc?.addEventListener?.('visibilitychange', () => reconcile(true));
  doc?.addEventListener?.('input', event => {
    const node = event.target?.closest?.('[data-audio-volume]');
    if (node && node.value !== '') set(node.dataset.audioVolume + 'Volume', Number(node.value) / 100);
  });
  doc?.addEventListener?.('click', event => {
    const node = event.target?.closest?.('[data-audio-mute]');
    if (!node) return;
    const key = node.dataset.audioMute + 'Muted';
    if (Object.hasOwn(defaults, key)) set(key, !settings[key]);
  });
  if (typeof render === 'function') {
    const previousRender = render;
    render = function(...args) {
      const result = previousRender.apply(this, args);
      try {
        const nextCtx = typeof s !== 'undefined' && s?.battle
          ? 'battle'
          : (typeof s !== 'undefined' && s?.view === 'explore' && s?.dungeon?.mapId ? s.dungeon.mapId : 'town');
        setContext(nextCtx);
        syncControls();
      } catch {}
      return result;
    };
  }
  doc?.addEventListener?.('DOMContentLoaded', syncControls);
  if (typeof s !== 'undefined') {
    if (s.battle) setContext('battle');
    else if (s.view === 'explore' && s.dungeon?.mapId) setContext(s.dungeon.mapId);
  }
  syncControls();
})();
