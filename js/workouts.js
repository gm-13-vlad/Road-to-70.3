export const workouts = [
  {
    id: 'recovery-spin',
    name: 'Recovery Spin',
    focus: 'Recovery',
    description: '30 min of easy spinning to flush the legs between hard sessions.',
    intervals: [
      { t: 'ramp', d: 300, p: 0.40, p2: 0.55 },
      { t: 'steady', d: 1200, p: 0.55 },
      { t: 'ramp', d: 300, p: 0.55, p2: 0.40 },
    ],
  },
  {
    id: 'endurance-z2',
    name: 'Endurance Z2',
    focus: 'Aerobic base',
    description: '75 min steady zone 2 — the bread and butter of 70.3 base training.',
    intervals: [
      { t: 'ramp', d: 600, p: 0.45, p2: 0.65 },
      { t: 'steady', d: 1800, p: 0.68 },
      { t: 'steady', d: 300, p: 0.60 },
      { t: 'steady', d: 1800, p: 0.70 },
      { t: 'ramp', d: 300, p: 0.60, p2: 0.45 },
    ],
  },
  {
    id: 'sweet-spot',
    name: 'Sweet Spot 3x12',
    focus: 'Sustained power',
    description: '3 x 12 min at 90% FTP. The highest return-per-minute session for long course.',
    intervals: [
      { t: 'ramp', d: 600, p: 0.45, p2: 0.70 },
      { t: 'steady', d: 720, p: 0.90 },
      { t: 'steady', d: 300, p: 0.55 },
      { t: 'steady', d: 720, p: 0.90 },
      { t: 'steady', d: 300, p: 0.55 },
      { t: 'steady', d: 720, p: 0.90 },
      { t: 'ramp', d: 480, p: 0.55, p2: 0.40 },
    ],
  },
  {
    id: 'threshold-2x20',
    name: 'Threshold 2x20',
    focus: 'FTP',
    description: 'The benchmark session: 2 x 20 min right at threshold.',
    intervals: [
      { t: 'ramp', d: 600, p: 0.45, p2: 0.75 },
      { t: 'steady', d: 120, p: 0.55 },
      { t: 'steady', d: 1200, p: 1.00 },
      { t: 'steady', d: 600, p: 0.55 },
      { t: 'steady', d: 1200, p: 1.00 },
      { t: 'ramp', d: 600, p: 0.55, p2: 0.40 },
    ],
  },
  {
    id: 'over-unders',
    name: 'Over-Unders',
    focus: 'Lactate clearance',
    description: '3 x 9 min alternating 2 min at 95% with 1 min at 105%. Teaches you to ride through surges.',
    intervals: [
      { t: 'ramp', d: 600, p: 0.45, p2: 0.70 },
      { t: 'steady', d: 120, p: 0.95 }, { t: 'steady', d: 60, p: 1.05 },
      { t: 'steady', d: 120, p: 0.95 }, { t: 'steady', d: 60, p: 1.05 },
      { t: 'steady', d: 120, p: 0.95 }, { t: 'steady', d: 60, p: 1.05 },
      { t: 'steady', d: 300, p: 0.50 },
      { t: 'steady', d: 120, p: 0.95 }, { t: 'steady', d: 60, p: 1.05 },
      { t: 'steady', d: 120, p: 0.95 }, { t: 'steady', d: 60, p: 1.05 },
      { t: 'steady', d: 120, p: 0.95 }, { t: 'steady', d: 60, p: 1.05 },
      { t: 'steady', d: 300, p: 0.50 },
      { t: 'steady', d: 120, p: 0.95 }, { t: 'steady', d: 60, p: 1.05 },
      { t: 'steady', d: 120, p: 0.95 }, { t: 'steady', d: 60, p: 1.05 },
      { t: 'steady', d: 120, p: 0.95 }, { t: 'steady', d: 60, p: 1.05 },
      { t: 'ramp', d: 480, p: 0.50, p2: 0.40 },
    ],
  },
  {
    id: 'vo2-5x3',
    name: 'VO2max 5x3',
    focus: 'Top end',
    description: '5 x 3 min at 115% FTP with equal recovery. Raises the ceiling above threshold.',
    intervals: [
      { t: 'ramp', d: 600, p: 0.45, p2: 0.75 },
      { t: 'steady', d: 60, p: 1.00 },
      { t: 'steady', d: 180, p: 0.50 },
      { t: 'steady', d: 180, p: 1.15 }, { t: 'steady', d: 180, p: 0.50 },
      { t: 'steady', d: 180, p: 1.15 }, { t: 'steady', d: 180, p: 0.50 },
      { t: 'steady', d: 180, p: 1.15 }, { t: 'steady', d: 180, p: 0.50 },
      { t: 'steady', d: 180, p: 1.15 }, { t: 'steady', d: 180, p: 0.50 },
      { t: 'steady', d: 180, p: 1.15 },
      { t: 'ramp', d: 480, p: 0.50, p2: 0.40 },
    ],
  },
  {
    id: 'race-sim-703',
    name: '70.3 Race Simulation',
    focus: 'Race specificity',
    description: '2 hours at race intensity (~78% FTP) with hill surges — then practice running off it.',
    intervals: [
      { t: 'ramp', d: 600, p: 0.45, p2: 0.70 },
      { t: 'steady', d: 1500, p: 0.78 },
      { t: 'steady', d: 120, p: 0.95 },
      { t: 'steady', d: 1500, p: 0.78 },
      { t: 'steady', d: 120, p: 0.95 },
      { t: 'steady', d: 1500, p: 0.78 },
      { t: 'steady', d: 120, p: 0.95 },
      { t: 'steady', d: 1200, p: 0.80 },
      { t: 'ramp', d: 540, p: 0.60, p2: 0.45 },
    ],
  },
  {
    id: 'ftp-test',
    name: 'FTP Test (20 min)',
    focus: 'Testing',
    description: 'Ramp, 5 min blowout, rest, then an all-out 20 min. Take 95% of the 20 min average as your new FTP.',
    intervals: [
      { t: 'ramp', d: 600, p: 0.45, p2: 0.75 },
      { t: 'steady', d: 120, p: 0.55 },
      { t: 'free', d: 300, p: 1.10 },
      { t: 'steady', d: 600, p: 0.50 },
      { t: 'free', d: 1200, p: 1.00 },
      { t: 'ramp', d: 600, p: 0.50, p2: 0.40 },
    ],
  },
];

export function workoutDuration(workout) {
  return workout.intervals.reduce((sum, iv) => sum + iv.d, 0);
}

export function workoutPeakPct(workout) {
  let peak = 0;
  for (const iv of workout.intervals) {
    peak = Math.max(peak, iv.p || 0, iv.p2 || 0);
  }
  return peak;
}

export class WorkoutPlayer {
  constructor() {
    this._workout = null;
    this._elapsed = 0;
    this._starts = [];
    this._total = 0;
  }

  load(workout) {
    this._workout = workout;
    this._elapsed = 0;
    this._starts = [];
    let acc = 0;
    for (const iv of workout.intervals) {
      this._starts.push(acc);
      acc += iv.d;
    }
    this._total = acc;
  }

  get workout() { return this._workout; }
  get elapsed() { return this._elapsed; }
  get total() { return this._total; }
  get remaining() { return Math.max(0, this._total - this._elapsed); }
  get isComplete() { return this._workout !== null && this._elapsed >= this._total; }
  get progress() { return this._total > 0 ? Math.min(1, this._elapsed / this._total) : 0; }

  update(deltaSec) {
    if (!this._workout) return;
    this._elapsed = Math.min(this._total, this._elapsed + deltaSec);
  }

  get index() {
    if (!this._workout) return -1;
    for (let i = this._starts.length - 1; i >= 0; i--) {
      if (this._elapsed >= this._starts[i]) return i;
    }
    return 0;
  }

  get interval() {
    const i = this.index;
    return i >= 0 ? this._workout.intervals[i] : null;
  }

  get intervalRemaining() {
    const i = this.index;
    if (i < 0) return 0;
    const end = this._starts[i] + this._workout.intervals[i].d;
    return Math.max(0, end - this._elapsed);
  }

  get targetPct() {
    const iv = this.interval;
    if (!iv) return 0;
    if (iv.t === 'free') return 0;
    if (iv.t === 'ramp') {
      const i = this.index;
      const into = this._elapsed - this._starts[i];
      const frac = iv.d > 0 ? Math.min(1, into / iv.d) : 1;
      return iv.p + (iv.p2 - iv.p) * frac;
    }
    return iv.p;
  }

  targetWatts(ftp) {
    return Math.round(this.targetPct * ftp);
  }

  get isFreeRide() {
    const iv = this.interval;
    return iv ? iv.t === 'free' : false;
  }
}
