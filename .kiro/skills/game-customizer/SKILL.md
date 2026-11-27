---
name: game-customizer
description: Customizes the Robo Runner game in this repo (for deep guard-AI work prefer npc-ai-expert). Use when the user wants to change game mechanics (movement, digging, pits, lives, scoring, difficulty), visual style (sprites, floor materials, backgrounds, portal, particles), UI (HUD, title/pause/options menus, screens), NPC guard AI (targeting, speed, behaviour), or to add new tools/pickups. For a whole new scenery+music+level theme, use the theme-builder skill instead.
---

# Game customizer for Robo Runner

TypeScript + Canvas + Vite, no runtime dependencies. All game rules are pure TypeScript with no DOM access, so they are unit-tested in Node. Rendering and audio are not unit-tested: check them with screenshots.

## Map of the code

| Area | Files |
| --- | --- |
| Tunable numbers | `src/game/config.ts` (`CFG`, tile/grid sizes), `src/game/difficulty.ts` (per-level scaling incl. guard awareness radius, endless mode) |
| Rules and simulation | `src/game/world.ts` (everything that happens in a level), `src/game/movement.ts` (walk, climb, fall, zip, pit), `src/game/pathfinding.ts` (BFS used by guards and by the level-fairness tests) |
| Levels | `src/levels/levels.ts` (hand-made ASCII maps), `src/levels/generator.ts` (seeded generator + `profileFor`), `src/levels/all.ts` (the 60 levels) |
| Scenes, input, saving | `src/core/game.ts` (state machine glue, menus, ending), `src/core/flow.ts` (lives, score, scene states), `src/core/input.ts`, `src/core/settings.ts`, `src/core/progress.ts`, `src/core/stats.ts`, `src/core/debug.ts` (debug panel) |
| Drawing | `src/render/renderer.ts` (all screens, HUD), `sprites.ts` (generated pixel art), `backgrounds.ts` (scenery), `surfaces.ts` (floor materials), `particles.ts`, `assets.ts` (swappable asset interface) |
| Sound | `src/audio/sfx.ts` (effects), `music.ts` (player), `tracks.ts` (songs) |
| Web app, SEO | `src/pwa.ts` (service-worker registration, install prompt behind the title-menu INSTALL APP item), `vite.config.ts` (generates `dist/sw.js` from `pwa/sw.template.js`), `public/` (icons, manifest, preview card, robots, sitemap), meta tags in `index.html`, generators in `scripts/` |
| Tests | `tests/*.test.ts`, helpers in `tests/helpers.ts` (`makeWorld`, `run`, `tick`) |

## Workflow for any change

1. **Classify** the request into one or more areas below, and restate the plan in 3-5 lines. If it is ambiguous in a way that changes the design (for example "make guards smarter": how?), ask one short question first.
2. **Read the current code** of every file you will touch. The files are reformatted by the user's tooling (double quotes, trailing commas), so never patch from memory. Use `str_replace` after reading, or a script that asserts its anchor text exists.
3. **Edit.** After any scripted multi-step edit that fails midway, run `npx tsc --noEmit` and grep to see which edits applied before retrying.
4. **Add or update tests** for logic changes (rules, AI, tools, difficulty, saving). Visual-only changes need no unit test, but still need a screenshot.
5. **Verify:** `bash .kiro/skills/game-customizer/scripts/verify.sh` (type check, tests, production build, cleans `dist`).
6. **Look at it** for anything visible: `bash .kiro/skills/game-customizer/scripts/shot.sh "<query>" /tmp/x.png`, then open the image. It reuses the dev server on :5173 (Vite refuses a second one); if none is running, start `npm run dev` in the background.
7. **Docs:** keep `README.md` in sync (controls, rules, tool table, level legend, difficulty table) and, if you changed conventions, the skills' text.
8. **Clean up** `/tmp` screenshots and specs. Never leave `dist/`.
9. **Report** briefly: what changed and where, what was verified (tsc, test count, build, screenshot), and what you could not verify (sound is never audible in headless runs; feel and balance need hand-playing).

## Dev shortcuts (URL query on the dev server)

| Query | Effect |
| --- | --- |
| `?level=14` | start directly in level 14 |
| `&debug` | open the debug panel (also `` ` `` or F2): guards on/off, invincible, sound/music, jump level, give tool |
| `&tool=bomb&use` | put a tool in hand, `&use` fires it immediately |
| `&collect` | collect all gold (opens the exit portal) |
| `&pause` / `&pause=options` | open the pause menu / its options |
| `?ending`, `?ending=results`, `?ending=credits` + `&at=7` | preview the finale starting 7 s in |

Headless screenshots barely advance animations; `&at=` and the shortcuts above are how you reach states you cannot click to.

## Mechanics

- **Numbers first.** Speeds are tiles per second, durations seconds, all in `CFG` (`config.ts`). Many requests ("a bit slower", "pits stay longer") are one-line changes. Remember that the hero's speed changes the feel of every level, and generated levels depend only on the seed, so tweaking `CFG` does not regenerate them.
- **Per-level scaling** lives in `difficulty.ts` (`guardSpeed`, `guardEscape`, `pitOpen`, `guardRespawn`, `stars`). `World` reads `this.diff`; `NEUTRAL` equals the `CFG` values, which is why tests that build a `World` directly see plain `CFG` numbers. Keep `NEUTRAL` consistent with `CFG`.
- **Laser targeting:** `tryDig` picks the first cell outside the hero's body footprint on the chosen side (a full-tile-wide body between two cells covers both), so it works at any sub-cell position and cannot dig under his feet. Do not reintroduce alignment requirements.
- **Rules** are in `world.ts`: `update` orders everything (timers, pits, hero, hazards, guards, traps, pickups, collisions, exit). Digging is `tryDig`, pits `updatePits` and `bury`, guard behaviour `updateGuards`, hero death `killHero` (respects the debug invincible flag; new lethal hazards must go through it).
- **Movement** is tile-based with fractional positions: `movement.ts` `stepCharacter` with modes `ground | fall | zip | pit`. Ladder tops count as floor, ropes and zips are "hang" cells. A pit holds a guard on any floor, but the hero falls through a pit unless there is solid ground below. Do not change these rules without re-running the level-fairness tests (`tests/levels.test.ts`), because they use the same graph (`pathfinding.ts` `forEachNeighbor`). If you change what a character can reach (new movement, new terrain), update `forEachNeighbor` too.
- **Lives, score and scenes**: `core/flow.ts` (`GameFlow`, `FlowState`). New scene states need handling in `Game.update`, `Game.draw` and `Game.updateMusic`.
- **Determinism:** world and generator logic must not use `Math.random`. Only visual effects (particles, fireworks) in `Game` may.
- Add tests in `tests/gameplay.test.ts` using `makeWorld({ 14: "P..G", 15: "#".repeat(28) })`, then `run(w, seconds, input)` / `tick(w, input)`. Events are queued in `w.events` and are only drained by `Game`, so tests can assert on them.

## Style (look and feel)

- **Tile size is 20x20**, nearest-neighbour scaling, no smoothing. All art is generated in code; real art can replace it by implementing `AssetProvider` (`assets.ts`).
- **Sprite keys:** `buildSprites()` in `sprites.ts` registers every sprite (`hero|herogold|guard.<pose>.<frame>`, `tile.<style>.top|mid`, `tile.stone|armor|ladder|rope|zipR|zipL`, `gold.0-3`, `diamond.0-3`, `item.<tool>`). A missing key throws `Missing sprite: ...` at runtime, not at compile time, so always load the screen after adding sprites. Use `rng(seed)` for any randomness.
- **Floors:** add a theme's material in `surfaces.ts` (`THEME_SURFACE`, `PIT_COLORS`, `GROUND_STYLES`), draw function in `sprites.ts`. Diggable and undiggable floors must always look clearly different.
- **Scenery:** `backgrounds.ts` (`DRAW` record, helpers `sky`, `silhouette`, `column`, `bricks`, `tri`, `disc`). For a full theme use the theme-builder skill.
- **Portal exit:** `Renderer.drawDoor` (procedural, closed vs open). Characters: palettes `HERO`, `GUARD`, `GOLDEN` and `drawCharacter` poses in `sprites.ts`.
- **Draw order** is in `Renderer.drawPlay`: background, tiles, pits, portal, pickups, devices (glue, traps), guards, hero, bombs, smoke, beam, particles, flash. Anything the hero or a guard can stand on top of must be drawn after the characters, or it is invisible (this bit the bomb).
- **Effects:** `Particles.burst(x, y, count, colors, speed, gravity, life)`; hook them to events in `Game.onEvent`. Screen shake/flash are `renderer.shake` / `renderer.flash`.
- Keep contrast high enough that ladders, coins and the hero stay readable against every background.

## UI

- **HUD** (`Renderer.drawHud`): the canvas is 560 px wide and the bar is already full (score 8, lives 150, level 270, gold 360, gems 420, tool 490, slot 524, timers 548). Adding an element means re-laying it out, or putting it at the bottom-left of the play field like the smoke shield.
- **Menus** are lists of `{id, label}` in `Game`: `mainEntries()` (title; add the id to `MainId` and the `switch` in `updateTitle`), `PAUSE_ITEMS` + `updatePause()` (pause), `optionItems()` + `handleOptions()` (shared by both; the item count is passed to `menu.reset(n)` in two places, update both). Drawing is `drawTitle`, `drawPanel` and `drawMenuItems`.
- **Saved data** (`settings.ts`, `progress.ts`): a new key needs a default, validation in `load*`, and a test in `tests/menu.test.ts` / `tests/ending.test.ts`. Never store scores (the user plans a backend for that).
- **Input** (`core/input.ts`): `take()` consumes a press, `isDown()` is held. Call `input.clearPressed()` when switching screens so old presses do not leak. Show key hints on screen when adding keys, and update the title footer and README controls table.
- **Audio unlock:** browsers block sound until a gesture; the game already unlocks on the first key/click and shows a hint. Do not try to bypass it.
- **Ending** (`updateEnding`, `drawVictory`, `drawResults`, `drawCredits`) and credits text (`CREDITS` in `renderer.ts`): credits are "Brought to you by Luka Kancheli, github.com/l-u-k-a".

## NPC (guard) AI

For anything beyond a one-line tweak to the guards, use the **npc-ai-expert** skill: it has the rules the user has asked for, the full AI map, a census and trace probe, and the catalogue of AI bugs already fixed here.

- **Patrol vs chase:** each guard has a `GuardBrain` (`alert`, `home`, `dir`, `wait`). `updateAwareness` sets `alert` when the hero is within `diff.aggro` (columns + 3 x floors) and clears it beyond `aggro + CFG.aggroHysteresis`. Not alert means `patrolInput`: sweep `patrolRange(home)` (the standable cells on the home row, up to the next wall or gap) at `CFG.patrolSpeed`, pausing `CFG.patrolPause` at each end, and walk home first if displaced. Alert rules (`updateAwareness`, any one is enough): the hero is on a higher floor than the guard (always, any distance); the guard has already climbed above its post and the hero is not below that floor; the hero is within `CFG.closeChase` (4.5 tiles, any floor); or he is within `diff.aggro` and not below the guard's home row. A guard never follows a hero who is farther away and on a lower floor (not lured downstairs). A visible decoy always counts as alert too. Limits have hysteresis. A patrolling guard can walk into the close range on its own, so test setups should put the hero on the side the guard sweeps away from.
- **Chasing upwards:** `climbInput` paths to the nearest standable cell on the hero's floor (`nextStepToNearest` in `pathfinding.ts`), so the guard takes the closest way up and then the normal chase takes over. The goal is fixed by the hero's floor, never by the guard's own row: a goal of "one floor above me" made guards loop when the route went down first, and rounding a guard's row mid-ladder flipped its decisions every tick. Use `floorRow(c)` (the row below its feet while climbing) whenever you need the floor a character is on. A chasing guard also never takes a downward detour around another guard when the direct route does not go down; it queues and, after `CFG.holdPatience`, walks through.
- The all-levels test `guards never end up stranded or jammed` parks the hero on the exit floor for 45 s and fails if any guard with a way up has not arrived; run it after any AI change. Tests that put a guard far from the hero must either move it inside the radius or expect patrol behaviour.
- **Targeting** is `World.guardTarget(g, idx)`: roles by `idx % 4` (chaser, ambusher, flanker, door warden) with a direct attack inside 4 tiles, and decoys with line of sight override everything. New behaviours usually mean a new role or a change to this function.
- **Movement decisions** are `guardInput`: BFS (`nextStep`) over cells with other guards' cells blocked, a `reserved` set for the steps already claimed this tick, and queueing instead of overlapping when no free route exists. BFS runs per guard per tick, so keep it cheap.
- **Speed:** `PACE` per guard, times `diff.guardSpeed`; glue multiplies by `CFG.glueSlow`. Anything that stops a guard acting goes through `disabled(g)` (`stun` for shock/EMP, `cough` for smoke), which is also what makes them harmless to touch.
- **Pits and respawn:** `updateGuards`, `climbOut`, `respawnGuard`. A guard's escape timer pauses while the hero stands on his head.
- **Guard platforms:** `src/levels/patrol.ts` (`patrolIssues`) checks every guard's patrol platform: at least 4 cells, enough ways off it, at least 2 diggable floor cells. The generator rejects layouts that fail it and `tests/levels.test.ts` runs it over all levels, hand-made included. If you add guards to a level by hand, fix issues by adding ground patches under all-stone floors or ladders to the platform.
- **Difficulty of generated levels** is `profileFor(t)` in `generator.ts` (guard count, gold, gaps, ladders, stone). Changing it changes every generated level; the tests re-verify fairness.
- A genuinely new enemy type needs: a map character in `level.ts`, a `Char` kind or flag, palette and sprites, AI role, collision rules in `checkHeroHit`, respawn handling, generator placement, and tests. Propose the design to the user before building it.
- Test AI with `makeWorld`, put guards and the hero at known cells, `run(...)`, and assert positions or distances. Never assert exact paths, assert outcomes (reached, did not overlap, stayed apart).

## Adding a tool (checklist, in order)

Tools are single-slot pickups; Space/C uses the held one. The three most recent (smoke bomb, glue, bomb) followed exactly this list:

1. `src/game/types.ts`: add the id to `ToolKind`.
2. `src/game/level.ts`: map character in `ITEM_CHARS`. Taken so far: `. # @ H - > < * $ V P G E S D M B O U X` and space.
3. `src/game/config.ts`: constants (durations, radii, slowdowns).
4. `src/game/world.ts`: add event names to `EventType`; state fields; a `case` in `useTool()` (return early *before* the tool is consumed when it cannot be used, for example not standing on ground); per-tick logic in `update` / `updateHazards`; effects on guards via `disabled()`, or on the hero via a timer. Lethal effects must call `killHero()`/`killGuard()`.
5. `src/game/movement.ts`: only if a character needs new per-character state (a field on `Char` plus `newChar`).
6. `src/render/sprites.ts`: a branch in `itemSprite` and the id in the loop list in `buildSprites`.
7. `src/render/renderer.ts`: draw the placed object or effect in the right place in the draw order; HUD hint if it has a timer.
8. `src/audio/sfx.ts`: names in `SfxName` and a `case` in `play`. `src/core/game.ts`: map events in `EVENT_SFX` and add particles/shake in `onEvent`.
9. `src/core/debug.ts`: add to `ALL_TOOLS` (shows in the "Give tool" dropdown).
10. `src/levels/generator.ts`: add the character to the tool list in `populate` (this changes the random streams, so generated levels change; the tests re-check fairness). Place it in a couple of hand-made levels (`levels.ts`, on a stand cell with floor below) and update the legend comment there.
11. Tests in `tests/gameplay.test.ts`: parse of the new character; use consumes it (and does not when invalid); the effect and its expiry; interaction with guards and the hero; debug-invincible still holds for lethal effects.
12. Docs: README tool table and map legend; the theme-builder skill's character list.

Design rules for tools: every effect must be bounded in time or area, must not be able to soft-lock a level (permanent walls, unreachable gold), must give feedback (sound, particles, visible state), and should not make guards useless or the hero unkillable for long. Describe the balance assumptions to the user.

## Pitfalls collected from earlier work

- Service worker: it only runs in production builds, so test it with `npm run build && npx vite preview`, not the dev server. The template's `__VERSION__`/`__PRECACHE__` placeholders must appear only in code (the build fails if one is left). Adding a file that the game needs at runtime means nothing extra (everything in `dist/` is precached except the files in `SKIP`), but a file only for crawlers or sharing should go in `SKIP`.

- Overlap rules must match what is drawn: a character is a full tile, so "is he in this cell" means any overlap (`|dx| < 1 && |dy| < 1`), not "within half a tile of its centre". The half-tile version let a hero part-way into a closing pit survive and land inside the floor. `tests/fuzz.test.ts` plays random inputs on many levels and fails if anyone ends up inside solid floor; run it after changing movement, pits or bombs.

- Scripts that patch by exact text fail silently or half-way when the user's formatter changed quotes. Assert anchors, and re-read on failure.
- The edit tool cannot write outside the workspace; write temp files under `/tmp` through the shell, and delete them.
- `README.md` tables with numbers (difficulty, tools) go stale; recompute them when `CFG` or `profileFor` change.
- Hard-coded counts in tests: the level tests derive counts from `TOTAL_LEVELS` and the track list; keep it that way.
- Headless screenshots cannot press keys or hear sound. Say so in the report instead of claiming it works.
- After changing guard or hero speeds, also check `tests/gameplay.test.ts` timings; many tests run for a fixed number of seconds.
- Do not spawn a second Vite server; reuse :5173.
- When the user's request mixes areas (for example a tool plus a menu entry plus a new sound), do them in the order: rules and tests, then visuals, then UI, then docs, verifying after each area.
