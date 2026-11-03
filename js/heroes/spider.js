// SPIDER-MAN: web shots, long-reach swing, stun / exploding / grab-and-throw / electric webs, web strike, dodge and spider sense.

// Self-contained: everything in this file is private to the hero, except what registerHero() hands to the engine.

(function () {

  let webs = [], splats = [];


  function spawnWeb(a, kind, speed) {
    webs.push({ x: player.x + Math.cos(a) * 18, y: player.y + Math.sin(a) * 18, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, kind, life: 1.1 });
    sfx.web();
  }

  // Click (hold): a quick web shot that slows what it hits
  function fireWeb() {
    if (cd.wshot > 0 || player.roll > 0) return;
    cd.wshot = 0.3; spawnWeb(player.aim, 'shot', 1200);
  }

  // Q: web swing. Grapples to the wall (or corner) you aim at, from anywhere in the arena.
  function castWebSwing() {
    if (cd.wswing > 0 || player.roll > 0 || player.grab) return;      // can be re-fired mid-swing to chain swings
    const e = rayEnd(player.x, player.y, player.aim);
    let tx = e.x, ty = e.y;
    for (const c of [[A.x, A.y], [A.x + A.w, A.y], [A.x, A.y + A.h], [A.x + A.w, A.y + A.h]]) {   // snap to a nearby corner
      if (Math.hypot(tx - c[0], ty - c[1]) < 150) { tx = c[0]; ty = c[1]; break; }
    }
    tx = clamp(tx, A.x + player.r, A.x + A.w - player.r); ty = clamp(ty, A.y + player.r, A.y + A.h - player.r);
    if (Math.hypot(tx - player.x, ty - player.y) < 80) return;
    cd.wswing = 0.3;
    player.zip = { tx, ty, hit: new Set(), mom: 650 };
    ring(tx, ty, 40, '#ffffff'); sfx.grapple();
  }

  // E: web stun. One heavy web that pins an enemy for 3 seconds.
  function castWebStun() {
    if (cd.wstun > 0) return;
    cd.wstun = 5; spawnWeb(player.aim, 'stun', 1400);
  }

  // F: exploding web. Bursts into a net that stuns everything around it.
  function castWebBomb() {
    if (cd.wbomb > 0) return;
    cd.wbomb = 8; spawnWeb(player.aim, 'bomb', 900);
  }

  // R: grab web. Yanks an enemy to you, then flings it through the crowd.
  function castWebGrab() {
    if (cd.wthrow > 0 || player.grab) return;
    cd.wthrow = 7; spawnWeb(player.aim, 'grab', 1500);
  }

  // T: electric web. Stuns and keeps shocking, arcing to neighbors.
  function castWebElec() {
    if (cd.welec > 0) return;
    cd.welec = 9; spawnWeb(player.aim, 'elec', 1300);
  }

  function webBurst(x, y) {
    ring(x, y, 110, '#ffffff'); burst(x, y, 20, '#ffffff', 300, 0.5); addShake(4); sfx.web();
    splats.push({ x, y, r: 110, life: 1.5 });
    for (const e of enemies.slice()) {
      if (Math.hypot(e.x - x, e.y - y) < 110 + e.r) { knock(e, 0, 0, 2.2); e.webT = time + 2.2; damage(e, 1); }
    }
    killBoltsNear(x, y, 110);
  }

  function webHit(w, e) {
    if (w.kind === 'shot') {
      burst(e.x, e.y, 4, '#ffffff', 160, 0.25); knock(e, w.vx * 0.05, w.vy * 0.05, 0.6); e.webT = time + 0.6; damage(e, 1);
    } else if (w.kind === 'stun') {
      ring(e.x, e.y, 50, '#ffffff'); burst(e.x, e.y, 10, '#ffffff', 220, 0.4);
      knock(e, 0, 0, 3); e.webT = time + 3; damage(e, 0.5); sfx.web();
    } else if (w.kind === 'bomb') {
      webBurst(w.x, w.y);
    } else if (w.kind === 'grab') {
      if (!player.grab && !e.thr) { player.grab = { e }; e.webT = time + 1; sfx.grapple(); }
    } else if (w.kind === 'elec') {
      ring(e.x, e.y, 60, C.bolt); burst(e.x, e.y, 12, C.bolt, 240, 0.4);
      knock(e, 0, 0, 2.5); e.elec = 2.5; e.elecTick = 0.1; e.webT = time + 2.5; sfx.zap();
    }
  }

  function updateWebs(dt) {
    for (const w of webs.slice()) {
      const total = Math.hypot(w.vx, w.vy) * dt, steps = Math.max(1, Math.ceil(total / 10));
      let gone = false;
      for (let s = 0; s < steps && !gone; s++) {
        w.x += w.vx * dt / steps; w.y += w.vy * dt / steps;
        for (const e of enemies.slice()) {
          if (Math.hypot(e.x - w.x, e.y - w.y) < e.r + 5) { webHit(w, e); gone = true; break; }
        }
        if (!gone && (w.x < A.x || w.x > A.x + A.w || w.y < A.y || w.y > A.y + A.h)) {
          const x = clamp(w.x, A.x, A.x + A.w), y = clamp(w.y, A.y, A.y + A.h);
          if (w.kind === 'bomb') webBurst(x, y); else burst(x, y, 4, '#ffffff', 140, 0.25);
          gone = true;
        }
      }
      w.life -= dt;
      if (!gone && w.life <= 0) { if (w.kind === 'bomb') webBurst(w.x, w.y); gone = true; }
      if (gone) webs.splice(webs.indexOf(w), 1);
    }
  }

  function updateGrab(dt) {
    const e = player.grab.e;
    if (!enemies.includes(e) || e.thr) { player.grab = null; return; }
    const dx = player.x - e.x, dy = player.y - e.y, d = Math.hypot(dx, dy) || 1;
    e.x += dx / d * 1100 * dt; e.y += dy / d * 1100 * dt; e.kx = 0; e.ky = 0; e.stun = Math.max(e.stun, 0.3); e.webT = time + 0.3;
    if (d < e.r + player.r + 14) {                                    // reeled in: fling it where you are aiming
      e.thr = { vx: Math.cos(player.aim) * 1150, vy: Math.sin(player.aim) * 1150, t: 0.9, hit: new Set() };
      e.stun = Math.max(e.stun, 1); player.grab = null;
      sfx.throw(); addShake(6); ring(e.x, e.y, 60, '#ffffff');
    }
  }

  function updateThrown(e, dt) {                                      // a flung enemy plows through the others
    const T = e.thr;
    T.t -= dt; e.kx = 0; e.ky = 0; e.stun = Math.max(e.stun, 0.3); e.webT = time + 0.2;
    const total = Math.hypot(T.vx, T.vy) * dt, steps = Math.max(1, Math.ceil(total / 10));
    for (let s = 0; s < steps; s++) {
      e.x += T.vx * dt / steps; e.y += T.vy * dt / steps;
      for (const o of enemies.slice()) {
        if (o === e || T.hit.has(o) || Math.hypot(o.x - e.x, o.y - e.y) >= e.r + o.r) continue;
        T.hit.add(o); sfx.hit(); addShake(5); hitstop = Math.max(hitstop, 0.04);
        ring(o.x, o.y, 50, '#ffffff'); burst(o.x, o.y, 10, '#ffffff', 240, 0.3);
        knock(o, T.vx * 0.3, T.vy * 0.3, 0.8); damage(o, 2);
        damage(e, 1);
        if (!enemies.includes(e)) return;
      }
      if (e.x < A.x + e.r || e.x > A.x + A.w - e.r || e.y < A.y + e.r || e.y > A.y + A.h - e.r) {   // slam into the wall
        e.x = clamp(e.x, A.x + e.r, A.x + A.w - e.r); e.y = clamp(e.y, A.y + e.r, A.y + A.h - e.r);
        e.thr = null; sfx.slam(); addShake(9); hitstop = 0.07;
        ring(e.x, e.y, 80, C.bolt); burst(e.x, e.y, 18, C.bolt, 300, 0.5);
        knock(e, 0, 0, 1.5);
        for (const o of enemies.slice()) { if (o !== e && Math.hypot(o.x - e.x, o.y - e.y) < 70 + o.r) { knock(o, 0, 0, 0.6); damage(o, 1); } }
        damage(e, 3);
        return;
      }
    }
    if (T.t <= 0) e.thr = null;
  }

  // Spider-Man, right click: web strike. A quick dash that stuns whatever it hits.
  function castWebStrike() {
    if (cd.wstrike > 0 || player.zip || player.roll > 0 || player.wstrike > 0 || player.grab) return;
    cd.wstrike = 3; player.wstrike = 0.2; player.dodgeA = player.aim; player.strikeHit = new Set();
    sfx.swing();
  }

  function updateWebStrike(dt) {
    player.wstrike -= dt;
    player.x = clamp(player.x + Math.cos(player.dodgeA) * 1000 * dt, A.x + player.r, A.x + A.w - player.r);
    player.y = clamp(player.y + Math.sin(player.dodgeA) * 1000 * dt, A.y + player.r, A.y + A.h - player.r);
    player.inv = Math.max(player.inv, 0.2); player.vx = 0; player.vy = 0;
    for (const e of enemies.slice()) {
      if (player.strikeHit.has(e)) continue;
      if (dist(e, player) < e.r + player.r + 10) {
        player.strikeHit.add(e); sfx.hit(); hitstop = Math.max(hitstop, 0.04); addShake(4);
        knock(e, Math.cos(player.dodgeA) * 450, Math.sin(player.dodgeA) * 450, 0.9); e.webT = time + 0.9;
        burst(e.x, e.y, 8, '#ffffff', 240, 0.3); damage(e, 1.5);
      }
    }
    particles.push({ x: player.x, y: player.y, vx: 0, vy: 0, life: 0.25, max: 0.25, color: '#ffffff', size: 5 });
  }

  registerHero({
    id: 'spider', name: 'Spider-Man', team: 'avengers', order: 7, modern: true,
    blurb: 'Web-slinger. Long swings, stun, explosive, throw and electric webs.',
    look: {
      capeLab: 'Suit', cape: '#c93a3a', fx: '#ffffff', hair: '#5a3a24',
      gears: ['Classic mask', 'Hood up', 'Unmasked'],
      help: '<b>Hold click</b> shoots webs that slow enemies. <b>Right click</b> is a web strike, a quick dash that stuns what it hits. <b>Q</b> web swing: grapples to the wall or corner you aim at, from anywhere in the arena, with almost no cooldown so you can chain swings. <b>E</b> web stun, <b>F</b> exploding web that stuns everything nearby, <b>R</b> grab web (yanks an enemy in, then flings it through the others), <b>T</b> electric web (stuns and keeps shocking, arcing to neighbors), <b>Space</b> dodge. Passive spider sense: arrows show where enemies are, and it dodges one hit for you every 10 seconds. WASD to move, mouse to aim, <b>P</b> to pause.',
      keys: ['Hold click: web shot     Right click: web strike     Space: dodge', 'Q web swing     E web stun     F exploding web', 'R grab and throw     T electric web']
    },
    cd: { wshot: 0, wswing: 0, wstun: 0, wbomb: 0, wthrow: 0, welec: 0, wstrike: 0 },
    init: () => ({ grab: null, senseReady: true, senseT: 0, wstrike: 0, strikeHit: new Set() }),
    reset() {
      webs = []; splats = [];
    },
    onKey(code, e) {
      if (code === 'KeyQ') castWebSwing();
      if (code === 'KeyE') castWebStun();
      if (code === 'KeyF') castWebBomb();
      if (code === 'KeyR') castWebGrab();
      if (code === 'KeyT') castWebElec();
      if (code === 'Space') castRoll();
    },
    onMouse(button) {
      if (button === 2) castWebStrike(); else { mouse.down = true; fireWeb(); }
    },
    speed() { return 275; },
    update(dt) {
      for (const sp of splats) sp.life -= dt;
      splats = splats.filter(sp => sp.life > 0);
      if (mouse.down) fireWeb();
      updateWebs(dt);
      if (player.grab) updateGrab(dt);
      if (!player.senseReady) {
        player.senseT -= dt;
        if (player.senseT <= 0) { player.senseReady = true; ring(player.x, player.y, 50, '#ff4a4a'); }
      }
    },
    preEnemies(dt) {
      for (const e of enemies.slice()) {                                // electric web ticks and thrown enemies
        if (e.elec > 0) {
          e.elec -= dt; e.elecTick = (e.elecTick || 0) - dt;
          if (e.elecTick <= 0) { e.elecTick = 0.5; burst(e.x, e.y, 5, C.bolt, 180, 0.25); sfx.zap(); damage(e, 1); chainArcs(e, 1, 140, 0.5, 0.5); }
        }
        if (e.thr && enemies.includes(e)) updateThrown(e, dt);
      }
    },
    onHurt(h) {
      if (player.senseReady) {                                          // spider sense: dodge the hit in slow motion
        player.senseReady = false; player.senseT = 10; player.inv = 0.7; slowT = 0.5; flash = 0.18;
        ring(player.x, player.y, 70, '#ff4a4a'); burst(player.x, player.y, 14, '#ffffff', 240, 0.4); sfx.sense();
        return true;
      }
      return false;
    },
    hudBars() {
      ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.fillRect(48, 46, 140, 6);
      ctx.fillStyle = player.senseReady ? '#ff4a4a' : 'rgba(255,74,74,0.45)';
      ctx.fillRect(48, 46, 140 * (player.senseReady ? 1 : 1 - player.senseT / 10), 6);
      ctx.font = '11px "Palatino Linotype", Palatino, Georgia, serif'; ctx.textAlign = 'left';
      ctx.fillStyle = 'rgba(231,238,244,0.7)'; ctx.fillText(player.senseReady ? 'SPIDER SENSE READY' : 'SPIDER SENSE', 194, 49);
      ctx.font = '700 22px "Palatino Linotype", Palatino, Georgia, serif';
    },
    skills() {
      return [
        { k: 'M1', n: 'Web Shot', cd: cd.wshot,  max: 0.3, ok: player.roll <= 0 },
        { k: 'RMB', n: 'Strike',  cd: cd.wstrike, max: 3,  ok: !player.zip && !player.grab },
        { k: 'Q', n: 'Swing',     cd: cd.wswing, max: 0.3, ok: !player.grab },
        { k: 'E', n: 'Stun',      cd: cd.wstun,  max: 5,   ok: true },
        { k: 'F', n: 'Burst',     cd: cd.wbomb,  max: 8,   ok: true },
        { k: 'R', n: 'Grab',      cd: cd.wthrow, max: 7,   ok: !player.grab },
        { k: 'T', n: 'Electric',  cd: cd.welec,  max: 9,   ok: true },
        { k: 'Space', n: 'Dodge', cd: cd.roll,   max: 2.5, ok: !player.zip }
      ];
    },
    message() {
      let msg;
      if (player.zip) msg = 'Swinging!';
      else if (player.grab) msg = 'Reeling it in. Aim where you want it thrown.';
      else if (slowT > 0) msg = 'Spider sense! Dodged.';
      else msg = 'Hold click: web shot. Q swing, E stun, R grab and throw.';
      return msg;
    },
    drawPlayerFx(px, py) {
        const th = [];
        for (const e of enemies) { const d = dist(e, player); if (d < 520) th.push({ x: e.x, y: e.y, d, hot: d < e.r + player.r + 70 }); }
        for (const b of ebolts) {
          if (b.friendly) continue;
          const d = Math.hypot(b.x - player.x, b.y - player.y);
          if (d < 480 && ((player.x - b.x) * b.vx + (player.y - b.y) * b.vy) > 0) th.push({ x: b.x, y: b.y, d, hot: true });
        }
        th.sort((a, b) => a.d - b.d);
        let anyHot = false;
        for (const t of th.slice(0, 10)) {
          const a = Math.atan2(t.y - py, t.x - px), rr = player.r + 28, sz = 5 + (1 - t.d / 520) * 6;
          ctx.save(); ctx.translate(px + Math.cos(a) * rr, py + Math.sin(a) * rr); ctx.rotate(a);
          ctx.fillStyle = t.hot ? '#ff4a4a' : (t.d < 260 ? '#ffd86b' : 'rgba(255,255,255,0.45)');
          ctx.beginPath(); ctx.moveTo(sz, 0); ctx.lineTo(-sz * 0.6, -sz * 0.8); ctx.lineTo(-sz * 0.2, 0); ctx.lineTo(-sz * 0.6, sz * 0.8); ctx.closePath(); ctx.fill();
          ctx.restore();
          if (t.hot) anyHot = true;
        }
        if (anyHot) {                                                   // the tingle lines over the head
          ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 1.5; ctx.beginPath();
          for (let i = -2; i <= 2; i++) { const a = -Math.PI / 2 + i * 0.35; ctx.moveTo(px + Math.cos(a) * (player.r + 6), py + Math.sin(a) * (player.r + 6)); ctx.lineTo(px + Math.cos(a) * (player.r + 13), py + Math.sin(a) * (player.r + 13)); }
          ctx.stroke();
        }
        if (player.senseReady) {
          ctx.strokeStyle = 'rgba(255,74,74,0.4)'; ctx.lineWidth = 1.5; ctx.setLineDash([3, 4]);
          ctx.beginPath(); ctx.arc(px, py, player.r + 5, 0, 7); ctx.stroke(); ctx.setLineDash([]);
        }
    },
    drawOver() {
      // Spider-Man: web splats, projectiles, and ropes
      for (const sp of splats) {
        const k = Math.min(1, sp.life / 0.6);
        ctx.save(); ctx.globalAlpha = 0.55 * k; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.2; ctx.beginPath();
        for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; ctx.moveTo(sp.x, sp.y); ctx.lineTo(sp.x + Math.cos(a) * sp.r, sp.y + Math.sin(a) * sp.r); }
        for (const f of [0.35, 0.65, 1]) { ctx.moveTo(sp.x + sp.r * f, sp.y); ctx.arc(sp.x, sp.y, sp.r * f, 0, 7); }
        ctx.stroke(); ctx.restore();
      }
      for (const w of webs) {
        const a = Math.atan2(w.vy, w.vx), col = w.kind === 'elec' ? C.bolt : '#ffffff';
        const sz = w.kind === 'shot' ? 4 : (w.kind === 'bomb' ? 8 : 6);
        ctx.save(); ctx.shadowColor = col; ctx.shadowBlur = 12;
        ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(w.x - Math.cos(a) * 26, w.y - Math.sin(a) * 26); ctx.lineTo(w.x, w.y); ctx.stroke();
        ctx.fillStyle = col; ctx.beginPath(); ctx.arc(w.x, w.y, sz, 0, 7); ctx.fill();
        if (w.kind !== 'shot') { ctx.strokeStyle = '#14121a'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(w.x - sz, w.y); ctx.lineTo(w.x + sz, w.y); ctx.moveTo(w.x, w.y - sz); ctx.lineTo(w.x, w.y + sz); ctx.stroke(); }
        if (w.kind === 'grab') { ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.beginPath(); ctx.moveTo(player.x, player.y); ctx.lineTo(w.x, w.y); ctx.stroke(); }
        ctx.restore();
      }
      if (player.grab && enemies.includes(player.grab.e)) {
        ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(player.x, player.y); ctx.lineTo(player.grab.e.x, player.grab.e.y); ctx.stroke();
      }
    },
    gear(g, c) {
      const { r, hr, gear, unsuited } = c; const ch = look.char;
      g.strokeStyle = '#2a4fa8'; g.lineWidth = 6; g.beginPath(); g.arc(0, 0, r - 1, Math.PI * 0.6, Math.PI * 1.4); g.stroke();   // blue sides
      g.fillStyle = '#14121a'; g.beginPath(); g.arc(-r * 0.55, 0, 2.6, 0, 7); g.fill();                                        // spider emblem
      g.strokeStyle = '#14121a'; g.lineWidth = 1.2; g.beginPath();
      for (const sd of [-1, 1]) for (const dx of [-3, 0, 3]) { g.moveTo(-r * 0.55, 0); g.lineTo(-r * 0.55 + dx, sd * 6); }
      g.stroke();
      if (gear === 0) {                                                                    // classic mask with web lines
        g.fillStyle = look.cape; g.beginPath(); g.arc(0, 0, hr + 1, 0, 7); g.fill();
        g.strokeStyle = 'rgba(20,18,26,0.55)'; g.lineWidth = 1; g.beginPath();
        for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; g.moveTo(0, 0); g.lineTo(Math.cos(a) * hr, Math.sin(a) * hr); }
        g.stroke(); g.beginPath(); g.arc(0, 0, hr * 0.5, 0, 7); g.stroke();
        g.fillStyle = '#ffffff';
        for (const sd of [-1, 1]) { g.beginPath(); g.ellipse(hr * 0.5, sd * hr * 0.32, hr * 0.28, hr * 0.14, sd * 0.5, 0, 7); g.fill(); }
      } else if (gear === 1) {                                                             // hood up over the mask
        g.fillStyle = '#4a4f5c'; g.beginPath(); g.arc(-2, 0, hr + 3, 0, 7); g.fill();
        g.fillStyle = look.cape; g.beginPath(); g.arc(hr * 0.2, 0, hr * 0.78, 0, 7); g.fill();
        g.fillStyle = '#ffffff';
        for (const sd of [-1, 1]) { g.beginPath(); g.ellipse(hr * 0.55, sd * hr * 0.28, hr * 0.24, hr * 0.12, sd * 0.5, 0, 7); g.fill(); }
      }
    },
  });

  registerForcedState(90, () => player.wstrike > 0, updateWebStrike);

})();
