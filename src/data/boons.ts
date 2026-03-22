// ════════════════════════════════════════════════════════════════
//  BOON SYSTEM — Trigger + Effect combat behaviors
// ════════════════════════════════════════════════════════════════

export type BoonTrigger =
  | "onMeleeHit"
  | "onHeavyHit"
  | "onProjectileHit"
  | "onKill"
  | "onTakeDamage"
  | "onDash"
  | "onBlock"
  | "onRoomClear";

export type BoonAction =
  | { kind: "chain_spark"; damage: number; bounces: number; range: number; color: number }
  | { kind: "lightning_aoe"; damage: number; radius: number; color: number }
  | { kind: "damage_burst"; damage: number; radius: number; color: number }
  | { kind: "speed_burst"; multiplier: number; duration: number }
  | { kind: "heal"; amount: number; percent: boolean };

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
    description: "Your light attacks emit a spark that jumps to a nearby enemy.",
    wizard: "Merlin", rarity: "common", color: SPARK_COLOR,
    effects: [{
      type: "triggered", trigger: "onMeleeHit",
      action: { kind: "chain_spark", damage: 8, bounces: 1, range: 200, color: SPARK_COLOR },
      cooldown: 0.3,
    }],
  },
  {
    id: "thunder-fist",
    name: "Thunder Fist",
    description: "Your heavy attacks call down a lightning bolt on the target.",
    wizard: "Merlin", rarity: "common", color: BOLT_COLOR,
    effects: [{
      type: "triggered", trigger: "onHeavyHit",
      action: { kind: "lightning_aoe", damage: 15, radius: 90, color: BOLT_COLOR },
    }],
  },
  {
    id: "static-shield",
    name: "Static Shield",
    description: "When you block an attack, emit a spark burst that damages nearby enemies.",
    wizard: "Merlin", rarity: "common", color: BURST_COLOR,
    effects: [{
      type: "triggered", trigger: "onBlock",
      action: { kind: "damage_burst", damage: 12, radius: 120, color: BURST_COLOR },
      cooldown: 0.5,
    }],
  },
  {
    id: "arcane-vigor",
    name: "Arcane Vigor",
    description: "Merlin's magic reinforces the family. You feel tougher.",
    wizard: "Merlin", rarity: "common", color: SPARK_COLOR,
    effects: [{ type: "stat", stat: "maxHp", mode: "add", value: 30 }],
  },

  // ── Uncommon ──
  {
    id: "storm-nerves",
    name: "Storm Nerves",
    description: "After taking damage, chain lightning erupts from you.",
    wizard: "Merlin", rarity: "uncommon", color: SPARK_COLOR,
    effects: [{
      type: "triggered", trigger: "onTakeDamage",
      action: { kind: "chain_spark", damage: 10, bounces: 3, range: 180, color: SPARK_COLOR },
      cooldown: 1.0,
    }],
  },
  {
    id: "jolting-speed",
    name: "Jolting Speed",
    description: "After defeating an enemy, move 40% faster for 5 seconds.",
    wizard: "Merlin", rarity: "uncommon", color: BOLT_COLOR,
    effects: [{
      type: "triggered", trigger: "onKill",
      action: { kind: "speed_burst", multiplier: 1.4, duration: 5 },
    }],
  },
  {
    id: "chain-reaction",
    name: "Chain Reaction",
    description: "Your projectiles emit sparks that jump to 2 nearby enemies.",
    wizard: "Merlin", rarity: "uncommon", color: SPARK_COLOR,
    effects: [{
      type: "triggered", trigger: "onProjectileHit",
      action: { kind: "chain_spark", damage: 6, bounces: 2, range: 200, color: SPARK_COLOR },
      cooldown: 0.2,
    }],
  },

  // ── Rare ──
  {
    id: "electric-surge",
    name: "Electric Surge",
    description: "Your light attacks spark AND your heavy attacks call lightning. The full package.",
    wizard: "Merlin", rarity: "rare", color: BOLT_COLOR,
    effects: [
      {
        type: "triggered", trigger: "onMeleeHit",
        action: { kind: "chain_spark", damage: 10, bounces: 2, range: 200, color: SPARK_COLOR },
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
    wizard: "Merlin", rarity: "rare", color: SPARK_COLOR,
    effects: [{
      type: "triggered", trigger: "onRoomClear",
      action: { kind: "heal", amount: 30, percent: true },
    }],
  },

  // ── Legendary ──
  {
    id: "arcane-tempest",
    name: "Arcane Tempest",
    description: "ALL your attacks emit chain lightning that bounces 3 times. You become the storm.",
    wizard: "Merlin", rarity: "legendary", color: 0xffee88,
    effects: [
      {
        type: "triggered", trigger: "onMeleeHit",
        action: { kind: "chain_spark", damage: 12, bounces: 3, range: 220, color: SPARK_COLOR },
        cooldown: 0.15,
      },
      {
        type: "triggered", trigger: "onHeavyHit",
        action: { kind: "lightning_aoe", damage: 25, radius: 110, color: BOLT_COLOR },
      },
      {
        type: "triggered", trigger: "onProjectileHit",
        action: { kind: "chain_spark", damage: 8, bounces: 3, range: 220, color: SPARK_COLOR },
      },
      { type: "stat", stat: "damage", mode: "multiply", value: 1.15 },
    ],
  },
];

export const ALL_BOON_POOLS: Record<string, BoonDef[]> = {
  Merlin: MERLIN_BOONS,
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
