# Personal Spatial Journal Prototype

A browser-based spatial journal / personal GIS prototype with a tested CAD-like command engine.

## Current baseline

This repository is the current production baseline after the Codex refactor and UI integration pass.

Core modules:

- `src/commands.js` - command state machine
- `src/geometry.js` - pure geometry utilities
- `src/solver.js` - coordinate correction / solver logic
- `src/storage.js` - IndexedDB persistence
- `src/rendering.js` - canvas rendering
- `src/ui.js` - UI wiring and command-driven popups/context actions
- `src/app.js` - app bootstrap and shared state wiring

## What works

- Add vs Design coordinate sources
- CAD-like Line/Area command flow
- Pause/resume segments
- Circle methods
- Select commands
- Corrected coordinate workflow
- Historical vs live/current-best geometry logic
- Basic cyber-cartographic UI shell
- Automated test suite

## Run locally

Because the app uses ES modules, serve it through a local static server.

With Python:

```bash
python3 -m http.server 5173
```

Then open:

```text
http://localhost:5173
```

## Run tests

```bash
node tests/run-tests.js
```

or, if npm is available:

```bash
npm test
```

Expected current result:

```text
61 tests passed
```

## Project status

This is a usable prototype baseline, not a finished product. The core engine is intentionally protected; future work should focus on UI/UX, installable PWA support, export/import, and device testing.

## Development rule

Do not mix layers:

- commands = state transitions only
- geometry = pure math only
- solver = coordinate correction only
- storage = persistence only
- rendering = canvas only
- ui = DOM/event wiring only

