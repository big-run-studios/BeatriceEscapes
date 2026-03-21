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
  height: 180,
  duration: 0.7,
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
  projectile?: { radius: number; speed: number; color: number; maxRange: number };
  rush?: { speed: number; duration: number };
  burstCount?: number;
  children: ComboNode[];
}

const PROJ_SMALL = { radius: 8, speed: 500, color: 0x88ccff, maxRange: 400 };
const PROJ_MEDIUM = { radius: 14, speed: 400, color: 0x55aaff, maxRange: 450 };
const PROJ_BLAST = { radius: 16, speed: 350, color: 0xffcc44, maxRange: 500 };

export const COMBO_TREE: ComboNode[] = [
  // ── Square (L) branch: Bea wind shots ──
  {
    id: "L", name: "Wind Shot", input: "L",
    duration: 0.28, hitFrame: 0.1, damage: 8, knockback: 40, hitstopMs: 30,
    moveType: "projectile", visual: "bea-cast",
    shakeIntensity: 1, shakeDuration: 30,
    projectile: PROJ_SMALL,
    children: [
      {
        id: "LL", name: "Wind Shot 2", input: "L",
        duration: 0.24, hitFrame: 0.08, damage: 8, knockback: 40, hitstopMs: 30,
        moveType: "projectile", visual: "bea-cast",
        shakeIntensity: 1, shakeDuration: 30,
        projectile: PROJ_SMALL,
        children: [
          {
            id: "LLL", name: "Wind Shot 3", input: "L",
            duration: 0.22, hitFrame: 0.07, damage: 10, knockback: 50, hitstopMs: 30,
            moveType: "projectile", visual: "bea-cast",
            shakeIntensity: 1, shakeDuration: 30,
            projectile: PROJ_SMALL,
            children: [
              {
                id: "LLLL", name: "Big Wind Ball", input: "L",
                duration: 0.4, hitFrame: 0.15, damage: 20, knockback: 180, hitstopMs: 60,
                moveType: "projectile", visual: "bea-big-cast",
                shakeIntensity: 3, shakeDuration: 60,
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
            duration: 0.5, hitFrame: 0.22, damage: 28, knockback: 250, hitstopMs: 80,
            moveType: "melee", visual: "andrew-slam",
            shakeIntensity: 5, shakeDuration: 90,
            children: [],
          },
        ],
      },
      {
        id: "LH", name: "Uppercut", input: "H",
        duration: 0.45, hitFrame: 0.18, damage: 22, knockback: 200, hitstopMs: 60,
        moveType: "melee", visual: "andrew-uppercut",
        shakeIntensity: 4, shakeDuration: 70,
        children: [],
      },
    ],
  },
  // ── Triangle (H) branch: Andrew haymakers ──
  {
    id: "H", name: "Haymaker", input: "H",
    duration: 0.5, hitFrame: 0.22, damage: 25, knockback: 200, hitstopMs: 80,
    moveType: "melee", visual: "andrew-punch",
    shakeIntensity: 4, shakeDuration: 70,
    children: [
      {
        id: "HH", name: "Haymaker 2", input: "H",
        duration: 0.5, hitFrame: 0.22, damage: 25, knockback: 200, hitstopMs: 80,
        moveType: "melee", visual: "andrew-punch",
        shakeIntensity: 4, shakeDuration: 70,
        children: [
          {
            id: "HHH", name: "Bull Rush", input: "H",
            duration: 0.55, hitFrame: 0.05, damage: 30, knockback: 350, hitstopMs: 60,
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
            projectile: PROJ_BLAST,
            children: [],
          },
        ],
      },
      {
        id: "HL", name: "Shoulder Burst", input: "L",
        duration: 0.45, hitFrame: 0.1, damage: 8, knockback: 60, hitstopMs: 30,
        moveType: "burst", visual: "bea-burst",
        shakeIntensity: 2, shakeDuration: 40,
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
  groundFill: 0x1a1a2e,
  groundLine: 0x2a2a4e,
  wallFill: 0x0f0f20,
};
