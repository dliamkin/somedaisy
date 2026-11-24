// The house grows with the group's rank. It starts as the cottage. Then, one rank at a time, it
// gains a garage, a second story, a lanai across the front, a patio with an umbrella, and at the
// top a room over the garage and a cupola with a pennant. Each level keeps everything below it.
//
// New walls and roofs are made of the house's own materials, so the group's paint covers the whole
// house at every level. Nothing is added above the eave to the right of the ridge: the daisy in
// the sky sits there and has to stay clear.
//
// Ported from the design handoff (design_handoff_garden_a_v3/garden3d-v3.js). The cottage itself,
// which this builds on to, is in land.ts.

import * as THREE from 'three';

import { clamp, groundY } from './ground';
import type { Kit } from './kit';
import type { Land } from './land';
import { HOUSE_PARTS, PAINT } from './palette';
import { HOUSE_LEVELS } from './plan';

/** How far a second story lifts the top of the house, and how far a room over the garage lifts the garage's roof. */
const STORY = 1.25;
const OVER_GARAGE = 1.15;
/** How far the pots by the door are lifted to stand on a lanai's deck. */
const DECK_STEP = 0.12;

/** One thing the house gains: the level it comes at, where its puff of specks bursts from, and how far it has sprung up. */
type Part = { level: number; from: THREE.Vector3; size: number; v: number; up: boolean };

const part = (level: number, x: number, y: number, z: number): Part => ({ level, from: new THREE.Vector3(x, y, z), size: 0, v: 0, up: false });

export type HouseParts = ReturnType<typeof buildHouseParts>;

export function buildHouseParts(kit: Kit, land: Land) {
  const { lambert, mesh, add, ball } = kit;
  const { house, top, white, wallPaint, roofPaint, gablePaint, doorPaint, trimPaint, panePaint, stonePaint } = land;

  /** A length of wall, with its boards the same size as on the first walls. */
  const wall = (w: number, h: number, d: number) => {
    const shape = new THREE.BoxGeometry(w, h, d);
    const uv = shape.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) * w) / 3, (uv.getY(i) * h) / 1.8);
    return shape;
  };
  /** A flat piece of roof, with its rows of shingles running along its width. */
  const slab = (w: number, d: number) => {
    const shape = new THREE.BoxGeometry(w, 0.06, d);
    const uv = shape.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getY(i) * d, uv.getX(i) * w);
    return shape;
  };
  /** A gabled roof: so far out each side of its ridge, so high, and so deep. */
  const gabled = (half: number, high: number, deep: number) => {
    const end = new THREE.Shape();
    end.moveTo(-half, 0);
    end.lineTo(half, 0);
    end.lineTo(0, high);
    end.closePath();
    return new THREE.ExtrudeGeometry(end, { depth: deep, bevelEnabled: false });
  };
  const box = (parent: THREE.Object3D, w: number, h: number, d: number, paint: THREE.Material, x: number, y: number, z: number) => add(parent, mesh(new THREE.BoxGeometry(w, h, d), paint, x, y, z));
  /** A window: its pane, the trim round it, and one bar each way across it. */
  const windowAt = (parent: THREE.Object3D, x: number, y: number, z: number, w: number, h: number) => {
    parent.add(mesh(new THREE.BoxGeometry(w, h, 0.06), panePaint, x, y, z, false));
    const trim: [number, number, number, number][] = [
      [0, h / 2 + 0.035, w + 0.14, 0.07],
      [0, -h / 2 - 0.035, w + 0.14, 0.07],
      [-w / 2 - 0.035, 0, 0.07, h],
      [w / 2 + 0.035, 0, 0.07, h],
      [0, 0, 0.04, h],
      [0, 0, w, 0.04],
    ];
    for (const [dx, dy, tw, th] of trim) box(parent, tw, th, 0.1, trimPaint, x + dx, y + dy, z + 0.01);
  };
  /** A group for one part, out of sight until its level is reached. */
  const group = (parent: THREE.Object3D, x: number, y: number, z: number) => {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    g.visible = false;
    parent.add(g);
    return g;
  };

  const parts = {
    garage: part(2, 2.1, 1, 0.9),
    story: part(3, 0, 2.6, 1.2),
    lanai: part(4, 0, 1, 1.9),
    patio: part(5, -2.35, 1, -0.1),
    mansion: part(6, 0, 4.6, 0.4),
  };
  const everyPart = Object.values(parts);
  // The cupola's roof is the roof's colour without its shingles.
  const plainRoof = lambert(PAINT.roof);
  const gold = lambert(HOUSE_PARTS.gold);
  /** The snow that lies on the new roofs in winter. */
  const snows: THREE.Object3D[] = [];

  // Level 2: a garage on the right, set back from the front of the house, with two pavers for a
  // drive. Its roof is a group of its own, so the room that comes at level 6 can lift it.
  const garage = group(house, 2.125, 0, 0.15);
  const garageTop = new THREE.Group();
  garage.add(garageTop);
  garage.add(mesh(wall(1.25, 2, 1.5), wallPaint, 0, 0.3, 0));
  garageTop.add(mesh(gabled(0.72, 0.6, 1.75), [gablePaint, roofPaint], 0, 1.3, -0.875));
  snows.push(add(garageTop, mesh(gabled(0.72, 0.6, 1.65), white, 0, 1.34, -0.825)));
  box(garage, 1, 0.98, 0.05, lambert(HOUSE_PARTS.garageDoor), 0, 0.62, 0.76);
  for (const y of [0.38, 0.62, 0.86]) box(garage, 1, 0.02, 0.07, trimPaint, 0, y, 0.76);
  for (const x of [-0.3, 0, 0.3]) garage.add(mesh(new THREE.BoxGeometry(0.22, 0.15, 0.07), panePaint, x, 0.985, 0.76, false));
  box(garage, 1.14, 0.07, 0.08, trimPaint, 0, 1.145, 0.76);
  for (const x of [-0.535, 0.535]) box(garage, 0.07, 1, 0.08, trimPaint, x, 0.63, 0.76);
  const pavers: [number, number][] = [
    [-4.02, 1.03],
    [-3.5, 1.55],
  ];
  for (const [worldZ, z] of pavers) {
    // Each lies on the slope of the hill where it is.
    const paver = box(garage, 1, 0.05, 0.44, stonePaint, 0, groundY(2.125, worldZ) - house.position.y + 0.03, z);
    paver.rotation.set(-0.19, 0, -0.13);
    paver.castShadow = false;
    paver.receiveShadow = true;
  }

  // Level 3: a second story, with a white band where it meets the first and two shuttered
  // windows. It grows upward, and the whole top of the house rides up on it.
  const story = group(house, 0, 1.8, 0);
  story.add(mesh(wall(3, STORY, 2.2).translate(0, STORY / 2, 0), wallPaint));
  box(story, 3.08, 0.07, 2.28, white, 0, 0, 0);
  for (const x of [-0.72, 0.72]) {
    windowAt(story, x, 0.68, 1.11, 0.56, 0.66);
    // The shutters are the colour of the door.
    for (const side of [-0.45, 0.45]) box(story, 0.14, 0.7, 0.05, doorPaint, x + side, 0.68, 1.12);
  }

  // Level 4: a lanai. A deck, three posts and a lean-to roof across the front, with the door in
  // its left bay and the window in its right. The railing leaves the bay in front of the door open.
  const lanai = group(house, 0, 0, 1.45);
  box(lanai, 3.3, 0.5, 0.72, lambert(HOUSE_PARTS.deck), 0, 0.17, 0);
  for (const x of [-1.56, 0, 1.56]) box(lanai, 0.09, 1.22, 0.09, white, x, 1.03, 0.3);
  box(lanai, 3.3, 0.1, 0.11, white, 0, 1.67, 0.3);
  add(lanai, mesh(slab(3.5, 0.95), roofPaint, 0, 1.86, 0.02)).rotation.x = 0.33;
  {
    const snow = box(lanai, 3.5, 0.05, 0.95, white, 0, 1.91, 0.02);
    snow.rotation.x = 0.33;
    snows.push(snow);
  }
  const rails: [number, number][] = [
    [0.78, 1.47],
    [-1.3, 0.46],
  ];
  for (const [x, w] of rails) box(lanai, w, 0.05, 0.05, white, x, 0.86, 0.3);
  for (const x of [0.2, 0.4, 0.6, 0.8, 1, 1.2, 1.4, -1.2, -1.4]) box(lanai, 0.035, 0.42, 0.035, white, x, 0.64, 0.3);
  for (const x of [-1.6, 1.6]) {
    box(lanai, 0.05, 0.05, 0.62, white, x, 0.86, -0.02);
    for (const z of [-0.17, 0.08]) box(lanai, 0.035, 0.42, 0.035, white, x, 0.64, z);
  }

  // Level 5: a patio on the left. A round stone terrace with a table, two chairs and a striped
  // umbrella, whose canopy is what shows over the shrubs from the garden.
  const patio = group(house, -2.35, 0, -0.1);
  const stripes = kit.painted(64, 8, (pen, _w, h) => {
    for (let i = 0; i < 8; i++) {
      pen.fillStyle = HOUSE_PARTS.umbrella[i % 2];
      pen.fillRect(i * 8, 0, 8, h);
    }
  });
  stripes.wrapS = stripes.wrapT = THREE.RepeatWrapping;
  stripes.anisotropy = 8;
  patio.add(mesh(new THREE.CylinderGeometry(0.7, 0.74, 0.7, 24), stonePaint, 0, -0.33, 0));
  patio.add(mesh(new THREE.CylinderGeometry(0.27, 0.27, 0.04, 18), white, 0, 0.5, 0));
  patio.add(mesh(new THREE.CylinderGeometry(0.03, 0.05, 0.48, 8), white, 0, 0.26, 0));
  patio.add(mesh(new THREE.CylinderGeometry(0.018, 0.018, 1.2, 6), trimPaint, 0, 1.1, 0));
  patio.add(mesh(new THREE.ConeGeometry(0.72, 0.3, 8, 1, true), lambert(PAINT.white, { side: THREE.DoubleSide, map: stripes }), 0, 1.62, 0));
  add(patio, mesh(ball, gold, 0, 1.79, 0)).scale.setScalar(0.035);
  for (const side of [-1, 1]) {
    box(patio, 0.24, 0.04, 0.24, white, side * 0.44, 0.27, 0);
    box(patio, 0.04, 0.3, 0.24, white, side * 0.55, 0.42, 0);
    box(patio, 0.2, 0.25, 0.2, trimPaint, side * 0.44, 0.125, 0);
  }

  // Level 6: a mansion. A room over the garage, which grows upward and lifts the garage's roof,
  // and on the ridge a cupola with panes on three sides, a gold ball and a pennant that waves.
  const overGarage = group(garage, 0, 1.3, 0);
  overGarage.add(mesh(wall(1.25, OVER_GARAGE, 1.5).translate(0, OVER_GARAGE / 2, 0), wallPaint));
  box(overGarage, 1.31, 0.06, 1.56, white, 0, 0, 0);
  windowAt(overGarage, 0, 0.6, 0.76, 0.5, 0.56);
  const cupola = group(top, 0, 2.82, 0.35);
  box(cupola, 0.62, 0.56, 0.62, white, 0, 0.28, 0);
  cupola.add(mesh(new THREE.BoxGeometry(0.3, 0.26, 0.04), panePaint, 0, 0.32, 0.31, false));
  for (const side of [-1, 1]) cupola.add(mesh(new THREE.BoxGeometry(0.04, 0.26, 0.3), panePaint, side * 0.31, 0.32, 0, false));
  add(cupola, mesh(new THREE.ConeGeometry(0.5, 0.5, 4), plainRoof, 0, 0.81, 0)).rotation.y = Math.PI / 4;
  add(cupola, mesh(ball, gold, 0, 1.09, 0)).scale.setScalar(0.05);
  cupola.add(mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.5, 6), trimPaint, 0, 1.33, 0));
  const pennant = new THREE.Group();
  pennant.position.set(0, 1.56, 0);
  cupola.add(pennant);
  {
    const flag = new THREE.Shape();
    flag.moveTo(0, 0);
    flag.lineTo(-0.36, -0.09);
    flag.lineTo(0, -0.18);
    flag.closePath();
    pennant.add(new THREE.Mesh(new THREE.ShapeGeometry(flag), lambert(HOUSE_PARTS.pennant, { side: THREE.DoubleSide })));
  }

  // Where a finished flower flies to and where the smoke rises from, before anything lifts them.
  const atticY = land.atticAt.y;
  const chimneyY = land.chimneyAt.y;
  const spot = new THREE.Vector3();
  /** A part that scales from its foot. */
  const whole = (g: THREE.Object3D, size: number) => {
    g.visible = size > 0.01;
    g.scale.setScalar(Math.max(0.001, size));
  };
  /** A part that grows upward. */
  const rising = (g: THREE.Object3D, size: number) => {
    g.visible = size > 0.01;
    g.scale.y = Math.max(0.001, size);
  };

  return {
    /** Whether the garage is up, which is when the fence and the shrubs right of the house are away. */
    garageUp: () => parts.garage.size > 0.5,
    /** How the string lights should hang: 1 as on the cottage, 2 to the garage's corner, 4 along the front of the lanai. */
    lightsLevel: (): 1 | 2 | 4 => (parts.lanai.size > 0.5 ? 4 : parts.garage.size > 0.5 ? 2 : 1),
    /**
     * Move the house on by one frame. `level` is 1 for the cottage up to 6 for the mansion. Each
     * part springs up when its level is reached, with a slight overshoot, and `burst` is asked for
     * a puff of warm specks where it arrives. With `snap` every part is simply there or not, which
     * is how it is when the garden opens and for people who have asked for less motion. `puffs` is
     * false while the camera is not in the garden to see one. `winter` runs from 0 to 1.
     */
    update(dt: number, t: number, level: number, still: boolean, snap: boolean, puffs: boolean, winter: number, burst: (at: THREE.Vector3, color: string, count: number) => void) {
      const now = clamp(Math.round(level || 1), 1, HOUSE_LEVELS);
      for (const p of everyPart) {
        const up = now >= p.level;
        if (up && !p.up && !snap && puffs) burst(spot.copy(p.from).add(house.position), HOUSE_PARTS.arrive, 18);
        p.up = up;
        const want = up ? 1 : 0;
        if (snap) {
          p.size = want;
          p.v = 0;
        } else {
          p.v += ((want - p.size) * 60 - p.v * 10) * dt;
          p.size += p.v * dt;
        }
      }
      whole(garage, parts.garage.size);
      whole(lanai, parts.lanai.size);
      whole(patio, parts.patio.size);
      whole(cupola, parts.mansion.size);
      rising(story, parts.story.size);
      rising(overGarage, parts.mansion.size);
      top.position.y = STORY * parts.story.size;
      garageTop.position.y = OVER_GARAGE * parts.mansion.size;
      land.pots.position.y = DECK_STEP * clamp(parts.lanai.size, 0, 1);
      land.fenceRight.visible = parts.garage.size < 0.5;
      land.atticAt.y = atticY + top.position.y;
      land.chimneyAt.y = chimneyY + top.position.y;
      plainRoof.color.copy(roofPaint.color);
      pennant.rotation.y = still ? 0 : Math.sin(t * 2.3) * 0.5;
      for (const snow of snows) snow.visible = winter > 0.03;
    },
  };
}
