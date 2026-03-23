import Phaser from "phaser";
import { GAME_WIDTH, GAME_HEIGHT, COLORS } from "../config/game";
import { InputManager, Action } from "../systems/InputManager";
import { initPSGlyphs, PromptLine, PromptPart, PS_NAV } from "../ui/ButtonGlyphs";
import { RunState, generateZone1Map } from "../systems/RunState";
import { BoonDef, ALL_BOON_POOLS, ALL_BOON_ICON_IDS, RARITY_COLORS, SLOT_LABELS } from "../data/boons";
import { AudioManager } from "../systems/AudioManager";

type HubPanel = "character" | "mode" | "waveConfig" | "boonSelect";

interface CharSlot {
  id: string;
  name: string;
  locked: boolean;
  color: number;
  cardBg: number;
  desc: string;
  role: string;
  icon: string;
}

const CHARACTERS: CharSlot[] = [
  { id: "andrew-bea", name: "Andrew & Bea", locked: false, color: COLORS.andrewFill, cardBg: 0x1e3354, desc: "Dad tank + Magic daughter", role: "Tank + Mage", icon: "\u2694\uFE0F" },
  { id: "john", name: "John", locked: false, color: COLORS.johnFill, cardBg: 0x2a4428, desc: "Bat, Slingshot & Parry", role: "Gadget Kid", icon: "\uD83C\uDFCF" },
  { id: "heather", name: "Heather", locked: false, color: 0x884444, cardBg: 0x3e1a3a, desc: "Tap to fight, hold to charge totems", role: "Totem Amplifier", icon: "\uD83D\uDD2E" },
  { id: "luna", name: "Luna", locked: false, color: 0x2a1a3a, cardBg: 0x1a1a38, desc: "Fast bites \u2194 Lunar werewolf", role: "Dual-Mode Dog", icon: "\uD83D\uDC3A" },
];

const MODE_ICONS = ["\u2694\uFE0F", "\uD83C\uDFAF", "\uD83E\uDD16", "\uD83D\uDCDA"];

export class HubScene extends Phaser.Scene {
  private inputMgr!: InputManager;
  private panel: HubPanel = "character";

  private charIndex = 0;
  private modeIndex = 0;
  private enemyCount = 3;
  private enemyLevel = 1;
  private selectedChar = "andrew-bea";
  private selectedRow = 0;

  private panelObjects: Phaser.GameObjects.GameObject[] = [];
  private panelTimers: Phaser.Time.TimerEvent[] = [];
  private launching = false;
  private inputGracePeriod = 0;

  private allBoons: BoonDef[] = [];
  private selectedBoons: Set<string> = new Set();
  private boonCursor = 0;
  private boonScrollOffset = 0;

  private static readonly HERO_KEYS = ["andrew-bea", "john", "heather", "luna"];

  constructor() {
    super({ key: "HubScene" });
  }

  preload(): void {
    const base = (import.meta as Record<string, Record<string, string>>).env?.BASE_URL ?? "/";
    for (const id of HubScene.HERO_KEYS) {
      if (!this.textures.exists(`hero-${id}`)) {
        this.load.image(`hero-${id}`, `${base}art/heroes/${id}.png`);
      }
    }
    for (const icon of ALL_BOON_ICON_IDS) {
      if (!this.textures.exists(`boon-${icon}`)) {
        this.load.image(`boon-${icon}`, `${base}art/boons/${icon}.png`);
      }
    }
  }

  create(): void {
    const params = new URLSearchParams(window.location.search);
    const qaParam = params.get("qa");
    if (qaParam) {
      const character = params.get("qaChar") || "heather";
      const mode = (params.get("qaMode") || "dummies") as "dummies" | "enemies";
      this.scene.start("ArenaScene", {
        mode,
        character,
        startCount: 3,
        startLevel: 1,
      });
      return;
    }

    this.inputMgr = new InputManager(this);
    initPSGlyphs(this);
    this.charIndex = 0;
    this.modeIndex = 0;
    this.selectedRow = 0;
    this.panel = "character";
    this.panelObjects = [];
    this.panelTimers = [];
    this.launching = false;
    this.inputGracePeriod = 12;

    this.drawBackground();
    this.showPanel();
    this.cameras.main.fadeIn(400, 0, 0, 0);

    AudioManager.instance.playMusic("hub");
  }

  update(): void {
    AudioManager.instance.heartbeat();

    if (this.launching) {
      this.inputMgr.postUpdate();
      return;
    }

    if (this.inputGracePeriod > 0) {
      this.inputGracePeriod--;
      this.inputMgr.postUpdate();
      return;
    }

    switch (this.panel) {
      case "character": this.updateCharacterPanel(); break;
      case "mode": this.updateModePanel(); break;
      case "waveConfig": this.updateWaveConfigPanel(); break;
      case "boonSelect": this.updateBoonSelectPanel(); break;
    }
    this.inputMgr.postUpdate();
  }

  // ── Background ──

  private drawBackground(): void {
    const bg = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, COLORS.hubBg);
    bg.setDepth(0);

    const floor = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT - 80, GAME_WIDTH, 160, 0x2a2240);
    floor.setDepth(1);

    const banner = this.add.text(GAME_WIDTH / 2, 36, "\uD83C\uDF89  BIRTHDAY PARTY HQ  \uD83C\uDF89", {
      fontFamily: "Georgia, serif", fontSize: "36px", color: COLORS.accent, fontStyle: "bold",
    });
    banner.setOrigin(0.5);
    banner.setDepth(10);

    const subtitle = this.add.text(GAME_WIDTH / 2, 72, "The Bell Family Home", {
      fontFamily: "Georgia, serif", fontSize: "16px", color: COLORS.subtitleText,
    });
    subtitle.setOrigin(0.5);
    subtitle.setDepth(10);

    const divider = this.add.rectangle(GAME_WIDTH / 2, 92, 320, 2, COLORS.hubAccent, 0.4);
    divider.setDepth(10);

    for (let i = 0; i < 12; i++) {
      const x = 100 + Math.random() * (GAME_WIDTH - 200);
      const y = 100 + Math.random() * 30;
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
    for (const t of this.panelTimers) t.destroy();
    this.panelTimers = [];
    for (const obj of this.panelObjects) {
      if (obj && obj.active) obj.destroy();
    }
    this.panelObjects = [];
  }

  private showPanel(): void {
    this.clearPanel();
    switch (this.panel) {
      case "character": this.buildCharacterPanel(); break;
      case "mode": this.buildModePanel(); break;
      case "waveConfig": this.buildWaveConfigPanel(); break;
      case "boonSelect": this.buildBoonSelectPanel(); break;
    }
  }

  private makeHint(y = GAME_HEIGHT - 36): PromptLine {
    const hint = new PromptLine(this, GAME_WIDTH / 2, y, this.inputMgr, {
      fontFamily: "Georgia, serif", fontSize: "14px", color: COLORS.subtitleText,
    });
    hint.setDepth(20);
    this.panelObjects.push(hint);
    return hint;
  }

  // ── Character Select ──

  private buildCharacterPanel(): void {
    const title = this.add.text(GAME_WIDTH / 2, 118, "\u2B50  SELECT YOUR FIGHTER  \u2B50", {
      fontFamily: "Georgia, serif", fontSize: "24px", color: COLORS.titleText, fontStyle: "bold",
    });
    title.setOrigin(0.5); title.setDepth(20);
    this.panelObjects.push(title);

    const slotW = 200;
    const slotH = 280;
    const gap = 20;
    const totalW = CHARACTERS.length * slotW + (CHARACTERS.length - 1) * gap;
    const startX = (GAME_WIDTH - totalW) / 2 + slotW / 2;

    for (let i = 0; i < CHARACTERS.length; i++) {
      const ch = CHARACTERS[i];
      const sx = startX + i * (slotW + gap);
      const sy = GAME_HEIGHT / 2 + 20;
      const selected = i === this.charIndex;

      if (selected && !ch.locked) {
        const glow = this.add.rectangle(sx, sy, slotW + 8, slotH + 8, COLORS.hubAccent, 0.15);
        glow.setDepth(14);
        this.panelObjects.push(glow);
        this.tweens.add({
          targets: glow, alpha: { from: 0.1, to: 0.25 },
          duration: 800, yoyo: true, repeat: -1, ease: "Sine.easeInOut",
        });
      }

      const cardLeft = sx - slotW / 2;
      const cardTop = sy - slotH / 2;

      const bg = this.add.rectangle(sx, sy, slotW, slotH, ch.locked ? COLORS.lockedChar : ch.cardBg);
      bg.setStrokeStyle(selected ? 3 : 2, selected ? COLORS.hubAccent : 0x444466);
      bg.setDepth(15);

      const heroKey = `hero-${ch.id}`;
      if (this.textures.exists(heroKey)) {
        const heroImg = this.add.image(sx, sy, heroKey);
        const srcW = heroImg.width;
        const srcH = heroImg.height;
        const coverScale = Math.max(slotW / srcW, slotH / srcH);
        heroImg.setScale(coverScale);
        heroImg.setDepth(16);
        if (ch.locked) heroImg.setAlpha(0.3);

        const maskGfx = this.make.graphics();
        maskGfx.fillRect(cardLeft, cardTop, slotW, slotH);
        heroImg.setMask(maskGfx.createGeometryMask());

        this.panelObjects.push(heroImg, maskGfx);
      }

      const gradientH = 100;
      const gradientTop = sy + slotH / 2 - gradientH;
      const gradGfx = this.add.graphics();
      gradGfx.setDepth(17);
      const steps = 20;
      for (let s = 0; s < steps; s++) {
        const a = (s / steps) * 0.85;
        const yy = gradientTop + (s / steps) * gradientH;
        const hh = gradientH / steps + 1;
        gradGfx.fillStyle(0x000000, a);
        gradGfx.fillRect(cardLeft, yy, slotW, hh);
      }
      this.panelObjects.push(gradGfx);

      const nameText = this.add.text(sx, sy + slotH / 2 - 62, ch.name, {
        fontFamily: "Georgia, serif", fontSize: "18px",
        color: ch.locked ? COLORS.subtitleText : "#ffffff",
        fontStyle: "bold",
      });
      nameText.setOrigin(0.5); nameText.setDepth(18);

      const roleText = this.add.text(sx, sy + slotH / 2 - 40, `${ch.icon}  ${ch.role}`, {
        fontFamily: "Georgia, serif", fontSize: "13px",
        color: selected ? COLORS.accent : "#ccccdd",
      });
      roleText.setOrigin(0.5); roleText.setDepth(18);

      const descText = this.add.text(sx, sy + slotH / 2 - 22, ch.desc, {
        fontFamily: "Georgia, serif", fontSize: "11px", color: "#99aabb",
        wordWrap: { width: slotW - 20 }, align: "center",
      });
      descText.setOrigin(0.5, 0); descText.setDepth(18);

      if (ch.locked) {
        const lock = this.add.text(sx, sy, "\uD83D\uDD12", { fontSize: "36px" });
        lock.setOrigin(0.5); lock.setDepth(19);
        this.panelObjects.push(lock);
      }

      this.panelObjects.push(bg, nameText, roleText, descText);
    }

    const hint = this.makeHint();
    this.panelTimers.push(this.time.addEvent({
      delay: 100, loop: true,
      callback: () => {
        if (!hint.active) return;
        const isGP = this.inputMgr.lastDevice === "gamepad";
        const nav: PromptPart = isGP ? PS_NAV.STICK_DPAD : "\u2190 A  \u2022  D \u2192";
        hint.setPrompt([nav, "  to select   \u2502   ", Action.CONFIRM, "  to confirm"]);
      },
    }));
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
    const title = this.add.text(GAME_WIDTH / 2, 118, "CHOOSE YOUR MODE", {
      fontFamily: "Georgia, serif", fontSize: "24px", color: COLORS.titleText, fontStyle: "bold",
    });
    title.setOrigin(0.5); title.setDepth(20);
    this.panelObjects.push(title);

    const modes = ["Start Run", "Fight Dummies", "Fight Enemies", "Story Mode"];
    const modeDescs = [
      "Run through Zone 1 \u2014 Earn boons from Merlin!",
      "Train your combos on stationary targets",
      "Fight waves of robot enemies!",
      "Explore the narrative of the Bell family",
    ];
    const cy = GAME_HEIGHT / 2;

    for (let i = 0; i < modes.length; i++) {
      const y = cy - 100 + i * 64;
      const selected = i === this.modeIndex;
      const w = selected ? 420 : 380;

      const bg = this.add.rectangle(GAME_WIDTH / 2, y, w, 56,
        selected ? 0x2a3344 : COLORS.hubPanel,
      );
      bg.setStrokeStyle(selected ? 3 : 2, selected ? COLORS.hubAccent : 0x444466);
      bg.setDepth(15);

      const label = `${MODE_ICONS[i]}   ${modes[i]}`;
      const txt = this.add.text(GAME_WIDTH / 2, y, label, {
        fontFamily: "Georgia, serif", fontSize: "24px",
        color: selected ? COLORS.accent : COLORS.titleText,
        fontStyle: "bold",
      });
      txt.setOrigin(0.5); txt.setDepth(16);

      this.panelObjects.push(bg, txt);
    }

    const desc = this.add.text(GAME_WIDTH / 2, cy + 170, modeDescs[this.modeIndex], {
      fontFamily: "Georgia, serif", fontSize: "14px", color: COLORS.subtitleText,
    });
    desc.setOrigin(0.5); desc.setDepth(16);
    this.panelObjects.push(desc);

    const hint = this.makeHint();
    this.panelTimers.push(this.time.addEvent({
      delay: 100, loop: true,
      callback: () => {
        if (!hint.active) return;
        const isGP = this.inputMgr.lastDevice === "gamepad";
        const nav: PromptPart = isGP ? PS_NAV.STICK_DPAD : "\u2191 W  \u2022  S \u2193";
        hint.setPrompt([nav, "  select   \u2502   ", Action.CONFIRM, "  confirm   \u2502   ", Action.BACK, "  back"]);
      },
    }));
  }

  private updateModePanel(): void {
    const modeCount = 4;
    if (this.inputMgr.justPressed(Action.UP)) {
      this.modeIndex = Math.max(0, this.modeIndex - 1);
      this.showPanel();
    }
    if (this.inputMgr.justPressed(Action.DOWN)) {
      this.modeIndex = Math.min(modeCount - 1, this.modeIndex + 1);
      this.showPanel();
    }
    if (this.inputMgr.justPressed(Action.CONFIRM)) {
      if (this.modeIndex === 0) {
        this.launchRun();
      } else if (this.modeIndex === 1) {
        this.launchArena("dummies");
      } else if (this.modeIndex === 2) {
        this.panel = "waveConfig";
        this.showPanel();
      } else {
        this.launchNarrative();
      }
    }
    if (this.inputMgr.justPressed(Action.BACK)) {
      this.panel = "character";
      this.showPanel();
    }
  }

  // ── Wave Config ──

  private buildWaveConfigPanel(): void {
    const title = this.add.text(GAME_WIDTH / 2, 118, "\u2699\uFE0F  WAVE CONFIGURATION", {
      fontFamily: "Georgia, serif", fontSize: "24px", color: COLORS.titleText, fontStyle: "bold",
    });
    title.setOrigin(0.5); title.setDepth(20);
    this.panelObjects.push(title);

    const cy = GAME_HEIGHT / 2 - 40;
    const rowW = 400;
    const rowH = 56;

    const countBg = this.add.rectangle(GAME_WIDTH / 2, cy, rowW, rowH,
      this.selectedRow === 0 ? 0x2a3344 : COLORS.hubPanel,
    );
    countBg.setStrokeStyle(this.selectedRow === 0 ? 3 : 2,
      this.selectedRow === 0 ? COLORS.hubAccent : 0x444466,
    );
    countBg.setDepth(15);

    const countLabel = this.add.text(GAME_WIDTH / 2, cy, "", {
      fontFamily: "Georgia, serif", fontSize: "22px", color: COLORS.titleText,
    });
    countLabel.setOrigin(0.5); countLabel.setDepth(16);

    const levelBg = this.add.rectangle(GAME_WIDTH / 2, cy + 70, rowW, rowH,
      this.selectedRow === 1 ? 0x2a3344 : COLORS.hubPanel,
    );
    levelBg.setStrokeStyle(this.selectedRow === 1 ? 3 : 2,
      this.selectedRow === 1 ? COLORS.hubAccent : 0x444466,
    );
    levelBg.setDepth(15);

    const levelLabel = this.add.text(GAME_WIDTH / 2, cy + 70, "", {
      fontFamily: "Georgia, serif", fontSize: "22px", color: COLORS.titleText,
    });
    levelLabel.setOrigin(0.5); levelLabel.setDepth(16);

    const arrowHint = this.add.text(GAME_WIDTH / 2, cy + 120, "\u25C0  \u2190 / \u2192  \u25B6   to adjust value", {
      fontFamily: "Georgia, serif", fontSize: "13px", color: COLORS.subtitleText,
    });
    arrowHint.setOrigin(0.5); arrowHint.setDepth(16);

    const wavePreview = this.add.text(GAME_WIDTH / 2, cy + 160, this.getWavePreview(), {
      fontFamily: "Georgia, serif", fontSize: "14px", color: COLORS.accent,
    });
    wavePreview.setOrigin(0.5); wavePreview.setDepth(16);

    const hint = this.makeHint();

    this.panelObjects.push(countBg, countLabel, levelBg, levelLabel, arrowHint, wavePreview, hint);

    this.panelTimers.push(this.time.addEvent({
      delay: 100, loop: true,
      callback: () => {
        if (!hint.active) return;
        hint.setPrompt([Action.CONFIRM, "  next   \u2502   ", Action.BACK, "  back"]);
        countLabel.setText(`\uD83D\uDC7E  Enemies:  ${this.enemyCount}`);
        levelLabel.setText(`\u2B50  Level:  ${this.enemyLevel}`);
        wavePreview.setText(this.getWavePreview());
      },
    }));
  }

  private updateWaveConfigPanel(): void {
    if (this.inputMgr.justPressed(Action.UP) || this.inputMgr.justPressed(Action.DOWN)) {
      this.selectedRow = this.selectedRow === 0 ? 1 : 0;
      this.showPanel();
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
      this.allBoons = [];
      for (const pool of Object.values(ALL_BOON_POOLS)) {
        for (const b of pool) {
          if (!this.allBoons.some(x => x.id === b.id)) this.allBoons.push(b);
        }
      }
      this.boonCursor = 0;
      this.boonScrollOffset = 0;
      this.panel = "boonSelect";
      this.showPanel();
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
      waves.push(`Wave ${w + 1}: ${c} \u00D7 Lv.${l}`);
    }
    return waves.join("   \u2502   ");
  }

  // ── Boon Select Panel ──

  private static readonly BOON_VISIBLE = 10;
  private static readonly BOON_ROW_H = 42;

  private buildBoonSelectPanel(): void {
    const title = this.add.text(GAME_WIDTH / 2, 80, "\uD83E\uDDEA  SELECT BOONS FOR TESTING", {
      fontFamily: "Georgia, serif", fontSize: "22px", color: COLORS.titleText, fontStyle: "bold",
    });
    title.setOrigin(0.5); title.setDepth(20);
    this.panelObjects.push(title);

    const subtitle = this.add.text(GAME_WIDTH / 2, 108, "", {
      fontFamily: "Georgia, serif", fontSize: "13px", color: COLORS.subtitleText,
    });
    subtitle.setOrigin(0.5); subtitle.setDepth(20);
    this.panelObjects.push(subtitle);

    const listY = 130;
    const vis = HubScene.BOON_VISIBLE;
    const rowH = HubScene.BOON_ROW_H;

    for (let i = 0; i < vis; i++) {
      const bIdx = this.boonScrollOffset + i;
      if (bIdx >= this.allBoons.length) break;
      const boon = this.allBoons[bIdx];
      const y = listY + i * rowH;
      const isCursor = bIdx === this.boonCursor;
      const isSelected = this.selectedBoons.has(boon.id);

      const bg = this.add.rectangle(GAME_WIDTH / 2, y + rowH / 2, GAME_WIDTH - 80, rowH - 4,
        isCursor ? 0x334455 : 0x1a1a2e,
      );
      bg.setStrokeStyle(isCursor ? 2 : 1, isCursor ? COLORS.hubAccent : 0x333355);
      bg.setDepth(15);

      const checkIcon = isSelected ? "\u2705" : "\u2B1C";
      const check = this.add.text(60, y + rowH / 2, checkIcon, {
        fontSize: "16px",
      });
      check.setOrigin(0, 0.5); check.setDepth(16);

      const rarityColor = Phaser.Display.Color.IntegerToRGB(RARITY_COLORS[boon.rarity]);
      const rarityHex = Phaser.Display.Color.RGBToString(rarityColor.r, rarityColor.g, rarityColor.b);

      const iconKey = boon.icon ? `boon-${boon.icon}` : "";
      let iconXEnd = 90;
      if (iconKey && this.textures.exists(iconKey)) {
        const ic = this.add.image(100, y + rowH / 2, iconKey);
        ic.setDisplaySize(30, 30);
        ic.setDepth(16);
        this.panelObjects.push(ic);
        iconXEnd = 120;
      }

      const name = this.add.text(iconXEnd, y + rowH / 2 - 9, boon.name, {
        fontFamily: "Georgia, serif", fontSize: "15px", color: rarityHex, fontStyle: "bold",
      });
      name.setOrigin(0, 0.5); name.setDepth(16);

      const slotTag = boon.slot ? `[${SLOT_LABELS[boon.slot]}]` : "[Passive]";
      const wizTag = `[${boon.wizard}]`;
      const desc = this.add.text(iconXEnd, y + rowH / 2 + 10, `${slotTag} ${wizTag} ${boon.description}`, {
        fontFamily: "Georgia, serif", fontSize: "11px", color: "#8899aa",
        wordWrap: { width: GAME_WIDTH - 200 },
      });
      desc.setOrigin(0, 0.5); desc.setDepth(16);

      this.panelObjects.push(bg, check, name, desc);
    }

    const scrollInfo = this.add.text(GAME_WIDTH / 2, listY + vis * rowH + 10,
      `${this.boonCursor + 1} / ${this.allBoons.length}`, {
        fontFamily: "Georgia, serif", fontSize: "12px", color: COLORS.subtitleText,
      });
    scrollInfo.setOrigin(0.5); scrollInfo.setDepth(16);
    this.panelObjects.push(scrollInfo);

    const hint = this.makeHint(GAME_HEIGHT - 28);

    this.panelTimers.push(this.time.addEvent({
      delay: 100, loop: true,
      callback: () => {
        if (!hint.active) return;
        hint.setPrompt([Action.ATTACK, "  fight   \u2502   ", Action.BACK, "  back   \u2502   ", Action.HEAVY, "  clear all"]);
        const confirm = this.inputMgr.getLabel(Action.CONFIRM);
        const atk = this.inputMgr.getLabel(Action.ATTACK);
        subtitle.setText(`${this.selectedBoons.size} selected   \u2502   \u2191/\u2193 browse   \u2502   ${confirm} toggle   \u2502   ${atk} fight`);
      },
    }));
  }

  private updateBoonSelectPanel(): void {
    const total = this.allBoons.length;
    const vis = HubScene.BOON_VISIBLE;

    if (this.inputMgr.justPressed(Action.UP)) {
      this.boonCursor = (this.boonCursor - 1 + total) % total;
      if (this.boonCursor < this.boonScrollOffset) this.boonScrollOffset = this.boonCursor;
      if (this.boonCursor >= this.boonScrollOffset + vis) this.boonScrollOffset = this.boonCursor - vis + 1;
      this.showPanel();
    }
    if (this.inputMgr.justPressed(Action.DOWN)) {
      this.boonCursor = (this.boonCursor + 1) % total;
      if (this.boonCursor >= this.boonScrollOffset + vis) this.boonScrollOffset = this.boonCursor - vis + 1;
      if (this.boonCursor < this.boonScrollOffset) this.boonScrollOffset = this.boonCursor;
      this.showPanel();
    }
    if (this.inputMgr.justPressed(Action.CONFIRM)) {
      const boon = this.allBoons[this.boonCursor];
      if (this.selectedBoons.has(boon.id)) {
        this.selectedBoons.delete(boon.id);
      } else {
        this.selectedBoons.add(boon.id);
      }
      this.showPanel();
    }
    if (this.inputMgr.justPressed(Action.HEAVY)) {
      this.selectedBoons.clear();
      this.showPanel();
    }
    if (this.inputMgr.justPressed(Action.ATTACK)) {
      this.launchArenaWithBoons();
    }
    if (this.inputMgr.justPressed(Action.BACK)) {
      this.panel = "waveConfig";
      this.showPanel();
    }
  }

  // ── Launch helpers ──

  private launchArenaWithBoons(): void {
    if (this.launching) return;
    this.launching = true;

    const runState = new RunState({
      character: this.selectedChar,
      wizardPool: ["Merlin", "Morgan"],
    });
    for (const boon of this.allBoons) {
      if (this.selectedBoons.has(boon.id)) {
        runState.boons.addBoon(boon);
      }
    }
    this.game.registry.set("runState", runState);

    this.cameras.main.fadeOut(400, 0, 0, 0);
    this.cameras.main.once("camerafadeoutcomplete", () => {
      this.scene.start("ArenaScene", {
        mode: "enemies",
        character: this.selectedChar,
        startCount: this.enemyCount,
        startLevel: this.enemyLevel,
      });
    });
  }

  private launchRun(): void {
    if (this.launching) return;
    this.launching = true;

    const runState = new RunState({
      character: this.selectedChar,
      zoneMap: generateZone1Map(),
      wizardPool: ["Merlin", "Morgan"],
    });
    this.game.registry.set("runState", runState);

    this.cameras.main.fadeOut(400, 0, 0, 0);
    this.cameras.main.once("camerafadeoutcomplete", () => {
      this.scene.start("RoomMapScene");
    });
  }

  private launchNarrative(): void {
    if (this.launching) return;
    this.launching = true;
    this.cameras.main.fadeOut(400, 0, 0, 0);
    this.cameras.main.once("camerafadeoutcomplete", () => {
      this.scene.start("NarrativeScene");
    });
  }

  private launchArena(mode: "dummies" | "enemies"): void {
    if (this.launching) return;
    this.launching = true;
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
