// IRON MAN: repulsor laser, booster flight, missiles, energy shield, unsuit/drone armour, unibeam, grenade and palm blast.

// Self-contained: everything in this file is private to the hero, except what registerHero() hands to the engine.

(function () {

  let plates = [], missiles = [], pulses = [], ubeam = null;


  // Click (hold): single fast repulsor laser
  function fireRepulsor() {
    if (!player.suit || cd.repulsor > 0 || ubeam) return;
    cd.repulsor = 0.17;
    const a = player.aim;
    pulses.push({ x: player.x + Math.cos(a) * 18, y: player.y + Math.sin(a) * 18, vx: Math.cos(a) * 1300, vy: Math.sin(a) * 1300, life: 0.8, hit: new Set(), pierce: 1 });
    sfx.pew();
  }

  function updatePulses(dt) {
    for (const p of pulses.slice()) {
      const total = Math.hypot(p.vx, p.vy) * dt, steps = Math.max(1, Math.ceil(total / 10));
      let gone = false;
      for (let s = 0; s < steps && !gone; s++) {
        p.x += p.vx * dt / steps; p.y += p.vy * dt / steps;
        for (const e of enemies.slice()) {
          if (!p.hit.has(e) && Math.hypot(e.x - p.x, e.y - p.y) < e.r + 5) {
            p.hit.add(e);
            burst(e.x, e.y, 5, C.bolt, 180, 0.25);
            knock(e, p.vx * 0.12, p.vy * 0.12, 0.12);
            sfx.hit(); damage(e, 1.5);
            if (p.pierce > 0) p.pierce--; else { gone = true; break; }
          }
        }
        if (!gone && (p.x < A.x || p.x > A.x + A.w || p.y < A.y || p.y > A.y + A.h)) { burst(p.x, p.y, 4, C.bolt, 140, 0.25); gone = true; }
      }
      p.life -= dt;
      if (gone || p.life <= 0) pulses.splice(pulses.indexOf(p), 1);
    }
  }

  // Q: five homing micro-missiles
  function castMissiles() {
    if (!player.suit || cd.missile > 0) return;
    cd.missile = 6;
    for (let i = 0; i < 6; i++) missiles.push({ x: 0, y: 0, ang: player.aim + (i - 2.5) * 0.25, speed: 480, life: 2.4, delay: i * 0.07, live: false });
    sfx.missile();
  }

  function updateMissiles(dt) {
    for (const m of missiles.slice()) {
      if (!m.live) {
        m.delay -= dt;
        if (m.delay > 0) continue;
        m.live = true; m.x = player.x + Math.cos(m.ang) * 18; m.y = player.y + Math.sin(m.ang) * 18;
      }
      let tgt = null, bd = 700;
      for (const e of enemies) { const d = Math.hypot(e.x - m.x, e.y - m.y); if (d < bd) { bd = d; tgt = e; } }
      if (tgt) {
        const diff = wrap(Math.atan2(tgt.y - m.y, tgt.x - m.x) - m.ang);
        m.ang += clamp(diff, -7 * dt, 7 * dt);
      }
      m.speed = Math.min(720, m.speed + 500 * dt);
      m.x += Math.cos(m.ang) * m.speed * dt; m.y += Math.sin(m.ang) * m.speed * dt; m.life -= dt;
      particles.push({ x: m.x, y: m.y, vx: 0, vy: 0, life: 0.3, max: 0.3, color: '#ffb36b', size: 3 });
      let boom = m.life <= 0 || m.x < A.x || m.x > A.x + A.w || m.y < A.y || m.y > A.y + A.h;
      if (!boom) for (const e of enemies) { if (Math.hypot(e.x - m.x, e.y - m.y) < e.r + 8) { boom = true; break; } }
      if (boom) { missiles.splice(missiles.indexOf(m), 1); explodeAt(clamp(m.x, A.x, A.x + A.w), clamp(m.y, A.y, A.y + A.h), 60, 2.5, '#ffb36b'); }
    }
  }

  // E: energy shield bubble
  function castBubble() {
    if (!player.suit || cd.bubble > 0) return;
    cd.bubble = 10; player.bubble = 4; player.bubbleTick = 0;
    ring(player.x, player.y, 60, C.bolt); burst(player.x, player.y, 18, C.bolt, 220, 0.5);
    sfx.cloak();
  }

  // R: unibeam, a heavy chest laser that slowly follows your aim
  function castUnibeam() {
    if (!player.suit || cd.unibeam > 0 || ubeam) return;
    cd.unibeam = 10; ubeam = { t: 1.4, tick: 0, ang: player.aim };
    sfx.laser();
  }

  function ubeamLine() {
    const e = rayEnd(player.x, player.y, ubeam.ang);
    return { x1: player.x, y1: player.y, x2: e.x, y2: e.y };
  }

  function updateUbeam(dt) {
    ubeam.t -= dt; ubeam.tick -= dt; addShake(4);
    ubeam.ang += clamp(wrap(player.aim - ubeam.ang), -2.6 * dt, 2.6 * dt);
    if (ubeam.tick <= 0) {
      ubeam.tick = 0.14;
      const L = ubeamLine();
      for (const e of enemies.slice()) {
        if (segDist(e.x, e.y, L.x1, L.y1, L.x2, L.y2) < e.r + 16) {
          burst(e.x, e.y, 6, C.bolt, 220, 0.3);
          knock(e, Math.cos(ubeam.ang) * 140, Math.sin(ubeam.ang) * 140, 0.2);
          damage(e, 2);
        }
      }
      for (const b of ebolts.slice()) {
        if (!b.friendly && segDist(b.x, b.y, L.x1, L.y1, L.x2, L.y2) < 16) ebolts.splice(ebolts.indexOf(b), 1);
      }
    }
    if (ubeam.t <= 0) ubeam = null;
  }

  // T: cluster grenade. Explodes, then five bomblets go off.
  function castBomb() {
    if (!player.suit || cd.bomb > 0) return;
    cd.bomb = 7;
    const dx = mouse.x - player.x, dy = mouse.y - player.y, d = Math.hypot(dx, dy) || 1, reach = Math.min(d, 480);
    bombs.push({
      stage: 'fly', x: player.x, y: player.y, sx: player.x, sy: player.y, t: 0, dur: 0.5,
      tx: clamp(player.x + dx / d * reach, A.x + 20, A.x + A.w - 20), ty: clamp(player.y + dy / d * reach, A.y + 20, A.y + A.h - 20)
    });
    sfx.throw();
  }

  // F: unsuit. The armor bursts apart and fights as drones. Press again to re-suit.
  function toggleSuit() {
    if (player.suit) {
      if (cd.unsuit > 0) return;
      cd.unsuit = 8; player.suit = false; player.bubble = 0; ubeam = null; player.unsuitT = 0; player.resuitT = 0;
      plates = [];
      for (let i = 0; i < 8; i++) {
        const a = i / 8 * Math.PI * 2;
        plates.push({ x: player.x, y: player.y, vx: Math.cos(a) * 700, vy: Math.sin(a) * 700, mode: 'spread', t: 0.35, rot: Math.random() * 6, orb: a, hit: new Set(), cdm: new Map() });
      }
      ring(player.x, player.y, 120, '#e0b83c'); burst(player.x, player.y, 30, '#e0b83c', 380, 0.7);
      addShake(8); flash = 0.15; sfx.unsuit();
    } else if (plates.length) {
      for (const p of plates) p.mode = 'return';
      player.resuitT = 2.5; sfx.recall();
    }
  }

  function updatePlates(dt) {
    if (!player.suit) {
      player.unsuitT += dt;
      if (player.unsuitT > 9 && player.resuitT <= 0) { for (const p of plates) p.mode = 'return'; player.resuitT = 2.5; sfx.recall(); }
      if (player.resuitT > 0) {
        player.resuitT -= dt;
        if (player.resuitT <= 0) plates = [];                  // safety: force the armor home
      }
    }
    for (const p of plates.slice()) {
      p.rot += 14 * dt;
      if (p.mode === 'spread') {
        p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.93; p.vy *= 0.93; p.t -= dt;
        p.x = clamp(p.x, A.x + 8, A.x + A.w - 8); p.y = clamp(p.y, A.y + 8, A.y + A.h - 8);
        for (const e of enemies.slice()) {
          if (p.hit.has(e)) continue;
          if (Math.hypot(e.x - p.x, e.y - p.y) < e.r + 10) {
            p.hit.add(e); sfx.hit(); addShake(3);
            knock(e, p.vx * 0.5, p.vy * 0.5, 0.4);
            damage(e, 2.5);
          }
        }
        if (p.t <= 0) p.mode = 'seek';
      } else {
        let tx, ty, sp;
        if (p.mode === 'return') { tx = player.x; ty = player.y; sp = 1000; }
        else {
          let tgt = null, bd = 700;
          for (const e of enemies) { const d = Math.hypot(e.x - p.x, e.y - p.y); if (d < bd) { bd = d; tgt = e; } }
          if (tgt) { tx = tgt.x; ty = tgt.y; } else { tx = player.x + Math.cos(p.orb + time * 1.5) * 75; ty = player.y + Math.sin(p.orb + time * 1.5) * 75; }
          sp = 420;
        }
        const dx = tx - p.x, dy = ty - p.y, d = Math.hypot(dx, dy) || 1;
        p.x += dx / d * sp * dt; p.y += dy / d * sp * dt;
        for (const e of enemies.slice()) {
          if (Math.hypot(e.x - p.x, e.y - p.y) < e.r + 10 && !((p.cdm.get(e) || 0) > time)) {
            p.cdm.set(e, time + 0.35);
            sfx.hit(); burst(e.x, e.y, 5, '#e0b83c', 200, 0.3);
            knock(e, dx / d * 220, dy / d * 220, 0.25);
            damage(e, 1.5);
          }
        }
        if (p.mode === 'return' && Math.hypot(player.x - p.x, player.y - p.y) < 24) plates.splice(plates.indexOf(p), 1);
      }
      if (Math.random() < 0.5) particles.push({ x: p.x, y: p.y, vx: 0, vy: 0, life: 0.2, max: 0.2, color: '#e0b83c', size: 2.5 });
    }
    if (!player.suit && plates.length === 0 && player.resuitT <= 0 && player.unsuitT > 0.5) {
      player.suit = true; player.unsuitT = 0;
      ring(player.x, player.y, 90, C.bolt); burst(player.x, player.y, 24, C.bolt, 260, 0.5);
      addShake(5); sfx.catch();
    }
  }

  // Iron Man, right click: palm blast. Short-range cone that launches enemies and shoves you back.
  function castPalm() {
    if (!player.suit || cd.palm > 0) return;
    cd.palm = 3.5; player.palmT = 0.18;
    const c = Math.cos(player.aim), sn = Math.sin(player.aim);
    for (const e of enemies.slice()) {
      const d = dist(e, player);
      if (d < 250 + e.r && Math.abs(wrap(Math.atan2(e.y - player.y, e.x - player.x) - player.aim)) < 0.55) {
        knock(e, (e.x - player.x) / (d || 1) * 750, (e.y - player.y) / (d || 1) * 750, 0.6);
        burst(e.x, e.y, 6, C.bolt, 240, 0.3); damage(e, 3);
      }
    }
    killBoltsNear(player.x + c * 110, player.y + sn * 110, 130);
    player.kx -= c * 350; player.ky -= sn * 350;                    // recoil
    ring(player.x + c * 80, player.y + sn * 80, 100, C.bolt); burst(player.x + c * 60, player.y + sn * 60, 14, C.bolt, 320, 0.4);
    addShake(6); hitstop = Math.max(hitstop, 0.03); sfx.boom();
  }

  // ============ HULKBUSTER MODE (H) ============
  // Veronica drops the Hulkbuster on him. While it is on he is huge and slower, with three layers of armour, and his kit changes:
  // click punches, right click throws an arm, Q drill, E sonic, F smash. H takes it off again.
  let hbArm = null, hbDrill = null, hbFx = [];
  const HB_GOLD = '#e0b83c';
  const hbAng = (a, b) => ((b - a + Math.PI * 3) % (Math.PI * 2)) - Math.PI;

  function toggleHulkbuster() {
    if (player.hb) { exitHB(false); return; }
    if (cd.hb_toggle > 0 || !player.suit || player.hbDrop > 0 || ubeam) return;
    player.hb = true; player.hbDrop = 0.8; player.hbCharges = 3; player.hbChargeT = 0;
    hbFx.push({ k: 'drop', t: 0 }); sfx.throw();
  }
  function exitHB(broken) {
    player.hb = false; player.hbDrop = 0; hbArm = null; hbDrill = null; cd.hb_toggle = broken ? 25 : 10;
    ring(player.x, player.y, broken ? 120 : 80, HB_GOLD); burst(player.x, player.y, broken ? 30 : 16, HB_GOLD, 300, 0.6);
    if (broken) { addShake(8); player.inv = Math.max(player.inv, 1); }
    sfx.block();
  }
  function landHB() {                                                 // the suit lands on him: a shockwave
    const R = 140;
    for (const e of enemies.slice()) { const d = dist(e, player); if (d < R + e.r) { knock(e, (e.x - player.x) / (d || 1) * 700, (e.y - player.y) / (d || 1) * 700, 1.0); damage(e, 1.5); } }
    killBoltsNear(player.x, player.y, R); ring(player.x, player.y, R, '#ffffff'); ring(player.x, player.y, R * 0.6, HB_GOLD);
    burst(player.x, player.y, 28, '#ffffff', 340, 0.6); addShake(14); hitstop = 0.08; sfx.slam();
  }
  function hbPunch() {                                                // click: a heavy punch
    if (cd.hb_punch > 0 || player.hbDrop > 0 || hbDrill) return;
    cd.hb_punch = 0.5;
    for (const e of enemies.slice()) {
      const dx = e.x - player.x, dy = e.y - player.y, d = Math.hypot(dx, dy) || 1;
      if (d < 120 + e.r && Math.abs(hbAng(player.aim, Math.atan2(dy, dx))) < 0.95) { knock(e, dx / d * 560, dy / d * 560, 0.4); damage(e, 2.2); burst(e.x, e.y, 8, HB_GOLD, 260, 0.35); }
    }
    player.kx += Math.cos(player.aim) * 240; player.ky += Math.sin(player.aim) * 240;
    hbFx.push({ k: 'punch', t: 0, a: player.aim }); sfx.hit(); addShake(4);
  }
  function hbThrowArm() {                                             // right click: throw the arm. It flies out, then comes back.
    if (hbArm || cd.hb_arm > 0 || player.hbDrop > 0) return;
    hbArm = { x: player.x + Math.cos(player.aim) * 30, y: player.y + Math.sin(player.aim) * 30, ang: player.aim, back: false, d: 0, hit: new Set() };
    sfx.throw();
  }
  function updateArm(dt) {
    const arm = hbArm;
    if (!arm.back) {
      const step = 950 * dt; arm.x += Math.cos(arm.ang) * step; arm.y += Math.sin(arm.ang) * step; arm.d += step;
      if (arm.d >= 520 || arm.x < A.x || arm.x > A.x + A.w || arm.y < A.y || arm.y > A.y + A.h) { arm.back = true; arm.hit = new Set(); ring(arm.x, arm.y, 50, HB_GOLD); addShake(3); }
    } else {
      const dx = player.x - arm.x, dy = player.y - arm.y, d = Math.hypot(dx, dy) || 1, step = Math.min(1150 * dt, d);
      arm.ang = Math.atan2(dy, dx); arm.x += dx / d * step; arm.y += dy / d * step;
      if (d < player.r + 24) { hbArm = null; cd.hb_arm = 2.5; sfx.catch(); return; }
    }
    for (const e of enemies.slice()) {
      if (arm.hit.has(e) || dist(e, arm) >= e.r + 22) continue;
      arm.hit.add(e); knock(e, Math.cos(arm.ang) * 520, Math.sin(arm.ang) * 520, 0.5); damage(e, 2.5);
      burst(e.x, e.y, 8, HB_GOLD, 260, 0.35); sfx.hit(); hitstop = Math.max(hitstop, 0.03);
    }
  }
  function hbStartDrill() {                                           // Q: bore forward, chewing up everything in front
    if (hbDrill || cd.hb_drill > 0 || player.hbDrop > 0) return;
    cd.hb_drill = 8; hbDrill = { t: 0, dur: 1.8, tick: 0, n: 0 }; sfx.zap();
  }
  function updateDrill(dt) {
    const D = hbDrill; D.t += dt; D.tick -= dt;
    player.kx = Math.cos(player.aim) * 200; player.ky = Math.sin(player.aim) * 200;
    if (D.tick <= 0) {
      D.tick = 0.12; D.n++;
      for (const e of enemies.slice()) {
        const dx = e.x - player.x, dy = e.y - player.y, d = Math.hypot(dx, dy) || 1;
        if (d < 118 + e.r && Math.abs(hbAng(player.aim, Math.atan2(dy, dx))) < 0.5) { damage(e, 0.9); knock(e, Math.cos(player.aim) * 90, Math.sin(player.aim) * 90, 0.2); burst(e.x, e.y, 3, '#ffd9a0', 220, 0.2); }
      }
      addShake(2); if (D.n % 2) sfx.hit();
    }
    if (D.t >= D.dur) hbDrill = null;
  }
  function hbSonic() {                                                // E: a sonic blast that stuns everything near
    if (cd.hb_sonic > 0 || player.hbDrop > 0) return;
    cd.hb_sonic = 9;
    for (const e of enemies.slice()) {
      const dx = e.x - player.x, dy = e.y - player.y, d = Math.hypot(dx, dy) || 1;
      if (d < 270 + e.r) { knock(e, dx / d * 420, dy / d * 420, 2.2); damage(e, 1); }
    }
    killBoltsNear(player.x, player.y, 270); hbFx.push({ k: 'sonic', t: 0 }); addShake(8); flash = 0.1; sfx.shock();
  }
  function hbSmash() {                                                // F: leap and smash the ground, like the Hulk
    if (cd.hb_smash > 0 || player.leap || player.hbDrop > 0 || hbDrill) return;
    cd.hb_smash = 12;
    const dx = mouse.x - player.x, dy = mouse.y - player.y, d = Math.hypot(dx, dy) || 1, reach = Math.min(d, 340);
    player.leap = { t: 0, dur: 0.55, sx: player.x, sy: player.y, tx: clamp(player.x + dx / d * reach, A.x + player.r, A.x + A.w - player.r), ty: clamp(player.y + dy / d * reach, A.y + player.r, A.y + A.h - player.r),
                    rad: 165, dmg: 4, heavy: true, onHit: e => { e.stun = Math.max(e.stun, 1.2); } };
    sfx.throw();
  }
  function hbKey(code) { if (code === 'KeyQ') hbStartDrill(); if (code === 'KeyE') hbSonic(); if (code === 'KeyF') hbSmash(); }
  function hbMouse(button) { if (button === 2) hbThrowArm(); else { mouse.down = true; hbPunch(); } }
  function updateHB(dt) {
    for (const f of hbFx) f.t += dt;
    hbFx = hbFx.filter(f => f.t < (f.k === 'punch' ? 0.2 : f.k === 'sonic' ? 0.6 : 0.8));
    if (player.hbDrop > 0) { player.hbDrop -= dt; player.inv = Math.max(player.inv, 0.3); if (player.hbDrop <= 0) { player.hbDrop = 0; landHB(); } }
    if (!player.hb) return;
    if (player.hbCharges < 3) { player.hbChargeT -= dt; if (player.hbChargeT <= 0) { player.hbCharges++; player.hbChargeT = 7; ring(player.x, player.y, 60, HB_GOLD); } }
    if (hbArm) updateArm(dt);
    if (hbDrill) updateDrill(dt);
  }
  function drawHulkbuster(px, py, alpha) {
    const r = player.r * 1.55, k = player.hbDrop > 0 ? player.hbDrop / 0.8 : 0, a = player.aim, c = Math.cos(a), sn = Math.sin(a);
    ctx.save(); ctx.globalAlpha = alpha;
    ctx.fillStyle = 'rgba(0,0,0,' + (0.15 + 0.2 * (1 - k)) + ')'; ctx.beginPath(); ctx.ellipse(px, py + r * 0.8, r * (0.6 + 0.5 * (1 - k)), r * 0.35, 0, 0, 7); ctx.fill();   // the shadow grows as it falls
    ctx.translate(px, py - k * 260);
    for (const s of [-1, 1]) {                                                              // shoulders
      ctx.fillStyle = look.cape; ctx.strokeStyle = HB_GOLD; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(-sn * s * r * 0.95, c * s * r * 0.95, r * 0.5, 0, 7); ctx.fill(); ctx.stroke();
    }
    ctx.fillStyle = look.cape; ctx.beginPath(); ctx.arc(0, 0, r, 0, 7); ctx.fill(); ctx.strokeStyle = HB_GOLD; ctx.lineWidth = 4; ctx.stroke();
    ctx.save(); ctx.shadowColor = C.bolt; ctx.shadowBlur = 14; ctx.fillStyle = C.bolt; ctx.beginPath(); ctx.arc(-c * r * 0.2, -sn * r * 0.2, r * 0.16, 0, 7); ctx.fill(); ctx.restore();   // arc reactor
    for (const s of [-1, 1]) {                                                              // fists out front (the right one is missing while the arm is thrown)
      if (s === 1 && hbArm) continue;
      ctx.fillStyle = look.cape; ctx.strokeStyle = HB_GOLD; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(c * r * 1.15 - sn * s * r * 0.8, sn * r * 1.15 + c * s * r * 0.8, r * 0.38, 0, 7); ctx.fill(); ctx.stroke();
    }
    ctx.fillStyle = HB_GOLD; ctx.beginPath(); ctx.arc(c * r * 0.3, sn * r * 0.3, r * 0.34, 0, 7); ctx.fill();   // helmet
    ctx.fillStyle = C.bolt; ctx.save(); ctx.translate(c * r * 0.3, sn * r * 0.3); ctx.rotate(a); ctx.fillRect(r * 0.12, -r * 0.2, 3, 2.4); ctx.fillRect(r * 0.12, r * 0.12, 3, 2.4); ctx.restore();
    ctx.restore();
  }
  function drawHB() {
    for (const f of hbFx) {
      if (f.k === 'punch') {
        const k = f.t / 0.2; ctx.save(); ctx.globalAlpha = 1 - k; ctx.strokeStyle = HB_GOLD; ctx.shadowColor = HB_GOLD; ctx.shadowBlur = 12; ctx.lineWidth = 10; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.arc(player.x, player.y, 70 + 45 * k, f.a - 0.9, f.a + 0.9); ctx.stroke(); ctx.restore();
      } else if (f.k === 'sonic') {
        ctx.save(); ctx.strokeStyle = '#ffffff'; ctx.shadowColor = C.bolt; ctx.shadowBlur = 10;
        for (let i = 0; i < 3; i++) { const rr = f.t * 700 - i * 70; if (rr > 0 && rr < 290) { ctx.globalAlpha = 1 - rr / 290; ctx.lineWidth = 6 - i * 1.5; ctx.beginPath(); ctx.arc(player.x, player.y, rr, 0, 7); ctx.stroke(); } }
        ctx.restore();
      }
    }
    if (hbArm) {
      ctx.save(); ctx.strokeStyle = 'rgba(224,184,60,0.5)'; ctx.lineWidth = 3; ctx.setLineDash([6, 5]); ctx.beginPath(); ctx.moveTo(player.x, player.y); ctx.lineTo(hbArm.x, hbArm.y); ctx.stroke(); ctx.setLineDash([]);
      ctx.translate(hbArm.x, hbArm.y); ctx.rotate(hbArm.ang); ctx.shadowColor = HB_GOLD; ctx.shadowBlur = 14; ctx.fillStyle = look.cape; ctx.strokeStyle = HB_GOLD; ctx.lineWidth = 3;
      ctx.fillRect(-18, -9, 22, 18); ctx.strokeRect(-18, -9, 22, 18); ctx.beginPath(); ctx.arc(8, 0, 13, 0, 7); ctx.fill(); ctx.stroke(); ctx.restore();
    }
    if (hbDrill) {
      const r = player.r * 1.55, bx = player.x + Math.cos(player.aim) * r * 1.2, by = player.y + Math.sin(player.aim) * r * 1.2;
      ctx.save(); ctx.translate(bx, by); ctx.rotate(player.aim); ctx.shadowColor = '#ffd9a0'; ctx.shadowBlur = 12; ctx.fillStyle = '#c9d0d8'; ctx.strokeStyle = '#6b7480'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(0, -17); ctx.lineTo(62, 0); ctx.lineTo(0, 17); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = '#6b7480'; ctx.lineWidth = 3; for (let i = 0; i < 4; i++) { const u = ((time * 6 + i * 0.25) % 1); ctx.beginPath(); ctx.moveTo(u * 46, -15 * (1 - u)); ctx.lineTo(u * 46 + 8, 15 * (1 - u)); ctx.stroke(); }
      ctx.restore();
    }
  }

  registerHero({
    id: 'iron', name: 'Iron Man', team: 'avengers', order: 3, modern: true,
    blurb: 'Armored genius. Lasers, flight boost, missiles, drone armor.',
    look: {
      capeLab: 'Armor', cape: '#c93a3a', fx: '#a8ecff', hair: '#3a2a22',
      gears: ['Faceplate', 'Open helm', 'Reactor only'],
      help: '<b>Hold click</b> fires a piercing repulsor laser. <b>Right click</b> is a palm blast that launches nearby enemies and shoves you back. <b>Hold Shift or Space</b> to boost (uses energy, and ramming enemies hurts them). <b>Q</b> missile barrage, <b>E</b> energy shield that also shocks nearby enemies, <b>F</b> unsuit: your armor bursts apart and fights as drones, press again to re-suit. <b>R</b> unibeam, <b>T</b> cluster grenade. Your armor plating soaks one hit, then recharges. WASD to move, mouse to aim, <b>P</b> to pause.',
      keys: ['Hold click: repulsor laser     Right click: palm blast     Hold Shift / Space: boost', 'Q missiles     E energy shield     F unsuit / re-suit', 'R unibeam     T cluster grenade']
    },
    cd: { repulsor: 0, missile: 0, bubble: 0, unsuit: 0, unibeam: 0, bomb: 0, palm: 0, hb_toggle: 0, hb_punch: 0, hb_arm: 0, hb_drill: 0, hb_sonic: 0, hb_smash: 0 },
    init: () => ({ suit: true, boostE: 100, boostLock: false, bubble: 0, bubbleTick: 0, resuitT: 0, unsuitT: 0, shellReady: true, shellT: 0, palmT: 0, hb: false, hbDrop: 0, hbCharges: 3, hbChargeT: 0 }),
    reset() {
      plates = []; missiles = []; pulses = []; ubeam = null; hbArm = null; hbDrill = null; hbFx = [];
    },
    onKey(code, e) {
      if (code === 'KeyH') { toggleHulkbuster(); return; }                 // Hulkbuster on / off
      if (player.hb) { hbKey(code); return; }                               // in the Hulkbuster the keys are its own skills
      if (code === 'KeyQ') castMissiles();
      if (code === 'KeyE') castBubble();
      if (code === 'KeyF') toggleSuit();
      if (code === 'KeyR') castUnibeam();
      if (code === 'KeyT') castBomb();
    },
    onMouse(button) {
      if (player.hb) { hbMouse(button); return; }
      if (button === 2) castPalm(); else { mouse.down = true; fireRepulsor(); }
    },
    preMove(dt) {
      if (player.bubble > 0) player.bubble = Math.max(0, player.bubble - dt);
      // Iron Man's booster: hold Shift or Space, uses energy
      let boosting = false;
      {
        const want = keys.has('Space') || keys.has('ShiftLeft') || keys.has('ShiftRight');
        boosting = player.suit && !player.hb && want && !player.boostLock && player.boostE > 0 && !ubeam;
        if (boosting) {
          player.boostE = Math.max(0, player.boostE - 40 * dt);
          if (player.boostE <= 0) player.boostLock = true;
          particles.push({ x: player.x - Math.cos(player.aim) * 12, y: player.y - Math.sin(player.aim) * 12, vx: (Math.random() - 0.5) * 60, vy: (Math.random() - 0.5) * 60, life: 0.3, max: 0.3, color: Math.random() < 0.5 ? '#ffb36b' : '#ffffff', size: 3 + Math.random() * 2 });
        } else {
          player.boostE = Math.min(100, player.boostE + (want ? 8 : 24) * dt);
          if (player.boostLock && player.boostE >= 25) player.boostLock = false;
        }
      }

      if (boosting) {                                                 // boost ram: shove and hurt whatever you fly through
        for (const e of enemies.slice()) {
          if ((e.ramT || 0) <= time && dist(e, player) < e.r + player.r + 8) {
            e.ramT = time + 0.4;
            const d = dist(e, player) || 1;
            knock(e, (e.x - player.x) / d * 480, (e.y - player.y) / d * 480, 0.4);
            burst(e.x, e.y, 6, '#ffb36b', 240, 0.3); sfx.hit(); damage(e, 1.5);
          }
        }
      }
      if (!player.shellReady) {                      // armor plating recharges
        player.shellT -= dt;
        if (player.shellT <= 0) { player.shellReady = true; ring(player.x, player.y, 50, '#e0b83c'); }
      }
      if (player.bubble > 0) {                                        // the energy shield shocks anything close
        player.bubbleTick -= dt;
        if (player.bubbleTick <= 0) {
          player.bubbleTick = 0.5;
          for (const e of enemies.slice()) {
            if (dist(e, player) < e.r + player.r + 38) {
              const d = dist(e, player) || 1;
              knock(e, (e.x - player.x) / d * 300, (e.y - player.y) / d * 300, 0.3);
              burst(e.x, e.y, 5, C.bolt, 200, 0.25); damage(e, 1);
            }
          }
        }
      }
      return { boosting, fly: boosting, noSlip: boosting };
    },
    speed(mv) { if (player.hb) return (player.hbDrop > 0 ? 40 : hbDrill ? 130 : 205); return !player.suit ? 310 : (mv.boosting ? 470 : 250) * (ubeam ? 0.55 : 1); },
    update(dt) {
      if (mouse.down) { if (player.hb) hbPunch(); else fireRepulsor(); }
      updateHB(dt);
      updatePulses(dt); updateMissiles(dt); updateBombs(dt); updatePlates(dt);
      if (player.palmT > 0) player.palmT -= dt;
      if (ubeam) updateUbeam(dt);
    },
    onHurt(h) {
      if (player.hb) {                                                  // the Hulkbuster takes the hit: three layers, then it breaks
        if (player.hbDrop > 0) return true;
        player.hbCharges--; player.hbChargeT = 7; player.inv = 0.7; addShake(6);
        ring(player.x, player.y, 70, HB_GOLD); burst(player.x, player.y, 16, HB_GOLD, 260, 0.4); sfx.block();
        if (player.hbCharges <= 0) exitHB(true);
        return true;
      }
      if (player.bubble > 0) {                                          // energy shield
        if (h.src) { const d = dist(h.src, player) || 1; knock(h.src, (h.src.x - player.x) / d * 420, (h.src.y - player.y) / d * 420, 0.3); }
        ring(player.x, player.y, 46, C.bolt); sfx.block(); player.inv = 0.15;
        return true;
      }
      if (player.suit && player.shellReady) {                           // armour plating soaks one hit, then recharges
        player.shellReady = false; player.shellT = 12; player.inv = 0.6;
        ring(player.x, player.y, 60, '#e0b83c'); burst(player.x, player.y, 14, '#e0b83c', 240, 0.4);
        sfx.block(); addShake(5);
        return true;
      }
      return false;
    },
    onBolt(b) {
      if (player.bubble > 0 && Math.hypot(player.x - b.x, player.y - b.y) < player.r + 34) {
        burst(b.x, b.y, 8, C.bolt, 200, 0.3); sfx.block();
        return 'gone';
      }
      return null;
    },
    hudBars() {
      ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.fillRect(48, 46, 140, 6);
      ctx.fillStyle = player.boostLock ? 'rgba(255,120,80,0.8)' : '#ffb36b';
      ctx.fillRect(48, 46, 140 * player.boostE / 100, 6);
      ctx.font = '11px "Palatino Linotype", Palatino, Georgia, serif'; ctx.textAlign = 'left';
      ctx.fillStyle = 'rgba(231,238,244,0.6)'; ctx.fillText('BOOST', 194, 49);
      ctx.fillText('PLATING', 244, 49);
      ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.fillRect(292, 46, 46, 6);
      ctx.fillStyle = player.shellReady ? '#e0b83c' : 'rgba(224,184,60,0.45)';
      ctx.fillRect(292, 46, 46 * (player.shellReady ? 1 : 1 - player.shellT / 12), 6);
      if (player.hb) {
        ctx.fillStyle = 'rgba(231,238,244,0.6)'; ctx.fillText('HULKBUSTER', 622, 49);
        for (let i = 0; i < 3; i++) { ctx.fillStyle = i < player.hbCharges ? HB_GOLD : 'rgba(255,255,255,0.15)'; ctx.fillRect(706 + i * 16, 44, 12, 8); }
      }
      ctx.font = '700 22px "Palatino Linotype", Palatino, Georgia, serif';
    },
    skills() {
      if (player.hb) {
        return [
          { k: 'M1', n: 'Punch', cd: cd.hb_punch, max: 0.5, ok: !hbDrill },
          { k: 'RMB', n: hbArm ? 'Arm out' : 'Throw Arm', cd: hbArm ? 0 : cd.hb_arm, max: 2.5, ok: !hbArm },
          { k: 'Q', n: 'Drill', cd: cd.hb_drill, max: 8, ok: !hbDrill },
          { k: 'E', n: 'Sonic', cd: cd.hb_sonic, max: 9, ok: true },
          { k: 'F', n: 'Smash', cd: cd.hb_smash, max: 12, ok: !player.leap && !hbDrill },
          { k: 'H', n: 'Exit', cd: 0, max: 1, ok: true }
        ];
      }
      return [
        { k: 'M1', n: 'Laser',    cd: cd.repulsor, max: 0.17, ok: player.suit && !ubeam },
        { k: 'RMB', n: 'Palm',    cd: cd.palm,     max: 3.5,  ok: player.suit },
        { k: 'Shift', n: 'Boost', cd: (100 - player.boostE) / 100, max: 1, ok: player.suit && !player.boostLock },
        { k: 'Q', n: 'Missiles',  cd: cd.missile, max: 6,  ok: player.suit },
        { k: 'E', n: 'Shield',    cd: cd.bubble,  max: 10, ok: player.suit },
        { k: 'F', n: player.suit ? 'Unsuit' : 'Re-suit', cd: player.suit ? cd.unsuit : 0, max: 8, ok: player.suit || plates.length > 0 },
        { k: 'R', n: 'Unibeam',   cd: cd.unibeam, max: 10, ok: player.suit && !ubeam },
        { k: 'T', n: 'Grenade',   cd: cd.bomb,    max: 7,  ok: player.suit },
        { k: 'H', n: 'Hulkbuster', cd: cd.hb_toggle, max: 10, ok: player.suit && !ubeam }
      ];
    },
    message() {
      if (player.hb) return player.hbDrop > 0 ? 'Veronica is dropping the Hulkbuster...' : hbDrill ? 'Drilling.' : hbArm ? 'The arm is out.' : 'Hulkbuster: ' + player.hbCharges + ' armour layers. H takes it off.';
      let msg;
      if (!player.suit) msg = 'Unsuited. Armor drones fight for you. F to re-suit.';
      else if (ubeam) msg = 'Unibeam firing.';
      else if (player.bubble > 0) msg = 'Energy shield up ' + player.bubble.toFixed(1) + 's.';
      else msg = 'Hold click to fire, hold Shift or Space to boost.';
      return msg;
    },
    aimLine() { return player.hb ? 240 : player.suit ? 520 : 0; },
    hitRadius() { return player.hb ? player.r * 1.5 : player.r; },
    drawBodyOverride(px, py, alpha) { if (!player.hb) return false; drawHulkbuster(px, py, alpha); return true; },
    drawBefore() {
      // Iron Man armor drones
      for (const p of plates) {
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.shadowColor = '#e0b83c'; ctx.shadowBlur = 10;
        ctx.fillStyle = look.cape; ctx.fillRect(-7, -7, 14, 14);
        ctx.fillStyle = '#e0b83c'; ctx.fillRect(-7, -7, 14, 4); ctx.fillRect(-3, -3, 6, 6);
        ctx.restore();
      }
    },
    preBody() {
      if (player.suit && player.boostE < 100 && keys.size && (keys.has('Space') || keys.has('ShiftLeft') || keys.has('ShiftRight'))) {
        ctx.shadowColor = '#ffb36b'; ctx.shadowBlur = 14;
      }
    },
    charOpts() { return { unsuited: !player.suit }; },
    api: { hb: () => ({ arm: !!hbArm, drill: !!hbDrill, fx: hbFx.length }) },      // exposed for the automated tests
    drawPlayerFx(px, py) {
      if (player.bubble > 0) {                                          // energy shield
        const k = Math.min(1, player.bubble / 0.5);
        ctx.save(); ctx.globalAlpha = 0.3 + 0.5 * k; ctx.shadowColor = C.bolt; ctx.shadowBlur = 16;
        ctx.strokeStyle = C.bolt; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(px, py, player.r + 20 + Math.sin(time * 12) * 1.5, 0, 7); ctx.stroke();
        ctx.fillStyle = fx(0.10); ctx.fill();
        ctx.restore();
      }
      if (player.suit && player.shellReady) {                           // plating ready
        ctx.strokeStyle = 'rgba(224,184,60,0.55)'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(px, py, player.r + 5, 0, 7); ctx.stroke();
      }
      if (player.palmT > 0) {                                           // palm blast cone
        const k = player.palmT / 0.18, rad = 250 * (1 - Math.pow(k, 2.2));      // the blast wave expands outward
        ctx.fillStyle = fx(0.3 * k);
        ctx.beginPath(); ctx.moveTo(px, py); ctx.arc(px, py, rad, player.aim - 0.55, player.aim + 0.55); ctx.closePath(); ctx.fill();
        ctx.save(); ctx.strokeStyle = fx(0.8 * k); ctx.lineWidth = 5; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.arc(px, py, rad, player.aim - 0.55, player.aim + 0.55); ctx.stroke(); ctx.restore();
      }
    },
    drawOver() {
      drawHB();
      for (const p of pulses) {
        const a = Math.atan2(p.vy, p.vx);
        ctx.save(); ctx.shadowColor = C.bolt; ctx.shadowBlur = 14; ctx.lineCap = 'round';
        ctx.strokeStyle = C.bolt; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(p.x - Math.cos(a) * 20, p.y - Math.sin(a) * 20); ctx.lineTo(p.x, p.y); ctx.stroke();
        ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(p.x - Math.cos(a) * 14, p.y - Math.sin(a) * 14); ctx.lineTo(p.x, p.y); ctx.stroke();
        ctx.restore();
      }
      for (const m of missiles) {
        if (!m.live) continue;
        ctx.save(); ctx.translate(m.x, m.y); ctx.rotate(m.ang); ctx.shadowColor = '#ffb36b'; ctx.shadowBlur = 10;
        ctx.fillStyle = '#d9dde2'; ctx.fillRect(-6, -2.5, 12, 5);
        ctx.fillStyle = '#c93a3a'; ctx.beginPath(); ctx.moveTo(6, -2.5); ctx.lineTo(10, 0); ctx.lineTo(6, 2.5); ctx.fill();
        ctx.restore();
      }
      if (ubeam) {
      const Ln = ubeamLine(), a = Math.min(1, ubeam.t / 0.2);
      ctx.save(); ctx.globalAlpha = a; ctx.shadowColor = C.bolt; ctx.shadowBlur = 34; ctx.lineCap = 'round';
      ctx.strokeStyle = fx(0.55); ctx.lineWidth = 30 + Math.random() * 6; ctx.beginPath(); ctx.moveTo(Ln.x1, Ln.y1); ctx.lineTo(Ln.x2, Ln.y2); ctx.stroke();
      ctx.strokeStyle = C.bolt; ctx.lineWidth = 16; ctx.beginPath(); ctx.moveTo(Ln.x1, Ln.y1); ctx.lineTo(Ln.x2, Ln.y2); ctx.stroke();
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 7; ctx.beginPath(); ctx.moveTo(Ln.x1, Ln.y1); ctx.lineTo(Ln.x2, Ln.y2); ctx.stroke();
      ctx.restore();
      }
    },
    bodyRing(g, r, unsuited) {
      if (!unsuited) { g.strokeStyle = '#e0b83c'; g.lineWidth = 2; g.beginPath(); g.arc(0, 0, r + 1, 0, 7); g.stroke(); }
    },
    gear(g, c) {
      const { r, hr, gear, unsuited } = c; const ch = look.char;
      if (!unsuited) {
        if (gear === 0) {                                            // red helmet, gold faceplate, glowing eyes
          g.fillStyle = look.cape; g.beginPath(); g.arc(0, 0, hr + 1, 0, 7); g.fill();
          g.fillStyle = '#e0b83c'; g.beginPath(); g.arc(0, 0, hr + 1, -1.15, 1.15); g.closePath(); g.fill();
          g.fillStyle = C.bolt; g.fillRect(hr * 0.5, -4.5, 3, 2.2); g.fillRect(hr * 0.5, 2.3, 3, 2.2);
        } else if (gear === 1) {                                     // open helm: face showing
          g.fillStyle = look.cape; g.beginPath(); g.arc(0, 0, hr + 1, 0, 7); g.fill();
          g.fillStyle = '#d9c3a0'; g.beginPath(); g.arc(hr * 0.35, 0, hr * 0.5, 0, 7); g.fill();
          g.fillStyle = '#3a2a22'; g.fillRect(hr * 0.75, -1.5, 2.5, 3);
        }
      }
      g.save(); g.shadowColor = C.bolt; g.shadowBlur = 8; g.fillStyle = C.bolt;
      g.beginPath(); g.arc(-r * 0.45, 0, 2.6, 0, 7); g.fill(); g.restore();
      if (unsuited) { g.fillStyle = '#3a2a22'; g.fillRect(hr * 0.75, -1.5, 2.5, 3); }
    },
  });

})();
