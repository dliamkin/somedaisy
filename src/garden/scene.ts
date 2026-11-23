// The garden: a little house on a hilltop, with one daisy in the yard for every idea. A flower's
// shape shows how far its idea has come, its leaves show who has voted, a date marker shows it is
// planned, and a finished idea flies into the house, where it hangs in a frame in the hallway.
//
// This file grows the flowers, moves the camera, answers taps and draws each frame. It is web code:
// it needs a browser's canvas, so it runs on the website as it is and inside a web view on phones
// (see src/components/garden-view.tsx). It is driven entirely by what it is handed: the whole list
// of flowers after every change, the walls of finished ideas, and the options below.
//
// Ported from the design handoffs (design_handoff_garden_a_v2/garden3d-v2.js is the newer), whose
// numbers are final. Of the handoffs' review options, this is the Meadow layout with daisy petals
// in the list's colour and vote leaves on.

import * as THREE from 'three';

import { buildCreatures } from './creatures';
import { buildExtras } from './extras';
import { clamp, damp, groundY, wind } from './ground';
import { buildHallway } from './hallway';
import { makeKit, QUALITY } from './kit';
import { buildLand } from './land';
import { DAYLIGHT, DOOR_GLOW, PAINT, SEASONS, SOIL, type Daylight, type LawnStyle, type Season, type TimeOfDay } from './palette';
import { freePlace, LEAVES, leafSize, placeOf, SHAPES, stemHeight, type Flower, type Memory } from './plan';
import { buildGrass, buildMeadow, buildTrees, TREES } from './plants';
import { buildSky } from './sky';

export type GardenOptions = {
  time: TimeOfDay;
  /** Nothing sways, flies or eases: for people who have asked for less motion. */
  still: boolean;
  /** How many petals of the daisy in the sky are filled in: one for each rank the group has reached. */
  earned: number;
  /** The colour of each leaf on a flower, one for each member, in the order of every flower's votes. */
  leaves: string[];
  season: Season;
  lawn: LawnStyle;
  /** The colours the group has painted its house. */
  roof: string;
  walls: string;
  door: string;
  /** Each is true once the group has earned it and has it switched on. */
  bench: boolean;
  bath: boolean;
  lights: boolean;
};

export type GardenEvents = {
  /** A flower was tapped, or the empty ground was (null). */
  onSelect: (id: string | null) => void;
  /** A finished flower has landed in the house. */
  onLanded: (id: string) => void;
  /** The bee has reached the flower it was sent to. */
  onPickArrive: (id: string) => void;
  /** The door was tapped, in the garden. */
  onDoor: () => void;
  /** The camera has arrived inside the house (true), or is back at the doorway (false). */
  onInside: (inside: boolean) => void;
  /** A swipe moved to another wall, or a far jump has landed there. */
  onWall: (index: number) => void;
  /** A frame on the wall in view was tapped (its place, 0 to 11), or the bare wallpaper was (null). */
  onFrame: (slot: number | null) => void;
  /** The watering can has poured on a flower. */
  onWatered: (id: string) => void;
  /** A visiting friend's butterfly has landed. `who` is whatever `visit` was called with. */
  onVisit: (who: string, id: string) => void;
};

export type GardenSetup = {
  /** "full" for a computer, "light" for a phone (see `QUALITY` in kit.ts). */
  quality: keyof typeof QUALITY;
  options: GardenOptions;
  /**
   * The fonts, as CSS writes them: for the name over a flower, for the number on a date marker,
   * and the family alone for the name under a pressed flower in a frame.
   */
  fonts: { tag: string; marker: string; caption: string };
};

/** How new flowers come up: one after another once the camera has arrived, one after another at once, or straight away. */
type Arrival = 'intro' | 'together' | 'now';

/** The shapes one flower is made of, and its name tag. */
type Parts = {
  g: THREE.Group;
  /** The two lengths of the stem. The upper one carries the head. */
  lower: THREE.Group;
  upper: THREE.Group;
  lowerStem: THREE.Mesh;
  upperStem: THREE.Mesh;
  headPivot: THREE.Group;
  headIn: THREE.Group;
  petalPaint: THREE.MeshLambertMaterial;
  /** Each petal with the hinge it folds on. */
  petals: [THREE.Group, THREE.Mesh][];
  centerMesh: THREE.Mesh;
  leaves: { pivot: THREE.Group; paint: THREE.MeshLambertMaterial; size: number }[];
  markerGroup: THREE.Group;
  plaque: THREE.Mesh;
  markerPaint: THREE.MeshBasicMaterial;
  soil: THREE.Mesh;
  /** Unseen shapes round the stem and the head, for a tap that just misses. */
  hit: THREE.Mesh;
  hitHead: THREE.Mesh;
  ring: THREE.Mesh<THREE.TorusGeometry, THREE.MeshBasicMaterial>;
  label: HTMLDivElement;
  words: HTMLSpanElement;
};

type Bloom = Parts & {
  id: string;
  d: Flower;
  slot: number;
  /** Its height now, how open it is, and so on: each chases what its stage asks for. */
  height: number;
  fold: number;
  foldV: number;
  center: number;
  tilt: number;
  head: number;
  headV: number;
  grow: number;
  /** Seconds still to wait before it comes up. */
  delay: number;
  marker: number;
  markerV: number;
  x: number;
  z: number;
  toX: number;
  toZ: number;
  placed: boolean;
  /** How far it has shrunk back because another flower is chosen or the house is open, from 0 to 1. */
  dimmed: number;
  /** Set while it flies into the house. */
  fly: { t: number; from: THREE.Vector3 } | null;
  ringShown: number;
  headAt: THREE.Vector3;
  /** The words on its tag right now, and how wide that makes it. */
  text: string;
  tagWide: number;
};

/** A daisy's petal: how wide and how long. */
const PETAL = [0.105, 0.27];
/** How long a finished flower takes to fly into the house, in seconds. */
const FLIGHT = 1.25;

/**
 * Where the camera is in its trip into the house and back: in the garden, flying to the door,
 * inside, leaving (still inside, with the glow rising), and back outside at the doorway.
 */
const GARDEN = 0;
const TO_DOOR = 1;
const INSIDE = 2;
const LEAVING = 3;
const BACK_OUT = 4;

const ease = (x: number) => {
  const c = clamp(x, 0, 1);
  return c * c * (3 - 2 * c);
};
const chance = (a: number, b: number) => a + Math.random() * (b - a);

export type Garden = ReturnType<typeof createGarden>;

/**
 * Builds the garden inside `host` and starts drawing it. `labelHost` is a box laid over it, where
 * the names over flowers go. Throws if the browser cannot start WebGL.
 */
export function createGarden(host: HTMLElement, labelHost: HTMLElement, events: GardenEvents, setup: GardenSetup) {
  const quality = QUALITY[setup.quality];
  const opt: GardenOptions = { ...setup.options };

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, quality.pixelRatio));
  renderer.shadowMap.enabled = true;
  const canvas = renderer.domElement;
  canvas.style.cssText = 'display:block;width:100%;height:100%;touch-action:none;cursor:grab';
  host.appendChild(canvas);
  // The warm light that fills the screen on the way through the door, hiding the move to the hallway.
  const glowBox = document.createElement('div');
  glowBox.style.cssText = `position:absolute;top:0;right:0;bottom:0;left:0;pointer-events:none;opacity:0;background:radial-gradient(circle at 50% 46%,${DOOR_GLOW[0]} 0%,${DOOR_GLOW[1]} 75%)`;
  host.appendChild(glowBox);
  const world = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(52, 1, 0.1, 400);
  let wide = 390;
  let tall = 844;
  const fit = () => {
    wide = host.clientWidth || 390;
    tall = host.clientHeight || 844;
    renderer.setSize(wide, tall, false);
    camera.aspect = wide / tall;
    camera.updateProjectionMatrix();
  };
  fit();
  const watchSize = new ResizeObserver(fit);
  watchSize.observe(host);

  // Built in this order on purpose: each part takes its made-up numbers from the same run.
  const kit = makeKit(world, quality);
  const { lambert, basic, mesh, ball } = kit;
  const land = buildLand(kit);
  buildTrees(kit);
  buildGrass(kit, land.stones);
  const meadow = buildMeadow(kit);
  const extras = buildExtras(kit, land);
  const skyParts = buildSky(kit, land, opt.time);
  land.setEarned(opt.earned);

  // The time of day as it is drawn right now. It starts as asked and blends toward any change.
  const colorKeys = ['sky', 'foliage', 'haze', 'skyLight', 'groundLight', 'sun', 'windowPane', 'skyDaisy', 'stem'] as const;
  const numberKeys = ['skyLightStrength', 'sunStrength', 'skyDaisyY', 'night', 'windowLight'] as const;
  const first: Daylight = DAYLIGHT[opt.time];
  const lightNow = {
    ...Object.fromEntries(colorKeys.map((k) => [k, new THREE.Color(first[k])])),
    ...Object.fromEntries(numberKeys.map((k) => [k, first[k]])),
  } as Record<(typeof colorKeys)[number], THREE.Color> & Record<(typeof numberKeys)[number], number>;
  const tmpColor = new THREE.Color();
  const tmpColor2 = new THREE.Color();
  const v1 = new THREE.Vector3();
  const v2 = new THREE.Vector3();
  const UP = new THREE.Vector3(0, 1, 0);
  /** How brightly the attic window is flashing because a flower has just landed, from 1 down to 0. */
  let flash = 0;

  // The season, the lawn and the house's paint also start as asked. Only a later change blends in.
  const lawnHeight = (lawn: LawnStyle) => (lawn === 'mown' ? 0.42 : lawn === 'meadow' ? 1.75 : 1);
  kit.season.value.set(opt.season === 'spring' ? 1 : 0, opt.season === 'autumn' ? 1 : 0, opt.season === 'winter' ? 1 : 0, 0);
  kit.lawnStyle.value.set(lawnHeight(opt.lawn) * (opt.season === 'winter' ? 0.5 : 1), opt.lawn === 'mown' ? 1 : 0, opt.lawn === 'meadow' && opt.season !== 'winter' ? 1 : 0);
  land.wallPaint.color.set(opt.walls);
  land.roofPaint.color.set(opt.roof);
  land.doorPaint.color.set(opt.door);
  /** Seconds until a tree next lets go of a leaf or a petal. */
  let nextDrift = 0;

  // A patch of bare soil travels with each flower.
  const soilPicture = document.createElement('canvas');
  soilPicture.width = soilPicture.height = 128;
  {
    const pen = soilPicture.getContext('2d');
    if (pen) {
      const g = pen.createRadialGradient(64, 64, 0, 64, 64, 64);
      g.addColorStop(0, `rgba(${SOIL.middle},1)`);
      g.addColorStop(0.5, `rgba(${SOIL.mid},.95)`);
      g.addColorStop(0.8, `rgba(${SOIL.edge},.5)`);
      g.addColorStop(1, `rgba(${SOIL.rim},0)`);
      pen.fillStyle = g;
      pen.fillRect(0, 0, 128, 128);
      for (let i = 0; i < 220; i++) {
        const a = kit.rand() * 6.28;
        const r = Math.sqrt(kit.rand()) * 44;
        pen.fillStyle = kit.rand() < 0.5 ? `rgba(${SOIL.crumbDark},.55)` : `rgba(${SOIL.crumbPale},.5)`;
        pen.beginPath();
        pen.arc(64 + Math.cos(a) * r, 64 + Math.sin(a) * r, 1 + kit.rand() * 2.2, 0, 6.28);
        pen.fill();
      }
    }
  }
  const soilTexture = new THREE.CanvasTexture(soilPicture);
  soilTexture.colorSpace = THREE.SRGBColorSpace;
  const soilShape = new THREE.CircleGeometry(0.36, 20).rotateX(-Math.PI / 2);
  const soilPaint = lambert(PAINT.white, { map: soilTexture, transparent: true, depthWrite: false });
  kit.tinted.push(soilPaint);

  // The shapes every flower is made of.
  const stemShape = new THREE.CylinderGeometry(0.035, 0.05, 1, 7).translate(0, 0.5, 0);
  const calyxShape = new THREE.ConeGeometry(0.14, 0.22, 8).rotateX(Math.PI).translate(0, -0.06, 0);
  const centerShape = new THREE.SphereGeometry(0.17, 18, 12);
  const hitShape = new THREE.CylinderGeometry(0.5, 0.5, 1, 8).translate(0, 0.5, 0);
  const hitPaint = basic(PAINT.black, { transparent: true, opacity: 0, depthWrite: false });
  const stakeShape = new THREE.CylinderGeometry(0.025, 0.025, 0.7, 6).translate(0, 0.35, 0);
  const stakePaint = lambert(PAINT.trim);
  const ringShape = new THREE.TorusGeometry(0.55, 0.035, 8, 44);
  const centerPaint = lambert(PAINT.center);
  const plaqueShape = new THREE.BoxGeometry(0.52, 0.38, 0.05);
  const plaqueFace = new THREE.PlaneGeometry(0.46, 0.32);

  const flowers = new Map<string, Bloom>();
  /** Everything a tap can land on when it misses a flower's own shapes: an unseen column and ball for each, and its date marker. */
  const hits: THREE.Object3D[] = [];
  let selected: string | null = null;
  /** The flower under the pointer, and the one a keyboard has reached. Either shows its name. */
  let hovered: string | null = null;
  let focused: string | null = null;
  /** Bursts of petals waiting their moment, a beat after a flower opens. */
  let waiting: { t: number; id: string; color: string | null }[] = [];

  const creatures = buildCreatures(kit, {
    flowers,
    selected: () => selected,
    onPickArrive: events.onPickArrive,
    onWatered: events.onWatered,
    onVisit: events.onVisit,
  });

  // The camera: where it rests, where it starts from, and where it is now.
  const restAt = new THREE.Vector3(0, 6.6, 13.5);
  const restLook = new THREE.Vector3(0, 1.3, -1.2);
  const introAt = new THREE.Vector3(0, 11, 21);
  const introLook = new THREE.Vector3(0, 7, -12);
  /** While "Our garden" is open the camera pulls back and up, so the house, the lawn and the extras all show above the sheet. */
  const overviewAt = new THREE.Vector3(0, 13.5, 16.5);
  const overviewLook = new THREE.Vector3(0, -4.6, -1);
  const camAt = introAt.clone();
  const camLook = introLook.clone();
  const goAt = new THREE.Vector3();
  const goLook = new THREE.Vector3();

  // The house: whether it has been asked for, and where the camera is on its way in or out.
  let houseOpen = false;
  let mode = GARDEN;
  /** Seconds since the camera's trip last moved on a step. */
  let modeT = 0;
  let glow = 0;
  /** How far the door has swung. It opens a crack under the pointer. */
  let doorSwing = 0;
  let doorHover = false;
  let overview = false;
  const hall = buildHallway(kit, setup.fonts.caption, (dx, wall) => {
    // A far jump has landed: the camera is moved along the hallway under the glow.
    camAt.x += dx;
    camLook.x += dx;
    events.onWall(wall);
  });

  // The number on a date marker is painted once for each day of the month and kept.
  const dayPictures = new Map<string, THREE.CanvasTexture>();
  const dayPicture = (day: string) => {
    const kept = dayPictures.get(day);
    if (kept) return kept;
    const c = document.createElement('canvas');
    c.width = 184;
    c.height = 128;
    const pen = c.getContext('2d');
    if (pen) {
      pen.fillStyle = PAINT.white;
      pen.fillRect(0, 0, 184, 128);
      pen.strokeStyle = PAINT.ring;
      pen.lineWidth = 12;
      pen.strokeRect(6, 6, 172, 116);
      pen.fillStyle = PAINT.ink;
      pen.font = setup.fonts.marker;
      pen.textAlign = 'center';
      pen.textBaseline = 'middle';
      pen.fillText(day, 92, 70);
    }
    const texture = new THREE.CanvasTexture(c);
    texture.colorSpace = THREE.SRGBColorSpace;
    dayPictures.set(day, texture);
    return texture;
  };

  /** The name that appears over a flower: a small rounded tag with a pointer under it. */
  const makeLabel = () => {
    const label = document.createElement('div');
    label.setAttribute('aria-hidden', 'true');
    label.style.cssText = `position:absolute;left:0;top:0;font:${setup.fonts.tag};padding:1px 7px;border-radius:9px;white-space:nowrap;text-align:center;opacity:0;transition:opacity .35s;will-change:transform;background:var(--garden-card);color:var(--garden-ink)`;
    const pointer = document.createElement('i');
    pointer.style.cssText = 'position:absolute;left:50%;bottom:-4px;width:9px;height:9px;margin-left:-4.5px;background:inherit;transform:rotate(45deg);border-radius:2px';
    const words = document.createElement('span');
    words.style.cssText = 'position:relative';
    label.append(pointer, words);
    labelHost.appendChild(label);
    return { label, words };
  };
  // The name that floats over a visiting friend's butterfly: a dark pill, the same in light and dark mode.
  const visitorLabel = document.createElement('div');
  visitorLabel.setAttribute('aria-hidden', 'true');
  visitorLabel.style.cssText = `position:absolute;left:0;top:0;font:${setup.fonts.tag};padding:1px 7px;border-radius:9px;white-space:nowrap;text-align:center;opacity:0;transition:opacity .35s;will-change:transform;background:${PAINT.ink};color:${PAINT.white}`;
  labelHost.appendChild(visitorLabel);

  const taken = () => new Set([...flowers.values()].filter((f) => !f.fly).map((f) => f.slot));

  /** `fresh` is for an idea that has just been added, which takes a place in the front row. */
  function makeFlower(d: Flower, delay: number, fresh: boolean): Bloom {
    const g = new THREE.Group();
    // The stem is two lengths, so it can bend in the wind. The head rides on the upper one.
    const lower = new THREE.Group();
    g.add(lower);
    const lowerStem = mesh(stemShape, land.stemPaint);
    lower.add(lowerStem);
    const upper = new THREE.Group();
    lower.add(upper);
    const upperStem = mesh(stemShape, land.stemPaint);
    upper.add(upperStem);
    const headPivot = new THREE.Group();
    upper.add(headPivot);
    const headIn = new THREE.Group();
    headPivot.add(headIn);
    headIn.add(mesh(calyxShape, land.stemPaint));
    const petalPaint = lambert(d.color);
    const petals: [THREE.Group, THREE.Mesh][] = [];
    for (let i = 0; i < 8; i++) {
      const pivot = new THREE.Group();
      pivot.rotation.y = (i * Math.PI) / 4;
      const hinge = new THREE.Group();
      pivot.add(hinge);
      const m = mesh(ball, petalPaint);
      hinge.add(m);
      headIn.add(pivot);
      petals.push([hinge, m]);
    }
    const centerMesh = mesh(centerShape, centerPaint);
    headIn.add(centerMesh);
    // One leaf for each member the garden can show. Those with nobody to stand for stay folded away.
    const leaves = LEAVES.map((where) => {
      const pivot = new THREE.Group();
      pivot.rotation.y = where.turn;
      const lift = new THREE.Group();
      lift.rotation.z = 0.5;
      pivot.add(lift);
      const paint = lambert(PAINT.stem);
      const m = mesh(ball, paint, 0.25, 0, 0);
      m.scale.set(0.24, 0.035, 0.105);
      lift.add(m);
      pivot.scale.setScalar(0.001);
      (where.half === 'lower' ? lower : upper).add(pivot);
      return { pivot, paint, size: 0 };
    });
    // The date marker: a white plaque on a stake behind the bloom, with the day of the month on it.
    const markerGroup = new THREE.Group();
    markerGroup.rotation.x = -0.2;
    const stake = mesh(stakeShape, stakePaint, 0, -0.75, 0);
    stake.scale.y = 0.4;
    markerGroup.add(stake);
    const plaque = mesh(plaqueShape, land.white, 0, -0.32, 0);
    plaque.userData.id = d.id;
    markerGroup.add(plaque);
    const markerPaint = new THREE.MeshBasicMaterial({ color: PAINT.white });
    markerGroup.add(mesh(plaqueFace, markerPaint, 0, -0.32, 0.03, false));
    markerGroup.visible = false;
    headPivot.add(markerGroup);
    const soil = new THREE.Mesh(soilShape, soilPaint);
    soil.position.y = 0.034;
    soil.receiveShadow = true;
    g.add(soil);
    g.userData.id = d.id;
    const hit = new THREE.Mesh(hitShape, hitPaint);
    hit.userData.proxy = true;
    hit.userData.id = d.id;
    g.add(hit);
    hits.push(hit);
    const hitHead = new THREE.Mesh(ball, hitPaint);
    hitHead.scale.setScalar(0.72);
    hitHead.userData.proxy = true;
    hitHead.userData.id = d.id;
    headPivot.add(hitHead);
    hits.push(hitHead);
    const ring = mesh(ringShape, basic(PAINT.ring, { transparent: true, opacity: 0 }), 0, 0.04, 0, false);
    ring.rotation.x = -Math.PI / 2;
    ring.userData.proxy = true;
    headPivot.add(ring);
    g.visible = false;
    kit.scene.add(g);
    const f: Bloom = {
      id: d.id,
      d,
      g,
      slot: freePlace(taken(), fresh),
      height: 0,
      fold: 1.5,
      foldV: 0,
      center: 0,
      tilt: 0,
      head: 0.2,
      headV: 0,
      grow: 0,
      delay,
      marker: 0,
      markerV: 0,
      x: 0,
      z: 0,
      toX: 0,
      toZ: 0,
      placed: false,
      dimmed: 0,
      fly: null,
      ringShown: 0,
      headAt: new THREE.Vector3(),
      text: '',
      tagWide: 60,
      lower,
      upper,
      lowerStem,
      upperStem,
      headPivot,
      headIn,
      petalPaint,
      petals,
      centerMesh,
      leaves,
      markerGroup,
      plaque,
      markerPaint,
      soil,
      hit,
      hitHead,
      ring,
      ...makeLabel(),
    };
    flowers.set(d.id, f);
    return f;
  }

  const dropHits = (id: string) => {
    for (let k = hits.length - 1; k >= 0; k--) if (hits[k].userData.id === id) hits.splice(k, 1);
  };
  function removeFlower(f: Bloom) {
    kit.scene.remove(f.g);
    f.label.remove();
    f.petalPaint.dispose();
    f.leaves.forEach((l) => l.paint.dispose());
    f.markerPaint.dispose();
    f.ring.material.dispose();
    dropHits(f.id);
    flowers.delete(f.id);
  }

  /**
   * The whole list of flowers, as it now stands. New ones come up, ones that are gone are taken
   * out, and one whose stage has changed opens with a bounce. `arrival` says how new ones come up.
   */
  function setFlowers(list: Flower[], arrival: Arrival = 'now') {
    const ids = new Set(list.map((d) => d.id));
    for (const f of [...flowers.values()]) if (!ids.has(f.id) && !f.fly) removeFlower(f);
    list.forEach((d, i) => {
      let f = flowers.get(d.id);
      if (!f) {
        // One that has already flown is not planted again while the app catches up.
        if (d.fly) return;
        // In a still garden nothing waits its turn: every flower is there from the start.
        const delay = opt.still ? 0 : arrival === 'intro' ? 1.3 + i * 0.17 : arrival === 'together' ? 0.15 + i * 0.1 : 0.05;
        f = makeFlower(d, delay, arrival === 'now');
      } else {
        if (f.d.stage !== d.stage && !d.fly) {
          f.headV += 2.4;
          if (d.stage === 3) waiting.push({ t: 0.4, id: d.id, color: null });
          if (d.stage === 4) waiting.push({ t: 0.25, id: d.id, color: PAINT.center });
        }
        f.d = d;
        if (d.fly && !f.fly) {
          f.fly = { t: 0, from: f.g.position.clone() };
          f.ring.visible = false;
          f.soil.visible = false;
          dropHits(f.id);
        }
      }
      f.petalPaint.color.set(d.color);
      if (d.day) {
        f.markerPaint.map = dayPicture(d.day);
        f.markerPaint.needsUpdate = true;
      }
    });
    for (const f of flowers.values()) {
      if (f.fly) continue;
      [f.toX, f.toZ] = placeOf(f.slot);
    }
  }

  function moveFlower(f: Bloom, dt: number, t: number, amp: number, snap: boolean) {
    const d = f.d;
    const g = f.g;
    if (f.fly) {
      // An arc from where it stood to the attic window, shrinking and spinning as it goes.
      const a = f.fly;
      a.t += dt / FLIGHT;
      const e = a.t < 1 ? a.t * a.t * (3 - 2 * a.t) : 1;
      g.position.lerpVectors(a.from, land.atticAt, e);
      g.position.y += Math.sin(Math.PI * e) * 2.4;
      g.scale.setScalar(1 - 0.86 * e);
      g.rotation.y += dt * 9;
      f.label.style.opacity = '0';
      if (a.t >= 1) {
        if (!opt.still) creatures.burst(land.atticAt, d.color, 18);
        flash = 1;
        const id = f.id;
        removeFlower(f);
        events.onLanded(id);
      }
      return;
    }
    if (!f.placed) {
      f.x = f.toX;
      f.z = f.toZ;
      f.placed = true;
    }
    const walk = snap ? 60 : 3.2;
    f.x = damp(f.x, f.toX, walk, dt);
    f.z = damp(f.z, f.toZ, walk, dt);
    g.position.set(f.x, groundY(f.x, f.z) - 0.02, f.z);
    // While one flower is chosen, the others shrink back. They all do while the house is open.
    f.dimmed = damp(f.dimmed, (selected != null && selected !== f.id) || houseOpen ? 1 : 0, snap ? 60 : 6, dt);
    g.scale.setScalar(1 - 0.65 * f.dimmed);
    if (f.delay > 0) {
      f.delay -= dt;
      return;
    }
    g.visible = true;
    const shape = SHAPES[d.stage];
    f.grow = damp(f.grow, 1, snap ? 60 : 2.2, dt);
    f.height = damp(f.height, stemHeight(d), snap ? 60 : 3, dt);
    const H = f.height * f.grow;
    const lit = hovered === f.id || focused === f.id;
    if (snap) {
      f.fold = shape.fold;
      f.foldV = 0;
      f.head = shape.head;
      f.headV = 0;
      f.marker = d.stage === 4 ? 1 : 0;
      f.markerV = 0;
      f.center = shape.center;
      f.tilt = shape.tilt;
    } else {
      // Petals and head are on springs, so a change of stage opens with a bounce.
      f.foldV += ((shape.fold - f.fold) * 70 - f.foldV * 10) * dt;
      f.fold += f.foldV * dt;
      f.headV += ((shape.head * (lit ? 1.1 : 1) - f.head) * 90 - f.headV * 9) * dt;
      f.head += f.headV * dt;
      f.markerV += (((d.stage === 4 ? 1 : 0) - f.marker) * 90 - f.markerV * 10) * dt;
      f.marker += f.markerV * dt;
      f.center = damp(f.center, shape.center, 5, dt);
      f.tilt = damp(f.tilt, shape.tilt, 3.5, dt);
    }
    f.markerGroup.visible = f.marker > 0.02;
    f.markerGroup.scale.setScalar(Math.max(0.001, f.marker * 0.9));
    const half = H * 0.5;
    f.lowerStem.scale.y = Math.max(0.001, half);
    f.upperStem.scale.y = Math.max(0.001, half);
    f.upper.position.y = half;
    f.headPivot.position.y = half;
    const w = wind(f.x, f.z, t, amp);
    const w2 = wind(f.z + 3, f.x - 2, t * 0.9 + 1.7, amp);
    f.lower.rotation.set(w2 * 0.03, 0, w * 0.06);
    f.upper.rotation.set(w2 * 0.05, 0, w * 0.1);
    f.headPivot.rotation.set(f.tilt + w2 * 0.05, 0, -w * 0.12);
    {
      // The marker stands upright behind the bloom however far the head has tipped.
      const ct = Math.cos(f.tilt);
      const sn = Math.sin(f.tilt);
      f.markerGroup.position.set(0, 0.95 * ct - 0.25 * sn, -0.95 * sn - 0.25 * ct);
      f.markerGroup.rotation.set(-f.tilt - 0.2, 0, 0);
    }
    f.headIn.scale.setScalar(Math.max(0.001, f.head * f.grow));
    const narrow = 1 - clamp((f.fold - 0.16) / 1.22, 0, 1) * 0.25;
    for (const [hinge, m] of f.petals) {
      hinge.rotation.x = -f.fold;
      m.scale.set(PETAL[0] * narrow, 0.035, PETAL[1]);
      m.position.set(0, 0, 0.12 + PETAL[1] * 0.92);
    }
    const cs = Math.max(0.001, f.center);
    f.centerMesh.scale.set(cs, cs * 0.55, cs);
    f.leaves.forEach((leaf, m) => {
      const mine = m < opt.leaves.length;
      const vote = d.votes[m];
      leaf.size = damp(leaf.size, mine ? leafSize(vote) * f.grow : 0, snap ? 60 : 6, dt);
      leaf.pivot.scale.setScalar(Math.max(0.001, leaf.size));
      leaf.pivot.position.y = LEAVES[m].up * half;
      // A leaf takes its member's colour once they have answered. Until then it is the colour of the stem.
      if (mine && vote) tmpColor.set(opt.leaves[m]);
      else tmpColor.copy(lightNow.stem);
      leaf.paint.color.lerp(tmpColor, snap ? 1 : 1 - Math.exp(-dt * 6));
    });
    f.hit.scale.set(0.6, Math.max(0.05, H), 0.6);
    {
      const r = (0.3 + 0.4 * clamp((1.38 - f.fold) / 1.22, 0, 1)) * Math.max(0.2, f.head * f.grow);
      f.hitHead.scale.set(r, 0.3, r);
      const at = hits.indexOf(f.plaque);
      if (f.markerGroup.visible && at < 0) hits.push(f.plaque);
      else if (!f.markerGroup.visible && at >= 0) hits.splice(at, 1);
    }
    const picked = creatures.picked() === f.id;
    const ringAsked = selected === f.id ? 0.95 : picked ? 0.55 + 0.45 * Math.sin(t * 7) : 0;
    f.ringShown = damp(f.ringShown, ringAsked, 8, dt);
    f.ring.material.opacity = f.ringShown;
    f.ring.visible = f.ringShown > 0.01;
    f.ring.scale.setScalar(1.35 * (picked ? 1 + 0.12 * Math.sin(t * 7) : 1));
    g.updateMatrixWorld(true);
    f.headIn.localToWorld(f.headAt.set(0, 0.1, 0));
  }

  let pointerX = 0;
  let pointerY = 0;
  let pointerXSoft = 0;
  let pointerYSoft = 0;
  let drag: { x: number; y: number; yaw: number } | null = null;
  let yawAsked = 0;
  let yaw = 0;
  let moved = 0;
  let clock = 0;
  const ray = new THREE.Raycaster();
  const aim = new THREE.Vector2();

  /** The flower under the spot in `aim`, if there is one. A flower's own shapes are tried first, then the unseen ones round it. */
  const flowerAt = (): string | null => {
    ray.setFromCamera(aim, camera);
    const roots = [...flowers.values()].filter((f) => !f.fly && f.g.visible).map((f) => f.g);
    for (const h of ray.intersectObjects(roots, true)) {
      if (h.object.userData.proxy) continue;
      let o: THREE.Object3D | null = h.object;
      let seen = true;
      let id: string | null = null;
      while (o) {
        seen = seen && o.visible;
        if (id == null && o.userData.id != null) id = o.userData.id as string;
        o = o.parent;
      }
      if (seen && id != null) return id;
    }
    const near = ray.intersectObjects(hits, false)[0];
    return near ? (near.object.userData.id as string) : null;
  };
  const doorAt = (): boolean => {
    ray.setFromCamera(aim, camera);
    return ray.intersectObject(land.doorHit, false).length > 0;
  };
  const frameAt = (): number | null => {
    ray.setFromCamera(aim, camera);
    return hall.frameAt(ray);
  };
  const onMove = (e: PointerEvent) => {
    const r = canvas.getBoundingClientRect();
    pointerX = ((e.clientX - r.left) / r.width) * 2 - 1;
    pointerY = ((e.clientY - r.top) / r.height) * 2 - 1;
    if (drag) {
      const dx = e.clientX - drag.x;
      moved = Math.max(moved, Math.abs(dx) + Math.abs(e.clientY - drag.y));
      // Inside the house a sideways drag moves along the hallway, the wall following the finger.
      // In the garden it looks round, a little way each side.
      if (mode === INSIDE) hall.drag(dx, r.width);
      else yawAsked = clamp(drag.yaw - dx * 0.006, -0.7, 0.7);
    } else if (e.pointerType === 'mouse') {
      aim.set(pointerX, -pointerY);
      hovered = mode === GARDEN ? flowerAt() : null;
      doorHover = mode === GARDEN && hovered == null && doorAt();
      const frame = mode === INSIDE ? frameAt() : null;
      hall.hover(frame);
      canvas.style.cursor = hovered != null || doorHover || frame != null ? 'pointer' : 'grab';
    }
  };
  const onDown = (e: PointerEvent) => {
    drag = { x: e.clientX, y: e.clientY, yaw: yawAsked };
    moved = 0;
    canvas.style.cursor = 'grabbing';
    try {
      canvas.setPointerCapture(e.pointerId);
    } catch {
      // Not being able to hold on to the pointer only matters if it leaves the garden mid-drag.
    }
  };
  const letGo = () => {
    drag = null;
    yawAsked = 0;
    hall.letGo();
    canvas.style.cursor = 'grab';
  };
  const onUp = (e: PointerEvent) => {
    if (drag && moved < 7) {
      // A press that hardly moved is a tap.
      const r = canvas.getBoundingClientRect();
      aim.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      if (mode === INSIDE) events.onFrame(frameAt());
      else if (mode === GARDEN) {
        // A tap that hits no flower is tried against the door before it counts as a tap on the ground.
        const id = flowerAt();
        if (id == null && doorAt()) events.onDoor();
        else events.onSelect(id);
      }
    } else if (drag && mode === INSIDE && hall.swipe(e.clientX - drag.x)) {
      // A swipe of more than 56 dots steps to the next wall. Less springs back.
      events.onWall(hall.wall());
    }
    letGo();
  };
  const onLeave = () => {
    pointerX = 0;
    pointerY = 0;
    hovered = null;
    doorHover = false;
    hall.hover(null);
  };
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointerup', onUp);
  canvas.addEventListener('pointercancel', letGo);
  canvas.addEventListener('pointerleave', onLeave);

  let frameId = 0;
  let last = performance.now();
  let paused = false;
  let skyDaisyShown = 1;

  function frame(now: number) {
    frameId = requestAnimationFrame(frame);
    const dt = Math.max(0, Math.min(0.05, (now - last) / 1000));
    last = now;
    clock += dt;
    const t = clock;
    const still = opt.still;
    const amp = still ? 0 : 1;
    // A still garden skips the easing once the first frames have placed everything.
    const snap = still && t > 0.3;

    // The time of day, blended toward what is asked for.
    const want = DAYLIGHT[opt.time];
    const k = 1 - Math.exp(-dt * 2.2);
    for (const key of colorKeys) lightNow[key].lerp(tmpColor.set(want[key]), k);
    for (const key of numberKeys) lightNow[key] = damp(lightNow[key], want[key], 2.2, dt);
    land.sky.copy(lightNow.sky);
    land.haze.color.copy(lightNow.haze);
    for (const paint of kit.tinted) paint.color.copy(lightNow.foliage);
    land.farHillPaint.color.set(PAINT.farHill).multiply(lightNow.foliage);
    land.plantPaint.color.set(PAINT.plant).multiply(lightNow.foliage);
    land.skyLight.color.copy(lightNow.skyLight);
    land.skyLight.groundColor.copy(lightNow.groundLight);
    land.skyLight.intensity = lightNow.skyLightStrength;
    land.sun.color.copy(lightNow.sun);
    land.sun.intensity = lightNow.sunStrength;
    land.panePaint.color.copy(lightNow.windowPane);
    land.skyPetalPaint.color.copy(lightNow.skyDaisy);
    land.stemPaint.color.copy(lightNow.stem);
    // The open door lets more of the house's light out.
    land.windowLight.intensity = lightNow.windowLight + flash * 14 - doorSwing * 2.5;
    skyParts.tint(opt.time, k, dt, t, still, lightNow.night);
    flash = Math.max(0, flash - dt * 1.6);
    land.atticPane.scale.setScalar(1 + flash * 0.6);
    land.skyDaisy.position.y = lightNow.skyDaisyY;
    if (!still) land.skyDaisy.rotation.z -= dt * 0.05;
    land.smoke.forEach(({ puff, paint }, i) => {
      const p = ((still ? 0 : t * 0.16) + i / 6) % 1;
      const s = 0.12 + 0.32 * p;
      puff.position.set(land.chimneyAt.x + Math.sin(p * 5 + i) * 0.12 - p * p * 0.9, land.chimneyAt.y + p * 2.3, land.chimneyAt.z);
      puff.scale.set(s, s * 0.85, s);
      paint.opacity = (1 - p) * 0.9;
    });

    kit.time.value = t;
    kit.windAmp.value = amp;

    {
      // The season and the lawn, each blending toward what is asked for.
      const season = kit.season.value;
      const lawn = kit.lawnStyle.value;
      const rate = snap ? 60 : 1.6;
      season.x = damp(season.x, opt.season === 'spring' ? 1 : 0, rate, dt);
      season.y = damp(season.y, opt.season === 'autumn' ? 1 : 0, rate, dt);
      season.z = damp(season.z, opt.season === 'winter' ? 1 : 0, rate, dt);
      // Winter's grass stands half as tall, and a meadow's wildflowers are away.
      lawn.x = damp(lawn.x, lawnHeight(opt.lawn) * (1 - 0.5 * season.z), 3, dt);
      lawn.y = damp(lawn.y, opt.lawn === 'mown' ? 1 : 0, 3, dt);
      lawn.z = damp(lawn.z, opt.lawn === 'meadow' && opt.season !== 'winter' ? 1 : 0, 3, dt);
      meadow.visible = lawn.z > 0.02;
      // The far hills and their trees go tan and olive in autumn, pale and frosted in winter. The valley follows the hills.
      land.farTreePaint.color.multiply(tmpColor.setRGB(1, 1, 1).lerp(tmpColor2.setRGB(1.5, 0.9, 0.5), season.y).lerp(tmpColor2.setRGB(1.7, 1.7, 1.9), season.z));
      land.farHillPaint.color.lerp(tmpColor.set(SEASONS.farAutumn).multiply(lightNow.foliage), season.y * 0.7).lerp(tmpColor.set(SEASONS.farWinter).multiply(lightNow.foliage), season.z * 0.9);
      skyParts.valleyPaint.color.copy(land.farHillPaint.color);
      // The house's paint.
      land.wallPaint.color.lerp(tmpColor.set(opt.walls), k);
      land.roofPaint.color.lerp(tmpColor.set(opt.roof), k);
      land.doorPaint.color.lerp(tmpColor.set(opt.door), k);
      land.gablePaint.color.copy(land.roofPaint.color);
      land.doorFacePaint.color.copy(land.doorPaint.color);
      land.roofSnow.visible = season.z > 0.03;
      land.roofSnow.position.y = 1.82 + 0.08 * season.z;
      extras.update(dt, t, opt, still, snap, lightNow.night, season.z);
      // In spring a pink petal drifts from the trees every half second, and in autumn a leaf every 0.28.
      nextDrift -= dt;
      if (!still && nextDrift < 0 && (season.y > 0.5 || season.x > 0.5)) {
        const autumn = season.y > 0.5;
        nextDrift = autumn ? 0.28 : 0.5;
        const [x, z] = TREES[[0, 3, 3, 1][(Math.random() * 4) | 0]];
        v1.set(x + chance(-1.2, 1.2), groundY(x, z) + chance(2.4, 3.6), z + chance(-1, 1));
        creatures.burst(v1, autumn ? SEASONS.fallingLeaves[(Math.random() * 3) | 0] : SEASONS.blossom, 1, true);
      }
      doorSwing = damp(doorSwing, mode >= TO_DOOR && mode <= LEAVING ? -1.8 : doorHover ? -0.32 : 0, 5, dt);
      land.door.rotation.y = doorSwing;
    }

    {
      // Going inside: the glow rises as the camera reaches the doorway, the camera is moved to the
      // hallway under it, and the glow clears. Coming out is the same the other way. A still garden
      // goes through it twenty times as fast.
      modeT += dt * (still ? 20 : 1);
      if (mode === TO_DOOR) {
        glow = ease((modeT - 0.7) / 0.55);
        if (modeT >= 1.3) {
          mode = INSIDE;
          modeT = 0;
          hall.arrive(camLook, camAt, 7);
          events.onInside(true);
        }
      } else if (mode === INSIDE) glow = 1 - ease(modeT / 0.6);
      else if (mode === LEAVING) {
        glow = ease(modeT / 0.35);
        if (modeT >= 0.4) {
          mode = BACK_OUT;
          modeT = 0;
          hall.select(null);
          camAt.copy(land.doorFrom);
          camLook.copy(land.doorLook);
          events.onInside(false);
        }
      } else if (mode === BACK_OUT) {
        glow = 1 - ease(modeT / 0.6);
        if (modeT >= 0.6) {
          mode = GARDEN;
          hall.sleep();
        }
      } else glow = damp(glow, 0, 6, dt);
      const inside = mode === INSIDE || mode === LEAVING;
      hall.update(dt, inside, mode === INSIDE, modeT, still, lightNow.night);
      glowBox.style.opacity = Math.max(glow, hall.jumpGlow() * 0.92).toFixed(3);
      // Nothing out of doors is drawn while the camera is in the hallway.
      kit.scene.visible = !inside;
    }

    for (const f of [...flowers.values()]) moveFlower(f, dt, t, amp, snap);
    {
      // Tell the grass where the flowers stand, so it parts round them.
      let n = 0;
      for (const f of flowers.values()) {
        if (n < kit.flowerSpots.value.length && !f.fly && f.g.visible) kit.flowerSpots.value[n++].set(f.x, f.z, Math.min(1, f.grow * 1.6));
      }
      for (; n < kit.flowerSpots.value.length; n++) kit.flowerSpots.value[n].z = 0;
    }
    waiting = waiting.filter((p) => {
      p.t -= dt;
      if (p.t > 0) return true;
      const f = flowers.get(p.id);
      if (f && !still) creatures.burst(f.headAt, p.color ?? f.d.color, 16);
      return false;
    });
    creatures.update(dt, t, still, lightNow.night);

    // The camera moves in on a chosen flower, from the side it is not on. Otherwise it goes where
    // the trip into the house has it, or pulls back for "Our garden", or rests.
    const chosen = selected != null ? flowers.get(selected) : undefined;
    if (chosen && !chosen.fly) {
      goLook.set(chosen.x, groundY(chosen.x, chosen.z) + 0.55, chosen.z);
      goAt.set(chosen.x - Math.sign(chosen.x || 1) * 2.6, 6.0, chosen.z + 6.2);
    } else if (mode === TO_DOOR) {
      goLook.copy(land.doorLook);
      goAt.copy(land.doorFrom);
    } else if (mode === INSIDE) hall.aim(goLook, goAt);
    else if (mode === LEAVING) hall.arrive(goLook, goAt, 7.2);
    else if (overview) {
      goLook.copy(overviewLook);
      goAt.copy(overviewAt);
    } else {
      goLook.copy(restLook);
      goAt.copy(restAt);
    }
    // It arrives over the first three seconds, from high and far back.
    const arriving = still ? 1 : clamp(t / 3, 0, 1);
    const eased = 1 - Math.pow(1 - arriving, 3);
    goAt.lerpVectors(introAt, goAt, eased);
    goLook.lerpVectors(introLook, goLook, eased);
    // It keeps close behind a finger dragging the hallway, and moves a little faster on the way in and out.
    const follow = still ? 1 : 1 - Math.exp(-dt * (mode === INSIDE && drag ? 14 : mode !== GARDEN ? 3.4 : 2.6));
    // Indoors the view turns and bobs a fifth as much.
    const sway = mode === INSIDE || mode === LEAVING ? 0.2 : 1;
    camAt.lerp(goAt, follow);
    camLook.lerp(goLook, follow);
    yaw = damp(yaw, yawAsked, 5, dt);
    pointerXSoft = damp(pointerXSoft, still ? 0 : pointerX, 3, dt);
    pointerYSoft = damp(pointerYSoft, still ? 0 : pointerY, 3, dt);
    v1.copy(camAt)
      .sub(camLook)
      .applyAxisAngle(UP, (yaw - pointerXSoft * 0.04) * sway);
    camera.position.copy(camLook).add(v1);
    camera.position.x += Math.sin(t * 0.25) * 0.2 * amp * sway;
    camera.position.y += (-pointerYSoft * 0.3 + Math.sin(t * 0.31) * 0.08 * amp) * sway;
    camera.lookAt(camLook);
    camera.updateMatrixWorld();

    // A flower's name shows while the pointer or the keyboard is on it, or the bee is. It sits
    // just above the highest thing drawn for that flower, and stays inside the screen. Names are
    // away whenever the camera is not in the garden.
    const picked = creatures.picked();
    for (const f of flowers.values()) {
      if (f.fly) continue;
      if (f.d.short !== f.text) {
        f.text = f.d.short;
        f.words.textContent = f.text;
        f.tagWide = f.label.offsetWidth || 60;
      }
      const shown = mode === GARDEN && f.grow > 0.6 && f.delay <= 0 && selected == null && (f.id === hovered || f.id === focused || f.id === picked);
      f.label.style.opacity = shown ? '1' : '0';
      if (!shown) continue;
      v1.copy(f.headAt).project(camera);
      const sx = (v1.x * 0.5 + 0.5) * wide;
      let top = (-v1.y * 0.5 + 0.5) * tall;
      for (const [hinge, m] of f.petals) {
        v2.set(0, 0, m.position.z + m.scale.z);
        hinge.localToWorld(v2).project(camera);
        top = Math.min(top, (-v2.y * 0.5 + 0.5) * tall);
      }
      if (f.markerGroup.visible) {
        v2.set(0, -0.12, 0);
        f.markerGroup.localToWorld(v2).project(camera);
        top = Math.min(top, (-v2.y * 0.5 + 0.5) * tall);
      }
      f.label.style.transform = `translate(${clamp(sx, f.tagWide / 2 + 6, wide - f.tagWide / 2 - 6).toFixed(1)}px,${(top - 7).toFixed(1)}px) translate(-50%,-100%)`;
    }
    {
      // A visiting friend's name floats just over their butterfly.
      const visitor = creatures.visitorAt();
      visitorLabel.style.opacity = visitor && mode === GARDEN ? '1' : '0';
      if (visitor) {
        v1.copy(visitor);
        v1.y += 0.32;
        v1.project(camera);
        visitorLabel.style.transform = `translate(${((v1.x * 0.5 + 0.5) * wide).toFixed(1)}px,${((-v1.y * 0.5 + 0.5) * tall).toFixed(1)}px) translate(-50%,-100%)`;
      }
    }

    // The daisy in the sky fades out while a flower is chosen or the house is open.
    skyDaisyShown = damp(skyDaisyShown, selected != null || houseOpen ? 0 : 1, 4, dt);
    land.skyPetalPaint.opacity = skyDaisyShown;
    land.skyCenterPaint.opacity = skyDaisyShown;
    skyParts.follow(camera, land.skyDaisy.position, dt, lightNow.night, !still && mode === GARDEN);
    renderer.render(world, camera);
  }
  frameId = requestAnimationFrame(frame);

  return {
    setFlowers,
    /** Clear the yard and plant this list afresh, for a different bed of flowers. */
    replant(list: Flower[]) {
      for (const f of [...flowers.values()]) if (!f.fly) removeFlower(f);
      waiting = [];
      creatures.callOffBee();
      setFlowers(list, 'together');
    },
    setOptions(next: Partial<GardenOptions>) {
      Object.assign(opt, next);
      land.setEarned(opt.earned);
    },
    /** Choose a flower: the camera moves in on it and the others shrink back. Null lets it go. */
    select(id: string | null) {
      selected = id;
    },
    /** Show a flower's name as if the pointer were on it, for someone moving through the garden with a keyboard. */
    focus(id: string | null) {
      focused = id;
    },
    /** Send the bee to a flower. */
    pick(id: string) {
      creatures.sendBee(id);
    },
    /** Tip the watering can over a flower. False if it cannot start. `onWatered` follows when it pours. */
    water(id: string): boolean {
      return creatures.water(id);
    },
    /**
     * A friend's butterfly flies in to a flower, in their colour and under their name. False if it
     * cannot: one is already on its way, or the flower is not there. `onVisit` follows when it lands.
     */
    visit(who: string, id: string, color: string, name: string): boolean {
      if (!creatures.visit(who, id, color)) return false;
      visitorLabel.textContent = name;
      return true;
    },
    /** A picture of the garden as it looks right now, as a JPEG's data address. */
    snapshot(): string {
      // Drawn and read in one go, so the picture is still there to be read.
      renderer.render(world, camera);
      return canvas.toDataURL('image/jpeg', 0.92);
    },
    /** The walls of the hallway, oldest first, each with up to twelve finished ideas, oldest first. Stands at the newest unless told which. */
    setMemories(walls: Memory[][], stand?: number) {
      hall.setMemories(walls, stand);
    },
    /** Go to a wall: a slide to the next one, a dip of the glow and a jump to one further off. */
    setWall(index: number) {
      hall.setWall(index, mode === INSIDE);
    },
    /** Choose a frame on the wall in view, by its place. The camera leans in to it. Null steps back. */
    selectFrame(slot: number | null) {
      hall.select(slot);
    },
    /** Go into the house, or come out. */
    setHouse(open: boolean) {
      if (open === houseOpen) return;
      houseOpen = open;
      if (open) {
        // The walls are only built once someone is on their way in.
        hall.wake();
        if (mode === GARDEN || mode === BACK_OUT) {
          mode = TO_DOOR;
          modeT = 0;
        } else if (mode === LEAVING) {
          mode = INSIDE;
          modeT = 0.6;
        }
      } else if (mode === INSIDE) {
        mode = LEAVING;
        modeT = 0;
      } else if (mode === TO_DOOR) {
        mode = GARDEN;
        hall.sleep();
      }
    },
    /** Pull the camera back to see the whole yard, for while "Our garden" is open. */
    setOverview(on: boolean) {
      overview = on;
    },
    /** Stop drawing while the garden cannot be seen, and carry on when it can. */
    setPaused(next: boolean) {
      if (next === paused) return;
      paused = next;
      cancelAnimationFrame(frameId);
      if (!paused) {
        last = performance.now();
        frameId = requestAnimationFrame(frame);
      }
    },
    dispose() {
      cancelAnimationFrame(frameId);
      watchSize.disconnect();
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointerup', onUp);
      canvas.removeEventListener('pointercancel', letGo);
      canvas.removeEventListener('pointerleave', onLeave);
      for (const f of [...flowers.values()]) f.label.remove();
      visitorLabel.remove();
      hall.dispose();
      // Hand back everything the graphics card was holding.
      world.traverse((o) => {
        const part = o as Partial<THREE.Mesh>;
        part.geometry?.dispose();
        const paints = Array.isArray(part.material) ? part.material : part.material ? [part.material] : [];
        for (const paint of paints) {
          (paint as THREE.Material & { map?: THREE.Texture | null }).map?.dispose();
          paint.dispose();
        }
      });
      dayPictures.forEach((texture) => texture.dispose());
      renderer.dispose();
      canvas.remove();
      glowBox.remove();
    },
  };
}
