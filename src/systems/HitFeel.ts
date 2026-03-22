import Phaser from "phaser";

export class HitFeel {
  private scene: Phaser.Scene;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  shake(intensity: number, duration: number): void {
    this.scene.cameras.main.shake(duration, intensity / 1000);
  }

  /** Spawn a white impact flash at world position. */
  impactFlash(x: number, y: number): void {
    const flash = this.scene.add.circle(x, y, 20, 0xffffff, 0.8);
    flash.setDepth(y + 1);
    this.scene.tweens.add({
      targets: flash,
      alpha: 0,
      scaleX: 2,
      scaleY: 2,
      duration: 150,
      ease: "Power2",
      onComplete: () => flash.destroy(),
    });
  }

  /** Spawn a colored projectile impact burst at world position. */
  projectileImpact(x: number, y: number, color: number): void {
    const ring = this.scene.add.circle(x, y, 12, color, 0);
    ring.setStrokeStyle(3, color, 0.9);
    ring.setDepth(y + 2);

    const flash = this.scene.add.circle(x, y, 8, 0xffffff, 0.9);
    flash.setDepth(y + 3);

    this.scene.tweens.add({
      targets: ring,
      scaleX: 2.5,
      scaleY: 2.5,
      alpha: 0,
      duration: 200,
      ease: "Power2",
      onComplete: () => ring.destroy(),
    });
    this.scene.tweens.add({
      targets: flash,
      alpha: 0,
      scaleX: 1.8,
      scaleY: 1.8,
      duration: 120,
      ease: "Power2",
      onComplete: () => flash.destroy(),
    });
  }

  /** Elbow drop landing shockwave -- expanding ring + dust particles. */
  elbowDropImpact(x: number, y: number): void {
    const ring = this.scene.add.circle(x, y, 20, 0xffffff, 0);
    ring.setStrokeStyle(4, 0xffcc44, 0.9);
    ring.setDepth(y + 2);

    this.scene.tweens.add({
      targets: ring,
      scaleX: 5,
      scaleY: 3,
      alpha: 0,
      duration: 350,
      ease: "Power2",
      onComplete: () => ring.destroy(),
    });

    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      const dust = this.scene.add.circle(x, y, 4, 0xccaa66, 0.7);
      dust.setDepth(y + 1);
      this.scene.tweens.add({
        targets: dust,
        x: x + Math.cos(angle) * 80,
        y: y + Math.sin(angle) * 40,
        alpha: 0,
        scaleX: 0.3,
        scaleY: 0.3,
        duration: 300,
        ease: "Power2",
        onComplete: () => dust.destroy(),
      });
    }

    const flash = this.scene.add.circle(x, y, 30, 0xffffff, 0.6);
    flash.setDepth(y + 3);
    this.scene.tweens.add({
      targets: flash,
      alpha: 0,
      scaleX: 2,
      scaleY: 2,
      duration: 100,
      onComplete: () => flash.destroy(),
    });
  }

  /** Full-screen ultimate blast -- massive expanding rings, electric arcs, screen flash. */
  ultimateBlast(x: number, y: number): void {
    const overlay = this.scene.add.rectangle(
      this.scene.cameras.main.scrollX + 640,
      this.scene.cameras.main.scrollY + 360,
      1280, 720, 0xffffff, 0.8
    );
    overlay.setDepth(30000);
    overlay.setScrollFactor(0);
    this.scene.tweens.add({
      targets: overlay,
      alpha: 0,
      duration: 400,
      ease: "Power2",
      onComplete: () => overlay.destroy(),
    });

    for (let r = 0; r < 3; r++) {
      const ring = this.scene.add.circle(x, y, 30, 0xffee44, 0);
      ring.setStrokeStyle(5 - r, r === 0 ? 0xffee44 : 0x88ddff, 0.9);
      ring.setDepth(y + 10 + r);
      this.scene.tweens.add({
        targets: ring,
        scaleX: 12 + r * 3,
        scaleY: 6 + r * 1.5,
        alpha: 0,
        duration: 500 + r * 100,
        delay: r * 80,
        ease: "Power2",
        onComplete: () => ring.destroy(),
      });
    }

    const gfx = this.scene.add.graphics();
    gfx.setDepth(y + 15);
    for (let i = 0; i < 12; i++) {
      const angle = (i / 12) * Math.PI * 2;
      const len = 120 + Math.random() * 80;
      const ex = x + Math.cos(angle) * len;
      const ey = y + Math.sin(angle) * len * 0.5;
      const midX = x + Math.cos(angle) * len * 0.5 + (Math.random() - 0.5) * 40;
      const midY = y + Math.sin(angle) * len * 0.25 + (Math.random() - 0.5) * 20;
      gfx.lineStyle(2, 0x88ddff, 0.8);
      gfx.beginPath();
      gfx.moveTo(x, y);
      gfx.lineTo(midX, midY);
      gfx.lineTo(ex, ey);
      gfx.strokePath();
    }
    this.scene.tweens.add({
      targets: gfx,
      alpha: 0,
      duration: 400,
      delay: 100,
      onComplete: () => gfx.destroy(),
    });
  }

  /** Spawn a swing arc visual at world position. */
  swingArc(x: number, y: number, facingRight: boolean, heavy: boolean): void {
    const gfx = this.scene.add.graphics();
    gfx.setDepth(y + 1);

    const color = heavy ? 0xc9944a : 0x88bbdd;
    const arcWidth = heavy ? 60 : 45;
    const arcHeight = heavy ? 50 : 35;

    gfx.lineStyle(heavy ? 4 : 3, color, 0.7);

    const dir = facingRight ? 1 : -1;
    const startAngle = facingRight ? -0.8 : Math.PI - 0.8;
    const endAngle = facingRight ? 0.8 : Math.PI + 0.8;

    gfx.beginPath();
    gfx.arc(x + dir * 30, y - 10, arcWidth, startAngle, endAngle, !facingRight);
    gfx.strokePath();

    const slashLine = this.scene.add.rectangle(
      x + dir * (arcWidth / 2 + 10), y - 10,
      arcHeight, 3, color, 0.5
    );
    slashLine.setDepth(y + 1);

    this.scene.tweens.add({
      targets: [gfx, slashLine],
      alpha: 0,
      duration: 120,
      ease: "Power2",
      onComplete: () => {
        gfx.destroy();
        slashLine.destroy();
      },
    });
  }
}
