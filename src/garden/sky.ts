// The wider world round the hilltop: a dome of sky that blends from the haze on the horizon up to
// overhead, stars in every direction, a shooting star at night, a ring of soft clouds, and a broad
// valley with wooded hills on every side, so the garden sits in a landscape whichever way it is turned.
//
// Ported from the design handoff (design_handoff_garden_a_v2/garden3d-v2.js). Everything here takes
// its made-up numbers from a run of its own, so nothing in the garden itself moves because of it.

import * as THREE from 'three';

import { blotches, clamp, HILL_Z, seeded } from './ground';
import type { Kit } from './kit';
import { shadeByHeight, type Land } from './land';
import { PAINT, SKY, STARS, type TimeOfDay } from './palette';

/** How far below the hilltop the valley floor lies. */
const VALLEY_Y = -4.6;
/** How often a shooting star crosses, and how long it lasts, in seconds. */
const SHOOTS_EVERY = 7;
const SHOOT_LASTS = 0.9;

/** Hills right round the horizon, as [which way in degrees, how far, how big, how high it rises]. */
const HILLS: [number, number, number, number][] = [
  [48, 40, 15, 4.5],
  [-50, 42, 16, 5],
  [80, 38, 14, 4],
  [-78, 40, 15, 4.5],
  [110, 42, 16, 5],
  [-108, 40, 14, 4],
  [142, 44, 17, 5],
  [-140, 42, 15, 4.5],
  [180, 46, 18, 5],
];

const chance = (a: number, b: number) => a + Math.random() * (b - a);

export type SkyParts = ReturnType<typeof buildSky>;

export function buildSky(kit: Kit, land: Land, time: TimeOfDay) {
  const { scene, mesh, add, ball } = kit;
  const rand = seeded(4242);
  const between = (a: number, b: number) => a + rand() * (b - a);
  const v1 = new THREE.Vector3();
  const v2 = new THREE.Vector3();
  const along = new THREE.Vector3();
  const up = new THREE.Vector3();
  const basis = new THREE.Matrix4();
  const tmp = new THREE.Color();
  const first = SKY[time];
  const tint = (color: string) => ({ value: new THREE.Color(color) });

  // The dome. It is centred on the camera every frame, so it is always all round.
  const uniforms = {
    c0: tint(first.haze),
    c1: tint(first.low),
    c2: tint(first.mid),
    c3: tint(first.zenith),
    glowC: tint(first.glow),
    glowK: { value: first.glowStrength },
    wispK: { value: first.wisps },
    night: { value: 0 },
    sunDir: { value: new THREE.Vector3(0, 0, -1) },
    uT: kit.time,
  };
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(300, 40, 24),
    new THREE.ShaderMaterial({
      uniforms,
      side: THREE.BackSide,
      depthWrite: false,
      vertexShader: `varying vec3 vD;
void main() { vD = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`,
      // The colours by height, a glow round the daisy and along the horizon under it, faint high
      // wisps, and at night one broad, smooth, faint band of light that crosses the view on a
      // diagonal. Last, a very fine grain, so a dark sky's slow change of colour does not show as bands.
      fragmentShader: `uniform vec3 c0, c1, c2, c3, glowC, sunDir; uniform float glowK, wispK, night, uT; varying vec3 vD;
float h21(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float ns(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f); return mix(mix(h21(i), h21(i + vec2(1., 0.)), f.x), mix(h21(i + vec2(0., 1.)), h21(i + vec2(1., 1.)), f.x), f.y); }
float fbm(vec2 p) { return ns(p) * .5 + ns(p * 2.1 + 3.7) * .3 + ns(p * 4.3 + 1.3) * .2; }
void main() {
  vec3 d = normalize(vD); float h = d.y;
  vec3 col = mix(c0, c1, smoothstep(-.21, -.15, h)); col = mix(col, c2, smoothstep(-.12, .14, h)); col = mix(col, c3, smoothstep(.12, .62, h));
  float sd = max(dot(d, sunDir), 0.);
  col += glowC * (pow(sd, 300.) * .45 + pow(sd, 40.) * .2) * glowK;
  col += glowC * pow(sd, 6.) * (1. - smoothstep(-.2, .02, h)) * .3 * glowK;
  float w = fbm(d.xz * (3.2 / (h + .45)) + vec2(uT * .006, 0.)); w = smoothstep(.5, .8, w) * smoothstep(-.17, -.02, h) * (1. - smoothstep(.3, .7, h));
  col = mix(col, col + glowC * .35 + .08, w * wispK);
  float m = dot(d, normalize(vec3(.45, .85, .1))) * 3.; col += vec3(.034, .03, .075) * exp(-m * m) * night;
  gl_FragColor = vec4(col, 1.);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  gl_FragColor.rgb += (h21(gl_FragCoord.xy) - .5) / 150.;
}`,
    }),
  );
  dome.renderOrder = -10;
  dome.frustumCulled = false;
  scene.add(dome);

  // Stars: about six thousand in three sizes, fixed to the dome so they are there whichever way
  // the view is turned, and a little thicker along that same diagonal band.
  const band = new THREE.Vector3(0.45, 0.85, 0.1).normalize();
  const starPaints = STARS.map(([color, size, count]) => {
    const at = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      let kept = false;
      while (!kept) {
        v1.set(between(-1, 1), between(-0.35, 1), between(-1, 1));
        const far = v1.lengthSq();
        if (far > 1 || far < 0.05) continue;
        v1.normalize();
        kept = rand() < 0.5 + 0.5 * Math.exp(-((v1.dot(band) * 2.4) ** 2));
      }
      at[i * 3] = v1.x * 280;
      at[i * 3 + 1] = v1.y * 280;
      at[i * 3 + 2] = v1.z * 280;
    }
    const shape = new THREE.BufferGeometry();
    shape.setAttribute('position', new THREE.BufferAttribute(at, 3));
    const paint = new THREE.PointsMaterial({ color, size, sizeAttenuation: false, transparent: true, opacity: 0, fog: false, depthWrite: false });
    const points = new THREE.Points(shape, paint);
    points.frustumCulled = false;
    dome.add(points);
    return paint;
  });

  // Clouds. Each is a heap of soft lumpy puffs, bigger along a flat base and smaller toward a domed
  // top, and twenty of them ring the whole sky.
  const puffPicture = kit.painted(128, 128, (x) => {
    for (let i = 0; i < 30; i++) {
      const a = rand() * 6.283;
      const far = Math.sqrt(rand()) * 36;
      const px = 64 + Math.cos(a) * far;
      const py = 64 + Math.sin(a) * far;
      const r = between(11, 24);
      const g = x.createRadialGradient(px, py, 0, px, py, r);
      g.addColorStop(0, 'rgba(255,255,255,.5)');
      g.addColorStop(0.55, 'rgba(255,255,255,.22)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      x.fillStyle = g;
      x.fillRect(0, 0, 128, 128);
    }
  });
  puffPicture.colorSpace = THREE.NoColorSpace;
  const puffs = { at: [] as number[], height: [] as number[], size: [] as number[] };
  for (let i = 0; i < 20; i++) {
    const bearing = (i / 20) * 6.283 + between(-0.12, 0.12);
    const far = between(72, 96);
    const wide = between(9, 17);
    const tall = wide * between(0.28, 0.42);
    const cx = Math.sin(bearing) * far;
    const cz = HILL_Z - Math.cos(bearing) * far;
    const degrees = ((bearing * 57.2958 + 540) % 360) - 180;
    // Clouds rise gradually toward the bearing of the daisy in the sky, so none sits behind it and
    // hides its petals, and there is no hard edge between low cloud and high.
    const lift = Math.exp(-(((degrees - 7) / 24) ** 2));
    const low = between(-7, 9);
    const high = between(8, 10.5);
    const base = low * (1 - lift) + high * lift;
    const heap: number[][] = [];
    for (let j = 0; j < 46; j++) {
      const u = between(-1, 1);
      const top = tall * Math.pow(1 - u * u, 0.7) * between(0.55, 1);
      const hy = Math.pow(rand(), 1.2);
      const size = (0.3 + 0.5 * (1 - hy) * (1 - Math.abs(u) * 0.6)) * tall * 1.9;
      const across = u * wide * 0.5;
      const deep = between(-1.6, 1.6);
      heap.push([cx + Math.cos(bearing) * across + Math.sin(bearing) * deep, base + Math.max(hy * top, size * 0.28), cz + Math.sin(bearing) * across - Math.cos(bearing) * deep, (hy * top) / tall, size, deep]);
    }
    heap
      .sort((a, b) => b[5] - a[5])
      .forEach((q) => {
        puffs.at.push(q[0], q[1], q[2]);
        puffs.height.push(q[3]);
        puffs.size.push(q[4]);
      });
  }
  const cloudUniforms = { map: { value: puffPicture }, cT: tint(first.cloudTop), cB: tint(first.cloudBase), op: { value: first.cloudOpacity } };
  // Each puff is a flat square that faces the camera, not a dot: a dot vanishes whole when its
  // middle leaves the screen, and some phones cap how big one can be.
  const cloudShape = new THREE.InstancedBufferGeometry();
  cloudShape.setAttribute('position', new THREE.Float32BufferAttribute([-0.5, -0.5, 0, 0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 0], 3));
  cloudShape.setIndex([0, 1, 2, 0, 2, 3]);
  cloudShape.setAttribute('aC', new THREE.InstancedBufferAttribute(new Float32Array(puffs.at), 3));
  cloudShape.setAttribute('aH', new THREE.InstancedBufferAttribute(new Float32Array(puffs.height), 1));
  cloudShape.setAttribute('aS', new THREE.InstancedBufferAttribute(new Float32Array(puffs.size), 1));
  cloudShape.instanceCount = puffs.height.length;
  const clouds = new THREE.Mesh(
    cloudShape,
    new THREE.ShaderMaterial({
      uniforms: cloudUniforms,
      transparent: true,
      depthWrite: false,
      vertexShader: `attribute vec3 aC; attribute float aH, aS; varying float vH; varying vec2 vUv;
void main() { vH = aH; vUv = position.xy + .5; vec4 mv = modelViewMatrix * vec4(aC, 1.); mv.xy += position.xy * aS; gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `uniform sampler2D map; uniform vec3 cT, cB; uniform float op; varying float vH; varying vec2 vUv;
void main() {
  float a = smoothstep(.1, .6, texture2D(map, vUv).a); vec3 col = mix(cB, cT, smoothstep(-.25, .45, vH * 1.6 + (vUv.y - .5) * .9));
  gl_FragColor = vec4(col, a * op);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`,
    }),
  );
  clouds.frustumCulled = false;
  scene.add(clouds);

  // The shooting star: a short streak, white at its head and fading through lilac to nothing at
  // its tail. It is drawn on the dome, so hills and clouds pass in front of it.
  const streak = kit.painted(128, 16, (x) => {
    const g = x.createLinearGradient(0, 0, 128, 0);
    g.addColorStop(0, 'rgba(190,170,255,0)');
    g.addColorStop(0.7, 'rgba(220,210,255,.45)');
    g.addColorStop(1, 'rgba(255,255,255,1)');
    x.fillStyle = g;
    x.fillRect(0, 0, 128, 16);
    const v = x.createLinearGradient(0, 0, 0, 16);
    v.addColorStop(0, 'rgba(0,0,0,1)');
    v.addColorStop(0.5, 'rgba(0,0,0,0)');
    v.addColorStop(1, 'rgba(0,0,0,1)');
    x.globalCompositeOperation = 'destination-out';
    x.fillStyle = v;
    x.fillRect(0, 0, 128, 16);
  });
  streak.colorSpace = THREE.NoColorSpace;
  const shootPaint = new THREE.MeshBasicMaterial({ map: streak, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, side: THREE.DoubleSide });
  const shoot = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), shootPaint);
  shoot.visible = false;
  shoot.frustumCulled = false;
  dome.add(shoot);
  const shootFrom = new THREE.Vector3();
  const shootTo = new THREE.Vector3();
  let sinceShoot = 4;
  /** How far along its path the shooting star is, from 0 to 1. Below 0 there is none. */
  let shooting = -1;

  // The valley: a very large, gently rolling ground below the hilltop, mottled into lighter meadow
  // and darker ground. It takes the far hills' colour, so it follows the time of day and the season.
  const valleyPaint = new THREE.MeshLambertMaterial({ vertexColors: true });
  const relief = (x: number, z: number) => (blotches(x * 0.05 + 9.1, z * 0.05 + 4.3) - 0.5) * 3.4 * clamp((Math.hypot(x, z - HILL_Z) - 15) / 22, 0, 1);
  const valleyY = (x: number, z: number) => Math.sqrt(Math.max(0, 22500 - x * x - (z - HILL_Z) * (z - HILL_Z))) - 150 + VALLEY_Y + relief(x, z);
  {
    const shape = new THREE.SphereGeometry(150, 128, 36, 0, Math.PI * 2, 0, 0.52);
    const p = shape.attributes.position;
    const c = new Float32Array(p.count * 3);
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i);
      const z = p.getZ(i) + HILL_Z;
      const light = 0.8 + 0.42 * blotches(x * 0.09 + 2.2, z * 0.09 + 7.5);
      p.setY(i, p.getY(i) + relief(x, z));
      c[i * 3] = light * 0.96;
      c[i * 3 + 1] = light;
      c[i * 3 + 2] = light * 0.9;
    }
    shape.setAttribute('color', new THREE.BufferAttribute(c, 3));
    shape.computeVertexNormals();
    const valley = new THREE.Mesh(shape, valleyPaint);
    valley.position.set(0, VALLEY_Y - 150, HILL_Z);
    scene.add(valley);
  }

  // More wooded hills right round the horizon, and trees scattered in clumps across the valley
  // floor, larger near the hill and smaller with distance.
  {
    const pointed: [number, number, number, number][] = [];
    const round: [number, number, number, number][] = [];
    for (const [degrees, far, r, rise] of HILLS) {
      const bearing = (degrees * Math.PI) / 180;
      const hx = Math.sin(bearing) * far;
      const hz = HILL_Z - Math.cos(bearing) * far;
      const hy = valleyY(hx, hz) + rise - r;
      const facing = Math.atan2(Math.cos(bearing), -Math.sin(bearing));
      add(scene, mesh(ball, land.farHillPaint, hx, hy, hz, false)).scale.setScalar(r);
      for (let i = 0; i < 230; i++) {
        const uy = between(0.45, 1);
        const turn = facing + between(-2.1, 2.1);
        const q = Math.sqrt(1 - uy * uy);
        const which = rand() < 0.55 ? pointed : round;
        which.push([hx + Math.cos(turn) * q * r, hy + uy * r - 0.1, hz + Math.sin(turn) * q * r, between(0.6, 1.15)]);
      }
    }
    for (let i = 0; i < 1100; i++) {
      const a = rand() * 6.283;
      const d = 13 + Math.pow(rand(), 1.5) * 34;
      const x = Math.sin(a) * d;
      const z = HILL_Z - Math.cos(a) * d;
      const s = 3.1 - 1.7 * clamp((d - 13) / 30, 0, 1);
      if (blotches(x * 0.11 + 1.7, z * 0.11 + 8.8) < 0.47) continue;
      const which = rand() < 0.5 ? pointed : round;
      which.push([x, valleyY(x, z) - 0.15, z, s * between(0.7, 1.2)]);
    }
    const stand = new THREE.Object3D();
    const c1 = new THREE.Color();
    const c2 = new THREE.Color();
    const woods: [[number, number, number, number][], THREE.BufferGeometry, readonly [string, string]][] = [
      [pointed, shadeByHeight(new THREE.ConeGeometry(0.42, 1.5, 6).translate(0, 0.75, 0), (y) => 0.55 + (0.5 * y) / 1.5), PAINT.farCone],
      [round, shadeByHeight(new THREE.IcosahedronGeometry(0.6, 1).translate(0, 0.6, 0), (y) => 0.6 + (0.42 * y) / 1.2), PAINT.farBall],
    ];
    for (const [trees, shape, [from, to]] of woods) {
      const wood = new THREE.InstancedMesh(shape, land.farTreePaint, trees.length);
      trees.forEach(([x, y, z, s], i) => {
        stand.position.set(x, y, z);
        stand.rotation.set(0, rand() * 6.28, 0);
        stand.scale.set(s, s * between(0.85, 1.25), s);
        stand.updateMatrix();
        wood.setMatrixAt(i, stand.matrix);
        wood.setColorAt(i, c1.set(from).lerp(c2.set(to), rand()));
      });
      wood.frustumCulled = false;
      scene.add(wood);
    }
  }

  return {
    valleyPaint,
    /** Blend the sky toward a time of day. `k` is how far to go this frame, and `night` is how much of the night is out. */
    tint(time: TimeOfDay, k: number, dt: number, t: number, still: boolean, night: number) {
      const want = SKY[time];
      const rate = 1 - Math.exp(-2.2 * dt);
      uniforms.c0.value.lerp(tmp.set(want.haze), k);
      uniforms.c1.value.lerp(tmp.set(want.low), k);
      uniforms.c2.value.lerp(tmp.set(want.mid), k);
      uniforms.c3.value.lerp(tmp.set(want.zenith), k);
      uniforms.glowC.value.lerp(tmp.set(want.glow), k);
      uniforms.glowK.value += (want.glowStrength - uniforms.glowK.value) * rate;
      uniforms.wispK.value += (want.wisps - uniforms.wispK.value) * rate;
      uniforms.night.value = night;
      cloudUniforms.cT.value.lerp(tmp.set(want.cloudTop), k);
      cloudUniforms.cB.value.lerp(tmp.set(want.cloudBase), k);
      cloudUniforms.op.value += (want.cloudOpacity - cloudUniforms.op.value) * rate;
      starPaints.forEach((paint, i) => {
        // Stars twinkle a little, each size in its own time.
        paint.opacity = night * (still ? 1 : 0.8 + 0.2 * Math.sin(t * (1.3 + i * 0.9) + i * 2));
        paint.visible = night > 0.02;
      });
      // Clouds sway slowly in place, about three degrees either way, and never cross the sky:
      // one that drifted behind the daisy would hide its petals.
      clouds.rotation.y = still ? 0 : Math.sin(t * 0.03) * 0.055;
    },
    /**
     * Keep the dome round the camera, once the camera has moved for this frame, and run the
     * shooting star. `stars` is false when none should cross: a still garden, or inside the house.
     */
    follow(camera: THREE.Camera, sunAt: THREE.Vector3, dt: number, night: number, stars: boolean) {
      dome.position.copy(camera.position);
      uniforms.sunDir.value.copy(sunAt).sub(camera.position).normalize();
      sinceShoot += dt;
      if (shooting < 0 && sinceShoot >= SHOOTS_EVERY && night > 0.6 && stars) {
        // It starts in the part of the sky being looked at, a little above the horizon, and falls to one side.
        sinceShoot = 0;
        shooting = 0;
        camera.getWorldDirection(v1);
        const bearing = Math.atan2(v1.x, -v1.z) + chance(-0.15, 0.15);
        const height = chance(-0.02, 0.1);
        const bearingTo = bearing + (Math.random() < 0.5 ? -1 : 1) * chance(0.1, 0.17);
        const heightTo = height - chance(0.06, 0.1);
        shootFrom.set(Math.sin(bearing) * Math.cos(height), Math.sin(height), -Math.cos(bearing) * Math.cos(height));
        shootTo.set(Math.sin(bearingTo) * Math.cos(heightTo), Math.sin(heightTo), -Math.cos(bearingTo) * Math.cos(heightTo));
      }
      if (shooting >= 0) {
        shooting += dt / SHOOT_LASTS;
        const p = Math.min(1, shooting);
        const eased = 1 - (1 - p) * (1 - p);
        // The head, and the tail about a third of the path behind it.
        v1.lerpVectors(shootFrom, shootTo, eased).normalize();
        v2.lerpVectors(shootFrom, shootTo, Math.max(0, eased - 0.32)).normalize();
        const length = v1.distanceTo(v2) * 270;
        along.subVectors(v1, v2).normalize();
        shoot.position.addVectors(v1, v2).multiplyScalar(135);
        v2.copy(shoot.position).normalize().negate();
        basis.makeBasis(along, up.crossVectors(v2, along), v2);
        shoot.quaternion.setFromRotationMatrix(basis);
        shoot.scale.set(Math.max(0.01, length), 1.7, 1);
        shootPaint.opacity = Math.sin(Math.PI * p) * 0.95;
        shoot.visible = true;
        if (shooting >= 1) {
          shooting = -1;
          shoot.visible = false;
        }
      }
    },
  };
}
