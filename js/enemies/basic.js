// The everyday arena enemies used by Endless mode.
//   spawn: { minWave, weight }  makes the type appear in Endless from that wave on.
//   waveSpeed: extra speed per wave.   armor: flat damage reduction.   draw(e, r): custom body (ctx is already at the enemy).
(function () {
  registerEnemy('grunt', { r: 13, hp: 3, speed: 75, score: 10, drop: 0.18, color: '#e8683a', spawn: { minWave: 1, weight: 10 } });
  registerEnemy('runner', {
    r: 10, hp: 2, speed: 150, score: 12, drop: 0.15, color: '#f2c14e', waveSpeed: 2, spawn: { minWave: 2, weight: 5 },
    draw(e, r) {                                                      // arrowhead that points where it runs
  ctx.rotate(e.face);
  ctx.beginPath(); ctx.moveTo(r + 4, 0); ctx.lineTo(-r, -r * 0.95); ctx.lineTo(-r * 0.45, 0); ctx.lineTo(-r, r * 0.95); ctx.closePath(); ctx.fill();
    }
  });
  registerEnemy('brute', {
    r: 21, hp: 6, speed: 55, score: 30, drop: 0.6, color: '#a8412a', spawn: { minWave: 3, weight: 3 },
    draw(e, r) {                                                      // round, with little horns so brutes read as different
      drawRoundEnemy(e, r);
  ctx.fillStyle = '#e7d9c0';
  for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(s * r * 0.55, -r * 0.8); ctx.lineTo(s * r * 0.95, -r * 1.35); ctx.lineTo(s * r * 0.9, -r * 0.55); ctx.fill(); }
    }
  });
  registerEnemy('spitter', {
    r: 12, hp: 3, speed: 70, score: 20, drop: 0.3, color: '#9b59d0', spawn: { minWave: 4, weight: 4 },
    shoot: { every: 2.2, speed: 300 },
    ai(e, dx, dy, d, sp, dt, tgt) { return tgt ? kiteAndShoot(e, dx, dy, d, sp, dt) : false; },
    draw(e, r) {                                                      // diamond with a glowing core
  ctx.beginPath(); ctx.moveTo(0, -r - 3); ctx.lineTo(r + 3, 0); ctx.lineTo(0, r + 3); ctx.lineTo(-r - 3, 0); ctx.closePath(); ctx.fill();
  ctx.shadowColor = '#d9a8ff'; ctx.shadowBlur = 10;
  ctx.fillStyle = '#ecd2ff'; ctx.beginPath(); ctx.arc(0, 0, r * 0.38, 0, 7); ctx.fill();
    }
  });
  registerEnemy('shield', {
    r: 17, hp: 5, speed: 50, score: 25, drop: 0.4, color: '#6d8196', armor: 0.5, spawn: { minWave: 5, weight: 4 },
    draw(e, r) {                                                      // armoured block with a shield arc up front
  ctx.rotate(e.face);
  ctx.fillRect(-r, -r, r * 2, r * 2);
  ctx.shadowBlur = 0;
  ctx.strokeStyle = '#d6dee6'; ctx.lineWidth = 5; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.arc(0, 0, r + 3, -1.0, 1.0); ctx.stroke();
  ctx.fillStyle = '#1a1f26'; ctx.fillRect(-r * 0.2, -r * 0.55, r * 0.28, r * 0.28); ctx.fillRect(-r * 0.2, r * 0.27, r * 0.28, r * 0.28);
    }
  });
})();
