import Phaser from "phaser";
import {
  GAME_WIDTH, GAME_HEIGHT, ARENA, COLORS, COMBAT, COMBO_TREE, ComboNode,
  ULTIMATE, RUN, PICKUP, ENEMY_AI, JOHN, JOHN_MOVES, JOHN_PARRY, JOHN_ULTIMATE,
  LUNA, LUNA_DOG_MOVES, LUNA_ULTIMATE,
  HEATHER, HEATHER_LIGHT_MOVES, HEATHER_HEAVY_MOVES, HEATHER_PARRY, HEATHER_ULTIMATE,
  TOTEM_CONFIG, HEATHER_COLORS,
  ENEMY_TYPES,
} from "../config/game";
import { InputManager, Action } from "../systems/InputManager";
import { initPSGlyphs, PromptLine, PromptPart, PS_NAV, IconRef } from "../ui/ButtonGlyphs";
import { AB_SHEET_KEY, AB_FRAME_W, AB_FRAME_H, registerAndrewBeaAnims } from "../entities/AndrewBeaAnims";
import { J_SHEET_KEY, J_FRAME_W, J_FRAME_H, registerJohnAnims } from "../entities/JohnAnims";
import { H_SHEET_KEY, H_FRAME_W, H_FRAME_H, registerHeatherAnims } from "../entities/HeatherAnims";
import { LD_SHEET_KEY, LL_SHEET_KEY, L_FRAME_W, L_FRAME_H, registerLunaAnims } from "../entities/LunaAnims";
import { HitFeel } from "../systems/HitFeel";
import { VFXManager, VFX_SHEET_KEY, VFX_FRAME_W, VFX_FRAME_H } from "../systems/VFXManager";
import { PROJ_SHEET_KEY, PROJ_FRAME_W, PROJ_FRAME_H } from "../entities/Projectile";
import { RunState, WaveDef } from "../systems/RunState";
import { Player } from "../entities/Player";
import { JohnPlayer } from "../entities/JohnPlayer";
import { LunaPlayer } from "../entities/LunaPlayer";
import { HeatherPlayer } from "../entities/HeatherPlayer";
import { PlayerEntity } from "../entities/PlayerEntity";
import { TrainingDummy } from "../entities/TrainingDummy";
import { Enemy, EnemyRole, PlayerIntent } from "../entities/Enemy";
import { Projectile } from "../entities/Projectile";
import { Pickup } from "../entities/Pickup";
import { Totem } from "../entities/Totem";
import { QABot } from "../debug/QABot";
import { DebugPanel } from "../debug/DebugPanel";
import { AudioManager } from "../systems/AudioManager";

interface ArenaConfig {
  mode: "dummies" | "enemies" | "run";
  character: string;
  startCount: number;
  startLevel: number;
}

export class ArenaScene extends Phaser.Scene {
  private input_mgr!: InputManager;
  private hitFeel!: HitFeel;
  private vfx!: VFXManager;
  private runState!: RunState;
  private player!: PlayerEntity;
  private dummies: TrainingDummy[] = [];
  private enemies: Enemy[] = [];
  private projectiles: Projectile[] = [];
  private enemyProjectiles: Projectile[] = [];
  private pickups: Pickup[] = [];
  private rushHitDummies: Set<TrainingDummy> = new Set();
  private rushHitEnemies: Set<Enemy> = new Set();
  private totems: Totem[] = [];
  private resonanceField: { timer: number; tickTimer: number } | null = null;
  private comboListTexts: Map<string, Phaser.GameObjects.Text> = new Map();
  private comboNameDisplay!: Phaser.GameObjects.Text;
  private moneyDisplay!: Phaser.GameObjects.Text;
  private waveDisplay!: Phaser.GameObjects.Text;

  private bossHpBarBg?: Phaser.GameObjects.Rectangle;
  private bossHpBarFill?: Phaser.GameObjects.Rectangle;
  private bossHpBarBorder?: Phaser.GameObjects.Rectangle;
  private bossNameText?: Phaser.GameObjects.Text;
  private bossPhaseMarkers: Phaser.GameObjects.Rectangle[] = [];

  private config!: ArenaConfig;
  private currentWave = 0;
  private waveActive = false;
  private wavePauseTimer = 0;
  private knockoutTriggered = false;
  private victoryTriggered = false;
  private sceneEnding = false;

  private levelWidth = ARENA.width;
  private waveTriggers: { x: number; wave: WaveDef; triggered: boolean }[] = [];
  private scrollWaveIdx = 0;
  private screenLocked = false;
  private lockLeftX = 0;
  private lockRightX = ARENA.width;
  private lockLeftWall?: Phaser.GameObjects.Rectangle;
  private lockRightWall?: Phaser.GameObjects.Rectangle;
  private goPromptObj?: Phaser.GameObjects.Text;
  private qaBot: QABot | null = null;
  private debugPanel!: DebugPanel;
  private fpsText?: Phaser.GameObjects.Text;
  private audioDebugText?: Phaser.GameObjects.Text;

  constructor() {
    super({ key: "ArenaScene" });
  }

  preload(): void {
    const base = (import.meta as Record<string, Record<string, string>>).env?.BASE_URL ?? "/";
    this.load.spritesheet(AB_SHEET_KEY, `${base}art/characters/andrew-bea.png`, {
      frameWidth: AB_FRAME_W,
      frameHeight: AB_FRAME_H,
    });
    this.load.spritesheet(J_SHEET_KEY, `${base}art/characters/john.png`, {
      frameWidth: J_FRAME_W,
      frameHeight: J_FRAME_H,
    });
    this.load.spritesheet(H_SHEET_KEY, `${base}art/characters/heather.png`, {
      frameWidth: H_FRAME_W,
      frameHeight: H_FRAME_H,
    });
    this.load.spritesheet(LD_SHEET_KEY, `${base}art/characters/luna-dog.png`, {
      frameWidth: L_FRAME_W,
      frameHeight: L_FRAME_H,
    });
    this.load.spritesheet(LL_SHEET_KEY, `${base}art/characters/luna-lunar.png`, {
      frameWidth: L_FRAME_W,
      frameHeight: L_FRAME_H,
    });
    this.load.spritesheet(VFX_SHEET_KEY, `${base}art/vfx/combat-particles.png`, {
      frameWidth: VFX_FRAME_W,
      frameHeight: VFX_FRAME_H,
    });
    this.load.spritesheet(PROJ_SHEET_KEY, `${base}art/vfx/projectile-sprites.png`, {
      frameWidth: PROJ_FRAME_W,
      frameHeight: PROJ_FRAME_H,
    });
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
    initPSGlyphs(this);
    registerAndrewBeaAnims(this);
    registerJohnAnims(this);
    registerHeatherAnims(this);
    registerLunaAnims(this);
    this.vfx = new VFXManager(this);
    this.hitFeel = new HitFeel(this, this.vfx);

    if (this.config.mode === "run" || this.config.mode === "enemies") {
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
    this.enemyProjectiles = [];
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
    this.waveTriggers = [];
    this.scrollWaveIdx = 0;
    this.screenLocked = false;
    this.lockLeftWall = undefined;
    this.lockRightWall = undefined;
    this.goPromptObj = undefined;
    this.bossHpBarBg = undefined;
    this.bossHpBarFill = undefined;
    this.bossHpBarBorder = undefined;
    this.bossNameText = undefined;
    this.bossPhaseMarkers = [];

    this.events.on("poison-damage", (x: number, y: number, amount: number) => {
      this.spawnDamageNumber(x, y, amount, 0xcc66ff);
    });

    this.events.once("shutdown", () => {
      this.sceneEnding = true;
      this.enemies = [];
      this.projectiles = [];
      this.enemyProjectiles = [];
      this.pickups = [];
      this.dummies = [];
    });

    const SCROLL_SECTION = GAME_WIDTH;
    const SCROLL_GAP = 320;
    const SCROLL_PAD = 400;
    const isScrolling = this.config.mode === "run" && this.runState.zoneMap && this.runState.currentNode;
    if (isScrolling) {
      const node = this.runState.currentNode!;
      this.levelWidth = SCROLL_PAD + node.waves.length * SCROLL_SECTION + (node.waves.length - 1) * SCROLL_GAP + SCROLL_PAD;
    } else {
      this.levelWidth = ARENA.width;
    }

    this.drawArena();

    const startX = isScrolling ? SCROLL_PAD * 0.5 : this.levelWidth / 2 - 150;
    const startY = ARENA.groundY + ARENA.groundHeight / 2;
    if (this.config.character === "john") {
      this.player = new JohnPlayer(this, startX, startY, this.input_mgr, this.hitFeel);
    } else if (this.config.character === "luna") {
      this.player = new LunaPlayer(this, startX, startY, this.input_mgr, this.hitFeel);
    } else if (this.config.character === "heather") {
      this.player = new HeatherPlayer(this, startX, startY, this.input_mgr, this.hitFeel);
    } else {
      this.player = new Player(this, startX, startY, this.input_mgr, this.hitFeel);
    }
    const halfW = this.config.character === "john" ? JOHN.width / 2
      : this.config.character === "luna" ? LUNA.width / 2
      : this.config.character === "heather" ? HEATHER.width / 2
      : 24;
    this.player.boundsMaxX = this.levelWidth - ARENA.boundaryPadding - halfW;
    this.player.setDummyProvider(() => this.getAllTargets());
    if (this.config.mode === "run" || this.config.mode === "enemies") {
      this.player.setBoonState(this.runState.boons);
      if (this.config.mode === "run" && this.runState.playerHp >= 0) {
        this.player.hp = this.runState.playerHp;
        this.player.mp = this.runState.playerMp;
      }
    }

    if (this.config.mode === "dummies") {
      this.spawnDummies();
    } else if (this.config.mode === "run") {
      if (isScrolling) {
        this.setupWaveTriggers();
      } else {
        this.spawnRunRoom();
      }
    } else {
      this.startNextWave();
    }

    this.setupCamera();
    this.addHUD();
    this.initDebugPanel();

    this.cameras.main.fadeIn(400, 0, 0, 0);

    AudioManager.instance.playMusic("arena");

    const qaParam = new URLSearchParams(window.location.search).get("qa");
    if (qaParam) {
      this.qaBot = new QABot({
        player: this.player,
        totems: this.totems,
        projectiles: this.projectiles,
        enemies: this.enemies,
        dummies: this.dummies,
        inputMgr: this.input_mgr,
        scene: this,
      }, qaParam);
    }
  }

  update(_time: number, delta: number): void {
    AudioManager.instance.heartbeat();

    if (this.sceneEnding) {
      this.input_mgr.postUpdate();
      return;
    }

    this.debugPanel.update();
    this.applyDebugOptions(delta);

    if (this.debugPanel.isOpen) {
      this.input_mgr.postUpdate();
      return;
    }

    if (this.input_mgr.justPressed(Action.PAUSE) && !this.knockoutTriggered && !this.victoryTriggered) {
      this.returnToHub();
      return;
    }

    const dt = delta / 1000;
    this.resetTotemBuffs();
    this.checkTotemSpawns();
    this.updateTotems(dt);
    this.applyTotemBuffs();

    this.player.update(dt);

    this.checkCatalystPulse();
    this.updateResonanceField(dt);

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
    for (const proj of this.enemyProjectiles) proj.update(dt);
    for (const pickup of this.pickups) pickup.update(dt);

    this.processEnemyProjectileSpawns();
    this.processEnemyAoeHits();
    this.processEnemyAnnouncements();
    this.processBossSummons();

    this.checkMeleeHits();
    this.checkDashAttackHits();
    this.checkProjectileHits();
    this.checkAoeHits();
    this.checkUltimateBlast();
    this.checkDirectionalUltBlast();
    this.checkParryStun();
    this.checkHeatherParryStun();
    this.checkTotemDamage();
    this.pruneDeadTotems();
    this.checkEnemyAttacks();
    this.checkEnemyProjectileHits();
    this.checkPickupCollection();
    this.pruneDeadProjectiles();
    this.pruneDeadPickups();
    this.updateComboDisplay();
    this.updateMoneyDisplay();
    this.updateBossHealthBar();

    if (this.config.mode === "run") {
      this.runState.boons.updateCooldowns(dt);
      this.handleRunRoomLogic();
      this.checkKnockout();
    } else if (this.config.mode === "enemies") {
      this.runState.boons.updateCooldowns(dt);
      this.handleWaveLogic(dt);
      this.checkKnockout();
    }

    this.qaBot?.update(dt);
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
      enemy.setVFX(this.vfx);
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

    if (this.runState.zoneMap) {
      this.handleScrollingRunLogic();
    } else {
      this.handleLinearRunLogic();
    }
  }

  private handleLinearRunLogic(): void {
    if (!this.waveActive) return;

    const allDead = this.enemies.every((e) => !e.isAlive);
    if (!allDead) return;

    this.waveActive = false;
    this.handleEnemyDeathDrops();
    this.autoCollectPickups();
    this.cleanupDeadEnemies();

    this.fireBoonEvent("onRoomClear", { x: this.player.x, y: this.player.y });

    this.runState.playerHp = this.player.hp;
    this.runState.playerMp = this.player.mp;

    this.victoryTriggered = true;
    this.sceneEnding = true;

    let restoreMusic: (() => void) | null = null;
    AudioManager.instance.playStingWithDuck("victory").then((unduck) => {
      restoreMusic = unduck;
    });

    this.time.delayedCall(800, () => {
      restoreMusic?.();
      this.runState.advanceRoom();

      this.cameras.main.fadeOut(400, 0, 0, 0);
      this.cameras.main.once("camerafadeoutcomplete", () => {
        this.scene.start("RoomMapScene");
      });
    });
  }

  private handleScrollingRunLogic(): void {
    if (!this.screenLocked && this.scrollWaveIdx < this.waveTriggers.length) {
      const trigger = this.waveTriggers[this.scrollWaveIdx];
      if (!trigger.triggered && this.player.x >= trigger.x - GAME_WIDTH * 0.4) {
        trigger.triggered = true;
        this.lockScreen(trigger.x);
        this.spawnScrollWave(trigger.wave, trigger.x);
        this.waveActive = true;

        const node = this.runState.currentNode;
        const isBossType = node?.type === "miniboss" || node?.type === "boss";
        let label = `Wave ${this.scrollWaveIdx + 1}/${this.waveTriggers.length}`;
        if (isBossType && this.scrollWaveIdx === this.waveTriggers.length - 1) {
          label = node?.type === "boss" ? "ZONE BOSS!" : "MINI-BOSS!";
          AudioManager.instance.playMusic("boss");
        }
        this.showWaveAnnouncement(label);
      }
    }

    if (this.waveActive && this.screenLocked) {
      const allDead = this.enemies.every((e) => !e.isAlive);
      if (!allDead) return;

      this.waveActive = false;
      this.handleEnemyDeathDrops();
      this.autoCollectPickups();
      this.cleanupDeadEnemies();
      this.scrollWaveIdx++;

      if (this.scrollWaveIdx >= this.waveTriggers.length) {
        this.fireBoonEvent("onRoomClear", { x: this.player.x, y: this.player.y });
        this.runState.playerHp = this.player.hp;
        this.runState.playerMp = this.player.mp;
        this.runState.markNodeVisited();

        this.unlockScreen();
        this.victoryTriggered = true;
        this.sceneEnding = true;

        let restoreMusic: (() => void) | null = null;
        AudioManager.instance.playStingWithDuck("victory").then((unduck) => {
          restoreMusic = unduck;
        });

        this.time.delayedCall(800, () => {
          restoreMusic?.();
          this.cameras.main.fadeOut(400, 0, 0, 0);
          this.cameras.main.once("camerafadeoutcomplete", () => {
            this.scene.start("RoomMapScene");
          });
        });
      } else {
        this.unlockScreen();
        this.showGoPrompt();
      }
    }
  }

  private setupWaveTriggers(): void {
    const node = this.runState.currentNode;
    if (!node || node.waves.length === 0) return;

    const SCROLL_PAD = 400;
    const SECTION = GAME_WIDTH;
    const GAP = 320;

    this.waveTriggers = [];
    this.scrollWaveIdx = 0;
    this.screenLocked = false;

    for (let i = 0; i < node.waves.length; i++) {
      const centerX = SCROLL_PAD + i * (SECTION + GAP) + SECTION / 2;
      this.waveTriggers.push({
        x: centerX,
        wave: node.waves[i],
        triggered: false,
      });
    }

    const gfx = this.add.graphics();
    gfx.setDepth(-996);
    for (const trigger of this.waveTriggers) {
      gfx.lineStyle(1, 0x332222, 0.25);
      gfx.lineBetween(trigger.x - SECTION / 2, ARENA.groundY, trigger.x - SECTION / 2, ARENA.groundY + ARENA.groundHeight);
      gfx.lineBetween(trigger.x + SECTION / 2, ARENA.groundY, trigger.x + SECTION / 2, ARENA.groundY + ARENA.groundHeight);
    }

    this.showWaveAnnouncement(node.label);
  }

  private spawnScrollWave(wave: WaveDef, centerX: number): void {
    const cy = ARENA.groundY + ARENA.groundHeight / 2;

    for (const entry of wave.entries) {
      const typeDef = ENEMY_TYPES[entry.type];
      for (let i = 0; i < entry.count; i++) {
        const x = centerX + 100 + Math.random() * (GAME_WIDTH * 0.25);
        const y = cy + (Math.random() - 0.5) * 200;
        const enemy = new Enemy(this, x, y, wave.level, typeDef);
        enemy.setVFX(this.vfx);
        enemy.boundsMinX = this.lockLeftX + ARENA.boundaryPadding;
        enemy.boundsMaxX = this.lockRightX - ARENA.boundaryPadding;
        this.enemies.push(enemy);
      }
    }
  }

  private lockScreen(centerX: number): void {
    this.screenLocked = true;
    this.lockLeftX = centerX - GAME_WIDTH / 2;
    this.lockRightX = centerX + GAME_WIDTH / 2;

    this.player.boundsMinX = this.lockLeftX + ARENA.boundaryPadding;
    this.player.boundsMaxX = this.lockRightX - ARENA.boundaryPadding;

    const cam = this.cameras.main;
    const currentScrollY = cam.scrollY + GAME_HEIGHT / 2;
    cam.stopFollow();
    cam.pan(centerX, currentScrollY, 400, "Sine.easeInOut");

    this.lockLeftWall?.destroy();
    this.lockRightWall?.destroy();
    this.lockLeftWall = undefined;
    this.lockRightWall = undefined;

    if (this.goPromptObj) {
      this.goPromptObj.destroy();
      this.goPromptObj = undefined;
    }
  }

  private unlockScreen(): void {
    this.screenLocked = false;

    this.player.boundsMinX = ARENA.boundaryPadding + 24;
    this.player.boundsMaxX = this.levelWidth - ARENA.boundaryPadding - 24;

    this.lockLeftWall?.destroy();
    this.lockLeftWall = undefined;
    this.lockRightWall?.destroy();
    this.lockRightWall = undefined;

    const cam = this.cameras.main;
    cam.setBounds(0, 0, this.levelWidth, ARENA.height);

    const targetScrollX = Math.max(0, this.player.x - GAME_WIDTH * 0.12 - GAME_WIDTH / 2);
    cam.scrollX = Math.max(cam.scrollX, targetScrollX);

    cam.startFollow(this.player.container, true, 0.15, 0.08);
    cam.setFollowOffset(-GAME_WIDTH * 0.12, 0);

    this.time.delayedCall(500, () => {
      cam.setLerp(0.08, 0.08);
    });
  }

  private showGoPrompt(): void {
    this.goPromptObj = this.add.text(GAME_WIDTH - 120, GAME_HEIGHT / 2, "GO! \u2192", {
      fontFamily: "Georgia, serif", fontSize: "40px",
      color: COLORS.accent, fontStyle: "bold",
    });
    this.goPromptObj.setOrigin(0.5);
    this.goPromptObj.setScrollFactor(0);
    this.goPromptObj.setDepth(25000);
    this.goPromptObj.setAlpha(0);

    const baseX = GAME_WIDTH - 120;
    this.tweens.add({
      targets: this.goPromptObj,
      alpha: 1, duration: 200,
      onComplete: () => {
        if (!this.goPromptObj) return;
        this.tweens.add({
          targets: this.goPromptObj,
          x: baseX + 15,
          yoyo: true, repeat: -1, duration: 500,
        });
        this.time.delayedCall(3000, () => {
          if (!this.goPromptObj) return;
          this.tweens.add({
            targets: this.goPromptObj, alpha: 0, duration: 400,
            onComplete: () => { this.goPromptObj?.destroy(); this.goPromptObj = undefined; },
          });
        });
      },
    });
  }

  private processEnemyProjectileSpawns(): void {
    for (const enemy of this.enemies) {
      if (!enemy.isAlive) continue;
      const reqs = enemy.drainProjectileRequests();
      for (const req of reqs) {
        const proj = new Projectile(this, req.x, req.y, req.facingRight, {
          radius: req.radius, speed: req.speed, color: req.color,
          maxRange: req.maxRange, damage: req.damage,
          knockback: req.isNet ? 20 : 80,
          hitstopMs: req.isNet ? 0 : 30,
          shakeIntensity: req.isNet ? 0 : 2,
          shakeDuration: req.isNet ? 0 : 40,
          trailType: req.isNet ? "net" : "enemy",
        }, this.vfx);
        (proj as unknown as { isNet?: boolean }).isNet = req.isNet ?? false;
        this.enemyProjectiles.push(proj);
      }
    }
  }

  private checkEnemyProjectileHits(): void {
    for (const proj of this.enemyProjectiles) {
      if (!proj.alive) continue;

      const dx = Math.abs(proj.x - this.player.x);
      const dy = Math.abs(proj.worldY - this.player.y);
      if (dx < proj.radius + 24 && dy < COMBAT.meleeHitDepthRange + 10) {
        const dir = proj.x < this.player.x ? 1 : -1;
        const isNet = (proj as unknown as { isNet?: boolean }).isNet;

        if (isNet) {
          this.player.takeHit(proj.damage, dir * 30, 0);
          this.hitFeel.shake(2, 40);
        } else {
          this.player.takeHit(proj.damage, dir * proj.knockback, (Math.random() - 0.5) * 20);
          this.hitFeel.shake(proj.shakeIntensity, proj.shakeDuration);
        }
        this.spawnDamageNumber(this.player.x, this.player.y - 40, proj.damage, 0xff4444);
        this.hitFeel.impactFlash(this.player.x, this.player.y - 20);
        proj.destroy();
      }
    }

    for (let i = this.enemyProjectiles.length - 1; i >= 0; i--) {
      if (!this.enemyProjectiles[i].alive) this.enemyProjectiles.splice(i, 1);
    }
  }

  private processEnemyAoeHits(): void {
    for (const enemy of this.enemies) {
      if (!enemy.isAlive) continue;
      const aoe = enemy.drainAoeHit();
      if (!aoe) continue;

      const dx = Math.abs(aoe.x - this.player.x);
      const dy = Math.abs(aoe.y - this.player.y);
      if (dx < aoe.radius && dy < aoe.depthRange) {
        const dir = aoe.x < this.player.x ? 1 : -1;
        this.player.takeHit(aoe.damage, dir * aoe.knockback, (Math.random() - 0.5) * 30);
        this.spawnDamageNumber(this.player.x, this.player.y - 40, aoe.damage, 0xff4444);
        this.hitFeel.impactFlash(this.player.x, this.player.y - 20);
        this.hitFeel.shake(5, 80);
      }

      this.vfx.flashBurst(aoe.x, aoe.y - 20, 0xff4444, 6);
    }
  }

  private processEnemyAnnouncements(): void {
    for (const enemy of this.enemies) {
      if (!enemy.isAlive) continue;
      const msg = enemy.drainAnnouncement();
      if (!msg) continue;

      const ann = this.add.text(enemy.x, enemy.y - enemy.height - 30, msg, {
        fontFamily: "Georgia, serif", fontSize: "18px",
        color: "#ffcc44", fontStyle: "bold italic",
        backgroundColor: "#000000aa", padding: { left: 8, right: 8, top: 4, bottom: 4 },
      });
      ann.setOrigin(0.5);
      ann.setDepth(30000);
      this.tweens.add({
        targets: ann, y: ann.y - 40, alpha: 0,
        duration: 2000, delay: 500, ease: "Power2",
        onComplete: () => ann.destroy(),
      });
    }
  }

  private processBossSummons(): void {
    for (const enemy of this.enemies) {
      if (!enemy.isAlive || !enemy.pendingSummon) continue;
      const summons = enemy.pendingSummon;
      enemy.pendingSummon = null;

      const cy = enemy.y;
      for (let i = 0; i < summons.length; i++) {
        const typeDef = ENEMY_TYPES[summons[i]];
        const side = i % 2 === 0 ? 1 : -1;
        const x = enemy.x + side * (120 + i * 60);
        const y = cy + (Math.random() - 0.5) * 80;
        const spawned = new Enemy(this, x, y, enemy.level, typeDef);
        spawned.setVFX(this.vfx);
        spawned.boundsMinX = enemy.boundsMinX;
        spawned.boundsMaxX = enemy.boundsMaxX;
        this.enemies.push(spawned);

        spawned.container.setAlpha(0);
        spawned.container.setScale(0.3);
        this.tweens.add({
          targets: spawned.container,
          alpha: 1, scaleX: 1, scaleY: 1,
          duration: 400, ease: "Back.easeOut",
        });
      }

      this.hitFeel.shake(4, 80);
    }
  }

  private fireBoonEvent(trigger: import("../data/boons").BoonTrigger, ctx: import("../data/boons").EventContext, hitEnemy?: Enemy): void {
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
          this.spawnDamageNumber(this.player.x, this.player.y - 40, healAmt, 0x44ff44);
          break;
        }
        case "poison": {
          if (hitEnemy && hitEnemy.isAlive) {
            hitEnemy.applyPoison(action.damagePerTick, action.ticks, action.interval, action.color);
          } else {
            const tx = ctx.targetX ?? ctx.x;
            const ty = ctx.targetY ?? ctx.y;
            const living = this.enemies.filter(e => e.isAlive);
            for (const e of living) {
              const dist = Math.sqrt((e.x - tx) ** 2 + (e.y - ty) ** 2);
              if (dist < 300) {
                e.applyPoison(action.damagePerTick, action.ticks, action.interval, action.color);
              }
            }
          }
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

    if (!nearest) {
      this.vfx.magicSparkle(fromX + (Math.random() - 0.5) * 40, fromY - 20, color, 2);
      return;
    }

    const sparkProj = new Projectile(this, fromX, fromY, nearest.x > fromX, {
      radius: 6, speed: 600, color, maxRange: range + 50,
      damage, knockback: 60, hitstopMs: 30,
      shakeIntensity: 2, shakeDuration: 40,
      trailType: "spark",
    }, this.vfx);
    this.projectiles.push(sparkProj);

    if (bounces > 1) {
      this.time.delayedCall(200, () => {
        if (nearest && !nearest.isAlive) return;
        this.spawnChainSpark(nearest!.x, nearest!.y, Math.floor(damage * 0.8), bounces - 1, range, color);
      });
    }
  }

  private spawnLightningAoe(x: number, y: number, damage: number, radius: number, color: number): void {
    this.vfx.flashBurst(x, y - 30, color, 8);
    this.vfx.magicSparkle(x, y, color, 4);

    for (const enemy of this.enemies) {
      if (!enemy.isAlive) continue;
      const dx = Math.abs(enemy.x - x);
      const dy = Math.abs(enemy.y - y);
      if (dx < radius && dy < radius * 0.6) {
        const dir = x < enemy.x ? 1 : -1;
        enemy.takeHit(damage, dir * 100, (Math.random() - 0.5) * 20);
        this.spawnDamageNumber(enemy.x, enemy.y - enemy.height / 2, damage, 0xffdd44);
        this.hitFeel.impactFlash(enemy.x, enemy.y - enemy.height / 3);
      }
    }
    this.hitFeel.shake(3, 60);
  }

  private spawnDamageBurst(x: number, y: number, damage: number, radius: number, color: number): void {
    this.vfx.flashBurst(x, y - 20, color, 6);
    this.vfx.projectileImpact(x, y - 20, color);

    for (const enemy of this.enemies) {
      if (!enemy.isAlive) continue;
      const dx = Math.abs(enemy.x - x);
      const dy = Math.abs(enemy.y - y);
      if (dx < radius && dy < radius * 0.6) {
        const dir = x < enemy.x ? 1 : -1;
        enemy.takeHit(damage, dir * 80, (Math.random() - 0.5) * 20);
        this.spawnDamageNumber(enemy.x, enemy.y - enemy.height / 2, damage, 0xffdd44);
        this.hitFeel.impactFlash(enemy.x, enemy.y - enemy.height / 3);
      }
    }
    this.hitFeel.shake(2, 50);
  }

  // ── Wave logic ──

  private returnToHub(): void {
    this.sceneEnding = true;
    AudioManager.instance.stopMusic(0.3);
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
        this.autoCollectPickups();
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

  private autoCollectPickups(): void {
    const baseMaxHp = this.config.character === "john" ? JOHN.maxHp : this.config.character === "luna" ? LUNA.maxHp : this.config.character === "heather" ? HEATHER.maxHp : ULTIMATE.maxHp;
    const maxHp = this.config.mode === "run"
      ? this.runState.boons.getStat("maxHp", baseMaxHp)
      : baseMaxHp;

    for (const pickup of this.pickups) {
      if (!pickup.isAlive) continue;
      const hpBefore = this.player.hp;
      this.player.hp = Math.min(maxHp, this.player.hp + pickup.healAmount);
      const healed = this.player.hp - hpBefore;
      if (healed > 0) this.spawnDamageNumber(this.player.x, this.player.y - 40, healed, 0x44ff44);
      pickup.collect(true);
    }
  }

  private spawnDamageNumber(x: number, y: number, amount: number, color: number): void {
    const txt = this.add.text(x, y - 30, `${Math.round(amount)}`, {
      fontFamily: "monospace", fontSize: "14px", fontStyle: "bold",
      color: `#${color.toString(16).padStart(6, "0")}`,
      stroke: "#000000", strokeThickness: 2,
    });
    txt.setOrigin(0.5);
    txt.setDepth(9999);
    const offsetX = (Math.random() - 0.5) * 20;
    this.tweens.add({
      targets: txt,
      x: x + offsetX, y: y - 60,
      alpha: 0,
      duration: 700,
      ease: "Cubic.easeOut",
      onComplete: () => txt.destroy(),
    });
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

    let restoreMusic: (() => void) | null = null;
    AudioManager.instance.playStingWithDuck("victory").then((unduck) => {
      restoreMusic = unduck;
    });

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
      restoreMusic?.();
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
      const proj = new Projectile(this, req.x, req.y, req.facingRight, req.config, this.vfx);
      (proj as unknown as { isHeavy?: boolean }).isHeavy = req.isHeavy ?? false;
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
        this.spawnDamageNumber(enemy.x, enemy.y - enemy.height / 2, hitBox.damage, 0xffffff);
        this.hitFeel.impactFlash(enemy.x, enemy.y - enemy.height / 3);
        this.hitFeel.shake(hitBox.shakeIntensity, hitBox.shakeDuration);

        if (this.config.mode === "run" || this.config.mode === "enemies") {
          const ctx = { x: this.player.x, y: this.player.y, targetX: enemy.x, targetY: enemy.y };
          if (hitBox.isRush || hitBox.damage >= 20) {
            this.fireBoonEvent("onHeavyHit", ctx, enemy);
          } else {
            this.fireBoonEvent("onMeleeHit", ctx, enemy);
            this.fireBoonEvent("onLightHit", ctx, enemy);
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
        this.spawnDamageNumber(t.x, t.y - t.height / 2, hitBox.damage, 0xffffff);
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
          this.spawnDamageNumber(enemy.x, enemy.y - enemy.height / 2, proj.damage, 0xffffff);
          this.hitFeel.projectileImpact(enemy.x, enemy.y - enemy.height / 3, proj.circle.fillColor);
          this.hitFeel.shake(proj.shakeIntensity, proj.shakeDuration);

          if (this.config.mode === "run" || this.config.mode === "enemies") {
            const ctx = { x: proj.x, y: proj.worldY, targetX: enemy.x, targetY: enemy.y };
            const heavy = (proj as unknown as { isHeavy?: boolean }).isHeavy;
            this.fireBoonEvent("onProjectileHit", ctx, enemy);
            if (heavy) {
              this.fireBoonEvent("onHeavyHit", ctx, enemy);
            } else {
              this.fireBoonEvent("onLightHit", ctx, enemy);
            }
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
        this.spawnDamageNumber(t.x, t.y - t.height / 2, aoe.damage, 0xffffff);
        this.hitFeel.impactFlash(t.x, t.y - t.height / 3);
      }
    }
  }

  private checkUltimateBlast(): void {
    if (!this.player.pendingUltBlast) return;
    this.player.pendingUltBlast = false;

    if (this.player instanceof LunaPlayer) {
      for (const enemy of this.enemies) {
        if (!enemy.isAlive) continue;
        enemy.stunFor(LUNA_ULTIMATE.fearDuration);
        this.hitFeel.impactFlash(enemy.x, enemy.y - enemy.height / 3);
      }
      return;
    }

    const targets = [...this.dummies, ...this.enemies];
    for (const t of targets) {
      if (!t.isAlive) continue;
      const dir = this.player.x < t.x ? 1 : -1;
      t.takeHit(ULTIMATE.blastDamage, dir * ULTIMATE.blastKnockback, (Math.random() - 0.5) * 100);
      this.spawnDamageNumber(t.x, t.y - t.height / 2, ULTIMATE.blastDamage, 0xffffff);
      this.hitFeel.impactFlash(t.x, t.y - t.height / 3);
    }
  }

  private checkDirectionalUltBlast(): void {
    if (this.player.pendingDirectionalUltBlast <= 0) return;
    const hitDamage = this.player.pendingDirectionalUltBlast;
    this.player.pendingDirectionalUltBlast = 0;

    if (this.player instanceof LunaPlayer) {
      const targets = [...this.dummies, ...this.enemies];
      for (const t of targets) {
        if (!t.isAlive) continue;
        const dx = Math.abs(t.x - this.player.x);
        const dy = Math.abs(t.y - this.player.y);
        if (dx > LUNA_ULTIMATE.frenzyRadius * 2 || dy > LUNA_ULTIMATE.frenzyRadius) continue;
        const kbDir = this.player.x < t.x ? 1 : -1;
        t.takeHit(hitDamage, kbDir * 100, (Math.random() - 0.5) * 30);
        this.spawnDamageNumber(t.x, t.y - t.height / 2, hitDamage, 0xffffff);
        this.hitFeel.impactFlash(t.x, t.y - t.height / 3);
      }
      return;
    }

    const dir = this.player.facingRight ? 1 : -1;
    const targets = [...this.dummies, ...this.enemies];
    for (const t of targets) {
      if (!t.isAlive) continue;
      const dx = (t.x - this.player.x) * dir;
      if (dx < 0 || dx > 900) continue;
      const kbDir = this.player.x < t.x ? 1 : -1;
      t.takeHit(hitDamage, kbDir * JOHN_ULTIMATE.beamKnockback * 0.4, (Math.random() - 0.5) * 40);
      this.spawnDamageNumber(t.x, t.y - t.height / 2, hitDamage, 0xffffff);
      this.hitFeel.impactFlash(t.x, t.y - t.height / 3);
    }
  }

  private checkParryStun(): void {
    if (!(this.player instanceof JohnPlayer)) return;
    const john = this.player as JohnPlayer;
    if (!john.pendingParryStun) return;
    john.pendingParryStun = false;

    for (const enemy of this.enemies) {
      if (!enemy.isAlive) continue;
      const dx = Math.abs(enemy.x - this.player.x);
      const dy = Math.abs(enemy.y - this.player.y);
      if (dx < COMBAT.meleeHitRange + enemy.width && dy < COMBAT.meleeHitDepthRange + 20) {
        enemy.stunFor(JOHN_PARRY.counterStunDuration);
        this.hitFeel.impactFlash(enemy.x, enemy.y - enemy.height / 3);
      }
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
        const wasParrying = this.player.combat.isParrying || this.player.combat.isGuarding;
        const dir = enemy.x < this.player.x ? 1 : -1;
        this.player.takeHit(hit.damage, dir * hit.knockback, (Math.random() - 0.5) * 30);
        this.spawnDamageNumber(this.player.x, this.player.y - 40, hit.damage, 0xff4444);
        this.hitFeel.impactFlash(this.player.x, this.player.y - 20);

        if (this.config.mode === "run" || this.config.mode === "enemies") {
          const ctx = { x: this.player.x, y: this.player.y, targetX: enemy.x, targetY: enemy.y };
          if (wasBlocking || wasParrying) {
            this.fireBoonEvent("onBlock", ctx);
          } else {
            this.fireBoonEvent("onTakeDamage", ctx);
          }
        }
      }
    }
  }

  private checkPickupCollection(): void {
    const baseMaxHp = this.config.character === "john" ? JOHN.maxHp : this.config.character === "luna" ? LUNA.maxHp : this.config.character === "heather" ? HEATHER.maxHp : ULTIMATE.maxHp;
    const maxHp = this.config.mode === "run"
      ? this.runState.boons.getStat("maxHp", baseMaxHp)
      : baseMaxHp;

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
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      if (!this.projectiles[i].alive) this.projectiles.splice(i, 1);
    }
  }

  private pruneDeadPickups(): void {
    for (let i = this.pickups.length - 1; i >= 0; i--) {
      if (!this.pickups[i].isAlive) this.pickups.splice(i, 1);
    }
  }

  // ── HUD ──

  private updateComboDisplay(): void {
    const comboId = this.player.currentComboId;
    const specialName = this.player.currentSpecialName;

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
    } else if (comboId) {
      const activeNode = (this.config.character === "john" || this.config.character === "luna" || this.config.character === "heather") ? null : this.findNodeById(comboId);
      this.comboNameDisplay.setText(activeNode ? activeNode.name : comboId);
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
    const w = this.levelWidth;
    const bg = this.add.rectangle(w / 2, ARENA.height / 2, w, ARENA.height, COLORS.background);
    bg.setDepth(-1000);
    const ground = this.add.rectangle(w / 2, ARENA.groundY + ARENA.groundHeight / 2, w, ARENA.groundHeight, COLORS.groundFill);
    ground.setDepth(-999);
    const groundTop = this.add.rectangle(w / 2, ARENA.groundY, w, 2, COLORS.groundLine);
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
      gfx.lineBetween(0, y, this.levelWidth, y);
    }
  }

  private drawBoundaryWalls(): void {
    const wallThickness = ARENA.boundaryPadding;
    const leftWall = this.add.rectangle(wallThickness / 2, ARENA.height / 2, wallThickness, ARENA.height, COLORS.wallFill);
    leftWall.setDepth(10000); leftWall.setAlpha(0.8);
    const rightWall = this.add.rectangle(this.levelWidth - wallThickness / 2, ARENA.height / 2, wallThickness, ARENA.height, COLORS.wallFill);
    rightWall.setDepth(10000); rightWall.setAlpha(0.8);
  }

  private setupCamera(): void {
    this.cameras.main.setBounds(0, 0, this.levelWidth, ARENA.height);
    this.cameras.main.startFollow(this.player.container, true, 0.08, 0.08);
    if (this.waveTriggers.length > 0) {
      this.cameras.main.setFollowOffset(-GAME_WIDTH * 0.12, 0);
    }
    this.cameras.main.setDeadzone(GAME_WIDTH * 0.15, GAME_HEIGHT * 0.15);
  }

  private addHUD(): void {
    const version = this.add.text(GAME_WIDTH - 16, GAME_HEIGHT - 16, "B0.9.0", {
      fontFamily: "monospace", fontSize: "14px", color: COLORS.subtitleText,
    });
    version.setOrigin(1, 1); version.setScrollFactor(0); version.setDepth(20000);

    const controlHint = new PromptLine(this, 16, GAME_HEIGHT - 16, this.input_mgr, {
      fontFamily: "monospace", fontSize: "10px", color: COLORS.subtitleText,
    }, "left");
    controlHint.setScrollFactor(0); controlHint.setDepth(20000);

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
        const isGP = this.input_mgr.lastDevice === "gamepad";
        const move: PromptPart = isGP ? PS_NAV.STICK : "WASD";
        const ult: PromptPart[] = isGP
          ? [{ icon: "ps-btn-4" } as IconRef, "+", { icon: "ps-btn-5" } as IconRef]
          : ["I+L"];
        controlHint.setPrompt([
          "Move: ", move, "  |  Light: ", Action.ATTACK,
          "  |  Heavy: ", Action.HEAVY, "  |  Jump: ", Action.JUMP,
          "  |  Block/Throw: ", Action.THROW, "  |  Ult: ", ...ult,
          "  |  Dash: Dbl-tap dir",
        ]);
      },
    });
  }

  private initDebugPanel(): void {
    this.debugPanel = new DebugPanel(this, this.input_mgr);

    this.fpsText = this.add.text(16, 16, "", {
      fontFamily: "monospace", fontSize: "12px", color: "#00ff00",
    });
    this.fpsText.setScrollFactor(0);
    this.fpsText.setDepth(30001);
    this.fpsText.setVisible(false);

    this.audioDebugText = this.add.text(16, GAME_HEIGHT - 130, "", {
      fontFamily: "monospace", fontSize: "10px", color: "#00ccff",
      backgroundColor: "#000000aa",
      padding: { left: 6, right: 6, top: 4, bottom: 4 },
    });
    this.audioDebugText.setScrollFactor(0);
    this.audioDebugText.setDepth(30001);
    this.audioDebugText.setVisible(false);
  }

  private applyDebugOptions(_delta: number): void {
    if (this.debugPanel.isEnabled("fps")) {
      this.fpsText!.setVisible(true);
      this.fpsText!.setText(`FPS: ${Math.round(this.game.loop.actualFps)}`);
    } else {
      this.fpsText!.setVisible(false);
    }

    if (this.debugPanel.isEnabled("invincible")) {
      this.player.hp = Math.max(this.player.hp, 999);
    }

    if (this.debugPanel.isEnabled("inf_mp")) {
      this.player.mp = 100;
    }

    if (this.debugPanel.isEnabled("kill_all")) {
      for (const enemy of this.enemies) {
        if (enemy.isAlive) enemy.takeHit(99999, 0, 0);
      }
      for (const dummy of this.dummies) {
        if (dummy.isAlive) dummy.takeHit(99999, 0, 0);
      }
      this.debugPanel["options"].find(o => o.id === "kill_all")!.enabled = false;
    }

    if (this.debugPanel.isEnabled("inf_cooldowns")) {
      const p = this.player as any;
      if (p.totemCooldowns) {
        for (const key of Object.keys(p.totemCooldowns)) p.totemCooldowns[key] = 0;
      }
      if (p.dashCooldownTimer !== undefined) p.dashCooldownTimer = 0;
    }

    if (this.debugPanel.isEnabled("slow_mo")) {
      this.time.timeScale = 0.5;
    } else {
      this.time.timeScale = 1;
    }

    const audioDbg = this.debugPanel.isEnabled("audio_debug");
    AudioManager.instance.debug = audioDbg;
    if (audioDbg) {
      const info = AudioManager.instance.getDebugInfo();
      const connStatus = info.connected ? "CONNECTED" : "DISCONNECTED";
      const lines = [
        `AUDIO DEBUG`,
        `ctx: ${info.contextState}  output: ${connStatus}`,
        `track: ${info.currentTrack}  gen: ${info.musicGeneration}`,
        `gain: ${info.musicGainValue.toFixed(3)}  sfx: ${info.activeSfx}`,
        `heartbeat: ${(info.heartbeatAge / 1000).toFixed(1)}s  input: ${(info.interactionAge / 1000).toFixed(1)}s`,
        `--- recent ---`,
        ...info.recentLog.slice(-6),
      ];
      this.audioDebugText!.setText(lines.join("\n"));
      this.audioDebugText!.setVisible(true);
    } else {
      this.audioDebugText!.setVisible(false);
    }

    if (this.debugPanel.isEnabled("hitboxes")) {
      this.drawHitboxOverlays();
    } else {
      this.clearHitboxOverlays();
    }

    if (this.debugPanel.isEnabled("positions")) {
      this.updatePositionOverlays();
    } else {
      this.clearPositionOverlays();
    }
  }

  private positionOverlays: Phaser.GameObjects.Text[] = [];

  private updatePositionOverlays(): void {
    this.clearPositionOverlays();

    const pText = this.add.text(this.player.x, this.player.y - 60, `P(${Math.round(this.player.x)}, ${Math.round(this.player.y)})`, {
      fontFamily: "monospace", fontSize: "10px", color: "#00ffff",
    });
    pText.setOrigin(0.5, 1);
    pText.setDepth(25000);
    this.positionOverlays.push(pText);

    for (const e of this.enemies) {
      if (!e.isAlive) continue;
      const eText = this.add.text(e.x, e.y - 50, `E(${Math.round(e.x)}, ${Math.round(e.y)}) HP:${e.hp}`, {
        fontFamily: "monospace", fontSize: "9px", color: "#ff6666",
      });
      eText.setOrigin(0.5, 1);
      eText.setDepth(25000);
      this.positionOverlays.push(eText);
    }

    for (const d of this.dummies) {
      if (!d.isAlive) continue;
      const dText = this.add.text(d.x, d.y - 50, `D(${Math.round(d.x)}, ${Math.round(d.y)})`, {
        fontFamily: "monospace", fontSize: "9px", color: "#aaaaff",
      });
      dText.setOrigin(0.5, 1);
      dText.setDepth(25000);
      this.positionOverlays.push(dText);
    }

    for (const t of this.totems) {
      const tText = this.add.text(t.x, t.y - 40, `T:${t.type}(${Math.round(t.x)})`, {
        fontFamily: "monospace", fontSize: "9px", color: "#ffaa00",
      });
      tText.setOrigin(0.5, 1);
      tText.setDepth(25000);
      this.positionOverlays.push(tText);
    }
  }

  private clearPositionOverlays(): void {
    for (const o of this.positionOverlays) o.destroy();
    this.positionOverlays = [];
  }

  private hitboxOverlays: Phaser.GameObjects.Rectangle[] = [];

  private drawHitboxOverlays(): void {
    this.clearHitboxOverlays();

    const hitBox = this.player.getHitBox();
    if (hitBox) {
      const rect = this.add.rectangle(hitBox.x, hitBox.y, hitBox.range * 2, hitBox.depthRange * 2, 0x00ff00, 0.25);
      rect.setStrokeStyle(1, 0x00ff00);
      rect.setDepth(25000);
      this.hitboxOverlays.push(rect);
    }

    for (const enemy of this.enemies) {
      if (!enemy.isAlive) continue;
      const eRect = this.add.rectangle(enemy.x, enemy.y, enemy.width, enemy.height, 0xff0000, 0.15);
      eRect.setStrokeStyle(1, 0xff0000);
      eRect.setDepth(25000);
      this.hitboxOverlays.push(eRect);
    }

    for (const dummy of this.dummies) {
      if (!dummy.isAlive) continue;
      const dRect = this.add.rectangle(dummy.x, dummy.y, dummy.width, dummy.height, 0x6666ff, 0.15);
      dRect.setStrokeStyle(1, 0x6666ff);
      dRect.setDepth(25000);
      this.hitboxOverlays.push(dRect);
    }
  }

  private clearHitboxOverlays(): void {
    for (const o of this.hitboxOverlays) o.destroy();
    this.hitboxOverlays = [];
  }

  private updateBossHealthBar(): void {
    const boss = this.enemies.find(e => e.isAlive && e.typeDef.isBoss);

    if (!boss) {
      if (this.bossHpBarBg) {
        this.bossHpBarBg.setVisible(false);
        this.bossHpBarFill!.setVisible(false);
        this.bossHpBarBorder!.setVisible(false);
        this.bossNameText!.setVisible(false);
        for (const m of this.bossPhaseMarkers) m.setVisible(false);
      }
      return;
    }

    const barW = GAME_WIDTH * 0.8;
    const barH = 14;
    const barX = GAME_WIDTH * 0.1;
    const barY = 20;

    if (!this.bossHpBarBg) {
      this.bossHpBarBorder = this.add.rectangle(barX + barW / 2, barY + barH / 2, barW + 4, barH + 4, 0x000000)
        .setScrollFactor(0).setDepth(20001).setOrigin(0.5);
      this.bossHpBarBg = this.add.rectangle(barX, barY, barW, barH, 0x222222)
        .setScrollFactor(0).setDepth(20002).setOrigin(0, 0);
      this.bossHpBarFill = this.add.rectangle(barX, barY, barW, barH, 0x44cc44)
        .setScrollFactor(0).setDepth(20003).setOrigin(0, 0);
      this.bossNameText = this.add.text(GAME_WIDTH / 2, barY - 8, "", {
        fontFamily: "monospace", fontSize: "12px", color: "#ffffff", fontStyle: "bold",
      }).setOrigin(0.5, 1).setScrollFactor(0).setDepth(20004);

      const thresholds = boss.typeDef.phaseThresholds;
      this.bossPhaseMarkers = thresholds.map(t => {
        const mx = barX + barW * (1 - t);
        return this.add.rectangle(mx, barY - 1, 2, barH + 2, 0xffffff)
          .setScrollFactor(0).setDepth(20005).setOrigin(0.5, 0).setAlpha(0.6);
      });
    }

    this.bossHpBarBg!.setVisible(true);
    this.bossHpBarFill!.setVisible(true);
    this.bossHpBarBorder!.setVisible(true);
    this.bossNameText!.setVisible(true);
    for (const m of this.bossPhaseMarkers) m.setVisible(true);

    const ratio = Math.max(0, boss.hp / boss.maxHp);
    this.bossHpBarFill!.setSize(barW * ratio, barH);

    let fillColor = 0x44cc44;
    if (ratio < 0.25) fillColor = 0xcc2222;
    else if (ratio < 0.5) fillColor = 0xdd8822;
    else if (ratio < 0.75) fillColor = 0xcccc22;
    this.bossHpBarFill!.setFillStyle(fillColor);

    this.bossNameText!.setText(boss.typeDef.name.toUpperCase());
  }

  private buildComboListHUD(): void {
    const isJohn = this.config.character === "john";
    const isLuna = this.config.character === "luna";
    const isHeather = this.config.character === "heather";

    if (isHeather) {
      this.buildHeatherMoveListHUD();
    } else if (isLuna) {
      this.buildLunaMoveListHUD();
    } else if (isJohn) {
      this.buildJohnMoveListHUD();
    } else {
      this.buildAndrewBeaComboListHUD();
    }

    this.comboNameDisplay = this.add.text(GAME_WIDTH / 2, 68, "", {
      fontFamily: "monospace", fontSize: "20px", color: COLORS.accent, fontStyle: "bold",
    });
    this.comboNameDisplay.setOrigin(0.5);
    this.comboNameDisplay.setScrollFactor(0);
    this.comboNameDisplay.setDepth(20000);
    this.comboNameDisplay.setAlpha(0);
  }

  private buildAndrewBeaComboListHUD(): void {
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
  }

  private buildJohnMoveListHUD(): void {
    const yRow1 = 14; const yRow2 = 30; const yRow3 = 46;
    const startX = 16;
    const labelStyle = { fontFamily: "monospace", fontSize: "10px", color: COLORS.subtitleText };

    const dirLabel = (m: typeof JOHN_MOVES[0]): string => {
      if (m.dir === "neutral") return m.name;
      if (m.dir === "guard") return `\u25CB+${m.name}`;
      return `${m.dir[0].toUpperCase()}+${m.name}`;
    };

    const squareMoves = JOHN_MOVES.filter(m => m.button === "L");
    const triangleMoves = JOHN_MOVES.filter(m => m.button === "H");

    let xCursor = startX;
    const headerL = this.add.text(xCursor, yRow1, "\u25A1:", { ...labelStyle });
    headerL.setScrollFactor(0); headerL.setDepth(20000); headerL.setAlpha(0.6);
    xCursor += headerL.width + 6;
    for (const m of squareMoves) {
      const t = this.add.text(xCursor, yRow1, dirLabel(m), labelStyle);
      t.setScrollFactor(0); t.setDepth(20000); t.setAlpha(0.5);
      this.comboListTexts.set(m.name, t);
      xCursor += t.width + 10;
    }

    xCursor = startX;
    const headerH = this.add.text(xCursor, yRow2, "\u25B3:", { ...labelStyle });
    headerH.setScrollFactor(0); headerH.setDepth(20000); headerH.setAlpha(0.6);
    xCursor += headerH.width + 6;
    for (const m of triangleMoves) {
      const t = this.add.text(xCursor, yRow2, dirLabel(m), labelStyle);
      t.setScrollFactor(0); t.setDepth(20000); t.setAlpha(0.5);
      this.comboListTexts.set(m.name, t);
      xCursor += t.width + 10;
    }

    const specialRow = this.add.text(startX, yRow3,
      "\u25CB: Tap=Parry  Hold=Guard Stance  Hold+\u25A1/\u25B3=Guard Move  |  Throw: \u25CB near enemy  |  Ult: L1+R1  |  Dash: Dbl-tap",
      labelStyle);
    specialRow.setScrollFactor(0); specialRow.setDepth(20000); specialRow.setAlpha(0.5);
  }

  private buildLunaMoveListHUD(): void {
    const yRow1 = 14; const yRow2 = 30; const yRow3 = 46;
    const startX = 16;
    const labelStyle = { fontFamily: "monospace", fontSize: "10px", color: COLORS.subtitleText };

    const dirLabel = (m: typeof LUNA_DOG_MOVES[0]): string => {
      const suffix = m.switchMode ? "\u2B06" : "";
      if (m.dir === "neutral") return m.name + suffix;
      if (m.dir === "guard") return `\u25CB+${m.name}${suffix}`;
      return `${m.dir[0].toUpperCase()}+${m.name}${suffix}`;
    };

    const dogL = LUNA_DOG_MOVES.filter(m => m.button === "L");
    const dogH = LUNA_DOG_MOVES.filter(m => m.button === "H");

    let xCursor = startX;
    const headerL = this.add.text(xCursor, yRow1, "\uD83D\uDC3E\u25A1:", { ...labelStyle });
    headerL.setScrollFactor(0); headerL.setDepth(20000); headerL.setAlpha(0.6);
    xCursor += headerL.width + 6;
    for (const m of dogL) {
      const t = this.add.text(xCursor, yRow1, dirLabel(m), labelStyle);
      t.setScrollFactor(0); t.setDepth(20000); t.setAlpha(0.5);
      this.comboListTexts.set(m.name, t);
      xCursor += t.width + 10;
    }

    xCursor = startX;
    const headerH = this.add.text(xCursor, yRow2, "\uD83D\uDC3E\u25B3:", { ...labelStyle });
    headerH.setScrollFactor(0); headerH.setDepth(20000); headerH.setAlpha(0.6);
    xCursor += headerH.width + 6;
    for (const m of dogH) {
      const t = this.add.text(xCursor, yRow2, dirLabel(m), labelStyle);
      t.setScrollFactor(0); t.setDepth(20000); t.setAlpha(0.5);
      this.comboListTexts.set(m.name, t);
      xCursor += t.width + 10;
    }

    const specialRow = this.add.text(startX, yRow3,
      "\u25CB: Toggle Dog\u2194Lunar  |  Ult: L1+R1 Howl  |  Dash: Dbl-tap",
      labelStyle);
    specialRow.setScrollFactor(0); specialRow.setDepth(20000); specialRow.setAlpha(0.5);
  }

  private buildHeatherMoveListHUD(): void {
    const yRow1 = 14; const yRow2 = 30; const yRow3 = 46;
    const startX = 16;
    const labelStyle = { fontFamily: "monospace", fontSize: "10px", color: COLORS.subtitleText };

    const dirLabel = (m: typeof HEATHER_LIGHT_MOVES[0]): string => {
      if (m.dir === "neutral") return m.name;
      return `${m.dir[0].toUpperCase()}+${m.name}`;
    };

    const lightMoves = HEATHER_LIGHT_MOVES;
    const heavyMoves = HEATHER_HEAVY_MOVES;

    let xCursor = startX;
    const headerL = this.add.text(xCursor, yRow1, "\u25A1 Tap:", { ...labelStyle });
    headerL.setScrollFactor(0); headerL.setDepth(20000); headerL.setAlpha(0.6);
    xCursor += headerL.width + 6;
    for (const m of lightMoves) {
      const t = this.add.text(xCursor, yRow1, dirLabel(m), labelStyle);
      t.setScrollFactor(0); t.setDepth(20000); t.setAlpha(0.5);
      this.comboListTexts.set(m.name, t);
      xCursor += t.width + 10;
    }
    const holdL = this.add.text(xCursor, yRow1, "| Hold=Haste", labelStyle);
    holdL.setScrollFactor(0); holdL.setDepth(20000); holdL.setAlpha(0.4);

    xCursor = startX;
    const headerH = this.add.text(xCursor, yRow2, "\u25B3 Tap:", { ...labelStyle });
    headerH.setScrollFactor(0); headerH.setDepth(20000); headerH.setAlpha(0.6);
    xCursor += headerH.width + 6;
    for (const m of heavyMoves) {
      const t = this.add.text(xCursor, yRow2, dirLabel(m), labelStyle);
      t.setScrollFactor(0); t.setDepth(20000); t.setAlpha(0.5);
      this.comboListTexts.set(m.name, t);
      xCursor += t.width + 10;
    }
    const holdH = this.add.text(xCursor, yRow2, "| Hold=Fury", labelStyle);
    holdH.setScrollFactor(0); holdH.setDepth(20000); holdH.setAlpha(0.4);

    const specialRow = this.add.text(startX, yRow3,
      "\u25CB Tap=Parry Hold=Barrier  |  Hold X(air)=Hover\u21924s=Ward  |  Ult: L1+R1  |  Dash: Dbl-tap",
      labelStyle);
    specialRow.setScrollFactor(0); specialRow.setDepth(20000); specialRow.setAlpha(0.5);
  }

  // ═══════════════════════════════════════════════════════════
  //  HEATHER TOTEM SYSTEM
  // ═══════════════════════════════════════════════════════════

  private resetTotemBuffs(): void {
    if (this.player instanceof HeatherPlayer) {
      const heather = this.player as HeatherPlayer;
      heather.totemSpeedMult = 1;
      heather.totemMpRegenMult = 1;
      heather.totemDamageReduction = 0;
      heather.activeStatuses = [];
    }
  }

  private checkTotemSpawns(): void {
    if (!(this.player instanceof HeatherPlayer)) return;
    const heather = this.player as HeatherPlayer;
    const req = heather.pendingTotemSpawn;
    if (!req) return;
    heather.pendingTotemSpawn = null;

    // Per-type replacement: detonate existing totem of same type
    const existing = this.totems.find(t => t.isAlive && t.type === req.type);
    if (existing) {
      const dmg = existing.detonate();
      if (dmg > 0) {
        for (const enemy of this.enemies) {
          if (!enemy.isAlive) continue;
          if (existing.isInRange(enemy.x, enemy.y)) {
            const wasAlive = enemy.isAlive;
            enemy.takeHit(dmg, enemy.x > existing.x ? 1 : -1, 0);
            this.spawnDamageNumber(enemy.x, enemy.y - enemy.height / 2, dmg, 0xffffff);
            this.hitFeel.impactFlash(enemy.x, enemy.y - enemy.height / 3);
            if (wasAlive && !enemy.isAlive) {
              const ctx = { x: existing.x, y: existing.y, targetX: enemy.x, targetY: enemy.y };
              this.fireBoonEvent("onKill", ctx);
            }
          }
        }
      }
    }

    const boons = (this.config.mode === "run" || this.config.mode === "enemies")
      ? this.runState.boons : null;
    const totem = new Totem(this, req.x, req.y, req.type, boons);
    this.totems.push(totem);
  }

  private updateTotems(dt: number): void {
    for (const totem of this.totems) {
      if (!totem.isAlive) continue;
      totem.update(dt);

      // Ward: heal player if in range
      if (totem.type === "ward" && totem.shouldWardHeal()) {
        if (totem.isInRange(this.player.x, this.player.y)) {
          const heal = totem.getWardHealTick();
          const baseMaxHp = this.config.character === "heather" ? HEATHER.maxHp : ULTIMATE.maxHp;
          const maxHp = this.runState.boons.getStat("maxHp", baseMaxHp);
          if (this.player.hp < maxHp) {
            this.player.hp = Math.min(maxHp, this.player.hp + heal);
            this.spawnDamageNumber(this.player.x, this.player.y - 40, heal, 0x44cc44);
          }
        }
      }

      // Fury: fire projectiles at nearest enemy or dummy
      if (totem.type === "fury" && totem.shouldFuryFire()) {
        let nearestX = 0;
        let nearestY = 0;
        let nearDist = Infinity;
        let found = false;
        for (const e of this.enemies) {
          if (!e.isAlive) continue;
          const dx = Math.abs(e.x - totem.x);
          const dy = Math.abs(e.y - totem.y);
          const dist = dx + dy;
          if (dist < nearDist && dist < 500) {
            nearDist = dist;
            nearestX = e.x;
            nearestY = e.y;
            found = true;
          }
        }
        for (const d of this.dummies) {
          if (!d.isAlive) continue;
          const dx = Math.abs(d.x - totem.x);
          const dy = Math.abs(d.y - totem.y);
          const dist = dx + dy;
          if (dist < nearDist && dist < 500) {
            nearDist = dist;
            nearestX = d.x;
            nearestY = d.y;
            found = true;
          }
        }
        if (found) {
          const dx = nearestX - totem.x;
          const dy = nearestY - totem.y;
          const len = Math.sqrt(dx * dx + dy * dy) || 1;
          const speed = TOTEM_CONFIG.fury.projectileSpeed;
          const aimVx = (dx / len) * speed;
          const aimVy = (dy / len) * speed;
          const facingRight = dx >= 0;
          const dmg = totem.getFuryDamage();
          const proj = new Projectile(this, totem.x, totem.y, facingRight, {
            radius: TOTEM_CONFIG.fury.projectileRadius,
            speed: Math.abs(aimVx),
            vy: aimVy,
            color: TOTEM_CONFIG.fury.fireballColor,
            maxRange: 500,
            damage: dmg,
            knockback: 80,
            hitstopMs: 25,
            shakeIntensity: 1,
            shakeDuration: 20,
            trailType: "fire",
          }, this.vfx);
          (proj as unknown as { isHeavy: boolean }).isHeavy = true;
          this.projectiles.push(proj);
        }
      }
    }
  }

  private applyTotemBuffs(): void {
    if (!(this.player instanceof HeatherPlayer)) return;
    const heather = this.player as HeatherPlayer;
    const statuses: string[] = [];

    let speedMult = 1;
    let mpRegenMult = 1;
    let damageReduction = 0;

    for (const totem of this.totems) {
      if (!totem.isAlive) continue;
      if (!totem.isInRange(this.player.x, this.player.y)) continue;

      if (totem.type === "haste") {
        speedMult = 1 + TOTEM_CONFIG.haste.speedBoost;
        mpRegenMult = 1 + TOTEM_CONFIG.haste.mpRegenBoost;
        statuses.push("\u26A1");
      }
      if (totem.type === "barrier") {
        damageReduction = Math.max(damageReduction, TOTEM_CONFIG.barrier.damageReduction);
        statuses.push("\uD83D\uDEE1\uFE0F");
      }
      if (totem.type === "ward") {
        statuses.push("\uD83D\uDC9A");
      }
      if (totem.type === "fury") {
        statuses.push("\uD83D\uDD25");
      }
    }

    heather.totemSpeedMult = speedMult;
    heather.totemMpRegenMult = mpRegenMult;
    heather.totemDamageReduction = damageReduction;
    heather.activeStatuses = statuses;
  }

  private checkCatalystPulse(): void {
    if (!(this.player instanceof HeatherPlayer)) return;
    const heather = this.player as HeatherPlayer;
    if (!heather.pendingCatalystPulse) return;
    heather.pendingCatalystPulse = false;

    const pulseRadius = HEATHER_PARRY.pulseRadius;
    const pulseDmg = HEATHER_PARRY.pulseDamage;

    this.vfx.flashBurst(this.player.x, this.player.y, HEATHER_COLORS.catalystPulse, 8);
    this.vfx.magicSparkle(this.player.x, this.player.y, HEATHER_COLORS.catalystPulse, 4);

    for (const enemy of this.enemies) {
      if (!enemy.isAlive) continue;
      const dx = Math.abs(enemy.x - this.player.x);
      const dy = Math.abs(enemy.y - this.player.y);
      if (dx < pulseRadius && dy < pulseRadius * 0.3) {
        enemy.stunFor(HEATHER_PARRY.counterStunDuration);
        enemy.takeHit(pulseDmg, enemy.x > this.player.x ? 1 : -1, 0);
        this.spawnDamageNumber(enemy.x, enemy.y - enemy.height / 2, pulseDmg, 0xcc88ff);
        this.hitFeel.impactFlash(enemy.x, enemy.y - enemy.height / 3);
      }
    }
  }

  private checkHeatherParryStun(): void {
    if (!(this.player instanceof HeatherPlayer)) return;
    const heather = this.player as HeatherPlayer;
    if (!heather.pendingParryStun) return;
    heather.pendingParryStun = false;

    for (const enemy of this.enemies) {
      if (!enemy.isAlive) continue;
      const dx = Math.abs(enemy.x - this.player.x);
      const dy = Math.abs(enemy.y - this.player.y);
      if (dx < COMBAT.meleeHitRange + enemy.width && dy < COMBAT.meleeHitDepthRange + 20) {
        enemy.stunFor(HEATHER_PARRY.counterStunDuration);
        this.hitFeel.impactFlash(enemy.x, enemy.y - enemy.height / 3);
      }
    }
  }

  private checkTotemDamage(): void {
    for (const enemy of this.enemies) {
      if (!enemy.isAlive) continue;
      const hit = enemy.getAttackHit();
      if (!hit) continue;
      for (const totem of this.totems) {
        if (!totem.isAlive) continue;
        const dx = Math.abs(enemy.x - totem.x);
        const dy = Math.abs(enemy.y - totem.y);
        if (dx < hit.range + TOTEM_CONFIG.width && dy < hit.depthRange) {
          totem.takeHit(hit.damage);
        }
      }
    }
  }

  private pruneDeadTotems(): void {
    for (let i = this.totems.length - 1; i >= 0; i--) {
      if (!this.totems[i].isAlive) this.totems.splice(i, 1);
    }
  }

  private updateResonanceField(dt: number): void {
    if (!(this.player instanceof HeatherPlayer)) return;
    const heather = this.player as HeatherPlayer;

    if (heather.pendingUltBlast) {
      heather.pendingUltBlast = false;
      this.resonanceField = { timer: 0, tickTimer: 0 };

      this.vfx.flashBurst(this.player.x, this.player.y, HEATHER_COLORS.auraColor, 10);
    }

    if (!this.resonanceField) return;

    this.resonanceField.timer += dt;
    this.resonanceField.tickTimer += dt;

    if (this.resonanceField.timer >= HEATHER_ULTIMATE.fieldDuration) {
      this.resonanceField = null;
      return;
    }

    if (Math.random() < 0.1) {
      const angle = Math.random() * Math.PI * 2;
      const dist = Math.random() * HEATHER_ULTIMATE.fieldRadius;
      this.vfx.magicSparkle(
        this.player.x + Math.cos(angle) * dist,
        this.player.y + Math.sin(angle) * dist * 0.3,
        HEATHER_COLORS.catalystPulse, 1,
      );
    }

    // Tick effects
    if (this.resonanceField.tickTimer >= HEATHER_ULTIMATE.tickInterval) {
      this.resonanceField.tickTimer -= HEATHER_ULTIMATE.tickInterval;

      // Heal player
      const baseMaxHp = HEATHER.maxHp;
      const maxHp = this.runState.boons.getStat("maxHp", baseMaxHp);
      if (this.player.hp < maxHp) {
        const heal = HEATHER_ULTIMATE.healPerTick;
        this.player.hp = Math.min(maxHp, this.player.hp + heal);
        this.spawnDamageNumber(this.player.x, this.player.y - 45, heal, 0x44cc44);
      }

      // Damage nearby enemies
      for (const enemy of this.enemies) {
        if (!enemy.isAlive) continue;
        const dx = Math.abs(enemy.x - this.player.x);
        const dy = Math.abs(enemy.y - this.player.y);
        if (dx < HEATHER_ULTIMATE.fieldRadius && dy < HEATHER_ULTIMATE.fieldRadius * 0.3) {
          const wasAlive = enemy.isAlive;
          enemy.takeHit(HEATHER_ULTIMATE.tickDamage, enemy.x > this.player.x ? 0.5 : -0.5, 0);
          this.spawnDamageNumber(enemy.x, enemy.y - enemy.height / 2, HEATHER_ULTIMATE.tickDamage, 0xcc88ff);
          if (wasAlive && !enemy.isAlive) {
            const ctx = { x: this.player.x, y: this.player.y, targetX: enemy.x, targetY: enemy.y };
            this.fireBoonEvent("onKill", ctx);
          }
        }
      }
    }
  }
}
