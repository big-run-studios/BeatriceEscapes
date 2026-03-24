import Phaser from "phaser";

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

  private prevStickX = 0;
  private prevStickY = 0;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.keyMap = DEFAULT_KEYBOARD_MAP;
    this.padMap = DEFAULT_GAMEPAD_MAP;
    this.setupKeyboard();
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
      this._gamepadConnected = true;
      this._gamepadId = p.id;
    } else {
      this._gamepadConnected = false;
      this._gamepadId = "";
    }
    return p;
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
    return false;
  }

  private setDevice(device: InputDevice): void {
    this._lastDevice = device;
    this._hasReceivedInput = true;
  }

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

    const gamepad = this.pad;
    if (gamepad) {
      const lx = gamepad.axes.length > 0 ? gamepad.axes[0].getValue() : 0;
      const ly = gamepad.axes.length > 1 ? gamepad.axes[1].getValue() : 0;
      if (Math.abs(lx) > STICK_DEADZONE || Math.abs(ly) > STICK_DEADZONE) {
        this.setDevice("gamepad");
      }
      if (Math.abs(lx) > STICK_DEADZONE) x = lx;
      if (Math.abs(ly) > STICK_DEADZONE) y = ly;
    }

    const len = Math.sqrt(x * x + y * y);
    if (len > 1) {
      x /= len;
      y /= len;
    }

    return { x, y };
  }

  /** Call at end of update() to sync previous-frame state for justPressed. */
  postUpdate(): void {
    const gamepad = this.pad;
    if (gamepad) {
      for (const mapping of this.padMap) {
        const btn = gamepad.buttons[mapping.button];
        this.prevPadButtons.set(mapping.button, btn ? btn.pressed : false);
      }
      this.prevStickX = gamepad.axes.length > 0 ? gamepad.axes[0].getValue() : 0;
      this.prevStickY = gamepad.axes.length > 1 ? gamepad.axes[1].getValue() : 0;
    }
  }

  /** True if any action key/button was just pressed (useful for "press anything"). */
  anyJustPressed(): boolean {
    const gamepad = this.pad;
    if (gamepad) {
      for (const mapping of this.padMap) {
        const btn = gamepad.buttons[mapping.button];
        const wasDown = this.prevPadButtons.get(mapping.button) ?? false;
        if (btn && btn.pressed && !wasDown) {
          this.setDevice("gamepad");
          return true;
        }
      }
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

  private isPadDown(action: Action): boolean {
    const gamepad = this.pad;
    if (!gamepad) return false;
    for (const mapping of this.padMap) {
      if (mapping.action === action) {
        const btn = gamepad.buttons[mapping.button];
        if (btn?.pressed) return true;
      }
    }
    return false;
  }

  private isPadJustPressed(action: Action): boolean {
    const gamepad = this.pad;
    if (!gamepad) return false;
    for (const mapping of this.padMap) {
      if (mapping.action === action) {
        const btn = gamepad.buttons[mapping.button];
        const wasDown = this.prevPadButtons.get(mapping.button) ?? false;
        if (btn && btn.pressed && !wasDown) return true;
      }
    }

    const lx = gamepad.axes.length > 0 ? gamepad.axes[0].getValue() : 0;
    const ly = gamepad.axes.length > 1 ? gamepad.axes[1].getValue() : 0;
    const thresh = STICK_DEADZONE + 0.15;
    if (action === Action.LEFT && lx < -thresh && this.prevStickX >= -thresh) return true;
    if (action === Action.RIGHT && lx > thresh && this.prevStickX <= thresh) return true;
    if (action === Action.UP && ly < -thresh && this.prevStickY >= -thresh) return true;
    if (action === Action.DOWN && ly > thresh && this.prevStickY <= thresh) return true;

    return false;
  }
}
