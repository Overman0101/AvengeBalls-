// Projectiles and chain effects used by more than one hero: bullets (Widow, Deadpool),
// throwing daggers (Loki, Deadpool), bombs (Iron Man, Deadpool) and electric arcs.
function chainArcs(from, n, range, stun, dmg) {                  // lightning jumps from one enemy to the next nearest
  const done = new Set([from]);
  let cur = from;
  for (let i = 0; i < n; i++) {
    let best = null, bd = range;
    for (const o of enemies) { if (done.has(o)) continue; const d = dist(cur, o); if (d < bd) { bd = d; best = o; } }
    if (!best) break;
    arcs.push({ x1: cur.x, y1: cur.y, x2: best.x, y2: best.y, life: 0.25 });
    done.add(best); knock(best, 0, 0, stun); damage(best, dmg); cur = best;
  }
}

function updateBullets(dt) {
  for (const b of bullets.slice()) {
    const total = Math.hypot(b.vx, b.vy) * dt, steps = Math.max(1, Math.ceil(total / 10));
    let gone = false;
    for (let s = 0; s < steps && !gone; s++) {
      b.x += b.vx * dt / steps; b.y += b.vy * dt / steps;
      for (const e of enemies.slice()) {
        if (Math.hypot(e.x - b.x, e.y - b.y) < e.r + 3) {
          burst(e.x, e.y, 3, C.bolt, 140, 0.2); knock(e, b.vx * 0.05, b.vy * 0.05, 0.08); damage(e, b.dmg);
          gone = true; break;
        }
      }
      if (!gone && (b.x < A.x || b.x > A.x + A.w || b.y < A.y || b.y > A.y + A.h)) { burst(b.x, b.y, 2, C.bolt, 100, 0.2); gone = true; }
    }
    b.life -= dt;
    if (gone || b.life <= 0) bullets.splice(bullets.indexOf(b), 1);
  }
}

function updateDaggers(dt) {
  for (const d of daggers.slice()) {
    const total = 1000 * dt, steps = Math.max(1, Math.ceil(total / 12)), step = total / steps;
    let gone = false;
    for (let s = 0; s < steps && !gone; s++) {
      d.x += Math.cos(d.ang) * step; d.y += Math.sin(d.ang) * step;
      for (const e of enemies.slice()) {
        if (d.hit.has(e)) continue;
        if (Math.hypot(e.x - d.x, e.y - d.y) < e.r + 6) {
          d.hit.add(e);
          sfx.hit(); burst(e.x, e.y, 6, C.bolt, 200, 0.3);
          knock(e, Math.cos(d.ang) * 160, Math.sin(d.ang) * 160, 0.25);
          damage(e, d.dmg);
        }
      }
      if (d.x < A.x || d.x > A.x + A.w || d.y < A.y || d.y > A.y + A.h) gone = true;
    }
    d.life -= dt;
    if (gone || d.life <= 0) daggers.splice(daggers.indexOf(d), 1);
  }
}

function updateBombs(dt) {
  for (const b of bombs.slice()) {
    if (b.stage === 'fly') {
      b.t += dt; const p = Math.min(1, b.t / b.dur);
      b.x = b.sx + (b.tx - b.sx) * p; b.y = b.sy + (b.ty - b.sy) * p;
      if (p >= 1) {
        bombs.splice(bombs.indexOf(b), 1);
        explodeAt(b.x, b.y, b.rad || 85, b.dmg || 3, '#ffb36b');
        for (let i = 0; i < (b.plain ? 0 : 5); i++) {
          const a = Math.random() * 6.283, r = 40 + Math.random() * 40;
          bombs.push({ stage: 'tick', x: clamp(b.x + Math.cos(a) * r, A.x + 10, A.x + A.w - 10), y: clamp(b.y + Math.sin(a) * r, A.y + 10, A.y + A.h - 10), t: 0.5 + Math.random() * 0.3 });
        }
      }
    } else {
      b.t -= dt;
      if (b.t <= 0) { bombs.splice(bombs.indexOf(b), 1); explodeAt(b.x, b.y, 48, 1.5, '#ffb36b'); }
    }
  }
}

function drawSharedProjectiles() {
  for (const d of daggers) {
    ctx.save(); ctx.translate(d.x, d.y); ctx.rotate(d.ang); ctx.shadowColor = C.bolt; ctx.shadowBlur = 10;
    ctx.fillStyle = C.bolt;
    ctx.beginPath(); ctx.moveTo(12, 0); ctx.lineTo(-8, -3.5); ctx.lineTo(-4, 0); ctx.lineTo(-8, 3.5); ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  for (const b of bombs) {
    ctx.save();
    if (b.stage === 'fly') {
      const p = Math.min(1, b.t / b.dur), h = Math.sin(p * Math.PI) * 30;
      ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(b.x, b.y, 7, 3.5, 0, 0, 7); ctx.fill();
      ctx.fillStyle = '#e0b83c'; ctx.beginPath(); ctx.arc(b.x, b.y - h, 7, 0, 7); ctx.fill();
    } else {
      const on = Math.floor(b.t * 14) % 2 === 0;
      ctx.shadowColor = '#ff7a30'; ctx.shadowBlur = on ? 14 : 4;
      ctx.fillStyle = on ? '#ff7a30' : '#e0b83c'; ctx.beginPath(); ctx.arc(b.x, b.y, 5, 0, 7); ctx.fill();
    }
    ctx.restore();
  }
  for (const b of bullets) {
    const a = Math.atan2(b.vy, b.vx);
    ctx.save(); ctx.shadowColor = C.bolt; ctx.shadowBlur = 8; ctx.lineCap = 'round';
    ctx.strokeStyle = C.bolt; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(b.x - Math.cos(a) * 14, b.y - Math.sin(a) * 14); ctx.lineTo(b.x, b.y); ctx.stroke();
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(b.x - Math.cos(a) * 8, b.y - Math.sin(a) * 8); ctx.lineTo(b.x, b.y); ctx.stroke();
    ctx.restore();
  }
  if (player.zip) {                                             // grapple rope while zipping
    ctx.strokeStyle = 'rgba(230,230,230,0.7)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(player.x, player.y); ctx.lineTo(player.zip.tx, player.zip.ty); ctx.stroke();
  }
  for (const a of arcs) {                                        // electric arcs (shock arrow, Widow's Bite)
    ctx.save(); ctx.globalAlpha = Math.min(1, a.life / 0.15); ctx.shadowColor = C.bolt; ctx.shadowBlur = 16;
    bolt(a.x1, a.y1, a.x2, a.y2, 22, C.bolt, 4); bolt(a.x1, a.y1, a.x2, a.y2, 12, '#ffffff', 1.5);
    ctx.restore();
  }

}
