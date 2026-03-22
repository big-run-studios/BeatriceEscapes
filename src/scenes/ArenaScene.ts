import Phaser from "phaser";
import {
  GAME_WIDTH, GAME_HEIGHT, ARENA, COLORS, COMBAT, COMBO_TREE, ComboNode,
  ULTIMATE, RUN, PICKUP,
} from "../config/game";
import { InputManager, Action } from "../systems/InputManager";
import { HitFeel } from "../systems/HitFeel";
import { RunState } from "../systems/RunState";
import { Player } from "../entities/Player";
import { TrainingDummy } from "../entities/TrainingDummy";
import { Enemy } from "../entities/Enemy";
import { Projectile } from "../entities/Projectile";
import { Pickup } from "../entities/Pickup";

interface ArenaConfig {
  mode: "dummies" | "enemies";
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
    this.runState = new RunState();
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

    if (this.config.mode === "dummies") {
      this.spawnDummies();
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

    const dt = delta / 1000;
    this.player.update(dt);

    this.processProjectileSpawns();

    for (const dummy of this.dummies) dummy.update(dt);
    for (const enemy of this.enemies) {
      enemy.setPlayerRef({ x: this.player.x, y: this.player.y });
      enemy.update(dt);
    }
    for (const proj of this.projectiles) proj.update(dt);
    for (const pickup of this.pickups) pickup.update(dt);

    this.checkMeleeHits();
    this.checkProjectileHits();
    this.checkAoeHits();
    this.checkUltimateBlast();
    this.checkEnemyAttacks();
    this.checkPickupCollection();
    this.pruneDeadProjectiles();
    this.pruneDeadPickups();
    this.updateComboDisplay();
    this.updateMoneyDisplay();

    if (this.config.mode === "enemies") {
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
      enemy.setPlayerRef({ x: this.player.x, y: this.player.y });
      this.enemies.push(enemy);
    }
  }

  // ── Wave logic ──

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
            this.sceneEnding = true;
            this.cameras.main.fadeOut(600, 0, 0, 0);
            this.cameras.main.once("camerafadeoutcomplete", () => {
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
      this.sceneEnding = true;
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
        const dir = this.player.facingRight ? 1 : -1;
        enemy.takeHit(hitBox.damage, dir * hitBox.knockback, (Math.random() - 0.5) * 30);
        this.hitFeel.impactFlash(enemy.x, enemy.y - enemy.height / 3);
        this.hitFeel.shake(hitBox.shakeIntensity, hitBox.shakeDuration);
        if (hitBox.isRush) { this.rushHitEnemies.add(enemy); }
        else { this.player.markHitConnected(); this.player.enterMeleeHitstop(hitBox.hitstopMs); break; }
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
          const dir = proj.x < enemy.x ? 1 : -1;
          enemy.takeHit(proj.damage, dir * proj.knockback, (Math.random() - 0.5) * 20);
          this.hitFeel.projectileImpact(enemy.x, enemy.y - enemy.height / 3, proj.circle.fillColor);
          this.hitFeel.shake(proj.shakeIntensity, proj.shakeDuration);
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
        const dir = enemy.x < this.player.x ? 1 : -1;
        this.player.takeHit(hit.damage, dir * hit.knockback, (Math.random() - 0.5) * 30);
        this.hitFeel.impactFlash(this.player.x, this.player.y - 20);
      }
    }
  }

  private checkPickupCollection(): void {
    for (const pickup of this.pickups) {
      if (!pickup.isAlive) continue;
      const dx = Math.abs(pickup.x - this.player.x);
      const dy = Math.abs(pickup.y - this.player.y);
      if (dx < PICKUP.collectRadius && dy < PICKUP.collectRadius) {
        this.player.hp = Math.min(ULTIMATE.maxHp, this.player.hp + pickup.healAmount);
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
    if (this.config.mode === "enemies") {
      this.moneyDisplay.setText(this.runState.moneyDisplay);
    }
    this.waveDisplay.setText(
      this.config.mode === "enemies"
        ? `Wave ${this.currentWave}/${RUN.waveCount}`
        : "Training Mode"
    );
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
    const version = this.add.text(GAME_WIDTH - 16, GAME_HEIGHT - 16, "B0.5.0", {
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
      "Special:  Jump+Atk: Elbow Drop  |  Circle: Block/Throw  |  L1+R1: Ultimate  |  Dbl-tap: Dash", {
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
