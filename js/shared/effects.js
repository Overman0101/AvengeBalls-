// Visual shockwave rings. Pushing { x, y, r: 10, max, visual: true, hit: new Set() } onto shocks draws a ring;
// without visual: true the ring also damages and shoves enemies it passes through.
function updateShocks(dt) {
  for (const s of shocks) {
    s.r += 620 * dt;
    if (s.visual) continue;                           // visual-only rings (Cap's slam) deal no extra damage
    for (const e of enemies.slice()) {
      if (s.hit.has(e)) continue;
      const d = Math.hypot(e.x - s.x, e.y - s.y);
      if (d < s.r + e.r) {
        s.hit.add(e);
        knock(e, (e.x - s.x) / (d || 1) * 650, (e.y - s.y) / (d || 1) * 650, 0.8);
        sfx.hit();
        damage(e, 1);
      }
    }
    killBoltsNear(s.x, s.y, s.r + 10);
  }
  shocks = shocks.filter(s => s.r < s.max);
}
