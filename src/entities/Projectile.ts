import Phaser from "phaser";
import { VFXManager } from "../systems/VFXManager";

export type TrailType =
  | "wind" | "wind-heavy" | "blast" | "bea"
  | "sling" | "marble" | "rocket" | "fire"
  | "spark" | "enemy" | "net";

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
  trailType?: TrailType;
}

export const PROJ_SHEET_KEY = "proj-sprites";
export const PROJ_FRAME_W = 128;
export const PROJ_FRAME_H = 128;

const TRAIL_TO_FRAME: Partial<Record<TrailType, number>> = {
  "wind": 0, "wind-heavy": 1, "blast": 2, "bea": 3,
  "sling": 4, "marble": 4, "rocket": 5, "fire": 6,
  "spark": 7, "enemy": 8, "net": 9,
};

type Emitter = Phaser.GameObjects.Particles.ParticleEmitter;

export class Projectile {
  readonly circle: Phaser.GameObjects.Arc;
  private trail: Phaser.GameObjects.Arc;
  private bodySprite: Phaser.GameObjects.Sprite | null = null;
  private particleTrails: Emitter[] = [];
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

  constructor(scene: Phaser.Scene, x: number, y: number, facingRight: boolean, config: ProjectileConfig, vfx?: VFXManager) {
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

    const hasSheet = scene.textures.exists(PROJ_SHEET_KEY);
    const frameIdx = config.trailType != null ? TRAIL_TO_FRAME[config.trailType] : undefined;
    const useSprite = hasSheet && frameIdx != null;

    this.circle = scene.add.circle(x, y, config.radius, config.color, useSprite ? 0 : 0.85);
    if (!useSprite) this.circle.setStrokeStyle(2, 0xffffff, 0.4);
    this.circle.setDepth(y + 0.5);

    if (useSprite) {
      const displaySize = Math.max(config.radius * 3, 20);
      const spriteScale = displaySize / PROJ_FRAME_W;
      this.bodySprite = scene.add.sprite(x, y, PROJ_SHEET_KEY, frameIdx);
      this.bodySprite.setScale(spriteScale);
      this.bodySprite.setDepth(y + 0.5);
      this.bodySprite.setFlipX(!facingRight);
    }

    if (vfx) {
      this.particleTrails = vfx.createProjectileTrail(this.circle, config.color, config.trailType);
    }
  }

  get alive(): boolean { return this._alive; }
  get x(): number { return this.circle.x; }
  get y(): number { return this.circle.y; }
  get facingRight(): boolean { return this._facingRight; }

  update(dt: number): void {
    if (!this._alive || !this.circle?.scene) return;

    const prevX = this.circle.x;
    const prevY = this.circle.y;
    this.circle.x += this.vx * dt;
    this.circle.y += this.vy * dt;
    this.worldY = this.circle.y;

    if (this.bodySprite) {
      this.bodySprite.x = this.circle.x;
      this.bodySprite.y = this.circle.y;
    }

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

    for (const trail of this.particleTrails) {
      trail.stop();
      if (this.scene?.time) {
        this.scene.time.delayedCall(300, () => {
          if (trail.scene) trail.destroy();
        });
      }
    }

    if (!this.scene?.tweens) {
      if (this.circle?.scene) this.circle.destroy();
      if (this.trail?.scene) this.trail.destroy();
      if (this.bodySprite?.scene) this.bodySprite.destroy();
      return;
    }

    const targets = [this.circle, this.trail];
    if (this.bodySprite) targets.push(this.bodySprite as unknown as Phaser.GameObjects.Arc);

    this.scene.tweens.add({
      targets,
      alpha: 0,
      scaleX: { value: "*=1.5" },
      scaleY: { value: "*=1.5" },
      duration: 100,
      onComplete: () => {
        if (this.circle?.scene) this.circle.destroy();
        if (this.trail?.scene) this.trail.destroy();
        if (this.bodySprite?.scene) this.bodySprite.destroy();
      },
    });
  }
}
