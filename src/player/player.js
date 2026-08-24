import * as THREE from 'three';
import { CONFIG } from '../core/contracts.js';
import { WeaponSystem } from './weapons.js';

const P = CONFIG.PLAYER;
const DEG = Math.PI / 180;
const PITCH_LIMIT = 87 * DEG;
const LOOK_SMOOTH = 26;
const STEP_HEIGHT = 0.35;
const MAX_FALL = 55;

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const smooth = (t) => t * t * (3 - 2 * t);
const wrapPi = (a) => {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
};

export class Player {
  constructor({ camera, input, world, scene, combat }) {
    this.camera = camera;
    this.input = input;
    this.world = world || null;
    camera.rotation.order = 'YXZ';
    if (scene && !camera.parent) scene.add(camera);

    this.weapons = new WeaponSystem({ camera, input });
    this.weapons.player = this;
    if (combat) this.weapons.setCombat(combat);

    const spawn = world && world.playerSpawn ? world.playerSpawn : new THREE.Vector3();
    this.spawnFeet = new THREE.Vector3(spawn.x, spawn.y, spawn.z);

    this._feet = new THREE.Vector3();
    this._eye = new THREE.Vector3();
    this.vel = new THREE.Vector3();
    this.yaw = 0;
    this.pitch = 0;
    this.health = P.maxHealth;
    this.maxHealth = P.maxHealth;
    this.alive = true;

    this.onDamaged = null;
    this.onDeath = null;
    this.onFootstep = null;

    this._tYaw = 0;
    this._tPitch = 0;
    this._sYaw = 0;
    this._sPitch = 0;
    this.lookVelYaw = 0;
    this.lookVelPitch = 0;

    this.grounded = true;
    this.crouching = false;
    this.crouchBlend = 0;
    this.sprinting = false;
    this.sprintBlend = 0;
    this.sprintBlockT = 0;
    this.coyote = 0;
    this.jumpBuf = 0;
    this.prevSpace = false;
    this.prevCrouchKey = false;

    this.bobPhase = 0;
    this.moveAmt = 0;
    this.dip = 0;
    this.dipVel = 0;
    this.stepAcc = 0;
    this.shakeT = 0;
    this.breatheT = 0;
    this.trauma = 0;
    this.deathT = 0;
    this.regenTimer = 0;
    this.flash01 = 0;
    this.angleLastHit = 0;

    this.reset();
  }

  get position() {
    return this._eye;
  }

  get eyeHeight() {
    return P.height + (P.crouchHeight - P.height) * smooth(this.crouchBlend);
  }

  get adsT() {
    return this.weapons.adsT;
  }

  get damageFlash01() {
    return this.flash01;
  }

  get angleToLastHit() {
    return this.angleLastHit;
  }

  get isSprinting() {
    return this.sprinting;
  }

  blockSprint(t) {
    this.sprintBlockT = Math.max(this.sprintBlockT, t);
  }

  addShake(t) {
    this.trauma = clamp(this.trauma + t, 0, 1);
  }

  takeDamage(amount, fromPos) {
    if (!this.alive) return;
    this.health -= amount;
    this.regenTimer = P.regenDelay;
    this.flash01 = 1;
    if (fromPos) {
      const dx = fromPos.x - this._eye.x;
      const dz = fromPos.z - this._eye.z;
      this.angleLastHit = wrapPi(Math.atan2(-dx, -dz) - this.yaw);
    }
    if (this.health <= 0) {
      this.health = 0;
      this.alive = false;
      this.deathT = 0;
      this.onDeath?.();
    }
    this.onDamaged?.(this.health);
  }

  reset() {
    this.vel.set(0, 0, 0);
    this._feet.copy(this.spawnFeet);
    this._eye.set(this.spawnFeet.x, this.spawnFeet.y + P.height, this.spawnFeet.z);
    this.yaw = 0;
    this.pitch = 0;
    this._tYaw = 0;
    this._tPitch = 0;
    this._sYaw = 0;
    this._sPitch = 0;
    this.lookVelYaw = 0;
    this.lookVelPitch = 0;
    this.health = P.maxHealth;
    this.alive = true;
    this.grounded = true;
    this.crouching = false;
    this.crouchBlend = 0;
    this.sprinting = false;
    this.sprintBlend = 0;
    this.sprintBlockT = 0;
    this.coyote = 0;
    this.jumpBuf = 0;
    this.bobPhase = 0;
    this.moveAmt = 0;
    this.dip = 0;
    this.dipVel = 0;
    this.trauma = 0;
    this.deathT = 0;
    this.regenTimer = 0;
    this.flash01 = 0;
    this.angleLastHit = 0;
    this.stepAcc = 0;
    this.weapons.reset();
  }

  update(dt) {
    dt = Math.min(dt, 0.05);
    this.shakeT += dt;
    this.breatheT += dt;
    this.trauma = Math.max(0, this.trauma - 1.8 * dt);
    this.flash01 = Math.max(0, this.flash01 - dt / 0.9);
    this.sprintBlockT = Math.max(0, this.sprintBlockT - dt);

    if (this.alive && this.health < this.maxHealth) {
      this.regenTimer -= dt;
      if (this.regenTimer <= 0) {
        this.health = Math.min(this.maxHealth, this.health + P.regenRate * dt);
      }
    }

    if (this.alive) {
      const m = this.input.consumeMouse();
      this.updateLook(dt, m);
      this.updateMove(dt);
    } else {
      this.input.consumeMouse();
      this.updateDeath(dt);
    }

    this.updateCamera(dt);
    this.weapons.update(dt);
  }

  updateLook(dt, m) {
    const s = this.input.sensitivity * 0.0022;
    this._tYaw -= m.dx * s;
    this._tPitch = clamp(this._tPitch - m.dy * s, -PITCH_LIMIT, PITCH_LIMIT);
    const k = 1 - Math.exp(-LOOK_SMOOTH * dt);
    const py = this._sYaw;
    const pp = this._sPitch;
    this._sYaw += (this._tYaw - this._sYaw) * k;
    this._sPitch += (this._tPitch - this._sPitch) * k;
    if (dt > 0.0001) {
      const f = Math.min(1, 12 * dt);
      this.lookVelYaw += ((this._sYaw - py) / dt - this.lookVelYaw) * f;
      this.lookVelPitch += ((this._sPitch - pp) / dt - this.lookVelPitch) * f;
    }
    this.yaw = this._sYaw;
    this.pitch = this._sPitch;
  }

  updateMove(dt) {
    const mv = this.input.move;
    const adsE = smooth(this.weapons.adsT);
    const cy = Math.cos(this.yaw);
    const sy = Math.sin(this.yaw);
    let wx = cy * mv.x + sy * mv.z;
    let wz = cy * mv.z - sy * mv.x;
    const wl = Math.hypot(wx, wz);
    if (wl > 0.001) {
      wx /= wl;
      wz /= wl;
    }

    const crouchKey = this.input.isDown('KeyC');
    if (crouchKey && !this.prevCrouchKey) this.crouching = !this.crouching;
    this.prevCrouchKey = crouchKey;
    this.crouchBlend += clamp((this.crouching ? 1 : 0) - this.crouchBlend, -10 * dt, 10 * dt);

    const wantSprint =
      this.input.isDown('ShiftLeft') &&
      mv.z < 0 &&
      !this.crouching &&
      this.grounded &&
      this.sprintBlockT <= 0 &&
      this.weapons.adsT < 0.2;
    this.sprinting = wantSprint;
    this.sprintBlend += clamp((wantSprint ? 1 : 0) - this.sprintBlend, -8 * dt, 8 * dt);

    const baseSpeed = this.crouching ? P.crouchSpeed : wantSprint ? P.sprintSpeed : P.walkSpeed;
    const wishSpeed = wl > 0.001 ? baseSpeed * (1 + (P.adsSpeedMult - 1) * adsE) : 0;

    if (this.grounded) {
      this.applyFriction(dt);
      this.accelerate(wx, wz, wishSpeed, P.accelGround, dt);
    } else {
      this.accelerate(wx, wz, wishSpeed, P.accelAir, dt);
    }

    const space = this.input.isDown('Space');
    if (space && !this.prevSpace) this.jumpBuf = 0.12;
    this.prevSpace = space;
    this.jumpBuf = Math.max(0, this.jumpBuf - dt);
    this.coyote = this.grounded ? 0.09 : Math.max(0, this.coyote - dt);
    if (this.jumpBuf > 0 && (this.grounded || this.coyote > 0)) {
      this.vel.y = P.jumpVel;
      this.grounded = false;
      this.coyote = 0;
      this.jumpBuf = 0;
    }

    this.vel.y = Math.max(this.vel.y - P.gravity * dt, -MAX_FALL);

    const colH = this.eyeHeight;
    this.resolveHorizontal('x', colH, dt);
    this.resolveHorizontal('z', colH, dt);
    this.resolveVertical(colH, dt);

    const speed = Math.hypot(this.vel.x, this.vel.z);
    const moveTarget = this.grounded ? clamp(speed / P.walkSpeed, 0, 1.25) : 0;
    this.moveAmt += clamp(moveTarget - this.moveAmt, -8 * dt, 8 * dt);
    if (this.grounded) this.bobPhase += speed * dt * 1.7;

    if (this.grounded && speed > 0.6) {
      this.stepAcc += speed * dt;
      const stride = wantSprint ? 2.7 : this.crouching ? 2.4 : 2.05;
      if (this.stepAcc >= stride) {
        this.stepAcc = 0;
        this.onFootstep?.();
      }
    } else {
      this.stepAcc = 0;
    }
  }

  applyFriction(dt) {
    const sp = Math.hypot(this.vel.x, this.vel.z);
    if (sp < 0.0001) {
      this.vel.x = 0;
      this.vel.z = 0;
      return;
    }
    const drop = sp * P.friction * dt;
    const scale = Math.max(sp - drop, 0) / sp;
    this.vel.x *= scale;
    this.vel.z *= scale;
  }

  accelerate(wx, wz, wishSpeed, accel, dt) {
    if (wishSpeed <= 0) return;
    const cur = this.vel.x * wx + this.vel.z * wz;
    const add = wishSpeed - cur;
    if (add <= 0) return;
    const a = Math.min(accel * dt * wishSpeed, add);
    this.vel.x += wx * a;
    this.vel.z += wz * a;
  }

  overlapsXZ(px, pz, b) {
    const r = P.radius;
    return px + r > b.min.x && px - r < b.max.x && pz + r > b.min.z && pz - r < b.max.z;
  }

  headroomClear(px, pz, footY, colH, ignore) {
    for (const b of this.world.colliders) {
      if (b === ignore) continue;
      if (!this.overlapsXZ(px, pz, b)) continue;
      if (b.min.y < footY + colH && b.max.y > footY) return false;
    }
    return true;
  }

  resolveHorizontal(axis, colH, dt) {
    const p = this._feet;
    const colliders = this.world ? this.world.colliders : null;
    if (!colliders) return;
    p[axis] += this.vel[axis] * dt;
    for (let i = 0; i < colliders.length; i++) {
      const b = colliders[i];
      if (!this.overlapsXZ(p.x, p.z, b)) continue;
      if (b.min.y >= p.y + colH || b.max.y <= p.y + 0.02) continue;
      const rise = b.max.y - p.y;
      if (this.grounded && rise > 0 && rise <= STEP_HEIGHT && this.headroomClear(p.x, p.z, b.max.y, colH, b)) {
        p.y = b.max.y;
        continue;
      }
      if (axis === 'x') {
        if (this.vel.x > 0 || (this.vel.x === 0 && p.x < (b.min.x + b.max.x) * 0.5)) p.x = b.min.x - P.radius;
        else p.x = b.max.x + P.radius;
        this.vel.x = 0;
      } else {
        if (this.vel.z > 0 || (this.vel.z === 0 && p.z < (b.min.z + b.max.z) * 0.5)) p.z = b.min.z - P.radius;
        else p.z = b.max.z + P.radius;
        this.vel.z = 0;
      }
    }
  }

  resolveVertical(colH, dt) {
    const p = this._feet;
    const colliders = this.world ? this.world.colliders : null;
    const prevFeet = p.y;
    const wasGrounded = this.grounded;
    p.y += this.vel.y * dt;
    this.grounded = false;

    if (this.vel.y <= 0) {
      let landY = p.y <= 0 ? 0 : -Infinity;
      if (colliders) {
        for (let i = 0; i < colliders.length; i++) {
          const b = colliders[i];
          if (!this.overlapsXZ(p.x, p.z, b)) continue;
          const top = b.max.y;
          if (prevFeet >= top - 0.001 && p.y <= top && top > landY) landY = top;
        }
      }
      let snapped = false;
      if (landY > -Infinity) {
        p.y = landY;
        snapped = true;
      } else if (wasGrounded) {
        let snapY = p.y - 0.45 <= 0 ? 0 : -Infinity;
        if (colliders) {
          for (let i = 0; i < colliders.length; i++) {
            const b = colliders[i];
            if (!this.overlapsXZ(p.x, p.z, b)) continue;
            const top = b.max.y;
            if (top <= p.y && top >= p.y - 0.45 && top > snapY) snapY = top;
          }
        }
        if (snapY > -Infinity) {
          p.y = snapY;
          snapped = true;
        }
      }
      if (snapped) {
        const impact = -this.vel.y;
        this.vel.y = 0;
        this.grounded = true;
        if (!wasGrounded && impact > 3) {
          this.dipVel -= Math.min(impact, 15) * 0.24;
          this.onFootstep?.();
        }
      }
    } else {
      const head = p.y + colH;
      const prevHead = prevFeet + colH;
      if (colliders) {
        for (let i = 0; i < colliders.length; i++) {
          const b = colliders[i];
          if (!this.overlapsXZ(p.x, p.z, b)) continue;
          const bottom = b.min.y;
          if (prevHead <= bottom + 0.001 && head >= bottom) {
            p.y = bottom - colH;
            this.vel.y = 0;
            break;
          }
        }
      }
    }
  }

  updateDeath(dt) {
    this.deathT = Math.min(this.deathT + dt, 0.8);
    const damp = Math.max(0, 1 - 7 * dt);
    this.vel.x *= damp;
    this.vel.z *= damp;
    this.vel.y = Math.max(this.vel.y - P.gravity * dt, -MAX_FALL);
    this.resolveHorizontal('x', this.eyeHeight, dt);
    this.resolveHorizontal('z', this.eyeHeight, dt);
    this.resolveVertical(this.eyeHeight, dt);
    this.moveAmt = Math.max(0, this.moveAmt - 4 * dt);
  }

  updateCamera(dt) {
    const adsE = smooth(this.weapons.adsT);
    const alive = this.alive;
    const deathK = alive ? 0 : smooth(this.deathT / 0.8);
    const eyeH = alive ? this.eyeHeight : P.height + (0.35 - P.height) * deathK;

    const amp = alive ? this.moveAmt * (1 - adsE * 0.9) : 0;
    const bobY = Math.sin(this.bobPhase * 2) * 0.032 * amp;
    const breath = alive ? Math.sin(this.breatheT * 1.35) * 0.006 * (this.grounded ? 1 : 0.4) * (1 - adsE * 0.7) : 0;

    this.dipVel += (-140 * this.dip - 16 * this.dipVel) * dt;
    this.dip = clamp(this.dip + this.dipVel * dt, -0.4, 0.2);

    const cy = Math.cos(this.yaw);
    const sy = Math.sin(this.yaw);
    const latV = this.vel.x * cy - this.vel.z * sy;
    let roll = Math.sin(this.bobPhase) * 0.011 * amp - latV * 0.004;
    roll = clamp(roll, -0.06, 0.06) + 0.55 * deathK;

    const s = this.trauma * this.trauma;
    const t = this.shakeT;
    const n1 = Math.sin(t * 31.7) + 0.6 * Math.sin(t * 57.3 + 1.7);
    const n2 = Math.sin(t * 39.1 + 0.8) + 0.6 * Math.sin(t * 47.7 + 0.3);
    const n3 = Math.sin(t * 44.3 + 2.1) + 0.6 * Math.sin(t * 61.7);

    const camY = this._feet.y + eyeH + bobY + breath + this.dip * 0.55;
    this._eye.set(this._feet.x, camY, this._feet.z);

    const cam = this.camera;
    cam.position.set(
      this._feet.x + n2 * s * 0.05,
      camY + n3 * s * 0.05 + this.dip * 0.2,
      this._feet.z + n1 * s * 0.05
    );
    cam.rotation.set(
      this.pitch + n1 * 0.05 * s + this.dip * 0.45,
      this.yaw + n2 * 0.05 * s,
      roll + n3 * 0.04 * s
    );
  }

  dispose() {
    this.weapons.dispose();
  }
}
