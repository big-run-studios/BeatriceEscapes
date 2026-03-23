import Phaser from "phaser";

export interface ProjectileConfig {
  radius: number;
  speed: number;
  color: number;
  maxRange: number;
  damage: number;
  knockback: number;
  hitstopMs: number;
  shakeIntensity: number;
  shakeDuration: number;
  vy?: number;
}

export class Projectile {
  readonly circle: Phaser.GameObjects.Arc;
  private trail: Phaser.GameObjects.Arc;
  private scene: Phaser.Scene;
  private vx: number;
  private vy: number;
  private maxRange: number;
  private distanceTraveled = 0;
  private _alive = true;
  private _facingRight = true;

  readonly damage: number;
  readonly knockback: number;
  readonly hitstopMs: number;
  readonly shakeIntensity: number;
  readonly shakeDuration: number;
  readonly radius: number;
  worldY: number;

  constructor(scene: Phaser.Scene, x: number, y: number, facingRight: boolean, config: ProjectileConfig) {
    this.scene = scene;
    this.maxRange = config.maxRange;
    this.damage = config.damage;
    this.knockback = config.knockback;
    this.hitstopMs = config.hitstopMs;
    this.shakeIntensity = config.shakeIntensity;
    this.shakeDuration = config.shakeDuration;
    this.radius = config.radius;
    this.worldY = y;

    this._facingRight = facingRight;
    this.vx = (facingRight ? 1 : -1) * config.speed;
    this.vy = config.vy ?? 0;

    this.trail = scene.add.circle(x, y, config.radius * 0.7, config.color, 0.3);
    this.trail.setDepth(y);

    this.circle = scene.add.circle(x, y, config.radius, config.color, 0.85);
    this.circle.setStrokeStyle(2, 0xffffff, 0.4);
    this.circle.setDepth(y + 0.5);
  }

  get alive(): boolean { return this._alive; }
  get x(): number { return this.circle.x; }
  get y(): number { return this.circle.y; }
  get facingRight(): boolean { return this._facingRight; }

  update(dt: number): void {
    if (!this._alive) return;

    const prevX = this.circle.x;
    const prevY = this.circle.y;
    this.circle.x += this.vx * dt;
    this.circle.y += this.vy * dt;
    this.worldY = this.circle.y;

    this.trail.x = Phaser.Math.Linear(this.trail.x, prevX, 0.5);
    this.trail.y = Phaser.Math.Linear(this.trail.y, prevY, 0.5);
    this.trail.setAlpha(0.3);

    const stepX = this.circle.x - prevX;
    const stepY = this.circle.y - prevY;
    this.distanceTraveled += Math.sqrt(stepX * stepX + stepY * stepY);

    if (this.distanceTraveled > this.maxRange) {
      this.destroy();
    }
  }

  destroy(): void {
    if (!this._alive) return;
    this._alive = false;

    this.scene.tweens.add({
      targets: [this.circle, this.trail],
      alpha: 0,
      scaleX: 1.5,
      scaleY: 1.5,
      duration: 100,
      onComplete: () => {
        this.circle.destroy();
        this.trail.destroy();
      },
    });
  }
}
