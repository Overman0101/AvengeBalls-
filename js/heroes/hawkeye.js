// HAWKEYE: arrows, triple / explosive / shock / grapple arrows, arrow rain, rapid volley and a dodge roll.

// Self-contained: everything in this file is private to the hero, except what registerHero() hands to the engine.

(function () {

  let arrows = [], rains = [], drops = [];


  function spawnArrow(a, kind, o) {
    o = o || {};
    arrows.push({
      x: player.x + Math.cos(a) * 20, y: player.y + Math.sin(a) * 20, ang: a,
      vx: Math.cos(a) * (o.speed || 1500), vy: Math.sin(a) * (o.speed || 1500),
      kind, dmg: o.dmg || 2, life: 1.2, hit: new Set(), pierce: o.pierce || 0
    });
  }

  // Click (hold): one fast, accurate arrow
  function fireArrow() {
    if (cd.arrow > 0 || player.zip || player.roll > 0) return;
    cd.arrow = 0.4; spawnArrow(player.aim, 'normal', { dmg: 2 }); sfx.arrow();
  }

  // Q: three arrows in a fan
  function castTripleArrow() {
    if (cd.atriple > 0 || player.zip) return;
    cd.atriple = 5;
    for (const o of [-0.16, 0, 0.16]) spawnArrow(player.aim + o, 'normal', { dmg: 1.5 });
    sfx.arrow(); addShake(2);
  }

  // E: explosive arrow
  function castExplosive() {
    if (cd.aexp > 0 || player.zip) return;
    cd.aexp = 6; spawnArrow(player.aim, 'explosive', { dmg: 1, speed: 1100 }); sfx.arrow();
  }

  // F: shock arrow. Stuns what it hits and the lightning jumps to nearby enemies.
  function castShockArrow() {
    if (cd.ashock > 0 || player.zip) return;
    cd.ashock = 7; spawnArrow(player.aim, 'shock', { dmg: 1, speed: 1300 }); sfx.arrow();
  }

  // R: grappling arrow. Zips you to the wall it hits.
  function castGrapple() {
    if (cd.agrap > 0 || player.zip || arrows.some(a => a.kind === 'grapple')) return;
    cd.agrap = 5; spawnArrow(player.aim, 'grapple', { dmg: 0, speed: 1500 }); sfx.grapple();
  }

  // T: arrow rain on the spot you aim at
  function castRain() {
    if (cd.arain > 0 || player.zip) return;
    cd.arain = 10;
    rains.push({ x: clamp(mouse.x, A.x + 40, A.x + A.w - 40), y: clamp(mouse.y, A.y + 40, A.y + A.h - 40), t: 0.5, left: 14, next: 0 });
    sfx.arrow();
  }

  function arrowHit(a, e) {
    if (a.kind === 'explosive') { explodeAt(a.x, a.y, 80, 3, '#ff9a4d'); return; }
    sfx.hit(); burst(e.x, e.y, 6, C.bolt, 200, 0.3); hitstop = Math.max(hitstop, 0.03);
    if (a.kind === 'shock') {
      sfx.zap(); ring(e.x, e.y, 55, C.bolt);
      knock(e, 0, 0, 1.2); damage(e, a.dmg); chainArcs(e, 3, 170, 1.0, 1);
    } else {
      knock(e, a.vx * 0.08, a.vy * 0.08, 0.15); damage(e, a.dmg);
    }
  }

  function arrowWall(a) {
    const x = clamp(a.x, A.x, A.x + A.w), y = clamp(a.y, A.y, A.y + A.h);
    if (a.kind === 'explosive') explodeAt(x, y, 80, 3, '#ff9a4d');
    else if (a.kind === 'grapple') {
      player.zip = { tx: clamp(x, A.x + player.r, A.x + A.w - player.r), ty: clamp(y, A.y + player.r, A.y + A.h - player.r), hit: new Set() };
      ring(x, y, 40, '#ffffff'); sfx.grapple();
    } else { burst(x, y, 5, C.bolt, 160, 0.25); if (a.kind === 'shock') ring(x, y, 40, C.bolt); }
  }

  function updateArrows(dt) {
    for (const a of arrows.slice()) {
      const total = Math.hypot(a.vx, a.vy) * dt, steps = Math.max(1, Math.ceil(total / 10));
      let gone = false;
      for (let s = 0; s < steps && !gone; s++) {
        a.x += a.vx * dt / steps; a.y += a.vy * dt / steps;
        if (a.kind !== 'grapple') {
          for (const e of enemies.slice()) {
            if (a.hit.has(e) || Math.hypot(e.x - a.x, e.y - a.y) >= e.r + 5) continue;
            a.hit.add(e); arrowHit(a, e);
            if (a.pierce > 0) a.pierce--; else { gone = true; break; }
          }
        }
        if (!gone && (a.x < A.x || a.x > A.x + A.w || a.y < A.y || a.y > A.y + A.h)) { arrowWall(a); gone = true; }
      }
      a.life -= dt;
      if (!gone && a.life <= 0) { if (a.kind === 'explosive') explodeAt(a.x, a.y, 80, 3, '#ff9a4d'); gone = true; }
      if (gone) arrows.splice(arrows.indexOf(a), 1);
    }
  }

  function updateRains(dt) {
    for (const r of rains.slice()) {
      r.t -= dt;
      if (r.t > 0) continue;
      r.next -= dt;
      while (r.left > 0 && r.next <= 0) {
        r.left--; r.next += 0.08;
        const a = Math.random() * 6.283, rad = Math.sqrt(Math.random()) * 110;
        drops.push({ x: clamp(r.x + Math.cos(a) * rad, A.x + 6, A.x + A.w - 6), y: clamp(r.y + Math.sin(a) * rad, A.y + 6, A.y + A.h - 6), life: 0.18, max: 0.18 });
      }
      if (r.left <= 0) rains.splice(rains.indexOf(r), 1);
    }
  }

  function updateDrops(dt) {
    for (const d of drops.slice()) {
      d.life -= dt;
      if (d.life <= 0) {
        drops.splice(drops.indexOf(d), 1);
        ring(d.x, d.y, 38, C.bolt); burst(d.x, d.y, 5, C.bolt, 180, 0.25); addShake(1.5);
        if (Math.random() < 0.3) sfx.hit();
        for (const e of enemies.slice()) {
          const dd = Math.hypot(e.x - d.x, e.y - d.y);
          if (dd < 38 + e.r) { knock(e, (e.x - d.x) / (dd || 1) * 200, (e.y - d.y) / (dd || 1) * 200, 0.2); damage(e, 1.5); }
        }
      }
    }
  }

  // Hawkeye, right click: rapid volley. Five precise arrows in quick succession, following your aim.
  function castVolley() {
    if (cd.volley > 0 || player.zip || player.roll > 0) return;
    cd.volley = 4.5; player.volley = { n: 5, next: 0 };
  }

  function updateVolley(dt) {
    const V = player.volley;
    if (!V) return;
    V.next -= dt;
    if (V.next <= 0) {
      spawnArrow(player.aim + (Math.random() - 0.5) * 0.05, 'normal', { dmg: 1.2 });
      sfx.arrow(); V.n--; V.next = 0.07;
      if (V.n <= 0) player.volley = null;
    }
  }

  registerHero({
    id: 'hawk', name: 'Hawkeye', team: 'avengers', order: 4, modern: true,
    blurb: 'Master archer. Triple, explosive, shock and grapple arrows.',
    look: {
      capeLab: 'Suit', cape: '#8a4fd0', fx: '#ff8ae6', hair: '#6b4a2a',
      gears: ['Domino mask', 'Hood', 'Bare head'],
      help: '<b>Hold click</b> shoots arrows. <b>Right click</b> is a rapid volley of 5 quick arrows. <b>Q</b> triple arrow, <b>E</b> explosive arrow, <b>F</b> shock arrow (stuns and chains to nearby enemies), <b>R</b> grappling arrow (zips you to the wall it hits), <b>T</b> arrow rain on the spot you aim at, <b>Space</b> dodge roll. WASD to move, mouse to aim, <b>P</b> to pause.',
      keys: ['Hold click: arrow     Right click: rapid volley     Space: dodge roll', 'Q triple arrow     E explosive arrow     F shock arrow', 'R grappling arrow     T arrow rain']
    },
    cd: { arrow: 0, atriple: 0, aexp: 0, ashock: 0, agrap: 0, arain: 0, volley: 0 },
    init: () => ({ volley: null }),
    reset() {
      arrows = []; rains = []; drops = [];
    },
    onKey(code, e) {
      if (code === 'KeyQ') castTripleArrow();
      if (code === 'KeyE') castExplosive();
      if (code === 'KeyF') castShockArrow();
      if (code === 'KeyR') castGrapple();
      if (code === 'KeyT') castRain();
      if (code === 'Space') castRoll();
    },
    onMouse(button) {
      if (button === 2) castVolley(); else { mouse.down = true; fireArrow(); }
    },
    speed() { return 255; },
    update(dt) {
      if (mouse.down) fireArrow();
      updateArrows(dt); updateRains(dt); updateDrops(dt); updateVolley(dt);
    },
    skills() {
      return [
        { k: 'M1', n: 'Arrow',    cd: cd.arrow,   max: 0.4, ok: !player.zip },
        { k: 'RMB', n: 'Volley',  cd: cd.volley,  max: 4.5, ok: !player.zip },
        { k: 'Q', n: 'Triple',    cd: cd.atriple, max: 5,   ok: !player.zip },
        { k: 'E', n: 'Explode',   cd: cd.aexp,    max: 6,   ok: !player.zip },
        { k: 'F', n: 'Shock',     cd: cd.ashock,  max: 7,   ok: !player.zip },
        { k: 'R', n: 'Grapple',   cd: cd.agrap,   max: 5,   ok: !player.zip },
        { k: 'T', n: 'Rain',      cd: cd.arain,   max: 10,  ok: !player.zip },
        { k: 'Space', n: 'Roll',  cd: cd.roll,    max: 2.5, ok: !player.zip }
      ];
    },
    message() {
      let msg;
      if (player.zip) msg = 'Grappling!';
      else if (rains.length || drops.length) msg = 'Arrow rain incoming.';
      else if (arrows.some(a => a.kind === 'grapple')) msg = 'Grapple arrow away.';
      else msg = 'Hold click to shoot. Q triple, E explosive, F shock.';
      return msg;
    },
    aimLine() { return !player.zip ? 520 : 0; },
    drawPlayerFx(px, py) {
        ctx.save(); ctx.translate(px, py); ctx.rotate(player.aim);
        ctx.strokeStyle = '#8a5a30'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(6, 0, 18, -1.15, 1.15); ctx.stroke();
        const bx = 6 + 18 * Math.cos(1.15), by = 18 * Math.sin(1.15);
        ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(bx, -by); ctx.lineTo(bx, by); ctx.stroke();
        ctx.restore();
    },
    drawOver() {
      // Hawkeye: arrows and arrow rain
      for (const r of rains) {
        if (r.t > 0) {
          ctx.save(); ctx.fillStyle = fx(0.08 + 0.10 * (1 - r.t / 0.5)); ctx.beginPath(); ctx.arc(r.x, r.y, 110, 0, 7); ctx.fill();
          ctx.strokeStyle = fx(0.6); ctx.lineWidth = 2; ctx.setLineDash([6, 6]); ctx.beginPath(); ctx.arc(r.x, r.y, 110, 0, 7); ctx.stroke(); ctx.restore();
        }
      }
      for (const d of drops) {
        const k = d.life / d.max;
        ctx.save(); ctx.strokeStyle = C.bolt; ctx.lineWidth = 2; ctx.shadowColor = C.bolt; ctx.shadowBlur = 8;
        ctx.beginPath(); ctx.moveTo(d.x, d.y - 130 * k - 16); ctx.lineTo(d.x, d.y - 130 * k); ctx.stroke();
        ctx.fillStyle = fx(0.25); ctx.beginPath(); ctx.arc(d.x, d.y, 5, 0, 7); ctx.fill(); ctx.restore();
      }
      for (const a of arrows) {
        const col = a.kind === 'explosive' ? '#ff9a4d' : a.kind === 'shock' ? C.bolt : a.kind === 'grapple' ? '#d6d6d6' : '#e7eef4';
        if (a.kind === 'grapple') {
          ctx.strokeStyle = 'rgba(220,220,220,0.6)'; ctx.lineWidth = 1.5;
          ctx.beginPath(); ctx.moveTo(player.x, player.y); ctx.lineTo(a.x, a.y); ctx.stroke();
        }
        ctx.save(); ctx.translate(a.x, a.y); ctx.rotate(a.ang);
        if (a.kind !== 'normal') { ctx.shadowColor = col; ctx.shadowBlur = 12; }
        ctx.strokeStyle = '#caa070'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-22, 0); ctx.lineTo(0, 0); ctx.stroke();
        ctx.strokeStyle = C.bolt; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(-22, 0); ctx.lineTo(-27, -3); ctx.moveTo(-22, 0); ctx.lineTo(-27, 3); ctx.stroke();
        ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(6, 0); ctx.lineTo(-2, -3.5); ctx.lineTo(-2, 3.5); ctx.closePath(); ctx.fill();
        if (a.kind === 'explosive') { ctx.fillStyle = '#ff5a30'; ctx.beginPath(); ctx.arc(2, 0, 4, 0, 7); ctx.fill(); }
        ctx.restore();
      }
    },
    gear(g, c) {
      const { r, hr, gear, unsuited } = c; const ch = look.char;
      g.fillStyle = '#5a3a24'; g.fillRect(-r - 3, -3, 8, 6);                       // quiver
      g.fillStyle = C.bolt; g.fillRect(-r - 6, -2, 3, 1.5); g.fillRect(-r - 6, 0.5, 3, 1.5);
      if (gear === 0) {                                                            // domino mask
        g.fillStyle = '#14121a'; g.fillRect(hr * 0.15, -hr * 0.7, hr * 0.6, hr * 1.4);
      } else if (gear === 1) {                                                     // hood
        g.fillStyle = '#3d2468'; g.beginPath(); g.arc(-1, 0, hr + 1, 0, 7); g.fill();
        g.beginPath(); g.moveTo(-hr + 2, -6); g.lineTo(-hr - 9, 0); g.lineTo(-hr + 2, 6); g.closePath(); g.fill();
        g.fillStyle = '#d9c3a0'; g.beginPath(); g.arc(hr * 0.35, 0, hr * 0.42, 0, 7); g.fill();
      }
    },
  });

})();
