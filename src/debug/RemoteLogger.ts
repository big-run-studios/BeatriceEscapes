const FLUSH_INTERVAL = 500;
const MAX_QUEUE = 200;

interface LogEntry {
  ts: number;
  level: string;
  msg: string;
}

export class RemoteLogger {
  private static _instance: RemoteLogger | null = null;
  static get instance(): RemoteLogger | null { return RemoteLogger._instance; }

  private endpoint: string;
  private queue: LogEntry[] = [];
  private flushTimer: ReturnType<typeof setInterval>;
  private origConsole: {
    log: typeof console.log;
    warn: typeof console.warn;
    error: typeof console.error;
  };

  constructor(serverOrigin: string) {
    RemoteLogger._instance = this;
    this.endpoint = `${serverOrigin}/api/remote-log`;
    this.origConsole = {
      log: console.log.bind(console),
      warn: console.warn.bind(console),
      error: console.error.bind(console),
    };

    this.patchConsole();
    this.installErrorHandlers();
    this.flushTimer = setInterval(() => this.flush(), FLUSH_INTERVAL);

    const standalone = (navigator as Record<string, unknown>).standalone === true
      || window.matchMedia("(display-mode: standalone)").matches;
    this.send("info", `RemoteLogger started | UA: ${navigator.userAgent}`);
    this.send("info", `Screen: ${screen.width}x${screen.height} @${devicePixelRatio}x | Touch: ${"ontouchstart" in window} | Standalone: ${standalone}`);
    this.logGamepads();
  }

  send(level: string, msg: string): void {
    this.queue.push({ ts: Date.now(), level, msg });
    if (this.queue.length > MAX_QUEUE) this.queue.shift();
  }

  private logGamepads(): void {
    if (typeof navigator.getGamepads !== "function") {
      this.send("info", "Gamepad API: unavailable");
      return;
    }
    const pads = navigator.getGamepads();
    let found = false;
    for (let i = 0; i < pads.length; i++) {
      if (pads[i]) {
        this.send("info", `Gamepad[${i}]: ${pads[i]!.id} (${pads[i]!.buttons.length} btns, ${pads[i]!.axes.length} axes)`);
        found = true;
      }
    }
    if (!found) this.send("info", "Gamepad: none detected");
  }

  private patchConsole(): void {
    const self = this;
    console.log = (...args: unknown[]) => {
      self.origConsole.log(...args);
      self.send("log", args.map(stringify).join(" "));
    };
    console.warn = (...args: unknown[]) => {
      self.origConsole.warn(...args);
      self.send("warn", args.map(stringify).join(" "));
    };
    console.error = (...args: unknown[]) => {
      self.origConsole.error(...args);
      self.send("error", args.map(stringify).join(" "));
    };
  }

  private installErrorHandlers(): void {
    window.addEventListener("error", (e) => {
      this.send("ERROR", `${e.message} at ${e.filename}:${e.lineno}:${e.colno}`);
    });
    window.addEventListener("unhandledrejection", (e) => {
      const reason = e.reason instanceof Error ? e.reason.message : String(e.reason);
      this.send("REJECT", reason);
    });
  }

  private async flush(): Promise<void> {
    if (this.queue.length === 0) return;
    const batch = this.queue.splice(0);
    try {
      await fetch(this.endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(batch),
        keepalive: true,
      });
    } catch {
      this.origConsole.warn("[RemoteLogger] flush failed, re-queuing", batch.length, "entries");
      this.queue.unshift(...batch);
      if (this.queue.length > MAX_QUEUE) this.queue.length = MAX_QUEUE;
    }
  }

  dispose(): void {
    clearInterval(this.flushTimer);
    console.log = this.origConsole.log;
    console.warn = this.origConsole.warn;
    console.error = this.origConsole.error;
    this.flush();
    RemoteLogger._instance = null;
  }
}

function stringify(v: unknown): string {
  if (typeof v === "string") return v;
  if (v instanceof Error) return `${v.name}: ${v.message}`;
  try { return JSON.stringify(v); } catch { return String(v); }
}
