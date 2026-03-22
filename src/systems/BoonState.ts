import {
  BoonDef, BoonTrigger, BoonAction,
  EventContext, ALL_BOON_POOLS, RARITY_WEIGHTS,
} from "../data/boons";

function diminishingFactor(stacks: number): number {
  if (stacks <= 1) return 1;
  return 1 / (1 + 0.5 * (stacks - 1));
}

export class BoonState {
  readonly activeBoons: BoonDef[] = [];
  private stackCounts = new Map<string, number>();
  private cooldowns = new Map<string, number>();
  private _speedBurst = 0;
  private _speedMultiplier = 1;

  addBoon(boon: BoonDef): void {
    if (boon.stackable) {
      const current = this.stackCounts.get(boon.id) ?? 0;
      this.stackCounts.set(boon.id, current + 1);
      if (current === 0) {
        this.activeBoons.push(boon);
      }
    } else {
      this.activeBoons.push(boon);
    }
  }

  getStackCount(boonId: string): number {
    return this.stackCounts.get(boonId) ?? 0;
  }

  get speedBurstMultiplier(): number {
    return this._speedBurst > 0 ? this._speedMultiplier : 1;
  }

  getStat(stat: string, baseValue: number): number {
    let additive = 0;
    let multiplicative = 1;

    for (const boon of this.activeBoons) {
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

    for (const boon of this.activeBoons) {
      for (const effect of boon.effects) {
        if (effect.type !== "triggered") continue;
        if (effect.trigger !== trigger) continue;

        const cdKey = `${boon.id}:${trigger}:${effect.action.kind}`;
        if (effect.cooldown && (this.cooldowns.get(cdKey) ?? 0) > 0) continue;

        if (effect.cooldown) {
          this.cooldowns.set(cdKey, effect.cooldown);
        }

        actions.push(effect.action);
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

    const owned = new Set(this.activeBoons.map((b) => b.id));
    const available = pool.filter((b) => b.stackable || !owned.has(b.id));
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
