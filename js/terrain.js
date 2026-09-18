export class TerrainRenderer {
  constructor(canvas) {
    this._canvas = canvas;
    this._ctx = canvas.getContext('2d');
    this._route = null;
    this._progress = 0;
    this._currentElevation = 0;
    this._dpr = window.devicePixelRatio || 1;
    this._resize();
    window.addEventListener('resize', () => this._resize());
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
    if (this._route) this.render(this._progress);
  }

  setRoute(route) {
    this._route = route;
    this._computeMinMax();
    this.render(0);
  }

  _computeMinMax() {
    if (!this._route) return;
    const points = this._route.points;
    this._minElev = Infinity;
    this._maxElev = -Infinity;
    for (const p of points) {
      if (p.elevation < this._minElev) this._minElev = p.elevation;
      if (p.elevation > this._maxElev) this._maxElev = p.elevation;
    }
    const elevRange = this._maxElev - this._minElev;
    this._minElev -= elevRange * 0.15;
    this._maxElev += elevRange * 0.15;
    if (this._maxElev - this._minElev < 20) {
      this._minElev -= 10;
      this._maxElev += 10;
    }
  }

  render(progress) {
    this._progress = progress;
    const ctx = this._ctx;
    const w = this._width;
    const h = this._height;

    ctx.clearRect(0, 0, w, h);

    this._drawSky(ctx, w, h);

    if (!this._route) return;

    this._drawElevationProfile(ctx, w, h, progress);
    this._drawRiderMarker(ctx, w, h, progress);
    this._drawDistanceMarkers(ctx, w, h);
  }

  _drawSky(ctx, w, h) {
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, '#0c1929');
    grad.addColorStop(0.4, '#132744');
    grad.addColorStop(0.7, '#1a3a5c');
    grad.addColorStop(1, '#0a1520');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    const starSeed = 42;
    for (let i = 0; i < 60; i++) {
      const x = ((starSeed * (i + 1) * 7919) % 10000) / 10000 * w;
      const y = ((starSeed * (i + 1) * 6271) % 10000) / 10000 * (h * 0.4);
      const size = ((i * 3571) % 3) * 0.5 + 0.5;
      ctx.beginPath();
      ctx.arc(x, y, size, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  _drawElevationProfile(ctx, w, h, progress) {
    const points = this._route.points;
    const totalDist = this._route.totalDistance;
    const elevRange = this._maxElev - this._minElev;
    const margin = { top: 40, bottom: 50, left: 0, right: 0 };
    const plotW = w - margin.left - margin.right;
    const plotH = h - margin.top - margin.bottom;

    const toX = (d) => margin.left + (d / totalDist) * plotW;
    const toY = (e) => margin.top + plotH - ((e - this._minElev) / elevRange) * plotH;

    const riderX = toX(progress * totalDist);

    // Completed fill
    ctx.beginPath();
    ctx.moveTo(margin.left, toY(points[0].elevation));
    for (const p of points) {
      const x = toX(p.distance);
      if (x > riderX) break;
      ctx.lineTo(x, toY(p.elevation));
    }
    ctx.lineTo(riderX, toY(this._getElevAt(progress * totalDist)));
    ctx.lineTo(riderX, h - margin.bottom);
    ctx.lineTo(margin.left, h - margin.bottom);
    ctx.closePath();

    const completedGrad = ctx.createLinearGradient(0, margin.top, 0, h - margin.bottom);
    completedGrad.addColorStop(0, 'rgba(255, 107, 53, 0.5)');
    completedGrad.addColorStop(0.5, 'rgba(255, 107, 53, 0.2)');
    completedGrad.addColorStop(1, 'rgba(255, 107, 53, 0.05)');
    ctx.fillStyle = completedGrad;
    ctx.fill();

    // Upcoming fill
    ctx.beginPath();
    let startedUpcoming = false;
    for (const p of points) {
      const x = toX(p.distance);
      if (x < riderX) continue;
      if (!startedUpcoming) {
        ctx.moveTo(riderX, toY(this._getElevAt(progress * totalDist)));
        startedUpcoming = true;
      }
      ctx.lineTo(x, toY(p.elevation));
    }
    ctx.lineTo(w - margin.right, h - margin.bottom);
    ctx.lineTo(riderX, h - margin.bottom);
    ctx.closePath();

    const upcomingGrad = ctx.createLinearGradient(0, margin.top, 0, h - margin.bottom);
    upcomingGrad.addColorStop(0, 'rgba(6, 182, 212, 0.35)');
    upcomingGrad.addColorStop(0.5, 'rgba(6, 182, 212, 0.12)');
    upcomingGrad.addColorStop(1, 'rgba(6, 182, 212, 0.03)');
    ctx.fillStyle = upcomingGrad;
    ctx.fill();

    // Profile line
    ctx.beginPath();
    ctx.moveTo(toX(points[0].distance), toY(points[0].elevation));
    for (let i = 1; i < points.length; i++) {
      ctx.lineTo(toX(points[i].distance), toY(points[i].elevation));
    }
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Completed portion outline
    ctx.beginPath();
    ctx.moveTo(toX(points[0].distance), toY(points[0].elevation));
    for (const p of points) {
      const x = toX(p.distance);
      if (x > riderX) break;
      ctx.lineTo(x, toY(p.elevation));
    }
    ctx.lineTo(riderX, toY(this._getElevAt(progress * totalDist)));
    ctx.strokeStyle = '#ff6b35';
    ctx.lineWidth = 3;
    ctx.stroke();
  }

  _drawRiderMarker(ctx, w, h, progress) {
    const totalDist = this._route.totalDistance;
    const elevRange = this._maxElev - this._minElev;
    const margin = { top: 40, bottom: 50 };
    const plotH = h - margin.top - margin.bottom;

    const x = (progress * totalDist / totalDist) * w;
    const elev = this._getElevAt(progress * totalDist);
    const y = margin.top + plotH - ((elev - this._minElev) / elevRange) * plotH;

    // Vertical glow line
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x, h - margin.bottom);
    ctx.strokeStyle = 'rgba(255, 107, 53, 0.3)';
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 4]);
    ctx.stroke();
    ctx.setLineDash([]);

    // Glow
    const glow = ctx.createRadialGradient(x, y, 0, x, y, 20);
    glow.addColorStop(0, 'rgba(255, 107, 53, 0.6)');
    glow.addColorStop(1, 'rgba(255, 107, 53, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(x - 20, y - 20, 40, 40);

    // Dot
    ctx.beginPath();
    ctx.arc(x, y, 6, 0, Math.PI * 2);
    ctx.fillStyle = '#ff6b35';
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  _drawDistanceMarkers(ctx, w, h) {
    const totalDist = this._route.totalDistance;
    const margin = { bottom: 50 };
    const y = h - margin.bottom + 20;

    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.font = '10px Inter, sans-serif';
    ctx.textAlign = 'center';

    let interval;
    if (totalDist <= 20000) interval = 2000;
    else if (totalDist <= 50000) interval = 5000;
    else interval = 10000;

    for (let d = 0; d <= totalDist; d += interval) {
      const x = (d / totalDist) * w;
      ctx.fillText(`${(d / 1000).toFixed(0)} km`, x, y);

      ctx.beginPath();
      ctx.moveTo(x, h - margin.bottom);
      ctx.lineTo(x, h - margin.bottom + 5);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }

  _getElevAt(distance) {
    if (!this._route) return 0;
    const points = this._route.points;
    if (distance <= 0) return points[0].elevation;
    if (distance >= points[points.length - 1].distance) return points[points.length - 1].elevation;

    for (let i = 0; i < points.length - 1; i++) {
      if (distance >= points[i].distance && distance <= points[i + 1].distance) {
        const t = (distance - points[i].distance) / (points[i + 1].distance - points[i].distance);
        return points[i].elevation + (points[i + 1].elevation - points[i].elevation) * t;
      }
    }
    return points[points.length - 1].elevation;
  }

  renderMiniProfile(canvas, route) {
    const ctx = canvas.getContext('2d');
    const w = canvas.width = canvas.parentElement.clientWidth;
    const h = canvas.height = canvas.parentElement.clientHeight;

    if (!route || !route.points.length) return;

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
    const toX = (d) => (d / totalDist) * w;
    const toY = (e) => h - ((e - minE) / (maxE - minE + range * 0.2)) * h;

    ctx.beginPath();
    ctx.moveTo(0, toY(points[0].elevation));
    for (const p of points) {
      ctx.lineTo(toX(p.distance), toY(p.elevation));
    }
    ctx.lineTo(w, h);
    ctx.lineTo(0, h);
    ctx.closePath();

    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, 'rgba(6, 182, 212, 0.5)');
    grad.addColorStop(1, 'rgba(6, 182, 212, 0.1)');
    ctx.fillStyle = grad;
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(0, toY(points[0].elevation));
    for (const p of points) {
      ctx.lineTo(toX(p.distance), toY(p.elevation));
    }
    ctx.strokeStyle = 'rgba(6, 182, 212, 0.7)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
}
