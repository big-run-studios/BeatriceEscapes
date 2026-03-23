import { RUN, EnemyTypeId } from "../config/game";
import { BoonState } from "./BoonState";

export type RoomType = "combat" | "blessing" | "miniboss" | "boss" | "rest" | "shop";

export interface WaveEntry {
  type: EnemyTypeId;
  count: number;
}

export interface WaveDef {
  entries: WaveEntry[];
  level: number;
}

export type NodeReward = "gold" | "boon_gold" | "house_currency";

export interface MapNode {
  id: number;
  layer: number;
  type: RoomType;
  label: string;
  waves: WaveDef[];
  connections: number[];
  reward?: NodeReward;
}

export interface ZoneMap {
  nodes: MapNode[];
  startNodeIds: number[];
  layerCount: number;
}

export interface RoomDef {
  type: RoomType;
  enemyCount: number;
  enemyLevel: number;
  label: string;
}

export class RunState {
  money = 0;
  boons: BoonState;
  character: string;
  isRunMode: boolean;
  wizardPool: string[];
  playerHp = -1;
  playerMp = -1;

  zoneMap: ZoneMap | null = null;
  currentNodeId = -1;
  visitedNodes: Set<number> = new Set();

  // Legacy compat for non-run modes
  currentRoom = 0;
  roomPlan: RoomDef[];

  constructor(opts?: {
    character?: string;
    roomPlan?: RoomDef[];
    wizardPool?: string[];
    zoneMap?: ZoneMap;
  }) {
    this.boons = new BoonState();
    this.character = opts?.character ?? "andrew-bea";
    this.roomPlan = opts?.roomPlan ?? [];
    this.wizardPool = opts?.wizardPool ?? ["Merlin", "Morgan"];
    this.zoneMap = opts?.zoneMap ?? null;
    this.isRunMode = this.zoneMap !== null || this.roomPlan.length > 0;
  }

  get moneyDisplay(): string {
    return `$${this.money.toFixed(2)}`;
  }

  get currentNode(): MapNode | undefined {
    if (!this.zoneMap) return undefined;
    return this.zoneMap.nodes.find(n => n.id === this.currentNodeId);
  }

  get currentRoomDef(): RoomDef | undefined {
    return this.roomPlan[this.currentRoom];
  }

  get isLastRoom(): boolean {
    return this.currentRoom >= this.roomPlan.length - 1;
  }

  get roomLabel(): string {
    const node = this.currentNode;
    if (node) {
      const visited = this.visitedNodes.size;
      const total = this.zoneMap!.layerCount;
      return `Room ${visited}/${total}: ${node.label}`;
    }
    const room = this.currentRoomDef;
    if (!room) return "";
    return `Room ${this.currentRoom + 1}/${this.roomPlan.length}: ${room.label}`;
  }

  getNextChoices(): MapNode[] {
    if (!this.zoneMap) return [];
    if (this.currentNodeId === -1) {
      return this.zoneMap.nodes.filter(n => this.zoneMap!.startNodeIds.includes(n.id));
    }
    const node = this.currentNode;
    if (!node) return [];
    return node.connections
      .map(id => this.zoneMap!.nodes.find(n => n.id === id))
      .filter((n): n is MapNode => n !== undefined);
  }

  selectNode(nodeId: number): void {
    this.currentNodeId = nodeId;
  }

  markNodeVisited(): void {
    this.visitedNodes.add(this.currentNodeId);
  }

  get isZoneComplete(): boolean {
    if (!this.zoneMap) return false;
    const node = this.currentNode;
    if (!node) return false;
    return node.connections.length === 0 && this.visitedNodes.has(node.id);
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
    this.currentNodeId = -1;
    this.visitedNodes.clear();
  }
}

// ── Zone 1 Map Generation ──

function w(entries: WaveEntry[], level: number): WaveDef {
  return { entries, level };
}

export function generateZone1Map(): ZoneMap {
  const nodes: MapNode[] = [];
  let id = 0;

  const add = (layer: number, type: RoomType, label: string, waves: WaveDef[], reward?: NodeReward): number => {
    const nid = id++;
    nodes.push({ id: nid, layer, type, label, waves, connections: [], reward });
    return nid;
  };

  const conn = (from: number, to: number) => {
    nodes.find(n => n.id === from)!.connections.push(to);
  };

  // ── Layers 0-2: LINEAR INTRO — everyone plays these ──
  const intro0 = add(0, "combat", "Street Fight", [
    w([{ type: "cadet", count: 3 }], 1),
    w([{ type: "cadet", count: 2 }, { type: "agent", count: 1 }], 1),
  ], "gold");
  const intro1 = add(1, "combat", "Backyard Brawl", [
    w([{ type: "cadet", count: 2 }, { type: "agent", count: 1 }], 1),
    w([{ type: "agent", count: 2 }, { type: "cadet", count: 1 }], 2),
  ], "boon_gold");
  conn(intro0, intro1);
  const intro2 = add(2, "blessing", "Wizard Blessing", []);
  conn(intro1, intro2);

  // ── Layer 3: FIRST CHOICE — pick path A or B ──
  const pathA0 = add(3, "combat", "Dog Park Ambush", [
    w([{ type: "agent", count: 2 }, { type: "cadet", count: 2 }], 2),
    w([{ type: "agent", count: 2 }, { type: "brute", count: 1 }], 2),
  ], "house_currency");
  const pathB0 = add(3, "combat", "Driveway Dash", [
    w([{ type: "sniper", count: 1 }, { type: "cadet", count: 3 }], 2),
    w([{ type: "agent", count: 2 }, { type: "shielder", count: 1 }], 2),
  ], "gold");
  conn(intro2, pathA0);
  conn(intro2, pathB0);

  // ── Layer 4: LINEAR — each path continues alone ──
  const pathA1 = add(4, "combat", "Sidewalk Scuffle", [
    w([{ type: "agent", count: 2 }, { type: "cadet", count: 2 }], 2),
    w([{ type: "brute", count: 1 }, { type: "agent", count: 1 }], 2),
  ], "boon_gold");
  const pathB1 = add(4, "combat", "Sprinkler Sprint", [
    w([{ type: "sniper", count: 2 }, { type: "cadet", count: 2 }], 2),
    w([{ type: "shielder", count: 1 }, { type: "agent", count: 2 }], 2),
  ], "house_currency");
  conn(pathA0, pathA1);
  conn(pathB0, pathB1);

  // ── Layer 5: MINIBOSS — both paths converge ──
  const miniboss = add(5, "miniboss", "Captain Clipboard", [
    w([{ type: "squad_leader", count: 1 }, { type: "cadet", count: 2 }], 3),
  ], "boon_gold");
  conn(pathA1, miniboss);
  conn(pathB1, miniboss);

  // ── Layer 6: REST — recover after miniboss ──
  const rest = add(6, "rest", "Lemonade Stand", []);
  conn(miniboss, rest);

  // ── Layer 7: SECOND CHOICE — pick path C or D ──
  const pathC0 = add(7, "combat", "Playground Clash", [
    w([{ type: "agent", count: 2 }, { type: "shielder", count: 1 }], 3),
    w([{ type: "brute", count: 1 }, { type: "agent", count: 2 }, { type: "sniper", count: 1 }], 3),
  ], "gold");
  const pathD0 = add(7, "combat", "Parking Lot Rumble", [
    w([{ type: "sniper", count: 2 }, { type: "cadet", count: 3 }], 3),
    w([{ type: "agent", count: 3 }, { type: "brute", count: 1 }], 3),
  ], "house_currency");
  conn(rest, pathC0);
  conn(rest, pathD0);

  // ── Layer 8: LINEAR ──
  const pathC1 = add(8, "blessing", "Wizard Blessing", []);
  const pathD1 = add(8, "combat", "Cul-de-sac Showdown", [
    w([{ type: "agent", count: 2 }, { type: "shielder", count: 1 }, { type: "cadet", count: 2 }], 3),
    w([{ type: "brute", count: 1 }, { type: "sniper", count: 1 }, { type: "agent", count: 2 }], 3),
    w([{ type: "brute", count: 1 }, { type: "shielder", count: 1 }, { type: "agent", count: 1 }], 4),
  ], "boon_gold");
  conn(pathC0, pathC1);
  conn(pathD0, pathD1);

  // ── Layer 9: LINEAR ──
  const pathC2 = add(9, "combat", "Block Party Brawl", [
    w([{ type: "agent", count: 3 }, { type: "brute", count: 1 }], 3),
    w([{ type: "agent", count: 2 }, { type: "sniper", count: 1 }, { type: "brute", count: 1 }], 4),
  ], "house_currency");
  const pathD2 = add(9, "combat", "Mailbox Mayhem", [
    w([{ type: "sniper", count: 2 }, { type: "shielder", count: 1 }, { type: "cadet", count: 2 }], 3),
    w([{ type: "brute", count: 1 }, { type: "shielder", count: 1 }, { type: "agent", count: 2 }], 4),
  ], "gold");
  conn(pathC1, pathC2);
  conn(pathD1, pathD2);

  // ── Layer 10: SHOP — spend coins before boss ──
  const shop = add(10, "shop", "Corner Store", []);
  conn(pathC2, shop);
  conn(pathD2, shop);

  // ── Layer 11: ZONE BOSS — final fight ──
  const boss = add(11, "boss", "MaRC Field Commander", [
    w([{ type: "field_commander", count: 1 }], 5),
  ], "boon_gold");
  conn(shop, boss);

  return {
    nodes,
    startNodeIds: [intro0],
    layerCount: 12,
  };
}

export function generateZone1Rooms(): RoomDef[] {
  return [
    { type: "combat",   enemyCount: 2, enemyLevel: 1, label: "Street Fight" },
    { type: "combat",   enemyCount: 3, enemyLevel: 1, label: "Backyard Brawl" },
    { type: "blessing", enemyCount: 0, enemyLevel: 0, label: "Wizard Blessing" },
    { type: "combat",   enemyCount: 3, enemyLevel: 2, label: "Dog Park Ambush" },
    { type: "combat",   enemyCount: 4, enemyLevel: 2, label: "Playground Clash" },
    { type: "combat",   enemyCount: 4, enemyLevel: 3, label: "Cul-de-sac Showdown" },
    { type: "combat",   enemyCount: 5, enemyLevel: 3, label: "Block Party Brawl" },
    { type: "miniboss", enemyCount: 1, enemyLevel: 4, label: "Neighborhood Watch Captain" },
  ];
}
