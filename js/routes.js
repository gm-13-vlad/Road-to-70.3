function generatePoints(segments) {
  const points = [];
  let dist = 0;
  let elev = segments[0].elevation;
  points.push({ distance: 0, elevation: elev });

  for (const seg of segments) {
    const steps = Math.max(1, Math.round(seg.length / 200));
    const stepDist = seg.length / steps;
    const stepElev = (seg.elevation - elev) / steps;
    for (let i = 0; i < steps; i++) {
      dist += stepDist;
      elev += stepElev;
      points.push({ distance: Math.round(dist), elevation: Math.round(elev * 10) / 10 });
    }
    elev = seg.elevation;
  }
  return points;
}

export const routes = [
  {
    id: 'flat-recovery',
    name: 'Flat Recovery Spin',
    difficulty: 'easy',
    description: '15 km easy ride with gentle undulations. Perfect for recovery days.',
    totalDistance: 15000,
    points: generatePoints([
      { length: 0, elevation: 50 },
      { length: 2000, elevation: 55 },
      { length: 3000, elevation: 60 },
      { length: 2000, elevation: 52 },
      { length: 2000, elevation: 58 },
      { length: 1500, elevation: 50 },
      { length: 1500, elevation: 56 },
      { length: 1000, elevation: 48 },
      { length: 1000, elevation: 54 },
      { length: 1000, elevation: 50 },
    ]),
  },
  {
    id: 'rolling-hills',
    name: 'Rolling Countryside',
    difficulty: 'moderate',
    description: '25 km through rolling terrain with 3-5% gradients. Solid endurance builder.',
    totalDistance: 25000,
    points: generatePoints([
      { length: 0, elevation: 100 },
      { length: 2000, elevation: 100 },
      { length: 1500, elevation: 160 },
      { length: 1000, elevation: 120 },
      { length: 2000, elevation: 200 },
      { length: 1500, elevation: 140 },
      { length: 1000, elevation: 100 },
      { length: 2000, elevation: 180 },
      { length: 1500, elevation: 130 },
      { length: 2000, elevation: 220 },
      { length: 1500, elevation: 160 },
      { length: 1500, elevation: 100 },
      { length: 2000, elevation: 190 },
      { length: 1500, elevation: 120 },
      { length: 2500, elevation: 100 },
    ]),
  },
  {
    id: 'sprint-intervals',
    name: 'Sprint Intervals',
    difficulty: 'moderate',
    description: '20 km with punchy 6-8% hills for interval training.',
    totalDistance: 20000,
    points: generatePoints([
      { length: 0, elevation: 80 },
      { length: 2000, elevation: 80 },
      { length: 400, elevation: 112 },
      { length: 600, elevation: 90 },
      { length: 2000, elevation: 85 },
      { length: 300, elevation: 109 },
      { length: 500, elevation: 85 },
      { length: 1500, elevation: 80 },
      { length: 500, elevation: 120 },
      { length: 700, elevation: 88 },
      { length: 2000, elevation: 82 },
      { length: 400, elevation: 114 },
      { length: 600, elevation: 86 },
      { length: 1500, elevation: 80 },
      { length: 350, elevation: 108 },
      { length: 650, elevation: 82 },
      { length: 2000, elevation: 78 },
      { length: 500, elevation: 118 },
      { length: 1000, elevation: 85 },
      { length: 2500, elevation: 80 },
    ]),
  },
  {
    id: 'mountain-pass',
    name: 'Mountain Pass',
    difficulty: 'hard',
    description: '30 km featuring a sustained 8 km climb averaging 5.5%, then a thrilling descent.',
    totalDistance: 30000,
    points: generatePoints([
      { length: 0, elevation: 200 },
      { length: 3000, elevation: 210 },
      { length: 2000, elevation: 250 },
      { length: 2000, elevation: 320 },
      { length: 2000, elevation: 400 },
      { length: 2000, elevation: 490 },
      { length: 2000, elevation: 560 },
      { length: 2000, elevation: 620 },
      { length: 2000, elevation: 650 },
      { length: 1000, elevation: 660 },
      { length: 2000, elevation: 580 },
      { length: 2000, elevation: 460 },
      { length: 2000, elevation: 340 },
      { length: 2000, elevation: 260 },
      { length: 2000, elevation: 220 },
      { length: 2000, elevation: 200 },
    ]),
  },
  {
    id: 'half-ironman',
    name: 'Half Ironman 70.3',
    difficulty: 'brutal',
    description: '90 km — the full 70.3 bike leg. Rolling hills, a big climb, and flat TT sections.',
    totalDistance: 90000,
    points: generatePoints([
      { length: 0, elevation: 100 },
      { length: 5000, elevation: 100 },
      { length: 3000, elevation: 140 },
      { length: 2000, elevation: 110 },
      { length: 5000, elevation: 105 },
      { length: 3000, elevation: 170 },
      { length: 2000, elevation: 130 },
      { length: 4000, elevation: 120 },
      { length: 3000, elevation: 200 },
      { length: 2000, elevation: 150 },
      { length: 5000, elevation: 140 },
      { length: 2000, elevation: 180 },
      { length: 3000, elevation: 280 },
      { length: 3000, elevation: 380 },
      { length: 2000, elevation: 440 },
      { length: 1000, elevation: 450 },
      { length: 2000, elevation: 380 },
      { length: 3000, elevation: 260 },
      { length: 2000, elevation: 180 },
      { length: 3000, elevation: 150 },
      { length: 5000, elevation: 140 },
      { length: 4000, elevation: 130 },
      { length: 3000, elevation: 160 },
      { length: 2000, elevation: 120 },
      { length: 5000, elevation: 110 },
      { length: 3000, elevation: 140 },
      { length: 2000, elevation: 100 },
      { length: 7000, elevation: 100 },
    ]),
  },
];
