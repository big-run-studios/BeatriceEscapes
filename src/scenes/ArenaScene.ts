import Phaser from "phaser";
import { GAME_WIDTH, GAME_HEIGHT, ARENA, COLORS, COMBAT } from "../config/game";
import { InputManager, Action } from "../systems/InputManager";
import { HitFeel } from "../systems/HitFeel";
import { Player } from "../entities/Player";
import { TrainingDummy } from "../entities/TrainingDummy";
import { Projectile } from "../entities/Projectile";

export class ArenaScene extends Phaser.Scene {
  private input_mgr!: InputManager;
  private hitFeel!: HitFeel;
  private player!: Player;
  private dummies: TrainingDummy[] = [];
  private projectiles: Projectile[] = [];
  private comboDisplay!: Phaser.GameObjects.Text;

  constructor() {
    super({ key: "ArenaScene" });
  }

  create(): void {
    this.input_mgr = new InputManager(this);
    this.hitFeel = new HitFeel(this);

    this.drawArena();

    const startX = ARENA.width / 2 - 150;
    const startY = ARENA.groundY + ARENA.groundHeight / 2;
    this.player = new Player(this, startX, startY, this.input_mgr, this.hitFeel);

    this.spawnDummies();
    this.setupCamera();
    this.addHUD();
  }

  update(_time: number, delta: number): void {
    const dt = delta / 1000;
    this.player.update(dt);

    this.processProjectileSpawns();

    for (const dummy of this.dummies) {
      dummy.update(dt);
    }

    for (const proj of this.projectiles) {
      proj.update(dt);
    }

    this.checkMeleeHits();
    this.checkProjectileHits();
    this.pruneDeadProjectiles();
    this.updateComboDisplay();
    this.input_mgr.postUpdate();
  }

  private processProjectileSpawns(): void {
    const reqs = this.player.drainProjectileRequests();
    for (const req of reqs) {
      const proj = new Projectile(this, req.x, req.y, req.facingRight, req.config);
      this.projectiles.push(proj);
    }
  }

  private checkMeleeHits(): void {
    const hitBox = this.player.getHitBox();
    if (!hitBox) return;

    for (const dummy of this.dummies) {
      if (!dummy.isAlive) continue;

      const dx = Math.abs(hitBox.x - dummy.x);
      const dy = Math.abs(this.player.y - dummy.y);

      if (dx < hitBox.range + dummy.width / 2 && dy < hitBox.depthRange + dummy.height / 4) {
        const dir = this.player.facingRight ? 1 : -1;
        dummy.takeHit(
          hitBox.damage,
          dir * hitBox.knockback,
          (Math.random() - 0.5) * 30
        );

        this.hitFeel.impactFlash(dummy.x, dummy.y - dummy.height / 3);
        this.hitFeel.shake(hitBox.shakeIntensity, hitBox.shakeDuration);
        this.player.markHitConnected();
        break;
      }
    }
  }

  private checkProjectileHits(): void {
    for (const proj of this.projectiles) {
      if (!proj.alive) continue;

      for (const dummy of this.dummies) {
        if (!dummy.isAlive) continue;

        const dx = Math.abs(proj.x - dummy.x);
        const dy = Math.abs(proj.worldY - dummy.y);

        if (dx < proj.radius + dummy.width / 2 && dy < COMBAT.meleeHitDepthRange + dummy.height / 4) {
          const dir = proj.x < dummy.x ? 1 : -1;
          dummy.takeHit(
            proj.damage,
            dir * proj.knockback,
            (Math.random() - 0.5) * 20
          );

          this.hitFeel.projectileImpact(dummy.x, dummy.y - dummy.height / 3, proj.circle.fillColor);
          this.hitFeel.shake(proj.shakeIntensity, proj.shakeDuration);
          proj.destroy();
          break;
        }
      }
    }
  }

  private pruneDeadProjectiles(): void {
    this.projectiles = this.projectiles.filter((p) => p.alive);
  }

  private updateComboDisplay(): void {
    const comboId = this.player.currentComboId;

    if (comboId) {
      this.comboDisplay.setText(comboId);
      this.comboDisplay.setAlpha(1);
    } else if (this.comboDisplay.alpha > 0) {
      this.comboDisplay.setAlpha(this.comboDisplay.alpha - 0.05);
    }
  }

  private spawnDummies(): void {
    const cx = ARENA.width / 2;
    const cy = ARENA.groundY + ARENA.groundHeight / 2;

    this.dummies.push(new TrainingDummy(this, cx + 120, cy));
    this.dummies.push(new TrainingDummy(this, cx + 280, cy - 40));
    this.dummies.push(new TrainingDummy(this, cx + 200, cy + 60));
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
    const version = this.add.text(GAME_WIDTH - 16, GAME_HEIGHT - 16, "B0.3.0", {
      fontFamily: "monospace",
      fontSize: "14px",
      color: COLORS.subtitleText,
    });
    version.setOrigin(1, 1);
    version.setScrollFactor(0);
    version.setDepth(20000);

    const controlHint = this.add.text(16, GAME_HEIGHT - 16, "", {
      fontFamily: "monospace",
      fontSize: "11px",
      color: COLORS.subtitleText,
    });
    controlHint.setOrigin(0, 1);
    controlHint.setScrollFactor(0);
    controlHint.setDepth(20000);

    this.comboDisplay = this.add.text(GAME_WIDTH / 2, 60, "", {
      fontFamily: "monospace",
      fontSize: "18px",
      color: COLORS.accent,
      fontStyle: "bold",
    });
    this.comboDisplay.setOrigin(0.5);
    this.comboDisplay.setScrollFactor(0);
    this.comboDisplay.setDepth(20000);
    this.comboDisplay.setAlpha(0);

    this.time.addEvent({
      delay: 200,
      loop: true,
      callback: () => {
        const dev = this.input_mgr.lastDevice;
        const move = dev === "gamepad" ? "L-Stick" : "WASD";
        const atk = this.input_mgr.getLabel(Action.ATTACK);
        const hvy = this.input_mgr.getLabel(Action.HEAVY);
        const jmp = this.input_mgr.getLabel(Action.JUMP);
        controlHint.setText(`Move: ${move}  |  Light: ${atk}  |  Heavy: ${hvy}  |  Jump: ${jmp}`);
      },
    });
  }
}
