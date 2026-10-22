// Copy only browser assets into Cloudflare Pages' public directory.
const {mkdirSync, copyFileSync, rmSync, readFileSync, statSync} = require('node:fs');
const {join, dirname} = require('node:path');

const root = join(__dirname, '..');
const output = join(root, 'dist');
const files = [
  'index.html', 'privacy.html', 'terms.html', 'style.css',
  'data.js', 'world-data.js', 'catalog-data.js', 'jobs-data.js',
  'game.js', 'screens.js', 'systems.js', 'characters.js',
  'facilities.js', 'equipment.js', 'equipment.css', 'exploration-ui.js', 'exploration-ui.css',
  'formation.js', 'formation.css', 'save-manager.js', '幻想モンスター図鑑 40種.png',
  'audio.js', 'audio.css', 'Cath_Slan_na_n_Og.mp3', 'The_Wayfarer_s_Morning.mp3', 'Sho_lah_Beneath_the_Moon.mp3',
  'audio/Cath_Slan_na_n_Og.mp3', 'audio/The_Wayfarer_s_Morning.mp3', 'audio/Sho_lah_Beneath_the_Moon.mp3',
  'monster-art.js', 'monster-art.css',
  'monsters_sheet02_M0031-M0060.png', 'monsters_sheet03_M0061-M0090.png',
  'monsters_sheet04_M0091-M0120.png', 'monsters_sheet05_M0121-M0150.png',
  'monsters_sheet06_M0151-M0180.png', 'monsters_sheet07_M0181-M0210.png',
  'monsters_sheet08_M0211-M0240.png', 'monsters_sheet09_M0241-M0270.png',
  'monsters_sheet10_M0271-M0300.png', 'monsters_sheet11_M0301-M0330.png',
  'monsters_sheet12_M0331-M0360.png', 'monsters_sheet13_M0361-M0390.png',
  'monsters_sheet14_M0391-M0400.png', 'monsters_sheet14_M0391-M0400_alt.png'
];

// Reject missing assets before replacing the last successful build. Keep the
// allowlist explicit so adding an HTML reference cannot publish private files.
for (const file of files) {
  const stat = statSync(join(root, file));
  if (!stat.isFile()) throw Error('Not a browser asset: ' + file);
  if (stat.size > 25 * 1024 * 1024) throw Error('Browser asset exceeds Pages 25MiB limit: ' + file);
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
for (const file of files) {
  const dest = join(output, file);
  mkdirSync(dirname(dest), {recursive: true});
  copyFileSync(join(root, file), dest);
}
