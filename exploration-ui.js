/* Exploration presentation and cancellable post-victory pacing. No saved schema changes. */
'use strict';
(() => {
  let resumeWait = null, resolvingVictory = false, walkOnly = false, selectedMode = 'continuous';
  let commandDraft = null;
  let viewBattle = null, stageView = 'map';
  const baseStopAll = stopAll, baseResume = resumeExpedition, baseVictory = victory;
  const baseEncounter = encounter, baseStep = step;
  function cancelResume() { if (resumeWait !== null) clearInterval(resumeWait); resumeWait = null; }
  stopAll = function() { cancelResume(); walkOnly = false; return baseStopAll(); };
  resumeExpedition = function() {
    if (resumeWait !== null) return;
    if (resolvingVictory && s.autoExpedition && s.dungeon && !s.battle) {
      const state = s, floor = s.dungeon;
      stopWalk();
      // One-shot interval also works in the project's timer-only simulated browser.
      const timer = setInterval(() => {
        if (resumeWait !== timer) return;
        cancelResume();
        if (s !== state || s.dungeon !== floor || s.battle || !s.autoExpedition || s.view !== 'explore') return;
        baseResume(); render();
      }, 1500);
      resumeWait = timer;
      return;
    }
    return baseResume();
  };
  victory = function() {
    resolvingVictory = true;
    try { return baseVictory(); } finally { resolvingVictory = false; }
  };
  encounter = function(...args) {
    if (!s.dungeon || s.battle) return;
    cancelResume(); commandDraft = null;
    if (walkOnly) { stopAll(); tell('敵と遭遇したため自動歩行を停止。行動を選んでください。'); }
    const result = baseEncounter(...args);
    if (s.battle) {
      // Presentation belongs to the encounter event, never render or save restoration.
      try { globalThis.playSE?.('encounter')?.catch?.(() => {}); } catch (_) {}
      if (!globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
        $('exp-enemy-view')?.animate?.([{opacity:0.55,transform:'translateY(5px)'},{opacity:1,transform:'translateY(0)'}], {duration:260,easing:'ease-out'});
      }
    }
    return result;
  };
  step = function(dx, dy, automatic = false) {
    if (!automatic) stopAll();
    return baseStep(dx, dy, automatic);
  };

  const svgPaths = {
    door: '<path d="M6 21V10a6 6 0 0 1 12 0v11M4 21h16M10 14h7m-3-3 3 3-3 3"/>',
    compass: '<circle cx="12" cy="12" r="9"/><path d="m16 8-3 5-5 3 3-5Z"/>',
    walk: '<circle cx="14" cy="4" r="2"/><path d="m12 8-3 5 4 3-2 6m1-14 3 5 4 1M9 13l-3 6m7-3 5 5"/>',
    sword: '<path d="m6 18 12-12 2-2v5L9 20M5 14l5 5M3 21l4-4"/>',
    stairs: '<path d="M3 21h5v-5h5v-5h5V6h4M7 5h7m-3-3 3 3-3 3"/>',
    gem: '<path d="m12 3 7 7-7 11-7-11Zm-7 7h14M12 3l-3 7 3 11 3-11Z"/>',
    chest: '<path d="M4 11V7a3 3 0 0 1 3-3h10a3 3 0 0 1 3 3v4M3 11h18v9H3ZM10 11v4h4v-4"/>',
    shield: '<path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6Zm0 4v10"/>',
    stop: '<rect x="6" y="6" width="12" height="12" rx="1"/>',
    play: '<path d="m8 4 12 8-12 8Z"/>',
    leaf: '<path d="M20 3C5 3 3 10 7 16s13 2 13-13ZM4 21 16 9"/>'
  };
  function icon(name) { return `<svg class="exp-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${svgPaths[name] || svgPaths.compass}</svg>`; }
  function observed() { return !!globalThis.BRPGFacilities?.observers().length; }
  function automaticRunning() { return !!(s.autoExpedition || walkTimer || battleTimer || resumeWait !== null); }
  function controls() {
    const battle = !!s.battle, running = automaticRunning();
    const mode = battle && selectedMode === 'walk' ? 'battle' : selectedMode;
    const status = resumeWait !== null ? '勝利 · 1.5秒後に探索を再開' : battleTimer ? '自動戦闘中' : walkTimer ? (walkOnly ? '自動歩行中' : s.autoExpedition ? '連続探索中' : '入口へ移動中') : '手動操作';
    return `<section class="panel exp-automation" aria-label="自動操作"><div class="exp-auto-title"><span>${icon('compass')}<b>自動操作</b></span><span class="exp-run-state ${running ? 'running' : ''}" role="status">${status}</span></div><div class="exp-auto-options" role="group" aria-label="自動操作の範囲">${[['continuous','compass','歩行＋戦闘'],['walk','walk','歩行のみ'],['battle','sword','戦闘のみ']].map(([id,ico,label]) => `<button type="button" data-action="exp-auto-mode" data-mode="${id}" aria-pressed="${mode === id}" ${id === 'walk' && battle || id === 'battle' && !battle ? 'disabled' : ''} class="${mode === id ? 'selected' : ''}">${icon(ico)}${label}</button>`).join('')}</div><div class="exp-auto-bottom"><p>${resumeWait !== null ? '戦利品を確認できます。停止・手動操作で再開を中止。' : mode === 'walk' ? '遭遇・階段・封印で停止します。' : mode === 'battle' ? 'この戦闘だけ自動で戦います。' : '歩行と戦闘を続け、階段・封印で停止します。'}</p>${btn(running ? icon('stop') + 'すべて停止' : icon('play') + '開始','exp-auto-toggle','',running ? 'exp-stop' : 'primary')}</div>${resumeWait !== null ? '<div class="exp-resume-track"><i></i></div>' : ''}</section>`;
  }

  function draftFor(actor) {
    if (commandDraft && (commandDraft.battle !== s.battle || commandDraft.turn !== s.battle.turn || commandDraft.actor !== actor.id)) commandDraft = null;
    return commandDraft;
  }
  function commandTarget(draft) {
    if (draft.command === 'defend' || draft.command === 'escape') return 'self';
    if (draft.command === 'skill') {
      const actor = alive().find(h => h.id === s.battle?.actor);
      return (DATA.skills[draft.skill] || (actor && globalThis.BRPGFormation?.skillDef(actor, draft.skill)))?.target || 'enemy';
    }
    if (draft.command === 'item' && ['heal','mp','sp','revive','cleanse'].includes(DATA.items[draft.item]?.kind)) return 'ally';
    return 'enemy';
  }
  function targetOptions(draft) {
    const kind = commandTarget(draft);
    if (kind === 'enemy' || kind === 'allEnemies') {
      const formation = globalThis.BRPGFormation, actor = alive().find(h => h.id === s.battle?.actor);
      const skill = draft.command === 'skill' && actor ? formation?.skillDef(actor, draft.skill) : null;
      const foes = formation && actor ? formation.targets(actor, skill) : enemyAlive();
      return foes.map(e => ({id:e.key,name:e.name,detail:(e.row === 'back' ? '後衛' : '前衛')+' · '+(observed()?'LIFE '+e.hp:'状態未観測')}));
    }
    if (kind === 'ally') return party().filter(h => draft.command !== 'item' || (DATA.items[draft.item]?.kind === 'revive' ? h.hp <= 0 : h.hp > 0)).map(h => ({id:h.id,name:h.name,detail:'LIFE '+h.hp+' / MANA '+h.mp+' / SP '+(h.sp??0)}));
    return [];
  }
  function draftControls(actor) {
    const draft = draftFor(actor);
    if (!draft) return '<div class="exp-target-step"><h3>2. 対象を選ぶ</h3><p>先に行動を選ぶと、必要な対象が表示されます。</p></div>';
    const kind = commandTarget(draft), options = targetOptions(draft), name = uiPlanName({...draft,target:draft.target},actor).split(' → ')[0];
    const fixed = kind === 'self' ? actor.name : kind === 'allAllies' ? '味方全員' : kind === 'allEnemies' ? (options.length ? (globalThis.BRPGFormation ? '届く敵全員：'+options.map(o=>o.name).join('、') : '敵全員') : null) : null;
    const chosen = fixed || options.find(o => o.id === draft.target)?.name;
    return `<div class="exp-target-step"><h3>2. ${esc(name)}の対象を選ぶ</h3>${fixed ? `<p class="exp-fixed-target">対象：${esc(fixed)}</p>` : `<div class="exp-target-picker" role="group" aria-label="行動の対象">${options.map(o => btn(`<b>${esc(o.name)}</b><small>${esc(o.detail)}</small>`,'exp-command-target',`data-id="${o.id}" aria-pressed="${draft.target === o.id}"`,draft.target===o.id?'selected':'')).join('')}</div>${!options.length?'<p>届く対象がいません。防御または別の行動を選んでください。</p>':''}`}<p>${chosen ? `${esc(name)} → ${esc(chosen)}` : '対象を選んでください。'}</p>${btn('この指示を確定','exp-command-confirm',chosen?'':'disabled','primary wide')}</div>`;
  }
  uiBattlePanel = function() {
    const b = s.battle, heroes = alive(), actor = heroes.find(h => h.id === b.actor) || heroes[0];
    if (!actor) return '<section class="panel">行動できる仲間がいません。</section>';
    b.actor = actor.id;
    const draft = draftFor(actor), skills = uiSkillList(actor).filter(sk => sk.level <= actor.lv), items = Object.entries(DATA.items).filter(([id,it]) => uiCount(id) && it.kind !== 'escape');
    const count = heroes.filter(h => b.plans[h.id]).length, plan = b.plans[actor.id];
    const chosen = (command, id) => draft?.command === command && (!id || draft.skill === id || draft.item === id) ? ' selected' : '';
    return `<section class="panel battle-console exp-command-console"><div class="exp-console-head"><div><p class="eyebrow">PARTY COMMAND</p><h2>仲間に指示を出す</h2></div><span class="chip">${count} / ${heroes.length}人</span></div><ol class="exp-command-flow"><li class="active">行動を選ぶ</li><li class="${draft?'active':''}">対象を選ぶ</li><li>全員で実行</li></ol><div class="exp-actor-picker" role="group" aria-label="指示する仲間">${heroes.map((h,i)=>`<button type="button" data-action="actor" data-id="${h.id}" class="${h.id===actor.id?'selected':''}" aria-pressed="${h.id===actor.id}"><span class="exp-actor-number">${b.plans[h.id]?'✓':i+1}</span><span><b>${esc(h.name)}</b><small>${b.plans[h.id]?esc(uiPlanName(b.plans[h.id],h)):'行動を選択'}</small></span></button>`).join('')}</div><div class="exp-current-actor">${typeof jobCrestSVG==='function'?jobCrestSVG(actor.job):icon('shield')}<div><b>${esc(actor.name)}</b><small>${esc(DATA.jobs[actor.job].name)} · ${plan?'変更できます':'行動を決めてください'}</small></div></div><h3 class="exp-step-label">1. 行動を選ぶ</h3><div class="exp-basic-commands">${btn(icon('sword')+'通常攻撃'+(globalThis.BRPGFormation?' · '+BRPGFormation.labels[BRPGFormation.range(actor)]:''),'command','data-command="attack"','primary'+chosen('attack'))}${btn(icon('shield')+'防御','command','data-command="defend"',chosen('defend'))}${btn(icon('walk')+'逃走','command','data-command="escape"',chosen('escape'))}</div>${skills.length?`<div class="exp-skill-section"><h3>技・魔法</h3><div class="skill-buttons">${skills.map(sk=>btn(`<b>${esc(sk.name)}</b><small>MANA ${sk.mp} / SP ${sk.sp||0}${globalThis.BRPGFormation?' · '+esc(BRPGFormation.rangeText(actor,sk)):''}</small>`,'command',`data-command="skill" data-skill="${sk.id}" title="${esc(sk.desc||'')}" ${actor.mp<sk.mp||actor.sp<(sk.sp||0)?'disabled':''}`,chosen('skill',sk.id))).join('')}</div></div>`:''}${items.length?`<details class="battle-items" ${draft?.command==='item'?'open':''}><summary>道具を使う <small>所持 ${items.length}種類</small></summary><div class="supply-buttons">${items.map(([id,it])=>btn(`${esc(it.name)} ×${uiCount(id)}`,'command',`data-command="item" data-item="${id}" title="${esc(it.desc)}"`,chosen('item',id))).join('')}</div></details>`:''}${draftControls(actor)}<div class="exp-turn-submit"><p>${draft?'選択中の指示を確定してください。':count===heroes.length?'全員の準備ができました。':`残り${heroes.length-count}人の行動を選択してください。`}</p>${btn('全員の行動を実行 →','execute',draft||count!==heroes.length||battleTimer?'disabled':'','primary wide')}${btn('全員おまかせ入力','template',battleTimer?'disabled':'','exp-template')}</div></section>`;
  };
  exploreScreen = function() {
    const d=s.dungeon;if(!d)return townScreen();
    const battle=!!s.battle, map=worldMap(d.mapId), atSurfaceExit=d.depth===1&&d.x===1&&d.y===1, atStairsUp=d.depth>1&&d.x===1&&d.y===1, atEntrance=atSurfaceExit||atStairsUp, tile=d.map[d.y][d.x];
    const returnPath=typeof findPathToEntrance==='function'?findPathToEntrance(d):null;
    const hazards=globalThis.BRPGFacilities?.ensureFloorHazards(d)||{};
    const known=Object.values(hazards).filter(h=>h.discovered&&!h.disarmed).length;
    if (viewBattle !== s.battle) { viewBattle = s.battle; stageView = battle ? 'enemies' : 'map'; }
    const showEnemies = battle && stageView === 'enemies';
    return `<div class="exp-workspace"><section class="exp-party" aria-label="探索中の仲間"><div class="exp-subheading"><h2>探索中の仲間</h2><small>名前で詳細を開く</small></div>${strip(false)}</section>
      <div class="sectionhead expedition-head"><div><p class="eyebrow">${battle?'ENCOUNTER / TURN '+s.battle.turn:'EXPEDITION / FIELD NOTES'}</p><h1>${esc(map?.name||'忘れられた鉱廊')}<span class="exp-depth">B${d.depth}</span></h1></div><div class="exp-location"><b>${d.steps} <small>歩</small></b><span>地域Lv.${d.level||1} · 素材Q${d.quality||1}</span></div></div>
      <div class="expedition-layout ${battle?'in-battle':''}"><section class="expedition-map"><div class="panel map-panel">
        <div class="exp-map-heading"><span>${icon('compass')}探索地図</span><span>${battle?'戦闘中':atSurfaceExit?'地上出口 · 無料で帰還できます':atStairsUp?`昇降口 · B${d.depth-1}Fへ上れます`:`現在地 ${d.x}, ${d.y}`}</span></div>
        ${battle?`<div class="exp-view-switch" role="group" aria-label="探索表示の切替">${[['map','MAP','exp-map-view'],['enemies','敵','exp-enemy-view']].map(([view,label,panel])=>`<button type="button" id="exp-view-${view}" data-action="exp-stage-view" data-view="${view}" aria-controls="${panel}" aria-pressed="${stageView===view}" class="${stageView===view?'selected':''}">${label}</button>`).join('')}</div>`:''}
        <div class="exp-map-stage">
          <div id="exp-map-view" ${showEnemies?'hidden':''}><canvas id="map" width="936" height="648" role="img" aria-label="探索地図。石造りの出口が入口の1,1。人物が現在地、結晶が採集地点、木箱が宝箱、階段が次の階。未踏の区画は霧で隠れています。"></canvas><div class="exp-map-fog-caption">${battle?'キー: Enter/Space実行 | Tおまかせ | B自動戦闘':'移動: WASD/矢印/クリック | Space: 自動探索 | Enter: 階段/決定 | R: 帰還'}</div></div>
          ${battle?`<section id="exp-enemy-view" class="exp-enemies" aria-label="遭遇した魔物" tabindex="0" ${showEnemies?'':'hidden'}><div class="exp-subheading"><h2>遭遇した魔物</h2><small>${observed()?'同行者が状態を観測中':'現在LIFE・脅威度は未観測'}</small></div>${uiEnemies()}</section>`:''}
        </div>
        <div class="exp-map-legend"><span>${icon('door')}出口</span><span>${icon('gem')}採集</span><span>${icon('chest')}宝箱</span><span>${icon('stairs')}階段</span><span>${icon('shield')}封印</span></div>
        ${!battle?`<div class="exp-manual-controls"><div class="dpad">${btn('↑','step','data-dx="0" data-dy="-1" aria-label="北へ"')}${btn('←','step','data-dx="-1" data-dy="0" aria-label="西へ"')}${btn('↓','step','data-dx="0" data-dy="1" aria-label="南へ"')}${btn('→','step','data-dx="1" data-dy="0" aria-label="東へ"')}</div><div class="exp-tile-action">${tile==='>'?btn(icon('stairs')+'次の階へ','descend','','primary'):(tile==='<'||atStairsUp)?btn(icon('stairs')+`上の階（B${d.depth-1}F）へ`,'ascend','','primary'):tile==='!'?btn(icon('shield')+'地域の主に挑む','boss','','danger'):atSurfaceExit?btn(icon('door')+'街へ帰還','return','','primary'):`<span>移動して周囲を探索</span><small>${known?'既知の地形・危険箇所 '+known+' / ':''}遭遇は移動時に発生します</small>`}</div></div>`:''}
      </div></section><aside class="expedition-side">${controls()}${battle?uiBattlePanel():`<section class="panel exp-return"><p class="eyebrow">${atStairsUp?'WAY UP':'WAY HOME'}</p><h2>${atStairsUp?icon('stairs')+'上の階へ':icon('door')+'街へ帰る'}</h2><p>${atSurfaceExit?'いま地上出口の前にいます。費用を使わずに帰還できます。':atStairsUp?`上の階（B${d.depth-1}F）への昇降口です。徒歩で街へ戻るには1階の地上出口まで戻る必要があります。`:d.depth===1?'地図左上の石の出口まで戻ると、無料で帰還できます。':`昇降口(1,1)まで戻ると上の階へ上れます。街へ帰るには1Fの地上出口まで戻る必要があります。`}</p><div class="exp-return-actions">${atSurfaceExit?btn('出口から街へ帰還','return','','primary'):atStairsUp?btn(icon('stairs')+`昇降口からB${d.depth-1}Fへ上る`,'ascend','','primary'):btn(icon('walk')+(d.depth===1?'出口へ歩いて戻る':'昇降口へ歩いて戻る')+`${returnPath?' / '+returnPath.length+'歩':''}`,'exp-walk-entrance')}${!atSurfaceExit?btn('帰還符で即帰還 / 残'+(s.items.scroll||0),'return',s.items.scroll>0?'':'disabled'):''}${btn('道標で即時帰還 / SP3','instant-return',party().some(h=>h.hp>0&&h.mp>0&&(h.sp??0)>=3&&(h.job==='explorer'||h.job==='guide'))||s.ext?.facilityRules?.owned?.includes('instant_return')?'':'disabled')}</div></section><details class="panel exp-provisions"><summary>旅の道具を使う</summary>${uiFieldSupplies()}</details>`}<section class="panel expedition-log"><div class="exp-log-header"><p class="eyebrow">RECENT LOG</p><button type="button" class="exp-log-toggle" data-action="toggle-log-expand">${s.ext?.logExpanded?'最新のみ表示':`過去の記録を展開 (${s.log.length}件)`}</button></div>${resumeWait!==null?'<p class="exp-victory-note">勝利しました。1.5秒後に探索を再開します。</p>':''}${battle&&s.battle.lastTurnDigest?.length?`<div class="battle-digest">${s.battle.lastTurnDigest.map(line=>`<p>${line}</p>`).join('')}</div>`:''}${logHTML(s.ext?.logExpanded?100:6)}</section></aside></div></div>`;
  };
  battleScreen=exploreScreen;

  const baseHandle=handleAction;
  handleAction=function(event) {
    const button=event.target.closest('[data-action]');if(!button||button.disabled)return;
    const action=button.dataset.action;
    if(action==='toggle-log-expand') {
      s.ext ??= {};
      s.ext.logExpanded = !s.ext.logExpanded;
      render();
      return;
    }
    if(action==='exp-stage-view') {
      if(!s.battle || !['map','enemies'].includes(button.dataset.view))return;
      stageView=button.dataset.view;render();
      $('exp-view-'+stageView)?.focus?.({preventScroll:true});return;
    }
    if(action==='command') {
      if(!s.battle)return;
      stopAll();
      const actor=alive().find(h=>h.id===s.battle.actor);if(!actor)return;
      commandDraft={battle:s.battle,turn:s.battle.turn,actor:actor.id,command:button.dataset.command,skill:button.dataset.skill,item:button.dataset.item,target:null};
      render();return;
    }
    if(action==='target'&&s.battle) {
      stopAll();
      const actor=alive().find(h=>h.id===s.battle.actor),draft=actor&&draftFor(actor),id=Number(button.dataset.id);
      if(draft&&commandTarget(draft)==='enemy'&&targetOptions(draft).some(o=>o.id===id)){draft.target=id;s.battle.target=id;}
      else tell('先に行動を選び、その行動の対象を指定してください。');
      render();return;
    }
    if(action==='exp-command-target'||action==='exp-command-confirm') {
      if(!s.battle)return;
      stopAll();
      const actor=alive().find(h=>h.id===s.battle.actor),draft=actor&&draftFor(actor);if(!draft)return;
      const kind=commandTarget(draft),options=targetOptions(draft);
      if(action==='exp-command-target') {
        const id=Number(button.dataset.id);if(options.some(o=>o.id===id)){draft.target=id;if(kind==='enemy')s.battle.target=id;else if(kind==='ally')s.battle.allyTarget=id;}
        render();return;
      }
      const target=kind==='self'||kind==='allAllies'?actor.id:kind==='allEnemies'?options[0]?.id:draft.target;
      if(target==null||options.length&&!options.some(o=>o.id===target)||['ally','enemy'].includes(kind)&&!options.length)return;
      commandDraft=null;planCommand(draft.command,target,draft.skill,draft.item);return;
    }
    if(['actor','execute','template'].includes(action))commandDraft=null;
    if(action==='exp-auto-mode') { stopAll();selectedMode=button.dataset.mode;render();return; }
    if(action==='exp-auto-toggle') {
      if(automaticRunning()){stopAll();tell('自動操作を停止しました。');render();return;}
      const mode=s.battle&&selectedMode==='walk'?'battle':selectedMode;
      if(mode==='battle'){if(s.battle)startBattleTimer();render();return;}
      if(!s.dungeon||mode==='walk'&&s.battle)return;
      toggleExpedition();walkOnly=mode==='walk'&&s.autoExpedition;render();return;
    }
    if(['actor','execute','template','target','step','exp-walk-entrance','return','instant-return','descend','ascend','boss','use-item'].includes(action))stopAll();
    if(action==='ascend'){globalThis.ascend?.();return;}
    if(action==='exp-walk-entrance'){globalThis.walkTowardEntrance?.();return;}
    return baseHandle(event);
  };
  function findPathToTile(d, tx, ty) {
    if (!d || (d.x === tx && d.y === ty)) return [];
    if (!d.map[ty]?.[tx] || d.map[ty][tx] === '#') return null;
    const queue = [[d.x, d.y, []]];
    const visited = new Set([`${d.x},${d.y}`]);
    while (queue.length) {
      const [cx, cy, path] = queue.shift();
      if (cx === tx && cy === ty) return path;
      for (const [dx, dy] of DIRS) {
        const nx = cx + dx, ny = cy + dy, key = `${nx},${ny}`;
        if (d.map[ny]?.[nx] && d.map[ny][nx] !== '#' && !visited.has(key)) {
          visited.add(key);
          queue.push([nx, ny, [...path, [dx, dy]]]);
        }
      }
    }
    return null;
  }
  function walkTowardTile(tx, ty) {
    const d = s.dungeon;
    if (!d || s.battle) return;
    if (d.x === tx && d.y === ty) return;
    const allowed = typeof globalThis.BRPGFacilities?.canClickWalk === 'function'
      ? globalThis.BRPGFacilities.canClickWalk()
      : (party().some(h => h.job === 'explorer') || s.books?.includes('survey_walk'));
    if (!allowed) {
      tell('地図クリック歩行には探索者等の支援職の同行、または高Lv帯の「測量踏破の手引書」が必要です。');
      render();
      return;
    }
    const path = findPathToTile(d, tx, ty);
    if (!path || !path.length) {
      tell('その地点への安全な通路が見つかりません。');
      render();
      return;
    }
    stopAll();
    let moved = 0;
    for (const [dx, dy] of path.slice(0, 5)) {
      if (!s.dungeon || s.battle) break;
      step(dx, dy, false);
      moved++;
      if (s.dungeon && s.dungeon.x === tx && s.dungeon.y === ty) {
        tell(`🎯 指定地点（${tx}, ${ty}）に到着しました。`);
        break;
      }
    }
    if (s.dungeon && !s.battle && (s.dungeon.x !== tx || s.dungeon.y !== ty)) {
      const rem = findPathToTile(s.dungeon, tx, ty);
      tell(`🚶 指定地点（${tx}, ${ty}）へ向かって ${moved}歩 移動（残り ${rem ? rem.length : '?'}歩）。再クリックで継続。`);
    }
    render();
  }
  globalThis.walkTowardTile = walkTowardTile;
  globalThis.BRPGExplorationUI={isWaiting:()=>resumeWait!==null,cancel:()=>stopAll(),walkTowardTile,findPathToTile};

  if (typeof document !== 'undefined') {
    document.addEventListener('click', event => {
      const canvas = event.target?.closest?.('#map');
      if (!canvas || !s.dungeon || s.battle || typeof canvas.getBoundingClientRect !== 'function') return;
      const rect = canvas.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      const px = (event.clientX - rect.left) * scaleX;
      const py = (event.clientY - rect.top) * scaleY;
      const ox = 50, oy = 34, z = 44;
      const tx = Math.floor((px - ox) / z);
      const ty = Math.floor((py - oy) / z);
      if (tx >= 0 && tx < 19 && ty >= 0 && ty < 13) {
        walkTowardTile(tx, ty);
      }
    });

    document.addEventListener('keydown', event => {
      if (['INPUT', 'SELECT', 'TEXTAREA', 'BUTTON'].includes(event.target.tagName)) return;
      if ($('guide')?.open || $('character-dialog')?.open || $('save-dialog')?.open) return;
      const key = event.key;
      if (s.dungeon && !s.battle) {
        if (key === ' ' || key === 'e' || key === 'E') {
          event.preventDefault();
          toggleExpedition();
          render();
          return;
        }
        if (key === 'Enter' || key === 'f' || key === 'F') {
          event.preventDefault();
          const d = s.dungeon, tile = d.map[d.y]?.[d.x];
          if (tile === '>') { descend(); return; }
          if (tile === '<' || (d.depth > 1 && d.x === 1 && d.y === 1)) { ascend(); return; }
          if (tile === '!') { bossChallenge(); return; }
          if (d.depth === 1 && d.x === 1 && d.y === 1) { returnTown(); return; }
          return;
        }
        if (key === 'r' || key === 'R' || key === 'h' || key === 'H') {
          event.preventDefault();
          if (s.dungeon.depth === 1 && s.dungeon.x === 1 && s.dungeon.y === 1) returnTown();
          else if (s.dungeon.depth > 1 && s.dungeon.x === 1 && s.dungeon.y === 1) ascend();
          else globalThis.walkTowardEntrance?.();
          return;
        }
      } else if (s.battle) {
        if (key === 'Enter' || key === ' ') {
          event.preventDefault();
          if (alive().every(h => s.battle.plans[h.id])) executeTurn();
          return;
        }
        if (key === 't' || key === 'T' || key === 'a' || key === 'A') {
          event.preventDefault();
          autoPlans();
          render();
          return;
        }
        if (key === 'b' || key === 'B') {
          event.preventDefault();
          toggleAutoBattle();
          return;
        }
      }
    });
  }

  // Small painted primitives keep the map legible without a downloaded tile set.
  draw=function() {
    const canvas=$('map'),d=s.dungeon;if(!canvas||!d)return;
    const c=canvas.getContext('2d');if(!c)return;
    const W=936,H=648,z=44,ox=50,oy=34;
    c.fillStyle='#0c171b';c.fillRect(0,0,W,H);
    const floorColors=['#25383b','#293d40','#273b3e','#2b3e40'];
    const poly=(pts,fill,stroke)=>{c.beginPath();pts.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();c.fillStyle=fill;c.fill();if(stroke){c.strokeStyle=stroke;c.lineWidth=1.2;c.stroke();}};
    const circle=(x,y,r,fill)=>{c.beginPath();c.arc(x,y,r,0,Math.PI*2);c.fillStyle=fill;c.fill();};
    const line=(x1,y1,x2,y2,color,width=1)=>{c.strokeStyle=color;c.lineWidth=width;c.beginPath();c.moveTo(x1,y1);c.lineTo(x2,y2);c.stroke();};
    const rect=(x,y,w,h,fill)=>{c.fillStyle=fill;c.fillRect(x,y,w,h);};
    const art=globalThis.BRPGMapArt;
    const biome=art?.getBiome(d)||'forest';

    function arch(x,y){
      rect(x+2,y+1,40,42,'#294b49');
      c.strokeStyle='#c6bf9f';c.lineWidth=7;c.beginPath();c.moveTo(x+8,y+39);c.lineTo(x+8,y+19);c.arc(x+22,y+19,14,Math.PI,0);c.lineTo(x+36,y+39);c.stroke();
      c.fillStyle='#88c8b4';c.beginPath();c.arc(x+22,y+19,10,Math.PI,0);c.lineTo(x+32,y+40);c.lineTo(x+12,y+40);c.closePath();c.fill();
      rect(x+8,y+36,28,4,'#d6d2b2');rect(x+5,y+41,34,3,'#71877a');
      for(let a=0;a<3;a++){line(x+4,y+24+a*6,x+11,y+24+a*6,'#66776b');line(x+33,y+24+a*6,x+40,y+24+a*6,'#66776b');}
      line(x+17,y+24,x+27,y+24,'#e8fbe7',2);line(x+23,y+20,x+27,y+24,'#e8fbe7',2);line(x+23,y+28,x+27,y+24,'#e8fbe7',2);
    }
    for(let y=0;y<d.map.length;y++)for(let x=0;x<d.map[y].length;x++){
      const px=ox+x*z,py=oy+y*z,t=d.map[y][x],seen=d.seen[y]?.[x];
      if(!seen){
        const drawnFog=art?.drawCell(c,'structures',4,4,px,py,z,z);
        if(!drawnFog){rect(px,py,z,z,'#111e23');if((x+y)%3===0)circle(px+22,py+22,1,'#26383c');}
        continue;
      }
      const floorCol=(x*11+y*7)%4;
      const drawnFloor=art?.drawCell(c,biome,floorCol,0,px,py,z,z);
      if(!drawnFloor)rect(px,py,z,z,floorColors[floorCol]);

      if(t==='#'){
        const wallCol=(x*3+y*5)%5;
        const drawnWall=art?.drawCell(c,biome,wallCol,1,px,py,z,z);
        if(!drawnWall){
          rect(px,py+6,z,z-6,'#15272b');rect(px+1,py+1,z-2,z-10,'#46534e');rect(px+2,py+2,z-4,4,'#697063');
          rect(px+3,py+9,20,11,'#515d54');rect(px+25,py+9,16,11,'#424f49');rect(px+3,py+23,12,9,'#47584e');rect(px+17,py+23,24,9,'#566153');
          if((x*3+y)%5===0){poly([[px+5,py+9],[px+11,py+5],[px+15,py+12],[px+10,py+15]],'#65764d');line(px+29,py+25,px+34,py+29,'#82906b');}
        }
        continue;
      }
      if(!drawnFloor){
        line(px+1,py+43,px+43,py+43,'#172b2f');line(px+43,py+1,px+43,py+43,'#172b2f');
        if((x+y)%3===0){line(px+7,py+9,px+14,py+10,'#4b5a55');line(px+28,py+32,px+33,py+29,'#51605a');}
      }
      if(x===1&&y===1){
        if(d.depth===1){
          const drawnArch=art?.drawCell(c,'structures',0,0,px,py,z,z);
          if(!drawnArch)arch(px,py);
        }else{
          const drawnStairsUp=art?.drawCell(c,'structures',2,0,px,py,z,z);
          if(!drawnStairsUp){
            rect(px+5,py+6,34,34,'#14282c');
            for(let i=0;i<5;i++){rect(px+7+i*3,py+9+i*5,30-i*6,5,'#9aa99c');rect(px+7+i*3,py+13+i*5,30-i*6,1,'#536d69');}
            line(px+5,py+7,px+5,py+37,'#88c8b4',2);line(px+38,py+7,px+38,py+37,'#88c8b4',2);
          }
        }
      }
      if(t==='<'){
        const drawnStairsUp=art?.drawCell(c,'structures',2,0,px,py,z,z);
        if(!drawnStairsUp){
          rect(px+5,py+6,34,34,'#14282c');
          for(let i=0;i<5;i++){rect(px+7+i*3,py+9+i*5,30-i*6,5,'#9aa99c');rect(px+7+i*3,py+13+i*5,30-i*6,1,'#536d69');}
        }
      }
      if(t==='o'){
        const drawnNode=art?.drawCell(c,'structures',2,2,px,py,z,z);
        if(!drawnNode){
          circle(px+22,py+29,14,'#192e31');poly([[px+10,py+29],[px+17,py+10],[px+23,py+17],[px+18,py+34]],'#62b8bd','#a6e3d6');poly([[px+21,py+32],[px+24,py+7],[px+31,py+14],[px+28,py+34]],'#9bd3c3','#d0eee0');poly([[px+28,py+32],[px+34,py+20],[px+38,py+26],[px+34,py+36]],'#5d9ea6','#94cdc6');
        }
      }
      if(t==='c'){
        const drawnChest=art?.drawCell(c,'structures',2,1,px,py,z,z);
        if(!drawnChest){
          rect(px+7,py+18,30,20,'#17272b');rect(px+8,py+17,28,18,'#9c693f');rect(px+9,py+12,26,9,'#c39559');line(px+9,py+21,px+35,py+21,'#5b3825',2);rect(px+11,py+13,3,21,'#d7bb75');rect(px+30,py+13,3,21,'#d7bb75');rect(px+20,py+21,5,7,'#f6d58c');
        }
      }
      if(t==='>'){
        const drawnStairs=art?.drawCell(c,'structures',2,0,px,py,z,z);
        if(!drawnStairs){
          rect(px+5,py+6,34,34,'#14282c');for(let i=0;i<5;i++){rect(px+7+i*3,py+9+i*5,30-i*6,5,'#9aa99c');rect(px+7+i*3,py+13+i*5,30-i*6,1,'#536d69');}line(px+5,py+7,px+5,py+37,'#d3cfac',2);line(px+38,py+7,px+38,py+37,'#d3cfac',2);
        }
      }
      if(t==='!'){
        const drawnBoss=art?.drawCell(c,'structures',0,1,px,py,z,z);
        if(!drawnBoss){
          circle(px+22,py+23,17,'#3b293d');c.strokeStyle='#b585c3';c.lineWidth=2;c.beginPath();c.arc(px+22,py+23,14,0,Math.PI*2);c.stroke();poly([[px+22,py+8],[px+30,py+23],[px+22,py+36],[px+14,py+23]],'#bba0ca','#eed4df');
        }
      }
      const hz=d.hazards?.[`${x},${y}`];
      if(hz?.discovered&&!hz.disarmed){
        if(hz.type==='water'){
          const drawnHz=art?.drawCell(c,'hazards',2,1,px,py,z,z);
          if(!drawnHz){rect(px+2,py+2,40,40,'#285663');for(let i=0;i<3;i++)line(px+7,py+12+i*10,px+31,py+10+i*10,'#6ca5ae',2);}
        }
        else if(hz.type==='cliff'){
          const drawnHz=art?.drawCell(c,'hazards',0,2,px,py,z,z);
          if(!drawnHz){for(let i=0;i<3;i++)poly([[px+4+i*12,py+34],[px+10+i*12,py+12],[px+16+i*12,py+34]],'#879184','#b1b6a1');}
        }
        else if(hz.type==='secret'){
          const drawnHz=art?.drawCell(c,'hazards',4,2,px,py,z,z);
          if(!drawnHz){rect(px+8,py+7,28,31,'#57605a');line(px+22,py+8,px+22,py+37,'#c6baa1',2);circle(px+26,py+24,2,'#d1c292');}
        }
        else {
          const drawnHz=art?.drawCell(c,'hazards',0,0,px,py,z,z);
          if(!drawnHz){poly([[px+22,py+8],[px+37,py+35],[px+7,py+35]],'#b37d47','#eccd81');rect(px+21,py+17,3,9,'#263135');circle(px+22,py+30,2,'#263135');}
        }
      }
    }
    for(const corpse of s.corpses){
      const f=corpse.floor;if(f.identity!==d.identity||f.depth!==d.depth||!d.seen[f.y]?.[f.x])continue;
      const x=ox+f.x*z,y=oy+f.y*z;
      const drawnCorpse=art?.drawCell(c,'structures',1,3,x,y,z,z);
      if(!drawnCorpse){rect(x+11,y+16,23,19,'#947657');line(x+12,y+18,x+30,y+33,'#d4c9ad',3);line(x+31,y+18,x+13,y+33,'#d4c9ad',3);}
    }
    // EXIT remains labelled even while the party stands inside the doorway.
    const ex=ox+z+22,ey=oy+z;
    if(d.seen[1]?.[1]){rect(ex-24,ey-19,48,17,'#b0d3b5');c.fillStyle='#18352e';c.font='bold 11px sans-serif';c.textAlign='center';c.fillText('EXIT',ex,ey-7);line(ex,ey-2,ex,ey+2,'#b0d3b5',2);}
    const px=ox+d.x*z+22+(d.x===1&&d.y===1?11:0),py=oy+d.y*z+22;
    const glow=c.createRadialGradient(px,py,3,px,py,55);glow.addColorStop(0,'#e1c48044');glow.addColorStop(1,'#e1c48000');c.fillStyle=glow;c.fillRect(px-55,py-55,110,110);
    const leaderCell=d.facing===0?[2,4]:d.facing===2?[0,4]:[1,4];
    const drawnParty=art?.drawCell(c,'structures',leaderCell[0],leaderCell[1],px-22,py-22,z,z);
    if(!drawnParty){
      circle(px,py+13,11,'#122327');c.strokeStyle='#e4bf75';c.lineWidth=2;c.beginPath();c.arc(px,py+2,18,0,Math.PI*2);c.stroke();
      poly([[px-9,py+12],[px-6,py-3],[px+6,py-3],[px+9,py+12]],'#bd8750','#e2c587');rect(px-5,py+1,10,10,'#405a65');circle(px,py-8,6,'#e7c6a0');poly([[px-7,py-9],[px-3,py-16],[px+4,py-15],[px+7,py-9]],'#78958c','#c2cbb0');rect(px-9,py+1,5,10,'#c4ae74');
    }
    const [dx,dy]=DIRS[d.facing]||DIRS[1];line(px+dx*10,py+dy*10,px+dx*23,py+dy*23,'#f2d590',2);circle(px+dx*23,py+dy*23,3,'#ffe6a4');
    c.textAlign='center';c.font='10px sans-serif';c.fillStyle='#708987';for(let x=1;x<19;x+=2)c.fillText(String(x),ox+x*z+22,H-13);
  };
})();
