import Phaser from "phaser";
import { registerInterpAnims } from "../systems/AnimInterp";

export const LD_SHEET_KEY = "luna-dog";
export const LL_SHEET_KEY = "luna-lunar";
export const L_FRAME_W = 256;
export const L_FRAME_H = 256;
export const LD_SPRITE_SCALE = 0.39;
export const LL_SPRITE_SCALE = 0.59;

export function registerLunaAnims(scene: Phaser.Scene): void {
  if (scene.anims.exists("ld-idle")) return;

  // ── Dog Mode: single-frame poses ──

  scene.anims.create({ key: "ld-guard",       frames: [{ key: LD_SHEET_KEY, frame: 14 }], frameRate: 1 });
  scene.anims.create({ key: "ld-dash",        frames: [{ key: LD_SHEET_KEY, frame: 15 }], frameRate: 1 });
  scene.anims.create({ key: "ld-bark-push",   frames: [{ key: LD_SHEET_KEY, frame: 18 }], frameRate: 1 });
  scene.anims.create({ key: "ld-dash-tackle", frames: [{ key: LD_SHEET_KEY, frame: 19 }], frameRate: 1 });
  scene.anims.create({ key: "ld-pounce",      frames: [{ key: LD_SHEET_KEY, frame: 20 }], frameRate: 1 });
  scene.anims.create({ key: "ld-air-snap",    frames: [{ key: LD_SHEET_KEY, frame: 21 }], frameRate: 1 });
  scene.anims.create({ key: "ld-leaping-bite",frames: [{ key: LD_SHEET_KEY, frame: 22 }], frameRate: 1 });
  scene.anims.create({ key: "ld-tail-sweep",  frames: [{ key: LD_SHEET_KEY, frame: 23 }], frameRate: 1 });
  scene.anims.create({ key: "ld-dig-fling",   frames: [{ key: LD_SHEET_KEY, frame: 24 }], frameRate: 1 });
  scene.anims.create({ key: "ld-dodge-nip",   frames: [{ key: LD_SHEET_KEY, frame: 25 }], frameRate: 1 });
  scene.anims.create({ key: "ld-moonrise",    frames: [{ key: LD_SHEET_KEY, frame: 26 }], frameRate: 1 });
  scene.anims.create({ key: "ld-jump",        frames: [{ key: LD_SHEET_KEY, frame: 27 }], frameRate: 1 });
  scene.anims.create({ key: "ld-air-attack",  frames: [{ key: LD_SHEET_KEY, frame: 28 }], frameRate: 1 });
  scene.anims.create({ key: "ld-dash-attack", frames: [{ key: LD_SHEET_KEY, frame: 29 }], frameRate: 1 });
  scene.anims.create({ key: "ld-grab",        frames: [{ key: LD_SHEET_KEY, frame: 30 }], frameRate: 1 });
  scene.anims.create({ key: "ld-mode-flash",  frames: [{ key: LD_SHEET_KEY, frame: 31 }], frameRate: 1 });
  scene.anims.create({ key: "ld-ultimate",    frames: [{ key: LD_SHEET_KEY, frame: 39 }], frameRate: 1 });

  registerInterpAnims(scene, LD_SHEET_KEY, L_FRAME_W, L_FRAME_H, [
    { key: "ld-idle",       frames: [0, 1],                    frameRate: 2,  repeat: -1, loop: true },
    { key: "ld-run",        frames: [2, 3, 4, 5, 6, 7],       frameRate: 10, repeat: -1, loop: true },
    { key: "ld-walk",       frames: [8, 9, 10, 11, 12, 13],   frameRate: 8,  repeat: -1, loop: true },
    { key: "ld-quick-bite", frames: [16, 17],                  frameRate: 14, repeat: 0 },
    { key: "ld-hit",        frames: [32, 33],                  frameRate: 6,  repeat: 0 },
    { key: "ld-knockdown",  frames: [34, 35],                  frameRate: 6,  repeat: 0 },
    { key: "ld-recovery",   frames: [36, 37, 38],              frameRate: 8,  repeat: 0 },
  ]);

  // ── Lunar Mode: single-frame poses ──

  scene.anims.create({ key: "ll-guard",        frames: [{ key: LL_SHEET_KEY, frame: 14 }], frameRate: 1 });
  scene.anims.create({ key: "ll-dash",         frames: [{ key: LL_SHEET_KEY, frame: 15 }], frameRate: 1 });
  scene.anims.create({ key: "ll-heavy-slam",   frames: [{ key: LL_SHEET_KEY, frame: 18 }], frameRate: 1 });
  scene.anims.create({ key: "ll-rushing-claws",frames: [{ key: LL_SHEET_KEY, frame: 19 }], frameRate: 1 });
  scene.anims.create({ key: "ll-lunging-upper",frames: [{ key: LL_SHEET_KEY, frame: 20 }], frameRate: 1 });
  scene.anims.create({ key: "ll-rising-slash", frames: [{ key: LL_SHEET_KEY, frame: 21 }], frameRate: 1 });
  scene.anims.create({ key: "ll-sky-crash",    frames: [{ key: LL_SHEET_KEY, frame: 22 }], frameRate: 1 });
  scene.anims.create({ key: "ll-low-sweep",    frames: [{ key: LL_SHEET_KEY, frame: 23 }], frameRate: 1 });
  scene.anims.create({ key: "ll-ground-pound", frames: [{ key: LL_SHEET_KEY, frame: 24 }], frameRate: 1 });
  scene.anims.create({ key: "ll-counter-slash",frames: [{ key: LL_SHEET_KEY, frame: 25 }], frameRate: 1 });
  scene.anims.create({ key: "ll-revert-burst", frames: [{ key: LL_SHEET_KEY, frame: 26 }], frameRate: 1 });
  scene.anims.create({ key: "ll-jump",         frames: [{ key: LL_SHEET_KEY, frame: 27 }], frameRate: 1 });
  scene.anims.create({ key: "ll-air-attack",   frames: [{ key: LL_SHEET_KEY, frame: 28 }], frameRate: 1 });
  scene.anims.create({ key: "ll-dash-attack",  frames: [{ key: LL_SHEET_KEY, frame: 29 }], frameRate: 1 });
  scene.anims.create({ key: "ll-ultimate",     frames: [{ key: LL_SHEET_KEY, frame: 39 }], frameRate: 1 });

  registerInterpAnims(scene, LL_SHEET_KEY, L_FRAME_W, L_FRAME_H, [
    { key: "ll-idle",        frames: [0, 1],                    frameRate: 2,  repeat: -1, loop: true },
    { key: "ll-run",         frames: [2, 3, 4, 5, 6, 7],       frameRate: 10, repeat: -1, loop: true },
    { key: "ll-walk",        frames: [8, 9, 10, 11, 12, 13],   frameRate: 8,  repeat: -1, loop: true },
    { key: "ll-claw-swipe",  frames: [16, 17],                  frameRate: 14, repeat: 0 },
    { key: "ll-frenzy",      frames: [30, 31],                  frameRate: 12, repeat: -1, loop: true },
    { key: "ll-hit",         frames: [32, 33],                  frameRate: 6,  repeat: 0 },
    { key: "ll-knockdown",   frames: [34, 35],                  frameRate: 6,  repeat: 0 },
    { key: "ll-recovery",    frames: [36, 37, 38],              frameRate: 8,  repeat: 0 },
  ]);
}
