/**
 * Parallel HUD scene that runs alongside ArenaScene.
 * Pattern from phaser3-dungeon-crawler-starter: decoupled UI via EventBus.
 * ArenaScene emits events; this scene listens and renders HUD elements.
 *
 * This scene handles overlay elements (announcements, combo counter)
 * that benefit from being decoupled from the combat scene lifecycle.
 */

import Phaser from "phaser";
import { GAME_WIDTH, GAME_HEIGHT, COLORS } from "../config/game";
import eventBus, { HUD_EVENTS } from "../systems/EventBus";

export class CombatHUDScene extends Phaser.Scene {
  private comboCount = 0;
  private comboTimer = 0;
  private comboText!: Phaser.GameObjects.Text;
  private comboLabel!: Phaser.GameObjects.Text;
  private announcementText!: Phaser.GameObjects.Text;
  private announcementTimer = 0;

  constructor() {
    super("CombatHUDScene");
  }

  create(): void {
    this.comboText = this.add.text(GAME_WIDTH - 80, 80, "", {
      fontFamily: "monospace",
      fontSize: "36px",
      color: "#ffcc44",
      fontStyle: "bold",
      stroke: "#000000",
      strokeThickness: 4,
    });
    this.comboText.setOrigin(0.5, 0.5);
    this.comboText.setDepth(20001);
    this.comboText.setAlpha(0);

    this.comboLabel = this.add.text(GAME_WIDTH - 80, 105, "COMBO", {
      fontFamily: "monospace",
      fontSize: "11px",
      color: "#ffaa22",
      stroke: "#000000",
      strokeThickness: 2,
    });
    this.comboLabel.setOrigin(0.5, 0.5);
    this.comboLabel.setDepth(20001);
    this.comboLabel.setAlpha(0);

    this.announcementText = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT * 0.3, "", {
      fontFamily: "monospace",
      fontSize: "28px",
      color: "#ffffff",
      fontStyle: "bold",
      stroke: "#000000",
      strokeThickness: 5,
      align: "center",
    });
    this.announcementText.setOrigin(0.5, 0.5);
    this.announcementText.setDepth(20002);
    this.announcementText.setAlpha(0);

    eventBus.on(HUD_EVENTS.COMBO_HIT, this.onComboHit, this);
    eventBus.on(HUD_EVENTS.COMBO_RESET, this.onComboReset, this);
    eventBus.on(HUD_EVENTS.ANNOUNCEMENT, this.onAnnouncement, this);
    eventBus.on(HUD_EVENTS.SCENE_ENDING, this.onArenaEnding, this);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      eventBus.off(HUD_EVENTS.COMBO_HIT, this.onComboHit, this);
      eventBus.off(HUD_EVENTS.COMBO_RESET, this.onComboReset, this);
      eventBus.off(HUD_EVENTS.ANNOUNCEMENT, this.onAnnouncement, this);
      eventBus.off(HUD_EVENTS.SCENE_ENDING, this.onArenaEnding, this);
    });
  }

  update(_time: number, delta: number): void {
    const dt = delta / 1000;

    if (this.comboCount > 0) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) {
        this.onComboReset();
      }
    }

    if (this.announcementTimer > 0) {
      this.announcementTimer -= dt;
      if (this.announcementTimer <= 0) {
        this.tweens.add({
          targets: this.announcementText,
          alpha: 0,
          y: this.announcementText.y - 20,
          duration: 300,
        });
      }
    }
  }

  private onComboHit(data: { count: number }): void {
    this.comboCount = data.count;
    this.comboTimer = 2.0;

    if (this.comboCount >= 3) {
      this.comboText.setText(`${this.comboCount}`);
      this.comboText.setAlpha(1);
      this.comboLabel.setAlpha(1);

      this.tweens.add({
        targets: this.comboText,
        scaleX: 1.3,
        scaleY: 1.3,
        duration: 80,
        yoyo: true,
        ease: "Quad.easeOut",
      });

      const hue = (this.comboCount * 20) % 360;
      const color = Phaser.Display.Color.HSLToColor(hue / 360, 0.8, 0.6);
      this.comboText.setColor(color.rgba);
    }
  }

  private onComboReset(): void {
    this.comboCount = 0;
    this.comboTimer = 0;
    this.tweens.add({
      targets: [this.comboText, this.comboLabel],
      alpha: 0,
      duration: 200,
    });
  }

  private onAnnouncement(data: { text: string; color?: string; duration?: number }): void {
    this.announcementText.setText(data.text);
    if (data.color) this.announcementText.setColor(data.color);
    else this.announcementText.setColor("#ffffff");
    this.announcementText.setAlpha(1);
    this.announcementText.setScale(0.5);
    this.announcementText.y = GAME_HEIGHT * 0.3;
    this.announcementTimer = data.duration ?? 2.0;

    this.tweens.add({
      targets: this.announcementText,
      scaleX: 1,
      scaleY: 1,
      duration: 200,
      ease: "Back.easeOut",
    });
  }

  private onArenaEnding(): void {
    this.scene.stop();
  }
}
