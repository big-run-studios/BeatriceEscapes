import Phaser from "phaser";
import type { TrailType } from "../entities/Projectile";

// ── Spritesheet config ──

export const VFX_SHEET_KEY = "vfx-combat";
export const VFX_FRAME_W = 256;
export const VFX_FRAME_H = 256;

/** Frame indices in the 5x2 spritesheet */
const F = {
  IMPACT_STAR: 0,
  SLASH_ARC: 1,
  DUST_CLOUD: 2,
  MAGIC_ORB: 3,
  ENERGY_BURST: 4,
  SPEED_LINES: 5,
  RING: 6,
  SPARK_GLINT: 7,
  POP_STAR: 8,
  SMOKE_WISP: 9,
} as const;

// Scale factor: art frames are 256px, target ~40-60px on screen
const S = 1 / 4;

type Emitter = Phaser.GameObjects.Particles.ParticleEmitter;

// ── VFXManager ──

export class VFXManager {
  private scene: Phaser.Scene;

  private impactSparks!: Emitter;
  private impactGlow!: Emitter;
  private dustPuff!: Emitter;
  private slashR!: Emitter;
  private slashL!: Emitter;
  private magicGlow!: Emitter;
  private smokePuff!: Emitter;
  private ringWave!: Emitter;
  private speedR!: Emitter;
  private speedL!: Emitter;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.createEmitters();
  }

  // ── Emitter creation ──

  private createEmitters(): void {
    const sc = this.scene;
    const tex = VFX_SHEET_KEY;

    this.impactSparks = sc.add.particles(0, 0, tex, {
      frame: [F.IMPACT_STAR, F.POP_STAR],
      lifespan: 300,
      speed: { min: 60, max: 180 },
      angle: { min: 0, max: 360 },
      scale: { start: 0.6 * S, end: 0 },
      alpha: { start: 1, end: 0 },
      rotate: { min: 0, max: 360 },
      emitting: false,
    });

    this.impactGlow = sc.add.particles(0, 0, tex, {
      frame: F.SPARK_GLINT,
      lifespan: 250,
      speed: { min: 10, max: 40 },
      angle: { min: 0, max: 360 },
      scale: { start: 0.8 * S, end: 0.05 * S },
      alpha: { start: 0.9, end: 0 },
      blendMode: Phaser.BlendModes.ADD,
      emitting: false,
    });

    this.dustPuff = sc.add.particles(0, 0, tex, {
      frame: F.DUST_CLOUD,
      lifespan: 450,
      speed: { min: 25, max: 70 },
      angle: { min: 0, max: 360 },
      scale: { start: 0.3 * S, end: 0.7 * S },
      alpha: { start: 0.7, end: 0 },
      gravityY: 50,
      rotate: { min: 0, max: 360 },
      emitting: false,
    });

    this.slashR = sc.add.particles(0, 0, tex, {
      frame: F.SLASH_ARC,
      lifespan: 200,
      speed: { min: 30, max: 80 },
      scaleX: { start: 0.7 * S, end: 0.15 * S },
      scaleY: { start: 0.7 * S, end: 0.15 * S },
      alpha: { start: 0.9, end: 0 },
      blendMode: Phaser.BlendModes.ADD,
      emitting: false,
    });

    this.slashL = sc.add.particles(0, 0, tex, {
      frame: F.SLASH_ARC,
      lifespan: 200,
      speed: { min: 30, max: 80 },
      scaleX: { start: -0.7 * S, end: -0.15 * S },
      scaleY: { start: 0.7 * S, end: 0.15 * S },
      alpha: { start: 0.9, end: 0 },
      blendMode: Phaser.BlendModes.ADD,
      emitting: false,
    });

    this.magicGlow = sc.add.particles(0, 0, tex, {
      frame: [F.MAGIC_ORB, F.ENERGY_BURST],
      lifespan: 350,
      speed: { min: 50, max: 150 },
      angle: { min: 0, max: 360 },
      scale: { start: 0.5 * S, end: 0 },
      alpha: { start: 0.9, end: 0 },
      rotate: { min: 0, max: 360 },
      blendMode: Phaser.BlendModes.ADD,
      emitting: false,
    });

    this.smokePuff = sc.add.particles(0, 0, tex, {
      frame: F.SMOKE_WISP,
      lifespan: 550,
      speed: { min: 8, max: 25 },
      angle: { min: 240, max: 300 },
      scale: { start: 0.25 * S, end: 0.65 * S },
      alpha: { start: 0.5, end: 0 },
      gravityY: -30,
      rotate: { min: 0, max: 360 },
      emitting: false,
    });

    this.ringWave = sc.add.particles(0, 0, tex, {
      frame: F.RING,
      lifespan: 450,
      speed: 0,
      scale: { start: 0.15 * S, end: 2.5 * S },
      alpha: { start: 0.9, end: 0 },
      blendMode: Phaser.BlendModes.ADD,
      emitting: false,
    });

    this.speedR = sc.add.particles(0, 0, tex, {
      frame: F.SPEED_LINES,
      lifespan: 300,
      speed: { min: 5, max: 20 },
      scale: { start: 0.5 * S, end: 0.1 * S },
      alpha: { start: 0.6, end: 0 },
      emitting: false,
    });

    this.speedL = sc.add.particles(0, 0, tex, {
      frame: F.SPEED_LINES,
      lifespan: 300,
      speed: { min: 5, max: 20 },
      scaleX: { start: -0.5 * S, end: -0.1 * S },
      scaleY: { start: 0.5 * S, end: 0.1 * S },
      alpha: { start: 0.6, end: 0 },
      emitting: false,
    });

    const all = [
      this.impactSparks, this.impactGlow, this.dustPuff,
      this.slashR, this.slashL, this.magicGlow, this.smokePuff,
      this.ringWave, this.speedR, this.speedL,
    ];
    for (const e of all) e.setDepth(9000);
  }

  // ── Public API: Bursts ──

  meleeImpact(x: number, y: number): void {
    this.impactGlow.setDepth(y + 2);
    this.impactGlow.explode(3, x, y);
    this.impactSparks.setDepth(y + 3);
    this.impactSparks.explode(5, x, y);
  }

  slashTrail(x: number, y: number, facingRight: boolean, heavy: boolean): void {
    const dir = facingRight ? 1 : -1;
    const count = heavy ? 6 : 4;
    const cx = x + dir * 30;
    const cy = y - 10;
    const emitter = facingRight ? this.slashR : this.slashL;

    emitter.setDepth(y + 1);
    for (let i = 0; i < count; i++) {
      const a = (facingRight ? -0.8 : Math.PI - 0.8) + (i / count) * 1.6;
      const r = heavy ? 55 : 40;
      const px = cx + Math.cos(a) * r;
      const py = cy + Math.sin(a) * r;
      emitter.explode(1, px, py);
    }
  }

  projectileImpact(x: number, y: number, color: number): void {
    this.magicGlow.setDepth(y + 2);
    this.magicGlow.setParticleTint(color);
    this.magicGlow.explode(6, x, y);

    this.ringWave.setDepth(y + 3);
    this.ringWave.setParticleTint(color);
    this.ringWave.explode(1, x, y);

    this.impactGlow.setDepth(y + 4);
    this.impactGlow.explode(2, x, y);
  }

  dashDust(x: number, y: number, facingRight = true): void {
    this.dustPuff.setDepth(y + 1);
    this.dustPuff.explode(3, x, y);
    const spd = facingRight ? this.speedR : this.speedL;
    spd.setDepth(y + 1);
    spd.explode(2, x, y);
  }

  landingImpact(x: number, y: number): void {
    this.ringWave.setDepth(y + 2);
    this.ringWave.setParticleTint(0xffcc44);
    this.ringWave.explode(1, x, y);

    this.dustPuff.setDepth(y + 1);
    this.dustPuff.explode(8, x, y);

    this.impactGlow.setDepth(y + 3);
    this.impactGlow.explode(2, x, y);
  }

  ultimateBlast(x: number, y: number): void {
    const cam = this.scene.cameras.main;
    const overlay = this.scene.add.rectangle(
      cam.scrollX + cam.width / 2,
      cam.scrollY + cam.height / 2,
      cam.width, cam.height, 0xffffff, 0.8,
    );
    overlay.setDepth(30000);
    overlay.setScrollFactor(0);
    this.scene.tweens.add({
      targets: overlay, alpha: 0, duration: 400,
      ease: "Power2", onComplete: () => overlay.destroy(),
    });

    this.impactSparks.setDepth(y + 10);
    this.impactSparks.setParticleTint(0xffee44);
    this.impactSparks.explode(16, x, y);

    this.magicGlow.setDepth(y + 11);
    this.magicGlow.setParticleTint(0x88ddff);
    this.magicGlow.explode(12, x, y);

    for (let r = 0; r < 3; r++) {
      this.scene.time.delayedCall(r * 80, () => {
        this.ringWave.setDepth(y + 12 + r);
        this.ringWave.setParticleTint(r === 0 ? 0xffee44 : 0x88ddff);
        this.ringWave.explode(1, x, y);
      });
    }
  }

  deathBurst(x: number, y: number, color: number): void {
    this.impactSparks.setDepth(y + 5);
    this.impactSparks.setParticleTint(color);
    this.impactSparks.explode(6, x, y);

    this.smokePuff.setDepth(y + 4);
    this.smokePuff.explode(3, x, y);
  }

  knockdownDust(x: number, y: number): void {
    this.dustPuff.setDepth(y + 1);
    this.dustPuff.explode(5, x, y);
  }

  magicSparkle(x: number, y: number, color: number, count = 2): void {
    this.magicGlow.setDepth(y + 1);
    this.magicGlow.setParticleTint(color);
    this.magicGlow.explode(count, x, y);
  }

  flashBurst(x: number, y: number, color: number, count = 4): void {
    this.impactGlow.setDepth(y + 2);
    this.impactGlow.setParticleTint(color);
    this.impactGlow.explode(count, x, y);
  }

  // ── Floating damage numbers (from health-bar-plugin pattern) ──

  damageNumber(x: number, y: number, amount: number, color = 0xffffff, isCrit = false): void {
    const label = isCrit ? `CRIT ${amount}` : `${amount}`;
    const fontSize = isCrit ? "18px" : "14px";
    const text = this.scene.add.text(x, y, label, {
      fontFamily: "monospace",
      fontSize,
      color: `#${color.toString(16).padStart(6, "0")}`,
      stroke: "#000000",
      strokeThickness: 3,
      fontStyle: isCrit ? "bold" : "normal",
    });
    text.setOrigin(0.5, 1);
    text.setDepth(y + 100);

    const offsetX = (Math.random() - 0.5) * 30;
    this.scene.tweens.add({
      targets: text,
      y: y - 40 - Math.random() * 20,
      x: x + offsetX,
      alpha: 0,
      scale: isCrit ? 1.3 : 1,
      duration: isCrit ? 900 : 700,
      ease: "Power2",
      onComplete: () => text.destroy(),
    });
  }

  healNumber(x: number, y: number, amount: number): void {
    this.damageNumber(x, y, amount, 0x44ff44);
  }

  statusText(x: number, y: number, label: string, color = 0xffcc44): void {
    const text = this.scene.add.text(x, y, label, {
      fontFamily: "monospace",
      fontSize: "12px",
      color: `#${color.toString(16).padStart(6, "0")}`,
      stroke: "#000000",
      strokeThickness: 2,
    });
    text.setOrigin(0.5, 1);
    text.setDepth(y + 100);

    this.scene.tweens.add({
      targets: text,
      y: y - 30,
      alpha: 0,
      duration: 600,
      ease: "Power2",
      onComplete: () => text.destroy(),
    });
  }

  // ── Trail factories (caller owns lifecycle) ──

  createProjectileTrail(
    follow: Phaser.GameObjects.Arc,
    color: number,
    type?: TrailType,
  ): Emitter[] {
    const sc = this.scene;
    const tex = VFX_SHEET_KEY;
    const d = follow.depth - 0.5;
    const emitters: Emitter[] = [];

    const add = (cfg: Phaser.Types.GameObjects.Particles.ParticleEmitterConfig): Emitter => {
      const e = sc.add.particles(0, 0, tex, { follow, ...cfg });
      e.setDepth(d);
      emitters.push(e);
      return e;
    };

    switch (type) {
      case "wind":
        add({
          frame: F.MAGIC_ORB,
          lifespan: 200, speed: { min: 10, max: 25 },
          angle: { min: 0, max: 360 },
          scale: { start: 0.15 * S, end: 0 },
          alpha: { start: 0.5, end: 0 },
          frequency: 40, tint: color,
          blendMode: Phaser.BlendModes.ADD,
        });
        break;

      case "wind-heavy":
        add({
          frame: [F.MAGIC_ORB, F.ENERGY_BURST],
          lifespan: 300, speed: { min: 15, max: 35 },
          angle: { min: 0, max: 360 },
          scale: { start: 0.3 * S, end: 0 },
          alpha: { start: 0.7, end: 0 },
          frequency: 25, tint: color,
          rotate: { min: 0, max: 360 },
          blendMode: Phaser.BlendModes.ADD,
        });
        break;

      case "blast":
        add({
          frame: [F.ENERGY_BURST, F.RING],
          lifespan: 350, speed: { min: 20, max: 40 },
          angle: { min: 0, max: 360 },
          scale: { start: 0.4 * S, end: 0.05 * S },
          alpha: { start: 0.8, end: 0 },
          frequency: 20, tint: color,
          rotate: { min: 0, max: 360 },
          blendMode: Phaser.BlendModes.ADD,
        });
        break;

      case "bea":
        add({
          frame: F.POP_STAR,
          lifespan: 250, speed: { min: 15, max: 40 },
          angle: { min: 0, max: 360 },
          scale: { start: 0.25 * S, end: 0 },
          alpha: { start: 0.7, end: 0 },
          frequency: 30, tint: color,
          rotate: { min: 0, max: 360 },
          blendMode: Phaser.BlendModes.ADD,
        });
        break;

      case "sling":
        add({
          frame: F.DUST_CLOUD,
          lifespan: 180, speed: { min: 5, max: 15 },
          angle: { min: 0, max: 360 },
          scale: { start: 0.08 * S, end: 0.15 * S },
          alpha: { start: 0.4, end: 0 },
          frequency: 60, tint: color,
          blendMode: Phaser.BlendModes.NORMAL,
        });
        break;

      case "marble":
        add({
          frame: F.RING,
          lifespan: 250, speed: { min: 2, max: 8 },
          angle: { min: 0, max: 360 },
          scale: { start: 0.08 * S, end: 0.25 * S },
          alpha: { start: 0.6, end: 0 },
          frequency: 80, tint: color,
          blendMode: Phaser.BlendModes.ADD,
        });
        break;

      case "rocket":
        add({
          frame: F.SMOKE_WISP,
          lifespan: 400, speed: { min: 5, max: 20 },
          angle: { min: 0, max: 360 },
          scale: { start: 0.1 * S, end: 0.3 * S },
          alpha: { start: 0.5, end: 0 },
          frequency: 30, tint: 0x888888,
          gravityY: -20,
          blendMode: Phaser.BlendModes.NORMAL,
        });
        add({
          frame: F.SPARK_GLINT,
          lifespan: 200, speed: { min: 20, max: 50 },
          angle: { min: 0, max: 360 },
          scale: { start: 0.15 * S, end: 0 },
          alpha: { start: 0.8, end: 0 },
          frequency: 45, tint: color,
          blendMode: Phaser.BlendModes.ADD,
        });
        break;

      case "fire":
        add({
          frame: F.ENERGY_BURST,
          lifespan: 250, speed: { min: 15, max: 35 },
          angle: { min: 0, max: 360 },
          scale: { start: 0.25 * S, end: 0 },
          alpha: { start: 0.8, end: 0 },
          frequency: 20, tint: color,
          blendMode: Phaser.BlendModes.ADD,
        });
        add({
          frame: F.SMOKE_WISP,
          lifespan: 350, speed: { min: 5, max: 15 },
          angle: { min: 240, max: 300 },
          scale: { start: 0.1 * S, end: 0.2 * S },
          alpha: { start: 0.35, end: 0 },
          frequency: 40, tint: 0x444444,
          gravityY: -25,
          blendMode: Phaser.BlendModes.NORMAL,
        });
        break;

      case "spark":
        add({
          frame: F.SPARK_GLINT,
          lifespan: 150, speed: { min: 20, max: 50 },
          angle: { min: 0, max: 360 },
          scale: { start: 0.2 * S, end: 0 },
          alpha: { start: 0.9, end: 0 },
          frequency: 15, tint: color,
          blendMode: Phaser.BlendModes.ADD,
        });
        break;

      case "net":
        add({
          frame: F.DUST_CLOUD,
          lifespan: 350, speed: { min: 5, max: 15 },
          angle: { min: 0, max: 360 },
          scale: { start: 0.15 * S, end: 0.3 * S },
          alpha: { start: 0.5, end: 0 },
          frequency: 50, tint: color,
          blendMode: Phaser.BlendModes.NORMAL,
        });
        break;

      case "enemy":
      default:
        add({
          frame: F.SPARK_GLINT,
          lifespan: 280, speed: { min: 5, max: 15 },
          angle: { min: 0, max: 360 },
          scale: { start: 0.3 * S, end: 0 },
          alpha: { start: 0.6, end: 0 },
          frequency: 35, tint: color,
          blendMode: Phaser.BlendModes.ADD,
        });
        break;
    }

    return emitters;
  }
}
