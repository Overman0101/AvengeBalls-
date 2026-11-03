// The current arena, its fixed floor cracks, and the hook that draws a location's own decoration.
// Locations are registered with registerLocation() in js/world/ and js/campaigns/.
let locKey = 'asgard';
const loc = () => LOCS[locKey];
const floorLines = [];                                   // fixed decorative cracks / sheen, same every run
{ let sd = 7; const rnd = () => { sd = (sd * 9301 + 49297) % 233280; return sd / 233280; };
  for (let i = 0; i < 8; i++) {
    let x = A.x + rnd() * A.w, y = A.y + rnd() * A.h; const pts = [[x, y]];
    for (let j = 0; j < 5; j++) { x += (rnd() - 0.5) * 120; y += (rnd() - 0.5) * 120; pts.push([x, y]); }
    floorLines.push(pts);
  } }

// Locations may define decor(cx, cy), drawn on the floor inside the arena (clipped to it).
function drawDecor() {
  const L = loc();
  if (!L.decor) return;
  ctx.save(); ctx.beginPath(); ctx.rect(A.x, A.y, A.w, A.h); ctx.clip();
  L.decor(W / 2, A.y + A.h / 2);
  ctx.restore();
}
