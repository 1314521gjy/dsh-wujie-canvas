window.__ModuleLoader__.load({
  id: "dsh-wujie-canvas",
  factory(require) {
    const React = require("react");
    const h = React.createElement;
    const MAIN_ID = "wujie-canvas";
    const PANEL_URL = "/wujie/";

    const buttonStyle = {
      border: "1px solid #1e2833",
      background: "#111821",
      color: "#b9c7d6",
      borderRadius: 7,
      padding: "3px 8px",
      fontSize: 11,
      cursor: "pointer",
    };
    const primaryButtonStyle = {
      ...buttonStyle,
      borderColor: "#2f9c8c",
      background: "#1f7f72",
      color: "#eafffb",
      fontWeight: 600,
      padding: "7px 14px",
      fontSize: 12,
    };

    function WujiePage() {
      const boxRef = React.useRef(null);
      const [nonce, setNonce] = React.useState(0);
      const [full, setFull] = React.useState(false);
      const [status, setStatus] = React.useState(null);
      const [starting, setStarting] = React.useState(false);
      const [startError, setStartError] = React.useState("");
      const [dismissed, setDismissed] = React.useState(false);

      React.useEffect(() => {
        const onChange = () => setFull(Boolean(document.fullscreenElement));
        document.addEventListener("fullscreenchange", onChange);
        return () => document.removeEventListener("fullscreenchange", onChange);
      }, []);

      React.useEffect(() => {
        let stopped = false;
        const tick = async () => {
          try {
            const response = await fetch("/wujie/__status", { cache: "no-store" });
            const body = await response.json();
            if (!stopped) setStatus(body);
          } catch {
            if (!stopped) setStatus((current) => current || { ok: false, error: "无法连接画布服务" });
          }
        };
        tick();
        const timer = window.setInterval(tick, 5000);
        return () => {
          stopped = true;
          window.clearInterval(timer);
        };
      }, []);

      React.useEffect(() => {
        if (status?.gatewayOk) setDismissed(false);
      }, [status?.gatewayOk]);

      const toggleFullscreen = () => {
        const el = boxRef.current;
        if (!el) return;
        if (document.fullscreenElement) void document.exitFullscreen();
        else void el.requestFullscreen?.();
      };

      const startWorkbench = async () => {
        if (starting || status?.starting) return;
        setStarting(true);
        setStartError("");
        try {
          const response = await fetch("/wujie/__start", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: "{}",
          });
          const body = await response.json();
          if (!response.ok || body.ok === false) throw new Error(body.error || "启动失败");
        } catch (error) {
          setStartError(error?.message || String(error));
        } finally {
          setStarting(false);
        }
      };

      const gatewayOk = status?.gatewayOk === true;
      const comfyOk = status?.comfyOk === true;
      const launcherOk = status?.launcherOk === true;
      const installed = status?.installed !== false;
      const busy = starting || status?.starting === true;
      const showCover = status !== null && !gatewayOk && !dismissed;
      const statusText = status === null
        ? "检查本机工作台…"
        : gatewayOk
          ? `网关在线${comfyOk ? " · ComfyUI 在线" : " · ComfyUI 离线"}`
          : status.starting
            ? "本机工作台启动中…"
            : "本机工作台未启动";
      const statusColor = gatewayOk ? (comfyOk ? "#39d3b8" : "#e5b567") : "#f08a7e";

      return h("div", {
        ref: boxRef,
        style: {
          display: "flex",
          flexDirection: "column",
          height: "100%",
          minHeight: 0,
          background: "#0a0e13",
          color: "#e7eef6",
        },
      },
        h("div", {
          style: {
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "6px 10px",
            borderBottom: "1px solid #1e2833",
            fontSize: 12,
            flex: "0 0 auto",
          },
        },
          h("span", { style: { color: "#dbe6f1", fontWeight: 600, marginRight: 4 } }, "无界画布"),
          h("span", { style: { color: statusColor, fontSize: 11, marginRight: "auto" } }, statusText),
          !gatewayOk && installed ? h("button", {
            type: "button",
            onClick: startWorkbench,
            disabled: busy,
            style: primaryButtonStyle,
          }, busy ? "正在启动…" : "启动工作台") : null,
          h("button", { type: "button", onClick: () => setNonce((value) => value + 1), style: buttonStyle }, "刷新"),
          h("button", { type: "button", onClick: toggleFullscreen, style: buttonStyle }, full ? "退出全屏" : "全屏"),
          h("a", {
            href: PANEL_URL,
            target: "_blank",
            rel: "noreferrer",
            style: { ...buttonStyle, textDecoration: "none", color: "#7fc9bd" },
          }, "新窗口")
        ),
        h("div", {
          style: { position: "relative", flex: 1, minHeight: 0 },
        },
          h("iframe", {
            key: nonce,
            src: PANEL_URL,
            title: "无界画布",
            allow: "clipboard-read; clipboard-write; fullscreen",
            style: { position: "absolute", inset: 0, width: "100%", height: "100%", border: 0, background: "#0a0e13" },
          }),
          showCover ? h("div", {
            style: {
              position: "absolute",
              inset: 0,
              zIndex: 5,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 24,
              background: "rgba(5,8,11,.86)",
              backdropFilter: "blur(4px)",
            },
          },
            h("div", {
              style: {
                width: 460,
                maxWidth: "90%",
                padding: "28px 30px",
                border: "1px solid #1e2833",
                borderRadius: 16,
                background: "#0f151d",
                boxShadow: "0 20px 60px rgba(0,0,0,.45)",
              },
            },
              h("div", { style: { fontSize: 12, letterSpacing: 2, color: "#8593a5", marginBottom: 10 } }, "无界画布"),
              h("h2", { style: { margin: "0 0 10px", fontSize: 20 } }, installed ? "本机工作台未启动" : "未找到无界工作台"),
              h("p", { style: { margin: "0 0 12px", color: "#9aa6b8", fontSize: 13, lineHeight: 1.8 } },
                installed
                  ? "无界画布需要本机网关和 ComfyUI。启动会运行你已安装的工作台（含 ComfyUI），不会重复安装。"
                  : `没有找到工作台目录：${status?.workbenchRoot || "—"}。请先安装，或在插件配置里填写 workbenchRoot。`
              ),
              launcherOk ? h("p", { style: { margin: "0 0 16px", color: "#7fc9bd", fontSize: 12 } }, "检测到启动器已在运行。") : null,
              startError ? h("p", { style: { margin: "0 0 12px", color: "#f08a7e", fontSize: 12 } }, startError) : null,
              h("div", { style: { display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" } },
                installed ? h("button", {
                  type: "button",
                  onClick: startWorkbench,
                  disabled: busy,
                  style: primaryButtonStyle,
                }, busy ? "正在启动…" : "启动本机工作台") : null,
                h("button", {
                  type: "button",
                  onClick: () => setDismissed(true),
                  style: buttonStyle,
                }, "仅浏览画布"),
                launcherOk ? h("a", {
                  href: "http://127.0.0.1:8290/launcher",
                  target: "_blank",
                  rel: "noreferrer",
                  style: { ...buttonStyle, textDecoration: "none", color: "#7fc9bd" },
                }, "打开启动器") : null
              ),
              h("div", { style: { marginTop: 14, fontSize: 11, color: "#5c6a7a", lineHeight: 1.7 } },
                "启动后会自动检测网关；ComfyUI 准备好后即可生成。"
              )
            )
          ) : null
        )
      );
    }

    function WujieIcon({ size = 16 }) {
      return h("svg", {
        width: size,
        height: size,
        viewBox: "0 0 24 24",
        fill: "none",
        "aria-hidden": true,
      }, h("path", {
        d: "M4 4h7v7H4V4Zm9 0h7v7h-7V4ZM4 13h7v7H4v-7Zm9 0h7v7h-7v-7Z",
        fill: "currentColor",
      }));
    }

    function apply(ctx) {
      const ctxInject = ctx.inject;
      if (typeof ctxInject !== "function") return;
      ctxInject.call(ctx, ["layout"], (pageCtx) => {
        const pageSlots = pageCtx.slots;
        const layout = pageCtx.layout;
        if (pageSlots === undefined || layout === undefined) return;
        const stopMain = pageSlots.inject("main", () => pageSlots.register({
          name: "main",
          key: MAIN_ID,
        }, WujiePage));
        const stopSidebar = pageSlots.inject("sidebar.panellist", () => pageSlots.register({
          name: "sidebar.panellist",
          id: MAIN_ID,
          order: 30,
          label: "无界画布",
        }, WujieIcon));
        return () => {
          stopSidebar();
          stopMain();
        };
      });
    }

    return { inject: ["slots"], apply };
  },
});
