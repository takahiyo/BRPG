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

test('Multi-floor dungeon traversal: depth > 1 has stairs-up (ascend) instead of town exit, requires returning to 1F on foot', () => {
  const box = harness();
  box.run(`
    s = fresh();
    enterMap('forest_edge');
    assert.equal(s.dungeon.depth, 1);
    assert.equal(s.dungeon.x, 1);
    assert.equal(s.dungeon.y, 1);

    // On 1F (1, 1), free walk-out to town is permitted without scrolls
    s.items.scroll = 0;
    returnTown();
    assert(!s.dungeon, 'Free exit allowed on 1F (1, 1)');

    // Re-enter and move to stairs down on 1F
    enterMap('forest_edge');
    s.dungeon.x = 17; s.dungeon.y = 11;
    assert.equal(s.dungeon.map[11][17], '>');
    descend();

    // Now on 2F (depth 2) at (1, 1)
    const d2 = s.dungeon;
    assert.equal(d2.depth, 2);
    assert.equal(d2.x, 1);
    assert.equal(d2.y, 1);
    assert.equal(d2.map[1][1], '<', '2F (1, 1) is stairs up tile (<), not exit');

    // On 2F (1, 1), walking directly to town without scrolls is BLOCKED!
    returnTown();
    assert(s.dungeon, 'Cannot walk directly to town from 2F');
    assert.equal(s.dungeon.depth, 2);
    assert.match(s.log[0], /1階の地上出口へ戻る必要があります/);

    // Using ascend() moves from 2F back to 1F at the stairs position (17, 11)
    ascend();
    assert.equal(s.dungeon.depth, 1, 'Ascending from 2F returns to 1F');
    assert.equal(s.dungeon.x, 17);
    assert.equal(s.dungeon.y, 11);

    // Walk back to 1F (1, 1) and exit to town
    s.dungeon.x = 1; s.dungeon.y = 1;
    returnTown();
    assert(!s.dungeon, 'Exited to town from 1F (1, 1)');

    // Test multi-floor step-by-step retreat: Descend to 3F in old_mine (depths: 3)
    enterMap('old_mine'); // 1F
    s.dungeon.x = 17; s.dungeon.y = 11;
    descend(); // to 2F
    assert.equal(s.dungeon.depth, 2);
    s.dungeon.x = 17; s.dungeon.y = 11;
    descend(); // to 3F
    assert.equal(s.dungeon.depth, 3);
    assert.equal(s.dungeon.x, 1); assert.equal(s.dungeon.y, 1);

    // On 3F (1, 1): cannot exit to town on foot
    returnTown();
    assert.equal(s.dungeon.depth, 3);

    // Ascend 3F -> 2F
    ascend();
    assert.equal(s.dungeon.depth, 2);
    assert.equal(s.dungeon.x, 17); assert.equal(s.dungeon.y, 11);

    // Walk on 2F to (1, 1) and ascend 2F -> 1F
    s.dungeon.x = 1; s.dungeon.y = 1;
    ascend();
    assert.equal(s.dungeon.depth, 1);
    assert.equal(s.dungeon.x, 17); assert.equal(s.dungeon.y, 11);

    // Finally walk to 1F (1, 1) and exit to town
    s.dungeon.x = 1; s.dungeon.y = 1;
    returnTown();
    assert(!s.dungeon, 'Successfully returned to town step-by-step from 3F -> 2F -> 1F');

    // Return scroll (teleport) works from any deep floor
    enterMap('old_mine');
    s.dungeon.x = 17; s.dungeon.y = 11;
    descend(); // 2F
    s.dungeon.x = 17; s.dungeon.y = 11;
    descend(); // 3F
    s.items.scroll = 2;
    returnTown();
    assert(!s.dungeon, 'Return scroll escapes directly from 3F');
    assert.equal(s.items.scroll, 1, 'Consumed 1 return scroll');
  `);
});

console.log('PASS: RecentLog repeat counts, expand toggle, explored fog persistence, and click-to-walk with survey_walk.');
