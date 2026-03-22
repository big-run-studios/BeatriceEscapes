import { RUN } from "../config/game";

export class RunState {
  money = 0;

  get moneyDisplay(): string {
    return `$${this.money.toFixed(2)}`;
  }

  addKillMoney(enemyLevel: number): void {
    this.money += RUN.baseMoneyPerKill + RUN.moneyPerLevel * (enemyLevel - 1);
  }

  reset(): void {
    this.money = 0;
  }
}
