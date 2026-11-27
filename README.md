# Robo Runner

A retro, sprite-style, side-view browser game in the spirit of Lode Runner. A robot digs pits with a laser, collects all the gold, avoids chasing guards and escapes through the door. Built with TypeScript, HTML Canvas and Vite.

## Play now
The game is available to [play here](https://robo-runner-lovat.vercel.app/)

## Run

```
npm install
npm run dev        # play at the printed URL
npm test           # unit tests (Vitest)
npm run build      # type check + production build
```

The title screen has Start Game, Options (music, sound fx, volume, golden robot; saved in the browser), Credits and Fullscreen. The pause menu offers the same Options and Credits, plus Resume and Exit to Title. After you have made progress it also offers Continue and Level Select, and after clearing the game, Endless Mode.

Dev shortcuts: open `/?level=3` to jump straight into a level (add `&collect` to open the exit portal, `&pause` or `&pause=options` to open the pause menu, `&tool=bomb&use` to fire a tool), `/?ending` (or `ending=results`, `ending=credits`, plus `&at=7` to start that many seconds in) to preview the finale, and add `&debug` to open the debug panel on load. In game, press `` ` `` or F2 to toggle the panel. It can disable guards, make the hero invincible, switch sound effects and music on or off, jump to any level, restart the level and collect all gold.

## Controls

| Key                     | Action                                                        |
| ----------------------- | ------------------------------------------------------------- |
| Arrows (or WASD)        | Run, climb ladders, hang on ropes, drop down                  |
| Z / X                   | Fire laser: dig a pit down-left / down-right (short cooldown) |
| Space or C              | Use the held tool                                             |
| P or Esc                | Pause menu: Resume, Options, Credits, Exit to title           |
| M                       | Mute everything                                               |
| N                       | Toggle music only                                             |
| F                       | Toggle fullscreen                                             |
| Enter                   | Start / continue / select in menus                            |
| Up / Down, Left / Right | Navigate and adjust the title menu                            |

## Rules

- Collect all gold, then reach the door.
- Ground (earth) can be dug, stone cannot. Pits stay open about 5 s, then refill.
- A guard in a pit climbs out after about 2 s. If you stand on his head he stays pinned, and a refilling pit kills him. He respawns after a delay. You can run over trapped guards.
- Touching a guard, or being buried by a refilling pit, costs a life (3 lives, level restarts). You earn a bonus life every 5 cleared levels, up to 5 lives.
- Zip-lines (`>` `<`): step on and you slide automatically in the arrow direction. Press Down to drop off. Guards treat them like ropes.
- Guards never pick up gold.
- A pit holds a guard even in a one-tile floor, so he climbs out on the same level. The hero drops through his own pits to the level below, and can walk over a guard held in one.
- Guards only notice you within an awareness radius (a column counts 1, a floor counts 3; 11 at level 1 growing to 16 at level 60). Farther away they patrol their own platform end to end at 70% speed, and a chasing guard gives up and walks back once you get well out of range, so you cannot drag everyone to the bottom floor. Guards that are chasing have roles (chaser, ambusher, flanker, door warden) and avoid each other's cells, so they spread out instead of stacking up. A decoy still attracts guards that can see it.
- Every guard in the game is posted on a fair platform (checked by the tests): at least 4 cells long, a way off it (two on short ledges), and at least 2 diggable floor cells, so a pit is always possible but never the only answer.
- The laser fires at the first floor cell completely clear of your body. Standing between two cells covers both, so the shot goes one cell farther; it can never open a pit under your own feet, and Z/X work at any position on the floor.
- Diamonds are an optional bonus (500 points, 1-2 per level). They are not needed to open the door.

## Look of the levels

Every theme has its own floor material, set in `src/render/surfaces.ts`: sand, earth with grass, mud, ceramic tile (warm, icy or dark), red brick, riveted iron, and glowing circuit boards in cyan, green or violet for the tech themes. Undiggable stone is grey brick, or hazard-striped armour plating in the tech themes, so you can always tell what the laser can dig. The exit is a swirling green portal: a dead dark ring with a red lamp while coins remain, and a glowing spiral with drifting sparks once the last coin is collected.

## The ending and what it unlocks

Clearing level 60 plays a victory cinematic (the robot walks into the treasure vault, guards cheer, fireworks, new victory music), then a results screen and the credits. The results screen shows your final score, levels cleared, gold, diamonds found, deaths, guards trapped, tools used and total time, with a rank from S to C (S: at most 1 death and 80% of diamonds; A: at most 4 deaths and 50%; B: at most 10 deaths; otherwise C). Nothing about the run's score is stored.

Clearing the game for the first time unlocks:

- **Golden robot:** switched on automatically, toggle it in Options.
- **Endless mode:** levels 61 onwards, generated at maximum difficulty that keeps tightening (faster guards, shorter pits) up to a cap. 3 lives, bonus life every 5 levels.
- **Level Select:** start from any level (left/right, Page Up/Down for 10 at a time).

The only things saved in the browser are your options and unlock progress: the furthest level reached (for Continue and Level Select) and whether you cleared the game.

## Tools (one held at a time)

| Tool            | Effect                                                                                                                                                                                                                                                |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Shock trap      | Placed on the floor. A guard stepping on it is stunned for 5 s.                                                                                                                                                                                       |
| Decoy hologram  | Guards with line of sight chase it for 6 s instead of you.                                                                                                                                                                                            |
| EMP pulse       | Freezes all guards within 5 tiles for 3 s.                                                                                                                                                                                                            |
| Overclock boots | +50% speed and faster laser for 8 s.                                                                                                                                                                                                                  |
| Smoke bomb      | Guards within about 4 tiles cough and freeze for 3.5 s, the cloud keeps any guard that walks into it coughing for 5 s, and you cannot be caught for 4 s (you flicker while shielded).                                                                 |
| Glue            | Spills a 3-tile puddle where you stand. It lasts until the level ends. Guards crossing it move at 35% speed; you are not affected.                                                                                                                    |
| Bomb            | Lit where you stand: it crackles for 2.5 s, then explodes with a radius of about 2.3 tiles. It kills you (unless you ran away) and any guard in range (they respawn as usual), and blasts the diggable ground into pits that heal back like dug ones. |

## Levels and themes

60 levels. Levels 1-14 are hand-made, one per theme:

| #   | Level                 | Theme    | Highlights                                                                    |
| --- | --------------------- | -------- | ----------------------------------------------------------------------------- |
| 1   | Sun Temple            | temple   | ladders, digging basics                                                       |
| 2   | Dig Site              | ruins    | rope, stone floors, shock trap                                                |
| 3   | Iron Fortress         | fortress | zip-lines, decoy                                                              |
| 4   | Forgotten Crypt       | crypt    | rope, EMP, boots                                                              |
| 5   | Sanctum of Gears      | sanctum  | zip, rope, all tools                                                          |
| 6   | Vine Canopy           | jungle   | double rope crossing                                                          |
| 7   | Frozen Depths         | ice      | stone floors, long zip, boots                                                 |
| 8   | Forge of Embers       | volcano  | rope forces the route, EMP                                                    |
| 9   | Sunken Gardens        | atlantis | two opposite zip-lines, decoy                                                 |
| 10  | Sphinx Night          | desert   | dig down as a shortcut                                                        |
| 11  | Neon Grid             | cyber    | metal floors, two zips, EMP + decoy                                           |
| 12  | Haunted Halls         | mansion  | every tool, four guards                                                       |
| 13  | Citadel in the Clouds | sky      | zips, rope, every tool                                                        |
| 14  | Digital Rain          | matrix   | three zip-line data streams over stone firewalls, all four tools, five agents |

Levels 15-60 are generated deterministically by `src/levels/generator.ts` (same seed, same level) and continue the same themes with new names. Difficulty rises smoothly over all 60 levels:

|                          | Level 15 | Level 60 |
| ------------------------ | -------- | -------- |
| Guards                   | 3        | 6        |
| Gold coins               | 8        | 13       |
| Gaps per floor           | 1        | up to 3  |
| Ladders per floor        | 2-3      | 1-2      |
| Stone (undiggable) floor | rare     | common   |
| Guard speed              | x0.95    | x1.14    |
| Guard awareness radius   | 12       | 16       |
| Pit stays open           | 4.9 s    | 3.8 s    |
| Guard escapes a pit in   | 2.0 s    | 1.3 s    |
| Guard respawn            | 4.4 s    | 2.5 s    |

The intro card shows a 1-5 star difficulty rating. Every generated level is checked by the tests: all gold, diamonds, tools and the exit can reach each other without digging, guards start at least 8 tiles away, and the generator rejects any layout that fails. The level count is `TOTAL_LEVELS` in `src/levels/all.ts`; difficulty curves live in `src/game/difficulty.ts` and `profileFor` in the generator.

To add a theme: extend `Theme` in `src/game/types.ts`, add a draw function in `src/render/backgrounds.ts` and a track in `src/audio/tracks.ts`. The `Theme` type forces a background entry at compile time, and a test checks that every level theme has a music track.

## Level format

Hand-made levels live in `src/levels/levels.ts` as 28x16 ASCII maps (`HANDMADE_LEVELS`).

```
.  empty     #  ground (diggable)   @  stone
H  ladder    -  rope                *  rope with gold
>  <  zip-line (slides right / left)
$  gold   V  diamond   P  hero   G  guard   E  exit door
S  shock trap   D  decoy   M  EMP   B  boots
O  smoke bomb   U  glue   X  bomb
```

`tests/levels.test.ts` checks that every level parses and that all gold, tools and the exit are reachable (including by digging).

## Art and audio

All sprites and backgrounds are generated in code (`src/render/sprites.ts`, `backgrounds.ts`). To use real art, implement the `AssetProvider` interface in `src/render/assets.ts` (sprite keys are documented there) and pass it to `Game`. Sound effects and the background music are synthesized with the Web Audio API, so there are no audio files. Each theme has a looping chiptune track defined as data in `src/audio/tracks.ts` (lead melody, bass line, drum style), and the title screen has its own 8-bar track.

## Structure

- `src/game` rules: world, movement, pathfinding (BFS guard AI), levels parser
- `src/core` loop, input, flow (lives and scenes), game glue
- `src/render` renderer, generated sprites and backgrounds, particles
- `src/audio` sound effects
- `tests` unit tests for the logic (rendering and audio are not tested)
