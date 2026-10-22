'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function harness() {
  const box = {
    console, setTimeout, clearTimeout, setInterval, clearInterval,
    Math, Date, Array, Object, String, Number, RegExp, Set, Map, JSON, Error, TypeError,
    structuredClone: x => JSON.parse(JSON.stringify(x))
  };
  const doc = {
    addEventListener: () => {},
    getElementById: id => ({
      getContext: () => ({
        fillRect() {}, beginPath() {}, arc() {}, fill() {}, stroke() {},
        moveTo() {}, lineTo() {}, closePath() {}, fillText() {}, createRadialGradient: () => ({ addColorStop() {} })
      }),
      getBoundingClientRect: () => ({ left: 0, top: 0, width: 936, height: 648 }),
      showModal() {}, close() {}, open: false
    }),
    querySelector: () => null,
    querySelectorAll: () => []
  };
  box.document = doc;
  box.window = box;
  box.globalThis = box;
  box.$ = id => doc.getElementById(id);
  box.assert = assert;

  const scripts = [
    'data.js', 'world-data.js', 'catalog-data.js', 'jobs-data.js',
    'game.js', 'screens.js', 'systems.js', 'characters.js',
    'facilities.js', 'equipment.js', 'exploration-ui.js', 'formation.js'
  ];
  vm.createContext(box);
  for (const f of scripts) {
    const src = fs.readFileSync(f, 'utf8');
    vm.runInContext(src, box, { filename: f });
  }
  box.run = code => vm.runInContext(code, box);
  return box;
}

test('RecentLog consecutive duplicate compression and expand toggle', () => {
  const box = harness();
  box.run(`
    s = fresh();
    render();
    tell('帰還後に利用できます。');
    assert.equal(s.log[0], '帰還後に利用できます。');
    assert.equal(s.log.length, 2);

    tell('帰還後に利用できます。');
    assert.equal(s.log[0], '帰還後に利用できます。 *2');
    assert.equal(s.log.length, 2, 'Consecutive message must not consume new lines');

    tell('帰還後に利用できます。');
    assert.equal(s.log[0], '帰還後に利用できます。 *3');
    assert.equal(s.log.length, 2);

    tell('別のメッセージ');
    assert.equal(s.log[0], '別のメッセージ');
    assert.equal(s.log[1], '帰還後に利用できます。 *3');
    assert.equal(s.log.length, 3);

    // Expand toggle
    assert(!s.ext?.logExpanded);
    const htmlCollapsed = logHTML(6);
    assert(!htmlCollapsed.includes('expanded'));

    handleAction({ target: { closest: () => ({ dataset: { action: 'toggle-log-expand' }, disabled: false }) } });
    assert(s.ext?.logExpanded);
    const htmlExpanded = logHTML(6);
    assert(htmlExpanded.includes('expanded'));
  `);
});

test('Explored map tiles and cleared floors are preserved without resetting to dark fog', () => {
  const box = harness();
  box.run(`
    s = fresh();
    enterMap('forest_edge');
    const d1 = s.dungeon;
    assert(d1);

    // Step eastward to discover more tiles
    step(1, 0); // (2, 1)
    step(1, 0); // (3, 1)
    const discoveredX = d1.x, discoveredY = d1.y;
    assert(d1.seen[discoveredY][discoveredX]);

    // Return to town
    returnTown();
    assert(!s.dungeon);

    // Re-enter forest_edge: previously seen tiles must still be seen!
    enterMap('forest_edge');
    const d2 = s.dungeon;
    assert.equal(d2.x, 1);
    assert.equal(d2.y, 1);
    assert(d2.seen[discoveredY][discoveredX], 'Previously discovered tile must remain seen upon re-entry');

    // Once a map is cleared (completed quest), floor is completely revealed
    s.quests.forest_edge = { completed: true };
    returnTown();
    enterMap('forest_edge');
    const d3 = s.dungeon;
    assert(d3.seen[11][17], 'Cleared floor must have exit/boss tile fully visible from the start');
    assert(d3.seen[5][5], 'Cleared floor must not be dark fog');
  `);
});

test('Map click-to-walk requires explorer or survey_walk book and paths toward tile', () => {
  const box = harness();
  box.run(`
    s = fresh();
    enterMap('forest_edge');
    const d = s.dungeon;

    // Party initially has an explorer
    assert(BRPGFacilities.canClickWalk(), 'Default starter party includes explorer');

    let targetX = -1, targetY = -1;
    for (const [dx, dy] of DIRS) {
      if (d.map[d.y + dy]?.[d.x + dx] === '.') {
        targetX = d.x + dx;
        targetY = d.y + dy;
        break;
      }
    }
    assert(targetX >= 0);

    // Click to walk toward that tile
    BRPGExplorationUI.walkTowardTile(targetX, targetY);
    assert.equal(s.dungeon.x, targetX);
    assert.equal(s.dungeon.y, targetY);

    // Remove explorer from party to test restriction
    const nonExplorers = s.roster.filter(h => h.job !== 'explorer').map(h => h.id);
    s.active = nonExplorers.slice(0, 3);
    assert(!BRPGFacilities.canClickWalk(), 'Party without explorer cannot click-walk initially');

    BRPGExplorationUI.walkTowardTile(1, 1);
    assert.match(s.log[0], /測量踏破の手引書/);

    // Learning survey_walk book enables click walk even without explorer!
    s.books.push('survey_walk');
    s.ext.facilityRules.owned.push('survey_walk');
    s.roster.forEach(h => { h.lv = 25; });
    assert(BRPGFacilities.canClickWalk(), 'Having survey_walk enables click-walk without explorer');
    BRPGExplorationUI.walkTowardTile(1, 1);
    assert.equal(s.dungeon.x, 1);
    assert.equal(s.dungeon.y, 1);
  `);
});

console.log('PASS: RecentLog repeat counts, expand toggle, explored fog persistence, and click-to-walk with survey_walk.');
