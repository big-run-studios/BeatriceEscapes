import Phaser from "phaser";
import { PLAYER, COLORS, ARENA, COMBAT, JUMP, ComboNode, VisualPose } from "../config/game";
import { InputManager, Action } from "../systems/InputManager";
import { CombatStateMachine } from "../systems/CombatState";
import { HitFeel } from "../systems/HitFeel";
import { ProjectileConfig } from "./Projectile";

export interface ProjectileSpawnRequest {
  x: number;
  y: number;
  facingRight: boolean;
  config: ProjectileConfig;
}

export interface MeleeHitBox {
  x: number;
  y: number;
  range: number;
  depthRange: number;
  damage: number;
  knockback: number;
  hitstopMs: number;
  shakeIntensity: number;
  shakeDuration: number;
}

export class Player {
  readonly container: Phaser.GameObjects.Container;

  private body: Phaser.GameObjects.Rectangle;
  private head: Phaser.GameObjects.Rectangle;
  private shadow: Phaser.GameObjects.Ellipse;
  private nameTag: Phaser.GameObjects.Text;

  private beaBody: Phaser.GameObjects.Rectangle;
  private beaHead: Phaser.GameObjects.Ellipse;

  private scene: Phaser.Scene;
  private inputMgr: InputManager;
  private combat: CombatStateMachine;
  private hitFeel: HitFeel;
  facingRight = true;

  private bodyBaseY = 0;
  private headBaseY: number;

  private jumpOffset = 0;
  private jumpVelocity = 0;

  private rushTimer = 0;
  private rushSpeed = 0;
  private beaVisible = true;

  private pendingProjectiles: ProjectileSpawnRequest[] = [];

  constructor(scene: Phaser.Scene, x: number, y: number, inputMgr: InputManager, hitFeel: HitFeel) {
    this.scene = scene;
    this.inputMgr = inputMgr;
    this.hitFeel = hitFeel;
    this.combat = new CombatStateMachine();

    this.shadow = scene.add.ellipse(0, PLAYER.height / 2 + 4, PLAYER.width + 16, 14, 0x000000, 0.3);

    this.body = scene.add.rectangle(0, 0, PLAYER.width, PLAYER.height, COLORS.andrewFill);
    this.body.setStrokeStyle(2, COLORS.andrewOutline);

    this.head = scene.add.rectangle(0, -PLAYER.height / 2 - 12, PLAYER.width * 0.7, 24, COLORS.andrewFill);
    this.head.setStrokeStyle(2, COLORS.andrewOutline);

    this.beaBody = scene.add.rectangle(0, -PLAYER.height / 2 - 28, 22, 28, COLORS.beaFill);
    this.beaBody.setStrokeStyle(2, COLORS.beaOutline);

    this.beaHead = scene.add.ellipse(0, -PLAYER.height / 2 - 46, 18, 18, COLORS.beaFill);
    this.beaHead.setStrokeStyle(2, COLORS.beaOutline);

    this.nameTag = scene.add.text(0, -PLAYER.height / 2 - 62, "ANDREW & BEA", {
      fontFamily: "monospace",
      fontSize: "10px",
      color: "#5a9bba",
    });
    this.nameTag.setOrigin(0.5);

    this.container = scene.add.container(x, y, [
      this.shadow,
      this.body,
      this.head,
      this.beaBody,
      this.beaHead,
      this.nameTag,
    ]);

    this.bodyBaseY = 0;
    this.headBaseY = -PLAYER.height / 2 - 12;
  }

  get x(): number { return this.container.x; }
  get y(): number { return this.container.y; }
  get isAttacking(): boolean { return this.combat.isAttacking; }
  get currentComboId(): string | null { return this.combat.currentNode?.id ?? null; }

  get beaWorldX(): number {
    const dir = this.facingRight ? 1 : -1;
    return this.container.x + dir * 10;
  }
  get beaWorldY(): number {
    return this.container.y - PLAYER.height / 2 - 28 + this.jumpOffset;
  }

  /** Drain pending projectile spawn requests (called by ArenaScene each frame). */
  drainProjectileRequests(): ProjectileSpawnRequest[] {
    const reqs = this.pendingProjectiles;
    this.pendingProjectiles = [];
    return reqs;
  }

  update(dt: number): void {
    this.combat.update(dt);

    if (this.combat.inHitstop) {
      this.applyHitstopVisual();
      return;
    }

    this.handleInput();
    this.handleJump(dt);
    this.handleRush(dt);
    this.handleAttackProgress(dt);
    this.handleMovement(dt);
    this.applyVisualState();
    this.clampToBounds();
    this.container.setDepth(this.container.y);
  }

  private handleInput(): void {
    if (this.inputMgr.justPressed(Action.ATTACK)) {
      this.onComboInput("L");
    } else if (this.inputMgr.justPressed(Action.HEAVY)) {
      this.onComboInput("H");
    }

    if (this.inputMgr.justPressed(Action.JUMP)) {
      this.onJumpInput();
    }
  }

  private onComboInput(input: "L" | "H"): void {
    if (this.combat.isJumping) return;

    if (!this.combat.isAttacking && !this.combat.inHitstop) {
      const node = this.combat.startCombo(input);
      if (node) this.onNodeEntered(node);
      return;
    }

    this.combat.bufferInput(input);
  }

  private onJumpInput(): void {
    if (this.combat.isBusy) return;
    this.combat.enterJump();
    this.jumpVelocity = -JUMP.height / (JUMP.duration / 2);
    this.jumpOffset = 0;
  }

  private handleJump(dt: number): void {
    if (!this.combat.isJumping) return;

    const gravity = (2 * JUMP.height) / Math.pow(JUMP.duration / 2, 2);
    this.jumpVelocity += gravity * dt;
    this.jumpOffset += this.jumpVelocity * dt;

    if (this.jumpOffset >= 0) {
      this.jumpOffset = 0;
      this.jumpVelocity = 0;
      this.combat.toIdle();
    }
  }

  private handleRush(dt: number): void {
    if (this.rushTimer <= 0) return;
    this.rushTimer -= dt;
    const dir = this.facingRight ? 1 : -1;
    this.container.x += dir * this.rushSpeed * dt;
  }

  private handleAttackProgress(_dt: number): void {
    const s = this.combat;
    if (!s.isAttacking) return;

    const node = s.currentNode;
    if (!node) return;

    if (s.stateTimer >= node.hitFrame && !s.hasHitThisSwing) {
      s.hasHitThisSwing = true;
      this.onHitFrame(node);
    }

    if (s.stateTimer >= node.duration) {
      this.onAttackEnd();
    }
  }

  /** Returns hit info for melee attacks only. Projectiles handle their own collision. */
  getHitBox(): MeleeHitBox | null {
    const s = this.combat;
    if (!s.isAttacking || s.hasHitThisSwing) return null;

    const node = s.currentNode;
    if (!node) return null;

    // Only melee and rush produce a melee hitbox
    if (node.moveType !== "melee" && node.moveType !== "rush") return null;
    if (s.stateTimer < node.hitFrame) return null;

    const dir = this.facingRight ? 1 : -1;
    return {
      x: this.container.x + dir * COMBAT.meleeHitRange,
      y: this.container.y,
      range: COMBAT.meleeHitRange,
      depthRange: COMBAT.meleeHitDepthRange,
      damage: node.damage,
      knockback: node.knockback,
      hitstopMs: node.hitstopMs,
      shakeIntensity: node.shakeIntensity,
      shakeDuration: node.shakeDuration,
    };
  }

  markHitConnected(): void {
    this.combat.hasHitThisSwing = true;
  }

  private onNodeEntered(node: ComboNode): void {
    this.fireSwingVFX(node);

    if (node.moveType === "rush" && node.rush) {
      this.rushTimer = node.rush.duration;
      this.rushSpeed = node.rush.speed;
      this.hitFeel.shake(node.shakeIntensity, node.shakeDuration);
    }
  }

  private onHitFrame(node: ComboNode): void {
    if (node.moveType === "projectile" && node.projectile) {
      this.spawnProjectile(node);
    } else if (node.moveType === "burst" && node.projectile) {
      this.spawnBurst(node);
    } else if (node.moveType === "toss") {
      this.startBeaToss(node);
    }

    this.hitFeel.shake(node.shakeIntensity, node.shakeDuration);

    if (node.moveType === "melee" || node.moveType === "rush") {
      this.combat.enterHitstop(node.hitstopMs);
    }
  }

  private spawnProjectile(node: ComboNode): void {
    if (!node.projectile) return;
    this.pendingProjectiles.push({
      x: this.beaWorldX + (this.facingRight ? 20 : -20),
      y: this.beaWorldY,
      facingRight: this.facingRight,
      config: {
        ...node.projectile,
        damage: node.damage,
        knockback: node.knockback,
        hitstopMs: node.hitstopMs,
        shakeIntensity: node.shakeIntensity,
        shakeDuration: node.shakeDuration,
      },
    });
  }

  private spawnBurst(node: ComboNode): void {
    if (!node.projectile) return;
    const count = node.burstCount ?? 3;
    for (let i = 0; i < count; i++) {
      this.scene.time.delayedCall(i * 60, () => {
        this.pendingProjectiles.push({
          x: this.beaWorldX + (this.facingRight ? 20 : -20),
          y: this.beaWorldY + (i - 1) * 8,
          facingRight: this.facingRight,
          config: {
            ...node.projectile!,
            damage: node.damage,
            knockback: node.knockback,
            hitstopMs: node.hitstopMs,
            shakeIntensity: node.shakeIntensity,
            shakeDuration: node.shakeDuration,
          },
        });
      });
    }
  }

  private startBeaToss(node: ComboNode): void {
    this.setBeaVisible(false);

    this.pendingProjectiles.push({
      x: this.beaWorldX,
      y: this.beaWorldY,
      facingRight: this.facingRight,
      config: {
        radius: 12,
        speed: 550,
        color: COLORS.beaFill,
        maxRange: 300,
        damage: node.damage,
        knockback: node.knockback,
        hitstopMs: node.hitstopMs,
        shakeIntensity: node.shakeIntensity,
        shakeDuration: node.shakeDuration,
      },
    });

    this.scene.time.delayedCall(500, () => {
      this.setBeaVisible(true);
    });
  }

  private setBeaVisible(visible: boolean): void {
    this.beaVisible = visible;
    this.beaBody.setAlpha(visible ? 1 : 0);
    this.beaHead.setAlpha(visible ? 1 : 0);
  }

  private onAttackEnd(): void {
    const next = this.combat.advanceCombo();
    if (next) {
      this.onNodeEntered(next);
      return;
    }
    this.combat.toIdle();
    this.rushTimer = 0;
  }

  private fireSwingVFX(node: ComboNode): void {
    const v = node.visual;
    const isHeavy = v === "andrew-punch" || v === "andrew-slam" || v === "andrew-rush" || v === "andrew-uppercut";

    if (isHeavy) {
      this.hitFeel.swingArc(this.container.x, this.container.y, this.facingRight, true);
    } else {
      const bx = this.beaWorldX;
      const by = this.beaWorldY;
      this.hitFeel.swingArc(bx, by, this.facingRight, false);
    }
  }

  private handleMovement(dt: number): void {
    if (this.combat.isAttacking) return;

    const move = this.inputMgr.getMovement();

    if (this.combat.isJumping) {
      this.container.x += move.x * PLAYER.speed * 0.6 * dt;
      this.container.y += move.y * PLAYER.depthSpeed * 0.6 * dt;
    } else {
      this.container.x += move.x * PLAYER.speed * dt;
      this.container.y += move.y * PLAYER.depthSpeed * dt;

      if (Math.abs(move.x) > 0.1 || Math.abs(move.y) > 0.1) {
        this.combat.toWalk();
      } else {
        if (this.combat.state === "walk") this.combat.toIdle();
      }
    }

    if (move.x > 0.1) this.facingRight = true;
    if (move.x < -0.1) this.facingRight = false;
    this.container.scaleX = this.facingRight ? 1 : -1;
  }

  private applyVisualState(): void {
    const s = this.combat;
    const jOff = this.jumpOffset;

    this.body.y = this.bodyBaseY + jOff;
    this.head.y = this.headBaseY + jOff;
    if (this.beaVisible) {
      this.beaBody.y = -PLAYER.height / 2 - 28 + jOff;
      this.beaHead.y = -PLAYER.height / 2 - 46 + jOff;
    }
    this.nameTag.y = -PLAYER.height / 2 - 62 + jOff;

    this.shadow.scaleX = 1 - Math.abs(jOff) / 300;
    this.shadow.scaleY = 1 - Math.abs(jOff) / 300;

    if (s.isAttacking && s.currentNode) {
      const progress = s.stateTimer / s.currentNode.duration;
      this.applyAttackPose(progress, s.currentNode.visual);
    } else {
      this.resetPose();
    }
  }

  private applyAttackPose(progress: number, visual: VisualPose): void {
    const jOff = this.jumpOffset;
    const swing = Math.sin(progress * Math.PI);

    switch (visual) {
      case "andrew-punch": {
        const lunge = swing * 12;
        this.body.scaleX = 1 + swing * 0.12;
        this.body.scaleY = 1 - swing * 0.15;
        this.head.x = lunge * 0.5;
        this.head.y = this.headBaseY - lunge * 0.3 + jOff;
        break;
      }
      case "andrew-slam": {
        const rise = progress < 0.5 ? swing * 16 : 0;
        const slam = progress >= 0.5 ? (progress - 0.5) * 2 : 0;
        this.body.scaleY = 1 - slam * 0.25;
        this.body.scaleX = 1 + slam * 0.15;
        this.head.y = this.headBaseY - rise + jOff;
        this.body.y = this.bodyBaseY + slam * 6 + jOff;
        break;
      }
      case "andrew-rush": {
        this.body.scaleX = 1 + swing * 0.18;
        this.body.scaleY = 1 - swing * 0.1;
        this.head.x = swing * 8;
        this.head.y = this.headBaseY + swing * 3 + jOff;
        break;
      }
      case "andrew-uppercut": {
        const rise = swing * 10;
        this.body.y = this.bodyBaseY - rise + jOff;
        this.head.y = this.headBaseY - rise * 1.4 + jOff;
        this.head.x = swing * 4;
        break;
      }
      case "bea-cast": {
        const beaLean = swing * 14;
        this.beaBody.x = beaLean * 0.6;
        this.beaHead.x = beaLean * 0.8;
        this.beaBody.rotation = swing * 0.2;
        this.beaHead.rotation = swing * 0.15;
        this.body.scaleY = 1 - swing * 0.04;
        break;
      }
      case "bea-big-cast": {
        const beaLean = swing * 18;
        this.beaBody.x = beaLean * 0.4;
        this.beaHead.x = beaLean * 0.6;
        this.beaBody.y = -PLAYER.height / 2 - 28 - swing * 6 + jOff;
        this.beaHead.y = -PLAYER.height / 2 - 46 - swing * 8 + jOff;
        this.beaBody.rotation = swing * 0.25;
        this.beaHead.rotation = swing * 0.2;
        this.body.scaleY = 1 - swing * 0.06;
        break;
      }
      case "bea-burst": {
        const bob = Math.sin(progress * Math.PI * 6) * 3;
        this.beaBody.x = swing * 10;
        this.beaHead.x = swing * 12;
        this.beaHead.y = -PLAYER.height / 2 - 46 + bob + jOff;
        this.beaBody.rotation = swing * 0.15;
        break;
      }
      case "bea-finisher": {
        const glow = swing;
        this.beaBody.x = swing * 6;
        this.beaHead.x = swing * 8;
        this.beaBody.setAlpha(1 + glow * 0.5);
        this.beaHead.setAlpha(1 + glow * 0.5);
        this.beaBody.rotation = swing * 0.3;
        this.beaHead.rotation = swing * 0.25;
        break;
      }
      case "bea-toss": {
        this.body.scaleX = 1 + swing * 0.08;
        this.head.x = swing * 6;
        break;
      }
    }
  }

  private applyHitstopVisual(): void {
    const shake = (Math.random() - 0.5) * 3;
    this.body.x = shake;
    this.head.x = shake;
    if (this.beaVisible) {
      this.beaBody.x = shake;
      this.beaHead.x = shake;
    }
  }

  private resetPose(): void {
    this.body.y = this.bodyBaseY + this.jumpOffset;
    this.body.scaleX = 1;
    this.body.scaleY = 1;
    this.body.x = 0;
    this.head.y = this.headBaseY + this.jumpOffset;
    this.head.x = 0;
    this.beaBody.x = 0;
    this.beaHead.x = 0;
    this.beaBody.rotation = 0;
    this.beaHead.rotation = 0;
    if (this.beaVisible) {
      this.beaBody.setAlpha(1);
      this.beaHead.setAlpha(1);
    }
  }

  private clampToBounds(): void {
    const pad = ARENA.boundaryPadding;
    const halfW = PLAYER.width / 2;
    this.container.x = Phaser.Math.Clamp(this.container.x, pad + halfW, ARENA.width - pad - halfW);
    this.container.y = Phaser.Math.Clamp(this.container.y, ARENA.groundY, ARENA.groundY + ARENA.groundHeight - pad);
  }
}
