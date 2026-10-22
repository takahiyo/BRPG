'use strict';
const $=id=>document.getElementById(id),KEY='ashen-atlas-v3',LEGACY_KEY='ashen-atlas-v2';
const DIRS=[[0,-1],[1,0],[0,1],[-1,0]],ELEMENTS={physical:'物理',fire:'炎',frost:'氷',light:'光',thunder:'雷',dark:'闇'};
const HERO_SLOTS=['weapon','shield','head','armor','arms','feet','acc1','acc2'],DEF_SLOTS=['shield','head','armor','arms','feet','acc1','acc2'],GEAR_SLOT_KEYS=['weapon','armor','head','body','arms','feet','accessory'];
const SLOT_FACTORS={weapon:1,armor:1,body:1,head:0.55,arms:0.48,feet:0.48,accessory:0.35};
// Shared with equipment.js so initial save validation uses the runtime's rules.
const EQUIPMENT_RULES={
 club:{slot:'weapon'},dagger:{slot:'weapon'},sword:{slot:'weapon'},greatsword:{slot:'weapon',hands:2},
 axe:{slot:'weapon'},spear:{slot:'weapon',hands:2},bow:{slot:'weapon',hands:2},staff:{slot:'weapon',hands:2},whip:{slot:'weapon'},
 shield:{slot:'shield'},helmet:{slot:'head'},hat:{slot:'head'},body:{slot:'armor'},robe:{slot:'armor'},
 gloves:{slot:'arms'},boots:{slot:'feet'},ring:{slot:'accessory'},amulet:{slot:'accessory'}
};
let walkTimer=null,battleTimer=null,notice='',storageOK=true;
function hash(str){let h=2166136261;for(const c of str)h=Math.imul(h^c.charCodeAt(0),16777619);return h>>>0;}
function rng(seed){return()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};}
function makeHero(id,name,job,row='front'){const j=DATA.jobs[job];return{id,name,job,row,lv:1,xp:0,hp:j.hp,mp:j.mp,poison:0,weapon:null,head:null,armor:null,arms:null,feet:null,acc1:null,acc2:null};}
function baseTown(){return{id:'ash',name:'灰灯の街',level:1,price:1,quality:1,baseCost:0,owned:true,seed:0};}
function fresh(){const roster=[makeHero(1,'アッシュ','warrior'),makeHero(2,'リネ','priest','back'),makeHero(3,'ネリ','explorer'),makeHero(4,'ルカ','tactician','back')],gear=roster.map((h,i)=>({id:i+1,material:'wood',type:['priest','tactician'].includes(h.job)?'staff':'club',slot:'weapon',method:'physical',enchant:null,quality:1,dur:60,maxDur:60}));roster.forEach((h,i)=>h.weapon=gear[i].id);const materials=Object.fromEntries(Object.keys(DATA.materials).map(k=>[k,0]));materials.wood=3;materials.copper=2;const stock=Object.fromEntries(Object.keys(materials).map(k=>[k,materials[k]?{1:materials[k]}:{}]));return{version:3,view:'town',gold:360,debt:0,materials,stock,items:{potion:3,antidote:1,scroll:1,ether:1},roster,active:[1,2,3,4],gear,nextGear:5,nextHero:5,books:[],walkRule:'right',battleRules:[],autoExpedition:false,dungeon:null,battle:null,corpses:[],towns:[baseTown()],townId:'ash',homeTownId:'ash',addressMaps:[],addressPreview:null,quests:{},research:{},won:false,kills:0,calendar:{day:1,hour:8,minute:0,lastRealDate:''},log:['四人の探索者が灰灯の街に集まった。探索者ネリ（自動探索・道標帰還支援）と軍師ルカ（自動戦闘の戦術支援）が同行している。まずはLv.1の森縁で素材と経験を得よう。'],randomState:Date.now()>>>0,selection:1};}
function migrateV2(v){if(!v||v.version!==2||!Array.isArray(v.roster)||!v.active||!v.materials)return null;const n={...fresh(),...v,version:3,autoExpedition:false,items:{potion:v.potions||0,antidote:v.antidotes||0,scroll:v.scrolls||0,ether:0},research:{},stock:{},materials:{...fresh().materials,...v.materials}};delete n.potions;delete n.antidotes;delete n.scrolls;n.gear=(v.gear||[]).map(g=>({...g,quality:1}));for(const [k,count]of Object.entries(n.materials))n.stock[k]=count?{1:count}:{};for(const id of v.bestiary||[])n.research[id]={encounters:1,kills:0,level:3};delete n.bestiary;function floor(d){return d?{...d,mapId:'old_mine',identity:'guild:old_mine:'+d.seed,level:3+d.depth-1,quality:1,autoSteps:0}:null;}n.dungeon=floor(v.dungeon);n.corpses=(v.corpses||[]).map(c=>({...c,floor:floor(c.floor),gear:c.gear.map(g=>({...g,quality:1}))}));n.roster.forEach(h=>{if(!DATA.jobs[h.job])h.job='warrior';h.lv=Math.min(300,Math.max(1,h.lv));h.hp=Math.min(h.hp,DATA.jobs[h.job].hp+(h.lv-1)*9);h.mp=Math.min(h.mp,DATA.jobs[h.job].mp+(h.lv-1)*4);});if(n.battle){n.battle.plans={};n.battle.enemies=n.battle.enemies.map(e=>({...e,level:n.dungeon.level,drop:DATA.enemies.find(t=>t.id===e.id)?.drop||null,counted:false}));}if(n.view==='battle')n.view='explore';return n;}
function validSave(v){
 const num=(n,min=0)=>Number.isFinite(n)&&n>=min,arr=Array.isArray,matrix=(m,p)=>arr(m)&&m.length===13&&m.every(r=>arr(r)&&r.length===19&&r.every(p));
 const record=x=>x!==null&&typeof x==='object'&&!arr(x),uint=n=>Number.isSafeInteger(n)&&n>=0;
 const abilityKeys=['STR','INT','AGI','VIT','DEX','WIZ','MGR','CHR'],allocKeys=[...abilityKeys,'hp','mp','sp'];
 if(v?.calendar!==undefined){
   const c=v.calendar;
   if(!record(c)||!uint(c.day)||c.day<1||!uint(c.hour)||c.hour>23||!uint(c.minute)||c.minute>59)return false;
   if(c.lastRealDate!==undefined&&(typeof c.lastRealDate!=='string'||c.lastRealDate!==''&&(!/^\d{4}-\d{2}-\d{2}$/.test(c.lastRealDate)||!Number.isFinite(Date.parse(c.lastRealDate))||new Date(c.lastRealDate).toISOString().slice(0,10)!==c.lastRealDate)))return false;
 }
 if(v?.ext!==undefined){
   const e=v.ext;if(!record(e))return false;
   if(e.alloc!==undefined&&(!record(e.alloc)||!Object.values(e.alloc).every(a=>record(a)&&Object.entries(a).every(([k,n])=>allocKeys.includes(k)&&uint(n)))))return false;
   if(e.freePts!==undefined&&(!record(e.freePts)||!Object.values(e.freePts).every(uint)))return false; if(e.manuals!==undefined&&(!arr(e.manuals)||!e.manuals.every(id=>DATA.catalog?.behaviors?.[id])))return false; if(e.activeBehaviors!==undefined&&(!arr(e.activeBehaviors)||e.activeBehaviors.length>6||!e.activeBehaviors.every(id=>DATA.catalog?.behaviors?.[id])))return false;
   if(e.facilityRules!==undefined){
     const r=e.facilityRules,bookIds=['expedition','instant_return',...DATA.rules.map(b=>b.id)];
     if(!record(r)||!['known','owned'].every(k=>arr(r[k])&&r[k].every(id=>bookIds.includes(id))))return false;
   }
   if(e.guildContracts!==undefined){
     const g=e.guildContracts;
     if(!record(g)||!record(g.towns)||!uint(g.serial))return false;
     for(const board of Object.values(g.towns)){
       if(!record(board)||!arr(board.offers)||!record(board.progress)||!uint(board.returns))return false;
       if(!Object.values(board.progress).every(p=>record(p)&&['accepted','ready','completed','failed'].includes(p.status)&&uint(p.times)))return false;
       if(!board.offers.every(q=>record(q)&&typeof q.id==='string'&&typeof q.name==='string'&&typeof q.mapId==='string'&&uint(q.reward)&&uint(q.expires)&&
         (q.dueDay===undefined||uint(q.dueDay)&&q.dueDay>0)&&(q.dueHour===undefined||uint(q.dueHour)&&q.dueHour<24)&&(q.penalty===undefined||uint(q.penalty))&&
         (q.kind==='emergency'?num(q.level,1)&&q.level<=300:q.kind==='lucrative'&&DATA.materials[q.material]&&uint(q.amount)&&q.amount>0&&num(q.quality,1)&&q.quality<=13)))return false;
     }
   }
 }
 const floor=d=>d&&typeof d.mapId==='string'&&typeof d.identity==='string'&&num(d.seed)&&num(d.level,1)&&d.level<=300&&num(d.quality,1)&&num(d.depth,1)&&Number.isInteger(d.x)&&d.x>0&&d.x<(d.map?.[0]?.length||18)&&Number.isInteger(d.y)&&d.y>0&&d.y<(d.map?.length||12)&&Number.isInteger(d.facing)&&d.facing>=0&&d.facing<4&&num(d.started)&&num(d.steps)&&num(d.sinceBattle)&&matrix(d.map,t=>['#','.','o','c','>','!','<'].includes(t))&&matrix(d.seen,t=>typeof t==='boolean')&&matrix(d.visits,t=>num(t));
 const gear=g=>g&&Number.isInteger(g.id)&&DATA.materials[g.material]&&['weapon','armor'].includes(g.slot)&&['physical','magic'].includes(g.method)&&(!g.enchant||DATA.enchants[g.enchant])&&(g.enchants===undefined||(arr(g.enchants)&&g.enchants.length<=3&&g.enchants.every(eid=>DATA.enchants[eid])))&&num(g.quality,1)&&g.quality<=13&&num(g.dur)&&num(g.maxDur,1)&&g.dur<=g.maxDur;
 if(!v||v.version!==3||!['gold','debt','nextGear','nextHero','kills','randomState'].every(k=>num(v[k]))||!v.materials||!Object.keys(DATA.materials).every(k=>num(v.materials[k]))||!v.stock||!v.items)return false;
 if(!Object.entries(v.items).every(([k,n])=>DATA.items[k]&&num(n))||!Object.entries(v.stock).every(([k,lots])=>DATA.materials[k]&&lots&&Object.entries(lots).every(([q,n])=>num(+q,1)&&+q<=13&&num(n))))return false;
 if(!arr(v.roster)||!v.roster.length||!v.roster.every(h=>h&&Number.isInteger(h.id)&&typeof h.name==='string'&&DATA.jobs[h.job]&&['front','back'].includes(h.row)&&Number.isInteger(h.lv)&&h.lv>=1&&h.lv<=300&&['xp','hp','mp','poison'].every(k=>num(h[k]))&&[h.weapon,h.armor].every(id=>id===null||Number.isInteger(id))))return false;
 if(v.roster.some(h=>(h.sp!==undefined&&!num(h.sp))||(h.learned!==undefined&&(!arr(h.learned)||!h.learned.every(id=>DATA.skills[id])))||(h.jobHistory!==undefined&&(!arr(h.jobHistory)||!h.jobHistory.every(id=>DATA.jobs[id])))))return false;
 if(v.roster.some(h=>(h.gender!==undefined&&!['male','female','other','unspecified'].includes(h.gender))||
   (h.birthAttributes!==undefined&&(!record(h.birthAttributes)||!abilityKeys.every(k=>Number.isInteger(h.birthAttributes[k])&&Math.abs(h.birthAttributes[k])<=2)))||
   (h.rareJob!==undefined&&!DATA.jobs[h.rareJob]?.catalog)))return false;
 if(v.reserve&&(!['percent','absolute'].includes(v.reserve.mode)||!['life','mana','sp'].every(k=>num(v.reserve[k]))))return false;
 if(!arr(v.active)||!v.active.length||v.active.length>6||new Set(v.active).size!==v.active.length||!v.active.every(id=>v.roster.some(h=>h.id===id))||!arr(v.gear)||!v.gear.every(gear))return false;
 if(!arr(v.books)||!v.books.every(id=>DATA.rules.some(b=>b.id===id))||!arr(v.battleRules)||!v.battleRules.every(id=>DATA.rules.some(b=>b.id===id&&b.type==='battle'))||!['right','left','random','avoid'].includes(v.walkRule))return false;
 if(!arr(v.log)||!v.log.every(t=>typeof t==='string')||!v.research||!Object.values(v.research).every(r=>r&&num(r.encounters)&&num(r.kills)&&num(r.level,1))||!arr(v.corpses))return false;
 if(!v.corpses.every(c=>c&&typeof c.id==='string'&&floor(c.floor)&&num(c.until)&&arr(c.gear)&&c.gear.every(gear)&&arr(c.links)&&c.links.every(l=>l&&Number.isInteger(l.id))))return false;
 // Validate the new optional equipment fields before later UI scripts run.
 const allGear=[...v.gear,...v.corpses.flatMap(c=>c.gear)],gearIds=new Set(),heroIds=new Set(v.roster.map(h=>h.id));
 for(const g of allGear){
   if(gearIds.has(g.id))return false;gearIds.add(g.id);
   if(g.ownerId!==undefined&&g.ownerId!==null&&!heroIds.has(g.ownerId))return false;
   if(g.type!==undefined&&!Object.hasOwn(EQUIPMENT_RULES,g.type))return false;
   if(g.equipSlot!==undefined&&!['weapon','shield','head','armor','arms','feet','accessory'].includes(g.equipSlot))return false;
   if(g.hands!==undefined&&![1,2].includes(g.hands))return false;
   if(g.equipSlot!==undefined&&(g.equipSlot==='weapon')!==(g.slot==='weapon'))return false;
   if(g.type&&(g.slot!==(EQUIPMENT_RULES[g.type].slot==='weapon'?'weapon':'armor')||g.equipSlot!==undefined&&g.equipSlot!==EQUIPMENT_RULES[g.type].slot))return false;
 }
 const equippedIds=new Set();
 for(const h of v.roster){
   for(const slot of HERO_SLOTS){
     const id=h[slot];if(id===undefined||id===null)continue;
     const g=v.gear.find(x=>x.id===id);
     if(!Number.isInteger(id)||!g||equippedIds.has(id))return false;
     equippedIds.add(id);
     if(g.ownerId!==undefined&&g.ownerId!==h.id)return false;
     const expected=g.type?EQUIPMENT_RULES[g.type].slot:g.equipSlot;
     if(expected&&expected!==(slot.startsWith('acc')?'accessory':slot))return false;
   }
   const w=v.gear.find(g=>g.id===h.weapon);
   if(h.shield&&(w?.hands===2||EQUIPMENT_RULES[w?.type]?.hands===2))return false;
 }
 if(!arr(v.towns)||!v.towns.length||!v.towns.every(t=>t&&typeof t.id==='string'&&typeof t.name==='string'&&num(t.level,1)&&num(t.price,1)&&num(t.quality,1)&&num(t.baseCost))||!v.towns.some(t=>t.id===v.townId)||!v.towns.some(t=>t.id===v.homeTownId)||!arr(v.addressMaps)||!v.quests)return false;
 if(!v.addressMaps.every(m=>m&&typeof m.id==='string'&&typeof m.name==='string'&&num(m.level,1)&&m.level<=300&&arr(m.materials)&&m.materials.every(k=>DATA.materials[k])&&arr(m.enemies)&&m.enemies.every(id=>DATA.enemies.some(e=>e.id===id))))return false;
 if(v.dungeon!==null&&!floor(v.dungeon))return false;
 if(v.battle!==null){const b=v.battle;if(!v.dungeon||!b||!num(b.turn,1)||!num(b.actor)||!num(b.target)||!b.plans||!num(b.rally)||!arr(b.enemies)||!b.enemies.length||!b.enemies.every(e=>e&&num(e.key)&&typeof e.name==='string'&&[...DATA.enemies,DATA.boss,...Object.values(DATA.bosses||{})].some(t=>t.id===e.id)&&['hp','maxhp','atk','def','mag','speed','poison','xp','gold'].every(k=>num(e[k]))))return false;if(!Object.values(b.plans).every(p=>p&&['attack','defend','item','escape','skill'].includes(p.command)&&num(p.target)&&(!p.skill||DATA.skills[p.skill]||DATA.catalog?.skills?.[p.skill])&&(!p.item||DATA.items[p.item])))return false;}
 return true;
}
let s=fresh();
try{const raw=localStorage.getItem(KEY),legacy=!raw&&localStorage.getItem(LEGACY_KEY);if(raw||legacy){let v;try{v=JSON.parse(raw||legacy);}catch{}if(legacy){try{v=migrateV2(v);}catch{v=null;}}if(validSave(v)){s=v;s.autoExpedition=false;if(legacy)notice='旧版の進行を新版へ引き継ぎました。旧保存も保持しています。';}else{localStorage.setItem(KEY+'-invalid-backup-'+Date.now(),raw||legacy);notice='保存形式を読み込めず、元データを退避しました。新しい冒険を開始します。';}}}catch{storageOK=false;}
function party(){return s.active.map(id=>s.roster.find(h=>h.id===id)).filter(Boolean);}
function alive(){return party().filter(h=>h.hp>0&&h.mp>0);}
function partyLevel(){return Math.max(1,Math.floor(party().reduce((n,h)=>n+h.lv,0)/party().length));}
function xpNeeded(h){return Math.floor(60*Math.pow(h.lv,1.35));}
function heroSkills(h){return(DATA.jobs[h.job].skills||[]).map(id=>({id,...DATA.skills[id]})).filter(k=>k.name);}
function item(id){return s.gear.find(g=>g.id===id);}
function qualityFactor(q){return 1+(q-1)*.35;}
function gearValue(g){if(!g||!g.dur)return 0;const m=DATA.materials[g.material],base=m.category==='stone'?(g.slot==='weapon'?2:1):(g.slot==='weapon'?m.atk:m.def);return Math.round(base*(g.method==='magic'?1.5:1)*qualityFactor(g.quality||1));}
function enchantPower(g){if(!g?.enchant||!g.dur)return 0;return Math.round(DATA.enchants[g.enchant].stat*DATA.materials[g.material].affinity*(g.method==='physical'?1.5:.55)*qualityFactor(g.quality||1));}
function stats(h){const j=DATA.jobs[h.job],w=item(h.weapon),a=item(h.armor);return{hp:j.hp+(h.lv-1)*9,mp:j.mp+(h.lv-1)*4,atk:j.atk+(h.lv-1)*2+gearValue(w),def:j.def+h.lv-1+gearValue(a)+(a?.enchant&&DATA.enchants[a.enchant]?.slot==='armor'?enchantPower(a):0),mag:j.mag+(h.lv-1)*2+(w&&DATA.materials[w.material].category==='gem'?gearValue(w):0),speed:j.speed+Math.floor(h.lv/3)};}
function currentTown(){return s.towns.find(t=>t.id===s.townId)||baseTown();}
function worldMap(id){return DATA.maps.find(m=>m.id===id)||s.addressMaps.find(m=>m.id===id)||DATA.maps[0];}
function random(){s.randomState=(Math.imul(s.randomState,1664525)+1013904223)>>>0;return s.randomState/4294967296;}
function pick(a){return a[Math.floor(random()*a.length)];}
function note(t){if(!t)return;const prev=s.log[0];if(prev){const m=prev.match(/^(.*?)(?: \*(\d+))?$/);if(m&&m[1]===t){const count=m[2]?parseInt(m[2],10)+1:2;s.log[0]=`${t} *${count}`;return;}}s.log.unshift(t);s.log=s.log.slice(0,100);}
function tell(t){notice=t;note(t);}
function save(){try{localStorage.setItem(KEY,JSON.stringify(s));storageOK=true;}catch{storageOK=false;}}
function unlocked(id){const b=DATA.rules.find(b=>b.id===id);return!!b&&s.books.includes(id)&&partyLevel()>=b.level;}
function stopWalk(){clearInterval(walkTimer);walkTimer=null;}
function stopBattle(){clearInterval(battleTimer);battleTimer=null;}
function stopAll(){stopWalk();stopBattle();s.autoExpedition=false;}
function dungeonDimensions(map, depth) {
  const recLv = map?.recommendedLevel || map?.level || 1;
  let w = 19, h = 13;
  w += (depth - 1) * 2;
  h += (depth - 1) * 2;
  if (recLv >= 80) { w += 4; h += 2; }
  else if (recLv >= 30) { w += 2; h += 2; }
  else if (recLv >= 10) { w += 2; }
  if (w % 2 === 0) w++;
  if (h % 2 === 0) h++;
  return { w: Math.min(27, w), h: Math.min(19, h) };
}
function generate(seed, depth, mapDef = null, upPos = null) {
  const mDef = mapDef || DATA.maps[0];
  const dim = dungeonDimensions(mDef, depth);
  const W = dim.w, H = dim.h;
  const r = rng((seed + depth * 7919) >>> 0);
  const m = Array.from({ length: H }, () => Array(W).fill('#'));

  let startX, startY;
  if (upPos) {
    startX = Math.max(1, Math.min(W - 2, upPos[0]));
    startY = Math.max(1, Math.min(H - 2, upPos[1]));
  } else {
    startX = 1 + Math.floor(r() * Math.floor((W - 2) / 2)) * 2;
    startY = 1 + Math.floor(r() * Math.floor((H - 2) / 2)) * 2;
  }
  const digX = startX % 2 === 1 ? startX : (startX + 1 < W - 1 ? startX + 1 : startX - 1);
  const digY = startY % 2 === 1 ? startY : (startY + 1 < H - 1 ? startY + 1 : startY - 1);

  function dig(x, y) {
    m[y][x] = '.';
    const dirs = [...DIRS];
    for (let i = 3; i > 0; i--) {
      const j = Math.floor(r() * (i + 1));
      [dirs[i], dirs[j]] = [dirs[j], dirs[i]];
    }
    for (const [dx, dy] of dirs) {
      const nx = x + dx * 2, ny = y + dy * 2;
      if (nx > 0 && ny > 0 && nx < W - 1 && ny < H - 1 && m[ny][nx] === '#') {
        m[y + dy][x + dx] = '.';
        dig(nx, ny);
      }
    }
  }
  dig(digX, digY);

  m[startY][startX] = '.';
  if (digX !== startX || digY !== startY) {
    m[Math.round((startY + digY) / 2)][Math.round((startX + digX) / 2)] = '.';
  }

  const passages = [];
  for (let y = 1; y < H - 1; y++) {
    for (let x = 1; x < W - 1; x++) {
      if (m[y][x] === '.') passages.push([x, y]);
    }
  }

  for (const [x, y] of passages) {
    if (x === startX && y === startY) continue;
    const n = r();
    if (n < 0.12) m[y][x] = 'o';
    else if (n < 0.15) m[y][x] = 'c';
  }

  const farCandidates = passages.filter(([x, y]) => Math.abs(x - startX) + Math.abs(y - startY) >= Math.floor((W + H) * 0.42));
  const pool = farCandidates.length > 0 ? farCandidates : passages.filter(([x, y]) => !(x === startX && y === startY));
  const downPos = pool.length > 0 ? pool[Math.floor(r() * pool.length)] : [W - 2, H - 2];
  const [downX, downY] = downPos;

  m[startY][startX] = '<';
  m[downY][downX] = depth >= mDef.depths ? '!' : '>';

  // 古今東西のRPGギミック配置
  const gimmicks = {};
  const hazardRoll = rng((seed + depth * 13337 + 404) >>> 0);
  const availableTiles = passages.filter(([x, y]) =>
    !(x === startX && y === startY) &&
    !(x === downX && y === downY) &&
    m[y][x] === '.'
  );

  // 1. スイッチと施錠扉
  if (availableTiles.length >= 10 && hazardRoll() < 0.55) {
    const doorIdx = Math.floor(hazardRoll() * availableTiles.length);
    const [doorX, doorY] = availableTiles.splice(doorIdx, 1)[0];
    const switchIdx = Math.floor(hazardRoll() * availableTiles.length);
    const [swX, swY] = availableTiles.splice(switchIdx, 1)[0];
    gimmicks[`${doorX},${doorY}`] = { type: 'locked_door', open: false, link: `${swX},${swY}` };
    gimmicks[`${swX},${swY}`] = { type: 'switch', triggered: false, target: `${doorX},${doorY}` };
  }

  // 2. 自動移動床（コンベア・氷床）
  const conveyorCount = Math.floor(hazardRoll() * 3);
  for (let c = 0; c < conveyorCount && availableTiles.length > 0; c++) {
    const cIdx = Math.floor(hazardRoll() * availableTiles.length);
    const [cx, cy] = availableTiles.splice(cIdx, 1)[0];
    const dirs = ['north', 'east', 'south', 'west'];
    gimmicks[`${cx},${cy}`] = { type: 'conveyor', dir: dirs[Math.floor(hazardRoll() * 4)] };
  }

  // 3. 落とし穴（最深階以外）
  if (depth < mDef.depths && availableTiles.length > 0 && hazardRoll() < 0.6) {
    const pitCount = 1 + Math.floor(hazardRoll() * 2);
    for (let p = 0; p < pitCount && availableTiles.length > 0; p++) {
      const pIdx = Math.floor(hazardRoll() * availableTiles.length);
      const [px, py] = availableTiles.splice(pIdx, 1)[0];
      gimmicks[`${px},${py}`] = { type: 'pit', discovered: false, disarmed: false };
    }
  }

  // 4. 一方通行（段差・一方通行扉）
  if (availableTiles.length > 0 && hazardRoll() < 0.5) {
    const owIdx = Math.floor(hazardRoll() * availableTiles.length);
    const [owX, owY] = availableTiles.splice(owIdx, 1)[0];
    const owDirs = ['north', 'east', 'south', 'west'];
    gimmicks[`${owX},${owY}`] = { type: 'oneway', allow: owDirs[Math.floor(hazardRoll() * 4)] };
  }

  return { map: m, startX, startY, downX, downY, width: W, height: H, gimmicks };
}
function makeFloor(map, seed, depth, upPos = null) {
  const gen = generate(seed, depth, map, upPos);
  const W = gen.width, H = gen.height;
  return {
    mapId: map.id,
    identity: (map.id.startsWith('address-') ? 'address:' : 'guild:') + map.id + ':' + seed,
    seed,
    depth,
    level: Math.min(300, map.level + depth - 1),
    quality: Math.min(13, 1 + Math.floor(Math.min(300, map.level + depth - 1) / 25)),
    difficulty: 1,
    map: gen.map,
    seen: Array.from({ length: H }, () => Array(W).fill(false)),
    visits: Array.from({ length: H }, () => Array(W).fill(0)),
    x: gen.startX,
    y: gen.startY,
    startX: gen.startX,
    startY: gen.startY,
    downX: gen.downX,
    downY: gen.downY,
    facing: 1,
    steps: 0,
    sinceBattle: 0,
    loop: 0,
    autoSteps: 0,
    started: Date.now(),
    gimmicks: gen.gimmicks
  };
}
function reveal() {
  const d = s.dungeon;
  if (!d) return;
  const H = d.map.length, W = d.map[0].length;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (Math.abs(x - d.x) + Math.abs(y - d.y) <= 3) {
        if (!d.seen[y]) d.seen[y] = Array(W).fill(false);
        d.seen[y][x] = true;
      }
    }
  }
  if (!d.visits[d.y]) d.visits[d.y] = Array(W).fill(0);
  d.visits[d.y][d.x]++;
}
function enterMap(id, corpseId = null) {
  if (s.dungeon || s.battle) return;
  if (!alive().length) { tell('全員が戦闘不能または気絶しています。神殿の治療か蘇生薬・魔力水を利用してください。'); return render(); }
  const c = s.corpses.find(c => c.id === corpseId), m = worldMap(c ? c.floor.mapId : id), seed = c ? c.floor.seed : m.seed ?? hash('guild:' + m.id), identity = c ? c.floor.identity : (m.id.startsWith('address-') ? 'address:' : 'guild:') + m.id + ':' + seed;
  if (s.corpses.some(c => c.floor.identity === identity && c.until > Date.now())) { tell('この探索地は再入場待機中です。別の地域を選べます。'); return render(); }
  stopAll();
  s.dungeon = c ? structuredClone(c.floor) : makeFloor(m, seed, 1);
  Object.assign(s.dungeon, { x: s.dungeon.startX ?? 1, y: s.dungeon.startY ?? 1, started: Date.now(), sinceBattle: 0, autoSteps: 0 });
  s.view = 'explore';
  reveal();
  tell(m.name + 'へ到着。敵Lv.' + s.dungeon.level + ' / 採集品質Q' + s.dungeon.quality + '。');
  render();
}
function enter(address, difficulty = 1, corpseId = null) {
  if (corpseId) return enterMap('', corpseId);
  if (address) { discoverAddress(address); return enterMap(s.addressPreview.map.id); }
  return enterMap('forest_edge');
}
function returnTown() {
  if (!s.dungeon || s.battle) return;
  const d = s.dungeon;
  const atEntrance = (d.depth === 1 && d.x === (d.startX ?? 1) && d.y === (d.startY ?? 1));
  if (!atEntrance) {
    if (!(s.items.scroll > 0)) {
      tell(d.depth > 1 ? '深層からは直接歩いて帰還できません。1階の地上出口へ戻る必要があります。' : '帰還符がありません。1階の地上出口へ戻る必要があります。');
      return render();
    }
    s.items.scroll--;
  }
  stopAll();
  delete s.floorCache;
  s.dungeon = null;
  s.view = 'town';
  tell(currentTown().name + 'へ帰還。傷・MP・毒は持ち越す。');
  render();
}
function descend() {
  const d = s.dungeon;
  if (!d || s.battle || d.map[d.y][d.x] !== '>') return;
  stopAll();
  s.floorCache ??= {};
  s.floorCache[d.depth] = structuredClone(d);
  const nextDepth = d.depth + 1, cached = s.floorCache[nextDepth];
  const downPos = [d.x, d.y];
  if (cached) {
    s.dungeon = cached;
    s.dungeon.x = downPos[0];
    s.dungeon.y = downPos[1];
    s.dungeon.facing = 2;
  } else {
    const { seed, started, mapId } = d;
    s.dungeon = makeFloor(worldMap(mapId), seed, nextDepth, downPos);
    s.dungeon.started = started;
    s.dungeon.x = downPos[0];
    s.dungeon.y = downPos[1];
    s.dungeon.facing = 2;
  }
  reveal();
  tell('階層B' + s.dungeon.depth + 'F / 敵Lv.' + s.dungeon.level + 'へ進んだ。');
  render();
}
function ascend() {
  const d = s.dungeon;
  if (!d || s.battle || d.depth <= 1) return;
  if (d.map[d.y][d.x] !== '<') return;
  stopAll();
  s.floorCache ??= {};
  s.floorCache[d.depth] = structuredClone(d);
  const prevDepth = d.depth - 1, cached = s.floorCache[prevDepth];
  const upPos = [d.x, d.y];
  if (cached) {
    s.dungeon = cached;
    s.dungeon.x = upPos[0];
    s.dungeon.y = upPos[1];
    s.dungeon.facing = 0;
  } else {
    const { seed, started, mapId } = d;
    s.dungeon = makeFloor(worldMap(mapId), seed, prevDepth);
    s.dungeon.started = started;
    s.dungeon.x = upPos[0];
    s.dungeon.y = upPos[1];
    s.dungeon.facing = 0;
  }
  reveal();
  tell('上の階（B' + s.dungeon.depth + 'F）へ戻った。');
  render();
}
globalThis.ascend = ascend;
function bossChallenge() { const d = s.dungeon; if (d && !s.battle && d.map[d.y][d.x] === '!') encounter(true); }
function addMaterial(key, n, q = 1) { if (!DATA.materials[key]) return; s.stock[key] ??= {}; s.stock[key][q] = (s.stock[key][q] || 0) + n; s.materials[key] = (s.materials[key] || 0) + n; }
function availableMaterial(key, q = 1) { return Object.entries(s.stock[key] || {}).reduce((n, [tier, count]) => n + (+tier >= q ? count : 0), 0); }
function consumeMaterial(key, n, q = 1) { if (availableMaterial(key, q) < n) return false; for (const tier of Object.keys(s.stock[key]).map(Number).sort((a, b) => a - b)) { if (tier < q) continue; const take = Math.min(n, s.stock[key][tier]); s.stock[key][tier] -= take; s.materials[key] -= take; n -= take; if (!n) break; } return true; }
function earnGold(amount) { const repayment = Math.min(s.debt, Math.ceil(amount * .3)); s.debt -= repayment; s.gold += amount - repayment; if (repayment) note('収入から' + repayment + ' Gを宿泊債務へ返済。'); }
function step(dx, dy, automatic = false) {
  const d = s.dungeon;
  if (!d || s.battle || s.view !== 'explore') return;
  const x = d.x + dx, y = d.y + dy;
  if (!d.map[y]?.[x] || d.map[y][x] === '#') return;

  const destKey = `${x},${y}`;
  const gDest = d.gimmicks?.[destKey];
  if (gDest && (gDest.type === 'locked_door' || gDest.type === 'door') && !gDest.open) {
    tell('頑丈な鉄格子の扉が閉ざされている。どこかに開く仕掛けがあるようだ。');
    return render();
  }

  if (gDest && gDest.type === 'oneway') {
    const moveDir = dx === 1 ? 'east' : dx === -1 ? 'west' : dy === 1 ? 'south' : 'north';
    const moveDirShort = dx === 1 ? 'E' : dx === -1 ? 'W' : dy === 1 ? 'S' : 'N';
    if (gDest.allow && gDest.allow !== moveDir && gDest.allow !== moveDirShort) {
      tell('段差があり、この方向からは進めない！（一方通行）');
      return render();
    }
  }

  const curKey = `${d.x},${d.y}`;
  const gCur = d.gimmicks?.[curKey];
  if (gCur && gCur.type === 'oneway') {
    const moveDir = dx === 1 ? 'east' : dx === -1 ? 'west' : dy === 1 ? 'south' : 'north';
    const moveDirShort = dx === 1 ? 'E' : dx === -1 ? 'W' : dy === 1 ? 'S' : 'N';
    if (gCur.allow && gCur.allow !== moveDir && gCur.allow !== moveDirShort) {
      tell('段差があり、この方向へは進めない！（一方通行）');
      return render();
    }
  }

  if (!automatic) stopAll();
  d.facing = DIRS.findIndex(a => a[0] === dx && a[1] === dy);
  d.x = x;
  d.y = y;
  d.steps++;
  if (d.steps % 4 === 0) party().forEach(h => h.sp = Math.max(0, (h.sp ?? maxSP(h)) - 1));
  d.sinceBattle++;
  reveal();

  const c = s.corpses.find(c => c.floor.identity === d.identity && c.floor.depth === d.depth && c.floor.x === x && c.floor.y === y);
  if (c) {
    s.gear.push(...c.gear);
    c.links.forEach(link => {
      const h = s.roster.find(h => h.id === link.id);
      if (h) {
        for (const slot of HERO_SLOTS) if (!h[slot] && link[slot] && item(link[slot])) h[slot] = link[slot];
      }
    });
    s.corpses = s.corpses.filter(a => a !== c);
    tell('残された装備を回収した。');
  }

  if (gDest && gDest.type === 'switch') {
    if (!gDest.triggered && !gDest.pressed) {
      gDest.triggered = true;
      gDest.pressed = true;
      if (gDest.target && d.gimmicks[gDest.target]) {
        d.gimmicks[gDest.target].open = true;
      }
      if (gDest.doorId) {
        for (const k of Object.keys(d.gimmicks)) {
          if (d.gimmicks[k].id === gDest.doorId || k === gDest.doorId) d.gimmicks[k].open = true;
        }
      }
      playSE('secret');
      tell('⚡ ガチャン！床のスイッチを踏み、遠くで重い扉が開く音が響いた！');
    }
  }

  if (gDest && gDest.type === 'conveyor') {
    const dirMap = { north: [0, -1], south: [0, 1], east: [1, 0], west: [-1, 0], N: [0, -1], S: [0, 1], E: [1, 0], W: [-1, 0] };
    const [cdx, cdy] = dirMap[gDest.dir] || [0, 0];
    if (cdx !== 0 || cdy !== 0) {
      const nx = d.x + cdx, ny = d.y + cdy;
      if (d.map[ny]?.[nx] && d.map[ny][nx] !== '#') {
        tell('🌀 流れる床に足を取られ、強制的に流された！');
        d.x = nx;
        d.y = ny;
        reveal();
      }
    }
  }

  if (gDest && gDest.type === 'pit' && !gDest.disarmed) {
    if (d.depth < worldMap(d.mapId).depths) {
      stopAll();
      playSE('defeat');
      tell('⚠️ 落とし穴だ！足元の床が抜け、下の階層へと真っ逆さまに転落した…！');
      party().forEach(h => {
        const dmg = Math.max(1, Math.floor(stats(h).hp * 0.1));
        h.hp = Math.max(1, h.hp - dmg);
      });
      s.floorCache ??= {};
      s.floorCache[d.depth] = structuredClone(d);
      const nextDepth = d.depth + 1, cached = s.floorCache[nextDepth];
      if (cached) {
        s.dungeon = cached;
        s.dungeon.x = x; s.dungeon.y = y;
      } else {
        s.dungeon = makeFloor(worldMap(d.mapId), d.seed, nextDepth, [d.downX, d.downY]);
        s.dungeon.x = x; s.dungeon.y = y;
      }
      if (s.dungeon.map[y]?.[x] === '#') s.dungeon.map[y][x] = '.';
      reveal();
      return render();
    }
  }

  const t = d.map[y][x], m = worldMap(d.mapId);
  if (t === 'o') {
    const key = pick(m.materials);
    addMaterial(key, 1 + (random() < .3 ? 1 : 0), d.quality);
    d.map[y][x] = '.';
    tell(DATA.materials[key].name + ' Q' + d.quality + 'を採集した。');
  }
  if (t === 'c') {
    const key = pick(m.materials);
    addMaterial(key, 2, d.quality);
    d.map[y][x] = '.';
    tell('古い採集跡から' + DATA.materials[key].name + ' Q' + d.quality + 'を2個見つけた。');
  }
  if (t === '>' || t === '!' || t === '<') {
    stopAll();
    tell(t === '>' ? '次の階への道を発見。進行は手動で選べる。' : t === '!' ? 'この地域の主の気配。「主に挑む」で戦闘。' : d.depth === 1 ? '地上への出口。「街へ帰還」で生還できる。' : '上の階への階段。');
  }
  if (d.sinceBattle > 2 && t !== '!' && t !== '>' && t !== '<' && random() < Math.min(.48, .10 + d.sinceBattle * .025)) encounter();
  else render();
}
function nextWalkDirection(){const d=s.dungeon;if(!d)return null;const offsets=s.walkRule==='left'&&unlocked('left')?[3,0,1,2]:[1,0,3,2];let options=offsets.map(o=>(d.facing+o)%4).filter(i=>{const [dx,dy]=DIRS[i];return d.map[d.y+dy]?.[d.x+dx]&&d.map[d.y+dy][d.x+dx]!=='#';});if(s.walkRule==='random'&&unlocked('random'))return pick(options);if(s.walkRule==='avoid'&&unlocked('avoid'))options.sort((a,b)=>{const [ax,ay]=DIRS[a],[bx,by]=DIRS[b];return d.visits[d.y+ay][d.x+ax]-d.visits[d.y+by][d.x+bx];});return options[0]??null;}
function walkTick(){if(!s.dungeon||s.battle||s.view!=='explore'){stopWalk();return;}const i=nextWalkDirection();if(i===null){stopAll();return;}s.dungeon.autoSteps++;step(...DIRS[i],true);if(s.autoExpedition&&!s.battle&&typeof heroResourceLimits==='function'){const low=party().find(h=>{const lim=heroResourceLimits(h);return lim.spThreshold>0&&(h.sp??maxSP(h))<=lim.spThreshold;});if(low){const lim=heroResourceLimits(low);stopAll();tell('【兵站管理】'+low.name+'のSPが温存ライン（'+lim.spThreshold+'）に達したため、過労・全滅を防ぐため連続探索を一時停止しました。');render();return;}}if(walkTimer&&s.autoExpedition&&!s.battle){stopWalk();resumeExpedition();}}
function resumeExpedition(){if(s.autoExpedition&&s.dungeon&&!s.battle&&!walkTimer)walkTimer=setInterval(walkTick,walkDelay());}
function toggleWalk(){toggleExpedition();}
function toggleExpedition(){if(s.autoExpedition){stopAll();tell('連続探索を停止した。');}else if(s.dungeon){s.autoExpedition=true;if(s.battle)startBattleTimer();else resumeExpedition();tell('連続探索を開始。遭遇時は現在の戦闘規則で戦い、勝利後は歩行を再開する。');}render();}
function enemyStatsAt(e,level){const l=Math.max(0,level-1),boss=e.id===DATA.boss.id;return{...e,level,hp:Math.round(e.hp*(1+l*(boss?.28:.16))),maxhp:Math.round(e.hp*(1+l*(boss?.28:.16))),atk:Math.round(e.atk+l*(boss?3.5:2.6)),def:Math.round(e.def+l*.75),mag:Math.round(e.mag+l*2.4),speed:e.speed+Math.floor(l/3),xp:Math.round(e.xp*(1+l*.08)),gold:Math.round(e.gold*(1+l*.05))};}
function knowledge(id){const r=s.research[id]||{encounters:0,kills:0,level:1};return{...r,tier:r.encounters>=12||r.kills>=8?4:r.encounters>=6||r.kills>=3?3:r.encounters>=3||r.kills>=1?2:r.encounters?1:0};}
function encounter(boss=false){const d=s.dungeon;if(!d||s.battle)return;stopWalk();const m=worldMap(d.mapId),pool=m.enemies.map(id=>DATA.enemies.find(e=>e.id===id)).filter(Boolean),count=boss?1:2+Math.floor(random()*2)+(d.level>=20&&random()<.4?1:0);const enemies=Array.from({length:count},(_,i)=>({...enemyStatsAt(boss?DATA.boss:pick(pool),d.level),key:i,poison:0,counted:false}));s.battle={enemies,boss,turn:1,plans:{},actor:alive()[0].id,target:0,cover:false,rally:0};d.sinceBattle=0;s.view='explore';for(const e of enemies){const r=s.research[e.id]??={encounters:0,kills:0,level:d.level};r.encounters++;r.level=d.level;}tell(enemies.map(e=>e.name).join('、')+'が現れた！');if(s.autoExpedition)startBattleTimer();render();}
function enemyAlive(){return s.battle?s.battle.enemies.filter(e=>e.hp>0):[];}
function commandName(command,h,skillId=null,itemId=null){if(command==='skill')return DATA.skills[skillId||heroSkills(h)[0]?.id]?.name||'技';if(command==='item')return DATA.items[itemId]?.name||'道具';return{attack:'戦う',defend:'防御',escape:'逃走'}[command]||command;}
function planCommand(command,target=null,skillId=null,itemId=null){const b=s.battle;if(!b)return;const h=alive().find(h=>h.id===b.actor);if(!h)return;const skill=DATA.skills[skillId];if(command==='skill'&&(!heroSkills(h).some(k=>k.id===skillId)||h.lv<skill.level||h.mp<skill.mp||h.sp<(skill.sp||0))){tell('習得レベルまたはMP条件を満たしていません。');return render();}if(command==='item'&&(!(s.items[itemId]>0)||!DATA.items[itemId])){tell('その道具を所持していません。');return render();}const ally=command==='skill'&&['ally','allAllies','self'].includes(skill.target)||command==='item'&&['heal','mp','sp','revive','cleanse'].includes(DATA.items[itemId]?.kind);b.plans[h.id]={command,target:target??(ally?h.id:enemyAlive()[0].key),...(skillId?{skill:skillId}:{}),...(itemId?{item:itemId}:{})};const next=alive().find(a=>!b.plans[a.id]);if(next)b.actor=next.id;render();}
function physicalDamage(h){return stats(h).atk*(h.row==='back'&&!['ranger','mage','priest','alchemist','archer','druid','warlock'].includes(h.job)?.7:1);}
function damageEnemy(e,power,element='physical'){if(e.hp<=0)return 0;let n=Math.max(1,power-(element==='physical'?e.def*.6:e.mag*.2));if(e.weak===element)n*=1.6;if(e.resist===element)n*=.5;n=Math.max(1,Math.round(n*(.9+random()*.2)));e.hp=Math.max(0,e.hp-n);if(!e.hp&&!e.counted){e.counted=true;const r=s.research[e.id]??={encounters:1,kills:0,level:e.level||1};r.kills++;s.kills++;}return n;}
function heroAttack(h,e,multiplier=1,elementOverride=null,spend=true){if(!e)return;const g=item(h.weapon),ench=g?.dur?DATA.enchants[g.enchant]:null,element=elementOverride||ench?.element||'physical',power=(physicalDamage(h)+enchantPower(g))*multiplier*(s.battle?.rally>0?(s.battle.rallyPower||1.25):1),n=damageEnemy(e,power,element);note(h.name+' → '+e.name+'：'+n+(e.weak===element?' 弱点！':''));if(g?.enchant==='vampire'&&g.dur)h.hp=Math.min(stats(h).hp,h.hp+Math.floor(n*.2));if(spend){const lim=typeof heroResourceLimits==='function'?heroResourceLimits(h):{spThreshold:0};if((h.sp??maxSP(h))>lim.spThreshold)h.sp=Math.max(lim.spThreshold,(h.sp??maxSP(h))-1);}if(g?.dur>0){g.dur--;if(!g.dur)note(h.name+'の武器が破損した。');}return n;}
function allyDamage(h,power,magic=false,guarding=false){const st=stats(h),armor=item(h.armor);let n=Math.max(3,power-(magic?attributes(h).MGR*.4:st.def*.35));if(h.row==='back'&&!magic)n*=.8;if(guarding)n*=.4;if(s.battle?.cover)n*=s.battle.coverPower||.65;if(s.battle?.personalGuards?.[h.id])n*=s.battle.personalGuards[h.id];if(magic&&armor?.enchant&&DATA.enchants[armor.enchant].slot==='armor')n=Math.max(2,n-enchantPower(armor));n=Math.max(1,Math.round(n*(.9+random()*.2)));h.hp=Math.max(0,h.hp-n);if(armor?.dur>0)armor.dur--;return n;}
function cast(h,target,skillId){const k=DATA.skills[skillId];if(!k||h.lv<k.level||h.mp<k.mp||h.sp<(k.sp||0)||!heroSkills(h).some(a=>a.id===skillId)){note(h.name+'は技を使えなかった。');return;}h.mp-=k.mp;h.sp=Math.max(0,h.sp-(k.sp||0));const st=stats(h),foe=enemyAlive().find(e=>e.key===target)||enemyAlive()[0],ally=party().find(a=>a.id===target)||h,targets=k.target==='allEnemies'?enemyAlive():k.target==='allAllies'?alive():k.target==='ally'?[ally]:k.target==='self'?[h]:[foe];for(const a of targets){if(!a)continue;if(k.kind==='attack'||k.kind==='poison'){heroAttack(h,a,k.power||1,k.element||'physical',false);if(k.kind==='poison'&&a.hp>0)a.poison=3;}if(k.kind==='damage'||k.kind==='drain'){const n=damageEnemy(a,st.mag*(k.power||1),k.element||'fire');note(k.name+' → '+a.name+'：'+n);if(k.kind==='drain')h.hp=Math.min(st.hp,h.hp+Math.floor(n*.3));}if(k.kind==='heal'){if(a.hp<=0){note(a.name+'は蘇生薬が必要。');continue;}const n=Math.round(st.mag*(k.power||1));a.hp=Math.min(stats(a).hp,a.hp+n);note(k.name+' → '+a.name+'：HP +'+n);}if(k.kind==='cleanse'){a.poison=0;note(a.name+'の毒を治療した。');}}if(k.kind==='guard'){if(k.target==='self'){s.battle.personalGuards??={};s.battle.personalGuards[h.id]=k.power;}else if(k.target==='ally'){s.battle.personalGuards??={};s.battle.personalGuards[ally.id]=k.power;}else{s.battle.cover=true;s.battle.coverPower=k.power;}note(k.name+'：指定対象の被害を軽減。');}if(k.kind==='rally'){s.battle.rally=3;s.battle.rallyPower=k.power;note('3ターン、味方の物理攻撃を強化。');}}
function useItem(key,heroId,inBattle=false,enemyId=null,user=null){const def=DATA.items[key];if(!def||!(s.items[key]>0)||(!inBattle&&s.battle))return false;const h=s.roster.find(h=>h.id===heroId),wisdom=1+Math.max(0,attributes(user||h||party()[0]).WIZ-10)*.015;if(['heal','mp','sp','revive','cleanse'].includes(def.kind)&&!h)return false;if(def.kind==='heal'){if(h.hp<=0||h.hp>=stats(h).hp){note('回復薬は生存者のHP回復用。蘇生には蘇生薬が必要。');return false;}h.hp=Math.min(stats(h).hp,h.hp+Math.round(def.power*wisdom));}else if(def.kind==='mp'){if(h.hp<=0||h.mp>=stats(h).mp)return false;h.mp=Math.min(stats(h).mp,h.mp+Math.round(def.power*wisdom));}else if(def.kind==='sp'){if(!h||h.hp<=0||h.sp>=maxSP(h))return false;h.sp=Math.min(maxSP(h),h.sp+Math.round(def.power*wisdom));}else if(def.kind==='revive'){if(h.hp>0)return false;h.hp=Math.max(1,Math.min(stats(h).hp,Math.round(stats(h).hp*def.power)));h.poison=0;}else if(def.kind==='cleanse'){if(!h.poison)return false;h.poison=0;}else if(def.kind==='damage'){if(!s.battle)return false;const e=enemyAlive().find(e=>e.key===enemyId)||enemyAlive()[0];damageEnemy(e,Math.round(def.power*wisdom),def.element||'fire');}else if(def.kind==='escape'){if(inBattle){note('帰還符は戦闘中に使えない。逃走が必要。');return false;}if(key==='scroll'){returnTown();return true;}return false;}else return false;s.items[key]--;note(def.name+'を使用。');return true;}
function enemyTurn(e,guards){if(e.hp<=0||!alive().length)return;const targets=alive(),weighted=targets.flatMap(h=>Array(h.row==='front'?3:1).fill(h)),target=pick(weighted),magic=e.ai==='hex',hit=e.ai==='cleave'&&s.battle.turn%2===0?targets:[target];if(e.ai==='armor'&&s.battle.turn%3===0){e.def+=2;note(e.name+'が装甲を固めた。');return;}for(const h of hit){const n=allyDamage(h,magic?e.mag+6:e.atk*(hit.length>1?.85:1),magic,guards.has(h.id));note(e.name+' → '+h.name+'：'+n+' ダメージ。');if(e.ai==='poison'&&h.hp>0&&random()<.6){h.poison=3;note(h.name+'が毒を受けた。');}if(e.ai==='drain')e.hp=Math.min(e.maxhp,e.hp+Math.floor(n*.6));if(!h.hp)note(h.name+'が倒れた。');}}
function defeat(){const d=s.dungeon;stopAll();const ids=new Set([...party().flatMap(h=>HERO_SLOTS.map(slot=>h[slot])).filter(Boolean),...s.gear.filter(g=>s.active.includes(g.ownerId)).map(g=>g.id)]),gear=s.gear.filter(g=>ids.has(g.id)),links=party().map(h=>Object.fromEntries([['id',h.id],...HERO_SLOTS.map(slot=>[slot,h[slot]??null])]));s.corpses.push({id:Date.now()+'-'+s.nextGear,floor:structuredClone(d),gear,links,until:Date.now()+Math.min(1800000,Math.max(10000,(Date.now()-d.started)*5))});s.gear=s.gear.filter(g=>!ids.has(g.id));party().forEach(h=>{HERO_SLOTS.forEach(slot=>h[slot]=null);h.hp=1;h.mp=0;h.sp=0;h.poison=0;});s.gold=Math.floor(s.gold*.8);s.battle=null;s.dungeon=null;s.view='town';tell('全滅。装備と金貨20%を失い、HP1・MP0で街へ搬送された。有料休息が必要。');}
function victory(){const b=s.battle;stopBattle();let xp=0,gold=0;for(const e of b.enemies){xp+=e.xp;gold+=e.gold;if(e.drop&&DATA.materials[e.drop])addMaterial(e.drop,1,s.dungeon.quality);}earnGold(gold);for(const h of party()){h.xp+=Math.round(xp*.5);while(h.lv<300&&h.xp>=xpNeeded(h)){h.xp-=xpNeeded(h);h.lv++;note(h.name+'がLv.'+h.lv+'に成長。能力上昇、HP/MPは回復しない。');}}if(b.boss){s.won=true;s.dungeon.map[s.dungeon.y][s.dungeon.x]='.';earnGold(worldMap(s.dungeon.mapId).level*80+100);note('地域の主を討伐。ギルドの討伐報酬を獲得した。');}s.battle=null;s.view='explore';tell('勝利。各員 EXP +'+Math.round(xp*.5)+(gold?' / '+gold+' G':'')+'。');resumeExpedition();}
function enemyTurnAfterEscapeFail(b){
  const guards=new Set();
  for(const e of enemyAlive()){
    if(!alive().length)break;
    enemyTurn(e,guards);
  }
  if(s.battle){
    for(const h of alive()){
      if(h.poison){
        const n=5+Math.floor(s.dungeon.level*.3);
        h.hp=Math.max(0,h.hp-n);
        h.poison--;
        note(h.name+'に毒 '+n+'。');
      }
    }
    for(const e of enemyAlive()){
      if(e.poison){
        damageEnemy(e,6+s.dungeon.level,'dark');
        e.poison--;
      }
    }
    if(!alive().length)defeat();
    else{
      b.turn++;
      b.plans={};
      b.actor=alive()[0].id;
      b.cover=false;
      b.coverPower=1;
      b.rally=Math.max(0,b.rally-1);
    }
  }
  render();
}
function partyEscape(){
  const b=s.battle;
  if(!b||s.view!=='explore')return false;
  stopAll();
  if(b.boss){
    tell('しかし回り込まれてしまった！この強敵からは逃げられない！');
    enemyTurnAfterEscapeFail(b);
    return false;
  }
  const chance=Math.min(.9,Math.max(.20,.50+(partyLevel()-s.dungeon.level)*.02+partyCharm()*.004));
  if(random()<chance){
    playSE?.('escape');
    stopBattle();
    s.battle=null;
    s.view='explore';
    s.dungeon.sinceBattle=0;
    tell('💨 パーティー全員で戦闘から離脱した！');
    if(s.autoExpedition&&s.battleRules.includes('retreat')&&unlocked('retreat')){
      s.autoExpedition=false;
      returnTown();
    }else{
      resumeExpedition();
    }
    render();
    return true;
  }else{
    playSE?.('defeat');
    tell('💨 逃走を試みたが、回り込まれてしまった！');
    enemyTurnAfterEscapeFail(b);
    return false;
  }
}
globalThis.partyEscape=partyEscape;
function executeTurn(){const b=s.battle;if(!b)return;if(alive().some(h=>!b.plans[h.id])){tell('全員のコマンドを選んでください。');return render();}const guards=new Set(alive().filter(h=>b.plans[h.id].command==='defend').map(h=>h.id));b.cover=false;b.personalGuards={};const guardHeroes=[];for(const h of alive()){const p=b.plans[h.id],k=DATA.skills[p.skill];if(p.command==='skill'&&k?.kind==='guard'&&h.lv>=k.level&&h.mp>=k.mp&&h.sp>=(k.sp||0)&&heroSkills(h).some(sk=>sk.id===p.skill)){h.mp-=k.mp;h.sp-=k.sp||0;if(k.target==='self')b.personalGuards[h.id]=k.power;else if(k.target==='ally')b.personalGuards[p.target]=k.power;else{b.cover=true;b.coverPower=Math.min(b.coverPower||1,k.power);}guardHeroes.push(h.id);note(h.name+'が守護の構え。');}}let escapeTried=false;const order=[...alive().map(h=>({kind:'hero',id:h.id,speed:stats(h).speed+random()*3})),...enemyAlive().map(e=>({kind:'enemy',id:e.key,speed:e.speed+random()*3}))].sort((a,c)=>c.speed-a.speed);for(const action of order){if(!s.battle||!alive().length||!enemyAlive().length)break;if(action.kind==='hero'){const h=alive().find(h=>h.id===action.id);if(!h)continue;const p=b.plans[h.id],e=enemyAlive().find(e=>e.key===p.target)||enemyAlive()[0];if(p.command==='attack')heroAttack(h,e);if(p.command==='skill'&&!guardHeroes.includes(h.id))cast(h,p.target,p.skill);if(p.command==='item')useItem(p.item,p.target,true,p.target,h);if(p.command==='escape'&&!escapeTried){escapeTried=true;const chance=b.boss?.18:Math.min(.9,Math.max(.15,.45+(partyLevel()-s.dungeon.level)*.015+partyCharm()*.003));if(random()<chance){stopBattle();s.battle=null;s.view='explore';s.dungeon.sinceBattle=0;note('戦闘から離脱した。');if(s.autoExpedition&&s.battleRules.includes('retreat')&&unlocked('retreat')){s.autoExpedition=false;returnTown();}else resumeExpedition();break;}note('逃走は阻まれた。逃走判定はパーティーで1ターン1回。');}}else{const e=enemyAlive().find(e=>e.key===action.id);if(e)enemyTurn(e,guards);}}
 if(s.battle){for(const h of alive())if(h.poison){const n=5+Math.floor(s.dungeon.level*.3);h.hp=Math.max(0,h.hp-n);h.poison--;note(h.name+'に毒 '+n+'。');}for(const e of enemyAlive())if(e.poison){damageEnemy(e,6+s.dungeon.level,'dark');e.poison--;}if(!alive().length)defeat();else if(!enemyAlive().length)victory();else{b.turn++;b.plans={};b.actor=alive()[0].id;b.cover=false;b.coverPower=1;b.rally=Math.max(0,b.rally-1);}}render();}
function autoPlans(){const b=s.battle;if(!b)return;b.plans={};const wounded=alive().slice().sort((a,c)=>a.hp/stats(a).hp-c.hp/stats(c).hp),low=wounded[0];let healerUsed=false;for(const h of alive()){let p={command:'attack',target:enemyAlive()[0].key};const available=heroSkills(h).filter(k=>k.level<=h.lv&&k.mp<h.mp&&(k.sp||0)<=h.sp);if(s.battleRules.includes('retreat')&&unlocked('retreat')&&(alive().length<=party().length/2||alive().every(a=>a.hp/stats(a).hp<.25)))p={command:'escape',target:0};else if(s.battleRules.includes('heal')&&unlocked('heal')&&low.hp/stats(low).hp<.45&&!healerUsed){const heal=available.find(k=>k.kind==='heal');if(heal){p={command:'skill',skill:heal.id,target:low.id};healerUsed=true;}else if(s.items.potion>0){p={command:'item',item:'potion',target:low.id};healerUsed=true;}}
 if(p.command==='attack'&&s.battleRules.includes('weak')&&unlocked('weak')){const w=item(h.weapon),el=w?.enchant?DATA.enchants[w.enchant].element:'physical',target=enemyAlive().find(e=>knowledge(e.id).tier>=3&&e.weak===el);if(target)p.target=target.key;const k=available.find(k=>['damage','attack','poison','drain'].includes(k.kind)&&enemyAlive().some(e=>knowledge(e.id).tier>=3&&e.weak===k.element));if(k)p={command:'skill',skill:k.id,target:enemyAlive().find(e=>knowledge(e.id).tier>=3&&e.weak===k.element).key};}b.plans[h.id]=p;}}
function startBattleTimer(){if(battleTimer)return;battleTimer=setInterval(()=>{if(!s.battle){stopBattle();return;}autoPlans();executeTurn();},1500);}
function toggleAutoBattle(){if(battleTimer){stopBattle();s.autoExpedition=false;}else if(s.battle)startBattleTimer();render();}
function townOnly(){if(s.dungeon||s.battle){tell('街で利用できます。');render();return false;}return true;}
function innCost(){return Math.ceil((28+partyLevel()*12+party().length*6)*currentTown().price);}
function rest(credit=false){if(!townOnly())return;const cost=innCost();if(s.gold<cost){if(!credit){tell('宿泊料 '+cost+' Gが必要です。金貨不足なら宿泊掛けを利用できます。');return render();}const gap=cost-s.gold,limit=Math.ceil((28+partyLevel()*12+party().length*6)*3*currentTown().price);if(s.debt+gap>limit){tell('宿泊掛けの上限です。採集品の売却や依頼で返済してください。');return render();}s.debt+=gap;s.gold=0;}else s.gold-=cost;party().forEach(h=>{h.hp=stats(h).hp;h.mp=stats(h).mp;h.sp=maxSP(h);h.poison=0;});tell('宿泊料 '+cost+' Gで全回復。'+(s.debt?'未返済 '+s.debt+' G。':''));render();}
function supplyPrice(id){return Math.ceil((DATA.items[id]?.cost||0)*currentTown().price*buyFactor());}
function buyItem(id){if(!townOnly()||!DATA.items[id])return;const cost=supplyPrice(id);if(s.gold<cost){tell('購入には'+cost+' Gが必要です。');return render();}s.gold-=cost;s.items[id]=(s.items[id]||0)+1;tell(DATA.items[id].name+'を購入。');render();}
function recruitCost(){return Math.ceil((100+partyLevel()*35)*currentTown().price);}
function changeJob(id,job){if(!townOnly())return;const h=s.roster.find(h=>h.id===id),j=DATA.jobs[job];if(!h||!j||!canJob(h,job))return;syncHero(h);const old=stats(h),hp=h.hp/old.hp,mp=h.mp/old.mp;h.job=job;h.hp=Math.floor(stats(h).hp*hp);h.mp=Math.floor(stats(h).mp*mp);tell(h.name+'は'+j.name+'に転職した。');render();}
function toggleMember(id){if(!townOnly())return;if(s.active.includes(id)){if(s.active.length===1)return;s.active=s.active.filter(v=>v!==id);}else if(s.active.length<6)s.active.push(id);else tell('参加できるのは6人までです。');render();}
function recruit(job){if(!townOnly()||!DATA.jobs[job]||DATA.jobs[job].base===false||DATA.jobs[job].requirements)return;if(s.roster.length>=16){tell('登録上限は16人です。');return render();}const cost=recruitCost();if(s.gold<cost){tell('登録料 '+cost+' Gが必要です。');return render();}s.gold-=cost;const id=s.nextHero++;s.roster.push(makeHero(id,'探索者'+id,job,s.active.length<3?'front':'back'));if(s.active.length<6)s.active.push(id);tell('新しい仲間を登録した。');render();}
function costText(m){return Object.entries(m).map(([k,v])=>DATA.materials[k].name+' × '+v).join(' / ');}
function canPay(gold,m,q=1){return s.gold>=gold&&Object.entries(m).every(([k,v])=>availableMaterial(k,q)>=v);}
function pay(gold,m,q=1){s.gold-=gold;for(const [k,v]of Object.entries(m))consumeMaterial(k,v,q);}
function craftQuote(material,slot,method){const m=DATA.materials[material],quality=Math.min(currentTown().quality,Math.max(1,s.craftQuality||1)),materials={[material]:slot==='weapon'?5:6};if(method==='magic')materials.crystal=(materials.crystal||0)+2;return{gold:Math.ceil((m.cost*4+(method==='magic'?120:0))*quality*quality*currentTown().price),materials,quality};}
function craft(material,slot,method){if(!townOnly()||!DATA.materials[material]||!['weapon','armor'].includes(slot)||!['physical','magic'].includes(method))return;const m=DATA.materials[material];if(!m.craftable){tell('この素材の加工用途はまだ開発されていません。');return render();}const q=craftQuote(material,slot,method);if(!canPay(q.gold,q.materials,q.quality)){tell('製作費またはQ'+q.quality+'以上の素材が足りません。');return render();}pay(q.gold,q.materials,q.quality);const maxDur=method==='physical'?140:90;s.gear.push({id:s.nextGear++,material,slot,method,enchant:null,quality:q.quality,dur:maxDur,maxDur});tell(gearName(s.gear.at(-1))+'を製作。装備先を選ぼう。');render();}
function equip(id,heroId){if(!townOnly())return;const g=item(id),h=s.roster.find(h=>h.id===heroId);if(!g||!h)return;if(!canEquip(h,g)){tell(gearRequirementText(g));return render();}for(const a of s.roster)if(a[g.slot]===id)a[g.slot]=null;h[g.slot]=id;tell(h.name+'に装備した。');render();}
function enchantQuote(g,id){const e=DATA.enchants[id];return{gold:Math.ceil(e.cost*(g.quality||1)**2*currentTown().price),materials:e.materials};}
function applyEnchant(id,enchantId){if(!townOnly())return;const g=item(id),e=DATA.enchants[enchantId];if(!g||!e)return;if((e.slot||'weapon')!==g.slot){tell('この付呪は装備種が合いません。');return render();}const q=enchantQuote(g,enchantId);if(!canPay(q.gold,q.materials)){tell('付呪の費用か素材が足りません。');return render();}pay(q.gold,q.materials);g.enchant=enchantId;tell(e.name+'を付呪。数値効果 '+enchantPower({...g,dur:1})+'。');render();}
function repairCost(g){return Math.max(10,Math.ceil((g.maxDur-g.dur)*(.4+g.quality*.15)*currentTown().price));}
function repair(id){if(!townOnly())return;const g=item(id);if(!g||g.dur>=g.maxDur)return;const cost=repairCost(g);if(s.gold<cost){tell('修理費 '+cost+' Gが必要です。');return render();}s.gold-=cost;g.dur=g.maxDur;tell('装備を修理した。');render();}
function upgradeQuote(g){return{gold:Math.ceil(DATA.materials[g.material].cost*8*(g.quality+1)**2*currentTown().price),materials:g.material==='crystal'?{crystal:6}:{[g.material]:4,crystal:2},nextQuality:g.quality+1};}
function upgrade(id){if(!townOnly())return;const g=item(id);if(!g)return;const q=upgradeQuote(g);if(q.nextQuality>currentTown().quality||q.nextQuality>13){tell('この街の設備ではQ'+q.nextQuality+'へ強化できません。');return render();}if(!canPay(q.gold,q.materials,q.nextQuality)){tell('強化費または必要品質の素材が不足しています。');return render();}pay(q.gold,q.materials,q.nextQuality);g.quality=q.nextQuality;g.maxDur+=10;g.dur=g.maxDur;tell('Q'+g.quality+'へ強化した。');render();}
function buyBook(id){if(!townOnly())return;const b=DATA.rules.find(b=>b.id===id);if(!b||s.books.includes(id))return;const cost=Math.ceil(b.cost*currentTown().price);if(partyLevel()<b.level||s.gold<cost){tell('パーティーLv.'+b.level+'と '+cost+' Gが必要です。');return render();}s.gold-=cost;s.books.push(id);tell(b.name+'を習得した。');render();}
function sellMaterial(id){if(!townOnly()||!DATA.materials[id]||!s.materials[id])return;const q=Math.min(...Object.keys(s.stock[id]).filter(q=>s.stock[id][q]>0).map(Number)),price=Math.max(1,Math.floor(DATA.materials[id].cost*.1*q*sellFactor()));consumeMaterial(id,1,q);earnGold(price);tell(DATA.materials[id].name+' Q'+q+'を'+price+' Gで売却。');render();}
function equipmentProductName(g){
 const m=DATA.materials[g.material],weapon=g.slot==='weapon';
 if(g.material==='hide')return weapon?'鞭':'革鎧';
 if(g.material==='silk')return weapon?'投石紐':'織鎧';
 if(['bone','fang'].includes(g.material))return weapon?'骨刀':'骨鎧';
 if(g.material==='scale')return weapon?'刃':'鱗鎧';
 if(m?.category==='wood')return weapon?'棍棒':'板鎧';
 if(m?.category==='stone')return weapon?'斧':'護胸板';
 if(m?.category==='gem')return weapon?'杖':'護符';
 return weapon?'短剣':'胸当て';
}
function gearName(g){if(!g)return'素手';const m=DATA.materials[g.material];return m.name+'の'+equipmentProductName(g)+(g.enchant?' / '+DATA.enchants[g.enchant].name:'');}
function normalizedAddress(input){let text=input.trim();if(!text)return'';if(text.includes('@')&&!text.includes('://'))return text.toLowerCase();try{const url=new URL(text.includes('://')?text:'https://'+text);return url.hostname.toLowerCase()+url.pathname.replace(/\/$/,'')+url.search;}catch{return text;}}
function addressBlueprint(input){const canonical=normalizedAddress(input),seed=hash('address:'+canonical),fingerprint=seed.toString(16).padStart(8,'0')+hash('identity:'+canonical).toString(16).padStart(8,'0'),r=rng(seed),level=80+Math.floor(r()*221),template=DATA.maps[Math.floor(r()*DATA.maps.length)],names=DATA.townNames,prefix=names.prefixes[Math.floor(r()*names.prefixes.length)],suffix=names.suffixes[Math.floor(r()*names.suffixes.length)],town={id:'town-'+fingerprint,name:prefix+suffix,level,price:Math.round((1+level/25)*100)/100,quality:Math.min(13,1+Math.floor(level/25)),baseCost:5000+level*level*4,owned:false,seed};const map={...structuredClone(template),id:'address-'+fingerprint,name:town.name+'外縁・'+template.name,level,recommendedLevel:Math.min(300,Math.max(level,Math.round(level*1.5+6))),depths:3,seed:hash('terrain:'+canonical),townId:town.id,quality:town.quality,description:'アドレスから生まれた高危険度の探索域。高品質素材と強敵が待つ。',quest:{...template.quest,reward:Math.round(template.quest.reward*(1+level/10)),amount:template.quest.amount+Math.floor(level/25)}};return{town,map};}
function discoverAddress(input){if(!input.trim())return;const plan=addressBlueprint(input);if(!s.towns.some(t=>t.id===plan.town.id))s.towns.push(plan.town);if(!s.addressMaps.some(m=>m.id===plan.map.id))s.addressMaps.push(plan.map);s.addressPreview={town:s.towns.find(t=>t.id===plan.town.id),map:s.addressMaps.find(m=>m.id===plan.map.id)};tell('座標を解読：'+plan.town.name+' / 推奨Lv.'+(plan.map.recommendedLevel||plan.map.level)+' / Q'+plan.town.quality+'。');render();}
function travelTown(id){if(!townOnly())return;const t=s.towns.find(t=>t.id===id);if(!t)return;s.townId=t.id;s.view='town';tell(t.name+'へ到着。物価 ×'+t.price+' / 工房 Q'+t.quality+'。');render();}
function settleTown(id){if(!townOnly())return;const t=s.towns.find(t=>t.id===id);if(!t)return;if(!t.owned){if(s.gold<t.baseCost){tell('拠点権の購入には'+t.baseCost+' Gが必要です。');return render();}s.gold-=t.baseCost;t.owned=true;}s.homeTownId=id;s.townId=id;tell(t.name+'を活動拠点にした。');render();}
function acceptQuest(id){if(!townOnly())return;const m=worldMap(id);if(!m.quest)return;s.quests[id]={accepted:true,completed:false,times:s.quests[id]?.times||0};tell(m.quest.name+'を受注。'+DATA.materials[m.quest.material].name+' ×'+m.quest.amount+'を納品する。');render();}
function deliverQuest(id){if(!townOnly())return;const m=worldMap(id),q=m.quest,progress=s.quests[id],quality=m.quality||Math.min(13,1+Math.floor(m.level/25));if(!q||!progress?.accepted||progress.completed)return;if(availableMaterial(q.material,quality)<q.amount){tell('納品には'+DATA.materials[q.material].name+' Q'+quality+'以上 ×'+q.amount+'が必要。');return render();}consumeMaterial(q.material,q.amount,quality);earnGold(q.reward);progress.completed=true;progress.accepted=false;progress.times++;tell(q.name+'を達成。報酬 '+q.reward+' G。再受注できます。');render();}
function moveView(view){if(view==='journal'){s.ext??={};s.ext.catalogTab='field_mon';view='catalog';}if(view==='supplies')view='shop';if(s.battle&&!['explore','battle'].includes(view)){tell('戦闘中です。先にコマンドを選んでください。');return render();}if(s.dungeon&&!['explore','journal','catalog'].includes(view)){tell('帰還後に利用できます。');return render();}if(view!=='explore')stopAll();s.view=view==='battle'?'explore':view;notice='';render();}
function openCharacter(id){const h=s.roster.find(h=>h.id===id);if(!h)return;stopAll();s.selection=id;if(s.battle&&h.hp>0)s.battle.actor=id;$('character-body').innerHTML=characterScreen(h);$('character-dialog').showModal();render();}
function esc(v) { return String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function btn(label,action,attrs='',cls='') { return `<button class="${cls}" data-action="${action}" ${attrs}>${label}</button>`; }
function title(kicker,heading,desc='') { return `<p class="eyebrow">${kicker}</p><h1>${heading}</h1>${desc?`<p class="lead">${desc}</p>`:''}`; }
function bars(h) { const st=stats(h);return `<div class="numbers"><span>LIFE ${h.hp} / ${st.hp}</span><span>MANA ${h.mp} / ${st.mp}</span></div><div class="bar"><i style="width:${Math.min(100,h.hp/st.hp*100)}%"></i></div><div class="bar mp"><i style="width:${Math.min(100,h.mp/st.mp*100)}%"></i></div>${h.poison?`<span class="status">毒 残り${h.poison}ターン</span>`:''}`; }
function mini(h,battle=false) { const j=DATA.jobs[h.job];return `<div class="mini ${h.hp<=0?'dead':''} ${battle&&s.battle.actor===h.id?'selected':''}">${battle?`<button data-action="actor" data-id="${h.id}" ${h.hp<=0?'disabled':''}>${j.icon} ${esc(h.name)}</button>`:`<b>${j.icon} ${esc(h.name)}</b>`}<div class="numbers"><span>${j.name} Lv.${h.lv}</span><span>${h.row==='front'?'前衛':'後衛'}</span></div>${bars(h)}${battle?`<small>${s.battle.plans[h.id]?commandName(s.battle.plans[h.id].command,h):'行動未選択'}</small>`:''}</div>`; }
function strip(battle=false) { return `<div class="party-strip">${party().map(h=>mini(h,battle)).join('')}</div>`; }
function logHTML(limit=8) { const exp=s.ext?.logExpanded; const items=s.log.slice(0,exp?100:limit); return `<div class="log ${exp?'expanded':''}">${items.map(t=>`<p>${esc(t)}</p>`).join('')}</div>`; }
function materialsHTML() { return `<div class="inventory-line">${Object.entries(DATA.materials).map(([k,m])=>`<span>${m.name} <b class="gold">${s.materials[k]}</b></span>`).join('')}</div>`; }

function draw() {
  const canvas=$('map');if(!canvas||!s.dungeon)return;const ctx=canvas.getContext('2d');if(!ctx)return;const d=s.dungeon,z=35,ox=(760-19*z)/2,oy=22;ctx.fillStyle='#0d1710';ctx.fillRect(0,0,760,500);
  for(let y=0;y<13;y++)for(let x=0;x<19;x++){
    const px=ox+x*z,py=oy+y*z;if(!d.seen[y][x]){ctx.fillStyle='#101c13';ctx.fillRect(px,py,z-1,z-1);continue;}
    const t=d.map[y][x];ctx.fillStyle=t==='#'?(worldMap(d.mapId).color||'#394b38'):'#243627';ctx.fillRect(px,py,z-1,z-1);
    if(t==='#'){ctx.fillStyle='#50604a';ctx.fillRect(px,py,z-1,3);ctx.fillStyle='#293d29';ctx.fillRect(px+4,py+14,25,2);}else{ctx.fillStyle='#3b5036';ctx.fillRect(px+6,py+27,5,2);}
    const mark={o:'◆',c:'▣','>':'◎','!':'✧'}[t];if(mark){ctx.font='24px Georgia';ctx.textAlign='center';ctx.fillStyle=t==='o'?'#8bb9b1':'#d7bd80';ctx.fillText(mark,px+17,py+26);}
  }
  for(const c of s.corpses)if(c.floor.seed===d.seed&&c.floor.depth===d.depth&&d.seen[c.floor.y][c.floor.x]){ctx.font='28px Georgia';ctx.fillStyle='#f0b69c';ctx.textAlign='center';ctx.fillText('†',ox+c.floor.x*z+17,oy+c.floor.y*z+27);}
  const px=ox+d.x*z+17,py=oy+d.y*z+17,g=ctx.createRadialGradient(px,py,2,px,py,70);g.addColorStop(0,'#edce7c66');g.addColorStop(1,'#edce7c00');ctx.fillStyle=g;ctx.fillRect(px-70,py-70,140,140);ctx.fillStyle='#eedaa6';ctx.beginPath();ctx.arc(px,py-5,5,0,Math.PI*2);ctx.fill();ctx.fillStyle='#bfa56a';ctx.fillRect(px-6,py+1,12,12);ctx.fillStyle='#ffe8a7';const [dx,dy]=DIRS[d.facing];ctx.fillRect(px+dx*12-2,py+dy*12-2,4,4);
}


function render(){
  s.roster.forEach(syncHero);
  if(s.battle)s.view='explore';
  const screens={tavern:()=>tavernScreen(),inn:()=>innScreen(),shop:()=>shopScreen(),temple:()=>templeScreen(),town:townScreen,atlas:()=>(typeof atlasScreen==='function'?atlasScreen():guildScreen()),guild:()=>guildScreen(),party:partyScreen,forge:forgeScreen,rules:rulesScreen,supplies:suppliesScreen,explore:exploreScreen,journal:journalScreen,catalog:catalogScreen};
  const cal=s.calendar; const timeStr=cal?` · 冒険 ${cal.day}日目 ${String(cal.hour).padStart(2,'0')}:${String(cal.minute).padStart(2,'0')}`:''; $('summary').innerHTML=`<span class="gold">${s.gold} G</span> · Lv.${partyLevel()}${timeStr}${s.debt?' · 債務 '+s.debt+' G':''}`;
  $('nav').innerHTML=[['town','街'],['atlas','地図'],['guild','依頼'],['party','仲間'],['forge','工房'],['rules','行動書'],['tavern','酒場'],['inn','宿屋'],['shop','商店'],['temple','神殿'],['explore','探索'],['catalog','手帳']].map(([id,name])=>btn(name,'view',`data-view="${id}" ${id==='explore'&&!s.dungeon?'disabled':''}`,s.view===id?'selected':'')).join('');
  $('notice').textContent=notice;$('app').innerHTML=(screens[s.view]||townScreen)();draw();save();$('save-status').textContent=storageOK?'保存済み':'保存できません。ブラウザの保存設定を確認してください。';
}
function handleAction(event){const button=event.target.closest('[data-action]');if(!button||button.disabled)return;const d=button.dataset,id=Number(d.id),a=d.action;notice='';
 const calls={view:()=>moveView(d.view),character:()=>openCharacter(id),actor:()=>{if(s.battle){s.battle.actor=id;render();}},'actor-close':()=>{$('character-dialog').close();if(s.battle)s.battle.actor=id;render();},target:()=>{if(s.battle){s.battle.target=id;render();}},command:()=>{const k=DATA.skills[d.skill],it=DATA.items[d.item],ally=k&&['ally','self','allAllies'].includes(k.target)||it&&['heal','mp','sp','revive','cleanse'].includes(it.kind);planCommand(d.command,Number($(ally?'ally-target':'enemy-target')?.value||0),d.skill,d.item);},template:()=>{autoPlans();render();},execute:executeTurn,'party-escape':()=>partyEscape(),'auto-battle':toggleAutoBattle,expedition:toggleExpedition,walk:toggleWalk,member:()=>toggleMember(id),row:()=>{if(townOnly()){const h=s.roster.find(h=>h.id===id);h.row=h.row==='front'?'back':'front';render();}},recruit:()=>recruit($('recruit-job').value),craft:()=>craft(s.craftMaterial||'iron',s.craftSlot||'weapon',s.craftMethod||'physical'),equip:()=>equip(id,Number($('equip-'+id).value)),enchant:()=>applyEnchant(id,$('enchant-'+id).value),repair:()=>repair(id),upgrade:()=>upgrade(id),book:()=>buyBook(d.id),'battle-rule':()=>{if(unlocked(d.id)){s.battleRules=s.battleRules.includes(d.id)?s.battleRules.filter(v=>v!==d.id):[...s.battleRules,d.id];render();}},descend,boss:bossChallenge,return:returnTown,step:()=>step(Number(d.dx),Number(d.dy)),rest:()=>rest(), 'rest-credit':()=>rest(true),recover:()=>enterMap('',d.id),'discover-address':()=>discoverAddress($('address').value),'travel-town':()=>travelTown(d.id),'settle-town':()=>settleTown(d.id),'home-town':()=>travelTown(s.homeTownId),'enter-map':()=>enterMap(d.id),'accept-quest':()=>acceptQuest(d.id),'deliver-quest':()=>deliverQuest(d.id),'abandon-map-quest':()=>{const qs=s.quests[d.id];if(qs?.accepted){qs.accepted=false;tell('納品依頼を破棄しました。');render();}},'buy-item':()=>buyItem(d.id),'use-item':()=>{useItem(d.id,Number($('field-target').value));render();},'sell-material':()=>sellMaterial(d.id),'toggle-log-expand':()=>{s.ext??={};s.ext.logExpanded=!s.ext.logExpanded;render();}};
 if(calls[a])calls[a]();
}
function boot(){document.addEventListener('click',handleAction);document.addEventListener('change',e=>{const d=e.target.dataset;if(d.change==='job')return changeJob(Number(d.id),e.target.value);if(['craftMaterial','craftSlot','craftMethod','craftQuality','walkRule'].includes(d.change)){s[d.change]=d.change==='craftQuality'?Number(e.target.value):e.target.value;render();}});document.addEventListener('keydown',e=>{if(['INPUT','SELECT','TEXTAREA','BUTTON'].includes(e.target.tagName)||$('guide').open||$('character-dialog').open)return;const dir={ArrowUp:[0,-1],w:[0,-1],ArrowRight:[1,0],d:[1,0],ArrowDown:[0,1],s:[0,1],ArrowLeft:[-1,0],a:[-1,0]}[e.key];if(dir&&s.dungeon&&!s.battle){e.preventDefault();step(...dir);}});$('help').onclick=()=>{stopAll();render();$('guide').showModal();};$('close-help').onclick=()=>$('guide').close();$('character-close').onclick=()=>$('character-dialog').close();$('reset').onclick=()=>{if(confirm('新版の冒険を初期化しますか？旧版の保存記録は残ります。')){stopAll();s=fresh();notice='新たな冒険を開始した。';render();}};render();}
