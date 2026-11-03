// CAPTAIN AMERICA: ricocheting shield, block, triple throw, charge, rally, slam, whirlwind and heroic leap.

// Self-contained: everything in this file is private to the hero, except what registerHero() hands to the engine.

(function () {

  let shields = [];


  const capHeld = () => shields.length === 0;

  const capFree = () => capHeld() && player.spin <= 0 && player.charge <= 0 && !player.leap;

  function launchShield(a) {
    const r = player.rally > 0;
    shields.push({
      x: player.x + Math.cos(a) * 20, y: player.y + Math.sin(a) * 20, vx: Math.cos(a), vy: Math.sin(a),
      speed: 980, ang: 0, bounces: 0, max: r ? 6 : 4, age: 0, mode: 'fly', hit: new Set(), dmg: r ? 2 : 1
    });
  }

  // Click: throw. There is no recall. The shield ricochets and flies back on its own.
  function capThrow() {
    if (!capFree()) return;
    launchShield(player.aim); sfx.throw();
  }

  // Q: three shields in a fan
  function castTriple() {
    if (cd.triple > 0 || !capFree()) return;
    cd.triple = 5;
    for (const o of [-0.26, 0, 0.26]) launchShield(player.aim + o);
    sfx.throw(); addShake(3);
  }

  function updateShields(dt) {
    for (const s of shields.slice()) {
      s.ang += 24 * dt;
      if (s.mode === 'return') s.speed = Math.min(1400, s.speed + 2600 * dt);
      const total = s.speed * dt, steps = Math.max(1, Math.ceil(total / 8)), step = total / steps;
      let caught = false;
      for (let i = 0; i < steps && !caught; i++) {
        if (s.mode === 'fly') {
          s.x += s.vx * step; s.y += s.vy * step; s.age += step / s.speed;
          const minX = A.x + 12, maxX = A.x + A.w - 12, minY = A.y + 12, maxY = A.y + A.h - 12;
          let bounced = false;
          if (s.x < minX) { s.x = minX; s.vx = Math.abs(s.vx); bounced = true; }
          else if (s.x > maxX) { s.x = maxX; s.vx = -Math.abs(s.vx); bounced = true; }
          if (s.y < minY) { s.y = minY; s.vy = Math.abs(s.vy); bounced = true; }
          else if (s.y > maxY) { s.y = maxY; s.vy = -Math.abs(s.vy); bounced = true; }
          if (bounced) {                                   // ricochet off the wall
            s.bounces++; s.hit = new Set();
            sfx.clang(); burst(s.x, s.y, 6, '#ffffff', 200, 0.3); addShake(2);
            if (s.bounces >= s.max) s.mode = 'return';
          }
          for (const e of enemies.slice()) {
            if (s.hit.has(e)) continue;
            if (Math.hypot(e.x - s.x, e.y - s.y) < e.r + 14) {
              s.hit.add(e);
              sfx.clang(); hitstop = Math.max(hitstop, 0.03); addShake(3);
              knock(e, s.vx * 260, s.vy * 260, 0.3);
              damage(e, s.dmg);
              let best = null, bd = 420;                   // jump to the nearest enemy it has not touched
              for (const o of enemies) {
                if (o === e || s.hit.has(o)) continue;
                const d = Math.hypot(o.x - s.x, o.y - s.y);
                if (d < bd) { bd = d; best = o; }
              }
              s.bounces++;
              if (best && s.bounces < s.max) {
                const a = Math.atan2(best.y - s.y, best.x - s.x); s.vx = Math.cos(a); s.vy = Math.sin(a);
              } else { s.mode = 'return'; s.hit = new Set(); }
              break;
            }
          }
          killBoltsNear(s.x, s.y, 20);
          if (s.mode === 'fly' && s.age > 2.8) { s.mode = 'return'; s.hit = new Set(); }
          if (s.age > 0.3 && Math.hypot(player.x - s.x, player.y - s.y) < 28) caught = true;   // catches it in passing
        } else {
          const dx = player.x - s.x, dy = player.y - s.y, d = Math.hypot(dx, dy) || 1;
          s.x += dx / d * step; s.y += dy / d * step;
          for (const e of enemies.slice()) {
            if (s.hit.has(e)) continue;
            if (Math.hypot(e.x - s.x, e.y - s.y) < e.r + 14) {
              s.hit.add(e); sfx.clang(); addShake(2);
              knock(e, dx / d * 320, dy / d * 320, 0.3);
              damage(e, 1);
            }
          }
          killBoltsNear(s.x, s.y, 20);
          if (Math.hypot(player.x - s.x, player.y - s.y) < 28) caught = true;
        }
      }
      if (!(s.mode === 'fly' || s.mode === 'return')) s.mode = 'return';
      if (caught) {
        shields.splice(shields.indexOf(s), 1);
        sfx.catch(); ring(player.x, player.y, 50, '#ffffff'); burst(player.x, player.y, 10, '#ffffff', 200, 0.4); addShake(3);
      }
      if (Math.random() < 0.6) particles.push({ x: s.x, y: s.y, vx: 0, vy: 0, life: 0.2, max: 0.2, color: '#ffffff', size: 3 });
    }
  }

  // F: rally. Faster, shield hits harder and bounces more.
  function castRally() {
    if (cd.rally > 0) return;
    cd.rally = 14; player.rally = 6;
    ring(player.x, player.y, 90, '#ffd86b'); burst(player.x, player.y, 26, '#ffd86b', 280, 0.6);
    addShake(4); sfx.rally();
  }

  // R: slam. A ring that stuns and shoves everything nearby.
  function castSlam() {
    if (cd.slam > 0 || !capFree()) return;
    cd.slam = 7;
    shocks.push({ x: player.x, y: player.y, r: 10, max: 150, visual: true, hit: new Set() });
    sfx.shock(); addShake(10); flash = 0.1;
    burst(player.x, player.y, 24, '#ffffff', 300, 0.5);
    for (const e of enemies.slice()) {
      const d = dist(e, player);
      if (d < 150 + e.r) {
        knock(e, (e.x - player.x) / (d || 1) * 700, (e.y - player.y) / (d || 1) * 700, 1.0);
        damage(e, 1);
      }
    }
    killBoltsNear(player.x, player.y, 150);
  }

  // T: whirlwind. The shield spins around you, hitting everything close and swatting shots.
  function castSpin() {
    if (cd.spin > 0 || !capFree()) return;
    cd.spin = 8; player.spin = 1.0; player.spinTick = 0;
    sfx.swing();
  }

  function updateSpin(dt) {
    player.spin -= dt; player.spinAng += dt * 14; player.spinTick -= dt;
    if (player.spinTick <= 0) {
      player.spinTick = 0.16;
      for (const e of enemies.slice()) {
        const d = dist(e, player);
        if (d < e.r + 84) {
          knock(e, (e.x - player.x) / (d || 1) * 450, (e.y - player.y) / (d || 1) * 450, 0.3);
          sfx.clang(); damage(e, 1);
        }
      }
    }
    killBoltsNear(player.x, player.y, 95);
  }

  // E: shield charge. A quick dash with the shield out front.
  function castCharge() {
    if (cd.charge > 0 || !capFree()) return;
    cd.charge = 5; player.charge = 0.28; player.chargeA = player.aim; player.chargeHit = new Set();
    sfx.swing();
  }

  function updateCharge(dt) {
    player.charge -= dt;
    player.x = clamp(player.x + Math.cos(player.chargeA) * 900 * dt, A.x + player.r, A.x + A.w - player.r);
    player.y = clamp(player.y + Math.sin(player.chargeA) * 900 * dt, A.y + player.r, A.y + A.h - player.r);
    player.inv = Math.max(player.inv, 0.2); player.vx = 0; player.vy = 0;
    for (const e of enemies.slice()) {
      if (player.chargeHit.has(e)) continue;
      if (dist(e, player) < e.r + player.r + 12) {
        player.chargeHit.add(e);
        sfx.clang(); hitstop = 0.05; addShake(6);
        knock(e, Math.cos(player.chargeA) * 560, Math.sin(player.chargeA) * 560, 0.6);
        damage(e, player.rally > 0 ? 3 : 2);
      }
    }
    killBoltsNear(player.x, player.y, 40);
    particles.push({ x: player.x, y: player.y, vx: 0, vy: 0, life: 0.25, max: 0.25, color: '#ffffff', size: 6 });
  }

  // G: heroic leap. Jump toward the mouse and land with a shockwave.
  function castLeap() {
    if (cd.leap > 0 || player.leap || player.charge > 0) return;
    cd.leap = 9;
    const dx = mouse.x - player.x, dy = mouse.y - player.y, d = Math.hypot(dx, dy) || 1, reach = Math.min(d, 430);
    player.leap = {
      t: 0, dur: 0.4, sx: player.x, sy: player.y,
      tx: clamp(player.x + dx / d * reach, A.x + player.r, A.x + A.w - player.r),
      ty: clamp(player.y + dy / d * reach, A.y + player.r, A.y + A.h - player.r)
    };
    player.spin = 0; sfx.throw();
  }

  function drawShield(x, y, r, ang) {                              // Cap's shield: red, white, red, blue with a star
    ctx.save(); ctx.translate(x, y); ctx.rotate(ang);
    ctx.fillStyle = '#c42f2f'; ctx.beginPath(); ctx.arc(0, 0, r, 0, 7); ctx.fill();
    ctx.fillStyle = '#f2f2f2'; ctx.beginPath(); ctx.arc(0, 0, r * 0.76, 0, 7); ctx.fill();
    ctx.fillStyle = '#c42f2f'; ctx.beginPath(); ctx.arc(0, 0, r * 0.56, 0, 7); ctx.fill();
    ctx.fillStyle = '#254a99'; ctx.beginPath(); ctx.arc(0, 0, r * 0.4, 0, 7); ctx.fill();
    star(ctx, 0, 0, r * 0.36, '#f2f2f2');
    ctx.restore();
  }

  registerHero({
    id: 'cap', name: 'Captain America', team: 'avengers', order: 2, modern: true,
    blurb: 'Super soldier. Ricocheting shield, blocks and charges.',
    look: {
      capeLab: 'Suit', cape: '#3a6fc9', fx: '#ffffff', hair: '#e0c067',
      gears: ['Cowl', 'Bare head', 'Star helmet'],
      help: '<b>Click</b> throws the shield. It ricochets off walls, jumps between enemies, then flies back and you catch it. There is no recall. <b>Hold right click</b> to block and bounce shots back. <b>Q</b> triple throw, <b>E</b> shield charge, <b>F</b> rally, <b>R</b> slam, <b>T</b> whirlwind, <b>G</b> heroic leap. WASD to move, mouse to aim, <b>P</b> to pause.',
      keys: ['Click: throw shield (it bounces back)     Hold right click: block', 'Q triple throw     E shield charge     F rally', 'R slam     T whirlwind     G heroic leap']
    },
    cd: { triple: 0, charge: 0, rally: 0, slam: 0, spin: 0, leap: 0 },
    init: () => ({ block: false, spin: 0, spinAng: 0, spinTick: 0, charge: 0, chargeA: 0, chargeHit: new Set(), rally: 0 }),
    reset() {
      shields = [];
    },
    onKey(code, e) {
      if (code === 'KeyQ') castTriple();
      if (code === 'KeyE') castCharge();
      if (code === 'KeyF') castRally();
      if (code === 'KeyR') castSlam();
      if (code === 'KeyT') castSpin();
      if (code === 'KeyG') castLeap();
    },
    onMouse(button) { if (button === 2) mouse.rdown = true; else capThrow(); },
    preMove(dt) {
      if (player.rally > 0) player.rally = Math.max(0, player.rally - dt);
      player.block = mouse.rdown && capFree();
      return {};
    },
    speed() { return 245 * (player.rally > 0 ? 1.3 : 1) * (player.block ? 0.55 : 1); },
    update(dt) {
      if (player.spin > 0) updateSpin(dt);
      updateShields(dt);
    },
    onHurt(h) {
      if (!h.noBlock && player.block) {                                // the shield blocks anything from the front
        const ang = Math.atan2(h.sy - player.y, h.sx - player.x);
        if (Math.abs(wrap(ang - player.aim)) < 1.2) {
          if (h.src) { const d = dist(h.src, player) || 1; knock(h.src, (h.src.x - player.x) / d * 520, (h.src.y - player.y) / d * 520, 0.5); }
          ring(player.x + Math.cos(player.aim) * 24, player.y + Math.sin(player.aim) * 24, 40, '#ffffff');
          burst(player.x + Math.cos(player.aim) * 24, player.y + Math.sin(player.aim) * 24, 8, '#ffffff', 220, 0.3);
          sfx.block(); addShake(4); player.inv = 0.2;
          return true;
        }
      }
      return false;
    },
    onBolt(b) {
      if (player.block && Math.hypot(player.x - b.x, player.y - b.y) < player.r + 26 &&
          Math.abs(wrap(Math.atan2(b.y - player.y, b.x - player.x) - player.aim)) < 1.2) {
        b.vx = -b.vx * 1.3; b.vy = -b.vy * 1.3; b.friendly = true; b.life = 2;       // reflect it
        sfx.block(); ring(b.x, b.y, 30, '#ffffff'); addShake(3);
        return 'reflected';
      }
      return null;
    },
    skills() {
      return [
        { k: 'M1', n: 'Throw',    cd: 0,         max: 1,  ok: capFree() },
        { k: 'RMB', n: 'Block',   cd: 0,         max: 1,  ok: capFree() },
        { k: 'Q', n: 'Triple',    cd: cd.triple, max: 5,  ok: capFree() },
        { k: 'E', n: 'Charge',    cd: cd.charge, max: 5,  ok: capFree() },
        { k: 'F', n: 'Rally',     cd: cd.rally,  max: 14, ok: true },
        { k: 'R', n: 'Slam',      cd: cd.slam,   max: 7,  ok: capFree() },
        { k: 'T', n: 'Whirl',     cd: cd.spin,   max: 8,  ok: capFree() },
        { k: 'G', n: 'Leap',      cd: cd.leap,   max: 9,  ok: !player.leap }
      ];
    },
    message() {
      let msg;
      if (shields.length) msg = 'Shield out. It ricochets and comes back to you.';
      else if (player.block) msg = 'Blocking. Shots bounce back.';
      else if (player.spin > 0) msg = 'Whirlwind!';
      else if (player.rally > 0) msg = 'Rallied ' + player.rally.toFixed(1) + 's. Faster, harder hits.';
      else msg = 'Click to throw the shield, hold right click to block.';
      return msg;
    },
    aimLine() { return capHeld() && !player.block ? 520 : 0; },
    drawPlayerUnder(px, py) {
      if (player.rally > 0) {                                           // rally aura
        ctx.strokeStyle = `rgba(255,216,107,${0.4 + 0.2 * Math.sin(time * 8)})`; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(px, py, player.r + 9, 0, 7); ctx.stroke();
      }
    },
    drawPlayerFx(px, py) {
      if (capHeld()) {                                                  // the shield in hand, blocking, or spinning
        if (player.spin > 0) {
          drawShield(px + Math.cos(player.spinAng) * 56, py + Math.sin(player.spinAng) * 56, 17, player.spinAng * 2);
          ctx.save(); ctx.lineCap = 'round';
          for (let i = 0; i < 10; i++) {
            const t0 = i / 10, t1 = (i + 1) / 10;
            ctx.strokeStyle = 'rgba(255,255,255,' + (0.04 + 0.4 * t1 * t1) + ')'; ctx.lineWidth = 2 + 6 * t1;
            ctx.beginPath(); ctx.arc(px, py, 56, player.spinAng - 1.8 * (1 - t0), player.spinAng - 1.8 * (1 - t1)); ctx.stroke();
          }
          ctx.restore();
        } else if (player.block) {
          ctx.save(); ctx.shadowColor = '#ffffff'; ctx.shadowBlur = 16; ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 5;
          ctx.beginPath(); ctx.arc(px, py, 34, player.aim - 1.1, player.aim + 1.1); ctx.stroke(); ctx.restore();
          drawShield(px + Math.cos(player.aim) * 26, py + Math.sin(player.aim) * 26, 19, player.aim);
        } else {
          drawShield(px + Math.cos(player.aim + 1.25) * (player.r + 6), py + Math.sin(player.aim + 1.25) * (player.r + 6), 12, player.aim);
        }
      }
    },
    drawOver() {
      // thrown shields
      for (const s of shields) {
        ctx.save(); ctx.shadowColor = '#ffffff'; ctx.shadowBlur = 12;
        drawShield(s.x, s.y, 16, s.ang);
        ctx.restore();
      }
    },
    bodyRing(g, r, unsuited) {
      g.strokeStyle = '#f2f2f2'; g.lineWidth = 2; g.beginPath(); g.arc(0, 0, r, 0, 7); g.stroke();
    },
    gear(g, c) {
      const { r, hr, gear, unsuited } = c; const ch = look.char;
      if (gear === 0) {                                            // cowl with wings and the A marker
        g.fillStyle = '#2e5aa8'; g.beginPath(); g.arc(0, 0, hr + 1, 0, 7); g.fill();
        g.fillStyle = '#f2f2f2';
        for (const s of [-1, 1]) {
          g.beginPath(); g.moveTo(-hr * 0.2, s * hr); g.lineTo(-hr * 0.85, s * (hr + 7)); g.lineTo(hr * 0.1, s * (hr + 2)); g.closePath(); g.fill();
        }
        g.beginPath(); g.moveTo(hr * 0.8, 0); g.lineTo(hr * 0.2, -4); g.lineTo(hr * 0.2, 4); g.closePath(); g.fill();
      } else if (gear === 2) {                                     // star helmet
        g.fillStyle = '#1f3d7a'; g.beginPath(); g.arc(0, 0, hr + 1, 0, 7); g.fill();
        star(g, 0, 0, hr * 0.7, '#f2f2f2');
      }
    },
    api: { shieldCount: () => shields.length },                                   // exposed for the automated tests
  });

  registerForcedState(20, () => player.charge > 0, updateCharge);

})();
