---
name: theme-builder
description: Builds a complete new theme for the Robo Runner game (this repo): pixel-art background scenery, a chiptune music track and a new playable, verified level. Use when the user asks to add, create or build a new theme, world, scenery, stage or level pack for the game.
---

# Theme builder for Robo Runner

A "theme" here is three things that must ship together:

1. a **background** (scenery drawn in code) in `src/render/backgrounds.ts`
2. a **music track** in `src/audio/tracks.ts`
3. a **level** in `src/levels/levels.ts` (`HANDMADE_LEVELS`) that uses the theme (28x16 ASCII map)

Plus the bookkeeping: the `Theme` type and the README table. The full level list is `src/levels/all.ts`: the hand-made levels first, then generated levels up to `TOTAL_LEVELS` (60). A new hand-made level is inserted before the generated ones, so the generated levels keep the same total but one fewer is generated; if the user wants to keep 47 generated levels, raise `TOTAL_LEVELS` by one. The generator cycles through the themes listed in `THEME_ORDER` and names in `NAMES` (both in `src/levels/generator.ts`): add the new theme there too so generated levels use it.

Existing themes (do not duplicate): temple, ruins, fortress, crypt, sanctum, jungle, ice, volcano, atlantis, desert, cyber, mansion, sky, matrix. Check `src/game/types.ts` for the current list before proposing a name.

For changes to mechanics, UI, guard AI or new tools (not a new theme), use the `game-customizer` skill.

## Step 0: agree on the concept

If the user has not named a concrete theme, propose 2-4 ideas first (scenery, music mood, level gimmick each) and wait for a pick. If they named one, restate the plan in 3 lines (scenery, music, level gimmick) and go. Pick a short lowercase id (`glass`, `swamp`, ...), a display name for the level, and a gimmick that differs from the existing levels (see "Level design").

## Step 1: register the theme id

`src/game/types.ts`: add the id to the `Theme` union. `tsc` will now fail until the background exists, which is the safety net.

## Step 2: background scenery

In `src/render/backgrounds.ts`, add `function <id>(g: Ctx): void` (name it `<id>Citadel`-style if the id clashes with an existing symbol, as `sky` does with `skyCitadel`), then add it to the `DRAW` record at the bottom of the file.

The canvas is `W` x `H` = 560 x 320 pixels, drawn once and cached. A 38% black overlay is applied automatically afterwards so tiles stay readable, so use somewhat bright colours.

Helpers already in the file (use them, do not add new dependencies):

| Helper                                        | Use                                                     |
| --------------------------------------------- | ------------------------------------------------------- |
| `sky(g, topHex, bottomHex)`                   | banded vertical gradient; hex colours must be `#rrggbb` |
| `silhouette(g, col, base, amp, period, seed)` | hills, dunes, skylines                                  |
| `column(g, x, y, h, w, col, highlight)`       | pillars with capitals                                   |
| `bricks(g, col, line, y0, y1)`                | brick wall                                              |
| `torch(g, x, y, flicker)`                     | flame with glow                                         |
| `tri(g, col, cx, y0, h, halfW, down?)`        | triangles (pyramids, crystals, icicles)                 |
| `disc(g, col, cx, cy, r)`                     | sun, moon, blobs                                        |
| `rect(g, col, x, y, w, h)`                    | everything else                                         |
| `rng(seed)` (from `./sprites`)                | deterministic randomness; never use `Math.random()`     |

Composition recipe (back to front): sky gradient, celestial body or light source, far silhouette, mid-ground landmarks (3-6 distinctive shapes), foreground details (vines, chains, bubbles), a few `globalAlpha` glows (reset to 1 afterwards). Keep the middle of each tile row calm: bright high-contrast shapes behind the play area make ladders and coins hard to read. Add 1-2 signature details that make the theme recognisable at a glance.

## Step 2b: floor material

In `src/render/surfaces.ts`, add the theme to `THEME_SURFACE` (the `Record<Theme, ...>` type makes `tsc` fail until you do). Pick a `ground` style for the diggable floor (`earth`, `mud`, `sand`, `tile`, `tileIce`, `tileDark`, `redbrick`, `iron`, `circuit`, `circuitGreen`, `circuitViolet`) and a `stone` style (`stone`, or `armor` for tech themes). Choose a material that contrasts with the background and that makes diggable and undiggable floors easy to tell apart. If none fits, add a new style: a draw function in `src/render/sprites.ts`, an entry in `GROUND_STYLES` and a `PIT_COLORS` row (the surface tests will tell you what is missing).

## Step 3: music track

In `src/audio/tracks.ts`, add an entry keyed by the theme id. The type is `Track`:

```ts
myTheme: {
  bpm: 110,
  root: 48,                       // MIDI of the scale root (bass); lead plays one octave above
  scale: [0, 2, 4, 7, 9],         // semitone offsets; MINOR const exists for natural minor
  lead: ['0.2.4.2.5.4.2.0.', ...],   // one 16-char string per bar, 4 bars (title uses 8)
  bass: [0, 3, 4, 0],             // scale degree per bar, same length as lead
  drums: 'march',                 // 'none' | 'sparse' | 'march' | 'drive'
  leadWave: 'square',             // 'square' bright, 'triangle' soft/airy
  leadLen: 2,                     // lead note length in steps (1 = fast arpeggio, 4 = slow pad)
  bassEvery: 2,                   // bass on every Nth step (2 busy, 4 steady, 8 sparse)
  echo: false,                    // optional: repeats lead 3 steps later, quieter
}
```

Lead notation: `.` = rest, otherwise a hex digit 0-f is a scale degree; degrees past the scale length wrap up an octave (in a 5-note scale, `5` is the root one octave up). Every bar string must be exactly 16 characters. Mood guide:

| Mood              | bpm     | scale idea                         | drums  | wave                 |
| ----------------- | ------- | ---------------------------------- | ------ | -------------------- |
| tense, dungeon    | 66-80   | phrygian `[0,1,3,5,7,8,10]`        | sparse | triangle             |
| heroic, bright    | 120-130 | major `[0,2,4,5,7,9,11]`           | drive  | square               |
| exotic, desert    | 90-100  | double harmonic `[0,1,4,5,7,8,11]` | march  | square               |
| dreamy, water/ice | 76-85   | lydian `[0,2,4,6,7,9,11]`          | sparse | triangle             |
| mechanical, fast  | 130-140 | minor                              | drive  | square, `leadLen: 1` |

Write a melody that repeats a motif with variation (bars 1-2 state it, bar 3 lifts, bar 4 resolves toward the root). The music volume is set globally; do not change gains in the track.

## Step 4: the level

Maps are 28 columns x 16 rows. Use the generator rather than typing rows by hand (counting 28 characters per row is where mistakes happen):

```
python3 .kiro/skills/theme-builder/scripts/gen_level.py spec.json                 # preview
python3 .kiro/skills/theme-builder/scripts/gen_level.py spec.json --insert src/levels/levels.ts
```

The spec format is documented at the top of `scripts/gen_level.py`. Write the spec to a temp file (not into the repo) and delete it afterwards.

### Grid rules the generator and the game rely on

- Floors are one tile thick on rows 3, 6, 9, 12 and 15 (bottom). Characters stand on rows 2, 5, 8, 11, 14 (the row above each floor).
- A **ladder** is 3 cells: `[column, floorRow]` fills `floorRow`, `+1`, `+2`. Its top cell replaces the floor tile (you step off onto it from the row above); the bottom cell is the stand row of the floor below. Never put `H` on the stand row above a ladder top.
- A **hole** in a floor lets everyone fall to the band below. A **rope** (`-`) or **zip-line** (`>` `<`) placed on the stand row directly above a hole lets the hero cross it. `*` is gold on a rope.
- Zip-lines slide the hero in the arrow direction automatically and he gets off at the end (Down drops early). Guards treat zip-lines as ropes. Put the zip's start on the side the hero can reach by walking, and make sure solid floor exists at the far end.
- Stone `@` cannot be dug; ground `#` can. A pit in a 1-tile floor holds a guard but the hero falls through to the level below.
- Entities: `P` exactly one, `E` exactly one, `$` gold (at least one, needed for the door), `V` diamond (1-2 per level, optional bonus, 500 points), `G` guards, tools `S` shock trap, `D` decoy, `M` EMP, `B` boots, `O` smoke bomb, `U` glue, `X` bomb. Entities may only sit on empty cells. Place `V` on a stand cell with floor or ladder below.

### Level design checklist

- 8-10 gold, 1-2 diamonds, 3-4 guards (more for later levels), 1-3 tools. Introduce at most one new idea.
- Give it a gimmick tied to the theme (ropes over lava, zips between floating islands, stone floors in ice, dig-down shortcut in the desert). Look at the last few levels in `levels.ts` and make the gimmick different.
- Every gold coin, diamond, tool and the exit must be reachable from `P`. The test suite verifies this, including by digging.
- Do not put guards on top of zip-line cells or ladders at spawn; put them on plain floor.
- Place the new level where it fits the difficulty curve: hand-made levels are 1-14. Later levels are generated and harder, so a very easy new level should come early.
- Guards stay on their platform until the hero comes within their awareness radius, so each guard must be posted on a fair platform: at least 4 cells long, enough ways off it (two on a short ledge, one on a wide floor; a ladder, rope, zip or an open drop at an end each count), and at least 2 diggable `#` floor cells under it. On all-stone floors (ice, tech themes) leave a small `#` patch under each guard. `tests/levels.test.ts` runs `patrolIssues` over every level, and the failure message names the guard.
- Keep an escape route: the hero should never be forced through a spot with no alternative to a guard.

## Step 5: tests and bookkeeping

1. `tests/levels.test.ts` no longer hardcodes counts: it checks `TOTAL_LEVELS`, that every level in `src/levels/all.ts` is solvable, and that all themes with a track are used. Adding a theme to `THEME_ORDER` and `NAMES` is enough to keep it green. Note: `NAMES` is typed `Record<Theme, string[]>`, so `tsc` flags a missing entry.
2. `tests/music.test.ts` already checks every level theme has a track and every bar is 16 valid characters.
3. README: add a row to the "Levels and themes" table (number, name, theme, highlights).
4. If you added a new tile character, tool or mechanic, that is outside this skill: stop and ask the user.

## Step 6: verify (all must pass before reporting done)

```
npx tsc --noEmit
npx vitest --run
npx vite build && rm -rf dist
```

Then look at it. A dev server may already be running on port 5173 (the project's Vite refuses a second one: "Found another Vite dev process"); reuse it. Otherwise start one in the background with `control_bash_process`.

```
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --disable-gpu \
  --hide-scrollbars --window-size=1300,800 --virtual-time-budget=3000 \
  --screenshot=/tmp/theme.png "http://localhost:5173/?level=<N>"
```

Open `/tmp/theme.png`, check: scenery reads clearly behind ladders and coins, nothing overlaps the HUD, the exit door and every item are visible, tiles look right against the background. Fix and re-shoot until it looks good, then delete the screenshot. Add `&debug` to the URL to open the debug panel (disable guards, jump levels) when playtesting by hand.

You cannot hear the music in a headless run; say so in the report and describe the mood you aimed for.

## Pitfalls seen before

- Forgetting the `DRAW` record entry: `tsc` catches it, but only after Step 1.
- Typing map rows by hand: use the generator. The parser rejects any row that is not exactly 28 characters.
- `E`/`P` counted wrongly or a gold coin missing: the parser throws a `LevelError` naming the level.
- Ladder tops: if the hero cannot climb off a ladder, you placed `H` one row too high or too low. Use `[column, floorRow]` only.
- A background that is too busy or too bright at mid-height; test with a screenshot, not by eye on the code.
- The edit tool cannot write outside the workspace; keep temp files under `/tmp` via the shell instead.
- Do not leave `spec.json`, screenshots, or `dist/` behind.

## Report back

Summarise in a few lines: theme id and level name/number, the gimmick, the music mood (not heard), what was verified (tsc, test count, build, screenshot) and anything unverified.
