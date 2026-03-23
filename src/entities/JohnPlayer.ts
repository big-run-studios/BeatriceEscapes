import Phaser from "phaser";
import {
  JOHN, JOHN_MOVES, JOHN_PARRY, JOHN_ULTIMATE, COLORS, ARENA,
  COMBAT, JUMP, AIR_ATTACK, THROW, DASH, PLAYER_HIT,
  JohnMoveDef, JohnDir, JohnButton,
} from "../config/game";
import { InputManager, Action } from "../systems/InputManager";
import { CombatStateMachine } from "../systems/CombatState";
import { HitFeel } from "../systems/HitFeel";
import { BoonState } from "../systems/BoonState";
import { ProjectileSpawnRequest, MeleeHitBox, AoeHit } from "./Player";
import { TrainingDummy } from "./TrainingDummy";
import { PlayerEntity } from "./PlayerEntity";

const HP_BAR_W = 40;
const HP_BAR_H = 4;
const MP_BAR_W = 40;
const MP_BAR_H = 3;

export class JohnPlayer implements PlayerEntity {
  readonly container: Phaser.GameObjects.Container;
  readonly combat: CombatStateMachine;

  private body: Phaser.GameObjects.Rectangle;
  private head: Phaser.GameObjects.Rectangle;
  private shadow: Phaser.GameObjects.Ellipse;
  private nameTag: Phaser.GameObjects.Text;
  private backpack: Phaser.GameObjects.Rectangle;

  private hpBarBg: Phaser.GameObjects.Rectangle;
  private hpBarFill: Phaser.GameObjects.Rectangle;
  private mpBarBg: Phaser.GameObjects.Rectangle;
  private mpBarFill: Phaser.GameObjects.Rectangle;

  private scene: Phaser.Scene;
  private inputMgr: InputManager;
  private hitFeel: HitFeel;

  facingRight = true;
  hp = JOHN.maxHp;
  mp = JOHN.maxMp;
  isDead = false;
  pendingUltBlast = false;
  pendingDirectionalUltBlast = 0;
  boundsMinX = ARENA.boundaryPadding + JOHN.width / 2;
  boundsMaxX = ARENA.width - ARENA.boundaryPadding - JOHN.width / 2;
  activeStatuses: string[] = [];
  private statusIconText!: Phaser.GameObjects.Text;

  private bodyBaseY = 0;
  private headBaseY: number;

  private jumpOffset = 0;
  private jumpVelocity = 0;
  private airAttackLanded = false;

  private pendingProjectiles: ProjectileSpawnRequest[] = [];
  private pendingAoeHit: AoeHit | null = null;

  private throwTarget: TrainingDummy | null = null;
  private throwPhase: "grab" | "throw" = "grab";
  private getDummies: (() => TrainingDummy[]) | null = null;
  private boonState: BoonState | null = null;

  private rushTimer = 0;
  private rushSpeed = 0;

  // Current move (flat lookup, not combo tree)
  private currentMove: JohnMoveDef | null = null;
  private hitFrameProcessed = false;

  // Ultimate
  private ultPhase: "setup" | "beam" | "recovery" = "setup";
  private ultBlastFired = false;
  private bazookaObj: Phaser.GameObjects.Rectangle | null = null;
  private nerfGuns: Phaser.GameObjects.Rectangle[] = [];
  private nerfGunsSpawned = false;

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

  // Parry
  pendingParryStun = false;

  constructor(scene: Phaser.Scene, x: number, y: number, inputMgr: InputManager, hitFeel: HitFeel) {
    this.scene = scene;
    this.inputMgr = inputMgr;
    this.hitFeel = hitFeel;
    this.combat = new CombatStateMachine();

    this.shadow = scene.add.ellipse(0, JOHN.height / 2 + 4, JOHN.width + 12, 12, 0x000000, 0.3);
    this.body = scene.add.rectangle(0, 0, JOHN.width, JOHN.height, COLORS.johnFill);
    this.body.setStrokeStyle(2, COLORS.johnOutline);
    this.head = scene.add.rectangle(0, -JOHN.height / 2 - 10, JOHN.width * 0.65, 20, COLORS.johnFill);
    this.head.setStrokeStyle(2, COLORS.johnOutline);
    this.backpack = scene.add.rectangle(-12, -5, 14, 22, COLORS.johnBackpack);
    this.backpack.setStrokeStyle(1, 0x665533);
    this.nameTag = scene.add.text(0, 0, "", { fontSize: "1px" });
    this.nameTag.setAlpha(0);

    const barY = JOHN.height / 2 + 14;
    this.hpBarBg = scene.add.rectangle(0, barY, HP_BAR_W, HP_BAR_H, COLORS.hpBarBg);
    this.hpBarFill = scene.add.rectangle(0, barY, HP_BAR_W, HP_BAR_H, COLORS.hpBarFill);
    this.mpBarBg = scene.add.rectangle(0, barY + HP_BAR_H + 2, MP_BAR_W, MP_BAR_H, COLORS.hpBarBg);
    this.mpBarFill = scene.add.rectangle(0, barY + HP_BAR_H + 2, MP_BAR_W, MP_BAR_H, COLORS.mpBarFill);
    this.statusIconText = scene.add.text(HP_BAR_W / 2 + 3, barY - 4, "", {
      fontFamily: "monospace", fontSize: "8px", color: "#cc66ff",
    });

    this.container = scene.add.container(x, y, [
      this.shadow, this.body, this.head, this.backpack, this.nameTag,
      this.hpBarBg, this.hpBarFill, this.mpBarBg, this.mpBarFill,
      this.statusIconText,
    ]);

    this.bodyBaseY = 0;
    this.headBaseY = -JOHN.height / 2 - 10;
  }

  get x(): number { return this.container.x; }
  get y(): number { return this.container.y; }

  get currentComboId(): string | null {
    if (this.currentMove) return this.currentMove.name;
    return null;
  }

  get currentSpecialName(): string | null {
    if (this.combat.isParrying) return "PARRY!";
    if (this.combat.isGuarding) return "Guard Stance";
    if (this.combat.isParryRecovery) return "Counter!";
    if (this.combat.isAirAttacking) return "Elbow Drop";
    if (this.combat.isThrowing) return this.throwPhase === "grab" ? "Grab!" : "Throw!";
    if (this.combat.isUltimate) return "NERF BAZOOKA";
    if (this.combat.isDashAttacking) return this.dashAttackType === "light" ? "Dash Pebble!" : "Dash Bat!";
    if (this.combat.isDashing) return "Dash!";
    if (this.combat.isHitstun) return "HIT!";
    if (this.combat.isKnockdown) return "DOWN!";
    if (this.combat.isAttacking && this.currentMove) return this.currentMove.name;
    return null;
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

  markHitConnected(): void { this.combat.hasHitThisSwing = true; }
  enterMeleeHitstop(ms: number): void { this.combat.enterHitstop(ms); }

  // ── Update Loop ──

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
    if (this.combat.isParrying) {
      if (this.combat.stateTimer >= JOHN_PARRY.activeWindow) {
        if (this.inputMgr.isDown(Action.THROW)) {
          this.combat.enterGuarding();
        } else {
          this.combat.enterParryRecovery();
        }
      }
      this.applyParryPose();
      this.updateResourceBars();
      this.container.setDepth(this.container.y);
      return;
    }
    if (this.combat.isGuarding) {
      this.handleGuardStance();
      this.applyGuardPose();
      this.updateResourceBars();
      this.container.setDepth(this.container.y);
      return;
    }
    if (this.combat.isParryRecovery) {
      if (this.combat.stateTimer >= JOHN_PARRY.recoveryDuration) {
        this.combat.toIdle();
        this.resetPose();
      }
      this.applyVisualState();
      this.updateResourceBars();
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

  private getDirection(): JohnDir {
    const move = this.inputMgr.getMovement();
    if (Math.abs(move.y) > 0.5 && move.y < 0) return "up";
    if (Math.abs(move.y) > 0.5 && move.y > 0) return "down";
    if (Math.abs(move.x) > 0.5) return "forward";
    return "neutral";
  }

  private handleInput(): void {
    if (this.inputMgr.bothDown(Action.DODGE, Action.SPECIAL)) {
      this.onUltimateInput();
      return;
    }

    if (this.inputMgr.justPressed(Action.THROW) && !this.combat.isBusy) {
      const dummies = this.getDummies ? this.getDummies() : [];
      let nearest: TrainingDummy | null = null;
      let nearDist = Infinity;
      for (const d of dummies) {
        if (!d.isAlive) continue;
        const dx = Math.abs(this.container.x - d.x);
        const dy = Math.abs(this.container.y - d.y);
        if (dx < THROW.grabRange + d.width / 2 && dy < THROW.grabDepthRange) {
          const dist = dx + dy;
          if (dist < nearDist) { nearDist = dist; nearest = d; }
        }
      }
      if (nearest) {
        this.throwTarget = nearest;
        this.throwPhase = "grab";
        this.combat.enterThrowing();
      } else {
        this.combat.enterParrying();
        this.applyParryPose();
      }
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
        this.onMoveInput("L");
      } else if (this.inputMgr.justPressed(Action.HEAVY)) {
        this.onMoveInput("H");
      }
    }

    if (this.inputMgr.justPressed(Action.JUMP)) {
      this.onJumpInput();
    }
  }

  private onMoveInput(button: JohnButton): void {
    if (this.combat.isJumping || this.combat.isAirAttacking) return;
    if (this.combat.isBusy) return;

    const dir = this.getDirection();
    const move = JOHN_MOVES.find(m => m.dir === dir && m.button === button);
    if (!move) return;

    const cost = move.mpCost;
    if (cost > 0 && this.mp < cost) {
      this.onDryFire();
      return;
    }

    this.currentMove = move;
    this.hitFrameProcessed = false;
    this.combat.state = "attacking";
    this.combat.stateTimer = 0;
    this.combat.hasHitThisSwing = false;

    this.fireSwingVFX(move);

    if (move.moveType === "rush" && move.rushDuration && move.rushSpeed) {
      this.rushTimer = move.rushDuration;
      this.rushSpeed = move.rushSpeed;
      this.hitFeel.shake(move.shakeIntensity, move.shakeDuration);
    } else {
      this.applyAttackStep(move);
    }
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
      (move.x > tapThreshold && this.prevMoveX <= tapThreshold) || this.inputMgr.justPressed(Action.RIGHT)
    );
    const leftTap = this.releasedLeft && (
      (move.x < -tapThreshold && this.prevMoveX >= -tapThreshold) || this.inputMgr.justPressed(Action.LEFT)
    );
    this.prevMoveX = move.x;

    if (rightTap) {
      this.releasedRight = false;
      if (now - this.lastTapRight < DASH.doubleTapWindow && this.lastTapRight > 0) {
        this.startDash(1); this.lastTapRight = 0; return;
      }
      this.lastTapRight = now;
    }
    if (leftTap) {
      this.releasedLeft = false;
      if (now - this.lastTapLeft < DASH.doubleTapWindow && this.lastTapLeft > 0) {
        this.startDash(-1); this.lastTapLeft = 0; return;
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
    if (this.combat.stateTimer > 0.05) this.spawnAfterimage();
    if (this.inputMgr.justPressed(Action.ATTACK)) { this.startDashAttack("light"); return; }
    if (this.inputMgr.justPressed(Action.HEAVY)) { this.startDashAttack("heavy"); return; }
    if (this.combat.stateTimer >= DASH.duration) this.combat.toIdle();
  }

  private startDashAttack(type: "light" | "heavy"): void {
    this.dashAttackType = type;
    this.dashAttackHitFired = false;
    this.combat.enterDashAttack();
    this.hitFeel.swingArc(this.container.x, this.container.y, this.facingRight, type === "heavy");
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
            x: this.container.x + (this.facingRight ? 25 : -25),
            y: this.container.y,
            facingRight: this.facingRight,
            config: {
              radius: 8, speed: 600, color: COLORS.johnSlingshot, maxRange: 350,
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
    if (this.combat.stateTimer >= DASH.attackDuration) this.combat.toIdle();
  }

  getDashAttackHitBox(): MeleeHitBox | null {
    if (!this.combat.isDashAttacking) return null;
    if (this.dashAttackType !== "heavy") return null;
    if (this.combat.hasHitThisSwing) return null;
    if (this.combat.stateTimer < 0.12) return null;
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
      JOHN.width, JOHN.height, COLORS.johnFill, 0.3,
    );
    ghost.setDepth(this.container.y - 1);
    this.scene.tweens.add({
      targets: ghost, alpha: 0, duration: 200,
      onComplete: () => ghost.destroy(),
    });
  }

  // ── Take Damage / Parry ──

  takeHit(damage: number, knockbackX: number, _knockbackY: number): void {
    if (this.isDead || this.iFrameTimer > 0) return;

    if (this.combat.isParrying || this.combat.isGuarding) {
      this.pendingParryStun = true;
      this.hitFeel.shake(5, 80);
      this.hitFeel.impactFlash(this.container.x, this.container.y - 20);
      this.combat.enterParryRecovery();
      this.iFrameTimer = JOHN_PARRY.followUpWindow;
      return;
    }

    if (!this.combat.isVulnerable) return;

    this.hp -= damage;
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
    this.body.x = shake; this.head.x = shake;
    this.body.y = this.bodyBaseY; this.head.y = this.headBaseY;
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
      this.body.y = this.bodyBaseY + p * 25;
      this.body.scaleY = 1 - p * 0.6;
      this.body.scaleX = 1 + p * 0.3;
      this.head.y = this.headBaseY + p * 30;
      this.head.scaleY = 1 - p * 0.4;
    } else {
      this.body.y = this.bodyBaseY + 25;
      this.body.scaleY = 0.4;
      this.body.scaleX = 1.3;
      this.head.y = this.headBaseY + 30;
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
      this.body.y = Phaser.Math.Linear(this.bodyBaseY + 25, this.bodyBaseY, p);
      this.head.y = Phaser.Math.Linear(this.headBaseY + 30, this.headBaseY, p);
      this.head.scaleY = Phaser.Math.Linear(0.6, 1, p);
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
    if (Math.abs(this.hitKnockbackVx) > friction) this.hitKnockbackVx -= Math.sign(this.hitKnockbackVx) * friction;
    else this.hitKnockbackVx = 0;
    if (Math.abs(this.hitKnockbackVy) > friction) this.hitKnockbackVy -= Math.sign(this.hitKnockbackVy) * friction;
    else this.hitKnockbackVy = 0;
  }

  // ── Jump / Air Attack ──

  private handleJump(dt: number): void {
    if (!this.combat.isJumping) return;
    const gravity = (2 * JUMP.height) / Math.pow(JUMP.duration / 2, 2);
    this.jumpVelocity += gravity * dt;
    this.jumpOffset += this.jumpVelocity * dt;
    if (this.jumpOffset >= 0) {
      this.jumpOffset = 0; this.jumpVelocity = 0;
      this.combat.toIdle();
    }
  }

  private handleAirAttack(dt: number): void {
    if (!this.combat.isAirAttacking) return;
    this.jumpOffset += this.jumpVelocity * dt;
    if (this.jumpOffset >= 0) {
      this.jumpOffset = 0; this.jumpVelocity = 0;
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
          if (this.combat.state === "hitstop" || this.combat.isAirAttacking) this.combat.toIdle();
        });
      }
    }
  }

  // ── Throw ──

  private handleThrowSequence(): void {
    if (!this.throwTarget) { this.combat.toIdle(); return; }
    const t = this.combat.stateTimer;
    if (this.throwPhase === "grab") {
      const progress = Math.min(t / THROW.grabDuration, 1);
      const tx = Phaser.Math.Linear(this.throwTarget.x, this.container.x + (this.facingRight ? 25 : -25), progress);
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

  // ── Ultimate (Directional Nerf Bazooka) ──

  private onUltimateInput(): void {
    if (this.combat.isBusy) return;
    const cost = JOHN_ULTIMATE.mpCost;
    if (this.mp >= cost) {
      this.mp -= cost;
    } else {
      const mpPart = this.mp;
      this.mp = 0;
      this.hp = Math.max(0, this.hp - (cost - mpPart));
    }
    this.ultPhase = "setup";
    this.ultBlastFired = false;
    this.nerfGunsSpawned = false;
    this.pendingUltBlast = false;
    this.pendingDirectionalUltBlast = 0;
    this.combat.enterUltimate();
  }

  private static readonly NERF_COLORS = [
    0xff3333, 0x3399ff, 0xffcc00, 0x33cc33, 0xff6622, 0xcc44ff, 0xff66aa, 0x00cccc,
  ];

  private static readonly NERF_PROJ_STYLES: { w: number; h: number; speed: number; alpha: number }[] = [
    { w: 30, h: 6, speed: 900, alpha: 0.9 },
    { w: 18, h: 14, speed: 600, alpha: 0.8 },
    { w: 40, h: 4, speed: 1100, alpha: 0.85 },
    { w: 22, h: 10, speed: 750, alpha: 0.75 },
    { w: 35, h: 5, speed: 1000, alpha: 0.9 },
    { w: 16, h: 16, speed: 550, alpha: 0.7 },
    { w: 28, h: 8, speed: 850, alpha: 0.8 },
    { w: 24, h: 12, speed: 700, alpha: 0.85 },
  ];

  private handleUltimateSequence(): void {
    const t = this.combat.stateTimer;
    const S = JOHN_ULTIMATE;

    if (this.ultPhase === "setup" && t >= S.setupDuration) this.ultPhase = "beam";
    if (this.ultPhase === "beam" && !this.ultBlastFired) {
      this.ultBlastFired = true;
      this.hitFeel.shake(S.beamShakeIntensity, S.beamShakeDuration);
      this.fireNerfBarrage();

      const hitWaves = 4;
      const dmgPerHit = Math.ceil(S.beamDamage / hitWaves);
      for (let i = 0; i < hitWaves; i++) {
        this.scene.time.delayedCall(150 + i * 120, () => {
          this.pendingDirectionalUltBlast = dmgPerHit;
        });
      }
    }
    if (this.ultPhase === "beam" && t >= S.setupDuration + S.beamDuration) this.ultPhase = "recovery";
    const totalDuration = S.setupDuration + S.beamDuration + S.recoveryDuration;
    if (t >= totalDuration) { this.endUltimate(); return; }
    this.applyUltimateVisual();
  }

  private fireNerfBarrage(): void {
    const dir = this.facingRight ? 1 : -1;
    const gunCount = JohnPlayer.NERF_COLORS.length;
    const areaTop = ARENA.groundY;
    const areaBot = ARENA.groundY + ARENA.groundHeight;
    const spacing = (areaBot - areaTop) / (gunCount - 1);

    for (let i = 0; i < gunCount; i++) {
      const gunY = areaTop + i * spacing;
      const color = JohnPlayer.NERF_COLORS[i];
      const style = JohnPlayer.NERF_PROJ_STYLES[i];
      const delay = i * 60;

      this.scene.time.delayedCall(delay, () => {
        const muzzleX = this.container.x + dir * 45;
        const burstCount = 3 + Math.floor(Math.random() * 3);
        for (let j = 0; j < burstCount; j++) {
          this.scene.time.delayedCall(j * 80, () => {
            const yJitter = (Math.random() - 0.5) * 20;
            const proj = this.scene.add.rectangle(
              muzzleX, gunY + yJitter,
              style.w, style.h, color, style.alpha,
            );
            proj.setDepth(this.container.y + 4);
            const travelDist = 900;
            this.scene.tweens.add({
              targets: proj,
              x: muzzleX + dir * travelDist,
              alpha: 0,
              duration: (travelDist / style.speed) * 1000,
              ease: "Quad.easeIn",
              onComplete: () => proj.destroy(),
            });
          });
        }
      });
    }
  }

  private applyUltimateVisual(): void {
    const jOff = this.jumpOffset;
    const dir = this.facingRight ? 1 : -1;

    if (this.ultPhase === "setup") {
      const p = Math.min(this.combat.stateTimer / JOHN_ULTIMATE.setupDuration, 1);
      this.body.x = -dir * p * 8;
      this.head.y = this.headBaseY - p * 4 + jOff;
      this.backpack.x = -12 - dir * p * 8;

      if (p > 0.3 && !this.nerfGunsSpawned) {
        this.nerfGunsSpawned = true;
        this.spawnNerfGunArray();
      }

      if (p > 0.4 && !this.bazookaObj) {
        this.bazookaObj = this.scene.add.rectangle(
          this.container.x + dir * 40, this.container.y - 10,
          50, 18, 0xff6622,
        );
        this.bazookaObj.setStrokeStyle(2, 0xcc4400);
        this.bazookaObj.setDepth(this.container.y + 3);
      }
    }

    if (this.ultPhase === "beam") {
      const pulse = Math.sin(this.combat.stateTimer * 30) * 0.1;
      this.body.setScale(1 + pulse);
      this.head.setScale(1 + pulse);
      this.body.x = -dir * 8;
      if (this.bazookaObj) {
        this.bazookaObj.x = this.container.x + dir * 40;
        this.bazookaObj.setScale(1.2 + pulse);
      }
      for (const gun of this.nerfGuns) {
        if (!gun.scene) continue;
        gun.setScale(1.1 + pulse * 0.5);
      }
    }

    if (this.ultPhase === "recovery") {
      const recStart = JOHN_ULTIMATE.setupDuration + JOHN_ULTIMATE.beamDuration;
      const p = Math.min((this.combat.stateTimer - recStart) / JOHN_ULTIMATE.recoveryDuration, 1);
      this.body.x = Phaser.Math.Linear(this.body.x, 0, p);
      this.body.setScale(1);
      this.head.setScale(1);
      this.head.y = Phaser.Math.Linear(this.headBaseY - 4, this.headBaseY, p) + jOff;
      this.backpack.x = Phaser.Math.Linear(this.backpack.x, -12, p);
      if (this.bazookaObj) {
        this.bazookaObj.setAlpha(1 - p);
        if (p >= 1) { this.bazookaObj.destroy(); this.bazookaObj = null; }
      }
      for (const gun of this.nerfGuns) {
        if (!gun.scene) continue;
        gun.setAlpha(1 - p);
        gun.setScale(1 - p * 0.5);
      }
      if (p >= 1) this.destroyNerfGuns();
    }
  }

  private spawnNerfGunArray(): void {
    const dir = this.facingRight ? 1 : -1;
    const gunCount = JohnPlayer.NERF_COLORS.length;
    const areaTop = ARENA.groundY;
    const areaBot = ARENA.groundY + ARENA.groundHeight;
    const spacing = (areaBot - areaTop) / (gunCount - 1);
    const bpX = this.container.x - 12 * dir;

    for (let i = 0; i < gunCount; i++) {
      const gunY = areaTop + i * spacing;
      const color = JohnPlayer.NERF_COLORS[i];
      const gunW = 36 + Math.random() * 14;
      const gunH = 10 + Math.random() * 6;
      const gun = this.scene.add.rectangle(bpX, this.container.y, gunW, gunH, color);
      gun.setStrokeStyle(2, Phaser.Display.Color.IntegerToColor(color).darken(30).color);
      gun.setDepth(this.container.y + 2);
      gun.setAlpha(0);
      gun.setScale(0.3);
      this.nerfGuns.push(gun);

      this.scene.tweens.add({
        targets: gun,
        x: this.container.x + dir * (35 + Math.random() * 10),
        y: gunY,
        alpha: 1,
        scaleX: 1,
        scaleY: 1,
        duration: 200 + i * 40,
        ease: "Back.easeOut",
      });
    }
  }

  private destroyNerfGuns(): void {
    for (const gun of this.nerfGuns) {
      if (gun.scene) gun.destroy();
    }
    this.nerfGuns = [];
  }

  private endUltimate(): void {
    this.body.setScale(1);
    this.head.setScale(1);
    if (this.bazookaObj) { this.bazookaObj.destroy(); this.bazookaObj = null; }
    this.destroyNerfGuns();
    this.nerfGunsSpawned = false;
    this.resetPose();
    this.combat.toIdle();
  }

  // ── MP ──

  private regenMp(dt: number): void {
    const maxMp = this.stat("maxMp", JOHN.maxMp);
    const regen = this.stat("mpRegen", JOHN.mpRegen);
    if (this.mp < maxMp) this.mp = Math.min(maxMp, this.mp + regen * dt);
  }

  private updateResourceBars(): void {
    const hpRatio = this.hp / this.stat("maxHp", JOHN.maxHp);
    this.hpBarFill.scaleX = hpRatio;
    this.hpBarFill.x = -(HP_BAR_W * (1 - hpRatio)) / 2;
    const mpRatio = this.mp / this.stat("maxMp", JOHN.maxMp);
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

  // ── Attack Progress (flat map, not combo tree) ──

  private handleAttackProgress(_dt: number): void {
    if (!this.combat.isAttacking || !this.currentMove) return;
    const move = this.currentMove;
    if (this.combat.stateTimer >= move.hitFrame && !this.hitFrameProcessed) {
      this.hitFrameProcessed = true;
      if (move.moveType !== "melee" && move.moveType !== "rush") this.combat.hasHitThisSwing = true;
      this.onHitFrame(move);
    }
    if (this.combat.stateTimer >= move.duration) this.onAttackEnd();
  }

  getHitBox(): MeleeHitBox | null {
    if (!this.combat.isAttacking || !this.currentMove) return null;
    const move = this.currentMove;

    if (move.moveType === "rush") {
      if (this.rushTimer <= 0) return null;
      const dir = this.facingRight ? 1 : -1;
      return {
        x: this.container.x + dir * COMBAT.meleeHitRange,
        y: this.container.y,
        range: COMBAT.meleeHitRange + 15,
        depthRange: COMBAT.meleeHitDepthRange,
        damage: this.stat("damage", move.damage),
        knockback: move.knockback,
        hitstopMs: move.hitstopMs,
        shakeIntensity: move.shakeIntensity,
        shakeDuration: move.shakeDuration,
        isRush: true,
      };
    }

    if (move.moveType !== "melee") return null;
    if (this.combat.hasHitThisSwing) return null;
    if (this.combat.stateTimer < move.hitFrame) return null;

    const dir = this.facingRight ? 1 : -1;
    return {
      x: this.container.x + dir * COMBAT.meleeHitRange,
      y: this.container.y,
      range: COMBAT.meleeHitRange,
      depthRange: COMBAT.meleeHitDepthRange,
      damage: this.stat("damage", move.damage),
      knockback: move.knockback,
      hitstopMs: move.hitstopMs,
      shakeIntensity: move.shakeIntensity,
      shakeDuration: move.shakeDuration,
      isRush: false,
    };
  }

  private onHitFrame(move: JohnMoveDef): void {
    const cost = move.mpCost;
    if (cost > 0) this.mp -= cost;

    if (move.moveType === "projectile" && move.projectile) {
      const dir = this.facingRight ? 1 : -1;
      this.pendingProjectiles.push({
        x: this.container.x + dir * 20,
        y: this.container.y - 5,
        facingRight: this.facingRight,
        isHeavy: move.button === "H" || move.damage >= 20,
        config: {
          ...move.projectile,
          damage: this.stat("damage", move.damage),
          knockback: move.knockback,
          hitstopMs: move.hitstopMs,
          shakeIntensity: move.shakeIntensity,
          shakeDuration: move.shakeDuration,
        },
      });
    } else if (move.moveType === "aoe" && move.aoeRadius) {
      this.pendingAoeHit = {
        x: this.container.x,
        y: this.container.y,
        radius: move.aoeRadius,
        depthRange: move.aoeRadius * 0.5,
        damage: this.stat("damage", move.damage),
        knockback: move.knockback,
        hitstopMs: move.hitstopMs,
        shakeIntensity: move.shakeIntensity,
        shakeDuration: move.shakeDuration,
      };
      this.hitFeel.elbowDropImpact(this.container.x, this.container.y);
    }

    if (move.moveType !== "melee") this.hitFeel.shake(move.shakeIntensity, move.shakeDuration);
    if (move.moveType === "rush") this.combat.enterHitstop(move.hitstopMs);
  }

  private onDryFire(): void {
    this.hitFeel.shake(1, 20);
    const dir = this.facingRight ? 1 : -1;
    const puff = this.scene.add.circle(
      this.container.x + dir * 15, this.container.y - 10,
      6, 0x888888, 0.5,
    );
    puff.setDepth(this.container.y + 2);
    this.scene.tweens.add({
      targets: puff, alpha: 0, scaleX: 2, scaleY: 2,
      duration: 200, onComplete: () => puff.destroy(),
    });
  }

  private onAttackEnd(): void {
    this.combat.toIdle();
    this.currentMove = null;
    this.rushTimer = 0;
  }

  private fireSwingVFX(move: JohnMoveDef): void {
    const isHeavy = move.button === "H" && move.moveType === "melee";
    this.hitFeel.swingArc(this.container.x, this.container.y, this.facingRight, isHeavy);
  }

  private applyAttackStep(move: JohnMoveDef): void {
    if (move.moveType === "rush") return;
    const dir = this.facingRight ? 1 : -1;
    if (move.button === "H" || move.dir === "forward") {
      this.scene.tweens.add({
        targets: this.container,
        x: this.container.x + dir * COMBAT.heavyStepDistance * 0.7,
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

  // ── Movement ──

  private handleMovement(dt: number): void {
    if (this.combat.isAttacking) return;
    const move = this.inputMgr.getMovement();
    this.checkDoubleTapDash(move);
    if (this.combat.isDashing) return;

    const baseSpd = this.stat("speed", JOHN.speed);
    const speedMul = this.boonState ? this.boonState.speedBurstMultiplier : 1;
    const spd = baseSpd * speedMul;
    const depthSpd = JOHN.depthSpeed * (spd / JOHN.speed) * speedMul;

    if (this.combat.isJumping || this.combat.isAirAttacking) {
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

    if (move.x > 0.1) this.facingRight = true;
    if (move.x < -0.1) this.facingRight = false;
    this.container.scaleX = this.facingRight ? 1 : -1;
  }

  // ── Visuals ──

  private applyVisualState(): void {
    const s = this.combat;
    const jOff = this.jumpOffset;
    this.body.y = this.bodyBaseY + jOff;
    this.head.y = this.headBaseY + jOff;
    this.backpack.y = -5 + jOff;
    this.nameTag.y = -JOHN.height / 2 - 32 + jOff;
    this.shadow.scaleX = 1 - Math.abs(jOff) / 300;
    this.shadow.scaleY = 1 - Math.abs(jOff) / 300;

    if (s.isAirAttacking) this.applyAirAttackPose();
    else if (s.isThrowing) this.applyThrowPose();
    else if (s.isDashAttacking) this.applyDashAttackPose();
    else if (s.isDashing) this.applyDashPose();
    else if (s.isAttacking && this.currentMove) this.applyJohnAttackPose();
    else this.resetPose();
  }

  private applyAirAttackPose(): void {
    const jOff = this.jumpOffset;
    this.body.y = this.bodyBaseY + jOff;
    this.body.scaleX = 1.2; this.body.scaleY = 0.8;
    this.head.y = this.headBaseY + 5 + jOff;
    this.head.x = 0;
  }

  private applyThrowPose(): void {
    if (this.throwPhase === "grab") {
      const p = Math.min(this.combat.stateTimer / THROW.grabDuration, 1);
      this.body.scaleX = 1 + p * 0.1;
    } else {
      const p = Math.min(this.combat.stateTimer / THROW.throwDuration, 1);
      const swing = Math.sin(p * Math.PI);
      this.body.scaleX = 1 + swing * 0.15;
      this.body.scaleY = 1 - swing * 0.1;
      this.head.x = swing * 8;
    }
  }

  private handleGuardStance(): void {
    if (!this.inputMgr.isDown(Action.THROW)) {
      this.combat.toIdle();
      this.resetPose();
      return;
    }
    if (this.inputMgr.justPressed(Action.ATTACK)) {
      this.fireGuardMove("L");
      return;
    }
    if (this.inputMgr.justPressed(Action.HEAVY)) {
      this.fireGuardMove("H");
      return;
    }
  }

  private fireGuardMove(button: JohnButton): void {
    const move = JOHN_MOVES.find(m => m.dir === "guard" && m.button === button);
    if (!move) return;
    if (move.mpCost > 0 && this.mp < move.mpCost) {
      this.onDryFire();
      this.combat.toIdle();
      this.resetPose();
      return;
    }
    this.currentMove = move;
    this.hitFrameProcessed = false;
    this.combat.state = "attacking";
    this.combat.stateTimer = 0;
    this.combat.hasHitThisSwing = false;
    this.fireSwingVFX(move);
    this.applyAttackStep(move);
  }

  private applyParryPose(): void {
    this.body.y = this.bodyBaseY + 4;
    this.body.scaleX = 1.15;
    this.body.scaleY = 0.9;
    this.head.y = this.headBaseY + 6;
    this.backpack.y = -1;
    const flash = Math.sin(this.combat.stateTimer * 40) > 0;
    this.body.setFillStyle(flash ? 0xffffff : COLORS.johnFill);
  }

  private applyGuardPose(): void {
    this.body.y = this.bodyBaseY + 5;
    this.body.scaleX = 1.12;
    this.body.scaleY = 0.88;
    this.head.y = this.headBaseY + 7;
    this.head.x = 0;
    this.backpack.y = 0;
    this.body.setFillStyle(0x4a7a2a);
  }

  private applyDashPose(): void {
    this.body.scaleX = 1.3; this.body.scaleY = 0.85;
    this.head.x = this.dashDir * 5;
  }

  private applyDashAttackPose(): void {
    const p = Math.min(this.combat.stateTimer / DASH.attackDuration, 1);
    const swing = Math.sin(p * Math.PI);
    if (this.dashAttackType === "heavy") {
      this.body.scaleX = 1.2 + swing * 0.15;
      this.body.scaleY = 1 - swing * 0.15;
      this.head.x = this.dashDir * swing * 10;
      this.head.y = this.headBaseY - swing * 3;
    } else {
      this.body.scaleX = 1.1;
      this.head.x = swing * 6;
    }
  }

  private applyJohnAttackPose(): void {
    if (!this.currentMove) return;
    const move = this.currentMove;
    const p = Math.min(this.combat.stateTimer / move.duration, 1);
    const swing = Math.sin(p * Math.PI);
    const jOff = this.jumpOffset;

    if (move.moveType === "rush") {
      this.body.scaleX = 1 + swing * 0.18;
      this.body.scaleY = 1 - swing * 0.1;
      this.head.x = swing * 6;
      this.head.y = this.headBaseY + swing * 2 + jOff;
    } else if (move.moveType === "aoe") {
      const rise = p < 0.5 ? swing * 10 : 0;
      const slam = p >= 0.5 ? (p - 0.5) * 2 : 0;
      this.body.scaleY = 1 - slam * 0.25;
      this.body.scaleX = 1 + slam * 0.15;
      this.head.y = this.headBaseY - rise + jOff;
      this.body.y = this.bodyBaseY + slam * 5 + jOff;
    } else if (move.button === "H") {
      this.body.scaleX = 1 + swing * 0.08;
      this.head.x = swing * 4;
      this.head.y = this.headBaseY - swing * 2 + jOff;
    } else {
      const lunge = swing * 10;
      this.body.scaleX = 1 + swing * 0.1;
      this.body.scaleY = 1 - swing * 0.12;
      this.head.x = lunge * 0.4;
      this.head.y = this.headBaseY - lunge * 0.2 + jOff;
    }
  }

  private applyHitstopVisual(): void {
    const shake = (Math.random() - 0.5) * 3;
    this.body.x = shake; this.head.x = shake;
  }

  private resetPose(): void {
    this.body.y = this.bodyBaseY + this.jumpOffset;
    this.body.scaleX = 1; this.body.scaleY = 1; this.body.x = 0;
    this.body.setFillStyle(COLORS.johnFill);
    this.head.y = this.headBaseY + this.jumpOffset;
    this.head.x = 0; this.head.scaleY = 1;
    this.backpack.x = -12; this.backpack.y = -5 + this.jumpOffset;
  }

  private clampToBounds(): void {
    this.container.x = Phaser.Math.Clamp(this.container.x, this.boundsMinX, this.boundsMaxX);
    this.container.y = Phaser.Math.Clamp(this.container.y, ARENA.groundY, ARENA.groundY + ARENA.groundHeight - ARENA.boundaryPadding);
  }
}
