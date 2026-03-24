import { AudioManager } from "../systems/AudioManager";

const MAX_ERRORS = 5;
const HUD_UPDATE_INTERVAL = 500;

interface PlatformInfo {
  browser: string;
  os: string;
  renderer: string;
  screen: string;
  touch: boolean;
  gamepads: string;
}

export class DiagnosticsOverlay {
  private static _instance: DiagnosticsOverlay | null = null;
  static get instance(): DiagnosticsOverlay | null { return DiagnosticsOverlay._instance; }

  private errorOverlay: HTMLDivElement;
  private hudElement: HTMLDivElement;
  private errors: string[] = [];
  private hudInterval: ReturnType<typeof setInterval> | null = null;
  private platform: PlatformInfo;
  private _activeScenes: string[] = [];
  private _inputDevice = "unknown";

  constructor() {
    DiagnosticsOverlay._instance = this;
    this.platform = DiagnosticsOverlay.detectPlatform();

    this.errorOverlay = this.createErrorOverlay();
    this.hudElement = this.createHUD();

    this.installGlobalErrorHandlers();
    this.startHUDUpdates();

    console.log("[Diagnostics] Platform:", this.platform);
  }

  private static detectPlatform(): PlatformInfo {
    const ua = navigator.userAgent;
    let browser = "Unknown";
    if (/CriOS/i.test(ua)) browser = "Chrome (iOS)";
    else if (/FxiOS/i.test(ua)) browser = "Firefox (iOS)";
    else if (/Safari/i.test(ua) && !/Chrome/i.test(ua)) browser = "Safari";
    else if (/Chrome/i.test(ua)) browser = "Chrome";
    else if (/Firefox/i.test(ua)) browser = "Firefox";

    let os = "Unknown";
    if (/iPad|iPhone|iPod/.test(ua)) os = "iOS";
    else if (/Android/.test(ua)) os = "Android";
    else if (/Mac/.test(ua)) os = "macOS";
    else if (/Windows/.test(ua)) os = "Windows";
    else if (/Linux/.test(ua)) os = "Linux";

    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl2") || canvas.getContext("webgl");
    let renderer = "Canvas (no WebGL)";
    if (gl) {
      const ext = (gl as WebGLRenderingContext).getExtension("WEBGL_debug_renderer_info");
      renderer = ext
        ? (gl as WebGLRenderingContext).getParameter(ext.UNMASKED_RENDERER_WEBGL)
        : "WebGL (renderer unknown)";
    }

    const gamepads = navigator.getGamepads
      ? Array.from(navigator.getGamepads()).filter(Boolean).map(g => g!.id).join(", ") || "none"
      : "API unavailable";

    return {
      browser,
      os,
      renderer: renderer.length > 60 ? renderer.substring(0, 57) + "..." : renderer,
      screen: `${screen.width}x${screen.height} @${devicePixelRatio}x`,
      touch: "ontouchstart" in window || navigator.maxTouchPoints > 0,
      gamepads,
    };
  }

  private createErrorOverlay(): HTMLDivElement {
    const el = document.createElement("div");
    el.id = "diag-error-overlay";
    Object.assign(el.style, {
      position: "fixed",
      top: "0",
      left: "0",
      right: "0",
      zIndex: "99999",
      background: "rgba(180, 0, 0, 0.92)",
      color: "#fff",
      fontFamily: "monospace",
      fontSize: "12px",
      padding: "8px 12px",
      display: "none",
      maxHeight: "40vh",
      overflow: "auto",
      pointerEvents: "auto",
      whiteSpace: "pre-wrap",
      wordBreak: "break-word",
    });
    document.body.appendChild(el);
    return el;
  }

  private createHUD(): HTMLDivElement {
    const el = document.createElement("div");
    el.id = "diag-hud";
    Object.assign(el.style, {
      position: "fixed",
      bottom: "8px",
      right: "8px",
      zIndex: "99998",
      background: "rgba(0, 0, 0, 0.65)",
      color: "#0f0",
      fontFamily: "monospace",
      fontSize: "10px",
      lineHeight: "1.4",
      padding: "6px 10px",
      borderRadius: "4px",
      pointerEvents: "none",
      whiteSpace: "pre",
      maxWidth: "320px",
    });
    document.body.appendChild(el);
    return el;
  }

  private installGlobalErrorHandlers(): void {
    window.onerror = (_msg, source, line, col, error) => {
      const text = `${error?.message ?? _msg}\n  at ${source}:${line}:${col}`;
      this.pushError(text);
    };
    window.onunhandledrejection = (e: PromiseRejectionEvent) => {
      const reason = e.reason instanceof Error ? e.reason.message : String(e.reason);
      this.pushError(`Unhandled rejection: ${reason}`);
    };
  }

  private pushError(msg: string): void {
    const ts = new Date().toLocaleTimeString();
    this.errors.push(`[${ts}] ${msg}`);
    if (this.errors.length > MAX_ERRORS) this.errors.shift();
    this.errorOverlay.style.display = "block";
    this.errorOverlay.textContent = this.errors.join("\n\n");
  }

  private startHUDUpdates(): void {
    if (this.hudInterval) return;
    this.hudInterval = setInterval(() => this.refreshHUD(), HUD_UPDATE_INTERVAL);
    this.refreshHUD();
  }

  private refreshHUD(): void {
    const audio = AudioManager.instance;
    const dbg = audio.getDebugInfo();

    const gpList = navigator.getGamepads
      ? Array.from(navigator.getGamepads()).filter(Boolean).map(g => g!.id)
      : [];
    const gpStatus = gpList.length > 0 ? gpList[0]!.substring(0, 30) : "none";

    const lines = [
      `🖥 ${this.platform.browser} | ${this.platform.os}`,
      `📐 ${this.platform.screen} | touch:${this.platform.touch}`,
      `🔊 ctx:${dbg.contextState} | trk:${dbg.currentTrack}`,
      `   conn:${dbg.connected} | hb:${dbg.heartbeatAge}ms`,
      `🎮 ${gpStatus} | dev:${this._inputDevice}`,
      `🎬 ${this._activeScenes.join(",")}`,
    ];
    this.hudElement.textContent = lines.join("\n");
  }

  setActiveScenes(scenes: string[]): void {
    this._activeScenes = scenes;
  }

  setInputDevice(device: string): void {
    this._inputDevice = device;
  }

  dispose(): void {
    if (this.hudInterval) clearInterval(this.hudInterval);
    this.errorOverlay.remove();
    this.hudElement.remove();
    DiagnosticsOverlay._instance = null;
  }
}

export function installSceneLogging(game: Phaser.Game): void {
  const events = game.scene;
  const logSceneEvent = (eventName: string) => (key: string) => {
    console.log(`[Scene] ${eventName}: ${key} @ ${performance.now().toFixed(0)}ms`);
    updateActiveSceneList(game);
  };
  const hookableEvents = ["start", "stop", "pause", "resume", "sleep", "wake"] as const;
  for (const ev of hookableEvents) {
    (events as unknown as Phaser.Events.EventEmitter).on(ev, logSceneEvent(ev));
  }
}

function updateActiveSceneList(game: Phaser.Game): void {
  const diag = DiagnosticsOverlay.instance;
  if (!diag) return;
  const active = game.scene.getScenes(true).map(s => s.scene.key);
  diag.setActiveScenes(active);
}

import Phaser from "phaser";

export function initDiagnostics(game: Phaser.Game): void {
  new DiagnosticsOverlay();
  installSceneLogging(game);

  setInterval(() => updateActiveSceneList(game), 1000);
}
