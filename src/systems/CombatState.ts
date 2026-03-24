import { ComboNode, ComboInput, COMBO_TREE } from "../config/game";

export type AttackPhase = "anticipation" | "contact" | "recovery";

export type PlayerState =
  | "idle" | "walk" | "attacking" | "jump" | "airAttack"
  | "throwing" | "ultimate" | "blocking" | "dashing" | "dashAttack"
  | "hitstun" | "knockdown" | "recovering" | "dead"
  | "hitstop" | "parrying" | "parryRecovery" | "guarding";

export class CombatStateMachine {
  state: PlayerState = "idle";
  stateTimer = 0;
  hasHitThisSwing = false;
  currentNode: ComboNode | null = null;
  private bufferedInput: ComboInput | null = null;
  private hitstopRemaining = 0;
  private preHitstopState: PlayerState = "idle";
  private preHitstopNode: ComboNode | null = null;

  /** Current attack phase within the combo node (anticipation/contact/recovery pattern). */
  attackPhase: AttackPhase = "anticipation";

  get isAttacking(): boolean { return this.state === "attacking"; }
  get inHitstop(): boolean { return this.state === "hitstop"; }
  get isJumping(): boolean { return this.state === "jump"; }
  get isAirAttacking(): boolean { return this.state === "airAttack"; }
  get isThrowing(): boolean { return this.state === "throwing"; }
  get isUltimate(): boolean { return this.state === "ultimate"; }
  get isBlocking(): boolean { return this.state === "blocking"; }
  get isDashing(): boolean { return this.state === "dashing"; }
  get isDashAttacking(): boolean { return this.state === "dashAttack"; }
  get isHitstun(): boolean { return this.state === "hitstun"; }
  get isKnockdown(): boolean { return this.state === "knockdown"; }
  get isRecovering(): boolean { return this.state === "recovering"; }
  get isDead(): boolean { return this.state === "dead"; }
  get isParrying(): boolean { return this.state === "parrying"; }
  get isParryRecovery(): boolean { return this.state === "parryRecovery"; }
  get isGuarding(): boolean { return this.state === "guarding"; }

  get isInContactPhase(): boolean {
    if (!this.isAttacking || !this.currentNode) return false;
    const phases = this.currentNode.phases;
    if (!phases) return this.stateTimer >= this.currentNode.hitFrame;
    return this.attackPhase === "contact";
  }

  get isInRecoveryPhase(): boolean {
    if (!this.isAttacking || !this.currentNode) return false;
    const phases = this.currentNode.phases;
    if (!phases) return this.stateTimer >= this.currentNode.hitFrame + 0.05;
    return this.attackPhase === "recovery";
  }

  get isBusy(): boolean {
    return this.isAttacking || this.inHitstop || this.isJumping
      || this.isAirAttacking || this.isThrowing || this.isUltimate
      || this.isBlocking || this.isDashing || this.isDashAttacking
      || this.isHitstun || this.isKnockdown || this.isRecovering || this.isDead
      || this.isParrying || this.isParryRecovery || this.isGuarding;
  }

  get isVulnerable(): boolean {
    return !this.isDashing && !this.isDashAttacking && !this.isUltimate
      && !this.isHitstun && !this.isKnockdown && !this.isRecovering && !this.isDead;
  }

  update(dt: number): void {
    if (this.state === "hitstop") {
      this.hitstopRemaining -= dt * 1000;
      if (this.hitstopRemaining <= 0) {
        this.state = this.preHitstopState;
        this.currentNode = this.preHitstopNode;
      }
      return;
    }
    this.stateTimer += dt;

    if (this.isAttacking && this.currentNode?.phases) {
      const p = this.currentNode.phases;
      if (this.stateTimer < p.anticipation) {
        this.attackPhase = "anticipation";
      } else if (this.stateTimer < p.anticipation + p.contact) {
        this.attackPhase = "contact";
      } else {
        this.attackPhase = "recovery";
      }
    }
  }

  bufferInput(input: ComboInput): void {
    if (this.state === "attacking" || this.state === "hitstop") {
      this.bufferedInput = input;
    }
  }

  startCombo(input: ComboInput): ComboNode | null {
    const root = COMBO_TREE.find((n) => n.input === input);
    if (!root) return null;
    this.enterNode(root);
    return root;
  }

  advanceCombo(): ComboNode | null {
    if (!this.bufferedInput || !this.currentNode) return null;
    const next = this.currentNode.children.find((c) => c.input === this.bufferedInput);
    this.bufferedInput = null;
    if (next) {
      this.enterNode(next);
      return next;
    }
    return null;
  }

  enterHitstop(durationMs: number): void {
    this.preHitstopState = this.state;
    this.preHitstopNode = this.currentNode;
    this.state = "hitstop";
    this.hitstopRemaining = durationMs;
  }

  enterJump(): void { this.state = "jump"; this.stateTimer = 0; this.currentNode = null; }
  enterAirAttack(): void { this.state = "airAttack"; this.stateTimer = 0; this.hasHitThisSwing = false; }
  enterThrowing(): void { this.state = "throwing"; this.stateTimer = 0; }
  enterUltimate(): void { this.state = "ultimate"; this.stateTimer = 0; }
  enterBlocking(): void { this.state = "blocking"; this.stateTimer = 0; }
  enterDashing(): void { this.state = "dashing"; this.stateTimer = 0; }
  enterDashAttack(): void { this.state = "dashAttack"; this.stateTimer = 0; this.hasHitThisSwing = false; }
  enterHitstun(): void { this.state = "hitstun"; this.stateTimer = 0; this.currentNode = null; this.bufferedInput = null; }
  enterKnockdown(): void { this.state = "knockdown"; this.stateTimer = 0; }
  enterRecovering(): void { this.state = "recovering"; this.stateTimer = 0; }
  enterDead(): void { this.state = "dead"; this.stateTimer = 0; }
  enterParrying(): void { this.state = "parrying"; this.stateTimer = 0; }
  enterParryRecovery(): void { this.state = "parryRecovery"; this.stateTimer = 0; }
  enterGuarding(): void { this.state = "guarding"; this.stateTimer = 0; }

  toIdle(): void {
    this.state = "idle";
    this.stateTimer = 0;
    this.currentNode = null;
    this.bufferedInput = null;
  }

  toWalk(): void {
    if (!this.isBusy) {
      this.state = "walk";
      this.stateTimer = 0;
    }
  }

  private enterNode(node: ComboNode): void {
    this.state = "attacking";
    this.stateTimer = 0;
    this.hasHitThisSwing = false;
    this.currentNode = node;
    this.bufferedInput = null;
    this.attackPhase = "anticipation";
  }
}
