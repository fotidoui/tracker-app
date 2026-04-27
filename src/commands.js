globalThis.PSJModules = globalThis.PSJModules || {};
const expose = (name, value) => {
  globalThis[name] = value;
  globalThis.PSJModules = globalThis.PSJModules || {};
  return value;
};
function sourceLocal(source,clickedLocal=null){
  if(source==='add') return {...(app.avatarView.correctedLocal||{x:0,y:0,z:0})};
  const l={...(clickedLocal||{x:0,y:0,z:0})};
  if(!Number.isFinite(Number(l.z)))l.z=estimateGroundZForLocal(l);
  return l;
}
function normalizeCommandType(type){return type==='line'?'route':type}
function beginCommand(source,type){
  type=normalizeCommandType(type);
  app.command={...(app.command||{}),kind:source,type,source};
  app.mode=source+'-'+type;
  if(type!=='circle')app.command.circle=null;
  return app.command;
}
function savePointWithSmartIcon(source,local,preset){
  local=sourceLocal(source,local); const w=localToWgs(local.x,local.y,local.z), dt=new Date().toISOString();
  const rec={id:id('REC'),code:makeCode('point',dt),type:'point',source,geometryStatus:app.avatarView.confidence>.45?'corrected':'provisional',name:preset.name,icon:preset.icon,iconScale:1,comment:'',address:'',local,correctedLocal:local,wgs:w,correctedWgs:w,time:{eventAt:dt,capturedAt:new Date().toISOString()},createdAt:new Date().toISOString()};
  app.base.push(rec); put('base',rec); buildViews(); renderAll();
  if(navigator.onLine) reverse(w.lat,w.lng).then(a=>{ if(a){rec.address=a; put('base',rec); buildViews(); renderAll();}}).catch(()=>{});
}
function openPointDialog(source,local){
  local=sourceLocal(source,local); const w=localToWgs(local.x,local.y,local.z);
  ui.recordTitle.textContent=(source==='add'?'Add point at avatar':'Design point')+' Â· choose smart icon';
  ui.recordBody.innerHTML=`<p class="small muted">X ${local.x.toFixed(3)} Â· Y ${local.y.toFixed(3)} Â· Z ${local.z.toFixed(3)} Â· WGS ${w.lat.toFixed(6)}, ${w.lng.toFixed(6)}</p><div class="smartIconGrid">${app.smartIcons.map((p,i)=>`<button class="smartIconBtn" data-smart="${i}"><span class="ico">${esc(p.icon)}</span><span class="nm">${esc(p.name)}</span></button>`).join('')}</div>`;
  ui.recordCancel.onclick=()=>ui.dialog.close(); ui.recordSave.style.display='none';
  ui.recordBody.querySelectorAll('[data-smart]').forEach(b=>b.onclick=()=>{const preset=app.smartIcons[Number(b.dataset.smart)]||app.smartIcons[0];savePointWithSmartIcon(source,local,preset);ui.dialog.close();ui.recordSave.style.display='';});
  ui.dialog.showModal();
}
function openProperties(rec){
  if(!rec)return; const l=rec.correctedLocal||rec.local||rec.vertices?.[0]?.correctedLocal||{x:0,y:0,z:0};
  ui.recordTitle.textContent=`Properties Â· ${rec.code||rec.id}`;
  ui.recordBody.innerHTML=`<div class="grid2"><label>Name<input id="propName" value="${esc(rec.name||rec.routeId||rec.areaId||'')}"></label><label>Time<input id="propAt" type="datetime-local" value="${isoLocal(rec.time?.eventAt||rec.createdAt)}"></label></div><label>Comment<textarea id="propComment" rows="3">${esc(rec.comment||'')}</textarea></label><div class="grid3"><label>X<input readonly value="${Number(l.x||0).toFixed(3)}"></label><label>Y<input readonly value="${Number(l.y||0).toFixed(3)}"></label><label>Z<input readonly value="${Number(l.z||0).toFixed(3)}"></label></div><p class="small muted">Geometry status: ${esc(rec.geometryStatus||'')}</p>`;
  ui.recordCancel.onclick=()=>ui.dialog.close(); ui.recordSave.style.display='';
  ui.recordSave.onclick=()=>{rec.name=$('propName').value;if(rec.type==='route')rec.routeId=rec.name;if(rec.type==='area')rec.areaId=rec.name;rec.comment=$('propComment').value;rec.time=rec.time||{};rec.time.eventAt=safeDate($('propAt').value).toISOString();put('base',rec);buildViews();ui.dialog.close();renderAll();};
  ui.dialog.showModal();
}
function startElement(type,source,local=null){
  type=normalizeCommandType(type);
  if(type==='point'){beginCommand(source,type); toast(`${source.toUpperCase()} point: ${source==='add'?'click = avatar sample':'click canvas = design position'}`); return;}
  if(type==='circle'){beginCommand(source,type);openCircleMethod(source);return;}
  const startLocal=source==='add'?sourceLocal('add'):local;
  if(!startLocal){beginCommand(source,type); toast(`${source.toUpperCase()} ${type}: click to start`); return;}
  const v=source==='add'?vertexFromAvatar():vertexFromLocal(startLocal,source);
  v.segment=1;
  app.active={id:id(type.toUpperCase()),type,source,vertices:[v],eventAt:new Date().toISOString(),paused:false,segment:1}; beginCommand(source,type);
  toast(`${type.toUpperCase()} started Â· left click adds vertex Â· right click opens commands`);
}
function addVertex(local=null){if(!app.active||app.active.paused)return;const v=app.active.source==='add'?vertexFromAvatar():vertexFromLocal(local,'design');v.segment=app.active.segment||1;app.active.vertices.push(v);renderAll(false);return v}
function finishActive(local=null){if(!app.active)return;const a=app.active;if(a.vertices.length<2&&a.type==='route'){toast('Line needs at least 2 points');return}if(a.vertices.length<3&&a.type==='area'){toast('Area needs at least 3 points');return}const type=a.type,dt=a.eventAt;const rec={id:id('REC'),code:makeCode(type,dt),type,source:a.source,geometryStatus:app.avatarView.confidence>.45?'corrected':'provisional',[type==='route'?'routeId':'areaId']:a.id,vertices:a.vertices,time:{eventAt:dt,capturedAt:new Date().toISOString()},createdAt:new Date().toISOString(),metrics:type==='route'?metricsRoute(a.vertices):{areaM2:areaM2(a.vertices),vertexCount:a.vertices.length}};app.base.push(rec);put('base',rec);app.active=null;buildViews();renderAll();toast(`${type} saved`)}
function pauseActive(){if(!app.active)return;app.active.paused=true;toast('Segment paused Â· paused gap will not count')}
function resumeActive(){if(!app.active)return;app.active.paused=false;app.active.segment=(app.active.segment||1)+1;toast('Segment resumed')}
function cancelActive(){app.active=null;app.mode=null;app.command.circle=null;renderAll();toast('Command cancelled')}
function commandMenu(x,y,items){ui.cmdMenu.innerHTML=items.map(it=>`<button data-cmd="${esc(it.id)}">${esc(it.label)}</button>`).join("");ui.cmdMenu.classList.add("open");requestAnimationFrame(()=>{const pr=ui.cmdMenu.getBoundingClientRect();const pad=10;let left=Math.max(pad,Math.min(x,window.innerWidth-pr.width-pad));let top=Math.max(pad,Math.min(y,window.innerHeight-pr.height-pad));ui.cmdMenu.style.left=left+"px";ui.cmdMenu.style.top=top+"px";});ui.cmdMenu.querySelectorAll("[data-cmd]").forEach(b=>b.onclick=(ev)=>{ev.preventDefault();ev.stopPropagation();const it=items.find(i=>i.id===b.dataset.cmd);ui.cmdMenu.classList.remove("open");it&&it.fn&&it.fn();});}
function nearestRecord(l,maxDist=20){let best=null,bd=1e99;for(const r of app.base){let pts=[];if(r.type==='point')pts=[r.correctedLocal||r.local];else if(r.vertices)pts=r.vertices.map(v=>v.correctedLocal||v.local);else if(r.centerLocal)pts=[r.centerLocal];for(const p of pts){if(!p)continue;const d=distanceLocal(l,p);if(d<bd){bd=d;best=r}}}return bd<=maxDist?best:null;}
function activeContextActions(local){if(!app.active)return[];const items=[];if(app.active.paused)items.push({id:'resume',label:'Resume',fn:resumeActive});else items.push({id:'pause',label:'Pause',fn:pauseActive});items.push({id:'end',label:app.active.type==='area'?'Close area':'End line',fn:()=>finishActive(local)});items.push({id:'cancel',label:'Cancel command',fn:cancelActive});return items}
function selectionContextActions(local){const items=[];const near=nearestRecord(local,35/app.camera.z);if(near){app.selected.clear();app.selected.add(near.id);items.push({id:'prop',label:'Properties',fn:()=>openProperties(near)});}if(app.selected.size)items.push({id:'clear',label:'Clear selection',fn:()=>{app.selected.clear();renderAll()}});return items}
function openCanvasContext(e){const r=ui.canvas.getBoundingClientRect(),l=screenToLocal(e.clientX-r.left,e.clientY-r.top),items=app.active?activeContextActions(l):selectionContextActions(l);if(items.length)commandMenu(e.clientX,e.clientY,items);}
function beginCircleCommand(source,method){beginCommand(source,'circle');app.command.circle={source,method,points:[],radiusDraft:null};app.mode=source+'-circle';return app.command.circle}
function openCircleMethod(source){ui.recordTitle.textContent=`${source==='add'?'Add':'Design'} circle Â· method`;ui.recordBody.innerHTML=`<div class="grid2"><button data-cm="center">Center + radius</button><button data-cm="three">3 points</button><button data-cm="twoRadius">2 points + radius</button></div><p class="small muted">Left click gives points. Right click cancels. Double click is ignored.</p>`;ui.recordCancel.onclick=()=>ui.dialog.close();ui.recordSave.style.display='none';ui.recordBody.querySelectorAll('[data-cm]').forEach(b=>b.onclick=()=>{beginCircleCommand(source,b.dataset.cm);ui.dialog.close();ui.recordSave.style.display='';toast(`Circle ${b.dataset.cm}: ${source==='add'?'click = avatar sample':'click canvas'}`);});ui.dialog.showModal();}
function openRadiusPicker(center,source,extraPoints=[]){ui.recordTitle.textContent='Circle radius';ui.recordBody.innerHTML=`<div class="radiusGrid">${app.radiusPresets.map(r=>`<button class="radiusBtn" data-r="${r}">${r} m</button>`).join('')}</div><div class="kbdLine"><input id="customRadius" type="number" step="any" placeholder="custom radius m"><button id="customRadiusBtn">Apply</button></div>`;const save=(rad)=>{if(!(rad>0))return;saveCircle(source,center,rad,extraPoints);ui.dialog.close();};ui.recordBody.querySelectorAll('[data-r]').forEach(b=>b.onclick=()=>save(Number(b.dataset.r)));$('customRadiusBtn').onclick=()=>save(Number($('customRadius').value));ui.recordCancel.onclick=()=>ui.dialog.close();ui.recordSave.style.display='none';ui.dialog.showModal();}
function saveCircle(source,center,radius,extraPoints=[]){const dt=new Date().toISOString();const vertices=Array.from({length:48},(_,i)=>{const a=i/48*Math.PI*2,l={x:center.x+Math.cos(a)*radius,y:center.y+Math.sin(a)*radius,z:center.z};return vertexFromLocal(l,source)});const rec={id:id('REC'),code:makeCode('circle',dt),type:'circle',source,geometryStatus:app.avatarView.confidence>.45?'corrected':'provisional',name:`Circle ${radius}m`,centerLocal:center,radiusM:radius,vertices,time:{eventAt:dt,capturedAt:new Date().toISOString()},createdAt:new Date().toISOString(),metrics:{radiusM:radius,areaM2:Math.PI*radius*radius,circumferenceM:2*Math.PI*radius}};app.base.push(rec);put('base',rec);app.command.circle=null;app.mode=null;buildViews();renderAll();toast('Circle saved')}
function requestCircleRadius(center,source,extraPoints=[]){app.command.circle.radiusDraft={center,source,extraPoints};if(globalThis.ui?.dialog&&globalThis.ui?.recordBody)openRadiusPicker(center,source,extraPoints);return app.command.circle.radiusDraft}
function applyCircleRadius(radius){const draft=app.command?.circle?.radiusDraft;if(!draft||!(radius>0))return false;saveCircle(draft.source,draft.center,radius,draft.extraPoints);return true}
function handleCircleClick(local){const c=app.command.circle;if(!c)return;const l=c.source==='add'?sourceLocal('add'):sourceLocal('design',local);c.points.push(l);if(c.method==='center')return requestCircleRadius(l,c.source);if(c.method==='three'&&c.points.length>=3){const cc=circleFrom3(c.points[0],c.points[1],c.points[2]);if(!cc){toast('Circle failed: points nearly collinear');return null}saveCircle(c.source,{x:cc.x,y:cc.y,z:cc.z},cc.r,c.points);return cc}if(c.method==='twoRadius'&&c.points.length>=2){const mid={x:(c.points[0].x+c.points[1].x)/2,y:(c.points[0].y+c.points[1].y)/2,z:(c.points[0].z+c.points[1].z)/2};return requestCircleRadius(mid,c.source,c.points)}toast(`Circle: ${c.points.length} point(s) captured`);return l}
function commandPrimaryClick(local,opts={}){
  if(opts.detail>1)return 'ignored-double-click';
  if(app.mode==='design-point'){openPointDialog('design',sourceLocal('design',local));app.mode=null;return 'point-dialog'}
  if(app.mode==='add-point'){openPointDialog('add',sourceLocal('add'));app.mode=null;return 'point-dialog'}
  if(app.mode==='design-route'||app.mode==='design-area'){const t=app.mode.split('-')[1];if(!app.active)startElement(t,'design',sourceLocal('design',local));else addVertex(sourceLocal('design',local));return 'vertex'}
  if(app.mode==='add-route'||app.mode==='add-area'){const t=app.mode.split('-')[1];if(!app.active)startElement(t,'add');else addVertex();return 'vertex'}
  if(app.mode==='design-circle'||app.mode==='add-circle'){handleCircleClick(local);return 'circle'}
  if(app.selectMode==='one'){selectNearest(local);return 'select-one'}
  if(app.active&&app.active.source==='design'){addVertex(sourceLocal('design',local));return 'vertex'}
  return 'noop'
}
function setTool(kind,type){type=normalizeCommandType(type);closePops();ui.recordSave.style.display='';pulse(ui.leveler);app.active=null;beginCommand(kind,type);if(type==='circle'){openCircleMethod(kind);return}toast(`${kind.toUpperCase()} Â· ${type} Â· ${kind==='add'?'click canvas = avatar sample':'click canvas = design point'}`)}

async function reverse(lat,lng){if(!navigator.onLine)return'';try{const r=await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lng)}`);if(!r.ok)return'';const j=await r.json();return j.display_name||''}catch{return''}}
async function refreshAddresses(){for(const r of app.base){if(r.type==='point'&&!r.address){const w=r.correctedWgs||r.wgs||localToWgs(r.correctedLocal.x,r.correctedLocal.y,r.correctedLocal.z);r.address=await reverse(w.lat,w.lng);await put('base',r)}}buildViews();renderAll();toast('Address refresh complete where possible.')}
function inRangeRecords(range){const old=app.settings.viewMode;app.settings.viewMode=range;const rows=visibleRecords();app.settings.viewMode=old;return rows}
function exportGeoJSON(range,mode){const rows=inRangeRecords(range);return JSON.stringify({type:'FeatureCollection',metadata:{range,mode,exportedAt:new Date().toISOString()},features:rows.map(r=>featureOf(r,mode))},null,2)}
function featureOf(r,mode){const pointCoord=(l)=>{const w=mode==='historical'?(r.wgs||r.rawWgs||localToWgs(l.x,l.y,l.z)):(r.correctedWgs||localToWgs(l.x,l.y,l.z));return[w.lng,w.lat,w.alt||0]};let geom;if(r.type==='point')geom={type:'Point',coordinates:pointCoord(r.correctedLocal||r.local)};else{const cs=r.vertices.map(v=>{const l=mode==='historical'?(v.local||v.correctedLocal):(v.correctedLocal||v.local);const w=mode==='historical'?(v.rawWgs||v.wgs||localToWgs(l.x,l.y,l.z)):(v.correctedWgs||localToWgs(l.x,l.y,l.z));return[w.lng,w.lat,w.alt||0]});geom={type:r.type==='area'?'Polygon':'LineString',coordinates:r.type==='area'?[cs.concat([cs[0]])]:cs}}return{type:'Feature',geometry:geom,properties:{id:r.id,code:r.code,type:r.type,name:r.name,address:r.address,metrics:r.metrics,time:r.time,mode}}}
function exportKML(range,mode){const gj=JSON.parse(exportGeoJSON(range,mode));return `<?xml version="1.0" encoding="UTF-8"?><kml xmlns="http://www.opengis.net/kml/2.2"><Document>${gj.features.map(f=>`<Placemark><name>${esc(f.properties.name||f.properties.code||f.properties.id)}</name><description>${esc(f.properties.address||'')}</description>${kmlGeom(f.geometry)}</Placemark>`).join('')}</Document></kml>`}
function kmlGeom(g){if(g.type==='Point')return`<Point><coordinates>${g.coordinates.join(',')}</coordinates></Point>`;const coords=(g.type==='Polygon'?g.coordinates[0]:g.coordinates).map(c=>c.join(',')).join(' ');return g.type==='Polygon'?`<Polygon><outerBoundaryIs><LinearRing><coordinates>${coords}</coordinates></LinearRing></outerBoundaryIs></Polygon>`:`<LineString><coordinates>${coords}</coordinates></LineString>`}
function download(txt,name,type){const a=document.createElement('a'),u=URL.createObjectURL(new Blob([txt],{type}));a.href=u;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(u),1000)}


export { sourceLocal, normalizeCommandType, beginCommand, savePointWithSmartIcon, openPointDialog, openProperties, startElement, addVertex, finishActive, pauseActive, resumeActive, cancelActive, commandMenu, nearestRecord, activeContextActions, selectionContextActions, openCanvasContext, beginCircleCommand, openCircleMethod, openRadiusPicker, requestCircleRadius, applyCircleRadius, saveCircle, handleCircleClick, commandPrimaryClick, setTool, reverse, refreshAddresses, inRangeRecords, exportGeoJSON, featureOf, exportKML, kmlGeom, download };
Object.assign(globalThis.PSJModules.commands = {}, { sourceLocal, normalizeCommandType, beginCommand, savePointWithSmartIcon, openPointDialog, openProperties, startElement, addVertex, finishActive, pauseActive, resumeActive, cancelActive, commandMenu, nearestRecord, activeContextActions, selectionContextActions, openCanvasContext, beginCircleCommand, openCircleMethod, openRadiusPicker, requestCircleRadius, applyCircleRadius, saveCircle, handleCircleClick, commandPrimaryClick, setTool, reverse, refreshAddresses, inRangeRecords, exportGeoJSON, featureOf, exportKML, kmlGeom, download });
for (const [name, value] of Object.entries(globalThis.PSJModules.commands)) expose(name, value);

