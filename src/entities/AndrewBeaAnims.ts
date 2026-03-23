import Phaser from "phaser";

export const AB_SHEET_KEY = "andrew-bea";
export const AB_FRAME_W = 256;
export const AB_FRAME_H = 256;
export const AB_SPRITE_SCALE = 0.75;

export function registerAndrewBeaAnims(scene: Phaser.Scene): void {
  if (scene.anims.exists("ab-idle")) return;

  scene.anims.create({
    key: "ab-idle",
    frames: [{ key: AB_SHEET_KEY, frame: 7 }],
    frameRate: 1,
  });

  scene.anims.create({
    key: "ab-run",
    frames: scene.anims.generateFrameNumbers(AB_SHEET_KEY, { start: 0, end: 6 }),
    frameRate: 10,
    repeat: -1,
  });

  scene.anims.create({
    key: "ab-walk",
    frames: scene.anims.generateFrameNumbers(AB_SHEET_KEY, { start: 7, end: 13 }),
    frameRate: 8,
    repeat: -1,
  });

  scene.anims.create({
    key: "ab-punch",
    frames: scene.anims.generateFrameNumbers(AB_SHEET_KEY, { frames: [14, 15, 16, 18] }),
    frameRate: 12,
    repeat: 0,
  });

  scene.anims.create({
    key: "ab-cast",
    frames: scene.anims.generateFrameNumbers(AB_SHEET_KEY, { frames: [19, 20] }),
    frameRate: 6,
    repeat: 0,
  });

  scene.anims.create({
    key: "ab-hit",
    frames: [{ key: AB_SHEET_KEY, frame: 21 }],
    frameRate: 1,
  });

  scene.anims.create({
    key: "ab-knockdown",
    frames: scene.anims.generateFrameNumbers(AB_SHEET_KEY, { frames: [21, 22] }),
    frameRate: 6,
    repeat: 0,
  });

  scene.anims.create({
    key: "ab-recovery",
    frames: scene.anims.generateFrameNumbers(AB_SHEET_KEY, { frames: [23, 24, 25, 26] }),
    frameRate: 8,
    repeat: 0,
  });
}
