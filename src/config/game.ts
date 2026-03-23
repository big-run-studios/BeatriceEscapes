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
  meleeHitRange: 45,
  meleeHitDepthRange: 40,
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

// ════════════════════════════════════════════════════════════════
//  ENEMY TYPES — MaRC First Response Division
// ════════════════════════════════════════════════════════════════

export type EnemyTypeId = "cadet" | "agent" | "brute" | "sniper" | "shielder" | "squad_leader" | "field_commander";

export interface EnemyTypeDef {
  id: EnemyTypeId;
  name: string;
  width: number;
  height: number;
  hpMult: number;
  damageMult: number;
  speedMult: number;
  attackRange: number;
  attackDuration: number;
  hitstunThreshold: number;
  headScale: number;
  bodyColor: number;
  outlineColor: number;
  visorColor: number;
  preferRetreat: boolean;
  hasShield: boolean;
  hasCharge: boolean;
  isRanged: boolean;
  isBoss: boolean;
  shieldReduction: number;
  fireInterval: number;
  projectileSpeed: number;
  projectileDamage: number;
  projectileColor: number;
  chargeSpeed: number;
  chargeDamage: number;
  chargeWindup: number;
  chargeDuration: number;
  phaseThresholds: number[];
  summonTypes: EnemyTypeId[][];
  bossAttackCooldown: number;
}

export const ENEMY_TYPES: Record<EnemyTypeId, EnemyTypeDef> = {
  cadet: {
    id: "cadet", name: "MaRC Cadet",
    width: 30, height: 55, hpMult: 0.5, damageMult: 0.6, speedMult: 1.3,
    attackRange: 50, attackDuration: 0.2, hitstunThreshold: 8, headScale: 1.3,
    bodyColor: 0x55aaaa, outlineColor: 0x77cccc, visorColor: 0x33bbbb,
    preferRetreat: false, hasShield: false, hasCharge: false, isRanged: false, isBoss: false,
    shieldReduction: 0, fireInterval: 0, projectileSpeed: 0, projectileDamage: 0, projectileColor: 0,
    chargeSpeed: 0, chargeDamage: 0, chargeWindup: 0, chargeDuration: 0,
    phaseThresholds: [], summonTypes: [], bossAttackCooldown: 0,
  },
  agent: {
    id: "agent", name: "MaRC Agent",
    width: 40, height: 70, hpMult: 1.0, damageMult: 1.0, speedMult: 1.0,
    attackRange: 65, attackDuration: 0.25, hitstunThreshold: 15, headScale: 1.0,
    bodyColor: 0x667788, outlineColor: 0x889aab, visorColor: 0xdd3333,
    preferRetreat: false, hasShield: false, hasCharge: false, isRanged: false, isBoss: false,
    shieldReduction: 0, fireInterval: 0, projectileSpeed: 0, projectileDamage: 0, projectileColor: 0,
    chargeSpeed: 0, chargeDamage: 0, chargeWindup: 0, chargeDuration: 0,
    phaseThresholds: [], summonTypes: [], bossAttackCooldown: 0,
  },
  brute: {
    id: "brute", name: "MaRC Brute",
    width: 60, height: 85, hpMult: 2.5, damageMult: 1.8, speedMult: 0.6,
    attackRange: 80, attackDuration: 0.35, hitstunThreshold: 30, headScale: 0.8,
    bodyColor: 0x445566, outlineColor: 0x667788, visorColor: 0xcc2222,
    preferRetreat: false, hasShield: false, hasCharge: true, isRanged: false, isBoss: false,
    shieldReduction: 0, fireInterval: 0, projectileSpeed: 0, projectileDamage: 0, projectileColor: 0,
    chargeSpeed: 400, chargeDamage: 25, chargeWindup: 0.5, chargeDuration: 0.6,
    phaseThresholds: [], summonTypes: [], bossAttackCooldown: 0,
  },
  sniper: {
    id: "sniper", name: "MaRC Sniper",
    width: 32, height: 75, hpMult: 0.6, damageMult: 0.8, speedMult: 0.9,
    attackRange: 55, attackDuration: 0.2, hitstunThreshold: 10, headScale: 0.9,
    bodyColor: 0x776699, outlineColor: 0x9988bb, visorColor: 0xbb55dd,
    preferRetreat: true, hasShield: false, hasCharge: false, isRanged: true, isBoss: false,
    shieldReduction: 0, fireInterval: 2.0, projectileSpeed: 350, projectileDamage: 8, projectileColor: 0xbb55dd,
    chargeSpeed: 0, chargeDamage: 0, chargeWindup: 0, chargeDuration: 0,
    phaseThresholds: [], summonTypes: [], bossAttackCooldown: 0,
  },
  shielder: {
    id: "shielder", name: "MaRC Shielder",
    width: 50, height: 70, hpMult: 1.5, damageMult: 1.0, speedMult: 0.5,
    attackRange: 60, attackDuration: 0.3, hitstunThreshold: 20, headScale: 0.9,
    bodyColor: 0x888866, outlineColor: 0xaaaa88, visorColor: 0xccaa33,
    preferRetreat: false, hasShield: true, hasCharge: false, isRanged: false, isBoss: false,
    shieldReduction: 0.8, fireInterval: 0, projectileSpeed: 0, projectileDamage: 0, projectileColor: 0,
    chargeSpeed: 0, chargeDamage: 0, chargeWindup: 0, chargeDuration: 0,
    phaseThresholds: [], summonTypes: [], bossAttackCooldown: 0,
  },
  squad_leader: {
    id: "squad_leader", name: "MaRC Squad Leader",
    width: 48, height: 90, hpMult: 6.0, damageMult: 1.3, speedMult: 0.8,
    attackRange: 75, attackDuration: 0.3, hitstunThreshold: 25, headScale: 1.0,
    bodyColor: 0x556688, outlineColor: 0x778899, visorColor: 0xddaa33,
    preferRetreat: false, hasShield: false, hasCharge: false, isRanged: false, isBoss: true,
    shieldReduction: 0, fireInterval: 3.0, projectileSpeed: 250, projectileDamage: 6, projectileColor: 0xddaa33,
    chargeSpeed: 0, chargeDamage: 0, chargeWindup: 0, chargeDuration: 0,
    phaseThresholds: [0.6, 0.3],
    summonTypes: [["cadet", "cadet"], ["agent", "agent"], ["brute"]],
    bossAttackCooldown: 1.5,
  },
  field_commander: {
    id: "field_commander", name: "MaRC Field Commander",
    width: 55, height: 100, hpMult: 10.0, damageMult: 1.5, speedMult: 0.7,
    attackRange: 80, attackDuration: 0.35, hitstunThreshold: 35, headScale: 1.1,
    bodyColor: 0x2a3a5a, outlineColor: 0x4a5a7a, visorColor: 0xdd4422,
    preferRetreat: false, hasShield: false, hasCharge: true, isRanged: false, isBoss: true,
    shieldReduction: 0, fireInterval: 2.5, projectileSpeed: 280, projectileDamage: 10, projectileColor: 0xdd4422,
    chargeSpeed: 450, chargeDamage: 30, chargeWindup: 0.8, chargeDuration: 0.5,
    phaseThresholds: [0.7, 0.35],
    summonTypes: [["cadet", "cadet"], ["agent", "agent"], ["brute"]],
    bossAttackCooldown: 1.3,
  },
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
  johnFill: 0x5a8a3a,
  johnOutline: 0x7aba5a,
  johnBackpack: 0x8a6a3a,
  johnSlingshot: 0xaa8844,
  johnGadget: 0xddaa33,
};

// ════════════════════════════════════════════════════════════════
//  JOHN — Gadget Kid
// ════════════════════════════════════════════════════════════════

export const JOHN = {
  speed: 400,
  width: 36,
  height: 60,
  depthSpeed: 260,
  maxHp: 80,
  maxMp: 80,
  mpRegen: 10,
};

export type JohnDir = "neutral" | "forward" | "up" | "down" | "guard";
export type JohnButton = "L" | "H";

export interface JohnMoveDef {
  name: string;
  dir: JohnDir;
  button: JohnButton;
  damage: number;
  knockback: number;
  hitstopMs: number;
  shakeIntensity: number;
  shakeDuration: number;
  duration: number;
  hitFrame: number;
  mpCost: number;
  moveType: "melee" | "projectile" | "aoe" | "rush";
  projectile?: { radius: number; speed: number; color: number; maxRange: number };
  aoeRadius?: number;
  rushSpeed?: number;
  rushDuration?: number;
}

export const JOHN_MOVES: JohnMoveDef[] = [
  // ── Neutral (bread-and-butter) ──
  {
    name: "Bat Jab", dir: "neutral", button: "L",
    damage: 10, knockback: 100, hitstopMs: 35,
    shakeIntensity: 2, shakeDuration: 35,
    duration: 0.2, hitFrame: 0.07, mpCost: 0,
    moveType: "melee",
  },
  {
    name: "Slingshot", dir: "neutral", button: "H",
    damage: 8, knockback: 30, hitstopMs: 20,
    shakeIntensity: 1, shakeDuration: 30,
    duration: 0.25, hitFrame: 0.1, mpCost: 6,
    moveType: "projectile",
    projectile: { radius: 6, speed: 550, color: 0x998866, maxRange: 400 },
  },

  // ── Forward (advancing / aggressive) ──
  {
    name: "Bat Lunge", dir: "forward", button: "L",
    damage: 22, knockback: 250, hitstopMs: 65,
    shakeIntensity: 4, shakeDuration: 70,
    duration: 0.32, hitFrame: 0.1, mpCost: 0,
    moveType: "rush", rushSpeed: 480, rushDuration: 0.22,
  },
  {
    name: "Mega Marble", dir: "forward", button: "H",
    damage: 18, knockback: 200, hitstopMs: 60,
    shakeIntensity: 3, shakeDuration: 60,
    duration: 0.35, hitFrame: 0.12, mpCost: 10,
    moveType: "projectile",
    projectile: { radius: 12, speed: 450, color: 0x44ddaa, maxRange: 450 },
  },

  // ── Up (launcher / anti-air) ──
  {
    name: "Bat Uppercut", dir: "up", button: "L",
    damage: 18, knockback: 220, hitstopMs: 55,
    shakeIntensity: 4, shakeDuration: 65,
    duration: 0.28, hitFrame: 0.09, mpCost: 0,
    moveType: "melee",
  },
  {
    name: "Bottle Rocket", dir: "up", button: "H",
    damage: 15, knockback: 150, hitstopMs: 40,
    shakeIntensity: 3, shakeDuration: 50,
    duration: 0.38, hitFrame: 0.18, mpCost: 8,
    moveType: "projectile",
    projectile: { radius: 8, speed: 400, color: 0xee5533, maxRange: 500 },
  },

  // ── Down (ground / AoE) ──
  {
    name: "Marble Scatter", dir: "down", button: "L",
    damage: 15, knockback: 120, hitstopMs: 45,
    shakeIntensity: 3, shakeDuration: 55,
    duration: 0.3, hitFrame: 0.15, mpCost: 0,
    moveType: "aoe", aoeRadius: 90,
  },
  {
    name: "Water Balloon", dir: "down", button: "H",
    damage: 25, knockback: 200, hitstopMs: 70,
    shakeIntensity: 5, shakeDuration: 90,
    duration: 0.42, hitFrame: 0.25, mpCost: 10,
    moveType: "aoe", aoeRadius: 120,
  },

  // ── Guard (Circle + attack — defensive / space-making) ──
  {
    name: "Rubber Band Snap", dir: "guard", button: "L",
    damage: 15, knockback: 160, hitstopMs: 40,
    shakeIntensity: 3, shakeDuration: 45,
    duration: 0.18, hitFrame: 0.06, mpCost: 0,
    moveType: "melee",
  },
  {
    name: "Stink Bomb", dir: "guard", button: "H",
    damage: 12, knockback: 80, hitstopMs: 30,
    shakeIntensity: 3, shakeDuration: 50,
    duration: 0.35, hitFrame: 0.15, mpCost: 8,
    moveType: "aoe", aoeRadius: 100,
  },
];

export const JOHN_PARRY = {
  activeWindow: 0.15,
  recoveryDuration: 0.2,
  counterStunDuration: 0.5,
  followUpWindow: 0.4,
};

export const JOHN_ULTIMATE = {
  mpCost: 50,
  beamDamage: 120,
  beamKnockback: 600,
  beamHitstopMs: 150,
  beamShakeIntensity: 12,
  beamShakeDuration: 250,
  setupDuration: 0.5,
  beamDuration: 0.6,
  recoveryDuration: 0.8,
};

// ════════════════════════════════════════════════════════════════
//  LUNA — The Momentum Engine (family dog, dual-mode fighter)
// ════════════════════════════════════════════════════════════════

export const LUNA = {
  speed: 340,
  lunarSpeed: 240,
  width: 35,
  height: 35,
  lunarWidth: 40,
  lunarHeight: 80,
  depthSpeed: 150,
  maxHp: 130,
  maxMp: 80,
  mpRegen: 10,
};

export type LunaMode = "dog" | "lunar";

export interface LunaMoveDef {
  name: string;
  dir: JohnDir;
  button: JohnButton;
  damage: number;
  knockback: number;
  hitstopMs: number;
  shakeIntensity: number;
  shakeDuration: number;
  duration: number;
  hitFrame: number;
  mpCost: number;
  moveType: "melee" | "aoe" | "rush";
  aoeRadius?: number;
  rushSpeed?: number;
  rushDuration?: number;
  switchMode?: LunaMode;
}

export const LUNA_DOG_MOVES: LunaMoveDef[] = [
  {
    name: "Quick Bite", dir: "neutral", button: "L",
    damage: 8, knockback: 80, hitstopMs: 25,
    shakeIntensity: 1, shakeDuration: 25,
    duration: 0.15, hitFrame: 0.05, mpCost: 0,
    moveType: "melee",
  },
  {
    name: "Bark Push", dir: "neutral", button: "H",
    damage: 10, knockback: 180, hitstopMs: 35,
    shakeIntensity: 2, shakeDuration: 35,
    duration: 0.22, hitFrame: 0.08, mpCost: 0,
    moveType: "melee",
  },
  {
    name: "Dash Tackle", dir: "forward", button: "L",
    damage: 12, knockback: 150, hitstopMs: 40,
    shakeIntensity: 3, shakeDuration: 45,
    duration: 0.25, hitFrame: 0.08, mpCost: 0,
    moveType: "rush", rushSpeed: 520, rushDuration: 0.18,
  },
  {
    name: "Pounce", dir: "forward", button: "H",
    damage: 15, knockback: 200, hitstopMs: 55,
    shakeIntensity: 4, shakeDuration: 55,
    duration: 0.35, hitFrame: 0.12, mpCost: 5,
    moveType: "rush", rushSpeed: 600, rushDuration: 0.25,
  },
  {
    name: "Air Snap", dir: "up", button: "L",
    damage: 10, knockback: 140, hitstopMs: 35,
    shakeIntensity: 2, shakeDuration: 35,
    duration: 0.2, hitFrame: 0.07, mpCost: 0,
    moveType: "melee",
  },
  {
    name: "Leaping Bite", dir: "up", button: "H",
    damage: 14, knockback: 180, hitstopMs: 50,
    shakeIntensity: 3, shakeDuration: 50,
    duration: 0.35, hitFrame: 0.15, mpCost: 5,
    moveType: "rush", rushSpeed: 500, rushDuration: 0.25,
  },
  {
    name: "Tail Sweep", dir: "down", button: "L",
    damage: 8, knockback: 100, hitstopMs: 30,
    shakeIntensity: 2, shakeDuration: 35,
    duration: 0.2, hitFrame: 0.08, mpCost: 0,
    moveType: "aoe", aoeRadius: 80,
  },
  {
    name: "Dig Fling", dir: "down", button: "H",
    damage: 12, knockback: 160, hitstopMs: 45,
    shakeIntensity: 3, shakeDuration: 55,
    duration: 0.3, hitFrame: 0.15, mpCost: 5,
    moveType: "aoe", aoeRadius: 100,
  },
  {
    name: "Dodge Nip", dir: "guard", button: "L",
    damage: 6, knockback: 60, hitstopMs: 20,
    shakeIntensity: 1, shakeDuration: 20,
    duration: 0.18, hitFrame: 0.06, mpCost: 0,
    moveType: "rush", rushSpeed: 450, rushDuration: 0.12,
  },
  {
    name: "Moonrise", dir: "guard", button: "H",
    damage: 18, knockback: 250, hitstopMs: 65,
    shakeIntensity: 5, shakeDuration: 70,
    duration: 0.4, hitFrame: 0.2, mpCost: 10,
    moveType: "rush", rushSpeed: 550, rushDuration: 0.3,
    switchMode: "lunar",
  },
];

export const LUNA_LUNAR_MOVES: LunaMoveDef[] = [
  {
    name: "Claw Swipe", dir: "neutral", button: "L",
    damage: 14, knockback: 120, hitstopMs: 35,
    shakeIntensity: 2, shakeDuration: 35,
    duration: 0.18, hitFrame: 0.06, mpCost: 0,
    moveType: "melee",
  },
  {
    name: "Heavy Slam", dir: "neutral", button: "H",
    damage: 20, knockback: 250, hitstopMs: 70,
    shakeIntensity: 4, shakeDuration: 70,
    duration: 0.32, hitFrame: 0.14, mpCost: 0,
    moveType: "melee",
  },
  {
    name: "Rushing Claws", dir: "forward", button: "L",
    damage: 16, knockback: 180, hitstopMs: 50,
    shakeIntensity: 3, shakeDuration: 50,
    duration: 0.28, hitFrame: 0.09, mpCost: 0,
    moveType: "rush", rushSpeed: 480, rushDuration: 0.2,
  },
  {
    name: "Lunging Uppercut", dir: "forward", button: "H",
    damage: 22, knockback: 280, hitstopMs: 65,
    shakeIntensity: 5, shakeDuration: 65,
    duration: 0.35, hitFrame: 0.12, mpCost: 8,
    moveType: "rush", rushSpeed: 520, rushDuration: 0.25,
  },
  {
    name: "Rising Slash", dir: "up", button: "L",
    damage: 15, knockback: 200, hitstopMs: 45,
    shakeIntensity: 3, shakeDuration: 45,
    duration: 0.22, hitFrame: 0.08, mpCost: 0,
    moveType: "melee",
  },
  {
    name: "Sky Crash", dir: "up", button: "H",
    damage: 24, knockback: 300, hitstopMs: 75,
    shakeIntensity: 6, shakeDuration: 80,
    duration: 0.45, hitFrame: 0.2, mpCost: 10,
    moveType: "rush", rushSpeed: 400, rushDuration: 0.35,
  },
  {
    name: "Low Sweep", dir: "down", button: "L",
    damage: 12, knockback: 120, hitstopMs: 35,
    shakeIntensity: 2, shakeDuration: 40,
    duration: 0.2, hitFrame: 0.08, mpCost: 0,
    moveType: "aoe", aoeRadius: 90,
  },
  {
    name: "Ground Pound", dir: "down", button: "H",
    damage: 20, knockback: 220, hitstopMs: 65,
    shakeIntensity: 5, shakeDuration: 80,
    duration: 0.38, hitFrame: 0.2, mpCost: 8,
    moveType: "aoe", aoeRadius: 130,
  },
  {
    name: "Counter Slash", dir: "guard", button: "L",
    damage: 18, knockback: 200, hitstopMs: 50,
    shakeIntensity: 4, shakeDuration: 50,
    duration: 0.22, hitFrame: 0.08, mpCost: 0,
    moveType: "melee",
  },
  {
    name: "Revert Burst", dir: "guard", button: "H",
    damage: 15, knockback: 180, hitstopMs: 55,
    shakeIntensity: 4, shakeDuration: 60,
    duration: 0.35, hitFrame: 0.15, mpCost: 8,
    moveType: "aoe", aoeRadius: 110,
    switchMode: "dog",
  },
];

export const LUNA_ULTIMATE = {
  mpCost: 60,
  setupDuration: 0.4,
  frenzyDuration: 1.5,
  recoveryDuration: 0.5,
  fearDuration: 2.0,
  frenzyDamage: 8,
  frenzyHits: 8,
  frenzyRadius: 120,
};

export const LUNA_COLORS = {
  dogBody: 0x1a1a1a,
  dogHead: 0x2a2a2a,
  dogEars: 0x111111,
  dogNose: 0x444444,
  dogEyes: 0xddaa44,
  dogTail: 0x1a1a1a,
  lunarBody: 0x2a1a3a,
  lunarOutline: 0x6633aa,
  lunarEyes: 0xcc44ff,
  lunarClaws: 0x8855cc,
  lunarMane: 0x3a2a4a,
  momentumBar: 0xddaa33,
  modeFlash: 0x9944cc,
};

// ════════════════════════════════════════════════════════════════
//  HEATHER — Totem Amplifier (staff fighter + placeable totems)
// ════════════════════════════════════════════════════════════════

export const HEATHER = {
  speed: 260,
  width: 38,
  height: 72,
  depthSpeed: 200,
  maxHp: 120,
  maxMp: 100,
  mpRegen: 8,
};

export type HeatherDir = "neutral" | "forward" | "up" | "down";

export interface HeatherMoveDef {
  name: string;
  dir: HeatherDir;
  button: JohnButton;
  damage: number;
  knockback: number;
  hitstopMs: number;
  shakeIntensity: number;
  shakeDuration: number;
  duration: number;
  hitFrame: number;
  mpCost: number;
  moveType: "melee" | "rush" | "aoe";
  aoeRadius?: number;
  rushSpeed?: number;
  rushDuration?: number;
}

export type TotemType = "ward" | "fury" | "haste" | "barrier";

export const HEATHER_CHARGE = {
  chargeTime: 0.6,
  hoverMaxDuration: 4.0,
  wardHoverRequired: 2.0,
  chargeVisualStart: 0.2,
  chargeSpeedMult: 0.6,
};

export const HEATHER_LIGHT_MOVES: HeatherMoveDef[] = [
  {
    name: "Staff Tap", dir: "neutral", button: "L",
    damage: 8, knockback: 80, hitstopMs: 25,
    shakeIntensity: 1, shakeDuration: 25,
    duration: 0.15, hitFrame: 0.05, mpCost: 0,
    moveType: "melee",
  },
  {
    name: "Staff Thrust", dir: "forward", button: "L",
    damage: 14, knockback: 160, hitstopMs: 40,
    shakeIntensity: 3, shakeDuration: 45,
    duration: 0.28, hitFrame: 0.09, mpCost: 0,
    moveType: "rush", rushSpeed: 420, rushDuration: 0.2,
  },
  {
    name: "Rising Staff", dir: "up", button: "L",
    damage: 12, knockback: 140, hitstopMs: 35,
    shakeIntensity: 2, shakeDuration: 35,
    duration: 0.22, hitFrame: 0.08, mpCost: 0,
    moveType: "melee",
  },
  {
    name: "Low Sweep", dir: "down", button: "L",
    damage: 10, knockback: 100, hitstopMs: 30,
    shakeIntensity: 2, shakeDuration: 35,
    duration: 0.2, hitFrame: 0.08, mpCost: 0,
    moveType: "aoe", aoeRadius: 85,
  },
];

export const HEATHER_HEAVY_MOVES: HeatherMoveDef[] = [
  {
    name: "Staff Slam", dir: "neutral", button: "H",
    damage: 15, knockback: 180, hitstopMs: 55,
    shakeIntensity: 3, shakeDuration: 50,
    duration: 0.28, hitFrame: 0.12, mpCost: 0,
    moveType: "melee",
  },
  {
    name: "Lunging Smash", dir: "forward", button: "H",
    damage: 18, knockback: 220, hitstopMs: 60,
    shakeIntensity: 4, shakeDuration: 65,
    duration: 0.32, hitFrame: 0.1, mpCost: 0,
    moveType: "rush", rushSpeed: 450, rushDuration: 0.24,
  },
  {
    name: "Skyward Sweep", dir: "up", button: "H",
    damage: 14, knockback: 180, hitstopMs: 45,
    shakeIntensity: 3, shakeDuration: 45,
    duration: 0.25, hitFrame: 0.09, mpCost: 0,
    moveType: "melee",
  },
  {
    name: "Ground Strike", dir: "down", button: "H",
    damage: 16, knockback: 200, hitstopMs: 55,
    shakeIntensity: 4, shakeDuration: 60,
    duration: 0.3, hitFrame: 0.15, mpCost: 0,
    moveType: "aoe", aoeRadius: 90,
  },
];

export const HEATHER_PARRY = {
  activeWindow: 0.12,
  recoveryDuration: 0.2,
  counterStunDuration: 0.6,
  followUpWindow: 0.4,
  pulseDamage: 10,
  pulseRadius: 150,
  buffDuration: 3.0,
  buffDamageBoost: 0.25,
};

export const HEATHER_ULTIMATE = {
  mpCost: 60,
  setupDuration: 0.3,
  fieldDuration: 5.0,
  recoveryDuration: 0.5,
  fieldRadius: 250,
  tickDamage: 5,
  tickInterval: 0.5,
  healPerTick: 3,
  damageBoost: 0.3,
  speedBoost: 0.25,
};

export const TOTEM_CONFIG = {
  radius: 100,
  duration: 10.0,
  hp: 30,
  width: 16,
  height: 28,
  cooldown: 4.0,
  detonateDamage: 15,
  detonateRadius: 100,
  mpCost: { ward: 20, fury: 25, haste: 20, barrier: 25 } as Record<TotemType, number>,
  ward: { healPerSec: 4, color: 0x44cc66, glowColor: 0x66ee88 },
  fury: {
    damageBoost: 0.2, fireInterval: 1.5, fireDamage: 8,
    projectileSpeed: 300, projectileRadius: 10,
    color: 0xee6633, glowColor: 0xff8844,
    fireballColor: 0xff4422, fireballTrail: 0xffaa33,
  },
  haste: { speedBoost: 0.3, mpRegenBoost: 0.5, color: 0x4488ee, glowColor: 0x66aaff },
  barrier: { damageReduction: 0.3, color: 0xddaa33, glowColor: 0xffcc44 },
};

export const HEATHER_COLORS = {
  bodyColor: 0x884444,
  outlineColor: 0xbb6655,
  hairColor: 0x993322,
  staffColor: 0x8866aa,
  staffTip: 0xcc88ff,
  scarfColor: 0xcc2233,
  auraColor: 0xaa77dd,
  catalystPulse: 0xcc88ff,
};
