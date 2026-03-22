import Phaser from "phaser";
import { TitleScene } from "./scenes/TitleScene";
import { HubScene } from "./scenes/HubScene";
import { ArenaScene } from "./scenes/ArenaScene";
import { RoomMapScene } from "./scenes/RoomMapScene";
import { NarrativeScene } from "./scenes/NarrativeScene";
import { GAME_WIDTH, GAME_HEIGHT, COLORS } from "./config/game";

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  parent: "game-container",
  backgroundColor: COLORS.background,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  input: {
    gamepad: true,
  },
  scene: [TitleScene, HubScene, ArenaScene, RoomMapScene, NarrativeScene],
};

new Phaser.Game(config);
