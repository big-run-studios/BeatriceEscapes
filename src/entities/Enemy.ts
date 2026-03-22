import Phaser from "phaser";
import { COLORS, ENEMY, ENEMY_AI, ARENA, aiLerp } from "../config/game";

export type EnemyRole = "engage" | "flank" | "circle" | "evade" | "retreat";

type EnemyAIState =
  | "idle" | "assess" | "chase" | "flank" | "circle"
  | "evade" | "retreat" | "windup" | "attack" | "recover"
  | "hitstun" | "dead";

export interface PlayerIntent {
  x: number;
  y: number;
  attacking: boolean;
  facingRight: boolean;
  projectiles: { x: number; y: number; facingRight: boolean }[];
}

export interface EnemyAttackHit {
  x: number;
  y: number;
  range: number;
  depthRange: number;
  damage: number;
  knockback: number;
}

const HP_BAR_W = 42;
const HP_BAR_H = 5;

export class Enemy {
  readonly container: Phaser.GameObjects.Container;
  private body: Phaser.GameObjects.Rectangle;
  private head: Phaser.GameObjects.Ellipse;
  private visor: Phaser.GameObjects.Rectangle;
  private shadow: Phaser.GameObjects.Ellipse;
  private hpBarBg: Phaser.GameObjects.Rectangle;
  private hpBarFill: Phaser.GameObjects.Rectangle;
  private hpBarDamage: Phaser.GameObjects.Rectangle;
  private scene: Phaser.Scene;

  private aiState: EnemyAIState = "idle";
  private stateTimer = 0;
  private facingRight = false;

  maxHp: number;
  hp: number;
  private damage: number;
  private speed: number;
  readonly level: number;

  private knockbackVx = 0;
  private knockbackVy = 0;
  private damageBarTarget = 1;
  private attackHitFired = false;

  private alive = true;
  droppedLoot = false;

  role: EnemyRole = "circle";
  private intent: PlayerIntent = { x: 0, y: 0, attacking: false, facingRight: true, projectiles: [] };

  // Level-scaled AI stats
  private aiAssessDur: number;
  private aiWindupDur: number;
  private aiRecoverDur: number;
  private aiEvadeChance: number;
  private aiEvadeSpeed: number;
  private aiEvadeCooldown: number;
  private aiCircleRadius: number;
  private aiCircleSpeed: number;
  private aiFlankAccuracy: number;
  private aiFlankOffset: number;
  private aiRetreatDist: number;
  private aiAllySpacing: number;
  private aiProjDodgeChance: number;
  private aiProjAwareness: number;
  private aiFlankWideArc: number;
  private aiChaseAngle: number;

  private evadeCooldownTimer = 0;
  private evadeDir = 1;
  private circleAngle: number;
  private postEvadeRole: EnemyAIState = "circle";

  private allEnemies: Enemy[] = [];

  constructor(scene: Phaser.Scene, x: number, y: number, level: number) {
    this.scene = scene;
    this.level = level;

    const lm = 1 + ENEMY.hpPerLevel * (level - 1);
    const dm = 1 + ENEMY.damagePerLevel * (level - 1);
    const sm = 1 + ENEMY.speedPerLevel * (level - 1);
    this.maxHp = Math.floor(ENEMY.baseHp * lm);
    this.hp = this.maxHp;
    this.damage = Math.floor(ENEMY.baseDamage * dm);
    this.speed = ENEMY.baseSpeed * sm;

    this.aiAssessDur = aiLerp(ENEMY_AI.assessDuration, level);
    this.aiWindupDur = aiLerp(ENEMY_AI.windupDuration, level);
    this.aiRecoverDur = aiLerp(ENEMY_AI.recoverDuration, level);
    this.aiEvadeChance = aiLerp(ENEMY_AI.evadeChance, level);
    this.aiEvadeSpeed = aiLerp(ENEMY_AI.evadeSpeed, level);
    this.aiEvadeCooldown = aiLerp(ENEMY_AI.evadeCooldown, level);
    this.aiCircleRadius = aiLerp(ENEMY_AI.circleRadius, level);
    this.aiCircleSpeed = aiLerp(ENEMY_AI.circleSpeed, level);
    this.aiFlankAccuracy = aiLerp(ENEMY_AI.flankAccuracy, level);
    this.aiFlankOffset = aiLerp(ENEMY_AI.flankOffset, level);
    this.aiRetreatDist = aiLerp(ENEMY_AI.retreatDistance, level);
    this.aiAllySpacing = aiLerp(ENEMY_AI.allySpacing, level);
    this.aiProjDodgeChance = aiLerp(ENEMY_AI.projectileDodgeChance, level);
    this.aiProjAwareness = aiLerp(ENEMY_AI.projectileAwareness, level);
    this.aiFlankWideArc = aiLerp(ENEMY_AI.flankWideArc, level);
    this.aiChaseAngle = aiLerp(ENEMY_AI.chaseAngleOffset, level);

    this.circleAngle = Math.random() * Math.PI * 2;

    const W = ENEMY.width;
    const H = ENEMY.height;

    this.shadow = scene.add.ellipse(0, H / 2 + 4, W + 12, 12, 0x000000, 0.25);
    this.body = scene.add.rectangle(0, 0, W, H, COLORS.enemyFill);
    this.body.setStrokeStyle(2, COLORS.enemyOutline);
    this.head = scene.add.ellipse(0, -H / 2 - 10, W * 0.65, 20, COLORS.enemyFill);
    this.head.setStrokeStyle(2, COLORS.enemyOutline);
    this.visor = scene.add.rectangle(0, -H / 2 - 10, W * 0.45, 6, COLORS.enemyVisor);

    if (level >= 4) {
      this.visor.setFillStyle(0xff2222);
    }

    this.hpBarBg = scene.add.rectangle(0, -H / 2 - 26, HP_BAR_W, HP_BAR_H, COLORS.hpBarBg);
    this.hpBarDamage = scene.add.rectangle(0, -H / 2 - 26, HP_BAR_W, HP_BAR_H, COLORS.hpBarDamage);
    this.hpBarFill = scene.add.rectangle(0, -H / 2 - 26, HP_BAR_W, HP_BAR_H, COLORS.hpBarFill);

    this.container = scene.add.container(x, y, [
      this.shadow, this.body, this.head, this.visor,
      this.hpBarBg, this.hpBarDamage, this.hpBarFill,
    ]);

    this.stateTimer = Math.random() * 0.5;
  }

  get x(): number { return this.container.x; }
  get y(): number { return this.container.y; }
  get isAlive(): boolean { return this.alive; }
  get width(): number { return ENEMY.width; }
  get height(): number { return ENEMY.height; }
  get isDead(): boolean { return this.aiState === "dead"; }

  setPlayerIntent(intent: PlayerIntent): void {
    this.intent = intent;
  }

  setAllEnemies(enemies: Enemy[]): void {
    this.allEnemies = enemies;
  }

  setPosition(x: number, y: number): void {
    this.container.x = x;
    this.container.y = y;
  }

  update(dt: number): void {
    if (!this.alive) return;
    this.stateTimer += dt;
    if (this.evadeCooldownTimer > 0) this.evadeCooldownTimer -= dt;

    switch (this.aiState) {
      case "idle":
        if (this.stateTimer >= 0.3) this.enterState("assess");
        break;
      case "assess":
        this.doAssess();
        break;
      case "chase":
        this.doChase(dt);
        break;
      case "flank":
        this.doFlank(dt);
        break;
      case "circle":
        this.doCircle(dt);
        break;
      case "evade":
        this.doEvade(dt);
        break;
      case "retreat":
        this.doRetreat(dt);
        break;
      case "windup":
        this.doWindup();
        break;
      case "attack":
        this.doAttack();
        break;
      case "recover":
        if (this.stateTimer >= this.aiRecoverDur) this.enterState("assess");
        break;
      case "hitstun":
        this.applyKnockback(dt);
        this.applyHitstunVisual();
        if (this.stateTimer >= ENEMY.hitstunDuration) {
          this.enterState("assess");
          this.body.x = 0;
          this.head.x = 0;
        }
        break;
    }

    this.applyAllySpacing();
    this.updateHpBar(dt);
    this.updateVisualCues();
    this.container.setDepth(this.container.y);
  }

  // ── AI Decision ──

  private doAssess(): void {
    if (this.stateTimer < this.aiAssessDur) return;

    if (this.shouldEvade()) {
      this.enterState("evade");
      return;
    }

    switch (this.role) {
      case "engage":
        this.enterState("chase");
        break;
      case "flank":
        this.enterState("flank");
        break;
      case "evade":
        this.enterState("evade");
        break;
      case "retreat":
        this.enterState("retreat");
        break;
      case "circle":
      default:
        this.enterState("circle");
        break;
    }
  }

  private shouldEvade(): boolean {
    if (this.evadeCooldownTimer > 0) return false;
    if (this.role === "engage") return false;

    const dx = this.intent.x - this.container.x;
    const dy = Math.abs(this.intent.y - this.container.y);
    const dist = Math.abs(dx);

    if (this.intent.attacking && dy < ENEMY.attackDepthRange + 30) {
      const playerFacingMe = (this.intent.facingRight && dx > 0)
        || (!this.intent.facingRight && dx < 0);
      if (playerFacingMe && dist < 150) {
        return Math.random() < this.aiEvadeChance;
      }
    }

    for (const proj of this.intent.projectiles) {
      const projDx = this.container.x - proj.x;
      const projDy = Math.abs(this.container.y - proj.y);
      const heading = proj.facingRight ? 1 : -1;
      if (heading * projDx > 0 && Math.abs(projDx) < this.aiProjAwareness && projDy < 50) {
        if (Math.random() < this.aiProjDodgeChance) return true;
      }
    }

    return false;
  }

  // ── Movement behaviors ──

  private doChase(dt: number): void {
    const dx = this.intent.x - this.container.x;
    const dy = this.intent.y - this.container.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    this.facingRight = dx > 0;
    this.container.scaleX = this.facingRight ? 1 : -1;

    if (Math.abs(dx) < ENEMY.attackRange && Math.abs(dy) < ENEMY.attackDepthRange) {
      this.enterState("windup");
      return;
    }

    if (dist > 1) {
      let nx = dx / dist;
      let ny = dy / dist;

      const playerFacingMe = (this.intent.facingRight && dx > 0)
        || (!this.intent.facingRight && dx < 0);
      if (playerFacingMe && dist > ENEMY.attackRange * 1.5) {
        const lateralDir = this.container.y > this.intent.y ? 1 : -1;
        ny += lateralDir * this.aiChaseAngle;
        const len = Math.sqrt(nx * nx + ny * ny);
        nx /= len;
        ny /= len;
      }

      this.container.x += nx * this.speed * dt;
      this.container.y += ny * this.speed * 0.7 * dt;
    }

    this.clampToBounds();
  }

  private doFlank(dt: number): void {
    const px = this.intent.x;
    const py = this.intent.y;
    const dx = px - this.container.x;
    const dy = this.container.y - py;

    this.facingRight = dx > 0;
    this.container.scaleX = this.facingRight ? 1 : -1;

    const yDir = dy >= 0 ? 1 : -1;
    const flankY = py + yDir * this.aiFlankOffset;
    const yDist = Math.abs(this.container.y - flankY);

    const wideArc = this.aiFlankWideArc;
    const atFlankDepth = yDist < 15;

    if (!atFlankDepth) {
      this.container.y += (flankY > this.container.y ? 1 : -1) * this.speed * 0.9 * dt;

      const driftAway = dx > 0 ? -1 : 1;
      this.container.x += driftAway * this.speed * wideArc * 0.5 * dt;
    } else {
      const behindX = px + (this.intent.facingRight ? -1 : 1) * ENEMY.attackRange * 1.5;
      const toX = behindX - this.container.x;
      const closeDist = Math.abs(toX);

      if (closeDist > ENEMY.attackRange && Math.abs(dy) < ENEMY.attackDepthRange && this.role === "engage") {
        this.enterState("windup");
        return;
      }

      const spd = this.speed * (0.7 + this.aiFlankAccuracy * 0.4);
      this.container.x += Math.sign(toX) * Math.min(spd * dt, closeDist);

      const jitter = (1 - this.aiFlankAccuracy) * Math.sin(this.stateTimer * 3) * 15;
      this.container.y += jitter * dt;
    }

    if (this.stateTimer > 2.5) this.enterState("assess");
    this.clampToBounds();
  }

  private doCircle(dt: number): void {
    const px = this.intent.x;
    const py = this.intent.y;
    const dx = px - this.container.x;

    this.facingRight = dx > 0;
    this.container.scaleX = this.facingRight ? 1 : -1;

    this.circleAngle += this.aiCircleSpeed * dt;

    const targetX = px + Math.cos(this.circleAngle) * this.aiCircleRadius;
    const targetY = py + Math.sin(this.circleAngle) * this.aiCircleRadius * 0.6;
    const clampedY = Phaser.Math.Clamp(targetY, ARENA.groundY, ARENA.groundY + ARENA.groundHeight - ARENA.boundaryPadding);

    const toX = targetX - this.container.x;
    const toY = clampedY - this.container.y;
    const toDist = Math.sqrt(toX * toX + toY * toY);

    if (toDist > 3) {
      const spd = this.speed * 0.75;
      this.container.x += (toX / toDist) * spd * dt;
      this.container.y += (toY / toDist) * spd * 0.7 * dt;
    }

    if (this.stateTimer > 2.5) this.enterState("assess");
    this.clampToBounds();
  }

  private doEvade(dt: number): void {
    if (this.stateTimer >= ENEMY_AI.evadeDuration) {
      this.evadeCooldownTimer = this.aiEvadeCooldown;
      this.enterState(this.postEvadeRole);
      return;
    }

    if (this.stateTimer < 0.02) {
      const dy = this.intent.y - this.container.y;
      this.evadeDir = dy > 0 ? -1 : 1;
      if (Math.random() < 0.3) this.evadeDir *= -1;
      this.postEvadeRole = Math.random() < 0.6 ? "flank" : "circle";
    }

    this.container.y += this.evadeDir * this.aiEvadeSpeed * dt;

    const dx = this.intent.x - this.container.x;
    const backDir = dx > 0 ? -1 : 1;
    this.container.x += backDir * this.aiEvadeSpeed * 0.5 * dt;

    this.body.x = Math.sin(this.stateTimer * 30) * 3;

    this.clampToBounds();
  }

  private doRetreat(dt: number): void {
    const dx = this.intent.x - this.container.x;
    const dy = this.intent.y - this.container.y;
    const dist = Math.abs(dx);

    this.facingRight = dx > 0;
    this.container.scaleX = this.facingRight ? 1 : -1;

    if (dist >= this.aiRetreatDist) {
      this.enterState("flank");
      return;
    }

    const awayDir = dx > 0 ? -1 : 1;
    this.container.x += awayDir * this.speed * 0.8 * dt;

    const spreadDir = dy >= 0 ? -1 : 1;
    this.container.y += spreadDir * this.speed * 0.6 * dt;

    if (this.stateTimer > 1.5) this.enterState("flank");
    this.clampToBounds();
  }

  // ── Combat ──

  private doWindup(): void {
    const flash = Math.sin(this.stateTimer * 20) > 0;
    this.body.setFillStyle(flash ? COLORS.enemyWindup : COLORS.enemyFill);
    this.visor.setFillStyle(flash ? 0xffffff : (this.level >= 4 ? 0xff2222 : COLORS.enemyVisor));

    if (this.stateTimer >= this.aiWindupDur) {
      this.body.setFillStyle(COLORS.enemyFill);
      this.visor.setFillStyle(this.level >= 4 ? 0xff2222 : COLORS.enemyVisor);
      this.enterState("attack");
    }
  }

  private doAttack(): void {
    const p = this.stateTimer / ENEMY.attackDuration;
    const swing = Math.sin(p * Math.PI);
    const dir = this.facingRight ? 1 : -1;
    this.body.scaleX = 1 + swing * 0.15;
    this.head.x = dir * swing * 8;

    if (p >= 0.4 && !this.attackHitFired) {
      this.attackHitFired = true;
    }

    if (this.stateTimer >= ENEMY.attackDuration) {
      this.body.scaleX = 1;
      this.head.x = 0;
      this.enterState("recover");
    }
  }

  getAttackHit(): EnemyAttackHit | null {
    if (this.aiState !== "attack") return null;
    if (!this.attackHitFired) return null;
    this.attackHitFired = false;

    const dir = this.facingRight ? 1 : -1;
    return {
      x: this.container.x + dir * ENEMY.attackRange,
      y: this.container.y,
      range: ENEMY.attackRange,
      depthRange: ENEMY.attackDepthRange,
      damage: this.damage,
      knockback: 150 + this.level * 20,
    };
  }

  takeHit(damage: number, knockbackX: number, knockbackY: number): void {
    if (!this.alive) return;
    this.hp -= damage;
    this.flashWhite();

    if (this.hp <= 0) {
      this.hp = 0;
      this.die();
      return;
    }

    if (damage >= ENEMY.hitstunThreshold) {
      this.knockbackVx = knockbackX;
      this.knockbackVy = knockbackY;
      this.enterState("hitstun");
    } else {
      this.knockbackVx = knockbackX * 0.3;
      this.knockbackVy = knockbackY * 0.3;
      this.flinch();
    }
  }

  private flinch(): void {
    const dir = this.knockbackVx > 0 ? 1 : -1;
    this.body.x = dir * 4;
    this.head.x = dir * 3;
    this.scene.time.delayedCall(ENEMY.flinchDuration * 1000, () => {
      if (!this.alive) return;
      this.body.x = 0;
      this.head.x = 0;
    });
  }

  // ── Anti-stacking ──

  private applyAllySpacing(): void {
    if (this.aiAllySpacing <= 0) return;
    for (const other of this.allEnemies) {
      if (other === this || !other.isAlive) continue;
      const dx = this.container.x - other.container.x;
      const dy = this.container.y - other.container.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < this.aiAllySpacing && dist > 0.1) {
        const push = (this.aiAllySpacing - dist) * 0.1;
        this.container.x += (dx / dist) * push;
        this.container.y += (dy / dist) * push;
      }
    }
    this.clampToBounds();
  }

  // ── Visual cues ──

  private updateVisualCues(): void {
    if (this.aiState === "dead" || this.aiState === "hitstun") return;

    if (this.aiState === "circle" || this.aiState === "retreat") {
      this.visor.setAlpha(0.5);
    } else if (this.aiState === "chase" || this.aiState === "windup") {
      this.visor.setAlpha(1);
    } else {
      this.visor.setAlpha(0.75);
    }

    if (this.level >= 4 && this.aiState !== "evade") {
      const pulse = 0.8 + Math.sin(this.scene.time.now / 200) * 0.2;
      this.body.setAlpha(pulse);
    }
  }

  // ── Internal ──

  private enterState(state: EnemyAIState): void {
    this.aiState = state;
    this.stateTimer = 0;
    this.attackHitFired = false;
    if (state !== "evade") {
      this.body.x = 0;
    }
  }

  private applyKnockback(dt: number): void {
    this.container.x += this.knockbackVx * dt;
    this.container.y += this.knockbackVy * dt;
    const friction = ENEMY.knockbackFriction * dt;
    if (Math.abs(this.knockbackVx) > friction) this.knockbackVx -= Math.sign(this.knockbackVx) * friction;
    else this.knockbackVx = 0;
    if (Math.abs(this.knockbackVy) > friction) this.knockbackVy -= Math.sign(this.knockbackVy) * friction;
    else this.knockbackVy = 0;
    this.clampToBounds();
  }

  private applyHitstunVisual(): void {
    const shake = (Math.random() - 0.5) * 4;
    this.body.x = shake;
    this.head.x = shake;
  }

  private flashWhite(): void {
    this.body.setFillStyle(0xffffff);
    this.head.setFillStyle(0xffffff);
    this.scene.time.delayedCall(80, () => {
      if (!this.alive) return;
      this.body.setFillStyle(COLORS.enemyFill);
      this.head.setFillStyle(COLORS.enemyFill);
    });
  }

  private die(): void {
    this.alive = false;
    this.aiState = "dead";
    this.scene.tweens.add({
      targets: this.container,
      alpha: 0, scaleY: 0.2, scaleX: 1.4,
      duration: ENEMY.deathDuration * 1000,
      ease: "Power2",
    });

    for (let i = 0; i < 6; i++) {
      const spark = this.scene.add.circle(
        this.container.x + (Math.random() - 0.5) * 40,
        this.container.y + (Math.random() - 0.5) * 30,
        3, COLORS.enemyVisor, 0.9
      );
      spark.setDepth(this.container.y + 5);
      this.scene.tweens.add({
        targets: spark,
        x: spark.x + (Math.random() - 0.5) * 80,
        y: spark.y - Math.random() * 60,
        alpha: 0, duration: 300 + Math.random() * 200,
        onComplete: () => spark.destroy(),
      });
    }
  }

  destroy(): void {
    this.container.destroy();
  }

  private updateHpBar(dt: number): void {
    const ratio = this.hp / this.maxHp;
    this.hpBarFill.scaleX = ratio;
    this.hpBarFill.x = -(HP_BAR_W * (1 - ratio)) / 2;
    this.damageBarTarget = Phaser.Math.Linear(this.damageBarTarget, ratio, dt * 4);
    this.hpBarDamage.scaleX = this.damageBarTarget;
    this.hpBarDamage.x = -(HP_BAR_W * (1 - this.damageBarTarget)) / 2;
  }

  private clampToBounds(): void {
    const pad = ARENA.boundaryPadding;
    const halfW = ENEMY.width / 2;
    this.container.x = Phaser.Math.Clamp(this.container.x, pad + halfW, ARENA.width - pad - halfW);
    this.container.y = Phaser.Math.Clamp(this.container.y, ARENA.groundY, ARENA.groundY + ARENA.groundHeight - pad);
  }
}
