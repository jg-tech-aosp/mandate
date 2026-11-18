'use strict';

const POLITICS_SCHEMA=5;
const POLITICS_BASE_TERM=48,POLITICS_MIN_TERM=24,POLITICS_MAX_TERM=96,POLITICS_STEP=12,POLITICS_COST=20;
const POLITICS_MEDIA_DRIFT=.08,POLITICS_MEDIA_EVENT_SHIELD=.2,POLITICS_MEDIA_ELECTION_BONUS=2,POLITICS_SUPREME_ELECTION_BONUS=12;
const POLITICS_SEATS=120;
const POLITICS_BUDGET_COST=16,POLITICS_BUDGET_COOLDOWN=12;
const POLITICS_REGIMES={democratic:['LV','LT','EE','FI','SE','NO','DK','IS','IE','PT','ES','FR','DE','NL','BE','LU','AT','CH','IT','MT','SM','MC','AD','LI','VA','PL','CZ','SK','SI','HR','GR','CY'],authoritarian:['RU','BY'],hybrid:['TR','RS','AZ','AM','GE','MD','BA','AL','MK','ME','XK','UA','BG','RO','HU']};
const POLITICS_PARTY_TEMPLATES=[
 {id:'social',name:'Social Democrats',base:29,positions:{tax:.78,welfare:.88,security:.48,liberty:.78,authority:.2},populism:.25},
 {id:'liberal',name:'Liberals',base:25,positions:{tax:.36,welfare:.56,security:.52,liberty:.94,authority:.12},populism:.18},
 {id:'conservative',name:'Conservatives',base:27,positions:{tax:.34,welfare:.42,security:.78,liberty:.58,authority:.48},populism:.3},
 {id:'national',name:'National Party',base:19,positions:{tax:.48,welfare:.34,security:.9,liberty:.28,authority:.86},populism:.8}
];
const POLITICS_BILLS={
 'bill-tax-up':{id:'tax-up',label:'Raise effective tax rate by 1 point',cost:12,axis:'tax',yesWhen:'high',effect:'tax',delta:1},
 'bill-tax-down':{id:'tax-down',label:'Lower effective tax rate by 1 point',cost:12,axis:'tax',yesWhen:'low',effect:'tax',delta:-1},
 'bill-services-up':{id:'services-up',label:'Increase health and education allocations',cost:14,axis:'welfare',yesWhen:'high',effect:'services',delta:1},
 'bill-services-down':{id:'services-down',label:'Reduce health and education allocations',cost:14,axis:'welfare',yesWhen:'low',effect:'services',delta:-1},
 'bill-defence-up':{id:'defence-up',label:'Increase defence allocation by 1 point',cost:14,axis:'security',yesWhen:'high',effect:'defence',delta:1},
 'bill-defence-down':{id:'defence-down',label:'Reduce defence allocation by 1 point',cost:14,axis:'security',yesWhen:'low',effect:'defence',delta:-1},
 'bill-rights':{id:'rights',label:'Pass a judicial independence and rights act',cost:18,axis:'liberty',yesWhen:'high',effect:'rights'},
 'bill-anticorruption':{id:'anticorruption',label:'Pass an independent anti-corruption enforcement act',cost:24,axis:'liberty',yesWhen:'high',effect:'corruption'},
 'bill-emergency':{id:'emergency',label:'Grant temporary emergency powers',cost:18,axis:'authority',yesWhen:'high',effect:'emergency'}
};
const POLITICS_AXES=['tax','welfare','security','liberty','authority'];

function polNumber(value,fallback){let n=Number(value);return Number.isFinite(n)?n:fallback;}
function polRegimeBase(c){return POLITICS_REGIMES.authoritarian.includes(c)?24:POLITICS_REGIMES.hybrid.includes(c)?54:84;}
function polInitialParties(c,regime){
 let rows=POLITICS_PARTY_TEMPLATES.map(x=>({id:x.id,name:x.name,base:x.base,positions:{...x.positions},populism:x.populism,poll:x.base,seats:0}));
 if(regime==='authoritarian'){rows.find(x=>x.id==='national').base=58;rows.find(x=>x.id==='social').base=16;rows.find(x=>x.id==='liberal').base=12;rows.find(x=>x.id==='conservative').base=14;}
 else if(regime==='hybrid'){rows.find(x=>x.id==='national').base=31;rows.find(x=>x.id==='social').base=23;rows.find(x=>x.id==='liberal').base=21;rows.find(x=>x.id==='conservative').base=25;}
 let offset=((c.charCodeAt(0)*7+c.charCodeAt(1)*11)%9)-4;
 rows[0].base+=offset;rows[2].base-=offset;
 let total=rows.reduce((s,p)=>s+p.base,0);for(let p of rows)p.poll=100*p.base/total;
 return rows;
}
function polAlias(object,key,get,set){
 let descriptor=Object.getOwnPropertyDescriptor(object,key);
 if(descriptor&&!descriptor.configurable)return;
 Object.defineProperty(object,key,{configurable:true,enumerable:false,get,set});
}
function polClamp(value,min,max){return Math.max(min,Math.min(max,value));}
function polCountry(c){return state?.countries?.[c];}
function polModel(c){return polCountry(c)?.politics;}
function polEnsure(){
 if(!state)return;
 let legacyPlayer={approval:state.approval,legitimacy:state.legitimacy,power:state.politicalPower,term:state.term,election:state.election,settings:state.politics};
 state.schemaVersion=Math.max(POLITICS_SCHEMA,Number(state.schemaVersion)||0);
 state.snapElectionTerm=Math.max(0,Math.floor(polNumber(state.snapElectionTerm,0)));state.lastSnapTurn=Math.floor(polNumber(state.lastSnapTurn,-24));
 for(let c in state.countries){
  let n=state.countries[c],ai=n.ai||{},old=n.politics||{},isPlayer=c===state.player,oldSettings=isPlayer?legacyPlayer.settings:ai.politics;
  let regime=old.regime||((POLITICS_REGIMES.authoritarian.includes(c)||POLITICS_REGIMES.hybrid.includes(c)||POLITICS_REGIMES.democratic.includes(c))?(POLITICS_REGIMES.authoritarian.includes(c)?'authoritarian':POLITICS_REGIMES.hybrid.includes(c)?'hybrid':'democratic'):'democratic');
  let approval=polNumber(old.approval,isPlayer?polNumber(legacyPlayer.approval,58):polNumber(ai.approval,58));
  let legitimacy=polNumber(old.legitimacy,isPlayer?polNumber(legacyPlayer.legitimacy,75):polNumber(ai.legitimacy,60));
  let power=polNumber(old.politicalPower,isPlayer?polNumber(legacyPlayer.power,0):polNumber(ai.politicalPower,0));
  let term=polNumber(old.term,isPlayer?polNumber(legacyPlayer.term,1):polNumber(ai.term,1));
  let election=polNumber(old.nextElection,isPlayer?polNumber(legacyPlayer.election,state.turn+POLITICS_BASE_TERM):polNumber(ai.election,state.turn+POLITICS_BASE_TERM));
  let settings=old.settings||oldSettings||{};
  n.politics=old;
  let p=n.politics;
  p.schema=POLITICS_SCHEMA;p.approval=polClamp(approval,0,100);p.legitimacy=polClamp(legitimacy,0,100);p.politicalPower=Math.max(0,Math.floor(power));p.term=Math.max(1,Math.floor(term));p.nextElection=Math.max(0,Math.floor(election));
  p.settings=settings;
  p.settings.termMonths=Math.round(polClamp(polNumber(p.settings.termMonths,POLITICS_BASE_TERM),POLITICS_MIN_TERM,POLITICS_MAX_TERM)/POLITICS_STEP)*POLITICS_STEP;
  p.settings.mediaLevel=Math.floor(polClamp(polNumber(p.settings.mediaLevel,0),0,3));p.settings.supremeRule=!!p.settings.supremeRule;
  p.institutionBase=polClamp(polNumber(p.institutionBase,polRegimeBase(c)),0,100);p.rightsReforms=Math.max(0,Math.floor(polNumber(p.rightsReforms,0)));p.emergencyPowers=!!p.emergencyPowers;p.corruption=polClamp(polNumber(p.corruption,regime==='authoritarian'?58:regime==='hybrid'?34:18),0,100);p.integrityReformTerm=Math.max(0,Math.floor(polNumber(p.integrityReformTerm,0)));p.campaignTerm=Math.max(0,Math.floor(polNumber(p.campaignTerm,0)));p.campaignElectionTurn=Math.max(-1,Math.floor(polNumber(p.campaignElectionTurn,-1)));p.lastBudgetTurn=Math.floor(polNumber(p.lastBudgetTurn,-POLITICS_BUDGET_COOLDOWN));p.lastConfidenceVote=p.lastConfidenceVote&&typeof p.lastConfidenceVote==='object'?p.lastConfidenceVote:null;
 
  p.parties=Array.isArray(p.parties)&&p.parties.length?p.parties:polInitialParties(c,regime);
  for(let party of p.parties){party.positions||={};for(let axis of POLITICS_AXES)party.positions[axis]=polClamp(polNumber(party.positions[axis],.5),0,1);party.poll=polClamp(polNumber(party.poll,25),0,100);party.seats=Math.max(0,Math.floor(polNumber(party.seats,0)));party.base=polNumber(party.base,25);}
  p.parliament=p.parliament&&typeof p.parliament==='object'?p.parliament:{totalSeats:POLITICS_SEATS,seatsByParty:{},elections:0,lastElectionTurn:0};
  p.parliament.totalSeats=POLITICS_SEATS;p.parliament.seatsByParty=p.parliament.seatsByParty||{};p.parliament.elections=Math.max(0,Math.floor(polNumber(p.parliament.elections,0)));
  p.government=p.government&&typeof p.government==='object'?p.government:null;
  p.laws=Array.isArray(p.laws)?p.laws:[];p.coalitionStrain=Math.max(0,Math.floor(polNumber(p.coalitionStrain,0)));
  p.regime=regime;
  polRecomputeRegime(c);
  if(!Object.keys(p.parliament.seatsByParty).length){polUpdatePolls(c,true);polAllocateSeats(c);}
  if(!p.government||!Array.isArray(p.government.parties)||!p.government.parties.length)polFormGovernment(c,null,isPlayer?state.playerParty:null);
  else polRefreshGovernment(c);
  if(isPlayer&&(!state.playerParty||!p.parties.some(x=>x.id===state.playerParty)))state.playerParty=p.government?.leader||p.parties[0]?.id||null;
  if(ai){
   for(let key of ['approval','legitimacy','politicalPower','election','term','politics']){try{delete ai[key]}catch{}}
   polAlias(ai,'approval',()=>p.approval,v=>{p.approval=polClamp(Number(v)||0,0,100);});
   polAlias(ai,'legitimacy',()=>p.legitimacy,v=>{p.legitimacy=polClamp(Number(v)||0,0,100);});
   polAlias(ai,'politicalPower',()=>p.politicalPower,v=>{p.politicalPower=Math.max(0,Math.floor(Number(v)||0));});
   polAlias(ai,'election',()=>p.nextElection,v=>{p.nextElection=Math.max(0,Math.floor(Number(v)||0));});
   polAlias(ai,'term',()=>p.term,v=>{p.term=Math.max(1,Math.floor(Number(v)||1));});
   polAlias(ai,'politics',()=>p.settings,v=>{p.settings=v||{};});
  }
 }
 let player=polModel(state.player);if(!player)return;
 for(let key of ['approval','legitimacy','politicalPower','term','election','politics']){try{delete state[key]}catch{}}
 polAlias(state,'approval',()=>player.approval,v=>{player.approval=polClamp(Number(v)||0,0,100);});
 polAlias(state,'legitimacy',()=>player.legitimacy,v=>{player.legitimacy=polClamp(Number(v)||0,0,100);});
 polAlias(state,'politicalPower',()=>player.politicalPower,v=>{player.politicalPower=Math.max(0,Math.floor(Number(v)||0));});
 polAlias(state,'term',()=>player.term,v=>{player.term=Math.max(1,Math.floor(Number(v)||1));});
 polAlias(state,'election',()=>player.nextElection,v=>{player.nextElection=Math.max(0,Math.floor(Number(v)||0));});
 polAlias(state,'politics',()=>player.settings,v=>{player.settings=v||{};});
}
function polPolicies(c){return polModel(c)?.settings||{};}
function polPower(c){return polModel(c)?.politicalPower||0;}
function polSetPower(c,value){let p=polModel(c);if(p)p.politicalPower=Math.max(0,Math.floor(Number(value)||0));}
function polApproval(c){return polModel(c)?.approval??58;}
function polLegitimacy(c){return polModel(c)?.legitimacy??60;}

const POLITICS_BUDGET_FIELDS={tax:{axis:'tax',min:15,max:55},health:{axis:'welfare',min:1,max:15},education:{axis:'welfare',min:1,max:12},defense:{axis:'security',min:1,max:20},infra:{axis:'welfare',min:1,max:12}};
function polBudgetQuote(c,proposal={}){
 let p=polModel(c),n=polCountry(c);if(!p||!n)return{ok:false,reason:'No government is available.',yes:0,total:0};
 let changes=[];
 for(let [key,rule] of Object.entries(POLITICS_BUDGET_FIELDS)){let value=Number(proposal[key]??n[key]);if(!Number.isFinite(value)||value<rule.min||value>rule.max)return{ok:false,reason:'One or more budget settings are outside the allowed range.',yes:0,total:0};value=Math.round(value);let current=Number(n[key])||0;if(value!==current)changes.push({key,axis:rule.axis,direction:value>current?'up':'down',from:current,to:value});}
 if(!changes.length)return{ok:false,reason:'Move one or more budget sliders to prepare a proposal.',yes:0,total:0};
 if(p.government?.status==='caretaker')return{ok:false,reason:'A caretaker government cannot introduce a budget.',yes:0,total:0};
 let elapsed=state.turn-p.lastBudgetTurn,remaining=Math.max(0,POLITICS_BUDGET_COOLDOWN-elapsed);if(remaining>0)return{ok:false,reason:'A budget has already passed recently. Try again in '+remaining+' months.',yes:0,total:0};
 let yes=0;for(let change of changes)for(let party of p.parties){let position=party.positions[change.axis]??.5,agrees=change.direction==='up'?position>=.5:position<.5;if(agrees)yes+=party.seats;}
 let total=POLITICS_SEATS*changes.length,cost=POLITICS_BUDGET_COST;
 return{ok:true,reason:'',proposal:Object.fromEntries(Object.keys(POLITICS_BUDGET_FIELDS).map(k=>[k,Math.round(Number(proposal[k]??n[k]))])),changes,yes,total,cost,willPass:yes>total/2,canAfford:polPower(c)>=cost,remaining};
}
function polSubmitBudget(c,proposal={}){
 let q=polBudgetQuote(c,proposal);if(!q.ok)return q;if(!q.canAfford)return{...q,ok:false,reason:'The budget proposal requires '+q.cost+' political power.'};
 let p=polModel(c),n=polCountry(c);polSetPower(c,polPower(c)-q.cost);
 if(!q.willPass){p.government.stability=polClamp((p.government.stability||50)-8,0,100);if(c===state.player){p.approval=polClamp(p.approval-1,0,100);p.legitimacy=polClamp(p.legitimacy-1,0,100);}else{p.approval=polClamp(p.approval-1,0,100);p.legitimacy=polClamp(p.legitimacy-1,0,100);}p.laws.push({id:'budget',turn:state.turn,passed:false,yes:q.yes,total:q.total,proposal:q.proposal});let message='The national budget failed in parliament ('+q.yes+'/'+q.total+' weighted votes). Political power spent: '+q.cost+' PP.';if(c===state.player)log(message);else simRecord(c,message);return{...q,ok:true,passed:false};}
 for(let key of Object.keys(POLITICS_BUDGET_FIELDS))n[key]=q.proposal[key];p.lastBudgetTurn=state.turn;p.laws.push({id:'budget',turn:state.turn,passed:true,yes:q.yes,total:q.total,proposal:q.proposal});let message='Parliament passed the national budget. Revised allocations take effect next month.';if(c===state.player)log(message+' Political power spent: '+q.cost+' PP.');else simRecord(c,message+' Spent '+q.cost+' political power.',true);return{...q,ok:true,passed:true};
}

function polRate(approval){let rating=Math.floor(Number(approval)||0);return rating>=95?4:rating>=85?3:rating>=70?2:rating>=50?1:0;}
function polAccrue(c){if(c!==state.player&&state.countries[c].owner!==c)return 0;let earned=polRate(polApproval(c));polSetPower(c,polPower(c)+earned);return earned;}
function polReset(c){polSetPower(c,0);}
function polInstitutionScore(c){
 let p=polModel(c);if(!p)return 50;
 return polClamp(p.institutionBase-p.settings.mediaLevel*13-(p.settings.supremeRule?27:0)-(p.emergencyPowers?18:0)+p.rightsReforms*8,0,100);
}
function polRecomputeRegime(c){
 let p=polModel(c);if(!p)return 'democratic';
 p.institutionScore=polInstitutionScore(c);p.regime=p.institutionScore>=65?'democratic':p.institutionScore>=35?'hybrid':'authoritarian';return p.regime;
}
function polUpdatePolls(c,initialize=false){
 let p=polModel(c),n=polCountry(c);if(!p||!n)return;
 let market=polClamp((48-(n.tax||32))/38,0,1),welfare=polClamp(((n.health||7)+(n.education||5)-2)/22,0,1),security=polClamp((n.defense||3)/18,0,1);
 let growth=polClamp((polNumber(n.growth,0)+4)/12,0,1),debt=polClamp((n.debt||0)/Math.max(1,n.gdp||1),0,2)/2;
 let atWar=typeof simAtWar==='function'&&simAtWar(c)?1:0,approval=polApproval(c),legitimacy=polLegitimacy(c),inst=polInstitutionScore(c);
 let governing=new Set(p.government?.parties||[]),raw=[];
 for(let party of p.parties){
  let v=party.base+(party.positions.tax-market)*(market-.5)*16+(party.positions.welfare-.5)*(welfare-.5)*16+(party.positions.security-.5)*(security-.5)*12;
  v+=(party.positions.liberty-.5)*((inst/100)-.5)*10+(party.positions.authority-.5)*(1-inst/100)*10;
  v+=party.populism*(.5-growth)*8;
  if(governing.has(party.id)){v+=(approval-50)*.075+(legitimacy-50)*.035-(debt-.35)*4-(atWar*.5)+(polNumber(n.morale,65)-65)*.08;if(p.campaignTerm===p.term&&state.turn<=p.campaignElectionTurn)v+=2.8;}
  if(p.regime==='authoritarian'&&governing.has(party.id))v+=(100-inst)*.18;
  raw.push(Math.max(1,v));
 }
 let total=raw.reduce((a,b)=>a+b,0),fresh=raw.map(x=>100*x/total);
 for(let i=0;i<p.parties.length;i++)p.parties[i].poll=initialize?fresh[i]:p.parties[i].poll*.82+fresh[i]*.18;
 let norm=p.parties.reduce((s,x)=>s+x.poll,0)||1;for(let party of p.parties)party.poll=100*party.poll/norm;
}
function polAllocateSeats(c){
 let p=polModel(c);if(!p)return;
 let seats=Object.fromEntries(p.parties.map(x=>[x.id,0]));
 for(let i=0;i<POLITICS_SEATS;i++){let winner=p.parties.reduce((best,x)=>x.poll/(seats[x.id]+1)>best.poll/(seats[best.id]+1)?{id:x.id,poll:x.poll}:best,{id:p.parties[0].id,poll:-1});seats[winner.id]++;}
 p.parliament.seatsByParty=seats;for(let party of p.parties)party.seats=seats[party.id]||0;
}
function polSeatShare(c,partyIds){
 let p=polModel(c),ids=new Set(partyIds||[]);if(!p)return 0;
 let count=p.parties.reduce((sum,x)=>sum+(ids.has(x.id)?x.seats:0),0);
 return 100*count/POLITICS_SEATS;
}
function polCoalitionCost(parties){
 if(!parties.length)return Infinity;
 let avg={};for(let axis of POLITICS_AXES)avg[axis]=parties.reduce((s,p)=>s+p.positions[axis],0)/parties.length;
 let cohesion=parties.reduce((s,p)=>s+POLITICS_AXES.reduce((v,a)=>v+Math.abs(p.positions[a]-avg[a]),0),0)/parties.length;
 let seats=parties.reduce((s,p)=>s+p.seats,0);
 return Math.max(0,seats-60)*.2+cohesion*9-parties[0].seats*.002;
}
function polFormGovernment(c,preserve=null,preferredLeader=null){
 let p=polModel(c);if(!p)return;
 if(preserve?.length&&polSeatShare(c,preserve)>=50){p.government={leader:preserve.reduce((best,id)=>{let x=p.parties.find(t=>t.id===id);let b=p.parties.find(t=>t.id===best);return !b||(x?.seats||0)>b.seats?id:best;},null),parties:preserve.slice(),seatShare:polSeatShare(c,preserve),status:'majority',stability:55,formedTurn:state.turn};polRefreshGovernment(c);return p.government;}
 if(preferredLeader&&p.parties.some(x=>x.id===preferredLeader)){
  let leader=p.parties.find(x=>x.id===preferredLeader),rest=p.parties.filter(x=>x.id!==preferredLeader),best=null;
  for(let mask=0;mask<(1<<rest.length);mask++){let group=[leader,...rest.filter((_,i)=>mask&(1<<i))];if(group.reduce((sum,x)=>sum+x.seats,0)<POLITICS_SEATS/2)continue;let cost=polCoalitionCost(group);if(!best||cost<best.cost)best={group,cost};}
  let group=best?.group||[leader],ids=group.map(x=>x.id);p.government={leader:preferredLeader,parties:ids,seatShare:polSeatShare(c,ids),status:'majority',stability:55,formedTurn:state.turn};polRefreshGovernment(c);return p.government;
 }
 let best=null,parties=p.parties;
 for(let mask=1;mask<(1<<parties.length);mask++){
  let group=parties.filter((_,i)=>mask&(1<<i)),seatCount=group.reduce((s,x)=>s+x.seats,0);if(seatCount<60)continue;
  group.sort((a,b)=>b.seats-a.seats);let cost=polCoalitionCost(group);
  if(!best||cost<best.cost)best={group,cost};
 }
 if(!best){let lead=parties.slice().sort((a,b)=>b.seats-a.seats)[0];best={group:[lead],cost:0};}
 p.government={leader:best.group[0].id,parties:best.group.map(x=>x.id),seatShare:polSeatShare(c,best.group.map(x=>x.id)),status:polSeatShare(c,best.group.map(x=>x.id))>=50?'majority':'minority',stability:55,formedTurn:state.turn};
 polRefreshGovernment(c);return p.government;
}
function polRefreshGovernment(c){
 let p=polModel(c);if(!p?.government)return;
 p.government.seatShare=polSeatShare(c,p.government.parties);
 if(p.government.status!=='caretaker')p.government.status=p.government.seatShare>=50?'majority':'minority';
}
function polGovernmentPosition(c,axis){
 let p=polModel(c);if(!p)return .5;let ids=p.government?.parties||[],parties=p.parties.filter(x=>ids.includes(x.id));if(!parties.length)parties=p.parties.slice().sort((a,b)=>b.seats-a.seats).slice(0,1);
 let weight=parties.reduce((s,x)=>s+x.seats,0)||parties.length;
 return parties.reduce((s,x)=>s+x.positions[axis]*(x.seats||1),0)/weight;
}
function polElectionScore(c){
 let p=polModel(c);if(!p)return 0;
 let ids=new Set(p.government?.parties||[]),share=p.parties.reduce((s,x)=>s+(ids.has(x.id)?x.poll:0),0);
 let settings=polPolicies(c);
 return polClamp(share+(polApproval(c)-50)*.12+(polLegitimacy(c)-50)*.05+settings.mediaLevel*POLITICS_MEDIA_ELECTION_BONUS+(settings.supremeRule?POLITICS_SUPREME_ELECTION_BONUS:0)+(p.regime==='authoritarian'?8:0),0,100);
}

function polCampaignQuote(c){
 let p=polModel(c),n=polCountry(c);if(!p||!n)return{ok:false,reason:'No government is available.'};
 let election=c===state.player?state.election:n.ai?.election,remaining=Number(election)-state.turn,cost=Math.max(0,n.gdp||0)*.012;
 if(p.government?.status==='caretaker')return{ok:false,reason:'A caretaker government cannot launch a campaign.',cost};
 if(p.campaignTerm===p.term)return{ok:false,reason:'A constituency campaign has already run this term.',cost};
 if(remaining<6||remaining>12)return{ok:false,reason:'Available only 6–12 months before the scheduled election.',cost};
 if((n.treasury||0)+1e-9<cost)return{ok:false,reason:'Treasury reserves cannot cover the campaign.',cost};
 return{ok:true,cost,electionTurn:Number(election),remaining};
}
function polStartCampaign(c){
 let q=polCampaignQuote(c);if(!q.ok)return q;let p=polModel(c),n=polCountry(c);
 n.treasury-=q.cost;p.campaignTerm=p.term;p.campaignElectionTurn=q.electionTurn;
 let message='A constituency campaign is under way. It costs 1.2% of GDP and modestly supports governing-party polling through the election; it does not raise public approval.';
 if(c===state.player)log(message);else simRecord(c,'Funded a constituency campaign from national reserves.');
 return{...q,ok:true};
}

function polRunElection(c){
 polEnsure();let p=polModel(c);if(!p)return{retained:false,score:0,share:0};
 let old=(p.government?.parties||[]).slice();polUpdatePolls(c,true);polAllocateSeats(c);
 let seats=old.reduce((s,id)=>s+(p.parliament.seatsByParty[id]||0),0),share=p.parties.reduce((s,x)=>s+(old.includes(x.id)?x.poll:0),0),score=polElectionScore(c);
 let retained=seats>=60;
 if(retained)polFormGovernment(c,old);else polFormGovernment(c);
 p.parliament.lastElectionTurn=state.turn;p.parliament.elections++;
 p.term++;p.nextElection=state.turn+p.settings.termMonths;p.coalitionStrain=0;polReset(c);
 if(c===state.player){state.legitimacy=polClamp(state.legitimacy+(retained?2:-3),0,100);state.approval=polClamp(state.approval+(retained?2:-4),0,100);}
 else{let ai=state.countries[c].ai;if(ai){ai.legitimacy=polClamp(ai.legitimacy+(retained?2:-3),0,100);ai.approval=polClamp(ai.approval+(retained?2:-4),0,100);}}
 let result={retained,score,share,seats,government:p.government};
 return result;
}
function polBillSupport(c,bill){
 let p=polModel(c);if(!p)return{yes:0,total:POLITICS_SEATS,passed:false};
 let yes=0;for(let party of p.parties){let v=party.positions[bill.axis]??.5,approve=bill.yesWhen==='high'?v>=.5:v<.5;if(approve)yes+=party.seats;}
 return{yes,total:POLITICS_SEATS,passed:yes>POLITICS_SEATS/2};
}
function polBillUnavailable(c,bill){
 let n=polCountry(c),p=polModel(c);if(!n||!p)return 'No country government is available.';
 if(p.government?.status==='caretaker')return 'The caretaker government cannot introduce legislation.';
 if(bill.effect==='tax'&&(n.tax+(bill.delta||0)<15||n.tax+(bill.delta||0)>55))return 'The tax rate is already at this limit.';
 if(bill.effect==='services'&&bill.delta>0&&n.health>=15&&n.education>=12)return 'Health and education allocations are already at their limits.';
 if(bill.effect==='services'&&bill.delta<0&&n.health<=1&&n.education<=1)return 'Health and education allocations are already at their limits.';
 if(bill.effect==='defence'&&((bill.delta>0&&n.defense>=20)||(bill.delta<0&&n.defense<=1)))return 'Defence allocation is already at this limit.';
 if(bill.effect==='rights'&&p.rightsReforms>=3)return 'The parliamentary rights programme is complete.';
 if(bill.effect==='corruption'&&p.integrityReformTerm===p.term)return 'Only one anti-corruption act can pass each parliamentary term.';
 if(bill.effect==='corruption'&&p.corruption<=5)return 'Corruption exposure is already low.';
 if(bill.effect==='emergency'&&p.emergencyPowers)return 'Emergency powers are already in force.';
 return '';
}
function polQuote(c,action){
 let p=polModel(c),settings=polPolicies(c);if(!p)return{ok:false,reason:'No political model is available.'};
 let bill=POLITICS_BILLS[action];
 if(bill){let reason=polBillUnavailable(c,bill),vote=polBillSupport(c,bill);return{ok:!reason,reason,action,law:bill.id,cost:bill.cost,positive:false,yes:vote.yes,total:vote.total,willPass:vote.passed,canAfford:polPower(c)>=bill.cost};}
 let term=settings.termMonths,level=settings.mediaLevel,q={ok:true,action,positive:false,severity:1,current:term,next:term};
 if(action==='term-shorter'||action==='term-longer'){
  q.next=term+(action==='term-shorter'?-POLITICS_STEP:POLITICS_STEP);
  if(q.next<POLITICS_MIN_TERM||q.next>POLITICS_MAX_TERM)return{ok:false,reason:'The term interval is already at its limit.'};
  let before=Math.abs(term-POLITICS_BASE_TERM),after=Math.abs(q.next-POLITICS_BASE_TERM),towardBaseline=after<before;
  q.severity=Math.max(1,Math.round((towardBaseline?before:after)/POLITICS_STEP));
  q.positive=term>POLITICS_BASE_TERM?towardBaseline:term<POLITICS_BASE_TERM?!towardBaseline:q.next<POLITICS_BASE_TERM;
 }else if(action==='media-up'){
  if(level>=3)return{ok:false,reason:'Media consolidation is already at its maximum.'};
  q.severity=level+1;q.positive=false;q.next=level+1;
 }else if(action==='media-down'){
  if(level<=0)return{ok:false,reason:'Media independence is already restored.'};
  q.severity=level;q.positive=true;q.next=level-1;
 }else if(action==='supreme-on'){
  if(settings.supremeRule)return{ok:false,reason:'Supreme rule is already in effect.'};
  q.severity=4;q.positive=false;
 }else if(action==='supreme-off'){
  if(!settings.supremeRule)return{ok:false,reason:'Supreme rule is not in effect.'};
  q.severity=4;q.positive=true;
 }else return{ok:false,reason:'Unknown political action.'};
 q.cost=q.severity*POLITICS_COST;q.approvalDelta=(q.positive?1:-1)*q.severity*2;q.legitimacyDelta=(q.positive?1:-1)*q.severity*3;q.canAfford=polPower(c)>=q.cost;
 return q;
}
function polApplyBill(c,bill){
 let n=polCountry(c),p=polModel(c),vote=polBillSupport(c,bill);polSetPower(c,polPower(c)-bill.cost);
 if(!vote.passed){
  p.government.stability=polClamp((p.government.stability||50)-8,0,100);
  if(c===state.player){state.approval=polClamp(state.approval-1,0,100);state.legitimacy=polClamp(state.legitimacy-1,0,100);}else{n.ai.approval=polClamp(n.ai.approval-1,0,100);n.ai.legitimacy=polClamp(n.ai.legitimacy-1,0,100);}
  p.laws.push({id:bill.id,turn:state.turn,passed:false,yes:vote.yes,total:vote.total});
  let failed=bill.label+' failed in parliament ('+vote.yes+'/'+vote.total+' votes).';
  if(c===state.player)log(failed+' Political power spent: '+bill.cost+' PP.');else simRecord(c,failed+' Spent '+bill.cost+' political power.');
  return false;
 }
 if(bill.effect==='tax')n.tax=polClamp(n.tax+(bill.delta||0),15,55);
 if(bill.effect==='services'){n.health=polClamp(n.health+(bill.delta>0?.5:-.5),1,15);n.education=polClamp(n.education+(bill.delta>0?.5:-.5),1,12);}
 if(bill.effect==='defence')n.defense=polClamp(n.defense+(bill.delta||0),1,20);
 if(bill.effect==='rights'){p.rightsReforms++;p.settings.mediaLevel=Math.max(0,p.settings.mediaLevel-1);p.settings.supremeRule=false;}
 if(bill.effect==='corruption'){p.corruption=Math.max(5,p.corruption-12);p.integrityReformTerm=p.term;}
 if(bill.effect==='emergency')p.emergencyPowers=true;
 p.laws.push({id:bill.id,turn:state.turn,passed:true,yes:vote.yes,total:vote.total});
 polRecomputeRegime(c);
 let message='Parliament passed: '+bill.label+'. Government: '+p.government.status+' ('+Math.round(p.government.seatShare)+'% of seats).';
 if(c===state.player)log(message+' Political power spent: '+bill.cost+' PP.');else simRecord(c,message+' Spent '+bill.cost+' political power.',true);
 return true;
}
function polAction(c,action){
 let bill=POLITICS_BILLS[action];if(bill){let q=polQuote(c,action);if(!q.ok||!q.canAfford)return false;return polApplyBill(c,bill);}
 let q=polQuote(c,action);if(!q.ok||!q.canAfford)return false;
 let p=polPolicies(c),ai=c===state.player?null:state.countries[c].ai;
 polSetPower(c,polPower(c)-q.cost);
 if(action==='term-shorter'||action==='term-longer'){
  let currentElection=c===state.player?state.election:ai.election;
  let nextElection=Math.max(state.turn+1,currentElection+(q.next-q.current));
  p.termMonths=q.next;
  if(c===state.player)state.election=nextElection;else ai.election=nextElection;
 }else if(action==='media-up'||action==='media-down')p.mediaLevel=q.next;
 else p.supremeRule=action==='supreme-on';
 if(c===state.player){state.approval=polClamp(state.approval+q.approvalDelta,0,100);state.legitimacy=polClamp(state.legitimacy+q.legitimacyDelta,0,100);}
 else{ai.approval=polClamp(ai.approval+q.approvalDelta,0,100);ai.legitimacy=polClamp(ai.legitimacy+q.legitimacyDelta,0,100);}
 polRecomputeRegime(c);
 let message={'term-shorter':'Shortened the election interval to '+(q.next/12)+' years.','term-longer':'Extended the election interval to '+(q.next/12)+' years.','media-up':'Consolidated media control to level '+q.next+' of 3.','media-down':'Restored media independence to level '+q.next+' of 3.','supreme-on':'Established supreme rule and weakened electoral safeguards.','supreme-off':'Reversed supreme rule and restored electoral safeguards.'}[action];
 if(c===state.player)log(message+' Political power spent: '+q.cost+' PP.');else simRecord(c,message+' Spent '+q.cost+' political power.');
 return true;
}

function polNoConfidence(c){
 let p=polModel(c),approval=polApproval(c),stability=p.government?.stability??50;if(approval>=30||p.government?.status==='caretaker')return false;
 let chance=polClamp(.12+(30-approval)*.018+Math.max(0,55-stability)*.006,0,.75);if(simRandom()>=chance)return false;
 let government=new Set(p.government?.parties||[]),partners=p.parties.filter(x=>government.has(x.id)&&x.id!==p.government?.leader),opposition=p.parties.filter(x=>!government.has(x.id)),partnerChance=polClamp(.12+(30-approval)*.01+Math.max(0,45-stability)*.02+p.coalitionStrain*.08,.12,.85),mover=partners.length&&simRandom()<partnerChance?partners.slice().sort((a,b)=>a.seats-b.seats)[0]:null;
 let yes=opposition.reduce((sum,x)=>sum+x.seats,0);if(mover)yes+=mover.seats;
 let defectionChance=polClamp(.015+(30-approval)*.025+Math.max(0,50-stability)*.02+p.coalitionStrain*.1,0,.85);
 for(let party of partners)if(party!==mover&&simRandom()<defectionChance)yes+=party.seats;
 let passed=yes>=POLITICS_SEATS/2,source=mover?mover.name:'opposition parties';p.lastConfidenceVote={turn:state.turn,source,yes,passed};
 if(passed){p.government.status='caretaker';p.government.parties=[];p.government.seatShare=0;p.government.stability=0;p.nextElection=Math.min(p.nextElection,state.turn+3);p.coalitionStrain=0;}
 else{p.government.stability=polClamp(stability-5,0,100);p.coalitionStrain=Math.min(5,p.coalitionStrain+1);}
 let message=source+' moved a vote of no confidence at '+Math.floor(approval)+'% approval. '+(passed?'The motion passed ('+yes+'/120 seats); a caretaker cabinet and early election follow.':'The motion failed ('+yes+'/120 seats); coalition strain increased.');
 if(c===state.player)log(message,true);else simRecord(c,message,true);return true;
}

function polMonthly(c){
 if(!state?.countries?.[c])return;
 let p=polModel(c),n=polCountry(c);polRecomputeRegime(c);polUpdatePolls(c,false);
 let unrest=state.civicDissatisfaction?.[c]||0,solvency=polClamp(1-(n.debt||0)/Math.max(1,n.gdp||1),-1,1);
 let seatShare=p.government?.status==='caretaker'?0:p.government?.seatShare||0;
 let stability=polClamp(seatShare*.42+polLegitimacy(c)*.25+polApproval(c)*.26+polInstitutionScore(c)*.07-unrest*.18-p.corruption*.025+solvency*5,0,100);
 if(p.government){p.government.stability=stability;if(p.regime==='authoritarian'&&p.emergencyPowers) p.government.stability=polClamp(stability+8,0,100);}
 if(p.government?.status==='caretaker')return;
 if(polNoConfidence(c))return;
 if(p.regime!=='authoritarian'&&stability<18)p.coalitionStrain++;else p.coalitionStrain=0;
 if(p.coalitionStrain>=6){
  p.government.status='caretaker';p.government.parties=[];p.government.seatShare=0;p.nextElection=Math.min(p.nextElection,state.turn+3);p.coalitionStrain=0;
  let message='The governing coalition collapsed under low legitimacy and public pressure; a snap election is due.';
  if(c===state.player)log(message,true);else simRecord(c,message,true);
 }
}
function polAI(c){
 if(c===state.player||state.countries[c].owner!==c)return;
 let n=state.countries[c],ai=n.ai,p=polPolicies(c),phase=c.charCodeAt(0)+c.charCodeAt(1);
 if((state.turn+phase)%12!==0)return;
 let action=null,pp=polPower(c);
 if((ai.legitimacy<28||ai.approval<30)&&p.supremeRule&&pp>=80)action='supreme-off';
 else if((ai.legitimacy<24||ai.approval<25)&&p.mediaLevel>0&&pp>=p.mediaLevel*POLITICS_COST)action='media-down';
 else if(ai.risk>=.8){
  if(!p.supremeRule&&pp>=80)action='supreme-on';
  else if(p.termMonths<POLITICS_MAX_TERM){let q=polQuote(c,'term-longer');if(q.ok&&pp>=q.cost)action='term-longer';}
  if(!action&&p.mediaLevel<3){let q=polQuote(c,'media-up');if(q.ok&&pp>=q.cost)action='media-up';}
 }else if(ai.welfare>=.65){
  if(p.termMonths>36){let q=polQuote(c,'term-shorter');if(q.ok&&pp>=q.cost)action='term-shorter';}
  else if(p.mediaLevel>0){let q=polQuote(c,'media-down');if(q.ok&&pp>=q.cost)action='media-down';}
 }
 if(!action){
  let billAction=null;
  if(p.corruption>=35&&pp>=POLITICS_BILLS['bill-anticorruption'].cost)billAction='bill-anticorruption';
  else if(n.debt/Math.max(1,n.gdp)>1&&n.tax<42)billAction='bill-tax-up';
  else if(ai.welfare>.7&&n.health<9)billAction='bill-services-up';
  else if(ai.risk>.65&&n.defense<8)billAction='bill-defence-up';
  if(billAction){let q=polQuote(c,billAction);if(q.ok&&q.canAfford&&q.willPass)action=billAction;}
 }
 if(!action){let q=polCampaignQuote(c);if(q.ok)action='campaign';}
 if(action==='campaign')polStartCampaign(c);else if(action)polAction(c,action);
}
function polButton(action,label){
 let q=polQuote(state.player,action);
 return'<button class="wide" data-action="politics:'+action+'" '+(!q.ok||!q.canAfford?'disabled':'')+'>'+label+' · '+(q.cost||0)+' PP</button>';
}
function polBillButton(action,bill){
 let q=polQuote(state.player,action),support=q.total?Math.round(100*q.yes/q.total):0;
 let forecast=q.willPass?'Likely passage':'Likely defeat';
 return'<button class="wide" data-action="politics:'+action+'" '+(!q.ok||!q.canAfford?'disabled':'')+'>'+bill.label+' · '+q.cost+' PP · '+support+'% seats · '+forecast+'</button>';
}
function polPanel(){
 polEnsure();let p=polModel(state.player),rate=polRate(state.approval),gov=p.government,html='<h3>Political institutions</h3><div class="card"><div class="row"><span>Regime</span><b>'+p.regime[0].toUpperCase()+p.regime.slice(1)+'</b></div><div class="row"><span>Institutional score</span><b>'+Math.round(p.institutionScore)+'/100</b></div><div class="row"><span>Corruption exposure</span><b>'+Math.round(p.corruption)+'/100</b></div><div class="row"><span>Parliament</span><b>'+POLITICS_SEATS+' seats · '+p.parliament.elections+' elections</b></div><div class="row"><span>Government</span><b>'+(gov.status==='caretaker'?'Caretaker':gov.parties.map(id=>p.parties.find(x=>x.id===id)?.name||id).join(' + '))+'</b></div><div class="row"><span>Coalition seats / stability</span><b>'+Math.round(gov.seatShare)+'% / '+Math.round(gov.stability)+'</b></div></div>';
 html+='<h3>Political power</h3><div class="card"><div class="row"><span>Available</span><b>'+polPower(state.player)+' PP</b></div><div class="row"><span>Monthly gain</span><b>'+rate+' PP</b></div><p>Earn 1 PP at 50–69% approval, 2 at 70–84%, 3 at 85–94%, and 4 at 95–100%. Below 50% earns none. Political power resets at elections.</p></div>';
 html+='<p class="note">If approval falls below 30%, opposition parties or coalition partners may move a vote of no confidence. The risk rises as approval and coalition stability fall.</p><h3>Party representation</h3><div class="card">';
 for(let party of p.parties.slice().sort((a,b)=>b.seats-a.seats))html+='<div class="row"><span>'+party.name+'</span><b>'+party.poll.toFixed(1)+'% · '+party.seats+' seats</b></div><p class="note">Positions · tax '+Math.round(party.positions.tax*100)+' · welfare '+Math.round(party.positions.welfare*100)+' · security '+Math.round(party.positions.security*100)+' · liberty '+Math.round(party.positions.liberty*100)+' · authority '+Math.round(party.positions.authority*100)+'</p>';
 html+='<p>Votes respond to growth, debt, public services, defence policy, government performance, and institutions. Parliament uses proportional D’Hondt seat allocation; coalition partners must assemble a majority.</p></div>';
 html+='<h3>Legislation</h3><div class="card"><p>Party interests determine parliamentary votes. A defeated bill still spends political power and weakens government stability.</p>';
 for(let action in POLITICS_BILLS)html+=polBillButton(action,POLITICS_BILLS[action]);
 html+='<p class="note">Passed laws change tax, spending, democratic safeguards, or integrity enforcement. Integrity reforms improve government stability and investment confidence over time.</p></div>';
 html+='<h3>Political controls</h3><div class="card"><b>Election interval · '+(p.settings.termMonths/12)+' years</b><p>Shorter intervals strengthen accountability. Longer intervals delay the next election and PP reset.</p>';
 if(p.settings.termMonths>POLITICS_MIN_TERM)html+=polButton('term-shorter','Shorten by 1 year');if(p.settings.termMonths<POLITICS_MAX_TERM)html+=polButton('term-longer','Extend by 1 year');
 html+='</div><div class="card"><b>Media control · level '+p.settings.mediaLevel+'/3</b><p>Each level slightly improves monthly approval, softens negative event impacts, and adds 2 points to modeled election support. Consolidation harms approval and legitimacy; reversal restores them.</p>';
 if(p.settings.mediaLevel<3)html+=polButton('media-up','Consolidate media · severity '+(p.settings.mediaLevel+1));if(p.settings.mediaLevel>0)html+=polButton('media-down','Restore media independence · severity '+p.settings.mediaLevel);
 html+='</div><div class="card"><b>Supreme rule · '+(p.settings.supremeRule?'in effect':'not in effect')+'</b><p>It adds 12 points to modeled election support while weakening institutional safeguards.</p>'+ (p.settings.supremeRule?polButton('supreme-off','Restore electoral safeguards · severity 4'):polButton('supreme-on','Establish supreme rule · severity 4'))+'</div>';
 html+='<p class="note">Actions and reversals cost 20 PP per severity level. Approval and legitimacy effects scale with severity. Emergency powers improve short-term government stability while reducing institutional strength.</p>';
 return html;
}
