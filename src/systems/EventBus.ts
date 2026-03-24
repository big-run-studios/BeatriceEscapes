/**
 * Shared event bus for decoupled scene communication.
 * Pattern from phaser3-dungeon-crawler-starter EventsCenter.
 * Used to bridge ArenaScene (gameplay) <-> CombatHUDScene (UI).
 */

import Phaser from "phaser";

const eventBus = new Phaser.Events.EventEmitter();
export default eventBus;

export const HUD_EVENTS = {
  PLAYER_HP_CHANGED: "player-hp-changed",
  PLAYER_MP_CHANGED: "player-mp-changed",
  WAVE_STARTED: "wave-started",
  WAVE_CLEARED: "wave-cleared",
  COMBO_HIT: "combo-hit",
  COMBO_RESET: "combo-reset",
  BOSS_HP_CHANGED: "boss-hp-changed",
  BOSS_SPAWNED: "boss-spawned",
  BOSS_DEFEATED: "boss-defeated",
  MONEY_CHANGED: "money-changed",
  ANNOUNCEMENT: "announcement",
  SCENE_READY: "arena-scene-ready",
  SCENE_ENDING: "arena-scene-ending",
} as const;
