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
function pointOf(v,options={}){return geometryPoint(v,options)}
function geometryPoint(v,options={}){
  if(!v)return v;
  if(options.mode==='live'||options.mode==='current'){
    const raw=v.rawLocal||v.local||v;
    const corrector=typeof options.corrector==='function'?options.corrector:globalThis.correctedLocalFor;
    if(typeof corrector==='function'){
      const solved=corrector(raw,options.controlPoints||globalThis.app?.controlPoints||[]);
      if(solved?.correctedLocal)return solved.correctedLocal;
      if(solved?.x!==undefined)return solved;
    }
  }
  return v?.correctedLocal||v?.local||v;
}
function geometryVertex(v,options={}){return{...v,correctedLocal:geometryPoint(v,options)}}
function geometryVertices(vertices,options={}){return(vertices||[]).map(v=>geometryVertex(v,options))}
function zOf(p){return Number.isFinite(Number(p?.z))?Number(p.z):0}
function distanceXY(a,b,options={}){const p=pointOf(a,options),q=pointOf(b,options),dx=(q.x-p.x),dy=(q.y-p.y);return Math.sqrt(dx*dx+dy*dy)}
function distanceXYZ(a,b,options={}){const p=pointOf(a,options),q=pointOf(b,options),dz=zOf(q)-zOf(p);return Math.sqrt(distanceXY(p,q)**2+dz*dz)}
function slopeDistance(a,b,options={}){return distanceXYZ(a,b,options)}
function distanceBetween(a,b,mode='3d',options={}){if(typeof mode==='object'){options=mode;mode=options.distanceMode||'3d'}if(mode==='xy'||mode==='2d'||mode==='horizontal')return distanceXY(a,b,options);if(mode==='slope')return slopeDistance(a,b,options);return distanceXYZ(a,b,options)}
function distanceLocal(a,b){return distanceXYZ(a,b)}
function distanceM(a,b){const rad=x=>x*Math.PI/180;const dlat=rad(b.lat-a.lat),dlng=rad(b.lng-a.lng),q=Math.sin(dlat/2)**2+Math.cos(rad(a.lat))*Math.cos(rad(b.lat))*Math.sin(dlng/2)**2;return 6371000*2*Math.asin(Math.sqrt(q))}
function bearingWgs(a,b){const phi1=a.lat*Math.PI/180,phi2=b.lat*Math.PI/180,lambda=(b.lng-a.lng)*Math.PI/180;const y=Math.sin(lambda)*Math.cos(phi2),x=Math.cos(phi1)*Math.sin(phi2)-Math.sin(phi1)*Math.cos(phi2)*Math.cos(lambda);return (Math.atan2(y,x)*180/Math.PI+360)%360}
function angleLerp(a,b,t){let d=((b-a+540)%360)-180;return (a+d*t+360)%360}
function fmtM(m){if(m<1)return `${Math.round(m*100)} cm`;if(m<1000)return `${m.toFixed(m<10?1:0)} m`;return `${(m/1000).toFixed(1)} km`}
function typePrefix(t){return({point:'01',route:'03',area:'04',control:'07'}[t]||'99')}
function makeCode(t,dt=new Date().toISOString()){const d=safeDate(dt),mm=String(d.getMonth()+1).padStart(2,'0'),yy=String(d.getFullYear()).slice(-2);const n=app.base.filter(r=>r.type===t&&safeDate(r.time?.eventAt).getMonth()===d.getMonth()&&safeDate(r.time?.eventAt).getFullYear()===d.getFullYear()).length+1;return `${typePrefix(t)}-${String(n).padStart(3,'0')}-${mm}-${yy}`}

function sameSegment(a,b){return (a.segment||1)===(b.segment||1)}
function normalizePolylineSegments(input){
  if(!Array.isArray(input))return[];
  if(input.length&&Array.isArray(input[0]?.vertices))return input.map((s,i)=>({id:s.id??i+1,resumeFrom:s.resumeFrom??null,vertices:[...(s.vertices||[])]}));
  const segments=[];
  for(const vertex of input){
    const segId=vertex?.segment||1;
    let seg=segments.find(s=>s.id===segId);
    if(!seg){seg={id:segId,resumeFrom:null,vertices:[]};segments.push(seg)}
    seg.vertices.push(vertex);
  }
  return segments;
}
function polylineLength(input,mode='3d',options={}){if(typeof mode==='object'){options=mode;mode=options.distanceMode||'3d'}return normalizePolylineSegments(input).reduce((sum,seg)=>sum+seg.vertices.reduce((d,v,i,a)=>i?d+distanceBetween(a[i-1],v,mode,options):d,0),0)}
function polylineLength2D(input,options={}){return polylineLength(input,'xy',options)}
function polylineLength3D(input,options={}){return polylineLength(input,'3d',options)}
function polylineMetrics(input,options={}){const segments=normalizePolylineSegments(input),out={segments,length2D:polylineLength2D(segments,options),length3D:polylineLength3D(segments,options),vertexCount:segments.reduce((n,s)=>n+s.vertices.length,0)};if(options.mode)out.mode=options.mode;return out}
function metricsRoute(v,options={}){let raw=0;for(let i=1;i<v.length;i++){if(!sameSegment(v[i-1],v[i]))continue;if(v[i-1].rawWgs&&v[i].rawWgs)raw+=distanceM(v[i-1].rawWgs,v[i].rawWgs)}const metrics=polylineMetrics(v,options),out={distanceM:metrics.length3D,distance2DM:metrics.length2D,rawDistanceM:raw,vertexCount:metrics.vertexCount,segmentCount:metrics.segments.length};if(options.mode)out.mode=options.mode;return out}
function signedArea2D(v,options={}){if(v.length<3)return 0;let a=0;for(let i=0;i<v.length;i++){const p=pointOf(v[i],options),q=pointOf(v[(i+1)%v.length],options);a+=p.x*q.y-q.x*p.y}return a/2}
function areaM2(v,options={}){return Math.abs(signedArea2D(v,options))}
function captureMetadata(solved={},capturedAt=new Date().toISOString()){return{timestamp:capturedAt,capturedAt,solverVersion:solved.solverVersion||solved.solver||'manual',controlSnapshotId:solved.controlSnapshotId||null,controlSnapshot:solved.controlSnapshot||null}}
function vertexFromLocal(local,source='design',options={}){const raw=options.rawLocal||local,corrected=options.correctedLocal||local,capturedAt=options.capturedAt||new Date().toISOString(),rawWgs=options.rawWgs||localToWgs(raw.x,raw.y,raw.z),correctedWgs=options.correctedWgs||localToWgs(corrected.x,corrected.y,corrected.z);return{id:id('V'),source,local:{...raw},rawLocal:{...raw},correctedLocal:{...corrected},rawWgs,correctedWgs,...captureMetadata(options,capturedAt)}}
function vertexFromAvatar(){const l=app.avatarView.correctedLocal,raw=app.avatarView.rawLocal||l,w=app.avatarView.correctedWgs||localToWgs(l.x,l.y,l.z);return vertexFromLocal(raw,'add-avatar',{rawLocal:raw,correctedLocal:l,rawWgs:app.avatarView.rawWgs||localToWgs(raw.x,raw.y,raw.z),correctedWgs:w,capturedAt:app.avatarView.updatedAt||new Date().toISOString(),solverVersion:app.avatarView.solverVersion||app.avatarView.solver||'avatar',controlSnapshotId:app.avatarView.controlSnapshotId||null,controlSnapshot:app.avatarView.controlSnapshot||null})}

function createCircleCenterRadius(center,radius){if(!(radius>0))return null;return{center:{...center},x:center.x,y:center.y,z:zOf(center),r:radius,radius}}
function circleFrom3(p1,p2,p3,options={}){p1=pointOf(p1,options);p2=pointOf(p2,options);p3=pointOf(p3,options);const A=p2.x-p1.x,B=p2.y-p1.y,C=p3.x-p1.x,D=p3.y-p1.y,E=A*(p1.x+p2.x)+B*(p1.y+p2.y),F=C*(p1.x+p3.x)+D*(p1.y+p3.y),G=2*(A*(p3.y-p2.y)-B*(p3.x-p2.x));if(Math.abs(G)<1e-9)return null;const x=(D*E-B*F)/G,y=(A*F-C*E)/G;return{x,y,z:(zOf(p1)+zOf(p2)+zOf(p3))/3,r:Math.hypot(x-p1.x,y-p1.y),radius:Math.hypot(x-p1.x,y-p1.y),center:{x,y,z:(zOf(p1)+zOf(p2)+zOf(p3))/3},mode:options.mode||'historical'}}
function circleFrom2Radius(p1,p2,radius,options={}){p1=pointOf(p1,options);p2=pointOf(p2,options);if(!(radius>0))return null;const chord=distanceXY(p1,p2);if(chord===0||chord>2*radius+1e-9)return null;const mid={x:(p1.x+p2.x)/2,y:(p1.y+p2.y)/2,z:(zOf(p1)+zOf(p2))/2};const half=chord/2,h=Math.sqrt(Math.max(0,radius*radius-half*half));const ux=-(p2.y-p1.y)/chord,uy=(p2.x-p1.x)/chord;const centers=[{x:mid.x+ux*h,y:mid.y+uy*h,z:mid.z},{x:mid.x-ux*h,y:mid.y-uy*h,z:mid.z}];return{centers:centers.map(c=>createCircleCenterRadius(c,radius)),radius,chord,mode:options.mode||'historical'}}
function interpolatePoint(a,b,t,options={}){const p=pointOf(a,options),q=pointOf(b,options),clamped=options.clamp===false?Number(t):Math.max(0,Math.min(1,Number(t)));const out={x:p.x+(q.x-p.x)*clamped,y:p.y+(q.y-p.y)*clamped,z:zOf(p)+(zOf(q)-zOf(p))*clamped};return typeof options.transform==='function'?options.transform(out,{from:p,to:q,t:clamped,controlPoints:options.controlPoints||[]}):out}


export { esc, id, safeDate, ymd, weekStart, addDays, weekNo, isoLocal, recDate, recWeek, ensureCrsOriginFromWgs, normalizedPhoneAlt, wgsToLocal, localToWgs, estimateGroundZForLocal, localToScreen, screenToLocal, pointOf, geometryPoint, geometryVertex, geometryVertices, distanceXY, distanceXYZ, slopeDistance, distanceBetween, distanceLocal, distanceM, bearingWgs, angleLerp, fmtM, typePrefix, makeCode, sameSegment, normalizePolylineSegments, polylineLength, polylineLength2D, polylineLength3D, polylineMetrics, metricsRoute, signedArea2D, areaM2, captureMetadata, vertexFromLocal, vertexFromAvatar, createCircleCenterRadius, circleFrom3, circleFrom2Radius, interpolatePoint };
Object.assign(globalThis.PSJModules.geometry = {}, { esc, id, safeDate, ymd, weekStart, addDays, weekNo, isoLocal, recDate, recWeek, ensureCrsOriginFromWgs, normalizedPhoneAlt, wgsToLocal, localToWgs, estimateGroundZForLocal, localToScreen, screenToLocal, pointOf, geometryPoint, geometryVertex, geometryVertices, distanceXY, distanceXYZ, slopeDistance, distanceBetween, distanceLocal, distanceM, bearingWgs, angleLerp, fmtM, typePrefix, makeCode, sameSegment, normalizePolylineSegments, polylineLength, polylineLength2D, polylineLength3D, polylineMetrics, metricsRoute, signedArea2D, areaM2, captureMetadata, vertexFromLocal, vertexFromAvatar, createCircleCenterRadius, circleFrom3, circleFrom2Radius, interpolatePoint });
for (const [name, value] of Object.entries(globalThis.PSJModules.geometry)) expose(name, value);

