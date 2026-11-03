// One simulation step. Everything hero-specific is reached through the hero hooks (see docs/ARCHITECTURE.md).
function update(dt) {
  if (slowT > 0) { slowT -= dt; dt *= 0.4; }                      // spider sense slow-motion
  time += dt;
  // particles & rings always animate
  for (const p of particles) { p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.92; p.vy *= 0.92; p.life -= dt; }
  particles = particles.filter(p => p.life > 0);
  for (const r of rings) { r.life -= dt; r.r = r.max * (1 - r.life / r.maxLife); }
  rings = rings.filter(r => r.life > 0);
  for (const s of strikes) s.life -= dt;
  strikes = strikes.filter(s => s.life > 0);
  for (const a of arcs) a.life -= dt;
  arcs = arcs.filter(a => a.life > 0);
  for (const m of marks) m.life -= dt;
  marks = marks.filter(m => m.life > 0);
  shake = Math.max(0, shake - 40 * dt);
  flash = Math.max(0, flash - dt);
  if (banner) { banner.t -= dt; if (banner.t <= 0) banner = null; }

  // ambient arena particles (snow / embers)
  const L = loc();
  if (L.ambient && amb.length < 70 && Math.random() < dt * 30) {
    if (L.ambient === 'snow') amb.push({ x: A.x + Math.random() * A.w, y: A.y, vx: (Math.random() - 0.5) * 24, vy: 30 + Math.random() * 40, s: 1.5 + Math.random() * 2, ph: Math.random() * 6 });
    else if (L.ambient === 'debris') amb.push({ x: A.x, y: A.y + Math.random() * A.h, vx: 70 + Math.random() * 90, vy: (Math.random() - 0.5) * 24, s: 1 + Math.random() * 2.4, ph: Math.random() * 6 });
    else amb.push({ x: A.x + Math.random() * A.w, y: A.y + A.h, vx: (Math.random() - 0.5) * 24, vy: -(25 + Math.random() * 50), s: 1 + Math.random() * 2.2, ph: Math.random() * 6 });
  }
  for (const a of amb) { a.x += (a.vx + Math.sin(time * 2 + a.ph) * 12) * dt; a.y += a.vy * dt; }
  amb = amb.filter(a => a.y > A.y - 4 && a.y < A.y + A.h + 4 && a.x < A.x + A.w + 4);

  if (state === 'cutscene') { updateCutscene(dt); return; }
  if (state !== 'play') return;
  if (hitstop > 0) { hitstop -= dt; return; }       // freeze frames on impact

  const HERO = hero();
  const wdt = dt * (HERO.timeScale ? HERO.timeScale() : 1);   // world time: a hero may slow enemies, their fire, geysers and spawning without slowing itself
  // player
  let mx = 0, my = 0;
  if (keys.has('KeyA') || keys.has('ArrowLeft')) mx--;
  if (keys.has('KeyD') || keys.has('ArrowRight')) mx++;
  if (keys.has('KeyW') || keys.has('ArrowUp')) my--;
  if (keys.has('KeyS') || keys.has('ArrowDown')) my++;
  const m = Math.hypot(mx, my) || 1;
  player.aim = Math.atan2(mouse.y - player.y, mouse.x - player.x);
  player.inv = Math.max(0, player.inv - dt);
  for (const k in cd) cd[k] = Math.max(0, cd[k] - dt * perks.cdr);
  const mv = (HERO.preMove && HERO.preMove(dt)) || {};       // per-frame hero logic before moving; may return { noSlip, fly, boosting }

  if (!runForcedStates(dt)) {                                 // a dash, leap, grapple... takes over movement while it lasts
    const spd = HERO.speed ? HERO.speed(mv) : 250;
    let tvx = (mx / m) * spd * perks.spd, tvy = (my / m) * spd * perks.spd;
    if (mv.fly && mx === 0 && my === 0) { tvx = Math.cos(player.aim) * spd * perks.spd; tvy = Math.sin(player.aim) * spd * perks.spd; }   // no input: fly where you aim
    if (L.slip > 0 && !mv.noSlip) {   // ice: velocity eases toward the input
      const k = Math.min(1, L.slip * dt);
      player.vx += (tvx - player.vx) * k; player.vy += (tvy - player.vy) * k;
    } else { player.vx = tvx; player.vy = tvy; }
    player.x += player.vx * dt + player.kx * dt;
    player.y += player.vy * dt + player.ky * dt;
  }
  player.kx *= 0.85; player.ky *= 0.85;
  player.x = clamp(player.x, A.x + player.r, A.x + A.w - player.r);
  player.y = clamp(player.y, A.y + player.r, A.y + A.h - player.r);

  if (HERO.update) HERO.update(dt);                           // the hero's own per-frame logic (cooldown timers, projectiles...)

  if (shocks.length) updateShocks(dt);
  if (sweeps.length) updateSweeps(dt);

  // lava geysers
  if (L.hazard) {
    hazTimer -= wdt;
    if (hazTimer <= 0 && hazards.length < 3) {
      const near = Math.random() < 0.5;
      const hx = near ? player.x + (Math.random() - 0.5) * 280 : A.x + 60 + Math.random() * (A.w - 120);
      const hy = near ? player.y + (Math.random() - 0.5) * 280 : A.y + 60 + Math.random() * (A.h - 120);
      hazards.push({ x: clamp(hx, A.x + 60, A.x + A.w - 60), y: clamp(hy, A.y + 60, A.y + A.h - 60), r: 52, t: 1.1, phase: 'warn' });
      hazTimer = Math.max(1.6, 3.2 - wave * 0.12);
    }
    for (const h of hazards.slice()) {
      h.t -= wdt;
      if (h.phase === 'warn' && h.t <= 0) {
        h.phase = 'erupt'; h.t = 0.4;
        sfx.geyser(); addShake(5); burst(h.x, h.y, 30, '#ff9a3d', 340, 0.7);
        if (Math.hypot(player.x - h.x, player.y - h.y) < h.r + player.r * 0.6) hurtPlayer(h.x, h.y, 300, null, true);
        for (const e of enemies.slice()) {
          const d = Math.hypot(e.x - h.x, e.y - h.y);
          if (d < h.r + e.r) { knock(e, (e.x - h.x) / (d || 1) * 380, (e.y - h.y) / (d || 1) * 380, 0.6); damage(e, 2); }
        }
      } else if (h.phase === 'erupt' && h.t <= 0) hazards.splice(hazards.indexOf(h), 1);
    }
  }

  // heart pickups
  for (const hr of hearts.slice()) {
    hr.life -= dt;
    if (hr.life <= 0) { hearts.splice(hearts.indexOf(hr), 1); continue; }
    if (player.hp < maxHp() && dist(hr, player) < player.r + 16) {
      hearts.splice(hearts.indexOf(hr), 1);
      player.hp++;
      sfx.heal();
      ring(player.x, player.y, 60, '#ff8a8a');
      burst(player.x, player.y, 14, '#ff8a8a', 200, 0.5);
    }
  }

  // spawning
  if (mode === 'campaign') campaignTick(wdt); else endlessTick(wdt);

  // enemies
  if (HERO.preEnemies) HERO.preEnemies(dt);                   // hero hook that runs before enemies move
  for (const e of enemies) {
    e.x += e.kx * wdt; e.y += e.ky * wdt; e.kx *= 0.88; e.ky *= 0.88;
    if (e.pinned || e.thr) continue;
    e.stun = Math.max(0, e.stun - wdt);
    if (e.stun <= 0 && e !== hammer.carried) {
      const tgt = enemyTarget(e);
      let tx, ty, sp = e.speed;
      if (tgt) { tx = tgt.x; ty = tgt.y; }
      else {                                            // lost the player: wander
        e.wt -= wdt;
        if (e.wt <= 0 || Math.hypot(e.wx - e.x, e.wy - e.y) < 12) {
          e.wx = A.x + 30 + Math.random() * (A.w - 60); e.wy = A.y + 30 + Math.random() * (A.h - 60);
          e.wt = 1.5 + Math.random() * 1.5;
        }
        tx = e.wx; ty = e.wy; sp *= 0.45;
      }
      const dx = tx - e.x, dy = ty - e.y, d = Math.hypot(dx, dy) || 1;
      e.face = Math.atan2(dy, dx);
      const T = ETYPES[e.type];                              // each enemy type may supply its own movement (js/enemies/)
      if (!(T.ai && T.ai(e, dx, dy, d, sp, wdt, tgt))) { e.x += dx / d * sp * wdt; e.y += dy / d * sp * wdt; }
    }
    e.x = clamp(e.x, A.x + e.r, A.x + A.w - e.r);
    e.y = clamp(e.y, A.y + e.r, A.y + A.h - e.r);
  }
  // soft separation
  for (let i = 0; i < enemies.length; i++) for (let j = i + 1; j < enemies.length; j++) {
    const a = enemies[i], b = enemies[j];
    if (a.pinned || b.pinned || a.thr || b.thr || a === hammer.carried || b === hammer.carried) continue;
    const d = dist(a, b), min = a.r + b.r;
    if (d > 0 && d < min) {
      const push = (min - d) / 2, nx = (a.x - b.x) / d, ny = (a.y - b.y) / d;
      a.x += nx * push; a.y += ny * push; b.x -= nx * push; b.y -= ny * push;
    }
  }
  if (HERO.postEnemies) HERO.postEnemies(dt);                 // hero hook that runs after enemies move (bites, decoys...)

  // enemy bolts (and bolts a shield has reflected back)
  for (const b of ebolts.slice()) {
    b.x += b.vx * wdt; b.y += b.vy * wdt; b.life -= wdt;
    let gone = b.life <= 0 || b.x < A.x || b.x > A.x + A.w || b.y < A.y || b.y > A.y + A.h;
    if (!gone && b.friendly) {
      for (const e of enemies.slice()) {
        if (Math.hypot(e.x - b.x, e.y - b.y) < e.r + 6) { damage(e, 2); burst(b.x, b.y, 8, '#ffffff', 200, 0.3); gone = true; break; }
      }
    } else if (!gone) {
      const act = HERO.onBolt ? HERO.onBolt(b) : null;       // hero hook: 'gone' = absorbed, 'reflected' = sent back at the enemy
      if (act === 'gone') gone = true;
      else if (act !== 'reflected') {
        for (const c of clones.slice()) { if (Math.hypot(c.x - b.x, c.y - b.y) < 18) { killClone(c); gone = true; break; } }
        if (!gone && Math.hypot(player.x - b.x, player.y - b.y) < hitR() + 6) {
          hurtPlayer(b.x - b.vx * 0.1, b.y - b.vy * 0.1, 300); gone = true;
        }
      }
    }
    if (gone) { const i = ebolts.indexOf(b); if (i >= 0) ebolts.splice(i, 1); if (state !== 'play') break; }
  }
  // enemy touches player
  for (const e of enemies) {
    if (state !== 'play') break;
    if (e.pinned || e === hammer.carried || e.stun > 0) continue;
    if (dist(e, player) < e.r + hitR()) hurtPlayer(e.x, e.y, 420, e);
  }
}