# SHADOW FALL — REBUILD PROMPT V2
## Instructions for Claude Code

---

## CRITICAL RULES — READ FIRST

1. Build this game in PHASES. Do not write everything at once.
2. After each phase, STOP and tell me "Phase X complete. Test it."
3. Each phase must be fully working before moving to the next.
4. One single HTML file. Everything inline. No external files except Phaser CDN.
5. Never truncate code. Always write the complete file.
6. If something is complex, simplify the implementation — but never skip it.
7. After writing code, review it yourself and fix obvious bugs before giving it to me.

---

## PHASE 1 — CHARACTER & MOVEMENT (Nothing else)

Build only this. Nothing more.

**What the scene looks like:**
- Pure black background (#08080D)
- Kai is a black silhouette (simple humanoid shape, drawn with Phaser Graphics)
- 4-layer parallax background (dark grey shapes, each layer slightly lighter)
- Soft warm radial light glow around Kai (Canvas composite, warm amber color)
- Falling ash particles (30 small grey dots drifting downward slowly)
- One long flat ground + 6 platforms at different heights to test movement

**How Kai moves:**
- Walk left/right with momentum (not instant — slight acceleration and deceleration)
- Variable height jump (tap = small hop, hold = full jump)
- Double jump (second jump is slightly smaller)
- Wall slide (grab wall while in air, slow fall)
- Wall jump (jump away from wall)
- Crouch (smaller hitbox, can pass under low gaps)
- Coyote time: can jump 120ms after walking off a ledge
- Jump buffer: jump input registers 150ms before landing

**Mobile controls:**
- 4 fixed buttons at bottom of screen: LEFT, RIGHT, JUMP, PULSE (pulse does nothing yet)
- Buttons are semi-transparent, 64x64px minimum, rounded corners
- Swipe up = jump (secondary)
- Buttons must not cover more than 15% of screen height

**What is NOT in Phase 1:**
- No enemies
- No story
- No menu
- No HUD
- No audio
- No collectibles

**Success criteria:**
- Movement feels smooth and responsive on mobile
- Wall jump and double jump work correctly
- Parallax moves naturally with camera
- 60fps on a mid-range phone

---

## PHASE 2 — ATMOSPHERE & AUDIO (After Phase 1 is confirmed working)

Add to Phase 1 code. Do not remove anything.

**Lighting system:**
- Dark overlay covers the entire scene
- Kai's lantern creates a radial "cut out" in the darkness (destination-in compositing)
- Lantern radius: 120px at full energy, shrinks to 40px at low energy
- Color shifts from warm amber → cool pale white as energy drops
- 3 static environmental light sources placed in the test level (smaller cutouts)

**Lantern energy:**
- Starts at 80/100
- Drains 1 unit per second passively
- At energy below 20: vignette tightens, screen desaturates slightly
- Energy bar displayed as a thin horizontal bar at top of screen (minimal, elegant)
- No way to refill yet (that comes in Phase 4)

**Particle systems:**
- Ash particles already exist — make sure they respect the darkness (they appear in lit areas only)
- Add lantern ember particles: 6 small warm dots rise from Kai's lantern position, fade out over 1.2 seconds

**Audio (Web Audio API only — no audio files):**
- Ambient drone: low sine wave (~55Hz) with slow volume oscillation
- Soft rain: white noise filtered to mid frequencies, quiet
- Footstep sounds: soft low thud, different tone for dirt vs stone platforms
- Jump sound: short gentle whoosh (sine sweep up)
- Land sound: soft thud
- Audio must NOT start until user first touches the screen (iOS requirement)

**Success criteria:**
- Darkness + lantern light creates genuine atmosphere
- Energy drains visibly
- Audio is subtle and atmospheric, not intrusive
- Still 60fps

---

## PHASE 3 — ENEMIES (After Phase 2 confirmed)

Add to existing code.

**Enemy: The Drifter (Type A)**
- Floats 50px above ground
- Slowly drifts toward Kai's position at 60px/s
- Pauses 2 seconds when Kai moves out of its 400px detection range
- Drawn as an elongated dark silhouette, slightly transparent
- Emits dark particles that drift toward Kai's light
- If it touches Kai: Kai flickers (invincibility frames for 1 second), energy drains 20 units instantly

**Enemy: The Crawler (Type B)**
- Moves along ground surfaces
- Patrols between two defined points at 80px/s
- Speeds up to 140px/s when Kai's energy is below 30
- Drawn as a low, wide dark shape

**Pulse mechanic:**
- Hold the PULSE button for 1.5 seconds to charge (visual: glow intensifies around Kai)
- Release: shockwave circle expands from Kai, pushes enemies 300px away, stuns them 3 seconds
- Costs 25 energy
- Cooldown: 4 seconds
- Sound: deep resonant boom

**Hollow proximity effect:**
- Any Hollow within 150px drains Kai's energy 3 units/second additionally
- Visual: darkness slightly pulses/breathes near Hollow

**Checkpoint:**
- Glowing stone object placed in level
- Touch to activate: stone lights up with warm glow, energy fully restored
- On death: Kai dissolves (dark particles scatter), fade to black, respawn at checkpoint
- Death must feel poetic — slow, not abrupt

**Success criteria:**
- Enemies feel threatening but not unfair
- Pulse is satisfying
- Death and respawn feels smooth
- Gameplay loop is clear: avoid, use pulse, reach checkpoint

---

## PHASE 4 — MEMORY FRAGMENTS & HUD (After Phase 3 confirmed)

Add to existing code.

**Memory Fragments:**
- 7 fragments hidden in the test level
- Drawn as small glowing origami paper cranes (geometric, elegant)
- Gentle hover animation (bob up and down 4px, 2 second cycle)
- Soft purple-white glow around them
- On collection: burst of light particles, crystal bell sound, energy +15
- Fragment counter in HUD: "◈ 3 / 7" — minimal, top right corner

**HUD (minimal, non-intrusive):**
- Top left: lantern energy bar (thin, warm amber color, 200px wide)
- Top right: fragment counter
- Both elements fade to 40% opacity when gameplay is active, full opacity when paused
- No health bar visible — Kai just flickers on damage

**Save system:**
- localStorage saves: fragments collected, checkpoint position, energy level
- Auto-saves when fragment collected and when checkpoint activated
- Loads on page refresh

**Upgrade: First lantern upgrade**
- After collecting 5 fragments total: lantern drains 20% slower permanently
- Small notification slides in from top: "Memory Restored — Lantern burns longer"

**Success criteria:**
- Fragments are satisfying to collect
- HUD is present but doesn't intrude on atmosphere
- Save persists across refresh

---

## PHASE 5 — MAIN MENU & STORY SYSTEM (After Phase 4 confirmed)

Add to existing code.

**Main Menu:**
- Full screen, atmospheric
- Kai is visible in the background, standing still, lantern glowing
- Ash particles falling
- Game title "SHADOW FALL" in elegant serif font (Playfair Display via Google Fonts CDN)
- Subtitle: "A story about what we carry" — smaller, italic
- Two buttons: PLAY and OPTIONS
- Buttons are minimal: text only, thin underline on hover/press, no boxes
- Fade transition into gameplay (1 second)

**Story System — Chapter intro:**
- Before gameplay starts: black screen, white text fades in slowly
- Chapter 1 opening text (appears word by word, typewriter style):
  "The rain doesn't make any sound here."
  "Neither does anything else."
  "But somewhere ahead — something is warm."
- After text: fade into gameplay

**In-game monologue triggers:**
- At specific X positions in the level, Kai's thoughts appear
- Text appears at bottom of screen, handwritten-style font (Caveat via Google Fonts)
- Fades in over 0.5s, stays 3 seconds, fades out
- Examples:
  - x=800: "I don't remember how I got here."
  - x=2000: "Someone left these marks. Recently."
  - x=3500: "The light ahead. It's real. I know it is."

**Chapter end scene:**
- When Kai reaches the end of the level: gameplay pauses
- Black overlay fades in
- Kai finds a torn photograph (drawn — two hands, one small one large)
- Text appears: "I don't know whose this is. But my lantern burned brighter the moment I touched it."
- Then: "Chapter 2 — Coming Soon" with a RETURN TO MENU button

**Success criteria:**
- Menu feels cinematic and premium
- Story text creates genuine emotion
- Transitions are smooth
- The whole experience feels like a real game, not a prototype

---

## PHASE 6 — POLISH & FINAL QUALITY PASS (After Phase 5 confirmed)

This phase is about making everything feel premium.

**Visual improvements:**
- Review all drawn shapes — Kai's silhouette should look like a child, not a rectangle
- Hollow silhouettes should feel organic and unsettling
- All platform edges should have slight texture variation (not perfectly uniform)
- Parallax layers should have more detail (tree shapes, rock formations)
- Lantern light should flicker slightly (subtle random radius variation ±3px)

**Animation improvements:**
- Kai: squash on land (30% shorter for 80ms), stretch on jump start
- Kai: slight lean forward when running
- Hollow: subtle breathing/pulsing animation
- Checkpoint activation: expanding ring of light

**Audio improvements:**
- Hollow proximity hum (low frequency, increases as Hollow gets closer)
- Heartbeat sound when energy below 20 (subtle, rhythmic)
- Checkpoint activation sound (warm ascending tones)
- Monologue trigger sound (very soft chime)

**Performance:**
- Object pooling for particles
- Only update enemies within 800px of Kai
- Confirm 60fps on mobile

**Mobile final checks:**
- Test on both portrait and landscape
- Safe area insets applied (notch/home bar)
- Haptic feedback working (navigator.vibrate)
- Haptics: 15ms on jump, 25ms on hard land, 100ms on death

**Final success criteria:**
- Feels like a real released game
- Someone picks it up with no instructions and understands what to do
- The atmosphere is genuinely affecting
- Performance is solid on mid-range phones
