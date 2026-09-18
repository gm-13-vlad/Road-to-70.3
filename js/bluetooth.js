const FTMS_SERVICE = 0x1826;
const HEART_RATE_SERVICE = 0x180D;
const INDOOR_BIKE_DATA = 0x2AD2;
const FTMS_CONTROL_POINT = 0x2AD9;
const FTMS_FEATURE = 0x2ACC;
const HR_MEASUREMENT = 0x2A37;

export class TrainerConnection {
  constructor() {
    this._device = null;
    this._server = null;
    this._ftmsService = null;
    this._controlPoint = null;
    this._bikeDataChar = null;
    this._hrChar = null;
    this._hrDevice = null;
    this._hrServer = null;
    this._onData = null;
    this._onStatus = null;
    this._connected = false;
    this._hrConnected = false;
    this._controlAcquired = false;
    this._lastGradientSent = null;
    this._lastGradientTime = 0;
    this._lastPowerSent = null;
    this._lastPowerTime = 0;
    this._pendingWrite = false;
    this._features = { simulationParams: false, resistanceLevel: false };
    this._latestData = { power: 0, cadence: 0, speed: 0, heartRate: 0 };
  }

  onData(callback) { this._onData = callback; }
  onStatus(callback) { this._onStatus = callback; }
  get connected() { return this._connected; }
  get hrConnected() { return this._hrConnected; }
  get features() { return this._features; }

  async connectTrainer() {
    if (!navigator.bluetooth) {
      this._emitStatus('error', 'Web Bluetooth not supported. Use Chrome/Edge on HTTPS or localhost.');
      return false;
    }

    try {
      this._emitStatus('connecting', 'Requesting Bluetooth device...');

      this._device = await navigator.bluetooth.requestDevice({
        filters: [{ services: [FTMS_SERVICE] }],
        optionalServices: [HEART_RATE_SERVICE],
      });

      this._device.addEventListener('gattserverdisconnected', () => this._onDisconnected());

      this._emitStatus('connecting', 'Connecting to GATT server...');
      this._server = await this._device.gatt.connect();

      this._emitStatus('connecting', 'Getting FTMS service...');
      this._ftmsService = await this._server.getPrimaryService(FTMS_SERVICE);

      await this._readFeatures();
      await this._subscribeToIndoorBikeData();
      await this._setupControlPoint();

      try {
        const hrService = await this._server.getPrimaryService(HEART_RATE_SERVICE);
        this._hrChar = await hrService.getCharacteristic(HR_MEASUREMENT);
        await this._hrChar.startNotifications();
        this._hrChar.addEventListener('characteristicvaluechanged', (e) => this._handleHRData(e));
        this._hrConnected = true;
      } catch {
        // HR not available on trainer, that's fine
      }

      this._connected = true;
      this._emitStatus('connected', `Connected to ${this._device.name || 'Trainer'}`);
      return true;
    } catch (err) {
      if (err.name === 'NotFoundError') {
        this._emitStatus('disconnected', 'No device selected');
      } else {
        this._emitStatus('error', `Connection failed: ${err.message}`);
      }
      return false;
    }
  }

  async connectHRMonitor() {
    if (!navigator.bluetooth) {
      this._emitStatus('error', 'Web Bluetooth not supported.');
      return false;
    }

    try {
      this._hrDevice = await navigator.bluetooth.requestDevice({
        filters: [{ services: [HEART_RATE_SERVICE] }],
      });

      this._hrDevice.addEventListener('gattserverdisconnected', () => {
        this._hrConnected = false;
        this._emitStatus('hr_disconnected', 'HR monitor disconnected');
      });

      this._hrServer = await this._hrDevice.gatt.connect();
      const hrService = await this._hrServer.getPrimaryService(HEART_RATE_SERVICE);
      this._hrChar = await hrService.getCharacteristic(HR_MEASUREMENT);
      await this._hrChar.startNotifications();
      this._hrChar.addEventListener('characteristicvaluechanged', (e) => this._handleHRData(e));

      this._hrConnected = true;
      this._emitStatus('hr_connected', `HR connected to ${this._hrDevice.name || 'HR Monitor'}`);
      return true;
    } catch (err) {
      if (err.name !== 'NotFoundError') {
        this._emitStatus('error', `HR connection failed: ${err.message}`);
      }
      return false;
    }
  }

  async _readFeatures() {
    try {
      const featureChar = await this._ftmsService.getCharacteristic(FTMS_FEATURE);
      const value = await featureChar.readValue();
      const machineFeatures = value.getUint32(0, true);
      const targetFeatures = value.getUint32(4, true);
      this._features.simulationParams = (targetFeatures & (1 << 13)) !== 0;
      this._features.resistanceLevel = (targetFeatures & (1 << 0)) !== 0;
    } catch {
      this._features.simulationParams = true;
      this._features.resistanceLevel = true;
    }
  }

  async _subscribeToIndoorBikeData() {
    this._bikeDataChar = await this._ftmsService.getCharacteristic(INDOOR_BIKE_DATA);
    await this._bikeDataChar.startNotifications();
    this._bikeDataChar.addEventListener('characteristicvaluechanged', (e) => this._handleBikeData(e));
  }

  async _setupControlPoint() {
    try {
      this._controlPoint = await this._ftmsService.getCharacteristic(FTMS_CONTROL_POINT);
      await this._controlPoint.startNotifications();
      this._controlPoint.addEventListener('characteristicvaluechanged', () => {
        this._pendingWrite = false;
      });
      await this._requestControl();
    } catch {
      this._controlPoint = null;
    }
  }

  async _requestControl() {
    if (!this._controlPoint) return;
    try {
      const buf = new ArrayBuffer(1);
      new DataView(buf).setUint8(0, 0x00);
      this._pendingWrite = true;
      await this._controlPoint.writeValue(buf);
      this._controlAcquired = true;
    } catch {
      this._controlAcquired = false;
    }
  }

  _handleBikeData(event) {
    const data = event.target.value;
    const flags = data.getUint16(0, true);
    let offset = 2;

    let speed = 0;
    let cadence = 0;
    let power = 0;

    // Bit 0: 0 = instantaneous speed present
    if (!(flags & 0x01)) {
      speed = data.getUint16(offset, true) * 0.01;
      offset += 2;
    }

    // Bit 1: average speed present
    if (flags & 0x02) {
      offset += 2;
    }

    // Bit 2: instantaneous cadence present
    if (flags & 0x04) {
      cadence = data.getUint16(offset, true) * 0.5;
      offset += 2;
    }

    // Bit 3: average cadence present
    if (flags & 0x08) {
      offset += 2;
    }

    // Bit 4: total distance present
    if (flags & 0x10) {
      offset += 3;
    }

    // Bit 5: resistance level present
    if (flags & 0x20) {
      offset += 2;
    }

    // Bit 6: instantaneous power present
    if (flags & 0x40) {
      power = data.getInt16(offset, true);
      offset += 2;
    }

    this._latestData = {
      power: Math.max(0, power),
      cadence: Math.max(0, cadence),
      speed: Math.max(0, speed),
      heartRate: this._latestData.heartRate,
    };

    if (this._onData) this._onData({ ...this._latestData });
  }

  _handleHRData(event) {
    const data = event.target.value;
    const flags = data.getUint8(0);
    let hr;
    if (flags & 0x01) {
      hr = data.getUint16(1, true);
    } else {
      hr = data.getUint8(1);
    }
    this._latestData.heartRate = hr;
    if (this._onData) this._onData({ ...this._latestData });
  }

  async setSimulationParameters(gradientPercent, windSpeed = 0, crr = 0.004, cw = 0.51) {
    if (!this._controlPoint || !this._controlAcquired) return;
    if (this._pendingWrite) return;

    const now = Date.now();
    if (this._lastGradientSent !== null &&
        Math.abs(gradientPercent - this._lastGradientSent) < 0.1 &&
        now - this._lastGradientTime < 1000) {
      return;
    }

    try {
      const buf = new ArrayBuffer(7);
      const view = new DataView(buf);
      view.setUint8(0, 0x11);
      view.setInt16(1, Math.round(windSpeed * 1000), true);
      view.setInt16(3, Math.round(gradientPercent * 100), true);
      view.setUint8(5, Math.round(crr * 10000));
      view.setUint8(6, Math.round(cw * 100));

      this._pendingWrite = true;
      await this._controlPoint.writeValue(buf);
      this._lastGradientSent = gradientPercent;
      this._lastGradientTime = now;
    } catch {
      this._pendingWrite = false;
    }
  }

  async setResistanceLevel(level) {
    if (!this._controlPoint || !this._controlAcquired) return;
    if (this._pendingWrite) return;

    try {
      const buf = new ArrayBuffer(3);
      const view = new DataView(buf);
      view.setUint8(0, 0x04);
      view.setInt16(1, Math.round(level * 10), true);

      this._pendingWrite = true;
      await this._controlPoint.writeValue(buf);
    } catch {
      this._pendingWrite = false;
    }
  }

  async setTargetPower(watts) {
    if (!this._controlPoint || !this._controlAcquired) return;
    if (this._pendingWrite) return;

    const target = Math.max(0, Math.round(watts));
    const now = Date.now();
    if (this._lastPowerSent === target && now - this._lastPowerTime < 1000) return;

    try {
      const buf = new ArrayBuffer(3);
      const view = new DataView(buf);
      view.setUint8(0, 0x05);
      view.setInt16(1, target, true);

      this._pendingWrite = true;
      await this._controlPoint.writeValue(buf);
      this._lastPowerSent = target;
      this._lastPowerTime = now;
    } catch {
      this._pendingWrite = false;
    }
  }

  _onDisconnected() {
    this._connected = false;
    this._controlAcquired = false;
    this._pendingWrite = false;
    this._emitStatus('disconnected', 'Trainer disconnected');
  }

  _emitStatus(state, message) {
    if (this._onStatus) this._onStatus({ state, message });
  }

  disconnect() {
    if (this._device && this._device.gatt.connected) {
      this._device.gatt.disconnect();
    }
    if (this._hrDevice && this._hrDevice.gatt.connected) {
      this._hrDevice.gatt.disconnect();
    }
  }
}
