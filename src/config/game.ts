export const GAME_WIDTH = 1280;
export const GAME_HEIGHT = 720;

export const ARENA = {
  width: 2400,
  height: 800,
  groundY: 300,
  groundHeight: 500,
  boundaryPadding: 40,
};

export const PLAYER = {
  speed: 300,
  width: 48,
  height: 80,
  depthSpeed: 200,
};

export const JUMP = {
  height: 240,
  duration: 0.85,
};

export type ComboInput = "L" | "H";
export type MoveType = "projectile" | "melee" | "rush" | "toss" | "burst";
export type VisualPose =
  | "bea-cast"
  | "bea-big-cast"
  | "bea-burst"
  | "bea-finisher"
  | "bea-toss"
  | "andrew-punch"
  | "andrew-slam"
  | "andrew-rush"
  | "andrew-uppercut";

export interface ComboNode {
  id: string;
  name: string;
  input: ComboInput;
  duration: number;
  hitFrame: number;
  damage: number;
  knockback: number;
  hitstopMs: number;
  moveType: MoveType;
  visual: VisualPose;
  shakeIntensity: number;
  shakeDuration: number;
  mpCost?: number;
  projectile?: { radius: number; speed: number; color: number; maxRange: number };
  rush?: { speed: number; duration: number };
  burstCount?: number;
  children: ComboNode[];
}

const PROJ_SMALL = { radius: 8, speed: 500, color: 0x88ccff, maxRange: 400 };
const PROJ_MEDIUM = { radius: 14, speed: 400, color: 0x55aaff, maxRange: 450 };
const PROJ_BLAST = { radius: 16, speed: 350, color: 0xffcc44, maxRange: 500 };

export const COMBO_TREE: ComboNode[] = [
  // ── Square (L) branch: Bea wind shots (chip pokes, low damage) ──
  {
    id: "L", name: "Wind Shot", input: "L",
    duration: 0.28, hitFrame: 0.1, damage: 5, knockback: 30, hitstopMs: 20,
    moveType: "projectile", visual: "bea-cast",
    shakeIntensity: 1, shakeDuration: 30,
    mpCost: 6,
    projectile: PROJ_SMALL,
    children: [
      {
        id: "LL", name: "Wind Shot 2", input: "L",
        duration: 0.24, hitFrame: 0.08, damage: 5, knockback: 30, hitstopMs: 20,
        moveType: "projectile", visual: "bea-cast",
        shakeIntensity: 1, shakeDuration: 30,
        mpCost: 6,
        projectile: PROJ_SMALL,
        children: [
          {
            id: "LLL", name: "Wind Shot 3", input: "L",
            duration: 0.22, hitFrame: 0.07, damage: 5, knockback: 30, hitstopMs: 20,
            moveType: "projectile", visual: "bea-cast",
            shakeIntensity: 1, shakeDuration: 30,
            mpCost: 6,
            projectile: PROJ_SMALL,
            children: [
              {
                id: "LLLL", name: "Big Wind Ball", input: "L",
                duration: 0.4, hitFrame: 0.15, damage: 12, knockback: 150, hitstopMs: 50,
                moveType: "projectile", visual: "bea-big-cast",
                shakeIntensity: 3, shakeDuration: 60,
                mpCost: 12,
                projectile: PROJ_MEDIUM,
                children: [],
              },
              {
                id: "LLLH", name: "Bea Toss", input: "H",
                duration: 0.55, hitFrame: 0.2, damage: 35, knockback: 350, hitstopMs: 90,
                moveType: "toss", visual: "bea-toss",
                shakeIntensity: 5, shakeDuration: 100,
                children: [],
              },
            ],
          },
          {
            id: "LLH", name: "Slam", input: "H",
            duration: 0.5, hitFrame: 0.22, damage: 35, knockback: 250, hitstopMs: 80,
            moveType: "melee", visual: "andrew-slam",
            shakeIntensity: 5, shakeDuration: 90,
            children: [],
          },
        ],
      },
      {
        id: "LH", name: "Uppercut", input: "H",
        duration: 0.45, hitFrame: 0.18, damage: 28, knockback: 200, hitstopMs: 60,
        moveType: "melee", visual: "andrew-uppercut",
        shakeIntensity: 4, shakeDuration: 70,
        children: [],
      },
    ],
  },
  // ── Triangle (H) branch: Andrew haymakers (power moves, high damage) ──
  {
    id: "H", name: "Haymaker", input: "H",
    duration: 0.5, hitFrame: 0.22, damage: 30, knockback: 200, hitstopMs: 80,
    moveType: "melee", visual: "andrew-punch",
    shakeIntensity: 4, shakeDuration: 70,
    children: [
      {
        id: "HH", name: "Haymaker 2", input: "H",
        duration: 0.5, hitFrame: 0.22, damage: 30, knockback: 200, hitstopMs: 80,
        moveType: "melee", visual: "andrew-punch",
        shakeIntensity: 4, shakeDuration: 70,
        children: [
          {
            id: "HHH", name: "Bull Rush", input: "H",
            duration: 0.55, hitFrame: 0.05, damage: 40, knockback: 350, hitstopMs: 60,
            moveType: "rush", visual: "andrew-rush",
            shakeIntensity: 6, shakeDuration: 100,
            rush: { speed: 450, duration: 0.5 },
            children: [],
          },
          {
            id: "HHL", name: "Magic Finisher", input: "L",
            duration: 0.5, hitFrame: 0.2, damage: 25, knockback: 280, hitstopMs: 80,
            moveType: "projectile", visual: "bea-finisher",
            shakeIntensity: 5, shakeDuration: 90,
            mpCost: 12,
            projectile: PROJ_BLAST,
            children: [],
          },
        ],
      },
      {
        id: "HL", name: "Shoulder Burst", input: "L",
        duration: 0.45, hitFrame: 0.1, damage: 5, knockback: 40, hitstopMs: 20,
        moveType: "burst", visual: "bea-burst",
        shakeIntensity: 2, shakeDuration: 40,
        mpCost: 12,
        projectile: PROJ_SMALL,
        burstCount: 3,
        children: [],
      },
    ],
  },
];

export const COMBAT = {
  comboWindow: 0.3,
  meleeHitRange: 80,
  meleeHitDepthRange: 55,
  blockSpeedMultiplier: 0.25,
  heavyStepDistance: 30,
  heavyStepDuration: 120,
  lightStepBackDistance: 12,
  lightStepBackDuration: 100,
};

export const AIR_ATTACK = {
  damage: 35,
  knockback: 300,
  hitstopMs: 80,
  aoeRadius: 100,
  aoeDepthRange: 70,
  dropSpeed: 800,
  shakeIntensity: 6,
  shakeDuration: 100,
};

export const THROW = {
  grabRange: 60,
  grabDepthRange: 40,
  grabDuration: 0.3,
  throwDuration: 0.3,
  damage: 40,
  knockback: 500,
  shakeIntensity: 5,
  shakeDuration: 80,
};

export const ULTIMATE = {
  mpCost: 50,
  maxMp: 100,
  mpRegen: 8,
  maxHp: 100,
  blastDamage: 80,
  blastKnockback: 500,
  blastHitstopMs: 120,
  blastShakeIntensity: 10,
  blastShakeDuration: 200,
  setupDuration: 0.4,
  chargeDuration: 0.6,
  blastDuration: 0.5,
  recoveryDuration: 1.0,
};

export const DASH = {
  doubleTapWindow: 0.18,
  speed: 750,
  duration: 0.22,
  cooldown: 0.3,
  lightMpCost: 8,
  lightDamage: 15,
  lightKnockback: 250,
  lightHitstopMs: 50,
  lightShakeIntensity: 3,
  lightShakeDuration: 60,
  heavyDamage: 30,
  heavyKnockback: 400,
  heavyHitstopMs: 80,
  heavyShakeIntensity: 6,
  heavyShakeDuration: 90,
  attackDuration: 0.35,
  attackHitRange: 90,
  attackDepthRange: 55,
};

export const ENEMY = {
  width: 40,
  height: 70,
  baseHp: 40,
  baseDamage: 5,
  baseSpeed: 60,
  hpPerLevel: 0.4,
  damagePerLevel: 0.25,
  speedPerLevel: 0.125,
  attackRange: 65,
  attackDepthRange: 40,
  attackDuration: 0.25,
  hitstunDuration: 0.35,
  hitstunThreshold: 15,
  flinchDuration: 0.1,
  knockbackFriction: 500,
  deathDuration: 0.4,
};

export type AILevelPair = [number, number];

export function aiLerp(pair: AILevelPair, level: number): number {
  const t = Math.min((level - 1) / 4, 1);
  return pair[0] + (pair[1] - pair[0]) * t;
}

export const ENEMY_AI = {
  engageSlots: 2,

  assessDuration: [0.35, 0.06] as AILevelPair,
  windupDuration: [0.65, 0.3] as AILevelPair,
  recoverDuration: [0.45, 0.2] as AILevelPair,

  evadeChance: [0.15, 0.9] as AILevelPair,
  evadeSpeed: [180, 350] as AILevelPair,
  evadeDuration: 0.3,
  evadeCooldown: [1.5, 0.4] as AILevelPair,

  circleRadius: [220, 140] as AILevelPair,
  circleSpeed: [0.6, 1.6] as AILevelPair,

  flankAccuracy: [0.4, 0.95] as AILevelPair,
  flankOffset: [70, 140] as AILevelPair,
  flankWideArc: [0.3, 0.85] as AILevelPair,

  retreatChance: [0.1, 0.7] as AILevelPair,
  retreatDistance: [160, 240] as AILevelPair,

  allySpacing: [25, 60] as AILevelPair,

  projectileDodgeChance: [0.1, 0.85] as AILevelPair,
  projectileAwareness: [40, 180] as AILevelPair,

  chaseAngleOffset: [0.05, 0.4] as AILevelPair,
};

export const PICKUP = {
  healAmount: 25,
  collectRadius: 40,
  despawnTime: 10,
  bobSpeed: 3,
  bobAmount: 4,
};

export const RUN = {
  baseMoneyPerKill: 1.0,
  moneyPerLevel: 0.5,
  snackDropChance: 0.25,
  waveCount: 3,
  wavePauseDuration: 2.0,
};

export const PLAYER_HIT = {
  hitstunDuration: 0.3,
  knockdownDuration: 0.5,
  knockdownLieDuration: 0.8,
  recoveryDuration: 0.6,
  knockbackSpeed: 200,
  blockDamageReduction: 0.7,
  iFrameDuration: 0.8,
  hitKnockbackStep: 120,
};

export const COLORS = {
  background: 0x0a0a1a,
  titleText: "#e8d5b5",
  subtitleText: "#8a7b6b",
  accent: "#c9944a",
  andrewFill: 0x3a6b8a,
  andrewOutline: 0x5a9bba,
  beaFill: 0xd4618a,
  beaOutline: 0xf08aaa,
  dummyFill: 0x5a4a3a,
  dummyOutline: 0x7a6a5a,
  dummyHit: 0xffffff,
  hpBarBg: 0x1a1a1a,
  hpBarFill: 0x44aa44,
  hpBarDamage: 0xdd4444,
  mpBarFill: 0x4488dd,
  trashCanFill: 0x555555,
  trashCanOutline: 0x777777,
  ultimateGlow: 0xffee44,
  electricArc: 0x88ddff,
  groundFill: 0x1a1a2e,
  groundLine: 0x2a2a4e,
  wallFill: 0x0f0f20,
  enemyFill: 0x667788,
  enemyOutline: 0x889aab,
  enemyVisor: 0xdd3333,
  enemyWindup: 0xff4444,
  pickupGoldfish: 0xee8833,
  pickupJuice: 0x8844bb,
  pickupFruitSnack: 0xdd3344,
  pickupApple: 0x55bb44,
  pickupCheese: 0xeecc44,
  moneyText: "#55cc55",
  hubBg: 0x1a1a2e,
  hubAccent: 0xc9944a,
  hubPanel: 0x222244,
  lockedChar: 0x333355,
};
