globalThis.PSJModules = globalThis.PSJModules || {};
const expose = (name, value) => {
  globalThis[name] = value;
  globalThis.PSJModules = globalThis.PSJModules || {};
  return value;
};
function sourceLocal(source,clickedLocal=null){
  return sourcePosition(source,clickedLocal).correctedLocal;
}
function sourcePosition(source,clickedLocal=null){
  if(source==='add'){
    const corrected={...(app.avatarView.correctedLocal||{x:0,y:0,z:0})},raw={...(app.avatarView.rawLocal||corrected)};
    return{rawLocal:raw,correctedLocal:corrected,rawWgs:app.avatarView.rawWgs||localToWgs(raw.x,raw.y,raw.z),correctedWgs:app.avatarView.correctedWgs||localToWgs(corrected.x,corrected.y,corrected.z),solverVersion:app.avatarView.solverVersion||app.avatarView.solver||'avatar',controlSnapshotId:app.avatarView.controlSnapshotId||null,controlSnapshot:app.avatarView.controlSnapshot||null};
  }
  if(clickedLocal?.correctedLocal&&clickedLocal?.rawLocal)return clickedLocal;
  const l={...(clickedLocal||{x:0,y:0,z:0})};
  if(!Number.isFinite(Number(l.z)))l.z=estimateGroundZForLocal(l);
  if(typeof correctedLocalFor==='function')return correctedLocalFor(l);
  return{rawLocal:{...l},correctedLocal:{...l},solverVersion:'manual',controlSnapshotId:null,controlSnapshot:null};
}
function normalizeCommandType(type){return type==='line'?'route':type}
function transition(type,command=app.command,extra={}){
  return {type,command:{...command},...extra};
}
function currentCommand(){
  const c=app.command||{};
  if(c.status)return c;
  const mode=app.mode||'';
  const [source,type]=mode.split('-');
  if((source==='add'||source==='design')&&type)return {status:'ready',source,type:normalizeCommandType(type),phase:'awaiting-first-point'};
  return {status:'idle',source:null,type:null,phase:'idle'};
}
function beginCommand(source,type){
  type=normalizeCommandType(type);
  app.command={status:'ready',kind:source,type,source,phase:type==='point'?'awaiting-first-point':type==='circle'?'awaiting-first-point':'awaiting-first-point',circle:null};
  app.mode=source+'-'+type;
  return transition('command-ready');
}
function beginSelectCommand(mode){
  app.selectMode=mode;
  app.mode=null;
  app.command={status:'select',kind:'select',type:mode,source:'select',phase:'awaiting-first-point',circle:null};
  return transition('select-ready');
}
function savePointWithSmartIcon(source,local,preset){
  const pos=sourcePosition(source,local), corrected=pos.correctedLocal, raw=pos.rawLocal||corrected, w=localToWgs(corrected.x,corrected.y,corrected.z), rawWgs=localToWgs(raw.x,raw.y,raw.z), dt=new Date().toISOString();
  const rec={id:id('REC'),code:makeCode('point',dt),type:'point',source,geometryStatus:app.avatarView.confidence>.45?'corrected':'provisional',name:preset.name,icon:preset.icon,iconScale:1,comment:'',address:'',local:raw,rawLocal:raw,correctedLocal:corrected,wgs:rawWgs,rawWgs,correctedWgs:w,timestamp:dt,solverVersion:pos.solverVersion||pos.solver||'manual',controlSnapshotId:pos.controlSnapshotId||null,controlSnapshot:pos.controlSnapshot||null,time:{eventAt:dt,capturedAt:new Date().toISOString()},createdAt:new Date().toISOString()};
  app.base.push(rec); put('base',rec); buildViews(); renderAll();
  if(navigator.onLine) reverse(w.lat,w.lng).then(a=>{ if(a){rec.address=a; put('base',rec); buildViews(); renderAll();}}).catch(()=>{});
}
function openPointDialog(source,local){
  const pos=sourcePosition(source,local); local=pos.correctedLocal; const w=localToWgs(local.x,local.y,local.z);
  ui.recordTitle.textContent=(source==='add'?'Add point at avatar':'Design point')+'  -  choose smart icon';
  ui.recordBody.innerHTML=`<p class="small muted">X ${local.x.toFixed(3)}  -  Y ${local.y.toFixed(3)}  -  Z ${local.z.toFixed(3)}  -  WGS ${w.lat.toFixed(6)}, ${w.lng.toFixed(6)}</p><div class="smartIconGrid">${app.smartIcons.map((p,i)=>`<button class="smartIconBtn" data-smart="${i}"><span class="ico">${esc(p.icon)}</span><span class="nm">${esc(p.name)}</span></button>`).join('')}</div>`;
  ui.recordCancel.onclick=()=>ui.dialog.close(); ui.recordSave.style.display='none';
  ui.recordBody.querySelectorAll('[data-smart]').forEach(b=>b.onclick=()=>{const preset=app.smartIcons[Number(b.dataset.smart)]||app.smartIcons[0];savePointWithSmartIcon(source,pos,preset);ui.dialog.close();ui.recordSave.style.display='';});
  ui.dialog.showModal();
}
function openProperties(rec){
  if(!rec)return; const l=rec.correctedLocal||rec.local||rec.vertices?.[0]?.correctedLocal||{x:0,y:0,z:0};
  ui.recordTitle.textContent=`Properties  -  ${rec.code||rec.id}`;
  ui.recordBody.innerHTML=`<div class="grid2"><label>Name<input id="propName" value="${esc(rec.name||rec.routeId||rec.areaId||'')}"></label><label>Time<input id="propAt" type="datetime-local" value="${isoLocal(rec.time?.eventAt||rec.createdAt)}"></label></div><label>Comment<textarea id="propComment" rows="3">${esc(rec.comment||'')}</textarea></label><div class="grid3"><label>X<input readonly value="${Number(l.x||0).toFixed(3)}"></label><label>Y<input readonly value="${Number(l.y||0).toFixed(3)}"></label><label>Z<input readonly value="${Number(l.z||0).toFixed(3)}"></label></div><p class="small muted">Geometry status: ${esc(rec.geometryStatus||'')}</p>`;
  ui.recordCancel.onclick=()=>ui.dialog.close(); ui.recordSave.style.display='';
  ui.recordSave.onclick=()=>{rec.name=$('propName').value;if(rec.type==='route')rec.routeId=rec.name;if(rec.type==='area')rec.areaId=rec.name;rec.comment=$('propComment').value;rec.time=rec.time||{};rec.time.eventAt=safeDate($('propAt').value).toISOString();put('base',rec);buildViews();ui.dialog.close();renderAll();};
  ui.dialog.showModal();
}
function makeSegment(segmentId,resumeFrom=null){return{id:segmentId,vertices:[],resumeFrom}}
function pushSegmentVertex(active,vertex){
  let seg=active.segments?.find(s=>s.id===vertex.segment);
  if(!seg){seg=makeSegment(vertex.segment);active.segments=active.segments||[];active.segments.push(seg)}
  seg.vertices.push(vertex);
  return seg;
}
function lastValidVertex(active=app.active){return active?.vertices?.at(-1)||null}
function startElement(type,source,local=null){
  type=normalizeCommandType(type);
  if(type==='point'){beginCommand(source,type); toast(`${source.toUpperCase()} point: ${source==='add'?'click = avatar sample':'click canvas = design position'}`); return;}
  if(type==='circle'){beginCommand(source,type);openCircleMethod(source);return;}
  const startLocal=source==='add'?sourceLocal('add'):local;
  if(!startLocal){beginCommand(source,type); toast(`${source.toUpperCase()} ${type}: click to start`); return;}
  const pos=source==='add'?null:sourcePosition(source,startLocal);
  const v=source==='add'?vertexFromAvatar():vertexFromLocal(pos.rawLocal,source,pos);
  v.segment=1;
  app.active={id:id(type.toUpperCase()),type,source,vertices:[v],segments:[makeSegment(1)],eventAt:new Date().toISOString(),paused:false,segment:1};pushSegmentVertex(app.active,v); beginCommand(source,type);app.command.status='active';app.command.phase='drawing';app.command.activeId=app.active.id;app.command.segment=1;
  toast(`${type.toUpperCase()} started  -  left click adds vertex  -  right click opens commands`);
  return transition('geometry-started',app.command,{vertex:v});
}
function addVertex(local=null){if(!app.active)return transition('no-active-command');if(app.active.paused)return transition('ignored-paused',app.command);const pos=app.active.source==='add'?null:sourcePosition('design',local);const v=app.active.source==='add'?vertexFromAvatar():vertexFromLocal(pos.rawLocal,'design',pos);v.segment=app.active.segment||1;app.active.vertices.push(v);const segment=pushSegmentVertex(app.active,v);app.command.status='active';app.command.phase='drawing';app.command.segment=v.segment;renderAll(false);return transition('vertex-added',app.command,{vertex:v,segment})}
function finishActive(local=null){if(!app.active)return transition('no-active-command');const a=app.active;if(a.vertices.length<2&&a.type==='route'){toast('Line needs at least 2 points');return transition('invalid-end',app.command,{reason:'route-min-vertices'})}if(a.vertices.length<3&&a.type==='area'){toast('Area needs at least 3 points');return transition('invalid-end',app.command,{reason:'area-min-vertices'})}const type=a.type,dt=a.eventAt;const rec={id:id('REC'),code:makeCode(type,dt),type,source:a.source,geometryStatus:app.avatarView.confidence>.45?'corrected':'provisional',[type==='route'?'routeId':'areaId']:a.id,vertices:a.vertices,segments:a.segments,time:{eventAt:dt,capturedAt:new Date().toISOString()},createdAt:new Date().toISOString(),metrics:type==='route'?metricsRoute(a.vertices):{areaM2:areaM2(a.vertices),vertexCount:a.vertices.length}};app.base.push(rec);put('base',rec);app.active=null;app.command={status:'completed',kind:null,type,source:a.source,phase:'completed',circle:null,recordId:rec.id};app.mode=null;buildViews();renderAll();toast(`${type} saved`);return transition('geometry-ended',app.command,{record:rec})}
function pauseActive(){if(!app.active)return transition('no-active-command');const from=lastValidVertex(app.active);app.active.paused=true;app.active.segment=(app.active.segment||1)+1;app.active.segments=app.active.segments||[];app.active.segments.push(makeSegment(app.active.segment,from));app.command.status='paused';app.command.phase='paused';app.command.segment=app.active.segment;toast('Segment paused  -  paused gap will not count');return transition('geometry-paused',app.command,{resumeFrom:from,segment:app.active.segment})}
function resumeActive(){if(!app.active)return transition('no-active-command');app.active.paused=false;app.command.status='active';app.command.phase='drawing';app.command.segment=app.active.segment;toast('Segment resumed');return transition('geometry-resumed',app.command,{resumeFrom:lastValidVertex(app.active),segment:app.active.segment})}
function cancelActive(){const prev=app.command;app.active=null;app.mode=null;app.command={status:'cancelled',kind:prev?.kind||null,type:prev?.type||null,source:prev?.source||null,phase:'cancelled',circle:null};renderAll();toast('Command cancelled');return transition('command-cancelled')}
function commandMenu(x,y,items){ui.cmdMenu.innerHTML=items.map(it=>`<button data-cmd="${esc(it.id)}">${esc(it.label)}</button>`).join('');ui.cmdMenu.classList.add('open');ui.cmdMenu.style.left=Math.min(x,window.innerWidth-210)+'px';ui.cmdMenu.style.top=Math.min(y,window.innerHeight-220)+'px';ui.cmdMenu.querySelectorAll('[data-cmd]').forEach(b=>b.onclick=()=>{const it=items.find(i=>i.id===b.dataset.cmd);ui.cmdMenu.classList.remove('open');it&&it.fn&&it.fn();});}
function nearestRecord(l,maxDist=20){let best=null,bd=1e99;for(const r of app.base){let pts=[];if(r.type==='point')pts=[r.correctedLocal||r.local];else if(r.vertices)pts=r.vertices.map(v=>v.correctedLocal||v.local);else if(r.centerLocal)pts=[r.centerLocal];for(const p of pts){if(!p)continue;const d=distanceLocal(l,p);if(d<bd){bd=d;best=r}}}return bd<=maxDist?best:null;}
function activeContextActions(local){if(!app.active)return[];const items=[];if(app.active.paused)items.push({id:'resume',label:'Resume',fn:resumeActive});else items.push({id:'pause',label:'Pause',fn:pauseActive});items.push({id:'end',label:app.active.type==='area'?'Close area':'End line',fn:()=>finishActive(local)});items.push({id:'cancel',label:'Cancel command',fn:cancelActive});return items}
function selectionContextActions(local){const items=[];const near=nearestRecord(local,35/app.camera.z);if(near){app.selected.clear();app.selected.add(near.id);items.push({id:'prop',label:'Properties',fn:()=>openProperties(near)});}if(app.selected.size)items.push({id:'clear',label:'Clear selection',fn:()=>{app.selected.clear();renderAll()}});return items}
function openCanvasContext(e){const r=ui.canvas.getBoundingClientRect(),l=screenToLocal(e.clientX-r.left,e.clientY-r.top),items=app.active?activeContextActions(l):selectionContextActions(l);if(items.length)commandMenu(e.clientX,e.clientY,items);}
function beginCircleCommand(source,method){beginCommand(source,'circle');app.command.status='active';app.command.phase='awaiting-first-point';app.command.circle={source,method,points:[],radiusDraft:null};app.mode=source+'-circle';return app.command.circle}
function openCircleMethod(source){ui.recordTitle.textContent=`${source==='add'?'Add':'Design'} circle  -  method`;ui.recordBody.innerHTML=`<div class="grid2"><button data-cm="center">Center + radius</button><button data-cm="three">3 points</button><button data-cm="twoRadius">2 points + radius</button></div><p class="small muted">Left click gives points. Right click cancels. Double click is ignored.</p>`;ui.recordCancel.onclick=()=>ui.dialog.close();ui.recordSave.style.display='none';ui.recordBody.querySelectorAll('[data-cm]').forEach(b=>b.onclick=()=>{beginCircleCommand(source,b.dataset.cm);ui.dialog.close();ui.recordSave.style.display='';toast(`Circle ${b.dataset.cm}: ${source==='add'?'click = avatar sample':'click canvas'}`);});ui.dialog.showModal();}
function openRadiusPicker(center,source,extraPoints=[]){ui.recordTitle.textContent='Circle radius';ui.recordBody.innerHTML=`<div class="radiusGrid">${app.radiusPresets.map(r=>`<button class="radiusBtn" data-r="${r}">${r} m</button>`).join('')}</div><div class="kbdLine"><input id="customRadius" type="number" step="any" placeholder="custom radius m"><button id="customRadiusBtn">Apply</button></div>`;const save=(rad)=>{if(!(rad>0))return;saveCircle(source,center,rad,extraPoints);ui.dialog.close();};ui.recordBody.querySelectorAll('[data-r]').forEach(b=>b.onclick=()=>save(Number(b.dataset.r)));$('customRadiusBtn').onclick=()=>save(Number($('customRadius').value));ui.recordCancel.onclick=()=>ui.dialog.close();ui.recordSave.style.display='none';ui.dialog.showModal();}
function saveCircle(source,center,radius,extraPoints=[]){const dt=new Date().toISOString();const vertices=Array.from({length:48},(_,i)=>{const a=i/48*Math.PI*2,l={x:center.x+Math.cos(a)*radius,y:center.y+Math.sin(a)*radius,z:center.z};return vertexFromLocal(l,source)});const rec={id:id('REC'),code:makeCode('circle',dt),type:'circle',source,geometryStatus:app.avatarView.confidence>.45?'corrected':'provisional',name:`Circle ${radius}m`,centerLocal:center,radiusM:radius,inputPoints:extraPoints,vertices,time:{eventAt:dt,capturedAt:new Date().toISOString()},createdAt:new Date().toISOString(),metrics:{radiusM:radius,areaM2:Math.PI*radius*radius,circumferenceM:2*Math.PI*radius}};app.base.push(rec);put('base',rec);app.command={status:'completed',kind:null,type:'circle',source,phase:'completed',circle:null,recordId:rec.id};app.mode=null;buildViews();renderAll();toast('Circle saved');return rec}
function requestCircleRadius(center,source,extraPoints=[]){app.command.phase='drawing';app.command.circle.radiusDraft={center,source,extraPoints};return transition('radius-requested',app.command,{request:{kind:'radius',center,source,extraPoints}})}
function applyCircleRadius(radius){const draft=app.command?.circle?.radiusDraft;if(!draft||!(radius>0))return transition('invalid-radius',currentCommand());const rec=saveCircle(draft.source,draft.center,radius,draft.extraPoints);return transition('circle-ended',app.command,{record:rec})}
function handleCircleClick(local){const c=app.command.circle;if(!c)return transition('no-circle-command');const pos=c.source==='add'?sourcePosition('add'):sourcePosition('design',local),l=pos.correctedLocal;c.points.push(vertexFromLocal(pos.rawLocal||l,c.source,pos));app.command.phase='drawing';if(c.method==='center')return requestCircleRadius(l,c.source,c.points);if(c.method==='three'&&c.points.length>=3){const cc=circleFrom3(c.points[0],c.points[1],c.points[2]);if(!cc){toast('Circle failed: points nearly collinear');return transition('invalid-circle',app.command,{reason:'collinear'})}saveCircle(c.source,{x:cc.x,y:cc.y,z:cc.z},cc.r,c.points);return transition('circle-ended',app.command,{circle:cc})}if(c.method==='twoRadius'&&c.points.length>=2){const p0=pointOf(c.points[0]),p1=pointOf(c.points[1]),mid={x:(p0.x+p1.x)/2,y:(p0.y+p1.y)/2,z:(p0.z+p1.z)/2};return requestCircleRadius(mid,c.source,c.points)}toast(`Circle: ${c.points.length} point(s) captured`);return transition('circle-point-added',app.command,{point:l})}
function commandPrimaryClick(local,opts={}){
  if(opts.detail>1)return transition('ignored-double-click',currentCommand());
  const cmd=currentCommand();
  if(cmd.source==='design'&&cmd.type==='point'){const resolved=sourcePosition('design',local);openPointDialog('design',resolved);app.command={status:'idle',kind:null,type:null,source:null,phase:'idle',circle:null};app.mode=null;return transition('point-coordinate-resolved',app.command,{source:'design',local:resolved.correctedLocal,popup:'smart-icon'})}
  if(cmd.source==='add'&&cmd.type==='point'){const resolved=sourcePosition('add');openPointDialog('add',resolved);app.command={status:'idle',kind:null,type:null,source:null,phase:'idle',circle:null};app.mode=null;return transition('point-coordinate-resolved',app.command,{source:'add',local:resolved.correctedLocal,popup:'smart-icon'})}
  if(cmd.source==='design'&&(cmd.type==='route'||cmd.type==='area')){if(!app.active)return startElement(cmd.type,'design',local);return addVertex(local)}
  if(cmd.source==='add'&&(cmd.type==='route'||cmd.type==='area')){if(!app.active)return startElement(cmd.type,'add');return addVertex()}
  if(cmd.source&&(cmd.type==='circle'))return handleCircleClick(local);
  if(app.selectMode==='one'){selectNearest(local);return transition('select-one',cmd,{local})}
  if(app.active&&app.active.source==='design')return addVertex(sourceLocal('design',local))
  return transition('noop',cmd)
}
function setTool(kind,type){type=normalizeCommandType(type);closePops();ui.recordSave.style.display='';pulse(ui.leveler);app.active=null;const ready=beginCommand(kind,type);if(type==='circle'){openCircleMethod(kind);return ready}toast(`${kind.toUpperCase()}  -  ${type}  -  ${kind==='add'?'click canvas = avatar sample':'click canvas = design point'}`);return ready}

export { sourceLocal, sourcePosition, normalizeCommandType, transition, currentCommand, beginCommand, beginSelectCommand, savePointWithSmartIcon, openPointDialog, openProperties, startElement, addVertex, finishActive, pauseActive, resumeActive, cancelActive, commandMenu, nearestRecord, activeContextActions, selectionContextActions, openCanvasContext, beginCircleCommand, openCircleMethod, openRadiusPicker, requestCircleRadius, applyCircleRadius, saveCircle, handleCircleClick, commandPrimaryClick, setTool };
Object.assign(globalThis.PSJModules.commands = {}, { sourceLocal, sourcePosition, normalizeCommandType, transition, currentCommand, beginCommand, beginSelectCommand, savePointWithSmartIcon, openPointDialog, openProperties, startElement, addVertex, finishActive, pauseActive, resumeActive, cancelActive, commandMenu, nearestRecord, activeContextActions, selectionContextActions, openCanvasContext, beginCircleCommand, openCircleMethod, openRadiusPicker, applyCircleRadius, requestCircleRadius, saveCircle, handleCircleClick, commandPrimaryClick, setTool });
for (const [name, value] of Object.entries(globalThis.PSJModules.commands)) expose(name, value);

