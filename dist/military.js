'use strict';

// Personnel is measured in thousands; a standard division is 10,000 people.
// Equipment and supply stocks share the economy's illustrative euro-bn units.
const MILITARY_SCHEMA=2;
const MIL_MAX_MOVE=20;
const MIL_MAX_ENEMY_ADVANCE=4;
const MIL_DIRECT_ATTACK_RANGE=15;
const MIL_CAPTURE_PER_STEP=7;
const MIL_ADVANCE_ATTRITION=.015;
const MIL_DIVISION_SIZE=10;
const MIL_DIVISION_MAX=20;
const MIL_EQUIPMENT_COST=.001;
const MIL_RECRUIT_CASH=.004;
const MIL_SUPPLY_RATE=.0000016;
const MIL_PAYROLL_RATE=.0000008;

function milClamp(v,min,max){return Math.max(min,Math.min(max,v));}
function milDivisions(n){return(n?.military?.formations||[]).flatMap(f=>f.divisions||[]);}
let milHomeCache={};
function milHomeKeys(n,count=1){
 if(!milHomeCache[n.code]){let points=(places||[]).filter(p=>p[4]===n.code&&Number(p[3])>=10000).sort((a,b)=>b[3]-a[3]).slice(0,300).map(p=>wcKey(p[1],p[2]));if(!points.length&&world?.[n.code]?.center)points=[wcKey(...world[n.code].center)];milHomeCache[n.code]=points;}
 let keys=milHomeCache[n.code]||[],total=Math.max(1,count);return Array.from({length:total},(_,i)=>keys[Math.floor((i+.5)*keys.length/total)]||keys[i%Math.max(1,keys.length)]||null);
}
function milDivisionEntries(n){return(n?.military?.formations||[]).flatMap(f=>(f.divisions||[]).map(d=>({formation:f,division:d})));}
function milFindDivision(c,id){let n=typeof c==='string'?state.countries[c]:c;if(!n)return null;let entry=milDivisionEntries(n).find(x=>x.division.id===id);return entry?{n,...entry}:null;}
function milDeployment(d,f){return d.deployment??f?.deployment??'home';}
function milPositionKey(d){return d.location||null;}
function milDivisionPower(d){return Math.max(.05,(d.personnel||0)*milClamp(d.equipment??1,0,1)*milClamp(d.readiness??65,0,100)/100);}
function milHexDistance(a,b){let [aq,ar]=a.split(',').map(Number),[bq,br]=b.split(',').map(Number),dq=aq-bq,dr=ar-br;return Math.max(Math.abs(dq),Math.abs(dr),Math.abs(dq+dr));}function milRawForce(n){return milDivisions(n).reduce((sum,d)=>sum+Math.max(0,d.personnel||0)*milClamp(d.equipment??1,0,1),0);}
function milRawReadiness(n){let all=milDivisions(n),people=all.reduce((s,d)=>s+Math.max(0,d.personnel||0),0);return people?all.reduce((s,d)=>s+(d.personnel||0)*milClamp(d.readiness??65,0,100),0)/people:0;}
function milLegacyReadiness(n,fallback=65){let value=n?.ready;return value!==undefined&&value!==null&&Number.isFinite(Number(value))?milClamp(Number(value),0,100):fallback;}
function milMakeRoster(n,total,readiness=65){
 let remaining=Math.max(0,total),divisions=[],i=0,homes=milHomeKeys(n,Math.ceil(Math.max(0,total)/MIL_DIVISION_SIZE));
 while(remaining>.001){let personnel=Math.min(MIL_DIVISION_SIZE,remaining);i++;divisions.push({id:n.code+'-div-'+i,personnel,equipment:1,readiness:milClamp(readiness,0,100),supply:1,createdTurn:state?.turn||0,deployment:'home',location:homes[i-1]||null,lastMoveTurn:-1});remaining-=personnel;}
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
 if(m.schema!==1&&m.schema!==MILITARY_SCHEMA){m={schema:MILITARY_SCHEMA,formations:milMakeRoster(n,oldForce,oldReady),manualControl:false,lastMonth:null};n.military=m;}
 m.schema=MILITARY_SCHEMA;m.formations=Array.isArray(m.formations)?m.formations:[];let homeKeys=milHomeKeys(n,m.formations.reduce((sum,f)=>sum+(f.divisions||[]).length,0)),divisionIndex=0;
 for(let i=0;i<m.formations.length;i++){
  let f=m.formations[i];f.id??=n.code+'-formation-'+(i+1);f.name??='Formation '+(i+1);f.deployment??='home';f.arrivalTurn=Math.max(0,Number(f.arrivalTurn)||0);f.divisions=Array.isArray(f.divisions)?f.divisions:[];
  for(let j=0;j<f.divisions.length;j++){let d=f.divisions[j];d.id??=f.id+'-div-'+(j+1);d.personnel=Math.max(0,Number(d.personnel)||0);d.equipment=milClamp(Number.isFinite(Number(d.equipment))?Number(d.equipment):1,0,1);d.readiness=milClamp(Number.isFinite(Number(d.readiness))?Number(d.readiness):oldReady,0,100);d.supply=milClamp(Number.isFinite(Number(d.supply))?Number(d.supply):1,0,1);d.deployment??=f.deployment;d.arrivalTurn=Math.max(0,Number(d.arrivalTurn??f.arrivalTurn)||0);if(d.deployment!=='reserve'&&!d.location)d.location=homeKeys[divisionIndex]||null;divisionIndex++;d.lastMoveTurn=Number.isFinite(d.lastMoveTurn)?d.lastMoveTurn:-1;d.lastDirectAttackTurn=Number.isFinite(d.lastDirectAttackTurn)?d.lastDirectAttackTurn:-1;}
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
function milQuoteReinforce(c,id){
 let n=typeof c==='string'?state.countries[c]:c;milEnsureCountry(n);let entry=milFindDivision(n,id);if(!entry)return{ok:false,reason:'Division not found.'};let d=entry.division,personnel=Math.min(Math.max(0,MIL_DIVISION_MAX-d.personnel),milCapacity(n)-milRawPersonnel(n));
 let equipment=(n.gdp||1)*MIL_EQUIPMENT_COST*(personnel/MIL_DIVISION_SIZE),cash=(n.gdp||1)*MIL_RECRUIT_CASH*(personnel/MIL_DIVISION_SIZE);
 if(personnel<.1)return{ok:false,reason:d.personnel>=MIL_DIVISION_MAX?'Division is already at its 20k size limit.':'No trained manpower reserve is available.',personnel:0,equipment:0,cash:0};
 if((n.economy?.inventory?.military||0)+1e-9<equipment)return{ok:false,reason:'Military equipment stocks are too low.',personnel,equipment,cash};
 if((n.treasury||0)+1e-9<cash)return{ok:false,reason:'Treasury reserves cannot cover reinforcement.',personnel,equipment,cash};
 return{ok:true,reason:'',personnel,equipment,cash};
}
function milReinforce(c,id){
 let n=typeof c==='string'?state.countries[c]:c,quote=milQuoteReinforce(n,id);if(!quote.ok)return quote;let d=milFindDivision(n,id).division,old=d.personnel,total=old+quote.personnel;
 n.treasury-=quote.cash;n.economy.inventory.military=Math.max(0,n.economy.inventory.military-quote.equipment);
 d.equipment=milClamp((old*d.equipment+quote.personnel)/total,0,1);d.readiness=milClamp((old*d.readiness+quote.personnel*65)/total,0,100);d.supply=milClamp((old*d.supply+quote.personnel)/total,0,1);d.personnel=total;milSyncCountry(n);return{...quote,ok:true,division:id};
}
function milNextDivisionId(n){let ids=new Set(milDivisions(n).map(d=>d.id)),i=1;while(ids.has(n.code+'-div-'+i))i++;return n.code+'-div-'+i;}
function milRecruit(c){
 let n=typeof c==='string'?state.countries[c]:c,quote=milQuoteRecruit(n);if(!quote.ok)return quote;
 n.treasury-=quote.cash;n.economy.inventory.military=Math.max(0,n.economy.inventory.military-quote.equipment);
 let id=milNextDivisionId(n),number=Number(id.split('-div-').pop()),f={id:n.code+'-formation-'+(n.military.formations.length+1),name:'Reserve Division '+number,deployment:'home',arrivalTurn:0,divisions:[]};
 f.divisions.push({id,personnel:quote.personnel,equipment:1,readiness:65,supply:1,createdTurn:state.turn,deployment:'reserve',location:null,lastMoveTurn:-1});n.military.formations.push(f);
 n.military.lastRecruit={turn:state.turn,personnel:quote.personnel,equipment:quote.equipment,cash:quote.cash};milSyncCountry(n);return{...quote,ok:true,division:id};
}
function milTrainingCost(n,d){return(n.gdp||1)*.0015*Math.max(0,(d?.personnel||0)/MIL_DIVISION_SIZE);}
function milTrain(c,id=null){
 let n=typeof c==='string'?state.countries[c]:c;milEnsureCountry(n);let entry=id?milFindDivision(n,id):null,divisions=id?(entry?[entry.division]:[]):milDivisions(n);
 if(id&&!entry)return{ok:false,reason:'Division not found.'};if(!divisions.length)return{ok:false,reason:'There are no divisions to train.'};divisions=divisions.filter(d=>d.readiness<100);if(!divisions.length)return{ok:false,reason:id?'This division is already fully trained.':'All divisions are already fully trained.'};
 let cost=divisions.reduce((sum,d)=>sum+milTrainingCost(n,d),0);if(n.treasury<cost)return{ok:false,reason:'Treasury reserves cannot cover this training.'};
 let supplied=milClamp(n.military.lastMonth?.supplyRatio??1,0,1);if(supplied<.25)return{ok:false,reason:'Supply shortages prevent a useful exercise.'};
 n.treasury-=cost;let gain=4*supplied;for(let d of divisions)d.readiness=milClamp(d.readiness+gain,0,100);
 milSyncCountry(n);return{ok:true,cost,gain,divisions:divisions.length,division:id||null};
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
function milCellAllowed(n,key,w,start){
 if(key===start)return true;
 if(w){let legal=wcRoot(wcLegal(key,w)),owner=wcRoot(wcOwner(key,w));return[w.a,w.b].includes(legal)||[w.a,w.b].includes(owner);}
 return wcRoot(wcLegal(key))===n.code||wcRoot(wcOwner(key))===n.code;
}
function milFindPath(n,d,target,w,max=MIL_MAX_MOVE){
 let start=d.location;if(!start||!target||!milCellAllowed(n,target,w,start))return null;if(start===target)return[start];let first=start+'|0',queue=[first],previous=new Map([[first,null]]),nodes=new Map([[first,{key:start,steps:0,enemy:0}]]);
 for(let i=0;i<queue.length;i++){let current=queue[i],node=nodes.get(current);if(node.steps>=max)continue;for(let next of wcNeighbors(node.key)){if(!milCellAllowed(n,next,w,start))continue;let enemy=node.enemy+(w&&wcRoot(wcOwner(next,w))!==n.code?1:0);if(enemy>MIL_MAX_ENEMY_ADVANCE)continue;let nextState=next+'|'+enemy;if(previous.has(nextState))continue;previous.set(nextState,current);nodes.set(nextState,{key:next,steps:node.steps+1,enemy});if(next===target){let path=[],cursor=nextState;while(cursor){path.unshift(nodes.get(cursor).key);cursor=previous.get(cursor);}return path;}queue.push(nextState);}}
 return null;
}
function milReachableKeys(c,id){
 let entry=milFindDivision(c,id);if(!entry||entry.division.deployment==='reserve'||!entry.division.location)return[];if(entry.division.lastMoveTurn===state.turn)return[];
 let n=entry.n,d=entry.division,w=(state.wars||[]).find(x=>x.id===d.deployment&&x.active)||milActiveWars(n.code)[0]||null,start=d.location,first=start+'|0',queue=[first],nodes=new Map([[first,{key:start,steps:0,enemy:0}]]),seen=new Set([first]),reachable=new Set([start]);
 for(let i=0;i<queue.length;i++){let node=nodes.get(queue[i]);if(node.steps>=MIL_MAX_MOVE)continue;for(let next of wcNeighbors(node.key)){if(!milCellAllowed(n,next,w,start))continue;let enemy=node.enemy+(w&&wcRoot(wcOwner(next,w))!==n.code?1:0);if(enemy>MIL_MAX_ENEMY_ADVANCE)continue;let nextState=next+'|'+enemy;if(seen.has(nextState))continue;seen.add(nextState);nodes.set(nextState,{key:next,steps:node.steps+1,enemy});reachable.add(next);queue.push(nextState);}}
 return[...reachable];
}
function milWarForMove(n,d,target,hint){
 let war=hint?state.wars.find(w=>w.id===hint&&w.active):state.wars.find(w=>w.id===d.deployment&&w.active);if(war)return war;
 let legal=wcRoot(wcLegal(target));return milActiveWars(n.code).find(w=>[w.a,w.b].includes(legal))||null;
}
function milCanMergeDivisions(c,sourceId,targetId){
 let n=typeof c==='string'?state.countries[c]:c;if(!n)return{ok:false,reason:'Country not found.'};let source=milFindDivision(n,sourceId),target=milFindDivision(n,targetId);if(!source||!target)return{ok:false,reason:'Division not found.'};if(sourceId===targetId)return{ok:false,reason:'Choose two different divisions.'};let a=source.division,b=target.division;if(a.deployment==='reserve'||b.deployment==='reserve'||!a.location||!b.location)return{ok:false,reason:'Both divisions must be deployed on the map.'};if(a.deployment!=='home'&&b.deployment!=='home'&&a.deployment!==b.deployment)return{ok:false,reason:'Divisions assigned to different active wars cannot merge.'};if(a.personnel+b.personnel>MIL_DIVISION_MAX+1e-9)return{ok:false,reason:'The merged division would exceed the 20k size limit.'};return{ok:true,n,source,target};
}
function milMergeDivisions(c,sourceId,targetId){
 let check=milCanMergeDivisions(c,sourceId,targetId);if(!check.ok)return check;let{n,source,target}=check,a=source.division,b=target.division;if(a.location!==b.location)return{ok:false,reason:'Move both divisions onto the same map cell before merging.'};let oldA=a.personnel,oldB=b.personnel,total=oldA+oldB;
 b.equipment=milClamp((oldA*a.equipment+oldB*b.equipment)/total,0,1);b.readiness=milClamp((oldA*a.readiness+oldB*b.readiness)/total,0,100);b.supply=milClamp((oldA*a.supply+oldB*b.supply)/total,0,1);b.personnel=total;b.deployment=b.deployment==='home'?a.deployment:b.deployment;b.arrivalTurn=Math.max(a.arrivalTurn||0,b.arrivalTurn||0);b.lastMoveTurn=Math.max(a.lastMoveTurn??-1,b.lastMoveTurn??-1);source.formation.divisions=source.formation.divisions.filter(d=>d.id!==sourceId);milSyncCountry(n);return{ok:true,id:targetId,personnel:total};
}
function milPlaceDivision(c,id,key){
 let entry=milFindDivision(c,id);if(!entry)return{ok:false,reason:'Division not found.'};let{n,division:d}=entry;
 if(d.deployment!=='reserve')return{ok:false,reason:'This division is already deployed.'};
 if(wcRoot(wcOwner(key))!==n.code)return{ok:false,reason:'Deploy divisions on territory your government controls.'};
  d.location=key;d.deployment='home';d.arrivalTurn=state.turn;milSyncCountry(n);return{ok:true,location:key};
}
function milEnemyAt(code,key,w){
 for(let c of[w.a,w.b])if(c!==code){let found=milDivisionEntries(state.countries[c]).find(x=>x.division.deployment===w.id&&x.division.location===key);if(found)return{n:state.countries[c],...found};}
 return null;
}
function milCaptureAround(c,key,w){
 let enemy=w.a===c?w.b:w.a,queue=[key],seen=new Set(),captured=[];
 for(let i=0;i<queue.length&&captured.length<MIL_CAPTURE_PER_STEP;i++){let current=queue[i];if(seen.has(current))continue;seen.add(current);let owner=wcRoot(wcOwner(current,w));if(owner!==c&&owner!==enemy)continue;if(owner===enemy){if(milEnemyAt(enemy,current,w))continue;wcSetOwner(current,c,w);captured.push(current);}if(captured.length>=MIL_CAPTURE_PER_STEP)break;for(let next of wcNeighbors(current)){let nextOwner=wcRoot(wcOwner(next,w));if((nextOwner===c||nextOwner===enemy)&&!seen.has(next))queue.push(next);}}
 return captured;
}
function milResolveBattle(attacker,ad,defender,dd,w){
 let attackRoll=1+Math.floor(simRandom()*10),defenseRoll=1+Math.floor(simRandom()*10),attackBonus=(w.initiator===attacker.code&&w.months<3?1.25:1)*(w.postures?.[attacker.code]==='offensive'?1.15:1),defenseBonus=w.postures?.[defender.code]==='defensive'?1.2:1,attackScore=milDivisionPower(ad)*attackRoll*attackBonus,defenseScore=milDivisionPower(dd)*defenseRoll*defenseBonus,attackerWins=attackScore>=defenseScore,margin=Math.abs(attackScore-defenseScore)/Math.max(.01,attackScore,defenseScore),winnerLossRate=.015+.02*(1-margin),loserLossRate=.06+.06*margin,attackers=ad.personnel,defenders=dd.personnel,attackerLoss=attackers*(attackerWins?winnerLossRate:loserLossRate),defenderLoss=defenders*(attackerWins?loserLossRate:winnerLossRate);
 ad.personnel=Math.max(.05,attackers-attackerLoss);dd.personnel=Math.max(.05,defenders-defenderLoss);attackerLoss=attackers-ad.personnel;defenderLoss=defenders-dd.personnel;milSyncCountry(attacker);milSyncCountry(defender);
 return{attackerWins,attackRoll,defenseRoll,attackScore,defenseScore,attackerLoss,defenderLoss};
}
function milRetreatDivision(n,d,w,from,opponentLocation){
 let choices=wcNeighbors(from).filter(key=>wcRoot(wcOwner(key,w))===n.code&&!milDivisionEntries(n).some(x=>x.division.id!==d.id&&x.division.location===key));choices.sort((a,b)=>(opponentLocation?milHexDistance(b,opponentLocation)-milHexDistance(a,opponentLocation):0)||a.localeCompare(b));if(choices.length){d.location=choices[0];return{retreated:true,location:d.location};}d.deployment='reserve';d.location=null;return{retreated:false,location:null};
}
function milFieldEngagement(attacker,ad,defender,dd,w,key){let result=milResolveBattle(attacker,ad,defender,dd,w);if(result.attackerWins)result.defenderRetreat=milRetreatDivision(defender,dd,w,key,ad.location);return result;}
function milAttackDivision(c,id,enemyCode,enemyId){
 let n=state.countries[c],enemy=state.countries[enemyCode],w=milActiveWars(c).find(x=>[x.a,x.b].includes(enemyCode));if(!w)return{ok:false,reason:'Direct attacks require an active war with that country.'};let source=milFindDivision(n,id),target=milFindDivision(enemy,enemyId);if(!source||!target)return{ok:false,reason:'Division not found.'};let ad=source.division,dd=target.division;if(ad.deployment==='reserve'||dd.deployment==='reserve'||!ad.location||!dd.location)return{ok:false,reason:'Both divisions must be deployed on the map.'};if(ad.deployment!=='home'&&ad.deployment!==w.id||dd.deployment!=='home'&&dd.deployment!==w.id)return{ok:false,reason:'Both divisions must belong to this active front.'};if(ad.arrivalTurn>state.turn||dd.arrivalTurn>state.turn)return{ok:false,reason:'One division has not arrived at the front yet.'};if(ad.lastMoveTurn===state.turn||ad.lastDirectAttackTurn===state.turn)return{ok:false,reason:'This division has already acted this month.'};if(dd.lastDirectAttackTurn===state.turn)return{ok:false,reason:'That division has already fought this month.'};if(milHexDistance(ad.location,dd.location)>MIL_DIRECT_ATTACK_RANGE)return{ok:false,reason:'Enemy division must be within 15 cells to attack.'};ad.deployment=w.id;dd.deployment=w.id;let result=milResolveBattle(n,ad,enemy,dd,w);ad.lastMoveTurn=state.turn;ad.lastDirectAttackTurn=state.turn;dd.lastDirectAttackTurn=state.turn;if(result.attackerWins)result.defenderRetreat=milRetreatDivision(enemy,dd,w,dd.location,ad.location);else result.attackerRetreat=milRetreatDivision(n,ad,w,ad.location,dd.location);milSyncCountry(n);milSyncCountry(enemy);return{ok:true,war:w.id,attackerId:id,defenderId:enemyId,...result};
}
function milMoveDivision(c,id,target,hint=null){
 let entry=milFindDivision(c,id);if(!entry)return{ok:false,reason:'Division not found.'};let{n,division:d}=entry;
 if(d.deployment==='reserve'||!d.location)return{ok:false,reason:'Deploy this division onto your map first.'};if(d.lastMoveTurn===state.turn)return{ok:false,reason:'This division has already moved this month.'};
 let war=milWarForMove(n,d,target,hint),path=milFindPath(n,d,target,war,MIL_MAX_MOVE);if(!path)return{ok:false,reason:'Destination is blocked, over 20 connected cells away, or beyond the 4-cell enemy advance limit.'};if(path.length===1)return{ok:false,reason:'Choose a different map cell.'};
 let beforeCities=war?Object.fromEntries(wcCities().map(city=>[city.id,wcCityOwner(city)])):null,from=d.location,current=from,capturedKeys=[],engagements=0,battles=[],troopsLost=0,enemyPath=new Set(war?path.slice(1).filter(key=>wcRoot(wcOwner(key,war))!==n.code):[]);
 for(let key of path.slice(1)){
  if(war){if(enemyPath.has(key)){let before=d.personnel,after=Math.max(.05,before*(1-MIL_ADVANCE_ATTRITION));d.personnel=after;troopsLost+=before-after;let conflict=milEnemyAt(n.code,key,war);if(conflict){engagements++;let battle=milFieldEngagement(n,d,conflict.n,conflict.division,war,key);battles.push(battle);if(!battle.attackerWins)break;}capturedKeys.push(...milCaptureAround(n.code,key,war));}}
  current=key;
 }
 d.location=current;d.lastMoveTurn=state.turn;if(war&&(d.deployment===war.id||capturedKeys.length>0||[war.a,war.b].includes(wcRoot(wcLegal(current,war)))))d.deployment=war.id;else d.deployment='home';d.arrivalTurn=state.turn;milSyncCountry(n);
 if(war){if(typeof wcRefreshFrontier==='function')wcRefreshFrontier(war,[...path.slice(1),...capturedKeys]);wcCityChanges(war,beforeCities);war.last??={winner:null,cells:0,cities:[]};war.last.cells=(war.last.cells||0)+capturedKeys.length;war.last.winner=capturedKeys.length?n.code:war.last.winner;}
 return{ok:true,from,to:current,cells:path.indexOf(current),captured:capturedKeys.length,engagements,battles,troopsLost,war:war?.id||null};
}
function milDeployToWar(n,w,targetPercent=.65,immediate=false){
 milEnsureCountry(n);let entries=milDivisionEntries(n),assigned=entries.filter(x=>x.division.deployment===w.id).reduce((sum,x)=>sum+x.division.personnel,0),target=milRawPersonnel(n)*targetPercent;
 for(let{division:d}of entries){if(assigned>=target)break;if(d.deployment==='home'){d.deployment=w.id;d.arrivalTurn=immediate?state.turn:state.turn+1;assigned+=d.personnel;}}
}
function milSpreadFront(keys,count){
 let cells=[...new Set(keys)].sort().map(key=>{let[q,r]=key.split(',').map(Number);return{key,q,r};});
 count=Math.max(0,Math.floor(count));if(!cells.length||!count)return[];
 let limit=Math.min(cells.length,count),selected=new Set(),chosen=[],nearest=Array(cells.length).fill(Infinity);
 let centerQ=cells.reduce((sum,p)=>sum+p.q,0)/cells.length,centerR=cells.reduce((sum,p)=>sum+p.r,0);
 for(let step=0;step<limit;step++){
  let best=-1;
  if(step===0){let bestDistance=Infinity;for(let i=0;i<cells.length;i++){let p=cells[i],dq=p.q-centerQ,dr=p.r-centerR,d=Math.max(Math.abs(dq),Math.abs(dr),Math.abs(dq+dr));if(d<bestDistance){bestDistance=d;best=i;}}}
  else for(let i=0;i<cells.length;i++)if(!selected.has(i)&&(best<0||nearest[i]>nearest[best]||(nearest[i]===nearest[best]&&cells[i].key<cells[best].key)))best=i;
  selected.add(best);chosen.push(best);let p=cells[best];
  for(let i=0;i<cells.length;i++){let q=cells[i],dq=q.q-p.q,dr=q.r-p.r,d=Math.max(Math.abs(dq),Math.abs(dr),Math.abs(dq+dr));nearest[i]=Math.min(nearest[i],d);}
 }
 return Array.from({length:count},(_,i)=>cells[chosen[i%chosen.length]].key);
}
function milPrepareWar(w){
 for(let c of[w.a,w.b]){
  let n=state.countries[c];if(!n?.military)continue;milEnsureCountry(n);
  let front=(w.frontier||[]).filter(key=>wcRoot(wcOwner(key,w))===c);
  let units=milDivisionEntries(n).filter(x=>x.division.deployment!=='reserve'),positions=w.scenario?milSpreadFront(front,units.length):[];
  for(let i=0;i<units.length;i++){let d=units[i].division;d.deployment=w.id;d.arrivalTurn=state.turn;if(positions[i])d.location=positions[i];}
 }
 if(w.scenario)w.divisionSpreadVersion=1;
}
function milMigrateScenarioSpread(w){
 if(!w?.scenario||w.divisionSpreadVersion===1)return;
 for(let c of[w.a,w.b]){
  let n=state.countries[c];if(!n?.military)continue;milEnsureCountry(n);
  let units=milDivisionEntries(n).filter(x=>x.division.deployment===w.id&&x.division.lastMoveTurn<0&&x.division.lastDirectAttackTurn<0);
  if(!units.length)continue;
  let ids=new Set(units.map(x=>x.division.id)),occupied=new Set(milDivisionEntries(n).filter(x=>x.division.deployment===w.id&&!ids.has(x.division.id)).map(x=>x.division.location).filter(Boolean));
  let front=(w.frontier||[]).filter(key=>wcRoot(wcOwner(key,w))===c&&!occupied.has(key)),positions=milSpreadFront(front,units.length);
  for(let i=0;i<units.length;i++)if(positions[i])units[i].division.location=positions[i];
 }
 w.divisionSpreadVersion=1;
}
function milAutoDeploy(c){
 let n=state.countries[c];if(!n)return;milEnsureCountry(n);let wars=milActiveWars(c),activeIds=new Set(wars.map(w=>w.id)),homes=milHomeKeys(n,Math.max(1,milDivisions(n).length)),index=0;
 for(let{division:d}of milDivisionEntries(n)){if(c!==state.player&&d.deployment==='reserve'){d.deployment='home';d.location=homes[index]||milHomeKeys(n,1)[0]||null;}
  if(d.deployment!=='home'&&d.deployment!=='reserve'&&!activeIds.has(d.deployment)){d.deployment='home';d.arrivalTurn=state.turn;}
  if(c!==state.player&&wars.length&&d.deployment==='home'){let w=wars[0];d.deployment=w.id;d.arrivalTurn=state.turn;}index++;}
}
function milWarForce(w,c){let n=state.countries[c];if(!n)return 0;milEnsureCountry(n);return milDivisionEntries(n).filter(x=>x.division.deployment===w.id&&x.division.arrivalTurn<=state.turn).reduce((sum,x)=>sum+x.division.personnel*milClamp(x.division.equipment,0,1),0);}
function milWarPower(w,c){let n=state.countries[c];if(!n)return 0;milEnsureCountry(n);return milDivisionEntries(n).filter(x=>x.division.deployment===w.id&&x.division.arrivalTurn<=state.turn).reduce((sum,x)=>sum+milDivisionPower(x.division),0);}
function milDistanceToFront(key,w){return Math.min(Infinity,...(w.frontier||[]).map(front=>milHexDistance(key,front)));}
function milAtFront(d,w,range=2){return!!d.location&&milDistanceToFront(d.location,w)<=range;}
function milAIAdvanceWar(w){
 let captures={};
 for(let c of[w.a,w.b]){if(c===state.player)continue;let n=state.countries[c],enemy=c===w.a?w.b:w.a,capital=wcCities().find(city=>city.home===enemy&&city.capital),goal=capital?.key||wcKey(...world[enemy].center);
  for(let{division:d}of milDivisionEntries(n)){if(d.deployment==='reserve'||!d.location||d.lastMoveTurn===state.turn)continue;let reachable=milReachableKeys(c,d.id).map(key=>({key,enemy:wcRoot(wcOwner(key,w))===enemy,dist:milHexDistance(key,goal),steps:milHexDistance(d.location,key)})).filter(x=>x.steps>0),targets=reachable.filter(x=>x.enemy);
   targets.sort((a,b)=>a.dist-b.dist||b.steps-a.steps||a.key.localeCompare(b.key));let target=targets[0]?.key;
   if(!target){reachable.sort((a,b)=>a.dist-b.dist||b.steps-a.steps||a.key.localeCompare(b.key));target=reachable[0]?.key;}
   if(target){let order=milMoveDivision(c,d.id,target,w.id);if(order.ok&&order.captured)captures[c]=(captures[c]||0)+order.captured;}
  }
 }
 return captures;
}
function milCombatSupply(c){return milClamp(state.countries[c]?.military?.lastMonth?.supplyRatio??.6,0,1);}
function milCombatCasualties(c,w,offensive=false){
 let n=state.countries[c];if(!n)return;milEnsureCountry(n);let rate=offensive?.002:.001;
 for(let{division:d}of milDivisionEntries(n))if(d.deployment===w.id&&d.arrivalTurn<=state.turn&&milAtFront(d,w,1)){d.personnel=Math.max(.05,(d.personnel||0)*(1-rate));d.equipment=milClamp(d.equipment-(offensive?.001:.0005),.35,1);d.readiness=milClamp(d.readiness-(offensive?.45:.2),15,100);}
 milSyncCountry(n);
}
function milMonthlyAll(){
 if(!state?.countries)return;milEnsureAll();
 for(let c of Object.keys(state.countries)){
  let n=state.countries[c],m=n.military,e=n.economy;milAutoDeploy(c);
  let force=milRawForce(n),deployed=milDivisionEntries(n).filter(x=>x.division.deployment!=='home'&&x.division.deployment!=='reserve'&&x.division.arrivalTurn<=state.turn).reduce((s,x)=>s+x.division.personnel*x.division.equipment,0);
  let deployedShare=force?deployed/force:0,required=force*n.gdp*MIL_SUPPLY_RATE*(1+deployedShare*.45),capacity=m.logisticsCapacity,stock=Math.max(0,e.inventory.military||0),delivered=Math.min(required,stock,capacity),ratio=required?delivered/required:1;
  e.inventory.military=Math.max(0,stock-delivered);
  for(let{division:d}of milDivisionEntries(n)){let exposed=d.deployment!=='home'&&d.deployment!=='reserve'&&d.arrivalTurn<=state.turn,unitRatio=exposed?ratio:Math.min(1,ratio+.15);d.supply=unitRatio;if(unitRatio<.98){d.readiness=milClamp(d.readiness-(1-unitRatio)*5,15,100);d.equipment=milClamp(d.equipment-(1-unitRatio)*.004,.35,1);}else{d.readiness=milClamp(d.readiness+.18+Math.max(0,n.defense-3)*.07,15,100);d.equipment=milClamp(d.equipment+.0015,0,1);}}
  m.lastMonth={required,delivered,supplyRatio:ratio,shortage:1-ratio,logisticsCapacity:capacity,stock:e.inventory.military,deployedShare,maintenance:force*n.gdp*MIL_PAYROLL_RATE};milSyncCountry(n);
 }
}
function milPanel(n){
 milEnsureCountry(n);let m=n.military,divisions=milDivisions(n),personnel=milRawPersonnel(n),quote=milQuoteRecruit(n),wars=milActiveWars(n.code),last=m.lastMonth||{};
 let html='<div class="card"><b>Military readiness and logistics</b><div class="row"><span>Active strength index</span><b>'+n.force.toFixed(1)+'</b></div><div class="row"><span>Personnel</span><b>'+personnel.toFixed(1)+'k · '+divisions.length+' divisions</b></div><div class="row"><span>Available manpower</span><b>'+m.availableManpower.toFixed(1)+'k</b></div><div class="row"><span>Readiness</span><b>'+n.ready.toFixed(0)+'%</b></div><div class="row"><span>Supply delivered</span><b>'+Math.round((last.supplyRatio??1)*100)+'%</b></div><div class="row"><span>Monthly military maintenance</span><b>'+money(last.maintenance||n.economy.maintenance||0)+'</b></div><div class="row"><span>Mobilization</span><b>'+(n.mobilized?'Active · economic and approval cost':'Standby')+'</b></div></div>';
 html+='<button class="wide" data-action="recruit" '+(quote.ok?'':'disabled')+'>'+(quote.ok?'Recruit division · '+money(quote.cash)+' plus '+money(quote.equipment)+' equipment':'Recruit unavailable · '+quote.reason)+'</button>';
 html+=actionButton('mobilize',n.mobilized?'Demobilize reserves':'Mobilize reserves')+'<div class="card"><b>Divisions</b>';
 let index=0;for(let{division:d}of milDivisionEntries(n)){index++;let owner=d.location?wcRoot(wcOwner(d.location,state.wars.find(w=>w.id===d.deployment))||wcLegal(d.location)):null,status=d.deployment==='reserve'?'Reserve':d.location?name(owner||n.code):'Unplaced',location=d.deployment==='reserve'?'Awaiting deployment':status+' · '+(d.location||''),reinforce=milQuoteReinforce(n,d.id),trainingCost=milTrainingCost(n,d);
  html+='<div class="row"><span>Division '+index+' · '+d.personnel.toFixed(1)+'k</span><b>'+Math.round(d.readiness)+'% ready</b></div><div class="row"><small>'+location+'</small><small>'+Math.round(d.equipment*100)+'% equipment</small></div>';
  html+='<button class="wide" data-action="milTrain|'+d.id+'" '+(d.readiness<100?'':'disabled')+'>Train this division · '+money(trainingCost)+'</button>';
  html+='<button class="wide" data-action="milReinforce|'+d.id+'" '+(reinforce.ok?'':'disabled')+'>'+(reinforce.ok?'Add '+reinforce.personnel.toFixed(1)+'k troops · '+money(reinforce.cash)+' plus '+money(reinforce.equipment)+' equipment':'Reinforce unavailable · '+reinforce.reason)+'</button>';
  html+=d.deployment==='reserve'?actionButton('milPlace|'+d.id,'Deploy on map'):actionButton('milSelect|'+d.id,'Select to move');
 }
 if(!divisions.length)html+='<p>No formed units.</p>';
 html+='<p class="note">Training is priced for each division and scales with its size. Reinforcements use available manpower, treasury and military goods; divisions can hold up to 20k troops. Deploy reserves on friendly land. Select or drag a division up to 20 connected cells per month. Drag one division onto another to merge after a confirmation; cancel to keep them separate. In war, each move can cross up to four enemy-controlled cells. Each hostile route cell can capture up to seven connected surrounding cells and costs troops. Select your division, then click an enemy marker within 15 cells to attack; troop strength, readiness, posture and 1–10 rolls decide the battle.</p></div>';
 html+=wars.length?'<h3>Active campaigns</h3>'+wars.map(w=>wcCard(w)).join(''):'<p class="note">No active fronts.</p>';return html;
}
function milCanInspectFullRoster(n){let viewer=state?.countries?.[state.player];return n.code===state.player||!!(viewer&&(n.allies?.includes(state.player)||viewer.allies?.includes(n.code)));}
let milFrontProximityCache=new WeakMap();
function milFrontCellsWithin(w,range=2){
 const frontier=w.frontier||[],cached=milFrontProximityCache.get(w);
 if(cached&&cached.frontier===frontier&&cached.range===range)return cached.cells;
 const cells=new Set(frontier);let ring=new Set(frontier);
 for(let step=0;step<range;step++){
  const next=new Set();
  for(let key of ring)for(let neighbor of wcNeighbors(key))if(!cells.has(neighbor)){cells.add(neighbor);next.add(neighbor)}
  ring=next;
 }
 milFrontProximityCache.set(w,{frontier,range,cells});return cells;
}
function milVisibleFrontDivisions(n){
 const fronts=(state.wars||[]).filter(w=>w.active&&[w.a,w.b].includes(n.code)&&[w.a,w.b].includes(state.player)),entries=milDivisionEntries(n),seen=new Set();
 for(let w of fronts){const nearFront=milFrontCellsWithin(w,2);for(let{division:d}of entries)if(d.deployment===w.id&&d.arrivalTurn<=state.turn&&nearFront.has(d.location))seen.add(d)}
 return seen;
}
function milInspector(n){
 milEnsureCountry(n);let entries=milDivisionEntries(n),visible=milVisibleFrontDivisions(n),full=milCanInspectFullRoster(n);
 if(!full){
  let units=entries.filter(x=>visible.has(x.division));
  if(!units.length)return'<h3>Military and logistics</h3><div class="card"><p>Division details are unavailable. Non-allies can observe units only when deployed near a shared active wartime border; alliance partners can inspect the full roster.</p></div>';
  let people=units.reduce((sum,x)=>sum+x.division.personnel*x.division.equipment,0),html='<h3>Military and logistics</h3><div class="card"><b>Frontline sightings</b><div class="row"><span>Observed divisions</span><b>'+units.length+'</b></div><div class="row"><span>Observed personnel</span><b>'+people.toFixed(1)+'k</b></div>';
  for(let i=0;i<units.length;i++){let d=units[i].division;html+='<div class="row"><span>Division '+(i+1)+' · active front</span><b>'+d.personnel.toFixed(1)+'k</b></div>';}
  return html+'</div><p class="note">Home reserves and units away from the shared front remain concealed.</p>';
 }
 let personnel=milRawPersonnel(n),deployed=entries.filter(x=>x.division.deployment!=='home'&&x.division.deployment!=='reserve').reduce((sum,x)=>sum+x.division.personnel*x.division.equipment,0),last=n.military.lastMonth||{};
 let html='<h3>Military and logistics</h3><div class="card"><b>Full allied force roster</b><div class="row"><span>Personnel / divisions</span><b>'+personnel.toFixed(1)+'k / '+entries.length+'</b></div><div class="row"><span>Readiness</span><b>'+Math.round(n.ready)+'%</b></div><div class="row"><span>Available manpower</span><b>'+n.military.availableManpower.toFixed(1)+'k</b></div><div class="row"><span>Deployed strength</span><b>'+((n.force?deployed/n.force:0)*100).toFixed(0)+'%</b></div><div class="row"><span>Supply delivered</span><b>'+Math.round((last.supplyRatio??1)*100)+'%</b></div><div class="row"><span>Military equipment stock</span><b>'+money(n.economy.inventory.military||0)+'</b></div><div class="row"><span>Defence budget</span><b>'+n.defense+'% of GDP</b></div><h4>Divisions</h4>';
 for(let i=0;i<entries.length;i++){let d=entries[i].division;html+='<div class="row"><span>Division '+(i+1)+' · '+(d.deployment==='reserve'?'Reserve':d.location?'Deployed on map':'In transit')+'</span><b>'+d.personnel.toFixed(1)+'k</b></div><div class="row"><small>Readiness '+Math.round(d.readiness)+'% · equipment '+Math.round(d.equipment*100)+'%</small><small>'+Math.round(d.supply*100)+'% supplied</small></div>';}
 return html+'</div>';
}

