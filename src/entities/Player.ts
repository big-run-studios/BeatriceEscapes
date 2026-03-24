import Phaser from "phaser";
import {
  PLAYER, COLORS, ARENA, COMBAT, JUMP, AIR_ATTACK, THROW, ULTIMATE,
  DASH, PLAYER_HIT, ComboNode,
} from "../config/game";
import { InputManager, Action } from "../systems/InputManager";
import { CombatStateMachine } from "../systems/CombatState";
import { HitFeel } from "../systems/HitFeel";
import { BoonState } from "../systems/BoonState";
import { ProjectileConfig } from "./Projectile";
import { TrainingDummy } from "./TrainingDummy";
import { AB_SHEET_KEY, AB_SPRITE_SCALE } from "./AndrewBeaAnims";

export interface ProjectileSpawnRequest {
  x: number; y: number; facingRight: boolean; config: ProjectileConfig;
  isHeavy?: boolean;
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

  private sprite: Phaser.GameObjects.Sprite;
  private shadow: Phaser.GameObjects.Ellipse;
  private nameTag: Phaser.GameObjects.Text;

  private hpBarBg: Phaser.GameObjects.Rectangle;
  private hpBarFill: Phaser.GameObjects.Rectangle;
  private mpBarBg: Phaser.GameObjects.Rectangle;
  private mpBarFill: Phaser.GameObjects.Rectangle;

  private scene: Phaser.Scene;
  private inputMgr: InputManager;
  readonly combat: CombatStateMachine;
  private hitFeel: HitFeel;
  facingRight = true;

  private jumpOffset = 0;
  private jumpVelocity = 0;

  private rushTimer = 0;
  private rushSpeed = 0;

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
  pendingDirectionalUltBlast = 0;
  boundsMinX = ARENA.boundaryPadding + PLAYER.width / 2;
  boundsMaxX = ARENA.width - ARENA.boundaryPadding - PLAYER.width / 2;
  activeStatuses: string[] = [];
  private statusIconText!: Phaser.GameObjects.Text;

  // Dash
  private lastTapRight = 0;
  private lastTapLeft = 0;
  private releasedRight = true;
  private releasedLeft = true;
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

    this.sprite = scene.add.sprite(0, PLAYER.height / 2, AB_SHEET_KEY, 7);
    this.sprite.setOrigin(0.5, 1.0);
    this.sprite.setScale(AB_SPRITE_SCALE);

    this.nameTag = scene.add.text(0, 0, "", { fontSize: "1px" });
    this.nameTag.setAlpha(0);

    const barY = PLAYER.height / 2 + 16;
    this.hpBarBg = scene.add.rectangle(0, barY, HP_BAR_W, HP_BAR_H, COLORS.hpBarBg);
    this.hpBarFill = scene.add.rectangle(0, barY, HP_BAR_W, HP_BAR_H, COLORS.hpBarFill);
    this.mpBarBg = scene.add.rectangle(0, barY + HP_BAR_H + 2, MP_BAR_W, MP_BAR_H, COLORS.hpBarBg);
    this.mpBarFill = scene.add.rectangle(0, barY + HP_BAR_H + 2, MP_BAR_W, MP_BAR_H, COLORS.mpBarFill);
    this.statusIconText = scene.add.text(HP_BAR_W / 2 + 3, barY - 4, "", {
      fontFamily: "monospace", fontSize: "8px", color: "#cc66ff",
    });

    this.container = scene.add.container(x, y, [
      this.shadow, this.sprite, this.nameTag,
      this.hpBarBg, this.hpBarFill, this.mpBarBg, this.mpBarFill,
      this.statusIconText,
    ]);
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
  private get chestY(): number {
    return this.container.y - PLAYER.height * 0.45 + this.jumpOffset;
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
    this.sprite.clearTint();
    this.resetPose();
  }

  update(dt: number): void {
    if (this.isDead || !this.container?.scene) return;

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

    const tapThreshold = 0.7;
    const releaseThreshold = 0.3;
    const now = this.scene.time.now / 1000;

    if (move.x < releaseThreshold) this.releasedRight = true;
    if (move.x > -releaseThreshold) this.releasedLeft = true;

    const rightTap = this.releasedRight && (
      (move.x > tapThreshold && this.prevMoveX <= tapThreshold)
      || this.inputMgr.justPressed(Action.RIGHT)
    );
    const leftTap = this.releasedLeft && (
      (move.x < -tapThreshold && this.prevMoveX >= -tapThreshold)
      || this.inputMgr.justPressed(Action.LEFT)
    );

    this.prevMoveX = move.x;

    if (rightTap) {
      this.releasedRight = false;
      if (now - this.lastTapRight < DASH.doubleTapWindow && this.lastTapRight > 0) {
        this.startDash(1);
        this.lastTapRight = 0;
        return;
      }
      this.lastTapRight = now;
    }
    if (leftTap) {
      this.releasedLeft = false;
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
            x: this.container.x,
            y: this.chestY,
            facingRight: this.facingRight,
            config: {
              radius: 12, speed: 600, color: 0x88ccff, maxRange: 350,
              damage: DASH.lightDamage, knockback: DASH.lightKnockback,
              hitstopMs: DASH.lightHitstopMs,
              shakeIntensity: DASH.lightShakeIntensity, shakeDuration: DASH.lightShakeDuration,
              trailType: "wind",
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
    const frameIdx = parseInt(this.sprite.frame?.name ?? "0", 10);
    const ghost = this.scene.add.sprite(
      this.container.x,
      this.container.y + PLAYER.height / 2 + this.jumpOffset,
      AB_SHEET_KEY, frameIdx,
    );
    ghost.setOrigin(0.5, 1.0);
    ghost.setScale(AB_SPRITE_SCALE);
    ghost.setFlipX(!this.facingRight);
    ghost.setAlpha(0.3);
    ghost.setTint(0x4488ff);
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
      const baseReduction = PLAYER_HIT.blockDamageReduction;
      const totalReduction = Math.min(0.95, this.stat("blockReduction", baseReduction));
      actualDamage = Math.floor(damage * (1 - totalReduction));
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

    this.sprite.play("ab-hit", true);
    this.sprite.x = (Math.random() - 0.5) * 4;
    this.sprite.y = PLAYER.height / 2;

    if (this.combat.stateTimer >= PLAYER_HIT.hitstunDuration) {
      this.combat.toIdle();
      this.resetPose();
    }
  }

  private handleKnockdown(dt: number): void {
    this.applyKnockback(dt);
    const totalDown = PLAYER_HIT.knockdownDuration + PLAYER_HIT.knockdownLieDuration;
    const t = this.combat.stateTimer;

    this.sprite.play("ab-knockdown", true);
    this.sprite.y = PLAYER.height / 2;

    if (t >= totalDown) {
      this.combat.enterRecovering();
      this.iFrameFlashTimer = 0;
    }
  }

  private handleRecovery(dt: number): void {
    this.iFrameFlashTimer += dt;
    const flash = Math.sin(this.iFrameFlashTimer * 20) > 0;
    this.container.setAlpha(flash ? 1 : 0.3);

    this.sprite.play("ab-recovery", true);
    this.sprite.y = PLAYER.height / 2;

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
    this.sprite.play("ab-cast", true);
    this.sprite.y = PLAYER.height / 2 + this.jumpOffset;

    if (this.ultPhase === "setup") {
      const p = Math.min(this.combat.stateTimer / ULTIMATE.setupDuration, 1);
      const dir = this.facingRight ? 1 : -1;
      this.sprite.x = -dir * p * 10;
      if (p > 0.5 && !this.trashCan) {
        this.trashCan = this.scene.add.rectangle(
          this.container.x - dir * 35, this.container.y + 5, 30, 45, COLORS.trashCanFill
        );
        this.trashCan.setStrokeStyle(2, COLORS.trashCanOutline);
        this.trashCan.setDepth(this.container.y - 1);
      }
    }
    if (this.ultPhase === "charge") {
      const pulse = Math.sin(this.combat.stateTimer * 20) * 0.1;
      this.sprite.setScale(AB_SPRITE_SCALE * (1 + pulse));
      this.sprite.setTint(
        Math.random() > 0.5 ? COLORS.ultimateGlow : 0xffffff
      );
    }
    if (this.ultPhase === "blast") {
      this.sprite.setScale(AB_SPRITE_SCALE * 1.15);
      this.sprite.setTint(0xffffff);
    }
    if (this.ultPhase === "recovery") {
      const recStart = ULTIMATE.setupDuration + ULTIMATE.chargeDuration + ULTIMATE.blastDuration;
      const p = Math.min((this.combat.stateTimer - recStart) / ULTIMATE.recoveryDuration, 1);
      this.sprite.clearTint();
      this.sprite.setScale(AB_SPRITE_SCALE);
      this.sprite.x = Phaser.Math.Linear(this.sprite.x, 0, p);
      if (this.trashCan) {
        this.trashCan.setAlpha(1 - p);
        if (p >= 1) { this.trashCan.destroy(); this.trashCan = null; }
      }
    }
  }

  private endUltimate(): void {
    this.sprite.clearTint();
    this.sprite.setScale(AB_SPRITE_SCALE);
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
    this.statusIconText.setText(this.activeStatuses.join(""));
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
    this.hitFeel.vfx.flashBurst(
      this.beaWorldX + (this.facingRight ? 15 : -15),
      this.beaWorldY, 0x888888, 2,
    );
  }

  private spawnProjectile(node: ComboNode): void {
    if (!node.projectile) return;
    this.pendingProjectiles.push({
      x: this.container.x, y: this.chestY,
      facingRight: this.facingRight,
      isHeavy: node.input === "H" || node.damage >= 20,
      config: { ...node.projectile, damage: node.damage, knockback: node.knockback, hitstopMs: node.hitstopMs, shakeIntensity: node.shakeIntensity, shakeDuration: node.shakeDuration },
    });
  }

  private spawnBurst(node: ComboNode): void {
    if (!node.projectile) return;
    const heavy = node.input === "H" || node.damage >= 20;
    const count = node.burstCount ?? 3;
    for (let i = 0; i < count; i++) {
      this.scene.time.delayedCall(i * 60, () => {
        this.pendingProjectiles.push({
          x: this.container.x,
          y: this.chestY + (i - 1) * 8,
          facingRight: this.facingRight,
          isHeavy: heavy,
          config: { ...node.projectile!, damage: node.damage, knockback: node.knockback, hitstopMs: node.hitstopMs, shakeIntensity: node.shakeIntensity, shakeDuration: node.shakeDuration },
        });
      });
    }
  }

  private startBeaToss(node: ComboNode): void {
    this.setBeaVisible(false);
    this.pendingProjectiles.push({
      x: this.beaWorldX, y: this.beaWorldY, facingRight: this.facingRight,
      isHeavy: node.input === "H" || node.damage >= 20,
      config: { radius: 12, speed: 550, color: COLORS.beaFill, maxRange: 300, damage: node.damage, knockback: node.knockback, hitstopMs: node.hitstopMs, shakeIntensity: node.shakeIntensity, shakeDuration: node.shakeDuration, trailType: "bea" as const },
    });
    this.scene.time.delayedCall(500, () => this.setBeaVisible(true));
  }

  private setBeaVisible(_visible: boolean): void {
    // Bea is baked into sprite frames; visibility toggle is a no-op
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
    this.sprite.y = PLAYER.height / 2 + this.jumpOffset;
    this.shadow.scaleX = 1 - Math.abs(this.jumpOffset) / 300;
    this.shadow.scaleY = 1 - Math.abs(this.jumpOffset) / 300;
    this.nameTag.y = -PLAYER.height / 2 - 62 + this.jumpOffset;

    if (s.isAirAttacking) {
      this.sprite.play("ab-punch", true);
    } else if (s.isThrowing) {
      this.sprite.play("ab-punch", true);
    } else if (s.isBlocking) {
      this.sprite.play("ab-idle", true);
      this.sprite.setScale(AB_SPRITE_SCALE * 1.05, AB_SPRITE_SCALE * 0.95);
      return;
    } else if (s.isDashAttacking) {
      this.sprite.play("ab-punch", true);
    } else if (s.isDashing) {
      this.sprite.play("ab-run", true);
    } else if (s.isAttacking && s.currentNode) {
      const v = s.currentNode.visual;
      if (v.startsWith("bea-")) {
        this.sprite.play("ab-cast", true);
      } else {
        this.sprite.play("ab-punch", true);
      }
    } else if (s.state === "walk") {
      this.sprite.play("ab-walk", true);
    } else {
      this.sprite.play("ab-idle", true);
    }
    this.sprite.setScale(AB_SPRITE_SCALE);
  }

  private applyHitstopVisual(): void {
    this.sprite.x = (Math.random() - 0.5) * 3;
  }

  private resetPose(): void {
    this.sprite.y = PLAYER.height / 2 + this.jumpOffset;
    this.sprite.setScale(AB_SPRITE_SCALE);
    this.sprite.x = 0;
    this.sprite.clearTint();
  }

  private clampToBounds(): void {
    this.container.x = Phaser.Math.Clamp(this.container.x, this.boundsMinX, this.boundsMaxX);
    this.container.y = Phaser.Math.Clamp(this.container.y, ARENA.groundY, ARENA.groundY + ARENA.groundHeight - ARENA.boundaryPadding);
  }
}
