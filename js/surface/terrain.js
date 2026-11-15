// ASTRO LAB — surface terrain: height function from real features, mesh, colours, sun visibility.
import * as THREE from '../../vendor/three.module.js';
import { COLORS, mix } from '../data/surfaces.js';

// ---------- small deterministic helpers ----------
export function rng(seed) { let s = (seed * 2654435761) >>> 0 || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }
function h2(x, y, s) { let h = (x * 374761393 + y * 668265263 + s * 1442695041) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967295; }
const fade = t => t * t * (3 - 2 * t);
export function vnoise2(x, y, s) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = fade(x - xi), yf = fade(y - yi);
  const a = h2(xi, yi, s), b = h2(xi + 1, yi, s), c = h2(xi, yi + 1, s), d = h2(xi + 1, yi + 1, s);
  return a + (b - a) * xf + (c - a) * yf + (a - b - c + d) * xf * yf;
}
export function fbm2(x, y, s, oct = 4) { let a = 0.5, f = 1, t = 0, n = 0; for (let i = 0; i < oct; i++) { t += a * vnoise2(x * f, y * f, s + i * 31); n += a; a *= 0.5; f *= 2.03; } return t / n; }
const smooth = (e0, e1, x) => { const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };
const softplus = (x, k) => k * Math.log1p(Math.exp(x / k));
const DEG = Math.PI / 180;

// ---------- Height function compiled from the site's feature list ----------
export function buildHeight(site, radiusKm) {
  const parts = [], craters = [], blocks = [];
  const R = radiusKm * 1000;
  for (const f of site.terrain) {
    if (f.t === 'noise') { const s = site.seed + parts.length * 7, sc = 1 / f.scale, amp = f.amp, oct = f.oct || 4; parts.push((x, z) => (fbm2(x * sc, z * sc, s, oct) - 0.5) * 2 * amp); }
    else if (f.t === 'crater') craters.push({ x: f.x, z: f.z, R: f.d / 2, depth: (f.depth || 0.18) * f.d, rim: (f.fresh ? 0.035 : 0.012) * f.d * (0.4 + 0.6 * (f.fresh ?? 0.5)), fresh: f.fresh ?? 0.5, name: f.name });
    else if (f.t === 'craterField') {
      const r = rng(f.seed * 97 + site.seed), E = site.extent;
      for (let i = 0; i < f.n; i++) {
        // power-law sizes: many small, few large
        const u = r(); const d = f.dMin * Math.pow(f.dMax / f.dMin, Math.pow(u, 1.8));
        const x = (r() * 2 - 1) * E, z = (r() * 2 - 1) * E;
        if (Math.hypot(x - (site.lander?.x || 0), z - (site.lander?.z || 0)) < d * 0.7 + 12) continue; // keep the landing pad clear
        const worn = f.worn || r() < 0.5;
        craters.push({ x, z, R: d / 2, depth: (worn ? 0.06 + r() * 0.05 : 0.14 + r() * 0.06) * d, rim: (worn ? 0.008 : 0.03) * d, fresh: worn ? 0 : r() * 0.7 });
      }
    }
    else if (f.t === 'rille' || f.t === 'trench' || f.t === 'ridge' || f.t === 'wall' || f.t === 'grooves') {
      const a = (f.angle || 0) * DEG; const nx = Math.cos(a), nz = Math.sin(a); const dx = Math.sin(a), dz = -Math.cos(a);
      const x0 = f.x || 0, z0 = f.z || 0;
      const sOf = (x, z) => (x - x0) * nx + (z - z0) * nz, along = (x, z) => (x - x0) * dx + (z - z0) * dz;
      if (f.t === 'rille' || f.t === 'trench') {
        const W = f.width / 2, D = f.depth, M = f.meander || 0, wl = f.wl || 1000;
        parts.push((x, z) => {
          const al = along(x, z); let s = sOf(x, z) - M * Math.sin(al / wl * 2 * Math.PI) - M * 0.4 * Math.sin(al / wl * 5.3);
          const t = Math.abs(s) / W; if (t >= 1) return 0;
          let y = -D * 0.5 * (1 + Math.cos(Math.PI * Math.pow(t, 1.6)));
          if (f.zMax !== undefined) y *= smooth(f.zMax + 120, f.zMax, z);
          return y;
        });
      } else if (f.t === 'ridge') {
        const W = f.width / 2, H = f.height, off = f.double ? f.double / 2 : 0;
        const one = s => { const t = Math.abs(s) / W; return t >= 1 ? 0 : H * Math.pow(0.5 + 0.5 * Math.cos(Math.PI * t), 1.3); };
        parts.push((x, z) => { const s = sOf(x, z); return off ? one(s - off) + one(s + off) : one(s); });
      } else if (f.t === 'wall') {
        const tn = Math.tan(f.slope * DEG), depth = f.depth || 1e9, rim = f.rim || 0, rimW = f.rimW || 100, outer = (f.outer || 0) / 100;
        parts.push((x, z) => {
          const s = sOf(x, z);
          let drop = tn * softplus(-s, 25); if (depth < 1e8) drop = depth - softplus(depth - drop, Math.min(20, depth * 0.25));
          return -drop + rim * Math.exp(-((s / rimW) ** 2)) + (s > 0 ? outer * s : 0);
        });
      } else {
        const wl = f.wl, amp = f.amp, sh = f.sharp || 1;
        parts.push((x, z) => { const s = sOf(x, z) + (f.phase || 0) + 40 * Math.sin(along(x, z) / 700); const c = 0.5 + 0.5 * Math.cos(2 * Math.PI * s / wl); return Math.abs(amp) * (2 * Math.pow(c, sh) - 1) * Math.sign(amp); });
      }
    }
    else if (f.t === 'rise') { const { x: cx, z: cz, r, h } = f; parts.push((x, z) => { const d = Math.hypot(x - cx, z - cz) / r; return d >= 1 ? 0 : h * 0.5 * (1 + Math.cos(Math.PI * d)); }); }
    else if (f.t === 'blocks') {
      const r = rng(f.seed * 131 + site.seed); const [x0, x1, z0, z1] = f.area;
      const list = [...(f.fixed || [])];
      let tries = 0;
      while (list.length < f.n + (f.fixed || []).length && tries++ < 400) {
        const b = { x: x0 + r() * (x1 - x0), z: z0 + r() * (z1 - z0), s: f.minS + r() * (f.maxS - f.minS), h: f.minH + r() * (f.maxH - f.minH) };
        const L = site.lander || { x: 0, z: 0 };
        if (Math.hypot(b.x - L.x, b.z - L.z) < b.s + 60) continue;
        if ([...site.pois, ...site.samples].some(p => Math.hypot(p.x - b.x, p.z - b.z) < b.s * 0.8 && !list.slice(0, (f.fixed || []).length).some(q => q.x === p.x))) continue;
        if (list.some(q => Math.hypot(q.x - b.x, q.z - b.z) < (q.s + b.s) * 0.6)) continue;
        list.push(b);
      }
      for (const b of list) { b.rot = r() * Math.PI; b.tx = (r() - 0.5) * 0.25; b.tz = (r() - 0.5) * 0.25; b.round = f.round; b.tilt = f.tilt; blocks.push(b); }
    }
  }
  // spatial hash for craters and blocks
  const CELL = 64, grid = new Map();
  const key = (i, j) => i * 73856093 ^ j * 19349663;
  const insert = (o, rad) => { const i0 = Math.floor((o.x - rad) / CELL), i1 = Math.floor((o.x + rad) / CELL), j0 = Math.floor((o.z - rad) / CELL), j1 = Math.floor((o.z + rad) / CELL); for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) { const k = key(i, j); if (!grid.has(k)) grid.set(k, []); grid.get(k).push(o); } };
  craters.forEach(c => { c.kind = 0; insert(c, c.R * 2.6); });
  blocks.forEach(b => { b.kind = 1; insert(b, b.s * 0.9); });

  function featureH(x, z, out) {
    const list = grid.get(key(Math.floor(x / CELL), Math.floor(z / CELL)));
    let y = 0, ej = 0, blk = 0;
    if (list) for (const o of list) {
      if (o.kind === 0) {
        const dx = x - o.x, dz = z - o.z, d2 = dx * dx + dz * dz, R2 = o.R * o.R;
        if (d2 > R2 * 6.76) continue;
        const r = Math.sqrt(d2) / o.R;
        if (r < 1) { const bowl = o.rim - o.depth * (1 - r * r) * (1 - 0.25 * Math.pow(1 - r, 4)); y += bowl; }
        else { y += o.rim * Math.pow(r, -3) * smooth(2.6, 1.6, r); if (o.fresh > 0.2) ej = Math.max(ej, o.fresh * smooth(2.4, 1.0, r)); }
        if (r < 1 && o.fresh > 0.2) ej = Math.max(ej, o.fresh * 0.6);
      } else {
        const dx = x - o.x, dz = z - o.z, c = Math.cos(o.rot), s = Math.sin(o.rot);
        const u = dx * c - dz * s, v = dx * s + dz * c; const hs = o.s / 2;
        let m;
        if (o.round) { const d = Math.hypot(u, v * 1.3) / (hs * 1.15); m = d >= 1 ? 0 : 0.5 * (1 + Math.cos(Math.PI * d)); }
        else { const e = Math.max(Math.abs(u), Math.abs(v)) / hs; m = smooth(1.12, 0.92, e); }
        if (m > 0) { const top = o.h * (1 + (o.tilt ? (u * o.tx + v * o.tz) / hs : 0)); y = Math.max(y, top * m); blk = Math.max(blk, m); }
      }
    }
    if (out) { out.ej = ej; out.blk = blk; }
    return y;
  }
  const curv = 1 / (2 * R);
  const height = (x, z, out) => {
    let y = 0; for (let i = 0; i < parts.length; i++) y += parts[i](x, z);
    y += featureH(x, z, out);
    return y - (x * x + z * z) * curv;
  };
  return { height, craters, blocks };
}

// ---------- Terrain mesh with non-uniform grid (dense near the landing site) ----------
export class Terrain {
  constructor(site, body, opts = {}) {
    this.site = site; this.body = body;
    const { height, craters, blocks } = buildHeight(site, body.radiusKm);
    this.heightFn = height; this.craters = craters; this.blocks = blocks;
    const N = Math.round(site.res * (opts.resScale || 1)) | 1; this.N = N;
    const E = site.extent, a = Math.min(0.6, Math.max(0.18, (E * 2 / N) > 8 ? 0.22 : 0.45));
    const xs = new Float32Array(N + 1);
    for (let i = 0; i <= N; i++) { const u = i / N * 2 - 1; xs[i] = E * (a * u + (1 - a) * u * u * u); }
    this.xs = xs; this.E = E;
    const H = new Float32Array((N + 1) * (N + 1)); this.H = H;
    const EJ = new Float32Array((N + 1) * (N + 1)), BL = new Float32Array((N + 1) * (N + 1));
    const tmp = {};
    for (let j = 0; j <= N; j++) for (let i = 0; i <= N; i++) { const k = j * (N + 1) + i; H[k] = height(xs[i], xs[j], tmp); EJ[k] = tmp.ej; BL[k] = tmp.blk; }
    this.EJ = EJ; this.BL = BL;
  }
  // index of the cell containing coordinate v (binary search over xs)
  cell(v) { const xs = this.xs; let lo = 0, hi = this.N; if (v <= xs[0]) return 0; if (v >= xs[hi]) return hi - 1; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (xs[m] <= v) lo = m; else hi = m; } return lo; }
  // exact height of the rendered surface (same triangles as the mesh)
  h(x, z) {
    const N = this.N, xs = this.xs, H = this.H;
    if (x < xs[0] || x > xs[N] || z < xs[0] || z > xs[N]) return this.heightFn(x, z);
    const i = this.cell(x), j = this.cell(z);
    const fx = (x - xs[i]) / (xs[i + 1] - xs[i]), fz = (z - xs[j]) / (xs[j + 1] - xs[j]);
    const W = N + 1, a = H[j * W + i], b = H[j * W + i + 1], c = H[(j + 1) * W + i], d = H[(j + 1) * W + i + 1];
    // triangles split along a–d diagonal: (a,c,b) and (b,c,d) as built by PlaneGeometry-style indexing below
    if (fx + fz <= 1) return a + (b - a) * fx + (c - a) * fz;
    return d + (c - d) * (1 - fx) + (b - d) * (1 - fz);
  }
  grad(x, z) { const e = 0.6; return [(this.h(x + e, z) - this.h(x - e, z)) / (2 * e), (this.h(x, z + e) - this.h(x, z - e)) / (2 * e)]; }
  normal(x, z) { const [gx, gz] = this.grad(x, z); const v = new THREE.Vector3(-gx, 1, -gz); return v.normalize(); }
  inBounds(x, z, m = 0) { return Math.abs(x) < this.E - m && Math.abs(z) < this.E - m; }

  // Does the Sun shine on this point? March the heightfield toward the Sun.
  sunVis(x, z, y, sunDir, maxD = 3000) {
    const hor = Math.hypot(sunDir.x, sunDir.z) || 1e-6, tanEl = sunDir.y / hor;
    const dx = sunDir.x / hor, dz = sunDir.z / hor;
    let vis = 1, d = 1.5;
    while (d < maxD) {
      const px = x + dx * d, pz = z + dz * d;
      if (!this.inBounds(px, pz)) break;
      const ray = y + d * tanEl, th = this.h(px, pz);
      const diff = ray - th; if (diff < 0) return 0;
      vis = Math.min(vis, diff / (0.02 * d + 0.3));
      d += Math.max(1.5, d * 0.06);
    }
    return Math.max(0, Math.min(1, vis));
  }

  buildMesh(sunDir, paintFn) {
    const N = this.N, W = N + 1, xs = this.xs, H = this.H;
    const pos = new Float32Array(W * W * 3), col = new Float32Array(W * W * 3), uv = new Float32Array(W * W * 2);
    const idx = new Uint32Array(N * N * 6);
    for (let j = 0; j <= N; j++) for (let i = 0; i <= N; i++) {
      const k = j * W + i; pos[k * 3] = xs[i]; pos[k * 3 + 1] = H[k]; pos[k * 3 + 2] = xs[j];
      uv[k * 2] = xs[i] / 3; uv[k * 2 + 1] = xs[j] / 3;
    }
    let t = 0;
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const a = j * W + i, b = a + 1, c = a + W, d = c + 1;
      idx[t++] = a; idx[t++] = c; idx[t++] = b; idx[t++] = b; idx[t++] = c; idx[t++] = d;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    g.setIndex(new THREE.BufferAttribute(idx, 1));
    g.computeVertexNormals();
    const nrm = g.attributes.normal.array;
    // colours + baked long-range sun visibility (the near-field uses real-time shadows too)
    const shade = new Float32Array(W * W);
    for (let j = 0; j <= N; j++) for (let i = 0; i <= N; i++) {
      const k = j * W + i, x = xs[i], z = xs[j], y = H[k];
      const slope = Math.acos(Math.min(1, nrm[k * 3 + 1])) / DEG;
      const c = paintFn(x, z, y, slope, this.EJ[k], this.BL[k]);
      const vis = this.sunVis(x, z, y + 0.2, sunDir, 2500);
      shade[k] = vis;
      col[k * 3] = Math.pow(c[0], 2.2); col[k * 3 + 1] = Math.pow(c[1], 2.2); col[k * 3 + 2] = Math.pow(c[2], 2.2);
    }
    this.shade = shade;
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.setAttribute('sunvis', new THREE.BufferAttribute(shade, 1));
    g.computeBoundingSphere();
    return g;
  }
  // baked visibility at a point (bilinear over vertices)
  bakedShade(x, z) {
    if (!this.shade || !this.inBounds(x, z)) return 1;
    const N = this.N, W = N + 1, xs = this.xs; const i = this.cell(x), j = this.cell(z);
    const fx = (x - xs[i]) / (xs[i + 1] - xs[i]), fz = (z - xs[j]) / (xs[j + 1] - xs[j]); const S = this.shade;
    return (S[j * W + i] * (1 - fx) + S[j * W + i + 1] * fx) * (1 - fz) + (S[(j + 1) * W + i] * (1 - fx) + S[(j + 1) * W + i + 1] * fx) * fz;
  }
}

// ---------- Per-site colouring (albedo) ----------
export function makePainter(site) {
  const P = site.paint, base = COLORS[P.base], alt = COLORS[P.alt], ej = COLORS[P.ejecta || P.alt], sl = P.slopeLight ? COLORS[P.slopeLight] : null;
  const s = site.seed;
  return (x, z, y, slope, ejecta, blk) => {
    const n1 = fbm2(x / 180, z / 180, s + 1, 3), n2 = fbm2(x / 14, z / 14, s + 2, 2);
    let c = mix(base, alt, n1 * 0.9 - 0.1 + (n2 - 0.5) * 0.3);
    if (ejecta > 0) c = mix(c, ej, ejecta * 0.75);
    if (sl) c = mix(c, sl, smooth(14, 30, slope) * 0.6);
    return c;
  };
}

// ---------- Ground grain texture (tiles every 3 m) ----------
export function grainTextures(seed = 1) {
  // periodic value noise so the tile repeats seamlessly
  const S = 256, hgt = new Float32Array(S * S);
  const pn = (x, y, P, sd) => { const xi = Math.floor(x), yi = Math.floor(y), xf = fade(x - xi), yf = fade(y - yi); const w = (i, j) => h2(((i % P) + P) % P, ((j % P) + P) % P, sd);
    const a = w(xi, yi), b = w(xi + 1, yi), c = w(xi, yi + 1), d = w(xi + 1, yi + 1); return a + (b - a) * xf + (c - a) * yf + (a - b - c + d) * xf * yf; };
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    let v = 0, amp = 0.5, n = 0;
    for (let o = 0; o < 5; o++) { const P = 8 << o; v += amp * pn(x / S * P, y / S * P, P, seed + o * 13); n += amp; amp *= 0.55; }
    hgt[y * S + x] = v / n;
  }
  const cv = document.createElement('canvas'); cv.width = cv.height = S; const ctx = cv.getContext('2d'); const img = ctx.createImageData(S, S);
  const nv = document.createElement('canvas'); nv.width = nv.height = S; const nctx = nv.getContext('2d'); const nimg = nctx.createImageData(S, S);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const k = y * S + x, v = hgt[k];
    const g = Math.round(205 + (v - 0.5) * 90); img.data.set([g, g, g, 255], k * 4);
    const hx = hgt[y * S + ((x + 1) % S)] - hgt[y * S + ((x + S - 1) % S)], hy = hgt[((y + 1) % S) * S + x] - hgt[((y + S - 1) % S) * S + x];
    const nn = new THREE.Vector3(-hx * 5, -hy * 5, 1).normalize();
    nimg.data.set([(nn.x * 0.5 + 0.5) * 255, (nn.y * 0.5 + 0.5) * 255, (nn.z * 0.5 + 0.5) * 255, 255], k * 4);
  }
  ctx.putImageData(img, 0, 0); nctx.putImageData(nimg, 0, 0);
  const map = new THREE.CanvasTexture(cv), normal = new THREE.CanvasTexture(nv);
  for (const t of [map, normal]) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; }
  map.colorSpace = THREE.SRGBColorSpace;
  return { map, normal };
}

// Make a material use the baked 'sunvis' attribute to block direct sunlight in far terrain shadows.
export function applySunVis(mat, { detail = false } = {}) {
  mat.onBeforeCompile = sh => {
    if (detail) { // sample the grain at three scales (3 m, 22 m, 97 m) so the ground never shows a repeating tile
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <map_fragment>', `#ifdef USE_MAP
          vec4 sampledDiffuseColor = texture2D( map, vMapUv );
          float s2 = texture2D( map, vMapUv * 0.137 + vec2(0.37, 0.71) ).g / 0.62, s3 = texture2D( map, vMapUv * 0.031 + vec2(0.11, 0.53) ).g / 0.62;
          sampledDiffuseColor.rgb *= mix(1.0, s2, 0.55) * mix(1.0, s3, 0.5);
          diffuseColor *= sampledDiffuseColor;
        #endif`)
        .replace('vec3 mapN = texture2D( normalMap, vNormalMapUv ).xyz * 2.0 - 1.0;', 'vec3 mapN = texture2D( normalMap, vNormalMapUv ).xyz * 2.0 - 1.0; vec3 mapN2 = texture2D( normalMap, vNormalMapUv * 0.21 + 0.4 ).xyz * 2.0 - 1.0; mapN = normalize(vec3(mapN.xy + mapN2.xy * 0.9, mapN.z));');
    }
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float sunvis;\nvarying float vSunVis;').replace('#include <color_vertex>', '#include <color_vertex>\nvSunVis = sunvis;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vSunVis;')
      .replace('#include <lights_fragment_begin>', THREE.ShaderChunk.lights_fragment_begin.replace('getDirectionalLightInfo( directionalLight, directLight );', 'getDirectionalLightInfo( directionalLight, directLight ); directLight.color *= smoothstep(0.0, 1.0, vSunVis);'));
  };
  return mat;
}
