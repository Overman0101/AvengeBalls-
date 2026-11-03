// HULK: anger meter and growth, hook-hook-slam combo, grab and slam, leap, stampede, Hulk Out, ground pound, boulder and rampage.

// Self-contained: everything in this file is private to the hero, except what registerHero() hands to the engine.

(function () {

  let rocks = [];


  const hm = () => 1 + 0.8 * player.anger / 100;                      // damage multiplier from anger

  const hulkFree = () => !player.leap && player.rush <= 0 && !player.hgrab;

  function gainAnger(n) { player.anger = Math.min(100, player.anger + n); player.angerT = 3; }

  function hulkStrike(e, dmg, kb, stun, ax, ay) {
    const d = Math.hypot(e.x - ax, e.y - ay) || 1;
    knock(e, (e.x - ax) / d * kb, (e.y - ay) / d * kb, stun);
    damage(e, dmg * hm()); gainAnger(2.5);
  }

  // Click: smash whatever is in front of you
  function hulkSmash() {
    if (!hulkFree()) return;
    if (player.atk || cd.smash > 0) { if (cd.smash <= 0.15) player.smashBuf = 0.3; return; }   // a click during a swing is buffered
    const k = player.anger / 100, now = time;
    if (!player.combo || now - player.combo.last > 0.75) player.combo = { n: 0, last: now };
    const n = player.combo.n, aim = assistAim(player.aim, 150, 1.0);
    if (n < 2) { startHulkAtk('hook', aim, n === 0 ? -1 : 1, 0.26 - 0.06 * k); cd.smash = 0.1; lunge(aim, 300); }   // hook, hook...
    else { startHulkAtk('slam', aim, 0, 0.34 - 0.06 * k); cd.smash = 0.45 - 0.15 * k; lunge(aim, 480); }            // ...then the slam
    player.combo.n = (n + 1) % 3; player.combo.last = now; sfx.swing();
  }

  // Right click: thunderclap, a cone of force that launches enemies
  function hulkClap() {
    if (cd.clap > 0 || !hulkFree()) return;
    cd.clap = 4; player.clapT = 0.22;
    for (const e of enemies.slice()) {
      const d = dist(e, player);
      if (d < player.r + 170 + e.r && Math.abs(wrap(Math.atan2(e.y - player.y, e.x - player.x) - player.aim)) < 0.8) hulkStrike(e, 1.5, 900, 0.8, player.x, player.y);
    }
    killBoltsNear(player.x + Math.cos(player.aim) * 90, player.y + Math.sin(player.aim) * 90, 110);
    ring(player.x + Math.cos(player.aim) * 60, player.y + Math.sin(player.aim) * 60, 90, '#ffffff');
    ring(player.x + Math.cos(player.aim) * 90, player.y + Math.sin(player.aim) * 90, 150, C.bolt);
    sfx.shock(); addShake(7);
  }

  // Q: leap and crash (reuses the leap system with a bigger landing)
  function castHulkLeap() {
    if (cd.hleap > 0 || player.leap || player.rush > 0) return;
    cd.hleap = 8;
    const k = player.anger / 100;
    const dx = mouse.x - player.x, dy = mouse.y - player.y, d = Math.hypot(dx, dy) || 1, reach = Math.min(d, 520);
    player.leap = {
      t: 0, dur: 0.5, sx: player.x, sy: player.y,
      tx: clamp(player.x + dx / d * reach, A.x + player.r, A.x + A.w - player.r),
      ty: clamp(player.y + dy / d * reach, A.y + player.r, A.y + A.h - player.r),
      rad: 125 + 40 * k, dmg: 3 * hm(), heavy: true, onHit: () => gainAnger(3)
    };
    sfx.throw();
  }

  // E: bull rush. Plows through everything until it hits a wall, then slams.
  function castRush() {
    if (cd.rush > 0 || !hulkFree()) return;
    cd.rush = 6; player.rush = 0.6; player.rushA = player.aim; player.rushHit = new Set(); player.carry = []; player.atk = null;
    sfx.roar();
  }

  function updateRush(dt) {
    player.rush -= dt;
    const k = player.anger / 100, sp = 780 * (1 + 0.2 * k), c = Math.cos(player.rushA), sn = Math.sin(player.rushA);
    const nx = player.x + c * sp * dt, ny = player.y + sn * sp * dt;
    const cx = clamp(nx, A.x + player.r, A.x + A.w - player.r), cy = clamp(ny, A.y + player.r, A.y + A.h - player.r);
    const wall = Math.abs(cx - nx) > 0.5 || Math.abs(cy - ny) > 0.5;
    player.x = cx; player.y = cy; player.inv = Math.max(player.inv, 0.15); player.vx = 0; player.vy = 0;
    for (const e of enemies) {                                          // scoop up to four enemies
      if (player.carry.length >= 4 || player.rushHit.has(e)) continue;
      if (dist(e, player) < player.r + e.r + 10) { player.rushHit.add(e); player.carry.push(e); sfx.hit(); addShake(4); gainAnger(3); }
    }
    player.carry = player.carry.filter(e => enemies.includes(e));
    const n = player.carry.length;
    player.carry.forEach((e, i) => {                                    // carried enemies ride in front of his fists
      const side = (i - (n - 1) / 2) * e.r * 1.7, fwd = player.r + e.r * 0.9;
      e.x = clamp(player.x + c * fwd - sn * side, A.x + e.r, A.x + A.w - e.r);
      e.y = clamp(player.y + sn * fwd + c * side, A.y + e.r, A.y + A.h - e.r);
      e.kx = 0; e.ky = 0; e.stun = Math.max(e.stun, 0.3);
    });
    killBoltsNear(player.x, player.y, player.r + 30);
    particles.push({ x: player.x, y: player.y, vx: 0, vy: 0, life: 0.3, max: 0.3, color: C.bolt, size: 7 });
    if (wall || player.rush <= 0) endStampede(wall);
  }

  function endStampede(wall) {
    const crowd = player.carry.slice(), c = Math.cos(player.rushA), sn = Math.sin(player.rushA);
    player.rush = 0; player.carry = [];
    if (wall) {                                                         // crush them against the wall
      ring(player.x + c * player.r, player.y + sn * player.r, 120, '#ffffff'); burst(player.x + c * player.r, player.y + sn * player.r, 26, C.bolt, 340, 0.5);
      addShake(12); hitstop = 0.09; sfx.slam(); gainAnger(5);
      for (const e of crowd) { knock(e, 0, 0, 1.2); damage(e, 3 * hm()); }
      for (const e of enemies.slice()) {
        if (!crowd.includes(e) && dist(e, player) < 120 + e.r) hulkStrike(e, 2, 600, 1.0, player.x, player.y);
      }
    } else {                                                            // out of steam: fling them on ahead
      for (const e of crowd) { knock(e, c * 600, sn * 600, 0.8); damage(e, 1.5 * hm()); }
    }
  }

  // F: Hulk Out. Anger straight to max, held there for a while, heals a heart.
  function castHulkOut() {
    if (cd.hout > 0) return;
    cd.hout = 25; player.anger = 100; player.angerT = 3; player.rageT = 8;
    if (player.hp < maxHp()) player.hp++;
    ring(player.x, player.y, 160, '#ffffff'); ring(player.x, player.y, 110, C.bolt);
    burst(player.x, player.y, 40, C.bolt, 420, 0.7);
    addShake(12); flash = 0.3; sfx.roar();
  }

  // R: ground pound. A big stunning shockwave that grows with your anger.
  function castPound() {
    if (cd.pound > 0 || !hulkFree()) return;
    cd.pound = 7;
    const rad = 140 + 60 * player.anger / 100;
    shocks.push({ x: player.x, y: player.y, r: 10, max: rad, visual: true, hit: new Set() });
    ring(player.x, player.y, rad, '#ffffff'); burst(player.x, player.y, 30, '#ffffff', 360, 0.6);
    addShake(12); hitstop = 0.07; flash = 0.12; sfx.slam(); sfx.shock();
    for (const e of enemies.slice()) {
      const d = dist(e, player);
      if (d < rad + e.r) hulkStrike(e, 2, 700, 1.2, player.x, player.y);
    }
    killBoltsNear(player.x, player.y, rad);
  }

  // T: boulder throw. Plows through enemies and explodes on the wall.
  function castBoulder() {
    if (cd.rock > 0 || !hulkFree()) return;
    cd.rock = 6;
    const k = player.anger / 100;
    rocks.push({ x: player.x + Math.cos(player.aim) * (player.r + 8), y: player.y + Math.sin(player.aim) * (player.r + 8), vx: Math.cos(player.aim) * 750, vy: Math.sin(player.aim) * 750, r: 16 + 8 * k, life: 1.4, hit: new Set(), spin: 0 });
    sfx.throw(); addShake(3);
  }

  function updateRocks(dt) {
    for (const rk of rocks.slice()) {
      rk.spin += 8 * dt;
      const total = Math.hypot(rk.vx, rk.vy) * dt, steps = Math.max(1, Math.ceil(total / 10));
      let gone = false;
      for (let s = 0; s < steps && !gone; s++) {
        rk.x += rk.vx * dt / steps; rk.y += rk.vy * dt / steps;
        for (const e of enemies.slice()) {
          if (rk.hit.has(e) || Math.hypot(e.x - rk.x, e.y - rk.y) >= e.r + rk.r) continue;
          rk.hit.add(e); sfx.slam(); addShake(4); hitstop = Math.max(hitstop, 0.04);
          hulkStrike(e, 3, 500, 0.5, rk.x - rk.vx * 0.05, rk.y - rk.vy * 0.05);
        }
        if (rk.x < A.x || rk.x > A.x + A.w || rk.y < A.y || rk.y > A.y + A.h) {
          gone = true; explodeAt(clamp(rk.x, A.x, A.x + A.w), clamp(rk.y, A.y, A.y + A.h), 80, 2 * hm(), '#b8a47a');
        }
      }
      rk.life -= dt;
      if (!gone && rk.life <= 0) { gone = true; explodeAt(rk.x, rk.y, 70, 1.5 * hm(), '#b8a47a'); }
      if (gone) rocks.splice(rocks.indexOf(rk), 1);
    }
  }

  // G: rampage. Faster, and everything near you gets smashed over and over.
  function castRampage() {
    if (cd.ramp > 0 || player.rampage > 0 || player.anger < 40) return;
    cd.ramp = 20; player.rampage = 3.5; player.rampTick = 0;
    ring(player.x, player.y, 140, '#ffffff'); burst(player.x, player.y, 30, C.bolt, 360, 0.6);
    addShake(10); flash = 0.2; sfx.roar();
  }

  // ---- Hulk's attacks: the fists are on rigid arms and hit whatever they actually touch ----
  function hulkFistPos(aim, sd, phi) {                                 // world position of a fist for a given arm angle
    const r = player.r, L = r * 1.25, lx = r * 0.1 + L * Math.cos(phi), ly = sd * r * 0.78 + L * Math.sin(phi);
    const c = Math.cos(aim), sn = Math.sin(aim);
    return { x: player.x + lx * c - ly * sn, y: player.y + lx * sn + ly * c };
  }

  function slamSpot(aim) {
    const d0 = player.r * 1.9;
    return { x: player.x + Math.cos(aim) * d0, y: player.y + Math.sin(aim) * d0, rad: 62 + 28 * player.anger / 100 };
  }

  function startHulkAtk(kind, aim, sd, dur) { player.atk = { kind, aim, s: sd, t: 0, dur, hit: new Set(), trail: [], done: false }; }

  function updateHulkAtk(dt) {
    const Atk = player.atk;
    if (!Atk) return;
    if (player.leap || player.rush > 0 || player.hgrab) { player.atk = null; return; }
    Atk.t += dt; player.aim = Atk.aim;                                 // you commit to the swing direction
    const p = Math.min(1, Atk.t / Atk.dur), u = sweepU(p), fr = player.r * (0.36 + 0.05 * player.anger / 100);
    if (Atk.kind === 'hook') {
      const phi = Atk.s * 1.5 + (-Atk.s * 0.55 - Atk.s * 1.5) * u, f = hulkFistPos(Atk.aim, Atk.s, phi);
      Atk.trail.push(f); if (Atk.trail.length > 8) Atk.trail.shift();
      if (p >= 0.16) {
        for (const e of enemies.slice()) {
          if (Atk.hit.has(e) || Math.hypot(e.x - f.x, e.y - f.y) > fr + e.r + 10) continue;
          Atk.hit.add(e); hulkStrike(e, 1.5, 520, 0.3, player.x, player.y); sfx.hit(); hitstop = Math.max(hitstop, 0.04); addShake(4);
        }
        killBoltsNear(f.x, f.y, fr + 14);
      }
    } else if (p >= 0.7 && !Atk.done) {                                // both fists land: a ground slam in front of him
      Atk.done = true;
      const m = slamSpot(Atk.aim);
      ring(m.x, m.y, m.rad, '#ffffff'); ring(m.x, m.y, m.rad * 0.6, C.bolt); burst(m.x, m.y, 20, '#b8a47a', 320, 0.5);
      addShake(9); hitstop = Math.max(hitstop, 0.07); sfx.slam();
      for (const e of enemies.slice()) { if (Math.hypot(e.x - m.x, e.y - m.y) < m.rad + e.r) hulkStrike(e, 3, 650, 0.9, m.x, m.y); }
      killBoltsNear(m.x, m.y, m.rad);
    }
    if (p >= 1) player.atk = null;
  }

  function hulkPose() {                                                // arm angles and fist sizes for drawing
    const idle = Math.sin(time * 6) * 0.04, Atk = player.atk, G = player.hgrab;
    let l = -0.22 + idle, r = 0.22 - idle, ls = 1, rs = 1;
    if (player.rampage > 0) { const w = Math.sin(time * 22); l = -0.5 + w; r = 0.5 + w; ls = rs = 1.12; }
    else if (G && G.phase === 'lift') { l = 0.5; r = -0.5; ls = rs = 1.3; }
    else if (G) { l = 0.2; r = -0.2; ls = rs = 1.15; }
    else if (player.rush > 0) { l = 0.35; r = -0.35; ls = rs = 1.15; }
    else if (Atk) {
      const u = sweepU(Math.min(1, Atk.t / Atk.dur));
      if (Atk.kind === 'hook') {
        const phi = Atk.s * 1.5 + (-Atk.s * 0.55 - Atk.s * 1.5) * u;
        if (Atk.s < 0) { l = phi; ls = 1.18; } else { r = phi; rs = 1.18; }
      } else {
        l = -2.0 + 2.35 * u; r = 2.0 - 2.35 * u;
        ls = rs = 1.5 - 0.35 * Math.max(0, Math.min(1, u));            // fists loom large at the top of the slam
      }
    }
    return { l, r, ls, rs };
  }

  function drawHulkFx() {
    const Atk = player.atk;
    if (Atk && Atk.kind === 'hook' && Atk.trail.length > 1) {          // fading streak behind the punching fist
      ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      const n = Atk.trail.length, fr = player.r * 0.4;
      for (let i = 1; i < n; i++) {
        const a = Atk.trail[i - 1], b = Atk.trail[i], al = i / n;
        ctx.strokeStyle = fx(0.5 * al * al); ctx.lineWidth = fr * 2 * (0.4 + 0.6 * al);
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      }
      ctx.restore();
    }
    if (Atk && Atk.kind === 'slam') {                                  // shows where the slam is about to land
      const m = slamSpot(Atk.aim), pr = Math.min(1, Atk.t / Atk.dur);
      ctx.save(); ctx.strokeStyle = fx(0.25 + 0.4 * pr); ctx.lineWidth = 2; ctx.setLineDash([5, 5]);
      ctx.beginPath(); ctx.arc(m.x, m.y, m.rad, 0, 7); ctx.stroke(); ctx.fillStyle = fx(0.05 + 0.12 * pr); ctx.fill(); ctx.restore();
    }
    if (player.hgrab && enemies.includes(player.hgrab.e)) {            // grip glow on the grabbed enemy
      const e = player.hgrab.e;
      ctx.save(); ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 3; ctx.shadowColor = C.bolt; ctx.shadowBlur = 12;
      ctx.beginPath(); ctx.arc(e.x, e.y, e.r + 7, 0, 7); ctx.stroke(); ctx.restore();
    }
    if (player.rush > 0) {                                             // speed lines behind the stampede
      ctx.save(); ctx.strokeStyle = fx(0.4); ctx.lineWidth = 2; ctx.beginPath();
      for (let i = -2; i <= 2; i++) {
        const bx = player.x - Math.cos(player.rushA) * player.r * 1.3 - Math.sin(player.rushA) * i * player.r * 0.5;
        const by = player.y - Math.sin(player.rushA) * player.r * 1.3 + Math.cos(player.rushA) * i * player.r * 0.5;
        ctx.moveTo(bx, by); ctx.lineTo(bx - Math.cos(player.rushA) * 34, by - Math.sin(player.rushA) * 34);
      }
      ctx.stroke(); ctx.restore();
    }
  }

  // ---- RMB: grab the nearest enemy, hoist it, and slam it into the ground ----
  function castHulkGrab() {
    if (cd.hgrab > 0 || !hulkFree() || player.hgrab) return;
    let best = null, bd = player.r + 150;
    for (const e of enemies) {
      const d = dist(e, player);
      if (d < bd && Math.abs(wrap(Math.atan2(e.y - player.y, e.x - player.x) - player.aim)) < 0.9) { bd = d; best = e; }
    }
    if (!best) { cd.hgrab = 0.5; ring(player.x + Math.cos(player.aim) * 40, player.y + Math.sin(player.aim) * 40, 30, '#888888'); sfx.swing(); return; }   // whiff
    cd.hgrab = 3.5; player.atk = null; player.hgrab = { e: best, phase: 'reach', t: 0, aim: player.aim }; sfx.swing();
  }

  function updateHulkGrab(dt) {
    const G = player.hgrab, e = G.e;
    if (!enemies.includes(e)) { player.hgrab = null; return; }
    player.inv = Math.max(player.inv, 0.15); player.vx = 0; player.vy = 0;
    if (G.phase === 'reach') {                                         // lunge in and grab
      const dx = e.x - player.x, dy = e.y - player.y, d = Math.hypot(dx, dy) || 1, step = 950 * dt;
      player.aim = Math.atan2(dy, dx);
      if (d <= player.r + e.r + 6 || step >= d) { G.phase = 'lift'; G.t = 0.32; G.aim = player.aim; sfx.hit(); addShake(4); }
      else {
        player.x = clamp(player.x + dx / d * step, A.x + player.r, A.x + A.w - player.r);
        player.y = clamp(player.y + dy / d * step, A.y + player.r, A.y + A.h - player.r);
        particles.push({ x: player.x, y: player.y, vx: 0, vy: 0, life: 0.25, max: 0.25, color: C.bolt, size: 6 });
      }
    } else {                                                           // hold it up in front, then bring it down
      G.t -= dt; player.aim = G.aim;
      e.x = player.x + Math.cos(G.aim) * (player.r + e.r * 0.5); e.y = player.y + Math.sin(G.aim) * (player.r + e.r * 0.5);
      e.kx = 0; e.ky = 0; e.stun = Math.max(e.stun, 0.3);
      if (G.t <= 0) {
        const px = player.x + Math.cos(G.aim) * (player.r + 38), py = player.y + Math.sin(G.aim) * (player.r + 38);
        const rad = 80 + 25 * player.anger / 100;
        e.x = px; e.y = py; knock(e, 0, 0, 1.2);
        ring(px, py, rad, '#ffffff'); ring(px, py, rad * 0.6, C.bolt); burst(px, py, 26, '#b8a47a', 340, 0.6);
        addShake(12); hitstop = 0.09; sfx.slam(); sfx.shock();
        damage(e, 4 * hm()); gainAnger(6);
        for (const o of enemies.slice()) { if (o !== e && Math.hypot(o.x - px, o.y - py) < rad + o.r) hulkStrike(o, 2, 650, 1.2, px, py); }
        killBoltsNear(px, py, rad);
        player.hgrab = null;
      }
    }
  }

  // per-frame Hulk bookkeeping: timers, rampage ticks, anger decay, and growth
  function updateHulk(dt) {
    updateHulkAtk(dt);
    if (player.smashBuf > 0) { player.smashBuf -= dt; if (!player.atk && cd.smash <= 0) { player.smashBuf = 0; hulkSmash(); } }
    if (player.smashT > 0) player.smashT -= dt;
    if (player.clapT > 0) player.clapT -= dt;
    if (player.rageT > 0) { player.rageT -= dt; player.anger = Math.max(player.anger, 70); }
    if (player.rampage > 0) {
      player.rampage -= dt; player.rampTick -= dt; player.anger = Math.max(player.anger, 80);
      if (player.rampTick <= 0) {
        player.rampTick = 0.18;
        for (const e of enemies.slice()) {
          if (dist(e, player) < player.r + 78 + e.r) hulkStrike(e, 1, 380, 0.25, player.x, player.y);
        }
        killBoltsNear(player.x, player.y, player.r + 80);
        ring(player.x, player.y, player.r + 70, C.bolt); addShake(3);
      }
      if (player.rampage <= 0) { player.rampage = 0; player.anger = Math.max(0, player.anger - 25); ring(player.x, player.y, 90, C.bolt); }
    }
    if (player.angerT > 0) player.angerT -= dt;
    else if (player.rageT <= 0 && player.rampage <= 0) player.anger = Math.max(0, player.anger - 5 * dt);
    player.r = 22 + 10 * player.anger / 100;                         // the angrier, the bigger
    if (player.anger > 50 && Math.random() < dt * 25 * player.anger / 100) {
      particles.push({ x: player.x + (Math.random() - 0.5) * player.r * 2, y: player.y + (Math.random() - 0.5) * player.r * 2, vx: 0, vy: -50, life: 0.5, max: 0.5, color: C.bolt, size: 3 });
    }
  }

  function drawHulkBody(g, x, y, r, aim, alpha, anger, pose) {
    const k = anger / 100, skin = look.cape;
    const dark = mixHex(skin, '#000000', 0.3), mid = mixHex(skin, '#000000', 0.12), light = mixHex(skin, '#ffffff', 0.1);
    const L = r * 1.25, sx = r * 0.1, sy = r * 0.78, fr = r * (0.36 + 0.05 * k);     // arms have a fixed length
    const idle = Math.sin(time * 6) * 0.04;
    const pl = pose ? pose.l : -0.22 + idle, pr = pose ? pose.r : 0.22 - idle;
    const sl = pose ? pose.ls : 1, sr = pose ? pose.rs : 1;
    g.save(); g.translate(x, y); g.globalAlpha = alpha; g.rotate(aim);
    if (k > 0.15) { g.shadowColor = C.bolt; g.shadowBlur = 8 + 22 * k; }
    g.fillStyle = '#6a3d9a';                                                        // torn purple pants at the back
    g.beginPath(); g.ellipse(-r * 0.38, 0, r * 0.55, r * 0.8, 0, 0, 7); g.fill();
    g.fillStyle = mid;                                                              // torso, broad across the shoulders
    g.beginPath(); g.ellipse(0, 0, r * 0.82, r * 1.02, 0, 0, 7); g.fill();
    g.shadowBlur = 0;
    g.strokeStyle = 'rgba(0,0,0,0.25)'; g.lineWidth = Math.max(1.5, r * 0.07);      // chest line
    g.beginPath(); g.moveTo(r * 0.35, -r * 0.55); g.quadraticCurveTo(r * 0.58, 0, r * 0.35, r * 0.55); g.stroke();
    for (const [sd, phi, sc] of [[-1, pl, sl], [1, pr, sr]]) {                      // rigid arms, shoulder to fist
      const S0 = sx, S1 = sd * sy, F0 = sx + L * Math.cos(phi), F1 = sd * sy + L * Math.sin(phi);
      g.lineCap = 'round';
      g.strokeStyle = dark; g.lineWidth = r * 0.54; g.beginPath(); g.moveTo(S0, S1); g.lineTo(F0, F1); g.stroke();
      g.strokeStyle = mid; g.lineWidth = r * 0.38; g.beginPath(); g.moveTo(S0, S1); g.lineTo(F0, F1); g.stroke();
      g.fillStyle = light; g.beginPath(); g.arc(S0, S1, r * 0.4, 0, 7); g.fill();     // shoulder
      g.fillStyle = skin; g.strokeStyle = 'rgba(0,0,0,0.45)'; g.lineWidth = 1.5;      // fist
      g.beginPath(); g.arc(F0, F1, fr * sc, 0, 7); g.fill(); g.stroke();
      g.strokeStyle = 'rgba(255,255,255,0.22)'; g.lineWidth = 1.5;
      g.beginPath(); g.arc(F0, F1, fr * sc * 0.6, -2.4, -0.7); g.stroke();
    }
    const hx = r * 0.28, hr = r * 0.42;                                             // head
    g.fillStyle = skin; g.beginPath(); g.arc(hx, 0, hr, 0, 7); g.fill();
    g.fillStyle = '#16141a'; g.beginPath(); g.arc(hx, 0, hr * 1.04, Math.PI * 0.55, Math.PI * 1.45); g.closePath(); g.fill();
    if (look.gear === 1) {                                                          // headband
      g.strokeStyle = '#c93a3a'; g.lineWidth = Math.max(2, r * 0.1);
      g.beginPath(); g.arc(hx, 0, hr * 0.95, -1.2, 1.2); g.stroke();
    } else if (look.gear === 2) {                                                   // spiked brow
      g.fillStyle = mixHex(skin, '#000000', 0.35);
      for (const sd of [-1, 1]) { g.beginPath(); g.moveTo(hx + hr * 0.4, sd * hr * 0.2); g.lineTo(hx + hr * 0.95, sd * hr * 0.55); g.lineTo(hx + hr * 0.45, sd * hr * 0.7); g.closePath(); g.fill(); }
    }
    g.fillStyle = k > 0.6 ? '#e9ffd0' : '#ffffff';                                  // glowing eyes
    if (k > 0.3) { g.shadowColor = C.bolt; g.shadowBlur = 6 + 10 * k; }
    for (const sd of [-1, 1]) g.fillRect(hx + hr * 0.5, sd * hr * 0.34 - hr * 0.1, hr * 0.3, hr * 0.2);
    g.shadowBlur = 0;
    g.strokeStyle = '#16141a'; g.lineWidth = Math.max(2, r * 0.08);                 // angry brow
    g.beginPath(); g.moveTo(hx + hr * 0.4, -hr * 0.7); g.lineTo(hx + hr * 0.85, -hr * 0.2); g.moveTo(hx + hr * 0.4, hr * 0.7); g.lineTo(hx + hr * 0.85, hr * 0.2); g.stroke();
    g.restore();
  }

  registerHero({
    id: 'hulk', name: 'Hulk', team: 'avengers', order: 6,
    blurb: 'Rampaging brute. Gets bigger and stronger the angrier he gets.',
    look: {
      capeLab: 'Skin', cape: '#3fae4a', fx: '#b6ff4a', hair: '#16141a',
      gears: ['Bare head', 'Headband', 'Spiked brow'],
      help: '<b>Click</b> throws a three-hit combo: a left hook, a right hook, then a two-fisted slam. Keep clicking to chain it. <b>Right click</b> grabs the nearest enemy, hoists it, and slams it into the ground. <b>Q</b> leap and crash, <b>E</b> stampede (scoops up to 4 enemies and crushes them into the wall), <b>F</b> Hulk Out (instant max anger, heals 1), <b>R</b> ground pound, <b>T</b> boulder throw, <b>G</b> rampage (needs 40% anger). Landing hits and getting hurt build anger. More anger makes you bigger, faster and harder-hitting, and it fades when you stop fighting. WASD to move, mouse to aim, <b>P</b> to pause.',
      keys: ['Click: hook, hook, slam combo     Right click: grab and slam', 'Q leap     E stampede     F Hulk Out', 'R ground pound     T boulder     G rampage']
    },
    cd: { smash: 0, clap: 0, hleap: 0, rush: 0, hout: 0, pound: 0, rock: 0, ramp: 0, hgrab: 0 },
    init: () => ({ anger: 15, angerT: 0, rageT: 0, smashT: 0, smashA: 0, clapT: 0, rush: 0, rushA: 0, rushHit: new Set(), rampage: 0, rampTick: 0, atk: null, combo: null, smashBuf: 0, hgrab: null, carry: [] }),
    reset() {
      rocks = [];
      if (look.char === 'hulk') player.r = 22 + 10 * player.anger / 100;
    },
    onKey(code, e) {
      if (code === 'KeyQ') castHulkLeap();
      if (code === 'KeyE') castRush();
      if (code === 'KeyF') castHulkOut();
      if (code === 'KeyR') castPound();
      if (code === 'KeyT') castBoulder();
      if (code === 'KeyG') castRampage();
    },
    onMouse(button) {
      if (button === 2) castHulkGrab(); else { mouse.down = true; hulkSmash(); }
    },
    speed() { return 240 * (1 + 0.25 * player.anger / 100) * (player.rampage > 0 ? 1.35 : 1); },
    update(dt) {
      if (mouse.down) hulkSmash();
      updateRocks(dt); updateHulk(dt);
    },
    onHurt(h) { h.kb *= 0.35; gainAnger(20); return false; },                    // Hulk barely flinches and gets angrier
    hitRadius() { return player.r * 0.72; },                                      // a big body with a fair hitbox
    hudBars() {
      const k = player.anger / 100;
      ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.fillRect(48, 46, 140, 6);
      ctx.fillStyle = mixHex('#7dff6a', '#ff4a30', k); ctx.fillRect(48, 46, 140 * k, 6);
      ctx.font = '11px "Palatino Linotype", Palatino, Georgia, serif'; ctx.textAlign = 'left';
      ctx.fillStyle = 'rgba(231,238,244,0.7)';
      ctx.fillText(player.rageT > 0 || player.rampage > 0 ? 'ENRAGED' : 'ANGER ' + Math.round(player.anger) + '%', 194, 49);
      ctx.font = '700 22px "Palatino Linotype", Palatino, Georgia, serif';
    },
    skills() {
      return [
        { k: 'M1', n: 'Combo',    cd: cd.smash, max: 0.5, ok: hulkFree() },
        { k: 'RMB', n: 'Grab',    cd: cd.hgrab, max: 3.5, ok: hulkFree() },
        { k: 'Q', n: 'Leap',      cd: cd.hleap, max: 8,   ok: hulkFree() },
        { k: 'E', n: 'Rush',      cd: cd.rush,  max: 6,   ok: hulkFree() },
        { k: 'F', n: 'Hulk Out',  cd: cd.hout,  max: 25,  ok: true },
        { k: 'R', n: 'Pound',     cd: cd.pound, max: 7,   ok: hulkFree() },
        { k: 'T', n: 'Boulder',   cd: cd.rock,  max: 6,   ok: hulkFree() },
        { k: 'G', n: 'Rampage',   cd: cd.ramp,  max: 20,  ok: player.anger >= 40 && player.rampage <= 0 }
      ];
    },
    message() {
      let msg;
      if (player.rampage > 0) msg = 'RAMPAGE ' + player.rampage.toFixed(1) + 's';
      else if (player.rageT > 0) msg = 'HULK OUT! Anger locked high ' + player.rageT.toFixed(1) + 's';
      else if (player.anger >= 70) msg = 'Enraged: bigger, faster, hits harder.';
      else msg = 'Click: hook, hook, slam. Right click grabs and slams.';
      return msg;
    },
    drawBody(g, x, y, r, aim, alpha, opt) { drawHulkBody(g, x, y, r, aim, alpha, (opt && opt.anger) || 0, opt && opt.pose); },
    charOpts() { return { anger: player.anger, pose: hulkPose() }; },
    drawPlayerFx(px, py) {
      if (player.anger > 30) {                                        // gamma aura
          ctx.strokeStyle = fx(0.12 + 0.35 * player.anger / 100 * (0.7 + 0.3 * Math.sin(time * 9))); ctx.lineWidth = 3;
          ctx.beginPath(); ctx.arc(px, py, player.r + 6, 0, 7); ctx.stroke();
        }
        if (player.clapT > 0) {                                          // the thunderclap wave expands outward
          const k = player.clapT / 0.22, rad = (player.r + 170) * (1 - Math.pow(k, 2.2));
          ctx.fillStyle = fx(0.26 * k);
          ctx.beginPath(); ctx.moveTo(px, py); ctx.arc(px, py, rad, player.aim - 0.8, player.aim + 0.8); ctx.closePath(); ctx.fill();
          ctx.save(); ctx.strokeStyle = fx(0.75 * k); ctx.lineWidth = 6; ctx.lineCap = 'round';
          ctx.beginPath(); ctx.arc(px, py, rad, player.aim - 0.8, player.aim + 0.8); ctx.stroke(); ctx.restore();
        }
        if (player.rampage > 0) {
          ctx.save(); ctx.strokeStyle = fx(0.55); ctx.lineWidth = 6; ctx.lineCap = 'round'; ctx.shadowColor = C.bolt; ctx.shadowBlur = 12;
          for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(px, py, player.r + 28 + i * 14, time * 12 + i * 2.1, time * 12 + i * 2.1 + 1.6); ctx.stroke(); }
          ctx.restore();
        }
      drawHulkFx();
    },
    drawOver() {
      // Hulk: thrown boulders
      for (const rk of rocks) {
        ctx.save(); ctx.translate(rk.x, rk.y); ctx.rotate(rk.spin);
        ctx.fillStyle = '#7d6f55'; ctx.strokeStyle = '#4a4130'; ctx.lineWidth = 2;
        ctx.beginPath();
        for (let i = 0; i < 9; i++) { const a = i / 9 * Math.PI * 2, rr = rk.r * (0.82 + 0.18 * Math.sin(i * 2.3 + 1)); ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
        ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#a0916f'; ctx.beginPath(); ctx.arc(-rk.r * 0.25, -rk.r * 0.25, rk.r * 0.3, 0, 7); ctx.fill();
        ctx.restore();
      }
    },
    api: { hulkFistPos, hulkPose },                                              // exposed for the automated tests
  });

  registerForcedState(80, () => player.rush > 0, updateRush);
  registerForcedState(120, () => player.hgrab, updateHulkGrab);

})();
