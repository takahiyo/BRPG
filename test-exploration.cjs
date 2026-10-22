'use strict';
const assert = require('assert');
const { harness } = require('./test.cjs');
const h = harness();

// Model the browser's intervals and event listeners without real-time sleeps.
let time = 0, nextTimer = 1;
const timers = new Map(), listeners = new Map();
h.box.setInterval = (f, ms) => { const id = nextTimer++; timers.set(id, { f, ms, at: time + ms }); return id; };
h.box.clearInterval = id => timers.delete(id);
h.box.document.addEventListener = (type, listener) => {
  if (!listeners.has(type)) listeners.set(type, []);
  listeners.get(type).push(listener);
};
h.box.click = (action, fields = {}) => {
  const button = { dataset: { action, ...fields }, disabled: false };
  const event = { target: { closest: () => button } };
  for (const listener of listeners.get('click') || []) listener(event);
};
function advance(ms) {
  const end = time + ms;
  for (;;) {
    const due = [...timers.entries()].filter(([, t]) => t.at <= end).sort((a, b) => a[1].at - b[1].at)[0];
    if (!due) break;
    const [id, timer] = due;
    time = timer.at;
    timer.at += timer.ms;
    timer.f();
    if (!timers.has(id)) continue;
  }
  time = end;
}
h.run(`
  boot();
  function resetExploration() { stopAll();s=fresh();notice='';enterMap('forest_edge'); }
  function winAutomatically() {
    resetExploration();click('exp-auto-mode',{mode:'continuous'});click('exp-auto-toggle');
    assert(walkTimer&&s.autoExpedition);encounter();assert(battleTimer&&!walkTimer);
    s.battle.enemies.forEach(e=>damageEnemy(e,10000,'physical'));victory();
    assert(BRPGExplorationUI.isWaiting()&&!walkTimer&&!battleTimer&&s.autoExpedition);
  }
  winAutomatically();
`);
assert.equal(timers.size, 1);
assert.equal([...timers.values()][0].ms, 1500);
advance(1499);
h.run(`assert(BRPGExplorationUI.isWaiting()&&!walkTimer);assert.equal(s.dungeon.steps,0);`);
advance(1);
h.run(`assert(!BRPGExplorationUI.isWaiting()&&walkTimer&&!battleTimer&&s.autoExpedition);assert.equal(s.dungeon.steps,0);`);
assert.equal(timers.size, 1, 'Only the walking interval survives the wait');

// Cancellation survives already-queued callbacks and immediate restart.
for (const manual of [
  `click('exp-auto-toggle')`,
  `step(0,-1)`, // An attempted move into a wall is still a manual intervention.
  `openCharacter(s.active[0])`,
  `moveView('catalog')`,
  `click('return')`,
  `click('exp-auto-mode',{mode:'walk'})`
]) {
  h.run('winAutomatically();');
  const stale = [...timers.values()].find(t => t.ms === 1500).f;
  h.run(manual);
  h.run(`assert(!BRPGExplorationUI.isWaiting()&&!walkTimer&&!battleTimer&&!s.autoExpedition);`);
  stale();advance(2000);
  h.run(`assert(!BRPGExplorationUI.isWaiting()&&!walkTimer&&!battleTimer&&!s.autoExpedition);$('character-dialog').close();`);
}
h.run('winAutomatically();');
const oldWait = [...timers.values()].find(t => t.ms === 1500).f;
h.run('winAutomatically();');
oldWait();
h.run(`assert(BRPGExplorationUI.isWaiting()&&!walkTimer);`);
assert.equal(timers.size, 1, 'An old callback cannot cancel the new wait');
advance(1500);
h.run(`assert(!BRPGExplorationUI.isWaiting()&&walkTimer);`);

// Reject a stale state/floor and cancel the wait before a new encounter.
for (const replace of [`s=fresh()`, `s.dungeon=structuredClone(s.dungeon)`]) {
  h.run('winAutomatically();');
  h.run(replace);advance(1500);
  h.run(`assert(!walkTimer&&!battleTimer&&!BRPGExplorationUI.isWaiting());stopAll();`);
}
h.run(`winAutomatically();encounter();assert(!BRPGExplorationUI.isWaiting()&&s.battle&&battleTimer);stopAll();`);

// The separate scopes have different stopping behavior.
h.run(`
  resetExploration();click('exp-auto-mode',{mode:'walk'});click('exp-auto-toggle');
  assert(walkTimer&&s.autoExpedition);encounter();
  assert(s.battle&&!walkTimer&&!battleTimer&&!s.autoExpedition);
  click('exp-auto-mode',{mode:'battle'});click('exp-auto-toggle');
  assert(battleTimer&&!s.autoExpedition);
  s.battle.enemies.forEach(e=>damageEnemy(e,10000,'physical'));victory();
  assert(!walkTimer&&!battleTimer&&!BRPGExplorationUI.isWaiting());
  resetExploration();encounter();s.battle.enemies.forEach(e=>damageEnemy(e,10000,'physical'));victory();
  assert(!walkTimer&&!battleTimer&&!BRPGExplorationUI.isWaiting());
`);

// Exercise the actual boot click listeners, including the existing extensions.
h.run(`
  resetExploration();encounter();
  const first=s.battle.actor;
  assert(!uiBattlePanel().includes('data-action="exp-command-target"'));
  click('target',{id:'1'});assert.equal(s.battle.target,0);
  click('command',{command:'attack'});
  assert(!s.battle.plans[first]);
  assert(uiBattlePanel().includes('data-action="exp-command-target"'));
  click('exp-command-confirm');assert(!s.battle.plans[first]);
  click('target',{id:'1'});assert(!s.battle.plans[first]);
  click('exp-command-confirm');assert.equal(s.battle.plans[first].command,'attack');assert.equal(s.battle.plans[first].target,1);
  assert.notEqual(s.battle.actor,first);assert(!uiBattlePanel().includes('data-action="exp-command-target"'));

  const priest=party().find(h=>h.job==='priest');click('actor',{id:String(priest.id)});
  click('command',{command:'skill',skill:'heal'});click('exp-command-confirm');assert(!s.battle.plans[priest.id]);
  click('exp-command-target',{id:String(first)});click('exp-command-confirm');
  assert.equal(s.battle.plans[priest.id].skill,'heal');assert.equal(s.battle.plans[priest.id].target,first);

  click('actor',{id:String(first)});click('command',{command:'attack'});click('exp-command-target',{id:'1'});
  s.items.potion=2;click('command',{command:'item',item:'potion'});click('exp-command-confirm');
  assert.equal(s.battle.plans[first].command,'attack','Changing command clears its tentative target');
  click('exp-command-target',{id:String(priest.id)});click('exp-command-confirm');
  assert.equal(s.battle.plans[first].item,'potion');assert.equal(s.battle.plans[first].target,priest.id);
  assert.equal(s.items.potion,2,'Planning does not consume the item');

  click('actor',{id:String(first)});click('command',{command:'defend'});
  assert(uiBattlePanel().includes('対象：'+party().find(h=>h.id===first).name));
  click('exp-command-confirm');assert.equal(s.battle.plans[first].command,'defend');
  click('actor',{id:String(first)});party().find(h=>h.id===first).lv=10;syncHero(party().find(h=>h.id===first));
  click('command',{command:'skill',skill:'sweep'});assert(uiBattlePanel().includes('対象：届く敵全員'));
  click('exp-command-confirm');assert.equal(s.battle.plans[first].skill,'sweep');

  // An unfinished change blocks submission even when earlier plans exist.
  click('template');click('actor',{id:String(first)});click('command',{command:'attack'});
  assert(/data-action="execute"[^>]*disabled/.test(uiBattlePanel()));
  click('actor',{id:String(priest.id)});assert(!uiBattlePanel().includes('data-action="exp-command-target"'));
  click('template');const currentTurn=s.battle.turn;click('execute');assert(!s.battle||s.battle.turn>currentTurn);
  stopAll();
`);

// Party markup stays outside the changing battle layout; only the stage switches.
const mediaCalls = [], animations = [];
h.box.playSE = type => mediaCalls.push(type);
h.box.reduceMotion = false;
h.box.matchMedia = () => ({ matches: h.box.reduceMotion });
h.box.document.getElementById('exp-enemy-view').animate = (...args) => animations.push(args);
h.run(`
  function partyMarkup() {
    const html=exploreScreen(), start=html.indexOf('<section class="exp-party"');
    assert(start>=0&&start<html.indexOf('<div class="expedition-layout'));
    assert.equal((html.match(/class="exp-party"/g)||[]).length,1);
    assert(start<html.indexOf('class="exp-map-stage"'));
    assert(start<html.indexOf('class="sectionhead expedition-head"'));
    return html.slice(start,html.indexOf('<div class="sectionhead expedition-head"'));
  }
  resetExploration();
  const fieldParty=partyMarkup();
  assert(!exploreScreen().includes('data-action="exp-stage-view"'));
  click('exp-stage-view',{view:'enemies'});
  assert(!exploreScreen().includes('id="exp-enemy-view"'));
  encounter();
  assert.equal(partyMarkup(),fieldParty,'Identical party markup before and during battle');
  assert(/id="exp-map-view" hidden/.test(exploreScreen()));
  assert(/id="exp-view-enemies"[^>]*aria-pressed="true"/.test(exploreScreen()));
  assert(!/id="exp-enemy-view"[^>]*hidden/.test(exploreScreen()));
  assert(exploreScreen().includes('aria-controls="exp-map-view"'));
  assert(exploreScreen().includes('aria-controls="exp-enemy-view"'));
  assert.equal((exploreScreen().match(/id="map"/g)||[]).length,1);
  render();render();exploreScreen();
`);
assert.deepEqual(mediaCalls, ['encounter'], 'Rendering never plays encounter SE');
assert.equal(animations.length, 1, 'Only the encounter event animates the overlay');
assert.equal(animations[0][1].duration, 260);
assert.equal(timers.size, 0, 'Presentation creates no timers');
h.run(`
  click('command',{command:'attack'});
  const plannedActor=s.battle.actor, unchangedBattle=JSON.stringify(s.battle);
  encounter();
  assert.equal(JSON.stringify(s.battle),unchangedBattle,'No-op encounter cannot reroll enemies or plans');
  assert(uiBattlePanel().includes('data-action="exp-command-target"'),'No-op encounter preserves draft');
  click('exp-stage-view',{view:'map'});
  assert(!/id="exp-map-view" hidden/.test(exploreScreen()));
  assert(/id="exp-enemy-view"[^>]*hidden/.test(exploreScreen()));
  assert(uiBattlePanel().includes('data-action="exp-command-target"'),'MAP does not clear commands');
  const unchangedSave=JSON.stringify(s);
  click('exp-stage-view',{view:'enemies'});click('exp-stage-view',{view:'map'});
  assert.equal(JSON.stringify(s),unchangedSave,'Stage choice is not saved');
  click('exp-command-target',{id:String(BRPGFormation.targets(alive().find(a=>a.id===s.battle.actor))[0].key)});
  click('exp-command-confirm');assert(s.battle.plans[plannedActor],'Commands work with MAP visible');
  click('template');assert.equal(Object.keys(s.battle.plans).length,alive().length);
  click('exp-auto-mode',{mode:'battle'});click('exp-auto-toggle');
`);
const battleIntervals = [...timers.entries()];
h.run(`
  const noOpState=JSON.stringify(s);
  encounter();click('exp-stage-view',{view:'enemies'});click('exp-stage-view',{view:'map'});
  assert.equal(JSON.stringify(s),noOpState);assert(battleTimer);
`);
assert.deepEqual([...timers.entries()], battleIntervals, 'MAP toggles and no-op encounters preserve battle timing');
assert.deepEqual(mediaCalls, ['encounter']);
assert.equal(animations.length, 1, 'Toggling back never replays the entrance animation');

// Loading an ongoing battle defaults to enemies silently, including state replacement.
const battleSave = h.run(`stopAll();save();JSON.stringify(s);`);
const restored = harness({'ashen-atlas-v3':battleSave});
const restoredSounds = [];
restored.box.playSE = type => restoredSounds.push(type);
restored.box.document.getElementById('exp-enemy-view').animate = () => assert.fail('Loading must not animate');
restored.run(`
  boot();assert(s.battle);assert(validSave(s));
  assert(/id="exp-map-view" hidden/.test(exploreScreen()));
  handleAction({target:{closest:()=>({dataset:{action:'exp-stage-view',view:'map'}})}});
  assert(/id="exp-enemy-view"[^>]*hidden/.test(exploreScreen()));
  const restoredState=structuredClone(s);s=restoredState;render();
  assert(/id="exp-map-view" hidden/.test(exploreScreen()));
  encounter();render();stopAll();
`);
assert.deepEqual(restoredSounds, []);
assert.equal(restored.timers.size, 0);

h.run(`
  s.battle.enemies.forEach(e=>damageEnemy(e,10000,'physical'));victory();render();
  assert(!exploreScreen().includes('data-action="exp-stage-view"'));
  const afterVictory=JSON.stringify(s);click('exp-stage-view',{view:'enemies'});
  assert.equal(JSON.stringify(s),afterVictory);
  assert(partyMarkup());
  encounter();assert(/id="exp-map-view" hidden/.test(exploreScreen()));stopAll();
`);
assert.deepEqual(mediaCalls, ['encounter', 'encounter'], 'A genuinely new battle plays exactly once');
assert.equal(animations.length, 2);
h.box.reduceMotion = true;
h.run('resetExploration();encounter();render();stopAll();');
assert.equal(animations.length, 2, 'Reduced motion suppresses the encounter animation');
assert.equal(mediaCalls.length, 3, 'Reduced motion does not change audio policy');
h.box.playSE = () => { throw Error('Audio unavailable'); };
h.run('resetExploration();encounter();assert(s.battle);stopAll();');
delete h.box.playSE;
h.run('resetExploration();encounter();assert(s.battle);stopAll();s=fresh();encounter();assert(!s.battle);');
assert.equal(animations.length, 2);
assert.equal(timers.size, 0);

// Entrance is always painted with a named exit, including while occupied.
const paintText = [];
const canvasContext = new Proxy({
  fillText: text => paintText.push(text),
  createRadialGradient: () => ({ addColorStop() {} })
}, { get: (target, key) => target[key] || (() => {}) });
h.box.document.getElementById('map').getContext = () => canvasContext;
h.run('resetExploration();draw();');
assert(paintText.includes('EXIT'));
assert(!paintText.some(text => ['#', 'o', 'c', '>', '!'].includes(text)), 'Map objects use painted geometry');
h.run('stopAll();');
assert.equal(timers.size, 0);
console.log('PASS: stable party order, battle-only MAP/enemy switch, encounter SE/animation once, silent restoration, reduced motion/audio failure safety, command → target → confirm → turn, painted exit, 1.5-second wait, stale/cancelled timers and automation scopes.');
