// ASTRO LAB Career — shared outer-space backdrop for the simulators: stars, a procedural Earth with clouds and a thin atmosphere, and sunlight.
import * as THREE from '../../../vendor/three.module.js';

let earthTex = null;
function makeEarthTex() {
  if (earthTex) return earthTex;
  const c = document.createElement('canvas'); c.width = 1024; c.height = 512; const x = c.getContext('2d');
  x.fillStyle = '#123a7a'; x.fillRect(0, 0, 1024, 512);
  // continents: blobs of green/brown, seeded so they look the same every time
  let s = 7; const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  for (let k = 0; k < 14; k++) { const cx = rnd() * 1024, cy = 90 + rnd() * 330, n = 30 + rnd() * 50; for (let i = 0; i < n; i++) { const a = rnd() * 6.28, r = rnd() * 70; x.fillStyle = rnd() < 0.6 ? '#3e7a3a' : '#a08a52'; x.beginPath(); x.ellipse(cx + Math.cos(a) * r, cy + Math.sin(a) * r * 0.7, 18 + rnd() * 30, 10 + rnd() * 20, rnd() * 3, 0, 6.28); x.fill(); } }
  x.fillStyle = '#f2f6ff'; x.fillRect(0, 0, 1024, 30); x.fillRect(0, 482, 1024, 30);
  for (let i = 0; i < 260; i++) { x.fillStyle = `rgba(255,255,255,${0.25 + rnd() * 0.45})`; x.beginPath(); x.ellipse(rnd() * 1024, rnd() * 512, 20 + rnd() * 60, 4 + rnd() * 10, rnd() * 0.6, 0, 6.28); x.fill(); }
  earthTex = new THREE.CanvasTexture(c); earthTex.colorSpace = THREE.SRGBColorSpace; return earthTex;
}
export function spaceBackdrop(scene, { earthPos = [0, -60, -80], earthR = 50, sun = [80, 40, 30], stars = 1800, center = [0, 0, 0] } = {}) {
  const pos = new Float32Array(stars * 3);
  for (let i = 0; i < stars; i++) { const u = Math.random() * 2 - 1, a = Math.random() * Math.PI * 2, r = 300, q = Math.sqrt(1 - u * u); pos.set([r * q * Math.cos(a), r * u, r * q * Math.sin(a)], i * 3); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  // the star sphere is re-centred on the camera every frame (radius 300, inside the 400 m far plane): before, when the player
  // stood away from its centre, stars straight ahead lay beyond the far plane and vanished around the middle of the view
  const st = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xffffff, size: 1.6, sizeAttenuation: false, fog: false, depthWrite: false })); st.position.set(...center); st.frustumCulled = false; st.renderOrder = -1;
  st.onBeforeRender = (r, s, cam) => { st.position.copy(cam.position); st.updateMatrixWorld(); }; scene.add(st);
  const earth = new THREE.Mesh(new THREE.SphereGeometry(earthR, 64, 40), new THREE.MeshStandardMaterial({ map: makeEarthTex(), roughness: 0.9, emissive: 0x0a1a3a, emissiveIntensity: 0.25 }));
  earth.position.set(...earthPos); earth.rotation.z = 0.4; scene.add(earth);
  const atm = new THREE.Mesh(new THREE.SphereGeometry(earthR * 1.025, 48, 32), new THREE.MeshBasicMaterial({ color: 0x6ab8ff, transparent: true, opacity: 0.18, side: THREE.BackSide })); atm.position.copy(earth.position); scene.add(atm);
  const sl = new THREE.DirectionalLight(0xfff6e8, 2.4); sl.position.set(...sun); sl.target.position.set(...center); scene.add(sl, sl.target);
  return { earth, atm, stars: st, sun: sl, update: dt => { earth.rotation.y += dt * 0.004; } };
}
