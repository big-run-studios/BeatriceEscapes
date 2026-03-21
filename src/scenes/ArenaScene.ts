import Phaser from "phaser";
import { GAME_WIDTH, GAME_HEIGHT, ARENA, COLORS } from "../config/game";
import { InputManager, Action } from "../systems/InputManager";
import { HitFeel } from "../systems/HitFeel";
import { Player } from "../entities/Player";

export class ArenaScene extends Phaser.Scene {
  private input_mgr!: InputManager;
  private hitFeel!: HitFeel;
  private player!: Player;

  constructor() {
    super({ key: "ArenaScene" });
  }

  create(): void {
    this.input_mgr = new InputManager(this);
    this.hitFeel = new HitFeel(this);

    this.drawArena();

    const startX = ARENA.width / 2;
    const startY = ARENA.groundY + ARENA.groundHeight / 2;
    this.player = new Player(this, startX, startY, this.input_mgr, this.hitFeel);

    this.setupCamera();

    this.addHUD();
  }

  update(_time: number, delta: number): void {
    const dt = delta / 1000;
    this.player.update(dt);
    this.input_mgr.postUpdate();
  }

  private drawArena(): void {
    const bg = this.add.rectangle(
      ARENA.width / 2, ARENA.height / 2,
      ARENA.width, ARENA.height,
      COLORS.background
    );
    bg.setDepth(-1000);

    const ground = this.add.rectangle(
      ARENA.width / 2,
      ARENA.groundY + ARENA.groundHeight / 2,
      ARENA.width,
      ARENA.groundHeight,
      COLORS.groundFill
    );
    ground.setDepth(-999);

    const groundTop = this.add.rectangle(
      ARENA.width / 2,
      ARENA.groundY,
      ARENA.width,
      2,
      COLORS.groundLine
    );
    groundTop.setDepth(-998);

    this.drawGroundLines();
    this.drawBoundaryWalls();
  }

  private drawGroundLines(): void {
    const gfx = this.add.graphics();
    gfx.setDepth(-997);
    gfx.lineStyle(1, COLORS.groundLine, 0.3);

    const spacing = 60;
    for (let y = ARENA.groundY + spacing; y < ARENA.groundY + ARENA.groundHeight; y += spacing) {
      gfx.lineBetween(0, y, ARENA.width, y);
    }
  }

  private drawBoundaryWalls(): void {
    const wallThickness = ARENA.boundaryPadding;

    const leftWall = this.add.rectangle(
      wallThickness / 2, ARENA.height / 2,
      wallThickness, ARENA.height,
      COLORS.wallFill
    );
    leftWall.setDepth(10000);
    leftWall.setAlpha(0.8);

    const rightWall = this.add.rectangle(
      ARENA.width - wallThickness / 2, ARENA.height / 2,
      wallThickness, ARENA.height,
      COLORS.wallFill
    );
    rightWall.setDepth(10000);
    rightWall.setAlpha(0.8);
  }

  private setupCamera(): void {
    this.cameras.main.setBounds(0, 0, ARENA.width, ARENA.height);

    this.cameras.main.startFollow(this.player.container, true, 0.08, 0.08);
    this.cameras.main.setDeadzone(GAME_WIDTH * 0.15, GAME_HEIGHT * 0.15);
  }

  private addHUD(): void {
    const version = this.add.text(GAME_WIDTH - 16, GAME_HEIGHT - 16, "B0.2.0", {
      fontFamily: "monospace",
      fontSize: "14px",
      color: COLORS.subtitleText,
    });
    version.setOrigin(1, 1);
    version.setScrollFactor(0);
    version.setDepth(20000);

    const controlHint = this.add.text(16, GAME_HEIGHT - 16, "", {
      fontFamily: "monospace",
      fontSize: "12px",
      color: COLORS.subtitleText,
    });
    controlHint.setOrigin(0, 1);
    controlHint.setScrollFactor(0);
    controlHint.setDepth(20000);

    this.time.addEvent({
      delay: 200,
      loop: true,
      callback: () => {
        const moveLabel = this.input_mgr.lastDevice === "gamepad" ? "L-Stick / D-Pad" : "WASD / Arrows";
        const atkLabel = this.input_mgr.getLabel(Action.ATTACK);
        const hvyLabel = this.input_mgr.getLabel(Action.HEAVY);
        controlHint.setText(`Move: ${moveLabel}  |  Attack: ${atkLabel}  |  Heavy: ${hvyLabel}`);
      },
    });
  }
}
