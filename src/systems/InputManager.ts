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
  DODGE,
  BLOCK,
  CONFIRM,
  BACK,
  PAUSE,
}

interface ButtonMapping {
  action: Action;
  button: number;
}

interface KeyMapping {
  action: Action;
  key: string;
}

const STICK_DEADZONE = 0.3;

const DEFAULT_GAMEPAD_MAP: ButtonMapping[] = [
  { action: Action.ATTACK, button: 0 },   // A / Cross
  { action: Action.BACK, button: 1 },     // B / Circle
  { action: Action.HEAVY, button: 2 },    // X / Square
  { action: Action.UTILITY, button: 3 },  // Y / Triangle
  { action: Action.BLOCK, button: 4 },    // LB / L1
  { action: Action.DODGE, button: 5 },    // RB / R1
  { action: Action.SPECIAL, button: 6 },  // LT / L2
  { action: Action.PAUSE, button: 9 },    // Start
  { action: Action.CONFIRM, button: 0 },  // A / Cross (same as attack — contextual)
  { action: Action.UP, button: 12 },      // D-pad up
  { action: Action.DOWN, button: 13 },    // D-pad down
  { action: Action.LEFT, button: 14 },    // D-pad left
  { action: Action.RIGHT, button: 15 },   // D-pad right
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
  { action: Action.UTILITY, key: "U" },
  { action: Action.DODGE, key: "SPACE" },
  { action: Action.BLOCK, key: "SHIFT" },
  { action: Action.CONFIRM, key: "ENTER" },
  { action: Action.BACK, key: "ESC" },
  { action: Action.PAUSE, key: "ESC" },
];

export class InputManager {
  private scene: Phaser.Scene;
  private keys: Map<string, Phaser.Input.Keyboard.Key> = new Map();
  private keyMap: KeyMapping[];
  private padMap: ButtonMapping[];
  private prevPadButtons: Map<number, boolean> = new Map();
  private _gamepadConnected = false;
  private _gamepadId = "";

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.keyMap = DEFAULT_KEYBOARD_MAP;
    this.padMap = DEFAULT_GAMEPAD_MAP;
    this.setupKeyboard();
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
    this.pad; // refresh status
    return this._gamepadConnected;
  }

  get gamepadName(): string {
    return this._gamepadId;
  }

  /** True while the action's button/key is held down. */
  isDown(action: Action): boolean {
    if (this.isKeyDown(action)) return true;
    if (this.isPadDown(action)) return true;
    return false;
  }

  /** True only on the frame the action's button/key was first pressed. */
  justPressed(action: Action): boolean {
    if (this.isKeyJustDown(action)) return true;
    if (this.isPadJustPressed(action)) return true;
    return false;
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
    }
  }

  /** True if any action key/button was just pressed (useful for "press anything"). */
  anyJustPressed(): boolean {
    if (this.scene.input.keyboard) {
      for (const [, key] of this.keys) {
        if (Phaser.Input.Keyboard.JustDown(key)) return true;
      }
    }

    const gamepad = this.pad;
    if (gamepad) {
      for (const mapping of this.padMap) {
        const btn = gamepad.buttons[mapping.button];
        const wasDown = this.prevPadButtons.get(mapping.button) ?? false;
        if (btn && btn.pressed && !wasDown) return true;
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
    return false;
  }
}
