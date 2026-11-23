// SomeDaisy 3D garden scene. House, flowers and sky use flat token colors; lawn, trees and shrubs are procedural (instanced blades and leaves, painted canvas textures).
import * as THREE from 'three';

const LC = { Movies: '#7B3FE4', Places: '#2F7BE8', Food: '#E0489E', 'Day trips': '#1FA98A' };
const MC = ['#CFE3FF', '#FFD9C7', '#F7C9EA'], INK = '#2C2040', CEN = '#FFD25A';
const R = 16, CZ = -1;
const gy = (x, z) => Math.sqrt(Math.max(0, R * R - x * x - (z - CZ) * (z - CZ))) - R;
const pathX = z => .4 * Math.sin(z * .8) - .5 * Math.min(1, Math.max(0, (-z - 1) / 3));
const damp = (a, b, l, dt) => a + (b - a) * (1 - Math.exp(-l * dt));
const rnd = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
let sd = 7; const sr = () => { sd = (sd * 16807) % 2147483647; return sd / 2147483647; };

const TH = {
  Day: { sky: '#CFE3FF', fol: '#FFFFFF', haze: '#D9DEFF', hemiS: '#FFFFFF', hemiG: '#E6D2FF', hemi: 1.7, sunC: '#FFFFFF', sun: 1.9, pane: '#CFE3FF', sunPet: '#FFFFFF', sunY: -2.7, night: 0, stem: '#17523A', win: 0 },
  Dusk: { sky: '#FFD9C7', fol: '#F3CDBB', haze: '#FBD3D0', hemiS: '#FFFFFF', hemiG: '#F7C9EA', hemi: 1.6, sunC: '#FFFFFF', sun: 1.7, pane: '#FFE08A', sunPet: '#FFE08A', sunY: -10.5, night: .3, stem: '#17523A', win: 3 },
  Night: { sky: '#171124', fol: '#8A80DC', haze: '#1B1530', hemiS: '#C4B5D4', hemiG: '#3D2F5A', hemi: 1.5, sunC: '#C9A6FF', sun: .9, pane: '#FFE08A', sunPet: '#F4EEFB', sunY: -.8, night: 1, stem: '#8FE0BD', win: 9 }
};
const SLOTS = [[-1.15, 4.1], [1.15, 3.45], [-1.4, 2.75], [1.4, 2.1], [-1.0, 1.4], [1.75, .7], [-1.9, 0], [1.05, -.7], [-1.15, -1.4], [2.0, -2.1], [-2.2, -2.8], [1.2, -3.3]];
const EXTRA = { 13: [1.2, 4.3], 12: [-.6, 3.4], 15: [.5, 4.45] };
const ST = { 1: { open: 1.38, cen: .25, tilt: .12, hs: .8 }, 2: { open: .8, cen: .8, tilt: .5, hs: .93 }, 3: { open: .16, cen: 1, tilt: .95, hs: 1 }, 4: { open: .16, cen: 1, tilt: .95, hs: 1 } };
const PRS = { Daisy: [.105, .27], Round: [.15, .225], Slim: [.07, .31] };
const ROWS = ['New', 'Waiting', "Everyone's in", 'Planned'];

export function createGarden(host, labelHost, cb = {}) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  const cv = renderer.domElement; cv.style.cssText = 'display:block;width:100%;height:100%;touch-action:none;cursor:grab'; host.appendChild(cv);
  const scene = new THREE.Scene(); scene.background = new THREE.Color('#CFE3FF');
  const camera = new THREE.PerspectiveCamera(52, 1, .1, 400);
  let VW = 390, VH = 844;
  const size = () => { VW = host.clientWidth || 390; VH = host.clientHeight || 844; renderer.setSize(VW, VH, false); camera.aspect = VW / VH; camera.updateProjectionMatrix(); };
  size(); const ro = new ResizeObserver(size); ro.observe(host);

  const L = (c, o) => new THREE.MeshLambertMaterial({ color: c, ...o });
  const B = (c, o) => new THREE.MeshBasicMaterial({ color: c, ...o });
  const M = (geo, mat, x = 0, y = 0, z = 0, shadow = true) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = shadow; return m; };
  const A = (p, m) => (p.add(m), m);
  const unit = new THREE.SphereGeometry(1, 18, 12);
  const v1 = new THREE.Vector3(), v2 = new THREE.Vector3(), camR = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0);

  let opt = { layout: 'Meadow', time: 'Day', motion: 'Gentle', petals: 'List color', petalShape: 'Daisy', voteLeaves: true, names: true };
  const tc = k => new THREE.Color(TH.Day[k]);
  const cur = { sky: tc('sky'), fol: tc('fol'), haze: tc('haze'), hemiS: tc('hemiS'), hemiG: tc('hemiG'), sunC: tc('sunC'), pane: tc('pane'), sunPet: tc('sunPet'), stem: tc('stem'), hemi: 1.7, sun: 1.9, sunY: -2.7, night: 0, win: 0 };
  const tmpC = new THREE.Color();

  // lights
  const hemi = new THREE.HemisphereLight('#FFFFFF', '#E6D2FF', 1.7); scene.add(hemi);
  const sunL = new THREE.DirectionalLight('#FFFFFF', 1.9); sunL.position.set(6, 12, 8); sunL.castShadow = true; sunL.shadow.mapSize.set(2048, 2048); sunL.shadow.radius = 2;
  Object.assign(sunL.shadow.camera, { left: -9, right: 9, top: 9, bottom: -9, near: 1, far: 40 }); sunL.shadow.bias = -.0005; sunL.shadow.normalBias = .04; scene.add(sunL);

  // scenery helpers: seeded noise, shared wind uniforms, shader patches
  const rs = (a, b) => a + sr() * (b - a), dummy = new THREE.Object3D(), _c = new THREE.Color(), _c2 = new THREE.Color();
  const hash = (x, y) => { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); };
  const vnoise = (x, y) => { const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf); return (hash(xi, yi) * (1 - u) + hash(xi + 1, yi) * u) * (1 - v) + (hash(xi, yi + 1) * (1 - u) + hash(xi + 1, yi + 1) * u) * v; };
  const fbm = (x, y) => vnoise(x, y) * .5 + vnoise(x * 2.1 + 5.2, y * 2.1 + 1.3) * .3 + vnoise(x * 4.3 + 1.7, y * 4.3 + 9.2) * .2;
  const mix3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  const uT = { value: 0 }, uA = { value: 1 }, uF = { value: Array.from({ length: 16 }, () => new THREE.Vector3()) };
  const WIND = 'float gWind(vec2 p,float t){return sin(t*1.15+p.x*.7+p.y*.45)*.6+sin(t*2.4+p.x*1.4-p.y*.3)*.25+pow(max(0.,sin(t*.23+p.x*.2)),6.)*.8;}\n';
  const PROJ = body => 'vec4 mvPosition = vec4( transformed, 1.0 );\n#ifdef USE_INSTANCING\nmvPosition = instanceMatrix * mvPosition;\n#endif\n' + body + '\nmvPosition = modelViewMatrix * mvPosition;\ngl_Position = projectionMatrix * mvPosition;';
  // leaves and blades are lit by a shaped normal, so the back-face flip is undone
  const fixN = s => { s.fragmentShader = s.fragmentShader.replace('#include <normal_fragment_begin>', '#include <normal_fragment_begin>\nnormal = normalize( vNormal );'); };
  const pal = (d, l, y, k) => ({ d: new THREE.Color(d), l: new THREE.Color(l), y: new THREE.Color(y), k: new THREE.Color(k) });
  const P1 = pal('#2C6A33', '#8DCB57', '#C5D96A', '#2E6230'), P2 = pal('#3E7F3A', '#A6D968', '#D2DF7A', '#3A7236'), P3 = pal('#2A6644', '#7CC474', '#B9D780', '#2B6040'), PC = pal('#1F4F3A', '#5E9C62', '#5E9C62', '#173A2B'), PB = pal('#2F6E3A', '#86C35C', '#B8D66C', '#2E6434'), PB2 = pal('#3A7A4E', '#93CF86', '#C2DC8C', '#356C46');
  const BARK1 = [.96, .93, .9], BARK2 = [1.18, 1.12, 1.06], BARKC = [.72, .62, .56];
  const big = (s, p, b, o) => ({ s, trunk: 1.5, len: 1.0, rad: .2, depth: 3, forks: 3, wob: .09, cr: .58, n: 240, leaf: .21, pal: p, bark: b, ...o }), mid = (s, p, b) => big(s, p, b, { trunk: 1.7, len: 1.2, depth: 2, wob: .1, cr: .85, n: 210, leaf: .28 });
  const TREES = [[-3.05, -5.65, big(1, P1, BARK1)], [3.0, -5.3, big(.8, P2, BARK2, { trunk: 1.35, rad: .17, n: 220 })], [5.7, .9, big(1.05, P3, BARK1, { trunk: 1.6, n: 200, leaf: .23 })], [-6.0, 1.7, big(.9, P2, BARK2, { n: 190, leaf: .23 })], [-7.6, -7.2, mid(1.1, P1, BARK1)], [6.5, -7.9, mid(1, P3, BARK1)], [-1.0, -11.3, mid(.9, P1, BARK1)], [8.8, -3.2, mid(1, P2, BARK2)]];
  const CONIFERS = [[-4.7, -9.4, 5.6], [-6.3, -8.4, 6.4], [-2.9, -10.4, 4.8], [4.3, -9.3, 4.3], [2.4, -10.8, 3.8], [7.4, -6.6, 4.8], [-8.2, -5.2, 5.2], [.8, -11.8, 3.6]];
  const BUSHES = [[-2.05, -4.25, .55, PB, .13], [-1.62, -3.98, .28, PB2, .11], [1.95, -4.25, .6, PB, .13], [2.45, -4.05, .4, PB2, .12], [-3.3, -2.7, .5, PB2, .13], [3.05, -3.1, .48, PB, .13], [-4.8, -4.3, .62, PB, .14], [4.7, -4.5, .55, PB2, .14]];
  const POTS = [[-1.3, -3.95], [.12, -3.95]];

  // ground: painted lawn (mottled greens, worn path, shade under trees and shrubs)
  scene.fog = new THREE.Fog('#D9DEFF', 19, 80);
  const GS = 14, TS = 768, G0 = [56, 110, 48], G1 = [98, 150, 62], GD = [140, 146, 78], T0 = [92, 164, 62], T1 = [156, 212, 98], TD = [204, 210, 112];
  const lawn = (x, z) => { const a = fbm(x * .42 + 3.1, z * .42 + 7.7), out = clamp(Math.max(Math.abs(x) - 3.4, z - 5, -6.5 - z) / 1.6, 0, 1); return [a, Math.min(1, Math.max(0, (vnoise(x * .8 + 31, z * .8 + 12) - .6) / .4) + out * .4), out]; };
  const gcv = document.createElement('canvas'); gcv.width = gcv.height = TS; const g2 = gcv.getContext('2d');
  { const im = g2.createImageData(TS, TS), d = im.data; for (let j = 0, o = 0; j < TS; j++) for (let i = 0; i < TS; i++, o += 4) { const l = lawn((i / TS * 2 - 1) * GS, (j / TS * 2 - 1) * GS), c = mix3(mix3(G0, G1, l[0]), GD, l[1] * .6), n = .9 + .2 * hash(i * .37, j * .91); d[o] = c[0] * n; d[o + 1] = c[1] * n; d[o + 2] = c[2] * n; d[o + 3] = 255; } g2.putImageData(im, 0, 0); }
  const wp = v => (v / GS * .5 + .5) * TS, wr = TS / (2 * GS);
  const blob = (x, z, r, rgb, a) => { const g = g2.createRadialGradient(wp(x), wp(z), 0, wp(x), wp(z), r * wr); g.addColorStop(0, `rgba(${rgb},${a})`); g.addColorStop(.55, `rgba(${rgb},${a * .7})`); g.addColorStop(1, `rgba(${rgb},0)`); g2.fillStyle = g; g2.fillRect(wp(x) - r * wr, wp(z) - r * wr, r * wr * 2, r * wr * 2); };
  for (let z = 5.4; z > -3.95; z -= .12) blob(pathX(z), z, .5, '178,152,110', .1 * clamp((5.4 - z) / 1.6, 0, 1));
  blob(-.6, -3.8, .55, '178,152,110', .4);
  for (let i = 0; i < 40; i++) { const q = i / 10, f = q % 1; blob(q < 1 ? -1.5 : q < 2 ? 1.5 : -1.5 + f * 3, q < 2 ? -6.3 + f * 2.2 : q < 3 ? -4.1 : -6.3, .5, '40,76,38', .2); }
  TREES.forEach(t => blob(t[0], t[1], 1.2, '38,74,38', .5)); CONIFERS.forEach(t => blob(t[0], t[1], 1.1, '34,66,40', .55)); BUSHES.forEach(b => blob(b[0], b[1], b[2] * 1.7, '36,72,36', .6));
  const gTex = new THREE.CanvasTexture(gcv); gTex.colorSpace = THREE.SRGBColorSpace; gTex.flipY = false; gTex.wrapS = gTex.wrapT = THREE.MirroredRepeatWrapping; gTex.anisotropy = 8;
  const groundGeo = new THREE.SphereGeometry(R, 96, 48); { const p = groundGeo.attributes.position, uv = groundGeo.attributes.uv; for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i) / GS * .5 + .5, (p.getZ(i) + CZ) / GS * .5 + .5); }
  const groundMat = L('#FFFFFF', { map: gTex }), farMat = L('#86B870'), stemMat = L('#17523A'), bushMat = L('#7DB95A'), white = L('#FFFFFF'), cloudMat = L('#FFFFFF', { fog: false });
  const ground = M(groundGeo, groundMat, 0, -R, CZ, false); ground.receiveShadow = true; scene.add(ground);

  // far hills, wooded, fading into the haze
  const vcol = (g, f) => { const p = g.attributes.position, c = new Float32Array(p.count * 3); for (let i = 0; i < p.count; i++) c[i * 3] = c[i * 3 + 1] = c[i * 3 + 2] = f(p.getY(i)); g.setAttribute('color', new THREE.BufferAttribute(c, 3)); return g; };
  const farTreeMat = new THREE.MeshLambertMaterial({ vertexColors: true }), FH = [[-13, -19, -34, 14], [12, -23, -38, 17], [2, -27, -46, 20]], fcone = [], fball = [];
  FH.forEach(h => { A(scene, M(unit, farMat, h[0], h[1], h[2], false)).scale.setScalar(h[3]); for (let i = 0; i < 430; i++) { const uy = rs(.5, 1), th = rs(-.45, 3.6), q = Math.sqrt(1 - uy * uy); (sr() < .55 ? fcone : fball).push([h[0] + Math.cos(th) * q * h[3], h[1] + uy * h[3] - .1, h[2] + Math.sin(th) * q * h[3], rs(.6, 1.15)]); } });
  [[fcone, vcol(new THREE.ConeGeometry(.42, 1.5, 6).translate(0, .75, 0), y => .55 + .5 * y / 1.5), '#2F6B48', '#3F7F52'], [fball, vcol(new THREE.IcosahedronGeometry(.6, 1).translate(0, .6, 0), y => .6 + .42 * y / 1.2), '#4B8F45', '#74B25A']].forEach(([arr, geo, ca, cb2]) => { const im = new THREE.InstancedMesh(geo, farTreeMat, arr.length); arr.forEach((a, i) => { dummy.position.set(a[0], a[1], a[2]); dummy.rotation.set(0, sr() * 6.28, 0); dummy.scale.set(a[3], a[3] * rs(.85, 1.25), a[3]); dummy.updateMatrix(); im.setMatrixAt(i, dummy.matrix); im.setColorAt(i, _c.set(ca).lerp(_c2.set(cb2), sr())); }); im.frustumCulled = false; scene.add(im); });

  // sky: rank daisy as the sun, clouds, stars
  const sunG = new THREE.Group(); sunG.position.set(7.15, -2.7, -60); sunG.scale.setScalar(.85); scene.add(sunG);
  const sunPetMat = B('#FFFFFF', { fog: false }), ringGeoSun = new THREE.TorusGeometry(1, .15, 10, 48);
  for (let i = 0; i < 8; i++) { const pv = new THREE.Group(); pv.rotation.z = -i * Math.PI / 4; const m = M(i < 5 ? unit : ringGeoSun, sunPetMat, 0, 3.4, 0, false); m.scale.set(1.25, 2.45, i < 5 ? .2 : 1); pv.add(m); sunG.add(pv); }
  A(sunG, M(unit, B(CEN, { fog: false }), 0, 0, .2, false)).scale.set(1.95, 1.95, .3);
  const clouds = [[-12, -1.5, -75, .37, 2.3], [8, .2, -80, .26, 2.5], [20, -6, -72, .46, 2.2]].map(a => { const g = new THREE.Group(); [[-1.6, 0, 1.1], [0, .35, 1.5], [1.6, .1, 1.2], [2.8, -.05, .9]].forEach(p => A(g, M(unit, cloudMat, p[0], p[1], 0, false)).scale.set(p[2], p[2] * .62, p[2] * .8)); g.position.set(a[0], a[1], a[2]); scene.add(g); return { g, sp: a[3], s: a[4] }; });
  const starGeo = new THREE.BufferGeometry(); { const p = []; for (let i = 0; i < 130; i++) p.push(-28 + sr() * 56, -38 + sr() * 52, -120); starGeo.setAttribute('position', new THREE.Float32BufferAttribute(p, 3)); }
  const starMat = new THREE.PointsMaterial({ color: '#F4EEFB', size: 2.2, sizeAttenuation: false, transparent: true, opacity: 0, fog: false }); scene.add(new THREE.Points(starGeo, starMat));

  // house
  const HZ = -5.2, house = new THREE.Group(); house.position.set(0, gy(0, HZ) - .05, HZ); scene.add(house);
  house.add(M(new THREE.BoxGeometry(3, 1.8, 2.2), white, 0, .9, 0));
  { const s = new THREE.Shape(); s.moveTo(-1.8, 0); s.lineTo(1.8, 0); s.lineTo(0, 1.35); s.closePath(); house.add(M(new THREE.ExtrudeGeometry(s, { depth: 2.6, bevelEnabled: false }), L('#8A4BE6'), 0, 1.8, -1.3)); }
  const doorMat = L('#6D2FC4'), trimMat = L('#B49FCF'), paneMat = B('#CFE3FF');
  house.add(M(new THREE.BoxGeometry(.62, 1.0, .08), doorMat, -.6, .5, 1.11));
  house.add(M(new THREE.CylinderGeometry(.31, .31, .08, 24).rotateX(Math.PI / 2), doorMat, -.6, 1.0, 1.11));
  house.add(M(new THREE.SphereGeometry(.045, 10, 8), L('#E8B923'), -.42, .55, 1.17));
  house.add(M(new THREE.BoxGeometry(.9, .12, .4), L('#F6F0FB'), -.6, .06, 1.32));
  house.add(M(new THREE.BoxGeometry(.74, .62, .06), paneMat, .72, 1.05, 1.11, false));
  [[.72, 1.39, .84, .07], [.72, .71, .84, .07]].forEach(a => house.add(M(new THREE.BoxGeometry(a[2], a[3], .1), trimMat, a[0], a[1], 1.12)));
  [[.33, 1.05], [1.11, 1.05], [.72, 1.05]].forEach((a, i) => house.add(M(new THREE.BoxGeometry(i === 2 ? .04 : .07, .68, .1), trimMat, a[0], a[1], 1.12)));
  house.add(M(new THREE.BoxGeometry(.74, .04, .1), trimMat, .72, 1.05, 1.12));
  house.add(M(new THREE.BoxGeometry(.9, .17, .22), L('#FFD9C7'), .72, .58, 1.2));
  [.42, .62, .82, 1.02].forEach((x, i) => A(house, M(unit, bushMat, x, .7, 1.22)).scale.setScalar(.1 + (i % 2) * .02));
  const winPane = M(new THREE.CylinderGeometry(.3, .3, .06, 28).rotateX(Math.PI / 2), paneMat, 0, 2.3, 1.31, false); house.add(winPane);
  house.add(M(new THREE.TorusGeometry(.3, .05, 8, 32), white, 0, 2.3, 1.33));
  house.add(M(new THREE.BoxGeometry(.42, .95, .42), L('#F7C9EA'), -.95, 2.55, -.2));
  house.add(M(new THREE.BoxGeometry(.54, .1, .54), white, -.95, 3.06, -.2));
  const winLight = new THREE.PointLight('#FFE08A', 0, 11, 1.4); winLight.position.set(0, 1.5, 2.4); house.add(winLight);
  const winPos = new THREE.Vector3(0, house.position.y + 2.3, HZ + 1.45), chimPos = new THREE.Vector3(-.95, house.position.y + 3.15, HZ - .2);
  let winFlash = 0;
  const smokeMats = [], smoke = Array.from({ length: 6 }, () => { const mt = L('#FFFFFF', { transparent: true }); smokeMats.push(mt); const m = M(unit, mt, 0, 0, 0, false); scene.add(m); return m; });

  // pots, fence, stepping stones
  POTS.forEach(a => { const y = gy(a[0], a[1]); scene.add(M(new THREE.CylinderGeometry(.2, .15, .3, 14), L('#FFD9C7'), a[0], y + .15, a[1])); A(scene, M(unit, bushMat, a[0], y + .44, a[1])).scale.setScalar(.25); [[.12, .1, .14], [-.14, .16, .1], [0, .24, -.02]].forEach(p => A(scene, M(unit, L('#F7C9EA'), a[0] + p[0], y + .44 + p[1], a[1] + p[2])).scale.setScalar(.06)); });
  [-1, 1].forEach(s => { for (let i = 0; i < 5; i++) { const x = s * (1.95 + i * .42), z = -4.75; scene.add(M(new THREE.BoxGeometry(.09, .5, .06), white, x, gy(x, z) + .25, z)); } const mx = s * 2.79; scene.add(M(new THREE.BoxGeometry(1.8, .06, .04), white, mx, gy(mx, -4.75) + .36, -4.74)); });
  const stoneMat = L('#F6F0FB'), stones = []; let si = 0;
  for (let z = 3.5; z > -3.8; z -= .62, si++) { const x = pathX(z) + (si % 2 ? .09 : -.09); stones.push([x, z]); const m = M(new THREE.CylinderGeometry(.3, .3, .06, 16), stoneMat, x, gy(x, z) + .03, z, false); m.scale.z = .8; m.rotation.y = si * 1.3; m.receiveShadow = true; scene.add(m); }

  // trees and shrubs: bark limbs, dark inner cores, instanced leaves
  const BK = { p: [], n: [], u: [], c: [], i: [] }, LV = { m: [], c: [], n: [], s: [] }, CR = { p: [], n: [], c: [] };
  const _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _m = new THREE.Matrix4(), _sc = new THREE.Vector3(), _p = new THREE.Vector3(), _d = new THREE.Vector3(), _u = new THREE.Vector3(), _n = new THREE.Vector3();
  const limb = (pts, rf, seg, col) => {
    const b0 = BK.p.length / 3, n = pts.length, T = new THREE.Vector3(), N = new THREE.Vector3(1, 0, 0), Bn = new THREE.Vector3(); let len = 0;
    for (let i = 0; i < n; i++) {
      T.subVectors(pts[Math.min(i + 1, n - 1)], pts[Math.max(i - 1, 0)]).normalize(); N.addScaledVector(T, -N.dot(T)); if (N.lengthSq() < 1e-4) N.set(0, 0, 1).addScaledVector(T, -T.z); N.normalize(); Bn.crossVectors(T, N);
      if (i) len += pts[i].distanceTo(pts[i - 1]); const r = rf(i / (n - 1));
      for (let j = 0; j <= seg; j++) { const a = j / seg * 6.2832, c = Math.cos(a), s = Math.sin(a), nx = N.x * c + Bn.x * s, ny = N.y * c + Bn.y * s, nz = N.z * c + Bn.z * s; BK.p.push(pts[i].x + nx * r, pts[i].y + ny * r, pts[i].z + nz * r); BK.n.push(nx, ny, nz); BK.u.push(j / seg * 2, len * 1.1); BK.c.push(col[0], col[1], col[2]); }
    }
    for (let i = 0; i < n - 1; i++) for (let j = 0; j < seg; j++) { const a = b0 + i * (seg + 1) + j, b = a + seg + 1; BK.i.push(a, a + 1, b, b, a + 1, b + 1); }
  };
  const addLeaf = (p, d, sx, sy, col, n, sway, fl) => { _q.setFromUnitVectors(UP, d); _q2.setFromAxisAngle(d, sr() * 6.2832); _q.premultiply(_q2); _m.compose(p, _q, _sc.set(sx, sy, sx)); for (let k = 0; k < 16; k++) LV.m.push(_m.elements[k]); LV.c.push(col.r, col.g, col.b); LV.n.push(n.x, n.y, n.z); LV.s.push(sway, fl); };
  const icoT = new THREE.IcosahedronGeometry(1, 1).attributes.position, coneT = new THREE.ConeGeometry(1, 1, 9, 1, true).toNonIndexed().attributes.position;
  const addCore = (c, rx, ry, col) => { for (let i = 0; i < icoT.count; i++) { const x = icoT.getX(i), y = icoT.getY(i), z = icoT.getZ(i), k = .62 + .38 * (y * .5 + .5); CR.p.push(c.x + x * rx, c.y + y * ry, c.z + z * rx); CR.n.push(x, y, z); CR.c.push(col.r * k, col.g * k, col.b * k); } };
  // one leafy clump: leaves sit near the shell, lighter outside and on top, darker inside
  const cluster = (c, r, n, pl, cc, size, base, flat = .82) => {
    addCore(c, r * .72, r * .72 * flat, pl.k);
    for (let i = 0; i < n; i++) {
      _u.set(rs(-1, 1), rs(-.6, 1), rs(-1, 1)).normalize(); const rho = r * (1 - .45 * sr() * sr());
      _p.set(c.x + _u.x * rho, c.y + _u.y * rho * flat, c.z + _u.z * rho);
      _d.set(_u.x + rs(-.7, .7), _u.y * .5 - .4 + rs(-.5, .5), _u.z + rs(-.7, .7)).normalize();
      _n.copy(_p).sub(cc).normalize().multiplyScalar(.5).addScaledVector(_u, .6); _n.y += .3; _n.normalize();
      const a = clamp((rho / r - .55) / .45 * .45 + (_u.y * .5 + .5) * .5 + rs(-.2, .2), 0, 1), s = size * rs(.75, 1.3);
      _c.copy(pl.d).lerp(pl.l, a); if (sr() < .07) _c.lerp(pl.y, .55);
      addLeaf(_p, _d, s, s, _c, _n, Math.max(0, _p.y - base) * .016, s * .2);
    }
  };
  const tree = (x, z, o) => {
    const y0 = gy(x, z) - .08, S = o.s, tips = [], mids = [], a = new THREE.Vector3(), b = new THREE.Vector3();
    const grow = (st, dir, len, rad, dep) => {
      const n = dep ? 4 : 6, pts = [st.clone()], d = dir.clone(), p = st.clone();
      for (let i = 1; i <= n; i++) { d.x += rs(-1, 1) * o.wob; d.z += rs(-1, 1) * o.wob; if (dep) d.y += .07; d.normalize(); p.addScaledVector(d, len / n); pts.push(p.clone()); }
      const re = rad * (dep >= o.depth ? .3 : .62);
      limb(pts, t => (rad + (re - rad) * t) * (dep ? 1 : 1 + .9 * Math.exp(-t * 9)), dep ? (dep > 1 ? 5 : 7) : 10, o.bark);
      if (dep >= o.depth) { tips.push(p.clone()); return; }
      if (dep) mids.push(pts[3].clone());
      const k = dep ? (sr() < .4 ? 3 : 2) : o.forks, a0 = sr() * 6.2832;
      a.set(d.z, 0, -d.x); if (a.lengthSq() < 1e-4) a.set(1, 0, 0); a.normalize(); b.crossVectors(d, a);
      const ax = a.clone(), bx = b.clone();
      for (let i = 0; i < k; i++) { const ang = a0 + i / k * 6.2832 + rs(-.35, .35), sp = dep ? rs(.45, .8) : i ? rs(.7, 1) : rs(.1, .28), nd = d.clone().multiplyScalar(Math.cos(sp)).addScaledVector(ax, Math.cos(ang) * Math.sin(sp)).addScaledVector(bx, Math.sin(ang) * Math.sin(sp)); nd.y += .12; nd.normalize(); grow(p, nd, dep ? len * rs(.68, .82) : o.len * S * rs(.85, 1.1), re * (dep || !i ? rs(.82, .95) : .72), dep + 1); }
    };
    grow(new THREE.Vector3(x, y0, z), new THREE.Vector3(rs(-.07, .07), 1, rs(-.07, .07)).normalize(), o.trunk * S, o.rad * S, 0);
    const cc = new THREE.Vector3(); tips.forEach(t => cc.add(t)); cc.multiplyScalar(1 / tips.length);
    tips.forEach(t => cluster(t, o.cr * S * rs(.85, 1.2), o.n, o.pal, cc, o.leaf * S, y0));
    mids.forEach(t => cluster(t, o.cr * S * .8, Math.round(o.n * .6), o.pal, cc, o.leaf * S, y0));
  };
  const conifer = (x, z, H) => {
    const y0 = gy(x, z) - .08, Rm = H * .25, lean = rs(-.03, .03);
    limb([0, .5, 1].map(t => new THREE.Vector3(x + lean * t * H, y0 + t * H * .96, z)), t => H * .034 * (1 - t) * (1 + .6 * Math.exp(-t * 9)) + .012, 7, BARKC);
    for (let i = 0; i < coneT.count; i++) { const cx = coneT.getX(i), cy = coneT.getY(i) + .5, cz = coneT.getZ(i), hy = H * (.2 + cy * .78), kk = .7 + .3 * cy; CR.p.push(x + lean * hy + cx * Rm * .6, y0 + hy, z + cz * Rm * .6); _n.set(cx, .4, cz).normalize(); CR.n.push(_n.x, _n.y, _n.z); CR.c.push(PC.k.r * kk, PC.k.g * kk, PC.k.b * kk); }
    const tiers = Math.round(H * 3);
    for (let k = 0; k < tiers; k++) {
      const t = k / (tiers - 1), y = y0 + H * (.17 + .8 * t), rad = Rm * Math.pow(1 - t, .9) + .09, nb = Math.max(4, Math.round(5 + rad * 7)), a0 = sr() * 6.2832;
      for (let q = 0; q < nb; q++) {
        const ang = a0 + q / nb * 6.2832 + rs(-.25, .25), ca = Math.cos(ang), sa = Math.sin(ang), Lb = rad * rs(.78, 1.12), droop = rs(.3, .55), ns = Math.max(2, Math.round(Lb * 11));
        for (let s = 0; s < ns; s++) {
          const f = (s + sr()) / ns, rr = Lb * f, py = y - droop * rr * (.5 + .7 * f) + rs(-.05, .05), fan = rs(-1, 1), len = rs(.3, .46) * (1 - .4 * t) * (H / 11 + .5);
          _p.set(x + lean * (py - y0) + ca * rr, py, z + sa * rr);
          _d.set(ca * Math.cos(fan) - sa * Math.sin(fan), -droop * .9 - rs(0, .3), sa * Math.cos(fan) + ca * Math.sin(fan)).normalize();
          _n.set(ca * .6, .72, sa * .6).normalize(); _c.copy(PC.d).lerp(PC.l, clamp(f * .8 + t * .15 + rs(-.18, .18), 0, 1));
          addLeaf(_p, _d, len * .7, len, _c, _n, (py - y0) * .011, len * .08);
        }
      }
    }
  };
  const bush = (x, z, r, pl, leaf) => {
    const y = gy(x, z), cc = new THREE.Vector3(x, y + r * .25, z), k = 3 + (sr() * 2 | 0), a0 = sr() * 6.28;
    cluster(new THREE.Vector3(x, y + r * .6, z), r, Math.round(2000 * r * r), pl, cc, leaf, y, .85);
    for (let i = 0; i < k; i++) { const ang = a0 + i / k * 6.28 + rs(-.3, .3), rr = r * rs(.5, .7); cluster(new THREE.Vector3(x + Math.cos(ang) * r * .62, y + rr * .55, z + Math.sin(ang) * r * .62), rr, Math.round(2000 * rr * rr), pl, cc, leaf, y, .85); }
  };
  TREES.forEach(t => tree(t[0], t[1], t[2])); CONIFERS.forEach(t => conifer(t[0], t[1], t[2])); BUSHES.forEach(b => bush(b[0], b[1], b[2], b[3], b[4]));
  const fa = (a, n) => new THREE.Float32BufferAttribute(a, n);
  const barkTex = (() => { const c = document.createElement('canvas'); c.width = 128; c.height = 256; const x = c.getContext('2d'); x.fillStyle = '#8A776A'; x.fillRect(0, 0, 128, 256); for (let i = 0; i < 260; i++) { const px = sr() * 128, py = sr() * 256, h = 20 + sr() * 90, w = 1.5 + sr() * 4; x.fillStyle = sr() < .62 ? `rgba(58,44,40,${.25 + sr() * .35})` : `rgba(190,172,156,${.15 + sr() * .25})`; for (const o of [-128, 0, 128]) for (const q of [-256, 0, 256]) x.fillRect(px + o, py + q, w, h); } const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; return t; })();
  const barkGeo = new THREE.BufferGeometry(); barkGeo.setAttribute('position', fa(BK.p, 3)); barkGeo.setAttribute('normal', fa(BK.n, 3)); barkGeo.setAttribute('uv', fa(BK.u, 2)); barkGeo.setAttribute('color', fa(BK.c, 3)); barkGeo.setIndex(BK.i);
  const barkMat = L('#FFFFFF', { map: barkTex, vertexColors: true }), barkMesh = M(barkGeo, barkMat); barkMesh.receiveShadow = true; scene.add(barkMesh);
  const coreGeo = new THREE.BufferGeometry(); coreGeo.setAttribute('position', fa(CR.p, 3)); coreGeo.setAttribute('normal', fa(CR.n, 3)); coreGeo.setAttribute('color', fa(CR.c, 3));
  const coreMat = L('#FFFFFF', { vertexColors: true }), coreMesh = M(coreGeo, coreMat); coreMesh.receiveShadow = true; scene.add(coreMesh);
  const leafGeo = new THREE.BufferGeometry(); leafGeo.setAttribute('position', fa([0, 0, 0, 0, .5, -.1, 0, 1, 0, -.32, .42, .06, .32, .42, .06], 3)); leafGeo.setAttribute('color', fa([.7, .7, .7, .95, .95, .95, 1.1, 1.1, 1.1, 1, 1, 1, 1, 1, 1], 3)); leafGeo.setIndex([0, 1, 3, 3, 1, 2, 0, 4, 1, 1, 4, 2]); leafGeo.computeVertexNormals();
  leafGeo.setAttribute('aN', new THREE.InstancedBufferAttribute(new Float32Array(LV.n), 3)); leafGeo.setAttribute('aS', new THREE.InstancedBufferAttribute(new Float32Array(LV.s), 2));
  const leafMat = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
  leafMat.onBeforeCompile = s => {
    s.uniforms.uT = uT; s.uniforms.uA = uA;
    s.vertexShader = 'uniform float uT, uA; attribute vec3 aN; attribute vec2 aS;\n' + WIND + s.vertexShader
      .replace('#include <defaultnormal_vertex>', '#include <defaultnormal_vertex>\ntransformedNormal = normalize( normalMatrix * aN + normalize( transformedNormal ) * .3 );')
      .replace('#include <project_vertex>', PROJ('vec3 gR = instanceMatrix[3].xyz; float gW = gWind(gR.xz, uT) * uA;\nmvPosition.x += gW * aS.x; mvPosition.z += gW * aS.x * .4;\nmvPosition.xyz += aN * (sin(uT * 5.3 + dot(gR, vec3(7.1, 5.3, 6.7))) * (.35 + .65 * abs(gW)) * min(uA, 1.) * aS.y * position.y);'));
    fixN(s);
  };
  const leaves = new THREE.InstancedMesh(leafGeo, leafMat, LV.m.length / 16); leaves.instanceMatrix.array.set(LV.m); leaves.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(LV.c), 3); leaves.castShadow = leaves.receiveShadow = true; leaves.frustumCulled = false; scene.add(leaves);

  // grass: instanced three-blade tufts, wind and the clearing round each flower done in the vertex shader
  const tuftGeo = (() => { const P = [], C = [], Nn = [], I = []; [[0, 0, 0, .3, .1], [.055, .03, 2.2, .24, .13], [-.045, .05, 4.3, .2, .16]].forEach(([bx, bz, ry, h, ln]) => { const c = Math.cos(ry), s = Math.sin(ry), b0 = P.length / 3; [[0, .021, 0, .42], [.5, .016, .45, .8], [1, 0, 1, 1.08]].forEach(([t, w, f, g], k) => { for (const sg of k < 2 ? [-1, 1] : [0]) { const lx = sg * w, lz = f * ln; P.push(bx + lx * c + lz * s, t * h, bz - lx * s + lz * c); C.push(g, g, g); Nn.push(s * .3, 1, c * .3); } }); I.push(b0, b0 + 1, b0 + 2, b0 + 1, b0 + 3, b0 + 2, b0 + 2, b0 + 3, b0 + 4); }); const g = new THREE.BufferGeometry(); g.setAttribute('position', fa(P, 3)); g.setAttribute('color', fa(C, 3)); g.setAttribute('normal', fa(Nn, 3)); g.setIndex(I); return g; })();
  const grassMat = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
  grassMat.onBeforeCompile = s => {
    s.uniforms.uT = uT; s.uniforms.uA = uA; s.uniforms.uF = uF;
    s.vertexShader = 'uniform float uT, uA; uniform vec3 uF[16];\n' + WIND + s.vertexShader
      .replace('#include <color_vertex>', '#include <color_vertex>\nvec3 gR = instanceMatrix[3].xyz; float gH = position.y / .3; float gW = gWind(gR.xz, uT) * uA; vColor.rgb *= 1. + gW * gH * .09;')
      .replace('#include <project_vertex>', PROJ('float gK = 1.; for (int i = 0; i < 16; i++) { vec2 gd = gR.xz - uF[i].xy; gK = min(gK, 1. - uF[i].z * (1. - smoothstep(.01, .12, dot(gd, gd)))); }\nmvPosition.xyz = gR + (mvPosition.xyz - gR) * gK;\nfloat gS = length(instanceMatrix[1].xyz) * gH * gH * gK;\nmvPosition.x += gW * gS * .085 + sin(uT * 4.7 + gR.x * 9. + gR.z * 7.) * .012 * gS * uA; mvPosition.z += gW * gS * .035; mvPosition.y -= abs(gW) * gS * .02;'));
    fixN(s);
  };
  const GR = [], tuft = (x, z, h, w) => { const l = lawn(x, z), c = mix3(mix3(T0, T1, l[0]), TD, l[1] * .7), j = rs(.9, 1.1); GR.push([x, z, h, w, c[0] * j, c[1] * j, c[2] * j]); };
  const ring = (x, z, r, n, h) => { for (let i = 0; i < n; i++) { const a = sr() * 6.2832, q = r * rs(.9, 1.35); tuft(x + Math.cos(a) * q, z + Math.sin(a) * q, h * rs(.8, 1.25), 1.2); } };
  for (let i = 0; i < 27000; i++) {
    const x = rs(-9, 9), z = rs(-8.5, 8), out = lawn(x, z)[2]; if (sr() < out * .45) continue;
    if (Math.abs(x) < 1.62 && z > -6.45 && z < -3.98) continue; if (Math.abs(x + .6) < .52 && z > -4.1 && z < -3.62) continue;
    let h = 1, sd2 = 9; for (const st of stones) sd2 = Math.min(sd2, (x - st[0]) ** 2 + (z - st[1]) ** 2);
    if (sd2 < .1) continue; if (sd2 < .25) h = .6;
    if (z > -4 && z < 4.2 && Math.abs(x - pathX(z)) < .4) { if (sr() < .4) continue; h *= .6; }
    if (POTS.some(p => (x - p[0]) ** 2 + (z - p[1]) ** 2 < .05) || BUSHES.some(b => (x - b[0]) ** 2 + (z - b[1]) ** 2 < b[2] * b[2] * .5)) continue;
    tuft(x, z, h * rs(.72, 1.25) * (1 + out * .9), rs(.9, 1.3) * (1 + out * .5));
  }
  [-1, 1].forEach(s => { for (let i = 0; i < 5; i++) ring(s * (1.95 + i * .42), -4.75, .07, 4, 1.5); });
  TREES.forEach(t => ring(t[0], t[1], t[2].rad * t[2].s + .08, 12, 1.5)); CONIFERS.forEach(t => ring(t[0], t[1], .25, 8, 1.5)); BUSHES.forEach(b => ring(b[0], b[1], b[2] * .85, 10, 1.3));
  for (let i = 0; i < 90; i++) { const q = sr() * 4, wx = q < 1 ? -1.56 : q < 2 ? 1.56 : rs(-1.56, 1.56), wz = q < 2 ? rs(-6.35, -4.05) : q < 3 ? -4.02 : -6.4; if (q >= 2 && q < 3 && Math.abs(wx + .6) < .55) continue; tuft(wx + rs(-.03, .03), wz + rs(-.03, .03), rs(1.1, 1.6), 1.2); }
  const grass = new THREE.InstancedMesh(tuftGeo, grassMat, GR.length);
  GR.forEach((g, i) => { dummy.position.set(g[0], gy(g[0], g[1]) - .02, g[1]); dummy.rotation.set(rs(-.14, .14), sr() * 6.2832, rs(-.14, .14)); dummy.scale.set(g[3], g[2], g[3]); dummy.updateMatrix(); grass.setMatrixAt(i, dummy.matrix); grass.setColorAt(i, _c.setRGB(g[4] / 255, g[5] / 255, g[6] / 255, THREE.SRGBColorSpace)); });
  grass.receiveShadow = true; grass.frustumCulled = false; scene.add(grass);

  // a patch of bare soil travels with each flower
  const soilTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d'), g = x.createRadialGradient(64, 64, 0, 64, 64, 64); g.addColorStop(0, 'rgba(74,54,40,1)'); g.addColorStop(.5, 'rgba(84,62,44,.95)'); g.addColorStop(.8, 'rgba(70,84,44,.5)'); g.addColorStop(1, 'rgba(70,96,46,0)'); x.fillStyle = g; x.fillRect(0, 0, 128, 128); for (let i = 0; i < 220; i++) { const a = sr() * 6.28, r = Math.sqrt(sr()) * 44; x.fillStyle = sr() < .5 ? 'rgba(48,34,26,.55)' : 'rgba(128,100,72,.5)'; x.beginPath(); x.arc(64 + Math.cos(a) * r, 64 + Math.sin(a) * r, 1 + sr() * 2.2, 0, 6.28); x.fill(); } const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
  const soilGeo = new THREE.CircleGeometry(.36, 20).rotateX(-Math.PI / 2), soilMat = L('#FFFFFF', { map: soilTex, transparent: true, depthWrite: false });
  const tintMats = [groundMat, grassMat, leafMat, coreMat, barkMat, farTreeMat, soilMat];

  // flowers
  const stemGeo = new THREE.CylinderGeometry(.035, .05, 1, 7).translate(0, .5, 0), calyxGeo = new THREE.ConeGeometry(.14, .22, 8).rotateX(Math.PI).translate(0, -.06, 0), centerGeo = new THREE.SphereGeometry(.17, 18, 12);
  const hitGeo = new THREE.CylinderGeometry(.5, .5, 1, 8).translate(0, .5, 0), hitMat = B('#000000', { transparent: true, opacity: 0, depthWrite: false }), stakeGeo = new THREE.CylinderGeometry(.025, .025, .7, 6).translate(0, .35, 0);
  const ringGeo = new THREE.TorusGeometry(.55, .035, 8, 44), cenMat = L(CEN), plaqueGeo = new THREE.BoxGeometry(.52, .38, .05), planeGeo = new THREE.PlaneGeometry(.46, .32);
  const flowers = new Map(), hits = []; let order = [], sel = null, pickId = null, hoverId = null, pend = [];
  const texCache = {};
  const dayTex = day => { if (texCache[day]) return texCache[day]; const c = document.createElement('canvas'); c.width = 184; c.height = 128; const x = c.getContext('2d'); x.fillStyle = '#FFFFFF'; x.fillRect(0, 0, 184, 128); x.strokeStyle = '#B8339A'; x.lineWidth = 12; x.strokeRect(6, 6, 172, 116); x.fillStyle = INK; x.font = '900 84px Nunito, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(day, 92, 70); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return (texCache[day] = t); };
  const petCol = d => opt.petals === 'White' ? '#FFFFFF' : opt.petals === 'Accent' ? (opt.time === 'Night' ? '#E678CE' : '#B8339A') : LC[d.l];
  const stemH = d => opt.layout === 'Tall stems' ? .7 + Math.sqrt(d.d) * .15 : [0, .78, 1.05, 1.36, 1.36][d.st] + (d.id % 3) * .07;
  const mkLabel = dark => { const e = document.createElement('div'); e.style.cssText = 'position:absolute;left:0;top:0;font:800 11px Nunito,sans-serif;padding:1px 7px;border-radius:9px;white-space:nowrap;text-align:center;line-height:1.2;opacity:0;transition:opacity .35s;will-change:transform;' + (dark ? 'background:#2C2040;color:#FFFFFF' : 'background:var(--card,#fff);color:var(--ink,#2C2040)'); labelHost.appendChild(e); return e; };


  function makeFlower(d, delay) {
    const g = new THREE.Group(), f = { id: d.id, d, g, slot: freeSlot(delay < 1), H: 0, open: 1.5, ov: 0, cen: 0, tilt: 0, hs: .2, hv: 0, grow: 0, delay, tagS: 0, tv: 0, x: 0, z: 0, tx: 0, tz: 0, placed: false, fly: null, ringO: 0, headW: new THREE.Vector3(), txt: '' };
    f.seg1 = new THREE.Group(); g.add(f.seg1); f.s1 = M(stemGeo, stemMat); f.seg1.add(f.s1);
    f.seg2 = new THREE.Group(); f.seg1.add(f.seg2); f.s2 = M(stemGeo, stemMat); f.seg2.add(f.s2);
    f.head = new THREE.Group(); f.seg2.add(f.head); f.headIn = new THREE.Group(); f.head.add(f.headIn); f.headIn.add(M(calyxGeo, stemMat));
    f.petMat = L(petCol(d)); f.pets = [];
    for (let i = 0; i < 8; i++) { const pv = new THREE.Group(); pv.rotation.y = i * Math.PI / 4; const inn = new THREE.Group(); pv.add(inn); const m = M(unit, f.petMat); inn.add(m); f.headIn.add(pv); f.pets.push([inn, m]); }
    f.center = M(centerGeo, cenMat); f.headIn.add(f.center);
    f.leaves = [0, 1, 2].map(m => { const pv = new THREE.Group(); pv.rotation.y = [2.4, -.5, 4.1][m]; const tl = new THREE.Group(); tl.rotation.z = .5; pv.add(tl); const mat = L('#17523A'), mesh = M(unit, mat, .25, 0, 0); mesh.scale.set(.24, .035, .105); tl.add(mesh); (m === 0 ? f.seg1 : f.seg2).add(pv); return { pv, mat, s: 0 }; });
    f.tag = new THREE.Group(); f.tag.rotation.x = -.2; const str = M(stakeGeo, L('#B49FCF'), 0, -.75, 0); str.scale.y = .4; f.tag.add(str); f.plaque = M(plaqueGeo, white, 0, -.32, 0); f.plaque.userData.id = d.id; f.tag.add(f.plaque); f.tagMat = new THREE.MeshBasicMaterial({ color: '#FFFFFF' }); f.tag.add(M(planeGeo, f.tagMat, 0, -.32, .03, false)); f.tag.visible = false; f.head.add(f.tag);
    f.soil = new THREE.Mesh(soilGeo, soilMat); f.soil.position.y = .034; f.soil.receiveShadow = true; g.add(f.soil);
    g.userData.id = d.id; f.hit = new THREE.Mesh(hitGeo, hitMat); f.hit.userData.proxy = true; f.hit.userData.id = d.id; g.add(f.hit); hits.push(f.hit); f.hit2 = new THREE.Mesh(unit, hitMat); f.hit2.scale.setScalar(.72); f.hit2.userData.proxy = true; f.hit2.userData.id = d.id; f.head.add(f.hit2); hits.push(f.hit2);
    f.ring = M(ringGeo, B('#B8339A', { transparent: true, opacity: 0 }), 0, .04, 0, false); f.ring.rotation.x = -Math.PI / 2; f.ring.userData.proxy = true; f.head.add(f.ring);
    f.label = mkLabel(false); g.visible = false; scene.add(g); flowers.set(d.id, f); return f;
  }
  const dropHits = id => { for (let k = hits.length - 1; k >= 0; k--) if (hits[k].userData.id === id) hits.splice(k, 1); };
  function removeFlower(f) { scene.remove(f.g); f.label.remove(); f.petMat.dispose(); f.leaves.forEach(l => l.mat.dispose()); f.tagMat.dispose(); f.ring.material.dispose(); dropHits(f.id); flowers.delete(f.id); }
  const freeSlot = fresh => { const used = new Set([...flowers.values()].filter(f => !f.fly).map(f => f.slot)); if (fresh) for (const k of [13, 12, 15]) if (!used.has(k)) return k; let i = 0; while (used.has(i)) i++; return i; };
  function place() {
    const list = [...flowers.values()].filter(f => !f.fly);
    if (opt.layout === 'Meadow') { list.forEach(f => { const p = EXTRA[f.slot] || SLOTS[f.slot % SLOTS.length]; f.tx = p[0]; f.tz = p[1]; }); return; }
    const key = opt.layout === 'Path' ? (f => f.d.st) : (f => f.d.d);
    [0, 1].forEach(side => list.filter(f => f.slot % 2 === side).sort((a, b) => key(a) - key(b) || a.slot - b.slot).forEach((f, i) => { const p = SLOTS[(i * 2 + side) % SLOTS.length]; f.tx = p[0]; f.tz = p[1]; }));
  }
  function setIdeas(list, intro) {
    const ids = new Set(list.map(d => d.id));
    for (const f of [...flowers.values()]) if (!ids.has(f.id) && !f.fly) removeFlower(f);
    list.forEach((d, i) => {
      let f = flowers.get(d.id);
      if (!f) f = makeFlower(d, intro ? 1.3 + i * .17 : .05);
      else { if (f.d.st !== d.st && !d.fly) { f.hv += 2.4; if (d.st === 3) pend.push({ t: .4, id: d.id, c: null }); if (d.st === 4) pend.push({ t: .25, id: d.id, c: CEN }); } f.d = d; if (d.fly && !f.fly) { f.fly = { t: 0, from: f.g.position.clone() }; f.ring.visible = false; f.soil.visible = false; dropHits(f.id); } }
      f.petMat.color.set(petCol(d)); if (d.day) { f.tagMat.map = dayTex(d.day); f.tagMat.needsUpdate = true; }
    });
    order = list.map(d => d.id); place();
  }
  function setOptions(o) { Object.assign(opt, o); flowers.forEach(f => f.petMat.color.set(petCol(f.d))); place(); }

  // particles
  const parts = Array.from({ length: 110 }, () => { const m = new THREE.Mesh(unit, L('#FFFFFF')); m.visible = false; scene.add(m); return { m, v: new THREE.Vector3(), life: 0, ph: 0, g: 3.4 }; }); let pi = 0;
  function burst(p, color, n = 16, soft) { for (let i = 0; i < n; i++) { const q = parts[pi++ % parts.length]; q.m.material.color.set(i % 4 === 3 ? CEN : color); q.m.position.copy(p); if (soft) { q.v.set(rnd(.6, 1.4), rnd(-.2, .2), rnd(.2, .8)); q.life = rnd(3, 5); q.g = .35; } else { q.v.set(rnd(-1, 1), rnd(.6, 1.8), rnd(-1, 1)).multiplyScalar(rnd(1.2, 2.3)); q.life = rnd(1.1, 1.7); q.g = 3.4; } q.ph = rnd(0, 6); q.m.visible = true; q.m.rotation.set(rnd(0, 6), rnd(0, 6), rnd(0, 6)); } }

  // butterflies
  const wingGeo = (() => { const s = new THREE.Shape(); s.moveTo(0, .03); s.bezierCurveTo(.06, .16, .2, .26, .3, .2); s.bezierCurveTo(.36, .14, .3, .02, .2, -.01); s.bezierCurveTo(.27, -.06, .25, -.2, .15, -.21); s.bezierCurveTo(.07, -.22, .02, -.12, 0, -.05); s.lineTo(0, .03); return new THREE.ShapeGeometry(s, 12).rotateX(Math.PI / 2); })();
  const spotGeo = new THREE.CircleGeometry(1, 14).rotateX(-Math.PI / 2), inkMat = L(INK);
  function makeFly(color, i) {
    const g = new THREE.Group(), wm = L(color, { side: THREE.DoubleSide }), sm = L('#FFFFFF', { side: THREE.DoubleSide });
    const body = M(new THREE.CapsuleGeometry(.02, .15, 4, 8), inkMat); body.rotation.x = Math.PI / 2; g.add(body); g.add(M(new THREE.SphereGeometry(.03, 10, 8), inkMat, 0, .005, .11));
    [-1, 1].forEach(s => { const a = M(new THREE.CylinderGeometry(.005, .005, .11, 4).translate(0, .055, 0), inkMat, s * .012, .02, .12, false); a.rotation.set(.9, 0, -s * .45); g.add(a); });
    const wing = s => { const w = new THREE.Group(); w.scale.x = s; w.add(M(wingGeo, wm)); [[.2, .11, .04], [.15, -.11, .03]].forEach(p => A(w, M(spotGeo, sm, p[0], .004, p[1], false)).scale.setScalar(p[2])); g.add(w); return w; };
    const b = { g, wr: wing(1), wl: wing(-1), pos: new THREE.Vector3(rnd(-2, 2), 2.5, rnd(-2, 2)), vel: new THREE.Vector3(), tgt: new THREE.Vector3(), mode: 'fly', fid: null, timer: rnd(1, 3), yaw: 0, roll: 0, pitch: 0, ph: rnd(0, 6), seed: i * 2.7, vis: 0 };
    scene.add(g); way(b); return b;
  }
  function way(b) { b.tgt.set(rnd(-2.3, 2.3), 0, rnd(-3.4, 3.2)); b.tgt.y = gy(b.tgt.x, b.tgt.z) + rnd(1.2, 2.6); }
  const flies = ['#F7C9EA', '#FFE08A', '#CFE3FF', '#FFD9C7'].map(makeFly);
  function takeoff(b) { b.mode = 'fly'; b.fid = null; b.vel.set(rnd(-.4, .4), 1.3, rnd(-.4, .4)); b.timer = rnd(2, 4); way(b); }
  function updFly(b, dt, t) {
    const fl = b.fid != null ? flowers.get(b.fid) : null; let th;
    b.ph += dt * (b.mode === 'perch' ? 1.9 : 58);
    if (b.mode === 'perch') {
      if (!fl || fl.fly || fl.d.st < 2 || (sel != null && sel !== fl.id)) takeoff(b);
      else { b.pos.copy(fl.headW); b.timer -= dt; th = .95 + .4 * Math.sin(b.ph); b.roll = damp(b.roll, 0, 5, dt); b.pitch = damp(b.pitch, -.25, 5, dt); if (b.timer < 0) takeoff(b); }
    }
    if (b.mode !== 'perch') {
      let tgt = b.tgt, arrive = false;
      if (b.mode === 'approach') { if (!fl || fl.fly || b.timer < 0) { b.mode = 'fly'; b.fid = null; way(b); b.timer = rnd(2, 4); } else { tgt = fl.headW; arrive = true; } }
      v1.subVectors(tgt, b.pos); const dist = v1.length(), sp = arrive ? Math.min(1.5, dist * 1.8 + .2) : 1.5, fa = arrive ? Math.min(1, dist * 1.2) : 1;
      v1.multiplyScalar(sp / Math.max(dist, .001));
      v1.x += Math.sin(t * 5.1 + b.seed) * .9 * fa; v1.y += (Math.sin(t * 7.3 + b.seed * 2) * .8 + Math.cos(b.ph) * .5) * fa; v1.z += Math.cos(t * 4.3 + b.seed) * .7 * fa;
      b.vel.lerp(v1, 1 - Math.exp(-dt * 2.4)); b.pos.addScaledVector(b.vel, dt);
      const fl0 = gy(b.pos.x, b.pos.z) + .35; if (b.pos.y < fl0) b.pos.y = fl0;
      b.timer -= dt;
      if (b.mode === 'approach' && dist < .07) { b.mode = 'perch'; b.timer = rnd(2.5, 6); }
      else if (b.mode === 'fly' && (dist < .5 || b.timer < 0)) {
        const taken = new Set(flies.map(o => o.fid)), c = [...flowers.values()].filter(f => f.d.st >= 2 && !f.fly && f.grow > .9 && !taken.has(f.id));
        if (c.length && Math.random() < .6) { b.mode = 'approach'; b.fid = c[Math.floor(Math.random() * c.length)].id; b.timer = 12; } else { way(b); b.timer = rnd(2.5, 5); }
      }
      th = -.35 + 1.6 * (.5 + .5 * Math.sin(b.ph));
      let dy = Math.atan2(b.vel.x, b.vel.z) - b.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); const yr = dy * Math.min(1, dt * 6); b.yaw += yr;
      b.roll = damp(b.roll, clamp(-yr / Math.max(dt, .001) * .12, -.7, .7), 6, dt); b.pitch = damp(b.pitch, clamp(-b.vel.y * .35, -.6, .6), 5, dt);
    }
    b.g.position.copy(b.pos); if (b.mode !== 'perch') b.g.position.y += Math.sin(b.ph - 1.57) * .03;
    b.g.rotation.set(b.pitch, b.yaw, b.roll, 'YXZ'); b.wr.rotation.z = th; b.wl.rotation.z = -th;
  }

  // bee
  const bee = (() => { const g = new THREE.Group(); A(g, M(unit, L(CEN))).scale.set(.09, .08, .13); [-.035, .04].forEach(z => g.add(M(new THREE.CylinderGeometry(.084, .084, .03, 14).rotateX(Math.PI / 2), inkMat, 0, 0, z))); g.add(M(new THREE.SphereGeometry(.05, 10, 8), inkMat, 0, .01, .13)); const wm = L('#FFFFFF', { transparent: true, opacity: .8 }); const w = [-1, 1].map(s => { const p = new THREE.Group(); p.position.set(s * .03, .06, 0); const m = M(unit, wm, s * .08, 0, 0, false); m.scale.set(.09, .008, .05); p.add(m); g.add(p); return p; }); g.visible = false; g.scale.setScalar(1.5); scene.add(g); return { g, w, mode: 'off', pos: new THREE.Vector3(), prev: new THREE.Vector3(), vel: new THREE.Vector3(), id: null, t: 0, ang: 0, yaw: 0 }; })();
  function pick(id) { bee.id = id; bee.mode = 'in'; bee.pos.set(-3.2, 3.6, 5.5); bee.vel.set(1.5, 0, -1.5); bee.g.visible = true; pickId = null; }
  function updBee(dt, t) {
    if (bee.mode === 'off') return; const fl = flowers.get(bee.id); bee.prev.copy(bee.pos);
    const steer = (tgt, max) => { v1.subVectors(tgt, bee.pos); const d = v1.length(); v1.multiplyScalar(Math.min(max, d * 2.5 + .3) / Math.max(d, .001)); v1.y += Math.sin(t * 9) * .5; v1.x += Math.sin(t * 6.3) * .4; bee.vel.lerp(v1, 1 - Math.exp(-dt * 4)); bee.pos.addScaledVector(bee.vel, dt); return d; };
    if (bee.mode === 'in') { if (!fl || fl.fly) bee.mode = 'out'; else { v2.copy(fl.headW); v2.x += .45; v2.y += .25; if (steer(v2, 3.4) < .14) { bee.mode = 'hover'; bee.t = 0; bee.ang = 0; pickId = bee.id; cb.onPickArrive && cb.onPickArrive(bee.id); } } }
    else if (bee.mode === 'hover') { if (!fl || fl.fly) bee.mode = 'out'; else { bee.t += dt; bee.ang += dt * 2.6; v2.copy(fl.headW); v2.x += Math.cos(bee.ang) * .45; v2.y += .22 + Math.sin(t * 5) * .05; v2.z += Math.sin(bee.ang) * .45; bee.pos.lerp(v2, 1 - Math.exp(-dt * 10)); if (bee.t > 3.6) { bee.mode = 'out'; pickId = null; } } }
    else { pickId = null; v2.set(4.5, 4.2, -3); if (steer(v2, 3.6) < .5) { bee.mode = 'off'; bee.g.visible = false; } }
    v1.subVectors(bee.pos, bee.prev); if (v1.lengthSq() > 1e-7) { let dy = Math.atan2(v1.x, v1.z) - bee.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); bee.yaw += dy * Math.min(1, dt * 10); }
    bee.g.position.copy(bee.pos); bee.g.rotation.set(0, bee.yaw, 0); const a = .25 + Math.sin(t * 95) * .65; bee.w[0].rotation.z = -a; bee.w[1].rotation.z = a;
  }

  // fireflies
  const ffm = [], ff = Array.from({ length: 10 }, (_, i) => { const x = -2.4 + sr() * 4.8, z = -3.5 + sr() * 6.5, m1 = B('#FFE08A', { transparent: true, opacity: 0 }), m2 = B('#FFE08A', { transparent: true, opacity: 0 }); ffm.push([m1, m2]); const g = new THREE.Group(); A(g, M(unit, m1, 0, 0, 0, false)).scale.setScalar(.04); A(g, M(unit, m2, 0, 0, 0, false)).scale.setScalar(.12); scene.add(g); return { g, x, z, y: gy(x, z) + .5 + sr() * 1.1, i }; });

  const wind = (x, z, t, amp) => amp * (Math.sin(t * 1.15 + x * .7 + z * .45) * .6 + Math.sin(t * 2.4 + x * 1.4 - z * .3) * .25 + Math.pow(Math.max(0, Math.sin(t * .23 + x * .2)), 6) * .8);

  function updFlower(f, dt, t, amp, snap) {
    const d = f.d, g = f.g;
    if (f.fly) { const a = f.fly; a.t += dt / 1.25; const e = a.t < 1 ? a.t * a.t * (3 - 2 * a.t) : 1; g.position.lerpVectors(a.from, winPos, e); g.position.y += Math.sin(Math.PI * e) * 2.4; g.scale.setScalar(1 - .86 * e); g.rotation.y += dt * 9; f.label.style.opacity = 0; if (a.t >= 1) { burst(winPos, petCol(d), 18); winFlash = 1; const id = f.id; removeFlower(f); cb.onPressed && cb.onPressed(id); } return; }
    if (!f.placed) { f.x = f.tx; f.z = f.tz; f.placed = true; }
    const pl = snap ? 60 : 3.2; f.x = damp(f.x, f.tx, pl, dt); f.z = damp(f.z, f.tz, pl, dt); g.position.set(f.x, gy(f.x, f.z) - .02, f.z); f.dim = damp(f.dim || 0, sel != null && sel !== f.id ? 1 : 0, snap ? 60 : 6, dt); g.scale.setScalar(1 - .65 * f.dim);
    if (f.delay > 0) { f.delay -= dt; return; } g.visible = true;
    const S = ST[d.st];
    f.grow = damp(f.grow, 1, snap ? 60 : 2.2, dt); f.H = damp(f.H, stemH(d), snap ? 60 : 3, dt); const H = f.H * f.grow;
    if (snap) { f.open = S.open; f.ov = 0; f.hs = S.hs; f.hv = 0; f.tagS = d.st === 4 ? 1 : 0; f.tv = 0; f.cen = S.cen; f.tilt = S.tilt; }
    else { f.ov += ((S.open - f.open) * 70 - f.ov * 10) * dt; f.open += f.ov * dt; f.hv += ((S.hs * (hoverId === f.id ? 1.1 : 1) - f.hs) * 90 - f.hv * 9) * dt; f.hs += f.hv * dt; const ts = d.st === 4 ? 1 : 0; f.tv += ((ts - f.tagS) * 90 - f.tv * 10) * dt; f.tagS += f.tv * dt; f.cen = damp(f.cen, S.cen, 5, dt); f.tilt = damp(f.tilt, S.tilt, 3.5, dt); }
    f.tag.visible = f.tagS > .02 && opt.layout !== 'Tall stems'; f.tag.scale.setScalar(Math.max(.001, f.tagS * .9));
    const L1 = H * .5; f.s1.scale.y = Math.max(.001, L1); f.s2.scale.y = Math.max(.001, L1); f.seg2.position.y = L1; f.head.position.y = L1;
    const w = wind(f.x, f.z, t, amp), w2 = wind(f.z + 3, f.x - 2, t * .9 + 1.7, amp);
    f.seg1.rotation.set(w2 * .03, 0, w * .06); f.seg2.rotation.set(w2 * .05, 0, w * .1); f.head.rotation.set(f.tilt + w2 * .05, 0, -w * .12); { const ct = Math.cos(f.tilt), sn = Math.sin(f.tilt); f.tag.position.set(0, .95 * ct - .25 * sn, -.95 * sn - .25 * ct); f.tag.rotation.set(-f.tilt - .2, 0, 0); }
    f.headIn.scale.setScalar(Math.max(.001, f.hs * f.grow));
    const pr = PRS[opt.petalShape] || PRS.Daisy, bk = 1 - clamp((f.open - .16) / 1.22, 0, 1) * .25;
    for (const [inn, m] of f.pets) { inn.rotation.x = -f.open; m.scale.set(pr[0] * bk, .035, pr[1]); m.position.set(0, 0, .12 + pr[1] * .92); }
    const cs = Math.max(.001, f.cen); f.center.scale.set(cs, cs * .55, cs);
    f.leaves.forEach((lf, m) => { const s = d.v[m], tg = opt.voteLeaves ? (s === 1 ? 1 : s === 2 ? .6 : .24) : (m < 2 ? .85 : 0); lf.s = damp(lf.s, tg * f.grow, snap ? 60 : 6, dt); lf.pv.scale.setScalar(Math.max(.001, lf.s)); lf.pv.position.y = [.6, .12, .62][m] * L1; tmpC.set(opt.voteLeaves && s ? MC[m] : '#000000'); if (!(opt.voteLeaves && s)) tmpC.copy(cur.stem); lf.mat.color.lerp(tmpC, snap ? 1 : 1 - Math.exp(-dt * 6)); });
    f.hit.scale.set(.6, Math.max(.05, H), .6); { const hr = (.3 + .4 * clamp((1.38 - f.open) / 1.22, 0, 1)) * Math.max(.2, f.hs * f.grow); f.hit2.scale.set(hr, .3, hr); const ph = hits.indexOf(f.plaque); if (f.tag.visible && ph < 0) hits.push(f.plaque); else if (!f.tag.visible && ph >= 0) hits.splice(ph, 1); }
    const on = sel === f.id ? .95 : pickId === f.id ? .55 + .45 * Math.sin(t * 7) : 0; f.ringO = damp(f.ringO, on, 8, dt); f.ring.material.opacity = f.ringO; f.ring.visible = f.ringO > .01; f.ring.scale.setScalar(1.35 * (pickId === f.id ? 1 + .12 * Math.sin(t * 7) : 1));
    g.updateMatrixWorld(true); f.headIn.localToWorld(f.headW.set(0, .1, 0));
  }

  // camera
  const basePos = new THREE.Vector3(0, 6.6, 13.5), baseLook = new THREE.Vector3(0, 1.3, -1.2), introPos = new THREE.Vector3(0, 11, 21), introLook = new THREE.Vector3(0, 7, -12);
  const camPos = introPos.clone(), camLook = introLook.clone(), posT = new THREE.Vector3(), lookT = new THREE.Vector3();
  let px = 0, py = 0, pxs = 0, pys = 0, drag = null, yawT = 0, yaw = 0, moved = 0, t0 = 0, tNow = 0;
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  const pickAt = () => {
    ray.setFromCamera(ndc, camera);
    const roots = [...flowers.values()].filter(f => !f.fly && f.g.visible).map(f => f.g);
    for (const h of ray.intersectObjects(roots, true)) { if (h.object.userData.proxy) continue; let o = h.object, vis = true, id = null; while (o) { vis = vis && o.visible; if (id == null && o.userData.id != null) id = o.userData.id; o = o.parent; } if (vis && id != null) return id; }
    const h2 = ray.intersectObjects(hits, false)[0]; return h2 ? h2.object.userData.id : null;
  };
  const onMove = e => { const r = cv.getBoundingClientRect(); px = ((e.clientX - r.left) / r.width) * 2 - 1; py = ((e.clientY - r.top) / r.height) * 2 - 1; if (drag) { const dx = e.clientX - drag.x; moved = Math.max(moved, Math.abs(dx) + Math.abs(e.clientY - drag.y)); yawT = clamp(drag.y0 - dx * .006, -.7, .7); } else { ndc.set(px, -py); hoverId = pickAt(); cv.style.cursor = hoverId != null ? 'pointer' : 'grab'; } };
  const onDown = e => { drag = { x: e.clientX, y: e.clientY, y0: yawT }; moved = 0; cv.style.cursor = 'grabbing'; try { cv.setPointerCapture(e.pointerId); } catch (_) { } };
  const onUp = e => { if (drag && moved < 7) { const r = cv.getBoundingClientRect(); ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); cb.onSelect && cb.onSelect(pickAt()); } drag = null; yawT = 0; cv.style.cursor = 'grab'; };
  const onLeave = () => { px = 0; py = 0; hoverId = null; };
  cv.addEventListener('pointermove', onMove); cv.addEventListener('pointerdown', onDown); cv.addEventListener('pointerup', onUp); cv.addEventListener('pointerleave', onLeave);

  const proj = (v, el, tall) => { v.project(camera); el.style.transform = `translate(${((v.x * .5 + .5) * VW).toFixed(1)}px,${((-v.y * .5 + .5) * VH).toFixed(1)}px) translate(-50%,${tall ? '-100%' : '5px'})`; };
  let raf = 0, last = performance.now(), petT = 0, sunO = 1, pillOrder = [];
  function frame(now) {
    raf = requestAnimationFrame(frame);
    const dt = Math.max(0, Math.min(.05, (now - last) / 1000)); last = now; tNow += dt; const t = tNow;
    const still = opt.motion === 'Still', lively = opt.motion === 'Lively', amp = still ? 0 : lively ? 2 : 1, T = TH[opt.time] || TH.Day, k = 1 - Math.exp(-dt * 2.2);
    for (const key of ['sky', 'fol', 'haze', 'hemiS', 'hemiG', 'sunC', 'pane', 'sunPet', 'stem']) cur[key].lerp(tmpC.set(T[key]), k);
    for (const key of ['hemi', 'sun', 'sunY', 'night', 'win']) cur[key] = damp(cur[key], T[key], 2.2, dt);
    scene.background.copy(cur.sky); scene.fog.color.copy(cur.haze); for (const m of tintMats) m.color.copy(cur.fol); farMat.color.set('#86B870').multiply(cur.fol); bushMat.color.set('#7DB95A').multiply(cur.fol); hemi.color.copy(cur.hemiS); hemi.groundColor.copy(cur.hemiG); hemi.intensity = cur.hemi; sunL.color.copy(cur.sunC); sunL.intensity = cur.sun;
    paneMat.color.copy(cur.pane); sunPetMat.color.copy(cur.sunPet); stemMat.color.copy(cur.stem); winLight.intensity = cur.win + winFlash * 14; starMat.opacity = cur.night;
    winFlash = Math.max(0, winFlash - dt * 1.6); winPane.scale.setScalar(1 + winFlash * .6);
    sunG.position.y = cur.sunY; if (!still) sunG.rotation.z -= dt * .05;
    clouds.forEach(c => { if (!still) { c.g.position.x += c.sp * dt; if (c.g.position.x > 34) c.g.position.x = -34; } c.g.visible = cur.night < .85; c.g.scale.setScalar(c.s * (1 - cur.night * .6)); });
    smoke.forEach((m, i) => { const p = ((still ? 0 : t * .16) + i / 6) % 1, s = .12 + .32 * p; m.position.set(chimPos.x + Math.sin(p * 5 + i) * .12 - p * p * .9, chimPos.y + p * 2.3, chimPos.z); m.scale.set(s, s * .85, s); smokeMats[i].opacity = (1 - p) * .9; });
    uT.value = t; uA.value = amp;
    flowers.forEach(f => updFlower(f, dt, t, amp, still && t - t0 > .3));
    { let fi = 0; flowers.forEach(f => { if (fi < 16 && !f.fly && f.g.visible) uF.value[fi++].set(f.x, f.z, Math.min(1, f.grow * 1.6)); }); for (; fi < 16; fi++) uF.value[fi].z = 0; }
    pend = pend.filter(p => { p.t -= dt; if (p.t > 0) return true; const f = flowers.get(p.id); if (f && !still) burst(f.headW, p.c || petCol(f.d), 16); return false; });
    const nFly = still ? 0 : lively ? 4 : 2;
    flies.forEach((b, i) => { const on = i < nFly && cur.night < .5; b.vis = damp(b.vis, on ? 1 : 0, 4, dt); b.g.visible = b.vis > .02; b.g.scale.setScalar(Math.max(.001, b.vis)); if (b.g.visible) updFly(b, dt, t); });
    updBee(dt, t);
    ff.forEach((o, i) => { const a = still ? 0 : cur.night * (.3 + .7 * (.5 + .5 * Math.sin(t * 2.2 + i * 1.7))); ffm[i][0].opacity = a; ffm[i][1].opacity = a * .25; o.g.visible = a > .01; o.g.position.set(o.x + Math.sin(t * .6 + i) * .5, o.y + Math.sin(t * .9 + i * 2) * .25, o.z + Math.cos(t * .5 + i * 1.3) * .5); });
    if (lively) { petT -= dt; if (petT < 0) { petT = .7; v1.set(rnd(-4, 0), rnd(2.5, 4.5), rnd(-4, 2)); burst(v1, '#FFFFFF', 1, true); } }
    parts.forEach(q => { if (q.life <= 0) return; q.life -= dt; if (q.life <= 0) { q.m.visible = false; return; } q.v.y -= q.g * dt; q.v.multiplyScalar(1 - (q.g > 1 ? 1.6 : .1) * dt); q.v.x += Math.sin(t * 8 + q.ph) * 1.5 * dt; q.m.position.addScaledVector(q.v, dt); q.m.rotation.x += dt * 6; q.m.rotation.z += dt * 4; const s = Math.min(1, q.life / .4); q.m.scale.set(.07 * s, .018 * s, .13 * s); });

    const fs = sel != null ? flowers.get(sel) : null;
    if (fs && !fs.fly) { lookT.set(fs.x, gy(fs.x, fs.z) + .55, fs.z); posT.set(fs.x - Math.sign(fs.x || 1) * 2.6, 6.0, fs.z + 6.2); } else { lookT.copy(baseLook); posT.copy(basePos); }
    const ie = still ? 1 : clamp((t - t0) / 3, 0, 1), e = 1 - Math.pow(1 - ie, 3);
    posT.lerpVectors(introPos, posT, e); lookT.lerpVectors(introLook, lookT, e);
    const ck = still ? 1 : 1 - Math.exp(-dt * 2.6); camPos.lerp(posT, ck); camLook.lerp(lookT, ck);
    yaw = damp(yaw, yawT, 5, dt); pxs = damp(pxs, still ? 0 : px, 3, dt); pys = damp(pys, still ? 0 : py, 3, dt);
    v1.copy(camPos).sub(camLook).applyAxisAngle(UP, yaw - pxs * .04); camera.position.copy(camLook).add(v1);
    camera.position.x += Math.sin(t * .25) * .2 * Math.min(1, amp); camera.position.y += -pys * .3 + Math.sin(t * .31) * .08 * Math.min(1, amp); camera.lookAt(camLook);
    camera.updateMatrixWorld();

    const tall = opt.layout === 'Tall stems'; camR.set(1, 0, 0).applyQuaternion(camera.quaternion);
    const pills = [];
    flowers.forEach(f => {
      if (f.fly) return;
      const txt = tall ? (f.d.d ? String(f.d.d) : 'New') : f.d.s;
      if (txt !== f.txt) { f.txt = txt; const p = txt.split('|'); f.label.innerHTML = p[0] + (p[1] ? '<br><span style="color:var(--pink,#9C2580)">' + p[1] + '</span>' : '') + (tall ? '' : '<i style="position:absolute;left:50%;bottom:-4px;width:9px;height:9px;margin-left:-4.5px;background:inherit;transform:rotate(45deg);border-radius:2px"></i>'); f.label.setAttribute('aria-label', f.d.t); f.lw = f.label.offsetWidth || 60; f.lh = f.label.offsetHeight || 16; }
      const on = f.grow > .6 && f.delay <= 0 && (tall ? (sel == null || sel === f.id) : (sel == null && (f.id === hoverId || f.id === pickId)));
      f.label.style.opacity = on ? 1 : 0; if (!on) return;
      v1.copy(f.headW).project(camera); const sx = (v1.x * .5 + .5) * VW, sy = (-v1.y * .5 + .5) * VH;
      v2.copy(f.headW).addScaledVector(camR, (.25 + .37 * clamp((1.38 - f.open) / 1.22, 0, 1)) * f.hs).project(camera); const rr = Math.abs((v2.x * .5 + .5) * VW - sx) + 3, lf = f.x < 0, ax = lf ? sx + rr : sx - rr, x0 = lf ? ax : ax - f.lw;
      if (!tall) { let top = sy; for (const [inn, m] of f.pets) { v2.set(0, 0, m.position.z + m.scale.z); inn.localToWorld(v2).project(camera); top = Math.min(top, (-v2.y * .5 + .5) * VH); } if (f.tag.visible) { v2.set(0, -.12, 0); f.tag.localToWorld(v2).project(camera); top = Math.min(top, (-v2.y * .5 + .5) * VH); } f.label.style.transform = `translate(${clamp(sx, f.lw / 2 + 6, VW - f.lw / 2 - 6).toFixed(1)}px,${(top - 7).toFixed(1)}px) translate(-50%,-100%)`; return; }
      pills.push({ f, x0, x1: x0 + f.lw, y: sy, t: sy, h: f.lh, lf, ax });
    });
    // keep pills off each other: a remembered top-to-bottom order (swapped only past 12px, so near-equal pairs never flip), then stack downwards in one pass
    const byId = new Map(pills.map(p => [p.f.id, p]));
    pillOrder = pillOrder.filter(id => byId.has(id));
    pills.forEach(p => { if (pillOrder.includes(p.f.id)) return; let k = 0; while (k < pillOrder.length && byId.get(pillOrder[k]).y <= p.y) k++; pillOrder.splice(k, 0, p.f.id); });
    for (let sw = true, g = 0; sw && g < 12; g++) { sw = false; for (let k = 0; k + 1 < pillOrder.length; k++) { const p = byId.get(pillOrder[k]), q = byId.get(pillOrder[k + 1]); if (p.y - q.y > 12) { pillOrder[k] = q.f.id; pillOrder[k + 1] = p.f.id; sw = true; } } }
    const placed = [];
    pillOrder.forEach(id => { const p = byId.get(id); let y = p.y; for (const q of placed) if (!(p.x1 < q.x0 || q.x1 < p.x0)) y = Math.max(y, q.t + (q.h + p.h) / 2 + 3); p.t = y; placed.push(p); });
    pills.forEach(p => { const f = p.f; f.ly = damp(f.ly || 0, p.t - p.y, still ? 60 : 12, dt); f.label.style.transform = `translate(${p.ax.toFixed(1)}px,${(p.y + f.ly).toFixed(1)}px) translate(${p.lf ? '0' : '-100%'},-50%)`; });
    sunO = damp(sunO, sel != null ? 0 : 1, 4, dt); sunG.traverse(o => { if (o.material) { o.material.transparent = true; o.material.opacity = sunO; } });
    renderer.render(scene, camera);
  }
  raf = requestAnimationFrame(frame);

  return {
    setIdeas, setOptions, pick,
    select(id) { sel = id; },
    restart() { [...flowers.values()].forEach(removeFlower); pend = []; t0 = tNow; camPos.copy(introPos); camLook.copy(introLook); bee.mode = 'off'; bee.g.visible = false; pickId = null; },
    dispose() { cancelAnimationFrame(raf); ro.disconnect(); cv.removeEventListener('pointermove', onMove); cv.removeEventListener('pointerdown', onDown); cv.removeEventListener('pointerup', onUp); cv.removeEventListener('pointerleave', onLeave); renderer.dispose(); cv.remove(); }
  };
}
