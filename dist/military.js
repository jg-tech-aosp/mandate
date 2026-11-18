'use strict';

// Personnel is measured in thousands; a standard division is 10,000 people.
// Equipment and supply stocks share the economy's illustrative euro-bn units.
const MILITARY_SCHEMA=1;
const MIL_DIVISION_SIZE=10;
const MIL_EQUIPMENT_COST=.001;
const MIL_RECRUIT_CASH=.004;
const MIL_SUPPLY_RATE=.0000016;
const MIL_PAYROLL_RATE=.0000008;

function milClamp(v,min,max){return Math.max(min,Math.min(max,v));}
function milDivisions(n){return(n?.military?.formations||[]).flatMap(f=>f.divisions||[]);}
function milRawForce(n){return milDivisions(n).reduce((sum,d)=>sum+Math.max(0,d.personnel||0)*milClamp(d.equipment??1,0,1),0);}
function milRawReadiness(n){let all=milDivisions(n),people=all.reduce((s,d)=>s+Math.max(0,d.personnel||0),0);return people?all.reduce((s,d)=>s+(d.personnel||0)*milClamp(d.readiness??65,0,100),0)/people:0;}
function milLegacyReadiness(n,fallback=65){let value=n?.ready;return value!==undefined&&value!==null&&Number.isFinite(Number(value))?milClamp(Number(value),0,100):fallback;}
function milMakeRoster(n,total,readiness=65){
 let remaining=Math.max(0,total),divisions=[],i=0;
 while(remaining>.001){let personnel=Math.min(MIL_DIVISION_SIZE,remaining);i++;
  divisions.push({id:n.code+'-div-'+i,personnel,equipment:1,readiness:milClamp(readiness,0,100),supply:1,createdTurn:state?.turn||0});remaining-=personnel;}
 let formations=[];for(let j=0;j<divisions.length;j+=3)formations.push({id:n.code+'-formation-'+(Math.floor(j/3)+1),name:j===0?'National Defence Corps':'Reserve Formation '+(Math.floor(j/3)+1),deployment:'home',arrivalTurn:0,divisions:divisions.slice(j,j+3)});
 return formations;
}
function milCapacity(n){return Math.max(milRawPersonnel(n),(n.pop||1)*1000*(n.mobilized?.22:.12));}
function milRawPersonnel(n){return milDivisions(n).reduce((sum,d)=>sum+Math.max(0,d.personnel||0),0);}
function milActiveWars(c){return(state?.wars||[]).filter(w=>w.active&&[w.a,w.b].includes(c));}
function milInstallAliases(n){
 let fd=Object.getOwnPropertyDescriptor(n,'force');
 if(!fd?.get)Object.defineProperty(n,'force',{enumerable:true,configurable:true,get(){return milRawForce(this);},set(v){milSetForce(this,v);}});
 let rd=Object.getOwnPropertyDescriptor(n,'ready');
 if(!rd?.get)Object.defineProperty(n,'ready',{enumerable:true,configurable:true,get(){return milRawReadiness(this);},set(v){milSetReadiness(this,v);}});
}
function milSetForce(n,value){
 if(!n?.military)return;let wanted=Math.max(0,Number(value)||0),current=milRawForce(n),all=milDivisions(n);
 if(current>0){let factor=wanted/current;for(let d of all)d.personnel=Math.max(0,(d.personnel||0)*factor);}
 else if(wanted)n.military.formations=milMakeRoster(n,wanted,milLegacyReadiness(n,60));
 milSyncCountry(n);
}
function milSetReadiness(n,value){if(!n?.military)return;for(let d of milDivisions(n))d.readiness=milClamp(Number(value)||0,0,100);}
function milEnsureCountry(n){
 if(!n)return;if(typeof econEnsureCountry==='function')econEnsureCountry(n);
 let oldForce=Math.max(0,Number(n.force)||0),oldReady=milLegacyReadiness(n);
 n.military??={};let m=n.military;
 if(m.schema!==MILITARY_SCHEMA){m={schema:MILITARY_SCHEMA,formations:milMakeRoster(n,oldForce,oldReady),manualControl:false,lastMonth:null};n.military=m;}
 m.formations=Array.isArray(m.formations)?m.formations:[];
 for(let i=0;i<m.formations.length;i++){
  let f=m.formations[i];f.id??=n.code+'-formation-'+(i+1);f.name??='Formation '+(i+1);f.deployment??='home';f.arrivalTurn=Math.max(0,Number(f.arrivalTurn)||0);f.divisions=Array.isArray(f.divisions)?f.divisions:[];
  for(let j=0;j<f.divisions.length;j++){let d=f.divisions[j];d.id??=f.id+'-div-'+(j+1);d.personnel=Math.max(0,Number(d.personnel)||0);d.equipment=milClamp(Number.isFinite(Number(d.equipment))?Number(d.equipment):1,0,1);d.readiness=milClamp(Number.isFinite(Number(d.readiness))?Number(d.readiness):oldReady,0,100);d.supply=milClamp(Number.isFinite(Number(d.supply))?Number(d.supply):1,0,1);}
 }
 if(!milDivisions(n).length&&oldForce>0)m.formations=milMakeRoster(n,oldForce,oldReady);
 m.manualControl=!!m.manualControl;m.logisticsCapacity=Number(m.logisticsCapacity)||0;
 m.lastMonth=m.lastMonth||{required:0,delivered:0,supplyRatio:1,shortage:0,maintenance:0};
 milInstallAliases(n);milSyncCountry(n);
}
function milEnsureAll(){if(!state?.countries)return;for(let n of Object.values(state.countries))milEnsureCountry(n);}
function milSyncCountry(n){
 if(!n?.military)return;let m=n.military,divisions=milDivisions(n),people=milRawPersonnel(n),force=milRawForce(n);
 m.activePersonnel=people;m.divisionCount=divisions.length;m.availableManpower=Math.max(0,milCapacity(n)-people);
 m.logisticsCapacity=Math.max(.001,(n.gdp||1)*(.00025+Math.max(1,n.infra||1)*.00008));
 n.economy??={};n.economy.maintenance=force*(n.gdp||1)*MIL_PAYROLL_RATE;
}
function milQuoteRecruit(c){
 let n=typeof c==='string'?state.countries[c]:c;milEnsureCountry(n);let personnel=Math.min(MIL_DIVISION_SIZE,milCapacity(n)-milRawPersonnel(n));
 let equipment=(n.gdp||1)*MIL_EQUIPMENT_COST*(personnel/MIL_DIVISION_SIZE),cash=(n.gdp||1)*MIL_RECRUIT_CASH*(personnel/MIL_DIVISION_SIZE);
 if(personnel<1)return{ok:false,reason:'No trained manpower reserve is available.',personnel:0,equipment,cash};
 if((n.economy?.inventory?.military||0)+1e-9<equipment)return{ok:false,reason:'Military equipment stocks are too low. Domestic production or imports must replenish them.',personnel,equipment,cash};
 if((n.treasury||0)+1e-9<cash)return{ok:false,reason:'Treasury reserves cannot cover recruitment and procurement.',personnel,equipment,cash};
 return{ok:true,reason:'',personnel,equipment,cash};
}
function milRecruit(c){
 let n=typeof c==='string'?state.countries[c]:c,quote=milQuoteRecruit(n);if(!quote.ok)return quote;
 n.treasury-=quote.cash;n.economy.inventory.military=Math.max(0,n.economy.inventory.military-quote.equipment);
 let m=n.military,f=m.formations.find(x=>x.deployment==='home'&&x.divisions.length<3);
 if(!f){f={id:n.code+'-formation-'+(m.formations.length+1),name:m.formations.length?'Reserve Formation '+(m.formations.length+1):'National Defence Corps',deployment:'home',arrivalTurn:0,divisions:[]};m.formations.push(f);}
 f.divisions.push({id:n.code+'-div-'+(m.divisionCount+1),personnel:quote.personnel,equipment:1,readiness:65,supply:1,createdTurn:state.turn});
 m.lastRecruit={turn:state.turn,personnel:quote.personnel,equipment:quote.equipment,cash:quote.cash};milSyncCountry(n);return{...quote,ok:true,formation:f.id};
}
function milTrain(c){
 let n=typeof c==='string'?state.countries[c]:c;milEnsureCountry(n);let cost=(n.gdp||1)*.0015;
 if(!milDivisions(n).length)return{ok:false,reason:'There are no formations to train.'};
 if(n.treasury<cost)return{ok:false,reason:'Treasury reserves cannot cover the exercise.'};
 let supplied=milClamp(n.military.lastMonth?.supplyRatio??1,0,1);if(supplied<.25)return{ok:false,reason:'Supply shortages prevent a useful exercise.'};
 n.treasury-=cost;let gain=4*supplied;for(let d of milDivisions(n))d.readiness=milClamp(d.readiness+gain,0,100);
 milSyncCountry(n);return{ok:true,cost,gain};
}
function milDeliverAidEquipment(c,w){
 let n=typeof c==='string'?state.countries[c]:c;milEnsureCountry(n);let goods=(n.gdp||1)*.00008;
 if(!w?.active)return{ok:false,reason:'There is no active front to support.'};
 if((n.economy.inventory.military||0)+1e-9<goods)return{ok:false,reason:'Military stocks cannot cover an aid shipment.'};
 n.economy.inventory.military=Math.max(0,n.economy.inventory.military-goods);w.support=milClamp((w.support||0)+.16,0,2);
 return{ok:true,goods,support:.16};
}
function milSendAid(c,w){
 let n=typeof c==='string'?state.countries[c]:c;milEnsureCountry(n);let cash=(n.gdp||1)*.0008;
 if((n.treasury||0)+1e-9<cash)return{ok:false,reason:'Treasury reserves cannot cover the aid package.'};
 let shipment=milDeliverAidEquipment(n,w);if(!shipment.ok)return shipment;
 n.treasury-=cash;let recipient=w.a==='UA'||w.b==='UA'?'UA':(w.a===n.code?w.b:w.a);
 if(state.countries[recipient])state.countries[recipient].treasury+=cash;
 return{ok:true,cash,goods:shipment.goods,support:shipment.support,recipient};
}
function milSetMobilized(c,enabled){
 let n=typeof c==='string'?state.countries[c]:c;milEnsureCountry(n);let was=!!n.mobilized;n.mobilized=!!enabled;milSyncCountry(n);return was!==n.mobilized;
}
function milMove(c,formationId,destination){
 let n=typeof c==='string'?state.countries[c]:c;milEnsureCountry(n);let f=n.military.formations.find(x=>x.id===formationId);if(!f)return{ok:false,reason:'Formation not found.'};
 if(destination==='home'){f.deployment='home';f.arrivalTurn=state.turn+1;n.military.manualControl=c===state.player;return{ok:true,arrivalTurn:f.arrivalTurn};}
 let w=(state.wars||[]).find(x=>x.id===destination&&x.active&&[x.a,x.b].includes(n.code));if(!w)return{ok:false,reason:'That front is no longer active.'};
 f.deployment=w.id;f.arrivalTurn=state.turn+1;n.military.manualControl=n.code===state.player;return{ok:true,arrivalTurn:f.arrivalTurn};
}
function milDeployToWar(n,w,targetPercent=.65,immediate=false){
 milEnsureCountry(n);let formations=n.military.formations,assigned=formations.filter(f=>f.deployment===w.id).reduce((sum,f)=>sum+f.divisions.reduce((a,d)=>a+d.personnel,0),0),target=milRawPersonnel(n)*targetPercent;
 for(let f of formations){if(assigned>=target)break;if(f.deployment!=='home')continue;f.deployment=w.id;f.arrivalTurn=immediate?state.turn:state.turn+1;assigned+=f.divisions.reduce((a,d)=>a+d.personnel,0);}
}
function milPrepareWar(w){for(let c of[w.a,w.b]){let n=state.countries[c];if(n&&n.military)milDeployToWar(n,w,.65,true);}}
function milAutoDeploy(c){
 let n=state.countries[c];if(!n)return;milEnsureCountry(n);let m=n.military;
 let wars=milActiveWars(c),activeIds=new Set(wars.map(w=>w.id));
 for(let f of m.formations)if(f.deployment!=='home'&&!activeIds.has(f.deployment)){f.deployment='home';f.arrivalTurn=state.turn;}
 if(m.manualControl)return;
 if(!wars.length)return;
 let target=milRawPersonnel(n)*Math.min(.85,.65/wars.length);
 for(let w of wars){let assigned=m.formations.filter(f=>f.deployment===w.id).reduce((sum,f)=>sum+f.divisions.reduce((a,d)=>a+d.personnel,0),0);
  for(let f of m.formations){if(assigned>=target)break;if(f.deployment!=='home')continue;f.deployment=w.id;f.arrivalTurn=state.turn+1;assigned+=f.divisions.reduce((a,d)=>a+d.personnel,0);}
 }
}
function milWarForce(w,c){let n=state.countries[c];if(!n)return 0;milEnsureCountry(n);return n.military.formations.filter(f=>f.deployment===w.id&&f.arrivalTurn<=state.turn).reduce((sum,f)=>sum+f.divisions.reduce((s,d)=>s+d.personnel*milClamp(d.equipment,0,1),0),0);}
function milWarPower(w,c){let n=state.countries[c];if(!n)return 0;milEnsureCountry(n);return n.military.formations.filter(f=>f.deployment===w.id&&f.arrivalTurn<=state.turn).reduce((sum,f)=>sum+f.divisions.reduce((s,d)=>s+d.personnel*milClamp(d.equipment,0,1)*milClamp(d.readiness,0,100)/100,0),0);}
function milCombatSupply(c){let n=state.countries[c];return milClamp(n?.military?.lastMonth?.supplyRatio??.6,0,1);}
function milCombatCasualties(c,w,offensive=false){
 let n=state.countries[c];if(!n)return;milEnsureCountry(n);let rate=offensive?.006:.003;
 for(let f of n.military.formations)if(f.deployment===w.id&&f.arrivalTurn<=state.turn)for(let d of f.divisions){d.personnel=Math.max(.05,d.personnel*(1-rate));d.equipment=milClamp(d.equipment-(offensive?.002:.001),.35,1);d.readiness=milClamp(d.readiness-(offensive?1.1:.5),15,100);}
 milSyncCountry(n);
}
function milMonthlyAll(){
 if(!state?.countries)return;milEnsureAll();
 for(let c of Object.keys(state.countries)){
  let n=state.countries[c],m=n.military,e=n.economy;milAutoDeploy(c);
  let force=milRawForce(n),deployed=m.formations.filter(f=>f.deployment!=='home'&&f.arrivalTurn<=state.turn).reduce((s,f)=>s+f.divisions.reduce((a,d)=>a+d.personnel*d.equipment,0),0);
  let deployedShare=force?deployed/force:0,required=force*n.gdp*MIL_SUPPLY_RATE*(1+deployedShare*.45),capacity=m.logisticsCapacity;
  let stock=Math.max(0,e.inventory.military||0),delivered=Math.min(required,stock,capacity),ratio=required?delivered/required:1;
  e.inventory.military=Math.max(0,stock-delivered);
  for(let f of m.formations)for(let d of f.divisions){
   let exposed=f.deployment!=='home'&&f.arrivalTurn<=state.turn,unitRatio=exposed?ratio:Math.min(1,ratio+.15);
   d.supply=unitRatio;
   if(unitRatio<.98){d.readiness=milClamp(d.readiness-(1-unitRatio)*5,15,100);d.equipment=milClamp(d.equipment-(1-unitRatio)*.004,.35,1);}
   else{d.readiness=milClamp(d.readiness+.18+Math.max(0,n.defense-3)*.07,15,100);d.equipment=milClamp(d.equipment+.0015,0,1);}
  }
  m.lastMonth={required,delivered,supplyRatio:ratio,shortage:1-ratio,logisticsCapacity:capacity,stock:e.inventory.military,deployedShare,maintenance:force*n.gdp*MIL_PAYROLL_RATE};
  milSyncCountry(n);
 }
}
function milPanel(n){
 milEnsureCountry(n);let m=n.military,divisions=milDivisions(n),personnel=milRawPersonnel(n),quote=milQuoteRecruit(n),wars=milActiveWars(n.code),last=m.lastMonth||{};
 let html=`<div class="card"><b>Military readiness and logistics</b><div class="row"><span>Active strength index</span><b>${n.force.toFixed(1)}</b></div><div class="row"><span>Personnel</span><b>${personnel.toFixed(1)}k · ${divisions.length} divisions</b></div><div class="row"><span>Available manpower</span><b>${m.availableManpower.toFixed(1)}k</b></div><div class="row"><span>Readiness</span><b>${n.ready.toFixed(0)}%</b></div><div class="row"><span>Supply delivered</span><b>${Math.round((last.supplyRatio??1)*100)}%</b></div><div class="row"><span>Monthly military maintenance</span><b>${money(last.maintenance||n.economy.maintenance||0)}</b></div><div class="row"><span>Mobilization</span><b>${n.mobilized?'Active · economic and approval cost':'Standby'}</b></div></div>`;
 html+=`<button class="wide" data-action="recruit" ${quote.ok?'':'disabled'}>${quote.ok?`Recruit division · ${money(quote.cash)} plus ${money(quote.equipment)} equipment`:`Recruit unavailable · ${quote.reason}`}</button>`;
 html+=actionButton('train',`Train formations · ${money(n.gdp*.0015)}`)+actionButton('mobilize',n.mobilized?'Demobilize reserves':'Mobilize reserves');
 html+=`<div class="card"><b>Formations</b>`;
 for(let f of m.formations){let fpeople=f.divisions.reduce((s,d)=>s+d.personnel,0),deployedWar=state.wars.find(w=>w.id===f.deployment),location=f.deployment==='home'?'Home reserve':(deployedWar?'Front: '+name(deployedWar.a===n.code?deployedWar.b:deployedWar.a):'In transit');
  html+=`<div class="row"><span>${f.name} · ${fpeople.toFixed(1)}k · ${location}</span></div>`;
  if(f.deployment==='home')for(let w of wars)html+=actionButton(`milDeploy|${w.id}|${f.id}`,`Deploy to ${name(w.a===n.code?w.b:w.a)} · arrives next month`);
  else html+=actionButton(`milRecall|${f.id}`,'Recall to home reserve · arrives next month');
 }
 if(!divisions.length)html+='<p>No formed units.</p>';
 html+=`<p class="note">Divisions can be recruited in peacetime using available manpower, treasury and military goods. Deployment takes a month; frontline supply and infrastructure affect readiness and combat. Mobilization expands the eligible reserve pool but creates no strength by itself.</p></div>`;
 html+=wars.length?`<h3>Active campaigns</h3>${wars.map(w=>wcCard(w)).join('')}`:`<p class="note">No active fronts.</p>`;return html;
}
function milCanInspectFullRoster(n){let viewer=state?.countries?.[state.player];return n.code===state.player||!!(viewer&&(n.allies?.includes(state.player)||viewer.allies?.includes(n.code)));}
function milVisibleFrontFormations(n){let fronts=(state.wars||[]).filter(w=>w.active&&[w.a,w.b].includes(n.code)&&[w.a,w.b].includes(state.player));return n.military.formations.filter(f=>f.arrivalTurn<=state.turn&&fronts.some(w=>w.id===f.deployment));}
function milInspector(n){
 milEnsureCountry(n);let m=n.military;
 if(!milCanInspectFullRoster(n)){
  let visible=milVisibleFrontFormations(n);
  if(!visible.length)return'<h3>Military and logistics</h3><div class="card"><p>Division details are unavailable. Non-allies can observe units only when they are deployed at an active wartime border; alliance partners can inspect the full roster.</p></div>';
  let count=visible.reduce((sum,f)=>sum+f.divisions.length,0),people=visible.reduce((sum,f)=>sum+f.divisions.reduce((a,d)=>a+d.personnel*d.equipment,0),0),html='<h3>Military and logistics</h3><div class="card"><b>Frontline sightings</b><div class="row"><span>Observed formations / divisions</span><b>'+visible.length+' / '+count+'</b></div><div class="row"><span>Observed personnel</span><b>'+people.toFixed(1)+'k</b></div>';
  for(let f of visible){let fpeople=f.divisions.reduce((sum,d)=>sum+d.personnel*d.equipment,0);html+='<div class="row"><span>'+f.name+' · '+f.divisions.length+' divisions · active front</span><b>'+fpeople.toFixed(1)+'k</b></div>';}
  return html+'</div><p class="note">Only units deployed to the shared active front are visible. Home reserves, readiness and supply stocks remain concealed.</p>';
 }
 let divisions=milDivisions(n),personnel=milRawPersonnel(n),deployed=m.formations.filter(f=>f.deployment!=='home'&&f.arrivalTurn<=state.turn).reduce((sum,f)=>sum+f.divisions.reduce((a,d)=>a+d.personnel*d.equipment,0),0),last=m.lastMonth||{};
 let html='<h3>Military and logistics</h3><div class="card"><b>Full allied force roster</b><div class="row"><span>Personnel / divisions</span><b>'+personnel.toFixed(1)+'k / '+divisions.length+'</b></div><div class="row"><span>Readiness</span><b>'+n.ready.toFixed(0)+'%</b></div><div class="row"><span>Available manpower</span><b>'+m.availableManpower.toFixed(1)+'k</b></div><div class="row"><span>Frontline deployment</span><b>'+((n.force?deployed/n.force:0)*100).toFixed(0)+'%</b></div><div class="row"><span>Supply delivered</span><b>'+Math.round((last.supplyRatio??1)*100)+'%</b></div><div class="row"><span>Military equipment stock</span><b>'+money(n.economy.inventory.military||0)+'</b></div><div class="row"><span>Defence budget</span><b>'+n.defense+'% of GDP</b></div><div class="row"><span>Mobilization</span><b>'+(n.mobilized?'Active':'Standby')+'</b></div><h4>Formations</h4>';
 for(let f of m.formations){let w=state.wars.find(x=>x.id===f.deployment),location=f.deployment==='home'?'Home reserve':w?'Front: '+name(w.a===n.code?w.b:w.a):'In transit',fpeople=f.divisions.reduce((sum,d)=>sum+d.personnel,0);html+='<div class="row"><span>'+f.name+' · '+f.divisions.length+' divisions · '+location+'</span><b>'+fpeople.toFixed(1)+'k</b></div>';for(let i=0;i<f.divisions.length;i++){let d=f.divisions[i];html+='<div class="row"><small>Division '+(i+1)+' · readiness '+Math.round(d.readiness)+'% · equipment '+Math.round(d.equipment*100)+'%</small><small>'+d.personnel.toFixed(1)+'k</small></div>';}}
 return html+'</div>';
}
