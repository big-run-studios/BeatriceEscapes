// ════════════════════════════════════════════════════════════════
//  BOON SYSTEM — Trigger + Effect combat behaviors
// ════════════════════════════════════════════════════════════════

export type BoonTrigger =
  | "onLightHit"
  | "onMeleeHit"
  | "onHeavyHit"
  | "onProjectileHit"
  | "onKill"
  | "onTakeDamage"
  | "onDash"
  | "onBlock"
  | "onRoomClear";

export type BoonSlot =
  | "attack"    // Hades: Attack  — onLightHit / onMeleeHit
  | "special"   // Hades: Special — onHeavyHit
  | "cast"      // Hades: Cast    — onProjectileHit
  | "dash"      // Hades: Dash    — onDash (future)
  | "revenge"   // Hades: Revenge — onTakeDamage
  | "block"     // game-unique    — onBlock
  | "aid";      // Hades: Aid     — onKill / onRoomClear

export const SLOT_LABELS: Record<BoonSlot, string> = {
  attack:  "Attack",
  special: "Special",
  cast:    "Cast",
  dash:    "Dash",
  revenge: "Revenge",
  block:   "Block",
  aid:     "Aid",
};

export const LEVEL_MULTIPLIERS = [1.0, 1.0, 1.5, 1.85, 2.1, 2.3, 2.45];

export function scaleDamage(base: number, level: number): number {
  const idx = Math.min(level, LEVEL_MULTIPLIERS.length - 1);
  return base * LEVEL_MULTIPLIERS[idx];
}

export type BoonAction =
  | { kind: "chain_spark"; damage: number; bounces: number; range: number; color: number }
  | { kind: "lightning_aoe"; damage: number; radius: number; color: number }
  | { kind: "damage_burst"; damage: number; radius: number; color: number }
  | { kind: "speed_burst"; multiplier: number; duration: number }
  | { kind: "heal"; amount: number; percent: boolean }
  | { kind: "poison"; damagePerTick: number; ticks: number; interval: number; color: number };

export type BoonEffect =
  | { type: "stat"; stat: string; mode: "add" | "multiply"; value: number }
  | { type: "triggered"; trigger: BoonTrigger; action: BoonAction; cooldown?: number };

export type BoonRarity = "common" | "uncommon" | "rare" | "legendary";

export interface BoonDef {
  id: string;
  name: string;
  description: string;
  wizard: string;
  rarity: BoonRarity;
  effects: BoonEffect[];
  color: number;
  icon?: string;
  stackable?: boolean;
  slot?: BoonSlot;
}

export interface EventContext {
  x: number;
  y: number;
  targetX?: number;
  targetY?: number;
}

// ════════════════════════════════════════════════════════════════
//  MERLIN'S BOON POOL — Arcane Spark (mapped from Zeus)
// ════════════════════════════════════════════════════════════════

const SPARK_COLOR = 0x88ddff;
const BOLT_COLOR = 0xaaeeff;
const BURST_COLOR = 0x66bbdd;

export const MERLIN_BOONS: BoonDef[] = [
  // ── Common ──
  {
    id: "spark-strike",
    name: "Spark Strike",
    description: "Your light attacks emit a spark that deals 8 damage to a nearby enemy.",
    wizard: "Merlin", rarity: "common", color: SPARK_COLOR, icon: "spark-strike", slot: "attack",
    effects: [{
      type: "triggered", trigger: "onLightHit",
      action: { kind: "chain_spark", damage: 8, bounces: 1, range: 400, color: SPARK_COLOR },
      cooldown: 0.3,
    }],
  },
  {
    id: "thunder-fist",
    name: "Thunder Fist",
    description: "Your heavy attacks call down a lightning bolt for 15 damage.",
    wizard: "Merlin", rarity: "common", color: BOLT_COLOR, icon: "thunder-fist", slot: "special",
    effects: [{
      type: "triggered", trigger: "onHeavyHit",
      action: { kind: "lightning_aoe", damage: 15, radius: 90, color: BOLT_COLOR },
    }],
  },
  {
    id: "static-shield",
    name: "Static Shield",
    description: "When you block, emit a spark burst for 12 damage to nearby enemies.",
    wizard: "Merlin", rarity: "common", color: BURST_COLOR, icon: "static-shield", slot: "block",
    effects: [{
      type: "triggered", trigger: "onBlock",
      action: { kind: "damage_burst", damage: 12, radius: 120, color: BURST_COLOR },
      cooldown: 0.5,
    }],
  },
  {
    id: "arcane-vigor",
    name: "Arcane Vigor",
    description: "Merlin's magic reinforces the family. +30 Max HP.",
    wizard: "Merlin", rarity: "common", color: SPARK_COLOR, icon: "arcane-vigor",
    effects: [{ type: "stat", stat: "maxHp", mode: "add", value: 30 }],
  },

  // ── Uncommon ──
  {
    id: "storm-nerves",
    name: "Storm Nerves",
    description: "After taking damage, chain lightning deals 10 damage and bounces 3 times.",
    wizard: "Merlin", rarity: "uncommon", color: SPARK_COLOR, icon: "storm-nerves", slot: "revenge",
    effects: [{
      type: "triggered", trigger: "onTakeDamage",
      action: { kind: "chain_spark", damage: 10, bounces: 3, range: 400, color: SPARK_COLOR },
      cooldown: 1.0,
    }],
  },
  {
    id: "jolting-speed",
    name: "Jolting Speed",
    description: "After defeating an enemy, move 40% faster for 5 seconds.",
    wizard: "Merlin", rarity: "uncommon", color: BOLT_COLOR, icon: "jolting-speed", slot: "aid",
    effects: [{
      type: "triggered", trigger: "onKill",
      action: { kind: "speed_burst", multiplier: 1.4, duration: 5 },
    }],
  },
  {
    id: "chain-reaction",
    name: "Chain Reaction",
    description: "Your projectiles emit sparks that deal 6 damage and bounce to 2 enemies.",
    wizard: "Merlin", rarity: "uncommon", color: SPARK_COLOR, icon: "chain-reaction", slot: "cast",
    effects: [{
      type: "triggered", trigger: "onProjectileHit",
      action: { kind: "chain_spark", damage: 6, bounces: 2, range: 400, color: SPARK_COLOR },
      cooldown: 0.2,
    }],
  },

  // ── Rare ──
  {
    id: "electric-surge",
    name: "Electric Surge",
    description: "Light attacks spark for 10 damage. Heavy attacks call lightning for 20 damage.",
    wizard: "Merlin", rarity: "rare", color: BOLT_COLOR, icon: "electric-surge", slot: "attack",
    effects: [
      {
        type: "triggered", trigger: "onLightHit",
        action: { kind: "chain_spark", damage: 10, bounces: 2, range: 400, color: SPARK_COLOR },
        cooldown: 0.3,
      },
      {
        type: "triggered", trigger: "onHeavyHit",
        action: { kind: "lightning_aoe", damage: 20, radius: 100, color: BOLT_COLOR },
      },
    ],
  },
  {
    id: "arcane-restoration",
    name: "Arcane Restoration",
    description: "After clearing a room, Merlin's magic heals you for 30% of your max HP.",
    wizard: "Merlin", rarity: "rare", color: SPARK_COLOR, icon: "arcane-restoration", slot: "aid",
    effects: [{
      type: "triggered", trigger: "onRoomClear",
      action: { kind: "heal", amount: 30, percent: true },
    }],
  },

  // ── Legendary ──
  {
    id: "arcane-tempest",
    name: "Arcane Tempest",
    description: "ALL attacks emit chain lightning (12 dmg, 3 bounces). Heavy calls 25 dmg bolt. +15% damage.",
    wizard: "Merlin", rarity: "legendary", color: 0xffee88, icon: "arcane-tempest", slot: "attack",
    effects: [
      {
        type: "triggered", trigger: "onLightHit",
        action: { kind: "chain_spark", damage: 12, bounces: 3, range: 450, color: SPARK_COLOR },
        cooldown: 0.15,
      },
      {
        type: "triggered", trigger: "onHeavyHit",
        action: { kind: "lightning_aoe", damage: 25, radius: 110, color: BOLT_COLOR },
      },
      { type: "stat", stat: "damage", mode: "multiply", value: 1.15 },
    ],
  },
];

// ════════════════════════════════════════════════════════════════
//  MERLIN'S BASE STAT BOONS — Stackable with diminishing returns
// ════════════════════════════════════════════════════════════════

const STAT_COLOR = 0x99bbdd;

export const MERLIN_BASE_BOONS: BoonDef[] = [
  {
    id: "arcane-might",
    name: "Arcane Might",
    description: "All attacks deal +20% more damage.",
    wizard: "Merlin", rarity: "common", color: STAT_COLOR, icon: "arcane-might", stackable: true,
    effects: [{ type: "stat", stat: "damage", mode: "multiply", value: 1.20 }],
  },
  {
    id: "arcane-swiftness",
    name: "Arcane Swiftness",
    description: "+15% movement speed.",
    wizard: "Merlin", rarity: "common", color: STAT_COLOR, icon: "arcane-swiftness", stackable: true,
    effects: [{ type: "stat", stat: "speed", mode: "multiply", value: 1.15 }],
  },
  {
    id: "arcane-fortitude",
    name: "Arcane Fortitude",
    description: "+25 Max HP.",
    wizard: "Merlin", rarity: "common", color: STAT_COLOR, icon: "arcane-fortitude", stackable: true,
    effects: [{ type: "stat", stat: "maxHp", mode: "add", value: 25 }],
  },
  {
    id: "arcane-focus",
    name: "Arcane Focus",
    description: "+20 Max MP.",
    wizard: "Merlin", rarity: "common", color: STAT_COLOR, icon: "arcane-focus", stackable: true,
    effects: [{ type: "stat", stat: "maxMp", mode: "add", value: 20 }],
  },
  {
    id: "arcane-flow",
    name: "Arcane Flow",
    description: "+3 MP regen per second.",
    wizard: "Merlin", rarity: "common", color: STAT_COLOR, icon: "arcane-flow", stackable: true,
    effects: [{ type: "stat", stat: "mpRegen", mode: "add", value: 3 }],
  },
  {
    id: "arcane-guard",
    name: "Arcane Guard",
    description: "+8% block damage reduction.",
    wizard: "Merlin", rarity: "common", color: STAT_COLOR, icon: "arcane-guard", stackable: true,
    effects: [{ type: "stat", stat: "blockReduction", mode: "add", value: 0.08 }],
  },
];

// ════════════════════════════════════════════════════════════════
//  MORGAN'S BOON POOL — Nature's Venom (poison DOT)
// ════════════════════════════════════════════════════════════════

const VENOM_COLOR = 0x33cc33;
const TOXIN_COLOR = 0x66dd44;
const BLIGHT_COLOR = 0x22aa66;

export const MORGAN_BOONS: BoonDef[] = [
  {
    id: "toxic-strike",
    name: "Toxic Strike",
    description: "Light attacks poison the target for 4 damage every 0.3s (5 ticks).",
    wizard: "Morgan", rarity: "common", color: VENOM_COLOR, icon: "toxic-strike", slot: "attack",
    effects: [{
      type: "triggered", trigger: "onLightHit",
      action: { kind: "poison", damagePerTick: 4, ticks: 5, interval: 0.3, color: VENOM_COLOR },
      cooldown: 0.4,
    }],
  },
  {
    id: "venomous-shot",
    name: "Venomous Shot",
    description: "Projectiles poison the target for 5 damage every 0.3s (4 ticks).",
    wizard: "Morgan", rarity: "common", color: TOXIN_COLOR, icon: "venomous-shot", slot: "cast",
    effects: [{
      type: "triggered", trigger: "onProjectileHit",
      action: { kind: "poison", damagePerTick: 5, ticks: 4, interval: 0.3, color: TOXIN_COLOR },
      cooldown: 0.3,
    }],
  },
  {
    id: "natures-resilience",
    name: "Nature's Resilience",
    description: "+20 Max HP.",
    wizard: "Morgan", rarity: "common", color: BLIGHT_COLOR, icon: "natures-resilience", stackable: true,
    effects: [{ type: "stat", stat: "maxHp", mode: "add", value: 20 }],
  },
  {
    id: "toxic-cloud",
    name: "Toxic Cloud",
    description: "On kill, poison all nearby enemies for 4 damage every 0.25s (6 ticks).",
    wizard: "Morgan", rarity: "uncommon", color: VENOM_COLOR, icon: "toxic-cloud", slot: "aid",
    effects: [{
      type: "triggered", trigger: "onKill",
      action: { kind: "poison", damagePerTick: 4, ticks: 6, interval: 0.25, color: VENOM_COLOR },
      cooldown: 0.5,
    }],
  },
  {
    id: "nettleguard",
    name: "Nettleguard",
    description: "When you block, poison the attacker for 6 damage every 0.3s (5 ticks).",
    wizard: "Morgan", rarity: "uncommon", color: BLIGHT_COLOR, icon: "nettleguard", slot: "block",
    effects: [{
      type: "triggered", trigger: "onBlock",
      action: { kind: "poison", damagePerTick: 6, ticks: 5, interval: 0.3, color: BLIGHT_COLOR },
      cooldown: 0.5,
    }],
  },
  {
    id: "festering-wounds",
    name: "Festering Wounds",
    description: "Heavy attacks poison for 8 dmg every 0.25s (6 ticks) and burst for 10 damage.",
    wizard: "Morgan", rarity: "rare", color: TOXIN_COLOR, icon: "festering-wounds", slot: "special",
    effects: [
      {
        type: "triggered", trigger: "onHeavyHit",
        action: { kind: "poison", damagePerTick: 8, ticks: 6, interval: 0.25, color: TOXIN_COLOR },
      },
      {
        type: "triggered", trigger: "onHeavyHit",
        action: { kind: "damage_burst", damage: 10, radius: 100, color: VENOM_COLOR },
      },
    ],
  },
  {
    id: "pandemic",
    name: "Pandemic",
    description: "ALL attacks poison targets (light: 5 dmg, heavy: 7 dmg). +15% damage.",
    wizard: "Morgan", rarity: "legendary", color: 0x88ff44, icon: "pandemic", slot: "attack",
    effects: [
      {
        type: "triggered", trigger: "onLightHit",
        action: { kind: "poison", damagePerTick: 5, ticks: 5, interval: 0.25, color: VENOM_COLOR },
        cooldown: 0.2,
      },
      {
        type: "triggered", trigger: "onHeavyHit",
        action: { kind: "poison", damagePerTick: 7, ticks: 5, interval: 0.25, color: TOXIN_COLOR },
      },
      { type: "stat", stat: "damage", mode: "multiply", value: 1.15 },
    ],
  },
];

export const MORGAN_BASE_BOONS: BoonDef[] = [
  {
    id: "bramble-strength",
    name: "Bramble Strength",
    description: "+15% attack damage.",
    wizard: "Morgan", rarity: "common", color: BLIGHT_COLOR, icon: "bramble-strength", stackable: true,
    effects: [{ type: "stat", stat: "damage", mode: "multiply", value: 1.15 }],
  },
  {
    id: "wild-vitality",
    name: "Wild Vitality",
    description: "+20 Max HP.",
    wizard: "Morgan", rarity: "common", color: BLIGHT_COLOR, icon: "wild-vitality", stackable: true,
    effects: [{ type: "stat", stat: "maxHp", mode: "add", value: 20 }],
  },
  {
    id: "forest-stride",
    name: "Forest Stride",
    description: "+12% movement speed.",
    wizard: "Morgan", rarity: "common", color: BLIGHT_COLOR, icon: "forest-stride", stackable: true,
    effects: [{ type: "stat", stat: "speed", mode: "multiply", value: 1.12 }],
  },
];

export const ALL_BOON_POOLS: Record<string, BoonDef[]> = {
  Merlin: [...MERLIN_BOONS, ...MERLIN_BASE_BOONS],
  Morgan: [...MORGAN_BOONS, ...MORGAN_BASE_BOONS],
};

export const RARITY_WEIGHTS: Record<BoonRarity, number> = {
  common: 50,
  uncommon: 30,
  rare: 15,
  legendary: 5,
};

export const RARITY_COLORS: Record<BoonRarity, number> = {
  common: 0x8899aa,
  uncommon: 0x55bb55,
  rare: 0x5588dd,
  legendary: 0xdd8822,
};

export const ALL_BOON_ICON_IDS: string[] = (() => {
  const ids = new Set<string>();
  for (const pool of Object.values(ALL_BOON_POOLS)) {
    for (const b of pool) if (b.icon) ids.add(b.icon);
  }
  return [...ids];
})();
