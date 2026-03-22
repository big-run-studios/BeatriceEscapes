import { RUN } from "../config/game";
import { BoonState } from "./BoonState";

export type RoomType = "combat" | "blessing" | "miniboss";

export interface RoomDef {
  type: RoomType;
  enemyCount: number;
  enemyLevel: number;
  label: string;
}

export class RunState {
  money = 0;
  boons: BoonState;
  currentRoom = 0;
  roomPlan: RoomDef[];
  character: string;
  isRunMode: boolean;
  wizardPool: string[];

  constructor(opts?: { character?: string; roomPlan?: RoomDef[]; wizardPool?: string[] }) {
    this.boons = new BoonState();
    this.character = opts?.character ?? "andrew-bea";
    this.roomPlan = opts?.roomPlan ?? [];
    this.wizardPool = opts?.wizardPool ?? ["Merlin"];
    this.isRunMode = this.roomPlan.length > 0;
  }

  get moneyDisplay(): string {
    return `$${this.money.toFixed(2)}`;
  }

  get currentRoomDef(): RoomDef | undefined {
    return this.roomPlan[this.currentRoom];
  }

  get isLastRoom(): boolean {
    return this.currentRoom >= this.roomPlan.length - 1;
  }

  get roomLabel(): string {
    const room = this.currentRoomDef;
    if (!room) return "";
    return `Room ${this.currentRoom + 1}/${this.roomPlan.length}: ${room.label}`;
  }

  advanceRoom(): boolean {
    if (this.isLastRoom) return false;
    this.currentRoom++;
    return true;
  }

  addKillMoney(enemyLevel: number): void {
    this.money += RUN.baseMoneyPerKill + RUN.moneyPerLevel * (enemyLevel - 1);
  }

  reset(): void {
    this.money = 0;
    this.boons = new BoonState();
    this.currentRoom = 0;
  }
}

export function generateZone1Rooms(): RoomDef[] {
  return [
    { type: "combat",   enemyCount: 2, enemyLevel: 1, label: "Street Fight" },
    { type: "blessing", enemyCount: 0, enemyLevel: 0, label: "Wizard Blessing" },
    { type: "combat",   enemyCount: 3, enemyLevel: 1, label: "Backyard Brawl" },
    { type: "combat",   enemyCount: 3, enemyLevel: 2, label: "Playground Clash" },
    { type: "miniboss", enemyCount: 1, enemyLevel: 3, label: "Neighborhood Watch" },
  ];
}
