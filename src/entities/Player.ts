import Phaser from "phaser";
import { PLAYER, COLORS, ARENA, COMBAT, JUMP } from "../config/game";
import { InputManager, Action } from "../systems/InputManager";
import { CombatStateMachine, AttackData } from "../systems/CombatState";
import { HitFeel } from "../systems/HitFeel";

export class Player {
  readonly container: Phaser.GameObjects.Container;

  private body: Phaser.GameObjects.Rectangle;
  private head: Phaser.GameObjects.Rectangle;
  private shadow: Phaser.GameObjects.Ellipse;
  private nameTag: Phaser.GameObjects.Text;

  private beaBody: Phaser.GameObjects.Rectangle;
  private beaHead: Phaser.GameObjects.Ellipse;

  private inputMgr: InputManager;
  private combat: CombatStateMachine;
  private hitFeel: HitFeel;
  facingRight = true;

  private bodyBaseY = 0;
  private headBaseY: number;

  private jumpOffset = 0;
  private jumpVelocity = 0;

  constructor(scene: Phaser.Scene, x: number, y: number, inputMgr: InputManager, hitFeel: HitFeel) {
    this.inputMgr = inputMgr;
    this.hitFeel = hitFeel;
    this.combat = new CombatStateMachine();

    this.shadow = scene.add.ellipse(0, PLAYER.height / 2 + 4, PLAYER.width + 16, 14, 0x000000, 0.3);

    this.body = scene.add.rectangle(0, 0, PLAYER.width, PLAYER.height, COLORS.andrewFill);
    this.body.setStrokeStyle(2, COLORS.andrewOutline);

    this.head = scene.add.rectangle(0, -PLAYER.height / 2 - 12, PLAYER.width * 0.7, 24, COLORS.andrewFill);
    this.head.setStrokeStyle(2, COLORS.andrewOutline);

    // Bea sits on Andrew's shoulders
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

  /** World-space position of Bea (for attack VFX origin). */
  get beaWorldX(): number {
    const dir = this.facingRight ? 1 : -1;
    return this.container.x + dir * this.beaBody.x;
  }
  get beaWorldY(): number {
    return this.container.y + this.beaBody.y + this.jumpOffset;
  }

  update(dt: number): void {
    this.combat.update(dt);

    if (this.combat.inHitstop) {
      this.applyHitstopVisual();
      return;
    }

    this.handleInput();
    this.handleJump(dt);
    this.handleAttackProgress();
    this.handleMovement(dt);
    this.applyVisualState();
    this.clampToBounds();
    this.container.setDepth(this.container.y);
  }

  private handleInput(): void {
    if (this.inputMgr.justPressed(Action.ATTACK)) {
      this.onAttackInput();
    } else if (this.inputMgr.justPressed(Action.HEAVY)) {
      this.onHeavyInput();
    }

    if (this.inputMgr.justPressed(Action.JUMP)) {
      this.onJumpInput();
    }
  }

  private onAttackInput(): void {
    const s = this.combat;
    if (s.isJumping) return;

    if (!s.isAttacking) {
      s.enterAttack("light1");
      this.fireLightSwingVFX();
      return;
    }

    if (s.state === "light1" || s.state === "light2") {
      s.comboBuffered = true;
    }
  }

  private onHeavyInput(): void {
    if (this.combat.isJumping) return;
    if (!this.combat.isAttacking) {
      this.combat.enterAttack("heavy");
      this.fireHeavySwingVFX();
    }
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

  private handleAttackProgress(): void {
    const s = this.combat;
    if (!s.isAttacking) return;

    const data = this.getCurrentAttackData();
    if (!data) return;

    if (s.stateTimer >= data.hitFrame && !s.hasHitThisSwing) {
      s.hasHitThisSwing = true;
      this.onHitFrame(data);
    }

    if (s.stateTimer >= data.duration) {
      this.onAttackEnd();
    }
  }

  /** Returns hit info for external collision checking. */
  getHitBox(): { x: number; y: number; range: number; depthRange: number; data: AttackData } | null {
    const s = this.combat;
    if (!s.isAttacking || s.hasHitThisSwing) return null;

    const data = this.getCurrentAttackData();
    if (!data) return null;
    if (s.stateTimer < data.hitFrame) return null;

    const dir = this.facingRight ? 1 : -1;
    return {
      x: this.container.x + dir * COMBAT.hitRange,
      y: this.container.y,
      range: COMBAT.hitRange,
      depthRange: COMBAT.hitDepthRange,
      data,
    };
  }

  markHitConnected(): void {
    this.combat.hasHitThisSwing = true;
  }

  private onHitFrame(data: AttackData): void {
    const isLight = this.combat.state === "light1" || this.combat.state === "light2" || this.combat.state === "light3";
    const isFinisher = this.combat.state === "light3";
    const isHeavy = this.combat.state === "heavy";

    if (isHeavy) {
      this.hitFeel.shake(COMBAT.shakeIntensity.heavy, COMBAT.shakeDuration.heavy);
    } else if (isFinisher) {
      this.hitFeel.shake(COMBAT.shakeIntensity.finisher, COMBAT.shakeDuration.finisher);
    } else if (isLight) {
      this.hitFeel.shake(COMBAT.shakeIntensity.light, COMBAT.shakeDuration.light);
    }

    this.combat.enterHitstop(data.hitstopMs);
  }

  private onAttackEnd(): void {
    const s = this.combat;

    if (s.comboBuffered) {
      if (s.state === "light1") {
        s.enterAttack("light2");
        this.fireLightSwingVFX();
        return;
      }
      if (s.state === "light2") {
        s.enterAttack("light3");
        this.fireLightSwingVFX();
        return;
      }
    }

    s.toIdle();
  }

  private getCurrentAttackData(): AttackData | null {
    switch (this.combat.state) {
      case "light1": return COMBAT.lightChain[0];
      case "light2": return COMBAT.lightChain[1];
      case "light3": return COMBAT.lightChain[2];
      case "heavy": return COMBAT.heavy;
      default: return null;
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

  private fireLightSwingVFX(): void {
    const dir = this.facingRight ? 1 : -1;
    const beaX = this.container.x + dir * 10;
    const beaY = this.container.y - PLAYER.height / 2 - 28 + this.jumpOffset;
    this.hitFeel.swingArc(beaX, beaY, this.facingRight, false);
  }

  private fireHeavySwingVFX(): void {
    this.hitFeel.swingArc(this.container.x, this.container.y, this.facingRight, true);
  }

  private applyVisualState(): void {
    const s = this.combat;
    const jOff = this.jumpOffset;

    this.body.y = this.bodyBaseY + jOff;
    this.head.y = this.headBaseY + jOff;
    this.beaBody.y = -PLAYER.height / 2 - 28 + jOff;
    this.beaHead.y = -PLAYER.height / 2 - 46 + jOff;
    this.nameTag.y = -PLAYER.height / 2 - 62 + jOff;

    this.shadow.scaleX = 1 - Math.abs(jOff) / 300;
    this.shadow.scaleY = 1 - Math.abs(jOff) / 300;

    if (s.isAttacking) {
      const data = this.getCurrentAttackData();
      if (data) {
        const progress = s.stateTimer / data.duration;
        const isHeavy = s.state === "heavy";
        const isLight = s.state === "light1" || s.state === "light2" || s.state === "light3";
        this.applyAttackPose(progress, isHeavy, isLight);
      }
    } else {
      this.resetPose();
    }
  }

  private applyAttackPose(progress: number, heavy: boolean, light: boolean): void {
    const jOff = this.jumpOffset;
    const swing = Math.sin(progress * Math.PI);

    if (heavy) {
      const lunge = swing * 12;
      this.body.scaleX = 1 + swing * 0.12;
      this.body.scaleY = 1 - swing * 0.15;
      this.head.x = lunge * 0.5;
      this.head.y = this.headBaseY - lunge * 0.3 + jOff;
    } else if (light) {
      // Bea leans forward to deliver the attack
      const beaLean = swing * 14;
      this.beaBody.x = beaLean * 0.6;
      this.beaHead.x = beaLean * 0.8;
      this.beaBody.rotation = swing * 0.2;
      this.beaHead.rotation = swing * 0.15;

      // Andrew braces slightly
      this.body.scaleY = 1 - swing * 0.04;
    }
  }

  private applyHitstopVisual(): void {
    const shake = (Math.random() - 0.5) * 3;
    this.body.x = shake;
    this.head.x = shake;
    this.beaBody.x = shake;
    this.beaHead.x = shake;
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
  }

  private clampToBounds(): void {
    const pad = ARENA.boundaryPadding;
    const halfW = PLAYER.width / 2;
    this.container.x = Phaser.Math.Clamp(this.container.x, pad + halfW, ARENA.width - pad - halfW);
    this.container.y = Phaser.Math.Clamp(this.container.y, ARENA.groundY, ARENA.groundY + ARENA.groundHeight - pad);
  }
}
