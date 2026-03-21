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

## [B0.3.0] — 2026-03-21

### Build — Layer 3: Combo Tree, Projectiles, and Jump Tuning

- **Branching combo trie** replaces flat combo chain. 10 distinct moves from mixing Square (L) and Triangle (H) inputs: L, LL, LLL, LLLL, H, HH, HHH, LH, HL, LLH, HHL, LLLH.
- **Bea's wind shots** — all L-route attacks spawn projectile wind balls from Bea's position. Small balls for L/LL/LLL, medium charged ball for LLLL finisher.
- **Andrew's haymakers** — H-route attacks are melee punches with big knockback and hitstop. Visual squash/stretch and head lunge.
- **Mixed combos** — LH (Andrew uppercut), HL (Bea shoulder burst: 3 rapid-fire wind balls), LLH (Andrew slam), HHL (Bea magic finisher: gold blast projectile), LLLH (Bea toss: Bea launches off Andrew's shoulders as a projectile, returns after impact).
- **HHH Bull Rush** — Andrew charges forward at 450px/s for 0.35s, hitting everything in the path.
- **LLLH Bea Toss** — Bea disappears from shoulders, fires as a pink projectile, returns after 0.5s. High damage, huge knockback.
- **Projectile system** — new `Projectile` entity with travel, trail VFX, range limit, fade-on-destroy, and per-projectile collision with dummies.
- **Projectile impact VFX** — colored ring burst + white flash on projectile hits, distinct from melee impact flash.
- **Jump tuning** — height increased to 180 (from 100), duration to 0.7s (from 0.45s). Floatier, more heroic arc.
- **Visual poses per move** — 9 distinct animation poses driven by combo trie data: bea-cast, bea-big-cast, bea-burst, bea-finisher, bea-toss, andrew-punch, andrew-slam, andrew-rush, andrew-uppercut.
- **Combo display HUD** — current combo ID shown on screen during attacks, fades out on return to idle.
- **Data-driven combat** — all combo data lives in `COMBO_TREE` config. Adding moves requires zero code changes.

## [B0.2.0] — 2026-03-21

### Build — Layer 2: A Character That Attacks

- **Bea on Andrew's shoulders:** pink figure sitting on Andrew, she leans forward to deliver light attacks and the combo finisher. Andrew delivers heavy attacks. Visual identity established.
- **PS5 controller layout:** Square = light attack (Bea), Triangle = heavy (Andrew), X = jump, Circle = block. All labels use PlayStation naming.
- **3-hit light combo chain** with buffered input — Bea swings from the shoulders.
- **Heavy attack** — Andrew's big swing with longer windup and bigger impact.
- **Jump** — belt-scroll hop with gravity arc. Reduced air movement. Shadow shrinks during airtime.
- **Training dummies** — 3 hittable targets with HP bars, hitstun shake, knockback physics, white flash on hit, death + auto-respawn after 1.5s. Delayed HP drain bar (red behind green).
- **Hit detection** — player attacks connect with dummies based on range and depth proximity. Impact flash at hit point.
- **Hit-feel pipeline:** hitstop freeze frames, camera screenshake (scaled by attack weight), swing arc VFX, impact flash.
- **Combat state machine:** idle/walk/light1-3/heavy/jump/hitstop states.
- **HUD:** shows move, attack, heavy, and jump controls with auto-swapping labels.

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
