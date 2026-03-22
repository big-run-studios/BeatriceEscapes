import { ComboNode, ComboInput, COMBO_TREE } from "../config/game";

export type PlayerState =
  | "idle" | "walk" | "attacking" | "jump" | "airAttack"
  | "throwing" | "ultimate" | "blocking" | "dashing"
  | "hitstun" | "knockdown" | "recovering" | "dead"
  | "hitstop";

export class CombatStateMachine {
  state: PlayerState = "idle";
  stateTimer = 0;
  hasHitThisSwing = false;
  currentNode: ComboNode | null = null;
  private bufferedInput: ComboInput | null = null;
  private hitstopRemaining = 0;
  private preHitstopState: PlayerState = "idle";
  private preHitstopNode: ComboNode | null = null;

  get isAttacking(): boolean { return this.state === "attacking"; }
  get inHitstop(): boolean { return this.state === "hitstop"; }
  get isJumping(): boolean { return this.state === "jump"; }
  get isAirAttacking(): boolean { return this.state === "airAttack"; }
  get isThrowing(): boolean { return this.state === "throwing"; }
  get isUltimate(): boolean { return this.state === "ultimate"; }
  get isBlocking(): boolean { return this.state === "blocking"; }
  get isDashing(): boolean { return this.state === "dashing"; }
  get isHitstun(): boolean { return this.state === "hitstun"; }
  get isKnockdown(): boolean { return this.state === "knockdown"; }
  get isRecovering(): boolean { return this.state === "recovering"; }
  get isDead(): boolean { return this.state === "dead"; }

  get isBusy(): boolean {
    return this.isAttacking || this.inHitstop || this.isJumping
      || this.isAirAttacking || this.isThrowing || this.isUltimate
      || this.isBlocking || this.isDashing
      || this.isHitstun || this.isKnockdown || this.isRecovering || this.isDead;
  }

  get isVulnerable(): boolean {
    return !this.isDashing && !this.isRecovering && !this.isDead;
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
  enterHitstun(): void { this.state = "hitstun"; this.stateTimer = 0; this.currentNode = null; this.bufferedInput = null; }
  enterKnockdown(): void { this.state = "knockdown"; this.stateTimer = 0; }
  enterRecovering(): void { this.state = "recovering"; this.stateTimer = 0; }
  enterDead(): void { this.state = "dead"; this.stateTimer = 0; }

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
  }
}
