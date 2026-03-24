import {
  MUSIC_TRACKS, SFX_REGISTRY, STINGS, AUDIO_DEFAULTS,
  type ChannelName, type MusicTrackDef,
} from "../config/audio";

// ════════════════════════════════════════════════════════════════
//  AudioManager — Web Audio mix bus with crossfade & ducking
// ════════════════════════════════════════════════════════════════

export interface PlaySFXOpts {
  volume?: number;   // 0-1 multiplier on top of baseVolume
  rate?: number;     // playback rate (1 = normal)
  pan?: number;      // -1 (left) to 1 (right), 0 = center
}

interface ActiveMusic {
  source: AudioBufferSourceNode;
  gain: GainNode;
  key: string;
  trackDef: MusicTrackDef;
}

const RAMP_EPSILON = 0.001;
const TAB_CHANNEL_NAME = "regal-guardians-audio-leader";

export class AudioManager {
  private static _instance: AudioManager | null = null;
  static get instance(): AudioManager {
    const win = globalThis as Record<string, unknown>;
    if (win.__audioManagerInstance) {
      AudioManager._instance = win.__audioManagerInstance as AudioManager;
    }
    if (!AudioManager._instance) {
      AudioManager._instance = new AudioManager();
      win.__audioManagerInstance = AudioManager._instance;
    }
    return AudioManager._instance;
  }

  private ctx!: AudioContext;
  private masterGain!: GainNode;
  private musicGain!: GainNode;
  private sfxGain!: GainNode;
  private uiGain!: GainNode;

  private bufferCache = new Map<string, AudioBuffer>();
  private loadingPromises = new Map<string, Promise<AudioBuffer | null>>();
  private currentMusic: ActiveMusic | null = null;
  private musicPaused = false;
  private musicGeneration = 0;

  private _masterVol: number = AUDIO_DEFAULTS.masterVolume;
  private _musicVol: number = AUDIO_DEFAULTS.musicVolume;
  private _sfxVol: number = AUDIO_DEFAULTS.sfxVolume;
  private _uiVol: number = AUDIO_DEFAULTS.uiVolume;

  private activeSfxCount = new Map<string, number>();
  private debugLog: string[] = [];
  private debugEnabled = false;

  private _connected = false;
  private _lastHeartbeat = 0;
  private _lastInteraction = 0;
  private _watchdogId: ReturnType<typeof setInterval> | null = null;

  private _leaderChannel: BroadcastChannel | null = null;
  private _tabId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  private constructor() { /* use AudioManager.init() */ }

  // ── Initialization ───────────────────────────────────────

  init(): void {
    if (this.ctx && this.ctx.state !== "closed") {
      this.claimLeadership();
      return;
    }
    this.ctx = new AudioContext();

    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = this._masterVol;
    this.masterGain.connect(this.ctx.destination);
    this._connected = true;

    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = this._musicVol;
    this.musicGain.connect(this.masterGain);

    this.sfxGain = this.ctx.createGain();
    this.sfxGain.gain.value = this._sfxVol;
    this.sfxGain.connect(this.masterGain);

    this.uiGain = this.ctx.createGain();
    this.uiGain.gain.value = this._uiVol;
    this.uiGain.connect(this.masterGain);

    this._lastHeartbeat = Date.now();
    this._lastInteraction = Date.now();
    this.startWatchdog();
    this.claimLeadership();

    const killAudio = () => this.dispose();
    window.addEventListener("pagehide", killAudio);
    window.addEventListener("beforeunload", killAudio);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") this.disconnectOutput();
    });
  }

  /** Resume context after user gesture (browser autoplay policy). */
  async resumeContext(): Promise<void> {
    if (this.ctx.state === "suspended") {
      await this.ctx.resume();
    }
  }

  get context(): AudioContext { return this.ctx; }

  // ── Watchdog — guarantees silence when game is not active ──

  /** Call every frame from each scene's update() as proof-of-life. */
  heartbeat(): void {
    this._lastHeartbeat = Date.now();
  }

  /** Call on any user interaction (pointerdown, keydown). */
  noteInteraction(): void {
    this._lastInteraction = Date.now();
    if (!this._connected && document.visibilityState === "visible" && document.hasFocus()) {
      this.reconnectOutput();
    }
  }

  get isConnected(): boolean { return this._connected; }

  private claimLeadership(): void {
    try {
      this._leaderChannel?.close();
    } catch { /* */ }
    this._leaderChannel = new BroadcastChannel(TAB_CHANNEL_NAME);
    this._leaderChannel.onmessage = (e) => {
      if (e.data?.type === "claim" && e.data.tabId !== this._tabId) {
        this.log(`Another tab claimed leadership (${e.data.tabId}), disposing audio`);
        this.dispose();
      }
    };
    this._leaderChannel.postMessage({ type: "claim", tabId: this._tabId });
    this.log(`Claimed audio leadership (tab=${this._tabId})`);
  }

  private startWatchdog(): void {
    if (this._watchdogId) return;
    this._watchdogId = setInterval(() => {
      const visible = document.visibilityState === "visible";
      const focused = document.hasFocus();
      const heartbeatFresh = (Date.now() - this._lastHeartbeat) < 1500;
      const interactionRecent = (Date.now() - this._lastInteraction) < 30_000;

      if (!visible || !heartbeatFresh) {
        if (this._connected) this.disconnectOutput();
      } else if (!focused && !interactionRecent) {
        if (this._connected) this.disconnectOutput();
      }
    }, 500);
  }

  private disconnectOutput(): void {
    if (!this._connected) return;
    this._connected = false;
    try { this.masterGain.disconnect(this.ctx.destination); } catch { /* already disconnected */ }
    if (this.currentMusic) {
      try { this.currentMusic.source.stop(); } catch { /* */ }
      try { this.currentMusic.source.disconnect(); } catch { /* */ }
      try { this.currentMusic.gain.disconnect(); } catch { /* */ }
      this.currentMusic = null;
    }
    if (this.ctx.state === "running") {
      this.ctx.suspend().catch(() => {});
    }
    this.log("WATCHDOG: suspended context + stopped music — audio killed");
  }

  private reconnectOutput(): void {
    if (this._connected) return;
    this._connected = true;
    this.masterGain.connect(this.ctx.destination);
    if (this.ctx.state === "suspended") this.ctx.resume();
    this.log("RECONNECTED — audio restored");
  }

  // ── Volume Controls ──────────────────────────────────────

  get masterVolume(): number { return this._masterVol; }
  set masterVolume(v: number) {
    this._masterVol = clamp01(v);
    this.rampGain(this.masterGain, this._masterVol, 0.05);
  }

  get musicVolume(): number { return this._musicVol; }
  set musicVolume(v: number) {
    this._musicVol = clamp01(v);
    this.rampGain(this.musicGain, this._musicVol, 0.05);
  }

  get sfxVolume(): number { return this._sfxVol; }
  set sfxVolume(v: number) {
    this._sfxVol = clamp01(v);
    this.rampGain(this.sfxGain, this._sfxVol, 0.05);
  }

  get uiVolume(): number { return this._uiVol; }
  set uiVolume(v: number) {
    this._uiVol = clamp01(v);
    this.rampGain(this.uiGain, this._uiVol, 0.05);
  }

  // ── Buffer Loading ───────────────────────────────────────

  /** Load and decode an audio file into the buffer cache. */
  async loadAudio(key: string, url: string): Promise<AudioBuffer | null> {
    if (this.bufferCache.has(key)) return this.bufferCache.get(key)!;

    const existing = this.loadingPromises.get(key);
    if (existing) return existing;

    const promise = this.fetchAndDecode(key, url);
    this.loadingPromises.set(key, promise);
    return promise;
  }

  private async fetchAndDecode(key: string, url: string): Promise<AudioBuffer | null> {
    try {
      const resp = await fetch(url);
      if (!resp.ok) {
        console.warn(`[AudioManager] Failed to fetch "${key}" from ${url}: ${resp.status}`);
        return null;
      }
      const arrayBuf = await resp.arrayBuffer();
      const audioBuf = await this.ctx.decodeAudioData(arrayBuf);
      this.bufferCache.set(key, audioBuf);
      return audioBuf;
    } catch (e) {
      console.warn(`[AudioManager] Error loading "${key}":`, e);
      return null;
    } finally {
      this.loadingPromises.delete(key);
    }
  }

  /** Register a pre-built AudioBuffer (e.g. from ProceduralSFX). */
  registerBuffer(key: string, buffer: AudioBuffer): void {
    this.bufferCache.set(key, buffer);
  }

  /** Free a cached buffer. */
  unloadAudio(key: string): void {
    this.bufferCache.delete(key);
  }

  getBuffer(key: string): AudioBuffer | undefined {
    return this.bufferCache.get(key);
  }

  // ── Music Playback ───────────────────────────────────────

  /** Play or crossfade to a music track. No-op if same track is playing. */
  async playMusic(
    key: string,
    fadeDuration = AUDIO_DEFAULTS.crossfadeDuration,
  ): Promise<void> {
    if (this.currentMusic?.key === key && !this.musicPaused) {
      this.log(`playMusic("${key}") — already playing, skipped`);
      return;
    }

    const trackDef = MUSIC_TRACKS[key];
    if (!trackDef) {
      this.log(`playMusic("${key}") — unknown track`);
      return;
    }

    const gen = ++this.musicGeneration;
    this.log(`playMusic("${key}") gen=${gen} cur="${this.currentMusic?.key ?? "none"}" ctx=${this.ctx.state}`);

    let buffer = this.bufferCache.get(key);
    if (!buffer) {
      buffer = await this.loadAudio(key, trackDef.url) ?? undefined;
      if (!buffer) return;
    }

    if (gen !== this.musicGeneration) {
      this.log(`playMusic("${key}") gen=${gen} STALE (current=${this.musicGeneration}), aborting`);
      return;
    }
    if (this.currentMusic?.key === key && !this.musicPaused) {
      this.log(`playMusic("${key}") gen=${gen} — already playing after load, skipped`);
      return;
    }

    const now = this.ctx.currentTime;
    this.fadeOutCurrentMusic(now, fadeDuration);

    const trackGain = this.ctx.createGain();
    trackGain.gain.setValueAtTime(RAMP_EPSILON, now);
    trackGain.gain.linearRampToValueAtTime(trackDef.baseVolume, now + fadeDuration);
    trackGain.connect(this.musicGain);

    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = trackDef.loop;
    source.connect(trackGain);
    source.start(0);

    this.currentMusic = { source, gain: trackGain, key, trackDef };
    this.musicPaused = false;
    this.log(`NOW PLAYING: "${key}" gen=${gen}`);
  }

  private fadeOutCurrentMusic(now: number, fadeDuration: number): void {
    if (!this.currentMusic) return;
    const old = this.currentMusic;
    this.currentMusic = null;
    this.log(`fadeOut "${old.key}" over ${fadeDuration.toFixed(2)}s`);
    old.gain.gain.cancelScheduledValues(now);
    old.gain.gain.setValueAtTime(old.gain.gain.value, now);
    old.gain.gain.linearRampToValueAtTime(RAMP_EPSILON, now + fadeDuration);
    const oldSource = old.source;
    const oldGain = old.gain;
    setTimeout(() => {
      try { oldSource.stop(); } catch { /* already stopped */ }
      oldSource.disconnect();
      oldGain.disconnect();
    }, (fadeDuration + 0.1) * 1000);
  }

  /** Stop music with optional fade. */
  stopMusic(fadeDuration = 0.5): void {
    if (!this.currentMusic) {
      this.log("stopMusic — nothing playing");
      return;
    }
    this.log(`stopMusic("${this.currentMusic.key}") fade=${fadeDuration}s`);
    ++this.musicGeneration;
    this.fadeOutCurrentMusic(this.ctx.currentTime, fadeDuration);
  }

  pauseMusic(): void {
    if (!this.currentMusic || this.musicPaused) return;
    this.ctx.suspend();
    this.musicPaused = true;
  }

  resumeMusic(): void {
    if (!this.musicPaused) return;
    this.ctx.resume();
    this.musicPaused = false;
  }

  get currentMusicKey(): string | null {
    return this.currentMusic?.key ?? null;
  }

  // ── SFX Playback ─────────────────────────────────────────

  /** Fire-and-forget SFX. Returns a stop handle. */
  playSFX(key: string, opts?: PlaySFXOpts): (() => void) | null {
    const def = SFX_REGISTRY[key];
    const buffer = this.bufferCache.get(key);
    if (!buffer) return null;

    const maxInst = def?.maxInstances ?? 8;
    const current = this.activeSfxCount.get(key) ?? 0;
    if (current >= maxInst) return null;

    const baseVol = def?.baseVolume ?? 0.5;
    const vol = baseVol * (opts?.volume ?? 1);

    const gainNode = this.ctx.createGain();
    gainNode.gain.value = vol;

    let outputNode: AudioNode = gainNode;

    if (opts?.pan !== undefined && opts.pan !== 0) {
      const panner = this.ctx.createStereoPanner();
      panner.pan.value = clamp(opts.pan, -1, 1);
      gainNode.connect(panner);
      panner.connect(this.sfxGain);
      outputNode = panner;
    } else {
      gainNode.connect(this.sfxGain);
    }

    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    if (opts?.rate) source.playbackRate.value = opts.rate;
    source.connect(gainNode);

    this.activeSfxCount.set(key, current + 1);

    const cleanup = () => {
      try { source.stop(); } catch { /* already stopped */ }
      source.disconnect();
      gainNode.disconnect();
      outputNode.disconnect();
      const c = this.activeSfxCount.get(key) ?? 1;
      this.activeSfxCount.set(key, Math.max(0, c - 1));
    };

    source.onended = cleanup;
    source.start(0);

    let stopped = false;
    return () => {
      if (stopped) return;
      stopped = true;
      cleanup();
    };
  }

  /** Play on the UI channel (menus, pickups). */
  playUI(key: string): void {
    const buffer = this.bufferCache.get(key);
    if (!buffer) return;

    const def = SFX_REGISTRY[key];
    const gainNode = this.ctx.createGain();
    gainNode.gain.value = def?.baseVolume ?? 0.4;
    gainNode.connect(this.uiGain);

    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(gainNode);
    source.onended = () => {
      source.disconnect();
      gainNode.disconnect();
    };
    source.start(0);
  }

  // ── Ducking ──────────────────────────────────────────────

  /** Smoothly ramp a channel to a target volume. */
  duck(
    channel: ChannelName,
    targetVol: number,
    duration = AUDIO_DEFAULTS.duckRampTime,
  ): void {
    const node = this.getChannelGain(channel);
    this.rampGain(node, clamp01(targetVol), duration);
  }

  /** Restore a ducked channel to its configured volume. */
  unduck(channel: ChannelName, duration = AUDIO_DEFAULTS.duckRampTime): void {
    const vol = this.getChannelVolume(channel);
    const node = this.getChannelGain(channel);
    this.rampGain(node, vol, duration);
  }

  // ── Stings — one-shot sounds that duck the music channel ──

  /**
   * Play a sting (short fanfare) on the UI channel while ducking
   * the music channel. Returns an `unduck` callback the caller
   * should invoke when the sting moment is over (e.g. before a
   * scene transition) to restore the music volume.
   */
  async playStingWithDuck(
    key: string,
    duckDepth = AUDIO_DEFAULTS.duckDepth,
    duckRamp = 0.3,
    unduckRamp = 0.5,
  ): Promise<() => void> {
    const stingDef = STINGS[key];
    if (!stingDef) {
      this.log(`playStingWithDuck("${key}") — unknown sting`);
      return () => {};
    }

    let buffer = this.bufferCache.get(key);
    if (!buffer) {
      buffer = await this.loadAudio(key, stingDef.url) ?? undefined;
      if (!buffer) {
        this.log(`playStingWithDuck("${key}") — failed to load`);
        return () => {};
      }
    }

    this.duck("music", duckDepth, duckRamp);
    this.log(`playStingWithDuck("${key}") — music ducked to ${duckDepth}`);

    const gainNode = this.ctx.createGain();
    gainNode.gain.value = stingDef.baseVolume;
    gainNode.connect(this.uiGain);

    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(gainNode);
    source.onended = () => {
      source.disconnect();
      gainNode.disconnect();
    };
    source.start(0);

    let restored = false;
    return () => {
      if (restored) return;
      restored = true;
      this.unduck("music", unduckRamp);
      this.log(`playStingWithDuck("${key}") — music restored`);
    };
  }

  // ── Lifecycle ────────────────────────────────────────────

  stopAll(): void {
    this.stopMusic(0.1);
  }

  dispose(): void {
    if (this._watchdogId) {
      clearInterval(this._watchdogId);
      this._watchdogId = null;
    }
    try { this._leaderChannel?.close(); } catch { /* */ }
    this._leaderChannel = null;
    this._connected = false;
    if (!this.ctx) return;
    try {
      if (this.currentMusic) {
        try { this.currentMusic.source.stop(); } catch { /* */ }
        this.currentMusic.source.disconnect();
        this.currentMusic.gain.disconnect();
        this.currentMusic = null;
      }
      this.masterGain?.disconnect();
      this.musicGain?.disconnect();
      this.sfxGain?.disconnect();
      this.uiGain?.disconnect();
      if (this.ctx.state !== "closed") {
        try { this.ctx.close(); } catch { /* */ }
      }
    } catch { /* */ }
    this.bufferCache.clear();
    this.loadingPromises.clear();
    this.activeSfxCount.clear();
  }

  // ── Debug ────────────────────────────────────────────────

  set debug(on: boolean) { this.debugEnabled = on; }
  get debug(): boolean { return this.debugEnabled; }

  private log(msg: string): void {
    const entry = `[${performance.now().toFixed(0)}ms] ${msg}`;
    console.log(`[AudioManager] ${msg}`);
    if (this.debugEnabled) {
      this.debugLog.push(entry);
      if (this.debugLog.length > 20) this.debugLog.shift();
    }
  }

  getDebugInfo(): {
    contextState: string;
    currentTrack: string;
    musicGeneration: number;
    musicGainValue: number;
    activeSfx: number;
    connected: boolean;
    heartbeatAge: number;
    interactionAge: number;
    recentLog: string[];
  } {
    let totalSfx = 0;
    for (const c of this.activeSfxCount.values()) totalSfx += c;
    const now = Date.now();
    return {
      contextState: this.ctx?.state ?? "none",
      currentTrack: this.currentMusic?.key ?? "(none)",
      musicGeneration: this.musicGeneration,
      musicGainValue: this.currentMusic?.gain.gain.value ?? 0,
      activeSfx: totalSfx,
      connected: this._connected,
      heartbeatAge: now - this._lastHeartbeat,
      interactionAge: now - this._lastInteraction,
      recentLog: [...this.debugLog],
    };
  }

  // ── Internal Helpers ─────────────────────────────────────

  private rampGain(node: GainNode, target: number, duration: number): void {
    const now = this.ctx.currentTime;
    node.gain.cancelScheduledValues(now);
    node.gain.setValueAtTime(node.gain.value, now);
    node.gain.linearRampToValueAtTime(Math.max(target, RAMP_EPSILON), now + duration);
  }

  private getChannelGain(ch: ChannelName): GainNode {
    switch (ch) {
      case "music": return this.musicGain;
      case "sfx":   return this.sfxGain;
      case "ui":    return this.uiGain;
    }
  }

  private getChannelVolume(ch: ChannelName): number {
    switch (ch) {
      case "music": return this._musicVol;
      case "sfx":   return this._sfxVol;
      case "ui":    return this._uiVol;
    }
  }
}

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}
