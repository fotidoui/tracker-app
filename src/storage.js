globalThis.PSJModules = globalThis.PSJModules || {};
const expose = (name, value) => {
  globalThis[name] = value;
  globalThis.PSJModules = globalThis.PSJModules || {};
  return value;
};
async function openDb(){return new Promise((res,rej)=>{const q=indexedDB.open(DB_NAME,1);q.onupgradeneeded=e=>{const db=e.target.result;['base','tempGnss','controlPoints','correctionLog','avatarView','mapView','weeklyView','settings'].forEach(s=>{if(!db.objectStoreNames.contains(s))db.createObjectStore(s,{keyPath:'id'})})};q.onsuccess=()=>{app.db=q.result;res()};q.onerror=()=>rej(q.error)})}
function store(n,m='readonly'){return app.db.transaction(n,m).objectStore(n)}
function all(n){return new Promise((res,rej)=>{const q=store(n).getAll();q.onsuccess=()=>res(q.result||[]);q.onerror=()=>rej(q.error)})}
function put(n,v){if(!app.db)return Promise.resolve(v);return new Promise((res,rej)=>{const q=store(n,'readwrite').put(v);q.onsuccess=()=>res(v);q.onerror=()=>rej(q.error)})}
function del(n,k){return new Promise((res,rej)=>{const q=store(n,'readwrite').delete(k);q.onsuccess=()=>res();q.onerror=()=>rej(q.error)})}
function clearStore(n){return new Promise((res,rej)=>{const q=store(n,'readwrite').clear();q.onsuccess=()=>res();q.onerror=()=>rej(q.error)})}
async function loadDb(){app.base=await all('base');app.tempGnss=await all('tempGnss');app.controlPoints=await all('controlPoints');app.correctionLog=await all('correctionLog');const av=(await all('avatarView'))[0];if(av)app.avatarView={...app.avatarView,...av};const s=(await all('settings'))[0];if(s){app.settings={...app.settings,...s.settings};app.crs=s.crs||app.crs;app.camera=s.camera||app.camera}buildViews()}

function visibleRecords(){const d=safeDate(app.settings.selectedAt),m=app.settings.viewMode;return app.base.filter(r=>{const rd=recDate(r);if(m==='day')return rd===ymd(d);if(m==='week')return recWeek(r)===ymd(weekStart(d));if(m==='month')return rd.startsWith(ymd(d).slice(0,7));if(m==='year')return rd.startsWith(String(d.getFullYear()));return true})}
function buildViews(){app.mapView=visibleRecords().map(r=>({id:'MAP-'+r.id,recordId:r.id,type:r.type,local:r.correctedLocal||r.local,vertices:r.vertices,icon:r.icon,label:r.name||r.category||r.code||r.id}));const wr=app.base.filter(r=>recWeek(r)===ymd(weekStart(app.settings.selectedAt)));app.weeklyView=wr.map(r=>({id:'WEEK-'+r.id,recordId:r.id,type:r.type,day:recDate(r),title:r.name||r.category||r.routeId||r.areaId||r.code,metrics:r.metrics||{},address:r.address||''}))}

async function saveSettings(){return put('settings',{id:'settings',settings:app.settings,crs:app.crs,camera:app.camera})}

async function reverse(lat,lng){if(!navigator.onLine)return'';try{const r=await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lng)}`);if(!r.ok)return'';const j=await r.json();return j.display_name||''}catch{return''}}
async function refreshAddresses(){for(const r of app.base){if(r.type==='point'&&!r.address){const w=r.correctedWgs||r.wgs||localToWgs(r.correctedLocal.x,r.correctedLocal.y,r.correctedLocal.z);r.address=await reverse(w.lat,w.lng);await put('base',r)}}buildViews();renderAll();toast('Address refresh complete where possible.')}
function inRangeRecords(range){const old=app.settings.viewMode;app.settings.viewMode=range;const rows=visibleRecords();app.settings.viewMode=old;return rows}
function exportGeoJSON(range,mode){const rows=inRangeRecords(range);return JSON.stringify({type:'FeatureCollection',metadata:{range,mode,exportedAt:new Date().toISOString()},features:rows.map(r=>featureOf(r,mode))},null,2)}
function featureOf(r,mode){const pointCoord=(l)=>{const w=mode==='historical'?(r.wgs||r.rawWgs||localToWgs(l.x,l.y,l.z)):(r.correctedWgs||localToWgs(l.x,l.y,l.z));return[w.lng,w.lat,w.alt||0]};let geom;if(r.type==='point')geom={type:'Point',coordinates:pointCoord(r.correctedLocal||r.local)};else{const cs=r.vertices.map(v=>{const l=mode==='historical'?(v.local||v.correctedLocal):(v.correctedLocal||v.local);const w=mode==='historical'?(v.rawWgs||v.wgs||localToWgs(l.x,l.y,l.z)):(v.correctedWgs||localToWgs(l.x,l.y,l.z));return[w.lng,w.lat,w.alt||0]});geom={type:r.type==='area'?'Polygon':'LineString',coordinates:r.type==='area'?[cs.concat([cs[0]])]:cs}}return{type:'Feature',geometry:geom,properties:{id:r.id,code:r.code,type:r.type,name:r.name,address:r.address,metrics:r.metrics,time:r.time,mode}}}
function exportKML(range,mode){const gj=JSON.parse(exportGeoJSON(range,mode));return `<?xml version="1.0" encoding="UTF-8"?><kml xmlns="http://www.opengis.net/kml/2.2"><Document>${gj.features.map(f=>`<Placemark><name>${esc(f.properties.name||f.properties.code||f.properties.id)}</name><description>${esc(f.properties.address||'')}</description>${kmlGeom(f.geometry)}</Placemark>`).join('')}</Document></kml>`}
function kmlGeom(g){if(g.type==='Point')return`<Point><coordinates>${g.coordinates.join(',')}</coordinates></Point>`;const coords=(g.type==='Polygon'?g.coordinates[0]:g.coordinates).map(c=>c.join(',')).join(' ');return g.type==='Polygon'?`<Polygon><outerBoundaryIs><LinearRing><coordinates>${coords}</coordinates></LinearRing></outerBoundaryIs></Polygon>`:`<LineString><coordinates>${coords}</coordinates></LineString>`}

export { openDb, store, all, put, del, clearStore, loadDb, visibleRecords, buildViews, saveSettings, reverse, refreshAddresses, inRangeRecords, exportGeoJSON, featureOf, exportKML, kmlGeom };
Object.assign(globalThis.PSJModules.storage = {}, { openDb, store, all, put, del, clearStore, loadDb, visibleRecords, buildViews, saveSettings, reverse, refreshAddresses, inRangeRecords, exportGeoJSON, featureOf, exportKML, kmlGeom });
for (const [name, value] of Object.entries(globalThis.PSJModules.storage)) expose(name, value);

