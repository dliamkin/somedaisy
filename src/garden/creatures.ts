// What moves about the garden: butterflies that land on open flowers, the bee that picks one,
// fireflies at night, the burst of petals when a flower opens or lands in the house, a friend's
// butterfly that flies in when they vote, and the watering can that nudges people who have not.
//
// Ported from the design handoffs (design_handoff_garden_a_v2/garden3d-v2.js is the newer).

import * as THREE from 'three';

import { clamp, damp, groundY } from './ground';
import type { Kit } from './kit';
import { EXTRAS, PAINT } from './palette';

/** What a creature needs to know about a flower. */
type Bloom = {
  id: string;
  d: { stage: number };
  /** Set while the flower is flying into the house. */
  fly: unknown;
  /** How far it has grown, from 0 to 1. */
  grow: number;
  /** Where its head is. */
  headAt: THREE.Vector3;
  /** Where it stands, and the group its shapes hang from. */
  x: number;
  z: number;
  g: THREE.Object3D;
  /** How fast its head is springing, which a splash of water adds to. */
  headV: number;
};

type Yard = {
  flowers: Map<string, Bloom>;
  /** The flower that is chosen, if one is. */
  selected: () => string | null;
  /** The bee has reached the flower it was sent to. */
  onPickArrive: (id: string) => void;
  /** The watering can has poured on a flower. */
  onWatered: (id: string) => void;
  /** A visiting friend's butterfly has landed on a flower. `who` is whatever the visit was started with. */
  onVisit: (who: string, id: string) => void;
};

const chance = (a: number, b: number) => a + Math.random() * (b - a);

/** How long the bee circles the flower it picked. */
const BEE_STAYS = 3.6;

export type Creatures = ReturnType<typeof buildCreatures>;

export function buildCreatures(kit: Kit, yard: Yard) {
  const { scene, lambert, basic, mesh, add, ball, rand } = kit;
  const v1 = new THREE.Vector3();
  const v2 = new THREE.Vector3();
  const inkPaint = lambert(PAINT.ink);

  // Petals thrown into the air. A fixed number of them, used in turn.
  const petals = Array.from({ length: 110 }, () => {
    const paint = lambert(PAINT.white);
    const m = new THREE.Mesh(ball, paint);
    m.visible = false;
    scene.add(m);
    return { m, paint, v: new THREE.Vector3(), life: 0, phase: 0, gravity: 3.4 };
  });
  let nextPetal = 0;
  /**
   * A burst of petals from a spot, in a colour, with a daisy-yellow one among every four.
   * `soft` is for a leaf or a petal let go by a tree: it drifts sideways and comes down slowly.
   */
  function burst(from: THREE.Vector3, color: string, count = 16, soft = false) {
    for (let i = 0; i < count; i++) {
      const p = petals[nextPetal++ % petals.length];
      p.paint.color.set(i % 4 === 3 ? PAINT.center : color);
      p.m.position.copy(from);
      if (soft) {
        p.v.set(chance(0.6, 1.4), chance(-0.2, 0.2), chance(0.2, 0.8));
        p.life = chance(3, 5);
        p.gravity = 0.35;
      } else {
        p.v.set(chance(-1, 1), chance(0.6, 1.8), chance(-1, 1)).multiplyScalar(chance(1.2, 2.3));
        p.life = chance(1.1, 1.7);
        p.gravity = 3.4;
      }
      p.phase = chance(0, 6);
      p.m.visible = true;
      p.m.rotation.set(chance(0, 6), chance(0, 6), chance(0, 6));
    }
  }

  // Butterflies. Each wanders, then makes for a flower that is at least half open and sits on it a while.
  const wingShape = (() => {
    const s = new THREE.Shape();
    s.moveTo(0, 0.03);
    s.bezierCurveTo(0.06, 0.16, 0.2, 0.26, 0.3, 0.2);
    s.bezierCurveTo(0.36, 0.14, 0.3, 0.02, 0.2, -0.01);
    s.bezierCurveTo(0.27, -0.06, 0.25, -0.2, 0.15, -0.21);
    s.bezierCurveTo(0.07, -0.22, 0.02, -0.12, 0, -0.05);
    s.lineTo(0, 0.03);
    return new THREE.ShapeGeometry(s, 12).rotateX(Math.PI / 2);
  })();
  const spotShape = new THREE.CircleGeometry(1, 14).rotateX(-Math.PI / 2);
  const bodyShape = new THREE.CapsuleGeometry(0.02, 0.15, 4, 8);
  const headShape = new THREE.SphereGeometry(0.03, 10, 8);
  const feelerShape = new THREE.CylinderGeometry(0.005, 0.005, 0.11, 4).translate(0, 0.055, 0);

  type Butterfly = ReturnType<typeof makeButterfly>;
  function wander(b: { goal: THREE.Vector3 }) {
    b.goal.set(chance(-2.3, 2.3), 0, chance(-3.4, 3.2));
    b.goal.y = groundY(b.goal.x, b.goal.z) + chance(1.2, 2.6);
  }
  function makeButterfly(color: string, i: number) {
    const g = new THREE.Group();
    const wingPaint = lambert(color, { side: THREE.DoubleSide });
    const spotPaint = lambert(PAINT.white, { side: THREE.DoubleSide });
    const body = mesh(bodyShape, inkPaint);
    body.rotation.x = Math.PI / 2;
    g.add(body);
    g.add(mesh(headShape, inkPaint, 0, 0.005, 0.11));
    for (const side of [-1, 1]) {
      const feeler = mesh(feelerShape, inkPaint, side * 0.012, 0.02, 0.12, false);
      feeler.rotation.set(0.9, 0, -side * 0.45);
      g.add(feeler);
    }
    const wing = (side: number) => {
      const w = new THREE.Group();
      w.scale.x = side;
      w.add(mesh(wingShape, wingPaint));
      for (const [x, z, size] of [
        [0.2, 0.11, 0.04],
        [0.15, -0.11, 0.03],
      ]) {
        add(w, mesh(spotShape, spotPaint, x, 0.004, z, false)).scale.setScalar(size);
      }
      g.add(w);
      return w;
    };
    const b = {
      g,
      right: wing(1),
      left: wing(-1),
      at: new THREE.Vector3(chance(-2, 2), 2.5, chance(-2, 2)),
      v: new THREE.Vector3(),
      goal: new THREE.Vector3(),
      mode: 'fly' as 'fly' | 'approach' | 'perch' | 'leave' | 'off',
      /** True for a friend's butterfly, which comes for one flower and then leaves. */
      guest: false,
      /** Whose visit this is, handed back when it lands. */
      who: '',
      wingPaint,
      /** The flower it is making for or sitting on. */
      flower: null as string | null,
      timer: chance(1, 3),
      yaw: 0,
      roll: 0,
      pitch: 0,
      phase: chance(0, 6),
      seed: i * 2.7,
      shown: 0,
    };
    scene.add(g);
    wander(b);
    return b;
  }
  // The design drew four, with two of them out in a gentle garden. Those two are the ones here.
  const butterflies = PAINT.butterflies.slice(0, 2).map(makeButterfly);

  function takeOff(b: Butterfly) {
    b.mode = 'fly';
    b.flower = null;
    b.v.set(chance(-0.4, 0.4), 1.3, chance(-0.4, 0.4));
    b.timer = chance(2, 4);
    wander(b);
    if (b.guest) {
      // A friend's butterfly leaves by the nearer side.
      b.mode = 'leave';
      b.goal.set(b.at.x > 0 ? 6.5 : -6.5, 5, -1);
    }
  }
  function moveButterfly(b: Butterfly, dt: number, t: number) {
    const on = b.flower != null ? yard.flowers.get(b.flower) : null;
    const selected = yard.selected();
    let flap = 0;
    b.phase += dt * (b.mode === 'perch' ? 1.9 : 58);
    if (b.mode === 'perch') {
      if (!on || on.fly || (!b.guest && (on.d.stage < 2 || (selected != null && selected !== on.id)))) takeOff(b);
      else {
        b.at.copy(on.headAt);
        b.timer -= dt;
        flap = 0.95 + 0.4 * Math.sin(b.phase);
        b.roll = damp(b.roll, 0, 5, dt);
        b.pitch = damp(b.pitch, -0.25, 5, dt);
        if (b.timer < 0) takeOff(b);
      }
    }
    if (b.mode !== 'perch') {
      let goal = b.goal;
      let landing = false;
      if (b.mode === 'approach') {
        if (!on || on.fly || b.timer < 0) {
          b.mode = 'fly';
          b.flower = null;
          wander(b);
          b.timer = chance(2, 4);
          if (b.guest) takeOff(b);
        } else {
          goal = on.headAt;
          landing = true;
        }
      }
      v1.subVectors(goal, b.at);
      const far = v1.length();
      const speed = landing ? Math.min(b.guest ? 2.7 : 1.5, far * 1.8 + 0.2) : 1.5;
      const flutter = landing ? Math.min(1, far * 1.2) : 1;
      v1.multiplyScalar(speed / Math.max(far, 0.001));
      v1.x += Math.sin(t * 5.1 + b.seed) * 0.9 * flutter;
      v1.y += (Math.sin(t * 7.3 + b.seed * 2) * 0.8 + Math.cos(b.phase) * 0.5) * flutter;
      v1.z += Math.cos(t * 4.3 + b.seed) * 0.7 * flutter;
      b.v.lerp(v1, 1 - Math.exp(-dt * 2.4));
      b.at.addScaledVector(b.v, dt);
      const floor = groundY(b.at.x, b.at.z) + 0.35;
      if (b.at.y < floor) b.at.y = floor;
      b.timer -= dt;
      // A friend's butterfly lands a little sooner, and is made to land if it has taken eight seconds.
      if (b.mode === 'approach' && (far < 0.07 || (b.guest && (far < 0.12 || b.timer < 4)))) {
        b.mode = 'perch';
        b.timer = chance(2.5, 6);
        if (b.guest && b.flower) {
          b.timer = 2.8;
          yard.onVisit(b.who, b.flower);
        }
      } else if (b.mode === 'leave') {
        if (far < 1) b.mode = 'off';
      } else if (b.mode === 'fly' && (far < 0.5 || b.timer < 0)) {
        const taken = new Set(butterflies.map((o) => o.flower));
        const open = [...yard.flowers.values()].filter((f) => f.d.stage >= 2 && !f.fly && f.grow > 0.9 && !taken.has(f.id));
        if (open.length && Math.random() < 0.6) {
          b.mode = 'approach';
          b.flower = open[Math.floor(Math.random() * open.length)].id;
          b.timer = 12;
        } else {
          wander(b);
          b.timer = chance(2.5, 5);
        }
      }
      flap = -0.35 + 1.6 * (0.5 + 0.5 * Math.sin(b.phase));
      let turn = Math.atan2(b.v.x, b.v.z) - b.yaw;
      turn = Math.atan2(Math.sin(turn), Math.cos(turn));
      const turned = turn * Math.min(1, dt * 6);
      b.yaw += turned;
      b.roll = damp(b.roll, clamp((-turned / Math.max(dt, 0.001)) * 0.12, -0.7, 0.7), 6, dt);
      b.pitch = damp(b.pitch, clamp(-b.v.y * 0.35, -0.6, 0.6), 5, dt);
    }
    b.g.position.copy(b.at);
    if (b.mode !== 'perch') b.g.position.y += Math.sin(b.phase - 1.57) * 0.03;
    b.g.rotation.set(b.pitch, b.yaw, b.roll, 'YXZ');
    b.right.rotation.z = flap;
    b.left.rotation.z = -flap;
  }

  // A friend's butterfly: in their colour, half as big again as the others, out at any time of day.
  const guest = makeButterfly(PAINT.butterflies[0], 7);
  guest.guest = true;
  guest.mode = 'off';
  guest.g.visible = false;
  /** Send a friend's butterfly to a flower, in their colour. False if it cannot go: one is already here, or the flower is not. */
  function visit(who: string, id: string, color: string): boolean {
    const on = yard.flowers.get(id);
    if (!on || on.fly || guest.mode !== 'off') return false;
    guest.who = who;
    guest.wingPaint.color.set(color);
    guest.flower = id;
    guest.mode = 'approach';
    guest.timer = 12;
    // It comes in from the side nearer the flower.
    guest.at.set(on.x + (on.x < 0 ? -2.6 : 2.6), groundY(on.x, on.z) + 3.4, on.z + 1.2);
    guest.v.set(0, 0, 0);
    return true;
  }

  // The watering can: it appears beside a bloom, tips, pours for a moment and goes.
  const can = (() => {
    const g = new THREE.Group();
    const tilt = new THREE.Group();
    const body = lambert(EXTRAS.can);
    const pale = lambert(PAINT.stone);
    g.add(tilt);
    tilt.add(mesh(new THREE.CylinderGeometry(0.15, 0.17, 0.26, 18), body));
    tilt.add(mesh(new THREE.CylinderGeometry(0.156, 0.162, 0.05, 18), pale, 0, 0.04, 0));
    const spout = mesh(new THREE.CylinderGeometry(0.022, 0.036, 0.36, 8), body, 0.27, 0.04, 0);
    spout.rotation.z = -0.95;
    tilt.add(spout);
    const rose = mesh(new THREE.CylinderGeometry(0.065, 0.03, 0.05, 12), pale, 0.43, 0.155, 0);
    rose.rotation.z = -0.95;
    tilt.add(rose);
    const handle = mesh(new THREE.TorusGeometry(0.11, 0.018, 6, 14, Math.PI), body, -0.15, 0.02, 0);
    handle.rotation.z = Math.PI / 2;
    tilt.add(handle);
    const tip = new THREE.Object3D();
    tip.position.set(0.46, 0.18, 0);
    tilt.add(tip);
    g.visible = false;
    scene.add(g);
    return { g, tilt, tip, t: -1, flower: null as string | null, side: 1, owed: 0, poured: false };
  })();
  const dropPaint = basic(EXTRAS.water);
  const drops = Array.from({ length: 40 }, () => {
    const m = new THREE.Mesh(ball, dropPaint);
    m.visible = false;
    m.scale.set(0.02, 0.032, 0.02);
    scene.add(m);
    return { m, v: new THREE.Vector3(), falling: false, floor: 0 };
  });
  let nextDrop = 0;
  /** Water a flower. False if it cannot start: the can is already out, or the flower is not there. */
  function water(id: string): boolean {
    const on = yard.flowers.get(id);
    if (!on || on.fly || can.t >= 0) return false;
    can.flower = id;
    can.t = 0;
    // The can comes in on the side nearer the middle of the screen.
    can.side = on.x < 0 ? 1 : -1;
    can.poured = false;
    can.owed = 0;
    return true;
  }
  const ease = (x: number) => {
    const c = clamp(x, 0, 1);
    return c * c * (3 - 2 * c);
  };
  function moveCan(dt: number) {
    for (const d of drops) {
      if (!d.falling) continue;
      d.v.y -= 6 * dt;
      d.m.position.addScaledVector(d.v, dt);
      if (d.m.position.y < d.floor) {
        d.falling = false;
        d.m.visible = false;
      }
    }
    if (can.t < 0) return;
    const on = can.flower != null ? yard.flowers.get(can.flower) : undefined;
    if (!on || on.fly) {
      can.t = -1;
      can.g.visible = false;
      return;
    }
    // It scales in over 0.35s, tips from 0.3s to 0.7s, rights itself by 2.15s and is gone at 2.5s.
    can.t += dt;
    const w = can.t;
    const size = ease(w / 0.35) * ease((2.5 - w) / 0.3);
    const pour = ease((w - 0.3) / 0.4) * ease((2.15 - w) / 0.3);
    can.g.visible = true;
    can.g.scale.setScalar(Math.max(0.001, size * 1.25));
    can.g.position.copy(on.headAt);
    can.g.position.x += can.side * 0.62;
    can.g.position.y += 0.72 + Math.sin(w * 5) * 0.015;
    can.g.rotation.y = can.side > 0 ? Math.PI : 0;
    can.tilt.rotation.z = -1.1 * pour;
    can.g.updateMatrixWorld(true);
    if (pour > 0.85) {
      // About thirty drops a second.
      can.owed += dt * 30;
      while (can.owed > 1) {
        can.owed--;
        const d = drops[nextDrop++ % drops.length];
        can.tip.getWorldPosition(d.m.position);
        d.m.position.x += chance(-0.03, 0.03);
        d.m.position.z += chance(-0.03, 0.03);
        d.v.set(-can.side * chance(0.2, 0.55), -0.3, chance(-0.08, 0.08));
        d.floor = on.g.position.y + 0.06;
        d.falling = true;
        d.m.visible = true;
      }
      if (!can.poured && w > 1.1) {
        // The flower's head bounces under the water, and that is the moment the nudge goes.
        can.poured = true;
        on.headV += 3;
        yard.onWatered(on.id);
      }
    }
    if (w > 2.5) {
      can.t = -1;
      can.g.visible = false;
    }
  }

  // The bee, which "Pick for us" sends in from the front left to circle one flower.
  const bee = (() => {
    const g = new THREE.Group();
    add(g, mesh(ball, lambert(PAINT.center))).scale.set(0.09, 0.08, 0.13);
    const stripe = new THREE.CylinderGeometry(0.084, 0.084, 0.03, 14).rotateX(Math.PI / 2);
    for (const z of [-0.035, 0.04]) g.add(mesh(stripe, inkPaint, 0, 0, z));
    g.add(mesh(new THREE.SphereGeometry(0.05, 10, 8), inkPaint, 0, 0.01, 0.13));
    const wingPaint = lambert(PAINT.white, { transparent: true, opacity: 0.8 });
    const wings = [-1, 1].map((side) => {
      const pivot = new THREE.Group();
      pivot.position.set(side * 0.03, 0.06, 0);
      const m = mesh(ball, wingPaint, side * 0.08, 0, 0, false);
      m.scale.set(0.09, 0.008, 0.05);
      pivot.add(m);
      g.add(pivot);
      return pivot;
    });
    g.visible = false;
    g.scale.setScalar(1.5);
    scene.add(g);
    return { g, wings, mode: 'off' as 'off' | 'in' | 'hover' | 'out', at: new THREE.Vector3(), was: new THREE.Vector3(), v: new THREE.Vector3(), flower: null as string | null, t: 0, angle: 0, yaw: 0 };
  })();
  /** The flower the bee is circling right now, which pulses its ring and shows its name. */
  let picked: string | null = null;

  function sendBee(id: string) {
    bee.flower = id;
    bee.mode = 'in';
    bee.at.set(-3.2, 3.6, 5.5);
    bee.v.set(1.5, 0, -1.5);
    bee.g.visible = true;
    picked = null;
  }
  function moveBee(dt: number, t: number) {
    if (bee.mode === 'off') return;
    const on = bee.flower != null ? yard.flowers.get(bee.flower) : undefined;
    bee.was.copy(bee.at);
    const steer = (goal: THREE.Vector3, fastest: number) => {
      v1.subVectors(goal, bee.at);
      const far = v1.length();
      v1.multiplyScalar(Math.min(fastest, far * 2.5 + 0.3) / Math.max(far, 0.001));
      v1.y += Math.sin(t * 9) * 0.5;
      v1.x += Math.sin(t * 6.3) * 0.4;
      bee.v.lerp(v1, 1 - Math.exp(-dt * 4));
      bee.at.addScaledVector(bee.v, dt);
      return far;
    };
    if (bee.mode === 'in') {
      if (!on || on.fly) bee.mode = 'out';
      else {
        v2.copy(on.headAt);
        v2.x += 0.45;
        v2.y += 0.25;
        if (steer(v2, 3.4) < 0.14) {
          bee.mode = 'hover';
          bee.t = 0;
          bee.angle = 0;
          picked = on.id;
          yard.onPickArrive(on.id);
        }
      }
    } else if (bee.mode === 'hover') {
      if (!on || on.fly) bee.mode = 'out';
      else {
        bee.t += dt;
        bee.angle += dt * 2.6;
        v2.copy(on.headAt);
        v2.x += Math.cos(bee.angle) * 0.45;
        v2.y += 0.22 + Math.sin(t * 5) * 0.05;
        v2.z += Math.sin(bee.angle) * 0.45;
        bee.at.lerp(v2, 1 - Math.exp(-dt * 10));
        if (bee.t > BEE_STAYS) {
          bee.mode = 'out';
          picked = null;
        }
      }
    } else {
      picked = null;
      v2.set(4.5, 4.2, -3);
      if (steer(v2, 3.6) < 0.5) {
        bee.mode = 'off';
        bee.g.visible = false;
      }
    }
    v1.subVectors(bee.at, bee.was);
    if (v1.lengthSq() > 1e-7) {
      let turn = Math.atan2(v1.x, v1.z) - bee.yaw;
      turn = Math.atan2(Math.sin(turn), Math.cos(turn));
      bee.yaw += turn * Math.min(1, dt * 10);
    }
    bee.g.position.copy(bee.at);
    bee.g.rotation.set(0, bee.yaw, 0);
    const beat = 0.25 + Math.sin(t * 95) * 0.65;
    bee.wings[0].rotation.z = -beat;
    bee.wings[1].rotation.z = beat;
  }

  // Fireflies: ten, each a bright dot inside a faint one, out only at night.
  const fireflies = Array.from({ length: 10 }, () => {
    const x = -2.4 + rand() * 4.8;
    const z = -3.5 + rand() * 6.5;
    const dot = basic(PAINT.glow, { transparent: true, opacity: 0 });
    const halo = basic(PAINT.glow, { transparent: true, opacity: 0 });
    const g = new THREE.Group();
    add(g, mesh(ball, dot, 0, 0, 0, false)).scale.setScalar(0.04);
    add(g, mesh(ball, halo, 0, 0, 0, false)).scale.setScalar(0.12);
    scene.add(g);
    return { g, dot, halo, x, z, y: groundY(x, z) + 0.5 + rand() * 1.1 };
  });

  return {
    burst,
    sendBee,
    visit,
    water,
    /** Where a friend's butterfly is, while one is here, for the name that floats over it. */
    visitorAt: (): THREE.Vector3 | null => (guest.mode !== 'off' ? guest.at : null),
    /** The flower the bee is circling, if it is circling one. */
    picked: () => picked,
    /** Put the bee away at once, for when the garden is planted afresh. */
    callOffBee() {
      bee.mode = 'off';
      bee.g.visible = false;
      picked = null;
    },
    /** Move everything on by one frame. `night` is how much of the night is out, from 0 to 1. */
    update(dt: number, t: number, still: boolean, night: number) {
      for (const b of butterflies) {
        const out = !still && night < 0.5;
        b.shown = damp(b.shown, out ? 1 : 0, 4, dt);
        b.g.visible = b.shown > 0.02;
        b.g.scale.setScalar(Math.max(0.001, b.shown));
        if (b.g.visible) moveButterfly(b, dt, t);
      }
      moveBee(dt, t);
      moveCan(dt);
      if (guest.mode !== 'off') {
        guest.shown = damp(guest.shown, 1, 5, dt);
        guest.g.visible = true;
        guest.g.scale.setScalar(Math.max(0.001, guest.shown * 1.5));
        moveButterfly(guest, dt, t);
      } else if (guest.g.visible) {
        guest.g.visible = false;
        guest.shown = 0;
      }
      fireflies.forEach((f, i) => {
        const glow = still ? 0 : night * (0.3 + 0.7 * (0.5 + 0.5 * Math.sin(t * 2.2 + i * 1.7)));
        f.dot.opacity = glow;
        f.halo.opacity = glow * 0.25;
        f.g.visible = glow > 0.01;
        f.g.position.set(f.x + Math.sin(t * 0.6 + i) * 0.5, f.y + Math.sin(t * 0.9 + i * 2) * 0.25, f.z + Math.cos(t * 0.5 + i * 1.3) * 0.5);
      });
      for (const p of petals) {
        if (p.life <= 0) continue;
        p.life -= dt;
        if (p.life <= 0) {
          p.m.visible = false;
          continue;
        }
        p.v.y -= p.gravity * dt;
        // One that is drifting down from a tree is hardly slowed by the air.
        p.v.multiplyScalar(1 - (p.gravity > 1 ? 1.6 : 0.1) * dt);
        p.v.x += Math.sin(t * 8 + p.phase) * 1.5 * dt;
        p.m.position.addScaledVector(p.v, dt);
        p.m.rotation.x += dt * 6;
        p.m.rotation.z += dt * 4;
        const s = Math.min(1, p.life / 0.4);
        p.m.scale.set(0.07 * s, 0.018 * s, 0.13 * s);
      }
    },
  };
}
