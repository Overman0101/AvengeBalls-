// Endless mode: waves get bigger forever. Enemy types join by declaring  spawn: { minWave, weight }  (js/enemies/).
function nextWave() {
  wave++;
  spawnLeft = 3 + wave * 2;
  spawnTimer = 0.6;
}

function pickType() {
  const pool = [];
  for (const id in ETYPES) { const s = ETYPES[id].spawn; if (s && wave >= s.minWave) pool.push([id, s.weight]); }
  if (!pool.length) return 'grunt';
  let t = Math.random() * pool.reduce((sum, p) => sum + p[1], 0);
  for (const [k, w] of pool) { t -= w; if (t <= 0) return k; }
  return pool[0][0];
}

function endlessTick(dt) {
  if (spawnLeft > 0) {
    spawnTimer -= dt;
    if (spawnTimer <= 0) { spawnEnemy(); spawnLeft--; spawnTimer = Math.max(0.35, 0.9 - wave * 0.05); }
  } else if (enemies.length === 0) {
    score += 25;
    nextWave();
  }
}
