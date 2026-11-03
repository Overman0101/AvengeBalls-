// Art for the Battle of New York story: story-only characters, backdrops and props. (The script is in newyork-scenes.js.)
(function () {
  // ---------- story-only characters (not playable) ----------
  registerActor({
    id: 'fury', name: 'Nick Fury', color: '#8b94a6',
    draw(g, x, y, r, aim, alpha) {
      g.save(); g.translate(x, y); g.globalAlpha = alpha;
      g.fillStyle = '#1b1e25'; g.beginPath(); g.arc(0, 0, r + 2, 0, 7); g.fill();                 // long black coat
      g.rotate(aim);
      g.fillStyle = '#12141a'; g.beginPath(); g.moveTo(-r * 0.4, -r * 0.95); g.lineTo(-r * 1.55, 0); g.lineTo(-r * 0.4, r * 0.95); g.closePath(); g.fill();   // coat tails
      g.strokeStyle = '#4a5160'; g.lineWidth = 2; g.beginPath(); g.arc(0, 0, r - 2, Math.PI * 0.62, Math.PI * 1.38); g.stroke();            // high collar
      g.fillStyle = '#6b4a35'; g.beginPath(); g.arc(0, 0, r - 5, 0, 7); g.fill();                  // bald head
      g.strokeStyle = '#0b0c10'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(-r * 0.2, -r * 0.62); g.lineTo(r * 0.55, -r * 0.08); g.stroke();   // eyepatch strap
      g.fillStyle = '#0b0c10'; g.beginPath(); g.arc(r * 0.36, -r * 0.26, r * 0.2, 0, 7); g.fill();  // eyepatch
      g.fillStyle = '#e7eef4'; g.beginPath(); g.moveTo(r + 3, 0); g.lineTo(r - 4, -4); g.lineTo(r - 4, 4); g.closePath(); g.fill();           // facing marker
      g.restore();
    }
  });
  registerActor({
    id: 'selvig', name: 'Dr. Erik Selvig', color: '#cfd6de',
    draw(g, x, y, r, aim, alpha) {
      g.save(); g.translate(x, y); g.globalAlpha = alpha;
      g.fillStyle = '#e1e6ec'; g.beginPath(); g.arc(0, 0, r + 1, 0, 7); g.fill();                  // lab coat
      g.rotate(aim);
      g.strokeStyle = '#9aa4b0'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(-r * 0.9, 0); g.lineTo(-r * 0.3, 0); g.stroke();                // coat seam
      g.fillStyle = '#d9b79b'; g.beginPath(); g.arc(0, 0, r - 5, 0, 7); g.fill();                  // head
      g.fillStyle = '#a3a9b2'; g.beginPath(); g.arc(0, 0, r - 5, Math.PI * 0.55, Math.PI * 1.45); g.lineTo(0, 0); g.closePath(); g.fill();   // grey hair
      g.strokeStyle = '#3b3f48'; g.lineWidth = 1.4;                                                  // round glasses
      for (const sd of [-1, 1]) { g.beginPath(); g.arc(r * 0.5, sd * r * 0.3, r * 0.17, 0, 7); g.stroke(); }
      g.beginPath(); g.moveTo(r * 0.5, -r * 0.13); g.lineTo(r * 0.5, r * 0.13); g.stroke();
      g.fillStyle = '#e7eef4'; g.beginPath(); g.moveTo(r + 3, 0); g.lineTo(r - 4, -4); g.lineTo(r - 4, 4); g.closePath(); g.fill();
      g.restore();
    }
  });

  // ---------- helpers ----------
  const grad = (g, y0, y1, c0, c1) => { const gr = g.createLinearGradient(0, y0, 0, y1); gr.addColorStop(0, c0); gr.addColorStop(1, c1); g.fillStyle = gr; g.fillRect(0, y0, W, y1 - y0); };
  function skyline(g, base, col, seed, tall) {                                  // fixed pseudo-random skyline so it never flickers
    g.fillStyle = col; let x = -10, s = seed;
    while (x < W + 10) { s = (s * 9301 + 49297) % 233280; const w = 34 + (s % 50), h = 40 + (s % 180) * tall; g.fillRect(x, base - h, w, h + 400); x += w + 3; }
  }
  function lit(g, base, seed, tall, col) {                                       // lit windows on the skyline
    g.fillStyle = col; let x = -10, s = seed;
    while (x < W + 10) { s = (s * 9301 + 49297) % 233280; const w = 34 + (s % 50), h = 40 + (s % 180) * tall;
      for (let wy = base - h + 8; wy < base - 6; wy += 14) for (let wx = x + 6; wx < x + w - 6; wx += 10) { s = (s * 9301 + 49297) % 233280; if (s % 5 === 0) g.fillRect(wx, wy, 4, 6); }
      x += w + 3; }
  }
  function floorGrid(g, y0, col) {
    g.strokeStyle = col; g.lineWidth = 1;
    for (let i = -8; i <= 16; i++) { g.beginPath(); g.moveTo(480 + (i - 4) * 40, y0); g.lineTo(480 + (i - 4) * 130, H); g.stroke(); }
    for (let k = 1; k < 7; k++) { const y = y0 + (k * k) * 9; g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }
  }

  // ---------- backdrops ----------
  registerStage('lab', (g, t) => {                                               // S.H.I.E.L.D. research facility
    grad(g, 0, 270, '#0c2230', '#143441');
    g.fillStyle = '#091a24'; for (let i = 0; i < 6; i++) g.fillRect(40 + i * 150, 70, 112, 160);
    for (let i = 0; i < 6; i++) { g.fillStyle = 'rgba(111,216,255,' + (0.10 + 0.08 * Math.sin(t * 2 + i)) + ')'; g.fillRect(52 + i * 150, 84, 88, 52); }
    grad(g, 270, H, '#1a3b48', '#0a1b23'); floorGrid(g, 270, 'rgba(120,200,230,0.09)');
    const gl = g.createRadialGradient(480, 400, 6, 480, 400, 130); gl.addColorStop(0, 'rgba(140,230,255,0.35)'); gl.addColorStop(1, 'rgba(60,150,255,0)');
    g.fillStyle = gl; g.beginPath(); g.ellipse(480, 400, 130, 60, 0, 0, 7); g.fill();
    g.strokeStyle = 'rgba(160,235,255,0.55)'; g.lineWidth = 3; g.beginPath(); g.ellipse(480, 405, 52, 22, 0, 0, 7); g.stroke();   // pedestal ring
  });
  registerStage('briefing', (g, t) => {                                          // Fury's war room
    grad(g, 0, 250, '#0d1524', '#131e33');
    for (let i = 0; i < 5; i++) { g.fillStyle = '#0a111d'; g.fillRect(50 + i * 180, 60, 140, 110); g.fillStyle = 'rgba(111,170,255,' + (0.12 + 0.07 * Math.sin(t * 1.5 + i * 2)) + ')'; g.fillRect(58 + i * 180, 68, 124, 94); }
    grad(g, 250, H, '#16213a', '#090e19'); floorGrid(g, 250, 'rgba(120,160,230,0.07)');
    g.fillStyle = '#1d2a47'; g.beginPath(); g.ellipse(480, 440, 290, 96, 0, 0, 7); g.fill();     // the round table
    g.strokeStyle = '#3a4d7c'; g.lineWidth = 4; g.stroke();
    const hg = g.createRadialGradient(480, 430, 4, 480, 430, 120); hg.addColorStop(0, 'rgba(120,200,255,0.45)'); hg.addColorStop(1, 'rgba(120,200,255,0)');
    g.fillStyle = hg; g.beginPath(); g.ellipse(480, 430, 130, 52, 0, 0, 7); g.fill();            // hologram glow
    g.strokeStyle = 'rgba(160,220,255,' + (0.5 + 0.3 * Math.sin(t * 3)) + ')'; g.lineWidth = 2;
    g.beginPath(); g.ellipse(480, 424, 52 + 6 * Math.sin(t * 2), 20, 0, 0, 7); g.stroke();
  });
  registerStage('helicarrier', (g, t, c) => {                                    // deck of the Helicarrier
    grad(g, 0, 250, '#5d86a8', '#9fc0d8');
    g.fillStyle = 'rgba(255,255,255,0.55)'; for (let i = 0; i < 5; i++) { const cx = ((t * 14 + i * 230) % (W + 260)) - 130; g.beginPath(); g.ellipse(cx, 70 + (i % 3) * 38, 90, 20, 0, 0, 7); g.fill(); }
    g.fillStyle = '#33404e'; g.fillRect(0, 232, W, 22);
    for (let x = 0; x < W; x += 60) { g.fillStyle = '#26303c'; g.fillRect(x, 232, 5, 22); }
    grad(g, 254, H, '#58626f', '#2c333d');
    g.fillStyle = '#e8c33a'; for (let x = -40; x < W; x += 90) { g.beginPath(); g.moveTo(x, 548); g.lineTo(x + 40, 548); g.lineTo(x + 20, 580); g.lineTo(x - 20, 580); g.closePath(); g.fill(); }
    g.strokeStyle = 'rgba(255,255,255,0.25)'; g.lineWidth = 3; g.setLineDash([22, 18]); g.beginPath(); g.moveTo(0, 330); g.lineTo(W, 330); g.stroke(); g.setLineDash([]);
  });
  function cityNight(g, t, top, bot, sk, win) {
    grad(g, 0, 330, top, bot); skyline(g, 330, sk, 7, 1.2); lit(g, 330, 7, 1.2, win);
    g.fillStyle = '#0d1522'; g.fillRect(720, 70, 46, 340); g.fillRect(728, 40, 30, 40);        // Stark Tower
    g.fillStyle = 'rgba(160,230,255,0.9)'; g.fillRect(729, 120, 28, 5); g.fillRect(729, 200, 28, 5); g.fillRect(729, 280, 28, 5);
  }
  registerStage('city', (g, t) => {                                              // Manhattan under the portal
    cityNight(g, t, '#1a1030', '#40305a', '#0e1220', 'rgba(255,220,140,0.65)');
    grad(g, 330, H, '#2b2f3a', '#14171e');
    g.fillStyle = '#e8c33a'; for (let x = 0; x < W; x += 120) g.fillRect(x, 450, 60, 5);
    g.fillStyle = '#1b1e26'; g.fillRect(90, 380, 90, 30); g.fillRect(820, 400, 100, 34);          // wrecked cars
  });
  registerStage('sky', (g, t) => {                                               // night sky, the city far below
    grad(g, 0, H, '#0a0820', '#2a1a48');
    for (let i = 0; i < 50; i++) { g.fillStyle = 'rgba(255,255,255,' + (0.3 + 0.4 * Math.abs(Math.sin(t + i))) + ')'; g.fillRect((i * 197) % W, (i * 89) % 330, 2, 2); }
    skyline(g, 520, '#0c1020', 11, 0.9); lit(g, 520, 11, 0.9, 'rgba(255,220,140,0.55)');
    g.fillStyle = '#10151f'; g.fillRect(0, 548, W, 52);                                          // the tower roof
  });
  registerStage('victory', (g, t) => {                                           // dawn over a battered city
    grad(g, 0, 330, '#f0a35e', '#f6d9a0'); skyline(g, 330, '#3a3140', 3, 1); lit(g, 330, 3, 1, 'rgba(255,240,200,0.5)');
    g.fillStyle = 'rgba(255,238,190,0.75)'; g.beginPath(); g.arc(480, 300, 70, 0, 7); g.fill();
    grad(g, 330, H, '#6a6460', '#37332f');
    g.fillStyle = '#2b2825'; for (let i = 0; i < 14; i++) { const x = (i * 211) % W, y = 380 + (i * 57) % 190; g.beginPath(); g.moveTo(x, y); g.lineTo(x + 26, y - 14); g.lineTo(x + 44, y + 4); g.closePath(); g.fill(); }
  });
  registerStage('restaurant', (g, t) => {                                        // a small shawarma place
    grad(g, 0, 270, '#4a2f22', '#6a4430');
    g.fillStyle = '#2a1a12'; g.fillRect(250, 70, 460, 100);
    g.fillStyle = '#f2c14e'; g.font = '700 46px ' + SERIF; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('SHAWARMA', 480, 120);
    for (const lx of [160, 480, 800]) { const lg = g.createRadialGradient(lx, 40, 3, lx, 40, 150); lg.addColorStop(0, 'rgba(255,214,140,0.5)'); lg.addColorStop(1, 'rgba(255,214,140,0)'); g.fillStyle = lg; g.fillRect(lx - 150, 0, 300, 220); }
    grad(g, 270, H, '#7a5236', '#3b261a');
    g.strokeStyle = 'rgba(0,0,0,0.18)'; g.lineWidth = 2; for (let y = 290; y < H; y += 28) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }
    g.fillStyle = '#a9683a'; g.beginPath(); g.ellipse(480, 385, 215, 86, 0, 0, 7); g.fill(); g.strokeStyle = '#6b3f22'; g.lineWidth = 5; g.stroke();   // the table
  });

  // ---------- props ----------
  registerProp('tesseract', (g, p, t) => {
    const s = p.size || 26, pulse = 0.7 + 0.3 * Math.sin(t * 6);
    const gl = g.createRadialGradient(p.x, p.y, 2, p.x, p.y, s * 3.2); gl.addColorStop(0, 'rgba(160,240,255,' + (0.8 * pulse) + ')'); gl.addColorStop(1, 'rgba(60,150,255,0)');
    g.fillStyle = gl; g.beginPath(); g.arc(p.x, p.y, s * 3.2, 0, 7); g.fill();
    g.save(); g.translate(p.x, p.y); g.rotate(t * 0.9); g.fillStyle = '#bff6ff'; g.strokeStyle = '#fff'; g.lineWidth = 2;
    g.fillRect(-s / 2, -s / 2, s, s); g.strokeRect(-s / 2, -s / 2, s, s);
    g.rotate(Math.PI / 4); g.strokeStyle = 'rgba(255,255,255,0.6)'; g.strokeRect(-s * 0.35, -s * 0.35, s * 0.7, s * 0.7); g.restore();
  });
  registerProp('portal', (g, p, t) => {
    const s = p.scale == null ? 1 : p.scale; if (s <= 0.02) return;
    const R = 120 * s, gl = g.createRadialGradient(p.x, p.y, 4, p.x, p.y, R * 1.5);
    gl.addColorStop(0, 'rgba(200,240,255,0.95)'); gl.addColorStop(0.35, 'rgba(110,160,255,0.55)'); gl.addColorStop(1, 'rgba(80,60,200,0)');
    g.fillStyle = gl; g.beginPath(); g.arc(p.x, p.y, R * 1.5, 0, 7); g.fill();
    g.strokeStyle = 'rgba(210,235,255,0.85)'; g.lineWidth = 4;
    for (let i = 0; i < 4; i++) { g.beginPath(); g.arc(p.x, p.y, R * (0.45 + i * 0.17), t * (1.3 - i * 0.4) + i, t * (1.3 - i * 0.4) + i + 2.3); g.stroke(); }
  });
  registerProp('swarm', (g, p, t) => {                                           // Chitauri pouring out of the portal
    if (!p.on) return;
    for (let i = 0; i < 22; i++) {
      const ph = (t * 0.32 + i / 22) % 1, x = p.x + (((i * 53) % 420) - 210) * ph * 1.5, y = p.y + 20 + ph * 430, sz = 7 + (i % 4) * 2 + ph * 5;
      g.save(); g.translate(x, y); g.rotate(i + t); g.fillStyle = '#3f7d96'; g.strokeStyle = '#a8ecff'; g.lineWidth = 1.5; g.beginPath();
      for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4, rr = k % 2 ? sz * 0.62 : sz; g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
      g.closePath(); g.fill(); g.stroke(); g.restore();
    }
  });
  registerProp('missile', (g, p, t) => {
    g.save(); g.translate(p.x, p.y); g.rotate(p.ang == null ? -Math.PI / 2 : p.ang);
    g.fillStyle = '#ffb347'; g.beginPath(); g.moveTo(-26, 0); g.lineTo(-48 - 8 * Math.sin(t * 40), -5); g.lineTo(-48 - 8 * Math.sin(t * 40), 5); g.closePath(); g.fill();   // exhaust
    g.fillStyle = '#c9d0d8'; g.fillRect(-26, -7, 44, 14);
    g.fillStyle = '#e24b4b'; g.beginPath(); g.moveTo(18, -7); g.lineTo(36, 0); g.lineTo(18, 7); g.closePath(); g.fill();
    g.fillStyle = '#f2d03b'; g.beginPath(); g.arc(-4, 0, 4, 0, 7); g.fill(); g.restore();
  });
  registerProp('mothership', (g, p, t) => {
    const a = p.alpha == null ? 1 : p.alpha; if (a <= 0) return;
    g.save(); g.globalAlpha = a; g.translate(p.x, p.y);
    g.fillStyle = '#16202c'; g.beginPath(); g.ellipse(0, 0, 230, 62, 0, 0, 7); g.fill();
    g.fillStyle = '#223244'; g.beginPath(); g.ellipse(0, -14, 150, 36, 0, 0, 7); g.fill();
    for (let i = -4; i <= 4; i++) { g.fillStyle = 'rgba(120,230,255,' + (0.5 + 0.4 * Math.sin(t * 4 + i)) + ')'; g.beginPath(); g.arc(i * 40, 8, 5, 0, 7); g.fill(); }
    g.restore();
  });
  registerProp('food', (g, p, t) => {                                            // shawarma wraps and drinks on the table
    const spots = [[-110, -18], [-30, 26], [60, -26], [120, 18], [-70, 40], [20, -4]];
    for (const [dx, dy] of spots) {
      g.save(); g.translate(p.x + dx, p.y + dy); g.rotate(dx * 0.01);
      g.fillStyle = '#e6c27a'; g.beginPath(); g.ellipse(0, 0, 17, 7, 0, 0, 7); g.fill();
      g.fillStyle = '#b5532f'; g.beginPath(); g.ellipse(-9, 0, 5, 5, 0, 0, 7); g.fill();
      g.fillStyle = '#7aa84a'; g.beginPath(); g.ellipse(2, -1, 6, 3, 0, 0, 7); g.fill();
      g.restore();
    }
    g.strokeStyle = 'rgba(255,255,255,0.25)'; g.lineWidth = 2;
    for (let i = 0; i < 4; i++) { const sx = p.x - 90 + i * 60, ph = (t * 0.8 + i * 0.3) % 1; g.beginPath(); g.moveTo(sx, p.y - 28 - ph * 26); g.quadraticCurveTo(sx + 6, p.y - 36 - ph * 26, sx, p.y - 44 - ph * 26); g.stroke(); }
  });
})();
