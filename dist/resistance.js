'use strict';
const RES_GROUPS=[
 {id:'catalan',name:'Catalan',kin:['AD'],outcome:'independence',zones:[{country:'ES',share:.62,poly:[[-.1,40.35],[3.35,40.35],[3.35,42.85],[-.1,42.85]]}]},
 {id:'basque',name:'Basque',kin:['FR'],outcome:'independence',zones:[{country:'ES',share:.55,poly:[[-3.25,42.42],[-1.15,42.42],[-1.15,43.35],[-3.25,43.35]]}]},
 {id:'scottish',name:'Scottish',kin:['IE'],outcome:'independence',zones:[{country:'GB',share:.78,poly:[[-5.95,54.62],[-1.15,54.62],[-1.25,55.35],[-2.35,55.78],[-1.55,56.4],[-2.7,57.05],[-2.48,58.6],[-4.05,58.75],[-5.55,57.45],[-6.1,56.1]]}]},
 {id:'welsh',name:'Welsh',kin:[],outcome:'autonomy',zones:[{country:'GB',share:.48,poly:[[-5.45,51.25],[-2.5,51.25],[-2.62,53.48],[-4.72,53.48],[-5.45,52.55]]}]},
 {id:'flemish',name:'Flemish',kin:['NL'],outcome:'autonomy',zones:[{country:'BE',share:.58,poly:[[2.52,50.68],[5.82,50.68],[5.82,51.52],[2.52,51.52]]}]},
 {id:'hungarian_ro',name:'Hungarian minority',kin:['HU'],outcome:'autonomy',zones:[{country:'RO',share:.27,poly:[[22.0,45.35],[26.2,45.35],[26.2,47.65],[22.0,47.65]]}]},
 {id:'albanian_mk',name:'Albanian',kin:['AL'],outcome:'independence',zones:[{country:'MK',share:.32,poly:[[20.15,41.55],[21.85,41.55],[21.85,42.32],[20.15,42.32]]}]},
 {id:'russian_ua',name:'Russian-speaking Ukrainian',kin:['RU'],outcome:'autonomy',zones:[{country:'UA',share:.34,poly:[[31.4,46.45],[39.2,46.45],[39.2,50.55],[31.4,50.55]]}]}
];
let resCellCache=new Map(),resAddedActors=new Set(),resAddedFeatures=new Set(),resDynamicGroupIds=new Set(),resIndependentSourceOwners=new Map(),resOriginByCell=new Map(),resOriginByFeature=new Map();
function resZoneId(group,country){return group.id+'@'+country;}
function resFindZone(id){for(let group of RES_GROUPS)for(let zone of group.zones){zone.id=resZoneId(group,zone.country);zone.groupId=group.id;zone.groupName=group.name;zone.goal=group.outcome;zone.kin=group.kin;if(zone.id===id)return{group,zone};}return null;}
function resPointInPolygon(p,poly){let inside=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){let xi=poly[i][0],yi=poly[i][1],xj=poly[j][0],yj=poly[j][1];if(((yi>p[1])!==(yj>p[1]))&&(p[0]<(xj-xi)*(p[1]-yi)/(yj-yi||1e-9)+xi))inside=!inside;}return inside;}
function resFeaturePoints(feature){let out=[];function walk(value){if(!Array.isArray(value))return;if(typeof value[0]==='number'&&typeof value[1]==='number'){out.push(value);return;}for(let child of value)walk(child);}walk(feature?.geometry?.coordinates);return out;}
function resCells(groupId,country){
 let group=RES_GROUPS.find(g=>g.id===groupId),zone=group?.zones.find(z=>z.country===country);if(!zone)return[];
 zone.id??=resZoneId(group,country);let id=zone.id;if(resCellCache.has(id))return resCellCache.get(id);
 if(zone.cells){let cells=zone.cells.map(key=>({key,share:zone.share}));resCellCache.set(id,cells);return cells;}
 let source=zone.source||country,feature=zone.featureCode?world[zone.featureCode]?.feature:null,points=feature?resFeaturePoints(feature):zone.poly||[];
 if(!points.length)return[];
 let xs=points.map(p=>p[0]),ys=points.map(p=>p[1]),minX=Math.max(-30,Math.min(...xs)),maxX=Math.min(70,Math.max(...xs)),minY=Math.max(30,Math.min(...ys)),maxY=Math.min(75,Math.max(...ys));
 if(minX>=maxX||minY>=maxY)return[];
 let rowCount=Math.ceil((maxY-minY)/WC_HEIGHT)+3,colCount=Math.ceil((maxX-minX)/WC_WIDTH)+3,step=feature?Math.max(1,Math.ceil(Math.sqrt(rowCount*colCount/9000))):1,cells=[];
 zone.sampleStep=step;
 for(let r=Math.floor(minY/WC_HEIGHT)-1;r<=Math.ceil(maxY/WC_HEIGHT)+1;r++){if(feature&&Math.abs(r)%step)continue;let q0=Math.floor(minX/WC_WIDTH-r/2)-1,q1=Math.ceil(maxX/WC_WIDTH-r/2)+1;for(let q=q0;q<=q1;q++){if(feature&&Math.abs(q)%step)continue;let key=q+','+r,p=wcPoint(key),isInside=feature?inside(p,feature):resPointInPolygon(p,zone.poly);if(!isInside||ptSovereign(key)!==source)continue;cells.push({key,share:zone.share});}}
 resCellCache.set(id,cells);return cells;
}
function resGroupName(groupId){return RES_GROUPS.find(g=>g.id===groupId)?.name||groupId;}
function resActorId(groupId,country){return'REB_'+country+'_'+groupId.toUpperCase();}
function resRevolt(id){return(state?.revolts||[]).find(r=>r.id===id);}
function resIndependentOwner(key){let legal=wcLegal(key),direct=resIndependentSourceOwners.get(legal);if(direct)return direct;let p=wcPoint(key);for(let[source,actor]of resIndependentSourceOwners){let feature=world[source]?.feature;if(feature&&inside(p,feature))return actor;}return null;}
function resIndependentSourceFor(actor){for(let[id,owner]of Object.entries(state?.independentRegions||{})){if(owner!==actor)continue;let z=resFindZone(id)?.zone;if(z?.featureCode)return z.source||z.featureCode;}return null;}
function resIndependentActorForSource(source){return resIndependentSourceOwners.get(source)||null;}
function resEthnicOrigin(key){let source=resOriginByCell.get(key);if(source)return source;let legal=wcLegal(key);return resOriginByFeature.get(legal)||ptSovereign(key);}
function resLoadAbsorbedRegion(record){
 if(resDynamicGroupIds.has(record.id))return RES_GROUPS.find(g=>g.id===record.id);
 let zone={country:record.host,source:record.source,share:record.share??.72,cells:record.cells||null,featureCode:record.featureCode||null,absorbedTurn:record.turn,initialDissatisfaction:record.initialDissatisfaction??35,dynamic:true};
 let group={id:record.id,name:record.name||name(record.source)+' communities',kin:[record.source],outcome:'independence',zones:[zone],dynamic:true};
 zone.id=resZoneId(group,zone.country);zone.groupId=group.id;zone.groupName=group.name;zone.goal=group.outcome;zone.kin=group.kin;
 RES_GROUPS.push(group);resDynamicGroupIds.add(group.id);
 if(record.featureCode)resOriginByFeature.set(record.source,record.source);
 for(let key of record.cells||[])resOriginByCell.set(key,record.source);
 return group;
}
function resAddAbsorbedRegion(source,host,cells,kind){
 if(!source||!host||source===host)return null;
 state.absorbedRegions??=[];state.regionDissatisfaction??={};state.ethnicShares??={};
 let id='absorbed_'+source+'_'+host+'_'+state.turn+'_'+state.absorbedRegions.length;
 let record={id,source,host,turn:state.turn,kind,share:.72,cells:cells?.length?cells.slice():null,featureCode:cells?.length?null:source,initialDissatisfaction:kind==='annexation'?38:30,name:name(source)+' communities'};
 state.absorbedRegions.push(record);let group=resLoadAbsorbedRegion(record),zone=group.zones[0];
 state.regionDissatisfaction[zone.id]=record.initialDissatisfaction;resCellCache.clear();
 return record;
}
function resOnTerritoryTransfer(transfers){
 state.absorbedRegions??=[];
 let byKey=new Map((transfers||[]).map(item=>[item.key,item]));
 for(let record of state.absorbedRegions)if(record.cells?.length){record.cells=record.cells.filter(key=>{let item=byKey.get(key);return !item||record.host===item.to;});}
 let groups=new Map();
 for(let item of transfers||[]){let source=item.source||item.from,host=item.to;if(!source||!host||source===host)continue;let key=source+'>'+host;if(!groups.has(key))groups.set(key,{source,host,cells:[]});groups.get(key).cells.push(item.key);}
 for(let value of groups.values())resAddAbsorbedRegion(value.source,value.host,value.cells,'transfer');
 resCellCache.clear();
}
function resActor(country,group,independent=false){let existing=state.countries[country];if(existing)return existing;let base=state.countries[group.zones[0].country],share=group.zones[0].share,force=Math.max(4,base.force*share*.52),n={code:country,displayName:group.name+(independent?'':' Liberation Front'),owner:country,force,ready:independent?72:72,morale:independent?58:82,gdp:Math.max(1,base.gdp*share*.3),pop:Math.max(.2,base.pop*share),treasury:Math.max(.1,base.treasury*share*.2),debt:0,tax:30,health:6,education:5,defense:4,infra:4,growth:1,relations:{},allies:[],trades:[],sanctions:[],mobilized:false,revolt:!independent,independent,ai:{...simPersonality(country),approval:independent?54:38,legitimacy:independent?52:35,election:state.turn+48,term:1,lastAction:independent?'A new government was established.':'Organizing regional resistance.',lastTurn:state.turn,decisions:0,history:[],politicalPower:0,politics:{termMonths:48,mediaLevel:0,supremeRule:false}}};state.countries[country]=n;return n;}
function resFeature(actor,zone){
 if(world[actor]?.feature)return;
 let feature;
 if(zone.featureCode&&world[zone.featureCode]?.feature){let source=world[zone.featureCode].feature;feature={type:'Feature',properties:{code:actor,name:resGroupName(zone.groupId),resGenerated:true},geometry:source.geometry};}
 else if(zone.cells?.length){let loops=wcGridOutline(new Set(zone.cells)),coordinates=loops.map(loop=>{let ring=loop.map(p=>p.slice());ring.push(ring[0].slice());return ring;});feature={type:'Feature',properties:{code:actor,name:resGroupName(zone.groupId),resGenerated:true},geometry:{type:'Polygon',coordinates}};}
 else{let ring=zone.poly.map(p=>p.slice());ring.push(ring[0].slice());feature={type:'Feature',properties:{code:actor,name:resGroupName(zone.groupId),resGenerated:true},geometry:{type:'Polygon',coordinates:[ring]}};}
 let source=zone.featureCode?world[zone.featureCode]:null,center=source?.center||[zone.poly?.reduce((s,p)=>s+p[0],0)/(zone.poly?.length||1),zone.poly?.reduce((s,p)=>s+p[1],0)/(zone.poly?.length||1)];
 if(zone.cells?.length&&!source){let count=Math.min(zone.cells.length,500),step=Math.max(1,Math.floor(zone.cells.length/count)),sum=[0,0],n=0;for(let i=0;i<zone.cells.length;i+=step){let p=wcPoint(zone.cells[i]);sum[0]+=p[0];sum[1]+=p[1];n++;}center=[sum[0]/n,sum[1]/n];}
 world[actor]={name:resGroupName(zone.groupId),center,feature};resAddedActors.add(actor);
}
function resRegisterIndependent(actor,group,zone){
 if(features.some(f=>f.properties?.code===actor))return;
 let feature=world[actor]?.feature;
 if(!feature&&zone.featureCode&&world[zone.featureCode]?.feature){let source=world[zone.featureCode].feature;feature={type:'Feature',properties:{code:actor,name:group.name,resGenerated:true},geometry:source.geometry};world[actor].feature=feature;}
 if(!feature&&!zone.cells&&typeof ptCountryLoops==='function'){let loops=ptCountryLoops(actor);if(loops.length){let coordinates=loops.map(loop=>{let ring=loop.map(p=>p.slice());ring.push(ring[0].slice());return ring;});feature={type:'Feature',properties:{code:actor,name:group.name,resGenerated:true},geometry:{type:'Polygon',coordinates}};world[actor].feature=feature;}}
 if(feature){features.push(feature);resAddedFeatures.add(actor);if(typeof wcLegalCache!=='undefined')wcLegalCache.clear();}
}
function resClearGenerated(){
 for(let actor of resAddedFeatures)features=features.filter(f=>f.properties?.code!==actor);
 for(let actor of resAddedActors)delete world[actor];
 for(let i=RES_GROUPS.length-1;i>=0;i--)if(RES_GROUPS[i].dynamic)RES_GROUPS.splice(i,1);
 resAddedActors.clear();resAddedFeatures.clear();resDynamicGroupIds.clear();resIndependentSourceOwners.clear();resOriginByCell.clear();resOriginByFeature.clear();resCellCache.clear();
 if(typeof wcLegalCache!=='undefined')wcLegalCache.clear();if(state&&typeof ptInvalidateBorders==='function')ptInvalidateBorders();
}

function resEnsure(){
 if(!state)return;
 state.civicDissatisfaction??={};state.regionDissatisfaction??={};state.ethnicShares??={};state.ethnicPolicies??={};state.occupiedAt??={};state.revolts??=[];state.independentRegions??={};state.titles??={};state.absorbedRegions??=[];
 for(let record of state.absorbedRegions)resLoadAbsorbedRegion(record);
 for(let c in state.countries){let n=state.countries[c];if(n.revolt||n.disbanded)continue;n.ethnicPolicies??={};n.autonomousRegions??=[];
  if(n.exile){if(!(n.exile.active&&n.owner===c))n.exile.occupier=wcRoot(c);}
  else if(wcRoot(c)!==c)n.exile={since:state.turn,occupier:wcRoot(c),support:10,lastAttempt:0};
  if(c===state.player&&n.exile&&state.ended&&!state.logs?.[0]?.t?.startsWith('Election:'))state.ended=false;
 }
 for(let group of RES_GROUPS)for(let zone of group.zones){zone.id=resZoneId(group,zone.country);zone.groupId=group.id;zone.groupName=group.name;zone.goal=group.outcome;zone.kin=group.kin;state.regionDissatisfaction[zone.id]??=zone.initialDissatisfaction??12;state.ethnicShares[zone.id]??=zone.share;}
 for(let[id,actor]of Object.entries(state.independentRegions)){let z=resFindZone(id);if(z){resActor(actor,z.group,true);resFeature(actor,z.zone);if(z.zone.featureCode)resIndependentSourceOwners.set(z.zone.source||z.zone.featureCode,actor);}}
 for(let revolt of state.revolts.filter(r=>r.status==='active')){let group=RES_GROUPS.find(g=>g.id===revolt.groupId),z=resFindZone(revolt.zoneId)?.zone;if(group&&z){resActor(revolt.actor,group);resFeature(revolt.actor,z);}}
 if(!state.resHydrated){for(let[id,actor]of Object.entries(state.independentRegions)){let z=resFindZone(id);if(z&&!z.zone.featureCode)for(let cell of resCells(z.group.id,z.zone.country))state.titles[cell.key]=actor;}state.resHydrated=true;if(typeof ptInvalidateBorders==='function')ptInvalidateBorders();}
 for(let[id,actor]of Object.entries(state.independentRegions)){let z=resFindZone(id);if(z)resRegisterIndependent(actor,z.group,z.zone);}
}
function resApproval(c){return c===state.player?state.approval:(state.countries[c]?.ai?.approval??55);}
function resFatigue(c){let value=0;for(let w of state.wars||[])if([w.a,w.b].includes(c))value=Math.max(value,w.fatigue?.[c]||0);return value;}
function resCellValue(zone,cell){
 let c=zone.country,zid=zone.id,share=state.ethnicShares[zid]??cell.share,local=0,owner=wcOwner(cell.key),absorbed=!!(zone.source&&zone.source!==c),age=state.turn-(zone.absorbedTurn??state.turn);
 if(owner!==c){let since=state.occupiedAt[cell.key]??state.turn;local+=(state.turn-since<36?20:9)*Math.max(.35,share);if(state.countries[c]?.exile)local+=10;}
 if(absorbed)local+=(age<36?18:9)*Math.max(.35,share);
 if(state.countries[c]?.autonomousRegions?.includes(zone.groupId))local-=10;
 let h=0;for(let ch of cell.key)h=(Math.imul(h,31)+ch.charCodeAt(0))|0;
 return clamp((state.regionDissatisfaction[zid]||0)+(state.civicDissatisfaction[c]||0)*.28+(share-.4)*12+local+(Math.abs(h)%7-3),0,100);
}
function resZoneMean(zone){let cells=resCells(zone.groupId,zone.country);if(!cells.length)return 0;let step=Math.max(1,Math.floor(cells.length/120)),sum=0,count=0;for(let i=0;i<cells.length;i+=step){sum+=resCellValue(zone,cells[i]);count++;}return count?sum/count:0;}
function resPolicy(c,groupId){return state.countries[c]?.ethnicPolicies?.[groupId]||'integrate';}
function resSetPolicy(c,groupId,policy){let group=RES_GROUPS.find(g=>g.id===groupId),zone=group?.zones.find(z=>z.country===c);if(!zone||!['protect','integrate','force'].includes(policy))return false;let old=resPolicy(c,groupId);if(old===policy)return true;let cost=policy==='force'?20:10;if(polPower(c)<cost)return false;polSetPower(c,polPower(c)-cost);state.countries[c].ethnicPolicies[groupId]=policy;if(policy==='force'){if(c===state.player){state.approval=clamp(state.approval-2,0,100);state.legitimacy=clamp(state.legitimacy-3,0,100);}else if(state.countries[c].ai)state.countries[c].ai.approval=clamp(state.countries[c].ai.approval-2,0,100);}let text=policy==='protect'?'Recognized '+group.name+' cultural protections.':policy==='force'?'Forced assimilation of '+group.name+' communities.':'Expanded civic integration for '+group.name+' communities.';if(c===state.player)log(text+' Political power spent: '+cost+' PP.');else simRecord(c,text+' Spent '+cost+' political power.');return true;}
function resPolicySelector(c,group){let selected=resPolicy(c,group.id),html='<label class="row">Regional policy<select aria-label="'+group.name+' policy" data-res-policy="'+group.id+'">';for(let[mode,label]of[['protect','Protect culture'],['integrate','Civic integration'],['force','Forced assimilation']])html+='<option value="'+mode+'" '+(selected===mode?'selected':'')+'>'+label+'</option>';return html+'</select></label><p class="note">Changing policy costs 10 PP, or 20 PP for forced assimilation. Assimilation lowers the group share slowly and increases resentment.</p>';}
function resPanel(){if(!state.regionDissatisfaction)resEnsure();let c=state.player,n=state.countries[c],civic=Math.round(state.civicDissatisfaction[c]||0),html='<div class="card"><div class="eyebrow">CIVILIAN MOOD</div><div class="row"><span>National dissatisfaction</span><b>'+civic+'%</b></div><div class="row"><span>Political power</span><b>'+polPower(c)+' PP</b></div><p>Separate from approval. Mapped regional shares are curated gameplay estimates. War exhaustion, economic contraction, and low approval push dissatisfaction upward. Occupied and culturally distinct regions can be more dissatisfied than the country overall. A revolt forms when 90% local dissatisfaction covers a connected majority of at least 60% of a mapped group’s area.</p>';if(n.exile)html+='<p class="positive"><b>Government in exile</b> · Your state survives under '+name(n.exile.occupier)+' and is organizing for liberation. Support '+Math.round(n.exile.support||0)+'%.</p>'+actionButton('res_support','Call for liberation support · '+money(n.gdp*.002))+(n.exile.support>=55&&!n.exile.active?actionButton('res_liberate','Launch a liberation campaign'):'')+(n.exile.active?'<p class="note">Liberation forces hold '+Math.round(resLiberationShare(c)*100)+'% of the homeland.</p>':'');html+='</div>';let zones=RES_GROUPS.flatMap(g=>g.zones.filter(z=>z.country===c).map(z=>({group:g,zone:z})));if(!zones.length)html+='<div class="card"><b>No curated ethnic regions for this country yet.</b><p>National dissatisfaction still reflects hardship. Curated minority regions will expand over time.</p></div>';for(let{group,zone}of zones){zone.id=resZoneId(group,c);zone.groupId=group.id;let avg=Math.round(resZoneMean(zone)),share=Math.round((state.ethnicShares[zone.id]??zone.share)*100);html+='<div class="card"><b>'+group.name+' communities · '+share+'% mapped share</b><div class="row"><span>Regional dissatisfaction</span><b>'+avg+'%</b></div><p>Related countries: '+(group.kin.length?group.kin.map(name).join(', '):'none mapped')+'. Revolt objective: '+(group.outcome==='independence'?'independence':'regional autonomy')+'.</p>'+resPolicySelector(c,group)+'</div>';}for(let r of(state.revolts||[]).filter(r=>r.country===c&&r.status==='active')){html+='<div class="card"><b>Civil war · '+resGroupName(r.groupId)+'</b><p>Rebels hold '+Math.round(resRevoltShare(r)*100)+'% of the mapped regional homeland.</p>'+actionButton('res_autonomy_'+r.id,'Negotiate regional autonomy · 15 PP')+'</div>';}return html;}
function resSetPolicyUI(e){let id=e.target?.dataset?.resPolicy;if(!id||!state)return;let ok=resSetPolicy(state.player,id,e.target.value);if(!ok)notify('Not enough political power or this region is unavailable.');render();save(false);}
function resCallForSupport(){let n=state.countries[state.player];if(!n.exile)return false;let cost=n.gdp*.002;if(n.treasury<cost){notify('Insufficient reserves to fund a liberation mission.');return false;}n.treasury-=cost;n.exile.support=clamp((n.exile.support||0)+25,0,100);for(let group of RES_GROUPS)for(let zone of group.zones)if(zone.country===state.player)state.regionDissatisfaction[resZoneId(group,zone.country)]=clamp((state.regionDissatisfaction[resZoneId(group,zone.country)]||0)+4,0,100);log('The government in exile rallied foreign support and resistance networks.');return true;}
function resLiberationShare(c){let area=wcCountryArea(c),rad=Math.PI/180,recovered=0;for(let key of Object.keys(state.control||{}))if(wcLegal(key)===c&&wcOwner(key)===c)recovered+=2*WC_WIDTH*WC_HEIGHT*rad*rad*Math.cos(wcPoint(key)[1]*rad);return area?clamp(recovered/area,0,1):0;}
function resStartLiberation(c){let n=state.countries[c],e=n?.exile;if(!e||e.active||e.support<55)return false;let occupier=e.occupier||wcRoot(c);if(!occupier||occupier===c)return false;n.owner=c;e.active=true;e.started=state.turn;n.force=Math.max(n.force,state.countries[occupier].force*.34);n.ready=Math.max(n.ready,68);let w=wcCreateWar(c,occupier,{liberation:true,exileCountry:c});state.wars.push(w);log(name(c)+'’s government in exile launched a campaign to liberate the homeland.',true);return true;}
function resFinishLiberation(w,success){let c=w.exileCountry||w.a,n=state.countries[c],e=n?.exile;if(!e)return;let occupier=e.occupier;w.active=false;if(success){delete n.exile;n.owner=c;log(name(c)+' liberated its homeland and restored its government.',true);return;}for(let key of Object.keys(state.control||{}))if(wcLegal(key)===c&&state.control[key]===c)delete state.control[key];n.owner=occupier;e.active=false;e.failedTurn=state.turn;log(name(c)+'’s liberation campaign stalled. The government remains in exile.',true);}
function resResolveExileWar(w){let c=w.exileCountry||w.a,n=state.countries[c],e=n?.exile;if(!e||!w.active)return;let capital=wcCities().find(city=>city.home===c&&city.capital),share=resLiberationShare(c);if(capital&&wcCityOwner(capital)===c&&share>=.15){resFinishLiberation(w,true);return;}if(w.months>=48)resFinishLiberation(w,false);}
function resAIExile(c){let n=state.countries[c],e=n.exile;if(!e||e.active)return;let occupier=e.occupier=wcRoot(c);if(state.turn-(e.lastAttempt||0)<12||e.support<55||state.wars.filter(w=>w.active).length>=2||ptTruce(c,occupier))return;let weak=state.countries[occupier]&&(state.countries[occupier].morale<45||simAtWar(occupier));if(!weak)return;e.lastAttempt=state.turn;resStartLiberation(c);}
function resZoneOccupied(zone){
 let cells=resCells(zone.groupId,zone.country);if(!cells.length)return{share:0,recent:0};
 let count=0,recent=0,absorbed=zone.source&&zone.source!==zone.country,absorbAge=state.turn-(zone.absorbedTurn??state.turn);
 for(let cell of cells){let owner=wcOwner(cell.key);if(owner!==zone.country||absorbed){count++;if(absorbed){if(absorbAge<36)recent++;}else{if(state.occupiedAt[cell.key]===undefined)state.occupiedAt[cell.key]=state.turn;if(state.turn-state.occupiedAt[cell.key]<36)recent++;}}else delete state.occupiedAt[cell.key];}
 return{share:count/cells.length,recent:recent/cells.length};
}
function resDynamicSeed(zone,seedKey=null){
 let source=zone.source||zone.featureCode,feature=world[zone.featureCode||source]?.feature;if(!feature)return[];
 let insideSource=key=>ptSovereign(key)===source;
 let city=wcCities().find(c=>c.home===source&&c.capital),seed=seedKey||city?.key||wcKey(...(world[zone.featureCode||source]?.center||[0,0]));
 if(!insideSource(seed)){let queue=[seed],seen=new Set(queue),found=null;for(let i=0;i<queue.length&&i<5000&&!found;i++){let key=queue[i];if(insideSource(key)){found=key;break;}for(let next of wcNeighbors(key))if(!seen.has(next)){seen.add(next);queue.push(next);}}if(!found)return[];seed=found;}
 let queue=[seed],seen=new Set([seed]),cluster=[];for(let i=0;i<queue.length&&cluster.length<1600;i++){let key=queue[i];if(!insideSource(key))continue;cluster.push(key);for(let next of wcNeighbors(key))if(!seen.has(next)&&insideSource(next)){seen.add(next);queue.push(next);}}return cluster;
}
function resLargestHotComponent(hot,step=1){
 let remaining=new Set(hot.map(x=>x.key)),byKey=new Map(hot.map(x=>[x.key,x])),largest=[];
 while(remaining.size){let seed=remaining.values().next().value,queue=[seed],component=[];remaining.delete(seed);for(let i=0;i<queue.length;i++){let key=queue[i];component.push(key);let[q,r]=key.split(',').map(Number);for(let[dq,dr]of WC_DIRS){let next=(q+dq*step)+','+(r+dr*step);if(remaining.has(next)){remaining.delete(next);queue.push(next);}}}if(component.length>largest.length)largest=component;}
 return{cells:largest,weight:largest.reduce((sum,key)=>sum+(byKey.get(key)?.share||0),0)};
}
function resCheckRevolts(){
 for(let group of RES_GROUPS)for(let zone of group.zones){
  let id=resZoneId(group,zone.country);zone.id=id;zone.groupId=group.id;zone.goal=group.outcome;
  if(state.independentRegions[id]||state.revolts.some(r=>r.zoneId===id&&['active','independent'].includes(r.status)))continue;
  let cells=resCells(group.id,zone.country);if(!cells.length)continue;
  let total=cells.reduce((sum,x)=>sum+x.share,0),hot=cells.filter(x=>resCellValue(zone,x)>=90),hotWeight=hot.reduce((sum,x)=>sum+x.share,0);
  if(hotWeight/total<.6)continue;
  let connected=resLargestHotComponent(hot,zone.sampleStep||1);
  if(connected.weight/total<.6)continue;
  if(zone.featureCode){let cluster=resDynamicSeed(zone,connected.cells[Math.floor(connected.cells.length/2)]?.key);if(cluster.length)resStartRevolt(group,zone,cluster);continue;}
  resStartRevolt(group,zone,connected.cells);
 }
}
function resStartRevolt(group,zone,cluster){let country=zone.country,zoneId=resZoneId(group,country),actor=resActorId(group.id,country),host=wcRoot(country),revoltId=actor+'_'+state.turn;if(state.revolts.some(r=>r.zoneId===zoneId&&r.status==='active'))return;let rebel=resActor(actor,group);rebel.owner=actor;rebel.revolt=true;rebel.disbanded=false;rebel.force=Math.max(rebel.force,state.countries[country].force*.3);resFeature(actor,zone);for(let key of cluster.slice(0,Math.min(1600,cluster.length)))state.control[key]=actor;let revolt={id:revoltId,actor,groupId:group.id,country,host,zoneId,status:'active',startTurn:state.turn,goal:group.outcome};state.revolts.push(revolt);let w=wcCreateWar(host,actor,{revoltId,revoltGroup:group.id,revoltCountry:country});state.wars.push(w);if(country===state.player)state.approval=clamp(state.approval-4,0,100);else if(state.countries[country].ai)state.countries[country].ai.approval=clamp(state.countries[country].ai.approval-4,0,100);log(group.name+' communities rose in civil war across '+name(country)+'. Regional dissatisfaction crossed 90% in a connected majority of their mapped homeland.',true);}
function resRevoltShare(r){
 let cells=resCells(r.groupId,r.country),held=0,total=0;for(let cell of cells){total+=cell.share;if(wcOwner(cell.key)===r.actor)held+=cell.share;}return total?held/total:0;
}
function resResolveRevolt(w){let r=resRevolt(w.revoltId);if(!r||r.status!=='active')return;let group=RES_GROUPS.find(g=>g.id===r.groupId),zone=resFindZone(r.zoneId)?.zone;if(!group||!zone)return;let share=resRevoltShare(r),capital=wcCities().find(city=>city.home===r.country&&city.capital),capitalCaptured=capital&&wcCityOwner(capital)===r.actor;if(share>=.7){if(group.outcome==='independence')resMakeIndependent(r,group,zone,w);else resGrantAutonomyInternal(r,group,zone,w);return;}if(capitalCaptured&&share>=.25){resChangeGovernment(r,group,zone,w);return;}if(w.months>=36&&share<=.08)resSuppressRevolt(r,group,zone,w);}
function resFinishRevolt(r,w,status){
 let group=RES_GROUPS.find(g=>g.id===r.groupId),zone=group?.zones.find(z=>z.country===r.country);
 if(zone?.featureCode){let source=zone.source||zone.featureCode,feature=world[zone.featureCode]?.feature;for(let key of Object.keys(state.control||{}))if(state.control[key]===r.actor&&ptSovereign(key)===source&&feature&&inside(wcPoint(key),feature))delete state.control[key];}
 else for(let cell of resCells(r.groupId,r.country))if(state.control[cell.key]===r.actor)delete state.control[cell.key];
 r.status=status;r.endTurn=state.turn;if(w)w.active=false;let actor=state.countries[r.actor];if(actor){actor.revolt=false;if(status!=='independent'){actor.owner=r.country;actor.disbanded=true;}}
}
function resMakeIndependent(r,group,zone,w){
 resFinishRevolt(r,w,'independent');state.independentRegions[r.zoneId]=r.actor;
 let actor=resActor(r.actor,group,true);actor.independent=true;actor.revolt=false;actor.disbanded=false;actor.displayName=group.name;actor.owner=r.actor;
 actor.ai??={...simPersonality(r.actor),approval:54,legitimacy:52,election:state.turn+48,term:1,lastAction:'A new independent government was established.',lastTurn:state.turn,decisions:0,history:[],politicalPower:0,politics:{termMonths:48,mediaLevel:0,supremeRule:false}};
 resFeature(r.actor,zone);
 if(zone.featureCode)resIndependentSourceOwners.set(zone.source||zone.featureCode,r.actor);else for(let cell of resCells(group.id,r.country))state.titles[cell.key]=r.actor;
 state.titleRevision=(state.titleRevision||0)+1;state.regionDissatisfaction[r.zoneId]=32;
 if(typeof ptInvalidateBorders==='function')ptInvalidateBorders();resRegisterIndependent(r.actor,group,zone);
 log(group.name+' communities secured independence from '+name(r.country)+'.',true);
}
function resGrantAutonomyInternal(r,group,zone,w){resFinishRevolt(r,w,'autonomy');let n=state.countries[r.country];n.autonomousRegions??=[];if(!n.autonomousRegions.includes(group.id))n.autonomousRegions.push(group.id);state.regionDissatisfaction[r.zoneId]=25;log(name(r.country)+' granted regional autonomy to '+group.name+' communities after the civil war.',true);}
function resChangeGovernment(r,group,zone,w){resFinishRevolt(r,w,'government-change');if(r.country===state.player){state.approval=35;state.legitimacy=28;state.politicalPower=0;state.election=state.turn+12;}else{let ai=state.countries[r.country].ai;if(ai){ai.approval=55;ai.legitimacy=35;ai.politics.supremeRule=false;ai.politics.mediaLevel=0;ai.agenda='A new government after civil war.';}}state.regionDissatisfaction[r.zoneId]=30;log('A government crisis in '+name(r.country)+' replaced the ruling administration after rebels captured the capital.',true);}
function resSuppressRevolt(r,group,zone,w){resFinishRevolt(r,w,'suppressed');state.regionDissatisfaction[r.zoneId]=Math.max(35,(state.regionDissatisfaction[r.zoneId]||0)-35);log(name(r.country)+' suppressed the '+group.name+' uprising, but local grievances remain.',true);}
function resNegotiateAutonomy(actor){let r=resRevolt(actor),w=r&&state.wars.find(w=>w.revoltId===actor&&w.active);if(!r||!w||r.country!==state.player)return false;if(polPower(state.player)<15){notify('Not enough political power to negotiate autonomy.');return false;}polSetPower(state.player,polPower(state.player)-15);resGrantAutonomyInternal(r,RES_GROUPS.find(g=>g.id===r.groupId),resFindZone(r.zoneId).zone,w);return true;}
function resOnAnnexation(country,occupier){
 let n=state.countries[country];if(!n)return false;n.exile??={since:state.turn,occupier,support:10,lastAttempt:0};n.exile.occupier=occupier;n.exile.support=clamp(n.exile.support||10,0,100);n.exile.active=false;
 if(country===state.player)state.ended=false;
 if(!state.absorbedRegions?.some(region=>region.kind==='annexation'&&region.source===country&&region.host===occupier))resAddAbsorbedRegion(country,occupier,null,'annexation');
 log(name(country)+' continues as a government in exile and will seek liberation.',true);return true;
}
function resMonthly(){
 if(!state)return;resEnsure();
 for(let c in state.countries){let n=state.countries[c];if(n.revolt||n.disbanded)continue;let approval=resApproval(c),fatigue=resFatigue(c),atWar=simAtWar(c),growth=n.growth||0,hardship=Math.max(0,(48-approval)/48)*.35+Math.max(0,-growth)/8*.32+fatigue/100*.3,delta=.04+hardship-(approval>65&&growth>0&&!atWar?.22:0);if(n.exile)delta+=.18;state.civicDissatisfaction[c]=clamp((state.civicDissatisfaction[c]??12)+delta,0,100);if(n.exile){n.exile.support=clamp((n.exile.support||0)+.35+(atWar?.6:0),0,100);if(c!==state.player)resAIExile(c);}}
 for(let group of RES_GROUPS)for(let zone of group.zones){let id=resZoneId(group,zone.country),c=zone.country,n=state.countries[c];if(!n)continue;zone.id=id;zone.groupId=group.id;zone.goal=group.outcome;let occupied=resZoneOccupied(zone),policy=resPolicy(c,group.id),approval=resApproval(c),fatigue=resFatigue(c),controller=wcRoot(c),kinConflict=group.kin.some(k=>world[k]&&(simAtWar(c,k)||simAtWar(controller,k)||state.countries[c].sanctions.includes(k)||state.countries[controller]?.sanctions.includes(k))),drift=.025+(state.civicDissatisfaction[c]||0)*.012+Math.max(0,(50-approval)/50)*.24+Math.max(0,-(n.growth||0))/8*.22+fatigue/100*.22;if(kinConflict)drift+=.72;if(occupied.share>0)drift+=.35+occupied.share*.45+occupied.recent*.65;if(n.exile)drift+=.45;if(n.autonomousRegions?.includes(group.id))drift-=.7;if(policy==='protect')drift-=.65;else if(policy==='integrate')drift-=.2;else if(policy==='force'){drift+=1.45;state.ethnicShares[id]=Math.max(.08,(state.ethnicShares[id]??zone.share)-.0003);}state.regionDissatisfaction[id]=clamp((state.regionDissatisfaction[id]||12)+drift,0,100);if(c!==state.player&&n.ai&&state.turn%24===(c.charCodeAt(0)+c.charCodeAt(1))%24){let desired=n.ai.risk>=.8?'force':'protect';if(resPolicy(c,group.id)!==desired&&n.ai.politicalPower>=(desired==='force'?20:10)){n.ai.politicalPower-=desired==='force'?20:10;n.ethnicPolicies[group.id]=desired;}}}
 resCheckRevolts();
}
function resDraw(){if(!state||$('#layer').value!=='dissatisfaction')return;ctx.save();for(let group of RES_GROUPS)for(let zone of group.zones){for(let cell of resCells(group.id,zone.country)){let value=resCellValue(zone,cell);if(value<18)continue;let p=screen(...wcPoint(cell.key));if(p[0]<-12||p[0]>W+12||p[1]<-12||p[1]>H+12)continue;ctx.fillStyle='rgba(222,83,70,'+(.08+value/100*.48)+')';ctx.beginPath();wcHexPath(cell.key);ctx.fill();}}for(let city of wcCities()){let c=city.home,value=state.civicDissatisfaction[c]||0;if(value<25)continue;let p=screen(...city.point);if(p[0]<-12||p[0]>W+12||p[1]<-12||p[1]>H+12)continue;ctx.fillStyle='rgba(222,83,70,'+(.08+value/100*.35)+')';ctx.beginPath();wcHexPath(city.key);ctx.fill();}ctx.restore();}
document.addEventListener('change',resSetPolicyUI);
