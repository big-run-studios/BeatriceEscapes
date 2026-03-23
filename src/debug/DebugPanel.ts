import Phaser from "phaser";
import { InputManager, Action } from "../systems/InputManager";
import { GAME_WIDTH, GAME_HEIGHT } from "../config/game";

export interface DebugOption {
  id: string;
  label: string;
  enabled: boolean;
  onToggle?: (enabled: boolean) => void;
}

const PANEL_WIDTH = 320;
const PANEL_PADDING = 16;
const ROW_HEIGHT = 28;
const HEADER_HEIGHT = 40;
const DEPTH = 30000;

export class DebugPanel {
  private scene: Phaser.Scene;
  private inputMgr: InputManager;
  private options: DebugOption[] = [];
  private selectedIndex = 0;
  private visible = false;
  private wasComboDown = false;

  private container!: Phaser.GameObjects.Container;
  private bg!: Phaser.GameObjects.Rectangle;
  private headerText!: Phaser.GameObjects.Text;
  private rowTexts: Phaser.GameObjects.Text[] = [];
  private cursor!: Phaser.GameObjects.Rectangle;

  constructor(scene: Phaser.Scene, inputMgr: InputManager) {
    this.scene = scene;
    this.inputMgr = inputMgr;

    this.options = [
      { id: "hitboxes", label: "Show Hitboxes", enabled: false },
      { id: "fps", label: "Show FPS", enabled: false },
      { id: "audio_debug", label: "Audio Debug", enabled: false },
      { id: "invincible", label: "Invincibility", enabled: false },
      { id: "inf_mp", label: "Infinite MP", enabled: false },
      { id: "inf_cooldowns", label: "No Cooldowns", enabled: false },
      { id: "positions", label: "Show Positions", enabled: false },
      { id: "kill_all", label: "Kill All Enemies", enabled: false },
      { id: "slow_mo", label: "Slow Motion (50%)", enabled: false },
    ];

    this.buildUI();
  }

  private buildUI(): void {
    const panelHeight = HEADER_HEIGHT + this.options.length * ROW_HEIGHT + PANEL_PADDING;
    const x = (GAME_WIDTH - PANEL_WIDTH) / 2;
    const y = (GAME_HEIGHT - panelHeight) / 2;

    this.container = this.scene.add.container(0, 0);
    this.container.setScrollFactor(0);
    this.container.setDepth(DEPTH);
    this.container.setVisible(false);

    this.bg = this.scene.add.rectangle(x, y, PANEL_WIDTH, panelHeight, 0x000000, 0.85);
    this.bg.setOrigin(0, 0);
    this.container.add(this.bg);

    const border = this.scene.add.rectangle(x, y, PANEL_WIDTH, panelHeight);
    border.setOrigin(0, 0);
    border.setStrokeStyle(2, 0xffd700);
    this.container.add(border);

    this.headerText = this.scene.add.text(x + PANEL_WIDTH / 2, y + HEADER_HEIGHT / 2, "DEBUG MENU", {
      fontFamily: "monospace",
      fontSize: "16px",
      color: "#ffd700",
      fontStyle: "bold",
    });
    this.headerText.setOrigin(0.5, 0.5);
    this.container.add(this.headerText);

    const divider = this.scene.add.rectangle(x + PANEL_PADDING, y + HEADER_HEIGHT, PANEL_WIDTH - PANEL_PADDING * 2, 1, 0xffd700, 0.5);
    divider.setOrigin(0, 0);
    this.container.add(divider);

    this.cursor = this.scene.add.rectangle(
      x + 4, y + HEADER_HEIGHT + 4,
      PANEL_WIDTH - 8, ROW_HEIGHT - 4, 0xffd700, 0.2,
    );
    this.cursor.setOrigin(0, 0);
    this.container.add(this.cursor);

    for (let i = 0; i < this.options.length; i++) {
      const rowY = y + HEADER_HEIGHT + i * ROW_HEIGHT + ROW_HEIGHT / 2 + 2;
      const text = this.scene.add.text(x + PANEL_PADDING, rowY, "", {
        fontFamily: "monospace",
        fontSize: "13px",
        color: "#ffffff",
      });
      text.setOrigin(0, 0.5);
      this.container.add(text);
      this.rowTexts.push(text);
    }

    const hintY = y + panelHeight - 2;
    const devLabel = this.inputMgr.lastDevice === "gamepad" ? "L2+R2: Close  |  D-Pad: Navigate  |  X: Toggle" : "`: Close  |  W/S: Navigate  |  Enter: Toggle";
    const hint = this.scene.add.text(x + PANEL_WIDTH / 2, hintY, devLabel, {
      fontFamily: "monospace",
      fontSize: "9px",
      color: "#888888",
    });
    hint.setOrigin(0.5, 0);
    this.container.add(hint);

    this.refreshRows();
  }

  private refreshRows(): void {
    for (let i = 0; i < this.options.length; i++) {
      const opt = this.options[i];
      const indicator = opt.enabled ? "[ON] " : "[  ] ";
      const color = opt.enabled ? "#00ff88" : "#cccccc";
      this.rowTexts[i].setText(`${indicator}${opt.label}`);
      this.rowTexts[i].setColor(color);
    }
    this.updateCursor();
  }

  private updateCursor(): void {
    const panelHeight = HEADER_HEIGHT + this.options.length * ROW_HEIGHT + PANEL_PADDING;
    const y = (GAME_HEIGHT - panelHeight) / 2;
    this.cursor.setY(y + HEADER_HEIGHT + this.selectedIndex * ROW_HEIGHT + 2);
  }

  get isOpen(): boolean {
    return this.visible;
  }

  isEnabled(id: string): boolean {
    const opt = this.options.find(o => o.id === id);
    return opt?.enabled ?? false;
  }

  addOption(option: DebugOption): void {
    this.options.push(option);
  }

  update(): void {
    const comboDown = this.inputMgr.bothDown(Action.UTILITY, Action.DEBUG);
    const comboJustPressed = comboDown && !this.wasComboDown;
    this.wasComboDown = comboDown;

    const keyToggle = this.inputMgr.justPressed(Action.DEBUG) && !this.inputMgr.isDown(Action.UTILITY);

    if (comboJustPressed || keyToggle) {
      this.toggle();
      return;
    }

    if (!this.visible) return;

    if (this.inputMgr.justPressed(Action.UP)) {
      this.selectedIndex = (this.selectedIndex - 1 + this.options.length) % this.options.length;
      this.updateCursor();
    }
    if (this.inputMgr.justPressed(Action.DOWN)) {
      this.selectedIndex = (this.selectedIndex + 1) % this.options.length;
      this.updateCursor();
    }
    if (this.inputMgr.justPressed(Action.CONFIRM) || this.inputMgr.justPressed(Action.ATTACK)) {
      this.toggleSelected();
    }
  }

  private toggle(): void {
    this.visible = !this.visible;
    this.container.setVisible(this.visible);
    if (this.visible) {
      this.refreshRows();
    }
  }

  private toggleSelected(): void {
    const opt = this.options[this.selectedIndex];
    opt.enabled = !opt.enabled;
    opt.onToggle?.(opt.enabled);
    this.refreshRows();
  }

  destroy(): void {
    this.container.destroy();
  }
}
