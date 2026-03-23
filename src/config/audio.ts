// ════════════════════════════════════════════════════════════════
//  AUDIO CONFIGURATION
// ════════════════════════════════════════════════════════════════

export type ChannelName = "music" | "sfx" | "ui";

export interface MusicTrackDef {
  readonly url: string;
  readonly loop: boolean;
  readonly baseVolume: number;
}

export interface SFXDef {
  readonly key: string;
  readonly procedural: boolean;
  readonly baseVolume: number;
  readonly maxInstances: number;
}

// ── Music Tracks ─────────────────────────────────────────────

export const MUSIC_TRACKS: Record<string, MusicTrackDef> = {
  title:   { url: "audio/music/title.mp3",   loop: true,  baseVolume: 0.7 },
  hub:     { url: "audio/music/hub.mp3",     loop: true,  baseVolume: 0.6 },
  arena:   { url: "audio/music/arena.mp3",   loop: true,  baseVolume: 0.5 },
  boss:    { url: "audio/music/boss.mp3",    loop: true,  baseVolume: 0.6 },
};

// ── Stings — one-shot audio that ducks the music channel ─────
// URL-based assets loaded at startup, played via playStingWithDuck().

export interface StingDef {
  readonly url: string;
  readonly baseVolume: number;
}

export const STINGS: Record<string, StingDef> = {
  victory: { url: "audio/music/victory.m4a", baseVolume: 0.8 },
};

// ── SFX Registry ─────────────────────────────────────────────
// Procedural entries are generated at runtime by ProceduralSFX.
// Non-procedural entries will be loaded from audio sprite sheets.

export const SFX_REGISTRY: Record<string, SFXDef> = {
  swingLight:   { key: "swingLight",   procedural: true, baseVolume: 0.5, maxInstances: 4 },
  swingHeavy:   { key: "swingHeavy",   procedural: true, baseVolume: 0.6, maxInstances: 4 },
  hitImpact:    { key: "hitImpact",    procedural: true, baseVolume: 0.7, maxInstances: 6 },
  pickup:       { key: "pickup",       procedural: true, baseVolume: 0.5, maxInstances: 3 },
  dash:         { key: "dash",         procedural: true, baseVolume: 0.4, maxInstances: 2 },
  jump:         { key: "jump",         procedural: true, baseVolume: 0.35, maxInstances: 2 },
  parry:        { key: "parry",        procedural: true, baseVolume: 0.6, maxInstances: 2 },
  death:        { key: "death",        procedural: true, baseVolume: 0.7, maxInstances: 1 },
  uiClick:      { key: "uiClick",      procedural: true, baseVolume: 0.4, maxInstances: 2 },
  projectile:   { key: "projectile",   procedural: true, baseVolume: 0.4, maxInstances: 6 },
  aoeSlam:      { key: "aoeSlam",      procedural: true, baseVolume: 0.6, maxInstances: 3 },
  throwGrab:    { key: "throwGrab",    procedural: true, baseVolume: 0.5, maxInstances: 1 },
  ultimateBlast:{ key: "ultimateBlast",procedural: true, baseVolume: 0.8, maxInstances: 1 },
  enemyDeath:   { key: "enemyDeath",   procedural: true, baseVolume: 0.5, maxInstances: 4 },
  waveClear:    { key: "waveClear",    procedural: true, baseVolume: 0.6, maxInstances: 1 },
};

// ── Defaults ─────────────────────────────────────────────────

export const AUDIO_DEFAULTS = {
  masterVolume: 0.8,
  musicVolume: 0.6,
  sfxVolume: 0.8,
  uiVolume: 0.7,
  crossfadeDuration: 1.5,   // seconds
  duckDepth: 0.3,           // gain multiplier when ducked
  duckRampTime: 0.15,       // seconds to ramp into/out of duck
} as const;
