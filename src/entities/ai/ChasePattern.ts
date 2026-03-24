/**
 * Enemy AI pattern: Direct chase toward player.
 * Extracted from Enemy.ts, inspired by phaser3-bta-tpe processSimplePattern.
 */

import type { AIPatternContext, AIPatternResult } from "./types";

export function chasePattern(ctx: AIPatternContext): AIPatternResult {
  const { enemyX, enemyY, playerX, playerY, speed, dt } = ctx;
  const dx = playerX - enemyX;
  const dy = playerY - enemyY;
  const dist = Math.sqrt(dx * dx + dy * dy);

  if (dist < 1) return { vx: 0, vy: 0, facingRight: ctx.facingRight };

  const nx = dx / dist;
  const ny = dy / dist;

  return {
    vx: nx * speed * dt,
    vy: ny * speed * dt,
    facingRight: dx > 0,
  };
}
