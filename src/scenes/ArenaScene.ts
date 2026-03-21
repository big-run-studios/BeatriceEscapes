import Phaser from "phaser";
import { GAME_WIDTH, GAME_HEIGHT, ARENA, COLORS, COMBAT, COMBO_TREE, ComboNode } from "../config/game";
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
  private rushHitDummies: Set<TrainingDummy> = new Set();
  private comboListTexts: Map<string, Phaser.GameObjects.Text> = new Map();
  private comboNameDisplay!: Phaser.GameObjects.Text;

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
    if (!hitBox) {
      this.rushHitDummies.clear();
      return;
    }

    for (const dummy of this.dummies) {
      if (!dummy.isAlive) continue;
      if (hitBox.isRush && this.rushHitDummies.has(dummy)) continue;

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

        if (hitBox.isRush) {
          this.rushHitDummies.add(dummy);
        } else {
          this.player.markHitConnected();
          break;
        }
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
    const activeNode = comboId ? this.findNodeById(comboId) : null;

    for (const [id, text] of this.comboListTexts) {
      if (id === comboId) {
        text.setColor(COLORS.accent);
        text.setScale(1.15);
        text.setAlpha(1);
      } else {
        text.setColor(COLORS.subtitleText);
        text.setScale(1);
        text.setAlpha(0.5);
      }
    }

    if (activeNode) {
      this.comboNameDisplay.setText(activeNode.name);
      this.comboNameDisplay.setAlpha(1);
    } else if (this.comboNameDisplay.alpha > 0) {
      this.comboNameDisplay.setAlpha(this.comboNameDisplay.alpha - 0.04);
    }
  }

  private findNodeById(id: string): ComboNode | null {
    const search = (nodes: ComboNode[]): ComboNode | null => {
      for (const n of nodes) {
        if (n.id === id) return n;
        const found = search(n.children);
        if (found) return found;
      }
      return null;
    };
    return search(COMBO_TREE);
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

    this.buildComboListHUD();

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

  private buildComboListHUD(): void {
    const allNodes: ComboNode[] = [];
    const collect = (nodes: ComboNode[]) => {
      for (const n of nodes) {
        allNodes.push(n);
        collect(n.children);
      }
    };
    collect(COMBO_TREE);

    const squareNodes = allNodes.filter((n) => n.id[0] === "L");
    const triangleNodes = allNodes.filter((n) => n.id[0] === "H");

    const yTop = 14;
    const yBot = 30;
    const startX = 16;
    const spacing = 10;

    let xCursor = startX;

    const labelStyle = {
      fontFamily: "monospace",
      fontSize: "12px",
      color: COLORS.subtitleText,
    };

    const headerL = this.add.text(xCursor, yTop - 2, "Square:", {
      ...labelStyle,
      fontSize: "10px",
    });
    headerL.setScrollFactor(0);
    headerL.setDepth(20000);
    headerL.setAlpha(0.6);
    xCursor += headerL.width + 8;

    for (const node of squareNodes) {
      const t = this.add.text(xCursor, yTop, node.id, labelStyle);
      t.setScrollFactor(0);
      t.setDepth(20000);
      t.setAlpha(0.5);
      t.setOrigin(0, 0);
      this.comboListTexts.set(node.id, t);
      xCursor += t.width + spacing;
    }

    xCursor = startX;

    const headerH = this.add.text(xCursor, yBot - 2, "Triangle:", {
      ...labelStyle,
      fontSize: "10px",
    });
    headerH.setScrollFactor(0);
    headerH.setDepth(20000);
    headerH.setAlpha(0.6);
    xCursor += headerH.width + 8;

    for (const node of triangleNodes) {
      const t = this.add.text(xCursor, yBot, node.id, labelStyle);
      t.setScrollFactor(0);
      t.setDepth(20000);
      t.setAlpha(0.5);
      t.setOrigin(0, 0);
      this.comboListTexts.set(node.id, t);
      xCursor += t.width + spacing;
    }

    this.comboNameDisplay = this.add.text(GAME_WIDTH / 2, 54, "", {
      fontFamily: "monospace",
      fontSize: "20px",
      color: COLORS.accent,
      fontStyle: "bold",
    });
    this.comboNameDisplay.setOrigin(0.5);
    this.comboNameDisplay.setScrollFactor(0);
    this.comboNameDisplay.setDepth(20000);
    this.comboNameDisplay.setAlpha(0);
  }
}
