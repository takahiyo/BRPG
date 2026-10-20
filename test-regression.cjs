const {harness}=require('./test.cjs');const h=harness();h.run(`
function reset(){stopAll();s=fresh();render();}
reset();const bad=structuredClone(s);bad.roster[0].learned={};assert(!validSave(bad));bad.roster[0].learned=[];bad.roster[0].jobHistory={};assert(!validSave(bad));
for(let seed=0;seed<30;seed++)for(const m of DATA.maps){const d=makeFloor(m,seed,1),queue=[[1,1]],seen=new Set(['1,1']);while(queue.length){const [x,y]=queue.shift();for(const [dx,dy]of DIRS){const nx=x+dx,ny=y+dy,k=nx+','+ny;if(d.map[ny]?.[nx]&&d.map[ny][nx]!=='#'&&!seen.has(k)){seen.add(k);queue.push([nx,ny]);}}}assert(seen.has('17,11'));}
reset();enterMap('forest_edge');encounter();const hero=s.roster[0];hero.lv=300;syncHero(hero);const sk=heroSkills(hero).find(k=>k.kind==='attack'&&k.target==='enemy');const before=hero.sp;cast(hero,0,sk.id);assert.equal(hero.sp,before-sk.sp);
let total=0;for(let seed=1;seed<=30;seed++){reset();s.randomState=seed;enterMap('forest_edge');let fights=0;while(s.dungeon&&fights<30){encounter();let turns=0;while(s.battle&&turns++<100){autoPlans();executeTurn();}fights++;}assert(fights<30);total+=fights;}console.log('PASS: 420 connected floors, malformed skill-history rejected, exact SP cost. No-recovery chain: average fights until defeat',total/30);
`);
