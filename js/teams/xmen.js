// The X-Men. Team ultimate: Mutant Surge, a psychic wave that stuns and damages every enemy and heals a heart.
registerTeam({
  id: 'xmen', name: 'The X-Men',
  blurb: 'Mutants protecting a world that fears them. Team ultimate: Mutant Surge, a psychic wave that stuns and heals.',
  ult: {
    name: 'MUTANT SURGE', label: 'Surge',
    cast() {
      shocks.push({ x: player.x, y: player.y, r: 10, max: 900, visual: true, hit: new Set() });   // a psychic wave across the arena
      for (const e of enemies.slice()) { knock(e, 0, 0, 3); damage(e, 2); }
      killBoltsNear(player.x, player.y, 2000); healHeart();
      ring(player.x, player.y, 200, '#ff8ae6'); flash = 0.35; addShake(10); sfx.sense(); sfx.roar();
    }
  }
});
