// The things in the garden that answer a tap, for the fun of it. None of them changes anything
// about the group or its ideas, and none is kept: each is a short animation with a small noise.
//
// - A tree, a conifer or a shrub waves its leaves and lets a few go (snow, in winter).
// - A stepping stone starts footprints up the path, one to a stone, and the door opens a crack
//   for whoever made them.
// - The attic window swings open and a little person waves from it.
// - The chimney chuffs three big puffs and blows a ring of smoke.
// - The birdbath splashes, the pond ripples and the fire pit throws sparks, when the group has them.
// - The daisy in the sky spins once.
//
// The lamps, the album and the vase inside the house are in hallway.ts.
//
// These are this app's own additions, not part of the design handoffs. Nothing here takes one of
// the garden's made-up numbers (`kit.rand`), so every tree and blade stays where it was.

import * as THREE from 'three';

import { groundY, HILL, HILL_Z } from './ground';
import type { Kit } from './kit';
import { FAR_HILLS, type Land } from './land';
import { PAINT, SEASONS, TOYS } from './palette';
import { BATH_AT, GARAGE_SHRUBS, LAWN_SPOTS, printShows, STEP_EVERY, walkLasts } from './plan';
import type { Leafy } from './plants';
import type { Effect } from './sound';

/** What the toys need to know about the rest of the garden, and what they ask of it. */
export type Playground = {
  /** Every tree, conifer and shrub. */
  leafy: Leafy[];
  /** Whether the garage is up, which is when the two shrubs right of the house are away. */
  garageUp: () => boolean;
  /** Which of the things a group earns are out. */
  out: () => { bath: boolean; fire: boolean; pond: boolean };
  /** The colours of the group's members, one of which the person in the attic wears. */
  colors: () => string[];
  /** Throw petals, leaves, drops or sparks into the air (see creatures.ts). */
  burst: (from: THREE.Vector3, color: string, count?: number, soft?: boolean, plain?: boolean) => void;
  /** Make a noise, if the garden's sounds are on. */
  play: (effect: Effect, detail?: number) => void;
};

type Found = { what: 'leafy'; leafy: Leafy } | { what: 'stones' | 'attic' | 'chimney' | 'bath' | 'pond' | 'fire' | 'sun' };

const ease = (x: number) => {
  const c = Math.max(0, Math.min(1, x));
  return c * c * (3 - 2 * c);
};
const chance = (a: number, b: number) => a + Math.random() * (b - a);

/** How long each lasts, in seconds. */
const SHAKE = 2;
const ATTIC = 3;
const PUFF = 1.5;
const SMOKE_RING = 2;
const RIPPLE = 0.9;
const SPIN = 1.3;
/** How big the daisy in the sky is drawn (see land.ts). */
const SUN_SIZE = 0.85;

export type Toys = ReturnType<typeof buildToys>;

export function buildToys(kit: Kit, land: Land, yard: Playground) {
  const { scene, lambert, basic, mesh, add, ball } = kit;
  const UP = new THREE.Vector3(0, 1, 0);
  const v1 = new THREE.Vector3();
  const v2 = new THREE.Vector3();

  /** A spot on the hill, and a point `up` above it, square to the slope there, as the earned things stand. */
  const onHill = ([x, z]: [number, number], up: number, into: THREE.Vector3) => {
    const y = groundY(x, z);
    v2.set(x, y + HILL, z - HILL_Z).normalize();
    return into.set(x, y, z).addScaledVector(v2, up);
  };

  // ---------- Leaves that wave ----------

  const shaking: { leafy: Leafy; t: number }[] = [];
  const shake = (leafy: Leafy) => {
    const already = shaking.find((s) => s.leafy === leafy);
    if (already) already.t = 0;
    else {
      // The graphics card is told about four at a time. The one shaken longest ago makes way.
      if (shaking.length >= kit.shakes.value.length) shaking.shift();
      shaking.push({ leafy, t: 0 });
    }
    // A few leaves come away: blossom in spring, turned leaves in autumn, and in winter snow.
    const season = kit.season.value;
    const turned = !leafy.evergreen && season.y > 0.5;
    for (let i = 0; i < 6; i++) {
      const color = season.z > 0.5 ? TOYS.snow : turned ? SEASONS.fallingLeaves[(Math.random() * SEASONS.fallingLeaves.length) | 0] : !leafy.evergreen && season.x > 0.5 ? SEASONS.blossom : leafy.color;
      v1.copy(leafy.from).lerp(leafy.to, Math.random());
      v1.x += chance(-0.7, 0.7) * leafy.near;
      v1.y += chance(-0.3, 0.6) * leafy.near;
      v1.z += chance(-0.7, 0.7) * leafy.near;
      yard.burst(v1, color, 1, true, true);
    }
    yard.play('rustle');
  };

  // ---------- Footprints up the path ----------

  const stones = land.stones;
  const printPicture = kit.painted(64, 96, (pen) => {
    // A right foot seen from above, toes at the top: the sole, the heel, and five toes, the big one on the inside.
    pen.fillStyle = `rgb(${TOYS.footprint})`;
    pen.beginPath();
    pen.ellipse(33, 46, 15, 21, 0.08, 0, 6.3);
    pen.fill();
    pen.beginPath();
    pen.ellipse(31, 74, 12, 15, 0, 0, 6.3);
    pen.fill();
    const toes: [number, number, number][] = [
      [17, 17, 6.5],
      [28, 11, 5],
      [37, 11, 4.5],
      [45, 14, 4],
      [51, 20, 3.5],
    ];
    for (const [x, y, r] of toes) {
      pen.beginPath();
      pen.arc(x, y, r, 0, 6.3);
      pen.fill();
    }
  });
  const printShape = new THREE.PlaneGeometry(0.22, 0.33).rotateX(-Math.PI / 2);
  const prints = stones.map(([x, z], i) => {
    // Each print points the way the path runs at its stone, and they fall left, right, left.
    const [ax, az] = stones[Math.max(i - 1, 0)];
    const [bx, bz] = stones[Math.min(i + 1, stones.length - 1)];
    const dx = bx - ax;
    const dz = bz - az;
    const long = Math.hypot(dx, dz) || 1;
    const side = i % 2 ? 1 : -1;
    const paint = new THREE.MeshBasicMaterial({ map: printPicture, transparent: true, opacity: 0, depthWrite: false });
    const print = new THREE.Mesh(printShape, paint);
    print.position.set(x + (-dz / long) * 0.045 * side, groundY(x, z) + 0.064, z + (dx / long) * 0.045 * side);
    print.rotation.y = Math.atan2(-dx, -dz);
    print.scale.x = side;
    print.visible = false;
    scene.add(print);
    return { print, paint };
  });
  /** Seconds since the walk up the path began, or null when nobody is walking. */
  let walk: number | null = null;
  /** How far the door stands open for whoever walked up, from 0 to 1. */
  let ajar = 0;

  // ---------- The attic window ----------

  const hole = mesh(new THREE.CircleGeometry(0.285, 28), basic(TOYS.attic), 0, 2.3, 1.304, false);
  hole.visible = false;
  land.top.add(hole);
  const person = new THREE.Group();
  person.visible = false;
  land.top.add(person);
  const coat = lambert(TOYS.coat);
  const face = lambert(TOYS.face);
  const eyes = basic(TOYS.eyes);
  add(person, mesh(ball, coat, 0, -0.17, 0, false)).scale.set(0.12, 0.16, 0.08);
  add(person, mesh(ball, face, 0, 0.04, 0.02, false)).scale.setScalar(0.09);
  for (const x of [-0.032, 0.032]) add(person, mesh(ball, eyes, x, 0.055, 0.1, false)).scale.setScalar(0.012);
  add(person, mesh(new THREE.TorusGeometry(0.028, 0.006, 6, 12, Math.PI), eyes, 0, 0.025, 0.1, false)).rotation.z = Math.PI;
  const arm = new THREE.Group();
  arm.position.set(0.1, -0.09, 0.03);
  person.add(arm);
  add(arm, mesh(ball, coat, 0, 0.07, 0, false)).scale.set(0.028, 0.085, 0.028);
  add(arm, mesh(ball, face, 0, 0.165, 0, false)).scale.setScalar(0.032);
  let attic: number | null = null;

  // ---------- The chimney ----------

  const smokePaint = () => lambert(PAINT.white, { transparent: true, opacity: 0 });
  const puffs = Array.from({ length: 5 }, (_, i) => {
    const paint = smokePaint();
    const puff = mesh(ball, paint, 0, 0, 0, false);
    puff.visible = false;
    scene.add(puff);
    return { puff, paint, t: null as number | null, lean: i * 1.7 };
  });
  const ringPaint = smokePaint();
  const ring = mesh(new THREE.TorusGeometry(1, 0.22, 8, 30).rotateX(Math.PI / 2), ringPaint, 0, 0, 0, false);
  ring.rotation.x = 0.45;
  ring.visible = false;
  scene.add(ring);
  let ringT: number | null = null;

  // ---------- Water ----------

  const rippleShape = new THREE.RingGeometry(0.82, 1, 32).rotateX(-Math.PI / 2);
  const ripples = Array.from({ length: 4 }, () => {
    const paint = basic(TOYS.ripple, { transparent: true, opacity: 0, depthWrite: false });
    const m = mesh(rippleShape, paint, 0, 0, 0, false);
    m.visible = false;
    scene.add(m);
    return { m, paint, t: null as number | null, wide: 0.3 };
  });
  /** A ring that spreads on water at a spot on the hill, lying square to the slope there, after a wait. */
  const ripple = (at: [number, number], up: number, wide: number, wait: number) => {
    const next = ripples.find((r) => r.t === null) ?? ripples[0];
    onHill(at, up, next.m.position);
    next.m.quaternion.setFromUnitVectors(UP, v2);
    next.wide = wide;
    next.t = -wait;
  };

  let spin: number | null = null;

  // ---------- Finding what a tap landed on ----------

  const hill = new THREE.Sphere(new THREE.Vector3(0, -HILL, HILL_Z), HILL);
  const farHills = FAR_HILLS.map(([x, y, z, r]) => new THREE.Sphere(new THREE.Vector3(x, y, z), r));
  const onLine = new THREE.Vector3();
  const closest = new THREE.Vector3();
  /**
   * The nearest thing along the ray that answers a tap, if there is one and nothing solid (the
   * house, the hill) is in front of it.
   */
  const find = (ray: THREE.Raycaster): Found | null => {
    const line = ray.ray;
    const best = { found: null as Found | null, far: Infinity };
    const offer = (found: Found, far: number) => {
      if (far < best.far) {
        best.far = far;
        best.found = found;
      }
    };
    /** How far along the ray it passes within `near` of a point, or null if it does not. */
    const passes = (at: THREE.Vector3, near: number): number | null => (line.distanceSqToPoint(at) <= near * near ? Math.max(0, v1.subVectors(at, line.origin).dot(line.direction)) : null);

    const garage = yard.garageUp();
    for (const leafy of yard.leafy) {
      if (garage && leafy.shrub !== undefined && GARAGE_SHRUBS.includes(leafy.shrub)) continue;
      if (leafy.kind === 'conifer') {
        if (line.distanceSqToSegment(leafy.from, leafy.to, onLine) <= leafy.near * leafy.near) offer({ what: 'leafy', leafy }, onLine.distanceTo(line.origin));
      } else {
        const far = passes(leafy.from, leafy.near);
        if (far !== null) offer({ what: 'leafy', leafy }, far);
      }
    }
    for (const [x, z] of stones) {
      const far = passes(v2.set(x, groundY(x, z) + 0.06, z), 0.33);
      if (far !== null) offer({ what: 'stones' }, far);
    }
    const out = yard.out();
    const water: ['bath' | 'pond' | 'fire', boolean, [number, number], number, number][] = [
      ['bath', out.bath, BATH_AT, 0.5, 0.5],
      ['pond', out.pond, LAWN_SPOTS.pond.at, 0.05, 0.6],
      ['fire', out.fire, LAWN_SPOTS.fire.at, 0.2, 0.42],
    ];
    for (const [what, there, at, up, near] of water) {
      if (!there) continue;
      const far = passes(onHill(at, up, onLine), near);
      if (far !== null) offer({ what }, far);
    }
    {
      const far = passes(land.skyDaisy.getWorldPosition(onLine), 5.2);
      if (far !== null) offer({ what: 'sun' }, far);
    }
    // What is on the house wins over the house itself, which would otherwise be in its way.
    const wall = ray.intersectObject(land.house, true)[0]?.distance ?? Infinity;
    {
      const far = passes(land.top.localToWorld(onLine.set(0, 2.3, 1.31)), 0.42);
      if (far !== null && far < wall + 0.8) offer({ what: 'attic' }, far - 2);
      v2.set(-0.95, 2.15, -0.2);
      land.top.localToWorld(v2);
      land.top.localToWorld(onLine.set(-0.95, 3.15, -0.2));
      if (line.distanceSqToSegment(v2, onLine, closest) <= 0.34 * 0.34) {
        const reached = closest.distanceTo(line.origin);
        if (reached < wall + 0.8) offer({ what: 'chimney' }, reached - 2);
      }
    }
    if (!best.found) return null;
    let blocked = wall;
    for (const ground of [hill, ...farHills]) {
      const hit = line.intersectSphere(ground, v1);
      if (hit) blocked = Math.min(blocked, hit.distanceTo(line.origin) + 0.4);
    }
    return best.far <= blocked ? best.found : null;
  };

  return {
    /** Whether the ray lands on something that answers a tap, for the pointer to show it. */
    over: (ray: THREE.Raycaster): boolean => find(ray) !== null,
    /**
     * A tap along this ray. True if something answered it. `still` is for people who have asked
     * for less motion: nothing out of doors answers then, since each answer is motion.
     */
    tap(ray: THREE.Raycaster, still: boolean): boolean {
      if (still) return false;
      const found = find(ray);
      if (!found) return false;
      if (found.what === 'leafy') shake(found.leafy);
      else if (found.what === 'stones') {
        // A walk that is still on its way up is left to finish.
        if (walk === null || walk > stones.length * STEP_EVERY) {
          walk = 0;
          yard.play('steps', stones.length);
        }
      } else if (found.what === 'attic') {
        if (attic === null) {
          attic = 0;
          const colors = yard.colors();
          coat.color.set(colors.length ? colors[(Math.random() * colors.length) | 0] : TOYS.coat);
          yard.play('attic');
        }
      } else if (found.what === 'chimney') {
        puffs.forEach((p, i) => (p.t = -i * 0.13));
        ringT = -0.55;
        yard.play('chimney');
      } else if (found.what === 'bath') {
        ripple(BATH_AT, 0.735, 0.33, 0);
        yard.burst(onHill(BATH_AT, 0.8, v1), TOYS.drop, 8, false, true);
        yard.play('splash');
      } else if (found.what === 'pond') {
        ripple(LAWN_SPOTS.pond.at, 0.045, 0.2, 0);
        ripple(LAWN_SPOTS.pond.at, 0.045, 0.38, 0.22);
        yard.burst(onHill(LAWN_SPOTS.pond.at, 0.1, v1), TOYS.drop, 4, false, true);
        yard.play('plop');
      } else if (found.what === 'fire') {
        yard.burst(onHill(LAWN_SPOTS.fire.at, 0.35, v1), TOYS.spark, 12, false, true);
        yard.play('crackle');
      } else if (spin === null) {
        spin = 0;
        yard.play('sun');
      }
      return true;
    },
    /** How far the door stands open for whoever walked up the path, from 0 to 1. */
    doorAjar: () => ajar,
    /** Move every toy on by one frame. */
    update(dt: number, still: boolean) {
      // Leaves.
      for (let i = shaking.length - 1; i >= 0; i--) {
        shaking[i].t += dt;
        if (shaking[i].t > SHAKE || still) shaking.splice(i, 1);
      }
      kit.shakes.value.forEach((told, i) => {
        const s = shaking[i];
        if (s) told.set(s.leafy.x, s.leafy.z, s.leafy.reach, s.t < 0.1 ? s.t / 0.1 : Math.exp(-(s.t - 0.1) * 2.4));
        else told.w = 0;
      });

      // Footprints, and the door at the end of them.
      if (walk !== null) {
        walk += dt;
        if (walk > walkLasts(stones.length) || still) walk = null;
      }
      prints.forEach(({ print, paint }, i) => {
        paint.opacity = walk === null ? 0 : 0.72 * printShows(walk, i);
        print.visible = paint.opacity > 0.01;
      });
      {
        const since = walk === null ? -1 : walk - stones.length * STEP_EVERY;
        ajar = since < 0 ? 0 : ease(since / 0.25) * (1 - ease((since - 0.75) / 0.35));
      }

      // The attic window: it swings open, someone pops up and waves, and it shuts behind them.
      if (attic !== null) {
        attic += dt;
        if (attic > ATTIC || still) attic = null;
      }
      {
        const t = attic ?? 0;
        const open = attic === null ? 0 : ease(t / 0.4) * (1 - ease((t - 2.5) / 0.45));
        const up = attic === null ? 0 : ease((t - 0.3) / 0.3) * (1 - ease((t - 2.2) / 0.25));
        land.atticHinge.rotation.y = -2 * open;
        hole.visible = open > 0.01;
        person.visible = up > 0.01;
        person.scale.setScalar(Math.max(0.001, up * (1 + 0.18 * Math.sin(Math.PI * Math.max(0, Math.min(1, (t - 0.3) / 0.45))))));
        person.position.set(0, 2.3 - 0.14 * (1 - up), 1.37);
        person.rotation.z = Math.sin(t * 6) * 0.07;
        arm.rotation.z = -0.55 + Math.sin(t * 12) * 0.45;
      }

      // The chimney: big puffs, one after another, then a ring that widens as it rises.
      const from = land.chimneyAt;
      for (const p of puffs) {
        if (p.t !== null) {
          p.t += dt;
          if (p.t > PUFF || still) p.t = null;
        }
        const k = p.t === null || p.t < 0 ? -1 : p.t / PUFF;
        p.puff.visible = k >= 0;
        if (k < 0) continue;
        const size = 0.18 + 0.5 * k;
        p.puff.position.set(from.x + Math.sin(k * 4 + p.lean) * 0.15 - k * k * 0.7, from.y + 0.1 + 3 * (1 - (1 - k) * (1 - k)), from.z);
        p.puff.scale.set(size, size * 0.85, size);
        p.paint.opacity = (1 - k) * 0.95;
      }
      if (ringT !== null) {
        ringT += dt;
        if (ringT > SMOKE_RING || still) ringT = null;
      }
      {
        const k = ringT === null || ringT < 0 ? -1 : ringT / SMOKE_RING;
        ring.visible = k >= 0;
        if (k >= 0) {
          const wide = 0.16 + 0.5 * k;
          ring.position.set(from.x - k * k * 0.5, from.y + 0.2 + 2.6 * k, from.z);
          ring.scale.set(wide, 0.16 + 0.2 * k, wide);
          ringPaint.opacity = (1 - k) * 0.85;
        }
      }

      // Rings on the water.
      for (const r of ripples) {
        if (r.t !== null) {
          r.t += dt;
          if (r.t > RIPPLE || still) r.t = null;
        }
        const k = r.t === null || r.t < 0 ? -1 : r.t / RIPPLE;
        r.m.visible = k >= 0;
        if (k < 0) continue;
        r.m.scale.setScalar(r.wide * (0.15 + 0.85 * k));
        r.paint.opacity = (1 - k) * 0.7;
      }

      // The daisy in the sky turns once round, swelling a little on the way.
      if (spin !== null) {
        spin += dt;
        if (spin > SPIN || still) spin = null;
      }
      if (spin !== null) {
        const part = Math.sin((Math.PI * spin) / SPIN);
        land.skyDaisy.rotation.z -= ((Math.PI * Math.PI) / SPIN) * part * dt;
        land.skyDaisy.scale.setScalar(SUN_SIZE * (1 + 0.1 * part));
      } else land.skyDaisy.scale.setScalar(SUN_SIZE);
    },
  };
}
