globalThis.PSJModules = globalThis.PSJModules || {};
const expose = (name, value) => {
  globalThis[name] = value;
  globalThis.PSJModules = globalThis.PSJModules || {};
  return value;
};
function esc(s=''){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function id(p){return p+'-'+Date.now()+'-'+Math.random().toString(36).slice(2,8)}
function safeDate(v){const d=v instanceof Date?v:new Date(v||Date.now());return Number.isFinite(d.getTime())?d:new Date()}
function ymd(v){const d=safeDate(v);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`}
function weekStart(v){const d=safeDate(v);const n=(d.getDay()+6)%7;d.setDate(d.getDate()-n);d.setHours(0,0,0,0);return d}
function addDays(v,n){const d=safeDate(v);d.setDate(d.getDate()+n);return d}
function weekNo(v){const d=new Date(Date.UTC(safeDate(v).getFullYear(),safeDate(v).getMonth(),safeDate(v).getDate()));d.setUTCDate(d.getUTCDate()+4-(d.getUTCDay()||7));const y=new Date(Date.UTC(d.getUTCFullYear(),0,1));return Math.ceil((((d-y)/86400000)+1)/7)}
function isoLocal(v){const d=safeDate(v);d.setMinutes(d.getMinutes()-d.getTimezoneOffset());return d.toISOString().slice(0,16)}
function recDate(r){return (r.time?.eventAt||r.createdAt||'').slice(0,10)}
function recWeek(r){return ymd(weekStart(recDate(r)))}
function ensureCrsOriginFromWgs(lat,lng,groundAlt=0){if(!app.crs.originInitialized){app.crs.origin={lat:Number(lat)||0,lng:Number(lng)||0,alt:Number(groundAlt)||0};app.crs.originInitialized=true;app.crs.falseEasting=0;app.crs.falseNorthing=0;app.camera.x=0;app.camera.y=0;}}
function normalizedPhoneAlt(alt){const n=Number(alt);if(Number.isFinite(n))return n;const av=app.avatarView?.correctedWgs?.alt;return Number.isFinite(Number(av))?Number(av)+PHONE_HEIGHT_OFFSET_M:PHONE_HEIGHT_OFFSET_M}
function wgsToLocal(lat,lng,alt=0){const phoneAlt=normalizedPhoneAlt(alt),groundAlt=phoneAlt-PHONE_HEIGHT_OFFSET_M;ensureCrsOriginFromWgs(lat,lng,groundAlt);const o=app.crs.origin,s=app.crs.scale;return{x:app.crs.falseEasting+R*(lng-o.lng)*Math.PI/180*Math.cos(o.lat*Math.PI/180)*s,y:app.crs.falseNorthing+R*(lat-o.lat)*Math.PI/180*s,z:groundAlt-(o.alt||0)}}
function localToWgs(x,y,z=app.crs.falseUp){const o=app.crs.origin||{lat:0,lng:0,alt:0},s=app.crs.scale;return{lat:o.lat+((y-app.crs.falseNorthing)/(R*s))*180/Math.PI,lng:o.lng+((x-app.crs.falseEasting)/(R*Math.cos(o.lat*Math.PI/180||1)*s))*180/Math.PI,alt:(Number.isFinite(Number(z))?Number(z):0)+(o.alt||0)}}
function estimateGroundZForLocal(local){const near=app.controlPoints.map(cp=>{const d=Math.max(1,distanceLocal(local,cp.personalLocal||local));const sigma=Math.max(1,cp.sigmaM||5);const conf=cp.confidence||.2;return{z:(cp.personalLocal?.z??0),w:conf/(sigma*sigma*d*d)}}).filter(x=>Number.isFinite(x.z)&&x.w>0).sort((a,b)=>b.w-a.w).slice(0,6);const sw=near.reduce((a,b)=>a+b.w,0);if(sw>0)return near.reduce((a,b)=>a+b.z*b.w,0)/sw;const avz=app.avatarView?.correctedLocal?.z;return Number.isFinite(Number(avz))?Number(avz):0}
function localToScreen(x,y){const r=ui.canvas.getBoundingClientRect();return{x:(x-app.camera.x)*app.camera.z+r.width/2,y:r.height/2-(y-app.camera.y)*app.camera.z}}
function screenToLocal(px,py){const r=ui.canvas.getBoundingClientRect();const base={x:app.camera.x+(px-r.width/2)/app.camera.z,y:app.camera.y+(r.height/2-py)/app.camera.z,z:0};base.z=estimateGroundZForLocal(base);return base}
function distanceLocal(a,b){const dx=(b.x-a.x),dy=(b.y-a.y),dz=(b.z||0)-(a.z||0);return Math.sqrt(dx*dx+dy*dy+dz*dz)}
function distanceM(a,b){const rad=x=>x*Math.PI/180;const dlat=rad(b.lat-a.lat),dlng=rad(b.lng-a.lng),q=Math.sin(dlat/2)**2+Math.cos(rad(a.lat))*Math.cos(rad(b.lat))*Math.sin(dlng/2)**2;return 6371000*2*Math.asin(Math.sqrt(q))}
function bearingWgs(a,b){const phi1=a.lat*Math.PI/180,phi2=b.lat*Math.PI/180,lambda=(b.lng-a.lng)*Math.PI/180;const y=Math.sin(lambda)*Math.cos(phi2),x=Math.cos(phi1)*Math.sin(phi2)-Math.sin(phi1)*Math.cos(phi2)*Math.cos(lambda);return (Math.atan2(y,x)*180/Math.PI+360)%360}
function angleLerp(a,b,t){let d=((b-a+540)%360)-180;return (a+d*t+360)%360}
function fmtM(m){if(m<1)return `${Math.round(m*100)} cm`;if(m<1000)return `${m.toFixed(m<10?1:0)} m`;return `${(m/1000).toFixed(1)} km`}
function typePrefix(t){return({point:'01',route:'03',area:'04',control:'07'}[t]||'99')}
function makeCode(t,dt=new Date().toISOString()){const d=safeDate(dt),mm=String(d.getMonth()+1).padStart(2,'0'),yy=String(d.getFullYear()).slice(-2);const n=app.base.filter(r=>r.type===t&&safeDate(r.time?.eventAt).getMonth()===d.getMonth()&&safeDate(r.time?.eventAt).getFullYear()===d.getFullYear()).length+1;return `${typePrefix(t)}-${String(n).padStart(3,'0')}-${mm}-${yy}`}

function sameSegment(a,b){return (a.segment||1)===(b.segment||1)}
function metricsRoute(v){let d=0,raw=0;for(let i=1;i<v.length;i++){if(!sameSegment(v[i-1],v[i]))continue;d+=distanceLocal(v[i-1].correctedLocal||v[i-1].local,v[i].correctedLocal||v[i].local);if(v[i-1].rawWgs&&v[i].rawWgs)raw+=distanceM(v[i-1].rawWgs,v[i].rawWgs)}return{distanceM:d,rawDistanceM:raw,vertexCount:v.length}}
function areaM2(v){if(v.length<3)return 0;let a=0;for(let i=0;i<v.length;i++){const p=v[i].correctedLocal||v[i].local,q=v[(i+1)%v.length].correctedLocal||v[(i+1)%v.length].local;a+=p.x*q.y-q.x*p.y}return Math.abs(a/2)}
function vertexFromLocal(local,source='design'){const w=localToWgs(local.x,local.y,local.z);return{id:id('V'),source,local,correctedLocal:{...local},rawWgs:w,correctedWgs:w,capturedAt:new Date().toISOString()}}
function vertexFromAvatar(){const l=app.avatarView.correctedLocal,w=app.avatarView.correctedWgs||localToWgs(l.x,l.y,l.z);return{id:id('V'),source:'add-avatar',local:{...l},correctedLocal:{...l},rawWgs:app.avatarView.rawWgs||w,correctedWgs:w,capturedAt:new Date().toISOString()}}

function circleFrom3(p1,p2,p3){const A=p2.x-p1.x,B=p2.y-p1.y,C=p3.x-p1.x,D=p3.y-p1.y,E=A*(p1.x+p2.x)+B*(p1.y+p2.y),F=C*(p1.x+p3.x)+D*(p1.y+p3.y),G=2*(A*(p3.y-p2.y)-B*(p3.x-p2.x));if(Math.abs(G)<1e-9)return null;const x=(D*E-B*F)/G,y=(A*F-C*E)/G;return{x,y,z:(p1.z+p2.z+p3.z)/3,r:Math.hypot(x-p1.x,y-p1.y)}}


export { esc, id, safeDate, ymd, weekStart, addDays, weekNo, isoLocal, recDate, recWeek, ensureCrsOriginFromWgs, normalizedPhoneAlt, wgsToLocal, localToWgs, estimateGroundZForLocal, localToScreen, screenToLocal, distanceLocal, distanceM, bearingWgs, angleLerp, fmtM, typePrefix, makeCode, sameSegment, metricsRoute, areaM2, vertexFromLocal, vertexFromAvatar, circleFrom3 };
Object.assign(globalThis.PSJModules.geometry = {}, { esc, id, safeDate, ymd, weekStart, addDays, weekNo, isoLocal, recDate, recWeek, ensureCrsOriginFromWgs, normalizedPhoneAlt, wgsToLocal, localToWgs, estimateGroundZForLocal, localToScreen, screenToLocal, distanceLocal, distanceM, bearingWgs, angleLerp, fmtM, typePrefix, makeCode, sameSegment, metricsRoute, areaM2, vertexFromLocal, vertexFromAvatar, circleFrom3 });
for (const [name, value] of Object.entries(globalThis.PSJModules.geometry)) expose(name, value);

