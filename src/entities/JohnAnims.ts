import Phaser from "phaser";
import { registerInterpAnims } from "../systems/AnimInterp";

export const J_SHEET_KEY = "john";
export const J_FRAME_W = 256;
export const J_FRAME_H = 256;
export const J_SPRITE_SCALE = 0.39;

export function registerJohnAnims(scene: Phaser.Scene): void {
  if (scene.anims.exists("j-idle")) return;

  // Single-frame poses
  scene.anims.create({ key: "j-guard",      frames: [{ key: J_SHEET_KEY, frame: 14 }], frameRate: 1 });
  scene.anims.create({ key: "j-parry",      frames: [{ key: J_SHEET_KEY, frame: 15 }], frameRate: 1 });
  scene.anims.create({ key: "j-bat-lunge",  frames: [{ key: J_SHEET_KEY, frame: 23 }], frameRate: 1 });
  scene.anims.create({ key: "j-dash",       frames: [{ key: J_SHEET_KEY, frame: 28 }], frameRate: 1 });
  scene.anims.create({ key: "j-jump",       frames: [{ key: J_SHEET_KEY, frame: 29 }], frameRate: 1 });
  scene.anims.create({ key: "j-air-attack", frames: [{ key: J_SHEET_KEY, frame: 30 }], frameRate: 1 });
  scene.anims.create({ key: "j-grab",       frames: [{ key: J_SHEET_KEY, frame: 31 }], frameRate: 1 });
  scene.anims.create({ key: "j-ultimate",   frames: [{ key: J_SHEET_KEY, frame: 39 }], frameRate: 1 });

  registerInterpAnims(scene, J_SHEET_KEY, J_FRAME_W, J_FRAME_H, [
    { key: "j-idle",       frames: [0, 1],                    frameRate: 2,  repeat: -1, loop: true },
    { key: "j-run",        frames: [2, 3, 4, 5, 6, 7],       frameRate: 10, repeat: -1, loop: true },
    { key: "j-walk",       frames: [8, 9, 10, 11, 12, 13],   frameRate: 8,  repeat: -1, loop: true },
    { key: "j-bat-jab",    frames: [16, 17, 18, 19],         frameRate: 14, repeat: 0 },
    { key: "j-bat-upper",  frames: [20, 21, 22],             frameRate: 12, repeat: 0 },
    { key: "j-slingshot",  frames: [24, 25],                 frameRate: 8,  repeat: 0 },
    { key: "j-ground-slam",frames: [26, 27],                 frameRate: 8,  repeat: 0 },
    { key: "j-hit",        frames: [32, 33],                 frameRate: 6,  repeat: 0 },
    { key: "j-knockdown",  frames: [34, 35],                 frameRate: 6,  repeat: 0 },
    { key: "j-recovery",   frames: [36, 37, 38],             frameRate: 8,  repeat: 0 },
  ]);
}
