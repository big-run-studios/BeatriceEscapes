import Phaser from "phaser";
import { GAME_WIDTH, GAME_HEIGHT, COLORS } from "../config/game";
import { InputManager, Action } from "../systems/InputManager";
import { initPSGlyphs, PromptLine, PromptPart, PS_NAV } from "../ui/ButtonGlyphs";
import {
  NarrativeEntry,
  NarrativeCategory,
  ALL_CATEGORIES,
} from "../data/narrative";
import { TTSService } from "../systems/TTSService";
import { AudioManager } from "../systems/AudioManager";

type NavLevel = "category" | "list" | "detail";

interface ListItem {
  label: string;
  entry?: NarrativeEntry;
  subCategory?: NarrativeCategory;
}

const VISIBLE_ROWS = 9;
const ROW_HEIGHT = 44;
const LIST_TOP = 160;
const LIST_LEFT = 80;
const LIST_WIDTH = GAME_WIDTH - 160;
const DETAIL_PADDING = 80;
const BODY_LINE_WIDTH = GAME_WIDTH - DETAIL_PADDING * 2 - 40;

export class NarrativeScene extends Phaser.Scene {
  private inputMgr!: InputManager;
  private level: NavLevel = "category";
  private cursorIndex = 0;
  private scrollOffset = 0;
  private inputGracePeriod = 0;

  private categoryIndex = 0;
  private items: ListItem[] = [];
  private breadcrumb: string[] = [];
  private activeEntry: NarrativeEntry | null = null;
  private detailScrollY = 0;

  private uiObjects: Phaser.GameObjects.GameObject[] = [];
  private panelTimers: Phaser.Time.TimerEvent[] = [];

  private tts!: TTSService;

  constructor() {
    super({ key: "NarrativeScene" });
  }

  create(): void {
    this.inputMgr = new InputManager(this);
    initPSGlyphs(this);
    this.level = "category";
    this.cursorIndex = 0;
    this.scrollOffset = 0;
    this.categoryIndex = 0;
    this.items = [];
    this.breadcrumb = [];
    this.activeEntry = null;
    this.detailScrollY = 0;
    this.uiObjects = [];
    this.panelTimers = [];
    this.inputGracePeriod = 12;

    this.tts = new TTSService();
    this.tts.selectVoiceByName("Heather");

    this.drawBackground();
    this.buildCategoryView();
    this.cameras.main.fadeIn(400, 0, 0, 0);
  }

  update(): void {
    AudioManager.instance.heartbeat();

    if (this.inputGracePeriod > 0) {
      this.inputGracePeriod--;
      this.inputMgr.postUpdate();
      return;
    }

    switch (this.level) {
      case "category":
        this.updateCategoryView();
        break;
      case "list":
        this.updateListView();
        break;
      case "detail":
        this.updateDetailView();
        break;
    }
    this.inputMgr.postUpdate();
  }

  // ── Background ──

  private drawBackground(): void {
    const bg = this.add.rectangle(
      GAME_WIDTH / 2,
      GAME_HEIGHT / 2,
      GAME_WIDTH,
      GAME_HEIGHT,
      COLORS.hubBg
    );
    bg.setDepth(0);

    const topBar = this.add.rectangle(GAME_WIDTH / 2, 40, GAME_WIDTH, 80, 0x12122a);
    topBar.setDepth(1);
  }

  // ── Clear UI ──

  private clearUI(): void {
    for (const t of this.panelTimers) t.destroy();
    this.panelTimers = [];
    for (const obj of this.uiObjects) {
      if (obj && obj.active) obj.destroy();
    }
    this.uiObjects = [];
  }

  // ══════════════════════════════════════
  //  CATEGORY VIEW (top level)
  // ══════════════════════════════════════

  private buildCategoryView(): void {
    this.clearUI();
    this.level = "category";
    this.breadcrumb = [];

    const title = this.add.text(GAME_WIDTH / 2, 40, "STORY MODE", {
      fontFamily: "Georgia, serif",
      fontSize: "28px",
      color: COLORS.accent,
      fontStyle: "bold",
    });
    title.setOrigin(0.5);
    title.setDepth(10);
    this.uiObjects.push(title);

    const categories = ALL_CATEGORIES.map((c) => ({
      label: c.label,
      desc: `${c.entries.length} entries`,
    }));

    const cy = GAME_HEIGHT / 2 - 40;
    const cardW = 360;
    const cardH = 60;
    const gap = 16;

    for (let i = 0; i < categories.length; i++) {
      const cat = categories[i];
      const y = cy + i * (cardH + gap) - ((categories.length - 1) * (cardH + gap)) / 2;
      const selected = i === this.categoryIndex;

      const bg = this.add.rectangle(GAME_WIDTH / 2, y, cardW, cardH, COLORS.hubPanel);
      bg.setStrokeStyle(3, selected ? COLORS.hubAccent : 0x444466);
      bg.setDepth(15);

      const labelText = this.add.text(GAME_WIDTH / 2, y - 8, cat.label, {
        fontFamily: "Georgia, serif",
        fontSize: "18px",
        color: selected ? COLORS.accent : COLORS.titleText,
        fontStyle: "bold",
      });
      labelText.setOrigin(0.5);
      labelText.setDepth(16);

      const descText = this.add.text(GAME_WIDTH / 2, y + 14, cat.desc, {
        fontFamily: "monospace",
        fontSize: "10px",
        color: COLORS.subtitleText,
      });
      descText.setOrigin(0.5);
      descText.setDepth(16);

      this.uiObjects.push(bg, labelText, descText);
    }

    const hint = new PromptLine(this, GAME_WIDTH / 2, GAME_HEIGHT - 40, this.inputMgr, {
      fontFamily: "monospace",
      fontSize: "12px",
      color: COLORS.subtitleText,
    });
    hint.setDepth(20);
    this.uiObjects.push(hint);

    this.panelTimers.push(
      this.time.addEvent({
        delay: 100,
        loop: true,
        callback: () => {
          if (!hint.active) return;
          const isGP = this.inputMgr.lastDevice === "gamepad";
          const nav: PromptPart = isGP ? PS_NAV.STICK_DPAD : "W/S";
          hint.setPrompt([nav, " to navigate  |  ", Action.CONFIRM, " to open  |  ", Action.BACK, " to exit"]);
        },
      })
    );
  }

  private updateCategoryView(): void {
    const totalCategories = ALL_CATEGORIES.length;

    if (this.inputMgr.justPressed(Action.UP)) {
      this.categoryIndex = Math.max(0, this.categoryIndex - 1);
      this.buildCategoryView();
    }
    if (this.inputMgr.justPressed(Action.DOWN)) {
      this.categoryIndex = Math.min(totalCategories - 1, this.categoryIndex + 1);
      this.buildCategoryView();
    }
    if (this.inputMgr.justPressed(Action.CONFIRM)) {
      this.openCategory(this.categoryIndex);
    }
    if (this.inputMgr.justPressed(Action.BACK)) {
      this.cameras.main.fadeOut(400, 0, 0, 0);
      this.cameras.main.once("camerafadeoutcomplete", () => {
        this.scene.start("HubScene");
      });
    }
  }

  private openCategory(index: number): void {
    this.cursorIndex = 0;
    this.scrollOffset = 0;

    const cat = ALL_CATEGORIES[index];
    this.items = cat.entries.map((e) => ({
      label: e.title + (e.subtitle ? ` — ${e.subtitle}` : ""),
      entry: e,
    }));
    this.breadcrumb = [cat.label];

    this.buildListView();
  }

  // ══════════════════════════════════════
  //  LIST VIEW (scrollable entry list)
  // ══════════════════════════════════════

  private buildListView(): void {
    this.clearUI();
    this.level = "list";

    const breadcrumbStr = this.breadcrumb.join(" > ");
    const bcText = this.add.text(LIST_LEFT, 20, breadcrumbStr, {
      fontFamily: "monospace",
      fontSize: "11px",
      color: COLORS.subtitleText,
    });
    bcText.setDepth(10);
    this.uiObjects.push(bcText);

    const title = this.add.text(GAME_WIDTH / 2, 50, this.breadcrumb[this.breadcrumb.length - 1], {
      fontFamily: "Georgia, serif",
      fontSize: "24px",
      color: COLORS.accent,
      fontStyle: "bold",
    });
    title.setOrigin(0.5);
    title.setDepth(10);
    this.uiObjects.push(title);

    const divider = this.add.rectangle(GAME_WIDTH / 2, 80, GAME_WIDTH - 160, 1, 0x444466);
    divider.setDepth(10);
    this.uiObjects.push(divider);

    const countText = this.add.text(GAME_WIDTH - LIST_LEFT, 50, `${this.items.length} entries`, {
      fontFamily: "monospace",
      fontSize: "10px",
      color: COLORS.subtitleText,
    });
    countText.setOrigin(1, 0.5);
    countText.setDepth(10);
    this.uiObjects.push(countText);

    const endIdx = Math.min(this.scrollOffset + VISIBLE_ROWS, this.items.length);

    for (let i = this.scrollOffset; i < endIdx; i++) {
      const item = this.items[i];
      const row = i - this.scrollOffset;
      const y = LIST_TOP + row * ROW_HEIGHT;
      const selected = i === this.cursorIndex;

      const rowBg = this.add.rectangle(
        GAME_WIDTH / 2,
        y,
        LIST_WIDTH,
        ROW_HEIGHT - 4,
        selected ? 0x2a2a50 : 0x1a1a30
      );
      rowBg.setStrokeStyle(selected ? 2 : 0, selected ? COLORS.hubAccent : 0x000000);
      rowBg.setDepth(15);

      const marker = this.add.text(LIST_LEFT + 12, y, selected ? "▸" : " ", {
        fontFamily: "monospace",
        fontSize: "16px",
        color: COLORS.accent,
      });
      marker.setOrigin(0, 0.5);
      marker.setDepth(16);

      const numStr = String(i + 1).padStart(2, "0");
      const numText = this.add.text(LIST_LEFT + 36, y, numStr, {
        fontFamily: "monospace",
        fontSize: "11px",
        color: COLORS.subtitleText,
      });
      numText.setOrigin(0, 0.5);
      numText.setDepth(16);

      const labelText = this.add.text(LIST_LEFT + 66, y, item.label, {
        fontFamily: "Georgia, serif",
        fontSize: "14px",
        color: selected ? COLORS.accent : COLORS.titleText,
      });
      labelText.setOrigin(0, 0.5);
      labelText.setDepth(16);

      this.uiObjects.push(rowBg, marker, numText, labelText);
    }

    if (this.scrollOffset > 0) {
      const upArrow = this.add.text(GAME_WIDTH / 2, LIST_TOP - 18, "▲  more above  ▲", {
        fontFamily: "monospace",
        fontSize: "10px",
        color: COLORS.subtitleText,
      });
      upArrow.setOrigin(0.5);
      upArrow.setDepth(16);
      this.uiObjects.push(upArrow);
    }

    if (endIdx < this.items.length) {
      const dnArrow = this.add.text(
        GAME_WIDTH / 2,
        LIST_TOP + VISIBLE_ROWS * ROW_HEIGHT + 8,
        "▼  more below  ▼",
        {
          fontFamily: "monospace",
          fontSize: "10px",
          color: COLORS.subtitleText,
        }
      );
      dnArrow.setOrigin(0.5);
      dnArrow.setDepth(16);
      this.uiObjects.push(dnArrow);
    }

    const scrollInfo = this.add.text(
      GAME_WIDTH - LIST_LEFT,
      LIST_TOP + VISIBLE_ROWS * ROW_HEIGHT + 8,
      `${this.cursorIndex + 1} / ${this.items.length}`,
      {
        fontFamily: "monospace",
        fontSize: "10px",
        color: COLORS.subtitleText,
      }
    );
    scrollInfo.setOrigin(1, 0.5);
    scrollInfo.setDepth(16);
    this.uiObjects.push(scrollInfo);

    const hint = new PromptLine(this, GAME_WIDTH / 2, GAME_HEIGHT - 40, this.inputMgr, {
      fontFamily: "monospace",
      fontSize: "12px",
      color: COLORS.subtitleText,
    });
    hint.setDepth(20);
    this.uiObjects.push(hint);

    this.panelTimers.push(
      this.time.addEvent({
        delay: 100,
        loop: true,
        callback: () => {
          if (!hint.active) return;
          const isGP = this.inputMgr.lastDevice === "gamepad";
          const nav: PromptPart = isGP ? PS_NAV.STICK_DPAD : "W/S";
          hint.setPrompt([nav, " to scroll  |  ", Action.CONFIRM, " to read  |  ", Action.BACK, " to go back"]);
        },
      })
    );
  }

  private updateListView(): void {
    let changed = false;

    if (this.inputMgr.justPressed(Action.UP)) {
      if (this.cursorIndex > 0) {
        this.cursorIndex--;
        if (this.cursorIndex < this.scrollOffset) {
          this.scrollOffset = this.cursorIndex;
        }
        changed = true;
      }
    }
    if (this.inputMgr.justPressed(Action.DOWN)) {
      if (this.cursorIndex < this.items.length - 1) {
        this.cursorIndex++;
        if (this.cursorIndex >= this.scrollOffset + VISIBLE_ROWS) {
          this.scrollOffset = this.cursorIndex - VISIBLE_ROWS + 1;
        }
        changed = true;
      }
    }

    if (changed) {
      this.buildListView();
    }

    if (this.inputMgr.justPressed(Action.CONFIRM)) {
      const item = this.items[this.cursorIndex];
      if (item.entry) {
        this.activeEntry = item.entry;
        this.detailScrollY = 0;
        this.buildDetailView();
      }
    }

    if (this.inputMgr.justPressed(Action.BACK)) {
      this.cursorIndex = this.categoryIndex;
      this.scrollOffset = 0;
      this.buildCategoryView();
    }
  }

  // ══════════════════════════════════════
  //  DETAIL VIEW (entry text display)
  // ══════════════════════════════════════

  private buildDetailView(): void {
    this.clearUI();
    this.level = "detail";

    if (!this.activeEntry) return;
    const entry = this.activeEntry;

    const bcStr = [...this.breadcrumb, entry.title].join(" > ");
    const bcText = this.add.text(DETAIL_PADDING, 20, bcStr, {
      fontFamily: "monospace",
      fontSize: "11px",
      color: COLORS.subtitleText,
      wordWrap: { width: GAME_WIDTH - DETAIL_PADDING * 2 },
    });
    bcText.setDepth(10);
    this.uiObjects.push(bcText);

    const titleText = this.add.text(GAME_WIDTH / 2, 60, entry.title, {
      fontFamily: "Georgia, serif",
      fontSize: "24px",
      color: COLORS.accent,
      fontStyle: "bold",
    });
    titleText.setOrigin(0.5);
    titleText.setDepth(10);
    this.uiObjects.push(titleText);

    let contentY = 90;

    if (entry.subtitle) {
      const subText = this.add.text(GAME_WIDTH / 2, contentY, entry.subtitle, {
        fontFamily: "Georgia, serif",
        fontSize: "14px",
        color: COLORS.subtitleText,
        fontStyle: "italic",
      });
      subText.setOrigin(0.5);
      subText.setDepth(10);
      this.uiObjects.push(subText);
      contentY += 24;
    }

    const divider = this.add.rectangle(GAME_WIDTH / 2, contentY, GAME_WIDTH - DETAIL_PADDING * 2, 1, 0x444466);
    divider.setDepth(10);
    this.uiObjects.push(divider);
    contentY += 16;

    const maskShape = this.add.graphics();
    maskShape.fillStyle(0xffffff);
    maskShape.fillRect(DETAIL_PADDING, contentY, GAME_WIDTH - DETAIL_PADDING * 2, GAME_HEIGHT - contentY - 60);
    maskShape.setVisible(false);
    const mask = maskShape.createGeometryMask();
    this.uiObjects.push(maskShape);

    const bodyText = this.add.text(
      DETAIL_PADDING + 20,
      contentY - this.detailScrollY,
      entry.body,
      {
        fontFamily: "Georgia, serif",
        fontSize: "14px",
        color: COLORS.titleText,
        lineSpacing: 8,
        wordWrap: { width: BODY_LINE_WIDTH },
      }
    );
    bodyText.setDepth(16);
    bodyText.setMask(mask);
    this.uiObjects.push(bodyText);

    const visibleHeight = GAME_HEIGHT - contentY - 60;
    const totalHeight = bodyText.height;
    const maxScroll = Math.max(0, totalHeight - visibleHeight);

    if (maxScroll > 0 && this.detailScrollY < maxScroll) {
      const scrollHint = this.add.text(
        GAME_WIDTH / 2,
        GAME_HEIGHT - 60,
        "▼  scroll down  ▼",
        {
          fontFamily: "monospace",
          fontSize: "10px",
          color: COLORS.subtitleText,
        }
      );
      scrollHint.setOrigin(0.5);
      scrollHint.setDepth(20);
      this.uiObjects.push(scrollHint);
    }

    // ── TTS controls ──
    {
      const voiceLabel = this.add.text(
        GAME_WIDTH - DETAIL_PADDING,
        60,
        "",
        {
          fontFamily: "monospace",
          fontSize: "11px",
          color: COLORS.subtitleText,
          align: "right",
        }
      );
      voiceLabel.setOrigin(1, 0.5);
      voiceLabel.setDepth(20);
      this.uiObjects.push(voiceLabel);

      const ttsStatus = this.add.text(
        GAME_WIDTH - DETAIL_PADDING,
        78,
        "",
        {
          fontFamily: "monospace",
          fontSize: "10px",
          color: COLORS.accent,
          align: "right",
        }
      );
      ttsStatus.setOrigin(1, 0.5);
      ttsStatus.setDepth(20);
      this.uiObjects.push(ttsStatus);

      this.panelTimers.push(
        this.time.addEvent({
          delay: 100,
          loop: true,
          callback: () => {
            if (!voiceLabel.active) return;

            if (!this.tts.isReady) {
              voiceLabel.setText("TTS: No API key — add VITE_ELEVENLABS_API_KEY to .env");
              ttsStatus.setText("");
              return;
            }

            const currentVoice = this.tts.selectedVoice?.name ?? "No voice";
            const isGamepad = this.inputMgr.lastDevice === "gamepad";
            const arrows = isGamepad ? "← →" : "A/D";
            voiceLabel.setText(`Voice: ${currentVoice}  (${arrows})`);

            const stateMap: Record<string, string> = {
              idle: "",
              loading: "Loading audio...",
              playing: "▶ Playing",
              paused: "❚❚ Paused",
              error: "TTS Error",
            };
            ttsStatus.setText(stateMap[this.tts.state] ?? "");
          },
        })
      );
    }

    // ── Bottom hint ──
    const hint = new PromptLine(this, GAME_WIDTH / 2, GAME_HEIGHT - 36, this.inputMgr, {
      fontFamily: "monospace",
      fontSize: "12px",
      color: COLORS.subtitleText,
    });
    hint.setDepth(20);
    this.uiObjects.push(hint);

    this.panelTimers.push(
      this.time.addEvent({
        delay: 100,
        loop: true,
        callback: () => {
          if (!hint.active) return;
          const isGP = this.inputMgr.lastDevice === "gamepad";
          const parts: PromptPart[] = [];

          if (maxScroll > 0) {
            parts.push(isGP ? PS_NAV.STICK : "W/S", " to scroll  |  ");
          }
          if (this.tts.isReady) {
            parts.push(Action.ATTACK, " to narrate  |  ");
          }
          parts.push(Action.BACK, " to go back");

          hint.setPrompt(parts);
        },
      })
    );
  }

  private updateDetailView(): void {
    if (!this.activeEntry) return;

    const scrollSpeed = 40;

    if (this.inputMgr.isDown(Action.DOWN)) {
      this.detailScrollY += scrollSpeed;
      this.buildDetailView();
    }
    if (this.inputMgr.isDown(Action.UP)) {
      this.detailScrollY = Math.max(0, this.detailScrollY - scrollSpeed);
      this.buildDetailView();
    }

    if (this.tts.isReady) {
      if (this.inputMgr.justPressed(Action.HEAVY)) {
        this.tts.togglePlayPause(this.activeEntry.body, this.activeEntry.id);
      }
    }

    if (this.inputMgr.justPressed(Action.BACK)) {
      this.tts.stop();
      this.activeEntry = null;
      this.detailScrollY = 0;
      this.buildListView();
    }
  }
}
