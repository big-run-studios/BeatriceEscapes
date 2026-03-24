import Phaser from "phaser";
import { EnemyTypeId } from "../config/game";

export const AGENT_SHEET_KEY = "marc-agent";
export const CADET_SHEET_KEY = "marc-cadet";
export const E_FRAME_W = 256;
export const E_FRAME_H = 256;

const ENEMY_SPRITE_SCALES: Partial<Record<EnemyTypeId, number>> = {
  agent: 0.45,
  cadet: 0.40,
};

const SPRITE_SHEET_MAP: Partial<Record<EnemyTypeId, string>> = {
  agent: AGENT_SHEET_KEY,
  cadet: CADET_SHEET_KEY,
};

export function getEnemySpriteScale(typeId: EnemyTypeId): number {
  return ENEMY_SPRITE_SCALES[typeId] ?? 0;
}

export function getEnemySheetKey(typeId: EnemyTypeId): string | null {
  return SPRITE_SHEET_MAP[typeId] ?? null;
}

export function getEnemyAnimPrefix(typeId: EnemyTypeId): string | null {
  switch (typeId) {
    case "agent": return "ea";
    case "cadet": return "ec";
    default: return null;
  }
}

/**
 * 8x3 grid, 7 sprites per row (col 7 empty each row).
 * Row 1: Idle(0), Idle2(1), Walk(2), Walk2(3), Run(4), Run(5), Run(6), [empty 7]
 * Row 2: Windup(8), Attack(9), Attack2(10), Hit(11), Death1(12), Death2(13), Dash-alt(14), [empty 15]
 * Row 3: Dash(16), Guard(17), Alert(18), Flank(19), Assess(20), Recover(21), Entry(22), [empty 23]
 */
function registerAnimsForType(scene: Phaser.Scene, sheetKey: string, prefix: string): void {
  if (scene.anims.exists(`${prefix}-idle`)) return;

  scene.anims.create({
    key: `${prefix}-idle`,
    frames: scene.anims.generateFrameNumbers(sheetKey, { frames: [0, 1] }),
    frameRate: 2,
    repeat: -1,
  });

  scene.anims.create({
    key: `${prefix}-walk`,
    frames: scene.anims.generateFrameNumbers(sheetKey, { frames: [2, 4, 3, 5] }),
    frameRate: 5,
    repeat: -1,
  });

  scene.anims.create({
    key: `${prefix}-chase`,
    frames: scene.anims.generateFrameNumbers(sheetKey, { frames: [4, 5, 6] }),
    frameRate: 10,
    repeat: -1,
  });

  scene.anims.create({
    key: `${prefix}-windup`,
    frames: [{ key: sheetKey, frame: 8 }],
    frameRate: 1,
  });

  scene.anims.create({
    key: `${prefix}-attack`,
    frames: scene.anims.generateFrameNumbers(sheetKey, { frames: [9, 10] }),
    frameRate: 10,
    repeat: 0,
  });

  scene.anims.create({
    key: `${prefix}-hit`,
    frames: [{ key: sheetKey, frame: 11 }],
    frameRate: 1,
  });

  scene.anims.create({
    key: `${prefix}-death`,
    frames: scene.anims.generateFrameNumbers(sheetKey, { frames: [12, 13] }),
    frameRate: 6,
    repeat: 0,
  });

  scene.anims.create({
    key: `${prefix}-dash`,
    frames: [{ key: sheetKey, frame: 16 }],
    frameRate: 1,
  });

  scene.anims.create({
    key: `${prefix}-guard`,
    frames: [{ key: sheetKey, frame: 17 }],
    frameRate: 1,
  });

  scene.anims.create({
    key: `${prefix}-alert`,
    frames: [{ key: sheetKey, frame: 18 }],
    frameRate: 1,
  });

  scene.anims.create({
    key: `${prefix}-flank`,
    frames: [{ key: sheetKey, frame: 19 }],
    frameRate: 1,
  });

  scene.anims.create({
    key: `${prefix}-assess`,
    frames: [{ key: sheetKey, frame: 20 }],
    frameRate: 1,
  });

  scene.anims.create({
    key: `${prefix}-recover`,
    frames: [{ key: sheetKey, frame: 21 }],
    frameRate: 1,
  });

  scene.anims.create({
    key: `${prefix}-entry`,
    frames: [{ key: sheetKey, frame: 22 }],
    frameRate: 1,
  });
}

export function registerEnemyAnims(scene: Phaser.Scene): void {
  registerAnimsForType(scene, AGENT_SHEET_KEY, "ea");
  registerAnimsForType(scene, CADET_SHEET_KEY, "ec");
}
