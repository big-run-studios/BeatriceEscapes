import Phaser from "phaser";
import {
  PLAYER, COLORS, ARENA, COMBAT, JUMP, AIR_ATTACK, THROW, ULTIMATE,
  DASH, PLAYER_HIT, ComboNode, VisualPose,
} from "../config/game";
import { InputManager, Action } from "../systems/InputManager";
import { CombatStateMachine } from "../systems/CombatState";
import { HitFeel } from "../systems/HitFeel";
import { BoonState } from "../systems/BoonState";
import { ProjectileConfig } from "./Projectile";
import { TrainingDummy } from "./TrainingDummy";

export interface ProjectileSpawnRequest {
  x: number; y: number; facingRight: boolean; config: ProjectileConfig;
}

export interface MeleeHitBox {
  x: number; y: number; range: number; depthRange: number;
  damage: number; knockback: number; hitstopMs: number;
  shakeIntensity: number; shakeDuration: number; isRush: boolean;
}

export interface AoeHit {
  x: number; y: number; radius: number; depthRange: number;
  damage: number; knockback: number; hitstopMs: number;
  shakeIntensity: number; shakeDuration: number;
}

type UltimatePhase = "setup" | "charge" | "blast" | "recovery";

const HP_BAR_W = 44;
const HP_BAR_H = 4;
const MP_BAR_W = 44;
const MP_BAR_H = 3;

export class Player {
  readonly container: Phaser.GameObjects.Container;

  private body: Phaser.GameObjects.Rectangle;
  private head: Phaser.GameObjects.Rectangle;
  private shadow: Phaser.GameObjects.Ellipse;
  private nameTag: Phaser.GameObjects.Text;

  private beaBody: Phaser.GameObjects.Rectangle;
  private beaHead: Phaser.GameObjects.Ellipse;

  private hpBarBg: Phaser.GameObjects.Rectangle;
  private hpBarFill: Phaser.GameObjects.Rectangle;
  private mpBarBg: Phaser.GameObjects.Rectangle;
  private mpBarFill: Phaser.GameObjects.Rectangle;

  private scene: Phaser.Scene;
  private inputMgr: InputManager;
  readonly combat: CombatStateMachine;
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
  private pendingAoeHit: AoeHit | null = null;
  private airAttackLanded = false;

  private throwTarget: TrainingDummy | null = null;
  private throwPhase: "grab" | "throw" = "grab";
  private getDummies: (() => TrainingDummy[]) | null = null;
  private boonState: BoonState | null = null;

  hp = ULTIMATE.maxHp;
  mp = ULTIMATE.maxMp;

  private ultPhase: UltimatePhase = "setup";
  private trashCan: Phaser.GameObjects.Rectangle | null = null;
  private ultBlastFired = false;
  pendingUltBlast = false;

  // Dash
  private lastTapRight = 0;
  private lastTapLeft = 0;
  private dashCooldownTimer = 0;
  private dashDir = 1;
  private prevMoveX = 0;
  private dashAttackType: "light" | "heavy" = "light";
  private dashAttackHitFired = false;

  // Knockdown / hitstun
  private hitKnockbackVx = 0;
  private hitKnockbackVy = 0;
  private iFrameFlashTimer = 0;
  private iFrameTimer = 0;
  isDead = false;

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
      fontFamily: "monospace", fontSize: "10px", color: "#5a9bba",
    });
    this.nameTag.setOrigin(0.5);

    const barY = PLAYER.height / 2 + 16;
    this.hpBarBg = scene.add.rectangle(0, barY, HP_BAR_W, HP_BAR_H, COLORS.hpBarBg);
    this.hpBarFill = scene.add.rectangle(0, barY, HP_BAR_W, HP_BAR_H, COLORS.hpBarFill);
    this.mpBarBg = scene.add.rectangle(0, barY + HP_BAR_H + 2, MP_BAR_W, MP_BAR_H, COLORS.hpBarBg);
    this.mpBarFill = scene.add.rectangle(0, barY + HP_BAR_H + 2, MP_BAR_W, MP_BAR_H, COLORS.mpBarFill);

    this.container = scene.add.container(x, y, [
      this.shadow, this.body, this.head,
      this.beaBody, this.beaHead, this.nameTag,
      this.hpBarBg, this.hpBarFill, this.mpBarBg, this.mpBarFill,
    ]);

    this.bodyBaseY = 0;
    this.headBaseY = -PLAYER.height / 2 - 12;
  }

  get x(): number { return this.container.x; }
  get y(): number { return this.container.y; }
  get isAttacking(): boolean { return this.combat.isAttacking; }
  get currentComboId(): string | null { return this.combat.currentNode?.id ?? null; }
  get isAirAttacking(): boolean { return this.combat.isAirAttacking; }
  get isThrowing(): boolean { return this.combat.isThrowing; }
  get isUltimate(): boolean { return this.combat.isUltimate; }

  get currentSpecialName(): string | null {
    if (this.combat.isAirAttacking) return "Elbow Drop";
    if (this.combat.isThrowing) return this.throwPhase === "grab" ? "Grab!" : "Throw!";
    if (this.combat.isUltimate) return "BEA GOES SUPER";
    if (this.combat.isBlocking) return "Blocking";
    if (this.combat.isDashAttacking) return this.dashAttackType === "light" ? "Dash Shot!" : "Dash Punch!";
    if (this.combat.isDashing) return "Dash!";
    if (this.combat.isHitstun) return "HIT!";
    if (this.combat.isKnockdown) return "DOWN!";
    return null;
  }

  get beaWorldX(): number {
    const dir = this.facingRight ? 1 : -1;
    return this.container.x + dir * 10;
  }
  get beaWorldY(): number {
    return this.container.y - PLAYER.height / 2 - 28 + this.jumpOffset;
  }

  setDummyProvider(fn: () => TrainingDummy[]): void { this.getDummies = fn; }
  setBoonState(bs: BoonState): void { this.boonState = bs; }

  private stat(name: string, base: number): number {
    return this.boonState ? this.boonState.getStat(name, base) : base;
  }

  drainProjectileRequests(): ProjectileSpawnRequest[] {
    const reqs = this.pendingProjectiles;
    this.pendingProjectiles = [];
    return reqs;
  }

  drainAoeHit(): AoeHit | null {
    const hit = this.pendingAoeHit;
    this.pendingAoeHit = null;
    return hit;
  }

  resetForRun(): void {
    this.hp = this.stat("maxHp", ULTIMATE.maxHp);
    this.mp = this.stat("maxMp", ULTIMATE.maxMp);
    this.isDead = false;
    this.combat.toIdle();
    this.jumpOffset = 0;
    this.jumpVelocity = 0;
    this.rushTimer = 0;
    this.hitKnockbackVx = 0;
    this.hitKnockbackVy = 0;
    this.iFrameTimer = 0;
    this.iFrameFlashTimer = 0;
    this.container.setAlpha(1);
    this.container.scaleY = 1;
    this.resetPose();
  }

  update(dt: number): void {
    if (this.isDead) return;

    this.combat.update(dt);
    this.regenMp(dt);
    if (this.dashCooldownTimer > 0) this.dashCooldownTimer -= dt;

    if (this.iFrameTimer > 0) {
      this.iFrameTimer -= dt;
      this.iFrameFlashTimer += dt;
      const flash = Math.sin(this.iFrameFlashTimer * 25) > 0;
      this.container.setAlpha(flash ? 1 : 0.3);
      if (this.iFrameTimer <= 0) {
        this.iFrameTimer = 0;
        this.iFrameFlashTimer = 0;
        this.container.setAlpha(1);
      }
    }

    if (this.combat.inHitstop) {
      this.applyHitstopVisual();
      this.updateResourceBars();
      return;
    }

    if (this.combat.isDead) return;

    if (this.combat.isRecovering) {
      this.handleRecovery(dt);
      this.applyVisualState();
      this.handleMovement(dt);
      this.updateResourceBars();
      this.clampToBounds();
      this.container.setDepth(this.container.y);
      return;
    }

    if (this.combat.isKnockdown) {
      this.handleKnockdown(dt);
      this.updateResourceBars();
      this.clampToBounds();
      this.container.setDepth(this.container.y);
      return;
    }

    if (this.combat.isHitstun) {
      this.handleHitstun(dt);
      this.updateResourceBars();
      this.clampToBounds();
      this.container.setDepth(this.container.y);
      return;
    }

    if (this.combat.isUltimate) {
      this.handleUltimateSequence();
      this.updateResourceBars();
      return;
    }

    if (this.combat.isThrowing) {
      this.handleThrowSequence();
      this.applyVisualState();
      this.updateResourceBars();
      this.container.setDepth(this.container.y);
      return;
    }

    if (this.combat.isDashing) {
      this.handleDash(dt);
      this.applyVisualState();
      this.updateResourceBars();
      this.clampToBounds();
      this.container.setDepth(this.container.y);
      return;
    }

    if (this.combat.isDashAttacking) {
      this.handleDashAttack(dt);
      this.applyVisualState();
      this.updateResourceBars();
      this.clampToBounds();
      this.container.setDepth(this.container.y);
      return;
    }

    this.handleInput();
    this.handleJump(dt);
    this.handleAirAttack(dt);
    this.handleRush(dt);
    this.handleAttackProgress(dt);
    this.handleMovement(dt);
    this.applyVisualState();
    this.updateResourceBars();
    this.clampToBounds();
    this.container.setDepth(this.container.y);
  }

  // ── Input ──

  private handleInput(): void {
    if (this.inputMgr.bothDown(Action.DODGE, Action.SPECIAL)) {
      this.onUltimateInput();
      return;
    }

    if (this.combat.isBlocking) {
      if (!this.inputMgr.isDown(Action.THROW)) {
        this.combat.toIdle();
      }
      return;
    }

    if (this.inputMgr.justPressed(Action.THROW)) {
      this.onThrowInput();
      return;
    }

    if (this.inputMgr.isDown(Action.THROW) && !this.combat.isBusy) {
      this.combat.enterBlocking();
      return;
    }

    if (this.combat.isJumping || this.combat.isAirAttacking) {
      if (this.inputMgr.justPressed(Action.ATTACK) || this.inputMgr.justPressed(Action.HEAVY)) {
        if (this.combat.isJumping) {
          this.onAirAttackInput();
        }
        return;
      }
    } else {
      if (this.inputMgr.justPressed(Action.ATTACK)) {
        this.onComboInput("L");
      } else if (this.inputMgr.justPressed(Action.HEAVY)) {
        this.onComboInput("H");
      }
    }

    if (this.inputMgr.justPressed(Action.JUMP)) {
      this.onJumpInput();
    }
  }

  private onComboInput(input: "L" | "H"): void {
    if (this.combat.isJumping || this.combat.isAirAttacking) return;
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

  private onAirAttackInput(): void {
    this.combat.enterAirAttack();
    this.airAttackLanded = false;
    this.jumpVelocity = AIR_ATTACK.dropSpeed;
  }

  // ── Dash ──

  checkDoubleTapDash(move: { x: number; y: number }): void {
    if (this.combat.isBusy || this.dashCooldownTimer > 0) return;

    const threshold = 0.7;
    const now = this.scene.time.now / 1000;

    const rightFlick = (move.x > threshold && this.prevMoveX <= threshold)
      || this.inputMgr.justPressed(Action.RIGHT);
    const leftFlick = (move.x < -threshold && this.prevMoveX >= -threshold)
      || this.inputMgr.justPressed(Action.LEFT);

    this.prevMoveX = move.x;

    if (rightFlick) {
      if (now - this.lastTapRight < DASH.doubleTapWindow && this.lastTapRight > 0) {
        this.startDash(1);
        this.lastTapRight = 0;
        return;
      }
      this.lastTapRight = now;
    }
    if (leftFlick) {
      if (now - this.lastTapLeft < DASH.doubleTapWindow && this.lastTapLeft > 0) {
        this.startDash(-1);
        this.lastTapLeft = 0;
        return;
      }
      this.lastTapLeft = now;
    }
  }

  private startDash(dir: number): void {
    this.dashDir = dir;
    this.facingRight = dir > 0;
    this.combat.enterDashing();
    this.dashCooldownTimer = DASH.duration + DASH.cooldown;
  }

  private handleDash(dt: number): void {
    this.container.x += this.dashDir * DASH.speed * dt;

    if (this.combat.stateTimer > 0.05) {
      this.spawnAfterimage();
    }

    if (this.inputMgr.justPressed(Action.ATTACK)) {
      this.startDashAttack("light");
      return;
    }
    if (this.inputMgr.justPressed(Action.HEAVY)) {
      this.startDashAttack("heavy");
      return;
    }

    if (this.combat.stateTimer >= DASH.duration) {
      this.combat.toIdle();
    }
  }

  private startDashAttack(type: "light" | "heavy"): void {
    this.dashAttackType = type;
    this.dashAttackHitFired = false;
    this.combat.enterDashAttack();

    if (type === "light") {
      this.hitFeel.swingArc(this.beaWorldX, this.beaWorldY, this.facingRight, false);
    } else {
      this.hitFeel.swingArc(this.container.x, this.container.y, this.facingRight, true);
    }
  }

  private handleDashAttack(dt: number): void {
    const momentum = Math.max(0, 1 - this.combat.stateTimer / DASH.attackDuration);
    this.container.x += this.dashDir * DASH.speed * 0.5 * momentum * dt;

    const hitFrame = this.dashAttackType === "light" ? 0.08 : 0.12;
    if (this.combat.stateTimer >= hitFrame && !this.dashAttackHitFired) {
      this.dashAttackHitFired = true;
      if (this.dashAttackType === "light") {
        if (this.mp >= DASH.lightMpCost) {
          this.mp -= DASH.lightMpCost;
          this.pendingProjectiles.push({
            x: this.beaWorldX + (this.facingRight ? 25 : -25),
            y: this.beaWorldY,
            facingRight: this.facingRight,
            config: {
              radius: 12, speed: 600, color: 0x88ccff, maxRange: 350,
              damage: DASH.lightDamage, knockback: DASH.lightKnockback,
              hitstopMs: DASH.lightHitstopMs,
              shakeIntensity: DASH.lightShakeIntensity, shakeDuration: DASH.lightShakeDuration,
            },
          });
        } else {
          this.onDryFire();
        }
      }
    }

    if (this.combat.stateTimer >= DASH.attackDuration) {
      this.combat.toIdle();
    }
  }

  getDashAttackHitBox(): MeleeHitBox | null {
    if (!this.combat.isDashAttacking) return null;
    if (this.dashAttackType !== "heavy") return null;
    if (this.combat.hasHitThisSwing) return null;

    const hitFrame = 0.12;
    if (this.combat.stateTimer < hitFrame) return null;

    const dir = this.facingRight ? 1 : -1;
    return {
      x: this.container.x + dir * DASH.attackHitRange,
      y: this.container.y,
      range: DASH.attackHitRange,
      depthRange: DASH.attackDepthRange,
      damage: DASH.heavyDamage,
      knockback: DASH.heavyKnockback,
      hitstopMs: DASH.heavyHitstopMs,
      shakeIntensity: DASH.heavyShakeIntensity,
      shakeDuration: DASH.heavyShakeDuration,
      isRush: false,
    };
  }

  private spawnAfterimage(): void {
    const ghost = this.scene.add.rectangle(
      this.container.x, this.container.y,
      PLAYER.width, PLAYER.height, COLORS.andrewFill, 0.3
    );
    ghost.setDepth(this.container.y - 1);
    this.scene.tweens.add({
      targets: ghost,
      alpha: 0, duration: 200,
      onComplete: () => ghost.destroy(),
    });
  }

  // ── Player takes damage ──

  takeHit(damage: number, knockbackX: number, _knockbackY: number): void {
    if (!this.combat.isVulnerable || this.isDead || this.iFrameTimer > 0) return;

    let actualDamage = damage;
    if (this.combat.isBlocking) {
      actualDamage = Math.floor(damage * (1 - PLAYER_HIT.blockDamageReduction));
      this.hitFeel.shake(2, 50);
      this.combat.toIdle();
    }

    this.hp -= actualDamage;
    if (this.hp <= 0) {
      this.hp = 0;
      this.onDeath();
      return;
    }

    const dir = knockbackX >= 0 ? 1 : -1;
    this.hitKnockbackVx = dir * PLAYER_HIT.hitKnockbackStep;
    this.hitKnockbackVy = _knockbackY * 0.3;
    this.hitFeel.shake(3, 60);

    this.combat.enterHitstun();
    this.iFrameTimer = PLAYER_HIT.iFrameDuration;
  }

  private handleHitstun(dt: number): void {
    this.applyKnockback(dt);

    const shake = (Math.random() - 0.5) * 4;
    this.body.x = shake;
    this.head.x = shake;
    this.body.y = this.bodyBaseY;
    this.head.y = this.headBaseY;

    if (this.combat.stateTimer >= PLAYER_HIT.hitstunDuration) {
      this.combat.toIdle();
      this.resetPose();
    }
  }

  private handleKnockdown(dt: number): void {
    this.applyKnockback(dt);
    const totalDown = PLAYER_HIT.knockdownDuration + PLAYER_HIT.knockdownLieDuration;
    const t = this.combat.stateTimer;

    if (t < PLAYER_HIT.knockdownDuration) {
      const p = t / PLAYER_HIT.knockdownDuration;
      this.body.y = this.bodyBaseY + p * 30;
      this.body.scaleY = 1 - p * 0.6;
      this.body.scaleX = 1 + p * 0.3;
      this.head.y = this.headBaseY + p * 35;
      this.head.scaleY = 1 - p * 0.4;
      if (this.beaVisible) {
        this.beaBody.y = -PLAYER.height / 2 - 28 + p * 40;
        this.beaHead.y = -PLAYER.height / 2 - 46 + p * 45;
      }
    } else {
      this.body.y = this.bodyBaseY + 30;
      this.body.scaleY = 0.4;
      this.body.scaleX = 1.3;
      this.head.y = this.headBaseY + 35;
      this.head.scaleY = 0.6;
    }

    if (t >= totalDown) {
      this.combat.enterRecovering();
      this.iFrameFlashTimer = 0;
    }
  }

  private handleRecovery(dt: number): void {
    this.iFrameFlashTimer += dt;
    const flash = Math.sin(this.iFrameFlashTimer * 20) > 0;
    this.container.setAlpha(flash ? 1 : 0.3);

    if (this.combat.stateTimer < 0.2) {
      const p = this.combat.stateTimer / 0.2;
      this.body.scaleY = Phaser.Math.Linear(0.4, 1, p);
      this.body.scaleX = Phaser.Math.Linear(1.3, 1, p);
      this.body.y = Phaser.Math.Linear(this.bodyBaseY + 30, this.bodyBaseY, p);
      this.head.y = Phaser.Math.Linear(this.headBaseY + 35, this.headBaseY, p);
      this.head.scaleY = Phaser.Math.Linear(0.6, 1, p);
      if (this.beaVisible) {
        this.beaBody.y = Phaser.Math.Linear(-PLAYER.height / 2 - 28 + 40, -PLAYER.height / 2 - 28, p);
        this.beaHead.y = Phaser.Math.Linear(-PLAYER.height / 2 - 46 + 45, -PLAYER.height / 2 - 46, p);
      }
    } else {
      this.resetPose();
    }

    if (this.combat.stateTimer >= PLAYER_HIT.recoveryDuration) {
      this.combat.toIdle();
      this.container.setAlpha(1);
      this.resetPose();
    }
  }

  private onDeath(): void {
    this.combat.enterKnockdown();
    this.isDead = true;
  }

  private applyKnockback(dt: number): void {
    this.container.x += this.hitKnockbackVx * dt;
    this.container.y += this.hitKnockbackVy * dt;
    const friction = PLAYER_HIT.knockbackSpeed * 4 * dt;
    if (Math.abs(this.hitKnockbackVx) > friction) {
      this.hitKnockbackVx -= Math.sign(this.hitKnockbackVx) * friction;
    } else {
      this.hitKnockbackVx = 0;
    }
    if (Math.abs(this.hitKnockbackVy) > friction) {
      this.hitKnockbackVy -= Math.sign(this.hitKnockbackVy) * friction;
    } else {
      this.hitKnockbackVy = 0;
    }
  }

  // ── Jump / Air Attack ──

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

  private handleAirAttack(dt: number): void {
    if (!this.combat.isAirAttacking) return;
    this.jumpOffset += this.jumpVelocity * dt;
    if (this.jumpOffset >= 0) {
      this.jumpOffset = 0;
      this.jumpVelocity = 0;
      if (!this.airAttackLanded) {
        this.airAttackLanded = true;
        this.pendingAoeHit = {
          x: this.container.x, y: this.container.y,
          radius: AIR_ATTACK.aoeRadius, depthRange: AIR_ATTACK.aoeDepthRange,
          damage: AIR_ATTACK.damage, knockback: AIR_ATTACK.knockback,
          hitstopMs: AIR_ATTACK.hitstopMs,
          shakeIntensity: AIR_ATTACK.shakeIntensity, shakeDuration: AIR_ATTACK.shakeDuration,
        };
        this.hitFeel.elbowDropImpact(this.container.x, this.container.y);
        this.hitFeel.shake(AIR_ATTACK.shakeIntensity, AIR_ATTACK.shakeDuration);
        this.combat.enterHitstop(AIR_ATTACK.hitstopMs);
        this.scene.time.delayedCall(AIR_ATTACK.hitstopMs + 50, () => {
          if (this.combat.state === "hitstop" || this.combat.isAirAttacking) {
            this.combat.toIdle();
          }
        });
      }
    }
  }

  // ── Throw ──

  private onThrowInput(): void {
    if (this.combat.isBusy) return;
    if (!this.getDummies) return;
    const dummies = this.getDummies();
    let closest: TrainingDummy | null = null;
    let closestDist = Infinity;
    for (const d of dummies) {
      if (!d.isAlive) continue;
      const dx = Math.abs(this.container.x - d.x);
      const dy = Math.abs(this.container.y - d.y);
      if (dx < THROW.grabRange + d.width / 2 && dy < THROW.grabDepthRange) {
        const dist = dx + dy;
        if (dist < closestDist) { closestDist = dist; closest = d; }
      }
    }
    if (!closest) return;
    this.throwTarget = closest;
    this.throwPhase = "grab";
    this.combat.enterThrowing();
  }

  private handleThrowSequence(): void {
    if (!this.throwTarget) { this.combat.toIdle(); return; }
    const t = this.combat.stateTimer;
    if (this.throwPhase === "grab") {
      const progress = Math.min(t / THROW.grabDuration, 1);
      const tx = Phaser.Math.Linear(this.throwTarget.x, this.container.x + (this.facingRight ? 30 : -30), progress);
      const ty = Phaser.Math.Linear(this.throwTarget.y, this.container.y, progress);
      this.throwTarget.setPosition(tx, ty);
      if (t >= THROW.grabDuration) { this.throwPhase = "throw"; this.combat.stateTimer = 0; }
    } else {
      const progress = Math.min(t / THROW.throwDuration, 1);
      if (progress >= 0.5 && this.throwTarget.isAlive) {
        const dir = this.facingRight ? 1 : -1;
        this.throwTarget.takeHit(THROW.damage, dir * THROW.knockback, (Math.random() - 0.5) * 60);
        this.hitFeel.impactFlash(this.throwTarget.x, this.throwTarget.y - this.throwTarget.height / 3);
        this.hitFeel.shake(THROW.shakeIntensity, THROW.shakeDuration);
        this.throwTarget = null;
        this.combat.toIdle();
      }
      if (t >= THROW.throwDuration) { this.throwTarget = null; this.combat.toIdle(); }
    }
  }

  // ── Ultimate ──

  private onUltimateInput(): void {
    if (this.combat.isBusy) return;
    let cost = ULTIMATE.mpCost;
    if (this.mp >= cost) {
      this.mp -= cost;
    } else {
      const mpPart = this.mp;
      this.mp = 0;
      this.hp = Math.max(0, this.hp - (cost - mpPart));
    }
    this.ultPhase = "setup";
    this.ultBlastFired = false;
    this.pendingUltBlast = false;
    this.combat.enterUltimate();
  }

  private handleUltimateSequence(): void {
    const t = this.combat.stateTimer;
    const S = ULTIMATE;
    if (this.ultPhase === "setup" && t >= S.setupDuration) this.ultPhase = "charge";
    if (this.ultPhase === "charge" && t >= S.setupDuration + S.chargeDuration) this.ultPhase = "blast";
    if (this.ultPhase === "blast" && !this.ultBlastFired) {
      this.ultBlastFired = true;
      this.pendingUltBlast = true;
      this.hitFeel.ultimateBlast(this.container.x, this.container.y);
      this.hitFeel.shake(S.blastShakeIntensity, S.blastShakeDuration);
    }
    if (this.ultPhase === "blast" && t >= S.setupDuration + S.chargeDuration + S.blastDuration) this.ultPhase = "recovery";
    const totalDuration = S.setupDuration + S.chargeDuration + S.blastDuration + S.recoveryDuration;
    if (t >= totalDuration) { this.endUltimate(); return; }
    this.applyUltimateVisual();
  }

  private applyUltimateVisual(): void {
    const jOff = this.jumpOffset;
    if (this.ultPhase === "setup") {
      const p = Math.min(this.combat.stateTimer / ULTIMATE.setupDuration, 1);
      this.beaBody.y = Phaser.Math.Linear(-PLAYER.height / 2 - 28, PLAYER.height / 2 - 20, p) + jOff;
      this.beaHead.y = Phaser.Math.Linear(-PLAYER.height / 2 - 46, PLAYER.height / 2 - 38, p) + jOff;
      const dir = this.facingRight ? 1 : -1;
      this.beaBody.x = dir * p * 30; this.beaHead.x = dir * p * 30;
      this.body.x = -dir * p * 15; this.head.x = -dir * p * 15;
      this.head.y = this.headBaseY + p * 10 + jOff; this.body.y = this.bodyBaseY + jOff;
      if (p > 0.5 && !this.trashCan) {
        this.trashCan = this.scene.add.rectangle(
          this.container.x - dir * 35, this.container.y + 5, 30, 45, COLORS.trashCanFill
        );
        this.trashCan.setStrokeStyle(2, COLORS.trashCanOutline);
        this.trashCan.setDepth(this.container.y - 1);
      }
    }
    if (this.ultPhase === "charge") {
      const dir = this.facingRight ? 1 : -1;
      this.beaBody.x = dir * 30; this.beaHead.x = dir * 30;
      this.beaBody.y = PLAYER.height / 2 - 20 + jOff; this.beaHead.y = PLAYER.height / 2 - 38 + jOff;
      const pulse = Math.sin(this.combat.stateTimer * 20) * 0.15;
      this.beaBody.setScale(1 + pulse); this.beaHead.setScale(1 + pulse);
      const glowColor = Math.random() > 0.5 ? COLORS.ultimateGlow : 0xffffff;
      this.beaBody.setFillStyle(glowColor); this.beaHead.setFillStyle(glowColor);
      this.body.x = -dir * 15; this.head.x = -dir * 15;
      this.head.y = this.headBaseY + 15 + jOff; this.body.scaleY = 0.9;
    }
    if (this.ultPhase === "blast") {
      const dir = this.facingRight ? 1 : -1;
      this.beaBody.setFillStyle(0xffffff); this.beaHead.setFillStyle(0xffffff);
      this.beaBody.setScale(1.3); this.beaHead.setScale(1.3);
      this.beaBody.x = dir * 30; this.beaHead.x = dir * 30;
      this.body.x = -dir * 20; this.head.x = -dir * 20;
    }
    if (this.ultPhase === "recovery") {
      const recStart = ULTIMATE.setupDuration + ULTIMATE.chargeDuration + ULTIMATE.blastDuration;
      const p = Math.min((this.combat.stateTimer - recStart) / ULTIMATE.recoveryDuration, 1);
      this.beaBody.setFillStyle(COLORS.beaFill); this.beaHead.setFillStyle(COLORS.beaFill);
      this.beaBody.setScale(1); this.beaHead.setScale(1);
      const dir = this.facingRight ? 1 : -1;
      this.beaBody.x = Phaser.Math.Linear(dir * 30, 0, p);
      this.beaHead.x = Phaser.Math.Linear(dir * 30, 0, p);
      this.beaBody.y = Phaser.Math.Linear(PLAYER.height / 2 - 20, -PLAYER.height / 2 - 28, p) + jOff;
      this.beaHead.y = Phaser.Math.Linear(PLAYER.height / 2 - 38, -PLAYER.height / 2 - 46, p) + jOff;
      this.body.x = Phaser.Math.Linear(-dir * 20, 0, p);
      this.head.x = Phaser.Math.Linear(-dir * 20, 0, p);
      this.head.y = Phaser.Math.Linear(this.headBaseY + 15, this.headBaseY, p) + jOff;
      this.body.y = this.bodyBaseY + jOff;
      this.body.scaleY = Phaser.Math.Linear(0.9, 1, p);
      if (this.trashCan) {
        this.trashCan.setAlpha(1 - p);
        if (p >= 1) { this.trashCan.destroy(); this.trashCan = null; }
      }
    }
  }

  private endUltimate(): void {
    this.beaBody.setFillStyle(COLORS.beaFill); this.beaHead.setFillStyle(COLORS.beaFill);
    this.beaBody.setScale(1); this.beaHead.setScale(1);
    this.body.scaleY = 1;
    if (this.trashCan) { this.trashCan.destroy(); this.trashCan = null; }
    this.resetPose();
    this.combat.toIdle();
  }

  // ── MP ──

  private regenMp(dt: number): void {
    const maxMp = this.stat("maxMp", ULTIMATE.maxMp);
    const mpRegen = this.stat("mpRegen", ULTIMATE.mpRegen);
    if (this.mp < maxMp) {
      this.mp = Math.min(maxMp, this.mp + mpRegen * dt);
    }
  }

  private updateResourceBars(): void {
    const hpRatio = this.hp / this.stat("maxHp", ULTIMATE.maxHp);
    this.hpBarFill.scaleX = hpRatio;
    this.hpBarFill.x = -(HP_BAR_W * (1 - hpRatio)) / 2;
    const mpRatio = this.mp / this.stat("maxMp", ULTIMATE.maxMp);
    this.mpBarFill.scaleX = mpRatio;
    this.mpBarFill.x = -(MP_BAR_W * (1 - mpRatio)) / 2;
  }

  // ── Rush ──

  private handleRush(dt: number): void {
    if (this.rushTimer <= 0) return;
    this.rushTimer -= dt;
    const dir = this.facingRight ? 1 : -1;
    this.container.x += dir * this.rushSpeed * dt;
  }

  // ── Attack progress (combo trie) ──

  private hitFrameProcessed = false;

  private handleAttackProgress(_dt: number): void {
    const s = this.combat;
    if (!s.isAttacking) return;
    const node = s.currentNode;
    if (!node) return;
    if (s.stateTimer >= node.hitFrame && !this.hitFrameProcessed) {
      this.hitFrameProcessed = true;
      if (node.moveType !== "melee") s.hasHitThisSwing = true;
      this.onHitFrame(node);
    }
    if (s.stateTimer >= node.duration) this.onAttackEnd();
  }

  getHitBox(): MeleeHitBox | null {
    const s = this.combat;
    if (!s.isAttacking) return null;
    const node = s.currentNode;
    if (!node) return null;
    if (node.moveType === "rush") {
      if (this.rushTimer <= 0) return null;
      const dir = this.facingRight ? 1 : -1;
      return {
        x: this.container.x + dir * COMBAT.meleeHitRange, y: this.container.y,
        range: COMBAT.meleeHitRange + 20, depthRange: COMBAT.meleeHitDepthRange,
        damage: node.damage, knockback: node.knockback, hitstopMs: node.hitstopMs,
        shakeIntensity: node.shakeIntensity, shakeDuration: node.shakeDuration, isRush: true,
      };
    }
    if (node.moveType !== "melee") return null;
    if (s.hasHitThisSwing) return null;
    if (s.stateTimer < node.hitFrame) return null;
    const dir = this.facingRight ? 1 : -1;
    return {
      x: this.container.x + dir * COMBAT.meleeHitRange, y: this.container.y,
      range: COMBAT.meleeHitRange, depthRange: COMBAT.meleeHitDepthRange,
      damage: node.damage, knockback: node.knockback, hitstopMs: node.hitstopMs,
      shakeIntensity: node.shakeIntensity, shakeDuration: node.shakeDuration, isRush: false,
    };
  }

  markHitConnected(): void { this.combat.hasHitThisSwing = true; }
  enterMeleeHitstop(durationMs: number): void { this.combat.enterHitstop(durationMs); }

  private onNodeEntered(node: ComboNode): void {
    this.hitFrameProcessed = false;
    this.fireSwingVFX(node);
    if (node.moveType === "rush" && node.rush) {
      this.rushTimer = node.rush.duration;
      this.rushSpeed = node.rush.speed;
      this.hitFeel.shake(node.shakeIntensity, node.shakeDuration);
    }
    this.applyAttackStep(node);
  }

  private applyAttackStep(node: ComboNode): void {
    if (node.moveType === "rush") return;
    const dir = this.facingRight ? 1 : -1;
    if (node.input === "H") {
      this.scene.tweens.add({
        targets: this.container,
        x: this.container.x + dir * COMBAT.heavyStepDistance,
        duration: COMBAT.heavyStepDuration,
        ease: "Power2",
      });
    } else {
      this.scene.tweens.add({
        targets: this.container,
        x: this.container.x - dir * COMBAT.lightStepBackDistance,
        duration: COMBAT.lightStepBackDuration,
        ease: "Sine.easeOut",
      });
    }
  }

  private onHitFrame(node: ComboNode): void {
    const cost = node.mpCost ?? 0;
    const canAfford = this.mp >= cost;

    if (node.moveType === "projectile" && node.projectile) {
      if (canAfford) { this.mp -= cost; this.spawnProjectile(node); }
      else { this.onDryFire(); }
    } else if (node.moveType === "burst" && node.projectile) {
      if (canAfford) { this.mp -= cost; this.spawnBurst(node); }
      else { this.onDryFire(); }
    } else if (node.moveType === "toss") {
      this.startBeaToss(node);
    }

    if (node.moveType !== "melee") this.hitFeel.shake(node.shakeIntensity, node.shakeDuration);
    if (node.moveType === "rush") this.combat.enterHitstop(node.hitstopMs);
  }

  private onDryFire(): void {
    this.hitFeel.shake(1, 20);
    const puff = this.scene.add.circle(
      this.beaWorldX + (this.facingRight ? 15 : -15), this.beaWorldY,
      6, 0x888888, 0.5,
    );
    puff.setDepth(this.container.y + 2);
    this.scene.tweens.add({
      targets: puff, alpha: 0, scaleX: 2, scaleY: 2,
      duration: 200, onComplete: () => puff.destroy(),
    });
  }

  private spawnProjectile(node: ComboNode): void {
    if (!node.projectile) return;
    this.pendingProjectiles.push({
      x: this.beaWorldX + (this.facingRight ? 20 : -20), y: this.beaWorldY,
      facingRight: this.facingRight,
      config: { ...node.projectile, damage: node.damage, knockback: node.knockback, hitstopMs: node.hitstopMs, shakeIntensity: node.shakeIntensity, shakeDuration: node.shakeDuration },
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
          config: { ...node.projectile!, damage: node.damage, knockback: node.knockback, hitstopMs: node.hitstopMs, shakeIntensity: node.shakeIntensity, shakeDuration: node.shakeDuration },
        });
      });
    }
  }

  private startBeaToss(node: ComboNode): void {
    this.setBeaVisible(false);
    this.pendingProjectiles.push({
      x: this.beaWorldX, y: this.beaWorldY, facingRight: this.facingRight,
      config: { radius: 12, speed: 550, color: COLORS.beaFill, maxRange: 300, damage: node.damage, knockback: node.knockback, hitstopMs: node.hitstopMs, shakeIntensity: node.shakeIntensity, shakeDuration: node.shakeDuration },
    });
    this.scene.time.delayedCall(500, () => this.setBeaVisible(true));
  }

  private setBeaVisible(visible: boolean): void {
    this.beaVisible = visible;
    this.beaBody.setAlpha(visible ? 1 : 0);
    this.beaHead.setAlpha(visible ? 1 : 0);
  }

  private onAttackEnd(): void {
    const next = this.combat.advanceCombo();
    if (next) { this.onNodeEntered(next); return; }
    this.combat.toIdle();
    this.rushTimer = 0;
  }

  private fireSwingVFX(node: ComboNode): void {
    const v = node.visual;
    const isHeavy = v === "andrew-punch" || v === "andrew-slam" || v === "andrew-rush" || v === "andrew-uppercut";
    if (isHeavy) this.hitFeel.swingArc(this.container.x, this.container.y, this.facingRight, true);
    else this.hitFeel.swingArc(this.beaWorldX, this.beaWorldY, this.facingRight, false);
  }

  // ── Movement ──

  private handleMovement(dt: number): void {
    if (this.combat.isAttacking) return;
    const move = this.inputMgr.getMovement();

    this.checkDoubleTapDash(move);
    if (this.combat.isDashing) return;

    const baseSpd = this.stat("speed", PLAYER.speed);
    const speedMul = this.boonState ? this.boonState.speedBurstMultiplier : 1;
    const spd = baseSpd * speedMul;
    const depthSpd = PLAYER.depthSpeed * (spd / PLAYER.speed) * speedMul;

    if (this.combat.isBlocking) {
      const bm = COMBAT.blockSpeedMultiplier;
      this.container.x += move.x * spd * bm * dt;
      this.container.y += move.y * depthSpd * bm * dt;
    } else if (this.combat.isJumping || this.combat.isAirAttacking) {
      this.container.x += move.x * spd * 0.6 * dt;
      this.container.y += move.y * depthSpd * 0.6 * dt;
    } else if (this.combat.isRecovering) {
      this.container.x += move.x * spd * 0.5 * dt;
      this.container.y += move.y * depthSpd * 0.5 * dt;
    } else {
      this.container.x += move.x * spd * dt;
      this.container.y += move.y * depthSpd * dt;
      if (Math.abs(move.x) > 0.1 || Math.abs(move.y) > 0.1) this.combat.toWalk();
      else if (this.combat.state === "walk") this.combat.toIdle();
    }

    if (!this.combat.isBlocking) {
      if (move.x > 0.1) this.facingRight = true;
      if (move.x < -0.1) this.facingRight = false;
    }
    this.container.scaleX = this.facingRight ? 1 : -1;
  }

  // ── Visuals ──

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

    if (s.isAirAttacking) this.applyAirAttackPose();
    else if (s.isThrowing) this.applyThrowPose();
    else if (s.isBlocking) this.applyBlockPose();
    else if (s.isDashAttacking) this.applyDashAttackPose();
    else if (s.isDashing) this.applyDashPose();
    else if (s.isAttacking && s.currentNode) this.applyAttackPose(s.stateTimer / s.currentNode.duration, s.currentNode.visual);
    else this.resetPose();
  }

  private applyAirAttackPose(): void {
    const jOff = this.jumpOffset;
    this.body.y = this.bodyBaseY + jOff; this.body.scaleX = 1.2; this.body.scaleY = 0.8;
    this.head.y = this.headBaseY + 5 + jOff; this.head.x = 0;
    if (this.beaVisible) {
      this.beaBody.x = 0; this.beaHead.x = 0;
      this.beaBody.y = this.bodyBaseY - 10 + jOff;
      this.beaHead.y = this.bodyBaseY - 26 + jOff;
    }
  }

  private applyThrowPose(): void {
    const jOff = this.jumpOffset;
    if (this.throwPhase === "grab") {
      const p = Math.min(this.combat.stateTimer / THROW.grabDuration, 1);
      this.body.scaleX = 1 + p * 0.1;
      this.body.y = this.bodyBaseY + jOff; this.head.y = this.headBaseY + jOff;
    } else {
      const p = Math.min(this.combat.stateTimer / THROW.throwDuration, 1);
      const swing = Math.sin(p * Math.PI);
      this.body.scaleX = 1 + swing * 0.15; this.body.scaleY = 1 - swing * 0.1;
      this.head.x = swing * 10;
      this.body.y = this.bodyBaseY + jOff; this.head.y = this.headBaseY + jOff;
    }
  }

  private applyBlockPose(): void {
    const jOff = this.jumpOffset;
    this.body.y = this.bodyBaseY + 6 + jOff; this.body.scaleX = 1.15; this.body.scaleY = 0.88;
    this.head.y = this.headBaseY + 8 + jOff; this.head.x = 0;
    if (this.beaVisible) {
      this.beaBody.y = -PLAYER.height / 2 - 22 + jOff;
      this.beaHead.y = -PLAYER.height / 2 - 38 + jOff;
      this.beaBody.x = 0; this.beaHead.x = 0;
    }
  }

  private applyDashPose(): void {
    this.body.scaleX = 1.3; this.body.scaleY = 0.85;
    this.head.x = this.dashDir * 6;
  }

  private applyDashAttackPose(): void {
    const p = Math.min(this.combat.stateTimer / DASH.attackDuration, 1);
    const swing = Math.sin(p * Math.PI);
    if (this.dashAttackType === "heavy") {
      this.body.scaleX = 1.2 + swing * 0.15;
      this.body.scaleY = 1 - swing * 0.15;
      this.head.x = this.dashDir * swing * 12;
      this.head.y = this.headBaseY - swing * 4;
    } else {
      const beaLean = swing * 18;
      this.beaBody.x = beaLean * 0.7;
      this.beaHead.x = beaLean * 0.9;
      this.beaBody.rotation = swing * 0.25;
      this.beaHead.rotation = swing * 0.2;
      this.body.scaleX = 1.1;
    }
  }

  private applyAttackPose(progress: number, visual: VisualPose): void {
    const jOff = this.jumpOffset;
    const swing = Math.sin(progress * Math.PI);
    switch (visual) {
      case "andrew-punch": {
        const lunge = swing * 12;
        this.body.scaleX = 1 + swing * 0.12; this.body.scaleY = 1 - swing * 0.15;
        this.head.x = lunge * 0.5; this.head.y = this.headBaseY - lunge * 0.3 + jOff;
        break;
      }
      case "andrew-slam": {
        const rise = progress < 0.5 ? swing * 16 : 0;
        const slam = progress >= 0.5 ? (progress - 0.5) * 2 : 0;
        this.body.scaleY = 1 - slam * 0.25; this.body.scaleX = 1 + slam * 0.15;
        this.head.y = this.headBaseY - rise + jOff; this.body.y = this.bodyBaseY + slam * 6 + jOff;
        break;
      }
      case "andrew-rush": {
        this.body.scaleX = 1 + swing * 0.18; this.body.scaleY = 1 - swing * 0.1;
        this.head.x = swing * 8; this.head.y = this.headBaseY + swing * 3 + jOff;
        break;
      }
      case "andrew-uppercut": {
        const rise = swing * 10;
        this.body.y = this.bodyBaseY - rise + jOff; this.head.y = this.headBaseY - rise * 1.4 + jOff;
        this.head.x = swing * 4;
        break;
      }
      case "bea-cast": {
        const beaLean = swing * 14;
        this.beaBody.x = beaLean * 0.6; this.beaHead.x = beaLean * 0.8;
        this.beaBody.rotation = swing * 0.2; this.beaHead.rotation = swing * 0.15;
        this.body.scaleY = 1 - swing * 0.04;
        break;
      }
      case "bea-big-cast": {
        const beaLean = swing * 18;
        this.beaBody.x = beaLean * 0.4; this.beaHead.x = beaLean * 0.6;
        this.beaBody.y = -PLAYER.height / 2 - 28 - swing * 6 + jOff;
        this.beaHead.y = -PLAYER.height / 2 - 46 - swing * 8 + jOff;
        this.beaBody.rotation = swing * 0.25; this.beaHead.rotation = swing * 0.2;
        this.body.scaleY = 1 - swing * 0.06;
        break;
      }
      case "bea-burst": {
        const bob = Math.sin(progress * Math.PI * 6) * 3;
        this.beaBody.x = swing * 10; this.beaHead.x = swing * 12;
        this.beaHead.y = -PLAYER.height / 2 - 46 + bob + jOff;
        this.beaBody.rotation = swing * 0.15;
        break;
      }
      case "bea-finisher": {
        this.beaBody.x = swing * 6; this.beaHead.x = swing * 8;
        this.beaBody.setAlpha(1 + swing * 0.5); this.beaHead.setAlpha(1 + swing * 0.5);
        this.beaBody.rotation = swing * 0.3; this.beaHead.rotation = swing * 0.25;
        break;
      }
      case "bea-toss": {
        this.body.scaleX = 1 + swing * 0.08; this.head.x = swing * 6;
        break;
      }
    }
  }

  private applyHitstopVisual(): void {
    const shake = (Math.random() - 0.5) * 3;
    this.body.x = shake; this.head.x = shake;
    if (this.beaVisible) { this.beaBody.x = shake; this.beaHead.x = shake; }
  }

  private resetPose(): void {
    this.body.y = this.bodyBaseY + this.jumpOffset;
    this.body.scaleX = 1; this.body.scaleY = 1; this.body.x = 0;
    this.head.y = this.headBaseY + this.jumpOffset; this.head.x = 0;
    this.head.scaleY = 1;
    this.beaBody.x = 0; this.beaHead.x = 0;
    this.beaBody.rotation = 0; this.beaHead.rotation = 0;
    if (this.beaVisible) { this.beaBody.setAlpha(1); this.beaHead.setAlpha(1); }
  }

  private clampToBounds(): void {
    const pad = ARENA.boundaryPadding;
    const halfW = PLAYER.width / 2;
    this.container.x = Phaser.Math.Clamp(this.container.x, pad + halfW, ARENA.width - pad - halfW);
    this.container.y = Phaser.Math.Clamp(this.container.y, ARENA.groundY, ARENA.groundY + ARENA.groundHeight - pad);
  }
}
