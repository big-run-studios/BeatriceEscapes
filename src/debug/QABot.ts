import Phaser from "phaser";
import { PlayerEntity } from "../entities/PlayerEntity";
import { Totem } from "../entities/Totem";
import { Projectile } from "../entities/Projectile";
import { Enemy } from "../entities/Enemy";
import { TrainingDummy } from "../entities/TrainingDummy";
import { InputManager } from "../systems/InputManager";
import { HeatherPlayer } from "../entities/HeatherPlayer";
import { buildScenario, QAScenario } from "./qaScenarios";
import type { QALogEntry } from "./autoplay";

export interface QAStateAccessor {
  player: PlayerEntity;
  totems: Totem[];
  projectiles: Projectile[];
  enemies: Enemy[];
  dummies: TrainingDummy[];
  inputMgr: InputManager;
  scene: Phaser.Scene;
}

const FREEPLAY_DURATION = 15;

export class QABot {
  private state: QAStateAccessor;
  private scenarioName: string;
  private elapsed = 0;
  private frame = 0;
  private log: QALogEntry[] = [];
  private done = false;
  private overlay: Phaser.GameObjects.Text | null = null;

  private scenario: QAScenario | null = null;
  private stepIndex = 0;
  private pendingReleases: { key: string; time: number }[] = [];

  private freeplayNextAction = 0;
  private freeplayStats = {
    attacks: 0,
    totemsPlaced: 0,
    projectilesSeen: 0,
    maxProjectiles: 0,
    healingSeen: false,
    statusesSeen: new Set<string>(),
    damageTaken: 0,
    startHp: 0,
  };

  constructor(state: QAStateAccessor, scenarioName: string) {
    this.state = state;
    this.scenarioName = scenarioName;

    this.overlay = state.scene.add.text(10, 10, "[QA] Starting...", {
      fontFamily: "monospace",
      fontSize: "11px",
      color: "#00ff88",
      backgroundColor: "#000000aa",
      padding: { x: 6, y: 4 },
      wordWrap: { width: 500 },
    });
    this.overlay.setDepth(99999);
    this.overlay.setScrollFactor(0);

    if (scenarioName !== "freeplay") {
      this.scenario = buildScenario(scenarioName, state);
      if (!this.scenario) {
        this.emit("fail", `Unknown scenario: ${scenarioName}`);
        this.done = true;
      } else {
        this.emit("info", `Scenario "${this.scenario.name}" loaded with ${this.scenario.steps.length} steps`);
      }
    } else {
      this.emit("info", `Freeplay mode: ${FREEPLAY_DURATION}s of random actions`);
      this.freeplayStats.startHp = state.player.hp;
    }

    window.__qaLog = this.log;
    window.__qaStatus = "running";
  }

  update(dt: number): void {
    if (this.done) return;
    this.elapsed += dt;
    this.frame++;

    this.processReleases();

    if (this.scenario) {
      this.runScenario();
    } else {
      this.runFreeplay(dt);
    }

    const furyObs = (this.state as any).__furyObserver;
    if (furyObs) furyObs();
    const combatObs = (this.state as any).__combatObserver;
    if (combatObs) combatObs();

    this.logDiagnostics();
    this.updateOverlay();
  }

  private logDiagnostics(): void {
    if (this.frame % 30 !== 0) return;

    const s = this.state;
    const heldKeys = [...(window.__heldKeys || [])].join(",");
    if (heldKeys) {
      console.log(`[QA DIAG] t=${this.elapsed.toFixed(2)} heldKeys=[${heldKeys}]`);
    }

    if (s.player instanceof HeatherPlayer) {
      const h = s.player as HeatherPlayer;
      const chargeType = (h as any).chargeType;
      const chargeTimer = (h as any).chargeTimer;
      const combatState = h.combat.state;
      const pending = h.pendingTotemSpawn;
      if (chargeType || pending || combatState !== "idle") {
        console.log(`[QA DIAG] t=${this.elapsed.toFixed(2)} combat=${combatState} charge=${chargeType || "none"}(${(chargeTimer || 0).toFixed(2)}) pending=${pending ? pending.type : "none"} totems=${s.totems.filter(t => t.isAlive).length}`);
      }
    }
  }

  private runScenario(): void {
    if (!this.scenario) return;

    while (this.stepIndex < this.scenario.steps.length) {
      const step = this.scenario.steps[this.stepIndex];
      if (this.elapsed < step.time) break;

      this.emit("action", `[${step.time.toFixed(1)}s] ${step.label}`);

      if (step.action) step.action();

      if (step.assert) {
        const result = step.assert();
        if (result) {
          this.emit("pass", `PASS: ${step.label}`);
        } else {
          this.emit("fail", `FAIL: ${step.label}`);
        }
      }

      this.stepIndex++;
    }

    if (this.elapsed >= this.scenario.duration) {
      this.finishScenario();
    }
  }

  private finishScenario(): void {
    const passes = this.log.filter(e => e.type === "pass").length;
    const fails = this.log.filter(e => e.type === "fail").length;
    const total = passes + fails;
    this.emit("summary", `Scenario "${this.scenarioName}" complete: ${passes}/${total} passed, ${fails} failed`);
    window.__qaStatus = fails === 0 ? "passed" : "failed";
    this.done = true;
    this.releaseAllKeys();
  }

  private runFreeplay(_dt: number): void {
    if (this.elapsed >= FREEPLAY_DURATION) {
      this.finishFreeplay();
      return;
    }

    this.observeState();

    if (this.elapsed >= this.freeplayNextAction) {
      this.doRandomAction();
      this.freeplayNextAction = this.elapsed + 0.1 + Math.random() * 0.4;
    }
  }

  private doRandomAction(): void {
    const isHeather = this.state.player instanceof HeatherPlayer;
    const roll = Math.random();

    if (isHeather) {
      if (roll < 0.20) {
        const moveKey = Math.random() < 0.5 ? "d" : "a";
        this.holdKeyFor(moveKey, 200 + Math.random() * 400);
      } else if (roll < 0.40) {
        this.pressKey("j", 80);
        this.freeplayStats.attacks++;
      } else if (roll < 0.55) {
        this.pressKey("k", 80);
        this.freeplayStats.attacks++;
      } else if (roll < 0.65) {
        this.holdKeyFor("k", 700);
        this.freeplayStats.attacks++;
      } else if (roll < 0.75) {
        this.holdKeyFor("j", 700);
        this.freeplayStats.attacks++;
      } else if (roll < 0.85) {
        this.pressKey("Space", 80);
      } else if (roll < 0.92) {
        this.holdKeyFor("f", 700);
      } else {
        this.pressKey("f", 80);
      }
    } else {
      // Andrew/Bea, John, Luna — melee-focused freeplay
      if (roll < 0.25) {
        const moveKey = Math.random() < 0.6 ? "d" : "a";
        this.holdKeyFor(moveKey, 200 + Math.random() * 500);
      } else if (roll < 0.45) {
        this.pressKey("j", 80);
        this.freeplayStats.attacks++;
      } else if (roll < 0.65) {
        this.pressKey("k", 80);
        this.freeplayStats.attacks++;
      } else if (roll < 0.75) {
        this.pressKey("Space", 80);
      } else if (roll < 0.82) {
        this.pressKey("f", 80);
        this.freeplayStats.attacks++;
      } else if (roll < 0.88) {
        // Double-tap dash
        this.pressKey("d", 50);
        setTimeout(() => window.__holdKey("d"), 100);
        this.pendingReleases.push({ key: "d", time: this.elapsed + 0.2 });
      } else if (roll < 0.94) {
        // Jump attack combo
        this.pressKey("Space", 80);
        setTimeout(() => window.__pressKey("k", 100), 300);
        this.freeplayStats.attacks++;
      } else {
        // Quick L-H combo
        this.pressKey("j", 80);
        setTimeout(() => window.__pressKey("k", 80), 300);
        this.freeplayStats.attacks += 2;
      }
    }
  }

  private observeState(): void {
    const s = this.state;

    if (this.frame % 30 === 0) {
      const totemCount = s.totems.filter(t => t.isAlive).length;
      if (totemCount > 0 && this.freeplayStats.totemsPlaced < totemCount) {
        const newTotems = totemCount - this.freeplayStats.totemsPlaced;
        this.emit("observe", `Totems active: ${totemCount} (+${newTotems} new)`);
        this.freeplayStats.totemsPlaced = totemCount;
      }

      const projCount = s.projectiles.filter(p => p.alive).length;
      if (projCount > this.freeplayStats.maxProjectiles) {
        this.freeplayStats.maxProjectiles = projCount;
      }
      if (projCount > 0) {
        this.freeplayStats.projectilesSeen++;
        if (this.freeplayStats.projectilesSeen === 1) {
          this.emit("observe", `First projectile spotted! Count: ${projCount}`);
        }
      }

      if (s.player.activeStatuses.length > 0) {
        for (const st of s.player.activeStatuses) {
          if (!this.freeplayStats.statusesSeen.has(st)) {
            this.freeplayStats.statusesSeen.add(st);
            this.emit("observe", `New status effect on player: ${st}`);
          }
        }
      }

      if (s.player.hp < this.freeplayStats.startHp) {
        this.freeplayStats.damageTaken = this.freeplayStats.startHp - s.player.hp;
      }

      if (s.player instanceof HeatherPlayer) {
        const h = s.player as HeatherPlayer;
        for (const type of ["ward", "fury", "haste", "barrier"] as const) {
          if (h.totemCooldowns[type] > 0 && this.frame % 60 === 0) {
            this.emit("observe", `Totem cooldown ${type}: ${h.totemCooldowns[type].toFixed(1)}s`);
          }
        }
      }
    }
  }

  private finishFreeplay(): void {
    const s = this.freeplayStats;
    this.emit("summary", [
      `Freeplay complete (${FREEPLAY_DURATION}s):`,
      `  Actions performed: ${s.attacks}`,
      `  Totems placed: ${s.totemsPlaced}`,
      `  Projectile frames observed: ${s.projectilesSeen}`,
      `  Max simultaneous projectiles: ${s.maxProjectiles}`,
      `  Healing observed: ${s.healingSeen}`,
      `  Status effects seen: ${[...s.statusesSeen].join(", ") || "none"}`,
      `  Damage taken: ${s.damageTaken}`,
      `  Final HP: ${this.state.player.hp}`,
      `  Final MP: ${this.state.player.mp.toFixed(0)}`,
    ].join("\n"));
    window.__qaStatus = "passed";
    this.done = true;
    this.releaseAllKeys();
  }

  // ── Input helpers ──

  pressKey(key: string, holdMs = 80): void {
    window.__holdKey(key);
    this.pendingReleases.push({ key, time: this.elapsed + holdMs / 1000 });
  }

  holdKeyFor(key: string, holdMs: number): void {
    window.__holdKey(key);
    this.pendingReleases.push({ key, time: this.elapsed + holdMs / 1000 });
  }

  holdKey(key: string): void {
    window.__holdKey(key);
  }

  releaseKey(key: string): void {
    window.__releaseKey(key);
  }

  private processReleases(): void {
    const remaining: typeof this.pendingReleases = [];
    for (const pr of this.pendingReleases) {
      if (this.elapsed >= pr.time) {
        window.__releaseKey(pr.key);
      } else {
        remaining.push(pr);
      }
    }
    this.pendingReleases = remaining;
  }

  private releaseAllKeys(): void {
    window.__releaseAll();
    this.pendingReleases = [];
  }

  // ── Logging ──

  private emit(type: QALogEntry["type"], message: string): void {
    const entry: QALogEntry = { time: this.elapsed, type, message };
    this.log.push(entry);

    const prefix = {
      info: "\x1b[36m[QA INFO]\x1b[0m",
      action: "\x1b[33m[QA ACTION]\x1b[0m",
      observe: "\x1b[35m[QA OBSERVE]\x1b[0m",
      assert: "\x1b[34m[QA ASSERT]\x1b[0m",
      pass: "\x1b[32m[QA PASS]\x1b[0m",
      fail: "\x1b[31m[QA FAIL]\x1b[0m",
      summary: "\x1b[1m[QA SUMMARY]\x1b[0m",
    }[type];

    console.log(`${prefix} ${message}`);
  }

  private updateOverlay(): void {
    if (!this.overlay) return;
    const recent = this.log.slice(-8);
    const lines = [
      `[QA] ${this.scenarioName} | ${this.elapsed.toFixed(1)}s | frame ${this.frame}`,
      `Player HP:${this.state.player.hp} MP:${this.state.player.mp.toFixed(0)} Statuses:[${this.state.player.activeStatuses.join("")}]`,
      `Totems:${this.state.totems.filter(t => t.isAlive).length} Projs:${this.state.projectiles.filter(p => p.alive).length} Enemies:${this.state.enemies.filter(e => e.isAlive).length}`,
      "---",
      ...recent.map(e => `${e.type.toUpperCase()}: ${e.message.split("\n")[0]}`),
    ];
    if (this.done) {
      lines.push("", window.__qaStatus === "passed" ? "=== ALL PASSED ===" : "=== FAILURES DETECTED ===");
    }
    this.overlay.setText(lines.join("\n"));
  }
}
