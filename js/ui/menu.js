// The start flow. Step A: pick a mission (Endless or a campaign) and a team. Step B: pick a hero, an arena and a look.
// All cards are built from the registries, so new heroes, teams and campaigns appear here automatically.
function swatches(host, list, key) {
  host.innerHTML = '';
  list.forEach(([hex, name]) => {
    const b = document.createElement('button');
    b.className = 'sw'; b.style.background = hex; b.title = name; b.setAttribute('aria-label', name);
    b.setAttribute('aria-pressed', String(look[key] === hex));
    b.addEventListener('click', () => { look[key] = hex; if (key === 'fx') setFx(hex); refreshMenu(); });
    host.appendChild(b);
  });
}

function applyHero(id) { look.char = id; look.cape = CHARS[id].cape; look.fx = CHARS[id].fx; look.gear = 0; }
function setStep(n) { $('stepA').classList.toggle('hiddenstep', n !== 'A'); $('stepB').classList.toggle('hiddenstep', n !== 'B'); }
const heroLocked = h => mode === 'campaign' && h.campaignLocked;     // e.g. Loki is the villain of the Battle of New York
const teamLocked = t => mode === 'campaign' && !!TEAMS[t].noCampaign;  // a whole team can sit a campaign out (the villains)

function makeCard(id, title, blurb, onClick) {
  const b = document.createElement('button');
  b.className = 'card'; b.id = id; b.setAttribute('aria-pressed', 'false');
  b.innerHTML = '<strong>' + title + '</strong><span>' + blurb + '</span>';
  b.addEventListener('click', onClick);
  return b;
}
function buildMenu() {
  const mc = $('modeCards'); mc.innerHTML = '';
  mc.appendChild(makeCard('mode-endless', 'Endless', 'Survive wave after wave across three arenas and chase a high score.', () => { mode = 'endless'; refreshMenu(); }));
  for (const id in CAMPAIGNS) {
    const c = CAMPAIGNS[id];
    mc.appendChild(makeCard('mode-' + id, 'Campaign: ' + c.name, c.blurb, () => { mode = 'campaign'; campId = id; CAMPAIGN = CAMPAIGNS[id].chapters; refreshMenu(); }));
  }
  const tc = $('teamCards'); tc.innerHTML = '';
  for (const id in TEAMS) tc.appendChild(makeCard('team-' + id, TEAMS[id].name, TEAMS[id].blurb, () => { team = id; refreshMenu(); }));
  const hc = $('heroCards'); hc.innerHTML = '';
  for (const h of heroes()) hc.appendChild(makeCard('hero-' + h.id, h.name, h.blurb, () => pick(h.id)));
}

function refreshMenu() {
  if (mode !== 'campaign' && LOCS[locKey].camp) locKey = 'asgard';
  $('mode-endless').setAttribute('aria-pressed', String(mode === 'endless'));
  for (const id in CAMPAIGNS) $('mode-' + id).setAttribute('aria-pressed', String(mode === 'campaign' && campId === id));
  for (const id in TEAMS) $('team-' + id).setAttribute('aria-pressed', String(team === id));
  if (teamLocked(team)) team = Object.keys(TEAMS).find(t => !teamLocked(t));
  for (const id in TEAMS) { $('team-' + id).disabled = teamLocked(id); $('team-' + id).setAttribute('aria-pressed', String(team === id)); }
  const roster = heroesOfTeam(team);
  if (!roster.some(h => h.id === look.char) || heroLocked(HEROES[look.char])) applyHero(roster.find(h => !heroLocked(h)).id);
  for (const h of heroes()) {
    const c = $('hero-' + h.id);
    c.style.display = h.team === team ? '' : 'none'; c.disabled = heroLocked(h);
    c.setAttribute('aria-pressed', String(look.char === h.id));
  }
  $('stepBTitle').textContent = 'Choose your hero - ' + TEAMS[team].name;
  $('teamNote').textContent = mode === 'campaign' ? roster.filter(h => h.campaignLocked).map(h => h.campaignNote).concat(Object.values(TEAMS).filter(t => t.noCampaign).map(t => t.campaignNote)).join(' ') : '';
  $('arenaRow').style.display = mode === 'campaign' ? 'none' : '';
  $('start').textContent = mode === 'campaign' ? 'Begin Campaign' : 'Start';
  setFx(look.fx);
  $('capeLab').textContent = CHARS[look.char].capeLab;
  swatches($('capes'), CAPES, 'cape');
  swatches($('fxs'), FXS, 'fx');
  const gh = $('gears'); gh.innerHTML = '';
  CHARS[look.char].gears.forEach((name, i) => {
    const b = document.createElement('button');
    b.className = 'gb'; b.textContent = name; b.setAttribute('aria-pressed', String(look.gear === i));
    b.addEventListener('click', () => { look.gear = i; refreshMenu(); });
    gh.appendChild(b);
  });
  const lh = $('locs'); lh.innerHTML = '';
  for (const k in LOCS) {
    if (LOCS[k].camp) continue;
    const b = document.createElement('button');
    b.className = 'gb'; b.textContent = LOCS[k].name; b.setAttribute('aria-pressed', String(locKey === k));
    b.addEventListener('click', () => { locKey = k; amb = []; refreshMenu(); });
    lh.appendChild(b);
  }
  $('locDesc').textContent = LOCS[locKey].desc;
  $('help').innerHTML = CHARS[look.char].help;
}
function pick(id) { applyHero(id); refreshMenu(); }
function showMenu() {
  paused = false; state = 'menu'; setStep('A');
  $('story').classList.add('hidden'); $('perk').classList.add('hidden'); $('menu').classList.remove('hidden');
  refreshMenu();
}
$('next').addEventListener('click', () => { setStep('B'); refreshMenu(); });
$('back').addEventListener('click', () => setStep('A'));
$('storyBtn').addEventListener('click', () => { $('story').classList.add('hidden'); const cb = storyCb; storyCb = null; if (cb) cb(); });
$('start').addEventListener('click', () => {
  audio(); amb = []; $('menu').classList.add('hidden');
  if (mode === 'campaign') startCampaign(); else reset();
});