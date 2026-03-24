import Phaser from "phaser";
import {
  ENEMY, ENEMY_AI, ARENA, COLORS, aiLerp,
  EnemyTypeDef, EnemyTypeId, ENEMY_TYPES,
} from "../config/game";
import { VFXManager } from "../systems/VFXManager";

export type EnemyRole = "engage" | "flank" | "circle" | "evade" | "retreat";

type EnemyAIState =
  | "idle" | "assess" | "chase" | "flank" | "circle"
  | "evade" | "retreat" | "windup" | "attack" | "recover"
  | "hitstun" | "dead"
  | "charge_windup" | "charging"
  | "ranged_windup" | "ranged_fire"
  | "boss_transition"
  | "megaphone_windup" | "megaphone_blast"
  | "net_windup" | "net_throw";

export interface PlayerIntent {
  x: number;
  y: number;
  attacking: boolean;
  facingRight: boolean;
  projectiles: { x: number; y: number; facingRight: boolean }[];
}

export interface EnemyAttackHit {
  x: number;
  y: number;
  range: number;
  depthRange: number;
  damage: number;
  knockback: number;
}

export interface EnemyAoeHit {
  x: number;
  y: number;
  radius: number;
  depthRange: number;
  damage: number;
  knockback: number;
}

export interface EnemyProjectileRequest {
  x: number;
  y: number;
  facingRight: boolean;
  speed: number;
  damage: number;
  color: number;
  radius: number;
  maxRange: number;
  isNet?: boolean;
}

const HP_BAR_W = 42;
const HP_BAR_H = 5;

export class Enemy {
  readonly container: Phaser.GameObjects.Container;
  readonly typeDef: EnemyTypeDef;
  private body: Phaser.GameObjects.Rectangle;
  private head: Phaser.GameObjects.Ellipse;
  private visor: Phaser.GameObjects.Rectangle;
  private shadow: Phaser.GameObjects.Ellipse;
  private hpBarBg: Phaser.GameObjects.Rectangle;
  private hpBarFill: Phaser.GameObjects.Rectangle;
  private hpBarDamage: Phaser.GameObjects.Rectangle;
  private hpBarPoison: Phaser.GameObjects.Rectangle;
  private statusIconText: Phaser.GameObjects.Text;
  private shieldRect?: Phaser.GameObjects.Rectangle;
  private shoulderL?: Phaser.GameObjects.Rectangle;
  private shoulderR?: Phaser.GameObjects.Rectangle;
  private antenna?: Phaser.GameObjects.Rectangle;
  private megaphone?: Phaser.GameObjects.Rectangle;
  private scene: Phaser.Scene;

  private aiState: EnemyAIState = "idle";
  private stateTimer = 0;
  facingRight = false;

  maxHp: number;
  hp: number;
  private damage: number;
  private speed: number;
  readonly level: number;

  private knockbackVx = 0;
  private knockbackVy = 0;
  private damageBarTarget = 1;
  private attackHitFired = false;

  private alive = true;
  droppedLoot = false;
  boundsMinX: number;
  boundsMaxX: number;

  role: EnemyRole = "circle";
  private intent: PlayerIntent = { x: 0, y: 0, attacking: false, facingRight: true, projectiles: [] };

  private aiAssessDur: number;
  private aiWindupDur: number;
  private aiRecoverDur: number;
  private aiEvadeChance: number;
  private aiEvadeSpeed: number;
  private aiEvadeCooldown: number;
  private aiCircleRadius: number;
  private aiCircleSpeed: number;
  private aiFlankAccuracy: number;
  private aiFlankOffset: number;
  private aiRetreatDist: number;
  private aiAllySpacing: number;
  private aiProjDodgeChance: number;
  private aiProjAwareness: number;
  private aiFlankWideArc: number;
  private aiChaseAngle: number;

  private evadeCooldownTimer = 0;
  private evadeDir = 1;
  private circleAngle: number;
  private postEvadeRole: EnemyAIState = "circle";

  private allEnemies: Enemy[] = [];

  // Ranged (sniper + boss)
  private rangedCooldown = 0;
  private projectileRequests: EnemyProjectileRequest[] = [];

  // Charge (brute)
  private chargeDir = 0;
  private chargeDistLeft = 0;

  // Boss state
  private bossPhase = 1;
  private bossAttackCd = 0;
  private bossAttackIdx = 0;
  pendingSummon: EnemyTypeId[] | null = null;
  private pendingAoe: EnemyAoeHit | null = null;
  private bossInvulnerable = false;
  private bossAnnouncement: string | null = null;

  // Root (net hit)
  rootTimer = 0;
  private vfx: VFXManager | null = null;

  // Poison DOT
  private poisonTicks = 0;
  private poisonDmg = 0;
  private poisonInterval = 0;
  private poisonTimer = 0;
  private poisonColor = 0x33cc33;

  constructor(scene: Phaser.Scene, x: number, y: number, level: number, typeDef?: EnemyTypeDef) {
    this.scene = scene;
    this.level = level;
    this.typeDef = typeDef ?? ENEMY_TYPES.agent;

    const td = this.typeDef;
    const lm = 1 + ENEMY.hpPerLevel * (level - 1);
    const dm = 1 + ENEMY.damagePerLevel * (level - 1);
    const sm = 1 + ENEMY.speedPerLevel * (level - 1);
    this.maxHp = Math.floor(ENEMY.baseHp * td.hpMult * lm);
    this.hp = this.maxHp;
    this.damage = Math.floor(ENEMY.baseDamage * td.damageMult * dm);
    this.speed = ENEMY.baseSpeed * td.speedMult * sm;

    this.boundsMinX = ARENA.boundaryPadding + td.width / 2;
    this.boundsMaxX = ARENA.width - ARENA.boundaryPadding - td.width / 2;

    this.aiAssessDur = aiLerp(ENEMY_AI.assessDuration, level);
    this.aiWindupDur = aiLerp(ENEMY_AI.windupDuration, level);
    this.aiRecoverDur = aiLerp(ENEMY_AI.recoverDuration, level);
    this.aiEvadeChance = aiLerp(ENEMY_AI.evadeChance, level);
    this.aiEvadeSpeed = aiLerp(ENEMY_AI.evadeSpeed, level);
    this.aiEvadeCooldown = aiLerp(ENEMY_AI.evadeCooldown, level);
    this.aiCircleRadius = aiLerp(ENEMY_AI.circleRadius, level);
    this.aiCircleSpeed = aiLerp(ENEMY_AI.circleSpeed, level);
    this.aiFlankAccuracy = aiLerp(ENEMY_AI.flankAccuracy, level);
    this.aiFlankOffset = aiLerp(ENEMY_AI.flankOffset, level);
    this.aiRetreatDist = aiLerp(ENEMY_AI.retreatDistance, level);
    this.aiAllySpacing = aiLerp(ENEMY_AI.allySpacing, level);
    this.aiProjDodgeChance = aiLerp(ENEMY_AI.projectileDodgeChance, level);
    this.aiProjAwareness = aiLerp(ENEMY_AI.projectileAwareness, level);
    this.aiFlankWideArc = aiLerp(ENEMY_AI.flankWideArc, level);
    this.aiChaseAngle = aiLerp(ENEMY_AI.chaseAngleOffset, level);

    this.circleAngle = Math.random() * Math.PI * 2;

    const W = td.width;
    const H = td.height;
    const children: Phaser.GameObjects.GameObject[] = [];

    this.shadow = scene.add.ellipse(0, H / 2 + 4, W + 12, 12, 0x000000, 0.25);
    children.push(this.shadow);

    this.body = scene.add.rectangle(0, 0, W, H, td.bodyColor);
    this.body.setStrokeStyle(2, td.outlineColor);
    children.push(this.body);

    // Brute shoulder pads
    if (td.id === "brute") {
      this.shoulderL = scene.add.rectangle(-W / 2 - 5, -H / 4, 12, 20, 0xaa3333);
      this.shoulderR = scene.add.rectangle(W / 2 + 5, -H / 4, 12, 20, 0xaa3333);
      children.push(this.shoulderL, this.shoulderR);
    }

    // Squad Leader shoulder insignia
    if (td.isBoss) {
      this.shoulderL = scene.add.rectangle(-W / 2 - 4, -H / 4, 10, 14, 0xddaa33);
      this.shoulderR = scene.add.rectangle(W / 2 + 4, -H / 4, 10, 14, 0xddaa33);
      this.megaphone = scene.add.rectangle(W / 2 + 12, -H / 4 + 10, 16, 8, 0xcccccc);
      children.push(this.shoulderL, this.shoulderR, this.megaphone);
    }

    // Shield rectangle (shielder)
    if (td.hasShield) {
      this.shieldRect = scene.add.rectangle(W / 2 + 4, 0, 8, H * 0.85, 0xaaaa55);
      this.shieldRect.setStrokeStyle(2, 0xcccc77);
      children.push(this.shieldRect);
    }

    const headW = W * 0.65 * td.headScale;
    const headH = 20 * td.headScale;
    this.head = scene.add.ellipse(0, -H / 2 - 10, headW, headH, td.bodyColor);
    this.head.setStrokeStyle(2, td.outlineColor);
    children.push(this.head);

    // Sniper antenna
    if (td.isRanged && !td.isBoss) {
      this.antenna = scene.add.rectangle(0, -H / 2 - 22, 3, 14, td.visorColor);
      children.push(this.antenna);
    }

    this.visor = scene.add.rectangle(0, -H / 2 - 10, W * 0.45, 6, td.visorColor);
    children.push(this.visor);

    this.hpBarBg = scene.add.rectangle(0, -H / 2 - 26, HP_BAR_W, HP_BAR_H, COLORS.hpBarBg);
    this.hpBarDamage = scene.add.rectangle(0, -H / 2 - 26, HP_BAR_W, HP_BAR_H, COLORS.hpBarDamage);
    this.hpBarPoison = scene.add.rectangle(0, -H / 2 - 26, HP_BAR_W, HP_BAR_H, 0x9933cc);
    this.hpBarPoison.setAlpha(0);
    this.hpBarFill = scene.add.rectangle(0, -H / 2 - 26, HP_BAR_W, HP_BAR_H, COLORS.hpBarFill);
    this.statusIconText = scene.add.text(HP_BAR_W / 2 + 3, -H / 2 - 29, "", {
      fontFamily: "monospace", fontSize: "8px", color: "#cc66ff",
    });
    children.push(this.hpBarBg, this.hpBarDamage, this.hpBarPoison, this.hpBarFill, this.statusIconText);

    this.container = scene.add.container(x, y, children);
    this.stateTimer = Math.random() * 0.5;

    if (td.isBoss) {
      this.bossAnnouncement = "VIOLATION OF ORDINANCE 7B-12!";
    }
  }

  get x(): number { return this.container.x; }
  get y(): number { return this.container.y; }
  get isAlive(): boolean { return this.alive; }
  get width(): number { return this.typeDef.width; }
  get height(): number { return this.typeDef.height; }
  get isDead(): boolean { return this.aiState === "dead"; }
  get typeId(): EnemyTypeId { return this.typeDef.id; }

  setPlayerIntent(intent: PlayerIntent): void { this.intent = intent; }
  setAllEnemies(enemies: Enemy[]): void { this.allEnemies = enemies; }
  setPosition(x: number, y: number): void { this.container.x = x; this.container.y = y; }

  drainProjectileRequests(): EnemyProjectileRequest[] {
    const reqs = [...this.projectileRequests];
    this.projectileRequests = [];
    return reqs;
  }

  drainAoeHit(): EnemyAoeHit | null {
    const aoe = this.pendingAoe;
    this.pendingAoe = null;
    return aoe;
  }

  drainAnnouncement(): string | null {
    const msg = this.bossAnnouncement;
    this.bossAnnouncement = null;
    return msg;
  }

  applyPoison(damagePerTick: number, ticks: number, interval: number, color: number): void {
    if (damagePerTick >= this.poisonDmg || this.poisonTicks <= 0) {
      this.poisonDmg = damagePerTick;
      this.poisonInterval = interval;
      this.poisonColor = color;
    }
    if (this.poisonTicks > 0) {
      this.poisonTicks = Math.min(this.poisonTicks + Math.ceil(ticks / 2), ticks * 2);
    } else {
      this.poisonTicks = ticks;
    }
    this.poisonTimer = Math.min(this.poisonTimer, interval * 0.5);
  }

  setVFX(vfx: VFXManager): void { this.vfx = vfx; }

  // ── Main update ──

  update(dt: number): void {
    if (!this.alive || !this.container?.scene) return;
    this.stateTimer += dt;
    if (this.evadeCooldownTimer > 0) this.evadeCooldownTimer -= dt;
    if (this.rangedCooldown > 0) this.rangedCooldown -= dt;
    if (this.bossAttackCd > 0) this.bossAttackCd -= dt;
    if (this.rootTimer > 0) this.rootTimer -= dt;

    if (this.poisonTicks > 0) {
      this.poisonTimer -= dt;
      if (this.poisonTimer <= 0) {
        this.poisonTimer += this.poisonInterval;
        this.poisonTicks--;
        this.hp -= this.poisonDmg;
        this.damageBarTarget = this.hp / this.maxHp;
        this.scene.events.emit("poison-damage", this.container.x, this.container.y - this.height / 2, this.poisonDmg);
        this.body.setFillStyle(this.poisonColor);
        this.scene.time.delayedCall(100, () => {
          if (this.alive) this.body.setFillStyle(this.typeDef.bodyColor);
        });
        if (this.hp <= 0) {
          this.hp = 0;
          this.die();
          return;
        }
      }
    }

    switch (this.aiState) {
      case "idle":
        if (this.stateTimer >= 0.3) this.enterState("assess");
        break;
      case "assess":
        this.doAssess();
        break;
      case "chase":
        this.doChase(dt);
        break;
      case "flank":
        this.doFlank(dt);
        break;
      case "circle":
        this.doCircle(dt);
        break;
      case "evade":
        this.doEvade(dt);
        break;
      case "retreat":
        this.doRetreat(dt);
        break;
      case "windup":
        this.doWindup();
        break;
      case "attack":
        this.doAttack();
        break;
      case "recover":
        if (this.stateTimer >= this.aiRecoverDur) this.enterState("assess");
        break;
      case "hitstun":
        this.applyKnockback(dt);
        this.applyHitstunVisual();
        if (this.stateTimer >= ENEMY.hitstunDuration) {
          this.enterState("assess");
          this.body.x = 0;
          this.head.x = 0;
        }
        break;
      case "charge_windup":
        this.doChargeWindup();
        break;
      case "charging":
        this.doCharging(dt);
        break;
      case "ranged_windup":
        this.doRangedWindup();
        break;
      case "ranged_fire":
        this.doRangedFire();
        break;
      case "boss_transition":
        this.doBossTransition();
        break;
      case "megaphone_windup":
        this.doMegaphoneWindup();
        break;
      case "megaphone_blast":
        this.doMegaphoneBlast();
        break;
      case "net_windup":
        this.doNetWindup();
        break;
      case "net_throw":
        this.doNetThrow();
        break;
    }

    this.applyAllySpacing();
    this.updateHpBar(dt);
    this.updateVisualCues();
    this.container.setDepth(this.container.y);
  }

  // ── AI Decision ──

  private doAssess(): void {
    if (this.stateTimer < this.aiAssessDur) return;

    if (this.typeDef.isBoss) {
      this.assessBoss();
      return;
    }

    if (this.shouldEvade()) {
      this.enterState("evade");
      return;
    }

    const td = this.typeDef;
    const dx = Math.abs(this.intent.x - this.container.x);
    const dy = Math.abs(this.intent.y - this.container.y);

    // Sniper: prefer ranged attack from distance
    if (td.isRanged && this.rangedCooldown <= 0 && dx > 150) {
      this.enterState("ranged_windup");
      return;
    }

    // Sniper: retreat if too close
    if (td.preferRetreat && dx < 120 && dy < 80) {
      this.enterState("retreat");
      return;
    }

    // Brute: charge from medium range
    if (td.hasCharge && dx > 150 && dx < 500 && dy < 60 && Math.random() < 0.4) {
      this.enterState("charge_windup");
      return;
    }

    switch (this.role) {
      case "engage": this.enterState("chase"); break;
      case "flank": this.enterState("flank"); break;
      case "evade": this.enterState("evade"); break;
      case "retreat": this.enterState("retreat"); break;
      case "circle": default: this.enterState("circle"); break;
    }
  }

  private assessBoss(): void {
    if (this.bossAttackCd > 0) {
      this.enterState("circle");
      return;
    }

    const dx = Math.abs(this.intent.x - this.container.x);
    const attacks = this.getBossAttackPool();
    const pick = attacks[this.bossAttackIdx % attacks.length];
    this.bossAttackIdx++;

    switch (pick) {
      case "melee":
        if (dx < this.typeDef.attackRange * 1.5) {
          this.enterState("windup");
        } else {
          this.enterState("chase");
        }
        break;
      case "net":
        this.enterState("net_windup");
        break;
      case "megaphone":
        this.enterState("megaphone_windup");
        break;
      case "charge":
        this.enterState("charge_windup");
        break;
      default:
        this.enterState("chase");
    }
    this.bossAttackCd = this.typeDef.bossAttackCooldown * (this.bossPhase >= 3 ? 0.5 : 1);
  }

  private getBossAttackPool(): string[] {
    const canCharge = this.typeDef.hasCharge;
    if (this.bossPhase === 1) {
      return canCharge ? ["melee", "melee", "net"] : ["melee", "melee", "net"];
    }
    if (this.bossPhase === 2) {
      return canCharge
        ? ["melee", "charge", "net", "megaphone", "melee"]
        : ["melee", "net", "megaphone", "melee"];
    }
    return canCharge
      ? ["charge", "melee", "net", "megaphone", "charge", "megaphone"]
      : ["melee", "net", "megaphone", "melee", "megaphone"];
  }

  private shouldEvade(): boolean {
    if (this.evadeCooldownTimer > 0) return false;
    if (this.role === "engage") return false;
    if (this.typeDef.hasShield) return false;

    const dx = this.intent.x - this.container.x;
    const dy = Math.abs(this.intent.y - this.container.y);
    const dist = Math.abs(dx);

    if (this.intent.attacking && dy < ENEMY.attackDepthRange + 30) {
      const playerFacingMe = (this.intent.facingRight && dx > 0) || (!this.intent.facingRight && dx < 0);
      if (playerFacingMe && dist < 150) {
        return Math.random() < this.aiEvadeChance;
      }
    }

    for (const proj of this.intent.projectiles) {
      const projDx = this.container.x - proj.x;
      const projDy = Math.abs(this.container.y - proj.y);
      const heading = proj.facingRight ? 1 : -1;
      if (heading * projDx > 0 && Math.abs(projDx) < this.aiProjAwareness && projDy < 50) {
        if (Math.random() < this.aiProjDodgeChance) return true;
      }
    }

    return false;
  }

  // ── Movement behaviors ──

  private doChase(dt: number): void {
    const dx = this.intent.x - this.container.x;
    const dy = this.intent.y - this.container.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    this.facingRight = dx > 0;
    this.container.scaleX = this.facingRight ? 1 : -1;

    const atkRange = this.typeDef.attackRange;
    if (Math.abs(dx) < atkRange && Math.abs(dy) < ENEMY.attackDepthRange) {
      this.enterState("windup");
      return;
    }

    // Sniper retreats instead of chasing close
    if (this.typeDef.preferRetreat && Math.abs(dx) < 120) {
      this.enterState("retreat");
      return;
    }

    if (dist > 1) {
      let nx = dx / dist;
      let ny = dy / dist;

      const playerFacingMe = (this.intent.facingRight && dx > 0) || (!this.intent.facingRight && dx < 0);
      if (playerFacingMe && dist > atkRange * 1.5) {
        const lateralDir = this.container.y > this.intent.y ? 1 : -1;
        ny += lateralDir * this.aiChaseAngle;
        const len = Math.sqrt(nx * nx + ny * ny);
        nx /= len; ny /= len;
      }

      this.container.x += nx * this.speed * dt;
      this.container.y += ny * this.speed * 0.7 * dt;
    }

    this.clampToBounds();
  }

  private doFlank(dt: number): void {
    const px = this.intent.x;
    const py = this.intent.y;
    const dx = px - this.container.x;
    const dy = this.container.y - py;

    this.facingRight = dx > 0;
    this.container.scaleX = this.facingRight ? 1 : -1;

    const yDir = dy >= 0 ? 1 : -1;
    const flankY = py + yDir * this.aiFlankOffset;
    const yDist = Math.abs(this.container.y - flankY);
    const atFlankDepth = yDist < 15;

    if (!atFlankDepth) {
      this.container.y += (flankY > this.container.y ? 1 : -1) * this.speed * 0.9 * dt;
      const driftAway = dx > 0 ? -1 : 1;
      this.container.x += driftAway * this.speed * this.aiFlankWideArc * 0.5 * dt;
    } else {
      const behindX = px + (this.intent.facingRight ? -1 : 1) * this.typeDef.attackRange * 1.5;
      const toX = behindX - this.container.x;
      const closeDist = Math.abs(toX);

      if (closeDist > this.typeDef.attackRange && Math.abs(dy) < ENEMY.attackDepthRange && this.role === "engage") {
        this.enterState("windup");
        return;
      }

      const spd = this.speed * (0.7 + this.aiFlankAccuracy * 0.4);
      this.container.x += Math.sign(toX) * Math.min(spd * dt, closeDist);
      const jitter = (1 - this.aiFlankAccuracy) * Math.sin(this.stateTimer * 3) * 15;
      this.container.y += jitter * dt;
    }

    if (this.stateTimer > 2.5) this.enterState("assess");
    this.clampToBounds();
  }

  private doCircle(dt: number): void {
    const px = this.intent.x;
    const py = this.intent.y;
    const dx = px - this.container.x;

    this.facingRight = dx > 0;
    this.container.scaleX = this.facingRight ? 1 : -1;
    this.circleAngle += this.aiCircleSpeed * dt;

    const targetX = px + Math.cos(this.circleAngle) * this.aiCircleRadius;
    const targetY = py + Math.sin(this.circleAngle) * this.aiCircleRadius * 0.6;
    const clampedY = Phaser.Math.Clamp(targetY, ARENA.groundY, ARENA.groundY + ARENA.groundHeight - ARENA.boundaryPadding);

    const toX = targetX - this.container.x;
    const toY = clampedY - this.container.y;
    const toDist = Math.sqrt(toX * toX + toY * toY);

    if (toDist > 3) {
      const spd = this.speed * 0.75;
      this.container.x += (toX / toDist) * spd * dt;
      this.container.y += (toY / toDist) * spd * 0.7 * dt;
    }

    if (this.stateTimer > 2.5) this.enterState("assess");
    this.clampToBounds();
  }

  private doEvade(dt: number): void {
    if (this.stateTimer >= ENEMY_AI.evadeDuration) {
      this.evadeCooldownTimer = this.aiEvadeCooldown;
      this.enterState(this.postEvadeRole);
      return;
    }
    if (this.stateTimer < 0.02) {
      const dy = this.intent.y - this.container.y;
      this.evadeDir = dy > 0 ? -1 : 1;
      if (Math.random() < 0.3) this.evadeDir *= -1;
      this.postEvadeRole = Math.random() < 0.6 ? "flank" : "circle";
    }
    this.container.y += this.evadeDir * this.aiEvadeSpeed * dt;
    const dx = this.intent.x - this.container.x;
    const backDir = dx > 0 ? -1 : 1;
    this.container.x += backDir * this.aiEvadeSpeed * 0.5 * dt;
    this.body.x = Math.sin(this.stateTimer * 30) * 3;
    this.clampToBounds();
  }

  private doRetreat(dt: number): void {
    const dx = this.intent.x - this.container.x;
    const dy = this.intent.y - this.container.y;
    const dist = Math.abs(dx);

    this.facingRight = dx > 0;
    this.container.scaleX = this.facingRight ? 1 : -1;

    if (dist >= this.aiRetreatDist) {
      if (this.typeDef.isRanged && this.rangedCooldown <= 0) {
        this.enterState("ranged_windup");
      } else {
        this.enterState("flank");
      }
      return;
    }

    const awayDir = dx > 0 ? -1 : 1;
    this.container.x += awayDir * this.speed * 0.8 * dt;
    const spreadDir = dy >= 0 ? -1 : 1;
    this.container.y += spreadDir * this.speed * 0.6 * dt;

    if (this.stateTimer > 1.5) this.enterState("flank");
    this.clampToBounds();
  }

  // ── Standard melee combat ──

  private doWindup(): void {
    const td = this.typeDef;
    const flash = Math.sin(this.stateTimer * 20) > 0;
    this.body.setFillStyle(flash ? COLORS.enemyWindup : td.bodyColor);
    this.visor.setFillStyle(flash ? 0xffffff : td.visorColor);

    if (this.stateTimer >= this.aiWindupDur) {
      this.body.setFillStyle(td.bodyColor);
      this.visor.setFillStyle(td.visorColor);
      this.enterState("attack");
    }
  }

  private doAttack(): void {
    const dur = this.typeDef.attackDuration;
    const p = this.stateTimer / dur;
    const swing = Math.sin(p * Math.PI);
    const dir = this.facingRight ? 1 : -1;
    this.body.scaleX = 1 + swing * 0.15;
    this.head.x = dir * swing * 8;

    if (p >= 0.4 && !this.attackHitFired) {
      this.attackHitFired = true;
    }

    if (this.stateTimer >= dur) {
      this.body.scaleX = 1;
      this.head.x = 0;
      this.enterState("recover");
    }
  }

  getAttackHit(): EnemyAttackHit | null {
    if (this.aiState !== "attack") return null;
    if (!this.attackHitFired) return null;
    this.attackHitFired = false;

    const dir = this.facingRight ? 1 : -1;
    return {
      x: this.container.x + dir * this.typeDef.attackRange,
      y: this.container.y,
      range: this.typeDef.attackRange,
      depthRange: ENEMY.attackDepthRange,
      damage: this.damage,
      knockback: 150 + this.level * 20,
    };
  }

  // ── Brute charge ──

  private doChargeWindup(): void {
    const td = this.typeDef;
    const flash = Math.sin(this.stateTimer * 25) > 0;
    this.body.setFillStyle(flash ? 0xff4444 : td.bodyColor);
    if (this.shoulderL) this.shoulderL.setFillStyle(flash ? 0xff6666 : 0xaa3333);
    if (this.shoulderR) this.shoulderR.setFillStyle(flash ? 0xff6666 : 0xaa3333);

    if (this.stateTimer >= td.chargeWindup) {
      this.body.setFillStyle(td.bodyColor);
      if (this.shoulderL) this.shoulderL.setFillStyle(0xaa3333);
      if (this.shoulderR) this.shoulderR.setFillStyle(0xaa3333);
      this.chargeDir = this.facingRight ? 1 : -1;
      this.chargeDistLeft = td.chargeSpeed * td.chargeDuration;
      this.attackHitFired = false;
      this.enterState("charging");
    }
  }

  private doCharging(dt: number): void {
    const td = this.typeDef;
    const move = td.chargeSpeed * dt;
    this.container.x += this.chargeDir * move;
    this.chargeDistLeft -= move;

    this.body.x = Math.sin(this.stateTimer * 40) * 2;

    if (!this.attackHitFired) {
      const px = this.intent.x;
      const py = this.intent.y;
      const dx = Math.abs(this.container.x - px);
      const dy = Math.abs(this.container.y - py);
      if (dx < td.width / 2 + 30 && dy < ENEMY.attackDepthRange + 20) {
        this.attackHitFired = true;
        this.pendingAoe = {
          x: this.container.x, y: this.container.y,
          radius: td.width, depthRange: ENEMY.attackDepthRange + 20,
          damage: td.chargeDamage, knockback: 400,
        };
      }
    }

    if (this.chargeDistLeft <= 0 || this.container.x <= this.boundsMinX || this.container.x >= this.boundsMaxX) {
      this.body.x = 0;
      this.aiRecoverDur = 0.6;
      this.enterState("recover");
    }
    this.clampToBounds();
  }

  // ── Sniper ranged attack ──

  private doRangedWindup(): void {
    const flash = Math.sin(this.stateTimer * 15) > 0;
    this.visor.setFillStyle(flash ? 0xffffff : this.typeDef.visorColor);
    if (this.antenna) this.antenna.setFillStyle(flash ? 0xffffff : this.typeDef.visorColor);

    const dx = this.intent.x - this.container.x;
    this.facingRight = dx > 0;
    this.container.scaleX = this.facingRight ? 1 : -1;

    if (this.stateTimer >= 0.4) {
      this.visor.setFillStyle(this.typeDef.visorColor);
      if (this.antenna) this.antenna.setFillStyle(this.typeDef.visorColor);
      this.enterState("ranged_fire");
    }
  }

  private doRangedFire(): void {
    if (!this.attackHitFired) {
      this.attackHitFired = true;
      const td = this.typeDef;
      const dir = this.facingRight ? 1 : -1;
      this.projectileRequests.push({
        x: this.container.x + dir * (td.width / 2 + 10),
        y: this.container.y - td.height / 4,
        facingRight: this.facingRight,
        speed: td.projectileSpeed,
        damage: td.projectileDamage,
        color: td.projectileColor,
        radius: 6,
        maxRange: 600,
      });
      this.rangedCooldown = td.fireInterval;
    }

    if (this.stateTimer >= 0.2) {
      this.enterState("recover");
    }
  }

  // ── Squad Leader boss attacks ──

  private doNetWindup(): void {
    const flash = Math.sin(this.stateTimer * 18) > 0;
    this.body.setFillStyle(flash ? 0x88aa55 : this.typeDef.bodyColor);

    const dx = this.intent.x - this.container.x;
    this.facingRight = dx > 0;
    this.container.scaleX = this.facingRight ? 1 : -1;

    if (this.stateTimer >= 0.5) {
      this.body.setFillStyle(this.typeDef.bodyColor);
      this.enterState("net_throw");
    }
  }

  private doNetThrow(): void {
    if (!this.attackHitFired) {
      this.attackHitFired = true;
      const td = this.typeDef;
      const dir = this.facingRight ? 1 : -1;
      this.projectileRequests.push({
        x: this.container.x + dir * (td.width / 2 + 10),
        y: this.container.y - td.height / 4,
        facingRight: this.facingRight,
        speed: td.projectileSpeed,
        damage: td.projectileDamage,
        color: 0x88aa55,
        radius: 10,
        maxRange: 500,
        isNet: true,
      });
    }
    if (this.stateTimer >= 0.3) {
      this.enterState("recover");
    }
  }

  private doMegaphoneWindup(): void {
    const p = this.stateTimer / 0.6;
    const flash = Math.sin(this.stateTimer * 20) > 0;
    this.visor.setFillStyle(flash ? 0xffffff : this.typeDef.visorColor);
    if (this.megaphone) {
      const scale = 1 + p * 0.5;
      this.megaphone.setScale(scale);
    }

    const dx = this.intent.x - this.container.x;
    this.facingRight = dx > 0;
    this.container.scaleX = this.facingRight ? 1 : -1;

    if (this.stateTimer >= 0.6) {
      this.visor.setFillStyle(this.typeDef.visorColor);
      if (this.megaphone) this.megaphone.setScale(1);
      this.enterState("megaphone_blast");
    }
  }

  private doMegaphoneBlast(): void {
    if (!this.attackHitFired) {
      this.attackHitFired = true;
      const dir = this.facingRight ? 1 : -1;
      this.pendingAoe = {
        x: this.container.x + dir * 100,
        y: this.container.y,
        radius: 200, depthRange: 80,
        damage: Math.floor(this.damage * 1.2),
        knockback: 500,
      };
    }

    if (this.stateTimer >= 0.3) {
      this.enterState("recover");
    }
  }

  private doBossTransition(): void {
    this.bossInvulnerable = true;
    const flash = Math.sin(this.stateTimer * 30) > 0;
    this.body.setFillStyle(flash ? 0xffffff : this.typeDef.bodyColor);

    if (this.stateTimer >= 1.0) {
      this.bossInvulnerable = false;
      this.body.setFillStyle(this.typeDef.bodyColor);

      if (this.bossPhase === 2) {
        this.visor.setFillStyle(0xee8833);
        this.speed *= 1.2;
      } else if (this.bossPhase === 3) {
        this.visor.setFillStyle(0xff3333);
        this.speed *= 1.25;
      } else if (this.bossPhase >= 4) {
        this.visor.setFillStyle(0xff0000);
        this.speed *= 1.3;
      }

      this.enterState("assess");
    }
  }

  private checkBossPhaseTransition(): void {
    if (!this.typeDef.isBoss || !this.alive) return;
    const hpRatio = this.hp / this.maxHp;
    const thresholds = this.typeDef.phaseThresholds;
    const summons = this.typeDef.summonTypes;

    for (let i = 0; i < thresholds.length; i++) {
      if (hpRatio <= thresholds[i] && this.bossPhase <= i + 1) {
        this.bossPhase = i + 2;
        if (i < summons.length) {
          this.pendingSummon = summons[i] as EnemyTypeId[];
        }

        const messages = [
          "THIS IS GOING ON YOUR PERMANENT RECORD!",
          "FORGET THE PAPERWORK!",
          "ALL UNITS — FULL FORCE!",
        ];
        this.bossAnnouncement = messages[i] ?? "...!";

        this.enterState("boss_transition");
        break;
      }
    }
  }

  // ── Taking damage ──

  takeHit(damage: number, knockbackX: number, knockbackY: number): void {
    if (!this.alive) return;
    if (this.bossInvulnerable) {
      this.flinch();
      return;
    }

    const td = this.typeDef;

    // Shielder frontal block
    if (td.hasShield && this.aiState !== "attack" && this.aiState !== "windup" && this.aiState !== "hitstun") {
      const hitFromFront = (this.facingRight && knockbackX > 0) || (!this.facingRight && knockbackX < 0);
      if (hitFromFront) {
        damage = Math.floor(damage * (1 - td.shieldReduction));
        knockbackX *= 0.2;
        knockbackY *= 0.2;
        if (this.shieldRect) {
          this.shieldRect.setFillStyle(0xffffff);
          this.scene.time.delayedCall(80, () => {
            if (this.shieldRect) this.shieldRect.setFillStyle(0xaaaa55);
          });
        }
      }
    }

    this.hp -= damage;
    this.flashWhite();

    if (this.hp <= 0) {
      this.hp = 0;
      this.die();
      return;
    }

    if (td.isBoss) {
      this.checkBossPhaseTransition();
      if (this.aiState === "boss_transition") return;
    }

    if (damage >= td.hitstunThreshold) {
      this.knockbackVx = knockbackX;
      this.knockbackVy = knockbackY;
      this.enterState("hitstun");
    } else {
      this.knockbackVx = knockbackX * 0.3;
      this.knockbackVy = knockbackY * 0.3;
      this.flinch();
    }
  }

  private flinch(): void {
    const dir = this.knockbackVx > 0 ? 1 : -1;
    this.body.x = dir * 4;
    this.head.x = dir * 3;
    this.scene.time.delayedCall(ENEMY.flinchDuration * 1000, () => {
      if (!this.alive) return;
      this.body.x = 0;
      this.head.x = 0;
    });
  }

  stunFor(duration: number): void {
    if (!this.alive) return;
    this.enterState("hitstun");
    this.stateTimer = -(duration - ENEMY.hitstunDuration);
  }

  // ── Anti-stacking ──

  private applyAllySpacing(): void {
    if (this.aiAllySpacing <= 0) return;
    for (const other of this.allEnemies) {
      if (other === this || !other.isAlive) continue;
      const dx = this.container.x - other.container.x;
      const dy = this.container.y - other.container.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < this.aiAllySpacing && dist > 0.1) {
        const push = (this.aiAllySpacing - dist) * 0.1;
        this.container.x += (dx / dist) * push;
        this.container.y += (dy / dist) * push;
      }
    }
    this.clampToBounds();
  }

  // ── Visual cues ──

  private updateVisualCues(): void {
    if (this.aiState === "dead" || this.aiState === "hitstun") return;

    if (this.aiState === "circle" || this.aiState === "retreat") {
      this.visor.setAlpha(0.5);
    } else if (this.aiState === "chase" || this.aiState === "windup" || this.aiState === "charge_windup") {
      this.visor.setAlpha(1);
    } else {
      this.visor.setAlpha(0.75);
    }

    if (this.typeDef.isBoss && this.bossPhase >= 3) {
      const pulse = 0.8 + Math.sin(this.scene.time.now / 150) * 0.2;
      this.body.setAlpha(pulse);
    }

    // Shield visual: flip with facing direction
    if (this.shieldRect) {
      const dir = this.facingRight ? 1 : -1;
      this.shieldRect.x = dir * (this.typeDef.width / 2 + 4);
    }

    if (this.poisonTicks > 0) {
      const pulse = 0.5 + Math.sin(this.scene.time.now / 150) * 0.5;
      this.body.setStrokeStyle(3, Phaser.Display.Color.GetColor(
        Math.floor(30 * pulse), Math.floor(255 * pulse), Math.floor(30 * pulse),
      ));
    } else {
      this.body.setStrokeStyle(2, this.typeDef.outlineColor);
    }
  }

  // ── Internal ──

  private enterState(state: EnemyAIState): void {
    this.aiState = state;
    this.stateTimer = 0;
    this.attackHitFired = false;
    if (state !== "evade") {
      this.body.x = 0;
    }
  }

  private applyKnockback(dt: number): void {
    this.container.x += this.knockbackVx * dt;
    this.container.y += this.knockbackVy * dt;
    const friction = ENEMY.knockbackFriction * dt;
    if (Math.abs(this.knockbackVx) > friction) this.knockbackVx -= Math.sign(this.knockbackVx) * friction;
    else this.knockbackVx = 0;
    if (Math.abs(this.knockbackVy) > friction) this.knockbackVy -= Math.sign(this.knockbackVy) * friction;
    else this.knockbackVy = 0;
    this.clampToBounds();
  }

  private applyHitstunVisual(): void {
    const shake = (Math.random() - 0.5) * 4;
    this.body.x = shake;
    this.head.x = shake;
  }

  private flashWhite(): void {
    this.body.setFillStyle(0xffffff);
    this.head.setFillStyle(0xffffff);
    const td = this.typeDef;
    this.scene.time.delayedCall(80, () => {
      if (!this.alive) return;
      this.body.setFillStyle(td.bodyColor);
      this.head.setFillStyle(td.bodyColor);
    });
  }

  private die(): void {
    this.alive = false;
    this.aiState = "dead";
    this.scene.tweens.add({
      targets: this.container,
      alpha: 0, scaleY: 0.2, scaleX: 1.4,
      duration: ENEMY.deathDuration * 1000, ease: "Power2",
    });

    this.vfx?.deathBurst(this.container.x, this.container.y, this.typeDef.visorColor);
  }

  destroy(): void {
    if (this.container?.scene) this.container.destroy();
  }

  private updateHpBar(dt: number): void {
    const ratio = this.hp / this.maxHp;
    this.hpBarFill.scaleX = ratio;
    this.hpBarFill.x = -(HP_BAR_W * (1 - ratio)) / 2;
    this.damageBarTarget = Phaser.Math.Linear(this.damageBarTarget, ratio, dt * 4);
    this.hpBarDamage.scaleX = this.damageBarTarget;
    this.hpBarDamage.x = -(HP_BAR_W * (1 - this.damageBarTarget)) / 2;

    if (this.poisonTicks > 0) {
      const poisonRatio = Math.min(ratio, (this.poisonTicks * this.poisonDmg) / this.maxHp);
      this.hpBarPoison.setAlpha(0.85);
      this.hpBarPoison.scaleX = poisonRatio;
      const fillRightEdge = -HP_BAR_W / 2 + HP_BAR_W * ratio;
      this.hpBarPoison.x = fillRightEdge - HP_BAR_W * poisonRatio / 2;
    } else {
      this.hpBarPoison.setAlpha(0);
    }

    const icons: string[] = [];
    if (this.poisonTicks > 0) icons.push("\u2620");
    if (this.rootTimer > 0) icons.push("\u26D3");
    this.statusIconText.setText(icons.join(""));
  }

  private clampToBounds(): void {
    this.container.x = Phaser.Math.Clamp(this.container.x, this.boundsMinX, this.boundsMaxX);
    this.container.y = Phaser.Math.Clamp(this.container.y, ARENA.groundY, ARENA.groundY + ARENA.groundHeight - ARENA.boundaryPadding);
  }
}
