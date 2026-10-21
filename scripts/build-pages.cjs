// Copy only browser assets into Cloudflare Pages' public directory.
const {mkdirSync, copyFileSync, rmSync, readFileSync, statSync} = require('node:fs');
const {join} = require('node:path');

const root = join(__dirname, '..');
const output = join(root, 'dist');
const files = [
  'index.html', 'privacy.html', 'terms.html', 'style.css',
  'data.js', 'world-data.js', 'catalog-data.js', 'jobs-data.js',
  'game.js', 'screens.js', 'systems.js', 'characters.js',
  'facilities.js', 'equipment.js', 'equipment.css', 'exploration-ui.js', 'exploration-ui.css',
  'save-manager.js', '幻想モンスター図鑑 40種.png'
];

// Reject missing assets before replacing the last successful build. Keep the
// allowlist explicit so adding an HTML reference cannot publish private files.
for (const file of files) {
  if (!statSync(join(root, file)).isFile()) throw Error('Not a browser asset: ' + file);
}
for (const file of files.filter(file => file.endsWith('.html'))) {
  const html = readFileSync(join(root, file), 'utf8');
  for (const [, url] of html.matchAll(/(?:src|href)\s*=\s*["']([^"']+)["']/gi)) {
    if (/^(?:[a-z][a-z\d+.-]*:|\/\/|#)/i.test(url)) continue;
    const asset = decodeURIComponent(url.split(/[?#]/)[0]).replace(/^(?:\.\/|\/)/, '') || 'index.html';
    if (asset && !files.includes(asset)) throw Error('Unlisted browser asset in ' + file + ': ' + asset);
  }
}

rmSync(output, {recursive: true, force: true});
mkdirSync(output, {recursive: true});
for (const file of files) copyFileSync(join(root, file), join(output, file));
