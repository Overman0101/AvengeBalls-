// Game-mode state: which mode / team / campaign is selected, run upgrades ("perks"), and the hearts they grant.
let mode = 'endless', team = 'avengers';     // mode: endless | campaign
let campId = null;                            // the selected campaign (js/campaigns/)
let banner = null, teamMeter = 0;             // centre-screen text, and the team-ultimate charge (0-100)
const freshPerks = () => ({ dmg: 1, cdr: 1, spd: 1, hp: 0, drop: 0, tg: 1, tstart: 0 });
let perks = freshPerks();
const maxHp = () => 5 + perks.hp;
let camp = { ch: 0, cw: 0, queue: [], wait: 0, score: 0, over: false };   // campaign progress: chapter, wave, spawn queue...

const PERKS = [
  { name: 'Super Soldier Serum', desc: '+1 maximum heart.', ok: () => perks.hp < 2, apply() { perks.hp++; } },
  { name: 'Sharpened Edge', desc: '+12% damage.', ok: () => perks.dmg < 1.5, apply() { perks.dmg *= 1.12; } },
  { name: 'Quick Reflexes', desc: 'Skills recharge 12% faster.', ok: () => perks.cdr < 1.6, apply() { perks.cdr *= 1.12; } },
  { name: 'Adrenaline', desc: '+8% movement speed.', ok: () => perks.spd < 1.3, apply() { perks.spd *= 1.08; } },
  { name: 'Field Medic', desc: 'Enemies drop hearts more often.', ok: () => perks.drop < 0.3, apply() { perks.drop += 0.1; } },
  { name: 'Team Spirit', desc: 'The team ultimate charges 30% faster, and every chapter starts half charged.', ok: () => team === 'xmen' && perks.tstart < 50, apply() { perks.tg *= 1.3; perks.tstart = 50; } }
];
