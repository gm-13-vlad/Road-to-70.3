import { getPowerZone } from './utils.js';

export class WorkoutRenderer {
  constructor(canvas, compact = false) {
    this._canvas = canvas;
    this._ctx = canvas.getContext('2d');
    this._workout = null;
    this._total = 0;
    this._peak = 1.2;
    this._compact = compact;
    this._dpr = window.devicePixelRatio || 1;
    this._onResize = () => this._resize();
    this._resize();
    window.addEventListener('resize', this._onResize);
  }

  destroy() {
    window.removeEventListener('resize', this._onResize);
  }

  setCompact(compact) {
    this._compact = compact;
    this._resize();
  }

  _resize() {
    const rect = this._canvas.parentElement.getBoundingClientRect();
    this._canvas.width = rect.width * this._dpr;
    this._canvas.height = rect.height * this._dpr;
    this._canvas.style.width = rect.width + 'px';
    this._canvas.style.height = rect.height + 'px';
    this._ctx.setTransform(this._dpr, 0, 0, this._dpr, 0, 0);
    this._width = rect.width;
    this._height = rect.height;
    if (this._workout) this.render(this._elapsed || 0);
  }

  setWorkout(workout, ftp) {
    this._workout = workout;
    this._ftp = ftp;
    this._total = workout.intervals.reduce((s, iv) => s + iv.d, 0);
    let peak = 0;
    for (const iv of workout.intervals) {
      peak = Math.max(peak, iv.p || 0, iv.p2 || 0);
    }
    this._peak = Math.max(1.2, peak * 1.15);
    this.render(0);
  }

  render(elapsed) {
    this._elapsed = elapsed;
    const ctx = this._ctx;
    const w = this._width;
    const h = this._height;

    ctx.clearRect(0, 0, w, h);

    if (!this._compact) {
      const bg = ctx.createLinearGradient(0, 0, 0, h);
      bg.addColorStop(0, '#0c1424');
      bg.addColorStop(1, '#0a0f1a');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);
    }

    if (!this._workout) return;

    const margin = this._compact
      ? { top: 8, bottom: 10, left: 0, right: 0 }
      : { top: 34, bottom: 34, left: 0, right: 0 };
    const plotH = h - margin.top - margin.bottom;
    const toX = (t) => (t / this._total) * w;
    const toY = (pct) => margin.top + plotH - (pct / this._peak) * plotH;

    if (!this._compact) this._drawFtpLine(ctx, w, toY);

    let acc = 0;
    for (const iv of this._workout.intervals) {
      const x0 = toX(acc);
      const x1 = toX(acc + iv.d);
      const bw = Math.max(1, x1 - x0);

      if (iv.t === 'free') {
        ctx.fillStyle = 'rgba(139, 149, 168, 0.25)';
        ctx.fillRect(x0, margin.top, bw, plotH);
        ctx.strokeStyle = 'rgba(139, 149, 168, 0.5)';
        ctx.setLineDash([3, 3]);
        ctx.lineWidth = 1;
        ctx.strokeRect(x0 + 0.5, margin.top + 0.5, bw - 1, plotH - 1);
        ctx.setLineDash([]);
      } else if (iv.t === 'ramp') {
        const yStart = toY(iv.p);
        const yEnd = toY(iv.p2);
        ctx.beginPath();
        ctx.moveTo(x0, h - margin.bottom);
        ctx.lineTo(x0, yStart);
        ctx.lineTo(x1, yEnd);
        ctx.lineTo(x1, h - margin.bottom);
        ctx.closePath();
        ctx.fillStyle = this._zoneColor((iv.p + iv.p2) / 2, 0.75);
        ctx.fill();
        ctx.strokeStyle = this._zoneColor((iv.p + iv.p2) / 2, 1);
        ctx.lineWidth = 1.5;
        ctx.stroke();
      } else {
        const y = toY(iv.p);
        ctx.fillStyle = this._zoneColor(iv.p, 0.75);
        ctx.fillRect(x0, y, bw, h - margin.bottom - y);
        ctx.strokeStyle = this._zoneColor(iv.p, 1);
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(x0, y);
        ctx.lineTo(x1, y);
        ctx.stroke();
      }

      acc += iv.d;
    }

    this._drawProgressVeil(ctx, toX(elapsed), h, margin);
    this._drawPlayhead(ctx, toX(elapsed), h, margin);
    if (!this._compact) this._drawTimeAxis(ctx, w, h, margin, toX);
  }

  _drawFtpLine(ctx, w, toY) {
    const y = toY(1.0);
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.22)';
    ctx.lineWidth = 1;
    ctx.setLineDash([6, 5]);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.font = '9px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('FTP', w / 2, y - 5);
  }

  _drawProgressVeil(ctx, x, h, margin) {
    if (x <= 0) return;
    ctx.fillStyle = 'rgba(10, 14, 23, 0.55)';
    ctx.fillRect(0, margin.top, x, h - margin.top - margin.bottom);
  }

  _drawPlayhead(ctx, x, h, margin) {
    ctx.beginPath();
    ctx.moveTo(x, margin.top - 6);
    ctx.lineTo(x, h - margin.bottom);
    ctx.strokeStyle = '#ff6b35';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(x, margin.top - 8, 4, 0, Math.PI * 2);
    ctx.fillStyle = '#ff6b35';
    ctx.fill();
  }

  _drawTimeAxis(ctx, w, h, margin, toX) {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.font = '10px Inter, sans-serif';
    ctx.textAlign = 'center';

    const totalMin = this._total / 60;
    let stepMin;
    if (totalMin <= 40) stepMin = 5;
    else if (totalMin <= 90) stepMin = 10;
    else stepMin = 20;

    for (let m = 0; m <= totalMin; m += stepMin) {
      const x = toX(m * 60);
      ctx.fillText(`${m}'`, x, h - margin.bottom + 18);
      ctx.beginPath();
      ctx.moveTo(x, h - margin.bottom);
      ctx.lineTo(x, h - margin.bottom + 5);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }

  _zoneColor(pct, alpha) {
    if (alpha >= 1) return getPowerZone(pct * 100, 100).color;
    return zoneRgba(pct, alpha);
  }

}

function zoneRgba(pct, alpha) {
  const { color } = getPowerZone(pct * 100, 100);
  const r = parseInt(color.slice(1, 3), 16);
  const g = parseInt(color.slice(3, 5), 16);
  const b = parseInt(color.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function renderWorkoutMini(canvas, workout) {
  const parent = canvas.parentElement;
  if (!parent) return;
  const w = parent.clientWidth;
  const h = parent.clientHeight;
  if (w === 0 || h === 0) return;
  canvas.width = w * 2;
  canvas.height = h * 2;
  const ctx = canvas.getContext('2d');
  ctx.setTransform(2, 0, 0, 2, 0, 0);

  const total = workout.intervals.reduce((s, iv) => s + iv.d, 0);
  let peak = 0;
  for (const iv of workout.intervals) peak = Math.max(peak, iv.p || 0, iv.p2 || 0);
  peak = Math.max(1.2, peak * 1.1);

  let acc = 0;
  for (const iv of workout.intervals) {
    const x0 = (acc / total) * w;
    const x1 = ((acc + iv.d) / total) * w;
    const bw = Math.max(1, x1 - x0);

    if (iv.t === 'free') {
      ctx.fillStyle = 'rgba(139, 149, 168, 0.35)';
      ctx.fillRect(x0, 0, bw, h);
    } else if (iv.t === 'ramp') {
      ctx.beginPath();
      ctx.moveTo(x0, h);
      ctx.lineTo(x0, h - (iv.p / peak) * h);
      ctx.lineTo(x1, h - (iv.p2 / peak) * h);
      ctx.lineTo(x1, h);
      ctx.closePath();
      ctx.fillStyle = zoneRgba((iv.p + iv.p2) / 2, 0.8);
      ctx.fill();
    } else {
      const y = h - (iv.p / peak) * h;
      ctx.fillStyle = zoneRgba(iv.p, 0.8);
      ctx.fillRect(x0, y, bw, h - y);
    }
    acc += iv.d;
  }
}
