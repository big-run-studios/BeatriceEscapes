/**
 * Enemy AI pattern: Evade - dodge away from player attacks or projectiles.
 * Extracted from Enemy.ts.
 */

import type { AIPatternContext, AIPatternResult } from "./types";

export function evadePattern(ctx: AIPatternContext): AIPatternResult {
  const { enemyX, playerX, speed, dt, evadeDir, evadeSpeed } = ctx;

  const vx = evadeDir * speed * evadeSpeed * dt;
  const vy = 0;

  return {
    vx,
    vy,
    facingRight: playerX > enemyX,
  };
}
