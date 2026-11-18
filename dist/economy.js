'use strict';

// Illustrative national accounts. Capacities, inventories, trade settlements and
// budget flows are expressed in euro-bn; prices are dimensionless indices.
const ECONOMY_SCHEMA=2;
const ECON_STIMULUS_RATE=.012,ECON_STIMULUS_COOLDOWN=12;
const ECONOMY_GOODS=['food','energy','materials','manufacturing','military'];
const ECONOMY_DEMAND={food:.10,energy:.08,materials:.10,manufacturing:.18,military:.015};
const ECONOMY_CPI_WEIGHTS={food:.34,energy:.28,materials:.10,manufacturing:.28};
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
 n.economy??={};let e=n.economy,shares=e.shares||econShares(n);
 e.schema=ECONOMY_SCHEMA;e.shares=shares;
 e.capacity=e.capacity||Object.fromEntries(Object.entries(shares).map(([k,v])=>[k,(n.gdp||1)*v]));
 for(let sector of [...ECONOMY_GOODS,'services'])e.capacity[sector]=Math.max(.001,Number(e.capacity[sector])||((n.gdp||1)*shares[sector]));
 e.inventory=e.inventory||Object.fromEntries(ECONOMY_GOODS.map(s=>[s,(n.gdp||1)*ECONOMY_DEMAND[s]*(s==='military'?4:2)/12]));
 for(let s of ECONOMY_GOODS)e.inventory[s]=Math.max(0,Number(e.inventory[s])||0);
 e.prices=e.prices||{};for(let s of ECONOMY_GOODS)e.prices[s]=econClamp(Number(e.prices[s])||1,.4,4);
 e.confidence=econClamp(Number.isFinite(e.confidence)?e.confidence:60,0,100);
 e.employment=econClamp(Number.isFinite(e.employment)?e.employment:84,45,99);
 e.productivity=econClamp(Number.isFinite(e.productivity)?e.productivity:1,.7,1.35);
 e.inflation=econClamp(Number.isFinite(e.inflation)?e.inflation:0,-.08,.08);
 e.pendingInvestment=Math.max(0,Number(e.pendingInvestment)||0);e.lastStimulusTurn=Number.isFinite(e.lastStimulusTurn)?e.lastStimulusTurn:-ECON_STIMULUS_COOLDOWN;
 e.factories=Math.max(0,Number(e.capacity.manufacturing)||0);
 e.lastMonth=e.lastMonth||{production:0,imports:0,exports:0,shortage:0,investment:0,utilization:.9,importsBySector:{},exportsBySector:{}};
}
function econEnsure(){if(!state?.countries)return;for(let n of Object.values(state.countries))econEnsureCountry(n);}
function econDemand(n){
 let e=n.economy,perCapita=(n.gdp||1)/Math.max(.1,n.pop||1),income=econClamp(Math.sqrt(perCapita/23),.82,1.18);
 let disposable=econClamp(1+(30-(n.tax||30))*.003,.85,1.08),confidence=econClamp(.9+e.confidence*.0017,.9,1.07),scale=income*disposable*confidence;
 let demand=Object.fromEntries(ECONOMY_GOODS.map(s=>[s,(n.gdp||1)*ECONOMY_DEMAND[s]*scale/12]));
 demand.military=Math.max(demand.military,(n.gdp||1)*Math.max(ECONOMY_DEMAND.military,(n.defense||3)*.004)*scale/12);
 return demand;
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
 econEnsureCountry(n);let value=Math.max(0,Number(amount)||0);n.economy.pendingInvestment+=value;
 n.economy.confidence=econClamp(n.economy.confidence+Math.min(2,value/Math.max(1,n.gdp)*100),0,100);
}
function econStimulusQuote(n){
 econEnsureCountry(n);let cost=Math.max(0,n.gdp||0)*ECON_STIMULUS_RATE,last=n.economy.lastStimulusTurn,remaining=Math.max(0,ECON_STIMULUS_COOLDOWN-(state.turn-last));
 if(n.politics?.government?.status==='caretaker')return{ok:false,reason:'A caretaker government cannot authorize a national investment programme.',cost,remaining};
 if(remaining>0)return{ok:false,reason:'Available again in '+remaining+' months.',cost,remaining};
 if((n.treasury||0)+1e-9<cost)return{ok:false,reason:'Treasury reserves cannot cover the programme.',cost,remaining};
 return{ok:true,cost,remaining:0};
}
function econRunStimulus(n){let q=econStimulusQuote(n);if(!q.ok)return q;n.treasury-=q.cost;n.economy.lastStimulusTurn=state.turn;econFundInvestment(n,q.cost);return{...q,ok:true};}
function econSupply(n){
 let e=n.economy,capacity=e.capacity,utilization=econClamp(.84+(e.confidence-50)*.0012,.72,.96),labor=econClamp(e.employment/90,.65,1.08),factor=utilization*labor*e.productivity,output={};
 for(let s of [...ECONOMY_GOODS,'services'])output[s]=capacity[s]/12*factor;
 let energyAvailable=e.inventory.energy+output.energy,materialsAvailable=e.inventory.materials+output.materials;
 let inputEnergy=(output.manufacturing+output.military)*ECONOMY_INPUT_ENERGY,inputMaterials=(output.manufacturing+output.military)*ECONOMY_INPUT_MATERIALS;
 let inputFactor=Math.min(1,energyAvailable/Math.max(.0001,inputEnergy),materialsAvailable/Math.max(.0001,inputMaterials));
 output.manufacturing*=inputFactor;output.military*=inputFactor;
 let usedEnergy=(output.manufacturing+output.military)*ECONOMY_INPUT_ENERGY,usedMaterials=(output.manufacturing+output.military)*ECONOMY_INPUT_MATERIALS;
 let stock=Object.fromEntries(ECONOMY_GOODS.map(s=>[s,e.inventory[s]+output[s]-(s==='energy'?usedEnergy:s==='materials'?usedMaterials:0)]));
 return{output,stock,demand:econDemand(n),utilization,factor,inputFactor,usedEnergy,usedMaterials};
}
function econTradeMarkets(){
 let countries=Object.keys(state.countries).sort(),market={};
 for(let c of countries){let n=state.countries[c],supply=econSupply(n),e=n.economy;market[c]={supply,stock:{...supply.stock},prices:{...e.prices},imports:Object.fromEntries(ECONOMY_GOODS.map(s=>[s,0])),exports:Object.fromEntries(ECONOMY_GOODS.map(s=>[s,0])),receipts:0,payments:0};}
 for(let i=0;i<countries.length;i++)for(let j=i+1;j<countries.length;j++){
  let a=countries[i],b=countries[j],na=state.countries[a],nb=state.countries[b];
  if(!(na.trades?.includes(b)&&nb.trades?.includes(a)))continue;
  if(na.sanctions?.includes(b)||nb.sanctions?.includes(a))continue;
  let pressure=Math.min(.9,(econSanctionCount(a)+econSanctionCount(b))*.12),allowed=1-pressure,ma=market[a],mb=market[b];
  for(let sector of ECONOMY_GOODS){
   let reserveA=ma.supply.demand[sector]*2,reserveB=mb.supply.demand[sector]*2;
   let surplusA=Math.max(0,ma.stock[sector]-ma.supply.demand[sector]-reserveA),shortageA=Math.max(0,ma.supply.demand[sector]+reserveA-ma.stock[sector]);
   let surplusB=Math.max(0,mb.stock[sector]-mb.supply.demand[sector]-reserveB),shortageB=Math.max(0,mb.supply.demand[sector]+reserveB-mb.stock[sector]);
   let flowAB=Math.min(surplusA,shortageB)*allowed,flowBA=Math.min(surplusB,shortageA)*allowed,price=(ma.prices[sector]+mb.prices[sector])/2;
   if(flowAB>0){let payment=flowAB*price;ma.stock[sector]-=flowAB;mb.stock[sector]+=flowAB;ma.exports[sector]+=flowAB;mb.imports[sector]+=flowAB;ma.receipts+=payment;mb.payments+=payment;}
   if(flowBA>0){let payment=flowBA*price;mb.stock[sector]-=flowBA;ma.stock[sector]+=flowBA;mb.exports[sector]+=flowBA;ma.imports[sector]+=flowBA;mb.receipts+=payment;ma.payments+=payment;}
  }
 }
 for(let c of countries)market[c].tradeBalance=market[c].receipts-market[c].payments;
 return market;
}
function econAdvanceAll(){
 if(!state)return;econEnsure();let market=econTradeMarkets();
 for(let c of Object.keys(state.countries)){
  let n=state.countries[c],e=n.economy,m=market[c],oldGDP=Math.max(.01,n.gdp),statement=econStatement(n),oldPrices={...e.prices};
  let production=Object.values(m.supply.output).reduce((a,b)=>a+b,0),imports=Object.values(m.imports).reduce((a,b)=>a+b,0),exports=Object.values(m.exports).reduce((a,b)=>a+b,0),unmet=0,totalDemand=0,priceChanges={};
  for(let sector of ECONOMY_GOODS){
   let desired=m.supply.demand[sector],available=Math.max(0,m.stock[sector]),shortage=Math.max(0,desired-available),surplus=Math.max(0,available-desired),shortageRate=desired?shortage/desired:0,surplusRate=desired?Math.max(0,surplus/desired-2):0;
   unmet+=shortage;totalDemand+=desired;let change=econClamp(shortageRate*.035-surplusRate*.004,-.025,.04);
   e.prices[sector]=econClamp(oldPrices[sector]*(1+change),.4,4);priceChanges[sector]=e.prices[sector]/Math.max(.001,oldPrices[sector])-1;
   e.inventory[sector]=econClamp(available-desired,0,Math.max(.001,desired*6));
  }
  let shortage=totalDemand?econClamp(unmet/totalDemand,0,1):0,cpiWeight=0,inflation=0;
  for(let [sector,weight] of Object.entries(ECONOMY_CPI_WEIGHTS)){inflation+=priceChanges[sector]*weight;cpiWeight+=weight;}
  inflation=cpiWeight?inflation/cpiWeight:0;e.inflation=econClamp(inflation,-.08,.08);
  let productivityDelta=(n.education-5)*.0003+(n.health-6)*.0003+(n.infra-5)*.0002-e.inflation*.002;e.productivity=econClamp(e.productivity+productivityDelta,.7,1.35);
  let capacityPerMonth=Object.values(e.capacity).reduce((sum,x)=>sum+x,0)/12,outputRatio=production/Math.max(.001,capacityPerMonth*e.productivity),targetEmployment=econClamp(80+(outputRatio-.82)*55+(e.confidence-50)*.04-shortage*8,50,98);
  e.employment=econClamp(e.employment*.82+targetEmployment*.18,45,99);
  let receivedSanctions=econSanctionCount(c),issuedSanctions=n.sanctions?.length||0,governmentStability=n.politics?.government?.stability??55;
  let approval=c===state.player?state.approval:(n.ai?.approval??58),legitimacy=c===state.player?state.legitimacy:(n.ai?.legitimacy??60);
  let confidenceDelta=(approval-55)*.01+(legitimacy-50)*.006+(governmentStability-50)*.012+(20-(n.politics?.corruption??20))*.01-shortage*1.1-Math.max(0,e.inflation)*8-receivedSanctions*.4-issuedSanctions*.12-(n.debt/oldGDP>1?.2:0);
  e.confidence=econClamp(e.confidence+confidenceDelta,0,100);
  let publicInvestment=oldGDP*n.infra/100/12*econClamp(1+(e.confidence-50)*.005,.7,1.2),privateInvestment=oldGDP*(.012*e.confidence/100)/12*econClamp(1-(n.tax-30)*.01,.6,1.1),investment=publicInvestment+privateInvestment+e.pendingInvestment;
  let capacityGain=investment*12*ECONOMY_CAPITAL_EFFICIENCY;e.capacity.manufacturing+=capacityGain*.55;e.capacity.services+=capacityGain*.25;e.capacity.energy+=capacityGain*.12;e.capacity.materials+=capacityGain*.08;
  e.pendingInvestment=0;e.factories=Math.max(0,Number(e.capacity.manufacturing)||0);
  let netTrade=exports-imports,tradeEffect=econClamp(netTrade/(oldGDP/12)*.22,-1.5,1.5),outputContribution=econClamp((outputRatio-.83)*4,-2,2),investmentContribution=econClamp(investment/oldGDP*1200*.12,0,1.8);
  let baseGrowth=1+outputContribution+investmentContribution+(n.education-5)*.12+(n.health-6)*.05+(30-n.tax)*.035+tradeEffect-shortage*4-e.inflation*12+(e.confidence-50)*.012+(e.employment-82)*.03-Math.min(2,receivedSanctions*.15)-issuedSanctions*.08-(n.mobilized?.6:0)-(simAtWar(c)?1.5:0)-Math.max(0,n.debt/oldGDP-.8)*1.3;
  n.growth=econClamp(baseGrowth,-8,9);n.gdp=Math.max(.01,oldGDP*(1+n.growth/1200));
  n.treasury+=statement.net+m.tradeBalance;if(n.treasury<0){n.debt-=n.treasury;n.treasury=0;}if(n.owner!==c)n.treasury*=.95;
  e.lastMonth={production,imports,exports,shortage,investment,utilization:m.supply.utilization,outputRatio,employment:e.employment,inflation:e.inflation,prices:{...e.prices},priceChanges,importsBySector:{...m.imports},exportsBySector:{...m.exports},netTrade,tradeBalance:m.tradeBalance,tradeReceipts:m.receipts,tradePayments:m.payments,confidence:e.confidence,monthlyRevenue:statement.revenue,monthlySpending:statement.spend};
 }
}
function econPanel(n){
 econEnsureCountry(n);let e=n.economy,m=e.lastMonth||{},annualInflation=((Math.pow(1+e.inflation,12)-1)*100);
 return'<div class="card"><b>Industry, prices and trade</b><div class="row"><span>Annual manufacturing capacity</span><b>'+money(e.factories)+'</b></div><div class="row"><span>Monthly industrial output</span><b>'+money(m.production||0)+'</b></div><div class="row"><span>Employment</span><b>'+Math.round(e.employment)+'%</b></div><div class="row"><span>Consumer price change · annualized</span><b>'+annualInflation.toFixed(1)+'%</b></div><div class="row"><span>Imports / exports</span><b>'+money(m.imports||0)+' / '+money(m.exports||0)+'</b></div><div class="row"><span>Trade settlement</span><b>'+(m.tradeBalance>=0?'+':'−')+money(Math.abs(m.tradeBalance||0))+'</b></div><div class="row"><span>Supply shortfall</span><b>'+((m.shortage||0)*100).toFixed(1)+'%</b></div><div class="row"><span>Investment confidence</span><b>'+Math.round(e.confidence)+'%</b></div><p>Production, employment, prices, inventories and trade now feed into growth and household confidence. Trade partners settle the value of goods through their treasuries.</p></div>';
}
function econInspector(n){
 econEnsureCountry(n);let e=n.economy,m=e.lastMonth||{},budget=econStatement(n),received=econSanctionCount(n.code),partners=(n.trades||[]).filter(c=>state.countries[c]).length,annualInflation=(Math.pow(1+e.inflation,12)-1)*100;
 return'<h3>Economy and trade</h3><div class="card"><div class="row"><span>Treasury</span><b>'+money(n.treasury)+'</b></div><div class="row"><span>Debt / GDP</span><b>'+((n.debt/Math.max(.01,n.gdp))*100).toFixed(0)+'%</b></div><div class="row"><span>Monthly budget balance</span><b>'+(budget.net>=0?'+':'−')+money(Math.abs(budget.net))+'</b></div><div class="row"><span>Tax rate</span><b>'+n.tax+'%</b></div><div class="row"><span>Employment</span><b>'+Math.round(e.employment)+'%</b></div><div class="row"><span>Annualized consumer prices</span><b>'+annualInflation.toFixed(1)+'%</b></div><div class="row"><span>Manufacturing capacity / output</span><b>'+money(e.capacity.manufacturing)+' / '+money(m.production||0)+'</b></div><div class="row"><span>Trade settlement</span><b>'+(m.tradeBalance>=0?'+':'−')+money(Math.abs(m.tradeBalance||0))+'</b></div><div class="row"><span>Supply shortfall</span><b>'+((m.shortage||0)*100).toFixed(1)+'%</b></div><div class="row"><span>Investment confidence</span><b>'+Math.round(e.confidence)+'%</b></div><div class="row"><span>Trade partners / sanctions</span><b>'+partners+' / '+(n.sanctions?.length||0)+' issued · '+received+' received</b></div></div>';
}


