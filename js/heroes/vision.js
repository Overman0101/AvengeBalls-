// VISION (Avengers): mind-stone bolts, the thermal emitter (a palm blast that throws enemies back and sets them alight),
// intangibility (he goes translucent and nothing can touch him), a stasis pulse that freezes everything around him,
// and a Mind Stone beam that reaches the whole arena.
//
// Self-contained: everything in this file is private to the hero, except what registerHero() hands to the engine.
(function () {
  const TAU = Math.PI * 2, GOLD = '#ffd94a';
  let bolts = [], beam = null, blast = null, phaseId = 0;

  Object.assign(sfx, {
    thermal: () => { noise(0.3, 0.14, 900); tone(500, 180, 0.3, 'sawtooth', 0.1); },
    phase: () => { tone(300, 900, 0.5, 'sine', 0.12); },
    stasis: () => { tone(1200, 300, 0.7, 'triangle', 0.14); noise(0.3, 0.06, 3000); },
    stone: () => { tone(220, 880, 0.6, 'sawtooth', 0.1); noise(0.4, 0.1, 1200); }
  });
  const segDist = (px, py, x1, y1, x2, y2) => {
    const dx = x2 - x1, dy = y2 - y1, l2 = dx * dx + dy * dy || 1, t = clamp(((px - x1) * dx + (py - y1) * dy) / l2, 0, 1);
    return Math.hypot(px - (x1 + dx * t), py - (y1 + dy * t));
  };
  const angDiff = (a, b) => ((b - a + Math.PI * 3) % TAU) - Math.PI;

  // ---------------- hold click: mind-stone bolts (they pass through up to two enemies) ----------------
  function fireBolt() {
    if (cd.vi_bolt > 0 || beam) return;
    cd.vi_bolt = 0.24;
    bolts.push({ x: player.x + Math.cos(player.aim) * 18, y: player.y + Math.sin(player.aim) * 18, vx: Math.cos(player.aim) * 900, vy: Math.sin(player.aim) * 900, life: 0.9, hit: new Set() });
    sfx.zap();
  }
  function updateBolts(dt) {
    for (const b of bolts.slice()) {
      b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
      particles.push({ x: b.x, y: b.y, vx: 0, vy: 0, life: 0.2, max: 0.2, color: GOLD, size: 4 });
      for (const e of enemies.slice()) {
        if (b.hit.has(e) || Math.hypot(e.x - b.x, e.y - b.y) >= e.r + 6) continue;
        b.hit.add(e); knock(e, b.vx * 0.12, b.vy * 0.12, 0.2); damage(e, 1.3); burst(b.x, b.y, 7, GOLD, 220, 0.3); sfx.hit();
      }
      if (b.life <= 0 || b.hit.size >= 2 || b.x < A.x || b.x > A.x + A.w || b.y < A.y || b.y > A.y + A.h) bolts.splice(bolts.indexOf(b), 1);
    }
  }

  // ---------------- right click: thermal emitter (throws enemies back and burns them) ----------------
  function castThermal() {
    if (cd.vi_thermal > 0 || beam) return;
    cd.vi_thermal = 3.5; blast = { t: 0.2, a: player.aim };
    for (const e of enemies.slice()) {
      const dx = e.x - player.x, dy = e.y - player.y, d = Math.hypot(dx, dy) || 1;
      if (d > 240 + e.r || Math.abs(angDiff(player.aim, Math.atan2(dy, dx))) > 0.62) continue;
      knock(e, dx / d * 720, dy / d * 720, 0.5); e.vburn = time + 2.2; e.vburnTick = 0;      // thrown back, then set alight
      damage(e, 1.6); burst(e.x, e.y, 10, '#ffb36b', 260, 0.4);
    }
    for (const b of ebolts) {                                                               // enemy fire in the cone is thrown back at them
      const dx = b.x - player.x, dy = b.y - player.y;
      if (Math.hypot(dx, dy) < 240 && Math.abs(angDiff(player.aim, Math.atan2(dy, dx))) < 0.62) { b.friendly = true; b.vx = Math.cos(player.aim) * 600; b.vy = Math.sin(player.aim) * 600; }
    }
    addShake(5); sfx.thermal();
  }
  function tickBurns(dt) {
    for (const e of enemies.slice()) {
      if (!(e.vburn > time)) continue;
      e.vburnTick -= dt;
      if (e.vburnTick <= 0) { e.vburnTick = 0.5; burst(e.x, e.y, 4, '#ffb36b', 150, 0.3); damage(e, 0.5); }
    }
  }

  // ---------------- Q: intangibility ----------------
  function castPhase() {
    if (cd.vi_phase > 0 || player.phase > 0) return;
    cd.vi_phase = 14; player.phase = 3.5; phaseId++;
    ring(player.x, player.y, 70, GOLD); burst(player.x, player.y, 14, '#ffffff', 200, 0.5); sfx.phase();
  }
  function updatePhase(dt) {
    if (!(player.phase > 0)) return;
    player.phase -= dt; player.inv = Math.max(player.inv, 0.1);
    for (const e of enemies.slice()) {                                // he passes through enemies; the ones he passes through reel
      if (e.vphase !== phaseId && dist(e, player) < e.r + player.r) {
        e.vphase = phaseId; knock(e, 0, 0, e.boss ? 0.3 : 0.8); damage(e, 1);
        ring(e.x, e.y, 46, GOLD); burst(e.x, e.y, 8, GOLD, 200, 0.3);
      }
    }
    if (player.phase <= 0) { player.phase = 0; ring(player.x, player.y, 60, GOLD); }
  }

  // ---------------- E: stasis pulse ----------------
  function castStasis() {
    if (cd.vi_stasis > 0) return;
    cd.vi_stasis = 12;
    for (const e of enemies.slice()) {
      if (dist(e, player) > 240 + e.r) continue;
      const t = e.boss ? 0.6 : 3; e.kx = 0; e.ky = 0; e.stun = Math.max(e.stun, t); e.vfrozen = time + t; burst(e.x, e.y, 8, '#bfe9ff', 180, 0.4);
    }
    killBoltsNear(player.x, player.y, 240);
    ring(player.x, player.y, 250, '#bfe9ff'); ring(player.x, player.y, 160, '#ffffff'); burst(player.x, player.y, 24, '#bfe9ff', 320, 0.6); flash = 0.12; addShake(4); sfx.stasis();
  }

  // ---------------- R: Mind Stone beam. Across the whole arena. ----------------
  function castBeam() {
    if (cd.vi_beam > 0 || beam) return;
    cd.vi_beam = 14; beam = { t: 0, dur: 1.3, tick: 0 }; sfx.stone();
  }
  function beamLine() {
    const e = rayEnd(player.x, player.y, player.aim);
    return { x1: player.x + Math.cos(player.aim) * 16, y1: player.y + Math.sin(player.aim) * 16, x2: e.x, y2: e.y };
  }
  function updateBeam(dt) {
    beam.t += dt; beam.tick -= dt;
    if (beam.tick <= 0) {
      beam.tick = 0.1; const L = beamLine();
      for (const e of enemies.slice()) {
        if (segDist(e.x, e.y, L.x1, L.y1, L.x2, L.y2) < e.r + 20) { knock(e, Math.cos(player.aim) * 80, Math.sin(player.aim) * 80, 0.25); damage(e, 1.1); burst(e.x, e.y, 4, GOLD, 200, 0.25); }
      }
      addShake(2.5);
    }
    if (beam.t >= beam.dur) beam = null;
  }

  // ---------------- drawing ----------------
  function drawFrozen() {
    for (const e of enemies) {
      if (!(e.vfrozen > time)) continue;
      ctx.save(); ctx.translate(e.x, e.y);
      ctx.fillStyle = 'rgba(190,233,255,0.45)'; ctx.strokeStyle = '#e8f7ff'; ctx.lineWidth = 2; ctx.shadowColor = '#bfe9ff'; ctx.shadowBlur = 10;
      ctx.beginPath(); for (let i = 0; i < 6; i++) { const a = i * TAU / 6 + 0.3, r = e.r + 7; i ? ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r) : ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r); } ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.restore();
    }
  }
  function drawBurning() {
    for (const e of enemies) {
      if (!(e.vburn > time)) continue;
      for (let i = 0; i < 3; i++) { const a = time * 6 + i * 2.1; ctx.fillStyle = 'rgba(255,' + (140 + i * 30) + ',60,0.8)'; ctx.beginPath(); ctx.arc(e.x + Math.cos(a) * e.r * 0.5, e.y - e.r * 0.4 - Math.abs(Math.sin(a * 1.3)) * 8, 3.2 - i * 0.6, 0, 7); ctx.fill(); }
    }
  }
  function gear(g, c) {
    const { hr, gear } = c;
    g.fillStyle = '#b8322a'; g.beginPath(); g.arc(0, 0, hr + 1, 0, 7); g.fill();                              // the red head
    if (gear === 1) { g.fillStyle = look.cape; g.beginPath(); g.arc(-hr * 0.35, 0, hr + 1, Math.PI * 0.5, Math.PI * 1.5); g.closePath(); g.fill(); g.beginPath(); g.moveTo(-hr, -7); g.lineTo(-hr - 9, 0); g.lineTo(-hr, 7); g.closePath(); g.fill(); }
    g.fillStyle = '#e0b83c'; g.beginPath(); g.arc(hr * 0.1, 0, hr * 0.28, -1.2, 1.2); g.fill();            // gold crest
    if (gear !== 2) { g.save(); g.shadowColor = GOLD; g.shadowBlur = 10; g.fillStyle = GOLD; g.beginPath(); g.arc(hr * 0.5, 0, 3.4, 0, 7); g.fill(); g.restore(); }   // the Mind Stone
    g.fillStyle = '#ffffff'; g.fillRect(hr * 0.55, -5.5, 2.6, 2); g.fillRect(hr * 0.55, 3.5, 2.6, 2);
  }

  registerHero({
    id: 'vision', name: 'Vision', team: 'avengers', order: 11, modern: true,
    blurb: 'Born of Ultron, carrying the Mind Stone. Intangible, with a beam that crosses the whole arena.',
    look: {
      capeLab: 'Cape', cape: '#2e8b57', fx: '#ffd94a', hair: '#7a2a22',
      gears: ['Mind Stone', 'Cowl', 'Plain'],
      help: '<b>Hold click</b> fires mind-stone bolts that pass through two enemies. <b>Right click</b> the thermal emitter: a palm blast that throws enemies back, sets them alight and turns enemy fire around. <b>Q</b> intangibility: you turn translucent, nothing can touch you, and the enemies you pass through reel. <b>E</b> stasis pulse: everything around you freezes. <b>R</b> Mind Stone beam: a piercing beam that reaches across the whole arena.',
      keys: ['Hold click: mind bolts     Right click: thermal emitter', 'Q intangibility     E stasis pulse', 'R Mind Stone beam (whole arena)']
    },
    cd: { vi_bolt: 0, vi_thermal: 0, vi_phase: 0, vi_stasis: 0, vi_beam: 0 },
    init: () => ({ phase: 0 }),
    reset() { bolts = []; beam = null; blast = null; },
    onKey(code) {
      if (code === 'KeyQ') castPhase();
      if (code === 'KeyE') castStasis();
      if (code === 'KeyR') castBeam();
    },
    onMouse(button) { if (button === 2) castThermal(); else { mouse.down = true; fireBolt(); } },
    speed() { return (beam ? 90 : player.phase > 0 ? 305 : 255); },
    update(dt) {
      if (mouse.down) fireBolt();
      updateBolts(dt); updatePhase(dt); tickBurns(dt);
      if (beam) updateBeam(dt);
      if (blast) { blast.t -= dt; if (blast.t <= 0) blast = null; }
    },
    onHurt() { return player.phase > 0; },                               // nothing can touch him while he is intangible
    skills() {
      return [
        { k: 'M1', n: 'Mind Bolt', cd: cd.vi_bolt, max: 0.24, ok: !beam },
        { k: 'M2', n: 'Thermal', cd: cd.vi_thermal, max: 3.5, ok: !beam },
        { k: 'Q', n: player.phase > 0 ? 'Phased' : 'Intangible', cd: cd.vi_phase, max: 14, ok: player.phase <= 0 },
        { k: 'E', n: 'Stasis', cd: cd.vi_stasis, max: 12, ok: true },
        { k: 'R', n: 'Mind Stone', cd: cd.vi_beam, max: 14, ok: !beam }
      ];
    },
    message() {
      if (beam) return 'The Mind Stone burns.';
      if (player.phase > 0) return 'Intangible ' + player.phase.toFixed(1) + 's. Nothing can touch you.';
      return 'Hold click for mind bolts. Right click throws enemies back.';
    },
    aimLine() { return beam ? 0 : 320; },
    drawBodyOverride(px, py, alpha) {                                    // translucent while intangible
      if (!(player.phase > 0)) return false;
      const flicker = 0.3 + 0.08 * Math.sin(time * 18);
      ctx.save(); ctx.shadowColor = GOLD; ctx.shadowBlur = 16;
      drawChar(ctx, px, py, player.r, player.aim, alpha * flicker, null);
      ctx.restore();
      ctx.strokeStyle = 'rgba(255,217,74,0.55)'; ctx.lineWidth = 2; ctx.setLineDash([4, 5]); ctx.beginPath(); ctx.arc(px, py, player.r + 6, 0, 7); ctx.stroke(); ctx.setLineDash([]);
      return true;
    },
    drawBefore() { drawFrozen(); drawBurning(); },
    drawPlayerFx(px, py) {
      if (blast) {                                                       // the thermal wave
        const k = blast.t / 0.2, rad = 240 * (1 - Math.pow(k, 2.2));
        ctx.fillStyle = 'rgba(255,170,80,' + 0.32 * k + ')';
        ctx.beginPath(); ctx.moveTo(px, py); ctx.arc(px, py, rad, blast.a - 0.62, blast.a + 0.62); ctx.closePath(); ctx.fill();
        ctx.save(); ctx.strokeStyle = 'rgba(255,230,160,' + 0.9 * k + ')'; ctx.lineWidth = 5; ctx.lineCap = 'round'; ctx.beginPath(); ctx.arc(px, py, rad, blast.a - 0.62, blast.a + 0.62); ctx.stroke(); ctx.restore();
      }
    },
    drawOver() {
      for (const b of bolts) {
        const a = Math.atan2(b.vy, b.vx);
        ctx.save(); ctx.shadowColor = GOLD; ctx.shadowBlur = 14; ctx.lineCap = 'round'; ctx.strokeStyle = GOLD; ctx.lineWidth = 5;
        ctx.beginPath(); ctx.moveTo(b.x - Math.cos(a) * 18, b.y - Math.sin(a) * 18); ctx.lineTo(b.x, b.y); ctx.stroke();
        ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(b.x - Math.cos(a) * 11, b.y - Math.sin(a) * 11); ctx.lineTo(b.x, b.y); ctx.stroke(); ctx.restore();
      }
      if (beam) {
        const L = beamLine(), a = Math.min(1, beam.t / 0.15) * Math.min(1, (beam.dur - beam.t) / 0.2 + 0.2);
        ctx.save(); ctx.globalAlpha = a; ctx.shadowColor = GOLD; ctx.shadowBlur = 36; ctx.lineCap = 'round';
        ctx.strokeStyle = 'rgba(255,217,74,0.45)'; ctx.lineWidth = 40 + Math.random() * 8; ctx.beginPath(); ctx.moveTo(L.x1, L.y1); ctx.lineTo(L.x2, L.y2); ctx.stroke();
        ctx.strokeStyle = GOLD; ctx.lineWidth = 20; ctx.beginPath(); ctx.moveTo(L.x1, L.y1); ctx.lineTo(L.x2, L.y2); ctx.stroke();
        ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 8; ctx.beginPath(); ctx.moveTo(L.x1, L.y1); ctx.lineTo(L.x2, L.y2); ctx.stroke(); ctx.restore();
      }
    },
    gear,
    api: { state: () => ({ bolts: bolts.length, beam: !!beam, phase: player.phase }) }     // exposed for the automated tests
  });
})();