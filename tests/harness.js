// A tiny headless "browser" for the game: loads the scripts listed in index.html, in order, into one shared
// global scope (just like <script> tags), with a stubbed canvas, DOM and audio. No dependencies, Node 16+.
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.resolve(__dirname, '..');

// Builds the fake browser environment for a page (any html text) and returns helpers to drive it.
function createEnv(html, seed = 1) {
  const noop = () => {};
  const byId = {}, handlers = {}, listeners = {};
    const ctx2d = new Proxy({}, { get: (t, k) => (k === 'createRadialGradient' || k === 'createLinearGradient' ? () => ({ addColorStop: noop }) : k === 'measureText' ? s => ({ width: String(s).length * 8 }) : noop), set: () => true });
  function makeEl(id) {
    return {
      id, style: {}, disabled: false, children: [], _html: '', _text: '', attrs: {},
      classList: { add: noop, remove: noop, toggle: noop },
      setAttribute(k, v) { this.attrs[k] = v; }, getAttribute(k) { return this.attrs[k]; },
      addEventListener(type, fn) { const key = (this.id || '_') + ':' + type; (handlers[key] = handlers[key] || []).push(fn); },
      removeEventListener: noop, blur: noop, focus: noop,
      appendChild(c) { this.children.push(c); if (c.id) byId[c.id] = c; return c; },
      getContext: () => ctx2d,
      getBoundingClientRect: () => ({ left: 0, top: 0, width: 960, height: 600 }),
      set innerHTML(v) { this._html = v; if (v === '') this.children = []; }, get innerHTML() { return this._html; },
      set textContent(v) { this._text = v; }, get textContent() { return this._text; },
    };
  }
  for (const m of html.matchAll(/id="([^"]+)"/g)) byId[m[1]] = makeEl(m[1]);
  const documentStub = {
    getElementById: id => byId[id] || (byId[id] = makeEl(id)),
    createElement: () => makeEl(''),
    documentElement: { style: { setProperty: noop } },
  };
  const fakeAudio = () => new Proxy(function () {}, {
    get: (t, k) => k === 'sampleRate' ? 44100 : k === 'currentTime' ? 0 :
      k === 'createBuffer' ? () => ({ getChannelData: () => new Float32Array(8) }) :
      (k === 'frequency' || k === 'gain') ? { value: 0, setValueAtTime: noop, exponentialRampToValueAtTime: noop } : fakeAudio(),
    apply: () => fakeAudio(), set: () => true });
  let raf = null;
  const sandbox = {
    console, document: documentStub, matchMedia: () => ({ matches: false }), performance: { now: () => 0 },
    requestAnimationFrame: f => { raf = f; }, setTimeout: noop, AudioContext: function () { return fakeAudio(); },
    addEventListener: (t, f) => { (listeners[t] = listeners[t] || []).push(f); },
  };
  sandbox.window = sandbox;
  const context = vm.createContext(sandbox);
  const run = (code, file) => vm.runInContext(code, context, { filename: file || 'eval' });

  // Deterministic randomness. Drawing uses its own stream so rendering can never change gameplay.
  run(`(function(){ const mk = o => () => { o.s = (o.s * 1664525 + 1013904223) >>> 0; return o.s / 4294967296; };
        const a = mk({ s: ${seed >>> 0} || 1 }), b = mk({ s: 12345 }); globalThis.__inDraw = false;
        Math.random = () => globalThis.__inDraw ? b() : a(); })();`);

  const g = {
    context, byId, listeners, run,
    eval: code => run(code),
    json: code => JSON.parse(run('JSON.stringify(' + code + ')')),   // read a structure out of the game as plain host objects
    get: name => run(name),                                   // read any global, e.g. g.get('player.hp')
    fire(id, type = 'click', ev = {}) { for (const f of (handlers[id + ':' + type] || [])) f(ev); },
    exists: id => !!byId[id],
    key(code, extra = {}) { for (const f of (listeners.keydown || [])) f({ code, preventDefault: noop, repeat: false, shiftKey: false, ...extra }); },
    keyup(code) { for (const f of (listeners.keyup || [])) f({ code }); },
    mouseMove(x, y) { g.fire('c', 'mousemove', { clientX: x, clientY: y }); },
    mouseDown(button = 0) { g.fire('c', 'mousedown', { button }); },
    mouseUp(button = 0) { for (const f of (listeners.mouseup || [])) f({ button }); },
    frames(n) { let t = g._t || 0; for (let i = 0; i < n; i++) { t += 16; raf(t); } g._t = t; },
  };
  return g;
}

// Loads the project: every <script src> in index.html, in order, into one shared scope.
function loadGame(opts = {}) {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const g = createEnv(html, opts.seed);
  g.scripts = [...html.matchAll(/<script src="([^"]+)"><\/script>/g)].map(m => m[1]);
  // opts.extra: files to load just before the menu, e.g. a new hero (paths relative to the project root)
  if (opts.extra) g.scripts.splice(g.scripts.findIndex(s => s.endsWith('ui/menu.js')), 0, ...opts.extra);
  for (const src of g.scripts) g.run(fs.readFileSync(path.join(ROOT, src), 'utf8'), src);
  g.run(`{ const __d = draw; draw = function () { globalThis.__inDraw = true; try { __d(); } finally { globalThis.__inDraw = false; } }; }`);
  return g;
}
module.exports = { loadGame, createEnv, ROOT };
