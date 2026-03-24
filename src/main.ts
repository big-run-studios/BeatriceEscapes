import Phaser from "phaser";
import { TitleScene } from "./scenes/TitleScene";
import { HubScene } from "./scenes/HubScene";
import { ArenaScene } from "./scenes/ArenaScene";
import { RoomMapScene } from "./scenes/RoomMapScene";
import { NarrativeScene } from "./scenes/NarrativeScene";
import { CombatHUDScene } from "./scenes/CombatHUDScene";
import { SettingsScene } from "./scenes/SettingsScene";
import { GAME_WIDTH, GAME_HEIGHT, COLORS } from "./config/game";
import { setupAutoplay } from "./debug/autoplay";
import { AudioManager } from "./systems/AudioManager";
import { registerAllProceduralSFX } from "./systems/ProceduralSFX";
import { STINGS } from "./config/audio";
import { initDiagnostics } from "./debug/DiagnosticsOverlay";

AudioManager.instance.init();
registerAllProceduralSFX();

for (const [key, def] of Object.entries(STINGS)) {
  AudioManager.instance.loadAudio(key, def.url);
}

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
    keyboard: true,
    gamepad: true,
  },
  audio: {
    noAudio: true,
  },
  scene: [TitleScene, HubScene, ArenaScene, RoomMapScene, NarrativeScene, CombatHUDScene, SettingsScene],
};

const game = new Phaser.Game(config);
setupAutoplay(game);

const debugEnabled = new URLSearchParams(window.location.search).get("debug") === "true";
if (debugEnabled) {
  initDiagnostics(game);
  AudioManager.instance.debug = true;
}

window.addEventListener("beforeunload", () => AudioManager.instance.dispose());

const onInteraction = () => {
  AudioManager.instance.noteInteraction();
  const ctx = AudioManager.instance.context;
  if (ctx.state !== "running") {
    try { ctx.resume(); } catch { /* */ }
  }
};
document.addEventListener("pointerdown", onInteraction);
document.addEventListener("keydown", onInteraction);
document.addEventListener("touchend", onInteraction);
document.addEventListener("click", onInteraction);

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    AudioManager.instance.dispose();
    game.destroy(true);
  });
}
