/* Character rules derived from the October 19 Obsidian additions. */
const ATTRIBUTE_NAMES={STR:'力',INT:'知力',AGI:'敏捷',VIT:'体力',DEX:'器用さ',WIZ:'知恵',MGR:'魔法抵抗',CHR:'魅力'};
function baseAttributes(h){const j=DATA.jobs[h.job];return j.attributes||{STR:j.atk,INT:j.mag,AGI:j.speed,VIT:10,DEX:10,WIZ:10,MGR:10,CHR:10};}
function attributes(h){const b=baseAttributes(h);return Object.fromEntries(Object.keys(ATTRIBUTE_NAMES).map(k=>[k,b[k]+h.lv-1]));}
function maxSP(h){return 20+attributes(h).VIT*2;}
function syncHero(h){h.learned??=[];h.jobHistory??=[h.job];if(!h.jobHistory.includes(h.job))h.jobHistory.push(h.job);for(const id of DATA.jobs[h.job].skills||[])if(DATA.skills[id]?.level<=h.lv&&!h.learned.includes(id))h.learned.push(id);h.sp=Number.isFinite(h.sp)?Math.min(maxSP(h),Math.max(0,h.sp)):maxSP(h);}
function canJob(h,id){const j=DATA.jobs[id];if(!j||h.lv<j.unlock)return false;if(h.job===id)return true;const r=j.requirements;if(!r)return true;return(h.jobHistory||[h.job]).includes(r.job)&&(h.learned||[]).includes(r.skill);}
function jobRequirementText(j){const r=j.requirements;return 'Lv.'+j.unlock+(r?' / '+DATA.jobs[r.job].name+'経験 ＋ '+DATA.skills[r.skill].name+'習得':' / 基本職');}
heroSkills=function(h){return [...new Set([...(DATA.jobs[h.job].skills||[]),...(h.learned||[])])].map(id=>({id,...DATA.skills[id]})).filter(k=>k.name);};
uiSkillList=heroSkills;
const originalStats=stats;
stats=function(h){const st=originalStats(h),a=attributes(h),base=baseAttributes(h),fatigue=h.sp===0?.5:1;st.speed=a.AGI;st.sp=maxSP(h);st.atk=Math.max(1,Math.round(a.STR*1.05)+(h.lv-1)+gearValue(item(h.weapon))+Math.floor(a.DEX/12));st.mag=Math.max(1,a.INT+(h.lv-1)+(item(h.weapon)&&DATA.materials[item(h.weapon).material].category==='gem'?gearValue(item(h.weapon)):0));for(const k of ['atk','def','mag','speed'])st[k]=Math.max(1,Math.floor(st[k]*fatigue));return st;};
function walkDelay(){const avg=party().reduce((n,h)=>n+attributes(h).AGI,0)/party().length,exhausted=party().some(h=>h.sp===0);return Math.round(Math.max(200,900-avg*20)*(exhausted?2:1));}
function partyCharm(){return Math.max(...party().map(h=>attributes(h).CHR));}
function buyFactor(){return Math.max(.75,1-partyCharm()*.002);}
function sellFactor(){return Math.min(1.5,1+partyCharm()*.003);}
function gearRequirements(g){return{[g.method==='magic'?'WIZ':g.slot==='armor'?'VIT':'STR']:5+((g.quality||1)-1)*5};}
function canEquip(h,g){return Object.entries(gearRequirements(g)).every(([k,n])=>attributes(h)[k]>=n);}
function gearRequirementText(g){return '必要能力：'+Object.entries(gearRequirements(g)).map(([k,n])=>k+' '+n).join(' / ');}
const oldGearValue=gearValue;
gearValue=function(g){if(!g)return 0;const owner=s.roster.find(h=>h[g.slot]===g.id);return owner&&!canEquip(owner,g)?0:Math.round(oldGearValue(g)*(owner&&g.method==='magic'?1+Math.max(0,attributes(owner).WIZ-10)*.01:1));};
const oldEnchantPower=enchantPower;
enchantPower=function(g){if(!g)return 0;const owner=s.roster.find(h=>h[g.slot]===g.id);return owner&&!canEquip(owner,g)?0:oldEnchantPower(g);};
const originalBars=bars;
bars=function(h){return originalBars(h)+`<div class="numbers"><span>SP ${h.sp??maxSP(h)} / ${maxSP(h)}</span><span>${h.hp<=0?'死亡':h.mp===0?'気絶':h.sp===0?'疲弊：能力半減':''}</span></div><div class="bar sp"><i style="width:${(h.sp??maxSP(h))/maxSP(h)*100}%"></i></div>`;};
const originalCharacter=characterScreen;
characterScreen=function(h){return originalCharacter(h)+`<section class="detail-section"><h3>8つの基礎能力</h3><dl class="stat-grid">${Object.entries(attributes(h)).map(([k,n])=>`<div><dt>${k} · ${ATTRIBUTE_NAMES[k]}</dt><dd>${n}</dd></div>`).join('')}</dl><p>STR：物理成長・武器条件 / INT：魔力成長 / AGI：戦闘順・自動歩行間隔 / VIT：SP・防具条件 / DEX：攻撃補正 / WIZ：道具効果・魔法装備条件 / MGR：魔法被害軽減 / CHR：道具購入・素材売却・逃走。</p><p>自動歩行 ${walkDelay()} ms/歩。各能力はLvごとに+1。SP0で攻撃・防御・魔力・速度半減、歩行間隔2倍。MANA0で行動不能。装備条件不足時は装備効果0。</p>${['weapon','armor'].map(k=>{const g=item(h[k]);return g?'<p>'+esc(gearName(g))+' / '+gearRequirementText(g)+(canEquip(h,g)?' ✓':' 条件不足')+'</p>':'';}).join('')}<h3>転職条件</h3>${Object.entries(DATA.jobs).map(([id,j])=>`<p>${esc(j.name)}：${esc(jobRequirementText(j))} ${canJob(h,id)?'✓ 転職可能':'未達成'}</p>`).join('')}</section>`;};
const oldSkillText=uiSkillText;
uiSkillText=function(sk){return oldSkillText(sk)+' / SP '+(sk.sp||0);};
function reserveSettings(){s.reserve??={mode:'percent',life:25,mana:20,sp:15};return s.reserve;}
function belowReserve(h,key){const r=reserveSettings(),value=key==='life'?h.hp:key==='mana'?h.mp:h.sp,max=key==='life'?stats(h).hp:key==='mana'?stats(h).mp:maxSP(h);return value<=(r.mode==='absolute'&&unlocked('precise')?r[key]:max*r[key]/100);}
const oldAutoPlans=autoPlans;
autoPlans=function(){oldAutoPlans();if(!s.battle||!s.battleRules.includes('reserve')||!unlocked('reserve'))return;for(const h of alive()){const p=s.battle.plans[h.id];if(belowReserve(h,'life'))s.battle.plans[h.id]={command:'escape',target:0};else if(p.command==='skill'&&(belowReserve(h,'mana')||belowReserve(h,'sp')))s.battle.plans[h.id]={command:'attack',target:enemyAlive()[0].key};}};
const oldRulesScreen=rulesScreen;
rulesScreen=function(){const r=reserveSettings();return oldRulesScreen()+`<section class="panel section-space"><h2>残量を見て行動を変える</h2><p>残量判断書（Lv4）で有効化。LIFEが閾値以下なら逃走、MANA/SPが閾値以下なら技を控え通常攻撃。精密判断書（Lv8）で残り1などの絶対値を指定可能。</p><label>判定方式 <select data-reserve="mode" ${!unlocked('reserve')?'disabled':''}><option value="percent" ${r.mode==='percent'?'selected':''}>割合（%）</option><option value="absolute" ${r.mode==='absolute'?'selected':''} ${!unlocked('precise')?'disabled':''}>絶対値</option></select></label>${['life','mana','sp'].map(k=>`<label>${k.toUpperCase()} <input type="number" min="0" max="${r.mode==='percent'?100:9999}" value="${r[k]}" data-reserve="${k}" ${!unlocked('reserve')?'disabled':''}></label>`).join('')}</section>`;};
const initialBoot=boot;
function regionBoss(mapId){return DATA.bosses?.[mapId]||DATA.boss;}
const oldEnemyStatsAt=enemyStatsAt;
enemyStatsAt=function(e,level){const isBoss=e.id===DATA.boss.id||Object.values(DATA.bosses||{}).some(b=>b.id===e.id);if(!isBoss||e.id===DATA.boss.id)return oldEnemyStatsAt(e,level);const l=Math.max(0,level-1);return{...e,level,hp:Math.round(e.hp*(1+l*.28)),maxhp:Math.round(e.hp*(1+l*.28)),atk:Math.round(e.atk+l*3.5),def:Math.round(e.def+l*.75),mag:Math.round(e.mag+l*2.4),speed:e.speed+Math.floor(l/3),xp:Math.round(e.xp*(1+l*.08)),gold:Math.round(e.gold*(1+l*.05))};};
const oldMakeFloor=makeFloor;
makeFloor=function(map,seed,depth){const f=oldMakeFloor(map,seed,depth),r=rng((seed+depth*13337)>>>0),open=['forest','desert','snow','canopy','battlefield','celestial'].includes(map.biome),extra=open?14:6;for(let i=0;i<extra;i++){const x=2+Math.floor(r()*15),y=2+Math.floor(r()*9);if(f.map[y][x]==='#'&&((f.map[y][x-1]!=='#'&&f.map[y][x+1]!=='#')||(f.map[y-1][x]!=='#'&&f.map[y+1][x]!=='#')))f.map[y][x]=r()<.16?'o':'.';}return f;};
const oldEncounter=encounter;
encounter=function(boss=false){if(!boss)return oldEncounter(false);const d=s.dungeon;if(!d||s.battle)return;stopWalk();const bDef=regionBoss(d.mapId),foe={...enemyStatsAt(bDef,d.level),key:0,poison:0,counted:false};s.battle={enemies:[foe],boss:true,turn:1,plans:{},actor:alive()[0].id,target:0,cover:false,rally:0};d.sinceBattle=0;s.view='explore';const r=s.research[foe.id]??={encounters:0,kills:0,level:d.level};r.encounters++;r.level=d.level;tell(foe.name+'が現れた！');if(s.autoExpedition)startBattleTimer();render();};
const baseGearValue=oldGearValue;
gearValue=function(g){if(!g||!g.dur)return 0;const owner=s.roster.find(h=>h[g.slot]===g.id);if(owner&&!canEquip(owner,g))return 0;let v=baseGearValue(g);if(g.material==='mithril')v=Math.round(v*(g.method==='magic'?.55:1.2));if(g.material==='adamant'||g.material==='stariron')v=Math.round(v*(g.method==='physical'&&(g.quality||1)>=6?1.35:g.method==='physical'?.85:1.15));if(g.material==='tungsten'&&g.method==='magic')v=Math.round(v*1.15);if(owner&&g.method==='magic')v=Math.round(v*(1+Math.max(0,attributes(owner).WIZ-10)*.01));return Math.max(1,v);};
const baseEnchantPower=oldEnchantPower;
enchantPower=function(g){if(!g?.enchant||!g.dur)return 0;const owner=s.roster.find(h=>h[g.slot]===g.id);if(owner&&!canEquip(owner,g))return 0;let v=baseEnchantPower(g);if(g.material==='mithril'&&g.method==='physical')v=Math.round(v*1.45);if((g.material==='adamant'||g.material==='stariron')&&g.method==='physical'&&(g.quality||1)>=6)v=Math.round(v*1.3);return v;};
const oldAllyDamage=allyDamage;
allyDamage=function(h,power,magic=false,guarding=false){const armor=item(h.armor);if(magic&&armor?.dur&&armor.material==='mithril'&&armor.method==='physical')power=Math.max(3,Math.round(power*.78));return oldAllyDamage(h,power,magic,guarding);};
const oldVictory=victory;
victory=function(){const b=s.battle,d=s.dungeon;if(b&&d){for(const e of b.enemies){if(DATA.equipmentSources?.includes(e.id)&& (b.boss||random()<.22)){const slot=random()<.55?'weapon':'armor',craftables=Object.keys(DATA.materials).filter(k=>DATA.materials[k].craftable&&DATA.materials[k].rank<=Math.max(2,Math.ceil(d.level/18)+2)),mat=e.drop&&DATA.materials[e.drop]?.craftable?e.drop:pick(craftables)||'iron',method=mat==='mithril'?'physical':random()<.35?'magic':'physical',maxDur=method==='physical'?110:75,dur=Math.max(25,Math.round(maxDur*(.55+random()*.35))),g={id:s.nextGear++,material:mat,slot,method,enchant:b.boss&&random()<.5?pick(Object.keys(DATA.enchants).filter(k=>(DATA.enchants[k].slot||'weapon')===slot)):null,quality:d.quality||1,dur,maxDur};s.gear.push(g);note('戦利品として'+gearName(g)+'（耐久'+dur+'/'+maxDur+'）を回収！');}}}oldVictory();};
const reserveAutoPlans=autoPlans;
autoPlans=function(){reserveAutoPlans();const b=s.battle;if(!b)return;const poisoned=alive().find(h=>h.poison>0);if(poisoned&&s.battleRules.includes('cleanse_rule')&&unlocked('cleanse_rule')){for(const h of alive()){const p=b.plans[h.id];if(p?.command!=='attack')continue;const sk=heroSkills(h).find(k=>k.kind==='cleanse'&&k.level<=h.lv&&k.mp<=h.mp&&(k.sp||0)<=h.sp);if(sk){b.plans[h.id]={command:'skill',skill:sk.id,target:poisoned.id};break;}const it=['antidote','purewater'].find(id=>s.items[id]>0);if(it){b.plans[h.id]={command:'item',item:it,target:poisoned.id};break;}}}if(enemyAlive().length>=2&&s.battleRules.includes('aoe_rule')&&unlocked('aoe_rule')){for(const h of alive()){const p=b.plans[h.id];if(p?.command!=='attack')continue;const aoe=heroSkills(h).find(k=>k.target==='allEnemies'&&['attack','damage','poison'].includes(k.kind)&&k.level<=h.lv&&k.mp<h.mp&&(k.sp||0)<=h.sp&&!belowReserve(h,'mana')&&!belowReserve(h,'sp'));if(aoe)b.plans[h.id]={command:'skill',skill:aoe.id,target:enemyAlive()[0].key};}}};
function partyPresets(){s.presets??={};return s.presets;}
function savePreset(slot){if(!townOnly())return;partyPresets()[slot]={active:[...s.active],rows:Object.fromEntries(s.roster.map(h=>[h.id,h.row]))};tell('編成セット'+slot+'を保存した。');render();}
function loadPreset(slot){if(!townOnly())return;const p=partyPresets()[slot];if(!p){tell('編成セット'+slot+'は未保存です。');return render();}const valid=p.active.filter(id=>s.roster.some(h=>h.id===id)).slice(0,6);if(!valid.length)return;s.active=valid;for(const h of s.roster)if(p.rows?.[h.id])h.row=p.rows[h.id];tell('編成セット'+slot+'を呼び出した。');render();}
const oldPartyScreen=partyScreen;
partyScreen=function(){const pr=partyPresets();return `<section class="panel" style="margin-bottom:18px"><div class="row between"><h2>編成セット保存・切替</h2><span class="muted">探索用・ボス戦用などの隊列と参加メンバーを即座に切り替え</span></div><div class="actions">${[1,2,3].map(n=>`${btn('セット'+n+'に保存','save-preset',`data-slot="${n}"`)}${btn('セット'+n+'を呼出'+(pr[n]?' ('+pr[n].active.length+'人)':' (空)'),'load-preset',`data-slot="${n}" ${pr[n]?'':'disabled'}`,'primary')}`).join('')}</div></section>`+oldPartyScreen();};
const oldJournalScreen=journalScreen;
journalScreen=function(){const extra=Object.values(DATA.bosses||{}).filter(b=>b.id!==DATA.boss.id&&!DATA.enemies.some(e=>e.id===b.id));DATA.enemies.push(...extra);try{return oldJournalScreen();}finally{DATA.enemies.length-=extra.length;}};
boot=function(){document.addEventListener('click',e=>{const b=e.target.closest('[data-action]');if(!b||b.disabled)return;if(b.dataset.action==='save-preset')savePreset(Number(b.dataset.slot));if(b.dataset.action==='load-preset')loadPreset(Number(b.dataset.slot));});document.addEventListener('change',e=>{const k=e.target.dataset.reserve;if(!k||!unlocked('reserve'))return;const r=reserveSettings();if(k==='mode'){if(e.target.value==='absolute'&&!unlocked('precise'))return;r.mode=e.target.value;}else r[k]=Math.max(0,Math.min(r.mode==='percent'?100:9999,Number(e.target.value)||0));render();});initialBoot();};


/* === v3.5 Hack & Slash, 5-Route Craft, 300 Jobs, 400 Monsters & Catalog Integration === */
(() => {
  const CAT = typeof CATALOG !== 'undefined' ? CATALOG : (DATA.catalog || { materials: {}, products: {}, itemTitles: {}, monsters: {}, monsterTitles: {}, jobs: {}, skills: {}, behaviors: {}, crafting: { routes: {}, profiles: {}, classes: {}, techs: {} } });

  const RARITY_DEFS = {
    common: { id: 'common', name: '通常', mult: 1.0, color: '#c2c5c7', bg: '#2e3830' },
    magic: { id: 'magic', name: '魔法', mult: 1.15, color: '#75b7ed', bg: '#1e3547' },
    rare: { id: 'rare', name: '希少', mult: 1.32, color: '#d3a2ed', bg: '#382245' },
    legendary: { id: 'legendary', name: '★伝説', mult: 1.6, color: '#eab967', bg: '#473618' },
    mythic: { id: 'mythic', name: '✦神話', mult: 2.0, color: '#ff8a7a', bg: '#4d1f1b' }
  };

  // v3 Enemy ID -> M0001..M0040 Sprite Sheet Mapping (5 cols x 8 rows)
  const ENEMY_SHEET_MAP = {
    slime: 1, rat: 2, bat: 3, leech: 5, goblin: 8, fungus: 9,
    wisp: 18, spider: 19, skeleton: 17, crab: 16, cavescorpion: 26,
    boar: 27, boss_boar: 27, wolf: 36, frostwolf: 36, voidhound: 29,
    firelizard: 25, hornhare: 13, moth: 11, mummy: 21, drowned: 21
  };

  function monsterThumbHTML(enemyId, mId) {
    let idx = ENEMY_SHEET_MAP[enemyId] || 0;
    if (!idx && mId && /^M00([0-3]\d|40)$/.test(mId)) idx = parseInt(mId.slice(1), 10);
    if (!idx || idx < 1 || idx > 40) return '';
    const col = (idx - 1) % 5, row = Math.floor((idx - 1) / 5);
    const xPct = (col / 4 * 100).toFixed(2), yPct = (row / 7 * 100).toFixed(2);
    return `<div class="monster-thumb" style="background-position:${xPct}% ${yPct}%" title="図鑑シート #${idx}"></div>`;
  }

  function ext() {
    s.ext ??= {};
    s.ext.craftLv ??= 1;
    s.ext.magicCraftLv ??= 1;
    s.ext.enchantLv ??= 1;
    s.ext.craftXp ??= 0;
    s.ext.magicCraftXp ??= 0;
    s.ext.techs ??= ['K01'];
    s.ext.facilities ??= ['手工具', '組立台', '木工刃', '研磨台', '打製台', '裁断具', '縫製具', '成形台'];
    s.ext.unlockedJobIds ??= ['J0001', 'J0011', 'J0021', 'J0051', 'J0151', 'J0211'];
    s.ext.unlockedSkillIds ??= ['SK0001', 'SK0007', 'SK0013', 'SK0031'];
    s.ext.manuals ??= ['B01'];
    s.ext.activeBehaviors ??= ['B01'];
    s.ext.discoveredMonsters ??= {};
    s.ext.discoveredTitles ??= [];
    s.ext.discoveredProducts ??= ['P0001', 'P0002', 'P0031', 'P0061', 'P0181', 'P0211', 'P0331'];
    s.ext.lootCount ??= 0;
    s.ext.pity ??= 0;
    s.ext.selectedRoute ??= 'H';
    s.ext.selectedProduct ??= 'P0002';
    s.ext.marketSeed ??= (s.randomState || 12345) >>> 0;
    s.ext.subJobs ??= {};
    s.ext.alloc ??= {};
    s.ext.freePts ??= {};
    return s.ext;
  }

  // Material bridge between v3 64 materials and S0001..S0265
  const MAT_TO_S = {
    wood: 'S0001', oak: 'S0001', ashwood: 'S0001', willow: 'S0001', ebony: 'S0001', yew: 'S0001', worldbranch: 'S0001',
    bone: 'S0003', abyssalbone: 'S0003', fang: 'S0005', limestone: 'S0006', granite: 'S0009', basalt: 'S0010',
    obsidian: 'S0012', flint: 'S0013', copper: 'S0019', tin: 'S0020', bronze: 'S0023',
    iron: 'S0028', steel: 'S0031', tamahagane: 'S0034', coldsteel: 'S0035', silver: 'S0044', gold: 'S0045',
    titanium: 'S0054', tungsten: 'S0056', meteoric: 'S0067', mithril: 'S0070', orichalcum: 'S0071',
    adamant: 'S0072', stariron: 'S0075', quartz: 'S0098', crystal: 'S0099', amethyst: 'S0102',
    ruby: 'S0107', sapphire: 'S0108', emerald: 'S0109', topaz: 'S0112', diamond: 'S0106',
    amber: 'S0129', spiritstone: 'S0145', godcrystal: 'S0150', hide: 'S0160', wyvernwing: 'S0161',
    silk: 'S0165', shell: 'S0004', chitin: 'S0004', scale: 'S0004'
  };

  function getCatalogMaterial(v3MatKey) {
    const sid = MAT_TO_S[v3MatKey] || 'S0028';
    return CAT.materials[sid] || Object.values(CAT.materials)[0];
  }

  function getCatalogProduct(pid, slotFallback = 'weapon') {
    if (pid && CAT.products[pid]) return CAT.products[pid];
    return slotFallback === 'armor' ? (CAT.products['P0181'] || { id: 'P0181', name: '胸甲', category: '防具', profile: '鎧板', shapeLv: 5 }) : (CAT.products['P0002'] || { id: 'P0002', name: '長剣', category: '武器', profile: '刃体', shapeLv: 5 });
  }

  // 5-Route Craft Evaluation (matches scripts/evaluate_craft.py)
  function evaluate5RouteCraft(v3MatKey, productId, route) {
    const e = ext();
    const cMat = getCatalogMaterial(v3MatKey);
    const prod = getCatalogProduct(productId, s.craftSlot || 'weapon');
    const routeDef = CAT.crafting.routes[route] || { id: route, meaning: route, baseQ: 50, maxQ: 85, tech: ['K01'], equipment: ['手工具'] };
    const profDef = CAT.crafting.profiles[prod.profile] || { routes: { H: 5, F: 20, M: 50, I: 140, X: 220 }, equipment: { H: [], F: [], M: [], I: [], X: [] } };
    const clsDef = CAT.crafting.classes[cMat?.workClass] || { equipment: { H: [], F: [], M: [], I: [], X: [] } };

    const matLv = cMat?.routes?.[route];
    const profLv = profDef.routes?.[route];
    const possible = matLv !== null && matLv !== undefined && profLv !== null && profLv !== undefined;
    const reqLv = possible ? Math.max(matLv, profLv) + (prod.shapeLv || 0) : 999;

    const reqTechs = new Set(routeDef.tech || []);
    if ((route === 'I' || route === 'X') && cMat?.workClass === '高融点金属') reqTechs.add('K10');
    if ((route === 'I' || route === 'X') && cMat?.workClass === '魔法金属') reqTechs.add('K11');
    if (route === 'X' && cMat?.workClass === '神造固体') reqTechs.add('K13');

    const reqEquips = new Set([...(routeDef.equipment || []), ...(profDef.equipment?.[route] || []), ...(clsDef.equipment?.[route] || [])]);
    const townBonusLv = Math.max(0, (currentTown().level - 1));
    const currentSkill = (route === 'M' ? e.magicCraftLv : e.craftLv) + Math.floor(townBonusLv * 0.6);

    const missingTechs = [...reqTechs].filter(k => !e.techs.includes(k) && currentTown().quality < 6);
    const missingEquips = [...reqEquips].filter(eq => !e.facilities.includes(eq) && currentTown().quality < Math.ceil(reqLv / 25));

    const surplus = Math.max(0, currentSkill - reqLv);
    const baseR0 = cMat?.baseResidue ?? 40;
    let residue = 0, manaMult = 1;
    if (route === 'M') {
      const rem = Math.max(0, 60 - surplus);
      const floorR = Math.ceil(baseR0 / 3);
      residue = floorR + Math.floor(((baseR0 - floorR) * rem + 59) / 60);
      manaMult = +(1 + rem / 30).toFixed(2);
    }
    const measureBonus = (e.facilities.includes('精密測定器') || route === 'X') ? 5 : 0;
    const calcQ = Math.min(routeDef.maxQ || 85, (routeDef.baseQ || 50) + Math.floor(surplus / 5) + measureBonus);
    const eta = +((calcQ / 100) * (1 - residue / 100)).toFixed(3);

    return {
      possible: possible && reqLv <= 300,
      canCraft: possible && reqLv <= 300 && currentSkill >= reqLv && missingTechs.length === 0,
      reqLv, currentSkill, missingTechs, missingEquips,
      residue, manaMult, calcQ, eta, cMat, prod, routeDef
    };
  }
  globalThis.evaluate5RouteCraft = evaluate5RouteCraft;

  // Stat Allocation & Sub-Job Bonus
  const prevAttributes = attributes;
  attributes = function(h) {
    const base = prevAttributes(h);
    const e = ext();
    const alloc = e.alloc[h.id] || {};
    const subId = e.subJobs[h.id];
    const subJob = subId ? CAT.jobs[subId] : null;
    for (const k of Object.keys(ATTRIBUTE_NAMES)) {
      base[k] += (alloc[k] || 0);
      if (subJob) {
        // Sub-job from 300 catalog jobs grants level-scaled specialty stat bonus
        const fam = subJob.family || '';
        if (['剣客', '重装', '槍兵', '闘士', '狩人'].some(w => fam.includes(w)) && ['STR', 'VIT', 'DEX'].includes(k)) base[k] += 2 + Math.floor(h.lv / 15);
        else if (['魔導', '術', '学者', '付与', '薬'].some(w => fam.includes(w)) && ['INT', 'WIZ', 'MGR'].includes(k)) base[k] += 2 + Math.floor(h.lv / 15);
        else if (['斥候', '罠', '案内', '曲芸', '商'].some(w => fam.includes(w)) && ['AGI', 'DEX', 'CHR'].includes(k)) base[k] += 2 + Math.floor(h.lv / 15);
        else base[k] += 1;
      }
    }
    // Affix stat bonuses from equipped weapon/armor
    for (const slot of ['weapon', 'armor']) {
      const g = item(h[slot]);
      if (g?.dur && g.bonusStats) {
        for (const [sk, sv] of Object.entries(g.bonusStats)) {
          if (base[sk] !== undefined) base[sk] += sv;
        }
      }
    }
    return base;
  };

  function heroFreePoints(h) {
    const e = ext();
    const spent = Object.values(e.alloc[h.id] || {}).reduce((a, b) => a + b, 0);
    const earned = (h.lv - 1) * 2 + (e.freePts[h.id] || 0);
    return Math.max(0, earned - spent);
  }
  globalThis.heroFreePoints = heroFreePoints;

  // Enhanced Gear Value & Enchant Power with Rarity, Affixes, Titles, 5-Route Q & Residue
  const prevGearValue = gearValue;
  gearValue = function(g) {
    if (!g || !g.dur) return 0;
    let v = prevGearValue(g);
    const rar = RARITY_DEFS[g.rarity || 'common'] || RARITY_DEFS.common;
    v = Math.round(v * rar.mult);
    if (g.craftQ) v = Math.round(v * (0.85 + g.craftQ / 160));
    if (g.affix && DATA.affixes?.[g.affix]) {
      const af = DATA.affixes[g.affix];
      if ((g.slot === 'weapon' && af.stat === 'atk') || (g.slot === 'armor' && af.stat === 'def')) v += af.value;
    }
    if (g.titleBonus) v += g.titleBonus;
    return Math.max(1, v);
  };

  const prevEnchantPower = enchantPower;
  enchantPower = function(g) {
    if (!g?.enchant || !g.dur) return 0;
    let v = prevEnchantPower(g);
    if (g.eta !== undefined) {
      // 5-route transmission rate η = (Q/100)*(1 - R/100)
      v = Math.max(1, Math.round(v * (0.5 + g.eta * 0.9)));
    }
    const rar = RARITY_DEFS[g.rarity || 'common'] || RARITY_DEFS.common;
    return Math.max(1, Math.round(v * rar.mult));
  };

  // Rich Hack & Slash Gear Name with Catalog Titles (400) & Products (540)
  const prevGearName = gearName;
  gearName = function(g) {
    if (!g) return '素手';
    const m = DATA.materials[g.material];
    const rar = RARITY_DEFS[g.rarity || 'common'];
    const rarityPrefix = g.rarity && g.rarity !== 'common' ? `【${rar.name}】` : '';
    const titleStr = g.titleId && CAT.itemTitles[g.titleId] ? CAT.itemTitles[g.titleId].name : (g.affix && DATA.affixes[g.affix] ? DATA.affixes[g.affix].name : '');
    const prodStr = g.productId && CAT.products[g.productId] ? CAT.products[g.productId].name : (m.category === 'stone' ? (g.slot === 'weapon' ? '石ツール' : '石の護具') : (g.slot === 'weapon' ? '武器' : '防具'));
    const routeTag = g.route ? `${g.route}加工` : (g.method === 'magic' ? '魔法加工' : '物理加工');
    const resTag = g.residue ? `・残留${g.residue}%` : '';
    return `${rarityPrefix}${titleStr}${m.name}の${prodStr} Q${g.quality || 1}〈${routeTag}${resTag}〉${g.enchant ? ' / ' + DATA.enchants[g.enchant].name : ''}`;
  };

  // Roll Hack & Slash Loot Item (used for monster drops, chest jackpots, and black market gacha)
  function rollHackSlashGear(level, forceMinRarity = null) {
    const e = ext();
    e.pity = (e.pity || 0) + 1;
    const r = random();
    let rarity = 'common';
    const luckBoost = Math.min(0.25, partyCharm() * 0.004 + level * 0.001);
    if (forceMinRarity === 'legendary' || e.pity >= 15 || r < 0.03 + luckBoost * 0.25) {
      rarity = (level >= 60 && random() < 0.25) ? 'mythic' : 'legendary';
      e.pity = 0;
    } else if (forceMinRarity === 'rare' || r < 0.16 + luckBoost * 0.6) {
      rarity = 'rare';
    } else if (forceMinRarity === 'magic' || r < 0.48 + luckBoost) {
      rarity = 'magic';
    }

    const slot = random() < 0.55 ? 'weapon' : 'armor';
    const maxRank = Math.max(2, Math.min(10, Math.ceil(level / 16) + 2));
    const craftables = Object.keys(DATA.materials).filter(k => DATA.materials[k].craftable && DATA.materials[k].rank <= maxRank);
    const mat = pick(craftables.filter(k => DATA.materials[k].rank >= Math.max(1, maxRank - 3))) || pick(craftables) || 'iron';

    // Pick a level-appropriate Product from 540 dictionary
    const catTarget = slot === 'weapon' ? '武器' : '防具';
    const prodCandidates = Object.values(CAT.products).filter(p => p.category === catTarget && p.minLv <= level + 15 && p.maxLv >= level);
    const prod = prodCandidates.length ? pick(prodCandidates) : getCatalogProduct(null, slot);
    if (prod && !e.discoveredProducts.includes(prod.id)) e.discoveredProducts.push(prod.id);

    // Pick a Title from 400 dictionary if magic or higher
    let titleId = null, titleBonus = 0;
    if (rarity !== 'common') {
      const tCandidates = Object.values(CAT.itemTitles).filter(t => t.minLv <= level + 20 && t.maxLv >= level);
      const tPick = tCandidates.length ? pick(tCandidates) : null;
      if (tPick) {
        titleId = tPick.id;
        if (!e.discoveredTitles.includes(titleId)) e.discoveredTitles.push(titleId);
        titleBonus = rarity === 'mythic' ? 14 : rarity === 'legendary' ? 9 : rarity === 'rare' ? 5 : 2;
      }
    }

    const affixPool = Object.entries(DATA.affixes || {}).filter(([, a]) => a.slot === slot).map(([k]) => k);
    const affix = rarity !== 'common' && affixPool.length ? pick(affixPool) : null;

    // Bonus stats based on rarity
    const bonusStats = {};
    const statKeys = Object.keys(ATTRIBUTE_NAMES);
    const numBonuses = rarity === 'mythic' ? 3 : rarity === 'legendary' ? 2 : rarity === 'rare' ? 1 : 0;
    for (let i = 0; i < numBonuses; i++) {
      const sk = pick(statKeys);
      bonusStats[sk] = (bonusStats[sk] || 0) + Math.max(1, Math.ceil(level / 20)) * (rarity === 'mythic' ? 3 : 2);
    }

    const method = mat === 'mithril' ? 'physical' : random() < 0.38 ? 'magic' : 'physical';
    const route = method === 'magic' ? 'M' : (level >= 150 ? 'X' : level >= 90 ? 'I' : level >= 25 ? 'F' : 'H');
    const quality = Math.min(13, Math.max(1, Math.ceil(level / 22) + (rarity === 'mythic' ? 2 : rarity === 'legendary' ? 1 : 0)));
    const maxDur = method === 'physical' ? 120 + quality * 5 : 85 + quality * 4;
    const dur = Math.max(35, Math.round(maxDur * (0.7 + random() * 0.3)));
    const enchPool = Object.keys(DATA.enchants).filter(k => (DATA.enchants[k].slot || 'weapon') === slot);
    const enchant = (rarity === 'legendary' || rarity === 'mythic' || (rarity === 'rare' && random() < 0.45)) ? pick(enchPool) : null;
    const craftQ = Math.min(100, 50 + quality * 3 + (rarity === 'mythic' ? 15 : rarity === 'legendary' ? 10 : 0));
    const residue = route === 'M' ? Math.max(10, 45 - quality * 2) : 0;
    const eta = +((craftQ / 100) * (1 - residue / 100)).toFixed(3);

    const g = {
      id: s.nextGear++, material: mat, slot, method, enchant, quality, dur, maxDur,
      rarity, affix, titleId, productId: prod?.id || null, titleBonus, bonusStats,
      route, craftQ, residue, eta
    };
    e.lootCount = (e.lootCount || 0) + 1;
    return g;
  }
  globalThis.rollHackSlashGear = rollHackSlashGear;

  // Roll Hack & Slash Unlock Drops (Jobs 300, Skills 180, Manuals 39, Techs 13)
  function rollDiscoveryDrops(level, isBoss = false) {
    const e = ext();
    const logs = [];
    const chanceMult = isBoss ? 3.2 : 1.0;

    // 1. Job Certificate Unlock (300 Jobs)
    if (random() < 0.22 * chanceMult) {
      const lockJobs = Object.values(CAT.jobs).filter(j => j.minLv <= level + 25 && !e.unlockedJobIds.includes(j.id));
      if (lockJobs.length) {
        const j = pick(lockJobs);
        e.unlockedJobIds.push(j.id);
        logs.push(`🎉【職能証発見】専門職『${j.name}』（${j.family}系 / Lv.${j.minLv}〜）が解放された！`);
        // Also unlock its first skill if within level
        if (j.skills?.[0] && !e.unlockedSkillIds.includes(j.skills[0])) {
          e.unlockedSkillIds.push(j.skills[0]);
        }
      }
    }

    // 2. Skill Scroll Unlock (180 Skills)
    if (random() < 0.20 * chanceMult) {
      const lockSkills = Object.values(CAT.skills).filter(sk => sk.minLv <= level + 20 && !e.unlockedSkillIds.includes(sk.id));
      if (lockSkills.length) {
        const sk = pick(lockSkills);
        e.unlockedSkillIds.push(sk.id);
        logs.push(`📜【秘伝書発見】スキル『${sk.name}』（${sk.kind}）を習得可能になった！`);
      }
    }

    // 3. Exploration Manual Unlock (40 Behaviors / 39 Books)
    if (random() < 0.16 * chanceMult) {
      const lockBehaviors = Object.values(CAT.behaviors).filter(b => b.minDropLv <= level + 15 && !e.manuals.includes(b.id));
      if (lockBehaviors.length) {
        const b = pick(lockBehaviors);
        e.manuals.push(b.id);
        logs.push(`📘【手引書発見】『${b.bookName}』を入手！探索行動「${b.name}」が解放された！`);
      }
    }

    // 4. Crafting Tech Node / Facility Discovery (K01..K13)
    if (random() < 0.14 * chanceMult) {
      const lockTechs = Object.values(CAT.crafting.techs).filter(t =>
        !e.techs.includes(t.id) &&
        t.minLv <= level + 35 &&
        (t.prereq || []).every(p => e.techs.includes(p))
      );
      if (lockTechs.length) {
        const t = pick(lockTechs);
        e.techs.push(t.id);
        logs.push(`⚙️【技術発見】加工技術『${t.id}: ${t.name}』（${t.unlocks}）を解明した！`);
      }
    }

    return logs;
  }

  // Dynamic Monster Overlay: attach 400 Base Monsters & 160 Titles to encounters
  const prevEncounter = encounter;
  encounter = function(boss = false) {
    prevEncounter(boss);
    if (!s.battle || !s.dungeon) return;
    const e = ext();
    const lv = s.dungeon.level || 1;
    const monList = Object.values(CAT.monsters).filter(m => Math.abs(m.level - lv) <= 22);
    const titleList = Object.values(CAT.monsterTitles).filter(t => t.minLv <= lv + 15 && t.maxLv >= Math.max(1, lv - 15));

    s.battle.enemies.forEach(foe => {
      // Pair with catalog monster & title for flavor and threat variation
      const baseMon = monList.length && !boss ? pick(monList) : null;
      const monTitle = titleList.length && random() < (boss ? 0.85 : 0.45) ? pick(titleList) : null;
      const isElite = !boss && random() < 0.15;

      if (baseMon) {
        foe.catalogId = baseMon.id;
        foe.ecology = baseMon.ecology;
        foe.craftHint = baseMon.craftHint;
        e.discoveredMonsters[baseMon.id] = (e.discoveredMonsters[baseMon.id] || 0) + 1;
        // Blend catalog monster name on 50% of normal spawns to showcase 400 monsters while preserving v3 enemy IDs
        if (random() < 0.55) {
          foe.baseName = foe.name;
          foe.name = baseMon.name;
        }
      }
      if (monTitle) {
        foe.titleId = monTitle.id;
        foe.name = `${monTitle.name}${foe.name}`;
        const deltaScale = Math.max(0.8, 1 + (monTitle.delta || 0) * 0.018);
        foe.hp = Math.max(10, Math.round(foe.hp * deltaScale));
        foe.maxhp = foe.hp;
        foe.atk = Math.max(5, Math.round(foe.atk * deltaScale));
        foe.xp = Math.round(foe.xp * Math.max(1, deltaScale));
        foe.gold = Math.round(foe.gold * Math.max(1, deltaScale) + (monTitle.delta > 0 ? monTitle.delta * 2 : 0));
      }
      if (isElite) {
        foe.elite = true;
        foe.name = `★希少個体・${foe.name}`;
        foe.hp = Math.round(foe.hp * 1.35);
        foe.maxhp = foe.hp;
        foe.xp = Math.round(foe.xp * 1.8);
        foe.gold = Math.round((foe.gold + lv * 8) * 1.8);
      }
    });
  };

  // Hook Victory for Hack & Slash Loot & Discovery Jackpots
  const prevVictory = victory;
  victory = function() {
    const b = s.battle, d = s.dungeon;
    if (b && d) {
      const hasElite = b.enemies.some(e => e.elite);
      // Drop Hack & Slash gear with rarity/titles/products
      if (b.boss || hasElite || random() < 0.35) {
        const g = rollHackSlashGear(d.level, b.boss ? 'rare' : hasElite ? 'magic' : null);
        s.gear.push(g);
        note(`✨【戦利品】${gearName(g)}を入手！`);
      }
      const discLogs = rollDiscoveryDrops(d.level, b.boss || hasElite);
      discLogs.forEach(msg => note(msg));
    }
    prevVictory();
  };

  // Hook Step for Chest Jackpot ('c') & Loop Detection (B07)
  const prevStep = step;
  step = function(dx, dy, automatic = false) {
    const d = s.dungeon;
    const tileBefore = d?.map?.[d.y + dy]?.[d.x + dx];
    prevStep(dx, dy, automatic);
    if (d && tileBefore === 'c' && s.dungeon) {
      // Treasure chest jackpot!
      if (random() < 0.55) {
        const g = rollHackSlashGear(d.level + 5, random() < 0.3 ? 'rare' : 'magic');
        s.gear.push(g);
        tell(`▣ 宝箱から ${gearName(g)} を発見した！`);
      }
      const discLogs = rollDiscoveryDrops(d.level + 5, true);
      if (discLogs.length) tell(discLogs[0]);
    }
  };

  // Override Craft to record 5-Route Craft stats & level up crafting skills
  const prevCraft = craft;
  craft = function(material, slot, method) {
    const e = ext();
    const route = method === 'magic' ? 'M' : (e.selectedRoute && e.selectedRoute !== 'M' ? e.selectedRoute : 'H');
    const prodId = e.selectedProduct || (slot === 'armor' ? 'P0181' : 'P0002');
    const ev = evaluate5RouteCraft(material, prodId, route);
    const countBefore = s.gear.length;
    prevCraft(material, slot, method);
    if (s.gear.length > countBefore) {
      const g = s.gear.at(-1);
      g.route = route;
      g.productId = prodId;
      g.craftQ = ev.calcQ;
      g.residue = ev.residue;
      g.eta = ev.eta;
      // Chance for inspiration rarity upgrade when crafting!
      const roll = random();
      g.rarity = roll < 0.06 ? 'legendary' : roll < 0.22 ? 'rare' : roll < 0.55 ? 'magic' : 'common';
      if (g.rarity !== 'common') {
        const tPool = Object.values(CAT.itemTitles).filter(t => t.minLv <= currentTown().level + 30);
        const tPick = tPool.length ? pick(tPool) : null;
        if (tPick) g.titleId = tPick.id;
      }
      // Gain Crafting Skill Lv
      const matRank = DATA.materials[material]?.rank || 1;
      if (route === 'M') {
        e.magicCraftLv = Math.min(300, e.magicCraftLv + Math.max(1, Math.ceil(matRank / 2)));
      } else {
        e.craftLv = Math.min(300, e.craftLv + Math.max(1, Math.ceil(matRank / 2)));
      }
      tell(`⚒ ${gearName(g)}（品質指数Q${ev.calcQ}・伝達率${Math.round(ev.eta * 100)}%）を鍛造！`);
      render();
    }
  };

  // UI: Enhance Enemy Cards with Sprite Sheet Thumbnails
  const prevUiEnemies = uiEnemies;
  uiEnemies = function() {
    if (!s.battle) return '';
    return `<div class="enemy-field">${s.battle.enemies.map(e => {
      const tier = knowledge(e.id).tier;
      const thumb = monsterThumbHTML(e.id, e.catalogId);
      return `<button class="enemy ${s.battle.target === e.key ? 'selected' : ''} ${e.hp <= 0 ? 'dead' : ''} ${e.elite ? 'rarity-legendary' : ''}" data-action="target" data-id="${e.key}" ${e.hp <= 0 ? 'disabled' : ''}>${thumb || `<span class="enemy-icon">${e.icon}</span>`}<b>${esc(e.name)}</b><small>脅威度 Lv.${e.level || s.dungeon?.level || 1} · 解析 ${tier}/4</small><small>${tier >= 2 ? 'HP ' + e.hp + ' / ' + e.maxhp : 'HP 未解析'}</small>${tier >= 2 ? `<div class="bar"><i style="width:${Math.max(0, e.hp / e.maxhp * 100)}%"></i></div>` : ''}<small>${tier >= 3 ? '弱点 ' + uiElement(e.weak) + ' / 耐性 ' + uiElement(e.resist) : '弱点・耐性 未解析'}</small>${e.ecology && tier >= 2 ? `<small class="muted">${esc(e.ecology)}</small>` : ''}${e.poison ? `<span class="status">毒 ${e.poison}T</span>` : ''}</button>`;
    }).join('')}</div>`;
  };

  // UI: Enhance Party Screen with 300 Sub-Jobs, 180 Skills & Free Stat Point Allocation
  const prevPartyScreen = partyScreen;
  partyScreen = function() {
    const e = ext();
    const unlockedJobs = e.unlockedJobIds.map(id => CAT.jobs[id]).filter(Boolean);
    const unlockedSkills = e.unlockedSkillIds.map(id => CAT.skills[id]).filter(Boolean);
    const allocPanel = `<section class="panel" style="margin-bottom:18px">
      <div class="row between">
        <h2>✦ 専門職（副職300種）編成 ＆ 自由能力ポイント配分</h2>
        <span class="chip">解放済み専門職 ${unlockedJobs.length} / 300 · 秘伝スキル ${unlockedSkills.length} / 180</span>
      </div>
      <p class="muted">探索やボス討伐、街の掘出し物で「職能証」「秘伝書」を発見すると、300種の専門職（案内人・罠師・刀鍛冶・魔導工・奇想職など）を副職として兼任でき、固有の能力ボーナスと自動探索行動（B01〜B40）が解放されます。</p>
      <div class="grid three">${party().map(h => {
        const pts = heroFreePoints(h);
        const curSub = e.subJobs[h.id] || '';
        const subObj = CAT.jobs[curSub];
        return `<article class="card">
          <div class="row between"><b>${esc(h.name)} <small>Lv.${h.lv}</small></b><span class="chip">自由Pt: ${pts}</span></div>
          <label class="field">専門職（副職）<select data-ext-change="subjob" data-hero="${h.id}">
            <option value="">なし（主職のみ）</option>
            ${unlockedJobs.map(j => `<option value="${j.id}" ${curSub === j.id ? 'selected' : ''} ${h.lv < j.minLv ? 'disabled' : ''}>${esc(j.name)}（${esc(j.family)} / Lv.${j.minLv}〜）</option>`).join('')}
          </select></label>
          ${subObj ? `<small class="muted">${esc(subObj.role)}<br>関連技：${subObj.skills.map(sid => CAT.skills[sid]?.name || sid).join('・')}</small>` : ''}
          <div class="actions" style="margin-top:8px">${Object.keys(ATTRIBUTE_NAMES).map(k =>
            `<button data-action="alloc-stat" data-hero="${h.id}" data-stat="${k}" ${pts <= 0 ? 'disabled' : ''} style="padding:3px 7px;font-size:10px">${k}+1</button>`
          ).join('')}</div>
        </article>`;
      }).join('')}</div>
    </section>`;
    return allocPanel + prevPartyScreen();
  };

  // UI: Enhance Forge Screen with 5-Route Craft (H/F/M/I/X), 540 Products, 13 Techs & Residue Display
  const prevForgeScreen = forgeScreen;
  forgeScreen = function() {
    const e = ext();
    const mat = s.craftMaterial || 'iron';
    const slot = s.craftSlot || 'weapon';
    const catTarget = slot === 'armor' ? '防具' : '武器';
    const prodList = e.discoveredProducts.map(pid => CAT.products[pid]).filter(p => p && p.category === catTarget);
    const activeProdId = prodList.some(p => p.id === e.selectedProduct) ? e.selectedProduct : (prodList[0]?.id || (slot === 'armor' ? 'P0181' : 'P0002'));
    e.selectedProduct = activeProdId;
    const route = e.selectedRoute || 'H';
    const ev = evaluate5RouteCraft(mat, activeProdId, route);

    const routePanel = `<section class="panel" style="margin-bottom:18px">
      <div class="row between">
        <h2>⚙ 5経路クラフト・技術研究・加工品目（540種）</h2>
        <span class="chip">物理加工 Lv.${e.craftLv} · 魔法加工 Lv.${e.magicCraftLv} · 発見技術 ${e.techs.length}/13</span>
      </div>
      <p class="muted">手工(H)・鍛冶(F)・魔法成形(M)・機械工業(I)・精密科学(X)の5経路から選択。魔法成形(M)は難素材を早期に加工できますが「魔法残留R」が残り、後のエンチャント伝達率ηを抑えます。製作時には稀に【希少】【★伝説】の称号付き名品が誕生します！</p>
      <div class="grid">
        <div>
          <label class="field">加工経路（5ルート）<select data-ext-change="route">
            ${Object.values(CAT.crafting.routes).map(r => `<option value="${r.id}" ${route === r.id ? 'selected' : ''}>${r.id}：${esc(r.meaning)}（基準Q${r.baseQ}〜上限Q${r.maxQ}）</option>`).join('')}
          </select></label>
          <label class="field">加工品目（発見済み ${prodList.length}種 / 全540種）<select data-ext-change="product">
            ${prodList.map(p => `<option value="${p.id}" ${activeProdId === p.id ? 'selected' : ''}>${esc(p.name)}（工程:${esc(p.profile)} / 形状難度+${p.shapeLv}）</option>`).join('')}
          </select></label>
          <p class="muted">${esc(ev.prod?.design || '')} — <i>${esc(ev.prod?.flavor || '')}</i></p>
        </div>
        <div class="quest-box">
          <b>【${route}経路 判定プレビュー】 ${esc(DATA.materials[mat]?.name || mat)} × ${esc(ev.prod?.name || '')}</b>
          <p class="gold">必要技能Lv：${ev.possible ? ev.reqLv : 'この経路では加工不可(-)'} （現在有効技能 Lv.${ev.currentSkill}）</p>
          <p>予想加工品質：<b>Q${ev.calcQ}</b>/100 · 魔法残留：<b>${ev.residue}%</b> · 魔力消費倍率：<b>×${ev.manaMult}</b><br>エンチャント伝達率 η：<b>${Math.round(ev.eta * 100)}%</b></p>
          <small>必要技術：${[...(ev.missingTechs.length ? ev.missingTechs.map(t => '❌' + t) : ['✓充足'])].join(', ')} / 設備：${ev.missingEquips.length ? '街工房で代替可(' + ev.missingEquips.join('・') + ')' : '✓充足'}</small>
          <div class="actions">
            ${btn('技術・設備を研究投資 (' + (250 * e.techs.length) + ' G)', 'invest-tech', s.gold < 250 * e.techs.length ? 'disabled' : '')}
            ${btn('未発見の加工品レシピを調査 (180 G)', 'discover-recipe', s.gold < 180 ? 'disabled' : '')}
          </div>
        </div>
      </div>
    </section>`;
    return routePanel + prevForgeScreen();
  };

  // UI: Enhance Supplies Screen with Town Specialty Rotating Market & Black Market Mystery Box (Gacha)
  const prevSuppliesScreen = suppliesScreen;
  suppliesScreen = function() {
    const e = ext();
    const town = currentTown();
    const boxCost = Math.ceil(140 * town.price * Math.max(1, Math.floor(town.level / 10)));
    const grandBoxCost = Math.ceil(520 * town.price * Math.max(1, Math.floor(town.level / 8)));
    const manualBoxCost = Math.ceil(260 * town.price);

    const gachaPanel = `<section class="panel section-space loot-banner">
      <div class="row between">
        <h2>🎲 旅商人の掘出し物・闇市ガチャ（射幸取引）</h2>
        <span class="chip">街Lv.${town.level} 連動 · 天井カウント ${e.pity || 0}/15</span>
      </div>
      <p class="muted">街のレベルに応じた未鑑定武具や、未解放の「職能証（300職）」「秘伝書（180技）」「探索手引書（39冊）」をランダムに引き当てます。15回以内に必ず【★伝説】または【✦神話】装備が出現！</p>
      <div class="grid three">
        <article class="card">
          <h3>🗡️ 未鑑定の武具箱</h3>
          <p class="muted">街Lv.${town.level}相当のランダム素材・加工品・称号付き装備を1点鑑定。</p>
          <p class="gold">${boxCost} G</p>
          ${btn('武具箱を開ける', 'gacha-gear', s.gold < boxCost ? 'disabled' : '', 'primary wide')}
        </article>
        <article class="card rarity-legendary">
          <h3>👑 特級・黄金武具箱</h3>
          <p class="muted">【希少】以上確定！高確率で【★伝説】【✦神話】と複合能力ボーナスが付与。</p>
          <p class="gold">${grandBoxCost} G</p>
          ${btn('黄金箱を開ける', 'gacha-grand', s.gold < grandBoxCost ? 'disabled' : '', 'primary wide')}
        </article>
        <article class="card rarity-magic">
          <h3>📜 古の職能・秘伝くじ</h3>
          <p class="muted">300種の専門職証・180種のスキル秘伝・39冊の探索手引書・新加工技術のいずれかを解放！</p>
          <p class="gold">${manualBoxCost} G</p>
          ${btn('古文書を解読する', 'gacha-scroll', s.gold < manualBoxCost ? 'disabled' : '', 'primary wide')}
        </article>
      </div>
    </section>`;
    return prevSuppliesScreen() + gachaPanel;
  };

  // UI: Enhance Rules Screen with 40 Exploration Behaviors & 39 Manuals
  const prevRulesScreen = rulesScreen;
  rulesScreen = function() {
    const e = ext();
    const behaviors = Object.values(CAT.behaviors || {});
    // Also check behaviors unlocked by active party's sub-jobs
    const subJobBehaviors = new Set();
    for (const h of party()) {
      const sub = CAT.jobs[e.subJobs[h.id]];
      if (sub) {
        for (const sid of sub.skills || []) {
          const sk = CAT.skills[sid];
          if (sk && h.lv >= sk.minLv) (sk.behaviors || []).forEach(b => subJobBehaviors.add(b));
        }
      }
    }
    const behPanel = `<section class="panel section-space">
      <div class="row between">
        <h2>🧭 自動探索AI・40行動と39手引書（最大6枠優先設定）</h2>
        <span class="chip">研究済み手引 ${e.manuals.length}/40 · 設定中 ${e.activeBehaviors.length}/6枠</span>
      </div>
      <p class="muted">手引書の入手（＋平均Lv条件）または対応する専門職の同行によって行動が解放されます。最大6枠まで優先行動を有効化できます。</p>
      <div class="grid three">${behaviors.map(b => {
        const byManual = e.manuals.includes(b.id) && partyLevel() >= b.reqPartyLv;
        const byJob = subJobBehaviors.has(b.id);
        const canUse = b.id === 'B01' || byManual || byJob;
        const active = e.activeBehaviors.includes(b.id);
        return `<article class="card ${canUse ? '' : 'locked'}">
          <div class="row between"><b>${b.id}: ${esc(b.name)}</b><span class="chip">${byJob ? '専門職解放' : byManual ? '手引解放' : '要Lv.' + b.reqPartyLv}</span></div>
          <small class="gold">手引書：${esc(b.bookName)}（出現Lv.${b.minDropLv}〜）</small>
          <p class="muted">${esc(b.action)}<br><small>限界：${esc(b.limit)}</small></p>
          ${btn(active ? '✓ 優先設定中' : canUse ? '行動枠に設定' : '未解放', 'toggle-behavior', `data-id="${b.id}" ${!canUse ? 'disabled' : ''}`, active ? 'selected' : '')}
        </article>`;
      }).join('')}</div>
    </section>`;
    return prevRulesScreen() + behPanel;
  };

  // UI: Enhance Catalog Screen with Encyclopedia Tabs for 1,765 Items / Monsters / Jobs / Titles
  const prevCatalogScreen = catalogScreen;
  catalogScreen = function() {
    const e = ext();
    const tab = e.catalogTab || 'v3mat';
    const tabsHTML = `<div class="tab-bar">
      ${[
        ['v3mat', `現行素材 (${Object.keys(DATA.materials).length})`],
        ['cat_mat', `全素材辞典 (${Object.keys(CAT.materials).length})`],
        ['cat_prod', `加工品辞典 (${e.discoveredProducts.length}/${Object.keys(CAT.products).length})`],
        ['cat_title', `称号辞典 (${e.discoveredTitles.length}/${Object.keys(CAT.itemTitles).length})`],
        ['cat_mon', `大魔物図鑑 (${Object.keys(e.discoveredMonsters).length}/${Object.keys(CAT.monsters).length})`],
        ['cat_job', `300職業・180技 (${e.unlockedJobIds.length}/${Object.keys(CAT.jobs).length})`]
      ].map(([id, label]) => btn(label, 'catalog-tab', `data-tab="${id}"`, tab === id ? 'selected' : '')).join('')}
    </div>`;

    if (tab === 'cat_mat') {
      const list = Object.values(CAT.materials);
      return title('GRAND MATERIAL COMPENDIUM', '全素材加工特性辞典（265種）', '手工(H)・鍛冶(F)・魔法(M)・機械(I)・精密(X)の必要LVと魔法残留R0。') + tabsHTML +
        `<div class="grid three">${list.map(m => `<article class="card">
          <div class="row between"><h3>${esc(m.name)}</h3><span class="chip">${m.id} · Lv.${m.minLv}〜${m.maxLv}</span></div>
          <small class="gold">${esc(m.workClass)} / 残留基準 R0=${m.baseResidue} / ${esc(m.direction)}</small>
          <p class="muted">経路LV：H:${m.routes.H ?? '-'} / F:${m.routes.F ?? '-'} / M:${m.routes.M ?? '-'} / I:${m.routes.I ?? '-'} / X:${m.routes.X ?? '-'}</p>
          <p class="muted">${esc(m.flavor)}</p>
        </article>`).join('')}</div>`;
    }
    if (tab === 'cat_prod') {
      const list = Object.values(CAT.products);
      return title('GRAND PRODUCT CATALOG', '加工品クラフト方向性辞典（540種）', '戦闘や調査で発見した加工品は工房で指定製作できます。') + tabsHTML +
        `<div class="grid three">${list.map(p => {
          const known = e.discoveredProducts.includes(p.id);
          return `<article class="card ${known ? '' : 'locked'}">
            <div class="row between"><h3>${known ? esc(p.name) : '？？？'}</h3><span class="chip">${p.id} · ${esc(p.category)}</span></div>
            <small class="gold">工程：${esc(p.profile)} / 形状加算 +${p.shapeLv} / 適正Lv.${p.minLv}〜${p.maxLv}</small>
            <p class="muted">${known ? esc(p.design) + '<br>' + esc(p.flavor) : '探索の戦利品や工房のレシピ調査で解放されます。'}</p>
          </article>`;
        }).join('')}</div>`;
    }
    if (tab === 'cat_title') {
      const list = Object.values(CAT.itemTitles);
      return title('ITEM TITLE LEXICON', 'アイテム称号辞典（400種）', 'ハクスラ戦利品や名匠鍛造で付与される400種の称号と来歴。') + tabsHTML +
        `<div class="grid three">${list.map(t => {
          const known = e.discoveredTitles.includes(t.id);
          return `<article class="card ${known ? '' : 'locked'}">
            <div class="row between"><h3>${known ? esc(t.name) : '？？？'}</h3><span class="chip">${t.id} · Lv.${t.minLv}〜${t.maxLv}</span></div>
            <small class="gold">${esc(t.meaning)} / ${esc(t.direction)}</small>
            <p class="muted">${known ? esc(t.flavor) : '希少以上の装備獲得で記録されます。'}</p>
          </article>`;
        }).join('')}</div>`;
    }
    if (tab === 'cat_mon') {
      const list = Object.values(CAT.monsters);
      return title('BESTIARY OF 400 MONSTERS', '大魔物生態図鑑（400種＋160称号）', 'M0001〜M0040は図鑑シートのイラストに対応。遭遇すると生態とクラフト着想が判明します。') + tabsHTML +
        `<div class="grid three">${list.map(m => {
          const count = e.discoveredMonsters[m.id] || 0;
          const thumb = monsterThumbHTML('', m.id);
          return `<article class="card ${count ? '' : 'locked'}">
            ${thumb}
            <div class="row between"><h3>${count ? esc(m.name) : '未遭遇 (' + m.id + ')'}</h3><span class="chip">脅威Lv.${m.level} · ${esc(m.category)}</span></div>
            <small class="gold">特性：${(m.traits || []).join('・')} / 遭遇 ${count}回</small>
            <p class="muted">${count ? esc(m.ecology) + '<br>着想：' + esc(m.craftHint) + '<br><i>' + esc(m.flavor) + '</i>' : '対応するレベル帯の探索域で遭遇できます。'}</p>
          </article>`;
        }).join('')}</div>`;
    }
    if (tab === 'cat_job') {
      const list = Object.values(CAT.jobs);
      return title('300 CALLINGS & 180 SKILLS', '職業・スキル大辞典（300職・180技）', '職能証を入手した職業は「仲間」画面で副職として兼任できます。') + tabsHTML +
        `<div class="grid three">${list.map(j => {
          const unlocked = e.unlockedJobIds.includes(j.id);
          return `<article class="card ${unlocked ? '' : 'locked'}">
            <div class="row between"><h3>${unlocked ? esc(j.name) : '？？？ (' + j.id + ')'}</h3><span class="chip">${esc(j.family)} · Lv.${j.minLv}〜</span></div>
            <small class="gold">${j.skills.map(sid => CAT.skills[sid]?.name || sid).join(' / ')}</small>
            <p class="muted">${unlocked ? esc(j.role) + '<br><i>' + esc(j.flavor) + '</i>' : '探索ドロップまたは古文書くじで職能証を入手すると解放。'}</p>
          </article>`;
        }).join('')}</div>`;
    }
    return tabsHTML + prevCatalogScreen();
  };

  // Event Listeners for New Hack & Slash / 5-Route Craft / Sub-Job / Gacha Actions
  const prevBoot = boot;
  boot = function() {
    document.addEventListener('click', ev => {
      const b = ev.target.closest('[data-action]');
      if (!b || b.disabled) return;
      const act = b.dataset.action;
      const e = ext();

      if (act === 'catalog-tab') {
        e.catalogTab = b.dataset.tab;
        render();
      } else if (act === 'alloc-stat') {
        const h = s.roster.find(x => x.id === Number(b.dataset.hero));
        const st = b.dataset.stat;
        if (h && heroFreePoints(h) > 0 && ATTRIBUTE_NAMES[st]) {
          e.alloc[h.id] ??= {};
          e.alloc[h.id][st] = (e.alloc[h.id][st] || 0) + 1;
          tell(`${h.name}の ${st}（${ATTRIBUTE_NAMES[st]}）を +1 強化した！`);
          render();
        }
      } else if (act === 'invest-tech') {
        if (!townOnly()) return;
        const cost = 250 * e.techs.length;
        if (s.gold < cost) return;
        const nextTech = Object.values(CAT.crafting.techs).find(t => !e.techs.includes(t.id) && (t.prereq || []).every(p => e.techs.includes(p)));
        s.gold -= cost;
        e.craftLv = Math.min(300, e.craftLv + 3);
        e.magicCraftLv = Math.min(300, e.magicCraftLv + 3);
        if (nextTech) {
          e.techs.push(nextTech.id);
          tell(`⚙️ 技術研究完了！『${nextTech.id}: ${nextTech.name}』を習得し、加工技能が+3上昇した！`);
        } else {
          tell(`⚙️ 工房設備を改良し、物理・魔法加工技能が +3 上昇した！`);
        }
        render();
      } else if (act === 'discover-recipe') {
        if (!townOnly() || s.gold < 180) return;
        s.gold -= 180;
        const unknown = Object.values(CAT.products).filter(p => !e.discoveredProducts.includes(p.id) && p.minLv <= currentTown().level + 45);
        const picks = [];
        for (let i = 0; i < 3 && unknown.length; i++) {
          const p = pick(unknown);
          if (p && !e.discoveredProducts.includes(p.id)) {
            e.discoveredProducts.push(p.id);
            picks.push(p.name);
          }
        }
        tell(picks.length ? `📐 新たな加工品レシピ『${picks.join('・')}』を発見した！` : '周辺の基礎レシピはすべて解明済みです（加工技能経験+1）。');
        e.craftLv = Math.min(300, e.craftLv + 1);
        render();
      } else if (act === 'gacha-gear' || act === 'gacha-grand') {
        if (!townOnly()) return;
        const town = currentTown();
        const isGrand = act === 'gacha-grand';
        const cost = isGrand ? Math.ceil(520 * town.price * Math.max(1, Math.floor(town.level / 8))) : Math.ceil(140 * town.price * Math.max(1, Math.floor(town.level / 10)));
        if (s.gold < cost) return;
        s.gold -= cost;
        const g = rollHackSlashGear(Math.max(partyLevel(), town.level) + (isGrand ? 12 : 3), isGrand ? 'rare' : null);
        s.gear.push(g);
        tell(`🎲 鑑定結果：${gearName(g)} を引き当てた！`);
        render();
      } else if (act === 'gacha-scroll') {
        if (!townOnly()) return;
        const cost = Math.ceil(260 * currentTown().price);
        if (s.gold < cost) return;
        s.gold -= cost;
        const logs = rollDiscoveryDrops(Math.max(partyLevel(), currentTown().level) + 25, true);
        if (!logs.length) {
          // Force unlock at least one job or product
          const lockJ = Object.values(CAT.jobs).filter(j => !e.unlockedJobIds.includes(j.id));
          if (lockJ.length) {
            const j = pick(lockJ);
            e.unlockedJobIds.push(j.id);
            logs.push(`🎉【職能証発見】専門職『${j.name}』（${j.family}系）が解放された！`);
          }
        }
        tell(logs[0] || '古文書から加工知識を得て加工LVが+2上がった！');
        render();
      } else if (act === 'toggle-behavior') {
        const bid = b.dataset.id;
        if (!bid) return;
        if (e.activeBehaviors.includes(bid)) {
          if (bid !== 'B01') e.activeBehaviors = e.activeBehaviors.filter(x => x !== bid);
        } else if (e.activeBehaviors.length < 6) {
          e.activeBehaviors.push(bid);
        } else {
          tell('自動探索の優先行動枠は最大6個までです。');
        }
        render();
      }
    });

    document.addEventListener('change', ev => {
      const k = ev.target.dataset.extChange;
      if (!k) return;
      const e = ext();
      if (k === 'subjob') {
        const hid = Number(ev.target.dataset.hero);
        e.subJobs[hid] = ev.target.value || null;
        const j = CAT.jobs[ev.target.value];
        tell(j ? `専門職『${j.name}』を副職に設定した。` : '副職を解除した。');
        render();
      } else if (k === 'route') {
        e.selectedRoute = ev.target.value;
        s.craftMethod = ev.target.value === 'M' ? 'magic' : 'physical';
        render();
      } else if (k === 'product') {
        e.selectedProduct = ev.target.value;
        render();
      }
    });

    prevBoot();
  };
})();
