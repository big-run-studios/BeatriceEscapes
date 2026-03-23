import Phaser from "phaser";
import { TOTEM_CONFIG, TotemType } from "../config/game";
import { BoonState } from "../systems/BoonState";
import { ProjectileSpawnRequest } from "./Player";

export class Totem {
  readonly type: TotemType;
  readonly container: Phaser.GameObjects.Container;

  hp: number;
  lifetime: number;
  isAlive = true;

  private scene: Phaser.Scene;
  private boonState: BoonState | null;

  private stake: Phaser.GameObjects.Rectangle;
  private crystal: Phaser.GameObjects.Ellipse;
  private aura: Phaser.GameObjects.Ellipse;
  private timerText: Phaser.GameObjects.Text;
  private auraPulsePhase = 0;

  private healTimer = 0;
  private fireTimer = 0;
  private pendingProjectiles: ProjectileSpawnRequest[] = [];

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    type: TotemType,
    boonState: BoonState | null,
  ) {
    this.scene = scene;
    this.type = type;
    this.boonState = boonState;
    this.hp = TOTEM_CONFIG.hp;
    this.lifetime = TOTEM_CONFIG.duration;

    const cfg = TOTEM_CONFIG[type];
    const color = cfg.color;
    const glowColor = cfg.glowColor;

    this.stake = scene.add.rectangle(0, 4, TOTEM_CONFIG.width * 0.6, TOTEM_CONFIG.height, 0x665544);
    this.stake.setStrokeStyle(1, 0x887766);

    this.crystal = scene.add.ellipse(0, -TOTEM_CONFIG.height / 2 - 4, 14, 14, color);
    this.crystal.setStrokeStyle(2, glowColor);

    this.aura = scene.add.ellipse(0, 10, TOTEM_CONFIG.radius * 2, TOTEM_CONFIG.radius * 0.6, color, 0.08);
    this.aura.setStrokeStyle(1, glowColor);

    this.timerText = scene.add.text(0, -TOTEM_CONFIG.height / 2 - 22, "", {
      fontFamily: "monospace", fontSize: "9px", fontStyle: "bold",
      color: "#ffffff", stroke: "#000000", strokeThickness: 2,
    });
    this.timerText.setOrigin(0.5);

    this.container = scene.add.container(x, y, [
      this.aura, this.stake, this.crystal, this.timerText,
    ]);
    this.container.setDepth(y - 1);

    this.spawnFlash(color);
  }

  get x(): number { return this.container.x; }
  get y(): number { return this.container.y; }

  private spawnFlash(color: number): void {
    const flash = this.scene.add.circle(this.container.x, this.container.y - 10, 20, color, 0.6);
    flash.setDepth(this.container.y + 50);
    this.scene.tweens.add({
      targets: flash,
      alpha: 0, scaleX: 2.5, scaleY: 2.5,
      duration: 250,
      onComplete: () => flash.destroy(),
    });
  }

  update(dt: number): void {
    if (!this.isAlive) return;

    this.lifetime -= dt;
    const secs = Math.ceil(this.lifetime);
    this.timerText.setText(`${secs}s`);
    this.timerText.setColor(this.lifetime < 3 ? "#ff4444" : "#ffffff");

    if (this.lifetime <= 0) {
      this.destroy();
      return;
    }

    this.auraPulsePhase += dt * 3;
    const pulse = 1 + Math.sin(this.auraPulsePhase) * 0.08;
    this.aura.setScale(pulse, pulse);
    this.crystal.setAlpha(0.7 + Math.sin(this.auraPulsePhase * 1.5) * 0.3);

    switch (this.type) {
      case "ward": this.updateWard(dt); break;
      case "fury": this.updateFury(dt); break;
    }
  }

  private updateWard(dt: number): void {
    this.healTimer += dt;
  }

  getWardHealTick(): number {
    if (this.type !== "ward" || this.healTimer > 0.05) return 0;
    const base = TOTEM_CONFIG.ward.healPerSec;
    return this.boonState ? this.boonState.getStat("healBonus", base) : base;
  }

  shouldWardHeal(): boolean {
    if (this.type !== "ward") return false;
    if (this.healTimer >= 1.0) {
      this.healTimer -= 1.0;
      return true;
    }
    return false;
  }

  private updateFury(dt: number): void {
    this.fireTimer += dt;
  }

  shouldFuryFire(): boolean {
    if (this.type !== "fury") return false;
    if (this.fireTimer >= TOTEM_CONFIG.fury.fireInterval) {
      this.fireTimer -= TOTEM_CONFIG.fury.fireInterval;
      return true;
    }
    return false;
  }

  getFuryDamage(): number {
    const base = TOTEM_CONFIG.fury.fireDamage;
    return this.boonState ? this.boonState.getStat("damage", base) : base;
  }

  drainProjectileRequests(): ProjectileSpawnRequest[] {
    const reqs = this.pendingProjectiles;
    this.pendingProjectiles = [];
    return reqs;
  }

  takeHit(damage: number): void {
    if (!this.isAlive) return;
    this.hp -= damage;

    this.crystal.setFillStyle(0xffffff);
    this.scene.time.delayedCall(60, () => {
      if (this.isAlive) {
        this.crystal.setFillStyle(TOTEM_CONFIG[this.type].color);
      }
    });

    if (this.hp <= 0) {
      this.destroy();
    }
  }

  detonate(): number {
    if (!this.isAlive) return 0;
    const dmg = this.boonState
      ? this.boonState.getStat("damage", TOTEM_CONFIG.detonateDamage)
      : TOTEM_CONFIG.detonateDamage;

    const cfg = TOTEM_CONFIG[this.type];
    const burst = this.scene.add.circle(
      this.container.x, this.container.y,
      TOTEM_CONFIG.detonateRadius * 0.3, cfg.color, 0.5,
    );
    burst.setDepth(this.container.y + 100);
    burst.setStrokeStyle(3, cfg.glowColor);
    this.scene.tweens.add({
      targets: burst,
      scaleX: 3, scaleY: 2, alpha: 0,
      duration: 300,
      onComplete: () => burst.destroy(),
    });

    this.destroy();
    return dmg;
  }

  isInRange(px: number, py: number): boolean {
    const dx = Math.abs(this.container.x - px);
    const dy = Math.abs(this.container.y - py);
    return dx < TOTEM_CONFIG.radius && dy < TOTEM_CONFIG.radius * 0.3;
  }

  private destroy(): void {
    this.isAlive = false;
    this.scene.tweens.add({
      targets: this.container,
      alpha: 0, scaleY: 0.2,
      duration: 200,
      onComplete: () => this.container.destroy(),
    });
  }
}
