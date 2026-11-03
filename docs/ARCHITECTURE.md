# Architecture

## One shared scope, no build step

Every file in `js/` is a classic `<script>`. They all share one global scope (so top-level `let`, `const` and `function`
names are visible everywhere), and the game runs straight from `index.html`, even from `file://`.

Consequences, and the rules that follow from them:

1. **Load order matters.** `index.html` lists the scripts: `core` -> `modes` (including the cutscene engine) -> `shared` -> content (`enemies`, `world`, `teams`, `heroes`, `campaigns`) -> `ui` -> `main.js`.
   Code that runs at load time may only use things from earlier files. Everything that runs later (inside functions) can use anything.
2. **A duplicate top-level name is a loud `SyntaxError`**, not a silent override. In `core/`, `shared/` and `modes/` keep names unique.
3. **Hero, enemy, team, location and campaign files wrap themselves in `(function () { ... })();`** so their helper functions are private.
   Two heroes can both have a `fireArrow` and never collide. They talk to the engine only through `registerHero(...)` and friends.
4. **The engine never names a hero.** `tests/run.js` enforces this.

## Registries (`js/core/registry.js`)

| Call | Where | What it adds |
|---|---|---|
| `registerHero({...})` | `js/heroes/` | a playable hero (menu card, customiser, skill bar, controls) |
| `registerTeam({...})` | `js/teams/` | a team: `id, name, blurb, ult` (ult = `{ name, label, cast() }` or `null`) |
| `registerEnemy(id, {...})` | `js/enemies/` | an enemy type (stats, optional `ai`, `draw`, `tick`, `spawn`) |
| `registerLocation(id, {...})` | `js/world/`, `js/campaigns/` | an arena (colours, ambience, optional `decor`) |
| `registerCampaign({...})` | `js/campaigns/` | story chapters; the menu lists each one automatically |
| `registerScene({...})`, `registerStage`, `registerProp`, `registerActor` | `js/campaigns/` | cutscenes: scripts, backdrops, props, story-only characters (see `docs/CUTSCENES.md`) |
| `registerForcedState(priority, test, run)` | `js/shared/`, heroes | a movement state that takes over the player (dash, leap, grapple) |

## Hero hooks

A hero is an object passed to `registerHero`. Only the first group is required; every other hook is optional.

| Hook | When it runs |
|---|---|
| `id, name, team, order, blurb, look, cd, init, reset` | **data.** `look` = customiser data (`capeLab, cape, fx, hair, gears, help, keys`); `cd` = this hero's cooldown keys; `init()` returns extra fields merged into `player`; `reset()` runs at the start of every run |
| `onKey(code, e)`, `onKeyAny(code, e)`, `onMouse(button)` | key presses (not repeats) / every key event / clicks (`button` 0 or 2) |
| `speed(mv)` | base walking speed (`mv` is what `preMove` returned) |
| `preMove(dt)` | every frame before movement; may return `{ noSlip, fly, boosting }` |
| `update(dt)` | every frame after movement: timers, held-button fire, projectiles |
| `preEnemies(dt)`, `postEnemies(dt)` | before / after enemies move |
| `timeScale()` | world time multiplier (default 1). Below 1 it slows enemies, their fire, geysers and spawning, but not the player or hero code (Quicksilver's speed perception) |
| `onHurt(h)` | before a hit lands (`h = { sx, sy, kb, src, noBlock }`); return `true` to absorb it, or change `h.kb` |
| `onBolt(b)` | an enemy bolt reaches you: return `'gone'` (absorbed) or `'reflected'` |
| `hitRadius()` | radius used for enemy and bolt contact (default `player.r`) |
| `skills()`, `message()`, `hudBars()` | skill-bar entries `{ k, n, cd, max, ok }`, the line under the wave counter, bars under the hearts |
| `aimLine()` | length of the dotted aim line, `0` for none |
| `drawUnder()`, `drawBefore()`, `drawPlayerUnder(px, py)`, `drawBodyOverride(px, py, alpha)`, `preBody()`, `charOpts()`, `drawPlayerFx(px, py)`, `drawOver()` | drawing layers, in order from furthest back to nearest |
| `gear(g, c)`, `bodyRing(g, r, unsuited)`, `drawBody(...)`, `modern` | the top-down body: headgear overlay, a ring, a full replacement, and the smaller-head flag |
| `campaignLocked`, `campaignNote` | keep a hero out of campaigns, with the reason shown in the menu |
| `api` | functions exposed to the tests |

## One frame

`frame()` (js/main.js) calls `update(dt)` then `draw()`.

`update`: timers and particles -> ambient particles -> (play only) hero `preMove` -> forced movement states or walking ->
hero `update` -> shockwaves and melee sweeps -> lava geysers -> heart pickups -> mode spawning (`endlessTick` / `campaignTick`) ->
hero `preEnemies` -> enemies move (each type may supply `ai`) -> separation -> hero `postEnemies` -> enemy bolts (hero `onBolt`) -> contact damage (hero `onHurt`).

`draw`: arena floor and decor -> hazards -> hero `drawUnder` -> aim line -> hearts -> enemies -> enemy bolts -> hero `drawBefore` -> player (hero layers) ->
melee sweeps -> hero `drawOver` -> shared projectiles -> shockwaves -> strikes -> particles -> HUD, boss bar, banner and end screens.

## Game states

`state` is one of `menu`, `play`, `story` (text story overlay), `cutscene` (a scripted scene, driven by `updateCutscene` / `drawCutscene` in `js/modes/cutscene.js`), `perk` (upgrade picker), `over` (died), `win`. Only `play` runs the simulation.
Game modes: `mode` is `endless` or `campaign`; campaign progress lives in `camp` and upgrades in `perks`.

## Tests

`node tests/run.js` loads the real `index.html` script list into a headless sandbox (`tests/harness.js`) and drives it with fake input.
Add a test next to the closest existing one whenever you add an engine hook or change a mechanic.