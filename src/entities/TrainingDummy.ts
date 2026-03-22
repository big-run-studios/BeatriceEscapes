import Phaser from "phaser";
import { COLORS } from "../config/game";

const DUMMY_WIDTH = 36;
const DUMMY_HEIGHT = 72;
const MAX_HP = 100;
const HITSTUN_DURATION = 0.3;
const KNOCKBACK_FRICTION = 600;
const HP_BAR_WIDTH = 50;
const HP_BAR_HEIGHT = 6;
const RESPAWN_DELAY = 1500;

export class TrainingDummy {
  readonly container: Phaser.GameObjects.Container;
  private body: Phaser.GameObjects.Rectangle;
  private head: Phaser.GameObjects.Ellipse;
  private shadow: Phaser.GameObjects.Ellipse;
  private hpBarBg: Phaser.GameObjects.Rectangle;
  private hpBarFill: Phaser.GameObjects.Rectangle;
  private hpBarDamage: Phaser.GameObjects.Rectangle;
  private scene: Phaser.Scene;

  private hp = MAX_HP;
  private hitstunTimer = 0;
  private knockbackVx = 0;
  private knockbackVy = 0;
  private spawnX: number;
  private spawnY: number;
  private alive = true;
  private damageBarTarget = 1;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    this.scene = scene;
    this.spawnX = x;
    this.spawnY = y;

    this.shadow = scene.add.ellipse(0, DUMMY_HEIGHT / 2 + 4, DUMMY_WIDTH + 12, 12, 0x000000, 0.25);

    this.body = scene.add.rectangle(0, 0, DUMMY_WIDTH, DUMMY_HEIGHT, COLORS.dummyFill);
    this.body.setStrokeStyle(2, COLORS.dummyOutline);

    this.head = scene.add.ellipse(0, -DUMMY_HEIGHT / 2 - 12, 22, 22, COLORS.dummyFill);
    this.head.setStrokeStyle(2, COLORS.dummyOutline);

    // HP bar
    this.hpBarBg = scene.add.rectangle(0, -DUMMY_HEIGHT / 2 - 30, HP_BAR_WIDTH, HP_BAR_HEIGHT, COLORS.hpBarBg);
    this.hpBarDamage = scene.add.rectangle(0, -DUMMY_HEIGHT / 2 - 30, HP_BAR_WIDTH, HP_BAR_HEIGHT, COLORS.hpBarDamage);
    this.hpBarFill = scene.add.rectangle(0, -DUMMY_HEIGHT / 2 - 30, HP_BAR_WIDTH, HP_BAR_HEIGHT, COLORS.hpBarFill);

    this.container = scene.add.container(x, y, [
      this.shadow,
      this.body,
      this.head,
      this.hpBarBg,
      this.hpBarDamage,
      this.hpBarFill,
    ]);
  }

  get x(): number { return this.container.x; }
  get y(): number { return this.container.y; }
  get isAlive(): boolean { return this.alive; }
  get width(): number { return DUMMY_WIDTH; }
  get height(): number { return DUMMY_HEIGHT; }

  setPosition(x: number, y: number): void {
    this.container.x = x;
    this.container.y = y;
  }

  update(dt: number): void {
    if (!this.alive) return;

    if (this.hitstunTimer > 0) {
      this.hitstunTimer -= dt;

      this.container.x += this.knockbackVx * dt;
      this.container.y += this.knockbackVy * dt;

      const friction = KNOCKBACK_FRICTION * dt;
      if (Math.abs(this.knockbackVx) > friction) {
        this.knockbackVx -= Math.sign(this.knockbackVx) * friction;
      } else {
        this.knockbackVx = 0;
      }
      if (Math.abs(this.knockbackVy) > friction) {
        this.knockbackVy -= Math.sign(this.knockbackVy) * friction;
      } else {
        this.knockbackVy = 0;
      }

      const shake = (Math.random() - 0.5) * 4;
      this.body.x = shake;
      this.head.x = shake;
    } else {
      this.body.x = 0;
      this.head.x = 0;
    }

    this.updateHpBar(dt);
    this.container.setDepth(this.container.y);
  }

  takeHit(damage: number, knockbackX: number, knockbackY: number): void {
    if (!this.alive) return;

    this.hp -= damage;
    this.hitstunTimer = HITSTUN_DURATION;
    this.knockbackVx = knockbackX;
    this.knockbackVy = knockbackY;

    this.flashWhite();

    if (this.hp <= 0) {
      this.hp = 0;
      this.die();
    }
  }

  private flashWhite(): void {
    this.body.setFillStyle(COLORS.dummyHit);
    this.head.setFillStyle(COLORS.dummyHit);

    this.scene.time.delayedCall(80, () => {
      if (!this.alive) return;
      this.body.setFillStyle(COLORS.dummyFill);
      this.head.setFillStyle(COLORS.dummyFill);
    });
  }

  private die(): void {
    this.alive = false;

    this.scene.tweens.add({
      targets: this.container,
      alpha: 0,
      scaleY: 0.3,
      duration: 300,
      ease: "Power2",
      onComplete: () => {
        this.scene.time.delayedCall(RESPAWN_DELAY, () => this.respawn());
      },
    });
  }

  private respawn(): void {
    this.hp = MAX_HP;
    this.alive = true;
    this.hitstunTimer = 0;
    this.knockbackVx = 0;
    this.knockbackVy = 0;
    this.damageBarTarget = 1;
    this.container.x = this.spawnX;
    this.container.y = this.spawnY;
    this.container.scaleY = 1;

    this.body.setFillStyle(COLORS.dummyFill);
    this.head.setFillStyle(COLORS.dummyFill);

    this.container.setAlpha(0);
    this.scene.tweens.add({
      targets: this.container,
      alpha: 1,
      duration: 400,
      ease: "Power2",
    });
  }

  private updateHpBar(dt: number): void {
    const ratio = this.hp / MAX_HP;

    this.hpBarFill.scaleX = ratio;
    this.hpBarFill.x = -(HP_BAR_WIDTH * (1 - ratio)) / 2;

    this.damageBarTarget = Phaser.Math.Linear(this.damageBarTarget, ratio, dt * 4);
    this.hpBarDamage.scaleX = this.damageBarTarget;
    this.hpBarDamage.x = -(HP_BAR_WIDTH * (1 - this.damageBarTarget)) / 2;
  }
}
