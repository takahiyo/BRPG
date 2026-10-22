'use strict';
const assert = require('node:assert/strict');
const { harness } = require('./test.cjs');
const h = harness();
h.run(`
  function measureCombat(config, mapId, seed) {
    stopAll();s=fresh();s.randomState=seed;notice='';render();
    const map=worldMap(mapId),level=map.level;
    if(config.startsWith('six_')) {
      const jobs=config==='six_melee'?Array(6).fill('warrior'):['warrior','explorer','tactician','ranger','mage','priest'];
      s.roster=jobs.map((job,i)=>makeHero(i+1,'Hero '+(i+1),job,i<3?'front':'back'));
      s.active=s.roster.map(a=>a.id);s.nextHero=7;s.gear=[];s.nextGear=1;
    }
    for(const a of s.roster) {
      a.lv=level;syncHero(a);
      let type=config==='starter'?item(a.weapon).type:'club';
      if(config==='starter_medium'&&a.row==='back')type='spear';
      if(config==='six_mixed')type=a.job==='ranger'?'bow':['mage','priest','tactician'].includes(a.job)?'staff':'club';
      let g=item(a.weapon);
      if(!g){g={id:s.nextGear++,material:'wood',slot:'weapon',method:'physical',quality:1,enchant:null,ownerId:a.id};s.gear.push(g);a.weapon=g.id;}
      g.type=type;g.dur=g.maxDur=60;BRPGEquipment.enrich(g);
      a.hp=stats(a).hp;a.mp=stats(a).mp;a.sp=maxSP(a);
    }
    render();assert(validSave(s),'valid simulation fixture');
    enterMap(mapId);encounter();stopAll();
    const battle=s.battle,enemies=JSON.stringify(battle.enemies.map(e=>[e.id,e.row,e.maxhp,e.atk,e.mag])),start=party().reduce((v,a)=>({hp:v.hp+a.hp,mp:v.mp+a.mp,sp:v.sp+a.sp}),{hp:0,mp:0,sp:0});
    let turns=0,defends=0,skills=0;
    while(s.battle&&turns<100) {
      autoPlans();
      for(const a of alive()) {
        const p=s.battle.plans[a.id];assert(p,'every actor receives a plan');
        if(p.command==='defend')defends++;
        const skill=p.command==='skill'?BRPGFormation.skillDef(a,p.skill):null;
        if(skill){skills++;assert(skill.mp<a.mp,'auto plans must leave positive MANA');}
        if(p.command==='attack'||skill&&['enemy','allEnemies'].includes(skill.target))assert(BRPGFormation.targets(a,skill).some(e=>e.key===p.target),'auto target must be reachable');
      }
      const turn=s.battle.turn;executeTurn();turns++;
      assert(!s.battle||s.battle.turn>turn,'an automatic turn must advance');
    }
    assert(!s.battle,'combat must finish within 100 turns: '+config+'/'+mapId+'/'+seed);
    assert(validSave(s),'post-combat save remains valid');
    const end=party().reduce((v,a)=>({hp:v.hp+a.hp,mp:v.mp+a.mp,sp:v.sp+a.sp}),{hp:0,mp:0,sp:0});
    stopAll();
    return {enemies,win:battle.enemies.every(e=>e.hp<=0),turns,defends,skills,hpLoss:Math.max(0,start.hp-end.hp),mpUsed:Math.max(0,start.mp-end.mp),spUsed:Math.max(0,start.sp-end.sp)};
  }
`);

const maps = JSON.parse(h.run(`JSON.stringify(['forest_edge','rocky_path','crystal_cave'].map(id=>({id,level:worldMap(id).level})))`));
const configs = ['starter', 'legacy_near', 'starter_medium', 'six_melee', 'six_mixed'];
// Spread the samples across uint32 instead of clustering the LCG's initial draws.
const seeds = Array.from({ length: 30 }, (_, i) => Math.imul(i + 1, 0x9e3779b1) >>> 0);
const summary = [], encounters = new Map();
for (const map of maps) for (const config of configs) {
  const run = () => h.run(`JSON.stringify(${JSON.stringify(seeds)}.map(seed=>measureCombat(${JSON.stringify(config)},${JSON.stringify(map.id)},seed)))`);
  const first = run();
  assert.equal(run(), first, 'Repeated seeds must reproduce every result: ' + config + '/' + map.id);
  const fights = JSON.parse(first), average = key => Number((fights.reduce((total, f) => total + f[key], 0) / fights.length).toFixed(2));
  if (config === 'starter') encounters.set(map.id, fights.map(f => f.enemies));
  else assert.deepEqual(fights.map(f => f.enemies), encounters.get(map.id), 'Compare formations against identical seeded enemies');
  const row = { map: map.id, level: map.level, config, wins: fights.filter(f => f.win).length, fights: fights.length,
    turns: average('turns'), maxTurns: Math.max(...fights.map(f => f.turns)), defends: average('defends'), skills: average('skills'), hpLoss: average('hpLoss'), mpUsed: average('mpUsed'), spUsed: average('spUsed') };
  summary.push(row);
}
console.table(summary);
for (const map of maps) {
  const baseline = summary.find(r => r.map === map.id && r.config === 'legacy_near');
  const ranged = summary.find(r => r.map === map.id && r.config === 'starter');
  assert(ranged.defends < baseline.defends, 'Reach-capable rear equipment must reduce idle defense');
  if (map.level === 1) assert(ranged.wins >= 24, 'Fresh starter party must win at least 80% of the 30 seeded entry fights');
}
const total = summary.reduce((count, row) => count + row.fights, 0);
console.log('PASS: ' + total + ' seeded fights reproduced twice (' + total * 2 + ' total), paired enemies, reachable auto plans, MANA safety, valid saves and no stalled combat.');
