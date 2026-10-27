'use strict';
// One exclusive controller per small hex. Armies move the existing shared front.
const WC_RADIUS=.016,WC_WIDTH=Math.sqrt(3)*WC_RADIUS*1.5,WC_HEIGHT=1.5*WC_RADIUS;
const WC_DIRS=[[1,0],[-1,0],[0,1],[0,-1],[1,-1],[-1,1]];
let wcLegalCache=new Map(),wcShapeCache=null,wcCityCache=null;
function wcPoint(key){let [q,r]=key.split(',').map(Number);return[WC_WIDTH*(q+r/2),WC_HEIGHT*r];}
function wcKey(lon,lat){let rf=lat/WC_HEIGHT,qf=lon/WC_WIDTH-rf/2,sf=-qf-rf,q=Math.round(qf),r=Math.round(rf),s=Math.round(sf),dq=Math.abs(q-qf),dr=Math.abs(r-rf),ds=Math.abs(s-sf);if(dq>dr&&dq>ds)q=-r-s;else if(dr>ds)r=-q-s;return q+','+r;}
function wcNeighbors(key){let [q,r]=key.split(',').map(Number);return WC_DIRS.map(([dq,dr])=>(q+dq)+','+(r+dr));}
function wcBounds(r){return[Math.min(...r.map(p=>p[0])),Math.min(...r.map(p=>p[1])),Math.max(...r.map(p=>p[0])),Math.max(...r.map(p=>p[1]))];}
function wcInBounds(p,b,margin=0){return p[0]>=b[0]-margin&&p[0]<=b[2]+margin&&p[1]>=b[1]-margin&&p[1]<=b[3]+margin;}
function wcShapes(){if(!wcShapeCache){wcShapeCache={};for(let c in world)wcShapeCache[c]=rings(world[c].feature).map(poly=>({poly,b:wcBounds(poly[0])}));}return wcShapeCache;}
function wcContains(p,c){return wcShapes()[c]?.some(({poly,b})=>wcInBounds(p,b)&&insideRing(p,poly[0])&&!poly.slice(1).some(r=>insideRing(p,r)));}
let wcMicroCells=null;
function wcMicrostates(){if(wcMicroCells)return wcMicroCells;wcMicroCells=new Map();for(let c of ['VA','MC','SM','LI','AD']){if(!world[c])continue;let key=wcKey(...world[c].center),near=[key,...wcNeighbors(key)];if(!near.some(k=>wcContains(wcPoint(k),c)))wcMicroCells.set(key,c);}return wcMicroCells;}
function wcLegal(key,w){let micro=wcMicrostates().get(key);if(micro)return micro;if(wcLegalCache.has(key))return wcLegalCache.get(key);let p=wcPoint(key),c=Object.keys(world).find(c=>wcContains(p,c))||null;wcLegalCache.set(key,c);return c;}
function wcRoot(c){if(!state)return c;let seen=new Set();while(c&&state.countries[c]?.owner!==c&&!seen.has(c)){seen.add(c);c=state.countries[c]?.owner;}return c;}
function wcBase(key,w){let geographic=wcLegal(key,w),c=state.titles?.[key]||geographic;if(!c)return null;let owner=wcRoot(c);if(owner!==c)return owner;if(c==='UA'&&state.mode==='control'&&occupationData&&inside(wcPoint(key),occupationData))return'RU';return c;}
function wcOwner(key,w){return wcRoot(state.control?.[key]||wcBase(key,w));}
function wcSetOwner(key,c,w){if(c===wcBase(key,w))delete state.control[key];else state.control[key]=c;}
function wcFind(a,b,includePeace=false){return state.wars.find(w=>w.shared&&[w.a,w.b].includes(a)&&[w.a,w.b].includes(b)&&a!==b&&(includePeace||w.active));}
function wcUkraine(){return state.wars.find(w=>w.shared&&w.scenario);}
function wcOpposing(key,w){let owner=wcOwner(key,w);return [w.a,w.b].includes(owner)&&wcNeighbors(key).some(k=>[w.a,w.b].includes(wcOwner(k,w))&&wcOwner(k,w)!==owner);}
function wcBoundaryKeys(feature,other){let keys=new Set();let bounds=other?wcBounds(rings(other).flatMap(p=>p[0])):null;for(let poly of rings(feature))for(let ring of poly){for(let i=1;i<ring.length;i++){let a=ring[i-1],b=ring[i];if(bounds&&!wcInBounds(a,bounds,.15)&&!wcInBounds(b,bounds,.15))continue;let n=Math.max(1,Math.ceil(Math.max(Math.abs(b[0]-a[0])/WC_WIDTH,Math.abs(b[1]-a[1])/WC_HEIGHT)*2));for(let j=0;j<=n;j++)keys.add(wcKey(a[0]+(b[0]-a[0])*j/n,a[1]+(b[1]-a[1])*j/n));}}return keys;}
function wcSeed(w){let keys=wcBoundaryKeys(world[w.a].feature,world[w.b].feature);if(w.scenario)for(let k of wcBoundaryKeys(occupationData))keys.add(k);for(let k of Object.keys(state.control))if([w.a,w.b].includes(wcOwner(k,w)))keys.add(k);let band=new Set(keys);for(let k of keys)for(let n of wcNeighbors(k))band.add(n);w.frontier=[...band].filter(k=>wcOpposing(k,w));if(!w.frontier.length&&!w.scenario)wcLanding(w);}
function wcLanding(w){
 // One supplied beachhead when there is no land contact; no mirrored overseas invasion.
 let own=rings(world[w.a].feature).flatMap(p=>p[0]),enemy=rings(world[w.b].feature).flatMap(p=>p[0]),best=null;
 let stride=Math.max(1,Math.floor(enemy.length/400)),ownStride=Math.max(1,Math.floor(own.length/400));
 for(let i=0;i<enemy.length;i+=stride){let p=enemy[i],d=Infinity;for(let j=0;j<own.length;j+=ownStride)d=Math.min(d,(p[0]-own[j][0])**2*.4+(p[1]-own[j][1])**2);if(!best||d<best.d)best={p,d};}
 if(!best)return;let nearby=new Set([wcKey(...best.p)]);for(let pass=0;pass<3;pass++)for(let k of [...nearby])for(let n of wcNeighbors(k))nearby.add(n);
 let key=[...nearby].filter(k=>wcLegal(k,w)===w.b).sort((a,b)=>{let x=wcPoint(a),y=wcPoint(b);return(x[0]-best.p[0])**2+(x[1]-best.p[1])**2-((y[0]-best.p[0])**2+(y[1]-best.p[1])**2);})[0];
 if(key){w.landing=key;w.frontier=[key,...wcNeighbors(key)];w.supply=.38;}
}
function wcCreateWar(a,b,options={}){
 let w={id:'war_'+a+'_'+b+'_'+state.turn,shared:true,a,b,initiator:a,active:true,months:0,startedTurn:state.turn,postures:{[a]:'balanced',[b]:'balanced'},fatigue:{[a]:0,[b]:0},support:0,frontier:[],last:{winner:null,cells:0,cities:[]},capitalHolds:{},...options};
 wcSeed(w);return w;
}
function wcLegacyHex(p,radius){return Array.from({length:6},(_,k)=>{let a=(60*k+30)*Math.PI/180;return[p[0]+radius*1.5*Math.cos(a),p[1]+radius*Math.sin(a)];});}
function wcImportOldFront(old){if(!old?.owners)return;let g=simGrid();for(let i=0;i<old.owners.length;i++){if(old.owners[i]===g.initial[i]||!g.cells[i])continue;let p=g.cells[i],poly=wcLegacyHex(p,g.radius),minRow=Math.floor((p[1]-g.radius)/WC_HEIGHT),maxRow=Math.ceil((p[1]+g.radius)/WC_HEIGHT);for(let r=minRow;r<=maxRow;r++){let q0=Math.floor((p[0]-g.radius*1.5)/WC_WIDTH-r/2),q1=Math.ceil((p[0]+g.radius*1.5)/WC_WIDTH-r/2);for(let q=q0;q<=q1;q++){let key=q+','+r,point=wcPoint(key);if(insideRing(point,poly)&&wcLegal(key)==='UA')wcSetOwner(key,old.owners[i]?'RU':'UA');}}}}
function wcEnsureWorld(){
 state.control??={};ptEnsure();for(let c in state.countries)state.countries[c].morale??=65;
 if(state.warfare!==3){let old=state.front,oldWars=state.wars||[],pairs=new Set();state.wars=[];
  if(state.mode==='control'){
   wcImportOldFront(old);let w=wcCreateWar('RU','UA',{scenario:true,months:old?.months??56,active:old?.active??true,snapshot:occupationData.properties.snapshot_date,support:old?.support||0});
   if(old?.postures)w.postures=old.postures;if(old?.fatigue)w.fatigue=old.fatigue;state.wars.push(w);simSetRelation('RU','UA',-100);
  }
  for(let previous of oldWars){let pair=[previous.a,previous.b].sort().join(':');if(pairs.has(pair)||(state.mode==='control'&&['RU','UA'].every(c=>[previous.a,previous.b].includes(c))))continue;pairs.add(pair);
   if(previous.shared){state.wars.push(previous);continue;}
   let w=wcCreateWar(previous.a,previous.b,{months:Math.max(3,state.turn),migrated:true});w.postures[previous.a]=previous.stance||'balanced';state.wars.push(w);
  }
  if(pairs.size)log('Warfare upgraded: old mirrored campaigns restart on one shared border. Your economy, forces and political progress are preserved.',true);
  state.warfare=3;
 }
 // A non-serialized convenience alias keeps the rest of the world AI using the same war object.
 let descriptor=Object.getOwnPropertyDescriptor(state,'front');if(!descriptor?.get){delete state.front;Object.defineProperty(state,'front',{enumerable:false,configurable:true,get:wcUkraine});}
 for(let w of state.wars){w.last??={winner:null,cells:0,cities:[]};w.capitalHolds??={};}
 wcCities();
}
function wcCityShare(country,population){return population/Math.max(1,(state?.countries[country]?.pop??profile[country]?.[1]??1)*1000000);}
function wcCityBonus(city){if(city.capital)return 10;let share=wcCityShare(city.home,city.population);return share>=.05?7:share>=.02?4:share>=.01?2:0;}
function wcCities(){if(!wcCityCache){wcCityCache=places.filter(p=>p[5]||wcCityShare(p[4],p[3])>=.01).map(p=>({id:p[4]+':'+p[0]+':'+p[1],name:p[0],home:p[4],population:p[3],capital:p[5],key:wcKey(p[1],p[2]),point:[p[1],p[2]]}));}return wcCityCache;}
function wcCityOwner(city){if(state.titles?.[city.key])return wcOwner(city.key);if(state.control[city.key])return wcRoot(state.control[city.key]);let c=wcRoot(city.home);if(c==='UA'&&state.mode==='control'&&inside(wcPoint(city.key),occupationData))return'RU';return c;}
function wcOpening(w,c){return !w.scenario&&w.initiator===c&&w.months<3?1.25:1;}
function wcPower(w,c){let n=state.countries[c],other=c===w.a?w.b:w.a,stance=w.postures[c],approval=c===state.player?state.approval:n.ai?.approval??58;
 let base=strength(c)+(c===w.b?coalition(c,other):0),morale=.6+n.morale/100*.8,fatigue=clamp(1-w.fatigue[c]*.003,.55,1),politics=.85+approval/400,solvency=clamp(1-Math.max(0,n.debt/n.gdp-1)*.08,.65,1);
 return Math.sqrt(Math.max(.1,base))*morale*fatigue*politics*solvency*(stance==='offensive'?1.18:stance==='defensive'?.97:1)*wcOpening(w,c)*(w.scenario&&c==='UA'?1.23+w.support*.18:1);
}
function wcMood(c,delta){let n=state.countries[c];n.morale=clamp(n.morale+delta,0,100);if(c===state.player)state.approval=clamp(state.approval+delta*.35,0,100);else if(n.ai)n.ai.approval=clamp(n.ai.approval+delta*.35,0,100);}
function wcCityChanges(w,before){state.cityMorale??={};w.last.cities=[];for(let city of wcCities()){
 let from=before[city.id],to=wcCityOwner(city);if(from===to||!from||!to||![w.a,w.b].includes(from)||![w.a,w.b].includes(to))continue;
 let bonus=wcCityBonus(city),cooled=state.turn-(state.cityMorale[city.id]??-100)>=6;
 if(cooled){wcMood(to,bonus);wcMood(from,-bonus);state.cityMorale[city.id]=state.turn;w.fatigue[from]=clamp(w.fatigue[from]+2,0,100);}
 w.last.cities.push(city.name);log(`${name(to)} ${to===city.home?'liberated':'captured'} ${city.name}${city.capital?' (capital)':''}.${cooled?` Morale: ${name(to)} +${bonus}, ${name(from)} −${bonus}.`:' Morale effects are on cooldown after recent fighting.'}`,true);
}}
function wcAdvanceWar(w){
 if(!w.active)return;let beforeCities=Object.fromEntries(wcCities().map(c=>[c.id,wcCityOwner(c)]));
 let pa=wcPower(w,w.a),pb=wcPower(w,w.b),noise=(simRandom()-.5)*.22,delta=Math.log(pa/Math.max(.1,pb))+noise;
 let winner=delta>=0?w.a:w.b,loser=winner===w.a?w.b:w.a,ratio=winner===w.a?pa/pb:pb/pa;
 w.last={winner:null,cells:0,cities:[]};
 if(Math.abs(delta)>.035&&!(Math.abs(delta)<.15&&simRandom()<.35)){
  let frontier=new Set(w.frontier),candidateKeys=()=>[...frontier].filter(k=>wcOwner(k,w)===loser&&(wcNeighbors(k).some(n=>wcOwner(n,w)===winner)||(w.landing===k&&winner===w.a)));
  let pool=candidateKeys(),budget=clamp(Math.round(Math.max(10,w.frontier.length)*(w.scenario?.012:.12)*Math.pow(ratio,.7)*(w.supply||1)),1,900);
  if(w.postures[loser]==='defensive')budget=Math.max(1,Math.round(budget*.72));
  // Recapture lost home territory before opening a second invasion across the legal border.
  let queue=[],seen=new Set(),used=0,homePriority=false;
  while(used<budget){
   if(!queue.length){pool=candidateKeys().filter(k=>!seen.has(k));if(!pool.length)break;let home=pool.filter(k=>wcLegal(k,w)===winner);homePriority=home.length>0;if(homePriority)pool=home;
    let seed=pool.map(k=>({k,score:wcNeighbors(k).filter(n=>wcOwner(n,w)===winner).length+simRandom()})).sort((a,b)=>b.score-a.score)[0].k;queue.push(seed);
   }
   let key=queue.shift();if(seen.has(key))continue;seen.add(key);if(wcOwner(key,w)!==loser||(!wcNeighbors(key).some(k=>wcOwner(k,w)===winner)&&!(w.landing===key&&winner===w.a)))continue;
   // If a counterattack has reached home soil, do not bypass it for foreign land.
   if(homePriority&&wcLegal(key,w)!==winner)continue;
   wcSetOwner(key,winner,w);used++;frontier.add(key);for(let k of wcNeighbors(key)){frontier.add(k);if(wcOwner(k,w)===loser&&!seen.has(k))queue.push(k);}
  }
  w.frontier=[...frontier].filter(k=>wcOpposing(k,w));w.last.winner=used?winner:null;w.last.cells=used;
 }
 for(let c of [w.a,w.b]){let n=state.countries[c],off=w.postures[c]==='offensive';n.force=Math.max(.5,n.force*(off?.994:.997));n.ready=clamp(n.ready-(off?1.1:.5),20,100);w.fatigue[c]=clamp(w.fatigue[c]+(off?.65:.35),0,100);n.morale=clamp(n.morale-(off?.18:.08),0,100);}
 wcCityChanges(w,beforeCities);w.months++;w.support*=.94;
 if(w.last.cells)log(`${name(w.last.winner)} advanced ${w.last.cells} small sectors on the ${name(w.a)}–${name(w.b)} front${w.months<=3&&!w.scenario?' during the opening phase':''}.`,true);else if(state.turn%3===0)log(`The ${name(w.a)}–${name(w.b)} front held this month.`,true);
 wcCapitulation(w);
}
function wcCapitulation(w){for(let c of [w.a,w.b]){let capital=wcCities().find(city=>city.home===c&&city.capital),other=c===w.a?w.b:w.a;if(!capital)continue;w.capitalHolds[c]=wcCityOwner(capital)===other?(w.capitalHolds[c]||0)+1:0;
 if(w.months>=4&&w.capitalHolds[c]>=3&&(state.countries[c].morale<35||strength(c)<strength(other)*.1)){state.countries[c].owner=other;for(let conflict of state.wars)if([conflict.a,conflict.b].includes(c))conflict.active=false;log(`${name(c)} capitulated after losing its capital and military cohesion.`,true);if(c===state.player){state.ended=true;clearInterval(timer);timer=null;info('Government displaced','<p>Your capital has fallen and your government has capitulated.</p>');}}}}
function wcAdvanceAll(){for(let c in state.countries){let n=state.countries[c],approval=c===state.player?state.approval:n.ai?.approval??58;n.morale=clamp(n.morale+(65-n.morale)*.025+(approval-50)*.002,0,100);}for(let w of state.wars)wcAdvanceWar(w);if(wcLegalCache.size>180000)wcLegalCache.clear();}
function wcHexPath(key){let p=wcPoint(key);for(let k=0;k<6;k++){let a=(60*k+30)*Math.PI/180,q=screen(p[0]+WC_RADIUS*1.5*Math.cos(a),p[1]+WC_RADIUS*Math.sin(a));k?ctx.lineTo(...q):ctx.moveTo(...q);}ctx.closePath();}
// Cached geometry is derived from the very same controller cells used by combat.
let wcScenarioGridCache=null;
const WC_CORNERS=[[1,1],[0,2],[-1,1],[-1,-1],[0,-2],[1,-1]];
const WC_EDGES=[[5,0],[2,3],[0,1],[3,4],[4,5],[1,2]];
function wcGridOutline(keys){
 let edges=new Map();
 for(let key of keys){let [q,r]=key.split(',').map(Number);for(let i=0;i<WC_DIRS.length;i++){
  let [dq,dr]=WC_DIRS[i];if(keys.has((q+dq)+','+(r+dr)))continue;
  let [start,end]=WC_EDGES[i].map(c=>{let [x,y]=WC_CORNERS[c];return (2*q+r+x)+','+(3*r+y);});edges.set(start,end);
 }}
 let loops=[];
 while(edges.size){let start=edges.keys().next().value,current=start,loop=[];
  do{let [x,y]=current.split(',').map(Number);loop.push([x*WC_WIDTH/2,y*WC_RADIUS/2]);let next=edges.get(current);edges.delete(current);current=next;}while(current&&current!==start);
  if(current!==start)throw Error('Occupation grid outline did not close');
  if(loop.length>=3)loops.push(loop);
 }
 return loops;
}
// Only sample the boundary band; do not rasterize entire large countries.
let wcCountryBorderCache=new Map();
function wcCountryLoops(code){
 if(wcCountryBorderCache.has(code))return wcCountryBorderCache.get(code);
 let keys=wcBoundaryKeys(world[code].feature);for(let other in world)if(other!==code)for(let k of wcBoundaryKeys(world[other].feature,world[code].feature))keys.add(k);let band=new Set(keys),edges=new Map();for(let [key,c] of wcMicrostates())if(c===code||wcContains(wcPoint(key),code)){keys.add(key);band.add(key);}
 for(let key of keys)for(let n of wcNeighbors(key))band.add(n);
 for(let key of band){if(wcLegal(key,{a:code,b:code})!==code)continue;let [q,r]=key.split(',').map(Number);
  for(let i=0;i<WC_DIRS.length;i++){let [dq,dr]=WC_DIRS[i];if(wcLegal((q+dq)+','+(r+dr),{a:code,b:code})===code)continue;
   let [start,end]=WC_EDGES[i].map(c=>{let [x,y]=WC_CORNERS[c];return(2*q+r+x)+','+(3*r+y);});edges.set(start,end);
  }
 }
 let loops=[];
 while(edges.size){let start=edges.keys().next().value,current=start,loop=[];
  do{let [x,y]=current.split(',').map(Number);loop.push([x*WC_WIDTH/2,y*WC_RADIUS/2]);let next=edges.get(current);edges.delete(current);current=next;}while(current&&current!==start);
  if(current!==start)throw Error('Country grid border did not close: '+code);
  if(loop.length>=3)loops.push(loop);
 }
 wcCountryBorderCache.set(code,loops);return loops;
}
function wcLoadBorders(data){if(data.radius!==WC_RADIUS)throw Error('Border grid version mismatch');for(let c in data.countries){let loops=data.countries[c].map(([x,y,steps])=>{let points=[[x*WC_WIDTH/2,y*WC_RADIUS/2]];for(let i=0;i<steps.length-1;i++){let [dx,dy]=WC_CORNERS[Number(steps[i])];x+=dx;y+=dy;points.push([x*WC_WIDTH/2,y*WC_RADIUS/2]);}return points;});wcCountryBorderCache.set(c,loops);}}
function wcCountryPath(code){ctx.beginPath();for(let loop of wcCountryLoops(code)){loop.forEach((p,i)=>{let q=screen(...p);i?ctx.lineTo(...q):ctx.moveTo(...q);});ctx.closePath();}}
function wcScenarioGrid(){
 if(wcScenarioGridCache)return wcScenarioGridCache;
 let bounds=wcBounds(rings(occupationData).flatMap(p=>p[0])),keys=new Set();
 for(let r=Math.floor(bounds[1]/WC_HEIGHT)-1;r<=Math.ceil(bounds[3]/WC_HEIGHT)+1;r++){
  let minQ=Math.floor(bounds[0]/WC_WIDTH-r/2)-1,maxQ=Math.ceil(bounds[2]/WC_WIDTH-r/2)+1;
  for(let q=minQ;q<=maxQ;q++){let key=q+','+r,p=wcPoint(key);if(inside(p,occupationData)&&wcLegal(key,{a:'UA',b:'RU'})==='UA')keys.add(key);}
 }
 return wcScenarioGridCache={keys,loops:wcGridOutline(keys)};
}
function wcOccupationColor(owner){
 let hex=color(owner).slice(1);return '#'+[0,2,4].map(i=>Math.round(parseInt(hex.slice(i,i+2),16)*.66).toString(16).padStart(2,'0')).join('');
}
function wcTerritoryColor(legal,owner){return owner===legal?color(legal):wcOccupationColor(owner);}
function wcDrawScenario(){
 if(state.mode!=='control'||wcRoot('UA')!=='UA')return;
 let region=wcScenarioGrid();ctx.save();path(world.UA.feature);ctx.clip('evenodd');ctx.fillStyle=wcOccupationColor('RU');ctx.beginPath();
 for(let loop of region.loops){loop.forEach((p,i)=>{let point=screen(...p);i?ctx.lineTo(...point):ctx.moveTo(...point);});ctx.closePath();}
 ctx.fill('evenodd');ctx.restore();
}
function wcDraw(){
 wcDrawScenario();
 let groups={};for(let key of new Set([...Object.keys(state.control),...Object.keys(state.titles||{})])){let legal=wcLegal(key);if(!legal||(!state.titles?.[key]&&state.control[key]===wcBase(key)))continue;let p=screen(...wcPoint(key));if(p[0]<-15||p[0]>W+15||p[1]<-15||p[1]>H+15)continue;(groups[legal]??=[]).push(key);}
 for(let c in groups){ctx.save();path(world[c].feature);ctx.clip('evenodd');let owners={};for(let key of groups[c])(owners[wcOwner(key)]??=[]).push(key);for(let owner in owners){let sovereignGroups={};for(let key of owners[owner])(sovereignGroups[ptSovereign(key)]??=[]).push(key);for(let sovereign in sovereignGroups){ctx.fillStyle=wcTerritoryColor(sovereign,owner);ctx.beginPath();for(let key of sovereignGroups[sovereign])wcHexPath(key);ctx.fill();}}ctx.restore();}
 ctx.strokeStyle='#f1d1a0';ctx.lineWidth=1.15;ctx.beginPath();for(let w of state.wars){if(!w.active)continue;for(let key of w.frontier){if(wcOwner(key,w)!==w.a)continue;let p=wcPoint(key);for(let [dq,dr] of WC_DIRS){let [q,r]=key.split(',').map(Number),neighbor=(q+dq)+','+(r+dr);if(wcOwner(neighbor,w)!==w.b)continue;let angle=Math.atan2(1.5*dr,Math.sqrt(3)*(dq+dr/2));for(let sign of [-1,1]){let a=angle+sign*Math.PI/6,point=screen(p[0]+WC_RADIUS*1.5*Math.cos(a),p[1]+WC_RADIUS*Math.sin(a));sign===-1?ctx.moveTo(...point):ctx.lineTo(...point);}}}}ctx.stroke();
}
let wcAreaCache=new Map();
function wcCountryArea(code){if(wcAreaCache.has(code))return wcAreaCache.get(code);let area=0,rad=Math.PI/180;for(let loop of wcCountryLoops(code))for(let i=0,j=loop.length-1;i<loop.length;j=i++)area+=(loop[i][0]-loop[j][0])*rad*(Math.sin(loop[i][1]*rad)+Math.sin(loop[j][1]*rad));area=Math.abs(area);wcAreaCache.set(code,area);return area;}
function wcTerritoryStats(w){let lost={[w.a]:0,[w.b]:0},keys=new Set([...Object.keys(state.control),...Object.keys(state.titles||{})]);if(w.scenario&&state.mode==='control')for(let key of wcScenarioGrid().keys)keys.add(key);let rad=Math.PI/180;
 for(let key of keys){let legal=wcLegal(key),owner=wcOwner(key);if(legal===w.a&&owner===w.b||legal===w.b&&owner===w.a)lost[legal]+=2*WC_WIDTH*WC_HEIGHT*rad*rad*Math.cos(wcPoint(key)[1]*rad);}
 let percent={};for(let c of [w.a,w.b]){let other=c===w.a?w.b:w.a;percent[c]=wcRoot(c)===other?100:clamp(100*lost[c]/Math.max(1e-12,wcCountryArea(c)),0,100);}return{aHoldsB:percent[w.b],bHoldsA:percent[w.a]};}
function wcPercent(value){return value>0&&value<.01?'<0.01%':value.toFixed(value<1?2:1)+'%';}
function wcTerritorySummary(w){let t=wcTerritoryStats(w),mine=[w.a,w.b].includes(state.player),rows=[];if(mine){let other=state.player===w.a?w.b:w.a;rows=[['Taken from '+name(other),state.player===w.a?t.aHoldsB:t.bHoldsA],['Lost to '+name(other),state.player===w.a?t.bHoldsA:t.aHoldsB]];}else rows=[[name(w.b)+' held by '+name(w.a),t.aHoldsB],[name(w.a)+' held by '+name(w.b),t.bHoldsA]];return rows.map(([label,value])=>'<div class="row"><small>'+label+'</small><b>'+wcPercent(value)+'</b></div>').join('')+'<p class="note">Net current control, relative to each country’s original area. Recaptures reduce these totals.</p>';}

function wcCard(w){let mine=[w.a,w.b].includes(state.player),last=w.last;return `<div class="card"><b>${name(w.a)} ↔ ${name(w.b)}</b><p>${w.active?'Active shared front':'Ceasefire'} · ${w.months} ${w.months===1?'month':'months'}</p>${wcTerritorySummary(w)}<p>${last.winner?`${name(last.winner)} advanced ${last.cells} sectors last month.`:'The line of control is holding.'}</p>${!w.scenario&&w.months<3?`<p class="positive">${name(w.initiator)}: +25% opening initiative · ${3-w.months} turns left</p>`:''}<p>Morale: ${name(w.a)} ${Math.round(state.countries[w.a].morale)}% · ${name(w.b)} ${Math.round(state.countries[w.b].morale)}%</p>${mine&&w.active?`<label class="row">Front posture<select aria-label="Campaign posture" data-war-posture="${w.id}">${['balanced','offensive','defensive'].map(p=>`<option ${w.postures[state.player]===p?'selected':''}>${p}</option>`).join('')}</select></label>`:''}<p class="note">Small shared hex sectors. Cities with 1%+ of their home population affect morale: +2 at 1%, +4 at 2%, +7 at 5%; capitals +10. Ceasefires preserve control.</p></div>`;}
function wcPeace(w){if(!w?.active)return false;let other=state.player===w.a?w.b:w.a;if(w.months<6&&w.fatigue[other]<15){notify('Ceasefire rejected. The opponent still expects military gains.');return true;}w.active=false;log(`Ceasefire agreed between ${name(w.a)} and ${name(w.b)}. The current line of control is frozen.`,true);return true;}
