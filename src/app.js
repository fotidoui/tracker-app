import './geometry.js';
import './storage.js';
import './solver.js';
import './rendering.js';
import './ui.js';
import './commands.js';

'use strict';
const $=id=>document.getElementById(id);
const ui={canvas:$('map'),info1:$('infoLine1'),info2:$('infoLine2'),scaleLabel:$('scaleLabel'),viewBtn:$('viewBtn'),addBtn:$('toolAdd'),designBtn:$('toolDesign'),selectBtn:$('toolSelect'),measureBtn:$('toolMeasure'),pathBtn:$('toolPath'),followBtn:$('followBtn'),pinBtn:$('pinBtn'),zoomIn:$('zoomInBtn'),zoomOut:$('zoomOutBtn'),fit:$('fitBtn'),fitSel:$('fitSelBtn'),layersBtn:$('layersBtn'),papyrus:$('papyrusRoll'),viewPop:$('viewPop'),addPop:$('addPop'),designPop:$('designPop'),selectPop:$('selectPop'),layersPop:$('layersPop'),dateChooser:$('dateChooser'),cmdMenu:$('cmdMenu'),toast:$('toast'),hub:$('compassHub'),leveler:$('levelerHub'),levelerBubble:$('levelerBubble2'),arcBase:$('arcBase'),arcWeekly:$('arcWeekly'),arcSettings:$('arcSettings'),northNeedle:$('northNeedle'),headingNeedle:$('headingNeedle'),bubble:$('levelBubble'),panel:$('panel'),panelTitle:$('panelTitle'),panelBody:$('panelBody'),panelClose:$('panelClose'),dialog:$('recordDialog'),recordTitle:$('recordTitle'),recordBody:$('recordBody'),recordCancel:$('recordCancelBtn'),recordSave:$('recordSaveBtn')};
const ctx=ui.canvas.getContext('2d');
const R=6378137, PHONE_HEIGHT_OFFSET_M=1, DB_NAME='PSJ_v75_cyber_voronoi_origin';
const app={db:null,base:[],tempGnss:[],controlPoints:[],correctionLog:[],avatarView:{id:'avatar',rawLocal:null,estimatedLocal:{x:0,y:0,z:0},correctedLocal:{x:0,y:0,z:0},rawWgs:null,correctedWgs:null,accuracy:null,confidence:.1,heading:0,solver:'provisional-origin',updatedAt:new Date().toISOString()},mapView:[],weeklyView:[],settings:{selectedAt:new Date().toISOString(),viewMode:'week',gnssInterval:5,routeInterval:10,scaleRing:10},crs:{origin:{lat:0,lng:0,alt:0},originInitialized:false,falseEasting:0,falseNorthing:0,falseUp:0,scale:1},camera:{x:0,y:0,z:1},follow:true,layers:{trail:true,controls:true,objects:true,routes:true,areas:true},active:null,mode:null,selectMode:null,selected:new Set(),pointer:null,arcOpen:false,toolArcOpen:false,stationary:{samples:[],locked:null},lastSolved:null,lastGoodHeading:0,orientation:{alpha:null,beta:0,gamma:0,source:'none'},addressQueue:[],renderDbDirty:true,command:{kind:null,type:null,source:null,circle:null},selectBox:null,smartIcons:[{name:'Note',icon:'✦'},{name:'Church',icon:'✚'},{name:'Stadium',icon:'◎'},{name:'Home',icon:'⌂'},{name:'Work',icon:'▣'},{name:'Gym',icon:'◆'},{name:'Cafe',icon:'☕'},{name:'Tree',icon:'♧'},{name:'Object',icon:'◈'},{name:'Custom',icon:'✧'}],radiusPresets:[1,2,5,10,25,50]};

globalThis.$ = $;
globalThis.ui = ui;
globalThis.ctx = ctx;
globalThis.R = R;
globalThis.PHONE_HEIGHT_OFFSET_M = PHONE_HEIGHT_OFFSET_M;
globalThis.DB_NAME = DB_NAME;
globalThis.app = app;

async function boot(){resize();setup();draw();renderLoop();try{await openDb();await loadDb()}catch(e){console.warn('DB startup failed, fallback active',e)}resize();startGpsLoop()}
boot().catch(e=>{console.error('Startup error:',e);globalThis.toast?.('Startup error: '+(e.message||e),5000)});


