// What a group earns for its yard by finishing things together: a bench, a birdbath with a small
// bird on its rim, strings of lights from the trees to the house, and then a picnic, a woodpile, a
// fire pit and a pond. Also the snow that falls in winter.
//
// Ported from the design handoffs (design_handoff_garden_a_v3/garden3d-v3.js is the newest).

import * as THREE from 'three';

import { clamp, damp, groundY, HILL, HILL_Z } from './ground';
import type { Kit } from './kit';
import type { Land } from './land';
import { EXTRAS, PAINT } from './palette';
import { BATH_AT, BENCH_AT, LAWN_EXTRAS, LAWN_SPOTS, type LawnExtra } from './plan';

/** Which of the earned things are out: each is true once it is unlocked and switched on. */
export type ExtrasOn = { bench: boolean; bath: boolean; lights: boolean } & Record<LawnExtra, boolean>;

type Point = [number, number, number];

/**
 * The three spans of lights, as [from, to, how far it sags]: left tree to the left eave, across
 * the front, and the right eave to the right tree. They are hung differently as the house grows.
 * With a garage (`level` 2) the right end goes to the garage's front corner, since the garage
 * stands where the string ran to the tree. With a lanai (4) the middle span hangs along its front.
 */
function spans(level: 1 | 2 | 4): [Point, Point, number][] {
  const eave: Point = level >= 4 ? [1.72, 0.98, -3.33] : [1.8, 1.2, -3.9];
  const leftEave: Point = [-eave[0], eave[1], eave[2]];
  const end: Point = level >= 2 ? [2.82, 0.78, -4.28] : [2.85, 1.3, -5.1];
  return [
    [[-2.9, 1.5, -5.4], leftEave, level >= 4 ? 0.25 : 0.22],
    [leftEave, eave, level >= 4 ? 0.2 : 0.3],
    [eave, end, level >= 2 ? 0.12 : 0.2],
  ];
}

export function buildExtras(kit: Kit, land: Land) {
  const { scene, lambert, basic, mesh, add, ball } = kit;
  const UP = new THREE.Vector3(0, 1, 0);
  const v1 = new THREE.Vector3();

  /** Stands a group of shapes on the hill at a spot, upright to the slope there and turned to face a way. */
  const onGround = (group: THREE.Group, [x, z]: [number, number], turn: number) => {
    const y = groundY(x, z);
    group.position.set(x, y - 0.01, z);
    group.quaternion.setFromUnitVectors(UP, v1.set(x, y + HILL, z - HILL_Z).normalize());
    group.rotateY(turn);
    group.visible = false;
    scene.add(group);
    return group;
  };

  // The bench, right of the path and turned toward it: white slats, with legs and arms in the trim colour.
  const bench = onGround(new THREE.Group(), BENCH_AT, -0.6);
  for (const z of [-0.13, 0, 0.13]) bench.add(mesh(new THREE.BoxGeometry(1.14, 0.04, 0.11), land.white, 0, 0.4, z));
  for (const y of [0.56, 0.7]) {
    const slat = mesh(new THREE.BoxGeometry(1.14, 0.1, 0.035), land.white, 0, y, -0.2 - (y - 0.4) * 0.1);
    slat.rotation.x = -0.1;
    bench.add(slat);
  }
  for (const x of [-0.5, 0.5]) {
    bench.add(mesh(new THREE.BoxGeometry(0.06, 0.54, 0.06), land.trimPaint, x, 0.27, 0.16));
    const back = mesh(new THREE.BoxGeometry(0.06, 0.8, 0.06), land.trimPaint, x, 0.39, -0.2);
    back.rotation.x = -0.1;
    bench.add(back);
    bench.add(mesh(new THREE.BoxGeometry(0.07, 0.04, 0.46), land.trimPaint, x, 0.55, -0.02));
  }

  // The birdbath, left of the path: a stone foot, stem and bowl, water, and a blue bird that dips to drink.
  const bath = onGround(new THREE.Group(), BATH_AT, 0);
  bath.add(mesh(new THREE.CylinderGeometry(0.2, 0.25, 0.07, 20), land.stonePaint, 0, 0.035, 0));
  bath.add(mesh(new THREE.CylinderGeometry(0.06, 0.1, 0.5, 14), land.stonePaint, 0, 0.32, 0));
  bath.add(mesh(new THREE.CylinderGeometry(0.38, 0.1, 0.15, 28), land.stonePaint, 0, 0.645, 0));
  add(bath, mesh(new THREE.TorusGeometry(0.375, 0.028, 8, 36), land.stonePaint, 0, 0.72, 0)).rotation.x = Math.PI / 2;
  add(bath, mesh(new THREE.CircleGeometry(0.35, 28), lambert(EXTRAS.water), 0, 0.73, 0, false)).rotation.x = -Math.PI / 2;
  const bird = new THREE.Group();
  const birdBody = new THREE.Group();
  const birdPaint = lambert(EXTRAS.bird);
  bird.position.set(0.3, 0.75, 0.16);
  bird.rotation.y = -2.06;
  bird.scale.setScalar(1.25);
  bird.add(birdBody);
  bath.add(bird);
  add(birdBody, mesh(ball, birdPaint, 0, 0.06, 0)).scale.set(0.06, 0.055, 0.09);
  add(birdBody, mesh(ball, birdPaint, 0, 0.12, 0.07)).scale.setScalar(0.042);
  add(birdBody, mesh(ball, lambert(PAINT.pot), 0, 0.045, 0.03)).scale.set(0.045, 0.04, 0.06);
  birdBody.add(mesh(new THREE.ConeGeometry(0.014, 0.045, 6).rotateX(Math.PI / 2), lambert(PAINT.center), 0, 0.118, 0.125));
  const tail = mesh(new THREE.BoxGeometry(0.035, 0.008, 0.09), birdPaint, 0, 0.075, -0.11);
  tail.rotation.x = 0.35;
  birdBody.add(tail);

  // The string lights: a hanging wire for each span, with a bulb every 0.32 along it and a soft
  // halo round each bulb that brightens at night. They are taken down and hung again when the
  // house grows (see `spans`).
  const lights = new THREE.Group();
  lights.visible = false;
  scene.add(lights);
  const wirePaint = new THREE.LineBasicMaterial({ color: PAINT.ink, transparent: true, opacity: 0 });
  const bulbPaint = basic(PAINT.white, { transparent: true, opacity: 0 });
  const haloPaint = basic(PAINT.glow, { transparent: true, opacity: 0, depthWrite: false });
  const stand = new THREE.Object3D();
  const color = new THREE.Color();
  let hungFor: 1 | 2 | 4 | null = null;
  const hang = (level: 1 | 2 | 4) => {
    if (level === hungFor) return;
    hungFor = level;
    for (const old of [...lights.children]) {
      lights.remove(old);
      // The bulbs and their halos are the one ball every part of the garden uses, which is kept.
      if (old instanceof THREE.InstancedMesh) old.dispose();
      else (old as THREE.Line).geometry.dispose();
    }
    const droop = (a: Point, b: Point, sag: number, t: number): Point => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t - sag * 4 * t * (1 - t), a[2] + (b[2] - a[2]) * t];
    const bulbsAt: Point[] = [];
    for (const [a, b, sag] of spans(level)) {
      const wire: number[] = [];
      for (let i = 0; i <= 20; i++) wire.push(...droop(a, b, sag, i / 20));
      const wireShape = new THREE.BufferGeometry();
      wireShape.setAttribute('position', new THREE.Float32BufferAttribute(wire, 3));
      lights.add(new THREE.Line(wireShape, wirePaint));
      const count = Math.round(Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]) / 0.32);
      for (let i = 0; i < count; i++) bulbsAt.push(droop(a, b, sag, (i + 0.5) / count));
    }
    const bulbs = new THREE.InstancedMesh(ball, bulbPaint, bulbsAt.length);
    const halos = new THREE.InstancedMesh(ball, haloPaint, bulbsAt.length);
    bulbsAt.forEach((p, i) => {
      stand.position.set(p[0], p[1] - 0.05, p[2]);
      stand.scale.setScalar(0.05);
      stand.updateMatrix();
      bulbs.setMatrixAt(i, stand.matrix);
      bulbs.setColorAt(i, color.set(EXTRAS.bulbs[i % EXTRAS.bulbs.length]));
      stand.scale.setScalar(0.15);
      stand.updateMatrix();
      halos.setMatrixAt(i, stand.matrix);
    });
    bulbs.frustumCulled = halos.frustumCulled = false;
    lights.add(bulbs, halos);
  };
  hang(1);

  // The four bigger things for the lawn. The grass lies flat under each one that is out.
  const [picnic, pile, pit, pond] = LAWN_EXTRAS.map((key) => onGround(new THREE.Group(), LAWN_SPOTS[key].at, LAWN_SPOTS[key].turn));
  const barkPaint = lambert(EXTRAS.bark);
  const cutPaint = lambert(EXTRAS.cut);
  const rockPaint = lambert(EXTRAS.rock);
  const wickerPaint = lambert(EXTRAS.wicker);
  const wickerDark = lambert(EXTRAS.wickerDark);
  /** A log: bark round it and a pale cut face at each end. */
  const logPaint = [barkPaint, cutPaint, cutPaint];
  /** A flat shape laid on the ground. It takes shadows and casts none. */
  const lay = (shape: THREE.BufferGeometry, paint: THREE.Material, x: number, y: number, z: number) => {
    const m = mesh(shape.rotateX(-Math.PI / 2), paint, x, y, z, false);
    m.receiveShadow = true;
    return m;
  };

  // The picnic: a pink gingham blanket with a wicker basket, two plates, three apples, a bottle and a cup.
  {
    const gingham = kit.painted(32, 32, (pen, w, h) => {
      pen.fillStyle = PAINT.white;
      pen.fillRect(0, 0, w, h);
      pen.fillStyle = EXTRAS.gingham;
      pen.fillRect(0, 0, w / 2, h);
      pen.fillRect(0, 0, w, h / 2);
    });
    gingham.wrapS = gingham.wrapT = THREE.RepeatWrapping;
    gingham.repeat.set(5, 4);
    gingham.anisotropy = 8;
    picnic.add(lay(new THREE.PlaneGeometry(1, 0.8), lambert(PAINT.white, { map: gingham }), 0, 0.035, 0));
    picnic.add(mesh(new THREE.CylinderGeometry(0.15, 0.12, 0.15, 14), wickerPaint, 0.2, 0.11, -0.12));
    add(picnic, mesh(new THREE.TorusGeometry(0.15, 0.016, 6, 18), wickerDark, 0.2, 0.185, -0.12)).rotation.x = Math.PI / 2;
    picnic.add(mesh(new THREE.TorusGeometry(0.14, 0.013, 6, 16, Math.PI), wickerDark, 0.2, 0.185, -0.12));
    add(picnic, mesh(new THREE.BoxGeometry(0.2, 0.03, 0.2), land.white, 0.2, 0.19, -0.12)).rotation.y = 0.5;
    const plates: [number, number][] = [
      [-0.2, 0.1],
      [0.02, 0.27],
    ];
    for (const [x, z] of plates) picnic.add(mesh(new THREE.CylinderGeometry(0.085, 0.085, 0.012, 16), land.white, x, 0.045, z));
    const fruit: [number, number, string][] = [
      [-0.22, 0.1, EXTRAS.apple],
      [-0.16, 0.13, EXTRAS.apple],
      [0.02, 0.27, EXTRAS.greenApple],
    ];
    for (const [x, z, paint] of fruit) add(picnic, mesh(ball, lambert(paint), x, 0.086, z)).scale.setScalar(0.035);
    const bottle = lambert(EXTRAS.bottle);
    picnic.add(mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.15, 10), bottle, -0.38, 0.11, -0.18));
    picnic.add(mesh(new THREE.CylinderGeometry(0.012, 0.02, 0.06, 8), bottle, -0.38, 0.215, -0.18));
    picnic.add(mesh(new THREE.CylinderGeometry(0.03, 0.024, 0.05, 10), lambert(EXTRAS.cup), 0.06, 0.06, 0.04));
  }

  // The woodpile: twelve logs stacked end-on in rows of five, four and three between two stakes,
  // and a chopping stump with the axe left in it.
  {
    const log = new THREE.CylinderGeometry(0.085, 0.085, 0.5, 10).rotateX(Math.PI / 2);
    const rows: [number, number][] = [
      [5, 0.085],
      [4, 0.232],
      [3, 0.379],
    ];
    for (const [count, y] of rows) {
      for (let i = 0; i < count; i++) pile.add(mesh(log, logPaint, (i - (count - 1) / 2) * 0.172, y, (((i * 7 + count * 3) % 5) - 2) * 0.015));
    }
    for (const x of [-0.47, 0.47]) pile.add(mesh(new THREE.BoxGeometry(0.04, 0.5, 0.04), barkPaint, x, 0.25, 0));
    pile.add(mesh(new THREE.CylinderGeometry(0.16, 0.18, 0.24, 12), logPaint, 0.12, 0.12, 0.56));
    add(pile, mesh(new THREE.BoxGeometry(0.11, 0.08, 0.03), lambert(EXTRAS.axeHead), 0.12, 0.27, 0.56)).rotation.z = -0.5;
    add(pile, mesh(new THREE.BoxGeometry(0.03, 0.4, 0.03), lambert(EXTRAS.axeHandle), 0.216, 0.445, 0.56)).rotation.z = -0.5;
  }

  // The fire pit: a ring of nine stones round a bed of ash, three logs, three flames one inside
  // another, a warm light that is faint by day and strong after dark, and two log seats.
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * 6.283;
    const stone = add(pit, mesh(ball, rockPaint, Math.cos(a) * 0.3, 0.05, Math.sin(a) * 0.3));
    stone.scale.set(0.1, 0.07, 0.08);
    stone.rotation.y = 1.57 - a;
  }
  pit.add(lay(new THREE.CircleGeometry(0.27, 20), lambert(EXTRAS.ash), 0, 0.02, 0));
  for (let i = 0; i < 3; i++) {
    const a = i * 2.094 + 0.4;
    add(pit, mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.36, 8), barkPaint, Math.cos(a) * 0.09, 0.15, Math.sin(a) * 0.09)).rotation.set(-Math.sin(a) * 0.7, 0, Math.cos(a) * 0.7);
  }
  const flameSizes: [number, number][] = [
    [0.11, 0.34],
    [0.08, 0.26],
    [0.045, 0.17],
  ];
  const flames = flameSizes.map(([r, h], i) => add(pit, mesh(new THREE.ConeGeometry(r, h, 8), basic(EXTRAS.flames[i], { fog: false }), 0, 0.1 + h / 2, 0, false)));
  const fireLight = new THREE.PointLight(EXTRAS.fireLight, 0, 5, 1.6);
  fireLight.position.set(0, 0.45, 0);
  pit.add(fireLight);
  const seats: [number, number][] = [
    [-0.58, 0.1],
    [0.3, 0.52],
  ];
  for (const [x, z] of seats) pit.add(mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.2, 12), logPaint, x, 0.1, z));

  // The pond: water ringed with eleven stones, three lily pads and a pink flower, and three reeds at one end.
  {
    const water = lay(new THREE.CircleGeometry(0.5, 28), lambert(EXTRAS.water), 0, 0.035, 0);
    water.scale.set(1.15, 1, 0.85);
    pond.add(water);
    for (let i = 0; i < 11; i++) {
      const a = (i / 11) * 6.283;
      const stone = add(pond, mesh(ball, rockPaint, Math.cos(a) * 0.6, 0.04, Math.sin(a) * 0.45));
      stone.scale.set(0.1 + (i % 3) * 0.015, 0.06, 0.08);
      stone.rotation.y = 1.57 - a;
    }
    const padPaint = lambert(EXTRAS.lilyPad);
    const pads: Point[] = [
      [-0.15, 0.05, 0.4],
      [0.2, -0.12, 2.1],
      [0.05, 0.2, 4],
    ];
    for (const [x, z, turn] of pads) {
      // A pad is a disc with a notch cut out of it.
      const pad = lay(new THREE.CircleGeometry(0.09, 14, 0.5, 5.6), padPaint, x, 0.045, z);
      pad.rotation.y = turn;
      pond.add(pad);
    }
    add(pond, mesh(ball, lambert(EXTRAS.lily), 0.2, 0.07, -0.12)).scale.set(0.04, 0.03, 0.04);
    add(pond, mesh(ball, lambert(PAINT.center), 0.2, 0.09, -0.12)).scale.setScalar(0.015);
    const reedPaint = lambert(EXTRAS.reed);
    const reeds: Point[] = [
      [-0.42, -0.2, 0.4],
      [-0.47, -0.1, 0.32],
      [-0.37, -0.27, 0.46],
    ];
    for (const [x, z, tall] of reeds) {
      pond.add(mesh(new THREE.CylinderGeometry(0.008, 0.008, tall, 5), reedPaint, x, tall / 2, z));
      add(pond, mesh(ball, barkPaint, x, tall, z)).scale.set(0.018, 0.06, 0.018);
    }
  }

  // Snow: 420 flakes over the garden, falling at their own speeds and drifting a little.
  // They are placed with the garden's own run of made-up numbers, straight after the wildflowers.
  const FLAKES = 420;
  const flakeAt = new Float32Array(FLAKES * 3);
  const flakeSpeed = new Float32Array(FLAKES);
  for (let i = 0; i < FLAKES; i++) {
    flakeAt[i * 3] = kit.between(-8, 8);
    flakeAt[i * 3 + 1] = kit.between(-1, 10);
    flakeAt[i * 3 + 2] = kit.between(-10, 9);
    flakeSpeed[i] = kit.between(0.5, 1.1);
  }
  const flakePicture = kit.painted(32, 32, (x) => {
    const g = x.createRadialGradient(16, 16, 0, 16, 16, 16);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.6, 'rgba(255,255,255,.9)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g;
    x.fillRect(0, 0, 32, 32);
  });
  flakePicture.colorSpace = THREE.NoColorSpace;
  const snowShape = new THREE.BufferGeometry();
  snowShape.setAttribute('position', new THREE.BufferAttribute(flakeAt, 3));
  const snowPaint = new THREE.PointsMaterial({ color: PAINT.white, size: 0.1, map: flakePicture, transparent: true, opacity: 0, depthWrite: false, fog: false });
  const snow = new THREE.Points(snowShape, snowPaint);
  snow.frustumCulled = false;
  snow.visible = false;
  scene.add(snow);

  // Everything but the lights pops in on a spring. The lights fade in. `flat` is what the grass is
  // told about one of the bigger extras, so it lies down as the thing springs up.
  const popping: { group: THREE.Group; key: keyof ExtrasOn; size: number; v: number; flat?: THREE.Vector4 }[] = [
    { group: bench, key: 'bench', size: 0, v: 0 },
    { group: bath, key: 'bath', size: 0, v: 0 },
    { group: picnic, key: 'picnic', size: 0, v: 0, flat: kit.lawnSpots.value[0] },
    { group: pile, key: 'wood', size: 0, v: 0, flat: kit.lawnSpots.value[1] },
    { group: pit, key: 'fire', size: 0, v: 0, flat: kit.lawnSpots.value[2] },
    { group: pond, key: 'pond', size: 0, v: 0, flat: kit.lawnSpots.value[3] },
  ];
  const fire = popping[4];
  let lit = 0;
  /** True until the first frame, when whatever is already earned is simply there. Only a change after that pops or fades in. */
  let opening = true;

  return {
    /** Take the string lights down and hang them again for a house that has grown (see `spans`). Nothing happens if they already hang that way. */
    rehang: hang,
    /** Move everything on by one frame. `snap` skips the easing, `night` and `winter` run from 0 to 1. */
    update(dt: number, t: number, on: ExtrasOn, still: boolean, snap: boolean, night: number, winter: number) {
      for (const p of popping) {
        const want = on[p.key] ? 1 : 0;
        if (snap || opening) {
          p.size = want;
          p.v = 0;
        } else {
          p.v += ((want - p.size) * 80 - p.v * 11) * dt;
          p.size += p.v * dt;
        }
        p.group.visible = p.size > 0.01;
        p.group.scale.setScalar(Math.max(0.001, p.size));
        if (p.flat) p.flat.w = clamp(p.size, 0, 1);
      }
      birdBody.rotation.x = still ? 0 : Math.pow(Math.max(0, Math.sin(t * 0.8)), 10);
      {
        // The fire flickers in height and width and turns slowly. In a still garden it holds one shape.
        const flicker = still ? 1 : 0.88 + 0.12 * Math.sin(t * 13) + 0.08 * Math.sin(t * 7.3 + 1.7);
        flames.forEach((flame, i) => {
          flame.scale.set(1 + (still ? 0 : 0.1 * Math.sin(t * 9 + i * 2)), flicker * (1 + (still ? 0 : 0.14 * Math.sin(t * 11 + i))), 1);
          flame.rotation.y = still ? 0 : t * (1 + i);
        });
        fireLight.intensity = clamp(fire.size, 0, 1) * (1 + 7 * night) * flicker;
      }
      lit = opening ? (on.lights ? 1 : 0) : damp(lit, on.lights ? 1 : 0, 4, dt);
      opening = false;
      lights.visible = lit > 0.01;
      wirePaint.opacity = lit * 0.7;
      bulbPaint.opacity = lit;
      haloPaint.opacity = lit * (0.1 + 0.3 * night);

      snow.visible = winter > 0.03;
      snowPaint.opacity = winter * 0.95;
      if (snow.visible && !still) {
        for (let i = 0; i < FLAKES; i++) {
          const o = i * 3;
          flakeAt[o + 1] -= flakeSpeed[i] * dt;
          flakeAt[o] += (Math.sin(t * 0.9 + i) * 0.3 + 0.2) * dt;
          if (flakeAt[o + 1] < -1) {
            flakeAt[o + 1] = 10;
            flakeAt[o] = -8 + Math.random() * 16;
          }
        }
        snowShape.attributes.position.needsUpdate = true;
      }
    },
  };
}
