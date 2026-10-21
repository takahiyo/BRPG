'use strict';
// Integration checks for personal inventory and equipment. This is a simulated DOM,
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
const eq = BRPGEquipment;
function resetEquipment() { stopAll(); s = fresh(); render(); }
function makeTestGear(type, extra = {}) {
  const g = eq.enrich({ id: s.nextGear++, material: 'wood', slot: 'weapon', method: 'physical', quality: 1, dur: 60, maxDur: 60, type, ...extra });
  eq.receive(g); return g;
}
resetEquipment();
const fighter = s.roster[0], priest = s.roster[1];
assert(eq.capacity(fighter) !== eq.capacity(priest), 'job changes bag capacity');
assert(eq.accessorySlots(fighter) < eq.accessorySlots(priest), 'job changes accessory count');
assert(s.gear.every(g => Number.isInteger(g.ownerId)), 'legacy starter weapons migrate to personal bags');
assert(eq.validateSave(s)); assert(validSave(s));
const armor = makeTestGear('body'), helmet = makeTestGear('helmet'), gloves = makeTestGear('gloves'), boots = makeTestGear('boots'), shield = makeTestGear('shield'), ring = makeTestGear('ring');
for (const g of [armor, helmet, gloves, boots, shield, ring]) assert(eq.equip(g.id, fighter.id));
assert.equal(fighter.head, helmet.id); assert.equal(fighter.arms, gloves.id); assert.equal(fighter.feet, boots.id); assert.equal(fighter.acc1, ring.id);
const guarded = stats(fighter).def;
assert(eq.unequip(fighter.id, 'head')); assert(stats(fighter).def < guarded, 'head defense contributes to combat stats');
assert(eq.equip(helmet.id, fighter.id));
const greatsword = makeTestGear('greatsword');
assert(eq.equip(greatsword.id, fighter.id)); assert.equal(fighter.shield, null, 'twohand weapon occupies the shield hand');
assert(eq.equip(shield.id, fighter.id)); assert.equal(fighter.weapon, null, 'equipping shield returns twohand weapon to bag');
assert(eq.inventory(fighter).some(g => g.id === greatsword.id), 'displaced gear stays in personal inventory');
assert(eq.validateSave(s)); assert(validSave(s));
const magicSword = makeTestGear('sword', { material: 'iron', enchant: 'flame', bonusStats: { INT: 30 }, titleBonus: 20 });
assert(eq.equip(magicSword.id, priest.id), 'unsuitable job can still equip');
assert.equal(eq.suitability(priest, magicSword).suitable, false);
assert.equal(enchantPower(magicSword), 0, 'unsuitable enchant has no numerical effect');
const oldInt = attributes(priest).INT; assert(eq.unequip(priest.id, 'weapon'));
assert.equal(attributes(priest).INT, oldInt, 'unsuitable attribute bonus has no effect');
assert(eq.equip(magicSword.id, fighter.id));
assert(enchantPower(magicSword) > 0); assert(attributes(fighter).INT > oldInt);
const suitable = gearValue(magicSword); assert(eq.equip(magicSword.id, priest.id));
assert(gearValue(magicSword) < suitable, 'unsuitable basic performance is reduced');
const e = enemyStatsAt(DATA.enemies[0], 1); e.hp = e.maxhp = 10000; e.weak = 'fire';
const seen = [], oldDamageEnemy = damageEnemy; damageEnemy = (target, power, element) => { seen.push(element); return 1; };
heroAttack(priest, e, 1, null, false); damageEnemy = oldDamageEnemy;
assert.equal(seen[0], 'physical', 'unsuitable elemental attack rider is disabled');
assert.equal(magicSword.enchant, 'flame', 'disabled effect is retained on the item');
assert(eq.transfer(helmet.id, priest.id)); assert.equal(fighter.head, null); assert.equal(helmet.ownerId, priest.id);
assert(eq.transfer(helmet.id, null)); assert.equal(helmet.ownerId, null);
while (eq.canReceive(priest)) eq.receive(eq.enrich({ id: s.nextGear++, material: 'wood', slot: 'armor', type: 'ring', method: 'physical', quality: 1, dur: 60, maxDur: 60 }), priest.id);
assert(!eq.transfer(helmet.id, priest.id), 'bag limit blocks transfers without losing the item');
assert.equal(helmet.ownerId, null);
assert(!eq.equip(helmet.id, priest.id), 'bag limit blocks equipping from storage');
assert.equal(helmet.ownerId, null);
assert(eq.validateSave(s)); assert(validSave(s));
assert(!characterScreen(fighter).includes('data-character-change="equip"'), 'inventory cards replace equip dropdowns');
assert(characterScreen(fighter).includes('equipment-paperdoll'));
assert(characterScreen(fighter).includes('character-equip'));
const malformed = structuredClone(s); malformed.gear.push({ ...malformed.gear[0] }); assert(!eq.validateSave(malformed), 'duplicate gear is rejected');
const conflicting = structuredClone(s); const testFighter = conflicting.roster.find(a => a.id === fighter.id); testFighter.weapon = greatsword.id; assert(!eq.validateSave(conflicting), 'twohand plus shield is rejected');
const originalRing = eq.inventory(priest).find(g => g.type === 'ring');
eq.transfer(originalRing.id, null); eq.equip(originalRing.id, priest.id);
const spareRing = eq.inventory(priest).find(g => g.type === 'ring' && g.id !== originalRing.id);
assert(eq.transfer(spareRing.id, null), 'reserve room for a second accessory');
const secondRing = makeTestGear('ring'); eq.equip(secondRing.id, priest.id);
assert(priest.acc1 && priest.acc2);
priest.job = 'warrior'; eq.normalizeState(); assert.equal(priest.acc2, null, 'job change removes unavailable accessory slot');
assert(eq.inventory(priest).some(g => g.id === secondRing.id), 'removed accessory remains owned');
save(); assert(validSave(s));

resetEquipment();
const legacy = structuredClone(s), legacyHero = legacy.roster[0];
for (const g of legacy.gear) { delete g.type; delete g.equipSlot; delete g.hands; delete g.ownerId; }
const shieldProduct = Object.values(DATA.catalog.products).find(p => p.category === '防具' && /盾/.test(p.name));
assert(shieldProduct, 'catalog has a shield for legacy part migration');
const legacyShield = { id: legacy.nextGear++, material: 'wood', slot: 'armor', productId: shieldProduct.id, method: 'physical', quality: 1, dur: 60, maxDur: 60 };
legacy.gear.push(legacyShield); legacyHero.armor = legacyShield.id;
assert(validSave(legacy), 'untyped legacy armor save is accepted');
eq.normalizeState(legacy);
assert.equal(legacyHero.armor, null); assert.equal(legacyHero.shield, legacyShield.id, 'legacy named shield moves to shield part');
assert.equal(legacyShield.ownerId, legacyHero.id); assert(validSave(legacy));
for (const p of Object.values(DATA.catalog.products).filter(p => p.category === '装身具')) {
  const g = eq.enrich({ material: 'iron', slot: 'weapon', productId: p.id });
  assert.equal(eq.slotOf(g), 'accessory', p.name + ' uses an accessory slot even in an old weapon-class craft');
  assert.equal(g.slot, 'armor');
}
const hammerProduct = Object.values(DATA.catalog.products).find(p => p.category === '武器' && p.name === '戦槌');
assert.equal(eq.enrich({ material: 'iron', slot: 'weapon', productId: hammerProduct.id }).type, 'club', 'metal hammers use the blunt weapon type');

resetEquipment();
s.gold = 100000;
const countBeforePurchase = s.gear.length;
dispatch('click', { action: 'merchant-buy-gear', id: 'wood:ring' });
assert.equal(s.gear.length, countBeforePurchase + 1, 'shop purchase enters equipment inventory');
assert(Number.isInteger(s.gear.at(-1).ownerId));
const reserve = makeHero(s.nextHero++, '控え', 'warrior'); s.roster.push(reserve); syncHero(reserve);
const reserveItem = makeTestGear('ring'), storedItem = makeTestGear('hat');
assert(eq.transfer(reserveItem.id, reserve.id)); assert(eq.transfer(storedItem.id, null));
const activeItems = s.gear.filter(g => s.active.includes(g.ownerId)).map(g => g.id);
const linkedWeapon = s.roster[0].weapon;
enterMap('forest_edge');
s.dungeon.x = 2; s.dungeon.y = 1; s.dungeon.map[1][2] = '.';
party().forEach(h => h.hp = 0); defeat();
assert.equal(s.corpses.length, 1);
assert.deepEqual(s.corpses[0].gear.map(g => g.id).sort((a,b) => a-b), [...activeItems].sort((a,b) => a-b), 'wipe drops equipped and unequipped personal belongings of active members');
assert(item(reserveItem.id)); assert(item(storedItem.id), 'reserve and stored gear survive a wipe');
assert(party().every(h => eq.slots.every(slot => !h[slot])));
assert(validSave(s), 'corpse with all equipment parts can be saved');
const corpse = s.corpses[0]; corpse.until = 0;
party().forEach(h => { h.hp = stats(h).hp; h.mp = stats(h).mp; h.sp = maxSP(h); });
enterMap('', corpse.id); step(1, 0);
assert.equal(s.corpses.length, 0); assert.equal(s.roster[0].weapon, linkedWeapon, 'recovery restores the previous equipment link');
assert(activeItems.every(id => item(id))); assert(validSave(s));
`);
const reload = harness({ 'ashen-atlas-v3': h.store.get('ashen-atlas-v3') });
reload.run(`assert(validSave(s)); assert(BRPGEquipment.validateSave(s)); assert(s.gear.some(g => g.ownerId === null));`);
console.log('Equipment checks passed (simulated DOM).');

