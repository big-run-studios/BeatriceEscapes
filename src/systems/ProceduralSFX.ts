import { AudioManager } from "./AudioManager";
import { SFX_REGISTRY } from "../config/audio";

// ════════════════════════════════════════════════════════════════
//  ProceduralSFX — runtime-generated placeholder sound effects
// ════════════════════════════════════════════════════════════════
// Generates AudioBuffers programmatically using oscillator math.
// Zero external files needed. Replace with real assets later.

const SAMPLE_RATE = 44100;

export function registerAllProceduralSFX(): void {
  const mgr = AudioManager.instance;
  const generators: Record<string, () => AudioBuffer> = {
    swingLight:    generateSwing,
    swingHeavy:    () => generateSwing(0.2, 400, 120),
    hitImpact:     generateImpact,
    pickup:        generatePickup,
    dash:          generateDash,
    jump:          generateJump,
    parry:         generateParry,
    death:         generateDeath,
    uiClick:       generateUIClick,
    projectile:    generateProjectile,
    aoeSlam:       generateAoeSlam,
    throwGrab:     generateThrowGrab,
    ultimateBlast: generateUltimateBlast,
    enemyDeath:    generateEnemyDeath,
    waveClear:     generateWaveClear,
  };

  for (const key of Object.keys(SFX_REGISTRY)) {
    const def = SFX_REGISTRY[key];
    if (!def.procedural) continue;
    const gen = generators[key];
    if (gen) {
      mgr.registerBuffer(key, gen());
    }
  }
}

// ── Generators ─────────────────────────────────────────────

function createBuffer(seconds: number, channels = 1): AudioBuffer {
  const ctx = AudioManager.instance.context;
  return ctx.createBuffer(channels, Math.ceil(seconds * SAMPLE_RATE), SAMPLE_RATE);
}

function generateSwing(
  duration = 0.15,
  startFreq = 300,
  endFreq = 100,
): AudioBuffer {
  const buf = createBuffer(duration);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) {
    const t = i / SAMPLE_RATE;
    const norm = t / duration;
    const freq = startFreq + (endFreq - startFreq) * norm;
    const envelope = 1 - norm;
    const noise = (Math.random() * 2 - 1) * 0.3;
    data[i] = (Math.sin(2 * Math.PI * freq * t) * 0.7 + noise) * envelope * envelope;
  }
  return buf;
}

function generateImpact(): AudioBuffer {
  const duration = 0.12;
  const buf = createBuffer(duration);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) {
    const t = i / SAMPLE_RATE;
    const norm = t / duration;
    const envelope = Math.exp(-norm * 12);
    const noise = (Math.random() * 2 - 1);
    const low = Math.sin(2 * Math.PI * 80 * t);
    data[i] = (noise * 0.6 + low * 0.4) * envelope;
  }
  return buf;
}

function generatePickup(): AudioBuffer {
  const duration = 0.25;
  const buf = createBuffer(duration);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) {
    const t = i / SAMPLE_RATE;
    const norm = t / duration;
    const freq = norm < 0.5 ? 600 : 900;
    const envelope = 1 - norm;
    data[i] = Math.sin(2 * Math.PI * freq * t) * envelope * 0.5;
  }
  return buf;
}

function generateDash(): AudioBuffer {
  const duration = 0.18;
  const buf = createBuffer(duration);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) {
    const t = i / SAMPLE_RATE;
    const norm = t / duration;
    const envelope = norm < 0.3 ? norm / 0.3 : (1 - norm) / 0.7;
    const noise = Math.random() * 2 - 1;
    const cutoff = 0.2 + 0.8 * (1 - norm);
    data[i] = noise * cutoff * envelope * 0.7;
  }
  return buf;
}

function generateJump(): AudioBuffer {
  const duration = 0.1;
  const buf = createBuffer(duration);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) {
    const t = i / SAMPLE_RATE;
    const norm = t / duration;
    const freq = 200 + 600 * norm;
    const envelope = 1 - norm;
    data[i] = Math.sin(2 * Math.PI * freq * t) * envelope * 0.5;
  }
  return buf;
}

function generateParry(): AudioBuffer {
  const duration = 0.15;
  const buf = createBuffer(duration);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) {
    const t = i / SAMPLE_RATE;
    const norm = t / duration;
    const envelope = Math.exp(-norm * 10);
    const f1 = Math.sin(2 * Math.PI * 2000 * t);
    const f2 = Math.sin(2 * Math.PI * 3000 * t) * 0.5;
    const f3 = Math.sin(2 * Math.PI * 5000 * t) * 0.25;
    data[i] = (f1 + f2 + f3) * envelope * 0.3;
  }
  return buf;
}

function generateDeath(): AudioBuffer {
  const duration = 0.6;
  const buf = createBuffer(duration);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) {
    const t = i / SAMPLE_RATE;
    const norm = t / duration;
    const freq = 400 * (1 - norm * 0.7);
    const envelope = Math.exp(-norm * 4);
    const noise = (Math.random() * 2 - 1) * 0.15 * envelope;
    data[i] = Math.sin(2 * Math.PI * freq * t) * envelope * 0.6 + noise;
  }
  return buf;
}

function generateUIClick(): AudioBuffer {
  const duration = 0.04;
  const buf = createBuffer(duration);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) {
    const t = i / SAMPLE_RATE;
    const norm = t / duration;
    const envelope = Math.exp(-norm * 30);
    data[i] = Math.sin(2 * Math.PI * 1800 * t) * envelope * 0.4;
  }
  return buf;
}

function generateProjectile(): AudioBuffer {
  const duration = 0.15;
  const buf = createBuffer(duration);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) {
    const t = i / SAMPLE_RATE;
    const norm = t / duration;
    const freq = 500 + 300 * Math.sin(norm * Math.PI * 4);
    const envelope = norm < 0.1 ? norm / 0.1 : (1 - norm) / 0.9;
    data[i] = Math.sin(2 * Math.PI * freq * t) * envelope * 0.4;
  }
  return buf;
}

function generateAoeSlam(): AudioBuffer {
  const duration = 0.3;
  const buf = createBuffer(duration);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) {
    const t = i / SAMPLE_RATE;
    const norm = t / duration;
    const envelope = Math.exp(-norm * 6);
    const low = Math.sin(2 * Math.PI * 60 * t);
    const noise = (Math.random() * 2 - 1) * Math.exp(-norm * 10);
    data[i] = (low * 0.5 + noise * 0.5) * envelope * 0.8;
  }
  return buf;
}

function generateThrowGrab(): AudioBuffer {
  const duration = 0.2;
  const buf = createBuffer(duration);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) {
    const t = i / SAMPLE_RATE;
    const norm = t / duration;
    const freq = 250 - 100 * norm;
    const envelope = norm < 0.15 ? norm / 0.15 : (1 - norm) / 0.85;
    const noise = (Math.random() * 2 - 1) * 0.2;
    data[i] = (Math.sin(2 * Math.PI * freq * t) * 0.6 + noise) * envelope;
  }
  return buf;
}

function generateUltimateBlast(): AudioBuffer {
  const duration = 0.8;
  const buf = createBuffer(duration);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) {
    const t = i / SAMPLE_RATE;
    const norm = t / duration;
    const riseTime = 0.15;
    const envelope = norm < riseTime
      ? norm / riseTime
      : Math.exp(-(norm - riseTime) * 3);
    const freq = 100 + 200 * (1 - norm);
    const low = Math.sin(2 * Math.PI * freq * t);
    const noise = (Math.random() * 2 - 1);
    const mid = Math.sin(2 * Math.PI * 300 * t) * 0.3;
    data[i] = (low * 0.4 + noise * 0.3 + mid) * envelope * 0.7;
  }
  return buf;
}

function generateEnemyDeath(): AudioBuffer {
  const duration = 0.35;
  const buf = createBuffer(duration);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) {
    const t = i / SAMPLE_RATE;
    const norm = t / duration;
    const freq = 300 * (1 - norm * 0.5);
    const envelope = Math.exp(-norm * 5);
    const noise = (Math.random() * 2 - 1) * 0.2 * envelope;
    data[i] = Math.sin(2 * Math.PI * freq * t) * envelope * 0.5 + noise;
  }
  return buf;
}

function generateWaveClear(): AudioBuffer {
  const duration = 0.5;
  const buf = createBuffer(duration);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) {
    const t = i / SAMPLE_RATE;
    const norm = t / duration;
    const freq1 = 500 + 500 * norm;
    const freq2 = 750 + 500 * norm;
    const envelope = norm < 0.1 ? norm / 0.1 : Math.exp(-(norm - 0.1) * 4);
    data[i] = (Math.sin(2 * Math.PI * freq1 * t) * 0.5
      + Math.sin(2 * Math.PI * freq2 * t) * 0.3) * envelope * 0.5;
  }
  return buf;
}
