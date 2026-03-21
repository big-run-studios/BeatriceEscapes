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
