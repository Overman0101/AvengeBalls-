// WOLVERINE: claw slash and claw strike swipes, lock-on plunge, headbutt, berserker rage, hunter's scent and a healing factor.

// Self-contained: everything in this file is private to the hero, except what registerHero() hands to the engine.

(function () {

  const wm = () => player.rage > 0 ? 1.35 : 1;                        // damage bonus while in berserker rage

  const wolvFree = () => !player.plunge && player.hbutt <= 0 && !player.zip && player.roll <= 0;

  function clawHit(range, half, dmg, kb, stun) {
    let hit = 0;
    for (const e of enemies.slice()) {
      const d = dist(e, player);
      if (d < player.r + range + e.r && Math.abs(wrap(Math.atan2(e.y - player.y, e.x - player.x) - player.aim)) < half) {
        knock(e, (e.x - player.x) / (d || 1) * kb, (e.y - player.y) / (d || 1) * kb, stun);
        burst(e.x, e.y, 5, '#ffffff', 220, 0.25); damage(e, dmg * wm()); hit++;
      }
    }
    return hit;
  }

  // Click (hold): quick claw slashes
  function wolvSlash() {
    if (cd.slash > 0 || !wolvFree()) return;
    const rage = player.rage > 0;
    cd.slash = rage ? 0.14 : 0.28; player.clawT = 0.3; player.slashSide = -player.slashSide;   // alternate left-to-right, right-to-left
    const aim = assistAim(player.aim, 140, 0.9);
    startSweep({
      kind: 'claw', aim, half: 0.95, dir: player.slashSide, dur: rage ? 0.12 : 0.17, reach: 74,
      onHit: (e, d) => {
        knock(e, (e.x - player.x) / (d || 1) * 300, (e.y - player.y) / (d || 1) * 300, 0.15);
        burst(e.x, e.y, 5, '#ffffff', 220, 0.25); damage(e, 1.3 * wm()); sfx.hit(); hitstop = Math.max(hitstop, 0.02); addShake(2);
      }
    });
    lunge(aim, 420); sfx.swing();
  }

  // Right click: claw strike, a heavy swing in a wide arc
  function clawStrike() {
    if (cd.claw > 0 || !wolvFree()) return;
    cd.claw = player.rage > 0 ? 1.0 : 1.8; player.clawT = 0.5;
    const aim = assistAim(player.aim, 160, 1.1), shared = new Set();
    const heavy = (e, d) => {
      knock(e, (e.x - player.x) / (d || 1) * 650, (e.y - player.y) / (d || 1) * 650, 0.6);
      burst(e.x, e.y, 8, '#ffffff', 260, 0.3); damage(e, 3 * wm()); sfx.slam(); hitstop = Math.max(hitstop, 0.06); addShake(6);
    };
    for (const dir of [1, -1]) startSweep({ kind: 'claw', aim, half: 1.35, dir, dur: 0.26, reach: 112, thick: 1.5, hit: shared, onHit: heavy });   // both claws cross in an X
    killBoltsNear(player.x + Math.cos(aim) * 55, player.y + Math.sin(aim) * 55, 95);
    lunge(aim, 640); sfx.swing();
  }

  // Q: plunge. Locks onto the enemy nearest your cursor, launches into it and stabs it, then chains on.
  function plungeTarget() {
    let best = null, bd = 130;
    for (const e of enemies) { const d = Math.hypot(e.x - mouse.x, e.y - mouse.y); if (d < bd) { bd = d; best = e; } }
    if (!best) {
      bd = 1e9;
      for (const e of enemies) {
        const d = dist(e, player);
        if (d < bd && Math.abs(wrap(Math.atan2(e.y - player.y, e.x - player.x) - player.aim)) < 0.9) { bd = d; best = e; }
      }
    }
    return best;
  }

  function castPlunge() {
    if (cd.plunge > 0 || !wolvFree()) return;
    const best = plungeTarget();
    if (!best) { ring(player.x, player.y, 26, '#888888'); return; }  // no target: no cooldown spent
    cd.plunge = 5; player.plunge = { e: best, chain: 2, stab: new Set() }; player.clawT = 1; sfx.swing();
  }

  function updatePlunge(dt) {
    const T = player.plunge;
    if (!enemies.includes(T.e)) {                                     // target gone: grab the nearest other one, or stop
      let best = null, bd = 320;
      for (const e of enemies) { if (T.stab.has(e)) continue; const d = dist(e, player); if (d < bd) { bd = d; best = e; } }
      if (!best) { player.plunge = null; return; }
      T.e = best;
    }
    const e = T.e, dx = e.x - player.x, dy = e.y - player.y, d = Math.hypot(dx, dy) || 1, step = 1500 * dt;
    player.clawT = 0.3; player.inv = Math.max(player.inv, 0.25); player.vx = 0; player.vy = 0; player.aim = Math.atan2(dy, dx);
    if (d <= e.r + player.r + 8 || step >= d) {
      T.stab.add(e); sfx.slam(); hitstop = 0.08; addShake(9);
      ring(e.x, e.y, 70, '#ffffff'); burst(e.x, e.y, 18, '#ff6a6a', 300, 0.5);
      knock(e, dx / d * 250, dy / d * 250, 1.0); damage(e, 4 * wm());
      let next = null;
      if (T.chain > 0) {
        let bd = 280;
        for (const o of enemies) { if (T.stab.has(o)) continue; const dd = dist(o, player); if (dd < bd) { bd = dd; next = o; } }
      }
      if (next) { T.e = next; T.chain--; } else player.plunge = null;
    } else {
      player.x = clamp(player.x + dx / d * step, A.x + player.r, A.x + A.w - player.r);
      player.y = clamp(player.y + dy / d * step, A.y + player.r, A.y + A.h - player.r);
      particles.push({ x: player.x, y: player.y, vx: 0, vy: 0, life: 0.25, max: 0.25, color: '#ffffff', size: 5 });
    }
  }

  // E: headbutt. A short lunge that stuns whatever it hits.
  function castHeadbutt() {
    if (cd.hbutt > 0 || !wolvFree()) return;
    cd.hbutt = 4.5; player.hbutt = 0.22; player.hbuttA = player.aim; player.hbuttHit = new Set(); sfx.swing();
  }

  function updateHeadbutt(dt) {
    player.hbutt -= dt;
    player.x = clamp(player.x + Math.cos(player.hbuttA) * 1000 * dt, A.x + player.r, A.x + A.w - player.r);
    player.y = clamp(player.y + Math.sin(player.hbuttA) * 1000 * dt, A.y + player.r, A.y + A.h - player.r);
    player.inv = Math.max(player.inv, 0.2); player.vx = 0; player.vy = 0;
    for (const e of enemies.slice()) {
      if (player.hbuttHit.has(e)) continue;
      if (dist(e, player) < e.r + player.r + 8) {
        player.hbuttHit.add(e); sfx.slam(); hitstop = 0.07; addShake(7);
        ring(e.x, e.y, 60, '#ffffff'); burst(e.x, e.y, 14, '#ffffff', 280, 0.4);
        knock(e, Math.cos(player.hbuttA) * 500, Math.sin(player.hbuttA) * 500, 1.8); damage(e, 2 * wm());
        player.hbutt = 0; break;
      }
    }
    particles.push({ x: player.x, y: player.y, vx: 0, vy: 0, life: 0.2, max: 0.2, color: '#ffffff', size: 5 });
  }

  // F: berserker rage. Faster, quicker attacks, hits harder, heals much faster.
  function castRage() {
    if (cd.rage > 0 || player.rage > 0) return;
    cd.rage = 20; player.rage = 6;
    ring(player.x, player.y, 110, '#ff5a5a'); burst(player.x, player.y, 26, '#ff5a5a', 340, 0.6); addShake(8); sfx.roar();
  }

  // R: hunter's scent. Every enemy is marked and takes 50% more damage for a while.
  function castScent() {
    if (cd.scent > 0) return;
    cd.scent = 14;
    for (const e of enemies) e.marked = time + 6;
    ring(player.x, player.y, 220, C.bolt); sfx.sense();
  }

  registerHero({
    id: 'wolverine', name: 'Wolverine', team: 'xmen', order: 9, modern: true,
    blurb: 'Feral mutant. Claws, plunge attacks, headbutts, healing factor.',
    look: {
      capeLab: 'Suit', cape: '#e0b83c', fx: '#ffd86b', hair: '#16141a',
      gears: ['Cowl', 'Bare head', 'Bandana'],
      help: '<b>Hold click</b> slashes with the claws, which pop out when he attacks. <b>Right click</b> is a heavy claw strike in a wide arc. <b>Q</b> plunge: locks onto the enemy nearest your cursor, launches into it and stabs it, then jumps on up to 2 more. <b>E</b> headbutt (a big stun), <b>F</b> berserker rage (faster, quicker attacks, much faster healing), <b>R</b> hunter\'s scent (marks every enemy to take 50% more damage), <b>Space</b> dodge. Healing factor: he gets a heart back every 6 seconds. WASD to move, mouse to aim, <b>P</b> to pause.',
      keys: ['Hold click: slash     Right click: claw strike     Space: dodge', 'Q plunge (target under cursor)     E headbutt     F berserker rage', 'R hunter\'s scent     Passive: healing factor']
    },
    cd: { slash: 0, claw: 0, plunge: 0, hbutt: 0, rage: 0, scent: 0 },
    init: () => ({ plunge: null, hbutt: 0, hbuttA: 0, hbuttHit: new Set(), clawT: 0, slashA: 0, slashT: 0, strikeT: 0, strikeA: 0, rage: 0, regenT: 6, slashSide: 1 }),
    onKey(code, e) {
      if (code === 'KeyQ') castPlunge();
      if (code === 'KeyE') castHeadbutt();
      if (code === 'KeyF') castRage();
      if (code === 'KeyR') castScent();
      if (code === 'Space') castRoll();
    },
    onMouse(button) {
      if (button === 2) clawStrike(); else { mouse.down = true; wolvSlash(); }
    },
    preMove(dt) {
      const iv = player.rage > 0 ? 2 : 6;                               // healing factor: a heart returns every few seconds
      if (player.hp < maxHp()) { player.regenT = Math.min(player.regenT, iv) - dt; if (player.regenT <= 0) { healHeart(); player.regenT = iv; } }
      else player.regenT = iv;
      return {};
    },
    speed() { return 285 * (player.rage > 0 ? 1.25 : 1); },
    update(dt) {
      if (mouse.down) wolvSlash();
      if (player.rage > 0) player.rage = Math.max(0, player.rage - dt);
      if (player.clawT > 0) player.clawT -= dt;
      if (player.strikeT > 0) player.strikeT -= dt;
      if (player.slashT > 0) player.slashT -= dt;
    },
    hudBars() {
      const iv = player.rage > 0 ? 2 : 6, full = player.hp >= maxHp();
      ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.fillRect(48, 46, 140, 6);
      ctx.fillStyle = full ? '#7dff9a' : 'rgba(125,255,154,0.75)';
      ctx.fillRect(48, 46, 140 * (full ? 1 : Math.max(0, 1 - player.regenT / iv)), 6);
      ctx.font = '11px "Palatino Linotype", Palatino, Georgia, serif'; ctx.textAlign = 'left';
      ctx.fillStyle = 'rgba(231,238,244,0.7)'; ctx.fillText('HEALING FACTOR', 194, 49);
      ctx.font = '700 22px "Palatino Linotype", Palatino, Georgia, serif';
    },
    skills() {
      return [
        { k: 'M1', n: 'Slash',    cd: cd.slash,  max: 0.28, ok: wolvFree() },
        { k: 'RMB', n: 'Claw',    cd: cd.claw,   max: 1.8,  ok: wolvFree() },
        { k: 'Q', n: 'Plunge',    cd: cd.plunge, max: 5,    ok: wolvFree() },
        { k: 'E', n: 'Headbutt',  cd: cd.hbutt,  max: 4.5,  ok: wolvFree() },
        { k: 'F', n: 'Rage',      cd: cd.rage,   max: 20,   ok: player.rage <= 0 },
        { k: 'R', n: 'Scent',     cd: cd.scent,  max: 14,   ok: true },
        { k: 'Space', n: 'Dodge', cd: cd.roll,   max: 2.5,  ok: !player.zip }
      ];
    },
    message() {
      let msg;
      if (player.plunge) msg = 'Plunge! Locked on.';
      else if (player.rage > 0) msg = 'BERSERKER RAGE ' + player.rage.toFixed(1) + 's';
      else msg = 'Hold click to slash. Q plunges onto the enemy under your cursor.';
      return msg;
    },
    drawPlayerFx(px, py) {
        const out = (player.clawT > 0 && sweeps.length === 0) || player.rage > 0 || player.plunge || player.hbutt > 0;
        if (player.rage > 0) {                                           // berserker aura
          ctx.strokeStyle = 'rgba(255,90,90,' + (0.35 + 0.2 * Math.sin(time * 14)) + ')'; ctx.lineWidth = 3;
          ctx.beginPath(); ctx.arc(px, py, player.r + 7, 0, 7); ctx.stroke();
        }
        if (out) {                                                       // claws pop out: three blades on each fist
          ctx.save(); ctx.translate(px, py); ctx.rotate(player.aim);
          ctx.strokeStyle = '#e8eef5'; ctx.lineWidth = 2; ctx.shadowColor = C.bolt; ctx.shadowBlur = 8;
          for (const sd of [-1, 1]) for (const o of [-1, 0, 1]) {
            ctx.beginPath(); ctx.moveTo(player.r * 0.9, sd * player.r * 0.65 + o * 2); ctx.lineTo(player.r * 0.9 + 24, sd * player.r * 0.65 + o * 4); ctx.stroke();
          }
          ctx.restore();
        }
        const tg = player.plunge ? player.plunge.e : (wolvFree() ? plungeTarget() : null);   // lock-on reticle
        if (tg && enemies.includes(tg)) {
          const hot = !!player.plunge, rr = tg.r + 9 + Math.sin(time * 10) * (hot ? 3 : 1);
          ctx.strokeStyle = hot ? 'rgba(255,90,90,0.95)' : 'rgba(255,255,255,0.35)'; ctx.lineWidth = hot ? 2.5 : 1.5;
          ctx.beginPath(); ctx.arc(tg.x, tg.y, rr, 0, 7);
          ctx.moveTo(tg.x - rr - 6, tg.y); ctx.lineTo(tg.x - rr + 4, tg.y); ctx.moveTo(tg.x + rr - 4, tg.y); ctx.lineTo(tg.x + rr + 6, tg.y);
          ctx.moveTo(tg.x, tg.y - rr - 6); ctx.lineTo(tg.x, tg.y - rr + 4); ctx.moveTo(tg.x, tg.y + rr - 4); ctx.lineTo(tg.x, tg.y + rr + 6);
          ctx.stroke();
        }
    },
    gear(g, c) {
      const { r, hr, gear, unsuited } = c; const ch = look.char;
      g.strokeStyle = '#2a4fa8'; g.lineWidth = 6; g.beginPath(); g.arc(0, 0, r - 1, Math.PI * 0.6, Math.PI * 1.4); g.stroke();   // blue sides
      if (gear === 0) {                                                                    // cowl with pointed ears
        g.fillStyle = '#2a4fa8'; g.beginPath(); g.arc(0, 0, hr + 1, 0, 7); g.fill();
        for (const sd of [-1, 1]) { g.beginPath(); g.moveTo(-hr * 0.1, sd * hr * 0.7); g.lineTo(-hr * 0.75, sd * (hr + 9)); g.lineTo(hr * 0.3, sd * hr * 0.95); g.closePath(); g.fill(); }
        g.fillStyle = '#d9c3a0'; g.beginPath(); g.arc(hr * 0.42, 0, hr * 0.46, 0, 7); g.fill();                              // face opening
      } else if (gear === 1) {                                                             // bare head, signature hair tufts
        g.fillStyle = CHARS[ch].hair;
        for (const sd of [-1, 1]) { g.beginPath(); g.moveTo(hr * 0.1, sd * hr * 0.45); g.lineTo(hr * 0.95, sd * hr * 0.95); g.lineTo(hr * 0.35, sd * hr * 0.2); g.closePath(); g.fill(); }
      } else {                                                                             // bandana
        g.strokeStyle = '#c93a3a'; g.lineWidth = 3; g.beginPath(); g.arc(0, 0, hr - 2, -1.3, 1.3); g.stroke();
      }
    },
  });

  registerForcedState(100, () => player.plunge, updatePlunge);
  registerForcedState(110, () => player.hbutt > 0, updateHeadbutt);

})();
