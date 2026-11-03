// The Endless-mode arenas.  Extra look-and-feel options:
//   sheen / sheenGlow: colour of the decorative floor lines.   slip: ice (movement eases).   hazard: lava geysers.
//   ambient: 'snow' | 'ember' | 'debris' drifting particles (ambCol tints them).   decor(cx, cy): custom floor art.
registerLocation('asgard', { name: 'Asgard Courtyard', desc: 'Plain stone. No tricks.', f0: '#243345', f1: '#17212d', wall: '#59677a', slip: 0, hazard: false, ambient: null });
registerLocation('jotun', { name: 'Jotunheim Ice Field', desc: 'Slippery ice: you slide when you move, so plan your steps.', f0: '#2d4d68', f1: '#13263a', wall: '#86adc9', slip: 5, hazard: false, ambient: 'snow', sheen: 'rgba(220,240,255,0.10)' });
registerLocation('muspel', { name: 'Muspelheim Forge', desc: 'Lava geysers erupt around the arena. They burn you and your enemies.', f0: '#4d2c24', f1: '#200e0b', wall: '#94503a', slip: 0, hazard: true, ambient: 'ember', sheen: 'rgba(255,120,50,0.30)', sheenGlow: '#ff7a30' });
