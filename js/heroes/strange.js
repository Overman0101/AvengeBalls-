// DOCTOR STRANGE: mystic orbs, sling-ring portals, the Cloak of Levitation (detach and steer it, fly to it like a grapple,
// or wear it and levitate), the Eye of Agamotto (rewind time, stop time), mirror-dimension illusions, and the Crimson Bands of Cyttorak.
//
// Self-contained: everything in this file is private to the hero, except what registerHero() hands to the engine.
(function () {
  const TAU = Math.PI * 2, TIME_GREEN = '#7dff9a', STOP_DUR = 3.5;
  const angDiff = (a, b) => ((b - a + Math.PI * 3) % TAU) - Math.PI;       // shortest signed turn from a to b
  const ease = p => p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;

  let orbs = [], portals = [], cloak = null, bands = [], hist = [], histT = 0, rw = null, stopT = 0, spaceSpent = false;

  Object.assign(sfx, {
    portal: () => { tone(220, 520, 0.28, 'sine', 0.18); noise(0.18, 0.08, 900); },
    bands: () => { tone(160, 90, 0.25, 'sawtooth', 0.14); noise(0.12, 0.08, 500); },
    rewind: () => { tone(900, 120, 0.9, 'triangle', 0.16); tone(450, 60, 0.9, 'sine', 0.12); },
    timestop: () => { tone(140, 40, 1.1, 'sine', 0.22); tone(1400, 200, 0.5, 'triangle', 0.1); },
    timego: () => { tone(200, 700, 0.4, 'triangle', 0.14); }
  });

  // Binding: a bound enemy cannot move or attack, and takes +50% damage while held. Bosses shrug most of it off.
  function bindEnemy(e, t) {
    if (e.boss) t = Math.min(t, 0.6);
    e.stun = Math.max(e.stun, t); e.kx *= 0.2; e.ky *= 0.2;
    e.bound = time + t; e.marked = Math.max(e.marked || 0, time + t);
  }

  // ---------------- Click: mystic orbs ----------------
  function spawnOrb(x, y, ang, small) {
    orbs.push({ x, y, vx: Math.cos(ang) * 780, vy: Math.sin(ang) * 780, dmg: small ? 0.8 : 1.5, r: small ? 6 : 9, life: 1.3, pcd: 0 });
  }
  function fireOrb() {
    if (cd.st_orb > 0 || player.roll > 0) return;
    cd.st_orb = 0.42;
    spawnOrb(player.x + Math.cos(player.aim) * 20, player.y + Math.sin(player.aim) * 20, player.aim, false);
    for (const c of clones) spawnOrb(c.x, c.y, Math.atan2(mouse.y - c.y, mouse.x - c.x), true);        // mirror images fire too
    sfx.blast();
  }
  function orbBurst(o, direct) {
    ring(o.x, o.y, 54, C.bolt); burst(o.x, o.y, 14, C.bolt, 280, 0.45); addShake(3); sfx.boom();
    for (const e of enemies.slice()) {
      if (e === direct) continue;
      const d = Math.hypot(e.x - o.x, e.y - o.y);
      if (d < 50 + e.r) { knock(e, (e.x - o.x) / (d || 1) * 300, (e.y - o.y) / (d || 1) * 300, 0.3); damage(e, 0.5); }
    }
  }
  function updateOrbs(dt) {
    for (const o of orbs.slice()) {
      o.x += o.vx * dt; o.y += o.vy * dt; o.life -= dt; o.pcd -= dt;
      particles.push({ x: o.x, y: o.y, vx: 0, vy: 0, life: 0.22, max: 0.22, color: C.bolt, size: o.r * 0.55 });
      let done = false;
      for (const e of enemies.slice()) {
        if (Math.hypot(e.x - o.x, e.y - o.y) < e.r + o.r) {
          hitstop = Math.max(hitstop, 0.03); knock(e, o.vx * 0.3, o.vy * 0.3, 0.3);
          damage(e, o.dmg); orbBurst(o, e); done = true; break;
        }
      }
      if (!done && (o.x < A.x || o.x > A.x + A.w || o.y < A.y || o.y > A.y + A.h)) {
        o.x = clamp(o.x, A.x, A.x + A.w); o.y = clamp(o.y, A.y, A.y + A.h); orbBurst(o, null); done = true;
      }
      if (!done && o.life <= 0) done = true;
      if (done) orbs.splice(orbs.indexOf(o), 1);
    }
  }

  // ---------------- Q: sling-ring portals ----------------
  // An entrance opens in front of you and an exit at the cursor. Anything that crosses one comes out of the other.
  function castPortal() {
    if (cd.st_portal > 0) return;
    cd.st_portal = 9;
    const ax = clamp(player.x + Math.cos(player.aim) * 80, A.x + 34, A.x + A.w - 34), ay = clamp(player.y + Math.sin(player.aim) * 80, A.y + 34, A.y + A.h - 34);
    let bx = clamp(mouse.x, A.x + 34, A.x + A.w - 34), by = clamp(mouse.y, A.y + 34, A.y + A.h - 34);
    const d = Math.hypot(bx - ax, by - ay);
    if (d < 150) { bx = clamp(ax + Math.cos(player.aim) * 190, A.x + 34, A.x + A.w - 34); by = clamp(ay + Math.sin(player.aim) * 190, A.y + 34, A.y + A.h - 34); }
    portals = [{ x: ax, y: ay, r: 32, age: 0, life: 9, exit: false }, { x: bx, y: by, r: 32, age: 0, life: 9, exit: true }];
    for (const p of portals) { ring(p.x, p.y, 70, C.bolt); burst(p.x, p.y, 16, C.bolt, 240, 0.5); }
    addShake(3); sfx.portal();
  }
  function out(p, ang, rad) {                                         // a spot just outside portal p, clear of it
    return { x: clamp(p.x + Math.cos(ang) * (p.r + rad + 6), A.x + rad, A.x + A.w - rad), y: clamp(p.y + Math.sin(ang) * (p.r + rad + 6), A.y + rad, A.y + A.h - rad) };
  }
  function updatePortals(dt) {
    if (!portals.length) return;
    for (const p of portals) p.age += dt;
    if (portals[0].age >= portals[0].life) { for (const p of portals) { ring(p.x, p.y, 50, C.bolt); burst(p.x, p.y, 10, C.bolt, 180, 0.4); } portals = []; return; }
    player.pcd = Math.max(0, player.pcd - dt);
    for (let i = 0; i < 2; i++) {
      const a = portals[i], b = portals[1 - i], reach = a.r - 4;
      if (player.pcd <= 0 && dist(player, a) < reach) {                                   // you
        const o = out(b, player.aim, player.r);
        ring(player.x, player.y, 50, C.bolt); player.x = o.x; player.y = o.y; player.pcd = 0.7; player.inv = Math.max(player.inv, 0.35);
        player.kx = 0; player.ky = 0; ring(o.x, o.y, 60, C.bolt); burst(o.x, o.y, 14, C.bolt, 240, 0.4); sfx.tele();
      }
      for (const e of enemies) {                                                          // enemies come out dizzy
        e.pcd = (e.pcd || 0) - dt;
        if (e.pcd <= 0 && !e.pinned && dist(e, a) < reach + e.r * 0.4) {
          const o = out(b, Math.atan2(player.y - b.y, player.x - b.x), e.r);
          e.x = o.x; e.y = o.y; e.pcd = 1.2; e.kx = 0; e.ky = 0; e.stun = Math.max(e.stun, e.boss ? 0.4 : 0.9);
          ring(o.x, o.y, 50, C.bolt); burst(o.x, o.y, 8, C.bolt, 200, 0.3);
        }
      }
      for (const o of orbs) {                                                             // your orbs cross the arena
        if (o.pcd <= 0 && Math.hypot(o.x - a.x, o.y - a.y) < reach) {
          const ex = out(b, Math.atan2(o.vy, o.vx), 4);
          o.x = ex.x; o.y = ex.y; o.pcd = 0.25; o.life += 0.3; burst(o.x, o.y, 6, C.bolt, 180, 0.25);
        }
      }
      for (const bt of ebolts) {                                                          // enemy fire comes back as yours
        if (!bt.pcd && Math.hypot(bt.x - a.x, bt.y - a.y) < reach) {
          const ex = out(b, Math.atan2(bt.vy, bt.vx), 4);
          bt.x = ex.x; bt.y = ex.y; bt.pcd = 1; bt.friendly = true; bt.life = Math.max(bt.life, 1.2);
          burst(bt.x, bt.y, 8, '#ffffff', 200, 0.3);
        }
      }
    }
  }
  function drawPortal(p) {
    const s = Math.min(1, p.age / 0.3), fade = Math.min(1, (p.life - p.age) / 0.6), R = p.r * s;
    ctx.save(); ctx.globalAlpha = fade;
    const g = ctx.createRadialGradient(p.x, p.y, 2, p.x, p.y, R);
    g.addColorStop(0, p.exit ? 'rgba(255,240,210,0.55)' : 'rgba(25,12,0,0.8)'); g.addColorStop(1, 'rgba(255,170,60,0.15)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, p.y, R, 0, 7); ctx.fill();
    ctx.shadowColor = C.bolt; ctx.shadowBlur = 16; ctx.strokeStyle = C.bolt; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(p.x, p.y, R, 0, 7); ctx.stroke();
    ctx.fillStyle = '#ffd9a0';
    for (let i = 0; i < 14; i++) { const a = time * (p.exit ? -3 : 3) + i * TAU / 14; ctx.beginPath(); ctx.arc(p.x + Math.cos(a) * R, p.y + Math.sin(a) * R, 2.4, 0, 7); ctx.fill(); }
    ctx.restore();
  }

  // ---------------- E: the Cloak of Levitation leaves him and flies where you steer it ----------------
  function castCloak() {
    if (cloak) { if (!cloak.back && !cloak.anchored) { cloak.back = true; cloak.hit = new Set(); } return; }       // press again to recall
    if (cd.st_cloak > 0) return;
    cloak = { x: player.x, y: player.y, ang: player.aim, life: 2.6, back: false, hit: new Set(), t: 0 };
    player.cloakOut = true; ring(player.x, player.y, 60, look.cape); burst(player.x, player.y, 16, look.cape, 240, 0.5); sfx.cloak();
  }
  function reattachCloak() {
    cloak = null; player.cloakOut = false; cd.st_cloak = 4;
    ring(player.x, player.y, 50, look.cape); burst(player.x, player.y, 12, look.cape, 200, 0.4); sfx.catch();
  }
  // Space while the cloak is out: it anchors where it is and pulls you to it (a grapple zip that hits what is in the way)
  function startCloakZip() {
    if (!cloak || cloak.anchored || player.zip || player.rewT > 0) return;
    if (dist(cloak, player) < 70) { reattachCloak(); return; }                          // already beside you: just put it back on
    cloak.anchored = true; cloak.back = false;
    player.zip = { tx: clamp(cloak.x, A.x + player.r, A.x + A.w - player.r), ty: clamp(cloak.y, A.y + player.r, A.y + A.h - player.r), hit: new Set(), mom: 480 };
    ring(cloak.x, cloak.y, 60, look.cape); burst(cloak.x, cloak.y, 14, look.cape, 240, 0.4); sfx.grapple();
  }
  function updateCloak(dt) {
    const c = cloak; if (!c) return;
    c.t += dt;
    if (c.anchored) { if (!player.zip) reattachCloak(); return; }                      // arrived: the cloak settles back on his shoulders
    if (!c.back) {
      c.ang += clamp(angDiff(c.ang, Math.atan2(mouse.y - c.y, mouse.x - c.x)), -5.5 * dt, 5.5 * dt);   // steer toward the cursor
      c.life -= dt; if (c.life <= 0) { c.back = true; c.hit = new Set(); }
    } else c.ang = Math.atan2(player.y - c.y, player.x - c.x);
    const sp = c.back ? 800 : 560;
    c.x = clamp(c.x + Math.cos(c.ang) * sp * dt, A.x + 12, A.x + A.w - 12); c.y = clamp(c.y + Math.sin(c.ang) * sp * dt, A.y + 12, A.y + A.h - 12);
    particles.push({ x: c.x, y: c.y, vx: 0, vy: 0, life: 0.3, max: 0.3, color: look.cape, size: 5 });
    for (const e of enemies.slice()) {                                // the cloak wraps whatever it touches
      if (c.hit.has(e) || dist(e, c) > e.r + 22) continue;
      c.hit.add(e); bindEnemy(e, c.back ? 0.9 : 2.0); hitstop = Math.max(hitstop, 0.03);
      burst(e.x, e.y, 8, look.cape, 200, 0.35); sfx.hit(); damage(e, 1);
    }
    if (c.back && dist(c, player) < player.r + 16) reattachCloak();
  }
  function drawCloak(g, c) {
    const flap = Math.sin(time * 18) * 4;
    g.save(); g.translate(c.x, c.y); g.rotate(c.ang);
    g.shadowColor = look.cape; g.shadowBlur = 14; g.fillStyle = look.cape;
    g.beginPath(); g.moveTo(16, -14); g.quadraticCurveTo(20, 0, 16, 14); g.lineTo(-6, 22 + flap); g.quadraticCurveTo(-22, 12 - flap, -34, 6 + flap);
    g.quadraticCurveTo(-26, 0, -34, -6 - flap); g.quadraticCurveTo(-22, -12 + flap, -6, -22 - flap); g.closePath(); g.fill();
    g.shadowBlur = 0; g.fillStyle = 'rgba(0,0,0,0.25)'; g.beginPath(); g.moveTo(-4, -12); g.lineTo(-26, -2); g.lineTo(-26, 2); g.lineTo(-4, 12); g.closePath(); g.fill();
    g.fillStyle = '#e0b43a'; g.beginPath(); g.arc(14, 0, 4, 0, 7); g.fill();                    // clasp
    g.restore();
  }

  // ---------------- Right click: Crimson Bands (bind, then drag the enemies in) ----------------
  function castBands() {
    if (cd.st_bands > 0) return;
    const near = enemies.filter(e => dist(e, player) < 430 && Math.abs(angDiff(player.aim, Math.atan2(e.y - player.y, e.x - player.x))) < 1.05)
      .sort((a, b) => dist(a, player) - dist(b, player)).slice(0, 4);
    if (!near.length) {                                                // a miss: the bands lash out and snap back
      cd.st_bands = 1.2; bands.push({ miss: true, ang: player.aim, t: 0 }); sfx.bands(); return;
    }
    cd.st_bands = 6;
    for (const e of near) { bindEnemy(e, 2.8); if (!e.boss) e.pullT = 0.55; bands.push({ e, t: 0 }); burst(e.x, e.y, 10, '#ff4d3d', 220, 0.4); }
    addShake(4); sfx.bands(); sfx.grapple();
  }
  function updateBands(dt) {
    for (const b of bands.slice()) { b.t += dt; if (b.t > 0.45) bands.splice(bands.indexOf(b), 1); }
    for (const e of enemies) {                                         // the drag
      if (!(e.pullT > 0)) continue;
      e.pullT -= dt;
      const d = dist(e, player);
      if (d > player.r + e.r + 34) { e.kx = (player.x - e.x) / d * 640; e.ky = (player.y - e.y) / d * 640; }
    }
  }
  function drawBands() {
    ctx.save(); ctx.lineCap = 'round'; ctx.shadowColor = '#ff4d3d'; ctx.shadowBlur = 14;
    for (const b of bands) {
      const k = b.t / 0.45, tx = b.miss ? player.x + Math.cos(b.ang) * 340 * Math.sin(k * Math.PI) : b.e.x, ty = b.miss ? player.y + Math.sin(b.ang) * 340 * Math.sin(k * Math.PI) : b.e.y;
      const dx = tx - player.x, dy = ty - player.y, d = Math.hypot(dx, dy) || 1, nx = -dy / d, ny = dx / d;
      ctx.globalAlpha = 1 - k * 0.6;
      for (let s = 0; s < 3; s++) {
        ctx.strokeStyle = s === 1 ? '#ffd0b0' : '#ff4d3d'; ctx.lineWidth = s === 1 ? 1.5 : 3; ctx.beginPath();
        for (let i = 0; i <= 14; i++) { const u = i / 14, w = Math.sin(u * 9 + time * 20 + s * 2.1) * 6 * Math.sin(u * Math.PI); const x = player.x + dx * u + nx * w, y = player.y + dy * u + ny * w; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
        ctx.stroke();
      }
    }
    ctx.restore();
    for (const e of enemies) {                                         // runic bands around everything that is held
      if (!(e.bound > time)) continue;
      ctx.save(); ctx.translate(e.x, e.y); ctx.strokeStyle = '#ff4d3d'; ctx.shadowColor = '#ff4d3d'; ctx.shadowBlur = 10; ctx.lineWidth = 2.5; ctx.setLineDash([7, 5]);
      ctx.rotate(time * 2); ctx.beginPath(); ctx.ellipse(0, 0, e.r + 9, e.r + 3, 0, 0, 7); ctx.stroke();
      ctx.rotate(1.6 - time * 4); ctx.beginPath(); ctx.ellipse(0, 0, e.r + 3, e.r + 9, 0, 0, 7); ctx.stroke(); ctx.restore();
    }
  }

  // ---------------- F: mirror-dimension illusions ----------------
  function castMirror() {
    if (cd.st_mirror > 0) return;
    cd.st_mirror = 11; clones = [];
    for (const off of [[-26, -64], [-26, 64], [-80, 0]]) {
      clones.push({ x: player.x, y: player.y, off, life: 8 });
      ring(player.x, player.y, 46, C.bolt);
    }
    burst(player.x, player.y, 22, '#bfe8ff', 260, 0.5); sfx.clone();
  }
  function updateClones(dt) {
    const ca = Math.cos(player.aim), sa = Math.sin(player.aim);
    for (const c of clones.slice()) {
      c.life -= dt;
      const tx = player.x + c.off[0] * ca - c.off[1] * sa, ty = player.y + c.off[0] * sa + c.off[1] * ca, k = Math.min(1, 7 * dt);
      c.x = clamp(c.x + (tx - c.x) * k, A.x + 14, A.x + A.w - 14); c.y = clamp(c.y + (ty - c.y) * k, A.y + 14, A.y + A.h - 14);
      if (c.life <= 0) killClone(c);
    }
  }

  // ---------------- R: the Eye of Agamotto turns time back ----------------
  function castRewind() {
    if (cd.st_time > 0 || hist.length < 8 || rw) return;
    cd.st_time = 24; if (stopT > 0) endTimeStop();
    rw = { t: 0, dur: 1.1, snaps: hist.slice() };
    player.rewT = rw.dur; player.inv = Math.max(player.inv, rw.dur + 0.2); player.swing = 0;
    ebolts.length = 0; orbs = []; bands = [];                          // the future un-happens
    ring(player.x, player.y, 120, TIME_GREEN); burst(player.x, player.y, 26, TIME_GREEN, 300, 0.6); addShake(5); sfx.rewind();
  }
  function rewindAt(p) {                                               // which two snapshots we are between, and how far
    const n = rw.snaps.length, f = (n - 1) * (1 - ease(p)), i = Math.min(n - 2, Math.floor(f));
    return { a: rw.snaps[i], b: rw.snaps[i + 1], k: f - i };
  }
  function updateRewind(dt) {
    rw.t += dt;
    const p = Math.min(1, rw.t / rw.dur), s = rewindAt(p);
    player.x = s.a.px + (s.b.px - s.a.px) * s.k; player.y = s.a.py + (s.b.py - s.a.py) * s.k;
    player.vx = 0; player.vy = 0; player.kx = 0; player.ky = 0; player.inv = Math.max(player.inv, 0.4);
    particles.push({ x: player.x, y: player.y, vx: 0, vy: 0, life: 0.35, max: 0.35, color: TIME_GREEN, size: 7 });
    if (p >= 1) {
      player.hp = Math.min(maxHp(), Math.max(player.hp, rw.snaps[0].hp));            // the hits you took never happened
      ring(player.x, player.y, 140, TIME_GREEN); burst(player.x, player.y, 30, TIME_GREEN, 320, 0.6); addShake(4);
      rw = null; player.rewT = 0; hist = []; histT = 0;
    }
  }
  function rewindEnemies() {                                           // enemies retrace their steps too
    if (!rw) return;
    const s = rewindAt(Math.min(1, rw.t / rw.dur));
    for (const e of enemies) {
      const a = s.a.es.get(e), b = s.b.es.get(e);
      if (a && b) { e.x = a[0] + (b[0] - a[0]) * s.k; e.y = a[1] + (b[1] - a[1]) * s.k; }
      else if (a || b) { const q = a || b; e.x = q[0]; e.y = q[1]; }
      e.kx = 0; e.ky = 0; e.stun = Math.max(e.stun, 0.3);
    }
  }
  function recordHistory(dt) {
    histT += dt; if (histT < 0.1) return; histT = 0;
    hist.push({ px: player.x, py: player.y, hp: player.hp, es: new Map(enemies.map(e => [e, [e.x, e.y]])) });
    if (hist.length > 42) hist.shift();
  }
  function drawEye() {
    if (!rw) return;
    const p = rw.t / rw.dur, R = 44 + Math.sin(rw.t * 12) * 3;
    ctx.save(); ctx.fillStyle = 'rgba(80,255,150,' + (0.10 + 0.05 * Math.sin(rw.t * 14)) + ')'; ctx.fillRect(0, 0, W, H);
    ctx.translate(player.x, player.y); ctx.strokeStyle = TIME_GREEN; ctx.shadowColor = TIME_GREEN; ctx.shadowBlur = 18; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(0, 0, R, 0, 7); ctx.stroke();
    ctx.lineWidth = 2; ctx.setLineDash([4, 6]); ctx.beginPath(); ctx.arc(0, 0, R + 12, 0, 7); ctx.stroke(); ctx.setLineDash([]);
    for (const [len, sp] of [[R - 6, -14], [R * 0.6, -3.5]]) { const a = p * sp; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a - 1.57) * len, Math.sin(a - 1.57) * len); ctx.stroke(); }
    ctx.restore();
  }

  // ---------------- T: the Eye of Agamotto stops time ----------------
  // Enemies, their fire, lava geysers and spawning all freeze. You do not. Frozen enemies take +50% damage.
  function castTimeStop() {
    if (cd.st_stop > 0 || stopT > 0 || player.rewT > 0) return;
    cd.st_stop = 22; stopT = STOP_DUR;
    ring(player.x, player.y, 440, TIME_GREEN); ring(player.x, player.y, 260, '#ffffff'); burst(player.x, player.y, 34, TIME_GREEN, 360, 0.7);
    addShake(6); sfx.timestop();
  }
  function endTimeStop() {
    stopT = 0;
    for (const b of ebolts) if (b.fvx !== undefined) { b.vx = b.fvx; b.vy = b.fvy; delete b.fvx; delete b.fvy; }   // held fire flies on
    ring(player.x, player.y, 300, TIME_GREEN); sfx.timego();
  }
  function holdTime(dt) {                                              // runs before the engine's own timers tick, so adding dt back cancels them
    stopT -= dt;
    spawnTimer += dt; if (mode === 'campaign' && camp.wait > 0) camp.wait += dt;
    if ((LOCS[locKey] || {}).hazard) { hazTimer += dt; for (const h of hazards) h.t += dt; }
    for (const b of ebolts) { if (b.fvx === undefined) { b.fvx = b.vx; b.fvy = b.vy; } b.vx = 0; b.vy = 0; b.life += dt; }
    if (stopT <= 0) endTimeStop();
  }
  function freezeEnemies() {
    const bossHeld = stopT > STOP_DUR / 2;                             // bosses only hold for the first half
    for (const e of enemies) {
      if (e.boss && !bossHeld) continue;
      e.stun = Math.max(e.stun, 0.25); e.kx = 0; e.ky = 0; e.marked = Math.max(e.marked || 0, time + 0.3);
    }
  }
  function drawTimeStop() {
    if (stopT <= 0) return;
    ctx.save();
    const g = ctx.createRadialGradient(W / 2, H / 2, 120, W / 2, H / 2, 560); g.addColorStop(0, 'rgba(90,255,190,0.02)'); g.addColorStop(1, 'rgba(40,190,130,0.28)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = TIME_GREEN; ctx.shadowColor = TIME_GREEN; ctx.shadowBlur = 8; ctx.lineWidth = 2;
    for (const e of enemies) {                                         // a stopped clock over everything that is held
      if (e.boss && stopT <= STOP_DUR / 2) continue;
      const cx = e.x, cy = e.y - e.r - 15;
      ctx.beginPath(); ctx.arc(cx, cy, 9, 0, 7); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx, cy - 6); ctx.moveTo(cx, cy); ctx.lineTo(cx + 4, cy + 2); ctx.stroke();
    }
    for (const b of ebolts) if (b.fvx !== undefined) { ctx.beginPath(); ctx.arc(b.x, b.y, 9, 0, 7); ctx.stroke(); }     // frozen fire
    ctx.lineWidth = 3; ctx.shadowBlur = 12; ctx.beginPath(); ctx.arc(player.x, player.y, player.r + 12, -Math.PI / 2, -Math.PI / 2 + TAU * (stopT / STOP_DUR)); ctx.stroke();
    ctx.restore();
  }

  // ---------------- levitation: wear the cloak and float ----------------
  function drawBillow(g, x, y) {                                        // the cloak streaming out behind him
    g.save(); g.translate(x, y); g.rotate(player.aim + Math.PI); g.fillStyle = look.cape; g.globalAlpha = 0.85;
    for (const s of [-1, 0, 1]) {
      const w = Math.sin(time * 14 + s * 1.7) * 5;
      g.beginPath(); g.moveTo(6, s * 9); g.quadraticCurveTo(22, s * 13 + w, 36 - Math.abs(s) * 7, s * 16 + w * 1.4); g.quadraticCurveTo(22, s * 5 - w, 6, s * 4); g.closePath(); g.fill();
    }
    g.restore();
  }

  // ---------------- body ----------------
  function gear(g, c) {
    const { r, hr, gear } = c;
    g.strokeStyle = '#c4c6cf'; g.lineWidth = 3; g.lineCap = 'round';                             // silver temples
    for (const s of [-1, 1]) { g.beginPath(); g.arc(0, 0, hr - 2, s * Math.PI * 0.43, s * Math.PI * 0.58, s < 0); g.stroke(); }
    if (gear === 1) {                                                                            // hood: the cloak's collar raised
      g.fillStyle = look.cape; g.beginPath(); g.arc(-1, 0, hr + 1, 0, 7); g.fill();
      g.beginPath(); g.moveTo(-hr + 2, -8); g.lineTo(-hr - 9, 0); g.lineTo(-hr + 2, 8); g.closePath(); g.fill();
      g.fillStyle = '#d9c3a0'; g.beginPath(); g.arc(hr * 0.35, 0, hr * 0.4, 0, 7); g.fill();
    }
    g.fillStyle = '#2a1f1a'; g.beginPath(); g.ellipse(hr * 0.72, 0, 3.2, 2.2, 0, 0, 7); g.fill();  // goatee
    if (gear === 2) {                                                                            // the third eye
      g.save(); g.shadowColor = TIME_GREEN; g.shadowBlur = 8; g.fillStyle = TIME_GREEN; g.beginPath(); g.arc(hr * 0.4, 0, 3, 0, 7); g.fill(); g.restore();
    }
  }
  function drawBareBody(g, x, y, r, aim, alpha) {                                                // the body without the cloak: blue tunic
    const hr = r - 2;
    g.save(); g.translate(x, y); g.globalAlpha = alpha;
    g.fillStyle = '#2b57a6'; g.beginPath(); g.arc(0, 0, r + 2, 0, 7); g.fill();
    g.strokeStyle = '#1b3a73'; g.lineWidth = 3; g.beginPath(); g.arc(0, 0, r - 3, 0, 7); g.stroke();
    g.fillStyle = '#d9c3a0'; g.beginPath(); g.arc(0, 0, hr, 0, 7); g.fill();
    g.rotate(aim);
    g.fillStyle = CHARS[look.char].hair; g.beginPath(); g.arc(0, 0, hr - 1, Math.PI * 0.55, Math.PI * 1.45); g.closePath(); g.fill();
    gear(g, { r, hr, gear: look.gear });
    g.fillStyle = '#e7eef4'; g.beginPath(); g.moveTo(r + 3, 0); g.lineTo(r - 5, -5); g.lineTo(r - 5, 5); g.fill();
    g.restore();
  }

  registerHero({
    id: 'strange', name: 'Doctor Strange', team: 'avengers', order: 9,
    blurb: 'Sorcerer Supreme. Portals, a steerable cloak, rewind time, mirror images, crimson bands.',
    look: {
      capeLab: 'Cloak', cape: '#b3262e', fx: '#ffb347', hair: '#2a2420',
      gears: ['Silver temples', 'Raised collar', 'Third eye'],
      help: '<b>Hold click</b> fires mystic orbs. <b>Right click</b> crimson bands bind enemies and drag them to you. <b>Q</b> opens a portal pair: an entrance ahead of you, an exit at the cursor. Enemies, your orbs and enemy fire all come out the other side. <b>E</b> sends the cloak flying; steer it with the mouse, it wraps what it touches. Press <b>E</b> again to recall it. <b>F</b> three mirror images draw fire and shoot with you. <b>R</b> the Eye of Agamotto turns time back about 4 seconds, restoring your hearts. <b>T</b> stops time for 3.5 seconds: enemies, their fire, lava and spawning freeze, and frozen enemies take +50% damage. <b>Hold Space</b> to levitate: fly where you aim, and melee and lava cannot touch you, until the meter runs dry. With the cloak out, <b>Space</b> instead pulls you to it like a grapple, hitting what is in the way.',
      keys: ['Hold click: orbs     Right click: crimson bands', 'Q portals     E cloak (steer, E recalls)     F mirror images', 'R rewind     T time stop     Space: levitate / fly to cloak']
    },
    cd: { st_orb: 0, st_bands: 0, st_portal: 0, st_cloak: 0, st_mirror: 0, st_time: 0, st_stop: 0 },
    init: () => ({ cloakOut: false, rewT: 0, pcd: 0, lev: false, levE: 100, levDelay: 0 }),
    reset() { orbs = []; portals = []; cloak = null; bands = []; hist = []; histT = 0; rw = null; stopT = 0; spaceSpent = false; },
    onKey(code) {
      if (player.rewT > 0) return;
      if (code === 'KeyQ') castPortal();
      if (code === 'KeyE') castCloak();
      if (code === 'KeyF') castMirror();
      if (code === 'KeyR') castRewind();
      if (code === 'KeyT') castTimeStop();
      if (code === 'Space' && cloak) { spaceSpent = true; startCloakZip(); }     // this press belongs to the cloak, not to levitation
    },
    onMouse(button) {
      if (player.rewT > 0) return;
      if (button === 2) castBands(); else { mouse.down = true; fireOrb(); }
    },
    preMove(dt) {                                                      // hold Space (cloak on) to levitate, on a meter
      if (!keys.has('Space')) spaceSpent = false;
      const wants = keys.has('Space') && !spaceSpent && !cloak && !player.zip && player.rewT <= 0 && (player.lev ? player.levE > 0 : player.levE > 12);
      if (wants) { player.levE = Math.max(0, player.levE - 30 * dt); player.levDelay = 0.6; }
      else { player.levDelay -= dt; if (player.levDelay <= 0) player.levE = Math.min(100, player.levE + 24 * dt); }
      player.lev = wants && player.levE > 0;
      if (player.lev) particles.push({ x: player.x, y: player.y + 6, vx: (Math.random() - 0.5) * 30, vy: 20, life: 0.3, max: 0.3, color: look.cape, size: 3 });
      return { noSlip: player.lev, fly: player.lev };
    },
    onHurt(h) {
      if (stopT > 0 && !h.src && !h.noBlock) { burst(player.x, player.y, 6, TIME_GREEN, 160, 0.3); return true; }   // frozen fire crumbles when touched
      if (player.lev && (h.src || h.noBlock)) return true;                                                          // floating: melee and lava cannot reach him
      return false;
    },
    speed() { return player.lev ? 410 : player.cloakOut ? 280 : 255; },    // lighter without the cloak, fastest floating
    preEnemies() { if (stopT > 0) freezeEnemies(); },
    update(dt) {
      if (!rw) recordHistory(dt);
      if (player.rewT > 0) return;
      if (stopT > 0) holdTime(dt);
      if (mouse.down) fireOrb();
      updatePortals(dt); updateOrbs(dt); updateCloak(dt); updateBands(dt); updateClones(dt);
    },
    postEnemies(dt) {
      rewindEnemies();
      for (const e of enemies) {                                      // enemies pop the mirror images they touch
        if (e.pinned || e.stun > 0) continue;
        for (const c of clones.slice()) {
          if (dist(e, c) < e.r + 14) { const d = dist(e, c) || 1; killClone(c); knock(e, (e.x - c.x) / d * 260, (e.y - c.y) / d * 260, 0.7); }
        }
      }
    },
    skills() {
      return [
        { k: 'M1', n: 'Orbs', cd: cd.st_orb, max: 0.42, ok: true },
        { k: 'M2', n: 'Bands', cd: cd.st_bands, max: 6, ok: true },
        { k: 'Q', n: 'Portals', cd: cd.st_portal, max: 9, ok: true },
        { k: 'E', n: cloak ? 'Recall' : 'Cloak', cd: cloak ? 0 : cd.st_cloak, max: 4, ok: true },
        { k: 'F', n: 'Mirrors', cd: cd.st_mirror, max: 11, ok: true },
        { k: 'R', n: 'Rewind', cd: cd.st_time, max: 24, ok: hist.length >= 8 },
        { k: 'T', n: 'Time Stop', cd: cd.st_stop, max: 22, ok: stopT <= 0 },
        cloak ? { k: 'Space', n: 'Fly to cloak', cd: 0, max: 1, ok: !cloak.anchored } : { k: 'Space', n: 'Levitate', cd: (1 - player.levE / 100) * 4, max: 4, ok: player.levE > 12 }
      ];
    },
    message() {
      if (player.rewT > 0) return 'Time turns back...';
      if (stopT > 0) return 'Time stopped ' + stopT.toFixed(1) + 's. Frozen enemies take +50% damage.';
      if (player.lev) return 'Levitating. Melee and lava cannot touch you.';
      if (cloak) return cloak.anchored ? 'Flying to the cloak...' : cloak.back ? 'The cloak returns.' : 'Steer the cloak with the mouse. Space flies you to it. E recalls it.';
      if (portals.length) return 'Portals open: ' + Math.ceil(portals[0].life - portals[0].age) + 's. Walk through, or push enemies in.';
      if (clones.length) return 'Mirror images are drawing fire.';
      return 'Hold click for orbs, right click to bind, hold Space to levitate.';
    },
    aimLine() { return player.rewT > 0 ? 0 : 480; },
    bodyRing(g, r) { g.strokeStyle = '#2b57a6'; g.lineWidth = 4; g.beginPath(); g.arc(0, 0, r - 3, 0, 7); g.stroke(); },   // the blue tunic under the cloak
    drawUnder() { for (const p of portals) drawPortal(p); },
    drawBefore() {
      for (const c of clones) {                                       // mirror images: glassy and cyan-edged
        const blink = c.life < 1.5 && Math.floor(c.life * 8) % 2 === 0, wob = Math.sin(time * 8 + c.off[1]) * 1.5;
        ctx.save(); ctx.shadowColor = '#bfe8ff'; ctx.shadowBlur = 14;
        drawChar(ctx, c.x + wob, c.y, player.r, player.aim, blink ? 0.22 : 0.55);
        ctx.restore();
        ctx.strokeStyle = 'rgba(191,232,255,0.7)'; ctx.lineWidth = 1.5; ctx.setLineDash([3, 4]);
        ctx.beginPath(); ctx.arc(c.x + wob, c.y, player.r + 6, 0, 7); ctx.stroke(); ctx.setLineDash([]);
      }
    },
    drawBodyOverride(px, py, alpha) {
      if (player.lev) {                                                // lifted off the ground: shadow below, cloak streaming behind
        const lift = 9 + Math.sin(time * 6) * 2;
        ctx.save(); ctx.globalAlpha = 0.3 * alpha; ctx.fillStyle = '#000'; ctx.beginPath(); ctx.ellipse(px, py + player.r * 0.9, player.r * 0.9, player.r * 0.38, 0, 0, 7); ctx.fill(); ctx.restore();
        drawBillow(ctx, px, py - lift); drawChar(ctx, px, py - lift, player.r, player.aim, alpha);
        return true;
      }
      if (!player.cloakOut) return false;
      drawBareBody(ctx, px, py, player.r, player.aim, alpha);
      return true;
    },
    hudBars() {
      ctx.font = '11px "Palatino Linotype", Palatino, Georgia, serif'; ctx.textAlign = 'left';
      if (player.levE < 100 || player.lev) {
        ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.fillRect(48, 46, 140, 6);
        ctx.fillStyle = player.lev ? '#a8dcff' : '#5a8fcb'; ctx.fillRect(48, 46, 140 * player.levE / 100, 6);
        ctx.fillStyle = 'rgba(231,238,244,0.7)'; ctx.fillText('LEVITATION ' + Math.round(player.levE) + '%', 194, 49);
      }
      if (stopT > 0) {
        ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.fillRect(48, 57, 140, 6);
        ctx.fillStyle = TIME_GREEN; ctx.fillRect(48, 57, 140 * stopT / STOP_DUR, 6);
        ctx.fillStyle = 'rgba(231,238,244,0.7)'; ctx.fillText('TIME STOP ' + stopT.toFixed(1) + 's', 194, 60);
      }
      ctx.font = '700 22px "Palatino Linotype", Palatino, Georgia, serif';
    },
    drawOver() {
      drawBands();
      if (cloak && cloak.anchored) {                                   // the cloak tethered to him as it pulls
        ctx.save(); ctx.strokeStyle = look.cape; ctx.shadowColor = look.cape; ctx.shadowBlur = 10; ctx.lineWidth = 3; ctx.setLineDash([10, 6]); ctx.lineDashOffset = -time * 80;
        ctx.beginPath(); ctx.moveTo(player.x, player.y); ctx.lineTo(cloak.x, cloak.y); ctx.stroke(); ctx.restore();
      }
      if (cloak) drawCloak(ctx, cloak);
      for (const o of orbs) {
        ctx.save(); ctx.shadowColor = C.bolt; ctx.shadowBlur = 20;
        ctx.fillStyle = C.bolt; ctx.beginPath(); ctx.arc(o.x, o.y, o.r, 0, 7); ctx.fill();
        ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(o.x, o.y, o.r * 0.45, 0, 7); ctx.fill();
        ctx.strokeStyle = C.bolt; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(o.x, o.y, o.r + 4 + Math.sin(time * 20) * 1.5, 0, 7); ctx.stroke();
        ctx.restore();
      }
      drawEye();
      drawTimeStop();
    },
    gear,
    api: { state: () => ({ orbs: orbs.length, portals: portals.length, cloak: cloak ? { x: cloak.x, y: cloak.y, back: cloak.back, anchored: !!cloak.anchored } : null, stopT, lev: player.lev, levE: player.levE, bands: bands.length, hist: hist.length, oldest: hist[0] ? { x: hist[0].px, y: hist[0].py, hp: hist[0].hp } : null, rewinding: !!rw }) }   // exposed for the automated tests
  });

  registerForcedState(5, () => player.rewT > 0, updateRewind);        // time travel takes over movement completely
})();