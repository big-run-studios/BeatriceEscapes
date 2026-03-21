export type PlayerState = "idle" | "walk" | "light1" | "light2" | "light3" | "heavy" | "jump" | "hitstop";

export interface AttackData {
  duration: number;
  hitFrame: number;
  damage: number;
  knockback: number;
  hitstopMs: number;
}

export class CombatStateMachine {
  state: PlayerState = "idle";
  stateTimer = 0;
  hasHitThisSwing = false;
  comboBuffered = false;
  private hitstopRemaining = 0;
  private preHitstopState: PlayerState = "idle";

  get isAttacking(): boolean {
    return this.state === "light1" || this.state === "light2" || this.state === "light3" || this.state === "heavy";
  }

  get inHitstop(): boolean {
    return this.state === "hitstop";
  }

  get isJumping(): boolean {
    return this.state === "jump";
  }

  get isBusy(): boolean {
    return this.isAttacking || this.inHitstop || this.isJumping;
  }

  update(dt: number): PlayerState | null {
    if (this.state === "hitstop") {
      this.hitstopRemaining -= dt * 1000;
      if (this.hitstopRemaining <= 0) {
        this.state = this.preHitstopState;
        return null;
      }
      return null;
    }

    this.stateTimer += dt;
    return null;
  }

  enterAttack(state: PlayerState): void {
    this.state = state;
    this.stateTimer = 0;
    this.hasHitThisSwing = false;
    this.comboBuffered = false;
  }

  enterJump(): void {
    this.state = "jump";
    this.stateTimer = 0;
  }

  enterHitstop(durationMs: number): void {
    this.preHitstopState = this.state;
    this.state = "hitstop";
    this.hitstopRemaining = durationMs;
  }

  toIdle(): void {
    this.state = "idle";
    this.stateTimer = 0;
    this.comboBuffered = false;
  }

  toWalk(): void {
    if (!this.isBusy) {
      this.state = "walk";
      this.stateTimer = 0;
    }
  }
}
