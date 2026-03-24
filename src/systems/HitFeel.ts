import Phaser from "phaser";
import { VFXManager } from "./VFXManager";

export class HitFeel {
  private scene: Phaser.Scene;
  readonly vfx: VFXManager;

  constructor(scene: Phaser.Scene, vfx?: VFXManager) {
    this.scene = scene;
    this.vfx = vfx ?? new VFXManager(scene);
  }

  shake(intensity: number, duration: number): void {
    this.scene.cameras.main.shake(duration, intensity / 1000);
  }

  impactFlash(x: number, y: number): void {
    this.vfx.meleeImpact(x, y);
  }

  projectileImpact(x: number, y: number, color: number): void {
    this.vfx.projectileImpact(x, y, color);
  }

  elbowDropImpact(x: number, y: number): void {
    this.vfx.landingImpact(x, y);
  }

  ultimateBlast(x: number, y: number): void {
    this.vfx.ultimateBlast(x, y);
  }

  swingArc(x: number, y: number, facingRight: boolean, heavy: boolean): void {
    this.vfx.slashTrail(x, y, facingRight, heavy);
  }
}
