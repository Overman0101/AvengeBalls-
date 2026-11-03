# Cutscenes (story scenes)

A cutscene is a scripted scene: ball-design characters on a stage, speech bubbles, narration captions and simple staging
(characters walk in, objects move, flashes and shakes). Scenes are **data**. The Battle of New York story in
`js/campaigns/newyork-scenes.js` is the worked example; its art (backdrops, props, story-only characters) is in `newyork-stages.js`.
The engine is `js/modes/cutscene.js`.

Player controls: **click / Space / Enter** continue (the first click finishes the typing, the next moves on), **Esc** skips the whole sequence.

## Attaching scenes to a campaign

In a chapter of your campaign, list scene ids. Chapters without scenes keep using the plain text story screen.

```js
{ title: 'Chapter 1', loc: 'stark',
  introScenes: ['tesseract', 'assemble'],      // played before the chapter starts
  outroScenes: ['victory'],                    // played after the chapter is cleared, before the upgrade pick
  waves: [...] }
```

## Writing a scene

```js
registerScene({
  id: 'tesseract',                         // unique; this is what chapters refer to
  title: 'SCENE 1: THE TESSERACT',         // optional title card (leave out for a continuation scene)
  stage: 'lab',                            // a registered backdrop
  actors: [ { id: 'fury', x: 250, y: 420, face: 0 }, { id: 'hawk', x: 330, y: 450, face: 0 } ],   // who is on stage at the start
  props:  [ { id: 'cube', type: 'tesseract', x: 480, y: 390 } ],                                    // objects on stage
  steps: [ ... ]
});
```

**Actors** are hero ids (`'thor'`, `'cap'`...), drawn with that hero's default look, or story-only characters from `registerActor`.
`face` is an angle in radians (0 = right, `Math.PI/2` = down, `-Math.PI/2` = up) or the id of another actor to look at. Optional: `r` (size, default 22),
`glow` (colour: mind-control eyes and aura), `anger` (0 to 100, Hulk), `munch: true` (eating bob).

`'$player'` is the hero the player picked. It joins the scene as an extra, **unless that hero is already in the scene's cast**
(so Captain America is Captain America, and Spider-Man or Wolverine appear as an extra ally). Put it last in the actor list.

**Keep characters in the band y = 300..455**, so the caption bar at the bottom never covers them. The stage is 960 x 600.

## Steps

Steps run in order. Say and narrate steps wait for a click; the rest happen on their own.

| Step | Meaning |
|---|---|
| `{ say: 'cap', text: '...', as: 'Steve Rogers' }` | speech bubble over that actor (`as` overrides the name tag) |
| `{ narrate: '...' }` | caption at the bottom of the screen |
| `{ card: 'THE END.' }` | big centred text over a dimmed stage |
| `{ spawn: { id, x, y, face }, wait: 0.3 }` | an actor pops in |
| `{ move: id, to: [x, y], dur: 1 }` | walk or fly an actor or prop (actors turn to face the way they go; `turn: false` to stop that) |
| `{ tween: id, key: 'scale', to: 1, dur: 1 }` | animate any number on an actor or prop (a portal opening, a ship fading in) |
| `{ face: id, to: angle \| otherId }` | turn instantly |
| `{ set: id, glow: '#6fd8ff', r: 36, ... }` | change properties |
| `{ attach: 'cube', to: 'loki', dx: 0, dy: 40 }` | make a prop follow an actor |
| `{ remove: id }` | remove an actor (with a puff) or a prop |
| `{ fx: 'flash' \| 'shake' \| 'alarm', t: seconds }` | screen effects |
| `{ wait: seconds }` | pause |
| `{ par: [steps] }` | run steps at the same time; done when all finish |
| `{ seq: [steps] }` | run steps one after another (useful inside `par` or `during`) |

Add `only: 'xmen'` to any top-level step to show it for one team only, or `ifExtra: true` to show it only when the player's hero joined as an extra.

### Action while a line is on screen

Add `during: [steps]` to a `say` or `narrate`, so the staging plays alongside the text. If the player continues before it has finished, it snaps to its end state.

```js
{ narrate: 'Loki opens a portal above New York City.', during: [
    { fx: 'flash' }, { tween: 'portal', key: 'scale', to: 1, dur: 1.8 }, { seq: [{ wait: 1.2 }, { set: 'swarm', on: true }] }
] }
```

## Art: stages, props and story-only characters

Register these in your campaign's own file (see `newyork-stages.js`). `g` is the canvas context, `t` is seconds since the scene began.

```js
registerStage('docks', (g, t) => { /* paint the whole 960x600 backdrop */ });
registerProp('crate', (g, p, t) => { /* draw at p.x, p.y; p.front: true draws it over the actors */ });
registerActor({ id: 'fury', name: 'Nick Fury', color: '#8b94a6',      // color tints the speech bubble and name tag
                draw(g, x, y, r, aim, alpha, actor) { /* a ball: body circle of radius r, then a head, facing angle `aim` */ } });
```

To draw a hero yourself inside a prop or stage, call `drawHeroAs(heroId, g, x, y, r, aim, alpha, opts)`.

## Testing

`node tests/run.js` validates every scene (stage, props and actors exist, every step target exists, lines fit a bubble), plays the whole
Battle of New York to the victory screen as an Avenger and as an X-Man, and checks the author's script lines and scene titles appear in order
(`STORY` in `tests/run.js`). If you change the story text, update `STORY` to match.
