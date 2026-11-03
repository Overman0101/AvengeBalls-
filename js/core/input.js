// Keyboard, mouse and pause handling.
// Hero controls live in each hero file: hero.onKey(code, e) for keys (not key-repeat),
// hero.onKeyAny(code, e) if it needs repeats too, and hero.onMouse(button) for clicks.
const keys = new Set();
const mouse = { x: W / 2, y: H / 2, down: false, rdown: false };
let paused = false;
function setPause(p) {
  paused = p && state === 'play';
  mouse.down = false; mouse.rdown = false;
  $('pauseBtn').textContent = paused ? 'Resume (P)' : 'Pause (P)';
}
addEventListener('keydown', e => {
  keys.add(e.code);
  if (state === 'cutscene') {                                            // story scene: Space/Enter continue, Esc skips
    if (e.code === 'Escape') skipCutscene(); else if (e.code === 'Space' || e.code === 'Enter') { e.preventDefault(); advanceCutscene(); }
    return;
  }
  if ((state === 'over' || state === 'win') && e.code === 'KeyM') { showMenu(); return; }
  if (state === 'play' && (e.code === 'KeyP' || e.code === 'Escape')) { setPause(!paused); return; }
  if (paused) { if (e.code === 'KeyM') { showMenu(); } return; }
  if (e.code === 'Space') e.preventDefault();
  const HERO = hero();
  if (state === 'play' && HERO.onKeyAny) HERO.onKeyAny(e.code, e);
  if (state === 'play' && !e.repeat) {
    if (e.code === 'KeyX') castTeamUlt();
    if (HERO.onKey) HERO.onKey(e.code, e);
  }
});
addEventListener('keyup', e => keys.delete(e.code));
addEventListener('mouseup', e => { if (e && e.button === 2) mouse.rdown = false; else mouse.down = false; });
addEventListener('blur', () => { if (state === 'play') setPause(true); });
cv.addEventListener('mousemove', e => {
  const r = cv.getBoundingClientRect();
  mouse.x = (e.clientX - r.left) * W / r.width;
  mouse.y = (e.clientY - r.top) * H / r.height;
});
cv.addEventListener('contextmenu', e => e.preventDefault());
cv.addEventListener('mousedown', e => {
  if (state === 'cutscene') { advanceCutscene(); return; }
  if (state === 'win') { showMenu(); return; }
  if (state === 'over') { if (mode === 'campaign') retryChapter(); else reset(); return; }
  if (state !== 'play' || paused) return;
  const HERO = hero();
  if (HERO.onMouse) HERO.onMouse(e.button);
});
$('pauseBtn').addEventListener('click', e => { setPause(!paused); e.currentTarget.blur(); });
