import Phaser from "phaser";
import { AudioManager } from "./AudioManager";

export enum Action {
  UP,
  DOWN,
  LEFT,
  RIGHT,
  ATTACK,
  HEAVY,
  SPECIAL,
  UTILITY,
  JUMP,
  THROW,
  DODGE,
  BLOCK,
  CONFIRM,
  BACK,
  PAUSE,
  DEBUG,
}

interface ButtonMapping {
  action: Action;
  button: number;
}

interface KeyMapping {
  action: Action;
  key: string;
}

export type InputDevice = "keyboard" | "gamepad";

const STICK_DEADZONE = 0.3;

const GAMEPAD_BUTTON_LABELS: Record<number, string> = {
  0: "X",          // Cross
  1: "Circle",
  2: "Square",
  3: "Triangle",
  4: "L1",
  5: "R1",
  6: "L2",
  7: "R2",
  8: "Share",
  9: "Options",
  10: "L3",
  11: "R3",
  12: "D-Up",
  13: "D-Down",
  14: "D-Left",
  15: "D-Right",
};

const KEY_DISPLAY_LABELS: Record<string, string> = {
  ENTER: "Enter",
  ESC: "Esc",
  SPACE: "Space",
  SHIFT: "Shift",
  UP: "Up",
  DOWN: "Down",
  LEFT: "Left",
  RIGHT: "Right",
  G: "G",
  H: "H",
};

const DEFAULT_GAMEPAD_MAP: ButtonMapping[] = [
  { action: Action.JUMP, button: 0 },      // X (Cross)
  { action: Action.THROW, button: 1 },     // Circle — throw/grab
  { action: Action.ATTACK, button: 2 },    // Square — light attack (Bea)
  { action: Action.HEAVY, button: 3 },     // Triangle — heavy attack (Andrew)
  { action: Action.DODGE, button: 4 },     // L1 (also used for ultimate with R1)
  { action: Action.SPECIAL, button: 5 },   // R1 (also used for ultimate with L1)
  { action: Action.UTILITY, button: 6 },   // L2
  { action: Action.DEBUG, button: 7 },     // R2
  { action: Action.PAUSE, button: 9 },     // Options
  { action: Action.CONFIRM, button: 0 },   // X (Cross) — contextual confirm
  { action: Action.BACK, button: 1 },      // Circle — contextual back
  { action: Action.UP, button: 12 },
  { action: Action.DOWN, button: 13 },
  { action: Action.LEFT, button: 14 },
  { action: Action.RIGHT, button: 15 },
];

const DEFAULT_KEYBOARD_MAP: KeyMapping[] = [
  { action: Action.UP, key: "W" },
  { action: Action.DOWN, key: "S" },
  { action: Action.LEFT, key: "A" },
  { action: Action.RIGHT, key: "D" },
  { action: Action.UP, key: "UP" },
  { action: Action.DOWN, key: "DOWN" },
  { action: Action.LEFT, key: "LEFT" },
  { action: Action.RIGHT, key: "RIGHT" },
  { action: Action.ATTACK, key: "J" },
  { action: Action.HEAVY, key: "K" },
  { action: Action.SPECIAL, key: "L" },
  { action: Action.JUMP, key: "SPACE" },
  { action: Action.CONFIRM, key: "SPACE" },
  { action: Action.THROW, key: "F" },
  { action: Action.DODGE, key: "I" },
  { action: Action.BLOCK, key: "G" },
  { action: Action.UTILITY, key: "H" },
  { action: Action.CONFIRM, key: "ENTER" },
  { action: Action.BACK, key: "ESC" },
  { action: Action.PAUSE, key: "ESC" },
  { action: Action.DEBUG, key: "BACKTICK" },
];

export class InputManager {
  private scene: Phaser.Scene;
  private keys: Map<string, Phaser.Input.Keyboard.Key> = new Map();
  private keyMap: KeyMapping[];
  private padMap: ButtonMapping[];
  private prevPadButtons: Map<number, boolean> = new Map();
  private _gamepadConnected = false;
  private _gamepadId = "";
  private _lastDevice: InputDevice = "keyboard";
  private _hasReceivedInput = false;
  private _pointerJustDown = false;
  private _nativePadIndex = -1;

  private prevStickX = 0;
  private prevStickY = 0;

  private static _buttonsWorking = true;
  private static _axesSeen = false;
  private static _buttonCheckFrames = 0;
  static get buttonsWorking(): boolean { return InputManager._buttonsWorking; }

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.keyMap = DEFAULT_KEYBOARD_MAP;
    this.padMap = DEFAULT_GAMEPAD_MAP;
    this.setupKeyboard();
    this.scene.input.on("pointerdown", () => {
      this._pointerJustDown = true;
      console.log(`[InputManager] pointerdown -> CONFIRM queued (scene=${scene.scene.key})`);
    });
  }

  /** The most recently used input device. Defaults to gamepad if one is connected before any input. */
  get lastDevice(): InputDevice {
    if (!this._hasReceivedInput && this._gamepadConnected) {
      return "gamepad";
    }
    return this._lastDevice;
  }

  private setupKeyboard(): void {
    if (!this.scene.input.keyboard) return;
    const uniqueKeys = new Set(this.keyMap.map((m) => m.key));
    for (const key of uniqueKeys) {
      const keyObj = this.scene.input.keyboard.addKey(
        Phaser.Input.Keyboard.KeyCodes[key as keyof typeof Phaser.Input.Keyboard.KeyCodes]
      );
      this.keys.set(key, keyObj);
    }
  }

  private get pad(): Phaser.Input.Gamepad.Gamepad | null {
    if (!this.scene.input.gamepad) return null;
    const p = this.scene.input.gamepad.getPad(0);
    if (p) {
      if (!this._gamepadConnected) {
        console.log(`[InputManager] Phaser gamepad connected: ${p.id}`);
      }
      this._gamepadConnected = true;
      this._gamepadId = p.id;
      return p;
    }
    const native = this.nativePad;
    if (native) {
      if (!this._gamepadConnected) {
        console.log(`[InputManager] Native gamepad connected: ${native.id}`);
      }
      this._gamepadConnected = true;
      this._gamepadId = native.id;
    } else {
      if (this._gamepadConnected) {
        console.log("[InputManager] Gamepad disconnected");
      }
      this._gamepadConnected = false;
      this._gamepadId = "";
    }
    return null;
  }

  private get nativePad(): Gamepad | null {
    if (typeof navigator.getGamepads !== "function") return null;
    const pads = navigator.getGamepads();
    if (this._nativePadIndex >= 0 && pads[this._nativePadIndex]) {
      return pads[this._nativePadIndex];
    }
    for (let i = 0; i < pads.length; i++) {
      if (pads[i]) {
        this._nativePadIndex = i;
        return pads[i];
      }
    }
    this._nativePadIndex = -1;
    return null;
  }

  get gamepadConnected(): boolean {
    this.pad;
    return this._gamepadConnected;
  }

  get gamepadName(): string {
    return this._gamepadId;
  }

  /** True while the action's button/key is held down. */
  isDown(action: Action): boolean {
    if (this.isPadDown(action)) {
      this.setDevice("gamepad");
      return true;
    }
    if (this.isKeyDown(action)) {
      this.setDevice("keyboard");
      return true;
    }
    return false;
  }

  /** True only on the frame the action's button/key was first pressed. */
  justPressed(action: Action): boolean {
    if (this.isPadJustPressed(action)) {
      this.setDevice("gamepad");
      return true;
    }
    if (this.isKeyJustDown(action)) {
      this.setDevice("keyboard");
      return true;
    }
    if (action === Action.CONFIRM && this._pointerJustDown && !this._gamepadConnected) {
      return true;
    }
    if (action === Action.CONFIRM && !InputManager._buttonsWorking && this.isStickConfirm()) {
      this.setDevice("gamepad");
      return true;
    }
    return false;
  }

  private _stickConfirmCooldown = 0;

  /** Always use native Gamepad API for axes -- Phaser's wrapper can be stale on iOS Safari. */
  private getStickAxes(): { x: number; y: number } {
    const native = this.nativePad;
    if (native) {
      return {
        x: native.axes.length > 0 ? native.axes[0] : 0,
        y: native.axes.length > 1 ? native.axes[1] : 0,
      };
    }
    const phaserPad = this.pad;
    if (phaserPad) {
      return {
        x: phaserPad.axes.length > 0 ? phaserPad.axes[0].getValue() : 0,
        y: phaserPad.axes.length > 1 ? phaserPad.axes[1].getValue() : 0,
      };
    }
    return { x: 0, y: 0 };
  }

  private isStickConfirm(): boolean {
    if (this._stickConfirmCooldown > 0) return false;
    const { x: lx, y: ly } = this.getStickAxes();
    const wasNeutral = Math.abs(this.prevStickX) < 0.3 && Math.abs(this.prevStickY) < 0.3;
    const magnitude = Math.sqrt(lx * lx + ly * ly);
    if (wasNeutral && magnitude > 0.85) {
      this._stickConfirmCooldown = 20;
      console.log(`[InputManager] Stick-confirm triggered (mag=${magnitude.toFixed(2)})`);
      return true;
    }
    return false;
  }

  private setDevice(device: InputDevice): void {
    if (this._hasReceivedInput && this._lastDevice !== device) {
      console.log(`[InputManager] Device switched: ${this._lastDevice} -> ${device}`);
    }
    this._lastDevice = device;
    this._hasReceivedInput = true;
    InputManager._globalDevice = device;
    if (device === "gamepad") {
      try { AudioManager.instance.noteGamepadActivity(); } catch { /* */ }
    }
  }

  private static _globalDevice: InputDevice = "keyboard";
  static get globalDevice(): InputDevice { return InputManager._globalDevice; }

  /** Returns the gamepad button index mapped to an action, or undefined if not found. */
  getButtonIndex(action: Action): number | undefined {
    for (const mapping of this.padMap) {
      if (mapping.action === action) return mapping.button;
    }
    return undefined;
  }

  /** Returns the display label for an action based on the last-used input device. */
  getLabel(action: Action): string {
    if (this.lastDevice === "gamepad") {
      if (!InputManager._buttonsWorking) {
        if (action === Action.CONFIRM) return "Flick\u00A0Stick";
        if (action === Action.BACK) return "Tap\u00A0Screen";
      }
      for (const mapping of this.padMap) {
        if (mapping.action === action) {
          return GAMEPAD_BUTTON_LABELS[mapping.button] ?? `Button ${mapping.button}`;
        }
      }
    }
    for (const mapping of this.keyMap) {
      if (mapping.action === action) {
        return KEY_DISPLAY_LABELS[mapping.key] ?? mapping.key;
      }
    }
    return "?";
  }

  /** True if both actions are currently held down simultaneously. */
  bothDown(a: Action, b: Action): boolean {
    return this.isDown(a) && this.isDown(b);
  }

  /** Returns a normalized {x, y} vector for movement (stick + dpad + keyboard). */
  getMovement(): { x: number; y: number } {
    let x = 0;
    let y = 0;

    if (this.isDown(Action.LEFT)) x -= 1;
    if (this.isDown(Action.RIGHT)) x += 1;
    if (this.isDown(Action.UP)) y -= 1;
    if (this.isDown(Action.DOWN)) y += 1;

    const { x: stickX, y: stickY } = this.getStickAxes();
    if (Math.abs(stickX) > STICK_DEADZONE || Math.abs(stickY) > STICK_DEADZONE) {
      this.setDevice("gamepad");
    }
    if (Math.abs(stickX) > STICK_DEADZONE) x = stickX;
    if (Math.abs(stickY) > STICK_DEADZONE) y = stickY;

    const len = Math.sqrt(x * x + y * y);
    if (len > 1) {
      x /= len;
      y /= len;
    }

    return { x, y };
  }

  /** Call at end of update() to sync previous-frame state for justPressed. */
  postUpdate(): void {
    this._pointerJustDown = false;
    if (this._stickConfirmCooldown > 0) this._stickConfirmCooldown--;

    this.pad;
    const buttons = this.getNativeButtons();
    const { x: sx, y: sy } = this.getStickAxes();

    if (buttons) {
      let anyPressed = false;
      for (const mapping of this.padMap) {
        const btn = buttons[mapping.button];
        const pressed = btn ? btn.pressed : false;
        this.prevPadButtons.set(mapping.button, pressed);
        if (pressed) anyPressed = true;
      }
      this.prevStickX = sx;
      this.prevStickY = sy;
      this.updateButtonDetection(anyPressed, sx, sy);
    } else {
      this.prevStickX = sx;
      this.prevStickY = sy;
    }
  }

  private static _buttonFallbackLogged = false;

  private updateButtonDetection(anyPressed: boolean, stickX: number, stickY: number): void {
    if (Math.abs(stickX) > STICK_DEADZONE || Math.abs(stickY) > STICK_DEADZONE) {
      InputManager._axesSeen = true;
    }
    if (anyPressed) {
      InputManager._buttonsWorking = true;
      InputManager._buttonCheckFrames = 0;
    } else {
      InputManager._buttonCheckFrames++;
    }
    if (InputManager._buttonCheckFrames >= 120 && InputManager._axesSeen) {
      InputManager._buttonsWorking = false;
      if (!InputManager._buttonFallbackLogged) {
        InputManager._buttonFallbackLogged = true;
        console.log("[InputManager] Buttons non-functional — stick-flick and tap-to-confirm enabled");
      }
    }
  }

  /** True if any action key/button was just pressed (useful for "press anything"). */
  anyJustPressed(): boolean {
    if (this._pointerJustDown && !this._gamepadConnected) return true;

    const buttons = this.getNativeButtons();
    if (buttons) {
      for (const mapping of this.padMap) {
        const btn = buttons[mapping.button];
        const wasDown = this.prevPadButtons.get(mapping.button) ?? false;
        if (btn && btn.pressed && !wasDown) {
          this.setDevice("gamepad");
          return true;
        }
      }
    }

    if (!InputManager._buttonsWorking && this.isStickConfirm()) {
      this.setDevice("gamepad");
      return true;
    }

    if (this.scene.input.keyboard) {
      for (const [, key] of this.keys) {
        if (Phaser.Input.Keyboard.JustDown(key)) {
          this.setDevice("keyboard");
          return true;
        }
      }
    }

    return false;
  }

  private isKeyDown(action: Action): boolean {
    for (const mapping of this.keyMap) {
      if (mapping.action === action) {
        const key = this.keys.get(mapping.key);
        if (key?.isDown) return true;
      }
    }
    return false;
  }

  private isKeyJustDown(action: Action): boolean {
    for (const mapping of this.keyMap) {
      if (mapping.action === action) {
        const key = this.keys.get(mapping.key);
        if (key && Phaser.Input.Keyboard.JustDown(key)) return true;
      }
    }
    return false;
  }

  /** Always prefer native Gamepad API for button reads -- Phaser's wrapper is unreliable on iOS. */
  private getNativeButtons(): GamepadButton[] | null {
    const native = this.nativePad;
    return native ? Array.from(native.buttons) : null;
  }

  private isPadDown(action: Action): boolean {
    this.pad;
    const buttons = this.getNativeButtons();
    if (!buttons) return false;
    for (const mapping of this.padMap) {
      if (mapping.action === action) {
        const btn = buttons[mapping.button];
        if (btn?.pressed) return true;
      }
    }
    return false;
  }

  private isPadJustPressed(action: Action): boolean {
    this.pad;
    const buttons = this.getNativeButtons();
    const { x: lx, y: ly } = this.getStickAxes();
    if (!buttons && lx === 0 && ly === 0) return false;

    if (buttons) {
      for (const mapping of this.padMap) {
        if (mapping.action === action) {
          const btn = buttons[mapping.button];
          const wasDown = this.prevPadButtons.get(mapping.button) ?? false;
          if (btn && btn.pressed && !wasDown) return true;
        }
      }
    }

    const thresh = STICK_DEADZONE + 0.15;
    if (action === Action.LEFT && lx < -thresh && this.prevStickX >= -thresh) return true;
    if (action === Action.RIGHT && lx > thresh && this.prevStickX <= thresh) return true;
    if (action === Action.UP && ly < -thresh && this.prevStickY >= -thresh) return true;
    if (action === Action.DOWN && ly > thresh && this.prevStickY <= thresh) return true;

    return false;
  }
}
