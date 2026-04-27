globalThis.PSJModules = globalThis.PSJModules || {};
const expose = (name, value) => {
  globalThis[name] = value;
  globalThis.PSJModules = globalThis.PSJModules || {};
  return value;
};
function renderLoop(){draw();requestAnimationFrame(renderLoop)}
function clampPopover(pop,anchor){document.querySelectorAll('.popover.open').forEach(p=>{if(p!==pop)p.classList.remove('open')});pop.classList.toggle('open');if(pop===ui.viewPop)renderDateChooser();if(!pop.classList.contains('open'))return;const a=anchor.getBoundingClientRect(),pr=pop.getBoundingClientRect();let left=a.left+a.width/2-pr.width/2,top=a.top-pr.height-10;if(top<8)top=a.bottom+8;if(left<8)left=8;if(left+pr.width>innerWidth-8)left=innerWidth-pr.width-8;pop.style.left=left+'px';pop.style.top=top+'px'}
function closePops(){document.querySelectorAll('.popover.open').forEach(p=>p.classList.remove('open'))}
function setPanel(name){ui.panel.classList.add('open');const titles={base:'ðŸ“š Î’Î¬ÏƒÎµÎ¹Ï‚',weekly:'ðŸ“… Weekly',settings:'ðŸ”§ Settings',compass:'ðŸ§­ Compass / GPS'};ui.panelTitle.textContent=titles[name]||name;if(name==='base')renderBasePanel();if(name==='weekly')renderWeeklyPanel();if(name==='settings')renderSettingsPanel();if(name==='compass')renderCompassPanel()}
function renderBasePanel(){const groups=[];groups.push(["Î’Î¬ÏƒÎµÎ¹Ï‚ Î±Ï€ÎµÎ¹ÎºÏŒÎ½Î¹ÏƒÎ·Ï‚",[["avatarView",[app.avatarView]],["mapView",app.mapView],["weeklyView",app.weeklyView]]]);groups.push(["ÎœÏŒÎ½Î¹Î¼Î· ÎºÎ±Ï„Î±Î³ÏÎ±Ï†Î®",[["base",app.base],["controlPoints",app.controlPoints]]]);groups.push(["Î ÏÎ¿ÏƒÏ‰ÏÎ¹Î½Î­Ï‚",[["tempGnss",app.tempGnss.slice(-300)]]]);groups.push(["Î¥Ï€Î¿Î»Î¿Î³Î¹ÏƒÎ¼ÏŽÎ½",[["correctionLog",app.correctionLog.slice(-300)],["solver",[{formula:"correctedXYZ = rawXYZ - weightedMean(deltaXYZ from nearby control points)",weights:"w = confidence / (sigma^2 * distance^2)",truth:"raw data never mutated; current-best correction is a view/export mode; Z is ground estimate from GNSS altitude minus 1m phone-height offset"}]]]]);ui.panelBody.innerHTML=groups.map(([g,items])=>`<details open><summary>${g}</summary>${items.map(([n,rows])=>dbSection(n,rows)).join("")}</details>`).join("")}
function dbSection(name,rows){return `<details><summary>${name} Â· ${rows.length}</summary><div class="row"><span class="pill">Table</span><span class="pill">Formula/model</span></div>${tableFor(rows)}<pre>${esc(JSON.stringify(rows.slice(0,60),null,2))}</pre></details>`}
function tableFor(rows){if(!rows.length)return '<p class="muted">No rows.</p>';const keys=Array.from(new Set(rows.flatMap(r=>Object.keys(r)).slice(0,12))).slice(0,8);return `<div class="tableWrap"><table><thead><tr>${keys.map(k=>`<th>${esc(k)}</th>`).join('')}</tr></thead><tbody>${rows.map(r=>`<tr>${keys.map(k=>`<td class="expandCell"><div class="clip">${esc(typeof r[k]==='object'?JSON.stringify(r[k]):r[k])}</div></td>`).join('')}</tr>`).join('')}</tbody></table></div>`}
function renderWeeklyPanel(){const st=weekStart(app.settings.selectedAt),days=Array.from({length:7},(_,i)=>addDays(st,i)),rows=app.base.filter(r=>recWeek(r)===ymd(st));ui.panelBody.innerHTML=`<div class="row"><button id="prevWeekBtn" type="button">â†</button><b>W${weekNo(st)} Â· ${ymd(days[0])} â†’ ${ymd(days[6])}</b><button id="nextWeekBtn" type="button">â†’</button></div><details open><summary>Î Î¯Î½Î±ÎºÎ±Ï‚ ÎµÎ²Î´Î¿Î¼Î¬Î´Î±Ï‚</summary>${weeklyTable(days,rows)}</details><details><summary>ÎšÎ¬ÏÏ„ÎµÏ‚ ÏƒÏ„Î¿Î¹Ï‡ÎµÎ¯Ï‰Î½ (${rows.length})</summary>${rows.map(weeklyCard).join('')||'<p>No records.</p>'}</details>`;const prev=$('prevWeekBtn'),next=$('nextWeekBtn');if(prev)prev.onclick=(e)=>{e.preventDefault();e.stopPropagation();const cur=weekStart(app.settings.selectedAt);app.settings.selectedAt=addDays(cur,-7).toISOString();buildViews();renderWeeklyPanel()};if(next)next.onclick=(e)=>{e.preventDefault();e.stopPropagation();const cur=weekStart(app.settings.selectedAt);app.settings.selectedAt=addDays(cur,7).toISOString();buildViews();renderWeeklyPanel()}}
function weeklyTable(days,rows){return `<div class="tableWrap"><table><thead><tr><th>Î—Î¼Î­ÏÎ±</th><th>Objects</th><th>Routes km</th><th>Areas mÂ²</th><th>Notes</th></tr></thead><tbody>${days.map(d=>{const day=ymd(d),dr=rows.filter(r=>recDate(r)===day);return `<tr><th>${day}</th><td>${dr.filter(r=>r.type==='point').length}</td><td>${(dr.filter(r=>r.type==='route').reduce((s,r)=>s+(r.metrics?.distanceM||0),0)/1000).toFixed(3)}</td><td>${dr.filter(r=>r.type==='area').reduce((s,r)=>s+(r.metrics?.areaM2||0),0).toFixed(1)}</td><td>${dr.filter(r=>r.comment).length}</td></tr>`}).join('')}</tbody></table></div>`}
function weeklyCard(r){return `<div class="card"><span class="pill">${esc(r.type)}</span> <b>${esc(r.name||r.code||r.id)}</b><br><span class="small muted">${esc(r.time?.eventAt)} Â· ${esc(r.address||'no address')}</span><p>${esc(r.comment||'')}</p><button onclick="window.PSJ_show('${r.id}')">Show on map</button></div>`}
window.PSJ_show=(rid)=>{const r=app.base.find(x=>x.id===rid);if(!r)return;const l=r.correctedLocal||r.local||r.vertices?.[0]?.correctedLocal;if(l){app.camera.x=l.x;app.camera.y=l.y;app.camera.z=Math.max(app.camera.z,2);ui.panel.classList.remove('open')}};
function renderSettingsPanel(){ui.panelBody.innerHTML=`<details open><summary>Î§ÏÏŒÎ½Î¿Ï‚ / Î ÏÎ¿Î²Î¿Î»Î®</summary><div class="row"><button data-v="day">Day</button><button data-v="week">Week</button><button data-v="month">Month</button><button data-v="year">Year</button></div><p>Selected: ${ymd(app.settings.selectedAt)} Â· ${app.settings.viewMode}</p></details><details open><summary>GPS / Solver</summary><p class="small muted">Î¤Î¿ Ï€ÏÎ¿ÏƒÏ‰Ï€Î¹ÎºÏŒ CRS Î¾ÎµÎºÎ¹Î½Î¬ Î±Ï€ÏŒ Ï„Î¿ Ï€ÏÏŽÏ„Î¿ Î±Î¾Î¹ÏŒÏ€Î¹ÏƒÏ„Î¿ GNSS/anchor. ÎœÎ­Ï‡ÏÎ¹ Ï„ÏŒÏ„Îµ Î¿Î¹ ÎµÎ¹ÏƒÎ±Î³Ï‰Î³Î­Ï‚ ÎµÎ¯Î½Î±Î¹ provisional ÎºÎ±Î¹ Î´ÎµÎ½ Ï€Î±Î¯ÏÎ½Î¿Ï…Î½ Ï„ÎµÏ‡Î½Î·Ï„Î­Ï‚ ÏƒÏ…Î½Ï„ÎµÏ„Î±Î³Î¼Î­Î½ÎµÏ‚ 5,000,000.</p><label>GNSS interval sec<input id="setGnss" type="number" value="${app.settings.gnssInterval}"></label><label>Route interval sec<input id="setRoute" type="number" value="${app.settings.routeInterval}"></label><button id="saveSet" class="primary">Save settings</button></details><details><summary>Export</summary><div class="row"><select id="exportRange"><option>day</option><option selected>week</option><option>month</option><option>year</option></select><select id="exportMode"><option value="historical">Historical</option><option value="current">Current best correction</option></select><button id="exportGeojson">GeoJSON</button><button id="exportKml">KML</button></div></details><details><summary>Address refresh</summary><button id="addrRefresh">Refresh missing addresses</button><p class="small muted">Uses online reverse geocoding when internet exists.</p></details>`;ui.panelBody.querySelectorAll('[data-v]').forEach(b=>b.onclick=()=>{app.settings.viewMode=b.dataset.v;buildViews();renderSettingsPanel()});$('saveSet').onclick=async()=>{app.settings.gnssInterval=Math.max(1,Number($('setGnss').value)||5);app.settings.routeInterval=Math.max(1,Number($('setRoute').value)||10);await saveSettings();renderSettingsPanel()};$('exportGeojson').onclick=()=>download(exportGeoJSON($('exportRange').value,$('exportMode').value),'psj.geojson','application/geo+json');$('exportKml').onclick=()=>download(exportKML($('exportRange').value,$('exportMode').value),'psj.kml','application/vnd.google-earth.kml+xml');$('addrRefresh').onclick=refreshAddresses}
function renderCompassPanel(){ui.panelBody.innerHTML=`<details open><summary>Compass / sensors</summary><pre>${esc(JSON.stringify({heading:app.avatarView.heading,orientation:app.orientation,solver:app.avatarView.solver,confidence:app.avatarView.confidence,usedControls:app.avatarView.usedControls},null,2))}</pre></details><details><summary>Position solver formula</summary><pre>raw WGS84 phone alt â†’ personal XYZ ground z = alt - 1m\ncorrected XYZ = raw XYZ - Î£(wáµ¢ Â· Î”áµ¢) / Î£wáµ¢\nwáµ¢ = confidenceáµ¢ / (Ïƒáµ¢Â² Â· distanceáµ¢Â²)\nroute distance = Î£ distance(corrected XYZ vertices)</pre></details>`}

function showSelectedDateStep(dir){const m=app.settings.viewMode,d=safeDate(app.settings.selectedAt);if(m==='day')d.setDate(d.getDate()+dir);else if(m==='week')d.setDate(d.getDate()+7*dir);else if(m==='month')d.setMonth(d.getMonth()+dir);else d.setFullYear(d.getFullYear()+dir);app.settings.selectedAt=d.toISOString();buildViews();renderAll()}

function pulse(el){if(!el)return;el.classList.remove('pulse');void el.offsetWidth;el.classList.add('pulse');setTimeout(()=>el.classList.remove('pulse'),320)}
let toastTimer=null;function toast(msg,ms=2200){if(!ui.toast)return;ui.toast.textContent=msg;ui.toast.classList.remove('hidden');ui.toast.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>{ui.toast.classList.add('hidden');ui.toast.classList.remove('show')},ms)}
function monthName(i){return ['Î™Î±Î½','Î¦ÎµÎ²','ÎœÎ±Ï','Î‘Ï€Ï','ÎœÎ¬Î¹','Î™Î¿Ï…Î½','Î™Î¿Ï…Î»','Î‘Ï…Î³','Î£ÎµÏ€','ÎŸÎºÏ„','ÎÎ¿Îµ','Î”ÎµÎº'][i]}
function renderDateChooser(){if(!ui.dateChooser)return;const mode=app.settings.viewMode||'week';const cur=safeDate(app.settings.selectedAt);let html='';
 const nav=(label)=>`<div class="dateHead"><button id="dcPrev">â†</button><b>${label}</b><button id="dcNext">â†’</button></div>`;
 if(mode==='day'){
   const y=cur.getFullYear(),m=cur.getMonth();const first=new Date(y,m,1),start=weekStart(first);const days=[];for(let i=0;i<42;i++)days.push(addDays(start,i));
   html=nav(`${monthName(m)} ${y}`)+`<div class="dateGrid"><div class="dow">Î”Îµ</div><div class="dow">Î¤Ï</div><div class="dow">Î¤Îµ</div><div class="dow">Î Îµ</div><div class="dow">Î Î±</div><div class="dow">Î£Î±</div><div class="dow">ÎšÏ…</div>${days.map(d=>`<button class="${d.getMonth()!==m?'mutedDay ':''}${ymd(d)===ymd(cur)?'selected':''}" data-date="${d.toISOString()}">${d.getDate()}</button>`).join('')}</div>`;
 }else if(mode==='week'){
   const base=weekStart(cur);const weeks=[];for(let i=-3;i<=4;i++){const st=addDays(base,i*7),en=addDays(st,6);weeks.push({st,en})}
   html=nav(`W${weekNo(cur)} Â· ${ymd(base)} â†’ ${ymd(addDays(base,6))}`)+`<div class="dateGrid months">${weeks.map(w=>`<button class="${ymd(w.st)===ymd(base)?'selected':''}" data-date="${w.st.toISOString()}">W${weekNo(w.st)}<br><small>${w.st.getDate()}/${w.st.getMonth()+1}â€“${w.en.getDate()}/${w.en.getMonth()+1}</small></button>`).join('')}</div>`;
 }else if(mode==='month'){
   const y=cur.getFullYear();html=nav(`${y}`)+`<div class="dateGrid months">${Array.from({length:12},(_,m)=>`<button class="${m===cur.getMonth()?'selected':''}" data-date="${new Date(y,m,1).toISOString()}">${monthName(m)}</button>`).join('')}</div>`;
 }else{
   const y=cur.getFullYear(),start=y-5;html=nav(`${start}â€“${start+11}`)+`<div class="dateGrid years">${Array.from({length:12},(_,i)=>start+i).map(yy=>`<button class="${yy===y?'selected':''}" data-date="${new Date(yy,0,1).toISOString()}">${yy}</button>`).join('')}</div>`;
 }
 ui.dateChooser.innerHTML=html;ui.dateChooser.querySelectorAll('[data-date]').forEach(b=>b.onclick=()=>{app.settings.selectedAt=safeDate(b.dataset.date).toISOString();buildViews();renderAll();renderDateChooser();pulse(ui.papyrus)});
 const prev=ui.dateChooser.querySelector('#dcPrev'),next=ui.dateChooser.querySelector('#dcNext');if(prev)prev.onclick=()=>{showSelectedDateStep(-1);renderDateChooser()};if(next)next.onclick=()=>{showSelectedDateStep(1);renderDateChooser()};
 document.querySelectorAll('[data-view]').forEach(b=>b.classList.toggle('active',b.dataset.view===app.settings.viewMode));
}

function setup(){window.addEventListener('resize',resize);ui.viewBtn.onclick=()=>clampPopover(ui.viewPop,ui.viewBtn);ui.addBtn.onclick=()=>clampPopover(ui.addPop,ui.addBtn);ui.designBtn.onclick=()=>clampPopover(ui.designPop,ui.designBtn);ui.selectBtn.onclick=()=>clampPopover(ui.selectPop,ui.selectBtn);ui.measureBtn.onclick=()=>{closePops();app.mode='measure';pulse(ui.leveler);toast('Measure: ÎµÏ€Î¯Î»ÎµÎ¾Îµ Î´ÏÎ¿ ÏƒÎ·Î¼ÎµÎ¯Î± ÏƒÏ„Î¿Î½ ÎºÎ±Î¼Î²Î¬.');};ui.pathBtn.onclick=()=>{closePops();app.mode='path-measure';pulse(ui.leveler);toast('Path measure: ÎµÏ€Î¯Î»ÎµÎ¾Îµ/ÏƒÏ‡ÎµÎ´Î¯Î±ÏƒÎµ Î´Î¹Î±Î´ÏÎ¿Î¼Î® Î³Î¹Î± Î¼Î­Ï„ÏÎ·ÏƒÎ· ÎºÎ±Ï„Î¬ Î¼Î®ÎºÎ¿Ï‚.');};ui.layersBtn.onclick=()=>clampPopover(ui.layersPop,ui.layersBtn);ui.followBtn.onclick=()=>{app.follow=!app.follow;ui.followBtn.classList.toggle('active',app.follow);pulse(ui.papyrus)};ui.pinBtn.onclick=()=>{const l=app.avatarView.correctedLocal;if(l){app.camera.x=l.x;app.camera.y=l.y;app.follow=true;ui.followBtn.classList.add('active');renderAll(false);pulse(ui.papyrus)}};ui.zoomIn.onclick=()=>{app.camera.z*=1.25;pulse(ui.papyrus)};ui.zoomOut.onclick=()=>{app.camera.z/=1.25;pulse(ui.papyrus)};ui.fit.onclick=()=>{fitAll();pulse(ui.papyrus)};ui.fitSel.onclick=()=>{fitSelected();pulse(ui.papyrus)};ui.papyrus.onclick=e=>{if(e.target===ui.papyrus)ui.papyrus.classList.toggle('open')};document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>{app.settings.viewMode=b.dataset.view;buildViews();renderAll();renderDateChooser();pulse(ui.papyrus)});renderDateChooser();document.querySelectorAll('[data-add]').forEach(b=>b.onclick=()=>setTool('add',b.dataset.add));document.querySelectorAll('[data-design]').forEach(b=>b.onclick=()=>setTool('design',b.dataset.design));document.querySelectorAll('[data-select]').forEach(b=>b.onclick=()=>{app.selectMode=b.dataset.select;app.mode=null;closePops()});['Trail','Controls','Objects','Routes','Areas'].forEach(n=>{$('layer'+n).onchange=e=>{app.layers[n.toLowerCase()]=e.target.checked;renderAll()}});ui.hub.onclick=e=>{if(e.detail===0)return;toggleArc()};ui.leveler.onclick=e=>{if(e.detail===0)return;toggleToolArc()};let lp;ui.hub.addEventListener('pointerdown',()=>{lp=setTimeout(()=>setPanel('compass'),650)});ui.hub.addEventListener('pointerup',()=>clearTimeout(lp));ui.hub.addEventListener('contextmenu',e=>{e.preventDefault();setPanel('compass')});ui.arcBase.onclick=()=>setPanel('base');ui.arcWeekly.onclick=()=>setPanel('weekly');ui.arcSettings.onclick=()=>setPanel('settings');ui.panelClose.onclick=()=>ui.panel.classList.remove('open');document.querySelectorAll('[data-panel]').forEach(b=>b.onclick=()=>setPanel(b.dataset.panel));ui.canvas.addEventListener('pointerdown',canvasDown);ui.canvas.addEventListener('pointermove',canvasMove);ui.canvas.addEventListener('pointerup',canvasUp);ui.canvas.addEventListener('dblclick',e=>{e.preventDefault();e.stopPropagation()});ui.canvas.addEventListener('contextmenu',e=>{e.preventDefault();openCanvasContext(e)});document.addEventListener('click',e=>{if(!e.target.closest('.popover')&&!e.target.closest('#bottomToolbar')&&!e.target.closest('#toolArcMenu')&&!e.target.closest('#levelerHub'))closePops();if(!e.target.closest('#toolArcMenu')&&!e.target.closest('#levelerHub')){app.toolArcOpen=false;document.querySelectorAll('.toolArcIcon').forEach(b=>b.classList.remove('open'))}if(ui.panel.classList.contains('open')&&e.target===ui.canvas)ui.panel.classList.remove('open'); if(e.target===ui.canvas&&ui.dialog.open)ui.dialog.close(); if(!e.target.closest('#cmdMenu'))ui.cmdMenu.classList.remove('open')});document.addEventListener('click',e=>{const cell=e.target.closest('.expandCell');if(cell)cell.classList.toggle('open')});window.addEventListener('deviceorientation',e=>{app.orientation={alpha:e.alpha,beta:e.beta||0,gamma:e.gamma||0,source:'deviceorientation'};if(e.alpha!==null){app.avatarView.heading=computeHeading({heading:null,speed:0},app.avatarView.correctedLocal)}});window.addEventListener('pagehide',saveSettings)}
function toggleArc(){app.arcOpen=!app.arcOpen;document.querySelectorAll('.arcIcon').forEach(b=>b.classList.toggle('open',app.arcOpen))}
function toggleToolArc(){app.toolArcOpen=!app.toolArcOpen;document.querySelectorAll('.toolArcIcon').forEach(b=>b.classList.toggle('open',app.toolArcOpen))}
function canvasDown(e){ui.canvas.setPointerCapture(e.pointerId);app.pointer={x:e.clientX,y:e.clientY,lastX:e.clientX,lastY:e.clientY,drag:false}}

function canvasMove(e){const p=app.pointer;if(!p)return;const dx=e.clientX-p.lastX,dy=e.clientY-p.lastY;if(Math.hypot(e.clientX-p.x,e.clientY-p.y)>6)p.drag=true;if(p.drag&&app.selectMode==='box'){app.selectBox={x1:p.x,y1:p.y,x2:e.clientX,y2:e.clientY};renderAll(false)}else if(p.drag&&!app.selectMode){app.follow=false;ui.followBtn.classList.remove('active');app.camera.x-=dx/app.camera.z;app.camera.y+=dy/app.camera.z;renderAll(false)}p.lastX=e.clientX;p.lastY=e.clientY}
function canvasUp(e){const p=app.pointer;if(!p)return;const r=ui.canvas.getBoundingClientRect(),l=screenToLocal(e.clientX-r.left,e.clientY-r.top);if(app.selectMode==='box'&&p.drag){selectByWindow(p.x-r.left,p.y-r.top,e.clientX-r.left,e.clientY-r.top);app.pointer=null;return}if(!p.drag){const now=Date.now(),last=app.lastPrimaryClick;const isDouble=!!last&&now-last.at<300&&Math.hypot(e.clientX-last.x,e.clientY-last.y)<6;commandPrimaryClick(l,{detail:isDouble?2:(e.detail||0)});app.lastPrimaryClick={at:now,x:e.clientX,y:e.clientY}}app.pointer=null;app.selectBox=null;renderAll(false)}
function selectNearest(l){let best=nearestRecord(l,30/app.camera.z);if(best){app.selected.clear();app.selected.add(best.id);toast(`Selected ${best.name||best.code||best.type}`);renderAll(false)}else toast('No element near cursor')}
function selectByWindow(x1,y1,x2,y2){const minx=Math.min(x1,x2),maxx=Math.max(x1,x2),miny=Math.min(y1,y2),maxy=Math.max(y1,y2);app.selected.clear();for(const r of app.base){const pts=r.type==='point'?[r.correctedLocal||r.local]:(r.vertices||[]).map(v=>v.correctedLocal||v.local);if(pts.some(p=>{const ss=localToScreen(p.x,p.y);return ss.x>=minx&&ss.x<=maxx&&ss.y>=miny&&ss.y<=maxy}))app.selected.add(r.id)}toast(`${app.selected.size} selected`);renderAll(false)}
function fitSelected(){const pts=[...app.selected].map(id=>app.base.find(r=>r.id===id)).filter(Boolean).flatMap(r=>r.type==='point'?[r.correctedLocal||r.local]:r.vertices.map(v=>v.correctedLocal||v.local));fitPts(pts.length?pts:[app.avatarView.correctedLocal])}
function fitPts(pts){if(!pts.length)return;const xs=pts.map(p=>p.x),ys=pts.map(p=>p.y),r=ui.canvas.getBoundingClientRect();const minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys);app.camera.x=(minX+maxX)/2;app.camera.y=(minY+maxY)/2;app.camera.z=Math.max(.002,Math.min(20,Math.min((r.width-100)/Math.max(1,maxX-minX),(r.height-160)/Math.max(1,maxY-minY))))}


export { renderLoop, clampPopover, closePops, setPanel, renderBasePanel, dbSection, tableFor, renderWeeklyPanel, weeklyTable, weeklyCard, renderSettingsPanel, renderCompassPanel, showSelectedDateStep, pulse, toast, monthName, renderDateChooser, setup, toggleArc, toggleToolArc, canvasDown, canvasMove, canvasUp, selectNearest, selectByWindow, fitSelected, fitPts };
Object.assign(globalThis.PSJModules.ui = {}, { renderLoop, clampPopover, closePops, setPanel, renderBasePanel, dbSection, tableFor, renderWeeklyPanel, weeklyTable, weeklyCard, renderSettingsPanel, renderCompassPanel, showSelectedDateStep, pulse, toast, monthName, renderDateChooser, setup, toggleArc, toggleToolArc, canvasDown, canvasMove, canvasUp, selectNearest, selectByWindow, fitSelected, fitPts });
for (const [name, value] of Object.entries(globalThis.PSJModules.ui)) expose(name, value);


/* v80 UI hotfix layer: fixes layout, clamping, toolbox behavior, settings library. */
function clampPopoverV80(pop, anchor){
  if(!pop || !anchor) return;
  document.querySelectorAll('.popover.open').forEach(p=>{ if(p!==pop) p.classList.remove('open'); });
  const willOpen=!pop.classList.contains('open');
  pop.classList.toggle('open', willOpen);
  if(pop===ui.viewPop) renderDateChooser();
  if(!willOpen) return;
  requestAnimationFrame(()=>{
    const a=anchor.getBoundingClientRect();
    const pr=pop.getBoundingClientRect();
    const pad=10;
    let left=a.left + a.width/2 - pr.width/2;
    let top=a.top - pr.height - 12;
    if(top < pad) top = a.bottom + 12;
    left=Math.max(pad,Math.min(left,innerWidth-pr.width-pad));
    top=Math.max(pad,Math.min(top,innerHeight-pr.height-pad));
    pop.style.left=left+'px';
    pop.style.top=top+'px';
  });
}
function fitAllV80(){
  const pts=[];
  if(app.avatarView?.correctedLocal) pts.push(app.avatarView.correctedLocal);
  for(const r of app.base||[]){
    if(r.type==='point' && (r.correctedLocal||r.local)) pts.push(r.correctedLocal||r.local);
    if(Array.isArray(r.vertices)) r.vertices.forEach(v=>{ const p=v.correctedLocal||v.local; if(p) pts.push(p); });
  }
  fitPts(pts.length?pts:[{x:0,y:0,z:0}]);
  renderAll(false);
}
function weeklyTableV80(days,rows){
  return `<div class="tableWrap"><table><thead><tr><th>Day</th><th>Objects</th><th>Routes km</th><th>Areas m2</th><th>Addresses</th></tr></thead><tbody>${days.map(d=>{const day=ymd(d),dr=rows.filter(r=>recDate(r)===day);const addr=dr.map(r=>r.address).filter(Boolean).slice(0,2).map(esc).join('<br>')||'<span class="muted">-</span>';return `<tr><th>${day}</th><td>${dr.filter(r=>r.type==='point').length}</td><td>${(dr.filter(r=>r.type==='route').reduce((s,r)=>s+(r.metrics?.distanceM||0),0)/1000).toFixed(3)}</td><td>${dr.filter(r=>r.type==='area').reduce((s,r)=>s+(r.metrics?.areaM2||0),0).toFixed(1)}</td><td>${addr}</td></tr>`}).join('')}</tbody></table></div>`;
}
function weeklyCardV80(r){
  return `<div class="card"><span class="pill">${esc(r.type)}</span> <b>${esc(r.name||r.code||r.id)}</b><br><span class="small muted">${esc(r.time?.eventAt||'')} - ${esc(r.address||'no address')}</span><p>${esc(r.comment||'')}</p><button onclick="window.PSJ_show('${r.id}')">Show on map</button></div>`;
}
function renderWeeklyPanelV80(){
  const st=weekStart(app.settings.selectedAt),days=Array.from({length:7},(_,i)=>addDays(st,i)),rows=app.base.filter(r=>recWeek(r)===ymd(st));
  ui.panelBody.innerHTML=`<div class="row"><button id="prevWeekBtn" type="button">Prev week</button><b>W${weekNo(st)} - ${ymd(days[0])} to ${ymd(days[6])}</b><button id="nextWeekBtn" type="button">Next week</button></div><details open><summary>Weekly table</summary>${weeklyTableV80(days,rows)}</details><details open><summary>Records (${rows.length})</summary>${rows.map(weeklyCardV80).join('')||'<p>No records.</p>'}</details>`;
  $('prevWeekBtn').onclick=(e)=>{e.preventDefault();e.stopPropagation();app.settings.selectedAt=addDays(weekStart(app.settings.selectedAt),-7).toISOString();buildViews();renderWeeklyPanelV80();renderAll(false)};
  $('nextWeekBtn').onclick=(e)=>{e.preventDefault();e.stopPropagation();app.settings.selectedAt=addDays(weekStart(app.settings.selectedAt),7).toISOString();buildViews();renderWeeklyPanelV80();renderAll(false)};
}
function renderSettingsPanelV80(){
  const iconRows=(app.smartIcons||[]).map((p,i)=>`<div class="smartSettingRow"><b>Preset ${i+1}</b><label>Name<input data-smart-name="${i}" value="${esc(p.name||'')}"></label><label>Icon<input data-smart-icon="${i}" value="${esc(p.icon||'')}"></label></div>`).join('');
  ui.panelBody.innerHTML=`<details open><summary>View / Time</summary><div class="row"><button data-v="day">Day</button><button data-v="week">Week</button><button data-v="month">Month</button><button data-v="year">Year</button></div><p>Selected: ${ymd(app.settings.selectedAt)} - ${app.settings.viewMode}</p></details><details open><summary>GPS / Solver</summary><p class="small muted">Personal CRS starts from the first reliable GNSS/anchor. New records remain provisional until corrected by the solver.</p><label>GNSS interval sec<input id="setGnss" type="number" value="${app.settings.gnssInterval}"></label><label>Route interval sec<input id="setRoute" type="number" value="${app.settings.routeInterval}"></label><button id="saveSet" class="primary">Save settings</button></details><details open><summary>Smart vector library</summary><p class="small muted">These presets appear in the Point/Object selector.</p><div class="smartSettingsGrid">${iconRows}</div><button id="saveSmart" class="primary">Save smart library</button></details><details><summary>Layers</summary><label><input type="checkbox" data-layer="trail" ${app.layers.trail?'checked':''}> GPS trail</label><label><input type="checkbox" data-layer="controls" ${app.layers.controls?'checked':''}> Control points</label><label><input type="checkbox" data-layer="objects" ${app.layers.objects?'checked':''}> Objects</label><label><input type="checkbox" data-layer="routes" ${app.layers.routes?'checked':''}> Routes</label><label><input type="checkbox" data-layer="areas" ${app.layers.areas?'checked':''}> Areas</label></details><details><summary>Export</summary><div class="row"><select id="exportRange"><option>day</option><option selected>week</option><option>month</option><option>year</option></select><select id="exportMode"><option value="historical">Historical</option><option value="current">Current best correction</option></select><button id="exportGeojson">GeoJSON</button><button id="exportKml">KML</button></div></details><details><summary>Address refresh</summary><button id="addrRefresh">Refresh missing addresses</button><p class="small muted">Uses online reverse geocoding when internet exists.</p></details>`;
  ui.panelBody.querySelectorAll('[data-v]').forEach(b=>b.onclick=()=>{app.settings.viewMode=b.dataset.v;buildViews();renderSettingsPanelV80();renderAll(false)});
  ui.panelBody.querySelectorAll('[data-layer]').forEach(ch=>ch.onchange=()=>{app.layers[ch.dataset.layer]=ch.checked;renderAll(false)});
  $('saveSet').onclick=async()=>{app.settings.gnssInterval=Math.max(1,Number($('setGnss').value)||5);app.settings.routeInterval=Math.max(1,Number($('setRoute').value)||10);await saveSettings();toast('Settings saved')};
  $('saveSmart').onclick=async()=>{app.smartIcons=(app.smartIcons||[]).map((p,i)=>({name:ui.panelBody.querySelector(`[data-smart-name="${i}"]`)?.value||p.name,icon:ui.panelBody.querySelector(`[data-smart-icon="${i}"]`)?.value||p.icon}));await saveSettings();toast('Smart library saved');};
  $('exportGeojson').onclick=()=>download(exportGeoJSON($('exportRange').value,$('exportMode').value),'psj.geojson','application/geo+json');
  $('exportKml').onclick=()=>download(exportKML($('exportRange').value,$('exportMode').value),'psj.kml','application/vnd.google-earth.kml+xml');
  $('addrRefresh').onclick=refreshAddresses;
}
function setPanelV80(name){
  ui.panel.classList.add('open');
  const titles={base:'Base',weekly:'Weekly',settings:'Settings',compass:'Compass / GPS'};
  ui.panelTitle.textContent=titles[name]||name;
  if(name==='base')renderBasePanel();
  if(name==='weekly')renderWeeklyPanelV80();
  if(name==='settings')renderSettingsPanelV80();
  if(name==='compass')renderCompassPanel();
}
function setupV80(){
  window.addEventListener('resize',resize);
  ui.viewBtn.onclick=(e)=>{e.preventDefault();e.stopPropagation();clampPopoverV80(ui.viewPop,ui.viewBtn)};
  ui.addBtn.onclick=(e)=>{e.preventDefault();e.stopPropagation();clampPopoverV80(ui.addPop,ui.addBtn)};
  ui.designBtn.onclick=(e)=>{e.preventDefault();e.stopPropagation();clampPopoverV80(ui.designPop,ui.designBtn)};
  ui.selectBtn.onclick=(e)=>{e.preventDefault();e.stopPropagation();clampPopoverV80(ui.selectPop,ui.selectBtn)};
  ui.measureBtn.onclick=(e)=>{e.preventDefault();e.stopPropagation();closePops();app.mode='measure';toast('Measure mode pending engine hookup')};
  ui.pathBtn.onclick=(e)=>{e.preventDefault();e.stopPropagation();closePops();app.mode='path-measure';toast('Path measure mode pending engine hookup')};
  if(ui.layersBtn) ui.layersBtn.onclick=(e)=>{e.preventDefault();e.stopPropagation();setPanelV80('settings')};
  ui.followBtn.onclick=()=>{app.follow=!app.follow;ui.followBtn.classList.toggle('active',app.follow);pulse(ui.papyrus)};
  ui.pinBtn.onclick=()=>{const l=app.avatarView.correctedLocal;if(l){app.camera.x=l.x;app.camera.y=l.y;app.follow=true;ui.followBtn.classList.add('active');renderAll(false);pulse(ui.papyrus)}};
  ui.zoomIn.onclick=()=>{app.camera.z*=1.25;pulse(ui.papyrus);renderAll(false)};
  ui.zoomOut.onclick=()=>{app.camera.z/=1.25;pulse(ui.papyrus);renderAll(false)};
  ui.fit.onclick=()=>{fitAllV80();pulse(ui.papyrus)};
  ui.fitSel.onclick=()=>{fitSelected();pulse(ui.papyrus)};
  ui.papyrus.onclick=e=>{if(e.target===ui.papyrus)ui.papyrus.classList.toggle('open')};
  document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>{app.settings.viewMode=b.dataset.view;buildViews();renderAll();renderDateChooser();pulse(ui.papyrus)});
  renderDateChooser();
  document.querySelectorAll('[data-add]').forEach(b=>b.onclick=(e)=>{e.preventDefault();e.stopPropagation();setTool('add',b.dataset.add);app.toolArcOpen=true;document.querySelectorAll('.toolArcIcon').forEach(x=>x.classList.add('open'))});
  document.querySelectorAll('[data-design]').forEach(b=>b.onclick=(e)=>{e.preventDefault();e.stopPropagation();setTool('design',b.dataset.design);app.toolArcOpen=true;document.querySelectorAll('.toolArcIcon').forEach(x=>x.classList.add('open'))});
  document.querySelectorAll('[data-select]').forEach(b=>b.onclick=(e)=>{e.preventDefault();e.stopPropagation();app.selectMode=b.dataset.select;app.mode=null;closePops();app.toolArcOpen=true;document.querySelectorAll('.toolArcIcon').forEach(x=>x.classList.add('open'));toast(`Select ${b.dataset.select}`)});
  ['Trail','Controls','Objects','Routes','Areas'].forEach(n=>{const el=$('layer'+n); if(el) el.onchange=e=>{app.layers[n.toLowerCase()]=e.target.checked;renderAll()}});
  ui.hub.onclick=e=>{e.preventDefault();e.stopPropagation();toggleArc()};
  ui.leveler.onclick=e=>{e.preventDefault();e.stopPropagation();toggleToolArc()};
  let lp;ui.hub.addEventListener('pointerdown',()=>{lp=setTimeout(()=>setPanelV80('compass'),650)});ui.hub.addEventListener('pointerup',()=>clearTimeout(lp));ui.hub.addEventListener('contextmenu',e=>{e.preventDefault();setPanelV80('compass')});
  ui.arcBase.onclick=(e)=>{e.preventDefault();e.stopPropagation();setPanelV80('base')};
  ui.arcWeekly.onclick=(e)=>{e.preventDefault();e.stopPropagation();setPanelV80('weekly')};
  ui.arcSettings.onclick=(e)=>{e.preventDefault();e.stopPropagation();setPanelV80('settings')};
  ui.panelClose.onclick=()=>ui.panel.classList.remove('open');
  document.querySelectorAll('[data-panel]').forEach(b=>b.onclick=()=>setPanelV80(b.dataset.panel));
  ui.canvas.addEventListener('pointerdown',canvasDown);ui.canvas.addEventListener('pointermove',canvasMove);ui.canvas.addEventListener('pointerup',canvasUp);ui.canvas.addEventListener('dblclick',e=>{e.preventDefault();e.stopPropagation()});ui.canvas.addEventListener('contextmenu',e=>{e.preventDefault();openCanvasContext(e)});
  document.addEventListener('click',e=>{if(e.target.closest('#toolArcMenu')||e.target.closest('#levelerHub')||e.target.closest('#arcMenu')||e.target.closest('#compassHub'))return;if(!e.target.closest('.popover')&&!e.target.closest('#bottomToolbar'))closePops();if(!e.target.closest('#cmdMenu'))ui.cmdMenu.classList.remove('open');if(ui.panel.classList.contains('open')&&e.target===ui.canvas)ui.panel.classList.remove('open');if(e.target===ui.canvas&&ui.dialog.open)ui.dialog.close();});
  document.addEventListener('click',e=>{const cell=e.target.closest('.expandCell');if(cell)cell.classList.toggle('open')});
  window.addEventListener('deviceorientation',e=>{app.orientation={alpha:e.alpha,beta:e.beta||0,gamma:e.gamma||0,source:'deviceorientation'};if(e.alpha!==null){app.avatarView.heading=computeHeading({heading:null,speed:0},app.avatarView.correctedLocal)}});
  window.addEventListener('pagehide',saveSettings);
}
Object.assign(globalThis,{clampPopover:clampPopoverV80,renderWeeklyPanel:renderWeeklyPanelV80,weeklyTable:weeklyTableV80,weeklyCard:weeklyCardV80,renderSettingsPanel:renderSettingsPanelV80,setPanel:setPanelV80,setup:setupV80,fitAll:fitAllV80});
Object.assign(globalThis.PSJModules.ui,{clampPopover:clampPopoverV80,renderWeeklyPanel:renderWeeklyPanelV80,weeklyTable:weeklyTableV80,weeklyCard:weeklyCardV80,renderSettingsPanel:renderSettingsPanelV80,setPanel:setPanelV80,setup:setupV80});
