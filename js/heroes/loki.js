// LOKI: blast, illusions, teleport, cloak, wolf form and a dagger fan.

// Self-contained: everything in this file is private to the hero, except what registerHero() hands to the engine.

(function () {

  let blasts = [];


  // Click: energy blast (or a pounce while in wolf form)
  function spawnBlast(x, y, ang, o) {
    blasts.push({ x, y, vx: Math.cos(ang) * 850, vy: Math.sin(ang) * 850, dmg: o.dmg, splash: o.splash, r: o.big ? 13 : (o.small ? 7 : 10), life: 1.2 });
  }

  function fireBlast() {
    if (player.wolf > 0) { pounce(); return; }
    if (cd.blast > 0) return;
    cd.blast = 0.6;
    const sneak = player.invis > 0;                       // attacking from invisibility hits double
    spawnBlast(player.x + Math.cos(player.aim) * 18, player.y + Math.sin(player.aim) * 18, player.aim,
      { dmg: sneak ? 4 : 2, splash: sneak ? 2 : 1, big: sneak });
    for (const c of clones) {                            // illusions fire too, weaker
      spawnBlast(c.x, c.y, Math.atan2(mouse.y - c.y, mouse.x - c.x), { dmg: 1, splash: 0, small: true });
    }
    if (sneak) {
      player.invis = 0; addShake(5);
      ring(player.x, player.y, 70, '#ffffff'); burst(player.x, player.y, 16, C.bolt, 260, 0.5);
    }
    sfx.blast();
  }

  function explodeBlast(b, direct) {
    ring(b.x, b.y, 64, C.bolt); burst(b.x, b.y, 16, C.bolt, 300, 0.5);
    addShake(b.dmg >= 4 ? 9 : 4); sfx.boom();
    if (b.splash <= 0) return;
    for (const o of enemies.slice()) {
      if (o === direct) continue;
      const d = Math.hypot(o.x - b.x, o.y - b.y);
      if (d < 60 + o.r) {
        knock(o, (o.x - b.x) / (d || 1) * 420, (o.y - b.y) / (d || 1) * 420, 0.4);
        damage(o, b.splash);
      }
    }
  }

  function updateBlasts(dt) {
    for (const b of blasts.slice()) {
      b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
      particles.push({ x: b.x, y: b.y, vx: 0, vy: 0, life: 0.25, max: 0.25, color: C.bolt, size: b.r * 0.6 });
      let done = false;
      for (const e of enemies.slice()) {
        if (Math.hypot(e.x - b.x, e.y - b.y) < e.r + b.r) {
          hitstop = Math.max(hitstop, b.dmg >= 4 ? 0.08 : 0.04);
          knock(e, b.vx * 0.45, b.vy * 0.45, 0.4);
          damage(e, b.dmg);
          explodeBlast(b, e);
          done = true; break;
        }
      }
      if (!done && (b.x < A.x || b.x > A.x + A.w || b.y < A.y || b.y > A.y + A.h)) {
        b.x = clamp(b.x, A.x, A.x + A.w); b.y = clamp(b.y, A.y, A.y + A.h);
        explodeBlast(b, null); done = true;
      }
      if (!done && b.life <= 0) done = true;
      if (done) blasts.splice(blasts.indexOf(b), 1);
    }
  }

  // Q: two illusions that orbit you, draw enemies, and shoot when you shoot
  function castClone() {
    if (cd.clone > 0) return;
    cd.clone = 8; clones = [];
    for (let i = 0; i < 2; i++) {
      const ang = player.aim + (i === 0 ? 1 : -1) * Math.PI / 2;
      clones.push({ x: player.x, y: player.y, ang, dir: i === 0 ? 1 : -1, life: 7 });
      ring(player.x + Math.cos(ang) * 40, player.y + Math.sin(ang) * 40, 40, C.bolt);
    }
    burst(player.x, player.y, 20, C.bolt, 260, 0.5);
    sfx.clone();
  }

  function updateClones(dt) {
    for (const c of clones.slice()) {
      c.life -= dt; c.ang += c.dir * 0.9 * dt;
      const tx = player.x + Math.cos(c.ang) * 85, ty = player.y + Math.sin(c.ang) * 85;
      const k = Math.min(1, 6 * dt);
      c.x += (tx - c.x) * k; c.y += (ty - c.y) * k;
      c.x = clamp(c.x, A.x + 14, A.x + A.w - 14);
      c.y = clamp(c.y, A.y + 14, A.y + A.h - 14);
      if (c.life <= 0) killClone(c);
    }
  }

  // E / right click: blink toward the mouse
  function teleport() {
    if (cd.tele > 0) return;
    cd.tele = 2.5;
    ring(player.x, player.y, 55, C.bolt); burst(player.x, player.y, 18, C.bolt, 260, 0.5);
    const dx = mouse.x - player.x, dy = mouse.y - player.y, d = Math.hypot(dx, dy) || 1, reach = Math.min(d, 340);
    player.x = clamp(player.x + dx / d * reach, A.x + player.r, A.x + A.w - player.r);
    player.y = clamp(player.y + dy / d * reach, A.y + player.r, A.y + A.h - player.r);
    player.kx = 0; player.ky = 0; player.vx = 0; player.vy = 0; player.inv = Math.max(player.inv, 0.35);
    ring(player.x, player.y, 80, C.bolt); burst(player.x, player.y, 22, C.bolt, 300, 0.5);
    for (const e of enemies) {                          // arrival pulse shoves nearby enemies away
      const dd = dist(e, player);
      if (dd < 90) knock(e, (e.x - player.x) / (dd || 1) * 420, (e.y - player.y) / (dd || 1) * 420, 0.5);
    }
    addShake(3); sfx.tele();
  }

  // F: vanish. Enemies lose you unless they bump into you. Next attack hits double.
  function castCloak() {
    if (cd.cloak > 0) return;
    cd.cloak = 10; player.invis = 3.5;
    ring(player.x, player.y, 70, C.bolt); burst(player.x, player.y, 24, C.bolt, 220, 0.6);
    sfx.cloak();
  }

  // R: shapeshift into a wolf. Faster, bites what you touch, click to pounce. Press again to change back.
  function castWolf() {
    if (player.wolf > 0) {
      player.wolf = 0; player.lunge = 0;
      ring(player.x, player.y, 60, C.bolt); burst(player.x, player.y, 16, C.bolt, 220, 0.5);
      return;
    }
    if (cd.wolf > 0) return;
    cd.wolf = 14; player.wolf = 6; player.swing = 0;
    ring(player.x, player.y, 80, C.bolt); burst(player.x, player.y, 30, C.bolt, 300, 0.6);
    addShake(5); sfx.howl();
  }

  function pounce() {
    if (cd.blast > 0 || player.lunge > 0) return;
    cd.blast = 0.9; player.lunge = 0.18; player.lungeA = player.aim; player.lungeHit = new Set();
    sfx.swing();
  }

  function updateLunge(dt) {
    player.lunge -= dt;
    player.x = clamp(player.x + Math.cos(player.lungeA) * 1000 * dt, A.x + player.r, A.x + A.w - player.r);
    player.y = clamp(player.y + Math.sin(player.lungeA) * 1000 * dt, A.y + player.r, A.y + A.h - player.r);
    player.inv = Math.max(player.inv, 0.2);
    player.vx = 0; player.vy = 0;
    for (const e of enemies.slice()) {
      if (player.lungeHit.has(e)) continue;
      if (dist(e, player) < e.r + player.r + 10) {
        player.lungeHit.add(e);
        sfx.hit(); hitstop = 0.05; addShake(6);
        knock(e, Math.cos(player.lungeA) * 520, Math.sin(player.lungeA) * 520, 0.5);
        damage(e, 2);
      }
    }
    particles.push({ x: player.x, y: player.y, vx: 0, vy: 0, life: 0.25, max: 0.25, color: C.bolt, size: 6 });
  }

  // T: fan of piercing daggers
  function castDaggers() {
    if (cd.dagger > 0 || player.wolf > 0) return;
    cd.dagger = 6;
    const sneak = player.invis > 0;
    for (let i = 0; i < 7; i++) {
      const a = player.aim + (i - 3) * 0.17;
      daggers.push({ x: player.x + Math.cos(a) * 18, y: player.y + Math.sin(a) * 18, ang: a, dmg: sneak ? 2 : 1, hit: new Set(), life: 0.75 });
    }
    if (sneak) { player.invis = 0; ring(player.x, player.y, 70, '#ffffff'); }
    addShake(3); sfx.dagger();
  }

  function drawWolf(g, x, y, r, aim, alpha) {
    g.save(); g.translate(x, y); g.globalAlpha = alpha; g.rotate(aim);
    g.fillStyle = '#7f8995';
    g.beginPath(); g.moveTo(-r + 2, -4); g.lineTo(-r - 18, 0); g.lineTo(-r + 2, 4); g.closePath(); g.fill();   // tail
    g.beginPath(); g.ellipse(-2, 0, r + 5, r - 2, 0, 0, 7); g.fill();                                          // body
    g.fillStyle = '#6a737f';
    for (const s of [-1, 1]) {                                                                                  // ears
      g.beginPath(); g.moveTo(r * 0.55, s * r * 0.3); g.lineTo(r * 0.15, s * r * 1.0); g.lineTo(r * 0.95, s * r * 0.75); g.closePath(); g.fill();
    }
    g.fillStyle = '#a3acb7'; g.beginPath(); g.arc(r * 0.95, 0, r * 0.62, 0, 7); g.fill();                       // head
    g.fillStyle = '#7f8995'; g.beginPath(); g.moveTo(r * 1.3, -4); g.lineTo(r * 2.0, 0); g.lineTo(r * 1.3, 4); g.closePath(); g.fill();
    g.fillStyle = C.bolt;
    g.beginPath(); g.arc(r * 1.1, -4, 2, 0, 7); g.fill(); g.beginPath(); g.arc(r * 1.1, 4, 2, 0, 7); g.fill();
    g.restore();
  }

  registerHero({
    id: 'loki', name: 'Loki', team: 'villains', order: 1,
    blurb: 'Trickster. Clones, teleports, cloak, wolf form, daggers.',
    look: {
      capeLab: 'Cape', cape: '#2f9e5b', fx: '#7dffa8', hair: '#1d1d24',
      gears: ['Horned helm', 'Hood', 'Bare head'],
      help: '<b>Hold click</b> to fire an energy blast. <b>Q</b> two illusions, <b>E</b> or <b>right click</b> teleport, <b>F</b> cloak (next attack hits double), <b>R</b> wolf form (click to pounce, touching enemies bites them), <b>T</b> dagger fan that pierces. WASD to move, mouse to aim, <b>P</b> to pause.',
      keys: ['Hold click: blast     Right click / E: teleport', 'Q clones     F cloak', 'R wolf form (click pounces)     T dagger fan']
    },
    cd: { blast: 0, clone: 0, tele: 0, cloak: 0, wolf: 0, dagger: 0 },
    init: () => ({ invis: 0, wolf: 0, lunge: 0, lungeA: 0, lungeHit: new Set() }),
    reset() {
      blasts = [];
    },
    onKey(code, e) {
      if (code === 'KeyQ') castClone();
      if (code === 'KeyE') teleport();
      if (code === 'KeyF') castCloak();
      if (code === 'KeyR') castWolf();
      if (code === 'KeyT') castDaggers();
    },
    onMouse(button) {
      if (button === 2) teleport();
      else { mouse.down = true; fireBlast(); }
    },
    speed() { return player.wolf > 0 ? 360 : 260; },
    update(dt) {
      if (mouse.down) fireBlast();
      if (player.invis > 0) player.invis = Math.max(0, player.invis - dt);
      if (player.wolf > 0) {
        player.wolf -= dt;
        if (player.wolf <= 0) { player.wolf = 0; ring(player.x, player.y, 60, C.bolt); burst(player.x, player.y, 16, C.bolt, 220, 0.5); }
      }
      updateBlasts(dt);
      updateDaggers(dt);
      updateClones(dt);
    },
    postEnemies(dt) {
      // wolf bite: touching enemies get bitten and stunned
      if (player.wolf > 0) {
        for (const e of enemies.slice()) {
          e.bite = Math.max(0, e.bite - dt);
          if (e.bite <= 0 && dist(e, player) < e.r + player.r + 8) {
            e.bite = 0.45;
            const d = dist(e, player) || 1;
            sfx.hit(); burst(e.x, e.y, 8, C.bolt, 220, 0.3);
            knock(e, (e.x - player.x) / d * 300, (e.y - player.y) / d * 300, 0.5);
            damage(e, 1);
          }
        }
      }
      // enemies pop clones they touch
      for (const e of enemies) {
        if (e.pinned || e.stun > 0) continue;
        for (const c of clones.slice()) {
          if (dist(e, c) < e.r + 14) {
            killClone(c);
            const d = dist(e, c) || 1;
            knock(e, (e.x - c.x) / d * 260, (e.y - c.y) / d * 260, 0.8);
          }
        }
      }
    },
    skills() {
      const wolf = player.wolf > 0;
      return [
        { k: 'M1', n: wolf ? 'Pounce' : 'Blast', cd: cd.blast, max: wolf ? 0.9 : 0.6, ok: true },
        { k: 'Q', n: 'Clones',    cd: cd.clone,  max: 8,   ok: true },
        { k: 'E', n: 'Teleport',  cd: cd.tele,   max: 2.5, ok: true },
        { k: 'F', n: 'Cloak',     cd: cd.cloak,  max: 10,  ok: true },
        { k: 'R', n: wolf ? 'Revert' : 'Wolf', cd: wolf ? 0 : cd.wolf, max: 14, ok: true },
        { k: 'T', n: 'Daggers',   cd: cd.dagger, max: 6,   ok: !wolf }
      ];
    },
    message() {
      let msg;
      const wolf = player.wolf > 0;
      if (wolf) msg = 'Wolf form ' + player.wolf.toFixed(1) + 's. Click to pounce.';
      else if (player.invis > 0) msg = 'Cloaked ' + player.invis.toFixed(1) + 's. Next attack hits double.';
      else if (clones.length) msg = 'Illusions are drawing fire.';
      else msg = 'Hold click to blast, right click to teleport.';
      return msg;
    },
    aimLine() { return player.wolf <= 0 ? 520 : 0; },
    drawBefore() {
      // clones (Loki illusions)
      for (const c of clones) {
        const blink = c.life < 1.5 && Math.floor(c.life * 8) % 2 === 0;
        const wob = Math.sin(time * 9 + c.ang) * 1.5;
        ctx.save(); ctx.shadowColor = C.bolt; ctx.shadowBlur = 16;
        drawChar(ctx, c.x + wob, c.y, player.r, player.aim, blink ? 0.25 : 0.6);
        ctx.restore();
        ctx.strokeStyle = fx(0.6); ctx.lineWidth = 1.5; ctx.setLineDash([3, 4]);
        ctx.beginPath(); ctx.arc(c.x + wob, c.y, player.r + 6, 0, 7); ctx.stroke(); ctx.setLineDash([]);
      }
    },
    drawBodyOverride(px, py, alpha) {
      if (player.wolf <= 0) return false;
      ctx.save(); ctx.shadowColor = C.bolt; ctx.shadowBlur = 14;
      drawWolf(ctx, px, py, player.r, player.aim, alpha);
      ctx.restore();
      return true;
    },
    drawOver() {
      for (const b of blasts) {
        ctx.save(); ctx.shadowColor = C.bolt; ctx.shadowBlur = 22;
        ctx.fillStyle = C.bolt; ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, 7); ctx.fill();
        ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(b.x, b.y, b.r * 0.5, 0, 7); ctx.fill();
        ctx.restore();
      }
    },
    gear(g, c) {
      const { r, hr, gear, unsuited } = c; const ch = look.char;
      if (gear === 0) {                                            // horned helm
        g.fillStyle = '#c9a227'; g.beginPath(); g.arc(0, 0, r - 6, 0, 7); g.fill();
        g.strokeStyle = '#e8cc4a'; g.lineWidth = 4; g.lineCap = 'round';
        for (const s of [-1, 1]) {
          g.beginPath(); g.moveTo(0, s * (r - 5)); g.quadraticCurveTo(-3, s * (r + 11), r * 0.9, s * (r + 12)); g.stroke();
        }
      } else if (gear === 1) {                                     // hood
        g.fillStyle = '#1f5a3a'; g.beginPath(); g.arc(-1, 0, r - 3, 0, 7); g.fill();
        g.beginPath(); g.moveTo(-r + 3, -7); g.lineTo(-r - 9, 0); g.lineTo(-r + 3, 7); g.closePath(); g.fill();
        g.fillStyle = '#d9c3a0'; g.beginPath(); g.arc(r * 0.35, 0, r * 0.38, 0, 7); g.fill();
      }
    },
    campaignLocked: true, campaignNote: 'Loki is unavailable in the campaign. He is the one who opened the portal.',
  });

  registerForcedState(10, () => player.lunge > 0, updateLunge);

})();
