# Personal Spatial Journal Prototype

Drop-in GitHub Pages prototype.

## Run locally

Use any static server from the repository root, for example:

```bash
python3 -m http.server 8080
```

Then open `http://localhost:8080`.

## Test

```bash
npm test
```

or:

```bash
node tests/run-tests.js
```

## Current focus

This build keeps the tested command/geometry/solver core and applies a v80 UI hotfix:

- modern minimal cyber/voronoi visual pass
- lower-left 3D tool hub for Add / Design / Select / Measure / Path
- layers moved into Settings
- stronger compass/leveler visibility
- popup clamping so menus stay inside the screen
- smart vector library controls in Settings
- weekly panel with one-week navigation and address visibility
