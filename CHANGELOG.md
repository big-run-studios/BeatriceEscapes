# Changelog

All notable changes to Bea Escapes are documented here.

Design doc versions use `D<major>.<minor>`. Build versions use `B0.<layer>.<patch>`.

---

## [D1.0] — 2026-03-21

### Design

- Initial Game Pillars & Prototype North Star document.
- 5 game pillars defined: Family-First Action, Best-in-Class Combat, Roguelite Momentum, Surprising Escape Adventure, Broad Appeal / Deep Mastery.
- 4 playable characters designed: Andrew (protector/tank), Heather (catalyst/amplifier), John (disruptor/gadgets), Luna (momentum/dog).
- Run structure: 4 biomes, Hades-style room-to-room with reward preview doors, 25-35 min runs.
- Onion development plan: 12 layers from bootable canvas to polished prototype.
- Tech stack decision: Phaser 3 + TypeScript + Vite.

## [B0.1.0] — 2026-03-21

### Build — Layer 1: A Character That Moves

- ArenaScene with belt-scrolling ground plane, depth lines, and boundary walls.
- Andrew (Player entity) as a colored rectangle with head, body, shadow, and name tag.
- 8-directional movement via InputManager: left stick / d-pad / WASD / arrows.
- Horizontal speed (300) and depth speed (200) for proper belt-scroll feel.
- Dynamic camera: follows player with 0.08 lerp smoothing and dead zone.
- Camera bounded to arena (2400x800).
- Player clamped to walkable ground area.
- Depth sorting: player renders in front of / behind based on Y position.
- Facing direction flips character on horizontal input.
- Title screen transitions to ArenaScene on CONFIRM/START press (camera fade).
- HUD: version tag and dynamic move-control hint (auto-swaps keyboard/gamepad labels).

## [B0.0.1] — 2026-03-21

### Build — Layer 0: Bootable Canvas

- Phaser 3 + TypeScript + Vite project scaffolded and running.
- Title screen with "BEA ESCAPES" title, subtitle, and version display.
- Fade-in animation on title and subtitle.
- 1280x720 game canvas with responsive scaling (FIT + center).
- GitHub Actions workflow for automatic GitHub Pages deployment.
- `.gitignore`, `tsconfig.json`, `vite.config.ts` configured.

## [B0.0.0] — 2026-03-21

### Build

- Repository initialized.
- Design doc and README committed.
- Versioning and changelog established.
