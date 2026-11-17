'use strict';
// Illustrative game personalities, not representations of real governments.
let simGridCache=null;
function simRandom(){state.rng=(Math.imul(state.rng||0x4d414e44,1664525)+1013904223)>>>0;return state.rng/4294967296;}
function simPersonality(c){
 let p={agenda:'Economic development',focus:'growth',risk:.25,welfare:.55,rivals:[]};
 if(['LV','LT','EE','PL','FI'].includes(c))p={agenda:'Deterrence and resilience',focus:'security',risk:.2,welfare:.6,rivals:['RU']};
 if(['SE','NO','DK','IS'].includes(c))p={agenda:'Public services and collective security',focus:'welfare',risk:.12,welfare:.85,rivals:['RU']};
 if(['DE','FR','NL','BE','LU','ES','IT','PT'].includes(c))p={agenda:'European trade and stability',focus:'trade',risk:.15,welfare:.65,rivals:[]};
 if(['CH','AT','IE','MT'].includes(c))p={agenda:'Neutrality and prosperity',focus:'neutrality',risk:.04,welfare:.7,rivals:[]};
 if(c==='UA')p={agenda:'Territorial recovery and national resilience',focus:'recovery',risk:.55,welfare:.65,rivals:['RU']};
 if(c==='RU')p={agenda:'Military pressure and regional influence',focus:'influence',risk:.9,welfare:.35,rivals:['UA']};
 if(c==='BY')p={agenda:'Regime stability and Russian ties',focus:'security',risk:.25,welfare:.4,rivals:[]};
 if(c==='TR')p={agenda:'Regional influence and strategic autonomy',focus:'influence',risk:.6,welfare:.45,rivals:['GR','CY']};
 if(c==='RS')p={agenda:'Regional influence and economic development',focus:'influence',risk:.55,welfare:.5,rivals:['XK']};
 if(c==='AZ')p={agenda:'Regional leverage and energy exports',focus:'influence',risk:.65,welfare:.4,rivals:['AM']};
 if(c==='AM'||c==='MD'||c==='GE')p={agenda:'Security and diplomatic partnerships',focus:'security',risk:.12,welfare:.6,rivals:c==='AM'?['AZ']:['RU']};
 return p;
}
function simRelation(a,b){let x=state.countries[a],y=state.countries[b];return x.relations[b]??y.relations[a]??(a===b?100:mode!=='free'&&NATO.includes(a)&&NATO.includes(b)?65:20);}
function simSetRelation(a,b,value){value=clamp(value,-100,100);state.countries[a].relations[b]=value;state.countries[b].relations[a]=value;}
function simFrontPair(a,b){return !!state.front&&a!==b&&['RU','UA'].includes(a)&&['RU','UA'].includes(b);}
function simAtWar(c,other){return state.wars.some(w=>w.active&&[w.a,w.b].includes(c)&&(!other||[w.a,w.b].includes(other)));}
function simGrid(){
 if(simGridCache)return simGridCache;
 const radius=.045,wide=Math.sqrt(3)*radius*1.5,high=radius*1.5,cells=[],lookup=new Map(),initial=[];
 for(let row=0;row<=125;row++)for(let q=-Math.ceil(row/2);q<170-Math.floor(row/2);q++){
  let x=22+wide*(q+row/2),y=44+high*row;
  if(!inside([x,y],world.UA.feature))continue;
  lookup.set(q+','+row,cells.length);cells.push([+x.toFixed(6),+y.toFixed(6),q,row]);initial.push(inside([x,y],occupationData)?1:0);
 }
 const neighbors=cells.map(c=>[[1,0],[-1,0],[0,1],[0,-1],[1,-1],[-1,1]].map(([dq,dr])=>lookup.get((c[2]+dq)+','+(c[3]+dr))).filter(i=>i!==undefined));
 return simGridCache={cells,neighbors,initial,radius};
}
function simEnsureWorld(){
 state.rng??=0x4d414e44;state.offers??=[];
 for(let c in state.countries){let n=state.countries[c];n.ai??={...simPersonality(c),approval:58,election:state.turn+48,term:1,lastAction:'Government agenda established.',lastTurn:-10,decisions:0,history:[]};}
 polEnsure();
 econEnsure();
 milEnsureAll();
 wcEnsureWorld();
 resEnsure();
}
function simDrawFront(){} // Rendering is unified in wcDraw().
function simFrontCard(){return '';}
function simCeasefire(){return wcPeace(wcFind(state.player,target));}
function simResumeFront(){let w=wcFind(state.player,target,true);if(!w)return false;wcSeed(w);w.active=true;log(`Hostilities between ${name(w.a)} and ${name(w.b)} resume from the saved line of control.`,true);return true;}
function simThreat(c){let n=state.countries[c];return simAtWar(c)?1:n.ai.rivals.some(r=>simAtWar(r))?.75:n.ai.rivals.length?.5:.1;}
function simRecord(c,message,important=false){let ai=state.countries[c].ai;ai.lastAction=message;ai.lastTurn=state.turn;ai.decisions++;ai.history.unshift({turn:state.turn,text:message});ai.history=ai.history.slice(0,5);if(important||c===target)log(`${name(c)}: ${message}`);}
function simSpend(n,amount){if(n.treasury<amount)return false;n.treasury-=amount;return true;}
function simOffer(c,type){if(state.offers.some(o=>o.from===c&&o.type===type))return;state.offers.push({id:'offer_'+c+'_'+type+'_'+state.turn,from:c,type,expires:state.turn+6});simRecord(c,`Proposed a ${type==='trade'?'trade agreement':'defence pact'} to your government.`,true);}
function simAcceptOffer(key){let o=state.offers.find(o=>o.id===key||o.from===key),n=nation(),other=state.countries[o?.from];if(!o)return;if(o.type==='peace'){ptAcceptOffer(o);return;}if(simAtWar(o.from,state.player)){notify('An agreement cannot be signed while at war.');return;}let c=o.from,keyName=o.type==='trade'?'trades':'allies';if(!n[keyName].includes(c))n[keyName].push(c);if(!other[keyName].includes(state.player))other[keyName].push(state.player);simSetRelation(c,state.player,simRelation(c,state.player)+5);state.offers=state.offers.filter(x=>x!==o);log(`Your government accepted the ${o.type} proposal from ${name(c)}.`);}
function simOffersHTML(){return(state.offers||[]).map(o=>{let key=o.id||o.from,peace=o.type==='peace';return `<div class="card"><b>${peace?'Peace terms from '+name(o.from):name(o.from)+' proposes '+(o.type==='trade'?'trade':'a defence pact')}</b><p>${peace?ptOfferSummary(o):'Offer expires in '+(o.expires-state.turn)+' months.'}</p>${actionButton('acceptOffer_'+key,peace?'Accept peace':'Accept proposal')}${actionButton('dismissOffer_'+key,'Decline')}</div>`;}).join('');}
function simAIpeaceStyle(w,c,stats){let other=c===w.a?w.b:w.a,loss=c===w.a?stats.bHoldsA:stats.aHoldsB,held=c===w.a?stats.aHoldsB:stats.bHoldsA,ratio=wcPower(w,c)/Math.max(.1,wcPower(w,other)),n=state.countries[c];if((w.fatigue[c]||0)>=45||n.morale<38||loss>=8||ratio<.58)return'desperate';if(ratio>=1.65&&(held>=1||(w.fatigue[other]||0)>=20||w.months>=18))return'confident';return'';}
function simAIpeaceTerms(w,proposer,style){let recipient=proposer===w.a?w.b:w.a,keys=new Set([...Object.keys(state.control),...Object.keys(state.titles||{})]);if(w.scenario&&state.mode==='control')for(let k of wcScenarioGrid().keys)keys.add(k);let claims=new Map();if(style==='confident'){let occupied=[...keys].filter(k=>ptSovereign(k)===recipient&&wcOwner(k,w)===proposer).sort(),limit=Math.max(1,Math.min(occupied.length,Math.round(ptCountrySize(recipient)*.02)));for(let k of occupied.slice(0,limit))claims.set(k,proposer);}return{war:w,other:recipient,years:5,paymentYears:5,reparations:style==='desperate'?-6:style==='confident'?2:0,claims:[...claims],vassal:false};}
function simAIPeace(){state.offers??=[];for(let w of state.wars){if(!w.active||w.months<6)continue;let stats=wcTerritoryStats(w);w.aiPeaceTurns??={};for(let c of[w.a,w.b]){if(!w.active)break;if(c===state.player||state.countries[c].owner!==c)continue;let last=w.aiPeaceTurns[c]??(state.turn-12);if(state.turn-last<12)continue;if(state.offers.some(o=>o.type==='peace'&&(o.warId===w.id||o.terms?.war?.id===w.id)))continue;let style=simAIpeaceStyle(w,c,stats);if(!style)continue;let recipient=c===w.a?w.b:w.a,terms=simAIpeaceTerms(w,c,style),likelihood=ptAcceptance(terms,c);w.aiPeaceTurns[c]=state.turn;if(recipient===state.player){if(likelihood<30)continue;let offer={id:'peace_'+w.id+'_'+c+'_'+state.turn,from:c,type:'peace',warId:w.id,terms,expires:state.turn+6};state.offers.push(offer);simRecord(c,(style==='desperate'?'Under mounting pressure':'Seeing an opportunity')+', proposed peace terms to '+name(recipient)+'.',true);}else if(likelihood>=50){ptApply(terms,c);simRecord(c,(style==='desperate'?'Accepted a difficult peace':'Secured a favourable peace')+' settlement with '+name(recipient)+'.',true);}}}}
function simInspector(c){let ai=state.countries[c]?.ai;if(!ai)return '';return `<div class="card"><b>${ai.agenda}</b><p>${c===state.player?'Your country profile':`Government support: ${Math.round(ai.approval)}% · Legitimacy ${Math.round(ai.legitimacy)}% · PP ${ai.politicalPower} · Term ${ai.term}`}</p><p><b>Latest decision:</b> ${ai.lastAction}</p>${c===state.player?'':`<p class="note">Modeled election in ${Math.max(0,ai.election-state.turn)} months. Strategic profile is an illustrative game personality.</p>`}</div>`;}
function simDiplomacy(c){
 let n=state.countries[c],ai=n.ai;
 let candidates=Object.keys(state.countries).filter(b=>b!==c&&state.countries[b].owner===b&&!simAtWar(c,b)&&!n.sanctions.includes(b)&&!state.countries[b].sanctions.includes(c)&&simRelation(c,b)>=35).map(b=>({b,score:simRelation(c,b)+(EU.includes(c)&&EU.includes(b)?12:0)+simRandom()*25})).sort((a,b)=>b.score-a.score);
 let pact=candidates.find(({b})=>simRelation(c,b)>=60&&!n.allies.includes(b)&&!simAtWar(c)&&!simAtWar(b));
 if(pact&&simThreat(c)>=.5&&ai.focus!=='neutrality'){let b=pact.b;if(b===state.player)simOffer(c,'alliance');else{n.allies.push(b);state.countries[b].allies.push(c);simRecord(c,`Signed a defensive pact with ${name(b)}.`,true);}return true;}
 let candidate=candidates.find(({b})=>!n.trades.includes(b));
 if(!candidate){let friends=Object.keys(state.countries).filter(b=>b!==c&&!ai.rivals.includes(b)&&!simAtWar(c,b)&&state.countries[b].owner===b);if(!friends.length)return false;let b=friends[Math.floor(simRandom()*friends.length)];simSetRelation(c,b,simRelation(c,b)+8);simRecord(c,`Opened diplomatic talks with ${name(b)}.`);return true;}let b=candidate.b;
 if(b===state.player){simOffer(c,'trade');return true;}
 n.trades.push(b);state.countries[b].trades.push(c);simSetRelation(c,b,simRelation(c,b)+4);simRecord(c,`Signed a trade agreement with ${name(b)}.`,true);return true;
}
function simAISanctions(c){
 let n=state.countries[c];if(!n||n.owner!==c)return false;
 let war=state.wars.find(w=>w.active&&[w.a,w.b].includes(c));if(!war)return false;
 let enemy=war.a===c?war.b:war.a;if(n.sanctions.includes(enemy))return false;
 n.sanctions.push(enemy);simSetRelation(c,enemy,simRelation(c,enemy)-8);simRecord(c,'Imposed economic sanctions on '+name(enemy)+' during the conflict.',true);return true;
}
function simAIBudget(c){
 const n=state.countries[c],ai=n.ai,e=economy(n),debtRatio=n.debt/Math.max(1,n.gdp),taxPlatform=polGovernmentPosition(c,'tax');
 const deficit=e.net<0||debtRatio>.85,action=deficit&&n.tax<42?'bill-tax-up':!deficit&&e.net>n.gdp*.01&&n.tax>33&&taxPlatform<.42?'bill-tax-down':null;
 if(action){let q=polQuote(c,action);if(q.ok&&q.canAfford){polAction(c,action);return;}}
 if(deficit&&n.infra>2){n.infra--;simRecord(c,'Reduced infrastructure allocations to contain the deficit.');return;}
 if(!deficit&&e.net>n.gdp*.01&&n.infra<10&&ai.focus==='growth'){n.infra++;simRecord(c,'Expanded infrastructure allocations within the budget surplus.');return;}
 simRecord(c,'Kept current allocations; available legislative support or reserves were insufficient for a larger adjustment.');
}
function simDecision(c){
 const n=state.countries[c],ai=n.ai,threat=simThreat(c),e=economy(n),welfarePlatform=polGovernmentPosition(c,'welfare'),securityPlatform=polGovernmentPosition(c,'security'),taxPlatform=polGovernmentPosition(c,'tax');
 let choices=[{kind:'stability',score:(60-ai.approval)*.06+ai.welfare+(welfarePlatform-.5)*1.2},{kind:'budget',score:(e.net<0&&n.treasury<n.gdp*.015?5:0)+(taxPlatform<.4?1:0)},{kind:'security',score:threat*3+(ai.focus==='security'?1:0)+(n.ready<65?1:0)+(securityPlatform-.5)*1.2},{kind:'trade',score:(ai.focus==='trade'?2.3:1.1)+(taxPlatform<.45?.4:0)},{kind:'growth',score:ai.focus==='growth'?2.2:1.1}];
 for(let x of choices)x.score+=simRandom()*1.5;
 let decision=choices.sort((a,b)=>b.score-a.score)[0].kind;
 if(decision==='budget'){simAIBudget(c);return;}
 if(decision==='stability'){
  let q=polQuote(c,'bill-services-up');if(ai.approval<62&&q.ok&&q.canAfford&&q.willPass){polAction(c,'bill-services-up');return;}
  if(simSpend(n,n.gdp*.0015)){ai.approval=clamp(ai.approval+2,0,100);simRecord(c,'Funded temporary household and public-service relief.');return;}
 }
 if(decision==='security'){
  if(n.defense<(simAtWar(c)?8:5)&&e.net>0&&securityPlatform>.55){let q=polQuote(c,'bill-defence-up');if(q.ok&&q.canAfford&&q.willPass)polAction(c,'bill-defence-up');}
  if(simAtWar(c)&&!n.mobilized&&threat>.5){milSetMobilized(c,true);ai.approval=clamp(ai.approval-5,0,100);}
  let recruited=milRecruit(c);
  if(recruited.ok){simRecord(c,'Recruited and equipped a '+recruited.personnel.toFixed(1)+'k-personnel division.');return;}
  let trained=milTrain(c);
  if(trained.ok){simRecord(c,'Funded military exercises to improve formation readiness.');return;}
  simRecord(c,'Deferred recruitment: '+recruited.reason);return;
 }
 if(decision==='trade'&&simDiplomacy(c))return;
 if(simSpend(n,n.gdp*.002)){econFundInvestment(n,n.gdp*.002);ai.approval=clamp(ai.approval+1,0,100);simRecord(c,'Approved an infrastructure investment programme.');}else simRecord(c,'Prioritized reserve recovery and deferred new spending.');
}
function simAIWar(c){let n=state.countries[c],ai=n.ai;if(ai.risk<.8||state.turn<9||simAtWar(c)||state.wars.filter(w=>w.active).length>=2)return;
 for(let b of ai.rivals){if(ptTruce(c,b)||state.countries[c].overlord||!world[b]||allied(c,b)||state.countries[b].owner!==b||simFrontPair(c,b)||simRelation(c,b)>-65)continue;
 if(strength(c)>(strength(b)+coalition(b,c))*2.3&&simRandom()<.03){state.wars.push(wcCreateWar(c,b));simSetRelation(c,b,-100);simRecord(c,`Opened a military campaign against ${name(b)}.`,true);return;}}
}
function simRunAI(){
 state.offers=state.offers.filter(o=>o.expires>state.turn);
 for(let c in state.countries){if(c===state.player)continue;let n=state.countries[c],ai=n.ai;if(n.owner!==c||n.revolt||n.disbanded||n.exile)continue;
  ai.approval=clamp(ai.approval+.15+n.growth*.1+(n.health-6)*.1+(n.morale-65)*.012-(n.tax-32)*.05-(simAtWar(c)?.35:0)-(n.mobilized?.25:0)+ai.politics.mediaLevel*POLITICS_MEDIA_DRIFT,0,100);
  let phase=(c.charCodeAt(0)+c.charCodeAt(1));
  if((state.turn+phase)%9===0){let event=simRandom()<.5?'Energy-price pressure':'Regional public-service demands';if(simSpend(n,n.gdp*.001)){ai.approval=clamp(ai.approval+2,0,100);simRecord(c,`${event}: approved targeted relief.`);}else{ai.approval=clamp(ai.approval-3*Math.max(.25,1-ai.politics.mediaLevel*POLITICS_MEDIA_EVENT_SHIELD),0,100);simRecord(c,`${event}: deferred relief to protect reserves.`);}}
  if((state.turn+phase)%3===0)simDecision(c);
  if(state.front?.active&&(EU.includes(c)||NATO.includes(c))&&!['RU','BY','UA'].includes(c)&&(state.turn+phase)%6===0&&milSendAid(c,state.front).ok)simRecord(c,'Funded and supplied a military aid package to Ukraine.',true);
  for(let w of state.wars)if(w.active&&[w.a,w.b].includes(c))w.postures[c]=n.ready<50?'defensive':ai.risk>.7&&n.ready>70?'offensive':'balanced';

  polAI(c);
  if((state.turn+phase)%12===0&&ai.focus==='influence')for(let rival of ai.rivals)if(world[rival]&&!simAtWar(c,rival))simSetRelation(c,rival,simRelation(c,rival)-8);
  simAIWar(c);simAISanctions(c);milAutoDeploy(c);
 }
}



