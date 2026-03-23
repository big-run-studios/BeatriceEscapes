import Phaser from "phaser";
import { CombatStateMachine } from "../systems/CombatState";
import { BoonState } from "../systems/BoonState";
import { ProjectileSpawnRequest, MeleeHitBox, AoeHit } from "./Player";
import { TrainingDummy } from "./TrainingDummy";

export interface PlayerEntity {
  readonly container: Phaser.GameObjects.Container;
  readonly combat: CombatStateMachine;
  facingRight: boolean;
  hp: number;
  mp: number;
  isDead: boolean;
  pendingUltBlast: boolean;
  pendingDirectionalUltBlast: number;
  boundsMinX: number;
  boundsMaxX: number;
  activeStatuses: string[];

  get x(): number;
  get y(): number;
  get currentComboId(): string | null;
  get currentSpecialName(): string | null;

  update(dt: number): void;
  getHitBox(): MeleeHitBox | null;
  getDashAttackHitBox(): MeleeHitBox | null;
  drainProjectileRequests(): ProjectileSpawnRequest[];
  drainAoeHit(): AoeHit | null;
  takeHit(damage: number, knockbackX: number, knockbackY: number): void;
  markHitConnected(): void;
  enterMeleeHitstop(ms: number): void;
  setBoonState(bs: BoonState): void;
  setDummyProvider(fn: () => TrainingDummy[]): void;
}
