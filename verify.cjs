const fs=require('fs'),vm=require('vm'),assert=require('assert');
const els={};const el=s=>els[s]??={value:s==='#country'?'LV':'',dataset:{mode:'legal'},classList:{toggle(){}},style:{},addEventListener(){},showModal(){},close(){},getContext(){return{}},getBoundingClientRect(){return{width:800,height:700}}};
const storage={};const sandbox={console,document:{querySelector:el,querySelectorAll:()=>[],addEventListener(){}},localStorage:{setItem:(k,v)=>storage[k]=v,getItem:k=>storage[k]},setTimeout(){},clearTimeout(){},setInterval(){},clearInterval(){},Math,Date};
vm.createContext(sandbox);
for(let file of ['simulation.js','warfare.js'])vm.runInContext(fs.readFileSync('dist/'+file,'utf8'),sandbox);
vm.runInContext(fs.readFileSync('dist/game.js','utf8').split("window.addEventListener('resize'")[0],sandbox);
const manifest=JSON.parse(fs.readFileSync('dist/places.json'));const settlements=manifest.parts.flatMap(p=>JSON.parse(fs.readFileSync('dist/'+p)));assert.equal(settlements.length,manifest.count);
Object.assign(sandbox,{data:JSON.parse(fs.readFileSync('dist/countries.json')),occupation:JSON.parse(fs.readFileSync('dist/occupation.json')),settlements,assert});
vm.runInContext(`
occupationData=occupation;features=data.features;places=settlements;
for(let f of features){let c=f.properties.code,capital=places.find(p=>p[4]===c&&p[5]),r=rings(f).flatMap(p=>p[0]);world[c]={name:f.properties.name,feature:f,center:capital?[capital[1],capital[2]]:[r.reduce((s,p)=>s+p[0],0)/r.length,r.reduce((s,p)=>s+p[1],0)/r.length]};}
render=()=>{};draw=()=>{};
start();assert.equal(state.player,'LV');assert(nation().allies.includes('FI'));let treasury=nation().treasury;advance();assert(nation().treasury>treasury);assert(Number.isFinite(nation().growth));
target='LT';act('trade');assert(nation().trades.includes('LT'));
// Exactly one war per pair; one shared contact line rather than two invasions.
target='RU';act('war');assert.equal(state.wars.length,1);let w=state.wars[0];assert(w.shared&&w.active);assert(w.frontier.length>0);assert(!w.landing);assert(w.frontier.every(k=>wcPoint(k)[1]>55));
assert.equal(wcOpening(w,'LV'),1.25);w.months=1;assert.equal(wcOpening(w,'LV'),1.25);w.months=2;assert.equal(wcOpening(w,'LV'),1.25);w.months=3;assert.equal(wcOpening(w,'LV'),1);assert.equal(wcOpening(w,'RU'),1);
// An overwhelmingly strong attacker moves connected cells on the shared line.
w.months=0;state.countries.LV.force=1e7;state.countries.RU.force=1;let beforeControl={...state.control};let beforeOwner=k=>wcRoot(beforeControl[k]||wcBase(k,w));wcAdvanceWar(w);let changed=Object.keys(state.control).filter(k=>state.control[k]!==beforeControl[k]);assert(changed.length>0);assert(w.last.winner==='LV');
let connected=new Set(changed.filter(k=>wcNeighbors(k).some(n=>beforeOwner(n)==='LV'))),unseen=new Set(changed);for(let pass=0;pass<changed.length&&unseen.size;pass++){let expanded=false;for(let k of [...unseen])if(connected.has(k)||wcNeighbors(k).some(n=>connected.has(n))){connected.add(k);unseen.delete(k);expanded=true;}if(!expanded)break;}assert.equal(unseen.size,0,'No teleporting or detached invasion blobs');
assert(Object.values(state.control).every(c=>c==='LV'||c==='RU'));assert(WC_RADIUS<.045);
// Counterattacks recapture home soil before pushing into the opponent's country.
state.countries.RU.force=1e10;state.countries.LV.force=1;let existing=new Set(Object.keys(state.control));wcAdvanceWar(w);let newForeign=Object.keys(state.control).filter(k=>!existing.has(k)&&wcLegal(k,w)==='LV');if(newForeign.length)assert(!w.frontier.some(k=>wcLegal(k,w)==='RU'&&wcOwner(k,w)==='LV'));
// Opening boost expires exactly after the third resolved turn and never restarts on ceasefire.
state.wars=[];state.control={};w=wcCreateWar('LV','RU');state.wars.push(w);for(let i=0;i<3;i++){assert.equal(wcOpening(w,'LV'),1.25);wcAdvanceWar(w);}assert.equal(w.months,3);assert.equal(wcOpening(w,'LV'),1);
// Major-city capture changes both sides' morale and public support; repeat flips have a cooldown.
let city=wcCities().find(c=>c.home==='LV'&&c.capital);assert(city);state.control={};state.turn=20;state.cityMorale={};state.countries.LV.morale=65;state.countries.RU.morale=65;let cityBefore=Object.fromEntries(wcCities().map(c=>[c.id,wcCityOwner(c)]));wcSetOwner(city.key,'RU',w);wcCityChanges(w,cityBefore);assert.equal(state.countries.RU.morale,75);assert.equal(state.countries.LV.morale,55);assert(w.last.cities.includes(city.name));
let mood=state.countries.LV.morale;cityBefore=Object.fromEntries(wcCities().map(c=>[c.id,wcCityOwner(c)]));wcSetOwner(city.key,'LV',w);wcCityChanges(w,cityBefore);assert.equal(state.countries.LV.morale,mood);state.turn+=6;cityBefore=Object.fromEntries(wcCities().map(c=>[c.id,wcCityOwner(c)]));wcSetOwner(city.key,'RU',w);wcCityChanges(w,cityBefore);assert.equal(state.countries.LV.morale,mood-10);
let weak=wcPower(w,'LV');state.countries.LV.morale=100;assert(wcPower(w,'LV')>weak);
// Saves retain exclusive control, morale, age and ceasefires. Resume does not renew initiative.
w.months=8;target='RU';wcPeace(w);assert(!w.active);let frozen=JSON.stringify(state.control);wcAdvanceAll();assert.equal(JSON.stringify(state.control),frozen);save(false);state=null;resume();assert(!state.wars[0].active);assert.equal(JSON.stringify(state.control),frozen);target='RU';assert(simResumeFront());assert.equal(wcOpening(state.wars[0],'LV'),1);
// The dated Ukraine theatre runs in the same shared engine while the player is elsewhere.
document.querySelector('.mode.active').dataset.mode='control';document.querySelector('#country').value='LV';start();assert(state.front.active&&state.front.shared);assert.equal(state.wars.length,1);assert.equal(wcOpening(state.front,'RU'),1);assert(simAtWar('UA','RU'));assert(!simAtWar('LV'));let initial=JSON.stringify(state.control),tax=nation().tax;for(let i=0;i<12;i++)advance();assert.notEqual(JSON.stringify(state.control),initial);assert.equal(nation().tax,tax);assert(Object.values(state.countries).some(n=>n.code!=='LV'&&n.ai.decisions>0));
assert.equal(wcCityOwner(wcCities().find(c=>c.home==='UA'&&c.capital)),'UA');save(false);let controls=JSON.stringify(state.control);state=null;resume();assert.equal(JSON.stringify(state.control),controls);assert(state.front.shared);
// Both movement directions use the same exclusive controller map.
let front=state.front;state.countries.RU.force=1e9;state.countries.UA.force=1;wcAdvanceWar(front);assert.equal(front.last.winner,'RU');state.countries.RU.force=1;state.countries.UA.force=1e9;wcAdvanceWar(front);assert.equal(front.last.winner,'UA');
// Legacy paired invasions are consolidated without losing political or economic state.
document.querySelector('.mode.active').dataset.mode='legal';start();delete state.warfare;state.wars=[{a:'LV',b:'RU',captured:[0],cells:[[29,58]],step:.1,stance:'balanced'},{a:'RU',b:'LV',captured:[0],cells:[[27,57]],step:.1,stance:'offensive'}];let cash=nation().treasury,approval=state.approval;wcEnsureWorld();assert.equal(state.wars.length,1);assert(state.wars[0].shared);assert.equal(nation().treasury,cash);assert.equal(state.approval,approval);assert.equal(wcOpening(state.wars[0],'LV'),1);
// A previous Ukraine hex save is translated to the smaller grid and keeps its ceasefire.
document.querySelector('.mode.active').dataset.mode='control';start();let oldGrid=simGrid(),oldOwners=[...oldGrid.initial],edge=oldOwners.findIndex((v,i)=>oldGrid.neighbors[i].some(j=>oldOwners[j]!==v));oldOwners[edge]=1-oldOwners[edge];delete state.front;Object.defineProperty(state,'front',{value:{owners:oldOwners,active:false,months:17,postures:{RU:'balanced',UA:'defensive'},fatigue:{RU:3,UA:4}},configurable:true,enumerable:true});delete state.warfare;state.wars=[];state.control={};wcEnsureWorld();assert(!state.front.active);assert.equal(state.front.months,17);assert(Object.keys(state.control).length>0);assert.equal(state.front.postures.UA,'defensive');
// Occupation outlines follow the same integer hex vertices as combat, including holes.
let singleOutline=wcGridOutline(new Set(['0,0']));assert.equal(singleOutline.length,1);assert.equal(singleOutline[0].length,6);
let adjacentOutline=wcGridOutline(new Set(['0,0','1,0']));assert.equal(adjacentOutline.length,1);assert.equal(adjacentOutline[0].length,10);
let ringOutline=wcGridOutline(new Set(wcNeighbors('0,0')));assert.equal(ringOutline.length,2);
let region=wcScenarioGrid();assert(region.keys.size>1000);assert([...region.keys].every(k=>wcBase(k)==='RU'));for(let loop of region.loops)for(let p of loop){assert(Math.abs(p[0]/(WC_WIDTH/2)-Math.round(p[0]/(WC_WIDTH/2)))<1e-7);assert(Math.abs(p[1]/(WC_RADIUS/2)-Math.round(p[1]/(WC_RADIUS/2)))<1e-7);}
assert.equal(wcTerritoryColor('RU','RU'),color('RU'));assert.notEqual(wcTerritoryColor('UA','RU'),color('RU'));assert.equal(wcTerritoryColor('UA','RU'),wcOccupationColor('RU'));assert.equal(wcTerritoryColor('UA','UA'),color('UA'));
// Non-adjacent countries use one beachhead rather than mirrored landings.
let sea=wcCreateWar('PT','IS');assert(sea.landing&&sea.supply<1);assert.equal(wcOwner(sea.landing,sea),'IS');
// Autonomous elections, proposals and long-running budgets remain functional.
document.querySelector('.mode.active').dataset.mode='free';start();state.countries.DE.ai.approval=1;state.countries.DE.ai.election=1;advance();assert(state.countries.DE.ai.agenda.startsWith('New cabinet:'));simOffer('DE','trade');simAcceptOffer('DE');assert(nation().trades.includes('DE'));assert(state.countries.DE.trades.includes('LV'));
for(let i=0;i<60;i++){if(state.ended)break;advance();for(let n of Object.values(state.countries))assert(Number.isFinite(n.gdp)&&n.gdp>0&&n.treasury>=0&&n.morale>=0&&n.morale<=100);}
for(let c in world){let loops=wcCountryLoops(c);assert(loops.length>0,'Grid representation for '+c);for(let loop of loops)for(let p of loop){assert(Math.abs(p[0]/(WC_WIDTH/2)-Math.round(p[0]/(WC_WIDTH/2)))<1e-7);assert(Math.abs(p[1]/(WC_RADIUS/2)-Math.round(p[1]/(WC_RADIUS/2)))<1e-7);}}
console.log('PASS: all country borders and microstates;  grid-aligned occupation outlines, holes, occupied/liberated palette; one shared front, fine connected sectors, counterattack priority, three-turn initiative, city morale/cooldown, saves/ceasefires, both legacy migrations, active Ukraine war, AI and long-run economy.');
`,sandbox);

if(process.env.EXPORT_BORDERS){let grid=vm.runInContext(`({radius:WC_RADIUS,countries:Object.fromEntries(Object.keys(world).map(c=>[c,wcCountryLoops(c).map(loop=>{let points=loop.map(p=>[Math.round(p[0]/(WC_WIDTH/2)),Math.round(p[1]/(WC_RADIUS/2))]);let steps=points.map((p,i)=>{let next=points[(i+1)%points.length],code=WC_CORNERS.findIndex(d=>d[0]===next[0]-p[0]&&d[1]===next[1]-p[1]);if(code<0)throw Error('Invalid grid edge');return code;}).join('');return [...points[0],steps];})]))})`,sandbox);fs.writeFileSync('dist/borders-grid.json',JSON.stringify(grid));console.log('Exported compact country grid outlines');}
