import Phaser from "phaser";

export const H_SHEET_KEY = "heather";
export const H_FRAME_W = 256;
export const H_FRAME_H = 256;
export const H_SPRITE_SCALE = 0.52;

export function registerHeatherAnims(scene: Phaser.Scene): void {
  if (scene.anims.exists("h-idle")) return;

  scene.anims.create({
    key: "h-idle",
    frames: scene.anims.generateFrameNumbers(H_SHEET_KEY, { frames: [0, 1] }),
    frameRate: 2,
    repeat: -1,
  });

  scene.anims.create({
    key: "h-run",
    frames: scene.anims.generateFrameNumbers(H_SHEET_KEY, { start: 2, end: 7 }),
    frameRate: 10,
    repeat: -1,
  });

  scene.anims.create({
    key: "h-walk",
    frames: scene.anims.generateFrameNumbers(H_SHEET_KEY, { start: 8, end: 13 }),
    frameRate: 8,
    repeat: -1,
  });

  scene.anims.create({
    key: "h-hover",
    frames: [{ key: H_SHEET_KEY, frame: 14 }],
    frameRate: 1,
  });

  scene.anims.create({
    key: "h-hover-charge",
    frames: [{ key: H_SHEET_KEY, frame: 15 }],
    frameRate: 1,
  });

  scene.anims.create({
    key: "h-staff-tap",
    frames: scene.anims.generateFrameNumbers(H_SHEET_KEY, { frames: [16, 17] }),
    frameRate: 12,
    repeat: 0,
  });

  scene.anims.create({
    key: "h-staff-thrust",
    frames: [{ key: H_SHEET_KEY, frame: 18 }],
    frameRate: 1,
  });

  scene.anims.create({
    key: "h-rising-staff",
    frames: [{ key: H_SHEET_KEY, frame: 19 }],
    frameRate: 1,
  });

  scene.anims.create({
    key: "h-low-sweep",
    frames: [{ key: H_SHEET_KEY, frame: 20 }],
    frameRate: 1,
  });

  scene.anims.create({
    key: "h-staff-slam",
    frames: [{ key: H_SHEET_KEY, frame: 21 }],
    frameRate: 1,
  });

  scene.anims.create({
    key: "h-skyward-sweep",
    frames: [{ key: H_SHEET_KEY, frame: 22 }],
    frameRate: 1,
  });

  scene.anims.create({
    key: "h-ground-strike",
    frames: [{ key: H_SHEET_KEY, frame: 23 }],
    frameRate: 1,
  });

  scene.anims.create({
    key: "h-parry",
    frames: [{ key: H_SHEET_KEY, frame: 24 }],
    frameRate: 1,
  });

  scene.anims.create({
    key: "h-parry-counter",
    frames: [{ key: H_SHEET_KEY, frame: 25 }],
    frameRate: 1,
  });

  scene.anims.create({
    key: "h-totem-charge",
    frames: [{ key: H_SHEET_KEY, frame: 26 }],
    frameRate: 1,
  });

  scene.anims.create({
    key: "h-totem-plant",
    frames: [{ key: H_SHEET_KEY, frame: 27 }],
    frameRate: 1,
  });

  scene.anims.create({
    key: "h-dash",
    frames: [{ key: H_SHEET_KEY, frame: 28 }],
    frameRate: 1,
  });

  scene.anims.create({
    key: "h-jump",
    frames: [{ key: H_SHEET_KEY, frame: 29 }],
    frameRate: 1,
  });

  scene.anims.create({
    key: "h-air-attack",
    frames: [{ key: H_SHEET_KEY, frame: 30 }],
    frameRate: 1,
  });

  scene.anims.create({
    key: "h-dash-attack",
    frames: [{ key: H_SHEET_KEY, frame: 31 }],
    frameRate: 1,
  });

  scene.anims.create({
    key: "h-hit",
    frames: scene.anims.generateFrameNumbers(H_SHEET_KEY, { frames: [32, 33] }),
    frameRate: 6,
    repeat: 0,
  });

  scene.anims.create({
    key: "h-knockdown",
    frames: scene.anims.generateFrameNumbers(H_SHEET_KEY, { frames: [34, 35] }),
    frameRate: 6,
    repeat: 0,
  });

  scene.anims.create({
    key: "h-recovery",
    frames: scene.anims.generateFrameNumbers(H_SHEET_KEY, { start: 36, end: 38 }),
    frameRate: 8,
    repeat: 0,
  });

  scene.anims.create({
    key: "h-ultimate",
    frames: [{ key: H_SHEET_KEY, frame: 39 }],
    frameRate: 1,
  });
}
