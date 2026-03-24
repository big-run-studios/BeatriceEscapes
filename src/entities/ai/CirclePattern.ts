/**
 * Enemy AI pattern: Circle around the player at a set radius.
 * Extracted from Enemy.ts.
 */

import type { AIPatternContext, AIPatternResult } from "./types";

export function circlePattern(ctx: AIPatternContext): AIPatternResult {
  const {
    enemyX, enemyY, playerX, playerY,
    speed, dt, circleRadius, circleAngle, circleSpeed,
  } = ctx;

  const targetX = playerX + Math.cos(circleAngle) * circleRadius;
  const targetY = playerY + Math.sin(circleAngle) * circleRadius;
  const dx = targetX - enemyX;
  const dy = targetY - enemyY;
  const dist = Math.sqrt(dx * dx + dy * dy);

  let vx = 0;
  let vy = 0;
  if (dist > 5) {
    vx = (dx / dist) * speed * circleSpeed * dt;
    vy = (dy / dist) * speed * circleSpeed * dt;
  }

  const newAngle = circleAngle + circleSpeed * dt;

  return {
    vx,
    vy,
    facingRight: playerX > enemyX,
    newCircleAngle: newAngle,
  };
}
