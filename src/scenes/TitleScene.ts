import Phaser from "phaser";
import { GAME_WIDTH, GAME_HEIGHT, COLORS } from "../config/game";
import { InputManager, Action } from "../systems/InputManager";

export class TitleScene extends Phaser.Scene {
  private input_mgr!: InputManager;
  private controllerStatus!: Phaser.GameObjects.Text;
  private prompt!: Phaser.GameObjects.Text;
  private ready = false;
  private accepted = false;

  constructor() {
    super({ key: "TitleScene" });
  }

  create(): void {
    this.input_mgr = new InputManager(this);
    this.ready = false;
    this.accepted = false;

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

    this.prompt = this.add.text(cx, cy + 120, "", {
      fontFamily: "Georgia, serif",
      fontSize: "20px",
      color: COLORS.accent,
    });
    this.prompt.setOrigin(0.5);
    this.prompt.setAlpha(0);

    this.controllerStatus = this.add.text(16, GAME_HEIGHT - 16, "", {
      fontFamily: "monospace",
      fontSize: "14px",
      color: COLORS.subtitleText,
    });
    this.controllerStatus.setOrigin(0, 1);

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

    this.tweens.add({
      targets: this.prompt,
      alpha: { from: 0, to: 1 },
      delay: 1400,
      duration: 600,
      ease: "Power2",
      onComplete: () => {
        this.ready = true;
      },
    });

    this.tweens.add({
      targets: this.prompt,
      alpha: { from: 1, to: 0.3 },
      delay: 2200,
      duration: 800,
      ease: "Sine.easeInOut",
      yoyo: true,
      repeat: -1,
    });
  }

  update(): void {
    this.updateControllerStatus();
    this.updatePromptLabel();

    if (this.ready && !this.accepted) {
      if (this.input_mgr.justPressed(Action.CONFIRM) || this.input_mgr.justPressed(Action.PAUSE)) {
        this.accepted = true;
        this.onStart();
      }
    }

    this.input_mgr.postUpdate();
  }

  private updateControllerStatus(): void {
    if (this.input_mgr.gamepadConnected) {
      const name = this.input_mgr.gamepadName;
      const shortName = name.length > 40 ? name.substring(0, 37) + "..." : name;
      this.controllerStatus.setText(`Controller: ${shortName}`);
      this.controllerStatus.setColor(COLORS.accent);
    } else {
      this.controllerStatus.setText("No controller detected");
      this.controllerStatus.setColor(COLORS.subtitleText);
    }
  }

  private updatePromptLabel(): void {
    const confirmLabel = this.input_mgr.getLabel(Action.CONFIRM);
    this.prompt.setText(`press ${confirmLabel}`);
  }

  private onStart(): void {
    this.tweens.killAll();

    this.cameras.main.fadeOut(400, 0, 0, 0);
    this.cameras.main.once("camerafadeoutcomplete", () => {
      this.scene.start("HubScene");
    });
  }
}
