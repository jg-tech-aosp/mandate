'use strict';

// National accounts use illustrative euro-bn flows. Industrial capacities,
// demand, inventories, and trade all share those units.
const ECONOMY_SCHEMA=1;
const ECONOMY_GOODS=['food','energy','materials','manufacturing','military'];
const ECONOMY_DEMAND={food:.10,energy:.08,materials:.10,manufacturing:.18,military:.015};
const ECONOMY_CAPITAL_EFFICIENCY=.15;
const ECONOMY_INPUT_ENERGY=.12,ECONOMY_INPUT_MATERIALS=.10;

function econClamp(value,min,max){return Math.max(min,Math.min(max,value));}
function econSanctionCount(c){return Object.values(state.countries).reduce((sum,n)=>sum+(n.code!==c&&n.sanctions?.includes(c)?1:0),0);}
function econShares(n){
 let affluence=econClamp(Math.log1p((n.gdp||1)/Math.max(.01,n.pop||1))/Math.log(101),0,1);
 let forceIntensity=econClamp((n.force||0)/Math.max(1,(n.gdp||1)*.15),0,2)/2;
 let food=.14-.05*affluence,energy=.08+.01*forceIntensity,materials=.10+.02*(1-affluence);
 let manufacturing=.19+.015*affluence+.02*forceIntensity,military=.015+.02*forceIntensity;
 return{food,energy,materials,manufacturing,military,services:Math.max(.1,1-food-energy-materials-manufacturing-military)};
}
function econEnsureCountry(n){
 n.economy??={};
 let e=n.economy,shares=e.shares||econShares(n);
 e.schema=ECONOMY_SCHEMA;e.shares=shares;
 e.capacity=e.capacity||Object.fromEntries(Object.entries(shares).map(([k,v])=>[k,(n.gdp||1)*v]));
 for(let sector of [...ECONOMY_GOODS,'services'])e.capacity[sector]=Math.max(.001,Number(e.capacity[sector])||((n.gdp||1)*shares[sector]));
 e.inventory=e.inventory||Object.fromEntries(ECONOMY_GOODS.map(s=>[s,(n.gdp||1)*ECONOMY_DEMAND[s]*2/12]));
 for(let s of ECONOMY_GOODS)e.inventory[s]=Math.max(0,Number(e.inventory[s])||0);
 e.confidence=econClamp(Number.isFinite(e.confidence)?e.confidence:60,0,100);
 e.pendingInvestment=Math.max(0,Number(e.pendingInvestment)||0);
 e.factories=Math.max(0,Number(e.capacity.manufacturing)||0);
 e.lastMonth=e.lastMonth||{production:0,imports:0,exports:0,shortage:0,investment:0,utilization:.9,importsBySector:{},exportsBySector:{}};
}
function econEnsure(){
 if(!state?.countries)return;
 for(let n of Object.values(state.countries))econEnsureCountry(n);
}
function econStatement(n){
 let revenue=n.gdp*n.tax/100/12;
 let war=state.wars.filter(w=>w.active&&(w.a===n.code||w.b===n.code)).length;
 let base=n.gdp*(n.health+n.education+n.defense+n.infra+7)/100/12;
 let warCost=war*n.gdp*.0015,mobilization=n.mobilized?n.gdp*.0007:0,interest=n.debt*.035/12;
 let spend=base+warCost+mobilization+interest+(n.economy?.maintenance||0);
 return{revenue,spend,net:revenue-spend,base,war:warCost,mobilization,interest};
}
function econFundInvestment(n,amount){
 econEnsureCountry(n);let value=Math.max(0,Number(amount)||0);
 n.economy.pendingInvestment+=value;
 n.economy.confidence=econClamp(n.economy.confidence+Math.min(2,value/Math.max(1,n.gdp)*100),0,100);
}
function econSupply(n){
 let e=n.economy,capacity=e.capacity,utilization=econClamp(.88+(e.confidence-50)*.0015,.75,.98),output={};
 for(let s of [...ECONOMY_GOODS,'services'])output[s]=capacity[s]/12*utilization;
 let energyAvailable=e.inventory.energy+output.energy,materialsAvailable=e.inventory.materials+output.materials;
 let inputEnergy=(output.manufacturing+output.military)*ECONOMY_INPUT_ENERGY;
 let inputMaterials=(output.manufacturing+output.military)*ECONOMY_INPUT_MATERIALS;
 let inputFactor=Math.min(1,energyAvailable/Math.max(.0001,inputEnergy),materialsAvailable/Math.max(.0001,inputMaterials));
 output.manufacturing*=inputFactor;output.military*=inputFactor;
 let usedEnergy=(output.manufacturing+output.military)*ECONOMY_INPUT_ENERGY;
 let usedMaterials=(output.manufacturing+output.military)*ECONOMY_INPUT_MATERIALS;
 let stock=Object.fromEntries(ECONOMY_GOODS.map(s=>[s,e.inventory[s]+output[s]-(s==='energy'?usedEnergy:s==='materials'?usedMaterials:0)]));
 let demand=Object.fromEntries(ECONOMY_GOODS.map(s=>[s,n.gdp*ECONOMY_DEMAND[s]/12]));
 return{output,stock,demand,utilization,usedEnergy,usedMaterials};
}
function econTradeMarkets(){
 let countries=Object.keys(state.countries).sort(),market={};
 for(let c of countries){
  let n=state.countries[c],supply=econSupply(n),e=n.economy;
  market[c]={supply,stock:{...supply.stock},imports:Object.fromEntries(ECONOMY_GOODS.map(s=>[s,0])),exports:Object.fromEntries(ECONOMY_GOODS.map(s=>[s,0]))};
 }
 for(let i=0;i<countries.length;i++)for(let j=i+1;j<countries.length;j++){
  let a=countries[i],b=countries[j],na=state.countries[a],nb=state.countries[b];
  if(!(na.trades?.includes(b)&&nb.trades?.includes(a)))continue;
  if(na.sanctions?.includes(b)||nb.sanctions?.includes(a))continue;
  let pressure=Math.min(.9,(econSanctionCount(a)+econSanctionCount(b))*.12),allowed=1-pressure;
  let ma=market[a],mb=market[b];
  for(let sector of ECONOMY_GOODS){
   let reserveA=ma.supply.demand[sector]*2,reserveB=mb.supply.demand[sector]*2;
   let surplusA=Math.max(0,ma.stock[sector]-ma.supply.demand[sector]-reserveA);
   let shortageA=Math.max(0,ma.supply.demand[sector]+reserveA-ma.stock[sector]);
   let surplusB=Math.max(0,mb.stock[sector]-mb.supply.demand[sector]-reserveB);
   let shortageB=Math.max(0,mb.supply.demand[sector]+reserveB-mb.stock[sector]);
   let flowAB=Math.min(surplusA,shortageB)*allowed,flowBA=Math.min(surplusB,shortageA)*allowed;
   if(flowAB>0){ma.stock[sector]-=flowAB;mb.stock[sector]+=flowAB;ma.exports[sector]+=flowAB;mb.imports[sector]+=flowAB;}
   if(flowBA>0){mb.stock[sector]-=flowBA;ma.stock[sector]+=flowBA;mb.exports[sector]+=flowBA;ma.imports[sector]+=flowBA;}
  }
 }
 return market;
}
function econAdvanceAll(){
 if(!state)return;
 econEnsure();
 let market=econTradeMarkets();
 for(let c of Object.keys(state.countries)){
  let n=state.countries[c],e=n.economy,m=market[c],oldGDP=Math.max(.01,n.gdp),statement=econStatement(n);
  let production=Object.values(m.supply.output).reduce((a,b)=>a+b,0),imports=Object.values(m.imports).reduce((a,b)=>a+b,0),exports=Object.values(m.exports).reduce((a,b)=>a+b,0);
  let unmet=0,totalDemand=0;
  for(let sector of ECONOMY_GOODS){
   let desired=m.supply.demand[sector],available=m.stock[sector];if(sector==='military')desired=0;
   unmet+=Math.max(0,desired-available);totalDemand+=desired;
   e.inventory[sector]=econClamp(available-desired,0,(m.supply.demand[sector]||0)*(sector==='military'?12:6));
  }
  let shortage=totalDemand?econClamp(unmet/totalDemand,0,1):0;
  let receivedSanctions=econSanctionCount(c),issuedSanctions=n.sanctions?.length||0;
  let netTrade=exports-imports,tradeEffect=econClamp(netTrade/(oldGDP/12)*.55,-2,2);
  let governmentStability=n.politics?.government?.stability??55;
  let approval=c===state.player?state.approval:(n.ai?.approval??58);
  let legitimacy=c===state.player?state.legitimacy:(n.ai?.legitimacy??60);
  let confidenceDelta=(approval-55)*.012+(legitimacy-50)*.008+(governmentStability-50)*.015-shortage*1.4-receivedSanctions*.5-issuedSanctions*.15-(n.debt/oldGDP>1?.25:0);
  e.confidence=econClamp(e.confidence+confidenceDelta,0,100);
  let publicInvestment=oldGDP*n.infra/100/12,privateInvestment=oldGDP*(.012*e.confidence/100)/12;
  let investment=publicInvestment+privateInvestment+e.pendingInvestment;
  let capacityGain=investment*12*ECONOMY_CAPITAL_EFFICIENCY;
  e.capacity.manufacturing+=capacityGain*.55;e.capacity.services+=capacityGain*.25;e.capacity.energy+=capacityGain*.12;e.capacity.materials+=capacityGain*.08;
  e.pendingInvestment=0;e.factories=Math.max(0,Number(e.capacity.manufacturing)||0);
  let baseGrowth=1-Math.min(3,receivedSanctions*.22)+(n.education-5)*.14+(n.infra-5)*.2+(n.health-6)*.07-(n.tax-30)*.07+Math.min(1.5,exports/(oldGDP/12)*.2)-issuedSanctions*.18-(n.mobilized?.8:0)-(simAtWar(c)?2:0)-Math.max(0,n.debt/oldGDP-.8)*2;
  n.growth=econClamp(baseGrowth+tradeEffect-shortage*5+(e.confidence-50)*.015, -8,9);
  n.gdp=Math.max(.01,oldGDP*(1+n.growth/1200));
  n.treasury+=statement.net;
  if(n.treasury<0){n.debt-=n.treasury;n.treasury=0;}
  if(n.owner!==c)n.treasury*=.95;
  let importsBySector={...m.imports},exportsBySector={...m.exports};
  e.lastMonth={production,imports,exports,shortage,investment,utilization:m.supply.utilization,importsBySector,exportsBySector,publicInvestment,privateInvestment,netTrade,confidence:e.confidence,monthlyRevenue:statement.revenue,monthlySpending:statement.spend};
  delete e._market;
 }
}
function econPanel(n){
 econEnsureCountry(n);let e=n.economy,m=e.lastMonth||{};
 return'<div class="card"><b>Industry and trade</b><div class="row"><span>Factory capacity units</span><b>'+e.factories.toLocaleString()+'</b></div><div class="row"><span>Monthly industrial output</span><b>'+money(m.production||0)+'</b></div><div class="row"><span>Imports / exports</span><b>'+money(m.imports||0)+' / '+money(m.exports||0)+'</b></div><div class="row"><span>Supply shortfall</span><b>'+((m.shortage||0)*100).toFixed(1)+'%</b></div><div class="row"><span>Investment confidence</span><b>'+Math.round(e.confidence)+'%</b></div><p>Capacities and stocks use illustrative euro-bn values derived from national GDP, population, and the existing force profile. Trade agreements transfer actual surpluses to partner shortfalls; bilateral sanctions block flows and outside sanctions reduce access.</p></div>';
}
