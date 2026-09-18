export function formatTime(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function formatDistance(meters) {
  return (meters / 1000).toFixed(2);
}

export function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

export function lerp(a, b, t) {
  return a + (b - a) * clamp(t, 0, 1);
}

export function smoothValue(current, target, factor) {
  return current + (target - current) * factor;
}

export function getPowerZone(power, ftp) {
  if (ftp <= 0) return { zone: 1, color: '#8b8b8b', name: 'Recovery' };
  const pct = (power / ftp) * 100;
  if (pct < 55) return { zone: 1, color: '#8b8b8b', name: 'Recovery' };
  if (pct < 75) return { zone: 2, color: '#3b82f6', name: 'Endurance' };
  if (pct < 90) return { zone: 3, color: '#22c55e', name: 'Tempo' };
  if (pct < 105) return { zone: 4, color: '#eab308', name: 'Threshold' };
  if (pct < 120) return { zone: 5, color: '#f97316', name: 'VO2max' };
  if (pct < 150) return { zone: 6, color: '#ef4444', name: 'Anaerobic' };
  return { zone: 7, color: '#a855f7', name: 'Neuromuscular' };
}
