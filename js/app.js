import { TrainerConnection } from './bluetooth.js';
import { routes } from './routes.js';
import { RouteSimulation } from './simulation.js';
import { TerrainRenderer } from './terrain.js';
import { Dashboard } from './dashboard.js';
import { formatTime, formatDistance } from './utils.js';

class App {
  constructor() {
    this._trainer = new TrainerConnection();
    this._simulation = new RouteSimulation();
    this._terrain = null;
    this._dashboard = null;
    this._selectedRoute = null;
    this._manualMode = false;
    this._lastFrameTime = 0;
    this._animFrameId = null;
    this._latestTrainerData = { power: 0, cadence: 0, speed: 0, heartRate: 0 };
    this._manualSpeed = 0;
    this._paused = false;

    this._loadSettings();
    this._initUI();
    this._bindEvents();
    this._renderRouteList();
  }

  _loadSettings() {
    try {
      this._riderWeight = parseFloat(localStorage.getItem('riderWeight')) || 75;
      this._bikeWeight = parseFloat(localStorage.getItem('bikeWeight')) || 10;
      this._ftp = parseInt(localStorage.getItem('ftp')) || 200;
    } catch {
      this._riderWeight = 75;
      this._bikeWeight = 10;
      this._ftp = 200;
    }
  }

  _saveSettings() {
    try {
      localStorage.setItem('riderWeight', this._riderWeight);
      localStorage.setItem('bikeWeight', this._bikeWeight);
      localStorage.setItem('ftp', this._ftp);
    } catch {
      // localStorage not available
    }
  }

  _initUI() {
    document.getElementById('rider-weight').value = this._riderWeight;
    document.getElementById('bike-weight').value = this._bikeWeight;
    document.getElementById('ftp-input').value = this._ftp;
  }

  _bindEvents() {
    document.getElementById('btn-connect-trainer').addEventListener('click', () => this._connectTrainer());
    document.getElementById('btn-connect-hr').addEventListener('click', () => this._connectHR());
    document.getElementById('btn-start-ride').addEventListener('click', () => this._startRide(false));
    document.getElementById('btn-start-manual').addEventListener('click', () => this._startRide(true));
    document.getElementById('btn-pause').addEventListener('click', () => this._togglePause());
    document.getElementById('btn-end-ride').addEventListener('click', () => this._endRide());
    document.getElementById('btn-new-ride').addEventListener('click', () => this._newRide());

    document.getElementById('rider-weight').addEventListener('change', (e) => {
      this._riderWeight = parseFloat(e.target.value) || 75;
      this._saveSettings();
    });

    document.getElementById('bike-weight').addEventListener('change', (e) => {
      this._bikeWeight = parseFloat(e.target.value) || 10;
      this._saveSettings();
    });

    document.getElementById('ftp-input').addEventListener('change', (e) => {
      this._ftp = parseInt(e.target.value) || 200;
      this._saveSettings();
      if (this._dashboard) this._dashboard.ftp = this._ftp;
    });

    document.getElementById('resistance-slider').addEventListener('input', (e) => {
      const val = parseInt(e.target.value);
      document.getElementById('resistance-value').textContent = val + '%';
      if (this._manualMode && this._trainer.connected) {
        this._trainer.setResistanceLevel(val);
      }
    });

    this._trainer.onData((data) => {
      this._latestTrainerData = data;
    });

    this._trainer.onStatus((status) => {
      this._updateConnectionStatus(status);
    });
  }

  _renderRouteList() {
    const container = document.getElementById('route-list');
    container.innerHTML = '';

    for (const route of routes) {
      const card = document.createElement('div');
      card.className = 'route-card';
      card.dataset.routeId = route.id;

      const elevGain = this._calcElevGain(route);

      card.innerHTML = `
        <div class="route-name">${route.name}</div>
        <div class="route-info">
          <span>${(route.totalDistance / 1000).toFixed(0)} km</span>
          <span>${elevGain} m elev</span>
        </div>
        <div class="route-difficulty difficulty-${route.difficulty}">${route.difficulty}</div>
        <div class="route-preview"><canvas></canvas></div>
      `;

      card.addEventListener('click', () => this._selectRoute(route, card));
      container.appendChild(card);

      requestAnimationFrame(() => {
        const canvas = card.querySelector('canvas');
        if (canvas) this._drawMiniProfile(canvas, route);
      });
    }
  }

  _calcElevGain(route) {
    let gain = 0;
    for (let i = 1; i < route.points.length; i++) {
      const diff = route.points[i].elevation - route.points[i - 1].elevation;
      if (diff > 0) gain += diff;
    }
    return Math.round(gain);
  }

  _drawMiniProfile(canvas, route) {
    const parent = canvas.parentElement;
    if (!parent) return;
    const w = parent.clientWidth;
    const h = parent.clientHeight;
    if (w === 0 || h === 0) return;
    canvas.width = w * 2;
    canvas.height = h * 2;
    const ctx = canvas.getContext('2d');
    ctx.setTransform(2, 0, 0, 2, 0, 0);

    const points = route.points;
    let minE = Infinity, maxE = -Infinity;
    for (const p of points) {
      if (p.elevation < minE) minE = p.elevation;
      if (p.elevation > maxE) maxE = p.elevation;
    }
    const range = maxE - minE || 20;
    minE -= range * 0.1;
    const totalRange = (maxE - minE) + range * 0.2;

    ctx.beginPath();
    ctx.moveTo(0, h);
    for (const p of points) {
      const x = (p.distance / route.totalDistance) * w;
      const y = h - ((p.elevation - minE) / totalRange) * h;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(w, h);
    ctx.closePath();

    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, 'rgba(6, 182, 212, 0.5)');
    grad.addColorStop(1, 'rgba(6, 182, 212, 0.1)');
    ctx.fillStyle = grad;
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(0, h - ((points[0].elevation - minE) / totalRange) * h);
    for (const p of points) {
      ctx.lineTo((p.distance / route.totalDistance) * w, h - ((p.elevation - minE) / totalRange) * h);
    }
    ctx.strokeStyle = 'rgba(6, 182, 212, 0.7)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  _selectRoute(route, card) {
    document.querySelectorAll('.route-card').forEach(c => c.classList.remove('selected'));
    card.classList.add('selected');
    this._selectedRoute = route;
    document.getElementById('btn-start-ride').disabled = false;
  }

  async _connectTrainer() {
    const btn = document.getElementById('btn-connect-trainer');
    btn.disabled = true;
    btn.textContent = 'Connecting...';

    const ok = await this._trainer.connectTrainer();

    btn.disabled = false;
    btn.textContent = ok
      ? `Connected: ${this._trainer._device?.name || 'Trainer'}`
      : 'Connect Trainer (Bluetooth)';
  }

  async _connectHR() {
    await this._trainer.connectHRMonitor();
  }

  _updateConnectionStatus(status) {
    const trainerEl = document.querySelector('#trainer-status span');
    const hrEl = document.querySelector('#hr-status span');

    if (status.state === 'connected') {
      trainerEl.textContent = status.message;
      trainerEl.className = 'status-connected';
    } else if (status.state === 'connecting') {
      trainerEl.textContent = status.message;
      trainerEl.className = 'status-connecting';
    } else if (status.state === 'disconnected' || status.state === 'error') {
      trainerEl.textContent = status.message;
      trainerEl.className = 'status-disconnected';
    } else if (status.state === 'hr_connected') {
      hrEl.textContent = status.message;
      hrEl.className = 'status-connected';
    } else if (status.state === 'hr_disconnected') {
      hrEl.textContent = 'Disconnected';
      hrEl.className = 'status-disconnected';
    }
  }

  _startRide(manual) {
    if (!this._selectedRoute) return;

    this._manualMode = manual;
    this._paused = false;

    this._simulation.loadRoute(this._selectedRoute);
    this._simulation.start();

    this._showScreen('ride-screen');

    this._terrain = new TerrainRenderer(document.getElementById('terrain-canvas'));
    this._terrain.setRoute(this._selectedRoute);

    this._dashboard = new Dashboard(this._ftp);
    this._dashboard.resetSmoothing();

    document.getElementById('btn-pause').textContent = 'Pause';

    if (manual) {
      this._manualSpeed = 25;
    }

    this._lastFrameTime = performance.now();
    this._loop();
  }

  _loop() {
    this._animFrameId = requestAnimationFrame((timestamp) => {
      const delta = (timestamp - this._lastFrameTime) / 1000;
      this._lastFrameTime = timestamp;

      if (delta > 1) {
        this._loop();
        return;
      }

      if (!this._paused && this._simulation.state === 'running') {
        const speed = this._manualMode ? this._manualSpeed : this._latestTrainerData.speed;
        const power = this._manualMode ? this._estimateManualPower() : this._latestTrainerData.power;
        const cadence = this._manualMode ? this._estimateManualCadence() : this._latestTrainerData.cadence;
        const hr = this._latestTrainerData.heartRate;

        this._simulation.update(speed, delta, power, cadence, hr);

        const gradient = this._simulation.currentGradient;

        if (this._trainer.connected && !this._manualMode) {
          this._trainer.setSimulationParameters(gradient);
        }

        if (this._manualMode) {
          this._manualSpeed = Math.max(5, 25 - gradient * 1.5);
        }

        this._dashboard.update({
          power,
          speed,
          cadence,
          heartRate: hr,
          distance: this._simulation.currentDistance,
          elapsedTime: this._simulation.elapsedTime,
          elevationGain: this._simulation.elevationGain,
          avgPower: this._simulation.avgPower,
          gradient,
          elevation: this._simulation.currentElevation,
        });

        this._terrain.render(this._simulation.progress);
      }

      if (this._simulation.isComplete) {
        this._showSummary();
        return;
      }

      this._loop();
    });
  }

  _estimateManualPower() {
    const gradient = this._simulation.currentGradient;
    const speed = this._manualSpeed;
    const totalMass = this._riderWeight + this._bikeWeight;
    const g = 9.81;
    const crr = 0.004;
    const cda = 0.4;
    const rho = 1.225;
    const v = speed / 3.6;

    const fGravity = totalMass * g * Math.sin(Math.atan(gradient / 100));
    const fRolling = crr * totalMass * g * Math.cos(Math.atan(gradient / 100));
    const fAero = 0.5 * cda * rho * v * v;

    return Math.max(0, Math.round((fGravity + fRolling + fAero) * v));
  }

  _estimateManualCadence() {
    return Math.round(80 + Math.random() * 10);
  }

  _togglePause() {
    if (this._paused) {
      this._paused = false;
      this._simulation.resume();
      document.getElementById('btn-pause').textContent = 'Pause';
      this._lastFrameTime = performance.now();
    } else {
      this._paused = true;
      this._simulation.pause();
      document.getElementById('btn-pause').textContent = 'Resume';
    }
  }

  _endRide() {
    if (this._animFrameId) {
      cancelAnimationFrame(this._animFrameId);
      this._animFrameId = null;
    }
    this._showSummary();
  }

  _showSummary() {
    if (this._animFrameId) {
      cancelAnimationFrame(this._animFrameId);
      this._animFrameId = null;
    }

    const sim = this._simulation;
    const dist = sim.currentDistance;
    const time = sim.elapsedTime;
    const avgSpeed = time > 0 ? ((dist / 1000) / (time / 3600)).toFixed(1) : '0.0';

    document.getElementById('summary-distance').textContent = formatDistance(dist) + ' km';
    document.getElementById('summary-duration').textContent = formatTime(time);
    document.getElementById('summary-avg-speed').textContent = avgSpeed + ' km/h';
    document.getElementById('summary-avg-power').textContent = sim.avgPower + ' W';
    document.getElementById('summary-max-power').textContent = sim.maxPower + ' W';
    document.getElementById('summary-avg-cadence').textContent = sim.avgCadence + ' rpm';
    document.getElementById('summary-avg-hr').textContent = sim.avgHR > 0 ? sim.avgHR + ' bpm' : '-- bpm';
    document.getElementById('summary-elevation').textContent = Math.round(sim.elevationGain) + ' m';
    document.getElementById('summary-calories').textContent = sim.calories + ' kcal';

    this._showScreen('summary-screen');
    requestAnimationFrame(() => this._renderSummaryChart());
  }

  _renderSummaryChart() {
    const canvas = document.getElementById('summary-chart');
    const ctx = canvas.getContext('2d');
    const parent = canvas.parentElement;
    if (!parent) return;
    const rect = parent.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = 200 * dpr;
    canvas.style.width = rect.width + 'px';
    canvas.style.height = '200px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const w = rect.width;
    const h = 200;

    if (!this._selectedRoute) return;

    const route = this._selectedRoute;
    const points = route.points;
    let minE = Infinity, maxE = -Infinity;
    for (const p of points) {
      if (p.elevation < minE) minE = p.elevation;
      if (p.elevation > maxE) maxE = p.elevation;
    }
    const range = maxE - minE || 20;
    minE -= range * 0.1;
    maxE += range * 0.1;
    const totalDist = route.totalDistance;

    const margin = { top: 20, bottom: 30, left: 40, right: 10 };
    const plotW = w - margin.left - margin.right;
    const plotH = h - margin.top - margin.bottom;

    const toX = (d) => margin.left + (d / totalDist) * plotW;
    const toY = (e) => margin.top + plotH - ((e - minE) / (maxE - minE + range * 0.2)) * plotH;

    ctx.fillStyle = '#1a2236';
    ctx.fillRect(0, 0, w, h);

    ctx.beginPath();
    ctx.moveTo(toX(0), toY(points[0].elevation));
    for (const p of points) {
      ctx.lineTo(toX(p.distance), toY(p.elevation));
    }
    ctx.lineTo(toX(totalDist), h - margin.bottom);
    ctx.lineTo(margin.left, h - margin.bottom);
    ctx.closePath();

    const grad = ctx.createLinearGradient(0, margin.top, 0, h - margin.bottom);
    grad.addColorStop(0, 'rgba(255, 107, 53, 0.4)');
    grad.addColorStop(1, 'rgba(255, 107, 53, 0.05)');
    ctx.fillStyle = grad;
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(toX(0), toY(points[0].elevation));
    for (const p of points) {
      ctx.lineTo(toX(p.distance), toY(p.elevation));
    }
    ctx.strokeStyle = '#ff6b35';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.font = '10px Inter, sans-serif';
    ctx.textAlign = 'center';

    let interval;
    if (totalDist <= 20000) interval = 5000;
    else if (totalDist <= 50000) interval = 10000;
    else interval = 20000;

    for (let d = 0; d <= totalDist; d += interval) {
      ctx.fillText(`${(d / 1000).toFixed(0)}km`, toX(d), h - 8);
    }

    ctx.textAlign = 'right';
    const elevSteps = 5;
    for (let i = 0; i <= elevSteps; i++) {
      const e = minE + ((maxE - minE + range * 0.2) / elevSteps) * i;
      ctx.fillText(`${Math.round(e)}m`, margin.left - 5, toY(e) + 3);
    }
  }

  _newRide() {
    this._simulation.reset();
    this._showScreen('connect-screen');
  }

  _showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(id).classList.add('active');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  new App();
});
