// The Battle of New York story, as cutscenes. Each scene is data: who is on stage, and a list of steps.
// Steps: say / narrate / card (wait for a click), spawn / move / tween / face / set / attach / remove / fx / wait (staging),
// par (run together) and seq (run in order). `during: [...]` on a say/narrate plays staged action alongside the line.
// "$player" is the hero you picked: it joins the scene as an extra unless that hero is already part of the cast.
// Full reference: docs/CUTSCENES.md
(function () {
  const PI = Math.PI, UP = -PI / 2, DOWN = PI / 2;
  const hero = (id, x, y, face, more) => Object.assign({ id, x, y, face }, id === 'hulk' ? { r: 28 } : null, more);   // the Hulk is drawn bigger

  // The team standing together, used by several scenes. The player's own hero comes last so it never duplicates the cast.
  const lineup = face => [hero('cap', 300, 445, face), hero('iron', 440, 455, face), hero('thor', 590, 448, face), hero('hulk', 740, 448, face),
                        hero('widow', 370, 395, face), hero('hawk', 530, 395, face), hero('$player', 190, 455, face)];

  // ===== SCENE 1: THE TESSERACT =====
  registerScene({
    id: 'tesseract', title: 'SCENE 1: THE TESSERACT', stage: 'lab',
    actors: [hero('fury', 250, 420, 0), hero('hawk', 330, 450, 0), hero('selvig', 650, 445, PI)],
    props: [{ id: 'cube', type: 'tesseract', x: 480, y: 390 }],
    steps: [
      { wait: 0.4 },
      { say: 'fury', text: 'The Tesseract is becoming unstable. We need to secure it immediately!' },
      { fx: 'flash' }, { spawn: { id: 'loki', x: 480, y: 250, face: DOWN }, wait: 0.5 },
      { say: 'loki', text: 'Earth is ready to kneel before me.' },
      { narrate: 'Loki steals the Tesseract, takes control of Hawkeye and Dr. Erik Selvig, and escapes.', during: [
        { seq: [
          { move: 'loki', to: [480, 340], dur: 0.9 },
          { attach: 'cube', to: 'loki', dx: 0, dy: 40 },
          { fx: 'flash' }, { set: 'hawk', glow: '#6fd8ff' }, { set: 'selvig', glow: '#6fd8ff' }, { face: 'fury', to: 'loki' },
          { wait: 0.6 },
          { par: [{ move: 'loki', to: [480, 90], dur: 1.3 }, { move: 'hawk', to: [430, 110], dur: 1.4 }, { move: 'selvig', to: [530, 110], dur: 1.4 }] },
          { fx: 'flash' }, { remove: 'loki' }, { remove: 'hawk' }, { remove: 'selvig' }, { remove: 'cube' },
          { fx: 'alarm', t: 2.5 }
        ] }
      ] },
      { wait: 0.8 }
    ]
  });

  // ===== SCENE 2: ASSEMBLING THE AVENGERS =====
  registerScene({
    id: 'assemble', title: 'SCENE 2: ASSEMBLING THE AVENGERS', stage: 'briefing',
    actors: [hero('fury', 480, 320, DOWN)],
    steps: [
      { wait: 0.4 },
      { say: 'fury', text: 'We are facing a threat that no single hero can stop. We need to bring together the strongest people on Earth.' },
      { narrate: 'Fury recruits Iron Man, Captain America, Thor, Hulk, Black Widow, and Hawkeye.', during: [
        { seq: [
          { spawn: { id: 'iron', x: 250, y: 440, face: 'fury' }, wait: 0.5 }, { spawn: { id: 'cap', x: 380, y: 450, face: 'fury' }, wait: 0.5 },
          { spawn: { id: 'thor', x: 540, y: 452, face: 'fury' }, wait: 0.5 }, { spawn: { id: 'hulk', x: 690, y: 445, r: 28, face: 'fury' }, wait: 0.5 },
          { spawn: { id: 'widow', x: 320, y: 390, face: 'fury' }, wait: 0.5 }, { spawn: { id: 'hawk', x: 640, y: 390, face: 'fury' }, wait: 0.5 }
        ] }
      ] },
      { say: 'cap', text: "So, what's our mission?" },
      { say: 'fury', text: 'Find Loki, recover the Tesseract, and save the world.' }
    ]
  });

  // ===== SCENE 3: THE TEAM CONFLICT =====
  registerScene({
    id: 'conflict', title: 'SCENE 3: THE TEAM CONFLICT', stage: 'helicarrier',
    actors: [hero('fury', 480, 300, DOWN)].concat([hero('cap', 270, 440, 0), hero('iron', 430, 452, 0), hero('thor', 600, 448, PI), hero('hulk', 780, 440, PI),
                                                   hero('widow', 350, 395, 0), hero('hawk', 570, 400, PI), hero('$player', 170, 455, 0)]),
    steps: [
      { wait: 0.3 },
      { narrate: 'The Avengers gather aboard the S.H.I.E.L.D. Helicarrier.' },
      { narrate: 'An unexpected ally has joined the team.', ifExtra: true },
      { say: 'iron', as: 'Tony Stark', text: "I work alone. I don't need a team telling me what to do." },
      { say: 'cap', as: 'Steve Rogers', text: "This isn't about you. We need to work together." },
      { narrate: 'Loki escapes, causing chaos aboard the Helicarrier. The Hulk loses control, and the team begins to fall apart.', during: [
        { seq: [
          { fx: 'alarm', t: 4 }, { fx: 'flash' }, { fx: 'shake', t: 1.2 },
          { spawn: { id: 'loki', x: 480, y: 250, face: 0 }, wait: 0.5 },
          { move: 'loki', to: [940, 140], dur: 0.9 }, { remove: 'loki' },
          { fx: 'shake', t: 1.5 }, { set: 'hulk', anger: 100, r: 36 },
          { par: [{ move: 'hulk', to: [520, 425], dur: 0.8 }, { move: 'iron', to: [120, 420], dur: 1.1 }, { move: 'cap', to: [150, 450], dur: 1.1 },
                  { move: 'thor', to: [860, 450], dur: 1.1 }, { move: 'widow', to: [100, 340], dur: 1.1 }, { move: 'hawk', to: [880, 380], dur: 1.1 },
                  { move: '$player', to: [60, 445], dur: 1.1 }] }
        ] }
      ] },
      { wait: 0.5 }
    ]
  });

  // ===== SCENE 4: THE BATTLE OF NEW YORK (the portal opens; the fighting itself is the game) =====
  registerScene({
    id: 'portal-opens', title: 'SCENE 4: THE BATTLE OF NEW YORK', stage: 'city',
    actors: lineup(UP),
    props: [{ id: 'portal', type: 'portal', x: 480, y: 150, scale: 0 }, { id: 'swarm', type: 'swarm', x: 480, y: 150, on: false }],
    steps: [
      { wait: 0.5 },
      { narrate: 'Loki opens a portal above New York City, allowing the Chitauri army to invade.', during: [
        { fx: 'flash' }, { fx: 'shake', t: 1.6 }, { tween: 'portal', key: 'scale', to: 1, dur: 1.8 }, { seq: [{ wait: 1.2 }, { set: 'swarm', on: true }] }
      ] },
      { say: 'cap', text: 'Avengers, assemble!' },
      { narrate: 'The heroes unite and fight the alien army to protect innocent civilians.', during: [
        { fx: 'flash' },
        { par: [{ move: 'cap', to: [400, 425], dur: 0.9 }, { move: 'iron', to: [480, 415], dur: 0.9 }, { move: 'thor', to: [560, 425], dur: 0.9 },
                { move: 'hulk', to: [660, 435], dur: 0.9 }, { move: 'widow', to: [340, 445], dur: 0.9 }, { move: 'hawk', to: [610, 445], dur: 0.9 },
                { move: '$player', to: [270, 445], dur: 0.9 }] }
      ] }
    ]
  });

  // ===== Mid-battle lines (after chapters 2 and 3) =====
  const midBattle = (face) => ({ stage: 'city', actors: lineup(face),
    props: [{ id: 'portal', type: 'portal', x: 480, y: 150, scale: 1 }, { id: 'swarm', type: 'swarm', x: 480, y: 150, on: true }] });
  registerScene(Object.assign(midBattle(UP), { id: 'thor-stop-loki', steps: [
    { narrate: 'A block of the avenue is clear, and then the pavement starts to shake.' },
    { say: 'thor', text: 'We must stop Loki!' },
    { narrate: 'Something enormous is coming down the street.' }
  ] }));
  registerScene(Object.assign(midBattle(UP), { id: 'iron-idea', steps: [
    { narrate: 'The beast crashes through a storefront and does not get up.' },
    { say: 'iron', text: "I've got an idea. Let's take this fight somewhere else!", during: [{ fx: 'flash' }] },
    { narrate: 'Above the tower, the portal is the only thing left, and it is still open.' }
  ] }));

  // ===== SCENE 5: THE FINAL SACRIFICE =====
  registerScene({
    id: 'sacrifice', title: 'SCENE 5: THE FINAL SACRIFICE', stage: 'sky',
    actors: [hero('widow', 330, 445, UP), hero('cap', 410, 452, UP), hero('thor', 560, 452, UP), hero('hulk', 690, 445, UP), hero('hawk', 360, 405, UP),
             hero('iron', 480, 452, UP), hero('$player', 250, 452, UP)],
    props: [{ id: 'portal', type: 'portal', x: 480, y: 150, scale: 1 }, { id: 'mothership', type: 'mothership', x: 480, y: 100, alpha: 0 },
            { id: 'missile', type: 'missile', x: 80, y: 560, ang: -0.55, front: true }],
    steps: [
      { wait: 0.4 },
      { narrate: 'A nuclear missile is launched toward New York. Iron Man intercepts it and carries it through the portal toward the alien mothership.', during: [
        { move: 'missile', to: [470, 400], dur: 1.4 },
        { seq: [{ wait: 0.8 }, { move: 'iron', to: [480, 400], dur: 0.7 }, { attach: 'missile', to: 'iron', dx: 0, dy: -26 }, { set: 'missile', ang: UP },
                { move: 'iron', to: [480, 185], dur: 1.8 }] }
      ] },
      { say: 'widow', text: 'The portal is closing!', during: [{ tween: 'portal', key: 'scale', to: 0.6, dur: 2 }] },
      { narrate: 'Iron Man successfully destroys the mothership and falls back through the portal just before it closes.', during: [
        { seq: [
          { remove: 'iron' }, { remove: 'missile' }, { set: 'mothership', alpha: 1 }, { wait: 0.6 },
          { fx: 'flash' }, { fx: 'shake', t: 1.4 }, { remove: 'mothership' }, { wait: 0.4 },
          { spawn: { id: 'iron', x: 480, y: 170, face: DOWN }, wait: 0.2 },
          { par: [{ move: 'iron', to: [480, 452], dur: 1.5 }, { tween: 'portal', key: 'scale', to: 0, dur: 1.4 }] }
        ] }
      ] },
      { wait: 0.6 }
    ]
  });

  // ===== SCENE 6: THE VICTORY =====
  registerScene({
    id: 'victory', title: 'SCENE 6: THE VICTORY', stage: 'victory',
    actors: lineup(DOWN),
    props: [{ id: 'cube', type: 'tesseract', x: -200, y: -200 }],
    steps: [
      { wait: 0.4 },
      { narrate: 'The Chitauri army is defeated. New York is saved.' },
      { say: 'cap', text: 'We did it. We actually did it.' },
      { say: 'iron', as: 'Tony Stark', text: "Don't get used to it, Captain." },
      { narrate: 'Thor takes Loki and the Tesseract back to Asgard. The Avengers go their separate ways.', during: [
        { seq: [
          { spawn: { id: 'loki', x: 650, y: 445, face: PI }, wait: 0.4 }, { attach: 'cube', to: 'thor', dx: 0, dy: -32 }, { wait: 0.6 },
          { fx: 'flash' }, { par: [{ move: 'thor', to: [590, 50], dur: 1.2 }, { move: 'loki', to: [650, 50], dur: 1.2 }] },
          { remove: 'thor' }, { remove: 'loki' }, { remove: 'cube' }, { wait: 0.4 },
          { par: [{ move: 'cap', to: [-80, 445], dur: 2 }, { move: 'iron', to: [1040, 455], dur: 2 }, { move: 'hulk', to: [1040, 420], dur: 2.2 },
                  { move: 'widow', to: [-80, 395], dur: 2 }, { move: 'hawk', to: [1040, 395], dur: 2 }, { move: '$player', to: [-80, 455], dur: 2 }] }
        ] }
      ] }
    ]
  });

  // ===== SCENE 7: POST-CREDITS =====
  registerScene({
    id: 'shawarma', title: 'SCENE 7: POST-CREDITS', stage: 'restaurant',
    actors: [hero('iron', 290, 385, 0, { munch: true }), hero('cap', 390, 300, DOWN, { munch: true }), hero('thor', 570, 300, DOWN, { munch: true }),
             hero('hulk', 670, 385, PI, { munch: true }), hero('widow', 400, 450, UP, { munch: true }), hero('hawk', 560, 450, UP, { munch: true }),
             hero('$player', 480, 300, DOWN, { munch: true })],
    props: [{ id: 'food', type: 'food', x: 480, y: 385 }],
    steps: [
      { wait: 0.6 },
      { narrate: 'The Avengers gather at a small restaurant and quietly eat shawarma after saving the world.' },
      { wait: 2.2 },
      { card: 'THE END.' }
    ]
  });
})();
