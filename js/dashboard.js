import { formatTime, formatDistance, getPowerZone } from './utils.js';

export class Dashboard {
  constructor(ftp = 200) {
    this._ftp = ftp;
    this._els = {
      power: document.getElementById('metric-power'),
      speed: document.getElementById('metric-speed'),
      cadence: document.getElementById('metric-cadence'),
      hr: document.getElementById('metric-hr'),
      distance: document.getElementById('metric-distance'),
      elapsed: document.getElementById('metric-elapsed'),
      elevGain: document.getElementById('metric-elevation-gain'),
      avgPower: document.getElementById('metric-avg-power'),
      powerZoneBar: document.getElementById('power-zone-bar'),
      gradientValue: document.getElementById('gradient-value'),
      altitudeValue: document.getElementById('altitude-value'),
      resistanceValue: document.getElementById('resistance-value'),
    };
    this._lastUpdate = 0;
    this._smoothPower = 0;
    this._smoothCadence = 0;
    this._smoothSpeed = 0;
  }

  set ftp(val) { this._ftp = val; }

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
    const speed = this._smoothSpeed.toFixed(1);

    this._els.power.textContent = power;
    this._els.speed.textContent = speed;
    this._els.cadence.textContent = cadence;
    this._els.hr.textContent = data.heartRate > 0 ? data.heartRate : '--';
    this._els.distance.textContent = formatDistance(data.distance);
    this._els.elapsed.textContent = formatTime(data.elapsedTime);
    this._els.elevGain.textContent = Math.round(data.elevationGain);
    this._els.avgPower.textContent = data.avgPower;

    const zone = getPowerZone(power, this._ftp);
    this._els.powerZoneBar.style.backgroundColor = zone.color;
    this._els.power.style.color = zone.color;

    const grad = data.gradient;
    const gradEl = this._els.gradientValue;
    const gradStr = (grad >= 0 ? '+' : '') + grad.toFixed(1) + '%';
    gradEl.textContent = gradStr;
    gradEl.className = 'gradient-value ' +
      (grad > 0.5 ? 'uphill' : grad < -0.5 ? 'downhill' : 'flat');

    this._els.altitudeValue.textContent = Math.round(data.elevation) + 'm';
  }

  resetSmoothing() {
    this._smoothPower = 0;
    this._smoothCadence = 0;
    this._smoothSpeed = 0;
  }
}
