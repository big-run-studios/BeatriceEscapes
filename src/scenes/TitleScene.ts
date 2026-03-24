import Phaser from "phaser";
import { GAME_WIDTH, GAME_HEIGHT, COLORS } from "../config/game";
import { InputManager, Action } from "../systems/InputManager";
import { AudioManager } from "../systems/AudioManager";
import { initPSGlyphs, PromptLine } from "../ui/ButtonGlyphs";

interface LayerDef {
  key: string;
  file: string;
  depth: number;
  parallax: number;
  blend?: number;
  /** Horizontal offset as fraction of GAME_WIDTH (negative = left, positive = right) */
  offsetX?: number;
  /** Vertical offset as fraction of GAME_HEIGHT (negative = up, positive = down) */
  offsetY?: number;
  /** Override the default cover-fill scale multiplier (default 1.08) */
  scaleMult?: number;
  /** Scale to fit width instead of covering the viewport */
  fitWidth?: boolean;
}

interface ParallaxLayer {
  image: Phaser.GameObjects.Image;
  factor: number;
  baseX: number;
  baseY: number;
}

const TITLE_ART_PATH = "art/title/";

const LAYER_DEFS: LayerDef[] = [
  { key: "title-sky",       file: "sky.png",         depth: -10, parallax: 0.02, offsetY: -0.12 },
  { key: "title-mg-street", file: "mg-street.png",   depth: 20,  parallax: 0.08, offsetY: 0.05 },
  { key: "title-magic-fx",  file: "magic-fx.png",    depth: 30,  parallax: 0.06, blend: Phaser.BlendModes.SCREEN, offsetX: 0.22, offsetY: -0.25, scaleMult: 0.65 },
  { key: "title-family",    file: "family.png",      depth: 40,  parallax: 0.15, offsetX: -0.12, offsetY: 0.06 },
  { key: "title-fg",        file: "fg-elements.png", depth: 50,  parallax: 0.20, offsetY: 0.38, fitWidth: true },
];

const UI_DEPTH = 100;
const PARALLAX_RANGE = 20;
const PARALLAX_SMOOTHING = 0.08;

const CURSOR_DEPTH = 200;
const CURSOR_SPEED = 500;
const SWIRL_COLORS = [0x88ddff, 0xcc88ff, 0x44ccff, 0xeeddff];

export class TitleScene extends Phaser.Scene {
  private input_mgr!: InputManager;
  private controllerStatus!: Phaser.GameObjects.Text;
  private prompt!: PromptLine;
  private ready = false;
  private accepted = false;

  private layers: ParallaxLayer[] = [];
  private artLoaded = false;
  private parallaxX = 0;
  private parallaxY = 0;
  private elapsed = 0;


  private cursorX = GAME_WIDTH / 2;
  private cursorY = GAME_HEIGHT / 2;
  private cursorGlow!: Phaser.GameObjects.Arc;
  private cursorCore!: Phaser.GameObjects.Arc;
  private cursorOrbs: Phaser.GameObjects.Arc[] = [];
  private cursorTrails: Phaser.GameObjects.Arc[] = [];
  private cursorAngle = 0;
  private usingMouse = false;

  constructor() {
    super({ key: "TitleScene" });
  }

  preload(): void {
    const base = (import.meta as Record<string, Record<string, string>>).env?.BASE_URL ?? "/";
    for (const def of LAYER_DEFS) {
      this.load.image(def.key, `${base}${TITLE_ART_PATH}${def.file}`);
    }
    this.load.image("title-logo", `${base}${TITLE_ART_PATH}logo.png`);
    this.load.on("loaderror", (_file: Phaser.Loader.File) => {});
  }

  create(): void {
    const qaParam = new URLSearchParams(window.location.search).get("qa");
    if (qaParam) {
      this.scene.start("HubScene");
      return;
    }

    this.input_mgr = new InputManager(this);
    initPSGlyphs(this);
    this.ready = false;
    this.accepted = false;
    this.layers = [];
    this.parallaxX = 0;
    this.parallaxY = 0;
    this.elapsed = 0;

    const cx = GAME_WIDTH / 2;
    const cy = GAME_HEIGHT / 2;

    this.artLoaded = this.textures.exists(LAYER_DEFS[0].key);

    if (this.artLoaded) {
      this.createArtLayers(cx, cy);
    }

    this.createUI(cx, cy);
    this.createMagicCursor();
    this.startAudio();
  }

  private createArtLayers(cx: number, cy: number): void {
    for (const def of LAYER_DEFS) {
      if (!this.textures.exists(def.key)) continue;

      const xOff = (def.offsetX ?? 0) * GAME_WIDTH;
      const yOff = (def.offsetY ?? 0) * GAME_HEIGHT;
      const img = this.add.image(cx + xOff, cy + yOff, def.key);
      const src = img.texture.getSourceImage();
      const scaleX = GAME_WIDTH / src.width;
      const scaleY = GAME_HEIGHT / src.height;
      const baseMult = def.scaleMult ?? 1.08;
      const scale = def.fitWidth
        ? scaleX * baseMult
        : Math.max(scaleX, scaleY) * baseMult;
      img.setScale(scale);
      img.setDepth(def.depth);
      img.setAlpha(0);

      if (def.blend !== undefined) {
        img.setBlendMode(def.blend);
      }

      this.layers.push({
        image: img,
        factor: def.parallax,
        baseX: cx + xOff,
        baseY: cy + yOff,
      });

      this.tweens.add({
        targets: img,
        alpha: 1,
        duration: 1200,
        delay: Math.max(0, def.depth) * 8,
        ease: "Power2",
      });
    }

    this.startLayerAnimations();
  }

  private startLayerAnimations(): void {
    const magic = this.findLayer("title-magic-fx");
    if (magic) {
      this.tweens.add({
        targets: magic.image,
        alpha: { from: 0.65, to: 1 },
        duration: 2400,
        ease: "Sine.easeInOut",
        yoyo: true,
        repeat: -1,
      });
      this.tweens.add({
        targets: magic.image,
        scaleX: magic.image.scaleX * 1.03,
        scaleY: magic.image.scaleY * 1.03,
        duration: 3200,
        ease: "Sine.easeInOut",
        yoyo: true,
        repeat: -1,
      });
    }

    const fg = this.findLayer("title-fg");
    if (fg) {
      this.tweens.add({
        targets: fg.image,
        alpha: { from: 0.85, to: 1 },
        duration: 1800,
        ease: "Sine.easeInOut",
        yoyo: true,
        repeat: -1,
        delay: 500,
      });
    }
  }

  private findLayer(key: string): ParallaxLayer | undefined {
    return this.layers.find(l => l.image.texture.key === key);
  }

  private createUI(cx: number, cy: number): void {
    const logoX = GAME_WIDTH - 200;
    const logoY = 130;
    const logoWidth = 440;

    let logoObj: Phaser.GameObjects.Image | Phaser.GameObjects.Text;
    if (this.textures.exists("title-logo")) {
      const logo = this.add.image(logoX, logoY, "title-logo");
      const src = logo.texture.getSourceImage();
      logo.setScale(logoWidth / src.width);
      logo.setOrigin(0.5);
      logo.setDepth(UI_DEPTH);
      logoObj = logo;
    } else {
      const title = this.add.text(logoX, logoY, "REGAL GUARDIANS", {
        fontFamily: "Georgia, serif",
        fontSize: "52px",
        color: COLORS.titleText,
        fontStyle: "bold",
        stroke: "#000000",
        strokeThickness: 4,
        shadow: { offsetX: 2, offsetY: 3, color: "rgba(0,0,0,0.6)", blur: 8, fill: true },
      });
      title.setOrigin(0.5);
      title.setDepth(UI_DEPTH);
      logoObj = title;
    }

    this.prompt = new PromptLine(this, cx, cy + 100, this.input_mgr, {
      fontFamily: "Georgia, serif",
      fontSize: "28px",
      color: "#ffffff",
      stroke: "#000000",
      strokeThickness: 3,
      shadow: { offsetX: 1, offsetY: 2, color: "rgba(0,0,0,0.7)", blur: 6, fill: true },
    });
    this.prompt.setAlpha(0);
    this.prompt.setDepth(UI_DEPTH);

    this.controllerStatus = this.add.text(16, GAME_HEIGHT - 16, "", {
      fontFamily: "monospace",
      fontSize: "14px",
      color: COLORS.subtitleText,
    });
    this.controllerStatus.setOrigin(0, 1);
    this.controllerStatus.setDepth(UI_DEPTH);

    const version = this.add.text(GAME_WIDTH - 16, GAME_HEIGHT - 16, "B0.8.0", {
      fontFamily: "monospace",
      fontSize: "14px",
      color: COLORS.subtitleText,
    });
    version.setOrigin(1, 1);
    version.setDepth(UI_DEPTH);

    this.tweens.add({
      targets: logoObj,
      alpha: { from: 0, to: 1 },
      y: { from: logoY - 25, to: logoY },
      duration: 1200,
      delay: 400,
      ease: "Power2",
    });

    this.tweens.add({
      targets: this.prompt,
      alpha: { from: 0, to: 1 },
      delay: 1800,
      duration: 600,
      ease: "Power2",
      onComplete: () => {
        this.ready = true;
      },
    });

    this.tweens.add({
      targets: this.prompt,
      alpha: { from: 1, to: 0.3 },
      delay: 2600,
      duration: 800,
      ease: "Sine.easeInOut",
      yoyo: true,
      repeat: -1,
    });
  }

  private audioUnlocked = false;

  private startAudio(): void {
    const audio = AudioManager.instance;
    const unlock = () => {
      if (this.audioUnlocked) return;
      this.audioUnlocked = true;
      audio.resumeContext().then(() => {
        if (!this.accepted) audio.playMusic("title");
      });
      this.input.off("pointerdown", unlock);
      document.removeEventListener("keydown", keyHandler);
      document.removeEventListener("touchstart", touchHandler);
    };
    const keyHandler = () => unlock();
    const touchHandler = () => unlock();
    if (audio.context.state === "running") {
      this.audioUnlocked = true;
      audio.playMusic("title");
    } else if (audio.context.state === "closed") {
      return;
    } else {
      this.input.on("pointerdown", unlock);
      document.addEventListener("keydown", keyHandler, { once: true });
      document.addEventListener("touchstart", touchHandler, { once: true });
    }
  }

  private createMagicCursor(): void {
    this.input.setDefaultCursor("none");
    this.cursorX = GAME_WIDTH / 2;
    this.cursorY = GAME_HEIGHT / 2;

    this.cursorGlow = this.add.circle(this.cursorX, this.cursorY, 14, 0x6688ff, 0.12);
    this.cursorGlow.setDepth(CURSOR_DEPTH - 1);

    for (let i = 0; i < 6; i++) {
      const trail = this.add.circle(this.cursorX, this.cursorY, 2, 0xaaccff, 0);
      trail.setDepth(CURSOR_DEPTH);
      this.cursorTrails.push(trail);
    }

    for (let i = 0; i < 4; i++) {
      const orb = this.add.circle(this.cursorX, this.cursorY, 2.5, SWIRL_COLORS[i], 0.85);
      orb.setDepth(CURSOR_DEPTH + 1);
      this.cursorOrbs.push(orb);
    }

    this.cursorCore = this.add.circle(this.cursorX, this.cursorY, 3, 0xffffff, 0.95);
    this.cursorCore.setDepth(CURSOR_DEPTH + 2);
  }

  private updateMagicCursor(delta: number): void {
    const pointer = this.input.activePointer;
    const pad = this.input.gamepad?.getPad(0) ?? null;

    if (pointer.x !== 0 || pointer.y !== 0) {
      const dx = Math.abs(pointer.x - this.cursorX);
      const dy = Math.abs(pointer.y - this.cursorY);
      if (dx > 1 || dy > 1) this.usingMouse = true;
    }

    if (pad) {
      const lx = pad.axes.length > 0 ? pad.axes[0].getValue() : 0;
      const ly = pad.axes.length > 1 ? pad.axes[1].getValue() : 0;
      if (Math.abs(lx) > 0.15 || Math.abs(ly) > 0.15) {
        this.usingMouse = false;
        this.cursorX += lx * CURSOR_SPEED * (delta / 1000);
        this.cursorY += ly * CURSOR_SPEED * (delta / 1000);
      }
    }

    if (!this.usingMouse && !pad) {
      const move = this.input_mgr.getMovement();
      if (move.x !== 0 || move.y !== 0) {
        this.cursorX += move.x * CURSOR_SPEED * (delta / 1000);
        this.cursorY += move.y * CURSOR_SPEED * (delta / 1000);
      }
    }

    if (this.usingMouse) {
      this.cursorX = pointer.x;
      this.cursorY = pointer.y;
    }

    this.cursorX = Phaser.Math.Clamp(this.cursorX, 0, GAME_WIDTH);
    this.cursorY = Phaser.Math.Clamp(this.cursorY, 0, GAME_HEIGHT);

    const dt = delta / 1000;
    this.cursorAngle += dt * 3.5;

    this.cursorCore.setPosition(this.cursorX, this.cursorY);
    this.cursorGlow.setPosition(this.cursorX, this.cursorY);

    const pulseScale = 1 + Math.sin(this.cursorAngle * 2) * 0.25;
    this.cursorGlow.setScale(pulseScale);

    const orbRadius = 8;
    for (let i = 0; i < this.cursorOrbs.length; i++) {
      const angle = this.cursorAngle + (i * Math.PI * 2) / this.cursorOrbs.length;
      const wobble = Math.sin(this.cursorAngle * 1.5 + i) * 2;
      const ox = Math.cos(angle) * (orbRadius + wobble);
      const oy = Math.sin(angle) * (orbRadius + wobble);
      this.cursorOrbs[i].setPosition(this.cursorX + ox, this.cursorY + oy);
      this.cursorOrbs[i].setAlpha(0.5 + Math.sin(this.cursorAngle * 2 + i * 1.2) * 0.35);
    }

    for (let i = this.cursorTrails.length - 1; i > 0; i--) {
      const prev = this.cursorTrails[i - 1];
      const trail = this.cursorTrails[i];
      trail.setPosition(
        Phaser.Math.Linear(trail.x, prev.x, 0.4),
        Phaser.Math.Linear(trail.y, prev.y, 0.4),
      );
      trail.setAlpha(0.25 * (1 - i / this.cursorTrails.length));
    }
    if (this.cursorTrails.length > 0) {
      this.cursorTrails[0].setPosition(this.cursorX, this.cursorY);
      this.cursorTrails[0].setAlpha(0.3);
    }
  }

  update(_time: number, delta: number): void {
    AudioManager.instance.heartbeat();
    this.updateControllerStatus();
    this.updatePromptLabel();
    this.updateMagicCursor(delta);

    if (this.artLoaded) {
      this.elapsed += delta;
      this.updateParallax();
    }

    if (this.ready && !this.accepted) {
      if (this.input_mgr.justPressed(Action.CONFIRM)) {
        this.accepted = true;
        AudioManager.instance.resumeContext();
        this.onStart();
      } else if (this.input_mgr.justPressed(Action.PAUSE)) {
        this.scene.pause();
        this.scene.launch("SettingsScene", { callerKey: "TitleScene" });
      }
    }

    this.input_mgr.postUpdate();
  }

  private updateParallax(): void {
    const targetX = (this.cursorX - GAME_WIDTH / 2) / (GAME_WIDTH / 2);
    const targetY = (this.cursorY - GAME_HEIGHT / 2) / (GAME_HEIGHT / 2);

    this.parallaxX += (targetX - this.parallaxX) * PARALLAX_SMOOTHING;
    this.parallaxY += (targetY - this.parallaxY) * PARALLAX_SMOOTHING;

    const t = this.elapsed * 0.001;

    for (const layer of this.layers) {
      const driftX = Math.sin(t * 0.4 + layer.factor * 20) * 2 * layer.factor;
      const driftY = Math.cos(t * 0.3 + layer.factor * 15) * 1.5 * layer.factor;

      const px = -this.parallaxX * PARALLAX_RANGE * layer.factor * 10;
      const py = -this.parallaxY * PARALLAX_RANGE * layer.factor * 10;

      layer.image.x = layer.baseX + px + driftX;
      layer.image.y = layer.baseY + py + driftY;
    }

  }

  private updateControllerStatus(): void {
    if (this.input_mgr.gamepadConnected) {
      const name = this.input_mgr.gamepadName;
      const shortName = name.length > 40 ? name.substring(0, 37) + "..." : name;
      this.controllerStatus.setText(`Controller: ${shortName}`);
      this.controllerStatus.setColor(COLORS.accent);
    } else {
      this.controllerStatus.setText("No controller detected");
      this.controllerStatus.setColor(COLORS.subtitleText);
    }
  }

  private updatePromptLabel(): void {
    this.prompt.setPrompt(["Press ", Action.CONFIRM]);
  }

  private onStart(): void {
    this.tweens.killAll();
    AudioManager.instance.stopMusic(0.3);
    this.input.setDefaultCursor("default");

    this.cameras.main.fadeOut(400, 0, 0, 0);
    this.cameras.main.once("camerafadeoutcomplete", () => {
      this.scene.start("HubScene");
    });
  }
}
