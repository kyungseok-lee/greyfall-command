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
  tex.anisotropy = 8;
  return tex;
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
  return canvasTexture(512, (ctx, w, h) => {
    ctx.fillStyle = '#c8a165';
    ctx.fillRect(0, 0, w, h);
    blotches(ctx, w, h, 26, ['183,142,84', '214,178,116', '158,120,70'], 30, 110, 0.22);
    noise(ctx, w, h, 5200, 0.16, '232,206,156', '120,88,48');
    ctx.strokeStyle = 'rgba(96,72,42,0.13)';
    for (let i = 0; i < 5; i++) {
      ctx.lineWidth = 3 + Math.random() * 5;
      ctx.beginPath();
      const y0 = Math.random() * h;
      ctx.moveTo(-20, y0);
      ctx.bezierCurveTo(w * 0.3, y0 + 60 - Math.random() * 120, w * 0.7, y0 + 80 - Math.random() * 160, w + 20, y0 + (Math.random() - 0.5) * 60);
      ctx.stroke();
      ctx.lineWidth = 2;
      ctx.strokeStyle = 'rgba(240,220,170,0.10)';
      ctx.stroke();
      ctx.strokeStyle = 'rgba(96,72,42,0.13)';
    }
    ctx.globalAlpha = 0.05;
    for (let i = 0; i < 40; i++) {
      ctx.fillStyle = '#5c4526';
      const x = Math.random() * w;
      const y = Math.random() * h;
      ctx.beginPath();
      ctx.ellipse(x, y, 8 + Math.random() * 22, 4 + Math.random() * 8, Math.random() * 3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  });
}

export function concreteTexture() {
  return canvasTexture(256, (ctx, w, h) => {
    ctx.fillStyle = '#98938a';
    ctx.fillRect(0, 0, w, h);
    noise(ctx, w, h, 3200, 0.13, '176,172,164', '104,100,94');
    blotches(ctx, w, h, 14, ['122,118,110', '150,146,138'], 20, 70, 0.25);
    ctx.strokeStyle = 'rgba(70,66,60,0.35)';
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 7; i++) {
      ctx.beginPath();
      let x = Math.random() * w;
      let y = Math.random() * h;
      ctx.moveTo(x, y);
      for (let j = 0; j < 4; j++) {
        x += (Math.random() - 0.5) * 50;
        y += (Math.random() - 0.5) * 50;
        ctx.lineTo(x, y);
      }
      ctx.globalAlpha = 0.4 + Math.random() * 0.3;
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  });
}

export function corrugatedTexture() {
  return canvasTexture(256, (ctx, w, h) => {
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
    blotches(ctx, w, h, 22, ['140,74,32', '96,52,24', '168,96,40'], 6, 30, 0.34);
    noise(ctx, w, h, 1600, 0.12, '230,230,230', '50,50,50');
    ctx.fillStyle = 'rgba(30,26,22,0.4)';
    ctx.fillRect(0, h - 26, w, 26);
    ctx.fillRect(0, 0, w, 10);
  });
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
