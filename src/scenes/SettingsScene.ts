import Phaser from "phaser";
import { GAME_WIDTH, GAME_HEIGHT, COLORS } from "../config/game";
import { InputManager, Action } from "../systems/InputManager";
import { AudioManager } from "../systems/AudioManager";
import { initPSGlyphs } from "../ui/ButtonGlyphs";

type SubPanel = "main" | "credits";

interface SliderDef {
  label: string;
  get: () => number;
  set: (v: number) => void;
}

interface MenuRow {
  type: "slider" | "button";
  label: string;
  slider?: SliderDef;
  action?: () => void;
}

const OVERLAY_DEPTH = 1000;
const PANEL_W = 520;
const PANEL_H = 440;
const SLIDER_W = 260;
const SLIDER_H = 14;
const ROW_H = 52;
const STEP = 0.1;

export class SettingsScene extends Phaser.Scene {
  private inputMgr!: InputManager;
  private callerKey = "";
  private subPanel: SubPanel = "main";
  private cursor = 0;
  private rows: MenuRow[] = [];
  private uiObjects: Phaser.GameObjects.GameObject[] = [];
  private inputGrace = 0;

  constructor() {
    super({ key: "SettingsScene" });
  }

  init(data: { callerKey?: string }): void {
    this.callerKey = data?.callerKey ?? "";
  }

  create(): void {
    this.inputMgr = new InputManager(this);
    initPSGlyphs(this);
    this.cursor = 0;
    this.subPanel = "main";
    this.uiObjects = [];
    this.inputGrace = 8;

    this.buildMainPanel();
  }

  update(): void {
    AudioManager.instance.heartbeat();

    if (this.inputGrace > 0) {
      this.inputGrace--;
      this.inputMgr.postUpdate();
      return;
    }

    if (this.subPanel === "main") {
      this.updateMainPanel();
    } else {
      this.updateCreditsPanel();
    }

    this.inputMgr.postUpdate();
  }

  private clearUI(): void {
    for (const obj of this.uiObjects) {
      if (obj && obj.active) obj.destroy();
    }
    this.uiObjects = [];
  }

  // ── Main Panel ──

  private buildMainPanel(): void {
    this.clearUI();
    this.subPanel = "main";

    const audio = AudioManager.instance;
    this.rows = [
      {
        type: "slider", label: "Master Volume",
        slider: { label: "Master", get: () => audio.masterVolume, set: (v) => { audio.masterVolume = v; } },
      },
      {
        type: "slider", label: "Music Volume",
        slider: { label: "Music", get: () => audio.musicVolume, set: (v) => { audio.musicVolume = v; } },
      },
      {
        type: "slider", label: "SFX Volume",
        slider: { label: "SFX", get: () => audio.sfxVolume, set: (v) => { audio.sfxVolume = v; } },
      },
      { type: "button", label: "Credits", action: () => this.showCredits() },
      { type: "button", label: "Return to Title", action: () => this.returnToTitle() },
      { type: "button", label: "Resume", action: () => this.resume() },
    ];

    if (this.cursor >= this.rows.length) this.cursor = 0;

    const cx = GAME_WIDTH / 2;
    const cy = GAME_HEIGHT / 2;

    const backdrop = this.add.rectangle(cx, cy, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.7);
    backdrop.setDepth(OVERLAY_DEPTH);
    this.uiObjects.push(backdrop);

    const panelBg = this.add.rectangle(cx, cy, PANEL_W, PANEL_H, 0x12122a, 0.95);
    panelBg.setStrokeStyle(2, 0xc9944a);
    panelBg.setDepth(OVERLAY_DEPTH + 1);
    this.uiObjects.push(panelBg);

    const title = this.add.text(cx, cy - PANEL_H / 2 + 32, "SETTINGS", {
      fontFamily: "Georgia, serif",
      fontSize: "28px",
      color: COLORS.accent,
      fontStyle: "bold",
    });
    title.setOrigin(0.5);
    title.setDepth(OVERLAY_DEPTH + 2);
    this.uiObjects.push(title);

    const divider = this.add.rectangle(cx, cy - PANEL_H / 2 + 56, PANEL_W - 60, 1, 0x444466);
    divider.setDepth(OVERLAY_DEPTH + 2);
    this.uiObjects.push(divider);

    const startY = cy - PANEL_H / 2 + 86;

    for (let i = 0; i < this.rows.length; i++) {
      const row = this.rows[i];
      const y = startY + i * ROW_H;
      const selected = i === this.cursor;

      if (row.type === "slider" && row.slider) {
        this.drawSliderRow(cx, y, row.slider, selected);
      } else {
        this.drawButtonRow(cx, y, row.label, selected);
      }
    }

    const hintY = cy + PANEL_H / 2 - 22;
    const hintText = this.inputMgr.lastDevice === "gamepad"
      ? "D-Pad navigate  |  X confirm  |  O / Options close"
      : "W/S navigate  |  A/D adjust  |  Space confirm  |  Esc close";
    const hint = this.add.text(cx, hintY, hintText, {
      fontFamily: "monospace", fontSize: "11px", color: COLORS.subtitleText,
    });
    hint.setOrigin(0.5);
    hint.setDepth(OVERLAY_DEPTH + 2);
    this.uiObjects.push(hint);
  }

  private drawSliderRow(cx: number, y: number, slider: SliderDef, selected: boolean): void {
    const labelX = cx - PANEL_W / 2 + 40;
    const sliderX = cx + 40;
    const val = slider.get();
    const pct = Math.round(val * 100);

    const label = this.add.text(labelX, y, slider.label, {
      fontFamily: "Georgia, serif", fontSize: "16px",
      color: selected ? COLORS.accent : COLORS.titleText,
      fontStyle: selected ? "bold" : "normal",
    });
    label.setOrigin(0, 0.5);
    label.setDepth(OVERLAY_DEPTH + 3);
    this.uiObjects.push(label);

    const trackBg = this.add.rectangle(sliderX, y, SLIDER_W, SLIDER_H, 0x1a1a3a);
    trackBg.setOrigin(0, 0.5);
    trackBg.setStrokeStyle(1, selected ? 0xc9944a : 0x444466);
    trackBg.setDepth(OVERLAY_DEPTH + 3);
    this.uiObjects.push(trackBg);

    const fillW = Math.max(2, SLIDER_W * val);
    const fill = this.add.rectangle(sliderX, y, fillW, SLIDER_H - 4, selected ? 0xc9944a : 0x6688aa);
    fill.setOrigin(0, 0.5);
    fill.setDepth(OVERLAY_DEPTH + 4);
    this.uiObjects.push(fill);

    const pctText = this.add.text(sliderX + SLIDER_W + 12, y, `${pct}%`, {
      fontFamily: "monospace", fontSize: "14px",
      color: selected ? COLORS.accent : COLORS.subtitleText,
    });
    pctText.setOrigin(0, 0.5);
    pctText.setDepth(OVERLAY_DEPTH + 3);
    this.uiObjects.push(pctText);

    if (selected) {
      const arrowL = this.add.text(sliderX - 16, y, "\u25C0", {
        fontSize: "12px", color: COLORS.accent,
      });
      arrowL.setOrigin(0.5);
      arrowL.setDepth(OVERLAY_DEPTH + 4);
      this.uiObjects.push(arrowL);

      const arrowR = this.add.text(sliderX + SLIDER_W + 44, y, "\u25B6", {
        fontSize: "12px", color: COLORS.accent,
      });
      arrowR.setOrigin(0.5);
      arrowR.setDepth(OVERLAY_DEPTH + 4);
      this.uiObjects.push(arrowR);
    }
  }

  private drawButtonRow(cx: number, y: number, label: string, selected: boolean): void {
    const btnW = PANEL_W - 80;
    const btnH = 38;

    const bg = this.add.rectangle(cx, y, btnW, btnH, selected ? 0x2a3344 : 0x1a1a30);
    bg.setStrokeStyle(selected ? 2 : 1, selected ? 0xc9944a : 0x444466);
    bg.setDepth(OVERLAY_DEPTH + 3);
    this.uiObjects.push(bg);

    const text = this.add.text(cx, y, label, {
      fontFamily: "Georgia, serif", fontSize: "18px",
      color: selected ? COLORS.accent : COLORS.titleText,
      fontStyle: selected ? "bold" : "normal",
    });
    text.setOrigin(0.5);
    text.setDepth(OVERLAY_DEPTH + 4);
    this.uiObjects.push(text);

    if (selected) {
      const marker = this.add.text(cx - btnW / 2 + 12, y, "\u25B8", {
        fontSize: "16px", color: COLORS.accent,
      });
      marker.setOrigin(0, 0.5);
      marker.setDepth(OVERLAY_DEPTH + 4);
      this.uiObjects.push(marker);
    }
  }

  private updateMainPanel(): void {
    let changed = false;

    if (this.inputMgr.justPressed(Action.UP)) {
      this.cursor = (this.cursor - 1 + this.rows.length) % this.rows.length;
      changed = true;
    }
    if (this.inputMgr.justPressed(Action.DOWN)) {
      this.cursor = (this.cursor + 1) % this.rows.length;
      changed = true;
    }

    const row = this.rows[this.cursor];
    if (row.type === "slider" && row.slider) {
      const pressedLeft = this.inputMgr.justPressed(Action.LEFT);
      const pressedRight = this.inputMgr.justPressed(Action.RIGHT);
      if (pressedLeft) {
        row.slider.set(Math.max(0, row.slider.get() - STEP));
        changed = true;
      }
      if (pressedRight) {
        row.slider.set(Math.min(1, row.slider.get() + STEP));
        changed = true;
      }
    }

    if (this.inputMgr.justPressed(Action.CONFIRM)) {
      if (row.type === "button" && row.action) {
        row.action();
        return;
      }
    }

    if (this.inputMgr.justPressed(Action.BACK) || this.inputMgr.justPressed(Action.PAUSE)) {
      this.resume();
      return;
    }

    if (changed) {
      this.buildMainPanel();
    }
  }

  // ── Credits Panel ──

  private showCredits(): void {
    this.clearUI();
    this.subPanel = "credits";

    const cx = GAME_WIDTH / 2;
    const cy = GAME_HEIGHT / 2;

    const backdrop = this.add.rectangle(cx, cy, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.7);
    backdrop.setDepth(OVERLAY_DEPTH);
    this.uiObjects.push(backdrop);

    const panelBg = this.add.rectangle(cx, cy, PANEL_W, 320, 0x12122a, 0.95);
    panelBg.setStrokeStyle(2, 0xc9944a);
    panelBg.setDepth(OVERLAY_DEPTH + 1);
    this.uiObjects.push(panelBg);

    const title = this.add.text(cx, cy - 110, "CREDITS", {
      fontFamily: "Georgia, serif", fontSize: "28px",
      color: COLORS.accent, fontStyle: "bold",
    });
    title.setOrigin(0.5);
    title.setDepth(OVERLAY_DEPTH + 2);
    this.uiObjects.push(title);

    const divider = this.add.rectangle(cx, cy - 84, PANEL_W - 60, 1, 0x444466);
    divider.setDepth(OVERLAY_DEPTH + 2);
    this.uiObjects.push(divider);

    const devLabel = this.add.text(cx, cy - 40, "Developer", {
      fontFamily: "Georgia, serif", fontSize: "14px",
      color: COLORS.subtitleText,
    });
    devLabel.setOrigin(0.5);
    devLabel.setDepth(OVERLAY_DEPTH + 2);
    this.uiObjects.push(devLabel);

    const devName = this.add.text(cx, cy - 14, "Andrew Bell", {
      fontFamily: "Georgia, serif", fontSize: "22px",
      color: COLORS.titleText, fontStyle: "bold",
    });
    devName.setOrigin(0.5);
    devName.setDepth(OVERLAY_DEPTH + 2);
    this.uiObjects.push(devName);

    const thanksLabel = this.add.text(cx, cy + 30, "Special Thanks", {
      fontFamily: "Georgia, serif", fontSize: "14px",
      color: COLORS.subtitleText,
    });
    thanksLabel.setOrigin(0.5);
    thanksLabel.setDepth(OVERLAY_DEPTH + 2);
    this.uiObjects.push(thanksLabel);

    const thanksNames = this.add.text(cx, cy + 58, "Heather, John, Bea, and Luna Bell", {
      fontFamily: "Georgia, serif", fontSize: "18px",
      color: COLORS.titleText,
    });
    thanksNames.setOrigin(0.5);
    thanksNames.setDepth(OVERLAY_DEPTH + 2);
    this.uiObjects.push(thanksNames);

    const backHint = this.add.text(cx, cy + 120, "Press Esc / B to go back", {
      fontFamily: "monospace", fontSize: "12px",
      color: COLORS.subtitleText,
    });
    backHint.setOrigin(0.5);
    backHint.setDepth(OVERLAY_DEPTH + 2);
    this.uiObjects.push(backHint);
  }

  private updateCreditsPanel(): void {
    if (this.inputMgr.justPressed(Action.BACK) || this.inputMgr.justPressed(Action.PAUSE)) {
      this.cursor = 0;
      this.inputGrace = 6;
      this.buildMainPanel();
    }
  }

  // ── Actions ──

  private resume(): void {
    if (this.callerKey) {
      this.scene.resume(this.callerKey);
      if (this.callerKey === "ArenaScene" && this.scene.isActive("CombatHUDScene")) {
        this.scene.resume("CombatHUDScene");
      }
    }
    this.scene.stop();
  }

  private returnToTitle(): void {
    const scenesToStop = ["ArenaScene", "HubScene", "RoomMapScene", "NarrativeScene", "CombatHUDScene"];
    for (const key of scenesToStop) {
      if (this.scene.isActive(key) || this.scene.isPaused(key)) {
        this.scene.stop(key);
      }
    }
    AudioManager.instance.stopMusic(0.3);
    this.scene.start("TitleScene");
  }
}
