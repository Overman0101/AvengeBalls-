// ULTRON (Villains): repulsor fire, a laser beam, homing missiles, Ultron bots that fight on their own, and the ability to
// move his mind into one of them. If a hit would kill him while a bot is alive, his consciousness jumps instead.
//
// Self-contained: everything in this file is private to the hero, except what registerHero() hands to the engine.
(function () {
  const TAU = Math.PI * 2, RED = '#ff3040', BEAM_LEN = 460, MAX_BOTS = 5;
  let shots = [], missiles = [], beam = null;                        // bots live in the engine's `clones` list, so enemies chase them

  Object.assign(sfx, {
    laser: () => { noise(0.25, 0.12, 1500); tone(1400, 500, 0.3, 'sawtooth', 0.1); },
    summon: () => { tone(160, 420, 0.4, 'square', 0.1); noise(0.2, 0.08, 800); },
    transfer: () => { tone(1200, 200, 0.6, 'triangle', 0.14); noise(0.3, 0.1, 2000); }
  });
  const segDist = (px, py, x1, y1, x2, y2) => {
    const dx = x2 - x1, dy = y2 - y1, l2 = dx * dx + dy * dy || 1, t = clamp(((px - x1) * dx + (py - y1) * dy) / l2, 0, 1);
    return Math.hypot(px - (x1 + dx * t), py - (y1 + dy * t));
  };
  const bots = () => clones.filter(c => c.bot);

  // ---------------- hold click: repulsor fire ----------------
  function fireRepulsor() {
    if (cd.ul_shot > 0 || beam) return;
    cd.ul_shot = 0.2;
    shots.push({ x: player.x + Math.cos(player.aim) * 18, y: player.y + Math.sin(player.aim) * 18, vx: Math.cos(player.aim) * 950, vy: Math.sin(player.aim) * 950, dmg: 1.1, life: 0.9 });
    sfx.gun();
  }
  function updateShots(dt) {
    for (const s of shots.slice()) {
      s.x += s.vx * dt; s.y += s.vy * dt; s.life -= dt;
      let done = s.life <= 0 || s.x < A.x || s.x > A.x + A.w || s.y < A.y || s.y > A.y + A.h;
      for (const e of enemies.slice()) {
        if (done) break;
        if (Math.hypot(e.x - s.x, e.y - s.y) < e.r + 5) { knock(e, s.vx * 0.15, s.vy * 0.15, 0.2); damage(e, s.dmg); burst(s.x, s.y, 6, RED, 220, 0.3); sfx.hit(); done = true; }
      }
      if (done) shots.splice(shots.indexOf(s), 1);
    }
  }

  // ---------------- right click: laser beam ----------------
  function castBeam() {
    if (cd.ul_beam > 0 || beam) return;
    cd.ul_beam = 7; beam = { t: 0, dur: 0.9, tick: 0 }; sfx.laser();
  }
  function beamLine() {
    const a = player.aim; return { x1: player.x + Math.cos(a) * 16, y1: player.y + Math.sin(a) * 16, x2: player.x + Math.cos(a) * BEAM_LEN, y2: player.y + Math.sin(a) * BEAM_LEN };
  }
  function updateBeam(dt) {
    beam.t += dt; beam.tick -= dt;
    if (beam.tick <= 0) {
      beam.tick = 0.1; const L = beamLine();
      for (const e of enemies.slice()) {
        if (segDist(e.x, e.y, L.x1, L.y1, L.x2, L.y2) < e.r + 14) { knock(e, Math.cos(player.aim) * 60, Math.sin(player.aim) * 60, 0.15); damage(e, 0.9); burst(e.x, e.y, 3, RED, 180, 0.2); }
      }
      addShake(1.5);
    }
    if (beam.t >= beam.dur) beam = null;
  }

  // ---------------- E: homing missiles ----------------
  function castMissiles() {
    if (cd.ul_missile > 0) return;
    cd.ul_missile = 9;
    for (let i = 0; i < 6; i++) {
      const a = player.aim + (i - 2.5) * 0.18;
      missiles.push({ x: player.x + Math.cos(a) * 16, y: player.y + Math.sin(a) * 16, ang: a, speed: 260, t: 0 });
    }
    addShake(3); sfx.boom();
  }
  function updateMissiles(dt) {
    for (const m of missiles.slice()) {
      m.t += dt; m.speed = Math.min(620, m.speed + 700 * dt);
      if (m.t > 0.2) {                                                    // after launch, home on the nearest enemy
        let best = null, bd = 99999; for (const e of enemies) { const d = Math.hypot(e.x - m.x, e.y - m.y); if (d < bd) { bd = d; best = e; } }
        if (best) { const want = Math.atan2(best.y - m.y, best.x - m.x), da = ((want - m.ang + Math.PI * 3) % TAU) - Math.PI; m.ang += clamp(da, -4.5 * dt, 4.5 * dt); }
      }
      m.x += Math.cos(m.ang) * m.speed * dt; m.y += Math.sin(m.ang) * m.speed * dt;
      particles.push({ x: m.x, y: m.y, vx: 0, vy: 0, life: 0.3, max: 0.3, color: '#ffb36b', size: 3 });
      const hit = enemies.some(e => Math.hypot(e.x - m.x, e.y - m.y) < e.r + 6);
      if (hit || m.t > 2.4 || m.x < A.x || m.x > A.x + A.w || m.y < A.y || m.y > A.y + A.h) { explodeAt(m.x, m.y, 68, 2, RED); missiles.splice(missiles.indexOf(m), 1); }
    }
  }

  // ---------------- Q: Ultron bots ----------------
  function castSummon() {
    if (cd.ul_summon > 0) return;
    cd.ul_summon = 12;
    for (let i = 0; i < 3 && bots().length < MAX_BOTS; i++) {
      const a = player.aim + (i - 1) * 1.1 + Math.PI;
      clones.push({ bot: true, hp: 4, x: player.x + Math.cos(a) * 42, y: player.y + Math.sin(a) * 42, life: 30, shotT: 0.3 + i * 0.2, dir: i % 2 ? 1 : -1, slot: i, hurtT: 0 });
      ring(clones[clones.length - 1].x, clones[clones.length - 1].y, 46, RED);
    }
    burst(player.x, player.y, 18, RED, 260, 0.5); sfx.summon();
  }
  function destroyBot(c) { explodeAt(c.x, c.y, 62, 1.2, RED); if (clones.includes(c)) killClone(c); }
  function updateBots(dt) {                                              // each bot fights on its own
    for (const c of bots()) {
      c.life -= dt; c.hurtT -= dt; c.shotT -= dt;
      if (c.life <= 0) { destroyBot(c); continue; }
      let foe = null, bd = 720; for (const e of enemies) { if (e.thr) continue; const d = Math.hypot(e.x - c.x, e.y - c.y); if (d < bd) { bd = d; foe = e; } }
      let mx = 0, my = 0;
      if (foe) {
        const dx = foe.x - c.x, dy = foe.y - c.y, d = Math.hypot(dx, dy) || 1;
        if (d > 280) { mx = dx / d; my = dy / d; } else if (d < 170) { mx = -dx / d; my = -dy / d; } else { mx = -dy / d * c.dir; my = dx / d * c.dir; }       // close in, back off, or circle
        if (c.shotT <= 0 && d < 600) {
          c.shotT = 0.75; const a = Math.atan2(dy, dx);
          shots.push({ x: c.x + Math.cos(a) * 12, y: c.y + Math.sin(a) * 12, vx: Math.cos(a) * 820, vy: Math.sin(a) * 820, dmg: 0.9, life: 0.9, bot: true });
        }
        c.face = Math.atan2(dy, dx);
      } else {                                                           // nothing to fight: hover near Ultron
        const a = time * 1.4 + c.slot * 2.1, tx = player.x + Math.cos(a) * 70, ty = player.y + Math.sin(a) * 70, dx = tx - c.x, dy = ty - c.y, d = Math.hypot(dx, dy) || 1;
        if (d > 8) { mx = dx / d * Math.min(1, d / 60); my = dy / d * Math.min(1, d / 60); } c.face = player.aim;
      }
      c.x = clamp(c.x + mx * 175 * dt, A.x + 14, A.x + A.w - 14); c.y = clamp(c.y + my * 175 * dt, A.y + 14, A.y + A.h - 14);
    }
  }
  function botTakesHit(c, n) {
    if (c.hurtT > 0) return; c.hurtT = 0.35; c.hp -= n; burst(c.x, c.y, 6, RED, 200, 0.3); sfx.hit();
    if (c.hp <= 0) destroyBot(c);
  }

  // ---------------- R: transfer consciousness ----------------
  function transferTo(bot, auto) {
    const ox = player.x, oy = player.y;
    player.x = bot.x; player.y = bot.y; player.kx = 0; player.ky = 0; player.inv = Math.max(player.inv, 0.9);
    if (clones.includes(bot)) killClone(bot);                           // the bot is the new body
    explodeAt(ox, oy, 95, 2.2, RED);                                      // the old body burns out
    ring(player.x, player.y, 120, RED); burst(player.x, player.y, 26, RED, 340, 0.6); flash = 0.2; addShake(8);
    player.hp = Math.min(maxHp(), player.hp + (auto ? 2 : 1)); sfx.transfer();
  }
  function castTransfer() {
    if (cd.ul_xfer > 0) return;
    let best = null, bd = 99999; for (const b of bots()) { const d = Math.hypot(b.x - mouse.x, b.y - mouse.y); if (d < bd) { bd = d; best = b; } }
    if (!best) { cd.ul_xfer = 0.5; return; }
    cd.ul_xfer = 18; transferTo(best, false);
  }

  // ---------------- drawing ----------------
  function drawBot(c) {
    const blink = c.hurtT > 0 && Math.floor(c.hurtT * 30) % 2 === 0;
    ctx.save(); ctx.translate(c.x, c.y); ctx.shadowColor = RED; ctx.shadowBlur = 12;
    ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(0, 12, 12, 5, 0, 0, 7); ctx.fill();
    ctx.rotate(c.face || 0); ctx.fillStyle = blink ? '#ffffff' : '#8d97a3'; ctx.beginPath(); ctx.arc(0, 0, 13, 0, 7); ctx.fill();
    ctx.strokeStyle = '#4a535d'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, 13, 0, 7); ctx.stroke();
    ctx.fillStyle = RED; ctx.fillRect(5, -5, 4, 2.6); ctx.fillRect(5, 2.4, 4, 2.6);
    ctx.fillStyle = '#4a535d'; ctx.fillRect(10, -2, 8, 4);                                                     // arm cannon
    ctx.restore();
    for (let i = 0; i < c.hp; i++) { ctx.fillStyle = RED; ctx.fillRect(c.x - 10 + i * 6, c.y - 22, 4, 3); }
  }
  function gear(g, c) {
    const { hr, gear } = c;
    g.fillStyle = '#a3acb7'; g.beginPath(); g.arc(0, 0, hr + 1, 0, 7); g.fill();                              // the head
    g.strokeStyle = '#5b6672'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(-hr * 0.8, 0); g.lineTo(hr * 0.95, 0); g.stroke();
    if (gear === 1) { g.fillStyle = '#5b6672'; for (const s of [-1, 1]) { g.beginPath(); g.moveTo(-hr * 0.2, s * hr * 0.7); g.lineTo(-hr * 0.9, s * (hr + 9)); g.lineTo(-hr * 0.7, s * hr * 0.4); g.closePath(); g.fill(); } }
    else if (gear === 2) { g.fillStyle = 'rgba(40,48,58,0.8)'; g.fillRect(hr * 0.25, -hr * 0.6, hr * 0.7, hr * 1.2); }
    g.save(); g.shadowColor = RED; g.shadowBlur = 8; g.fillStyle = RED; g.fillRect(hr * 0.5, -5, 3.6, 2.6); g.fillRect(hr * 0.5, 2.4, 3.6, 2.6); g.restore();
  }

  registerHero({
    id: 'ultron', name: 'Ultron', team: 'villains', order: 2, modern: true,
    blurb: 'A mind in a thousand bodies. Bots that fight alone, missiles, a laser, and he cannot really die.',
    look: {
      capeLab: 'Plating', cape: '#7b8794', fx: '#ff3040', hair: '#4b5560',
      gears: ['Prime', 'Horned', 'Sentry'],
      help: '<b>Hold click</b> fires repulsor bolts. <b>Right click</b> a piercing laser beam. <b>Q</b> summons Ultron bots (up to 5) that fight on their own, and enemies chase them. <b>E</b> six homing missiles. <b>R</b> transfers your consciousness into the bot nearest your cursor: you appear where it was, heal a heart, and your old body explodes. <b>Redundancy:</b> if a hit would kill you while a bot is alive, your mind jumps into it instead and you heal two hearts.',
      keys: ['Hold click: repulsor     Right click: laser beam', 'Q summon bots     E missiles', 'R transfer consciousness (to the bot nearest the cursor)']
    },
    cd: { ul_shot: 0, ul_beam: 0, ul_summon: 0, ul_missile: 0, ul_xfer: 0 },
    init: () => ({ ulSaveT: 0 }),
    reset() { shots = []; missiles = []; beam = null; },
    onKey(code) {
      if (code === 'KeyQ') castSummon();
      if (code === 'KeyE') castMissiles();
      if (code === 'KeyR') castTransfer();
    },
    onMouse(button) { if (button === 2) castBeam(); else { mouse.down = true; fireRepulsor(); } },
    speed() { return beam ? 130 : 255; },
    update(dt) {
      if (mouse.down) fireRepulsor();
      if (player.ulSaveT > 0) player.ulSaveT -= dt;
      updateShots(dt); updateMissiles(dt); updateBots(dt);
      if (beam) updateBeam(dt);
    },
    postEnemies() {                                                     // enemies that reach a bot damage it
      for (const c of bots()) for (const e of enemies) { if (!e.thr && e.stun <= 0 && dist(e, c) < e.r + 14) { botTakesHit(c, e.boss ? 2 : 1); break; } }
    },
    onBolt(b) {                                                         // bolts that hit a bot wound it instead of killing it outright
      for (const c of bots()) if (Math.hypot(c.x - b.x, c.y - b.y) < 18) { botTakesHit(c, 1); return 'gone'; }
      return null;
    },
    onHurt() {                                                          // Redundancy: his mind jumps to a bot instead of dying
      if (player.hp <= 1 && player.ulSaveT <= 0 && bots().length) {
        let best = null, bd = 99999; for (const b of bots()) { const d = dist(b, player); if (d < bd) { bd = d; best = b; } }
        player.ulSaveT = 4; transferTo(best, true); return true;
      }
      return false;
    },
    skills() {
      return [
        { k: 'M1', n: 'Repulsor', cd: cd.ul_shot, max: 0.2, ok: !beam },
        { k: 'M2', n: 'Laser', cd: cd.ul_beam, max: 7, ok: !beam },
        { k: 'Q', n: 'Bots ' + bots().length + '/' + MAX_BOTS, cd: cd.ul_summon, max: 12, ok: bots().length < MAX_BOTS },
        { k: 'E', n: 'Missiles', cd: cd.ul_missile, max: 9, ok: true },
        { k: 'R', n: 'Transfer', cd: cd.ul_xfer, max: 18, ok: bots().length > 0 }
      ];
    },
    message() {
      if (beam) return 'Laser.';
      const n = bots().length;
      return n ? n + ' bot' + (n > 1 ? 's' : '') + ' fighting. R moves your mind into one, and a deadly hit will too.' : 'Hold click to fire. Q summons bots.';
    },
    aimLine() { return 300; },
    bodyRing(g, r) { g.strokeStyle = '#5b6672'; g.lineWidth = 3; g.beginPath(); g.arc(0, 0, r - 3, 0, 7); g.stroke(); },
    drawBefore() { for (const c of bots()) drawBot(c); },
    drawOver() {
      for (const s of shots) {
        const a = Math.atan2(s.vy, s.vx);
        ctx.save(); ctx.shadowColor = RED; ctx.shadowBlur = 12; ctx.lineCap = 'round'; ctx.strokeStyle = RED; ctx.lineWidth = s.bot ? 3 : 5;
        ctx.beginPath(); ctx.moveTo(s.x - Math.cos(a) * 16, s.y - Math.sin(a) * 16); ctx.lineTo(s.x, s.y); ctx.stroke();
        ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(s.x - Math.cos(a) * 10, s.y - Math.sin(a) * 10); ctx.lineTo(s.x, s.y); ctx.stroke(); ctx.restore();
      }
      for (const m of missiles) {
        ctx.save(); ctx.translate(m.x, m.y); ctx.rotate(m.ang); ctx.shadowColor = '#ffb36b'; ctx.shadowBlur = 10;
        ctx.fillStyle = '#c9d0d8'; ctx.fillRect(-7, -2.5, 13, 5); ctx.fillStyle = RED; ctx.beginPath(); ctx.moveTo(6, -2.5); ctx.lineTo(11, 0); ctx.lineTo(6, 2.5); ctx.fill(); ctx.restore();
      }
      if (beam) {
        const L = beamLine(), a = Math.min(1, beam.t / 0.1) * Math.min(1, (beam.dur - beam.t) / 0.15 + 0.2);
        ctx.save(); ctx.globalAlpha = a; ctx.shadowColor = RED; ctx.shadowBlur = 24; ctx.lineCap = 'round';
        ctx.strokeStyle = 'rgba(255,48,64,0.5)'; ctx.lineWidth = 22 + Math.random() * 4; ctx.beginPath(); ctx.moveTo(L.x1, L.y1); ctx.lineTo(L.x2, L.y2); ctx.stroke();
        ctx.strokeStyle = RED; ctx.lineWidth = 11; ctx.beginPath(); ctx.moveTo(L.x1, L.y1); ctx.lineTo(L.x2, L.y2); ctx.stroke();
        ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(L.x1, L.y1); ctx.lineTo(L.x2, L.y2); ctx.stroke(); ctx.restore();
      }
    },
    gear,
    api: { state: () => ({ bots: bots().map(c => ({ hp: c.hp, x: c.x, y: c.y })), shots: shots.length, missiles: missiles.length, beam: !!beam }) }     // exposed for the automated tests
  });
})();
