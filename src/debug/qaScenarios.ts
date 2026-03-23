import { QAStateAccessor } from "./QABot";
import { HeatherPlayer } from "../entities/HeatherPlayer";
import { JohnPlayer } from "../entities/JohnPlayer";
import { TrainingDummy } from "../entities/TrainingDummy";
import { COMBAT } from "../config/game";

export interface QAStep {
  time: number;
  action?: () => void;
  assert?: () => boolean;
  label: string;
}

export interface QAScenario {
  name: string;
  steps: QAStep[];
  duration: number;
}

export function buildScenario(name: string, state: QAStateAccessor): QAScenario | null {
  switch (name) {
    case "fury-totem": return buildFuryTotem(state);
    case "ward-totem": return buildWardTotem(state);
    case "haste-totem": return buildHasteTotem(state);
    case "barrier-totem": return buildBarrierTotem(state);
    case "all-totems": return buildAllTotems(state);
    case "andrew-heavy-range": return buildAndrewHeavyRange(state);
    case "andrew-combos": return buildAndrewCombos(state);
    case "andrew-combat": return buildAndrewCombat(state);
    case "john-combat": return buildJohnCombat(state);
    default: return null;
  }
}

function buildFuryTotem(s: QAStateAccessor): QAScenario {
  let maxProjsSeen = 0;
  let projFramesSeen = 0;
  let observing = false;
  return {
    name: "Fury Totem",
    duration: 12,
    steps: [
      {
        time: 0.2,
        label: "Walk right briefly",
        action: () => { window.__holdKey("d"); },
      },
      {
        time: 0.7,
        label: "Stop walking",
        action: () => { window.__releaseKey("d"); },
      },
      {
        time: 1.0,
        label: "Hold K (heavy) to charge fury totem",
        action: () => {
          window.__holdKey("k");
        },
      },
      {
        time: 2.5,
        label: "Release K — charge should have auto-completed",
        action: () => { window.__releaseKey("k"); },
      },
      {
        time: 3.0,
        label: "Assert: fury totem exists",
        assert: () => {
          const furyTotems = s.totems.filter(t => t.isAlive && t.type === "fury");
          return furyTotems.length > 0;
        },
      },
      {
        time: 3.5,
        label: "Start observing projectiles continuously",
        action: () => {
          observing = true;
          (s as any).__furyObserver = () => {
            if (!observing) return;
            const count = s.projectiles.length;
            if (count > maxProjsSeen) maxProjsSeen = count;
            if (count > 0) projFramesSeen++;
          };
        },
      },
      {
        time: 8.0,
        label: "Assert: fury totem produced projectiles (checked via continuous observation)",
        assert: () => {
          observing = false;
          console.log(`[QA DEBUG] Fury projectile observation: maxSeen=${maxProjsSeen} framesWithProjs=${projFramesSeen}`);
          const dummyCount = s.dummies.filter(d => d.isAlive).length;
          const enemyCount = s.enemies.filter(e => e.isAlive).length;
          if (dummyCount === 0 && enemyCount === 0) {
            console.log("[QA DEBUG] No targets — fury totem won't fire (expected)");
            return true;
          }
          return maxProjsSeen > 0 || projFramesSeen > 0;
        },
      },
      {
        time: 11.0,
        label: "Final state dump",
        action: () => {
          console.log(`[QA DEBUG] Final: player HP=${s.player.hp} MP=${s.player.mp.toFixed(0)}`);
          console.log(`[QA DEBUG] Final: totems=${s.totems.filter(t => t.isAlive).length} projs=${s.projectiles.length}`);
        },
      },
    ],
  };
}

function buildWardTotem(s: QAStateAccessor): QAScenario {
  let hpBefore = 0;
  return {
    name: "Ward Totem (hover charge)",
    duration: 10,
    steps: [
      {
        time: 0.5,
        label: "Record HP, take self-damage for healing test",
        action: () => {
          s.player.hp = Math.max(1, s.player.hp - 20);
          hpBefore = s.player.hp;
          console.log(`[QA DEBUG] Reduced HP to ${hpBefore} for healing test`);
        },
      },
      {
        time: 1.0,
        label: "Press Space to jump",
        action: () => { window.__pressKey("Space", 80); },
      },
      {
        time: 1.3,
        label: "Hold Space mid-air to hover",
        action: () => { window.__holdKey("Space"); },
      },
      {
        time: 3.8,
        label: "Release Space — ward should auto-place at 2s hover mark",
        action: () => { window.__releaseKey("Space"); },
      },
      {
        time: 5.0,
        label: "Assert: ward totem exists",
        assert: () => {
          const wards = s.totems.filter(t => t.isAlive && t.type === "ward");
          console.log(`[QA DEBUG] Ward totems: ${wards.length}`);
          return wards.length > 0;
        },
      },
      {
        time: 5.5,
        label: "Walk into ward range",
        action: () => {
          const ward = s.totems.find(t => t.isAlive && t.type === "ward");
          if (ward) {
            console.log(`[QA DEBUG] Ward at (${ward.x}, ${ward.y}), player at (${s.player.x}, ${s.player.y})`);
          }
        },
      },
      {
        time: 9.0,
        label: "Assert: player healed from ward",
        assert: () => {
          const healed = s.player.hp > hpBefore;
          console.log(`[QA DEBUG] HP before=${hpBefore} now=${s.player.hp} healed=${healed}`);
          return healed;
        },
      },
    ],
  };
}

function buildHasteTotem(s: QAStateAccessor): QAScenario {
  return {
    name: "Haste Totem",
    duration: 6,
    steps: [
      {
        time: 0.3,
        label: "Hold J (light) to charge haste totem",
        action: () => { window.__holdKey("j"); },
      },
      {
        time: 1.1,
        label: "Release J — haste totem should be placed",
        action: () => { window.__releaseKey("j"); },
      },
      {
        time: 1.5,
        label: "Assert: haste totem exists",
        assert: () => {
          const haste = s.totems.filter(t => t.isAlive && t.type === "haste");
          console.log(`[QA DEBUG] Haste totems: ${haste.length}`);
          return haste.length > 0;
        },
      },
      {
        time: 3.0,
        label: "Assert: player has haste status icon (lightning bolt) if in range",
        assert: () => {
          if (s.player instanceof HeatherPlayer) {
            const h = s.player as HeatherPlayer;
            const hasSpeed = h.totemSpeedMult > 1;
            const hasIcon = s.player.activeStatuses.includes("\u26A1");
            console.log(`[QA DEBUG] speedMult=${h.totemSpeedMult} hasIcon=${hasIcon} statuses=[${s.player.activeStatuses.join("")}]`);
            return hasSpeed || hasIcon;
          }
          return false;
        },
      },
    ],
  };
}

function buildBarrierTotem(s: QAStateAccessor): QAScenario {
  return {
    name: "Barrier Totem",
    duration: 6,
    steps: [
      {
        time: 0.3,
        label: "Hold F (circle/throw) to charge barrier totem",
        action: () => { window.__holdKey("f"); },
      },
      {
        time: 1.1,
        label: "Release F — barrier totem should be placed",
        action: () => { window.__releaseKey("f"); },
      },
      {
        time: 1.5,
        label: "Assert: barrier totem exists",
        assert: () => {
          const barrier = s.totems.filter(t => t.isAlive && t.type === "barrier");
          console.log(`[QA DEBUG] Barrier totems: ${barrier.length}`);
          return barrier.length > 0;
        },
      },
      {
        time: 3.0,
        label: "Assert: player has barrier buff if in range",
        assert: () => {
          if (s.player instanceof HeatherPlayer) {
            const h = s.player as HeatherPlayer;
            const hasDR = h.totemDamageReduction > 0;
            console.log(`[QA DEBUG] damageReduction=${h.totemDamageReduction} statuses=[${s.player.activeStatuses.join("")}]`);
            return hasDR;
          }
          return false;
        },
      },
    ],
  };
}

function buildAllTotems(s: QAStateAccessor): QAScenario {
  return {
    name: "All Totems",
    duration: 30,
    steps: [
      // Fury (hold K) — need ~1.1s hold (0.28s attack + 0.15s threshold + 0.6s charge)
      { time: 0.5, label: "Hold K for fury totem", action: () => window.__holdKey("k") },
      { time: 2.5, label: "Release K", action: () => window.__releaseKey("k") },
      {
        time: 3.5, label: "Assert: fury totem placed",
        assert: () => {
          const found = s.totems.some(t => t.isAlive && t.type === "fury");
          console.log(`[QA DEBUG] Fury check: ${found}, totems: ${s.totems.map(t => `${t.type}(alive=${t.isAlive})`).join(", ")}`);
          return found;
        },
      },
      // Haste (hold J) — same timing needed
      { time: 4.5, label: "Hold J for haste totem", action: () => window.__holdKey("j") },
      { time: 6.5, label: "Release J", action: () => window.__releaseKey("j") },
      {
        time: 7.5, label: "Assert: haste totem placed",
        assert: () => {
          const found = s.totems.some(t => t.isAlive && t.type === "haste");
          console.log(`[QA DEBUG] Haste check: ${found}`);
          return found;
        },
      },
      // Barrier (hold F)
      { time: 8.5, label: "Hold F for barrier totem", action: () => window.__holdKey("f") },
      { time: 10.5, label: "Release F", action: () => window.__releaseKey("f") },
      {
        time: 11.5, label: "Assert: barrier totem placed",
        assert: () => {
          const found = s.totems.some(t => t.isAlive && t.type === "barrier");
          console.log(`[QA DEBUG] Barrier check: ${found}`);
          return found;
        },
      },
      // Ward (jump + hover for 2.5s)
      { time: 13.0, label: "Jump for ward", action: () => window.__pressKey("Space", 80) },
      { time: 13.4, label: "Hold Space to hover", action: () => window.__holdKey("Space") },
      { time: 16.5, label: "Release Space", action: () => window.__releaseKey("Space") },
      {
        time: 17.5, label: "Assert: ward totem placed",
        assert: () => {
          const found = s.totems.some(t => t.isAlive && t.type === "ward");
          console.log(`[QA DEBUG] Ward check: ${found}`);
          return found;
        },
      },
      // Final checks
      {
        time: 19.0, label: "Assert: at least 3 totem types active (fury may have expired)",
        assert: () => {
          const types = new Set(s.totems.filter(t => t.isAlive).map(t => t.type));
          console.log(`[QA DEBUG] Active totem types: ${[...types].join(", ")}`);
          return types.size >= 3;
        },
      },
      {
        time: 20.0, label: "Assert: player has buff statuses",
        assert: () => {
          const hasStatuses = s.player.activeStatuses.length > 0;
          console.log(`[QA DEBUG] Statuses: [${s.player.activeStatuses.join("")}]`);
          return hasStatuses;
        },
      },
      {
        time: 28.0, label: "Final state dump",
        action: () => {
          console.log(`[QA DEBUG] Final totems: ${s.totems.filter(t => t.isAlive).length}`);
          console.log(`[QA DEBUG] Final projs: ${s.projectiles.filter(p => p.alive).length}`);
          console.log(`[QA DEBUG] Player HP=${s.player.hp} MP=${s.player.mp.toFixed(0)}`);
        },
      },
    ],
  };
}

// ═══════════════════════════════════════════════════════════
//  ANDREW/BEA SCENARIOS
// ═══════════════════════════════════════════════════════════

function nearestDummy(s: QAStateAccessor): { dummy: TrainingDummy; dist: number } | null {
  let best: TrainingDummy | null = null;
  let bestDist = Infinity;
  for (const d of s.dummies) {
    if (!d.isAlive) continue;
    const dist = Math.abs(d.x - s.player.x);
    if (dist < bestDist) { bestDist = dist; best = d; }
  }
  return best ? { dummy: best, dist: bestDist } : null;
}

function walkToAttackRange(s: QAStateAccessor, targetRange = 70): void {
  const target = nearestDummy(s);
  if (!target) return;
  const dir = target.dummy.x > s.player.x ? "d" : "a";
  if (target.dist > targetRange + 20) {
    window.__holdKey(dir);
  } else {
    window.__releaseKey("d");
    window.__releaseKey("a");
  }
}

function buildAndrewHeavyRange(s: QAStateAccessor): QAScenario {
  const observations: string[] = [];
  let dummyStartHp = 0;
  let approachInterval: ReturnType<typeof setInterval> | null = null;

  return {
    name: "Andrew Heavy Attack Range Test",
    duration: 25,
    steps: [
      {
        time: 0.2,
        label: "Log config and initial positions",
        action: () => {
          observations.push(`meleeHitRange=${COMBAT.meleeHitRange} depthRange=${COMBAT.meleeHitDepthRange}`);
          console.log(`[QA RANGE] meleeHitRange=${COMBAT.meleeHitRange} depthRange=${COMBAT.meleeHitDepthRange}`);
          const target = nearestDummy(s);
          if (target) {
            dummyStartHp = (target.dummy as any).hp ?? 100;
            console.log(`[QA RANGE] Player at x=${s.player.x.toFixed(0)}, nearest dummy at x=${target.dummy.x.toFixed(0)}, dist=${target.dist.toFixed(0)}px`);
          }
        },
      },
      {
        time: 0.5,
        label: "Smart-walk toward nearest dummy (stop at ~120px for far-range test)",
        action: () => {
          approachInterval = setInterval(() => {
            const target = nearestDummy(s);
            if (!target || target.dist < 120) {
              window.__releaseKey("d");
              window.__releaseKey("a");
              if (approachInterval) { clearInterval(approachInterval); approachInterval = null; }
            } else {
              walkToAttackRange(s, 110);
            }
          }, 50);
        },
      },
      {
        time: 2.0,
        label: "Ensure stopped, log position, try heavy from ~120px (should miss)",
        action: () => {
          if (approachInterval) { clearInterval(approachInterval); approachInterval = null; }
          window.__releaseKey("d"); window.__releaseKey("a");
          const target = nearestDummy(s);
          if (target) {
            const dist = target.dist;
            observations.push(`Test 1: distance=${dist.toFixed(0)}px`);
            console.log(`[QA RANGE] Test 1 at ${dist.toFixed(0)}px (player=${s.player.x.toFixed(0)} dummy=${target.dummy.x.toFixed(0)})`);
            dummyStartHp = (target.dummy as any).hp ?? 100;
          }
          window.__pressKey("k", 80);
        },
      },
      {
        time: 2.8,
        label: "Check far heavy result",
        action: () => {
          const target = nearestDummy(s);
          if (target) {
            const hp = (target.dummy as any).hp ?? 100;
            const dist = target.dist;
            const hit = hp < dummyStartHp;
            observations.push(`Test 1 @ ${dist.toFixed(0)}px: ${hit ? "HIT" : "MISS"} (hp ${dummyStartHp}->${hp})`);
            console.log(`[QA RANGE] Test 1 @ ${dist.toFixed(0)}px: ${hit ? "HIT!" : "MISS"} dmg=${dummyStartHp - hp}`);
            dummyStartHp = hp;
          }
        },
      },
      {
        time: 3.2,
        label: "Walk closer to ~80px",
        action: () => {
          approachInterval = setInterval(() => {
            const target = nearestDummy(s);
            if (!target || target.dist < 80) {
              window.__releaseKey("d"); window.__releaseKey("a");
              if (approachInterval) { clearInterval(approachInterval); approachInterval = null; }
            } else {
              walkToAttackRange(s, 70);
            }
          }, 50);
        },
      },
      {
        time: 4.5,
        label: "Heavy at ~80px (edge of intended range)",
        action: () => {
          if (approachInterval) { clearInterval(approachInterval); approachInterval = null; }
          window.__releaseKey("d"); window.__releaseKey("a");
          const target = nearestDummy(s);
          if (target) {
            console.log(`[QA RANGE] Test 2 at ${target.dist.toFixed(0)}px`);
            dummyStartHp = (target.dummy as any).hp ?? 100;
          }
          window.__pressKey("k", 80);
        },
      },
      {
        time: 5.3,
        label: "Check medium range heavy",
        action: () => {
          const target = nearestDummy(s);
          if (target) {
            const hp = (target.dummy as any).hp ?? 100;
            const hit = hp < dummyStartHp;
            observations.push(`Test 2 @ ${target.dist.toFixed(0)}px: ${hit ? "HIT" : "MISS"} (hp ${dummyStartHp}->${hp})`);
            console.log(`[QA RANGE] Test 2 @ ${target.dist.toFixed(0)}px: ${hit ? "HIT!" : "MISS"}`);
            dummyStartHp = hp;
          }
        },
      },
      {
        time: 5.8,
        label: "Walk to point-blank (~30px)",
        action: () => {
          approachInterval = setInterval(() => {
            const target = nearestDummy(s);
            if (!target || target.dist < 35) {
              window.__releaseKey("d"); window.__releaseKey("a");
              if (approachInterval) { clearInterval(approachInterval); approachInterval = null; }
            } else {
              walkToAttackRange(s, 30);
            }
          }, 50);
        },
      },
      {
        time: 7.5,
        label: "Heavy at point-blank",
        action: () => {
          if (approachInterval) { clearInterval(approachInterval); approachInterval = null; }
          window.__releaseKey("d"); window.__releaseKey("a");
          const target = nearestDummy(s);
          if (target) {
            console.log(`[QA RANGE] Test 3 (point blank) at ${target.dist.toFixed(0)}px`);
            dummyStartHp = (target.dummy as any).hp ?? 100;
          }
          window.__pressKey("k", 80);
        },
      },
      {
        time: 8.3,
        label: "Check point-blank heavy",
        action: () => {
          const target = nearestDummy(s);
          if (target) {
            const hp = (target.dummy as any).hp ?? 100;
            const hit = hp < dummyStartHp;
            observations.push(`Test 3 (point-blank) @ ${target.dist.toFixed(0)}px: ${hit ? "HIT" : "MISS"} (hp ${dummyStartHp}->${hp})`);
            console.log(`[QA RANGE] Test 3 @ ${target.dist.toFixed(0)}px: ${hit ? "HIT!" : "MISS"}`);
            dummyStartHp = hp;
          }
        },
      },
      {
        time: 9.0,
        label: "Walk far away (~300px from dummy)",
        action: () => { window.__holdKey("a"); },
      },
      {
        time: 10.5,
        label: "Stop and try heavy from far",
        action: () => {
          window.__releaseKey("a");
          const target = nearestDummy(s);
          if (target) {
            console.log(`[QA RANGE] Test 4 (far) at ${target.dist.toFixed(0)}px`);
            dummyStartHp = (target.dummy as any).hp ?? 100;
          }
          window.__pressKey("k", 80);
        },
      },
      {
        time: 11.3,
        label: "Check far range heavy (should MISS)",
        action: () => {
          const target = nearestDummy(s);
          if (target) {
            const hp = (target.dummy as any).hp ?? 100;
            const hit = hp < dummyStartHp;
            observations.push(`Test 4 (far) @ ${target.dist.toFixed(0)}px: ${hit ? "BUG-HIT" : "MISS"} (hp ${dummyStartHp}->${hp})`);
            console.log(`[QA RANGE] Test 4 @ ${target.dist.toFixed(0)}px: ${hit ? "BUG-HIT!" : "MISS (expected)"}`);
            dummyStartHp = hp;
          }
        },
      },
      {
        time: 12.0,
        label: "Walk back to combo range for HHH test",
        action: () => {
          approachInterval = setInterval(() => {
            const target = nearestDummy(s);
            if (!target || target.dist < 60) {
              window.__releaseKey("d"); window.__releaseKey("a");
              if (approachInterval) { clearInterval(approachInterval); approachInterval = null; }
            } else {
              walkToAttackRange(s, 50);
            }
          }, 50);
        },
      },
      {
        time: 14.0,
        label: "HHH combo (Haymaker > Haymaker 2 > Bull Rush)",
        action: () => {
          if (approachInterval) { clearInterval(approachInterval); approachInterval = null; }
          window.__releaseKey("d"); window.__releaseKey("a");
          dummyStartHp = (nearestDummy(s)?.dummy as any)?.hp ?? 100;
          console.log(`[QA RANGE] HHH start at dist=${nearestDummy(s)?.dist.toFixed(0)}px hp=${dummyStartHp}`);
          window.__pressKey("k", 80);
        },
      },
      { time: 14.6, label: "HH (Haymaker 2)", action: () => window.__pressKey("k", 80) },
      { time: 15.2, label: "HHH (Bull Rush)", action: () => window.__pressKey("k", 80) },
      {
        time: 16.5,
        label: "Check HHH combo damage",
        action: () => {
          const target = nearestDummy(s);
          if (target) {
            const hp = (target.dummy as any).hp ?? 100;
            const totalDmg = dummyStartHp - hp;
            observations.push(`HHH combo: ${totalDmg} damage (hp ${dummyStartHp}->${hp})`);
            console.log(`[QA RANGE] HHH total damage: ${totalDmg}`);
          }
        },
      },
      {
        time: 22.0,
        label: "Assert: range analysis summary",
        assert: () => {
          console.log(`[QA RANGE] === RANGE ANALYSIS ===`);
          console.log(`[QA RANGE] Config: meleeHitRange=${COMBAT.meleeHitRange}px`);
          console.log(`[QA RANGE] Hitbox placed at: player.x ± ${COMBAT.meleeHitRange}px`);
          console.log(`[QA RANGE] Hitbox radius: ${COMBAT.meleeHitRange}px (melee), ${COMBAT.meleeHitRange + 20}px (rush)`);
          console.log(`[QA RANGE] Max effective reach: ${COMBAT.meleeHitRange * 2}px (melee), ${COMBAT.meleeHitRange * 2 + 20}px (rush)`);
          console.log(`[QA RANGE] Player body width: 48px (24px from center)`);
          console.log(`[QA RANGE] Dummy body width: 36px (18px from center)`);
          console.log(`[QA RANGE] Expected melee contact: ~42px (24+18) from centers`);
          for (const obs of observations) console.log(`[QA RANGE]   ${obs}`);
          return observations.some(o => o.includes("HIT"));
        },
      },
    ],
  };
}

function buildAndrewCombos(s: QAStateAccessor): QAScenario {
  let combosSeen: string[] = [];
  let prevCombo = "";
  let approachInterval: ReturnType<typeof setInterval> | null = null;

  return {
    name: "Andrew/Bea Combo Tree Test",
    duration: 25,
    steps: [
      {
        time: 0.3,
        label: "Smart-walk to attack range of nearest dummy",
        action: () => {
          approachInterval = setInterval(() => {
            const target = nearestDummy(s);
            if (!target || target.dist < 60) {
              window.__releaseKey("d"); window.__releaseKey("a");
              if (approachInterval) { clearInterval(approachInterval); approachInterval = null; }
              console.log(`[QA COMBO] In range: dist=${target?.dist.toFixed(0)}px`);
            } else {
              walkToAttackRange(s, 50);
            }
          }, 50);
        },
      },
      {
        time: 1.5,
        label: "Ensure stopped near dummy",
        action: () => {
          if (approachInterval) { clearInterval(approachInterval); approachInterval = null; }
          window.__releaseKey("d"); window.__releaseKey("a");
          const target = nearestDummy(s);
          console.log(`[QA COMBO] Ready at dist=${target?.dist.toFixed(0)}px`);
        },
      },
      // L chain: Wind Shot x4
      {
        time: 2.2,
        label: "L chain: press J (light) — Wind Shot",
        action: () => { window.__pressKey("j", 80); },
      },
      {
        time: 2.5,
        label: "Track combo ID",
        action: () => {
          const id = s.player.currentComboId;
          if (id && id !== prevCombo) { combosSeen.push(id); prevCombo = id; }
          console.log(`[QA COMBO] Current combo: ${id}`);
        },
      },
      {
        time: 2.7,
        label: "L2: press J again",
        action: () => { window.__pressKey("j", 80); },
      },
      {
        time: 3.1,
        label: "L3: press J again",
        action: () => { window.__pressKey("j", 80); },
      },
      {
        time: 3.5,
        label: "L4: press J (Big Wind Ball)",
        action: () => { window.__pressKey("j", 80); },
      },
      {
        time: 4.2,
        label: "Assert: L chain projectiles fired",
        assert: () => {
          const id = s.player.currentComboId;
          if (id && id !== prevCombo) { combosSeen.push(id); prevCombo = id; }
          console.log(`[QA COMBO] Combos seen so far: ${combosSeen.join(", ")}`);
          return combosSeen.some(c => c.startsWith("L"));
        },
      },
      // H chain: Haymaker x3 (Bull Rush)
      {
        time: 5.0,
        label: "H chain: press K (heavy) — Haymaker",
        action: () => { window.__pressKey("k", 80); },
      },
      {
        time: 5.5,
        label: "H2: press K — Haymaker 2",
        action: () => {
          const id = s.player.currentComboId;
          if (id && id !== prevCombo) { combosSeen.push(id); prevCombo = id; }
          window.__pressKey("k", 80);
        },
      },
      {
        time: 6.0,
        label: "H3: press K — Bull Rush",
        action: () => {
          const id = s.player.currentComboId;
          if (id && id !== prevCombo) { combosSeen.push(id); prevCombo = id; }
          window.__pressKey("k", 80);
        },
      },
      {
        time: 7.0,
        label: "Assert: H chain combos registered",
        assert: () => {
          const id = s.player.currentComboId;
          if (id && id !== prevCombo) { combosSeen.push(id); prevCombo = id; }
          console.log(`[QA COMBO] Combos seen: ${combosSeen.join(", ")}`);
          return combosSeen.some(c => c.startsWith("H"));
        },
      },
      // Mixed: LH (Uppercut)
      {
        time: 8.0,
        label: "Mixed LH: press J then K — Uppercut",
        action: () => { window.__pressKey("j", 80); },
      },
      {
        time: 8.4,
        label: "LH: press K",
        action: () => { window.__pressKey("k", 80); },
      },
      {
        time: 9.2,
        label: "Track LH combo",
        action: () => {
          const id = s.player.currentComboId;
          if (id && id !== prevCombo) { combosSeen.push(id); prevCombo = id; }
          console.log(`[QA COMBO] After LH: ${combosSeen.join(", ")}`);
        },
      },
      // Mixed: HL (Shoulder Burst)
      {
        time: 10.0,
        label: "Mixed HL: press K then J — Shoulder Burst",
        action: () => { window.__pressKey("k", 80); },
      },
      {
        time: 10.5,
        label: "HL: press J",
        action: () => { window.__pressKey("j", 80); },
      },
      {
        time: 11.3,
        label: "Track HL combo",
        action: () => {
          const id = s.player.currentComboId;
          if (id && id !== prevCombo) { combosSeen.push(id); prevCombo = id; }
          console.log(`[QA COMBO] After HL: ${combosSeen.join(", ")}`);
        },
      },
      // Test jump attack
      {
        time: 12.0,
        label: "Jump attack: Space then K midair",
        action: () => { window.__pressKey("Space", 80); },
      },
      {
        time: 12.4,
        label: "Air attack (K midair)",
        action: () => { window.__pressKey("k", 80); },
      },
      // Test throw
      {
        time: 13.5,
        label: "Throw (F) — should be near dummy already",
        action: () => { window.__pressKey("f", 80); },
      },
      // Test block
      {
        time: 15.5,
        label: "Block (hold F)",
        action: () => { window.__holdKey("f"); },
      },
      {
        time: 16.5,
        label: "Release block",
        action: () => { window.__releaseKey("f"); },
      },
      // Test dash
      {
        time: 17.0,
        label: "Double-tap right to dash",
        action: () => {
          window.__pressKey("d", 50);
          setTimeout(() => window.__pressKey("d", 50), 100);
        },
      },
      // LLH (Slam) test
      {
        time: 18.5,
        label: "LLH combo: J J K — Slam",
        action: () => { window.__pressKey("j", 80); },
      },
      {
        time: 18.9,
        label: "LLH: second J",
        action: () => { window.__pressKey("j", 80); },
      },
      {
        time: 19.3,
        label: "LLH: K for Slam",
        action: () => { window.__pressKey("k", 80); },
      },
      {
        time: 20.2,
        label: "Track LLH",
        action: () => {
          const id = s.player.currentComboId;
          if (id && id !== prevCombo) { combosSeen.push(id); prevCombo = id; }
          console.log(`[QA COMBO] After LLH: ${combosSeen.join(", ")}`);
        },
      },
      {
        time: 23.0,
        label: "Assert: combo summary — at least 4 unique combos triggered",
        assert: () => {
          const unique = [...new Set(combosSeen)];
          console.log(`[QA COMBO] === COMBO SUMMARY ===`);
          console.log(`[QA COMBO] Unique combos triggered: ${unique.length}`);
          for (const c of unique) console.log(`[QA COMBO]   - ${c}`);
          return unique.length >= 4;
        },
      },
    ],
  };
}

function buildAndrewCombat(s: QAStateAccessor): QAScenario {
  let dummyDamageLog: { time: number; comboId: string; damage: number; distance: number }[] = [];
  let lastDummyHp = 100;
  let hitboxLog: { frame: number; hitboxX: number; playerX: number; range: number }[] = [];
  let frameCounter = 0;
  let approachInterval: ReturnType<typeof setInterval> | null = null;

  return {
    name: "Andrew/Bea Full Combat Test",
    duration: 30,
    steps: [
      {
        time: 0.2,
        label: "Setup continuous hitbox observer",
        action: () => {
          const target = nearestDummy(s);
          lastDummyHp = target ? ((target.dummy as any).hp ?? 100) : 100;
          (s as any).__combatObserver = () => {
            frameCounter++;
            const hitBox = s.player.getHitBox();
            if (hitBox && frameCounter % 3 === 0) {
              hitboxLog.push({
                frame: frameCounter,
                hitboxX: hitBox.x,
                playerX: s.player.x,
                range: hitBox.range,
              });
            }
            const tgt = nearestDummy(s);
            if (tgt) {
              const hp = (tgt.dummy as any).hp ?? 100;
              if (hp < lastDummyHp) {
                const comboId = s.player.currentComboId || "unknown";
                dummyDamageLog.push({
                  time: frameCounter / 60,
                  comboId,
                  damage: lastDummyHp - hp,
                  distance: tgt.dist,
                });
              }
              lastDummyHp = hp;
            }
          };
        },
      },
      {
        time: 0.5,
        label: "Smart-walk toward nearest dummy",
        action: () => {
          approachInterval = setInterval(() => {
            const target = nearestDummy(s);
            if (!target || target.dist < 55) {
              window.__releaseKey("d"); window.__releaseKey("a");
              if (approachInterval) { clearInterval(approachInterval); approachInterval = null; }
            } else {
              walkToAttackRange(s, 45);
            }
          }, 50);
        },
      },
      {
        time: 2.0,
        label: "In range — start attacking",
        action: () => {
          if (approachInterval) { clearInterval(approachInterval); approachInterval = null; }
          window.__releaseKey("d"); window.__releaseKey("a");
          console.log(`[QA COMBAT] In range at dist=${nearestDummy(s)?.dist.toFixed(0)}px`);
        },
      },
      // Cycle through various attacks
      { time: 3.0, label: "H (Haymaker)", action: () => window.__pressKey("k", 80) },
      { time: 3.6, label: "Wait...", action: () => {} },
      { time: 4.0, label: "J (Wind Shot)", action: () => window.__pressKey("j", 80) },
      { time: 4.5, label: "J J", action: () => window.__pressKey("j", 80) },
      { time: 5.0, label: "K (LLH Slam)", action: () => window.__pressKey("k", 80) },
      { time: 6.0, label: "K K", action: () => { window.__pressKey("k", 80); } },
      { time: 6.5, label: "K K K (Bull Rush)", action: () => { window.__pressKey("k", 80); setTimeout(() => window.__pressKey("k", 80), 500); } },
      { time: 8.0, label: "Jump attack", action: () => { window.__pressKey("Space", 80); setTimeout(() => window.__pressKey("k", 150), 300); } },
      { time: 9.5, label: "Light spam", action: () => {
        window.__pressKey("j", 80);
        setTimeout(() => window.__pressKey("j", 80), 300);
        setTimeout(() => window.__pressKey("j", 80), 600);
        setTimeout(() => window.__pressKey("j", 80), 900);
      }},
      { time: 12.0, label: "Heavy spam", action: () => {
        window.__pressKey("k", 80);
        setTimeout(() => window.__pressKey("k", 80), 500);
        setTimeout(() => window.__pressKey("k", 80), 1000);
      }},
      { time: 15.0, label: "Mixed L-H combos", action: () => {
        window.__pressKey("j", 80);
        setTimeout(() => window.__pressKey("k", 80), 350);
      }},
      { time: 16.5, label: "K then J (Shoulder Burst)", action: () => {
        window.__pressKey("k", 80);
        setTimeout(() => window.__pressKey("j", 80), 500);
      }},
      { time: 18.0, label: "Walk left away briefly", action: () => { window.__holdKey("a"); } },
      { time: 18.8, label: "Stop, attack from mid distance", action: () => {
        window.__releaseKey("a");
        const target = nearestDummy(s);
        console.log(`[QA COMBAT] Mid-range attack at distance=${target?.dist.toFixed(0)}`);
        window.__pressKey("k", 80);
      }},
      { time: 19.5, label: "Check mid-range result", action: () => {
        const target = nearestDummy(s);
        if (target) console.log(`[QA COMBAT] After mid-range: dist=${target.dist.toFixed(0)} hp=${(target.dummy as any).hp}`);
      }},
      { time: 20.0, label: "Walk back to attack range", action: () => {
        approachInterval = setInterval(() => {
          const target = nearestDummy(s);
          if (!target || target.dist < 55) {
            window.__releaseKey("d"); window.__releaseKey("a");
            if (approachInterval) { clearInterval(approachInterval); approachInterval = null; }
          } else {
            walkToAttackRange(s, 45);
          }
        }, 50);
      }},
      { time: 21.5, label: "Stop and throw", action: () => {
        if (approachInterval) { clearInterval(approachInterval); approachInterval = null; }
        window.__releaseKey("d"); window.__releaseKey("a");
        window.__pressKey("f", 80);
      }},
      {
        time: 27.0,
        label: "Assert: combat analysis — log all hit distances and hitbox data",
        assert: () => {
          console.log(`[QA COMBAT] === COMBAT ANALYSIS ===`);
          console.log(`[QA COMBAT] Config: meleeHitRange=${COMBAT.meleeHitRange}, depthRange=${COMBAT.meleeHitDepthRange}`);
          console.log(`[QA COMBAT] Total damage events: ${dummyDamageLog.length}`);
          for (const d of dummyDamageLog) {
            console.log(`[QA COMBAT]   t=${d.time.toFixed(1)}s combo=${d.comboId} dmg=${d.damage} dist=${d.distance.toFixed(0)}px`);
          }
          const maxHitDist = dummyDamageLog.length > 0 ? Math.max(...dummyDamageLog.map(d => d.distance)) : 0;
          const minHitDist = dummyDamageLog.length > 0 ? Math.min(...dummyDamageLog.map(d => d.distance)) : 0;
          console.log(`[QA COMBAT] Hit distance range: ${minHitDist.toFixed(0)}px — ${maxHitDist.toFixed(0)}px`);

          if (hitboxLog.length > 0) {
            const maxOffset = Math.max(...hitboxLog.map(h => Math.abs(h.hitboxX - h.playerX)));
            const maxRange = Math.max(...hitboxLog.map(h => h.range));
            console.log(`[QA COMBAT] Max hitbox offset from player: ${maxOffset.toFixed(0)}px`);
            console.log(`[QA COMBAT] Max hitbox range: ${maxRange}px`);
            console.log(`[QA COMBAT] Effective max reach: ${(maxOffset + maxRange).toFixed(0)}px from player center`);
          }

          console.log(`[QA COMBAT] Player final: HP=${s.player.hp} MP=${s.player.mp.toFixed(0)}`);
          return dummyDamageLog.length > 0;
        },
      },
    ],
  };
}

// ═══════════════════════════════════════════════════════════
//  JOHN SCENARIOS
// ═══════════════════════════════════════════════════════════

function buildJohnCombat(s: QAStateAccessor): QAScenario {
  let dummyDamageLog: { time: number; move: string; damage: number; distance: number; type: string }[] = [];
  let lastDummyHp = 100;
  let hitboxLog: { frame: number; hitboxX: number; playerX: number; range: number }[] = [];
  let projsSeen = 0;
  let frameCounter = 0;
  let approachInterval: ReturnType<typeof setInterval> | null = null;
  let moveLog: string[] = [];

  function stopWalking() {
    window.__releaseKey("d"); window.__releaseKey("a");
    window.__releaseKey("w"); window.__releaseKey("s");
    if (approachInterval) { clearInterval(approachInterval); approachInterval = null; }
  }

  function walkToRangeJ(targetDist = 50) {
    approachInterval = setInterval(() => {
      const target = nearestDummy(s);
      if (!target || target.dist < targetDist) {
        stopWalking();
      } else {
        walkToAttackRange(s, targetDist - 10);
      }
    }, 50);
  }

  return {
    name: "John Full Combat Test",
    duration: 38,
    steps: [
      {
        time: 0.2,
        label: "Setup continuous combat observer",
        action: () => {
          const target = nearestDummy(s);
          lastDummyHp = target ? ((target.dummy as any).hp ?? 100) : 100;
          (s as any).__combatObserver = () => {
            frameCounter++;
            const hitBox = s.player.getHitBox();
            if (hitBox && frameCounter % 3 === 0) {
              hitboxLog.push({ frame: frameCounter, hitboxX: hitBox.x, playerX: s.player.x, range: hitBox.range });
            }
            if (s.projectiles.length > projsSeen) projsSeen = s.projectiles.length;

            const tgt = nearestDummy(s);
            if (tgt) {
              const hp = (tgt.dummy as any).hp ?? 100;
              if (hp < lastDummyHp) {
                const moveName = (s.player as any).currentMove?.name || s.player.currentSpecialName || "unknown";
                const moveType = (s.player as any).currentMove?.moveType || "?";
                dummyDamageLog.push({ time: frameCounter / 60, move: moveName, damage: lastDummyHp - hp, distance: tgt.dist, type: moveType });
              }
              lastDummyHp = hp;
            }
          };
          console.log(`[QA JOHN] Player: HP=${s.player.hp} MP=${s.player.mp} speed=400`);
        },
      },

      // Walk to attack range
      { time: 0.5, label: "Walk to attack range", action: () => walkToRangeJ(50) },
      { time: 1.5, label: "In range", action: () => {
        stopWalking();
        console.log(`[QA JOHN] In range at dist=${nearestDummy(s)?.dist.toFixed(0)}px`);
      }},

      // NEUTRAL LIGHT: Bat Jab
      { time: 2.0, label: "Neutral + L: Bat Jab", action: () => {
        moveLog.push("Bat Jab (neutral+L)");
        window.__pressKey("j", 80);
      }},
      { time: 2.5, label: "Bat Jab again", action: () => window.__pressKey("j", 80) },

      // NEUTRAL HEAVY: Slingshot (projectile)
      { time: 3.2, label: "Neutral + H: Slingshot", action: () => {
        moveLog.push("Slingshot (neutral+H)");
        window.__pressKey("k", 80);
      }},

      // FORWARD LIGHT: Bat Lunge (rush)
      { time: 4.0, label: "Forward + L: Bat Lunge (hold D + J)", action: () => {
        moveLog.push("Bat Lunge (fwd+L)");
        window.__holdKey("d");
        setTimeout(() => {
          window.__pressKey("j", 80);
          setTimeout(() => window.__releaseKey("d"), 100);
        }, 50);
      }},

      // Reposition after rush
      { time: 5.0, label: "Reposition near dummy", action: () => walkToRangeJ(50) },
      { time: 5.8, label: "Stop", action: () => stopWalking() },

      // FORWARD HEAVY: Mega Marble (projectile)
      { time: 6.2, label: "Forward + H: Mega Marble (hold D + K)", action: () => {
        moveLog.push("Mega Marble (fwd+H)");
        window.__holdKey("d");
        setTimeout(() => {
          window.__pressKey("k", 80);
          setTimeout(() => window.__releaseKey("d"), 100);
        }, 50);
      }},

      // UP LIGHT: Bat Uppercut
      { time: 7.2, label: "Up + L: Bat Uppercut (hold W + J)", action: () => {
        moveLog.push("Bat Uppercut (up+L)");
        window.__holdKey("w");
        setTimeout(() => {
          window.__pressKey("j", 80);
          setTimeout(() => window.__releaseKey("w"), 100);
        }, 50);
      }},

      // UP HEAVY: Bottle Rocket (projectile)
      { time: 8.0, label: "Up + H: Bottle Rocket (hold W + K)", action: () => {
        moveLog.push("Bottle Rocket (up+H)");
        window.__holdKey("w");
        setTimeout(() => {
          window.__pressKey("k", 80);
          setTimeout(() => window.__releaseKey("w"), 100);
        }, 50);
      }},

      // DOWN LIGHT: Marble Scatter (AoE)
      { time: 9.0, label: "Down + L: Marble Scatter (hold S + J)", action: () => {
        moveLog.push("Marble Scatter (down+L)");
        window.__holdKey("s");
        setTimeout(() => {
          window.__pressKey("j", 80);
          setTimeout(() => window.__releaseKey("s"), 100);
        }, 50);
      }},

      // DOWN HEAVY: Water Balloon (AoE)
      { time: 10.0, label: "Down + H: Water Balloon (hold S + K)", action: () => {
        moveLog.push("Water Balloon (down+H)");
        window.__holdKey("s");
        setTimeout(() => {
          window.__pressKey("k", 80);
          setTimeout(() => window.__releaseKey("s"), 100);
        }, 50);
      }},

      // GUARD LIGHT: Rubber Band Snap (hold F past 150ms parry window, then attack)
      { time: 11.2, label: "Guard + L: Rubber Band Snap (hold F + J)", action: () => {
        moveLog.push("Rubber Band Snap (guard+L)");
        window.__holdKey("f");
        setTimeout(() => {
          window.__pressKey("j", 80);
          setTimeout(() => window.__releaseKey("f"), 200);
        }, 280);
      }},

      // GUARD HEAVY: Stink Bomb
      { time: 12.5, label: "Guard + H: Stink Bomb (hold F + K)", action: () => {
        moveLog.push("Stink Bomb (guard+H)");
        window.__holdKey("f");
        setTimeout(() => {
          window.__pressKey("k", 80);
          setTimeout(() => window.__releaseKey("f"), 200);
        }, 280);
      }},

      // Parry test (tap F far from dummy — check immediately during active window)
      { time: 14.0, label: "Walk away for parry test", action: () => window.__holdKey("a") },
      { time: 14.5, label: "Stop and parry (F tap)", action: () => {
        window.__releaseKey("a");
        moveLog.push("Parry (F tap)");
        window.__pressKey("f", 80);
        setTimeout(() => {
          const isParrying = s.player.combat.isParrying;
          const isRecovery = s.player.combat.isParryRecovery;
          console.log(`[QA JOHN] Parry check at ~50ms: isParrying=${isParrying} isParryRecovery=${isRecovery} state=${s.player.combat.state}`);
        }, 50);
      }},
      { time: 15.0, label: "Verify parry completed", action: () => {
        console.log(`[QA JOHN] Post-parry state: ${s.player.combat.state}`);
      }},

      // Jump attack
      { time: 15.5, label: "Walk back to dummy for jump attack", action: () => walkToRangeJ(60) },
      { time: 16.5, label: "Stop and jump attack", action: () => {
        stopWalking();
        moveLog.push("Air Attack (Space + K)");
        window.__pressKey("Space", 80);
        setTimeout(() => window.__pressKey("k", 100), 300);
      }},

      // Throw test
      { time: 18.0, label: "Walk to point blank for throw", action: () => walkToRangeJ(30) },
      { time: 19.5, label: "Stop and throw (F at close range)", action: () => {
        stopWalking();
        moveLog.push("Throw (F near dummy)");
        const target = nearestDummy(s);
        console.log(`[QA JOHN] Throw attempt at dist=${target?.dist.toFixed(0)}px`);
        window.__pressKey("f", 80);
      }},

      // Dash test
      { time: 21.0, label: "Double-tap right to dash", action: () => {
        moveLog.push("Dash (double-tap D)");
        window.__pressKey("d", 50);
        setTimeout(() => window.__pressKey("d", 50), 120);
      }},

      // Dash attack
      { time: 22.5, label: "Reposition for dash attack", action: () => walkToRangeJ(100) },
      { time: 23.5, label: "Dash attack (double-tap D then K)", action: () => {
        stopWalking();
        moveLog.push("Dash Attack (dash + K)");
        window.__pressKey("d", 50);
        setTimeout(() => {
          window.__pressKey("d", 50);
          setTimeout(() => window.__pressKey("k", 80), 80);
        }, 120);
      }},

      // Rapid-fire stress test
      { time: 25.0, label: "Reposition for spam phase", action: () => walkToRangeJ(45) },
      { time: 26.0, label: "Spam: rapid Bat Jabs", action: () => {
        stopWalking();
        moveLog.push("Spam phase");
        for (let i = 0; i < 5; i++) {
          setTimeout(() => window.__pressKey("j", 60), i * 250);
        }
      }},
      { time: 27.5, label: "Spam: rapid Slingshots", action: () => {
        for (let i = 0; i < 3; i++) {
          setTimeout(() => window.__pressKey("k", 60), i * 300);
        }
      }},
      { time: 29.0, label: "Spam: direction + attacks", action: () => {
        window.__holdKey("s");
        window.__pressKey("k", 80);
        setTimeout(() => { window.__releaseKey("s"); window.__holdKey("w"); window.__pressKey("j", 80); }, 500);
        setTimeout(() => window.__releaseKey("w"), 700);
      }},

      // MP drain test
      { time: 31.0, label: "Check MP after ability usage", action: () => {
        console.log(`[QA JOHN] MP after abilities: ${s.player.mp.toFixed(0)}/${80}`);
        if (s.player.mp < 80) {
          console.log(`[QA JOHN] MP drain confirmed: spent ${(80 - s.player.mp).toFixed(0)} MP`);
        } else {
          console.log(`[QA JOHN] WARNING: MP unchanged — abilities may not be costing MP`);
        }
      }},

      // Final analysis
      {
        time: 36.0,
        label: "Assert: John full combat analysis",
        assert: () => {
          console.log(`[QA JOHN] === JOHN COMBAT ANALYSIS ===`);
          console.log(`[QA JOHN] Moves attempted: ${moveLog.join(", ")}`);
          console.log(`[QA JOHN] Total damage events: ${dummyDamageLog.length}`);

          const moveNames = new Set<string>();
          for (const d of dummyDamageLog) {
            moveNames.add(d.move);
            console.log(`[QA JOHN]   t=${d.time.toFixed(1)}s move="${d.move}" type=${d.type} dmg=${d.damage} dist=${d.distance.toFixed(0)}px`);
          }

          console.log(`[QA JOHN] Unique moves that dealt damage: ${[...moveNames].join(", ")}`);
          console.log(`[QA JOHN] Max projectiles seen in one frame: ${projsSeen}`);

          if (hitboxLog.length > 0) {
            const maxOffset = Math.max(...hitboxLog.map(h => Math.abs(h.hitboxX - h.playerX)));
            const maxRange = Math.max(...hitboxLog.map(h => h.range));
            console.log(`[QA JOHN] Max hitbox offset: ${maxOffset.toFixed(0)}px, max range: ${maxRange}px`);
            console.log(`[QA JOHN] Effective max melee reach: ${(maxOffset + maxRange).toFixed(0)}px`);
          }

          const maxHitDist = dummyDamageLog.length > 0 ? Math.max(...dummyDamageLog.map(d => d.distance)) : 0;
          console.log(`[QA JOHN] Max hit distance: ${maxHitDist.toFixed(0)}px`);
          console.log(`[QA JOHN] Final: HP=${s.player.hp} MP=${s.player.mp.toFixed(0)}`);

          if (s.player instanceof JohnPlayer) {
            console.log(`[QA JOHN] Parry stun pending: ${(s.player as JohnPlayer).pendingParryStun}`);
          }

          const hasHits = dummyDamageLog.length >= 3;
          const hasMoveVariety = moveNames.size >= 2;
          console.log(`[QA JOHN] VERDICT: hits=${hasHits} variety=${hasMoveVariety}`);
          return hasHits && hasMoveVariety;
        },
      },
    ],
  };
}
