// ASTRO LAB — Surface Expeditions: walk, hop, drive and do science on real moons.
// Physics uses each body's real surface gravity; traction, walking speed and jump height all
// scale from it. Titan's dense air adds drag; airless worlds throw dust in perfect parabolas.
import * as THREE from '../../vendor/three.module.js';
import { SURFACE_BODIES, SITE_MAP, COLORS } from '../data/surfaces.js';
import { Terrain, makePainter, grainTextures, rng, applySunVis, fbm2 } from './terrain.js';
import { makeAstronaut, AstroAnimator, makeRover, makeModel, makeLM, makeLander, rockGeometry, rockTex, bootprintTex, trackTex } from './models.js';
import { fitEllipsoid, rockCollider, rockTopAt, sphereHit, segRock, circleBox, segBox } from './collision.js';
import { glowTexture, dotTexture } from '../scene/textures.js';
import { bus, settings, progress, save, addXP, awardBadge, checkBadges, log, gameEvent } from '../systems/core.js';
import { $, h, toast, openModal, modalOpen } from '../ui/dom.js';

const DEG = Math.PI / 180, G_EARTH = 9.81, UP = new THREE.Vector3(0, 1, 0);
const dirFrom = (az, el) => new THREE.Vector3(Math.sin(az * DEG) * Math.cos(el * DEG), Math.sin(el * DEG), -Math.cos(az * DEG) * Math.cos(el * DEG));
const ROCK_LIFT = 0.8; // rocks up to 0.8 m across can be picked up; bigger boulders give a chipped sample
const ZERO_M = new THREE.Matrix4().makeScale(0, 0, 0);
const fmt = (v, d = 1) => (Math.abs(v) < 10 ? v.toFixed(d) : Math.round(v).toString());
const fmtTime = s => s < 90 ? `${s.toFixed(1)} s` : s < 5400 ? `${(s / 60).toFixed(1)} min` : `${(s / 3600).toFixed(1)} h`;
const DOSE_LIMIT = 250; // mSv — NASA's 30-day career-protective limit for blood-forming organs
const WARPS = [1, 4, 16];
// Player collision body: radius, the height a boot can step up onto, helmet top (all metres)
const PR = 0.3, STEP = 0.3, HEAD = 1.75, FOOT = [[0, 0], [0.15, 0], [-0.15, 0], [0, 0.15], [0, -0.15]];
const BODY = [0.35, 0.95, HEAD - PR]; // sphere centres above the feet; only rocks taller than STEP are tested against them
// A rock surface steeper than ~37° can't be stood on (or stair-climbed); anything steeper is a wall.
// WALL_NY is the same limit as a normal's vertical component (cos 37°), so the two tests always agree.
const MAX_TOP_SLOPE = 0.75, WALL_NY = 0.8;
// Rover collision: sample points in the rover frame (x right, z back), each a sphere of radius 0.5 at 0.75 m
const RV_PTS = [[-0.95, -1.2], [0.95, -1.2], [-0.95, 1.2], [0.95, 1.2], [0, -1.5], [0, 1.5]], RV_BOX = { x0: -1.2, z0: -1.7, x1: 1.2, z1: 1.7 };
// Mouse-look speed in radians per pixel at Settings › Camera sensitivity 1×
export const LOOK = { third: 0.006, first: 0.004 };
const ABORT = new Error('landing aborted');

const isObj = v => v && typeof v === 'object' && !Array.isArray(v);
export function surfaceSave(siteId) {
  // tolerate old or damaged saves: every field is checked before use
  const s = isObj(progress.surface) ? progress.surface : (progress.surface = { sites: {}, jumps: {} });
  if (!isObj(s.sites)) s.sites = {}; if (!isObj(s.jumps)) s.jumps = {};
  if (!siteId) return s;
  let r = s.sites[siteId]; if (!isObj(r)) r = s.sites[siteId] = { obj: [], samples: [], visits: 0, complete: false };
  if (!Array.isArray(r.obj)) r.obj = []; if (!Array.isArray(r.samples)) r.samples = [];
  r.obj = r.obj.filter(x => typeof x === 'string'); r.samples = r.samples.filter(x => typeof x === 'string');
  if (!Number.isFinite(r.visits)) r.visits = 0; r.complete = !!r.complete;
  return r;
}

export class SurfaceGame {
  constructor(app, siteId, onExit) {
    this.app = app; this.site = SITE_MAP[siteId]; this.body = SURFACE_BODIES[this.site.body]; this.onExit = onExit;
    this.g = this.body.g; this.temp = this.site.temp || this.body.temp; this.warpI = 0; this.disposed = false;
    this.mobile = matchMedia('(max-width: 720px)').matches || document.body.classList.contains('touch');
    this.low = settings.quality === 'low';
    this.rec = surfaceSave(siteId); // visits are counted in start(), so an aborted landing doesn't count
    this.state = { walked: 0, driven: 0, jetUsed: 0, dose: 0, maxJump: 0, airMax: 0, lastJump: 0, lastJumpAt: 0, lastAir: 0, lastAirAt: 0 };
    this.keys = new Set(); this.joy = { x: 0, y: 0 }; this.jumpHeld = false; this.jumpT = 0; this.downHeld = false;
    this.rocks = []; this.boxes = []; this.nearRocks = []; this.nearBoxes = [];
    this.pendingEv = new Set(); this.objBase = {};
  }

  // ---------------- Build ----------------
  async build(root) {
    const s = this.site, b = this.body;
    const alive = async () => { await tick(); if (this.disposed) throw ABORT; };
    this.root = root;
    const r = this.renderer = new THREE.WebGLRenderer({ antialias: !this.mobile, powerPreference: 'high-performance', logarithmicDepthBuffer: true });
    r.setPixelRatio(Math.min(devicePixelRatio || 1, this.mobile ? 1.5 : 1.75));
    r.outputColorSpace = THREE.SRGBColorSpace; r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 1.15;
    r.shadowMap.enabled = !this.low; r.shadowMap.type = THREE.PCFSoftShadowMap;
    r.domElement.className = 'surface-canvas'; root.prepend(r.domElement);
    const scene = this.scene = new THREE.Scene();
    const cam = this.camera = new THREE.PerspectiveCamera(60, 1, 0.05, 120000);
    this.sunDir = dirFrom(s.sun.az, s.sun.el);
    this.resize(); this._onResize = () => this.resize(); addEventListener('resize', this._onResize);

    // Terrain
    await alive();
    const t = this.terrain = new Terrain(s, b, { resScale: this.low ? 0.5 : this.mobile ? 0.72 : 1 });
    await alive();
    const geo = t.buildMesh(this.sunDir, makePainter(s));
    await alive();
    const grain = grainTextures(s.seed);
    const mat = applySunVis(new THREE.MeshStandardMaterial({ vertexColors: true, map: grain.map, normalMap: grain.normal, normalScale: new THREE.Vector2(0.55, 0.55), roughness: 1, metalness: 0 }), { detail: true });
    const ground = this.ground = new THREE.Mesh(geo, mat); ground.receiveShadow = true; scene.add(ground);

    // Sky & lights
    const titan = b.sky === 'titan';
    scene.background = new THREE.Color(titan ? 0xb27a3c : 0x000000);
    if (titan) scene.fog = new THREE.FogExp2(0xa8743a, 0.0011);
    const sunI = titan ? 1.1 : 5.2 * Math.pow(b.sunAU, -0.3);
    const sun = this.sun = new THREE.DirectionalLight(titan ? 0xffc48a : 0xfff6ea, sunI);
    sun.castShadow = true; const sz = 40; Object.assign(sun.shadow.camera, { left: -sz, right: sz, top: sz, bottom: -sz, near: 1, far: 600 });
    sun.shadow.mapSize.set(this.mobile ? 1024 : 2048, this.mobile ? 1024 : 2048); sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.04;
    scene.add(sun, sun.target);
    // Airless sky gives no light, but the sunlit ground bounces a lot back onto suits and rocks
    const gc = new THREE.Color(...COLORS[s.paint.base]);
    scene.add(new THREE.HemisphereLight(titan ? 0xd8a060 : 0x000000, titan ? 0x5a3a1a : gc, titan ? 1.1 : 1.4 * Math.min(1, Math.sin(Math.max(s.sun.el, 3) * DEG) * 3)));
    if (s.parent) { // planetshine: a faint fill from the planet hanging in the sky
      const shine = Math.min(0.3, 0.01 * s.parent.ang + 0.02);
      scene.add(new THREE.HemisphereLight(s.parent.tex === 'earth' ? 0x9fc0ff : 0xffe0b0, 0x000000, shine));
    }
    if (!titan) scene.add(new THREE.AmbientLight(0xffffff, 0.12));
    // Helmet lamp: switches on automatically in shadow (shadows on airless worlds are nearly black)
    this.lamp = new THREE.SpotLight(0xfff4e0, 0, 70, 0.55, 0.5, 1.3); scene.add(this.lamp, this.lamp.target);
    this.buildSky();
    if (s.backdrop) this.buildBackdrop();

    // Objects (rocks, lander and landmarks are all solid)
    this.buildRocks();
    await alive();
    const L = s.lander;
    if (L) { const m = L.model === 'lm' ? makeLM() : makeLander(); m.position.set(L.x, t.h(L.x, L.z), L.z); scene.add(m); this.landerObj = m; this.addBoxes(m); }
    this.poiObjs = [];
    for (const p of s.pois) { if (!p.model) continue; const m = makeModel(p.model); if (!m) continue; m.position.set(p.x, t.h(p.x, p.z), p.z); m.rotation.y = (p.x * 13 % 6); scene.add(m); this.poiObjs.push(m); this.addBoxes(m); }
    this.sampleObjs = [];
    const sGeo = rockGeometry(7), ringGeo = new THREE.TorusGeometry(0.55, 0.03, 6, 32);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0x5ad8ff, transparent: true, opacity: 0.85, depthWrite: false });
    this.sampleShared = [sGeo, ringGeo, ringMat]; // shared by every sample: freed in dispose()
    for (const sp of s.samples) {
      if (this.rec.samples.includes(sp.id)) continue;
      const grp = new THREE.Group(); grp.position.set(sp.x, t.h(sp.x, sp.z), sp.z);
      const rock = new THREE.Mesh(sGeo, new THREE.MeshStandardMaterial({ color: new THREE.Color(...(COLORS[s.rocks?.color] || [0.6, 0.6, 0.6])).multiplyScalar(1.15), roughness: 0.85, bumpMap: rockTex(), bumpScale: 2 }));
      rock.scale.setScalar(0.16); rock.position.y = 0.08; rock.castShadow = true; grp.add(rock);
      const ring = new THREE.Mesh(ringGeo, ringMat); ring.rotation.x = Math.PI / 2; ring.position.y = 0.04; grp.add(ring);
      grp.userData = { sp, ring, rock }; scene.add(grp); this.sampleObjs.push(grp);
    }
    this.buildParticles();
    this.buildDecals();

    // Player (never spawned inside a boulder or model)
    const a = this.astro = makeAstronaut(); scene.add(a);
    this.anim = new AstroAnimator(a); this.anim.onStep = k => this.footstep(k);
    const sp = s.spawn, [px, pz] = this.freeSpot(sp.x, sp.z);
    this.p = { pos: new THREE.Vector3(px, t.h(px, pz), pz), vel: new THREE.Vector3(), ground: true, on: 0, yaw: -sp.yaw * DEG, phase: 0, airT: 0, jumpBase: 0, peak: 0, fuel: 40, inSun: true, sunT: 0 };
    this.camYaw = -sp.yaw * DEG; this.camPitch = 0.28; this.camDist = 7; this.fp = false;
    // Rover
    if (s.rover) {
      const rv = this.roverObj = makeRover(); scene.add(rv);
      this.rv = { pos: new THREE.Vector3(s.rover.x, t.h(s.rover.x, s.rover.z), s.rover.z), vy: 0, u: 0, yaw: -s.rover.yaw * DEG, steer: 0, ground: true, air: 0, q: new THREE.Quaternion(), max: s.rover.max || 3.6 };
      this.updateRoverPose(0);
    }
    this.buildEnv();
    this.driving = false;
    this.drop = null; this.facts = new Set();
    this.objDone = new Set(this.rec.obj);
    this.clock = new THREE.Clock();
    this.intro = settings.reducedMotion ? 0 : 3.2;
    this.refreshNear(true);
    await alive();
  }

  buildSky() {
    const s = this.site, b = this.body, sc = this.scene;
    if (b.starOpacity > 0) {
      const n = 2500, pos = new Float32Array(n * 3), R = rng(5);
      for (let i = 0; i < n; i++) { const u = R() * 2 - 1, th = R() * Math.PI * 2, rr = Math.sqrt(1 - u * u); pos.set([rr * Math.cos(th) * 90000, u * 90000, rr * Math.sin(th) * 90000], i * 3); }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      sc.add(new THREE.Points(g, new THREE.PointsMaterial({ color: 0xffffff, size: 1.4, sizeAttenuation: false, transparent: true, opacity: b.starOpacity, fog: false, depthWrite: false })));
    }
    // Sun: true angular size disk + glare
    const D = 80000, sunAng = 0.533 / b.sunAU;
    const sunPos = this.sunDir.clone().multiplyScalar(D);
    const disk = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(glowTexture('rgba(255,255,250,1)', 'rgba(255,240,210,0.9)')), fog: false, depthWrite: false, transparent: true, blending: THREE.AdditiveBlending }));
    disk.position.copy(sunPos); disk.scale.setScalar(Math.max(D * Math.tan(sunAng * DEG) * 2.4, D * 0.004)); sc.add(disk);
    const glare = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(glowTexture()), fog: false, depthWrite: false, transparent: true, opacity: b.sky === 'titan' ? 0.35 : 0.55, blending: THREE.AdditiveBlending }));
    glare.position.copy(sunPos); glare.scale.setScalar(D * 0.09); sc.add(glare);
    // Parent planet at its real angular diameter, lit by the Sun (so its phase is right)
    if (s.parent) {
      const P = s.parent, Dp = 60000, rad = Dp * Math.tan(P.ang / 2 * DEG);
      const tex = this.app.textures?.[P.tex];
      const m = new THREE.MeshStandardMaterial({ color: tex ? 0xffffff : 0x8899aa, roughness: 1, fog: false });
      if (tex) { m.map = new THREE.CanvasTexture(tex); m.map.colorSpace = THREE.SRGBColorSpace; }
      const planet = new THREE.Mesh(new THREE.SphereGeometry(rad, 48, 32), m);
      this.parentDir = dirFrom(P.az, P.el); planet.position.copy(this.parentDir.clone().multiplyScalar(Dp)); planet.rotation.z = 0.2;
      sc.add(planet);
    }
  }

  buildBackdrop() {
    const t = this.terrain, R = this.body.radiusKm * 1000, mat = new THREE.MeshStandardMaterial({ color: 0x8e8a83, roughness: 1, flatShading: false });
    this.site.backdrop.forEach((m, k) => {
      const nx = 40, nz = 20, g = new THREE.PlaneGeometry(m.w, m.w * 0.55, nx, nz); g.rotateX(-Math.PI / 2);
      const p = g.attributes.position, r = rng(k + 3);
      const bumps = Array.from({ length: 5 }, () => [(r() - 0.5) * m.w * 0.7, (r() - 0.5) * m.w * 0.3, 0.45 + r() * 0.55]);
      for (let i = 0; i < p.count; i++) {
        const x = p.getX(i), z = p.getZ(i); let y = 0;
        for (const [bx, bz, bh] of bumps) y = Math.max(y, m.h * bh * Math.exp(-(((x - bx) / (m.w * 0.22)) ** 2 + ((z - bz) / (m.w * 0.16)) ** 2)));
        y *= Math.min(1, (1 - Math.abs(x) / (m.w / 2)) * 3) * Math.min(1, (1 - Math.abs(z) / (m.w * 0.275)) * 3);
        p.setY(i, y - 30);
      }
      g.computeVertexNormals();
      const mesh = new THREE.Mesh(g, mat); const d = dirFrom(m.az, 0);
      mesh.position.set(d.x * m.dist, -(m.dist * m.dist) / (2 * R), d.z * m.dist); mesh.rotation.y = -m.az * DEG; this.scene.add(mesh);
    });
  }

  buildRocks() {
    const s = this.site, t = this.terrain, cfg = s.rocks; if (!cfg) return;
    const R = rng(s.seed * 7 + 1), list = [];
    const E = s.extent * 0.75;
    const n = Math.round(cfg.n * (this.low ? 0.35 : this.mobile ? 0.6 : 1));
    for (let i = 0; i < n; i++) { const rr = E * Math.pow(R(), 0.75), a = R() * Math.PI * 2; list.push([Math.cos(a) * rr, Math.sin(a) * rr, cfg.min + Math.pow(R(), 3) * (cfg.max - cfg.min)]); }
    for (const b of cfg.bias || []) for (let i = 0; i < b.n; i++) { const rr = b.r * Math.sqrt(R()), a = R() * Math.PI * 2; list.push([b.x + Math.cos(a) * rr, b.z + Math.sin(a) * rr, cfg.min + Math.pow(R(), 2.5) * (b.max - cfg.min)]); }
    const L = s.lander || { x: 0, z: 0 };
    const keep = list.filter(([x, z, sz]) => Math.hypot(x - L.x, z - L.z) > 7 + sz && t.inBounds(x, z, 10));
    const col = new THREE.Color(...(COLORS[cfg.color] || [0.6, 0.6, 0.6])).convertSRGBToLinear();
    const rt = rockTex(); const mat = new THREE.MeshStandardMaterial({ color: col, roughness: 0.92, bumpMap: rt, bumpScale: 2.5 });
    const geos = [rockGeometry(1, cfg.round), rockGeometry(2, cfg.round), rockGeometry(3, cfg.round)];
    // Each rock's collider is an ellipsoid fitted to its own mesh, then given the same tilt, squash, scale and burial as the
    // visible instance — so every rock, of every size, is solid exactly where it is drawn.
    const fits = geos.map(g => fitEllipsoid(g.attributes.position.array));
    this.rocks = []; const picked = new Set(this.rec.samples);
    geos.forEach((geo, gi) => {
      const mine = keep.filter((_, i) => i % 3 === gi);
      const im = new THREE.InstancedMesh(geo, mat, mine.length); im.castShadow = true; im.receiveShadow = true;
      const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
      for (const [i, [x, z, sz]] of mine.entries()) {
        e.set(R() * 0.6, R() * 6.28, R() * 0.6); q.setFromEuler(e);
        const pos = new THREE.Vector3(x, t.h(x, z) - sz * 0.25, z), sc = new THREE.Vector3(sz, sz * (0.7 + R() * 0.5), sz * (0.8 + R() * 0.4));
        m.compose(pos, q, sc);
        im.setMatrixAt(i, m);
        const shade = 0.75 + R() * 0.35; im.setColorAt(i, new THREE.Color(shade, shade, shade));
        const c = rockCollider(pos.x, pos.y, pos.z, [q.x, q.y, q.z, q.w], sc.x, sc.y, sc.z, fits[gi]);
        // every rock can be picked up (or, for a boulder, sampled): remember which instance it is so it can be removed
        Object.assign(c, { im, ii: i, sz, id: `rk${Math.round(x * 10)}_${Math.round(z * 10)}` });
        if (picked.has(c.id)) { im.setMatrixAt(i, ZERO_M); continue; } // already in your sample bag from an earlier visit
        if (c.top > t.h(x, z) + 0.02) this.rocks.push(c); // skip rocks buried out of sight
      }
      this.scene.add(im);
    });
  }
  // Solid boxes for a model: one world-space box per mesh part (legs, deck, ladder rungs, flag pole…)
  addBoxes(obj) {
    obj.updateMatrixWorld(true); const bb = new THREE.Box3(), size = new THREE.Vector3();
    obj.traverse(o => {
      if (!o.isMesh) return; bb.setFromObject(o); bb.getSize(size);
      if (Math.max(size.x, size.y, size.z) < 0.03) return;
      this.boxes.push({ x0: bb.min.x, y0: bb.min.y, z0: bb.min.z, x1: bb.max.x, y1: bb.max.y, z1: bb.max.z });
    });
  }

  buildParticles() {
    // Dust kicked up by boots and wheels (also carries the jetpack's cold-gas puffs)
    const n = 1800; this.dust = { n, i: 0, pos: new Float32Array(n * 3), vel: new Float32Array(n * 3), life: new Float32Array(n), col: new Float32Array(n * 4) };
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(this.dust.pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(this.dust.col, 4)); g.setDrawRange(0, n);
    for (let i = 0; i < n; i++) this.dust.pos[i * 3 + 1] = -1e5;
    const c = COLORS[this.site.paint.base]; this.dustCol = new THREE.Color(...c).multiplyScalar(0.8);
    const dt = new THREE.CanvasTexture(dotTexture());
    this.dustPts = new THREE.Points(g, new THREE.PointsMaterial({ size: 0.075, map: dt, vertexColors: true, sizeAttenuation: true, transparent: true, depthWrite: false }));
    this.dustPts.frustumCulled = false; this.scene.add(this.dustPts);
  }

  resize() { const w = innerWidth, h = innerHeight; this.renderer.setSize(w, h, false); this.camera.aspect = w / h; this.camera.updateProjectionMatrix(); }

  // ---------------- Loop ----------------
  start() {
    this.running = true; this.clock.getDelta();
    this.rec.visits++; save();
    const loop = () => { if (!this.running) return; this.raf = requestAnimationFrame(loop); this.frame(); };
    loop();
    gameEvent('surface:land', { id: this.site.id }); gameEvent('surface:body', { id: this.site.body });
    log(`Landed at ${this.site.name}, ${this.body.name}`, '🧑‍🚀');
  }
  frame() {
    const raw = this.clock.getDelta(); let dt = Math.min(0.05, raw); this.rdt = Math.min(0.25, raw);
    if (modalOpen() || this.paused) { if (document.pointerLockElement) document.exitPointerLock(); this.render(); return; }
    const warp = WARPS[this.warpI]; const simDt = dt * warp;
    const steps = Math.min(64, Math.ceil(simDt / (1 / 120))); const h = simDt / steps;
    this.thrusting = false;
    // the walk cycle advances with every physics step, so footprints stay in sync with the body at any time warp
    for (let i = 0; i < steps; i++) { this.step(h); this.animStep(h); }
    this.simDt = simDt;
    this.stepEffects(simDt);
    if (this.body.dose) this.state.dose += this.body.dose * simDt;
    const q = this.driving ? this.rv.pos : this.p.pos; this.p.sunT -= dt;
    if (this.p.sunT <= 0 || !this._sunAt || Math.hypot(q.x - this._sunAt.x, q.z - this._sunAt.z) > 1.5) this.sunNow(); // also when you've moved (time warp)
    this.updateCamera(dt);
    this.checkObjectives(dt);
    this.sounds(dt);
    this.hudTick(dt);
    this.render();
  }
  render() { this.renderer.render(this.scene, this.camera); }
  // Is the player (or rover) in sunlight right now? Recomputed on demand so checks never use a stale value.
  sunNow() {
    const q = this.driving ? this.rv.pos : this.p.pos;
    this.p.sunT = 0.35; this._sunAt = { x: q.x, z: q.z };
    return (this.p.inSun = this.terrain.sunVis(q.x, q.z, q.y + 1.2, this.sunDir, 3000) > 0.3);
  }

  input() {
    const k = this.keys; let x = (k.has('KeyD') || k.has('ArrowRight') ? 1 : 0) - (k.has('KeyA') || k.has('ArrowLeft') ? 1 : 0);
    let y = (k.has('KeyW') || k.has('ArrowUp') ? 1 : 0) - (k.has('KeyS') || k.has('ArrowDown') ? 1 : 0);
    if (Math.abs(this.joy.x) + Math.abs(this.joy.y) > 0.05) { x = this.joy.x; y = -this.joy.y; }
    const run = k.has('ShiftLeft') || k.has('ShiftRight') || Math.hypot(this.joy.x, this.joy.y) > 0.85;
    return { x, y, run };
  }

  step(dt) {
    if (this.intro > 0) return;
    if (this.driving) { this.stepRover(dt, true); this.refreshNear(); return; }
    if (this.rv) this.stepRover(dt, false);
    this.refreshNear();
    const P = this.p, t = this.terrain, g = this.g, b = this.body, inp = this.input();
    // desired direction relative to camera
    const fx = -Math.sin(this.camYaw), fz = -Math.cos(this.camYaw);
    // right vector = (cos yaw, −sin yaw)
    let dx = fx * inp.y + Math.cos(this.camYaw) * inp.x, dz = fz * inp.y - Math.sin(this.camYaw) * inp.x;
    const dl = Math.hypot(dx, dz), mag = Math.min(1, dl); if (dl > 0) { dx /= dl; dz /= dl; }
    const sq = Math.sqrt(g);
    const vmax = inp.run ? Math.min(3.2, 1.75 * sq) : Math.min(1.4, 0.67 * sq);
    const v = P.vel;
    if (P.ground) {
      // standing on a rock or a model: its top counts as level ground
      const [gx, gz] = P.on ? [0, 0] : t.grad(P.pos.x, P.pos.z); const slope = Math.atan(Math.hypot(gx, gz));
      // Traction: you can only push horizontally as hard as friction allows, and friction scales with gravity.
      const aMax = 0.7 * g * Math.cos(slope);
      const tx = dx * vmax * mag, tz = dz * vmax * mag;
      let ax = (tx - v.x) / dt, az = (tz - v.z) / dt; const am = Math.hypot(ax, az);
      if (am > aMax) { ax *= aMax / am; az *= aMax / am; }
      v.x += ax * dt; v.z += az * dt;
      // Loose regolith slides on slopes steeper than ~33°
      if (slope > 33 * DEG) { const gm = Math.hypot(gx, gz) || 1; const a = g * (Math.sin(slope) - 0.55 * Math.cos(slope)); v.x -= gx / gm * a * dt; v.z -= gz / gm * a * dt; this.sliding = true; } else this.sliding = false;
      // Stay on the ground: vertical speed follows the slope under your feet
      // ground pushes you up a rise; over a crest gravity may not pull you down fast enough, so you lift off
      v.y = Math.max(v.y - g * dt, gx * v.x + gz * v.z);
      // Jump
      if (this.jumpRelease) {
        const charge = Math.min(1, this.jumpRelease / 0.5); this.jumpRelease = 0;
        const v0 = 0.5 + 1.3 * charge; // m/s take-off speed in a pressurised suit (legs push the same on any world)
        v.y += v0; P.ground = false; P.jumpBase = P.pos.y; P.peak = P.pos.y; P.airT = 0; P.jumpV = v0; P.jetFlight = false;
        this.kickDust(P.pos, 14, 0.8);
      }
      if (b.atm.rho > 0.5) { const k = 0.5 * b.atm.rho * 0.9 * 0.8 / 160; const sp = Math.hypot(v.x, v.z); v.x -= v.x * k * sp * dt; v.z -= v.z * k * sp * dt; }
    } else {
      this.sliding = false; // you can't slide while airborne
      v.y -= g * dt;
      // Jetpack (only on very low-gravity worlds): thrust 0.6 m/s², 40 m/s of delta-v
      if (b.jetpack && P.fuel > 0) {
        let jx = 0, jy = 0, jz = 0;
        if (this.jumpHeld && !this.jumpPending) jy += 1;
        if (this.downHeld) jy -= 1;
        if (mag > 0) { jx = dx * mag; jz = dz * mag; }
        const jm = Math.hypot(jx, jy, jz);
        if (jm > 0) { const a = 0.6 * dt / jm; v.x += jx * a; v.y += jy * a; v.z += jz * a; const used = 0.6 * dt; P.fuel = Math.max(0, P.fuel - used); this.state.jetUsed += used; this.thrusting = true; P.jetFlight = true; }
      }
      // Air drag (Titan): F = ½ρv²CdA
      if (b.atm.rho > 0.5) { const k = 0.5 * b.atm.rho * 0.9 * 0.8 / 160, sp = v.length(); v.multiplyScalar(Math.max(0, 1 - k * sp * dt)); }
      P.airT += dt; P.peak = Math.max(P.peak, P.pos.y);
    }
    P.pos.x += v.x * dt; P.pos.y += v.y * dt; P.pos.z += v.z * dt;
    // world bounds
    const E = t.E - 30; if (Math.abs(P.pos.x) > E || Math.abs(P.pos.z) > E) { P.pos.x = Math.max(-E, Math.min(E, P.pos.x)); P.pos.z = Math.max(-E, Math.min(E, P.pos.z)); v.x *= -0.2; v.z *= -0.2; this.edgeWarn(); }
    // boulders, the lander, landmarks and the parked rover are solid
    this.collidePlayer(P, v);
    // support: terrain, or the top of a rock / model you are standing on
    const nh = this.supportAt(P.pos.x, P.pos.z, P.pos.y), wasOn = P.on;
    if (P.ground) {
      // stepping down off a rock is a step, not a fall
      if (P.pos.y > nh + 0.04 && !(wasOn && P.pos.y - nh < STEP)) { P.ground = false; P.jumpBase = P.pos.y; P.peak = P.pos.y; P.airT = 0; P.jumpV = 0; P.jetFlight = false; } else { P.pos.y = nh; P.on = this._on; }
    } else if (P.pos.y <= nh) {
      const impact = -v.y; P.pos.y = nh; P.ground = true; P.on = this._on; if (v.y < 0) v.y = 0;
      if (P.airT > 0.15) { this.landed(P.peak - P.jumpBase, P.airT, impact); this.anim.impact(impact); this.landPrints = true; if (impact > 0.6) bus.emit('sfx', 'land'); }
      this.kickDust(P.pos, Math.min(40, 6 + impact * 10), 0.3 + impact * 0.25);
    }
    const sp = Math.hypot(v.x, v.z);
    if (P.ground) this.state.walked += sp * dt;
    // turn smoothly toward the direction of travel (a suited astronaut can't spin on the spot)
    let tgt = null;
    if (sp > 0.05 && P.ground) tgt = Math.atan2(-v.x, -v.z);
    else if (mag > 0 && !P.ground) tgt = Math.atan2(-dx, -dz);
    if (tgt !== null) { const d = Math.atan2(Math.sin(tgt - P.yaw), Math.cos(tgt - P.yaw)), mx = (P.ground ? 7 : 2.5) * dt; const st = Math.max(-mx, Math.min(mx, d * Math.min(1, dt * 12))); P.yaw += st; P.turn = st / dt; } else P.turn = 0;
    // escape velocity!
    if (v.length() > b.escape && v.y > 0) this.escaped();
  }
  animStep(dt) {
    if (this.driving) return; // the seated pose is set in updateCamera
    const P = this.p, a = this.astro, sp = Math.hypot(P.vel.x, P.vel.z);
    a.position.copy(P.pos); a.rotation.set(0, P.yaw, 0);
    const charging = this.jumpHeld && this.jumpPending && P.ground; // only when a jump will really happen
    this.anim.update(dt, { speed: sp, ground: P.ground, g: this.g, vy: P.vel.y, turnRate: P.turn || 0, sliding: this.sliding && P.ground, crouch: charging ? Math.min(1, (performance.now() - this.jumpT) / 500) : 0 });
    if (this.landPrints) { this.landPrints = false; this.footstep(2); }
  }

  // ---------------- Collision ----------------
  // Rocks and model boxes within ~40 m. Refreshed whenever the player or rover has moved 6 m, and at once after any teleport.
  refreshNear(force) {
    const P = this.driving ? this.rv.pos : this.p.pos, c = this._nearAt;
    if (!force && c && Math.abs(P.x - c.x) < 6 && Math.abs(P.z - c.z) < 6) return;
    this._nearAt = { x: P.x, z: P.z };
    this.nearRocks = this.rocksAround(P, 46); this.nearBoxes = this.boxesAround(P, 46);
  }
  rocksAround(P, W) { return this.rocks.filter(r => Math.abs(r.x - P.x) < W + r.ex && Math.abs(r.z - P.z) < W + r.ez); }
  boxesAround(P, W) { return this.boxes.filter(b => b.x1 > P.x - W && b.x0 < P.x + W && b.z1 > P.z - W && b.z0 < P.z + W); }
  // Highest thing a boot-sized footprint at (x, z) can stand on: terrain, or a rock / model top no higher than one step up.
  supportAt(x, z, feet) {
    const ground = this.terrain.h(x, z), lim = feet + STEP; let hgt = ground, on = 0;
    for (const c of this.nearRocks) {
      if (c.top <= hgt || Math.abs(c.x - x) > c.ex + 0.15 || Math.abs(c.z - z) > c.ez + 0.15) continue;
      for (const [ox, oz] of FOOT) {
        const px = x + ox, pz = z + oz, y = rockTopAt(c, px, pz);
        if (!(y > hgt && y <= lim && y > ground + 0.05)) continue;
        let sl = 0; for (const [ax, az] of [[0.08, 0], [-0.08, 0], [0, 0.08], [0, -0.08]]) sl = Math.max(sl, Math.abs(rockTopAt(c, px + ax, pz + az) - y) / 0.08);
        if (sl <= MAX_TOP_SLOPE) { hgt = y; on = 1; }
      }
    }
    for (const b of this.nearBoxes) if (b.y1 > hgt && b.y1 <= lim && x > b.x0 - 0.15 && x < b.x1 + 0.15 && z > b.z0 - 0.15 && z < b.z1 + 0.15) { hgt = b.y1; on = 2; }
    this._on = on; return hgt;
  }
  // Push the player's body (three stacked spheres above step height) out of rocks, model boxes and the parked rover.
  collidePlayer(P, v) {
    const o = this._hit || (this._hit = {});
    for (let it = 0; it < 2; it++) {
      const feet = P.pos.y;
      for (const c of this.nearRocks) {
        if (c.top < feet + STEP) continue; // low enough to step onto: handled by supportAt
        for (const hs of BODY) {
          const pen = sphereHit(c, P.pos.x, feet + hs, P.pos.z, PR, o);
          if (!pen || o.y > WALL_NY) continue; // an upward-facing top is something to stand on, not a wall
          if (!P.ground && v.y <= 0 && o.y > 0) { // coming down onto a sloping shoulder: resolve along the surface normal (you slide off it naturally) instead of a sideways shove
            P.pos.x += o.x * pen; P.pos.y += o.y * pen; P.pos.z += o.z * pen;
            const vn = v.x * o.x + v.y * o.y + v.z * o.z; if (vn < 0) { v.x -= vn * o.x; v.y -= vn * o.y; v.z -= vn * o.z; }
            continue;
          }
          if (o.y < -0.5 && !P.ground) { P.pos.y -= pen; if (v.y > 0) v.y = 0; continue; } // head bumped an overhang mid-jump
          let nx = o.x, nz = o.z, hl = Math.hypot(nx, nz), k = Math.min(pen / (hl || 1), pen * 2);
          if (hl < 0.6) { nx = P.pos.x - c.x; nz = P.pos.z - c.z; hl = Math.hypot(nx, nz) || 1; k = Math.min(pen, 0.3); } // walking under an overhang: back out of it
          P.pos.x += nx / hl * k; P.pos.z += nz / hl * k; this.blockVel(v, nx / hl, nz / hl);
        }
      }
      for (const b of this.nearBoxes) {
        if (b.y1 <= feet + STEP || b.y0 >= feet + HEAD) continue;
        const p = circleBox(b, P.pos.x, P.pos.z, PR); if (!p) continue;
        P.pos.x += p[0]; P.pos.z += p[1]; const l = Math.hypot(p[0], p[1]) || 1; this.blockVel(v, p[0] / l, p[1] / l);
      }
      if (this.rv && !this.driving && feet < this.rv.pos.y + 1.3) {
        const p = this.roverPush(P.pos.x, P.pos.z, PR);
        if (p) { P.pos.x += p[0]; P.pos.z += p[1]; const l = Math.hypot(p[0], p[1]) || 1; this.blockVel(v, p[0] / l, p[1] / l); }
      }
    }
  }
  blockVel(v, nx, nz) { const vn = v.x * nx + v.z * nz; if (vn < 0) { v.x -= vn * nx; v.z -= vn * nz; } }
  // Horizontal push out of the rover's footprint (an oriented 2.4 × 3.4 m box), or null.
  roverPush(x, z, r) {
    const R = this.rv, c = Math.cos(R.yaw), s = Math.sin(R.yaw), dx = x - R.pos.x, dz = z - R.pos.z;
    const p = circleBox(RV_BOX, dx * c - dz * s, dx * s + dz * c, r); if (!p) return null;
    return [p[0] * c + p[1] * s, -p[0] * s + p[1] * c];
  }
  collideRover(R, fwd, control) {
    const c = Math.cos(R.yaw), s = Math.sin(R.yaw), o = this._hit || (this._hit = {});
    const rocks = this.driving ? this.nearRocks : this.rocksAround(R.pos, 8), boxes = this.driving ? this.nearBoxes : this.boxesAround(R.pos, 8);
    let hit = 0, hx = 0, hz = 0;
    for (const [lx, lz] of RV_PTS) {
      const px = R.pos.x + lx * c + lz * s, pz = R.pos.z - lx * s + lz * c, py = R.pos.y + 0.75;
      for (const k of rocks) {
        if (k.top < R.pos.y + 0.3) continue; // small stones: the 82 cm wheels roll over them
        const pen = sphereHit(k, px, py, pz, 0.5, o); if (!pen) continue;
        if (o.y > 0.6) { R.pos.y += pen * o.y; if (R.vy < 0) R.vy = 0; continue; } // coming down on top of it (e.g. after a bump): ride over it
        let nx = o.x, nz = o.z, hl = Math.hypot(nx, nz), m = Math.min(pen / (hl || 1), pen * 2);
        // contact on the top or underside of an overhang: the rover can't climb it or pass beneath, so push straight out
        if (hl < 0.6) { nx = px - k.x; nz = pz - k.z; hl = Math.hypot(nx, nz) || 1; m = Math.min(pen, 0.3); }
        R.pos.x += nx / hl * m; R.pos.z += nz / hl * m; hx += nx / hl; hz += nz / hl; hit++;
      }
      for (const b of boxes) {
        if (b.y1 < R.pos.y + 0.3 || b.y0 > R.pos.y + 1.5) continue;
        const p = circleBox(b, px, pz, 0.5); if (!p) continue;
        R.pos.x += p[0]; R.pos.z += p[1]; const l = Math.hypot(p[0], p[1]) || 1; hx += p[0] / l; hz += p[1] / l; hit++;
      }
    }
    if (!hit) return;
    // stop the wheels pushing into the obstacle (with a small rebound)
    if ((fwd.x * hx + fwd.y * hz) * Math.sign(R.u) < 0) {
      if (control && Math.abs(R.u) > 0.6) { bus.emit('sfx', 'bump'); this.kickDust(R.pos, 20, 0.6); this.warn('💥 Collision! The rover hit an obstacle — steer around boulders.'); }
      R.u *= -0.15;
    }
  }
  // Is a body of radius r standing at (x, z) clear of rocks, models and the rover?
  isFree(x, z, r = PR) {
    const g = this.terrain.h(x, z), lim = g + STEP, o = this._hit || (this._hit = {});
    for (const c of this.rocks) {
      if (c.top < lim || Math.abs(c.x - x) > c.ex + r || Math.abs(c.z - z) > c.ez + r) continue;
      if (rockTopAt(c, x, z) > lim) return false;
      for (const hs of BODY) if (sphereHit(c, x, g + hs, z, r, o) && o.y <= WALL_NY) return false;
    }
    for (const b of this.boxes) if (b.y1 > lim && b.y0 < g + HEAD && circleBox(b, x, z, r)) return false;
    if (this.rv && this.p && !this.driving && this.roverPush(x, z, r)) return false;
    return true;
  }
  freeSpot(x, z, r = PR) {
    if (this.isFree(x, z, r)) return [x, z];
    for (let k = 1; k < 120; k++) { const a = k * 2.39996, d = 0.5 * Math.sqrt(k), nx = x + Math.cos(a) * d, nz = z + Math.sin(a) * d; if (this.terrain.inBounds(nx, nz, 31) && this.isFree(nx, nz, r)) return [nx, nz]; }
    return [x, z];
  }

  landed(height, air, impact) {
    const g = this.g, s = this.state, P = this.p;
    // jetpack flights and stepping off ledges are not jumps
    if (P.jetFlight) { P.jetFlight = false; this.jumpInfo = `Jetpack flight: ${fmt(height, 2)} m above take-off, ${fmtTime(air)} aloft — jetpack hops don't count as jumps.`; return; }
    if (!P.jumpV) return;
    s.maxJump = Math.max(s.maxJump, height); s.lastJump = height; s.lastJumpAt = performance.now();
    const best = surfaceSave().jumps; if (!best[this.site.body] || height > best[this.site.body]) best[this.site.body] = +height.toFixed(2);
    // same legs, same take-off speed: height and hang time both scale with 1/g
    const eH = height * g / G_EARTH, eT = air * g / G_EARTH;
    this.jumpInfo = `Last jump: ${fmt(height, 2)} m high, ${fmtTime(air)} in the air · same push on Earth: ${fmt(eH, 2)} m, ${eT.toFixed(2)} s`;
    save();
  }
  escaped() {
    this.warn(`🚀 You passed escape velocity (${this.body.escape} m/s)! Without a tether you would drift away from ${this.body.name} forever. Mission Control is pulling you back to the lander.`, 7000);
    this.respawn();
  }
  respawn() {
    const L = this.site.lander || this.site.spawn, P = this.p, [x, z] = this.freeSpot(L.x + 6, L.z + 4);
    P.pos.set(x, this.terrain.h(x, z), z); P.vel.set(0, 0, 0); P.ground = true; P.on = 0; P.fuel = 40; P.jetFlight = false;
    this.resetJump(); this.refreshNear(true); this.camSnap = true;
  }
  resetJump() { this.jumpHeld = false; this.jumpPending = false; this.jumpRelease = 0; }

  // ---------------- Rover ----------------
  stepRover(dt, control) {
    const R = this.rv, t = this.terrain, g = this.g, inp = control ? this.input() : { x: 0, y: 0 };
    // a parked rover on level ground with its brake on doesn't need simulating
    if (!control && R.ground && R.u === 0 && !this._roverWake) return;
    this._roverWake = false;
    const fwd = new THREE.Vector2(-Math.sin(R.yaw), -Math.cos(R.yaw));
    const [gx, gz] = t.grad(R.pos.x, R.pos.z);
    const gradAlong = gx * fwd.x + gz * fwd.y; const pitch = Math.atan(gradAlong);
    if (R.ground) {
      // Four 0.18 kW motors: gentle acceleration, limited by wheel traction (friction ∝ gravity)
      const traction = 0.6 * g * Math.cos(pitch), gs = g * Math.sin(pitch); // gs: gravity along the slope
      let a;
      if (inp.y === 0) {
        // No throttle: brakes. Coasting slows at up to 0.35 g; once almost stopped the parking brake holds with full
        // static friction, so a parked rover stays put on any slope its tyres can grip (up to ~31°) and only skids beyond.
        const cap = Math.abs(R.u) > 0.05 ? Math.min(0.35 * g, traction) : traction;
        a = Math.max(-cap, Math.min(cap, -R.u / dt + gs)) - gs;
      } else {
        a = inp.y * 0.6;
        if (Math.sign(inp.y) !== Math.sign(R.u) && Math.abs(R.u) > 0.05) a = inp.y * Math.min(traction, 1.2);
        a = Math.max(-traction, Math.min(traction, a)) - gs; // slides back if too steep
      }
      R.u += a * dt; R.u = Math.max(-1.5, Math.min(R.max * (gradAlong < -0.05 ? 1.4 : 1), R.u));
      if (Math.abs(R.u) < 1e-9) R.u = 0;
      R.steer += ((inp.x * 0.45) - R.steer) * Math.min(1, dt * 4);
      let curv = Math.tan(R.steer) / 2.3; const lat = R.u * R.u * Math.abs(curv), latMax = 0.6 * g;
      if (lat > latMax) curv *= latMax / lat; // tyres skid in low gravity
      R.yaw -= R.u * curv * dt;
      { const e = 0.3, mb = (x, z) => (fbm2(x / 2.6, z / 2.6, 77, 2) - 0.5) * 0.24; const fx = R.pos.x + fwd.x * e, fz = R.pos.z + fwd.y * e; const vTer = (gradAlong + (mb(fx, fz) - mb(R.pos.x, R.pos.z)) / e) * R.u; R.vy = Math.max(R.vy - g * dt, vTer); }
    } else { R.vy -= g * dt; R.air += dt; if (control) this.state.airMax = Math.max(this.state.airMax, R.air); }
    R.pos.x += fwd.x * R.u * dt; R.pos.z += fwd.y * R.u * dt; R.pos.y += R.vy * dt;
    const E = t.E - 30; if (Math.abs(R.pos.x) > E || Math.abs(R.pos.z) > E) { R.pos.x = Math.max(-E, Math.min(E, R.pos.x)); R.pos.z = Math.max(-E, Math.min(E, R.pos.z)); R.u *= -0.2; if (control) this.edgeWarn(); }
    // boulders, the lander and landmarks stop the rover just as they stop you
    this.collideRover(R, fwd, control);
    // small-scale bumps (too small for the terrain mesh) that make a fast rover bounce, as the Apollo rovers did
    const nh = t.h(R.pos.x, R.pos.z) + (fbm2(R.pos.x / 2.6, R.pos.z / 2.6, 77, 2) - 0.5) * 0.24;
    if (R.ground) { if (R.pos.y > nh + 0.003) { R.ground = false; R.air = 0; } else R.pos.y = nh; }
    else if (R.pos.y <= nh) { R.pos.y = nh; R.ground = true; if (R.air > 0.25) { if (control) this.state.airMax = Math.max(this.state.airMax, R.air); this.state.lastAir = R.air; this.state.lastAirAt = performance.now(); this.kickDust(R.pos, 30, 1.2); if (control) this.jumpInfo = `Rover airborne for ${R.air.toFixed(2)} s — in 1/6 g the rover leaves the ground over every bump.`; } }
    if (R.ground && Math.abs(R.u) > 0.08) { R.trk = (R.trk || 0) + Math.abs(R.u) * dt; if (R.trk > 0.38) { R.trk = 0; this.stampTracks(); } }
    if (control) { this.state.driven += Math.abs(R.u) * dt; if (R.ground && Math.abs(R.u) > 1 && Math.random() < dt * 20) { const w = this.roverObj.userData.wheels[Math.random() * 4 | 0]; const p = w.getWorldPosition(new THREE.Vector3()); this.kickDust(p, 3, 0.4 + Math.abs(R.u) * 0.35, fwd.x * R.u * 0.5, fwd.y * R.u * 0.5); } }
    this.updateRoverPose(dt);
  }
  updateRoverPose(dt) {
    const R = this.rv, t = this.terrain, o = this.roverObj;
    o.position.copy(R.pos);
    if (R.ground) {
      const f = new THREE.Vector3(-Math.sin(R.yaw), 0, -Math.cos(R.yaw)), rgt = new THREE.Vector3(Math.cos(R.yaw), 0, -Math.sin(R.yaw));
      const hF = t.h(R.pos.x + f.x * 1.2, R.pos.z + f.z * 1.2), hB = t.h(R.pos.x - f.x * 1.2, R.pos.z - f.z * 1.2);
      const hR = t.h(R.pos.x + rgt.x, R.pos.z + rgt.z), hL = t.h(R.pos.x - rgt.x, R.pos.z - rgt.z);
      const e = new THREE.Euler(Math.atan2(hF - hB, 2.4), R.yaw, Math.atan2(hR - hL, 2), 'YXZ');
      const q = new THREE.Quaternion().setFromEuler(e); R.q.slerp(q, dt ? Math.min(1, dt * 12) : 1);
    }
    o.quaternion.copy(R.q);
    // independent suspension: each wheel follows the ground under it (±15 cm of travel)
    o.updateMatrixWorld(true); const wp = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0).applyQuaternion(o.quaternion);
    for (const w of o.userData.wheels) {
      wp.set(w.position.x, w.userData.baseY, w.position.z).applyMatrix4(o.matrixWorld);
      const want = R.ground ? (t.h(wp.x, wp.z) + 0.41 - wp.y) / Math.max(0.5, up.y) : -0.14;
      const off = Math.max(-0.15, Math.min(0.15, want)); w.position.y += (w.userData.baseY + off - w.position.y) * (dt ? Math.min(1, dt * 18) : 1);
      w.children[0].rotation.x -= R.u * (dt || 0) / 0.41;
    }
    // front-wheel steering, matching the bicycle model in stepRover (rear wheels stay straight)
    o.userData.wheels[0].rotation.y = o.userData.wheels[1].rotation.y = -R.steer; /* turn the way the rover turns: +steer turns right, and +rotation.y would point the wheels left */ o.userData.wheels[2].rotation.y = o.userData.wheels[3].rotation.y = 0;
  }
  toggleRover() {
    if (!this.rv) return;
    if (this.driving) {
      const R = this.rv; if (Math.abs(R.u) > 0.6) { this.warn('Slow down before getting off (below 0.6 m/s).'); return; }
      this.leaveRover();
      // step off on the driver's side if it's clear, otherwise the other side, behind or in front
      const c = Math.cos(R.yaw), s = Math.sin(R.yaw);
      const spots = [[-2.2, 0], [2.2, 0], [0, 2.6], [0, -2.6]].map(([lx, lz]) => [R.pos.x + lx * c + lz * s, R.pos.z - lx * s + lz * c]);
      const [x, z] = spots.find(([x, z]) => this.terrain.inBounds(x, z, 31) && this.isFree(x, z)) || this.freeSpot(spots[0][0], spots[0][1]);
      this.p.pos.set(x, this.terrain.h(x, z), z); this.p.vel.set(0, 0, 0); this.p.ground = true; this.p.on = 0;
      this.refreshNear(true);
    } else {
      this.driving = true; this.p.vel.set(0, 0, 0); this.camDist = 11; this.camYaw = this.rv.yaw; this.markObj('board');
      this.resetJump(); this.refreshNear(true);
      this.say(`🚙 ${this.site.rover.name}: W/S throttle, A/D steer, E to get off. Top speed about ${this.rv.max} m/s (${Math.round(this.rv.max * 3.6)} km/h).`);
    }
  }
  // Leave the rover parked in a valid state: brake on, wheels straight, normal walking camera.
  leaveRover() {
    const R = this.rv; this.driving = false;
    R.u = 0; R.steer = 0; R.vy = Math.min(R.vy, 0); this._roverWake = true; this.updateRoverPose(0);
    this.astro.visible = true; this.camDist = 7; this.camSnap = true;
  }

  // ---------------- Reflections, footprints & tracks ----------------
  buildEnv() {
    // A tiny HDR copy of this sky (black or hazy, the ground below, the Sun) gives visors, foil and metal real reflections.
    const pm = new THREE.PMREMGenerator(this.renderer), sc = new THREE.Scene(), titan = this.body.sky === 'titan';
    const ground = new THREE.Color(...COLORS[this.site.paint.base]).convertSRGBToLinear().multiplyScalar((titan ? 0.6 : 2.2) * Math.max(0.15, Math.sin(Math.max(3, this.site.sun.el) * DEG)));
    const sky = titan ? new THREE.Color(0.45, 0.25, 0.09) : new THREE.Color(0.004, 0.005, 0.008);
    const g = new THREE.SphereGeometry(50, 48, 24), pp = g.attributes.position, col = new Float32Array(pp.count * 3), c = new THREE.Color();
    for (let i = 0; i < pp.count; i++) { const y = pp.getY(i) / 50; if (y < 0) c.copy(ground).multiplyScalar(0.55 + 0.45 * Math.min(1, -y * 4)); else c.copy(sky).lerp(titan ? new THREE.Color(0.25, 0.12, 0.04) : sky, y); col.set([c.r, c.g, c.b], i * 3); }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const skyMat = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide });
    sc.add(new THREE.Mesh(g, skyMat));
    const sunI = titan ? 3 : 60 * Math.pow(this.body.sunAU, -1.2);
    const sunG = new THREE.SphereGeometry(titan ? 6 : 1.6, 16, 8), sunM = new THREE.MeshBasicMaterial({ color: new THREE.Color(sunI, sunI * 0.97, sunI * 0.9) });
    const sun = new THREE.Mesh(sunG, sunM);
    sun.position.copy(this.sunDir).multiplyScalar(40); sc.add(sun);
    this.env = pm.fromScene(sc, 0.015).texture; pm.dispose(); g.dispose(); skyMat.dispose(); sunG.dispose(); sunM.dispose();
    this.scene.traverse(o => { if (!o.isMesh) return; for (const m of [].concat(o.material)) if (m.userData?.env && !m.envMap) { m.envMap = this.env; m.envMapIntensity = m.userData.env; m.needsUpdate = true; } });
  }
  buildDecals() {
    const c = COLORS[this.site.paint.base], lum = 0.3 * c[0] + 0.6 * c[1] + 0.1 * c[2];
    const mk = (tex, n, w, l, op) => {
      const geo = new THREE.PlaneGeometry(w, l); geo.rotateX(-Math.PI / 2);
      const im = new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial({ color: 0x000000, map: tex, transparent: true, opacity: op, depthWrite: false }), n);
      im.count = 0; im.frustumCulled = false; im.renderOrder = 1; this.scene.add(im);
      return { im, n, i: 0, used: 0 };
    };
    const op = lum > 0.55 ? 0.35 : 0.62;
    this.prints = mk(bootprintTex(), this.low ? 300 : 800, 0.17, 0.34, op);
    if (this.site.rover) this.tracks = mk(trackTex(), this.low ? 900 : 2600, 0.24, 0.42, op * 0.9);
    this._dm = new THREE.Matrix4(); this._dq = new THREE.Quaternion(); this._dq2 = new THREE.Quaternion(); this._dv = new THREE.Vector3(); this._d1 = new THREE.Vector3(1, 1, 1);
  }
  stamp(D, x, z, yaw) {
    if (!D) return;
    const t = this.terrain, n = t.normal(x, z);
    this._dq.setFromUnitVectors(UP, n).multiply(this._dq2.setFromAxisAngle(UP, yaw));
    this._dm.compose(this._dv.set(x, t.h(x, z) + 0.018, z), this._dq, this._d1);
    D.im.setMatrixAt(D.i, this._dm); D.i = (D.i + 1) % D.n; D.used = Math.min(D.n, D.used + 1); D.im.count = D.used;
    D.im.instanceMatrix.needsUpdate = true;
  }
  footstep(k) {
    if (!this.p.ground || this.driving) return;
    const a = this.astro, u = a.userData; a.updateMatrixWorld(true);
    const v = new THREE.Vector3();
    for (const leg of k === 2 ? [u.legL, u.legR] : [k ? u.legR : u.legL]) {
      leg.an.localToWorld(v.set(0, -0.09, -0.045));
      if (!this.p.on) this.stamp(this.prints, v.x, v.z, this.p.yaw); // no regolith prints on bare rock or hardware
      this.kickDust(v, 3 + Math.round(Math.hypot(this.p.vel.x, this.p.vel.z) * 2), 0.18 + Math.hypot(this.p.vel.x, this.p.vel.z) * 0.18, this.p.vel.x * 0.3, this.p.vel.z * 0.3);
    }
    const n = performance.now(); if (n - (this._stepSnd || 0) > 90) { this._stepSnd = n; bus.emit('sfx', 'step'); }
  }
  stampTracks() {
    const R = this.rv, f = [-Math.sin(R.yaw), -Math.cos(R.yaw)], r = [Math.cos(R.yaw), -Math.sin(R.yaw)];
    for (const [x, z, s] of [[-1.03, -1.15, 1], [1.03, -1.15, 1], [-1.03, 1.15, 0], [1.03, 1.15, 0]]) { // only the front wheels steer
      const wx = R.pos.x + r[0] * x - f[0] * z, wz = R.pos.z + r[1] * x - f[1] * z;
      this.stamp(this.tracks, wx, wz, R.yaw - R.steer * s);
    }
  }

  // ---------------- Effects ----------------
  kickDust(p, n, speed, vx = 0, vz = 0) {
    const D = this.dust;
    for (let k = 0; k < n; k++) {
      const i = D.i = (D.i + 1) % D.n, a = Math.random() * Math.PI * 2, s = speed * (0.4 + Math.random() * 0.8), up = 0.5 + Math.random() * 0.9;
      D.pos[i * 3] = p.x + Math.cos(a) * 0.25; D.pos[i * 3 + 1] = p.y + 0.05; D.pos[i * 3 + 2] = p.z + Math.sin(a) * 0.25;
      D.vel[i * 3] = Math.cos(a) * s + vx; D.vel[i * 3 + 1] = s * up; D.vel[i * 3 + 2] = Math.sin(a) * s + vz; D.life[i] = 1;
      const sh = 0.8 + Math.random() * 0.35, C = this.dustCol; D.col.set([C.r * sh, C.g * sh, C.b * sh, 0.9], i * 4);
    }
  }
  // Cold-gas puffs from the jetpack nozzles, blown opposite to the thrust
  puffGas(n) {
    const D = this.dust, P = this.p, bx = Math.sin(P.yaw), bz = Math.cos(P.yaw);
    for (let k = 0; k < n; k++) {
      const i = D.i = (D.i + 1) % D.n, j = i * 3;
      D.pos[j] = P.pos.x + bx * 0.32 + (Math.random() - 0.5) * 0.2; D.pos[j + 1] = P.pos.y + 1.05; D.pos[j + 2] = P.pos.z + bz * 0.32 + (Math.random() - 0.5) * 0.2;
      D.vel[j] = P.vel.x + bx * 0.6 + (Math.random() - 0.5) * 0.5; D.vel[j + 1] = P.vel.y - 2.5 - Math.random() * 1.5; D.vel[j + 2] = P.vel.z + bz * 0.6 + (Math.random() - 0.5) * 0.5;
      D.life[i] = 0.25; D.col.set([0.85, 0.9, 1, 0.9], i * 4);
    }
  }
  stepEffects(dt) {
    const D = this.dust, g = this.g, rho = this.body.atm.rho, t = this.terrain;
    // Dust grains: in vacuum they follow exact parabolas; on Titan, drag makes them hang and drift.
    const k = rho > 0.5 ? 2.5 : 0; const wind = rho > 0.5 ? 0.3 : 0;
    for (let i = 0; i < D.n; i++) {
      if (D.life[i] <= 0) continue;
      const j = i * 3; D.vel[j + 1] -= g * dt;
      if (k) { const f = Math.exp(-k * dt); D.vel[j] = D.vel[j] * f + wind * (1 - f); D.vel[j + 1] *= f; D.vel[j + 2] *= f; }
      D.pos[j] += D.vel[j] * dt; D.pos[j + 1] += D.vel[j + 1] * dt; D.pos[j + 2] += D.vel[j + 2] * dt;
      D.life[i] -= dt / (k ? 5 : 8); D.col[i * 4 + 3] = Math.min(0.9, D.life[i] * 3);
      if (D.life[i] <= 0 || D.pos[j + 1] < t.h(D.pos[j], D.pos[j + 2])) { D.life[i] = 0; D.pos[j + 1] = -1e5; }
    }
    // jetpack exhaust: a fixed number of puffs per second of simulated time, whatever the frame rate
    if (this.thrusting) { this.gasAcc = (this.gasAcc || 0) + 50 * dt; const n = Math.min(40, this.gasAcc | 0); this.gasAcc -= n; if (n) this.puffGas(n); } else this.gasAcc = 0;
    this.dustPts.geometry.attributes.position.needsUpdate = true; this.dustPts.geometry.attributes.color.needsUpdate = true;
    // Hammer & feather
    if (this.drop) this.stepDrop(dt);
    // pulsing sample rings
    const pulse = 1 + Math.sin(performance.now() / 300) * 0.12; for (const o of this.sampleObjs) o.userData.ring.scale.setScalar(pulse);
  }
  // Suit-conducted sound: jetpack hiss and rover motor whine (footsteps are played from footstep()).
  sounds(dt) {
    this._sndT = (this._sndT || 0) - dt; if (this._sndT > 0) return;
    if (this.thrusting) { bus.emit('sfx', 'jet'); this._sndT = 0.12; }
    else if (this.driving && Math.abs(this.rv.u) > 0.2) { bus.emit('sfx', 'rover'); this._sndT = Math.max(0.12, 0.45 - Math.abs(this.rv.u) * 0.08); }
  }

  // ---------------- Hammer–feather drop (Apollo 15 experiment) ----------------
  startDrop() {
    if (this.intro > 0 || this.drop || this.driving) return;
    const P = this.p, f = new THREE.Vector3(-Math.sin(P.yaw), 0, -Math.cos(P.yaw));
    const base = P.pos.clone().add(f.multiplyScalar(0.7)); const hgt = 1.6;
    const mk = (geo, color, dx) => { const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color, roughness: 0.6 })); m.castShadow = true; m.position.set(base.x + dx, base.y + hgt, base.z); this.scene.add(m); return m; };
    const hammer = mk(new THREE.BoxGeometry(0.06, 0.32, 0.06), 0x777777, -0.2), feather = mk(new THREE.PlaneGeometry(0.05, 0.22), 0xeae6de, 0.2);
    feather.material.side = THREE.DoubleSide;
    // mass (kg) and drag area Cd·A (m²): 1.32 kg geological hammer, 0.03 g falcon feather
    this.drop = { t: 0, items: [{ m: hammer, mass: 1.32, cda: 0.004, v: 0, done: 0, ground: this.supportAt(base.x - 0.2, base.z, base.y) }, { m: feather, mass: 0.00003, cda: 0.002, v: 0, done: 0, ground: this.supportAt(base.x + 0.2, base.z, base.y) }], h: hgt };
    this.say('🪶 Dropping a 1.32 kg hammer and a 0.03 g feather from 1.6 m…');
  }
  stepDrop(dt) {
    const d = this.drop, rho = this.body.atm.rho; d.t += dt;
    for (const it of d.items) {
      if (it.done) continue;
      if (rho > 0) { // exact solution for fall with quadratic drag (stable at any time step)
        const vt = Math.sqrt(2 * it.mass * this.g / (rho * it.cda)); const a = Math.atanh(Math.min(0.999999, it.v / vt));
        it.v = vt * Math.tanh(a + this.g * dt / vt);
      } else it.v += this.g * dt;
      it.m.position.y -= it.v * dt; if (it === d.items[1]) { it.m.rotation.z += dt * (rho ? 2 : 0); it.m.position.x += rho ? Math.sin(d.t * 2) * 0.05 * dt : 0; }
      if (it.m.position.y <= it.ground + 0.03) { it.m.position.y = it.ground + 0.03; it.done = d.t; }
    }
    if (d.items.every(i => i.done)) {
      const [hm, fe] = d.items, tv = Math.sqrt(2 * d.h / this.g);
      const tEarthVac = Math.sqrt(2 * d.h / G_EARTH);
      const msg = rho > 0.5
        ? `Hammer: ${hm.done.toFixed(2)} s · Feather: ${fe.done.toFixed(1)} s. Titan's thick air slows the feather to a drift (vacuum time would be ${tv.toFixed(2)} s for both).`
        : `Hammer: ${hm.done.toFixed(2)} s · Feather: ${fe.done.toFixed(2)} s — they land together, as Galileo predicted. With no air, mass doesn't matter. On Earth (vacuum) the fall would take ${tEarthVac.toFixed(2)} s.`;
      this.say('⚖️ ' + msg, 9000); log(`Drop test on ${this.body.name}: ${msg}`, '🪶');
      this.markObj('drop');
      const items = d.items;
      // the props lie on the ground for a few seconds, then are removed and freed (geometry and material)
      clearTimeout(this._dropT);
      this._dropT = setTimeout(() => { if (this.disposed) return; items.forEach(i => { this.scene.remove(i.m); i.m.geometry.dispose(); i.m.material.dispose(); }); }, 6000);
      this.drop = null;
    }
  }

  // ---------------- Camera ----------------
  updateCamera(dt) {
    const cam = this.camera, t = this.terrain;
    const focus = this.driving ? this.rv.pos.clone().add(new THREE.Vector3(0, 1.6, 0)) : this.p.pos.clone().add(new THREE.Vector3(0, 1.45, 0));
    // astronaut pose (walking poses are advanced per physics step in animStep)
    const P = this.p, a = this.astro;
    const adt = Math.min(0.25, this.simDt ?? dt), sp = Math.hypot(P.vel.x, P.vel.z);
    if (this.driving) { a.visible = true; a.position.copy(this.roverObj.position); a.quaternion.copy(this.roverObj.quaternion); a.translateY(0.49); a.translateX(-0.4); a.translateZ(0.2); /* hips on the left seat cushion, back against the seat back (it used to hover above and in front of it) */ this.anim.update(adt, { seated: true, speed: 0, ground: true, g: this.g }); }
    else a.visible = !this.fp;
    // camera drifts back behind you when you move (unless you've just dragged it)
    if (this.intro <= 0 && !this.fp && performance.now() - (this.dragT || 0) > 1800) {
      const inp = this.input(); let want = null, rate = 0;
      if (this.driving && Math.abs(this.rv.u) > 0.3) { want = this.rv.yaw; rate = 1.6; }
      else if (!this.driving && P.ground && sp > 0.4 && inp.y > 0.3 && Math.abs(inp.x) < 0.4) { want = P.yaw; rate = 0.6; }
      if (want !== null) { const d = Math.atan2(Math.sin(want - this.camYaw), Math.cos(want - this.camYaw)); this.camYaw += d * Math.min(1, dt * rate); }
    }
    if (this.intro > 0) {
      this.intro -= this.rdt || dt; const k = Math.max(0, this.intro / 3.2), e = k * k;
      const off = new THREE.Vector3(Math.sin(this.camYaw) * Math.cos(this.camPitch), Math.sin(this.camPitch), Math.cos(this.camYaw) * Math.cos(this.camPitch)).multiplyScalar(this.camDist);
      cam.position.copy(focus).add(off).add(new THREE.Vector3(0, 260 * e, 120 * e)); cam.lookAt(focus);
      if (this.intro <= 0) {
        this.resetJump(); // keys pressed during the fly-in must not fire a jump the moment it ends
        this.say(`Contact. Welcome to ${this.site.name}. Gravity here is ${this.g} m/s² — ${(this.g / G_EARTH * 100).toFixed(this.g < 0.1 ? 2 : 0)}% of Earth's.`, 6000);
      }
    } else if (this.fp && !this.driving) {
      cam.position.copy(P.pos).add(new THREE.Vector3(0, 1.62, 0));
      cam.rotation.set(-this.camPitch + 0.1, this.camYaw, 0, 'YXZ');
    } else {
      const off = new THREE.Vector3(Math.sin(this.camYaw) * Math.cos(this.camPitch), Math.sin(this.camPitch), Math.cos(this.camYaw) * Math.cos(this.camPitch)).multiplyScalar(this.camDist);
      const want = focus.clone().add(off);
      // keep the view line clear: pull the camera in front of rocks, models, the rover and terrain between it and you
      const hit = this.camClip(focus, want); if (hit < 1) want.lerpVectors(focus, want.clone(), hit);
      const gh = t.h(want.x, want.z) + 0.5; if (want.y < gh) want.y = gh;
      if (this.camSnap) { cam.position.copy(want); this.camSnap = false; } else cam.position.lerp(want, 1 - Math.exp(-dt * 14));
      // the smoothed position must not slip behind an obstacle or under the ground either
      const hit2 = this.camClip(focus, cam.position); if (hit2 < 1) cam.position.lerpVectors(focus, cam.position.clone(), hit2);
      const ch = t.h(cam.position.x, cam.position.z) + 0.3; if (cam.position.y < ch) cam.position.y = ch;
      cam.lookAt(focus);
      const fov = 60 + (!this.driving && sp > 1.6 ? Math.min(6, (sp - 1.6) * 5) : 0) + (this.driving ? Math.min(5, Math.abs(this.rv.u) * 1.4) : 0);
      if (Math.abs(cam.fov - fov) > 0.05) { cam.fov += (fov - cam.fov) * Math.min(1, dt * 3); cam.updateProjectionMatrix(); }
    }
    // keep the shadow camera on the player
    const fpos = this.driving ? this.rv.pos : P.pos;
    const look = new THREE.Vector3(); cam.getWorldDirection(look);
    this.lamp.intensity += ((this.p.inSun ? 0 : 40) - this.lamp.intensity) * Math.min(1, dt * 4);
    this.lamp.position.copy(fpos).add(new THREE.Vector3(0, 1.7, 0)); this.lamp.target.position.copy(fpos).addScaledVector(look.setY(Math.min(look.y, -0.15)).normalize(), 12);
    this.sun.position.copy(fpos).add(this.sunDir.clone().multiplyScalar(300)); this.sun.target.position.copy(fpos);
  }
  // Fraction (0–1) of the way from a to b that is clear of rocks, model parts, the parked rover and terrain.
  camClip(a, b) {
    const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z, len = Math.hypot(dx, dy, dz) || 1; let tm = 1;
    for (const c of this.nearRocks) if (c.rMax > 0.2) tm = Math.min(tm, segRock(c, a.x, a.y, a.z, dx, dy, dz));
    for (const bx of this.nearBoxes) tm = Math.min(tm, segBox(bx, a.x, a.y, a.z, dx, dy, dz));
    if (this.rv && !this.driving) { const R = this.rv.pos; tm = Math.min(tm, segBox({ x0: R.x - 1.4, y0: R.y, z0: R.z - 1.4, x1: R.x + 1.4, y1: R.y + 1.3, z1: R.z + 1.4 }, a.x, a.y, a.z, dx, dy, dz)); }
    for (let i = 1; i <= 16; i++) { const f = i / 16; if (a.y + dy * f < this.terrain.h(a.x + dx * f, a.z + dz * f) + 0.25) { tm = Math.min(tm, (i - 1) / 16); break; } }
    return tm >= 1 ? 1 : Math.max(0, tm - 0.3 / len); // stop just in front of the obstacle
  }

  // ---------------- Objectives & interactions ----------------
  markObj(id) {
    const o = this.site.objectives.find(x => !this.objDone.has(x.id) && (x.id === id || x.type === id));
    if (!o) return false;
    // done out of order: remember it, and complete it as soon as its prerequisite is
    if (o.after && !this.objDone.has(o.after)) { this.pendingEv.add(o.id); return false; }
    this.pendingEv.delete(o.id);
    this.objDone.add(o.id); this.rec.obj = [...this.objDone]; save();
    bus.emit('sfx', 'correct'); toast({ icon: '✅', title: 'Objective complete', text: o.text, ms: 2600 }); addXP(15, o.text);
    gameEvent('surface:objective', { id: `${this.site.id}:${o.id}` });
    this.renderObjectives();
    if (this.site.objectives.every(x => this.objDone.has(x.id)) && !this.rec.complete) {
      this.rec.complete = true; save();
      log(`Expedition complete: ${this.site.name}`, '🏁');
      // expedition reward (this used to come from the Free Explore mission list, which is gone)
      setTimeout(() => { if (this.site.reward?.xp) addXP(this.site.reward.xp, `Expedition complete: ${this.site.name}`); if (this.site.badge) awardBadge(this.site.badge); checkBadges(); gameEvent('surface:complete', { id: this.site.id }); }, 600);
    }
    return true;
  }
  checkObjectives(dt) {
    if (this.intro > 0) return; // nothing counts until you're on the ground and in control
    const s = this.site, P = this.driving ? this.rv.pos : this.p.pos, st = this.state;
    for (const o of s.objectives) {
      if (this.objDone.has(o.id)) continue;
      if (o.after && !this.objDone.has(o.after)) continue;
      // an objective that unlocks later only counts what you do after it unlocks
      let base = null; if (o.after) base = this.objBase[o.id] || (this.objBase[o.id] = { ...st, samples: this.rec.samples.length, t: performance.now() });
      let ok = this.pendingEv.has(o.id);
      if (!ok) switch (o.type) {
        case 'walk': ok = st.walked - (base ? base.walked : 0) >= o.n; break;
        case 'jump': ok = base ? st.lastJumpAt > base.t && st.lastJump >= o.n : st.maxJump >= o.n; break;
        case 'drive': ok = st.driven - (base ? base.driven : 0) >= o.n; break;
        case 'air': ok = base ? st.lastAirAt > base.t && st.lastAir >= o.n : st.airMax >= o.n; break;
        case 'jet': ok = st.jetUsed - (base ? base.jetUsed : 0) >= o.n; break;
        case 'samples': ok = this.rec.samples.length - (base ? base.samples : 0) >= o.n; break;
        case 'sample': ok = this.rec.samples.includes(o.sample); break;
        case 'shadow': { const c = s.pois.find(p => p.id === 'crest'); ok = !this.p.inSun && this.terrain.h(P.x, P.z) < (c ? this.terrain.h(c.x, c.z) : this.terrain.h(0, 0)) - 40; break; }
        case 'reach': { const p = s.pois.find(q => q.id === o.poi); ok = p && Math.hypot(P.x - p.x, P.z - p.z) < p.r; break; }
        case 'look': if (this.parentDir) { const f = new THREE.Vector3(); this.camera.getWorldDirection(f); ok = f.angleTo(this.parentDir) < Math.max(9, s.parent.ang / 2 + 6) * DEG; } break;
      }
      if (ok) this.markObj(o.id);
    }
    // POI facts when you arrive
    for (const p of s.pois) if (!this.facts.has(p.id) && Math.hypot(P.x - p.x, P.z - p.z) < p.r) { this.facts.add(p.id); this.say(`${p.icon} ${p.name}: ${p.fact}`, 9000); }
    // dose limit
    if (this.body.dose && st.dose > DOSE_LIMIT) { this.warn(`☢️ Radiation dose reached ${DOSE_LIMIT} mSv (NASA's 30-day limit). Evacuating to the lander shelter — your dose is reset.`, 7000); st.dose = 0; this.evacuate(); }
    // refuel at the lander
    if (this.body.jetpack && this.site.lander && Math.hypot(P.x - this.site.lander.x, P.z - this.site.lander.z) < 15 && this.p.ground) this.p.fuel = Math.min(40, this.p.fuel + dt * 8);
    // interaction prompt
    let prompt = '';
    this.near = null;
    if (!this.driving) {
      for (const o of this.sampleObjs) { const sp = o.userData.sp; if (Math.hypot(P.x - sp.x, P.z - sp.z) < 2.6) { this.near = { kind: 'sample', o }; prompt = `E — collect ${sp.name}`; break; } }
      if (!this.near && this.rv && P.distanceTo(this.rv.pos) < 3.6) { this.near = { kind: 'rover' }; prompt = `E — board the ${this.site.rover.name}`; }
      if (!this.near) { // any loose rock within reach
        let best = null, bd = 1e9; for (const r of this.nearRocks) { const d = Math.hypot(P.x - r.x, P.z - r.z) - Math.max(r.ex, r.ez); if (d < 1.3 && d < bd && (r.sz <= ROCK_LIFT || !this.rec.samples.includes('chip:' + r.id))) { bd = d; best = r; } }
        if (best) { this.near = { kind: 'rock', r: best }; prompt = best.sz <= ROCK_LIFT ? 'E — pick up the rock' : 'E — chip a sample off the boulder'; }
      }
    } else prompt = 'E — get off the rover';
    if (prompt !== this._prompt) { this._prompt = prompt; const el = this.hud.prompt; el.textContent = prompt; el.hidden = !prompt; }
  }
  // Radiation evacuation: out of the rover (parked, brake on) and back to the lander shelter.
  evacuate() { if (this.driving) this.leaveRover(); this.respawn(); }
  interact() {
    if (this.intro > 0) return;
    if (this.driving) return this.toggleRover();
    if (!this.near) return;
    if (this.near.kind === 'rover') return this.toggleRover();
    if (this.near.kind === 'rock') return this.takeRock(this.near.r);
    const o = this.near.o, sp = o.userData.sp;
    if (sp.needsShadow && this.sunNow()) return this.warn('This ice would sublimate in sunlight — the sample must come from the permanently shadowed ground.');
    this.rec.samples.push(sp.id); save();
    this.scene.remove(o); o.userData.rock.material.dispose(); // geometry and ring are shared: freed in dispose()
    this.sampleObjs = this.sampleObjs.filter(x => x !== o); this.near = null;
    bus.emit('sfx', 'scan'); addXP(20, 'Sample collected'); log(`Collected ${sp.name} on ${this.body.name}`, '🪨');
    this.say(`🪨 ${sp.name}: ${sp.fact}`, 9000);
    this.renderObjectives();
  }
  // Loose rocks: small ones go into the sample bag (the rock disappears and its collider goes with it); boulders give one chip each
  takeRock(r) {
    const lift = r.sz <= ROCK_LIFT;
    this.rec.samples.push(lift ? r.id : 'chip:' + r.id); save(); this.near = null; this._prompt = null;
    if (lift) { r.im.setMatrixAt(r.ii, ZERO_M); r.im.instanceMatrix.needsUpdate = true; this.rocks = this.rocks.filter(x => x !== r); this.nearRocks = this.nearRocks.filter(x => x !== r); }
    const n = this.rec.samples.filter(x => /^(rk|chip:)/.test(x)).length;
    bus.emit('sfx', 'scan'); addXP(5, lift ? 'Rock collected' : 'Boulder sample chipped');
    this.say(lift ? `🪨 Rock bagged (${n} in your sample bag). Every rock tells part of the Moon's history.` : `🔨 Chipped a sample off the boulder (${n} in your sample bag).`, 3500);
    this.renderObjectives();
  }
  scan() {
    if (this.intro > 0 || this.scanning) return;
    this.scanning = true; bus.emit('sfx', 'scan'); this.say('🔬 Scanning…', 1400);
    this._scanT = setTimeout(() => {
      this.scanning = false; if (this.disposed) return;
      // the reading is taken where you are when the scan finishes
      const P = this.driving ? this.rv.pos : this.p.pos, inSun = this.sunNow();
      const z = this.site.zones.find(z => Math.hypot(P.x - z.x, P.z - z.z) < z.r && (!z.needsShadow || !inSun));
      if (z) { this.say('🔬 ' + z.result, 10000); log(`${this.site.name} scan: ${z.result}`, '🔬'); const o = this.site.objectives.find(o => o.type === 'scan' && o.zone === z.id); if (o) this.markObj(o.id); }
      else {
        const zz = this.site.zones[0]; const hint = zz ? (zz.needsShadow ? ' Try again inside the permanent shadow.' : ` Try near the ${this.site.pois.find(p => Math.hypot(p.x - zz.x, p.z - zz.z) < 60)?.name || 'marked area'}.`) : '';
        this.say(`🔬 Reading: ${inSun ? 'sunlit' : 'in shadow'}, ${inSun ? this.temp.sun : this.temp.shade}. Gravity ${this.g} m/s². Atmosphere: ${this.body.atm.label}.${hint}`, 8000);
      }
    }, 1300);
  }
  warn(text, ms = 4500) { const n = performance.now(); if (this._lastWarn === text && n - this._lastWarnT < 4000) return; this._lastWarn = text; this._lastWarnT = n; toast({ icon: '⚠️', title: 'Warning', text, ms }); bus.emit('sfx', 'wrong'); }
  edgeWarn() { this.warn('Edge of the mapped area — this is as far as the survey data for this site goes.'); }
  say(text, ms = 5000) { const el = this.hud.say; el.textContent = text; el.hidden = false; clearTimeout(this._sayT); this._sayT = setTimeout(() => { el.hidden = true; }, ms); }

  // ---------------- HUD ----------------
  buildHUD(screen) {
    const s = this.site, b = this.body;
    const objs = h('ol', { class: 'sx-objs' });
    const hud = this.hud = {
      objs, say: h('div', { class: 'sx-say glass', 'aria-live': 'polite', hidden: true }), prompt: h('div', { class: 'sx-prompt', hidden: true }),
      tele: h('div', { class: 'sx-tele' }), jump: h('div', { class: 'sx-jump muted tiny' }), compass: h('div', { class: 'sx-compass', 'aria-hidden': 'true' }), mini: h('canvas', { class: 'sx-mini', width: 150, height: 150, 'aria-label': 'Site map — press M', role: 'button', tabindex: 0 })
    };
    const g = this.g, gE = (g / G_EARTH);
    const info = h('div', { class: 'sx-info glass' },
      h('div', { class: 'sx-title' }, h('b', {}, s.name), h('small', { class: 'muted' }, s.subtitle)),
      h('div', { class: 'sx-stats' },
        h('span', { title: 'Surface gravity' }, `⬇ ${g} m/s² (${gE < 0.01 ? (gE * 100).toFixed(2) : (gE * 100).toFixed(0)}% Earth)`),
        h('span', { title: 'Escape velocity' }, `🚀 escape ${b.escape >= 1000 ? (b.escape / 1000).toFixed(2) + ' km/s' : b.escape + ' m/s'}`),
        h('span', { class: 'sx-temp' }, ''), b.dose ? h('span', { class: 'sx-dose' }, '') : null),
      hud.tele, hud.jump);
    const objBox = h('div', { class: `sx-objbox glass ${this.mobile ? 'collapsed' : ''}` }, h('button', { class: 'sx-objhead', 'aria-label': 'Show or hide all objectives', onclick: () => objBox.classList.toggle('collapsed') }, h('b', {}, 'Objectives'), h('small', { class: 'muted sx-objcount' }, '')), objs, hud.mini);
    const btn = (label, title, fn, cls = '') => h('button', { class: `sx-btn ${cls}`, title, 'aria-label': title, onclick: e => { e.currentTarget.blur(); fn(); } }, label);
    const jumpBtn = h('button', { class: 'sx-btn sx-jumpbtn', 'aria-label': 'Jump (hold to charge)', title: 'Jump — hold Space to charge' }, '⤒');
    jumpBtn.addEventListener('pointerdown', e => { e.preventDefault(); this.pressJump(); }); for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) jumpBtn.addEventListener(ev, () => this.releaseJump());
    const actions = h('div', { class: 'sx-actions' },
      btn('E', 'Interact: collect sample / board rover (E)', () => this.interact()),
      btn('🔬', 'Scan (R)', () => this.scan()),
      btn('🪶', 'Hammer–feather drop test (G)', () => this.startDrop()),
      btn('👁', 'First / third person (V)', () => { this.fp = !this.fp; }),
      btn('🗺', 'Site map (M)', () => this.openMap()),
      b.jetpack ? (() => { const d = h('button', { class: 'sx-btn', 'aria-label': 'Jetpack down thrust (C)', title: 'Jetpack down (C)' }, '⤓'); d.addEventListener('pointerdown', () => { this.downHeld = true; }); for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) d.addEventListener(ev, () => { this.downHeld = false; }); return d; })() : null,
      jumpBtn);
    this.warnBtn = s.timeWarp || b.g < 0.5 ? btn('×1', 'Time warp (T): physics stays real, time runs faster', () => this.cycleWarp(), 'sx-warp') : null;
    const top = h('div', { class: 'sx-top' }, btn('⏏ Lift off', 'Return to orbit', () => this.exit(), 'sx-exit'), this.warnBtn, btn('❔', 'Controls (H)', () => this.help()));
    const joy = h('div', { class: 'joystick sx-joy', 'aria-label': 'Movement joystick' }, h('div', { class: 'stick' }));
    screen.append(info, objBox, hud.compass, hud.say, hud.prompt, actions, top, joy);
    this.bindJoystick(joy); this.renderObjectives(); this.drawMiniBase();
    hud.mini.addEventListener('click', () => this.openMap());
  }
  renderObjectives() {
    const ol = this.hud.objs; ol.innerHTML = ''; let done = 0;
    for (const o of this.site.objectives) {
      const d = this.objDone.has(o.id); if (d) done++;
      const isNext = !d && !ol.querySelector('.next');
      let extra = '';
      if (!d && o.type === 'samples') extra = ` (${Math.min(o.n, this.rec.samples.length)}/${o.n})`;
      ol.append(h('li', { class: d ? 'done' : isNext ? 'next' : '' }, (d ? '✓ ' : '○ ') + o.text + extra));
    }
    this.hud.objs.parentElement.querySelector('.sx-objcount').textContent = `${done}/${this.site.objectives.length}`;
  }
  hudTick(dt) {
    this._hudT = (this._hudT || 0) - dt; if (this._hudT > 0) return; this._hudT = 0.12;
    const P = this.p, b = this.body;
    const v = this.driving ? Math.abs(this.rv.u) : Math.hypot(P.vel.x, P.vel.z);
    const pos = this.driving ? this.rv.pos : P.pos; const agl = this.driving ? 0 : P.pos.y - this.terrain.h(P.pos.x, P.pos.z);
    let tl = `${this.driving ? '🚙' : '🧑‍🚀'} ${v.toFixed(2)} m/s (${(v * 3.6).toFixed(1)} km/h)`;
    if (!this.driving && !P.ground) tl += ` · ↑ ${agl.toFixed(1)} m`;
    if (this.sliding && P.ground && !this.driving) tl += ' · sliding!';
    if (b.jetpack) tl += ` · ⛽ jet Δv ${P.fuel.toFixed(0)} m/s`;
    if (this.jumpHeld && this.jumpPending && P.ground && !this.driving) tl += ` · charge ${Math.round(Math.min(1, (performance.now() - this.jumpT) / 500) * 100)}%`;
    this.hud.tele.textContent = tl;
    this.hud.jump.textContent = this.jumpInfo || 'Hold Space (or ⤒) to charge a jump.';
    const root = this.hud.tele.parentElement;
    root.querySelector('.sx-temp').textContent = `${P.inSun ? '☀️ sunlit' : '🌑 shadow'} ${P.inSun ? this.temp.sun : this.temp.shade}`;
    if (b.dose) { const d = root.querySelector('.sx-dose'); const ds = this.state.dose; d.textContent = `☢️ ${ds < 1 ? (ds * 1000).toFixed(ds < 0.01 ? 1 : 0) + ' µSv' : ds.toFixed(ds < 10 ? 1 : 0) + ' mSv'} (limit ${DOSE_LIMIT} mSv)`; d.classList.toggle('bad', this.state.dose > DOSE_LIMIT * 0.7); }
    this.drawCompass(); this.drawMini(pos);
  }
  drawCompass() {
    const el = this.hud.compass;
    const heading = ((-this.camYaw / DEG) % 360 + 360) % 360; // bearing the camera looks along
    // one symbol style for every body: the astronomical signs ☉ (Sun) and ⊕ (Earth), each with its name underneath
    const items = [['N', 0], ['E', 90], ['S', 180], ['W', 270], ['☉', this.site.sun.az, 'Sun']];
    if (this.site.parent) items.push(['⊕', this.site.parent.az, this.site.parent.name]);
    const P = this.driving ? this.rv.pos : this.p.pos;
    const next = this.site.objectives.find(o => !this.objDone.has(o.id) && (o.type === 'reach' || o.type === 'sample') && (!o.after || this.objDone.has(o.after)));
    if (next) { const tgt = next.type === 'reach' ? this.site.pois.find(p => p.id === next.poi) : this.site.samples.find(s => s.id === next.sample); if (tgt) { const az = (Math.atan2(tgt.x - P.x, -(tgt.z - P.z)) / DEG + 360) % 360; items.push(['◆', az, `${Math.round(Math.hypot(tgt.x - P.x, tgt.z - P.z))} m`]); } }
    let html = '';
    for (const [l, az, sub] of items) { let d = ((az - heading + 540) % 360) - 180; if (Math.abs(d) > 70) continue; html += `<span style="left:${(50 + d / 70 * 50).toFixed(2)}%" class="${l === '◆' ? 'tgt' : 'NESW'.includes(l) ? 'card' : 'body'}"><b>${l}</b>${sub ? `<small>${sub}</small>` : ''}</span>`; }
    el.innerHTML = html + '<i></i>';
  }
  drawMiniBase() {
    const t = this.terrain, S = 150, cv = document.createElement('canvas'); cv.width = cv.height = S; const c = cv.getContext('2d'); const img = c.createImageData(S, S);
    const E = t.E - 25, sd = this.sunDir; // covers the whole walkable square (±E−30) with a small margin
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const wx = (x / S * 2 - 1) * E, wz = (y / S * 2 - 1) * E; const [gx, gz] = t.grad(wx, wz);
      const n = new THREE.Vector3(-gx, 1, -gz).normalize(); const l = Math.max(0, n.x * 0.5 + n.y * 0.7 + n.z * -0.5);
      const v = 40 + l * 150; img.data.set([v, v, v * 1.05, 255], (y * S + x) * 4);
    }
    c.putImageData(img, 0, 0);
    // boulders big enough to block your way, drawn to scale (at least a dot)
    c.fillStyle = 'rgba(20,18,16,0.85)';
    for (const r of this.rocks) { if (Math.max(r.ex, r.ez) < 0.6) continue; const rad = Math.max(0.7, Math.max(r.ex, r.ez) / E * S * 0.5); c.beginPath(); c.arc((r.x / E * 0.5 + 0.5) * S, (r.z / E * 0.5 + 0.5) * S, rad, 0, 7); c.fill(); }
    this.miniBase = cv; this.miniE = E;
  }
  drawMini(pos) {
    const cv = this.hud.mini, c = cv.getContext('2d'), S = 150, E = this.miniE, m = v => (v / E * 0.5 + 0.5) * S;
    c.drawImage(this.miniBase, 0, 0);
    for (const p of this.site.pois) { c.fillStyle = this.facts.has(p.id) ? '#3fe0a0' : '#ffc857'; c.beginPath(); c.arc(m(p.x), m(p.z), 3, 0, 7); c.fill(); }
    for (const o of this.sampleObjs) { const sp = o.userData.sp; c.fillStyle = '#5ad8ff'; c.fillRect(m(sp.x) - 2, m(sp.z) - 2, 4, 4); }
    if (this.site.lander) { c.strokeStyle = '#fff'; c.strokeRect(m(this.site.lander.x) - 3, m(this.site.lander.z) - 3, 6, 6); }
    const yaw = this.driving ? this.rv.yaw : this.p.yaw; c.save(); c.translate(m(pos.x), m(pos.z)); c.rotate(-yaw); c.fillStyle = '#ff6b81'; c.beginPath(); c.moveTo(0, -6); c.lineTo(4, 4); c.lineTo(-4, 4); c.closePath(); c.fill(); c.restore();
  }
  openMap() {
    const s = this.site, P = this.driving ? this.rv.pos : this.p.pos;
    const big = h('canvas', { width: 300, height: 300, class: 'sx-bigmap' }); big.getContext('2d').drawImage(this.miniBase, 0, 0, 300, 300);
    const E = this.miniE, c = big.getContext('2d'), m = v => (v / E * 0.5 + 0.5) * 300;
    c.fillStyle = '#ff6b81'; c.beginPath(); c.arc(m(P.x), m(P.z), 5, 0, 7); c.fill();
    const speed = this.driving ? this.rv.max : Math.min(3.2, 1.75 * Math.sqrt(this.g));
    const rows = h('div', { class: 'sx-maplist' });
    const targets = [...s.pois.map(p => ({ ...p, kind: 'poi' })), ...this.sampleObjs.map(o => ({ ...o.userData.sp, icon: '🪨', kind: 'sample' }))];
    for (const p of targets) {
      c.fillStyle = p.kind === 'sample' ? '#5ad8ff' : '#ffc857'; c.beginPath(); c.arc(m(p.x), m(p.z), 4, 0, 7); c.fill();
      const d = Math.hypot(p.x - P.x, p.z - P.z);
      const real = d / Math.max(0.05, speed);
      rows.append(h('div', { class: 'mission-row' }, h('div', { class: 'mr-main' }, h('b', {}, `${p.icon || '📍'} ${p.name}`), h('small', {}, `${Math.round(d)} m away · ${this.driving ? 'drive' : 'on foot'} about ${fmtTime(real)}`)),
        d < 40 ? h('small', { class: 'muted' }, 'nearby') : null));
    }
    const mm = openModal({ title: `🗺 ${s.name} site map`, wide: true, body: h('div', { class: 'sx-mapwrap' }, big, h('div', {}, h('p', { class: 'muted tiny' }, 'North is up. Feature sizes come from mission data; positions are approximate. Times show how long the trip takes at your current pace.'), rows)) });
  }
  cycleWarp() { this.warpI = (this.warpI + 1) % WARPS.length; if (this.warnBtn) this.warnBtn.textContent = `×${WARPS[this.warpI]}`; toast({ icon: '⏩', title: `Time ×${WARPS[this.warpI]}`, text: 'Physics is unchanged — the clock just runs faster.', ms: 1800 }); }
  help() {
    openModal({ title: 'Surface controls', body: h('div', { class: 'help-grid' }, ...[
      ['W A S D / arrow keys / joystick', 'Walk (camera-relative) · drive the rover'], ['Shift', 'Lope / run'], ['Space (hold)', 'Charge and jump'],
      ['Mouse drag (left or right button)', 'Look around — the cursor is captured while you drag; sensitivity and invert-Y are in Settings'], ['Touch: drag the right side of the screen', 'Look around'], ['Wheel / pinch', 'Zoom'],
      ['E', 'Collect sample · board / leave rover'], ['R', 'Science scan'], ['G', 'Hammer–feather drop test'], ['M', 'Site map'], ['V', 'First / third person'],
      ...(this.body.jetpack ? [['Space / C in the air', 'Jetpack up / down']] : []), ...(this.warnBtn ? [['T', 'Time warp']] : []),
      ['H', 'This controls list'], ['Esc', 'Pause']
    ].map(([k, v]) => h('div', { class: 'help-row' }, h('kbd', {}, k), h('span', {}, v)))) });
  }
  bindJoystick(j) {
    const stick = j.firstElementChild; let id = null, cx = 0, cy = 0;
    j.addEventListener('pointerdown', e => { id = e.pointerId; j.setPointerCapture(id); const r = j.getBoundingClientRect(); cx = r.left + r.width / 2; cy = r.top + r.height / 2; e.stopPropagation(); });
    j.addEventListener('pointermove', e => { if (e.pointerId !== id) return; let dx = e.clientX - cx, dy = e.clientY - cy; const m = Math.hypot(dx, dy), R = 42; if (m > R) { dx *= R / m; dy *= R / m; } stick.style.transform = `translate(${dx}px,${dy}px)`; this.joy = { x: dx / R, y: dy / R }; });
    const end = e => { if (e.pointerId !== id) return; id = null; stick.style.transform = ''; this.joy = { x: 0, y: 0 }; };
    j.addEventListener('pointerup', end); j.addEventListener('pointercancel', end);
  }

  // ---------------- Input ----------------
  pressJump() { if (this.intro > 0 || this.jumpHeld) return; this.jumpHeld = true; this.jumpT = performance.now(); this.jumpPending = this.p.ground && !this.driving; }
  releaseJump() { if (!this.jumpHeld) return; this.jumpHeld = false; if (this.jumpPending && this.p.ground && !this.driving && this.intro <= 0) this.jumpRelease = Math.max(0.001, (performance.now() - this.jumpT) / 1000); this.jumpPending = false; }
  bindInput() {
    const cv = this.renderer.domElement, ptrs = new Map(); let pinch = 0;
    this._kd = e => {
      if (modalOpen() || /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return; // browser shortcuts (Ctrl+R, Ctrl+C…) are not game actions
      if (e.code === 'Space') { e.preventDefault(); if (!e.repeat) this.pressJump(); return; }
      if (e.repeat) { this.keys.add(e.code); return; }
      this.keys.add(e.code);
      if (e.code.startsWith('Arrow')) e.preventDefault();
      ({ KeyE: () => this.interact(), KeyR: () => this.scan(), KeyG: () => this.startDrop(), KeyV: () => { this.fp = !this.fp; }, KeyM: () => this.openMap(), KeyT: () => this.warnBtn && this.cycleWarp(), KeyC: () => { this.downHeld = true; } })[e.code]?.();
    };
    this._ku = e => { this.keys.delete(e.code); if (e.code === 'Space') this.releaseJump(); if (e.code === 'KeyC') this.downHeld = false; };
    // losing focus (Alt-Tab, switching tabs) drops every held input without firing it
    this._blur = () => { this.keys.clear(); this.resetJump(); this.downHeld = false; this.joy = { x: 0, y: 0 }; if (document.pointerLockElement) document.exitPointerLock(); };
    this._vis = () => { if (document.hidden) this._blur(); };
    addEventListener('keydown', this._kd); addEventListener('keyup', this._ku); addEventListener('blur', this._blur); document.addEventListener('visibilitychange', this._vis);
    const lookBtn = e => e.pointerType !== 'mouse' || e.button === 0 || e.button === 2; // mouse: left or right drag looks
    cv.addEventListener('pointerdown', e => {
      if (!lookBtn(e)) return;
      ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY }); cv.setPointerCapture(e.pointerId);
      if (e.pointerType === 'mouse' && !modalOpen()) { try { cv.requestPointerLock?.()?.catch?.(() => {}); } catch {} }
      if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; pinch = Math.hypot(a.x - b.x, a.y - b.y); }
    });
    cv.addEventListener('pointermove', e => {
      const p = ptrs.get(e.pointerId); if (!p) return;
      if (ptrs.size === 2) { const o = [...ptrs.entries()].find(([k]) => k !== e.pointerId)[1]; const d = Math.hypot(e.clientX - o.x, e.clientY - o.y); if (pinch) this.camDist = Math.max(2.5, Math.min(60, this.camDist * pinch / d)); pinch = d; }
      else {
        const locked = document.pointerLockElement === cv, mx = locked ? e.movementX : e.clientX - p.x, my = locked ? e.movementY : e.clientY - p.y;
        // same feel in first and third person: drag right = look right, drag down = look down (Settings › Invert Y flips it)
        const k = (this.fp ? LOOK.first : LOOK.third) * (settings.sensitivity || 1), inv = settings.invertY ? -1 : 1;
        this.dragT = performance.now(); this.camYaw -= mx * k;
        this.camPitch = Math.max(this.fp ? -1.2 : -0.15, Math.min(1.35, this.camPitch + my * k * inv));
      }
      p.x = e.clientX; p.y = e.clientY;
    });
    const up = e => { ptrs.delete(e.pointerId); pinch = 0; if (!ptrs.size && document.pointerLockElement === cv) document.exitPointerLock(); };
    cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
    cv.addEventListener('wheel', e => { e.preventDefault(); this.camDist = Math.max(2.5, Math.min(60, this.camDist * Math.exp(e.deltaY * 0.001))); }, { passive: false });
    cv.addEventListener('contextmenu', e => e.preventDefault());
  }

  exit() { if (this.disposed) return; this.dispose(); this.onExit?.(this.site); }
  dispose() {
    this.disposed = true; this.running = false; cancelAnimationFrame(this.raf);
    removeEventListener('keydown', this._kd); removeEventListener('keyup', this._ku); removeEventListener('blur', this._blur); removeEventListener('resize', this._onResize);
    document.removeEventListener('visibilitychange', this._vis);
    if (document.pointerLockElement) document.exitPointerLock();
    clearTimeout(this._sayT); clearTimeout(this._dropT); clearTimeout(this._scanT);
    this.scene?.traverse(o => {
      o.geometry?.dispose?.(); if (o.isInstancedMesh) o.dispose(); // frees the per-instance GPU buffers too
      const m = o.material; if (m) [].concat(m).forEach(x => { x.map?.dispose?.(); x.normalMap?.dispose?.(); x.bumpMap?.dispose?.(); x.dispose?.(); });
    });
    for (const x of this.sampleShared || []) x.dispose();
    this.env?.dispose();
    this.renderer?.dispose(); this.renderer?.forceContextLoss?.(); this.renderer?.domElement.remove();
  }
}
const tick = () => new Promise(r => setTimeout(r, 0));
