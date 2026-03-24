import Phaser from "phaser";

export const J_SHEET_KEY = "john";
export const J_FRAME_W = 256;
export const J_FRAME_H = 256;
export const J_SPRITE_SCALE = 0.39;

export function registerJohnAnims(scene: Phaser.Scene): void {
  if (scene.anims.exists("j-idle")) return;

  scene.anims.create({
    key: "j-idle",
    frames: scene.anims.generateFrameNumbers(J_SHEET_KEY, { frames: [0, 1] }),
    frameRate: 2,
    repeat: -1,
  });

  scene.anims.create({
    key: "j-run",
    frames: scene.anims.generateFrameNumbers(J_SHEET_KEY, { start: 2, end: 7 }),
    frameRate: 10,
    repeat: -1,
  });

  scene.anims.create({
    key: "j-walk",
    frames: scene.anims.generateFrameNumbers(J_SHEET_KEY, { start: 8, end: 13 }),
    frameRate: 8,
    repeat: -1,
  });

  scene.anims.create({
    key: "j-guard",
    frames: [{ key: J_SHEET_KEY, frame: 14 }],
    frameRate: 1,
  });

  scene.anims.create({
    key: "j-parry",
    frames: [{ key: J_SHEET_KEY, frame: 15 }],
    frameRate: 1,
  });

  scene.anims.create({
    key: "j-bat-jab",
    frames: scene.anims.generateFrameNumbers(J_SHEET_KEY, { start: 16, end: 19 }),
    frameRate: 14,
    repeat: 0,
  });

  scene.anims.create({
    key: "j-bat-upper",
    frames: scene.anims.generateFrameNumbers(J_SHEET_KEY, { start: 20, end: 22 }),
    frameRate: 12,
    repeat: 0,
  });

  scene.anims.create({
    key: "j-bat-lunge",
    frames: [{ key: J_SHEET_KEY, frame: 23 }],
    frameRate: 1,
  });

  scene.anims.create({
    key: "j-slingshot",
    frames: scene.anims.generateFrameNumbers(J_SHEET_KEY, { frames: [24, 25] }),
    frameRate: 8,
    repeat: 0,
  });

  scene.anims.create({
    key: "j-ground-slam",
    frames: scene.anims.generateFrameNumbers(J_SHEET_KEY, { frames: [26, 27] }),
    frameRate: 8,
    repeat: 0,
  });

  scene.anims.create({
    key: "j-dash",
    frames: [{ key: J_SHEET_KEY, frame: 28 }],
    frameRate: 1,
  });

  scene.anims.create({
    key: "j-jump",
    frames: [{ key: J_SHEET_KEY, frame: 29 }],
    frameRate: 1,
  });

  scene.anims.create({
    key: "j-air-attack",
    frames: [{ key: J_SHEET_KEY, frame: 30 }],
    frameRate: 1,
  });

  scene.anims.create({
    key: "j-grab",
    frames: [{ key: J_SHEET_KEY, frame: 31 }],
    frameRate: 1,
  });

  scene.anims.create({
    key: "j-hit",
    frames: scene.anims.generateFrameNumbers(J_SHEET_KEY, { frames: [32, 33] }),
    frameRate: 6,
    repeat: 0,
  });

  scene.anims.create({
    key: "j-knockdown",
    frames: scene.anims.generateFrameNumbers(J_SHEET_KEY, { frames: [34, 35] }),
    frameRate: 6,
    repeat: 0,
  });

  scene.anims.create({
    key: "j-recovery",
    frames: scene.anims.generateFrameNumbers(J_SHEET_KEY, { start: 36, end: 38 }),
    frameRate: 8,
    repeat: 0,
  });

  scene.anims.create({
    key: "j-ultimate",
    frames: [{ key: J_SHEET_KEY, frame: 39 }],
    frameRate: 1,
  });
}
