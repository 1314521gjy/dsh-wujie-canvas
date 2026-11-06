# dsh-wujie-canvas

DeepSeek Harness plugin for **无界画布**.

A left-sidebar canvas page for DSH. The plugin bundles the production 无界画布 front-end, starts a loopback-only server for it, and proxies the local ComfyUI gateway. DSH remains the only Agent; this build deliberately omits the canvas's own built-in Agent and exposes canvas operations to DSH as Agent tools instead.

## Requirements

- DeepSeek Harness `0.2.1` or newer
- A local **无界工作台** installation with ComfyUI
- Node.js 22+ (DSH already provides one)
- The plugin itself does **not** bundle ComfyUI, CUDA, models, or API keys

## Install

### Direct download (no plugin market)

Prebuilt tarball: https://github.com/1314521gjy/dsh-wujie-canvas/releases/latest

Web profile, install the release tarball directly:

```bash
dsh plugin --profile web add https://github.com/1314521gjy/dsh-wujie-canvas/releases/download/v0.2.0/dsh-wujie-canvas-0.2.0.tgz
```

If your DSH build only accepts a GitHub source:

```bash
dsh plugin --profile web add github:1314521gjy/dsh-wujie-canvas
```

Desktop DSH: download the release archive and use the in-app plugin manager; if that build only accepts npm names, use the GitHub source and the profile bundle method (link the directory into `node_modules` and add `dsh-wujie-canvas` to `dsh.profile.bundles`). The plugin market listing is optional and does not block direct installation.

## What it does

- Adds the **无界画布** entry to DSH's left sidebar; the canvas opens in the middle
- Serves the bundled `web/` build from a loopback-only server (default `127.0.0.1:8294`)
- Proxies the local gateway at `http://127.0.0.1:8190` under the same origin
- Shows gateway/ComfyUI status in the tab
- When the local workbench is offline, shows a **启动本机工作台** cover; starting is explicit and uses the installed `start-local.bat`. Nothing starts automatically
- Does **not** ship or start a built-in Agent. DSH's Agent operates the canvas through:
  - `wujie_canvas_status` — workbench/gateway/ComfyUI status
  - `wujie_canvas_state` — project title, nodes (id/type/position/status/prompt/model), connections, selection, viewport
  - `wujie_canvas_apply_ops` — add/update/delete nodes, connect nodes, select, set viewport, run generation
- The canvas page must be open on a project for the state/apply tools. The DSH whale widget is a separate plugin and is not this canvas's Agent.

## Configuration

Optional `config` in the profile's `cordis.patch.yml`:

```yaml
- id: dsh-wujie-canvas
  config:
    workbenchRoot: 'C:\path\to\无界工作台'
    launcherPort: 8290
    gateway: 'http://127.0.0.1:8190'
```

Workbench discovery order: `workbenchRoot`, `WUJIE_WORKBENCH_ROOT`, the plugin's parent directory, then common `无界工作台` locations.

## Development

```bash
node --check index.js
node --check client.js
```

The bundled front-end is the production build of the 无界画布 front-end, compiled with `VITE_DSH_EMBEDDED=1` so the canvas's built-in Agent is omitted:

```bash
VITE_DSH_EMBEDDED=1 npx vite build --outDir ../../dsh-wujie-canvas/web --emptyOutDir
```

## License

MIT. The bundled `web/` is the production build of the 无界画布 front-end from [ComfyUI-Local-Infinite-Canvas](https://github.com/1314521gjy/ComfyUI-Local-Infinite-Canvas) (MIT). ComfyUI itself is GPL-3.0 and is not bundled.
