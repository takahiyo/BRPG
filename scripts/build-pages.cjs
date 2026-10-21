// Copy only browser assets into Cloudflare Pages' public directory.
const {mkdirSync, copyFileSync, rmSync} = require('node:fs');
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

rmSync(output, {recursive: true, force: true});
mkdirSync(output, {recursive: true});
for (const file of files) copyFileSync(join(root, file), join(output, file));
