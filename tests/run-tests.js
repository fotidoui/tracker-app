import assert from 'node:assert/strict';
import {
  areaM2,
  circleFrom3,
  circleFrom2Radius,
  createCircleCenterRadius,
  distanceBetween,
  distanceXY,
  distanceXYZ,
  interpolatePoint,
  distanceLocal,
  localToWgs,
  metricsRoute,
  normalizePolylineSegments,
  polylineLength2D,
  polylineLength3D,
  polylineMetrics,
  signedArea2D,
  slopeDistance,
  wgsToLocal
} from '../src/geometry.js';
import {
  correctedLocalFor,
  solvePosition
} from '../src/solver.js';
import {
  addVertex,
  activeContextActions,
  applyCircleRadius,
  beginCircleCommand,
  beginSelectCommand,
  cancelActive,
  commandPrimaryClick,
  finishActive,
  handleCircleClick,
  pauseActive,
  resumeActive,
  savePointWithSmartIcon,
  selectionContextActions,
  setTool,
  sourcePosition,
  startElement
} from '../src/commands.js';
import {
  commandStatusSummary,
  getContextActions
} from '../src/ui.js';

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
  Object.defineProperty(globalThis, 'navigator', { value: { onLine: false }, configurable: true });
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

function installPropertiesDialogUi() {
  globalThis.dialogShows = 0;
  globalThis.ui = {
    recordTitle: { textContent: '' },
    recordBody: {
      value: '',
      set innerHTML(value) { this.value = value; },
      get innerHTML() { return this.value; },
      querySelectorAll() { return []; }
    },
    recordCancel: { onclick: null },
    recordSave: { style: { display: '' }, onclick: null },
    dialog: {
      close() {},
      showModal() { globalThis.dialogShows += 1; }
    },
    leveler: {}
  };
  globalThis.$ = () => ({ value: '' });
}

test('distanceLocal includes z distance', () => {
  assert.equal(distanceLocal({ x: 0, y: 0, z: 0 }, { x: 3, y: 4, z: 12 }), 13);
});

test('distance helpers support horizontal, 3D, and slope distances', () => {
  const a = { x: 0, y: 0, z: 0 };
  const b = { x: 3, y: 4, z: 12 };
  assert.equal(distanceXY(a, b), 5);
  assert.equal(distanceXYZ(a, b), 13);
  assert.equal(slopeDistance(a, b), 13);
  assert.equal(distanceBetween(a, b, 'horizontal'), 5);
  assert.equal(distanceBetween(a, b, 'slope'), 13);
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

test('areaM2 supports non-convex simple polygons', () => {
  const concave = [
    { x: 0, y: 0 },
    { x: 4, y: 0 },
    { x: 4, y: 4 },
    { x: 2, y: 2 },
    { x: 0, y: 4 }
  ];
  assert.equal(areaM2(concave), 12);
  assert.equal(signedArea2D(concave), 12);
});

test('metricsRoute accumulates corrected and raw distances', () => {
  const route = [
    { correctedLocal: { x: 0, y: 0, z: 0 } },
    { correctedLocal: { x: 3, y: 4, z: 0 } },
    { correctedLocal: { x: 6, y: 8, z: 0 } }
  ];
  assert.deepEqual(metricsRoute(route), { distanceM: 10, distance2DM: 10, rawDistanceM: 0, vertexCount: 3, segmentCount: 1 });
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

test('polyline engine stores segments separately and computes 2D/3D lengths', () => {
  const route = [
    { segment: 1, correctedLocal: { x: 0, y: 0, z: 0 } },
    { segment: 1, correctedLocal: { x: 3, y: 4, z: 0 } },
    { segment: 2, correctedLocal: { x: 100, y: 100, z: 0 } },
    { segment: 2, correctedLocal: { x: 103, y: 104, z: 12 } }
  ];
  const segments = normalizePolylineSegments(route);
  assert.equal(segments.length, 2);
  assert.equal(segments[0].vertices.length, 2);
  assert.equal(segments[1].vertices.length, 2);
  assert.equal(polylineLength2D(segments), 10);
  assert.equal(polylineLength3D(segments), 18);
  assert.deepEqual(polylineMetrics(segments), { segments, length2D: 10, length3D: 18, vertexCount: 4 });
});

test('geometry measurements prefer correctedLocal over raw local', () => {
  const route = [
    { local: { x: 0, y: 0, z: 0 }, correctedLocal: { x: 0, y: 0, z: 0 } },
    { local: { x: 100, y: 0, z: 0 }, correctedLocal: { x: 10, y: 0, z: 0 } }
  ];
  assert.equal(polylineLength2D(route), 10);
  assert.notEqual(polylineLength2D(route), distanceXY(route[0].local, route[1].local));

  const polygon = [
    { local: { x: 0, y: 0 }, correctedLocal: { x: 0, y: 0 } },
    { local: { x: 100, y: 0 }, correctedLocal: { x: 10, y: 0 } },
    { local: { x: 100, y: 100 }, correctedLocal: { x: 10, y: 10 } },
    { local: { x: 0, y: 100 }, correctedLocal: { x: 0, y: 10 } }
  ];
  assert.equal(areaM2(polygon), 100);
  assert.notEqual(areaM2(polygon), 10000);
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

test('circle calculations prefer correctedLocal over raw local', () => {
  const circle = circleFrom3(
    { local: { x: 100, y: 0 }, correctedLocal: { x: 1, y: 0 } },
    { local: { x: 0, y: 100 }, correctedLocal: { x: 0, y: 1 } },
    { local: { x: -100, y: 0 }, correctedLocal: { x: -1, y: 0 } }
  );
  assert.ok(Math.abs(circle.r - 1) < 1e-9);

  const twoPoint = circleFrom2Radius(
    { local: { x: 0, y: 0 }, correctedLocal: { x: 0, y: 0 } },
    { local: { x: 40, y: 0 }, correctedLocal: { x: 4, y: 0 } },
    3
  );
  assert.equal(twoPoint.chord, 4);
});

test('createCircleCenterRadius returns center radius geometry', () => {
  assert.deepEqual(createCircleCenterRadius({ x: 1, y: 2, z: 3 }, 5), {
    center: { x: 1, y: 2, z: 3 },
    x: 1,
    y: 2,
    z: 3,
    r: 5,
    radius: 5
  });
  assert.equal(createCircleCenterRadius({ x: 1, y: 2 }, 0), null);
});

test('circleFrom2Radius returns mathematically valid possible centers', () => {
  const circle = circleFrom2Radius({ x: 0, y: 0, z: 0 }, { x: 4, y: 0, z: 2 }, 3);
  assert.ok(circle);
  assert.equal(circle.centers.length, 2);
  assert.equal(circle.chord, 4);
  assert.ok(Math.abs(circle.centers[0].x - 2) < 1e-9);
  assert.ok(Math.abs(Math.abs(circle.centers[0].y) - Math.sqrt(5)) < 1e-9);
  assert.equal(circle.centers[0].z, 1);
  assert.ok(circle.centers.every((c) => Math.abs(distanceXY(c.center, { x: 0, y: 0 }) - 3) < 1e-9));
  assert.equal(circleFrom2Radius({ x: 0, y: 0 }, { x: 10, y: 0 }, 3), null);
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

test('solver correctedLocal differs from raw local when control points apply', () => {
  resetGeometryApp();
  app.controlPoints = [{
    id: 'cp1',
    personalLocal: { x: 0, y: 0, z: 0 },
    weightedDelta: { dx: 10, dy: -5, dz: 2 },
    sigmaM: 1,
    confidence: 1,
    influenceRadius: 100
  }];
  const solved = correctedLocalFor({ x: 10, y: 0, z: 5 });
  assert.deepEqual(solved.correctedLocal, { x: 0, y: 5, z: 3 });
  assert.notDeepEqual(solved.rawLocal, solved.correctedLocal);

  const position = solvePosition({ rawLocal: { x: 10, y: 0, z: 5 }, accuracy: 5 });
  assert.deepEqual(position.correctedLocal, { x: 0, y: 5, z: 3 });
  assert.match(position.solverVersion, /^weighted-control-field@CPS-/);
  assert.match(position.controlSnapshotId, /^CPS-/);
  assert.equal(position.controlSnapshot.controlCount, 1);
});

test('captured vertices store raw, corrected, timestamp, and solver snapshot metadata', () => {
  resetCommandHarness();
  app.controlPoints = [{
    id: 'cp1',
    personalLocal: { x: 0, y: 0, z: 0 },
    weightedDelta: { dx: 10, dy: 0, dz: 0 },
    sigmaM: 1,
    confidence: 1,
    influenceRadius: 100
  }];

  const pos = sourcePosition('design', { x: 10, y: 0, z: 0 });

  assert.deepEqual(pos.rawLocal, { x: 10, y: 0, z: 0 });
  assert.deepEqual(pos.correctedLocal, { x: 0, y: 0, z: 0 });
  assert.match(pos.solverVersion, /^weighted-control-field@CPS-/);
  assert.match(pos.controlSnapshotId, /^CPS-/);
});

test('historical mode preserves captured corrections while live mode recomputes current best route length', () => {
  const route = [
    {
      segment: 1,
      rawLocal: { x: 10, y: 0, z: 0 },
      correctedLocal: { x: 0, y: 0, z: 0 },
      timestamp: '2026-01-01T00:00:00.000Z',
      solverVersion: 'weighted-control-field@old',
      controlSnapshotId: 'old'
    },
    {
      segment: 1,
      rawLocal: { x: 20, y: 0, z: 0 },
      correctedLocal: { x: 10, y: 0, z: 0 },
      timestamp: '2026-01-01T00:00:01.000Z',
      solverVersion: 'weighted-control-field@old',
      controlSnapshotId: 'old'
    }
  ];
  const currentCorrector = (raw) => ({ correctedLocal: { x: raw.x - 5, y: raw.y, z: raw.z } });

  assert.equal(metricsRoute(route, { mode: 'historical' }).distanceM, 10);
  assert.equal(metricsRoute(route, { mode: 'live', corrector: currentCorrector }).distanceM, 10);
  assert.deepEqual(route[0].correctedLocal, { x: 0, y: 0, z: 0 });

  const improvedCorrector = (raw) => ({ correctedLocal: { x: raw.x - (raw.x === 10 ? 5 : 0), y: raw.y, z: raw.z } });
  assert.equal(metricsRoute(route, { mode: 'live', corrector: improvedCorrector }).distanceM, 15);
  assert.equal(metricsRoute(route, { mode: 'historical' }).distanceM, 10);
  assert.deepEqual(route[1].correctedLocal, { x: 10, y: 0, z: 0 });
});

test('live route mode uses the current solver by default and never mutates stored historical coordinates', () => {
  resetGeometryApp();
  const route = [
    {
      segment: 1,
      rawLocal: { x: 10, y: 0, z: 0 },
      correctedLocal: { x: 0, y: 0, z: 0 },
      timestamp: '2026-01-01T00:00:00.000Z',
      solverVersion: 'weighted-control-field@old',
      controlSnapshotId: 'old'
    },
    {
      segment: 1,
      rawLocal: { x: 20, y: 0, z: 0 },
      correctedLocal: { x: 10, y: 0, z: 0 },
      timestamp: '2026-01-01T00:00:01.000Z',
      solverVersion: 'weighted-control-field@old',
      controlSnapshotId: 'old'
    }
  ];

  app.controlPoints = [{
    id: 'cp-live',
    personalLocal: { x: 10, y: 0, z: 0 },
    weightedDelta: { dx: 5, dy: 0, dz: 0 },
    sigmaM: 1,
    confidence: 1,
    influenceRadius: 100
  }];

  assert.equal(metricsRoute(route, { mode: 'historical' }).distanceM, 10);
  assert.equal(metricsRoute(route, { mode: 'live' }).distanceM, 10);

  app.controlPoints[0].influenceRadius = 5;
  assert.notEqual(metricsRoute(route, { mode: 'live' }).distanceM, 10);
  assert.equal(metricsRoute(route, { mode: 'historical' }).distanceM, 10);
  assert.deepEqual(route[0].correctedLocal, { x: 0, y: 0, z: 0 });
});

test('historical mode preserves area while live mode recomputes polygon from improved corrections', () => {
  const polygon = [
    { rawLocal: { x: 0, y: 0, z: 0 }, correctedLocal: { x: 0, y: 0, z: 0 } },
    { rawLocal: { x: 10, y: 0, z: 0 }, correctedLocal: { x: 10, y: 0, z: 0 } },
    { rawLocal: { x: 10, y: 10, z: 0 }, correctedLocal: { x: 10, y: 10, z: 0 } },
    { rawLocal: { x: 0, y: 10, z: 0 }, correctedLocal: { x: 0, y: 10, z: 0 } }
  ];
  const currentCorrector = (raw) => ({ correctedLocal: { x: raw.x * 2, y: raw.y, z: raw.z } });

  assert.equal(areaM2(polygon, { mode: 'historical' }), 100);
  assert.equal(areaM2(polygon, { mode: 'live', corrector: currentCorrector }), 200);
  assert.equal(areaM2(polygon, { mode: 'historical' }), 100);
});

test('interpolatePoint linearly interpolates and supports transform hook', () => {
  assert.deepEqual(interpolatePoint({ x: 0, y: 0, z: 0 }, { x: 10, y: 20, z: 30 }, 0.25), { x: 2.5, y: 5, z: 7.5 });
  assert.deepEqual(
    interpolatePoint({ x: 0, y: 0, z: 0 }, { x: 10, y: 0, z: 0 }, 2),
    { x: 10, y: 0, z: 0 }
  );
  assert.deepEqual(
    interpolatePoint({ x: 0, y: 0, z: 0 }, { x: 10, y: 0, z: 0 }, 0.5, {
      transform: (p, meta) => ({ ...p, adjusted: meta.controlPoints.length }),
      controlPoints: [{ id: 'cp1' }]
    }),
    { x: 5, y: 0, z: 0, adjusted: 1 }
  );
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
  assert.equal(app.command.status, 'ready');
  assert.equal(app.command.phase, 'awaiting-first-point');
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
  assert.equal(app.active.segments.length, 1);
  assert.equal(app.active.segments[0].vertices.length, 2);
});

test('design command uses solver-corrected clicked coordinates', () => {
  resetCommandHarness();
  app.controlPoints = [{
    id: 'cp1',
    personalLocal: { x: 0, y: 0, z: 0 },
    weightedDelta: { dx: 10, dy: 0, dz: 0 },
    sigmaM: 1,
    confidence: 1,
    influenceRadius: 100
  }];
  app.mode = 'design-route';

  commandPrimaryClick({ x: 10, y: 0, z: 0 });
  commandPrimaryClick({ x: 20, y: 0, z: 0 });

  assert.deepEqual(app.active.vertices[0].correctedLocal, { x: 0, y: 0, z: 0 });
  assert.deepEqual(app.active.vertices[0].rawLocal, { x: 10, y: 0, z: 0 });
  assert.deepEqual(app.active.vertices[1].correctedLocal, { x: 10, y: 0, z: 0 });
  assert.deepEqual(app.active.vertices[1].rawLocal, { x: 20, y: 0, z: 0 });
  assert.match(app.active.vertices[0].solverVersion, /^weighted-control-field@CPS-/);
  assert.equal(metricsRoute(app.active.vertices).distanceM, 10);
});

test('saved point preserves raw click and captured correction metadata', () => {
  resetCommandHarness();
  app.controlPoints = [{
    id: 'cp1',
    personalLocal: { x: 0, y: 0, z: 0 },
    weightedDelta: { dx: 10, dy: 0, dz: 0 },
    sigmaM: 1,
    confidence: 1,
    influenceRadius: 100
  }];
  const pos = sourcePosition('design', { x: 10, y: 0, z: 0 });

  savePointWithSmartIcon('design', pos, { name: 'Note', icon: '*' });

  assert.equal(app.base.length, 1);
  assert.deepEqual(app.base[0].rawLocal, { x: 10, y: 0, z: 0 });
  assert.deepEqual(app.base[0].local, { x: 10, y: 0, z: 0 });
  assert.deepEqual(app.base[0].correctedLocal, { x: 0, y: 0, z: 0 });
  assert.match(app.base[0].timestamp, /^\d{4}-\d{2}-\d{2}T/);
  assert.match(app.base[0].solverVersion, /^weighted-control-field@CPS-/);
  assert.match(app.base[0].controlSnapshotId, /^CPS-/);
});

test('add command vertices preserve avatar raw and corrected coordinates separately', () => {
  resetCommandHarness();
  app.avatarView.rawLocal = { x: 130, y: 240, z: 5 };
  app.avatarView.correctedLocal = { x: 100, y: 200, z: 3 };
  app.avatarView.solverVersion = 'weighted-control-field@avatar-snapshot';
  app.avatarView.controlSnapshotId = 'avatar-snapshot';
  app.mode = 'add-route';

  commandPrimaryClick({ x: 1, y: 2, z: 3 });

  assert.deepEqual(app.active.vertices[0].rawLocal, { x: 130, y: 240, z: 5 });
  assert.deepEqual(app.active.vertices[0].correctedLocal, { x: 100, y: 200, z: 3 });
  assert.match(app.active.vertices[0].timestamp, /^\d{4}-\d{2}-\d{2}T/);
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

test('design area uses clicked coordinates and add area uses avatar coordinates', () => {
  resetCommandHarness();
  app.mode = 'design-area';

  commandPrimaryClick({ x: 1, y: 2, z: 0 });
  commandPrimaryClick({ x: 11, y: 2, z: 0 });
  commandPrimaryClick({ x: 11, y: 12, z: 0 });

  assert.equal(app.active.type, 'area');
  assert.deepEqual(app.active.vertices.map((v) => v.correctedLocal), [
    { x: 1, y: 2, z: 0 },
    { x: 11, y: 2, z: 0 },
    { x: 11, y: 12, z: 0 }
  ]);

  resetCommandHarness();
  app.mode = 'add-area';
  commandPrimaryClick({ x: 1, y: 2, z: 0 });
  app.avatarView.correctedLocal = { x: 101, y: 201, z: 3 };
  commandPrimaryClick({ x: 11, y: 2, z: 0 });
  app.avatarView.correctedLocal = { x: 102, y: 202, z: 3 };
  commandPrimaryClick({ x: 11, y: 12, z: 0 });

  assert.deepEqual(app.active.vertices.map((v) => v.correctedLocal), [
    { x: 100, y: 200, z: 3 },
    { x: 101, y: 201, z: 3 },
    { x: 102, y: 202, z: 3 }
  ]);
});

test('double click primary action does nothing', () => {
  resetCommandHarness();
  app.mode = 'design-route';

  const result = commandPrimaryClick({ x: 1, y: 2, z: 3 }, { detail: 2 });

  assert.equal(result.type, 'ignored-double-click');
  assert.equal(app.active, null);
});

test('double click is ignored for point, circle, select, and active drawing commands', () => {
  resetCommandHarness();
  installPointDialogUi();
  app.mode = 'design-point';

  assert.equal(commandPrimaryClick({ x: 1, y: 2, z: 0 }, { detail: 2 }).type, 'ignored-double-click');
  assert.equal(globalThis.dialogShows, 0);
  assert.equal(app.mode, 'design-point');

  resetCommandHarness();
  beginCircleCommand('design', 'three');
  assert.equal(commandPrimaryClick({ x: 1, y: 0, z: 0 }, { detail: 2 }).type, 'ignored-double-click');
  assert.equal(app.command.circle.points.length, 0);

  resetCommandHarness();
  beginSelectCommand('one');
  assert.equal(commandPrimaryClick({ x: 2, y: 3, z: 0 }, { detail: 2 }).type, 'ignored-double-click');
  assert.deepEqual(globalThis.selectNearestCalls, []);

  resetCommandHarness();
  app.mode = 'design-route';
  commandPrimaryClick({ x: 0, y: 0, z: 0 });
  assert.equal(commandPrimaryClick({ x: 10, y: 0, z: 0 }, { detail: 2 }).type, 'ignored-double-click');
  assert.equal(app.active.vertices.length, 1);
});

test('pauseActive prevents addVertex until resume increments segment', () => {
  resetCommandHarness();
  startElement('route', 'design', { x: 0, y: 0, z: 0 });

  pauseActive();
  addVertex({ x: 3, y: 4, z: 0 });
  assert.equal(app.active.vertices.length, 1);
  assert.equal(app.active.paused, true);
  assert.equal(app.active.segment, 2);
  assert.equal(app.active.segments.length, 2);
  assert.deepEqual(app.active.segments[1].resumeFrom.correctedLocal, { x: 0, y: 0, z: 0 });

  resumeActive();
  addVertex({ x: 6, y: 8, z: 0 });
  assert.equal(app.active.vertices.length, 2);
  assert.equal(app.active.vertices[1].segment, 2);
  assert.equal(app.active.segments[1].vertices.length, 1);
});

test('area pause and resume use explicit paused and drawing phases without adding paused vertices', () => {
  resetCommandHarness();
  startElement('area', 'design', { x: 0, y: 0, z: 0 });
  addVertex({ x: 10, y: 0, z: 0 });

  const paused = pauseActive();
  const ignored = addVertex({ x: 999, y: 999, z: 0 });
  const resumed = resumeActive();
  addVertex({ x: 10, y: 10, z: 0 });

  assert.equal(paused.command.phase, 'paused');
  assert.equal(ignored.type, 'ignored-paused');
  assert.equal(resumed.command.phase, 'drawing');
  assert.equal(app.active.vertices.length, 3);
  assert.equal(app.active.segments.length, 2);
  assert.equal(app.active.segments[0].vertices.length, 2);
  assert.equal(app.active.segments[1].vertices.length, 1);
  assert.deepEqual(app.active.segments[1].resumeFrom.correctedLocal, { x: 10, y: 0, z: 0 });
});

test('active context actions expose pause, end, cancel', () => {
  resetCommandHarness();
  startElement('route', 'design', { x: 0, y: 0, z: 0 });

  assert.deepEqual(activeContextActions({ x: 0, y: 0, z: 0 }).map((item) => item.id), ['pause', 'end', 'cancel']);
  assert.equal(app.command.status, 'active');
  assert.equal(app.command.phase, 'drawing');
});

test('active context actions expose resume while paused', () => {
  resetCommandHarness();
  startElement('route', 'design', { x: 0, y: 0, z: 0 });
  pauseActive();

  assert.deepEqual(activeContextActions({ x: 0, y: 0, z: 0 }).map((item) => item.id), ['resume', 'end', 'cancel']);
});

test('right-click pause and resume actions mutate active line state', () => {
  resetCommandHarness();
  startElement('route', 'design', { x: 0, y: 0, z: 0 });

  const paused = activeContextActions({ x: 0, y: 0, z: 0 }).find((item) => item.id === 'pause').fn();
  assert.equal(app.active.paused, true);
  assert.equal(paused.type, 'geometry-paused');

  const resumed = activeContextActions({ x: 0, y: 0, z: 0 }).find((item) => item.id === 'resume').fn();
  assert.equal(app.active.paused, false);
  assert.equal(app.active.segment, 2);
  assert.equal(resumed.type, 'geometry-resumed');
  assert.equal(resumed.command.phase, 'drawing');
});

test('right-click end action persists active line', () => {
  resetCommandHarness();
  startElement('route', 'design', { x: 0, y: 0, z: 0 });
  addVertex({ x: 3, y: 4, z: 0 });

  const ended = activeContextActions({ x: 3, y: 4, z: 0 }).find((item) => item.id === 'end').fn();

  assert.equal(app.active, null);
  assert.equal(app.base.length, 1);
  assert.equal(app.base[0].metrics.distanceM, 5);
  assert.equal(ended.type, 'geometry-ended');
  assert.equal(ended.command.phase, 'completed');
});

test('finishing paused route excludes pause gap from total length', () => {
  resetCommandHarness();
  startElement('route', 'design', { x: 0, y: 0, z: 0 });
  addVertex({ x: 3, y: 4, z: 0 });
  pauseActive();
  resumeActive();
  addVertex({ x: 103, y: 104, z: 0 });
  addVertex({ x: 106, y: 108, z: 0 });

  const ended = finishActive();

  assert.equal(ended.record.metrics.distanceM, 10);
  assert.equal(ended.record.segments.length, 2);
  assert.deepEqual(ended.record.segments[1].resumeFrom.correctedLocal, { x: 3, y: 4, z: 0 });
});

test('right-click cancel action clears active area', () => {
  resetCommandHarness();
  startElement('area', 'design', { x: 0, y: 0, z: 0 });

  const cancelled = activeContextActions({ x: 0, y: 0, z: 0 }).find((item) => item.id === 'cancel').fn();

  assert.equal(app.active, null);
  assert.equal(app.mode, null);
  assert.equal(cancelled.type, 'command-cancelled');
  assert.equal(app.command.phase, 'cancelled');
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
  assert.equal(app.base[0].segments.length, 1);
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
  assert.equal(app.command.phase, 'cancelled');
});

test('circle center plus radius saves from radius draft', () => {
  resetCommandHarness();
  beginCircleCommand('design', 'center');

  const request = handleCircleClick({ x: 5, y: 6, z: 0 });
  assert.deepEqual(app.command.circle.radiusDraft.center, { x: 5, y: 6, z: 0 });
  assert.equal(request.type, 'radius-requested');
  assert.deepEqual(request.request.center, { x: 5, y: 6, z: 0 });

  assert.equal(applyCircleRadius(10).type, 'circle-ended');
  assert.equal(app.base.length, 1);
  assert.equal(app.base[0].type, 'circle');
  assert.equal(app.base[0].radiusM, 10);
  assert.equal(app.mode, null);
  assert.equal(app.command.phase, 'completed');
});

test('circle radius requirement returns UI request without opening radius popup', () => {
  resetCommandHarness();
  installPointDialogUi();
  beginCircleCommand('design', 'center');

  const request = handleCircleClick({ x: 5, y: 6, z: 0 });

  assert.equal(request.type, 'radius-requested');
  assert.equal(request.request.kind, 'radius');
  assert.equal(globalThis.dialogShows, 0);
});

test('circle center radius rejects invalid radius without saving or completing command', () => {
  resetCommandHarness();
  beginCircleCommand('design', 'center');
  handleCircleClick({ x: 5, y: 6, z: 0 });

  const invalid = applyCircleRadius(0);

  assert.equal(invalid.type, 'invalid-radius');
  assert.equal(app.base.length, 0);
  assert.equal(app.command.phase, 'drawing');
  assert.equal(app.mode, 'design-circle');
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
  assert.equal(app.base[0].inputPoints.length, 3);
  assert.ok(app.base[0].inputPoints.every((p) => p.rawLocal && p.correctedLocal && p.timestamp && p.solverVersion !== undefined));
});

test('circle 3 point command rejects collinear points and remains active', () => {
  resetCommandHarness();
  beginCircleCommand('design', 'three');

  handleCircleClick({ x: 0, y: 0, z: 0 });
  handleCircleClick({ x: 1, y: 1, z: 0 });
  const invalid = handleCircleClick({ x: 2, y: 2, z: 0 });

  assert.equal(invalid.type, 'invalid-circle');
  assert.equal(invalid.reason, 'collinear');
  assert.equal(app.base.length, 0);
  assert.equal(app.command.status, 'active');
});

test('circle 2 point plus radius rejects impossible radius before saving', () => {
  resetCommandHarness();
  beginCircleCommand('design', 'twoRadius');

  handleCircleClick({ x: 0, y: 0, z: 0 });
  handleCircleClick({ x: 10, y: 0, z: 0 });
  const invalid = applyCircleRadius(0);

  assert.equal(invalid.type, 'invalid-radius');
  assert.equal(app.base.length, 0);
  assert.equal(app.command.phase, 'drawing');
});

test('circle 2 point plus radius drafts midpoint then saves with radius', () => {
  resetCommandHarness();
  beginCircleCommand('design', 'twoRadius');

  handleCircleClick({ x: 0, y: 0, z: 0 });
  const request = handleCircleClick({ x: 10, y: 0, z: 2 });

  assert.deepEqual(app.command.circle.radiusDraft.center, { x: 5, y: 0, z: 1 });
  assert.equal(request.type, 'radius-requested');
  applyCircleRadius(3);
  assert.equal(app.base.length, 1);
  assert.equal(app.base[0].radiusM, 3);
});

test('add circle uses avatar position for captured points', () => {
  resetCommandHarness();
  beginCircleCommand('add', 'center');

  const request = handleCircleClick({ x: 1, y: 2, z: 3 });

  assert.deepEqual(app.command.circle.points[0].correctedLocal, { x: 100, y: 200, z: 3 });
  assert.deepEqual(app.command.circle.radiusDraft.center, { x: 100, y: 200, z: 3 });
  assert.equal(request.type, 'radius-requested');
});

test('select one primary click does not open properties', () => {
  resetCommandHarness();
  beginSelectCommand('one');

  assert.equal(commandPrimaryClick({ x: 2, y: 3, z: 0 }).type, 'select-one');
  assert.deepEqual(globalThis.selectNearestCalls, [{ x: 2, y: 3, z: 0 }]);
  assert.equal(globalThis.dialogShows ?? 0, 0);
});

test('select window command has explicit awaiting-first-point state', () => {
  resetCommandHarness();

  const ready = beginSelectCommand('box');

  assert.equal(ready.type, 'select-ready');
  assert.equal(app.selectMode, 'box');
  assert.equal(app.command.status, 'select');
  assert.equal(app.command.phase, 'awaiting-first-point');
});

test('properties are only offered from right-click context actions', () => {
  resetCommandHarness();
  app.base.push({ id: 'r1', type: 'point', correctedLocal: { x: 0, y: 0, z: 0 } });
  app.camera.z = 1;

  const actions = selectionContextActions({ x: 0, y: 0, z: 0 });

  assert.deepEqual(actions.map((item) => item.id), ['prop', 'clear']);
  assert.ok(app.selected.has('r1'));
});

test('select context properties action opens properties dialog only from context menu path', () => {
  resetCommandHarness();
  installPropertiesDialogUi();
  app.base.push({ id: 'r1', code: 'P-1', type: 'point', name: 'Point 1', correctedLocal: { x: 0, y: 0, z: 0 }, time: { eventAt: '2026-01-01T00:00:00.000Z' } });
  app.camera.z = 1;

  beginSelectCommand('one');
  commandPrimaryClick({ x: 0, y: 0, z: 0 });
  assert.equal(globalThis.dialogShows, 0);

  const prop = selectionContextActions({ x: 0, y: 0, z: 0 }).find((item) => item.id === 'prop');
  prop.fn();

  assert.equal(globalThis.dialogShows, 1);
  assert.match(ui.recordTitle.textContent, /Properties/);
  assert.match(ui.recordBody.innerHTML, /Point 1/);
});

test('UI command status summary reflects active command, phase, vertices, segments, and selected count', () => {
  resetCommandHarness();
  startElement('route', 'design', { x: 0, y: 0, z: 0 });
  addVertex({ x: 3, y: 4, z: 0 });
  pauseActive();
  app.selected.add('r1');

  assert.deepEqual(commandStatusSummary(app), {
    label: 'design route',
    phase: 'paused',
    vertices: 2,
    segments: 2,
    selected: 1
  });
});

test('UI context actions derive drawing menu from command state only', () => {
  assert.deepEqual(
    getContextActions({ kind: 'design', type: 'route', phase: 'drawing' }).map((item) => item.id),
    ['pause', 'end', 'cancel']
  );
  assert.deepEqual(
    getContextActions({ kind: 'add', type: 'area', phase: 'drawing' }).map((item) => item.id),
    ['pause', 'end', 'cancel']
  );
});

test('UI context actions derive paused menu from command state only', () => {
  assert.deepEqual(
    getContextActions({ kind: 'design', type: 'route', phase: 'paused' }).map((item) => item.id),
    ['resume', 'end', 'cancel']
  );
});

test('UI context actions derive select menu from command state only', () => {
  assert.deepEqual(
    getContextActions({ kind: 'select', type: 'one', phase: 'awaiting-first-point' }).map((item) => item.id),
    ['properties', 'clear']
  );
  assert.deepEqual(
    getContextActions({ status: 'select', type: 'box', phase: 'awaiting-first-point' }).map((item) => item.id),
    ['properties', 'clear']
  );
});

test('UI context actions return no items for idle or unsupported commands', () => {
  assert.deepEqual(getContextActions({ kind: null, type: null, phase: 'idle' }), []);
  assert.deepEqual(getContextActions({ kind: 'design', type: 'circle', phase: 'drawing' }), []);
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
  process.exit(1);
} else {
  console.log(`\n${tests.length} tests passed`);
  process.exit(0);
}
