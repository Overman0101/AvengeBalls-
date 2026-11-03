// QUICKSILVER (X-Men): blink-dashes anywhere you click, long wall-to-wall swings, a speed tornado, speed perception
// (the world slows, he does not), a flurry that hits everything near him at once, and a shadow trail behind it all.
//
// Self-contained: everything in this file is private to the hero, except what registerHero() hands to the engine.
(function () {
  const TAU = Math.PI * 2, QS_KEYS = ['qs_dash', 'qs_swing', 'qs_nado', 'qs_flurry'];
  let ghosts = [], nado = null, perc = 0, streaks = [], runT = 0;

  Object.assign(sfx, {
    dash: () => { noise(0.12, 0.12, 2600); tone(1100, 260, 0.1, 'sawtooth', 0.07); },
    nado: () => { noise(0.5, 0.1, 700); tone(200, 520, 0.5, 'sine', 0.1); },
    perc: () => { tone(700, 90, 0.7, 'triangle', 0.14); },
    flurry: () => { for (let i = 0; i < 4; i++) noise(0.06, 0.1, 1800 + i * 300); }
  });

  // ---------------- the shadow trail ----------------
  function addGhost(x, y, aim, life, a) {
    ghosts.push({ x, y, aim, life, max: life, a });
    if (ghosts.length > 90) ghosts.shift();
  }

  // ---------------- dashing: a forced state that hits everything on the way ----------------
  function startDash(tx, ty, o) {
    tx = clamp(tx, A.x + player.r, A.x + A.w - player.r); ty = clamp(ty, A.y + player.r, A.y + A.h - player.r);
    const d = Math.hypot(tx - player.x, ty - player.y);
    if (d < 36) return false;
    player.qsd = { sx: player.x, sy: player.y, tx, ty, dx: (tx - player.x) / d, dy: (ty - player.y) / d, hit: new Set(), speed: o.speed, mom: o.mom || 0, dmg: o.dmg, since: 0 };
    player.inv = Math.max(player.inv, 0.35);
    ring(player.x, player.y, 46, C.bolt); sfx.dash();
    return true;
  }
  function finishDash(D) {
    player.x = D.tx; player.y = D.ty;
    if (D.mom) { player.kx = D.dx * D.mom; player.ky = D.dy * D.mom; }       // a swing keeps its momentum
    player.qsd = null;
    ring(player.x, player.y, 60, C.bolt); burst(player.x, player.y, 12, C.bolt, 240, 0.4); addShake(2);
  }
  function updateDash(dt) {
    const D = player.qsd, total = D.speed * dt, steps = Math.max(1, Math.ceil(total / 10)), step = total / steps;
    for (let s = 0; s < steps; s++) {
      player.x += D.dx * step; player.y += D.dy * step; D.since += step;
      if (D.since >= 26) { D.since = 0; addGhost(player.x, player.y, player.aim, 0.42, 0.6); }
      for (const e of enemies.slice()) {
        if (D.hit.has(e) || dist(e, player) >= e.r + player.r + 12) continue;
        D.hit.add(e); hitstop = Math.max(hitstop, 0.025); sfx.hit();
        knock(e, D.dx * 460, D.dy * 460, 0.5); burst(e.x, e.y, 6, C.bolt, 240, 0.3); damage(e, D.dmg);
      }
      if (Math.hypot(D.tx - player.x, D.ty - player.y) <= step + 1) { finishDash(D); return; }
    }
    player.vx = 0; player.vy = 0; player.inv = Math.max(player.inv, 0.2);
  }

  // Click: dash to wherever you click, hitting what is in the way. Chain them as fast as you can click.
  function clickDash() {
    if (cd.qs_dash > 0 || player.rewT > 0) return;
    if (startDash(mouse.x, mouse.y, { speed: 3300, dmg: 1.4 })) cd.qs_dash = 0.22;
  }
  // Right click: swing to the wall (or corner) you aim at, and keep the momentum. Re-fire to chain swings in new directions.
  function castSwing() {
    if (cd.qs_swing > 0) return;
    const e = rayEnd(player.x, player.y, player.aim);
    let tx = e.x, ty = e.y;
    for (const c of [[A.x, A.y], [A.x + A.w, A.y], [A.x, A.y + A.h], [A.x + A.w, A.y + A.h]]) {     // snap to a nearby corner
      if (Math.hypot(tx - c[0], ty - c[1]) < 150) { tx = c[0]; ty = c[1]; break; }
    }
    if (startDash(tx, ty, { speed: 2600, mom: 700, dmg: 1.2 })) cd.qs_swing = 0.3;
  }

  // ---------------- Q: speed tornado ----------------
  function castNado() {
    if (cd.qs_nado > 0 || nado) return;
    cd.qs_nado = 14; nado = { t: 0, dur: 3.4, tick: 0 };
    ring(player.x, player.y, 150, C.bolt); burst(player.x, player.y, 22, C.bolt, 300, 0.5); sfx.nado();
  }
  function endNado() {
    for (const e of enemies.slice()) {                                    // the tornado lets go: everything inside is flung out
      const d = dist(e, player);
      if (d < 200 + e.r) { knock(e, (e.x - player.x) / (d || 1) * 720, (e.y - player.y) / (d || 1) * 720, 0.7); damage(e, 1.2); }
    }
    ring(player.x, player.y, 200, '#ffffff'); burst(player.x, player.y, 26, C.bolt, 360, 0.6); addShake(6); nado = null;
  }
  function updateNado(dt) {
    const R = 140; nado.t += dt; nado.tick -= dt;
    killBoltsNear(player.x, player.y, R + 20);                            // enemy fire is shredded
    const hitNow = nado.tick <= 0; if (hitNow) nado.tick = 0.3;
    for (const e of enemies.slice()) {
      const dx = player.x - e.x, dy = player.y - e.y, d = Math.hypot(dx, dy) || 1;
      if (d > R + e.r) continue;
      if (!e.boss) { const nx = dx / d, ny = dy / d; e.kx = nx * 170 - ny * 340; e.ky = ny * 170 + nx * 340; }     // spiral inward
      e.stun = Math.max(e.stun, 0.2);
      if (hitNow) { burst(e.x, e.y, 4, C.bolt, 200, 0.3); damage(e, 0.8); }
    }
    if (nado && nado.t >= nado.dur) endNado();
  }

  // ---------------- E: speed perception. The world crawls, he does not. ----------------
  function castPerception() {
    if (perc > 0) { endPerception(); return; }                            // press again to come out of it early
    if (cd.qs_perc > 0 || player.rewT > 0) return;
    cd.qs_perc = 20; perc = 4.5;
    ring(player.x, player.y, 380, '#bfe6ff'); burst(player.x, player.y, 26, '#bfe6ff', 320, 0.6); addShake(4); sfx.perc();
  }
  function endPerception() { perc = 0; ring(player.x, player.y, 260, '#bfe6ff'); }

  // ---------------- F: flurry. Everything near him is hit three times in an instant. ----------------
  function castFlurry() {
    if (cd.qs_flurry > 0) return;
    const near = enemies.filter(e => dist(e, player) < 240);
    if (!near.length) { cd.qs_flurry = 1; ring(player.x, player.y, 240, C.bolt); return; }
    cd.qs_flurry = 8; player.inv = Math.max(player.inv, 0.5);
    for (const e of near) {
      streaks.push({ x0: player.x, y0: player.y, x1: e.x, y1: e.y, t: 0 });
      const d = dist(e, player) || 1;
      knock(e, (e.x - player.x) / d * 240, (e.y - player.y) / d * 240, 0.5);
      burst(e.x, e.y, 10, C.bolt, 260, 0.35);
      for (let i = 0; i < 3; i++) damage(e, 0.9);
    }
    hitstop = 0.06; ring(player.x, player.y, 240, C.bolt); ring(player.x, player.y, 150, '#ffffff'); addShake(6); sfx.flurry();
  }

  // ---------------- drawing ----------------
  function drawGhosts() {
    for (const g of ghosts) {
      ctx.save(); ctx.shadowColor = C.bolt; ctx.shadowBlur = 12;
      drawChar(ctx, g.x, g.y, player.r, g.aim, g.a * (g.life / g.max));
      ctx.restore();
    }
  }
  function drawNado() {
    const g = ctx.createRadialGradient(player.x, player.y, 10, player.x, player.y, 150);
    g.addColorStop(0, 'rgba(210,235,255,0.05)'); g.addColorStop(1, 'rgba(160,210,255,0.22)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(player.x, player.y, 150, 0, 7); ctx.fill();
    ctx.save(); ctx.lineCap = 'round'; ctx.shadowColor = C.bolt; ctx.shadowBlur = 10; ctx.strokeStyle = '#e6f4ff';
    for (let i = 0; i < 5; i++) {
      const R = 30 + i * 28, a0 = time * (10 - i * 1.3) + i * 1.4;
      ctx.globalAlpha = 0.7 - i * 0.1; ctx.lineWidth = 3 - i * 0.3;
      ctx.beginPath(); ctx.arc(player.x, player.y, R, a0, a0 + 3.4); ctx.stroke();
    }
    ctx.restore();
    if (Math.random() < 0.7) { const a = Math.random() * TAU, R = 40 + Math.random() * 100; particles.push({ x: player.x + Math.cos(a) * R, y: player.y + Math.sin(a) * R, vx: -Math.sin(a) * 200, vy: Math.cos(a) * 200, life: 0.4, max: 0.4, color: '#e6f4ff', size: 3 }); }
  }
  function drawPerception() {
    ctx.save();
    const g = ctx.createRadialGradient(W / 2, H / 2, 130, W / 2, H / 2, 560); g.addColorStop(0, 'rgba(190,225,255,0.02)'); g.addColorStop(1, 'rgba(90,140,210,0.30)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = 'rgba(220,240,255,0.10)'; ctx.lineWidth = 1.5;
    for (let i = 0; i < 12; i++) { const x = ((i * 83 + time * 520) % (W + 80)) - 40; ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x - 30, H); ctx.stroke(); }    // the world streaking by
    ctx.strokeStyle = '#bfe6ff'; ctx.shadowColor = '#bfe6ff'; ctx.shadowBlur = 10; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(player.x, player.y, player.r + 12, -Math.PI / 2, -Math.PI / 2 + TAU * (perc / 4.5)); ctx.stroke();
    ctx.restore();
  }
  function drawDashTrail() {
    const D = player.qsd; if (!D) return;
    ctx.save(); ctx.lineCap = 'round'; ctx.shadowColor = C.bolt; ctx.shadowBlur = 14;
    const g = ctx.createLinearGradient(D.sx, D.sy, player.x, player.y); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(1, C.bolt);
    ctx.strokeStyle = g; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(D.sx, D.sy); ctx.lineTo(player.x, player.y); ctx.stroke();
    ctx.restore();
  }
  function drawStreaks() {
    ctx.save(); ctx.lineCap = 'round'; ctx.shadowColor = C.bolt; ctx.shadowBlur = 10;
    for (const s of streaks) {
      const k = s.t / 0.3, dx = s.x1 - s.x0, dy = s.y1 - s.y0, d = Math.hypot(dx, dy) || 1, nx = -dy / d, ny = dx / d;
      ctx.globalAlpha = 1 - k;
      for (let j = 0; j < 4; j++) {
        ctx.strokeStyle = j % 2 ? '#ffffff' : C.bolt; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(s.x0, s.y0);
        for (let i = 1; i <= 6; i++) { const u = i / 6, w = Math.sin(j * 5 + i * 3.1 + time * 40) * 12 * (1 - Math.abs(u - 0.5) * 1.6); ctx.lineTo(s.x0 + dx * u + nx * w, s.y0 + dy * u + ny * w); }
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  function gear(g, c) {
    const { hr, gear } = c, hair = CHARS[look.char].hair;
    g.fillStyle = hair; g.beginPath(); g.moveTo(hr * 0.05, -hr * 0.85); g.lineTo(hr * 0.9, -hr * 0.2); g.lineTo(hr * 0.2, -hr * 0.05); g.closePath(); g.fill();   // swept silver fringe
    if (gear === 0) {                                                    // goggles
      g.fillStyle = '#27303b'; g.beginPath(); g.roundRect ? g.roundRect(hr * 0.3, -hr * 0.72, hr * 0.5, hr * 1.44, 3) : g.rect(hr * 0.3, -hr * 0.72, hr * 0.5, hr * 1.44); g.fill();
      g.fillStyle = '#bfe6ff'; g.fillRect(hr * 0.42, -hr * 0.55, hr * 0.2, hr * 0.42); g.fillRect(hr * 0.42, hr * 0.13, hr * 0.2, hr * 0.42);
    } else if (gear === 1) {                                             // headphones
      g.strokeStyle = '#1b1f26'; g.lineWidth = 3; g.lineCap = 'round'; g.beginPath(); g.moveTo(0, -hr); g.lineTo(0, hr); g.stroke();
      g.fillStyle = '#1b1f26'; for (const s of [-1, 1]) { g.beginPath(); g.arc(0, s * hr, 4.5, 0, 7); g.fill(); }
    }
  }
  function lightning(g, r) {                                              // a bolt across the jacket
    g.strokeStyle = C.bolt; g.lineWidth = 2.5; g.lineJoin = 'round';
    g.beginPath(); g.moveTo(-r * 0.7, -r * 0.55); g.lineTo(-r * 0.2, -r * 0.05); g.lineTo(-r * 0.5, -r * 0.05); g.lineTo(0, r * 0.6); g.stroke();
  }

  registerHero({
    id: 'quicksilver', name: 'Quicksilver', team: 'xmen', order: 11, modern: true,
    blurb: 'Fastest man alive. Dash anywhere, swing wall to wall, speed tornado, slow the world.',
    look: {
      capeLab: 'Jacket', cape: '#aab3be', fx: '#bfe6ff', hair: '#e4e8ee',
      gears: ['Goggles', 'Headphones', 'Bare head'],
      help: '<b>Click anywhere</b> and he dashes there, hitting everything in the way. Chain them. <b>Right click</b> swings him to the wall you aim at, with momentum; fire again to chain swings in new directions. <b>Q</b> speed tornado: spiral enemies in, shred their fire, then fling them out. <b>E</b> speed perception: the world slows to a crawl for 4.5 seconds while he stays full speed (E again to end it early). <b>F</b> flurry: everything near him is hit three times at once. He leaves a shadow trail wherever he runs.',
      keys: ['Click: dash to the cursor     Right click: swing to the wall', 'Q speed tornado     F flurry', 'E speed perception (slows the world)']
    },
    cd: { qs_dash: 0, qs_swing: 0, qs_nado: 0, qs_perc: 0, qs_flurry: 0 },
    init: () => ({ qsd: null }),
    reset() { ghosts = []; nado = null; perc = 0; streaks = []; runT = 0; },
    onKey(code) {
      if (code === 'KeyQ') castNado();
      if (code === 'KeyE') castPerception();
      if (code === 'KeyF') castFlurry();
    },
    onMouse(button) { if (button === 2) castSwing(); else clickDash(); },
    speed() { return nado ? 270 : 340; },
    timeScale() { return perc > 0 ? 0.22 : 1; },                         // the engine slows enemies, bolts, geysers and spawning, not him
    update(dt) {
      if (perc > 0) {
        perc -= dt;
        for (const k of QS_KEYS) cd[k] = Math.max(0, cd[k] - dt * 0.8);   // everything recharges faster in his time
        if (perc <= 0) endPerception();
      }
      if (nado) updateNado(dt);
      if (!player.qsd) {                                                  // running fast leaves a faint trail
        runT -= dt;
        if (runT <= 0 && Math.hypot(player.vx + player.kx, player.vy + player.ky) > 300) { runT = 0.045; addGhost(player.x, player.y, player.aim, 0.28, 0.35); }
      }
      for (const g of ghosts) g.life -= dt;
      ghosts = ghosts.filter(g => g.life > 0);
      for (const s of streaks) s.t += dt;
      streaks = streaks.filter(s => s.t < 0.3);
    },
    skills() {
      return [
        { k: 'M1', n: 'Dash', cd: cd.qs_dash, max: 0.22, ok: true },
        { k: 'M2', n: 'Swing', cd: cd.qs_swing, max: 0.3, ok: true },
        { k: 'Q', n: 'Tornado', cd: cd.qs_nado, max: 14, ok: !nado },
        { k: 'E', n: perc > 0 ? 'End' : 'Perception', cd: perc > 0 ? 0 : cd.qs_perc, max: 20, ok: true },
        { k: 'F', n: 'Flurry', cd: cd.qs_flurry, max: 8, ok: true }
      ];
    },
    message() {
      if (perc > 0) return 'Speed perception ' + perc.toFixed(1) + 's. The world crawls.';
      if (nado) return 'Tornado! ' + (nado.dur - nado.t).toFixed(1) + 's';
      if (player.qsd) return 'Gone.';
      return 'Click to dash anywhere. Right click to swing to the wall.';
    },
    aimLine() { return 0; },
    hudBars() {
      if (perc > 0) {
        ctx.font = '11px "Palatino Linotype", Palatino, Georgia, serif'; ctx.textAlign = 'left';
        ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.fillRect(48, 46, 140, 6);
        ctx.fillStyle = '#bfe6ff'; ctx.fillRect(48, 46, 140 * perc / 4.5, 6);
        ctx.fillStyle = 'rgba(231,238,244,0.7)'; ctx.fillText('SPEED PERCEPTION ' + perc.toFixed(1) + 's', 194, 49);
        ctx.font = '700 22px "Palatino Linotype", Palatino, Georgia, serif';
      }
    },
    bodyRing(g, r) { lightning(g, r); },
    drawBefore() { drawGhosts(); if (nado) drawNado(); },
    drawOver() { drawDashTrail(); drawStreaks(); if (perc > 0) drawPerception(); },
    gear,
    api: { state: () => ({ ghosts: ghosts.length, nado: nado ? nado.t : null, perc, dashing: !!player.qsd }) }          // exposed for the automated tests
  });

  registerForcedState(35, () => player.qsd, updateDash);
})();
