import { TrainerConnection, isIOS } from './bluetooth.js';
import { AntPlusConnection } from './antplus.js';
import { routes } from './routes.js';
import { workouts, workoutDuration, WorkoutPlayer } from './workouts.js';
import { RouteSimulation } from './simulation.js';
import { TerrainRenderer } from './terrain.js';
import { WorldRenderer } from './world.js';
import { WorkoutRenderer, renderWorkoutMini } from './workoutview.js';
import { Dashboard } from './dashboard.js';
import { RideRecorder, loadHistory, saveRide, deleteRide, downloadTCX } from './recorder.js';
import {
  listProfiles, getActive, setActive, addProfile, updateProfile,
  deleteProfile, initials, wattsPerKg,
} from './profiles.js';
import { formatTime, formatDistance } from './utils.js';

const FLAT_ROUTE = {
  id: 'workout-flat',
  name: 'Workout',
  totalDistance: 500000,
  points: [
    { distance: 0, elevation: 0 },
    { distance: 500000, elevation: 0 },
  ],
};

class App {
  constructor() {
    this._bleTrainer = new TrainerConnection();
    this._antTrainer = new AntPlusConnection();
    this._protocol = 'ble';
    this._trainer = this._bleTrainer;

    this._simulation = new RouteSimulation();
    this._workoutPlayer = new WorkoutPlayer();
    this._recorder = new RideRecorder();

    this._terrain = null;
    this._workoutView = null;
    this._world = null;
    this._dashboard = null;
    this._viewMode = 'world';

    this._selectedRoute = null;
    this._selectedWorkout = null;
    this._mode = 'route';
    this._manualMode = false;
    this._intensity = 1.0;

    this._lastFrameTime = 0;
    this._animFrameId = null;
    this._latestTrainerData = { power: 0, cadence: 0, speed: 0, heartRate: 0 };
    this._manualSpeed = 0;
    this._paused = false;
    this._lastRide = null;

    this._syncProfile();
    this._bindEvents();
    this._showPlatformHints();
    this._renderProfiles();
    this._renderRouteList();
    this._renderWorkoutList();
    this._renderHistory();
  }

  _syncProfile() {
    this._profile = getActive();
    this._ftp = this._profile.ftp;
    this._riderWeight = this._profile.riderWeight;
    this._bikeWeight = this._profile.bikeWeight;
    if (this._dashboard) this._dashboard.ftp = this._ftp;
  }

  _bindEvents() {
    document.getElementById('btn-connect-trainer').addEventListener('click', () => this._connectTrainer());
    document.getElementById('btn-connect-hr').addEventListener('click', () => this._connectHR());
    document.getElementById('btn-start-ride').addEventListener('click', () => this._startRide(false));
    document.getElementById('btn-start-manual').addEventListener('click', () => this._startRide(true));
    document.getElementById('btn-pause').addEventListener('click', () => this._togglePause());
    document.getElementById('btn-end-ride').addEventListener('click', () => this._endRide());
    document.getElementById('btn-view-toggle').addEventListener('click', () => this._toggleView());
    document.getElementById('btn-new-ride').addEventListener('click', () => this._newRide());
    document.getElementById('btn-export-tcx').addEventListener('click', () => {
      if (this._lastRide) downloadTCX(this._lastRide);
    });

    document.querySelectorAll('.btn-toggle').forEach(btn => {
      btn.addEventListener('click', () => this._switchProtocol(btn.dataset.protocol));
    });

    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => this._switchTab(btn.dataset.tab));
    });

    document.getElementById('btn-edit-profile').addEventListener('click', () => this._openProfileModal('edit'));
    document.getElementById('pm-cancel').addEventListener('click', () => this._closeProfileModal());
    document.getElementById('pm-save').addEventListener('click', () => this._saveProfileModal());
    document.getElementById('pm-delete').addEventListener('click', () => this._deleteFromModal());

    document.getElementById('profile-modal').addEventListener('click', (e) => {
      if (e.target.id === 'profile-modal') this._closeProfileModal();
    });

    for (const id of ['pm-ftp', 'pm-weight']) {
      document.getElementById(id).addEventListener('input', () => this._updateWkgReadout());
    }

    document.getElementById('resistance-slider').addEventListener('input', (e) => {
      const val = parseInt(e.target.value);
      if (this._mode === 'workout') {
        this._intensity = val / 100;
        document.getElementById('resistance-value').textContent = val + '%';
      } else {
        document.getElementById('resistance-value').textContent = val + '%';
        if (this._manualMode && this._trainer.connected) {
          this._trainer.setResistanceLevel(val);
        }
      }
    });

    const wireTrainer = (trainer) => {
      trainer.onData((data) => { this._latestTrainerData = data; });
      trainer.onStatus((status) => { this._updateConnectionStatus(status); });
    };
    wireTrainer(this._bleTrainer);
    wireTrainer(this._antTrainer);
  }

  // Bluefy supplies navigator.bluetooth, so the hint disappears exactly where
  // pairing actually works.
  _showPlatformHints() {
    const stranded = isIOS() && !navigator.bluetooth;
    document.getElementById('ios-hint').classList.toggle('hidden', !stranded);
    if (stranded) {
      document.getElementById('btn-connect-trainer').disabled = true;
      document.getElementById('btn-connect-hr').disabled = true;
    }
  }

  _renderProfiles() {
    const container = document.getElementById('profile-chips');
    container.innerHTML = '';

    for (const p of listProfiles()) {
      const chip = document.createElement('button');
      chip.className = 'profile-chip' + (p.id === this._profile.id ? ' active' : '');

      const av = document.createElement('span');
      av.className = 'avatar';
      av.style.background = p.color;
      av.textContent = initials(p.name);

      const meta = document.createElement('span');
      meta.className = 'chip-meta';
      const name = document.createElement('span');
      name.className = 'chip-name';
      name.textContent = p.name;
      const sub = document.createElement('span');
      sub.className = 'chip-sub';
      sub.textContent = `${p.ftp} W · ${wattsPerKg(p).toFixed(2)} W/kg`;
      meta.append(name, sub);

      chip.append(av, meta);
      chip.addEventListener('click', () => this._selectProfile(p.id));
      container.appendChild(chip);
    }

    const add = document.createElement('button');
    add.className = 'profile-add';
    add.id = 'btn-add-profile';
    add.textContent = '+ Add Rider';
    add.addEventListener('click', () => this._openProfileModal('add'));
    container.appendChild(add);
  }

  _selectProfile(id) {
    setActive(id);
    this._syncProfile();
    this._renderProfiles();
    this._renderWorkoutList();
    this._renderHistory();
  }

  _openProfileModal(mode) {
    this._modalMode = mode;
    const p = this._profile;
    const isEdit = mode === 'edit';

    document.getElementById('pm-title').textContent = isEdit ? 'Edit Rider' : 'Add Rider';
    document.getElementById('pm-name').value = isEdit ? p.name : '';
    document.getElementById('pm-ftp').value = isEdit ? p.ftp : 200;
    document.getElementById('pm-weight').value = isEdit ? p.riderWeight : 75;
    document.getElementById('pm-bike').value = isEdit ? p.bikeWeight : 10;

    const delBtn = document.getElementById('pm-delete');
    delBtn.classList.toggle('hidden', !isEdit || listProfiles().length <= 1);

    this._updateWkgReadout();
    document.getElementById('profile-modal').classList.remove('hidden');
    document.getElementById('pm-name').focus();
  }

  _closeProfileModal() {
    document.getElementById('profile-modal').classList.add('hidden');
  }

  _updateWkgReadout() {
    const ftp = parseFloat(document.getElementById('pm-ftp').value);
    const kg = parseFloat(document.getElementById('pm-weight').value);
    const el = document.getElementById('pm-wkg');
    if (isFinite(ftp) && isFinite(kg) && kg > 0) {
      el.textContent = `${(ftp / kg).toFixed(2)} W/kg at threshold`;
    } else {
      el.textContent = '—';
    }
  }

  _saveProfileModal() {
    const fields = {
      name: document.getElementById('pm-name').value,
      ftp: document.getElementById('pm-ftp').value,
      riderWeight: document.getElementById('pm-weight').value,
      bikeWeight: document.getElementById('pm-bike').value,
    };

    if (this._modalMode === 'edit') {
      updateProfile(this._profile.id, fields);
    } else {
      addProfile(fields);
    }

    this._syncProfile();
    this._renderProfiles();
    this._renderWorkoutList();
    this._renderHistory();
    this._closeProfileModal();
  }

  _deleteFromModal() {
    if (deleteProfile(this._profile.id)) {
      this._syncProfile();
      this._renderProfiles();
      this._renderHistory();
    }
    this._closeProfileModal();
  }

  _switchTab(tab) {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelector(`.tab-btn[data-tab="${tab}"]`).classList.add('active');
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    document.getElementById(`tab-${tab}`).classList.add('active');

    if (tab === 'history') this._renderHistory();
    if (tab === 'routes') this._refreshPreviews('#route-list', routes, 'route');
    if (tab === 'workouts') this._refreshPreviews('#workout-list', workouts, 'workout');
  }

  _refreshPreviews(selector, items, kind) {
    requestAnimationFrame(() => {
      const cards = document.querySelectorAll(`${selector} .route-card`);
      cards.forEach((card, i) => {
        const canvas = card.querySelector('canvas');
        if (!canvas || !items[i]) return;
        if (kind === 'route') this._drawMiniProfile(canvas, items[i]);
        else renderWorkoutMini(canvas, items[i]);
      });
    });
  }

  _switchProtocol(protocol) {
    if (this._trainer.connected) return;
    this._protocol = protocol;
    this._trainer = protocol === 'ant' ? this._antTrainer : this._bleTrainer;

    document.querySelectorAll('.btn-toggle').forEach(b => b.classList.remove('active'));
    document.querySelector(`[data-protocol="${protocol}"]`).classList.add('active');

    document.getElementById('connect-trainer-label').textContent = protocol === 'ant'
      ? 'Connect Trainer (ANT+ USB)'
      : 'Connect Trainer (Bluetooth)';
  }

  _renderRouteList() {
    const container = document.getElementById('route-list');
    container.innerHTML = '';

    for (const route of routes) {
      const card = document.createElement('div');
      card.className = 'route-card';
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

    // Start with the first route chosen. Without a selection the start buttons
    // silently do nothing, which reads as the app being broken.
    const first = container.querySelector('.route-card');
    if (first && !this._selectedRoute && !this._selectedWorkout) {
      this._selectRoute(routes[0], first);
    }
  }

  _renderWorkoutList() {
    const container = document.getElementById('workout-list');
    if (!container) return;
    container.innerHTML = '';

    for (const workout of workouts) {
      const card = document.createElement('div');
      card.className = 'route-card';
      const mins = Math.round(workoutDuration(workout) / 60);

      card.innerHTML = `
        <div class="route-name">${workout.name}</div>
        <div class="route-info">
          <span>${mins} min</span>
          <span>${workout.focus}</span>
        </div>
        <div class="route-difficulty difficulty-moderate">ERG</div>
        <div class="route-preview"><canvas></canvas></div>
      `;

      card.addEventListener('click', () => this._selectWorkout(workout, card));
      container.appendChild(card);

      requestAnimationFrame(() => {
        const canvas = card.querySelector('canvas');
        if (canvas) renderWorkoutMini(canvas, workout);
      });
    }
  }

  _renderHistory() {
    const container = document.getElementById('history-list');
    if (!container) return;

    // rides recorded before profiles existed have no profileId — show them to
    // whoever is active rather than hiding them
    const history = loadHistory()
      .filter(r => !r.profileId || r.profileId === this._profile.id);
    container.innerHTML = '';

    if (history.length === 0) {
      container.innerHTML = `<div class="history-empty">
        No saved rides yet for <b>${escapeHtml(this._profile.name)}</b>.<br>
        Finish a ride and it will be stored here,
        ready to export to Strava or Garmin Connect.
      </div>`;
      return;
    }

    for (const ride of history) {
      const card = document.createElement('div');
      card.className = 'history-card';
      const date = new Date(ride.startedAt);
      const dateStr = date.toLocaleDateString(undefined, {
        month: 'short', day: 'numeric', year: 'numeric',
      }) + ' · ' + date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });

      card.innerHTML = `
        <div class="history-main">
          <div class="history-title"></div>
          <div class="history-date">${dateStr}</div>
        </div>
        <div class="history-stats">
          <span><b>${formatDistance(ride.distanceM)}</b> km</span>
          <span><b>${formatTime(ride.durationSec)}</b></span>
          <span><b>${ride.avgPower}</b> W</span>
        </div>
        <div class="history-actions">
          <button class="icon-btn" data-act="export">TCX</button>
          <button class="icon-btn danger" data-act="delete">Delete</button>
        </div>
      `;

      card.querySelector('.history-title').textContent = ride.title || 'Ride';
      card.querySelector('[data-act="export"]').addEventListener('click', () => downloadTCX(ride));
      card.querySelector('[data-act="delete"]').addEventListener('click', () => {
        deleteRide(ride.id);
        this._renderHistory();
      });

      container.appendChild(card);
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
      ctx.lineTo((p.distance / route.totalDistance) * w,
                 h - ((p.elevation - minE) / totalRange) * h);
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
      ctx.lineTo((p.distance / route.totalDistance) * w,
                 h - ((p.elevation - minE) / totalRange) * h);
    }
    ctx.strokeStyle = 'rgba(6, 182, 212, 0.7)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  _selectRoute(route, card) {
    document.querySelectorAll('.route-card').forEach(c => c.classList.remove('selected'));
    card.classList.add('selected');
    this._selectedRoute = route;
    this._selectedWorkout = null;
    this._mode = 'route';
    document.getElementById('btn-start-ride').disabled = false;
  }

  _selectWorkout(workout, card) {
    document.querySelectorAll('.route-card').forEach(c => c.classList.remove('selected'));
    card.classList.add('selected');
    this._selectedWorkout = workout;
    this._selectedRoute = null;
    this._mode = 'workout';
    document.getElementById('btn-start-ride').disabled = false;
  }

  async _connectTrainer() {
    const btn = document.getElementById('btn-connect-trainer');
    const label = document.getElementById('connect-trainer-label');
    btn.disabled = true;
    label.textContent = 'Connecting...';

    const ok = await this._trainer.connectTrainer();

    btn.disabled = false;
    if (ok) {
      const name = this._protocol === 'ble'
        ? (this._bleTrainer._device?.name || 'Trainer')
        : 'ANT+ Trainer';
      label.textContent = `Connected: ${name}`;
    } else {
      label.textContent = this._protocol === 'ant'
        ? 'Connect Trainer (ANT+ USB)'
        : 'Connect Trainer (Bluetooth)';
    }
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
    if (this._mode === 'route' && !this._selectedRoute) return;
    if (this._mode === 'workout' && !this._selectedWorkout) return;

    this._manualMode = manual;
    this._paused = false;
    this._intensity = 1.0;

    const isWorkout = this._mode === 'workout';

    this._simulation.loadRoute(isWorkout ? FLAT_ROUTE : this._selectedRoute);
    this._simulation.start();
    this._recorder.start();

    this._showScreen('ride-screen');
    this._configureRideChrome(isWorkout);

    const strip = document.getElementById('terrain-canvas');
    this._world = new WorldRenderer(document.getElementById('world-canvas'));
    this._world.bottomInset = document.getElementById('profile-strip').offsetHeight;

    if (isWorkout) {
      this._workoutPlayer.load(this._selectedWorkout);
      this._workoutView = new WorkoutRenderer(strip, true);
      this._workoutView.setWorkout(this._selectedWorkout, this._ftp);
      this._world.setRolling();
      this._terrain = null;
    } else {
      this._terrain = new TerrainRenderer(strip, true);
      this._terrain.setRoute(this._selectedRoute);
      this._world.setRoute(this._selectedRoute);
      this._workoutView = null;
    }

    this._dashboard = new Dashboard(this._ftp);
    this._dashboard.setMode(this._mode);
    this._dashboard.resetSmoothing();

    document.getElementById('btn-pause').textContent = 'Pause';
    this._manualSpeed = 25;

    this._lastFrameTime = performance.now();
    this._loop();
  }

  _configureRideChrome(isWorkout) {
    const show = (id, visible) =>
      document.getElementById(id).classList.toggle('hidden', !visible);

    this._viewMode = 'world';
    document.querySelector('.ride-layout').classList.remove('profile-view');
    document.getElementById('btn-view-toggle').textContent = 'Profile View';

    show('gradient-display', !isWorkout);
    show('altitude-display', !isWorkout);
    show('target-display', isWorkout);
    show('workout-info', isWorkout);

    const slider = document.getElementById('resistance-slider');
    const label = document.getElementById('resistance-label');
    const value = document.getElementById('resistance-value');

    if (isWorkout) {
      document.getElementById('workout-name-value').textContent = this._selectedWorkout.name;
      label.textContent = 'Intensity';
      slider.min = 50;
      slider.max = 150;
      slider.value = 100;
      value.textContent = '100%';
    } else {
      label.textContent = 'Manual Resistance';
      slider.min = 0;
      slider.max = 100;
      slider.value = 0;
      value.textContent = '0%';
    }
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
        this._tick(delta);
      }

      if (this._rideFinished()) {
        this._showSummary();
        return;
      }

      this._loop();
    });
  }

  _rideFinished() {
    return this._mode === 'workout'
      ? this._workoutPlayer.isComplete
      : this._simulation.isComplete;
  }

  _tick(delta) {
    const isWorkout = this._mode === 'workout';
    if (isWorkout) this._workoutPlayer.update(delta);

    const targetWatts = isWorkout
      ? Math.round(this._workoutPlayer.targetWatts(this._ftp) * this._intensity)
      : 0;

    const speed = this._manualMode ? this._manualSpeed : this._latestTrainerData.speed;
    const power = this._manualMode
      ? (isWorkout ? this._simulateErgPower(targetWatts) : this._estimateManualPower())
      : this._latestTrainerData.power;
    const cadence = this._manualMode ? this._estimateManualCadence() : this._latestTrainerData.cadence;
    const hr = this._latestTrainerData.heartRate;

    this._simulation.update(speed, delta, power, cadence, hr);

    const gradient = this._simulation.currentGradient;

    if (this._trainer.connected && !this._manualMode) {
      if (isWorkout) {
        if (!this._workoutPlayer.isFreeRide) this._trainer.setTargetPower(targetWatts);
      } else {
        this._trainer.setSimulationParameters(gradient);
      }
    }

    if (this._manualMode && !isWorkout) {
      this._manualSpeed = Math.max(5, 25 - gradient * 1.5);
    }

    this._recorder.record(this._simulation.elapsedTime, {
      distance: this._simulation.currentDistance,
      elevation: this._simulation.currentElevation,
      power, cadence, heartRate: hr, speed, gradient,
    });

    this._dashboard.update({
      power, speed, cadence, heartRate: hr,
      distance: this._simulation.currentDistance,
      elapsedTime: this._simulation.elapsedTime,
      elevationGain: this._simulation.elevationGain,
      avgPower: this._simulation.avgPower,
      gradient,
      elevation: this._simulation.currentElevation,
      targetWatts,
      freeRide: isWorkout && this._workoutPlayer.isFreeRide,
      intervalRemaining: isWorkout ? this._workoutPlayer.intervalRemaining : 0,
      stepIndex: isWorkout ? this._workoutPlayer.index + 1 : 0,
      stepCount: isWorkout ? this._selectedWorkout.intervals.length : 0,
    });

    if (isWorkout) {
      this._workoutView.render(this._workoutPlayer.elapsed);
    } else {
      this._terrain.render(this._simulation.progress);
    }

    if (this._viewMode === 'world') {
      this._world.render(this._simulation.currentDistance, speed, cadence, delta);
    }
  }

  _toggleView() {
    this._viewMode = this._viewMode === 'world' ? 'profile' : 'world';
    const layout = document.querySelector('.ride-layout');
    layout.classList.toggle('profile-view', this._viewMode === 'profile');
    document.getElementById('btn-view-toggle').textContent =
      this._viewMode === 'world' ? 'Profile View' : 'Road View';

    requestAnimationFrame(() => {
      if (this._terrain) this._terrain.setCompact(this._viewMode === 'world');
      if (this._workoutView) this._workoutView.setCompact(this._viewMode === 'world');
      if (this._world) this._world._resize();
    });
  }

  _simulateErgPower(target) {
    if (target <= 0) return Math.round(120 + Math.random() * 20);
    return Math.round(target + (Math.random() - 0.5) * target * 0.06);
  }

  _estimateManualPower() {
    const gradient = this._simulation.currentGradient;
    const totalMass = this._riderWeight + this._bikeWeight;
    const g = 9.81;
    const crr = 0.004;
    const cda = 0.4;
    const rho = 1.225;
    const v = this._manualSpeed / 3.6;
    const theta = Math.atan(gradient / 100);

    const fGravity = totalMass * g * Math.sin(theta);
    const fRolling = crr * totalMass * g * Math.cos(theta);
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
    this._showSummary();
  }

  _showSummary() {
    if (this._animFrameId) {
      cancelAnimationFrame(this._animFrameId);
      this._animFrameId = null;
    }
    if (this._workoutView) {
      this._workoutView.destroy();
      this._workoutView = null;
    }
    if (this._terrain) {
      this._terrain.destroy();
      this._terrain = null;
    }
    if (this._world) {
      this._world.destroy();
      this._world = null;
    }

    const sim = this._simulation;
    const dist = sim.currentDistance;
    const time = sim.elapsedTime;
    const avgSpeed = time > 0 ? ((dist / 1000) / (time / 3600)) : 0;
    const title = this._mode === 'workout'
      ? this._selectedWorkout.name
      : this._selectedRoute.name;

    const ride = this._recorder.buildRide({
      title,
      mode: this._mode,
      profileId: this._profile.id,
      profileName: this._profile.name,
      ftp: this._ftp,
      riderWeight: this._riderWeight,
      durationSec: time,
      distanceM: dist,
      avgSpeed: avgSpeed.toFixed(1),
      avgPower: sim.avgPower,
      maxPower: sim.maxPower,
      avgCadence: sim.avgCadence,
      avgHR: sim.avgHR,
      elevationGain: Math.round(sim.elevationGain),
      calories: sim.calories,
    });

    this._lastRide = ride;
    if (ride.samples.length > 0) saveRide(ride);

    document.getElementById('summary-title').textContent = title;
    document.getElementById('legend-elev').classList.toggle('hidden', this._mode === 'workout');
    document.getElementById('summary-distance').textContent = formatDistance(dist) + ' km';
    document.getElementById('summary-duration').textContent = formatTime(time);
    document.getElementById('summary-avg-speed').textContent = avgSpeed.toFixed(1) + ' km/h';
    document.getElementById('summary-avg-power').textContent = sim.avgPower + ' W';
    document.getElementById('summary-max-power').textContent = sim.maxPower + ' W';
    document.getElementById('summary-avg-cadence').textContent = sim.avgCadence + ' rpm';
    document.getElementById('summary-avg-hr').textContent = sim.avgHR > 0 ? sim.avgHR + ' bpm' : '-- bpm';
    document.getElementById('summary-elevation').textContent = Math.round(sim.elevationGain) + ' m';
    document.getElementById('summary-calories').textContent = sim.calories + ' kcal';
    document.getElementById('summary-max-hr').textContent = sim.maxHR > 0 ? sim.maxHR + ' bpm' : '-- bpm';

    const wkg = this._riderWeight > 0 ? sim.avgPower / this._riderWeight : 0;
    document.getElementById('summary-wkg').textContent = wkg.toFixed(2);
    const intensity = this._ftp > 0 ? Math.round((sim.avgPower / this._ftp) * 100) : 0;
    document.getElementById('summary-intensity').textContent = intensity + '% FTP';

    this._showScreen('summary-screen');
    requestAnimationFrame(() => this._renderSummaryChart());
  }

  _renderSummaryChart() {
    const canvas = document.getElementById('summary-chart');
    const parent = canvas.parentElement;
    if (!parent || !this._lastRide) return;

    const rect = parent.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const w = rect.width;
    const h = 220;

    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';

    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#1a2236';
    ctx.fillRect(0, 0, w, h);

    const samples = this._lastRide.samples;
    if (samples.length < 2) {
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.font = '12px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Not enough data recorded for a chart', w / 2, h / 2);
      return;
    }

    const margin = { top: 16, bottom: 28, left: 42, right: 42 };
    const plotW = w - margin.left - margin.right;
    const plotH = h - margin.top - margin.bottom;
    const duration = samples[samples.length - 1].t || 1;

    const maxPower = Math.max(50, ...samples.map(s => s.p));
    const powerScale = Math.ceil(maxPower / 50) * 50;
    const toX = (t) => margin.left + (t / duration) * plotW;

    let minE = Infinity, maxE = -Infinity;
    for (const s of samples) {
      if (s.e < minE) minE = s.e;
      if (s.e > maxE) maxE = s.e;
    }
    const elevRange = Math.max(1, maxE - minE);

    if (this._lastRide.mode === 'route' && maxE > minE) {
      ctx.beginPath();
      ctx.moveTo(margin.left, h - margin.bottom);
      for (const s of samples) {
        ctx.lineTo(toX(s.t), margin.top + plotH - ((s.e - minE) / elevRange) * plotH * 0.5);
      }
      ctx.lineTo(w - margin.right, h - margin.bottom);
      ctx.closePath();
      ctx.fillStyle = 'rgba(6, 182, 212, 0.16)';
      ctx.fill();
    }

    ctx.beginPath();
    ctx.moveTo(margin.left, h - margin.bottom);
    for (const s of samples) {
      ctx.lineTo(toX(s.t), margin.top + plotH - (s.p / powerScale) * plotH);
    }
    ctx.lineTo(w - margin.right, h - margin.bottom);
    ctx.closePath();
    const pg = ctx.createLinearGradient(0, margin.top, 0, h - margin.bottom);
    pg.addColorStop(0, 'rgba(255, 107, 53, 0.45)');
    pg.addColorStop(1, 'rgba(255, 107, 53, 0.04)');
    ctx.fillStyle = pg;
    ctx.fill();

    ctx.beginPath();
    samples.forEach((s, i) => {
      const x = toX(s.t);
      const y = margin.top + plotH - (s.p / powerScale) * plotH;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    ctx.strokeStyle = '#ff6b35';
    ctx.lineWidth = 1.6;
    ctx.stroke();

    if (samples.some(s => s.h > 0)) {
      ctx.beginPath();
      let started = false;
      for (const s of samples) {
        if (s.h <= 0) continue;
        const x = toX(s.t);
        const y = margin.top + plotH - (s.h / 200) * plotH;
        started ? ctx.lineTo(x, y) : (ctx.moveTo(x, y), started = true);
      }
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 1.4;
      ctx.stroke();
    }

    ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
    ctx.font = '9px Inter, sans-serif';
    ctx.textAlign = 'right';
    for (let i = 0; i <= 4; i++) {
      const val = (powerScale / 4) * i;
      const y = margin.top + plotH - (val / powerScale) * plotH;
      ctx.fillText(`${Math.round(val)}W`, margin.left - 6, y + 3);
      ctx.beginPath();
      ctx.moveTo(margin.left, y);
      ctx.lineTo(w - margin.right, y);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    ctx.textAlign = 'left';
    for (let i = 0; i <= 4; i++) {
      const val = 50 * i;
      const y = margin.top + plotH - (val / 200) * plotH;
      ctx.fillText(`${val}`, w - margin.right + 6, y + 3);
    }

    ctx.textAlign = 'center';
    const steps = 5;
    for (let i = 0; i <= steps; i++) {
      const t = (duration / steps) * i;
      ctx.fillText(formatTime(t), toX(t), h - 9);
    }
  }

  _newRide() {
    this._simulation.reset();
    this._renderHistory();
    this._showScreen('connect-screen');
  }

  _showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(id).classList.add('active');
  }
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

document.addEventListener('DOMContentLoaded', () => {
  new App();
});
