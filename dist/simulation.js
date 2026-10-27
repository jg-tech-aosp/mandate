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
function simAtWar(c,other){return state.wars.some(w=>[w.a,w.b].includes(c)&&(!other||[w.a,w.b].includes(other)))||!!(state.front?.active&&['RU','UA'].includes(c)&&(!other||simFrontPair(c,other)));}
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
 if(state.mode==='control'&&!state.front&&occupationData){
  let grid=simGrid();state.front={active:true,owners:[...grid.initial],snapshot:occupationData.properties.snapshot_date,postures:{RU:'balanced',UA:'balanced'},support:0,fatigue:{RU:0,UA:0},months:0,last:{RU:0,UA:0}};
  // Fold previous scenario campaigns into control instead of discarding their gains.
  let legacy=state.wars.filter(w=>w.a==='RU'&&w.b==='UA');
  for(let w of legacy){let occupied=new Set(w.captured.map(i=>Math.floor(w.cells[i][0]/w.step)+','+Math.floor(w.cells[i][1]/w.step)));grid.cells.forEach((p,i)=>{if(occupied.has(Math.floor(p[0]/w.step)+','+Math.floor(p[1]/w.step)))state.front.owners[i]=1;});}
  state.wars=state.wars.filter(w=>!legacy.includes(w));
  simSetRelation('RU','UA',-100);
  for(let c in state.countries)if(c!==state.player&&c!=='RU'&&(EU.includes(c)||NATO.includes(c)))simSetRelation(c,'RU',-40);
 }
}
function simDrawHex(p){ctx.beginPath();for(let k=0;k<6;k++){let angle=(60*k+30)*Math.PI/180,q=screen(p[0]+simGrid().radius*1.5*Math.cos(angle),p[1]+simGrid().radius*Math.sin(angle));k?ctx.lineTo(...q):ctx.moveTo(...q);}ctx.closePath();ctx.fill();}
function simDrawFront(){
 if(!state.front)return;const grid=simGrid();
 ctx.save();path(world.UA.feature);ctx.clip('evenodd');
 if(state.front.owners.every(v=>!v)||state.front.owners.every(Boolean)){ctx.fillStyle=state.front.owners[0]?(state.player==='RU'?'#bedb88':'#a47566'):color('UA');path(world.UA.feature);ctx.fill('evenodd');ctx.restore();return;}
 // Keep the precise source outline where control has not changed. Only changed hexes are repainted.
 for(let i=0;i<grid.cells.length;i++)if(state.front.owners[i]!==grid.initial[i]){ctx.fillStyle=state.front.owners[i]?(state.player==='RU'?'#bedb88':'#a47566'):color('UA');simDrawHex(grid.cells[i]);}
 ctx.restore();
}
function simFrontPercent(){return state.front?(100*state.front.owners.reduce((a,b)=>a+b,0)/state.front.owners.length):0;}
function simFrontPower(c){let f=state.front,stance=f.postures[c],mult=stance==='offensive'?1.19:stance==='defensive'?.86:1;return Math.sqrt(strength(c))/20*mult*(c==='UA'?1.23+f.support*.18:1);}
function simAdvanceFront(){
 let f=state.front;if(!f?.active)return;
 if(state.countries.UA.owner!=='UA'||state.countries.RU.owner!=='RU'){f.active=false;log('The Russia–Ukraine front is suspended following a change of government control.',true);return;}
 const g=simGrid(),before=[...f.owners],sectors=Array.from({length:6},()=>({RU:[],UA:[]}));
 for(let i=0;i<before.length;i++)if(g.neighbors[i].some(j=>before[j]!==before[i])){let sector=clamp(Math.floor((g.cells[i][1]-44)/1.45),0,5);sectors[sector][before[i]?'UA':'RU'].push(i);}
 f.last={RU:0,UA:0};let ru=simFrontPower('RU'),ua=simFrontPower('UA');
 for(let sector of sectors){
  // Each sector resolves independently; an entrenched defender gets a local advantage.
  let delta=ru-ua+(simRandom()-.5)*1.35;if(Math.abs(delta)<.045)continue;
  let winner=delta>0?'RU':'UA',defender=winner==='RU'?'UA':'RU';if(f.postures[defender]==='defensive'){if(Math.abs(delta)<.22)continue;delta-=Math.sign(delta)*.18;}let pool=sector[winner];if(!pool.length)continue;
  let amount=Math.min(pool.length,clamp(Math.ceil(Math.abs(delta)*3),1,4));
  // Prefer well-connected attacks; choices are from the turn-start contact line only.
  let ranked=pool.map(i=>({i,score:g.neighbors[i].filter(j=>before[j]===(winner==='RU'?1:0)).length+simRandom()*2})).sort((a,b)=>b.score-a.score);
  for(let k=0;k<amount;k++){f.owners[ranked[k].i]=winner==='RU'?1:0;f.last[winner]++;}
 }
 f.months++;f.support*=.94;
 for(let c of ['RU','UA']){let n=state.countries[c],off=f.postures[c]==='offensive';n.force=Math.max(1,n.force*(off?.996:.998));n.ready=clamp(n.ready-(off?1.1:.5),20,100);f.fatigue[c]=clamp(f.fatigue[c]+(off?.7:.4),0,100);}
 log(`Ukraine front: Russia gained ${f.last.RU} sectors; Ukraine recaptured ${f.last.UA}. Russian control: ${simFrontPercent().toFixed(1)}% of the modeled land area.`,true);
 if(f.owners.every(Boolean)||f.owners.every(v=>!v)){f.active=false;log(f.owners.every(Boolean)?'Russian forces control the whole modeled Ukrainian theatre.':'Ukraine has recovered the whole modeled occupation zone.',true);if(f.owners.every(Boolean)){state.countries.UA.owner='RU';if(state.player==='UA'){state.ended=true;clearInterval(timer);timer=null;info('Government displaced','<p>Your country has been fully occupied.</p>');}}}
}
function simFrontCard(){if(!state.front)return '';let f=state.front,playerSide=['RU','UA'].includes(state.player);return `<div class="card"><b>Russia–Ukraine · ${f.active?'Active war':'Ceasefire'}</b><div class="bar"><i style="width:${simFrontPercent()}%"></i></div><p>Russian control: ${simFrontPercent().toFixed(1)}% · Ukraine: ${(100-simFrontPercent()).toFixed(1)}%</p><p>Last month: ${f.last.RU} sectors gained by Russia; ${f.last.UA} recaptured by Ukraine.</p>${playerSide&&f.active?`<label class="row">Your front posture<select aria-label="Ukraine front posture" id="frontPosture">${['balanced','offensive','defensive'].map(p=>`<option ${f.postures[state.player]===p?'selected':''}>${p}</option>`).join('')}</select></label>`:''}<p class="note">Small hex sectors follow the existing contact line. Outside aid supports Ukrainian resistance. Simulated outcomes are not forecasts.</p></div>`;}
function simCeasefire(){let f=state.front;if(!f?.active)return false;let other=state.player==='UA'?'RU':'UA';if(f.months<6&&f.fatigue[other]<15){notify('Ceasefire rejected. The opponent still expects military gains.');return true;}f.active=false;log('Russia and Ukraine agree a ceasefire. Current territorial control is frozen; sovereignty is unchanged.',true);return true;}
function simResumeFront(){if(!state.front||!simFrontPair(state.player,target))return false;state.front.active=true;simSetRelation('RU','UA',-100);log('Russia–Ukraine hostilities resume from the existing line of control.',true);return true;}
function simThreat(c){let n=state.countries[c];return simAtWar(c)?1:n.ai.rivals.some(r=>simAtWar(r))?.75:n.ai.rivals.length?.5:.1;}
function simRecord(c,message,important=false){let ai=state.countries[c].ai;ai.lastAction=message;ai.lastTurn=state.turn;ai.decisions++;ai.history.unshift({turn:state.turn,text:message});ai.history=ai.history.slice(0,5);if(important||c===target)log(`${name(c)}: ${message}`);}
function simSpend(n,amount){if(n.treasury<amount)return false;n.treasury-=amount;return true;}
function simOffer(c,type){if(state.offers.some(o=>o.from===c&&o.type===type))return;state.offers.push({from:c,type,expires:state.turn+6});simRecord(c,`Proposed a ${type==='trade'?'trade agreement':'defence pact'} to your government.`,true);}
function simAcceptOffer(c){let o=state.offers.find(o=>o.from===c),n=nation(),other=state.countries[c];if(!o)return;if(simAtWar(c,state.player)){notify('An agreement cannot be signed while at war.');return;}let key=o.type==='trade'?'trades':'allies';if(!n[key].includes(c))n[key].push(c);if(!other[key].includes(state.player))other[key].push(state.player);simSetRelation(c,state.player,simRelation(c,state.player)+5);state.offers=state.offers.filter(x=>x!==o);log(`Your government accepted the ${o.type} proposal from ${name(c)}.`);}
function simOffersHTML(){return (state.offers||[]).map(o=>`<div class="card"><b>${name(o.from)} proposes ${o.type==='trade'?'trade':'a defence pact'}</b><p>Offer expires in ${o.expires-state.turn} months.</p>${actionButton('acceptOffer_'+o.from,'Accept proposal')}${actionButton('dismissOffer_'+o.from,'Decline')}</div>`).join('');}
function simInspector(c){let ai=state.countries[c]?.ai;if(!ai)return '';return `<div class="card"><b>${ai.agenda}</b><p>${c===state.player?'Your country profile':`Government support: ${Math.round(ai.approval)}% · Term ${ai.term}`}</p><p><b>Latest decision:</b> ${ai.lastAction}</p>${c===state.player?'':`<p class="note">Modeled election in ${Math.max(0,ai.election-state.turn)} months. Strategic profile is an illustrative game personality.</p>`}</div>`;}
function simDiplomacy(c){
 let n=state.countries[c],ai=n.ai;
 let candidates=Object.keys(state.countries).filter(b=>b!==c&&state.countries[b].owner===b&&!simAtWar(c,b)&&simRelation(c,b)>=35).map(b=>({b,score:simRelation(c,b)+(EU.includes(c)&&EU.includes(b)?12:0)+simRandom()*25})).sort((a,b)=>b.score-a.score);
 let pact=candidates.find(({b})=>simRelation(c,b)>=60&&!n.allies.includes(b)&&!simAtWar(c)&&!simAtWar(b));
 if(pact&&simThreat(c)>=.5&&ai.focus!=='neutrality'){let b=pact.b;if(b===state.player)simOffer(c,'alliance');else{n.allies.push(b);state.countries[b].allies.push(c);simRecord(c,`Signed a defensive pact with ${name(b)}.`,true);}return true;}
 let candidate=candidates.find(({b})=>!n.trades.includes(b));
 if(!candidate){let friends=Object.keys(state.countries).filter(b=>b!==c&&!ai.rivals.includes(b)&&!simAtWar(c,b)&&state.countries[b].owner===b);if(!friends.length)return false;let b=friends[Math.floor(simRandom()*friends.length)];simSetRelation(c,b,simRelation(c,b)+8);simRecord(c,`Opened diplomatic talks with ${name(b)}.`);return true;}let b=candidate.b;
 if(b===state.player){simOffer(c,'trade');return true;}
 n.trades.push(b);state.countries[b].trades.push(c);simSetRelation(c,b,simRelation(c,b)+4);simRecord(c,`Signed a trade agreement with ${name(b)}.`,true);return true;
}
function simDecision(c){
 const n=state.countries[c],ai=n.ai,threat=simThreat(c),e=economy(n);
 let choices=[{kind:'stability',score:(60-ai.approval)*.06+ai.welfare},{kind:'budget',score:e.net<0&&n.treasury<n.gdp*.015?5:0},{kind:'security',score:threat*3+(ai.focus==='security'?1:0)+(n.ready<65?1:0)},{kind:'trade',score:ai.focus==='trade'?2.3:1.1},{kind:'growth',score:ai.focus==='growth'?2.2:1.1}];
 for(let x of choices)x.score+=simRandom()*1.5;
 let decision=choices.sort((a,b)=>b.score-a.score)[0].kind;
 if(decision==='budget'){if(n.tax<42)n.tax++;else if(n.infra>3)n.infra--;simRecord(c,'Adjusted the budget to reduce the deficit.');return;}
 if(decision==='stability'&&simSpend(n,n.gdp*.0015)){n.health=clamp(n.health+1,1,10);ai.approval=clamp(ai.approval+3,0,100);simRecord(c,'Funded public services to rebuild government support.');return;}
 if(decision==='security'){
  if(n.defense<(simAtWar(c)?8:5)&&e.net>0)n.defense++;
  if(simSpend(n,n.gdp*.002)){n.force+=Math.max(.5,n.gdp*.004);n.ready=clamp(n.ready+5,0,100);simRecord(c,simAtWar(c)?'Reinforced the front and replenished equipment.':'Invested in military readiness and deterrence.');return;}
 }
 if(decision==='trade'&&simDiplomacy(c))return;
 if(simSpend(n,n.gdp*.002)){n.gdp*=1.0015;ai.approval=clamp(ai.approval+1,0,100);simRecord(c,'Approved an infrastructure investment programme.');}else simRecord(c,'Prioritized reserve recovery and deferred new spending.');
}
function simAIWar(c){let n=state.countries[c],ai=n.ai;if(ai.risk<.8||state.turn<9||simAtWar(c)||state.wars.length>=4)return;
 for(let b of ai.rivals){if(!world[b]||allied(c,b)||state.countries[b].owner!==b||simFrontPair(c,b)||simRelation(c,b)>-65)continue;
 if(strength(c)>(strength(b)+coalition(b,c))*2.3&&simRandom()<.03){state.wars.push(makeWar(c,b),makeWar(b,c));simSetRelation(c,b,-100);simRecord(c,`Opened a military campaign against ${name(b)}.`,true);return;}}
}
function simRunAI(){
 state.offers=state.offers.filter(o=>o.expires>state.turn);
 for(let c in state.countries){if(c===state.player)continue;let n=state.countries[c],ai=n.ai;if(n.owner!==c)continue;
  ai.approval=clamp(ai.approval+.15+n.growth*.1+(n.health-6)*.1-(n.tax-32)*.05-(simAtWar(c)?.35:0),0,100);
  let phase=(c.charCodeAt(0)+c.charCodeAt(1));
  if((state.turn+phase)%9===0){let event=simRandom()<.5?'Energy-price pressure':'Regional public-service demands';if(simSpend(n,n.gdp*.001)){ai.approval=clamp(ai.approval+2,0,100);simRecord(c,`${event}: approved targeted relief.`);}else{ai.approval=clamp(ai.approval-3,0,100);simRecord(c,`${event}: deferred relief to protect reserves.`);}}
  if((state.turn+phase)%3===0)simDecision(c);
  if(state.front?.active&&(EU.includes(c)||NATO.includes(c))&&!['RU','BY','UA'].includes(c)&&(state.turn+phase)%6===0&&simSpend(n,n.gdp*.0008)){state.front.support=clamp(state.front.support+n.gdp*.00012,0,2);simRecord(c,'Sent a military aid package to Ukraine.',true);}
  if(state.front?.active&&['RU','UA'].includes(c))state.front.postures[c]=n.ready<50?'defensive':ai.risk>.7&&n.ready>70?'offensive':'balanced';
  if(state.turn>=ai.election){let win=ai.approval>=50;ai.term=win?ai.term+1:1;ai.election=state.turn+48;ai.approval=win?clamp(ai.approval+3,0,100):55;if(!win){ai.focus=['growth','welfare','trade'][Math.floor(simRandom()*3)];ai.welfare=clamp(ai.welfare+(simRandom()-.5)*.3,.2,.9);ai.agenda='New cabinet: '+({growth:'growth and investment',welfare:'public services',trade:'trade and diplomacy'}[ai.focus]);}simRecord(c,win?'The government won a renewed electoral mandate.':'An election brought a new cabinet with revised domestic priorities.',true);}
  if((state.turn+phase)%12===0&&ai.focus==='influence')for(let rival of ai.rivals)if(world[rival]&&!simAtWar(c,rival))simSetRelation(c,rival,simRelation(c,rival)-8);
  simAIWar(c);
 }
}
