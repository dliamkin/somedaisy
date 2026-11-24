// The garden's trees, shrubs and grass. All of it is worked out, not loaded: limbs are tubes with
// painted bark, and leaves and blades of grass are one small shape drawn tens of thousands of
// times. It is built from the same run of made-up numbers every time, so it is always the same garden.
//
// Ported from the design handoffs (design_handoff_garden_a_v3/garden3d-v3.js is the newest). The
// order things are built in matters: change it and every tree after the change grows differently.
//
// The seasons are done on the graphics card. Each leaf knows whether it is evergreen: the leaves of
// the broadleaf trees turn in autumn, blossom in spring and shrink away in winter, and the conifers
// and shrubs keep theirs and take snow.

import * as THREE from 'three';

import { clamp, groundY, lawn, mix3, pathX, type Rgb } from './ground';
import type { Kit, Shader } from './kit';
import { BARK_STREAKS, BLADES, GREENS, PAINT, WILDFLOWERS, type Greens } from './palette';
import { BATH_AT, BENCH_AT, FRONT, GARAGE_SHRUBS, LAWN_SPOTS, SLOTS } from './plan';

/** How each kind of bark tints the one painted bark picture. */
const BARK_PLAIN: Rgb = [0.96, 0.93, 0.9];
const BARK_PALE: Rgb = [1.18, 1.12, 1.06];
const BARK_CONIFER: Rgb = [0.72, 0.62, 0.56];

type TreeSpec = {
  /** Its size, where 1 is the tree left of the house. */
  size: number;
  trunk: number;
  /** How long its first limbs are. */
  limb: number;
  /** How thick the trunk is at the ground. */
  girth: number;
  /** How many times a limb forks before it ends in leaves. */
  depth: number;
  forks: number;
  /** How far a limb wanders as it grows. */
  wander: number;
  /** How big each clump of leaves is, how many leaves it has, and how big each leaf is. */
  clump: number;
  leaves: number;
  leaf: number;
  greens: Greens;
  bark: Rgb;
};

const near = (size: number, greens: Greens, bark: Rgb, more?: Partial<TreeSpec>): TreeSpec => ({ size, trunk: 1.5, limb: 1.0, girth: 0.2, depth: 3, forks: 3, wander: 0.09, clump: 0.58, leaves: 240, leaf: 0.21, greens, bark, ...more });
/** The trees further back fork once less and carry bigger clumps of bigger leaves. */
const far = (size: number, greens: Greens, bark: Rgb): TreeSpec => near(size, greens, bark, { trunk: 1.7, limb: 1.2, depth: 2, wander: 0.1, clump: 0.85, leaves: 210, leaf: 0.28 });

/**
 * The broadleaf trees, as [x, z, what kind]. The first two frame the house. The one on the right
 * is kept short so it never covers the daisy in the sky. The third is just out of view and is
 * there for the dappled shade it casts on the right of the lawn.
 */
export const TREES: [number, number, TreeSpec][] = [
  [-3.05, -5.65, near(1, GREENS.left, BARK_PLAIN)],
  [3.0, -5.3, near(0.8, GREENS.right, BARK_PALE, { trunk: 1.35, girth: 0.17, leaves: 220 })],
  [5.7, 0.9, near(1.05, GREENS.side, BARK_PLAIN, { trunk: 1.6, leaves: 200, leaf: 0.23 })],
  [-6.0, 1.7, near(0.9, GREENS.right, BARK_PALE, { leaves: 190, leaf: 0.23 })],
  [-7.6, -7.2, far(1.1, GREENS.left, BARK_PLAIN)],
  [6.5, -7.9, far(1, GREENS.side, BARK_PLAIN)],
  [-1.0, -11.3, far(0.9, GREENS.left, BARK_PLAIN)],
  [8.8, -3.2, far(1, GREENS.right, BARK_PALE)],
];

/** The conifers, as [x, z, height]. */
export const CONIFERS: [number, number, number][] = [
  [-4.7, -9.4, 5.6],
  [-6.3, -8.4, 6.4],
  [-2.9, -10.4, 4.8],
  [4.3, -9.3, 4.3],
  [2.4, -10.8, 3.8],
  [7.4, -6.6, 4.8],
  [-8.2, -5.2, 5.2],
  [0.8, -11.8, 3.6],
];

/** The shrubs, as [x, z, size, greens, leaf size]. */
export const SHRUBS: [number, number, number, Greens, number][] = [
  [-2.05, -4.25, 0.55, GREENS.shrubA, 0.13],
  [-1.62, -3.98, 0.28, GREENS.shrubB, 0.11],
  [1.95, -4.25, 0.6, GREENS.shrubA, 0.13],
  [2.45, -4.05, 0.4, GREENS.shrubB, 0.12],
  [-3.3, -2.7, 0.5, GREENS.shrubB, 0.13],
  [3.05, -3.1, 0.48, GREENS.shrubA, 0.13],
  [-4.8, -4.3, 0.62, GREENS.shrubA, 0.14],
  [4.7, -4.5, 0.55, GREENS.shrubB, 0.14],
];

/** The two pots by the door, as [x, z]. */
export const POTS: [number, number][] = [
  [-1.3, -3.95],
  [0.12, -3.95],
];

/** Where the fence posts stand, either side of the house, as [x, z]. */
export const FENCE_POSTS: [number, number][] = [-1, 1].flatMap((side) => Array.from({ length: 5 }, (_, i): [number, number] => [side * (1.95 + i * 0.42), -4.75]));

type Shades = { dark: THREE.Color; light: THREE.Color; yellowed: THREE.Color; core: THREE.Color };
const shadesOf = (g: Greens): Shades => ({ dark: new THREE.Color(g.dark), light: new THREE.Color(g.light), yellowed: new THREE.Color(g.yellowed), core: new THREE.Color(g.core) });

const TURN = 6.2832;
const floats = (values: number[], size: number) => new THREE.Float32BufferAttribute(values, size);

/**
 * Grows every tree, conifer and shrub, and adds them to the scene as three shapes: the bark, the
 * dark hearts of the clumps, and the leaves. What it hands back puts away the two shrubs right of
 * the house, which make way for the garage, and brings them back.
 */
export function buildTrees(kit: Kit): { hideGarageShrubs: (hidden: boolean) => void } {
  const { rand, between, quality } = kit;
  // Everything is gathered into these lists first, then handed over in one go.
  const bark = { at: [] as number[], facing: [] as number[], uv: [] as number[], tint: [] as number[], corners: [] as number[] };
  const leaves = { placed: [] as number[], color: [] as number[], facing: [] as number[], sway: [] as number[] };
  // `anchor` is where a point of a clump's dark heart goes to in winter: the middle of its clump, so it shrinks away. An evergreen's stays put.
  const cores = { at: [] as number[], facing: [] as number[], color: [] as number[], anchor: [] as number[] };

  const UP = new THREE.Vector3(0, 1, 0);
  const q1 = new THREE.Quaternion();
  const q2 = new THREE.Quaternion();
  const placed = new THREE.Matrix4();
  const scale = new THREE.Vector3();
  const spot = new THREE.Vector3();
  const lean = new THREE.Vector3();
  const out = new THREE.Vector3();
  const facing = new THREE.Vector3();
  const shade = new THREE.Color();

  /** A limb: a tube that follows `points`, as thick at each as `girthAt` says (0 at its start, 1 at its end). */
  const limb = (points: THREE.Vector3[], girthAt: (along: number) => number, sides: number, tint: Rgb) => {
    const first = bark.at.length / 3;
    const n = points.length;
    const T = new THREE.Vector3();
    const N = new THREE.Vector3(1, 0, 0);
    const B = new THREE.Vector3();
    let length = 0;
    for (let i = 0; i < n; i++) {
      T.subVectors(points[Math.min(i + 1, n - 1)], points[Math.max(i - 1, 0)]).normalize();
      N.addScaledVector(T, -N.dot(T));
      if (N.lengthSq() < 1e-4) N.set(0, 0, 1).addScaledVector(T, -T.z);
      N.normalize();
      B.crossVectors(T, N);
      if (i) length += points[i].distanceTo(points[i - 1]);
      const r = girthAt(i / (n - 1));
      for (let j = 0; j <= sides; j++) {
        const a = (j / sides) * TURN;
        const c = Math.cos(a);
        const s = Math.sin(a);
        const nx = N.x * c + B.x * s;
        const ny = N.y * c + B.y * s;
        const nz = N.z * c + B.z * s;
        bark.at.push(points[i].x + nx * r, points[i].y + ny * r, points[i].z + nz * r);
        bark.facing.push(nx, ny, nz);
        bark.uv.push((j / sides) * 2, length * 1.1);
        bark.tint.push(tint[0], tint[1], tint[2]);
      }
    }
    for (let i = 0; i < n - 1; i++) {
      for (let j = 0; j < sides; j++) {
        const a = first + i * (sides + 1) + j;
        const b = a + sides + 1;
        bark.corners.push(a, a + 1, b, b, a + 1, b + 1);
      }
    }
  };

  /**
   * One leaf, at `at`, growing along `along`. `evergreen` is 1 for a leaf that stays all year.
   * `keep` is false for the leaves a phone leaves out: the made-up number is still used, so the
   * rest of the garden grows exactly as it would have.
   */
  const leaf = (at: THREE.Vector3, along: THREE.Vector3, wide: number, long: number, color: THREE.Color, face: THREE.Vector3, sway: number, flutter: number, evergreen: number, keep: boolean) => {
    const spin = rand() * TURN;
    if (!keep) return;
    q1.setFromUnitVectors(UP, along);
    q2.setFromAxisAngle(along, spin);
    q1.premultiply(q2);
    placed.compose(at, q1, scale.set(wide * quality.leafScale, long * quality.leafScale, wide * quality.leafScale));
    for (let k = 0; k < 16; k++) leaves.placed.push(placed.elements[k]);
    leaves.color.push(color.r, color.g, color.b);
    leaves.facing.push(face.x, face.y, face.z);
    leaves.sway.push(sway, flutter, evergreen);
  };

  const ballPoints = new THREE.IcosahedronGeometry(1, 1).attributes.position;
  const conePoints = new THREE.ConeGeometry(1, 1, 9, 1, true).toNonIndexed().attributes.position;

  /** The dark heart of a clump of leaves, so no sky shows through the middle of it. */
  const core = (c: THREE.Vector3, rx: number, ry: number, color: THREE.Color, evergreen: number) => {
    for (let i = 0; i < ballPoints.count; i++) {
      const x = ballPoints.getX(i);
      const y = ballPoints.getY(i);
      const z = ballPoints.getZ(i);
      const k = 0.62 + 0.38 * (y * 0.5 + 0.5);
      cores.at.push(c.x + x * rx, c.y + y * ry, c.z + z * rx);
      if (evergreen) cores.anchor.push(c.x + x * rx, c.y + y * ry, c.z + z * rx);
      else cores.anchor.push(c.x, c.y, c.z);
      cores.facing.push(x, y, z);
      cores.color.push(color.r * k, color.g * k, color.b * k);
    }
  };

  /** One clump of leaves. They sit near its outside, lighter on the outside and on top, darker within. */
  const clump = (c: THREE.Vector3, r: number, count: number, shades: Shades, crown: THREE.Vector3, size: number, base: number, flat = 0.82, evergreen = 0) => {
    core(c, r * 0.72, r * 0.72 * flat, shades.core, evergreen);
    for (let i = 0; i < count; i++) {
      out.set(between(-1, 1), between(-0.6, 1), between(-1, 1)).normalize();
      const rho = r * (1 - 0.45 * rand() * rand());
      spot.set(c.x + out.x * rho, c.y + out.y * rho * flat, c.z + out.z * rho);
      lean.set(out.x + between(-0.7, 0.7), out.y * 0.5 - 0.4 + between(-0.5, 0.5), out.z + between(-0.7, 0.7)).normalize();
      // Each leaf is lit as if it faced out from the crown, which is what makes the tree read as one soft shape.
      facing.copy(spot).sub(crown).normalize().multiplyScalar(0.5).addScaledVector(out, 0.6);
      facing.y += 0.3;
      facing.normalize();
      const lightness = clamp(((rho / r - 0.55) / 0.45) * 0.45 + (out.y * 0.5 + 0.5) * 0.5 + between(-0.2, 0.2), 0, 1);
      const s = size * between(0.75, 1.3);
      shade.copy(shades.dark).lerp(shades.light, lightness);
      if (rand() < 0.07) shade.lerp(shades.yellowed, 0.55);
      leaf(spot, lean, s, s, shade, facing, Math.max(0, spot.y - base) * 0.016, s * 0.2, evergreen, i % quality.leafEvery === 0);
    }
  };

  const tree = (x: number, z: number, spec: TreeSpec) => {
    const foot = groundY(x, z) - 0.08;
    const S = spec.size;
    const shades = shadesOf(spec.greens);
    const tips: THREE.Vector3[] = [];
    const mids: THREE.Vector3[] = [];
    const side = new THREE.Vector3();
    const across = new THREE.Vector3();
    const grow = (start: THREE.Vector3, heading: THREE.Vector3, length: number, girth: number, depth: number) => {
      const steps = depth ? 4 : 6;
      const points = [start.clone()];
      const d = heading.clone();
      const p = start.clone();
      for (let i = 1; i <= steps; i++) {
        d.x += between(-1, 1) * spec.wander;
        d.z += between(-1, 1) * spec.wander;
        if (depth) d.y += 0.07;
        d.normalize();
        p.addScaledVector(d, length / steps);
        points.push(p.clone());
      }
      const endGirth = girth * (depth >= spec.depth ? 0.3 : 0.62);
      // The trunk flares where it meets the ground.
      limb(points, (t) => (girth + (endGirth - girth) * t) * (depth ? 1 : 1 + 0.9 * Math.exp(-t * 9)), depth ? (depth > 1 ? 5 : 7) : 10, spec.bark);
      if (depth >= spec.depth) {
        tips.push(p.clone());
        return;
      }
      if (depth) mids.push(points[3].clone());
      const forks = depth ? (rand() < 0.4 ? 3 : 2) : spec.forks;
      const turn = rand() * TURN;
      side.set(d.z, 0, -d.x);
      if (side.lengthSq() < 1e-4) side.set(1, 0, 0);
      side.normalize();
      across.crossVectors(d, side);
      const ax = side.clone();
      const bx = across.clone();
      for (let i = 0; i < forks; i++) {
        const angle = turn + (i / forks) * TURN + between(-0.35, 0.35);
        const spread = depth ? between(0.45, 0.8) : i ? between(0.7, 1) : between(0.1, 0.28);
        const next = d
          .clone()
          .multiplyScalar(Math.cos(spread))
          .addScaledVector(ax, Math.cos(angle) * Math.sin(spread))
          .addScaledVector(bx, Math.sin(angle) * Math.sin(spread));
        next.y += 0.12;
        next.normalize();
        const nextLength = depth ? length * between(0.68, 0.82) : spec.limb * S * between(0.85, 1.1);
        const nextGirth = endGirth * (depth || !i ? between(0.82, 0.95) : 0.72);
        grow(p, next, nextLength, nextGirth, depth + 1);
      }
    };
    const startX = between(-0.07, 0.07);
    const startZ = between(-0.07, 0.07);
    grow(new THREE.Vector3(x, foot, z), new THREE.Vector3(startX, 1, startZ).normalize(), spec.trunk * S, spec.girth * S, 0);
    const crown = new THREE.Vector3();
    tips.forEach((t) => crown.add(t));
    crown.multiplyScalar(1 / tips.length);
    tips.forEach((t) => clump(t, spec.clump * S * between(0.85, 1.2), spec.leaves, shades, crown, spec.leaf * S, foot));
    mids.forEach((t) => clump(t, spec.clump * S * 0.8, Math.round(spec.leaves * 0.6), shades, crown, spec.leaf * S, foot));
  };

  const coniferShades = shadesOf(GREENS.conifer);
  const conifer = (x: number, z: number, H: number) => {
    const foot = groundY(x, z) - 0.08;
    const reach = H * 0.25;
    const tip = between(-0.03, 0.03);
    limb(
      [0, 0.5, 1].map((t) => new THREE.Vector3(x + tip * t * H, foot + t * H * 0.96, z)),
      (t) => H * 0.034 * (1 - t) * (1 + 0.6 * Math.exp(-t * 9)) + 0.012,
      7,
      BARK_CONIFER,
    );
    // A dark cone inside, then tiers of drooping sprays, darker near the trunk.
    for (let i = 0; i < conePoints.count; i++) {
      const cx = conePoints.getX(i);
      const cy = conePoints.getY(i) + 0.5;
      const cz = conePoints.getZ(i);
      const hy = H * (0.2 + cy * 0.78);
      const k = 0.7 + 0.3 * cy;
      cores.at.push(x + tip * hy + cx * reach * 0.6, foot + hy, z + cz * reach * 0.6);
      cores.anchor.push(x + tip * hy + cx * reach * 0.6, foot + hy, z + cz * reach * 0.6);
      facing.set(cx, 0.4, cz).normalize();
      cores.facing.push(facing.x, facing.y, facing.z);
      cores.color.push(coniferShades.core.r * k, coniferShades.core.g * k, coniferShades.core.b * k);
    }
    const tiers = Math.round(H * 3);
    for (let k = 0; k < tiers; k++) {
      const t = k / (tiers - 1);
      const y = foot + H * (0.17 + 0.8 * t);
      const r = reach * Math.pow(1 - t, 0.9) + 0.09;
      const boughs = Math.max(4, Math.round(5 + r * 7));
      const turn = rand() * TURN;
      for (let q = 0; q < boughs; q++) {
        const angle = turn + (q / boughs) * TURN + between(-0.25, 0.25);
        const ca = Math.cos(angle);
        const sa = Math.sin(angle);
        const length = r * between(0.78, 1.12);
        const droop = between(0.3, 0.55);
        const sprays = Math.max(2, Math.round(length * 11));
        for (let s = 0; s < sprays; s++) {
          const f = (s + rand()) / sprays;
          const rr = length * f;
          const py = y - droop * rr * (0.5 + 0.7 * f) + between(-0.05, 0.05);
          const fan = between(-1, 1);
          const long = between(0.3, 0.46) * (1 - 0.4 * t) * (H / 11 + 0.5);
          spot.set(x + tip * (py - foot) + ca * rr, py, z + sa * rr);
          lean.set(ca * Math.cos(fan) - sa * Math.sin(fan), -droop * 0.9 - between(0, 0.3), sa * Math.cos(fan) + ca * Math.sin(fan)).normalize();
          facing.set(ca * 0.6, 0.72, sa * 0.6).normalize();
          shade.copy(coniferShades.dark).lerp(coniferShades.light, clamp(f * 0.8 + t * 0.15 + between(-0.18, 0.18), 0, 1));
          leaf(spot, lean, long * 0.7, long, shade, facing, (py - foot) * 0.011, long * 0.08, 1, s % quality.leafEvery === 0);
        }
      }
    }
  };

  const shrub = (x: number, z: number, r: number, greens: Greens, leafSize: number) => {
    const y = groundY(x, z);
    const shades = shadesOf(greens);
    const crown = new THREE.Vector3(x, y + r * 0.25, z);
    const more = 3 + ((rand() * 2) | 0);
    const turn = rand() * 6.28;
    clump(new THREE.Vector3(x, y + r * 0.6, z), r, Math.round(2000 * r * r), shades, crown, leafSize, y, 0.85, 1);
    for (let i = 0; i < more; i++) {
      const angle = turn + (i / more) * 6.28 + between(-0.3, 0.3);
      const rr = r * between(0.5, 0.7);
      clump(new THREE.Vector3(x + Math.cos(angle) * r * 0.62, y + rr * 0.55, z + Math.sin(angle) * r * 0.62), rr, Math.round(2000 * rr * rr), shades, crown, leafSize, y, 0.85, 1);
    }
  };

  TREES.forEach(([x, z, spec]) => tree(x, z, spec));
  CONIFERS.forEach(([x, z, height]) => conifer(x, z, height));
  // Where each shrub's leaves and dark hearts fall in the lists, so that two of them can be put away.
  const shrubParts = SHRUBS.map(([x, z, r, greens, leafSize]) => {
    const leafFrom = leaves.placed.length;
    const coreFrom = cores.at.length;
    shrub(x, z, r, greens, leafSize);
    return { leafFrom, leafTo: leaves.placed.length, coreFrom, coreTo: cores.at.length };
  });

  // Bark: one small painted picture of streaks, wrapped round every limb.
  const barkPicture = document.createElement('canvas');
  barkPicture.width = 128;
  barkPicture.height = 256;
  const pen = barkPicture.getContext('2d');
  if (pen) {
    pen.fillStyle = PAINT.bark;
    pen.fillRect(0, 0, 128, 256);
    for (let i = 0; i < 260; i++) {
      const px = rand() * 128;
      const py = rand() * 256;
      const h = 20 + rand() * 90;
      const w = 1.5 + rand() * 4;
      pen.fillStyle = rand() < 0.62 ? `rgba(${BARK_STREAKS.dark},${0.25 + rand() * 0.35})` : `rgba(${BARK_STREAKS.pale},${0.15 + rand() * 0.25})`;
      // Drawn again off each edge, so the picture joins up with itself where it repeats.
      for (const dx of [-128, 0, 128]) for (const dy of [-256, 0, 256]) pen.fillRect(px + dx, py + dy, w, h);
    }
  }
  const barkTexture = new THREE.CanvasTexture(barkPicture);
  barkTexture.colorSpace = THREE.SRGBColorSpace;
  barkTexture.wrapS = barkTexture.wrapT = THREE.RepeatWrapping;
  const barkShape = new THREE.BufferGeometry();
  barkShape.setAttribute('position', floats(bark.at, 3));
  barkShape.setAttribute('normal', floats(bark.facing, 3));
  barkShape.setAttribute('uv', floats(bark.uv, 2));
  barkShape.setAttribute('color', floats(bark.tint, 3));
  barkShape.setIndex(bark.corners);
  const barkPaint = kit.lambert(PAINT.white, { map: barkTexture, vertexColors: true });
  const barkMesh = kit.mesh(barkShape, barkPaint);
  barkMesh.receiveShadow = true;
  kit.scene.add(barkMesh);

  const coreShape = new THREE.BufferGeometry();
  coreShape.setAttribute('position', floats(cores.at, 3));
  coreShape.setAttribute('normal', floats(cores.facing, 3));
  coreShape.setAttribute('color', floats(cores.color, 3));
  coreShape.setAttribute('aC', floats(cores.anchor, 3));
  const corePaint = kit.lambert(PAINT.white, { vertexColors: true });
  const coreMesh = kit.mesh(coreShape, corePaint);
  coreMesh.receiveShadow = true;
  kit.scene.add(coreMesh);
  // Winter: the clumps of the broadleaf trees shrink away. The same has to happen where shadows
  // are worked out, or a bare tree would still cast a leafy shadow.
  const winterCores = (shader: Shader) => {
    shader.uniforms.uSe = kit.season;
    shader.vertexShader = 'attribute vec3 aC; uniform vec4 uSe;\n' + shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\ntransformed = mix(transformed, aC, uSe.z);');
  };
  corePaint.onBeforeCompile = winterCores;
  coreMesh.customDepthMaterial = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
  coreMesh.customDepthMaterial.onBeforeCompile = winterCores;

  // One leaf: a diamond folded down its middle, four triangles, darker at its stalk.
  const leafShape = new THREE.BufferGeometry();
  leafShape.setAttribute('position', floats([0, 0, 0, 0, 0.5, -0.1, 0, 1, 0, -0.32, 0.42, 0.06, 0.32, 0.42, 0.06], 3));
  leafShape.setAttribute('color', floats([0.7, 0.7, 0.7, 0.95, 0.95, 0.95, 1.1, 1.1, 1.1, 1, 1, 1, 1, 1, 1], 3));
  leafShape.setIndex([0, 1, 3, 3, 1, 2, 0, 4, 1, 1, 4, 2]);
  leafShape.computeVertexNormals();
  leafShape.setAttribute('aN', new THREE.InstancedBufferAttribute(new Float32Array(leaves.facing), 3));
  leafShape.setAttribute('aS', new THREE.InstancedBufferAttribute(new Float32Array(leaves.sway), 3));
  const leafPaint = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
  // Leaves sway more the higher they are, and each one flutters, more as a gust passes.
  kit.sway(
    leafPaint,
    'uniform float uT, uA; attribute vec3 aN; attribute vec3 aS; uniform vec4 uSe;\n',
    [
      // Winter: a leaf that is not evergreen shrinks to nothing.
      ['#include <begin_vertex>', '#include <begin_vertex>\ntransformed *= 1. - uSe.z * (1. - aS.z);'],
      // Autumn turns a leaf red through orange to gold, keeping its light and shade, and a quarter stay partly green.
      // Spring turns about 45% of them to blossom, pink to near white. Winter puts snow on evergreens that face up.
      [
        '#include <color_vertex>',
        '#include <color_vertex>\nvec3 gO = instanceMatrix[3].xyz; float gHs = fract(sin(dot(gO, vec3(12.9898, 78.233, 37.719))) * 43758.5453), gLm = dot(vColor.rgb, vec3(.3, .6, .1)), gDc = 1. - aS.z;\nvColor.rgb = mix(vColor.rgb, mix(vec3(1.5, .2, .07), vec3(1.7, 1.05, .1), gHs) * (gLm * 1.5 + .04), uSe.y * gDc * (.75 + .25 * gHs));\nvColor.rgb = mix(vColor.rgb, mix(vec3(1., .5, .72), vec3(1., .9, .95), gHs) * (.45 + gLm), uSe.x * gDc * step(.55, fract(gHs * 7.3)));\nvColor.rgb = mix(vColor.rgb, vec3(.8, .86, 1.), uSe.z * aS.z * smoothstep(.1, .7, aN.y) * .85);',
      ],
      ['#include <defaultnormal_vertex>', '#include <defaultnormal_vertex>\ntransformedNormal = normalize( normalMatrix * aN + normalize( transformedNormal ) * .3 );'],
    ],
    'vec3 gR = instanceMatrix[3].xyz; float gW = gWind(gR.xz, uT) * uA;\nmvPosition.x += gW * aS.x; mvPosition.z += gW * aS.x * .4;\nmvPosition.xyz += aN * (sin(uT * 5.3 + dot(gR, vec3(7.1, 5.3, 6.7))) * (.35 + .65 * abs(gW)) * min(uA, 1.) * aS.y * position.y);',
  );
  const leafMesh = new THREE.InstancedMesh(leafShape, leafPaint, leaves.placed.length / 16);
  leafMesh.instanceMatrix.array.set(leaves.placed);
  leafMesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(leaves.color), 3);
  leafMesh.castShadow = leafMesh.receiveShadow = true;
  leafMesh.frustumCulled = false;
  kit.scene.add(leafMesh);
  leafMesh.customDepthMaterial = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
  leafMesh.customDepthMaterial.onBeforeCompile = (shader: Shader) => {
    shader.uniforms.uSe = kit.season;
    shader.vertexShader = 'attribute vec3 aS; uniform vec4 uSe;\n' + shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\ntransformed *= 1. - uSe.z * (1. - aS.z);');
  };

  kit.tinted.push(leafPaint, corePaint, barkPaint);

  // The two shrubs right of the house: their leaves and dark hearts collapse to nothing, and what
  // they were is kept, to put back if the house is ever smaller again. A heart's winter anchor
  // goes too, or a shrub that is away would come back as a dark ball when the season turned.
  const kept = GARAGE_SHRUBS.map((i) => {
    const { leafFrom, leafTo, coreFrom, coreTo } = shrubParts[i];
    return { leafFrom, leaves: leaves.placed.slice(leafFrom, leafTo), coreFrom, at: cores.at.slice(coreFrom, coreTo), anchor: cores.anchor.slice(coreFrom, coreTo) };
  });
  let away = false;
  return {
    hideGarageShrubs(hidden: boolean) {
      if (hidden === away) return;
      away = hidden;
      const placed = leafMesh.instanceMatrix.array;
      const at = coreShape.attributes.position.array;
      const anchor = coreShape.attributes.aC.array;
      for (const shrubKept of kept) {
        if (hidden) {
          placed.fill(0, shrubKept.leafFrom, shrubKept.leafFrom + shrubKept.leaves.length);
          at.fill(0, shrubKept.coreFrom, shrubKept.coreFrom + shrubKept.at.length);
          anchor.fill(0, shrubKept.coreFrom, shrubKept.coreFrom + shrubKept.anchor.length);
        } else {
          placed.set(shrubKept.leaves, shrubKept.leafFrom);
          at.set(shrubKept.at, shrubKept.coreFrom);
          anchor.set(shrubKept.anchor, shrubKept.coreFrom);
        }
      }
      leafMesh.instanceMatrix.needsUpdate = true;
      coreShape.attributes.position.needsUpdate = true;
      coreShape.attributes.aC.needsUpdate = true;
    },
  };
}

/**
 * The lawn's blades: tufts of three, standing everywhere but under the house, the pots, the
 * stepping stones and the shrubs. Shorter and thinner along the path, taller and drier outside the
 * garden, and extra tall against fence posts, trunks, shrubs and the house walls. The graphics
 * card bends each blade in the wind and lays it flat round every flower, and under each of the
 * bigger lawn extras that is out.
 */
export function buildGrass(kit: Kit, stones: [number, number][]): void {
  const { rand, between, quality } = kit;

  // One tuft: three blades, each a strip that narrows to a point and leans a little. Dark at the root, light at the tip.
  const at: number[] = [];
  const tone: number[] = [];
  const facing: number[] = [];
  const corners: number[] = [];
  const blades: [number, number, number, number, number][] = [
    [0, 0, 0, 0.3, 0.1],
    [0.055, 0.03, 2.2, 0.24, 0.13],
    [-0.045, 0.05, 4.3, 0.2, 0.16],
  ];
  const rungs: [number, number, number, number][] = [
    [0, 0.021, 0, 0.42],
    [0.5, 0.016, 0.45, 0.8],
    [1, 0, 1, 1.08],
  ];
  for (const [bx, bz, turn, height, leanBy] of blades) {
    const c = Math.cos(turn);
    const s = Math.sin(turn);
    const first = at.length / 3;
    rungs.forEach(([up, halfWidth, along, light], k) => {
      for (const sideOf of k < 2 ? [-1, 1] : [0]) {
        const lx = sideOf * halfWidth;
        const lz = along * leanBy;
        at.push(bx + lx * c + lz * s, up * height, bz - lx * s + lz * c);
        tone.push(light, light, light);
        // Lit as if it faced up, so the lawn shades like the ground it stands on.
        facing.push(s * 0.3, 1, c * 0.3);
      }
    });
    corners.push(first, first + 1, first + 2, first + 1, first + 3, first + 2, first + 2, first + 3, first + 4);
  }
  const tuftShape = new THREE.BufferGeometry();
  tuftShape.setAttribute('position', floats(at, 3));
  tuftShape.setAttribute('color', floats(tone, 3));
  tuftShape.setAttribute('normal', floats(facing, 3));
  tuftShape.setIndex(corners);

  const grassPaint = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
  kit.sway(
    grassPaint,
    'uniform float uT, uA; uniform vec3 uF[16]; uniform vec4 uX[4]; uniform vec4 uSe; uniform vec3 uLawn;\n',
    // A blade brightens a little as a gust passes over it. A mown lawn has light and dark stripes
    // running toward the house. Autumn warms and dries the grass, spring brightens it, winter frosts it.
    [
      [
        '#include <color_vertex>',
        '#include <color_vertex>\nvec3 gR = instanceMatrix[3].xyz; float gH = position.y / .3; float gW = gWind(gR.xz, uT) * uA; vColor.rgb *= 1. + gW * gH * .09; vColor.rgb *= 1. + uLawn.y * .2 * clamp(sin(gR.x * 2.6 + .4) * 6., -1., 1.); vColor.rgb = mix(vColor.rgb, vColor.rgb * vec3(1.45, 1.02, .55), uSe.y * .8); vColor.rgb *= 1. + uSe.x * .1; vColor.rgb = mix(vColor.rgb, vec3(.78, .84, 1.) * (.7 + .3 * gH), uSe.z * .9);',
      ],
    ],
    // Blades right beside a flower lie flat and are back to full height a little further out, so the lawn parts round each flower and follows it when it moves.
    // The same under a picnic, a woodpile, a fire pit or a pond, as each springs in. Their height also follows how the lawn is kept.
    'float gK = 1.; for (int i = 0; i < 16; i++) { vec2 gd = gR.xz - uF[i].xy; gK = min(gK, 1. - uF[i].z * (1. - smoothstep(.01, .12, dot(gd, gd)))); } for (int i = 0; i < 4; i++) { vec2 gd = gR.xz - uX[i].xy; gK = min(gK, 1. - uX[i].w * (1. - smoothstep(uX[i].z * .5, uX[i].z, dot(gd, gd)))); }\nmvPosition.xyz = gR + (mvPosition.xyz - gR) * gK * vec3(1., uLawn.x, 1.);\nfloat gS = length(instanceMatrix[1].xyz) * gH * gH * gK * uLawn.x;\nmvPosition.x += gW * gS * .085 + sin(uT * 4.7 + gR.x * 9. + gR.z * 7.) * .012 * gS * uA; mvPosition.z += gW * gS * .035; mvPosition.y -= abs(gW) * gS * .02;',
  );

  // Where each tuft stands, how tall and wide it is, and its colour, which follows the same blotches as the painted lawn.
  const tufts: [number, number, number, number, number, number, number][] = [];
  const tuft = (x: number, z: number, tall: number, wide: number) => {
    const here = lawn(x, z);
    const c = mix3(mix3([...BLADES.dark], [...BLADES.light], here.light), [...BLADES.dry], here.dry * 0.7);
    const j = between(0.9, 1.1);
    tufts.push([x, z, tall, wide, c[0] * j, c[1] * j, c[2] * j]);
  };
  /** A ring of taller tufts hugging something that stands in the lawn. */
  const hug = (x: number, z: number, r: number, count: number, tall: number) => {
    for (let i = 0; i < count; i++) {
      const a = rand() * TURN;
      const q = r * between(0.9, 1.35);
      tuft(x + Math.cos(a) * q, z + Math.sin(a) * q, tall * between(0.8, 1.25), 1.2);
    }
  };

  for (let i = 0; i < quality.tufts; i++) {
    const x = between(-9, 9);
    const z = between(-8.5, 8);
    const out = lawn(x, z).out;
    if (rand() < out * 0.45) continue;
    // Not under the house, nor on the doorstep.
    if (Math.abs(x) < 1.62 && z > -6.45 && z < -3.98) continue;
    if (Math.abs(x + 0.6) < 0.52 && z > -4.1 && z < -3.62) continue;
    let tall = 1;
    let toStone = 9;
    for (const [sx, sz] of stones) toStone = Math.min(toStone, (x - sx) ** 2 + (z - sz) ** 2);
    if (toStone < 0.1) continue;
    if (toStone < 0.25) tall = 0.6;
    if (z > -4 && z < 4.2 && Math.abs(x - pathX(z)) < 0.4) {
      if (rand() < 0.4) continue;
      tall *= 0.6;
    }
    if (POTS.some(([px, pz]) => (x - px) ** 2 + (z - pz) ** 2 < 0.05) || SHRUBS.some(([bx, bz, r]) => (x - bx) ** 2 + (z - bz) ** 2 < r * r * 0.5)) continue;
    const tallHere = tall * between(0.72, 1.25) * (1 + out * 0.9);
    const wideHere = between(0.9, 1.3) * (1 + out * 0.5) * quality.tuftScale;
    tuft(x, z, tallHere, wideHere);
  }
  FENCE_POSTS.forEach(([x, z]) => hug(x, z, 0.07, 4, 1.5));
  TREES.forEach(([x, z, spec]) => hug(x, z, spec.girth * spec.size + 0.08, 12, 1.5));
  CONIFERS.forEach(([x, z]) => hug(x, z, 0.25, 8, 1.5));
  SHRUBS.forEach(([x, z, r]) => hug(x, z, r * 0.85, 10, 1.3));
  // Along the house walls, leaving the doorway clear.
  for (let i = 0; i < 90; i++) {
    const q = rand() * 4;
    const wx = q < 1 ? -1.56 : q < 2 ? 1.56 : between(-1.56, 1.56);
    const wz = q < 2 ? between(-6.35, -4.05) : q < 3 ? -4.02 : -6.4;
    if (q >= 2 && q < 3 && Math.abs(wx + 0.6) < 0.55) continue;
    const x = wx + between(-0.03, 0.03);
    const z = wz + between(-0.03, 0.03);
    tuft(x, z, between(1.1, 1.6), 1.2);
  }

  const grass = new THREE.InstancedMesh(tuftShape, grassPaint, tufts.length);
  const stand = new THREE.Object3D();
  const color = new THREE.Color();
  tufts.forEach(([x, z, tall, wide, r, g, b], i) => {
    stand.position.set(x, groundY(x, z) - 0.02, z);
    const tipX = between(-0.14, 0.14);
    const turn = rand() * TURN;
    const tipZ = between(-0.14, 0.14);
    stand.rotation.set(tipX, turn, tipZ);
    stand.scale.set(wide, tall, wide);
    stand.updateMatrix();
    grass.setMatrixAt(i, stand.matrix);
    grass.setColorAt(i, color.setRGB(r / 255, g / 255, b / 255, THREE.SRGBColorSpace));
  });
  // Blades take shadows but cast none.
  grass.receiveShadow = true;
  grass.frustumCulled = false;
  kit.scene.add(grass);
  kit.tinted.push(grassPaint);
}

/**
 * A meadow lawn's wildflowers: up to 340 small ones in four colours, standing clear of the path,
 * the idea flowers, the shrubs, the bench, the birdbath and the bigger lawn extras. They sway with the grass, and rise and
 * sink with `lawnStyle.z`. Built straight after the grass, from the same run of made-up numbers.
 */
export function buildMeadow(kit: Kit): THREE.InstancedMesh {
  const { rand, between } = kit;

  // One wildflower: a thin stalk, a head and a yellow middle, each a flat colour.
  const at: number[] = [];
  const facing: number[] = [];
  const tone: number[] = [];
  const parts: [THREE.BufferGeometry, Rgb][] = [
    [new THREE.CylinderGeometry(0.006, 0.008, 1, 4).translate(0, 0.5, 0), [0.2, 0.45, 0.22]],
    [new THREE.IcosahedronGeometry(0.05, 1).scale(1, 1.3, 1).translate(0, 1, 0), [1, 1, 1]],
    [new THREE.IcosahedronGeometry(0.022, 0).scale(1, 1.3, 1).translate(0, 1.07, 0), [1, 0.78, 0.2]],
  ];
  for (const [part, color] of parts) {
    const flat = part.index ? part.toNonIndexed() : part;
    const p = flat.attributes.position;
    const n = flat.attributes.normal;
    for (let i = 0; i < p.count; i++) {
      at.push(p.getX(i), p.getY(i), p.getZ(i));
      facing.push(n.getX(i), n.getY(i), n.getZ(i));
      tone.push(color[0], color[1], color[2]);
    }
  }
  const flowerShape = new THREE.BufferGeometry();
  flowerShape.setAttribute('position', floats(at, 3));
  flowerShape.setAttribute('normal', floats(facing, 3));
  flowerShape.setAttribute('color', floats(tone, 3));

  const flowerPaint = new THREE.MeshLambertMaterial({ vertexColors: true });
  kit.sway(
    flowerPaint,
    'uniform float uT, uA; uniform vec3 uLawn;\n',
    [],
    'vec3 gR = instanceMatrix[3].xyz; mvPosition.xyz = gR + (mvPosition.xyz - gR) * uLawn.z; float gW = gWind(gR.xz, uT) * uA * position.y * position.y * uLawn.z; mvPosition.x += gW * .1; mvPosition.z += gW * .04;',
    true,
  );

  const places = [...SLOTS, ...FRONT.map(([, place]) => place)];
  const extras = Object.values(LAWN_SPOTS);
  const spots: [number, number][] = [];
  for (let i = 0; i < 2600 && spots.length < 340; i++) {
    const x = between(-5.5, 5.5);
    const z = between(-3.9, 6.5);
    if (
      Math.abs(x - pathX(z)) < 0.5 ||
      lawn(x, z).out > 0.6 ||
      places.some(([px, pz]) => (x - px) ** 2 + (z - pz) ** 2 < 0.2) ||
      SHRUBS.some(([bx, bz, r]) => (x - bx) ** 2 + (z - bz) ** 2 < r * r) ||
      (x - BENCH_AT[0]) ** 2 + (z - BENCH_AT[1]) ** 2 < 0.7 ||
      (x - BATH_AT[0]) ** 2 + (z - BATH_AT[1]) ** 2 < 0.3 ||
      extras.some(({ at: [px, pz], flat }) => (x - px) ** 2 + (z - pz) ** 2 < flat + 0.1)
    ) {
      continue;
    }
    spots.push([x, z]);
  }
  const meadow = new THREE.InstancedMesh(flowerShape, flowerPaint, spots.length);
  const stand = new THREE.Object3D();
  const color = new THREE.Color();
  spots.forEach(([x, z], i) => {
    stand.position.set(x, groundY(x, z) - 0.02, z);
    const tipX = between(-0.12, 0.12);
    const turn = rand() * 6.28;
    const tipZ = between(-0.12, 0.12);
    stand.rotation.set(tipX, turn, tipZ);
    const wide = between(0.8, 1.3);
    stand.scale.set(wide, between(0.42, 0.62), wide);
    stand.updateMatrix();
    meadow.setMatrixAt(i, stand.matrix);
    meadow.setColorAt(i, color.set(WILDFLOWERS[i % WILDFLOWERS.length]));
  });
  meadow.frustumCulled = false;
  meadow.visible = false;
  kit.scene.add(meadow);
  kit.tinted.push(flowerPaint);
  return meadow;
}
