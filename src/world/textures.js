import * as THREE from 'three';

export function canvasTexture(size, draw, opts = {}) {
  const c = document.createElement('canvas');
  c.width = opts.w || size;
  c.height = opts.h || size;
  const ctx = c.getContext('2d');
  draw(ctx, c.width, c.height);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = opts.anisotropy !== undefined ? opts.anisotropy : 8;
  return tex;
}

function rawCanvasTexture(canvas, anisotropy = 8) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = anisotropy;
  return tex;
}

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash2(x, y) {
  let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function fade(t) {
  return t * t * (3 - 2 * t);
}

function heightField(size, octaves, seed) {
  const field = new Float32Array(size * size);
  for (let o = 0; o < octaves.length; o++) {
    const grid = octaves[o].grid;
    const amp = octaves[o].amp;
    const rand = mulberry32(seed + o * 7919);
    const lattice = new Float32Array(grid * grid);
    for (let i = 0; i < lattice.length; i++) lattice[i] = rand();
    const step = size / grid;
    for (let y = 0; y < size; y++) {
      const gy = y / step;
      const iy = Math.floor(gy);
      const ty = fade(gy - iy);
      const y0 = iy % grid;
      const y1 = (y0 + 1) % grid;
      const rowA = y0 * grid;
      const rowB = y1 * grid;
      for (let x = 0; x < size; x++) {
        const gx = x / step;
        const ix = Math.floor(gx);
        const tx = fade(gx - ix);
        const x0 = ix % grid;
        const x1 = (x0 + 1) % grid;
        const v00 = lattice[rowA + x0];
        const v10 = lattice[rowA + x1];
        const v01 = lattice[rowB + x0];
        const v11 = lattice[rowB + x1];
        const top = v00 + (v10 - v00) * tx;
        const bot = v01 + (v11 - v01) * tx;
        field[y * size + x] += (top + (bot - top) * ty) * amp;
      }
    }
  }
  return field;
}

function paintHeightShade(ctx, size, field, base, amount, grainAmount) {
  const img = ctx.createImageData(size, size);
  const d = img.data;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const m = (field[y * size + x] - 0.5) * 2;
      const g = (hash2(x, y) - 0.5) * 2 * grainAmount;
      const s = 1 + m * amount + g;
      const i = (y * size + x) * 4;
      d[i] = Math.min(255, base[0] * s);
      d[i + 1] = Math.min(255, base[1] * s);
      d[i + 2] = Math.min(255, base[2] * s);
      d[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
}

function normalsFromHeight(ctx, size, field, strength) {
  const img = ctx.createImageData(size, size);
  const d = img.data;
  for (let y = 0; y < size; y++) {
    const yUp = ((y - 1 + size) % size) * size;
    const yDown = ((y + 1) % size) * size;
    const yRow = y * size;
    for (let x = 0; x < size; x++) {
      const xLeft = (x - 1 + size) % size;
      const xRight = (x + 1) % size;
      const dx = (field[yRow + xRight] - field[yRow + xLeft]) * strength;
      const dy = (field[yDown + x] - field[yUp + x]) * strength;
      const invLen = 1 / Math.sqrt(dx * dx + dy * dy + 1);
      const i = (yRow + x) * 4;
      d[i] = (-dx * invLen * 0.5 + 0.5) * 255;
      d[i + 1] = (dy * invLen * 0.5 + 0.5) * 255;
      d[i + 2] = (invLen * 0.5 + 0.5) * 255;
      d[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
}

function noise(ctx, w, h, n, alpha, light, dark) {
  for (let i = 0; i < n; i++) {
    const x = Math.random() * w;
    const y = Math.random() * h;
    const r = Math.random() * 2.2 + 0.4;
    const l = Math.random();
    ctx.fillStyle = l > 0.5 ? `rgba(${light},${alpha * Math.random()})` : `rgba(${dark},${alpha * Math.random()})`;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
}

function blotches(ctx, w, h, n, colors, minR, maxR, alpha) {
  for (let i = 0; i < n; i++) {
    const x = Math.random() * w;
    const y = Math.random() * h;
    const r = minR + Math.random() * (maxR - minR);
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    const col = colors[(Math.random() * colors.length) | 0];
    g.addColorStop(0, `rgba(${col},${alpha})`);
    g.addColorStop(1, `rgba(${col},0)`);
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
}

export function sandTexture() {
  const size = 1024;
  return canvasTexture(
    size,
    (ctx, w, h) => {
      const field = heightField(size, [
        { grid: 4, amp: 0.5 },
        { grid: 16, amp: 0.3 },
        { grid: 64, amp: 0.2 }
      ], 1337);
      paintHeightShade(ctx, w, field, [200, 161, 101], 0.13, 0.05);
      const rand = mulberry32(9042);
      for (let i = 0; i < 4; i++) {
        const y0 = rand() * h;
        const c1y = y0 + (rand() - 0.5) * 140;
        const c2y = y0 + (rand() - 0.5) * 140;
        for (const off of [-6, 6]) {
          ctx.strokeStyle = 'rgba(96,72,42,0.14)';
          ctx.lineWidth = 5 + rand() * 3;
          ctx.beginPath();
          ctx.moveTo(-24, y0 + off);
          ctx.bezierCurveTo(w * 0.33, c1y + off, w * 0.67, c2y + off, w + 24, y0 + off);
          ctx.stroke();
          ctx.strokeStyle = 'rgba(240,222,176,0.09)';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(-24, y0 + off - 2);
          ctx.bezierCurveTo(w * 0.33, c1y + off - 2, w * 0.67, c2y + off - 2, w + 24, y0 + off - 2);
          ctx.stroke();
        }
      }
      for (let i = 0; i < 26; i++) {
        const cx = rand() * w;
        const cy = rand() * h;
        const spread = 5 + rand() * 14;
        const count = 5 + Math.floor(rand() * 8);
        for (let p = 0; p < count; p++) {
          const a = rand() * Math.PI * 2;
          const rr = Math.sqrt(rand()) * spread;
          const px = cx + Math.cos(a) * rr;
          const py = cy + Math.sin(a) * rr;
          const pr = 0.8 + rand() * 1.1;
          ctx.fillStyle = `rgba(88,64,36,${0.3 + rand() * 0.3})`;
          ctx.beginPath();
          ctx.arc(px, py, pr, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = `rgba(245,228,185,${0.25 + rand() * 0.3})`;
          ctx.fillRect(px - pr * 0.7, py - pr * 0.9, 1, 1);
        }
      }
    },
    { anisotropy: 16 }
  );
}

export function sandNormalTexture(size = 512) {
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d');
  const field = heightField(size, [
    { grid: 4, amp: 0.42 },
    { grid: 16, amp: 0.3 },
    { grid: 96, amp: 0.28 }
  ], 1337);
  normalsFromHeight(ctx, size, field, 2.2);
  return rawCanvasTexture(c);
}

export function concreteTexture() {
  return canvasTexture(512, (ctx, w, h) => {
    ctx.fillStyle = '#98938a';
    ctx.fillRect(0, 0, w, h);
    blotches(ctx, w, h, 30, ['122,118,110', '150,146,138', '106,102,96'], 18, 80, 0.22);
    noise(ctx, w, h, 5200, 0.12, '178,174,166', '100,96,90');
    for (let y = 0; y < h; y += 64) {
      ctx.fillStyle = 'rgba(62,60,56,0.28)';
      ctx.fillRect(0, y, w, 1);
      ctx.fillStyle = 'rgba(235,232,226,0.10)';
      ctx.fillRect(0, y + 1, w, 1);
    }
    const rand = mulberry32(771);
    ctx.lineWidth = 1;
    for (let i = 0; i < 9; i++) {
      let x = rand() * w;
      let y = rand() * h;
      let ang = rand() * Math.PI * 2;
      ctx.strokeStyle = `rgba(66,62,56,${0.26 + rand() * 0.22})`;
      ctx.beginPath();
      ctx.moveTo(x, y);
      const segs = 3 + Math.floor(rand() * 4);
      const branchAt = 1 + Math.floor(rand() * (segs - 1));
      for (let j = 0; j < segs; j++) {
        ang += (rand() - 0.5) * 1.1;
        const len = 14 + rand() * 34;
        x += Math.cos(ang) * len;
        y += Math.sin(ang) * len;
        ctx.lineTo(x, y);
        if (j === branchAt) {
          const bx = x;
          const by = y;
          const bang = ang + (rand() > 0.5 ? 0.9 : -0.9);
          ctx.moveTo(bx + Math.cos(bang) * 10, by + Math.sin(bang) * 10);
          ctx.lineTo(bx + Math.cos(bang) * 26, by + Math.sin(bang) * 26);
          ctx.moveTo(x, y);
        }
      }
      ctx.stroke();
    }
    let g = ctx.createLinearGradient(0, 0, 26, 0);
    g.addColorStop(0, 'rgba(50,46,42,0.26)');
    g.addColorStop(1, 'rgba(50,46,42,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 26, h);
    g = ctx.createLinearGradient(w, 0, w - 26, 0);
    g.addColorStop(0, 'rgba(50,46,42,0.26)');
    g.addColorStop(1, 'rgba(50,46,42,0)');
    ctx.fillStyle = g;
    ctx.fillRect(w - 26, 0, 26, h);
    g = ctx.createLinearGradient(0, 0, 0, 22);
    g.addColorStop(0, 'rgba(44,42,38,0.30)');
    g.addColorStop(1, 'rgba(44,42,38,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, 22);
    g = ctx.createLinearGradient(0, h, 0, h - 30);
    g.addColorStop(0, 'rgba(40,38,34,0.32)');
    g.addColorStop(1, 'rgba(40,38,34,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, h - 30, w, 30);
  });
}

export function concreteNormalTexture(size = 512) {
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d');
  const field = heightField(size, [
    { grid: 8, amp: 0.45 },
    { grid: 32, amp: 0.32 },
    { grid: 128, amp: 0.23 }
  ], 4242);
  const cc = document.createElement('canvas');
  cc.width = size;
  cc.height = size;
  const cctx = cc.getContext('2d');
  cctx.fillStyle = '#000';
  cctx.fillRect(0, 0, size, size);
  const rand = mulberry32(991);
  cctx.strokeStyle = '#fff';
  cctx.lineWidth = 1.4;
  for (let i = 0; i < 9; i++) {
    const pts = [];
    let x = rand() * size;
    let y = rand() * size;
    let ang = rand() * Math.PI * 2;
    pts.push([x, y]);
    const segs = 3 + Math.floor(rand() * 4);
    for (let j = 0; j < segs; j++) {
      ang += (rand() - 0.5) * 1.2;
      const len = size * 0.03 + rand() * size * 0.07;
      x += Math.cos(ang) * len;
      y += Math.sin(ang) * len;
      pts.push([x, y]);
    }
    for (const ox of [-size, 0, size]) {
      for (const oy of [-size, 0, size]) {
        cctx.beginPath();
        cctx.moveTo(pts[0][0] + ox, pts[0][1] + oy);
        for (let p = 1; p < pts.length; p++) cctx.lineTo(pts[p][0] + ox, pts[p][1] + oy);
        cctx.stroke();
      }
    }
  }
  const md = cctx.getImageData(0, 0, size, size).data;
  for (let i = 0; i < size * size; i++) {
    field[i] -= (md[i * 4] / 255) * 0.85;
  }
  normalsFromHeight(ctx, size, field, 3.2);
  return rawCanvasTexture(c);
}

export function corrugatedTexture() {
  return canvasTexture(512, (ctx, w, h) => {
    ctx.fillStyle = '#b8b8b8';
    ctx.fillRect(0, 0, w, h);
    const stripe = 16;
    for (let x = 0; x < w; x += stripe) {
      const g = ctx.createLinearGradient(x, 0, x + stripe, 0);
      g.addColorStop(0, 'rgba(40,40,40,0.42)');
      g.addColorStop(0.4, 'rgba(255,255,255,0.20)');
      g.addColorStop(0.65, 'rgba(255,255,255,0.06)');
      g.addColorStop(1, 'rgba(30,30,30,0.5)');
      ctx.fillStyle = g;
      ctx.fillRect(x, 0, stripe, h);
    }
    for (let sx = 0; sx < w; sx += 128) {
      ctx.fillStyle = 'rgba(22,22,22,0.5)';
      ctx.fillRect(sx - 1, 0, 2, h);
      ctx.fillStyle = 'rgba(255,255,255,0.14)';
      ctx.fillRect(sx + 1, 0, 1, h);
    }
    blotches(ctx, w, h, 30, ['140,74,32', '96,52,24', '168,96,40'], 6, 34, 0.3);
    const rand = mulberry32(5150);
    for (let i = 0; i < 16; i++) {
      const x = rand() * w;
      const dw = 1.5 + rand() * 5;
      const dl = h * (0.3 + rand() * 0.65);
      const col = ['140,74,32', '96,52,24', '118,60,26'][Math.floor(rand() * 3)];
      const g = ctx.createLinearGradient(0, 0, 0, dl);
      g.addColorStop(0, `rgba(${col},${0.34 + rand() * 0.2})`);
      g.addColorStop(0.75, `rgba(${col},${0.1 + rand() * 0.1})`);
      g.addColorStop(1, `rgba(${col},0)`);
      ctx.fillStyle = g;
      ctx.fillRect(x, 0, dw, dl);
    }
    noise(ctx, w, h, 2600, 0.12, '230,230,230', '50,50,50');
    ctx.fillStyle = 'rgba(30,26,22,0.4)';
    ctx.fillRect(0, h - 26, w, 26);
    ctx.fillRect(0, 0, w, 10);
  });
}

export function corrugatedNormalTexture(size = 512) {
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d');
  const field = new Float32Array(size * size);
  const freq = (Math.PI * 2) / 16;
  const grain = heightField(size, [{ grid: 128, amp: 0.08 }], 2024);
  const seams = [];
  for (let sx = 0; sx < size; sx += 128) seams.push(sx);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let hv = Math.sin(x * freq);
      for (const sx of seams) {
        let dxp = x - sx;
        if (dxp > size / 2) dxp -= size;
        if (dxp < -size / 2) dxp += size;
        hv -= Math.exp(-(dxp * dxp) / 18) * 0.7;
      }
      field[y * size + x] = hv + grain[y * size + x];
    }
  }
  normalsFromHeight(ctx, size, field, 5.5);
  return rawCanvasTexture(c);
}

export function woodTexture() {
  return canvasTexture(256, (ctx, w, h) => {
    ctx.fillStyle = '#8f6f45';
    ctx.fillRect(0, 0, w, h);
    const plank = 32;
    for (let y = 0; y < h; y += plank) {
      const tone = 0.85 + Math.random() * 0.3;
      ctx.fillStyle = `rgb(${(143 * tone) | 0},${(111 * tone) | 0},${(69 * tone) | 0})`;
      ctx.fillRect(0, y, w, plank - 2);
      ctx.strokeStyle = 'rgba(52,36,18,0.7)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, y + plank - 1);
      ctx.lineTo(w, y + plank - 1);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(70,50,26,0.35)';
      ctx.lineWidth = 1;
      for (let i = 0; i < 5; i++) {
        const gy = y + 4 + Math.random() * (plank - 8);
        ctx.beginPath();
        ctx.moveTo(Math.random() * w * 0.4, gy);
        ctx.bezierCurveTo(w * 0.4, gy + (Math.random() - 0.5) * 6, w * 0.7, gy + (Math.random() - 0.5) * 6, w, gy);
        ctx.stroke();
      }
    }
    noise(ctx, w, h, 1400, 0.1, '210,180,130', '60,40,20');
  });
}

export function barrelTexture() {
  return canvasTexture(256, (ctx, w, h) => {
    ctx.fillStyle = '#a8281e';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#7e1d15';
    ctx.fillRect(0, h * 0.18, w, 12);
    ctx.fillRect(0, h * 0.78, w, 12);
    blotches(ctx, w, h, 18, ['60,40,28', '140,80,40'], 8, 34, 0.4);
    ctx.fillStyle = '#d8c23c';
    ctx.fillRect(w * 0.34, h * 0.36, w * 0.32, h * 0.26);
    ctx.fillStyle = '#181410';
    ctx.beginPath();
    ctx.moveTo(w * 0.5, h * 0.4);
    ctx.lineTo(w * 0.6, h * 0.58);
    ctx.lineTo(w * 0.4, h * 0.58);
    ctx.closePath();
    ctx.fill();
    ctx.fillRect(w * 0.47, h * 0.53, w * 0.06, h * 0.07);
    noise(ctx, w, h, 900, 0.12, '220,160,140', '40,20,14');
  });
}

export function flagTexture() {
  return canvasTexture(128, (ctx, w, h) => {
    ctx.fillStyle = '#3d4432';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#c9b458';
    ctx.fillRect(0, h * 0.42, w, h * 0.16);
    ctx.fillStyle = '#22271c';
    ctx.beginPath();
    ctx.arc(w * 0.5, h * 0.5, h * 0.13, 0, Math.PI * 2);
    ctx.fill();
    noise(ctx, w, h, 700, 0.14, '150,160,130', '20,24,16');
  });
}

export function tarpTexture() {
  return canvasTexture(128, (ctx, w, h) => {
    ctx.fillStyle = '#5c6e52';
    ctx.fillRect(0, 0, w, h);
    for (let x = 0; x < w; x += 16) {
      ctx.fillStyle = x % 32 ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.09)';
      ctx.fillRect(x, 0, 8, h);
    }
    blotches(ctx, w, h, 8, ['40,50,36'], 10, 40, 0.3);
    noise(ctx, w, h, 800, 0.12, '170,185,155', '30,40,28');
  });
}
