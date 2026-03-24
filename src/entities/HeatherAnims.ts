import Phaser from "phaser";
import { registerInterpAnims } from "../systems/AnimInterp";

export const H_SHEET_KEY = "heather";
export const H_FRAME_W = 256;
export const H_FRAME_H = 256;
export const H_SPRITE_SCALE = 0.69;

export function registerHeatherAnims(scene: Phaser.Scene): void {
  if (scene.anims.exists("h-idle")) return;

  // Single-frame poses
  scene.anims.create({ key: "h-hover",        frames: [{ key: H_SHEET_KEY, frame: 14 }], frameRate: 1 });
  scene.anims.create({ key: "h-hover-charge", frames: [{ key: H_SHEET_KEY, frame: 15 }], frameRate: 1 });
  scene.anims.create({ key: "h-staff-thrust", frames: [{ key: H_SHEET_KEY, frame: 18 }], frameRate: 1 });
  scene.anims.create({ key: "h-rising-staff", frames: [{ key: H_SHEET_KEY, frame: 19 }], frameRate: 1 });
  scene.anims.create({ key: "h-low-sweep",    frames: [{ key: H_SHEET_KEY, frame: 20 }], frameRate: 1 });
  scene.anims.create({ key: "h-staff-slam",   frames: [{ key: H_SHEET_KEY, frame: 21 }], frameRate: 1 });
  scene.anims.create({ key: "h-skyward-sweep",frames: [{ key: H_SHEET_KEY, frame: 22 }], frameRate: 1 });
  scene.anims.create({ key: "h-ground-strike",frames: [{ key: H_SHEET_KEY, frame: 23 }], frameRate: 1 });
  scene.anims.create({ key: "h-parry",        frames: [{ key: H_SHEET_KEY, frame: 24 }], frameRate: 1 });
  scene.anims.create({ key: "h-parry-counter",frames: [{ key: H_SHEET_KEY, frame: 25 }], frameRate: 1 });
  scene.anims.create({ key: "h-totem-charge", frames: [{ key: H_SHEET_KEY, frame: 26 }], frameRate: 1 });
  scene.anims.create({ key: "h-totem-plant",  frames: [{ key: H_SHEET_KEY, frame: 27 }], frameRate: 1 });
  scene.anims.create({ key: "h-dash",         frames: [{ key: H_SHEET_KEY, frame: 28 }], frameRate: 1 });
  scene.anims.create({ key: "h-jump",         frames: [{ key: H_SHEET_KEY, frame: 29 }], frameRate: 1 });
  scene.anims.create({ key: "h-air-attack",   frames: [{ key: H_SHEET_KEY, frame: 30 }], frameRate: 1 });
  scene.anims.create({ key: "h-dash-attack",  frames: [{ key: H_SHEET_KEY, frame: 31 }], frameRate: 1 });
  scene.anims.create({ key: "h-ultimate",     frames: [{ key: H_SHEET_KEY, frame: 39 }], frameRate: 1 });

  registerInterpAnims(scene, H_SHEET_KEY, H_FRAME_W, H_FRAME_H, [
    { key: "h-idle",      frames: [0, 1],                frameRate: 2,  repeat: -1, loop: true },
    { key: "h-run",       frames: [2, 3, 4, 5, 6, 7],   frameRate: 10, repeat: -1, loop: true },
    { key: "h-walk",      frames: [8, 9, 10, 11, 12, 13],frameRate: 8,  repeat: -1, loop: true },
    { key: "h-staff-tap", frames: [16, 17],              frameRate: 12, repeat: 0 },
    { key: "h-hit",       frames: [32, 33],              frameRate: 6,  repeat: 0 },
    { key: "h-knockdown", frames: [34, 35],              frameRate: 6,  repeat: 0 },
    { key: "h-recovery",  frames: [36, 37, 38],          frameRate: 8,  repeat: 0 },
  ]);
}
