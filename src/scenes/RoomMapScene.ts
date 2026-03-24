import Phaser from "phaser";
import { GAME_WIDTH, GAME_HEIGHT, COLORS } from "../config/game";
import { InputManager, Action } from "../systems/InputManager";
import { initPSGlyphs, PromptLine, PromptPart, PS_NAV } from "../ui/ButtonGlyphs";
import { RunState, MapNode } from "../systems/RunState";
import { BoonDef, ALL_BOON_ICON_IDS, RARITY_COLORS, SLOT_LABELS } from "../data/boons";
import { AudioManager } from "../systems/AudioManager";

type Phase = "boon_reward" | "boon_choice" | "door_choice" | "zone_complete" | "shop" | "rest";

export class RoomMapScene extends Phaser.Scene {
  private inputMgr!: InputManager;
  private runState!: RunState;
  private phase: Phase = "door_choice";
  private boonChoices: BoonDef[] = [];
  private selectedBoon = 0;
  private selectedDoor = 0;
  private doorChoices: MapNode[] = [];
  private uiObjects: Phaser.GameObjects.GameObject[] = [];
  private inputGrace = 0;
  private restTimer: Phaser.Time.TimerEvent | null = null;
  private rewardBoon: BoonDef | null = null;

  constructor() {
    super({ key: "RoomMapScene" });
  }

  preload(): void {
    const base = (import.meta as Record<string, Record<string, string>>).env?.BASE_URL ?? "/";
    for (const icon of ALL_BOON_ICON_IDS) {
      if (!this.textures.exists(`boon-${icon}`)) {
        this.load.image(`boon-${icon}`, `${base}art/boons/${icon}.png`);
      }
    }
  }

  create(): void {
    this.inputMgr = new InputManager(this);
    initPSGlyphs(this);
    this.uiObjects = [];
    this.inputGrace = 15;
    this.selectedBoon = 0;
    this.selectedDoor = 0;

    this.runState = this.game.registry.get("runState") as RunState;
    if (!this.runState) {
      this.scene.start("HubScene");
      return;
    }

    this.drawBackground();

    if (this.runState.zoneMap) {
      this.handleZoneMapEntry();
    } else {
      this.handleLinearEntry();
    }

    this.cameras.main.fadeIn(300, 0, 0, 0);
  }

  private handleZoneMapEntry(): void {
    const justFinishedNode = this.runState.currentNode;
    const hasVisitedCurrent = justFinishedNode && this.runState.visitedNodes.has(justFinishedNode.id);
    const isRunStart = this.runState.currentNodeId === -1 && this.runState.visitedNodes.size === 0;

    if (isRunStart || (hasVisitedCurrent && justFinishedNode && justFinishedNode.type !== "blessing")) {
      this.boonChoices = this.runState.boons.rollBoonChoices(3, this.runState.wizardPool);
      if (this.boonChoices.length > 0) {
        this.selectedBoon = 0;
        this.phase = "boon_choice";
        this.buildBoonChoiceUI();
        return;
      }
    }

    this.enterDoorChoice();
  }

  private handleLinearEntry(): void {
    const nextRoom = this.runState.currentRoomDef;
    if (nextRoom && nextRoom.type === "blessing") {
      this.rewardBoon = this.rollRewardBoon();
      if (this.rewardBoon) {
        this.phase = "boon_reward";
        this.buildBoonRewardUI(this.rewardBoon);
      } else {
        this.enterDoorChoice();
      }
    } else {
      this.boonChoices = this.runState.boons.rollBoonChoices(3, this.runState.wizardPool);
      if (this.boonChoices.length > 0) {
        this.selectedBoon = 0;
        this.phase = "boon_choice";
        this.buildBoonChoiceUI();
      } else {
        this.enterDoorChoice();
      }
    }
  }

  private enterDoorChoice(): void {
    if (this.runState.zoneMap) {
      this.doorChoices = this.runState.getNextChoices();
      if (this.doorChoices.length === 0) {
        this.phase = "zone_complete";
        this.clearUI();
        this.buildZoneCompleteUI();
        return;
      }
      this.selectedDoor = 0;
      this.phase = "door_choice";
      this.clearUI();
      this.buildDoorChoiceUI();
    } else {
      const nextRoom = this.runState.currentRoomDef;
      if (!nextRoom) {
        this.phase = "zone_complete";
        this.clearUI();
        this.buildZoneCompleteUI();
        return;
      }
      this.phase = "door_choice";
      this.clearUI();
      this.buildLinearProceedUI();
    }
  }

  private rollRewardBoon(): BoonDef | null {
    const choices = this.runState.boons.rollBoonChoices(1, this.runState.wizardPool);
    return choices.length > 0 ? choices[0] : null;
  }

  update(): void {
    AudioManager.instance.heartbeat();

    if (this.inputGrace > 0) {
      this.inputGrace--;
      this.inputMgr.postUpdate();
      return;
    }

    if (this.inputMgr.justPressed(Action.PAUSE)) {
      this.scene.pause();
      this.scene.launch("SettingsScene", { callerKey: "RoomMapScene" });
      this.inputMgr.postUpdate();
      return;
    }

    switch (this.phase) {
      case "boon_reward": this.updateBoonReward(); break;
      case "boon_choice": this.updateBoonChoice(); break;
      case "door_choice": this.updateDoorChoice(); break;
      case "shop": this.updateShop(); break;
      case "zone_complete": this.updateZoneComplete(); break;
      case "rest": this.updateRestStop(); break;
    }
    this.inputMgr.postUpdate();
  }

  // ── Background ──

  private drawBackground(): void {
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x0a0a1a).setDepth(0);

    if (this.runState.zoneMap) {
      this.drawBranchingMap();
    } else {
      this.drawLinearMap();
    }
    this.drawBoonBar();
  }

  // ── Node type visuals ──

  private static NODE_STYLE: Record<string, { icon: string; color: number; darkColor: number }> = {
    combat:   { icon: "\u2694\uFE0F",  color: 0x884444, darkColor: 0x442222 },
    blessing: { icon: "\u2728",        color: 0x448844, darkColor: 0x224422 },
    miniboss: { icon: "\u{1F480}",     color: 0xaa6622, darkColor: 0x553311 },
    boss:     { icon: "\u{1F451}",     color: 0xcc8822, darkColor: 0x664411 },
    rest:     { icon: "\u{1F6CF}\uFE0F", color: 0x446688, darkColor: 0x223344 },
    shop:     { icon: "\u{1F6D2}",     color: 0x668844, darkColor: 0x334422 },
  };

  private static REWARD_ICON: Record<string, string> = {
    gold: "\u{1FA99}",
    boon_gold: "\u{1FA99}\u2728",
    house_currency: "\u{1F3E0}",
  };

  // ── Branching Map Visualization (horizontal, current + next only) ──

  private drawBranchingMap(): void {
    this.nodePositionCache.clear();

    const currentNode = this.runState.currentNode;
    const cy = GAME_HEIGHT / 2 - 10;
    const visitedX = GAME_WIDTH * 0.20;

    if (currentNode && this.runState.visitedNodes.has(currentNode.id)) {
      this.drawVisitedNode(visitedX, cy, currentNode);
      this.nodePositionCache.set(currentNode.id, { x: visitedX, y: cy });
    } else if (this.runState.currentNodeId === -1) {
      const startLabel = this.add.text(visitedX, cy, "START", {
        fontFamily: "Georgia, serif", fontSize: "20px",
        color: COLORS.subtitleText, fontStyle: "bold",
      });
      startLabel.setOrigin(0.5);
      startLabel.setDepth(5);
    }

    this.drawProgressBar();
  }

  private drawVisitedNode(x: number, y: number, node: MapNode): void {
    const style = RoomMapScene.NODE_STYLE[node.type] ?? RoomMapScene.NODE_STYLE.combat;
    const r = 18;

    const circle = this.add.circle(x, y, r, 0x222233, 0.5);
    circle.setStrokeStyle(2, 0x555577);
    circle.setDepth(5);

    const iconText = this.add.text(x, y, style.icon, { fontSize: "16px", color: "#666677" });
    iconText.setOrigin(0.5);
    iconText.setDepth(6);

    const label = this.add.text(x, y + r + 10, node.label, {
      fontFamily: "monospace", fontSize: "9px", color: "#555566",
    });
    label.setOrigin(0.5);
    label.setDepth(6);
  }

  private drawChoiceNode(x: number, y: number, node: MapNode, selected: boolean): Phaser.GameObjects.GameObject[] {
    const objs: Phaser.GameObjects.GameObject[] = [];
    const style = RoomMapScene.NODE_STYLE[node.type] ?? RoomMapScene.NODE_STYLE.combat;
    const r = 40;

    if (selected) {
      const aura = this.add.circle(x, y, r + 16, style.color, 0.12);
      aura.setDepth(4);
      objs.push(aura);

      this.tweens.add({
        targets: aura,
        scaleX: 1.15, scaleY: 1.15, alpha: 0.06,
        duration: 800, yoyo: true, repeat: -1, ease: "Sine.easeInOut",
      });
    }

    const outerRing = this.add.circle(x, y, r, style.darkColor, 0.9);
    outerRing.setStrokeStyle(selected ? 3 : 2, selected ? 0xffffff : 0x444466);
    outerRing.setDepth(5);
    if (!selected) outerRing.setAlpha(0.4);
    objs.push(outerRing);

    const innerCircle = this.add.circle(x, y, r - 8, style.color, selected ? 0.7 : 0.25);
    innerCircle.setDepth(5);
    objs.push(innerCircle);

    const iconText = this.add.text(x, y - 2, style.icon, {
      fontSize: "28px", color: selected ? "#ffffff" : "#666677",
    });
    iconText.setOrigin(0.5);
    iconText.setDepth(6);
    objs.push(iconText);

    const nameText = this.add.text(x, y + r + 10, node.label, {
      fontFamily: "Georgia, serif", fontSize: "13px",
      color: selected ? COLORS.accent : "#555566",
      fontStyle: selected ? "bold" : "normal",
    });
    nameText.setOrigin(0.5);
    nameText.setDepth(6);
    objs.push(nameText);

    const rewardStr = this.getRewardIcon(node);
    if (rewardStr) {
      const rewardText = this.add.text(x, y + r + 28, rewardStr, {
        fontSize: "14px", color: selected ? "#aaaaaa" : "#444455",
      });
      rewardText.setOrigin(0.5);
      rewardText.setDepth(6);
      objs.push(rewardText);
    }

    if (selected) {
      const chevron = this.add.text(x - r - 22, y, "\u276F", {
        fontSize: "24px", color: "#ffffff", fontStyle: "bold",
      });
      chevron.setOrigin(0.5);
      chevron.setDepth(7);
      objs.push(chevron);

      this.tweens.add({
        targets: chevron,
        x: chevron.x + 6,
        duration: 500, yoyo: true, repeat: -1, ease: "Sine.easeInOut",
      });
    }

    return objs;
  }

  private getRewardIcon(node: MapNode): string {
    if (node.reward) return RoomMapScene.REWARD_ICON[node.reward] ?? "";
    if (node.type === "blessing") return "\u2728";
    if (node.type === "rest") return "\u2764\uFE0F";
    if (node.type === "shop") return "\u{1FA99}";
    return "";
  }

  private drawProgressBar(): void {
    const progress = this.runState.visitedNodes.size;
    const total = this.runState.zoneMap!.layerCount;
    const barY = 28;
    const barLeft = 60;
    const barRight = GAME_WIDTH - 60;
    const barW = barRight - barLeft;

    const gfx = this.add.graphics();
    gfx.setDepth(3);
    gfx.lineStyle(1, 0x333355, 0.4);
    gfx.lineBetween(barLeft, barY, barRight, barY);

    for (let i = 0; i < total; i++) {
      const dotX = barLeft + (barW / (total - 1)) * i;
      const done = i < progress;
      const isCurr = i === progress;
      const dotColor = done ? 0x446644 : (isCurr ? 0xccaa44 : 0x2a2a44);
      const dot = this.add.circle(dotX, barY, isCurr ? 5 : 3, dotColor, done ? 0.5 : 0.8);
      dot.setDepth(5);
      if (isCurr) dot.setStrokeStyle(1.5, 0xffffff);
    }
  }

  private drawBezierLine(gfx: Phaser.GameObjects.Graphics, x1: number, y1: number, x2: number, y2: number, color: number, alpha: number): void {
    const cpX = (x1 + x2) / 2;
    const segments = 12;
    gfx.lineStyle(2, color, alpha);
    gfx.beginPath();
    gfx.moveTo(x1, y1);
    for (let i = 1; i <= segments; i++) {
      const t = i / segments;
      const mt = 1 - t;
      const px = mt * mt * x1 + 2 * mt * t * cpX + t * t * x2;
      const py = mt * mt * y1 + 2 * mt * t * ((y1 + y2) / 2) + t * t * y2;
      gfx.lineTo(px, py);
    }
    gfx.strokePath();
  }

  // ── Linear Map (legacy) ──

  private drawLinearMap(): void {
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
    const bs = this.runState.boons;
    const barY = GAME_HEIGHT - 30;
    let x = 16;

    const slotKeys: Array<import("../data/boons").BoonSlot> =
      ["attack", "special", "cast", "dash", "revenge", "block", "aid"];

    let hasAny = false;
    for (const slot of slotKeys) {
      const sb = bs.getSlot(slot);
      if (!sb) continue;
      hasAny = true;
      const tag = SLOT_LABELS[slot].substring(0, 3).toUpperCase();
      const iconKey = sb.boon.icon ? `boon-${sb.boon.icon}` : "";
      if (iconKey && this.textures.exists(iconKey)) {
        const ic = this.add.image(x + 8, barY + 4, iconKey);
        ic.setDisplaySize(18, 18);
        ic.setDepth(10);
      } else {
        const pip = this.add.circle(x + 8, barY + 4, 5, sb.boon.color, 0.9);
        pip.setDepth(10);
      }
      const name = this.add.text(x + 20, barY, `${tag}: ${sb.boon.name} Lv.${sb.level}`, {
        fontFamily: "monospace", fontSize: "9px", color: "#aaaaaa",
      });
      name.setDepth(10);
      x += name.width + 28;
    }

    const passives = bs.activeBoons.filter(b => !b.slot);
    for (const boon of passives) {
      hasAny = true;
      const iconKey = boon.icon ? `boon-${boon.icon}` : "";
      if (iconKey && this.textures.exists(iconKey)) {
        const ic = this.add.image(x + 8, barY + 4, iconKey);
        ic.setDisplaySize(18, 18);
        ic.setDepth(10);
      } else {
        const pip = this.add.circle(x + 8, barY + 4, 5, boon.color, 0.9);
        pip.setDepth(10);
      }
      const stacks = bs.getStackCount(boon.id);
      const suffix = boon.stackable && stacks > 1 ? ` x${stacks}` : "";
      const name = this.add.text(x + 20, barY, boon.name + suffix, {
        fontFamily: "monospace", fontSize: "9px", color: "#aaaaaa",
      });
      name.setDepth(10);
      x += name.width + 28;
    }

    if (!hasAny) return;
  }

  // ── Boon Reward (single boon after combat room) ──

  private buildBoonRewardUI(boon: BoonDef): void {
    this.clearUI();

    const title = this.add.text(GAME_WIDTH / 2, 230, "ROOM CLEAR!", {
      fontFamily: "Georgia, serif", fontSize: "36px",
      color: COLORS.accent, fontStyle: "bold",
    });
    title.setOrigin(0.5);
    title.setDepth(10);
    this.uiObjects.push(title);

    const subtitle = this.add.text(GAME_WIDTH / 2, 268, "Merlin offers a boon...", {
      fontFamily: "Georgia, serif", fontSize: "14px",
      color: COLORS.subtitleText, fontStyle: "italic",
    });
    subtitle.setOrigin(0.5);
    subtitle.setDepth(10);
    this.uiObjects.push(subtitle);

    this.drawBoonCard(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 40, boon, true);

    const hint = new PromptLine(this, GAME_WIDTH / 2, GAME_HEIGHT - 60, this.inputMgr, {
      fontFamily: "monospace", fontSize: "12px", color: COLORS.subtitleText,
    });
    hint.setDepth(20);
    this.uiObjects.push(hint);
    this.time.addEvent({
      delay: 100, loop: true,
      callback: () => {
        if (!hint.active) return;
        hint.setPrompt([Action.CONFIRM, " to take boon"]);
      },
    });
  }

  private updateBoonReward(): void {
    if (this.inputMgr.justPressed(Action.CONFIRM) && this.rewardBoon) {
      this.runState.boons.addBoon(this.rewardBoon);
      this.showBoonAccepted(this.rewardBoon.name);
      this.rewardBoon = null;
      this.time.delayedCall(600, () => this.enterDoorChoice());
    }
  }

  // ── Boon Choice (wizard blessing — choose 1 of 3) ──

  private buildBoonChoiceUI(): void {
    this.clearUI();

    const title = this.add.text(GAME_WIDTH / 2, 220, "Need a Boost?", {
      fontFamily: "Georgia, serif", fontSize: "32px",
      color: COLORS.accent, fontStyle: "bold",
    });
    title.setOrigin(0.5);
    title.setDepth(10);
    this.uiObjects.push(title);

    const subtitle = this.add.text(GAME_WIDTH / 2, 253, "Pick a blessing to power up your hero!", {
      fontFamily: "Georgia, serif", fontSize: "12px",
      color: COLORS.subtitleText, fontStyle: "italic",
    });
    subtitle.setOrigin(0.5);
    subtitle.setDepth(10);
    this.uiObjects.push(subtitle);

    this.drawBoonCards();

    const hint = new PromptLine(this, GAME_WIDTH / 2, GAME_HEIGHT - 60, this.inputMgr, {
      fontFamily: "monospace", fontSize: "12px", color: COLORS.subtitleText,
    });
    hint.setDepth(20);
    this.uiObjects.push(hint);
    this.time.addEvent({
      delay: 100, loop: true,
      callback: () => {
        if (!hint.active) return;
        const isGP = this.inputMgr.lastDevice === "gamepad";
        const nav: PromptPart = isGP ? PS_NAV.STICK_DPAD : "A/D";
        hint.setPrompt([nav, " to browse  |  ", Action.CONFIRM, " to choose"]);
      },
    });
  }

  private drawBoonCards(): void {
    const count = this.boonChoices.length;
    const cardW = 260;
    const gap = 30;
    const totalW = count * cardW + (count - 1) * gap;
    const startX = (GAME_WIDTH - totalW) / 2 + cardW / 2;
    const cy = GAME_HEIGHT / 2 + 50;

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

      if (this.runState.zoneMap) {
        this.runState.markNodeVisited();
        this.time.delayedCall(600, () => this.enterDoorChoice());
      } else {
        this.runState.advanceRoom();
        this.time.delayedCall(600, () => this.launchNextLinearRoom());
      }
    }
  }

  // ── Boon Card Rendering ──

  private drawBoonCard(x: number, y: number, boon: BoonDef, selected: boolean): void {
    const cardW = 260;
    const cardH = 280;
    const rarityColor = RARITY_COLORS[boon.rarity];
    const isSlotted = !!boon.slot;
    const slotInfo = this.runState.boons.getSlotForBoon(boon);
    const stacks = boon.stackable ? this.runState.boons.getStackCount(boon.id) : 0;

    const bg = this.add.rectangle(x, y, cardW, cardH, selected ? 0x1a1a3a : 0x111128, 0.95);
    bg.setStrokeStyle(selected ? 3 : 2, selected ? rarityColor : 0x444466);
    bg.setDepth(12);
    this.uiObjects.push(bg);

    let cursorY = y - cardH / 2 + 14;

    if (isSlotted) {
      const slotLabel = SLOT_LABELS[boon.slot!].toUpperCase() + " SLOT";
      const slotBadge = this.add.text(x, cursorY, slotLabel, {
        fontFamily: "monospace", fontSize: "9px", color: "#cccc88", fontStyle: "bold",
      });
      slotBadge.setOrigin(0.5);
      slotBadge.setDepth(13);
      this.uiObjects.push(slotBadge);

      let actionLabel: string;
      let actionColor: string;
      if (!slotInfo.current) {
        actionLabel = "NEW";
        actionColor = "#44cc44";
      } else if (slotInfo.current.boon.id === boon.id) {
        actionLabel = `LEVEL UP \u2192 Lv.${slotInfo.resultLevel}`;
        actionColor = "#44aaff";
      } else {
        actionLabel = `SWAP \u2192 Lv.${slotInfo.resultLevel}`;
        actionColor = "#ffaa44";
      }
      const actionBadge = this.add.text(x + cardW / 2 - 8, cursorY, actionLabel, {
        fontFamily: "monospace", fontSize: "9px", color: actionColor, fontStyle: "bold",
      });
      actionBadge.setOrigin(1, 0.5);
      actionBadge.setDepth(13);
      this.uiObjects.push(actionBadge);
      cursorY += 14;
    }

    const rarityStr = boon.rarity.toUpperCase();
    let topLabel = rarityStr;
    if (!isSlotted && boon.stackable && stacks > 0) {
      topLabel = `STACK x${stacks} \u2192 x${stacks + 1}`;
    } else if (isSlotted && slotInfo.resultLevel > 1) {
      topLabel = `${rarityStr}  Lv.${slotInfo.resultLevel}`;
    }

    const rarityLabel = this.add.text(x, cursorY, topLabel, {
      fontFamily: "monospace", fontSize: "10px",
      color: `#${rarityColor.toString(16).padStart(6, "0")}`,
      fontStyle: "bold",
    });
    rarityLabel.setOrigin(0.5);
    rarityLabel.setDepth(13);
    this.uiObjects.push(rarityLabel);
    cursorY += 22;

    const iconKey = boon.icon ? `boon-${boon.icon}` : "";
    if (iconKey && this.textures.exists(iconKey)) {
      const iconImg = this.add.image(x, cursorY + 20, iconKey);
      iconImg.setDisplaySize(56, 56);
      iconImg.setDepth(13);
      this.uiObjects.push(iconImg);
    } else {
      const iconFallback = this.add.circle(x, cursorY + 20, 22, boon.color, 0.9);
      iconFallback.setStrokeStyle(2, 0xffffff, 0.3);
      iconFallback.setDepth(13);
      this.uiObjects.push(iconFallback);
    }
    cursorY += 48;

    const nameText = this.add.text(x, cursorY, boon.name, {
      fontFamily: "Georgia, serif", fontSize: "18px",
      color: selected ? COLORS.accent : COLORS.titleText,
      fontStyle: "bold",
    });
    nameText.setOrigin(0.5);
    nameText.setDepth(13);
    this.uiObjects.push(nameText);
    cursorY += 24;

    let descContent = boon.description;
    if (boon.stackable) {
      const nextBonus = this.runState.boons.getNextStackBonus(boon);
      if (nextBonus) {
        descContent += `\n\nNext stack: ${nextBonus}`;
      }
    }

    const descText = this.add.text(x, cursorY, descContent, {
      fontFamily: "Georgia, serif", fontSize: "13px",
      color: "#bbbbcc",
      wordWrap: { width: cardW - 30 },
      align: "center",
      lineSpacing: 4,
    });
    descText.setOrigin(0.5, 0);
    descText.setDepth(13);
    this.uiObjects.push(descText);

    if (isSlotted && slotInfo.current && slotInfo.current.boon.id !== boon.id) {
      const replacesText = this.add.text(x, y + cardH / 2 - 36, `Replaces: ${slotInfo.current.boon.name}`, {
        fontFamily: "Georgia, serif", fontSize: "11px",
        color: "#aa7744", fontStyle: "italic",
      });
      replacesText.setOrigin(0.5);
      replacesText.setDepth(13);
      this.uiObjects.push(replacesText);
    }

    const wizardText = this.add.text(x, y + cardH / 2 - 18, `\u2014 ${boon.wizard}`, {
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
    const text = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2, name, {
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

  // ── Door Choice (branching map — pick next node) ──

  private nodePositionCache = new Map<number, { x: number; y: number }>();

  private buildDoorChoiceUI(): void {
    this.clearUI();

    const count = this.doorChoices.length;
    const cy = GAME_HEIGHT / 2 - 10;
    const choiceX = GAME_WIDTH * 0.55;
    const visitedX = GAME_WIDTH * 0.20;

    const gfx = this.add.graphics();
    gfx.setDepth(3);
    this.uiObjects.push(gfx);

    const currentNode = this.runState.currentNode;
    const fromX = currentNode ? visitedX + 22 : visitedX;
    const fromY = cy;

    if (count === 1) {
      const node = this.doorChoices[0];
      this.nodePositionCache.set(node.id, { x: choiceX, y: cy });
      const objs = this.drawChoiceNode(choiceX, cy, node, true);
      this.uiObjects.push(...objs);

      this.drawBezierLine(gfx, fromX, fromY, choiceX - 44, cy, 0xccaa44, 0.5);

      this.drawFloatingInfo(choiceX, cy, node);
    } else if (count >= 2) {
      const spread = 160;
      for (let i = 0; i < count; i++) {
        const nodeY = cy - spread / 2 + i * (spread / (count - 1));
        const isSelected = i === this.selectedDoor;
        this.nodePositionCache.set(this.doorChoices[i].id, { x: choiceX, y: nodeY });

        const objs = this.drawChoiceNode(choiceX, nodeY, this.doorChoices[i], isSelected);
        this.uiObjects.push(...objs);

        const lineColor = isSelected ? 0xccaa44 : 0x444466;
        const lineAlpha = isSelected ? 0.6 : 0.2;
        this.drawBezierLine(gfx, fromX, fromY, choiceX - 44, nodeY, lineColor, lineAlpha);

        if (isSelected) {
          this.drawFloatingInfo(choiceX, nodeY, this.doorChoices[i]);
        }
      }

      const header = this.add.text(GAME_WIDTH / 2, 60, "CHOOSE YOUR PATH", {
        fontFamily: "Georgia, serif", fontSize: "20px",
        color: COLORS.titleText, fontStyle: "bold",
      });
      header.setOrigin(0.5);
      header.setAlpha(0.6);
      header.setDepth(10);
      this.uiObjects.push(header);
    }

    const hint = new PromptLine(this, GAME_WIDTH / 2, GAME_HEIGHT - 30, this.inputMgr, {
      fontFamily: "monospace", fontSize: "11px", color: "#555566",
    });
    hint.setDepth(20);
    this.uiObjects.push(hint);
    this.time.addEvent({
      delay: 100, loop: true,
      callback: () => {
        if (!hint.active) return;
        const isGP = this.inputMgr.lastDevice === "gamepad";
        const nav: PromptPart = isGP ? PS_NAV.STICK_DPAD : "W/S";
        const parts: PromptPart[] = count > 1
          ? [nav, " to browse  \u2022  ", Action.CONFIRM, " to enter"]
          : [Action.CONFIRM, " to enter"];
        hint.setPrompt(parts);
      },
    });
  }

  private drawFloatingInfo(nodeX: number, nodeY: number, node: MapNode): void {
    const infoX = nodeX + 60;
    const infoY = nodeY - 24;

    let typeDesc = "Combat Encounter";
    if (node.type === "blessing") typeDesc = "Wizard Blessing";
    if (node.type === "miniboss") typeDesc = "Mini-Boss Fight";
    if (node.type === "boss") typeDesc = "Zone Boss";
    if (node.type === "rest") typeDesc = "Rest Stop";
    if (node.type === "shop") typeDesc = "Shop";

    const nameText = this.add.text(infoX, infoY, node.label, {
      fontFamily: "Georgia, serif", fontSize: "18px",
      color: COLORS.accent, fontStyle: "bold",
    });
    nameText.setOrigin(0, 0.5);
    nameText.setDepth(13);
    nameText.setAlpha(0);
    this.uiObjects.push(nameText);

    const typeText = this.add.text(infoX, infoY + 22, typeDesc, {
      fontFamily: "monospace", fontSize: "11px", color: "#777788",
    });
    typeText.setOrigin(0, 0.5);
    typeText.setDepth(13);
    typeText.setAlpha(0);
    this.uiObjects.push(typeText);

    let rewardDesc = "";
    if (node.reward === "gold") rewardDesc = "\u{1FA99}  Gold";
    else if (node.reward === "boon_gold") rewardDesc = "\u2728  Boon + Gold";
    else if (node.reward === "house_currency") rewardDesc = "\u{1F3E0}  House Currency";
    else if (node.type === "blessing") rewardDesc = "\u2728  Choose a Boon";
    else if (node.type === "rest") rewardDesc = "\u2764\uFE0F  Restore HP & MP";
    else if (node.type === "shop") rewardDesc = "\u{1FA99}  Spend Gold";

    const rewardText = this.add.text(infoX, infoY + 42, rewardDesc, {
      fontFamily: "monospace", fontSize: "11px", color: "#99aa88",
    });
    rewardText.setOrigin(0, 0.5);
    rewardText.setDepth(13);
    rewardText.setAlpha(0);
    this.uiObjects.push(rewardText);

    this.tweens.add({
      targets: [nameText, typeText, rewardText],
      alpha: 1, x: "+=4",
      duration: 180, ease: "Quad.easeOut",
    });
  }

  private updateDoorChoice(): void {
    if (this.runState.zoneMap) {
      this.updateBranchingDoorChoice();
    } else {
      this.updateLinearProceed();
    }
  }

  private updateBranchingDoorChoice(): void {
    let changed = false;
    if (this.inputMgr.justPressed(Action.UP)) {
      this.selectedDoor = Math.max(0, this.selectedDoor - 1);
      changed = true;
    }
    if (this.inputMgr.justPressed(Action.DOWN)) {
      this.selectedDoor = Math.min(this.doorChoices.length - 1, this.selectedDoor + 1);
      changed = true;
    }
    if (changed) {
      this.clearUI();
      this.buildDoorChoiceUI();
    }

    if (this.inputMgr.justPressed(Action.CONFIRM)) {
      const chosen = this.doorChoices[this.selectedDoor];
      this.runState.selectNode(chosen.id);

      if (chosen.type === "blessing") {
        this.rewardBoon = this.rollRewardBoon();
        if (this.rewardBoon) {
          this.phase = "boon_reward";
          this.clearUI();
          this.buildBoonRewardUI(this.rewardBoon);
          this.inputGrace = 10;
        } else {
          this.runState.markNodeVisited();
          this.enterDoorChoice();
        }
      } else if (chosen.type === "rest") {
        this.launchRestStop();
      } else if (chosen.type === "shop") {
        this.launchShopStop();
      } else {
        this.launchScrollingRoom(chosen);
      }
    }
  }

  private launchScrollingRoom(node: MapNode): void {
    this.cameras.main.fadeOut(300, 0, 0, 0);
    this.cameras.main.once("camerafadeoutcomplete", () => {
      this.scene.start("ArenaScene", {
        mode: "run",
        character: this.runState.character,
        startCount: node.waves[0]?.entries.reduce((s, e) => s + e.count, 0) ?? 1,
        startLevel: node.waves[0]?.level ?? 1,
      });
    });
  }

  // ── Linear proceed (legacy) ──

  private buildLinearProceedUI(): void {
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
    if (nextRoom.type === "blessing") typeDesc = "Wizard Blessing \u2014 Choose a Boon";
    if (nextRoom.type === "miniboss") typeDesc = "Mini-Boss Fight";

    const desc = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 15, typeDesc, {
      fontFamily: "monospace", fontSize: "12px", color: COLORS.subtitleText,
    });
    desc.setOrigin(0.5);
    desc.setDepth(10);
    this.uiObjects.push(desc);

    const hint = new PromptLine(this, GAME_WIDTH / 2, GAME_HEIGHT - 60, this.inputMgr, {
      fontFamily: "monospace", fontSize: "12px", color: COLORS.subtitleText,
    });
    hint.setDepth(20);
    this.uiObjects.push(hint);
    this.time.addEvent({
      delay: 100, loop: true,
      callback: () => {
        if (!hint.active) return;
        hint.setPrompt([Action.CONFIRM, " to continue"]);
      },
    });
  }

  private updateLinearProceed(): void {
    if (this.inputMgr.justPressed(Action.CONFIRM)) {
      const nextRoom = this.runState.currentRoomDef;
      if (nextRoom) {
        this.launchNextLinearRoom();
      } else {
        this.cameras.main.fadeOut(400, 0, 0, 0);
        this.cameras.main.once("camerafadeoutcomplete", () => {
          this.game.registry.remove("runState");
          this.scene.start("HubScene");
        });
      }
    }
  }

  private launchNextLinearRoom(): void {
    const room = this.runState.currentRoomDef;
    if (!room) return;

    if (room.type === "blessing") {
      this.rewardBoon = this.rollRewardBoon();
      if (this.rewardBoon) {
        this.phase = "boon_reward";
        this.clearUI();
        this.buildBoonRewardUI(this.rewardBoon);
        this.inputGrace = 10;
        return;
      }
      this.runState.advanceRoom();
      this.launchNextLinearRoom();
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

  // ── Rest Stop ──

  private launchRestStop(): void {
    this.clearUI();

    const title = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 60, "\u{1F375} REST STOP", {
      fontFamily: "Georgia, serif", fontSize: "36px",
      color: COLORS.accent, fontStyle: "bold",
    });
    title.setOrigin(0.5);
    title.setDepth(10);
    this.uiObjects.push(title);

    const maxHp = 100;
    const maxMp = 100;
    const hpBefore = this.runState.playerHp < 0 ? maxHp : this.runState.playerHp;
    const mpBefore = this.runState.playerMp < 0 ? maxMp : this.runState.playerMp;
    const hpRestore = Math.min(maxHp - hpBefore, maxHp * 0.5);
    const mpRestore = Math.min(maxMp - mpBefore, maxMp * 0.5);
    this.runState.playerHp = Math.min(maxHp, hpBefore + maxHp * 0.5);
    this.runState.playerMp = Math.min(maxMp, mpBefore + maxMp * 0.5);

    const restoreText = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2, [
      `HP restored: +${Math.round(hpRestore)}  (${Math.round(hpBefore)} \u2192 ${Math.round(this.runState.playerHp)})`,
      `MP restored: +${Math.round(mpRestore)}  (${Math.round(mpBefore)} \u2192 ${Math.round(this.runState.playerMp)})`,
    ].join("\n"), {
      fontFamily: "Georgia, serif", fontSize: "18px",
      color: "#88ccaa", align: "center", lineSpacing: 8,
    });
    restoreText.setOrigin(0.5);
    restoreText.setDepth(10);
    this.uiObjects.push(restoreText);

    const flavor = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 60, "\"Fresh lemonade, on the house!\"", {
      fontFamily: "Georgia, serif", fontSize: "14px",
      color: COLORS.subtitleText, fontStyle: "italic",
    });
    flavor.setOrigin(0.5);
    flavor.setDepth(10);
    this.uiObjects.push(flavor);

    this.runState.markNodeVisited();
    this.phase = "rest";
    this.restTimer = this.time.delayedCall(1500, () => {
      this.restTimer = null;
      this.enterDoorChoice();
    });
  }

  private updateRestStop(): void {
    if (this.inputMgr.justPressed(Action.CONFIRM)) {
      if (this.restTimer) {
        this.restTimer.destroy();
        this.restTimer = null;
      }
      this.enterDoorChoice();
    }
  }

  // ── Shop Stop ──

  private shopItems: { name: string; desc: string; cost: number; bought: boolean }[] = [];
  private selectedShopItem = 0;

  private launchShopStop(): void {
    this.shopItems = [
      { name: "Sandwich", desc: "+20 HP", cost: 3, bought: false },
      { name: "Juice Box", desc: "+20 MP", cost: 3, bought: false },
      { name: "Energy Bar", desc: "+10 HP, +10 MP", cost: 5, bought: false },
      { name: "Lucky Charm", desc: "+$2 bonus", cost: 2, bought: false },
    ];
    this.selectedShopItem = 0;
    this.phase = "shop";
    this.clearUI();
    this.buildShopUI();
  }

  private buildShopUI(): void {
    this.clearUI();

    const title = this.add.text(GAME_WIDTH / 2, 220, "\u{1F6D2} CORNER STORE", {
      fontFamily: "Georgia, serif", fontSize: "28px",
      color: COLORS.accent, fontStyle: "bold",
    });
    title.setOrigin(0.5);
    title.setDepth(10);
    this.uiObjects.push(title);

    const moneyLabel = this.add.text(GAME_WIDTH / 2, 255, `Your money: ${this.runState.moneyDisplay}`, {
      fontFamily: "monospace", fontSize: "14px", color: COLORS.moneyText,
    });
    moneyLabel.setOrigin(0.5);
    moneyLabel.setDepth(10);
    this.uiObjects.push(moneyLabel);

    const cardW = 200;
    const gap = 20;
    const count = this.shopItems.length;
    const totalW = count * cardW + (count - 1) * gap;
    const startX = (GAME_WIDTH - totalW) / 2 + cardW / 2;
    const cy = GAME_HEIGHT / 2 + 30;

    for (let i = 0; i < count; i++) {
      const item = this.shopItems[i];
      const x = startX + i * (cardW + gap);
      const sel = i === this.selectedShopItem;
      const canAfford = this.runState.money >= item.cost && !item.bought;

      const bg = this.add.rectangle(x, cy, cardW, 160, sel ? 0x1a1a3a : 0x111128, 0.95);
      bg.setStrokeStyle(sel ? 3 : 2, sel ? (canAfford ? 0x44aa44 : 0xaa4444) : 0x444466);
      bg.setDepth(12);
      this.uiObjects.push(bg);

      const nameText = this.add.text(x, cy - 45, item.bought ? "\u2714 SOLD" : item.name, {
        fontFamily: "Georgia, serif", fontSize: "18px",
        color: item.bought ? "#555555" : (sel ? COLORS.accent : COLORS.titleText),
        fontStyle: "bold",
      });
      nameText.setOrigin(0.5);
      nameText.setDepth(13);
      this.uiObjects.push(nameText);

      const descText = this.add.text(x, cy - 10, item.desc, {
        fontFamily: "Georgia, serif", fontSize: "14px", color: item.bought ? "#444444" : "#bbbbcc",
      });
      descText.setOrigin(0.5);
      descText.setDepth(13);
      this.uiObjects.push(descText);

      const costText = this.add.text(x, cy + 30, item.bought ? "" : `$${item.cost.toFixed(2)}`, {
        fontFamily: "monospace", fontSize: "14px",
        color: canAfford ? "#44cc44" : "#cc4444",
      });
      costText.setOrigin(0.5);
      costText.setDepth(13);
      this.uiObjects.push(costText);
    }

    const hint = new PromptLine(this, GAME_WIDTH / 2, GAME_HEIGHT - 60, this.inputMgr, {
      fontFamily: "monospace", fontSize: "12px", color: COLORS.subtitleText,
    });
    hint.setDepth(20);
    this.uiObjects.push(hint);
    this.time.addEvent({
      delay: 100, loop: true,
      callback: () => {
        if (!hint.active) return;
        const isGP = this.inputMgr.lastDevice === "gamepad";
        const nav: PromptPart = isGP ? PS_NAV.STICK_DPAD : "A/D";
        hint.setPrompt([nav, " to browse  |  ", Action.CONFIRM, " to buy  |  ", Action.BACK, " to leave"]);
      },
    });
  }

  private updateShop(): void {
    let changed = false;
    if (this.inputMgr.justPressed(Action.LEFT)) {
      this.selectedShopItem = Math.max(0, this.selectedShopItem - 1);
      changed = true;
    }
    if (this.inputMgr.justPressed(Action.RIGHT)) {
      this.selectedShopItem = Math.min(this.shopItems.length - 1, this.selectedShopItem + 1);
      changed = true;
    }
    if (changed) {
      this.clearUI();
      this.buildShopUI();
    }

    if (this.inputMgr.justPressed(Action.CONFIRM)) {
      const item = this.shopItems[this.selectedShopItem];
      if (!item.bought && this.runState.money >= item.cost) {
        this.runState.money -= item.cost;
        item.bought = true;
        this.applyShopItem(item.name);
        this.clearUI();
        this.buildShopUI();
      }
    }

    if (this.inputMgr.justPressed(Action.BACK)) {
      this.runState.markNodeVisited();
      this.enterDoorChoice();
    }
  }

  private applyShopItem(name: string): void {
    const maxHp = 100;
    const maxMp = 100;
    if (this.runState.playerHp < 0) this.runState.playerHp = maxHp;
    if (this.runState.playerMp < 0) this.runState.playerMp = maxMp;

    switch (name) {
      case "Sandwich":
        this.runState.playerHp = Math.min(maxHp, this.runState.playerHp + 20);
        break;
      case "Juice Box":
        this.runState.playerMp = Math.min(maxMp, this.runState.playerMp + 20);
        break;
      case "Energy Bar":
        this.runState.playerHp = Math.min(maxHp, this.runState.playerHp + 10);
        this.runState.playerMp = Math.min(maxMp, this.runState.playerMp + 10);
        break;
      case "Lucky Charm":
        this.runState.money += 2;
        break;
    }
  }

  // ── Zone Complete ──

  private buildZoneCompleteUI(): void {
    const title = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 20, "ZONE COMPLETE!", {
      fontFamily: "Georgia, serif", fontSize: "44px",
      color: COLORS.accent, fontStyle: "bold",
    });
    title.setOrigin(0.5);
    title.setDepth(10);
    this.uiObjects.push(title);

    const money = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 30, `Earned: ${this.runState.moneyDisplay}`, {
      fontFamily: "Georgia, serif", fontSize: "20px", color: COLORS.moneyText,
    });
    money.setOrigin(0.5);
    money.setDepth(10);
    this.uiObjects.push(money);

    const boonCount = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 60, `Boons collected: ${this.runState.boons.activeBoons.length}`, {
      fontFamily: "monospace", fontSize: "14px", color: COLORS.subtitleText,
    });
    boonCount.setOrigin(0.5);
    boonCount.setDepth(10);
    this.uiObjects.push(boonCount);

    const hint = new PromptLine(this, GAME_WIDTH / 2, GAME_HEIGHT - 60, this.inputMgr, {
      fontFamily: "monospace", fontSize: "12px", color: COLORS.subtitleText,
    });
    hint.setDepth(20);
    this.uiObjects.push(hint);
    this.time.addEvent({
      delay: 100, loop: true,
      callback: () => {
        if (!hint.active) return;
        hint.setPrompt([Action.CONFIRM, " to return home"]);
      },
    });
  }

  private updateZoneComplete(): void {
    if (this.inputMgr.justPressed(Action.CONFIRM)) {
      this.cameras.main.fadeOut(400, 0, 0, 0);
      this.cameras.main.once("camerafadeoutcomplete", () => {
        this.game.registry.remove("runState");
        this.scene.start("HubScene");
      });
    }
  }

  private clearUI(): void {
    for (const obj of this.uiObjects) {
      if (obj && obj.active) obj.destroy();
    }
    this.uiObjects = [];
  }
}
