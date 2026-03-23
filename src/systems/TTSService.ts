const API_BASE = "https://api.elevenlabs.io/v1";
const MODEL_ID = "eleven_flash_v2_5";

export interface ELVoice {
  voice_id: string;
  name: string;
  category: string;
}

export type TTSState = "idle" | "loading" | "playing" | "paused" | "error";

type StateChangeCallback = (state: TTSState) => void;

const PREMADE_VOICES: ELVoice[] = [
  { voice_id: "WfP0usjHGg7rAadHaNmu", name: "Heather", category: "custom" },
  { voice_id: "Xb7hH8MSUJpSbSDYk0k2", name: "Alice", category: "narration" },
  { voice_id: "pNInz6obpgDQGcFmaJgB", name: "Adam", category: "narration" },
  { voice_id: "ErXwobaYiN019PkySvjV", name: "Antoni", category: "narration" },
  { voice_id: "nPczCjzI2devNBz1zQrb", name: "Brian", category: "narration" },
  { voice_id: "N2lVS1w4EtoT3dr4eOWO", name: "Callum", category: "video games" },
  { voice_id: "XB0fDUnXU5powFXDhCwa", name: "Charlotte", category: "video games" },
  { voice_id: "onwK4e9ZLuTAKqWW03F9", name: "Daniel", category: "news" },
  { voice_id: "AZnzlk1XvdvUeBnXmlld", name: "Domi", category: "narration" },
  { voice_id: "ThT5KcBeYPX3keUQqHPh", name: "Dorothy", category: "children's stories" },
  { voice_id: "LcfcDJNUP1GQjkzn1xUU", name: "Emily", category: "meditation" },
  { voice_id: "jsCqWAovK2LkecY7zXl4", name: "Freya", category: "narration" },
  { voice_id: "jBpfuIE2acCO8z3wKNLl", name: "Gigi", category: "animation" },
  { voice_id: "z9fAnlkpzviPz146aGWa", name: "Glinda", category: "video games" },
  { voice_id: "oWAxZDx7w5VEj9dCyTzz", name: "Grace", category: "audiobook" },
  { voice_id: "TxGEqnHWrfWFTfGW9XjX", name: "Josh", category: "narration" },
  { voice_id: "pFZP5JQG7iQjIQuC4Bku", name: "Lily", category: "narration" },
  { voice_id: "XrExE9yKIg1WjnnlVkGX", name: "Matilda", category: "audiobook" },
  { voice_id: "piTKgcLEGmPE4e6mEKli", name: "Nicole", category: "audiobook" },
  { voice_id: "21m00Tcm4TlvDq8ikWAM", name: "Rachel", category: "narration" },
  { voice_id: "EXAVITQu4vr4xnSDxMaL", name: "Sarah", category: "news" },
  { voice_id: "pMsXgVXv3BLzUgSXRplE", name: "Serena", category: "interactive" },
];

export class TTSService {
  private apiKey: string;
  private voices: ELVoice[] = PREMADE_VOICES;
  private selectedVoiceIndex = 0;
  private audioCtx: AudioContext | null = null;
  private sourceNode: AudioBufferSourceNode | null = null;
  private currentBuffer: AudioBuffer | null = null;
  private pauseOffset = 0;
  private startTime = 0;
  private _state: TTSState = "idle";
  private cache = new Map<string, ArrayBuffer>();
  private onStateChange: StateChangeCallback | null = null;
  private abortController: AbortController | null = null;

  constructor() {
    this.apiKey = import.meta.env.VITE_ELEVENLABS_API_KEY ?? "";
    console.log(`[TTS] configured=${this.isConfigured}, voices=${this.voices.length}, ready=${this.isReady}`);
  }

  get isConfigured(): boolean {
    return this.apiKey.length > 0;
  }

  get isReady(): boolean {
    return this.isConfigured && this.voices.length > 0;
  }

  get state(): TTSState {
    return this._state;
  }

  get selectedVoice(): ELVoice | null {
    return this.voices[this.selectedVoiceIndex] ?? null;
  }

  get voiceList(): ELVoice[] {
    return this.voices;
  }

  setStateCallback(cb: StateChangeCallback): void {
    this.onStateChange = cb;
  }

  private setState(s: TTSState): void {
    this._state = s;
    this.onStateChange?.(s);
  }

  selectVoiceByIndex(index: number): void {
    if (index >= 0 && index < this.voices.length) {
      this.selectedVoiceIndex = index;
    }
  }

  selectVoiceByName(name: string): void {
    const idx = this.voices.findIndex(
      (v) => v.name.toLowerCase() === name.toLowerCase()
    );
    if (idx >= 0) this.selectedVoiceIndex = idx;
  }

  cycleVoice(direction: 1 | -1): ELVoice | null {
    if (this.voices.length === 0) return null;
    this.selectedVoiceIndex =
      (this.selectedVoiceIndex + direction + this.voices.length) %
      this.voices.length;
    return this.selectedVoice;
  }

  async speak(text: string, entryId: string): Promise<void> {
    if (!this.isConfigured || !this.selectedVoice) return;

    this.stop();
    this.setState("loading");

    const voice = this.selectedVoice;
    const cacheKey = `${entryId}::${voice.voice_id}`;

    try {
      let audioData: ArrayBuffer;

      if (this.cache.has(cacheKey)) {
        audioData = this.cache.get(cacheKey)!;
      } else {
        this.abortController = new AbortController();
        const res = await fetch(
          `${API_BASE}/text-to-speech/${voice.voice_id}`,
          {
            method: "POST",
            headers: {
              "xi-api-key": this.apiKey,
              "Content-Type": "application/json",
              Accept: "audio/mpeg",
            },
            body: JSON.stringify({
              text,
              model_id: MODEL_ID,
              voice_settings: { stability: 0.5, similarity_boost: 0.75 },
            }),
            signal: this.abortController.signal,
          }
        );

        if (!res.ok) {
          const errText = await res.text();
          throw new Error(`TTS API error ${res.status}: ${errText}`);
        }

        audioData = await res.arrayBuffer();
        this.cache.set(cacheKey, audioData);
      }

      if (!this.audioCtx) {
        this.audioCtx = new AudioContext();
      }

      this.currentBuffer = await this.audioCtx.decodeAudioData(
        audioData.slice(0)
      );
      this.pauseOffset = 0;
      this.playBuffer();
    } catch (e: unknown) {
      if (e instanceof DOMException && e.name === "AbortError") {
        this.setState("idle");
        return;
      }
      console.error("TTS speak error:", e);
      this.setState("error");
    }
  }

  private playBuffer(): void {
    if (!this.audioCtx || !this.currentBuffer) return;

    this.sourceNode = this.audioCtx.createBufferSource();
    this.sourceNode.buffer = this.currentBuffer;
    this.sourceNode.connect(this.audioCtx.destination);
    this.sourceNode.onended = () => {
      if (this._state === "playing") {
        this.setState("idle");
        this.pauseOffset = 0;
      }
    };

    this.startTime = this.audioCtx.currentTime;
    this.sourceNode.start(0, this.pauseOffset);
    this.setState("playing");
  }

  pause(): void {
    if (this._state !== "playing" || !this.audioCtx || !this.sourceNode) return;
    this.pauseOffset += this.audioCtx.currentTime - this.startTime;
    this.sourceNode.onended = null;
    this.sourceNode.stop();
    this.sourceNode = null;
    this.setState("paused");
  }

  resume(): void {
    if (this._state !== "paused" || !this.currentBuffer) return;
    this.playBuffer();
  }

  togglePlayPause(text: string, entryId: string): void {
    console.log(`[TTS] togglePlayPause state=${this._state}, voice=${this.selectedVoice?.name}, text=${text.substring(0, 40)}...`);
    switch (this._state) {
      case "idle":
      case "error":
        this.speak(text, entryId);
        break;
      case "playing":
        this.pause();
        break;
      case "paused":
        this.resume();
        break;
    }
  }

  stop(): void {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
    if (this.sourceNode) {
      this.sourceNode.onended = null;
      try {
        this.sourceNode.stop();
      } catch {
        /* already stopped */
      }
      this.sourceNode = null;
    }
    this.currentBuffer = null;
    this.pauseOffset = 0;
    this.setState("idle");
  }

  destroy(): void {
    this.stop();
    if (this.audioCtx) {
      this.audioCtx.close();
      this.audioCtx = null;
    }
    this.cache.clear();
  }
}
