import Phaser from "phaser";
import {
  LUNA, LUNA_DOG_MOVES, LUNA_LUNAR_MOVES, LUNA_ULTIMATE, LUNA_COLORS,
  ARENA, COMBAT, JUMP, AIR_ATTACK, DASH, PLAYER_HIT,
  LunaMoveDef, LunaMode, JohnDir, JohnButton,
} from "../config/game";
import { InputManager, Action } from "../systems/InputManager";
import { CombatStateMachine } from "../systems/CombatState";
import { HitFeel } from "../systems/HitFeel";
import { BoonState } from "../systems/BoonState";
import { ProjectileSpawnRequest, MeleeHitBox, AoeHit } from "./Player";
import { TrainingDummy } from "./TrainingDummy";
import { PlayerEntity } from "./PlayerEntity";
import { LD_SHEET_KEY, LL_SHEET_KEY, LD_SPRITE_SCALE, LL_SPRITE_SCALE } from "./LunaAnims";

const HP_BAR_W = 40;
const HP_BAR_H = 4;
const MP_BAR_W = 40;
const MP_BAR_H = 3;
const MOM_BAR_W = 40;
const MOM_BAR_H = 2;

type UltPhase = "setup" | "frenzy" | "recovery";

export class LunaPlayer implements PlayerEntity {
  readonly container: Phaser.GameObjects.Container;
  readonly combat: CombatStateMachine;

  private dogSprite: Phaser.GameObjects.Sprite;
  private lunarSprite: Phaser.GameObjects.Sprite;
  private useSpriteSheet: boolean;
  private shadow: Phaser.GameObjects.Ellipse;

  private hpBarBg: Phaser.GameObjects.Rectangle;
  private hpBarFill: Phaser.GameObjects.Rectangle;
  private mpBarBg: Phaser.GameObjects.Rectangle;
  private mpBarFill: Phaser.GameObjects.Rectangle;
  private momBarBg: Phaser.GameObjects.Rectangle;
  private momBarFill: Phaser.GameObjects.Rectangle;
  private statusIconText: Phaser.GameObjects.Text;

  private scene: Phaser.Scene;
  private inputMgr: InputManager;
  private hitFeel: HitFeel;

  facingRight = true;
  hp = LUNA.maxHp;
  mp = LUNA.maxMp;
  isDead = false;
  pendingUltBlast = false;
  pendingDirectionalUltBlast = 0;
  boundsMinX = ARENA.boundaryPadding + LUNA.width / 2;
  boundsMaxX = ARENA.width - ARENA.boundaryPadding - LUNA.width / 2;
  activeStatuses: string[] = [];

  currentMode: LunaMode = "dog";
  momentum = 0;
  private momentumDecayDelay = 0;

  private jumpOffset = 0;
  private jumpVelocity = 0;
  private airAttackLanded = false;

  private pendingProjectiles: ProjectileSpawnRequest[] = [];
  private pendingAoeHit: AoeHit | null = null;

  private boonState: BoonState | null = null;

  private rushTimer = 0;
  private rushSpeed = 0;

  private currentMove: LunaMoveDef | null = null;
  private hitFrameProcessed = false;

  // Ultimate
  private ultPhase: UltPhase = "setup";
  private ultHitsDealt = 0;
  private ultFrenzyTimer = 0;

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

  // Mode switch
  private modeTransitionTimer = 0;

  constructor(scene: Phaser.Scene, x: number, y: number, inputMgr: InputManager, hitFeel: HitFeel) {
    this.scene = scene;
    this.inputMgr = inputMgr;
    this.hitFeel = hitFeel;
    this.combat = new CombatStateMachine();

    const DH = LUNA.height;

    this.shadow = scene.add.ellipse(0, DH / 2 + 4, LUNA.width + 14, 12, 0x000000, 0.3);

    this.useSpriteSheet = scene.textures.exists(LD_SHEET_KEY) && scene.textures.exists(LL_SHEET_KEY);

    if (this.useSpriteSheet) {
      this.dogSprite = scene.add.sprite(0, 0, LD_SHEET_KEY, 0);
      this.dogSprite.setOrigin(0.5, 1.0);
      this.dogSprite.setScale(LD_SPRITE_SCALE);
      this.dogSprite.y = DH / 2 + 4;

      this.lunarSprite = scene.add.sprite(0, 0, LL_SHEET_KEY, 0);
      this.lunarSprite.setOrigin(0.5, 1.0);
      this.lunarSprite.setScale(LL_SPRITE_SCALE);
      this.lunarSprite.y = DH / 2 + 4;
      this.lunarSprite.setAlpha(0);
    } else {
      this.dogSprite = scene.add.sprite(0, 0, "__DEFAULT");
      this.dogSprite.setVisible(false);
      this.lunarSprite = scene.add.sprite(0, 0, "__DEFAULT");
      this.lunarSprite.setVisible(false);
    }

    const barY = DH / 2 + 14;
    this.hpBarBg = scene.add.rectangle(0, barY, HP_BAR_W, HP_BAR_H, 0x1a1a1a);
    this.hpBarFill = scene.add.rectangle(0, barY, HP_BAR_W, HP_BAR_H, 0x44aa44);
    this.mpBarBg = scene.add.rectangle(0, barY + HP_BAR_H + 2, MP_BAR_W, MP_BAR_H, 0x1a1a1a);
    this.mpBarFill = scene.add.rectangle(0, barY + HP_BAR_H + 2, MP_BAR_W, MP_BAR_H, 0x4488dd);
    this.momBarBg = scene.add.rectangle(0, barY + HP_BAR_H + MP_BAR_H + 4, MOM_BAR_W, MOM_BAR_H, 0x1a1a1a);
    this.momBarFill = scene.add.rectangle(0, barY + HP_BAR_H + MP_BAR_H + 4, MOM_BAR_W, MOM_BAR_H, LUNA_COLORS.momentumBar);
    this.statusIconText = scene.add.text(HP_BAR_W / 2 + 3, barY - 4, "", {
      fontFamily: "monospace", fontSize: "8px", color: "#cc66ff",
    });

    this.container = scene.add.container(x, y, [
      this.shadow, this.dogSprite, this.lunarSprite,
      this.hpBarBg, this.hpBarFill, this.mpBarBg, this.mpBarFill,
      this.momBarBg, this.momBarFill, this.statusIconText,
    ]);
  }

  get x(): number { return this.container.x; }
  get y(): number { return this.container.y; }

  get currentComboId(): string | null {
    if (this.currentMove) return this.currentMove.name;
    return null;
  }

  get currentSpecialName(): string | null {
    if (this.combat.isAirAttacking) return this.currentMode === "lunar" ? "Sky Slam!" : "Belly Flop!";
    if (this.combat.isUltimate) return "HOWL!";
    if (this.combat.isDashAttacking) return "Dash Bite!";
    if (this.combat.isDashing) return "Dash!";
    if (this.combat.isHitstun) return "HIT!";
    if (this.combat.isKnockdown) return "DOWN!";
    if (this.combat.isAttacking && this.currentMove) return this.currentMove.name;
    return this.currentMode === "lunar" ? "LUNAR" : null;
  }

  setDummyProvider(_fn: () => TrainingDummy[]): void { /* Luna doesn't use throw */ }
  setBoonState(bs: BoonState): void { this.boonState = bs; }

  private stat(name: string, base: number): number {
    return this.boonState ? this.boonState.getStat(name, base) : base;
  }

  private get activeWidth(): number {
    return this.currentMode === "lunar" ? LUNA.lunarWidth : LUNA.width;
  }

  private get activeSpeed(): number {
    const base = this.currentMode === "lunar" ? LUNA.lunarSpeed : LUNA.speed;
    return this.stat("speed", base) * (this.boonState?.speedBurstMultiplier ?? 1);
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

  markHitConnected(): void {
    this.combat.hasHitThisSwing = true;
    this.addMomentum(5);
  }

  enterMeleeHitstop(ms: number): void { this.combat.enterHitstop(ms); }

  // ── Mode Toggle ──

  toggleMode(target?: LunaMode): void {
    const newMode = target ?? (this.currentMode === "dog" ? "lunar" : "dog");
    if (newMode === this.currentMode) return;
    this.currentMode = newMode;
    this.modeTransitionTimer = 0.15;
    this.applyModeVisuals();

    this.hitFeel.vfx.flashBurst(this.container.x, this.container.y - 20, LUNA_COLORS.modeFlash, 6);
  }

  private applyModeVisuals(): void {
    if (!this.useSpriteSheet) return;
    const isDog = this.currentMode === "dog";
    this.scene.tweens.add({ targets: this.dogSprite, alpha: isDog ? 1 : 0, duration: 100 });
    this.scene.tweens.add({ targets: this.lunarSprite, alpha: isDog ? 0 : 1, duration: 100 });
  }

  // ── Momentum ──

  private addMomentum(amount: number): void {
    this.momentum = Math.min(100, this.momentum + amount);
    this.momentumDecayDelay = 1.0;
  }

  private updateMomentum(dt: number): void {
    if (this.momentumDecayDelay > 0) {
      this.momentumDecayDelay -= dt;
    } else if (this.momentum > 0) {
      this.momentum = Math.max(0, this.momentum - 8 * dt);
    }
  }

  private get weaveChance(): number {
    return 0.05 + (this.momentum / 100) * 0.20;
  }

  // ── Update Loop ──

  update(dt: number): void {
    if (this.isDead || !this.container?.scene) return;
    this.combat.update(dt);
    this.regenMp(dt);
    this.updateMomentum(dt);
    if (this.dashCooldownTimer > 0) this.dashCooldownTimer -= dt;
    if (this.modeTransitionTimer > 0) this.modeTransitionTimer -= dt;

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
      this.handleUltimateSequence(dt);
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
      this.toggleMode();
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
    const moves = this.currentMode === "dog" ? LUNA_DOG_MOVES : LUNA_LUNAR_MOVES;
    const move = moves.find(m => m.dir === dir && m.button === button);
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
    const jumpMult = this.currentMode === "dog" ? 1.5 : 2.0;
    this.jumpVelocity = -JUMP.height * jumpMult / (JUMP.duration / 2);
    this.jumpOffset = 0;
  }

  private onAirAttackInput(): void {
    this.combat.enterAirAttack();
    this.airAttackLanded = false;
    this.jumpVelocity = AIR_ATTACK.dropSpeed * (this.currentMode === "lunar" ? 1.3 : 1.0);
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
    const m = Math.max(0, 1 - this.combat.stateTimer / DASH.attackDuration);
    this.container.x += this.dashDir * DASH.speed * 0.5 * m * dt;
    const hitFrame = this.dashAttackType === "light" ? 0.08 : 0.12;
    if (this.combat.stateTimer >= hitFrame && !this.dashAttackHitFired) {
      this.dashAttackHitFired = true;
    }
    if (this.combat.stateTimer >= DASH.attackDuration) this.combat.toIdle();
  }

  getHitBox(): MeleeHitBox | null {
    if (this.combat.isAttacking && this.currentMove && this.hitFrameProcessed && (this.currentMove.moveType === "melee" || this.currentMove.moveType === "rush") && !this.combat.hasHitThisSwing) {
      const dir = this.facingRight ? 1 : -1;
      const stagger = this.momentum > 60 ? 1.2 : 1.0;
      return {
        x: this.container.x + dir * (this.activeWidth / 2 + COMBAT.meleeHitRange / 2),
        y: this.container.y,
        range: COMBAT.meleeHitRange,
        depthRange: COMBAT.meleeHitDepthRange,
        damage: this.stat("damage", this.currentMove.damage),
        knockback: this.currentMove.knockback * stagger,
        hitstopMs: this.currentMove.hitstopMs,
        shakeIntensity: this.currentMove.shakeIntensity,
        shakeDuration: this.currentMove.shakeDuration,
        isRush: this.currentMove.moveType === "rush",
      };
    }
    if (this.combat.isAirAttacking && !this.airAttackLanded && this.jumpOffset >= -5) {
      const airDmg = this.currentMode === "lunar" ? AIR_ATTACK.damage * 1.5 : AIR_ATTACK.damage;
      return {
        x: this.container.x, y: this.container.y,
        range: AIR_ATTACK.aoeRadius, depthRange: AIR_ATTACK.aoeDepthRange,
        damage: this.stat("damage", airDmg),
        knockback: AIR_ATTACK.knockback,
        hitstopMs: AIR_ATTACK.hitstopMs,
        shakeIntensity: AIR_ATTACK.shakeIntensity,
        shakeDuration: AIR_ATTACK.shakeDuration,
        isRush: false,
      };
    }
    return null;
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

  // ── Take hit with Weave dodge ──

  takeHit(damage: number, knockbackX: number, _knockbackY: number): void {
    if (this.isDead || this.iFrameTimer > 0) return;
    if (!this.combat.isVulnerable) return;

    if (Math.random() < this.weaveChance) {
      this.container.setAlpha(0.4);
      this.scene.time.delayedCall(150, () => { if (!this.isDead) this.container.setAlpha(1); });
      const dodgeText = this.scene.add.text(this.container.x, this.container.y - 50, "DODGE!", {
        fontFamily: "monospace", fontSize: "12px", fontStyle: "bold",
        color: "#ffdd44", stroke: "#000000", strokeThickness: 2,
      });
      dodgeText.setOrigin(0.5);
      dodgeText.setDepth(9999);
      this.scene.tweens.add({
        targets: dodgeText, y: this.container.y - 80, alpha: 0,
        duration: 500, onComplete: () => dodgeText.destroy(),
      });
      this.addMomentum(10);
      return;
    }

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
    this.momentum = Math.max(0, this.momentum - 15);
  }

  // ── Movement ──

  private handleMovement(dt: number): void {
    if (this.combat.isAttacking || this.combat.isDashing || this.combat.isDashAttacking) return;
    const move = this.inputMgr.getMovement();
    this.checkDoubleTapDash(move);

    const speed = this.activeSpeed;
    const airSpeedMult = this.currentMode === "dog" ? 1.3 : 1.0;

    if (this.combat.isJumping || this.combat.isAirAttacking) {
      this.container.x += move.x * speed * airSpeedMult * dt;
    } else {
      this.container.x += move.x * speed * dt;
      this.container.y += move.y * LUNA.depthSpeed * dt;
      this.container.y = Phaser.Math.Clamp(
        this.container.y,
        ARENA.groundY,
        ARENA.groundY + ARENA.groundHeight - ARENA.boundaryPadding,
      );
    }

    if (move.x > 0.1) this.facingRight = true;
    else if (move.x < -0.1) this.facingRight = false;
  }

  // ── Jump ──

  private handleJump(dt: number): void {
    if (!this.combat.isJumping) return;
    this.jumpOffset += this.jumpVelocity * dt;
    const gravity = JUMP.height / ((JUMP.duration / 2) ** 2);
    this.jumpVelocity += gravity * dt * 2;
    if (this.jumpOffset >= 0) {
      this.jumpOffset = 0;
      this.combat.toIdle();
    }
  }

  private handleAirAttack(dt: number): void {
    if (!this.combat.isAirAttacking) return;
    this.jumpOffset += this.jumpVelocity * dt;
    const gravity = JUMP.height / ((JUMP.duration / 2) ** 2);
    this.jumpVelocity += gravity * dt * 2;
    if (this.jumpOffset >= 0) {
      this.jumpOffset = 0;
      this.jumpVelocity = 0;
      if (!this.airAttackLanded) {
        this.airAttackLanded = true;
        const landDmg = this.currentMode === "lunar" ? AIR_ATTACK.damage * 1.5 : AIR_ATTACK.damage;
        this.pendingAoeHit = {
          x: this.container.x, y: this.container.y,
          radius: AIR_ATTACK.aoeRadius, depthRange: AIR_ATTACK.aoeDepthRange,
          damage: this.stat("damage", landDmg),
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

  private handleAttackProgress(_dt: number): void {
    if (!this.combat.isAttacking || !this.currentMove) return;
    const move = this.currentMove;

    if (this.combat.stateTimer >= move.hitFrame && !this.hitFrameProcessed) {
      this.hitFrameProcessed = true;
      this.onHitFrame(move);
    }

    if (this.combat.stateTimer >= move.duration) {
      if (move.switchMode) {
        this.toggleMode(move.switchMode);
      }
      this.combat.toIdle();
      this.currentMove = null;
      this.resetPose();
    }
  }

  private onHitFrame(move: LunaMoveDef): void {
    const cost = move.mpCost;
    if (cost > 0) this.mp -= cost;

    if (move.moveType === "aoe" && move.aoeRadius) {
      this.pendingAoeHit = {
        x: this.container.x, y: this.container.y,
        radius: move.aoeRadius, depthRange: COMBAT.meleeHitDepthRange,
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

  // ── Ultimate: Howl + Frenzy ──

  private onUltimateInput(): void {
    if (this.combat.isBusy && !this.combat.isAttacking) return;
    if (this.mp < LUNA_ULTIMATE.mpCost) return;
    this.mp -= LUNA_ULTIMATE.mpCost;
    this.combat.enterUltimate();
    this.ultPhase = "setup";
    this.ultHitsDealt = 0;
    this.ultFrenzyTimer = 0;
    this.currentMove = null;
  }

  private handleUltimateSequence(dt: number): void {
    switch (this.ultPhase) {
      case "setup":
        this.applyUltSetupVisual();
        if (this.combat.stateTimer >= LUNA_ULTIMATE.setupDuration) {
          this.pendingUltBlast = true;
          this.ultPhase = "frenzy";
          this.combat.stateTimer = 0;
          this.ultFrenzyTimer = 0;
        }
        break;
      case "frenzy":
        this.ultFrenzyTimer += dt;
        this.handleFrenzyPhase(dt);
        if (this.combat.stateTimer >= LUNA_ULTIMATE.frenzyDuration || this.ultHitsDealt >= LUNA_ULTIMATE.frenzyHits) {
          this.ultPhase = "recovery";
          this.combat.stateTimer = 0;
        }
        break;
      case "recovery":
        if (this.combat.stateTimer >= LUNA_ULTIMATE.recoveryDuration) {
          this.momentum = 100;
          this.combat.toIdle();
          this.resetPose();
        }
        break;
    }
  }

  private handleFrenzyPhase(_dt: number): void {
    if (this.useSpriteSheet && this.currentMode === "lunar") {
      this.lunarSprite.play("ll-frenzy", true);
    }
    const interval = LUNA_ULTIMATE.frenzyDuration / LUNA_ULTIMATE.frenzyHits;
    if (this.ultFrenzyTimer >= interval * (this.ultHitsDealt + 1)) {
      const lunarMult = this.currentMode === "lunar" ? 1.5 : 1.0;
      this.pendingDirectionalUltBlast = LUNA_ULTIMATE.frenzyDamage * lunarMult;
      this.ultHitsDealt++;

      this.hitFeel.shake(3, 40);
      const dir = this.facingRight ? 1 : -1;
      const biteX = this.container.x + dir * 30;
      this.hitFeel.impactFlash(biteX, this.container.y - 10);

      this.spawnAfterimage();

      const slashColor = this.currentMode === "lunar" ? LUNA_COLORS.lunarClaws : LUNA_COLORS.dogEyes;
      this.hitFeel.vfx.flashBurst(biteX, this.container.y - 5, slashColor, 2);
    }
  }

  private applyUltSetupVisual(): void {
    if (this.useSpriteSheet) {
      this.activeSprite.play(`${this.modePrefix}-ultimate`, true);
    }
    const progress = this.combat.stateTimer / LUNA_ULTIMATE.setupDuration;
    const dirScale = this.facingRight ? 1 : -1;
    const scale = 1 + progress * 0.15;
    this.container.setScale(dirScale * scale, scale);

    if (progress > 0.2 && Math.random() < 0.15) {
      this.hitFeel.vfx.magicSparkle(
        this.container.x,
        this.container.y - 20,
        LUNA_COLORS.modeFlash,
        2,
      );
    }

    if (progress > 0.7) {
      const howlText = this.scene.add.text(this.container.x, this.container.y - 60, "AWOOO!", {
        fontFamily: "Georgia, serif", fontSize: "16px", fontStyle: "bold",
        color: "#cc44ff", stroke: "#000000", strokeThickness: 3,
      });
      howlText.setOrigin(0.5);
      howlText.setDepth(9999);
      this.scene.tweens.add({
        targets: howlText, y: this.container.y - 100, alpha: 0,
        duration: 600, onComplete: () => howlText.destroy(),
      });
    }
  }

  // ── Visual Helpers ──

  private static readonly DOG_MOVE_ANIM: Record<string, string> = {
    "Quick Bite": "ld-quick-bite",
    "Bark Push": "ld-bark-push",
    "Dash Tackle": "ld-dash-tackle",
    "Pounce": "ld-pounce",
    "Air Snap": "ld-air-snap",
    "Leaping Bite": "ld-leaping-bite",
    "Tail Sweep": "ld-tail-sweep",
    "Dig Fling": "ld-dig-fling",
    "Dodge Nip": "ld-dodge-nip",
    "Moonrise": "ld-moonrise",
  };

  private static readonly LUNAR_MOVE_ANIM: Record<string, string> = {
    "Claw Swipe": "ll-claw-swipe",
    "Heavy Slam": "ll-heavy-slam",
    "Rushing Claws": "ll-rushing-claws",
    "Lunging Uppercut": "ll-lunging-upper",
    "Rising Slash": "ll-rising-slash",
    "Sky Crash": "ll-sky-crash",
    "Low Sweep": "ll-low-sweep",
    "Ground Pound": "ll-ground-pound",
    "Counter Slash": "ll-counter-slash",
    "Revert Burst": "ll-revert-burst",
  };

  private get activeSprite(): Phaser.GameObjects.Sprite {
    return this.currentMode === "dog" ? this.dogSprite : this.lunarSprite;
  }

  private get modePrefix(): string {
    return this.currentMode === "dog" ? "ld" : "ll";
  }

  private applyVisualState(): void {
    if (!this.useSpriteSheet) return;

    this.container.scaleX = this.facingRight ? 1 : -1;

    const DH = LUNA.height;
    const jOff = this.jumpOffset;
    const sprite = this.activeSprite;
    sprite.y = DH / 2 + 4 + jOff;

    if (this.combat.isJumping || this.combat.isAirAttacking) {
      this.shadow.setAlpha(0.15);
    } else {
      this.shadow.setAlpha(0.3);
    }

    if (this.combat.isAttacking && this.currentMove) {
      const map = this.currentMode === "dog" ? LunaPlayer.DOG_MOVE_ANIM : LunaPlayer.LUNAR_MOVE_ANIM;
      const anim = map[this.currentMove.name];
      if (anim) {
        sprite.play(anim, true);
      } else {
        sprite.play(`${this.modePrefix}-idle`, true);
      }
    } else if (this.combat.isDashing) {
      sprite.play(`${this.modePrefix}-dash`, true);
    } else if (this.combat.isDashAttacking) {
      sprite.play(`${this.modePrefix}-dash-attack`, true);
    } else if (this.combat.isJumping) {
      sprite.play(`${this.modePrefix}-jump`, true);
    } else if (this.combat.isAirAttacking) {
      sprite.play(`${this.modePrefix}-air-attack`, true);
    } else {
      const vel = Math.abs(this.prevMoveX);
      if (vel > 0.7) {
        sprite.play(`${this.modePrefix}-run`, true);
      } else if (vel > 0.1) {
        sprite.play(`${this.modePrefix}-walk`, true);
      } else {
        sprite.play(`${this.modePrefix}-idle`, true);
      }
    }
  }

  private applyHitstopVisual(): void {
    if (!this.useSpriteSheet) return;
    const shake = (Math.random() - 0.5) * 3;
    this.activeSprite.x = shake;
  }

  private resetPose(): void {
    if (!this.useSpriteSheet) return;
    this.container.setScale(this.facingRight ? 1 : -1, 1);
    this.dogSprite.x = 0;
    this.dogSprite.y = LUNA.height / 2 + 4;
    this.dogSprite.setScale(LD_SPRITE_SCALE);
    this.dogSprite.setAlpha(this.currentMode === "dog" ? 1 : 0);
    this.lunarSprite.x = 0;
    this.lunarSprite.y = LUNA.height / 2 + 4;
    this.lunarSprite.setScale(LL_SPRITE_SCALE);
    this.lunarSprite.setAlpha(this.currentMode === "lunar" ? 1 : 0);
  }

  private spawnAfterimage(): void {
    this.hitFeel.vfx.dashDust(this.container.x, this.container.y);
  }

  private fireSwingVFX(move: LunaMoveDef): void {
    this.hitFeel.swingArc(this.container.x, this.container.y, this.facingRight, move.damage >= 15);
  }

  private applyAttackStep(move: LunaMoveDef): void {
    if (move.damage >= 15) {
      const dir = this.facingRight ? 1 : -1;
      this.scene.tweens.add({
        targets: this.container,
        x: this.container.x + dir * 15,
        duration: move.duration * 300,
        ease: "Sine.easeOut",
      });
    }
  }

  private onDryFire(): void {
    const x = this.container.x + (this.facingRight ? 20 : -20);
    const y = this.container.y - 10;
    this.hitFeel.vfx.flashBurst(x, y, 0x888888, 2);
  }

  // ── Hitstun / Knockdown ──

  private handleHitstun(dt: number): void {
    this.applyKnockback(dt);
    if (this.useSpriteSheet) {
      const shake = (Math.random() - 0.5) * 4;
      this.activeSprite.x = shake;
      this.activeSprite.play(`${this.modePrefix}-hit`, true);
    }
    if (this.combat.stateTimer >= PLAYER_HIT.hitstunDuration) {
      this.combat.toIdle();
      this.resetPose();
    }
  }

  private handleKnockdown(dt: number): void {
    this.applyKnockback(dt);
    if (this.useSpriteSheet) {
      this.activeSprite.play(`${this.modePrefix}-knockdown`, true);
    }
    const totalDown = PLAYER_HIT.knockdownDuration + PLAYER_HIT.knockdownLieDuration;
    if (this.combat.stateTimer >= totalDown) {
      this.combat.toIdle();
      this.resetPose();
    }
  }

  private handleRecovery(_dt: number): void {
    if (this.useSpriteSheet) {
      this.activeSprite.play(`${this.modePrefix}-recovery`, true);
    }
    if (this.combat.stateTimer >= 0.3) {
      this.combat.toIdle();
      this.resetPose();
    }
  }

  private applyKnockback(dt: number): void {
    this.container.x += this.hitKnockbackVx * dt;
    this.container.y += this.hitKnockbackVy * dt;
    this.hitKnockbackVx *= 0.9;
    this.hitKnockbackVy *= 0.9;
    this.container.y = Phaser.Math.Clamp(
      this.container.y,
      ARENA.groundY,
      ARENA.groundY + ARENA.groundHeight - ARENA.boundaryPadding,
    );
  }

  private onDeath(): void {
    this.isDead = true;
    this.combat.state = "dead";
    this.container.setAlpha(0.4);
  }

  // ── Resource Bars ──

  private regenMp(dt: number): void {
    const regen = this.stat("mpRegen", LUNA.mpRegen);
    this.mp = Math.min(this.stat("maxMp", LUNA.maxMp), this.mp + regen * dt);
  }

  private updateResourceBars(): void {
    const hpRatio = this.hp / this.stat("maxHp", LUNA.maxHp);
    this.hpBarFill.scaleX = hpRatio;
    this.hpBarFill.x = -(HP_BAR_W * (1 - hpRatio)) / 2;
    const mpRatio = this.mp / this.stat("maxMp", LUNA.maxMp);
    this.mpBarFill.scaleX = mpRatio;
    this.mpBarFill.x = -(MP_BAR_W * (1 - mpRatio)) / 2;

    const momRatio = this.momentum / 100;
    this.momBarFill.scaleX = momRatio;
    this.momBarFill.x = -(MOM_BAR_W * (1 - momRatio)) / 2;
    if (this.momentum > 80) {
      const pulse = 0.7 + Math.sin(this.scene.time.now / 150) * 0.3;
      this.momBarFill.setAlpha(pulse);
    } else {
      this.momBarFill.setAlpha(1);
    }

    this.statusIconText.setText(this.activeStatuses.join(""));
  }

  private clampToBounds(): void {
    this.container.x = Phaser.Math.Clamp(this.container.x, this.boundsMinX, this.boundsMaxX);
  }
}
