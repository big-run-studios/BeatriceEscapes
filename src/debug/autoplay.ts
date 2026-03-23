import Phaser from "phaser";

export interface QALogEntry {
  time: number;
  type: "info" | "action" | "observe" | "assert" | "pass" | "fail" | "summary";
  message: string;
}

declare global {
  interface Window {
    __phaserGame: Phaser.Game | null;
    __pressKey: (keyName: string, holdMs?: number) => void;
    __holdKey: (keyName: string) => void;
    __releaseKey: (keyName: string) => void;
    __releaseAll: () => void;
    __heldKeys: Set<string>;
    __gameState: () => { scene: string; width: number; height: number };
    __qaLog: QALogEntry[];
    __qaStatus: "running" | "passed" | "failed" | "idle";
  }
}

const KEY_CODE_MAP: Record<string, number> = {
  Enter: 13, Escape: 27, Space: 32, Tab: 9, Backspace: 8,
  ArrowUp: 38, ArrowDown: 40, ArrowLeft: 37, ArrowRight: 39,
  a: 65, b: 66, c: 67, d: 68, e: 69, f: 70, g: 71, h: 72,
  i: 73, j: 74, k: 75, l: 76, m: 77, n: 78, o: 79, p: 80,
  q: 81, r: 82, s: 83, t: 84, u: 85, v: 86, w: 87, x: 88,
  y: 89, z: 90,
  "0": 48, "1": 49, "2": 50, "3": 51, "4": 52,
  "5": 53, "6": 54, "7": 55, "8": 56, "9": 57,
  F1: 112, F2: 113, F3: 114, F4: 115, F5: 116, F6: 117,
  F7: 118, F8: 119, F9: 120, F10: 121, F11: 122, F12: 123,
  Shift: 16, Control: 17, Alt: 18,
};

function makeEvent(type: string, keyName: string, repeat = false): KeyboardEvent {
  const keyCode = KEY_CODE_MAP[keyName] ?? keyName.charCodeAt(0);
  return new KeyboardEvent(type, {
    key: keyName, code: keyName, keyCode, which: keyCode,
    bubbles: true, cancelable: true, repeat,
  } as KeyboardEventInit);
}

export function setupAutoplay(game: Phaser.Game): void {
  window.__phaserGame = game;
  window.__heldKeys = new Set();

  game.canvas.setAttribute("tabindex", "0");
  game.canvas.focus();

  document.addEventListener("click", () => game.canvas.focus());

  window.__pressKey = (keyName: string, holdMs = 80) => {
    window.dispatchEvent(makeEvent("keydown", keyName));
    setTimeout(() => {
      window.dispatchEvent(makeEvent("keyup", keyName));
    }, holdMs);
  };

  window.__holdKey = (keyName: string) => {
    if (window.__heldKeys.has(keyName)) return;
    window.__heldKeys.add(keyName);
    window.dispatchEvent(makeEvent("keydown", keyName));
  };

  window.__releaseKey = (keyName: string) => {
    window.__heldKeys.delete(keyName);
    window.dispatchEvent(makeEvent("keyup", keyName));
  };

  window.__releaseAll = () => {
    for (const key of window.__heldKeys) {
      window.dispatchEvent(makeEvent("keyup", key));
    }
    window.__heldKeys.clear();
  };

  window.__gameState = () => {
    const activeScene = game.scene.getScenes(true)[0];
    return {
      scene: activeScene?.scene.key ?? "unknown",
      width: game.canvas.width,
      height: game.canvas.height,
    };
  };

  // eslint-disable-next-line no-console
  console.log("[autoplay] Helper ready. Use window.__pressKey('Enter') etc.");
}
