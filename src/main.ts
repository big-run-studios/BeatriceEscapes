import Phaser from "phaser";
import { TitleScene } from "./scenes/TitleScene";
import { ArenaScene } from "./scenes/ArenaScene";
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
  scene: [TitleScene, ArenaScene],
};

new Phaser.Game(config);
