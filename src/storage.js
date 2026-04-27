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
async function loadDb(){app.base=await all('base');app.tempGnss=await all('tempGnss');app.controlPoints=await all('controlPoints');app.correctionLog=await all('correctionLog');const av=(await all('avatarView'))[0];if(av)app.avatarView={...app.avatarView,...av};const s=(await all('settings'))[0];if(s){app.settings={...app.settings,...s.settings};app.crs=s.crs||app.crs;app.camera=s.camera||app.camera;if(Array.isArray(s.smartIcons))app.smartIcons=s.smartIcons}buildViews()}

function visibleRecords(){const d=safeDate(app.settings.selectedAt),m=app.settings.viewMode;return app.base.filter(r=>{const rd=recDate(r);if(m==='day')return rd===ymd(d);if(m==='week')return recWeek(r)===ymd(weekStart(d));if(m==='month')return rd.startsWith(ymd(d).slice(0,7));if(m==='year')return rd.startsWith(String(d.getFullYear()));return true})}
function buildViews(){app.mapView=visibleRecords().map(r=>({id:'MAP-'+r.id,recordId:r.id,type:r.type,local:r.correctedLocal||r.local,vertices:r.vertices,icon:r.icon,label:r.name||r.category||r.code||r.id}));const wr=app.base.filter(r=>recWeek(r)===ymd(weekStart(app.settings.selectedAt)));app.weeklyView=wr.map(r=>({id:'WEEK-'+r.id,recordId:r.id,type:r.type,day:recDate(r),title:r.name||r.category||r.routeId||r.areaId||r.code,metrics:r.metrics||{},address:r.address||''}))}

async function saveSettings(){return put('settings',{id:'settings',settings:app.settings,crs:app.crs,camera:app.camera,smartIcons:app.smartIcons})}

export { openDb, store, all, put, del, clearStore, loadDb, visibleRecords, buildViews, saveSettings };
Object.assign(globalThis.PSJModules.storage = {}, { openDb, store, all, put, del, clearStore, loadDb, visibleRecords, buildViews, saveSettings });
for (const [name, value] of Object.entries(globalThis.PSJModules.storage)) expose(name, value);

