import { spawn } from "node:child_process";
import fs from "node:fs";
import fsp from "node:fs/promises";
import http from "node:http";
import https from "node:https";
import path from "node:path";
import { fileURLToPath } from "node:url";

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".htm": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".wasm": "application/wasm",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".glb": "model/gltf-binary",
  ".ply": "application/octet-stream",
};

function normalizePrefix(value) {
  let prefix = String(value || "/wujie").trim();
  if (!prefix.startsWith("/")) prefix = `/${prefix}`;
  return prefix.replace(/\/+$/, "") || "/wujie";
}

function contentType(file) {
  return MIME[path.extname(file).toLowerCase()] || "application/octet-stream";
}

function sendJson(res, status, value) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
  res.end(JSON.stringify(value));
}

function sendText(res, status, text) {
  res.writeHead(status, { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" });
  res.end(text);
}

function parseGateway(value) {
  try {
    return new URL(String(value || "http://127.0.0.1:8190"));
  } catch {
    return new URL("http://127.0.0.1:8190");
  }
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isWorkbenchRoot(dir) {
  return Boolean(dir) && (fs.existsSync(path.join(dir, "start-local.bat")) || fs.existsSync(path.join(dir, "launcher", "start.mjs")));
}

function resolveWorkbenchRoot(pluginDir, configured) {
  const candidates = [
    configured,
    process.env.WUJIE_WORKBENCH_ROOT,
    path.resolve(pluginDir, ".."),
    process.env.USERPROFILE ? path.join(process.env.USERPROFILE, "Documents", "无界工作台") : "",
    process.env.USERPROFILE ? path.join(process.env.USERPROFILE, "Desktop", "无界工作台") : "",
    "C:\\无界工作台",
    "D:\\无界工作台",
    "E:\\无界工作台",
  ].filter(Boolean);
  for (const candidate of candidates) {
    try {
      if (isWorkbenchRoot(candidate)) return path.resolve(candidate);
    } catch {}
  }
  return path.resolve(configured || path.resolve(pluginDir, ".."));
}

function probeJson(url, timeoutMs = 2500) {
  return new Promise((resolve) => {
    let target;
    try {
      target = new URL(url);
    } catch {
      resolve({ ok: false, status: 0, json: null, text: "invalid url" });
      return;
    }
    const transport = target.protocol === "https:" ? https : http;
    const request = transport.get(target, { timeout: timeoutMs }, (response) => {
      let text = "";
      response.setEncoding("utf8");
      response.on("data", (chunk) => { text += chunk; });
      response.on("end", () => {
        let json = null;
        try { json = JSON.parse(text); } catch {}
        resolve({ ok: response.statusCode >= 200 && response.statusCode < 300, status: response.statusCode || 0, json, text });
      });
    });
    request.on("timeout", () => { request.destroy(); resolve({ ok: false, status: 0, json: null, text: "timeout" }); });
    request.on("error", (error) => resolve({ ok: false, status: 0, json: null, text: error.message }));
  });
}

function postJson(url, body, timeoutMs = 15000) {
  return new Promise((resolve) => {
    let target;
    try {
      target = new URL(url);
    } catch {
      resolve({ ok: false, status: 0, json: null, text: "invalid url" });
      return;
    }
    const payload = JSON.stringify(body || {});
    const transport = target.protocol === "https:" ? https : http;
    const request = transport.request(target, {
      method: "POST",
      timeout: timeoutMs,
      headers: { "content-type": "application/json", "content-length": Buffer.byteLength(payload) },
    }, (response) => {
      let text = "";
      response.setEncoding("utf8");
      response.on("data", (chunk) => { text += chunk; });
      response.on("end", () => {
        let json = null;
        try { json = JSON.parse(text); } catch {}
        resolve({ ok: response.statusCode >= 200 && response.statusCode < 300, status: response.statusCode || 0, json, text });
      });
    });
    request.on("timeout", () => { request.destroy(); resolve({ ok: false, status: 0, json: null, text: "timeout" }); });
    request.on("error", (error) => resolve({ ok: false, status: 0, json: null, text: error.message }));
    request.end(payload);
  });
}

const BRIDGE_SCRIPT = `(() => {
  const post = async (id, result) => {
    try {
      await fetch("/__agent/result", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id, result }),
      });
    } catch {}
  };
  const run = async (command) => {
    const bridge = window.__WUJIE_DSH_BRIDGE__;
    if (!bridge) return { ok: false, error: "无界画布页面尚未加载完成" };
    try {
      if (command.tool === "state") return { ok: true, state: bridge.getState() };
      if (command.tool === "apply_ops") return { ok: true, result: bridge.applyOps(command.args?.ops || []) };
      return { ok: false, error: "未知的画布工具：" + String(command.tool) };
    } catch (error) {
      return { ok: false, error: error?.message || String(error) };
    }
  };
  const loop = async () => {
    try {
      const response = await fetch("/__agent/next", { cache: "no-store" });
      if (response.ok) {
        const command = await response.json();
        if (command && command.id) {
          const result = await run(command);
          await post(command.id, result);
        }
      }
    } catch {}
    setTimeout(loop, 700);
  };
  loop();
})();`;

export function createCanvasHandler({ canvasDist, gateway: gatewayValue, workbenchRoot = "", statusProvider = null, startProvider = null }) {
  const gateway = parseGateway(gatewayValue);
  const root = path.resolve(String(canvasDist || ""));
  const gatewayPort = gateway.port || (gateway.protocol === "https:" ? "443" : "80");
  const pending = [];
  const waiting = new Map();
  let sequence = 0;

  const enqueue = (tool, args = {}, timeoutMs = 15000) => new Promise((resolve, reject) => {
    const id = `canvas-${Date.now()}-${++sequence}`;
    const timer = setTimeout(() => {
      const index = pending.findIndex((item) => item.id === id);
      if (index >= 0) pending.splice(index, 1);
      waiting.delete(id);
      reject(new Error("无界画布页面未响应：请先在 DSH 里打开无界画布"));
    }, timeoutMs);
    waiting.set(id, { resolve, reject, timer });
    pending.push({ id, tool, args });
  });

  const finish = (id, result) => {
    const waiter = waiting.get(id);
    if (!waiter) return;
    waiting.delete(id);
    clearTimeout(waiter.timer);
    waiter.resolve(result);
  };

  const serveIndex = async (res) => {
    const file = path.join(root, "index.html");
    let html;
    try {
      html = await fsp.readFile(file, "utf8");
    } catch (error) {
      sendText(res, 503, `无界画布未找到：${file}\n${error.message}\n请先启动/安装无界工作台。`);
      return;
    }
    html = html.replace("</body>", '<script src="/__dsh_bridge.js"></script></body>');
    res.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" });
    res.end(html);
  };

  const serveConfig = (req, res) => {
    const proto = String(req.headers["x-forwarded-proto"] || "http").split(",")[0].trim() || "http";
    const host = String(req.headers.host || `127.0.0.1:${gatewayPort}`);
    const runtime = {
      LOCAL_GATEWAY_HOST: gateway.hostname,
      LOCAL_GATEWAY_PORT: gatewayPort,
      LOCAL_GATEWAY_URL: `${proto}://${host}/gateway/v1`,
    };
    res.writeHead(200, { "content-type": "text/javascript; charset=utf-8", "cache-control": "no-store" });
    res.end(`window.__RUNTIME_CONFIG__ = ${JSON.stringify(runtime)};`);
  };

  const proxyGateway = (req, res, rest) => {
    const targetPath = rest || "/";
    const target = new URL(targetPath.startsWith("/") ? targetPath : `/${targetPath}`, gateway);
    const headers = { ...req.headers, host: target.host };
    delete headers["content-length"];
    const transport = target.protocol === "https:" ? https : http;
    const upstream = transport.request({
      protocol: target.protocol,
      hostname: target.hostname,
      port: target.port || (target.protocol === "https:" ? 443 : 80),
      method: req.method,
      path: `${target.pathname}${target.search}`,
      headers,
    }, (upstreamRes) => {
      res.writeHead(upstreamRes.statusCode || 502, upstreamRes.headers);
      upstreamRes.pipe(res);
    });
    upstream.on("error", (error) => {
      if (!res.headersSent) sendJson(res, 502, { ok: false, error: `网关不可达：${error.message}` });
      else res.destroy();
    });
    req.on("error", () => upstream.destroy());
    req.pipe(upstream);
  };

  const serveStatic = async (req, res, pathname) => {
    if (pathname === "/config.js") return serveConfig(req, res);
    const relative = pathname === "/" ? "/index.html" : pathname;
    const file = path.resolve(root, `.${relative}`);
    if (file !== root && !file.startsWith(root + path.sep)) {
      sendText(res, 403, "403 Forbidden");
      return;
    }
    let stat = null;
    try { stat = await fsp.stat(file); } catch {}
    if (stat?.isFile()) {
      if (path.basename(file).toLowerCase() === "index.html") return serveIndex(res);
      res.writeHead(200, { "content-type": contentType(file), "content-length": stat.size, "cache-control": "no-store" });
      if (req.method === "HEAD") { res.end(); return; }
      const stream = fs.createReadStream(file);
      stream.on("error", () => res.destroy());
      stream.pipe(res);
      return;
    }
    if (!path.extname(relative)) return serveIndex(res);
    sendText(res, 404, "404 Not Found");
  };

  const handler = async (req, res) => {
    try {
      const url = new URL(req.url, "http://127.0.0.1");
      if (url.pathname === "/__health") {
        sendJson(res, 200, { ok: true, canvasDist: root, gateway: gateway.href, workbenchRoot });
        return;
      }
      if (url.pathname === "/__status") {
        const status = statusProvider ? await statusProvider() : { ok: true, gatewayOk: false };
        sendJson(res, 200, { ...status, canvasDist: root, workbenchRoot });
        return;
      }
      if (url.pathname === "/__start") {
        const result = startProvider ? await startProvider() : { ok: false, error: "启动器未配置" };
        sendJson(res, result.ok === false ? 400 : 200, result);
        return;
      }
      if (url.pathname === "/__agent/next") {
        const command = pending.shift();
        sendJson(res, 200, command || {});
        return;
      }
      if (url.pathname === "/__agent/result") {
        const body = await readJsonBody(req);
        finish(String(body.id || ""), body.result ?? { ok: false, error: "empty result" });
        sendJson(res, 200, { ok: true });
        return;
      }
      if (url.pathname === "/__dsh_bridge.js") {
        res.writeHead(200, { "content-type": "text/javascript; charset=utf-8", "cache-control": "no-store" });
        res.end(BRIDGE_SCRIPT);
        return;
      }
      if (url.pathname === "/gateway" || url.pathname.startsWith("/gateway/")) {
        proxyGateway(req, res, url.pathname.slice("/gateway".length) || "/");
        return;
      }
      if (req.method !== "GET" && req.method !== "HEAD") {
        sendText(res, 405, "405 Method Not Allowed");
        return;
      }
      await serveStatic(req, res, url.pathname);
    } catch (error) {
      if (!res.headersSent) sendText(res, 500, `500 ${error.message}`);
      else res.destroy();
    }
  };

  return { handler, enqueue, status: statusProvider, start: startProvider };
}

function readJsonBody(req, limit = 1024 * 1024) {
  return new Promise((resolve) => {
    let raw = "";
    req.setEncoding("utf8");
    req.on("data", (chunk) => {
      raw += chunk;
      if (raw.length > limit) req.destroy();
    });
    req.on("end", () => {
      try { resolve(JSON.parse(raw || "{}")); } catch { resolve({}); }
    });
    req.on("error", () => resolve({}));
  });
}

function textOutput() {
  return {
    schema: {
      type: "object",
      properties: { text: { type: "string" } },
      required: ["text"],
      additionalProperties: false,
    },
    render(_args, value) {
      return [{ type: "text", text: value.text }];
    },
  };
}

export const inject = ["webServer", "connection", "tools"];

export function apply(ctx, rawConfig = {}) {
  const prefix = normalizePrefix(rawConfig.prefix);
  const pluginDir = path.dirname(fileURLToPath(import.meta.url));
  const canvasDist = path.resolve(String(rawConfig.canvasDist || path.join(pluginDir, "web")));
  const gateway = parseGateway(rawConfig.gateway);
  const launcherPort = Math.max(1, Number(rawConfig.launcherPort) || 8290);
  const workbenchRoot = resolveWorkbenchRoot(pluginDir, rawConfig.workbenchRoot);
  const wantedPort = Math.max(1, Number(rawConfig.port) || 8294);
  let actualPort = 0;
  let starting = false;
  const registeredSessions = new Set();

  const log = (...args) => {
    try { ctx.logger?.info?.("[dsh-wujie-canvas]", ...args); } catch {}
  };

  const collectStatus = async () => {
    const [gatewayHealth, launcherState] = await Promise.all([
      probeJson(new URL("/health", gateway), 3500),
      probeJson(new URL("/api/launcher/state", `http://127.0.0.1:${launcherPort}`), 1800),
    ]);
    return {
      ok: true,
      gatewayOk: gatewayHealth.ok,
      comfyOk: gatewayHealth.json?.comfy?.reachable === true,
      launcherOk: launcherState.ok && launcherState.json?.ok === true,
      installed: isWorkbenchRoot(workbenchRoot),
      workbenchRoot,
      starting,
      agentToolSessions: registeredSessions.size,
      canvasPort: actualPort,
    };
  };

  const waitForGateway = async (timeoutMs = 120000) => {
    const startedAt = Date.now();
    while (Date.now() - startedAt < timeoutMs) {
      await delay(2000);
      const health = await probeJson(new URL("/health", gateway), 3000);
      if (health.ok) {
        starting = false;
        return true;
      }
    }
    starting = false;
    return false;
  };

  const startWorkbench = async () => {
    if (starting) return { ok: true, starting: true };
    const current = await collectStatus();
    if (current.gatewayOk) return { ok: true, already: true };
    if (!current.installed) {
      return { ok: false, error: `未找到无界工作台：${workbenchRoot}。请先安装，或在插件配置里填写 workbenchRoot。` };
    }
    starting = true;
    try {
      if (current.launcherOk) {
        const state = await probeJson(new URL("/api/launcher/state", `http://127.0.0.1:${launcherPort}`), 1800);
        const targetId = String(state.json?.activeTargetId || "");
        void postJson(new URL("/api/launcher/start", `http://127.0.0.1:${launcherPort}`), { targetId }, 30000).catch((error) => log(`start launcher failed: ${error.message}`));
      } else {
        const bat = path.join(workbenchRoot, "start-local.bat");
        if (fs.existsSync(bat)) {
          const child = spawn(process.env.ComSpec || "cmd.exe", ["/d", "/s", "/c", bat, "--no-open"], {
            cwd: workbenchRoot,
            detached: true,
            stdio: "ignore",
            windowsHide: true,
          });
          child.unref();
        } else {
          const node = fs.existsSync(path.join(workbenchRoot, "node", "node.exe")) ? path.join(workbenchRoot, "node", "node.exe") : "node.exe";
          const child = spawn(node, [path.join(workbenchRoot, "launcher", "start.mjs"), "--no-open"], {
            cwd: workbenchRoot,
            detached: true,
            stdio: "ignore",
            windowsHide: true,
          });
          child.unref();
        }
      }
      void waitForGateway(120000);
      log(`starting workbench at ${workbenchRoot}`);
      return { ok: true, starting: true };
    } catch (error) {
      starting = false;
      return { ok: false, error: error.message };
    }
  };

  const canvas = createCanvasHandler({
    canvasDist,
    gateway: gateway.href,
    workbenchRoot,
    statusProvider: collectStatus,
    startProvider: startWorkbench,
  });

  const proxyLocal = (req, res, localPath) => {
    if (!actualPort) {
      sendJson(res, 503, { ok: false, error: "画布服务正在启动，请稍后重试。" });
      return;
    }
    const headers = { ...req.headers, host: `127.0.0.1:${actualPort}` };
    const upstream = http.request({
      host: "127.0.0.1",
      port: actualPort,
      method: req.method,
      path: localPath,
      headers,
    }, (response) => {
      res.writeHead(response.statusCode || 502, response.headers);
      response.pipe(res);
    });
    upstream.on("error", (error) => {
      if (!res.headersSent) sendJson(res, 502, { ok: false, error: error.message });
      else res.destroy();
    });
    req.pipe(upstream);
  };

  ctx.effect(() => {
    const server = http.createServer((req, res) => { void canvas.handler(req, res); });
    const listen = (port) => {
      server.once("error", (error) => {
        if (error.code === "EADDRINUSE" && port !== 0) {
          log(`port ${port} busy, falling back to a free port`);
          listen(0);
          return;
        }
        log(`local server failed: ${error.message}`);
      });
      server.listen(port, "127.0.0.1", () => {
        actualPort = server.address().port;
        log(`canvas http://127.0.0.1:${actualPort}/ gateway=${gateway.href} workbench=${workbenchRoot}`);
      });
    };
    listen(wantedPort);
    return () => { try { server.close(); } catch {} };
  }, "dsh-wujie-canvas: local canvas server");

  ctx.effect(() => ctx.webServer.register({
    kind: "prefix",
    path: prefix,
    handler: (req, res) => {
      const url = new URL(req.url, "http://127.0.0.1");
      if (url.pathname === `${prefix}/__status` || url.pathname === `${prefix}/__start`) {
        proxyLocal(req, res, url.pathname.slice(prefix.length));
        return;
      }
      if (!actualPort) {
        sendText(res, 503, "画布服务正在启动，请稍后重试。");
        return;
      }
      res.writeHead(302, { location: `http://127.0.0.1:${actualPort}/` });
      res.end();
    },
  }), "dsh-wujie-canvas: redirect and status proxy");

  const statusTool = () => ({
    name: "wujie_canvas_status",
    description: "Check whether the local 无界画布 workbench, gateway, and ComfyUI are running. Does not start anything.",
    parameters: { type: "object", properties: {}, additionalProperties: false },
    output: textOutput(),
    async execute() {
      return { text: JSON.stringify(await collectStatus(), null, 2) };
    },
  });

  const stateTool = () => ({
    name: "wujie_canvas_state",
    description: "Read the current 无界画布 page: project title, nodes (id/type/position/size/status/prompt/model), connections, selection and viewport. The 无界画布 page must be open in DSH.",
    parameters: { type: "object", properties: {}, additionalProperties: false },
    output: textOutput(),
    async execute() {
      const result = await canvas.enqueue("state", {}, 15000);
      if (result?.ok === false) throw new Error(result.error || "读取画布失败");
      return { text: JSON.stringify(result.state, null, 2) };
    },
  });

  const applyTool = () => ({
    name: "wujie_canvas_apply_ops",
    description: "Apply operations to the open 无界画布 page. Ops: add_node {type?, nodeType?, title?, position?, metadata?}; update_node {id, patch?, metadata?}; delete_node {id|ids|nodeType}; delete_connections {id|ids|all}; connect_nodes {fromNodeId, toNodeId}; set_viewport {viewport}; select_nodes {ids}; run_generation {nodeId, mode?, prompt?}. Use wujie_canvas_state first to get real node ids.",
    parameters: {
      type: "object",
      properties: {
        ops: { type: "array", items: { type: "object", additionalProperties: true }, description: "Canvas operations in order." },
      },
      required: ["ops"],
      additionalProperties: false,
    },
    output: textOutput(),
    async execute(args) {
      const result = await canvas.enqueue("apply_ops", { ops: Array.isArray(args?.ops) ? args.ops : [] }, 20000);
      if (result?.ok === false) throw new Error(result.error || "修改画布失败");
      return { text: JSON.stringify(result.result, null, 2) };
    },
  });

  const registerTools = (agent) => {
    const sessionId = agent?.session?.id;
    if (typeof sessionId !== "string" || registeredSessions.has(sessionId)) return;
    const tools = agent?.ctx?.tools;
    if (!tools?.register) return;
    try {
      tools.register(statusTool());
      tools.register(stateTool());
      tools.register(applyTool());
      registeredSessions.add(sessionId);
      log(`registered canvas tools for session ${sessionId}`);
    } catch (error) {
      log(`tool registration failed for ${sessionId}: ${error.message}`);
    }
  };

  ctx.on("agent/created", ({ agent } = {}) => registerTools(agent));
  ctx.on("agent/disposed", ({ agent } = {}) => {
    const sessionId = agent?.session?.id;
    if (typeof sessionId === "string") registeredSessions.delete(sessionId);
  });
}
