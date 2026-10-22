'use strict';
// Exercise build failure ordering without deleting or copying any real files.
const fs = require('node:fs'), vm = require('node:vm'), path = require('node:path'), assert = require('node:assert/strict');
const source = fs.readFileSync(path.join(__dirname, 'scripts/build-pages.cjs'), 'utf8');
function build({missing, reference, oversized} = {}) {
  const calls = [];
  const fakeFs = {
    statSync(file) {
      if (path.basename(file) === missing) throw Error('Missing asset: ' + missing);
      if (path.basename(file) === oversized) return {isFile: () => true, size: 25 * 1024 * 1024 + 1};
      return fs.statSync(file);
    },
    readFileSync(file, encoding) {
      const text = fs.readFileSync(file, encoding);
      return path.basename(file) === 'index.html' && reference ? text + reference : text;
    },
    rmSync(file) { calls.push(['remove', file]); },
    mkdirSync(file) { calls.push(['mkdir', file]); },
    copyFileSync(from, to) { calls.push(['copy', from, to]); }
  };
  let error;
  try {
    vm.runInNewContext(source, { __dirname: path.join(__dirname, 'scripts'), require: id => id === 'node:fs' ? fakeFs : require(id) });
  } catch (e) { error = e; }
  return {calls, error};
}
let result = build();
assert.ifError(result.error);
const copies = result.calls.filter(c => c[0] === 'copy').map(c => path.basename(c[1]));
for (const file of ['equipment.js', 'equipment.css', 'exploration-ui.js', 'exploration-ui.css', 'save-manager.js', 'audio.js', 'audio.css', 'Cath_Slan_na_n_Og.mp3', 'The_Wayfarer_s_Morning.mp3', 'Sho_lah_Beneath_the_Moon.mp3', 'monster-art.js', 'monster-art.css']) assert(copies.includes(file));
assert.equal(copies.filter(file => /^monsters_sheet/.test(file)).length, 14);
for (const file of ['worker.js', 'wrangler.toml', 'AGENTS.md', '.env', 'test.cjs']) assert(!copies.includes(file));
for (const options of [
  {missing: 'equipment.js'},
  {missing: 'Cath_Slan_na_n_Og.mp3'},
  {missing: 'monsters_sheet14_M0391-M0400_alt.png'},
  {oversized: 'The_Wayfarer_s_Morning.mp3'},
  {reference: '<script src="new-feature.js?v=1"></script>'},
  {reference: '<a href="worker.js">private source</a>'}
]) {
  result = build(options);
  assert(result.error, 'invalid build input must fail');
  assert.equal(result.calls.length, 0, 'failed validation preserves previous output');
}
assert.ifError(build({reference: '<a href="#help">help</a><a href="https://example.com">external</a>'}).error);
console.log('PASS: public asset allowlist, HTML references and preflight preserve previous build on failure.');
