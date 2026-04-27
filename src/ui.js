globalThis.PSJModules = globalThis.PSJModules || {};
const expose = (name, value) => {
  globalThis[name] = value;
  globalThis.PSJModules = globalThis.PSJModules || {};
  return value;
};

let toastTimer = null;

function getContextActions(command={}){
  const kind=command?.kind||command?.source||null;
  const type=command?.type||null;
  const phase=command?.phase||command?.status||'idle';
  const status=command?.status||phase;
  const drawingType=type==='route'||type==='line'||type==='area';
  if(kind==='select'||status==='select')return [
    {id:'properties',label:'Properties'},
    {id:'clear',label:'Clear selection'}
  ];
  if(drawingType&&(phase==='paused'||status==='paused'))return [
    {id:'resume',label:'Resume'},
    {id:'end',label:type==='area'?'Close area':'End line'},
    {id:'cancel',label:'Cancel command'}
  ];
  if(drawingType&&(phase==='drawing'||status==='active'))return [
    {id:'pause',label:'Pause'},
    {id:'end',label:type==='area'?'Close area':'End line'},
    {id:'cancel',label:'Cancel command'}
  ];
  return [];
}

function commandStatusSummary(state=app){
  const cmd=state.command||{},active=state.active;
  const source=cmd.kind||cmd.source||active?.source||state.selectMode||'none';
  const type=cmd.type||active?.type||state.mode||'idle';
  return {
    label:type==='idle'?'Idle':`${source} ${type}`.trim(),
    phase:cmd.phase||cmd.status||'idle',
    vertices:active?.vertices?.length||0,
    segments:active?.segments?.length||0,
    selected:state.selected?.size||0
  };
}

function updateCommandHud(){
  if(!ui.hudCommand)return;
  const s=commandStatusSummary(app);
  ui.hudCommand.textContent=s.label;
  ui.hudPhase.textContent=`phase ${s.phase}`;
  ui.hudVertices.textContent=String(s.vertices);
  ui.hudSegments.textContent=String(s.segments);
  ui.hudSelected.textContent=String(s.selected);
}

function closePops(){
  document.querySelectorAll('.popover.open').forEach(p=>p.classList.remove('open'));
}

function clampPopover(pop,anchor){
  closePops();
  pop.classList.add('open');
  if(pop===ui.viewPop)renderDateChooser();
  const a=anchor.getBoundingClientRect(),pr=pop.getBoundingClientRect();
  let left=a.left+a.width/2-pr.width/2,top=a.top-pr.height-10;
  if(top<8)top=a.bottom+8;
  if(left<8)left=8;
  if(left+pr.width>innerWidth-8)left=innerWidth-pr.width-8;
  pop.style.left=left+'px';
  pop.style.top=top+'px';
}

function pulse(el){
  if(!el)return;
  el.classList.remove('pulse');
  void el.offsetWidth;
  el.classList.add('pulse');
  setTimeout(()=>el.classList.remove('pulse'),320);
}

function toast(msg,ms=2200){
  if(!ui.toast)return;
  ui.toast.textContent=msg;
  ui.toast.classList.remove('hidden');
  ui.toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer=setTimeout(()=>{ui.toast.classList.add('hidden');ui.toast.classList.remove('show')},ms);
}

function normalizeCommandRequest(result){
  const request=result?.request||result?.command?.request||app.command?.request||null;
  if(!request)return null;
  return {...request,type:request.type||request.kind};
}

function handleCommandResult(result){
  const request=normalizeCommandRequest(result);
  if(request?.type==='radius')showRadiusRequest(request);
  updateCommandHud();
  renderAll(false);
  return result;
}

function showRadiusRequest(request){
  if(!request||(request.type||request.kind)!=='radius')return;
  ui.recordTitle.textContent='Circle radius';
  ui.recordBody.innerHTML=`<label>Radius meters<input id="radiusMeters" type="number" step="any" min="0" inputmode="decimal"></label><div class="radiusGrid">${app.radiusPresets.map(r=>`<button class="radiusBtn" data-radius="${r}">${r} m</button>`).join('')}</div>`;
  ui.recordSave.style.display='';
  const apply=(value)=>{
    const result=applyCircleRadius(Number(value));
    if(result.type==='invalid-radius'){toast('Enter a radius greater than 0');updateCommandHud();return;}
    ui.dialog.close();
    handleCommandResult(result);
  };
  ui.recordBody.querySelectorAll('[data-radius]').forEach(b=>b.onclick=()=>apply(b.dataset.radius));
  ui.recordCancel.onclick=()=>ui.dialog.close();
  ui.recordSave.onclick=()=>apply($('radiusMeters').value);
  if(!ui.dialog.open)ui.dialog.showModal();
}

function runContextAction(id,local){
  if(id==='pause')return pauseActive();
  if(id==='resume')return resumeActive();
  if(id==='end')return finishActive(local);
  if(id==='cancel')return cancelActive();
  if(id==='properties'){
    const action=selectionContextActions(local).find(item=>item.id==='prop'||item.id==='properties');
    if(action?.fn)return action.fn();
    toast('No selectable record here');
    return null;
  }
  if(id==='clear'){
    const action=selectionContextActions(local).find(item=>item.id==='clear');
    if(action?.fn)return action.fn();
    toast('No selection to clear');
    return null;
  }
  return null;
}

function openUiContextMenu(e){
  const r=ui.canvas.getBoundingClientRect(),local=screenToLocal(e.clientX-r.left,e.clientY-r.top);
  const items=getContextActions(app.command);
  if(!items.length)return;
  ui.cmdMenu.innerHTML=items.map(it=>`<button type="button" data-cmd="${esc(it.id)}">${esc(it.label)}</button>`).join('');
  ui.cmdMenu.classList.add('open');
  ui.cmdMenu.style.left=Math.min(e.clientX,innerWidth-220)+'px';
  ui.cmdMenu.style.top=Math.min(e.clientY,innerHeight-220)+'px';
  ui.cmdMenu.querySelectorAll('[data-cmd]').forEach(b=>b.onclick=()=>{
    ui.cmdMenu.classList.remove('open');
    handleCommandResult(runContextAction(b.dataset.cmd,local));
  });
}

function monthName(i){return ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][i]}

function showSelectedDateStep(dir){
  const m=app.settings.viewMode,d=safeDate(app.settings.selectedAt);
  if(m==='day')d.setDate(d.getDate()+dir);
  else if(m==='week')d.setDate(d.getDate()+7*dir);
  else if(m==='month')d.setMonth(d.getMonth()+dir);
  else d.setFullYear(d.getFullYear()+dir);
  app.settings.selectedAt=d.toISOString();
  buildViews();
  renderAll();
}

function renderDateChooser(){
  if(!ui.dateChooser)return;
  const mode=app.settings.viewMode||'week',cur=safeDate(app.settings.selectedAt);
  const nav=(label)=>`<div class="dateHead"><button id="dcPrev" type="button"><</button><b>${label}</b><button id="dcNext" type="button">></button></div>`;
  let html='';
  if(mode==='day'){
    const y=cur.getFullYear(),m=cur.getMonth(),first=new Date(y,m,1),start=weekStart(first),days=[];
    for(let i=0;i<42;i++)days.push(addDays(start,i));
    html=nav(`${monthName(m)} ${y}`)+`<div class="dateGrid"><div class="dow">Mo</div><div class="dow">Tu</div><div class="dow">We</div><div class="dow">Th</div><div class="dow">Fr</div><div class="dow">Sa</div><div class="dow">Su</div>${days.map(d=>`<button class="${d.getMonth()!==m?'mutedDay ':''}${ymd(d)===ymd(cur)?'selected':''}" data-date="${d.toISOString()}">${d.getDate()}</button>`).join('')}</div>`;
  }else if(mode==='week'){
    const base=weekStart(cur),weeks=[];
    for(let i=-3;i<=4;i++){const st=addDays(base,i*7),en=addDays(st,6);weeks.push({st,en})}
    html=nav(`W${weekNo(cur)} - ${ymd(base)} > ${ymd(addDays(base,6))}`)+`<div class="dateGrid months">${weeks.map(w=>`<button class="${ymd(w.st)===ymd(base)?'selected':''}" data-date="${w.st.toISOString()}">W${weekNo(w.st)}<br><small>${w.st.getDate()}/${w.st.getMonth()+1}-${w.en.getDate()}/${w.en.getMonth()+1}</small></button>`).join('')}</div>`;
  }else if(mode==='month'){
    const y=cur.getFullYear();
    html=nav(`${y}`)+`<div class="dateGrid months">${Array.from({length:12},(_,m)=>`<button class="${m===cur.getMonth()?'selected':''}" data-date="${new Date(y,m,1).toISOString()}">${monthName(m)}</button>`).join('')}</div>`;
  }else{
    const y=cur.getFullYear(),start=y-5;
    html=nav(`${start}-${start+11}`)+`<div class="dateGrid years">${Array.from({length:12},(_,i)=>start+i).map(yy=>`<button class="${yy===y?'selected':''}" data-date="${new Date(yy,0,1).toISOString()}">${yy}</button>`).join('')}</div>`;
  }
  ui.dateChooser.innerHTML=html;
  ui.dateChooser.querySelectorAll('[data-date]').forEach(b=>b.onclick=()=>{app.settings.selectedAt=safeDate(b.dataset.date).toISOString();buildViews();renderAll();renderDateChooser();});
  const prev=ui.dateChooser.querySelector('#dcPrev'),next=ui.dateChooser.querySelector('#dcNext');
  if(prev)prev.onclick=()=>{showSelectedDateStep(-1);renderDateChooser()};
  if(next)next.onclick=()=>{showSelectedDateStep(1);renderDateChooser()};
  document.querySelectorAll('[data-view]').forEach(b=>b.classList.toggle('active',b.dataset.view===app.settings.viewMode));
}

function setPanel(name){
  ui.panel.classList.add('open');
  ui.panelTitle.textContent=({base:'Base',weekly:'Weekly',settings:'Settings',compass:'Compass / GPS'}[name]||name);
  if(name==='base')renderBasePanel();
  if(name==='weekly')renderWeeklyPanel();
  if(name==='settings')renderSettingsPanel();
  if(name==='compass')renderCompassPanel();
}

function recordTitle(r){return esc(r.name||r.routeId||r.areaId||r.code||r.id)}
function recordMetric(r){
  if(r.type==='route')return `${fmtM(r.metrics?.distanceM||0)}`;
  if(r.type==='area')return `${Number(r.metrics?.areaM2||0).toFixed(1)} m2`;
  if(r.type==='circle')return `r ${Number(r.radiusM||0).toFixed(2)} m`;
  return 'point';
}

function renderBasePanel(){
  const rows=app.base.slice().reverse();
  ui.panelBody.innerHTML=`<div class="row"><span class="pill">${rows.length} records</span><span class="pill">${app.controlPoints.length} control points</span></div>${rows.map(r=>`<div class="card"><span class="pill">${esc(r.type)}</span> <b>${recordTitle(r)}</b><p class="small muted">${esc(r.time?.eventAt||r.createdAt||'')} - ${recordMetric(r)}</p><button type="button" data-show="${esc(r.id)}">Show</button></div>`).join('')||'<p class="muted">No records yet.</p>'}`;
  ui.panelBody.querySelectorAll('[data-show]').forEach(b=>b.onclick=()=>showRecord(b.dataset.show));
}

function renderWeeklyPanel(){
  const st=weekStart(app.settings.selectedAt),days=Array.from({length:7},(_,i)=>addDays(st,i)),rows=app.base.filter(r=>recWeek(r)===ymd(st));
  ui.panelBody.innerHTML=`<div class="row"><button id="prevWeekBtn" type="button"><</button><b>W${weekNo(st)} - ${ymd(days[0])} > ${ymd(days[6])}</b><button id="nextWeekBtn" type="button">></button></div><div class="tableWrap"><table><thead><tr><th>Day</th><th>Objects</th><th>Routes km</th><th>Areas m2</th></tr></thead><tbody>${days.map(d=>{const day=ymd(d),dr=rows.filter(r=>recDate(r)===day);return `<tr><th>${day}</th><td>${dr.filter(r=>r.type==='point').length}</td><td>${(dr.filter(r=>r.type==='route').reduce((s,r)=>s+(r.metrics?.distanceM||0),0)/1000).toFixed(3)}</td><td>${dr.filter(r=>r.type==='area').reduce((s,r)=>s+(r.metrics?.areaM2||0),0).toFixed(1)}</td></tr>`}).join('')}</tbody></table></div>${rows.map(r=>`<div class="card"><b>${recordTitle(r)}</b><p class="small muted">${esc(r.type)} - ${recordMetric(r)}</p></div>`).join('')||'<p class="muted">No records this week.</p>'}`;
  const prev=$('prevWeekBtn'),next=$('nextWeekBtn');
  if(prev)prev.onclick=()=>{app.settings.selectedAt=addDays(st,-7).toISOString();buildViews();renderWeeklyPanel();renderAll(false)};
  if(next)next.onclick=()=>{app.settings.selectedAt=addDays(st,7).toISOString();buildViews();renderWeeklyPanel();renderAll(false)};
}

function renderSettingsPanel(){
  ui.panelBody.innerHTML=`<div class="card"><b>View</b><p class="small muted">Selected ${ymd(app.settings.selectedAt)} - ${app.settings.viewMode}</p><div class="row"><button data-v="day">Day</button><button data-v="week">Week</button><button data-v="month">Month</button><button data-v="year">Year</button></div></div><div class="card"><b>GPS / Solver</b><label>GNSS interval sec<input id="setGnss" type="number" min="1" value="${app.settings.gnssInterval}"></label><label>Route interval sec<input id="setRoute" type="number" min="1" value="${app.settings.routeInterval}"></label><button id="saveSet" class="primary" type="button">Save settings</button></div><div class="card"><b>Export</b><div class="row"><select id="exportRange"><option>day</option><option selected>week</option><option>month</option><option>year</option></select><select id="exportMode"><option value="historical">Historical</option><option value="current">Current best</option></select><button id="exportGeojson" type="button">GeoJSON</button><button id="exportKml" type="button">KML</button></div></div>`;
  ui.panelBody.querySelectorAll('[data-v]').forEach(b=>b.onclick=()=>{app.settings.viewMode=b.dataset.v;buildViews();renderSettingsPanel();renderAll(false)});
  $('saveSet').onclick=async()=>{app.settings.gnssInterval=Math.max(1,Number($('setGnss').value)||5);app.settings.routeInterval=Math.max(1,Number($('setRoute').value)||10);await saveSettings();toast('Settings saved')};
  $('exportGeojson').onclick=()=>download(exportGeoJSON($('exportRange').value,$('exportMode').value),'psj.geojson','application/geo+json');
  $('exportKml').onclick=()=>download(exportKML($('exportRange').value,$('exportMode').value),'psj.kml','application/vnd.google-earth.kml+xml');
}

function renderCompassPanel(){
  ui.panelBody.innerHTML=`<div class="card"><b>Avatar</b><pre>${esc(JSON.stringify({local:app.avatarView.correctedLocal,wgs:app.avatarView.correctedWgs||app.avatarView.rawWgs,accuracy:app.avatarView.accuracy,heading:app.avatarView.heading,solver:app.avatarView.solver,confidence:app.avatarView.confidence},null,2))}</pre></div><div class="card"><b>Control points</b><p>${app.controlPoints.length}</p></div>`;
}

function tableFor(rows){if(!rows.length)return '<p class="muted">No rows.</p>';const keys=Array.from(new Set(rows.flatMap(r=>Object.keys(r)).slice(0,12))).slice(0,8);return `<div class="tableWrap"><table><thead><tr>${keys.map(k=>`<th>${esc(k)}</th>`).join('')}</tr></thead><tbody>${rows.map(r=>`<tr>${keys.map(k=>`<td>${esc(typeof r[k]==='object'?JSON.stringify(r[k]):r[k])}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`}
function dbSection(name,rows){return `<details><summary>${esc(name)} - ${rows.length}</summary>${tableFor(rows)}</details>`}
function weeklyTable(days,rows){return `<div class="tableWrap"><table><tbody>${days.map(d=>`<tr><td>${ymd(d)}</td><td>${rows.filter(r=>recDate(r)===ymd(d)).length}</td></tr>`).join('')}</tbody></table></div>`}
function weeklyCard(r){return `<div class="card"><b>${recordTitle(r)}</b><p>${esc(r.type)}</p></div>`}

function showRecord(id){
  const r=app.base.find(x=>x.id===id);
  if(!r)return;
  const l=r.correctedLocal||r.local||r.vertices?.[0]?.correctedLocal;
  if(l){app.camera.x=l.x;app.camera.y=l.y;app.camera.z=Math.max(app.camera.z,2);ui.panel.classList.remove('open');renderAll(false)}
}
if(globalThis.window)window.PSJ_show=showRecord;

function setToolButtonsActive(){
  document.querySelectorAll('[data-add],[data-design],[data-select]').forEach(b=>b.classList.remove('active'));
}

function setupToolButtons(){
  const start=(source,type)=>type==='circle'?beginCircleCommand(source,'center'):beginCommand(source,type);
  document.querySelectorAll('[data-add]').forEach(b=>b.onclick=()=>{setToolButtonsActive();b.classList.add('active');closePops();handleCommandResult(start('add',b.dataset.add));});
  document.querySelectorAll('[data-design]').forEach(b=>b.onclick=()=>{setToolButtonsActive();b.classList.add('active');closePops();handleCommandResult(start('design',b.dataset.design));});
  document.querySelectorAll('[data-select]').forEach(b=>b.onclick=()=>{setToolButtonsActive();b.classList.add('active');closePops();handleCommandResult(beginSelectCommand(b.dataset.select));});
}

function setup(){
  window.addEventListener('resize',resize);
  ui.viewBtn.onclick=()=>clampPopover(ui.viewPop,ui.viewBtn);
  ui.addBtn.onclick=()=>clampPopover(ui.addPop,ui.addBtn);
  ui.designBtn.onclick=()=>clampPopover(ui.designPop,ui.designBtn);
  ui.selectBtn.onclick=()=>clampPopover(ui.selectPop,ui.selectBtn);
  ui.measureBtn.onclick=()=>{closePops();app.mode='measure';toast('Measure mode is a placeholder.');updateCommandHud()};
  ui.pathBtn.onclick=()=>{closePops();app.mode='path-measure';toast('Path measure is a placeholder.');updateCommandHud()};
  ui.layersBtn.onclick=()=>clampPopover(ui.layersPop,ui.layersBtn);
  ui.followBtn.onclick=()=>{app.follow=!app.follow;ui.followBtn.classList.toggle('active',app.follow)};
  ui.pinBtn.onclick=()=>{const l=app.avatarView.correctedLocal;if(l){app.camera.x=l.x;app.camera.y=l.y;app.follow=true;ui.followBtn.classList.add('active');renderAll(false)}};
  ui.zoomIn.onclick=()=>{app.camera.z*=1.25;renderAll(false)};
  ui.zoomOut.onclick=()=>{app.camera.z/=1.25;renderAll(false)};
  ui.fit.onclick=()=>fitPts(app.base.flatMap(r=>r.type==='point'?[r.correctedLocal||r.local]:(r.vertices||[]).map(v=>v.correctedLocal||v.local)));
  ui.fitSel.onclick=fitSelected;
  setupToolButtons();
  document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>{app.settings.viewMode=b.dataset.view;buildViews();renderAll();renderDateChooser()});
  ['Trail','Controls','Objects','Routes','Areas'].forEach(n=>{$('layer'+n).onchange=e=>{app.layers[n.toLowerCase()]=e.target.checked;renderAll(false)}});
  ui.hub.onclick=e=>{if(e.detail!==0)toggleArc()};
  ui.leveler.onclick=e=>{if(e.detail!==0)toggleToolArc()};
  ui.arcBase.onclick=()=>setPanel('base');
  ui.arcWeekly.onclick=()=>setPanel('weekly');
  ui.arcSettings.onclick=()=>setPanel('settings');
  ui.panelClose.onclick=()=>ui.panel.classList.remove('open');
  document.querySelectorAll('[data-panel]').forEach(b=>b.onclick=()=>setPanel(b.dataset.panel));
  ui.canvas.addEventListener('pointerdown',canvasDown);
  ui.canvas.addEventListener('pointermove',canvasMove);
  ui.canvas.addEventListener('pointerup',canvasUp);
  ui.canvas.addEventListener('dblclick',e=>{e.preventDefault();e.stopPropagation()});
  ui.canvas.addEventListener('contextmenu',e=>{e.preventDefault();openUiContextMenu(e)});
  document.addEventListener('click',e=>{
    if(e.target===ui.canvas){closePops();if(ui.dialog.open)ui.dialog.close()}
    if(!e.target.closest('#cmdMenu'))ui.cmdMenu.classList.remove('open');
  });
  window.addEventListener('deviceorientation',e=>{app.orientation={alpha:e.alpha,beta:e.beta||0,gamma:e.gamma||0,source:'deviceorientation'}});
  window.addEventListener('pagehide',saveSettings);
  renderDateChooser();
  updateCommandHud();
}

function toggleArc(){app.arcOpen=!app.arcOpen;document.querySelectorAll('.arcIcon').forEach(b=>b.classList.toggle('open',app.arcOpen))}
function toggleToolArc(){app.toolArcOpen=!app.toolArcOpen;document.querySelectorAll('.toolArcIcon').forEach(b=>b.classList.toggle('open',app.toolArcOpen))}

function canvasDown(e){
  ui.canvas.setPointerCapture(e.pointerId);
  app.pointer={x:e.clientX,y:e.clientY,lastX:e.clientX,lastY:e.clientY,drag:false};
}

function canvasMove(e){
  const p=app.pointer;if(!p)return;
  const dx=e.clientX-p.lastX,dy=e.clientY-p.lastY;
  if(Math.hypot(e.clientX-p.x,e.clientY-p.y)>6)p.drag=true;
  if(p.drag&&app.selectMode==='box'){app.selectBox={x1:p.x,y1:p.y,x2:e.clientX,y2:e.clientY};renderAll(false)}
  else if(p.drag&&!app.selectMode){app.follow=false;ui.followBtn.classList.remove('active');app.camera.x-=dx/app.camera.z;app.camera.y+=dy/app.camera.z;renderAll(false)}
  p.lastX=e.clientX;p.lastY=e.clientY;
}

function canvasUp(e){
  const p=app.pointer;if(!p)return;
  const r=ui.canvas.getBoundingClientRect(),l=screenToLocal(e.clientX-r.left,e.clientY-r.top);
  if(app.selectMode==='box'&&p.drag){selectByWindow(p.x-r.left,p.y-r.top,e.clientX-r.left,e.clientY-r.top);app.pointer=null;app.selectBox=null;renderAll(false);return}
  if(!p.drag){
    const now=Date.now(),last=app.lastPrimaryClick,isDouble=!!last&&now-last.at<300&&Math.hypot(e.clientX-last.x,e.clientY-last.y)<6;
    handleCommandResult(commandPrimaryClick(l,{detail:isDouble?2:(e.detail||0)}));
    app.lastPrimaryClick={at:now,x:e.clientX,y:e.clientY};
  }
  app.pointer=null;app.selectBox=null;renderAll(false);
}

function selectNearest(l){
  const best=nearestRecord(l,30/app.camera.z);
  if(best){app.selected.clear();app.selected.add(best.id);toast(`Selected ${best.name||best.code||best.type}`)}
  else toast('No element near cursor');
  updateCommandHud();
  renderAll(false);
}

function selectByWindow(x1,y1,x2,y2){
  const minx=Math.min(x1,x2),maxx=Math.max(x1,x2),miny=Math.min(y1,y2),maxy=Math.max(y1,y2);
  app.selected.clear();
  for(const r of app.base){
    const pts=r.type==='point'?[r.correctedLocal||r.local]:(r.vertices||[]).map(v=>v.correctedLocal||v.local);
    if(pts.some(p=>{const s=localToScreen(p.x,p.y);return s.x>=minx&&s.x<=maxx&&s.y>=miny&&s.y<=maxy}))app.selected.add(r.id);
  }
  toast(`${app.selected.size} selected`);
  updateCommandHud();
  renderAll(false);
}

function fitSelected(){
  const pts=[...app.selected].map(id=>app.base.find(r=>r.id===id)).filter(Boolean).flatMap(r=>r.type==='point'?[r.correctedLocal||r.local]:(r.vertices||[]).map(v=>v.correctedLocal||v.local));
  fitPts(pts.length?pts:[app.avatarView.correctedLocal]);
}

function fitPts(pts){
  pts=(pts||[]).filter(Boolean);
  if(!pts.length)return;
  const xs=pts.map(p=>p.x),ys=pts.map(p=>p.y),r=ui.canvas.getBoundingClientRect();
  const minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys);
  app.camera.x=(minX+maxX)/2;app.camera.y=(minY+maxY)/2;
  app.camera.z=Math.max(.002,Math.min(20,Math.min((r.width-100)/Math.max(1,maxX-minX),(r.height-160)/Math.max(1,maxY-minY))));
  renderAll(false);
}

function download(txt,name,type){
  const a=document.createElement('a'),u=URL.createObjectURL(new Blob([txt],{type}));
  a.href=u;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(u),1000);
}

export { clampPopover, closePops, setPanel, renderBasePanel, dbSection, tableFor, renderWeeklyPanel, weeklyTable, weeklyCard, renderSettingsPanel, renderCompassPanel, getContextActions, commandStatusSummary, updateCommandHud, showRadiusRequest, handleCommandResult, openUiContextMenu, showSelectedDateStep, pulse, toast, monthName, renderDateChooser, setup, toggleArc, toggleToolArc, canvasDown, canvasMove, canvasUp, selectNearest, selectByWindow, fitSelected, fitPts, download };
Object.assign(globalThis.PSJModules.ui = {}, { clampPopover, closePops, setPanel, renderBasePanel, dbSection, tableFor, renderWeeklyPanel, weeklyTable, weeklyCard, renderSettingsPanel, renderCompassPanel, getContextActions, commandStatusSummary, updateCommandHud, showRadiusRequest, handleCommandResult, openUiContextMenu, showSelectedDateStep, pulse, toast, monthName, renderDateChooser, setup, toggleArc, toggleToolArc, canvasDown, canvasMove, canvasUp, selectNearest, selectByWindow, fitSelected, fitPts, download });
for (const [name, value] of Object.entries(globalThis.PSJModules.ui)) expose(name, value);
