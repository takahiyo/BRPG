/* Character records, staged growth, and the town tavern. Classic script: no dependencies. */
(() => {
  const KEYS = Object.keys(ATTRIBUTE_NAMES);
  const RESOURCE_GROWTH = {
    hp: { name: 'LIFE', label: '最大LIFE', rate: 8 },
    mp: { name: 'MANA', label: '最大MANA', rate: 4 },
    sp: { name: 'SP', label: '最大SP', rate: 2 }
  };
  const RESOURCE_KEYS = Object.keys(RESOURCE_GROWTH);
  const ALL_GROWTH_KEYS = [...RESOURCE_KEYS, ...KEYS];
  const GENDERS = { male: '男性', female: '女性', other: 'その他', unspecified: '未設定' };
  const DERIVED = { hp: '最大LIFE', mp: '最大MANA', sp: '最大SP', atk: '攻撃', def: '防御', mag: '魔力', speed: '速度' };
  // Content can add allowedGenders / gender to gear, jobs, or skills, or register a predicate here.
  const rules = globalThis.characterRules = { gear: [], job: [], skill: [] };
  let growthDraft = null, previewDelta = null, recruitForm = null, recruitState = null;

  function state() {
    s.ext ??= {};
    s.ext.alloc ??= {};
    s.ext.freePts ??= {};
    if (!s.ext.tavernCandidates || typeof s.ext.tavernCandidates !== 'object' || Array.isArray(s.ext.tavernCandidates)) s.ext.tavernCandidates = {};
    if (!s.ext.tavernRareHires || typeof s.ext.tavernRareHires !== 'object' || Array.isArray(s.ext.tavernRareHires)) s.ext.tavernRareHires = {};
    return s.ext;
  }
  function initialize(h) {
    if (!Object.hasOwn(GENDERS, h.gender)) h.gender = 'unspecified';
    // Existing characters receive zero offsets. Reading or loading never rolls a new character.
    if (!h.birthAttributes || typeof h.birthAttributes !== 'object' || Array.isArray(h.birthAttributes)) h.birthAttributes = Object.fromEntries(KEYS.map(k => [k, 0]));
    for (const k of KEYS) if (!Number.isInteger(h.birthAttributes[k]) || Math.abs(h.birthAttributes[k]) > 2) h.birthAttributes[k] = 0;
    return h;
  }
  function restrictionAllowed(h, def, kind) {
    if (!h || !def) return false;
    const allowed = def.allowedGenders ?? def.genders ?? def.gender;
    if (allowed && !(Array.isArray(allowed) ? allowed : [allowed]).includes(h.gender)) return false;
    return (rules[kind] || []).every(check => check(h, def) !== false);
  }
  globalThis.characterRestrictionAllowed = restrictionAllowed;
  globalThis.heroBaseOffsets = h => ({ ...initialize(h).birthAttributes });

  const previousMakeHero = makeHero;
  makeHero = function(...args) { return initialize(previousMakeHero(...args)); };
  const previousSync = syncHero;
  syncHero = function(h) { initialize(h); previousSync(h); };
  const previousStats = stats;
  stats = function(h) {
    const st = previousStats(h);
    const e = state(), alloc = e.alloc[h.id] || {};
    const bonusHp = (alloc.hp || 0) + (previewDelta?.heroId === h.id ? previewDelta.values.hp || 0 : 0);
    const bonusMp = (alloc.mp || 0) + (previewDelta?.heroId === h.id ? previewDelta.values.mp || 0 : 0);
    st.hp += bonusHp * 8;
    st.mp += bonusMp * 4;
    return st;
  };
  const previousMaxSP = maxSP;
  maxSP = function(h) {
    const base = previousMaxSP(h);
    const e = state(), alloc = e.alloc[h.id] || {};
    const bonusSp = (alloc.sp || 0) + (previewDelta?.heroId === h.id ? previewDelta.values.sp || 0 : 0);
    return base + bonusSp * 2;
  };
  const previousAttributes = attributes;
  attributes = function(h) {
    const a = previousAttributes(h), offsets = initialize(h).birthAttributes;
    for (const k of KEYS) a[k] = Math.max(1, a[k] + offsets[k] + (previewDelta?.heroId === h.id ? previewDelta.values[k] || 0 : 0));
    return a;
  };
  const previousCanJob = canJob;
  canJob = function(h, id) {
    const j = DATA.jobs[id];
    if (!j || !restrictionAllowed(initialize(h), j, 'job')) return false;
    if (h.job === id) return true;
    if (j.catalog) return (h.rareJob === id || state().unlockedJobIds?.includes(id)) && (h.rareJob === id || h.lv >= (j.unlock || 1));
    return previousCanJob(h, id);
  };
  const previousCanEquip = canEquip;
  canEquip = function(h, g) { return restrictionAllowed(initialize(h), g, 'gear') && previousCanEquip(h, g); };
  const previousSkills = heroSkills;
  function catalogSkillDef(h, skillId) {
    return (DATA.jobs[h?.job]?.catalogCombatSkills || []).find(sk => sk.id === skillId) || DATA.skills[skillId];
  }
  heroSkills = function(h) {
    const baseList = previousSkills(h);
    const catList = DATA.jobs[h?.job]?.catalogCombatSkills || [];
    const merged = [...baseList, ...catList.filter(ck => !baseList.some(b => b.id === ck.id))];
    return merged.filter(sk => restrictionAllowed(initialize(h), sk, 'skill')).map(sk => ({ ...sk, desc: skillDescription(sk.desc) }));
  };
  uiSkillList = heroSkills;
  const previousCommandName = commandName;
  commandName = function(command, h, skillId = null, itemId = null) {
    if (command === 'skill') return catalogSkillDef(h, skillId || heroSkills(h)[0]?.id)?.name || '技';
    return previousCommandName(command, h, skillId, itemId);
  };
  const previousPlanCommand = planCommand;
  planCommand = function(command, target = null, skillId = null, itemId = null) {
    const h = s.battle ? alive().find(a => a.id === s.battle.actor) : null;
    const catSk = command === 'skill' && h && !DATA.skills[skillId] ? catalogSkillDef(h, skillId) : null;
    if (catSk) DATA.skills[skillId] = catSk;
    try { return previousPlanCommand(command, target, skillId, itemId); }
    finally { if (catSk) delete DATA.skills[skillId]; }
  };
  const previousCast = cast;
  cast = function(h, target, skillId) {
    const catSk = h && !DATA.skills[skillId] ? catalogSkillDef(h, skillId) : null;
    if (catSk) DATA.skills[skillId] = catSk;
    try { return previousCast(h, target, skillId); }
    finally { if (catSk) delete DATA.skills[skillId]; }
  };
  const previousExecuteTurn = executeTurn;
  executeTurn = function() {
    const injected = [];
    if (s.battle) {
      for (const h of alive()) {
        const sid = s.battle.plans[h.id]?.skill;
        const catSk = sid && !DATA.skills[sid] ? catalogSkillDef(h, sid) : null;
        if (catSk) { DATA.skills[sid] = catSk; injected.push(sid); }
      }
    }
    try { return previousExecuteTurn(); }
    finally { for (const sid of injected) delete DATA.skills[sid]; }
  };
  function skillDescription(desc) {
    return String(desc || '').split(/(?<=[。！？\n])/).filter(line => !/(条件技|転職条件|派生条件|前提職|必要職|職業条件|習得条件|解放条件)/.test(line)).join('').trim();
  }
  // The same filtered list is checked by planCommand, cast, and guard execution in the engine.

  function freePoints(h) {
    const e = state(), spent = Object.values(e.alloc[h.id] || {}).reduce((a, n) => a + n, 0);
    return Math.max(0, (h.lv - 1) * 2 + (e.freePts[h.id] || 0) - spent);
  }
  function draftFor(h) {
    if (!growthDraft || growthDraft.owner !== s || growthDraft.heroId !== h.id) growthDraft = { owner: s, heroId: h.id, values: Object.fromEntries(ALL_GROWTH_KEYS.map(k => [k, 0])) };
    return growthDraft;
  }
  function draftTotal(h) { return growthDraft?.owner === s && growthDraft.heroId === h.id ? Object.values(growthDraft.values).reduce((a, n) => a + n, 0) : 0; }
  function previewGrowth(h, values = growthDraft?.owner === s && growthDraft.heroId === h.id ? growthDraft.values : {}) {
    const before = { attributes: attributes(h), stats: { ...stats(h), sp: maxSP(h) } };
    const old = previewDelta;
    try {
      previewDelta = { heroId: h.id, values };
      return { before, after: { attributes: attributes(h), stats: { ...stats(h), sp: maxSP(h) } } };
    } finally { previewDelta = old; }
  }
  function cancelGrowth() { growthDraft = null; }
  function confirmGrowth(id) {
    const h = s.roster.find(a => a.id === id);
    if (!h || s.battle || !growthDraft || growthDraft.owner !== s || growthDraft.heroId !== id) return false;
    const delta = growthDraft.values, total = draftTotal(h);
    if (!total || total > freePoints(h) || ALL_GROWTH_KEYS.some(k => !Number.isInteger(delta[k]) || delta[k] < 0)) return false;
    const e = state(); e.alloc[id] ??= {};
    for (const k of ALL_GROWTH_KEYS) e.alloc[id][k] = (e.alloc[id][k] || 0) + delta[k];
    growthDraft = null;
    tell(h.name + 'の成長を確定した。');
    render();
    return true;
  }
  globalThis.previewCharacterGrowth = previewGrowth;
  globalThis.confirmCharacterGrowth = confirmGrowth;
  globalThis.cancelCharacterGrowth = cancelGrowth;
  globalThis.adjustCharacterGrowth = function(id, key, amount) {
    const h = s.roster.find(a => a.id === id);
    if (!h || s.battle || !ALL_GROWTH_KEYS.includes(key) || ![1, -1].includes(amount)) return false;
    const d = draftFor(h);
    if (amount < 0 && !d.values[key] || amount > 0 && draftTotal(h) >= freePoints(h)) return false;
    d.values[key] += amount;
    refreshDetail();
    return true;
  };
  function changeValue(before, after) {
    return before === after ? String(before) : `<span>${before}</span> <strong class="stat-change">→ ${after} <small>(+${after - before})</small></strong>`;
  }
  function statusLabel(h) { return h.hp <= 0 ? '死亡' : h.mp <= 0 ? '気絶' : h.sp === 0 ? '疲弊' : h.poison ? '毒' : '正常'; }

  const JOB_TRAITS = {
    warrior: { name: '剛腕武勇', tag: '前衛物理', desc: '高い物理攻撃力と頑丈さ。重い武器や防具の扱いに長ける。' },
    knight: { name: '鉄壁守護', tag: '防衛・庇い', desc: '前衛の防御要請に応え、高い防御力で仲間を庇い被害を軽減する。' },
    mage: { name: '元素魔導', tag: '属性攻撃', desc: '炎・氷などの攻撃魔法を駆使し、敵の属性弱点を突いて大打撃を与える。' },
    priest: { name: '神聖加護', tag: '治癒・浄化', desc: '傷ついた仲間を回復し、毒を浄化する神聖術を操る。' },
    scout: { name: '罠感知・解除', tag: '隠密・観測', desc: '迷宮の仕掛け罠を事前に感知・解除。敵のLIFEや脅威度Lvを観測する。' },
    ranger: { name: '魔物観測', tag: '遠隔射撃', desc: '敵のLIFEや弱点を観測し、遠距離から安全に射撃を行う。' },
    alchemist: { name: '工房錬成', tag: '制作・調合', desc: '街の工房で自ら武具を自作・修理し、薬草や未活用素材の調合を行える。' },
    tactician: { name: '戦術指揮', tag: '自動戦闘支援', desc: '同行中、行動書購入前でも自動戦闘で負傷者回復・解毒・弱点狙いを指揮。敵LIFE/Lvを観測。' },
    explorer: { name: '探索指導', tag: '自動歩行・帰還', desc: '同行中、連続自動探索が可能。非戦闘時にSP3で即時帰還。敵観測や地形踏破を支援し行軍SPを軽減。' },
    monk: { name: '気功連撃', tag: '格闘・自己治癒', desc: '拳による連撃と練気による自己治癒。' },
    bard: { name: '戦歌鼓舞', tag: '全体強化', desc: '戦歌によって仲間全員の攻撃力を高め、士気を鼓舞する。' },
    druid: { name: '自然調和', tag: '全体治癒・毒', desc: '大自然の力で仲間全員を癒やし、毒胞子で敵を蝕む。' },
    elementalist: { name: '精霊招来', tag: '広域魔法', desc: '雷撃や吹雪など、敵全体に甚大な魔力ダメージを与える。' },
    paladin: { name: '聖天守護', tag: '攻防一体', desc: '光の打撃と単体治癒、聖壁による強固な護りを併せ持つ。' },
    warlock: { name: '暗黒呪術', tag: '呪詛・吸命', desc: '敵の生命力を吸い取って自らの傷を癒やす深淵の呪術。' },
    lancer: { name: '突撃貫通', tag: '装甲破砕', desc: '重装甲の敵をも貫く強烈な槍の一撃。' },
    swordsman: { name: '連環剣技', tag: '連撃・受け流し', desc: '流れるような連続剣技で敵を斬り伏せる。' },
    pyromancer: { name: '劫火極意', tag: '超炎熱', desc: '炎属性の破壊力を極限まで高めた火炎術。' },
    cryomancer: { name: '凍気封縛', tag: '氷結・装甲脆化', desc: '敵を凍てつかせて動きを封じ、装甲を砕く。' },
    stormcaller: { name: '天雷召喚', tag: '高速掃討', desc: '目にも留まらぬ速さで雷雲を呼び、敵を薙ぎ払う。' },
    duelist: { name: '決闘見切', tag: '急所突き', desc: '敵の太刀筋を見切り、反撃と急所への刺突を繰り出す。' },
    beastmaster: { name: '獣群指揮', tag: '群勢・野生', desc: '野性の勘で危険を察知し、群れの号令で総攻撃を仕掛ける。' },
    herbalist: { name: '野草調剤', tag: '薬草治癒', desc: '採取した薬草の知識で仲間を癒やし、工房での調合を行う。' },
    exorcist: { name: '破邪退散', tag: '対霊特効', desc: 'アンデッドや霊体の魔物を光で払い、全体を清める。' },
    shadowdancer: { name: '幻惑影歩', tag: '影奇襲', desc: '影に身を潜めて敵を翻弄し、致命的な一撃を刺す。' },
    runesmith: { name: '刻印鍛冶', tag: 'ルーン防壁', desc: '古代の刻印を操り、工房自作や属性防壁を展開する。' },
    fortress: { name: '要塞城壁', tag: '絶対防壁', desc: '動かぬ要塞のごとき重装甲で敵の猛攻を一身に受け止める。' },
    jester: { name: '道化翻弄', tag: '奇策・歓喜', desc: 'おどけた動きで敵の意表を突き、仲間の笑いを力に変える。' },
    whipmaster: { name: '操鞭拘束', tag: '絡め捕り', desc: '自在にしなる鞭で敵全体を拘束し、行動を妨害する。' },
    queen: { name: '絶対服従', tag: '強権号令', desc: '絶対の号令で味方の力を引き出し、敵を屈服させる。' },
    merchant: { name: '交易交渉', tag: '売買優遇', desc: '商才により道具屋での仕入れ値を割引(-6%)し、売却額を上乗せ(+12%)する。' },
    samurai: { name: '居合一閃', tag: '精神集中', desc: '精神を研ぎ澄まし、一撃必殺の刃を抜く。' },
    ninja: { name: '忍法空蝉', tag: '身代わり', desc: '神速の身のこなしと空蝉の術で攻撃を回避する。' }
  };

  function jobTraitInfo(jobId) {
    if (JOB_TRAITS[jobId]) return JOB_TRAITS[jobId];
    const catJ = DATA.catalog?.jobs?.[jobId];
    if (catJ) {
      return {
        name: `${catJ.family || '職能'}の心得`,
        tag: catJ.role || '専門職',
        desc: `【${catJ.family}系】${catJ.desc || '専門的な技能と知見によりパーティーの活動を支える。'}`
      };
    }
    const j = DATA.jobs[jobId];
    return { name: '専門技術', tag: j?.name || '職業', desc: j?.skillDesc || '鍛錬された技と能力で戦いを支える。' };
  }
  globalThis.jobTraitInfo = jobTraitInfo;

  partyScreen = function() {
    return title('COMPANIONS', '仲間と隊列', 'ステータスを押すと、能力・装備・成長・体得した技を確認できます。') +
      `${partyPresetsHTML()}
      <div class="grid three section-space">${s.roster.map(h => {
        initialize(h); const j = DATA.jobs[h.job], active = s.active.includes(h.id), st = stats(h);
        return `<article class="card party-status ${active ? '' : 'waiting'}"><button class="party-status-open" data-action="character" data-id="${h.id}" aria-label="${esc(h.name)}のステータスを開く"><span class="row between"><b>${esc(h.name)}</b><span class="gold">Lv.${h.lv}</span></span><span>${esc(j.name)} · ${GENDERS[h.gender]} · ${h.row === 'front' ? '前衛' : '後衛'} <span class="chip" style="font-size:9px;padding:1px 5px">${esc(jobTraitInfo(h.job).name)}</span></span><span>LIFE ${h.hp}/${st.hp} · MANA ${h.mp}/${st.mp} · SP ${h.sp}/${maxSP(h)}</span><span>攻 ${st.atk} · 防 ${st.def} · 魔 ${st.mag} · 速 ${st.speed}</span><span class="muted">${active ? '探索参加中' : '街で待機'} · ${statusLabel(h)}${freePoints(h) ? ' · 成長 ' + freePoints(h) + ' Pt' : ''}　詳細 ↗</span></button><div class="actions">${btn(active ? '街で待機' : '探索に参加', 'member', `data-id="${h.id}" ${s.dungeon || s.battle || active && s.active.length === 1 ? 'disabled' : ''}`)}${btn(h.row === 'front' ? '後衛へ' : '前衛へ', 'row', `data-id="${h.id}" ${s.dungeon || s.battle ? 'disabled' : ''}`)}</div></article>`;
      }).join('')}</div>`;
  };

  function gearPotentialValue(h, g) {
    if (!g || !g.dur) return 0;
    const prev = h[g.slot];
    try {
      h[g.slot] = g.id;
      return gearValue(g);
    } finally {
      h[g.slot] = prev;
    }
  }
  function equipmentSection(h) {
    if (globalThis.BRPGEquipment) return inventoryEquipmentSection(h);
    const readOnly = !!(s.dungeon || s.battle);
    return ['weapon', 'armor'].map(slot => {
      const current = item(h[slot]), label = slot === 'weapon' ? '武器' : '防具', statName = slot === 'weapon' ? '攻' : '防';
      const curVal = current ? gearPotentialValue(h, current) : 0;
      const list = s.gear.filter(g => g.slot === slot).map(g => {
        const owner = s.roster.find(a => a[g.slot] === g.id), permitted = canEquip(h, g);
        const val = permitted ? gearPotentialValue(h, g) : gearValue(g);
        const group = h[slot] === g.id ? 0 : permitted && !owner ? 1 : permitted ? 2 : 3;
        return { g, owner, permitted, val, delta: val - curVal, group };
      }).sort((a, b) => a.group - b.group || b.val - a.val || b.g.id - a.g.id);
      const formatOpt = ({ g, owner, permitted, val, delta }) => {
        const diff = h[slot] === g.id ? '装備中' : `${ delta >= 0 ? '+' : '' }${delta}`;
        return `<option value="${g.id}" ${h[slot] === g.id ? 'selected' : ''} ${permitted ? '' : 'disabled'}>${esc(gearName(g))}（${statName}+${val} / ${diff}${owner && owner.id !== h.id ? ' · ' + esc(owner.name) + 'が使用中' : ''}${!permitted ? ' · ' + esc(gearRequirementText(g)) : ''}）</option>`;
      };
      const groups = [
        [0, '現在装備中'],
        [1, '装備可能（未装備・性能順）'],
        [2, '装備可能（他の仲間が使用中）'],
        [3, '装備条件未達']
      ].map(([gid, title]) => {
        const items = list.filter(x => x.group === gid);
        return items.length ? `<optgroup label="${title} (${items.length})">${items.map(formatOpt).join('')}</optgroup>` : '';
      }).join('');
      return `<div class="detail-gear"><h4>${label} <small class="muted">所持 ${list.length}個 / 装備可能 ${list.filter(x => x.permitted).length}個</small></h4><p>${esc(current ? gearName(current) : '装備なし')}${current ? ` <span class="gold">（${statName}+${curVal}${current.enchant ? ` · 付呪+${enchantPower(current)}` : ''}）</span>` : ''}</p>${current ? `<small>耐久 ${current.dur}/${current.maxDur}${canEquip(h, current) ? '' : ' · 装備条件を満たしていません'}</small>` : ''}<label class="field">${label}を変更<select data-character-change="equip" data-hero="${h.id}" data-slot="${slot}" aria-label="${label}を変更" ${readOnly ? 'disabled' : ''}><option value="">装備を外す</option>${groups}</select></label></div>`;
    }).join('') + (readOnly ? '<p class="muted">装備の変更は街で行えます。</p>' : '');
  }
  let equipmentReachFilter = 'all';
  function reachOfGear(g) {
    if (!g || g.slot !== 'weapon') return null;
    return ['bow', 'staff'].includes(g.type) ? 'long' : ['spear', 'whip'].includes(g.type) ? 'medium' : (g.range || 'near');
  }
  const equipmentViews = new Map();
  let equipmentState = null;
  function equipmentView(h) {
    if (equipmentState !== s) { equipmentViews.clear(); equipmentState = s; }
    if (!equipmentViews.has(h.id)) equipmentViews.set(h.id, { slot: 'weapon', sources: { personal: true, storage: true, companions: false, equipped: false } });
    return equipmentViews.get(h.id);
  }
  function equipmentModalContent(h, slot) {
    const eq = BRPGEquipment, locked = !!(s.dungeon || s.battle);
    const current = item(h[slot]);
    const durability = current ? eq.durability(current) : null;
    const occupied = slot === 'shield' && item(h.weapon)?.hands === 2;
    const bag = eq.inventory(h), stored = s.gear.filter(g => g.ownerId === null);
    const matching = g => {
      if (eq.slotOf(g) !== (slot.startsWith('acc') ? 'accessory' : slot)) return false;
      if (slot === 'weapon' && equipmentReachFilter !== 'all') {
        const reach = reachOfGear(g);
        if (reach !== equipmentReachFilter) return false;
      }
      return true;
    };
    const candidates = bag.filter(matching);
    const storedCandidates = stored.filter(matching);

    let filterBar = '';
    if (slot === 'weapon') {
      const filters = [
        { id: 'all', label: 'すべて' },
        { id: 'near', label: '近距離' },
        { id: 'medium', label: '中距離' },
        { id: 'long', label: '遠距離' }
      ];
      filterBar = `<div class="equipment-reach-filter" style="margin: 0.5rem 0; display: flex; gap: 0.5rem; align-items: center;"><span class="muted" style="font-size: 0.85rem;">射程絞込:</span><div class="button-group">${filters.map(f => `<button type="button" class="btn ${equipmentReachFilter === f.id ? 'active primary' : 'ghost'}" data-action="equipment-reach-filter" data-reach="${f.id}" style="padding: 0.2rem 0.6rem; font-size: 0.8rem;">${f.label}</button>`).join('')}</div></div>`;
    }

    const card = (g, storage = false) => {
      const owner = eq.equippedOwner(g), suit = eq.suitability(h, g), permitted = canEquip(h, g), own = owner?.id === h.id;
      const destination = s.roster.filter(a => a.id !== h.id && a.id !== g.ownerId);
      const durability = eq.durability(g);
      return `<article class="inventory-card ${own ? 'is-equipped' : ''} rarity-${g.rarity || 'common'}"><div class="row between"><h4>${esc(gearName(g))}</h4><small>${esc(eq.types[g.type]?.name || g.type)}${g.hands === 2 ? ' · 両手' : ''}</small></div><p>${g.slot === 'weapon' ? '攻撃' : '防御'} +${eq.valueFor(h, g)} · <span class="durability ${durability.level}">${durability.icon} ${durability.percent}%</span></p>${owner ? `<span class="equipped-badge" title="${esc(owner.name)}が装備中">✓ ${esc(owner.name)}が装備中</span>` : ''}<small class="${suit.suitable ? 'muted' : 'equipment-unsuitable'}">${esc(suit.text)}</small><small>${esc(gearRequirementText(g))}${!permitted ? ' · 能力条件未達' : ''}</small><div class="actions">${btn(own ? '✓ 装備中' : 'これを装備', 'character-equip', `data-id="${h.id}" data-gear="${g.id}" data-slot="${slot}" ${locked || own || !permitted || storage && !eq.canReceive(h) ? 'disabled' : ''}`, own ? '' : 'primary')}${storage ? btn('所持品へ取り出す', 'character-transfer', `data-id="${h.id}" data-gear="${g.id}" ${locked || !eq.canReceive(h) ? 'disabled' : ''}`) : btn('倉庫へ預ける', 'character-transfer', `data-id="storage" data-gear="${g.id}" ${locked || own ? 'disabled' : ''}`)}</div>${!storage && destination.length ? `<details class="inventory-transfer"><summary>仲間へ渡す</summary><div class="actions">${destination.map(a => btn(esc(a.name) + ' (' + eq.usage(a) + '/' + eq.capacity(a) + ')', 'character-transfer', `data-id="${a.id}" data-gear="${g.id}" ${locked || !eq.canReceive(a) ? 'disabled' : ''}`)).join('')}</div></details>` : ''}</article>`;
    };

    return `<div class="equipment-modal-current"><div class="row between"><div><span class="eyebrow">${esc(eq.labels[slot])} 部位</span><h4>現在の装備: ${esc(current ? gearName(current) : occupied ? '両手武器が使用中' : '装備なし')}</h4></div>${current ? btn('この部位を外す', 'character-unequip', `data-id="${h.id}" data-slot="${slot}" ${locked ? 'disabled' : ''}`) : ''}</div>${filterBar}${current ? `<p>${current.slot === 'weapon' ? '攻撃' : '防御'} +${eq.valueFor(h, current)} · <span class="durability ${durability.level}">${durability.icon} 耐久 ${durability.percent}%</span></p>` : ''}</div><div class="section-space"><h4>所持品の候補 (${candidates.length})</h4><div class="inventory-grid">${candidates.map(g => card(g)).join('') || '<p class="muted">この部位の所持品はありません。</p>'}</div></div>${storedCandidates.length ? `<div class="section-space"><h4>街の倉庫の候補 (${storedCandidates.length})</h4><div class="inventory-grid">${storedCandidates.map(g => card(g, true)).join('')}</div></div>` : ''}`;
  }
  function openEquipmentDialog(h, slot) {
    equipmentReachFilter = 'all';
    let dialog = $('equipment-dialog');
    if (!dialog && typeof document !== 'undefined') {
      dialog = document.createElement('dialog');
      dialog.id = 'equipment-dialog';
      dialog.className = 'equipment-dialog';
      const charDialog = $('character-dialog');
      if (charDialog?.parentNode) charDialog.parentNode.insertBefore(dialog, charDialog);
      else document.body.appendChild(dialog);
    }
    if (!dialog) return;
    const eq = BRPGEquipment;
    dialog.innerHTML = `<button id="equipment-dialog-close" class="dialog-close" data-action="equipment-dialog-close" aria-label="閉じる">閉じる ✕</button><div class="equipment-modal-header"><h3>${esc(h.name)} · ${esc(eq.labels[slot])}の装備変更</h3></div><div id="equipment-dialog-body">${equipmentModalContent(h, slot)}</div>`;
    if (!dialog.open && typeof dialog.showModal === 'function') dialog.showModal();
  }
  function closeEquipmentDialog() {
    const dialog = $('equipment-dialog');
    if (dialog) {
      if (dialog.open && typeof dialog.close === 'function') dialog.close();
      dialog.innerHTML = '';
    }
  }
  function refreshEquipmentDialog() {
    const dialog = $('equipment-dialog');
    if (dialog?.open) {
      const h = s.roster.find(a => a.id === s.selection);
      if (h) {
        const slot = equipmentView(h).slot;
        const bodyEl = $('equipment-dialog-body');
        if (bodyEl) bodyEl.innerHTML = equipmentModalContent(h, slot);
      }
    }
  }
  function inventoryEquipmentSection(h) {
    const eq = BRPGEquipment, locked = !!(s.dungeon || s.battle);
    eq.normalizeState();
    const slots = eq.slots.filter(k => k !== 'acc2' || eq.accessorySlots(h) > 1);
    const view = equipmentView(h), selectedSlot = slots.includes(view.slot) ? view.slot : slots[0];
    const slotControls = slots.map(slot => {
      const g = item(h[slot]), occupied = slot === 'shield' && item(h.weapon)?.hands === 2;
      const durability = g ? eq.durability(g) : null;
      return `<button type="button" class="equipment-slot equipment-slot-${slot} ${g ? 'filled' : ''} ${selectedSlot === slot ? 'selected' : ''}" data-action="character-slot" data-id="${h.id}" data-slot="${slot}" aria-pressed="${selectedSlot === slot}" title="クリックして${esc(eq.labels[slot])}の装備変更画面を開く"><span class="equipment-slot-caption"><small>${eq.labels[slot]}</small>${g ? '<b class="equipped-mark" title="装備中">✓ 装備中</b>' : ''}</span><b class="equipment-slot-name" title="${esc(g ? gearName(g) : occupied ? '両手武器が使用中' : '未装備')}">${esc(g ? gearName(g) : occupied ? '両手武器が使用中' : '未装備')}</b>${g ? `<span class="durability ${durability.level}" title="耐久 ${durability.percent}%">${durability.icon} 耐久 ${durability.percent}%</span><span>${g.slot === 'weapon' ? '攻' : '防'} +${eq.valueFor(h, g)}</span>` : ''}<span class="equipment-slot-action-hint">変更 ▾</span></button>`;
    }).join('');
    const card = (g, storage = false) => {
      const owner = eq.equippedOwner(g), suit = eq.suitability(h, g), permitted = canEquip(h, g), own = owner?.id === h.id;
      const destination = s.roster.filter(a => a.id !== h.id && a.id !== g.ownerId);
      const durability = eq.durability(g);
      return `<article class="inventory-card ${own ? 'is-equipped' : ''} rarity-${g.rarity || 'common'}"><div class="row between"><h4>${esc(gearName(g))}</h4><small>${esc(eq.types[g.type].name)}${g.hands === 2 ? ' · 両手' : ''}</small></div><p>${g.slot === 'weapon' ? '攻撃' : '防御'} +${eq.valueFor(h, g)} · <span class="durability ${durability.level}">${durability.icon} ${durability.percent}%</span></p>${owner ? `<span class="equipped-badge" title="${esc(owner.name)}が装備中">✓ ${esc(owner.name)}が装備中</span>` : ''}<small class="${suit.suitable ? 'muted' : 'equipment-unsuitable'}">${esc(suit.text)}</small><small>${esc(gearRequirementText(g))}${!permitted ? ' · 能力条件未達' : ''}</small><div class="actions">${btn(own ? '✓ 装備中' : 'これを装備', 'character-equip', `data-id="${h.id}" data-gear="${g.id}" data-slot="${selectedSlot}" ${locked || own || !permitted || storage && !eq.canReceive(h) ? 'disabled' : ''}`, own ? '' : 'primary')}${storage ? btn('所持品へ取り出す', 'character-transfer', `data-id="${h.id}" data-gear="${g.id}" ${locked || !eq.canReceive(h) ? 'disabled' : ''}`) : btn('倉庫へ預ける', 'character-transfer', `data-id="storage" data-gear="${g.id}" ${locked || own ? 'disabled' : ''}`)}</div>${!storage && destination.length ? `<details class="inventory-transfer"><summary>仲間へ渡す</summary><div class="actions">${destination.map(a => btn(esc(a.name) + ' (' + eq.usage(a) + '/' + eq.capacity(a) + ')', 'character-transfer', `data-id="${a.id}" data-gear="${g.id}" ${locked || !eq.canReceive(a) ? 'disabled' : ''}`)).join('')}</div></details>` : ''}</article>`;
    };
    const bag = eq.inventory(h), stored = s.gear.filter(g => g.ownerId === null);
    const sourceControls = [['personal', '自分の所持品'], ['storage', '倉庫品'], ['companions', '仲間の所持品'], ['equipped', '仲間の装備品']].map(([key, label]) => btn((view.sources[key] ? '☑ ' : '☐ ') + label, 'character-auto-source', `data-id="${h.id}" data-source="${key}" aria-pressed="${!!view.sources[key]}" ${locked ? 'disabled' : ''}`, view.sources[key] ? 'selected' : '')).join('');
    const autoPanel = `<section class="slot-candidates"><h4>お任せ装備</h4><p class="muted">候補の出所を選び、攻撃・防御の合計が高くなるよう装備します。現在の装備は常に候補です。仲間の装備品を選ぶと、その仲間から装備を外して移動します。</p><div class="actions">${sourceControls}</div>${btn('選んだ範囲からお任せ装備', 'character-auto-equip', `data-id="${h.id}" ${locked ? 'disabled' : ''}`, 'primary')}</section>`;
    const equippedIds = new Set(s.roster.flatMap(a => eq.slots.map(k => a[k]).filter(Boolean)));
    const movable = bag.filter(g => !equippedIds.has(g.id)).length;
    return `${autoPanel}<div class="equipment-paperdoll" aria-label="装備部位">${slotControls}</div><div class="row between section-space"><h4>${esc(h.name)}の所持品</h4><strong class="${bag.length > eq.capacity(h) ? 'equipment-unsuitable' : 'gold'}">${bag.length} / ${eq.capacity(h)} 枠</strong></div><p class="muted">装備中の品も1枠使用します。部位を選ぶと専用モーダルで候補の比較・変更ができます。装備適性がなくても装着でき、基礎性能が半減し、付呪・称号・能力補正は働きません。${bag.length > eq.capacity(h) ? '転職前の所持品は保持します。枠を空けるまで追加できません。' : ''}</p>${movable ? btn(`装備していない所持品を倉庫へまとめて移動（${movable}点）`, 'character-store-bulk', `data-id="${h.id}" ${locked ? 'disabled' : ''}`) : ''}<div class="inventory-grid">${bag.map(g => card(g)).join('') || '<p class="muted">所持品はありません。</p>'}</div><details class="equipment-storage section-space"><summary>街の倉庫 · ${stored.length}点</summary><p class="muted">倉庫の品は街で取り出せます。</p><div class="inventory-grid">${stored.map(g => card(g, true)).join('') || '<p class="muted">保管品はありません。</p>'}</div>${locked ? '<p class="muted">装備変更・所持品の受渡し・倉庫利用は街で行えます。</p>' : ''}`;
  }
  function growthSection(h, comparison) {
    const d = draftFor(h), total = draftTotal(h), remaining = freePoints(h) - total;
    return `<div class="row between"><h3>成長</h3><span class="gold">残り ${remaining} Pt${total ? ' · 仮配分 ' + total + ' Pt' : ''}</span></div><div class="growth-grid">${KEYS.map(k => `<div class="growth-control"><div><b>${k}</b><small>${ATTRIBUTE_NAMES[k]}</small></div><span>${changeValue(comparison.before.attributes[k], comparison.after.attributes[k])}</span><div class="actions">${btn('−', 'character-growth', `data-id="${h.id}" data-stat="${k}" data-step="-1" aria-label="${ATTRIBUTE_NAMES[k]}の仮配分を減らす" ${!d.values[k] || s.battle ? 'disabled' : ''}`)}${btn('＋', 'character-growth', `data-id="${h.id}" data-stat="${k}" data-step="1" aria-label="${ATTRIBUTE_NAMES[k]}の仮配分を増やす" ${remaining <= 0 || s.battle ? 'disabled' : ''}`)}</div></div>`).join('')}</div><p class="muted">＋／−で仮配分し、確定するとポイントを使います。取り消しや画面を閉じる操作では消費しません。</p><div class="actions">${btn('この配分で確定', 'character-growth-confirm', `data-id="${h.id}" ${!total || s.battle ? 'disabled' : ''}`, 'primary')}${btn('仮配分を取り消す', 'character-growth-cancel', total ? '' : 'disabled')}</div>${s.battle ? '<p class="muted">戦闘中は成長を確定できません。</p>' : ''}`;
  }
  function orderedRoster() {
    const activeFront = party().filter(h => h.row === 'front');
    const activeBack = party().filter(h => h.row === 'back');
    const bench = (s.roster || []).filter(h => !s.active.includes(h.id));
    return [...activeFront, ...activeBack, ...bench];
  }
  characterScreen = function(h) {
    initialize(h); const j = DATA.jobs[h.job], comparison = previewGrowth(h), learned = uiSkillList(h).filter(sk => sk.level <= h.lv), index = s.roster.indexOf(h);
    const catSkills = (j.catalogSkills || []).map(sid => DATA.catalog?.skills?.[sid]).filter(Boolean);
    const rosterOrder = orderedRoster();
    const orderIdx = rosterOrder.findIndex(a => a.id === h.id);
    const positionLabel = h.row === 'front' && s.active.includes(h.id)
      ? ('前衛 ' + (party().filter(a => a.row === 'front').findIndex(a => a.id === h.id) + 1))
      : h.row === 'back' && s.active.includes(h.id)
      ? ('後衛 ' + (party().filter(a => a.row === 'back').findIndex(a => a.id === h.id) + 1))
      : '待機';
    const prevHero = rosterOrder.length > 1 ? rosterOrder[(orderIdx - 1 + rosterOrder.length) % rosterOrder.length] : null;
    const nextHero = rosterOrder.length > 1 ? rosterOrder[(orderIdx + 1) % rosterOrder.length] : null;
    const sideNav = rosterOrder.length > 1 ? ('<button type="button" class="character-nav-side prev" data-action="character-prev" data-id="' + h.id + '" aria-label="前の仲間" title="前の仲間：' + esc(prevHero.name) + '">◀</button><button type="button" class="character-nav-side next" data-action="character-next" data-id="' + h.id + '" aria-label="次の仲間" title="次の仲間：' + esc(nextHero.name) + '">▶</button>') : '';
    const catSection = catSkills.length ? `<div class="detail-section"><h4>職能専門技能（主職『${esc(j.name)}』）</h4>${catSkills.map(ck => {
      const unlocked = h.lv >= ck.minLv;
      const behNames = (ck.behaviors || []).map(bid => DATA.catalog?.behaviors?.[bid]?.name || bid).join('・');
      return `<article class="skill-line ${unlocked ? '' : 'locked'}"><div class="row between"><b>${esc(ck.name)} <span class="chip">${esc(ck.kind)}</span></b><small>${unlocked ? '体得済み' : '要 Lv.' + ck.minLv}${behNames ? ' · 行動：' + esc(behNames) : ''}</small></div><p>${esc(ck.effect)}${ck.limit ? ` <small class="muted">（${esc(ck.limit)}）</small>` : ''}</p></article>`;
    }).join('')}</div>` : '';
    return `${sideNav}<div class="character-pager"><span class="character-pager-tag">${positionLabel} · ${orderIdx + 1} / ${rosterOrder.length}</span></div><div class="hero-top"><div class="avatar">${typeof jobCrestSVG === 'function' ? jobCrestSVG(h.job) : j.icon}</div><div><p class="eyebrow">CHARACTER RECORD</p><h2>${esc(h.name)} <span class="gold">Lv.${h.lv}</span></h2><small>${esc(j.name)} / ${GENDERS[h.gender]} / ${h.row === 'front' ? '前衛' : '後衛'} / ${s.active.includes(h.id) ? '探索参加中' : '街で待機'}</small></div></div><div class="quest-box" style="margin:-4px 0 16px;border-left:3px solid var(--gold)"><div class="row between"><b>【ジョブ特性】${esc(jobTraitInfo(h.job).name)}</b><span class="chip">${esc(jobTraitInfo(h.job).tag)}</span></div><p class="muted" style="margin:4px 0 0">${esc(jobTraitInfo(h.job).desc)}</p></div><div class="character-grid"><section class="character-section"><h3>状態</h3>${bars(h)}<p>${statusLabel(h)} · 経験値 ${h.xp} / ${xpNeeded(h)}</p><dl class="stat-grid">${Object.entries(DERIVED).map(([k, name]) => `<div><dt>${name}</dt><dd>${changeValue(comparison.before.stats[k], comparison.after.stats[k])}</dd></div>`).join('')}</dl></section><section class="character-section">${growthSection(h, comparison)}</section><section class="character-section character-equipment"><h3>装備</h3>${equipmentSection(h)}</section><section class="character-section"><h3>体得した技 <small>${learned.length}種</small></h3><div class="learned-skills">${learned.map(sk => `<article class="skill-line"><div class="row between"><b>${esc(sk.name)}</b><small>MANA ${sk.mp} / SP ${sk.sp || 0}</small></div><p>${esc(skillDescription(sk.desc) || '鍛錬によって体得した技。')}</p></article>`).join('') || '<p class="muted">まだ体得した戦闘技はありません。</p>'}${catSection}</div></section></div>${s.battle && h.hp > 0 && s.active.includes(h.id) ? btn('この仲間に指示する', 'actor-close', `data-id="${h.id}"`, 'primary wide') : ''}`;
  };
  function refreshDetail() {
    const dialog = $('character-dialog'), h = s.roster.find(a => a.id === s.selection);
    if (dialog?.open && h) $('character-body').innerHTML = characterScreen(h);
  }
  openCharacter = function(id) {
    closeEquipmentDialog();
    const h = s.roster.find(a => a.id === id); if (!h) return;
    if (s.selection !== id) cancelGrowth();
    stopAll(); s.selection = id;
    if (s.battle && h.hp > 0 && s.active.includes(id)) s.battle.actor = id;
    $('character-body').innerHTML = characterScreen(h);
    if (!$('character-dialog').open) $('character-dialog').showModal();
    render();
  };

  function tavernOnly() {
    if (s.view !== 'tavern' || s.dungeon || s.battle) { tell('仲間の登録と転職は街の酒場で行えます。'); return false; }
    return true;
  }
  changeJob = function(id, job) {
    if (!tavernOnly()) return false;
    const h = s.roster.find(a => a.id === id), j = DATA.jobs[job];
    if (!h || !j || h.job === job || !canJob(h, job)) return false;
    cancelGrowth(); syncHero(h);
    const old = stats(h), hpRatio = h.hp / old.hp, mpRatio = h.mp / old.mp, spRatio = h.sp / maxSP(h);
    h.job = job; syncHero(h);
    const st = stats(h);
    h.hp = Math.min(st.hp, Math.floor(st.hp * hpRatio));
    h.mp = Math.min(st.mp, Math.floor(st.mp * mpRatio));
    h.sp = Math.min(maxSP(h), Math.floor(maxSP(h) * spRatio));
    state().discoveredMainJobs ??= [];
    if (!state().discoveredMainJobs.includes(job)) state().discoveredMainJobs.push(job);
    tell(h.name + 'は' + j.name + 'に転職した。'); render(); return true;
  };
  function rollCandidate() {
    return { name: randomRecruitName(), gender: 'male', job: 'warrior', birthAttributes: Object.fromEntries(KEYS.map(k => [k, Math.floor(random() * 5) - 2])) };
  }
  const RECRUIT_NAMES = ['アレン', 'イリス', 'エルナ', 'オルド', 'カイ', 'キリカ', 'クルト', 'シオン', 'セラ', 'トーマ', 'ナギ', 'ニーナ', 'ノエル', 'ハル', 'フィン', 'ミラ', 'ユナ', 'リオン', 'ルカ', 'レナ'];
  function randomRecruitName() { return RECRUIT_NAMES[Math.floor(random() * RECRUIT_NAMES.length)]; }
  function candidate() {
    const e = state(), townId = currentTown().id;
    let saved = e.tavernCandidates[townId];
    if (!saved || typeof saved !== 'object' || !saved.birthAttributes || typeof saved.birthAttributes !== 'object' || KEYS.some(k => !Number.isInteger(saved.birthAttributes[k]) || Math.abs(saved.birthAttributes[k]) > 2)) saved = e.tavernCandidates[townId] = rollCandidate();
    if (!recruitForm || recruitState !== s || recruitForm.townId !== townId) {
      recruitState = s; recruitForm = { townId, ...saved };
      if (!GENDERS[recruitForm.gender] || recruitForm.gender === 'unspecified') recruitForm.gender = 'male';
      if (typeof recruitForm.name !== 'string') recruitForm.name = randomRecruitName();
    }
    return recruitForm;
  }
  function baseJobs(h) { return Object.entries(DATA.jobs).filter(([, j]) => j.base && partyLevel() >= (j.unlock || 1) && restrictionAllowed(h, j, 'job')); }
  function rareCandidate() {
    const town = currentTown(), e = state(), seed = hash('tavern-rare:' + town.id + ':' + (town.seed || 0));
    // One fixed 1-in-4096 opportunity per generated town, independent of visits and reloads.
    if (town.id === 'ash' || seed % 4096 !== 0 || e.tavernRareHires[town.id]) return null;
    const rare = Object.entries(DATA.jobs).filter(([, j]) => j.catalog && !j.base);
    if (!rare.length) return null;
    const r = rng(seed), [job] = rare[Math.floor(r() * rare.length)];
    return { name: '流浪の' + DATA.jobs[job].name, gender: r() < .5 ? 'male' : 'female', job, rareJob: job, birthAttributes: Object.fromEntries(KEYS.map(k => [k, Math.floor(r() * 5) - 2])) };
  }
  recruit = function(job, options) {
    if (!tavernOnly()) return false;
    const c = options?.rare ? rareCandidate() : candidate(), def = DATA.jobs[job];
    if (!c || !def || c.job !== job || !restrictionAllowed(c, def, 'job') || !options?.rare && !baseJobs(c).some(([id]) => id === job)) return false;
    if (s.roster.length >= 16 || s.gold < recruitCost()) { tell(s.roster.length >= 16 ? '登録上限は16人です。' : '登録料が足りません。'); render(); return false; }
    const name = String(c.name || '').trim().slice(0, 24);
    if (!name) { tell('仲間の名前を入力してください。'); return false; }
    const h = makeHero(s.nextHero, name, job, s.active.length < 3 ? 'front' : 'back');
    h.gender = c.gender; h.birthAttributes = { ...c.birthAttributes };
    if (c.rareJob) h.rareJob = c.rareJob;
    syncHero(h); h.hp = stats(h).hp; h.mp = stats(h).mp; h.sp = maxSP(h);
    s.gold -= recruitCost(); s.nextHero++; s.roster.push(h);
    if (s.active.length < 6) s.active.push(h.id);
    if (options?.rare) state().tavernRareHires[currentTown().id] = true;
    else { delete state().tavernCandidates[currentTown().id]; recruitForm = null; }
    tell(h.name + 'を仲間に迎えた。'); render(); return true;
  };
  let jobConsultation = null;
  function jobConsultationState() {
    if (jobConsultation?.owner !== s) jobConsultation = { owner: s, heroId: null, job: null };
    return jobConsultation;
  }
  function jobComparisonValue(before, after) {
    const delta = after - before;
    return before === after ? String(before) : `${before} → <strong class="${delta < 0 ? 'equipment-unsuitable' : 'stat-change'}">${after} (${delta > 0 ? '+' : ''}${delta})</strong>`;
  }
  function previewJob(h, job) {
    if (!h || !DATA.jobs[job]) return null;
    const eq = globalThis.BRPGEquipment, index = s.roster.indexOf(h);
    if (index < 0) return null;
    const snapshot = hero => ({ attributes: attributes(hero), stats: { ...stats(hero), sp: maxSP(hero) }, capacity: eq?.capacity(hero), accessories: eq?.accessorySlots(hero) });
    const before = snapshot(h), probe = structuredClone(h);
    // Legacy combat helpers resolve equipment through the roster. Substitute only
    // while calculating, so a preview uses the proposed job without saving it.
    try {
      s.roster[index] = probe; probe.job = job; syncHero(probe);
      if (eq && eq.accessorySlots(probe) < 2) probe.acc2 = null;
      if (job !== h.job) {
        const st = stats(probe);
        probe.hp = Math.min(st.hp, Math.floor(st.hp * (h.hp / before.stats.hp)));
        probe.mp = Math.min(st.mp, Math.floor(st.mp * (h.mp / before.stats.mp)));
        probe.sp = Math.min(maxSP(probe), Math.floor(maxSP(probe) * (h.sp / before.stats.sp)));
      }
      return { before, after: snapshot(probe), hero: probe };
    } finally { s.roster[index] = h; }
  }
  globalThis.previewCharacterJob = previewJob;
  function jobConsultationSection() {
    const draft = jobConsultationState(), h = s.roster.find(a => a.id === draft.heroId);
    const members = `<div class="actions" aria-label="転職する仲間">${s.roster.map(a => btn(esc(a.name) + ' · ' + esc(DATA.jobs[a.job].name), 'tavern-job-hero', `data-id="${a.id}" aria-pressed="${a.id === draft.heroId}"`, a.id === draft.heroId ? 'selected' : '')).join('')}</div>`;
    if (!h) return `<section class="panel"><h2>転職の相談</h2><p class="muted">① 仲間を選ぶ → ② 転職先を選ぶ → ③ 変化を確認して確定</p>${members}<p>転職を相談する仲間を選んでください。</p></section>`;
    const available = Object.entries(DATA.jobs).filter(([id]) => canJob(h, id));
    if (!available.some(([id]) => id === draft.job)) draft.job = h.job;
    const job = draft.job, j = DATA.jobs[job], trait = jobTraitInfo(job), comparison = previewJob(h, job), eq = globalThis.BRPGEquipment;
    const equipment = eq ? eq.slots.filter(slot => h[slot]).map(slot => {
      const g = item(h[slot]); if (!g) return '';
      const before = eq.suitability(h, g), after = eq.suitability(comparison.hero, g), kept = comparison.hero[slot] === g.id;
      return `<li>${esc(eq.labels[slot])}：${esc(gearName(g))} <strong>${before.suitable ? '適性あり' : '適性なし'} → ${kept ? after.suitable ? '適性あり' : '適性なし' : '所持品へ外れる'}</strong>${kept && !canEquip(comparison.hero, g) ? ' · 必要能力未達で性能無効' : ''}</li>`;
    }).join('') : '';
    const suitability = eq ? `<p><b>装備適性</b>：${Object.entries(eq.types).filter(([type]) => eq.suitability(comparison.hero, { type, material: 'iron' }).suitable).map(([, type]) => esc(type.name)).join('・')}</p><p class="muted">鉄製を基準にした適性です。品ごとの指定や素材によって変わります。</p><ul>${equipment || '<li>現在の装備はありません。</li>'}</ul>` : '';
    return `<section class="panel"><h2>転職の相談</h2><p class="muted">① 仲間を選ぶ → ② 転職先を選ぶ → ③ 変化を確認して確定</p>${members}<h3>${esc(h.name)} · Lv.${h.lv}</h3><label class="field">転職先<select data-character-change="job-preview" data-hero="${h.id}">${available.map(([id, def]) => `<option value="${id}" ${id === job ? 'selected' : ''}>${esc(def.name)}${id === h.job ? '（現在）' : ''}</option>`).join('')}</select></label><article class="quest-box"><div class="row between"><h3>${esc(j.name)}</h3><span class="chip">${esc(trait.tag)}</span></div><p>${esc(j.desc || j.skillDesc || trait.desc)}</p><p><b>${esc(trait.name)}</b>：${esc(trait.desc)}</p></article><h3>${esc(DATA.jobs[h.job].name)} → ${esc(j.name)}</h3><dl class="stat-grid">${KEYS.map(k => `<div><dt>${k} · ${ATTRIBUTE_NAMES[k]}</dt><dd>${jobComparisonValue(comparison.before.attributes[k], comparison.after.attributes[k])}</dd></div>`).join('')}${Object.entries(DERIVED).map(([k, label]) => `<div><dt>${label}</dt><dd>${jobComparisonValue(comparison.before.stats[k], comparison.after.stats[k])}</dd></div>`).join('')}${eq ? `<div><dt>所持枠</dt><dd>${jobComparisonValue(comparison.before.capacity, comparison.after.capacity)}</dd></div><div><dt>装飾品枠</dt><dd>${jobComparisonValue(comparison.before.accessories, comparison.after.accessories)}</dd></div>` : ''}</dl>${eq && eq.usage(h) > comparison.after.capacity ? '<p class="equipment-unsuitable">転職後は所持枠を超えます。所持品は保持され、枠を空けるまで追加できません。</p>' : ''}${suitability}<p class="muted">レベル・成長配分・体得した技・所持品を引き継ぎ、LIFE・MANA・SPは現在の割合を保ちます。</p>${btn('この職業への転職を確定', 'tavern-job-confirm', `data-id="${h.id}" data-job="${esc(job)}" ${job === h.job ? 'disabled' : ''}`, 'primary')}</section>`;
  }
  globalThis.tavernScreen = function() {
    const c = candidate(), cost = recruitCost(), jobs = baseJobs(c);
    if (!jobs.some(([id]) => id === c.job)) c.job = jobs[0]?.[0] || 'warrior';
    const probe = { ...makeHero(-1, c.name, c.job), gender: c.gender, birthAttributes: c.birthAttributes }, a = attributes(probe), rare = rareCandidate();
    return title('TAVERN', '酒場・探索者の登録所', '新しい仲間との出会い、そして経験を積んだ仲間の転職。') + `<div class="grid"><section class="panel tavern-create"><h2>探索者を登録 <small>${cost} G</small></h2><p class="muted">登録 ${s.roster.length}/16人 · 探索参加 ${s.active.length}/6人</p><label class="field">名前<input id="tavern-name" data-character-change="recruit-name" maxlength="24" value="${esc(c.name)}" autocomplete="off"></label>${btn('名前をランダムに選ぶ', 'tavern-random-name')}<div class="grid"><label class="field">性別<select data-character-change="recruit-gender">${Object.entries(GENDERS).filter(([id]) => id !== 'unspecified').map(([id, label]) => `<option value="${id}" ${c.gender === id ? 'selected' : ''}>${label}</option>`).join('')}</select></label><label class="field">最初の職業<select data-character-change="recruit-job">${jobs.map(([id, j]) => `<option value="${id}" ${c.job === id ? 'selected' : ''}>${esc(j.name)}</option>`).join('')}</select></label></div><h3>生まれ持った能力 <span class="chip">ボーナス総計 ${Object.values(c.birthAttributes).reduce((sum, n) => sum + n, 0) >= 0 ? '+' : ''}${Object.values(c.birthAttributes).reduce((sum, n) => sum + n, 0)}</span></h3><dl class="stat-grid recruit-preview">${KEYS.map(k => `<div><dt>${k} · ${ATTRIBUTE_NAMES[k]}</dt><dd>${a[k]} <small class="muted">(${c.birthAttributes[k] >= 0 ? '+' : ''}${c.birthAttributes[k]})</small></dd></div>`).join('')}</dl><p class="muted">括弧内は個人差です。職業や性別を選び直しても変わりません。</p><div class="actions">${btn('この探索者を登録', 'tavern-recruit', `data-job="${esc(c.job)}" ${s.gold < cost || s.roster.length >= 16 || !jobs.length ? 'disabled' : ''}`, 'primary')}${btn('別の志願者を探す', 'tavern-reroll')}</div></section>${jobConsultationSection()}</div>${rare ? `<section class="panel section-space"><h2>見慣れぬ旅人</h2><p>${esc(rare.name)}が、この街で一行を待っている。</p>${btn('旅人を仲間に迎える · ' + cost + ' G', 'tavern-rare-recruit', `data-job="${esc(rare.job)}" ${s.gold < cost || s.roster.length >= 16 ? 'disabled' : ''}`)}</section>` : ''}`;
  };

  const previousRender = render;
  render = function() {
    s.roster.forEach(initialize);
    if (!$('character-dialog')?.open) cancelGrowth();
    previousRender(); refreshDetail();
  };
  const previousBoot = boot;
  boot = function() {
    // Capture keeps legacy direct-allocation controls inert even in an already-open old screen.
    document.addEventListener('click', ev => {
      const eqDialog = $('equipment-dialog');
      if (eqDialog?.open && ev.target === eqDialog) { closeEquipmentDialog(); return; }
      const b = ev.target.closest('[data-action]');
      if (!b || b.disabled) return;
      const action = b.dataset.action, id = Number(b.dataset.id);
      if (action === 'alloc-stat') { ev.stopImmediatePropagation(); return; }
      if (!action.startsWith('character-') && !action.startsWith('tavern-') && !action.startsWith('equipment-')) return;
      ev.stopImmediatePropagation();
      if (action === 'character-slot') {
        const h = s.roster.find(x => x.id === id);
        if (h) {
          equipmentView(h).slot = b.dataset.slot;
          openEquipmentDialog(h, b.dataset.slot);
          refreshDetail();
        }
      } else if (action === 'equipment-dialog-close') closeEquipmentDialog();
      else if (action === 'equipment-reach-filter') {
        equipmentReachFilter = b.dataset.reach || 'all';
        refreshEquipmentDialog();
      }
      else if (action === 'character-auto-source') { const h = s.roster.find(x => x.id === id); if (h && !s.dungeon && !s.battle && Object.hasOwn(equipmentView(h).sources, b.dataset.source)) { const v = equipmentView(h); v.sources[b.dataset.source] = !v.sources[b.dataset.source]; refreshDetail(); } }
      else if (action === 'character-auto-equip') { const h = s.roster.find(x => x.id === id); if (h) BRPGEquipment.autoEquip(id, equipmentView(h).sources); }
      else if (action === 'character-store-bulk') globalThis.BRPGEquipment?.transferUnworn(id);
      else if (action === 'character-prev' || action === 'character-next') {
        closeEquipmentDialog();
        const rosterOrder = orderedRoster();
        const index = rosterOrder.findIndex(h => h.id === id), direction = action === 'character-next' ? 1 : -1;
        cancelGrowth();
        if (rosterOrder.length) {
          openCharacter(rosterOrder[(index + direction + rosterOrder.length) % rosterOrder.length].id);
        }
      } else if (action === 'character-growth') globalThis.adjustCharacterGrowth(id, b.dataset.stat, Number(b.dataset.step));
      else if (action === 'character-equip') {
        globalThis.BRPGEquipment?.equip(Number(b.dataset.gear), id, b.dataset.slot);
        closeEquipmentDialog();
        refreshDetail();
      } else if (action === 'character-unequip') {
        globalThis.BRPGEquipment?.unequip(id, b.dataset.slot);
        refreshDetail();
        refreshEquipmentDialog();
      } else if (action === 'character-transfer') {
        globalThis.BRPGEquipment?.transfer(Number(b.dataset.gear), b.dataset.id === 'storage' ? null : id);
        refreshDetail();
        refreshEquipmentDialog();
      }
      else if (action === 'character-growth-confirm') confirmGrowth(id);
      else if (action === 'character-growth-cancel') { cancelGrowth(); refreshDetail(); }
      else if (action === 'tavern-recruit') recruit(b.dataset.job);
      else if (action === 'tavern-rare-recruit') recruit(b.dataset.job, { rare: true });
      else if (action === 'tavern-job-hero' && tavernOnly()) { const h = s.roster.find(a => a.id === id); if (h) { Object.assign(jobConsultationState(), { heroId: id, job: h.job }); render(); } }
      else if (action === 'tavern-job-confirm' && tavernOnly()) { const draft = jobConsultationState(); if (draft.heroId === id && draft.job === b.dataset.job) changeJob(id, draft.job); }
      else if (action === 'tavern-random-name' && tavernOnly()) { candidate().name = randomRecruitName(); state().tavernCandidates[currentTown().id].name = candidate().name; render(); }
      else if (action === 'tavern-reroll' && tavernOnly()) { state().tavernCandidates[currentTown().id] = rollCandidate(); recruitForm = null; render(); }
    }, true);
    document.addEventListener('input', ev => {
      if (ev.target.dataset.characterChange === 'recruit-name' && tavernOnly()) {
        candidate().name = ev.target.value; state().tavernCandidates[currentTown().id].name = ev.target.value; save();
      }
    });
    document.addEventListener('change', ev => {
      const d = ev.target.dataset, action = d.characterChange;
      if (d.extChange === 'subjob') { ev.stopImmediatePropagation(); return; }
      if (!action) return;
      ev.stopImmediatePropagation();
      if (action === 'job-preview' && tavernOnly()) { const draft = jobConsultationState(), h = s.roster.find(a => a.id === Number(d.hero)); if (h && draft.heroId === h.id && canJob(h, ev.target.value)) { draft.job = ev.target.value; render(); } }
      else if (action === 'recruit-gender' || action === 'recruit-job') {
        if (!tavernOnly()) return;
        const c = candidate(), value = ev.target.value;
        if (action === 'recruit-gender' && GENDERS[value] && value !== 'unspecified') c.gender = value;
        if (action === 'recruit-job' && baseJobs(c).some(([id]) => id === value)) c.job = value;
        state().tavernCandidates[currentTown().id] = { ...c }; render();
      } else if (action === 'equip') {
        if (!townOnly()) return;
        const h = s.roster.find(a => a.id === Number(d.hero));
        if (!h || !['weapon', 'armor'].includes(d.slot)) return;
        if (!ev.target.value) { h[d.slot] = null; render(); }
        else { const g = item(Number(ev.target.value)); if (g?.slot === d.slot) equip(g.id, h.id); }
      }
    }, true);
    $('character-dialog').addEventListener?.('close', cancelGrowth);
    $('character-dialog').addEventListener?.('cancel', cancelGrowth);
    previousBoot();
  };
})();
