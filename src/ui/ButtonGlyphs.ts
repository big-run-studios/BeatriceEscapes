import Phaser from "phaser";
import { InputManager, Action } from "../systems/InputManager";

const TEX_SIZE = 48;
const TEX_HALF = TEX_SIZE / 2;

const FACE_BG: Record<number, string> = {
  0: "#3b7dd8",
  1: "#d94444",
  2: "#c24daa",
  3: "#3daa6d",
};

type DrawFn = (ctx: CanvasRenderingContext2D) => void;

function faceDraw(color: string, draw: DrawFn): (scene: Phaser.Scene, key: string) => void {
  return (scene, key) => {
    const c = document.createElement("canvas");
    c.width = TEX_SIZE;
    c.height = TEX_SIZE;
    const ctx = c.getContext("2d")!;

    ctx.beginPath();
    ctx.arc(TEX_HALF, TEX_HALF, TEX_HALF - 2, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();

    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    draw(ctx);

    scene.textures.addCanvas(key, c);
  };
}

const FACE_GENERATORS: Record<number, (scene: Phaser.Scene, key: string) => void> = {
  0: faceDraw(FACE_BG[0], (ctx) => {
    const s = TEX_SIZE * 0.22;
    ctx.beginPath();
    ctx.moveTo(TEX_HALF - s, TEX_HALF - s);
    ctx.lineTo(TEX_HALF + s, TEX_HALF + s);
    ctx.moveTo(TEX_HALF + s, TEX_HALF - s);
    ctx.lineTo(TEX_HALF - s, TEX_HALF + s);
    ctx.stroke();
  }),
  1: faceDraw(FACE_BG[1], (ctx) => {
    ctx.beginPath();
    ctx.arc(TEX_HALF, TEX_HALF, TEX_SIZE * 0.22, 0, Math.PI * 2);
    ctx.stroke();
  }),
  2: faceDraw(FACE_BG[2], (ctx) => {
    const s = TEX_SIZE * 0.2;
    ctx.strokeRect(TEX_HALF - s, TEX_HALF - s, s * 2, s * 2);
  }),
  3: faceDraw(FACE_BG[3], (ctx) => {
    const s = TEX_SIZE * 0.22;
    const h = s * 1.73;
    ctx.beginPath();
    ctx.moveTo(TEX_HALF, TEX_HALF - h * 0.5);
    ctx.lineTo(TEX_HALF + s, TEX_HALF + h * 0.4);
    ctx.lineTo(TEX_HALF - s, TEX_HALF + h * 0.4);
    ctx.closePath();
    ctx.stroke();
  }),
};

function makePill(scene: Phaser.Scene, key: string, label: string): void {
  const c = document.createElement("canvas");
  const tmp = c.getContext("2d")!;
  tmp.font = `bold ${TEX_SIZE * 0.4}px system-ui, sans-serif`;
  const tw = tmp.measureText(label).width;
  const w = Math.max(TEX_SIZE, Math.ceil(tw) + 20);
  c.width = w;
  c.height = TEX_SIZE;
  const ctx = c.getContext("2d")!;

  const r = TEX_SIZE * 0.28;
  ctx.beginPath();
  ctx.moveTo(r + 1, 2);
  ctx.lineTo(w - r - 1, 2);
  ctx.arcTo(w - 2, 2, w - 2, r + 2, r);
  ctx.lineTo(w - 2, TEX_SIZE - r - 2);
  ctx.arcTo(w - 2, TEX_SIZE - 2, w - r - 2, TEX_SIZE - 2, r);
  ctx.lineTo(r + 1, TEX_SIZE - 2);
  ctx.arcTo(2, TEX_SIZE - 2, 2, TEX_SIZE - r - 2, r);
  ctx.lineTo(2, r + 2);
  ctx.arcTo(2, 2, r + 2, 2, r);
  ctx.fillStyle = "#2a2a3a";
  ctx.fill();
  ctx.strokeStyle = "#667788";
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.fillStyle = "#ffffff";
  ctx.font = `bold ${TEX_SIZE * 0.4}px system-ui, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(label, w / 2, TEX_SIZE / 2 + 1);

  scene.textures.addCanvas(key, c);
}

const PILL_DEFS: [string, string][] = [
  ["ps-btn-4", "L1"],
  ["ps-btn-5", "R1"],
  ["ps-btn-6", "L2"],
  ["ps-btn-7", "R2"],
  ["ps-btn-9", "OPTIONS"],
  ["ps-nav-stick", "L-Stick"],
  ["ps-nav-dpad", "D-Pad"],
  ["ps-nav-stick-dpad", "L / D-Pad"],
];

let _initialized = false;

export function initPSGlyphs(scene: Phaser.Scene): void {
  if (_initialized) return;
  _initialized = true;

  for (let i = 0; i <= 3; i++) {
    const key = `ps-btn-${i}`;
    FACE_GENERATORS[i](scene, key);
  }

  for (const [key, label] of PILL_DEFS) {
    makePill(scene, key, label);
  }
}

/* ── Types ─────────────────────────────────────────────────────── */

export interface IconRef {
  readonly icon: string;
}

export type PromptPart = string | Action | IconRef;

export const PS_NAV = {
  STICK: { icon: "ps-nav-stick" } as IconRef,
  DPAD: { icon: "ps-nav-dpad" } as IconRef,
  STICK_DPAD: { icon: "ps-nav-stick-dpad" } as IconRef,
} as const;

/* ── PromptLine ────────────────────────────────────────────────── */

function isIconRef(p: PromptPart): p is IconRef {
  return typeof p === "object" && p !== null && "icon" in p;
}

export type PromptAlign = "center" | "left";

export class PromptLine extends Phaser.GameObjects.Container {
  private style: Phaser.Types.GameObjects.Text.TextStyle;
  private mgr: InputManager;
  private fontSize: number;
  private align: PromptAlign;
  private cacheKey = "";

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    mgr: InputManager,
    style?: Phaser.Types.GameObjects.Text.TextStyle,
    align: PromptAlign = "center",
  ) {
    super(scene, x, y);
    this.mgr = mgr;
    this.style = style ?? {
      fontFamily: "Georgia, serif",
      fontSize: "14px",
      color: "#aabbcc",
    };
    this.fontSize = parseInt(this.style.fontSize as string) || 14;
    this.align = align;
    scene.add.existing(this);
  }

  setPrompt(parts: PromptPart[]): void {
    const key = this.makeKey(parts);
    if (key === this.cacheKey) return;
    this.cacheKey = key;

    this.removeAll(true);
    const isGP = this.mgr.lastDevice === "gamepad";
    let x = 0;

    for (const part of parts) {
      if (typeof part === "string") {
        x += this.addText(x, part);
      } else if (isIconRef(part)) {
        x += this.addIcon(x, part.icon);
      } else {
        if (isGP) {
          const btnIdx = this.mgr.getButtonIndex(part);
          if (btnIdx !== undefined) {
            const texKey = `ps-btn-${btnIdx}`;
            if (this.scene.textures.exists(texKey)) {
              x += this.addIcon(x, texKey);
              continue;
            }
          }
        }
        x += this.addText(x, this.mgr.getLabel(part));
      }
    }

    if (this.align === "center") {
      const half = x / 2;
      for (const child of this.list) {
        (child as Phaser.GameObjects.Image).x -= half;
      }
    }
  }

  private addText(x: number, str: string): number {
    const t = this.scene.add.text(x, 0, str, { ...this.style });
    t.setOrigin(0, 0.5);
    this.add(t);
    return t.width;
  }

  private addIcon(x: number, texKey: string): number {
    if (!this.scene.textures.exists(texKey)) return 0;
    const img = this.scene.add.image(x, 0, texKey);
    img.setOrigin(0, 0.5);
    const scale = (this.fontSize * 1.5) / img.height;
    img.setScale(scale);
    this.add(img);
    return img.displayWidth + 2;
  }

  private makeKey(parts: PromptPart[]): string {
    const d = this.mgr.lastDevice;
    return d + "|" + parts.map(p => {
      if (typeof p === "string") return p;
      if (isIconRef(p)) return `I:${p.icon}`;
      return `A:${p}`;
    }).join("\0");
  }
}
