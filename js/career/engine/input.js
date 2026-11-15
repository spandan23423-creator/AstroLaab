// ASTRO LAB Career — unified input: keyboard + mouse (pointer lock with drag fallback), touch (joystick + look pad + buttons), gamepad.
import { settings } from '../../systems/core.js';
import { h } from '../../ui/dom.js';

const ACTION_KEYS = {
  use: ['KeyE', 'Enter'], drop: ['KeyG'], throw: ['KeyT'], skip: ['KeyX', 'Backspace'], spray: ['KeyF', 'Mouse0'], rotate: ['KeyR'], rotateBack: ['KeyQ'], crouch: ['KeyC', 'ControlLeft'], sprint: ['ShiftLeft', 'ShiftRight'],
  jump: ['Space'], inventory: ['KeyI', 'Tab'], help: ['KeyH'], objectives: ['KeyO'], letter: ['KeyL'], one: ['Digit1'], two: ['Digit2'], three: ['Digit3'], four: ['Digit4']
};
const PAD = { use: 0, back: 1, skip: 1, rotate: 2, drop: 3, inventory: 4, throw: 5, spray: 7, crouch: 10, sprint: 11, pause: 9, help: 8 }; // standard mapping (A, B, X, Y, LB, RB, L3, R3, Start, Select)

export class Input {
  constructor(root, canvas) {
    this.root = root; this.canvas = canvas;
    this.keys = new Set(); this.pressed = new Set(); this.move = { x: 0, y: 0 }; this.look = { x: 0, y: 0 };
    this.joy = { x: 0, y: 0 }; this.locked = false; this.enabled = true; this.dragging = null; this.padPrev = [];
    this.lastDevice = document.body.classList.contains('touch') ? 'touch' : 'kbm';
    this.touch = document.body.classList.contains('touch') || settings.controls === 'touch';
    this.listeners = [];
    const on = (t, ev, fn, o) => { t.addEventListener(ev, fn, o); this.listeners.push(() => t.removeEventListener(ev, fn, o)); };
    on(window, 'keydown', e => {
      if (/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
      if (e.code === 'Tab' || e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault();
      this.lastDevice = 'kbm';
      if (!this.keys.has(e.code)) this.pressed.add(e.code);
      this.keys.add(e.code);
    });
    on(window, 'keyup', e => this.keys.delete(e.code));
    on(window, 'blur', () => { this.keys.clear(); this.joy.x = this.joy.y = 0; });
    // Mouse look: pointer lock when available, otherwise click-and-drag
    on(canvas, 'click', () => { if (!this.touch && this.enabled && !this.pointerLocked()) this.requestLock(); });
    on(document, 'mousemove', e => {
      if (this.pointerLocked()) { if (Math.abs(e.movementX) > 350 || Math.abs(e.movementY) > 350) return; /* ignore browser spikes */ this.look.x += e.movementX; this.look.y += e.movementY; this.lastDevice = 'kbm'; }
      else if (this.dragging === 'mouse') { this.look.x += e.movementX; this.look.y += e.movementY; }
    });
    on(canvas, 'mousedown', e => { if (!this.pointerLocked() && (e.button === 0 || e.button === 2) && !this.touch) this.dragging = 'mouse'; /* left or right drag looks around until the pointer is locked */ if (e.button === 0 && this.pointerLocked()) { if (!this.keys.has('Mouse0')) this.pressed.add('Mouse0'); this.keys.add('Mouse0'); } });
    on(window, 'mouseup', e => { if (this.dragging === 'mouse' && (e.button === 0 || e.button === 2)) this.dragging = null; if (e.button === 0) this.keys.delete('Mouse0'); });
    on(canvas, 'contextmenu', e => e.preventDefault()); // right-drag is for looking, not for the browser menu
    on(document, 'pointerlockchange', () => { if (!this.pointerLocked()) this.onUnlock?.(); });
    // Touch look: drag anywhere on the canvas that isn't a control
    this.lookTouch = null;
    on(canvas, 'touchstart', e => { this.touch = true; this.lastDevice = 'touch'; document.body.classList.add('touch'); for (const t of e.changedTouches) if (this.lookTouch == null) { this.lookTouch = t.identifier; this.lt = { x: t.clientX, y: t.clientY, t: performance.now(), sx: t.clientX, sy: t.clientY }; } }, { passive: true });
    on(canvas, 'touchmove', e => { for (const t of e.changedTouches) if (t.identifier === this.lookTouch) { this.look.x += (t.clientX - this.lt.x) * 1.6; this.look.y += (t.clientY - this.lt.y) * 1.6; this.lt.x = t.clientX; this.lt.y = t.clientY; } }, { passive: true });
    const endTouch = e => { for (const t of e.changedTouches) if (t.identifier === this.lookTouch) { const tap = performance.now() - this.lt.t < 250 && Math.hypot(t.clientX - this.lt.sx, t.clientY - this.lt.sy) < 12; this.lookTouch = null; if (tap) this.onTap?.(t.clientX, t.clientY); } };
    on(canvas, 'touchend', endTouch, { passive: true }); on(canvas, 'touchcancel', endTouch, { passive: true });
  }
  pointerLocked() { return document.pointerLockElement === this.canvas; }
  requestLock() { try { const p = this.canvas.requestPointerLock?.(); if (p && p.catch) p.catch(() => {}); } catch {} }
  releaseLock() { if (this.pointerLocked()) { this.expectUnlock = true; document.exitPointerLock?.(); } }

  // On-screen controls for touch devices (also usable with a mouse)
  buildTouchUI(parent, buttons) {
    const joy = h('div', { class: 'cx-joy', 'aria-label': 'Movement joystick' }, h('div', { class: 'stick' }));
    const stick = joy.firstChild; let id = null, cx = 0, cy = 0;
    const R = () => joy.clientWidth / 2;
    joy.addEventListener('pointerdown', e => { id = e.pointerId; joy.setPointerCapture(id); const r = joy.getBoundingClientRect(); cx = r.left + r.width / 2; cy = r.top + r.height / 2; mv(e); e.preventDefault(); });
    const mv = e => { if (e.pointerId !== id) return; let dx = e.clientX - cx, dy = e.clientY - cy; const d = Math.hypot(dx, dy), m = R() - 18; if (d > m) { dx *= m / d; dy *= m / d; } stick.style.transform = `translate(${dx}px,${dy}px)`; this.joy.x = dx / m; this.joy.y = dy / m; this.lastDevice = 'touch'; };
    joy.addEventListener('pointermove', mv);
    const up = e => { if (e.pointerId !== id) return; id = null; stick.style.transform = ''; this.joy.x = this.joy.y = 0; };
    joy.addEventListener('pointerup', up); joy.addEventListener('pointercancel', up);
    const pad = h('div', { class: 'cx-buttons' });
    this.touchButtons = {};
    for (const b of buttons) {
      const el = h('button', { class: `cx-tb ${b.cls || ''}`, 'data-action': b.action, 'aria-label': b.label, title: b.label }, h('span', {}, b.icon), h('small', {}, b.short || b.label));
      el.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); this.pressed.add('touch:' + b.action); if (b.hold) this.keys.add('touch:' + b.action); });
      const rel = () => this.keys.delete('touch:' + b.action);
      el.addEventListener('pointerup', rel); el.addEventListener('pointerleave', rel); el.addEventListener('pointercancel', rel);
      this.touchButtons[b.action] = el; pad.append(el);
    }
    parent.append(joy, pad);
    this.touchUI = [joy, pad];
  }

  // Called once per frame: merges every device into move/look/actions
  poll(dt) {
    const k = this.keys; let x = 0, y = 0;
    if (k.has('KeyW') || k.has('ArrowUp')) y -= 1; if (k.has('KeyS') || k.has('ArrowDown')) y += 1;
    if (k.has('KeyA') || k.has('ArrowLeft')) x -= 1; if (k.has('KeyD') || k.has('ArrowRight')) x += 1;
    x += this.joy.x; y += this.joy.y;
    this.padActions = new Set(); this.padHeld = new Set();
    let gp = null; try { gp = [...(navigator.getGamepads?.() || [])].find(g => g && g.connected); } catch {}
    if (gp) {
      const dz = v => Math.abs(v) < 0.18 ? 0 : v;
      const lx = dz(gp.axes[0] || 0), ly = dz(gp.axes[1] || 0), rx = dz(gp.axes[2] || 0), ry = dz(gp.axes[3] || 0);
      if (lx || ly || rx || ry) this.lastDevice = 'pad';
      x += lx; y += ly; this.look.x += rx * 900 * dt; this.look.y += ry * 900 * dt;
      gp.buttons.forEach((b, i) => { const p = b.pressed || b.value > 0.5; if (p) { this.padHeld.add(i); if (!this.padPrev[i]) { this.padActions.add(i); this.lastDevice = 'pad'; } } this.padPrev[i] = p; });
    }
    const len = Math.hypot(x, y); if (len > 1) { x /= len; y /= len; }
    this.move.x = this.enabled ? x : 0; this.move.y = this.enabled ? y : 0;
    const s = (settings.sensitivity ?? 1) * 0.0022, inv = settings.invertY ? -1 : 1;
    const out = { yaw: -this.look.x * s, pitch: -this.look.y * s * inv };
    this.look.x = this.look.y = 0;
    return this.enabled ? out : { yaw: 0, pitch: 0 };
  }
  held(action) {
    if (this.keys.has('touch:' + action)) return true;
    if ((ACTION_KEYS[action] || []).some(c => this.keys.has(c))) return true;
    return PAD[action] != null && this.padHeld?.has(PAD[action]);
  }
  // True once per press, from any device
  hit(action) {
    let r = this.pressed.has('touch:' + action) || (ACTION_KEYS[action] || []).some(c => this.pressed.has(c));
    if (PAD[action] != null && this.padActions?.has(PAD[action])) r = true;
    return r;
  }
  endFrame() { this.pressed.clear(); }
  dispose() { for (const f of this.listeners) f(); this.releaseLock(); this.touchUI?.forEach(e => e.remove()); }
}
