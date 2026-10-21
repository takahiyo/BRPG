'use strict';
// Integration checks for the character/facility overhaul. This is a simulated DOM,
// so real browser layout, native dialog focus, and pointer interaction need separate QA.
const fs = require('fs'), vm = require('vm'), assert = require('assert');
function harness(initial = {}) {
  const store = new Map(Object.entries(initial)), elements = new Map(), handlers = new Map();
  const noop = () => {}, drawing = new Proxy({ createRadialGradient: () => ({ addColorStop: noop }) }, { get: (t, k) => t[k] || noop });
  function element(id) {
    if (!elements.has(id)) {
      const listeners = new Map();
      elements.set(id, { style: {}, dataset: {}, value: '1', textContent: '', innerHTML: '', open: false, tagName: 'DIV',
        getContext: () => drawing, addEventListener(type, fn) { const list = listeners.get(type) || []; list.push(fn); listeners.set(type, list); },
        showModal() { this.open = true; }, close() { this.open = false; for (const f of listeners.get('close') || []) f({ target: this }); }
      });
    }
    return elements.get(id);
  }
  const box = { console, Date, Math, URL, structuredClone, assert, confirm: () => true,
    setInterval: () => 1, clearInterval: noop,
    document: { getElementById: element, addEventListener(type, fn, capture) { const list = handlers.get(type) || []; list.push({ fn, capture: !!capture }); handlers.set(type, list); } },
    localStorage: { getItem: k => store.get(k) || null, setItem: (k, v) => store.set(k, v) },
    dispatch(type, dataset, value = '') {
      const target = { dataset, value, tagName: 'BUTTON', disabled: false, closest: () => target };
      const event = { target, stopped: false, stopImmediatePropagation() { this.stopped = true; }, preventDefault: noop };
      for (const { fn } of [...(handlers.get(type) || [])].sort((a, b) => Number(b.capture) - Number(a.capture))) { fn(event); if (event.stopped) break; }
    }
  };
  vm.createContext(box);
  const html = fs.readFileSync(__dirname + '/index.html', 'utf8');
  for (const [, source] of html.matchAll(/<script src="([^"]+)"/g)) {
    const file = source.split('?')[0];
    vm.runInContext(fs.readFileSync(__dirname + '/' + file, 'utf8'), box, { filename: file });
  }
  const run = code => vm.runInContext(code, box, { timeout: 20000 });
  run('boot();');
  return { run, store };
}

const h = harness();
h.run(`
stopAll(); s = fresh(); render();
const destination = addressBlueprint('quest-travel-test');
s.towns.push(destination.town); s.addressMaps.push(destination.map);
// Give both towns the same permanent contract ID but different target/quality.
destination.map.materials = ['wood']; destination.map.quality = 7;
const originId = s.townId;
const origin = BRPGFacilities.contracts().find(q => q.kind === 'resource' && q.material === 'wood' && q.amount === 3);
assert(origin);
BRPGFacilities.acceptContract(origin.id);
const originName = currentTown().name;
travelTown(destination.town.id);
const local = BRPGFacilities.contracts().find(q => q.id === origin.id);
assert(local && local.mapId !== origin.mapId && local.quality !== origin.quality);
let active = BRPGFacilities.getActiveQuest();
assert.equal(active.name, origin.name, 'travelling preserves accepted permanent contract name');
assert.equal(active.q.mapId, origin.mapId, 'same ID at another town must not replace accepted target');
assert.equal(active.q.quality, origin.quality, 'accepted quality belongs to originating town');
assert.equal(active.townId, originId);
assert(guildScreen().includes('報告先：' + originName), 'banner displays originating report town');
const beforeLookup = JSON.stringify(s.ext.guildContracts);
BRPGFacilities.getActiveQuest();
assert.equal(JSON.stringify(s.ext.guildContracts), beforeLookup, 'lookup must not generate offers or mutate boards');
addMaterial(origin.material, origin.amount, origin.quality);
const goldBefore = s.gold, amountBefore = availableMaterial(origin.material, origin.quality);
BRPGFacilities.deliverContract(origin.id);
assert.equal(s.gold, goldBefore, 'another town cannot pay the reward');
assert.equal(availableMaterial(origin.material, origin.quality), amountBefore, 'another town cannot consume delivery');
BRPGFacilities.acceptContract(local.id);
assert(notice.includes('受注できる依頼はパーティー全体で1件のみ'));
assert(!s.ext.guildContracts.towns[destination.town.id].progress[local.id], 'single slot applies across towns');
acceptQuest(destination.map.id);
assert(!s.quests[destination.map.id]?.accepted, 'map quest cannot bypass occupied slot');
assert(validSave(s)); save();
`);
const restored = harness({ 'ashen-atlas-v3': h.store.get('ashen-atlas-v3') });
restored.run(`
const active = BRPGFacilities.getActiveQuest();
assert.equal(active.townId, 'ash');
assert.equal(active.q.quality, 1);
assert.equal(active.q.mapId, 'forest_edge');
travelTown('ash');
const before = s.gold;
BRPGFacilities.deliverContract(active.id);
assert.equal(s.gold, before + active.q.reward, 'originating town accepts delivery after travel and reload');
assert.equal(BRPGFacilities.getActiveQuest(), null);
BRPGFacilities.deliverContract(active.id);
assert.equal(s.gold, before + active.q.reward, 'delivery reward cannot be claimed twice');
// The reverse direction also preserves a material absent from Ash's current board.
const ashMaterials = new Set(BRPGFacilities.contracts().filter(q => q.kind === 'resource').map(q => q.material));
const rareMaterial = Object.keys(DATA.materials).find(id => !ashMaterials.has(id));
assert(rareMaterial);
const remote = s.towns.find(t => t.id !== 'ash');
s.addressMaps.find(m => m.townId === remote.id).materials = [rareMaterial];
travelTown(remote.id);
const quest = BRPGFacilities.contracts().find(q => q.kind === 'resource');
BRPGFacilities.acceptContract(quest.id);
travelTown('ash');
assert.equal(BRPGFacilities.getActiveQuest().name, quest.name);
assert.equal(BRPGFacilities.getActiveQuest().q.mapId, quest.mapId);
assert.equal(BRPGFacilities.getActiveQuest().q.quality, quest.quality);
assert(guildScreen().includes('報告先：' + remote.name));
assert(validSave(s));
console.log('PASS: permanent contract identity, targets, report town, travel/reload, single slot and reward boundaries.');
`);


