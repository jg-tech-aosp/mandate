'use strict';
const debugPanel=document.createElement('section');
debugPanel.id='debugPanel';
debugPanel.setAttribute('aria-label','Developer debug tools');
debugPanel.innerHTML=
 '<div class="dbgHeader"><div><small>MANDATE / SANDBOX</small><strong>DEBUG TOOLS</strong></div><button type="button" id="debugClose" aria-label="Close debug tools">×</button></div>'+
 '<div class="dbgSection"><p class="dbgNote">F2 opens this panel. Select hexes, copy a cell report, and use the controls to inspect occupation or test units.</p><div class="dbgRow"><button type="button" id="debugSelectCells" class="dbgPrimary">Select cells</button><button type="button" data-debug-action="clear">Clear selection</button></div><div id="debugSelectionList" aria-live="polite">No cells selected.</div><div class="dbgRow"><button type="button" id="debugCopy" data-debug-action="copy">Copy cell report</button><button type="button" id="debugDownload" data-debug-action="download">Download JSON</button></div><p class="dbgNote">Copy the report and paste it into chat so I can inspect the exact hexes.</p></div>'+
 '<div class="dbgSection"><h3>Occupation / control</h3><label for="debugCountry" class="dbgNote">Country used by the tools</label><select id="debugCountry" aria-label="Debug tool country"></select><div class="dbgRow"><button type="button" id="debugPaint" data-debug-action="paint" class="dbgPrimary">Set control on selected cells</button></div><div class="dbgRow"><button type="button" id="debugReset" data-debug-action="reset">Reset to scenario rules</button></div></div>'+
 '<div class="dbgSection"><h3>Division spawning</h3><label for="debugPersonnel" class="dbgNote">Personnel per division (thousands)</label><div class="dbgRow"><input id="debugPersonnel" type="number" min="0.1" max="20" step="0.1" value="10"><button type="button" id="debugSpawn" data-debug-action="spawn" class="dbgPrimary">Spawn at selected cells</button></div><p class="dbgNote">Creates one free division at each selected land cell, up to 20 per action.</p></div>'+
 '<div class="dbgSection"><h3>God tools</h3><div class="dbgRow"><button type="button" id="debugFund" data-debug-action="fund">Give funds &amp; arms</button><button type="button" id="debugReady" data-debug-action="ready">Max division readiness</button></div><div class="dbgRow"><button type="button" id="debugUndo" data-debug-action="undo">Undo last tool action</button></div></div>'+
 '<div id="debugStatus" class="dbgStatus" role="status" aria-live="polite">Start a campaign to use the tools.</div>';
document.body.append(debugPanel);
const debugToggleButton=document.createElement('button');
debugToggleButton.type='button';
debugToggleButton.id='debugToggle';
debugToggleButton.textContent='Debug';
debugToggleButton.setAttribute('aria-controls','debugPanel');
debugToggleButton.setAttribute('aria-expanded','false');
document.querySelector('.headActions').insertBefore(debugToggleButton,document.querySelector('#new'));
const debugSelectButton=debugPanel.querySelector('#debugSelectCells');
const debugCountrySelect=debugPanel.querySelector('#debugCountry');
const debugSelectionList=debugPanel.querySelector('#debugSelectionList');
const debugStatus=debugPanel.querySelector('#debugStatus');
const debugSelectedCells=new Set();
const debugUndoStack=[];
let debugStateRef=null;
let debugPanelOpen=false;
let debugSelecting=false;
let debugPointerId=null;
function debugCountryName(code){return code&&world[code]?name(code)+' ('+code+')':code||'unclaimed';}
function debugSetStatus(message){debugStatus.textContent=message;}
function debugRefreshCountryChoices(){
 if(!state?.countries)return;
 const previous=debugCountrySelect.value;
 debugCountrySelect.replaceChildren();
 for(const code of Object.keys(state.countries).sort((a,b)=>name(a).localeCompare(name(b)))){
  const option=document.createElement('option');option.value=code;option.textContent=name(code)+' ('+code+')';debugCountrySelect.append(option);
 }
 debugCountrySelect.value=state.countries[previous]?previous:state.player;
}
function debugRefreshSelectionList(){
 if(!debugSelectedCells.size){debugSelectionList.textContent='No cells selected.';return;}
 const lines=[];
 for(const key of debugSelectedCells){
  const point=wcPoint(key),legal=wcLegal(key),owner=wcOwner(key);
  lines.push(key+' · '+point[0].toFixed(3)+', '+point[1].toFixed(3)+' · '+debugCountryName(legal)+' → '+debugCountryName(owner));
 }
 debugSelectionList.textContent=debugSelectedCells.size+' selected (maximum 50)\n'+lines.join('\n');
}
function debugRefreshUI(){
 if(state&&debugStateRef!==state){debugStateRef=state;debugSelectedCells.clear();debugUndoStack.length=0;debugSelecting=false;debugPointerId=null;}
 debugRefreshCountryChoices();
 const hasState=!!state,hasCells=debugSelectedCells.size>0,canUndo=debugUndoStack.length>0&&debugUndoStack[debugUndoStack.length-1].state===state;
 for(const id of ['debugSelectCells','debugCopy','debugDownload','debugPaint','debugReset','debugSpawn','debugFund','debugReady']){const button=debugPanel.querySelector('#'+id);if(button)button.disabled=!hasState;}
 debugPanel.querySelector('#debugCopy').disabled=!hasState||!hasCells;
 debugPanel.querySelector('#debugDownload').disabled=!hasState||!hasCells;
 debugPanel.querySelector('#debugPaint').disabled=!hasState||!hasCells;
 debugPanel.querySelector('#debugReset').disabled=!hasState||!hasCells;
 debugPanel.querySelector('#debugSpawn').disabled=!hasState||!hasCells;
 debugPanel.querySelector('#debugFund').disabled=!hasState;
 debugPanel.querySelector('#debugReady').disabled=!hasState;
 debugPanel.querySelector('#debugUndo').disabled=!canUndo;
 debugSelectButton.textContent=debugSelecting?'Stop selecting':'Select cells';
 debugPanel.querySelector('#debugPaint').textContent='Set control to '+(debugCountrySelect.value||'country');
 if(!hasState)debugSetStatus('Start a campaign to use the tools.');
 else if(!debugSelecting&&debugSelectedCells.size===0)debugSetStatus('Ready. Choose cells or use a country tool.');
 else if(debugSelecting)debugSetStatus('Cell selection is on. Click map hexes to add or remove them.');
 else debugSetStatus(debugSelectedCells.size+' cell'+(debugSelectedCells.size===1?'':'s')+' selected.');
 debugRefreshSelectionList();
}
function debugDrawCells(){
 if(!state||!debugSelectedCells.size)return;
 ctx.save();
 for(const key of debugSelectedCells){
  const owner=wcOwner(key);
  ctx.beginPath();wcHexPath(key);
  ctx.fillStyle=owner==='UA'?'#eb937e35':'#d6e78d35';ctx.fill();
  ctx.strokeStyle=owner==='UA'?'#ff8d79':'#f5e6a8';ctx.lineWidth=2;ctx.stroke();
 }
 ctx.restore();
}
const debugOriginalDraw=draw;
draw=function(){debugOriginalDraw();debugDrawCells();};
const debugOriginalRender=render;
render=function(){debugOriginalRender();debugRefreshUI();};
function debugTogglePanel(force){
 debugPanelOpen=typeof force==='boolean'?force:!debugPanelOpen;
 debugPanel.classList.toggle('open',debugPanelOpen);
 debugToggleButton.setAttribute('aria-expanded',String(debugPanelOpen));
 if(debugPanelOpen)debugRefreshUI();else{debugSelecting=false;debugPointerId=null;debugRefreshUI();}
}
function debugToggleCellSelection(){
 if(!state){debugSetStatus('Start a campaign before selecting cells.');return;}
 debugSelecting=!debugSelecting;debugPointerId=null;debugRefreshUI();
}
function debugCellTarget(target){return target===canvas||(target instanceof Element&&!!target.closest('#unitMarkers'));}
const debugMapWrap=canvas.closest('.mapWrap');
debugMapWrap.addEventListener('pointerdown',event=>{
 if(!debugSelecting||!state||!debugCellTarget(event.target)||event.button!==0)return;
 debugPointerId=event.pointerId;
 try{canvas.setPointerCapture(event.pointerId);}catch{}
 event.preventDefault();event.stopImmediatePropagation();
},true);
debugMapWrap.addEventListener('pointermove',event=>{
 if(debugSelecting&&debugPointerId===event.pointerId){event.preventDefault();event.stopImmediatePropagation();}
},true);
debugMapWrap.addEventListener('pointerup',event=>{
 if(!debugSelecting||debugPointerId!==event.pointerId)return;
 debugPointerId=null;event.preventDefault();event.stopImmediatePropagation();
 const rect=canvas.getBoundingClientRect(),key=wcKey(...geo(event.clientX-rect.left,event.clientY-rect.top));
 if(debugSelectedCells.has(key))debugSelectedCells.delete(key);
 else if(debugSelectedCells.size>=50){notify('Debug selection is limited to 50 cells.');return;}
 else debugSelectedCells.add(key);
 debugRefreshUI();draw();
},true);
debugMapWrap.addEventListener('pointercancel',event=>{
 if(debugPointerId===event.pointerId){debugPointerId=null;event.preventDefault();event.stopImmediatePropagation();}
},true);
function debugCellSummary(key){
 const legal=wcLegal(key),base=wcBase(key),owner=wcOwner(key),sovereign=ptSovereign(key),center=wcPoint(key);
 const fine=wcFineUkraineSamples(key),fineOccupied=fine.filter(wcInsideOccupation).length;
 const nearbyDivisions=[];
 for(const code of Object.keys(state.countries))for(const entry of milDivisionEntries(state.countries[code])){
  const division=entry.division;if(!division.location)continue;
  const distance=milHexDistance(key,division.location);
  if(distance<=3)nearbyDivisions.push({country:code,id:division.id,location:division.location,distance,personnel:division.personnel,readiness:division.readiness,deployment:division.deployment});
 }
 nearbyDivisions.sort((a,b)=>a.distance-b.distance||a.country.localeCompare(b.country)||a.id.localeCompare(b.id));
 const activeFronts=(state.wars||[]).filter(w=>w.active).map(w=>({id:w.id,a:w.a,b:w.b,scenario:!!w.scenario,frontlineDistance:(w.frontier||[]).reduce((best,k)=>Math.min(best,milHexDistance(key,k)),Infinity)}));
 return{
  key,center:{longitude:+center[0].toFixed(6),latitude:+center[1].toFixed(6)},
  legalTerritory:legal,sovereignty:sovereign,baseController:base,currentController:owner,
  savedControlOverride:state.control?.[key]??null,titleOwner:state.titles?.[key]??null,
  occupation:{snapshot:occupationData?.properties?.snapshot_date??null,insidePolygonAtCellCenter:wcInsideOccupation(center),rawOccupiedCell:wcRawOccupiedCell(key),occupiedCellRule:wcOccupiedCell(key),ukrainianFineSamples:fine.length,fineSamplesInsideOccupation:fineOccupied},
  activeFronts,nearbyDivisions:nearbyDivisions.slice(0,12),
  neighbors:wcNeighbors(key).map(neighbor=>({key:neighbor,legalTerritory:wcLegal(neighbor),baseController:wcBase(neighbor),currentController:wcOwner(neighbor),savedControlOverride:state.control?.[neighbor]??null}))
 };
}
function debugMakeReport(){
 return{
  reportType:'MANDATE selected-cell debug report',createdAt:new Date().toISOString(),
  campaign:{mode:state.mode,player:state.player,turn:state.turn,date:dates(),mapLayer:$('#layer').value,occupationSnapshot:occupationData?.properties?.snapshot_date??null},
  selectedCells:[...debugSelectedCells].map(debugCellSummary)
 };
}
function debugCopyFallback(text){
 const area=document.createElement('textarea');area.value=text;area.setAttribute('readonly','');area.style.position='fixed';area.style.opacity='0';document.body.append(area);area.select();
 const copied=!!document.execCommand?.('copy');area.remove();if(!copied)throw Error('Clipboard copy is unavailable.');
}
async function debugCopyReport(){
 const text=JSON.stringify(debugMakeReport(),null,2);
 try{if(navigator.clipboard?.writeText)await navigator.clipboard.writeText(text);else debugCopyFallback(text);notify('Cell report copied. Paste it into chat.');}
 catch(error){try{debugCopyFallback(text);notify('Cell report copied. Paste it into chat.');}catch{notify('Copy failed. Use Download JSON instead.');}}
}
function debugDownloadReport(){
 const blob=new Blob([JSON.stringify(debugMakeReport(),null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),link=document.createElement('a');
 link.href=url;link.download='mandate-cell-debug-'+new Date().toISOString().replace(/[:.]/g,'-')+'.json';document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function debugPushUndo(label,undo,keys=[]){
 debugUndoStack.push({label,undo,keys,state});if(debugUndoStack.length>30)debugUndoStack.shift();
}
function debugRefreshFronts(keys){
 for(const war of state.wars||[]){
  if(!war.active)continue;
  const band=new Set([...(war.frontier||[]),...keys]);
  for(const key of [...band])for(const neighbor of wcNeighbors(key))band.add(neighbor);
  war.frontier=[...band].filter(key=>wcOpposing(key,war));
 }
}
function debugAfterMutation(keys=[]){
 debugRefreshFronts(keys);render();save(false);debugRefreshUI();
}
function debugPaintSelectedCells(){
 const code=debugCountrySelect.value,keys=[...debugSelectedCells].filter(key=>wcLegal(key));
 if(!code||!keys.length){notify('Select at least one land cell and a country.');return;}
 const previous=new Map();for(const key of keys)previous.set(key,state.control?.[key]??null);
 state.control??={};for(const key of keys)wcSetOwner(key,code);
 debugPushUndo('cell control',()=>{state.control??={};for(const[key,value]of previous){if(value===null)delete state.control[key];else state.control[key]=value;}},keys);
 debugAfterMutation(keys);notify('Control updated for '+keys.length+' cells.');
}
function debugResetSelectedCells(){
 const keys=[...debugSelectedCells].filter(key=>wcLegal(key));
 if(!keys.length){notify('Select at least one land cell first.');return;}
 const previous=new Map();for(const key of keys)previous.set(key,state.control?.[key]??null);
 state.control??={};for(const key of keys)delete state.control[key];
 debugPushUndo('reset cell control',()=>{state.control??={};for(const[key,value]of previous)if(value!==null)state.control[key]=value;},keys);
 debugAfterMutation(keys);notify('Selected cells now use the scenario and map rules.');
}
function debugSpawnDivisions(){
 const code=debugCountrySelect.value,n=state.countries[code],keys=[...debugSelectedCells].filter(key=>wcLegal(key));
 if(!n||!keys.length){notify('Select a country and at least one land cell.');return;}
 if(keys.length>20)keys.length=20;
 milEnsureCountry(n);
 const war=(state.wars||[]).find(w=>w.active&&[w.a,w.b].includes(code)),deployment=war?war.id:'home';
 const personnel=Math.max(.1,Math.min(20,Number(debugPanel.querySelector('#debugPersonnel').value)||10));
 const created=[];
 for(const key of keys){
  const id=milNextDivisionId(n);let formationNumber=n.military.formations.length+1;
  while(n.military.formations.some(f=>f.id===code+'-formation-'+formationNumber))formationNumber++;
  const formationId=code+'-formation-'+formationNumber,number=Number(id.split('-div-').pop());
  const division={id,personnel,equipment:1,readiness:100,supply:1,createdTurn:state.turn,deployment,arrivalTurn:state.turn,location:key,lastMoveTurn:-1,lastDirectAttackTurn:-1};
  n.military.formations.push({id:formationId,name:'Debug Formation '+number,deployment,arrivalTurn:state.turn,divisions:[division]});created.push({formationId,id});
 }
 milSyncCountry(n);
 debugPushUndo('spawn divisions',()=>{
  for(const item of created){const formation=n.military.formations.find(f=>f.id===item.formationId);if(formation)n.military.formations=n.military.formations.filter(f=>f.id!==item.formationId);}
  milSyncCountry(n);
 },keys);
 debugAfterMutation(keys);notify('Spawned '+created.length+' free division'+(created.length===1?'':'s')+' for '+name(code)+'.');
}
function debugFundCountry(){
 const code=debugCountrySelect.value,n=state.countries[code];if(!n){notify('Choose a country first.');return;}
 milEnsureCountry(n);const previous={treasury:n.treasury,arms:n.economy.inventory.military};
 n.treasury=Math.max(Number(n.treasury)||0,(Number(n.gdp)||1)*100);
 n.economy.inventory.military=Math.max(Number(n.economy.inventory.military)||0,(Number(n.gdp)||1)*10);
 debugPushUndo('fund country',()=>{n.treasury=previous.treasury;n.economy.inventory.military=previous.arms;milSyncCountry(n);});
 milSyncCountry(n);debugAfterMutation();notify('Added a large cash and arms reserve for '+name(code)+'.');
}
function debugMaxReadiness(){
 const code=debugCountrySelect.value,n=state.countries[code];if(!n){notify('Choose a country first.');return;}
 milEnsureCountry(n);const previous=milDivisionEntries(n).map(({division})=>({id:division.id,readiness:division.readiness}));
 if(!previous.length){notify(name(code)+' has no divisions to train.');return;}
 milSetReadiness(n,100);
 debugPushUndo('max readiness',()=>{for(const item of previous){const entry=milFindDivision(n,item.id);if(entry)entry.division.readiness=item.readiness;}milSyncCountry(n);});
 milSyncCountry(n);debugAfterMutation();notify('Set '+previous.length+' divisions to full readiness.');
}
function debugUndo(){
 const item=debugUndoStack.pop();if(!item||item.state!==state){notify('There is no debug action to undo in this campaign.');debugRefreshUI();return;}
 item.undo();debugAfterMutation(item.keys);notify('Undid '+item.label+'.');
}
debugToggleButton.addEventListener('click',()=>debugTogglePanel());
debugPanel.querySelector('#debugClose').addEventListener('click',()=>debugTogglePanel(false));
debugSelectButton.addEventListener('click',debugToggleCellSelection);
debugCountrySelect.addEventListener('change',debugRefreshUI);
debugPanel.addEventListener('click',async event=>{
 const button=event.target.closest('[data-debug-action]');if(!button)return;
 switch(button.dataset.debugAction){
  case'clear':debugSelectedCells.clear();debugRefreshUI();draw();break;
  case'copy':await debugCopyReport();break;
  case'download':debugDownloadReport();break;
  case'paint':debugPaintSelectedCells();break;
  case'reset':debugResetSelectedCells();break;
  case'spawn':debugSpawnDivisions();break;
  case'fund':debugFundCountry();break;
  case'ready':debugMaxReadiness();break;
  case'undo':debugUndo();break;
 }
});
document.addEventListener('keydown',event=>{
 if(event.key==='F2'){event.preventDefault();debugTogglePanel();return;}
 if(event.key==='Escape'&&debugPanelOpen)debugTogglePanel(false);
});
debugRefreshUI();
