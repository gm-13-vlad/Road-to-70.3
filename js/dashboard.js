import { formatTime, formatDistance, getPowerZone } from './utils.js';

export class Dashboard {
  constructor(ftp = 200) {
    this._ftp = ftp;
    this._mode = 'route';
    this._els = {
      power: document.getElementById('metric-power'),
      speed: document.getElementById('metric-speed'),
      cadence: document.getElementById('metric-cadence'),
      hr: document.getElementById('metric-hr'),
      distance: document.getElementById('metric-distance'),
      elapsed: document.getElementById('metric-elapsed'),
      elevGain: document.getElementById('metric-elevation-gain'),
      elevLabel: document.getElementById('metric-elevation-label'),
      elevUnit: document.getElementById('metric-elevation-unit'),
      avgPower: document.getElementById('metric-avg-power'),
      powerZoneBar: document.getElementById('power-zone-bar'),
      gradientValue: document.getElementById('gradient-value'),
      altitudeValue: document.getElementById('altitude-value'),
      targetValue: document.getElementById('target-value'),
      workoutStep: document.getElementById('workout-step-value'),
    };
    this._lastUpdate = 0;
    this._smoothPower = 0;
    this._smoothCadence = 0;
    this._smoothSpeed = 0;
  }

  set ftp(val) { this._ftp = val; }

  setMode(mode) {
    this._mode = mode;
    if (mode === 'workout') {
      this._els.elevLabel.textContent = 'INTERVAL LEFT';
      this._els.elevUnit.innerHTML = '&nbsp;';
    } else {
      this._els.elevLabel.textContent = 'ELEV. GAIN';
      this._els.elevUnit.textContent = 'm';
    }
  }

  update(data) {
    const now = performance.now();
    if (now - this._lastUpdate < 250) return;
    this._lastUpdate = now;

    const smoothing = 0.3;
    this._smoothPower += (data.power - this._smoothPower) * smoothing;
    this._smoothCadence += (data.cadence - this._smoothCadence) * smoothing;
    this._smoothSpeed += (data.speed - this._smoothSpeed) * smoothing;

    const power = Math.round(this._smoothPower);
    const cadence = Math.round(this._smoothCadence);

    this._els.power.textContent = power;
    this._els.speed.textContent = this._smoothSpeed.toFixed(1);
    this._els.cadence.textContent = cadence;
    this._els.hr.textContent = data.heartRate > 0 ? data.heartRate : '--';
    this._els.distance.textContent = formatDistance(data.distance);
    this._els.elapsed.textContent = formatTime(data.elapsedTime);
    this._els.avgPower.textContent = data.avgPower;

    const zone = getPowerZone(power, this._ftp);
    this._els.powerZoneBar.style.backgroundColor = zone.color;
    this._els.power.style.color = zone.color;

    if (this._mode === 'workout') {
      this._els.elevGain.textContent = formatTime(data.intervalRemaining || 0);
      this._els.targetValue.textContent = data.freeRide ? 'FREE' : Math.round(data.targetWatts || 0);
      this._els.workoutStep.textContent =
        `STEP ${data.stepIndex} / ${data.stepCount}`;
    } else {
      this._els.elevGain.textContent = Math.round(data.elevationGain);

      const grad = data.gradient;
      const gradEl = this._els.gradientValue;
      gradEl.textContent = (grad >= 0 ? '+' : '') + grad.toFixed(1) + '%';
      gradEl.className = 'gradient-value ' +
        (grad > 0.5 ? 'uphill' : grad < -0.5 ? 'downhill' : 'flat');

      this._els.altitudeValue.textContent = Math.round(data.elevation) + 'm';
    }
  }

  resetSmoothing() {
    this._smoothPower = 0;
    this._smoothCadence = 0;
    this._smoothSpeed = 0;
    this._lastUpdate = 0;
  }
}
