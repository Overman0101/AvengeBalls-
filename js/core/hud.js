// Heads-up display: hearts, wave label, skill bar, team meter, boss bar, banners and the end screens.
function drawHud() {
  const HERO = hero();
  ctx.font = '700 22px "Palatino Linotype", Palatino, Georgia, serif'; ctx.textBaseline = 'middle';
  for (let i = 0; i < maxHp(); i++) {
    drawHeart(58 + i * 28, 28, 10, i < player.hp ? '#e04848' : 'rgba(255,255,255,0.14)');
  }
  if (HERO.hudBars) HERO.hudBars();                           // the hero's own bars under the hearts
  ctx.fillStyle = C.ink; ctx.textAlign = 'center';
  ctx.fillText(mode === 'campaign' ? 'Chapter ' + (camp.ch + 1) + '  Wave ' + Math.max(1, camp.cw) + '/' + (CAMPAIGN[camp.ch] ? CAMPAIGN[camp.ch].waves.length : 0) : 'Wave ' + wave, W / 2, 26);
  ctx.textAlign = 'right';
  ctx.fillText('Score ' + score, W - 118, 28);

  ctx.font = '12px "Palatino Linotype", Palatino, Georgia, serif';
  const skills = HERO.skills ? HERO.skills() : [];
  skills.forEach((s, i) => {
    const x = 48 + i * 98, y = 567, w = 92, h = 26, ready = s.cd <= 0 && s.ok;
    ctx.fillStyle = 'rgba(255,255,255,0.08)'; ctx.fillRect(x, y, w, h);
    ctx.fillStyle = s.cd > 0 ? fx(0.18) : fx(0.35);
    ctx.fillRect(x, y, w * (1 - s.cd / s.max), h);
    ctx.strokeStyle = ready ? C.bolt : 'rgba(255,255,255,0.15)'; ctx.lineWidth = 1.5; ctx.strokeRect(x, y, w, h);
    ctx.fillStyle = ready ? C.ink : 'rgba(231,238,244,0.4)';
    ctx.textAlign = 'left'; ctx.fillText(s.k + ' ' + s.n, x + 6, y + h / 2 + 1);
  });
  if (TEAMS[team] && TEAMS[team].ult) {                       // team ultimate meter (press X when full)
    const x = 836, y = 567, w = 84, h = 26, k = teamMeter / 100, rdy = teamMeter >= 100;
    ctx.fillStyle = 'rgba(255,255,255,0.08)'; ctx.fillRect(x, y, w, h);
    ctx.fillStyle = rdy ? 'rgba(255,216,107,0.55)' : 'rgba(255,216,107,0.28)'; ctx.fillRect(x, y, w * k, h);
    ctx.strokeStyle = rdy ? '#ffd86b' : 'rgba(255,255,255,0.15)'; ctx.lineWidth = rdy ? 2 + Math.sin(time * 10) * 0.8 : 1.5; ctx.strokeRect(x, y, w, h);
    ctx.fillStyle = rdy ? '#ffe9a8' : 'rgba(231,238,244,0.5)'; ctx.textAlign = 'left';
    ctx.fillText('X ' + TEAMS[team].ult.label, x + 6, y + h / 2 + 1);
  }

  const msg = HERO.message ? HERO.message() : '';
  ctx.font = '13px "Palatino Linotype", Palatino, Georgia, serif';
  ctx.fillStyle = 'rgba(231,238,244,0.65)'; ctx.textAlign = 'center';
  ctx.fillText(msg, W / 2, 48);
}

function drawBossBar() {
  const b = enemies.find(e => e.boss);
  if (!b) return;
  const w = 420, x = (W - w) / 2, y = 66;
  ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(x - 2, y - 2, w + 4, 16);
  ctx.fillStyle = b.hp < b.max * 0.5 ? '#ff5a3a' : '#c93a3a'; ctx.fillRect(x, y, w * Math.max(0, b.hp) / b.max, 12);
  ctx.font = '700 11px "Palatino Linotype", Palatino, Georgia, serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = '#ffffff'; ctx.fillText(b.name.toUpperCase(), W / 2, y + 6);
}

function drawBanner() {
  if (!banner) return;
  ctx.save(); ctx.globalAlpha = Math.min(1, banner.t / 0.6);
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = '700 44px "Palatino Linotype", Palatino, Georgia, serif';
  ctx.shadowColor = 'rgba(0,0,0,0.8)'; ctx.shadowBlur = 12; ctx.fillStyle = C.bolt;
  ctx.fillText(banner.text, W / 2, H * 0.3); ctx.restore();
}

function drawWin() {
  ctx.fillStyle = 'rgba(10,15,22,0.86)'; ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = C.bolt;
  ctx.font = '700 64px "Palatino Linotype", Palatino, Georgia, serif'; ctx.fillText('VICTORY', W / 2, H / 2 - 70);
  ctx.fillStyle = C.ink; ctx.font = '24px "Palatino Linotype", Palatino, Georgia, serif';
  ctx.fillText('New York is saved.', W / 2, H / 2 - 16);
  ctx.fillText('Score ' + score + '    Best ' + best, W / 2, H / 2 + 26);
  ctx.fillStyle = 'rgba(231,238,244,0.65)'; ctx.font = '18px "Palatino Linotype", Palatino, Georgia, serif';
  ctx.fillText('Click, or press M, to return to the menu', W / 2, H / 2 + 74);
}

function drawOver() {
  ctx.fillStyle = 'rgba(10,15,22,0.8)'; ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center'; ctx.fillStyle = C.bolt;
  ctx.font = '700 56px "Palatino Linotype", Palatino, Georgia, serif';
  ctx.fillText(mode === 'campaign' ? 'You fell in Chapter ' + (camp.ch + 1) : 'You fell on wave ' + wave, W / 2, H / 2 - 40);
  ctx.fillStyle = C.ink; ctx.font = '24px "Palatino Linotype", Palatino, Georgia, serif';
  ctx.fillText('Score ' + score + '    Best ' + best, W / 2, H / 2 + 14);
  ctx.fillStyle = 'rgba(231,238,244,0.65)'; ctx.font = '18px "Palatino Linotype", Palatino, Georgia, serif';
  ctx.fillText(mode === 'campaign' ? 'Click to retry the chapter (your upgrades are kept), or press M for the menu' : 'Click to try again, or press M to change character', W / 2, H / 2 + 56);
}

function drawPause() {
  ctx.fillStyle = 'rgba(10,15,22,0.82)'; ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = C.bolt; ctx.font = '700 54px "Palatino Linotype", Palatino, Georgia, serif';
  ctx.fillText('Paused', W / 2, H / 2 - 110);
  ctx.fillStyle = C.ink; ctx.font = '18px "Palatino Linotype", Palatino, Georgia, serif';
  ctx.fillText('P or Esc to resume     M for character select', W / 2, H / 2 - 62);
  ctx.fillStyle = 'rgba(231,238,244,0.75)'; ctx.font = '16px "Palatino Linotype", Palatino, Georgia, serif';
  CHARS[look.char].keys.forEach((line, i) => ctx.fillText(line, W / 2, H / 2 - 12 + i * 28));
  ctx.fillStyle = 'rgba(231,238,244,0.55)';
  if (TEAMS[team].ult) ctx.fillText('X: team ultimate (' + TEAMS[team].ult.name + '), charged by defeating enemies', W / 2, H / 2 + 72);
  ctx.fillText((mode === 'campaign' ? CAMPAIGN[camp.ch].title : LOCS[locKey].name + '     Wave ' + wave) + '     Score ' + score, W / 2, H / 2 + 104);
}
