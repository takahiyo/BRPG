const {harness}=require('./test.cjs');const h=harness();h.run(`
function reset(){stopAll();s=fresh();render();}
reset();const bad=structuredClone(s);bad.roster[0].learned={};assert(!validSave(bad));bad.roster[0].learned=[];bad.roster[0].jobHistory={};assert(!validSave(bad));
for(let seed=0;seed<30;seed++)for(const m of DATA.maps){const d=makeFloor(m,seed,1),queue=[[1,1]],seen=new Set(['1,1']);while(queue.length){const [x,y]=queue.shift();for(const [dx,dy]of DIRS){const nx=x+dx,ny=y+dy,k=nx+','+ny;if(d.map[ny]?.[nx]&&d.map[ny][nx]!=='#'&&!seen.has(k)){seen.add(k);queue.push([nx,ny]);}}}assert(seen.has('17,11'));}
reset();enterMap('forest_edge');encounter();const hero=s.roster[0];hero.lv=300;syncHero(hero);const sk=heroSkills(hero).find(k=>k.kind==='attack'&&k.target==='enemy');const before=hero.sp;cast(hero,0,sk.id);assert.equal(hero.sp,before-sk.sp);
let total=0;for(let seed=1;seed<=30;seed++){reset();s.randomState=seed;enterMap('forest_edge');let fights=0;while(s.dungeon&&fights<30){encounter();let turns=0;while(s.battle&&turns++<100){autoPlans();executeTurn();}fights++;}assert(fights<30);total+=fights;}console.log('PASS: 420 connected floors, malformed skill-history rejected, exact SP cost. No-recovery chain: average fights until defeat',total/30);
reset();assert.equal(Object.keys(DATA.catalog.materials).length,265);assert.equal(Object.keys(DATA.catalog.products).length,540);assert.equal(Object.keys(DATA.catalog.itemTitles).length,400);assert.equal(Object.keys(DATA.catalog.monsters).length,400);assert.equal(Object.keys(DATA.catalog.monsterTitles).length,160);assert.equal(Object.keys(DATA.catalog.jobs).length,300);assert.equal(Object.keys(DATA.catalog.skills).length,180);assert.equal(Object.keys(DATA.catalog.behaviors).length,40);assert.equal(Object.keys(DATA.catalog.crafting.techs).length,13);
const evH=evaluate5RouteCraft('wood','P0031','H'),evM=evaluate5RouteCraft('tungsten','P0031','M');assert(evH.possible&&evH.residue===0);assert(evM.possible&&evM.residue>0&&evM.manaMult>=1);
const loot=rollHackSlashGear(85,'legendary');assert(['legendary','mythic'].includes(loot.rarity)&&loot.productId&&loot.titleId);
for(const tab of ['v3mat','cat_mat','cat_prod','cat_title','cat_mon','cat_job']){s.ext.catalogTab=tab;s.view='catalog';render();assert($('app').innerHTML.length>500);}
reset();addMaterial('copper',2,1);addMaterial('iron',3,1);const mHtml=materialsHTML();assert((mHtml.match(/石/g)||[]).length>=2);tell('銅 Q1を採集した。');assert(notice.includes('石 Q1を採集した'));
s.ext.identifiedMaterials.push('copper');assert(materialsHTML().includes('銅'));
reset();$('address').value='https://high-level-test.example.com';const gBefore=s.gold;discoverAddress('https://high-level-test.example.com');assert(s.gold<gBefore&&!s.addressPreview);
reset();openCharacter(1);const cBody=$('character-body').innerHTML;assert(!cBody.includes('解放条件')&&!cBody.includes('INT*'));$('character-dialog').close();
console.log('PASS: 1,765 catalog entries, 5-route craft residue/eta, Hack & Slash legendary loot roll, all 6 encyclopedia tabs, stone masking, address level-gate, spoiler-free UI.');
`);
