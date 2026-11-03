// THOR: Mjolnir throw and recall, boomerang, spin swing, fly-to-hammer, shockwave, lightning beam, smite and storm.

// Self-contained: everything in this file is private to the hero, except what registerHero() hands to the engine.

(function () {

  let laser = null, storm = null, pend = [];


  function handPos() {
    return { x: player.x + Math.cos(player.aim) * 22, y: player.y + Math.sin(player.aim) * 22 };
  }

  function throwHammer() {
    const h = handPos();
    hammer.mode = 'flying';
    hammer.x = h.x; hammer.y = h.y;
    hammer.speed = 950;
    hammer.vx = Math.cos(player.aim); hammer.vy = Math.sin(player.aim);
    hammer.dist = 0; hammer.carried = null; hammer.pinned = null; hammer.hit = new Set();
    player.swing = 0;
    sfx.throw();
  }

  // Q: curved loop out and back, hits things on both legs
  function throwBoomerang(side) {
    if (hammer.mode !== 'held' || cd.boom > 0) return;
    cd.boom = 3; player.swing = 0;
    const p = handPos();
    hammer.mode = 'boomerang';
    hammer.x = p.x; hammer.y = p.y;
    hammer.speed = 760; hammer.side = side; hammer.omega = 760 / 170;
    hammer.hd = player.aim - side * 1.25;
    hammer.turned = 0; hammer.reset = false; hammer.dist = 0;
    hammer.hit = new Set(); hammer.carried = null; hammer.pinned = null;
    sfx.throw();
  }

  // Right click: spin the hammer around you (also swats enemy bolts away)
  function startSwing() {
    if (hammer.mode !== 'held' || cd.swing > 0 || player.swing > 0) return;
    player.swing = 0.42; player.swingA0 = player.aim; player.swingAng = player.aim;
    player.swingHit = new Set(); cd.swing = 0.55;
    sfx.swing();
  }

  function updateSwing(dt) {
    player.swing -= dt;
    const p = 1 - Math.max(0, player.swing) / 0.42, ep = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;   // eases in and out
    const a = player.swingA0 + ep * Math.PI * 2;
    player.swingAng = a;
    for (const e of enemies.slice()) {
      if (player.swingHit.has(e)) continue;
      if (dist(e, player) > e.r + 88) continue;
      const diff = wrap(Math.atan2(e.y - player.y, e.x - player.x) - a);
      if (Math.abs(diff) < 0.8) {
        player.swingHit.add(e);
        sfx.hit(); hitstop = 0.04; addShake(4);
        const d = dist(e, player) || 1;
        knock(e, (e.x - player.x) / d * 520, (e.y - player.y) / d * 520, 0.4);
        damage(e, 1);
      }
    }
    killBoltsNear(player.x, player.y, 90);
  }

  // E: dash to a lodged hammer, hitting whatever is in the way
  function startPull() {
    if (hammer.mode !== 'lodged' || cd.pull > 0 || player.pull) return;
    cd.pull = 2; player.pull = true; player.pullHit = new Set(); player.swing = 0;
    sfx.recall();
  }

  function updatePull(dt) {
    const dx = hammer.x - player.x, dy = hammer.y - player.y, d = Math.hypot(dx, dy) || 1;
    const total = 1300 * dt, steps = Math.max(1, Math.ceil(total / 10)), step = total / steps;
    for (let s = 0; s < steps; s++) {
      player.x += dx / d * step; player.y += dy / d * step;
      for (const e of enemies.slice()) {
        if (player.pullHit.has(e)) continue;
        if (dist(e, player) < e.r + player.r + 8) {
          player.pullHit.add(e);
          sfx.hit(); hitstop = 0.04; addShake(5);
          knock(e, dx / d * 380, dy / d * 380, 0.4);
          damage(e, 1);
        }
      }
      if (Math.hypot(hammer.x - player.x, hammer.y - player.y) < 30) {
        player.pull = false; catchHammer(); return;
      }
    }
    player.inv = Math.max(player.inv, 0.2);
    particles.push({ x: player.x, y: player.y, vx: 0, vy: 0, life: 0.3, max: 0.3, color: C.bolt, size: 5 });
  }

  // R: shockwave ring expanding out from the player (also erases enemy bolts)
  function castShock() {
    if (cd.shock > 0) return;
    cd.shock = 5;
    shocks.push({ x: player.x, y: player.y, r: 10, max: 200, hit: new Set() });
    sfx.shock(); addShake(8); flash = 0.1;
    burst(player.x, player.y, 20, C.bolt, 300, 0.5);
  }

  function laserLine() {
    const a = Math.atan2(mouse.y - hammer.y, mouse.x - hammer.x);
    const e = rayEnd(hammer.x, hammer.y, a);
    return { x1: hammer.x, y1: hammer.y, x2: e.x, y2: e.y };
  }

  function fireLaser() {
    if (cd.laser > 0 || laser) return;
    cd.laser = 7; laser = { t: 0.7, tick: 0 };
    sfx.laser();
  }

  function updateLaser(dt) {
    laser.t -= dt; laser.tick -= dt; addShake(3);
    if (laser.tick <= 0) {
      laser.tick = 0.18;
      const L = laserLine();
      for (const e of enemies.slice()) {
        if (segDist(e.x, e.y, L.x1, L.y1, L.x2, L.y2) < e.r + 9) {
          burst(e.x, e.y, 6, C.bolt, 220, 0.3);
          knock(e, 0, 0, 0.3);
          damage(e, 1);
        }
      }
    }
    if (laser.t <= 0) laser = null;
  }

  // F: lightning strikes the hammer's position
  function smite() {
    if (hammer.mode === 'held' || cd.smite > 0) return;
    cd.smite = 6;
    const x = hammer.x, y = hammer.y;
    strikes.push({ x, y, life: 0.3, max: 0.3 });
    sfx.smite(); addShake(14); hitstop = 0.1; flash = 0.35;
    ring(x, y, 140, '#ffffff'); ring(x, y, 90, C.bolt); burst(x, y, 40, C.bolt, 420, 0.7);
    for (const e of enemies.slice()) {
      const d = Math.hypot(e.x - x, e.y - y);
      if (d < 140) {
        knock(e, (e.x - x) / (d || 1) * 380, (e.y - y) / (d || 1) * 380, 0.9);
        damage(e, 2);
      }
    }
  }

  // G: Storm Call. Marks several targets, then lightning lands on each one.
  function castStorm() {
    if (cd.storm > 0 || storm) return;
    cd.storm = 12; storm = { left: 7, next: 0 };
    flash = 0.2; sfx.storm();
  }

  function strikeAt(x, y, r, dmg) {
    strikes.push({ x, y, life: 0.3, max: 0.3 });
    ring(x, y, r, '#ffffff'); burst(x, y, 20, C.bolt, 360, 0.5);
    addShake(7); sfx.thunder();
    for (const e of enemies.slice()) {
      const d = Math.hypot(e.x - x, e.y - y);
      if (d < r + e.r) {
        knock(e, (e.x - x) / (d || 1) * 300, (e.y - y) / (d || 1) * 300, 0.6);
        damage(e, dmg);
      }
    }
  }

  function updateStorm(dt) {
    if (storm) {
      storm.next -= dt;
      while (storm && storm.left > 0 && storm.next <= 0) {
        storm.left--; storm.next += 0.2;
        let x, y, tgt = null;
        if (enemies.length) { tgt = enemies[Math.floor(Math.random() * enemies.length)]; x = tgt.x; y = tgt.y; }
        else {
          x = clamp(mouse.x + (Math.random() - 0.5) * 260, A.x + 30, A.x + A.w - 30);
          y = clamp(mouse.y + (Math.random() - 0.5) * 260, A.y + 30, A.y + A.h - 30);
        }
        pend.push({ x, y, tgt, t: 0.45 });
        if (storm.left <= 0) storm = null;
      }
    }
    for (const p of pend.slice()) {
      p.t -= dt;
      if (p.tgt && enemies.includes(p.tgt)) { p.x = p.tgt.x; p.y = p.tgt.y; }   // lock on to the target
      if (p.t <= 0) { strikeAt(p.x, p.y, 70, 2); pend.splice(pend.indexOf(p), 1); }
    }
  }

  function recall() {
    if (hammer.mode === 'held' || hammer.mode === 'returning') return;
    player.pull = false;
    if (hammer.carried) { hammer.carried.stun = 0.5; hammer.carried = null; }
    if (hammer.pinned) { hammer.pinned.pinned = false; hammer.pinned.stun = 0.6; hammer.pinned = null; }
    hammer.mode = 'returning';
    hammer.speed = 450;
    hammer.hit = new Set();
    hammer.rt = 0;
    hammer.from = dist(hammer, player);
    // curve the return toward whichever side of the line the mouse is on
    const toP = Math.atan2(player.y - hammer.y, player.x - hammer.x);
    const cross = (player.x - hammer.x) * (mouse.y - hammer.y) - (player.y - hammer.y) * (mouse.x - hammer.x);
    hammer.hd = toP + (cross >= 0 ? 1 : -1) * 1.2;
    sfx.recall();
    ring(hammer.x, hammer.y, 50, C.bolt);
    burst(hammer.x, hammer.y, 14, C.bolt, 240, 0.4);
  }

  function lodge(clampX, clampY) {
    hammer.mode = 'lodged';
    hammer.x = clampX; hammer.y = clampY;
    const e = hammer.carried;
    if (e) {
      e.x = hammer.x; e.y = hammer.y;
      e.pinned = true; hammer.pinned = e; hammer.carried = null;
      sfx.slam(); addShake(11); hitstop = 0.1; flash = 0.25;
      ring(e.x, e.y, 90, C.bolt); burst(e.x, e.y, 26, C.bolt, 340, 0.6);
      damage(e, 2);   // wall slam bonus
    } else {
      sfx.hit(); addShake(4);
      burst(hammer.x, hammer.y, 10, C.iron, 200, 0.4);
    }
  }

  function updateHammer(dt) {
    const h = hammer;
    if (h.mode === 'held') {
      if (player.swing > 0) {
        const a = player.swingAng;
        h.x = player.x + Math.cos(a) * 58; h.y = player.y + Math.sin(a) * 58; h.angle = a + Math.PI;
      } else {
        const p = handPos(); h.x = p.x; h.y = p.y; h.angle = player.aim + Math.PI;
      }
      return;
    }
    if (h.mode === 'lodged') return;

    // sub-steps so fast projectiles never skip an enemy or wall
    const total = h.speed * dt;
    const steps = Math.max(1, Math.ceil(total / 8));
    const step = total / steps;

    for (let s = 0; s < steps; s++) {
      if (h.mode === 'flying') {
        h.x += h.vx * step; h.y += h.vy * step; h.dist += step;
        if (h.carried) { h.carried.x = h.x + h.vx * 10; h.carried.y = h.y + h.vy * 10; }

        for (const e of enemies.slice()) {
          if (e === h.carried || h.hit.has(e)) continue;
          if (Math.hypot(e.x - h.x, e.y - h.y) < e.r + 12) {
            h.hit.add(e);
            sfx.hit(); hitstop = 0.05; addShake(5);
            ring(e.x, e.y, 40, C.ember);
            const dead = damage(e, 1);
            if (!dead) {
              if (!h.carried) h.carried = e;                 // first enemy gets carried
              else { e.kx = -h.vy * 380; e.ky = h.vx * 380; e.stun = 0.5; }   // others are batted aside
            }
          }
        }
        const minX = A.x + 10, maxX = A.x + A.w - 10, minY = A.y + 10, maxY = A.y + A.h - 10;
        if (h.x < minX || h.x > maxX || h.y < minY || h.y > maxY) {
          lodge(clamp(h.x, minX, maxX), clamp(h.y, minY, maxY));
          return;
        }
        if (h.dist > 700) {
          if (h.carried) { h.carried.stun = 1; h.carried = null; }
          lodge(h.x, h.y);
          return;
        }
      } else if (h.mode === 'boomerang') {
        const dh = h.side * h.omega * (step / h.speed);
        h.hd += dh; h.turned += Math.abs(dh);
        h.x += Math.cos(h.hd) * step; h.y += Math.sin(h.hd) * step;
        // slide along walls instead of sticking
        const bx = clamp(h.x, A.x + 10, A.x + A.w - 10);
        const by = clamp(h.y, A.y + 10, A.y + A.h - 10);
        if (bx !== h.x || by !== h.y) { h.x = bx; h.y = by; if (Math.random() < 0.3) burst(h.x, h.y, 2, C.iron, 120, 0.25); }

        for (const e of enemies.slice()) {
          if (h.hit.has(e)) continue;
          if (Math.hypot(e.x - h.x, e.y - h.y) < e.r + 14) {
            h.hit.add(e);
            sfx.hit(); hitstop = 0.04; addShake(4);
            knock(e, Math.cos(h.hd + h.side * Math.PI / 2) * 380, Math.sin(h.hd + h.side * Math.PI / 2) * 380, 0.3);
            damage(e, 1);
          }
        }
        if (h.turned > Math.PI && !h.reset) { h.hit = new Set(); h.reset = true; }   // can hit again on the way back
        if (h.turned > 5.2) {
          h.mode = 'returning'; h.hit = new Set(); h.speed = 760; h.rt = 2;
          sfx.recall();
        }
      } else if (h.mode === 'returning') {
        const dx = player.x - h.x, dy = player.y - h.y, d = Math.hypot(dx, dy) || 1;
        const want = Math.atan2(dy, dx);
        if (h.rt > 1.2 || d < 90) h.hd = want;                       // straighten out so it always arrives
        else {
          const maxTurn = (5 + h.rt * 14) * (step / h.speed);
          h.hd += Math.max(-maxTurn, Math.min(maxTurn, wrap(want - h.hd)));
        }
        h.x += Math.cos(h.hd) * step; h.y += Math.sin(h.hd) * step;
        h.x = clamp(h.x, A.x + 10, A.x + A.w - 10);
        h.y = clamp(h.y, A.y + 10, A.y + A.h - 10);

        for (const e of enemies.slice()) {
          if (h.hit.has(e)) continue;
          if (Math.hypot(e.x - h.x, e.y - h.y) < e.r + 14) {
            h.hit.add(e);
            sfx.hit(); hitstop = 0.04; addShake(4);
            knock(e, Math.cos(h.hd) * 420, Math.sin(h.hd) * 420, 0.35);   // yanked along behind it
            damage(e, 1);
          }
        }
        if (Math.hypot(player.x - h.x, player.y - h.y) < 30) { catchHammer(); return; }
      }
    }

    if (h.mode === 'returning') { h.speed = Math.min(1500, h.speed + 2600 * dt); h.rt += dt; }
    h.angle += (h.mode === 'returning' ? 28 : 22) * dt;

    if (Math.random() < 0.9) {
      particles.push({
        x: h.x, y: h.y, vx: (Math.random() - 0.5) * 60, vy: (Math.random() - 0.5) * 60,
        life: 0.3, max: 0.3, color: C.bolt, size: 2 + Math.random() * 2
      });
    }
  }

  function catchHammer() {
    const h = hammer;
    h.mode = 'held';
    if (h.pinned) { h.pinned.pinned = false; h.pinned.stun = 0.6; h.pinned = null; }
    sfx.catch(); hitstop = 0.06; addShake(calm ? 3 : 7); flash = 0.12;
    ring(player.x, player.y, 110, C.bolt);
    burst(player.x, player.y, 18, C.bolt, 300, 0.5);
    for (const e of enemies.slice()) {      // close-range shockwave
      const d = dist(e, player);
      if (d < 110) {
        const nx = (e.x - player.x) / (d || 1), ny = (e.y - player.y) / (d || 1);
        e.kx = nx * 420; e.ky = ny * 420; e.stun = 0.5;
        damage(e, 1);
      }
    }
  }

  function drawHammer(x, y, ang, glow) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(ang);
    if (glow) { ctx.shadowColor = C.bolt; ctx.shadowBlur = 18; }
    ctx.fillStyle = '#5a4632'; ctx.fillRect(-4, -3, 30, 6);            // handle
    ctx.fillStyle = '#2b2118'; ctx.fillRect(14, -3, 3, 6);              // leather wrap
    ctx.fillStyle = '#7d8996'; ctx.fillRect(-14, -9, 18, 18);           // head
    ctx.fillStyle = '#aab6c2'; ctx.fillRect(-14, -9, 18, 5);            // highlight
    ctx.strokeStyle = '#3c4651'; ctx.lineWidth = 1.5; ctx.strokeRect(-14, -9, 18, 18);
    ctx.restore();
  }

  registerHero({
    id: 'thor', name: 'Thor', team: 'avengers', order: 1,
    blurb: 'God of Thunder. Hammer, lightning and storms.',
    look: {
      capeLab: 'Cape', cape: '#c93a3a', fx: '#a8ecff', hair: '#e0c067',
      gears: ['Winged helm', 'Crown', 'Bare head'],
      help: '<b>Click</b> throws Mjolnir (click again or <b>Space</b> to recall). <b>Right click</b> spins it around you. <b>Q</b> boomerang, <b>E</b> fly to a stuck hammer, <b>F</b> smite it, <b>R</b> shockwave, <b>T</b> lightning beam, <b>G</b> storm call. WASD to move, mouse to aim, <b>P</b> to pause.',
      keys: ['Click: throw / recall     Space: recall     Right click: spin swing', 'Q boomerang     E fly to hammer     F smite', 'R shockwave     T lightning beam     G storm call']
    },
    cd: { boom: 0, pull: 0, smite: 0, swing: 0, shock: 0, laser: 0, storm: 0 },
    init: () => ({ swing: 0, swingA0: 0, swingAng: 0, swingHit: new Set(), pull: false, pullHit: new Set() }),
    reset() {
      hammer = {
        mode: 'held', x: 0, y: 0, vx: 0, vy: 0, speed: 0, angle: 0, dist: 0, carried: null, pinned: null,
        hit: new Set(), from: 0, hd: 0, turned: 0, side: 1, omega: 4, reset: false, rt: 0
      };
      laser = null; storm = null; pend = [];
    },
    onKeyAny(code) { if (code === 'Space') recall(); },
    onKey(code, e) {
      if (code === 'KeyQ') throwBoomerang(e.shiftKey ? -1 : 1);
      if (code === 'KeyE') startPull();
      if (code === 'KeyF') smite();
      if (code === 'KeyR') castShock();
      if (code === 'KeyT') fireLaser();
      if (code === 'KeyG') castStorm();
    },
    onMouse(button) {
      if (button === 2) { if (hammer.mode === 'held') startSwing(); else recall(); return; }
      if (hammer.mode === 'held') throwHammer(); else recall();
    },
    preMove() { return { noSlip: !!player.pull }; },
    speed() { return player.pull ? 0 : 240; },
    update(dt) {
      if (player.pull) updatePull(dt);
      if (player.swing > 0) updateSwing(dt);
      updateHammer(dt);
      if (laser) updateLaser(dt);
      if (storm || pend.length) updateStorm(dt);
    },
    skills() {
      return [
        { k: 'Q', n: 'Boomerang', cd: cd.boom,  max: 3,  ok: hammer.mode === 'held' },
        { k: 'E', n: 'Fly',       cd: cd.pull,  max: 2,  ok: hammer.mode === 'lodged' },
        { k: 'F', n: 'Smite',     cd: cd.smite, max: 6,  ok: hammer.mode !== 'held' },
        { k: 'R', n: 'Shock',     cd: cd.shock, max: 5,  ok: true },
        { k: 'T', n: 'Laser',     cd: cd.laser, max: 7,  ok: !laser },
        { k: 'G', n: 'Storm',     cd: cd.storm, max: 12, ok: !storm }
      ];
    },
    message() {
      let msg;
      msg = storm ? 'Storm Call. Lightning incoming.' : {
        held: 'Click to throw, right click to swing.',
        flying: 'Click or Space to recall.',
        boomerang: 'Boomerang out. Click or Space to recall.',
        lodged: hammer.pinned ? 'Enemy pinned. E flies you to it, F smites it.' : 'Hammer stuck. E flies you to it, F smites it.',
        returning: 'Mjolnir returning.'
      }[hammer.mode];
      return msg;
    },
    aimLine() { return hammer.mode === 'held' ? 700 : 0; },
    drawUnder() {
      // storm darkening and strike markers
      if (storm || pend.length) {
        ctx.fillStyle = 'rgba(5,10,22,0.2)'; ctx.fillRect(A.x, A.y, A.w, A.h);
        for (const p of pend) {
          const k = 1 - p.t / 0.45;
          ctx.save(); ctx.strokeStyle = fx(0.5 + 0.4 * k); ctx.lineWidth = 2; ctx.setLineDash([5, 5]);
          ctx.beginPath(); ctx.arc(p.x, p.y, 70, 0, 7); ctx.stroke(); ctx.setLineDash([]);
          ctx.fillStyle = fx(0.10 + 0.25 * k); ctx.beginPath(); ctx.arc(p.x, p.y, 70 * k, 0, 7); ctx.fill();
          ctx.beginPath(); ctx.moveTo(p.x - 12, p.y); ctx.lineTo(p.x + 12, p.y); ctx.moveTo(p.x, p.y - 12); ctx.lineTo(p.x, p.y + 12); ctx.stroke();
          ctx.restore();
        }
      }
      // swing trail: a comet tail that fades out behind the hammer
      if (player.swing > 0) {
        const tail = Math.min(player.swingAng - player.swingA0, 2.1);
        ctx.save(); ctx.lineCap = 'round'; ctx.shadowColor = C.bolt; ctx.shadowBlur = 14;
        for (let i = 0; i < 12; i++) {
          const t0 = i / 12, t1 = (i + 1) / 12;
          ctx.strokeStyle = fx(0.04 + 0.5 * t1 * t1); ctx.lineWidth = 3 + 9 * t1;
          ctx.beginPath(); ctx.arc(player.x, player.y, 58, player.swingAng - tail * (1 - t0), player.swingAng - tail * (1 - t1)); ctx.stroke();
        }
        ctx.restore();
      }
      // fly-to-hammer lightning
      if (player.pull) {
        ctx.save(); ctx.shadowColor = C.bolt; ctx.shadowBlur = 14;
        bolt(player.x, player.y, hammer.x, hammer.y, 18, fx(0.7), 2);
        ctx.restore();
      }

      // recall lightning
      if (hammer.mode === 'returning') {
        ctx.shadowColor = C.bolt; ctx.shadowBlur = 14;
        bolt(hammer.x, hammer.y, player.x, player.y, 26, fx(0.55), 2);
        bolt(hammer.x, hammer.y, player.x, player.y, 14, 'rgba(255,255,255,0.8)', 1);
        ctx.shadowBlur = 0;
      }
    },
    drawOver() {
      drawHammer(hammer.x, hammer.y, hammer.angle, hammer.mode !== 'lodged');
      // lightning laser
      if (laser) {
        const Ln = laserLine(), a = Math.min(1, laser.t / 0.15);
        ctx.save(); ctx.globalAlpha = a; ctx.shadowColor = C.bolt; ctx.shadowBlur = 28; ctx.lineCap = 'round';
        bolt(Ln.x1, Ln.y1, Ln.x2, Ln.y2, 14, fx(0.9), 10 + Math.random() * 4);
        ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 4;
        ctx.beginPath(); ctx.moveTo(Ln.x1, Ln.y1); ctx.lineTo(Ln.x2, Ln.y2); ctx.stroke();
        ctx.restore();
      }
    },
    gear(g, c) {
      const { r, hr, gear, unsuited } = c; const ch = look.char;
      if (gear === 0) {                                            // winged helm
        g.fillStyle = '#aab6c2'; g.beginPath(); g.arc(0, 0, r - 6, 0, 7); g.fill();
        g.fillStyle = '#eef2f6';
        for (const s of [-1, 1]) {
          g.beginPath(); g.moveTo(-2, s * (r - 5)); g.lineTo(-r * 0.9, s * (r + 9)); g.lineTo(r * 0.2, s * (r + 3)); g.closePath(); g.fill();
        }
      } else if (gear === 1) {                                     // crown
        g.strokeStyle = '#e0b83c'; g.lineWidth = 4; g.setLineDash([4, 3]);
        g.beginPath(); g.arc(0, 0, r - 5, 0, 7); g.stroke(); g.setLineDash([]);
      }
    },
  });

})();
