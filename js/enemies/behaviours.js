// Reusable enemy behaviours. An enemy type opts in with:  ai(e, dx, dy, d, sp, dt, tgt) { return behaviour(...); }
// Return true if the behaviour moved the enemy, false to fall back to the default "walk at the target".

// Keeps its distance, strafes, and fires bolts. Needs  shoot: { every, speed, col }  on the enemy type.
function kiteAndShoot(e, dx, dy, d, sp, dt) {
  const S = ETYPES[e.type].shoot;
  let vx, vy;
  if (d > 300) { vx = dx / d; vy = dy / d; }
  else if (d < 210) { vx = -dx / d; vy = -dy / d; }
  else { vx = -dy / d * e.strafe; vy = dx / d * e.strafe; }
  e.x += vx * sp * dt; e.y += vy * sp * dt;
  e.shoot -= dt;
  if (e.shoot <= 0 && d < 470) {
    e.shoot = S.every + Math.random() * 0.8;
    ebolts.push({ x: e.x, y: e.y, vx: dx / d * S.speed, vy: dy / d * S.speed, life: 3, friendly: false, col: S.col });
    ring(e.x, e.y, 26, '#c58cf0'); sfx.spit();
  }
  return true;
}

// Cruises toward the target, telegraphs with a red lane, then dashes. An enemy type may add  tick(e, dt)  for extra per-frame tricks (boss summons, volleys).
function chargerMove(e, dx, dy, d, sp, dt, tgt) {
  if (!tgt) { e.x += dx / d * sp * dt; e.y += dy / d * sp * dt; return; }
  if (e.cs === undefined) { e.cs = 'cruise'; e.ct = e.boss ? 3 : 1.5 + Math.random() * 1.5; e.bt = 3; }
  e.ct -= dt;
  if (e.cs === 'cruise') {
    e.x += dx / d * sp * dt; e.y += dy / d * sp * dt;
    if (e.ct <= 0 && d < 560) { e.cs = 'wind'; e.ct = e.boss ? 0.85 : 0.5; e.dashA = Math.atan2(dy, dx); }
  } else if (e.cs === 'wind') {
    if (e.ct > 0.2) e.dashA = Math.atan2(dy, dx);                    // locks its aim for the last moment
    if (e.ct <= 0) { e.cs = 'dash'; e.ct = e.boss ? 0.6 : 0.5; }
  } else {
    const ds = e.boss ? 430 : 560;
    e.x += Math.cos(e.dashA) * ds * dt; e.y += Math.sin(e.dashA) * ds * dt;
    if (e.ct <= 0) { e.cs = 'cruise'; e.ct = e.boss ? 4.5 : 2.5 + Math.random() * 1.5; }
  }
  const T = ETYPES[e.type]; if (T.tick) T.tick(e, dt);
}
