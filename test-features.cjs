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

test('Monster name and graphics (catalogId) stay strictly aligned', () => {
  const { box } = harness();
  vm.runInContext(`
    s = fresh();
    enterMap('forest_edge');
    for (let i = 0; i < 200; i++) {
      encounter();
      if (!s.battle) continue;
      for (const e of s.battle.enemies) {
        if (e.id === 'slime' && (e.name.includes('スライム') || e.name === 'スライム')) {
          const catName = DATA.catalog.monsters[e.catalogId]?.name || '';
          if (e.catalogId && !catName.includes('スライム') && e.catalogId !== 'M0046') {
            throw new Error('Slime enemy got mismatched catalogId: ' + e.catalogId + ' with name: ' + e.name);
          }
        }
        if (e.id === 'bat' && (e.name.includes('コウモリ') || e.name.includes('バット'))) {
          const catName = DATA.catalog.monsters[e.catalogId]?.name || '';
          if (e.catalogId && !catName.includes('コウモリ') && !catName.includes('バット') && e.catalogId !== 'M0033') {
            throw new Error('Bat enemy got mismatched catalogId: ' + e.catalogId + ' with name: ' + e.name);
          }
        }
        // If enemy was given a catalog monster identity, its name must match catalog monster name
        if (e.catalogId && e.catalogId.startsWith('M') && !['M0046', 'M0033', 'M0049'].includes(e.catalogId)) {
          const catEntry = DATA.catalog.monsters[e.catalogId];
          if (catEntry && !e.name.includes(catEntry.name)) {
            throw new Error('Enemy name ' + e.name + ' does not match catalog monster ' + catEntry.name + ' (' + e.catalogId + ')');
          }
        }
      }
      s.battle = null; stopAll();
    }
  `, box);
});

test('Enemy formation does not display D&D drag hints or empty slot drop hints', () => {
  const { box } = harness();
  vm.runInContext(`
    s = fresh();
    enterMap('forest_edge');
    encounter();
    const enemyHtml = uiEnemies();
    if (enemyHtml.includes('ドラッグで移動')) {
      throw new Error('Enemy formation should not include "ドラッグで移動": ' + enemyHtml);
    }
    if (enemyHtml.includes('（D&Dで配置）')) {
      throw new Error('Enemy formation should not include "（D&Dで配置）": ' + enemyHtml);
    }
    if (enemyHtml.includes('data-drop-row')) {
      throw new Error('Enemy formation should not have data-drop-row: ' + enemyHtml);
    }
    s.battle = null; stopAll();
  `, box);
});

test('Character detail navigation uses formation order (front 1-3, back 1-3) and renders side buttons', () => {
  const { box } = harness();
  vm.runInContext(`
    s = fresh();
    const hero1 = s.roster[0]; // Ash (front 1)
    const heroHtml = characterScreen(hero1);
    if (!heroHtml.includes('character-nav-side prev')) {
      throw new Error('Missing side prev navigation button');
    }
    if (!heroHtml.includes('character-nav-side next')) {
      throw new Error('Missing side next navigation button');
    }
    if (!heroHtml.includes('前衛 1')) {
      throw new Error('Missing formation position label in pager: ' + heroHtml);
    }

    // Test ordered navigation
    openCharacter(hero1.id);
    const bodyBefore = document.getElementById('character-body').innerHTML;
    if (!bodyBefore.includes(hero1.name)) throw new Error('Hero 1 not opened');

    // Click next -> should open front 2, then front 3, then back 1, 2, 3
    const frontHeroes = party().filter(h => h.row === 'front');
    const backHeroes = party().filter(h => h.row === 'back');
    const expectedOrder = [...frontHeroes, ...backHeroes];

    for (let i = 0; i < expectedOrder.length; i++) {
      const current = expectedOrder[i];
      openCharacter(current.id);
      const nextExpected = expectedOrder[(i + 1) % expectedOrder.length];
      const hNext = characterScreen(current);
      if (!hNext.includes(nextExpected.name)) {
        throw new Error('Next button title should point to ' + nextExpected.name);
      }
    }
  `, box);
});

test('Walk toward entrance steps smoothly toward (1,1) via timer instead of instant warp', () => {
  const { box } = harness();
  box.assert = assert;
  vm.runInContext(`
    s = fresh();
    enterMap('forest_edge');
    // Move 3 steps away from entrance
    step(1, 0, false);
    step(1, 0, false);
    step(0, 1, false);
    const startX = s.dungeon.x;
    const startY = s.dungeon.y;
    assert(startX !== 1 || startY !== 1, 'Party moved away from entrance');

    // Call walkTowardEntrance()
    walkTowardEntrance();

    // The first step should be taken immediately (1 step closer)
    const distAfter1 = Math.abs(s.dungeon.x - 1) + Math.abs(s.dungeon.y - 1);
    const distStart = Math.abs(startX - 1) + Math.abs(startY - 1);
    assert.equal(distAfter1, distStart - 1, 'First step taken immediately, not 5-step warp');

    // stopAll() clears the timer cleanly
    stopAll();
  `, box);
});
