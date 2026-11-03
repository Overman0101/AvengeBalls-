// The cutscene engine: ball-design actors on a stage, speech bubbles, narration captions and simple staging
// (spawn, move, tween, effects). Scenes are plain data, see docs/CUTSCENES.md and js/campaigns/newyork-scenes.js.
//
//   registerActor({ id, name, color, draw(g, x, y, r, aim, alpha, actor) })   story-only characters (heroes need no registration)
//   registerStage(id, (g, t, cut) => { ... })                                 a backdrop, drawn over the whole canvas
//   registerProp(type, (g, prop, t) => { ... })                               things on the stage (a cube, a portal, a missile...)
//   registerScene({ id, title, stage, actors, props, steps })                 a script
//   playScenes(['sceneId', ...], onDone)                                      play them in order, then call onDone
//
// Controls while a scene plays: click / Space / Enter to continue, Esc to skip the whole sequence.
const ACTORS = {}, STAGES = {}, PROPS = {}, SCENES = {};
let cut = null;                       // the running scene, or null
let cutQueue = [], cutDone = null;    // scenes still to play, and what to do afterwards
const cutsceneLog = [];               // every line shown: { scene, kind, who, as, text }  (the tests read this)

function registerActor(def) { if (ACTORS[def.id]) throw new Error('Duplicate actor: ' + def.id); ACTORS[def.id] = def; }
function registerStage(id, draw) { if (STAGES[id]) throw new Error('Duplicate stage: ' + id); STAGES[id] = draw; }
function registerProp(type, draw) { if (PROPS[type]) throw new Error('Duplicate prop: ' + type); PROPS[type] = draw; }
function registerScene(def) { if (SCENES[def.id]) throw new Error('Duplicate scene: ' + def.id); SCENES[def.id] = def; }

// Draws any hero with its own default look (not the player's customised one), e.g. Thor in a scene while you play Hulk.
function drawHeroAs(id, g, x, y, r, aim, alpha, opt) {
  const saved = { char: look.char, cape: look.cape, fx: look.fx, gear: look.gear, bolt: C.bolt };
  look.char = id; look.cape = CHARS[id].cape; look.fx = CHARS[id].fx; look.gear = 0; C.bolt = CHARS[id].fx;
  try { drawChar(g, x, y, r, aim, alpha, opt || null); }
  finally { look.char = saved.char; look.cape = saved.cape; look.fx = saved.fx; look.gear = saved.gear; C.bolt = saved.bolt; }
}

function actorInfo(id) {
  if (ACTORS[id]) return { id, name: ACTORS[id].name, color: ACTORS[id].color, custom: ACTORS[id] };
  const H0 = HEROES[id];
  if (!H0) throw new Error('Unknown cutscene actor: ' + id);
  return { id, name: H0.name, color: CHARS[id].cape, hero: id };
}
function logLine(kind, who, as, text) {
  cutsceneLog.push({ scene: cut.def.id, kind, who, as, text });
  if (cutsceneLog.length > 600) cutsceneLog.shift();
}
function resolveFace(f, x, y) {
  if (typeof f === 'number') return f;
  const t = typeof f === 'string' && (cut.actors[f] || cut.props[f]);
  return t ? Math.atan2(t.y - y, t.x - x) : 0;
}
function puff(x, y) { cut.puffs.push({ x, y, life: 0.45 }); }

// "$player" is the hero you picked. It joins the scene as an extra, unless that hero is already part of the cast.
function addActor(spec, popIn) {
  let id = spec.id, key = spec.id, isPlayer = false;
  if (id === '$player') {
    if (cut.actors[look.char]) return null;
    id = look.char; isPlayer = true; cut.extra = true;
  }
  const info = actorInfo(id);
  const a = { id: key, hero: id, info, isPlayer, x: spec.x, y: spec.y, r: spec.r || 22, face: 0,
              alpha: popIn ? 0 : 1, scale: 1, bob: 0, glow: spec.glow || null, anger: spec.anger || 0, talking: false, munch: !!spec.munch };
  a.face = resolveFace(spec.face == null ? 0 : spec.face, a.x, a.y);
  cut.actors[key] = a;
  if (popIn) puff(a.x, a.y);
  return a;
}

function startScene(id) {
  const def = SCENES[id];
  if (!def) throw new Error('Unknown scene: ' + id);
  cut = { def, actors: {}, props: {}, steps: def.steps, i: -1, rt: null, t: 0, titleT: def.title ? 1.6 : 0, fadeIn: 0.4,
          flash: 0, shake: 0, alarm: 0, puffs: [], ending: false, endT: 0, extra: false };
  for (const a of def.actors || []) addActor(a, false);
  for (const p of def.props || []) cut.props[p.id] = Object.assign({}, p);
}
function playScenes(ids, onDone) {
  cutQueue = ids.slice(); cutDone = onDone || null;
  state = 'cutscene';
  startScene(cutQueue.shift());
}
function finishScene() {
  if (cutQueue.length) { startScene(cutQueue.shift()); return; }
  const cb = cutDone; cut = null; cutDone = null;
  if (cb) cb();
}
function skipCutscene() {
  if (!cut) return;
  cutQueue = []; const cb = cutDone; cut = null; cutDone = null;
  if (cb) cb();
}
function advanceCutscene() {
  if (!cut) return;
  if (cut.titleT > 0) { cut.titleT = 0; return; }
  const rt = cut.rt;
  if (!rt || !rt.wait) return;
  if (rt.typed < rt.text.length) { rt.full = true; rt.typed = rt.text.length; }     // first click finishes the typing, the next one continues
  else rt.done = true;
}

// ---- steps ----
const STEP_KEYS = ['say', 'narrate', 'card', 'spawn', 'move', 'tween', 'face', 'set', 'attach', 'fx', 'wait', 'par', 'seq', 'remove'];
const stepKind = s => STEP_KEYS.find(k => k in s) || 'wait';
const target = id => cut.actors[id] || cut.props[id];

function beginStep(s) {
  const kind = stepKind(s), rt = { s, kind, t: 0, done: false, dur: 0 };
  switch (kind) {
    case 'say': {
      const info = actorInfo(s.say);
      rt.text = s.text; rt.label = s.as || info.name; rt.color = info.color; rt.actor = cut.actors[s.say] || null; rt.wait = true; rt.typed = 0;
      logLine('say', s.say, rt.label, s.text); break;
    }
    case 'narrate': rt.text = s.narrate; rt.wait = true; rt.typed = 0; logLine('narrate', null, null, s.narrate); break;
    case 'card': rt.text = s.card; rt.wait = true; rt.typed = 0; logLine('card', null, null, s.card); break;
    case 'spawn': rt.dur = addActor(s.spawn, true) ? (s.wait != null ? s.wait : 0.3) : 0; break;
    case 'seq': rt.list = s.seq; rt.idx = 0; rt.cur = null; break;
    case 'move': {
      const o = target(s.move);
      if (!o) { rt.skip = true; break; }
      rt.o = o; rt.fx = o.x; rt.fy = o.y; rt.tx = s.to[0]; rt.ty = s.to[1]; rt.dur = s.dur || 0.8; rt.turn = s.turn !== false && !!cut.actors[s.move]; break;
    }
    case 'tween': {
      const o = target(s.tween);
      if (!o) { rt.skip = true; break; }
      rt.o = o; rt.from = o[s.key] == null ? 0 : o[s.key]; rt.dur = s.dur || 0.8; break;
    }
    case 'face': { const o = target(s.face); if (o) o.face = resolveFace(s.to, o.x, o.y); break; }
    case 'set': { const o = target(s.set); if (o) for (const k in s) if (k !== 'set') o[k] = s[k]; break; }
    case 'attach': { const o = cut.props[s.attach]; if (o) o.attach = { to: s.to, dx: s.dx || 0, dy: s.dy || 0 }; break; }
    case 'fx':
      if (s.fx === 'flash') cut.flash = 1;
      else if (s.fx === 'shake') cut.shake = s.t || 0.7;
      else if (s.fx === 'alarm') cut.alarm = s.t || 2;
      break;
    case 'remove': {
      const a = cut.actors[s.remove];
      if (a) { puff(a.x, a.y); delete cut.actors[s.remove]; } else delete cut.props[s.remove];
      break;
    }
    case 'par': rt.subs = s.par.map(beginStep); break;
    case 'wait': rt.dur = s.wait || 0.5; break;
  }
  if ((kind === 'say' || kind === 'narrate') && s.during) rt.subs = s.during.map(beginStep);     // staged action that plays alongside the line
  return rt;
}
const ease = p => p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
function tickStep(rt, dt) {
  rt.t += dt;
  switch (rt.kind) {
    case 'say': case 'narrate': case 'card':
      rt.typed = rt.full ? rt.text.length : Math.min(rt.text.length, rt.t * 55);
      if (rt.actor) { rt.actor.talking = rt.typed < rt.text.length; rt.actor.bob = rt.actor.talking ? Math.sin(rt.t * 16) * 2.5 : 0; }
      if (rt.subs) for (const sub of rt.subs) if (!sub.done) sub.done = tickStep(sub, rt.done ? 1e3 : dt);   // leaving the line snaps any unfinished action to its end
      if (rt.done && rt.actor) rt.actor.talking = false;
      return rt.done;
    case 'move': {
      if (rt.skip) return true;
      const p = Math.min(1, rt.t / rt.dur), e = ease(p);
      rt.o.x = rt.fx + (rt.tx - rt.fx) * e; rt.o.y = rt.fy + (rt.ty - rt.fy) * e;
      if (rt.turn && Math.hypot(rt.tx - rt.fx, rt.ty - rt.fy) > 8) rt.o.face = Math.atan2(rt.ty - rt.fy, rt.tx - rt.fx);
      return p >= 1;
    }
    case 'tween': {
      if (rt.skip) return true;
      const p = Math.min(1, rt.t / rt.dur);
      rt.o[rt.s.key] = rt.from + (rt.s.to - rt.from) * ease(p);
      return p >= 1;
    }
    case 'par': { let all = true; for (const sub of rt.subs) { if (!sub.done) sub.done = tickStep(sub, dt); all = all && sub.done; } return all; }
    case 'seq':
      for (let n = 0; n < 60; n++) {
        if (!rt.cur) { if (rt.idx >= rt.list.length) return true; rt.cur = beginStep(rt.list[rt.idx++]); }
        if (tickStep(rt.cur, n === 0 ? dt : 0)) rt.cur = null; else return false;
      }
      return false;
    case 'spawn': case 'wait': return rt.t >= rt.dur;
    default: return true;                                         // instant steps (face, set, attach, fx, remove)
  }
}
function nextStep() {
  for (;;) {
    cut.i++;
    if (cut.i >= cut.steps.length) { cut.ending = true; cut.endT = 0.5; cut.rt = null; return; }
    const s = cut.steps[cut.i];
    if (s.only && s.only !== team) continue;                      // step for one team only
    if (s.ifExtra && !cut.extra) continue;                        // only if the player's hero joined the scene as an extra
    cut.rt = beginStep(s); return;
  }
}

function updateCutscene(dt) {
  if (!cut) return;
  cut.t += dt;
  cut.flash = Math.max(0, cut.flash - dt * 1.8); cut.shake = Math.max(0, cut.shake - dt); cut.alarm = Math.max(0, cut.alarm - dt);
  for (const p of cut.puffs) p.life -= dt;
  cut.puffs = cut.puffs.filter(p => p.life > 0);
  for (const a of Object.values(cut.actors)) {
    a.alpha = Math.min(1, a.alpha + dt * 3);
    if (a.munch) a.bob = Math.abs(Math.sin(cut.t * 8 + a.x)) * 2.2; else if (!a.talking) a.bob *= 0.8;
  }
  for (const p of Object.values(cut.props)) {
    if (!p.attach) continue;
    const host = cut.actors[p.attach.to];
    if (host) { p.x = host.x + p.attach.dx; p.y = host.y + p.attach.dy; }
  }
  if (cut.fadeIn > 0) cut.fadeIn -= dt;
  if (cut.titleT > 0) { cut.titleT -= dt; return; }
  if (cut.ending) { cut.endT -= dt; if (cut.endT <= 0) finishScene(); return; }
  for (let guard = 0; guard < 60 && cut && !cut.ending; guard++) {   // run instant steps back to back
    if (!cut.rt) nextStep();
    if (!cut.rt) break;
    if (tickStep(cut.rt, guard === 0 ? dt : 0)) cut.rt = null; else break;
  }
}

// ---- drawing ----
function wrapText(text, maxW) {
  const words = text.split(' '), lines = []; let cur = '';
  for (const w of words) {
    const t = cur ? cur + ' ' + w : w;
    if (cur && ctx.measureText(t).width > maxW) { lines.push(cur); cur = w; } else cur = t;
  }
  if (cur) lines.push(cur);
  return lines;
}
function typedLines(lines, typed) {
  let left = Math.floor(typed);
  return lines.map(l => { const s = l.slice(0, Math.max(0, left)); left -= l.length + 1; return s; });
}
function rrect(x, y, w, h, r) {
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}
const SERIF = '"Palatino Linotype", Palatino, Georgia, serif';

function drawActor(a) {
  const r = a.r * a.scale, by = a.y - Math.abs(a.bob);
  ctx.save(); ctx.globalAlpha = a.alpha;
  ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(a.x, a.y + r * 0.9, r, r * 0.4, 0, 0, 7); ctx.fill();
  if (a.info.custom) a.info.custom.draw(ctx, a.x, by, r, a.face, 1, a);
  else if (a.isPlayer) drawChar(ctx, a.x, by, r, a.face, 1, null);
  else drawHeroAs(a.hero, ctx, a.x, by, r, a.face, 1, { anger: a.anger });
  if (a.glow) {                                                   // mind control: glowing eyes and an aura
    const c = Math.cos(a.face), s = Math.sin(a.face);
    ctx.shadowColor = a.glow; ctx.shadowBlur = 14; ctx.fillStyle = a.glow;
    for (const sd of [-1, 1]) { ctx.beginPath(); ctx.arc(a.x + c * r * 0.55 - s * sd * r * 0.28, by + s * r * 0.55 + c * sd * r * 0.28, 3, 0, 7); ctx.fill(); }
    ctx.strokeStyle = a.glow; ctx.globalAlpha = 0.5 * a.alpha; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(a.x, by, r + 7, 0, 7); ctx.stroke();
  }
  ctx.restore();
}

function drawBubble(rt) {
  const a = rt.actor, maxW = 380, pad = 12;
  ctx.font = '18px ' + SERIF;
  const lines = wrapText(rt.text, maxW), w = Math.min(maxW, Math.max(...lines.map(l => ctx.measureText(l).width))) + pad * 2, h = lines.length * 24 + pad * 2;
  const ax = a ? a.x : W / 2, ay = a ? a.y : 300, ar = a ? a.r : 22;
  let bx = Math.min(W - w - 24, Math.max(24, ax - w / 2)), by = ay - ar - h - 30, below = false;
  if (by < 46) { by = ay + ar + 30; below = true; }
  ctx.save();
  ctx.fillStyle = 'rgba(14,20,30,0.94)'; ctx.strokeStyle = rt.color; ctx.lineWidth = 2;
  rrect(bx, by, w, h, 10); ctx.fill(); ctx.stroke();
  ctx.beginPath();                                                // tail pointing at the speaker
  const tx = Math.min(bx + w - 18, Math.max(bx + 18, ax));
  if (below) { ctx.moveTo(tx - 9, by + 1); ctx.lineTo(ax, ay + ar + 4); ctx.lineTo(tx + 9, by + 1); }
  else { ctx.moveTo(tx - 9, by + h - 1); ctx.lineTo(ax, ay - ar - 4); ctx.lineTo(tx + 9, by + h - 1); }
  ctx.fillStyle = 'rgba(14,20,30,0.94)'; ctx.fill(); ctx.stroke();
  const tag = rt.label.toUpperCase(); ctx.font = '700 12px ' + SERIF;
  const tw = ctx.measureText(tag).width + 16;
  ctx.fillStyle = rt.color; rrect(bx + 10, by - 12, tw, 20, 6); ctx.fill();
  ctx.fillStyle = '#0b1018'; ctx.textBaseline = 'middle'; ctx.textAlign = 'left'; ctx.fillText(tag, bx + 18, by - 2);
  ctx.font = '18px ' + SERIF; ctx.fillStyle = '#eef3f8'; ctx.textBaseline = 'top';
  typedLines(lines, rt.typed).forEach((l, i) => ctx.fillText(l, bx + pad, by + pad + i * 24));
  ctx.restore();
}
function drawCaption(rt, big) {
  ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'top';
  if (big) {
    ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(0, 0, W, H);
    ctx.font = '700 64px ' + SERIF; ctx.shadowColor = C.bolt; ctx.shadowBlur = 24; ctx.fillStyle = '#eef6ff';
    ctx.textBaseline = 'middle'; ctx.fillText(rt.text.slice(0, Math.floor(rt.typed)), W / 2, H / 2);
  } else {
    ctx.font = 'italic 18px ' + SERIF;
    const lines = wrapText(rt.text, 840), h = lines.length * 24 + 20, y = H - 36 - h - 4;
    ctx.fillStyle = 'rgba(8,12,20,0.86)'; rrect(50, y, W - 100, h, 10); ctx.fill();
    ctx.fillStyle = '#d9e4ee';
    typedLines(lines, rt.typed).forEach((l, i) => ctx.fillText(l, W / 2, y + 10 + i * 24));
  }
  ctx.restore();
}

function drawCutscene() {
  if (!cut) return;
  const rt = cut.rt, t = cut.t;
  ctx.save();
  ctx.fillStyle = '#05080c'; ctx.fillRect(0, 0, W, H);
  if (cut.shake > 0) ctx.translate((Math.random() - 0.5) * 10 * Math.min(1, cut.shake), (Math.random() - 0.5) * 10 * Math.min(1, cut.shake));
  const stage = STAGES[cut.def.stage];
  if (stage) stage(ctx, t, cut);
  const props = Object.values(cut.props);
  for (const p of props) if (!p.front && PROPS[p.type]) PROPS[p.type](ctx, p, t);
  Object.values(cut.actors).sort((a, b) => a.y - b.y).forEach(drawActor);
  for (const p of props) if (p.front && PROPS[p.type]) PROPS[p.type](ctx, p, t);
  for (const q of cut.puffs) {                                    // spawn / vanish puffs
    const k = 1 - q.life / 0.45; ctx.strokeStyle = 'rgba(255,255,255,' + (0.7 * (1 - k)) + ')'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(q.x, q.y, 10 + k * 34, 0, 7); ctx.stroke();
  }
  if (cut.alarm > 0) { ctx.fillStyle = 'rgba(255,40,40,' + (0.10 + 0.14 * Math.abs(Math.sin(t * 7))) + ')'; ctx.fillRect(0, 0, W, H); }
  if (rt && rt.kind === 'say') {
    const sp = rt.actor; if (sp) { ctx.strokeStyle = rt.color; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(sp.x, sp.y + sp.r * 0.9, sp.r * 1.2, sp.r * 0.5, 0, 0, 7); ctx.stroke(); }
    drawBubble(rt);
  }
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, 36); ctx.fillRect(0, H - 36, W, 36);          // cinematic bars
  if (rt && rt.kind === 'narrate') drawCaption(rt, false);
  if (rt && rt.kind === 'card') drawCaption(rt, true);
  if (cut.flash > 0) { ctx.fillStyle = 'rgba(255,255,255,' + Math.min(1, cut.flash) + ')'; ctx.fillRect(0, 0, W, H); }
  if (cut.titleT > 0) {                                            // scene title card
    const k = cut.titleT / 1.6, a = Math.min(1, (1 - k) * 4, k * 3);
    ctx.fillStyle = 'rgba(0,0,0,' + (0.7 * Math.min(1, k * 2)) + ')'; ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = Math.max(0, a); ctx.fillStyle = '#eef6ff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = '700 40px ' + SERIF; ctx.shadowColor = C.bolt; ctx.shadowBlur = 18; ctx.fillText(cut.def.title, W / 2, H / 2); ctx.globalAlpha = 1;
  }
  const fade = cut.ending ? 1 - cut.endT / 0.5 : Math.max(0, cut.fadeIn / 0.4);
  if (fade > 0) { ctx.fillStyle = 'rgba(0,0,0,' + Math.min(1, fade) + ')'; ctx.fillRect(0, 0, W, H); }
  ctx.fillStyle = 'rgba(231,238,244,0.55)'; ctx.font = '13px ' + SERIF; ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
  ctx.fillText('Esc: skip', W - 20, 18);
  if (rt && rt.wait && rt.typed >= rt.text.length && Math.floor(t * 2) % 2 === 0) { ctx.textAlign = 'right'; ctx.fillText('Click or Space to continue', W - 20, H - 18); }
  ctx.restore();
}
