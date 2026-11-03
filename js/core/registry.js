// ---------------------------------------------------------------------------
// Registries. Content plugs into the engine by registering itself here, so
// adding a hero, enemy, location or campaign never means editing engine files.
//   heroes      js/heroes/*.js      registerHero({...})       docs/ADDING_A_HERO.md
//   teams       js/teams/*.js       registerTeam({...})
//   enemies     js/enemies/*.js     registerEnemy(id, {...})
//   locations   js/world/*.js       registerLocation(id, {...})
//   campaigns   js/campaigns/*.js   registerCampaign({...})   docs/ADDING_A_CAMPAIGN.md
// ---------------------------------------------------------------------------
const HEROES = {};
const CHARS = {};        // hero id -> customiser data (filled from hero.look)
const TEAMS = {};
const LOCS = {};
const ETYPES = {};
const CAMPAIGNS = {};
const FORCED = [];       // movement states that briefly take control of the player (dashes, leaps, grapples...)
const PLAYER_INIT = [];  // extra player fields shared by several heroes (see shared/movement.js)
const CD_INIT = [];      // extra cooldown keys shared by several heroes

function registerHero(def) {
  if (HEROES[def.id]) throw new Error('Duplicate hero id: ' + def.id);
  HEROES[def.id] = def; CHARS[def.id] = def.look;
}
const heroes = () => Object.values(HEROES).sort((a, b) => (a.order || 99) - (b.order || 99));
const heroesOfTeam = id => heroes().filter(h => h.team === id);
const hero = () => HEROES[look.char];                       // the hero being played

function registerTeam(def) {
  if (TEAMS[def.id]) throw new Error('Duplicate team id: ' + def.id);
  TEAMS[def.id] = def;
}
function registerLocation(id, def) {
  if (LOCS[id]) throw new Error('Duplicate location id: ' + id);
  LOCS[id] = def;
}
function registerEnemy(id, def) {
  if (ETYPES[id]) throw new Error('Duplicate enemy type: ' + id);
  ETYPES[id] = def;
}
function registerCampaign(def) {
  if (CAMPAIGNS[def.id]) throw new Error('Duplicate campaign id: ' + def.id);
  CAMPAIGNS[def.id] = def;
}
function registerForcedState(priority, test, run) {
  FORCED.push({ priority, test, run });
  FORCED.sort((a, b) => a.priority - b.priority);
}
function runForcedStates(dt) {                               // returns true if a state took over movement this frame
  for (const f of FORCED) if (f.test()) { f.run(dt); return true; }
  return false;
}
