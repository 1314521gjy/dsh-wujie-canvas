# Changelog

## 0.3.0

- New tool `wujie_canvas_deploy_check`: read-only deployment health check (workbench, gateway, ComfyUI, model scan, resource gaps) with an ordered problem list and fixes.
- New tool `wujie_canvas_start`: explicit workbench start, now cross-platform (`start-local.bat`, `start-local.sh`, or `launcher/start.mjs`).
- Bundled `wujie-canvas-deploy` skill so the DSH Agent can guide deployment and troubleshooting on its own.
- Launcher probe now uses the real `GET /health` endpoint; removed the dead "打开启动器" link, which pointed at a route the launcher does not serve.
- ComfyUI reachability in the deploy check also trusts `/api/setup/status`, avoiding a false "offline" reading from the gateway's 1.5s race.
- DSH-embedded build no longer loads the canvas's own `canvas-assistant` AI plugin; comparison sample assets are excluded from the package.
- Bundled front-end is now built from the **release tree (v0.24.13)**, not the development tree: no automation Agent, no short-drama/video-edit experiments; keeps 3D/MoGe, style recipes and LoRA.
- Workbench discovery adds `~/无界工作台` and Linux paths.

## 0.2.0

- Left-sidebar 无界画布 page with the bundled production front-end.
- Loopback canvas server and same-origin gateway proxy.
- Gateway/ComfyUI status bar, explicit workbench start, and offline cover.
- DSH Agent tools: `wujie_canvas_status`, `wujie_canvas_state`, `wujie_canvas_apply_ops`.
- DSH-embedded build omits the canvas's own built-in Agent; DSH is the Agent.
