// Small maths and drawing helpers used everywhere.
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

const wrap = a => Math.atan2(Math.sin(a), Math.cos(a));

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); const t = a[i]; a[i] = a[j]; a[j] = t; } return a; }

function mixHex(a, b, t) {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const r = Math.round(((pa >> 16) & 255) * (1 - t) + ((pb >> 16) & 255) * t);
  const g2 = Math.round(((pa >> 8) & 255) * (1 - t) + ((pb >> 8) & 255) * t);
  const bl = Math.round((pa & 255) * (1 - t) + (pb & 255) * t);
  return 'rgb(' + r + ',' + g2 + ',' + bl + ')';
}

function star(g, cx, cy, R, color) {
  g.fillStyle = color; g.beginPath();
  for (let i = 0; i < 10; i++) {
    const rr = i % 2 ? R * 0.42 : R, a = -Math.PI / 2 + i * Math.PI / 5;
    g.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
  }
  g.closePath(); g.fill();
}

// T: lightning beam from the hammer toward the mouse, sweepable while it lasts
function rayEnd(x, y, a) {
  const dx = Math.cos(a), dy = Math.sin(a);
  let t = 1e9;
  if (dx > 0) t = Math.min(t, (A.x + A.w - x) / dx); else if (dx < 0) t = Math.min(t, (A.x - x) / dx);
  if (dy > 0) t = Math.min(t, (A.y + A.h - y) / dy); else if (dy < 0) t = Math.min(t, (A.y - y) / dy);
  return { x: x + dx * t, y: y + dy * t };
}

function segDist(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1, dy = y2 - y1, l2 = dx * dx + dy * dy || 1;
  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / l2));
  return Math.hypot(px - (x1 + dx * t), py - (y1 + dy * t));
}
