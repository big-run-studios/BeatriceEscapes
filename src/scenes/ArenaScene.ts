import Phaser from "phaser";
import {
  GAME_WIDTH, GAME_HEIGHT, ARENA, COLORS, COMBAT, COMBO_TREE, ComboNode,
  ULTIMATE, RUN, PICKUP, ENEMY_AI,
} from "../config/game";
import { InputManager, Action } from "../systems/InputManager";
import { HitFeel } from "../systems/HitFeel";
import { RunState } from "../systems/RunState";
import { Player } from "../entities/Player";
import { TrainingDummy } from "../entities/TrainingDummy";
import { Enemy, EnemyRole, PlayerIntent } from "../entities/Enemy";
import { Projectile } from "../entities/Projectile";
import { Pickup } from "../entities/Pickup";

interface ArenaConfig {
  mode: "dummies" | "enemies" | "run";
  character: string;
  startCount: number;
  startLevel: number;
}

export class ArenaScene extends Phaser.Scene {
  private input_mgr!: InputManager;
  private hitFeel!: HitFeel;
  private runState!: RunState;
  private player!: Player;
  private dummies: TrainingDummy[] = [];
  private enemies: Enemy[] = [];
  private projectiles: Projectile[] = [];
  private pickups: Pickup[] = [];
  private rushHitDummies: Set<TrainingDummy> = new Set();
  private rushHitEnemies: Set<Enemy> = new Set();
  private comboListTexts: Map<string, Phaser.GameObjects.Text> = new Map();
  private comboNameDisplay!: Phaser.GameObjects.Text;
  private moneyDisplay!: Phaser.GameObjects.Text;
  private waveDisplay!: Phaser.GameObjects.Text;

  private config!: ArenaConfig;
  private currentWave = 0;
  private waveActive = false;
  private wavePauseTimer = 0;
  private knockoutTriggered = false;
  private victoryTriggered = false;
  private sceneEnding = false;

  constructor() {
    super({ key: "ArenaScene" });
  }

  init(data: Partial<ArenaConfig>): void {
    this.config = {
      mode: data.mode ?? "dummies",
      character: data.character ?? "andrew-bea",
      startCount: data.startCount ?? 3,
      startLevel: data.startLevel ?? 1,
    };
  }

  create(): void {
    this.input_mgr = new InputManager(this);
    this.hitFeel = new HitFeel(this);

    if (this.config.mode === "run") {
      const reg = this.game.registry.get("runState") as RunState | undefined;
      if (reg) {
        this.runState = reg;
      } else {
        this.runState = new RunState();
      }
    } else {
      this.runState = new RunState();
    }

    this.dummies = [];
    this.enemies = [];
    this.projectiles = [];
    this.pickups = [];
    this.rushHitDummies.clear();
    this.rushHitEnemies.clear();
    this.currentWave = 0;
    this.waveActive = false;
    this.wavePauseTimer = 0;
    this.knockoutTriggered = false;
    this.victoryTriggered = false;
    this.sceneEnding = false;
    this.comboListTexts.clear();

    this.drawArena();

    const startX = ARENA.width / 2 - 150;
    const startY = ARENA.groundY + ARENA.groundHeight / 2;
    this.player = new Player(this, startX, startY, this.input_mgr, this.hitFeel);
    this.player.setDummyProvider(() => this.getAllTargets());
    if (this.config.mode === "run") {
      this.player.setBoonState(this.runState.boons);
    }

    if (this.config.mode === "dummies") {
      this.spawnDummies();
    } else if (this.config.mode === "run") {
      this.spawnRunRoom();
    } else {
      this.startNextWave();
    }

    this.setupCamera();
    this.addHUD();

    this.cameras.main.fadeIn(400, 0, 0, 0);
  }

  update(_time: number, delta: number): void {
    if (this.sceneEnding) {
      this.input_mgr.postUpdate();
      return;
    }

    if (this.input_mgr.justPressed(Action.PAUSE) && !this.knockoutTriggered && !this.victoryTriggered) {
      this.returnToHub();
      return;
    }

    const dt = delta / 1000;
    this.player.update(dt);

    this.processProjectileSpawns();

    for (const dummy of this.dummies) dummy.update(dt);
    this.assignEnemyRoles();
    const intent = this.buildPlayerIntent();
    for (const enemy of this.enemies) {
      enemy.setPlayerIntent(intent);
      enemy.setAllEnemies(this.enemies);
      enemy.update(dt);
    }
    for (const proj of this.projectiles) proj.update(dt);
    for (const pickup of this.pickups) pickup.update(dt);

    this.checkMeleeHits();
    this.checkDashAttackHits();
    this.checkProjectileHits();
    this.checkAoeHits();
    this.checkUltimateBlast();
    this.checkEnemyAttacks();
    this.checkPickupCollection();
    this.pruneDeadProjectiles();
    this.pruneDeadPickups();
    this.updateComboDisplay();
    this.updateMoneyDisplay();

    if (this.config.mode === "run") {
      this.runState.boons.updateCooldowns(dt);
      this.handleRunRoomLogic();
      this.checkKnockout();
    } else if (this.config.mode === "enemies") {
      this.handleWaveLogic(dt);
      this.checkKnockout();
    }

    this.input_mgr.postUpdate();
  }

  // ── Targets (enemies + dummies share the TrainingDummy interface for throws) ──

  private getAllTargets(): TrainingDummy[] {
    return this.dummies;
  }

  // ── Spawning ──

  private spawnDummies(): void {
    const cx = ARENA.width / 2;
    const cy = ARENA.groundY + ARENA.groundHeight / 2;
    this.dummies.push(new TrainingDummy(this, cx + 120, cy));
    this.dummies.push(new TrainingDummy(this, cx + 280, cy - 40));
    this.dummies.push(new TrainingDummy(this, cx + 200, cy + 60));
  }

  private spawnEnemyWave(count: number, level: number): void {
    const cx = ARENA.width / 2;
    const cy = ARENA.groundY + ARENA.groundHeight / 2;
    for (let i = 0; i < count; i++) {
      const x = cx + 200 + Math.random() * 300;
      const y = cy + (Math.random() - 0.5) * 200;
      const enemy = new Enemy(this, x, y, level);
      this.enemies.push(enemy);
    }
  }

  private spawnRunRoom(): void {
    const room = this.runState.currentRoomDef;
    if (!room) return;

    let count = room.enemyCount;
    let level = room.enemyLevel;

    if (room.type === "miniboss") {
      count = Math.max(count, 1);
      level = Math.max(level, 3);
    }

    this.spawnEnemyWave(count, level);

    if (room.type === "miniboss") {
      for (const enemy of this.enemies) {
        enemy.maxHp = Math.floor(enemy.maxHp * 3);
        enemy.hp = enemy.maxHp;
      }
    }

    this.waveActive = true;
    this.showWaveAnnouncement(room.label);
  }

  // ── AI Coordination ──

  private assignEnemyRoles(): void {
    const living = this.enemies.filter((e) => e.isAlive && !e.isDead);
    if (living.length === 0) return;

    const px = this.player.x;
    const py = this.player.y;

    living.sort((a, b) => {
      const da = Math.abs(a.x - px) + Math.abs(a.y - py);
      const db = Math.abs(b.x - px) + Math.abs(b.y - py);
      return da - db;
    });

    const slots = ENEMY_AI.engageSlots;

    for (let i = 0; i < living.length; i++) {
      const enemy = living[i];
      let role: EnemyRole;
      if (i < slots) {
        role = "engage";
      } else if (i < slots + 2) {
        role = "flank";
      } else {
        role = "circle";
      }

      const dx = enemy.x - px;
      const dist = Math.abs(dx);
      if (role !== "engage" && dist < 100) {
        role = "retreat";
      }

      enemy.role = role;
    }
  }

  private buildPlayerIntent(): PlayerIntent {
    const combat = this.player.combat;
    return {
      x: this.player.x,
      y: this.player.y,
      attacking: combat.isAttacking || combat.isDashAttacking,
      facingRight: this.player.facingRight,
      projectiles: this.projectiles
        .filter((p) => p.alive)
        .map((p) => ({ x: p.x, y: p.y, facingRight: p.facingRight })),
    };
  }

  // ── Run room logic ──

  private handleRunRoomLogic(): void {
    if (this.knockoutTriggered || this.victoryTriggered) return;
    if (!this.waveActive) return;

    const allDead = this.enemies.every((e) => !e.isAlive);
    if (!allDead) return;

    this.waveActive = false;
    this.handleEnemyDeathDrops();
    this.cleanupDeadEnemies();

    this.fireBoonEvent("onRoomClear", { x: this.player.x, y: this.player.y });

    this.victoryTriggered = true;
    this.sceneEnding = true;

    this.time.delayedCall(800, () => {
      this.runState.advanceRoom();

      this.cameras.main.fadeOut(400, 0, 0, 0);
      this.cameras.main.once("camerafadeoutcomplete", () => {
        this.scene.start("RoomMapScene");
      });
    });
  }

  private fireBoonEvent(trigger: import("../data/boons").BoonTrigger, ctx: import("../data/boons").EventContext): void {
    const actions = this.runState.boons.fireEvent(trigger, ctx);

    for (const action of actions) {
      switch (action.kind) {
        case "chain_spark":
          this.spawnChainSpark(ctx.targetX ?? ctx.x, ctx.targetY ?? ctx.y, action.damage, action.bounces, action.range, action.color);
          break;
        case "lightning_aoe":
          this.spawnLightningAoe(ctx.targetX ?? ctx.x, ctx.targetY ?? ctx.y, action.damage, action.radius, action.color);
          break;
        case "damage_burst":
          this.spawnDamageBurst(ctx.x, ctx.y, action.damage, action.radius, action.color);
          break;
        case "speed_burst":
          this.runState.boons.applySpeedBurst(action.multiplier, action.duration);
          break;
        case "heal": {
          const maxHp = this.runState.boons.getStat("maxHp", ULTIMATE.maxHp);
          const healAmt = action.percent ? maxHp * (action.amount / 100) : action.amount;
          this.player.hp = Math.min(maxHp, this.player.hp + healAmt);
          break;
        }
      }
    }
  }

  private spawnChainSpark(fromX: number, fromY: number, damage: number, bounces: number, range: number, color: number): void {
    const living = this.enemies.filter((e) => e.isAlive);
    let nearest: Enemy | null = null;
    let nearestDist = range;

    for (const e of living) {
      const dx = Math.abs(e.x - fromX);
      const dy = Math.abs(e.y - fromY);
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < nearestDist && dist > 30) {
        nearest = e;
        nearestDist = dist;
      }
    }

    if (!nearest) return;

    const sparkProj = new Projectile(this, fromX, fromY, nearest.x > fromX, {
      radius: 6, speed: 600, color, maxRange: range + 50,
      damage, knockback: 60, hitstopMs: 30,
      shakeIntensity: 2, shakeDuration: 40,
    });
    this.projectiles.push(sparkProj);

    if (bounces > 1) {
      this.time.delayedCall(200, () => {
        if (nearest && !nearest.isAlive) return;
        this.spawnChainSpark(nearest!.x, nearest!.y, Math.floor(damage * 0.8), bounces - 1, range, color);
      });
    }
  }

  private spawnLightningAoe(x: number, y: number, damage: number, radius: number, color: number): void {
    const flash = this.add.circle(x, y - 30, radius, color, 0.5);
    flash.setDepth(y + 100);
    this.tweens.add({
      targets: flash,
      alpha: 0, scaleX: 1.5, scaleY: 1.5,
      duration: 200,
      onComplete: () => flash.destroy(),
    });

    for (const enemy of this.enemies) {
      if (!enemy.isAlive) continue;
      const dx = Math.abs(enemy.x - x);
      const dy = Math.abs(enemy.y - y);
      if (dx < radius && dy < radius * 0.6) {
        const dir = x < enemy.x ? 1 : -1;
        enemy.takeHit(damage, dir * 100, (Math.random() - 0.5) * 20);
        this.hitFeel.impactFlash(enemy.x, enemy.y - enemy.height / 3);
      }
    }
    this.hitFeel.shake(3, 60);
  }

  private spawnDamageBurst(x: number, y: number, damage: number, radius: number, color: number): void {
    const flash = this.add.circle(x, y - 20, radius, color, 0.4);
    flash.setDepth(y + 100);
    this.tweens.add({
      targets: flash,
      alpha: 0, scaleX: 2, scaleY: 2,
      duration: 250,
      onComplete: () => flash.destroy(),
    });

    for (const enemy of this.enemies) {
      if (!enemy.isAlive) continue;
      const dx = Math.abs(enemy.x - x);
      const dy = Math.abs(enemy.y - y);
      if (dx < radius && dy < radius * 0.6) {
        const dir = x < enemy.x ? 1 : -1;
        enemy.takeHit(damage, dir * 80, (Math.random() - 0.5) * 20);
        this.hitFeel.impactFlash(enemy.x, enemy.y - enemy.height / 3);
      }
    }
    this.hitFeel.shake(2, 50);
  }

  // ── Wave logic ──

  private returnToHub(): void {
    this.sceneEnding = true;
    this.cameras.main.fadeOut(400, 0, 0, 0);
    this.cameras.main.once("camerafadeoutcomplete", () => {
      if (this.config.mode === "run") {
        this.game.registry.remove("runState");
      }
      this.scene.start("HubScene");
    });
  }

  private startNextWave(): void {
    this.currentWave++;
    const count = Math.min(this.config.startCount + (this.currentWave - 1), 5);
    const level = Math.min(this.config.startLevel + (this.currentWave - 1), 5);
    this.spawnEnemyWave(count, level);
    this.waveActive = true;

    this.showWaveAnnouncement(`WAVE ${this.currentWave}`);
  }

  private handleWaveLogic(dt: number): void {
    if (this.knockoutTriggered || this.victoryTriggered) return;

    if (this.waveActive) {
      const allDead = this.enemies.every((e) => !e.isAlive);
      if (allDead) {
        this.waveActive = false;
        this.handleEnemyDeathDrops();
        this.cleanupDeadEnemies();

        if (this.currentWave >= RUN.waveCount) {
          this.onVictory();
        } else {
          this.wavePauseTimer = RUN.wavePauseDuration;
          this.showWaveAnnouncement("WAVE CLEAR!");
        }
      }
    } else if (this.wavePauseTimer > 0) {
      this.wavePauseTimer -= dt;
      if (this.wavePauseTimer <= 0) {
        this.startNextWave();
      }
    }
  }

  private handleEnemyDeathDrops(): void {
    for (const enemy of this.enemies) {
      if (!enemy.isAlive && !enemy.droppedLoot) {
        enemy.droppedLoot = true;
        this.runState.addKillMoney(enemy.level);

        if (Math.random() < RUN.snackDropChance) {
          const pickup = new Pickup(this, enemy.x, enemy.y);
          this.pickups.push(pickup);
        }
      }
    }
  }

  private cleanupDeadEnemies(): void {
    for (const e of this.enemies) {
      this.time.delayedCall(500, () => e.destroy());
    }
    this.enemies = [];
    this.rushHitEnemies.clear();
  }

  private showWaveAnnouncement(text: string): void {
    const ann = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 40, text, {
      fontFamily: "Georgia, serif", fontSize: "48px",
      color: COLORS.accent, fontStyle: "bold",
    });
    ann.setOrigin(0.5);
    ann.setScrollFactor(0);
    ann.setDepth(25000);
    ann.setAlpha(0);
    ann.setScale(0.5);

    this.tweens.add({
      targets: ann,
      alpha: 1, scaleX: 1, scaleY: 1,
      duration: 300, ease: "Back.easeOut",
      onComplete: () => {
        this.tweens.add({
          targets: ann,
          alpha: 0, y: ann.y - 30,
          duration: 600, delay: 800,
          onComplete: () => ann.destroy(),
        });
      },
    });
  }

  // ── Knockout (player death) ──

  private checkKnockout(): void {
    if (this.knockoutTriggered || this.victoryTriggered) return;
    if (!this.player.isDead) return;

    this.knockoutTriggered = true;
    this.sceneEnding = true;

    this.time.delayedCall(1200, () => {
      const beaText = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 20, "Again!", {
        fontFamily: "Georgia, serif", fontSize: "56px",
        color: "#f08aaa", fontStyle: "bold italic",
      });
      beaText.setOrigin(0.5);
      beaText.setScrollFactor(0);
      beaText.setDepth(30000);
      beaText.setAlpha(0);
      beaText.setScale(0.3);

      this.tweens.add({
        targets: beaText,
        alpha: 1, scaleX: 1, scaleY: 1,
        duration: 400, ease: "Back.easeOut",
        onComplete: () => {
          this.time.delayedCall(1200, () => {
            this.cameras.main.fadeOut(600, 0, 0, 0);
            this.cameras.main.once("camerafadeoutcomplete", () => {
              if (this.config.mode === "run") {
                this.game.registry.remove("runState");
              }
              this.scene.start("HubScene");
            });
          });
        },
      });
    });
  }

  // ── Victory ──

  private onVictory(): void {
    this.victoryTriggered = true;
    this.sceneEnding = true;

    const ann = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 30, "RUN COMPLETE!", {
      fontFamily: "Georgia, serif", fontSize: "52px",
      color: COLORS.accent, fontStyle: "bold",
    });
    ann.setOrigin(0.5);
    ann.setScrollFactor(0);
    ann.setDepth(25000);
    ann.setAlpha(0);

    const moneyEarned = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 30, `Earned: ${this.runState.moneyDisplay}`, {
      fontFamily: "Georgia, serif", fontSize: "24px",
      color: COLORS.moneyText,
    });
    moneyEarned.setOrigin(0.5);
    moneyEarned.setScrollFactor(0);
    moneyEarned.setDepth(25000);
    moneyEarned.setAlpha(0);

    this.tweens.add({
      targets: [ann, moneyEarned],
      alpha: 1, duration: 500, ease: "Power2",
    });

    this.time.delayedCall(3000, () => {
      this.cameras.main.fadeOut(600, 0, 0, 0);
      this.cameras.main.once("camerafadeoutcomplete", () => {
        this.scene.start("HubScene");
      });
    });
  }

  // ── Hit checking ──

  private processProjectileSpawns(): void {
    const reqs = this.player.drainProjectileRequests();
    for (const req of reqs) {
      const proj = new Projectile(this, req.x, req.y, req.facingRight, req.config);
      this.projectiles.push(proj);
    }
  }

  private checkMeleeHits(): void {
    const hitBox = this.player.getHitBox();
    if (!hitBox) {
      this.rushHitDummies.clear();
      this.rushHitEnemies.clear();
      return;
    }

    for (const dummy of this.dummies) {
      if (!dummy.isAlive) continue;
      if (hitBox.isRush && this.rushHitDummies.has(dummy)) continue;
      const dx = Math.abs(hitBox.x - dummy.x);
      const dy = Math.abs(this.player.y - dummy.y);
      if (dx < hitBox.range + dummy.width / 2 && dy < hitBox.depthRange + dummy.height / 4) {
        const dir = this.player.facingRight ? 1 : -1;
        dummy.takeHit(hitBox.damage, dir * hitBox.knockback, (Math.random() - 0.5) * 30);
        this.hitFeel.impactFlash(dummy.x, dummy.y - dummy.height / 3);
        this.hitFeel.shake(hitBox.shakeIntensity, hitBox.shakeDuration);
        if (hitBox.isRush) { this.rushHitDummies.add(dummy); }
        else { this.player.markHitConnected(); this.player.enterMeleeHitstop(hitBox.hitstopMs); break; }
      }
    }

    for (const enemy of this.enemies) {
      if (!enemy.isAlive) continue;
      if (hitBox.isRush && this.rushHitEnemies.has(enemy)) continue;
      const dx = Math.abs(hitBox.x - enemy.x);
      const dy = Math.abs(this.player.y - enemy.y);
      if (dx < hitBox.range + enemy.width / 2 && dy < hitBox.depthRange + enemy.height / 4) {
        const wasAlive = enemy.isAlive;
        const dir = this.player.facingRight ? 1 : -1;
        enemy.takeHit(hitBox.damage, dir * hitBox.knockback, (Math.random() - 0.5) * 30);
        this.hitFeel.impactFlash(enemy.x, enemy.y - enemy.height / 3);
        this.hitFeel.shake(hitBox.shakeIntensity, hitBox.shakeDuration);

        if (this.config.mode === "run") {
          const ctx = { x: this.player.x, y: this.player.y, targetX: enemy.x, targetY: enemy.y };
          if (hitBox.isRush || hitBox.damage >= 20) {
            this.fireBoonEvent("onHeavyHit", ctx);
          } else {
            this.fireBoonEvent("onMeleeHit", ctx);
          }
          if (wasAlive && !enemy.isAlive) {
            this.fireBoonEvent("onKill", ctx);
          }
        }

        if (hitBox.isRush) { this.rushHitEnemies.add(enemy); }
        else { this.player.markHitConnected(); this.player.enterMeleeHitstop(hitBox.hitstopMs); break; }
      }
    }
  }

  private checkDashAttackHits(): void {
    const hitBox = this.player.getDashAttackHitBox();
    if (!hitBox) return;

    const allTargets = [...this.dummies, ...this.enemies];
    for (const t of allTargets) {
      if (!t.isAlive) continue;
      const dx = Math.abs(hitBox.x - t.x);
      const dy = Math.abs(this.player.y - t.y);
      if (dx < hitBox.range + t.width / 2 && dy < hitBox.depthRange + t.height / 4) {
        const dir = this.player.facingRight ? 1 : -1;
        t.takeHit(hitBox.damage, dir * hitBox.knockback, (Math.random() - 0.5) * 40);
        this.hitFeel.impactFlash(t.x, t.y - t.height / 3);
        this.hitFeel.shake(hitBox.shakeIntensity, hitBox.shakeDuration);
        this.player.markHitConnected();
        this.player.enterMeleeHitstop(hitBox.hitstopMs);
        break;
      }
    }
  }

  private checkProjectileHits(): void {
    for (const proj of this.projectiles) {
      if (!proj.alive) continue;

      for (const dummy of this.dummies) {
        if (!dummy.isAlive) continue;
        const dx = Math.abs(proj.x - dummy.x);
        const dy = Math.abs(proj.worldY - dummy.y);
        if (dx < proj.radius + dummy.width / 2 && dy < COMBAT.meleeHitDepthRange + dummy.height / 4) {
          const dir = proj.x < dummy.x ? 1 : -1;
          dummy.takeHit(proj.damage, dir * proj.knockback, (Math.random() - 0.5) * 20);
          this.hitFeel.projectileImpact(dummy.x, dummy.y - dummy.height / 3, proj.circle.fillColor);
          this.hitFeel.shake(proj.shakeIntensity, proj.shakeDuration);
          proj.destroy();
          break;
        }
      }

      if (!proj.alive) continue;

      for (const enemy of this.enemies) {
        if (!enemy.isAlive) continue;
        const dx = Math.abs(proj.x - enemy.x);
        const dy = Math.abs(proj.worldY - enemy.y);
        if (dx < proj.radius + enemy.width / 2 && dy < COMBAT.meleeHitDepthRange + enemy.height / 4) {
          const wasAlive = enemy.isAlive;
          const dir = proj.x < enemy.x ? 1 : -1;
          enemy.takeHit(proj.damage, dir * proj.knockback, (Math.random() - 0.5) * 20);
          this.hitFeel.projectileImpact(enemy.x, enemy.y - enemy.height / 3, proj.circle.fillColor);
          this.hitFeel.shake(proj.shakeIntensity, proj.shakeDuration);

          if (this.config.mode === "run") {
            const ctx = { x: proj.x, y: proj.worldY, targetX: enemy.x, targetY: enemy.y };
            this.fireBoonEvent("onProjectileHit", ctx);
            if (wasAlive && !enemy.isAlive) {
              this.fireBoonEvent("onKill", ctx);
            }
          }

          proj.destroy();
          break;
        }
      }
    }
  }

  private checkAoeHits(): void {
    const aoe = this.player.drainAoeHit();
    if (!aoe) return;

    const targets = [...this.dummies, ...this.enemies];
    for (const t of targets) {
      if (!t.isAlive) continue;
      const dx = Math.abs(aoe.x - t.x);
      const dy = Math.abs(aoe.y - t.y);
      if (dx < aoe.radius + t.width / 2 && dy < aoe.depthRange) {
        const dir = aoe.x < t.x ? 1 : (aoe.x > t.x ? -1 : (Math.random() > 0.5 ? 1 : -1));
        t.takeHit(aoe.damage, dir * aoe.knockback, (Math.random() - 0.5) * 60);
        this.hitFeel.impactFlash(t.x, t.y - t.height / 3);
      }
    }
  }

  private checkUltimateBlast(): void {
    if (!this.player.pendingUltBlast) return;
    this.player.pendingUltBlast = false;

    const targets = [...this.dummies, ...this.enemies];
    for (const t of targets) {
      if (!t.isAlive) continue;
      const dir = this.player.x < t.x ? 1 : -1;
      t.takeHit(ULTIMATE.blastDamage, dir * ULTIMATE.blastKnockback, (Math.random() - 0.5) * 100);
      this.hitFeel.impactFlash(t.x, t.y - t.height / 3);
    }
  }

  private checkEnemyAttacks(): void {
    for (const enemy of this.enemies) {
      const hit = enemy.getAttackHit();
      if (!hit) continue;

      const dx = Math.abs(hit.x - this.player.x);
      const dy = Math.abs(hit.y - this.player.y);

      if (dx < hit.range + COMBAT.meleeHitRange && dy < hit.depthRange + 20) {
        const wasBlocking = this.player.combat.isBlocking;
        const dir = enemy.x < this.player.x ? 1 : -1;
        this.player.takeHit(hit.damage, dir * hit.knockback, (Math.random() - 0.5) * 30);
        this.hitFeel.impactFlash(this.player.x, this.player.y - 20);

        if (this.config.mode === "run") {
          const ctx = { x: this.player.x, y: this.player.y, targetX: enemy.x, targetY: enemy.y };
          if (wasBlocking) {
            this.fireBoonEvent("onBlock", ctx);
          } else {
            this.fireBoonEvent("onTakeDamage", ctx);
          }
        }
      }
    }
  }

  private checkPickupCollection(): void {
    const maxHp = this.config.mode === "run"
      ? this.runState.boons.getStat("maxHp", ULTIMATE.maxHp)
      : ULTIMATE.maxHp;

    for (const pickup of this.pickups) {
      if (!pickup.isAlive) continue;
      const dx = Math.abs(pickup.x - this.player.x);
      const dy = Math.abs(pickup.y - this.player.y);
      if (dx < PICKUP.collectRadius && dy < PICKUP.collectRadius) {
        this.player.hp = Math.min(maxHp, this.player.hp + pickup.healAmount);
        pickup.collect(true);
        this.hitFeel.shake(1, 30);
      }
    }
  }

  private pruneDeadProjectiles(): void {
    this.projectiles = this.projectiles.filter((p) => p.alive);
  }

  private pruneDeadPickups(): void {
    this.pickups = this.pickups.filter((p) => p.isAlive);
  }

  // ── HUD ──

  private updateComboDisplay(): void {
    const comboId = this.player.currentComboId;
    const specialName = this.player.currentSpecialName;
    const activeNode = comboId ? this.findNodeById(comboId) : null;

    for (const [id, text] of this.comboListTexts) {
      if (id === comboId) {
        text.setColor(COLORS.accent); text.setScale(1.15); text.setAlpha(1);
      } else {
        text.setColor(COLORS.subtitleText); text.setScale(1); text.setAlpha(0.5);
      }
    }

    if (specialName) {
      this.comboNameDisplay.setText(specialName);
      this.comboNameDisplay.setAlpha(1);
    } else if (activeNode) {
      this.comboNameDisplay.setText(activeNode.name);
      this.comboNameDisplay.setAlpha(1);
    } else if (this.comboNameDisplay.alpha > 0) {
      this.comboNameDisplay.setAlpha(this.comboNameDisplay.alpha - 0.04);
    }
  }

  private updateMoneyDisplay(): void {
    if (this.config.mode === "enemies" || this.config.mode === "run") {
      this.moneyDisplay.setText(this.runState.moneyDisplay);
    }
    if (this.config.mode === "run") {
      this.waveDisplay.setText(this.runState.roomLabel);
    } else {
      this.waveDisplay.setText(
        this.config.mode === "enemies"
          ? `Wave ${this.currentWave}/${RUN.waveCount}`
          : "Training Mode"
      );
    }
  }

  private findNodeById(id: string): ComboNode | null {
    const search = (nodes: ComboNode[]): ComboNode | null => {
      for (const n of nodes) {
        if (n.id === id) return n;
        const found = search(n.children);
        if (found) return found;
      }
      return null;
    };
    return search(COMBO_TREE);
  }

  // ── Arena drawing ──

  private drawArena(): void {
    const bg = this.add.rectangle(ARENA.width / 2, ARENA.height / 2, ARENA.width, ARENA.height, COLORS.background);
    bg.setDepth(-1000);
    const ground = this.add.rectangle(ARENA.width / 2, ARENA.groundY + ARENA.groundHeight / 2, ARENA.width, ARENA.groundHeight, COLORS.groundFill);
    ground.setDepth(-999);
    const groundTop = this.add.rectangle(ARENA.width / 2, ARENA.groundY, ARENA.width, 2, COLORS.groundLine);
    groundTop.setDepth(-998);
    this.drawGroundLines();
    this.drawBoundaryWalls();
  }

  private drawGroundLines(): void {
    const gfx = this.add.graphics();
    gfx.setDepth(-997);
    gfx.lineStyle(1, COLORS.groundLine, 0.3);
    const spacing = 60;
    for (let y = ARENA.groundY + spacing; y < ARENA.groundY + ARENA.groundHeight; y += spacing) {
      gfx.lineBetween(0, y, ARENA.width, y);
    }
  }

  private drawBoundaryWalls(): void {
    const wallThickness = ARENA.boundaryPadding;
    const leftWall = this.add.rectangle(wallThickness / 2, ARENA.height / 2, wallThickness, ARENA.height, COLORS.wallFill);
    leftWall.setDepth(10000); leftWall.setAlpha(0.8);
    const rightWall = this.add.rectangle(ARENA.width - wallThickness / 2, ARENA.height / 2, wallThickness, ARENA.height, COLORS.wallFill);
    rightWall.setDepth(10000); rightWall.setAlpha(0.8);
  }

  private setupCamera(): void {
    this.cameras.main.setBounds(0, 0, ARENA.width, ARENA.height);
    this.cameras.main.startFollow(this.player.container, true, 0.08, 0.08);
    this.cameras.main.setDeadzone(GAME_WIDTH * 0.15, GAME_HEIGHT * 0.15);
  }

  private addHUD(): void {
    const version = this.add.text(GAME_WIDTH - 16, GAME_HEIGHT - 16, "B0.6.0", {
      fontFamily: "monospace", fontSize: "14px", color: COLORS.subtitleText,
    });
    version.setOrigin(1, 1); version.setScrollFactor(0); version.setDepth(20000);

    const controlHint = this.add.text(16, GAME_HEIGHT - 16, "", {
      fontFamily: "monospace", fontSize: "10px", color: COLORS.subtitleText,
    });
    controlHint.setOrigin(0, 1); controlHint.setScrollFactor(0); controlHint.setDepth(20000);

    this.moneyDisplay = this.add.text(GAME_WIDTH - 16, 14, "", {
      fontFamily: "monospace", fontSize: "16px", color: COLORS.moneyText, fontStyle: "bold",
    });
    this.moneyDisplay.setOrigin(1, 0); this.moneyDisplay.setScrollFactor(0); this.moneyDisplay.setDepth(20000);

    this.waveDisplay = this.add.text(GAME_WIDTH - 16, 34, "", {
      fontFamily: "monospace", fontSize: "12px", color: COLORS.subtitleText,
    });
    this.waveDisplay.setOrigin(1, 0); this.waveDisplay.setScrollFactor(0); this.waveDisplay.setDepth(20000);

    this.buildComboListHUD();

    this.time.addEvent({
      delay: 200, loop: true,
      callback: () => {
        const dev = this.input_mgr.lastDevice;
        const move = dev === "gamepad" ? "L-Stick" : "WASD";
        const atk = this.input_mgr.getLabel(Action.ATTACK);
        const hvy = this.input_mgr.getLabel(Action.HEAVY);
        const jmp = this.input_mgr.getLabel(Action.JUMP);
        const thrw = this.input_mgr.getLabel(Action.THROW);
        const ultLabel = dev === "gamepad" ? "L1+R1" : "I+L";
        controlHint.setText(
          `Move: ${move}  |  Light: ${atk}  |  Heavy: ${hvy}  |  Jump: ${jmp}  |  Block/Throw: ${thrw}  |  Ult: ${ultLabel}  |  Dash: Dbl-tap dir`
        );
      },
    });
  }

  private buildComboListHUD(): void {
    const allNodes: ComboNode[] = [];
    const collect = (nodes: ComboNode[]) => {
      for (const n of nodes) { allNodes.push(n); collect(n.children); }
    };
    collect(COMBO_TREE);

    const squareNodes = allNodes.filter((n) => n.id[0] === "L");
    const triangleNodes = allNodes.filter((n) => n.id[0] === "H");

    const yRow1 = 14; const yRow2 = 30; const yRow3 = 46;
    const startX = 16; const spacing = 10;

    const labelStyle = { fontFamily: "monospace", fontSize: "12px", color: COLORS.subtitleText };

    let xCursor = startX;
    const headerL = this.add.text(xCursor, yRow1 - 2, "Square:", { ...labelStyle, fontSize: "10px" });
    headerL.setScrollFactor(0); headerL.setDepth(20000); headerL.setAlpha(0.6);
    xCursor += headerL.width + 8;
    for (const node of squareNodes) {
      const t = this.add.text(xCursor, yRow1, node.id, labelStyle);
      t.setScrollFactor(0); t.setDepth(20000); t.setAlpha(0.5); t.setOrigin(0, 0);
      this.comboListTexts.set(node.id, t);
      xCursor += t.width + spacing;
    }

    xCursor = startX;
    const headerH = this.add.text(xCursor, yRow2 - 2, "Triangle:", { ...labelStyle, fontSize: "10px" });
    headerH.setScrollFactor(0); headerH.setDepth(20000); headerH.setAlpha(0.6);
    xCursor += headerH.width + 8;
    for (const node of triangleNodes) {
      const t = this.add.text(xCursor, yRow2, node.id, labelStyle);
      t.setScrollFactor(0); t.setDepth(20000); t.setAlpha(0.5); t.setOrigin(0, 0);
      this.comboListTexts.set(node.id, t);
      xCursor += t.width + spacing;
    }

    const specialRow = this.add.text(startX, yRow3 - 2,
      "Special:  Jump+Atk: Elbow Drop  |  Block/Throw: Circle  |  Ultimate: L1+R1  |  Dash: Dbl-tap  |  Dash+□: Shot  |  Dash+△: Punch", {
      ...labelStyle, fontSize: "10px",
    });
    specialRow.setScrollFactor(0); specialRow.setDepth(20000); specialRow.setAlpha(0.5);

    this.comboNameDisplay = this.add.text(GAME_WIDTH / 2, 68, "", {
      fontFamily: "monospace", fontSize: "20px", color: COLORS.accent, fontStyle: "bold",
    });
    this.comboNameDisplay.setOrigin(0.5);
    this.comboNameDisplay.setScrollFactor(0);
    this.comboNameDisplay.setDepth(20000);
    this.comboNameDisplay.setAlpha(0);
  }
}
