// ASTRO LAB — main-menu backdrop: the Moon in front of a slowly turning Earth, in a field of stars.
// Replaces the Free Explore solar system that used to sit behind the menu.
import * as THREE from '../../vendor/three.module.js';

export class MenuBackdrop {
  constructor(root, textures) {
    this.root = root; this.active = true;
    const r = this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'low-power' });
    r.setPixelRatio(Math.min(devicePixelRatio || 1, 2)); r.outputColorSpace = THREE.SRGBColorSpace;
    root.append(r.domElement);
    const scene = this.scene = new THREE.Scene(); scene.background = new THREE.Color(0x03040c);
    this.camera = new THREE.PerspectiveCamera(40, 1, 0.1, 2000); this.camera.position.set(0, 0.4, 9);
    const tex = id => { const c = textures?.[id]; if (!c) return null; const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; };
    // the Moon, large and close, lit from the side so its craters read
    this.moon = new THREE.Mesh(new THREE.SphereGeometry(2.1, 96, 64), new THREE.MeshStandardMaterial({ map: tex('moon'), color: tex('moon') ? 0xffffff : 0x9a9792, roughness: 1 }));
    this.moon.position.set(2.6, -0.6, 0); scene.add(this.moon);
    // Earth, small and far behind
    this.earth = new THREE.Mesh(new THREE.SphereGeometry(0.75, 64, 48), new THREE.MeshStandardMaterial({ map: tex('earth'), color: tex('earth') ? 0xffffff : 0x3a6ea5, roughness: 0.8 }));
    this.earth.position.set(5.4, 3.3, -16); this.earth.rotation.z = 0.41; scene.add(this.earth);
    const sun = new THREE.DirectionalLight(0xfff4e6, 3.0); sun.position.set(-8, 3, 2); scene.add(sun);
    scene.add(new THREE.AmbientLight(0x223044, 0.35));
    // stars
    const n = 2500, pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { const u = Math.random() * 2 - 1, a = Math.random() * Math.PI * 2, s = Math.sqrt(1 - u * u), d = 600; pos[i * 3] = s * Math.cos(a) * d; pos[i * 3 + 1] = u * d; pos[i * 3 + 2] = s * Math.sin(a) * d; }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    scene.add(new THREE.Points(g, new THREE.PointsMaterial({ color: 0xffffff, size: 1.4, sizeAttenuation: false, transparent: true, opacity: 0.8 })));
    this.resize = this.resize.bind(this); addEventListener('resize', this.resize); this.resize();
    let last = performance.now();
    const loop = now => { const dt = Math.min(0.1, (now - last) / 1000); last = now; if (this.active) { this.moon.rotation.y += dt * 0.03; this.earth.rotation.y += dt * 0.08; r.render(scene, this.camera); } this.raf = requestAnimationFrame(loop); };
    this.raf = requestAnimationFrame(loop);
  }
  resize() {
    const w = this.root.clientWidth || innerWidth, h = this.root.clientHeight || innerHeight;
    this.renderer.setSize(w, h, false); this.camera.aspect = w / h;
    // keep the Moon on the right-hand side, clear of the menu card, on narrow screens too
    this.moon.position.x = w / h < 1 ? 0.9 : 2.6; this.camera.updateProjectionMatrix();
  }
  // the 3D view only renders while a screen that shows it is open (menu); career and surface have their own renderers
  setActive(on) { this.active = on; }
}
