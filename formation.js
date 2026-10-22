/* Shared formation/range rules. Load after the UI extensions; no new save fields required. */
'use strict';
(() => {
  const LABELS = { near: '近距離', medium: '中距離', long: '遠距離' };
  let attackContext = null;
  const baseEnemyAlive = enemyAlive;
  function normalize(value = s) {
    const members = value.active.map(id => value.roster.find(h => h.id === id)).filter(Boolean);
    for (const row of ['front', 'back']) {
      const same = members.filter(h => h.row === row);
      for (const h of same.slice(3)) h.row = row === 'front' ? 'back' : 'front';
    }
    if (value.battle) assignEnemies(value.battle.enemies);
  }
  function assignEnemies(enemies) {
    const counts = { front: 0, back: 0 };
    // Existing explicit rows survive loading. Older encounters receive stable rows.
    for (const e of enemies) if (['front', 'back'].includes(e.row)) counts[e.row]++;
    for (const e of enemies) if (!['front', 'back'].includes(e.row)) {
      e.row = e.ai === 'hex' && enemies.length > 1 && counts.back < 3 ? 'back' : counts.front < 3 ? 'front' : 'back';
      counts[e.row]++;
    }
    // A party of casters still has a visible front line.
    if (enemies.length && !enemies.some(e => e.row === 'front')) enemies[0].row = 'front';
  }
  function weaponRange(h) {
    const g = item(h?.weapon);
    if (!g || g.dur <= 0) return 'near';
    globalThis.BRPGEquipment?.enrich(g);
    if (LABELS[g.range]) return g.range;
    return ['bow', 'staff'].includes(g.type) ? 'long' : ['spear', 'whip'].includes(g.type) ? 'medium' : 'near';
  }
  function enemyRange(e) { return LABELS[e.range] ? e.range : e.ai === 'hex' ? 'long' : e.row === 'back' ? 'medium' : 'near'; }
  function skillDef(h, id) { return DATA.skills[id] || heroSkills(h).find(k => k.id === id); }
  function range(h, skill = null) {
    if (LABELS[skill?.range]) return skill.range;
    if (skill && ['damage', 'drain'].includes(skill.kind)) return 'long';
    if (skill && /射撃|射|矢|弓|投/.test(skill.name || '')) return 'long';
    return weaponRange(h);
  }
  function offensive(skill) { return !skill || ['enemy', 'allEnemies'].includes(skill.target); }
  function reachable(actor, foes, allies, reach) {
    const live = foes.filter(e => e.hp > 0), front = live.filter(e => e.row !== 'back');
    if (reach === 'long') return live;
    if (reach === 'near' && actor.row === 'back' && allies.some(h => h.hp > 0 && h.row !== 'back')) return [];
    return front.length ? front : live;
  }
  function targets(h, skill = null) {
    normalize();
    return reachable(h, baseEnemyAlive(), alive(), range(h, skill));
  }
  function rangeText(h, skill = null) {
    if (skill && !offensive(skill)) return '支援・距離制限なし';
    const r = range(h, skill);
    return LABELS[r] + (r === 'near' ? '：前衛から敵前衛へ' : r === 'medium' ? '：味方後衛からも敵前衛へ' : '：敵後衛も選択可');
  }
  enemyAlive = function() {
    const foes = baseEnemyAlive();
    return attackContext ? foes.filter(e => attackContext.keys.has(e.key)) : foes;
  };
  const previousDamage = physicalDamage;
  physicalDamage = function(h) {
    // Range now determines reach. Spears, whips and bows retain full power in the back row.
    return (attackContext?.range || range(h)) === 'near' ? previousDamage(h) : stats(h).atk;
  };
  const previousAttack = heroAttack;
  heroAttack = function(h, e, ...args) {
    // One skill keeps its original reach even if its first hit breaks the weapon.
    const allowed = attackContext ? baseEnemyAlive().filter(a => attackContext.keys.has(a.key)) : targets(h);
    if (attackContext && !allowed.some(a => a.key === e?.key)) return 0;
    const target = allowed.find(a => a.key === e?.key) || allowed[0];
    if (!target) { note(h.name + 'の攻撃は距離が届かない。前衛へ移すか、中・遠距離の武器を装備してください。'); return 0; }
    return previousAttack(h, target, ...args);
  };
  const previousCast = cast;
  cast = function(h, target, skillId) {
    const skill = skillDef(h, skillId);
    if (!skill || !offensive(skill)) return previousCast(h, target, skillId);
    const choices = targets(h, skill);
    if (!choices.length) { note(h.name + 'の' + skill.name + 'は距離が届かない。'); return; }
    const selected = choices.find(e => e.key === target) || choices[0], before = attackContext;
    attackContext = { range: range(h, skill), keys: new Set(choices.map(e => e.key)) };
    try { return previousCast(h, selected.key, skillId); }
    finally { attackContext = before; }
  };
  const previousPlan = planCommand;
  planCommand = function(command, target = null, skillId = null, itemId = null) {
    const h = s.battle && alive().find(a => a.id === s.battle.actor), skill = h && command === 'skill' ? skillDef(h, skillId) : null;
    if (h && (command === 'attack' || command === 'skill' && offensive(skill))) {
      const choices = targets(h, skill);
      if (!choices.length) { tell('その行動は距離が届きません。防御または別の技を選んでください。'); return render(); }
      target = choices.find(e => e.key === target)?.key ?? choices[0].key;
    }
    return previousPlan(command, target, skillId, itemId);
  };
  const previousAuto = autoPlans;
  autoPlans = function() {
    normalize(); previousAuto();
    if (!s.battle) return;
    for (const h of alive()) {
      let p = s.battle.plans[h.id];
      if (!p || !['attack', 'skill'].includes(p.command)) continue;
      let skill = p.command === 'skill' ? skillDef(h, p.skill) : null;
      const lim = typeof heroResourceLimits === 'function' ? heroResourceLimits(h) : { spThreshold: 0, mpThreshold: 0 };
      const ruleReserve = s.battleRules.includes('reserve') && unlocked('reserve');
      const conserving = (ruleReserve && (belowReserve(h, 'mana') || belowReserve(h, 'sp'))) || (lim.spThreshold > 0 && belowReserve(h, 'sp')) || (lim.mpThreshold > 0 && belowReserve(h, 'mana'));
      const wouldDropBelow = skill && (((h.sp - (skill.sp || 0)) < lim.spThreshold) || ((h.mp - skill.mp) < lim.mpThreshold));
      // Apply the same resource policy after tactical support and range fallback.
      if (skill && (skill.mp >= h.mp || (skill.sp || 0) > h.sp || conserving || wouldDropBelow)) {
        p = s.battle.plans[h.id] = { command: 'attack', target: p.target }; skill = null;
      }
      if (skill && !offensive(skill)) continue;
      let choices = targets(h, skill);
      if (!choices.length) {
        skill = !conserving && heroSkills(h).find(k => offensive(k) && k.level <= h.lv && k.mp < h.mp && (k.sp || 0) <= (h.sp || 0) && targets(h, k).length);
        if (!skill) { s.battle.plans[h.id] = { command: 'defend', target: h.id }; continue; }
        choices = targets(h, skill); s.battle.plans[h.id] = { command: 'skill', skill: skill.id, target: choices[0].key };
      } else p.target = choices.find(e => e.key === p.target)?.key ?? choices[0].key;
    }
  };
  enemyTurn = function(e, guards) {
    if (e.hp <= 0 || !alive().length) return;
    normalize();
    const magic = e.ai === 'hex', reach = enemyRange(e);
    const choices = reachable(e, alive(), baseEnemyAlive(), reach);
    if (e.ai === 'armor' && s.battle.turn % 3 === 0) { e.def += 2; note(e.name + 'が装甲を固めた。'); return; }
    if (!choices.length) { note(e.name + 'は後衛で機会をうかがっている。'); return; }
    const weighted = choices.flatMap(h => Array(h.row === 'front' ? 3 : 1).fill(h));
    const hit = e.ai === 'cleave' && s.battle.turn % 2 === 0 ? choices : [pick(weighted)];
    for (const h of hit) {
      const n = allyDamage(h, magic ? e.mag + 6 : e.atk * (hit.length > 1 ? .85 : 1), magic, guards.has(h.id));
      note(e.name + ' → ' + h.name + '：' + n + ' ダメージ。');
      if (e.ai === 'poison' && h.hp > 0 && random() < .6) { h.poison = 3; note(h.name + 'が毒を受けた。'); }
      if (e.ai === 'drain') e.hp = Math.min(e.maxhp, e.hp + Math.floor(n * .6));
      if (!h.hp) note(h.name + 'が倒れた。');
    }
  };
  const previousRender = render;
  render = function() { normalize(); return previousRender(); };
  const previousHandle = handleAction;
  handleAction = function(event) {
    const b = event.target.closest('[data-action]');
    if (b?.dataset.action === 'row' && !b.disabled) {
      const h = s.roster.find(a => a.id === Number(b.dataset.id)), dest = h?.row === 'front' ? 'back' : 'front';
      if (h && s.active.includes(h.id) && party().filter(a => a.row === dest).length >= 3) { tell((dest === 'front' ? '前衛' : '後衛') + 'は3人までです。先に別の仲間を移してください。'); return render(); }
    }
    return previousHandle(event);
  };
  function rowHTML(members, row, renderCard, empty = true, isEnemy = false) {
    const list = members.filter(h => h.row === row);
    const dropAttr = isEnemy ? '' : ` data-drop-row="${row}"`;
    const labelHint = isEnemy ? `${list.length} / 3` : `${list.length} / 3 · ドラッグで移動`;
    const emptyHint = isEnemy ? '空き枠' : '空き枠（D&Dで配置）';
    return `<section class="formation-row formation-${row}"${dropAttr} aria-label="${row === 'front' ? '前衛' : '後衛'}"><div class="formation-label"><b>${row === 'front' ? '前衛' : '後衛'}</b><small>${labelHint}</small></div><div class="formation-slots"${dropAttr}>${list.map(renderCard).join('')}${empty ? Array.from({ length: Math.max(0, 3 - list.length) }, () => `<div class="formation-empty"${dropAttr} aria-label="空き枠">${emptyHint}</div>`).join('') : ''}</div></section>`;
  }
  strip = function(battle = false) { normalize(); return `<div class="formation-party">${['front', 'back'].map(row => rowHTML(party(), row, h => mini(h, battle))).join('')}</div>`; };
  const previousMini = mini;
  mini = function(h, ...args) {
    const battle = args[0] === true;
    const dragAttr = battle ? '' : ` draggable="true" data-drag-hero="${h.id}" title="ドラッグ＆ドロップで隊列を入れ替え可能"`;
    return previousMini(h, ...args)
      .replace('<article class="mini ', `<article class="mini formation-draggable "${dragAttr} `)
      .replace('</article>', `<p class="formation-range">${esc(rangeText(h))}</p></article>`);
  };
  const previousParty = partyScreen;
  partyScreen = function() { normalize(); return `<section class="panel formation-overview"><h2>探索隊列 · 各列3枠</h2><p class="muted">近距離は前衛から。槍・鞭は後衛から前衛に届き、弓・杖・攻撃魔法は敵後衛も狙えます。前衛が倒れると後衛が接敵します。</p>${strip()}</section>` + previousParty(); };
  const previousUiEnemies = uiEnemies;
  uiEnemies = function() {
    if (!s.battle) return '';
    normalize();
    // Preserve the facilities observer gate, research/ecology and thumbnail wrappers.
    // Only move the existing cards into rows and annotate their actual attack range.
    const html = previousUiEnemies(), cards = new Map();
    for (const markup of html.match(/<button class="enemy [\s\S]*?<\/button>/g) || []) {
      const key = markup.match(/data-id="(\d+)"/)?.[1];
      if (key !== undefined) cards.set(Number(key), markup);
    }
    if (cards.size !== s.battle.enemies.length) return html;
    const card = e => cards.get(e.key).replace(/(<b>[\s\S]*?<\/b>)/, `$1<small>${e.row === 'front' ? '前衛' : '後衛'} · ${LABELS[enemyRange(e)]}</small>`);
    return `<div class="formation-enemies">${['front', 'back'].map(row => rowHTML(s.battle.enemies, row, card, true, true)).join('')}</div>`;
  };
  // Describe the actual range in character skills and equipment descriptions.
  const previousSkills = heroSkills;
  heroSkills = function(h) { return previousSkills(h).map(k => ({ ...k, range: range(h, k), desc: (k.desc || '') + ' 【' + rangeText(h, k) + '】' })); };
  uiSkillList = heroSkills;
  function magicJob(h) {
    const chain = new Set(); let id = h.job;
    while (id && !chain.has(id)) { chain.add(id); id = DATA.jobs[id]?.requirements?.job; }
    return [...chain].some(k => ['mage', 'priest', 'druid', 'warlock', 'elementalist'].includes(k)) || /魔法|魔導|術師|僧侶|司祭|祈祷/.test(`${DATA.catalog?.jobs?.[h.job]?.family || ''} ${DATA.jobs[h.job]?.name || ''}`);
  }
  function restriction(h, g) {
    if (!magicJob(h)) return true;
    const eq = globalThis.BRPGEquipment; eq?.enrich(g);
    if (eq?.slotOf(g) === 'shield') return false;
    return DATA.materials[g.material]?.category !== 'metal';
  }
  if (globalThis.characterRules) characterRules.gear.push(restriction);
  const previousRequirements = gearRequirementText;
  gearRequirementText = function(g) {
    const slot = g && globalThis.BRPGEquipment?.slotOf(g), reach = g && LABELS[g.range] ? g.range : ['bow', 'staff'].includes(g?.type) ? 'long' : ['spear', 'whip'].includes(g?.type) ? 'medium' : 'near';
    return previousRequirements(g) + (slot === 'weapon' ? ' / ' + LABELS[reach] : '') + (g && (slot === 'shield' || DATA.materials[g.material]?.category === 'metal') ? ' / 魔法職は金属装備・盾を装備不可' : '');
  };
  // HTML5 Drag and Drop for Party Formation
  let draggedHeroId = null;
  if (typeof document !== 'undefined') {
    document.addEventListener('dragstart', event => {
      const card = event.target.closest('[data-drag-hero]');
      if (!card) return;
      draggedHeroId = Number(card.dataset.dragHero);
      if (event.dataTransfer) {
        event.dataTransfer.setData('text/plain', String(draggedHeroId));
        event.dataTransfer.effectAllowed = 'move';
      }
      card.classList.add('is-dragging');
    });

    document.addEventListener('dragend', event => {
      const card = event.target.closest('[data-drag-hero]');
      if (card) card.classList.remove('is-dragging');
      document.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
      draggedHeroId = null;
    });

    document.addEventListener('dragover', event => {
      const dropTarget = event.target.closest('[data-drop-row], [data-drag-hero]');
      if (dropTarget && draggedHeroId) {
        event.preventDefault();
        if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
      }
    });

    document.addEventListener('dragenter', event => {
      const dropTarget = event.target.closest('[data-drop-row], [data-drag-hero]');
      if (dropTarget && draggedHeroId) {
        dropTarget.classList.add('drag-over');
      }
    });

    document.addEventListener('dragleave', event => {
      const dropTarget = event.target.closest('[data-drop-row], [data-drag-hero]');
      if (dropTarget) {
        dropTarget.classList.remove('drag-over');
      }
    });

    document.addEventListener('drop', event => {
      const dropRowEl = event.target.closest('[data-drop-row]');
      const dropHeroEl = event.target.closest('[data-drag-hero]');
      document.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
      
      if (!draggedHeroId) return;
      const hero = s.roster.find(h => h.id === draggedHeroId);
      if (!hero) return;

      event.preventDefault();

      if (dropHeroEl && Number(dropHeroEl.dataset.dragHero) !== draggedHeroId) {
        const targetHero = s.roster.find(h => h.id === Number(dropHeroEl.dataset.dragHero));
        if (targetHero) {
          const tempRow = hero.row;
          hero.row = targetHero.row;
          targetHero.row = tempRow;
          tell(`${hero.name} と ${targetHero.name} の隊列を入れ替えました。`);
          normalize();
          render();
          return;
        }
      }

      if (dropRowEl) {
        const destRow = dropRowEl.dataset.dropRow;
        if (destRow && ['front', 'back'].includes(destRow) && hero.row !== destRow) {
          const destCount = party().filter(h => h.id !== hero.id && h.row === destRow).length;
          if (destCount >= 3) {
            const destHero = party().find(h => h.row === destRow);
            if (destHero) {
              destHero.row = hero.row;
              hero.row = destRow;
              tell(`${hero.name} を${destRow === 'front' ? '前衛' : '後衛'}に移し、${destHero.name} と交代しました。`);
            } else {
              tell(`${destRow === 'front' ? '前衛' : '後衛'}は3人までです。`);
            }
          } else {
            hero.row = destRow;
            tell(`${hero.name} を${destRow === 'front' ? '前衛' : '後衛'}に移動しました。`);
          }
          normalize();
          render();
        }
      }
    });
  }
  globalThis.BRPGFormation = { normalize, assignEnemies, range, rangeText, targets, reachable, skillDef, restriction, enemyRange, labels: LABELS };
  normalize();
})();
