import Phaser from "phaser";

export interface InterpAnimDef {
  key: string;
  frames: number[];
  frameRate: number;
  repeat: number;
  loop?: boolean;
}

const COLS = 8;

export function registerInterpAnims(
  scene: Phaser.Scene,
  sheetKey: string,
  frameW: number,
  frameH: number,
  anims: InterpAnimDef[],
): void {
  const interpKey = `interp-${sheetKey}`;

  if (scene.textures.exists(interpKey)) return;

  let totalInterp = 0;
  for (const a of anims) {
    totalInterp += a.frames.length - 1 + (a.loop ? 1 : 0);
  }
  if (totalInterp === 0) return;

  const rows = Math.ceil(totalInterp / COLS);
  const canvasTex = scene.textures.createCanvas(interpKey, COLS * frameW, rows * frameH);
  const ctx = canvasTex!.context;
  const srcTexture = scene.textures.get(sheetKey);

  const tmp = document.createElement("canvas");
  tmp.width = frameW;
  tmp.height = frameH;
  const tmpCtx = tmp.getContext("2d")!;

  let idx = 0;

  for (const anim of anims) {
    const pairs: [number, number][] = [];
    for (let i = 0; i < anim.frames.length - 1; i++) {
      pairs.push([anim.frames[i], anim.frames[i + 1]]);
    }
    if (anim.loop && anim.frames.length >= 2) {
      pairs.push([anim.frames[anim.frames.length - 1], anim.frames[0]]);
    }

    const interpFrameIds: number[] = [];

    for (const [a, b] of pairs) {
      const fA = srcTexture.get(a);
      const fB = srcTexture.get(b);
      const imgA = fA.source.image as HTMLImageElement;
      const imgB = fB.source.image as HTMLImageElement;

      tmpCtx.clearRect(0, 0, frameW, frameH);
      tmpCtx.globalAlpha = 1;
      tmpCtx.drawImage(imgA, fA.cutX, fA.cutY, fA.cutWidth, fA.cutHeight, 0, 0, frameW, frameH);
      tmpCtx.globalAlpha = 0.5;
      tmpCtx.drawImage(imgB, fB.cutX, fB.cutY, fB.cutWidth, fB.cutHeight, 0, 0, frameW, frameH);
      tmpCtx.globalAlpha = 1;

      const dx = (idx % COLS) * frameW;
      const dy = Math.floor(idx / COLS) * frameH;
      ctx.drawImage(tmp, dx, dy);

      canvasTex!.add(idx, 0, dx, dy, frameW, frameH);
      interpFrameIds.push(idx);
      idx++;
    }

    const animFrames: Phaser.Types.Animations.AnimationFrame[] = [];
    let p = 0;
    for (let i = 0; i < anim.frames.length; i++) {
      animFrames.push({ key: sheetKey, frame: anim.frames[i] });
      if (p < interpFrameIds.length && (i < anim.frames.length - 1 || anim.loop)) {
        animFrames.push({ key: interpKey, frame: interpFrameIds[p] });
        p++;
      }
    }

    scene.anims.create({
      key: anim.key,
      frames: animFrames,
      frameRate: anim.frameRate * 2,
      repeat: anim.repeat,
    });
  }

  canvasTex!.refresh();
}
