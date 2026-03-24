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
import { RemoteLogger } from "./debug/RemoteLogger";

try {
  const nav = navigator as Record<string, unknown>;
  if (nav.audioSession) {
    (nav.audioSession as Record<string, unknown>).type = "playback";
    console.log("[Audio] Set navigator.audioSession.type = playback");
  }
} catch (e) {
  console.warn("[Audio] Failed to set audioSession.type:", e);
}

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
  const isDevServer = !window.location.host.includes("github.io");
  if (isDevServer) {
    new RemoteLogger(window.location.origin);
  }
  initDiagnostics(game);
  AudioManager.instance.debug = true;
}

window.addEventListener("beforeunload", () => AudioManager.instance.dispose());

// ── iOS Audio Unlock ──────────────────────────────────────────
// iOS Safari requires a user gesture (touchend/click) to unlock
// Web Audio. Gamepad input is NOT a DOM gesture, so gamepad-only
// users need a visible "tap to enable" prompt.

let silentAudioEl: HTMLAudioElement | null = null;
let audioUnlocked = false;

function createSilentWavBlob(): Blob {
  const sampleRate = 44100;
  const numSamples = sampleRate; // 1 second of silence
  const bytesPerSample = 2;
  const dataSize = numSamples * bytesPerSample;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  };

  writeString(0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * bytesPerSample, true);
  view.setUint16(32, bytesPerSample, true);
  view.setUint16(34, 16, true);
  writeString(36, "data");
  view.setUint32(40, dataSize, true);
  // samples are already 0 (silence)

  return new Blob([buffer], { type: "audio/wav" });
}

function unlockAudio(): void {
  if (audioUnlocked) return;
  audioUnlocked = true;

  console.log("[Audio] Unlock gesture received, starting unlock sequence");

  if (!silentAudioEl) {
    silentAudioEl = document.createElement("audio");
    silentAudioEl.setAttribute("x-webkit-airplay", "deny");
    silentAudioEl.loop = false;
    silentAudioEl.src = URL.createObjectURL(createSilentWavBlob());
    silentAudioEl.play().then(
      () => console.log("[Audio] Silent HTML5 audio element playing (1s)"),
      () => { console.log("[Audio] Silent HTML5 audio element rejected"); audioUnlocked = false; },
    );
  }

  AudioManager.instance.iOSUnlock();
}

function onGestureEvent(): void {
  unlockAudio();
  AudioManager.instance.noteInteraction();
  if (audioUnlockOverlay && AudioManager.instance.context.state === "running") {
    audioUnlockOverlay.remove();
    audioUnlockOverlay = null;
  }
}

document.addEventListener("touchend", onGestureEvent);
document.addEventListener("click", onGestureEvent);
document.addEventListener("keydown", () => {
  AudioManager.instance.noteInteraction();
  unlockAudio();
});

let audioUnlockOverlay: HTMLDivElement | null = null;

function showAudioUnlockOverlay(): void {
  if (audioUnlockOverlay) return;
  const el = document.createElement("div");
  el.id = "audio-unlock";
  Object.assign(el.style, {
    position: "fixed", bottom: "20px", left: "50%", transform: "translateX(-50%)",
    padding: "14px 28px", background: "rgba(0,0,0,0.85)", color: "#fff",
    fontFamily: "Georgia, serif", fontSize: "18px", borderRadius: "12px",
    zIndex: "9999", cursor: "pointer", textAlign: "center",
    border: "2px solid rgba(255,255,255,0.3)", pointerEvents: "auto",
    animation: "audio-pulse 2s ease-in-out infinite",
  });
  el.textContent = "\uD83D\uDD07  Tap here to enable audio";
  if (!document.getElementById("audio-pulse-style")) {
    const style = document.createElement("style");
    style.id = "audio-pulse-style";
    style.textContent = `@keyframes audio-pulse { 0%,100% { opacity: 0.9; } 50% { opacity: 1; border-color: rgba(255,200,60,0.8); } }`;
    document.head.appendChild(style);
  }
  el.addEventListener("touchend", (e) => { e.preventDefault(); onGestureEvent(); }, { once: true });
  el.addEventListener("click", onGestureEvent, { once: true });
  document.body.appendChild(el);
  audioUnlockOverlay = el;
}

setInterval(() => {
  const ctx = AudioManager.instance.context;
  if (ctx.state !== "running" && !audioUnlockOverlay) {
    showAudioUnlockOverlay();
  }
  if (ctx.state === "running" && audioUnlockOverlay) {
    audioUnlockOverlay.remove();
    audioUnlockOverlay = null;
  }
}, 2000);

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    AudioManager.instance.dispose();
    game.destroy(true);
  });
}
