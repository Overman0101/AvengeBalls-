// Movement mechanics several heroes share: dodge rolls and flips, grapple zips and leaps.
// Each registers a "forced state": while it is active it takes control of the player's movement.
// A leap object may carry { heavy: true, onHit(enemy) } for a bigger landing and a per-enemy callback.
PLAYER_INIT.push(() => ({ roll: 0, flip: 0, dodgeA: 0, zip: null, leap: null }));
CD_INIT.push({ roll: 0 });

function inputDir() {
  let mx = 0, my = 0;
  if (keys.has('KeyA') || keys.has('ArrowLeft')) mx--;
  if (keys.has('KeyD') || keys.has('ArrowRight')) mx++;
  if (keys.has('KeyW') || keys.has('ArrowUp')) my--;
  if (keys.has('KeyS') || keys.has('ArrowDown')) my++;
  return (mx || my) ? Math.atan2(my, mx) : player.aim;
}

// Space: dodge roll
function castRoll() {
  if (cd.roll > 0 || player.roll > 0 || player.zip) return;
  cd.roll = 2.5; player.roll = 0.25; player.dodgeA = inputDir();
  ring(player.x, player.y, 30, C.bolt); sfx.swing();
}

function updateDodge(dt, key, spd) {                             // Hawkeye's roll and Widow's flip
  player[key] -= dt;
  player.x = clamp(player.x + Math.cos(player.dodgeA) * spd * dt, A.x + player.r, A.x + A.w - player.r);
  player.y = clamp(player.y + Math.sin(player.dodgeA) * spd * dt, A.y + player.r, A.y + A.h - player.r);
  player.inv = Math.max(player.inv, 0.2); player.vx = 0; player.vy = 0;
  particles.push({ x: player.x, y: player.y, vx: 0, vy: 0, life: 0.25, max: 0.25, color: C.bolt, size: 5 });
}

function updateZip(dt) {                                         // grappling zip toward an anchor point
  const Z = player.zip, dx = Z.tx - player.x, dy = Z.ty - player.y, d = Math.hypot(dx, dy) || 1;
  const total = 1300 * dt, steps = Math.max(1, Math.ceil(total / 10)), step = total / steps;
  for (let s = 0; s < steps; s++) {
    player.x += dx / d * step; player.y += dy / d * step;
    for (const e of enemies.slice()) {
      if (Z.hit.has(e)) continue;
      if (dist(e, player) < e.r + player.r + 8) {
        Z.hit.add(e); sfx.hit(); addShake(4);
        knock(e, dx / d * 380, dy / d * 380, 0.4); damage(e, 1);
      }
    }
    if (Math.hypot(Z.tx - player.x, Z.ty - player.y) < 24) {
      if (Z.mom) { player.kx = dx / d * Z.mom; player.ky = dy / d * Z.mom; }
      player.zip = null;
      ring(player.x, player.y, 70, C.bolt); burst(player.x, player.y, 14, C.bolt, 240, 0.4); addShake(5);
      for (const e of enemies) { const dd = dist(e, player); if (dd < 80) knock(e, (e.x - player.x) / (dd || 1) * 350, (e.y - player.y) / (dd || 1) * 350, 0.4); }
      return;
    }
  }
  player.inv = Math.max(player.inv, 0.2); player.vx = 0; player.vy = 0;
  particles.push({ x: player.x, y: player.y, vx: 0, vy: 0, life: 0.3, max: 0.3, color: C.bolt, size: 5 });
}

function updateLeap(dt) {
  const L = player.leap; L.t += dt;
  const p = Math.min(1, L.t / L.dur);
  player.x = L.sx + (L.tx - L.sx) * p; player.y = L.sy + (L.ty - L.sy) * p;
  player.inv = Math.max(player.inv, 0.2); player.vx = 0; player.vy = 0;
  if (p >= 1) {
    player.leap = null;
    const R = L.rad || 110, D = L.dmg || 2;
    ring(player.x, player.y, R, '#ffffff'); ring(player.x, player.y, R * 0.64, C.bolt);
    burst(player.x, player.y, 28, '#ffffff', 340, 0.6);
    if (L.heavy) shocks.push({ x: player.x, y: player.y, r: 10, max: R, visual: true, hit: new Set() });
    addShake(L.heavy ? 15 : 12); hitstop = 0.08; sfx.slam();
    for (const e of enemies.slice()) {
      const d = dist(e, player);
      if (d < R + e.r) {
        knock(e, (e.x - player.x) / (d || 1) * 650, (e.y - player.y) / (d || 1) * 650, 0.8);
        damage(e, D);
        if (L.onHit) L.onHit(e);
      }
    }
    killBoltsNear(player.x, player.y, R);
  }
}

registerForcedState(30, () => player.leap, updateLeap);
registerForcedState(40, () => player.roll > 0, dt => updateDodge(dt, 'roll', 760));
registerForcedState(50, () => player.flip > 0, dt => updateDodge(dt, 'flip', 820));
registerForcedState(60, () => player.zip, updateZip);
