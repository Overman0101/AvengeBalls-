// TEMPLATE HERO. Copy this file to js/heroes/<yourhero>.js, rename the id/name, and add one line to index.html:
//     <script src="js/heroes/<yourhero>.js"></script>        (anywhere before js/ui/menu.js)
// That is all. The menu card, team roster, customiser, HUD skill bar and pause screen are built from what you register here.
// This one is a small but fully playable hero: click fires a bolt, Q is a shockwave, Space is the shared dodge roll.
//
// Everything is wrapped in a function so your helper names can never clash with another hero's.
// Engine globals you can use freely: player, enemies, cd, mouse, keys, perks, hero(), dist(), clamp(), wrap(), knock(), damage(),
// burst(), ring(), addShake(), healHeart(), killBoltsNear(), explodeAt(), sfx, tone(), and the shared projectiles:
// bullets / daggers / bombs are moved and hit-tested by updateBullets(dt) / updateDaggers(dt) / updateBombs(dt) (call them from update()).
(function () {
  function fireBolt() {                                             // click (hold to keep firing)
    if (cd.tpl_shot > 0 || player.roll > 0) return;
    cd.tpl_shot = 0.2;
    const a = player.aim;
    bullets.push({ x: player.x + Math.cos(a) * 18, y: player.y + Math.sin(a) * 18, vx: Math.cos(a) * 1100, vy: Math.sin(a) * 1100, dmg: 1.5, life: 0.8 });
    sfx.gun();
  }
  function castWave() {                                             // Q: a stunning ring around you
    if (cd.tpl_wave > 0) return;
    cd.tpl_wave = 6;
    shocks.push({ x: player.x, y: player.y, r: 10, max: 180, hit: new Set() });   // without visual:true it also hurts and shoves
    sfx.shock(); addShake(6);
  }

  registerHero({
    id: 'template', name: 'Template Hero', team: 'avengers', order: 99,
    blurb: 'A starting point for new heroes. Fires bolts and a shockwave.',
    look: {                                                          // customiser: capeLab names the colour swatch, gears are headgear options
      capeLab: 'Suit', cape: '#3a6fc9', fx: '#a8ecff', hair: '#2a1a14',
      gears: ['Bare head', 'Helmet'],
      help: '<b>Hold click</b> fires bolts. <b>Q</b> shockwave. <b>Space</b> dodge roll. WASD to move, mouse to aim, <b>P</b> to pause.',
      keys: ['Hold click: bolt     Space: dodge roll', 'Q shockwave']      // lines shown on the pause screen
    },
    cd: { tpl_shot: 0, tpl_wave: 0 },                                // cooldown keys you use (prefix them so they stay unique)
    init: () => ({}),                                                // extra fields to add to `player` (all heroes' fields are merged)
    onKey(code) {                                                    // key presses (not key-repeat)
      if (code === 'KeyQ') castWave();
      if (code === 'Space') castRoll();                              // castRoll() is shared by several heroes
    },
    onMouse(button) { if (button !== 2) { mouse.down = true; fireBolt(); } },
    speed() { return 255; },                                         // base walking speed in pixels per second
    update(dt) {                                                     // runs every frame after movement
      if (mouse.down) fireBolt();
      updateBullets(dt);                                             // the shared bullet array is moved by the shared updater: call it from here
    },
    skills() {                                                       // the skill bar; cd/max draw the cooldown fill
      return [
        { k: 'M1', n: 'Bolt', cd: cd.tpl_shot, max: 0.2, ok: true },
        { k: 'Q', n: 'Wave', cd: cd.tpl_wave, max: 6, ok: true },
        { k: 'Space', n: 'Dodge', cd: cd.roll, max: 2.5, ok: !player.zip }
      ];
    },
    message() { return 'Hold click to fire. Q for a shockwave.'; },  // the line under the wave counter
    aimLine() { return 520; }                                        // dotted aim line length (0 = none)
  });
})();
