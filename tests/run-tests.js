import assert from 'node:assert/strict';
import {
  areaM2,
  circleFrom3,
  distanceLocal,
  localToWgs,
  metricsRoute,
  wgsToLocal
} from '../src/geometry.js';
import {
  addVertex,
  activeContextActions,
  applyCircleRadius,
  beginCircleCommand,
  cancelActive,
  commandPrimaryClick,
  finishActive,
  handleCircleClick,
  pauseActive,
  resumeActive,
  selectionContextActions,
  setTool,
  startElement
} from '../src/commands.js';

const tests = [];
const test = (name, fn) => tests.push({ name, fn });

function resetGeometryApp() {
  globalThis.R = 6378137;
  globalThis.PHONE_HEIGHT_OFFSET_M = 1;
  globalThis.app = {
    base: [],
    controlPoints: [],
    avatarView: { correctedLocal: { x: 0, y: 0, z: 0 }, correctedWgs: null },
    crs: {
      origin: { lat: 0, lng: 0, alt: 0 },
      originInitialized: false,
      falseEasting: 0,
      falseNorthing: 0,
      falseUp: 0,
      scale: 1
    },
    camera: { x: 0, y: 0, z: 1 }
  };
}

function resetCommandHarness() {
  globalThis.R = 6378137;
  globalThis.PHONE_HEIGHT_OFFSET_M = 1;
  globalThis.app = {
    base: [],
    controlPoints: [],
    avatarView: {
      confidence: 0.5,
      correctedLocal: { x: 100, y: 200, z: 3 },
      correctedWgs: { lat: 1, lng: 2, alt: 3 },
      rawWgs: { lat: 1, lng: 2, alt: 4 }
    },
    crs: {
      origin: { lat: 1, lng: 2, alt: 0 },
      originInitialized: true,
      falseEasting: 0,
      falseNorthing: 0,
      falseUp: 0,
      scale: 1
    },
    camera: { x: 0, y: 0, z: 1 },
    command: { circle: { method: 'three', points: [] } },
    mode: null,
    active: null,
    selected: new Set(),
    selectMode: null,
    smartIcons: [{ name: 'Note', icon: '*' }],
    radiusPresets: [1, 2, 5]
  };
  globalThis.putCalls = [];
  globalThis.toasts = [];
  globalThis.put = (store, value) => {
    globalThis.putCalls.push({ store, value });
    return Promise.resolve(value);
  };
  globalThis.buildViews = () => {};
  globalThis.renderAll = () => {};
  globalThis.toast = (message) => globalThis.toasts.push(message);
  globalThis.closePops = () => {};
  globalThis.pulse = () => {};
  globalThis.selectNearestCalls = [];
  globalThis.selectNearest = (local) => globalThis.selectNearestCalls.push(local);
  delete globalThis.ui;
}

function installPointDialogUi() {
  const smartButtons = [{ dataset: { smart: '0' }, onclick: null }];
  globalThis.dialogShows = 0;
  globalThis.ui = {
    recordTitle: { textContent: '' },
    recordBody: {
      value: '',
      set innerHTML(value) { this.value = value; },
      get innerHTML() { return this.value; },
      querySelectorAll(selector) {
        return selector === '[data-smart]' ? smartButtons : [];
      }
    },
    recordCancel: { onclick: null },
    recordSave: { style: { display: '' } },
    dialog: {
      close() {},
      showModal() { globalThis.dialogShows += 1; }
    },
    leveler: {}
  };
  return smartButtons;
}

test('distanceLocal includes z distance', () => {
  assert.equal(distanceLocal({ x: 0, y: 0, z: 0 }, { x: 3, y: 4, z: 12 }), 13);
});

test('areaM2 calculates polygon area from corrected vertices', () => {
  const square = [
    { correctedLocal: { x: 0, y: 0 } },
    { correctedLocal: { x: 10, y: 0 } },
    { correctedLocal: { x: 10, y: 10 } },
    { correctedLocal: { x: 0, y: 10 } }
  ];
  assert.equal(areaM2(square), 100);
});

test('metricsRoute accumulates corrected and raw distances', () => {
  const route = [
    { correctedLocal: { x: 0, y: 0, z: 0 } },
    { correctedLocal: { x: 3, y: 4, z: 0 } },
    { correctedLocal: { x: 6, y: 8, z: 0 } }
  ];
  assert.deepEqual(metricsRoute(route), { distanceM: 10, rawDistanceM: 0, vertexCount: 3 });
});

test('metricsRoute excludes paused segment gaps', () => {
  const route = [
    { segment: 1, correctedLocal: { x: 0, y: 0, z: 0 } },
    { segment: 1, correctedLocal: { x: 3, y: 4, z: 0 } },
    { segment: 2, correctedLocal: { x: 103, y: 104, z: 0 } },
    { segment: 2, correctedLocal: { x: 106, y: 108, z: 0 } }
  ];
  assert.equal(metricsRoute(route).distanceM, 10);
});

test('circleFrom3 returns center and radius for non-collinear points', () => {
  const circle = circleFrom3(
    { x: 1, y: 0, z: 0 },
    { x: 0, y: 1, z: 3 },
    { x: -1, y: 0, z: 6 }
  );
  assert.ok(circle);
  assert.ok(Math.abs(circle.x) < 1e-9);
  assert.ok(Math.abs(circle.y) < 1e-9);
  assert.ok(Math.abs(circle.r - 1) < 1e-9);
  assert.equal(circle.z, 3);
});

test('circleFrom3 rejects nearly collinear points', () => {
  assert.equal(circleFrom3({ x: 0, y: 0, z: 0 }, { x: 1, y: 1, z: 0 }, { x: 2, y: 2, z: 0 }), null);
});

test('wgsToLocal and localToWgs round trip against initialized CRS', () => {
  resetGeometryApp();
  const local = wgsToLocal(37.98, 23.72, 101);
  const wgs = localToWgs(local.x, local.y, local.z);
  assert.ok(Math.abs(wgs.lat - 37.98) < 1e-10);
  assert.ok(Math.abs(wgs.lng - 23.72) < 1e-10);
  assert.equal(wgs.alt, 100);
});

test('startElement initializes active route command state', () => {
  resetCommandHarness();
  startElement('route', 'design', { x: 1, y: 2, z: 3 });

  assert.equal(app.mode, 'design-route');
  assert.equal(app.active.type, 'route');
  assert.equal(app.active.source, 'design');
  assert.equal(app.active.vertices.length, 1);
  assert.equal(app.active.paused, false);
  assert.equal(app.active.segment, 1);
});

test('design point resolves clicked canvas coordinates before smart icon selector opens', () => {
  resetCommandHarness();
  installPointDialogUi();
  app.mode = 'design-point';

  commandPrimaryClick({ x: 7, y: 8, z: 9 });

  assert.equal(globalThis.dialogShows, 1);
  assert.match(ui.recordBody.innerHTML, /X 7\.000/);
  assert.doesNotMatch(ui.recordBody.innerHTML, /X 100\.000/);
  assert.equal(app.mode, null);
});

test('add point resolves current avatar coordinates before smart icon selector opens', () => {
  resetCommandHarness();
  installPointDialogUi();
  app.mode = 'add-point';

  commandPrimaryClick({ x: 7, y: 8, z: 9 });

  assert.equal(globalThis.dialogShows, 1);
  assert.match(ui.recordBody.innerHTML, /X 100\.000/);
  assert.equal(app.mode, null);
});

test('point selector does not open until primary click resolves source', () => {
  resetCommandHarness();
  installPointDialogUi();

  setTool('design', 'point');

  assert.equal(globalThis.dialogShows, 0);
  assert.equal(app.mode, 'design-point');
});

test('primary clicks build design line vertices from clicked coordinates', () => {
  resetCommandHarness();
  app.mode = 'design-route';

  commandPrimaryClick({ x: 1, y: 2, z: 3 });
  commandPrimaryClick({ x: 4, y: 6, z: 3 });

  assert.equal(app.active.type, 'route');
  assert.equal(app.active.vertices.length, 2);
  assert.deepEqual(app.active.vertices[0].correctedLocal, { x: 1, y: 2, z: 3 });
  assert.deepEqual(app.active.vertices[1].correctedLocal, { x: 4, y: 6, z: 3 });
});

test('primary clicks build add line vertices from avatar coordinates', () => {
  resetCommandHarness();
  app.mode = 'add-route';

  commandPrimaryClick({ x: 1, y: 2, z: 3 });
  app.avatarView.correctedLocal = { x: 110, y: 220, z: 4 };
  commandPrimaryClick({ x: 4, y: 6, z: 3 });

  assert.equal(app.active.vertices.length, 2);
  assert.deepEqual(app.active.vertices[0].correctedLocal, { x: 100, y: 200, z: 3 });
  assert.deepEqual(app.active.vertices[1].correctedLocal, { x: 110, y: 220, z: 4 });
});

test('double click primary action does nothing', () => {
  resetCommandHarness();
  app.mode = 'design-route';

  const result = commandPrimaryClick({ x: 1, y: 2, z: 3 }, { detail: 2 });

  assert.equal(result, 'ignored-double-click');
  assert.equal(app.active, null);
});

test('pauseActive prevents addVertex until resume increments segment', () => {
  resetCommandHarness();
  startElement('route', 'design', { x: 0, y: 0, z: 0 });

  pauseActive();
  addVertex({ x: 3, y: 4, z: 0 });
  assert.equal(app.active.vertices.length, 1);
  assert.equal(app.active.paused, true);

  resumeActive();
  addVertex({ x: 6, y: 8, z: 0 });
  assert.equal(app.active.vertices.length, 2);
  assert.equal(app.active.vertices[1].segment, 2);
});

test('active context actions expose pause, end, cancel', () => {
  resetCommandHarness();
  startElement('route', 'design', { x: 0, y: 0, z: 0 });

  assert.deepEqual(activeContextActions({ x: 0, y: 0, z: 0 }).map((item) => item.id), ['pause', 'end', 'cancel']);
});

test('active context actions expose resume while paused', () => {
  resetCommandHarness();
  startElement('route', 'design', { x: 0, y: 0, z: 0 });
  pauseActive();

  assert.deepEqual(activeContextActions({ x: 0, y: 0, z: 0 }).map((item) => item.id), ['resume', 'end', 'cancel']);
});

test('finishActive persists valid route and clears active command', () => {
  resetCommandHarness();
  startElement('route', 'design', { x: 0, y: 0, z: 0 });
  addVertex({ x: 3, y: 4, z: 0 });

  finishActive();

  assert.equal(app.active, null);
  assert.equal(app.base.length, 1);
  assert.equal(app.base[0].type, 'route');
  assert.equal(app.base[0].metrics.distanceM, 5);
  assert.equal(globalThis.putCalls[0].store, 'base');
});

test('area command requires three vertices and then persists', () => {
  resetCommandHarness();
  app.mode = 'design-area';

  commandPrimaryClick({ x: 0, y: 0, z: 0 });
  commandPrimaryClick({ x: 10, y: 0, z: 0 });
  finishActive();
  assert.equal(app.base.length, 0);
  assert.ok(globalThis.toasts.includes('Area needs at least 3 points'));

  commandPrimaryClick({ x: 10, y: 10, z: 0 });
  finishActive();
  assert.equal(app.base.length, 1);
  assert.equal(app.base[0].type, 'area');
  assert.equal(app.base[0].metrics.areaM2, 50);
});

test('finishActive keeps invalid route active', () => {
  resetCommandHarness();
  startElement('route', 'design', { x: 0, y: 0, z: 0 });

  finishActive();

  assert.equal(app.active.type, 'route');
  assert.equal(app.base.length, 0);
  assert.ok(globalThis.toasts.includes('Line needs at least 2 points'));
});

test('cancelActive clears active mode and pending circle command', () => {
  resetCommandHarness();
  startElement('area', 'design', { x: 0, y: 0, z: 0 });

  cancelActive();

  assert.equal(app.active, null);
  assert.equal(app.mode, null);
  assert.equal(app.command.circle, null);
});

test('circle center plus radius saves from radius draft', () => {
  resetCommandHarness();
  beginCircleCommand('design', 'center');

  handleCircleClick({ x: 5, y: 6, z: 0 });
  assert.deepEqual(app.command.circle.radiusDraft.center, { x: 5, y: 6, z: 0 });

  assert.equal(applyCircleRadius(10), true);
  assert.equal(app.base.length, 1);
  assert.equal(app.base[0].type, 'circle');
  assert.equal(app.base[0].radiusM, 10);
  assert.equal(app.mode, null);
});

test('circle 3 point command saves circle after third point', () => {
  resetCommandHarness();
  beginCircleCommand('design', 'three');

  handleCircleClick({ x: 1, y: 0, z: 0 });
  handleCircleClick({ x: 0, y: 1, z: 0 });
  assert.equal(app.base.length, 0);
  handleCircleClick({ x: -1, y: 0, z: 0 });

  assert.equal(app.base.length, 1);
  assert.ok(Math.abs(app.base[0].centerLocal.x) < 1e-9);
  assert.ok(Math.abs(app.base[0].centerLocal.y) < 1e-9);
});

test('circle 2 point plus radius drafts midpoint then saves with radius', () => {
  resetCommandHarness();
  beginCircleCommand('design', 'twoRadius');

  handleCircleClick({ x: 0, y: 0, z: 0 });
  handleCircleClick({ x: 10, y: 0, z: 2 });

  assert.deepEqual(app.command.circle.radiusDraft.center, { x: 5, y: 0, z: 1 });
  applyCircleRadius(3);
  assert.equal(app.base.length, 1);
  assert.equal(app.base[0].radiusM, 3);
});

test('add circle uses avatar position for captured points', () => {
  resetCommandHarness();
  beginCircleCommand('add', 'center');

  handleCircleClick({ x: 1, y: 2, z: 3 });

  assert.deepEqual(app.command.circle.points[0], { x: 100, y: 200, z: 3 });
  assert.deepEqual(app.command.circle.radiusDraft.center, { x: 100, y: 200, z: 3 });
});

test('select one primary click does not open properties', () => {
  resetCommandHarness();
  app.selectMode = 'one';

  assert.equal(commandPrimaryClick({ x: 2, y: 3, z: 0 }), 'select-one');
  assert.deepEqual(globalThis.selectNearestCalls, [{ x: 2, y: 3, z: 0 }]);
  assert.equal(globalThis.dialogShows ?? 0, 0);
});

test('properties are only offered from right-click context actions', () => {
  resetCommandHarness();
  app.base.push({ id: 'r1', type: 'point', correctedLocal: { x: 0, y: 0, z: 0 } });
  app.camera.z = 1;

  const actions = selectionContextActions({ x: 0, y: 0, z: 0 });

  assert.deepEqual(actions.map((item) => item.id), ['prop', 'clear']);
  assert.ok(app.selected.has('r1'));
});

let failed = 0;
for (const { name, fn } of tests) {
  try {
    await fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    failed += 1;
    console.error(`not ok - ${name}`);
    console.error(error);
  }
}

if (failed) {
  process.exitCode = 1;
} else {
  console.log(`\n${tests.length} tests passed`);
}
