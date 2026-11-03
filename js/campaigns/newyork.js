// CAMPAIGN: Battle of New York. Four chapters against the Chitauri army.
// A campaign is { id, name, blurb, chapters: [{ title, loc, intro, outro, waves }] }.  waves = [[ [enemyType, count], ... ], ...]
// intro / outro are arrays of story lines, or { teamId: [lines] } to vary the text by team.
(function () {
  // The arenas for this campaign (flagged camp: true so Endless mode does not list them).
  registerLocation('stark', { name: 'Stark Tower Rooftop', camp: true, desc: '', f0: '#2d333d', f1: '#151922', wall: '#6b7586', slip: 0, hazard: false, ambient: 'debris',
    decor(cx, cy) {
    ctx.strokeStyle = 'rgba(255,210,90,0.35)'; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(cx, cy, 95, 0, 7); ctx.stroke();
    ctx.fillStyle = 'rgba(255,210,90,0.28)'; ctx.font = '700 90px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('H', cx, cy + 4);
    for (let i = 0; i < 10; i++) {
      ctx.fillStyle = (Math.floor(time * 2 + i) % 2) ? 'rgba(255,90,90,0.85)' : 'rgba(255,90,90,0.25)';
      ctx.fillRect(A.x + 44 + i * 88, A.y + 8, 6, 6); ctx.fillRect(A.x + 44 + i * 88, A.y + A.h - 14, 6, 6);
    }
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    for (const v of [[90, 110], [A.w - 190, 110], [90, A.h - 180], [A.w - 190, A.h - 180]]) ctx.fillRect(A.x + v[0], A.y + v[1], 100, 70);
    }
  });
  registerLocation('streets', { name: 'Park Avenue', camp: true, desc: '', f0: '#2f3138', f1: '#17181d', wall: '#7a6f5a', slip: 0, hazard: false, ambient: 'debris',
    decor(cx, cy) {
    ctx.strokeStyle = 'rgba(235,200,70,0.5)'; ctx.lineWidth = 4; ctx.setLineDash([34, 26]);
    ctx.beginPath(); ctx.moveTo(A.x, cy); ctx.lineTo(A.x + A.w, cy); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(235,235,235,0.16)';
    for (let i = 0; i < 9; i++) { ctx.fillRect(A.x + 70, A.y + 20 + i * 52, 90, 24); ctx.fillRect(A.x + A.w - 160, A.y + 20 + i * 52, 90, 24); }
    for (const c of [[300, 130, 0.2], [620, 330, -0.15], [470, 420, 0.5]]) {
      ctx.save(); ctx.translate(A.x + c[0], A.y + c[1]); ctx.rotate(c[2]);
      ctx.fillStyle = 'rgba(70,72,82,0.9)'; ctx.fillRect(-34, -16, 68, 32);
      ctx.fillStyle = 'rgba(130,160,180,0.45)'; ctx.fillRect(-18, -12, 36, 24); ctx.restore();
    }
    }
  });
  registerLocation('plaza', { name: 'Grand Central Plaza', camp: true, desc: '', f0: '#3a3a40', f1: '#1b1b20', wall: '#8a8478', slip: 0, hazard: false, ambient: 'debris',
    decor(cx, cy) {
    ctx.strokeStyle = 'rgba(255,255,255,0.05)'; ctx.lineWidth = 1; ctx.beginPath();
    for (let x = A.x; x <= A.x + A.w; x += 80) { ctx.moveTo(x, A.y); ctx.lineTo(x, A.y + A.h); }
    for (let y = A.y; y <= A.y + A.h; y += 80) { ctx.moveTo(A.x, y); ctx.lineTo(A.x + A.w, y); }
    ctx.stroke();
    ctx.fillStyle = 'rgba(60,80,110,0.5)'; ctx.strokeStyle = 'rgba(160,170,190,0.5)'; ctx.lineWidth = 6;
    ctx.beginPath(); ctx.arc(cx, cy, 72, 0, 7); ctx.fill(); ctx.stroke();
    ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(cx, cy, 38, 0, 7); ctx.stroke();
    ctx.fillStyle = 'rgba(90,86,80,0.8)';
    for (const r of [[220, 120], [700, 90], [250, 380], [720, 400]]) { ctx.beginPath(); ctx.moveTo(A.x + r[0], A.y + r[1]); ctx.lineTo(A.x + r[0] + 26, A.y + r[1] + 6); ctx.lineTo(A.x + r[0] + 14, A.y + r[1] + 24); ctx.lineTo(A.x + r[0] - 8, A.y + r[1] + 14); ctx.closePath(); ctx.fill(); }
    }
  });
  registerLocation('portal', { name: 'The Portal', camp: true, desc: '', f0: '#2b1d48', f1: '#0e0919', wall: '#6a5aa8', slip: 0, hazard: false, ambient: 'ember', ambCol: 'rgba(120,200,255,0.85)',
    decor(cx, cy) {
    const g = ctx.createRadialGradient(cx, cy, 10, cx, cy, 190);
    g.addColorStop(0, 'rgba(200,235,255,0.55)'); g.addColorStop(0.5, 'rgba(110,150,255,0.22)'); g.addColorStop(1, 'rgba(40,20,80,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, 190, 0, 7); ctx.fill();
    ctx.strokeStyle = 'rgba(160,220,255,0.5)'; ctx.lineWidth = 3;
    for (let i = 0; i < 3; i++) { const sp = time * (1 + i * 0.4) + i * 2; ctx.beginPath(); ctx.arc(cx, cy, 60 + i * 26, sp, sp + 2.2); ctx.stroke(); }
    }
  });

  const chapters = [
    { title: 'Chapter 1: The Portal', loc: 'stark',
      introScenes: ['tesseract', 'assemble', 'conflict', 'portal-opens'],          // scenes 1 to 4: the story up to the invasion
      intro: {
        avengers: ["Midtown Manhattan. A tear opens in the sky above Stark Tower.", "Loki's Tesseract is feeding the portal, and something is pouring out of it: the Chitauri. An army with no fear and no end.", "Nick Fury's channel crackles on. \"Hold the roof. Nobody gets to the streets.\""],
        xmen: ["Midtown Manhattan. A tear opens in the sky above Stark Tower, and an alien army begins to pour through.", "Xavier's voice settles in your head. \"This is not our fight by name. It is our fight by choice.\"", "The X-Men are not Earth's mightiest heroes. They have never needed to be, to show up."] },
      outro: ["The rooftop holds, but the portal keeps feeding the sky.", "The Chitauri are spilling down onto the avenues. The fight moves to the streets."],
      waves: [[['chit', 8]], [['chit', 10], ['gunner', 1]], [['chit', 8], ['gunner', 3]]] },
    { title: 'Chapter 2: Park Avenue', loc: 'streets',
      intro: ["Down on the avenue the Chitauri have the cars overturned and the crowds pinned against the shopfronts.", "Their gunners hold the corners while riders swoop between the buildings. Clear a lane and get the civilians out."],
      outroScenes: ['thor-stop-loki'],
      outro: ["A block of the avenue is clear, and then the pavement starts to shake.", "Something enormous is coming down the street."],
      waves: [[['chit', 10], ['gunner', 4]], [['rider', 5], ['chit', 8]], [['gunner', 5], ['rider', 4], ['chit', 8]]] },
    { title: 'Chapter 3: Leviathan', loc: 'plaza',
      intro: ["A Leviathan, a Chitauri war-beast the size of a building, tears through Grand Central Plaza.", "It will not stop for anything smaller than a miracle. Bring it down before it brings the block down."],
      outroScenes: ['iron-idea'],
      outro: ["The beast crashes through a storefront and does not get up.", "Above the tower, the portal is the only thing left, and it is still open."],
      waves: [[['chit', 10], ['rider', 4], ['gunner', 2]], [['gunner', 4], ['rider', 4], ['chit', 6]], [['leviathan', 1], ['chit', 6], ['gunner', 2]]] },
    { title: 'Chapter 4: Close the Portal', loc: 'portal',
      intro: ["Back on the tower. The Tesseract is the only thing holding the portal open.", "The Chitauri Warlord stands between you and it, with whatever is left of the army at his back."],
      outroScenes: ['sacrifice', 'victory', 'shawarma'],                          // scenes 5 to 7, ending on THE END.
      outro: {
        avengers: ["The Tesseract's light dies. The portal folds in on itself with the last of the army still inside.", "New York is quiet. Somebody, somewhere, is already asking about food."],
        xmen: ["The Tesseract's light dies. The portal folds in on itself with the last of the army still inside.", "New York is quiet. In your head, Xavier says only: \"Well done.\""] },
      waves: [[['chit', 12], ['gunner', 5]], [['rider', 7], ['gunner', 5], ['chit', 4]], [['warlord', 1], ['chit', 6], ['gunner', 2]]] }
  ];

  registerCampaign({
    id: 'newyork', name: 'Battle of New York',
    blurb: 'Four chapters against the Chitauri army, with story, bosses and upgrades between chapters.',
    chapters
  });
})();
