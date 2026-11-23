// Inside the house: a hallway where every finished idea hangs in a frame. Each wall holds up to
// twelve. Walls stand side by side, the oldest to the left and the newest, where you walk in, to
// the right. Only the wall in view and the one either side of it are ever built, so three hundred
// frames cost the same to draw as three.
//
// The hallway is a set of its own, placed far below the garden. A warm glow over the whole screen
// covers the cut as the camera goes through the door (see scene.ts).
//
// Ported from the design handoff (design_handoff_garden_a_v2/garden3d-v2.js).

import * as THREE from 'three';

import { clamp, damp } from './ground';
import type { Kit } from './kit';
import { HALL, PAINT } from './palette';
import { FRAMES, frameScale, WALL, type Memory } from './plan';

/** Where the hallway is. */
const IN = new THREE.Vector3(0, -60, 0);
/** One wall's width and height, how deep the floor runs toward the viewer, and how far up the wall the frames are hung. */
const BAY = 2.3;
const HIGH = 3.9;
const DEEP = 7.6;
const HANG = 0.4;
/** How high the camera looks, and how far back it stands from a wall. */
const EYE = 1.62;
const STAND = 4.6;

type Hung = {
  group: THREE.Group;
  slot: number;
  x: number;
  y: number;
  /** How much larger it hangs because its wall has few frames. */
  k: number;
  picture: THREE.Texture;
  framePaint: THREE.Material;
  picturePaint: THREE.MeshLambertMaterial;
  shapes: THREE.BufferGeometry[];
  /** Its size now, which grows a little under the pointer and more when it is chosen. */
  size: number;
  /** An oval is a round frame stretched this much taller. */
  stretch: number;
  /** How crooked it hangs. */
  tip: number;
  /** False once its wall has been taken down, so a photo that arrives late is thrown away. */
  up: boolean;
};

type Bay = { group: THREE.Object3D; frames: Hung[] };

export type Hallway = ReturnType<typeof buildHallway>;

/**
 * `captionFont` is the font family for the name under a pressed flower, as CSS writes it.
 * `onJumped` is told how far the camera must be moved sideways when a far jump lands, and at which wall.
 */
export function buildHallway(kit: Kit, captionFont: string, onJumped: (dx: number, wall: number) => void) {
  const { lambert, basic, ball } = kit;
  const room = new THREE.Group();
  room.position.copy(IN);
  room.visible = false;
  kit.world.add(room);
  const bays = new Map<number, Bay>();
  let walls: Memory[][] = [];
  let at = 0;
  /** How far a finger has dragged the wall sideways. */
  let pan = 0;
  /** A jump to a wall further off than the next one: under a dip of the glow, the camera is moved there. */
  let jump: { to: number | null; t: number } | null = null;
  let jumpGlow = 0;
  let chosen: number | null = null;
  let hover: number | null = null;
  /** False while the camera is out in the garden, when no wall is built and no picture is fetched. */
  let awake = false;

  const wallX = (i: number) => (i - Math.max(0, walls.length - 1)) * BAY;

  const picture = (w: number, h: number, draw: (pen: CanvasRenderingContext2D, w: number, h: number) => void, repeat?: [number, number]) => {
    const texture = kit.painted(w, h, draw);
    texture.anisotropy = 4;
    if (repeat) {
      texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
      texture.repeat.set(repeat[0], repeat[1]);
    }
    return texture;
  };

  // Wallpaper with faint pinstripes and a small daisy, a floor of planks in four tones, and the sideboard's wood.
  const paper = picture(
    128,
    128,
    (x, w, h) => {
      x.fillStyle = HALL.wallpaper;
      x.fillRect(0, 0, w, h);
      x.fillStyle = 'rgba(140,110,190,.09)';
      x.fillRect(0, 0, 1.5, h);
      x.fillRect(64, 0, 1.5, h);
      for (const [cx, cy] of [
        [32, 32],
        [96, 96],
      ]) {
        x.fillStyle = 'rgba(150,120,200,.17)';
        for (let i = 0; i < 6; i++) {
          x.save();
          x.translate(cx, cy);
          x.rotate((i * Math.PI) / 3);
          x.beginPath();
          x.ellipse(0, -6.5, 2.5, 4.6, 0, 0, 6.3);
          x.fill();
          x.restore();
        }
        x.fillStyle = 'rgba(232,185,35,.3)';
        x.beginPath();
        x.arc(cx, cy, 2.4, 0, 6.3);
        x.fill();
      }
    },
    [BAY / 0.42, HIGH / 0.42],
  );
  const planks = picture(
    256,
    256,
    (x, _w, h) => {
      for (let i = 0; i < 8; i++) {
        x.fillStyle = HALL.floor[(i * 3 + (i >> 1)) % 4];
        x.fillRect(i * 32, 0, 32, h);
        x.fillStyle = 'rgba(120,80,50,.16)';
        for (let k = 0; k < 5; k++) x.fillRect(i * 32 + 4 + ((i * 7 + k * 11) % 24), (k * 61 + i * 37) % h, 1, 46);
        x.fillStyle = 'rgba(110,70,44,.5)';
        x.fillRect(i * 32, 0, 1.5, h);
        x.fillRect(i * 32, (i * 89) % h, 32, 1.5);
      }
    },
    [2, 3],
  );
  const wood = picture(128, 64, (x, w, h) => {
    x.fillStyle = HALL.wood;
    x.fillRect(0, 0, w, h);
    for (let k = 0; k < 26; k++) {
      x.fillStyle = k % 2 ? 'rgba(90,56,34,.14)' : 'rgba(240,210,180,.12)';
      x.fillRect(0, (k * 23) % h, w, 1 + (k % 3));
    }
  });
  const blob = (rgb: string, strength: number) =>
    picture(64, 64, (x, w, h) => {
      const g = x.createRadialGradient(32, 32, 4, 32, 32, 32);
      g.addColorStop(0, `rgba(${rgb},${strength})`);
      g.addColorStop(1, `rgba(${rgb},0)`);
      x.fillStyle = g;
      x.fillRect(0, 0, w, h);
    });
  /** The soft shadow a frame casts on the wallpaper, and the warm pool of light round a lamp. */
  const shadowPaint = new THREE.MeshBasicMaterial({ map: blob('44,32,64', 0.45), transparent: true, depthWrite: false });
  const poolPaint = new THREE.MeshBasicMaterial({ map: blob('255,205,140', 0.9), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.2 });
  // A soft darkening toward the corners and the floor, laid over the wallpaper, so the wall reads as lit from the middle.
  const shadePaint = new THREE.MeshBasicMaterial({
    map: picture(128, 128, (x, w, h) => {
      const g = x.createRadialGradient(64, 54, 34, 64, 54, 104);
      g.addColorStop(0, 'rgba(52,36,84,0)');
      g.addColorStop(1, 'rgba(52,36,84,.34)');
      x.fillStyle = g;
      x.fillRect(0, 0, w, h);
      const b = x.createLinearGradient(0, h * 0.78, 0, h);
      b.addColorStop(0, 'rgba(52,36,84,0)');
      b.addColorStop(1, 'rgba(52,36,84,.22)');
      x.fillStyle = b;
      x.fillRect(0, 0, w, h);
    }),
    transparent: true,
    depthWrite: false,
  });
  /** A diagonal streak of sheen, for the glass over every picture. */
  const glassPaint = new THREE.MeshBasicMaterial({
    map: picture(64, 64, (x, w, h) => {
      const g = x.createLinearGradient(0, h, w, 0);
      g.addColorStop(0.25, 'rgba(255,255,255,0)');
      g.addColorStop(0.5, 'rgba(255,255,255,.2)');
      g.addColorStop(0.58, 'rgba(255,255,255,.04)');
      g.addColorStop(0.75, 'rgba(255,255,255,0)');
      x.fillStyle = g;
      x.fillRect(0, 0, w, h);
    }),
    transparent: true,
    depthWrite: false,
  });
  const matPaint = lambert(HALL.mat);

  // One wall's worth of hallway, built once and copied for each wall: wallpaper, white woodwork, a
  // pilaster with a wall light, the floor and ceiling, a rug, and a sideboard with a lamp, three
  // photo albums and a vase of daisies.
  const bay = new THREE.Group();
  const white = lambert(PAINT.white);
  const brass = lambert(HALL.brass);
  const put = <G extends THREE.BufferGeometry>(shape: G, paint: THREE.Material, x: number, y: number, z: number, parent: THREE.Object3D = bay) => {
    const m = new THREE.Mesh(shape, paint);
    m.position.set(x, y, z);
    parent.add(m);
    return m;
  };
  put(new THREE.PlaneGeometry(BAY, HIGH), lambert(PAINT.white, { map: paper }), 0, HIGH / 2, 0);
  put(new THREE.PlaneGeometry(BAY, HIGH), shadePaint, 0, HIGH / 2, 0.004);
  // The wainscot with its rail, the baseboard, and the moulding along the top.
  put(new THREE.BoxGeometry(BAY, 0.62, 0.04), white, 0, 0.31, 0.02);
  put(new THREE.BoxGeometry(BAY, 0.05, 0.08), white, 0, 0.645, 0.04);
  put(new THREE.BoxGeometry(BAY, 0.13, 0.06), white, 0, 0.065, 0.03);
  put(new THREE.BoxGeometry(BAY, 0.14, 0.1), white, 0, HIGH - 0.07, 0.05);
  {
    const batten = new THREE.BoxGeometry(0.03, 0.5, 0.055);
    for (let i = -3; i <= 3; i++) put(batten, white, i * 0.3, 0.38, 0.03);
  }
  // The pilaster between two walls, carrying a brass wall light with a glowing globe.
  put(new THREE.BoxGeometry(0.14, HIGH, 0.07), white, BAY / 2, HIGH / 2, 0.035);
  put(new THREE.BoxGeometry(0.06, 0.17, 0.02), brass, BAY / 2, 2.72, 0.08);
  put(new THREE.BoxGeometry(0.02, 0.02, 0.1), brass, BAY / 2, 2.76, 0.13);
  put(new THREE.SphereGeometry(0.07, 16, 12), basic(HALL.shade, { fog: false }), BAY / 2, 2.84, 0.17);
  put(new THREE.PlaneGeometry(1.8, 1.8), poolPaint, BAY / 2, 2.84, 0.006);
  put(new THREE.PlaneGeometry(BAY, DEEP).rotateX(-Math.PI / 2), lambert(PAINT.white, { map: planks }), 0, 0, DEEP / 2);
  // Where the floor meets the wall it is a little darker.
  put(
    new THREE.PlaneGeometry(BAY, 0.7).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({
      map: picture(8, 64, (x, w, h) => {
        const g = x.createLinearGradient(0, 0, 0, h);
        g.addColorStop(0, 'rgba(52,36,84,.4)');
        g.addColorStop(1, 'rgba(52,36,84,0)');
        x.fillStyle = g;
        x.fillRect(0, 0, w, h);
      }),
      transparent: true,
      depthWrite: false,
    }),
    0,
    0.004,
    0.35,
  );
  put(new THREE.PlaneGeometry(BAY, DEEP).rotateX(Math.PI / 2), lambert(HALL.ceiling), 0, HIGH + 0.05, DEEP / 2);
  put(new THREE.BoxGeometry(0.16, 0.16, DEEP), white, BAY / 2, HIGH - 0.03, DEEP / 2);
  {
    const oval = new THREE.CircleGeometry(1, 40).rotateX(-Math.PI / 2);
    put(oval, lambert(HALL.rug), 0, 0.006, 0.84).scale.set(0.84, 1, 0.36);
    put(oval, lambert(HALL.rugMiddle), 0, 0.009, 0.84).scale.set(0.72, 1, 0.27);
  }
  const furniture = new THREE.Group();
  furniture.name = 'furniture';
  bay.add(furniture);
  put(new THREE.BoxGeometry(1.5, 0.4, 0.36), lambert(PAINT.white, { map: wood }), 0, 0.44, 0.2, furniture);
  put(new THREE.BoxGeometry(1.56, 0.035, 0.4), lambert(HALL.woodTop), 0, 0.657, 0.21, furniture);
  {
    const leg = new THREE.CylinderGeometry(0.024, 0.016, 0.24, 8);
    const seam = new THREE.BoxGeometry(0.008, 0.34, 0.006);
    const knob = new THREE.SphereGeometry(0.016, 8, 6);
    const dark = lambert(HALL.woodDark);
    for (const [x, z] of [
      [-0.66, 0.06],
      [0.66, 0.06],
      [-0.66, 0.34],
      [0.66, 0.34],
    ]) {
      put(leg, dark, x, 0.12, z, furniture);
    }
    for (const x of [-0.25, 0.25]) put(seam, dark, x, 0.44, 0.381, furniture);
    for (const x of [-0.3, 0.2, 0.3]) put(knob, brass, x, 0.46, 0.39, furniture);
  }
  // The table lamp: a brass foot and stem under a cream shade, and its pool of light on the wall.
  put(new THREE.CylinderGeometry(0.07, 0.085, 0.03, 18), brass, -0.52, 0.69, 0.2, furniture);
  put(new THREE.CylinderGeometry(0.012, 0.012, 0.22, 8), brass, -0.52, 0.81, 0.2, furniture);
  put(new THREE.CylinderGeometry(0.085, 0.13, 0.17, 22, 1, true), basic(HALL.shade, { side: THREE.DoubleSide, fog: false }), -0.52, 0.98, 0.2, furniture);
  put(new THREE.PlaneGeometry(1.2, 1.2), poolPaint, -0.52, 1.06, 0.007, furniture);
  const albums: [number, number, number, number, number][] = [
    [0.3, 0.045, 0.24, 0.697, 0],
    [0.28, 0.04, 0.23, 0.74, 0.14],
    [0.26, 0.04, 0.22, 0.78, -0.2],
  ];
  albums.forEach(([w, h, d, y, turn], i) => {
    put(new THREE.BoxGeometry(w, h, d), lambert(HALL.albums[i]), 0.14, y, 0.2, furniture).rotation.y = turn;
  });
  put(new THREE.CylinderGeometry(0.045, 0.062, 0.2, 16), white, 0.56, 0.775, 0.2, furniture);
  const daisies: [number, number][] = [
    [-0.05, 0.14],
    [0.02, 0.2],
    [0.07, 0.12],
  ];
  daisies.forEach(([dx, tall], k) => {
    put(new THREE.CylinderGeometry(0.006, 0.006, tall, 5), lambert(HALL.stalk), 0.56 + dx * 0.5, 0.875 + tall / 2, 0.2, furniture).rotation.z = -dx * 2.2;
    put(ball, lambert(HALL.vase[k]), 0.56 + dx, 0.875 + tall, 0.2 + k * 0.012, furniture).scale.set(0.05, 0.05, 0.018);
    put(ball, lambert(PAINT.center), 0.56 + dx, 0.875 + tall, 0.215 + k * 0.012, furniture).scale.setScalar(0.02);
  });
  // A warm lamp for the wall in view. It is stronger at night.
  const lamp = new THREE.PointLight(HALL.lamp, 0, 10, 1.2);
  lamp.position.copy(IN).add(new THREE.Vector3(0, 2.6, 2.4));
  kit.world.add(lamp);

  /**
   * What hangs in a frame when the idea has no picture of its own: its pressed flower, a daisy in
   * its list's colour with a stem and a leaf, on cream paper washed with a little of that colour.
   * `named` writes the idea's short name under it.
   */
  const pressed = (memory: Memory, shape: number, named: boolean) =>
    picture(256, Math.round(256 / shape), (x, W, H) => {
      const cy = H * (named ? 0.4 : 0.47);
      const r = Math.min(W, H) * (named ? 0.2 : 0.25);
      x.fillStyle = HALL.paper;
      x.fillRect(0, 0, W, H);
      x.globalAlpha = 0.17;
      x.fillStyle = memory.color;
      x.fillRect(0, 0, W, H);
      x.globalAlpha = 1;
      x.strokeStyle = HALL.stalk;
      x.lineWidth = 5;
      x.lineCap = 'round';
      x.beginPath();
      x.moveTo(W / 2, cy + r * 0.4);
      x.quadraticCurveTo(W / 2 + r * 0.3, cy + r * 1.2, W / 2 - r * 0.1, cy + r * 1.8);
      x.stroke();
      x.fillStyle = HALL.stalk;
      x.beginPath();
      x.ellipse(W / 2 + r * 0.55, cy + r * 1.3, r * 0.4, r * 0.15, -0.5, 0, 6.3);
      x.fill();
      x.fillStyle = memory.color;
      for (let i = 0; i < 8; i++) {
        x.save();
        x.translate(W / 2, cy);
        x.rotate((i * Math.PI) / 4 + Math.sin(i * 2.3 + memory.title.length) * 0.09);
        x.beginPath();
        x.ellipse(0, -r * 0.82, r * 0.27, r * 0.56, 0, 0, 6.3);
        x.fill();
        x.restore();
      }
      x.fillStyle = PAINT.center;
      x.beginPath();
      x.arc(W / 2, cy, r * 0.36, 0, 6.3);
      x.fill();
      if (named) {
        // The name is made smaller until it fits across the paper.
        const words = memory.short || memory.title;
        let size = 34;
        x.textAlign = 'center';
        x.fillStyle = PAINT.ink;
        do {
          size -= 2;
          x.font = `${size}px ${captionFont}`;
        } while (x.measureText(words).width > W - 24 && size > 14);
        x.fillText(words, W / 2, H - 20);
      }
    });

  /**
   * Fetch an idea's own picture and put it in its frame in place of the pressed flower. It is drawn
   * small, cut to the frame's shape, so a wall of photos stays light on memory. If it cannot be
   * fetched, the pressed flower stays.
   */
  const hangPhoto = (frame: Hung, address: string, shape: number, shown: number) => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => {
      if (!frame.up || !image.width || !image.height) return;
      try {
        const next = picture(256, Math.round(256 / shape), (x, W, H) => {
          // Cut from the middle of the photo, as much as fills the frame.
          const has = image.width / image.height;
          const sw = has > shown ? image.height * shown : image.width;
          const sh = has > shown ? image.height : image.width / shown;
          x.drawImage(image, (image.width - sw) / 2, (image.height - sh) / 2, sw, sh, 0, 0, W, H);
        });
        frame.picture.dispose();
        frame.picture = next;
        frame.picturePaint.map = next;
        frame.picturePaint.needsUpdate = true;
      } catch {
        // A photo the browser will not let the garden read: the pressed flower stays.
      }
    };
    image.src = address;
  };

  /** The frames for one wall: bars, a cream mat on the larger ones, the picture, the sheen of glass, and a soft shadow on the wallpaper. */
  const hang = (list: Memory[], parent: THREE.Object3D): Hung[] => {
    const count = list.length;
    const k = frameScale(count);
    // The few frames of a nearly empty wall are centred over the sideboard.
    let low = 9;
    let high = 0;
    for (const [, y, , h] of FRAMES.slice(0, count)) {
      low = Math.min(low, y - h / 2);
      high = Math.max(high, y + h / 2);
    }
    const middle = (low + high) / 2;
    return list.map((memory, i) => {
      const [x, y, w, h, round, color, bar] = FRAMES[i];
      const group = new THREE.Group();
      const shapes: THREE.BufferGeometry[] = [];
      const part = <G extends THREE.BufferGeometry>(shape: G, paint: THREE.Material, px: number, py: number, pz: number) => {
        shapes.push(shape);
        return put(shape, paint, px, py, pz, group);
      };
      const framePaint = lambert(color);
      const mat = Math.min(w, h) >= 0.36 ? Math.min(w, h) * 0.1 : 0;
      const named = !round && w >= 0.4 && !memory.picture;
      const inW = w - 2 * bar - 2 * mat;
      const inH = h - 2 * bar - 2 * mat;
      const shape = round ? 1 : inW / inH;
      const flower = pressed(memory, shape, named);
      const picturePaint = lambert(PAINT.white, { map: flower });
      part(new THREE.PlaneGeometry(w + 0.22, (round ? w : h) + 0.22), shadowPaint, 0.03, -0.05, -0.02);
      if (round) {
        part(new THREE.TorusGeometry(w / 2 - bar / 2, bar / 2, 10, 44), framePaint, 0, 0, 0.02);
        if (mat) part(new THREE.CircleGeometry(w / 2 - bar * 0.8, 40), matPaint, 0, 0, 0.012);
        part(new THREE.CircleGeometry(w / 2 - bar * 0.8 - mat, 40), picturePaint, 0, 0, 0.014);
        part(new THREE.CircleGeometry(w / 2 - bar * 0.8, 40), glassPaint, 0, 0, 0.017);
      } else {
        const bars: [number, number, number, number][] = [
          [0, (h - bar) / 2, w, bar],
          [0, -(h - bar) / 2, w, bar],
          [(w - bar) / 2, 0, bar, h - 2 * bar],
          [-(w - bar) / 2, 0, bar, h - 2 * bar],
        ];
        for (const [bx, by, bw, bh] of bars) part(new THREE.BoxGeometry(bw, bh, 0.05), framePaint, bx, by, 0.025);
        if (mat) part(new THREE.PlaneGeometry(w - 2 * bar, h - 2 * bar), matPaint, 0, 0, 0.012);
        part(new THREE.PlaneGeometry(inW, inH), picturePaint, 0, 0, 0.014);
        part(new THREE.PlaneGeometry(w - 2 * bar, h - 2 * bar), glassPaint, 0, 0, 0.017);
      }
      const fx = x * k;
      const fy = (count <= 6 ? 1.9 : middle) + (y - middle) * k + HANG;
      group.position.set(fx, fy, 0.03);
      group.scale.setScalar(k);
      group.userData.slot = i;
      parent.add(group);
      const frame: Hung = { group, slot: i, x: fx, y: fy, k, picture: flower, framePaint, picturePaint, shapes, size: 1, stretch: round ? h / w : 1, tip: Math.sin(i * 2.1 + 0.5) * 0.028, up: true };
      if (memory.picture) hangPhoto(frame, memory.picture, shape, round ? w / h : inW / inH);
      return frame;
    });
  };

  const takeDown = (b: Bay) => {
    room.remove(b.group);
    for (const f of b.frames) {
      f.up = false;
      f.picture.dispose();
      f.framePaint.dispose();
      f.picturePaint.dispose();
      for (const shape of f.shapes) shape.dispose();
    }
  };
  /** Keep exactly the wall in view and one either side. A wall beyond either end is built bare, so the hallway never shows an edge. */
  const keepNear = () => {
    if (!awake) return;
    for (const [i, b] of bays) {
      if (Math.abs(i - at) > 1) {
        takeDown(b);
        bays.delete(i);
      }
    }
    for (let i = at - 1; i <= at + 1; i++) {
      if (bays.has(i)) continue;
      const group = bay.clone();
      group.position.x = wallX(i);
      // The sideboard's arrangement is the other way round on every second wall.
      const side = group.getObjectByName('furniture');
      if (side) side.scale.x = i % 2 ? -1 : 1;
      room.add(group);
      bays.set(i, { group, frames: walls[i] ? hang(walls[i], group) : [] });
    }
  };

  return {
    /** How many walls there are, which one is in view, and whether a far jump is under way. */
    count: () => walls.length,
    wall: () => at,
    jumping: () => jump !== null,
    /** How much of the glow a far jump is asking for, from 0 to 1. */
    jumpGlow: () => jumpGlow,

    /** Every wall, oldest first, each with up to twelve finished ideas, oldest first. Stands at the newest wall unless told which. */
    setMemories(list: Memory[][], stand?: number) {
      for (const b of bays.values()) takeDown(b);
      bays.clear();
      walls = list.map((wall) => wall.slice(0, WALL));
      at = clamp(stand ?? walls.length - 1, 0, Math.max(0, walls.length - 1));
      pan = 0;
      jump = null;
      jumpGlow = 0;
      chosen = null;
      keepNear();
    },
    /**
     * Go to a wall. The next one along is a slide. Anything further is a quick dip of the glow with
     * the camera moved under it, so the walls in between never have to be built. `inside` is
     * whether the camera is standing in the hallway: if not, it simply stands at that wall.
     */
    setWall(to: number, inside: boolean) {
      const wall = clamp(to, 0, Math.max(0, walls.length - 1));
      if (wall === at && !jump) return;
      chosen = null;
      if (Math.abs(wall - at) > 1 && inside) jump = { to: wall, t: 0 };
      else {
        jump = null;
        jumpGlow = 0;
        at = wall;
        keepNear();
      }
    },
    /** The camera is on its way in: build the walls round where it will stand. */
    wake() {
      if (awake) return;
      awake = true;
      keepNear();
    },
    /** The camera is back in the garden: take every wall down and let its pictures go. */
    sleep() {
      if (!awake) return;
      awake = false;
      for (const b of bays.values()) takeDown(b);
      bays.clear();
    },
    /** Hand back everything the graphics card was holding for the hallway, when the garden is closed for good. */
    dispose() {
      for (const b of bays.values()) takeDown(b);
      bays.clear();
      awake = false;
      // The wall that every wall is copied from is never in the scene itself, so it is let go here.
      bay.traverse((o) => {
        const part = o as Partial<THREE.Mesh<THREE.BufferGeometry, THREE.Material & { map?: THREE.Texture | null }>>;
        part.geometry?.dispose();
        part.material?.map?.dispose();
        part.material?.dispose();
      });
      for (const paint of [shadowPaint, glassPaint, matPaint]) {
        paint.map?.dispose();
        paint.dispose();
      }
    },
    /** A swipe let go: step to the wall beside this one if the finger went far enough. True if it stepped. */
    swipe(dx: number): boolean {
      pan = 0;
      if (jump) return false;
      const to = dx > 56 ? at - 1 : dx < -56 ? at + 1 : at;
      if (to === at || to < 0 || to >= walls.length) return false;
      at = to;
      chosen = null;
      keepNear();
      return true;
    },
    /** A finger dragging the wall sideways, `dx` dots across a garden `wide` dots wide. Past either end it resists. */
    drag(dx: number, wide: number) {
      const end = (dx > 0 && at === 0) || (dx < 0 && at >= walls.length - 1);
      pan = (dx / (wide / 2.07)) * (end ? 0.25 : 1);
    },
    letGo() {
      pan = 0;
    },
    /** Choose a frame on the wall in view, by its place from 0 to 11. Null steps back from it. */
    select(slot: number | null) {
      chosen = slot;
    },
    hover(slot: number | null) {
      hover = slot;
    },
    reset() {
      chosen = null;
      pan = 0;
      jump = null;
      jumpGlow = 0;
    },
    /** The frame on the wall in view that a ray lands on, if it lands on one. */
    frameAt(ray: THREE.Raycaster): number | null {
      const b = bays.get(at);
      const hit = b ? ray.intersectObjects(b.frames.map((f) => f.group), true)[0] : undefined;
      let o: THREE.Object3D | null = hit ? hit.object : null;
      while (o && o.userData.slot == null) o = o.parent;
      return o ? (o.userData.slot as number) : null;
    },
    /** Where the camera stands and looks, facing the wall in view, leaning toward a chosen frame. */
    aim(look: THREE.Vector3, stand: THREE.Vector3) {
      const frame = chosen != null ? bays.get(at)?.frames[chosen] : undefined;
      const x = wallX(at) - pan + (frame ? frame.x * 0.6 : 0);
      const y = frame ? EYE + (frame.y - EYE) * 0.6 : EYE;
      look.copy(IN).add(stand.set(x, y, 0));
      stand.set(x, y + 0.38, frame ? 3.5 : STAND).add(IN);
    },
    /** Where the camera is put when it comes in, well back from the newest wall, and where it backs off to on the way out. */
    arrive(look: THREE.Vector3, stand: THREE.Vector3, back: number) {
      look.set(wallX(at), EYE, 0).add(IN);
      stand.set(wallX(at), 1.9, back).add(IN);
    },
    /**
     * Move the hallway on by one frame. `inside` is whether the camera is in it, `settled` whether
     * it has finished coming in, and `since` how long ago it came in, for the frames' brief sway
     * as if the door had disturbed them.
     */
    update(dt: number, inside: boolean, settled: boolean, since: number, still: boolean, night: number) {
      if (jump) {
        jump.t += dt;
        jumpGlow = jump.t < 0.16 ? jump.t / 0.16 : Math.max(0, 1 - (jump.t - 0.16) / 0.3);
        if (jump.to != null && jump.t >= 0.16) {
          const dx = wallX(jump.to) - wallX(at);
          at = jump.to;
          jump.to = null;
          keepNear();
          onJumped(dx, at);
        }
        if (jump.t > 0.46) {
          jump = null;
          jumpGlow = 0;
        }
      }
      room.visible = inside;
      lamp.intensity = inside ? 1.2 + night * 6 : 0;
      lamp.position.set(IN.x + wallX(at), IN.y + 2.6, IN.z + 2.4);
      poolPaint.opacity = 0.05 + 0.4 * night;
      if (!inside) return;
      for (const [i, b] of bays) {
        const here = i === at;
        for (const f of b.frames) {
          f.size = damp(f.size, here && chosen === f.slot ? 1.1 : here && hover === f.slot ? 1.04 : 1, 10, dt);
          f.group.scale.set(f.size * f.k, f.size * f.stretch * f.k, f.size * f.k);
          f.group.position.z = damp(f.group.position.z, here && chosen === f.slot ? 0.09 : 0.03, 10, dt);
          f.group.rotation.z = f.tip + (still || !settled ? 0 : Math.sin(since * 3.2 + f.slot * 1.7) * 0.05 * Math.exp(-since * 1.2));
        }
      }
    },
  };
}
