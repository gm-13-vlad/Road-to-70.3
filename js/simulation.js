import { clamp, lerp } from './utils.js';

export class RouteSimulation {
  constructor() {
    this._route = null;
    this._state = 'idle'; // idle, running, paused, completed
    this._currentDistance = 0;
    this._elapsedTime = 0;
    this._elevationGain = 0;
    this._previousElevation = 0;
    this._currentElevation = 0;
    this._currentGradient = 0;
    this._smoothedGradient = 0;
    this._totalPower = 0;
    this._powerSamples = 0;
    this._maxPower = 0;
    this._totalCadence = 0;
    this._cadenceSamples = 0;
    this._totalHR = 0;
    this._hrSamples = 0;
    this._totalSpeed = 0;
    this._speedSamples = 0;
    this._calories = 0;
  }

  get state() { return this._state; }
  get currentDistance() { return this._currentDistance; }
  get elapsedTime() { return this._elapsedTime; }
  get elevationGain() { return this._elevationGain; }
  get currentElevation() { return this._currentElevation; }
  get currentGradient() { return this._smoothedGradient; }
  get progress() {
    if (!this._route) return 0;
    return clamp(this._currentDistance / this._route.totalDistance, 0, 1);
  }
  get isComplete() { return this._state === 'completed'; }
  get avgPower() { return this._powerSamples > 0 ? Math.round(this._totalPower / this._powerSamples) : 0; }
  get maxPower() { return this._maxPower; }
  get avgCadence() { return this._cadenceSamples > 0 ? Math.round(this._totalCadence / this._cadenceSamples) : 0; }
  get avgHR() { return this._hrSamples > 0 ? Math.round(this._totalHR / this._hrSamples) : 0; }
  get avgSpeed() { return this._speedSamples > 0 ? (this._totalSpeed / this._speedSamples).toFixed(1) : '0.0'; }
  get calories() { return Math.round(this._calories); }

  loadRoute(route) {
    this._route = route;
    this.reset();
  }

  reset() {
    this._state = 'idle';
    this._currentDistance = 0;
    this._elapsedTime = 0;
    this._elevationGain = 0;
    this._currentElevation = this._route ? this._getElevationAt(0) : 0;
    this._previousElevation = this._currentElevation;
    this._currentGradient = 0;
    this._smoothedGradient = 0;
    this._totalPower = 0;
    this._powerSamples = 0;
    this._maxPower = 0;
    this._totalCadence = 0;
    this._cadenceSamples = 0;
    this._totalHR = 0;
    this._hrSamples = 0;
    this._totalSpeed = 0;
    this._speedSamples = 0;
    this._calories = 0;
  }

  start() {
    if (this._state === 'idle' || this._state === 'completed') {
      this.reset();
    }
    this._state = 'running';
  }

  pause() {
    if (this._state === 'running') {
      this._state = 'paused';
    }
  }

  resume() {
    if (this._state === 'paused') {
      this._state = 'running';
    }
  }

  update(speedKmh, deltaTimeSec, power = 0, cadence = 0, heartRate = 0) {
    if (this._state !== 'running' || !this._route) return;

    this._elapsedTime += deltaTimeSec;
    const distIncrement = (speedKmh / 3.6) * deltaTimeSec;
    this._currentDistance += distIncrement;

    if (this._currentDistance >= this._route.totalDistance) {
      this._currentDistance = this._route.totalDistance;
      this._state = 'completed';
    }

    const newElevation = this._getElevationAt(this._currentDistance);
    const elevDiff = newElevation - this._previousElevation;
    if (elevDiff > 0) {
      this._elevationGain += elevDiff;
    }
    this._previousElevation = this._currentElevation;
    this._currentElevation = newElevation;

    this._currentGradient = this._getGradientAt(this._currentDistance);
    const smoothing = 0.15;
    this._smoothedGradient = this._smoothedGradient + (this._currentGradient - this._smoothedGradient) * smoothing;

    if (power > 0) {
      this._totalPower += power;
      this._powerSamples++;
      if (power > this._maxPower) this._maxPower = power;
      this._calories += (power * deltaTimeSec) / 4184 * 4;
    }

    if (cadence > 0) {
      this._totalCadence += cadence;
      this._cadenceSamples++;
    }

    if (heartRate > 0) {
      this._totalHR += heartRate;
      this._hrSamples++;
    }

    if (speedKmh > 0) {
      this._totalSpeed += speedKmh;
      this._speedSamples++;
    }
  }

  _getElevationAt(distance) {
    if (!this._route || this._route.points.length === 0) return 0;
    const points = this._route.points;

    if (distance <= 0) return points[0].elevation;
    if (distance >= points[points.length - 1].distance) return points[points.length - 1].elevation;

    for (let i = 0; i < points.length - 1; i++) {
      if (distance >= points[i].distance && distance <= points[i + 1].distance) {
        const t = (distance - points[i].distance) / (points[i + 1].distance - points[i].distance);
        return lerp(points[i].elevation, points[i + 1].elevation, t);
      }
    }
    return points[points.length - 1].elevation;
  }

  _getGradientAt(distance) {
    if (!this._route || this._route.points.length < 2) return 0;
    const points = this._route.points;

    if (distance <= 0) distance = 1;
    if (distance >= points[points.length - 1].distance) {
      distance = points[points.length - 1].distance - 1;
    }

    for (let i = 0; i < points.length - 1; i++) {
      if (distance >= points[i].distance && distance <= points[i + 1].distance) {
        const dDist = points[i + 1].distance - points[i].distance;
        if (dDist === 0) return 0;
        const dElev = points[i + 1].elevation - points[i].elevation;
        return clamp((dElev / dDist) * 100, -20, 20);
      }
    }
    return 0;
  }

  getElevationProfile() {
    if (!this._route) return [];
    return this._route.points;
  }
}
