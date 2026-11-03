// DEADPOOL: wild dual pistols, katana flurry, throwing daggers, misfiring teleport, chimichanga, Maximum Effort and grenades.

// Self-contained: everything in this file is private to the hero, except what registerHero() hands to the engine.

(function () {

  const dpFree = () => !player.zip && player.roll <= 0;

  function fireDPGuns() {                                             // click (hold): wild dual pistols
    if (cd.dgun > 0 || !dpFree()) return;
    const mx = player.maxE > 0;
    cd.dgun = mx ? 0.05 : 0.13; player.gunSide = -player.gunSide;
    let base = player.aim;
    if (mx) {                                                         // Maximum Effort: shoots the nearest enemy by itself
      let best = null, bd = 1e9;
      for (const e of enemies) { const d = dist(e, player); if (d < bd) { bd = d; best = e; } }
      if (best) base = Math.atan2(best.y - player.y, best.x - player.x);
    }
    const a = base + (Math.random() - 0.5) * (mx ? 0.25 : 0.2);
    const ox = player.x + Math.cos(player.aim) * 20 + Math.cos(player.aim + Math.PI / 2) * 8 * player.gunSide;
    const oy = player.y + Math.sin(player.aim) * 20 + Math.sin(player.aim + Math.PI / 2) * 8 * player.gunSide;
    bullets.push({ x: ox, y: oy, vx: Math.cos(a) * 1150, vy: Math.sin(a) * 1150, dmg: 0.9, life: 0.7 });
    particles.push({ x: ox, y: oy, vx: 0, vy: 0, life: 0.08, max: 0.08, color: '#ffffff', size: 5 });
    sfx.gun();
  }

  // Right click: dual katana flurry, two quick wide slashes
  function castKatana() {
    if (cd.kata > 0 || !dpFree()) return;
    cd.kata = 1.0; player.kata = { n: 2, next: 0 };
  }

  function katanaSlash() {
    player.slashSide = -player.slashSide;
    const aim = assistAim(player.aim, 150, 1.0);
    startSweep({
      kind: 'katana', aim, half: 1.25, dir: player.slashSide, dur: 0.17, reach: 106,
      onHit: (e, d) => {
        knock(e, (e.x - player.x) / (d || 1) * 360, (e.y - player.y) / (d || 1) * 360, 0.25);
        burst(e.x, e.y, 5, '#ffffff', 220, 0.25); damage(e, 1.5); sfx.hit(); hitstop = Math.max(hitstop, 0.03); addShake(3);
      }
    });
    killBoltsNear(player.x + Math.cos(aim) * 50, player.y + Math.sin(aim) * 50, 90);
    lunge(aim, 300); sfx.swing();
  }

  function updateKata(dt) {
    const K = player.kata;
    if (!K) return;
    K.next -= dt;
    if (K.next <= 0) { katanaSlash(); K.n--; K.next = 0.2; if (K.n <= 0) player.kata = null; }
  }

  // Q: three throwing daggers in quick succession
  function castDPDaggers() {
    if (cd.dpdag > 0 || !dpFree()) return;
    cd.dpdag = 4; player.dagq = { n: 3, next: 0 };
  }

  function updateDagq(dt) {
    const D = player.dagq;
    if (!D) return;
    D.next -= dt;
    if (D.next <= 0) {
      const a = player.aim + (Math.random() - 0.5) * 0.07;
      daggers.push({ x: player.x + Math.cos(a) * 18, y: player.y + Math.sin(a) * 18, ang: a, dmg: 1.5, hit: new Set(), life: 0.75 });
      sfx.dagger(); D.n--; D.next = 0.08;
      if (D.n <= 0) player.dagq = null;
    }
  }

  // E: teleport. The belt is a bit unreliable, so you land near where you meant to.
  function castDPTeleport() {
    if (cd.dptele > 0) return;
    cd.dptele = 3;
    ring(player.x, player.y, 55, C.bolt); burst(player.x, player.y, 18, C.bolt, 260, 0.5);
    const dx = mouse.x - player.x, dy = mouse.y - player.y, d = Math.hypot(dx, dy) || 1, reach = Math.min(d, 360);
    player.x = clamp(player.x + dx / d * reach + (Math.random() - 0.5) * 70, A.x + player.r, A.x + A.w - player.r);
    player.y = clamp(player.y + dy / d * reach + (Math.random() - 0.5) * 70, A.y + player.r, A.y + A.h - player.r);
    player.kx = 0; player.ky = 0; player.vx = 0; player.vy = 0; player.inv = Math.max(player.inv, 0.35);
    ring(player.x, player.y, 80, C.bolt); burst(player.x, player.y, 22, C.bolt, 300, 0.5);
    for (const e of enemies) { const dd = dist(e, player); if (dd < 90) knock(e, (e.x - player.x) / (dd || 1) * 420, (e.y - player.y) / (dd || 1) * 420, 0.5); }
    addShake(3); sfx.tele();
  }

  // F: chimichanga. Heals a heart now and another after eating, while you move slowly.
  function castChimi() {
    if (cd.chimi > 0 || player.chimi > 0) return;
    cd.chimi = 35; player.chimi = 2;
    healHeart(); ring(player.x, player.y, 60, '#ffd86b'); sfx.heal();
  }

  // R: Maximum Effort. Four seconds of auto-aiming pistol frenzy, and you move faster.
  function castMaxEffort() {
    if (cd.maxe > 0 || player.maxE > 0) return;
    cd.maxe = 25; player.maxE = 4;
    ring(player.x, player.y, 120, '#ff5a5a'); burst(player.x, player.y, 28, '#ff5a5a', 340, 0.6); flash = 0.2; addShake(8); sfx.roar();
  }

  // T: grenade. A single big blast where you throw it.
  function castDPBomb() {
    if (cd.dpbomb > 0) return;
    cd.dpbomb = 8;
    const dx = mouse.x - player.x, dy = mouse.y - player.y, d = Math.hypot(dx, dy) || 1, reach = Math.min(d, 480);
    bombs.push({
      stage: 'fly', x: player.x, y: player.y, sx: player.x, sy: player.y, t: 0, dur: 0.5, plain: true, rad: 90, dmg: 3.5,
      tx: clamp(player.x + dx / d * reach, A.x + 20, A.x + A.w - 20), ty: clamp(player.y + dy / d * reach, A.y + 20, A.y + A.h - 20)
    });
    sfx.throw();
  }

  registerHero({
    id: 'deadpool', name: 'Deadpool', team: 'xmen', order: 10, modern: true,
    blurb: 'Merc with a mouth. Dual pistols, katanas, daggers, chaos.',
    look: {
      capeLab: 'Suit', cape: '#b3212a', fx: '#ff5a5a', hair: '#2a1a14',
      gears: ['Full mask', 'Mask pulled up', 'Bare head'],
      help: '<b>Hold click</b> fires the dual pistols (a little wild). <b>Right click</b> is a double katana flurry that also swats bolts away. <b>Q</b> three throwing daggers, <b>E</b> teleport (the belt misfires a bit), <b>F</b> chimichanga (heals 2 hearts, but you move slowly while eating), <b>R</b> Maximum Effort (4 seconds of auto-aiming pistol frenzy), <b>T</b> grenade, <b>Space</b> roll. Regeneration: a heart returns every 10 seconds. WASD to move, mouse to aim, <b>P</b> to pause.',
      keys: ['Hold click: pistols     Right click: katana flurry     Space: roll', 'Q daggers     E teleport     F chimichanga', 'R Maximum Effort     T grenade     Passive: regeneration']
    },
    cd: { dgun: 0, kata: 0, dpdag: 0, dptele: 0, chimi: 0, maxe: 0, dpbomb: 0 },
    init: () => ({ kata: null, dagq: null, slashFlash: 0, slashSide: 1, chimi: 0, maxE: 0, regenT: 6, gunSide: 1 }),
    onKey(code, e) {
      if (code === 'KeyQ') castDPDaggers();
      if (code === 'KeyE') castDPTeleport();
      if (code === 'KeyF') castChimi();
      if (code === 'KeyR') castMaxEffort();
      if (code === 'KeyT') castDPBomb();
      if (code === 'Space') castRoll();
    },
    onMouse(button) {
      if (button === 2) castKatana(); else { mouse.down = true; fireDPGuns(); }
    },
    preMove(dt) {
      const iv = 10;                               // healing factor: a heart returns every few seconds
      if (player.hp < maxHp()) { player.regenT = Math.min(player.regenT, iv) - dt; if (player.regenT <= 0) { healHeart(); player.regenT = iv; } }
      else player.regenT = iv;
      return {};
    },
    speed() { return 270 * (player.chimi > 0 ? 0.5 : 1) * (player.maxE > 0 ? 1.2 : 1); },
    update(dt) {
      if (mouse.down || player.maxE > 0) fireDPGuns();
      if (player.maxE > 0) player.maxE = Math.max(0, player.maxE - dt);
      if (player.chimi > 0) { player.chimi -= dt; if (player.chimi <= 0) { player.chimi = 0; healHeart(); } }
      if (player.slashFlash > 0) player.slashFlash -= dt;
      updateBullets(dt); updateDaggers(dt); updateBombs(dt); updateKata(dt); updateDagq(dt);
    },
    hudBars() {
      const iv = 10, full = player.hp >= maxHp();
      ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.fillRect(48, 46, 140, 6);
      ctx.fillStyle = full ? '#7dff9a' : 'rgba(125,255,154,0.75)';
      ctx.fillRect(48, 46, 140 * (full ? 1 : Math.max(0, 1 - player.regenT / iv)), 6);
      ctx.font = '11px "Palatino Linotype", Palatino, Georgia, serif'; ctx.textAlign = 'left';
      ctx.fillStyle = 'rgba(231,238,244,0.7)'; ctx.fillText('REGENERATION', 194, 49);
      ctx.font = '700 22px "Palatino Linotype", Palatino, Georgia, serif';
    },
    skills() {
      return [
        { k: 'M1', n: 'Pistols',  cd: cd.dgun,   max: 0.13, ok: dpFree() },
        { k: 'RMB', n: 'Katanas', cd: cd.kata,   max: 1.0,  ok: dpFree() },
        { k: 'Q', n: 'Daggers',   cd: cd.dpdag,  max: 4,    ok: dpFree() },
        { k: 'E', n: 'Teleport',  cd: cd.dptele, max: 3,    ok: true },
        { k: 'F', n: 'Chimi',     cd: cd.chimi,  max: 35,   ok: player.chimi <= 0 },
        { k: 'R', n: 'Max Effort', cd: cd.maxe,  max: 25,   ok: player.maxE <= 0 },
        { k: 'T', n: 'Grenade',   cd: cd.dpbomb, max: 8,    ok: true },
        { k: 'Space', n: 'Roll',  cd: cd.roll,   max: 2.5,  ok: !player.zip }
      ];
    },
    message() {
      let msg;
      if (player.maxE > 0) msg = 'MAXIMUM EFFORT! ' + player.maxE.toFixed(1) + 's';
      else if (player.chimi > 0) msg = 'Maximum chimichanga... (moving slowly)';
      else msg = 'Hold click: pistols. Right click: katanas.';
      return msg;
    },
    drawPlayerFx(px, py) {
        ctx.save(); ctx.translate(px, py); ctx.rotate(player.aim);       // two pistols
        ctx.fillStyle = '#1a1d24'; ctx.fillRect(12, -11, 11, 4); ctx.fillRect(12, 7, 11, 4);
        if (cd.dgun > 0.04) { ctx.fillStyle = '#ffffff'; ctx.shadowColor = C.bolt; ctx.shadowBlur = 10; ctx.fillRect(23, player.gunSide > 0 ? 7 : -11, 4, 4); }
        ctx.restore();
        if (player.maxE > 0) {                                           // Maximum Effort aura
          ctx.strokeStyle = 'rgba(255,90,90,' + (0.4 + 0.25 * Math.sin(time * 16)) + ')'; ctx.lineWidth = 3;
          ctx.beginPath(); ctx.arc(px, py, player.r + 8, 0, 7); ctx.stroke();
        }
        if (player.chimi > 0) {                                          // munching a chimichanga
          ctx.save(); ctx.translate(px + Math.cos(player.aim) * (player.r + 6), py + Math.sin(player.aim) * (player.r + 6)); ctx.rotate(player.aim + Math.sin(time * 18) * 0.15);
          ctx.fillStyle = '#d9a441'; ctx.beginPath(); ctx.ellipse(0, 0, 11, 6, 0, 0, 7); ctx.fill();
          ctx.fillStyle = '#b57c28'; ctx.fillRect(-9, -1, 18, 2); ctx.restore();
        }
    },
    gear(g, c) {
      const { r, hr, gear, unsuited } = c; const ch = look.char;
      g.strokeStyle = '#14121a'; g.lineWidth = 6; g.beginPath(); g.arc(0, 0, r - 1, Math.PI * 0.6, Math.PI * 1.4); g.stroke();   // black sides
      g.strokeStyle = '#cfd6df'; g.lineWidth = 2; g.beginPath();                           // two katanas crossed on the back
      g.moveTo(-r * 0.25, -r * 0.7); g.lineTo(-r * 1.15, r * 0.95); g.moveTo(-r * 0.25, r * 0.7); g.lineTo(-r * 1.15, -r * 0.95); g.stroke();
      g.strokeStyle = '#14121a'; g.lineWidth = 3; g.beginPath();
      g.moveTo(-r * 0.25, -r * 0.7); g.lineTo(-r * 0.4, -r * 0.45); g.moveTo(-r * 0.25, r * 0.7); g.lineTo(-r * 0.4, r * 0.45); g.stroke();
      if (gear === 0) {                                                                    // full mask with the eye patches
        g.fillStyle = look.cape; g.beginPath(); g.arc(0, 0, hr + 1, 0, 7); g.fill();
        g.fillStyle = '#14121a';
        for (const sd of [-1, 1]) { g.beginPath(); g.ellipse(hr * 0.5, sd * hr * 0.3, hr * 0.34, hr * 0.18, sd * 0.45, 0, 7); g.fill(); }
        g.fillStyle = '#ffffff';
        for (const sd of [-1, 1]) { g.beginPath(); g.ellipse(hr * 0.55, sd * hr * 0.3, hr * 0.18, hr * 0.08, sd * 0.45, 0, 7); g.fill(); }
      } else if (gear === 1) {                                                             // mask pulled up, scarred face showing
        g.fillStyle = look.cape; g.beginPath(); g.arc(-1, 0, hr + 1, Math.PI * 0.45, Math.PI * 1.55); g.closePath(); g.fill();
        g.strokeStyle = 'rgba(120,50,50,0.7)'; g.lineWidth = 1; g.beginPath();
        g.moveTo(hr * 0.2, -hr * 0.4); g.lineTo(hr * 0.6, -hr * 0.1); g.moveTo(hr * 0.3, hr * 0.5); g.lineTo(hr * 0.7, hr * 0.2); g.stroke();
      } else {                                                                             // bare scarred head
        g.strokeStyle = 'rgba(120,50,50,0.7)'; g.lineWidth = 1; g.beginPath();
        g.moveTo(hr * 0.2, -hr * 0.4); g.lineTo(hr * 0.6, -hr * 0.1); g.moveTo(hr * 0.3, hr * 0.5); g.lineTo(hr * 0.7, hr * 0.2); g.stroke();
      }
    },
  });

})();
