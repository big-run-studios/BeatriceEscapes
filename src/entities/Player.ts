import Phaser from "phaser";
import { PLAYER, COLORS, ARENA, COMBAT } from "../config/game";
import { InputManager, Action } from "../systems/InputManager";
import { CombatStateMachine, AttackData } from "../systems/CombatState";
import { HitFeel } from "../systems/HitFeel";

export class Player {
  readonly container: Phaser.GameObjects.Container;
  private body: Phaser.GameObjects.Rectangle;
  private head: Phaser.GameObjects.Rectangle;
  private shadow: Phaser.GameObjects.Ellipse;
  private nameTag: Phaser.GameObjects.Text;
  private inputMgr: InputManager;
  private combat: CombatStateMachine;
  private hitFeel: HitFeel;
  facingRight = true;

  private bodyBaseY = 0;
  private headBaseY: number;

  constructor(scene: Phaser.Scene, x: number, y: number, inputMgr: InputManager, hitFeel: HitFeel) {
    this.inputMgr = inputMgr;
    this.hitFeel = hitFeel;
    this.combat = new CombatStateMachine();

    this.shadow = scene.add.ellipse(0, PLAYER.height / 2 + 4, PLAYER.width + 16, 14, 0x000000, 0.3);

    this.body = scene.add.rectangle(0, 0, PLAYER.width, PLAYER.height, COLORS.andrewFill);
    this.body.setStrokeStyle(2, COLORS.andrewOutline);

    this.head = scene.add.rectangle(0, -PLAYER.height / 2 - 12, PLAYER.width * 0.7, 24, COLORS.andrewFill);
    this.head.setStrokeStyle(2, COLORS.andrewOutline);

    this.nameTag = scene.add.text(0, -PLAYER.height / 2 - 34, "ANDREW", {
      fontFamily: "monospace",
      fontSize: "11px",
      color: "#5a9bba",
    });
    this.nameTag.setOrigin(0.5);

    this.container = scene.add.container(x, y, [
      this.shadow,
      this.body,
      this.head,
      this.nameTag,
    ]);

    this.bodyBaseY = 0;
    this.headBaseY = -PLAYER.height / 2 - 12;
  }

  get x(): number { return this.container.x; }
  get y(): number { return this.container.y; }
  get isAttacking(): boolean { return this.combat.isAttacking; }

  update(dt: number): void {
    this.combat.update(dt);

    if (this.combat.inHitstop) {
      this.applyHitstopVisual();
      return;
    }

    this.handleInput();
    this.handleAttackProgress(dt);
    this.handleMovement(dt);
    this.applyVisualState();
    this.clampToBounds();
    this.container.setDepth(this.container.y);
  }

  private handleInput(): void {
    if (this.inputMgr.justPressed(Action.ATTACK)) {
      this.onAttackInput();
    } else if (this.inputMgr.justPressed(Action.HEAVY)) {
      this.onHeavyInput();
    }
  }

  private onAttackInput(): void {
    const s = this.combat;

    if (!s.isAttacking) {
      s.enterAttack("light1");
      this.fireSwingVFX(false);
      return;
    }

    if (s.state === "light1" || s.state === "light2") {
      s.comboBuffered = true;
    }
  }

  private onHeavyInput(): void {
    if (!this.combat.isAttacking) {
      this.combat.enterAttack("heavy");
      this.fireSwingVFX(true);
    }
  }

  private handleAttackProgress(_dt: number): void {
    const s = this.combat;
    if (!s.isAttacking) return;

    const data = this.getCurrentAttackData();
    if (!data) return;

    if (s.stateTimer >= data.hitFrame && !s.hasHitThisSwing) {
      s.hasHitThisSwing = true;
      this.onHitFrame(data);
    }

    if (s.stateTimer >= data.duration) {
      this.onAttackEnd();
    }
  }

  private onHitFrame(data: AttackData): void {
    const dir = this.facingRight ? 1 : -1;
    const hitX = this.container.x + dir * COMBAT.hitRange;
    const hitY = this.container.y;

    this.hitFeel.impactFlash(hitX, hitY - 20);

    const isFinisher = this.combat.state === "light3";
    const isHeavy = this.combat.state === "heavy";

    if (isHeavy) {
      this.hitFeel.shake(COMBAT.shakeIntensity.heavy, COMBAT.shakeDuration.heavy);
      this.combat.enterHitstop(data.hitstopMs);
    } else if (isFinisher) {
      this.hitFeel.shake(COMBAT.shakeIntensity.finisher, COMBAT.shakeDuration.finisher);
      this.combat.enterHitstop(data.hitstopMs);
    } else {
      this.hitFeel.shake(COMBAT.shakeIntensity.light, COMBAT.shakeDuration.light);
      this.combat.enterHitstop(data.hitstopMs);
    }
  }

  private onAttackEnd(): void {
    const s = this.combat;

    if (s.comboBuffered) {
      if (s.state === "light1") {
        s.enterAttack("light2");
        this.fireSwingVFX(false);
        return;
      }
      if (s.state === "light2") {
        s.enterAttack("light3");
        this.fireSwingVFX(false);
        return;
      }
    }

    s.toIdle();
  }

  private getCurrentAttackData(): AttackData | null {
    switch (this.combat.state) {
      case "light1": return COMBAT.lightChain[0];
      case "light2": return COMBAT.lightChain[1];
      case "light3": return COMBAT.lightChain[2];
      case "heavy": return COMBAT.heavy;
      default: return null;
    }
  }

  private handleMovement(dt: number): void {
    if (this.combat.isAttacking) return;

    const move = this.inputMgr.getMovement();
    const vx = move.x * PLAYER.speed;
    const vy = move.y * PLAYER.depthSpeed;

    this.container.x += vx * dt;
    this.container.y += vy * dt;

    if (Math.abs(move.x) > 0.1 || Math.abs(move.y) > 0.1) {
      this.combat.toWalk();
    } else {
      if (this.combat.state === "walk") this.combat.toIdle();
    }

    if (move.x > 0.1) this.facingRight = true;
    if (move.x < -0.1) this.facingRight = false;
    this.container.scaleX = this.facingRight ? 1 : -1;
  }

  private fireSwingVFX(heavy: boolean): void {
    this.hitFeel.swingArc(this.container.x, this.container.y, this.facingRight, heavy);
  }

  private applyVisualState(): void {
    const s = this.combat;

    if (s.isAttacking) {
      const data = this.getCurrentAttackData();
      if (data) {
        const progress = s.stateTimer / data.duration;
        this.applyAttackPose(progress, s.state === "heavy");
      }
    } else {
      this.resetPose();
    }
  }

  private applyAttackPose(progress: number, heavy: boolean): void {
    const lunge = heavy
      ? Math.sin(progress * Math.PI) * 12
      : Math.sin(progress * Math.PI) * 6;
    const squash = heavy
      ? 1 - Math.sin(progress * Math.PI) * 0.15
      : 1 - Math.sin(progress * Math.PI) * 0.08;
    const stretch = heavy
      ? 1 + Math.sin(progress * Math.PI) * 0.12
      : 1 + Math.sin(progress * Math.PI) * 0.06;

    this.body.y = this.bodyBaseY;
    this.body.scaleX = stretch;
    this.body.scaleY = squash;

    this.head.y = this.headBaseY - lunge * 0.3;
    this.head.x = lunge * 0.5;
  }

  private applyHitstopVisual(): void {
    const shake = (Math.random() - 0.5) * 3;
    this.body.x = shake;
    this.head.x = shake;
  }

  private resetPose(): void {
    this.body.y = this.bodyBaseY;
    this.body.scaleX = 1;
    this.body.scaleY = 1;
    this.head.y = this.headBaseY;
    this.head.x = 0;
    this.body.x = 0;
  }

  private clampToBounds(): void {
    const pad = ARENA.boundaryPadding;
    const halfW = PLAYER.width / 2;

    this.container.x = Phaser.Math.Clamp(
      this.container.x, pad + halfW, ARENA.width - pad - halfW
    );
    this.container.y = Phaser.Math.Clamp(
      this.container.y, ARENA.groundY, ARENA.groundY + ARENA.groundHeight - pad
    );
  }
}
