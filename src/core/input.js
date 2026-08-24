export class Input {
  constructor(domElement) {
    this.dom = domElement;
    this.keys = new Set();
    this.buttons = [false, false, false];
    this.dx = 0;
    this.dy = 0;
    this.wheel = 0;
    this.locked = false;
    this.sensitivity = parseFloat(localStorage.getItem('greyfall_sens') || '1');
    this.onLockChange = null;

    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      this.keys.add(e.code);
      if (['Space', 'ArrowUp', 'ArrowDown'].includes(e.code)) e.preventDefault();
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => {
      this.keys.clear();
      this.buttons = [false, false, false];
    });

    domElement.addEventListener('mousedown', (e) => {
      if (!this.locked) return;
      if (e.button < 3) this.buttons[e.button] = true;
    });
    window.addEventListener('mouseup', (e) => {
      if (e.button < 3) this.buttons[e.button] = false;
    });
    domElement.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('mousemove', (e) => {
      if (!this.locked) return;
      this.dx += e.movementX;
      this.dy += e.movementY;
    });
    window.addEventListener('wheel', (e) => {
      if (!this.locked) return;
      this.wheel += Math.sign(e.deltaY);
    }, { passive: true });
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === this.dom;
      if (!this.locked) {
        this.keys.clear();
        this.buttons = [false, false, false];
      }
      this.onLockChange?.(this.locked);
    });
  }

  requestLock() {
    if (!this.locked) this.dom.requestPointerLock();
  }

  releaseLock() {
    if (this.locked) document.exitPointerLock();
  }

  consumeMouse() {
    const d = { dx: this.dx, dy: this.dy };
    this.dx = 0;
    this.dy = 0;
    return d;
  }

  consumeWheel() {
    const w = this.wheel;
    this.wheel = 0;
    return w;
  }

  isDown(code) {
    return this.keys.has(code);
  }

  get move() {
    let x = 0;
    let z = 0;
    if (this.isDown('KeyW') || this.isDown('ArrowUp')) z -= 1;
    if (this.isDown('KeyS') || this.isDown('ArrowDown')) z += 1;
    if (this.isDown('KeyA') || this.isDown('ArrowLeft')) x -= 1;
    if (this.isDown('KeyD') || this.isDown('ArrowRight')) x += 1;
    return { x, z };
  }

  setSensitivity(s) {
    this.sensitivity = s;
    localStorage.setItem('greyfall_sens', String(s));
  }

  dispose() {
    window.removeEventListener('keydown', this.onKeyDown);
  }
}
