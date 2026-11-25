// The place itself: the light, the painted hill, the three wooded hills behind the house, the
// daisy that is the sun, and the little house with its fence, pots and stepping stones. The sky,
// the clouds and the wider valley are in sky.ts.
//
// Ported from the design handoffs (design_handoff_garden_a_v3/garden3d-v3.js is the newest). What
// the house gains as the group's rank rises is in house.ts.

import * as THREE from 'three';

import { clamp, groundY, HILL, HILL_Z, lawn, mix3, pathX, speckle, steppingStones } from './ground';
import type { Kit, Shader } from './kit';
import { HOUSE_PAINTS, HOUSE_TEXTURES, LAWN, PAINT, WORN } from './palette';
import { SKY_PETALS } from './plan';
import { CONIFERS, FENCE_POSTS, POTS, SHRUBS, TREES } from './plants';

/** How far back the house stands. */
export const HOUSE_Z = -5.2;

/** The three hills behind the house, each the top of a ball, as [x, y, z, how big]. */
export const FAR_HILLS: readonly (readonly [number, number, number, number])[] = [
  [-13, -19, -34, 14],
  [12, -23, -38, 17],
  [2, -27, -46, 20],
];

/** Gives every point of a shape a shade that depends on how high it is, for the small far-off trees. */
export function shadeByHeight(shape: THREE.BufferGeometry, at: (y: number) => number): THREE.BufferGeometry {
  const p = shape.attributes.position;
  const c = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) c[i * 3] = c[i * 3 + 1] = c[i * 3 + 2] = at(p.getY(i));
  shape.setAttribute('color', new THREE.BufferAttribute(c, 3));
  return shape;
}

export type Land = ReturnType<typeof buildLand>;

export function buildLand(kit: Kit) {
  const { world, scene, rand, between, lambert, basic, mesh, add, ball } = kit;

  // Light: the sky's own glow, and a sun that casts the shadows. They light the inside of the house too.
  const skyLight = new THREE.HemisphereLight(PAINT.white, PAINT.white, 1.7);
  world.add(skyLight);
  const sun = new THREE.DirectionalLight(PAINT.white, 1.9);
  sun.position.set(6, 12, 8);
  sun.castShadow = true;
  sun.shadow.mapSize.set(kit.quality.shadowMap, kit.quality.shadowMap);
  sun.shadow.radius = 2;
  Object.assign(sun.shadow.camera, { left: -9, right: 9, top: 9, bottom: -9, near: 1, far: 40 });
  sun.shadow.bias = -0.0005;
  sun.shadow.normalBias = 0.04;
  world.add(sun);

  // The plain colour behind everything. The sky's dome covers it, so it only shows if the dome cannot be drawn.
  const sky = new THREE.Color(PAINT.white);
  world.background = sky;
  const haze = new THREE.Fog(PAINT.white, 19, 80);
  world.fog = haze;

  // The lawn is painted once onto a picture laid straight down over the hill: blotchy greens,
  // then the worn path under the stepping stones, then shade under the house, trees and shrubs.
  const REACH = 14;
  const SIZE = 768;
  const picture = document.createElement('canvas');
  picture.width = picture.height = SIZE;
  const pen = picture.getContext('2d');
  if (pen) {
    const image = pen.createImageData(SIZE, SIZE);
    const px = image.data;
    for (let j = 0, o = 0; j < SIZE; j++) {
      for (let i = 0; i < SIZE; i++, o += 4) {
        const here = lawn(((i / SIZE) * 2 - 1) * REACH, ((j / SIZE) * 2 - 1) * REACH);
        const c = mix3(mix3([...LAWN.dark], [...LAWN.light], here.light), [...LAWN.dry], here.dry * 0.6);
        const grain = 0.9 + 0.2 * speckle(i * 0.37, j * 0.91);
        px[o] = c[0] * grain;
        px[o + 1] = c[1] * grain;
        px[o + 2] = c[2] * grain;
        px[o + 3] = 255;
      }
    }
    pen.putImageData(image, 0, 0);
    const toPicture = (v: number) => ((v / REACH) * 0.5 + 0.5) * SIZE;
    const perUnit = SIZE / (2 * REACH);
    const smudge = (x: number, z: number, r: number, rgb: string, strength: number) => {
      const g = pen.createRadialGradient(toPicture(x), toPicture(z), 0, toPicture(x), toPicture(z), r * perUnit);
      g.addColorStop(0, `rgba(${rgb},${strength})`);
      g.addColorStop(0.55, `rgba(${rgb},${strength * 0.7})`);
      g.addColorStop(1, `rgba(${rgb},0)`);
      pen.fillStyle = g;
      pen.fillRect(toPicture(x) - r * perUnit, toPicture(z) - r * perUnit, r * perUnit * 2, r * perUnit * 2);
    };
    for (let z = 5.4; z > -3.95; z -= 0.12) smudge(pathX(z), z, 0.5, WORN.path, 0.1 * clamp((5.4 - z) / 1.6, 0, 1));
    smudge(-0.6, -3.8, 0.55, WORN.path, 0.4);
    // Round the foot of the house: down each side, then along the front and the back.
    for (let i = 0; i < 40; i++) {
      const q = i / 10;
      const f = q % 1;
      smudge(q < 1 ? -1.5 : q < 2 ? 1.5 : -1.5 + f * 3, q < 2 ? -6.3 + f * 2.2 : q < 3 ? -4.1 : -6.3, 0.5, WORN.house, 0.2);
    }
    TREES.forEach(([x, z]) => smudge(x, z, 1.2, WORN.tree, 0.5));
    CONIFERS.forEach(([x, z]) => smudge(x, z, 1.1, WORN.conifer, 0.55));
    SHRUBS.forEach(([x, z, r]) => smudge(x, z, r * 1.7, WORN.shrub, 0.6));
  }
  const lawnTexture = new THREE.CanvasTexture(picture);
  lawnTexture.colorSpace = THREE.SRGBColorSpace;
  lawnTexture.flipY = false;
  lawnTexture.wrapS = lawnTexture.wrapT = THREE.MirroredRepeatWrapping;
  lawnTexture.anisotropy = 8;
  const hillShape = new THREE.SphereGeometry(HILL, 96, 48);
  {
    const at = hillShape.attributes.position;
    const uv = hillShape.attributes.uv;
    for (let i = 0; i < at.count; i++) uv.setXY(i, (at.getX(i) / REACH) * 0.5 + 0.5, ((at.getZ(i) + HILL_Z) / REACH) * 0.5 + 0.5);
  }
  const lawnPaint = lambert(PAINT.white, { map: lawnTexture });
  const hill = mesh(hillShape, lawnPaint, 0, -HILL, HILL_Z, false);
  hill.receiveShadow = true;
  scene.add(hill);
  kit.tinted.push(lawnPaint);
  // The painted ground follows the lawn and the season as the blades do: mowing stripes, a warmer
  // autumn, and snow in winter with the path and the shade still faintly showing through.
  lawnPaint.onBeforeCompile = (shader: Shader) => {
    shader.uniforms.uSe = kit.season;
    shader.uniforms.uLawn = kit.lawnStyle;
    shader.vertexShader = 'varying vec3 gWp;\n' + shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\ngWp = (modelMatrix * vec4(position, 1.)).xyz;');
    shader.fragmentShader =
      'varying vec3 gWp; uniform vec4 uSe; uniform vec3 uLawn;\n' +
      shader.fragmentShader.replace(
        '#include <color_fragment>',
        '#include <color_fragment>\ndiffuseColor.rgb *= 1. + uLawn.y * .13 * clamp(sin(gWp.x * 2.6 + .4) * 6., -1., 1.);\ndiffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(1.4, 1.02, .6), uSe.y * .8);\ndiffuseColor.rgb = mix(diffuseColor.rgb, diffuse * vec3(.74, .8, .95), uSe.z * .92);',
      );
  };

  const farHillPaint = lambert(PAINT.farHill);
  const stemPaint = lambert(PAINT.stem);
  const plantPaint = lambert(PAINT.plant);
  const white = lambert(PAINT.white);

  // Three hills behind the house, wooded with small pointed and round trees, fading into the haze.
  const farTreePaint = new THREE.MeshLambertMaterial({ vertexColors: true });
  kit.tinted.push(farTreePaint);
  const pointed: [number, number, number, number][] = [];
  const round: [number, number, number, number][] = [];
  for (const [hx, hy, hz, r] of FAR_HILLS) {
    add(scene, mesh(ball, farHillPaint, hx, hy, hz, false)).scale.setScalar(r);
    for (let i = 0; i < 430; i++) {
      const up = between(0.5, 1);
      const turn = between(-0.45, 3.6);
      const q = Math.sqrt(1 - up * up);
      const which = rand() < 0.55 ? pointed : round;
      which.push([hx + Math.cos(turn) * q * r, hy + up * r - 0.1, hz + Math.sin(turn) * q * r, between(0.6, 1.15)]);
    }
  }
  const stand = new THREE.Object3D();
  const c1 = new THREE.Color();
  const c2 = new THREE.Color();
  const farWoods: [[number, number, number, number][], THREE.BufferGeometry, readonly [string, string]][] = [
    [pointed, shadeByHeight(new THREE.ConeGeometry(0.42, 1.5, 6).translate(0, 0.75, 0), (y) => 0.55 + (0.5 * y) / 1.5), PAINT.farCone],
    [round, shadeByHeight(new THREE.IcosahedronGeometry(0.6, 1).translate(0, 0.6, 0), (y) => 0.6 + (0.42 * y) / 1.2), PAINT.farBall],
  ];
  for (const [trees, shape, [from, to]] of farWoods) {
    const woods = new THREE.InstancedMesh(shape, farTreePaint, trees.length);
    trees.forEach(([x, y, z, s], i) => {
      stand.position.set(x, y, z);
      stand.rotation.set(0, rand() * 6.28, 0);
      stand.scale.set(s, s * between(0.85, 1.25), s);
      stand.updateMatrix();
      woods.setMatrixAt(i, stand.matrix);
      woods.setColorAt(i, c1.set(from).lerp(c2.set(to), rand()));
    });
    woods.frustumCulled = false;
    scene.add(woods);
  }

  // The sun is a daisy with one petal for each rank a group can reach: the ones earned are filled
  // in and the rest are outlines.
  const skyDaisy = new THREE.Group();
  skyDaisy.position.set(7.15, -2.7, -60);
  skyDaisy.scale.setScalar(0.85);
  scene.add(skyDaisy);
  const skyPetalPaint = basic(PAINT.white, { fog: false, transparent: true });
  const skyCenterPaint = basic(PAINT.center, { fog: false, transparent: true });
  const outline = new THREE.TorusGeometry(1, 0.15, 10, 48);
  const skyPetals = Array.from({ length: SKY_PETALS }, (_, i) => {
    const pivot = new THREE.Group();
    pivot.rotation.z = (-i * Math.PI) / 4;
    const filled = mesh(ball, skyPetalPaint, 0, 3.4, 0, false);
    filled.scale.set(1.25, 2.45, 0.2);
    const empty = mesh(outline, skyPetalPaint, 0, 3.4, 0, false);
    empty.scale.set(1.25, 2.45, 1);
    pivot.add(filled, empty);
    skyDaisy.add(pivot);
    return { filled, empty };
  });
  add(skyDaisy, mesh(ball, skyCenterPaint, 0, 0, 0.2, false)).scale.set(1.95, 1.95, 0.3);

  // The first garden had 130 stars here, placed with 260 of the made-up numbers. The stars are now
  // part of the sky (sky.ts), but the numbers are still spent, so every tree, shrub and blade of
  // grass built after this point is exactly where it always was.
  for (let i = 0; i < 260; i++) rand();

  // The house. Its surfaces are small painted pictures in white and soft grey-violet, so the
  // colours a group chooses tint them: boards on the walls and the gable ends, shingles on the
  // roof, planks on the door and bricks on the chimney.
  const house = new THREE.Group();
  house.position.set(0, groundY(0, HOUSE_Z) - 0.05, HOUSE_Z);
  scene.add(house);
  const wrapped = (width: number, height: number, draw: (pen: CanvasRenderingContext2D, w: number, h: number) => void, repeatX: number, repeatY: number, turn = 0) => {
    const texture = kit.painted(width, height, draw);
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(repeatX, repeatY);
    texture.anisotropy = 8;
    if (turn) texture.rotation = turn;
    return texture;
  };
  const board = (x: CanvasRenderingContext2D, w: number, h: number) => {
    const g = x.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, HOUSE_TEXTURES.board.top);
    g.addColorStop(0.8, HOUSE_TEXTURES.board.mid);
    g.addColorStop(1, HOUSE_TEXTURES.board.foot);
    x.fillStyle = g;
    x.fillRect(0, 0, w, h);
    x.fillStyle = HOUSE_TEXTURES.board.gap;
    x.fillRect(0, h - 5, w, 5);
    for (let i = 0; i < 70; i++) {
      x.fillStyle = HOUSE_TEXTURES.board.flecks[i % 2 ? 0 : 1];
      x.fillRect(Math.random() * w, Math.random() * (h - 8), 2 + Math.random() * 14, 1);
    }
  };
  const grey = (from: number, spread: number) => {
    const v = (from + Math.random() * spread) | 0;
    return `rgb(${v},${v},${v})`;
  };
  // Twelve boards up the wall. The gable ends are the same boards in the roof's colour.
  const wallPaint = lambert(HOUSE_PAINTS.walls[0], { map: wrapped(128, 64, board, 2, 12) });
  const gablePaint = lambert(HOUSE_PAINTS.roof[0], { map: wrapped(128, 64, board, 0.5, 1 / 0.15) });
  // Staggered shingles, four rows to a tile, each a slightly different shade.
  const roofPaint = lambert(HOUSE_PAINTS.roof[0], {
    map: wrapped(
      128,
      128,
      (x, w, h) => {
        for (let r = 0; r < 4; r++) {
          for (let i = -1; i < 4; i++) {
            const px = ((i + (r % 2) * 0.5) * w) / 4;
            x.fillStyle = grey(200, 55);
            x.fillRect(px, (r * h) / 4, w / 4 + 1, h / 4);
            x.fillStyle = HOUSE_TEXTURES.shingle.side;
            x.fillRect(px, (r * h) / 4, 2, h / 4);
          }
        }
        for (let r = 0; r < 4; r++) {
          x.fillStyle = HOUSE_TEXTURES.shingle.row;
          x.fillRect(0, (r * h) / 4, w, 4);
        }
      },
      1,
      1,
      Math.PI / 2,
    ),
  });
  const doorFacePaint = lambert(HOUSE_PAINTS.door[0], {
    map: wrapped(
      64,
      64,
      (x, w, h) => {
        x.fillStyle = PAINT.white;
        x.fillRect(0, 0, w, h);
        const g = x.createLinearGradient(0, 0, w, 0);
        g.addColorStop(0, `rgba(${HOUSE_TEXTURES.door.edge},.4)`);
        g.addColorStop(0.1, `rgba(${HOUSE_TEXTURES.door.edge},0)`);
        g.addColorStop(0.88, `rgba(${HOUSE_TEXTURES.door.edge},0)`);
        g.addColorStop(1, `rgba(${HOUSE_TEXTURES.door.edge},.28)`);
        x.fillStyle = g;
        x.fillRect(0, 0, w, h);
        for (let i = 0; i < 24; i++) {
          x.fillStyle = HOUSE_TEXTURES.door.grain;
          x.fillRect(5 + Math.random() * (w - 10), Math.random() * h, 1, 8 + Math.random() * 28);
        }
      },
      1 / 0.155,
      1.3,
    ),
  });
  const brick = wrapped(
    64,
    64,
    (x, w, h) => {
      for (let r = 0; r < 4; r++) {
        for (let i = -1; i < 2; i++) {
          const px = ((i + (r % 2) * 0.5) * w) / 2;
          x.fillStyle = grey(212, 43);
          x.fillRect(px, (r * h) / 4, w / 2 + 1, h / 4);
          x.fillStyle = HOUSE_TEXTURES.brick.mortar;
          x.fillRect(px, (r * h) / 4, 3, h / 4);
          x.fillRect(px, (r * h) / 4, w / 2 + 1, 3);
        }
      }
    },
    2,
    4,
  );

  // The roof, the attic window and the chimney are one group, so a second story can lift them.
  const top = new THREE.Group();
  house.add(top);
  house.add(mesh(new THREE.BoxGeometry(3, 1.8, 2.2), wallPaint, 0, 0.9, 0));
  const gable = new THREE.Shape();
  gable.moveTo(-1.8, 0);
  gable.lineTo(1.8, 0);
  gable.lineTo(0, 1.35);
  gable.closePath();
  // The two ends take the gable's boards and the slopes take the shingles.
  top.add(mesh(new THREE.ExtrudeGeometry(gable, { depth: 2.6, bevelEnabled: false }), [gablePaint, roofPaint], 0, 1.8, -1.3));
  // A layer of snow that rises onto the roof in winter.
  const roofSnow = mesh(new THREE.ExtrudeGeometry(gable, { depth: 2.5, bevelEnabled: false }), lambert(PAINT.white), 0, 1.84, -1.25);
  roofSnow.visible = false;
  top.add(roofSnow);

  const doorPaint = lambert(HOUSE_PAINTS.door[0]);
  const trimPaint = lambert(PAINT.trim);
  const panePaint = basic(PAINT.white);
  // The door is one arched piece on a hinge at its left edge, with warm light in the doorway behind it.
  const door = new THREE.Group();
  door.position.set(-0.91, 0, 1.11);
  house.add(door);
  {
    const slab = new THREE.Shape();
    slab.moveTo(0, 0);
    slab.lineTo(0.62, 0);
    slab.lineTo(0.62, 1.0);
    slab.absarc(0.31, 1.0, 0.31, 0, Math.PI, false);
    slab.lineTo(0, 0);
    door.add(mesh(new THREE.ExtrudeGeometry(slab, { depth: 0.08, bevelEnabled: false, curveSegments: 14 }), [doorFacePaint, doorPaint], 0, 0, -0.04));
  }
  const doorwayPaint = basic(HOUSE_TEXTURES.doorway);
  house.add(mesh(new THREE.PlaneGeometry(0.6, 1.0), doorwayPaint, -0.6, 0.5, 1.104, false));
  house.add(mesh(new THREE.CircleGeometry(0.3, 24), doorwayPaint, -0.6, 1.0, 1.104, false));
  for (const y of [0.24, 0.8]) door.add(mesh(new THREE.BoxGeometry(0.3, 0.035, 0.02), trimPaint, 0.16, y, 0.05, false));
  door.add(mesh(new THREE.SphereGeometry(0.045, 10, 8), lambert(PAINT.knob), 0.49, 0.55, 0.06));
  // The door is small on a screen, so a tap anywhere in this unseen box round it counts.
  const doorHit = new THREE.Mesh(new THREE.BoxGeometry(1.05, 1.7, 0.5), new THREE.MeshBasicMaterial({ visible: false }));
  doorHit.position.set(-0.6, 0.8, 1.25);
  house.add(doorHit);
  const stonePaint = lambert(PAINT.stone);
  house.add(mesh(new THREE.BoxGeometry(0.9, 0.12, 0.4), stonePaint, -0.6, 0.06, 1.32));
  // The window: its pane, the trim round it and across it, and a window box of small plants.
  house.add(mesh(new THREE.BoxGeometry(0.74, 0.62, 0.06), panePaint, 0.72, 1.05, 1.11, false));
  for (const y of [1.39, 0.71]) house.add(mesh(new THREE.BoxGeometry(0.84, 0.07, 0.1), trimPaint, 0.72, y, 1.12));
  for (const [x, wide] of [
    [0.33, 0.07],
    [1.11, 0.07],
    [0.72, 0.04],
  ]) {
    house.add(mesh(new THREE.BoxGeometry(wide, 0.68, 0.1), trimPaint, x, 1.05, 1.12));
  }
  house.add(mesh(new THREE.BoxGeometry(0.74, 0.04, 0.1), trimPaint, 0.72, 1.05, 1.12));
  house.add(mesh(new THREE.BoxGeometry(0.9, 0.17, 0.22), lambert(PAINT.pot), 0.72, 0.58, 1.2));
  [0.42, 0.62, 0.82, 1.02].forEach((x, i) => add(house, mesh(ball, plantPaint, x, 0.7, 1.22)).scale.setScalar(0.1 + (i % 2) * 0.02));
  // The round attic window, which finished flowers fly into. Its pane hangs on a hinge at its
  // left edge, so it can swing open (see toys.ts).
  const atticHinge = new THREE.Group();
  atticHinge.position.set(-0.3, 2.3, 1.31);
  top.add(atticHinge);
  const atticPane = mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.06, 28).rotateX(Math.PI / 2), panePaint, 0.3, 0, 0, false);
  atticHinge.add(atticPane);
  top.add(mesh(new THREE.TorusGeometry(0.3, 0.05, 8, 32), white, 0, 2.3, 1.33));
  top.add(mesh(new THREE.BoxGeometry(0.42, 0.95, 0.42), lambert(PAINT.chimney, { map: brick }), -0.95, 2.55, -0.2));
  top.add(mesh(new THREE.BoxGeometry(0.54, 0.1, 0.54), white, -0.95, 3.06, -0.2));
  const windowLight = new THREE.PointLight(PAINT.glow, 0, 11, 1.4);
  windowLight.position.set(0, 1.5, 2.4);
  house.add(windowLight);
  const atticAt = new THREE.Vector3(0, house.position.y + 2.3, HOUSE_Z + 1.45);
  const chimneyAt = new THREE.Vector3(-0.95, house.position.y + 3.15, HOUSE_Z - 0.2);
  const smoke = Array.from({ length: 6 }, () => {
    const paint = lambert(PAINT.white, { transparent: true });
    const puff = mesh(ball, paint, 0, 0, 0, false);
    scene.add(puff);
    return { puff, paint };
  });

  // Two pots by the door, a white picket fence either side of the house, and the stepping stones.
  // The pots are one group, so they can be lifted onto a lanai's deck, and each side of the fence
  // is one, so the right-hand side can make way for a garage.
  const potPaint = lambert(PAINT.pot);
  const bloomPaint = lambert(PAINT.chimney);
  const potShape = new THREE.CylinderGeometry(0.2, 0.15, 0.3, 14);
  const pots = new THREE.Group();
  scene.add(pots);
  for (const [x, z] of POTS) {
    const y = groundY(x, z);
    pots.add(mesh(potShape, potPaint, x, y + 0.15, z));
    add(pots, mesh(ball, plantPaint, x, y + 0.44, z)).scale.setScalar(0.25);
    for (const [dx, dy, dz] of [
      [0.12, 0.1, 0.14],
      [-0.14, 0.16, 0.1],
      [0, 0.24, -0.02],
    ]) {
      add(pots, mesh(ball, bloomPaint, x + dx, y + 0.44 + dy, z + dz)).scale.setScalar(0.06);
    }
  }
  const postShape = new THREE.BoxGeometry(0.09, 0.5, 0.06);
  const railShape = new THREE.BoxGeometry(1.8, 0.06, 0.04);
  const [fenceLeft, fenceRight] = [-1, 1].map((side) => {
    const fence = new THREE.Group();
    scene.add(fence);
    for (const [x, z] of FENCE_POSTS) if (Math.sign(x) === side) fence.add(mesh(postShape, white, x, groundY(x, z) + 0.25, z));
    const x = side * 2.79;
    fence.add(mesh(railShape, white, x, groundY(x, -4.75) + 0.36, -4.74));
    return fence;
  });
  const stoneShape = new THREE.CylinderGeometry(0.3, 0.3, 0.06, 16);
  const stones = steppingStones();
  stones.forEach(([x, z], i) => {
    const stone = mesh(stoneShape, stonePaint, x, groundY(x, z) + 0.03, z, false);
    stone.scale.z = 0.8;
    stone.rotation.y = i * 1.3;
    stone.receiveShadow = true;
    scene.add(stone);
  });

  return {
    skyLight,
    sun,
    sky,
    haze,
    farHillPaint,
    farTreePaint,
    stemPaint,
    plantPaint,
    white,
    trimPaint,
    stonePaint,
    skyDaisy,
    skyPetalPaint,
    skyCenterPaint,
    panePaint,
    atticPane,
    atticHinge,
    windowLight,
    /** The house's paint, which follows the colours the group chose. The gable follows the roof and the door's face follows the door. */
    wallPaint,
    roofPaint,
    gablePaint,
    doorPaint,
    doorFacePaint,
    roofSnow,
    /** The house itself, the group that holds its roof, attic window and chimney, the two pots by the door, and each side of the fence. */
    house,
    top,
    pots,
    fenceLeft,
    fenceRight,
    /** The door on its hinge, and the unseen box round it that a tap lands on. */
    door,
    doorHit,
    /** Where the camera stands to go in at the door, and what it looks at from there. */
    doorFrom: new THREE.Vector3(-0.6, house.position.y + 1.06, HOUSE_Z + 2.7),
    doorLook: new THREE.Vector3(-0.6, house.position.y + 0.86, HOUSE_Z + 1.1),
    /** Where a finished flower flies to, and where the smoke rises from. */
    atticAt,
    chimneyAt,
    smoke,
    stones,
    /** Fill in the petals the group has earned on the daisy in the sky. */
    setEarned(earned: number) {
      skyPetals.forEach((petal, i) => {
        petal.filled.visible = i < earned;
        petal.empty.visible = i >= earned;
      });
    },
  };
}
