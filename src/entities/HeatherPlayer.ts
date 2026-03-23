import Phaser from "phaser";
import {
  HEATHER, HEATHER_LIGHT_MOVES, HEATHER_HEAVY_MOVES, HEATHER_PARRY,
  HEATHER_ULTIMATE, HEATHER_CHARGE, HEATHER_COLORS, TOTEM_CONFIG,
  ARENA, COMBAT, JUMP, AIR_ATTACK, DASH, PLAYER_HIT,
  HeatherMoveDef, HeatherDir, JohnButton, TotemType,
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

type UltPhase = "setup" | "field" | "recovery";

export interface TotemSpawnRequest {
  type: TotemType;
  x: number;
  y: number;
}

export class HeatherPlayer implements PlayerEntity {
  readonly container: Phaser.GameObjects.Container;
  readonly combat: CombatStateMachine;

  private body: Phaser.GameObjects.Rectangle;
  private head: Phaser.GameObjects.Rectangle;
  private hair: Phaser.GameObjects.Rectangle;
  private scarf: Phaser.GameObjects.Rectangle;
  private staff: Phaser.GameObjects.Rectangle;
  private staffTip: Phaser.GameObjects.Ellipse;
  private shadow: Phaser.GameObjects.Ellipse;

  private hpBarBg: Phaser.GameObjects.Rectangle;
  private hpBarFill: Phaser.GameObjects.Rectangle;
  private mpBarBg: Phaser.GameObjects.Rectangle;
  private mpBarFill: Phaser.GameObjects.Rectangle;
  private statusIconText: Phaser.GameObjects.Text;

  private scene: Phaser.Scene;
  private inputMgr: InputManager;
  private hitFeel: HitFeel;

  facingRight = true;
  hp = HEATHER.maxHp;
  mp = HEATHER.maxMp;
  isDead = false;
  pendingUltBlast = false;
  pendingDirectionalUltBlast = 0;
  boundsMinX = ARENA.boundaryPadding + HEATHER.width / 2;
  boundsMaxX = ARENA.width - ARENA.boundaryPadding - HEATHER.width / 2;
  activeStatuses: string[] = [];

  pendingTotemSpawn: TotemSpawnRequest | null = null;
  pendingCatalystPulse = false;
  pendingParryStun = false;

  totemSpeedMult = 1;
  totemMpRegenMult = 1;
  totemDamageReduction = 0;

  private bodyBaseY = 0;
  private headBaseY: number;

  private jumpOffset = 0;
  private jumpVelocity = 0;
  private airAttackLanded = false;

  private pendingProjectiles: ProjectileSpawnRequest[] = [];
  private pendingAoeHit: AoeHit | null = null;

  private boonState: BoonState | null = null;

  private rushTimer = 0;
  private rushSpeed = 0;

  private currentMove: HeatherMoveDef | null = null;
  private hitFrameProcessed = false;

  // Charge system
  private chargeType: TotemType | null = null;
  private chargeTimer = 0;
  private chargeCircle: Phaser.GameObjects.Ellipse | null = null;
  private holdTimerL = 0;
  private holdTimerH = 0;
  private holdTimerCircle = 0;

  // Hover
  private hoverTimer = 0;
  private isHovering = false;
  private wardChargeCircle: Phaser.GameObjects.Ellipse | null = null;

  // Totem cooldowns (per type)
  totemCooldowns: Record<TotemType, number> = { ward: 0, fury: 0, haste: 0, barrier: 0 };

  // Ultimate
  private ultPhase: UltPhase = "setup";

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

  constructor(scene: Phaser.Scene, x: number, y: number, inputMgr: InputManager, hitFeel: HitFeel) {
    this.scene = scene;
    this.inputMgr = inputMgr;
    this.hitFeel = hitFeel;
    this.combat = new CombatStateMachine();

    const W = HEATHER.width;
    const H = HEATHER.height;

    this.shadow = scene.add.ellipse(0, H / 2 + 4, W + 14, 12, 0x000000, 0.3);

    this.body = scene.add.rectangle(0, 0, W, H, HEATHER_COLORS.bodyColor);
    this.body.setStrokeStyle(2, HEATHER_COLORS.outlineColor);

    this.head = scene.add.rectangle(0, -H / 2 - 10, W * 0.6, 20, HEATHER_COLORS.bodyColor);
    this.head.setStrokeStyle(2, HEATHER_COLORS.outlineColor);

    this.hair = scene.add.rectangle(0, -H / 2 - 18, W * 0.7, 10, HEATHER_COLORS.hairColor);
    this.scarf = scene.add.rectangle(0, -H / 2 + 6, W * 0.55, 6, HEATHER_COLORS.scarfColor);

    this.staff = scene.add.rectangle(W / 2 + 4, -10, 5, H * 0.9, HEATHER_COLORS.staffColor);
    this.staff.setStrokeStyle(1, 0x664488);
    this.staffTip = scene.add.ellipse(W / 2 + 4, -H * 0.45 - 10, 10, 10, HEATHER_COLORS.staffTip);

    const barY = H / 2 + 14;
    this.hpBarBg = scene.add.rectangle(0, barY, HP_BAR_W, HP_BAR_H, 0x1a1a1a);
    this.hpBarFill = scene.add.rectangle(0, barY, HP_BAR_W, HP_BAR_H, 0x44aa44);
    this.mpBarBg = scene.add.rectangle(0, barY + HP_BAR_H + 2, MP_BAR_W, MP_BAR_H, 0x1a1a1a);
    this.mpBarFill = scene.add.rectangle(0, barY + HP_BAR_H + 2, MP_BAR_W, MP_BAR_H, 0x4488dd);
    this.statusIconText = scene.add.text(HP_BAR_W / 2 + 3, barY - 4, "", {
      fontFamily: "monospace", fontSize: "8px", color: "#cc66ff",
    });

    this.container = scene.add.container(x, y, [
      this.shadow, this.body, this.head, this.hair, this.scarf,
      this.staff, this.staffTip,
      this.hpBarBg, this.hpBarFill, this.mpBarBg, this.mpBarFill,
      this.statusIconText,
    ]);

    this.bodyBaseY = 0;
    this.headBaseY = -H / 2 - 10;
  }

  get x(): number { return this.container.x; }
  get y(): number { return this.container.y; }

  get currentComboId(): string | null {
    if (this.currentMove) return this.currentMove.name;
    return null;
  }

  get currentSpecialName(): string | null {
    if (this.combat.isParrying) return "PARRY!";
    if (this.combat.isParryRecovery) return "Catalyst!";
    if (this.combat.isAirAttacking) return "Staff Drop!";
    if (this.combat.isUltimate) return "RESONANCE FIELD";
    if (this.combat.isDashAttacking) return "Dash Staff!";
    if (this.combat.isDashing) return "Dash!";
    if (this.combat.isHitstun) return "HIT!";
    if (this.combat.isKnockdown) return "DOWN!";
    if (this.chargeType) return `Charging ${this.chargeType}...`;
    if (this.isHovering) return this.hoverTimer >= 3.5 ? "Ward Ready!" : "Hovering...";
    if (this.combat.isAttacking && this.currentMove) return this.currentMove.name;
    return null;
  }

  setDummyProvider(_fn: () => TrainingDummy[]): void { /* Heather doesn't throw */ }
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
    this.updateCooldowns(dt);
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
      this.handleRecovery();
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
      if (this.combat.stateTimer >= HEATHER_PARRY.activeWindow) {
        this.combat.enterParryRecovery();
      }
      this.applyParryPose();
      this.updateResourceBars();
      this.container.setDepth(this.container.y);
      return;
    }
    if (this.combat.isParryRecovery) {
      if (this.combat.stateTimer >= HEATHER_PARRY.recoveryDuration) {
        this.combat.toIdle();
        this.resetPose();
      }
      this.applyVisualState();
      this.updateResourceBars();
      this.container.setDepth(this.container.y);
      return;
    }

    this.handleChargeState(dt);
    this.handleInput(dt);
    this.handleJump(dt);
    this.handleHover(dt);
    this.handleAirAttack(dt);
    this.handleRush(dt);
    this.handleAttackProgress();
    this.handleMovement(dt);
    this.applyVisualState();
    this.updateResourceBars();
    this.clampToBounds();
    this.container.setDepth(this.container.y);
  }

  // ── Charge State ──

  private handleChargeState(dt: number): void {
    if (!this.chargeType) return;

    this.chargeTimer += dt;

    // Grow the ground circle and staff tip glow
    this.applyChargeVisual();

    if (this.chargeTimer >= HEATHER_CHARGE.chargeTime) {
      this.completeCharge(this.chargeType);
      this.chargeType = null;
      this.chargeTimer = 0;
      return;
    }

    // Cancel charge if hit
    if (this.combat.isHitstun || this.combat.isKnockdown) {
      this.chargeType = null;
      this.chargeTimer = 0;
      this.staffTip.setFillStyle(HEATHER_COLORS.staffTip);
      this.destroyChargeCircle();
    }
  }

  private applyChargeVisual(): void {
    if (!this.chargeType) return;
    const cfg = TOTEM_CONFIG[this.chargeType];
    this.staffTip.setFillStyle(cfg.color);

    if (this.chargeCircle) {
      const progress = Math.min(this.chargeTimer / HEATHER_CHARGE.chargeTime, 1);
      this.chargeCircle.setScale(progress);
      this.chargeCircle.setPosition(this.container.x, this.container.y + HEATHER.height * 0.45);
      this.chargeCircle.setAlpha(0.1 + progress * 0.25);
    }
  }

  private completeCharge(type: TotemType): void {
    if (this.totemCooldowns[type] > 0) {
      this.onDryFire();
      this.staffTip.setFillStyle(HEATHER_COLORS.staffTip);
      this.destroyChargeCircle();
      return;
    }
    const cost = TOTEM_CONFIG.mpCost[type];
    if (this.mp < cost) {
      this.onDryFire();
      this.staffTip.setFillStyle(HEATHER_COLORS.staffTip);
      this.destroyChargeCircle();
      return;
    }

    this.mp -= cost;
    this.totemCooldowns[type] = TOTEM_CONFIG.cooldown;
    this.pendingTotemSpawn = { type, x: this.container.x, y: this.container.y };
    this.staffTip.setFillStyle(HEATHER_COLORS.staffTip);

    // Flash the charge circle out on successful placement
    if (this.chargeCircle) {
      const cfg = TOTEM_CONFIG[type];
      this.scene.tweens.add({
        targets: this.chargeCircle,
        scaleX: 1.3, scaleY: 1.3, alpha: 0,
        duration: 200,
        onComplete: () => this.destroyChargeCircle(),
      });
      const flash = this.scene.add.ellipse(
        this.chargeCircle.x, this.chargeCircle.y,
        TOTEM_CONFIG.radius * 2, TOTEM_CONFIG.radius * 0.6,
        cfg.glowColor, 0.5,
      );
      flash.setDepth(this.container.y - 1);
      this.scene.tweens.add({
        targets: flash,
        scaleX: 1.5, scaleY: 1.5, alpha: 0,
        duration: 250,
        onComplete: () => flash.destroy(),
      });
    } else {
      this.destroyChargeCircle();
    }
  }

  private get canCharge(): boolean {
    return !this.combat.isAttacking && !this.combat.inHitstop && !this.combat.isHitstun
      && !this.combat.isKnockdown && !this.combat.isRecovering && !this.combat.isDead
      && !this.combat.isUltimate && !this.combat.isParrying && !this.combat.isParryRecovery
      && !this.combat.isDashing && !this.combat.isDashAttacking
      && !this.combat.isAirAttacking && !this.chargeType;
  }

  // ── Input ──

  private handleInput(dt: number): void {
    // Ultimate: L1 + R1
    if (this.inputMgr.bothDown(Action.DODGE, Action.SPECIAL)) {
      this.onUltimateInput();
      return;
    }

    // Airborne: air attack or hover
    if (this.combat.isJumping || this.combat.isAirAttacking) {
      if (this.inputMgr.justPressed(Action.ATTACK) || this.inputMgr.justPressed(Action.HEAVY)) {
        if (this.combat.isJumping && !this.isHovering) {
          this.onAirAttackInput();
        }
      }

      // Hold X while airborne = hover at peak jump height
      if (this.combat.isJumping && this.inputMgr.isDown(Action.JUMP) && this.jumpOffset < -20) {
        if (!this.isHovering) {
          this.isHovering = true;
          this.hoverTimer = 0;
          this.hoverAltitude = -JUMP.height * 0.75;
          this.jumpOffset = this.hoverAltitude;
          this.jumpVelocity = 0;

          const wardCfg = TOTEM_CONFIG.ward;
          this.wardChargeCircle = this.scene.add.ellipse(
            this.container.x, this.container.y,
            TOTEM_CONFIG.radius * 2, TOTEM_CONFIG.radius * 0.6,
            wardCfg.color, 0.15,
          );
          this.wardChargeCircle.setStrokeStyle(2, wardCfg.glowColor);
          this.wardChargeCircle.setScale(0);
          this.wardChargeCircle.setDepth(this.container.y - 2);
        }
      }

      if (this.inputMgr.justPressed(Action.JUMP) && !this.combat.isJumping && !this.combat.isAirAttacking) {
        this.onJumpInput();
      }
      return;
    }

    // ── Circle: Tap = Parry, Hold = Barrier Totem ──
    if (this.inputMgr.justPressed(Action.THROW)) {
      if (!this.combat.isBusy && !this.chargeType) {
        this.combat.enterParrying();
        this.applyParryPose();
      }
      this.holdTimerCircle = 0;
      return;
    }
    if (this.inputMgr.isDown(Action.THROW) && !this.combat.isParrying && !this.combat.isParryRecovery) {
      this.holdTimerCircle += dt;
      if (this.holdTimerCircle >= 0.15 && this.canCharge) {
        this.startCharge("barrier");
        this.holdTimerCircle = 0;
      }
    } else {
      this.holdTimerCircle = 0;
    }

    // If charging, don't process attack inputs
    if (this.chargeType) return;

    // ── L: Tap = Light Melee, Hold = Haste Totem ──
    if (this.inputMgr.justPressed(Action.ATTACK)) {
      if (!this.combat.isBusy) {
        this.onMoveInput("L");
      }
      this.holdTimerL = 0;
      return;
    }
    if (this.inputMgr.isDown(Action.ATTACK)) {
      this.holdTimerL += dt;
      if (this.holdTimerL >= 0.15 && this.canCharge) {
        this.startCharge("haste");
        this.holdTimerL = 0;
      }
    } else {
      this.holdTimerL = 0;
    }

    // ── H: Tap = Heavy Melee, Hold = Fury Totem ──
    if (this.inputMgr.justPressed(Action.HEAVY)) {
      if (!this.combat.isBusy) {
        this.onMoveInput("H");
      }
      this.holdTimerH = 0;
      return;
    }
    if (this.inputMgr.isDown(Action.HEAVY)) {
      this.holdTimerH += dt;
      if (this.holdTimerH >= 0.15 && this.canCharge) {
        this.startCharge("fury");
        this.holdTimerH = 0;
      }
    } else {
      this.holdTimerH = 0;
    }

    // ── Jump ──
    if (this.inputMgr.justPressed(Action.JUMP)) {
      this.onJumpInput();
    }
  }

  private startCharge(type: TotemType): void {
    this.chargeType = type;
    this.chargeTimer = 0;

    const cfg = TOTEM_CONFIG[type];
    this.chargeCircle = this.scene.add.ellipse(
      this.container.x, this.container.y + HEATHER.height * 0.45,
      TOTEM_CONFIG.radius * 2, TOTEM_CONFIG.radius * 0.6,
      cfg.color, 0.15,
    );
    this.chargeCircle.setStrokeStyle(2, cfg.glowColor);
    this.chargeCircle.setScale(0);
    this.chargeCircle.setDepth(this.container.y - 2);
  }

  private destroyChargeCircle(): void {
    if (this.chargeCircle) {
      this.chargeCircle.destroy();
      this.chargeCircle = null;
    }
  }

  private getDirection(): HeatherDir {
    const move = this.inputMgr.getMovement();
    if (Math.abs(move.y) > 0.5 && move.y < 0) return "up";
    if (Math.abs(move.y) > 0.5 && move.y > 0) return "down";
    if (Math.abs(move.x) > 0.5) return "forward";
    return "neutral";
  }

  private onMoveInput(button: JohnButton): void {
    if (this.combat.isJumping || this.combat.isAirAttacking) return;
    if (this.combat.isBusy) return;

    const dir = this.getDirection();
    const moves = button === "L" ? HEATHER_LIGHT_MOVES : HEATHER_HEAVY_MOVES;
    const move = moves.find(m => m.dir === dir && m.button === button);
    if (!move) return;

    if (move.mpCost > 0 && this.mp < move.mpCost) {
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
    this.jumpVelocity = -JUMP.height * 0.75 / (JUMP.duration / 2);
    this.jumpOffset = 0;
    this.isHovering = false;
    this.hoverTimer = 0;
  }

  private onAirAttackInput(): void {
    this.combat.enterAirAttack();
    this.airAttackLanded = false;
    this.jumpVelocity = AIR_ATTACK.dropSpeed;
    this.isHovering = false;
  }

  // ── Hover ──

  private hoverAltitude = 0;

  private handleHover(dt: number): void {
    if (!this.isHovering || !this.combat.isJumping) return;

    this.hoverTimer += dt;

    this.jumpVelocity = 0;
    this.jumpOffset = this.hoverAltitude;

    // Growing ground circle for ward charge
    if (this.wardChargeCircle) {
      const progress = Math.min(this.hoverTimer / HEATHER_CHARGE.wardHoverRequired, 1);
      this.wardChargeCircle.setScale(progress);
      this.wardChargeCircle.setPosition(this.container.x, this.container.y);
      this.wardChargeCircle.setAlpha(0.1 + progress * 0.3);
    }

    // Auto-place ward totem the moment charge completes
    if (this.hoverTimer >= HEATHER_CHARGE.wardHoverRequired && this.wardChargeCircle) {
      this.placeWardFromHover();
    }

    // If hold released or max hover time reached, start falling
    if (!this.inputMgr.isDown(Action.JUMP) || this.hoverTimer >= HEATHER_CHARGE.hoverMaxDuration) {
      this.endHover();
    }
  }

  private placeWardFromHover(): void {
    if (this.totemCooldowns.ward <= 0 && this.mp >= TOTEM_CONFIG.mpCost.ward) {
      this.mp -= TOTEM_CONFIG.mpCost.ward;
      this.totemCooldowns.ward = TOTEM_CONFIG.cooldown;
      this.pendingTotemSpawn = { type: "ward", x: this.container.x, y: this.container.y };
    }
    this.flashWardChargeCircle();
  }

  private flashWardChargeCircle(): void {
    if (!this.wardChargeCircle) return;
    const wardCfg = TOTEM_CONFIG.ward;
    this.scene.tweens.add({
      targets: this.wardChargeCircle,
      scaleX: 1.3, scaleY: 1.3, alpha: 0,
      duration: 200,
      onComplete: () => {
        this.wardChargeCircle?.destroy();
        this.wardChargeCircle = null;
      },
    });
    const flash = this.scene.add.ellipse(
      this.wardChargeCircle.x, this.wardChargeCircle.y,
      TOTEM_CONFIG.radius * 2, TOTEM_CONFIG.radius * 0.6,
      wardCfg.glowColor, 0.5,
    );
    flash.setDepth(this.container.y - 1);
    this.scene.tweens.add({
      targets: flash,
      scaleX: 1.5, scaleY: 1.5, alpha: 0,
      duration: 250,
      onComplete: () => flash.destroy(),
    });
  }

  private endHover(): void {
    this.isHovering = false;
    this.hoverAltitude = 0;
    const gravity = (2 * JUMP.height) / Math.pow(JUMP.duration / 2, 2);
    this.jumpVelocity = gravity * 0.5;

    // Clean up ward circle if it wasn't already consumed
    if (this.wardChargeCircle) {
      this.wardChargeCircle.destroy();
      this.wardChargeCircle = null;
    }

    this.hoverTimer = 0;
  }

  // ── Dash ──

  checkDoubleTapDash(move: { x: number; y: number }): void {
    if (this.combat.isBusy || this.dashCooldownTimer > 0 || this.chargeType) return;
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
    const m = Math.max(0, 1 - this.combat.stateTimer / DASH.attackDuration);
    this.container.x += this.dashDir * DASH.speed * 0.5 * m * dt;
    const hitFrame = this.dashAttackType === "light" ? 0.08 : 0.12;
    if (this.combat.stateTimer >= hitFrame && !this.dashAttackHitFired) {
      this.dashAttackHitFired = true;
    }
    if (this.combat.stateTimer >= DASH.attackDuration) this.combat.toIdle();
  }

  getDashAttackHitBox(): MeleeHitBox | null {
    if (!this.combat.isDashAttacking || !this.dashAttackHitFired || this.combat.hasHitThisSwing) return null;
    const dir = this.facingRight ? 1 : -1;
    const dmg = this.dashAttackType === "heavy" ? DASH.heavyDamage : 10;
    return {
      x: this.container.x + dir * 30, y: this.container.y,
      range: 50, depthRange: COMBAT.meleeHitDepthRange,
      damage: this.stat("damage", dmg),
      knockback: this.dashAttackType === "heavy" ? DASH.heavyKnockback : 100,
      hitstopMs: this.dashAttackType === "heavy" ? DASH.heavyHitstopMs : 30,
      shakeIntensity: this.dashAttackType === "heavy" ? DASH.heavyShakeIntensity : 2,
      shakeDuration: this.dashAttackType === "heavy" ? DASH.heavyShakeDuration : 30,
      isRush: true,
    };
  }

  // ── Hit Box ──

  getHitBox(): MeleeHitBox | null {
    if (this.combat.isAttacking && this.currentMove && this.hitFrameProcessed
        && (this.currentMove.moveType === "melee" || this.currentMove.moveType === "rush")
        && !this.combat.hasHitThisSwing) {
      const dir = this.facingRight ? 1 : -1;
      return {
        x: this.container.x + dir * (HEATHER.width / 2 + COMBAT.meleeHitRange / 2),
        y: this.container.y,
        range: COMBAT.meleeHitRange,
        depthRange: COMBAT.meleeHitDepthRange,
        damage: this.stat("damage", this.currentMove.damage),
        knockback: this.currentMove.knockback,
        hitstopMs: this.currentMove.hitstopMs,
        shakeIntensity: this.currentMove.shakeIntensity,
        shakeDuration: this.currentMove.shakeDuration,
        isRush: this.currentMove.moveType === "rush",
      };
    }
    if (this.combat.isAirAttacking && !this.airAttackLanded && this.jumpOffset >= -5) {
      return {
        x: this.container.x, y: this.container.y,
        range: AIR_ATTACK.aoeRadius, depthRange: AIR_ATTACK.aoeDepthRange,
        damage: this.stat("damage", AIR_ATTACK.damage),
        knockback: AIR_ATTACK.knockback,
        hitstopMs: AIR_ATTACK.hitstopMs,
        shakeIntensity: AIR_ATTACK.shakeIntensity,
        shakeDuration: AIR_ATTACK.shakeDuration,
        isRush: false,
      };
    }
    return null;
  }

  // ── Take Hit / Parry ──

  takeHit(damage: number, knockbackX: number, _knockbackY: number): void {
    if (this.isDead || this.iFrameTimer > 0) return;

    if (this.combat.isParrying) {
      this.pendingParryStun = true;
      this.pendingCatalystPulse = true;
      this.hitFeel.shake(5, 80);
      this.hitFeel.impactFlash(this.container.x, this.container.y - 20);
      this.combat.enterParryRecovery();
      this.iFrameTimer = HEATHER_PARRY.followUpWindow;
      return;
    }

    if (!this.combat.isVulnerable) return;

    // Cancel charge if hit
    if (this.chargeType) {
      this.chargeType = null;
      this.chargeTimer = 0;
      this.staffTip.setFillStyle(HEATHER_COLORS.staffTip);
      this.destroyChargeCircle();
    }

    const reduced = Math.round(damage * (1 - this.totemDamageReduction));
    this.hp -= reduced;
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
    this.isHovering = false;
  }

  // ── Movement ──

  private handleMovement(dt: number): void {
    if (this.combat.isAttacking || this.combat.isDashing || this.combat.isDashAttacking) return;
    const move = this.inputMgr.getMovement();
    this.checkDoubleTapDash(move);

    const baseSpd = this.stat("speed", HEATHER.speed);
    const speedMul = this.boonState ? this.boonState.speedBurstMultiplier : 1;
    const chargeMul = this.chargeType ? HEATHER_CHARGE.chargeSpeedMult : 1;
    const spd = baseSpd * speedMul * chargeMul * this.totemSpeedMult;
    const depthSpd = HEATHER.depthSpeed * speedMul * chargeMul * this.totemSpeedMult;

    if (this.combat.isJumping || this.combat.isAirAttacking) {
      this.container.x += move.x * spd * 0.7 * dt;
    } else if (this.combat.isRecovering) {
      this.container.x += move.x * spd * 0.5 * dt;
      this.container.y += move.y * depthSpd * 0.5 * dt;
    } else {
      this.container.x += move.x * spd * dt;
      this.container.y += move.y * depthSpd * dt;
      if (Math.abs(move.x) > 0.1 || Math.abs(move.y) > 0.1) this.combat.toWalk();
      else if (this.combat.state === "walk" && !this.chargeType) this.combat.toIdle();
    }

    if (move.x > 0.1) this.facingRight = true;
    if (move.x < -0.1) this.facingRight = false;
    this.container.scaleX = this.facingRight ? 1 : -1;
  }

  // ── Jump ──

  private handleJump(dt: number): void {
    if (!this.combat.isJumping) return;
    if (this.isHovering) return;

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
          damage: this.stat("damage", AIR_ATTACK.damage),
          knockback: AIR_ATTACK.knockback,
          hitstopMs: AIR_ATTACK.hitstopMs,
          shakeIntensity: AIR_ATTACK.shakeIntensity,
          shakeDuration: AIR_ATTACK.shakeDuration,
        };
        this.hitFeel.shake(AIR_ATTACK.shakeIntensity, AIR_ATTACK.shakeDuration);
        this.combat.enterHitstop(AIR_ATTACK.hitstopMs);
        this.scene.time.delayedCall(AIR_ATTACK.hitstopMs + 50, () => {
          if (this.combat.state === "hitstop" || this.combat.isAirAttacking) this.combat.toIdle();
        });
      }
    }
  }

  // ── Rush ──

  private handleRush(dt: number): void {
    if (this.rushTimer <= 0) return;
    this.rushTimer -= dt;
    const dir = this.facingRight ? 1 : -1;
    this.container.x += dir * this.rushSpeed * dt;
    if (this.rushTimer <= 0) this.rushTimer = 0;
  }

  // ── Attack Progress ──

  private handleAttackProgress(): void {
    if (!this.combat.isAttacking || !this.currentMove) return;
    const move = this.currentMove;

    if (this.combat.stateTimer >= move.hitFrame && !this.hitFrameProcessed) {
      this.hitFrameProcessed = true;
      if (move.moveType !== "melee" && move.moveType !== "rush") this.combat.hasHitThisSwing = true;
      this.onHitFrame(move);
    }

    if (this.combat.stateTimer >= move.duration) {
      this.combat.toIdle();
      this.currentMove = null;
      this.rushTimer = 0;
      this.resetPose();
    }
  }

  private onHitFrame(move: HeatherMoveDef): void {
    if (move.mpCost > 0) this.mp -= move.mpCost;

    if (move.moveType === "aoe" && move.aoeRadius) {
      this.pendingAoeHit = {
        x: this.container.x, y: this.container.y,
        radius: move.aoeRadius, depthRange: move.aoeRadius * 0.5,
        damage: this.stat("damage", move.damage),
        knockback: move.knockback,
        hitstopMs: move.hitstopMs,
        shakeIntensity: move.shakeIntensity,
        shakeDuration: move.shakeDuration,
      };
      this.hitFeel.shake(move.shakeIntensity, move.shakeDuration);
    }

    if (move.moveType !== "melee") this.hitFeel.shake(move.shakeIntensity, move.shakeDuration);
    if (move.moveType === "rush") this.combat.enterHitstop(move.hitstopMs);
  }

  // ── Ultimate: Resonance Field ──

  private onUltimateInput(): void {
    if (this.combat.isBusy && !this.combat.isAttacking) return;
    if (this.mp < HEATHER_ULTIMATE.mpCost) return;
    this.mp -= HEATHER_ULTIMATE.mpCost;
    this.combat.enterUltimate();
    this.ultPhase = "setup";
    this.currentMove = null;
    this.chargeType = null;
    this.chargeTimer = 0;
  }

  private handleUltimateSequence(): void {
    const t = this.combat.stateTimer;

    switch (this.ultPhase) {
      case "setup":
        this.applyUltSetupVisual();
        if (t >= HEATHER_ULTIMATE.setupDuration) {
          this.pendingUltBlast = true;
          this.ultPhase = "field";
          this.combat.stateTimer = 0;
        }
        break;
      case "field":
        if (t >= HEATHER_ULTIMATE.fieldDuration) {
          this.ultPhase = "recovery";
          this.combat.stateTimer = 0;
        }
        break;
      case "recovery":
        if (t >= HEATHER_ULTIMATE.recoveryDuration) {
          this.combat.toIdle();
          this.resetPose();
        }
        break;
    }
  }

  private applyUltSetupVisual(): void {
    const progress = this.combat.stateTimer / HEATHER_ULTIMATE.setupDuration;
    if (progress > 0.2 && Math.random() < 0.15) {
      const rune = this.scene.add.circle(
        this.container.x + (Math.random() - 0.5) * 40,
        this.container.y + 10,
        5, HEATHER_COLORS.catalystPulse, 0.6,
      );
      rune.setDepth(this.container.y + 100);
      this.scene.tweens.add({
        targets: rune,
        y: rune.y - 20, alpha: 0, scaleX: 2, scaleY: 2,
        duration: 400,
        onComplete: () => rune.destroy(),
      });
    }
  }

  // ── Cooldowns ──

  private updateCooldowns(dt: number): void {
    for (const type of ["ward", "fury", "haste", "barrier"] as TotemType[]) {
      if (this.totemCooldowns[type] > 0) {
        this.totemCooldowns[type] = Math.max(0, this.totemCooldowns[type] - dt);
      }
    }
  }

  // ── Hitstun / Knockdown ──

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
    }
    if (t >= totalDown) {
      this.combat.enterRecovering();
      this.iFrameFlashTimer = 0;
    }
  }

  private handleRecovery(): void {
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

  // ── MP ──

  private regenMp(dt: number): void {
    const maxMp = this.stat("maxMp", HEATHER.maxMp);
    const regen = this.stat("mpRegen", HEATHER.mpRegen) * this.totemMpRegenMult;
    if (this.mp < maxMp) this.mp = Math.min(maxMp, this.mp + regen * dt);
  }

  private updateResourceBars(): void {
    const hpRatio = this.hp / this.stat("maxHp", HEATHER.maxHp);
    this.hpBarFill.scaleX = hpRatio;
    this.hpBarFill.x = -(HP_BAR_W * (1 - hpRatio)) / 2;
    const mpRatio = this.mp / this.stat("maxMp", HEATHER.maxMp);
    this.mpBarFill.scaleX = mpRatio;
    this.mpBarFill.x = -(MP_BAR_W * (1 - mpRatio)) / 2;
    this.statusIconText.setText(this.activeStatuses.join(""));
  }

  // ── Visuals ──

  private applyVisualState(): void {
    const jOff = this.jumpOffset;
    this.body.y = this.bodyBaseY + jOff;
    this.head.y = this.headBaseY + jOff;
    this.hair.y = -HEATHER.height / 2 - 18 + jOff;
    this.scarf.y = -HEATHER.height / 2 + 6 + jOff;
    this.staff.y = -10 + jOff;
    this.staffTip.y = -HEATHER.height * 0.45 - 10 + jOff;
    this.shadow.scaleX = 1 - Math.abs(jOff) / 300;
    this.shadow.scaleY = 1 - Math.abs(jOff) / 300;

    if (this.combat.isAttacking && this.currentMove) {
      this.applyAttackPose();
    } else if (this.combat.isDashing) {
      this.applyDashPose();
    } else if (this.combat.isDashAttacking) {
      this.applyDashAttackPose();
    } else if (this.isHovering) {
      this.applyHoverVisual();
    } else {
      this.resetPose();
    }
  }

  private applyAttackPose(): void {
    if (!this.currentMove) return;
    const move = this.currentMove;
    const p = Math.min(this.combat.stateTimer / move.duration, 1);
    const swing = Math.sin(p * Math.PI);
    const jOff = this.jumpOffset;

    if (move.moveType === "rush") {
      this.body.scaleX = 1 + swing * 0.15;
      this.body.scaleY = 1 - swing * 0.1;
      this.head.x = swing * 5;
      this.head.y = this.headBaseY + swing * 2 + jOff;
      this.staff.setAngle(swing * -30);
    } else if (move.moveType === "aoe") {
      const rise = p < 0.5 ? swing * 8 : 0;
      const slam = p >= 0.5 ? (p - 0.5) * 2 : 0;
      this.body.scaleY = 1 - slam * 0.2;
      this.body.scaleX = 1 + slam * 0.12;
      this.head.y = this.headBaseY - rise + jOff;
      this.body.y = this.bodyBaseY + slam * 5 + jOff;
      this.staff.setAngle(slam * -45);
    } else if (move.button === "H") {
      this.body.scaleX = 1 + swing * 0.06;
      this.head.x = swing * 3;
      this.head.y = this.headBaseY - swing * 2 + jOff;
      this.staff.setAngle(swing * -40);
    } else {
      const lunge = swing * 8;
      this.body.scaleX = 1 + swing * 0.08;
      this.body.scaleY = 1 - swing * 0.1;
      this.head.x = lunge * 0.3;
      this.head.y = this.headBaseY - lunge * 0.15 + jOff;
      this.staff.setAngle(swing * -20);
    }
  }

  private applyHoverVisual(): void {
    const bob = Math.sin(this.hoverTimer * 4) * 3;
    const jOff = this.jumpOffset + bob;
    this.body.y = this.bodyBaseY + jOff;
    this.head.y = this.headBaseY + jOff;
    this.hair.y = -HEATHER.height / 2 - 18 + jOff;
    this.scarf.y = -HEATHER.height / 2 + 6 + jOff;
    this.staff.y = -10 + jOff;
    this.staffTip.y = -HEATHER.height * 0.45 - 10 + jOff;

    // Purple glow particles while hovering
    if (Math.random() < 0.2) {
      const glow = this.scene.add.circle(
        this.container.x + (Math.random() - 0.5) * HEATHER.width,
        this.container.y + jOff + HEATHER.height / 2,
        3, HEATHER_COLORS.auraColor, 0.5,
      );
      glow.setDepth(this.container.y - 1);
      this.scene.tweens.add({
        targets: glow,
        y: glow.y + 15, alpha: 0,
        duration: 400,
        onComplete: () => glow.destroy(),
      });
    }
  }

  private applyDashPose(): void {
    this.body.scaleX = 1.25;
    this.body.scaleY = 0.88;
    this.head.x = this.dashDir * 4;
    this.staff.setAngle(-15);
  }

  private applyDashAttackPose(): void {
    const p = Math.min(this.combat.stateTimer / DASH.attackDuration, 1);
    const swing = Math.sin(p * Math.PI);
    if (this.dashAttackType === "heavy") {
      this.body.scaleX = 1.15 + swing * 0.12;
      this.body.scaleY = 1 - swing * 0.12;
      this.head.x = this.dashDir * swing * 8;
      this.staff.setAngle(swing * -50);
    } else {
      this.body.scaleX = 1.1;
      this.head.x = swing * 5;
      this.staff.setAngle(swing * -25);
    }
  }

  private applyParryPose(): void {
    this.body.y = this.bodyBaseY + 4;
    this.body.scaleX = 1.12;
    this.body.scaleY = 0.92;
    this.head.y = this.headBaseY + 5;
    this.staff.setAngle(20);
    const flash = Math.sin(this.combat.stateTimer * 40) > 0;
    this.body.setFillStyle(flash ? 0xffffff : HEATHER_COLORS.bodyColor);
  }

  private applyHitstopVisual(): void {
    const shake = (Math.random() - 0.5) * 3;
    this.body.x = shake;
    this.head.x = shake;
  }

  private resetPose(): void {
    this.body.y = this.bodyBaseY + this.jumpOffset;
    this.body.scaleX = 1;
    this.body.scaleY = 1;
    this.body.x = 0;
    this.body.setFillStyle(HEATHER_COLORS.bodyColor);
    this.head.y = this.headBaseY + this.jumpOffset;
    this.head.x = 0;
    this.head.scaleY = 1;
    this.staff.setAngle(0);
    this.staffTip.setFillStyle(HEATHER_COLORS.staffTip);
  }

  private spawnAfterimage(): void {
    const ghost = this.scene.add.rectangle(
      this.container.x, this.container.y,
      HEATHER.width, HEATHER.height, HEATHER_COLORS.bodyColor, 0.3,
    );
    ghost.setDepth(this.container.y - 1);
    this.scene.tweens.add({
      targets: ghost, alpha: 0, duration: 200,
      onComplete: () => ghost.destroy(),
    });
  }

  private fireSwingVFX(move: HeatherMoveDef): void {
    const isHeavy = move.button === "H" && move.moveType === "melee";
    this.hitFeel.swingArc(this.container.x, this.container.y, this.facingRight, isHeavy);
  }

  private applyAttackStep(move: HeatherMoveDef): void {
    if (move.moveType === "rush") return;
    const dir = this.facingRight ? 1 : -1;
    if (move.button === "H" || move.dir === "forward") {
      this.scene.tweens.add({
        targets: this.container,
        x: this.container.x + dir * COMBAT.heavyStepDistance * 0.6,
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

  private clampToBounds(): void {
    this.container.x = Phaser.Math.Clamp(this.container.x, this.boundsMinX, this.boundsMaxX);
    this.container.y = Phaser.Math.Clamp(
      this.container.y,
      ARENA.groundY,
      ARENA.groundY + ARENA.groundHeight - ARENA.boundaryPadding,
    );
  }
}
