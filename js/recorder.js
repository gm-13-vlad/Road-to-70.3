const HISTORY_KEY = 'rideHistory';
const MAX_RIDES = 25;
const MAX_STORED_SAMPLES = 2000;

export class RideRecorder {
  constructor() {
    this._samples = [];
    this._startedAt = null;
    this._lastSampleTime = -1;
  }

  start() {
    this._samples = [];
    this._startedAt = new Date();
    this._lastSampleTime = -1;
  }

  get sampleCount() { return this._samples.length; }
  get samples() { return this._samples; }
  get startedAt() { return this._startedAt; }

  record(elapsedSec, data) {
    const bucket = Math.floor(elapsedSec);
    if (bucket <= this._lastSampleTime) return;
    this._lastSampleTime = bucket;

    this._samples.push({
      t: bucket,
      d: Math.round(data.distance),
      e: Math.round(data.elevation * 10) / 10,
      p: Math.round(data.power),
      c: Math.round(data.cadence),
      h: Math.round(data.heartRate),
      s: Math.round(data.speed * 10) / 10,
      g: Math.round(data.gradient * 10) / 10,
    });
  }

  buildRide(meta) {
    return {
      id: `ride-${this._startedAt ? this._startedAt.getTime() : Date.now()}`,
      startedAt: (this._startedAt || new Date()).toISOString(),
      ...meta,
      samples: downsample(this._samples, MAX_STORED_SAMPLES),
    };
  }
}

function downsample(samples, maxPoints) {
  if (samples.length <= maxPoints) return samples;
  const step = samples.length / maxPoints;
  const out = [];
  for (let i = 0; i < maxPoints; i++) {
    out.push(samples[Math.floor(i * step)]);
  }
  out.push(samples[samples.length - 1]);
  return out;
}

export function loadHistory() {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveRide(ride) {
  let history = loadHistory();
  history.unshift(ride);
  if (history.length > MAX_RIDES) history = history.slice(0, MAX_RIDES);

  while (history.length > 0) {
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
      return true;
    } catch {
      history.pop();
    }
  }
  return false;
}

export function deleteRide(id) {
  const history = loadHistory().filter(r => r.id !== id);
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  } catch {
    // storage unavailable
  }
}

function escapeXml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function buildTCX(ride) {
  const start = new Date(ride.startedAt);
  const startIso = start.toISOString().replace(/\.\d{3}Z$/, 'Z');
  const samples = ride.samples || [];

  let maxSpeedMs = 0;
  let maxHr = 0;
  for (const s of samples) {
    const ms = s.s / 3.6;
    if (ms > maxSpeedMs) maxSpeedMs = ms;
    if (s.h > maxHr) maxHr = s.h;
  }

  const trackpoints = samples.map(s => {
    const time = new Date(start.getTime() + s.t * 1000)
      .toISOString().replace(/\.\d{3}Z$/, 'Z');
    const hr = s.h > 0
      ? `\n        <HeartRateBpm><Value>${s.h}</Value></HeartRateBpm>`
      : '';
    const cad = s.c > 0 ? `\n        <Cadence>${Math.min(254, s.c)}</Cadence>` : '';
    return `      <Trackpoint>
        <Time>${time}</Time>
        <AltitudeMeters>${s.e}</AltitudeMeters>
        <DistanceMeters>${s.d}</DistanceMeters>${hr}${cad}
        <Extensions>
          <TPX xmlns="http://www.garmin.com/xmlschemas/ActivityExtension/v2">
            <Speed>${(s.s / 3.6).toFixed(2)}</Speed>
            <Watts>${s.p}</Watts>
          </TPX>
        </Extensions>
      </Trackpoint>`;
  }).join('\n');

  const avgHrBlock = ride.avgHR > 0
    ? `\n      <AverageHeartRateBpm><Value>${ride.avgHR}</Value></AverageHeartRateBpm>
      <MaximumHeartRateBpm><Value>${maxHr}</Value></MaximumHeartRateBpm>`
    : '';

  return `<?xml version="1.0" encoding="UTF-8"?>
<TrainingCenterDatabase
  xsi:schemaLocation="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2 http://www.garmin.com/xmlschemas/TrainingCenterDatabasev2.xsd"
  xmlns="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <Activities>
    <Activity Sport="Biking">
      <Id>${startIso}</Id>
      <Lap StartTime="${startIso}">
        <TotalTimeSeconds>${Math.round(ride.durationSec)}</TotalTimeSeconds>
        <DistanceMeters>${Math.round(ride.distanceM)}</DistanceMeters>
        <MaximumSpeed>${maxSpeedMs.toFixed(2)}</MaximumSpeed>
        <Calories>${Math.round(ride.calories)}</Calories>${avgHrBlock}
        <Intensity>Active</Intensity>
        <Cadence>${Math.min(254, ride.avgCadence || 0)}</Cadence>
        <TriggerMethod>Manual</TriggerMethod>
        <Track>
${trackpoints}
        </Track>
        <Extensions>
          <LX xmlns="http://www.garmin.com/xmlschemas/ActivityExtension/v2">
            <AvgWatts>${ride.avgPower}</AvgWatts>
            <MaxWatts>${ride.maxPower}</MaxWatts>
          </LX>
        </Extensions>
      </Lap>
      <Notes>${escapeXml(ride.profileName ? `${ride.title} — ${ride.profileName}` : (ride.title || 'Road to 70.3'))}</Notes>
      <Creator xsi:type="Device_t">
        <Name>Road to 70.3</Name>
        <UnitId>0</UnitId>
        <ProductID>703</ProductID>
      </Creator>
    </Activity>
  </Activities>
</TrainingCenterDatabase>
`;
}

export function downloadTCX(ride) {
  const xml = buildTCX(ride);
  const blob = new Blob([xml], { type: 'application/vnd.garmin.tcx+xml' });
  const url = URL.createObjectURL(blob);
  const slug = (ride.title || 'ride').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const date = ride.startedAt.slice(0, 10);

  const a = document.createElement('a');
  a.href = url;
  a.download = `road-to-70-3-${date}-${slug}.tcx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
