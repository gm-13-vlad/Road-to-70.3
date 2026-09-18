const KEY = 'rtProfiles';

const AVATAR_COLORS = [
  '#ff6b35', '#3b82f6', '#22c55e', '#a855f7',
  '#06b6d4', '#eab308', '#ec4899', '#f97316',
];

const DEFAULTS = { ftp: 200, riderWeight: 75, bikeWeight: 10 };

function newId() {
  return 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function read() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.profiles) && parsed.profiles.length) return parsed;
    }
  } catch {
    // fall through to migration / defaults
  }
  return null;
}

function write(state) {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // storage unavailable — keep working in memory for this session
  }
}

// Earlier versions stored a single rider's numbers as loose keys. Fold those
// into a first profile so an existing user keeps their settings.
function migrate() {
  let ftp = DEFAULTS.ftp;
  let riderWeight = DEFAULTS.riderWeight;
  let bikeWeight = DEFAULTS.bikeWeight;
  try {
    ftp = parseInt(localStorage.getItem('ftp')) || ftp;
    riderWeight = parseFloat(localStorage.getItem('riderWeight')) || riderWeight;
    bikeWeight = parseFloat(localStorage.getItem('bikeWeight')) || bikeWeight;
  } catch {
    // ignore
  }

  const profile = {
    id: newId(), name: 'Rider 1',
    ftp, riderWeight, bikeWeight,
    color: AVATAR_COLORS[0],
  };
  const state = { profiles: [profile], activeId: profile.id };
  write(state);
  return state;
}

let _state = null;

function state() {
  if (!_state) _state = read() || migrate();
  return _state;
}

export function listProfiles() {
  return state().profiles;
}

export function getActive() {
  const s = state();
  return s.profiles.find(p => p.id === s.activeId) || s.profiles[0];
}

export function setActive(id) {
  const s = state();
  if (s.profiles.some(p => p.id === id)) {
    s.activeId = id;
    write(s);
  }
  return getActive();
}

export function addProfile(fields) {
  const s = state();
  const profile = {
    id: newId(),
    name: (fields.name || '').trim() || `Rider ${s.profiles.length + 1}`,
    ftp: clampNum(fields.ftp, 50, 600, DEFAULTS.ftp),
    riderWeight: clampNum(fields.riderWeight, 30, 200, DEFAULTS.riderWeight),
    bikeWeight: clampNum(fields.bikeWeight, 3, 30, DEFAULTS.bikeWeight),
    color: AVATAR_COLORS[s.profiles.length % AVATAR_COLORS.length],
  };
  s.profiles.push(profile);
  s.activeId = profile.id;
  write(s);
  return profile;
}

export function updateProfile(id, fields) {
  const s = state();
  const p = s.profiles.find(x => x.id === id);
  if (!p) return null;
  if (fields.name !== undefined) p.name = String(fields.name).trim() || p.name;
  if (fields.ftp !== undefined) p.ftp = clampNum(fields.ftp, 50, 600, p.ftp);
  if (fields.riderWeight !== undefined) p.riderWeight = clampNum(fields.riderWeight, 30, 200, p.riderWeight);
  if (fields.bikeWeight !== undefined) p.bikeWeight = clampNum(fields.bikeWeight, 3, 30, p.bikeWeight);
  write(s);
  return p;
}

export function deleteProfile(id) {
  const s = state();
  if (s.profiles.length <= 1) return false;
  s.profiles = s.profiles.filter(p => p.id !== id);
  if (s.activeId === id) s.activeId = s.profiles[0].id;
  write(s);
  return true;
}

export function initials(name) {
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function wattsPerKg(profile) {
  if (!profile || !profile.riderWeight) return 0;
  return profile.ftp / profile.riderWeight;
}

function clampNum(v, min, max, fallback) {
  const n = parseFloat(v);
  if (!isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}
