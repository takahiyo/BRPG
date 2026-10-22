'use strict';
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const { test } = require('node:test');
const read = file => fs.readFileSync(path.join(__dirname, file), 'utf8');

function harness(register = true) {
  const noop = () => {}, elements = new Map(), store = new Map(), handlers = new Map();
  const drawing = new Proxy({}, { get: () => noop });
  const box = { console, Date, Math, URL, structuredClone, confirm: () => true,
    setInterval: () => 1, clearInterval: noop,
    document: { addEventListener(type, handler) {
      const list = handlers.get(type) || [];
      list.push(handler); handlers.set(type, list);
    }, getElementById(id) {
      if (!elements.has(id)) elements.set(id, { style: {}, dataset: {}, value: '', innerHTML: '', textContent: '',
        addEventListener: noop, getContext: () => drawing, showModal: noop, close: noop,
        focus() { box.focusedId = id; } });
      return elements.get(id);
    } },
    localStorage: { getItem: k => store.get(k) || null, setItem: (k, v) => store.set(k, v) }
  };
  vm.createContext(box);
  const run = code => vm.runInContext(code, box, { timeout: 20000 });
  for (const file of ['data.js', 'world-data.js', 'catalog-data.js', 'jobs-data.js', 'game.js', 'screens.js', 'systems.js']) {
    vm.runInContext(read(file), box, { filename: file });
  }
  const registry = box.BRPGMonsterArt;
  const before = run('JSON.stringify({enemies:DATA.enemies,bosses:DATA.bosses})');
  if (register) vm.runInContext(read('monster-art.js'), box, { filename: 'monster-art.js' });
  function change(value, overrides = {}) {
    const target = { id: 'monster-sheet-select', dataset: { monsterSheet: 'select' }, value, ...overrides };
    for (const handler of handlers.get('change') || []) handler({ target });
  }
  return { box, run, registry, before, change };
}

test('classic script requires systems first and populates the existing lexical registry', () => {
  assert.throws(() => vm.runInNewContext(read('monster-art.js')), /requires systems.js first/);
  const h = harness();
  assert.strictEqual(h.registry, h.box.BRPGMonsterArt);
  assert.equal(Object.keys(h.registry.cells).length, 21);
  assert.equal(Object.keys(h.registry.sheets).length, 2);
  const original = JSON.stringify(h.registry);
  h.run(read('monster-art.js'));
  assert.equal(JSON.stringify(h.registry), original, 'repeat load does not duplicate registrations');
});

test('every reviewed crop matches a manifest ID/name and lies inside a real PNG', () => {
  const { registry, box } = harness();
  const batches = JSON.parse(read('docs/monster-art/manifest.json')).batches;
  assert.equal(batches.length, 470);
  for (const [id, entry] of Object.entries(registry.cells)) {
    const planned = batches.find(b => b.id === id);
    assert(planned, id);
    assert.equal(entry.name, planned.name);
    assert.equal(entry.sheet, planned.sheet);
    assert.equal(entry.verified, true);
    const sheet = registry.sheets[entry.sheet];
    const png = fs.readFileSync(path.join(__dirname, sheet.src));
    assert.equal(png.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
    assert.equal(png.readUInt32BE(16), sheet.width);
    assert.equal(png.readUInt32BE(20), sheet.height);
    const r = entry.rect;
    assert([r.x, r.y, r.width, r.height].every(Number.isSafeInteger));
    assert(r.x >= 0 && r.y >= 0 && r.width > 0 && r.height > 0);
    assert(r.x + r.width <= sheet.width && r.y + r.height <= sheet.height, id);
    const html = box.monsterThumbHTML('', id);
    assert(html.includes(`href="${sheet.src}"`), id);
    assert(html.includes(`viewBox="${r.x} ${r.y} ${r.width} ${r.height}"`), id);
    assert(html.includes('preserveAspectRatio="xMidYMid meet"'));
    assert(html.includes('overflow="hidden"'), 'inner viewport must clip sheet neighbours');
  }
});

test('catalog actually renders reviewed discovered sprites but does not reveal undiscovered entries', () => {
  const h = harness();
  h.run("s=fresh();catalogScreen();s.ext.catalogTab='cat_mon';s.ext.discoveredMonsters={M0031:1,M0061:2,M0001:1}");
  const html = h.run('catalogScreen()');
  assert.equal((html.match(/class="monster-thumb"/g) || []).length, 2);
  assert(html.includes('aria-label="ホブゴブリン"'));
  assert(html.includes('aria-label="ヘルハウンド"'));
  assert(!html.includes('aria-label="河童"'));
});

test('missing 01, unreviewed cells and separate encounter IDs retain empty thumbnail fallback', () => {
  const h = harness();
  assert.equal(h.box.monsterThumbHTML('', 'M0001'), '');
  assert.equal(h.box.monsterThumbHTML('', 'M0039'), '');
  assert.equal(h.box.monsterThumbHTML('', 'M0042'), '');
  assert.equal(h.box.monsterThumbHTML('', 'M0391'), '');
  assert.equal(h.box.monsterThumbHTML('hobgoblin', ''), '');
  assert.equal(h.box.monsterThumbHTML('hellhound', ''), '');
  assert.equal(h.box.monsterThumbHTML(), '');
  assert.equal(h.run('JSON.stringify({enemies:DATA.enemies,bosses:DATA.bosses})'), h.before);
  assert(Object.keys(h.registry.cells).every(id => /^M\d{4}$/.test(id)), 'no guessed enemy aliases');
  assert(!Object.keys(h.registry.sheets).includes('catalog-01'));
  assert(!fs.readdirSync(__dirname).some(f => /^monsters_sheet01.*\.png$/.test(f)));
  assert.equal(h.box.monsterThumbHTML('unknown-enemy', 'M0031').includes('ホブゴブリン'), true, 'explicit catalog ID works');
  assert.equal(harness(false).box.monsterThumbHTML('', 'M0031'), '', 'safe before registration');
});

test('renderer rejects unapproved, malformed, fractional and out-of-bounds rectangles', () => {
  const h = harness(), cells = h.registry.cells;
  const original = JSON.parse(JSON.stringify(cells.M0031));
  for (const patch of [{ verified: false }, { verified: 'true' }, { sheet: 'missing' }, { rect: null },
    ...[{ x: -1 }, { y: -1 }, { width: 0 }, { height: -1 }, { x: 1145 }, { y: 1374 },
      { width: 1146 }, { height: 1375 }, { width: 0.5 }, { x: NaN }, { y: Infinity }, { x: '10' }]
      .map(change => ({ rect: { ...original.rect, ...change } }))]) {
    cells.M0031 = { ...original, ...patch };
    assert.equal(h.box.monsterThumbHTML('', 'M0031'), '', JSON.stringify(patch));
  }
});

test('renderer escapes labels and only accepts local root PNG paths, never CSS or executable URLs', () => {
  const h = harness(), entry = h.registry.cells.M0031, sheet = h.registry.sheets['catalog-02'];
  entry.name = '<img src=x onerror="bad()"> & \'test\'';
  const html = h.box.monsterThumbHTML('', 'M0031');
  assert(!html.includes('<img'));
  assert(html.includes('&lt;img'));
  assert(!html.includes('aria-label="<'));
  for (const src of ['javascript:alert(1)', 'https://example.com/art.png', '../art.png', 'art.png\" onload=\"bad', "art');color:red;.png", 'art.svg', 'art.png?x=1']) {
    sheet.src = src;
    assert.equal(h.box.monsterThumbHTML('', 'M0031'), '', src);
  }
  sheet.src = 'safe-art.png';
  assert(h.box.monsterThumbHTML('', 'M0031').includes('href="safe-art.png"'));
  sheet.width = '1145';
  assert.equal(h.box.monsterThumbHTML('', 'M0031'), '');
});

test('all 14 received PNGs remain byte-identical, including irregular sheets and 14 alt', () => {
  const records = [...read('docs/monster-art/RECEIVED_SHEETS.md').matchAll(/`(monsters_sheet\d+_[^`]+\.png)` \| (\d+)×(\d+) \| ([A-F0-9]{64})/g)];
  assert.equal(records.length, 14);
  for (const [, file, width, height, sha] of records) {
    const png = fs.readFileSync(path.join(__dirname, file));
    assert.equal(crypto.createHash('sha256').update(png).digest('hex').toUpperCase(), sha, file);
    assert.equal(png.readUInt32BE(16), Number(width), file);
    assert.equal(png.readUInt32BE(20), Number(height), file);
  }
});

test('preview metadata describes all 14 actual originals without approving additional sprites', () => {
  const h = harness(), sources = h.registry.sourceSheets;
  assert.equal(sources.length, 14);
  assert.equal(new Set(sources.map(sheet => sheet.id)).size, 14);
  assert(Object.isFrozen(sources));
  const records = [...read('docs/monster-art/RECEIVED_SHEETS.md').matchAll(/`(monsters_sheet\d+_[^`]+\.png)` \| (\d+)×(\d+) \| ([A-F0-9]{64})/g)];
  const manifest = JSON.parse(read('docs/monster-art/manifest.json')).batches;
  assert.deepEqual(Array.from(sources, sheet => sheet.src).sort(), records.map(row => row[1]).sort());
  for (const sheet of sources) {
    const png = fs.readFileSync(path.join(__dirname, sheet.src));
    assert.equal(png.readUInt32BE(16), sheet.width);
    assert.equal(png.readUInt32BE(20), sheet.height);
    const entries = manifest.filter(entry => entry.sheet === sheet.id.replace('-alt', ''));
    assert.equal(entries[0].id, sheet.firstId);
    assert.equal(entries.at(-1).id, sheet.lastId);
    assert(Object.isFrozen(sheet));
    assert(!('verified' in sheet), 'original preview is not an approval');
  }
  for (const id of ['catalog-07', 'catalog-10', 'catalog-14', 'catalog-14-alt']) {
    assert(sources.find(sheet => sheet.id === id).warning.length > 0, id);
  }
  assert.equal(Object.keys(h.registry.cells).length, 21);
  assert.equal(Object.keys(h.registry.sheets).length, 2);
});

test('journal contains accessible native controls and only one selected original image', () => {
  const h = harness();
  h.run('s=fresh();render=()=>{}');
  const original = h.run('journalScreen()');
  assert(original.includes('<summary>制作シートを確認</summary>'));
  assert(original.includes('<label for="monster-sheet-select">'));
  assert(original.includes('data-monster-sheet="select"'));
  assert(original.includes('aria-describedby="monster-sheet-notice monster-sheet-metadata monster-sheet-warning"'));
  assert(original.includes('シート01（M0001–M0030）は欠番'));
  assert(original.includes('未発見の制作候補'));
  assert.equal((original.match(/<option /g) || []).length, 14);
  assert.equal((original.match(/<img /g) || []).length, 1);
  assert(original.includes('src="monsters_sheet02_M0031-M0060.png"'));
  for (const sheet of h.registry.sourceSheets) {
    h.change(sheet.id);
    const html = h.run('journalScreen()');
    assert.equal((html.match(/<img /g) || []).length, 1);
    assert(html.includes(`src="${sheet.src}"`));
    assert(html.includes(`value="${sheet.id}" selected`));
    assert(html.includes('id="monster-sheet-details" open'));
    assert(html.includes(`原寸 ${sheet.width}×${sheet.height}px`));
    assert(html.includes(`対応候補 ${sheet.firstId}–${sheet.lastId}`));
    assert(html.includes('原本プレビュー（未検品を含む）'));
    if (sheet.warning) assert(html.includes(sheet.warning));
    assert.equal(h.box.focusedId, 'monster-sheet-select');
  }
});

test('malformed selections are ignored and source browsing never bypasses verified guards', () => {
  const h = harness();
  h.run('s=fresh();globalThis.renderCount=0;render=()=>{globalThis.renderCount++}');
  const initial = h.run('journalScreen()');
  for (const value of ['catalog-01', '__proto__', 'constructor', 'catalog-99', '', null, 7,
    'javascript:alert(1)', '\"><img src=x onerror=bad()>', '../monsters_sheet14.png']) h.change(value);
  h.change('catalog-14', { id: 'other-control' });
  h.change('catalog-14', { dataset: {} });
  assert.equal(h.box.renderCount, 0);
  assert.equal(h.run('journalScreen()'), initial);
  const cellsBefore = JSON.stringify(h.registry.cells);
  for (const sheet of h.registry.sourceSheets) h.change(sheet.id);
  assert.equal(h.box.renderCount, 14);
  assert.equal(JSON.stringify(h.registry.cells), cellsBefore);
  for (const id of ['M0001', 'M0039', 'M0181', 'M0271', 'M0391', 'M0400']) {
    assert.equal(h.box.monsterThumbHTML('', id), '', id);
  }
  h.registry.cells.M0031.verified = false;
  h.change('catalog-02');
  assert.equal(h.box.monsterThumbHTML('', 'M0031'), '', 'preview does not restore approval');
  assert.equal(h.run('JSON.stringify({enemies:DATA.enemies,bosses:DATA.bosses})'), h.before);
  h.run(read('monster-art.js'));
  assert.equal((h.run('journalScreen()').match(/id="monster-sheet-details"/g) || []).length, 1, 'no duplicate journal wrapper');
  const count = h.box.renderCount;
  h.change('catalog-03');
  assert.equal(h.box.renderCount, count + 1, 'no duplicate change listener');
});
