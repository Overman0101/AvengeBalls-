// Melee swings that really sweep through an arc (Wolverine's claws, Deadpool's katanas).
// startSweep() creates a weapon that winds up, whips across the arc and calls onHit(enemy, distance) as it passes each enemy.
// The blade pulls back a touch (wind-up), whips across the arc, and hits enemies as it passes them.
function startSweep(c) {
  const o0 = -c.dir * c.half;
  sweeps.push({
    kind: c.kind, mid: c.aim, half: c.half, dir: c.dir, t: 0, dur: c.dur, reach: c.reach, thick: c.thick || 1,
    onHit: c.onHit, onEnd: c.onEnd || null, hit: c.hit || new Set(), trail: [], o: o0, prevO: o0
  });
}

function sweepU(p) {                                                // 0..1 across the arc, with a small pull-back first
  const w = 0.16;
  if (p < w) return -0.12 * Math.sin(p / w * Math.PI / 2);
  const q = (p - w) / (1 - w);
  return -0.12 + 1.12 * (1 - Math.pow(1 - q, 3));
}

function updateSweeps(dt) {
  for (const sw of sweeps.slice()) {
    sw.t += dt;
    const p = Math.min(1, sw.t / sw.dur), u = sweepU(p);
    sw.prevO = sw.o; sw.o = -sw.dir * sw.half + sw.dir * 2 * sw.half * u;
    sw.trail.push(sw.o); if (sw.trail.length > 9) sw.trail.shift();
    if (p >= 0.16) {                                                // enemies are hit as the blade crosses them
      const lo = Math.min(sw.prevO, sw.o) - 0.1, hi = Math.max(sw.prevO, sw.o) + 0.1;
      for (const e of enemies.slice()) {
        if (sw.hit.has(e)) continue;
        const d = dist(e, player);
        if (d > player.r + sw.reach + e.r) continue;
        const rel = wrap(Math.atan2(e.y - player.y, e.x - player.x) - sw.mid);
        if (rel >= lo && rel <= hi) { sw.hit.add(e); sw.onHit(e, d); }
      }
    }
    if (p >= 1) {
      if (sw.onEnd) sw.onEnd(sw);
      if (sw.kind === 'claw') marks.push({ x: player.x, y: player.y, d: { mid: sw.mid, dir: sw.dir, half: sw.half, reach: sw.reach, thick: sw.thick }, life: 0.18, max: 0.18 });   // the scratch lingers and fades
      sweeps.splice(sweeps.indexOf(sw), 1);
    }
  }
}

function assistAim(a, range, cone) {                                // nudges a swing toward a close enemy so it connects
  let best = null, bd = range;
  for (const e of enemies) {
    const d = dist(e, player) - e.r;
    if (d < bd && Math.abs(wrap(Math.atan2(e.y - player.y, e.x - player.x) - a)) < cone) { bd = d; best = e; }
  }
  if (!best) return a;
  return a + clamp(wrap(Math.atan2(best.y - player.y, best.x - player.x) - a), -0.4, 0.4);
}

function lunge(a, force) {                                          // a little forward momentum so melee carries you in
  const f = enemies.some(e => dist(e, player) < 220) ? force : force * 0.45;
  player.kx += Math.cos(a) * f; player.ky += Math.sin(a) * f;
}

function drawClawSwipe(cx, cy, d, f, alpha) {                       // three tapered scratch lines in a crescent, revealed along the swipe
  const o0 = -d.dir * d.half, o1 = d.dir * d.half, rc = player.r + d.reach * 0.6, sp = 9 * d.thick, wmax = 4.4 * d.thick;
  ctx.save(); ctx.globalAlpha = alpha; ctx.shadowColor = C.bolt; ctx.shadowBlur = 10; ctx.fillStyle = '#f4f8fb';
  for (let i = -1; i <= 1; i++) {
    const rho = rc + i * sp, N = 22, gmax = f * (i === 0 ? 1 : 0.93), outer = [], inner = [];
    for (let j = 0; j <= N; j++) {
      const g = j / N * gmax, a = d.mid + o0 + (o1 - o0) * g, w = wmax * 0.5 * Math.sin(Math.PI * Math.min(1, g)) + 0.15;   // thin at both ends
      outer.push([cx + Math.cos(a) * (rho + w), cy + Math.sin(a) * (rho + w)]);
      inner.push([cx + Math.cos(a) * (rho - w), cy + Math.sin(a) * (rho - w)]);
    }
    ctx.beginPath(); ctx.moveTo(outer[0][0], outer[0][1]);
    for (const q of outer) ctx.lineTo(q[0], q[1]);
    for (let j = inner.length - 1; j >= 0; j--) ctx.lineTo(inner[j][0], inner[j][1]);
    ctx.closePath(); ctx.fill();
  }
  ctx.restore();
}

function drawSweeps() {
  for (const m of marks) drawClawSwipe(m.x, m.y, m.d, 1, m.life / m.max);
  for (const sw of sweeps) {
    const px = player.x, py = player.y;
    if (sw.kind === 'claw') {                                        // Wolverine: a claw scratch, not an extending blade
      const f = Math.max(0, Math.min(1, (sw.o + sw.dir * sw.half) / (2 * sw.dir * sw.half)));
      if (f > 0) {
        drawClawSwipe(px, py, sw, f, 1);
        const a = sw.mid + sw.o, rc = player.r + sw.reach * 0.6;       // bright tip where the claws are right now
        ctx.save(); ctx.fillStyle = '#ffffff'; ctx.shadowColor = C.bolt; ctx.shadowBlur = 14;
        ctx.beginPath(); ctx.arc(px + Math.cos(a) * rc, py + Math.sin(a) * rc, 3.2 * sw.thick, 0, 7); ctx.fill(); ctx.restore();
      }
      continue;
    }
    const r0 = player.r * (sw.kind === 'fist' ? 0.9 : 0.7), r1 = player.r + sw.reach * 0.92, n = sw.trail.length;
    for (let i = 1; i < n; i++) {                                   // fading crescent behind the blade
      const a0 = sw.mid + sw.trail[i - 1], a1 = sw.mid + sw.trail[i], al = i / n;
      ctx.fillStyle = sw.kind === 'fist' ? fx(0.5 * al * al) : 'rgba(240,247,255,' + (0.5 * al * al) + ')';
      ctx.beginPath();
      ctx.moveTo(px + Math.cos(a0) * r0, py + Math.sin(a0) * r0); ctx.lineTo(px + Math.cos(a0) * r1, py + Math.sin(a0) * r1);
      ctx.lineTo(px + Math.cos(a1) * r1, py + Math.sin(a1) * r1); ctx.lineTo(px + Math.cos(a1) * r0, py + Math.sin(a1) * r0);
      ctx.closePath(); ctx.fill();
    }
    ctx.save(); ctx.translate(px, py); ctx.rotate(sw.mid + sw.o);
    ctx.shadowColor = C.bolt; ctx.shadowBlur = 10; ctx.lineCap = 'round';
    if (sw.kind === 'katana') {                                     // two katanas, one in each hand
      for (const off of [-0.12, 0.12]) {
        ctx.save(); ctx.rotate(off);
        ctx.strokeStyle = '#f4f8fb'; ctx.lineWidth = 3.2; ctx.beginPath(); ctx.moveTo(r0 + 9, 0); ctx.lineTo(r1, 0); ctx.stroke();
        ctx.strokeStyle = '#14121a'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(r0, 0); ctx.lineTo(r0 + 9, 0); ctx.stroke();
        ctx.restore();
      }
    } else {
      ctx.strokeStyle = mixHex(look.cape, '#000000', 0.2); ctx.lineWidth = player.r * 0.55;
      ctx.beginPath(); ctx.moveTo(r0 * 0.4, 0); ctx.lineTo(r1 - 12, 0); ctx.stroke();
      ctx.fillStyle = look.cape; ctx.strokeStyle = 'rgba(0,0,0,0.45)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(r1 - 6, 0, player.r * 0.46, 0, 7); ctx.fill(); ctx.stroke();
    }
    ctx.restore();
  }
}
