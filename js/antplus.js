const ANT_SYNC = 0xA4;
const ANT_USB_VID = 0x0FCF;
const ANT_USB_PIDS = [0x1008, 0x1009];

const ANT_NETWORK_KEY = [0xB9, 0xA5, 0x21, 0xFB, 0xBD, 0x72, 0xC3, 0x45];

const MSG_UNASSIGN_CHANNEL = 0x41;
const MSG_ASSIGN_CHANNEL = 0x42;
const MSG_CHANNEL_PERIOD = 0x43;
const MSG_CHANNEL_SEARCH_TIMEOUT = 0x44;
const MSG_CHANNEL_RF_FREQ = 0x45;
const MSG_SET_NETWORK_KEY = 0x46;
const MSG_SYSTEM_RESET = 0x4A;
const MSG_OPEN_CHANNEL = 0x4B;
const MSG_CLOSE_CHANNEL = 0x4C;
const MSG_CHANNEL_ID = 0x51;
const MSG_BROADCAST_DATA = 0x4E;
const MSG_ACKNOWLEDGED_DATA = 0x4F;
const MSG_CHANNEL_EVENT = 0x40;
const MSG_CHANNEL_STATUS = 0x52;
const MSG_STARTUP = 0x6F;

const CHANNEL_TYPE_SLAVE = 0x00;

const FEC_DEVICE_TYPE = 0x11;
const FEC_FREQUENCY = 57;
const FEC_PERIOD = 8192;

const HR_DEVICE_TYPE = 0x78;
const HR_FREQUENCY = 57;
const HR_PERIOD = 8070;

const FEC_CHANNEL = 0;
const HR_CHANNEL = 1;

const FEC_PAGE_GENERAL = 0x10;
const FEC_PAGE_GENERAL_SETTINGS = 0x11;
const FEC_PAGE_TRAINER_DATA = 0x19;
const FEC_PAGE_COMMAND_STATUS = 0x47;
const FEC_PAGE_TRACK_RESISTANCE = 0x30;
const FEC_PAGE_WIND_RESISTANCE = 0x32;

export class AntPlusConnection {
  constructor() {
    this._device = null;
    this._iface = null;
    this._epIn = null;
    this._epOut = null;
    this._onData = null;
    this._onStatus = null;
    this._connected = false;
    this._hrConnected = false;
    this._reading = false;
    this._latestData = { power: 0, cadence: 0, speed: 0, heartRate: 0 };
    this._lastGradientSent = null;
    this._lastGradientTime = 0;
    this._fecFound = false;
    this._hrFound = false;
    this._features = { simulationParams: true, resistanceLevel: true };

    this._prevAccumPower = null;
    this._prevPowerEvents = null;
    this._rxBuffer = new Uint8Array(0);
  }

  onData(callback) { this._onData = callback; }
  onStatus(callback) { this._onStatus = callback; }
  get connected() { return this._connected; }
  get hrConnected() { return this._hrConnected; }
  get features() { return this._features; }

  async connectTrainer() {
    if (!navigator.usb) {
      this._emitStatus('error', 'WebUSB not supported. Use Chrome/Edge on HTTPS or localhost.');
      return false;
    }

    try {
      this._emitStatus('connecting', 'Requesting ANT+ USB dongle...');

      const filters = ANT_USB_PIDS.map(pid => ({ vendorId: ANT_USB_VID, productId: pid }));
      this._device = await navigator.usb.requestDevice({ filters });

      this._emitStatus('connecting', 'Opening ANT+ dongle...');
      await this._device.open();

      if (this._device.configuration === null) {
        await this._device.selectConfiguration(1);
      }

      this._iface = this._device.configuration.interfaces[0];
      await this._device.claimInterface(this._iface.interfaceNumber);

      const alt = this._iface.alternates[0];
      for (const ep of alt.endpoints) {
        if (ep.direction === 'in') this._epIn = ep;
        if (ep.direction === 'out') this._epOut = ep;
      }

      if (!this._epIn || !this._epOut) {
        this._emitStatus('error', 'ANT+ dongle endpoints not found');
        return false;
      }

      this._emitStatus('connecting', 'Initializing ANT+ radio...');
      await this._initAnt();

      this._reading = true;
      this._readLoop();

      this._connected = true;
      this._emitStatus('connected', 'ANT+ Trainer connected');
      return true;
    } catch (err) {
      if (err.name === 'NotFoundError') {
        this._emitStatus('disconnected', 'No ANT+ dongle selected');
      } else {
        this._emitStatus('error', `ANT+ connection failed: ${err.message}`);
      }
      return false;
    }
  }

  async connectHRMonitor() {
    if (!this._connected) {
      this._emitStatus('error', 'Connect ANT+ dongle first');
      return false;
    }

    if (this._hrFound) {
      this._emitStatus('hr_connected', 'ANT+ HR already active');
      return true;
    }

    try {
      await this._openChannel(HR_CHANNEL, HR_DEVICE_TYPE, HR_FREQUENCY, HR_PERIOD);
      this._emitStatus('connecting', 'Searching for ANT+ HR strap...');
      return true;
    } catch (err) {
      this._emitStatus('error', `ANT+ HR setup failed: ${err.message}`);
      return false;
    }
  }

  async _initAnt() {
    await this._sendMessage(MSG_SYSTEM_RESET, [0x00]);
    await this._delay(500);

    await this._sendMessage(MSG_SET_NETWORK_KEY, [0x00, ...ANT_NETWORK_KEY]);
    await this._delay(100);

    await this._openChannel(FEC_CHANNEL, FEC_DEVICE_TYPE, FEC_FREQUENCY, FEC_PERIOD);
    await this._delay(100);

    await this._openChannel(HR_CHANNEL, HR_DEVICE_TYPE, HR_FREQUENCY, HR_PERIOD);
  }

  async _openChannel(channel, deviceType, frequency, period) {
    await this._sendMessage(MSG_ASSIGN_CHANNEL, [channel, CHANNEL_TYPE_SLAVE, 0x00]);
    await this._delay(50);

    await this._sendMessage(MSG_CHANNEL_ID, [
      channel,
      0x00, 0x00,
      deviceType,
      0x00,
    ]);
    await this._delay(50);

    await this._sendMessage(MSG_CHANNEL_RF_FREQ, [channel, frequency]);
    await this._delay(50);

    const periodLow = period & 0xFF;
    const periodHigh = (period >> 8) & 0xFF;
    await this._sendMessage(MSG_CHANNEL_PERIOD, [channel, periodLow, periodHigh]);
    await this._delay(50);

    await this._sendMessage(MSG_CHANNEL_SEARCH_TIMEOUT, [channel, 30]);
    await this._delay(50);

    await this._sendMessage(MSG_OPEN_CHANNEL, [channel]);
  }

  async _sendMessage(msgId, data) {
    const len = data.length;
    const msg = new Uint8Array(len + 4);
    msg[0] = ANT_SYNC;
    msg[1] = len;
    msg[2] = msgId;
    for (let i = 0; i < len; i++) msg[3 + i] = data[i];

    let checksum = 0;
    for (let i = 0; i < msg.length - 1; i++) checksum ^= msg[i];
    msg[msg.length - 1] = checksum;

    await this._device.transferOut(this._epOut.endpointNumber, msg);
  }

  async _readLoop() {
    while (this._reading) {
      try {
        const result = await this._device.transferIn(this._epIn.endpointNumber, 64);
        if (result.data && result.data.byteLength > 0) {
          this._processIncoming(new Uint8Array(result.data.buffer));
        }
      } catch (err) {
        if (this._reading) {
          this._reading = false;
          this._connected = false;
          this._emitStatus('disconnected', 'ANT+ dongle disconnected');
        }
        break;
      }
    }
  }

  _processIncoming(data) {
    const combined = new Uint8Array(this._rxBuffer.length + data.length);
    combined.set(this._rxBuffer);
    combined.set(data, this._rxBuffer.length);
    this._rxBuffer = combined;

    while (this._rxBuffer.length >= 5) {
      const syncIdx = this._rxBuffer.indexOf(ANT_SYNC);
      if (syncIdx === -1) {
        this._rxBuffer = new Uint8Array(0);
        return;
      }
      if (syncIdx > 0) {
        this._rxBuffer = this._rxBuffer.slice(syncIdx);
      }

      if (this._rxBuffer.length < 4) return;

      const msgLen = this._rxBuffer[1];
      const totalLen = msgLen + 4;

      if (this._rxBuffer.length < totalLen) return;

      const packet = this._rxBuffer.slice(0, totalLen);
      this._rxBuffer = this._rxBuffer.slice(totalLen);

      let checksum = 0;
      for (let i = 0; i < packet.length - 1; i++) checksum ^= packet[i];

      if (checksum === packet[packet.length - 1]) {
        this._handleMessage(packet[2], packet.slice(3, 3 + msgLen));
      }
    }
  }

  _handleMessage(msgId, data) {
    if (msgId === MSG_BROADCAST_DATA || msgId === MSG_ACKNOWLEDGED_DATA) {
      const channel = data[0];
      const payload = data.slice(1);

      if (channel === FEC_CHANNEL) {
        this._handleFECData(payload);
      } else if (channel === HR_CHANNEL) {
        this._handleHRData(payload);
      }
    } else if (msgId === MSG_CHANNEL_EVENT) {
      const channel = data[0];
      const eventCode = data.length > 2 ? data[2] : data[1];
      this._handleChannelEvent(channel, eventCode);
    }
  }

  _handleChannelEvent(channel, eventCode) {
    if (eventCode === 0x07) {
      if (channel === FEC_CHANNEL && !this._fecFound) {
        this._emitStatus('connecting', 'Searching for ANT+ FE-C trainer...');
      }
      if (channel === HR_CHANNEL && !this._hrFound) {
        this._emitStatus('connecting', 'Searching for ANT+ HR strap...');
      }
    } else if (eventCode === 0x01) {
      if (channel === FEC_CHANNEL) {
        this._fecFound = false;
        this._emitStatus('disconnected', 'ANT+ FE-C search timeout');
      }
      if (channel === HR_CHANNEL) {
        this._hrFound = false;
        this._hrConnected = false;
      }
    }
  }

  _handleFECData(payload) {
    if (!this._fecFound) {
      this._fecFound = true;
      this._emitStatus('connected', 'ANT+ FE-C Trainer connected');
    }

    const page = payload[0];

    if (page === FEC_PAGE_GENERAL) {
      const speedRaw = payload[4] | (payload[5] << 8);
      this._latestData.speed = (speedRaw * 0.001) * 3.6;
    }

    if (page === FEC_PAGE_TRAINER_DATA) {
      const eventCount = payload[1];
      const cadence = payload[2];
      const accumPower = payload[3] | (payload[4] << 8);
      const instantPower = (payload[5] | (payload[6] << 8)) & 0x0FFF;

      this._latestData.power = instantPower;
      if (cadence !== 0xFF) {
        this._latestData.cadence = cadence;
      }
    }

    if (page === FEC_PAGE_GENERAL_SETTINGS) {
      const cadence = payload[2];
      if (cadence !== 0xFF) {
        this._latestData.cadence = cadence;
      }
    }

    if (this._onData) this._onData({ ...this._latestData });
  }

  _handleHRData(payload) {
    if (!this._hrFound) {
      this._hrFound = true;
      this._hrConnected = true;
      this._emitStatus('hr_connected', 'ANT+ HR strap connected');
    }

    const heartRate = payload[7];
    if (heartRate > 0 && heartRate < 255) {
      this._latestData.heartRate = heartRate;
      if (this._onData) this._onData({ ...this._latestData });
    }
  }

  async setSimulationParameters(gradientPercent, windSpeed = 0, crr = 0.004, cw = 0.51) {
    if (!this._connected || !this._fecFound) return;

    const now = Date.now();
    if (this._lastGradientSent !== null &&
        Math.abs(gradientPercent - this._lastGradientSent) < 0.1 &&
        now - this._lastGradientTime < 1000) {
      return;
    }

    const grade = Math.round((gradientPercent + 200) / 0.01);
    const gradeLow = grade & 0xFF;
    const gradeHigh = (grade >> 8) & 0xFF;
    const crrVal = Math.round(crr / 0.00005);
    const cwVal = Math.round(cw / 0.01);

    const payload = [
      FEC_PAGE_TRACK_RESISTANCE,
      0xFF, 0xFF, 0xFF, 0xFF,
      gradeLow, gradeHigh,
      crrVal,
    ];

    await this._sendAcknowledged(FEC_CHANNEL, payload);
    this._lastGradientSent = gradientPercent;
    this._lastGradientTime = now;
  }

  async setResistanceLevel(level) {
    if (!this._connected || !this._fecFound) return;

    const resistance = Math.round((level / 100) * 200);

    const payload = [
      0x30,
      0xFF, 0xFF, 0xFF, 0xFF, 0xFF,
      resistance & 0xFF,
      (resistance >> 8) & 0xFF,
    ];

    await this._sendAcknowledged(FEC_CHANNEL, payload);
  }

  async _sendAcknowledged(channel, payload) {
    while (payload.length < 8) payload.push(0xFF);

    const data = [channel, ...payload.slice(0, 8)];
    await this._sendMessage(MSG_ACKNOWLEDGED_DATA, data);
  }

  disconnect() {
    this._reading = false;
    if (this._device) {
      try {
        this._sendMessage(MSG_CLOSE_CHANNEL, [FEC_CHANNEL]);
        this._sendMessage(MSG_CLOSE_CHANNEL, [HR_CHANNEL]);
      } catch {}
      try {
        this._device.releaseInterface(this._iface.interfaceNumber);
        this._device.close();
      } catch {}
    }
    this._connected = false;
    this._hrConnected = false;
    this._fecFound = false;
    this._hrFound = false;
  }

  _emitStatus(state, message) {
    if (this._onStatus) this._onStatus({ state, message });
  }

  _delay(ms) {
    return new Promise(r => setTimeout(r, ms));
  }
}
