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
    console, Date, Math, URL, structuredClone, confirm: () => true, assert,
    setInterval: () => 1, clearInterval: noop,
    document: {
      addEventListener(type, handler) {
        const list = handlers.get(type) || [];
        list.push(handler); handlers.set(type, list);
      },
      getElementById(id) {
        if (!elements.has(id)) elements.set(id, {
          style: {}, dataset: {}, value: '', innerHTML: '', textContent: '',
          addEventListener: noop, getContext: () => drawing,
          showModal() { this.open = true; },
          close() { this.open = false; },
          open: false,
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

  // Ensure global 's' is set inside box context and boot listeners are registered
  vm.runInContext('boot(); s = fresh();', box);

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

test('Equipment modal includes reach filter for weapons, handles filter clicks and close button', () => {
  const { box, handlers } = harness();
  box.dispatch = function(type, dataset) {
    const target = { dataset, tagName: 'BUTTON', disabled: false, closest: () => target };
    const event = { target, stopped: false, stopImmediatePropagation() { this.stopped = true; }, preventDefault() {} };
    for (const handler of (handlers.get(type) || [])) {
      handler(event);
      if (event.stopped) break;
    }
  };
  vm.runInContext(`
    const hero = s.roster[0];
    s.selection = hero.id;
    s.gear.push(
      { id: 101, material: 'iron', type: 'sword', slot: 'weapon', range: 'near', quality: 1, dur: 50, maxDur: 50, ownerId: hero.id },
      { id: 102, material: 'iron', type: 'spear', slot: 'weapon', range: 'medium', quality: 1, dur: 50, maxDur: 50, ownerId: hero.id },
      { id: 103, material: 'wood', type: 'bow', slot: 'weapon', range: 'long', quality: 1, dur: 50, maxDur: 50, ownerId: hero.id }
    );
    // Open equipment dialog for weapon
    dispatch('click', { action: 'character-slot', id: String(hero.id), slot: 'weapon' });
    const dialog = document.getElementById('equipment-dialog');
    assert.equal(dialog.open, true, 'dialog opens');
    assert(dialog.innerHTML.includes('data-reach="long"'), 'includes reach filter buttons');

    // Click long range filter
    dispatch('click', { action: 'equipment-reach-filter', reach: 'long' });
    const bodyHtml = document.getElementById('equipment-dialog-body').innerHTML;
    assert(bodyHtml.includes('硬木の弓'), 'includes long range bow');
    assert(!bodyHtml.includes('石の剣'), 'excludes near range sword');

    // Click close button
    dispatch('click', { action: 'equipment-dialog-close' });
    assert.equal(dialog.open, false, 'dialog closes on equipment-dialog-close');
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

test('Dungeon recommended level reflects practical clearing level (6-hero, full gear, <=3 items to boss)', () => {
  const { box } = harness();
  box.assert = assert;
  vm.runInContext(`
    s = fresh();
    const forest = worldMap('forest_edge');
    assert.equal(forest.recommendedLevel, 4, 'forest_edge recommended level is 4 (not 1)');
    const rocky = worldMap('rocky_path');
    assert.equal(rocky.recommendedLevel, 6, 'rocky_path recommended level is 6 (not 2)');
    const mine = worldMap('old_mine');
    assert.equal(mine.recommendedLevel, 8, 'old_mine recommended level is 8 (not 3)');

    // Screens reflect recommendedLevel in atlas cards
    s.view = 'atlas';
    const html = atlasScreen();
    assert(html.includes('推奨 Lv.4 · 2層'), 'Atlas card displays Recommended Lv.4 for forest_edge');
    assert(html.includes('推奨 Lv.6 · 2層'), 'Atlas card displays Recommended Lv.6 for rocky_path');
    assert(html.includes('推奨 Lv.8 · 3層'), 'Atlas card displays Recommended Lv.8 for old_mine');

    // Generated address blueprint assigns sensible recommendedLevel
    const bp = addressBlueprint('https://test.example.com/dungeon');
    assert(bp.map.recommendedLevel >= bp.map.level, 'Address map assigns recommendedLevel >= base level');
  `, box);
});

test('Dungeon map dynamic scaling, Wizardry-style vertical floor stairs alignment, and RPG gimmicks', async () => {
  const { box } = harness();
  vm.runInContext(`
    // 1. Dynamic Map Dimensions by depth & difficulty
    const forest = worldMap('forest_edge'); // recLv 4, 2 depths
    const f1 = makeFloor(forest, 100, 1);
    assert.equal(f1.map[0].length, 19, 'B1F width is 19');
    assert.equal(f1.map.length, 13, 'B1F height is 13');

    const f2 = makeFloor(forest, 100, 2);
    assert.equal(f2.map[0].length, 21, 'B2F width is expanded to 21');
    assert.equal(f2.map.length, 15, 'B2F height is expanded to 15');

    const rift = worldMap('star_rift'); // recLv 200, lv 80
    const sr1 = makeFloor(rift, 200, 1);
    assert.equal(sr1.map[0].length, 23, 'High difficulty star_rift B1F width is expanded to 23');
    assert.equal(sr1.map.length, 15, 'High difficulty star_rift B1F height is expanded to 15');

    // 2. Wizardry-style vertical alignment
    enterMap('rocky_path'); // 2 depths
    const d1 = s.dungeon;
    assert.equal(d1.depth, 1);
    const downX = d1.downX, downY = d1.downY;
    assert(downX !== 1 || downY !== 1, 'Stairs down is not stuck at (1,1)');
    assert(d1.map[downY][downX] === '>', 'Stairs down tile is placed at (downX, downY)');

    // Move to stairs down and descend
    d1.x = downX;
    d1.y = downY;
    descend();
    const d2 = s.dungeon;
    assert.equal(d2.depth, 2, 'Descended to B2F');
    assert.equal(d2.x, downX, 'Player starts at same coordinates (downX) on B2F');
    assert.equal(d2.y, downY, 'Player starts at same coordinates (downY) on B2F');
    assert.equal(d2.map[downY][downX], '<', 'Up stairs on B2F is at exact matching coordinates');

    // Ascend back to B1F
    ascend();
    assert.equal(s.dungeon.depth, 1, 'Ascended back to B1F');
    assert.equal(s.dungeon.x, downX, 'Player returns to stairs down coordinates on B1F');
    assert.equal(s.dungeon.y, downY, 'Player returns to stairs down coordinates on B1F');

    // 3. Gimmicks: Conveyor, Oneway, Switch & Door, Pit
    const d = s.dungeon;
    d.sinceBattle = -999; // prevent random encounter during movement checks
    d.gimmicks = d.gimmicks || {};
    // Place a conveyor pushing East at (d.x+1, d.y) if open
    const cx = d.x + 1, cy = d.y;
    d.map[cy][cx] = '.';
    d.map[cy][cx + 1] = '.';
    d.gimmicks[\`\${cx},\${cy}\`] = { type: 'conveyor', dir: 'E' };
    step(1, 0, false);
    assert.equal(d.x, cx + 1, 'Conveyor pushed player one extra tile East to cx + 1');

    // Test Oneway door
    const ox = d.x + 1, oy = d.y;
    d.map[oy][ox] = '.';
    d.gimmicks[\`\${ox},\${oy}\`] = { type: 'oneway', allow: 'W' }; // allows only stepping West
    const startX = d.x;
    step(1, 0, false); // Step East into West-only door -> should block
    assert.equal(d.x, startX, 'Stepping against one-way passage is blocked');

    // Test Switch and Locked Door
    const sx = d.x, sy = d.y + 1; // place switch
    const doorX = d.x - 1, doorY = d.y; // place locked door
    d.map[sy][sx] = '.';
    d.map[doorY][doorX] = '.';
    d.gimmicks[\`\${doorX},\${doorY}\`] = { type: 'door', id: 'door1', open: false };
    d.gimmicks[\`\${sx},\${sy}\`] = { type: 'switch', doorId: 'door1', pressed: false };

    // Try walking through locked door
    step(-1, 0, false);
    assert.equal(d.x, startX, 'Locked door blocks movement');

    // Step onto switch
    step(0, 1, false);
    assert.equal(d.x, sx, 'Moved onto switch');
    assert.equal(d.y, sy, 'Moved onto switch');
    assert(d.gimmicks[\`\${sx},\${sy}\`].pressed, 'Switch is pressed');
    assert(d.gimmicks[\`\${doorX},\${doorY}\`].open, 'Door is unlocked by switch');

    // Move back and walk through unlocked door
    step(0, -1, false);
    step(-1, 0, false);
    assert.equal(d.x, doorX, 'Unlocked door allows movement through');

    // Test Pit on multi-depth dungeon
    const pitX = d.x, pitY = d.y + 1;
    d.map[pitY][pitX] = '.';
    d.gimmicks[\`\${pitX},\${pitY}\`] = { type: 'pit' };
    const curDepth = d.depth;
    step(0, 1, false);
    assert.equal(s.dungeon.depth, curDepth + 1, 'Stepping into pit drops party to next depth');
    assert.equal(s.dungeon.x, pitX, 'Party drops to exact matching X coordinate on lower floor');
    assert.equal(s.dungeon.y, pitY, 'Party drops to exact matching Y coordinate on lower floor');
  `, box);
});

test('Dragon Quest style command battle flow and party-wide escape', async () => {
  const { box } = harness();
  vm.runInContext(`
    enterMap('forest_edge');
    encounter();
    assert(s.battle, 'Encounter started');
    const heroes = getOrderedHeroes();
    assert(heroes.length >= 4, 'Heroes in battle');

    // 1. UI renders DQ-style commands and party overview
    const panelHTML = uiBattlePanel();
    assert(panelHTML.includes('exp-dq-console'), 'Renders DQ-style battle console');
    assert(panelHTML.includes('🏃 にげる (全体)'), 'Contains party-wide escape button');
    assert(panelHTML.includes('たたかう (攻撃)'), 'Contains attack command');
    assert(panelHTML.includes('ぼうぎょ (防御)'), 'Contains defend command');
    assert(panelHTML.includes('は どうする？'), 'Prompts current hero in DQ style');

    // 2. Click "Defend" on hero 1 -> automatically advances to hero 2
    const h1 = heroes[0], h2 = heroes[1];
    assert.equal(s.battle.actor, h1.id, 'First actor is hero 1');
    const clickEv = action => ({
      target: {
        closest: selector => selector === '[data-action]' ? { dataset: { action }, disabled: false } : null
      }
    });

    handleAction(clickEv('dq-cmd-defend'));
    assert(s.battle.plans[h1.id], 'Hero 1 command is planned');
    assert.equal(s.battle.plans[h1.id].command, 'defend');
    assert.equal(s.battle.actor, h2.id, 'Automatically advanced to hero 2');

    // 3. Click "Back" -> reverts hero 1 and returns to hero 1
    handleAction(clickEv('dq-back-hero'));
    assert(!s.battle.plans[h1.id], 'Hero 1 plan is cleared by back action');
    assert.equal(s.battle.actor, h1.id, 'Returned to hero 1');

    // 4. Click "Attack" on single enemy -> automatically targets and advances to next hero
    s.battle.enemies = [s.battle.enemies[0]]; // force 1 enemy
    handleAction(clickEv('dq-cmd-attack'));
    assert(s.battle.plans[h1.id], 'Hero 1 planned attack');
    assert.equal(s.battle.plans[h1.id].command, 'attack');
    assert.equal(s.battle.actor, h2.id, 'Advanced to hero 2 after 1-tap attack');

    // 5. Party-wide escape test
    // Test boss escape block
    s.battle.boss = true;
    const escapedBoss = partyEscape();
    assert.equal(escapedBoss, false, 'Party escape fails on boss');
    assert(s.battle, 'Still in battle against boss');

    // Test regular party-wide escape
    s.battle.boss = false;
    const origRandom = random;
    random = () => 0.01; // ensure escape success
    try {
      const escaped = partyEscape();
      assert.equal(escaped, true, 'Party escape succeeded');
      assert.equal(s.battle, null, 'Battle ended immediately upon party escape');
      assert.equal(s.view, 'explore', 'Returned to exploration view');
    } finally {
      random = origRandom;
    }
  `, box);
});


