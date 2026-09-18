const SEG_LEN = 200;
const SEG_METERS = 10;
const ROAD_WIDTH = 860;
const CAMERA_HEIGHT = 1050;
const DRAW_DISTANCE = 240;
const FOV = 100;
const Y_SCALE = 115;
const LANES = 2;
const FOG_DENSITY = 4.2;
// camera sits right of the centreline so the rider tracks the right-hand lane
// instead of straddling the centre markings
const PLAYER_X = ROAD_WIDTH * 0.45;

const PALETTES = {
  day: {
    skyTop: '#2a6fb5', skyMid: '#6ba8d8', skyLow: '#bcd9ea',
    sun: 'rgba(255, 246, 214, 0.95)', sunGlow: 'rgba(255, 231, 160, 0.35)',
    mountainFar: '#6d8fa8', mountainNear: '#4f7286',
    grassLight: '#4f9e42', grassDark: '#478f3b',
    roadLight: '#4a4e52', roadDark: '#45494d',
    rumbleLight: '#d8d8d8', rumbleDark: '#c0392b',
    lane: '#e8e8e8', fog: '#bcd9ea',
    treeCanopy: '#2f6b33', treeCanopy2: '#3a7d3d', trunk: '#4a3524',
    haze: 'rgba(188, 217, 234, 0.55)',
  },
  golden: {
    skyTop: '#2b4a7a', skyMid: '#d4784a', skyLow: '#f2b46b',
    sun: 'rgba(255, 226, 150, 0.98)', sunGlow: 'rgba(255, 166, 87, 0.45)',
    mountainFar: '#7d6f82', mountainNear: '#54485e',
    grassLight: '#6b7f3a', grassDark: '#5f7333',
    roadLight: '#4d4741', roadDark: '#48423d',
    rumbleLight: '#e0d2bd', rumbleDark: '#b3452c',
    lane: '#f0e4cd', fog: '#f2b46b',
    treeCanopy: '#3d5530', treeCanopy2: '#4a663a', trunk: '#3e2c1d',
    haze: 'rgba(242, 180, 107, 0.5)',
  },
  dusk: {
    skyTop: '#121a3a', skyMid: '#35386b', skyLow: '#7a5c86',
    sun: 'rgba(255, 210, 190, 0.85)', sunGlow: 'rgba(190, 110, 130, 0.35)',
    mountainFar: '#3b3f63', mountainNear: '#2a2c47',
    grassLight: '#2f4536', grassDark: '#2a3e31',
    roadLight: '#3a3c44', roadDark: '#35373f',
    rumbleLight: '#9aa0ad', rumbleDark: '#7d3244',
    lane: '#b9bfc9', fog: '#7a5c86',
    treeCanopy: '#1f3325', treeCanopy2: '#26402c', trunk: '#2a1f16',
    haze: 'rgba(122, 92, 134, 0.5)',
  },
  night: {
    skyTop: '#05070f', skyMid: '#0b1124', skyLow: '#16203d',
    sun: 'rgba(226, 232, 240, 0.9)', sunGlow: 'rgba(160, 180, 220, 0.18)',
    mountainFar: '#141a30', mountainNear: '#0e1222',
    grassLight: '#16241c', grassDark: '#132019',
    roadLight: '#2b2e36', roadDark: '#272a31',
    rumbleLight: '#6b7280', rumbleDark: '#5a2433',
    lane: '#8d94a1', fog: '#16203d',
    treeCanopy: '#101c14', treeCanopy2: '#142218', trunk: '#1a1310',
    haze: 'rgba(22, 32, 61, 0.55)',
  },
};

function paletteForHour(h) {
  if (h >= 6 && h < 9) return PALETTES.golden;
  if (h >= 9 && h < 17) return PALETTES.day;
  if (h >= 17 && h < 20) return PALETTES.golden;
  if (h >= 20 && h < 22) return PALETTES.dusk;
  return PALETTES.night;
}

function hash(n) {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
}

function makePoint() {
  return {
    world: { x: 0, y: 0, z: 0 },
    camera: { x: 0, y: 0, z: 0 },
    screen: { x: 0, y: 0, w: 0, scale: 0 },
  };
}

export class WorldRenderer {
  constructor(canvas) {
    this._canvas = canvas;
    this._ctx = canvas.getContext('2d');
    this._segments = [];
    this._palette = paletteForHour(new Date().getHours());
    this._cameraDepth = 1 / Math.tan((FOV / 2) * Math.PI / 180);
    this._dpr = Math.min(2, window.devicePixelRatio || 1);
    this._bob = 0;
    this._cloudSeed = 7;
    this.bottomInset = 0;
    this._onResize = () => this._resize();
    this._resize();
    window.addEventListener('resize', this._onResize);
  }

  destroy() {
    window.removeEventListener('resize', this._onResize);
  }

  _resize() {
    const rect = this._canvas.parentElement.getBoundingClientRect();
    this._width = Math.max(1, rect.width);
    this._height = Math.max(1, rect.height);
    this._canvas.width = this._width * this._dpr;
    this._canvas.height = this._height * this._dpr;
    this._canvas.style.width = this._width + 'px';
    this._canvas.style.height = this._height + 'px';
    this._ctx.setTransform(this._dpr, 0, 0, this._dpr, 0, 0);
  }

  setRoute(route) {
    this._buildSegments((d) => elevationAt(route, d), route.totalDistance);
  }

  setRolling(lengthM = 40000) {
    this._buildSegments((d) => 40 + 18 * Math.sin(d / 900) + 9 * Math.sin(d / 310), lengthM);
  }

  _buildSegments(elevFn, totalDistance) {
    const count = Math.ceil(totalDistance / SEG_METERS) + DRAW_DISTANCE + 2;
    const segs = new Array(count);

    for (let i = 0; i < count; i++) {
      const d = Math.min(i * SEG_METERS, totalDistance);
      const dNext = Math.min((i + 1) * SEG_METERS, totalDistance);

      const curve =
        2.2 * Math.sin(i * 0.0121) +
        1.5 * Math.sin(i * 0.0287 + 1.3) +
        0.8 * Math.sin(i * 0.0063 + 2.7);

      const seg = {
        index: i,
        curve,
        clip: 0,
        p1: makePoint(),
        p2: makePoint(),
        sprites: [],
      };

      seg.p1.world.z = i * SEG_LEN;
      seg.p2.world.z = (i + 1) * SEG_LEN;
      seg.p1.world.y = elevFn(d) * Y_SCALE;
      seg.p2.world.y = elevFn(dNext) * Y_SCALE;

      if (i % 4 === 0) {
        const r = hash(i);
        seg.sprites.push({
          side: r < 0.5 ? -1 : 1,
          offset: 1.3 + hash(i * 3.7) * 1.6,
          type: r < 0.12 ? 'rock' : r < 0.32 ? 'bush' : 'tree',
          scale: 0.75 + hash(i * 5.1) * 0.75,
        });
      }
      if (i % 5 === 2) {
        seg.sprites.push({
          side: hash(i * 9.3) < 0.5 ? -1 : 1,
          offset: 1.9 + hash(i * 2.2) * 2.6,
          type: hash(i * 8.1) < 0.25 ? 'bush' : 'tree',
          scale: 0.7 + hash(i * 6.6) * 0.8,
        });
      }
      if (i % 9 === 5) {
        seg.sprites.push({
          side: hash(i * 4.4) < 0.5 ? -1 : 1,
          offset: 3.4 + hash(i * 7.2) * 3.2,
          type: 'tree',
          scale: 0.85 + hash(i * 1.9) * 0.9,
        });
      }
      if (i > 0 && i % 100 === 0) {
        seg.sprites.push({ side: 1, offset: 1.25, type: 'sign', scale: 1, km: (i * SEG_METERS) / 1000 });
      }

      segs[i] = seg;
    }

    this._segments = segs;
    this._trackLength = count * SEG_LEN;
  }

  render(distanceM, speedKmh = 0, cadence = 0, dt = 0.016) {
    const ctx = this._ctx;
    const w = this._width;
    const h = this._height;
    const pal = this._palette;

    if (this._segments.length === 0) return;

    const position = Math.max(0, distanceM / SEG_METERS) * SEG_LEN;
    const len = this._segments.length;
    const baseIdx = Math.floor(position / SEG_LEN) % len;
    const basePercent = (position % SEG_LEN) / SEG_LEN;
    const baseSeg = this._segments[baseIdx];

    this._bob += dt * Math.max(0, cadence) / 60 * Math.PI * 2;
    const bobY = Math.sin(this._bob) * Math.min(6, speedKmh * 0.12);

    const cameraY = CAMERA_HEIGHT +
      lerp(baseSeg.p1.world.y, baseSeg.p2.world.y, basePercent) + bobY;

    let x = 0;
    let dx = -(baseSeg.curve * basePercent);
    let maxY = h;

    // horizon estimate for sky/mountain placement
    const horizon = h / 2 - (this._cameraDepth * 0 ) ;
    this._drawSky(ctx, w, h, pal, horizon);
    this._drawMountains(ctx, w, h, pal, horizon, position, cameraY);

    const visibleSprites = [];

    for (let n = 0; n < DRAW_DISTANCE; n++) {
      const idx = (baseIdx + n) % len;
      const seg = this._segments[idx];
      const looped = idx < baseIdx;
      const camZ = position - (looped ? this._trackLength : 0);

      this._project(seg.p1, PLAYER_X - x, cameraY, camZ, w, h);
      this._project(seg.p2, PLAYER_X - x - dx, cameraY, camZ, w, h);

      x += dx;
      dx += seg.curve;

      seg.clip = maxY;

      if (seg.p1.camera.z <= this._cameraDepth) continue;
      if (seg.p2.screen.y >= seg.p1.screen.y) continue;
      if (seg.p2.screen.y >= maxY) continue;

      const fog = fogFactor(n / DRAW_DISTANCE, FOG_DENSITY);
      this._drawSegment(ctx, w, seg, idx, pal, fog);

      if (seg.sprites.length) {
        for (const sp of seg.sprites) visibleSprites.push({ sp, seg });
      }

      maxY = seg.p2.screen.y;
    }

    for (let i = visibleSprites.length - 1; i >= 0; i--) {
      const { sp, seg } = visibleSprites[i];
      this._drawSprite(ctx, w, h, seg, sp, pal);
    }

    this._drawRider(ctx, w, h, speedKmh, pal);
  }

  _project(p, camX, camY, camZ, w, h) {
    p.camera.x = p.world.x - camX;
    p.camera.y = p.world.y - camY;
    p.camera.z = p.world.z - camZ;
    const scale = this._cameraDepth / p.camera.z;
    p.screen.scale = scale;
    // rounded so adjacent segment bands tile exactly — without this the grass
    // fill bleeds a pixel over the nearer segment's road and stripes it green
    p.screen.x = Math.round((w / 2) + (scale * p.camera.x * w / 2));
    p.screen.y = Math.round((h / 2) - (scale * p.camera.y * h / 2));
    p.screen.w = Math.round(scale * ROAD_WIDTH * w / 2);
  }

  _drawSky(ctx, w, h, pal, horizon) {
    const g = ctx.createLinearGradient(0, 0, 0, h * 0.62);
    g.addColorStop(0, pal.skyTop);
    g.addColorStop(0.55, pal.skyMid);
    g.addColorStop(1, pal.skyLow);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    const sunX = w * 0.74;
    const sunY = h * 0.2;
    const glow = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, h * 0.45);
    glow.addColorStop(0, pal.sunGlow);
    glow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, w, h);

    ctx.beginPath();
    ctx.arc(sunX, sunY, Math.max(10, h * 0.045), 0, Math.PI * 2);
    ctx.fillStyle = pal.sun;
    ctx.fill();

    if (pal === PALETTES.night) this._drawStars(ctx, w, h);
    this._drawClouds(ctx, w, h, pal);
  }

  _drawStars(ctx, w, h) {
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    for (let i = 0; i < 70; i++) {
      const x = hash(i * 1.7) * w;
      const y = hash(i * 3.3) * h * 0.5;
      const r = hash(i * 5.9) * 1.2 + 0.3;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  _drawClouds(ctx, w, h, pal) {
    const t = Date.now() * 0.000006;
    ctx.fillStyle = pal === PALETTES.night
      ? 'rgba(200, 212, 235, 0.07)'
      : 'rgba(255, 255, 255, 0.5)';
    for (let i = 0; i < 6; i++) {
      const base = hash(i * 2.3);
      const cx = ((base + t * (0.3 + base * 0.5)) % 1.3 - 0.15) * w;
      const cy = h * (0.06 + hash(i * 4.1) * 0.22);
      const s = h * (0.03 + hash(i * 6.7) * 0.035);
      ctx.beginPath();
      ctx.ellipse(cx, cy, s * 2.6, s, 0, 0, Math.PI * 2);
      ctx.ellipse(cx + s * 1.5, cy + s * 0.2, s * 1.7, s * 0.8, 0, 0, Math.PI * 2);
      ctx.ellipse(cx - s * 1.6, cy + s * 0.25, s * 1.5, s * 0.7, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  _drawMountains(ctx, w, h, pal, horizon, position, cameraY) {
    const shift = position * 0.00016;
    const lift = (cameraY - CAMERA_HEIGHT) * 0.004;
    const baseY = h * 0.52 + lift;

    const layer = (amp, freq, phase, color, yOff) => {
      ctx.beginPath();
      ctx.moveTo(0, h);
      for (let px = 0; px <= w; px += 6) {
        const u = px / w;
        const y = baseY + yOff
          - amp * (0.55 + 0.45 * Math.sin((u * freq + shift + phase) * Math.PI * 2))
          * (0.6 + 0.4 * Math.sin((u * freq * 2.3 + shift * 1.7 + phase) * Math.PI * 2));
        ctx.lineTo(px, y);
      }
      ctx.lineTo(w, h);
      ctx.closePath();
      ctx.fillStyle = color;
      ctx.fill();
    };

    layer(h * 0.16, 1.6, 0, pal.mountainFar, 0);
    layer(h * 0.11, 2.7, 1.4, pal.mountainNear, h * 0.045);

    const haze = ctx.createLinearGradient(0, baseY - h * 0.1, 0, baseY + h * 0.12);
    haze.addColorStop(0, 'rgba(0,0,0,0)');
    haze.addColorStop(1, pal.haze);
    ctx.fillStyle = haze;
    ctx.fillRect(0, baseY - h * 0.1, w, h * 0.25);
  }

  _drawSegment(ctx, w, seg, idx, pal, fog) {
    const p1 = seg.p1.screen;
    const p2 = seg.p2.screen;
    const alt = Math.floor(idx / 3) % 2 === 0;

    const grass = alt ? pal.grassLight : pal.grassDark;
    const road = alt ? pal.roadLight : pal.roadDark;
    const rumble = alt ? pal.rumbleLight : pal.rumbleDark;

    ctx.fillStyle = grass;
    ctx.fillRect(0, p2.y, w, p1.y - p2.y);

    const r1 = p1.w / 6;
    const r2 = p2.w / 6;
    poly(ctx, p1.x - p1.w - r1, p1.y, p1.x - p1.w, p1.y, p2.x - p2.w, p2.y, p2.x - p2.w - r2, p2.y, rumble);
    poly(ctx, p1.x + p1.w + r1, p1.y, p1.x + p1.w, p1.y, p2.x + p2.w, p2.y, p2.x + p2.w + r2, p2.y, rumble);
    poly(ctx, p1.x - p1.w, p1.y, p1.x + p1.w, p1.y, p2.x + p2.w, p2.y, p2.x - p2.w, p2.y, road);

    if (alt) {
      const lw1 = p1.w / 40;
      const lw2 = p2.w / 40;
      for (let l = 1; l < LANES; l++) {
        const lx1 = p1.x - p1.w + (p1.w * 2 / LANES) * l;
        const lx2 = p2.x - p2.w + (p2.w * 2 / LANES) * l;
        poly(ctx, lx1 - lw1, p1.y, lx1 + lw1, p1.y, lx2 + lw2, p2.y, lx2 - lw2, p2.y, pal.lane);
      }
    }

    if (fog < 1) {
      ctx.globalAlpha = 1 - fog;
      ctx.fillStyle = pal.fog;
      ctx.fillRect(0, p2.y, w, p1.y - p2.y);
      ctx.globalAlpha = 1;
    }
  }

  _drawSprite(ctx, w, h, seg, sp, pal) {
    const p = seg.p1.screen;
    const scale = p.scale;
    const x = p.x + scale * sp.side * sp.offset * ROAD_WIDTH * w / 2;
    const y = p.y;
    if (y > seg.clip + 2) return;
    if (x < -w * 0.5 || x > w * 1.5) return;

    const size = scale * h * 620 * (sp.scale || 1);
    if (size < 2) return;

    const fog = Math.min(1, Math.max(0, (seg.clip - y) / (h * 0.9) + 0.25));
    ctx.globalAlpha = Math.min(1, 0.35 + fog);

    if (sp.type === 'tree') this._drawTree(ctx, x, y, size, pal);
    else if (sp.type === 'bush') this._drawBush(ctx, x, y, size * 0.4, pal);
    else if (sp.type === 'rock') this._drawRock(ctx, x, y, size * 0.32);
    else if (sp.type === 'sign') this._drawSign(ctx, x, y, size * 0.5, sp.km, pal);

    ctx.globalAlpha = 1;
  }

  _drawTree(ctx, x, baseY, hgt, pal) {
    const tw = Math.max(1, hgt * 0.09);
    ctx.fillStyle = pal.trunk;
    ctx.fillRect(x - tw / 2, baseY - hgt * 0.34, tw, hgt * 0.34);

    ctx.fillStyle = pal.treeCanopy;
    ctx.beginPath();
    ctx.moveTo(x, baseY - hgt);
    ctx.lineTo(x + hgt * 0.30, baseY - hgt * 0.52);
    ctx.lineTo(x - hgt * 0.30, baseY - hgt * 0.52);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = pal.treeCanopy2;
    ctx.beginPath();
    ctx.moveTo(x, baseY - hgt * 0.78);
    ctx.lineTo(x + hgt * 0.34, baseY - hgt * 0.30);
    ctx.lineTo(x - hgt * 0.34, baseY - hgt * 0.30);
    ctx.closePath();
    ctx.fill();
  }

  _drawBush(ctx, x, baseY, size, pal) {
    ctx.fillStyle = pal.treeCanopy;
    ctx.beginPath();
    ctx.ellipse(x, baseY - size * 0.4, size * 0.7, size * 0.45, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = pal.treeCanopy2;
    ctx.beginPath();
    ctx.ellipse(x + size * 0.3, baseY - size * 0.3, size * 0.45, size * 0.3, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  _drawRock(ctx, x, baseY, size) {
    ctx.fillStyle = '#6b6f75';
    ctx.beginPath();
    ctx.moveTo(x - size, baseY);
    ctx.lineTo(x - size * 0.45, baseY - size * 0.9);
    ctx.lineTo(x + size * 0.35, baseY - size * 0.75);
    ctx.lineTo(x + size, baseY);
    ctx.closePath();
    ctx.fill();
  }

  _drawSign(ctx, x, baseY, size, km, pal) {
    const postW = Math.max(1, size * 0.08);
    ctx.fillStyle = '#8a8f98';
    ctx.fillRect(x - postW / 2, baseY - size, postW, size);

    const bw = size * 0.95;
    const bh = size * 0.45;
    ctx.fillStyle = '#1b5e9c';
    ctx.fillRect(x - bw / 2, baseY - size - bh * 0.55, bw, bh);
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.lineWidth = Math.max(0.5, size * 0.02);
    ctx.strokeRect(x - bw / 2, baseY - size - bh * 0.55, bw, bh);

    if (bh > 9) {
      ctx.fillStyle = '#fff';
      ctx.font = `700 ${Math.round(bh * 0.55)}px Inter, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${km}`, x, baseY - size - bh * 0.32);
      ctx.textBaseline = 'alphabetic';
    }
  }

  _drawRider(ctx, w, h, speedKmh, pal) {
    const ground = h - this.bottomInset;
    const s = Math.min(h * 0.17, ground * 0.30);
    const cx = w / 2;
    const baseY = ground - 4;
    const sway = Math.sin(this._bob) * s * 0.03;
    const lean = Math.sin(this._bob) * 0.012;

    ctx.save();
    ctx.translate(cx + sway, baseY);
    ctx.rotate(lean);

    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(0, 0, s * 0.3, s * 0.05, 0, 0, Math.PI * 2);
    ctx.fill();

    // rear wheel
    const wr = s * 0.23;
    ctx.strokeStyle = '#16191f';
    ctx.lineWidth = Math.max(1.4, s * 0.05);
    ctx.beginPath();
    ctx.ellipse(0, -wr, wr * 0.46, wr, 0, 0, Math.PI * 2);
    ctx.stroke();

    // seat tube up to saddle
    ctx.strokeStyle = '#2a2f38';
    ctx.lineWidth = Math.max(1.4, s * 0.055);
    ctx.beginPath();
    ctx.moveTo(0, -wr * 1.2);
    ctx.lineTo(0, -s * 0.52);
    ctx.stroke();

    // pedalling legs
    const ph = Math.sin(this._bob);
    ctx.strokeStyle = '#d9d2c4';
    ctx.lineWidth = Math.max(1.6, s * 0.085);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-s * 0.1, -s * 0.5);
    ctx.lineTo(-s * 0.13, -s * 0.2 + ph * s * 0.07);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(s * 0.1, -s * 0.5);
    ctx.lineTo(s * 0.13, -s * 0.2 - ph * s * 0.07);
    ctx.stroke();

    // torso, hunched over the bars
    ctx.fillStyle = '#e6533c';
    ctx.beginPath();
    ctx.moveTo(-s * 0.17, -s * 0.5);
    ctx.quadraticCurveTo(0, -s * 0.56, s * 0.17, -s * 0.5);
    ctx.lineTo(s * 0.14, -s * 0.84);
    ctx.quadraticCurveTo(0, -s * 0.92, -s * 0.14, -s * 0.84);
    ctx.closePath();
    ctx.fill();

    // arms reaching to the bars
    ctx.strokeStyle = '#e6533c';
    ctx.lineWidth = Math.max(1.5, s * 0.075);
    ctx.beginPath();
    ctx.moveTo(-s * 0.14, -s * 0.8);
    ctx.lineTo(-s * 0.26, -s * 0.62);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(s * 0.14, -s * 0.8);
    ctx.lineTo(s * 0.26, -s * 0.62);
    ctx.stroke();

    // handlebars
    ctx.strokeStyle = '#1d2128';
    ctx.lineWidth = Math.max(1.2, s * 0.05);
    ctx.beginPath();
    ctx.moveTo(-s * 0.29, -s * 0.6);
    ctx.lineTo(s * 0.29, -s * 0.6);
    ctx.stroke();

    // helmet
    ctx.fillStyle = '#15181e';
    ctx.beginPath();
    ctx.ellipse(0, -s * 0.93, s * 0.115, s * 0.085, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.lineCap = 'butt';
    ctx.restore();
  }
}

function elevationAt(route, distance) {
  const pts = route.points;
  if (!pts || pts.length === 0) return 0;
  if (distance <= 0) return pts[0].elevation;
  const last = pts[pts.length - 1];
  if (distance >= last.distance) return last.elevation;

  let lo = 0, hi = pts.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (pts[mid].distance <= distance) lo = mid; else hi = mid;
  }
  const span = pts[hi].distance - pts[lo].distance;
  if (span === 0) return pts[lo].elevation;
  const t = (distance - pts[lo].distance) / span;
  return pts[lo].elevation + (pts[hi].elevation - pts[lo].elevation) * t;
}

function lerp(a, b, t) { return a + (b - a) * t; }

function fogFactor(d, density) {
  return 1 / Math.pow(Math.E, d * d * density);
}

function poly(ctx, x1, y1, x2, y2, x3, y3, x4, y4, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.lineTo(x3, y3);
  ctx.lineTo(x4, y4);
  ctx.closePath();
  ctx.fill();
}
