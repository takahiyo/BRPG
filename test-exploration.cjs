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
assert.equal([...timers.values()][0].ms, 3000);
advance(2999);
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
  const stale = [...timers.values()].find(t => t.ms === 3000).f;
  h.run(manual);
  h.run(`assert(!BRPGExplorationUI.isWaiting()&&!walkTimer&&!battleTimer&&!s.autoExpedition);`);
  stale();advance(4000);
  h.run(`assert(!BRPGExplorationUI.isWaiting()&&!walkTimer&&!battleTimer&&!s.autoExpedition);$('character-dialog').close();`);
}
h.run('winAutomatically();');
const oldWait = [...timers.values()].find(t => t.ms === 3000).f;
h.run('winAutomatically();');
oldWait();
h.run(`assert(BRPGExplorationUI.isWaiting()&&!walkTimer);`);
assert.equal(timers.size, 1, 'An old callback cannot cancel the new wait');
advance(3000);
h.run(`assert(!BRPGExplorationUI.isWaiting()&&walkTimer);`);

// Reject a stale state/floor and cancel the wait before a new encounter.
for (const replace of [`s=fresh()`, `s.dungeon=structuredClone(s.dungeon)`]) {
  h.run('winAutomatically();');
  h.run(replace);advance(3000);
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
console.log('PASS: command → target → confirm → turn, click listener integration, painted exit, 3-second wait, stale/cancelled timers, manual intervention, walking-only and battle-only scopes.');
