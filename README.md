# Avengeballs

A top-down arena brawler prototype: pick a team and a hero, then survive endless waves or play the Battle of New York campaign.
Thirteen heroes (Thor, Captain America, Iron Man, Hawkeye, Black Widow, Hulk, Spider-Man, Loki, Doctor Strange, Scarlet Witch, Wolverine, Deadpool, Quicksilver),
two teams, three Endless arenas, and a four-chapter Battle of New York campaign told in seven cutscenes
(Fury, Loki, the Helicarrier, the portal, Iron Man's sacrifice, victory, and shawarma), with upgrades and two bosses.

> Prototype for personal use. It uses Marvel character names. Replace names and art before any public release.

## Run it

Open `index.html` in a browser. There is no build step and no server: the game is plain `<script>` files.

## Play

| Input | Action |
|---|---|
| WASD / arrows | move |
| Mouse | aim |
| Click, right click, Q E F R T G, Space, Shift | each hero's skills (shown on the skill bar and the pause screen) |
| X | team ultimate (X-Men: Mutant Surge), once its meter is full |
| Click / Space (in a story scene) | continue; Esc skips the scene |
| P or Esc | pause (M on the pause screen returns to the menu) |

## Project layout

```
index.html            page shell + the list of scripts (their ORDER matters, see docs/ARCHITECTURE.md)
css/style.css
js/core/              the engine: registries, state, input, update, draw, HUD, combat   (heroes are never named here)
js/shared/            mechanics several heroes share: movement states, projectiles, melee sweeps, shockwaves
js/modes/             Endless, the campaign engine, the cutscene engine, perks, team ultimates
js/heroes/            ONE FILE PER HERO, each self-contained and self-registering
js/enemies/           enemy types and reusable AI behaviours
js/teams/             teams (roster + optional ultimate)
js/world/             Endless arenas
js/campaigns/         campaigns: story, chapters, waves, bosses and their own arenas
js/ui/menu.js         the start flow, built from the registries
js/main.js            boot (runs last)
docs/                 ARCHITECTURE, ADDING_A_HERO, ADDING_A_CAMPAIGN, CUTSCENES, and hero-template.js
tests/                headless tests (Node 16+, no dependencies)
```

## Test it

```
node tests/run.js        # or: npm test
```

The suite plays every hero in every arena, walks the entire campaign to the victory screen, and checks the rules that
keep the project conflict-free (for example: the engine may never name a specific hero, and every script must be listed in `index.html`).

## Extending it

- New story scenes: see `docs/CUTSCENES.md`.
- New hero: copy `docs/hero-template.js` to `js/heroes/`, add one `<script>` line. See `docs/ADDING_A_HERO.md`.
- New campaign / story mode: add a file to `js/campaigns/`. See `docs/ADDING_A_CAMPAIGN.md`.
- New enemy, arena or team: one small file each, see `docs/ARCHITECTURE.md`.