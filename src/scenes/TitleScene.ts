import Phaser from "phaser";
import { GAME_WIDTH, GAME_HEIGHT, COLORS } from "../config/game";

export class TitleScene extends Phaser.Scene {
  constructor() {
    super({ key: "TitleScene" });
  }

  create(): void {
    const cx = GAME_WIDTH / 2;
    const cy = GAME_HEIGHT / 2;

    const title = this.add.text(cx, cy - 40, "BEA ESCAPES", {
      fontFamily: "Georgia, serif",
      fontSize: "72px",
      color: COLORS.titleText,
      fontStyle: "bold",
    });
    title.setOrigin(0.5);

    const subtitle = this.add.text(cx, cy + 40, "a family on the run", {
      fontFamily: "Georgia, serif",
      fontSize: "24px",
      color: COLORS.subtitleText,
    });
    subtitle.setOrigin(0.5);

    const version = this.add.text(GAME_WIDTH - 16, GAME_HEIGHT - 16, "B0.0.1", {
      fontFamily: "monospace",
      fontSize: "14px",
      color: COLORS.subtitleText,
    });
    version.setOrigin(1, 1);

    this.tweens.add({
      targets: title,
      alpha: { from: 0, to: 1 },
      y: { from: cy - 60, to: cy - 40 },
      duration: 1200,
      ease: "Power2",
    });

    this.tweens.add({
      targets: subtitle,
      alpha: { from: 0, to: 1 },
      delay: 600,
      duration: 800,
      ease: "Power2",
    });
  }
}
