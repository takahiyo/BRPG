'use strict';
// Isolated VM integration: every network response and timeout is controlled here.
const fs = require('fs'), assert = require('assert');
const { harness } = require('./test.cjs');
const flush = async () => { for (let i = 0; i < 15; i++) await Promise.resolve(); };
const response = (body, status = 200) => ({ ok: status >= 200 && status < 300, status, json: async () => body });
function setup() {
  const h = harness(), calls = [], pending = [], timeouts = new Map();
  let callback, next = 1;
  const google = { accounts: { id: {
    initialize(options) { callback = options.callback; }, renderButton() {}, disableAutoSelect() {}
  } } };
  Object.assign(h.box, {
    window: { google }, google, location: { protocol: 'https:' },
    AbortSignal: { timeout: () => undefined },
    setTimeout(fn) { const id = next++; timeouts.set(id, fn); return id; },
    clearTimeout(id) { timeouts.delete(id); },
    fetch(url, options = {}) {
      calls.push({ url, ...options });
      if (url === '/api/config') return Promise.resolve(response({ cloudEnabled: true, googleClientId: 'fake-client' }));
      assert.equal(url, '/api/save', 'unexpected network destination');
      return new Promise(resolve => pending.push({ resolve, options }));
    }
  });
  h.run(fs.readFileSync(__dirname + '/save-manager.js', 'utf8'));
  h.run('boot()');
  return {
    ...h, calls, pending, timeouts,
    async login(account = 'account-a') {
      if (!callback) await h.run("$('save-google').onclick()");
      callback({ credential: account }); await flush();
    },
    async reply(body, status = 200) {
      assert(pending.length, 'expected pending request');
      pending.shift().resolve(response(body, status)); await flush();
    },
    async tick() {
      const [id, fn] = timeouts.entries().next().value || [];
      assert(fn, 'expected scheduled cloud save'); timeouts.delete(id); fn(); await flush();
    },
    click(id) { return h.run(`$('${id}').onclick()`); }
  };
}
(async () => {
  const h = setup();
  await h.login();
  assert.equal(h.pending[0].options.method, 'GET');
  await h.reply({ save: null, revision: 0 });
  assert.equal(h.pending[0].options.method, 'PUT');
  let body = JSON.parse(h.pending[0].options.body);
  assert.equal(body.revision, 0); assert.equal(body.save.gold, h.run('s.gold'));
  await h.reply({ revision: 1 });
  h.run('s.gold += 7; render()');
  assert.equal(h.timeouts.size, 1);
  await h.tick();
  body = JSON.parse(h.pending[0].options.body);
  assert.equal(body.revision, 1); assert.equal(body.save.gold, h.run('s.gold'));
  // A mutation while PUT is pending must schedule another snapshot after success.
  h.run('s.gold += 3; render()');
  await h.reply({ revision: 2 });
  assert.equal(h.timeouts.size, 1); await h.tick();
  assert.equal(JSON.parse(h.pending[0].options.body).revision, 2);
  await h.reply({}, 409);
  h.run('s.gold += 1; render()');
  assert.equal(h.timeouts.size, 0, 'conflict must stop automatic overwrites');
  assert(h.run("$('cloud-message').textContent").includes('別の端末'));
  assert.equal(JSON.parse(h.store.get('ashen-atlas-v3')).gold, h.run('s.gold'));

  const local = setup(); await local.login();
  const remote = JSON.parse(local.run('JSON.stringify(s)')); remote.gold = 9999;
  const before = local.run('s.gold'); local.click('save-local');
  await local.reply({ save: remote, revision: 4 });
  assert.equal(local.run('s.gold'), before, 'stale GET must not replace local adventure');
  assert.equal(local.pending.length, 0); assert.equal(local.timeouts.size, 0);
  assert(local.run("$('cloud-message').textContent").includes('ローカル'));

  const accounts = setup(); await accounts.login('account-a');
  await accounts.login('account-b');
  await accounts.reply({ save: remote, revision: 4 });
  assert.equal(accounts.run('s.gold'), before);
  assert.equal(accounts.pending.length, 0, 'A response must never cause PUT under B');
  accounts.click('save-connect'); await flush();
  assert.equal(accounts.pending[0].options.headers.Authorization, 'Bearer account-b');
  await accounts.reply({ save: null, revision: 0 });
  assert.equal(accounts.pending[0].options.headers.Authorization, 'Bearer account-b');
  await accounts.reply({ revision: 1 });

  const load = setup(); await load.login();
  const original = load.run('s.gold');
  await load.reply({ save: remote, revision: 8 });
  assert.equal(load.run('s.gold'), remote.gold);
  assert.equal(JSON.parse(load.store.get('ashen-atlas-v3-before-cloud')).gold, original);
  assert.equal(JSON.parse(load.pending[0].options.body).revision, 8);
  await load.reply({ revision: 9 });
  assert(![...load.store.values()].some(value => value.includes('account-a')), 'credentials must remain outside storage');
  console.log('PASS: cloud upload/load, local backup, revision autosave, in-flight mutation, conflict stop, stale local/account GET, memory-only credentials.');
})().catch(error => { console.error(error); process.exitCode = 1; });
