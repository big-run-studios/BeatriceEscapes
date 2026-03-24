import Phaser from "phaser";

export const LD_SHEET_KEY = "luna-dog";
export const LL_SHEET_KEY = "luna-lunar";
export const L_FRAME_W = 256;
export const L_FRAME_H = 256;
export const LD_SPRITE_SCALE = 0.29;
export const LL_SPRITE_SCALE = 0.44;

export function registerLunaAnims(scene: Phaser.Scene): void {
  if (scene.anims.exists("ld-idle")) return;

  // ── Dog Mode Animations ──

  scene.anims.create({
    key: "ld-idle",
    frames: scene.anims.generateFrameNumbers(LD_SHEET_KEY, { frames: [0, 1] }),
    frameRate: 2,
    repeat: -1,
  });

  scene.anims.create({
    key: "ld-run",
    frames: scene.anims.generateFrameNumbers(LD_SHEET_KEY, { start: 2, end: 7 }),
    frameRate: 10,
    repeat: -1,
  });

  scene.anims.create({
    key: "ld-walk",
    frames: scene.anims.generateFrameNumbers(LD_SHEET_KEY, { start: 8, end: 13 }),
    frameRate: 8,
    repeat: -1,
  });

  scene.anims.create({
    key: "ld-guard",
    frames: [{ key: LD_SHEET_KEY, frame: 14 }],
    frameRate: 1,
  });

  scene.anims.create({
    key: "ld-dash",
    frames: [{ key: LD_SHEET_KEY, frame: 15 }],
    frameRate: 1,
  });

  scene.anims.create({
    key: "ld-quick-bite",
    frames: scene.anims.generateFrameNumbers(LD_SHEET_KEY, { frames: [16, 17] }),
    frameRate: 14,
    repeat: 0,
  });

  scene.anims.create({
    key: "ld-bark-push",
    frames: [{ key: LD_SHEET_KEY, frame: 18 }],
    frameRate: 1,
  });

  scene.anims.create({
    key: "ld-dash-tackle",
    frames: [{ key: LD_SHEET_KEY, frame: 19 }],
    frameRate: 1,
  });

  scene.anims.create({
    key: "ld-pounce",
    frames: [{ key: LD_SHEET_KEY, frame: 20 }],
    frameRate: 1,
  });

  scene.anims.create({
    key: "ld-air-snap",
    frames: [{ key: LD_SHEET_KEY, frame: 21 }],
    frameRate: 1,
  });

  scene.anims.create({
    key: "ld-leaping-bite",
    frames: [{ key: LD_SHEET_KEY, frame: 22 }],
    frameRate: 1,
  });

  scene.anims.create({
    key: "ld-tail-sweep",
    frames: [{ key: LD_SHEET_KEY, frame: 23 }],
    frameRate: 1,
  });

  scene.anims.create({
    key: "ld-dig-fling",
    frames: [{ key: LD_SHEET_KEY, frame: 24 }],
    frameRate: 1,
  });

  scene.anims.create({
    key: "ld-dodge-nip",
    frames: [{ key: LD_SHEET_KEY, frame: 25 }],
    frameRate: 1,
  });

  scene.anims.create({
    key: "ld-moonrise",
    frames: [{ key: LD_SHEET_KEY, frame: 26 }],
    frameRate: 1,
  });

  scene.anims.create({
    key: "ld-jump",
    frames: [{ key: LD_SHEET_KEY, frame: 27 }],
    frameRate: 1,
  });

  scene.anims.create({
    key: "ld-air-attack",
    frames: [{ key: LD_SHEET_KEY, frame: 28 }],
    frameRate: 1,
  });

  scene.anims.create({
    key: "ld-dash-attack",
    frames: [{ key: LD_SHEET_KEY, frame: 29 }],
    frameRate: 1,
  });

  scene.anims.create({
    key: "ld-grab",
    frames: [{ key: LD_SHEET_KEY, frame: 30 }],
    frameRate: 1,
  });

  scene.anims.create({
    key: "ld-mode-flash",
    frames: [{ key: LD_SHEET_KEY, frame: 31 }],
    frameRate: 1,
  });

  scene.anims.create({
    key: "ld-hit",
    frames: scene.anims.generateFrameNumbers(LD_SHEET_KEY, { frames: [32, 33] }),
    frameRate: 6,
    repeat: 0,
  });

  scene.anims.create({
    key: "ld-knockdown",
    frames: scene.anims.generateFrameNumbers(LD_SHEET_KEY, { frames: [34, 35] }),
    frameRate: 6,
    repeat: 0,
  });

  scene.anims.create({
    key: "ld-recovery",
    frames: scene.anims.generateFrameNumbers(LD_SHEET_KEY, { start: 36, end: 38 }),
    frameRate: 8,
    repeat: 0,
  });

  scene.anims.create({
    key: "ld-ultimate",
    frames: [{ key: LD_SHEET_KEY, frame: 39 }],
    frameRate: 1,
  });

  // ── Lunar Mode Animations ──

  scene.anims.create({
    key: "ll-idle",
    frames: scene.anims.generateFrameNumbers(LL_SHEET_KEY, { frames: [0, 1] }),
    frameRate: 2,
    repeat: -1,
  });

  scene.anims.create({
    key: "ll-run",
    frames: scene.anims.generateFrameNumbers(LL_SHEET_KEY, { start: 2, end: 7 }),
    frameRate: 10,
    repeat: -1,
  });

  scene.anims.create({
    key: "ll-walk",
    frames: scene.anims.generateFrameNumbers(LL_SHEET_KEY, { start: 8, end: 13 }),
    frameRate: 8,
    repeat: -1,
  });

  scene.anims.create({
    key: "ll-guard",
    frames: [{ key: LL_SHEET_KEY, frame: 14 }],
    frameRate: 1,
  });

  scene.anims.create({
    key: "ll-dash",
    frames: [{ key: LL_SHEET_KEY, frame: 15 }],
    frameRate: 1,
  });

  scene.anims.create({
    key: "ll-claw-swipe",
    frames: scene.anims.generateFrameNumbers(LL_SHEET_KEY, { frames: [16, 17] }),
    frameRate: 14,
    repeat: 0,
  });

  scene.anims.create({
    key: "ll-heavy-slam",
    frames: [{ key: LL_SHEET_KEY, frame: 18 }],
    frameRate: 1,
  });

  scene.anims.create({
    key: "ll-rushing-claws",
    frames: [{ key: LL_SHEET_KEY, frame: 19 }],
    frameRate: 1,
  });

  scene.anims.create({
    key: "ll-lunging-upper",
    frames: [{ key: LL_SHEET_KEY, frame: 20 }],
    frameRate: 1,
  });

  scene.anims.create({
    key: "ll-rising-slash",
    frames: [{ key: LL_SHEET_KEY, frame: 21 }],
    frameRate: 1,
  });

  scene.anims.create({
    key: "ll-sky-crash",
    frames: [{ key: LL_SHEET_KEY, frame: 22 }],
    frameRate: 1,
  });

  scene.anims.create({
    key: "ll-low-sweep",
    frames: [{ key: LL_SHEET_KEY, frame: 23 }],
    frameRate: 1,
  });

  scene.anims.create({
    key: "ll-ground-pound",
    frames: [{ key: LL_SHEET_KEY, frame: 24 }],
    frameRate: 1,
  });

  scene.anims.create({
    key: "ll-counter-slash",
    frames: [{ key: LL_SHEET_KEY, frame: 25 }],
    frameRate: 1,
  });

  scene.anims.create({
    key: "ll-revert-burst",
    frames: [{ key: LL_SHEET_KEY, frame: 26 }],
    frameRate: 1,
  });

  scene.anims.create({
    key: "ll-jump",
    frames: [{ key: LL_SHEET_KEY, frame: 27 }],
    frameRate: 1,
  });

  scene.anims.create({
    key: "ll-air-attack",
    frames: [{ key: LL_SHEET_KEY, frame: 28 }],
    frameRate: 1,
  });

  scene.anims.create({
    key: "ll-dash-attack",
    frames: [{ key: LL_SHEET_KEY, frame: 29 }],
    frameRate: 1,
  });

  scene.anims.create({
    key: "ll-frenzy",
    frames: scene.anims.generateFrameNumbers(LL_SHEET_KEY, { frames: [30, 31] }),
    frameRate: 12,
    repeat: -1,
  });

  scene.anims.create({
    key: "ll-hit",
    frames: scene.anims.generateFrameNumbers(LL_SHEET_KEY, { frames: [32, 33] }),
    frameRate: 6,
    repeat: 0,
  });

  scene.anims.create({
    key: "ll-knockdown",
    frames: scene.anims.generateFrameNumbers(LL_SHEET_KEY, { frames: [34, 35] }),
    frameRate: 6,
    repeat: 0,
  });

  scene.anims.create({
    key: "ll-recovery",
    frames: scene.anims.generateFrameNumbers(LL_SHEET_KEY, { start: 36, end: 38 }),
    frameRate: 8,
    repeat: 0,
  });

  scene.anims.create({
    key: "ll-ultimate",
    frames: [{ key: LL_SHEET_KEY, frame: 39 }],
    frameRate: 1,
  });
}
