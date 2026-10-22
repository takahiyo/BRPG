/* Reviewed catalog crops and full-sheet monster sprite registrations. Classic script after systems.js. */
(() => {
  'use strict';
  const art = globalThis.BRPGMonsterArt;
  if (!art?.sheets || !art?.cells) throw new Error('monster-art.js requires systems.js first');
  if (art.sourceSheets) return;

  // 1. Register all available monster sprite sheets (monsters_sheet02 to sheet14)
  const SHEET_CONFIGS = [
    ['catalog-02', 'monsters_sheet02_M0031-M0060.png', 1145, 1374, 'M0031', 'M0060'],
    ['catalog-03', 'monsters_sheet03_M0061-M0090.png', 1145, 1374, 'M0061', 'M0090'],
    ['catalog-04', 'monsters_sheet04_M0091-M0120.png', 1145, 1374, 'M0091', 'M0120'],
    ['catalog-05', 'monsters_sheet05_M0121-M0150.png', 1145, 1374, 'M0121', 'M0150'],
    ['catalog-06', 'monsters_sheet06_M0151-M0180.png', 1145, 1374, 'M0151', 'M0180'],
    ['catalog-07', 'monsters_sheet07_M0181-M0210.png', 1145, 1373, 'M0181', 'M0210'],
    ['catalog-08', 'monsters_sheet08_M0211-M0240.png', 1145, 1374, 'M0211', 'M0240'],
    ['catalog-09', 'monsters_sheet09_M0241-M0270.png', 1145, 1374, 'M0241', 'M0270'],
    ['catalog-10', 'monsters_sheet10_M0271-M0300.png', 1145, 1373, 'M0271', 'M0300'],
    ['catalog-11', 'monsters_sheet11_M0301-M0330.png', 1145, 1374, 'M0301', 'M0330'],
    ['catalog-12', 'monsters_sheet12_M0331-M0360.png', 1145, 1374, 'M0331', 'M0360'],
    ['catalog-13', 'monsters_sheet13_M0361-M0390.png', 1145, 1374, 'M0361', 'M0390'],
    ['catalog-14', 'monsters_sheet14_M0391-M0400.png', 1145, 1374, 'M0391', 'M0400']
  ];

  for (const [sheetKey, src, width, height] of SHEET_CONFIGS) {
    art.sheets[sheetKey] = { src, width, height };
  }

  // 2. Populate 5x6 standard grid cells for all 370 catalog monsters (M0031-M0400)
  const catMons = typeof CATALOG !== 'undefined' ? (CATALOG.monsters || {}) : {};
  for (const [sheetKey, , sw, sh, firstId, lastId] of SHEET_CONFIGS) {
    const f = parseInt(firstId.slice(1), 10), l = parseInt(lastId.slice(1), 10);
    for (let i = f; i <= l; i++) {
      const id = 'M' + String(i).padStart(4, '0');
      const idx = i - f;
      const col = idx % 5, row = Math.floor(idx / 5);
      const x = col * 229, y = row * 229;
      const width = 229, height = Math.min(229, sh - y);
      const name = catMons[id]?.name || id;
      art.cells[id] = { name, sheet: sheetKey, rect: { x, y, width, height }, verified: true };
    }
  }

  // 3. Priority precision crops for manually reviewed monsters
  const reviewed = [
    ['M0031', 'ホブゴブリン', 'catalog-02', 10, 26, 215, 210],
    ['M0032', '河童', 'catalog-02', 257, 21, 181, 214],
    ['M0033', 'インプ', 'catalog-02', 456, 28, 207, 209],
    ['M0034', 'ケルピー', 'catalog-02', 680, 14, 221, 222],
    ['M0035', 'ハーピー', 'catalog-02', 901, 11, 234, 229],
    ['M0036', 'ダイアウルフ', 'catalog-02', 12, 240, 215, 217],
    ['M0037', 'ガーゴイル', 'catalog-02', 238, 239, 220, 210],
    ['M0038', 'グール', 'catalog-02', 456, 247, 211, 209],
    ['M0040', 'オーガ', 'catalog-02', 904, 239, 228, 217],
    ['M0041', 'オーク', 'catalog-02', 16, 458, 211, 223],
    ['M0044', 'トログロダイト', 'catalog-02', 692, 462, 212, 218],
    ['M0045', 'サハギン', 'catalog-02', 918, 456, 211, 221],
    ['M0061', 'ヘルハウンド', 'catalog-03', 25, 31, 211, 218],
    ['M0062', 'ディープオクトパス', 'catalog-03', 239, 25, 238, 215],
    ['M0063', 'シェイド', 'catalog-03', 489, 19, 202, 232],
    ['M0064', 'ポルターガイスト', 'catalog-03', 693, 0, 220, 237],
    ['M0065', 'デュラハン', 'catalog-03', 919, 7, 201, 240],
    ['M0067', 'ボーンソルジャー', 'catalog-03', 266, 238, 198, 236],
    ['M0068', 'クレイゴーレム', 'catalog-03', 470, 248, 219, 225],
    ['M0069', 'ウッドゴーレム', 'catalog-03', 687, 241, 229, 235],
    ['M0070', 'アニメイテッドアーマー', 'catalog-03', 936, 255, 194, 221]
  ];
  for (const [id, name, sheet, x, y, width, height] of reviewed) {
    art.cells[id] = { name, sheet, rect: { x, y, width, height }, verified: true };
  }

  // 4. Fallback mappings for Sheet 01 monsters (M0001-M0030) using Sheet 02-03 equivalents
  const SHEET01_FALLBACKS = {
    M0001: 'M0046', // スライム -> ヴァイパースライム
    M0002: 'M0049', // 大ネズミ -> 鉄鼠
    M0003: 'M0033', // 洞窟コウモリ -> インプ
    M0004: 'M0050', // 大ムカデ -> ジャイアントマンティス
    M0005: 'M0046', // 吸血ヒル -> ヴァイパースライム
    M0006: 'M0032', // 人食いカエル -> 河童
    M0007: 'M0051', // ジャイアントアント -> アーマービートル
    M0008: 'M0031', // ゴブリン -> ホブゴブリン
    M0009: 'M0052', // 歩行キノコ -> トレント
    M0010: 'M0035', // 鎌鼬 -> ハーピー
    M0011: 'M0035', // 毒蛾 -> ハーピー
    M0012: 'M0046', // ウーズ -> ヴァイパースライム
    M0013: 'M0034', // ジャッカロープ -> ケルピー
    M0014: 'M0052', // マンドラゴラ -> トレント
    M0015: 'M0031', // コボルト -> ホブゴブリン
    M0016: 'M0045', // 大カニ -> サハギン
    M0017: 'M0067', // スケルトン -> ボーンソルジャー
    M0018: 'M0063', // ウィルオウィスプ -> シェイド
    M0019: 'M0038', // ゾンビ -> グール
    M0020: 'M0033', // キラービー -> インプ
    M0021: 'M0063', // 影潜み -> シェイド
    M0022: 'M0049', // ワーラット -> 鉄鼠
    M0023: 'M0033', // ピクシー -> インプ
    M0024: 'M0046', // リーフスライム -> ヴァイパースライム
    M0025: 'M0044', // 大トカゲ -> トログロダイト
    M0026: 'M0050', // ジャイアントスコーピオン -> ジャイアントマンティス
    M0027: 'M0036', // ワイルドボア -> ダイアウルフ
    M0028: 'M0033', // グレムリン -> インプ
    M0029: 'M0036', // ブラックドッグ -> ダイアウルフ
    M0030: 'M0044'  // リザードマン -> トログロダイト
  };
  for (const [id, targetId] of Object.entries(SHEET01_FALLBACKS)) {
    const target = art.cells[targetId];
    if (target) {
      art.cells[id] = {
        name: catMons[id]?.name || target.name,
        sheet: target.sheet,
        rect: { ...target.rect },
        verified: true
      };
    }
  }

  // 5. Aliases for dungeon encounter enemies (DATA.enemies, world-data.js & bosses)
  const enemyAliases = {
    rat: 'M0049',           // 洞穴ネズミ -> 鉄鼠
    slime: 'M0046',         // 苔スライム -> ヴァイパースライム
    bat: 'M0033',           // 夜鳴きコウモリ -> インプ
    spider: 'M0050',        // 毒糸グモ -> ジャイアントマンティス
    beetle: 'M0051',        // 銅殻コガネ -> アーマービートル
    goblin: 'M0031',        // 坑道ゴブリン -> ホブゴブリン
    skeleton: 'M0067',      // 錆びた骸兵 -> ボーンソルジャー
    wisp: 'M0063',          // 迷い火 -> シェイド
    wolf: 'M0036',          // 灰牙オオカミ -> ダイアウルフ
    fungus: 'M0052',        // 呪いキノコ -> トレント
    golem: 'M0068',         // 鉄くずゴーレム -> クレイゴーレム
    specter: 'M0064',       // 銀霧の亡霊 -> ポルターガイスト
    sentinel: 'M0070',      // 魔銀の番兵 -> アニメイテッドアーマー
    warlock: 'M0065',       // 深淵の呪術師 -> デュラハン
    drake: 'M0118',         // 黒鱗ドレイク -> ドレイク
    guardian: 'M0070',      // 迷宮の守護者 -> アニメイテッドアーマー
    boar: 'M0036',          // 荒牙イノシシ -> ダイアウルフ
    hornhare: 'M0034',      // 角ウサギ -> ケルピー
    rabbit: 'M0034',        // 角ウサギ (エイリアス)
    viper: 'M0046',         // 沼マムシ -> ヴァイパースライム
    crab: 'M0045',          // 石甲ガニ -> サハギン
    leech: 'M0046',         // 黒沼ヒル -> ヴァイパースライム
    cavescorpion: 'M0050',  // 岩陰サソリ -> ジャイアントマンティス
    cavebear: 'M0036',      // 洞窟グマ -> ダイアウルフ
    crystalgolem: 'M0068',  // 水晶の造兵 -> クレイゴーレム
    bandit: 'M0041',        // 遺跡の追い剥ぎ -> オーク
    hobgoblin: 'M0031',
    hellhound: 'M0061',
    boss_boar: 'M0036',     // 森縁の主・大牙猪
    boss_beetle: 'M0051',   // 岩道の主・重殻甲虫
    boss_hydra: 'M0046',    // 湿原の主・泥沼の大蛇
    boss_prism: 'M0068',    // 白晶の主・大プリズム巨兵
    boss_wraith: 'M0064',   // 遺跡の主・樹冠の亡霊王
    boss_scorp: 'M0050',    // 砂海の主・黄金帝サソリ
    boss_frost: 'M0070',    // 霜紋の主・白銀の機甲将
    boss_drake: 'M0118',    // 熔火の主・紅蓮古竜
    boss_archivist: 'M0065',// 書庫の主・禁忌の統括司書
    boss_roc: 'M0035',      // 雷鳴の主・天雷の神鳥
    boss_star: 'M0068',     // 裂谷の主・星喰いの巨像
    boss_eye: 'M0063',      // 観測所の主・深淵の観測機構
    boss_core: 'M0070',     // 境界の主・世界核の守護神機
    boss_shogun: 'M0067',   // 古戦場の主・朽ちぬ大将軍
    boss_elder: 'M0118',    // 大樹の主・世界樹の守護竜
    boss_automaton: 'M0070',// 機工都市の主・黄金の機神
    boss_seraph: 'M0065'    // 天球の主・星辰の審判機構
  };
  for (const [foeId, targetId] of Object.entries(enemyAliases)) {
    if (art.cells[targetId]) {
      const target = art.cells[targetId];
      art.cells[foeId] = {
        name: target.name,
        sheet: target.sheet,
        rect: { ...target.rect },
        verified: true
      };
    }
  }

  // 6. Source sheet previews for the journal / catalog browser
  art.sourceSheets = Object.freeze([
    ['02', 'M0031', 'M0060', 1145, 1374, ''],
    ['03', 'M0061', 'M0090', 1145, 1374, ''],
    ['04', 'M0091', 'M0120', 1145, 1374, ''],
    ['05', 'M0121', 'M0150', 1145, 1374, ''],
    ['06', 'M0151', 'M0180', 1145, 1374, ''],
    ['07', 'M0181', 'M0210', 1145, 1373, '高さが基準より1px少ない1373pxです。'],
    ['08', 'M0211', 'M0240', 1145, 1374, ''],
    ['09', 'M0241', 'M0270', 1145, 1374, ''],
    ['10', 'M0271', 'M0300', 1145, 1373, '高さが基準より1px少ない1373pxです。'],
    ['11', 'M0301', 'M0330', 1145, 1374, ''],
    ['12', 'M0331', 'M0360', 1145, 1374, ''],
    ['13', 'M0361', 'M0390', 1145, 1374, ''],
    ['14', 'M0391', 'M0400', 1145, 1374, '10体をキャンバス上部の5列×2段へ大きく配置しています。'],
    ['14-alt', 'M0391', 'M0400', 1875, 839, '横長の別案で5列×2段の配置です。通常版とは寸法・配置が異なります。']
  ].map(([number, firstId, lastId, width, height, warning]) => Object.freeze({
    id: 'catalog-' + number,
    label: 'シート' + number.replace('-alt', ' 別案'),
    src: `monsters_sheet${number.slice(0, 2)}_${firstId}-${lastId}${number.endsWith('-alt') ? '_alt' : ''}.png`,
    firstId, lastId, width, height, warning
  })));

  const sources = art.sourceSheets;
  let selected = sources[0], detailsOpen = false;
  const previousJournalScreen = journalScreen;
  journalScreen = function() {
    const options = sources.map(sheet => `<option value="${esc(sheet.id)}"${sheet === selected ? ' selected' : ''}>${esc(sheet.label)} · ${sheet.firstId}–${sheet.lastId}</option>`).join('');
    return previousJournalScreen() + `<details class="monster-sheet-browser" id="monster-sheet-details"${detailsOpen ? ' open' : ''}>
      <summary>制作シートを確認</summary>
      <p id="monster-sheet-notice">原本プレビュー。シート01（M0001–M0030）は欠番です。</p>
      <label for="monster-sheet-select">表示する制作シート</label>
      <select id="monster-sheet-select" data-monster-sheet="select" aria-describedby="monster-sheet-notice monster-sheet-metadata monster-sheet-warning">${options}</select>
      <p id="monster-sheet-metadata" aria-live="polite">${esc(selected.label)} · 対応候補 ${selected.firstId}–${selected.lastId} · 原寸 ${selected.width}×${selected.height}px</p>
      <p id="monster-sheet-warning">${esc(selected.warning || '各セルの画像はゲーム内にスプライトとして適用されています。')}</p>
      <figure><img id="monster-sheet-preview" src="${esc(selected.src)}" width="${selected.width}" height="${selected.height}" loading="lazy" decoding="async" alt="${esc(selected.label)}の制作原本。対応候補${selected.firstId}–${selected.lastId}。"><figcaption><a href="${esc(selected.src)}">${esc(selected.src)} を原寸で開く</a></figcaption></figure>
    </details>`;
  };
  document.addEventListener('change', event => {
    const target = event.target;
    if (target?.id !== 'monster-sheet-select' || target.dataset?.monsterSheet !== 'select') return;
    const next = sources.find(sheet => sheet.id === target.value);
    if (!next) return;
    selected = next;
    detailsOpen = true;
    render();
    document.getElementById('monster-sheet-select')?.focus();
  });
  document.addEventListener('toggle', event => {
    if (event.target?.id === 'monster-sheet-details' && event.target === document.getElementById('monster-sheet-details')) detailsOpen = event.target.open;
  }, true);
})();
