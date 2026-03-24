/**
 * Enemy AI pattern: Retreat - back away from the player.
 * Extracted from Enemy.ts.
 */

import type { AIPatternContext, AIPatternResult } from "./types";

export function retreatPattern(ctx: AIPatternContext): AIPatternResult {
  const { enemyX, enemyY, playerX, playerY, speed, dt, retreatDist } = ctx;

  const dx = enemyX - playerX;
  const dy = enemyY - playerY;
  const dist = Math.sqrt(dx * dx + dy * dy);

  if (dist >= retreatDist) {
    return { vx: 0, vy: 0, facingRight: playerX > enemyX };
  }

  const nx = dist > 1 ? dx / dist : (Math.random() > 0.5 ? 1 : -1);
  const ny = dist > 1 ? dy / dist : 0;

  return {
    vx: nx * speed * 0.7 * dt,
    vy: ny * speed * 0.7 * dt,
    facingRight: playerX > enemyX,
  };
}
