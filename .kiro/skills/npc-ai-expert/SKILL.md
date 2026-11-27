---
name: npc-ai-expert
description: Changes and debugs the guard (NPC) AI of the Robo Runner game in this repo - when guards chase or patrol, how they path-find, climb, queue, react to pits, tools and the hero's position, and their difficulty scaling. Use for any request like "guards should...", "enemies get stuck / overlap / don't follow / are too easy or too hard", or for bugs where guards or the hero behave oddly around ladders, pits and floors. For other game changes use game-customizer; for new themes use theme-builder.
---

# NPC AI expert for Robo Runner

Guard AI is the most fragile part of this game. Small rule changes have repeatedly produced freezes, loops, jitter and characters stuck inside floors, and the existing tests did not catch them. That's why this skill insists on **reproduce, trace, fix, prove with a test, census**. Never fix AI behaviour from a description alone, and never declare a fix without running the census.

## The rules the user has asked for (do not silently change them)

These came from explicit user decisions over several iterations. If a new request conflicts with one, point that out and ask which wins.

1. **Guards never pick up gold.**
2. **No lure-downstairs:** a guard never follows a hero who is farther away *and* on a lower floor than its post. It patrols its own floor instead, so the hero cannot drag the pack to the bottom.
3. **Close range ignores floors:** within `CFG.closeChase` (4.5 tiles, about a floor and a half) a guard chases on any floor.
4. **Hero above means chase:** if the hero is on a higher floor than a guard, the guard always chases, at any distance. It goes up first (nearest way up), then closes in horizontally. A guard with no way up sweeps its floor instead of freezing.
5. **Awareness radius:** otherwise a guard notices the hero within `diff.aggro` (columns + 3 x floors; grows with level) when he is not below its post. Chasing has hysteresis.
6. **Spread out:** chasing guards have roles (chaser, ambusher, flanker, door warden), avoid each other's cells, queue instead of overlapping, and walk through after a short patience.
7. **Pits:** a pit holds a guard on any floor (it climbs out on the same level); standing on its head pins it; a pit that closes on any character (any overlap) kills it; guards respawn at a spawn far from the hero.
8. **Tools act through `disabled(g)`:** shock/EMP (`stun`) and smoke (`cough`) stop a guard and make it harmless; glue slows it; a visible decoy overrides targeting.

An earlier "exit defence zone" rule was removed when rule 4 replaced it. Don't reintroduce it without asking.

## Where the AI lives

Everything is in `src/game/world.ts` unless noted. Read the current code before editing; the file is reformatted by the user's tooling (double quotes, trailing commas), so never patch from memory.

| Piece | What it does |
| --- | --- |
| `GuardBrain` (`alert`, `holdT`, `home`, `dir`, `wait`), `brains[]`, `brainFor(idx, g)` | Per-guard memory. `home` is the spawn cell and defines its patrol floor. Reset in `respawnGuard`. |
| `updateGuards(dt)` | Per tick: respawn timers, stun/cough timers, pit escape (`climbOut`, pinned check), then `updateAwareness` then `guardInput` then speeds (patrol x`CFG.patrolSpeed`, glue x`CFG.glueSlow`) then `stepCharacter`. |
| `updateAwareness(g, b)` | Sets `b.alert` from rules 2-5. All distance limits have hysteresis. |
| `floorRow(c)` | The floor a character counts as being on: `ceil(y - eps)`, i.e. the row below its feet while on a ladder. **Use it for every "which floor" decision.** |
| `guardInput(g, idx)` | Dispatch: alert and hero two or more rows above means `climbInput`; alert means `pathInput(guardTarget)`; otherwise `patrolInput`. |
| `climbInput` | BFS (`nextStepToNearest`, `pathfinding.ts`) to the nearest standable non-ladder cell on the hero's floor or above. |
| `patrolInput` | Sweeps `patrolRange(home)` end to end, pausing `CFG.patrolPause`; walks home first if displaced. |
| `pathInput(g, idx, target, hc, avoidOthers, goal?)` | Turns a target (or goal predicate) into `{dx, dy}`: BFS with other guards' cells and this tick's `reserved` steps blocked; refuses downward detours when the direct route doesn't go down; queues with `holdT` up to `CFG.holdPatience`, then walks through; finishes ladder rungs before stepping sideways. |
| `guardTarget(g, idx)` | Roles by `idx % 4`, direct attack within 4 tiles, decoy override. |
| `guardView` | Grid view used for guard BFS: a cell above an open pit counts as walkable, so guards walk into pits. |
| `respawnGuard`, `climbOut`, `bury`, `killGuard`, `checkHeroHit`, `updateTraps` | Life cycle and contact. |
| `src/game/pathfinding.ts` | `forEachNeighbor` (the movement graph), `nextStep`, `nextStepToNearest`, `reachable`. It must match what `movement.ts` lets a character actually do. |
| `src/game/movement.ts` | `stepCharacter`: tile-based movement with fractional positions; ladders, ropes, zips, falls, pits. |
| `src/game/config.ts`, `src/game/difficulty.ts` | Knobs (below) and per-level scaling (`guardSpeed`, `guardEscape`, `pitOpen`, `guardRespawn`, `aggro`). `NEUTRAL` must match `CFG`. |
| `src/levels/patrol.ts`, `src/levels/generator.ts` | `patrolIssues` (every guard needs a fair platform) and `profileFor` (guard count per level). The generator rejects unfair layouts. |

### Knobs

| Knob | Value | Effect |
| --- | --- | --- |
| `CFG.guardRun` / `guardClimb` | 2.95 / 2.65 tiles/s | base speeds, x `PACE` per guard, x `diff.guardSpeed` |
| `CFG.closeChase` (+`closeChaseHysteresis`) | 4.5 (+1.5) tiles | rule 3 |
| `diff.aggro` (+`CFG.aggroHysteresis`) | 11 to 16 (+6) | rule 5 |
| `CFG.patrolSpeed`, `patrolPause` | 0.7, 0.8 s | patrol feel |
| `CFG.holdPatience` | 0.6 s | queueing before walking through another guard |
| `diff.guardEscape`, `pitOpen`, `guardRespawn` | per level | pit and respawn pressure |

## Workflow

1. **Restate the rule change** as a short list of "a guard should X when Y". Check it against the rules above and ask if anything conflicts or is ambiguous (for example "closer to the exit": closer than what?).
2. **Reproduce before changing.** Write a failing test in `tests/gameplay.test.ts` with `makeWorld(...)`, or find the case in a real level with the probe (below). For a bug report with a screenshot, reproduce it first: the fuzzer in `tests/fuzz.test.ts` found the "hero inside the floor" case in seconds.
3. **Trace the failing guard** with the probe's `trace` mode and read what it actually decided each frame (branch, input, hold, floor). Most AI bugs are two decisions alternating; the trace shows that immediately. Do not guess from the code.
4. **Fix the cause,** not the symptom (see the failure catalogue). Keep decisions stable across a whole move.
5. **Prove it:**
   - A regression test that fails without the fix. Temporarily revert the fix and watch the test fail, then restore it.
   - `bash .kiro/skills/npc-ai-expert/scripts/probe.sh census HERO=exit` and `... census HERO=start SECONDS=30` must say `no issues`.
   - `bash .kiro/skills/game-customizer/scripts/verify.sh` (type check, all tests, build).
6. **Docs:** the README rules paragraph about guards, this skill's rule list (if the user changed a rule), and the guard-AI lines in the game-customizer skill.
7. **Report:** the rule as implemented, what you assumed, the test and census results, and that "feel" is unverified until the user plays it. Mention side effects on difficulty (for example "guards now follow you up, so upper floors are busier").

## The probe (scripts/probe.sh)

It copies `probe.ts` into `tests/` for one run, removes it afterwards, and prints a report. The hero is invincible and parked at `HERO` for the whole run.

```
bash .kiro/skills/npc-ai-expert/scripts/probe.sh census HERO=exit            # every level, hero on the exit
bash .kiro/skills/npc-ai-expert/scripts/probe.sh census HERO=start SECONDS=30
bash .kiro/skills/npc-ai-expert/scripts/probe.sh trace LEVEL="Bone Hall" GUARD=2 HERO=exit FROM=20 SECONDS=24 EVERY=3
bash .kiro/skills/npc-ai-expert/scripts/probe.sh trace LEVEL=36 GUARD=0 HERO=12,8 EVERY=30
```

- `census` flags `STUCK` (alert, not moving, not on his floor), `JITTER` (moving, going nowhere), `STRANDED` (a way up exists but the guard is below the hero), `LURED?` (posted above a far-away hero but came down). It also prints how many guards caught the hero and the AI cost per frame (about 70-80 µs is normal).
- `trace` prints the level map, then the guard frame by frame: position, mode, `floorRow`, alert, which branch produced the input (`climb`, `chase`, `patrol`), the input used, `holdT`, stun and cough. Repeated lines are collapsed into `... same xN`.
- **Read census results critically.** A guard "half a tile below the hero" at the top of a ladder that ends right under him has *caught* him (he is invincible in the probe); the census already counts touching as caught. When a flag looks surprising, trace that guard before changing the game.
- Parking the hero is a worst case for the AI (no movement, no digging). For behaviour while he moves, write a scripted test or use the fuzz pattern.

## Failure catalogue (all of these happened here)

| Symptom | Cause | Fix used |
| --- | --- | --- |
| Guard bobs in place half-way up a ladder, forever | `Math.round(g.y)` flips between two floors mid-rung, so two decisions alternate every tick (climb, then path around, which went down) | `floorRow()` for every floor decision |
| Guard climbs to a platform, walks off, falls, climbs back, repeat | Goal was "a cell one floor above me": after a necessary detour down, the nearest higher cell is where it came from | Goal fixed by the *hero's* floor (`climbInput`) |
| Guard just below the hero's floor goes back down | BFS that avoids other guards found a long detour downward around a guard parked next to the hero | Refuse a downward step when the direct route doesn't go down; queue instead |
| Guards jammed behind an idle guard on a ladder | Queueing forever | `holdT` / `CFG.holdPatience`, then walk through |
| Guards stacked into one ("looks like a single guard") | All targeting the same cell on the same path | Roles in `guardTarget`, blocked cells, `reserved` steps, per-guard `PACE` |
| Whole pack follows the hero to the bottom floor | Pure chase | Patrol + awareness rules 2-5 |
| Guards stranded below after the hero passes above | Patrol rule too strong | Rule 4 + `climbInput` |
| Hero alive inside a refilled floor tile | `bury` used "within half a tile of centre"; a hero part-way into a closing pit survived and finished his fall into solid floor | Any overlap (`|dx| < 1 && |dy| < 1`); fuzz test |
| Level impossible: guard sweeps a floor where only digging could save you | Guard posted on all-stone or tiny platform | `patrolIssues`: at least 4 cells, ways off, diggable floor; generator rejects |
| Tests suddenly fail after a rule change | Fixed-time tests assumed old behaviour, or put the hero where a patrolling guard walks into close range | Rewrite to the new rule, put the hero on the side the guard sweeps away from, assert outcomes |

General lessons:

- **Decisions must be stable while a move is in progress.** Derive them from things that do not change mid-step (the floor a character is on, the hero's floor), not from rounded fractional positions.
- **Goals should be fixed by the target, not by the mover's position**, or the goal moves with the mover and creates cycles.
- **A character is a full tile.** Any "is it in this cell" check means overlap, matching what is drawn.
- **Every new condition needs hysteresis** if it can toggle while the hero stands still near its threshold.
- **BFS per guard per tick is fine** at this grid size (28x16): budget about 100 µs per frame for the whole simulation; the census prints it. Avoid extra BFS calls per guard in hot paths without measuring.
- **Movement graph equals movement code.** If you change what a character can traverse (`movement.ts`), change `forEachNeighbor` too, and re-run the level fairness tests, which use the same graph.
- **Debug invincibility must never leave the hero in an impossible state;** route new lethal hazards through `killHero()` (with the pit position when relevant).

## Writing AI tests

- Use `makeWorld({ 14: "P..G", 15: "#".repeat(28) })` from `tests/helpers.ts`, set positions explicitly, then `run(w, seconds, input)` or `tick(w)`. Add guards by taking one from a second `makeWorld({14:"G"})`.
- **Assert outcomes, never exact paths:** "reached row 11", "stayed on row 11", "x decreased", "never closer than 0.7 to the other guard".
- **Patrolling guards move on their own:** put the hero on the side the guard sweeps *away* from, or the close-range rule triggers and the test means something else.
- Time-sensitive tests: compute timings from `CFG` (`CFG.refillTime - 0.05`), start characters already in the decisive position (for example already over the pit), and assert the intermediate state (`mode === "fall"`) so you know the scenario really happened.
- Keep the all-levels guarantees green: `guards never end up stranded or jammed` (`tests/gameplay.test.ts`), `nobody ends up inside the floor` (`tests/fuzz.test.ts`), `guard patrol platforms` (`tests/levels.test.ts`).
- Prove the test catches the bug: revert the fix locally, see it fail, restore.

## Manual checks in the browser

The debug panel (`?debug`, or `` ` `` / F2) can disable guards, make the hero invincible and jump to any level; `?level=N` starts a level directly. Headless screenshots (`.kiro/skills/game-customizer/scripts/shot.sh`) show positions but not behaviour over time, so AI "feel" always needs the user to play. Say so.
