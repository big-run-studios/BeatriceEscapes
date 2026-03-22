import Phaser from "phaser";
import { COLORS, PICKUP } from "../config/game";

export type SnackType = "goldfish" | "juice" | "fruitSnack" | "apple" | "cheese";

const SNACK_DATA: Record<SnackType, { color: number; label: string; w: number; h: number }> = {
  goldfish:   { color: COLORS.pickupGoldfish,   label: "Goldfish",      w: 16, h: 10 },
  juice:      { color: COLORS.pickupJuice,      label: "Juice Box",     w: 10, h: 16 },
  fruitSnack: { color: COLORS.pickupFruitSnack, label: "Fruit Snacks",  w: 14, h: 10 },
  apple:      { color: COLORS.pickupApple,      label: "Apple Slices",  w: 14, h: 12 },
  cheese:     { color: COLORS.pickupCheese,     label: "String Cheese", w: 6,  h: 18 },
};

const ALL_SNACKS: SnackType[] = ["goldfish", "juice", "fruitSnack", "apple", "cheese"];

export class Pickup {
  readonly container: Phaser.GameObjects.Container;
  private scene: Phaser.Scene;
  private timer = 0;
  private alive = true;
  private baseY: number;
  readonly healAmount = PICKUP.healAmount;

  constructor(scene: Phaser.Scene, x: number, y: number, type?: SnackType) {
    this.scene = scene;
    this.baseY = y;

    const snack = type ?? ALL_SNACKS[Math.floor(Math.random() * ALL_SNACKS.length)];
    const data = SNACK_DATA[snack];

    const shape = scene.add.rectangle(0, 0, data.w, data.h, data.color);
    shape.setStrokeStyle(1, 0xffffff, 0.5);

    const label = scene.add.text(0, data.h / 2 + 6, data.label, {
      fontFamily: "monospace", fontSize: "7px", color: "#cccccc",
    });
    label.setOrigin(0.5, 0);

    const glow = scene.add.ellipse(0, 0, data.w + 8, data.h + 8, data.color, 0.2);

    this.container = scene.add.container(x, y, [glow, shape, label]);
    this.container.setDepth(y - 1);

    this.container.setAlpha(0);
    this.container.setScale(0.5);
    scene.tweens.add({
      targets: this.container,
      alpha: 1, scaleX: 1, scaleY: 1,
      duration: 300, ease: "Back.easeOut",
    });
  }

  get x(): number { return this.container.x; }
  get y(): number { return this.baseY; }
  get isAlive(): boolean { return this.alive; }

  update(dt: number): void {
    if (!this.alive) return;
    this.timer += dt;

    this.container.y = this.baseY + Math.sin(this.timer * PICKUP.bobSpeed) * PICKUP.bobAmount;

    if (this.timer >= PICKUP.despawnTime - 2) {
      const flash = Math.sin(this.timer * 10) > 0;
      this.container.setAlpha(flash ? 1 : 0.3);
    }

    if (this.timer >= PICKUP.despawnTime) {
      this.collect(false);
    }
  }

  collect(showVFX: boolean): void {
    if (!this.alive) return;
    this.alive = false;

    if (showVFX) {
      for (let i = 0; i < 6; i++) {
        const sparkle = this.scene.add.circle(
          this.container.x + (Math.random() - 0.5) * 20,
          this.container.y + (Math.random() - 0.5) * 20,
          2, 0xffffff, 0.9
        );
        sparkle.setDepth(this.container.y + 5);
        this.scene.tweens.add({
          targets: sparkle,
          y: sparkle.y - 20 - Math.random() * 20,
          alpha: 0, duration: 300 + Math.random() * 200,
          onComplete: () => sparkle.destroy(),
        });
      }
    }

    this.scene.tweens.add({
      targets: this.container,
      alpha: 0, scaleX: 1.5, scaleY: 1.5,
      duration: 200,
      onComplete: () => this.container.destroy(),
    });
  }

  static randomType(): SnackType {
    return ALL_SNACKS[Math.floor(Math.random() * ALL_SNACKS.length)];
  }
}
