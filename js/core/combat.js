// Particles, knockback, damage and the player getting hurt. Used by every hero and enemy.
function burst(x, y, n, color, speed = 260, life = 0.5) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, s = Math.random() * speed;
    particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life, max: life, color, size: 1.5 + Math.random() * 2.5 });
  }
}

function ring(x, y, max, color) { rings.push({ x, y, r: 6, max, life: 0.35, maxLife: 0.35, color }); }

function addShake(n) { shake = Math.max(shake, calm ? n * 0.2 : n); }

function knock(e, vx, vy, stun) {
  if (e.pinned) return;
  if (e.boss) { vx *= 0.15; vy *= 0.15; stun = Math.min(stun, 0.4); }   // bosses shrug off most knockback and stuns
  e.kx = vx; e.ky = vy; e.stun = Math.max(e.stun, stun);
}

function killBoltsNear(x, y, r) {
  for (const b of ebolts.slice()) {
    if (!b.friendly && Math.hypot(b.x - x, b.y - y) < r) { burst(b.x, b.y, 5, C.bolt, 160, 0.3); ebolts.splice(ebolts.indexOf(b), 1); }
  }
}

function explodeAt(x, y, r, dmg, color) {                       // generic area blast, used by missiles and bombs
  ring(x, y, r, color || C.bolt); burst(x, y, 14, color || C.bolt, 280, 0.5);
  addShake(4); sfx.boom();
  for (const e of enemies.slice()) {
    const d = Math.hypot(e.x - x, e.y - y);
    if (d < r + e.r) {
      knock(e, (e.x - x) / (d || 1) * 380, (e.y - y) / (d || 1) * 380, 0.4);
      damage(e, dmg);
    }
  }
}

function damage(e, n) {
  n *= perks.dmg;
  if (e.marked && e.marked > time) n *= 1.5;                       // marked by Hunter's Scent
  if (e.armor) n = Math.max(0.5, n - e.armor);        // armored enemies shrug off weak hits
  e.hp -= n;
  burst(e.x, e.y, 8, e.armor && n < 1 ? C.iron : C.ember, 200, 0.4);
  if (e.hp <= 0) {
    score += e.sc;
    teamMeter = Math.min(100, teamMeter + 5 * perks.tg);
    if (Math.random() < e.drop + perks.drop) hearts.push({ x: e.x, y: e.y, life: 10 });
    burst(e.x, e.y, 22, C.bolt, 320, 0.6);
    if (hammer.carried === e) hammer.carried = null;
    if (hammer.pinned === e) hammer.pinned = null;
    enemies.splice(enemies.indexOf(e), 1);
    return true;
  }
  return false;
}

function healHeart() {
  if (player.hp >= maxHp()) return;
  player.hp++; ring(player.x, player.y, 50, '#7dff9a'); burst(player.x, player.y, 10, '#7dff9a', 200, 0.5); sfx.heal();
}

function killClone(c) {
  ring(c.x, c.y, 50, C.bolt); burst(c.x, c.y, 18, C.bolt, 260, 0.5);
  clones.splice(clones.indexOf(c), 1);
}

function enemyTarget(e) {
  let best = null, bd = 1e9;
  if (!(player.invis > 0) || dist(e, player) < 70) { best = player; bd = dist(e, player); }
  for (const c of clones) { const d = dist(e, c); if (d < bd) { bd = d; best = c; } }
  return best;
}

// src is the attacking enemy when there is one, so a block can shove it back.
// A hero can absorb or soften the hit through its onHurt(h) hook (h = { sx, sy, kb, src, noBlock }).
function hurtPlayer(sx, sy, kb = 420, src = null, noBlock = false) {
  if (player.inv > 0) return false;
  const h = { sx, sy, kb, src, noBlock }, HERO = hero();
  if (HERO.onHurt && HERO.onHurt(h)) return false;           // true = the hit was absorbed
  kb = h.kb;
  player.hp--; player.inv = 1.1; player.invis = 0;
  const d = Math.hypot(player.x - sx, player.y - sy) || 1;
  player.kx = (player.x - sx) / d * kb; player.ky = (player.y - sy) / d * kb;
  sfx.hurt(); addShake(8); hitstop = 0.06;
  burst(player.x, player.y, 14, C.ember, 260, 0.5);
  if (player.hp <= 0) { state = 'over'; best = Math.max(best, score); }
  return true;
}

// Radius used to test whether enemies and bolts touch the player (a hero can shrink it, e.g. a big sprite with a fair hitbox).
const hitR = () => { const HERO = hero(); return HERO.hitRadius ? HERO.hitRadius() : player.r; };
