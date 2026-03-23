import {
  BoonDef, BoonSlot, BoonTrigger, BoonAction,
  EventContext, ALL_BOON_POOLS, RARITY_WEIGHTS, scaleDamage,
} from "../data/boons";

export interface SlottedBoon {
  boon: BoonDef;
  level: number;
}

function diminishingFactor(stacks: number): number {
  if (stacks <= 1) return 1;
  return 1 / (1 + 0.5 * (stacks - 1));
}

function scaleAction(action: BoonAction, level: number): BoonAction {
  if (level <= 1) return action;
  switch (action.kind) {
    case "chain_spark":
      return { ...action, damage: Math.round(scaleDamage(action.damage, level)) };
    case "lightning_aoe":
      return { ...action, damage: Math.round(scaleDamage(action.damage, level)) };
    case "damage_burst":
      return { ...action, damage: Math.round(scaleDamage(action.damage, level)) };
    case "speed_burst":
      return { ...action, duration: scaleDamage(action.duration, level) };
    case "heal":
      return { ...action, amount: scaleDamage(action.amount, level) };
    case "poison":
      return { ...action, damagePerTick: Math.round(scaleDamage(action.damagePerTick, level)) };
  }
}

export class BoonState {
  private readonly slots = new Map<BoonSlot, SlottedBoon>();
  private readonly passiveBoons: BoonDef[] = [];
  private stackCounts = new Map<string, number>();
  private cooldowns = new Map<string, number>();
  private _speedBurst = 0;
  private _speedMultiplier = 1;

  get activeBoons(): BoonDef[] {
    const result: BoonDef[] = [];
    for (const sb of this.slots.values()) result.push(sb.boon);
    result.push(...this.passiveBoons);
    return result;
  }

  getSlot(slot: BoonSlot): SlottedBoon | undefined {
    return this.slots.get(slot);
  }

  getSlotForBoon(boon: BoonDef): { current: SlottedBoon | null; resultLevel: number } {
    if (!boon.slot) return { current: null, resultLevel: 1 };
    const existing = this.slots.get(boon.slot);
    if (!existing) return { current: null, resultLevel: 1 };
    if (existing.boon.id === boon.id) {
      return { current: existing, resultLevel: existing.level + 1 };
    }
    return { current: existing, resultLevel: existing.level + 1 };
  }

  addBoon(boon: BoonDef): void {
    if (boon.slot) {
      const existing = this.slots.get(boon.slot);
      if (existing) {
        const newLevel = existing.level + 1;
        this.slots.set(boon.slot, { boon, level: newLevel });
      } else {
        this.slots.set(boon.slot, { boon, level: 1 });
      }
      return;
    }

    if (boon.stackable) {
      const current = this.stackCounts.get(boon.id) ?? 0;
      this.stackCounts.set(boon.id, current + 1);
      if (current === 0) {
        this.passiveBoons.push(boon);
      }
    } else {
      this.passiveBoons.push(boon);
    }
  }

  getStackCount(boonId: string): number {
    return this.stackCounts.get(boonId) ?? 0;
  }

  getSlotLevel(slot: BoonSlot): number {
    return this.slots.get(slot)?.level ?? 0;
  }

  get speedBurstMultiplier(): number {
    return this._speedBurst > 0 ? this._speedMultiplier : 1;
  }

  getStat(stat: string, baseValue: number): number {
    let additive = 0;
    let multiplicative = 1;

    for (const sb of this.slots.values()) {
      for (const effect of sb.boon.effects) {
        if (effect.type !== "stat") continue;
        if (effect.stat !== stat) continue;
        if (effect.mode === "add") {
          additive += scaleDamage(effect.value, sb.level);
        } else {
          const bonus = effect.value - 1;
          multiplicative *= 1 + scaleDamage(bonus, sb.level);
        }
      }
    }

    for (const boon of this.passiveBoons) {
      for (const effect of boon.effects) {
        if (effect.type !== "stat") continue;
        if (effect.stat !== stat) continue;

        if (boon.stackable) {
          const stacks = this.stackCounts.get(boon.id) ?? 1;
          let totalBonus = 0;
          for (let s = 1; s <= stacks; s++) {
            totalBonus += diminishingFactor(s);
          }

          if (effect.mode === "add") {
            additive += effect.value * totalBonus;
          } else {
            const perStackBonus = effect.value - 1;
            multiplicative *= 1 + perStackBonus * totalBonus;
          }
        } else {
          if (effect.mode === "add") additive += effect.value;
          else multiplicative *= effect.value;
        }
      }
    }

    return (baseValue + additive) * multiplicative;
  }

  getNextStackBonus(boon: BoonDef): string {
    if (!boon.stackable) return "";
    const stacks = this.stackCounts.get(boon.id) ?? 0;
    const nextFactor = diminishingFactor(stacks + 1);

    const parts: string[] = [];
    for (const effect of boon.effects) {
      if (effect.type !== "stat") continue;
      if (effect.mode === "add") {
        const val = effect.value * nextFactor;
        parts.push(`+${val.toFixed(1)} ${effect.stat}`);
      } else {
        const pct = (effect.value - 1) * nextFactor * 100;
        parts.push(`+${pct.toFixed(1)}% ${effect.stat}`);
      }
    }
    return parts.join(", ");
  }

  fireEvent(trigger: BoonTrigger, _ctx: EventContext): BoonAction[] {
    const actions: BoonAction[] = [];

    for (const sb of this.slots.values()) {
      for (const effect of sb.boon.effects) {
        if (effect.type !== "triggered") continue;
        if (effect.trigger !== trigger) continue;

        const cdKey = `${sb.boon.id}:${trigger}:${effect.action.kind}`;
        if (effect.cooldown && (this.cooldowns.get(cdKey) ?? 0) > 0) continue;

        if (effect.cooldown) {
          this.cooldowns.set(cdKey, effect.cooldown);
        }

        actions.push(scaleAction(effect.action, sb.level));
      }
    }

    return actions;
  }

  applySpeedBurst(multiplier: number, duration: number): void {
    this._speedMultiplier = multiplier;
    this._speedBurst = duration;
  }

  updateCooldowns(dt: number): void {
    for (const [key, remaining] of this.cooldowns) {
      const next = remaining - dt;
      if (next <= 0) this.cooldowns.delete(key);
      else this.cooldowns.set(key, next);
    }

    if (this._speedBurst > 0) {
      this._speedBurst -= dt;
      if (this._speedBurst <= 0) {
        this._speedBurst = 0;
        this._speedMultiplier = 1;
      }
    }
  }

  rollBoonChoices(count: number, wizardPool: string[]): BoonDef[] {
    const pool: BoonDef[] = [];
    for (const wizardName of wizardPool) {
      const boons = ALL_BOON_POOLS[wizardName];
      if (boons) pool.push(...boons);
    }

    const ownedPassiveIds = new Set(this.passiveBoons.map((b) => b.id));
    let available = pool.filter((b) => {
      if (b.slot) return true;
      return b.stackable || !ownedPassiveIds.has(b.id);
    });

    if (available.length < count) {
      const stackable = pool.filter((b) => b.stackable);
      while (available.length < count && stackable.length > 0) {
        const pick = stackable[Math.floor(Math.random() * stackable.length)];
        if (!available.some(b => b.id === pick.id)) {
          available.push(pick);
        } else {
          available.push({ ...pick });
        }
      }
    }

    if (available.length === 0) return [];
    return weightedSample(available, Math.min(count, available.length));
  }
}

function weightedSample(boons: BoonDef[], count: number): BoonDef[] {
  const weighted: { boon: BoonDef; weight: number }[] = boons.map((b) => ({
    boon: b,
    weight: RARITY_WEIGHTS[b.rarity] ?? 10,
  }));

  const result: BoonDef[] = [];
  const used = new Set<number>();

  for (let i = 0; i < count; i++) {
    const remaining = weighted.filter((_, idx) => !used.has(idx));
    if (remaining.length === 0) break;

    const totalWeight = remaining.reduce((s, w) => s + w.weight, 0);
    let roll = Math.random() * totalWeight;

    for (let j = 0; j < weighted.length; j++) {
      if (used.has(j)) continue;
      roll -= weighted[j].weight;
      if (roll <= 0) {
        result.push(weighted[j].boon);
        used.add(j);
        break;
      }
    }
  }

  return result;
}
