// Frame rendering: arena, entities, hero layers, then the HUD. Hero art is reached through the hero draw hooks.
function bolt(x1, y1, x2, y2, jag, col, w) {
  const d = Math.hypot(x2 - x1, y2 - y1);
  if (d < 1) return;
  const n = Math.max(2, Math.floor(d / 22)), nx = -(y2 - y1) / d, ny = (x2 - x1) / d;
  ctx.beginPath(); ctx.moveTo(x1, y1);
  for (let i = 1; i < n; i++) {
    const t = i / n, o = (Math.random() - 0.5) * jag;
    ctx.lineTo(x1 + (x2 - x1) * t + nx * o, y1 + (y2 - y1) * t + ny * o);
  }
  ctx.lineTo(x2, y2); ctx.strokeStyle = col; ctx.lineWidth = w; ctx.stroke();
}

function drawHeart(cx, cy, s, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(cx, cy + s * 0.9);
  ctx.bezierCurveTo(cx - s * 1.3, cy + s * 0.1, cx - s * 0.8, cy - s * 0.9, cx, cy - s * 0.3);
  ctx.bezierCurveTo(cx + s * 0.8, cy - s * 0.9, cx + s * 1.3, cy + s * 0.1, cx, cy + s * 0.9);
  ctx.fill();
}

// The default enemy body: a round blob with eyes (grunts). Enemy types without their own draw() use this.
function drawRoundEnemy(e, r) {
  ctx.beginPath(); ctx.arc(0, 0, r, 0, 7); ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#1a0f0b';
  ctx.fillRect(-r * 0.55, -r * 0.25, r * 0.4, r * 0.28);
  ctx.fillRect(r * 0.15, -r * 0.25, r * 0.4, r * 0.28);
}

function drawEnemy(e) {
  const spawnT = Math.min(1, (time - e.born) / 0.25);
  const col = e.stun > 0 || e.pinned ? '#c9a08a' : e.color;
  ctx.save(); ctx.translate(e.x, e.y); ctx.scale(spawnT, spawnT);
  if (e.pinned) { ctx.shadowColor = C.bolt; ctx.shadowBlur = 16; }
  ctx.fillStyle = col;
  const r = e.r;
  const T = ETYPES[e.type];
  if (T.draw) T.draw(e, r);                                          // custom body from the enemy type (js/enemies/)
  else drawRoundEnemy(e, r);
  if (e.pinned) { ctx.strokeStyle = C.bolt; ctx.lineWidth = 2; ctx.shadowBlur = 0; ctx.beginPath(); ctx.arc(0, 0, r + 6, 0, 7); ctx.stroke(); }
  if (e.webT && e.webT > time) {                                       // wrapped in webbing
    ctx.shadowBlur = 0; ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 1.2;
    ctx.beginPath();
    for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a) * (r + 5), Math.sin(a) * (r + 5)); }
    ctx.stroke();
    ctx.beginPath(); ctx.arc(0, 0, r * 0.55, 0, 7); ctx.arc(0, 0, r * 0.95, 0, 7); ctx.stroke();
  }
  if (e.elec > 0) {                                                    // crackling with electricity
    ctx.shadowBlur = 0; ctx.strokeStyle = C.bolt; ctx.lineWidth = 2; ctx.beginPath();
    for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2 + time * 12, rr = r + 2 + Math.random() * 7; ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
    ctx.closePath(); ctx.stroke();
  }
  ctx.restore();
  if (e.marked && e.marked > time) {                                   // marked by Hunter's Scent
    ctx.save(); ctx.translate(e.x, e.y); ctx.strokeStyle = 'rgba(255,70,70,0.9)'; ctx.lineWidth = 1.5;
    const rr = e.r + 8 + Math.sin(time * 8) * 1.5;
    ctx.beginPath(); ctx.arc(0, 0, rr, 0, 7);
    ctx.moveTo(-rr - 5, 0); ctx.lineTo(-rr + 4, 0); ctx.moveTo(rr - 4, 0); ctx.lineTo(rr + 5, 0);
    ctx.moveTo(0, -rr - 5); ctx.lineTo(0, -rr + 4); ctx.moveTo(0, rr - 4); ctx.lineTo(0, rr + 5);
    ctx.stroke(); ctx.restore();
  }
  if (e.cs === 'wind') {                                               // charge telegraph
    ctx.save(); ctx.translate(e.x, e.y); ctx.rotate(e.dashA);
    ctx.globalAlpha = 0.25 + 0.3 * Math.abs(Math.sin(time * 14)); ctx.fillStyle = '#ff5050';
    ctx.fillRect(0, -e.r * 0.7, 340, e.r * 1.4); ctx.restore();
  }
  if (e.hp < e.max && !e.boss) {                       // health pips
    const n = Math.ceil(e.max);
    for (let i = 0; i < n; i++) {
      ctx.fillStyle = i < e.hp ? C.ink : 'rgba(255,255,255,0.15)';
      ctx.fillRect(e.x - n * 3 + i * 6, e.y - e.r - 12, 4, 4);
    }
  }
}

function draw() {
  ctx.save();
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = '#0f1620'; ctx.fillRect(0, 0, W, H);

  if (shake > 0) ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);

  // arena floor
  const L = loc();
  const g = ctx.createRadialGradient(W / 2, A.y + A.h / 2, 40, W / 2, A.y + A.h / 2, 520);
  g.addColorStop(0, L.f0); g.addColorStop(1, L.f1);
  ctx.fillStyle = g; ctx.fillRect(A.x, A.y, A.w, A.h);
  // rune circles
  ctx.strokeStyle = L.camp ? 'rgba(0,0,0,0)' : fx(0.10); ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(W / 2, A.y + A.h / 2, 170, 0, 7); ctx.stroke();
  ctx.beginPath(); ctx.arc(W / 2, A.y + A.h / 2, 120, 0, 7); ctx.stroke();
  drawDecor();
  // ice sheen / lava cracks
  if (L.sheen) {
    ctx.save(); ctx.beginPath(); ctx.rect(A.x, A.y, A.w, A.h); ctx.clip();
    ctx.lineWidth = 2; ctx.lineJoin = 'round';
    ctx.strokeStyle = L.sheen;
    if (L.sheenGlow) { ctx.shadowColor = L.sheenGlow; ctx.shadowBlur = 8; }
    for (const pts of floorLines) {
      ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
      ctx.stroke();
    }
    ctx.restore();
  }
  // walls
  ctx.strokeStyle = L.wall; ctx.lineWidth = 8; ctx.strokeRect(A.x - 4, A.y - 4, A.w + 8, A.h + 8);

  // ambient particles
  for (const a of amb) {
    ctx.fillStyle = L.ambient === 'snow' ? 'rgba(235,245,255,0.7)' : (L.ambient === 'debris' ? 'rgba(190,190,200,0.55)' : (L.ambCol || 'rgba(255,150,70,0.8)'));
    ctx.fillRect(a.x, a.y, a.s, a.s);
  }

  if (!player) { ctx.restore(); return; }
  const HERO = hero();

  // lava geysers
  for (const h of hazards) {
    ctx.save();
    if (h.phase === 'warn') {
      const p = 1 - h.t / 1.1;
      ctx.fillStyle = `rgba(255,110,40,${0.10 + 0.25 * p})`;
      ctx.beginPath(); ctx.arc(h.x, h.y, h.r, 0, 7); ctx.fill();
      ctx.strokeStyle = `rgba(255,160,70,${0.5 + 0.4 * Math.sin(time * 18)})`; ctx.lineWidth = 3; ctx.setLineDash([6, 6]);
      ctx.beginPath(); ctx.arc(h.x, h.y, h.r, 0, 7); ctx.stroke();
      ctx.setLineDash([]);
      ctx.strokeStyle = 'rgba(255,200,120,0.5)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(h.x, h.y, h.r * p, 0, 7); ctx.stroke();
    } else {
      const a = h.t / 0.4;
      ctx.shadowColor = '#ff8a30'; ctx.shadowBlur = 30;
      ctx.fillStyle = `rgba(255,170,60,${0.85 * a})`; ctx.beginPath(); ctx.arc(h.x, h.y, h.r, 0, 7); ctx.fill();
      ctx.fillStyle = `rgba(255,240,200,${0.9 * a})`; ctx.beginPath(); ctx.arc(h.x, h.y, h.r * 0.55, 0, 7); ctx.fill();
    }
    ctx.restore();
  }

  if (HERO.drawUnder) HERO.drawUnder();                       // hero effects beneath the action (trails, darkening...)
  const aimLen = state === 'play' && HERO.aimLine ? HERO.aimLine() : 0;      // dotted aim line; the hero says how long (0 = none)
  if (aimLen) {
    ctx.setLineDash([4, 10]); ctx.strokeStyle = fx(0.25); ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(player.x, player.y);
    ctx.lineTo(player.x + Math.cos(player.aim) * aimLen, player.y + Math.sin(player.aim) * aimLen); ctx.stroke();
    ctx.setLineDash([]);
  }

  // heart pickups (blink when about to vanish)
  for (const hr of hearts) {
    if (hr.life < 3 && Math.floor(hr.life * 8) % 2 === 0) continue;
    const bob = Math.sin(time * 5 + hr.x) * 2;
    ctx.save(); ctx.shadowColor = '#ff6b6b'; ctx.shadowBlur = 14;
    drawHeart(hr.x, hr.y + bob, 11, '#ff5a5a');
    ctx.restore();
  }

  // enemies
  for (const e of enemies) drawEnemy(e);

  // enemy bolts and reflected bolts
  for (const b of ebolts) {
    const col = b.friendly ? '#ffffff' : (b.col || '#c58cf0');
    ctx.save(); ctx.shadowColor = col; ctx.shadowBlur = 14;
    ctx.fillStyle = col; ctx.beginPath(); ctx.arc(b.x, b.y, 6, 0, 7); ctx.fill();
    ctx.fillStyle = b.friendly ? C.bolt : '#f4e6ff'; ctx.beginPath(); ctx.arc(b.x, b.y, 3, 0, 7); ctx.fill();
    ctx.restore();
  }

  if (HERO.drawBefore) HERO.drawBefore();                      // hero things drawn behind the player (decoys, armour drones...)

  // player
  {
    let alpha = 1;
    if (player.invis > 0) alpha = player.invis < 0.8 && Math.floor(time * 12) % 2 === 0 ? 0.5 : 0.22;
    else if (player.inv > 0 && Math.floor(time * 20) % 2 === 0) alpha = 0.4;
    let px = player.x, py = player.y, sc = 1;
    if (player.leap) {                                                // heroic leap: arc up with a ground shadow
      const p = Math.min(1, player.leap.t / player.leap.dur), h = Math.sin(p * Math.PI);
      ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.ellipse(px, py, player.r * (1.1 - 0.3 * h), player.r * 0.5, 0, 0, 7); ctx.fill();
      py -= h * 46; sc = 1 + h * 0.45;
    }
    if (HERO.drawPlayerUnder) HERO.drawPlayerUnder(px, py);        // auras beneath the body
    ctx.save(); ctx.translate(px, py); ctx.scale(sc, sc); ctx.translate(-px, -py);
    if (!(HERO.drawBodyOverride && HERO.drawBodyOverride(px, py, alpha))) {
      if (HERO.preBody) HERO.preBody();
      drawChar(ctx, px, py, player.r, player.aim, alpha, HERO.charOpts ? HERO.charOpts() : null);
    }
    ctx.restore();
    if (player.invis > 0) {
      ctx.strokeStyle = fx(0.55); ctx.lineWidth = 1.5; ctx.setLineDash([4, 5]);
      ctx.beginPath(); ctx.arc(px, py, player.r + 6, 0, 7); ctx.stroke(); ctx.setLineDash([]);
    }
    if (HERO.drawPlayerFx) HERO.drawPlayerFx(px, py);              // weapons, auras and effects on the player
  }

  drawSweeps();
  if (HERO.drawOver) HERO.drawOver();                          // the hero's own projectiles and effects
  drawSharedProjectiles();                                     // daggers, bombs, bullets, grapple ropes and arcs

  // shockwave rings
  for (const s of shocks) {
    const t = 1 - s.r / s.max;
    ctx.save(); ctx.shadowColor = C.bolt; ctx.shadowBlur = 18;
    ctx.globalAlpha = Math.max(0, t);
    ctx.strokeStyle = C.bolt; ctx.lineWidth = 8 * t + 2;
    ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, 7); ctx.stroke();
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(s.x, s.y, Math.max(1, s.r - 6), 0, 7); ctx.stroke();
    ctx.restore();
  }

  // lightning strikes
  for (const s of strikes) {
    ctx.save(); ctx.globalAlpha = s.life / s.max; ctx.shadowColor = C.bolt; ctx.shadowBlur = 26;
    bolt(s.x + (Math.random() - 0.5) * 30, 0, s.x, s.y, 60, C.bolt, 9);
    bolt(s.x, 0, s.x, s.y, 40, '#ffffff', 3);
    ctx.restore();
  }

  // rings & particles
  for (const r of rings) {
    ctx.globalAlpha = r.life / r.maxLife; ctx.strokeStyle = r.color; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(r.x, r.y, r.r, 0, 7); ctx.stroke();
  }
  for (const p of particles) {
    ctx.globalAlpha = Math.max(0, p.life / p.max); ctx.fillStyle = p.color;
    ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
  }
  ctx.globalAlpha = 1;
  ctx.restore();

  if (flash > 0 && !calm) { ctx.fillStyle = fx(flash * 0.6); ctx.fillRect(0, 0, W, H); }

  drawHud(); drawBossBar(); drawBanner();
  if (state === 'over') drawOver();
  if (state === 'win') drawWin();
}

function drawPreview() {
  pctx.clearRect(0, 0, 104, 104);
  const g = pctx.createRadialGradient(52, 52, 6, 52, 52, 74);
  g.addColorStop(0, '#2b3d52'); g.addColorStop(1, '#16202b');
  pctx.fillStyle = g; pctx.fillRect(0, 0, 104, 104);
  pctx.strokeStyle = fx(0.25); pctx.lineWidth = 2;
  pctx.beginPath(); pctx.arc(52, 52, 41, 0, 7); pctx.stroke();
  pctx.save(); pctx.shadowColor = C.bolt; pctx.shadowBlur = 16;
  drawChar(pctx, 52, 52, 24, time * 0.8, 1, { anger: 35 });
  pctx.restore();
}
