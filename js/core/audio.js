// Tiny synthesised sound effects, no audio files needed.
// A hero can add its own sounds from its file with:  Object.assign(sfx, { mySound: () => tone(...) });
let ac = null;
function audio() { if (!ac) ac = new (window.AudioContext || window.webkitAudioContext)(); return ac; }
function tone(f0, f1, dur, type = 'sine', vol = 0.2) {
  const a = audio(), o = a.createOscillator(), g = a.createGain();
  o.type = type; o.frequency.setValueAtTime(f0, a.currentTime);
  o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), a.currentTime + dur);
  g.gain.setValueAtTime(vol, a.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, a.currentTime + dur);
  o.connect(g).connect(a.destination); o.start(); o.stop(a.currentTime + dur);
}
function noise(dur, vol, freq) {
  const a = audio(), n = Math.floor(a.sampleRate * dur), buf = a.createBuffer(1, n, a.sampleRate);
  const d = buf.getChannelData(0); for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
  const s = a.createBufferSource(); s.buffer = buf;
  const f = a.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq;
  const g = a.createGain(); g.gain.setValueAtTime(vol, a.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, a.currentTime + dur);
  s.connect(f).connect(g).connect(a.destination); s.start();
}
const sfx = {
  throw: () => { noise(0.25, 0.25, 900); tone(300, 120, 0.2, 'triangle', 0.1); },
  hit:   () => { tone(180, 50, 0.18, 'square', 0.18); noise(0.1, 0.2, 1800); },
  slam:  () => { tone(110, 30, 0.4, 'sawtooth', 0.3); noise(0.3, 0.3, 400); },
  recall:() => { tone(120, 700, 0.45, 'sawtooth', 0.1); noise(0.5, 0.15, 3000); },
  catch: () => { tone(90, 35, 0.3, 'square', 0.35); noise(0.2, 0.3, 1200); },
  hurt:  () => { tone(220, 70, 0.25, 'sawtooth', 0.2); },
  swing: () => { noise(0.22, 0.22, 1400); tone(240, 110, 0.2, 'triangle', 0.08); },
  heal:  () => { tone(520, 880, 0.18, 'triangle', 0.18); setTimeout(() => tone(660, 1100, 0.2, 'triangle', 0.15), 90); },
  shock: () => { tone(90, 28, 0.55, 'sawtooth', 0.35); noise(0.4, 0.35, 500); },
  laser: () => { tone(1100, 260, 0.6, 'sawtooth', 0.12); noise(0.6, 0.18, 4500); },
  smite: () => { tone(70, 25, 0.7, 'sawtooth', 0.4); noise(0.6, 0.45, 300); noise(0.15, 0.4, 5000); },
  thunder:() => { tone(80, 30, 0.35, 'sawtooth', 0.25); noise(0.25, 0.3, 4000); },
  storm: () => { noise(0.9, 0.2, 200); tone(60, 40, 0.9, 'sawtooth', 0.2); },
  blast: () => { tone(700, 200, 0.22, 'sawtooth', 0.14); noise(0.15, 0.15, 2500); },
  boom:  () => { tone(140, 40, 0.3, 'square', 0.22); noise(0.2, 0.25, 900); },
  clone: () => { tone(400, 800, 0.25, 'triangle', 0.14); setTimeout(() => tone(500, 1000, 0.25, 'triangle', 0.12), 80); },
  tele:  () => { tone(1200, 200, 0.2, 'sine', 0.2); noise(0.12, 0.15, 3500); },
  cloak: () => { tone(500, 120, 0.6, 'sine', 0.16); noise(0.5, 0.1, 1200); },
  dagger:() => { noise(0.18, 0.2, 5000); tone(1300, 500, 0.15, 'triangle', 0.08); },
  howl:  () => { tone(260, 520, 0.5, 'sawtooth', 0.14); setTimeout(() => tone(520, 330, 0.5, 'sawtooth', 0.1), 250); },
  spit:  () => { tone(500, 250, 0.16, 'square', 0.08); },
  geyser:() => { tone(90, 40, 0.5, 'sawtooth', 0.3); noise(0.4, 0.3, 700); },
  clang: () => { tone(900, 500, 0.12, 'square', 0.12); noise(0.06, 0.15, 4000); },
  block: () => { tone(300, 150, 0.15, 'square', 0.22); noise(0.1, 0.25, 2500); },
  rally: () => { tone(330, 660, 0.3, 'triangle', 0.16); setTimeout(() => tone(440, 880, 0.3, 'triangle', 0.14), 110); },
  pew:   () => { tone(1500, 600, 0.09, 'sawtooth', 0.07); },
  missile:() => { noise(0.35, 0.18, 1800); tone(220, 500, 0.3, 'sawtooth', 0.08); },
  unsuit:() => { tone(600, 100, 0.5, 'square', 0.18); noise(0.4, 0.3, 2200); },
  arrow: () => { noise(0.12, 0.16, 3500); tone(900, 400, 0.1, 'triangle', 0.06); },
  zap:   () => { tone(1400, 300, 0.25, 'sawtooth', 0.14); noise(0.2, 0.2, 5000); },
  grapple:() => { tone(300, 900, 0.18, 'square', 0.1); noise(0.12, 0.15, 2500); },
  gun:   () => { noise(0.05, 0.14, 2800); tone(500, 200, 0.05, 'square', 0.05); },
  bite:  () => { tone(1800, 200, 0.3, 'sawtooth', 0.18); noise(0.25, 0.25, 4500); },
  roar:  () => { tone(120, 55, 0.7, 'sawtooth', 0.35); tone(180, 70, 0.6, 'square', 0.15); noise(0.6, 0.35, 350); },
  web:   () => { noise(0.1, 0.14, 3200); tone(700, 350, 0.1, 'triangle', 0.06); },
  sense: () => { tone(1700, 1000, 0.18, 'sine', 0.2); setTimeout(() => tone(1900, 1200, 0.15, 'sine', 0.15), 70); },
};
