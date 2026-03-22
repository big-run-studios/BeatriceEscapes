import Phaser from "phaser";
import { GAME_WIDTH, GAME_HEIGHT, COLORS } from "../config/game";
import { InputManager, Action } from "../systems/InputManager";
import { RunState } from "../systems/RunState";
import { BoonDef, RARITY_COLORS } from "../data/boons";

type Phase = "boon_reward" | "boon_choice" | "proceed";

export class RoomMapScene extends Phaser.Scene {
  private inputMgr!: InputManager;
  private runState!: RunState;
  private phase: Phase = "proceed";
  private boonChoices: BoonDef[] = [];
  private selectedBoon = 0;
  private uiObjects: Phaser.GameObjects.GameObject[] = [];
  private inputGrace = 0;
  private rewardBoon: BoonDef | null = null;

  constructor() {
    super({ key: "RoomMapScene" });
  }

  create(): void {
    this.inputMgr = new InputManager(this);
    this.uiObjects = [];
    this.inputGrace = 15;
    this.selectedBoon = 0;

    this.runState = this.game.registry.get("runState") as RunState;
    if (!this.runState) {
      this.scene.start("HubScene");
      return;
    }

    this.drawBackground();

    const nextRoom = this.runState.currentRoomDef;
    if (nextRoom && nextRoom.type === "blessing") {
      this.boonChoices = this.runState.boons.rollBoonChoices(3, this.runState.wizardPool);
      if (this.boonChoices.length > 0) {
        this.phase = "boon_choice";
        this.buildBoonChoiceUI();
      } else {
        this.phase = "proceed";
        this.buildProceedUI();
      }
    } else {
      this.rewardBoon = this.rollRewardBoon();
      if (this.rewardBoon) {
        this.phase = "boon_reward";
        this.buildBoonRewardUI(this.rewardBoon);
      } else {
        this.phase = "proceed";
        this.buildProceedUI();
      }
    }

    this.cameras.main.fadeIn(300, 0, 0, 0);
  }

  private rollRewardBoon(): BoonDef | null {
    const choices = this.runState.boons.rollBoonChoices(1, this.runState.wizardPool);
    return choices.length > 0 ? choices[0] : null;
  }

  update(): void {
    if (this.inputGrace > 0) {
      this.inputGrace--;
      this.inputMgr.postUpdate();
      return;
    }

    switch (this.phase) {
      case "boon_reward": this.updateBoonReward(); break;
      case "boon_choice": this.updateBoonChoice(); break;
      case "proceed": this.updateProceed(); break;
    }
    this.inputMgr.postUpdate();
  }

  // ── Background ──

  private drawBackground(): void {
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x0a0a1a).setDepth(0);

    this.drawRoomMap();
    this.drawBoonBar();
  }

  private drawRoomMap(): void {
    const plan = this.runState.roomPlan;
    const nodeY = 60;
    const nodeSpacing = (GAME_WIDTH - 160) / Math.max(plan.length - 1, 1);
    const startX = 80;

    for (let i = 0; i < plan.length; i++) {
      const x = startX + i * nodeSpacing;
      const room = plan[i];

      const isCurrent = i === this.runState.currentRoom;
      const isDone = i < this.runState.currentRoom;

      let icon = "?";
      let nodeColor = 0x333355;
      if (room.type === "combat") { icon = "\u2694"; nodeColor = 0x664444; }
      if (room.type === "blessing") { icon = "\u2728"; nodeColor = 0x446644; }
      if (room.type === "miniboss") { icon = "\u{1F480}"; nodeColor = 0x664422; }

      if (isDone) nodeColor = 0x222233;
      if (isCurrent) nodeColor = COLORS.hubAccent;

      const circle = this.add.circle(x, nodeY, 18, nodeColor, isDone ? 0.4 : 0.9);
      circle.setStrokeStyle(2, isCurrent ? 0xffffff : 0x555577);
      circle.setDepth(5);

      const iconText = this.add.text(x, nodeY, icon, {
        fontSize: "16px", color: isDone ? "#555555" : "#ffffff",
      });
      iconText.setOrigin(0.5);
      iconText.setDepth(6);

      const label = this.add.text(x, nodeY + 26, room.label, {
        fontFamily: "monospace", fontSize: "8px",
        color: isCurrent ? COLORS.accent : COLORS.subtitleText,
      });
      label.setOrigin(0.5);
      label.setDepth(6);

      if (i < plan.length - 1) {
        const nextX = startX + (i + 1) * nodeSpacing;
        const line = this.add.graphics();
        line.setDepth(4);
        line.lineStyle(2, isDone ? 0x333344 : 0x444466, isDone ? 0.3 : 0.6);
        line.lineBetween(x + 20, nodeY, nextX - 20, nodeY);
      }
    }
  }

  private drawBoonBar(): void {
    const boons = this.runState.boons.activeBoons;
    if (boons.length === 0) return;

    const barY = GAME_HEIGHT - 30;
    const startX = 16;

    const label = this.add.text(startX, barY, `Boons (${boons.length}):`, {
      fontFamily: "monospace", fontSize: "10px", color: COLORS.subtitleText,
    });
    label.setDepth(10);

    let x = startX + label.width + 8;
    for (const boon of boons) {
      const pip = this.add.circle(x, barY + 5, 5, boon.color, 0.9);
      pip.setDepth(10);

      const name = this.add.text(x + 10, barY, boon.name, {
        fontFamily: "monospace", fontSize: "9px", color: "#aaaaaa",
      });
      name.setDepth(10);
      x += name.width + 20;
    }
  }

  // ── Boon Reward (single boon after combat room) ──

  private buildBoonRewardUI(boon: BoonDef): void {
    this.clearUI();

    const title = this.add.text(GAME_WIDTH / 2, 120, "ROOM CLEAR!", {
      fontFamily: "Georgia, serif", fontSize: "36px",
      color: COLORS.accent, fontStyle: "bold",
    });
    title.setOrigin(0.5);
    title.setDepth(10);
    this.uiObjects.push(title);

    const subtitle = this.add.text(GAME_WIDTH / 2, 160, "Merlin offers a boon...", {
      fontFamily: "Georgia, serif", fontSize: "14px",
      color: COLORS.subtitleText, fontStyle: "italic",
    });
    subtitle.setOrigin(0.5);
    subtitle.setDepth(10);
    this.uiObjects.push(subtitle);

    this.drawBoonCard(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 10, boon, true);

    const hint = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 70, "", {
      fontFamily: "monospace", fontSize: "12px", color: COLORS.subtitleText,
    });
    hint.setOrigin(0.5);
    hint.setDepth(20);
    this.uiObjects.push(hint);
    this.time.addEvent({
      delay: 100, loop: true,
      callback: () => {
        if (!hint.active) return;
        const confirm = this.inputMgr.getLabel(Action.CONFIRM);
        hint.setText(`${confirm} to take boon`);
      },
    });
  }

  private updateBoonReward(): void {
    if (this.inputMgr.justPressed(Action.CONFIRM) && this.rewardBoon) {
      this.runState.boons.addBoon(this.rewardBoon);
      this.showBoonAccepted(this.rewardBoon.name);
      this.rewardBoon = null;
      this.phase = "proceed";
      this.time.delayedCall(600, () => {
        this.clearUI();
        this.buildProceedUI();
      });
    }
  }

  // ── Boon Choice (wizard blessing — choose 1 of 3) ──

  private buildBoonChoiceUI(): void {
    this.clearUI();

    const title = this.add.text(GAME_WIDTH / 2, 110, "WIZARD BLESSING", {
      fontFamily: "Georgia, serif", fontSize: "32px",
      color: COLORS.accent, fontStyle: "bold",
    });
    title.setOrigin(0.5);
    title.setDepth(10);
    this.uiObjects.push(title);

    const subtitle = this.add.text(GAME_WIDTH / 2, 145, "\"Choose wisely, little firestarter's family.\" — Merlin", {
      fontFamily: "Georgia, serif", fontSize: "12px",
      color: COLORS.subtitleText, fontStyle: "italic",
    });
    subtitle.setOrigin(0.5);
    subtitle.setDepth(10);
    this.uiObjects.push(subtitle);

    this.drawBoonCards();

    const hint = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 70, "", {
      fontFamily: "monospace", fontSize: "12px", color: COLORS.subtitleText,
    });
    hint.setOrigin(0.5);
    hint.setDepth(20);
    this.uiObjects.push(hint);
    this.time.addEvent({
      delay: 100, loop: true,
      callback: () => {
        if (!hint.active) return;
        const nav = this.inputMgr.lastDevice === "gamepad" ? "L-Stick/D-Pad" : "A/D";
        const confirm = this.inputMgr.getLabel(Action.CONFIRM);
        hint.setText(`${nav} to browse  |  ${confirm} to choose`);
      },
    });
  }

  private drawBoonCards(): void {
    const count = this.boonChoices.length;
    const cardW = 260;
    const gap = 30;
    const totalW = count * cardW + (count - 1) * gap;
    const startX = (GAME_WIDTH - totalW) / 2 + cardW / 2;
    const cy = GAME_HEIGHT / 2 + 10;

    for (let i = 0; i < count; i++) {
      const x = startX + i * (cardW + gap);
      const selected = i === this.selectedBoon;
      this.drawBoonCard(x, cy, this.boonChoices[i], selected);
    }
  }

  private updateBoonChoice(): void {
    let changed = false;
    if (this.inputMgr.justPressed(Action.LEFT)) {
      this.selectedBoon = Math.max(0, this.selectedBoon - 1);
      changed = true;
    }
    if (this.inputMgr.justPressed(Action.RIGHT)) {
      this.selectedBoon = Math.min(this.boonChoices.length - 1, this.selectedBoon + 1);
      changed = true;
    }
    if (changed) {
      this.clearUI();
      this.buildBoonChoiceUI();
    }

    if (this.inputMgr.justPressed(Action.CONFIRM)) {
      const chosen = this.boonChoices[this.selectedBoon];
      this.runState.boons.addBoon(chosen);
      this.showBoonAccepted(chosen.name);
      this.runState.advanceRoom();
      this.phase = "proceed";
      this.time.delayedCall(600, () => this.launchNextRoom());
    }
  }

  // ── Boon Card Rendering ──

  private drawBoonCard(x: number, y: number, boon: BoonDef, selected: boolean): void {
    const cardW = 260;
    const cardH = 280;
    const rarityColor = RARITY_COLORS[boon.rarity];

    const bg = this.add.rectangle(x, y, cardW, cardH, selected ? 0x1a1a3a : 0x111128, 0.95);
    bg.setStrokeStyle(selected ? 3 : 2, selected ? rarityColor : 0x444466);
    bg.setDepth(12);
    this.uiObjects.push(bg);

    const rarityLabel = this.add.text(x, y - cardH / 2 + 18, boon.rarity.toUpperCase(), {
      fontFamily: "monospace", fontSize: "10px",
      color: `#${rarityColor.toString(16).padStart(6, "0")}`,
      fontStyle: "bold",
    });
    rarityLabel.setOrigin(0.5);
    rarityLabel.setDepth(13);
    this.uiObjects.push(rarityLabel);

    const icon = this.add.circle(x, y - cardH / 2 + 60, 22, boon.color, 0.9);
    icon.setStrokeStyle(2, 0xffffff, 0.3);
    icon.setDepth(13);
    this.uiObjects.push(icon);

    const spark = this.add.text(x, y - cardH / 2 + 60, "\u26A1", { fontSize: "20px" });
    spark.setOrigin(0.5);
    spark.setDepth(14);
    this.uiObjects.push(spark);

    const nameText = this.add.text(x, y - cardH / 2 + 100, boon.name, {
      fontFamily: "Georgia, serif", fontSize: "18px",
      color: selected ? COLORS.accent : COLORS.titleText,
      fontStyle: "bold",
    });
    nameText.setOrigin(0.5);
    nameText.setDepth(13);
    this.uiObjects.push(nameText);

    const descText = this.add.text(x, y - cardH / 2 + 130, boon.description, {
      fontFamily: "Georgia, serif", fontSize: "13px",
      color: "#bbbbcc",
      wordWrap: { width: cardW - 30 },
      align: "center",
      lineSpacing: 4,
    });
    descText.setOrigin(0.5, 0);
    descText.setDepth(13);
    this.uiObjects.push(descText);

    const wizardText = this.add.text(x, y + cardH / 2 - 20, `— ${boon.wizard}`, {
      fontFamily: "Georgia, serif", fontSize: "11px",
      color: COLORS.subtitleText, fontStyle: "italic",
    });
    wizardText.setOrigin(0.5);
    wizardText.setDepth(13);
    this.uiObjects.push(wizardText);

    if (selected) {
      const glow = this.add.rectangle(x, y, cardW + 6, cardH + 6, rarityColor, 0.08);
      glow.setDepth(11);
      this.uiObjects.push(glow);
    }
  }

  private showBoonAccepted(name: string): void {
    const text = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 30, name, {
      fontFamily: "Georgia, serif", fontSize: "28px",
      color: COLORS.accent, fontStyle: "bold",
    });
    text.setOrigin(0.5);
    text.setDepth(30);
    text.setAlpha(0);

    this.tweens.add({
      targets: text,
      alpha: 1, y: text.y - 20, scaleX: 1.1, scaleY: 1.1,
      duration: 300, ease: "Back.easeOut",
      onComplete: () => {
        this.tweens.add({
          targets: text,
          alpha: 0, y: text.y - 30,
          duration: 400, delay: 200,
          onComplete: () => text.destroy(),
        });
      },
    });
  }

  // ── Proceed ──

  private buildProceedUI(): void {
    this.clearUI();

    const nextRoom = this.runState.currentRoomDef;
    if (!nextRoom) {
      this.buildZoneCompleteUI();
      return;
    }

    const title = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 20, `Next: ${nextRoom.label}`, {
      fontFamily: "Georgia, serif", fontSize: "28px",
      color: COLORS.titleText, fontStyle: "bold",
    });
    title.setOrigin(0.5);
    title.setDepth(10);
    this.uiObjects.push(title);

    let typeDesc = "Combat Encounter";
    if (nextRoom.type === "blessing") typeDesc = "Wizard Blessing — Choose a Boon";
    if (nextRoom.type === "miniboss") typeDesc = "Mini-Boss Fight";

    const desc = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 15, typeDesc, {
      fontFamily: "monospace", fontSize: "12px", color: COLORS.subtitleText,
    });
    desc.setOrigin(0.5);
    desc.setDepth(10);
    this.uiObjects.push(desc);

    const hint = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 70, "", {
      fontFamily: "monospace", fontSize: "12px", color: COLORS.subtitleText,
    });
    hint.setOrigin(0.5);
    hint.setDepth(20);
    this.uiObjects.push(hint);
    this.time.addEvent({
      delay: 100, loop: true,
      callback: () => {
        if (!hint.active) return;
        const confirm = this.inputMgr.getLabel(Action.CONFIRM);
        hint.setText(`${confirm} to continue`);
      },
    });
  }

  private buildZoneCompleteUI(): void {
    const title = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 40, "ZONE COMPLETE!", {
      fontFamily: "Georgia, serif", fontSize: "44px",
      color: COLORS.accent, fontStyle: "bold",
    });
    title.setOrigin(0.5);
    title.setDepth(10);
    this.uiObjects.push(title);

    const money = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 10, `Earned: ${this.runState.moneyDisplay}`, {
      fontFamily: "Georgia, serif", fontSize: "20px", color: COLORS.moneyText,
    });
    money.setOrigin(0.5);
    money.setDepth(10);
    this.uiObjects.push(money);

    const boonCount = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 40, `Boons collected: ${this.runState.boons.activeBoons.length}`, {
      fontFamily: "monospace", fontSize: "14px", color: COLORS.subtitleText,
    });
    boonCount.setOrigin(0.5);
    boonCount.setDepth(10);
    this.uiObjects.push(boonCount);

    const hint = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 70, "", {
      fontFamily: "monospace", fontSize: "12px", color: COLORS.subtitleText,
    });
    hint.setOrigin(0.5);
    hint.setDepth(20);
    this.uiObjects.push(hint);
    this.time.addEvent({
      delay: 100, loop: true,
      callback: () => {
        if (!hint.active) return;
        const confirm = this.inputMgr.getLabel(Action.CONFIRM);
        hint.setText(`${confirm} to return home`);
      },
    });
  }

  private updateProceed(): void {
    if (this.inputMgr.justPressed(Action.CONFIRM)) {
      const nextRoom = this.runState.currentRoomDef;
      if (nextRoom) {
        this.launchNextRoom();
      } else {
        this.cameras.main.fadeOut(400, 0, 0, 0);
        this.cameras.main.once("camerafadeoutcomplete", () => {
          this.game.registry.remove("runState");
          this.scene.start("HubScene");
        });
      }
    }
  }

  private launchNextRoom(): void {
    const room = this.runState.currentRoomDef;
    if (!room) return;

    if (room.type === "blessing") {
      this.boonChoices = this.runState.boons.rollBoonChoices(3, this.runState.wizardPool);
      if (this.boonChoices.length > 0) {
        this.selectedBoon = 0;
        this.phase = "boon_choice";
        this.clearUI();
        this.buildBoonChoiceUI();
        this.inputGrace = 10;
        return;
      }
      this.runState.advanceRoom();
      this.launchNextRoom();
      return;
    }

    this.cameras.main.fadeOut(300, 0, 0, 0);
    this.cameras.main.once("camerafadeoutcomplete", () => {
      this.scene.start("ArenaScene", {
        mode: "run",
        character: this.runState.character,
        startCount: room.enemyCount,
        startLevel: room.enemyLevel,
      });
    });
  }

  private clearUI(): void {
    for (const obj of this.uiObjects) {
      if (obj && obj.active) obj.destroy();
    }
    this.uiObjects = [];
  }
}
