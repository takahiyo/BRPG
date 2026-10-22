/* Town services, guild contracts and knowledge earned during expeditions. */
(() => {
  const catalog = typeof CATALOG === 'undefined' ? DATA.catalog || {} : CATALOG;
  const SUPPORT_BOOKS = [
    {id:'expedition',name:'連続探索の手引書',level:1,cost:1800,desc:'右手法の自動歩行と、先頭への通常攻撃による連続探索を身につける。'},
    {id:'instant_return',name:'道標帰還の手引書',level:3,cost:3600,desc:'戦闘外でSP3を使い、探索地から街へ即時帰還する。'},
    {id:'survey_walk',name:'測量踏破の手引書',level:25,cost:5500,desc:'地図上の任意の地点を指定し、最短経路で歩行する測量技術。探索者が不在でも地図クリック歩行が可能になる。'}
  ];
  function state() {
    s.ext ??= {};
    s.ext.facilityRules ??= {known:[],owned:[]};
    s.ext.guildContracts ??= {towns:{},serial:0};
    s.ext.manuals ??= ['B01'];
    s.ext.activeBehaviors ??= ['B01'];
    const r=s.ext.facilityRules;
    for(const id of s.books||[])if(!r.known.includes(id))r.known.push(id);
    return s.ext;
  }
  function jobText(h) { const j=DATA.jobs[h.job]||{},c=catalog.jobs?.[h.job]||{};return [j.name,c.name,c.family,c.role].filter(Boolean).join(' '); }
  function heroCatalogSkills(h) {
    if(!h||h.hp<=0||h.mp<=0)return [];
    const j=DATA.jobs[h.job]||{};
    return (j.catalogSkills||[]).map(sid=>catalog.skills?.[sid]).filter(sk=>sk&&h.lv>=sk.minLv);
  }
  function partyCatalogSkills(kind=null) {
    const seen=new Map();
    for(const h of alive())for(const sk of heroCatalogSkills(h))if((!kind||sk.kind===kind)&&!seen.has(sk.id))seen.set(sk.id,{skill:sk,hero:h});
    return [...seen.values()];
  }
  function specialistBehaviors() {
    const map=new Map();
    for(const {skill,hero} of partyCatalogSkills())for(const bid of skill.behaviors||[])if(!map.has(bid))map.set(bid,{skill,hero});
    return map;
  }
  function behaviorStatus(bid) {
    const b=catalog.behaviors?.[bid],e=state();
    if(!b)return {discovered:false,usable:false,byManual:false,bySpecialist:false,reason:'未発見'};
    if(bid==='B01')return {discovered:true,usable:true,byManual:true,bySpecialist:false,reason:'基本行動'};
    const spec=specialistBehaviors().get(bid),hasManual=(e.manuals||[]).includes(bid),lvOk=partyLevel()>=(b.reqPartyLv||1);
    const byManual=hasManual&&lvOk,bySpecialist=!!spec,discovered=hasManual||bySpecialist,usable=byManual||bySpecialist;
    const reason=bySpecialist?`専門職（${spec.hero.name}：${spec.skill.name}）`:byManual?'手引書習得済':hasManual?`要平均Lv.${b.reqPartyLv}`:'手引書未入手';
    return {discovered,usable,byManual,bySpecialist,specialist:spec,reason};
  }
  function behaviorActive(bid) {
    if(bid==='B01')return true;
    const e=state();
    return (e.activeBehaviors||[]).includes(bid)&&behaviorStatus(bid).usable;
  }
  function explorers() { return alive().filter(h=>h.job==='explorer'||/探索者|探検家|冒険家|案内人|道案内|地図師/.test(jobText(h))||heroCatalogSkills(h).some(sk=>(sk.behaviors||[]).some(b=>['B03','B04','B07','B09'].includes(b)))); }
  function tacticians() { return alive().filter(h=>['tactician','strategist','scholar'].includes(h.job)||/軍師|参謀|戦術|指揮|司令|学者/.test(jobText(h))||heroCatalogSkills(h).some(sk=>['SK0079','SK0080','SK0085'].includes(sk.id))); }
  function observers() { return alive().filter(h=>['explorer','hunter','strategist','tactician'].includes(h.job)||/探索者|斥候|狩人|軍師|学者|観測|鑑定|魔物学|生態/.test(jobText(h))||heroCatalogSkills(h).some(sk=>['SK0013','SK0049','SK0079','SK0085','SK0086'].includes(sk.id))); }
  function supportRoleCount() {
    let n=0;
    if(explorers().length>0)n++;
    if(tacticians().length>0)n++;
    if(alive().some(h=>['hunter','scout','ranger','trapper'].includes(h.job)||/斥候|罠|野営/.test(jobText(h))||heroCatalogSkills(h).some(sk=>['SK0007','SK0008','SK0010'].includes(sk.id))))n++;
    if(alive().some(h=>DATA.jobs[h.job]?.craftSpecialist||['alchemist','runesmith','merchant'].includes(h.job)||/職人|鍛冶|錬金|商人|荷運び/.test(jobText(h))))n++;
    return n;
  }
  const previousAutoPlans=autoPlans;
  autoPlans=function() {
    previousAutoPlans();
    const b=s.battle;if(!b||!tacticians().length)return;
    const wounded=alive().slice().sort((a,c)=>a.hp/stats(a).hp-c.hp/stats(c).hp),low=wounded[0],poisoned=alive().find(h=>h.poison>0);
    let supportUsed=Object.values(b.plans).some(p=>p.command!=='attack');
    for(const h of alive()){
      const p=b.plans[h.id];if(p&&p.command!=='attack')continue;
      const available=heroSkills(h).filter(k=>k.level<=h.lv&&k.mp<=h.mp&&(k.sp||0)<=h.sp);
      if(!supportUsed&&low&&low.hp/stats(low).hp<.45){
        const heal=available.find(k=>k.kind==='heal');
        if(heal){b.plans[h.id]={command:'skill',skill:heal.id,target:low.id};supportUsed=true;continue;}
        if(s.items.potion>0){b.plans[h.id]={command:'item',item:'potion',target:low.id};supportUsed=true;continue;}
      }
      if(!supportUsed&&poisoned){
        const cl=available.find(k=>k.kind==='cleanse');
        if(cl){b.plans[h.id]={command:'skill',skill:cl.id,target:poisoned.id};supportUsed=true;continue;}
        if(s.items.antidote>0){b.plans[h.id]={command:'item',item:'antidote',target:poisoned.id};supportUsed=true;continue;}
      }
      const w=item(h.weapon),el=w?.enchant?DATA.enchants[w.enchant]?.element:'physical',weakFoe=enemyAlive().find(e=>knowledge(e.id).tier>=2&&e.weak===el);
      if(weakFoe)b.plans[h.id]={command:'attack',target:weakFoe.key};
      const wkSkill=available.find(k=>['damage','attack','poison','drain'].includes(k.kind)&&enemyAlive().some(e=>knowledge(e.id).tier>=2&&e.weak===k.element));
      if(wkSkill){const tFoe=enemyAlive().find(e=>knowledge(e.id).tier>=2&&e.weak===wkSkill.element);if(tFoe)b.plans[h.id]={command:'skill',skill:wkSkill.id,target:tFoe.key};}
    }
  };
  function bookKnown(id) { return state().facilityRules.known.includes(id); }
  function supportOwned(id) { return state().facilityRules.owned.includes(id)&&partyLevel()>=(SUPPORT_BOOKS.find(b=>b.id===id)?.level||1); }
  function canAutomate() { return explorers().length>0||supportOwned('expedition'); }
  function canClickWalk() { return explorers().length>0||supportOwned('survey_walk'); }
  function returnUser() { const candidates=explorers().length?explorers():supportOwned('instant_return')?alive():[];return candidates.find(h=>(h.sp??maxSP(h))>=3); }
  function bookPrice(b) { return Math.ceil(Math.max(1200,b.cost*5)*currentTown().price); }
  function discoverRule(level, guaranteed=false) {
    if(!guaranteed&&random()>=.18)return;
    const all=[...SUPPORT_BOOKS,...DATA.rules].filter(b=>b.level<=level+5&&!bookKnown(b.id)&&!s.books.includes(b.id)&&!state().facilityRules.owned.includes(b.id));
    if(!all.length)return;
    const b=pick(all);state().facilityRules.known.push(b.id);
    note('📘 行動書の情報を発見：'+b.name+'。街の行動書庫で購入できる。');
  }
  const previousBuyFactor=buyFactor,previousSellFactor=sellFactor;
  buyFactor=function() {
    let f=previousBuyFactor();
    if(partyCatalogSkills('交易').length||alive().some(h=>/商人|役人|芸人/.test(jobText(h))))f*=.94;
    return Math.max(.7,f);
  };
  sellFactor=function() {
    let f=previousSellFactor();
    if(partyCatalogSkills('交易').length||alive().some(h=>/商人|役人/.test(jobText(h))))f*=1.12;
    return Math.min(1.65,f);
  };
  const previousSupplyPrice=supplyPrice;
  supplyPrice=function(id){
    const price=previousSupplyPrice(id);
    return DATA.items[id]?.kind==='revive'?Math.max(Math.ceil(300*currentTown().price),price*5):price;
  };
  buyBook=function(id) {
    if(!townOnly())return;
    const b=[...SUPPORT_BOOKS,...DATA.rules].find(x=>x.id===id);
    if(!b||!bookKnown(id))return;
    const owned=SUPPORT_BOOKS.includes(b)?state().facilityRules.owned:s.books;
    if(owned.includes(id))return;
    const cost=bookPrice(b);
    if(partyLevel()<b.level||s.gold<cost){tell('平均Lv.'+b.level+'と '+cost+' Gが必要です。');return render();}
    s.gold-=cost;owned.push(id);tell(b.name+'を購入し、学んだ。');render();
  };

  function creditLimit() {
    const revEach=Math.ceil((20+partyLevel()*5)*currentTown().price);
    return innCost()*3+party().length*revEach;
  }
  globalThis.innScreen=function() {
    const cost=innCost(),limit=creditLimit();
    return title('TRAVELERS INN','旅人の宿',esc(currentTown().name)+'で、次の旅に備えて休む。')+strip()+
      `<section class="panel section-space"><h2>一夜の休息</h2><p>生存している参加メンバーのLIFE・MANA・SPを全回復します。死亡や毒は神殿で治療できます。</p><div class="actions">${btn('宿泊する / '+cost+' G','rest',s.gold<cost?'disabled':'','primary')}${s.gold<cost?btn('宿代の立替を頼む / '+cost+' G','rest-credit'):''}</div><p class="muted">宿泊立替 ${s.debt||0} / ${limit} G。上限の範囲で利用でき、収入の30%から返済します。</p></section>`;
  };
  rest=function(credit=false) {
    if(!townOnly())return;
    if(!party().some(h=>h.hp>0)){tell('亡くなった仲間は神殿で蘇生できます。');return render();}
    const cost=innCost();
    if(s.gold<cost){
      if(!credit){tell('宿泊料 '+cost+' Gが必要です。');return render();}
      const gap=cost-s.gold,limit=creditLimit();
      if(s.debt+gap>limit){tell('宿泊立替の上限です。依頼や素材売却で返済できます。');return render();}
      s.debt+=gap;s.gold=0;
    }else s.gold-=cost;
    const cal=getCalendar();
    const advanceM = cal.hour < 8 ? (8 - cal.hour) * 60 - cal.minute : (24 - cal.hour + 8) * 60 - cal.minute;
    advanceTime(Math.max(480, advanceM), '宿泊');
    for(const h of party().filter(h=>h.hp>0)){h.hp=stats(h).hp;h.mp=stats(h).mp;h.sp=maxSP(h);}
    tell('宿泊料 '+cost+' Gで休息した。死亡・毒は神殿で治療できます。');render();
  };
  function merchantGear() {
    const e=state(),town=currentTown(),materials=Object.keys(DATA.materials).filter(id=>['wood','stone','hide'].includes(id)||((e.identifiedMaterials||[]).includes(id)&&(e.discoveredMaterials||[]).includes(id)&&DATA.materials[id].rank<=town.quality+1&&DATA.materials[id].craftable!==false)).slice(0,6);
    const designs=[['club','weapon',1],['sword','weapon',1],['greatsword','weapon',2],['bow','weapon',2],['staff','weapon',2],['shield','shield',1],['helmet','head',1],['body','armor',1],['gloves','arms',1],['boots','feet',1],['ring','accessory',1]];
    return materials.flatMap(material=>designs.map(([type,equipSlot,hands])=>({key:material+':'+type,material,slot:equipSlot==='weapon'?'weapon':'armor',type,equipSlot,hands,method:'physical',quality:Math.min(13,town.quality),dur:45,maxDur:75,enchant:null})));
  }
  function gearBuyPrice(g) { return Math.ceil((40+(DATA.materials[g.material]?.cost||10)*8)*qualityFactor(g.quality)*currentTown().price); }
  function gearSellPrice(g) { return Math.max(1,Math.floor(((DATA.materials[g.material]?.cost||10)*2+(g.quality||1)*5)*(g.dur/g.maxDur)*sellFactor())); }
  function buyGear(key) {
    if(!townOnly())return;const g=merchantGear().find(x=>x.key===key);if(!g)return;
    const cost=gearBuyPrice(g);if(s.gold<cost)return;
    s.gold-=cost;const gear={...g,id:s.nextGear++};delete gear.key;
    if(globalThis.BRPGEquipment)BRPGEquipment.receive(gear);else s.gear.push(gear);
    tell(gearName(gear)+'を '+cost+' Gで購入した。'+(gear.ownerId?s.roster.find(h=>h.id===gear.ownerId)?.name+'の持ち物へ。':'街の保管庫へ。'));render();
  }
  function sellGear(id) {
    if(!townOnly())return;const g=item(id);if(!g||s.roster.some(h=>HERO_SLOTS.some(slot=>h[slot]===id)))return;
    const price=gearSellPrice(g);s.gear=s.gear.filter(x=>x.id!==id);earnGold(price);tell(gearName(g)+'を '+price+' Gで売却した。');render();
  }
  function sellUnusedCommonGear() {
    if(!townOnly())return;
    const targets=s.gear.filter(g=>g.ownerId==null&&!s.roster.some(h=>HERO_SLOTS.some(slot=>h[slot]===g.id))&&(!g.rarity||g.rarity==='common')&&!g.enchant);
    if(!targets.length)return;
    const total=targets.reduce((sum,g)=>sum+gearSellPrice(g),0),ids=new Set(targets.map(g=>g.id));
    s.gear=s.gear.filter(g=>!ids.has(g.id));earnGold(total);
    tell(`保管庫の通常装備 ${targets.length}点を一括売却し、${total} Gを得た。`);render();
  }
  const SHOP_BUY_CATEGORIES = { tools: '道具', weapon: '武器', shield: '盾', head: '頭防具', armor: '胴防具', arms: '腕防具', feet: '脚防具', accessory: '装飾品' };
  let shopSelection = null;
  function shopSelectionState() {
    if (shopSelection?.owner !== s) shopSelection = { owner: s, tab: 'buy', category: 'tools' };
    return shopSelection;
  }
  globalThis.shopScreen=function() {
    const selection=shopSelectionState(),maxLv=Math.max(partyLevel()+5,currentTown().level+5),shopItems=Object.entries(DATA.items).filter(([id,it])=>(it.level||1)<=maxLv||uiCount(id)>0),heldMaterials=Object.entries(DATA.materials).filter(([id])=>s.materials[id]>0);
    const sortedGear=[...s.gear].sort((a,b)=>{const ea=s.roster.some(h=>HERO_SLOTS.some(slot=>h[slot]===a.id))?1:0,eb=s.roster.some(h=>HERO_SLOTS.some(slot=>h[slot]===b.id))?1:0;return ea-eb||gearValue(b)-gearValue(a)||b.id-a.id;});
    const bulkTargets=s.gear.filter(g=>g.ownerId==null&&!s.roster.some(h=>HERO_SLOTS.some(slot=>h[slot]===g.id))&&(!g.rarity||g.rarity==='common')&&!g.enchant);
    const bulkGold=bulkTargets.reduce((sum,g)=>sum+gearSellPrice(g),0),stock=merchantGear().filter(g=>g.equipSlot===selection.category);
    const categories=`<div class="actions" aria-label="購入品の分類">${Object.entries(SHOP_BUY_CATEGORIES).map(([id,label])=>btn(label,'shop-category',`data-id="${id}" aria-pressed="${selection.category===id}"`,selection.category===id?'selected':'')).join('')}</div>`;
    const buyContent=selection.category==='tools'?`<div class="shop-list">${shopItems.map(([id,it])=>{const price=supplyPrice(id);return `<article><div class="row between"><h3>${esc(it.name)}</h3><span class="chip">所持 ${uiCount(id)}</span></div><p>${esc(it.desc)}</p>${btn('1個購入 / '+price+' G','buy-item',`data-id="${id}" ${s.gold<price?'disabled':''}`)}</article>`;}).join('')}</div>`:
      `<p class="muted">購入品は空きのある仲間の持ち物へ、満杯なら街の保管庫へ送られます。職業との適性は持ち物画面で確認できます。</p><div class="grid three">${stock.map(g=>`<article class="card"><h3 class="gear-name" title="${esc(gearName(g))}">${esc(gearName(g))}</h3><p>${g.slot==='weapon'?'攻':'防'}+${gearValue(g)} / ${esc(gearRequirementText(g))} / 耐久 ${g.dur}/${g.maxDur}</p>${btn('購入 / '+gearBuyPrice(g)+' G','merchant-buy-gear',`data-id="${g.key}" ${s.gold<gearBuyPrice(g)?'disabled':''}`)}</article>`).join('')||'<p class="empty">この分類の在庫はありません。</p>'}</div>`;
    return title('TRAVEL PROVISIONS','道具屋',esc(currentTown().name)+'の旅道具と掘出し物。')+
      `<div class="actions" role="tablist" aria-label="商店の取引">${[['buy','購入'],['sell','売却']].map(([id,label])=>btn(label,'shop-tab',`data-id="${id}" id="shop-tab-${id}" role="tab" aria-controls="shop-panel-${id}" aria-selected="${selection.tab===id}"`,selection.tab===id?'selected':'')).join('')}</div>`+
      `<section class="panel section-space" id="shop-panel-buy" role="tabpanel" aria-labelledby="shop-tab-buy" ${selection.tab==='buy'?'':'hidden'}><h2>購入 · ${SHOP_BUY_CATEGORIES[selection.category]}</h2>${categories}${buyContent}</section>`+
      `<section class="panel section-space" id="shop-panel-sell" role="tabpanel" aria-labelledby="shop-tab-sell" ${selection.tab==='sell'?'':'hidden'}><h2>素材を売る</h2><div class="grid three">${heldMaterials.map(([id])=>`<article class="card"><h3>${esc(apparentMaterialName(id))} ×${s.materials[id]}</h3>${uiSale(id)}</article>`).join('')||'<p class="empty">売却できる素材がありません。</p>'}</div><div class="row between section-space"><h2>装備を売る <small>所持 ${s.gear.length}個</small></h2>${bulkTargets.length?btn(`保管庫の通常品をまとめて売る（${bulkTargets.length}点 / +${bulkGold} G）`,'merchant-sell-bulk-gear'):''}</div><p class="muted">未装備の品を優先表示。一括売却は保管庫の通常品のみです。装備中の品は持ち物画面で外してから売却できます。</p><div class="grid three">${sortedGear.map(g=>{const owner=s.roster.find(h=>HERO_SLOTS.some(slot=>h[slot]===g.id)),equipped=!!owner;return `<article class="card rarity-${g.rarity||'common'}"><h3 class="gear-name" title="${esc(gearName(g))}">${esc(gearName(g))}</h3><p>${g.slot==='weapon'?'攻':'防'}+${gearValue(g)}${g.enchant?' · 付呪+'+enchantPower(g):''} / 耐久 ${g.dur}/${g.maxDur}</p>${btn(equipped?`${esc(owner.name)}が装備中`:'売却 / '+gearSellPrice(g)+' G','merchant-sell-gear',`data-id="${g.id}" ${equipped?'disabled':''}`)}</article>`;}).join('')||'<p class="empty">売却できる装備がありません。</p>'}</div></section>`;
  };
  suppliesScreen=function(){return shopScreen();};
  function templeFee(h,kind) { return Math.ceil((kind==='revive'?20+h.lv*5:10+h.lv*2)*currentTown().price); }
  function templeTreat(id,kind,credit=false) {
    if(!townOnly())return;
    const h=s.roster.find(a=>a.id===id);if(!h)return;
    if(kind==='revive'?h.hp>0:!(h.hp>0&&(h.poison>0||h.mp===0)))return;
    const cost=templeFee(h,kind);
    if(s.gold<cost){
      const gap=cost-s.gold,limit=creditLimit();
      const emergency=party().includes(h)&&!alive().length&&(kind==='revive'||h.mp===0);
      if(!credit||(!emergency&&s.debt+gap>limit)){tell('治療には '+cost+' Gが必要です。立替には上限があります。');return render();}
      s.debt+=gap;s.gold=0;
    }else s.gold-=cost;
    if(kind==='revive'){h.hp=Math.max(1,Math.ceil(stats(h).hp*.35));h.mp=Math.max(1,Math.ceil(stats(h).mp*.35));h.sp=Math.max(1,Math.ceil(maxSP(h)*.35));}
    else h.mp=Math.max(1,h.mp);
    h.poison=0;tell(h.name+'の'+(kind==='revive'?'蘇生':'解毒・覚醒')+'を行った。'+cost+' G。');render();
  }
  globalThis.templeScreen=function() {
    const limit=creditLimit();
    return title('TEMPLE OF THE LAMP','灯火の神殿','蘇生と毒の治療、気絶した仲間の覚醒を行う。')+
      `<p class="muted">治療費が不足するときは、宿と共通の上限（${s.debt||0} / ${limit} G）内で立替を頼めます。全滅時は最低1人の復帰が保証され、収入の30%から返済します。</p><div class="grid three">${s.roster.map(h=>{const kind=h.hp<=0?'revive':'cleanse',needed=h.hp<=0||h.poison>0||h.mp===0,cost=templeFee(h,kind);return `<article class="card"><h2>${esc(h.name)}</h2>${bars(h)}<p>${h.hp<=0?'蘇生後はLIFE・MANA・SPが35%回復します。':h.poison>0||h.mp===0?'解毒し、気絶から目覚めさせます。':'治療の必要はありません。'}</p>${btn((kind==='revive'?'蘇生':'解毒・覚醒')+' / '+cost+' G','temple-treat',`data-id="${h.id}" data-kind="${kind}" ${!needed||s.gold<cost?'disabled':''}`,'primary')}${needed&&s.gold<cost?btn('治療費の立替を頼む','temple-treat',`data-id="${h.id}" data-kind="${kind}" data-credit="yes"`):''}</article>`;}).join('')}</div>`;
  };
  townScreen=function() {
    const t=currentTown();
    const facilities=[
      ['atlas','🗺 探索地図','依頼なしでも自由に潜れる。周辺の地理・道標調査。'],
      ['guild','◇ 冒険者ギルド','受託枠1件の依頼掲示板。好条件納品や緊急討伐。'],
      ['tavern','♜ 酒場','新しい仲間の募集とパーティー編成。'],
      ['inn','☽ 旅人の宿','生存している仲間の休息と回復。'],
      ['shop','▣ 道具屋','旅道具の補充と掘出し物。'],
      ['temple','✧ 神殿','蘇生、毒の治療、気絶からの覚醒。'],
      ['forge','⚒ 工房','工房への依頼、自作、修理、付呪。'],
      ['rules','▤ 行動書庫','発見した行動書を購入し、判断を学ぶ。'],
      ['party','♙ 仲間','能力・職業・装備と習得技を確認。'],
      ['catalog','◈ 冒険手帳','素材、魔物、加工法と旅の記録。']
    ];
    return `<section class="town-hero">${title('A LIGHT IN THE WILDERNESS',esc(t.name),'旅の準備を整え、地図から探索へ挑むか、ギルドの依頼を選ぼう。')}<div class="town-facts"><span class="chip">街 Lv.${t.level}</span><span class="chip">施設品質 Q${t.quality}</span><span class="chip">物価 ×${t.price}</span>${s.debt?`<span class="chip">宿泊立替 ${s.debt} G</span>`:''}</div><div class="actions">${btn('地図から探索へ →','view','data-view="atlas"','primary')}${btn('ギルドの依頼','view','data-view="guild"')}${btn('宿と道具','view','data-view="supplies"')}</div></section><div class="sectionhead"><h2>今日のパーティー</h2><span class="muted">${party().length}/6人 · 平均Lv.${partyLevel()}</span></div>${strip()}<div class="grid three town-facilities section-space">${facilities.map(([id,name,desc])=>`<button class="panel facility" data-action="view" data-view="${id}"><b>${name}</b><small>${desc}</small></button>`).join('')}</div>${s.homeTownId!==t.id?btn('拠点へ戻る','home-town'):''}`;
  };

  function townById(id) {
    if (!id || id === 'ash') return (s.towns || []).find(t => t.id === 'ash') || { id: 'ash', name: '灰の街アッシュ', level: 1, quality: 1, price: 1 };
    return (s.towns || []).find(t => t.id === id) || (s.townId === id ? currentTown() : { id, name: id, level: 1, quality: 1, price: 1 });
  }

  function knownMaps(targetTownId = s.townId) {
    const e = state(), t = townById(targetTownId), max = Math.max(partyLevel(), ...s.roster.map(h => h.lv), t.level || 1);
    if (targetTownId !== 'ash') return (s.addressMaps || []).filter(m => m.townId === targetTownId);
    return DATA.maps.filter((m, i) => i < 2 || m.level <= max + 12 || (e.visitedMaps || []).includes(m.id) || s.quests[m.id]?.accepted || s.quests[m.id]?.completed);
  }

  function currentRealDateStr() {
    try {
      const d = new Date();
      return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    } catch {
      return '2026-10-20';
    }
  }
  function getCalendar() {
    s.calendar ??= { day: 1, hour: 8, minute: 0, lastRealDate: currentRealDateStr() };
    if (!s.calendar.lastRealDate) s.calendar.lastRealDate = currentRealDateStr();
    return s.calendar;
  }
  function formatCalendar(cal = getCalendar()) {
    const h = String(cal.hour).padStart(2, '0');
    const m = String(cal.minute).padStart(2, '0');
    return `冒険 ${cal.day}日目 ${h}:${m}`;
  }
  function advanceTime(minutes, reason = '') {
    const cal = getCalendar();
    cal.minute += minutes;
    if (cal.minute >= 60) {
      cal.hour += Math.floor(cal.minute / 60);
      cal.minute %= 60;
    }
    if (cal.hour >= 24) {
      cal.day += Math.floor(cal.hour / 24);
      cal.hour %= 24;
    }
    checkContractDeadlines();
  }
  function checkRealMidnight() {
    const cal = getCalendar();
    const today = currentRealDateStr();
    if (cal.lastRealDate && cal.lastRealDate !== today) {
      let daysPassed = 0;
      try {
        const prev = new Date(cal.lastRealDate).getTime();
        const curr = new Date(today).getTime();
        const diff = Math.floor((curr - prev) / (1000 * 60 * 60 * 24));
        if (diff > 0) daysPassed = diff;
      } catch {}
      if (daysPassed <= 0) return;
      cal.day += daysPassed;
      cal.hour = 8;
      cal.minute = 0;
      cal.lastRealDate = today;
      note(`🌅 現実の日付が変わり（0時通過）、街の時間が進みました。（冒険 ${cal.day}日目 朝）`);
      checkContractDeadlines();
    }
  }
  function getActiveQuest() {
    const all = state().guildContracts;
    for (const [townId, board] of Object.entries(all.towns || {})) {
      for (const [id, p] of Object.entries(board.progress || {})) {
        if (p?.status === 'accepted' || p?.status === 'ready') {
          const q = (board.offers || []).find(x => x.id === id) || permanentContracts(townId).find(x => x.id === id) || { id, name: 'ギルド依頼' };
          return { source: 'contract', townId, id, name: q.name, q };
        }
      }
    }
    for (const [mapId, qState] of Object.entries(s.quests || {})) {
      if (qState?.accepted && !qState.completed) {
        const m = worldMap(mapId);
        return { source: 'mapQuest', mapId, id: mapId, name: m?.quest?.name || `${m?.name || mapId}の納品依頼`, q: m?.quest };
      }
    }
    return null;
  }
  globalThis.getActiveQuest = getActiveQuest;
  function checkContractDeadlines() {
    const cal = getCalendar();
    const all = state().guildContracts;
    for (const [townId, board] of Object.entries(all.towns || {})) {
      const remainingOffers = [];
      for (const q of board.offers || []) {
        const p = board.progress[q.id];
        // 討伐済みなら達成期限後も報告・報酬受領を保証する。
        if (p?.status === 'ready') { remainingOffers.push(q); continue; }
        const isSpecial = q.kind === 'emergency' || q.kind === 'lucrative';
        if (!isSpecial) { remainingOffers.push(q); continue; }
        const hasDue = q.dueDay !== undefined;
        const isExpired = hasDue && (cal.day > q.dueDay || (cal.day === q.dueDay && cal.hour >= (q.dueHour ?? 18)));
        if (isExpired) {
          if (p?.status === 'accepted') {
            const penalty = q.penalty || Math.ceil(q.reward * 0.35);
            s.gold -= penalty;
            if (s.gold < 0) {
              s.debt = (s.debt || 0) + (-s.gold);
              s.gold = 0;
            }
            tell(`🚨【依頼期限切れ】依頼『${q.name}』は達成期限を過ぎたため失敗扱いとなりました。違約金（罰金）として ${penalty} G が徴収されました。`);
            delete board.progress[q.id];
          }
        } else {
          remainingOffers.push(q);
        }
      }
      board.offers = remainingOffers;
    }
  }
  function ensureSpecialOffers(townId = s.townId) {
    const board = townBoard();
    checkRealMidnight();
    checkContractDeadlines();
    const activeSpecial = (board.offers || []).filter(q => q.kind === 'lucrative' || q.kind === 'emergency');
    if (activeSpecial.length >= 3) return;
    const maps = knownMaps();
    if (!maps.length) return;
    const cal = getCalendar();
    while ((board.offers || []).filter(q => q.kind === 'lucrative' || q.kind === 'emergency').length < 3) {
      const m = pick(maps);
      if (!m) break;
      const quality = m.quality || Math.min(13, 1 + Math.floor(m.level / 25));
      const isEmerg = random() < 0.35;
      if (isEmerg) {
        const level = Math.min(300, Math.max(m.level + 6, partyLevel() + 6));
        const id = 'emergency:' + (++state().guildContracts.serial);
        const reward = Math.ceil((1200 + level * level * 22) * currentTown().price);
        const dueDays = 3 + Math.floor(random() * 3);
        board.offers.push({
          id,
          kind: 'emergency',
          name: '緊急：' + m.name + 'の強襲個体討伐',
          mapId: m.id,
          level,
          reward,
          expires: board.returns + 5,
          dueDay: cal.day + dueDays,
          dueHour: 18,
          penalty: Math.ceil(reward * 0.3)
        });
      } else {
        const material = pick(m.materials) || 'iron';
        const amount = 4 + Math.floor(random() * 5);
        const value = DATA.materials[material]?.cost || 10;
        const id = 'lucrative:' + (++state().guildContracts.serial);
        const reward = Math.ceil(value * amount * quality * 3.6);
        const dueDays = 4 + Math.floor(random() * 4);
        board.offers.push({
          id,
          kind: 'lucrative',
          name: '好条件：' + apparentMaterialName(material) + 'の特注納品',
          material,
          amount,
          quality,
          mapId: m.id,
          reward,
          expires: board.returns + 6,
          dueDay: cal.day + dueDays,
          dueHour: 18,
          penalty: Math.ceil(reward * 0.35)
        });
      }
    }
  }
  function abandonContract(id) {
    if (!townOnly()) return;
    const active = getActiveQuest();
    let board = townBoard(), qTownId = s.townId;
    if (active && active.id === id && active.townId) {
      qTownId = active.townId;
      board = state().guildContracts.towns?.[qTownId] || townBoard();
    }
    const p = board.progress[id];
    if (p?.status !== 'accepted') return;
    const q = (board.offers || []).find(x => x.id === id) || permanentContracts(qTownId).find(x => x.id === id) || (active?.id === id ? active.q : null);
    if (!q) return;
    if (q.kind === 'lucrative' || q.kind === 'emergency') {
      const penalty = q.penalty || Math.ceil(q.reward * 0.35);
      s.gold -= penalty;
      if (s.gold < 0) {
        s.debt = (s.debt || 0) + (-s.gold);
        s.gold = 0;
      }
      delete board.progress[id];
      board.offers = board.offers.filter(x => x.id !== id);
      tell(`依頼『${q.name}』を破棄しました。違約金として ${penalty} G を支払いました。`);
    } else {
      delete board.progress[id];
      tell(`依頼『${q.name}』を破棄しました。`);
    }
    render();
  }

  function townBoard(targetTownId = s.townId) {
    const all = state().guildContracts;
    return all.towns[targetTownId] ??= { offers: [], progress: {}, returns: 0 };
  }
  function permanentContracts(targetTownId = s.townId) {
    const seen = new Set(), list = [];
    for (const m of knownMaps(targetTownId)) for (const material of m.materials || []) {
      if (seen.has(material)) continue; seen.add(material);
      const quality = m.quality || Math.min(13, 1 + Math.floor(m.level / 25));
      for (const [size, label, mult] of [[3, '小口', 1.35], [8, 'まとめ', 1.6]]) {
        const value = DATA.materials[material]?.cost || 10;
        list.push({ id: 'supply:' + material + ':' + size, kind: 'resource', name: label + '資源調達：' + apparentMaterialName(material), material, amount: size, quality, mapId: m.id, reward: Math.ceil(value * size * mult * quality), repeat: true });
      }
    }
    return list;
  }
  function contracts(targetTownId = s.townId) {
    if (targetTownId === s.townId) ensureSpecialOffers();
    const all = state().guildContracts;
    const board = all.towns[targetTownId] ??= { offers: [], progress: {}, returns: 0 };
    return [...board.offers, ...permanentContracts(targetTownId)];
  }
  function rollSpecialOffers() {
    const board=townBoard();board.returns++;
    board.offers=board.offers.filter(q=>board.progress[q.id]?.status==='accepted'||board.progress[q.id]?.status==='ready'||board.returns<q.expires);
    if(board.offers.length>=4)return;
    const maps=knownMaps(),m=pick(maps);if(!m)return;
    const quality=m.quality||Math.min(13,1+Math.floor(m.level/25));
    if(random()<.25){
      const material=pick(m.materials),amount=5+Math.floor(random()*4),value=DATA.materials[material]?.cost||10;
      const id='lucrative:'+(++state().guildContracts.serial);
      board.offers.push({id,kind:'lucrative',name:'好条件：商隊の急な仕入れ',material,amount,quality,mapId:m.id,reward:Math.ceil(value*amount*quality*3.6),expires:board.returns+4});
      note('◇ ギルドに好条件の仕入れ依頼が届いた。');
    }
    if(random()<.04){
      const level=Math.min(300,Math.max(m.level+8,partyLevel()+8)),id='emergency:'+(++state().guildContracts.serial);
      board.offers.push({id,kind:'emergency',name:'緊急：街道を脅かす強襲個体',mapId:m.id,level,reward:Math.ceil((1200+level*level*22)*currentTown().price),expires:board.returns+3});
      note('⚠ ギルドに高難度の緊急討伐依頼が届いた。');
    }
  }
  function acceptContract(id) {
    if(!townOnly())return;
    const q=contracts().find(x=>x.id===id);if(!q)return;
    const active = getActiveQuest();
    if (active) {
      tell(`受注できる依頼はパーティー全体で1件のみです。現在の依頼『${active.name}』を達成するか破棄してください。`);
      return render();
    }
    const board=townBoard(),p=board.progress[id];
    if(p?.status==='accepted'||p?.status==='ready'||!q.repeat&&p?.status==='completed')return;
    board.progress[id]={status:'accepted',times:p?.times||0};tell(q.name+'を受注した。');render();
  }

  const prevAcceptQuest = acceptQuest;
  acceptQuest = function(id) {
    if(!townOnly())return;
    const active = getActiveQuest();
    if (active) {
      tell(`受注できる依頼はパーティー全体で1件のみです。現在の依頼『${active.name}』を達成するか破棄してください。`);
      return render();
    }
    return prevAcceptQuest(id);
  };

  function deliverContract(id) {
    if(!townOnly())return;
    const board = townBoard(), p = board.progress[id]; if (!p) return;
    const q = contracts().find(x => x.id === id); if (!q) return;
    if(q.kind==='emergency'){if(p.status!=='ready')return;}
    else {if(p.status!=='accepted'||!consumeMaterial(q.material,q.amount,q.quality))return;}
    p.status='completed';p.times++;earnGold(q.reward);tell(q.name+'を達成。報酬 '+q.reward+' G。'+(q.repeat?'再受注できます。':''));render();
  }
  function challengeContract(id) {
    if(!townOnly())return;
    const q=contracts().find(x=>x.id===id),p=townBoard().progress[id];if(q?.kind!=='emergency'||p?.status!=='accepted'||!alive().length)return;
    const townId=s.townId;enterMap(q.mapId);if(!s.dungeon)return;
    s.dungeon.level=q.level;s.dungeon.facilityContract={townId,id};encounter(true);
    if(!s.battle)return;
    s.battle.facilityContract={townId,id};
    for(const foe of s.battle.enemies){foe.name='強襲個体・'+foe.name;foe.hp=Math.round(foe.hp*1.7);foe.maxhp=foe.hp;foe.atk=Math.round(foe.atk*1.35);foe.mag=Math.round(foe.mag*1.3);}
    tell('緊急討伐：'+q.name+'。撤退した場合は、再挑戦できます。');render();
  }
  function candidateMapsForContract(q) {
    if (!q) return [];
    const maps = knownMaps();
    const result = [];
    if (q.mapId) {
      const primary = worldMap(q.mapId);
      if (primary) result.push(primary);
    }
    if (q.material) {
      for (const m of maps) {
        if (!result.some(r => r.id === m.id) && (m.materials || []).includes(q.material)) {
          result.push(m);
        }
      }
    }
    return result.length ? result : (q.mapId ? [worldMap(q.mapId)].filter(Boolean) : maps.slice(0, 1));
  }
  function contractHTML(q) {
    const p=townBoard().progress[q.id]||{},emergency=q.kind==='emergency',isSpecial=emergency||q.kind==='lucrative',amount=emergency?0:availableMaterial(q.material,q.quality),accepted=p.status==='accepted',ready=emergency?p.status==='ready':accepted&&amount>=q.amount,done=p.status==='completed';
    const cal=getCalendar(),active=getActiveQuest(),canSupply=!emergency&&amount>=q.amount&&(!done||q.repeat),canReport=ready;
    let dueText='';
    if(isSpecial&&q.dueDay!==undefined){
      const totalCurH=cal.day*24+cal.hour,totalDueH=q.dueDay*24+(q.dueHour??18),diffH=totalDueH-totalCurH;
      const remD=Math.max(0,Math.floor(diffH/24)),remH=Math.max(0,diffH%24);
      dueText=`<p class="muted" style="margin:2px 0 4px">⏱️ 達成期限：冒険 ${q.dueDay}日目 ${q.dueHour??18}:00（残り ${remD}日 ${remH}時間）<br><span class="debt-note">期限切れ失敗時 違約金：${q.penalty||Math.ceil(q.reward*0.35)} G</span></p>`;
    }
    const cannotAccept=!accepted&&!ready&&active;
    const targetMaps = accepted && !emergency ? candidateMapsForContract(q) : [];
    return `<article class="card ${q.kind==='resource'?'':emergency?'rarity-legendary':'rarity-magic'}" style="${accepted?'border-color:var(--gold)!important;box-shadow:0 0 10px #d7b77a33':''}">
      <div class="row between"><h3>${esc(q.name)}</h3><span class="chip ${accepted?'gold':''}">${accepted?'📌 受託中':emergency?'高難度・緊急討伐':isSpecial?'特別・好条件納品':'常設・資源調達'}</span></div>
      ${canReport?'<p class="chip gold">✅ 今すぐ報告可能</p>':canSupply?`<p class="chip gold">📦 素材が揃っています · ${active?'受託枠が空けば即納品可能':'受注後すぐ納品可能'}</p>`:''}
      <p>${emergency?'強襲個体を討伐 / 脅威度 Lv.'+q.level:esc(apparentMaterialName(q.material))+' Q'+q.quality+'以上 ×'+q.amount+' / 所持 '+amount}</p>
      <p class="gold">報酬 ${q.reward} G</p>
      ${dueText}
      <p class="muted">${esc(worldMap(q.mapId)?.name||'探索地域')} · ${done?'達成済み '+p.times+'回':ready?'報告可能':accepted?'受託中（進行中）':'未受託'}</p>
      ${accepted ? `<div class="quest-depart-box" style="margin:6px 0;padding:8px 10px;background:#152218;border:1px solid #3d4f3b;border-radius:4px">
        <small class="gold" style="display:block;margin-bottom:4px"><b>⚔ 探索先ダンジョンを選択：</b></small>
        <div class="actions" style="margin-top:0">
          ${emergency ?
            btn('討伐へ出発（' + esc(worldMap(q.mapId)?.name||'目標地域') + '）', 'contract-challenge', `data-id="${q.id}"`, 'danger') :
            targetMaps.map(m => btn(esc(m.name) + 'へ出発 →', 'enter-map', `data-id="${m.id}"`, 'primary')).join(' ')
          }
        </div>
      </div>` : ''}
      <div class="actions">
        ${!accepted&&!ready&&(!done||q.repeat)?btn(cannotAccept?'別の依頼を受注中':done?'再受注する':'依頼を受ける','contract-accept',`data-id="${q.id}" ${cannotAccept?'disabled':''}`,cannotAccept?'':'primary'):''}
        ${accepted&&emergency?btn('討伐へ出発','contract-challenge',`data-id="${q.id}"`,'danger'):''}
        ${accepted&&!emergency||ready?btn(emergency?'討伐を報告':'資源を納品','contract-deliver',`data-id="${q.id}" ${ready?'':'disabled'}`,'primary'):''}
        ${accepted?btn('依頼を破棄','contract-abandon',`data-id="${q.id}"`):''}
      </div>
    </article>`;
  }
  const oldGuildScreen=guildScreen;
  guildScreen=function() {
    ensureSpecialOffers();
    const active = getActiveQuest();
    const cal = getCalendar();
    const offers=contracts(),groups=[['resource','📦 常設・資源調達','何度でも受けられる資源の納品依頼。'],['lucrative','◇ 特別・好条件納品','報酬が高い期限付きの納品依頼。'],['emergency','⚔ 高難度・緊急討伐','強襲個体を討伐する期限付きの依頼。']];
    return title('ADVENTURERS GUILD', '冒険者ギルド・依頼掲示板', '受託枠は1件。常設の資源調達、商隊の好条件納品や強襲個体の緊急討伐を引き受ける。') +
      `<section class="panel">
        <div class="row between">
          <h2>冒険者ギルド・依頼掲示板</h2>
          <span class="chip gold" style="font-size:12px">📅 ${formatCalendar(cal)}</span>
        </div>
        <p class="muted">受託できる依頼はパーティー全体で同時に1件のみです。常設調達のほか、掲示板には商隊の好条件納品や緊急討伐などの非常設依頼が常に掲載されます。非常設依頼には達成期限があり、期限内に達成できなければ失敗扱いとなり違約金（罰金）が発生します。<br><strong style="color:var(--gold)">💡 冒険者の主な収入源：</strong>迷宮の通常魔物からは直接の金貨は得られません。集めた素材をギルド依頼へ納品して報奨金を得るか、商店で素材・不要装備を売却して資金を獲得しましょう。</p>
        ${active ? (() => {
          const actQ = active.q || active;
          const isEmerg = actQ?.kind === 'emergency';
          const targetMaps = isEmerg ? (actQ.mapId ? [worldMap(actQ.mapId)].filter(Boolean) : []) : candidateMapsForContract(actQ);
          const repTown = townById(active.townId);
          const repTownName = repTown?.name || (active.townId === 'ash' ? '灰の街アッシュ' : active.townId);
          return `<div class="quest-box" style="margin-top:10px;border-left:3px solid var(--gold);background:#1a271c">
            <div class="row between">
              <b>📌 現在受託中の依頼：${esc(active.name)}</b>
              ${btn('依頼を破棄する', 'contract-abandon', `data-id="${active.id}"`)}
            </div>
            <p class="muted" style="margin:4px 0">報告先：${esc(repTownName)}</p>
            <div style="margin:8px 0">
              <small class="gold"><b>⚔ 探索先ダンジョンを選択して出発：</b></small>
              <div class="actions" style="margin-top:4px">
                ${isEmerg ?
                  btn('討伐へ出発（' + esc(worldMap(actQ.mapId)?.name || '目標地域') + '）', 'contract-challenge', `data-id="${active.id}"`, 'danger') :
                  targetMaps.map(m => btn(esc(m.name) + 'へ出発 →', 'enter-map', `data-id="${m.id}"`, 'primary')).join(' ')
                }
              </div>
            </div>
            <small class="muted">※受託中は他の依頼を受けられません。納品・報告して達成するか破棄してください。ダンジョンへは上のボタンまたは下の依頼表から直接出発できます。</small>
          </div>`;
        })() : '<div class="quest-box" style="margin-top:10px"><span class="chip">依頼受託枠：空き（1件受託可能）</span><span class="muted" style="margin-left:10px">※依頼を受けずにダンジョンへ潜る場合は、上部「地図」タブから自由に探索できます。</span></div>'}
      </section><p class="muted">📦 は指定品質・数量の素材を所持、✅ は受託済みで今すぐ納品・報告可能です。素材は依頼ごとに判定され、納品すると消費されます。</p>${groups.map(([kind,label,description])=>{const list=offers.filter(q=>q.kind===kind);return `<section class="section-space" aria-label="${label}"><div class="row between"><h2>${label}</h2><span class="chip">${list.length}件</span></div><p class="muted">${description}</p><div class="grid three">${list.map(contractHTML).join('')||'<p class="muted">現在この種別の依頼はありません。</p>'}</div></section>`;}).join('')}`;
  };

  rulesScreen=function() {
    const e=state(),explorer=explorers().length>0,tactician=tacticians().length>0,supRoles=supportRoleCount(),books=[...SUPPORT_BOOKS,...DATA.rules].filter(b=>bookKnown(b.id)||s.books.includes(b.id)||e.facilityRules.owned.includes(b.id)),knownRules=DATA.rules.filter(b=>s.books.includes(b.id));
    const discoveredBehaviors=Object.values(catalog.behaviors||{}).filter(b=>behaviorStatus(b.id).discovered);
    return title('LIBRARY OF DISCOVERIES','行動書庫','旅で見つけた行動書の情報を頼りに、判断を学ぶ。')+
      `<section class="panel"><h2>現在の探索方針・補助職の連携（補助役割 ${supRoles}種）</h2><p>${explorer?'🧭 探索者・案内人が同行中：初期の連続探索とSP3の即時帰還を利用できます。':canAutomate()?'連続探索の手引書を習得しています。':'手動で探索できます。探索者・案内人の同行、または連続探索の手引書で自動探索を学べます。'}<br>${tactician?'♟️ 軍師・参謀が同行中：行動書の購入前でも、自動戦闘で負傷者の回復・解毒・弱点狙いの戦術指揮が働きます。':'戦闘職のみの編成では、行動書を買い揃えるまで自動戦闘は先頭への通常攻撃のみとなります。'}</p><label class="field">歩行規則<select data-change="walkRule"><option value="right">右手法</option>${knownRules.filter(b=>b.type==='walk').map(b=>`<option value="${b.id}" ${s.walkRule===b.id?'selected':''} ${!unlocked(b.id)?'disabled':''}>${esc(b.name)}</option>`).join('')}</select></label><div class="actions">${knownRules.filter(b=>b.type==='battle').map(b=>btn((s.battleRules.includes(b.id)?'✓ ':'')+esc(b.name),'battle-rule',`data-id="${b.id}" ${!unlocked(b.id)?'disabled':''}`,s.battleRules.includes(b.id)?'selected':'')).join('')}</div><p class="muted">初期パーティーには探索者（自動探索・帰還支援）と軍師（自動戦闘支援）が編成されています。戦闘職6人だけで挑む編成は、補助職の恩恵を捨てる上級者向けの縛り・やり込み編成です。</p></section><div class="grid three section-space">${books.map(b=>{const owned=s.books.includes(b.id)||e.facilityRules.owned.includes(b.id);return `<article class="card"><span class="chip">平均Lv.${b.level}</span><h2>${esc(b.name)}</h2><p>${esc(b.desc)}</p>${btn(owned?'習得済み':'購入 / '+bookPrice(b)+' G','book',`data-id="${b.id}" ${owned||partyLevel()<b.level||s.gold<bookPrice(b)?'disabled':''}`)}</article>`;}).join('')||'<p class="empty">購入できる行動書の情報は、まだ見つかっていません。</p>'}</div>`+
  function activeTacticsHTML() {
    const tactics = typeof activePartyTactics === 'function' ? activePartyTactics() : [];
    if (!tactics.length) return '';
    return `<section class="panel section-space">
      <h2>♟️ 部隊戦術・リソース残量指定スキル（発動中 ${tactics.length}件）</h2>
      <p class="muted">軍師や専門職が部隊に同行することで発動する戦術規律です。自動探索や自動戦闘でのSP枯渇・疲弊（能力半減）やマナ切れを未然に防ぎます。</p>
      <div class="grid three">
        ${tactics.map(t => {
          const res = t.reserve;
          const scopeLabel = res.scope === 'party' ? '部隊全体' : '使用者本人';
          const typeLabel = res.type === 'sp' ? 'SP' : 'MANA';
          const valLabel = res.mode === 'percent' ? `${res.value}%` : `${res.value}`;
          return `<article class="card">
            <div class="row between">
              <h3>${esc(t.skill.name)}</h3>
              <span class="chip">${scopeLabel}</span>
            </div>
            <p><strong>${esc(t.hero.name)}</strong>（${DATA.jobs[t.hero.job]?.name || ''}）が指揮・発動中。<br>${esc(t.skill.desc)}</p>
            <div class="row between"><small class="muted">指定残量閾値</small><strong>${typeLabel} ${valLabel} 以上を温存</strong></div>
          </article>`;
        }).join('')}
      </div>
    </section>`;
  }
      activeTacticsHTML()+
      ((unlocked('reserve') || (typeof activePartyTactics === 'function' && activePartyTactics().length > 0)) ? reserveHTML() : '')+
      `<section class="panel section-space"><div class="row between"><h2>探索行動方針（最大6枠優先設定）</h2><span class="chip">発見済み ${discoveredBehaviors.length}種 · 設定中 ${(e.activeBehaviors||['B01']).length}/6枠</span></div><p class="muted">入手した探索手引書（平均Lv条件）または同行中の専門職が体得した技能によって利用できます。専門職だけに頼る行動は、本人が戦闘不能になると停止します。</p><div class="grid three">${discoveredBehaviors.map(b=>{const st=behaviorStatus(b.id),active=(e.activeBehaviors||['B01']).includes(b.id);return `<article class="card ${st.usable?'':'locked'}"><div class="row between"><h3>${esc(b.name)}</h3><span class="chip">${esc(st.reason)}</span></div><p>${esc(b.action)}</p>${b.id==='B01'?'<span class="chip">基本行動（常時有効）</span>':btn(active?'✓ 優先設定中':st.usable?'行動枠に設定':'条件未達','toggle-behavior',`data-id="${b.id}" ${!st.usable&&!active?'disabled':''}`,active?'selected':'')}</article>`;}).join('')}</div></section>`;
  };
  function reserveHTML() {
    const r=reserveSettings();return `<section class="panel section-space"><h2>残量判断</h2><label>判定方式 <select data-reserve="mode"><option value="percent" ${r.mode==='percent'?'selected':''}>割合（%）</option>${unlocked('precise')?`<option value="absolute" ${r.mode==='absolute'?'selected':''}>絶対値</option>`:''}</select></label>${['life','mana','sp'].map(k=>`<label>${k.toUpperCase()} <input type="number" min="0" max="${r.mode==='percent'?100:9999}" value="${r[k]}" data-reserve="${k}"></label>`).join('')}</section>`;
  }
  const oldNextWalkDirection=nextWalkDirection;
  function ensureFloorHazards(d) {
    if(!d||d.hazards)return d?.hazards||{};
    const r=rng(((d.seed||1)+d.depth*13337+9001)>>>0),hz={};
    const H=d.map?.length||13, W=d.map?.[0]?.length||19;
    const startX=d.startX??1, startY=d.startY??1, downX=d.downX??(W-2), downY=d.downY??(H-2);
    for(let y=1;y<H-1;y++)for(let x=1;x<W-1;x++){
      if((Math.abs(x-startX)<=1&&Math.abs(y-startY)<=1)||(x===downX&&y===downY)||d.map[y]?.[x]!=='.')continue;
      const roll=r();
      if(roll<.075){
        const kind=roll<.03?'trap':roll<.055?'miasma':'arcane';
        hz[`${x},${y}`]={type:kind,discovered:false,disarmed:false,level:d.level||1};
      }else if(roll<.115){
        const tKind=roll<.09?'water':roll<.105?'cliff':'secret';
        hz[`${x},${y}`]={type:tKind,discovered:true,disarmed:false,level:d.level||1,traversal:true};
      }
    }
    d.hazards=hz;return hz;
  }
  function scanAdjacentHazards(d) {
    if(!d)return;
    const hz=ensureFloorHazards(d);
    const canTrap=behaviorActive('B16')||partyCatalogSkills().some(x=>['SK0001','SK0007','SK0008','SK0009','SK0010','SK0013'].includes(x.skill.id));
    const canArcane=behaviorActive('B37')||partyCatalogSkills().some(x=>['SK0057','SK0058','SK0085','SK0086'].includes(x.skill.id));
    for(const [dx,dy] of DIRS){
      const key=`${d.x+dx},${d.y+dy}`,h=hz[key];
      if(!h||h.discovered||h.disarmed)continue;
      if((h.type==='trap'&&canTrap)||(h.type!=='trap'&&canArcane)||canTrap&&canArcane){
        h.discovered=true;
        const label=h.type==='trap'?'仕掛け罠':h.type==='miasma'?'瘴気溜まり':'魔力異常床';
        note(`🔍 警戒網により前方の${label}（${d.x+dx},${d.y+dy}）を事前に看破した！`);
        if((h.type==='trap'&&(behaviorActive('B17')||partyCatalogSkills().some(x=>['SK0008','SK0010','SK0012'].includes(x.skill.id))))||(h.type!=='trap'&&(behaviorActive('B38')||partyCatalogSkills().some(x=>['SK0058','SK0059'].includes(x.skill.id))))){
          h.disarmed=true;
          note(`🛠️ 専門技能により（${d.x+dx},${d.y+dy}）の${label}を安全に解除・遮断した！`);
        }
      }
    }
  }
  function isKnownArmedHazard(d,x,y) {
    const h=ensureFloorHazards(d)[`${x},${y}`];
    return !!(h&&!h.traversal&&h.discovered&&!h.disarmed);
  }
  nextWalkDirection=function() {
    const d=s.dungeon;if(!d)return null;
    scanAdjacentHazards(d);
    const avoidHazard=behaviorActive('B15')||behaviorActive('B18')||behaviorActive('B36');
    const filterSafe=opts=>{
      if(!avoidHazard)return opts;
      const safe=opts.filter(i=>{const [dx,dy]=DIRS[i];return !isKnownArmedHazard(d,d.x+dx,d.y+dy);});
      return safe.length?safe:opts;
    };
    if(behaviorActive('B02')&&s.walkRule==='right'){
      const opts=filterSafe([3,0,1,2].map(o=>(d.facing+o)%4).filter(i=>{const [dx,dy]=DIRS[i];return d.map[d.y+dy]?.[d.x+dx]&&d.map[d.y+dy][d.x+dx]!=='#';}));
      if(behaviorActive('B05'))opts.sort((a,b)=>d.visits[d.y+DIRS[a][1]][d.x+DIRS[a][0]]-d.visits[d.y+DIRS[b][1]][d.x+DIRS[b][0]]);
      return opts[0]??null;
    }
    const baseDir=oldNextWalkDirection();
    if(baseDir===null)return null;
    if(behaviorActive('B25')||behaviorActive('B28')||behaviorActive('B30')){
      for(let i=0;i<4;i++){
        const [dx,dy]=DIRS[i],t=d.map[d.y+dy]?.[d.x+dx];
        if((behaviorActive('B25')&&t==='c')||((behaviorActive('B28')||behaviorActive('B30'))&&t==='o'))return i;
      }
    }
    if(behaviorActive('B04')||behaviorActive('B05')||avoidHazard){
      const opts=filterSafe([1,0,3,2].map(o=>(d.facing+o)%4).filter(i=>{const [dx,dy]=DIRS[i];return d.map[d.y+dy]?.[d.x+dx]&&d.map[d.y+dy][d.x+dx]!=='#';}));
      if(behaviorActive('B04')){
        const unvisited=opts.find(i=>{const [dx,dy]=DIRS[i];return (d.visits[d.y+dy]?.[d.x+dx]||0)===0;});
        if(unvisited!==undefined)return unvisited;
      }
      if(behaviorActive('B05')){
        opts.sort((a,b)=>d.visits[d.y+DIRS[a][1]][d.x+DIRS[a][0]]-d.visits[d.y+DIRS[b][1]][d.x+DIRS[b][0]]);
        return opts[0]??baseDir;
      }
      if(avoidHazard&&isKnownArmedHazard(d,d.x+DIRS[baseDir][0],d.y+DIRS[baseDir][1]))return opts[0]??baseDir;
    }
    return baseDir;
  };
  const oldStep=step;
  step=function(dx,dy,automatic=false) {
    const d=s.dungeon;
    if(d)scanAdjacentHazards(d);
    const nx=d?(d.x+dx):0,ny=d?(d.y+dy):0;
    const tileBefore=d?.map?.[ny]?.[nx];
    const sbBefore=d?.sinceBattle||0;
    if(d&&(tileBefore==='o'||tileBefore==='c')&&((behaviorActive('B28')&&tileBefore==='o')||(behaviorActive('B30')&&tileBefore==='o')||partyCatalogSkills().some(x=>['SK0051','SK0116','SK0128','SK0133','SK0145'].includes(x.skill.id)))){
      const m=worldMap(d.mapId),mat=pick(m.materials||['wood']);
      if(random()<.35){addMaterial(mat,1,d.quality);note(`🌿 専門知識により ${apparentMaterialName(mat)} Q${d.quality} を追加採集した。`);}
    }
    if(d&&sbBefore>2&&(behaviorActive('B09')||behaviorActive('B10')||partyCatalogSkills().some(x=>['SK0001','SK0013','SK0049','SK0052'].includes(x.skill.id)))&&random()<.35){
      d.sinceBattle=Math.max(0,sbBefore-1);
    }
    advanceTime(5, '歩行');
    const res=oldStep(dx,dy,automatic);
    if(s.dungeon&&s.dungeon===d&&d.x===nx&&d.y===ny){
      const supCount=supportRoleCount();
      if(supCount>=2&&d.steps%8===0){
        for(const h of alive())h.sp=Math.min(maxSP(h),(h.sp??maxSP(h))+1);
      }else if(supCount===0&&party().length>=5&&d.steps%6===0){
        for(const h of alive())h.sp=Math.max(0,(h.sp??maxSP(h))-1);
        if(d.steps===6)note('⚠️ 探索・戦術の補助職が不在（戦闘職のみの編成）のため、行軍のSP消耗が激しい。');
      }
      const hz=ensureFloorHazards(d)[`${nx},${ny}`];
      if(hz&&!hz.disarmed){
        hz.discovered=true;hz.disarmed=true;
        if(hz.traversal){
          const m=worldMap(d.mapId),mat=pick(m.materials||['wood']);
          if(hz.type==='water'){
            if(behaviorActive('B34')||explorers().length>0||partyCatalogSkills().some(x=>['SK0003','SK0015','SK0140'].includes(x.skill.id))){
              addMaterial(mat,1,d.quality);note(`🌊 水辺・浅瀬踏破（B34/探索支援）により水流を軽やかに渡り、${apparentMaterialName(mat)} Q${d.quality} を回収した！`);
            }else{
              for(const h of alive())h.sp=Math.max(1,(h.sp??maxSP(h))-1);
              note('🌊 浅瀬の踏破に足を取られ、各員 SP -1（水辺踏破B34や探索者で軽減可能）。');
            }
          }else if(hz.type==='cliff'){
            if(behaviorActive('B35')||explorers().length>0||partyCatalogSkills().some(x=>['SK0002','SK0014','SK0016'].includes(x.skill.id))){
              for(const h of alive())h.sp=Math.min(maxSP(h),(h.sp??maxSP(h))+1);
              note('🧗 高所・縦穴移動（B35/探索支援）のロープワークで段差を安全に踏破した！');
            }else{
              for(const h of alive())h.sp=Math.max(1,(h.sp??maxSP(h))-1);
              note('🧗 険しい段差の昇降で各員 SP -1（高所移動B35や探索者で軽減可能）。');
            }
          }else if(hz.type==='secret'){
            if(behaviorActive('B31')||behaviorActive('B32')||behaviorActive('B33')||explorers().length>0||observers().length>0){
              addMaterial(mat,2,d.quality);earnGold(10+d.level*4);
              note(`🗝️ 隠し通路・構造物調査（B31〜B33/観測支援）により隠し区画を発見！${apparentMaterialName(mat)} Q${d.quality} ×2 を獲得！`);
            }
          }
        }else{
          const canDisarm=(hz.type==='trap'&&(behaviorActive('B17')||partyCatalogSkills().some(x=>['SK0008','SK0010','SK0011','SK0012'].includes(x.skill.id))))||(hz.type!=='trap'&&(behaviorActive('B38')||partyCatalogSkills().some(x=>['SK0058','SK0059'].includes(x.skill.id))));
          if(canDisarm){
            note(`🛠️ 足元の${hz.type==='trap'?'仕掛け罠':hz.type==='miasma'?'瘴気溜まり':'魔力異常'}を即座に無力化した！`);
          }else{
            const dmg=Math.max(2,Math.min(18,Math.ceil((d.level||1)*.4)));
            for(const h of alive()){
              h.hp=Math.max(1,h.hp-dmg);
              if(hz.type==='miasma')h.sp=Math.max(1,(h.sp??maxSP(h))-1);
            }
            note(`⚠️ ${hz.type==='trap'?'仕掛け罠':hz.type==='miasma'?'瘴気溜まり':'魔力異常床'}が作動！各員 LIFE -${dmg}${hz.type==='miasma'?' / SP -1':''}。`);
          }
        }
      }
      scanAdjacentHazards(d);
    }
    return res;
  };

  const prevEnterMap = enterMap;
  enterMap = function(id, corpseId = null) {
    const c = s.corpses.find(x => x.id === corpseId);
    const m = worldMap(c ? c.floor.mapId : id);
    if (m) {
      const travelH = Math.min(8, Math.max(1, Math.ceil((m.level || 1) / 15)));
      advanceTime(travelH * 60, '移動');
    }
    return prevEnterMap(id, corpseId);
  };

  const oldToggleExpedition=toggleExpedition;
  toggleExpedition=function() {if(!s.autoExpedition&&!canAutomate()){tell('探索者が同行するか、連続探索の手引書を習得すると利用できます。');return render();}return oldToggleExpedition();};
  toggleWalk=function(){return toggleExpedition();};
  const oldWalkTick=walkTick,oldResumeExpedition=resumeExpedition;
  walkTick=function(){
    if(s.autoExpedition&&!canAutomate()){stopAll();tell('探索を導く仲間が行動できないため、自動探索を停止した。');return render();}
    const d=s.dungeon,e=state();
    if(s.autoExpedition&&d&&!s.battle){
      for(const bid of e.activeBehaviors||[]){
        if(bid!=='B01'&&!behaviorStatus(bid).usable){
          stopAll();tell(`設定中の探索行動『${catalog.behaviors?.[bid]?.name||bid}』の担い手が行動不能になったため、安全のため自動探索を停止した。`);return render();
        }
      }
      if((behaviorActive('B22')&&alive().some(h=>h.hp/stats(h).hp<=.3))||(behaviorActive('B20')&&alive().some(h=>(h.sp??maxSP(h))/maxSP(h)<=.2))){
        if(behaviorActive('B03')&&typeof walkTowardEntrance==='function'){
          stopAll();tell('撤退判断（B20/B22）と既知帰路（B03）により、入口へ向かって撤退します。');walkTowardEntrance();return;
        }
        stopAll();tell('撤退閾値（B20/B22）に達したため、自動探索を安全停止した。');return render();
      }
      d.stateVisits??={};
      const skey=`${d.x},${d.y},${d.facing}`;
      d.stateVisits[skey]=(d.stateVisits[skey]||0)+1;
      if(d.stateVisits[skey]>=3){
        if(behaviorActive('B07')){
          const alt=[0,1,2,3].filter(i=>{const [dx,dy]=DIRS[i];return d.map[d.y+dy]?.[d.x+dx]&&d.map[d.y+dy][d.x+dx]!=='#';}).sort((a,b)=>(d.visits[d.y+DIRS[a][1]][d.x+DIRS[a][0]]||0)-(d.visits[d.y+DIRS[b][1]][d.x+DIRS[b][0]]||0))[0];
          if(alt!==undefined){
            d.stateVisits[skey]=0;
            note('🧭 環状路脱出（B07）：巡回を検知し、別の枝道へ進路を切り替えた。');
            s.dungeon.autoSteps++;step(...DIRS[alt],true);
            if(walkTimer&&s.autoExpedition&&!s.battle){stopWalk();resumeExpedition();}
            return;
          }
        }
        stopAll();tell('同じ経路の反復（ループ）を検知したため、自動探索を安全停止した。');return render();
      }
    }
    return oldWalkTick();
  };
  resumeExpedition=function(){if(s.autoExpedition&&!canAutomate()){stopAll();return;}return oldResumeExpedition();};
  function instantReturn() {
    if(!s.dungeon||s.battle)return;
    const h=returnUser();if(!h){tell('行動できる探索者、または帰還の手引書とSP3が必要です。');return render();}
    advanceTime(15, '道標帰還');
    const steps=s.dungeon.steps;h.sp=(h.sp??maxSP(h))-3;stopAll();s.dungeon=null;s.view='town';if(steps>0)rollSpecialOffers();tell(h.name+'が道標をたどり、SP3で街へ即時帰還した。');render();
  }
  const oldReturnTown=returnTown;
  returnTown=function() {const before=s.dungeon;if(before){const travelH=Math.min(8,Math.max(1,Math.ceil((before.level||1)/15)));advanceTime(travelH*60,'帰還');}oldReturnTown();if(before&&!s.dungeon){if(before.steps>0)rollSpecialOffers();render();}};
  const oldVictory=victory;
  const oldDefeat=defeat;
  defeat=function(){
    const dead=new Set(party().filter(h=>h.hp<=0).map(h=>h.id));
    oldDefeat();
    for(const h of s.roster)if(dead.has(h.id))h.hp=0;
    tell(dead.size?'一行は街へ搬送された。亡くなった仲間は神殿での蘇生が必要です。装備は探索地に残っています。':'一行は気絶して街へ搬送された。宿で休息するか、神殿で覚醒の治療を受けられます。');
  };
  victory=function() {
    const b=s.battle,level=s.dungeon?.level||1,contract=b?.facilityContract;
    oldVictory();
    if(b&&!s.battle){
      if(contract){const board=state().guildContracts.towns[contract.townId],p=board?.progress[contract.id];if(p?.status==='accepted'){p.status='ready';note('緊急討伐を達成。街のギルドで報告できます。');}}
      discoverRule(level,b.boss);render();
    }
  };
  const oldExploreScreen=exploreScreen;
  exploreScreen=function() {
    let html=oldExploreScreen();
    if(s.dungeon&&!s.battle){
      const hz=Object.values(ensureFloorHazards(s.dungeon)),known=hz.filter(h=>h.discovered&&!h.disarmed).length,disarmed=hz.filter(h=>h.disarmed).length;
      html+=`<section class="panel section-space"><div class="row between"><div class="actions">${btn('道標で即時帰還 / SP3','instant-return',returnUser()?'':'disabled','primary')}</div>${(known||disarmed)?`<span class="chip">看破した罠・異常 ${known}箇所 / 解除済 ${disarmed}箇所</span>`:''}</div><p class="muted">探索者の同行、または帰還の手引書で利用できます。</p></section>`;
    }
    return html;
  };
  battleScreen=exploreScreen;
  const oldUiEnemies=uiEnemies;
  uiEnemies=function() {
    let html=oldUiEnemies();if(observers().length){let index=0;return html.replace(/<button class="enemy [\s\S]*?<\/button>/g,card=>{const foe=s.battle.enemies[index++];return card.replace(/<small>HP (?:未解析|\d+ \/ \d+)<\/small>/,`<small>LIFE ${foe.hp} / ${foe.maxhp}</small>`);});}
    html=html.replace(/脅威度 Lv\.\d+/g,'脅威度 未観測').replace(/<small>HP \d+ \/ \d+<\/small>/g,'<small>現在LIFE 未観測</small>').replace(/<div class="bar"><i style="width:[^"]*"><\/i><\/div>/g,'');
    return html;
  };
  const oldBattlePanel=uiBattlePanel;
  uiBattlePanel=function(){const html=oldBattlePanel();return observers().length?html:html.replace(/\(HP:\d+\)/g,'（LIFE未観測）');};
  const oldJournal=journalScreen;
  journalScreen=function(){const html=oldJournal();return observers().length?html:html.replace(/観測Lv\.\d+/g,'脅威度 未観測');};
  const oldHandleAction=handleAction;
  handleAction=function(event) {
    const b=event.target.closest('[data-action]');if(!b||b.disabled)return;
    if(b.dataset.action==='shop-tab'||b.dataset.action==='shop-category') {
      if(!townOnly())return;
      const selection=shopSelectionState(),value=b.dataset.id;
      if(b.dataset.action==='shop-tab'&&['buy','sell'].includes(value))selection.tab=value;
      else if(b.dataset.action==='shop-category'&&Object.hasOwn(SHOP_BUY_CATEGORIES,value))selection.category=value;
      render();return;
    }
    const d=b.dataset,actions={'temple-treat':()=>templeTreat(Number(d.id),d.kind,d.credit==='yes'),'merchant-buy-gear':()=>buyGear(d.id),'merchant-sell-gear':()=>sellGear(Number(d.id)),'merchant-sell-bulk-gear':sellUnusedCommonGear,'contract-accept':()=>acceptContract(d.id),'contract-deliver':()=>deliverContract(d.id),'contract-challenge':()=>challengeContract(d.id),'contract-abandon':()=>abandonContract(d.id),'instant-return':instantReturn};
    if(actions[d.action])return actions[d.action]();
    return oldHandleAction(event);
  };
  globalThis.BRPGFacilities={getCalendar,formatCalendar,advanceTime,checkRealMidnight,getActiveQuest,checkContractDeadlines,ensureSpecialOffers,abandonContract,contracts,acceptContract,deliverContract,challengeContract,rollSpecialOffers,discoverRule,bookPrice,bookKnown,canAutomate,canClickWalk,observers,tacticians,supportRoleCount,instantReturn,templeTreat,templeFee,creditLimit,sellUnusedCommonGear,behaviorStatus,behaviorActive,heroCatalogSkills,partyCatalogSkills,ensureFloorHazards,scanAdjacentHazards};
})();
