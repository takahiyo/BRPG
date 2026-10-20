/* Character records, staged growth, and the town tavern. Classic script: no dependencies. */
(() => {
  const KEYS = Object.keys(ATTRIBUTE_NAMES);
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
    if (!growthDraft || growthDraft.owner !== s || growthDraft.heroId !== h.id) growthDraft = { owner: s, heroId: h.id, values: Object.fromEntries(KEYS.map(k => [k, 0])) };
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
    if (!total || total > freePoints(h) || KEYS.some(k => !Number.isInteger(delta[k]) || delta[k] < 0)) return false;
    const e = state(); e.alloc[id] ??= {};
    for (const k of KEYS) e.alloc[id][k] = (e.alloc[id][k] || 0) + delta[k];
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
    if (!h || s.battle || !KEYS.includes(key) || ![1, -1].includes(amount)) return false;
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

  partyScreen = function() {
    const pr = partyPresets();
    return title('COMPANIONS', '仲間と隊列', 'ステータスを押すと、能力・装備・成長・体得した技を確認できます。') +
      `<section class="panel"><div class="row between"><h2>編成セット</h2><small>参加 ${s.active.length} / 6人 · 登録 ${s.roster.length} / 16人</small></div><div class="actions">${[1, 2, 3].map(n => `${btn('セット' + n + 'に保存', 'save-preset', `data-slot="${n}" ${s.dungeon || s.battle ? 'disabled' : ''}`)}${btn('セット' + n + 'を呼出' + (pr[n] ? ' (' + pr[n].active.length + '人)' : ' (空)'), 'load-preset', `data-slot="${n}" ${!pr[n] || s.dungeon || s.battle ? 'disabled' : ''}`)}`).join('')}</div></section>
      <div class="grid three section-space">${s.roster.map(h => {
        initialize(h); const j = DATA.jobs[h.job], active = s.active.includes(h.id), st = stats(h);
        return `<article class="card party-status ${active ? '' : 'waiting'}"><button class="party-status-open" data-action="character" data-id="${h.id}" aria-label="${esc(h.name)}のステータスを開く"><span class="row between"><b>${esc(h.name)}</b><span class="gold">Lv.${h.lv}</span></span><span>${esc(j.name)} · ${GENDERS[h.gender]} · ${h.row === 'front' ? '前衛' : '後衛'}</span><span>LIFE ${h.hp}/${st.hp} · MANA ${h.mp}/${st.mp} · SP ${h.sp}/${maxSP(h)}</span><span>攻 ${st.atk} · 防 ${st.def} · 魔 ${st.mag} · 速 ${st.speed}</span><span class="muted">${active ? '探索参加中' : '街で待機'} · ${statusLabel(h)}${freePoints(h) ? ' · 成長 ' + freePoints(h) + ' Pt' : ''}　詳細 ↗</span></button><div class="actions">${btn(active ? '街で待機' : '探索に参加', 'member', `data-id="${h.id}" ${s.dungeon || s.battle || active && s.active.length === 1 ? 'disabled' : ''}`)}${btn(h.row === 'front' ? '後衛へ' : '前衛へ', 'row', `data-id="${h.id}" ${s.dungeon || s.battle ? 'disabled' : ''}`)}</div></article>`;
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
  function growthSection(h, comparison) {
    const d = draftFor(h), total = draftTotal(h), remaining = freePoints(h) - total;
    return `<div class="row between"><h3>成長</h3><span class="gold">残り ${remaining} Pt${total ? ' · 仮配分 ' + total + ' Pt' : ''}</span></div><div class="growth-grid">${KEYS.map(k => `<div class="growth-control"><div><b>${k}</b><small>${ATTRIBUTE_NAMES[k]}</small></div><span>${changeValue(comparison.before.attributes[k], comparison.after.attributes[k])}</span><div class="actions">${btn('−', 'character-growth', `data-id="${h.id}" data-stat="${k}" data-step="-1" aria-label="${ATTRIBUTE_NAMES[k]}の仮配分を減らす" ${!d.values[k] || s.battle ? 'disabled' : ''}`)}${btn('＋', 'character-growth', `data-id="${h.id}" data-stat="${k}" data-step="1" aria-label="${ATTRIBUTE_NAMES[k]}の仮配分を増やす" ${remaining <= 0 || s.battle ? 'disabled' : ''}`)}</div></div>`).join('')}</div><p class="muted">＋／−で仮配分し、確定するとポイントを使います。取り消しや画面を閉じる操作では消費しません。</p><div class="actions">${btn('この配分で確定', 'character-growth-confirm', `data-id="${h.id}" ${!total || s.battle ? 'disabled' : ''}`, 'primary')}${btn('仮配分を取り消す', 'character-growth-cancel', total ? '' : 'disabled')}</div>${s.battle ? '<p class="muted">戦闘中は成長を確定できません。</p>' : ''}`;
  }
  characterScreen = function(h) {
    initialize(h); const j = DATA.jobs[h.job], comparison = previewGrowth(h), learned = uiSkillList(h).filter(sk => sk.level <= h.lv), index = s.roster.indexOf(h);
    const catSkills = (j.catalogSkills || []).map(sid => DATA.catalog?.skills?.[sid]).filter(Boolean);
    const catSection = catSkills.length ? `<div class="detail-section"><h4>職能専門技能（主職『${esc(j.name)}』）</h4>${catSkills.map(ck => {
      const unlocked = h.lv >= ck.minLv;
      const behNames = (ck.behaviors || []).map(bid => DATA.catalog?.behaviors?.[bid]?.name || bid).join('・');
      return `<article class="skill-line ${unlocked ? '' : 'locked'}"><div class="row between"><b>${esc(ck.name)} <span class="chip">${esc(ck.kind)}</span></b><small>${unlocked ? '体得済み' : '要 Lv.' + ck.minLv}${behNames ? ' · 行動：' + esc(behNames) : ''}</small></div><p>${esc(ck.effect)}${ck.limit ? ` <small class="muted">（${esc(ck.limit)}）</small>` : ''}</p></article>`;
    }).join('')}</div>` : '';
    return `<div class="character-pager">${btn('← 前の仲間', 'character-prev', `data-id="${h.id}" ${s.roster.length < 2 ? 'disabled' : ''}`)}<span>${index + 1} / ${s.roster.length}</span>${btn('次の仲間 →', 'character-next', `data-id="${h.id}" ${s.roster.length < 2 ? 'disabled' : ''}`)}</div><div class="hero-top"><div class="avatar">${typeof jobCrestSVG === 'function' ? jobCrestSVG(h.job) : j.icon}</div><div><p class="eyebrow">CHARACTER RECORD</p><h2>${esc(h.name)} <span class="gold">Lv.${h.lv}</span></h2><small>${esc(j.name)} / ${GENDERS[h.gender]} / ${h.row === 'front' ? '前衛' : '後衛'} / ${s.active.includes(h.id) ? '探索参加中' : '街で待機'}</small></div></div><div class="character-grid"><section class="character-section"><h3>状態</h3>${bars(h)}<p>${statusLabel(h)} · 経験値 ${h.xp} / ${xpNeeded(h)}</p><dl class="stat-grid">${Object.entries(DERIVED).map(([k, name]) => `<div><dt>${name}</dt><dd>${changeValue(comparison.before.stats[k], comparison.after.stats[k])}</dd></div>`).join('')}</dl></section><section class="character-section">${growthSection(h, comparison)}</section><section class="character-section"><h3>装備</h3>${equipmentSection(h)}</section><section class="character-section"><h3>体得した技 <small>${learned.length}種</small></h3><div class="learned-skills">${learned.map(sk => `<article class="skill-line"><div class="row between"><b>${esc(sk.name)}</b><small>MANA ${sk.mp} / SP ${sk.sp || 0}</small></div><p>${esc(skillDescription(sk.desc) || '鍛錬によって体得した技。')}</p></article>`).join('') || '<p class="muted">まだ体得した戦闘技はありません。</p>'}${catSection}</div></section></div>${s.battle && h.hp > 0 && s.active.includes(h.id) ? btn('この仲間に指示する', 'actor-close', `data-id="${h.id}"`, 'primary wide') : ''}`;
  };
  function refreshDetail() {
    const dialog = $('character-dialog'), h = s.roster.find(a => a.id === s.selection);
    if (dialog?.open && h) $('character-body').innerHTML = characterScreen(h);
  }
  openCharacter = function(id) {
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
    return { name: '探索者' + s.nextHero, gender: 'male', job: 'warrior', birthAttributes: Object.fromEntries(KEYS.map(k => [k, Math.floor(random() * 5) - 2])) };
  }
  function candidate() {
    const e = state(), townId = currentTown().id;
    let saved = e.tavernCandidates[townId];
    if (!saved || typeof saved !== 'object' || !saved.birthAttributes || typeof saved.birthAttributes !== 'object' || KEYS.some(k => !Number.isInteger(saved.birthAttributes[k]) || Math.abs(saved.birthAttributes[k]) > 2)) saved = e.tavernCandidates[townId] = rollCandidate();
    if (!recruitForm || recruitState !== s || recruitForm.townId !== townId) {
      recruitState = s; recruitForm = { townId, ...saved };
      if (!GENDERS[recruitForm.gender] || recruitForm.gender === 'unspecified') recruitForm.gender = 'male';
      if (typeof recruitForm.name !== 'string') recruitForm.name = '探索者' + s.nextHero;
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
  globalThis.tavernScreen = function() {
    const c = candidate(), cost = recruitCost(), jobs = baseJobs(c);
    if (!jobs.some(([id]) => id === c.job)) c.job = jobs[0]?.[0] || 'warrior';
    const probe = { ...makeHero(-1, c.name, c.job), gender: c.gender, birthAttributes: c.birthAttributes }, a = attributes(probe), rare = rareCandidate();
    return title('TAVERN', '酒場・探索者の登録所', '新しい仲間との出会い、そして経験を積んだ仲間の転職。') + `<div class="grid"><section class="panel tavern-create"><h2>探索者を登録 <small>${cost} G</small></h2><p class="muted">登録 ${s.roster.length}/16人 · 探索参加 ${s.active.length}/6人</p><label class="field">名前<input id="tavern-name" data-character-change="recruit-name" maxlength="24" value="${esc(c.name)}" autocomplete="off"></label><div class="grid"><label class="field">性別<select data-character-change="recruit-gender">${Object.entries(GENDERS).filter(([id]) => id !== 'unspecified').map(([id, label]) => `<option value="${id}" ${c.gender === id ? 'selected' : ''}>${label}</option>`).join('')}</select></label><label class="field">最初の職業<select data-character-change="recruit-job">${jobs.map(([id, j]) => `<option value="${id}" ${c.job === id ? 'selected' : ''}>${esc(j.name)}</option>`).join('')}</select></label></div><h3>生まれ持った能力</h3><dl class="stat-grid recruit-preview">${KEYS.map(k => `<div><dt>${k} · ${ATTRIBUTE_NAMES[k]}</dt><dd>${a[k]} <small class="muted">(${c.birthAttributes[k] >= 0 ? '+' : ''}${c.birthAttributes[k]})</small></dd></div>`).join('')}</dl><p class="muted">括弧内は個人差です。職業や性別を選び直しても変わりません。</p><div class="actions">${btn('この探索者を登録', 'tavern-recruit', `data-job="${esc(c.job)}" ${s.gold < cost || s.roster.length >= 16 || !jobs.length ? 'disabled' : ''}`, 'primary')}${btn('別の志願者を探す', 'tavern-reroll')}</div></section><section class="panel"><h2>転職の相談</h2><p class="muted">今の仲間が就ける職業を、本人ごとに相談できます。</p>${s.roster.map(h => { const available = Object.entries(DATA.jobs).filter(([id]) => canJob(h, id)); return `<article class="detail-gear"><div class="row between"><b>${esc(h.name)}</b><small>${esc(DATA.jobs[h.job].name)} Lv.${h.lv}</small></div><label class="field">転職先<select data-character-change="job" data-hero="${h.id}" aria-label="${esc(h.name)}の転職先">${available.map(([id, j]) => `<option value="${id}" ${h.job === id ? 'selected' : ''}>${esc(j.name)}${h.job === id ? '（現在）' : ''}</option>`).join('')}</select></label></article>`; }).join('')}</section></div>${rare ? `<section class="panel section-space"><h2>見慣れぬ旅人</h2><p>${esc(rare.name)}が、この街で一行を待っている。</p>${btn('旅人を仲間に迎える · ' + cost + ' G', 'tavern-rare-recruit', `data-job="${esc(rare.job)}" ${s.gold < cost || s.roster.length >= 16 ? 'disabled' : ''}`)}</section>` : ''}`;
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
      const b = ev.target.closest('[data-action]');
      if (!b || b.disabled) return;
      const action = b.dataset.action, id = Number(b.dataset.id);
      if (action === 'alloc-stat') { ev.stopImmediatePropagation(); return; }
      if (!action.startsWith('character-') && !action.startsWith('tavern-')) return;
      ev.stopImmediatePropagation();
      if (action === 'character-prev' || action === 'character-next') {
        const index = s.roster.findIndex(h => h.id === id), direction = action === 'character-next' ? 1 : -1;
        cancelGrowth(); openCharacter(s.roster[(index + direction + s.roster.length) % s.roster.length].id);
      } else if (action === 'character-growth') globalThis.adjustCharacterGrowth(id, b.dataset.stat, Number(b.dataset.step));
      else if (action === 'character-growth-confirm') confirmGrowth(id);
      else if (action === 'character-growth-cancel') { cancelGrowth(); refreshDetail(); }
      else if (action === 'tavern-recruit') recruit(b.dataset.job);
      else if (action === 'tavern-rare-recruit') recruit(b.dataset.job, { rare: true });
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
      if (action === 'job') changeJob(Number(d.hero), ev.target.value);
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
