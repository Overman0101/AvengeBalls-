// Canvas handles, arena geometry and the shared colour helpers.
// Everything in js/ shares one global scope (classic <script> tags, no build step),
// so top-level names in core/ and shared/ must be unique across the whole project.
const cv = document.getElementById('c');
const ctx = cv.getContext('2d');
const pv = document.getElementById('preview');
const pctx = pv.getContext('2d');
const W = 960, H = 600;
const A = { x: 40, y: 60, w: 880, h: 500 };          // arena rectangle
const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
const $ = id => document.getElementById(id);

const C = { bolt: '#a8ecff', iron: '#98a4b0', ember: '#e8683a', ink: '#e7eef4' };
let fxRGB = [168, 236, 255];
const fx = a => `rgba(${fxRGB[0]},${fxRGB[1]},${fxRGB[2]},${a})`;
function setFx(hex) {
  C.bolt = hex;
  const n = parseInt(hex.slice(1), 16);
  fxRGB = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  document.documentElement.style.setProperty('--bolt', hex);
}
