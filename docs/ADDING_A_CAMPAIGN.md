# Adding a campaign (story mode)

A campaign is data. Add `js/campaigns/<name>.js`, list it in `index.html` before `js/ui/menu.js`, and the menu shows a card for it.
`js/campaigns/newyork.js` is the working example.

```js
(function () {
  // 1. Arenas for this campaign. camp: true keeps them out of the Endless arena list.
  registerLocation('docks', {
    name: 'The Docks', camp: true, desc: '', f0: '#2d333d', f1: '#151922', wall: '#6b7586', slip: 0, hazard: false, ambient: 'debris',
    decor(cx, cy) { /* optional: draw floor art with ctx; the arena is already clipped */ }
  });

  // 2. Chapters.
  const chapters = [
    { title: 'Chapter 1: Arrival', loc: 'docks',
      intro: ['Story line one.', 'Story line two.'],                 // or { avengers: [...], xmen: [...] } to vary by team
      outro: ['What happens after.'],
      waves: [ [['grunt', 6]], [['grunt', 8], ['spitter', 2]], [['brute', 1], ['grunt', 5]] ] }   // [enemyType, count] per wave
  ];

  registerCampaign({ id: 'docks', name: 'Trouble at the Docks', blurb: 'Shown on the menu card.', chapters });
})();
```

**Story as cutscenes.** Instead of the text arrays `intro` / `outro`, a chapter can give `introScenes` / `outroScenes`: lists of cutscene ids, played with ball-design characters,
speech bubbles and staged action. Mix freely (the New York campaign uses text for some chapter ends and scenes for others). See `docs/CUTSCENES.md`.

How the engine uses it (`js/modes/campaign.js`):

- Each chapter shows the intro story, plays its waves one after another, then shows the outro. Between chapters the player picks 1 of 3 upgrades (`PERKS` in `js/modes/modes.js`).
- A wave may contain bosses (any enemy type with `boss: true`); bosses spawn first and get a boss bar, extra health, and resist knockback.
- Enemy health grows with the chapter number and enemy speed grows with the wave, so later chapters are tougher automatically.
- Dying retries the current chapter with the upgrades kept. Finishing the last chapter shows the victory screen.
- Heroes can be kept out with `campaignLocked: true` on the hero (Loki is locked in the Battle of New York).

## Adding enemies for a campaign

One file in `js/enemies/` (see `chitauri.js`): `registerEnemy('name', { r, hp, speed, score, drop, color, draw(e, r), ai(...), tick(e, dt), boss, name })`.

- `draw(e, r)`: the context is already translated to the enemy; omit it for the default round body.
- `ai(e, dx, dy, d, sp, dt, tgt)`: return `true` if you moved the enemy. Ready-made behaviours: `kiteAndShoot` (add `shoot: { every, speed, col }`) and `chargerMove` (telegraphed dash).
- `tick(e, dt)`: extra per-frame logic when used with `chargerMove` (the Chitauri bosses summon and fire volleys here).
- `spawn: { minWave, weight }` makes the type appear in Endless mode too.

## Adding a team, or an Endless arena

- Team: `js/teams/<name>.js` with `registerTeam({ id, name, blurb, ult })`. Put heroes on it with `team: '<id>'`. `ult` is `null` or `{ name, label, cast() }`; the meter fills as enemies fall and the player presses X.
- Endless arena: `registerLocation(id, {...})` in `js/world/arenas.js` (no `camp` flag). Options: `slip` (ice), `hazard` (lava geysers), `ambient` (`'snow' | 'ember' | 'debris'`, `ambCol`), `sheen` / `sheenGlow` (floor lines), `decor(cx, cy)`.
