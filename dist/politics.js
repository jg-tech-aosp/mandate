'use strict';
const POLITICS_BASE_TERM=48,POLITICS_MIN_TERM=24,POLITICS_MAX_TERM=96,POLITICS_STEP=12,POLITICS_COST=20;
const POLITICS_MEDIA_DRIFT=.08,POLITICS_MEDIA_EVENT_SHIELD=.2,POLITICS_MEDIA_ELECTION_BONUS=2,POLITICS_SUPREME_ELECTION_BONUS=12;

function polEnsure(){
 if(!state)return;
 state.politicalPower=Math.max(0,Math.floor(Number(state.politicalPower)||0));
 state.politics??={};
 state.politics.termMonths=Math.round(clamp(Number(state.politics.termMonths)||POLITICS_BASE_TERM,POLITICS_MIN_TERM,POLITICS_MAX_TERM)/POLITICS_STEP)*POLITICS_STEP;
 state.politics.mediaLevel=clamp(Math.floor(Number(state.politics.mediaLevel)||0),0,3);
 state.politics.supremeRule=!!state.politics.supremeRule;
 for(let c in state.countries){
  let n=state.countries[c],ai=n.ai;
  if(!ai)continue;
  ai.legitimacy=clamp(Number.isFinite(ai.legitimacy)?ai.legitimacy:60,0,100);
  ai.politicalPower=Math.max(0,Math.floor(Number(ai.politicalPower)||0));
  ai.politics??={};
  ai.politics.termMonths=Math.round(clamp(Number(ai.politics.termMonths)||POLITICS_BASE_TERM,POLITICS_MIN_TERM,POLITICS_MAX_TERM)/POLITICS_STEP)*POLITICS_STEP;
  ai.politics.mediaLevel=clamp(Math.floor(Number(ai.politics.mediaLevel)||0),0,3);
  ai.politics.supremeRule=!!ai.politics.supremeRule;
  ai.election??=state.turn+ai.politics.termMonths;
 }
}
function polPolicies(c){return c===state.player?state.politics:state.countries[c].ai.politics;}
function polPower(c){return c===state.player?state.politicalPower:state.countries[c].ai.politicalPower;}
function polSetPower(c,value){if(c===state.player)state.politicalPower=value;else state.countries[c].ai.politicalPower=value;}
function polApproval(c){return c===state.player?state.approval:state.countries[c].ai.approval;}
function polLegitimacy(c){return c===state.player?state.legitimacy:state.countries[c].ai.legitimacy;}
function polRate(approval){return approval>=90?3:approval>=80?2:approval>=60?1:0;}
function polAccrue(c){if(c!==state.player&&state.countries[c].owner!==c)return 0;let earned=polRate(polApproval(c));polSetPower(c,polPower(c)+earned);return earned;}
function polReset(c){polSetPower(c,0);}
function polElectionScore(c){let p=polPolicies(c),approval=polApproval(c),legitimacy=polLegitimacy(c);return clamp(approval*.8+legitimacy*.2+p.mediaLevel*POLITICS_MEDIA_ELECTION_BONUS+(p.supremeRule?POLITICS_SUPREME_ELECTION_BONUS:0),0,100);}
function polQuote(c,action){
 let p=polPolicies(c),term=p.termMonths,level=p.mediaLevel,q={ok:true,action,positive:false,severity:1,current:term,next:term};
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
  if(p.supremeRule)return{ok:false,reason:'Supreme rule is already in effect.'};
  q.severity=4;q.positive=false;
 }else if(action==='supreme-off'){
  if(!p.supremeRule)return{ok:false,reason:'Supreme rule is not in effect.'};
  q.severity=4;q.positive=true;
 }else return{ok:false,reason:'Unknown political action.'};
 q.cost=q.severity*POLITICS_COST;
 q.approvalDelta=(q.positive?1:-1)*q.severity*2;
 q.legitimacyDelta=(q.positive?1:-1)*q.severity*3;
 q.canAfford=polPower(c)>=q.cost;
 return q;
}
function polAction(c,action){
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
 if(c===state.player){
  state.approval=clamp(state.approval+q.approvalDelta,0,100);
  state.legitimacy=clamp(state.legitimacy+q.legitimacyDelta,0,100);
 }else{
  ai.approval=clamp(ai.approval+q.approvalDelta,0,100);
  ai.legitimacy=clamp(ai.legitimacy+q.legitimacyDelta,0,100);
 }
 let message={
  'term-shorter':'Shortened the election interval to '+(q.next/12)+' years.',
  'term-longer':'Extended the election interval to '+(q.next/12)+' years.',
  'media-up':'Consolidated media control to level '+q.next+' of 3.',
  'media-down':'Restored media independence to level '+q.next+' of 3.',
  'supreme-on':'Established supreme rule and weakened electoral safeguards.',
  'supreme-off':'Reversed supreme rule and restored electoral safeguards.'
 }[action];
 if(c===state.player)log(message+' Political power spent: '+q.cost+' PP.');
 else simRecord(c,message+' Spent '+q.cost+' political power.');
 return true;
}
function polAI(c){
 if(c===state.player||state.countries[c].owner!==c)return;
 let n=state.countries[c],ai=n.ai,p=ai.politics,phase=c.charCodeAt(0)+c.charCodeAt(1);
 if((state.turn+phase)%12!==0)return;
 let action=null,pp=ai.politicalPower;
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
 if(action)polAction(c,action);
}
function polButton(action,label){
 let q=polQuote(state.player,action);
 return'<button class="wide" data-action="politics:'+action+'" '+(!q.ok||!q.canAfford?'disabled':'')+'>'+label+' · '+(q.cost||0)+' PP</button>';
}
function polPanel(){
 polEnsure();let p=state.politics,rate=polRate(state.approval),html='<h3>Political power</h3><div class="card"><div class="row"><span>Available</span><b>'+state.politicalPower+' PP</b></div><div class="row"><span>Monthly gain</span><b>'+rate+' PP</b></div><p>Gain 1 PP at 60–79% approval, 2 at 80–89%, and 3 at 90% or higher. Political power resets when an election takes place.</p></div><h3>Political controls</h3>';
 html+='<div class="card"><b>Election interval · '+(p.termMonths/12)+' years</b><p>Shorter intervals strengthen accountability. Longer intervals delay the next election and PP reset.</p>';
 if(p.termMonths>POLITICS_MIN_TERM)html+=polButton('term-shorter','Shorten by 1 year');
 if(p.termMonths<POLITICS_MAX_TERM)html+=polButton('term-longer','Extend by 1 year');
 html+='</div>';
 html+='<div class="card"><b>Media control · level '+p.mediaLevel+'/3</b><p>Each level slightly improves monthly approval, softens negative event losses, and adds 2 points to the modeled election score. Consolidation harms approval and legitimacy; reversal improves both.</p>';
 if(p.mediaLevel<3)html+=polButton('media-up','Consolidate media · severity '+(p.mediaLevel+1));
 if(p.mediaLevel>0)html+=polButton('media-down','Restore media independence · severity '+p.mediaLevel);
 html+='</div><div class="card"><b>Supreme rule · '+(p.supremeRule?'in effect':'not in effect')+'</b><p>While active, adds 12 points to the modeled election score. Establishing it harms approval and legitimacy; reversal improves both.</p>';
 html+=p.supremeRule?polButton('supreme-off','Restore electoral safeguards · severity 4'):polButton('supreme-on','Establish supreme rule · severity 4');
 return html+'</div><p class="note">Actions and reversals cost 20 PP per severity level. Approval and legitimacy changes scale with severity.</p>';
}

