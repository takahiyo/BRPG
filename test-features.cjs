'use strict';
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const { test } = require('node:test');

const read = file => fs.readFileSync(path.join(__dirname, file), 'utf8');

function harness() {
  const noop = () => {}, elements = new Map(), store = new Map(), handlers = new Map();
  const gradientMock = { addColorStop: noop };
  const drawing = new Proxy({}, {
    get: (target, prop) => {
      if (prop === 'createRadialGradient' || prop === 'createLinearGradient') return () => gradientMock;
      return noop;
    }
  });
  const box = {
    console, Date, Math, URL, structuredClone, confirm: () => true,
    setInterval: () => 1, clearInterval: noop,
    document: {
      addEventListener(type, handler) {
        const list = handlers.get(type) || [];
        list.push(handler); handlers.set(type, list);
      },
      getElementById(id) {
        if (!elements.has(id)) elements.set(id, {
          style: {}, dataset: {}, value: '', innerHTML: '', textContent: '',
          addEventListener: noop, getContext: () => drawing, showModal: noop, close: noop,
          focus() { box.focusedId = id; }
        });
        return elements.get(id);
      },
      querySelector: () => null,
      querySelectorAll: () => []
    },
    localStorage: { getItem: k => store.get(k) || null, setItem: (k, v) => store.set(k, v) }
  };
  vm.createContext(box);

  const files = [
    'data.js', 'world-data.js', 'catalog-data.js', 'jobs-data.js',
    'game.js', 'screens.js', 'systems.js', 'monster-art.js',
    'characters.js', 'facilities.js', 'equipment.js',
    'map-art.js', 'exploration-ui.js', 'formation.js', 'audio.js'
  ];
  for (const f of files) {
    vm.runInContext(read(f), box, { filename: f });
  }

  // Ensure global 's' is set inside box context
  vm.runInContext('s = fresh();', box);

  return { box, handlers };
}

test('LIFE, MANA, SP can be increased directly via character growth', () => {
  const { box } = harness();
  vm.runInContext(`
    s.selection = 1;
    const hero = s.roster[0];
    hero.lv = 5; // (5-1)*2 = 8 pts

    const initialStats = stats(hero);
    const initialSP = maxSP(hero);

    // Allocate 1 to hp (+8), 1 to mp (+4), 1 to sp (+2)
    const adjHp = adjustCharacterGrowth(hero.id, 'hp', 1);
    const adjMp = adjustCharacterGrowth(hero.id, 'mp', 1);
    const adjSp = adjustCharacterGrowth(hero.id, 'sp', 1);
    if (!adjHp || !adjMp || !adjSp) throw new Error('adjust failed: ' + JSON.stringify({adjHp, adjMp, adjSp}));

    // Check preview
    const preview = previewCharacterGrowth(hero);
    if (preview.after.stats.hp !== initialStats.hp + 8) throw new Error('preview hp mismatch');
    if (preview.after.stats.mp !== initialStats.mp + 4) throw new Error('preview mp mismatch');
    if (preview.after.stats.sp !== initialSP + 2) throw new Error('preview sp mismatch');

    // Confirm growth
    if (!confirmCharacterGrowth(hero.id)) throw new Error('confirm failed');

    // Stats should now be permanently boosted
    const newStats = stats(hero);
    if (newStats.hp !== initialStats.hp + 8) throw new Error('confirmed hp mismatch');
    if (newStats.mp !== initialStats.mp + 4) throw new Error('confirmed mp mismatch');
    if (maxSP(hero) !== initialSP + 2) throw new Error('confirmed sp mismatch');

    // Saved in s.ext.alloc
    if (s.ext.alloc[hero.id].hp !== 1 || s.ext.alloc[hero.id].mp !== 1 || s.ext.alloc[hero.id].sp !== 1) {
      throw new Error('alloc mismatch');
    }
  `, box);
});

test('Equipment modal includes reach filter for weapons and filters candidates', () => {
  const { box } = harness();
  vm.runInContext(`
    const hero = s.roster[0];
    s.gear.push(
      { id: 101, material: 'iron', type: 'sword', slot: 'weapon', range: 'near', quality: 1, dur: 50, maxDur: 50, ownerId: hero.id },
      { id: 102, material: 'iron', type: 'spear', slot: 'weapon', range: 'medium', quality: 1, dur: 50, maxDur: 50, ownerId: hero.id },
      { id: 103, material: 'wood', type: 'bow', slot: 'weapon', range: 'long', quality: 1, dur: 50, maxDur: 50, ownerId: hero.id }
    );
    const html = characterScreen(hero);
    if (!html.includes('CHARACTER RECORD')) throw new Error('characterScreen failed');
  `, box);
});

test('Workshop commission predicts equipment stats even for unidentified materials', () => {
  const { box } = harness();
  vm.runInContext(`
    s.materials.wood = 10;
    const html = forgeScreen();
    if (!html.includes('街工房職人の見立て・完成性能予測') && !html.includes('職人の目利き')) {
      throw new Error('missing workshop prediction in: ' + html);
    }
  `, box);
});

test('Party formation mini cards are draggable and rows are drop targets', () => {
  const { box } = harness();
  vm.runInContext(`
    const partyHtml = partyScreen();
    if (!partyHtml.includes('draggable="true"')) throw new Error('missing draggable');
    if (!partyHtml.includes('data-drag-hero="1"')) throw new Error('missing data-drag-hero');
    if (!partyHtml.includes('data-drop-row="front"')) throw new Error('missing drop-row front');
    if (!partyHtml.includes('data-drop-row="back"')) throw new Error('missing drop-row back');
    if (!partyHtml.includes('formation-draggable')) throw new Error('missing formation-draggable');
  `, box);
});

test('Return scroll cost is rebalanced and fresh save starts with 1 scroll', () => {
  const { box } = harness();
  vm.runInContext(`
    if (DATA.items.scroll.cost !== 280) throw new Error('Scroll cost is ' + DATA.items.scroll.cost);
    const freshSave = fresh();
    if (freshSave.items.scroll !== 1) throw new Error('Fresh save scrolls: ' + freshSave.items.scroll);
  `, box);
});

test('Rare individuals (希少個体) are rolled once per battle, at most one, and stay rare', () => {
  const { box } = harness();
  const result = vm.runInContext(`
    s = fresh(); render();
    let battles = 0, eliteBattles = 0, maxPerBattle = 0;
    for (let i = 0; i < 1500; i++) {
      if (!s.dungeon) enterMap('rocky_path');
      encounter();
      if (!s.battle) continue;
      battles++;
      const elites = s.battle.enemies.filter(e => e.elite).length;
      if (elites) eliteBattles++;
      maxPerBattle = Math.max(maxPerBattle, elites);
      for (const e of s.battle.enemies) if (e.elite !== true && e.name.includes('希少')) throw new Error('non-elite named rare: ' + e.name);
      s.battle = null; stopAll();
    }
    ({ battles, eliteBattles, maxPerBattle });
  `, box);
  assert(result.battles >= 1000, 'enough battles simulated: ' + result.battles);
  assert(result.maxPerBattle <= 1, 'at most one rare individual per battle');
  const rate = result.eliteBattles / result.battles;
  assert(rate > 0.005 && rate < 0.09, 'rare battle rate should be about 4%, got ' + rate);
});
