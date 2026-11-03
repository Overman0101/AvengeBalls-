// Automated checks for the whole project. Run with:  node tests/run.js   (Node 16+, no dependencies)
// It plays every hero in every arena, walks the full campaign, and checks the architecture rules that keep
// the project conflict-free (hero code stays in hero files, every script is listed, and so on).
const assert = require('assert');
const fs = require('fs'), path = require('path');
const { loadGame, ROOT } = require('./harness');

const tests = [];
const test = (name, fn) => tests.push([name, fn]);
const lcg = s => { let x = (s * 2654435761) >>> 0 || 1; return () => { x = (Math.imul(x, 1664525) + 1013904223) >>> 0; return x / 4294967296; }; };

// ---- helpers ----
function startRun(g, { hero, mode = 'endless', loc } = {}) {
  const team = g.eval(`HEROES['${hero}'].team`);
  g.fire(mode === 'campaign' ? 'mode-' + g.eval('Object.keys(CAMPAIGNS)[0]') : 'mode-endless');
  g.fire('team-' + team); g.fire('next'); g.fire('hero-' + hero); g.fire('start');
  if (loc && mode === 'endless') g.eval(`locKey = '${loc}'; amb = [];`);
}
// Scripted "button masher": moves, aims, clicks and presses every skill key. Same seed = same inputs.
function mash(g, frames, seed, onFrame) {
  const rng = lcg(seed), held = new Set(), timers = {};
  const move = ['KeyW', 'KeyA', 'KeyS', 'KeyD'], skills = ['KeyQ', 'KeyE', 'KeyF', 'KeyR', 'KeyT', 'KeyG', 'Space', 'ShiftLeft', 'KeyX'];
  let down = false;
  for (let f = 0; f < frames; f++) {
    if (rng() < 0.02) { for (const k of move) if (held.has(k)) { g.keyup(k); held.delete(k); } for (const k of move) if (rng() < 0.4) { g.key(k); held.add(k); } }
    if (f % 12 === 0) g.mouseMove(60 + rng() * 840, 70 + rng() * 480);
    if (rng() < 0.03) { if (down) g.mouseUp(0); else g.mouseDown(0); down = !down; }
    if (rng() < 0.03) { g.mouseDown(2); g.mouseUp(2); }
    if (rng() < 0.07) { const k = skills[Math.floor(rng() * skills.length)]; g.key(k, { shiftKey: rng() < 0.2 }); timers[k] = f + 12; }
    for (const k in timers) if (timers[k] === f) { g.keyup(k); delete timers[k]; }
    g.frames(1);
    if (onFrame) onFrame(f);
  }
}
const snapshot = g => g.eval(`JSON.stringify({ s: state, hp: player.hp, x: +player.x.toFixed(2), y: +player.y.toFixed(2), n: enemies.length, score, wave })`);
const clearField = g => g.eval('enemies.length = 0; spawnLeft = 0; if (camp.queue) camp.queue.length = 0; ebolts.length = 0;');
const heroIds = g => g.eval('heroes().map(h => h.id)');


// The story, in the author's words. These lines (and scene titles) must appear in this order; extra lines in between are fine.
const STORY = [
  ['say', 'Nick Fury', 'The Tesseract is becoming unstable. We need to secure it immediately!'],
  ['say', 'Loki', 'Earth is ready to kneel before me.'],
  ['narrate', null, 'Loki steals the Tesseract, takes control of Hawkeye and Dr. Erik Selvig, and escapes.'],
  ['say', 'Nick Fury', 'We are facing a threat that no single hero can stop. We need to bring together the strongest people on Earth.'],
  ['narrate', null, 'Fury recruits Iron Man, Captain America, Thor, Hulk, Black Widow, and Hawkeye.'],
  ['say', 'Captain America', "So, what's our mission?"],
  ['say', 'Nick Fury', 'Find Loki, recover the Tesseract, and save the world.'],
  ['narrate', null, 'The Avengers gather aboard the S.H.I.E.L.D. Helicarrier.'],
  ['say', 'Tony Stark', "I work alone. I don't need a team telling me what to do."],
  ['say', 'Steve Rogers', "This isn't about you. We need to work together."],
  ['narrate', null, 'Loki escapes, causing chaos aboard the Helicarrier. The Hulk loses control, and the team begins to fall apart.'],
  ['narrate', null, 'Loki opens a portal above New York City, allowing the Chitauri army to invade.'],
  ['say', 'Captain America', 'Avengers, assemble!'],
  ['narrate', null, 'The heroes unite and fight the alien army to protect innocent civilians.'],
  ['say', 'Thor', 'We must stop Loki!'],
  ['say', 'Iron Man', "I've got an idea. Let's take this fight somewhere else!"],
  ['narrate', null, 'A nuclear missile is launched toward New York. Iron Man intercepts it and carries it through the portal toward the alien mothership.'],
  ['say', 'Black Widow', 'The portal is closing!'],
  ['narrate', null, 'Iron Man successfully destroys the mothership and falls back through the portal just before it closes.'],
  ['narrate', null, 'The Chitauri army is defeated. New York is saved.'],
  ['say', 'Captain America', 'We did it. We actually did it.'],
  ['say', 'Tony Stark', "Don't get used to it, Captain."],
  ['narrate', null, 'Thor takes Loki and the Tesseract back to Asgard. The Avengers go their separate ways.'],
  ['narrate', null, 'The Avengers gather at a small restaurant and quietly eat shawarma after saving the world.'],
  ['card', null, 'THE END.']
];
const TITLES = ['SCENE 1: THE TESSERACT', 'SCENE 2: ASSEMBLING THE AVENGERS', 'SCENE 3: THE TEAM CONFLICT', 'SCENE 4: THE BATTLE OF NEW YORK',
                'SCENE 5: THE FINAL SACRIFICE', 'SCENE 6: THE VICTORY', 'SCENE 7: POST-CREDITS'];
function assertStoryContract(log, titles) {
  assert.deepStrictEqual(Array.from(titles), TITLES, 'scene titles');
  let at = 0;
  for (const [kind, who, text] of STORY) {
    const i = log.findIndex((l, k) => k >= at && l.kind === kind && l.text === text && (!who || l.as === who));
    assert(i >= 0, `story line missing or out of order: [${kind}] ${who ? who + ': ' : ''}${text}`);
    at = i + 1;
  }
}

// ================= registries and contracts =================
test('every script in index.html exists, and every file under js/ is listed (no orphans)', () => {
  const g = loadGame();
  for (const s of g.scripts) assert(fs.existsSync(path.join(ROOT, s)), 'missing ' + s);
  const listed = new Set(g.scripts.map(s => path.normalize(s)));
  const walk = d => fs.readdirSync(path.join(ROOT, d), { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
  const orphans = walk('js').filter(f => !listed.has(f));
  assert.deepStrictEqual(orphans, [], 'js files not loaded by index.html: ' + orphans.join(', '));
});

test('architecture guard: the engine never names a specific hero', () => {
  const g = loadGame(), ids = heroIds(g), bad = [];
  for (const dir of ['js/core', 'js/shared', 'js/modes', 'js/ui']) {
    for (const f of fs.readdirSync(path.join(ROOT, dir)).filter(f => f.endsWith('.js'))) {
      const text = fs.readFileSync(path.join(ROOT, dir, f), 'utf8');
      if (/look\.char\s*===\s*['"]/.test(text)) bad.push(`${dir}/${f}: compares look.char to a hero name`);
      for (const id of ids) if (new RegExp(`['"]${id}['"]`).test(text.replace(/\/\/.*$/gm, ''))) bad.push(`${dir}/${f}: mentions hero '${id}'`);
    }
  }
  assert.deepStrictEqual(bad, [], bad.join('\n'));
});

test('registries are populated and ids are consistent', () => {
  const g = loadGame();
  assert.strictEqual(g.eval('heroes().length'), 15);
  assert(g.eval('Object.keys(TEAMS).length') >= 2);
  assert(g.eval('Object.keys(CAMPAIGNS).length') >= 1);
  for (const h of g.eval('heroes().map(h => ({ id: h.id, team: h.team }))')) assert(g.eval(`!!TEAMS['${h.team}']`), `hero ${h.id} has unknown team ${h.team}`);
  for (const t of g.eval('Object.keys(TEAMS)')) assert(g.eval(`heroesOfTeam('${t}').length`) > 0, `team ${t} has no heroes`);
});

test('every hero satisfies the hero contract', () => {
  const g = loadGame();
  for (const id of heroIds(g)) {
    startRun(g, { hero: id });
    const r = g.json(`(() => { const H = HEROES['${id}'], p = []; const need = (c, m) => { if (!c) p.push(m); };
      need(H.name && H.blurb, 'name/blurb'); need(H.look && H.look.cape && H.look.fx && H.look.hair && H.look.gears && H.look.gears.length && H.look.help && H.look.keys && H.look.capeLab, 'look fields');
      need(typeof H.onKey === 'function' && typeof H.onMouse === 'function', 'onKey/onMouse'); need(typeof H.speed === 'function', 'speed');
      need(typeof H.skills === 'function' && typeof H.message === 'function', 'skills/message');
      const sk = H.skills(); need(Array.isArray(sk) && sk.length >= 4, 'at least 4 skills');
      for (const s of sk) need(s.k && s.n && typeof s.cd === 'number' && s.max > 0 && 'ok' in s, 'skill entry ' + JSON.stringify(s));
      need(typeof H.message() === 'string', 'message() returns text'); need(H.cd && Object.keys(H.cd).length, 'cd keys');
      for (const k in (H.cd || {})) need(k in cd, 'cd key ' + k + ' reaches the cooldown table');
      return p; })()`);
    assert.deepStrictEqual(r, [], `${id}: ${r.join('; ')}`);
  }
});

test('enemy types and campaign data reference things that exist', () => {
  const g = loadGame();
  const bad = g.json(`(() => { const p = [];
    for (const id in ETYPES) { const t = ETYPES[id]; for (const f of ['r','hp','speed','score','drop','color']) if (t[f] == null) p.push(id + ' lacks ' + f); }
    for (const cid in CAMPAIGNS) for (const [i, ch] of CAMPAIGNS[cid].chapters.entries()) {
      if (!LOCS[ch.loc]) p.push(cid + ' ch' + (i+1) + ' unknown location ' + ch.loc);
      for (const w of ch.waves) for (const [t, n] of w) { if (!ETYPES[t]) p.push(cid + ' ch' + (i+1) + ' unknown enemy ' + t); if (!(n > 0)) p.push('bad count'); }
      for (const part of ['intro', 'outro']) { const sc = ch[part + 'Scenes'], v = ch[part];
        if (sc) { for (const id of sc) if (!SCENES[id]) p.push(cid + ' ch' + (i+1) + ' unknown scene ' + id); }
        else if (!(Array.isArray(v) || (v && typeof v === 'object'))) p.push(cid + ' ch' + (i+1) + ' needs ' + part + ' text or ' + part + 'Scenes'); }
    } return p; })()`);
  assert.deepStrictEqual(bad, [], bad.join('; '));
});

// ================= menu flow =================
test('menu: team rosters, campaign lock, and start', () => {
  const g = loadGame();
  assert.strictEqual(g.get('state'), 'menu');
  g.fire('mode-endless'); g.fire('team-avengers'); g.fire('next');
  assert.strictEqual(g.byId['hero-thor'].style.display, '');
  assert.strictEqual(g.byId['hero-wolverine'].style.display, 'none');
  g.fire('team-xmen');
  assert.strictEqual(g.byId['hero-wolverine'].style.display, '');
  assert.strictEqual(g.byId['hero-thor'].style.display, 'none');
  assert.strictEqual(g.get('look.char'), 'wolverine', 'switching team switches to that roster');
  g.fire('team-avengers'); g.fire('mode-' + g.eval('Object.keys(CAMPAIGNS)[0]'));
  assert.strictEqual(g.byId['hero-loki'].disabled, true, 'Loki is locked in the campaign');
  g.fire('mode-endless');
  assert.strictEqual(g.byId['hero-loki'].disabled, false);
  g.fire('hero-hulk'); g.fire('start');
  assert.strictEqual(g.get('state'), 'play'); assert.strictEqual(g.get('look.char'), 'hulk');
});

test('menu: choosing any mode card keeps the menu rendering (regression: HUD read an unset chapter list)', () => {
  const g = loadGame();
  for (const id of ['endless'].concat(g.json('Object.keys(CAMPAIGNS)'))) { g.fire('mode-' + id); g.frames(6); }
  for (const t of g.json('Object.keys(TEAMS)')) { g.fire('team-' + t); g.frames(3); g.fire('next'); g.frames(3); }
});

test('every game state renders frames without errors (menu, play, story, upgrades, cutscene, paused, over, win)', () => {
  const g = loadGame({ seed: 8 }); startRun(g, { hero: 'cap', mode: 'campaign' });
  g.frames(10);                                                       // the opening cutscene
  g.eval("skipCutscene()"); g.frames(20); assert.strictEqual(g.get('state'), 'play');
  g.eval("showStory('Title', ['A line.'], 'Go', () => {})"); assert.strictEqual(g.get('state'), 'story'); g.frames(10);
  g.eval("showPerks()"); assert.strictEqual(g.get('state'), 'perk'); g.frames(10);
  g.eval("state = 'play'; setPause(true)"); g.frames(10); g.eval("setPause(false)");
  g.eval("state = 'over'"); g.frames(10);
  g.eval("state = 'win'"); g.frames(10);
  g.eval("showMenu()"); g.frames(10); assert.strictEqual(g.get('state'), 'menu');
});

// ================= every hero, every arena =================
test('every hero plays every arena for 900 frames without errors (and is deterministic)', () => {
  const arenas = ['asgard', 'jotun', 'muspel'];
  for (const id of heroIds(loadGame())) for (const loc of arenas) {
    const run = () => { const g = loadGame({ seed: 5 }); startRun(g, { hero: id, loc }); mash(g, 900, 9); return snapshot(g); };
    let a; try { a = run(); } catch (e) { throw new Error(`${id} in ${loc}: ${e.stack.split('\n').slice(0, 3).join(' | ')}`); }
    assert.strictEqual(a, run(), `${id} in ${loc} is not deterministic`);
  }
});

test('dying and retrying works in Endless', () => {
  const g = loadGame(); startRun(g, { hero: 'cap' });
  g.eval('player.hp = 1; player.inv = 0; hurtPlayer(player.x + 30, player.y, 300, null)');
  assert.strictEqual(g.get('state'), 'over');
  g.mouseDown(0); assert.strictEqual(g.get('state'), 'play'); assert.strictEqual(g.get('player.hp'), 5);
});

// ================= the campaign, start to finish =================
test('campaign: cutscenes, upgrades, both bosses, and victory', () => {
  const g = loadGame({ seed: 3 }); startRun(g, { hero: 'thor', mode: 'campaign' });
  const seen = { states: new Set(), bosses: new Set(), locs: new Set(), perks: 0 }; let prev = '';
  for (let f = 0; f < 12000; f++) {
    const st = g.get('state'); seen.states.add(st);
    if (st === 'cutscene') g.mouseDown(0);
    else if (st === 'story') g.fire('storyBtn');
    else if (st === 'perk') { if (prev !== 'perk') seen.perks++; g.eval('pickPerk(perkChoices[0])'); }
    else if (st === 'win') break;
    else if (st === 'play') {
      g.eval('player.hp = maxHp(); player.inv = 1;');
      seen.locs.add(g.get('locKey'));
      const b = g.eval("enemies.filter(e => e.boss).map(e => e.type).join()"); if (b) seen.bosses.add(b);
      if (f % 450 === 449) clearField(g);
    }
    prev = st; g.frames(1);
  }
  assert.strictEqual(g.get('state'), 'win', 'campaign never reached victory');
  assert.deepStrictEqual([...seen.bosses].sort(), ['leviathan', 'warlord']);
  assert.strictEqual(seen.perks, 3, 'one upgrade pick between each pair of chapters');
  assert(['stark', 'streets', 'plaza', 'portal'].every(l => seen.locs.has(l)));
  g.mouseDown(0); assert.strictEqual(g.get('state'), 'menu', 'victory screen returns to the menu');
  assertStoryContract(g.json('cutsceneLog'), g.json("Object.values(SCENES).map(s => s.title).filter(Boolean)"));
});

test('campaign: dying retries the same chapter and keeps upgrades', () => {
  const g = loadGame({ seed: 4 }); startRun(g, { hero: 'cap', mode: 'campaign' });
  g.eval('skipCutscene()');
  clearField(g); g.eval('perks.dmg = 1.5; camp.ch = 1; reset(); state = "play";');
  g.eval('player.hp = 1; player.inv = 0; hurtPlayer(player.x + 30, player.y, 300, null)');
  assert.strictEqual(g.get('state'), 'over');
  g.mouseDown(0);
  assert.strictEqual(g.get('state'), 'play'); assert.strictEqual(g.get('camp.ch'), 1); assert.strictEqual(g.get('perks.dmg'), 1.5);
});

// ================= cutscenes =================
test('cutscene scripts are valid: stages, props, actors and every step target exist', () => {
  const g = loadGame();
  const actorIds = new Set([...g.json('Object.keys(ACTORS)'), ...heroIds(g), '$player']), props = new Set(g.json('Object.keys(PROPS)')), stages = new Set(g.json('Object.keys(STAGES)'));
  const KINDS = ['say', 'narrate', 'card', 'spawn', 'move', 'tween', 'face', 'set', 'attach', 'fx', 'wait', 'par', 'seq', 'remove'], problems = [];
  const scenes = g.json('SCENES');
  for (const [sid, sc] of Object.entries(scenes)) {
    const bad = m => problems.push(`${sid}: ${m}`);
    if (!stages.has(sc.stage)) bad('unknown stage ' + sc.stage);
    const known = new Set(['$player']);
    for (const a of sc.actors || []) { if (!actorIds.has(a.id)) bad('unknown actor ' + a.id); known.add(a.id); }
    for (const p of sc.props || []) { if (!props.has(p.type)) bad('unknown prop type ' + p.type); known.add(p.id); }
    const collect = steps => { for (const s of steps) { if (s.spawn) { if (!actorIds.has(s.spawn.id)) bad('spawn of unknown actor ' + s.spawn.id); known.add(s.spawn.id); } for (const k of ['par', 'seq', 'during']) if (s[k]) collect(s[k]); } };
    collect(sc.steps);
    const walk = steps => { for (const s of steps) {
      const kind = KINDS.find(k => k in s); if (!kind) { bad('step with no known kind: ' + JSON.stringify(s)); continue; }
      const need = id => { if (!known.has(id)) bad(`${kind} targets unknown id '${id}'`); };
      if (kind === 'say') { need(s.say); if (!s.text) bad('say without text'); if (s.text && s.text.length > 170) bad('line too long for a bubble: ' + s.text.slice(0, 30)); }
      if (kind === 'narrate' && (!s.narrate || s.narrate.length > 260)) bad('narration empty or too long');
      if (kind === 'card' && !s.card) bad('empty card');
      if (kind === 'move') { need(s.move); if (!(Array.isArray(s.to) && s.to.length === 2 && s.to.every(Number.isFinite))) bad('move needs to: [x, y]'); }
      if (kind === 'tween') { need(s.tween); if (typeof s.key !== 'string' || !Number.isFinite(s.to)) bad('tween needs key and numeric to'); }
      if (kind === 'set' || kind === 'remove' || kind === 'face') need(s[kind]);
      if (kind === 'attach') { need(s.attach); need(s.to); }
      if (kind === 'fx' && !['flash', 'shake', 'alarm'].includes(s.fx)) bad('unknown fx ' + s.fx);
      for (const k of ['par', 'seq', 'during']) if (s[k]) walk(s[k]);
    } };
    walk(sc.steps);
  }
  assert.deepStrictEqual(problems, [], problems.join('\n'));
});

test("cutscenes: the full Battle of New York script plays in order, in the author's words (Avengers and X-Men)", () => {
  for (const hero of ['thor', 'wolverine']) {
    const g = loadGame({ seed: 6 }); startRun(g, { hero, mode: 'campaign' });
    const play = () => { for (let f = 0; f < 4000 && g.get('state') === 'cutscene'; f++) { g.mouseDown(0); g.frames(1); } };
    play();                                                                                 // scenes 1 to 4 before chapter one
    assert.strictEqual(g.get('state'), 'play');
    for (const [ch, scenes] of [[1, 'thor-stop-loki'], [2, 'iron-idea'], [3, 'sacrifice']]) {
      clearField(g); g.eval(`camp.ch = ${ch}; completeChapter()`);
      assert.strictEqual(g.get('state'), 'cutscene', 'chapter ' + (ch + 1) + ' ends with a scene');
      assert.strictEqual(g.eval('cut.def.id'), scenes); play();
      if (ch < 3) assert.strictEqual(g.get('state'), 'perk'); else assert.strictEqual(g.get('state'), 'win', 'THE END leads to the victory screen');
    }
    assertStoryContract(g.json('cutsceneLog'), g.json('Object.values(SCENES).map(s => s.title).filter(Boolean)'));
  }
});

test('cutscene input: first click finishes the typing, the next continues; Esc skips everything', () => {
  const g = loadGame(); startRun(g, { hero: 'cap', mode: 'campaign' });
  g.mouseDown(0); g.frames(1);                                                              // skips the title card
  g.frames(40);                                                                             // the opening wait, then Fury speaks
  assert.strictEqual(g.eval('cut.rt.kind'), 'say'); const typed = () => g.eval('cut.rt.typed'), len = g.eval('cut.rt.text.length');
  assert(typed() < len, 'text is typing out'); g.mouseDown(0); g.frames(1);
  assert.strictEqual(typed(), len, 'first click completes the line'); assert.strictEqual(g.eval('cut.rt.s.say'), 'fury');
  g.mouseDown(0); g.frames(2); assert.notStrictEqual(g.eval('cut.rt && cut.rt.s && cut.rt.s.say'), 'fury', 'second click moves on');
  g.key('Escape'); assert.strictEqual(g.get('state'), 'play', 'Esc skips the whole sequence into chapter one');
  assert.strictEqual(g.eval('cutQueue.length'), 0); assert.strictEqual(g.eval('cut'), null);
});

test("your own hero joins the scenes as an extra, unless they're already in the cast", () => {
  const extraFor = hero => { const g = loadGame(); startRun(g, { hero, mode: 'campaign' }); g.eval("skipCutscene(); playScenes(['conflict'], () => {})"); g.frames(3);
    return { extra: g.get('cut.extra'), actors: g.json('Object.keys(cut.actors)') }; };
  const cap = extraFor('cap'), spider = extraFor('spider'), wolf = extraFor('wolverine');
  assert.strictEqual(cap.extra, false); assert(!cap.actors.includes('$player'), 'Cap is already in the cast');
  for (const r of [spider, wolf]) { assert.strictEqual(r.extra, true); assert(r.actors.includes('$player')); }
});

// ================= hero mechanics (a few key behaviours) =================
test('Hulk: arms are rigid (the fist never leaves a fixed arm length from the shoulder)', () => {
  const g = loadGame(); startRun(g, { hero: 'hulk' }); g.frames(2);
  const r = g.get('player.r'), L = r * 1.25; let worst = 0;
  for (let phi = -2.4; phi <= 2.4; phi += 0.2) for (const s of [-1, 1]) {
    const F = g.eval(`HEROES.hulk.api.hulkFistPos(0.7, ${s}, ${phi})`), p = g.eval('({ x: player.x, y: player.y })');
    const sh = { x: p.x + r * 0.1 * Math.cos(0.7) - s * r * 0.78 * Math.sin(0.7), y: p.y + r * 0.1 * Math.sin(0.7) + s * r * 0.78 * Math.cos(0.7) };
    worst = Math.max(worst, Math.abs(Math.hypot(F.x - sh.x, F.y - sh.y) - L));
  }
  assert(worst < 1e-6, 'arm length drifted by ' + worst);
});

test('Hulk: click chains hook, hook, slam', () => {
  const g = loadGame(); startRun(g, { hero: 'hulk' }); clearField(g); g.mouseMove(700, 310); g.frames(3);
  const kinds = []; g.mouseDown(0);
  for (let i = 0; i < 160; i++) { g.frames(1); const k = g.eval('player.atk ? player.atk.kind + (player.atk.s || "") : ""'); if (k && kinds[kinds.length - 1] !== k) kinds.push(k); }
  assert.deepStrictEqual(kinds.slice(0, 3), ['hook-1', 'hook1', 'slam']);
});

test("Captain America: the shield ricochets and comes back to his hand", () => {
  const g = loadGame(); startRun(g, { hero: 'cap' }); clearField(g); g.mouseMove(900, 310); g.frames(3);
  g.mouseDown(0); g.frames(2); assert.strictEqual(g.eval('HEROES.cap.api.shieldCount()'), 1);
  for (let i = 0; i < 480 && g.eval('HEROES.cap.api.shieldCount()') > 0; i++) { clearField(g); g.eval('player.inv = 1'); g.frames(1); }
  assert.strictEqual(g.eval('HEROES.cap.api.shieldCount()'), 0, 'shield never came back');
});

test('Iron Man: armour plating absorbs one hit, then recharges', () => {
  const g = loadGame(); startRun(g, { hero: 'iron' }); clearField(g);
  const hit = () => g.eval('player.inv = 0; hurtPlayer(player.x + 30, player.y, 300, null); player.hp');
  assert.strictEqual(hit(), 5, 'first hit should be absorbed'); assert.strictEqual(g.get('player.shellReady'), false);
  assert.strictEqual(hit(), 4, 'second hit lands');
  for (let i = 0; i < 900 && !g.get('player.shellReady'); i++) { clearField(g); g.frames(1); }
  assert.strictEqual(g.get('player.shellReady'), true);
});

test('Spider-Man: spider sense dodges one hit in slow motion, then recharges', () => {
  const g = loadGame(); startRun(g, { hero: 'spider' }); clearField(g);
  g.eval('player.inv = 0; hurtPlayer(player.x + 30, player.y, 300, null)');
  assert.strictEqual(g.get('player.hp'), 5); assert(g.get('slowT') > 0);
  g.eval('player.inv = 0; hurtPlayer(player.x + 30, player.y, 300, null)'); assert.strictEqual(g.get('player.hp'), 4);
  for (let i = 0; i < 900 && !g.get('player.senseReady'); i++) { clearField(g); g.eval('player.inv = 1'); g.frames(1); }
  assert.strictEqual(g.get('player.senseReady'), true);
});

test('Wolverine and Deadpool regenerate hearts', () => {
  for (const id of ['wolverine', 'deadpool']) {
    const g = loadGame(); startRun(g, { hero: id }); g.eval('player.hp = 2; player.inv = 1');
    for (let i = 0; i < 800; i++) { clearField(g); g.eval('player.inv = 1'); g.frames(1); }
    assert(g.get('player.hp') >= 3, id + ' did not heal');
  }
});

test('team ultimates: the Avengers have none, the X-Men have Mutant Surge', () => {
  const g = loadGame(); startRun(g, { hero: 'cap' }); clearField(g);
  g.eval('teamMeter = 100'); g.key('KeyX'); assert.strictEqual(g.get('teamMeter'), 100, 'Avengers X key must do nothing');
  const x = loadGame(); startRun(x, { hero: 'wolverine' }); clearField(x);
  x.eval('enemies.push(makeEnemy("grunt", player.x + 200, player.y)); enemies[0].hp = 50; player.hp = 3; teamMeter = 100');
  x.key('KeyX'); x.frames(2);
  assert.strictEqual(x.get('teamMeter') < 100, true); assert.strictEqual(x.get('player.hp'), 4);
  assert(x.get('enemies[0].stun') > 2, 'enemies are stunned'); assert(x.get('enemies[0].hp') < 50, 'enemies are hurt');
});

// ================= Doctor Strange =================
const strange = () => { const g = loadGame({ seed: 12 }); startRun(g, { hero: 'strange' }); clearField(g); g.eval('player.x = 300; player.y = 300; player.inv = 1'); return g; };
const sApi = g => g.json('HEROES.strange.api.state()');
const addEnemy = (g, x, y, hp = 99) => { g.eval(`enemies.push(makeEnemy("grunt", ${x}, ${y})); enemies[enemies.length - 1].hp = ${hp}; enemies[enemies.length - 1].max = ${hp}`); return g.eval('enemies.length - 1'); };
const hold = (g, n) => { for (let i = 0; i < n; i++) { g.eval('player.inv = 1; ebolts.length = ebolts.length'); g.frames(1); } };

test('Strange: held click fires orbs that hurt enemies', () => {
  const g = strange(); const i = addEnemy(g, 520, 300, 20); g.mouseMove(800, 300); g.frames(2);
  g.mouseDown(0); g.frames(40); g.mouseUp(0);
  assert(g.get(`enemies[${i}].hp`) < 20, 'orb damaged the enemy');
});

test('Strange: Q opens a portal pair that moves you, enemies, your orbs, and turns enemy fire around', () => {
  const g = strange(), arena = g.json('A'), ex = arena.x + arena.w - 90;
  g.eval('player.aim = 0'); g.mouseMove(ex, 300); g.frames(1); g.key('KeyQ'); g.frames(2);
  assert.strictEqual(sApi(g).portals, 2);
  const ent = g.json('({ x: player.x + 80, y: player.y })');                      // the entrance is 80px ahead of you
  const i = addEnemy(g, ent.x, ent.y); g.frames(2);
  assert(g.get(`enemies[${i}].x`) > ex - 60, 'enemy came out of the exit'); assert(g.get(`enemies[${i}].stun`) > 0, 'and is dizzy');
  g.eval(`player.x = ${ent.x}; player.y = ${ent.y}; player.pcd = 0`); g.frames(2);
  assert(g.get('player.x') > ex - 60, 'you came out of the exit too');
  g.eval(`ebolts.push({ x: ${ent.x}, y: ${ent.y}, vx: 0, vy: 0, life: 3, friendly: false, col: '#fff' })`); g.frames(2);
  assert.strictEqual(g.eval('ebolts[ebolts.length - 1].friendly'), true, 'enemy fire now belongs to you');
  assert(g.eval('ebolts[ebolts.length - 1].x') > ex - 60);
});

test('Strange: E detaches the cloak, you steer it with the mouse, it binds what it touches, then it returns', () => {
  const g = strange(); const i = addEnemy(g, 520, 300); g.mouseMove(700, 300); g.frames(1);
  g.key('KeyE'); g.frames(1);
  assert.strictEqual(g.get('player.cloakOut'), true, 'cloak left his shoulders'); assert(sApi(g).cloak, 'cloak is flying');
  let bound = false; for (let f = 0; f < 80 && !bound; f++) { hold(g, 1); bound = g.get(`enemies[${i}].stun`) > 0.5; }
  assert(bound, 'cloak wrapped the enemy'); assert(g.get(`enemies[${i}].hp`) < 99, 'and hurt it');
  g.key('KeyE');                                                                    // recall
  for (let f = 0; f < 300 && g.get('player.cloakOut'); f++) hold(g, 1);
  assert.strictEqual(g.get('player.cloakOut'), false, 'cloak came back'); assert(g.get('cd.st_cloak') > 0);
  assert.strictEqual(sApi(g).cloak, null);
});

test('Strange: the cloak follows the mouse (steering)', () => {
  const g = strange(); g.mouseMove(800, 300); g.frames(1); g.key('KeyE'); hold(g, 10);
  const y0 = sApi(g).cloak.y; g.mouseMove(300, 120); hold(g, 25);                     // pull the cursor up and to the left
  assert(sApi(g).cloak.y < y0 - 20, 'the cloak turned toward the new cursor position');
});

test('Strange: right click binds enemies in front of him and drags them in', () => {
  const g = strange(); const i = addEnemy(g, 540, 300), far = addEnemy(g, 40, 560);
  g.mouseMove(800, 300); g.frames(1);
  const d0 = g.eval(`Math.hypot(enemies[${i}].x - player.x, enemies[${i}].y - player.y)`);
  g.mouseDown(2); g.mouseUp(2); g.frames(1);
  assert(g.get(`enemies[${i}].stun`) > 1.5, 'enemy is bound');
  hold(g, 25);
  assert(g.eval(`Math.hypot(enemies[${i}].x - player.x, enemies[${i}].y - player.y)`) < d0 - 60, 'and was dragged toward him');
  assert(g.get(`enemies[${far}].stun`) < 0.5, 'enemies outside the cone are untouched');
  assert(g.eval(`enemies[${i}].marked > time`), 'bound enemies take extra damage');
});

test('Strange: F casts three mirror images that shoot with him, and they fade', () => {
  const g = strange(); g.mouseMove(800, 300); g.frames(1); g.key('KeyF'); g.frames(2);
  assert.strictEqual(g.get('clones.length'), 3);
  g.mouseDown(0); g.frames(2); g.mouseUp(0);
  assert(sApi(g).orbs >= 4, 'one orb from him and one from each image');
  for (let f = 0; f < 560; f++) { clearField(g); hold(g, 1); }
  assert.strictEqual(g.get('clones.length'), 0, 'images expire');
});

test('Strange: R rewinds time. Position and hearts return to where they were', () => {
  const g = strange(); for (let f = 0; f < 60; f++) hold(g, 1);
  const then = sApi(g).oldest; assert(then && sApi(g).hist >= 8, 'history is being recorded');
  g.eval('player.x = 780; player.y = 480; player.hp = 2'); g.frames(2);
  g.key('KeyR'); g.frames(2); assert(sApi(g).rewinding && g.get('player.rewT') > 0);
  for (let f = 0; f < 90 && sApi(g).rewinding; f++) hold(g, 1);
  assert.strictEqual(sApi(g).rewinding, false);
  assert(Math.hypot(g.get('player.x') - then.x, g.get('player.y') - then.y) < 25, 'back where he was');
  assert.strictEqual(g.get('player.hp'), then.hp, 'the damage never happened');
  g.key('KeyR'); g.frames(2); assert.strictEqual(sApi(g).rewinding, false, 'rewind is on cooldown');
});

test('Strange: T stops time. Enemies and fire freeze, spawning pauses, frozen enemies take +50%, then everything resumes', () => {
  const g = strange(); const i = addEnemy(g, 700, 300);
  g.eval("ebolts.push({ x: 600, y: 150, vx: 220, vy: 0, life: 3, friendly: false, col: '#fff' })");
  g.key('KeyT'); g.frames(2); assert(sApi(g).stopT > 3, 'time is stopped');
  const e0 = g.json(`({ x: enemies[${i}].x, y: enemies[${i}].y })`), b0 = g.eval('ebolts.find(b => b.y === 150).x'), st0 = g.get('spawnTimer');
  hold(g, 60);
  assert(g.eval(`Math.hypot(enemies[${i}].x - ${e0.x}, enemies[${i}].y - ${e0.y})`) < 0.5, 'the enemy did not move');
  assert(Math.abs(g.eval('ebolts.find(b => b.y === 150).x') - b0) < 0.5, 'the bolt hangs in the air');
  assert(g.get('spawnTimer') >= st0, 'spawning is held');
  const hp = g.get(`enemies[${i}].hp`); g.eval(`damage(enemies[${i}], 2)`);
  assert.strictEqual(hp - g.get(`enemies[${i}].hp`), 3, 'frozen enemies take +50% damage');
  g.eval("player.inv = 0; ebolts.push({ x: player.x, y: player.y, vx: 0, vy: 0, life: 3, friendly: false, col: '#fff' })"); g.frames(2);
  assert.strictEqual(g.get('player.hp'), 5, 'touching frozen fire does not hurt');
  for (let f = 0; f < 260 && sApi(g).stopT > 0; f++) hold(g, 1);
  assert.strictEqual(sApi(g).stopT, 0, 'time resumes');
  const e1 = g.json(`({ x: enemies[${i}].x, y: enemies[${i}].y })`); hold(g, 20);
  assert(g.eval(`Math.hypot(enemies[${i}].x - ${e1.x}, enemies[${i}].y - ${e1.y})`) > 3, 'the enemy moves again');
  assert(g.eval('ebolts.find(b => b.y === 150).x') > b0 + 3, 'and the held bolt flies on');
});

test('Strange: time stop holds a boss only for the first half', () => {
  const g = strange(); g.eval('enemies.push(makeEnemy("leviathan", 700, 300)); enemies[enemies.length - 1].hp = 999');
  const i = g.eval('enemies.length - 1'), pos = () => g.json(`({ x: enemies[${i}].x, y: enemies[${i}].y })`);
  g.key('KeyT'); hold(g, 30); const a = pos(); hold(g, 20);
  assert(Math.hypot(pos().x - a.x, pos().y - a.y) < 0.5, 'frozen at first');
  hold(g, 130); assert(sApi(g).stopT > 0, 'time is still stopped');
  assert(Math.hypot(pos().x - a.x, pos().y - a.y) > 15, 'but the boss has broken free');
});

test('Strange: holding Space levitates. Faster, melee and lava cannot reach him, bolts can, and it runs on a meter', () => {
  const g = strange();
  const run = space => { g.eval('player.x = 300; player.y = 300; player.kx = 0; player.ky = 0'); if (space) g.key('Space'); g.key('KeyD'); hold(g, 20); const x = g.get('player.x'); g.keyup('KeyD'); if (space) g.keyup('Space'); hold(g, 5); return x - 300; };
  const walk = run(false); assert.strictEqual(g.get('player.lev'), false);
  const fly = run(true); assert(fly > walk * 1.3, `levitating is faster (${fly.toFixed(0)} vs ${walk.toFixed(0)})`);
  g.eval('player.x = 300; player.y = 300'); g.key('Space'); hold(g, 3); assert.strictEqual(g.get('player.lev'), true);
  g.eval('player.inv = 0; hurtPlayer(player.x + 30, player.y, 420, makeEnemy("grunt", 0, 0))'); assert.strictEqual(g.get('player.hp'), 5, 'melee passes under him');
  g.eval('player.inv = 0; hurtPlayer(player.x + 30, player.y, 300, null, true)'); assert.strictEqual(g.get('player.hp'), 5, 'lava passes under him');
  g.eval('player.inv = 0; hurtPlayer(player.x + 30, player.y, 300)'); assert.strictEqual(g.get('player.hp'), 4, 'but bolts still hit');
  for (let f = 0; f < 320 && g.get('player.lev'); f++) hold(g, 1);
  assert.strictEqual(g.get('player.lev'), false, 'the meter ran dry'); assert(g.get('player.levE') < 1);
  g.keyup('Space'); hold(g, 130); assert(g.get('player.levE') > 20, 'and it refills');
  g.eval('player.levE = 100'); g.mouseMove(800, 300); g.key('KeyE'); hold(g, 3); g.key('Space'); hold(g, 2);
  assert.strictEqual(g.get('player.lev'), false, 'no levitating while the cloak is away');
});

test('Strange: with the cloak out, Space pulls him to it like a grapple, hitting what is in the way', () => {
  const g = strange(); g.mouseMove(800, 300); g.frames(1); g.key('KeyE'); hold(g, 20);
  const c = sApi(g).cloak; assert(c && c.x > 400, 'cloak is out and away from him');
  const i = addEnemy(g, (300 + c.x) / 2, 300);
  g.key('Space'); g.frames(1); assert(sApi(g).cloak.anchored, 'the cloak anchors');
  for (let f = 0; f < 80 && g.eval('!!player.zip'); f++) hold(g, 1);
  assert.strictEqual(g.eval('!!player.zip'), false, 'he arrived');
  assert(Math.hypot(g.get('player.x') - c.x, g.get('player.y') - c.y) < 40, 'at the cloak');
  hold(g, 3); assert.strictEqual(g.get('player.cloakOut'), false, 'and wears it again');
  assert(g.get(`enemies[${i}].hp`) < 99, 'the enemy in the way was hit');
});

test('Strange: time stop freezes lava geysers in the Muspelheim arena', () => {
  const g = loadGame({ seed: 12 }); startRun(g, { hero: 'strange', loc: 'muspel' }); clearField(g);
  for (let f = 0; f < 600 && g.get('hazards.length') === 0; f++) { clearField(g); g.eval('player.inv = 1'); g.frames(1); }
  assert(g.get('hazards.length') > 0, 'a geyser has been warned');
  g.key('KeyT'); g.frames(2);
  const t0 = g.get('hazards[0].t'), ph = g.get('hazards[0].phase'), n = g.get('hazards.length');
  for (let f = 0; f < 60; f++) { clearField(g); g.eval('player.inv = 1'); g.frames(1); }
  assert(Math.abs(g.get('hazards[0].t') - t0) < 0.001, 'the geyser countdown is frozen'); assert.strictEqual(g.get('hazards[0].phase'), ph);
  assert.strictEqual(g.get('hazards.length'), n, 'and no new geysers open');
});

test('Strange: time stop really pauses spawning (Endless spawn timer and the Campaign gap between waves)', () => {
  // Endless: enemies are queued, so the engine's spawn timer is counting down. A control run proves that.
  const timerAfter = (stop) => { const g = strange(); g.eval('spawnLeft = 6; spawnTimer = 5'); if (stop) { g.key('KeyT'); g.frames(1); }
    for (let f = 0; f < 90; f++) { g.eval('player.inv = 1; enemies.length = 0'); g.frames(1); } return g.get('spawnTimer'); };
  const running = timerAfter(false), stopped = timerAfter(true);
  assert(running < 4, `control: the spawn timer normally counts down (${running.toFixed(2)})`);
  assert(stopped > 4.9, `with time stopped it holds (${stopped.toFixed(2)})`);
  // Campaign: the pause between one wave and the next is held too.
  const waitAfter = (stop) => { const g = loadGame({ seed: 12 }); startRun(g, { hero: 'strange', mode: 'campaign' }); g.eval('skipCutscene()'); g.frames(2);
    clearField(g); g.eval('camp.wait = 5; player.inv = 1'); if (stop) { g.key('KeyT'); g.frames(1); }
    for (let f = 0; f < 90; f++) { g.eval('player.inv = 1'); g.frames(1); } return g.get('camp.wait'); };
  const cRunning = waitAfter(false), cStopped = waitAfter(true);
  assert(cRunning < 4, `control: the wave gap normally counts down (${cRunning.toFixed(2)})`);
  assert(cStopped > 4.9, `with time stopped it holds (${cStopped.toFixed(2)})`);
});

// ================= Quicksilver =================
const quick = () => { const g = loadGame({ seed: 14 }); startRun(g, { hero: 'quicksilver' }); clearField(g); g.eval('player.x = 200; player.y = 300; player.inv = 1'); return g; };
const qApi = g => g.json('HEROES.quicksilver.api.state()');

test('Quicksilver: click dashes to the clicked point, hits what is in the way, and leaves a shadow trail', () => {
  const g = quick(); const i = addEnemy(g, 400, 300, 20); g.mouseMove(700, 300); g.frames(1);
  g.mouseDown(0); g.mouseUp(0); g.frames(1); assert(qApi(g).dashing, 'dashing');
  for (let f = 0; f < 40 && qApi(g).dashing; f++) hold(g, 1);
  assert(Math.hypot(g.get('player.x') - 700, g.get('player.y') - 300) < 12, 'arrived where he clicked');
  assert(g.get(`enemies[${i}].hp`) < 20, 'the enemy in the way was hit'); assert(qApi(g).ghosts >= 4, 'shadow trail left behind');
});

test('Quicksilver: right click swings to the wall with momentum, and swings chain in new directions', () => {
  const g = quick(), arena = g.json('A'); g.eval('player.x = 480; player.y = 300'); g.mouseMove(arena.x + arena.w, 300); g.frames(2);
  g.mouseDown(2); g.mouseUp(2); for (let f = 0; f < 40 && qApi(g).dashing; f++) hold(g, 1);
  assert(g.get('player.x') > arena.x + arena.w - 60, 'swung to the right wall');
  g.mouseMove(arena.x, 300); hold(g, 25); g.mouseDown(2); g.mouseUp(2); for (let f = 0; f < 60 && qApi(g).dashing; f++) hold(g, 1);
  assert(g.get('player.x') < arena.x + 60, 'chained a swing to the left wall');
});

test('Quicksilver: Q tornado pulls enemies in, shreds their fire, hurts them, then flings them out', () => {
  const g = quick(); g.eval('player.x = 480; player.y = 300');
  const ids = [[570, 300], [390, 300], [480, 380]].map(([x, y]) => addEnemy(g, x, y, 12));
  g.eval("ebolts.push({ x: 540, y: 330, vx: 0, vy: 0, life: 5, friendly: false, col: '#fff' })");
  g.key('KeyQ'); hold(g, 30);
  assert(ids.every(i => g.get(`enemies[${i}].hp`) < 12), 'every enemy was hurt'); assert.strictEqual(g.get('ebolts.length'), 0, 'fire was shredded');
  assert.notStrictEqual(qApi(g).nado, null);
  for (let f = 0; f < 260 && qApi(g).nado !== null; f++) hold(g, 1);
  assert.strictEqual(qApi(g).nado, null, 'it ends'); assert(g.get(`enemies[${ids[0]}].hp`) < 9, 'and the fling hurt as well');
});

test('Quicksilver: E speed perception slows the world to a crawl while he stays full speed', () => {
  const run = perc => {
    const g = quick(); const i = addEnemy(g, 800, 300); g.eval('player.x = 100; player.y = 560'); if (perc) { g.key('KeyE'); g.frames(1); }
    const e0 = g.json(`({ x: enemies[${i}].x, y: enemies[${i}].y })`), p0 = g.get('player.x');
    g.key('KeyD'); for (let f = 0; f < 30; f++) hold(g, 1); g.keyup('KeyD');
    return { enemy: g.eval(`Math.hypot(enemies[${i}].x - ${e0.x}, enemies[${i}].y - ${e0.y})`), player: g.get('player.x') - p0 };
  };
  const normal = run(false), slow = run(true);
  assert(slow.enemy < normal.enemy * 0.4, `the enemy crawls (${slow.enemy.toFixed(1)} vs ${normal.enemy.toFixed(1)})`);
  assert(slow.player > normal.player * 0.9, `he does not (${slow.player.toFixed(0)} vs ${normal.player.toFixed(0)})`);
  const g = quick(); g.key('KeyE'); g.frames(1); assert(qApi(g).perc > 4); g.key('KeyE'); g.frames(1); assert.strictEqual(qApi(g).perc, 0, 'E again ends it');
});

test('Quicksilver: perception also slows enemy fire and spawning', () => {
  const after = perc => { const g = quick(); g.eval('spawnLeft = 6; spawnTimer = 5'); g.eval("ebolts.push({ x: 300, y: 560, vx: 300, vy: 0, life: 9, friendly: false, col: '#fff' })");
    if (perc) { g.key('KeyE'); g.frames(1); } for (let f = 0; f < 60; f++) { g.eval('player.inv = 1; enemies.length = 0'); g.frames(1); }
    return { x: g.eval('ebolts[0].x'), timer: g.get('spawnTimer') }; };
  const n = after(false), s = after(true);
  assert((s.x - 300) < (n.x - 300) * 0.4, 'the bolt crawls'); assert((5 - s.timer) < (5 - n.timer) * 0.4, 'spawning crawls');
});

test('Quicksilver: F flurry hits everything near him at once, and nothing far away', () => {
  const g = quick(); g.eval('player.x = 480; player.y = 300');
  const near = [[540, 300], [420, 320], [480, 220]].map(([x, y]) => addEnemy(g, x, y, 12)), far = addEnemy(g, 480 + 330, 300, 12);
  g.key('KeyF'); g.frames(1);
  assert(near.every(i => g.get(`enemies[${i}].hp`) <= 12 - 2.4), 'each nearby enemy took three hits'); assert.strictEqual(g.get(`enemies[${far}].hp`), 12);
});

// ================= Scarlet Witch =================
const wanda = () => { const g = loadGame({ seed: 16 }); startRun(g, { hero: 'scarlet' }); clearField(g); g.eval('player.x = 200; player.y = 300; player.inv = 1'); return g; };
const wApi = g => g.json('HEROES.scarlet.api.state()');

test('Scarlet Witch: hex bolts curve toward enemies that a straight shot would miss', () => {
  const g = wanda(); const i = addEnemy(g, 520, 370, 20); g.eval(`enemies[${i}].stun = 9`); g.mouseMove(900, 300); g.frames(2);
  g.mouseDown(0); g.frames(2); g.mouseUp(0); hold(g, 50);
  assert(g.get(`enemies[${i}].hp`) < 20, 'the bolt bent into the enemy');
});

test('Scarlet Witch: right click lifts an enemy, right click again throws it through the others', () => {
  const g = wanda(), a = addEnemy(g, 400, 300, 20), b = addEnemy(g, 700, 300, 20);
  g.eval(`enemies[${a}].stun = 9; enemies[${b}].stun = 9`); g.mouseMove(400, 300); g.frames(1);
  g.mouseDown(2); g.mouseUp(2); g.frames(1); assert(wApi(g).held, 'holding it');
  hold(g, 20); assert(g.eval(`Math.hypot(enemies[${a}].x - player.x, enemies[${a}].y - player.y)`) < 100, 'it floats beside her');
  g.mouseMove(900, 300); hold(g, 2); g.mouseDown(2); g.mouseUp(2); hold(g, 40);
  assert.strictEqual(wApi(g).held, false); assert(g.get(`enemies[${b}].hp`) < 20, 'the thrown enemy hit the one in its path');
  assert(g.get(`enemies[${a}].hp`) < 20, 'and was hurt itself');
});

test('Scarlet Witch: enemies inside the hex zone turn on each other, those outside do not', () => {
  const g = wanda(); g.eval('player.x = 60; player.y = 560'); const a = addEnemy(g, 580, 300, 20), b = addEnemy(g, 630, 300, 20), far = addEnemy(g, 200, 100, 20);
  g.mouseMove(600, 300); g.frames(1); g.key('KeyQ'); g.frames(1); assert.strictEqual(wApi(g).zones, 1);
  g.eval(`enemies[${far}].stun = 9`); hold(g, 100);
  assert(g.get(`enemies[${a}].hp`) < 20 && g.get(`enemies[${b}].hp`) < 20, 'they fought each other'); assert.strictEqual(g.get(`enemies[${far}].hp`), 20);
});

test('Scarlet Witch: mind control turns an enemy on its friends, it cannot hurt her, then it changes back', () => {
  const g = wanda(); g.eval('player.x = 60; player.y = 560'); const a = addEnemy(g, 500, 300, 40), b = addEnemy(g, 640, 300, 40);
  g.eval(`enemies[${b}].stun = 99`); g.mouseMove(500, 300); g.frames(1); g.key('KeyE'); g.frames(2);
  assert(g.eval(`!!enemies[${a}].ally`), 'it is under her control'); hold(g, 90);
  assert(g.get(`enemies[${b}].hp`) < 40, 'it attacked the other enemy');
  for (let f = 0; f < 600 && g.eval(`!!enemies[${a}].ally`); f++) hold(g, 1);
  assert.strictEqual(g.eval(`!!enemies[${a}].ally`), false, 'control wears off'); assert((g.get(`enemies[${a}].armor`) || 0) === 0, 'and its armour is back to normal');
  const h = wanda(); const c = addEnemy(h, 230, 300, 40); h.mouseMove(230, 300); h.frames(1); h.key('KeyE'); h.frames(1); h.eval('player.inv = 0');   // no one else to fight
  for (let f = 0; f < 120; f++) h.frames(1);
  assert.strictEqual(h.get('player.hp'), 5, 'a controlled enemy never hurts her');
});

test('Scarlet Witch: mind control cannot take a boss', () => {
  const g = wanda(); g.eval('enemies.push(makeEnemy("leviathan", 500, 300))'); g.mouseMove(500, 300); g.frames(1); g.key('KeyE'); g.frames(2);
  assert.strictEqual(g.eval('!!enemies[enemies.length - 1].ally'), false);
});

test('Scarlet Witch: reality warp reshuffles enemies, hurts and stuns them, and turns their fire around', () => {
  const g = wanda(); const spots = [[420, 150], [520, 450], [650, 200], [750, 420], [850, 300]], ids = spots.map(([x, y]) => addEnemy(g, x, y, 10));
  g.eval("ebolts.push({ x: 400, y: 300, vx: 200, vy: 0, life: 5, friendly: false, col: '#fff' })");
  g.key('KeyR'); g.frames(1);
  const moved = ids.filter((id, k) => g.eval(`Math.hypot(enemies[${id}].x - ${spots[k][0]}, enemies[${id}].y - ${spots[k][1]})`) > 40);
  assert(moved.length >= 2, 'enemies swapped places'); assert(ids.every(id => g.get(`enemies[${id}].hp`) <= 9), 'each took a hit');
  assert(ids.every(id => g.get(`enemies[${id}].stun`) > 0.8), 'and is stunned');
  assert.strictEqual(g.eval('ebolts[0].friendly'), true); assert(g.eval('ebolts[0].vx') < 0, 'fire turned around');
});

// ================= Villains team, Ultron, Vision, and Iron Man's Hulkbuster =================
const solo = (hero, seed = 20) => { const g = loadGame({ seed }); startRun(g, { hero }); clearField(g); g.eval('player.x = 200; player.y = 300; player.inv = 1'); return g; };
const botsOf = g => g.json('HEROES.ultron.api.state()').bots;
const lethal = g => g.eval('player.inv = 0; hurtPlayer(player.x + 30, player.y, 300, null)');

test('Villains team: Loki and Ultron, and they sit out the campaign. Vision is an Avenger.', () => {
  const g = loadGame();
  assert.deepStrictEqual(Array.from(g.json("heroesOfTeam('villains').map(h => h.id)")).sort(), ['loki', 'ultron']);
  assert.strictEqual(g.eval("HEROES.vision.team"), 'avengers'); assert(!g.eval("!!HEROES.vision.campaignLocked"), 'and he can play the campaign');
  g.fire('mode-endless'); g.fire('team-villains'); g.fire('next');
  assert.strictEqual(g.get('team'), 'villains'); assert.strictEqual(g.byId['hero-ultron'].style.display, '');
  g.fire('mode-' + g.eval('Object.keys(CAMPAIGNS)[0]'));
  assert.strictEqual(g.byId['team-villains'].disabled, true, 'the villains card is greyed out in a campaign');
  assert.strictEqual(g.get('team'), 'avengers', 'and the menu moves to a team that can play it'); g.frames(3);
  g.fire('mode-endless'); assert.strictEqual(g.byId['team-villains'].disabled, false);
});

// ---- Ultron ----
test('Ultron: repulsor fire hurts enemies', () => {
  const g = solo('ultron'); const i = addEnemy(g, 520, 300, 20); g.eval(`enemies[${i}].stun = 9`); g.mouseMove(900, 300); g.frames(2);
  g.mouseDown(0); g.frames(30); g.mouseUp(0); hold(g, 20); assert(g.get(`enemies[${i}].hp`) < 20);
});

test('Ultron: Q summons bots that fight on their own while he stands still', () => {
  const g = solo('ultron'); g.eval('player.x = 60; player.y = 560'); g.key('KeyQ'); g.frames(2);
  assert.strictEqual(botsOf(g).length, 3); assert.strictEqual(g.get('clones.length'), 3, 'enemies can target them');
  const i = addEnemy(g, 500, 300, 30); g.eval(`enemies[${i}].stun = 99`); hold(g, 180);
  assert(g.get(`enemies[${i}].hp`) < 30, 'the bots shot the enemy without Ultron lifting a finger');
});

test('Ultron: a bot takes several hits to destroy, and its death explodes', () => {
  const g = solo('ultron'); g.key('KeyQ'); g.frames(2); const far = addEnemy(g, 100, 560, 40); g.eval(`enemies[${far}].stun = 99`);
  const hit = () => { g.eval("ebolts.push({ x: clones[0].x, y: clones[0].y, vx: 0, vy: 0, life: 3, friendly: false, col: '#fff' })"); hold(g, 25); };
  hit(); assert.strictEqual(botsOf(g).length, 3, 'one bolt does not kill it'); assert.strictEqual(g.get('ebolts.length'), 0, 'the bolt was absorbed');
  hit(); hit(); assert.strictEqual(botsOf(g).length, 3); hit(); assert.strictEqual(botsOf(g).length, 2, 'the fourth hit destroys it');
});

test('Ultron: E fires six homing missiles that blow up on enemies', () => {
  const g = solo('ultron'); const i = addEnemy(g, 600, 420, 30); g.eval(`enemies[${i}].stun = 99`); g.mouseMove(900, 300); g.frames(2);
  g.key('KeyE'); g.frames(1); assert.strictEqual(g.json('HEROES.ultron.api.state()').missiles, 6);
  hold(g, 90); assert(g.get(`enemies[${i}].hp`) <= 26, 'the missiles curved into an enemy well off their line');
});

test('Ultron: right click is a laser beam with a 460px reach', () => {
  const g = solo('ultron'); const near = addEnemy(g, 480, 300, 30), far = addEnemy(g, 840, 300, 30), side = addEnemy(g, 480, 430, 30);
  for (const i of [near, far, side]) g.eval(`enemies[${i}].stun = 99`); g.mouseMove(900, 300); g.frames(2);
  g.mouseDown(2); g.mouseUp(2); hold(g, 70);
  assert(g.get(`enemies[${near}].hp`) < 25, 'in the beam'); assert.strictEqual(g.get(`enemies[${far}].hp`), 30, 'beyond its reach'); assert.strictEqual(g.get(`enemies[${side}].hp`), 30, 'off the line');
});

test('Ultron: R moves his mind into the bot nearest the cursor, heals a heart, and the old body explodes', () => {
  const g = solo('ultron'); g.key('KeyQ'); g.frames(2); const e = addEnemy(g, 240, 300, 10); g.eval(`enemies[${e}].stun = 99; player.hp = 3`);
  const b = botsOf(g)[0]; g.mouseMove(b.x, b.y); g.frames(1); const b2 = botsOf(g).sort((p, q) => Math.hypot(p.x - b.x, p.y - b.y) - Math.hypot(q.x - b.x, q.y - b.y))[0];
  g.key('KeyR'); g.frames(1);
  assert(Math.hypot(g.get('player.x') - b2.x, g.get('player.y') - b2.y) < 40, 'he is where the bot was'); assert.strictEqual(botsOf(g).length, 2, 'the bot was consumed');
  assert.strictEqual(g.get('player.hp'), 4); assert(g.get(`enemies[${e}].hp`) < 10, 'the old body blew up');
});

test('Ultron: a killing blow jumps his mind into a bot instead (redundancy), but not without one', () => {
  const g = solo('ultron'); g.key('KeyQ'); g.frames(2); g.eval('player.hp = 1'); lethal(g); g.frames(1);
  assert.strictEqual(g.get('state'), 'play', 'he survived'); assert.strictEqual(g.get('player.hp'), 3); assert.strictEqual(botsOf(g).length, 2);
  const h = solo('ultron'); h.eval('player.hp = 1'); lethal(h); assert.strictEqual(h.get('state'), 'over', 'with no bot there is nothing to jump to');
});

// ---- Vision ----
test('Vision: mind bolts pass through two enemies but not a third', () => {
  const g = solo('vision'); const ids = [400, 480, 560].map(x => addEnemy(g, x, 300, 20)); for (const i of ids) g.eval(`enemies[${i}].stun = 99`);
  g.mouseMove(900, 300); g.frames(2); g.mouseDown(0); g.frames(1); g.mouseUp(0); hold(g, 30);
  assert(g.get(`enemies[${ids[0]}].hp`) < 20 && g.get(`enemies[${ids[1]}].hp`) < 20, 'two were hit'); assert.strictEqual(g.get(`enemies[${ids[2]}].hp`), 20);
});

test('Vision: the thermal emitter throws enemies back, sets them alight, and turns enemy fire around', () => {
  const g = solo('vision'); const a = addEnemy(g, 400, 300, 20), out = addEnemy(g, 200, 520, 20); g.eval(`enemies[${out}].stun = 99`);
  g.eval("ebolts.push({ x: 350, y: 300, vx: -200, vy: 0, life: 5, friendly: false, col: '#fff' })"); g.mouseMove(900, 300); g.frames(2);
  g.mouseDown(2); g.mouseUp(2); g.frames(1);
  const hp0 = g.get(`enemies[${a}].hp`); assert(hp0 <= 18.4, 'hurt'); assert(g.eval(`enemies[${a}].vburn > time`), 'burning');
  assert.strictEqual(g.eval('ebolts[0].friendly'), true); assert(g.eval('ebolts[0].vx') > 0, 'fire sent back');
  hold(g, 5); assert(g.get(`enemies[${a}].x`) > 440, 'thrown back'); hold(g, 80); assert(g.get(`enemies[${a}].hp`) < hp0, 'and the fire keeps burning');
  assert.strictEqual(g.get(`enemies[${out}].hp`), 20, 'enemies outside the cone are untouched');
});

test('Vision: Q makes him intangible. Nothing touches him, and the enemies he passes through reel', () => {
  const g = solo('vision'); const i = addEnemy(g, 210, 300, 20); g.key('KeyQ'); g.frames(1); assert(g.get('player.phase') > 3);
  g.eval("ebolts.push({ x: player.x, y: player.y, vx: 0, vy: 0, life: 3, friendly: false, col: '#fff' })"); g.eval('player.inv = 0'); g.frames(10);
  assert.strictEqual(g.get('player.hp'), 5, 'enemy contact and a bolt did nothing'); assert(g.get(`enemies[${i}].hp`) < 20 && g.get(`enemies[${i}].stun`) > 0, 'the enemy he passed through reeled');
  for (let f = 0; f < 260 && g.get('player.phase') > 0; f++) { clearField(g); g.frames(1); }
  assert.strictEqual(g.get('player.phase'), 0); clearField(g); addEnemy(g, g.get('player.x'), g.get('player.y')); g.eval('player.inv = 0'); g.frames(3);
  assert.strictEqual(g.get('player.hp'), 4, 'solid again');
});

test('Vision: E freezes everything around him, and bolts too (bosses only briefly)', () => {
  const g = solo('vision'); const near = addEnemy(g, 320, 300), far = addEnemy(g, 640, 300); g.eval('enemies.push(makeEnemy("leviathan", 200, 420))');
  g.eval("ebolts.push({ x: 300, y: 330, vx: 0, vy: 0, life: 9, friendly: false, col: '#fff' })"); g.key('KeyE'); g.frames(1);
  assert(g.get(`enemies[${near}].stun`) > 2.5, 'frozen'); assert(g.get(`enemies[${far}].stun`) < 0.5, 'out of range'); assert.strictEqual(g.get('ebolts.length'), 0);
  assert(g.get('enemies[enemies.length - 1].stun') < 1, 'a boss shakes it off almost at once');
});

test('Vision: R Mind Stone beam crosses the whole arena (further than Ultron laser), but only along its line', () => {
  const g = solo('vision'); const far = addEnemy(g, 880, 300, 30), side = addEnemy(g, 600, 430, 30); for (const i of [far, side]) g.eval(`enemies[${i}].stun = 99`);
  g.mouseMove(900, 300); g.frames(2); g.key('KeyR'); hold(g, 90);
  assert(g.get(`enemies[${far}].hp`) < 22, 'hit 680px away'); assert.strictEqual(g.get(`enemies[${side}].hp`), 30);
});

// ---- Iron Man: Hulkbuster ----
const hbOn = g => { g.key('KeyH'); for (let f = 0; f < 60; f++) hold(g, 1); };

test('Hulkbuster: H drops the suit on him. It lands as a shockwave, he is bigger and slower, and his skills change', () => {
  const g = solo('iron'); const i = addEnemy(g, 280, 300, 20); g.eval(`enemies[${i}].stun = 99`); const normal = g.eval('HEROES.iron.skills().map(s => s.n).join()');
  const sp0 = g.eval('HEROES.iron.speed({})'); g.key('KeyH'); g.frames(1);
  assert.strictEqual(g.get('player.hb'), true); assert(g.get('player.hbDrop') > 0, 'the suit is still falling');
  for (let f = 0; f < 60; f++) hold(g, 1);
  assert(g.get(`enemies[${i}].hp`) <= 18.5, 'landing hurt the enemy next to him');
  assert.strictEqual(g.eval('HEROES.iron.skills().map(s => s.n).join()').startsWith('Punch,Throw Arm,Drill,Sonic,Smash'), true); assert(normal.startsWith('Laser'));
  assert(g.eval('HEROES.iron.hitRadius()') > g.get('player.r') * 1.4, 'bigger'); assert(g.eval('HEROES.iron.speed({})') < sp0 - 30, 'slower');
});

test('Hulkbuster: click punches the enemy in front, not the one behind', () => {
  const g = solo('iron'); hbOn(g); const f = addEnemy(g, g.get('player.x') + 90, g.get('player.y'), 20), b = addEnemy(g, g.get('player.x') - 90, g.get('player.y'), 20);
  for (const i of [f, b]) g.eval(`enemies[${i}].stun = 99`);
  g.mouseMove(900, 300); g.frames(2); g.mouseDown(0); g.mouseUp(0); g.frames(1);
  assert(g.get(`enemies[${f}].hp`) <= 17.9, 'punched'); assert.strictEqual(g.get(`enemies[${b}].hp`), 20, 'the one behind is untouched');
});

test('Hulkbuster: right click throws an arm that flies out, hurts what it passes, and comes back', () => {
  const g = solo('iron'); const i = addEnemy(g, 520, 300, 30); g.eval(`enemies[${i}].stun = 99`); hbOn(g); g.mouseMove(900, 300); g.frames(2);
  g.mouseDown(2); g.mouseUp(2); g.frames(1); assert(g.json('HEROES.iron.api.hb()').arm, 'the arm is out');
  for (let f = 0; f < 240 && g.json('HEROES.iron.api.hb()').arm; f++) hold(g, 1);
  assert.strictEqual(g.json('HEROES.iron.api.hb()').arm, false, 'it came back'); assert(g.get(`enemies[${i}].hp`) <= 27.5); assert(g.get('cd.hb_arm') > 0);
});

test('Hulkbuster: Q drill chews through what is in front and bores him forward', () => {
  const g = solo('iron'); hbOn(g); const x0 = g.get('player.x'), i = addEnemy(g, x0 + 100, g.get('player.y'), 40); g.eval(`enemies[${i}].stun = 99`); g.mouseMove(900, 300); g.frames(2);
  g.key('KeyQ'); g.frames(1); assert(g.json('HEROES.iron.api.hb()').drill);
  for (let f = 0; f < 160 && g.json('HEROES.iron.api.hb()').drill; f++) { g.eval(`player.inv = 1; enemies[${i}].stun = 99`); g.frames(1); }
  assert(g.get(`enemies[${i}].hp`) <= 37.5, 'drilled (' + g.get(`enemies[${i}].hp`) + ')'); assert(g.get('player.x') - x0 > 150, 'and moved forward');
});

test('Hulkbuster: E sonic stuns everything nearby and nothing far away', () => {
  const g = solo('iron'); hbOn(g); const px = g.get('player.x'), py = g.get('player.y'), near = addEnemy(g, px + 150, py, 20), far = addEnemy(g, px + 440, py, 20); g.eval(`enemies[${far}].stun = 99`);
  assert.strictEqual(g.get(`enemies[${near}].hp`), 20); g.key('KeyE'); g.frames(1);
  assert(g.get(`enemies[${near}].stun`) > 1.5, 'stunned'); assert(g.get(`enemies[${near}].hp`) <= 19, 'hurt'); assert.strictEqual(g.get(`enemies[${far}].hp`), 20, 'out of range');
});

test('Hulkbuster: F leaps and smashes the ground, like the Hulk', () => {
  const g = solo('iron'); const i = addEnemy(g, 540, 300, 30); g.eval(`enemies[${i}].stun = 99`); hbOn(g); g.mouseMove(560, 300); g.frames(2);
  g.key('KeyF'); for (let f = 0; f < 50; f++) hold(g, 1);
  assert(Math.abs(g.get('player.x') - 540) < 30, 'landed on the target'); assert(g.get(`enemies[${i}].hp`) <= 26); assert(g.get(`enemies[${i}].stun`) > 0.5);
});

test('Hulkbuster: three layers of armour soak three hits, then it breaks off him and goes on cooldown', () => {
  const g = solo('iron'); hbOn(g); g.eval('player.inv = 0');
  lethal(g); assert.strictEqual(g.get('player.hp'), 5); assert.strictEqual(g.get('player.hb'), true); assert.strictEqual(g.get('player.hbCharges'), 2);
  lethal(g); assert.strictEqual(g.get('player.hb'), true); lethal(g);
  assert.strictEqual(g.get('player.hp'), 5, 'Tony never took a hit'); assert.strictEqual(g.get('player.hb'), false, 'the suit broke off him'); assert(g.get('cd.hb_toggle') >= 24);
});

test('Hulkbuster: H takes it off, with a cooldown, and the normal kit comes back', () => {
  const g = solo('iron'); hbOn(g); g.key('KeyH'); g.frames(1);
  assert.strictEqual(g.get('player.hb'), false); assert(g.get('cd.hb_toggle') > 9); g.key('KeyH'); g.frames(1); assert.strictEqual(g.get('player.hb'), false, 'cannot put it straight back on');
  g.mouseMove(900, 300); g.frames(1); g.mouseDown(0); g.mouseUp(0); g.frames(1); assert(g.get('cd.repulsor') > 0, 'the repulsor works again');
});

// ================= the extension promise =================
test('a brand-new hero dropped in as one file plays, with no engine edits', () => {
  const g = loadGame({ extra: ['docs/hero-template.js'] });
  assert.strictEqual(g.eval('heroes().length'), 16);
  assert(g.exists('hero-template'), 'menu card was generated');
  startRun(g, { hero: 'template' });
  assert.strictEqual(g.get('look.char'), 'template');
  clearField(g); g.eval('enemies.push(makeEnemy("grunt", player.x + 160, player.y)); enemies[0].hp = 20; enemies[0].max = 20');
  g.mouseMove(g.eval('player.x + 300'), g.eval('player.y')); g.frames(3); g.mouseDown(0); g.frames(40); g.mouseUp(0);
  assert(g.get('enemies[0].hp') < 20, 'the new hero damaged the enemy');
  mash(g, 600, 21);                                              // and survives button-mashing in the campaign-free arena
});

// ---- run ----
let failed = 0, ran = 0;
const only = process.env.ONLY ? new RegExp(process.env.ONLY, 'i') : null;      // run just some tests:  ONLY=ultron node tests/run.js
for (const [name, fn] of tests) {
  if (only && !only.test(name)) continue;
  const t0 = Date.now(); ran++;
  try { fn(); console.log('ok    ' + name + '  (' + (Date.now() - t0) + 'ms)'); }
  catch (e) { failed++; console.log('FAIL  ' + name + '\n      ' + String(e && e.message).split('\n').join('\n      ')); }
}
console.log(`\n${ran - failed}/${ran} passed` + (only ? `  (filtered by ONLY=${process.env.ONLY}, of ${tests.length} tests)` : ''));
process.exit(failed ? 1 : 0);