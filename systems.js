/* Character rules derived from the October 19 Obsidian additions. */
const ATTRIBUTE_NAMES={STR:'力',INT:'知力',AGI:'敏捷',VIT:'体力',DEX:'器用さ',WIZ:'知恵',MGR:'魔法抵抗',CHR:'魅力'};
function baseAttributes(h){const j=DATA.jobs[h.job];return j.attributes||{STR:j.atk,INT:j.mag,AGI:j.speed,VIT:10,DEX:10,WIZ:10,MGR:10,CHR:10};}
function attributes(h){const b=baseAttributes(h);return Object.fromEntries(Object.keys(ATTRIBUTE_NAMES).map(k=>[k,b[k]+h.lv-1]));}
function maxSP(h){return 20+attributes(h).VIT*2;}
function syncHero(h){h.learned??=[];h.jobHistory??=[h.job];if(!h.jobHistory.includes(h.job))h.jobHistory.push(h.job);for(const id of DATA.jobs[h.job].skills||[])if(DATA.skills[id]?.level<=h.lv&&!h.learned.includes(id))h.learned.push(id);h.sp=Number.isFinite(h.sp)?Math.min(maxSP(h),Math.max(0,h.sp)):maxSP(h);}
function canJob(h,id){const j=DATA.jobs[id];if(!j||h.lv<j.unlock)return false;if(h.job===id)return true;const r=j.requirements;if(!r)return true;return(h.jobHistory||[h.job]).includes(r.job)&&(h.learned||[]).includes(r.skill);}
function jobRequirementText(j){return j.base?'基本職':'派生職';}
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
characterScreen=function(h){return originalCharacter(h);};
const oldSkillText=uiSkillText;
uiSkillText=function(sk){return `消費 MANA ${sk.mp} / SP ${sk.sp||0} · 対象：${({enemy:'敵単体',enemies:'敵全体',allEnemies:'敵全体',allAllies:'味方全員',ally:'味方1人',allies:'味方全員',self:'自分'}[sk.target])||sk.target}`;};
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
    // World-shared technology base starts ONLY with Rural Handcraft ('K01')
    s.ext.techs ??= ['K01'];
    s.ext.facilities ??= ['手工具', '組立台', '木工刃', '研磨台', '打製台', '裁断具', '縫製具', '成形台'];
    s.ext.unlockedJobIds ??= ['J0001', 'J0011', 'J0021', 'J0051', 'J0151', 'J0211'];
    s.ext.unlockedSkillIds ??= ['SK0001', 'SK0007', 'SK0013', 'SK0031'];
    s.ext.manuals ??= ['B01'];
    s.ext.activeBehaviors ??= ['B01'];
    s.ext.discoveredMonsters ??= {};
    s.ext.discoveredTitles ??= [];
    // Rural village initial craftsman knowledge: only stone/wood basic handcraft items
    s.ext.discoveredProducts ??= ['P0001', 'P0031', 'P0061', 'P0181'];
    s.ext.discoveredMaterials ??= ['wood', 'stone', 'hide'];
    for (const [mk, cnt] of Object.entries(s.materials || {})) {
      if (cnt > 0 && !s.ext.discoveredMaterials.includes(mk)) s.ext.discoveredMaterials.push(mk);
    }
    s.ext.identifiedMaterials ??= ['wood', 'oak', 'ashwood', 'willow', 'bone', 'fang', 'hide', 'shell', 'chitin', 'scale', 'silk', 'stone'];
    s.ext.completedTechScenarios ??= [];
    s.ext.townWorkshops ??= {};
    s.ext.learnedRecipes ??= [
      { id: 'R_INIT_1', productId: 'P0031', matKey: 'stone', route: 'H', titleHint: '素朴なる' },
      { id: 'R_INIT_2', productId: 'P0001', matKey: 'wood', route: 'H', titleHint: '手削りの' },
      { id: 'R_INIT_3', productId: 'P0181', matKey: 'hide', route: 'H', titleHint: '継ぎ接ぎの' }
    ];
    s.ext.discoveredMainJobs ??= ['warrior', 'priest', 'scout', 'mage', 'alchemist'];
    for (const h of s.roster || []) {
      for (const jid of h.jobHistory || [h.job]) {
        if (jid && !s.ext.discoveredMainJobs.includes(jid)) s.ext.discoveredMainJobs.push(jid);
      }
    }
    s.ext.visitedMaps ??= ['forest_edge'];
    s.ext.soundOn ??= true;
    s.ext.lootCount ??= 0;
    s.ext.pity ??= 0;
    s.ext.selectedRoute ??= 'H';
    s.ext.selectedProduct ??= 'P0031';
    s.ext.forgeMode ??= 'workshop'; // 'workshop' (工房請負) or 'craftsman' (職人自作)
    s.ext.crafterHeroId ??= 1;
    s.ext.marketSeed ??= (s.randomState || 12345) >>> 0;
    s.ext.subJobs ??= {};
    s.ext.alloc ??= {};
    s.ext.freePts ??= {};
    return s.ext;
  }

  // === World-Shared Technology Development Scenarios (Unique Quests by Town Lv) ===
  const TECH_SCENARIOS = [
    {
      id: 'scen_ore_study',
      title: 'ユニークシナリオ：鉱石研究家の願い',
      minTownLv: 5,
      prereq: null,
      reqText: '名もなき「石」（鉱石類）を合計 8個 採取して研究家に届ける',
      desc: '「旅の方、森や廃坑で拾う『ただの石』の中に、妙に重く赤錆びた石や青緑の石が混ざっていませんか？ 石の見分け方を体系化したいので、石材・鉱石を8個ほど集めてきてほしいのです」',
      checkCanComplete: () => {
        const stonePool = ['stone', 'limestone', 'granite', 'basalt', 'flint', 'copper', 'tin', 'iron', 'quartz'];
        const total = stonePool.reduce((acc, k) => acc + (s.materials[k] || 0), 0);
        return total >= 8;
      },
      consume: () => {
        let rem = 8;
        const stonePool = ['stone', 'limestone', 'granite', 'basalt', 'flint', 'copper', 'tin', 'iron', 'quartz'];
        for (const k of stonePool) {
          while (rem > 0 && (s.materials[k] || 0) > 0) {
            const q = Number(Object.keys(s.stock[k] || {}).find(tier => s.stock[k][tier] > 0) || 1);
            if (!consumeMaterial(k, 1, q)) break;
            rem--;
          }
        }
      },
      unlockTechs: ['K02', 'K03'],
      identifyMats: ['limestone', 'granite', 'basalt', 'obsidian', 'flint', 'copper', 'tin', 'bronze', 'quartz'],
      unlockProducts: ['P0002', 'P0091', 'P0211'],
      rewardText: '世界の基礎技術『鉱物選別・低温鍛冶（K02/K03）』が確立！これまで全て「石」に見えていた銅鉱・錫石・黒曜石・石英などが識別可能になり、各地の工房に銅加工品が並び始めた！'
    },
    {
      id: 'scen_burning_passion',
      title: 'ユニークシナリオ：熱い思い（製鉄と高熱炉の確立）',
      minTownLv: 15,
      prereq: 'scen_ore_study',
      reqText: '高熱を生む特殊木材（木材類 10個）と鉱石類 6個 を納品する',
      desc: '「先日分類した赤黒い重石……あれは極めて高い温度で溶かせば、青銅を遥かに凌ぐ『鉄』になるはずです！ 高熱炉を築くため、火力の強い木材10個と原石6個を集めてくれませんか！」',
      checkCanComplete: () => {
        const woods = ['wood', 'oak', 'ashwood', 'willow', 'ebony', 'yew'].reduce((a, k) => a + (s.materials[k] || 0), 0);
        const ores = ['iron', 'copper', 'tin', 'bronze', 'coal', 'basalt'].reduce((a, k) => a + (s.materials[k] || 0), 0);
        return woods >= 10 && ores >= 6;
      },
      consume: () => {
        let rw = 10;
        for (const k of ['wood', 'oak', 'ashwood', 'willow', 'ebony', 'yew']) {
          while (rw > 0 && (s.materials[k] || 0) > 0) {
            const q = Number(Object.keys(s.stock[k] || {}).find(t => s.stock[k][t] > 0) || 1);
            if (!consumeMaterial(k, 1, q)) break;
            rw--;
          }
        }
        let ro = 6;
        for (const k of ['iron', 'copper', 'tin', 'bronze', 'basalt']) {
          while (ro > 0 && (s.materials[k] || 0) > 0) {
            const q = Number(Object.keys(s.stock[k] || {}).find(t => s.stock[k][t] > 0) || 1);
            if (!consumeMaterial(k, 1, q)) break;
            ro--;
          }
        }
      },
      unlockTechs: ['K04', 'K05'],
      identifyMats: ['iron', 'steel', 'tamahagane', 'coldsteel', 'silver', 'gold', 'crystal', 'amethyst', 'amber'],
      unlockProducts: ['P0003', 'P0032', 'P0121', 'P0182'],
      rewardText: '世界の加工技術『高炉製鉄・鋼鍛造（F経路 / K04・K05）』が確立！「鉄鉱石」「鋼」「玉鋼」「銀」の真名が判明し、世界中の街工房が鉄器・鋼武具を扱えるようになった！'
    },
    {
      id: 'scen_mana_circuit',
      title: 'ユニークシナリオ：魔導炉と残留魔力の謎',
      minTownLv: 30,
      prereq: 'scen_burning_passion',
      reqText: '魔力を宿す結晶・宝石類を合計 6個 納品する',
      desc: '「槌だけでは形にできない硬質な素材も、魔力を直接流し込めば自在に成形できます。ただし魔力の澱（残留）が生じるようで……実験のため結晶類を6個譲ってください」',
      checkCanComplete: () => {
        const gems = ['crystal', 'quartz', 'amethyst', 'ruby', 'sapphire', 'emerald', 'topaz', 'amber', 'spiritstone'].reduce((a, k) => a + (s.materials[k] || 0), 0);
        return gems >= 6;
      },
      consume: () => {
        let rg = 6;
        for (const k of ['crystal', 'quartz', 'amethyst', 'ruby', 'sapphire', 'emerald', 'topaz', 'amber', 'spiritstone']) {
          while (rg > 0 && (s.materials[k] || 0) > 0) {
            const q = Number(Object.keys(s.stock[k] || {}).find(t => s.stock[k][t] > 0) || 1);
            if (!consumeMaterial(k, 1, q)) break;
            rg--;
          }
        }
      },
      unlockTechs: ['K06', 'K07'],
      identifyMats: ['mithril', 'ruby', 'sapphire', 'emerald', 'topaz', 'diamond', 'spiritstone'],
      unlockProducts: ['P0151', 'P0241', 'P0331'],
      rewardText: '世界の加工技術『魔法成形（M経路 / K06・K07）』が確立！魔銀ミスリルや上位宝石が識別可能になり、魔法成形が解禁された！'
    },
    {
      id: 'scen_lathe_revolution',
      title: 'ユニークシナリオ：歯車と旋盤の夜明け（機械工業の確立）',
      minTownLv: 60,
      prereq: 'scen_mana_circuit',
      reqText: '鉄・鋼・希少金属類を合計 12個 と 研究資金 3,000 G を提供する',
      desc: '「手作業や槌打ちの誤差をなくす『旋盤』と『蒸気圧延機』の設計図が完成しました！ これがあれば高融点金属も精密に削り出せます。試作機建造にご協力ください！」',
      checkCanComplete: () => {
        const metals = ['iron', 'steel', 'titanium', 'tungsten', 'silver', 'mithril', 'bronze'].reduce((a, k) => a + (s.materials[k] || 0), 0);
        return s.gold >= 3000 && metals >= 12;
      },
      consume: () => {
        s.gold -= 3000;
        let rm = 12;
        for (const k of ['iron', 'steel', 'titanium', 'tungsten', 'silver', 'mithril', 'bronze']) {
          while (rm > 0 && (s.materials[k] || 0) > 0) {
            const q = Number(Object.keys(s.stock[k] || {}).find(t => s.stock[k][t] > 0) || 1);
            if (!consumeMaterial(k, 1, q)) break;
            rm--;
          }
        }
      },
      unlockTechs: ['K08', 'K09', 'K10', 'K11'],
      identifyMats: ['titanium', 'tungsten', 'meteoric', 'orichalcum', 'adamant', 'stariron', 'godcrystal', 'abyssalbone', 'worldbranch', 'wyvernwing'],
      unlockProducts: ['P0015', 'P0045', 'P0190'],
      rewardText: '世界の加工技術『機械工業・旋盤加工（I経路 / X経路）』が確立！全ての未知鉱石・神代金属の識別が可能になり、高Lv都市の工房が一斉に近代化された！'
    }
  ];

  // Check if a material's true identity is known to the world yet
  function isMaterialIdentified(matKey) {
    const e = ext();
    if (e.identifiedMaterials.includes(matKey)) return true;
    const m = DATA.materials[matKey];
    if (!m) return true;
    if (['wood', 'fang', 'hide', 'herb'].includes(m.category) && m.rank <= 2) return true;
    return false;
  }

  // Apparent Material Name: Unidentified stones/ores/metals all look like "石" (or "黒ずんだ石" / "光る石")!
  // Even though they look like "石", they are stored under separate keys so they don't stack together!
  function apparentMaterialName(matKey) {
    const m = DATA.materials[matKey];
    if (!m) return matKey;
    if (isMaterialIdentified(matKey)) return m.name;
    if (m.category === 'gem') return '光る石';
    if (m.category === 'wood') return '古木';
    if (m.category === 'bone' || m.category === 'fang') return '獣の骨';
    // Stones, ores, and metals all appear simply as "石" when world mineral knowledge is undeveloped!
    return '石';
  }
  globalThis.apparentMaterialName = apparentMaterialName;

  // Maximum global craft skill cap based on world-shared technology development
  function worldMaxTechCap() {
    const e = ext();
    if (e.techs.includes('K11') || e.techs.includes('K10')) return 300;
    if (e.techs.includes('K08')) return 160;
    if (e.techs.includes('K06')) return 95;
    if (e.techs.includes('K04')) return 50;
    if (e.techs.includes('K02')) return 22;
    // Initial rural village cap: even if you visit a Lv.300 town early, world tech only supports basic handcraft!
    return 12;
  }

  function allowedRoutesByWorldTech() {
    const e = ext();
    const routes = ['H'];
    if (e.techs.includes('K02') || e.techs.includes('K04')) routes.push('F');
    if (e.techs.includes('K06')) routes.push('M');
    if (e.techs.includes('K08')) routes.push('I');
    if (e.techs.includes('K10')) routes.push('X');
    return routes;
  }

  // Per-Town Workshop State (Persistent + Expandable via World Tech & Player Teaching)
  function getTownWorkshop(town) {
    const e = ext();
    const t = town || currentTown();
    if (!e.townWorkshops[t.id]) {
      const r = rng(hash('workshop:' + t.id + ':' + (t.seed || 1)));
      const baseSkill = Math.max(4, Math.min(300, Math.round(t.level * 1.15) + Math.floor(r() * 8)));
      // Assign town-specific specialty products based on town seed
      const allProds = Object.values(CAT.products).filter(p => p.category === '武器' || p.category === '防具');
      const townProds = ['P0031', 'P0001', 'P0181']; // every rural workshop knows stone axe / wood sword / tunic
      const pool = allProds.filter(p => p.minLv <= Math.max(15, t.level + 20));
      for (let i = 0; i < 6 && pool.length; i++) {
        const pickP = pool[Math.floor(r() * pool.length)];
        if (pickP && !townProds.includes(pickP.id)) townProds.push(pickP.id);
      }
      e.townWorkshops[t.id] = {
        townId: t.id,
        baseSkill,
        bonusSkill: 0,
        specialtyProducts: townProds,
        taughtRecipes: [], // { id, productId, matKey, route, name }
        knownTechLevel: e.techs.length
      };
    }
    const ws = e.townWorkshops[t.id];
    // When world technology advances, town workshop automatically updates its catalog up to its effective skill!
    const worldCap = worldMaxTechCap();
    const effectiveSkill = Math.min(worldCap, ws.baseSkill + (ws.bonusSkill || 0));
    if (ws.knownTechLevel !== e.techs.length) {
      ws.knownTechLevel = e.techs.length;
      const r = rng(hash('ws-update:' + t.id + ':' + e.techs.length));
      const newPool = Object.values(CAT.products).filter(p =>
        (p.category === '武器' || p.category === '防具') &&
        p.minLv <= effectiveSkill + 10
      );
      for (let i = 0; i < 4 && newPool.length; i++) {
        const p = newPool[Math.floor(r() * newPool.length)];
        if (p && !ws.specialtyProducts.includes(p.id)) ws.specialtyProducts.push(p.id);
      }
    }
    return {
      ...ws,
      worldCap,
      effectiveSkill
    };
  }
  globalThis.getTownWorkshop = getTownWorkshop;

  // === 1. Web Audio API Sound Synthesizer & Visual FX ===
  let audioCtx = null;
  function playSE(type) {
    try {
      if (!ext().soundOn) return;
      const AC = globalThis.AudioContext || globalThis.webkitAudioContext;
      if (!AC) return;
      if (!audioCtx) audioCtx = new AC();
      if (audioCtx.state === 'suspended') audioCtx.resume();
      const now = audioCtx.currentTime;
      const tone = (freq, endFreq, dur, wave = 'triangle', vol = 0.14, delay = 0) => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = wave;
        osc.frequency.setValueAtTime(freq, now + delay);
        if (endFreq && endFreq !== freq) osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), now + delay + dur);
        gain.gain.setValueAtTime(vol, now + delay);
        gain.gain.exponentialRampToValueAtTime(0.001, now + delay + dur);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start(now + delay);
        osc.stop(now + delay + dur);
      };
      if (type === 'attack' || type === 'slash') {
        tone(340, 110, 0.11, 'sawtooth', 0.13, 0);
        tone(190, 75, 0.09, 'square', 0.10, 0.04);
      } else if (type === 'fire') {
        tone(220, 520, 0.18, 'sawtooth', 0.13, 0);
        tone(440, 160, 0.22, 'triangle', 0.11, 0.06);
      } else if (type === 'frost' || type === 'water') {
        tone(780, 1180, 0.12, 'sine', 0.12, 0);
        tone(1040, 1560, 0.15, 'sine', 0.10, 0.08);
      } else if (type === 'thunder' || type === 'light') {
        tone(920, 260, 0.16, 'sawtooth', 0.14, 0);
        tone(1240, 420, 0.18, 'square', 0.10, 0.05);
      } else if (type === 'dark' || type === 'poison') {
        tone(180, 95, 0.24, 'sawtooth', 0.13, 0);
        tone(145, 70, 0.24, 'triangle', 0.10, 0.06);
      } else if (type === 'heal' || type === 'cleanse') {
        tone(523.25, 659.25, 0.14, 'sine', 0.13, 0);
        tone(659.25, 783.99, 0.16, 'sine', 0.13, 0.09);
        tone(783.99, 1046.5, 0.24, 'triangle', 0.12, 0.18);
      } else if (type === 'buff') {
        tone(392, 523.25, 0.12, 'triangle', 0.11, 0);
        tone(523.25, 659.25, 0.18, 'triangle', 0.11, 0.08);
      } else if (type === 'hit') {
        tone(150, 55, 0.14, 'square', 0.15, 0);
      } else if (type === 'victory' || type === 'loot') {
        tone(523.25, 523.25, 0.10, 'triangle', 0.13, 0);
        tone(659.25, 659.25, 0.10, 'triangle', 0.13, 0.09);
        tone(783.99, 783.99, 0.12, 'triangle', 0.13, 0.18);
        tone(1046.5, 1046.5, 0.30, 'triangle', 0.15, 0.28);
      } else if (type === 'defeat') {
        tone(311, 277, 0.20, 'sawtooth', 0.12, 0);
        tone(261, 185, 0.38, 'sawtooth', 0.12, 0.20);
      } else if (type === 'step') {
        tone(130, 85, 0.045, 'triangle', 0.06, 0);
      }
    } catch {}
  }
  globalThis.playSE = playSE;

  let fxQueue = [];
  function queueFX(kind, targetKind, targetId, text, color = '#ffe38e') {
    fxQueue.push({ kind, targetKind, targetId, text, color });
  }

  function flushFX() {
    if (!fxQueue.length || typeof document === 'undefined' || !document.querySelector) {
      fxQueue = [];
      return;
    }
    const items = fxQueue.splice(0, fxQueue.length);
    items.forEach((fx, idx) => {
      setTimeout(() => {
        try {
          const sel = fx.targetKind === 'enemy'
            ? `.enemy[data-id="${fx.targetId}"]`
            : `.mini[data-hero-id="${fx.targetId}"]`;
          const node = document.querySelector(sel);
          if (!node || !node.getBoundingClientRect) return;
          node.classList.remove('fx-shake', 'fx-heal', 'fx-hit');
          void node.offsetWidth;
          if (fx.kind === 'heal') node.classList.add('fx-heal');
          else if (fx.kind === 'hit') node.classList.add('fx-shake', 'fx-hit');
          else node.classList.add('fx-hit');

          const rect = node.getBoundingClientRect();
          if (!rect.width && !rect.height) return;
          const pop = document.createElement('div');
          pop.className = 'fx-float';
          pop.style.color = fx.color;
          pop.style.left = `${rect.left + rect.width / 2 + (idx % 3 - 1) * 14}px`;
          pop.style.top = `${rect.top + Math.min(28, rect.height / 3)}px`;
          pop.textContent = fx.text;
          document.body.appendChild(pop);
          setTimeout(() => pop.remove(), 950);
        } catch {}
      }, idx * 120);
    });
  }

  // === 2. Detailed SVG Job Crests & Canvas Adventurer Symbol ===
  function jobCrestSVG(jobId) {
    const j = DATA.jobs[jobId] || DATA.jobs.warrior;
    const id = jobId || 'warrior';
    let path = '';
    let color = '#e4ca97';
    if (['warrior', 'knight', 'paladin', 'samurai', 'berserker', 'general', 'dragoon', 'valkyrie', 'demonknight', 'warlord'].includes(id)) {
      color = '#f0c475';
      path = `<path d="M7 17L17 7M14 6l4 4-9 9-4-4 9-9zM5 19l3-1-2-2-1 3z" stroke="${color}" stroke-width="1.6" fill="none"/><path d="M12 4l6 2v5c0 4.2-2.7 7.6-6 9-3.3-1.4-6-4.8-6-9V6l6-2z" stroke="${color}" stroke-width="1.2" fill="${color}22"/>`;
    } else if (['priest', 'monk', 'bishop', 'druid', 'shaman', 'oracle', 'saint', 'hierophant'].includes(id)) {
      color = '#9be0a8';
      path = `<circle cx="12" cy="12" r="7" stroke="${color}" stroke-width="1.3" fill="${color}1a"/><path d="M12 6v12M6 12h12" stroke="${color}" stroke-width="2" stroke-linecap="round"/>`;
    } else if (['mage', 'warlock', 'sorcerer', 'sage', 'archmage', 'necromancer', 'chronomancer', 'alchemist', 'runesmith', 'onmyoji'].includes(id)) {
      color = '#87c4ff';
      path = `<polygon points="12,3 15,9 21,9.5 16.5,14 18,20 12,16.8 6,20 7.5,14 3,9.5 9,9" stroke="${color}" stroke-width="1.4" fill="${color}25"/><circle cx="12" cy="12" r="2.5" fill="${color}"/>`;
    } else {
      color = '#b9d88f';
      path = `<path d="M5 19L19 5M15 5h4v4" stroke="${color}" stroke-width="1.7" fill="none" stroke-linecap="round"/><path d="M6 7c5-2 10 3 8 8-5 2-10-3-8-8z" stroke="${color}" stroke-width="1.4" fill="${color}22"/>`;
    }
    return `<span class="hero-svg-badge" title="${esc(j.name)}"><svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">${path}</svg></span>`;
  }
  globalThis.jobCrestSVG = jobCrestSVG;

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

  // Rich Hack & Slash Gear Name with Catalog Titles (400) & Products (540) & Apparent Material Name
  const prevGearName = gearName;
  gearName = function(g) {
    if (!g) return '素手';
    const m = DATA.materials[g.material];
    const matDisplayName = g.identified || isMaterialIdentified(g.material) ? (m?.name || g.material) : apparentMaterialName(g.material);
    const rar = RARITY_DEFS[g.rarity || 'common'];
    const rarityPrefix = g.rarity && g.rarity !== 'common' ? `【${rar.name}】` : '';
    const titleStr = g.customTitle ? g.customTitle : (g.titleId && CAT.itemTitles[g.titleId] ? CAT.itemTitles[g.titleId].name : (g.affix && DATA.affixes[g.affix] ? DATA.affixes[g.affix].name : ''));
    const prodStr = g.productId && CAT.products[g.productId] ? CAT.products[g.productId].name : (m?.category === 'stone' ? (g.slot === 'weapon' ? '石斧' : '石の護具') : (g.slot === 'weapon' ? '武器' : '防具'));
    return `${rarityPrefix}${titleStr}${matDisplayName}の${prodStr} Q${g.quality || 1}${g.enchant ? ' / ' + DATA.enchants[g.enchant].name : ''}`;
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

  // Track discovered materials automatically whenever addMaterial is called
  const prevAddMaterial = addMaterial;
  addMaterial = function(key, n, q = 1) {
    prevAddMaterial(key, n, q);
    if (key && n > 0) {
      const e = ext();
      if (!e.discoveredMaterials.includes(key)) e.discoveredMaterials.push(key);
    }
  };

  function isMaterialDiscovered(key) {
    const e = ext();
    return (s.materials?.[key] > 0) || e.discoveredMaterials.includes(key);
  }

  function isJobDiscovered(jobId) {
    const j = DATA.jobs[jobId];
    if (!j) return false;
    if (j.base) return true;
    const r = j.requirements;
    const maxLv = Math.max(...s.roster.map(h => h.lv), 1);
    const experiencedJobs = new Set(s.roster.flatMap(h => h.jobHistory || [h.job]));
    const learnedSkills = new Set(s.roster.flatMap(h => h.learned || []));
    if (experiencedJobs.has(jobId)) return true;
    if (r && experiencedJobs.has(r.job) && (learnedSkills.has(r.skill) || maxLv + 5 >= j.unlock)) return true;
    return false;
  }

  // Track visited maps when entering
  const prevEnterMap = enterMap;
  enterMap = function(id, corpseId = null) {
    prevEnterMap(id, corpseId);
    if (s.dungeon?.mapId) {
      const e = ext();
      if (!e.visitedMaps.includes(s.dungeon.mapId)) e.visitedMaps.push(s.dungeon.mapId);
    }
  };

  // Dynamic Monster Overlay: attach 400 Base Monsters & 160 Titles to encounters
  const prevEncounter = encounter;
  encounter = function(boss = false) {
    prevEncounter(boss);
    if (!s.battle || !s.dungeon) return;
    const e = ext();
    const lv = s.dungeon.level || 1;
    const monList = Object.values(CAT.monsters).filter(m => Math.abs(m.level - lv) <= 22);
    const titleList = Object.values(CAT.monsterTitles).filter(t => t.minLv <= lv + 15 && t.maxLv >= Math.max(1, lv - 15));

    // Default allyTarget to the most wounded party member or actor
    const wounded = party().filter(h => h.hp > 0).sort((a, b) => (a.hp / stats(a).hp) - (b.hp / stats(b).hp));
    s.battle.allyTarget = wounded[0]?.id || s.battle.actor || party()[0]?.id || 1;
    s.battle.lastTurnDigest = [`⚠️ 遭遇：${s.battle.enemies.map(x => x.name).join('、')} が立ちふさがった！`];

    s.battle.enemies.forEach(foe => {
      const baseMon = monList.length && !boss ? pick(monList) : null;
      const monTitle = titleList.length && random() < (boss ? 0.85 : 0.45) ? pick(titleList) : null;
      const isElite = !boss && random() < 0.15;

      if (baseMon) {
        foe.catalogId = baseMon.id;
        foe.ecology = baseMon.ecology;
        foe.craftHint = baseMon.craftHint;
        e.discoveredMonsters[baseMon.id] = (e.discoveredMonsters[baseMon.id] || 0) + 1;
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
    render();
  };

  // Wrap Combat Actions for SE, Floating Numbers & Turn Digest
  let currentTurnDigest = null;
  function pushDigest(line) {
    if (currentTurnDigest) currentTurnDigest.push(line);
  }

  const prevHeroAttack = heroAttack;
  heroAttack = function(h, e, multiplier = 1, elementOverride = null, spend = true) {
    const beforeHp = e ? e.hp : 0;
    const n = prevHeroAttack(h, e, multiplier, elementOverride, spend);
    if (e && n > 0) {
      const g = item(h.weapon), ench = g?.dur ? DATA.enchants[g.enchant] : null;
      const el = elementOverride || ench?.element || 'physical';
      const isWeak = e.weak === el;
      playSE(el === 'physical' ? 'slash' : el);
      queueFX('attack', 'enemy', e.key, `-${n}${isWeak ? ' WEAK!' : ''}`, isWeak ? '#ffae52' : '#ff8a7a');
      pushDigest(`🗡️ <b>${esc(h.name)}</b>の攻撃 → <b>${esc(e.name)}</b> に <b class="gold">${n}</b> ダメージ！${isWeak ? '（弱点！）' : ''}${e.hp <= 0 && beforeHp > 0 ? ' 【撃破！】' : ''}`);
    }
    return n;
  };

  const prevAllyDamage = allyDamage;
  allyDamage = function(h, power, magic = false, guarding = false) {
    const n = prevAllyDamage(h, power, magic, guarding);
    if (h && n > 0) {
      playSE('hit');
      queueFX('hit', 'ally', h.id, `-${n}`, '#ff6b6b');
      pushDigest(`💥 <b>${esc(h.name)}</b> が <b>${n}</b> ダメージを受けた！${guarding ? '（防御軽減）' : ''}${h.hp <= 0 ? ' 【戦闘不能】' : ''}`);
    }
    return n;
  };

  const prevCast = cast;
  cast = function(h, target, skillId) {
    const k = DATA.skills[skillId];
    const foeBefore = enemyAlive().map(e => ({ key: e.key, name: e.name, hp: e.hp }));
    const allyBefore = party().map(a => ({ id: a.id, name: a.name, hp: a.hp, poison: a.poison }));
    // Exaggerate / amplify skill impact (+35% effect boost) so skills feel dramatically stronger than basic attacks!
    const origPower = k ? k.power : null;
    if (k && typeof k.power === 'number') {
      if (['attack', 'damage', 'drain', 'heal', 'poison'].includes(k.kind)) k.power = +(k.power * 1.35).toFixed(2);
      else if (k.kind === 'rally') k.power = +(k.power * 1.15).toFixed(2);
    }
    try {
      prevCast(h, target, skillId);
    } finally {
      if (k && origPower !== null) k.power = origPower;
    }
    if (!k) return;
    if (k.kind === 'heal' || k.kind === 'cleanse') {
      playSE('heal');
      for (const prevA of allyBefore) {
        const curA = party().find(a => a.id === prevA.id);
        if (!curA) continue;
        const diff = curA.hp - prevA.hp;
        if (diff > 0) {
          queueFX('heal', 'ally', curA.id, `✨+${diff}`, '#74f29c');
          pushDigest(`✨ <b>${esc(h.name)}</b>の秘技『${esc(k.name)}』 → <b>${esc(curA.name)}</b> のLIFEが <b style="color:#74f29c">+${diff}</b> 大回復！`);
        } else if (prevA.poison && !curA.poison) {
          queueFX('heal', 'ally', curA.id, `CLEANSE!`, '#74f29c');
          pushDigest(`✨ <b>${esc(h.name)}</b>の『${esc(k.name)}』 → <b>${esc(curA.name)}</b> の猛毒を完全浄化！`);
        }
      }
    } else if (k.kind === 'guard' || k.kind === 'rally') {
      playSE('buff');
      queueFX('heal', 'ally', h.id, `★${k.name}!`, '#ffd97d');
      pushDigest(`🛡️ <b>${esc(h.name)}</b>が『${esc(k.name)}』を発動！戦場に力強い加護が満ちる！`);
    } else if (k.kind === 'damage' || k.kind === 'drain' || k.kind === 'poison' || k.kind === 'attack') {
      playSE(k.element || 'fire');
      for (const prevE of foeBefore) {
        const curE = s.battle?.enemies?.find(e => e.key === prevE.key);
        if (!curE) continue;
        const diff = prevE.hp - curE.hp;
        if (diff > 0) {
          const isWeak = curE.weak === k.element;
          queueFX('attack', 'enemy', curE.key, `💥-${diff}${isWeak ? ' WEAK!!' : '!'}`, isWeak ? '#ffbe42' : '#87c4ff');
          pushDigest(`⚡ <b>${esc(h.name)}</b>の必殺技『${esc(k.name)}』 → <b>${esc(curE.name)}</b> に <b class="gold">${diff}</b> の大ダメージ！${isWeak ? '【弱点直撃！】' : ''}${curE.hp <= 0 ? ' 【撃破！】' : ''}`);
        }
      }
    }
  };

  const prevUseItem = useItem;
  useItem = function(key, heroId, inBattle = false, enemyId = null, user = null) {
    const def = DATA.items[key];
    const h = s.roster.find(x => x.id === heroId);
    const hpBefore = h ? h.hp : 0, mpBefore = h ? h.mp : 0, spBefore = h ? h.sp : 0;
    const ok = prevUseItem(key, heroId, inBattle, enemyId, user);
    if (ok && def) {
      if (['heal', 'mp', 'sp', 'revive', 'cleanse'].includes(def.kind) && h) {
        playSE('heal');
        const gain = (h.hp - hpBefore) || (h.mp - mpBefore) || ((h.sp || 0) - (spBefore || 0));
        queueFX('heal', 'ally', h.id, gain > 0 ? `+${gain}` : def.name, '#74f29c');
        pushDigest(`🧪 <b>${esc((user || h).name)}</b>が『${esc(def.name)}』を使用 → <b>${esc(h.name)}</b> ${gain > 0 ? `+${gain} 回復！` : 'を治療！'}`);
      } else if (def.kind === 'damage') {
        playSE(def.element || 'fire');
        pushDigest(`💣 <b>${esc(user?.name || '仲間')}</b>が『${esc(def.name)}』を投擲！`);
      }
    }
    return ok;
  };

  const prevExecuteTurn = executeTurn;
  executeTurn = function() {
    const b = s.battle;
    if (!b || alive().some(h => !b.plans[h.id])) return prevExecuteTurn();
    currentTurnDigest = [];
    prevExecuteTurn();
    if (s.battle && currentTurnDigest.length) {
      s.battle.lastTurnDigest = currentTurnDigest.slice(0, 12);
      // Auto-select most wounded ally for next turn's default allyTarget
      const wounded = party().filter(h => h.hp > 0).sort((a, c) => (a.hp / stats(a).hp) - (c.hp / stats(c).hp));
      if (wounded[0] && wounded[0].hp < stats(wounded[0]).hp * 0.75) {
        s.battle.allyTarget = wounded[0].id;
      }
      render();
    }
    currentTurnDigest = null;
    flushFX();
  };

  // Hook Victory for Hack & Slash Loot & Discovery Jackpots
  const prevVictory = victory;
  victory = function() {
    const b = s.battle, d = s.dungeon;
    if (b && d) {
      playSE('victory');
      const hasElite = b.enemies.some(e => e.elite);
      if (b.boss || hasElite || random() < 0.35) {
        const g = rollHackSlashGear(d.level, b.boss ? 'rare' : hasElite ? 'magic' : null);
        s.gear.push(g);
        if (g.material && !ext().discoveredMaterials.includes(g.material)) ext().discoveredMaterials.push(g.material);
        note(`✨【戦利品】${gearName(g)}を入手！`);
      }
      const discLogs = rollDiscoveryDrops(d.level, b.boss || hasElite);
      discLogs.forEach(msg => note(msg));
    }
    prevVictory();
  };

  const prevDefeat = defeat;
  defeat = function() {
    playSE('defeat');
    prevDefeat();
  };

  // Mask unidentified mineral names in gather messages so even dungeon logs say "石 Q1を採集した。"
  const prevTell = tell;
  tell = function(msg) {
    let masked = String(msg || '');
    if (masked.includes('を採集した') || masked.includes('古い採集跡から')) {
      for (const [k, m] of Object.entries(DATA.materials)) {
        if (m?.name && !isMaterialIdentified(k) && masked.includes(m.name)) {
          masked = masked.split(m.name).join(apparentMaterialName(k));
        }
      }
    }
    return prevTell(masked);
  };

  // Hook Step for Chest Jackpot ('c') & SE
  const prevStep = step;
  step = function(dx, dy, automatic = false) {
    const d = s.dungeon;
    const tileBefore = d?.map?.[d.y + dy]?.[d.x + dx];
    prevStep(dx, dy, automatic);
    if (d && s.dungeon && !s.battle && !automatic) playSE('step');
    if (d && tileBefore === 'c' && s.dungeon) {
      playSE('loot');
      if (random() < 0.55) {
        const g = rollHackSlashGear(d.level + 5, random() < 0.3 ? 'rare' : 'magic');
        s.gear.push(g);
        if (g.material && !ext().discoveredMaterials.includes(g.material)) ext().discoveredMaterials.push(g.material);
        tell(`▣ 宝箱から ${gearName(g)} を発見した！`);
      }
      const discLogs = rollDiscoveryDrops(d.level + 5, true);
      if (discLogs.length) tell(discLogs[0]);
    }
  };

  // Helper: BFS Shortest Path on Seen Walkable Tiles back to Entrance (1, 1)
  function findPathToEntrance(d) {
    if (!d || (d.x === 1 && d.y === 1)) return [];
    const queue = [[d.x, d.y, []]];
    const visited = new Set([`${d.x},${d.y}`]);
    while (queue.length) {
      const [cx, cy, path] = queue.shift();
      if (cx === 1 && cy === 1) return path;
      for (const [dx, dy] of DIRS) {
        const nx = cx + dx, ny = cy + dy, key = `${nx},${ny}`;
        if (d.map[ny]?.[nx] && d.map[ny][nx] !== '#' && d.seen[ny]?.[nx] && !visited.has(key)) {
          visited.add(key);
          queue.push([nx, ny, [...path, [dx, dy]]]);
        }
      }
    }
    return null;
  }

  function walkTowardEntrance() {
    const d = s.dungeon;
    if (!d || s.battle) return;
    if (d.x === 1 && d.y === 1) {
      returnTown();
      return;
    }
    const path = findPathToEntrance(d);
    if (!path || !path.length) {
      tell('入口(1,1)への経路が見えません。周囲を移動して通路を確認してください。');
      return render();
    }
    // Walk up to 5 steps along discovered path toward (1,1), stopping immediately if an encounter occurs
    let moved = 0;
    for (const [dx, dy] of path.slice(0, 5)) {
      if (!s.dungeon || s.battle) break;
      step(dx, dy, false);
      moved++;
      if (s.dungeon && s.dungeon.x === 1 && s.dungeon.y === 1) {
        tell('🏠 入口(1,1)に到着しました！「入口から街へ帰還」で帰還符を使わずに街へ戻れます。');
        break;
      }
    }
    if (s.dungeon && !s.battle && (s.dungeon.x !== 1 || s.dungeon.y !== 1)) {
      const rem = findPathToEntrance(s.dungeon);
      tell(`🚶 入口(1,1)へ向かって ${moved}歩 移動しました（残り ${rem ? rem.length : '?'}歩）。`);
    }
    render();
  }
  globalThis.walkTowardEntrance = walkTowardEntrance;

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
      playSE('loot');
      tell(`⚒ ${gearName(g)}（品質指数Q${ev.calcQ}・伝達率${Math.round(ev.eta * 100)}%）を鍛造！`);
      render();
    }
  };

  // === 3. Enhanced Canvas Map Drawing (Entrance Marker & Detailed Adventurer Sprite) ===
  draw = function() {
    const canvas = $('map');
    if (!canvas || !s.dungeon) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const d = s.dungeon, z = 35, ox = (760 - 19 * z) / 2, oy = 22;
    ctx.fillStyle = '#0d1710';
    ctx.fillRect(0, 0, 760, 500);

    for (let y = 0; y < 13; y++) {
      for (let x = 0; x < 19; x++) {
        const px = ox + x * z, py = oy + y * z;
        if (!d.seen[y][x]) {
          ctx.fillStyle = '#101c13';
          ctx.fillRect(px, py, z - 1, z - 1);
          continue;
        }
        const t = d.map[y][x];
        ctx.fillStyle = t === '#' ? (worldMap(d.mapId).color || '#394b38') : '#243627';
        ctx.fillRect(px, py, z - 1, z - 1);
        if (t === '#') {
          ctx.fillStyle = '#50604a';
          ctx.fillRect(px, py, z - 1, 3);
          ctx.fillStyle = '#293d29';
          ctx.fillRect(px + 4, py + 14, 25, 2);
        } else {
          ctx.fillStyle = '#3b5036';
          ctx.fillRect(px + 6, py + 27, 5, 2);
        }
        // Highlight Entrance (1, 1) clearly!
        if (x === 1 && y === 1) {
          ctx.fillStyle = '#2e4c36';
          ctx.fillRect(px + 2, py + 2, z - 5, z - 5);
          ctx.font = 'bold 18px Georgia';
          ctx.textAlign = 'center';
          ctx.fillStyle = '#9be0a8';
          ctx.fillText('⌂', px + 17, py + 23);
        }
        const mark = { o: '◆', c: '▣', '>': '◎', '!': '✧' }[t];
        if (mark) {
          ctx.font = '24px Georgia';
          ctx.textAlign = 'center';
          ctx.fillStyle = t === 'o' ? '#8bb9b1' : '#d7bd80';
          ctx.fillText(mark, px + 17, py + 26);
        }
      }
    }

    for (const c of s.corpses) {
      if (c.floor.seed === d.seed && c.floor.depth === d.depth && d.seen[c.floor.y][c.floor.x]) {
        ctx.font = '28px Georgia';
        ctx.fillStyle = '#f0b69c';
        ctx.textAlign = 'center';
        ctx.fillText('†', ox + c.floor.x * z + 17, oy + c.floor.y * z + 27);
      }
    }

    // Draw Adventurer Party Leader Sprite at (d.x, d.y)
    const px = ox + d.x * z + 17, py = oy + d.y * z + 17;
    const g = ctx.createRadialGradient(px, py, 2, px, py, 76);
    g.addColorStop(0, '#edce7c77');
    g.addColorStop(1, '#edce7c00');
    ctx.fillStyle = g;
    ctx.fillRect(px - 76, py - 76, 152, 152);

    // Shadow
    ctx.fillStyle = '#08100b99';
    ctx.beginPath();
    ctx.ellipse ? ctx.ellipse(px, py + 12, 9, 4, 0, 0, Math.PI * 2) : ctx.arc(px, py + 12, 7, 0, Math.PI * 2);
    ctx.fill();

    // Cloak & Tunic Body
    ctx.fillStyle = '#385741';
    ctx.beginPath();
    ctx.moveTo(px - 9, py + 11);
    ctx.lineTo(px - 5, py - 2);
    ctx.lineTo(px + 5, py - 2);
    ctx.lineTo(px + 9, py + 11);
    ctx.closePath();
    ctx.fill();

    // Armor / Chestplate highlight
    ctx.fillStyle = '#c8aa6e';
    ctx.fillRect(px - 4, py, 8, 8);

    // Shield on left side
    ctx.fillStyle = '#8b6f3e';
    ctx.fillRect(px - 9, py + 1, 4, 8);
    ctx.fillStyle = '#e5cf9c';
    ctx.fillRect(px - 8, py + 2, 2, 6);

    // Head & Adventurer Hood/Helm
    ctx.fillStyle = '#f2dec0';
    ctx.beginPath();
    ctx.arc(px, py - 6, 5.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#5c4628';
    ctx.beginPath();
    ctx.arc(px, py - 7.5, 5.6, Math.PI, Math.PI * 2);
    ctx.fill();
    // Visor/Eyes
    ctx.fillStyle = '#1b261e';
    ctx.fillRect(px - 3, py - 6, 2, 1.5);
    ctx.fillRect(px + 1, py - 6, 2, 1.5);

    // Directional Weapon / Lantern Indicator
    const [dx, dy] = DIRS[d.facing] || [1, 0];
    ctx.strokeStyle = '#fff1c2';
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(px + dx * 4, py + dy * 4);
    ctx.lineTo(px + dx * 14, py + dy * 14);
    ctx.stroke();
    ctx.fillStyle = '#ffdf7a';
    ctx.beginPath();
    ctx.arc(px + dx * 13, py + dy * 13, 3, 0, Math.PI * 2);
    ctx.fill();
  };

  // === 4. UI Overrides: Character Symbols, Battle Target Selection, Digest & Walking Return ===
  uiPlanName = function(p, h) {
    if (!p) return '未選択';
    let label = commandName(p.command, h) || p.command;
    if (p.command === 'skill') label = DATA.skills?.[p.skill]?.name || DATA.jobs[h.job].skillName;
    if (p.command === 'item') label = DATA.items?.[p.item]?.name || '道具';
    const k = p.command === 'skill' ? DATA.skills?.[p.skill] : null;
    const it = p.command === 'item' ? DATA.items?.[p.item] : null;
    if (p.command === 'defend') return '🛡️ 防御';
    if (p.command === 'escape') return '🏃 逃走';
    if (k?.target === 'allAllies') return `${label} → 味方全員`;
    if (k?.target === 'allEnemies') return `${label} → 敵全体`;
    if (k?.target === 'self') return `${label} → 自分`;
    const isAlly = (k && k.target === 'ally') || (it && ['heal', 'mp', 'sp', 'revive', 'cleanse'].includes(it.kind));
    if (isAlly) {
      const al = party().find(a => a.id === p.target) || h;
      return `${label} → ${al.name}`;
    }
    const foe = s.battle?.enemies?.find(e => e.key === p.target) || enemyAlive()[0];
    return foe ? `${label} → ${foe.name}` : label;
  };

  mini = function(h, battle = false) {
    const j = DATA.jobs[h.job], p = battle ? s.battle?.plans[h.id] : null;
    const isActor = battle && s.battle?.actor === h.id;
    const isAllyTarget = battle && s.battle?.allyTarget === h.id;
    return `<article class="mini ${h.hp <= 0 ? 'dead' : ''} ${isActor ? 'selected' : ''} ${isAllyTarget ? 'ally-targeted' : ''}" data-hero-id="${h.id}">
      <button class="hero-link" data-action="character" data-id="${h.id}" aria-label="${esc(h.name)}の詳細">
        ${jobCrestSVG(h.job)}
        <b>${esc(h.name)}</b>
        <small>詳細 ↗</small>
      </button>
      <div class="numbers"><span>${esc(j.name)} Lv.${h.lv}</span><span>${h.row === 'front' ? '前衛' : '後衛'}</span></div>
      ${bars(h)}
      ${battle ? `<div class="mini-plan">
        <span>${p ? '✓ ' + esc(uiPlanName(p, h)) : '⚠️ 行動未選択'}</span>
        <div style="display:flex;gap:3px">
          ${btn('✚回復先に指定', 'ally-target-pick', `data-id="${h.id}" title="回復・補助の対象にする"`, isAllyTarget ? 'primary' : '')}
          ${btn(p ? '🔄行動変更' : '▶行動を選ぶ', 'actor', `data-id="${h.id}" ${h.hp <= 0 ? 'disabled' : ''}`, isActor ? 'selected' : '')}
        </div>
      </div>` : ''}
    </article>`;
  };

  uiBattlePanel = function() {
    const b = s.battle, h = alive().find(x => x.id === b.actor) || alive()[0];
    if (!h) return '<section class="panel">行動できる仲間がいません。</section>';
    if (!b.allyTarget || !party().some(a => a.id === b.allyTarget)) {
      const wounded = party().filter(a => a.hp > 0).sort((x, y) => (x.hp / stats(x).hp) - (y.hp / stats(y).hp));
      b.allyTarget = wounded[0]?.id || h.id;
    }
    const skills = uiSkillList(h).filter(sk => sk.level <= h.lv);
    const usableItems = Object.entries(DATA.items).filter(([id, it]) => it.kind !== 'escape' && uiCount(id) > 0);
    const curEnemy = enemyAlive().find(e => e.key === b.target) || enemyAlive()[0];
    const curAlly = party().find(a => a.id === b.allyTarget) || h;

    return `<section class="panel battle-console">
      <div class="row between">
        <h2>⚔ 行動指示パネル</h2>
        <div class="row">
          ${btn(ext().soundOn ? '🔊 SE ON' : '🔇 SE OFF', 'toggle-se', '', 'chip')}
          <span class="chip">TURN ${b.turn}</span>
        </div>
      </div>

      <div class="quest-box" style="margin:8px 0">
        <b>① 誰の行動を決める？（クリックでいつでも再決定・やり直し可能）</b>
        <div class="ally-picker" style="margin-top:6px">
          ${alive().map(a => {
            const p = b.plans[a.id];
            const active = b.actor === a.id;
            return `<button type="button" class="ally-pick-btn ${active ? 'selected' : ''}" data-action="actor" data-id="${a.id}">
              <b>${active ? '▶ 指示中: ' : ''}${esc(a.name)}</b>
              <small>${p ? '✓ ' + esc(uiPlanName(p, a)) : '⚠️ 未選択'}</small>
            </button>`;
          }).join('')}
        </div>
      </div>

      <div class="quest-box" style="margin:8px 0">
        <b>② ターゲット選択（攻撃する敵 ／ 回復・補助する味方）</b>
        <div class="target-fields" style="margin-top:6px">
          <div>
            <small class="gold">🗡️ 攻撃対象の敵（現在：${esc(curEnemy?.name || 'なし')}）</small>
            <div class="actions" style="margin-top:4px">
              ${enemyAlive().map(e => `<button type="button" class="${b.target === e.key ? 'primary' : ''}" data-action="target" data-id="${e.key}" style="padding:4px 8px;font-size:11px">
                ${ b.target === e.key ? '🎯 ' : ''}${esc(e.name)} ${knowledge(e.id).tier >= 2 ? `(HP:${e.hp})` : ''}
              </button>`).join('')}
            </div>
            <select id="enemy-target" data-ext-change="enemy-target" style="display:none">
              ${enemyAlive().map(e => `<option value="${e.key}" ${b.target === e.key ? 'selected' : ''}>${esc(e.name)}</option>`).join('')}
            </select>
          </div>
          <div>
            <small style="color:#74f29c">✚ 回復・補助する味方（現在：${esc(curAlly?.name || h.name)}）</small>
            <div class="ally-picker" style="margin-top:4px">
              ${party().map(a => `<button type="button" class="ally-pick-btn ${b.allyTarget === a.id ? 'ally-selected' : ''}" data-action="ally-target-pick" data-id="${a.id}">
                <b>${b.allyTarget === a.id ? '✚ ' : ''}${esc(a.name)}</b>
                <small>HP ${a.hp}/${stats(a).hp}${a.poison ? ' [毒]' : ''}</small>
              </button>`).join('')}
            </div>
            <select id="ally-target" data-ext-change="ally-target" style="display:none">
              ${party().map(a => `<option value="${a.id}" ${b.allyTarget === a.id ? 'selected' : ''}>${esc(a.name)}</option>`).join('')}
            </select>
          </div>
        </div>
      </div>

      <div class="quest-box" style="margin:8px 0">
        <b>③ ${jobCrestSVG(h.job)} ${esc(h.name)} の行動コマンドを選ぶ</b>
        <div class="command-buttons" style="margin-top:6px">
          ${btn(`🗡️ 通常攻撃（→ ${esc(curEnemy?.name || '敵')}）`, 'command', 'data-command="attack"', 'primary')}
          ${btn('🛡️ 身を守る（防御）', 'command', 'data-command="defend"')}
          ${btn('🏃 撤退を試みる', 'command', 'data-command="escape"')}
        </div>
        <div class="skill-buttons">
          ${skills.map(sk => {
            const isAllySk = ['ally', 'self', 'allAllies'].includes(sk.target);
            const tLabel = sk.target === 'allEnemies' ? '敵全体' : sk.target === 'allAllies' ? '味方全員' : sk.target === 'self' ? '自分' : isAllySk ? curAlly.name : (curEnemy?.name || '敵');
            return btn(`✨ ${esc(sk.name)} → ${esc(tLabel)} <small>MANA ${sk.mp} / SP ${sk.sp || 0}</small>`, 'command', `data-command="skill" data-skill="${sk.id}" title="${esc(sk.desc || '')}" ${h.mp < sk.mp || h.sp < (sk.sp || 0) ? 'disabled' : ''}`);
          }).join('')}
        </div>
        ${usableItems.length ? `<details class="battle-items" open>
          <summary>🧪 道具を使う（対象：${esc(curAlly.name)} / ${esc(curEnemy?.name || '敵')}）</summary>
          <div class="supply-buttons">
            ${usableItems.map(([id, it]) => btn(`${esc(it.name)} ×${uiCount(id)}`, 'command', `data-command="item" data-item="${id}" title="${esc(it.desc)}"`)).join('')}
          </div>
        </details>` : ''}
      </div>

      <div class="turn-list">
        ${alive().map(a => {
          const p = b.plans[a.id];
          return `<div>
            <span><b>${esc(a.name)}</b>：${p ? `<b class="gold">${esc(uiPlanName(p, a))}</b>` : '<span class="status">未選択</span>'}</span>
            ${btn(p ? '🔄 再決定' : '選択する', 'actor', `data-id="${a.id}"`, b.actor === a.id ? 'primary' : '')}
          </div>`;
        }).join('')}
      </div>
      <div class="actions">
        ${btn('⚡ 全員の行動を実行する →', 'execute', alive().some(a => !b.plans[a.id]) || battleTimer ? 'disabled' : '', 'primary')}
        ${btn('全員おまかせ入力', 'template', battleTimer ? 'disabled' : '')}
        ${btn(battleTimer ? '自動戦闘 停止' : '自動戦闘', 'auto-battle')}
      </div>
    </section>`;
  };

  const prevExploreScreen = exploreScreen;
  exploreScreen = function() {
    const d = s.dungeon;
    if (!d) return townScreen();
    const map = worldMap(d.mapId), t = d.map[d.y][d.x], battle = !!s.battle;
    const atEntrance = d.x === 1 && d.y === 1;
    const pathBack = !atEntrance ? findPathToEntrance(d) : [];
    const stepsBack = pathBack ? pathBack.length : Math.abs(d.x - 1) + Math.abs(d.y - 1);
    const digestHTML = battle && s.battle.lastTurnDigest?.length
      ? `<div class="battle-digest" role="status" aria-live="polite"><b>⚡ 戦闘展開ログ（TURN ${s.battle.turn}）</b>${s.battle.lastTurnDigest.map(line => `<p>${line}</p>`).join('')}</div>`
      : '';

    return `<div class="sectionhead expedition-head">
      <div>
        <p class="eyebrow">${battle ? 'RANDOM ENCOUNTER · TURN ' + s.battle.turn : 'EXPEDITION'}</p>
        <h1>${esc(map?.name || '忘れられた鉱廊')} <span class="gold">B${d.depth}</span></h1>
      </div>
      <div class="row">
        ${btn(ext().soundOn ? '🔊 SE ON' : '🔇 SE OFF', 'toggle-se', '', 'chip')}
        <span class="chip">地域 Lv.${d.level || map?.level || 1} · 品質 Q${d.quality || 1} · ${d.steps}歩</span>
      </div>
    </div>
    <div class="expedition-layout ${battle ? 'in-battle' : ''}">
      <section class="expedition-map">
        <div class="panel map-panel">
          <canvas id="map" width="760" height="500" aria-label="探索地図。⌂入口(1,1)、◆素材、▣宝箱、◎階段、✧封印、†残留装備。"></canvas>
          <div class="map-caption">
            <span>⌂ 入口(1,1)　◆ 素材　▣ 宝箱　◎ 階段　† 装備</span>
            <span>現在地 (${d.x}, ${d.y}) ${atEntrance ? '【⌂入口】' : `· 入口まで約${stepsBack}歩`} ${battle ? ' / 戦闘中' : ''}</span>
          </div>
          ${battle ? '' : `<div class="map-controls">
            <div class="dpad">
              ${btn('↑', 'step', 'data-dx="0" data-dy="-1" aria-label="北へ"')}
              ${btn('←', 'step', 'data-dx="-1" data-dy="0" aria-label="西へ"')}
              ${btn('↓', 'step', 'data-dx="0" data-dy="1" aria-label="南へ"')}
              ${btn('→', 'step', 'data-dx="1" data-dy="0" aria-label="東へ"')}
            </div>
            <div class="map-command-stack">
              ${btn(walkTimer ? '自動歩行 停止' : '自動歩行', 'walk')}
              ${t === '>' ? btn('次の階へ ↓', 'descend', '', 'primary') : t === '!' ? btn('封印に触れる', 'boss', '', 'danger') : ''}
              ${atEntrance
                ? btn('🏠 入口から街へ帰還（無料）', 'return', '', 'primary')
                : `${btn(`🚶 徒歩で入口(1,1)へ戻る（あと${stepsBack}歩）`, 'walk-entrance')}${btn(`📜 帰還符で即帰還（残${s.items.scroll || 0}）`, 'return', !(s.items.scroll > 0) ? 'disabled' : '')}`
              }
            </div>
          </div>`}
        </div>
        ${battle ? '' : `<div class="return-guide">
          <span>🧭 <b>徒歩での帰還方法：</b>左上の <b>⌂ 入口 (1, 1)</b> マスまで歩いて戻れば、帰還符なしでいつでも街へ帰還できます。</span>
          ${atEntrance ? `<span class="gold">✓ 現在 ⌂入口(1,1) にいます！そのまま帰還可能</span>` : btn(`🚶 発見済み通路を辿って入口へ戻る`, 'walk-entrance')}
        </div>`}
        <div class="expedition-auto">
          <div><b>連続自動探索</b><small>歩行 → 戦闘 → 歩行 / 階段・封印で停止</small></div>
          ${btn(s.autoExpedition ? 'Ⅱ 停止' : '▷ 開始', 'expedition', '', s.autoExpedition ? 'selected' : 'primary')}
        </div>
        <p class="muted auto-warning">${s.autoExpedition ? '連続探索中' : '初期設定は右手法・先頭への通常攻撃。回復と撤退は行動書で解放。'}</p>
        ${digestHTML}
        ${battle ? uiEnemies() : ''}
        <div class="explore-party">${strip(battle)}</div>
      </section>
      <aside class="expedition-side">
        ${battle ? uiBattlePanel() : `<section class="panel">${uiFieldSupplies()}<p class="muted">WASD / 矢印でも移動。通常敵は移動時のランダム遭遇です。</p></section>`}
        <section class="panel expedition-log"><p class="eyebrow">RECENT LOG</p>${logHTML(battle ? 6 : 8)}</section>
      </aside>
    </div>`;
  };
  battleScreen = exploreScreen;

  // === 5. Address Discovery with Expedition Cost & Level Gate ===
  const prevDiscoverAddress = discoverAddress;
  discoverAddress = function(input) {
    const text = (input || '').trim();
    if (!text) return;
    const plan = addressBlueprint(text);
    const pLv = partyLevel();
    const reqLv = Math.max(1, plan.map.level - 25);
    const isInteractive = typeof document !== 'undefined' && document.getElementById('address') && document.getElementById('address').value === text;

    // When called from UI button (or when party is way below recommended level in interactive play)
    if (isInteractive) {
      const prepGold = Math.min(Math.max(0, s.gold), Math.max(25, Math.ceil(pLv * 18)));
      const usedRation = s.items.ration > 0 ? 'ration' : (s.items.potion > 0 ? 'potion' : null);
      if (pLv < reqLv) {
        s.gold = Math.max(0, s.gold - prepGold);
        if (usedRation) s.items[usedRation]--;
        s.addressPreview = null;
        playSE('defeat');
        tell(`❌ 道標『${text.slice(0, 18)}…』の方角へ調査隊を出したが、周辺の瘴気と魔物の脅威（推定推奨Lv.${plan.map.level}〜）が凄まじく、現在のパーティー（平均Lv.${pLv}）では辿り着けず撤退した…！（調査費 ${prepGold} G${usedRation ? '・' + DATA.items[usedRation].name + '1個' : ''} を消耗）`);
        return render();
      }
      // Successful expedition still requires some travel cost
      s.gold = Math.max(0, s.gold - prepGold);
      if (usedRation) s.items[usedRation]--;
      prevDiscoverAddress(text);
      playSE('loot');
      tell(`🧭 遠征費 ${prepGold} G${usedRation ? '・' + DATA.items[usedRation].name + '1個' : ''} を費やし、未知の街『${plan.town.name}』（推奨Lv.${plan.map.level}）への到達ルートを開拓した！`);
      return render();
    }
    return prevDiscoverAddress(text);
  };

  // Override materialsHTML so unidentified stones all appear as separate "石" entries (non-stacking!)
  materialsHTML = function() {
    const held = Object.entries(DATA.materials).filter(([id]) => (s.materials[id] || 0) > 0);
    if (!held.length) return `<div class="inventory-line"><span>素材なし</span></div>`;
    return `<div class="inventory-line">${held.map(([id]) => {
      const disp = apparentMaterialName(id);
      return `<span title="所持枠ID: ${id}">${esc(disp)} <b class="gold">${s.materials[id]}</b></span>`;
    }).join('')}</div>`;
  };

  // Helper: Check if active party has a Craftsman (sub-job or main job or craftLv > 1)
  function getPartyCraftsmen() {
    const e = ext();
    return s.roster.filter(h => {
      const sub = CAT.jobs[e.subJobs[h.id]];
      const isCraftSub = sub && ['鍛冶', '工', '細工', '木工', '革', '織', '薬', '錬金', '付与', '石'].some(w => (sub.name + sub.family + sub.role).includes(w));
      return isCraftSub || ['alchemist', 'runesmith', 'blacksmith', 'artificer'].includes(h.job) || h.id === 1;
    });
  }

  function getTitleByCraftSkill(skillLv, r) {
    const roll = r ? r() : random();
    if (skillLv >= 140 && roll < 0.45) return { prefix: '神匠の', bonus: 14, rarity: 'mythic' };
    if (skillLv >= 80 && roll < 0.5) return { prefix: '名匠の', bonus: 9, rarity: 'legendary' };
    if (skillLv >= 35 && roll < 0.55) return { prefix: '熟練の', bonus: 5, rarity: 'rare' };
    if (skillLv >= 12 && roll < 0.6) return { prefix: '良質な', bonus: 2, rarity: 'magic' };
    if (skillLv < 8 && roll < 0.35) return { prefix: '粗削りな', bonus: 0, rarity: 'common' };
    return { prefix: '素朴な', bonus: 1, rarity: 'common' };
  }

  // UI: Guild Screen (progressive map discovery + address expedition rules)
  guildScreen = function() {
    const e = ext();
    const preview = s.addressPreview;
    const maxLv = Math.max(partyLevel(), ...s.roster.map(h => h.lv), currentTown().level);
    const visibleMaps = DATA.maps.filter((m, idx) =>
      idx < 2 ||
      m.level <= maxLv + 12 ||
      e.visitedMaps.includes(m.id) ||
      s.quests?.[m.id]?.accepted ||
      s.quests?.[m.id]?.completed
    );
    const hiddenMapCount = Math.max(0, DATA.maps.length - visibleMaps.length);

    // Mask materials in uiMapCard if unidentified!
    const renderMapCard = map => {
      const q = map.quest, state = s.quests?.[map.id] || {}, quality = map.quality || Math.min(13, 1 + Math.floor(map.level / 25)), amount = q ? availableMaterial(q.material, quality) : 0;
      const enemyNames = (map.enemies || []).map(id => {
        const kn = knowledge(id);
        const en = DATA.enemies.find(x => x.id === id);
        return kn.tier > 0 ? (en?.name || id) : '？？？';
      });
      const matNames = (map.materials || []).map(id => apparentMaterialName(id));
      return `<article class="card atlas-card" style="--region:${esc(map.color || '#a7c291')}">
        <div class="row between"><span class="chip">推奨 Lv.${map.level} · ${map.depths}層</span><small>${esc(map.biome || '未分類')}</small></div>
        <h2>${esc(map.name)}</h2>
        <p class="muted">${esc(map.description || '未知の道を開拓する。')}</p>
        <div class="atlas-resource">
          <b>採れる資源</b><p>${matNames.map(esc).join('・')}</p>
          <b>確認された魔物</b><p>${enemyNames.map(esc).join('・')}</p>
        </div>
        ${q ? `<div class="quest-box">
          <b>${esc(q.name)}</b>
          <p>${esc(apparentMaterialName(q.material))} Q${quality}以上 ${q.amount}個を納品 / 報酬 ${q.reward} G</p>
          <small>所持 ${amount} / ${q.amount} · ${state.completed ? '達成済み' : state.accepted ? '受注中' : '未受注'}</small>
          <div class="actions">
            ${state.completed ? btn('再び依頼を受ける', 'accept-quest', `data-id="${esc(map.id)}"`) : state.accepted ? btn('素材を納品', 'deliver-quest', `data-id="${esc(map.id)}" ${amount < q.amount ? 'disabled' : ''}`) : btn('依頼を受ける', 'accept-quest', `data-id="${esc(map.id)}"`)}
          </div>
        </div>` : ''}
        ${btn('この地域を探索 →', 'enter-map', `data-id="${esc(map.id)}"`, 'primary wide')}
      </article>`;
    };

    return title('ATLAS & EXPLORERS GUILD', '次は、どの道を歩く？', '手探りで周辺の地理を広げ、未知の道標を調査する。') +
      `<div class="grid atlas-intro">
        <section class="panel">
          <h2>🧭 道標（アドレス）から未知の街を探索開拓</h2>
          <p class="muted">URL・メール・道標の言葉を頼りに遠征調査隊を派遣します。<br>※調査には<b>遠征費（金貨と携帯食・回復薬）</b>がかかります。また、<b>現在のパーティーの実力（Lv）が道標先の危険度に比べて低すぎる場合、コストだけ消費して探索失敗（撤退）</b>となります。</p>
          <label class="field">URL・メール・道標の言葉<input id="address" maxlength="200" placeholder="例：moon.example" autocomplete="off" spellcheck="false"></label>
          ${btn('遠征調査隊を派遣する（金貨・消耗品を消費）', 'discover-address', '', 'primary')}
          ${preview ? `<div class="discovery">
            <h3>✨ 到達成功：${esc(preview.town.name)} <span class="chip">街 Lv.${preview.town.level}</span></h3>
            <p>物価 ×${preview.town.price} / 工房品質 Q${preview.town.quality} / 拠点権 ${preview.town.baseCost} G</p>
            <p class="muted">${esc(preview.map.name)} / 推奨 Lv.${preview.map.level}</p>
            <div class="actions">
              ${btn('この街を訪れる', 'travel-town', `data-id="${esc(preview.town.id)}"`)}
              ${btn('拠点を購入する', 'settle-town', `data-id="${esc(preview.town.id)}" ${s.gold < preview.town.baseCost ? 'disabled' : ''}`)}
            </div>
          </div>` : ''}
        </section>
        <section class="panel">
          <h2>滞在先と残留装備</h2>
          <label class="muted">到達済みの街</label>
          <div class="town-list">${(s.towns || []).map(t => `<div><span>${esc(t.name)} <small>街Lv.${t.level} / 物価 ×${t.price}</small></span>${t.id === s.townId ? '<span class="chip">滞在中</span>' : btn('訪問', 'travel-town', `data-id="${esc(t.id)}"`)}</div>`).join('')}</div>
          ${s.homeTownId !== s.townId ? btn('購入済みの拠点へ戻る', 'home-town', '', 'wide') : ''}
          <hr class="divider">
          ${s.corpses.length ? s.corpses.map(c => `<div class="note"><p>† ${esc(worldMap(c.floor.mapId)?.name || '探索地域')} B${c.floor.depth} / 装備 ${c.gear.length}個</p><small>${c.until > Date.now() ? '再入場まで ' + Math.ceil((c.until - Date.now()) / 1000) + '秒' : '再入場可能'}</small>${btn('残留装備を回収する', 'recover', `data-id="${esc(c.id)}" ${c.until > Date.now() ? 'disabled' : ''}`, 'wide')}</div>`).join('<hr class="divider">') : '<p class="muted">回収待ちの装備はありません。</p>'}
        </section>
      </div>
      <div class="sectionhead"><h2>判明している探索地図</h2><span class="muted">発見済み ${visibleMaps.length}地域${hiddenMapCount ? `（未踏地域あり）` : ''}</span></div>
      <div class="grid three">${visibleMaps.map(renderMapCard).join('')}</div>
      ${(s.addressMaps || []).length ? `<h2 class="section-space">道標調査で到達した地域</h2><div class="grid three">${s.addressMaps.map(renderMapCard).join('')}</div>` : ''}`;
  };

  // UI: Character Detail Dialog (No internal math formulas! No job requirement spoilers! Only discovered jobs!)
  characterScreen = function(h) {
    const e = ext();
    const j = DATA.jobs[h.job], st = stats(h);
    const learnedSkills = uiSkillList(h).filter(sk => sk.level <= h.lv);
    // Check if any new main jobs were secretly unlocked by this hero's growth!
    for (const [jid] of Object.entries(DATA.jobs)) {
      if (canJob(h, jid) && !e.discoveredMainJobs.includes(jid)) {
        e.discoveredMainJobs.push(jid);
      }
    }
    const changeableJobs = Object.entries(DATA.jobs).filter(([id]) => canJob(h, id));

    return `<div class="hero-top">
      <div class="avatar">${jobCrestSVG(h.job)}</div>
      <div>
        <p class="eyebrow">CHARACTER RECORD</p>
        <h2>${esc(h.name)} <span class="gold">Lv.${h.lv}</span></h2>
        <small>${esc(j.name)} / ${h.row === 'front' ? '前衛' : '後衛'} / ${s.active.includes(h.id) ? '探索参加中' : '街で待機'}</small>
      </div>
    </div>
    ${bars(h)}
    ${uiStatList(st)}
    <p class="gold">経験値 ${h.xp} / ${xpNeeded(h)} · 次の成長まで ${Math.max(0, xpNeeded(h) - h.xp)}</p>
    <section class="detail-section">
      <h3>基礎能力</h3>
      <dl class="stat-grid">${Object.entries(attributes(h)).map(([k, n]) => `<div><dt>${k} · ${ATTRIBUTE_NAMES[k]}</dt><dd>${n}</dd></div>`).join('')}</dl>
    </section>
    <section class="detail-section">
      <h3>現在の装備</h3>
      ${['weapon', 'armor'].map(slot => {
        const g = item(h[slot]);
        return `<div class="detail-gear">
          <b>${slot === 'weapon' ? '武器' : '防具'}：${esc(g ? gearName(g) : '装備なし')}</b>
          ${g ? `<p class="muted">耐久 ${g.dur} / ${g.maxDur}${canEquip(h, g) ? '' : ' · ⚠️能力不足により性能発揮不可'}</p>` : ''}
        </div>`;
      }).join('')}
    </section>
    <section class="detail-section">
      <h3>体得した技 <small>${learnedSkills.length}種</small></h3>
      ${learnedSkills.map(sk => `<article class="skill-line">
        <div class="row between"><b>✨ ${esc(sk.name)}</b><span class="chip">消費 MANA ${sk.mp} / SP ${sk.sp || 0}</span></div>
        <p class="muted">${esc(sk.desc || '鍛錬によって体得した技。')}</p>
      </article>`).join('') || '<p class="muted">まだ体得した技はありません。実戦を重ねることで新たな技に目覚めることがあります。</p>'}
    </section>
    <section class="detail-section">
      <h3>現在就ける職業 <small>${changeableJobs.length}職</small></h3>
      <p class="muted">修練や技の体得によって、思いがけない天職への道が開かれることがあります。</p>
      <div class="actions">${changeableJobs.map(([id, jobDef]) => `<span class="chip">${esc(jobDef.name)}</span>`).join('')}</div>
    </section>
    ${s.battle && h.hp > 0 && s.active.includes(h.id) ? btn('この仲間に指示する', 'actor-close', `data-id="${h.id}"`, 'primary wide') : ''}`;
  };
  const prevUiEnemies = uiEnemies;
  uiEnemies = function() {
    if (!s.battle) return '';
    return `<div class="enemy-field">${s.battle.enemies.map(e => {
      const tier = knowledge(e.id).tier;
      const thumb = monsterThumbHTML(e.id, e.catalogId);
      return `<button class="enemy ${s.battle.target === e.key ? 'selected' : ''} ${e.hp <= 0 ? 'dead' : ''} ${e.elite ? 'rarity-legendary' : ''}" data-action="target" data-id="${e.key}" ${e.hp <= 0 ? 'disabled' : ''}>${thumb || `<span class="enemy-icon">${e.icon}</span>`}<b>${esc(e.name)}</b><small>脅威度 Lv.${e.level || s.dungeon?.level || 1} · 解析 ${tier}/4</small><small>${tier >= 2 ? 'HP ' + e.hp + ' / ' + e.maxhp : 'HP 未解析'}</small>${tier >= 2 ? `<div class="bar"><i style="width:${Math.max(0, e.hp / e.maxhp * 100)}%"></i></div>` : ''}<small>${tier >= 3 ? '弱点 ' + uiElement(e.weak) + ' / 耐性 ' + uiElement(e.resist) : '弱点・耐性 未解析'}</small>${e.ecology && tier >= 2 ? `<small class="muted">${esc(e.ecology)}</small>` : ''}${e.poison ? `<span class="status">毒 ${e.poison}T</span>` : ''}</button>`;
    }).join('')}</div>`;
  };

  // UI: Party Screen (Only show unlocked/discovered jobs! No locked job lists or requirement spoilers!)
  partyScreen = function() {
    const e = ext();
    const pr = partyPresets();
    const cost = typeof recruitCost === 'function' ? recruitCost() : 35;
    // Auto-record any newly unlocked main jobs across the roster
    for (const h of s.roster) {
      syncHero(h);
      for (const [jid] of Object.entries(DATA.jobs)) {
        if (canJob(h, jid) && !e.discoveredMainJobs.includes(jid)) {
          e.discoveredMainJobs.push(jid);
          note(`💡 経験と技の積み重ねにより、新たな天職『${DATA.jobs[jid].name}』への道が開かれた！`);
        }
      }
    }
    const unlockedSubJobs = e.unlockedJobIds.map(id => CAT.jobs[id]).filter(Boolean);
    const discoveredMainJobEntries = Object.entries(DATA.jobs).filter(([id]) => e.discoveredMainJobs.includes(id));

    return title('COMPANIONS & CALLINGS', '仲間の力を、組み合わせる。', '修練や探索の果てに、思いがけない天職や専門技術が目覚める。') +
      `<section class="panel" style="margin-bottom:18px">
        <div class="row between"><h2>編成セット保存・切替</h2><span class="muted">探索用・強敵用などの隊列を即座に切り替え</span></div>
        <div class="actions">${[1, 2, 3].map(n => `${btn('セット' + n + 'に保存', 'save-preset', `data-slot="${n}"`)}${btn('セット' + n + 'を呼出' + (pr[n] ? ' (' + pr[n].active.length + '人)' : ' (空)'), 'load-preset', `data-slot="${n}" ${pr[n] ? '' : 'disabled'}`, 'primary')}`).join('')}</div>
      </section>
      <div class="grid three">${s.roster.map(h => {
        const active = s.active.includes(h.id);
        const pts = heroFreePoints(h);
        const curSub = e.subJobs[h.id] || '';
        const subObj = CAT.jobs[curSub];
        const learnedSkills = uiSkillList(h).filter(sk => sk.level <= h.lv);
        // Only list jobs this character can actually take right now (plus their current job) — no locked spoilers!
        const availMainJobs = Object.entries(DATA.jobs).filter(([id]) => canJob(h, id) || h.job === id);
        const availSubJobs = unlockedSubJobs.filter(j => h.lv >= j.minLv || curSub === j.id);

        return `<article class="card ${active ? '' : 'locked'}">
          ${mini(h)}
          ${uiStatList(stats(h))}
          <p class="equipment">${esc(gearName(item(h.weapon)))}<br>${esc(h.armor ? gearName(item(h.armor)) : '防具なし')}</p>
          <p class="muted">体得技：${learnedSkills.map(sk => esc(sk.name)).join(' / ') || 'なし'}</p>
          <label class="field">主職業（転職可能な職のみ表示）
            <select data-change="job" data-id="${h.id}">
              ${availMainJobs.map(([id, v]) => `<option value="${id}" ${h.job === id ? 'selected' : ''}>${esc(v.name)}</option>`).join('')}
            </select>
          </label>
          <label class="field">専門職・副職（発見・到達済み）
            <select data-ext-change="subjob" data-hero="${h.id}">
              <option value="">なし（主職のみ）</option>
              ${availSubJobs.map(j => `<option value="${j.id}" ${curSub === j.id ? 'selected' : ''}>${esc(j.name)}（${esc(j.family)}）</option>`).join('')}
            </select>
          </label>
          ${subObj ? `<small class="muted">${esc(subObj.role)}</small>` : ''}
          ${pts > 0 ? `<div class="quest-box" style="margin:8px 0">
            <small class="gold">成長ポイント残り ${pts} Pt</small>
            <div class="actions" style="margin-top:4px">${Object.keys(ATTRIBUTE_NAMES).map(k =>
              `<button data-action="alloc-stat" data-hero="${h.id}" data-stat="${k}" style="padding:3px 7px;font-size:10px">${k}+1</button>`
            ).join('')}</div>
          </div>` : ''}
          <div class="actions">
            ${btn(active ? '街で待機' : '探索に参加', 'member', `data-id="${h.id}" ${active && s.active.length === 1 ? 'disabled' : ''}`)}
            ${btn(h.row === 'front' ? '後衛へ' : '前衛へ', 'row', `data-id="${h.id}"`)}
          </div>
        </article>`;
      }).join('')}</div>
      <section class="panel section-space">
        <h2>新しい仲間を迎える <small>${cost} G / 登録16人・参加6人まで</small></h2>
        <div class="row">
          <select id="recruit-job" class="inline-select" aria-label="募集する職業">
            ${Object.entries(DATA.jobs).filter(([, j]) => j.base && partyLevel() >= j.unlock).map(([id, j]) => `<option value="${id}">${esc(j.name)}</option>`).join('')}
          </select>
          ${btn('仲間を登録', 'recruit', s.gold < cost || s.roster.length >= 16 ? 'disabled' : '')}
        </div>
      </section>
      <section class="section-space">
        <h2>転職手帳（発見済みの職業記録）</h2>
        <p class="muted">これまでに見出した職業のみが記録されます。未知の職業は、様々な職業の経験や技の体得によってある日突然開かれます。</p>
        <div class="grid three">${discoveredMainJobEntries.map(([, j]) => `<article class="card">
          <h3>${j.icon} ${esc(j.name)}</h3>
          <p class="muted">伝承される技の一端：${(j.skills || [j.skill]).slice(0, 1).map(k => DATA.skills?.[k]?.name || '？？？').join('')}</p>
        </article>`).join('')}</div>
      </section>`;
  };

  // UI: Forge Screen (2 Modes: Town Workshop Commission vs Craftsman Self-Crafting + World Tech Scenarios)
  forgeScreen = function() {
    const e = ext();
    const town = currentTown();
    const ws = getTownWorkshop(town);
    const mode = e.forgeMode || 'workshop';
    const allowedRoutes = allowedRoutesByWorldTech();
    if (!allowedRoutes.includes(e.selectedRoute)) e.selectedRoute = allowedRoutes[0] || 'H';

    // Check available World Tech Scenarios for this Town Level
    const activeScenarios = TECH_SCENARIOS.filter(sc =>
      !e.completedTechScenarios.includes(sc.id) &&
      (!sc.prereq || e.completedTechScenarios.includes(sc.prereq)) &&
      town.level >= sc.minTownLv
    );
    const nextLockedScenario = TECH_SCENARIOS.find(sc =>
      !e.completedTechScenarios.includes(sc.id) &&
      (!sc.prereq || e.completedTechScenarios.includes(sc.prereq)) &&
      town.level < sc.minTownLv
    );

    // Craftsman candidates
    const craftsmen = getPartyCraftsmen();
    const crafter = craftsmen.find(h => h.id === e.crafterHeroId) || craftsmen[0] || s.roster[0];
    e.crafterHeroId = crafter.id;
    const crafterSkill = Math.min(ws.worldCap, Math.max(1, e.craftLv + Math.floor(attributes(crafter).DEX / 4)));

    // Held materials (unidentified stones appear as separate "石" entries!)
    const heldMats = Object.entries(DATA.materials).filter(([id, m]) => m.craftable !== false && (s.materials[id] || 0) > 0);
    const matChoices = heldMats.length ? heldMats : [['wood', DATA.materials.wood], ['stone', DATA.materials.stone || DATA.materials.flint || DATA.materials.iron]];
    const mat = matChoices.some(([id]) => id === s.craftMaterial) ? s.craftMaterial : matChoices[0][0];
    s.craftMaterial = mat;

    // Workshop Commission Products (Town specialties + Player-taught recipes)
    const wsProds = ws.specialtyProducts.map(pid => CAT.products[pid]).filter(Boolean);
    const activeWsProd = wsProds.some(p => p.id === e.selectedProduct) ? CAT.products[e.selectedProduct] : (wsProds[0] || CAT.products.P0031);

    // Workshop Commission cost & material count depend on Workshop Skill!
    const wsSkillFactor = Math.max(0.65, 1.25 - ws.effectiveSkill * 0.004);
    const wsMatNeeded = Math.max(2, Math.round((activeWsProd?.category === '防具' ? 6 : 5) * wsSkillFactor));
    const wsGoldCost = Math.max(15, Math.ceil(((DATA.materials[mat]?.cost || 10) * 3 + (activeWsProd?.shapeLv || 5) * 8) * town.price * (0.9 + ws.effectiveSkill * 0.015)));

    // Craftsman Self-Crafting cost & material count depend on Craftsman Skill + Rental Fee!
    const craftProdList = e.discoveredProducts.map(pid => CAT.products[pid]).filter(Boolean);
    const activeCraftProd = craftProdList.some(p => p.id === e.selectedProduct) ? CAT.products[e.selectedProduct] : (craftProdList[0] || CAT.products.P0031);
    const rentalFee = Math.max(10, Math.ceil(25 * town.price * town.quality));
    const craftMatNeeded = Math.max(2, (activeCraftProd?.category === '防具' ? 6 : 5) - Math.floor(crafterSkill / 25));

    const scenarioHTML = (activeScenarios.length || nextLockedScenario) ? `<section class="panel" style="margin-bottom:18px;border-color:#d7b77a">
      <div class="row between">
        <h2>📜 世界の加工技術・開拓シナリオ</h2>
        <span class="chip">現在の世界技術段階：${e.techs.includes('K08') ? '機械・旋盤時代' : e.techs.includes('K06') ? '魔導炉時代' : e.techs.includes('K04') ? '製鉄・高熱炉時代' : e.techs.includes('K02') ? '選鉱・青銅時代' : '田舎村・手作業時代'}</span>
      </div>
      ${activeScenarios.map(sc => `<div class="quest-box">
        <b>🌟 ${esc(sc.title)}（街Lv.${sc.minTownLv}〜発生中）</b>
        <p>${esc(sc.desc)}</p>
        <p class="gold">達成条件：${esc(sc.reqText)}</p>
        <div class="actions">
          ${btn('研究素材・資金を提供して技術を確立する', 'complete-tech-scenario', `data-id="${sc.id}" ${sc.checkCanComplete() ? '' : 'disabled'}`, 'primary')}
        </div>
      </div>`).join('')}
      ${!activeScenarios.length && nextLockedScenario ? `<p class="muted">💡 次の技術発展シナリオ（『${esc(nextLockedScenario.title)}』）は、<b>発展度 Lv.${nextLockedScenario.minTownLv} 以上の街</b>を訪れると発生します（現在の街：Lv.${town.level}）。※仮に高Lvの街へ先に行っても、世界の加工技術ベースが未開発のうちは手作業品しか作れません。</p>` : ''}
    </section>` : '';

    return title('WORKSHOP & CRAFTSMANSHIP', `${esc(town.name)}の工房`, '街の職人に製作を請け負わせるか、工房を借りて自ら手探りで鍛えるか。') +
      scenarioHTML +
      `<div class="tab-bar">
        ${btn('🏪 ① この街の工房に製作を依頼する（請負）', 'forge-mode', 'data-mode="workshop"', mode === 'workshop' ? 'selected' : '')}
        ${btn('🔨 ② 工房をレンタルしてクラフトマンが自作・伝授する', 'forge-mode', 'data-mode="craftsman"', mode === 'craftsman' ? 'selected' : '')}
      </div>` +
      (mode === 'workshop' ? `
      <div class="grid">
        <section class="panel">
          <div class="row between">
            <h2>🏪 ${esc(town.name)}工房への製作依頼</h2>
            <span class="chip">工房の腕前：${ws.effectiveSkill >= 80 ? '名匠級' : ws.effectiveSkill >= 35 ? '熟練職人' : ws.effectiveSkill >= 15 ? '一人前' : '田舎の手作業職人'}</span>
          </div>
          <p class="muted">この街の工房が知っている加工品目を、工房の腕前に応じた素材数と工賃で請け負ってもらいます。<br>※同じ「石の斧」でも、持ち込んだ「石」の正体が実は鉄鉱石や黒曜石だった場合、思いがけない性能の品が仕上がることがあります！</p>
          <label class="field">街工房のお品書き（この街で扱える加工品）
            <select data-ext-change="product">
              ${wsProds.map(p => `<option value="${p.id}" ${activeWsProd?.id === p.id ? 'selected' : ''}>${esc(p.name)}（${esc(p.category)}）</option>`).join('')}
            </select>
          </label>
          ${ws.taughtRecipes?.length ? `<div class="quest-box">
            <b>📘 あなたがこの工房に伝授した特注レシピ</b>
            <div class="actions">${ws.taughtRecipes.map(tr => btn(`${esc(tr.name)}を特注 (${tr.cost} G)`, 'order-taught-recipe', `data-id="${tr.id}" ${s.gold < tr.cost || (s.materials[tr.matKey] || 0) < tr.matCount ? 'disabled' : ''}`)).join('')}</div>
          </div>` : ''}
          <label class="field">持ち込む素材（未識別の鉱石はすべて「石」と表示され、別枠で管理されます）
            <select data-change="craftMaterial">
              ${matChoices.map(([id]) => `<option value="${id}" ${id === mat ? 'selected' : ''}>${esc(apparentMaterialName(id))}（所持 ${s.materials[id] || 0}個）</option>`).join('')}
            </select>
          </label>
          <div class="quest-box">
            <b>職人からの見積もり：${esc(apparentMaterialName(mat))}の${esc(activeWsProd?.name || '武具')}</b>
            <p class="gold">必要素材：${esc(apparentMaterialName(mat))} × ${wsMatNeeded}個 ／ 請負工賃：${wsGoldCost} G</p>
            <small class="muted">※工房の腕前によって必要素材数や費用、付与される称号が変化します。</small>
          </div>
          ${btn('この内容で工房に製作を依頼する', 'commission-workshop', s.gold < wsGoldCost || (s.materials[mat] || 0) < wsMatNeeded ? 'disabled' : '', 'primary wide')}
        </section>
        <section class="panel">
          <h2>所持している素材袋</h2>
          <p class="muted">世に鉱物の知識が広まっていないうちは、異なる鉱石も同じ「石」に見えます（内部的には別物のためスタックされません）。</p>
          ${materialsHTML()}
          ${btn('発見記録（図鑑）を見る', 'view', 'data-view="catalog"', 'wide')}
        </section>
      </div>` : `
      <div class="grid">
        <section class="panel">
          <div class="row between">
            <h2>🔨 工房レンタル・クラフトマン自作</h2>
            <span class="chip">設備レンタル料：${rentalFee} G / 回</span>
          </div>
          <p class="muted">街の設備を借りて、仲間のクラフトマンが自ら製作します。クラフト技能が上がると少ない素材で製作でき、名匠の称号が宿ります。また、会得した独自レシピ（普通の石の斧・滑石の斧など）をこの街の工房へ伝授できます。</p>
          <label class="field">担当クラフトマン
            <select data-ext-change="crafter">
              ${craftsmen.map(h => `<option value="${h.id}" ${crafter.id === h.id ? 'selected' : ''}>${esc(h.name)}（器用さ DEX:${attributes(h).DEX}）</option>`).join('')}
            </select>
          </label>
          <label class="field">加工方法（世界の技術発展で解放された方法のみ選択可）
            <select data-ext-change="route">
              ${allowedRoutes.map(rid => {
                const r = CAT.crafting.routes[rid] || { id: rid, meaning: rid };
                return `<option value="${rid}" ${e.selectedRoute === rid ? 'selected' : ''}>${esc(r.meaning)}</option>`;
              }).join('')}
            </select>
          </label>
          <label class="field">製作する加工品（自分が発見・習得した品目のみ）
            <select data-ext-change="product">
              ${craftProdList.map(p => `<option value="${p.id}" ${activeCraftProd?.id === p.id ? 'selected' : ''}>${esc(p.name)}（${esc(p.category)}）</option>`).join('')}
            </select>
          </label>
          <label class="field">使用する素材
            <select data-change="craftMaterial">
              ${matChoices.map(([id]) => `<option value="${id}" ${id === mat ? 'selected' : ''}>${esc(apparentMaterialName(id))}（所持 ${s.materials[id] || 0}個）</option>`).join('')}
            </select>
          </label>
          <div class="quest-box">
            <b>自作に必要な消費：${esc(apparentMaterialName(mat))} × ${craftMatNeeded}個 ＋ 工房レンタル料 ${rentalFee} G</b>
          </div>
          <div class="actions">
            ${btn('工房を借りて自作する', 'craftsman-make', s.gold < rentalFee || (s.materials[mat] || 0) < craftMatNeeded ? 'disabled' : '', 'primary')}
            ${btn('手探りで新加工品の試作研究を行う (' + (rentalFee * 2) + ' G)', 'discover-recipe', s.gold < rentalFee * 2 ? 'disabled' : '')}
          </div>
        </section>
        <section class="panel">
          <h2>📘 クラフト手帳（体得したレシピと街への伝授）</h2>
          <p class="muted">同じ加工品でも「普通の石」で作ったか「滑石」「鉄鉱石」で作ったかによって別レシピとして記録され、街の工房に伝授するとその街の取扱品目が広がります。</p>
          <div class="stack">${(e.learnedRecipes || []).map(rec => {
            const prod = CAT.products[rec.productId];
            const alreadyTaught = ws.taughtRecipes?.some(t => t.id === rec.id);
            const matDisp = apparentMaterialName(rec.matKey);
            return `<div class="quest-box" style="margin:4px 0">
              <div class="row between">
                <b>『${esc(rec.titleHint || '')}${esc(matDisp)}の${esc(prod?.name || '武具')}』製法</b>
                ${alreadyTaught ? '<span class="chip">この街へ伝授済み</span>' : btn('この街の工房に伝授する', 'teach-recipe', `data-id="${rec.id}"`)}
              </div>
              <small class="muted">使用素材：${esc(matDisp)} / 加工法：${esc(CAT.crafting.routes[rec.route]?.meaning || rec.route)}</small>
            </div>`;
          }).join('')}</div>
        </section>
      </div>`) +
      `<div class="sectionhead section-space"><h2>所持している装備品 <small>${s.gear.length}個</small></h2></div>
      <div class="grid">${s.gear.map(g => {
        const owner = s.roster.find(h => h[g.slot] === g.id);
        const enchants = Object.entries(DATA.enchants).filter(([id, en]) => (en.slot || (id === 'ward' ? 'armor' : 'weapon')) === g.slot);
        return `<article class="card item-card rarity-${g.rarity || 'common'}">
          <h3>${esc(gearName(g))}</h3>
          <p class="gold">${g.slot === 'weapon' ? '攻撃性能' : '防御性能'} +${gearValue(g)}${g.enchant ? ` / 付呪効果 +${enchantPower(g)}` : ''}<br>品質 Q${g.quality || 1} / 耐久 ${g.dur} / ${g.maxDur}</p>
          <small>${owner ? esc(owner.name) + 'が装備中' : '未装備'}${g.dur ? '' : ' / 破損中'}</small>
          <div class="actions">
            <select id="equip-${g.id}" aria-label="装備先">${s.roster.map(h => `<option value="${h.id}" ${owner?.id === h.id ? 'selected' : ''}>${esc(h.name)}</option>`).join('')}</select>
            ${btn('装備', 'equip', `data-id="${g.id}"`)}
            ${btn('修理 ' + repairCost(g) + ' G', 'repair', `data-id="${g.id}" ${g.dur === g.maxDur ? 'disabled' : ''}`)}
          </div>
          ${e.techs.includes('K06') ? `<label class="field">付呪を施す<select id="enchant-${g.id}">${enchants.map(([id, en]) => `<option value="${id}" ${g.enchant === id ? 'selected' : ''}>${esc(en.name)} / ${uiQuote(enchantQuote(g, id))}</option>`).join('')}</select></label>${btn(g.enchant ? '付呪を上書き' : '付呪を施す', 'enchant', `data-id="${g.id}"`)}` : ''}
        </article>`;
      }).join('') || '<p class="empty">装備はまだありません。</p>'}</div>`;
  };

  // UI: Enhance Supplies Screen with Level-Filtered Shop Stock & Mystery Box (Gacha)
  suppliesScreen = function() {
    const e = ext();
    const town = currentTown();
    const cost = innCost();
    const maxStockLv = Math.max(partyLevel() + 5, town.level + 5);
    const shopItems = Object.entries(DATA.items).filter(([id, it]) => (it.level || 1) <= maxStockLv || uiCount(id) > 0);
    const boxCost = Math.ceil(140 * town.price * Math.max(1, Math.floor(town.level / 10)));
    const grandBoxCost = Math.ceil(520 * town.price * Math.max(1, Math.floor(town.level / 8)));
    const manualBoxCost = Math.ceil(260 * town.price);

    return title('REST & PROVISIONS', '宿と、旅の支度', `${esc(town.name)} / 物価 ×${town.price}。街の規模に応じた旅道具が並ぶ。`) +
      strip() +
      `<div class="grid section-space">
        <section class="panel">
          <h2>旅人の宿</h2>
          <p class="muted">参加中の全員のLIFE・MANA・SPを全回復し、蘇生と毒の治療を行います。</p>
          ${btn('一泊する / ' + cost + ' G', 'rest', s.gold < cost ? 'disabled' : '', 'primary')}
          ${s.gold < cost ? btn('宿代を立て替えてもらう / ' + cost + ' G', 'rest-credit', '', 'wide') : ''}
          <p class="debt-note">宿泊立替 ${s.debt || 0} G</p>
          <hr class="divider">
          ${uiFieldSupplies()}
        </section>
        <section class="panel">
          <h2>旅道具の補充（現在の街の取扱品）</h2>
          <div class="shop-list">${shopItems.map(([id, it]) => {
            const price = supplyPrice(id);
            return `<article>
              <div class="row between"><h3>${esc(it.name)}</h3><span class="chip">所持 ${uiCount(id)}</span></div>
              <p class="muted">${esc(it.desc)}</p>
              ${btn('1個購入 / ' + price + ' G', 'buy-item', `data-id="${id}" ${s.gold < price ? 'disabled' : ''}`)}
            </article>`;
          }).join('')}</div>
        </section>
      </div>
      <section class="panel section-space loot-banner">
        <div class="row between">
          <h2>🎲 旅商人の掘出し物・未鑑定品取引</h2>
          <span class="chip">街Lv.${town.level} 連動</span>
        </div>
        <p class="muted">旅商人が持ち込んだ出所不明の武具箱や古文書を引き取ります。思いがけない名品や未知の職能証・手引書が見つかることがあります。</p>
        <div class="grid three">
          <article class="card">
            <h3>🗡️ 未鑑定の武具箱</h3>
            <p class="muted">街Lv.${town.level}相当のランダムな武具を1点入手。</p>
            <p class="gold">${boxCost} G</p>
            ${btn('武具箱を開ける', 'gacha-gear', s.gold < boxCost ? 'disabled' : '', 'primary wide')}
          </article>
          <article class="card rarity-legendary">
            <h3>👑 特級・黄金武具箱</h3>
            <p class="muted">名匠の称号や希少な材質の武具が眠る特級箱。</p>
            <p class="gold">${grandBoxCost} G</p>
            ${btn('黄金箱を開ける', 'gacha-grand', s.gold < grandBoxCost ? 'disabled' : '', 'primary wide')}
          </article>
          <article class="card rarity-magic">
            <h3>📜 古の職能・手引くじ</h3>
            <p class="muted">未知の専門職証・秘伝書・探索手引書のいずれかを解読！</p>
            <p class="gold">${manualBoxCost} G</p>
            ${btn('古文書を解読する', 'gacha-scroll', s.gold < manualBoxCost ? 'disabled' : '', 'primary wide')}
          </article>
        </div>
      </section>`;
  };

  // UI: Rules Screen (Only show discovered manuals / active sub-job behaviors — no spoilers of all 40!)
  const prevRulesScreen = rulesScreen;
  rulesScreen = function() {
    const e = ext();
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
    const discoveredBehaviors = Object.values(CAT.behaviors || {}).filter(b =>
      b.id === 'B01' || e.manuals.includes(b.id) || subJobBehaviors.has(b.id)
    );
    const behPanel = `<section class="panel section-space">
      <div class="row between">
        <h2>🧭 発見済みの探索行動記録（最大6枠優先設定）</h2>
        <span class="chip">発見済み ${discoveredBehaviors.length}種 · 設定中 ${e.activeBehaviors.length}/6枠</span>
      </div>
      <p class="muted">手引書の発見や専門職の同行によって新たに身につけた探索行動のみが記録されます。</p>
      <div class="grid three">${discoveredBehaviors.map(b => {
        const byManual = e.manuals.includes(b.id) && partyLevel() >= b.reqPartyLv;
        const byJob = subJobBehaviors.has(b.id);
        const canUse = b.id === 'B01' || byManual || byJob;
        const active = e.activeBehaviors.includes(b.id);
        return `<article class="card ${canUse ? '' : 'locked'}">
          <div class="row between"><b>${esc(b.name)}</b><span class="chip">${byJob ? '専門職同行中' : byManual ? '手引習得済' : '要平均Lv.' + b.reqPartyLv}</span></div>
          <p class="muted">${esc(b.action)}</p>
          ${btn(active ? '✓ 優先設定中' : canUse ? '行動枠に設定' : 'レベル不足', 'toggle-behavior', `data-id="${b.id}" ${!canUse ? 'disabled' : ''}`, active ? 'selected' : '')}
        </article>`;
      }).join('')}</div>
    </section>`;
    return prevRulesScreen() + behPanel;
  };

  // UI: Catalog / Discovery Notebook Screen (ONLY show discovered items! Undiscovered items are not listed!)
  catalogScreen = function() {
    const e = ext();
    const tab = e.catalogTab || 'v3mat';
    const discMats = Object.entries(DATA.materials).filter(([id]) => isMaterialDiscovered(id));
    const discProds = e.discoveredProducts.map(pid => CAT.products[pid]).filter(Boolean);
    const discTitles = e.discoveredTitles.map(tid => CAT.itemTitles[tid]).filter(Boolean);
    const discMons = Object.keys(e.discoveredMonsters).map(mid => CAT.monsters[mid]).filter(Boolean);
    const discJobs = e.unlockedJobIds.map(jid => CAT.jobs[jid]).filter(Boolean);

    const tabsHTML = `<div class="tab-bar">
      ${[
        ['v3mat', `入手した素材記録 (${discMats.length})`],
        ['cat_prod', `加工品レシピ記録 (${discProds.length})`],
        ['cat_title', `発見した称号記録 (${discTitles.length})`],
        ['cat_mon', `遭遇した魔物記録 (${discMons.length})`],
        ['cat_job', `発見した専門職・技 (${discJobs.length})`],
        ['cat_mat', `解明した加工技術 (${e.techs.length})`]
      ].map(([id, label]) => btn(label, 'catalog-tab', `data-tab="${id}"`, tab === id ? 'selected' : '')).join('')}
    </div>`;

    if (tab === 'cat_mat') {
      const knownTechs = e.techs.map(tid => CAT.crafting.techs[tid]).filter(Boolean);
      return title('CRAFTING LORE NOTEBOOK', '解明した加工技術の手帳', 'ユニークシナリオや研究によって世に確立された加工技術の記録。') + tabsHTML +
        `<div class="grid three">${knownTechs.map(t => `<article class="card">
          <div class="row between"><h3>⚙️ ${esc(t.name)}</h3><span class="chip">確立済み</span></div>
          <p class="gold">解放要素：${esc(t.unlocks)}</p>
          <p class="muted">手探りの研究と開拓によって確立された技術。</p>
        </article>`).join('')}</div>`;
    }
    if (tab === 'cat_prod') {
      return title('DISCOVERED PRODUCTS', '加工品レシピ手帳', 'これまでに自ら発見・習得した加工品の記録。未発見の品目はまだ記されていません。') + tabsHTML +
        `<div class="grid three">${discProds.map(p => `<article class="card">
          <div class="row between"><h3>${esc(p.name)}</h3><span class="chip">${esc(p.category)}</span></div>
          <small class="gold">工程：${esc(p.profile)}</small>
          <p class="muted">${esc(p.design)}<br><i>${esc(p.flavor)}</i></p>
        </article>`).join('') || '<p class="empty">まだ発見した加工品はありません。</p>'}</div>`;
    }
    if (tab === 'cat_title') {
      return title('DISCOVERED TITLES', '発見した称号の記録', '製作や戦利品を通じて実際に見出した称号のみが記録されます。') + tabsHTML +
        `<div class="grid three">${discTitles.map(t => `<article class="card">
          <div class="row between"><h3>『${esc(t.name)}』</h3><span class="chip">記録済み</span></div>
          <small class="gold">${esc(t.meaning)}</small>
          <p class="muted">${esc(t.flavor)}</p>
        </article>`).join('') || '<p class="empty">まだ特別な称号を持つ品に出会っていません。名匠の鍛造や強敵の討伐で発見できます。</p>'}</div>`;
    }
    if (tab === 'cat_mon') {
      return title('MONSTER FIELD NOTES', '遭遇した魔物の生態記録', '旅の中で実際に出会った魔物のみが手帳に書き留められます。') + tabsHTML +
        `<div class="grid three">${discMons.map(m => {
          const count = e.discoveredMonsters[m.id] || 1;
          const thumb = monsterThumbHTML('', m.id);
          return `<article class="card">
            ${thumb}
            <div class="row between"><h3>${esc(m.name)}</h3><span class="chip">${esc(m.category)} · 遭遇 ${count}回</span></div>
            <p class="muted">${esc(m.ecology)}<br>${count >= 2 ? '着想：' + esc(m.craftHint) : '（さらに遭遇を重ねると加工の着想が判明）'}</p>
          </article>`;
        }).join('') || '<p class="empty">まだ記録された魔物はいません。探索に出かけましょう。</p>'}</div>`;
    }
    if (tab === 'cat_job') {
      return title('CALLINGS & SECRET ARTS', '発見した専門職と秘伝の記録', '冒険の中で見出した職能証と秘伝の記録。') + tabsHTML +
        `<div class="grid three">${discJobs.map(j => `<article class="card">
          <div class="row between"><h3>${esc(j.name)}</h3><span class="chip">${esc(j.family)}</span></div>
          <p class="muted">${esc(j.role)}<br><i>${esc(j.flavor)}</i></p>
        </article>`).join('')}</div>`;
    }

    return title('MATERIAL FIELD GUIDE', '素材の手帳', 'これまでに入手した素材の記録。鉱物の知識が世に広まる前は、異なる原石もすべて「石」として記録されます。') + tabsHTML +
      `<div class="grid three">${discMats.map(([id, m]) => {
        const identified = isMaterialIdentified(id);
        return `<article class="card material-card">
          <div class="row between"><h3>${esc(apparentMaterialName(id))}</h3><span class="chip">所持 ${s.materials[id] || 0}</span></div>
          <p class="muted">${identified ? esc(m.desc) : 'まだ世に知識が広まっていない原石。ただの「石」に見えるが、手触りや重さが他の石とわずかに異なる…。'}</p>
          ${uiSale(id)}
        </article>`;
      }).join('')}</div>`;
  };

  // Event Listeners for Workshop Commission, Craftsman Self-Craft, Recipe Teaching, Tech Scenarios & Battle Target UI
  const prevBoot = boot;
  boot = function() {
    document.addEventListener('click', ev => {
      const b = ev.target.closest('[data-action]');
      if (!b || b.disabled) return;
      const act = b.dataset.action;
      const e = ext();

      if (act === 'toggle-se') {
        e.soundOn = !e.soundOn;
        if (e.soundOn) playSE('heal');
        render();
      } else if (act === 'ally-target-pick') {
        if (s.battle) {
          s.battle.allyTarget = Number(b.dataset.id);
          const sel = document.getElementById('ally-target');
          if (sel) sel.value = String(s.battle.allyTarget);
          render();
        }
      } else if (act === 'walk-entrance') {
        walkTowardEntrance();
      } else if (act === 'forge-mode') {
        e.forgeMode = b.dataset.mode;
        render();
      } else if (act === 'complete-tech-scenario') {
        if (!townOnly()) return;
        const sc = TECH_SCENARIOS.find(x => x.id === b.dataset.id);
        if (!sc || e.completedTechScenarios.includes(sc.id) || !sc.checkCanComplete()) return;
        sc.consume();
        e.completedTechScenarios.push(sc.id);
        (sc.unlockTechs || []).forEach(tid => { if (!e.techs.includes(tid)) e.techs.push(tid); });
        (sc.identifyMats || []).forEach(mid => { if (!e.identifiedMaterials.includes(mid)) e.identifiedMaterials.push(mid); });
        (sc.unlockProducts || []).forEach(pid => { if (!e.discoveredProducts.includes(pid)) e.discoveredProducts.push(pid); });
        e.craftLv = Math.min(300, e.craftLv + 8);
        playSE('victory');
        tell(`🌟 ${sc.rewardText}`);
        render();
      } else if (act === 'commission-workshop') {
        if (!townOnly()) return;
        const town = currentTown();
        const ws = getTownWorkshop(town);
        const mat = s.craftMaterial || 'wood';
        const wsProds = ws.specialtyProducts.map(pid => CAT.products[pid]).filter(Boolean);
        const prod = wsProds.find(p => p.id === e.selectedProduct) || wsProds[0] || CAT.products.P0031;
        const wsSkillFactor = Math.max(0.65, 1.25 - ws.effectiveSkill * 0.004);
        const matNeeded = Math.max(2, Math.round((prod?.category === '防具' ? 6 : 5) * wsSkillFactor));
        const goldCost = Math.max(15, Math.ceil(((DATA.materials[mat]?.cost || 10) * 3 + (prod?.shapeLv || 5) * 8) * town.price * (0.9 + ws.effectiveSkill * 0.015)));
        if (s.gold < goldCost || (s.materials[mat] || 0) < matNeeded) {
          tell('素材または工賃が足りません。');
          return render();
        }
        // Consume material from lowest available quality tier
        s.gold -= goldCost;
        let rem = matNeeded;
        let usedQ = 1;
        for (const tier of Object.keys(s.stock[mat] || {}).map(Number).sort((a, c) => a - c)) {
          while (rem > 0 && (s.stock[mat][tier] || 0) > 0) {
            usedQ = Math.max(usedQ, tier);
            consumeMaterial(mat, 1, tier);
            rem--;
          }
        }
        const slot = prod?.category === '防具' ? 'armor' : 'weapon';
        const tInfo = getTitleByCraftSkill(ws.effectiveSkill);
        // Even if the stone was unidentified ("石"), its true underlying material stats (e.g. iron / obsidian) take effect!
        const maxDur = 110 + ws.effectiveSkill;
        const g = {
          id: s.nextGear++,
          material: mat,
          slot,
          method: 'physical',
          enchant: null,
          quality: Math.max(usedQ, Math.min(town.quality, 1 + Math.floor(ws.effectiveSkill / 25))),
          dur: maxDur,
          maxDur,
          rarity: tInfo.rarity,
          productId: prod?.id || 'P0031',
          customTitle: tInfo.prefix,
          titleBonus: tInfo.bonus,
          route: 'H',
          craftQ: Math.min(100, 50 + Math.floor(ws.effectiveSkill / 3))
        };
        s.gear.push(g);
        playSE('loot');
        const sneakyNote = !isMaterialIdentified(mat) && (DATA.materials[mat]?.atk >= 10 || DATA.materials[mat]?.def >= 10)
          ? `（※ただの「石」と思って渡した原石は、驚くほど重く鋭い業物へと仕上がった…！）`
          : '';
        tell(`🏪 街の工房が『${gearName(g)}』を仕上げた！${sneakyNote}`);
        render();
      } else if (act === 'craftsman-make') {
        if (!townOnly()) return;
        const town = currentTown();
        const ws = getTownWorkshop(town);
        const craftsmen = getPartyCraftsmen();
        const crafter = craftsmen.find(h => h.id === e.crafterHeroId) || craftsmen[0] || s.roster[0];
        const crafterSkill = Math.min(ws.worldCap, Math.max(1, e.craftLv + Math.floor(attributes(crafter).DEX / 4)));
        const mat = s.craftMaterial || 'wood';
        const prodList = e.discoveredProducts.map(pid => CAT.products[pid]).filter(Boolean);
        const prod = prodList.find(p => p.id === e.selectedProduct) || prodList[0] || CAT.products.P0031;
        const rentalFee = Math.max(10, Math.ceil(25 * town.price * town.quality));
        const matNeeded = Math.max(2, (prod?.category === '防具' ? 6 : 5) - Math.floor(crafterSkill / 25));
        if (s.gold < rentalFee || (s.materials[mat] || 0) < matNeeded) {
          tell('工房レンタル料または素材が足りません。');
          return render();
        }
        s.gold -= rentalFee;
        let rem = matNeeded, usedQ = 1;
        for (const tier of Object.keys(s.stock[mat] || {}).map(Number).sort((a, c) => a - c)) {
          while (rem > 0 && (s.stock[mat][tier] || 0) > 0) {
            usedQ = Math.max(usedQ, tier);
            consumeMaterial(mat, 1, tier);
            rem--;
          }
        }
        const route = e.selectedRoute || 'H';
        const slot = prod?.category === '防具' ? 'armor' : 'weapon';
        const tInfo = getTitleByCraftSkill(crafterSkill);
        const maxDur = (route === 'M' ? 90 : 130) + crafterSkill;
        const g = {
          id: s.nextGear++,
          material: mat,
          slot,
          method: route === 'M' ? 'magic' : 'physical',
          enchant: null,
          quality: Math.max(usedQ, Math.min(town.quality, 1 + Math.floor(crafterSkill / 25))),
          dur: maxDur,
          maxDur,
          rarity: tInfo.rarity,
          productId: prod?.id || 'P0031',
          customTitle: tInfo.prefix,
          titleBonus: tInfo.bonus,
          route,
          craftQ: Math.min(100, 52 + Math.floor(crafterSkill / 2))
        };
        s.gear.push(g);
        e.craftLv = Math.min(ws.worldCap, e.craftLv + 1);
        // Record this specific (productId + matKey + route) recipe in Craftsman's notebook!
        const recId = `REC_${prod?.id || 'P0031'}_${mat}_${route}`;
        if (!e.learnedRecipes.some(r => r.id === recId)) {
          e.learnedRecipes.push({
            id: recId,
            productId: prod?.id || 'P0031',
            matKey: mat,
            route,
            titleHint: tInfo.prefix
          });
          note(`📘 独自レシピ『${tInfo.prefix}${apparentMaterialName(mat)}の${prod?.name || '武具'}』を体得した！街の工房に伝授できます。`);
        }
        playSE('loot');
        tell(`🔨 ${crafter.name}が工房を借りて『${gearName(g)}』を鍛え上げた！（クラフト技能が上昇）`);
        render();
      } else if (act === 'teach-recipe') {
        if (!townOnly()) return;
        const rec = (e.learnedRecipes || []).find(r => r.id === b.dataset.id);
        if (!rec) return;
        const town = currentTown();
        getTownWorkshop(town);
        const wsRaw = e.townWorkshops[town.id];
        wsRaw.taughtRecipes ??= [];
        if (!wsRaw.taughtRecipes.some(t => t.id === rec.id)) {
          const prod = CAT.products[rec.productId];
          const matCost = DATA.materials[rec.matKey]?.cost || 10;
          wsRaw.taughtRecipes.push({
            id: rec.id,
            productId: rec.productId,
            matKey: rec.matKey,
            route: rec.route,
            titleHint: rec.titleHint,
            name: `${rec.titleHint || ''}${apparentMaterialName(rec.matKey)}の${prod?.name || '武具'}`,
            matCount: 4,
            cost: Math.max(20, Math.ceil(matCost * 3 * town.price))
          });
          if (!wsRaw.specialtyProducts.includes(rec.productId)) wsRaw.specialtyProducts.push(rec.productId);
          wsRaw.bonusSkill = (wsRaw.bonusSkill || 0) + 2;
          playSE('heal');
          tell(`📘 ${town.name}の工房に『${apparentMaterialName(rec.matKey)}の${prod?.name || '武具'}』の製法を伝授した！この街の工房でいつでも特注できるようになった！`);
          render();
        }
      } else if (act === 'order-taught-recipe') {
        if (!townOnly()) return;
        const town = currentTown();
        const ws = getTownWorkshop(town);
        const tr = (ws.taughtRecipes || []).find(x => x.id === b.dataset.id);
        if (!tr || s.gold < tr.cost || (s.materials[tr.matKey] || 0) < tr.matCount) return;
        s.gold -= tr.cost;
        let rem = tr.matCount, usedQ = 1;
        for (const tier of Object.keys(s.stock[tr.matKey] || {}).map(Number).sort((a, c) => a - c)) {
          while (rem > 0 && (s.stock[tr.matKey][tier] || 0) > 0) {
            usedQ = Math.max(usedQ, tier);
            consumeMaterial(tr.matKey, 1, tier);
            rem--;
          }
        }
        const prod = CAT.products[tr.productId];
        const slot = prod?.category === '防具' ? 'armor' : 'weapon';
        const tInfo = getTitleByCraftSkill(ws.effectiveSkill);
        const g = {
          id: s.nextGear++,
          material: tr.matKey,
          slot,
          method: tr.route === 'M' ? 'magic' : 'physical',
          enchant: null,
          quality: Math.max(usedQ, town.quality),
          dur: 125,
          maxDur: 125,
          rarity: tInfo.rarity,
          productId: tr.productId,
          customTitle: tr.titleHint || tInfo.prefix,
          titleBonus: tInfo.bonus + 2,
          route: tr.route
        };
        s.gear.push(g);
        playSE('loot');
        tell(`🏪 伝授したレシピに基づき、工房が『${gearName(g)}』を製作した！`);
        render();
      } else if (act === 'catalog-tab') {
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
      } else if (act === 'discover-recipe') {
        const town = currentTown();
        const fee = Math.max(20, Math.ceil(50 * town.price * town.quality));
        if (!townOnly() || s.gold < fee) return;
        s.gold -= fee;
        const cap = worldMaxTechCap();
        const unknown = Object.values(CAT.products).filter(p => !e.discoveredProducts.includes(p.id) && p.minLv <= cap + 15);
        if (unknown.length) {
          const p = pick(unknown);
          e.discoveredProducts.push(p.id);
          playSE('loot');
          tell(`📐 試作研究の末、新たな加工品『${p.name}』（${p.category}）の製法を着想し、手帳に記録した！`);
        } else {
          tell('現在の世界の加工技術で作れる品目はひと通り解明済みです（まず高Lvの街で新たな加工技術シナリオを進めましょう）。');
        }
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
        playSE('loot');
        tell(`🎲 鑑定結果：${gearName(g)} を引き当てた！`);
        render();
      } else if (act === 'gacha-scroll') {
        if (!townOnly()) return;
        const cost = Math.ceil(260 * currentTown().price);
        if (s.gold < cost) return;
        s.gold -= cost;
        const logs = rollDiscoveryDrops(Math.max(partyLevel(), currentTown().level) + 25, true);
        if (!logs.length) {
          const lockJ = Object.values(CAT.jobs).filter(j => !e.unlockedJobIds.includes(j.id));
          if (lockJ.length) {
            const j = pick(lockJ);
            e.unlockedJobIds.push(j.id);
            logs.push(`🎉【職能証発見】専門職『${j.name}』（${j.family}系）が解放された！`);
          }
        }
        playSE('loot');
        tell(logs[0] || '古文書から職人の知見を得てクラフト技能が上がった！');
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
      } else if (k === 'crafter') {
        e.crafterHeroId = Number(ev.target.value);
        render();
      } else if (k === 'ally-target') {
        if (s.battle) {
          s.battle.allyTarget = Number(ev.target.value);
          render();
        }
      } else if (k === 'enemy-target') {
        if (s.battle) {
          s.battle.target = Number(ev.target.value);
          render();
        }
      }
    });

    prevBoot();
  };
})();
