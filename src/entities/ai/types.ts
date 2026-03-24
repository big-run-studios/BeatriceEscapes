/**
 * Shared types for enemy AI pattern modules.
 * Each pattern takes a context and returns movement intent.
 */

export interface AIPatternContext {
  enemyX: number;
  enemyY: number;
  playerX: number;
  playerY: number;
  playerFacingRight: boolean;
  speed: number;
  dt: number;
  facingRight: boolean;

  flankOffset: number;
  flankAccuracy: number;
  flankWideArc: number;

  circleRadius: number;
  circleAngle: number;
  circleSpeed: number;

  evadeDir: number;
  evadeSpeed: number;

  retreatDist: number;
}

export interface AIPatternResult {
  vx: number;
  vy: number;
  facingRight: boolean;
  newCircleAngle?: number;
}

export type AIPatternFn = (ctx: AIPatternContext) => AIPatternResult;
