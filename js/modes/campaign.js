// The campaign engine: chapters made of waves, story screens before and after, an upgrade pick between chapters,
// and a retry on death. The content (story text, waves, bosses, arenas) lives in js/campaigns/.
let CAMPAIGN = [];                    // chapters of the selected campaign, set by startCampaign()
let storyCb = null, perkChoices = [];

const storyLines = v => Array.isArray(v) ? v : (v[team] || Object.values(v)[0]);

// A chapter's story is either cutscenes (introScenes / outroScenes: lists of scene ids) or plain text (intro / outro).
function playIntro(C, cb) {
  if (C.introScenes) playScenes(C.introScenes, cb); else showStory(C.title, storyLines(C.intro), 'Begin', cb);
}
function playOutro(C, title, btn, cb) {
  if (C.outroScenes) playScenes(C.outroScenes, cb); else showStory(title, storyLines(C.outro), btn, cb);
}

function startCampaign() {
  mode = 'campaign'; perks = freshPerks();
  CAMPAIGN = CAMPAIGNS[campId].chapters;
  camp = { ch: 0, cw: 0, queue: [], wait: 0, score: 0, over: false };
  reset();
  const C = CAMPAIGN[0];
  playIntro(C, () => { state = 'play'; banner = { text: C.title, t: 2.5 }; });
}

function beginChapterSetup() {
  const C = CAMPAIGN[camp.ch];
  locKey = C.loc; amb = []; camp.cw = 0; camp.wait = 1.2; camp.queue = []; camp.over = false;
  teamMeter = perks.tstart;
}

function startCampWave() {
  const C = CAMPAIGN[camp.ch], q = [];
  camp.cw++;
  for (const [t, n] of C.waves[camp.cw - 1]) for (let i = 0; i < n; i++) q.push(t);
  shuffle(q);
  q.sort((a, b) => (ETYPES[b].boss ? 1 : 0) - (ETYPES[a].boss ? 1 : 0));          // bosses first
  camp.queue = q; spawnLeft = q.length; spawnTimer = 0.4; wave = camp.ch * 3 + camp.cw;
  banner = { text: 'WAVE ' + camp.cw + ' / ' + C.waves.length, t: 2 };
}

function campWaveCleared() {
  const C = CAMPAIGN[camp.ch];
  if (camp.cw >= C.waves.length) { completeChapter(); return; }
  camp.wait = 2.5; banner = { text: 'WAVE CLEARED', t: 1.8 };
}

function completeChapter() {
  const C = CAMPAIGN[camp.ch], last = camp.ch === CAMPAIGN.length - 1;
  camp.over = true; camp.score = score; ebolts = [];
  playOutro(C, 'Chapter ' + (camp.ch + 1) + ' cleared', last ? 'Finish' : 'Continue', () => {
    if (last) victory(); else showPerks();
  });
}

function victory() { state = 'win'; best = Math.max(best, score); }

function showStory(title, lines, btn, cb) {
  $('storyKicker').textContent = mode === 'campaign' ? CAMPAIGNS[campId].name : '';
  $('storyTitle').textContent = title;
  $('storyText').innerHTML = lines.map((l, i) => '<p style="animation-delay:' + (i * 0.9) + 's">' + l + '</p>').join('');
  $('storyBtn').textContent = btn; storyCb = cb;
  state = 'story'; $('story').classList.remove('hidden');
}

function showPerks() {
  const pool = PERKS.filter(p => p.ok());
  shuffle(pool); perkChoices = pool.slice(0, 3);
  const host = $('perkCards'); host.innerHTML = '';
  perkChoices.forEach(p => {
    const b = document.createElement('button');
    b.className = 'card'; b.innerHTML = '<strong>' + p.name + '</strong><span>' + p.desc + '</span>';
    b.addEventListener('click', () => pickPerk(p));
    host.appendChild(b);
  });
  state = 'perk'; $('perk').classList.remove('hidden');
}

function pickPerk(p) {
  p.apply(); $('perk').classList.add('hidden');
  camp.ch++; reset();                                                  // a new chapter patches you up and keeps your upgrades
  const C = CAMPAIGN[camp.ch];
  playIntro(C, () => { state = 'play'; banner = { text: C.title, t: 2.5 }; });
}

function retryChapter() {
  reset(); state = 'play'; banner = { text: CAMPAIGN[camp.ch].title, t: 2.5 };
}

function campaignTick(dt) {
  if (camp.wait > 0) { camp.wait -= dt; if (camp.wait <= 0) startCampWave(); }
  else if (spawnLeft > 0) {
    spawnTimer -= dt;
    if (spawnTimer <= 0) { spawnEnemy(); spawnLeft--; spawnTimer = 0.45; }
  } else if (enemies.length === 0 && !camp.over && camp.cw > 0) {
    score += 25; campWaveCleared();
  }
}
