/**
 * Enemy AI pattern module index.
 * Import all patterns from here for clean access.
 */

export type { AIPatternContext, AIPatternResult, AIPatternFn } from "./types";
export { chasePattern } from "./ChasePattern";
export { flankPattern } from "./FlankPattern";
export { circlePattern } from "./CirclePattern";
export { evadePattern } from "./EvadePattern";
export { retreatPattern } from "./RetreatPattern";

import type { AIPatternFn } from "./types";
import { chasePattern } from "./ChasePattern";
import { flankPattern } from "./FlankPattern";
import { circlePattern } from "./CirclePattern";
import { evadePattern } from "./EvadePattern";
import { retreatPattern } from "./RetreatPattern";

export type AIPatternName = "chase" | "flank" | "circle" | "evade" | "retreat";

const PATTERN_REGISTRY: Record<AIPatternName, AIPatternFn> = {
  chase: chasePattern,
  flank: flankPattern,
  circle: circlePattern,
  evade: evadePattern,
  retreat: retreatPattern,
};

export function getAIPattern(name: AIPatternName): AIPatternFn {
  return PATTERN_REGISTRY[name];
}
