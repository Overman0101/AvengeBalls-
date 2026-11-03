# Adding a hero

A new hero is **one new file plus one line in `index.html`**. You do not edit the engine, the menu, the HUD or any other hero.

1. Copy `docs/hero-template.js` to `js/heroes/<name>.js`. The template is a complete, playable hero (bolt, shockwave, dodge roll).
2. Change `id` (unique, lowercase), `name`, `team` (`'avengers'`, `'xmen'`, or any registered team), `order` (menu position), `blurb`, and `look`.
3. Add the script tag to `index.html`, anywhere before `js/ui/menu.js` (next to the other heroes):
   `<script src="js/heroes/<name>.js"></script>`
4. Open `index.html`. Your hero is on the team's roster, with a customiser, skill bar, controls text and pause screen, all generated from what you registered.
5. Run `node tests/run.js`. The contract test checks your hero has everything the engine needs.

## Conventions that prevent conflicts

- Keep the whole file inside `(function () { ... })();`. Helper functions and arrays stay private to the hero.
- Prefix your cooldown keys (`cd: { moon_beam: 0 }`) and extra player fields so they cannot clash with another hero's. Fields from every hero's `init()` are merged into `player`.
- Add per-hero projectile arrays inside your file (`let beams = [];`) and reset them in `reset()`. Use the shared arrays when the behaviour matches: `bullets`, `daggers` and `bombs` must be advanced by calling `updateBullets(dt)` / `updateDaggers(dt)` / `updateBombs(dt)` from your `update()`; `shocks` (rings) and `arcs` (lightning) are updated and drawn by the engine, so you only push to them.
- Sounds: add your own with `Object.assign(sfx, { moonBeam: () => tone(...) })`.
- Controls use `onKey(code, e)` for presses and `onMouse(button)` for clicks. Hold-to-fire: set `mouse.down = true` in `onMouse`, and fire from `update(dt)` while `mouse.down` is true.
- Movement that takes over the player (dash, leap, grapple): keep your state on `player` and register it with `registerForcedState(priority, () => player.myDash > 0, dt => updateMyDash(dt))`. Lower priority numbers win; the shared ones use 30-60, existing heroes use 10-120.
- Reusable pieces already in the engine: `castRoll()` (dodge), `startSweep()` (melee arcs), `chainArcs()` (lightning that jumps between enemies), `explodeAt()`, `knock()`, `damage()`, `healHeart()`, `assistAim()`, `lunge()`.
- If your hero needs something the hooks cannot express, add a new optional hook in `core/` (a few lines, guarded like the others: `if (HERO.myHook) HERO.myHook(...)`), document it in `docs/ARCHITECTURE.md`, and add a test. Do not special-case your hero id in the engine; the architecture test will fail if you do.

## Customiser data (`look`)

```js
look: {
  capeLab: 'Suit',                     // label for the colour swatches ('Cape', 'Armor', 'Skin'...)
  cape: '#3a6fc9', fx: '#a8ecff',      // default suit colour and default "magic" effect colour
  hair: '#2a1a14',
  gears: ['Bare head', 'Helmet'],      // headgear options; draw them in gear(g, c), c = { r, hr, gear, unsuited }
  help: 'html shown on the hero screen',
  keys: ['lines shown on', 'the pause screen']
}
```
