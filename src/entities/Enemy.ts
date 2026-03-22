import Phaser from "phaser";
import { COLORS, ENEMY, ARENA } from "../config/game";

type EnemyAIState = "idle" | "chase" | "windup" | "attack" | "recover" | "hitstun" | "dead";

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

  private maxHp: number;
  private hp: number;
  private damage: number;
  private speed: number;
  readonly level: number;

  private knockbackVx = 0;
  private knockbackVy = 0;
  private damageBarTarget = 1;
  private attackHitFired = false;

  private alive = true;
  droppedLoot = false;

  private playerRef: { x: number; y: number } | null = null;

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

    const W = ENEMY.width;
    const H = ENEMY.height;

    this.shadow = scene.add.ellipse(0, H / 2 + 4, W + 12, 12, 0x000000, 0.25);
    this.body = scene.add.rectangle(0, 0, W, H, COLORS.enemyFill);
    this.body.setStrokeStyle(2, COLORS.enemyOutline);
    this.head = scene.add.ellipse(0, -H / 2 - 10, W * 0.65, 20, COLORS.enemyFill);
    this.head.setStrokeStyle(2, COLORS.enemyOutline);
    this.visor = scene.add.rectangle(0, -H / 2 - 10, W * 0.45, 6, COLORS.enemyVisor);

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

  setPlayerRef(ref: { x: number; y: number }): void {
    this.playerRef = ref;
  }

  setPosition(x: number, y: number): void {
    this.container.x = x;
    this.container.y = y;
  }

  update(dt: number): void {
    if (!this.alive) return;
    this.stateTimer += dt;

    switch (this.aiState) {
      case "idle":
        if (this.stateTimer >= 0.3) this.enterState("chase");
        break;

      case "chase":
        this.doChase(dt);
        break;

      case "windup":
        this.doWindup(dt);
        break;

      case "attack":
        this.doAttack(dt);
        break;

      case "recover":
        if (this.stateTimer >= ENEMY.recoverDuration) this.enterState("chase");
        break;

      case "hitstun":
        this.applyKnockback(dt);
        this.applyHitstunVisual();
        if (this.stateTimer >= ENEMY.hitstunDuration) {
          this.enterState("chase");
          this.body.x = 0;
          this.head.x = 0;
        }
        break;
    }

    this.updateHpBar(dt);
    this.container.setDepth(this.container.y);
  }

  private doChase(dt: number): void {
    if (!this.playerRef) return;
    const dx = this.playerRef.x - this.container.x;
    const dy = this.playerRef.y - this.container.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    this.facingRight = dx > 0;
    this.container.scaleX = this.facingRight ? 1 : -1;

    if (Math.abs(dx) < ENEMY.attackRange && Math.abs(dy) < ENEMY.attackDepthRange) {
      this.enterState("windup");
      return;
    }

    if (dist > 1) {
      const nx = dx / dist;
      const ny = dy / dist;
      this.container.x += nx * this.speed * dt;
      this.container.y += ny * this.speed * 0.6 * dt;
    }

    this.clampToBounds();
  }

  private doWindup(_dt: number): void {
    const flash = Math.sin(this.stateTimer * 20) > 0;
    this.body.setFillStyle(flash ? COLORS.enemyWindup : COLORS.enemyFill);
    this.visor.setFillStyle(flash ? 0xffffff : COLORS.enemyVisor);

    if (this.stateTimer >= ENEMY.windupDuration) {
      this.body.setFillStyle(COLORS.enemyFill);
      this.visor.setFillStyle(COLORS.enemyVisor);
      this.enterState("attack");
    }
  }

  private doAttack(_dt: number): void {
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
    this.knockbackVx = knockbackX;
    this.knockbackVy = knockbackY;
    this.flashWhite();

    if (this.hp <= 0) {
      this.hp = 0;
      this.die();
      return;
    }

    this.enterState("hitstun");
  }

  private enterState(state: EnemyAIState): void {
    this.aiState = state;
    this.stateTimer = 0;
    this.attackHitFired = false;
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
