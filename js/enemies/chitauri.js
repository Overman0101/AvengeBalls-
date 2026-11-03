// The Chitauri army (Battle of New York campaign): soldiers, gunners, hover-sled riders and two bosses.
(function () {
  function drawBody(e) { drawChitauri(e); }
  function drawChitauri(e) {                                            // the Chitauri army (ctx is already at the enemy)
    const r = e.r;
    ctx.rotate(e.face);
    if (e.type === 'chit') {                                            // armored soldier with a glowing visor
      ctx.beginPath(); for (let i = 0; i < 8; i++) { const a = i / 8 * 6.283 + 0.39; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); } ctx.closePath(); ctx.fill();
      ctx.shadowBlur = 0; ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.arc(-r * 0.2, 0, r * 0.62, 0, 7); ctx.fill();
      ctx.fillStyle = '#8fe8ff'; ctx.shadowColor = '#6fd8ff'; ctx.shadowBlur = 8; ctx.fillRect(r * 0.3, -r * 0.18, r * 0.5, r * 0.36);
    } else if (e.type === 'gunner') {                                   // hexagonal gunner with a barrel
      ctx.beginPath(); for (let i = 0; i < 6; i++) { const a = i / 6 * 6.283; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); } ctx.closePath(); ctx.fill();
      ctx.shadowBlur = 0; ctx.fillStyle = '#26333f'; ctx.fillRect(r * 0.5, -3, r * 0.95, 6);
      ctx.fillStyle = '#6fd8ff'; ctx.shadowColor = '#6fd8ff'; ctx.shadowBlur = 10; ctx.beginPath(); ctx.arc(r * 1.5, 0, 3.5, 0, 7); ctx.fill();
    } else if (e.type === 'rider') {                                    // hover-sled
      const boosting = e.cs === 'dash';
      ctx.fillStyle = '#4c5d73';
      for (const sd of [-1, 1]) { ctx.beginPath(); ctx.moveTo(-r * 0.2, sd * r * 0.7); ctx.lineTo(-r * 1.4, sd * r * 1.35); ctx.lineTo(r * 0.3, sd * r * 0.85); ctx.closePath(); ctx.fill(); }
      ctx.fillStyle = e.stun > 0 ? '#c9a08a' : e.color; ctx.beginPath(); ctx.ellipse(0, 0, r * 1.25, r * 0.8, 0, 0, 7); ctx.fill();
      ctx.shadowBlur = 0; ctx.fillStyle = '#26333f'; ctx.beginPath(); ctx.arc(r * 0.1, 0, r * 0.42, 0, 7); ctx.fill();
      ctx.fillStyle = '#6fd8ff'; ctx.shadowColor = '#6fd8ff'; ctx.shadowBlur = 10; ctx.beginPath(); ctx.arc(-r * 1.3, 0, boosting ? 7 : 4, 0, 7); ctx.fill();
    } else if (e.type === 'leviathan') {                                // huge armored war-beast
      for (let k = 4; k >= 1; k--) {
        const wob = Math.sin(time * 3 + k) * r * 0.12;
        ctx.fillStyle = k % 2 ? '#2c4658' : '#35566c';
        ctx.beginPath(); ctx.arc(-r * 0.95 * k, wob, r * (0.9 - k * 0.12), 0, 7); ctx.fill();
      }
      ctx.fillStyle = e.stun > 0 ? '#c9a08a' : e.color; ctx.beginPath(); ctx.arc(0, 0, r, 0, 7); ctx.fill();
      ctx.shadowBlur = 0; ctx.fillStyle = '#16232d'; ctx.beginPath(); ctx.arc(r * 0.55, 0, r * 0.5, -1.1, 1.1); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#6fd8ff'; ctx.shadowColor = '#6fd8ff'; ctx.shadowBlur = 12;
      for (const sd of [-1, 1]) { ctx.beginPath(); ctx.arc(r * 0.3, sd * r * 0.55, r * 0.1, 0, 7); ctx.fill(); }
      for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.arc(-r * 0.2 - k * r * 0.3, 0, r * 0.07, 0, 7); ctx.fill(); }
    } else {                                                            // warlord: horned heavy armor with a glowing eye band
      ctx.fillStyle = '#2a2236'; ctx.beginPath(); ctx.moveTo(-r * 0.4, -r * 0.9); ctx.lineTo(-r * 1.7, 0); ctx.lineTo(-r * 0.4, r * 0.9); ctx.closePath(); ctx.fill();
      ctx.fillStyle = e.stun > 0 ? '#c9a08a' : e.color;
      ctx.beginPath(); for (let i = 0; i < 8; i++) { const a = i / 8 * 6.283 + 0.39; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); } ctx.closePath(); ctx.fill();
      ctx.shadowBlur = 0; ctx.fillStyle = '#d6c8e0';
      for (const sd of [-1, 1]) { ctx.beginPath(); ctx.moveTo(r * 0.2, sd * r * 0.6); ctx.lineTo(r * 0.9, sd * r * 1.45); ctx.lineTo(r * 0.55, sd * r * 0.45); ctx.closePath(); ctx.fill(); }
      ctx.fillStyle = e.hp < e.max * 0.5 ? '#ff6a6a' : '#6fd8ff'; ctx.shadowColor = ctx.fillStyle; ctx.shadowBlur = 14; ctx.fillRect(r * 0.2, -r * 0.14, r * 0.7, r * 0.28);
    }
  }

  function bossExtras(e, dt) {
    e.bt -= dt;
    if (e.type === 'leviathan') {
      if (e.bt <= 0) {                                                  // spits out Chitauri
        e.bt = 5.5;
        for (let i = 0; i < 3; i++) enemies.push(makeEnemy('chit', e.x + (i - 1) * 32, e.y));
        ring(e.x, e.y, 80, '#6fd8ff'); sfx.roar();
      }
    } else if (e.type === 'warlord') {
      const enraged = e.hp < e.max * 0.5;
      if (enraged) e.speed = Math.max(e.speed, 88);
      if (e.bt <= 0) {                                                  // radial volley
        e.bt = enraged ? 2.0 : 3.0;
        const n = enraged ? 12 : 8, off = Math.random() * 6.28;
        for (let i = 0; i < n; i++) {
          const a = off + i / n * Math.PI * 2;
          ebolts.push({ x: e.x, y: e.y, vx: Math.cos(a) * 260, vy: Math.sin(a) * 260, life: 3.2, friendly: false, col: '#6fd8ff' });
        }
        ring(e.x, e.y, 70, '#6fd8ff'); sfx.spit();
      }
      if (enraged && !e.summoned) {
        e.summoned = true;
        for (let i = 0; i < 4; i++) enemies.push(makeEnemy('chit', e.x + (i - 1.5) * 30, e.y + 30));
        ring(e.x, e.y, 120, '#ff5050'); flash = 0.25; addShake(8); sfx.roar();
      }
    }
  }

  const charge = (e, dx, dy, d, sp, dt, tgt) => { chargerMove(e, dx, dy, d, sp, dt, tgt); return true; };   // riders and bosses charge
  registerEnemy('chit', { r: 13, hp: 3, speed: 85, score: 12, drop: 0.16, color: '#4f8ea5', draw: drawBody });
  registerEnemy('gunner', {
    r: 12, hp: 3, speed: 70, score: 20, drop: 0.3, color: '#3f6f8f', draw: drawBody,
    shoot: { every: 1.7, speed: 340, col: '#6fd8ff' },
    ai(e, dx, dy, d, sp, dt, tgt) { return tgt ? kiteAndShoot(e, dx, dy, d, sp, dt) : false; }
  });
  registerEnemy('rider', { r: 15, hp: 4, speed: 95, score: 22, drop: 0.3, color: '#6f86a0', draw: drawBody, ai: charge });
  registerEnemy('leviathan', { r: 46, hp: 70, speed: 42, score: 300, drop: 1, color: '#35566c', boss: true, name: 'Leviathan', draw: drawBody, ai: charge, tick: bossExtras });
  registerEnemy('warlord', { r: 30, hp: 90, speed: 65, score: 500, drop: 1, color: '#7c5f90', boss: true, name: 'Chitauri Warlord', draw: drawBody, ai: charge, tick: bossExtras });
})();
