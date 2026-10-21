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
function reset() { $('character-dialog').close(); stopAll(); s = fresh(); notice = ''; render(); }
reset();
assert(validSave(s));
assert(s.roster.some(h => h.job === 'explorer'), 'initial expedition party includes an explorer');
assert(!partyScreen().includes('data-change="job"'));
assert(!partyScreen().includes('class="skill-line"'));
for (const g of s.gear) {
  const name = gearName(g);
  assert(!/\\bQ\\d|の武器|の防具/.test(name), 'equipment names describe actual objects: ' + name);
}
const hero = s.roster[0];
hero.lv = 3; syncHero(hero); openCharacter(hero.id);
const snapshot = JSON.stringify({ alloc: s.ext.alloc, gold: s.gold, hp: hero.hp, mp: hero.mp, sp: hero.sp });
const attack = stats(hero).atk;
assert(adjustCharacterGrowth(hero.id, 'STR', 1));
assert.equal(stats(hero).atk, attack, 'draft must not alter live combat stats');
assert.equal(JSON.stringify({ alloc: s.ext.alloc, gold: s.gold, hp: hero.hp, mp: hero.mp, sp: hero.sp }), snapshot);
assert(previewCharacterGrowth(hero).after.stats.atk > attack, 'preview shows the derived gain');
assert($('character-body').innerHTML.includes('stat-change'));
assert(adjustCharacterGrowth(hero.id, 'STR', -1));
assert.equal(previewCharacterGrowth(hero).after.stats.atk, attack);
assert(!adjustCharacterGrowth(hero.id, 'STR', -1), 'cannot refund already committed or absent draft points');
assert(adjustCharacterGrowth(hero.id, 'VIT', 1));
assert(previewCharacterGrowth(hero).after.stats.sp > previewCharacterGrowth(hero).before.stats.sp);
dispatch('click', { action: 'character-next', id: String(hero.id) });
assert.equal(s.selection, s.roster[1].id);
openCharacter(hero.id);
assert.equal(previewCharacterGrowth(hero).before.stats.sp, previewCharacterGrowth(hero).after.stats.sp, 'switching discards draft');
assert(adjustCharacterGrowth(hero.id, 'STR', 1));
$('character-dialog').close(); openCharacter(hero.id);
assert.equal(previewCharacterGrowth(hero).before.stats.atk, previewCharacterGrowth(hero).after.stats.atk, 'closing discards draft');
for (let n = 0; n < 4; n++) assert(adjustCharacterGrowth(hero.id, 'STR', 1));
assert(!adjustCharacterGrowth(hero.id, 'STR', 1), 'draft bounded by total earned points');
assert(confirmCharacterGrowth(hero.id));
assert(!confirmCharacterGrowth(hero.id), 'confirm cannot spend twice');
assert.equal(s.ext.alloc[hero.id].STR, 4);
assert(stats(hero).atk > attack);
assert.equal(heroFreePoints(hero), 0);
assert(validSave(s));
save();
`);
const allocationRaw = h.store.get('ashen-atlas-v3');
const allocationReload = harness({ 'ashen-atlas-v3': allocationRaw });
allocationReload.run(`assert.equal(s.ext.alloc[1].STR,4);assert.equal(heroFreePoints(s.roster[0]),0);assert(validSave(s));`);

h.run(`
reset();
const a = s.roster[0], oldJob = a.job;
s.view = 'party'; assert.equal(changeJob(a.id, 'mage'), false); assert.equal(a.job, oldJob);
s.view = 'tavern'; assert(changeJob(a.id, 'mage')); assert.equal(a.job, 'mage');
const catalogId = Object.keys(DATA.jobs).find(id => DATA.jobs[id].catalog);
a.lv = 300; s.ext.unlockedJobIds.push(catalogId);
assert(changeJob(a.id, catalogId));
assert.equal(a.job, catalogId);
assert(!('subJobs' in s.ext), 'obsolete secondary jobs cannot affect the current profession');
assert(!partyScreen().includes('副職'));
save();
`);
const catalogRaw = h.store.get('ashen-atlas-v3');
const catalogReload = harness({ 'ashen-atlas-v3': catalogRaw });
catalogReload.run(`assert(DATA.jobs[s.roster[0].job].catalog);assert(validSave(s));`);
assert(![...catalogReload.store.keys()].some(k => k.includes('invalid-backup')), 'catalog job survives startup validation');

h.run(`
reset(); s.gold = 100000; s.view = 'tavern'; render();
const candidateBefore = JSON.stringify(s.ext.tavernCandidates.ash.birthAttributes);
dispatch('change', { characterChange: 'recruit-gender' }, 'female');
dispatch('change', { characterChange: 'recruit-job' }, 'mage');
dispatch('input', { characterChange: 'recruit-name' }, 'ミナ');
assert.equal(JSON.stringify(s.ext.tavernCandidates.ash.birthAttributes), candidateBefore, 'editing form must not reroll birth stats');
assert(recruit('mage'));
const recruitHero = s.roster.at(-1);
assert.equal(recruitHero.name, 'ミナ'); assert.equal(recruitHero.gender, 'female'); assert.equal(recruitHero.job, 'mage');
assert(Object.values(recruitHero.birthAttributes).every(n => Number.isInteger(n) && n >= -2 && n <= 2));
const femaleOnlyGear = { ...s.gear[0], method: 'magic', allowedGenders: ['female'] };
assert(canEquip(recruitHero, femaleOnlyGear)); assert(!canEquip(s.roster[0], femaleOnlyGear));
DATA.jobs.priest.allowedGenders = ['female']; assert(!canJob(s.roster[0], 'priest')); delete DATA.jobs.priest.allowedGenders;
const skillId = DATA.jobs.mage.skills[0]; DATA.skills[skillId].allowedGenders = ['male'];
assert(!heroSkills(recruitHero).some(sk => sk.id === skillId)); delete DATA.skills[skillId].allowedGenders;
characterRules.gear.push((who, gear) => gear.id !== -101); assert(!canEquip(recruitHero, { ...femaleOnlyGear, id: -101 })); characterRules.gear.pop();
// Rare traveler selection depends on the town identity, rather than reroll/revisit count.
let rareTown;
for (let seed = 1; seed < 50000; seed++) { const id = 'rare-test-' + seed; if (hash('tavern-rare:' + id + ':' + seed) % 4096 === 0) { rareTown = { ...baseTown(), id, seed }; break; } }
assert(rareTown); s.towns.push(rareTown); s.townId = rareTown.id; render();
const rareMatch = tavernScreen().match(/data-action="tavern-rare-recruit" data-job="([^"]+)"/); assert(rareMatch);
dispatch('click', { action: 'tavern-reroll' });
assert(tavernScreen().includes('data-job="' + rareMatch[1] + '"'));
assert(recruit(rareMatch[1], { rare: true })); assert.equal(s.roster.at(-1).rareJob, rareMatch[1]);
assert(!tavernScreen().includes('data-action="tavern-rare-recruit"')); assert(!recruit(rareMatch[1], { rare: true }));
save();
`);
const recruitmentReload = harness({ 'ashen-atlas-v3': h.store.get('ashen-atlas-v3') });
recruitmentReload.run(`assert.equal(s.roster.find(h=>h.name==='ミナ').gender,'female');assert(s.roster.at(-1).rareJob);assert(!tavernScreen().includes('data-action="tavern-rare-recruit"'));`);

h.run(`
reset(); s.gold = 100000;
const dead = s.roster[0], poisoned = s.roster[1]; dead.hp = 0; poisoned.hp = 1; poisoned.poison = 3;
rest(); assert.equal(dead.hp,0,'inn must not revive'); assert.equal(poisoned.hp,stats(poisoned).hp); assert.equal(poisoned.poison,3,'inn leaves temple poison treatment meaningful');
BRPGFacilities.templeTreat(dead.id,'revive'); assert(dead.hp>0 && dead.hp<stats(dead).hp);
BRPGFacilities.templeTreat(poisoned.id,'cleanse'); assert.equal(poisoned.poison,0);
assert(!shopScreen().includes('一夜の休息')); assert(!innScreen().includes('buy-item'));
assert(!catalogScreen().includes('sell-material'),'notebook never sells inventory');
for (const book of DATA.rules) assert(!rulesScreen().includes(book.name), 'undiscovered rule is hidden: '+book.name);
const rule = DATA.rules[0]; const goldBefore = s.gold; buyBook(rule.id); assert.equal(s.gold,goldBefore,'unknown rule cannot be bought');
s.ext.facilityRules.known.push(rule.id); assert(rulesScreen().includes(rule.name));
assert(BRPGFacilities.bookPrice(rule) > rule.cost); s.roster.forEach(h=>{h.lv=20;syncHero(h);}); buyBook(rule.id);
assert(s.books.includes(rule.id));
reset(); enterMap('forest_edge'); encounter();
for(const foe of s.battle.enemies) { s.research[foe.id] = { encounters: 12, kills: 8, level: foe.level }; }
assert(/(?:HP|LIFE) \\d+ \\/ \\d+/.test(uiEnemies()),'qualified explorer can observe current enemy HP');
for(const member of s.roster) member.job='warrior';
assert(!/(?:HP|LIFE) \\d+ \\/ \\d+/.test(uiEnemies()),'no current HP without observer profession');
assert(!/脅威度 Lv\\.\\d+/.test(uiEnemies()),'no enemy level without observer profession');
assert(!/\\(HP:\\d+\\)/.test(uiBattlePanel()),'target select does not leak current HP');
const before = s.roster[0].job; s.view='tavern'; assert.equal(changeJob(1,'mage'),false); assert.equal(s.roster[0].job,before);
s.view='explore'; const beforeGold=s.gold, hp=s.roster[0].hp; rest(); BRPGFacilities.templeTreat(1,'cleanse'); assert.equal(s.gold,beforeGold); assert.equal(s.roster[0].hp,hp);
stopAll();
reset(); s.gold=10000;
const contract = BRPGFacilities.contracts().find(q=>q.kind==='resource'&&q.material==='wood'); assert(contract&&contract.repeat);
for(let n=0;n<2;n++){ addMaterial(contract.material,contract.amount,contract.quality); BRPGFacilities.acceptContract(contract.id); const before=s.gold; BRPGFacilities.deliverContract(contract.id); assert(s.gold>before); }
assert.equal(s.ext.guildContracts.towns[s.townId].progress[contract.id].times,2);
assert(BRPGFacilities.contracts().filter(q=>q.kind==='resource').length>=6);
// Higher future technology requests cannot be read before the current one is available.
const forgeHtml=forgeScreen(); assert(!forgeHtml.includes('旋盤革命')); assert(!forgeHtml.includes('魔導炉の確立'));
assert(validSave(s));
console.log('PASS: staged growth, character navigation, single jobs, catalog save reload, recruitment/gender/rare traveler, inn/temple separation, discovery leakage, repeat resource contracts.');
`);
const validation=harness();validation.run(`
s=fresh();render();
for(const corrupt of [v=>v.ext.alloc={1:{STR:'bad'}},v=>v.ext.alloc={1:{VIT:-1}},v=>v.ext.freePts={1:Infinity},v=>v.ext.facilityRules={known:{},owned:[]},v=>v.ext.guildContracts={serial:0,towns:{ash:{offers:[],progress:{},returns:-1}}},v=>v.roster[0].gender='invalid',v=>v.roster[0].birthAttributes.STR=100]){
 const bad=structuredClone(s);corrupt(bad);assert(!validSave(bad));
}
assert(validSave(s));
console.log('PASS: malformed growth, gender, rule discovery and guild save fields rejected.');
`);
validation.run(`
s=fresh();render();enterMap('forest_edge');party().forEach(h=>h.hp=0);defeat();assert(party().every(h=>h.hp===0));s.gold=0;rest(true);assert(party().every(h=>h.hp===0));BRPGFacilities.templeTreat(s.active[0],'revive',true);assert(party()[0].hp>0);assert(s.debt>0);
// High-price town credit limit scaling and max-debt wipe emergency single recovery:
const highTown={id:'high-town',name:'星見の砦町',level:80,price:4.2,quality:4,baseCost:30000,owned:false,seed:123};
s.towns.push(highTown);s.townId=highTown.id;s.roster.forEach(h=>{h.lv=80;syncHero(h);h.hp=0;});s.gold=0;s.debt=0;
assert(BRPGFacilities.creditLimit()>=party().length*BRPGFacilities.templeFee(party()[0],'revive'));
for(const id of s.active)BRPGFacilities.templeTreat(id,'revive',true);
assert(party().every(h=>h.hp>0),'credit limit scales with town price so all active party members can be revived');
// Even if debt is already at the credit limit when a wipe happens, at least 1 party member can be restored to prevent softlock:
s.debt=BRPGFacilities.creditLimit();party().forEach(h=>h.hp=0);
BRPGFacilities.templeTreat(s.active[0],'revive',true);
assert(party()[0].hp>0,'emergency credit guarantees at least one active adventurer can be revived');
BRPGFacilities.templeTreat(s.active[1],'revive',true);
assert.equal(party()[1].hp,0,'second revive beyond credit limit is blocked once one adventurer is operational');
assert(validSave(s));console.log('PASS: party wipe preserves death; paid temple credit scales with town price and prevents softlock.');
`);
validation.run(`
s=fresh();render();
assert.equal(gearName(s.gear[0]),'硬木の棍棒');
const legacyGear={...s.gear[0]};delete legacyGear.type;delete legacyGear.equipSlot;delete legacyGear.hands;
assert.equal(gearName({...legacyGear,material:'hide'}),'獣皮の鞭');
assert.equal(gearName({...legacyGear,material:'hide',slot:'armor'}),'獣皮の衣');
for(const [id,it] of Object.entries(DATA.items))if(it.kind==='revive')assert(supplyPrice(id)>=300);
console.log('PASS: concrete material-appropriate item names and portable revival pricing.');
`);
validation.run(`
// Stage 8: Large personal equipment inventory, storage-only bulk sale, equipped gear repair
s=fresh();s.gold=50000;render();
for(let i=0;i<24;i++){
  s.gear.push({id:s.nextGear++,material:i%3===0?'iron':i%2===0?'copper':'wood',slot:i%2===0?'weapon':'armor',method:'physical',enchant:null,quality:i%4===0?5:1,dur:40,maxDur:60,rarity:i===23?'rare':'common'});
}
s.gear[0].dur=20;
openCharacter(1);
const detailHtml=$('character-body').innerHTML;
assert(detailHtml.includes('equipment-paperdoll'),'equipment body slots are shown');
assert(detailHtml.includes('inventory-card is-equipped'),'equipped gear remains visible in the personal inventory');
assert(detailHtml.includes('能力条件未達'),'unavailable gear explains its unmet requirement');
assert(!detailHtml.includes('data-character-change="equip"'),'equipment dropdowns have been replaced by inventory actions');
$('character-dialog').close();
const stored=s.gear.find(g=>!BRPGEquipment.equippedOwner(g)&&g.rarity!=='rare');
assert(BRPGEquipment.transfer(stored.id,null),'put an unused common item in storage for bulk sale');
const shopHtml=shopScreen();
assert(shopHtml.includes('merchant-sell-bulk-gear'),'shop offers bulk sell for unused common gear');
const gearBefore=s.gear.length,goldBefore=s.gold;
BRPGFacilities.sellUnusedCommonGear();
assert(s.gear.length<gearBefore && s.gold>goldBefore,'bulk sell removes stored common gear and earns gold');
assert(s.gear.some(g=>g.rarity==='rare'),'bulk sell preserves rare gear');
assert(s.roster.every(h=>h.weapon&&item(h.weapon)),'bulk sell preserves equipped gear');
const forgeHtml=forgeScreen();
assert(forgeHtml.includes('repair-all-equipped'),'forge offers bulk repair for damaged equipped gear');
dispatch('click',{action:'repair-all-equipped'});
assert.equal(s.gear[0].dur,s.gear[0].maxDur,'bulk repair restores durability of equipped gear');

// Stage 9: Catalog job combat/trade/specialist skills & exploration behaviors (B01..B40 subset)
s=fresh();s.gold=50000;render();
// 1. Combat catalog job (J0041 見習い戦士 has SK0025 間合い打ち)
const h1=s.roster[0];h1.lv=20;s.ext.unlockedJobIds.push('J0041');
s.view='tavern';assert(changeJob(h1.id,'J0041'));
const h1Skills=heroSkills(h1);
assert(h1Skills.some(sk=>sk.id==='SK0025'),'catalog warrior has SK0025 combat skill while in J0041');
enterMap('forest_edge');encounter();
s.battle.actor=h1.id;
planCommand('skill',0,'SK0025');
assert.equal(s.battle.plans[h1.id].skill,'SK0025');
assert(validSave(s),'save with catalog skill in battle plan is valid');
const foeHpBefore=s.battle.enemies[0].hp;
for(const a of alive())if(!s.battle.plans[a.id])s.battle.plans[a.id]={command:'defend',target:0};
executeTurn();
assert(!s.battle || s.battle.enemies[0].hp<foeHpBefore,'catalog combat skill executes and deals damage');
stopAll();s.battle=null;s.dungeon=null;s.view='town';

// 2. Trade catalog job (J0201 露店商人 has SK0121/SK0122) improves buy/sell factor
const baseBuy=buyFactor(),baseSell=sellFactor();
const h2=s.roster[1];h2.lv=20;s.ext.unlockedJobIds.push('J0201');
s.view='tavern';assert(changeJob(h2.id,'J0201'));
assert(buyFactor()<baseBuy && sellFactor()>baseSell,'merchant catalog job improves buy/sell factors');

// 3. Specialist behavior unlock (J0001 駆け出し案内人 provides B09, B03, B04, B08 at Lv30) & incapacitation stop
const h3=s.roster[2];h3.lv=60;s.ext.unlockedJobIds.push('J0001','J0002');
s.view='tavern';assert(changeJob(h3.id,'J0001'));
assert(BRPGFacilities.behaviorStatus('B09').bySpecialist,'guide unlocks B09 via specialist skill without manual');
assert(BRPGFacilities.behaviorStatus('B03').bySpecialist,'guide unlocks B03 via specialist skill');
dispatch('click',{action:'toggle-behavior',id:'B09'});
assert(s.ext.activeBehaviors.includes('B09'),'B09 added to active behaviors');
enterMap('forest_edge');
s.autoExpedition=true;
// Incapacitate the guide -> walkTick must stop autoExpedition and explain why
h3.hp=0;
walkTick();
assert.equal(s.autoExpedition,false,'incapacitating specialist stops auto expedition when behavior depends on them');
h3.hp=stats(h3).hp;

// 4. Loop detection (3 repeats of x,y,facing) stops without B07, or escapes with B07
s.autoExpedition=true;
s.dungeon.stateVisits={[s.dungeon.x+','+s.dungeon.y+','+s.dungeon.facing]:2};
walkTick();
assert.equal(s.autoExpedition,false,'3rd visit to same (x,y,facing) without B07 stops auto expedition safely');
// Now grant B07 manual and enable it
s.ext.manuals.push('B07');
s.roster.forEach(h=>{h.lv=60;syncHero(h);});
dispatch('click',{action:'toggle-behavior',id:'B07'});
assert(BRPGFacilities.behaviorActive('B07'));
s.autoExpedition=true;
const keyNow=s.dungeon.x+','+s.dungeon.y+','+s.dungeon.facing;
s.dungeon.stateVisits={[keyNow]:2};
walkTick();
assert(s.log.some(l=>l.includes('環状路脱出（B07）')),'B07 resolves loop by picking alternative branch');
stopAll();s.dungeon=null;s.view='town';
assert(validSave(s));
for(const bad of [v=>v.ext.manuals=['INVALID_B'],v=>v.ext.activeBehaviors=['B01','B02','B03','B04','B05','B06','B07']]){
  const c=structuredClone(s);bad(c);assert(!validSave(c));
}

// Stage 10: Dungeon hazards (B15..B18, B36..B38) & 5-Route Craft Diagnostic / Uncraftable Material Research
s=fresh();s.gold=50000;render();
// 1. Trapper / B16/B17 discovers and disarms adjacent trap hazard, B15 avoids armed hazard
s.ext.manuals.push('B15','B16');
s.roster.forEach(h=>{h.lv=40;syncHero(h);});
dispatch('click',{action:'toggle-behavior',id:'B15'});
dispatch('click',{action:'toggle-behavior',id:'B16'});
enterMap('forest_edge');
s.dungeon.map[1][2]='.';s.dungeon.map[2][1]='.';
s.dungeon.hazards={'2,1':{type:'trap',discovered:false,disarmed:false,level:5}};
BRPGFacilities.scanAdjacentHazards(s.dungeon);
assert(s.dungeon.hazards['2,1'].discovered,'B16 discovers adjacent trap hazard');
s.dungeon.facing=1; // facing East toward (2,1)
const safeDir=nextWalkDirection();
assert.notEqual(safeDir,1,'B15 avoids stepping onto discovered armed hazard at (2,1) when (1,2) is safe');
// Enable B17 (trap disarm) and scan another trap
s.ext.manuals.push('B17');
dispatch('click',{action:'toggle-behavior',id:'B17'});
s.dungeon.hazards['1,2']={type:'trap',discovered:false,disarmed:false,level:5};
BRPGFacilities.scanAdjacentHazards(s.dungeon);
assert(s.dungeon.hazards['1,2'].disarmed,'B17 disarms discovered trap hazard');
assert(validSave(s),'save with dungeon hazards remains valid');
stopAll();s.dungeon=null;s.view='town';

// 2. 5-Route Craft Live Diagnostic & Uncraftable Relic/Herb Research
s.ext.forgeMode='craftsman';
addMaterial('greenherb',2,1);
addMaterial('pottery',1,1);
const cForgeHtml=forgeScreen();
assert(cForgeHtml.includes('5経路加工診断') && cForgeHtml.includes('付与伝達率'),'craftsman mode displays 5-route craft diagnostic preview');
assert(cForgeHtml.includes('research-uncraftable'),'craftsman mode shows research/synthesis buttons for uncraftable herbs and relics');
const potBefore=s.items.potion||0,craftLvBefore=s.ext.craftLv;
dispatch('click',{action:'research-uncraftable',id:'greenherb'});
assert.equal(s.items.potion,potBefore+1,'researching greenherb synthesizes a potion');
dispatch('click',{action:'research-uncraftable',id:'pottery'});
assert(s.ext.craftLv>craftLvBefore && s.ext.magicCraftLv>=2,'researching relic pottery increases craftLv and magicCraftLv');

console.log('PASS: Stage 8, 9 & 10 equipment UX, bulk shop/forge actions, catalog job skills, specialist behaviors, dungeon hazards & 5-route craft/relic research.');

// Stage 11-14: Scientific Craft + Multi-Enchant Supremacy, Annealing, Traversal Gimmicks, Sprite Sheet 2, Address Cataclysm (404), Initial Support Party & Simulated Playthrough
s=fresh();s.gold=200000;
for(const k of Object.keys(DATA.materials))addMaterial(k,200,10);

// 1. Initial Party Support Roles: Explorer (auto-explore + SP3 return) & Tactician (auto-battle heal/cleanse/weakness without rulebooks)
assert.equal(s.roster[2].job,'explorer','Hero 3 starts as explorer');
assert.equal(s.roster[3].job,'tactician','Hero 4 starts as tactician');
assert(BRPGFacilities.canAutomate(),'initial party can automate exploration via explorer');
assert.equal(BRPGFacilities.tacticians().length,1,'initial party has 1 tactician');
assert(BRPGFacilities.supportRoleCount()>=2,'initial party has at least 2 distinct support roles');
enterMap('forest_edge');encounter();
s.roster[0].hp=Math.floor(stats(s.roster[0]).hp*0.3); // Wounded ally (<45%)
autoPlans();
assert(Object.values(s.battle.plans).some(p=>p.command==='skill'||p.command==='item'),'tactician directs emergency healing in auto-battle even before buying rulebooks');
stopAll();s.battle=null;s.dungeon=null;s.view='town';

// 2. Scientific Crafting + Multi-Enchant Supremacy & Annealing (Proposal A)
const sciGear={id:s.nextGear++,material:'adamant',slot:'weapon',method:'physical',route:'I',quality:10,craftQ:88,residue:18,eta:0.72,dur:160,maxDur:160,enchant:null};
const magGear={id:s.nextGear++,material:'adamant',slot:'weapon',method:'magic',route:'M',quality:10,craftQ:88,residue:48,eta:0.46,dur:110,maxDur:110,enchant:null};
s.gear.push(sciGear,magGear);
// Anneal scientific gear -> residue 0%, craftQ increases, maxEnchantSlots reaches 3
annealGear(sciGear.id);
assert.equal(sciGear.residue,0,'annealing purges magic residue R to 0%');
assert.equal(maxEnchantSlots(sciGear),3,'high-Q scientific gear unlocks 3 enchant slots');
assert.equal(maxEnchantSlots(magGear),1,'magic-crafted gear is capped at 1 enchant slot due to magic interference');
applyEnchant(sciGear.id,'flame');
applyEnchant(sciGear.id,'frost');
applyEnchant(sciGear.id,'thunder');
applyEnchant(magGear.id,'flame');
assert.equal(gearEnchants(sciGear).length,3,'scientific gear holds 3 distinct enchantments');
assert.equal(gearEnchants(magGear).length,1,'magic gear holds 1 enchantment');
const sciTotal=gearValue(sciGear)+enchantPower(sciGear);
const magTotal=gearValue(magGear)+enchantPower(magGear);
assert(sciTotal>magTotal*1.4,'Scientific Craft + Multi-Enchant ('+sciTotal+') strictly outperforms Magic Craft + Enchant ('+magTotal+')');
assert(validSave(s),'save with multi-slot enchants is valid');

// 3. Dungeon Traversal Gimmicks (water/cliff/secret for B31..B35, Proposal B)
enterMap('forest_edge');
s.dungeon.map[1][2]='.';
s.dungeon.hazards={'2,1':{type:'secret',discovered:true,disarmed:false,level:3,traversal:true}};
const goldBeforeSecret=s.gold;
step(1,0);
assert(s.gold>goldBeforeSecret && s.dungeon.hazards['2,1'].disarmed,'explorer/observer discovers secret cache on traversal tile');
stopAll();s.dungeon=null;s.view='town';

// 4. Address Validation & 404 Cataclysm ("天変地異で滅亡")
const townsBefore=s.towns.length;
discoverAddress('not-a-valid-address');
assert.equal(s.towns.length,townsBefore,'unreachable/malformed address string is rejected');
discoverAddress('https://www.google.com');
const googleTown=s.addressPreview.town;
assert(googleTown && !JSON.stringify(s).includes('google.com'),'valid address creates town without storing raw URL');
settleTown(googleTown.id);
assert.equal(s.homeTownId,googleTown.id,'settled in google address town');
// Simulate www.google.com returning 404 -> Cataclysm destroys the town!
simulateAddressStatus('https://www.google.com',404);
assert(googleTown.ruined && googleTown.name.startsWith('【滅亡】'),'404 triggers cataclysm and marks town ruined');
assert.equal(s.homeTownId,'ash','cataclysm evacuates homeTownId back to ash');
travelTown(googleTown.id);
assert.notEqual(s.townId,googleTown.id,'cannot stay in or use facilities of a ruined town');
assert(validSave(s),'save after cataclysm remains valid');

// 5. Internal Simulated Playthrough: Lv1 -> Regional Boss -> Town Migration & Balanced vs 6-Combat-Job Challenge Comparison
function runSimulatedPlaythrough(){
  s=fresh();
  // Phase 1: Early game in Ash Town (Lv1 -> Lv6, contract delivery, equipment craft, boss victory)
  for(let exp=0;exp<4;exp++){
    enterMap('forest_edge');
    for(let st=0;st<8;st++){
      const dir=nextWalkDirection()??1;
      step(...DIRS[dir],true);
      while(s.battle){autoPlans();executeTurn();}
      if(!s.dungeon)break;
    }
    if(s.dungeon)BRPGFacilities.instantReturn();
    if(s.gold>=innCost())rest();else rest(true);
  }
  addMaterial('wood',10,1);addMaterial('copper',10,1);
  const c0=BRPGFacilities.contracts().find(c=>c.kind==='resource');
  if(c0){BRPGFacilities.acceptContract(c0.id);addMaterial(c0.material,c0.amount,c0.quality);BRPGFacilities.deliverContract(c0.id);}
  for(const h of party()){h.lv=8;syncHero(h);h.hp=stats(h).hp;h.mp=stats(h).mp;h.sp=maxSP(h);}
  s.corpses.forEach(c=>c.until=0);
  enterMap('forest_edge');s.dungeon.depth=3;s.dungeon.x=17;s.dungeon.y=11;s.dungeon.map[11][17]='!';
  bossChallenge();
  let bTurns=0;while(s.battle&&bTurns++<40){autoPlans();executeTurn();}
  assert(s.won,'Phase 1 simulated playthrough defeats forest_edge regional boss');
  if(s.dungeon)returnTown();

  // Compare Balanced Party (with support roles) vs Pure 6-Combat-Job Challenge Party on a 24-step expedition
  function measureExpeditionAttrition(jobsList){
    s=fresh();
    s.roster=jobsList.map((j,i)=>makeHero(i+1,'H'+(i+1),j,i<3?'front':'back'));
    s.active=s.roster.map(h=>h.id);
    s.roster.forEach(h=>{h.lv=12;syncHero(h);h.hp=stats(h).hp;h.mp=stats(h).mp;h.sp=maxSP(h);});
    enterMap('old_mine');
    for(let i=1;i<=12;i++){s.dungeon.map[1][i]='.';delete s.dungeon.hazards?.[i+',1'];}
    for(let stepNo=0;stepNo<12;stepNo++){
      const dx=(stepNo%2===0)?1:-1;
      s.dungeon.sinceBattle=0; // measure pure exploration & hazard/logistics SP retention
      step(dx,0,true);
    }
    const spRatio=party().reduce((sum,h)=>sum+h.sp/maxSP(h),0)/party().length;
    const canAuto=BRPGFacilities.canAutomate(),canObserve=BRPGFacilities.observers().length>0,hasTac=BRPGFacilities.tacticians().length>0;
    stopAll();s.dungeon=null;s.view='town';
    return {spRatio,canAuto,canObserve,hasTac};
  }
  const balancedRes=measureExpeditionAttrition(['warrior','knight','priest','explorer','tactician','ranger']);
  const combatOnlyRes=measureExpeditionAttrition(['warrior','knight','paladin','mage','swordsman','samurai']);
  assert(balancedRes.spRatio>combatOnlyRes.spRatio,'Balanced support party retains higher SP than 6-combat-job challenge party');
  assert(balancedRes.canAuto && balancedRes.canObserve && balancedRes.hasTac,'Balanced party has auto-explore, enemy observation, and tactical auto-battle from the start');
  assert(!combatOnlyRes.canAuto && !combatOnlyRes.canObserve && !combatOnlyRes.hasTac,'6-combat-job challenge party lacks built-in auto-explore, observation, and tactical command');
  return {balancedRes,combatOnlyRes};
}
const simResult=runSimulatedPlaythrough();
console.log('PASS: Stage 11-14 multi-enchant supremacy, annealing, traversal gimmicks, cataclysm (404), and simulated playthrough:',simResult);

// Stage 15: Quest 1-limit, Always-available special contracts, Deadlines & Fines, Calendar Time Advance, Job Traits Display
s=fresh();s.gold=50000;render();

// 1. Job traits display on character screen and party screen
assert.equal(jobTraitInfo('explorer').name, '探索指導');
assert.equal(jobTraitInfo('tactician').name, '戦術指揮');
assert.equal(jobTraitInfo('scout').name, '罠感知・解除');
openCharacter(3); // Hero 3 is explorer
const expCharHtml = $('character-body').innerHTML;
assert(expCharHtml.includes('【ジョブ特性】') && expCharHtml.includes('探索指導'), 'Character screen displays job trait for explorer');
$('character-dialog').close();
openCharacter(4); // Hero 4 is tactician
const tacCharHtml = $('character-body').innerHTML;
assert(tacCharHtml.includes('【ジョブ特性】') && tacCharHtml.includes('戦術指揮'), 'Character screen displays job trait for tactician');
$('character-dialog').close();
const pScreenHtml = partyScreen();
assert(pScreenHtml.includes('探索指導') && pScreenHtml.includes('戦術指揮'), 'Party screen displays job trait chips on hero cards');

// 2. Calendar and Time Advance (Resting, Traveling, Stepping, Real Midnight)
const cal0 = BRPGFacilities.getCalendar();
assert(cal0.day >= 1 && cal0.hour === 8, 'Initial calendar starts at day 1, 8:00 AM');
const timeStr0 = BRPGFacilities.formatCalendar(cal0);
assert(timeStr0.includes('冒険 1日目 08:00'), 'Calendar format outputs expected string');
render();
assert($('summary').innerHTML.includes('冒険 1日目 08:00'), 'Summary header shows adventure date and time');

// Rest advances time to next morning (approx 24h from 8am to next 8am)
const dayBeforeRest = cal0.day;
rest();
assert.equal(cal0.day, dayBeforeRest + 1, 'Resting at inn advances calendar to next day 8:00 AM');
assert.equal(cal0.hour, 8, 'Resting sets time to 8:00 AM');

// Enter map advances travel time
const hourBeforeEnter = cal0.hour;
enterMap('forest_edge');
assert(cal0.hour > hourBeforeEnter || cal0.day > dayBeforeRest + 1, 'Entering dungeon advances travel time');

// Stepping in dungeon advances walking time
const minBeforeStep = cal0.minute;
step(1, 0, true);
assert(cal0.minute !== minBeforeStep, 'Taking steps advances time');
BRPGFacilities.instantReturn();

// Real Midnight crossing detection
cal0.lastRealDate = '2026-01-01'; // simulate previous real session on an older date
BRPGFacilities.checkRealMidnight();
assert(cal0.day > dayBeforeRest + 2, 'Crossing real midnight advances game calendar significantly');
assert.equal(cal0.hour, 8, 'Real midnight advance resets time to morning 8:00');

// 3. Quest: 1-Limit Rule
s.gold = 50000;
const allContracts = BRPGFacilities.contracts();
const rContract = allContracts.find(c => c.kind === 'resource');
assert(rContract, 'Board has resource contract');
BRPGFacilities.acceptContract(rContract.id);
assert(BRPGFacilities.getActiveQuest(), 'Active quest is recorded');
assert.equal(BRPGFacilities.getActiveQuest().id, rContract.id, 'Active quest matches accepted contract');

// Attempting to accept a second contract must be blocked
const secondContract = allContracts.find(c => c.id !== rContract.id);
const noticeBefore = notice;
BRPGFacilities.acceptContract(secondContract.id);
assert(notice.includes('受注できる依頼はパーティー全体で1件のみ'), 'Second contract acceptance is blocked by 1-quest limit');

// Map quest acceptance must also be blocked while a contract is active
acceptQuest('forest_edge');
assert(notice.includes('受注できる依頼はパーティー全体で1件のみ'), 'Map quest acceptance is blocked by 1-quest limit');

// Abandoning contract frees up the quest slot
BRPGFacilities.abandonContract(rContract.id);
assert.equal(BRPGFacilities.getActiveQuest(), null, 'Abandoning contract frees active quest slot');

// 4. Special/Non-permanent Contracts: Always available, with Deadlines & Fines
const specials = BRPGFacilities.contracts().filter(c => c.kind === 'lucrative' || c.kind === 'emergency');
assert(specials.length >= 2, 'Guild board always provides multiple special/non-permanent offers');
const targetSpecial = specials[0];
assert(targetSpecial.dueDay > cal0.day, 'Special contract has a future deadline day');
assert(targetSpecial.penalty > 0, 'Special contract has a failure penalty fine');

// Accept the special contract
BRPGFacilities.acceptContract(targetSpecial.id);
assert.equal(BRPGFacilities.getActiveQuest().id, targetSpecial.id, 'Accepted special contract');

// Advance time past the deadline -> Fails and incurs fine!
const goldBeforeFine = s.gold;
BRPGFacilities.advanceTime((targetSpecial.dueDay - cal0.day + 1) * 24 * 60, 'Time skip to test deadline');
assert.equal(BRPGFacilities.getActiveQuest(), null, 'Expired special contract fails and active slot is cleared');
assert(s.gold < goldBeforeFine, 'Penalty fine was deducted from gold on deadline failure');
assert(s.log.some(l => l.includes('依頼期限切れ') && l.includes('違約金')), 'Log notifies player of deadline failure and fine');

// Verify that guild board automatically replenished new special offers
const newSpecials = BRPGFacilities.contracts().filter(c => c.kind === 'lucrative' || c.kind === 'emergency');
assert(newSpecials.length >= 2, 'Guild board replenished fresh special offers after expiration');
assert(validSave(s), 'Save file remains valid after calendar and contract operations');
console.log('PASS: Stage 15 quest 1-limit, always-replenished special contracts, deadlines/fines, calendar time advance, and job traits display.');

// ============================================================================
// Stage 16: Separate Atlas & Guild Nav Tabs + Direct Dungeon Selection from Quests
// ============================================================================
stopAll(); s = fresh(); render();
// 1. Navigation tab separation: Atlas (地図) and Guild (依頼) are separate tabs
s.view = 'town';
render();
const navHtml = $('nav').innerHTML;
assert(navHtml.includes('data-view="atlas"') && navHtml.includes('地図'), 'Nav contains dedicated "地図" (atlas) tab');
assert(navHtml.includes('data-view="guild"') && navHtml.includes('依頼'), 'Nav contains dedicated "依頼" (guild) tab');

// 2. Map tab allows free dungeon diving without any quest
s.view = 'atlas';
render();
const atlasHtml = $('app').innerHTML;
assert(atlasHtml.includes('探索地図と遠征道標') && atlasHtml.includes('この地域を探索 →'), 'Atlas screen renders exploration map cards with direct dive buttons');
assert(!atlasHtml.includes('依頼受託枠：空き'), 'Atlas screen does not display duplicate quest board');
// Player dives into dungeon directly without taking any quest
enterMap('forest_edge');
assert(s.dungeon && s.dungeon.mapId === 'forest_edge', 'Player can freely dive into dungeons without a quest from the map');
returnTown();

// 3. Guild tab displays dedicated quest board without duplicating full map
s.view = 'guild';
render();
const guildHtml = $('app').innerHTML;
assert(guildHtml.includes('冒険者ギルド・依頼掲示板'), 'Guild screen renders quest board');
assert(!guildHtml.includes('ギルドの探索地図') && !guildHtml.includes('道標（アドレス）から未知の街'), 'Guild screen does not duplicate atlas/map cards');
assert(guildHtml.includes('依頼受託枠：空き'), 'Guild screen displays 1-quest capacity status');

// 4. Accepting a quest enables direct dungeon departure buttons right on the quest table
const resContract = BRPGFacilities.contracts().find(c => c.kind === 'resource');
assert(resContract, 'Resource contract exists');
BRPGFacilities.acceptContract(resContract.id);
render();

const acceptedGuildHtml = $('app').innerHTML;
// Active quest banner at the top provides direct dungeon departure
assert(acceptedGuildHtml.includes('📌 現在受託中の依頼：' + resContract.name), 'Top banner highlights active quest');
assert(acceptedGuildHtml.includes('⚔ 探索先ダンジョンを選択して出発'), 'Top banner has direct dungeon departure section');
assert(acceptedGuildHtml.includes('へ出発 →'), 'Direct dungeon departure button exists in top banner');

// Contract card on the table also provides direct dungeon departure
assert(acceptedGuildHtml.includes('⚔ 探索先ダンジョンを選択：'), 'Accepted contract card displays dungeon selection box');
assert(acceptedGuildHtml.includes('data-action="enter-map"'), 'Direct dungeon departure button is wired to enter-map');

// Clicking direct departure button enters the designated target dungeon
enterMap(resContract.mapId);
assert(s.dungeon && s.dungeon.mapId === resContract.mapId, 'Direct departure button successfully entered target dungeon');
returnTown();

// 5. Atlas tab highlights the target map of the accepted quest
s.view = 'atlas';
render();
assert($('app').innerHTML.includes('📌 依頼対象'), 'Atlas map card shows gold badge highlighting quest target dungeon');

// Cleanup: abandon contract and verify save
BRPGFacilities.abandonContract(resContract.id);
assert.equal(BRPGFacilities.getActiveQuest(), null, 'Contract abandoned');
assert(validSave(s), 'Save file remains valid');
console.log('PASS: Stage 16 separated Atlas & Guild nav tabs and direct dungeon departure from quest board.');

// Stage 17: completed combat awaiting report still occupies the slot and survives deadlines.
stopAll(); s = fresh(); render();
BRPGFacilities.contracts();
const boundaryBoard = s.ext.guildContracts.towns[s.townId];
const boundaryCal = BRPGFacilities.getCalendar();
const boundaryQuest = {id:'emergency:boundary',kind:'emergency',name:'報告待ち検証',mapId:'forest_edge',level:9,reward:500,expires:10,dueDay:boundaryCal.day+1,dueHour:18,penalty:175};
boundaryBoard.offers.push(boundaryQuest);
boundaryBoard.progress[boundaryQuest.id]={status:'ready',times:0};
assert.equal(BRPGFacilities.getActiveQuest().id,boundaryQuest.id);
BRPGFacilities.acceptContract(BRPGFacilities.contracts().find(q=>q.kind==='resource').id);
assert(notice.includes('受注できる依頼はパーティー全体で1件のみ'));
const boundaryGold=s.gold;
BRPGFacilities.advanceTime(3*24*60);
assert(boundaryBoard.offers.some(q=>q.id===boundaryQuest.id),'Ready quest survives deadline');
assert.equal(s.gold,boundaryGold,'Completed task incurs no deadline fine');
BRPGFacilities.deliverContract(boundaryQuest.id);
assert.equal(s.gold,boundaryGold+500);
assert.equal(BRPGFacilities.getActiveQuest(),null);
BRPGFacilities.deliverContract(boundaryQuest.id);
assert.equal(s.gold,boundaryGold+500,'Reward cannot be claimed twice');
const beforeClock=boundaryCal.day;
boundaryCal.lastRealDate='9999-01-01';
BRPGFacilities.checkRealMidnight();
assert.equal(boundaryCal.day,beforeClock,'Backward clock change must not advance deadlines');
assert.equal(boundaryCal.lastRealDate,'9999-01-01','Keep high-water date to avoid counting days twice');
assert(validSave(s));
for(const [key,value] of [['day',0],['hour',24],['minute',-1],['minute','30'],['lastRealDate','2026-02-30']]){
 const broken=JSON.parse(JSON.stringify(s));broken.calendar[key]=value;assert(!validSave(broken),'Reject malformed calendar '+key);
}
for(const [key,value] of [['dueDay',0],['dueHour',24],['penalty',-1],['penalty','100']]){
 const broken=JSON.parse(JSON.stringify(s));broken.ext.guildContracts.towns[s.townId].offers[0][key]=value;assert(!validSave(broken),'Reject malformed contract '+key);
}
const oldCalendarSave=JSON.parse(JSON.stringify(s));delete oldCalendarSave.calendar;
assert(validSave(oldCalendarSave),'Pre-calendar saves remain compatible');
console.log('PASS: Stage 17 pending report, deadline rewards, backward clock and save validation boundaries.');

`);
