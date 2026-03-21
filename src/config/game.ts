export const GAME_WIDTH = 1280;
export const GAME_HEIGHT = 720;

export const ARENA = {
  width: 2400,
  height: 800,
  groundY: 300,
  groundHeight: 500,
  boundaryPadding: 40,
};

export const PLAYER = {
  speed: 300,
  width: 48,
  height: 80,
  depthSpeed: 200,
};

export const JUMP = {
  height: 100,
  duration: 0.45,
};

export const COMBAT = {
  lightChain: [
    { duration: 0.3, hitFrame: 0.1, damage: 10, knockback: 80, hitstopMs: 40 },
    { duration: 0.3, hitFrame: 0.1, damage: 12, knockback: 100, hitstopMs: 50 },
    { duration: 0.4, hitFrame: 0.12, damage: 18, knockback: 200, hitstopMs: 70 },
  ],
  heavy: { duration: 0.55, hitFrame: 0.25, damage: 30, knockback: 300, hitstopMs: 100 },
  comboWindow: 0.25,
  hitRange: 70,
  hitDepthRange: 30,
  shakeIntensity: { light: 2, heavy: 5, finisher: 4 },
  shakeDuration: { light: 50, heavy: 100, finisher: 80 },
};

export const COLORS = {
  background: 0x0a0a1a,
  titleText: "#e8d5b5",
  subtitleText: "#8a7b6b",
  accent: "#c9944a",
  andrewFill: 0x3a6b8a,
  andrewOutline: 0x5a9bba,
  beaFill: 0xd4618a,
  beaOutline: 0xf08aaa,
  dummyFill: 0x5a4a3a,
  dummyOutline: 0x7a6a5a,
  dummyHit: 0xffffff,
  hpBarBg: 0x1a1a1a,
  hpBarFill: 0x44aa44,
  hpBarDamage: 0xdd4444,
  groundFill: 0x1a1a2e,
  groundLine: 0x2a2a4e,
  wallFill: 0x0f0f20,
};
