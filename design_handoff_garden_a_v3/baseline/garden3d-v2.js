// SomeDaisy 3D garden scene, v2. Adds to v1: seasons, lawn styles, house paint and textures, earned extras, a watering can, a visiting friend's butterfly, the gallery hallway inside the house, a sky dome with clouds, stars and shooting stars, and a valley round the hilltop.
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
// sky per time of day: gradient from the horizon haze (c0) up to the zenith (c3), glow around the sun, cloud top and base colors, cloud opacity, wisp strength
const SKY = {
  Day: { c0: '#DDE6FF', c1: '#B9D7FF', c2: '#8CBCFF', c3: '#5A97EE', glow: '#FFF3D6', gk: .12, ct: '#FFFFFF', cb: '#C2D0EE', ca: .97, wk: .5 },
  Dusk: { c0: '#FFC79E', c1: '#FFB0A8', c2: '#C79BE8', c3: '#6E78D6', glow: '#FF9A5C', gk: .8, ct: '#FFC2A8', cb: '#F08A8A', ca: .97, wk: .7 },
  Night: { c0: '#2C2452', c1: '#1F1840', c2: '#15102E', c3: '#0B0820', glow: '#B79CFF', gk: .15, ct: '#403A7A', cb: '#1D1838', ca: .6, wk: .25 }
};
const SLOTS = [[-1.15, 4.1], [1.15, 3.45], [-1.4, 2.75], [1.4, 2.1], [-1.0, 1.4], [1.75, .7], [-1.9, 0], [1.05, -.7], [-1.15, -1.4], [2.0, -2.1], [-2.2, -2.8], [1.2, -3.3]];
const EXTRA = { 13: [1.2, 4.3], 12: [-.6, 3.4], 15: [.5, 4.45] };
const ST = { 1: { open: 1.38, cen: .25, tilt: .12, hs: .8 }, 2: { open: .8, cen: .8, tilt: .5, hs: .93 }, 3: { open: .16, cen: 1, tilt: .95, hs: 1 }, 4: { open: .16, cen: 1, tilt: .95, hs: 1 } };
const PRS = { Daisy: [.105, .27], Round: [.15, .225], Slim: [.07, .31] };
// gallery wall inside the house: [x, y, width, height, round, frame color, bar width]; slots fill in this order, oldest memory first
const SLOT = [[0, 2.1, .56, .7, 0, '#E8B923', .05], [.58, 1.9, .42, .56, 0, '#8A4BE6', .032], [-.57, 1.86, .4, .4, 0, '#FFFFFF', .042], [0, 1.47, .56, .4, 0, '#2C2040', .028], [-.57, 2.42, .4, .5, 0, '#FFD9C7', .05], [.57, 2.48, .38, .38, 0, '#1FA98A', .032], [0, 2.76, .38, .38, 1, '#E8B923', .032], [.56, 1.37, .42, .32, 0, '#F7C9EA', .04], [-.56, 1.36, .34, .44, 1, '#8A4BE6', .032], [0, .99, .36, .36, 0, '#FFFFFF', .036], [-.52, .87, .3, .3, 0, '#E8B923', .03], [.53, .9, .3, .3, 1, '#2C2040', .03]];
const ROWS = ['New', 'Waiting', "Everyone's in", 'Planned'];

export function createGarden(host, labelHost, cb = {}) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  const cv = renderer.domElement; cv.style.cssText = 'display:block;width:100%;height:100%;touch-action:none;cursor:grab'; host.appendChild(cv);
  const glowEl = document.createElement('div'); glowEl.style.cssText = 'position:absolute;inset:0;pointer-events:none;opacity:0;background:radial-gradient(circle at 50% 46%,#FFF8E0 0%,#FFE08A 75%)'; host.appendChild(glowEl);
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

  let opt = { layout: 'Meadow', time: 'Day', motion: 'Gentle', petals: 'List color', petalShape: 'Daisy', voteLeaves: true, names: true, season: 'Summer', lawn: 'Soft', roof: '#8A4BE6', walls: '#FFFFFF', door: '#6D2FC4', bench: false, bath: false, lights: false };
  const uSe = { value: new THREE.Vector4() }, uLawn = { value: new THREE.Vector3(1, 0, 0) }; // season weights (spring, autumn, winter); lawn (height, stripes, wildflowers)
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
  groundMat.onBeforeCompile = s => {
    s.uniforms.uSe = uSe; s.uniforms.uLawn = uLawn;
    s.vertexShader = 'varying vec3 gWp;\n' + s.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\ngWp = (modelMatrix * vec4(position, 1.)).xyz;');
    s.fragmentShader = 'varying vec3 gWp; uniform vec4 uSe; uniform vec3 uLawn;\n' + s.fragmentShader.replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.rgb *= 1. + uLawn.y * .13 * clamp(sin(gWp.x * 2.6 + .4) * 6., -1., 1.);\ndiffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(1.4, 1.02, .6), uSe.y * .8);\ndiffuseColor.rgb = mix(diffuseColor.rgb, diffuse * vec3(.74, .8, .95), uSe.z * .92);');
  };

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
  // (clouds and stars are built with the rest of the wider world, further down)
  for (let i = 0; i < 260; i++) sr(); // 260 seeded values were once spent on stars here; spending them still keeps every tree and blade below exactly where it was
  

  // house
  const HZ = -5.2, house = new THREE.Group(); house.position.set(0, gy(0, HZ) - .05, HZ); scene.add(house);
  // painted textures: clapboard walls, shingles, door planks, chimney brick. All white-based, so the paint colors still tint them
  const ptex = (w, h, draw, rx, ry, rot) => { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rx, ry); t.anisotropy = 8; if (rot) t.rotation = rot; return t; };
  const board = (x, w, h) => { const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#FFFFFF'); g.addColorStop(.8, '#F1ECF6'); g.addColorStop(1, '#E2DAEC'); x.fillStyle = g; x.fillRect(0, 0, w, h); x.fillStyle = 'rgba(70,50,100,.34)'; x.fillRect(0, h - 5, w, 5); for (let i = 0; i < 70; i++) { x.fillStyle = i % 2 ? 'rgba(255,255,255,.5)' : 'rgba(70,50,100,.06)'; x.fillRect(Math.random() * w, Math.random() * (h - 8), 2 + Math.random() * 14, 1); } };
  const wallMat = L('#FFFFFF', { map: ptex(128, 64, board, 2, 12) }), gableMat = L('#8A4BE6', { map: ptex(128, 64, board, .5, 1 / .15) });
  const roofMat = L('#8A4BE6', { map: ptex(128, 128, (x, w, h) => { for (let r = 0; r < 4; r++) for (let i = -1; i < 4; i++) { const v = 200 + Math.random() * 55 | 0, px = (i + (r % 2) * .5) * w / 4; x.fillStyle = `rgb(${v},${v},${v})`; x.fillRect(px, r * h / 4, w / 4 + 1, h / 4); x.fillStyle = 'rgba(40,20,70,.3)'; x.fillRect(px, r * h / 4, 2, h / 4); } for (let r = 0; r < 4; r++) { x.fillStyle = 'rgba(40,20,70,.42)'; x.fillRect(0, r * h / 4, w, 4); } }, 1, 1, Math.PI / 2) });
  const doorFaceMat = L('#6D2FC4', { map: ptex(64, 64, (x, w, h) => { x.fillStyle = '#FFFFFF'; x.fillRect(0, 0, w, h); const g = x.createLinearGradient(0, 0, w, 0); g.addColorStop(0, 'rgba(30,10,60,.4)'); g.addColorStop(.1, 'rgba(30,10,60,0)'); g.addColorStop(.88, 'rgba(30,10,60,0)'); g.addColorStop(1, 'rgba(30,10,60,.28)'); x.fillStyle = g; x.fillRect(0, 0, w, h); for (let i = 0; i < 24; i++) { x.fillStyle = 'rgba(30,10,60,.08)'; x.fillRect(5 + Math.random() * (w - 10), Math.random() * h, 1, 8 + Math.random() * 28); } }, 1 / .155, 1.3) });
  const brickTex = ptex(64, 64, (x, w, h) => { for (let r = 0; r < 4; r++) for (let i = -1; i < 2; i++) { const v = 212 + Math.random() * 43 | 0, px = (i + (r % 2) * .5) * w / 2; x.fillStyle = `rgb(${v},${v},${v})`; x.fillRect(px, r * h / 4, w / 2 + 1, h / 4); x.fillStyle = 'rgba(90,50,110,.4)'; x.fillRect(px, r * h / 4, 3, h / 4); x.fillRect(px, r * h / 4, w / 2 + 1, 3); } }, 2, 4);
  let roofSnow; house.add(M(new THREE.BoxGeometry(3, 1.8, 2.2), wallMat, 0, .9, 0));
  { const s = new THREE.Shape(); s.moveTo(-1.8, 0); s.lineTo(1.8, 0); s.lineTo(0, 1.35); s.closePath(); house.add(M(new THREE.ExtrudeGeometry(s, { depth: 2.6, bevelEnabled: false }), [gableMat, roofMat], 0, 1.8, -1.3)); roofSnow = M(new THREE.ExtrudeGeometry(s, { depth: 2.5, bevelEnabled: false }), L('#FFFFFF'), 0, 1.84, -1.25); roofSnow.visible = false; house.add(roofSnow); }
  const doorMat = L('#6D2FC4'), trimMat = L('#B49FCF'), paneMat = B('#CFE3FF');
  const doorG = new THREE.Group(), glowMat = B('#FFE08A'); doorG.position.set(-.91, 0, 1.11); house.add(doorG); { const ds = new THREE.Shape(); ds.moveTo(0, 0); ds.lineTo(.62, 0); ds.lineTo(.62, 1.0); ds.absarc(.31, 1.0, .31, 0, Math.PI, false); ds.lineTo(0, 0); doorG.add(M(new THREE.ExtrudeGeometry(ds, { depth: .08, bevelEnabled: false, curveSegments: 14 }), [doorFaceMat, doorMat], 0, 0, -.04)); }
  house.add(M(new THREE.PlaneGeometry(.6, 1.0), glowMat, -.6, .5, 1.104, false)); house.add(M(new THREE.CircleGeometry(.3, 24), glowMat, -.6, 1.0, 1.104, false));
  [.24, .8].forEach(y => doorG.add(M(new THREE.BoxGeometry(.3, .035, .02), trimMat, .16, y, .05, false)));
  doorG.add(M(new THREE.SphereGeometry(.045, 10, 8), L('#E8B923'), .49, .55, .06));
  const doorHitM = new THREE.Mesh(new THREE.BoxGeometry(1.05, 1.7, .5), new THREE.MeshBasicMaterial({ visible: false })); doorHitM.position.set(-.6, .8, 1.25); house.add(doorHitM); // generous tap area for the door
  house.add(M(new THREE.BoxGeometry(.9, .12, .4), L('#F6F0FB'), -.6, .06, 1.32));
  house.add(M(new THREE.BoxGeometry(.74, .62, .06), paneMat, .72, 1.05, 1.11, false));
  [[.72, 1.39, .84, .07], [.72, .71, .84, .07]].forEach(a => house.add(M(new THREE.BoxGeometry(a[2], a[3], .1), trimMat, a[0], a[1], 1.12)));
  [[.33, 1.05], [1.11, 1.05], [.72, 1.05]].forEach((a, i) => house.add(M(new THREE.BoxGeometry(i === 2 ? .04 : .07, .68, .1), trimMat, a[0], a[1], 1.12)));
  house.add(M(new THREE.BoxGeometry(.74, .04, .1), trimMat, .72, 1.05, 1.12));
  house.add(M(new THREE.BoxGeometry(.9, .17, .22), L('#FFD9C7'), .72, .58, 1.2));
  [.42, .62, .82, 1.02].forEach((x, i) => A(house, M(unit, bushMat, x, .7, 1.22)).scale.setScalar(.1 + (i % 2) * .02));
  const winPane = M(new THREE.CylinderGeometry(.3, .3, .06, 28).rotateX(Math.PI / 2), paneMat, 0, 2.3, 1.31, false); house.add(winPane);
  house.add(M(new THREE.TorusGeometry(.3, .05, 8, 32), white, 0, 2.3, 1.33));
  house.add(M(new THREE.BoxGeometry(.42, .95, .42), L('#F7C9EA', { map: brickTex }), -.95, 2.55, -.2));
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

  // extras the group earns: bench, birdbath, string lights
  const onGround = (g, x, z, ry) => { const y = gy(x, z); g.position.set(x, y - .01, z); g.quaternion.setFromUnitVectors(UP, v1.set(x, y + R, z - CZ).normalize()); g.rotateY(ry); g.visible = false; scene.add(g); return g; };
  const benchG = onGround(new THREE.Group(), 2.45, -.75, -.6), bathG = onGround(new THREE.Group(), -2.5, -1.5, 0), lightG = new THREE.Group(); lightG.visible = false; scene.add(lightG);
  [-.13, 0, .13].forEach(z => benchG.add(M(new THREE.BoxGeometry(1.14, .04, .11), white, 0, .4, z)));
  [.56, .7].forEach(y => { const b = M(new THREE.BoxGeometry(1.14, .1, .035), white, 0, y, -.2 - (y - .4) * .1); b.rotation.x = -.1; benchG.add(b); });
  [-.5, .5].forEach(x => { benchG.add(M(new THREE.BoxGeometry(.06, .54, .06), trimMat, x, .27, .16)); const p = M(new THREE.BoxGeometry(.06, .8, .06), trimMat, x, .39, -.2); p.rotation.x = -.1; benchG.add(p); benchG.add(M(new THREE.BoxGeometry(.07, .04, .46), trimMat, x, .55, -.02)); });
  bathG.add(M(new THREE.CylinderGeometry(.2, .25, .07, 20), stoneMat, 0, .035, 0)); bathG.add(M(new THREE.CylinderGeometry(.06, .1, .5, 14), stoneMat, 0, .32, 0)); bathG.add(M(new THREE.CylinderGeometry(.38, .1, .15, 28), stoneMat, 0, .645, 0));
  A(bathG, M(new THREE.TorusGeometry(.375, .028, 8, 36), stoneMat, 0, .72, 0)).rotation.x = Math.PI / 2; A(bathG, M(new THREE.CircleGeometry(.35, 28), L('#8EC5FF'), 0, .73, 0, false)).rotation.x = -Math.PI / 2;
  const bird = new THREE.Group(), birdIn = new THREE.Group(), birdMat = L('#2F7BE8'); bird.position.set(.3, .75, .16); bird.rotation.y = -2.06; bird.scale.setScalar(1.25); bird.add(birdIn); bathG.add(bird);
  A(birdIn, M(unit, birdMat, 0, .06, 0)).scale.set(.06, .055, .09); A(birdIn, M(unit, birdMat, 0, .12, .07)).scale.setScalar(.042); A(birdIn, M(unit, L('#FFD9C7'), 0, .045, .03)).scale.set(.045, .04, .06);
  birdIn.add(M(new THREE.ConeGeometry(.014, .045, 6).rotateX(Math.PI / 2), L(CEN), 0, .118, .125)); { const tl = M(new THREE.BoxGeometry(.035, .008, .09), birdMat, 0, .075, -.11); tl.rotation.x = .35; birdIn.add(tl); }
  const wireMat = new THREE.LineBasicMaterial({ color: INK, transparent: true, opacity: 0 }), bulbMat = B('#FFFFFF', { transparent: true, opacity: 0 }), haloMat = B('#FFE08A', { transparent: true, opacity: 0, depthWrite: false });
  { const SP = [[[-2.9, 1.5, -5.4], [-1.8, 1.2, -3.9], .22], [[-1.8, 1.2, -3.9], [1.8, 1.2, -3.9], .3], [[1.8, 1.2, -3.9], [2.85, 1.3, -5.1], .2]], wireP = [], bulbP = [], cols = ['#FFE08A', '#F7C9EA', '#CFE3FF', '#FFD9C7'];
    const cat = (a, b, sag, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t - sag * 4 * t * (1 - t), a[2] + (b[2] - a[2]) * t];
    SP.forEach(([a, b, sag]) => { for (let i = 0; i <= 20; i++) wireP.push(...cat(a, b, sag, i / 20)); const n = Math.round(Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]) / .32); for (let i = 0; i < n; i++) bulbP.push(cat(a, b, sag, (i + .5) / n)); });
    const wg = new THREE.BufferGeometry(); wg.setAttribute('position', new THREE.Float32BufferAttribute(wireP, 3)); lightG.add(new THREE.Line(wg, wireMat));
    const bulbs = new THREE.InstancedMesh(unit, bulbMat, bulbP.length), halos = new THREE.InstancedMesh(unit, haloMat, bulbP.length);
    bulbP.forEach((p, i) => { dummy.position.set(p[0], p[1] - .05, p[2]); dummy.scale.setScalar(.05); dummy.updateMatrix(); bulbs.setMatrixAt(i, dummy.matrix); bulbs.setColorAt(i, new THREE.Color(cols[i % 4])); dummy.scale.setScalar(.15); dummy.updateMatrix(); halos.setMatrixAt(i, dummy.matrix); });
    bulbs.frustumCulled = halos.frustumCulled = false; lightG.add(bulbs, halos); }
  const decor = [{ g: benchG, k: 'bench', s: 0, v: 0 }, { g: bathG, k: 'bath', s: 0, v: 0 }]; let lightO = 0, seT = 0;

  // trees and shrubs: bark limbs, dark inner cores, instanced leaves
  const BK = { p: [], n: [], u: [], c: [], i: [] }, LV = { m: [], c: [], n: [], s: [] }, CR = { p: [], n: [], c: [], k: [] };
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
  const addLeaf = (p, d, sx, sy, col, n, sway, fl, ev = 0) => { _q.setFromUnitVectors(UP, d); _q2.setFromAxisAngle(d, sr() * 6.2832); _q.premultiply(_q2); _m.compose(p, _q, _sc.set(sx, sy, sx)); for (let k = 0; k < 16; k++) LV.m.push(_m.elements[k]); LV.c.push(col.r, col.g, col.b); LV.n.push(n.x, n.y, n.z); LV.s.push(sway, fl, ev); };
  const icoT = new THREE.IcosahedronGeometry(1, 1).attributes.position, coneT = new THREE.ConeGeometry(1, 1, 9, 1, true).toNonIndexed().attributes.position;
  const addCore = (c, rx, ry, col, ev) => { for (let i = 0; i < icoT.count; i++) { const x = icoT.getX(i), y = icoT.getY(i), z = icoT.getZ(i), k = .62 + .38 * (y * .5 + .5); CR.p.push(c.x + x * rx, c.y + y * ry, c.z + z * rx); if (ev) CR.k.push(c.x + x * rx, c.y + y * ry, c.z + z * rx); else CR.k.push(c.x, c.y, c.z); CR.n.push(x, y, z); CR.c.push(col.r * k, col.g * k, col.b * k); } };
  // one leafy clump: leaves sit near the shell, lighter outside and on top, darker inside
  const cluster = (c, r, n, pl, cc, size, base, flat = .82, ev = 0) => {
    addCore(c, r * .72, r * .72 * flat, pl.k, ev);
    for (let i = 0; i < n; i++) {
      _u.set(rs(-1, 1), rs(-.6, 1), rs(-1, 1)).normalize(); const rho = r * (1 - .45 * sr() * sr());
      _p.set(c.x + _u.x * rho, c.y + _u.y * rho * flat, c.z + _u.z * rho);
      _d.set(_u.x + rs(-.7, .7), _u.y * .5 - .4 + rs(-.5, .5), _u.z + rs(-.7, .7)).normalize();
      _n.copy(_p).sub(cc).normalize().multiplyScalar(.5).addScaledVector(_u, .6); _n.y += .3; _n.normalize();
      const a = clamp((rho / r - .55) / .45 * .45 + (_u.y * .5 + .5) * .5 + rs(-.2, .2), 0, 1), s = size * rs(.75, 1.3);
      _c.copy(pl.d).lerp(pl.l, a); if (sr() < .07) _c.lerp(pl.y, .55);
      addLeaf(_p, _d, s, s, _c, _n, Math.max(0, _p.y - base) * .016, s * .2, ev);
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
    for (let i = 0; i < coneT.count; i++) { const cx = coneT.getX(i), cy = coneT.getY(i) + .5, cz = coneT.getZ(i), hy = H * (.2 + cy * .78), kk = .7 + .3 * cy; CR.p.push(x + lean * hy + cx * Rm * .6, y0 + hy, z + cz * Rm * .6); CR.k.push(x + lean * hy + cx * Rm * .6, y0 + hy, z + cz * Rm * .6); _n.set(cx, .4, cz).normalize(); CR.n.push(_n.x, _n.y, _n.z); CR.c.push(PC.k.r * kk, PC.k.g * kk, PC.k.b * kk); }
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
          addLeaf(_p, _d, len * .7, len, _c, _n, (py - y0) * .011, len * .08, 1);
        }
      }
    }
  };
  const bush = (x, z, r, pl, leaf) => {
    const y = gy(x, z), cc = new THREE.Vector3(x, y + r * .25, z), k = 3 + (sr() * 2 | 0), a0 = sr() * 6.28;
    cluster(new THREE.Vector3(x, y + r * .6, z), r, Math.round(2000 * r * r), pl, cc, leaf, y, .85, 1);
    for (let i = 0; i < k; i++) { const ang = a0 + i / k * 6.28 + rs(-.3, .3), rr = r * rs(.5, .7); cluster(new THREE.Vector3(x + Math.cos(ang) * r * .62, y + rr * .55, z + Math.sin(ang) * r * .62), rr, Math.round(2000 * rr * rr), pl, cc, leaf, y, .85, 1); }
  };
  TREES.forEach(t => tree(t[0], t[1], t[2])); CONIFERS.forEach(t => conifer(t[0], t[1], t[2])); BUSHES.forEach(b => bush(b[0], b[1], b[2], b[3], b[4]));
  const fa = (a, n) => new THREE.Float32BufferAttribute(a, n);
  const barkTex = (() => { const c = document.createElement('canvas'); c.width = 128; c.height = 256; const x = c.getContext('2d'); x.fillStyle = '#8A776A'; x.fillRect(0, 0, 128, 256); for (let i = 0; i < 260; i++) { const px = sr() * 128, py = sr() * 256, h = 20 + sr() * 90, w = 1.5 + sr() * 4; x.fillStyle = sr() < .62 ? `rgba(58,44,40,${.25 + sr() * .35})` : `rgba(190,172,156,${.15 + sr() * .25})`; for (const o of [-128, 0, 128]) for (const q of [-256, 0, 256]) x.fillRect(px + o, py + q, w, h); } const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; return t; })();
  const barkGeo = new THREE.BufferGeometry(); barkGeo.setAttribute('position', fa(BK.p, 3)); barkGeo.setAttribute('normal', fa(BK.n, 3)); barkGeo.setAttribute('uv', fa(BK.u, 2)); barkGeo.setAttribute('color', fa(BK.c, 3)); barkGeo.setIndex(BK.i);
  const barkMat = L('#FFFFFF', { map: barkTex, vertexColors: true }), barkMesh = M(barkGeo, barkMat); barkMesh.receiveShadow = true; scene.add(barkMesh);
  const coreGeo = new THREE.BufferGeometry(); coreGeo.setAttribute('position', fa(CR.p, 3)); coreGeo.setAttribute('normal', fa(CR.n, 3)); coreGeo.setAttribute('color', fa(CR.c, 3)); coreGeo.setAttribute('aC', fa(CR.k, 3));
  const coreMat = L('#FFFFFF', { vertexColors: true }), coreMesh = M(coreGeo, coreMat); coreMesh.receiveShadow = true; scene.add(coreMesh);
  // winter: leaf clumps of the broadleaf trees shrink away (evergreens keep theirs), in the shadow pass too
  const corePatch = s => { s.uniforms.uSe = uSe; s.vertexShader = 'attribute vec3 aC; uniform vec4 uSe;\n' + s.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\ntransformed = mix(transformed, aC, uSe.z);'); };
  coreMat.onBeforeCompile = corePatch; coreMesh.customDepthMaterial = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking }); coreMesh.customDepthMaterial.onBeforeCompile = corePatch;
  const leafGeo = new THREE.BufferGeometry(); leafGeo.setAttribute('position', fa([0, 0, 0, 0, .5, -.1, 0, 1, 0, -.32, .42, .06, .32, .42, .06], 3)); leafGeo.setAttribute('color', fa([.7, .7, .7, .95, .95, .95, 1.1, 1.1, 1.1, 1, 1, 1, 1, 1, 1], 3)); leafGeo.setIndex([0, 1, 3, 3, 1, 2, 0, 4, 1, 1, 4, 2]); leafGeo.computeVertexNormals();
  leafGeo.setAttribute('aN', new THREE.InstancedBufferAttribute(new Float32Array(LV.n), 3)); leafGeo.setAttribute('aS', new THREE.InstancedBufferAttribute(new Float32Array(LV.s), 3));
  const leafMat = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
  leafMat.onBeforeCompile = s => { s.uniforms.uSe = uSe;
    s.uniforms.uT = uT; s.uniforms.uA = uA;
    s.vertexShader = 'uniform float uT, uA; attribute vec3 aN; attribute vec3 aS; uniform vec4 uSe;\n' + WIND + s.vertexShader
      .replace('#include <begin_vertex>', '#include <begin_vertex>\ntransformed *= 1. - uSe.z * (1. - aS.z);')
      .replace('#include <color_vertex>', '#include <color_vertex>\nvec3 gO = instanceMatrix[3].xyz; float gHs = fract(sin(dot(gO, vec3(12.9898, 78.233, 37.719))) * 43758.5453), gLm = dot(vColor.rgb, vec3(.3, .6, .1)), gDc = 1. - aS.z;\nvColor.rgb = mix(vColor.rgb, mix(vec3(1.5, .2, .07), vec3(1.7, 1.05, .1), gHs) * (gLm * 1.5 + .04), uSe.y * gDc * (.75 + .25 * gHs));\nvColor.rgb = mix(vColor.rgb, mix(vec3(1., .5, .72), vec3(1., .9, .95), gHs) * (.45 + gLm), uSe.x * gDc * step(.55, fract(gHs * 7.3)));\nvColor.rgb = mix(vColor.rgb, vec3(.8, .86, 1.), uSe.z * aS.z * smoothstep(.1, .7, aN.y) * .85);')
      .replace('#include <defaultnormal_vertex>', '#include <defaultnormal_vertex>\ntransformedNormal = normalize( normalMatrix * aN + normalize( transformedNormal ) * .3 );')
      .replace('#include <project_vertex>', PROJ('vec3 gR = instanceMatrix[3].xyz; float gW = gWind(gR.xz, uT) * uA;\nmvPosition.x += gW * aS.x; mvPosition.z += gW * aS.x * .4;\nmvPosition.xyz += aN * (sin(uT * 5.3 + dot(gR, vec3(7.1, 5.3, 6.7))) * (.35 + .65 * abs(gW)) * min(uA, 1.) * aS.y * position.y);'));
    fixN(s);
  };
  const leaves = new THREE.InstancedMesh(leafGeo, leafMat, LV.m.length / 16); leaves.instanceMatrix.array.set(LV.m); leaves.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(LV.c), 3); leaves.castShadow = leaves.receiveShadow = true; leaves.frustumCulled = false; scene.add(leaves);
  leaves.customDepthMaterial = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
  leaves.customDepthMaterial.onBeforeCompile = s => { s.uniforms.uSe = uSe; s.vertexShader = 'attribute vec3 aS; uniform vec4 uSe;\n' + s.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\ntransformed *= 1. - uSe.z * (1. - aS.z);'); };

  // grass: instanced three-blade tufts, wind and the clearing round each flower done in the vertex shader
  const tuftGeo = (() => { const P = [], C = [], Nn = [], I = []; [[0, 0, 0, .3, .1], [.055, .03, 2.2, .24, .13], [-.045, .05, 4.3, .2, .16]].forEach(([bx, bz, ry, h, ln]) => { const c = Math.cos(ry), s = Math.sin(ry), b0 = P.length / 3; [[0, .021, 0, .42], [.5, .016, .45, .8], [1, 0, 1, 1.08]].forEach(([t, w, f, g], k) => { for (const sg of k < 2 ? [-1, 1] : [0]) { const lx = sg * w, lz = f * ln; P.push(bx + lx * c + lz * s, t * h, bz - lx * s + lz * c); C.push(g, g, g); Nn.push(s * .3, 1, c * .3); } }); I.push(b0, b0 + 1, b0 + 2, b0 + 1, b0 + 3, b0 + 2, b0 + 2, b0 + 3, b0 + 4); }); const g = new THREE.BufferGeometry(); g.setAttribute('position', fa(P, 3)); g.setAttribute('color', fa(C, 3)); g.setAttribute('normal', fa(Nn, 3)); g.setIndex(I); return g; })();
  const grassMat = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
  grassMat.onBeforeCompile = s => {
    s.uniforms.uT = uT; s.uniforms.uA = uA; s.uniforms.uF = uF; s.uniforms.uSe = uSe; s.uniforms.uLawn = uLawn;
    s.vertexShader = 'uniform float uT, uA; uniform vec3 uF[16]; uniform vec4 uSe; uniform vec3 uLawn;\n' + WIND + s.vertexShader
      .replace('#include <color_vertex>', '#include <color_vertex>\nvec3 gR = instanceMatrix[3].xyz; float gH = position.y / .3; float gW = gWind(gR.xz, uT) * uA; vColor.rgb *= 1. + gW * gH * .09; vColor.rgb *= 1. + uLawn.y * .2 * clamp(sin(gR.x * 2.6 + .4) * 6., -1., 1.); vColor.rgb = mix(vColor.rgb, vColor.rgb * vec3(1.45, 1.02, .55), uSe.y * .8); vColor.rgb *= 1. + uSe.x * .1; vColor.rgb = mix(vColor.rgb, vec3(.78, .84, 1.) * (.7 + .3 * gH), uSe.z * .9);')
      .replace('#include <project_vertex>', PROJ('float gK = 1.; for (int i = 0; i < 16; i++) { vec2 gd = gR.xz - uF[i].xy; gK = min(gK, 1. - uF[i].z * (1. - smoothstep(.01, .12, dot(gd, gd)))); }\nmvPosition.xyz = gR + (mvPosition.xyz - gR) * gK * vec3(1., uLawn.x, 1.);\nfloat gS = length(instanceMatrix[1].xyz) * gH * gH * gK * uLawn.x;\nmvPosition.x += gW * gS * .085 + sin(uT * 4.7 + gR.x * 9. + gR.z * 7.) * .012 * gS * uA; mvPosition.z += gW * gS * .035; mvPosition.y -= abs(gW) * gS * .02;'));
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

  // meadow wildflowers and winter snow
  const mergeC = parts => { const P = [], Nn = [], C = []; parts.forEach(([g0, c]) => { const q = g0.index ? g0.toNonIndexed() : g0, p = q.attributes.position, n = q.attributes.normal; for (let i = 0; i < p.count; i++) { P.push(p.getX(i), p.getY(i), p.getZ(i)); Nn.push(n.getX(i), n.getY(i), n.getZ(i)); C.push(c[0], c[1], c[2]); } }); const g = new THREE.BufferGeometry(); g.setAttribute('position', fa(P, 3)); g.setAttribute('normal', fa(Nn, 3)); g.setAttribute('color', fa(C, 3)); return g; };
  const wildGeo = mergeC([[new THREE.CylinderGeometry(.006, .008, 1, 4).translate(0, .5, 0), [.2, .45, .22]], [new THREE.IcosahedronGeometry(.05, 1).scale(1, 1.3, 1).translate(0, 1, 0), [1, 1, 1]], [new THREE.IcosahedronGeometry(.022, 0).scale(1, 1.3, 1).translate(0, 1.07, 0), [1, .78, .2]]]);
  const wildMat = new THREE.MeshLambertMaterial({ vertexColors: true });
  wildMat.onBeforeCompile = s => { s.uniforms.uT = uT; s.uniforms.uA = uA; s.uniforms.uLawn = uLawn; s.vertexShader = 'uniform float uT, uA; uniform vec3 uLawn;\n' + WIND + s.vertexShader.replace('#include <project_vertex>', PROJ('vec3 gR = instanceMatrix[3].xyz; mvPosition.xyz = gR + (mvPosition.xyz - gR) * uLawn.z; float gW = gWind(gR.xz, uT) * uA * position.y * position.y * uLawn.z; mvPosition.x += gW * .1; mvPosition.z += gW * .04;')); };
  const WF = [], WAV = [...SLOTS, ...Object.values(EXTRA)];
  for (let i = 0; i < 2600 && WF.length < 340; i++) { const x = rs(-5.5, 5.5), z = rs(-3.9, 6.5); if (Math.abs(x - pathX(z)) < .5 || lawn(x, z)[2] > .6 || WAV.some(p => (x - p[0]) ** 2 + (z - p[1]) ** 2 < .2) || BUSHES.some(b => (x - b[0]) ** 2 + (z - b[1]) ** 2 < b[2] * b[2]) || (x - 2.45) ** 2 + (z + .75) ** 2 < .7 || (x + 2.5) ** 2 + (z + 1.5) ** 2 < .3) continue; WF.push([x, z]); }
  const wild = new THREE.InstancedMesh(wildGeo, wildMat, WF.length), WCOL = ['#FFFFFF', '#FFE08A', '#F7C9EA', '#D9C2FF'];
  WF.forEach((w, i) => { dummy.position.set(w[0], gy(w[0], w[1]) - .02, w[1]); dummy.rotation.set(rs(-.12, .12), sr() * 6.28, rs(-.12, .12)); const s = rs(.8, 1.3); dummy.scale.set(s, rs(.42, .62), s); dummy.updateMatrix(); wild.setMatrixAt(i, dummy.matrix); wild.setColorAt(i, _c.set(WCOL[i % 4])); });
  wild.frustumCulled = false; wild.visible = false; scene.add(wild);
  const dotTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 32; const x = c.getContext('2d'), g = x.createRadialGradient(16, 16, 0, 16, 16, 16); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(.6, 'rgba(255,255,255,.9)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 32, 32); return new THREE.CanvasTexture(c); })();
  const SN = 420, snowP = new Float32Array(SN * 3), snowV = new Float32Array(SN), snowGeo = new THREE.BufferGeometry();
  for (let i = 0; i < SN; i++) { snowP[i * 3] = rs(-8, 8); snowP[i * 3 + 1] = rs(-1, 10); snowP[i * 3 + 2] = rs(-10, 9); snowV[i] = rs(.5, 1.1); }
  snowGeo.setAttribute('position', new THREE.BufferAttribute(snowP, 3));
  const snowMat = new THREE.PointsMaterial({ color: '#FFFFFF', size: .1, map: dotTex, transparent: true, opacity: 0, depthWrite: false, fog: false }), snow = new THREE.Points(snowGeo, snowMat); snow.frustumCulled = false; snow.visible = false; scene.add(snow);

  // the wider world: a sky dome (gradient, sun glow, wisps, stars all round), soft clouds, and a broad valley with wooded hills on every side, so the hilltop sits in a landscape
  let s2 = 4242; const r2 = () => { s2 = (s2 * 16807) % 2147483647; return s2 / 2147483647; }, q2 = (a, b) => a + r2() * (b - a); // its own random stream: the seeded garden scenery is untouched
  const skyC = key => ({ value: new THREE.Color(SKY.Day[key]) });
  const skyU = { c0: skyC('c0'), c1: skyC('c1'), c2: skyC('c2'), c3: skyC('c3'), glowC: skyC('glow'), glowK: { value: SKY.Day.gk }, wispK: { value: SKY.Day.wk }, night: { value: 0 }, sunDir: { value: new THREE.Vector3(0, 0, -1) }, uT };
  const sky = new THREE.Mesh(new THREE.SphereGeometry(300, 40, 24), new THREE.ShaderMaterial({ uniforms: skyU, side: THREE.BackSide, depthWrite: false,
    vertexShader: `varying vec3 vD;
void main() { vD = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`,
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
  float m = dot(d, normalize(vec3(.45, .85, .1))) * 3.4; col += vec3(.04, .036, .09) * exp(-m * m) * (.45 + .55 * fbm(d.xy * 6. + d.z * 4.)) * night;
  gl_FragColor = vec4(col, 1.);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}` }));
  sky.renderOrder = -10; sky.frustumCulled = false; scene.add(sky);
  const mwN = new THREE.Vector3(.45, .85, .1).normalize(), starMats = [['#BFB3E6', 1.5, 4200], ['#F4EEFB', 2.2, 1500], ['#FFFFFF', 3.3, 320]].map(([c, sz, n]) => {
    const p = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { let ok = false; while (!ok) { v1.set(q2(-1, 1), q2(-.35, 1), q2(-1, 1)); const l = v1.lengthSq(); if (l > 1 || l < .05) continue; v1.normalize(); ok = r2() < .5 + .5 * Math.exp(-((v1.dot(mwN) * 2.4) ** 2)); } p[i * 3] = v1.x * 280; p[i * 3 + 1] = v1.y * 280; p[i * 3 + 2] = v1.z * 280; }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(p, 3)); const m = new THREE.PointsMaterial({ color: c, size: sz, sizeAttenuation: false, transparent: true, opacity: 0, fog: false, depthWrite: false }), pts = new THREE.Points(g, m); pts.frustumCulled = false; sky.add(pts); return m;
  });
  // clouds: each one is a heap of soft lumpy puffs, bigger and darker at the flat base, smaller and lighter on top; a ring of them drifts round the whole sky
  const puffTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d'); for (let i = 0; i < 30; i++) { const a = r2() * 6.283, rr = Math.sqrt(r2()) * 36, px = 64 + Math.cos(a) * rr, py = 64 + Math.sin(a) * rr, rad = q2(11, 24), g = x.createRadialGradient(px, py, 0, px, py, rad); g.addColorStop(0, 'rgba(255,255,255,.5)'); g.addColorStop(.55, 'rgba(255,255,255,.22)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 128, 128); } return new THREE.CanvasTexture(c); })();
  const CL = { p: [], h: [], s: [] };
  for (let i = 0; i < 20; i++) {
    const be = i / 20 * 6.283 + q2(-.12, .12), dist = q2(72, 96), W = q2(9, 17), H = W * q2(.28, .42), cx = Math.sin(be) * dist, cz = CZ - Math.cos(be) * dist, bd = ((be * 57.2958 + 540) % 360) - 180, lift = Math.exp(-(((bd - 7) / 24) ** 2)), by = q2(-7, 9) * (1 - lift) + q2(8, 10.5) * lift, cl = []; // clouds rise gradually toward the rank daisy's bearing, so none sits behind it and there is no hard edge between low and high cloud
    for (let j = 0; j < 46; j++) { const u = q2(-1, 1), top = H * Math.pow(1 - u * u, .7) * q2(.55, 1), hy = Math.pow(r2(), 1.2), sz = (.3 + .5 * (1 - hy) * (1 - Math.abs(u) * .6)) * H * 1.9, lat = u * W * .5, dep = q2(-1.6, 1.6); cl.push([cx + Math.cos(be) * lat + Math.sin(be) * dep, by + Math.max(hy * top, sz * .28), cz + Math.sin(be) * lat - Math.cos(be) * dep, hy * top / H, sz, dep]); }
    cl.sort((a, b) => b[5] - a[5]).forEach(q => { CL.p.push(q[0], q[1], q[2]); CL.h.push(q[3]); CL.s.push(q[4]); });
  }
  const cloudU = { map: { value: puffTex }, cT: skyC('ct'), cB: skyC('cb'), op: { value: SKY.Day.ca } }, cloudGeo = new THREE.InstancedBufferGeometry();
  // each puff is a camera-facing quad, not a GL point: points vanish whole when their center leaves the screen and are size-capped on some phones
  cloudGeo.setAttribute('position', fa([-.5, -.5, 0, .5, -.5, 0, .5, .5, 0, -.5, .5, 0], 3)); cloudGeo.setIndex([0, 1, 2, 0, 2, 3]); cloudGeo.setAttribute('aC', new THREE.InstancedBufferAttribute(new Float32Array(CL.p), 3)); cloudGeo.setAttribute('aH', new THREE.InstancedBufferAttribute(new Float32Array(CL.h), 1)); cloudGeo.setAttribute('aS', new THREE.InstancedBufferAttribute(new Float32Array(CL.s), 1)); cloudGeo.instanceCount = CL.h.length;
  const cloudPts = new THREE.Mesh(cloudGeo, new THREE.ShaderMaterial({ uniforms: cloudU, transparent: true, depthWrite: false,
    vertexShader: `attribute vec3 aC; attribute float aH, aS; varying float vH; varying vec2 vUv;
void main() { vH = aH; vUv = position.xy + .5; vec4 mv = modelViewMatrix * vec4(aC, 1.); mv.xy += position.xy * aS; gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform sampler2D map; uniform vec3 cT, cB; uniform float op; varying float vH; varying vec2 vUv;
void main() {
  float a = smoothstep(.1, .6, texture2D(map, vUv).a); vec3 col = mix(cB, cT, smoothstep(-.25, .45, vH * 1.6 + (vUv.y - .5) * .9));
  gl_FragColor = vec4(col, a * op);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}` }));
  cloudPts.frustumCulled = false; scene.add(cloudPts);
  // a shooting star crosses the part of the night sky you are looking at, once every 7 seconds
  const shoot = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: (() => { const c = document.createElement('canvas'); c.width = 128; c.height = 16; const x = c.getContext('2d'), g = x.createLinearGradient(0, 0, 128, 0); g.addColorStop(0, 'rgba(190,170,255,0)'); g.addColorStop(.7, 'rgba(220,210,255,.45)'); g.addColorStop(1, 'rgba(255,255,255,1)'); x.fillStyle = g; x.fillRect(0, 0, 128, 16); const v = x.createLinearGradient(0, 0, 0, 16); v.addColorStop(0, 'rgba(0,0,0,1)'); v.addColorStop(.5, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,1)'); x.globalCompositeOperation = 'destination-out'; x.fillStyle = v; x.fillRect(0, 0, 128, 16); return new THREE.CanvasTexture(c); })(), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, side: THREE.DoubleSide }));
  shoot.visible = false; shoot.frustumCulled = false; sky.add(shoot);
  const shootS = new THREE.Vector3(), shootE = new THREE.Vector3(); let shootT = 4, shootP = -1;
  // the valley: a very large, gently rolling ground a few units below the hilltop, mottled into meadow and wood
  const plainMat = new THREE.MeshLambertMaterial({ vertexColors: true }), PY = -4.6, relief = (x, z) => (fbm(x * .05 + 9.1, z * .05 + 4.3) - .5) * 3.4 * clamp((Math.hypot(x, z - CZ) - 15) / 22, 0, 1), plainY = (x, z) => Math.sqrt(Math.max(0, 22500 - x * x - (z - CZ) * (z - CZ))) - 150 + PY + relief(x, z);
  { const g = new THREE.SphereGeometry(150, 128, 36, 0, Math.PI * 2, 0, .52), p = g.attributes.position, c = new Float32Array(p.count * 3);
    for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i) + CZ, kq = .8 + .42 * fbm(x * .09 + 2.2, z * .09 + 7.5); p.setY(i, p.getY(i) + relief(x, z)); c[i * 3] = kq * .96; c[i * 3 + 1] = kq; c[i * 3 + 2] = kq * .9; }
    g.setAttribute('color', new THREE.BufferAttribute(c, 3)); g.computeVertexNormals(); const m = new THREE.Mesh(g, plainMat); m.position.set(0, PY - 150, CZ); scene.add(m); }
  // more wooded hills right round the horizon, and trees scattered across the valley floor
  { const xc = [], xb = [];
    [[48, 40, 15, 4.5], [-50, 42, 16, 5], [80, 38, 14, 4], [-78, 40, 15, 4.5], [110, 42, 16, 5], [-108, 40, 14, 4], [142, 44, 17, 5], [-140, 42, 15, 4.5], [180, 46, 18, 5]].forEach(([deg, dist, rad, rise]) => {
      const be = deg * Math.PI / 180, hx = Math.sin(be) * dist, hz = CZ - Math.cos(be) * dist, hy = plainY(hx, hz) + rise - rad, f0 = Math.atan2(Math.cos(be), -Math.sin(be)); A(scene, M(unit, farMat, hx, hy, hz, false)).scale.setScalar(rad);
      for (let i = 0; i < 230; i++) { const uy = q2(.45, 1), ph = f0 + q2(-2.1, 2.1), q = Math.sqrt(1 - uy * uy); (r2() < .55 ? xc : xb).push([hx + Math.cos(ph) * q * rad, hy + uy * rad - .1, hz + Math.sin(ph) * q * rad, q2(.6, 1.15)]); }
    });
    for (let i = 0; i < 1100; i++) { const a = r2() * 6.283, d = 13 + Math.pow(r2(), 1.5) * 34, x = Math.sin(a) * d, z = CZ - Math.cos(a) * d, s = 3.1 - 1.7 * clamp((d - 13) / 30, 0, 1); if (fbm(x * .11 + 1.7, z * .11 + 8.8) < .47) continue; (r2() < .5 ? xc : xb).push([x, plainY(x, z) - .15, z, s * q2(.7, 1.2)]); }
    [[xc, vcol(new THREE.ConeGeometry(.42, 1.5, 6).translate(0, .75, 0), y => .55 + .5 * y / 1.5), '#2F6B48', '#3F7F52'], [xb, vcol(new THREE.IcosahedronGeometry(.6, 1).translate(0, .6, 0), y => .6 + .42 * y / 1.2), '#4B8F45', '#74B25A']].forEach(([arr, geo, ca, cb2]) => { const im = new THREE.InstancedMesh(geo, farTreeMat, arr.length); arr.forEach((a, i) => { dummy.position.set(a[0], a[1], a[2]); dummy.rotation.set(0, r2() * 6.28, 0); dummy.scale.set(a[3], a[3] * q2(.85, 1.25), a[3]); dummy.updateMatrix(); im.setMatrixAt(i, dummy.matrix); im.setColorAt(i, _c.set(ca).lerp(_c2.set(cb2), r2())); }); im.frustumCulled = false; scene.add(im); }); }

  // a patch of bare soil travels with each flower
  const soilTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d'), g = x.createRadialGradient(64, 64, 0, 64, 64, 64); g.addColorStop(0, 'rgba(74,54,40,1)'); g.addColorStop(.5, 'rgba(84,62,44,.95)'); g.addColorStop(.8, 'rgba(70,84,44,.5)'); g.addColorStop(1, 'rgba(70,96,46,0)'); x.fillStyle = g; x.fillRect(0, 0, 128, 128); for (let i = 0; i < 220; i++) { const a = sr() * 6.28, r = Math.sqrt(sr()) * 44; x.fillStyle = sr() < .5 ? 'rgba(48,34,26,.55)' : 'rgba(128,100,72,.5)'; x.beginPath(); x.arc(64 + Math.cos(a) * r, 64 + Math.sin(a) * r, 1 + sr() * 2.2, 0, 6.28); x.fill(); } const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
  const soilGeo = new THREE.CircleGeometry(.36, 20).rotateX(-Math.PI / 2), soilMat = L('#FFFFFF', { map: soilTex, transparent: true, depthWrite: false });
  const tintMats = [groundMat, grassMat, leafMat, coreMat, barkMat, farTreeMat, soilMat, wildMat];

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
    const b = { g, wm, wr: wing(1), wl: wing(-1), pos: new THREE.Vector3(rnd(-2, 2), 2.5, rnd(-2, 2)), vel: new THREE.Vector3(), tgt: new THREE.Vector3(), mode: 'fly', fid: null, timer: rnd(1, 3), yaw: 0, roll: 0, pitch: 0, ph: rnd(0, 6), seed: i * 2.7, vis: 0 };
    scene.add(g); way(b); return b;
  }
  function way(b) { b.tgt.set(rnd(-2.3, 2.3), 0, rnd(-3.4, 3.2)); b.tgt.y = gy(b.tgt.x, b.tgt.z) + rnd(1.2, 2.6); }
  const flies = ['#F7C9EA', '#FFE08A', '#CFE3FF', '#FFD9C7'].map(makeFly);
  const guest = makeFly(MC[1], 7), guestLabel = mkLabel(true); guest.mode = 'off'; guest.guest = true; guest.g.visible = false;
  function takeoff(b) { b.mode = 'fly'; b.fid = null; b.vel.set(rnd(-.4, .4), 1.3, rnd(-.4, .4)); b.timer = rnd(2, 4); way(b); if (b.guest) { b.mode = 'leave'; b.tgt.set(b.pos.x > 0 ? 6.5 : -6.5, 5, -1); } }
  function updFly(b, dt, t) {
    const fl = b.fid != null ? flowers.get(b.fid) : null; let th;
    b.ph += dt * (b.mode === 'perch' ? 1.9 : 58);
    if (b.mode === 'perch') {
      if (!fl || fl.fly || (!b.guest && (fl.d.st < 2 || (sel != null && sel !== fl.id)))) takeoff(b);
      else { b.pos.copy(fl.headW); b.timer -= dt; th = .95 + .4 * Math.sin(b.ph); b.roll = damp(b.roll, 0, 5, dt); b.pitch = damp(b.pitch, -.25, 5, dt); if (b.timer < 0) takeoff(b); }
    }
    if (b.mode !== 'perch') {
      let tgt = b.tgt, arrive = false;
      if (b.mode === 'approach') { if (!fl || fl.fly || b.timer < 0) { b.mode = 'fly'; b.fid = null; way(b); b.timer = rnd(2, 4); if (b.guest) takeoff(b); } else { tgt = fl.headW; arrive = true; } }
      v1.subVectors(tgt, b.pos); const dist = v1.length(), sp = arrive ? Math.min(b.guest ? 2.7 : 1.5, dist * 1.8 + .2) : 1.5, fa = arrive ? Math.min(1, dist * 1.2) : 1;
      v1.multiplyScalar(sp / Math.max(dist, .001));
      v1.x += Math.sin(t * 5.1 + b.seed) * .9 * fa; v1.y += (Math.sin(t * 7.3 + b.seed * 2) * .8 + Math.cos(b.ph) * .5) * fa; v1.z += Math.cos(t * 4.3 + b.seed) * .7 * fa;
      b.vel.lerp(v1, 1 - Math.exp(-dt * 2.4)); b.pos.addScaledVector(b.vel, dt);
      const fl0 = gy(b.pos.x, b.pos.z) + .35; if (b.pos.y < fl0) b.pos.y = fl0;
      b.timer -= dt;
      if (b.mode === 'approach' && (dist < .07 || (b.guest && (dist < .12 || b.timer < 4)))) { b.mode = 'perch'; b.timer = rnd(2.5, 6); if (b.guest) { b.timer = 2.8; cb.onVisit && cb.onVisit(b.member, b.fid); } }
      else if (b.mode === 'leave') { if (dist < 1) b.mode = 'off'; }
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

  // watering can (a nudge) and a visiting friend's butterfly
  const dropMat = B('#8EC5FF'), can = (() => {
    const g = new THREE.Group(), tl = new THREE.Group(), cm = L('#8A4BE6'), cw = L('#F6F0FB'); g.add(tl);
    tl.add(M(new THREE.CylinderGeometry(.15, .17, .26, 18), cm)); tl.add(M(new THREE.CylinderGeometry(.156, .162, .05, 18), cw, 0, .04, 0));
    const sp = M(new THREE.CylinderGeometry(.022, .036, .36, 8), cm, .27, .04, 0); sp.rotation.z = -.95; tl.add(sp); const rose = M(new THREE.CylinderGeometry(.065, .03, .05, 12), cw, .43, .155, 0); rose.rotation.z = -.95; tl.add(rose);
    const h = M(new THREE.TorusGeometry(.11, .018, 6, 14, Math.PI), cm, -.15, .02, 0); h.rotation.z = Math.PI / 2; tl.add(h);
    const tip = new THREE.Object3D(); tip.position.set(.46, .18, 0); tl.add(tip); g.visible = false; scene.add(g); return { g, tl, tip, t: -1, id: null, side: 1, acc: 0, fired: false };
  })();
  const drops = Array.from({ length: 40 }, () => { const m = new THREE.Mesh(unit, dropMat); m.visible = false; m.scale.set(.02, .032, .02); scene.add(m); return { m, v: new THREE.Vector3(), on: false, fl: 0 }; }); let di = 0;
  function water(id) { const f = flowers.get(id); if (!f || f.fly || can.t >= 0) return false; can.id = id; can.t = 0; can.side = f.x < 0 ? 1 : -1; can.fired = false; can.acc = 0; return true; }
  function updCan(dt) {
    drops.forEach(q => { if (!q.on) return; q.v.y -= 6 * dt; q.m.position.addScaledVector(q.v, dt); if (q.m.position.y < q.fl) { q.on = false; q.m.visible = false; } });
    if (can.t < 0) return; const f = flowers.get(can.id); if (!f || f.fly) { can.t = -1; can.g.visible = false; return; }
    can.t += dt; const w = can.t, sm = x => { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); }, s = sm(w / .35) * sm((2.5 - w) / .3), pour = sm((w - .3) / .4) * sm((2.15 - w) / .3);
    can.g.visible = true; can.g.scale.setScalar(Math.max(.001, s * 1.25)); can.g.position.copy(f.headW); can.g.position.x += can.side * .62; can.g.position.y += .72 + Math.sin(w * 5) * .015; can.g.rotation.y = can.side > 0 ? Math.PI : 0; can.tl.rotation.z = -1.1 * pour; can.g.updateMatrixWorld(true);
    if (pour > .85) { can.acc += dt * 30; while (can.acc > 1) { can.acc--; const q = drops[di++ % drops.length]; can.tip.getWorldPosition(q.m.position); q.m.position.x += rnd(-.03, .03); q.m.position.z += rnd(-.03, .03); q.v.set(-can.side * rnd(.2, .55), -.3, rnd(-.08, .08)); q.fl = f.g.position.y + .06; q.on = true; q.m.visible = true; } if (!can.fired && w > 1.1) { can.fired = true; f.hv += 3; cb.onWatered && cb.onWatered(can.id); } }
    if (w > 2.5) { can.t = -1; can.g.visible = false; }
  }
  function visit(m, id, name) { const f = flowers.get(id); if (!f || f.fly || guest.mode !== 'off') return false; guest.member = m; guest.wm.color.set(MC[m]); guest.fid = id; guest.mode = 'approach'; guest.timer = 12; guest.pos.set(f.x + (f.x < 0 ? -2.6 : 2.6), gy(f.x, f.z) + 3.4, f.z + 1.2); guest.vel.set(0, 0, 0); guestLabel.textContent = name; return true; }

  // fireflies
  const ffm = [], ff = Array.from({ length: 10 }, (_, i) => { const x = -2.4 + sr() * 4.8, z = -3.5 + sr() * 6.5, m1 = B('#FFE08A', { transparent: true, opacity: 0 }), m2 = B('#FFE08A', { transparent: true, opacity: 0 }); ffm.push([m1, m2]); const g = new THREE.Group(); A(g, M(unit, m1, 0, 0, 0, false)).scale.setScalar(.04); A(g, M(unit, m2, 0, 0, 0, false)).scale.setScalar(.12); scene.add(g); return { g, x, z, y: gy(x, z) + .5 + sr() * 1.1, i }; });

  const wind = (x, z, t, amp) => amp * (Math.sin(t * 1.15 + x * .7 + z * .45) * .6 + Math.sin(t * 2.4 + x * 1.4 - z * .3) * .25 + Math.pow(Math.max(0, Math.sin(t * .23 + x * .2)), 6) * .8);

  function updFlower(f, dt, t, amp, snap) {
    const d = f.d, g = f.g;
    
    if (f.fly) { const a = f.fly; a.t += dt / 1.25; const e = a.t < 1 ? a.t * a.t * (3 - 2 * a.t) : 1; g.position.lerpVectors(a.from, winPos, e); g.position.y += Math.sin(Math.PI * e) * 2.4; g.scale.setScalar(1 - .86 * e); g.rotation.y += dt * 9; f.label.style.opacity = 0; if (a.t >= 1) { burst(winPos, petCol(d), 18); winFlash = 1; const id = f.id; removeFlower(f); cb.onPressed && cb.onPressed(id); } return; }
    if (!f.placed) { f.x = f.tx; f.z = f.tz; f.placed = true; }
    const pl = snap ? 60 : 3.2; f.x = damp(f.x, f.tx, pl, dt); f.z = damp(f.z, f.tz, pl, dt); g.position.set(f.x, gy(f.x, f.z) - .02, f.z); f.dim = damp(f.dim || 0, (sel != null && sel !== f.id) || houseOpen ? 1 : 0, snap ? 60 : 6, dt); g.scale.setScalar(1 - .65 * f.dim);
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

  // inside the house: a gallery hallway. Each wall holds up to 12 framed memories; walls stand side by side, oldest to the left, the newest (where you walk in) to the right.
  // The hallway sits far below the garden; a warm glow covers the cut as the camera goes through the door. Only the wall in view and its two neighbours are ever built.
  const IN = new THREE.Vector3(0, -60, 0), room = new THREE.Group(), bays = new Map(), BAY = 2.3, WH = 3.9, RD = 7.6, FY = .4; room.position.copy(IN); room.visible = false; scene.add(room);
  const doorLook = new THREE.Vector3(-.6, house.position.y + .86, HZ + 1.1), doorPos = new THREE.Vector3(-.6, house.position.y + 1.06, HZ + 2.7);
  let walls = [], curW = 0, pan = 0, jump = null, jumpG = 0;
  const wallX = i => (i - Math.max(0, walls.length - 1)) * BAY;
  const canvasTex = (w, h, draw, rep) => { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; if (rep) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep[0], rep[1]); } return t; };
  // wallpaper with a small daisy motif, plank floor, sideboard wood
  const paperTex = canvasTex(128, 128, (x, w, h) => {
    x.fillStyle = '#EFE7F8'; x.fillRect(0, 0, w, h); x.fillStyle = 'rgba(140,110,190,.09)'; x.fillRect(0, 0, 1.5, h); x.fillRect(64, 0, 1.5, h);
    [[32, 32], [96, 96]].forEach(([cx, cy]) => { x.fillStyle = 'rgba(150,120,200,.17)'; for (let i = 0; i < 6; i++) { x.save(); x.translate(cx, cy); x.rotate(i * Math.PI / 3); x.beginPath(); x.ellipse(0, -6.5, 2.5, 4.6, 0, 0, 6.3); x.fill(); x.restore(); } x.fillStyle = 'rgba(232,185,35,.3)'; x.beginPath(); x.arc(cx, cy, 2.4, 0, 6.3); x.fill(); });
  }, [BAY / .42, WH / .42]);
  const plankTex = canvasTex(256, 256, (x, w, h) => { const cols = ['#E3BC9E', '#DCB192', '#E9C6AA', '#D8AD8B']; for (let i = 0; i < 8; i++) { x.fillStyle = cols[(i * 3 + (i >> 1)) % 4]; x.fillRect(i * 32, 0, 32, h); x.fillStyle = 'rgba(120,80,50,.16)'; for (let k = 0; k < 5; k++) x.fillRect(i * 32 + 4 + ((i * 7 + k * 11) % 24), (k * 61 + i * 37) % h, 1, 46); x.fillStyle = 'rgba(110,70,44,.5)'; x.fillRect(i * 32, 0, 1.5, h); x.fillRect(i * 32, (i * 89) % h, 32, 1.5); } }, [2, 3]);
  const woodTex = canvasTex(128, 64, (x, w, h) => { x.fillStyle = '#B98B63'; x.fillRect(0, 0, w, h); for (let k = 0; k < 26; k++) { x.fillStyle = k % 2 ? 'rgba(90,56,34,.14)' : 'rgba(240,210,180,.12)'; x.fillRect(0, (k * 23) % h, w, 1 + (k % 3)); } });
  const blobTex = (rgb, a0) => canvasTex(64, 64, (x, w, h) => { const g = x.createRadialGradient(32, 32, 4, 32, 32, 32); g.addColorStop(0, `rgba(${rgb},${a0})`); g.addColorStop(1, `rgba(${rgb},0)`); x.fillStyle = g; x.fillRect(0, 0, w, h); });
  const shadeMat = new THREE.MeshBasicMaterial({ map: blobTex('44,32,64', .45), transparent: true, depthWrite: false }), poolMat = new THREE.MeshBasicMaterial({ map: blobTex('255,205,140', .9), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: .2 });
  // soft darkening toward the corners and the floor, laid over the wallpaper so the wall reads as lit from the middle
  const vigMat = new THREE.MeshBasicMaterial({ map: canvasTex(128, 128, (x, w, h) => { const g = x.createRadialGradient(64, 54, 34, 64, 54, 104); g.addColorStop(0, 'rgba(52,36,84,0)'); g.addColorStop(1, 'rgba(52,36,84,.34)'); x.fillStyle = g; x.fillRect(0, 0, w, h); const b = x.createLinearGradient(0, h * .78, 0, h); b.addColorStop(0, 'rgba(52,36,84,0)'); b.addColorStop(1, 'rgba(52,36,84,.22)'); x.fillStyle = b; x.fillRect(0, 0, w, h); }), transparent: true, depthWrite: false });
  const glassMat = new THREE.MeshBasicMaterial({ map: canvasTex(64, 64, (x, w, h) => { const g = x.createLinearGradient(0, h, w, 0); g.addColorStop(.25, 'rgba(255,255,255,0)'); g.addColorStop(.5, 'rgba(255,255,255,.2)'); g.addColorStop(.58, 'rgba(255,255,255,.04)'); g.addColorStop(.75, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, w, h); }), transparent: true, depthWrite: false }), matMat = L('#FFFDF8');
  // one bay of hallway, built once and cloned per wall: wallpaper, wainscot, pilaster with a sconce, floor, ceiling beam, and a sideboard with a lamp, albums and a vase
  const bayTpl = new THREE.Group(), white2 = L('#FFFFFF'), brass = L('#E8B923'), T = (geo, mat, x, y, z, par = bayTpl) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); par.add(m); return m; };
  T(new THREE.PlaneGeometry(BAY, WH), L('#FFFFFF', { map: paperTex }), 0, WH / 2, 0); T(new THREE.PlaneGeometry(BAY, WH), vigMat, 0, WH / 2, .004);
  T(new THREE.BoxGeometry(BAY, .62, .04), white2, 0, .31, .02); T(new THREE.BoxGeometry(BAY, .05, .08), white2, 0, .645, .04); T(new THREE.BoxGeometry(BAY, .13, .06), white2, 0, .065, .03); T(new THREE.BoxGeometry(BAY, .14, .1), white2, 0, WH - .07, .05);
  { const bg = new THREE.BoxGeometry(.03, .5, .055); for (let i = -3; i <= 3; i++) T(bg, white2, i * .3, .38, .03); }
  T(new THREE.BoxGeometry(.14, WH, .07), white2, BAY / 2, WH / 2, .035); T(new THREE.BoxGeometry(.06, .17, .02), brass, BAY / 2, 2.72, .08); T(new THREE.BoxGeometry(.02, .02, .1), brass, BAY / 2, 2.76, .13); T(new THREE.SphereGeometry(.07, 16, 12), B('#FFF1CC', { fog: false }), BAY / 2, 2.84, .17); T(new THREE.PlaneGeometry(1.8, 1.8), poolMat, BAY / 2, 2.84, .006);
  T(new THREE.PlaneGeometry(BAY, RD).rotateX(-Math.PI / 2), L('#FFFFFF', { map: plankTex }), 0, 0, RD / 2);
  T(new THREE.PlaneGeometry(BAY, .7).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: canvasTex(8, 64, (x, w, h) => { const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, 'rgba(52,36,84,.4)'); g.addColorStop(1, 'rgba(52,36,84,0)'); x.fillStyle = g; x.fillRect(0, 0, w, h); }), transparent: true, depthWrite: false }), 0, .004, .35);
  T(new THREE.PlaneGeometry(BAY, RD).rotateX(Math.PI / 2), L('#F6F0FB'), 0, WH + .05, RD / 2); T(new THREE.BoxGeometry(.16, .16, RD), white2, BAY / 2, WH - .03, RD / 2);
  { const rg = new THREE.CircleGeometry(1, 40).rotateX(-Math.PI / 2); T(rg, L('#F0B8DE'), 0, .006, .84).scale.set(.84, 1, .36); T(rg, L('#FBE3F3'), 0, .009, .84).scale.set(.72, 1, .27); }
  const furn = new THREE.Group(); furn.name = 'furn'; bayTpl.add(furn);
  T(new THREE.BoxGeometry(1.5, .4, .36), L('#FFFFFF', { map: woodTex }), 0, .44, .2, furn); T(new THREE.BoxGeometry(1.56, .035, .4), L('#D9B08A'), 0, .657, .21, furn);
  { const lg = new THREE.CylinderGeometry(.024, .016, .24, 8), sg = new THREE.BoxGeometry(.008, .34, .006), kg = new THREE.SphereGeometry(.016, 8, 6), dk = L('#8A6244'); [[-.66, .06], [.66, .06], [-.66, .34], [.66, .34]].forEach(p => T(lg, dk, p[0], .12, p[1], furn)); [-.25, .25].forEach(xx => T(sg, dk, xx, .44, .381, furn)); [-.3, .2, .3].forEach(xx => T(kg, brass, xx, .46, .39, furn)); }
  T(new THREE.CylinderGeometry(.07, .085, .03, 18), brass, -.52, .69, .2, furn); T(new THREE.CylinderGeometry(.012, .012, .22, 8), brass, -.52, .81, .2, furn); T(new THREE.CylinderGeometry(.085, .13, .17, 22, 1, true), B('#FFF1CC', { side: THREE.DoubleSide, fog: false }), -.52, .98, .2, furn); T(new THREE.PlaneGeometry(1.2, 1.2), poolMat, -.52, 1.06, .007, furn);
  [[.3, .045, .24, '#8A4BE6', .697, 0], [.28, .04, .23, '#F7C9EA', .74, .14], [.26, .04, .22, '#FFD9C7', .78, -.2]].forEach(a => { T(new THREE.BoxGeometry(a[0], a[1], a[2]), L(a[3]), .14, a[4], .2, furn).rotation.y = a[5]; });
  T(new THREE.CylinderGeometry(.045, .062, .2, 16), white2, .56, .775, .2, furn);
  [[-.05, .14, '#E0489E'], [.02, .2, '#7B3FE4'], [.07, .12, '#2F7BE8']].forEach(([dx, hh, c], k) => { T(new THREE.CylinderGeometry(.006, .006, hh, 5), L('#3E7F3A'), .56 + dx * .5, .875 + hh / 2, .2, furn).rotation.z = -dx * 2.2; T(unit, L(c), .56 + dx, .875 + hh, .2 + k * .012, furn).scale.set(.05, .05, .018); T(unit, L(CEN), .56 + dx, .875 + hh, .215 + k * .012, furn).scale.setScalar(.02); });
  const lamp = new THREE.PointLight('#FFE0A8', 0, 10, 1.2); lamp.position.copy(IN).add(v1.set(0, 2.6, 2.4)); scene.add(lamp);
  // a framed memory: the idea's pressed flower in its list color, with its name on the larger frames. A real photo of the day would replace the flower
  const memTex = (m, ar, cap) => canvasTex(256, Math.round(256 / ar), (x, W, H) => {
    const col = LC[m.l] || LC.Movies, cy = H * (cap ? .4 : .47), r = Math.min(W, H) * (cap ? .2 : .25);
    x.fillStyle = '#FFFBF4'; x.fillRect(0, 0, W, H); x.globalAlpha = .17; x.fillStyle = col; x.fillRect(0, 0, W, H); x.globalAlpha = 1;
    x.strokeStyle = '#3E7F3A'; x.lineWidth = 5; x.lineCap = 'round'; x.beginPath(); x.moveTo(W / 2, cy + r * .4); x.quadraticCurveTo(W / 2 + r * .3, cy + r * 1.2, W / 2 - r * .1, cy + r * 1.8); x.stroke();
    x.fillStyle = '#3E7F3A'; x.beginPath(); x.ellipse(W / 2 + r * .55, cy + r * 1.3, r * .4, r * .15, -.5, 0, 6.3); x.fill();
    x.fillStyle = col; for (let i = 0; i < 8; i++) { x.save(); x.translate(W / 2, cy); x.rotate(i * Math.PI / 4 + Math.sin(i * 2.3 + m.t.length) * .09); x.beginPath(); x.ellipse(0, -r * .82, r * .27, r * .56, 0, 0, 6.3); x.fill(); x.restore(); }
    x.fillStyle = CEN; x.beginPath(); x.arc(W / 2, cy, r * .36, 0, 6.3); x.fill();
    if (cap) { const txt = m.s || m.t; let fs = 34; x.textAlign = 'center'; x.fillStyle = INK; do { fs -= 2; x.font = '900 ' + fs + 'px Nunito, sans-serif'; } while (x.measureText(txt).width > W - 24 && fs > 14); x.fillText(txt, W / 2, H - 20); }
  });
  // frames for one wall: bars, a cream mat on the larger ones, the picture, a streak of glass sheen, and a soft shadow on the wallpaper
  const mkFrames = (list, par) => list.map((m, i) => {
    const [x, y, w, h, round, col, b] = SLOT[i], g = new THREE.Group(), fm = L(col), mw = Math.min(w, h) >= .36 ? Math.min(w, h) * .1 : 0, cap = !round && w >= .4, iw = w - 2 * b - 2 * mw, ih = h - 2 * b - 2 * mw, tex = memTex(m, round ? 1 : iw / ih, cap), pm = L('#FFFFFF', { map: tex });
    T(new THREE.PlaneGeometry(w + .22, (round ? w : h) + .22), shadeMat, .03, -.05, -.02, g);
    if (round) { T(new THREE.TorusGeometry(w / 2 - b / 2, b / 2, 10, 44), fm, 0, 0, .02, g); if (mw) T(new THREE.CircleGeometry(w / 2 - b * .8, 40), matMat, 0, 0, .012, g); T(new THREE.CircleGeometry(w / 2 - b * .8 - mw, 40), pm, 0, 0, .014, g); T(new THREE.CircleGeometry(w / 2 - b * .8, 40), glassMat, 0, 0, .017, g); }
    else { [[0, (h - b) / 2, w, b], [0, -(h - b) / 2, w, b], [(w - b) / 2, 0, b, h - 2 * b], [-(w - b) / 2, 0, b, h - 2 * b]].forEach(q => T(new THREE.BoxGeometry(q[2], q[3], .05), fm, q[0], q[1], .025, g)); if (mw) T(new THREE.PlaneGeometry(w - 2 * b, h - 2 * b), matMat, 0, 0, .012, g); T(new THREE.PlaneGeometry(iw, ih), pm, 0, 0, .014, g); T(new THREE.PlaneGeometry(w - 2 * b, h - 2 * b), glassMat, 0, 0, .017, g); }
    // a wall with only a few frames hangs them a little larger, centered over the sideboard
    const n = list.length, k = n <= 3 ? 1.22 : n <= 6 ? 1.12 : 1, [lo, hi] = SLOT.slice(0, n).reduce((a, q) => [Math.min(a[0], q[1] - q[3] / 2), Math.max(a[1], q[1] + q[3] / 2)], [9, 0]), cy = (lo + hi) / 2, fx = x * k, fy = (n <= 6 ? 1.9 : cy) + (y - cy) * k + FY;
    g.position.set(fx, fy, .03); g.scale.setScalar(k); g.userData.fi = i; par.add(g); return { g, i, x: fx, y: fy, k, tex, fm, pm, s: 1, sy: round ? h / w : 1, rz: Math.sin(i * 2.1 + .5) * .028 };
  });
  const dropBay = b => { room.remove(b.g); b.frames.forEach(f => { f.tex.dispose(); f.fm.dispose(); f.pm.dispose(); }); };
  // keep exactly the current wall and one either side alive; walls beyond either end are bare, so the hallway never shows an edge
  const syncBays = () => {
    for (const [i, b] of bays) if (Math.abs(i - curW) > 1) { dropBay(b); bays.delete(i); }
    for (let i = curW - 1; i <= curW + 1; i++) if (!bays.has(i)) { const g = bayTpl.clone(); g.position.x = wallX(i); g.getObjectByName('furn').scale.x = i % 2 ? -1 : 1; room.add(g); bays.set(i, { g, frames: walls[i] ? mkFrames(walls[i], g) : [] }); }
  };
  // list: the walls, oldest first, each an array of up to 12 memories (oldest first). at: the wall to stand at; the newest by default
  function setMemories(list, at) { for (const b of bays.values()) dropBay(b); bays.clear(); walls = list.map(w => w.slice(0, SLOT.length)); curW = clamp(at == null ? walls.length - 1 : at, 0, Math.max(0, walls.length - 1)); pan = 0; jump = null; jumpG = 0; selF = null; syncBays(); }
  // step to the next wall with a slide; anything further away is a quick dip of the glow so the walls in between never have to be built
  function setWall(i) { i = clamp(i, 0, Math.max(0, walls.length - 1)); if (i === curW && !jump) return; selF = null; if (Math.abs(i - curW) > 1 && hMode === 2) jump = { to: i, t: 0 }; else { jump = null; jumpG = 0; curW = i; syncBays(); } }

  // camera
  const basePos = new THREE.Vector3(0, 6.6, 13.5), baseLook = new THREE.Vector3(0, 1.3, -1.2), introPos = new THREE.Vector3(0, 11, 21), introLook = new THREE.Vector3(0, 7, -12);
  const camPos = introPos.clone(), camLook = introLook.clone(), posT = new THREE.Vector3(), lookT = new THREE.Vector3();
  let px = 0, py = 0, pxs = 0, pys = 0, drag = null, yawT = 0, yaw = 0, moved = 0, t0 = 0, tNow = 0, houseOpen = false, doorA = 0, hMode = 0, hT = 0, glow = 0, selF = null, hovF = null, doorHov = false, decoOn = false; // hMode: 0 garden, 1 flying to the door, 2 inside, 3 leaving, 4 back outside
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  const pickAt = () => {
    ray.setFromCamera(ndc, camera);
    const roots = [...flowers.values()].filter(f => !f.fly && f.g.visible).map(f => f.g);
    for (const h of ray.intersectObjects(roots, true)) { if (h.object.userData.proxy) continue; let o = h.object, vis = true, id = null; while (o) { vis = vis && o.visible; if (id == null && o.userData.id != null) id = o.userData.id; o = o.parent; } if (vis && id != null) return id; }
    const h2 = ray.intersectObjects(hits, false)[0]; return h2 ? h2.object.userData.id : null;
  };
  const doorHit = () => { ray.setFromCamera(ndc, camera); return ray.intersectObject(doorHitM, false).length > 0; };
  const frameAt = () => { ray.setFromCamera(ndc, camera); const b = bays.get(curW), h = b ? ray.intersectObjects(b.frames.map(f => f.g), true)[0] : null; if (!h) return null; let o = h.object; while (o && o.userData.fi == null) o = o.parent; return o ? o.userData.fi : null; };
  const onMove = e => { const r = cv.getBoundingClientRect(); px = ((e.clientX - r.left) / r.width) * 2 - 1; py = ((e.clientY - r.top) / r.height) * 2 - 1; if (drag) { const dx = e.clientX - drag.x; moved = Math.max(moved, Math.abs(dx) + Math.abs(e.clientY - drag.y)); if (hMode === 2) { const edge = (dx > 0 && curW === 0) || (dx < 0 && curW >= walls.length - 1); pan = dx / (r.width / 2.07) * (edge ? .25 : 1); } else yawT = clamp(drag.y0 - dx * .006, -.7, .7); } else { ndc.set(px, -py); hoverId = hMode === 0 ? pickAt() : null; doorHov = hMode === 0 && hoverId == null && doorHit(); hovF = hMode === 2 ? frameAt() : null; cv.style.cursor = hoverId != null || doorHov || hovF != null ? 'pointer' : 'grab'; } };
  const onDown = e => { drag = { x: e.clientX, y: e.clientY, y0: yawT }; moved = 0; cv.style.cursor = 'grabbing'; try { cv.setPointerCapture(e.pointerId); } catch (_) { } };
  const onUp = e => { if (drag && moved < 7) { const r = cv.getBoundingClientRect(); ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); if (hMode === 2) { cb.onFrame && cb.onFrame(frameAt()); } else if (hMode === 0) { const id = pickAt(); if (id == null && doorHit()) { cb.onDoor && cb.onDoor(); } else { cb.onSelect && cb.onSelect(id); } } } if (drag && moved >= 7 && hMode === 2 && !jump) { const dx = e.clientX - drag.x, to = dx > 56 ? curW - 1 : dx < -56 ? curW + 1 : curW; if (to !== curW && to >= 0 && to < walls.length) { curW = to; selF = null; syncBays(); cb.onWall && cb.onWall(curW); } }
    drag = null; yawT = 0; pan = 0; cv.style.cursor = 'grab'; };
  const onLeave = () => { px = 0; py = 0; hoverId = null; doorHov = false; hovF = null; };
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
    paneMat.color.copy(cur.pane); sunPetMat.color.copy(cur.sunPet); stemMat.color.copy(cur.stem); winLight.intensity = cur.win + winFlash * 14 - doorA * 2.5; { const S = SKY[opt.time] || SKY.Day; for (const kq of ['c0', 'c1', 'c2', 'c3']) skyU[kq].value.lerp(tmpC.set(S[kq]), k); skyU.glowC.value.lerp(tmpC.set(S.glow), k); skyU.glowK.value = damp(skyU.glowK.value, S.gk, 2.2, dt); skyU.wispK.value = damp(skyU.wispK.value, S.wk, 2.2, dt); skyU.night.value = cur.night; cloudU.cT.value.lerp(tmpC.set(S.ct), k); cloudU.cB.value.lerp(tmpC.set(S.cb), k); cloudU.op.value = damp(cloudU.op.value, S.ca, 2.2, dt); starMats.forEach((m, i) => { m.opacity = cur.night * (still ? 1 : .8 + .2 * Math.sin(t * (1.3 + i * .9) + i * 2)); m.visible = cur.night > .02; }); }
    winFlash = Math.max(0, winFlash - dt * 1.6); winPane.scale.setScalar(1 + winFlash * .6);
    sunG.position.y = cur.sunY; if (!still) sunG.rotation.z -= dt * .05;
    cloudPts.rotation.y = still ? 0 : Math.sin(t * .03) * .055;
    smoke.forEach((m, i) => { const p = ((still ? 0 : t * .16) + i / 6) % 1, s = .12 + .32 * p; m.position.set(chimPos.x + Math.sin(p * 5 + i) * .12 - p * p * .9, chimPos.y + p * 2.3, chimPos.z); m.scale.set(s, s * .85, s); smokeMats[i].opacity = (1 - p) * .9; });
    uT.value = t; uA.value = amp;
    // ideas: seasons, lawn, house paint, extras, door
    { const sn = opt.season, sk = still && t - t0 > .3 ? 60 : 1.6, se = uSe.value, lw = uLawn.value, mw = opt.lawn === 'Mown', md = opt.lawn === 'Meadow';
      se.x = damp(se.x, sn === 'Spring' ? 1 : 0, sk, dt); se.y = damp(se.y, sn === 'Autumn' ? 1 : 0, sk, dt); se.z = damp(se.z, sn === 'Winter' ? 1 : 0, sk, dt);
      lw.x = damp(lw.x, (mw ? .42 : md ? 1.75 : 1) * (1 - .5 * se.z), 3, dt); lw.y = damp(lw.y, mw ? 1 : 0, 3, dt); lw.z = damp(lw.z, md && sn !== 'Winter' ? 1 : 0, 3, dt); wild.visible = lw.z > .02;
      farTreeMat.color.multiply(tmpC.setRGB(1, 1, 1).lerp(_c.setRGB(1.5, .9, .5), se.y).lerp(_c.setRGB(1.7, 1.7, 1.9), se.z));
      farMat.color.lerp(_c.set('#B89A58').multiply(cur.fol), se.y * .7).lerp(_c.set('#DDE4F2').multiply(cur.fol), se.z * .9); plainMat.color.copy(farMat.color);
      wallMat.color.lerp(tmpC.set(opt.walls), k); roofMat.color.lerp(tmpC.set(opt.roof), k); doorMat.color.lerp(tmpC.set(opt.door), k); gableMat.color.copy(roofMat.color); doorFaceMat.color.copy(doorMat.color);
      roofSnow.visible = se.z > .03; roofSnow.position.y = 1.82 + .08 * se.z; snow.visible = se.z > .03; snowMat.opacity = se.z * .95;
      if (snow.visible && !still) { for (let i = 0; i < SN; i++) { const o = i * 3; snowP[o + 1] -= snowV[i] * dt; snowP[o] += (Math.sin(t * .9 + i) * .3 + .2) * dt; if (snowP[o + 1] < -1) { snowP[o + 1] = 10; snowP[o] = rnd(-8, 8); } } snowGeo.attributes.position.needsUpdate = true; }
      seT -= dt; if (!still && seT < 0 && (se.y > .5 || se.x > .5)) { seT = se.y > .5 ? .28 : .5; const tr = TREES[[0, 3, 3, 1][Math.random() * 4 | 0]]; v1.set(tr[0] + rnd(-1.2, 1.2), gy(tr[0], tr[1]) + rnd(2.4, 3.6), tr[1] + rnd(-1, 1)); burst(v1, se.y > .5 ? ['#D9552B', '#F0A93A', '#B8402E'][Math.random() * 3 | 0] : '#F7C9EA', 1, true); }
      for (const q of decor) { const on = opt[q.k] ? 1 : 0; if (still && t - t0 > .3) { q.s = on; q.v = 0; } else { q.v += ((on - q.s) * 80 - q.v * 11) * dt; q.s += q.v * dt; } q.g.visible = q.s > .01; q.g.scale.setScalar(Math.max(.001, q.s)); }
      birdIn.rotation.x = still ? 0 : Math.pow(Math.max(0, Math.sin(t * .8)), 10);
      lightO = damp(lightO, opt.lights ? 1 : 0, 4, dt); lightG.visible = lightO > .01; wireMat.opacity = lightO * .7; bulbMat.opacity = lightO; haloMat.opacity = lightO * (.1 + .3 * cur.night);
      doorA = damp(doorA, hMode >= 1 && hMode <= 3 ? -1.8 : doorHov ? -.32 : 0, 5, dt); doorG.rotation.y = doorA; }
    // going inside: the glow rises as the camera reaches the doorway, the camera is moved to the room under it, then the glow clears
    { const sm = x => { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); }; hT += dt * (still ? 20 : 1);
      if (hMode === 1) { glow = sm((hT - .7) / .55); if (hT >= 1.3) { hMode = 2; hT = 0; camPos.copy(IN).add(v1.set(wallX(curW), 1.9, 7)); camLook.copy(IN).add(v1.set(wallX(curW), 1.62, 0)); cb.onInside && cb.onInside(true); } }
      else if (hMode === 2) glow = 1 - sm(hT / .6);
      else if (hMode === 3) { glow = sm(hT / .35); if (hT >= .4) { hMode = 4; hT = 0; selF = null; camPos.copy(doorPos); camLook.copy(doorLook); cb.onInside && cb.onInside(false); } }
      else if (hMode === 4) { glow = 1 - sm(hT / .6); if (hT >= .6) hMode = 0; }
      else glow = damp(glow, 0, 6, dt);
      if (jump) { jump.t += dt; jumpG = jump.t < .16 ? jump.t / .16 : Math.max(0, 1 - (jump.t - .16) / .3); if (jump.to != null && jump.t >= .16) { const dx = wallX(jump.to) - wallX(curW); curW = jump.to; jump.to = null; camPos.x += dx; camLook.x += dx; syncBays(); cb.onWall && cb.onWall(curW); } if (jump.t > .46) { jump = null; jumpG = 0; } }
      const ins = hMode === 2 || hMode === 3; room.visible = ins; glowEl.style.opacity = Math.max(glow, jumpG * .92).toFixed(3); lamp.intensity = ins ? 1.2 + cur.night * 6 : 0; lamp.position.set(IN.x + wallX(curW), IN.y + 2.6, IN.z + 2.4); poolMat.opacity = .05 + .4 * cur.night;
      if (ins) for (const [bi, b] of bays) for (const f of b.frames) { const on = bi === curW; f.s = damp(f.s, on && selF === f.i ? 1.1 : on && hovF === f.i ? 1.04 : 1, 10, dt); f.g.scale.set(f.s * f.k, f.s * f.sy * f.k, f.s * f.k); f.g.position.z = damp(f.g.position.z, on && selF === f.i ? .09 : .03, 10, dt); f.g.rotation.z = f.rz + (still || hMode !== 2 ? 0 : Math.sin(hT * 3.2 + f.i * 1.7) * .05 * Math.exp(-hT * 1.2)); } }
    flowers.forEach(f => updFlower(f, dt, t, amp, still && t - t0 > .3));
    { let fi = 0; flowers.forEach(f => { if (fi < 16 && !f.fly && f.g.visible) uF.value[fi++].set(f.x, f.z, Math.min(1, f.grow * 1.6)); }); for (; fi < 16; fi++) uF.value[fi].z = 0; }
    pend = pend.filter(p => { p.t -= dt; if (p.t > 0) return true; const f = flowers.get(p.id); if (f && !still) burst(f.headW, p.c || petCol(f.d), 16); return false; });
    const nFly = still ? 0 : lively ? 4 : 2;
    flies.forEach((b, i) => { const on = i < nFly && cur.night < .5; b.vis = damp(b.vis, on ? 1 : 0, 4, dt); b.g.visible = b.vis > .02; b.g.scale.setScalar(Math.max(.001, b.vis)); if (b.g.visible) updFly(b, dt, t); });
    updBee(dt, t); updCan(dt);
    if (guest.mode !== 'off') { guest.vis = damp(guest.vis, 1, 5, dt); guest.g.visible = true; guest.g.scale.setScalar(Math.max(.001, guest.vis * 1.5)); updFly(guest, dt, t); } else if (guest.g.visible) { guest.g.visible = false; guest.vis = 0; }
    ff.forEach((o, i) => { const a = still ? 0 : cur.night * (.3 + .7 * (.5 + .5 * Math.sin(t * 2.2 + i * 1.7))); ffm[i][0].opacity = a; ffm[i][1].opacity = a * .25; o.g.visible = a > .01; o.g.position.set(o.x + Math.sin(t * .6 + i) * .5, o.y + Math.sin(t * .9 + i * 2) * .25, o.z + Math.cos(t * .5 + i * 1.3) * .5); });
    if (lively) { petT -= dt; if (petT < 0) { petT = .7; v1.set(rnd(-4, 0), rnd(2.5, 4.5), rnd(-4, 2)); burst(v1, '#FFFFFF', 1, true); } }
    parts.forEach(q => { if (q.life <= 0) return; q.life -= dt; if (q.life <= 0) { q.m.visible = false; return; } q.v.y -= q.g * dt; q.v.multiplyScalar(1 - (q.g > 1 ? 1.6 : .1) * dt); q.v.x += Math.sin(t * 8 + q.ph) * 1.5 * dt; q.m.position.addScaledVector(q.v, dt); q.m.rotation.x += dt * 6; q.m.rotation.z += dt * 4; const s = Math.min(1, q.life / .4); q.m.scale.set(.07 * s, .018 * s, .13 * s); });

    const fs = sel != null ? flowers.get(sel) : null;
    if (fs && !fs.fly) { lookT.set(fs.x, gy(fs.x, fs.z) + .55, fs.z); posT.set(fs.x - Math.sign(fs.x || 1) * 2.6, 6.0, fs.z + 6.2); } else if (hMode === 1) { lookT.copy(doorLook); posT.copy(doorPos); }
    else if (hMode === 2) { const b = bays.get(curW), sf = selF != null && b ? b.frames[selF] : null, wx = wallX(curW) - pan, fx = sf ? sf.x * .6 : 0, fy = sf ? 1.62 + (sf.y - 1.62) * .6 : 1.62; lookT.copy(IN).add(v1.set(wx + fx, fy, 0)); posT.copy(IN).add(v1.set(wx + fx, fy + .38, sf ? 3.5 : 4.6)); }
    else if (hMode === 3) { lookT.copy(IN).add(v1.set(wallX(curW), 1.62, 0)); posT.copy(IN).add(v1.set(wallX(curW), 1.9, 7.2)); }
    else if (decoOn) { lookT.set(0, -4.6, -1); posT.set(0, 13.5, 16.5); }
    else { lookT.copy(baseLook); posT.copy(basePos); }
    const ie = still ? 1 : clamp((t - t0) / 3, 0, 1), e = 1 - Math.pow(1 - ie, 3);
    posT.lerpVectors(introPos, posT, e); lookT.lerpVectors(introLook, lookT, e);
    const ck = still ? 1 : 1 - Math.exp(-dt * (hMode === 2 && drag ? 14 : hMode ? 3.4 : 2.6)), inK = hMode === 2 || hMode === 3 ? .2 : 1; camPos.lerp(posT, ck); camLook.lerp(lookT, ck);
    yaw = damp(yaw, yawT, 5, dt); pxs = damp(pxs, still ? 0 : px, 3, dt); pys = damp(pys, still ? 0 : py, 3, dt);
    v1.copy(camPos).sub(camLook).applyAxisAngle(UP, (yaw - pxs * .04) * inK); camera.position.copy(camLook).add(v1);
    camera.position.x += Math.sin(t * .25) * .2 * Math.min(1, amp) * inK; camera.position.y += (-pys * .3 + Math.sin(t * .31) * .08 * Math.min(1, amp)) * inK; camera.lookAt(camLook);
    camera.updateMatrixWorld();

    const tall = opt.layout === 'Tall stems'; camR.set(1, 0, 0).applyQuaternion(camera.quaternion);
    const pills = [];
    flowers.forEach(f => {
      if (f.fly) return;
      const txt = tall ? (f.d.d ? String(f.d.d) : 'New') : f.d.s;
      if (txt !== f.txt) { f.txt = txt; const p = txt.split('|'); f.label.innerHTML = p[0] + (p[1] ? '<br><span style="color:var(--pink,#9C2580)">' + p[1] + '</span>' : '') + (tall ? '' : '<i style="position:absolute;left:50%;bottom:-4px;width:9px;height:9px;margin-left:-4.5px;background:inherit;transform:rotate(45deg);border-radius:2px"></i>'); f.label.setAttribute('aria-label', f.d.t); f.lw = f.label.offsetWidth || 60; f.lh = f.label.offsetHeight || 16; }
      const on = hMode === 0 && f.grow > .6 && f.delay <= 0 && (tall ? (sel == null || sel === f.id) : (sel == null && (f.id === hoverId || f.id === pickId)));
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
    { const gOn = guest.mode !== 'off'; guestLabel.style.opacity = gOn && hMode === 0 ? 1 : 0; if (gOn) { v1.copy(guest.pos); v1.y += .32; proj(v1, guestLabel, true); } }
    sunO = damp(sunO, sel != null || houseOpen ? 0 : 1, 4, dt); sunG.traverse(o => { if (o.material) { o.material.transparent = true; o.material.opacity = sunO; } });
    sky.position.copy(camera.position); skyU.sunDir.value.copy(sunG.position).sub(camera.position).normalize(); // shooting star: a short streak that eases along a falling path inside the current view, brightening then fading
    { shootT += dt; if (shootP < 0 && shootT >= 7 && cur.night > .6 && !still && hMode === 0) { shootT = 0; shootP = 0; camera.getWorldDirection(v1); const az = Math.atan2(v1.x, -v1.z) + rnd(-.15, .15), el = rnd(-.02, .1), az2 = az + (Math.random() < .5 ? -1 : 1) * rnd(.1, .17), el2 = el - rnd(.06, .1); shootS.set(Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el)); shootE.set(Math.sin(az2) * Math.cos(el2), Math.sin(el2), -Math.cos(az2) * Math.cos(el2)); }
      if (shootP >= 0) { shootP += dt / .9; const p = Math.min(1, shootP), q = 1 - (1 - p) * (1 - p); v1.lerpVectors(shootS, shootE, q).normalize(); v2.lerpVectors(shootS, shootE, Math.max(0, q - .32)).normalize(); const len = v1.distanceTo(v2) * 270; camR.subVectors(v1, v2).normalize(); shoot.position.addVectors(v1, v2).multiplyScalar(135); v2.copy(shoot.position).normalize().negate(); _m.makeBasis(camR, _u.crossVectors(v2, camR), v2); shoot.quaternion.setFromRotationMatrix(_m); shoot.scale.set(Math.max(.01, len), 1.7, 1); shoot.material.opacity = Math.sin(Math.PI * p) * .95; shoot.visible = true; if (shootP >= 1) { shootP = -1; shoot.visible = false; } } }
    renderer.render(scene, camera);
  }
  raf = requestAnimationFrame(frame);

  return {
    setIdeas, setOptions, pick, water, visit,
    snapshot() { renderer.render(scene, camera); return cv.toDataURL('image/jpeg', .92); },
    setMemories,
    setHouse(v) { v = !!v; if (v === houseOpen) return; houseOpen = v; if (v) { if (hMode === 0 || hMode === 4) { hMode = 1; hT = 0; } else if (hMode === 3) { hMode = 2; hT = .6; } } else if (hMode === 2) { hMode = 3; hT = 0; } else if (hMode === 1) hMode = 0; },
    setDecor(v) { decoOn = !!v; },
    selectFrame(i) { selF = i; }, setWall,
    select(id) { sel = id; },
    restart() { [...flowers.values()].forEach(removeFlower); pend = []; t0 = tNow; hMode = 0; houseOpen = false; glow = 0; selF = null; decoOn = false; pan = 0; jump = null; jumpG = 0; camPos.copy(introPos); camLook.copy(introLook); bee.mode = 'off'; bee.g.visible = false; pickId = null; },
    dispose() { cancelAnimationFrame(raf); ro.disconnect(); cv.removeEventListener('pointermove', onMove); cv.removeEventListener('pointerdown', onDown); cv.removeEventListener('pointerup', onUp); cv.removeEventListener('pointerleave', onLeave); renderer.dispose(); cv.remove(); glowEl.remove(); }
  };
}
