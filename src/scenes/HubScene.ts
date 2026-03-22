import Phaser from "phaser";
import { GAME_WIDTH, GAME_HEIGHT, COLORS } from "../config/game";
import { InputManager, Action } from "../systems/InputManager";

type HubPanel = "character" | "mode" | "waveConfig";

interface CharSlot {
  id: string;
  name: string;
  locked: boolean;
  color: number;
  desc: string;
}

const CHARACTERS: CharSlot[] = [
  { id: "andrew-bea", name: "Andrew & Bea", locked: false, color: COLORS.andrewFill, desc: "Duo — Dad tank + Magic daughter" },
  { id: "john", name: "John", locked: true, color: COLORS.lockedChar, desc: "Coming Soon" },
  { id: "heather", name: "Heather", locked: true, color: COLORS.lockedChar, desc: "Coming Soon" },
  { id: "luna", name: "Luna", locked: true, color: COLORS.lockedChar, desc: "Coming Soon" },
];

export class HubScene extends Phaser.Scene {
  private inputMgr!: InputManager;
  private panel: HubPanel = "character";

  private charIndex = 0;
  private modeIndex = 0;
  private enemyCount = 3;
  private enemyLevel = 1;
  private selectedChar = "andrew-bea";

  private panelObjects: Phaser.GameObjects.GameObject[] = [];

  constructor() {
    super({ key: "HubScene" });
  }

  create(): void {
    this.inputMgr = new InputManager(this);
    this.charIndex = 0;
    this.modeIndex = 0;
    this.panel = "character";
    this.drawBackground();
    this.showPanel();
  }

  update(): void {
    switch (this.panel) {
      case "character": this.updateCharacterPanel(); break;
      case "mode": this.updateModePanel(); break;
      case "waveConfig": this.updateWaveConfigPanel(); break;
    }
    this.inputMgr.postUpdate();
  }

  private drawBackground(): void {
    const bg = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, COLORS.hubBg);
    bg.setDepth(0);

    const floor = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT - 80, GAME_WIDTH, 160, 0x2a2240);
    floor.setDepth(1);

    const banner = this.add.text(GAME_WIDTH / 2, 40, "BIRTHDAY PARTY HQ", {
      fontFamily: "Georgia, serif", fontSize: "28px", color: COLORS.accent, fontStyle: "bold",
    });
    banner.setOrigin(0.5);
    banner.setDepth(10);

    const subtitle = this.add.text(GAME_WIDTH / 2, 72, "The Bell Family Home", {
      fontFamily: "Georgia, serif", fontSize: "14px", color: COLORS.subtitleText,
    });
    subtitle.setOrigin(0.5);
    subtitle.setDepth(10);

    for (let i = 0; i < 12; i++) {
      const x = 100 + Math.random() * (GAME_WIDTH - 200);
      const y = 90 + Math.random() * 40;
      const colors = [0xdd4444, 0x44aa44, 0x4488dd, 0xddaa44, 0xdd44aa];
      const c = colors[Math.floor(Math.random() * colors.length)];
      const tri = this.add.triangle(x, y, 0, 8, 4, 0, 8, 8, c, 0.5);
      tri.setDepth(5);
      this.tweens.add({
        targets: tri, y: y + 4 + Math.random() * 4, rotation: Math.random() * 0.5,
        duration: 1500 + Math.random() * 1000, yoyo: true, repeat: -1, ease: "Sine.easeInOut",
      });
    }
  }

  private clearPanel(): void {
    for (const obj of this.panelObjects) obj.destroy();
    this.panelObjects = [];
  }

  private showPanel(): void {
    this.clearPanel();
    switch (this.panel) {
      case "character": this.buildCharacterPanel(); break;
      case "mode": this.buildModePanel(); break;
      case "waveConfig": this.buildWaveConfigPanel(); break;
    }
  }

  // ── Character Select ──

  private buildCharacterPanel(): void {
    const title = this.add.text(GAME_WIDTH / 2, 120, "SELECT YOUR FIGHTER", {
      fontFamily: "Georgia, serif", fontSize: "22px", color: COLORS.titleText, fontStyle: "bold",
    });
    title.setOrigin(0.5); title.setDepth(20);
    this.panelObjects.push(title);

    const slotW = 180;
    const slotH = 260;
    const gap = 24;
    const totalW = CHARACTERS.length * slotW + (CHARACTERS.length - 1) * gap;
    const startX = (GAME_WIDTH - totalW) / 2 + slotW / 2;

    for (let i = 0; i < CHARACTERS.length; i++) {
      const ch = CHARACTERS[i];
      const sx = startX + i * (slotW + gap);
      const sy = GAME_HEIGHT / 2 + 20;

      const bg = this.add.rectangle(sx, sy, slotW, slotH, ch.locked ? COLORS.lockedChar : COLORS.hubPanel);
      bg.setStrokeStyle(3, i === this.charIndex ? COLORS.hubAccent : 0x444466);
      bg.setDepth(15);

      const charBody = this.add.rectangle(sx, sy - 40, 36, 60, ch.color);
      charBody.setStrokeStyle(2, ch.locked ? 0x555577 : COLORS.andrewOutline);
      charBody.setDepth(16);
      if (ch.locked) charBody.setAlpha(0.4);

      if (!ch.locked && ch.id === "andrew-bea") {
        const beaSmall = this.add.rectangle(sx, sy - 80, 16, 20, COLORS.beaFill);
        beaSmall.setStrokeStyle(1, COLORS.beaOutline);
        beaSmall.setDepth(17);
        this.panelObjects.push(beaSmall);
      }

      const nameText = this.add.text(sx, sy + 60, ch.name, {
        fontFamily: "Georgia, serif", fontSize: "14px",
        color: ch.locked ? COLORS.subtitleText : COLORS.titleText,
        fontStyle: "bold",
      });
      nameText.setOrigin(0.5); nameText.setDepth(16);

      const descText = this.add.text(sx, sy + 82, ch.desc, {
        fontFamily: "monospace", fontSize: "9px", color: COLORS.subtitleText,
      });
      descText.setOrigin(0.5); descText.setDepth(16);

      if (ch.locked) {
        const lock = this.add.text(sx, sy - 20, "🔒", { fontSize: "28px" });
        lock.setOrigin(0.5); lock.setDepth(18);
        this.panelObjects.push(lock);
      }

      this.panelObjects.push(bg, charBody, nameText, descText);
    }

    const hint = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 40, "", {
      fontFamily: "monospace", fontSize: "12px", color: COLORS.subtitleText,
    });
    hint.setOrigin(0.5); hint.setDepth(20);
    this.panelObjects.push(hint);

    this.time.addEvent({
      delay: 100, loop: true,
      callback: () => {
        const nav = this.inputMgr.lastDevice === "gamepad" ? "L-Stick/D-Pad" : "A/D";
        const confirm = this.inputMgr.getLabel(Action.CONFIRM);
        hint.setText(`${nav} to select  |  ${confirm} to confirm`);
      },
    });
  }

  private updateCharacterPanel(): void {
    if (this.inputMgr.justPressed(Action.LEFT) || this.inputMgr.justPressed(Action.RIGHT)) {
      const dir = this.inputMgr.justPressed(Action.RIGHT) ? 1 : -1;
      this.charIndex = Phaser.Math.Clamp(this.charIndex + dir, 0, CHARACTERS.length - 1);
      this.showPanel();
    }
    if (this.inputMgr.justPressed(Action.CONFIRM)) {
      const ch = CHARACTERS[this.charIndex];
      if (!ch.locked) {
        this.selectedChar = ch.id;
        this.panel = "mode";
        this.showPanel();
      }
    }
  }

  // ── Mode Select ──

  private buildModePanel(): void {
    const title = this.add.text(GAME_WIDTH / 2, 120, "CHOOSE YOUR MODE", {
      fontFamily: "Georgia, serif", fontSize: "22px", color: COLORS.titleText, fontStyle: "bold",
    });
    title.setOrigin(0.5); title.setDepth(20);
    this.panelObjects.push(title);

    const modes = ["Fight Dummies", "Fight Enemies"];
    const cy = GAME_HEIGHT / 2;

    for (let i = 0; i < modes.length; i++) {
      const y = cy - 30 + i * 80;
      const bg = this.add.rectangle(GAME_WIDTH / 2, y, 360, 60, COLORS.hubPanel);
      bg.setStrokeStyle(3, i === this.modeIndex ? COLORS.hubAccent : 0x444466);
      bg.setDepth(15);

      const txt = this.add.text(GAME_WIDTH / 2, y, modes[i], {
        fontFamily: "Georgia, serif", fontSize: "20px",
        color: i === this.modeIndex ? COLORS.accent : COLORS.titleText,
        fontStyle: "bold",
      });
      txt.setOrigin(0.5); txt.setDepth(16);

      this.panelObjects.push(bg, txt);
    }

    const desc = this.add.text(GAME_WIDTH / 2, cy + 140, this.modeIndex === 0
      ? "Train your combos on stationary targets"
      : "Fight waves of robot enemies!", {
      fontFamily: "monospace", fontSize: "11px", color: COLORS.subtitleText,
    });
    desc.setOrigin(0.5); desc.setDepth(16);
    this.panelObjects.push(desc);

    const hint = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 40, "", {
      fontFamily: "monospace", fontSize: "12px", color: COLORS.subtitleText,
    });
    hint.setOrigin(0.5); hint.setDepth(20);
    this.panelObjects.push(hint);

    this.time.addEvent({
      delay: 100, loop: true,
      callback: () => {
        const nav = this.inputMgr.lastDevice === "gamepad" ? "D-Pad" : "W/S";
        const confirm = this.inputMgr.getLabel(Action.CONFIRM);
        const back = this.inputMgr.getLabel(Action.BACK);
        hint.setText(`${nav} to select  |  ${confirm} to confirm  |  ${back} to go back`);
      },
    });
  }

  private updateModePanel(): void {
    if (this.inputMgr.justPressed(Action.UP) || this.inputMgr.justPressed(Action.DOWN)) {
      this.modeIndex = this.modeIndex === 0 ? 1 : 0;
      this.showPanel();
    }
    if (this.inputMgr.justPressed(Action.CONFIRM)) {
      if (this.modeIndex === 0) {
        this.launchArena("dummies");
      } else {
        this.panel = "waveConfig";
        this.showPanel();
      }
    }
    if (this.inputMgr.justPressed(Action.BACK)) {
      this.panel = "character";
      this.showPanel();
    }
  }

  // ── Wave Config ──

  private buildWaveConfigPanel(): void {
    const title = this.add.text(GAME_WIDTH / 2, 120, "WAVE CONFIGURATION", {
      fontFamily: "Georgia, serif", fontSize: "22px", color: COLORS.titleText, fontStyle: "bold",
    });
    title.setOrigin(0.5); title.setDepth(20);
    this.panelObjects.push(title);

    const cy = GAME_HEIGHT / 2 - 40;

    const countLabel = this.add.text(GAME_WIDTH / 2, cy, `Starting Enemies: ${this.enemyCount}`, {
      fontFamily: "Georgia, serif", fontSize: "20px", color: COLORS.titleText,
    });
    countLabel.setOrigin(0.5); countLabel.setDepth(16);

    const levelLabel = this.add.text(GAME_WIDTH / 2, cy + 60, `Starting Level: ${this.enemyLevel}`, {
      fontFamily: "Georgia, serif", fontSize: "20px", color: COLORS.titleText,
    });
    levelLabel.setOrigin(0.5); levelLabel.setDepth(16);

    const countHint = this.add.text(GAME_WIDTH / 2, cy + 24, "← / → to adjust", {
      fontFamily: "monospace", fontSize: "10px", color: COLORS.subtitleText,
    });
    countHint.setOrigin(0.5); countHint.setDepth(16);

    const levelHint = this.add.text(GAME_WIDTH / 2, cy + 84, "← / → to adjust", {
      fontFamily: "monospace", fontSize: "10px", color: COLORS.subtitleText,
    });
    levelHint.setOrigin(0.5); levelHint.setDepth(16);

    const wavePreview = this.add.text(GAME_WIDTH / 2, cy + 140, this.getWavePreview(), {
      fontFamily: "monospace", fontSize: "11px", color: COLORS.accent,
    });
    wavePreview.setOrigin(0.5); wavePreview.setDepth(16);

    const hint = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 40, "", {
      fontFamily: "monospace", fontSize: "12px", color: COLORS.subtitleText,
    });
    hint.setOrigin(0.5); hint.setDepth(20);

    this.panelObjects.push(title, countLabel, levelLabel, countHint, levelHint, wavePreview, hint);

    this.time.addEvent({
      delay: 100, loop: true,
      callback: () => {
        const confirm = this.inputMgr.getLabel(Action.CONFIRM);
        const back = this.inputMgr.getLabel(Action.BACK);
        hint.setText(`${confirm} to start run  |  ${back} to go back`);
        countLabel.setText(`Starting Enemies: ${this.enemyCount}`);
        levelLabel.setText(`Starting Level: ${this.enemyLevel}`);
        wavePreview.setText(this.getWavePreview());
      },
    });
  }

  private selectedRow = 0;

  private updateWaveConfigPanel(): void {
    if (this.inputMgr.justPressed(Action.UP) || this.inputMgr.justPressed(Action.DOWN)) {
      this.selectedRow = this.selectedRow === 0 ? 1 : 0;
    }
    if (this.inputMgr.justPressed(Action.LEFT) || this.inputMgr.justPressed(Action.RIGHT)) {
      const dir = this.inputMgr.justPressed(Action.RIGHT) ? 1 : -1;
      if (this.selectedRow === 0) {
        this.enemyCount = Phaser.Math.Clamp(this.enemyCount + dir, 1, 5);
      } else {
        this.enemyLevel = Phaser.Math.Clamp(this.enemyLevel + dir, 1, 5);
      }
    }
    if (this.inputMgr.justPressed(Action.CONFIRM)) {
      this.launchArena("enemies");
    }
    if (this.inputMgr.justPressed(Action.BACK)) {
      this.panel = "mode";
      this.showPanel();
    }
  }

  private getWavePreview(): string {
    const waves: string[] = [];
    for (let w = 0; w < 3; w++) {
      const c = Math.min(this.enemyCount + w, 5);
      const l = Math.min(this.enemyLevel + w, 5);
      waves.push(`Wave ${w + 1}: ${c} enemies Lv.${l}`);
    }
    return waves.join("  |  ");
  }

  private launchArena(mode: "dummies" | "enemies"): void {
    this.cameras.main.fadeOut(400, 0, 0, 0);
    this.cameras.main.once("camerafadeoutcomplete", () => {
      this.scene.start("ArenaScene", {
        mode,
        character: this.selectedChar,
        startCount: this.enemyCount,
        startLevel: this.enemyLevel,
      });
    });
  }
}
