import Phaser from "phaser";
import { PLAYER, COLORS, ARENA } from "../config/game";
import { InputManager } from "../systems/InputManager";

export class Player {
  readonly container: Phaser.GameObjects.Container;
  private body: Phaser.GameObjects.Rectangle;
  private head: Phaser.GameObjects.Rectangle;
  private shadow: Phaser.GameObjects.Ellipse;
  private nameTag: Phaser.GameObjects.Text;
  private inputMgr: InputManager;
  private facingRight = true;

  constructor(scene: Phaser.Scene, x: number, y: number, inputMgr: InputManager) {
    this.inputMgr = inputMgr;

    this.shadow = scene.add.ellipse(0, PLAYER.height / 2 + 4, PLAYER.width + 16, 14, 0x000000, 0.3);

    this.body = scene.add.rectangle(0, 0, PLAYER.width, PLAYER.height, COLORS.andrewFill);
    this.body.setStrokeStyle(2, COLORS.andrewOutline);

    this.head = scene.add.rectangle(0, -PLAYER.height / 2 - 12, PLAYER.width * 0.7, 24, COLORS.andrewFill);
    this.head.setStrokeStyle(2, COLORS.andrewOutline);

    this.nameTag = scene.add.text(0, -PLAYER.height / 2 - 34, "ANDREW", {
      fontFamily: "monospace",
      fontSize: "11px",
      color: "#5a9bba",
    });
    this.nameTag.setOrigin(0.5);

    this.container = scene.add.container(x, y, [
      this.shadow,
      this.body,
      this.head,
      this.nameTag,
    ]);
  }

  get x(): number {
    return this.container.x;
  }

  get y(): number {
    return this.container.y;
  }

  update(dt: number): void {
    const move = this.inputMgr.getMovement();

    const vx = move.x * PLAYER.speed;
    const vy = move.y * PLAYER.depthSpeed;

    this.container.x += vx * dt;
    this.container.y += vy * dt;

    this.clampToBounds();

    if (move.x > 0.1) this.facingRight = true;
    if (move.x < -0.1) this.facingRight = false;
    this.container.scaleX = this.facingRight ? 1 : -1;

    this.updateDepthSort();
  }

  private clampToBounds(): void {
    const pad = ARENA.boundaryPadding;
    const halfW = PLAYER.width / 2;

    this.container.x = Phaser.Math.Clamp(
      this.container.x,
      pad + halfW,
      ARENA.width - pad - halfW
    );
    this.container.y = Phaser.Math.Clamp(
      this.container.y,
      ARENA.groundY,
      ARENA.groundY + ARENA.groundHeight - pad
    );
  }

  private updateDepthSort(): void {
    this.container.setDepth(this.container.y);
  }
}
