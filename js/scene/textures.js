// ASTRO LAB — procedural planet textures (no external image files needed)
// Textures are stylised-realistic artistic renderings generated on a canvas, sampled on a
// sphere with 3D noise so there is no seam at the date line.

// ---------- 3D value noise ----------
function hash(x, y, z, seed) {
  let h = (x * 374761393 + y * 668265263 + z * 2147483647 + seed * 1442695041) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}
const fade = t => t * t * (3 - 2 * t);
function vnoise(x, y, z, seed) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  const xf = fade(x - xi), yf = fade(y - yi), zf = fade(z - zi);
  const l = (a, b, t) => a + (b - a) * t;
  const c000 = hash(xi, yi, zi, seed), c100 = hash(xi + 1, yi, zi, seed), c010 = hash(xi, yi + 1, zi, seed), c110 = hash(xi + 1, yi + 1, zi, seed);
  const c001 = hash(xi, yi, zi + 1, seed), c101 = hash(xi + 1, yi, zi + 1, seed), c011 = hash(xi, yi + 1, zi + 1, seed), c111 = hash(xi + 1, yi + 1, zi + 1, seed);
  return l(l(l(c000, c100, xf), l(c010, c110, xf), yf), l(l(c001, c101, xf), l(c011, c111, xf), yf), zf);
}
export function fbm(x, y, z, seed = 1, oct = 5, lac = 2, gain = 0.5) {
  let a = 0.5, f = 1, s = 0, n = 0;
  for (let i = 0; i < oct; i++) { s += a * vnoise(x * f, y * f, z * f, seed + i * 17); n += a; a *= gain; f *= lac; }
  return s / n;
}
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const hex = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
function ramp(stops, t) {
  t = clamp(t);
  for (let i = 1; i < stops.length; i++) if (t <= stops[i][0]) { const [t0, c0] = stops[i - 1], [t1, c1] = stops[i]; return mix(c0, c1, (t - t0) / (t1 - t0 || 1)); }
  return stops[stops.length - 1][1];
}
const R = (arr) => arr.map(([t, h]) => [t, hex(h)]);

function makeCanvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }

// fn(x,y,z,lat,lon) -> [r,g,b] or [r,g,b,a]
function paint(w, h, fn) {
  const c = makeCanvas(w, h), ctx = c.getContext('2d');
  const img = ctx.createImageData(w, h), d = img.data;
  for (let j = 0; j < h; j++) {
    const lat = Math.PI / 2 - (j + 0.5) / h * Math.PI; const cl = Math.cos(lat), sl = Math.sin(lat);
    for (let i = 0; i < w; i++) {
      const lon = (i + 0.5) / w * Math.PI * 2;
      const x = cl * Math.cos(lon), y = sl, z = cl * Math.sin(lon);
      const col = fn(x, y, z, lat, lon);
      const k = (j * w + i) * 4;
      d[k] = col[0]; d[k + 1] = col[1]; d[k + 2] = col[2]; d[k + 3] = col.length > 3 ? col[3] : 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

function craters(c, n, seed, dark = 0.25, light = 0.18, maxR = 0.04) {
  const ctx = c.getContext('2d'), w = c.width, h = c.height;
  let s = seed;
  const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < n; i++) {
    const x = rnd() * w, y = h * (0.1 + 0.8 * rnd()), r = (0.004 + Math.pow(rnd(), 3) * maxR) * w;
    const g = ctx.createRadialGradient(x, y, r * 0.2, x, y, r);
    g.addColorStop(0, `rgba(0,0,0,${dark})`); g.addColorStop(0.75, `rgba(0,0,0,${dark * 0.5})`);
    g.addColorStop(0.88, `rgba(255,255,255,${light})`); g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(x, y, r, r * 0.9, 0, 0, Math.PI * 2); ctx.fill();
  }
  return c;
}

// ---------- Recipes (Earth for the sky and menu, the Moon for the Lunar Mission) ----------
const recipes = {
  earth: (w, h) => paint(w, h, (x, y, z, lat) => {
    const n = fbm(x * 1.6, y * 1.6, z * 1.6, 31, 7);
    const alat = Math.abs(lat) / (Math.PI / 2);
    const sea = 0.52;
    if (alat > 0.86 + (n - 0.5) * 0.12) return hex('#eef4f8');
    if (n < sea) { const d = (sea - n) / sea; return mix(hex('#1f6fae'), hex('#0a2a5c'), clamp(d * 3.2)); }
    const m = fbm(x * 5, y * 5, z * 5, 33, 4);
    const desert = Math.exp(-Math.pow((alat - 0.28) / 0.12, 2)) * (m > 0.5 ? 1 : 0.4);
    const elev = (n - sea) / (1 - sea);
    let c = mix(hex('#2f6b2a'), hex('#7a8a42'), clamp(m));
    c = mix(c, hex('#c8a86a'), clamp(desert));
    if (alat > 0.7) c = mix(c, hex('#6b7a6a'), clamp((alat - 0.7) * 5));
    c = mix(c, hex('#8a7f6e'), clamp((elev - 0.35) * 2));
    return c;
  }),
  moon: (w, h) => craters(paint(w, h, (x, y, z) => {
    const n = fbm(x * 3, y * 3, z * 3, 51, 6); const maria = fbm(x * 1.3, y * 1.3, z * 1.3, 52, 3);
    let c = ramp(R([[0, '#5d5b58'], [0.5, '#9a9792'], [1, '#c9c6c0']]), n);
    if (maria > 0.56) c = mix(c, hex('#4a4846'), clamp((maria - 0.56) * 6));
    return c;
  }), 520, 13, 0.28, 0.22)
};

export const TEXTURE_IDS = Object.keys(recipes);

export function generateTexture(id, quality = 'high') {
  let w = quality === 'low' ? 256 : quality === 'medium' ? 384 : 512;
  const r = recipes[id];
  if (!r) return null;
  return r(w, w / 2);
}

export function ringTexture() {
  const w = 1024, c = makeCanvas(w, 4), ctx = c.getContext('2d');
  for (let i = 0; i < w; i++) {
    const t = i / w; // inner (0) to outer (1)
    let a = 0.25 + 0.6 * fbm(t * 40, 0.5, 0.5, 301, 4);
    if (t < 0.12) a *= t / 0.12 * 0.5;                // faint C ring
    if (t > 0.555 && t < 0.6) a *= 0.08;              // Cassini division
    if (t > 0.86 && t < 0.875) a *= 0.2;               // Encke gap
    if (t > 0.97) a *= (1 - t) / 0.03;
    const shade = 180 + 60 * fbm(t * 80, 1, 1, 302, 2);
    ctx.fillStyle = `rgba(${shade + 20 | 0},${shade | 0},${shade - 30 | 0},${clamp(a).toFixed(3)})`;
    ctx.fillRect(i, 0, 1, 4);
  }
  return c;
}

export function glowTexture(inner = 'rgba(255,240,200,1)', mid = 'rgba(255,170,60,0.35)') {
  const s = 256, c = makeCanvas(s, s), ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  g.addColorStop(0, inner); g.addColorStop(0.2, mid); g.addColorStop(0.5, 'rgba(255,120,40,0.08)'); g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, s, s); return c;
}

export function dotTexture() {
  const s = 64, c = makeCanvas(s, s), ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.35, 'rgba(255,255,255,0.6)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, s, s); return c;
}

// Small 2D preview (used in info panels / cards) rendered from the texture as a lit sphere
export function spherePreview(texCanvas, size = 160, opts = {}) {
  const c = makeCanvas(size, size), ctx = c.getContext('2d');
  if (!texCanvas) return c;
  const src = texCanvas.getContext('2d').getImageData(0, 0, texCanvas.width, texCanvas.height).data;
  const tw = texCanvas.width, th = texCanvas.height;
  const img = ctx.createImageData(size, size), d = img.data, r = size / 2 - 2;
  const L = [-0.55, 0.45, 0.7]; const ll = Math.hypot(...L); L[0] /= ll; L[1] /= ll; L[2] /= ll;
  for (let j = 0; j < size; j++) for (let i = 0; i < size; i++) {
    const x = (i - size / 2) / r, y = -(j - size / 2) / r, rr = x * x + y * y; if (rr > 1) continue;
    const z = Math.sqrt(1 - rr);
    const lat = Math.asin(y), lon = Math.atan2(x, z) + Math.PI;
    const u = Math.floor(((lon / (Math.PI * 2)) % 1) * tw), v = Math.floor((0.5 - lat / Math.PI) * th);
    const k = (Math.min(th - 1, v) * tw + Math.min(tw - 1, u)) * 4;
    const lam = opts.emissive ? 1 : clamp(x * L[0] + y * L[1] + z * L[2], 0, 1) * 0.9 + 0.12;
    const o = (j * size + i) * 4;
    d[o] = Math.min(255, src[k] * lam); d[o + 1] = Math.min(255, src[k + 1] * lam); d[o + 2] = Math.min(255, src[k + 2] * lam);
    d[o + 3] = rr > 0.97 ? 255 * (1 - (rr - 0.97) / 0.03) : 255;
  }
  ctx.putImageData(img, 0, 0);
  return c;
}
