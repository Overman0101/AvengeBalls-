// Team ultimates. A team may define  ult: { name, label, cast() }  (see js/teams/).
// The meter (teamMeter) fills as enemies are defeated; press X when it is full.
function castTeamUlt() {
  const T = TEAMS[team];
  if (!T || !T.ult || teamMeter < 100) return;
  teamMeter = 0;
  T.ult.cast();
}
