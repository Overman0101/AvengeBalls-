// Draws a hero's top-down body. The shared parts (suit disc, head, hair, facing marker) live here;
// each hero adds its own gear overlay through hero.gear(g, c) and may add a ring (bodyRing) or take over completely (drawBody).
function drawChar(g, x, y, r, aim, alpha, opt) {
  const HERO = HEROES[look.char], unsuited = !!(opt && opt.unsuited), gear = look.gear;
  if (HERO.drawBody) { HERO.drawBody(g, x, y, r, aim, alpha, opt); return; }
  const hr = HERO.modern ? r - 4 : r - 2;                          // head radius
  g.save(); g.translate(x, y); g.globalAlpha = alpha;
  g.fillStyle = unsuited ? '#39404d' : look.cape;                // cape / suit body
  g.beginPath(); g.arc(0, 0, r + 2, 0, 7); g.fill();
  if (HERO.bodyRing) HERO.bodyRing(g, r, unsuited);
  g.fillStyle = '#d9c3a0';                                       // head
  g.beginPath(); g.arc(0, 0, hr, 0, 7); g.fill();
  g.rotate(aim);
  g.fillStyle = CHARS[look.char].hair;                           // hair on the back half
  g.beginPath(); g.arc(0, 0, hr - 1, Math.PI * 0.55, Math.PI * 1.45); g.closePath(); g.fill();
  if (HERO.gear) HERO.gear(g, { r, hr, gear, unsuited });
  g.fillStyle = '#e7eef4';                                       // facing marker
  g.beginPath(); g.moveTo(r + 3, 0); g.lineTo(r - 5, -5); g.lineTo(r - 5, 5); g.fill();
  g.restore();
}
