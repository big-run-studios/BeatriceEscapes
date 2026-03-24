import Phaser from "phaser";
import { registerInterpAnims } from "../systems/AnimInterp";

export const AB_SHEET_KEY = "andrew-bea";
export const AB_FRAME_W = 256;
export const AB_FRAME_H = 256;
export const AB_SPRITE_SCALE = 0.75;

/*
 * Frame layout (8x6 grid = 48 cells, 43 sprites):
 *   0-9:   idle x3, bea-solo-run x4, combined-run x3
 *   10-19: walk x8, block, dash
 *   20-26: jump, punch(wide), uppercut, attack, rush(wide), grab, finisher(wide)
 *   27-34: slam, cast-pair, cast, magic-fx, toss, burst, magic-circle, power-up
 *   35-42: hit, heavy-hit, knocked-down, recovery x4, ultimate
 */

export function registerAndrewBeaAnims(scene: Phaser.Scene): void {
  if (scene.anims.exists("ab-idle")) return;

  const singleFrame = (key: string, frame: number) =>
    scene.anims.create({
      key,
      frames: [{ key: AB_SHEET_KEY, frame }],
      frameRate: 1,
    });

  singleFrame("ab-idle", 0);
  singleFrame("ab-hit", 35);
  singleFrame("ab-block", 18);
  singleFrame("ab-dash", 19);
  singleFrame("ab-jump", 20);
  singleFrame("ab-uppercut", 22);
  singleFrame("ab-slam", 27);
  singleFrame("ab-rush", 24);
  singleFrame("ab-grab", 25);
  singleFrame("ab-burst", 32);
  singleFrame("ab-toss", 31);
  singleFrame("ab-ultimate", 42);

  registerInterpAnims(scene, AB_SHEET_KEY, AB_FRAME_W, AB_FRAME_H, [
    { key: "ab-run",       frames: [7, 8, 9],                        frameRate: 8,  repeat: -1, loop: true },
    { key: "ab-walk",      frames: [10, 11, 12, 13, 14, 15, 16, 17], frameRate: 8,  repeat: -1, loop: true },
    { key: "ab-punch",     frames: [21, 23],                          frameRate: 12, repeat: 0 },
    { key: "ab-cast",      frames: [29, 30],                          frameRate: 6,  repeat: 0 },
    { key: "ab-big-cast",  frames: [28, 31],                          frameRate: 6,  repeat: 0 },
    { key: "ab-finisher",  frames: [33, 34],                          frameRate: 8,  repeat: 0 },
    { key: "ab-knockdown", frames: [35, 36, 37],                      frameRate: 6,  repeat: 0 },
    { key: "ab-recovery",  frames: [38, 39, 40],                      frameRate: 8,  repeat: 0 },
  ]);
}
