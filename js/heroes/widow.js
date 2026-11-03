// BLACK WIDOW: dual pistols, Widow's Bite, grappling hook, flip, flashbang, bullet ring and takedown.

// Self-contained: everything in this file is private to the hero, except what registerHero() hands to the engine.

(function () {

  let flashes = [], hook = null;


  const widowFree = () => !player.zip && player.flip <= 0 && !player.take;

  // Click (hold): dual pistols, alternating
  function fireGuns() {
    if (cd.gun > 0 || !widowFree()) return;
    cd.gun = 0.16; player.gunSide = -player.gunSide;
    const a = player.aim + (Math.random() - 0.5) * 0.07;
    const ox = player.x + Math.cos(player.aim) * 20 + Math.cos(player.aim + Math.PI / 2) * 8 * player.gunSide;
    const oy = player.y + Math.sin(player.aim) * 20 + Math.sin(player.aim + Math.PI / 2) * 8 * player.gunSide;
    bullets.push({ x: ox, y: oy, vx: Math.cos(a) * 1250, vy: Math.sin(a) * 1250, dmg: 1, life: 0.7 });
    particles.push({ x: ox, y: oy, vx: 0, vy: 0, life: 0.08, max: 0.08, color: '#ffffff', size: 5 });
    sfx.gun();
  }

  // Right click: Widow's Bite. Electric strike that stuns and arcs to nearby enemies.
  function widowBite() {
    if (cd.bite > 0 || !widowFree()) return;
    let best = null, bd = 1e9;
    for (const e of enemies) {
      const d = dist(e, player) - e.r;
      if (d < 150 && Math.abs(wrap(Math.atan2(e.y - player.y, e.x - player.x) - player.aim)) < 0.9 && d < bd) { bd = d; best = e; }
    }
    if (!best) {                                                    // whiff: short cooldown
      cd.bite = 0.6; ring(player.x + Math.cos(player.aim) * 40, player.y + Math.sin(player.aim) * 40, 30, C.bolt); sfx.swing(); return;
    }
    cd.bite = 3;
    arcs.push({ x1: player.x, y1: player.y, x2: best.x, y2: best.y, life: 0.3 });
    knock(best, 0, 0, 1.6); hitstop = 0.05; addShake(5); sfx.bite();
    ring(best.x, best.y, 60, C.bolt); burst(best.x, best.y, 12, C.bolt, 260, 0.4);
    damage(best, 2);
    chainArcs(best, 2, 130, 1.2, 1);
  }

  // Q: grappling hook. Yanks an enemy to you, or pulls you to a wall.
  function castHook() {
    if (cd.hook > 0 || !widowFree() || hook) return;
    cd.hook = 6;
    hook = { x: player.x, y: player.y, vx: Math.cos(player.aim) * 1500, vy: Math.sin(player.aim) * 1500, mode: 'out', tgt: null, dist: 0 };
    sfx.grapple();
  }

  function updateHook(dt) {
    const h = hook;
    if (h.mode === 'out') {
      const total = 1500 * dt, steps = Math.max(1, Math.ceil(total / 10));
      for (let s = 0; s < steps && hook; s++) {
        h.x += h.vx * dt / steps; h.y += h.vy * dt / steps; h.dist += total / steps;
        for (const e of enemies) {
          if (Math.hypot(e.x - h.x, e.y - h.y) < e.r + 8) { h.mode = 'reel'; h.tgt = e; sfx.clang(); break; }
        }
        if (h.mode !== 'out') return;
        if (h.x < A.x || h.x > A.x + A.w || h.y < A.y || h.y > A.y + A.h) {
          const x = clamp(h.x, A.x + player.r, A.x + A.w - player.r), y = clamp(h.y, A.y + player.r, A.y + A.h - player.r);
          player.zip = { tx: x, ty: y, hit: new Set() }; ring(x, y, 40, '#ffffff'); hook = null; return;
        }
        if (h.dist > 560) { hook = null; return; }
      }
    } else {
      const e = h.tgt;
      if (!enemies.includes(e)) { hook = null; return; }
      const dx = player.x - e.x, dy = player.y - e.y, d = Math.hypot(dx, dy) || 1;
      e.x += dx / d * 1000 * dt; e.y += dy / d * 1000 * dt; e.kx = 0; e.ky = 0; e.stun = Math.max(e.stun, 0.3);
      h.x = e.x; h.y = e.y;
      if (d < e.r + player.r + 10) {                                // slam the reeled enemy
        sfx.slam(); addShake(7); hitstop = 0.06;
        ring(e.x, e.y, 70, C.bolt); burst(e.x, e.y, 14, C.bolt, 260, 0.4);
        knock(e, 0, 0, 1.5); damage(e, 2); hook = null;
      }
    }
  }

  // E: acrobatic flip, a quick dodge
  function castFlip() {
    if (cd.flip > 0 || !widowFree()) return;
    cd.flip = 2.5; player.flip = 0.22; player.dodgeA = inputDir();
    ring(player.x, player.y, 34, C.bolt); sfx.swing();
  }

  // F: flashbang. Thrown to the mouse, stuns everything in the blast.
  function castFlash() {
    if (cd.flash > 0 || !widowFree()) return;
    cd.flash = 9;
    const dx = mouse.x - player.x, dy = mouse.y - player.y, d = Math.hypot(dx, dy) || 1, reach = Math.min(d, 420);
    flashes.push({ sx: player.x, sy: player.y, x: player.x, y: player.y, tx: clamp(player.x + dx / d * reach, A.x + 20, A.x + A.w - 20), ty: clamp(player.y + dy / d * reach, A.y + 20, A.y + A.h - 20), t: 0, dur: 0.45 });
    sfx.throw();
  }

  function updateFlashes(dt) {
    for (const f of flashes.slice()) {
      f.t += dt; const p = Math.min(1, f.t / f.dur);
      f.x = f.sx + (f.tx - f.sx) * p; f.y = f.sy + (f.ty - f.sy) * p;
      if (p >= 1) {
        flashes.splice(flashes.indexOf(f), 1);
        ring(f.x, f.y, 130, '#ffffff'); ring(f.x, f.y, 90, C.bolt); burst(f.x, f.y, 30, '#ffffff', 360, 0.5);
        flash = 0.3; addShake(6); sfx.thunder();
        for (const e of enemies) {
          const dd = Math.hypot(e.x - f.x, e.y - f.y);
          if (dd < 130 + e.r) knock(e, 0, 0, 2.2);
        }
        killBoltsNear(f.x, f.y, 130);
      }
    }
  }

  // R: bullet ring
  function castRing() {
    if (cd.ring > 0 || !widowFree()) return;
    cd.ring = 8;
    for (let i = 0; i < 20; i++) {
      const a = i / 20 * Math.PI * 2;
      bullets.push({ x: player.x + Math.cos(a) * 18, y: player.y + Math.sin(a) * 18, vx: Math.cos(a) * 1000, vy: Math.sin(a) * 1000, dmg: 1, life: 0.6 });
    }
    ring(player.x, player.y, 70, C.bolt); addShake(4); sfx.gun(); sfx.swing();
  }

  // T: takedown. Leap onto an enemy and finish them. Weak enemies die outright.
  function castTakedown() {
    if (cd.take > 0 || !widowFree()) return;
    let best = null, bd = 360;
    for (const e of enemies) {
      const d = dist(e, player);
      if (d < bd && Math.abs(wrap(Math.atan2(e.y - player.y, e.x - player.x) - player.aim)) < 0.9) { bd = d; best = e; }
    }
    if (!best) { ring(player.x, player.y, 26, '#888888'); return; }   // nothing in front: no cooldown spent
    cd.take = 7; player.take = { e: best, phase: 'dash', t: 0 }; sfx.swing();
  }

  function updateTakedown(dt) {
    const T = player.take, e = T.e;
    if (!enemies.includes(e)) { player.take = null; return; }
    player.inv = Math.max(player.inv, 0.3); player.vx = 0; player.vy = 0;
    if (T.phase === 'dash') {
      const dx = e.x - player.x, dy = e.y - player.y, d = Math.hypot(dx, dy) || 1, step = 1300 * dt;
      if (d <= e.r + player.r + 6 || step >= d) { T.phase = 'choke'; T.t = 0.4; e.stun = Math.max(e.stun, 0.6); e.kx = 0; e.ky = 0; sfx.clang(); }
      else {
        player.x += dx / d * step; player.y += dy / d * step;
        particles.push({ x: player.x, y: player.y, vx: 0, vy: 0, life: 0.25, max: 0.25, color: C.bolt, size: 5 });
      }
    } else {
      T.t -= dt; e.kx = 0; e.ky = 0; e.stun = Math.max(e.stun, 0.3);
      if (T.t <= 0) {
        player.take = null;
        const kill = !e.armor && e.hp <= 3;
        hitstop = 0.1; addShake(9); sfx.slam();
        ring(e.x, e.y, 80, '#ffffff'); burst(e.x, e.y, 22, C.bolt, 320, 0.5);
        const dx = e.x - player.x, dy = e.y - player.y, d = Math.hypot(dx, dy) || 1;
        knock(e, dx / d * 320, dy / d * 320, 1.5);
        damage(e, kill ? 99 : 4);
      }
    }
  }

  registerHero({
    id: 'widow', name: 'Black Widow', team: 'avengers', order: 5, modern: true,
    blurb: 'Spy. Dual guns, Widow\'s Bite, grappling hook, takedowns.',
    look: {
      capeLab: 'Suit', cape: '#2b2f38', fx: '#ff5a5a', hair: '#b5472b',
      gears: ['Headband', 'Visor', 'Bare head'],
      help: '<b>Hold click</b> fires the dual pistols. <b>Right click</b> is Widow\'s Bite, an electric strike that stuns and arcs to nearby enemies. <b>Q</b> grappling hook (yanks an enemy to you, or pulls you to a wall), <b>E</b> acrobatic flip, <b>F</b> flashbang, <b>R</b> bullet ring, <b>T</b> takedown (leaps onto an enemy, finishes weak ones). WASD to move, mouse to aim, <b>P</b> to pause.',
      keys: ['Hold click: pistols     Right click: Widow\'s Bite', 'Q grappling hook     E flip     F flashbang', 'R bullet ring     T takedown']
    },
    cd: { gun: 0, bite: 0, hook: 0, flip: 0, flash: 0, ring: 0, take: 0 },
    init: () => ({ take: null, gunSide: 1 }),
    reset() {
      flashes = []; hook = null;
    },
    onKey(code, e) {
      if (code === 'KeyQ') castHook();
      if (code === 'KeyE') castFlip();
      if (code === 'KeyF') castFlash();
      if (code === 'KeyR') castRing();
      if (code === 'KeyT') castTakedown();
    },
    onMouse(button) {
      if (button === 2) widowBite(); else { mouse.down = true; fireGuns(); }
    },
    speed() { return 275; },
    update(dt) {
      if (mouse.down) fireGuns();
      updateBullets(dt); updateFlashes(dt);
      if (hook) updateHook(dt);
    },
    skills() {
      return [
        { k: 'M1', n: 'Guns',     cd: cd.gun,   max: 0.16, ok: widowFree() },
        { k: 'RMB', n: 'Bite',    cd: cd.bite,  max: 3,    ok: widowFree() },
        { k: 'Q', n: 'Hook',      cd: cd.hook,  max: 6,    ok: widowFree() && !hook },
        { k: 'E', n: 'Flip',      cd: cd.flip,  max: 2.5,  ok: widowFree() },
        { k: 'F', n: 'Flash',     cd: cd.flash, max: 9,    ok: widowFree() },
        { k: 'R', n: 'Ring',      cd: cd.ring,  max: 8,    ok: widowFree() },
        { k: 'T', n: 'Takedown',  cd: cd.take,  max: 7,    ok: widowFree() }
      ];
    },
    message() {
      let msg;
      if (player.take) msg = 'Takedown!';
      else if (hook) msg = 'Hook out.';
      else if (player.zip) msg = 'Grappling!';
      else msg = "Hold click to shoot, right click for Widow's Bite.";
      return msg;
    },
    aimLine() { return widowFree() ? 520 : 0; },
    drawPlayerFx(px, py) {
        ctx.save(); ctx.translate(px, py); ctx.rotate(player.aim);
        ctx.fillStyle = '#1a1d24'; ctx.fillRect(12, -11, 11, 4); ctx.fillRect(12, 7, 11, 4);
        if (cd.gun > 0.09) { ctx.fillStyle = '#ffffff'; ctx.shadowColor = C.bolt; ctx.shadowBlur = 10; ctx.fillRect(23, player.gunSide > 0 ? 7 : -11, 4, 4); }
        ctx.restore();
    },
    drawOver() {
      if (hook) {
      ctx.strokeStyle = 'rgba(230,230,230,0.7)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(player.x, player.y); ctx.lineTo(hook.x, hook.y); ctx.stroke();
      ctx.fillStyle = '#d6d6d6'; ctx.beginPath(); ctx.arc(hook.x, hook.y, 5, 0, 7); ctx.fill();
      }
      for (const f of flashes) {
        const p = Math.min(1, f.t / f.dur), h = Math.sin(p * Math.PI) * 30;
        ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(f.x, f.y, 7, 3.5, 0, 0, 7); ctx.fill();
        ctx.save(); ctx.shadowColor = '#ffffff'; ctx.shadowBlur = 12;
        ctx.fillStyle = '#e8e8e8'; ctx.beginPath(); ctx.arc(f.x, f.y - h, 6, 0, 7); ctx.fill(); ctx.restore();
      }
    },
    gear(g, c) {
      const { r, hr, gear, unsuited } = c; const ch = look.char;
      g.fillStyle = '#d83a3a';                                                     // red hourglass on the back
      g.beginPath(); g.moveTo(-r * 0.8, -5); g.lineTo(-r * 0.45, 0); g.lineTo(-r * 0.8, 5); g.closePath(); g.fill();
      g.beginPath(); g.moveTo(-r * 0.1, -5); g.lineTo(-r * 0.45, 0); g.lineTo(-r * 0.1, 5); g.closePath(); g.fill();
      if (gear === 0) {                                                            // headband
        g.strokeStyle = '#c93a3a'; g.lineWidth = 3; g.beginPath(); g.arc(0, 0, hr - 2, -1.2, 1.2); g.stroke();
      } else if (gear === 1) {                                                     // tactical visor
        g.fillStyle = '#14121a'; g.beginPath(); g.arc(0, 0, hr, -0.9, 0.9); g.closePath(); g.fill();
        g.fillStyle = C.bolt; g.fillRect(hr * 0.5, -1.2, 4, 2.4);
      }
    },
  });

  registerForcedState(70, () => player.take, updateTakedown);

})();
