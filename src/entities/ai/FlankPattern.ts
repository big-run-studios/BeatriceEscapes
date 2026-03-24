/**
 * Enemy AI pattern: Flank - approach player from the side/behind.
 * Extracted from Enemy.ts, inspired by phaser3-bta-tpe processBehindPattern.
 */

import type { AIPatternContext, AIPatternResult } from "./types";

export function flankPattern(ctx: AIPatternContext): AIPatternResult {
  const {
    enemyX, enemyY, playerX, playerY, playerFacingRight,
    speed, dt, flankOffset, flankAccuracy, flankWideArc,
  } = ctx;

  const behind = playerFacingRight ? -1 : 1;
  const targetX = playerX + behind * flankOffset;
  const baseAngle = Math.atan2(playerY - enemyY, targetX - enemyX);
  const arcOffset = (Math.random() - 0.5) * flankWideArc;
  const angle = baseAngle + arcOffset * (1 - flankAccuracy);

  const vx = Math.cos(angle) * speed * dt;
  const vy = Math.sin(angle) * speed * dt;

  return {
    vx,
    vy,
    facingRight: playerX > enemyX,
  };
}
