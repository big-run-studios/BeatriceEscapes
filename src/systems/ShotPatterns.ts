/**
 * Shot pattern dispatch table for ranged attacks.
 * Inspired by starshake's ShootingPatterns strategy pattern.
 * Each pattern is a function that returns an array of projectile spawn descriptors.
 */

export interface ShotDescriptor {
  offsetX: number;
  offsetY: number;
  angleOffset: number;
  speedMultiplier: number;
  damageMultiplier: number;
  delayMs: number;
}

export type ShotPatternId =
  | "single"
  | "double"
  | "triple-spread"
  | "burst-ring"
  | "rapid-volley"
  | "piercing-bolt";

export interface ShotPattern {
  id: ShotPatternId;
  name: string;
  description: string;
  generate: (facingRight: boolean) => ShotDescriptor[];
}

const DEG = Math.PI / 180;

const PATTERNS: Record<ShotPatternId, ShotPattern> = {
  single: {
    id: "single",
    name: "Single Shot",
    description: "Standard single projectile.",
    generate: () => [{ offsetX: 0, offsetY: 0, angleOffset: 0, speedMultiplier: 1, damageMultiplier: 1, delayMs: 0 }],
  },

  double: {
    id: "double",
    name: "Twin Shot",
    description: "Fire two projectiles in parallel.",
    generate: () => [
      { offsetX: 0, offsetY: -12, angleOffset: 0, speedMultiplier: 1, damageMultiplier: 0.7, delayMs: 0 },
      { offsetX: 0, offsetY: 12, angleOffset: 0, speedMultiplier: 1, damageMultiplier: 0.7, delayMs: 40 },
    ],
  },

  "triple-spread": {
    id: "triple-spread",
    name: "Triple Spread",
    description: "Fire three projectiles in a spread pattern.",
    generate: (facingRight) => {
      const dir = facingRight ? 1 : -1;
      return [
        { offsetX: 0, offsetY: 0, angleOffset: 0, speedMultiplier: 1, damageMultiplier: 0.6, delayMs: 0 },
        { offsetX: 0, offsetY: 0, angleOffset: 15 * DEG * dir, speedMultiplier: 0.95, damageMultiplier: 0.5, delayMs: 0 },
        { offsetX: 0, offsetY: 0, angleOffset: -15 * DEG * dir, speedMultiplier: 0.95, damageMultiplier: 0.5, delayMs: 0 },
      ];
    },
  },

  "burst-ring": {
    id: "burst-ring",
    name: "Burst Ring",
    description: "Fire 6 projectiles in all directions.",
    generate: () => {
      const shots: ShotDescriptor[] = [];
      for (let i = 0; i < 6; i++) {
        shots.push({
          offsetX: 0, offsetY: 0,
          angleOffset: (i * 60) * DEG,
          speedMultiplier: 0.8,
          damageMultiplier: 0.4,
          delayMs: 0,
        });
      }
      return shots;
    },
  },

  "rapid-volley": {
    id: "rapid-volley",
    name: "Rapid Volley",
    description: "Fire 3 rapid shots in succession.",
    generate: () => [
      { offsetX: 0, offsetY: 0, angleOffset: 0, speedMultiplier: 1.1, damageMultiplier: 0.5, delayMs: 0 },
      { offsetX: 0, offsetY: 0, angleOffset: 0, speedMultiplier: 1.1, damageMultiplier: 0.5, delayMs: 60 },
      { offsetX: 0, offsetY: 0, angleOffset: 0, speedMultiplier: 1.1, damageMultiplier: 0.5, delayMs: 120 },
    ],
  },

  "piercing-bolt": {
    id: "piercing-bolt",
    name: "Piercing Bolt",
    description: "Fire a single powerful bolt with extended range.",
    generate: () => [
      { offsetX: 0, offsetY: 0, angleOffset: 0, speedMultiplier: 1.5, damageMultiplier: 1.8, delayMs: 0 },
    ],
  },
};

export function getShotPattern(id: ShotPatternId): ShotPattern {
  return PATTERNS[id];
}

export function getAllPatterns(): ShotPattern[] {
  return Object.values(PATTERNS);
}
