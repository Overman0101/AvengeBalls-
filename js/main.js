// Boot: runs last, once every hero, enemy, location and campaign has registered itself.
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.033, (now - last) / 1000); last = now;
  if (!paused) update(dt);
  if (state === 'cutscene') drawCutscene(); else draw();
  if (paused) drawPause();
  $('pauseBtn').style.display = state === 'play' ? 'block' : 'none';
  if (state === 'menu') drawPreview();
  requestAnimationFrame(frame);
}

function boot() {
  campId = Object.keys(CAMPAIGNS)[0] || null;
  team = Object.keys(TEAMS)[0];
  applyHero(heroesOfTeam(team)[0].id);
  buildMenu();
  amb = [];
  reset(); state = 'menu'; refreshMenu();
  requestAnimationFrame(frame);
}
boot();
