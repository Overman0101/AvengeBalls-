// Global game state and the per-run reset.
let state = 'menu';      // menu | play | story | perk | over | win
let player, hammer, enemies, particles, rings, strikes, shocks, hearts, cd, clones;
let daggers, ebolts, hazards, amb, bombs, arcs, bullets, sweeps, marks;
let slowT = 0;
let hazTimer, wave, score, best = 0, spawnLeft, spawnTimer, shake, hitstop, flash, time = 0;

// Starts a fresh run. Heroes contribute their own player fields, cooldown keys and state through
// their init() / cd / reset() so this function never has to know who is playing.
function reset() {
  setFx(look.fx);
  player = Object.assign(
    { x: A.x + A.w / 2, y: A.y + A.h / 2, r: 14, hp: maxHp(), inv: 0, aim: 0, kx: 0, ky: 0, vx: 0, vy: 0 },
    ...PLAYER_INIT.map(f => f()), ...heroes().map(h => (h.init ? h.init() : {})));
  hammer = { mode: 'held', carried: null, pinned: null };   // Thor replaces this with the real hammer
  cd = Object.assign({}, ...CD_INIT, ...heroes().map(h => h.cd || {}));
  enemies = []; particles = []; rings = []; strikes = []; shocks = []; hearts = [];
  clones = []; daggers = []; ebolts = []; hazards = []; bombs = []; arcs = []; bullets = []; sweeps = []; marks = [];
  for (const h of heroes()) if (h.reset) h.reset();
  mouse.down = false; mouse.rdown = false;
  hazTimer = 2.5;
  wave = 0; score = (mode === 'campaign') ? camp.score : 0; shake = 0; hitstop = 0; flash = 0; spawnLeft = 0; spawnTimer = 0; slowT = 0;
  paused = false; $('pauseBtn').textContent = 'Pause (P)';
  state = 'play';
  teamMeter = 0; banner = null;
  if (mode === 'campaign') beginChapterSetup(); else nextWave();
}

function makeEnemy(type, x, y) {
  const t = ETYPES[type], k = mode === 'campaign' ? 0.9 : 1;
  const hpv = mode === 'campaign' ? Math.round(t.hp * (t.boss ? 1.35 : 1 + 0.12 * camp.ch) * 2) / 2 : t.hp;   // tougher each chapter, bosses much tougher
  return {
    type, x, y, r: t.r, hp: hpv, max: hpv, armor: t.armor || 0, color: t.color,
    sc: t.score, drop: t.drop, boss: !!t.boss, name: t.name || '',
    speed: t.speed + (t.boss ? 0 : wave * (t.waveSpeed || 3) * k + Math.random() * 12),
    kx: 0, ky: 0, stun: 0, pinned: false, born: time, face: 0, bite: 0,
    wx: x, wy: y, wt: 0, shoot: 1.5 + Math.random(), strafe: Math.random() < 0.5 ? 1 : -1
  };
}

function spawnEnemy() {
  const side = Math.floor(Math.random() * 4);
  const type = (mode === 'campaign' && camp.queue.length) ? camp.queue.shift() : pickType();
  let x, y;
  if (side === 0) { x = A.x + 20; y = A.y + Math.random() * A.h; }
  else if (side === 1) { x = A.x + A.w - 20; y = A.y + Math.random() * A.h; }
  else if (side === 2) { x = A.x + Math.random() * A.w; y = A.y + 20; }
  else { x = A.x + Math.random() * A.w; y = A.y + A.h - 20; }
  if (ETYPES[type].boss) { x = A.x + A.w / 2; y = A.y + 40; }
  enemies.push(makeEnemy(type, x, y));
}
