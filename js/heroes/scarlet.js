// SCARLET WITCH: homing hex bolts, telekinetic grab-and-throw, a hex zone where enemies turn on each other,
// mind control (an enemy fights for you), and a reality warp that reshuffles the battlefield.
//
// Self-contained: everything in this file is private to the hero, except what registerHero() hands to the engine.
(function () {
  const TAU = Math.PI * 2;
  let bolts = [], zones = [], held = null;

  Object.assign(sfx, {
    hex: () => { tone(520, 260, 0.14, 'sawtooth', 0.08); },
    mind: () => { tone(300, 900, 0.5, 'sine', 0.14); tone(450, 1350, 0.5, 'triangle', 0.08); },
    warp: () => { noise(0.6, 0.14, 500); tone(900, 80, 0.8, 'sawtooth', 0.12); }
  });
  const angDiff = (a, b) => ((b - a + Math.PI * 3) % TAU) - Math.PI;
  const nearestTo = (x, y, list, maxD) => { let best = null, bd = maxD; for (const e of list) { const d = Math.hypot(e.x - x, e.y - y); if (d < bd) { bd = d; best = e; } } return best; };
  const isAlly = e => !!e.ally;

  // ---------------- hold click: homing hex bolts ----------------
  function fireHex() {
    if (cd.sw_hex > 0) return;
    cd.sw_hex = 0.28;
    bolts.push({ x: player.x + Math.cos(player.aim) * 18, y: player.y + Math.sin(player.aim) * 18, ang: player.aim, life: 1.5 });
    sfx.hex();
  }
  function updateBolts(dt) {
    for (const b of bolts.slice()) {
      const target = nearestTo(b.x, b.y, enemies.filter(e => !isAlly(e) && Math.abs(angDiff(b.ang, Math.atan2(e.y - b.y, e.x - b.x))) < 1.2), 320);
      if (target) b.ang += clamp(angDiff(b.ang, Math.atan2(target.y - b.y, target.x - b.x)), -3.2 * dt, 3.2 * dt);   // curves toward enemies
      b.x += Math.cos(b.ang) * 640 * dt; b.y += Math.sin(b.ang) * 640 * dt; b.life -= dt;
      particles.push({ x: b.x, y: b.y, vx: 0, vy: 0, life: 0.25, max: 0.25, color: C.bolt, size: 5 });
      let done = false;
      for (const e of enemies.slice()) {
        if (isAlly(e) || Math.hypot(e.x - b.x, e.y - b.y) >= e.r + 8) continue;
        knock(e, Math.cos(b.ang) * 240, Math.sin(b.ang) * 240, 0.25); damage(e, 1.3);
        ring(b.x, b.y, 44, C.bolt); burst(b.x, b.y, 10, C.bolt, 240, 0.35); sfx.hit(); done = true; break;
      }
      if (!done && (b.x < A.x || b.x > A.x + A.w || b.y < A.y || b.y > A.y + A.h)) { burst(b.x, b.y, 6, C.bolt, 200, 0.3); done = true; }
      if (done || b.life <= 0) bolts.splice(bolts.indexOf(b), 1);
    }
  }

  // ---------------- right click: telekinetic grab, then throw ----------------
  function castTelekinesis() {
    if (held) { throwHeld(); return; }
    if (cd.sw_tk > 0) return;
    const e = nearestTo(mouse.x, mouse.y, enemies.filter(o => !o.boss && !o.thr && !isAlly(o) && dist(o, player) < 520), 150);
    if (!e) { cd.sw_tk = 0.3; return; }
    held = { e, t: 0 }; e.thr = { held: true, vx: 0, vy: 0, t: 99, hit: new Set() };
    ring(e.x, e.y, 60, C.bolt); sfx.mind();
  }
  function throwHeld() {
    const e = held.e; held = null; cd.sw_tk = 4;
    if (!enemies.includes(e)) return;
    e.thr = { vx: Math.cos(player.aim) * 1150, vy: Math.sin(player.aim) * 1150, t: 0.9, hit: new Set() };
    e.stun = Math.max(e.stun, 1); sfx.throw(); addShake(6); ring(e.x, e.y, 60, '#ffffff');
  }
  function updateHeld(dt) {
    const e = held.e;
    if (!enemies.includes(e) || !e.thr || !e.thr.held) { held = null; return; }
    const k = Math.min(1, 14 * dt), tx = player.x + Math.cos(player.aim) * (player.r + e.r + 40), ty = player.y + Math.sin(player.aim) * (player.r + e.r + 40);
    e.x += (tx - e.x) * k; e.y += (ty - e.y) * k; e.kx = 0; e.ky = 0; e.stun = Math.max(e.stun, 0.3);
    held.t += dt; if (held.t > 4) throwHeld();
  }
  function updateThrown(e, dt) {                                        // a flung enemy plows through the others
    const T = e.thr; T.t -= dt; e.kx = 0; e.ky = 0; e.stun = Math.max(e.stun, 0.3);
    const steps = Math.max(1, Math.ceil(Math.hypot(T.vx, T.vy) * dt / 10));
    for (let s = 0; s < steps; s++) {
      e.x += T.vx * dt / steps; e.y += T.vy * dt / steps;
      for (const o of enemies.slice()) {
        if (o === e || T.hit.has(o) || Math.hypot(o.x - e.x, o.y - e.y) >= e.r + o.r) continue;
        T.hit.add(o); sfx.hit(); addShake(5); hitstop = Math.max(hitstop, 0.04);
        ring(o.x, o.y, 50, C.bolt); burst(o.x, o.y, 10, C.bolt, 240, 0.3);
        knock(o, T.vx * 0.3, T.vy * 0.3, 0.8); damage(o, 2); damage(e, 1);
        if (!enemies.includes(e)) return;
      }
      if (e.x < A.x + e.r || e.x > A.x + A.w - e.r || e.y < A.y + e.r || e.y > A.y + A.h - e.r) {    // slammed into the wall
        e.x = clamp(e.x, A.x + e.r, A.x + A.w - e.r); e.y = clamp(e.y, A.y + e.r, A.y + A.h - e.r); e.thr = null;
        sfx.slam(); addShake(9); hitstop = 0.07; ring(e.x, e.y, 80, C.bolt); burst(e.x, e.y, 18, C.bolt, 300, 0.5); knock(e, 0, 0, 1.5);
        for (const o of enemies.slice()) if (o !== e && Math.hypot(o.x - e.x, o.y - e.y) < 70 + o.r) { knock(o, 0, 0, 0.6); damage(o, 1); }
        damage(e, 3); return;
      }
    }
    if (T.t <= 0) e.thr = null;
  }

  // ---------------- turning enemies on each other (used by the hex zone and by mind control) ----------------
  // The engine skips an enemy's own AI, and its attack on you, while it is stunned. So a controlled enemy is kept stunned
  // and steered from here instead.
  function turnOnOthers(e, dt, mult) {
    const foes = enemies.filter(o => o !== e && !isAlly(o) && !(o.thr && o.thr.held));
    const foe = nearestTo(e.x, e.y, foes, 99999);
    let tx, ty;
    if (foe) { tx = foe.x; ty = foe.y; }
    else if (isAlly(e)) { tx = player.x + Math.cos(time * 2) * 90; ty = player.y + Math.sin(time * 2) * 90; }     // nobody to fight: guard the player
    else { tx = e.x + Math.cos(time * 5 + e.x) * 40; ty = e.y + Math.sin(time * 5 + e.y) * 40; }
    const dx = tx - e.x, dy = ty - e.y, d = Math.hypot(dx, dy) || 1;
    if (d > 6) { e.x = clamp(e.x + dx / d * e.speed * mult * dt, A.x + e.r, A.x + A.w - e.r); e.y = clamp(e.y + dy / d * e.speed * mult * dt, A.y + e.r, A.y + A.h - e.r); }
    e.face = Math.atan2(dy, dx);
    if (foe && Math.hypot(foe.x - e.x, foe.y - e.y) < e.r + foe.r + 4 && time >= (e.sw_hit || 0)) {
      e.sw_hit = time + 0.55; sfx.hit();
      knock(foe, dx / d * 320, dy / d * 320, 0.4); burst(foe.x, foe.y, 6, C.bolt, 220, 0.3); damage(foe, e.hp > 5 ? 1.6 : 1.1);
    }
  }

  // ---------------- Q: hex zone ----------------
  function castZone() {
    if (cd.sw_zone > 0) return;
    cd.sw_zone = 12;
    const x = clamp(mouse.x, A.x + 60, A.x + A.w - 60), y = clamp(mouse.y, A.y + 60, A.y + A.h - 60);
    zones = [{ x, y, r: 120, age: 0, life: 6.5 }];
    ring(x, y, 140, C.bolt); burst(x, y, 20, C.bolt, 260, 0.5); addShake(3); sfx.warp();
  }
  const inZone = e => zones.some(z => Math.hypot(e.x - z.x, e.y - z.y) < z.r + e.r * 0.5);

  // ---------------- E: mind control ----------------
  function castMind() {
    if (cd.sw_mind > 0) return;
    const e = nearestTo(mouse.x, mouse.y, enemies.filter(o => !o.boss && !isAlly(o) && !o.thr), 99999);
    if (!e) { cd.sw_mind = 0.4; return; }
    cd.sw_mind = 16;
    e.ally = { t: 6.5, armor0: e.armor || 0 }; e.armor = (e.armor || 0) + 2;          // sturdy while it is on your side
    ring(e.x, e.y, 90, C.bolt); burst(e.x, e.y, 18, C.bolt, 260, 0.5); sfx.mind();
  }
  function releaseAlly(e) {
    e.armor = e.ally.armor0; delete e.ally; e.stun = Math.max(e.stun, 0.6);
    ring(e.x, e.y, 70, C.bolt);
  }

  // ---------------- R: reality warp ----------------
  function castWarp() {
    if (cd.sw_warp > 0) return;
    cd.sw_warp = 24;
    const movable = enemies.filter(e => !e.boss && !(e.thr && e.thr.held)), spots = movable.map(e => [e.x, e.y]);
    for (let i = spots.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [spots[i], spots[j]] = [spots[j], spots[i]]; }
    movable.forEach((e, i) => {                                                       // everyone swaps places
      ring(e.x, e.y, 60, C.bolt);
      e.x = spots[i][0]; e.y = spots[i][1];
      const d = dist(e, player);
      if (d < 150) { e.x = clamp(player.x + (e.x - player.x) / (d || 1) * 150, A.x + e.r, A.x + A.w - e.r); e.y = clamp(player.y + (e.y - player.y) / (d || 1) * 150, A.y + e.r, A.y + A.h - e.r); }
      e.kx = 0; e.ky = 0; e.stun = Math.max(e.stun, 1.2); ring(e.x, e.y, 60, '#ffffff');
    });
    for (const e of enemies.slice()) damage(e, 1);
    for (const b of ebolts) { b.friendly = true; b.vx = -b.vx; b.vy = -b.vy; }       // their own fire turns around
    flash = 0.3; hitstop = 0.06; addShake(10);
    ring(player.x, player.y, 420, C.bolt); ring(player.x, player.y, 260, '#ffffff'); burst(player.x, player.y, 40, C.bolt, 420, 0.7); sfx.warp();
  }

  // ---------------- drawing ----------------
  function drawZones() {
    for (const z of zones) {
      const s = Math.min(1, z.age / 0.3), fade = Math.min(1, (z.life - z.age) / 0.8), R = z.r * s;
      ctx.save(); ctx.globalAlpha = fade;
      const g = ctx.createRadialGradient(z.x, z.y, 8, z.x, z.y, R); g.addColorStop(0, 'rgba(255,60,90,0.05)'); g.addColorStop(1, 'rgba(255,60,90,0.28)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(z.x, z.y, R, 0, 7); ctx.fill();
      ctx.shadowColor = C.bolt; ctx.shadowBlur = 12; ctx.strokeStyle = C.bolt; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(z.x, z.y, R, 0, 7); ctx.stroke();
      ctx.lineWidth = 2; ctx.setLineDash([10, 8]); ctx.lineDashOffset = -time * 40; ctx.beginPath(); ctx.arc(z.x, z.y, R * 0.62, 0, 7); ctx.stroke(); ctx.setLineDash([]);
      for (let i = 0; i < 3; i++) { const a = time * 1.5 + i * TAU / 3; ctx.beginPath(); ctx.moveTo(z.x + Math.cos(a) * R * 0.3, z.y + Math.sin(a) * R * 0.3); ctx.lineTo(z.x + Math.cos(a + 0.8) * R * 0.6, z.y + Math.sin(a + 0.8) * R * 0.6); ctx.stroke(); }
      ctx.restore();
    }
  }
  function drawControlled() {
    for (const e of enemies) {
      const ally = isAlly(e), hexed = !ally && inZone(e) && !e.boss;
      if (!ally && !hexed) continue;
      ctx.save(); ctx.translate(e.x, e.y); ctx.strokeStyle = C.bolt; ctx.shadowColor = C.bolt; ctx.shadowBlur = ally ? 16 : 8; ctx.lineWidth = ally ? 3 : 2;
      ctx.setLineDash(ally ? [] : [5, 5]); ctx.rotate(time * (ally ? 3 : -3)); ctx.beginPath(); ctx.arc(0, 0, e.r + 8, 0, 7); ctx.stroke();
      if (ally) { ctx.setLineDash([]); ctx.fillStyle = C.bolt; ctx.rotate(-time * 3); for (const s of [-1, 1]) { ctx.beginPath(); ctx.arc(e.r * 0.3, s * e.r * 0.3, 2.6, 0, 7); ctx.fill(); } }
      ctx.restore();
      if (ally) {                                                           // the strings to the one pulling them
        ctx.save(); ctx.strokeStyle = C.bolt; ctx.globalAlpha = 0.5; ctx.lineWidth = 1.5; ctx.setLineDash([4, 6]); ctx.lineDashOffset = -time * 60;
        ctx.beginPath(); ctx.moveTo(player.x, player.y); ctx.lineTo(e.x, e.y); ctx.stroke(); ctx.restore();
      }
    }
  }
  function drawHands(px, py) {                                              // glowing hands, brighter while she holds something
    const pulse = 0.7 + 0.3 * Math.sin(time * 8), r = player.r;
    for (const s of [-1, 1]) {
      const hx = px + Math.cos(player.aim) * (r * 0.9) - Math.sin(player.aim) * s * (r + 4), hy = py + Math.sin(player.aim) * (r * 0.9) + Math.cos(player.aim) * s * (r + 4);
      ctx.save(); ctx.shadowColor = C.bolt; ctx.shadowBlur = held ? 20 : 12; ctx.fillStyle = C.bolt; ctx.globalAlpha = held ? 1 : pulse;
      ctx.beginPath(); ctx.arc(hx, hy, held ? 5 : 3.6, 0, 7); ctx.fill(); ctx.restore();
    }
    if (held && enemies.includes(held.e)) {
      ctx.save(); ctx.strokeStyle = C.bolt; ctx.shadowColor = C.bolt; ctx.shadowBlur = 10; ctx.lineWidth = 2;
      for (let j = 0; j < 3; j++) { ctx.beginPath(); for (let i = 0; i <= 10; i++) { const u = i / 10, x = px + (held.e.x - px) * u, y = py + (held.e.y - py) * u + Math.sin(u * 9 + time * 16 + j * 2) * 5 * Math.sin(u * Math.PI); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); } ctx.stroke(); }
      ctx.beginPath(); ctx.arc(held.e.x, held.e.y, held.e.r + 9, 0, 7); ctx.stroke(); ctx.restore();
    }
  }

  function gear(g, c) {
    const { hr, gear } = c;
    if (gear === 0) {                                                       // the crown
      g.strokeStyle = '#8f1119'; g.lineWidth = 3; g.beginPath(); g.arc(0, 0, hr - 1, 0, 7); g.stroke();
      g.fillStyle = '#d4202b'; for (let i = 0; i < 7; i++) { const a = i * TAU / 7; g.save(); g.rotate(a); g.beginPath(); g.moveTo(hr - 1, -3); g.lineTo(hr + 7, 0); g.lineTo(hr - 1, 3); g.closePath(); g.fill(); g.restore(); }
    } else if (gear === 2) {                                                // hood
      g.fillStyle = look.cape; g.beginPath(); g.arc(-1, 0, hr + 1, 0, 7); g.fill();
      g.beginPath(); g.moveTo(-hr + 2, -8); g.lineTo(-hr - 9, 0); g.lineTo(-hr + 2, 8); g.closePath(); g.fill();
      g.fillStyle = '#d9c3a0'; g.beginPath(); g.arc(hr * 0.35, 0, hr * 0.42, 0, 7); g.fill();
    }
    g.fillStyle = '#6a1a22'; g.beginPath(); g.ellipse(hr * 0.7, 0, 3, 2, 0, 0, 7); g.fill();       // lips
  }

  registerHero({
    id: 'scarlet', name: 'Scarlet Witch', team: 'avengers', order: 10,
    blurb: 'Chaos magic. Homing hexes, telekinesis, mind control, and she can rewrite the fight.',
    look: {
      capeLab: 'Costume', cape: '#b5121b', fx: '#ff3355', hair: '#6a3b25',
      gears: ['Crown', 'Bare head', 'Hood'],
      help: '<b>Hold click</b> fires hex bolts that curve toward enemies. <b>Right click</b> lifts the enemy nearest your cursor; right click again to throw it, and it plows through the others. <b>Q</b> hex zone: enemies inside turn on each other. <b>E</b> mind control: the enemy nearest your cursor fights for you for a few seconds (bosses resist). <b>R</b> reality warp: every enemy swaps places, takes a hit and is stunned, and enemy fire turns around.',
      keys: ['Hold click: hex bolts     Right click: grab, then throw', 'Q hex zone     E mind control', 'R reality warp']
    },
    cd: { sw_hex: 0, sw_tk: 0, sw_zone: 0, sw_mind: 0, sw_warp: 0 },
    init: () => ({}),
    reset() { bolts = []; zones = []; held = null; },
    onKey(code) {
      if (code === 'KeyQ') castZone();
      if (code === 'KeyE') castMind();
      if (code === 'KeyR') castWarp();
    },
    onMouse(button) { if (button === 2) castTelekinesis(); else { mouse.down = true; fireHex(); } },
    speed() { return 265; },
    update(dt) {
      if (mouse.down) fireHex();
      updateBolts(dt);
      if (held) updateHeld(dt);
      for (const z of zones) z.age += dt;
      zones = zones.filter(z => z.age < z.life);
    },
    preEnemies(dt) {
      for (const e of enemies.slice()) {
        if (e.thr && !e.thr.held && enemies.includes(e)) updateThrown(e, dt);
        if (e.ally) { e.ally.t -= dt; if (e.ally.t <= 0) { releaseAlly(e); continue; } }
        if (isAlly(e) || (inZone(e) && !e.boss && !e.thr)) e.stun = Math.max(e.stun, 0.15);    // the engine's AI and contact attack skip a stunned enemy
      }
    },
    postEnemies(dt) {
      for (const e of enemies.slice()) {
        if (e.thr || !enemies.includes(e)) continue;
        if (isAlly(e)) turnOnOthers(e, dt, 1.4);
        else if (inZone(e) && !e.boss) turnOnOthers(e, dt, 1.0);
      }
    },
    skills() {
      return [
        { k: 'M1', n: 'Hex', cd: cd.sw_hex, max: 0.28, ok: true },
        { k: 'M2', n: held ? 'Throw' : 'Grab', cd: held ? 0 : cd.sw_tk, max: 4, ok: true },
        { k: 'Q', n: 'Hex Zone', cd: cd.sw_zone, max: 12, ok: true },
        { k: 'E', n: 'Control', cd: cd.sw_mind, max: 16, ok: true },
        { k: 'R', n: 'Warp', cd: cd.sw_warp, max: 24, ok: true }
      ];
    },
    message() {
      if (held) return 'Holding it. Aim and right click to throw.';
      if (enemies.some(isAlly)) return 'Mind control: it fights for you.';
      if (zones.length) return 'Hex zone: enemies inside turn on each other.';
      return 'Hold click for hex bolts. Right click to lift an enemy.';
    },
    aimLine() { return 360; },
    bodyRing(g, r) { g.strokeStyle = C.bolt; g.globalAlpha = 0.55; g.lineWidth = 3; g.beginPath(); g.arc(0, 0, r - 3, 0, 7); g.stroke(); g.globalAlpha = 1; },
    drawUnder() { drawZones(); },
    drawBefore() { drawControlled(); },
    drawPlayerFx(px, py) { drawHands(px, py); },
    drawOver() {
      for (const b of bolts) {
        ctx.save(); ctx.shadowColor = C.bolt; ctx.shadowBlur = 20; ctx.fillStyle = C.bolt; ctx.beginPath(); ctx.arc(b.x, b.y, 7, 0, 7); ctx.fill();
        ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(b.x, b.y, 3, 0, 7); ctx.fill();
        ctx.strokeStyle = C.bolt; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(b.x, b.y, 10 + Math.sin(time * 25) * 2, time * 12, time * 12 + 3.6); ctx.stroke(); ctx.restore();
      }
    },
    gear,
    api: { state: () => ({ bolts: bolts.length, zones: zones.length, held: !!held }) }       // exposed for the automated tests
  });
})();
