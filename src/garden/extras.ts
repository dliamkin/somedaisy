// What a group earns for its yard by finishing things together: a bench, a birdbath with a small
// bird on its rim, and strings of lights from the trees to the house. Also the snow that falls in winter.
//
// Ported from the design handoff (design_handoff_garden_a_v2/garden3d-v2.js).

import * as THREE from 'three';

import { damp, groundY, HILL, HILL_Z } from './ground';
import type { Kit } from './kit';
import type { Land } from './land';
import { EXTRAS, PAINT } from './palette';
import { BATH_AT, BENCH_AT } from './plan';

/** Which of the earned things are out: each is true once it is unlocked and switched on. */
export type ExtrasOn = { bench: boolean; bath: boolean; lights: boolean };

/** The three spans of lights, as [from, to, how far it sags]: left tree to left eave, across the front, right eave to right tree. */
const SPANS: [[number, number, number], [number, number, number], number][] = [
  [[-2.9, 1.5, -5.4], [-1.8, 1.2, -3.9], 0.22],
  [[-1.8, 1.2, -3.9], [1.8, 1.2, -3.9], 0.3],
  [[1.8, 1.2, -3.9], [2.85, 1.3, -5.1], 0.2],
];

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
  // halo round each bulb that brightens at night.
  const lights = new THREE.Group();
  lights.visible = false;
  scene.add(lights);
  const wirePaint = new THREE.LineBasicMaterial({ color: PAINT.ink, transparent: true, opacity: 0 });
  const bulbPaint = basic(PAINT.white, { transparent: true, opacity: 0 });
  const haloPaint = basic(PAINT.glow, { transparent: true, opacity: 0, depthWrite: false });
  {
    const hang = (a: number[], b: number[], sag: number, t: number) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t - sag * 4 * t * (1 - t), a[2] + (b[2] - a[2]) * t];
    const bulbsAt: number[][] = [];
    for (const [a, b, sag] of SPANS) {
      const wire: number[] = [];
      for (let i = 0; i <= 20; i++) wire.push(...hang(a, b, sag, i / 20));
      const wireShape = new THREE.BufferGeometry();
      wireShape.setAttribute('position', new THREE.Float32BufferAttribute(wire, 3));
      lights.add(new THREE.Line(wireShape, wirePaint));
      const count = Math.round(Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]) / 0.32);
      for (let i = 0; i < count; i++) bulbsAt.push(hang(a, b, sag, (i + 0.5) / count));
    }
    const bulbs = new THREE.InstancedMesh(ball, bulbPaint, bulbsAt.length);
    const halos = new THREE.InstancedMesh(ball, haloPaint, bulbsAt.length);
    const stand = new THREE.Object3D();
    const color = new THREE.Color();
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

  // The bench and the birdbath pop in on a spring. The lights fade in.
  const popping = [
    { group: bench, key: 'bench' as const, size: 0, v: 0 },
    { group: bath, key: 'bath' as const, size: 0, v: 0 },
  ];
  let lit = 0;
  /** True until the first frame, when whatever is already earned is simply there. Only a change after that pops or fades in. */
  let opening = true;

  return {
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
      }
      birdBody.rotation.x = still ? 0 : Math.pow(Math.max(0, Math.sin(t * 0.8)), 10);
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
