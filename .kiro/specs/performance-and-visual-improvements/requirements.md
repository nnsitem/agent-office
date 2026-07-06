# Requirements: Performance & Visual Improvements

## Overview
Upgrade the Agent Office pixel-art dashboard with a high-performance rendering pipeline and rich visual effects — ambient life, lighting, particles, and expressive sprites — while maintaining the existing Gather-town aesthetic. The performance work creates headroom so effects can stack without frame drops. Effects auto-scale on lower-end hardware.

## Context
- Canvas 2D at 480×320 internal resolution, 3× scaled
- Zero runtime dependencies today; a small focused library (tweening/easing) is acceptable
- Current renderer redraws everything every frame with no dirty-region or idle-frame optimization
- `watchTree` rescans directories recursively every 2s with `readdirSync`
- Single hardcoded 30×20 tile layout, 4 rooms max

## Requirements

### 1. Rendering Performance

#### 1.1 Dirty-Region Tracking
When no character moves and no animation frame advances, the renderer must skip the draw call entirely. When only a subset of the scene changes, only the affected region should be redrawn over the cached background.

**Acceptance Criteria:**
- When all characters are stationary and no animations are active, zero draw calls are issued to the canvas context between frames.
- When a single character moves, only the bounding rectangle covering its old and new position (plus bubble/name) is redrawn — not the full canvas.
- Background tilemap is never re-rendered unless the window resizes.

#### 1.2 Frame Throttling on Idle
When the scene is completely idle (no walking, no active animations, no state changes), the render loop should drop to a low tick rate (e.g. ≤4 fps) and resume full speed on the next state change or mouse interaction.

**Acceptance Criteria:**
- After 2 seconds of zero visual change, `requestAnimationFrame` callbacks are gated to fire at most 4 times per second.
- Any incoming SSE event, mouse hover, or animation trigger immediately resumes 60fps rendering.
- CPU usage when idle drops by at least 80% compared to the current always-render loop.

#### 1.3 Stationary Character Update Skip
Characters that are at their desk and not walking should not have their `update(dt)` called every frame. Only characters with active path segments or active animations need per-frame updates.

**Acceptance Criteria:**
- `Character.update(dt)` is only called when `this.path.length > 0` or an animation is actively playing (e.g. idle bob, typing bounce).
- Characters in `atDesk` phase with status `idle` consume zero per-frame compute.
- Walking characters still update at full frame rate with smooth movement.

#### 1.4 Server-Side File Watching Optimization
Replace the recursive `readdirSync` polling with efficient event-driven watching where available, falling back to targeted polling of only known session files.

**Acceptance Criteria:**
- On native macOS/Linux, `fs.watch` with `recursive: true` is the primary notification source; polling is a fallback, not the default path.
- Poll interval for the fallback can be extended to 5s without missing events when `fs.watch` is active.
- Inside Docker (where `fs.watch` events may not propagate), polling continues at 2s but only stats known session files — not a full recursive directory walk.
- CPU usage of the watcher thread drops measurably when fewer than 5 active sessions exist.

### 2. Ambient Life Animations

#### 2.1 Monitor Flicker
Laptop screens on desks should have a subtle animation — a periodic brightness flicker or scrolling content effect that makes the office feel alive even when no characters are present.

**Acceptance Criteria:**
- Each desk's laptop screen cycles through 2–3 brightness/color states on a randomized timer (1–4s per state).
- Flicker timing is offset per desk so they don't all change in sync.
- The effect is drawn only in the desk's tile area (no full-scene redraw).

#### 2.2 Plant Sway
Potted plants should have a gentle 1–2 pixel oscillation to simulate air movement.

**Acceptance Criteria:**
- Plant leaf pixels shift ±1px horizontally on a slow sine wave (period 3–5s).
- Each plant has a randomized phase offset so they don't sway in unison.
- Sway is paused when the frame throttle is active (idle mode) to avoid waking the render loop for cosmetic-only animation.

#### 2.3 Water Cooler / Ambient Particles
One or two ambient particle sources (water cooler bubbles, or floating dust motes) add subtle life to the corridors.

**Acceptance Criteria:**
- At least one ambient particle emitter exists in the corridor or shared space.
- Particles are small (1–2px), few (≤10 active), and rendered to the world canvas at internal resolution.
- Particle system is disabled entirely when graceful degradation triggers low-performance mode.

### 3. Lighting & Atmosphere

#### 3.1 Desk Lamp Glow
Each occupied desk should have a soft circular light pool (radial gradient or dithered circle) beneath/around the desk area, giving a warm cozy feel.

**Acceptance Criteria:**
- A soft-edged circle of light (warm tone, ~32px radius at internal res) is rendered around occupied desks.
- Empty desks have no glow (or a much dimmer glow).
- The light layer is composited on top of the background but below characters and UI elements.

#### 3.2 Day/Night Ambient Tint
The overall scene should have a subtle ambient color tint that shifts over time (or based on local clock) — warmer at night, cooler during the day.

**Acceptance Criteria:**
- A full-canvas overlay tint shifts between cool blue (day) and warm amber (night) based on the local system clock hour.
- The tint is subtle (opacity ≤15%) and doesn't obscure readability of names, bubbles, or status indicators.
- Transition between day/night is gradual (eased over simulated minutes, not a hard switch).

#### 3.3 Character Status Glow
Working characters emit a subtle colored glow matching their source color (orange for Claude, purple for Kiro, etc.) to make active agents visually prominent.

**Acceptance Criteria:**
- Characters in `working` status have a soft 4–6px glow in their source color rendered behind the sprite.
- Characters in other statuses have no glow (or a very dim version).
- Glow intensity can be animated (gentle pulse) without triggering full-scene redraws.

### 4. Richer Sprites & Animations

#### 4.1 Idle Fidget Animations
Characters sitting at desks in `working` or `thinking` status should have subtle idle animations — head bob, typing motion, or shifting in place.

**Acceptance Criteria:**
- At least 2 additional sprite frames exist for seated characters (e.g. "typing1", "typing2" or "lean").
- Working characters cycle through typing frames at ~4fps.
- Thinking characters have a distinct fidget (e.g. head tilt or slow bob) at ~2fps.
- Idle/sleeping characters remain on the static `sleep` frame.

#### 4.2 Expressive Reactions
When agent status changes (e.g. working → waiting), the character plays a brief transition animation or emote.

**Acceptance Criteria:**
- A status transition triggers a 0.3–0.5s reaction animation (e.g. a small jump for "waiting", a settling motion for "idle").
- Reactions are non-blocking — they play over the normal sprite without interrupting pathfinding.
- At most one reaction animation plays per character at a time (new transitions override in-progress ones).

#### 4.3 Smooth Walk Easing
Character movement between waypoints should use easing (ease-in-out) rather than linear interpolation for more natural-feeling motion.

**Acceptance Criteria:**
- Walk speed accelerates from rest and decelerates approaching the next waypoint.
- The overall travel time between waypoints is within 10% of the current linear version (feels similar pace, just smoother).
- Easing function is configurable (a tiny tweening lib is acceptable for this).

### 5. Particle Effects

#### 5.1 Typing Sparkles
Characters in `working` status with tool-use activity emit small sparkle particles near their desk area.

**Acceptance Criteria:**
- 3–5 small (1–2px) bright particles emit from the desk area when a character is `working`.
- Particles drift upward and fade out over ~1s.
- Particle color matches the character's source color (dimmed/pastel variant).
- Sparkles are disabled when graceful degradation is active.

#### 5.2 Thinking Dots
Characters in `thinking` status have 2–3 dots that float/orbit near their head (in addition to or replacing the "·" bubble text).

**Acceptance Criteria:**
- 2–3 small dots orbit or float above the character's head in an elliptical path.
- Dots are rendered at world resolution (pixel-art scale) and match the character's source color.
- The dot animation loops smoothly and doesn't conflict with the existing "…" speech bubble.

#### 5.3 Arrival/Departure Poof
When a character spawns at the door or despawns after leaving, a small poof of particles plays.

**Acceptance Criteria:**
- A burst of 5–8 particles (1–2px, fading) plays at the door position when a character enters or exits.
- The poof animation lasts ~0.5s and clears itself.
- Particle count respects graceful degradation settings.

### 6. Graceful Degradation

#### 6.1 Performance Auto-Detection
The renderer should measure actual frame times and automatically reduce visual complexity if frames consistently exceed 16ms.

**Acceptance Criteria:**
- Frame time is sampled over a rolling 60-frame window.
- If average frame time exceeds 16ms for 2 consecutive windows, the renderer enters "reduced" mode.
- If frame time drops below 12ms for 2 consecutive windows in reduced mode, it attempts to restore full effects.
- The system never oscillates (flaps) between modes faster than once per 5 seconds.

#### 6.2 Tiered Effect Levels
Visual effects should be grouped into tiers that can be independently disabled:
- **Tier 1 (always on):** dirty-region rendering, frame throttling, character animations
- **Tier 2 (first to reduce):** particles, ambient animations (plant sway, monitor flicker)
- **Tier 3 (optional):** lighting/glow effects, day/night tint, status glow

**Acceptance Criteria:**
- In reduced mode, Tier 2 effects are disabled first; if still over budget, Tier 3 follows.
- Core rendering (characters, bubbles, names, status icons) always runs at full quality.
- A user can manually force a tier via a URL param (e.g. `?fx=1` for tier-1-only) for debugging.

### 7. Implementation Constraints

#### 7.1 Zero-Breaking-Change to Existing Features
All existing functionality (character rendering, room assignment, speech bubbles, status overlays, side panel, detail cards, SSE transport) must continue working identically.

**Acceptance Criteria:**
- All existing visual elements render at the same positions and sizes.
- SSE event protocol remains unchanged.
- `?ff=` fast-forward parameter still works for screenshot tooling.
- `DEMO=1` mode still populates the office with test agents.

#### 7.2 Dependency Budget
At most one small client-side library may be added (e.g. a tweening/easing utility). No bundler, no build step, no transpilation.

**Acceptance Criteria:**
- Any added library is ≤5KB minified and served as a single JS file.
- The project continues to work with `npm start` and no build step.
- The library is vendored (committed directly) rather than fetched from a CDN.

#### 7.3 No External Assets
All visual content (sprites, particles, lighting maps) must remain defined in code — no image files, no spritesheets, no asset loading.

**Acceptance Criteria:**
- No new image files (png, jpg, svg, etc.) are added to the project.
- All new visual elements are defined as code (pixel arrays, procedural generation, or canvas drawing commands).
- The project continues to work offline with zero network requests after initial page load.
