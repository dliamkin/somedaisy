'use dom';

// The garden, as a piece of web page. On the website it is drawn straight into the page. In the
// phone app Expo puts it in a web view of its own (that is what 'use dom' at the top asks for),
// because the scene needs a browser's canvas. Either way the screen around it talks to it the same
// way: it hands over plain values, and hears back through the functions it passes in.
//
// Everything over the garden (the header, the sheets, the buttons) is the app's own and is drawn by
// the screen, not here. What is here is what needs the web page itself: the names that follow the
// picture, the garden's sounds, and the postcard, which is put together from the picture.

import { Nunito_700Bold } from '@expo-google-fonts/nunito/700Bold';
import { Nunito_800ExtraBold } from '@expo-google-fonts/nunito/800ExtraBold';
import { Nunito_900Black } from '@expo-google-fonts/nunito/900Black';
import { useFonts } from 'expo-font';
import { useEffect, useRef, useState, type CSSProperties } from 'react';

import { POSTCARD, type LawnStyle, type Season, type TimeOfDay } from '@/garden/palette';
import type { Flower, Memory, Stage } from '@/garden/plan';
import { createGarden, type Garden } from '@/garden/scene';
import { makeSound, type Chime, type GardenSound } from '@/garden/sound';

/** A friend's butterfly to send to a flower. */
export type Visit = { who: string; id: string; color: string; name: string; turn: number };

type Props = {
  /** The flowers on show, as they now stand. */
  flowers: Flower[];
  /** Which bed of flowers this is. A different number clears the yard and plants it afresh. */
  bed: number;
  /** The chosen flower, if one is. */
  selected: string | null;
  /** The flower to send the bee to. A new `turn` sends it again, even to the same flower. */
  pick: { id: string; turn: number } | null;
  time: TimeOfDay;
  /** For people who have asked for less motion. */
  still: boolean;
  /** How many petals of the daisy in the sky are filled in. */
  earned: number;
  /** The colour of each leaf, one for each member shown, in the order of every flower's votes. */
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
  /** The walls of the hallway in the house, oldest first, each with up to twelve finished ideas. */
  memories: Memory[][];
  /** Goes up by one whenever `memories` has changed, which is when the walls are hung again. */
  hung: number;
  /** Whether the house is open: the camera goes in at the door, or comes back out. */
  house: boolean;
  /** The wall to stand at, and the frame on it that is chosen, if one is. */
  wall: number;
  frame: number | null;
  /** Pull the camera back to show the whole yard, while "Our garden" is open. */
  overview: boolean;
  /** The flower to water. A new `turn` waters again. */
  water: { id: string; turn: number } | null;
  /** Friends' butterflies to send in, each with a `turn` higher than the last. They fly one at a time. */
  visits: Visit[];
  /** Goes up by one to take a picture of the garden for a postcard. `onSnapshot` answers. */
  snap: number;
  /** The words for the finished postcard. A new `turn` makes one from the last picture taken, and `onCard` answers. */
  card: { name: string; line: string; turn: number } | null;
  /** Whether the garden's sounds are on, and a run of notes to play. A new `turn` plays again. */
  sound: boolean;
  chime: { name: Chime; turn: number } | null;
  /** Stop drawing, for while another screen is over the garden. */
  paused: boolean;
  /** The colours of the name over a flower: the app's card and text colours. */
  tag: { card: string; ink: string };
  onSelect: (id: string | null) => Promise<void>;
  /** A finished flower has landed in the house. */
  onLanded: (id: string) => Promise<void>;
  /** The bee has reached the flower it was sent to. */
  onPickArrive: (id: string) => Promise<void>;
  /** The door was tapped. */
  onDoor: () => Promise<void>;
  /** The camera has arrived inside the house (true), or is back at the doorway (false). */
  onInside: (inside: boolean) => Promise<void>;
  /** A swipe moved to another wall, or a far jump has landed there. */
  onWall: (index: number) => Promise<void>;
  /** A frame on the wall in view was tapped (its place, 0 to 11), or the bare wallpaper was (null). */
  onFrame: (slot: number | null) => Promise<void>;
  /** The watering can has poured on a flower. */
  onWatered: (id: string) => Promise<void>;
  /** A friend's butterfly has landed, or could not come: either way their vote can now show. */
  onVisit: (who: string, id: string, landed: boolean) => Promise<void>;
  /** The picture for a postcard, cut to its shape, as a JPEG's data address. Null if it could not be taken. */
  onSnapshot: (picture: string | null) => Promise<void>;
  /** The finished postcard, as a JPEG's data address. Null if it could not be made. */
  onCard: (card: string | null) => Promise<void>;
  /** The garden could not be drawn at all: this browser has no WebGL. */
  onFailed: () => Promise<void>;
  dom?: import('expo/dom').DOMProps;
};

// The app's fonts by the names expo-font gives them. Each is one weight, so no weight is asked for.
const FONTS = { tag: '11px/1.2 Nunito_800ExtraBold, sans-serif', marker: '84px Nunito_900Black, sans-serif', caption: 'Nunito_900Black, sans-serif' };

/** What a screen reader says after a flower's name. */
const STAGE_SAYS: Record<Stage, string> = { 1: 'New', 2: 'Waiting on votes', 3: "Everyone's in", 4: 'Planned' };

// Inside the phone app this is the whole of a small web page, so it is pinned to that page's edges.
const IN_APP = Boolean(process.env.EXPO_DOM_HOST_OS);

/** The picture on a postcard, in dots: four wide to five tall. */
const PICTURE = { width: 984, height: 1230 };
/** How long a friend's butterfly waits its turn before its vote is simply shown, in milliseconds. */
const VISIT_WAITS = 20000;

const fill: CSSProperties = { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 };
/** There for a keyboard and a screen reader, and not drawn. */
const unseen: CSSProperties = { position: 'absolute', width: 1, height: 1, margin: -1, padding: 0, overflow: 'hidden', clipPath: 'inset(50%)', whiteSpace: 'nowrap', border: 0 };

const loadPicture = (address: string) =>
  new Promise<HTMLImageElement>((loaded, failed) => {
    const image = new Image();
    image.onload = () => loaded(image);
    image.onerror = () => failed(new Error('The picture could not be read.'));
    image.src = address;
  });

/**
 * The part of a picture of the whole garden that goes on a postcard: four wide to five tall, taken
 * from 60% of the way down, so the house and the front flowers are both in it.
 */
function cutForPostcard(image: HTMLImageElement): HTMLCanvasElement {
  const cut = document.createElement('canvas');
  cut.width = PICTURE.width;
  cut.height = PICTURE.height;
  const pen = cut.getContext('2d');
  if (!pen) throw new Error('No drawing surface.');
  const shape = PICTURE.height / PICTURE.width;
  // A tall picture loses some of its top and bottom. A wide one loses its sides.
  const tall = image.naturalHeight >= image.naturalWidth * shape;
  const sw = tall ? image.naturalWidth : image.naturalHeight / shape;
  const sh = tall ? image.naturalWidth * shape : image.naturalHeight;
  pen.drawImage(image, (image.naturalWidth - sw) / 2, (image.naturalHeight - sh) * 0.6, sw, sh, 0, 0, cut.width, cut.height);
  return cut;
}

/** The finished postcard, 1080 by 1500: a white card with the picture, the group's name and a line under it. */
function drawPostcard(picture: HTMLCanvasElement, name: string, line: string): string {
  const card = document.createElement('canvas');
  card.width = 1080;
  card.height = 1500;
  const pen = card.getContext('2d');
  if (!pen) throw new Error('No drawing surface.');
  pen.fillStyle = POSTCARD.card;
  pen.fillRect(0, 0, card.width, card.height);
  pen.drawImage(picture, 48, 48, PICTURE.width, PICTURE.height);
  // A long name is cut short with an ellipsis, so it never runs off the card.
  const fitted = (words: string) => {
    if (pen.measureText(words).width <= PICTURE.width) return words;
    let cut = words;
    while (cut.length > 1 && pen.measureText(`${cut}…`).width > PICTURE.width) cut = cut.slice(0, -1);
    return `${cut.trimEnd()}…`;
  };
  pen.fillStyle = POSTCARD.ink;
  pen.font = '56px Nunito_900Black, sans-serif';
  pen.fillText(fitted(name), 48, 1372);
  pen.fillStyle = POSTCARD.muted;
  pen.font = '34px Nunito_700Bold, sans-serif';
  pen.fillText(fitted(line), 48, 1428);
  return card.toDataURL('image/jpeg', 0.92);
}

export default function GardenView(props: Props) {
  const host = useRef<HTMLDivElement>(null);
  const labels = useRef<HTMLDivElement>(null);
  const garden = useRef<Garden | null>(null);
  const sound = useRef<GardenSound | null>(null);
  // What the garden was last told, so each change is sent once.
  const told = useRef({ bed: props.bed, pick: null as number | null, water: null as number | null, visit: 0, hung: props.hung, snap: props.snap, card: null as number | null, chime: null as number | null });
  // The newest of what the screen passed in, for the garden to call back with.
  const latest = useRef(props);
  useEffect(() => {
    latest.current = props;
  });
  // The last picture taken for a postcard, cut to shape, which the finished card is made from.
  const picture = useRef<HTMLCanvasElement | null>(null);
  // Friends' butterflies waiting their turn: only one flies at a time.
  const waiting = useRef<(Visit & { since: number })[]>([]);

  // The date markers and the postcard are painted with the app's font, so the garden waits for it, but not for long.
  const [fontsLoaded] = useFonts({ Nunito_700Bold, Nunito_800ExtraBold, Nunito_900Black });
  const [waited, setWaited] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setWaited(true), 1500);
    return () => clearTimeout(timer);
  }, []);
  const ready = fontsLoaded || waited;

  useEffect(() => {
    if (!ready || !host.current || !labels.current) return;
    const now = latest.current;
    let made: Garden;
    try {
      made = createGarden(
        host.current,
        labels.current,
        {
          onSelect: (id) => void latest.current.onSelect(id),
          onLanded: (id) => {
            void latest.current.onLanded(id);
            // If marking it as done did not go through, the idea is still on the list: plant it again.
            setTimeout(() => garden.current?.setFlowers(latest.current.flowers), 0);
          },
          onPickArrive: (id) => void latest.current.onPickArrive(id),
          onDoor: () => void latest.current.onDoor(),
          onInside: (inside) => void latest.current.onInside(inside),
          onWall: (index) => void latest.current.onWall(index),
          onFrame: (slot) => void latest.current.onFrame(slot),
          onWatered: (id) => void latest.current.onWatered(id),
          onVisit: (who, id) => void latest.current.onVisit(who, id, true),
        },
        {
          // A phone gets the lighter garden: in the app, or on the website with a finger for a pointer.
          quality: IN_APP || window.matchMedia('(pointer: coarse)').matches ? 'light' : 'full',
          options: {
            time: now.time,
            still: now.still,
            earned: now.earned,
            leaves: now.leaves,
            season: now.season,
            lawn: now.lawn,
            roof: now.roof,
            walls: now.walls,
            door: now.door,
            bench: now.bench,
            bath: now.bath,
            lights: now.lights,
          },
          fonts: FONTS,
        },
      );
    } catch {
      void latest.current.onFailed();
      return;
    }
    garden.current = made;
    told.current = { ...told.current, bed: now.bed, pick: now.pick?.turn ?? null, water: now.water?.turn ?? null, hung: now.hung, snap: now.snap, card: now.card?.turn ?? null };
    made.setMemories(now.memories, now.wall);
    made.setFlowers(now.flowers, 'intro');
    made.select(now.selected);
    made.setHouse(now.house);
    made.setOverview(now.overview);
    made.setPaused(now.paused || document.hidden);
    // Nothing is drawn while the page itself is out of sight.
    const onHidden = () => made.setPaused(latest.current.paused || document.hidden);
    document.addEventListener('visibilitychange', onHidden);
    // Friends' butterflies fly in one at a time. One that cannot come (its flower is not on show,
    // or it has waited too long) is let go, so that friend's vote shows without it.
    const usher = setInterval(() => {
      const next = waiting.current[0];
      if (!next) return;
      const here = latest.current.flowers.some((f) => f.id === next.id && !f.fly);
      if (here && !latest.current.still && made.visit(next.who, next.id, next.color, next.name)) {
        waiting.current.shift();
      } else if (!here || latest.current.still || Date.now() - next.since > VISIT_WAITS) {
        waiting.current.shift();
        void latest.current.onVisit(next.who, next.id, false);
      }
    }, 300);
    return () => {
      document.removeEventListener('visibilitychange', onHidden);
      clearInterval(usher);
      garden.current = null;
      made.dispose();
    };
  }, [ready]);

  // The sounds. A browser only lets a page make sound once it has been touched, so every touch wakes them.
  useEffect(() => {
    const made = makeSound();
    sound.current = made;
    const wake = () => made.wake();
    document.addEventListener('pointerdown', wake, true);
    document.addEventListener('keydown', wake, true);
    return () => {
      document.removeEventListener('pointerdown', wake, true);
      document.removeEventListener('keydown', wake, true);
      sound.current = null;
      made.dispose();
    };
  }, []);

  const { flowers, bed, selected, pick, time, still, earned, leaves, season, lawn, roof, walls, door, bench, bath, lights, hung, house, wall, frame, overview, water, visits, snap, card, chime, paused } = props;
  useEffect(() => {
    if (!garden.current) return;
    if (told.current.bed !== bed) {
      told.current.bed = bed;
      garden.current.replant(flowers);
    } else {
      garden.current.setFlowers(flowers);
    }
  }, [flowers, bed]);
  useEffect(() => {
    garden.current?.select(selected);
  }, [selected]);
  useEffect(() => {
    if (!garden.current || !pick || told.current.pick === pick.turn) return;
    told.current.pick = pick.turn;
    garden.current.pick(pick.id);
  }, [pick]);
  useEffect(() => {
    garden.current?.setOptions({ time, still, earned, leaves, season, lawn, roof, walls, door, bench, bath, lights });
  }, [time, still, earned, leaves, season, lawn, roof, walls, door, bench, bath, lights]);
  // The walls are hung before the wall to stand at is given, so a new set of walls is stood at the right one.
  useEffect(() => {
    if (!garden.current) return;
    if (told.current.hung !== hung) {
      told.current.hung = hung;
      garden.current.setMemories(latest.current.memories, wall);
    } else {
      garden.current.setWall(wall);
    }
    garden.current.selectFrame(frame);
  }, [hung, wall, frame]);
  useEffect(() => {
    garden.current?.setHouse(house);
  }, [house]);
  useEffect(() => {
    garden.current?.setOverview(overview);
  }, [overview]);
  useEffect(() => {
    if (!garden.current || !water || told.current.water === water.turn) return;
    told.current.water = water.turn;
    garden.current.water(water.id);
  }, [water]);
  useEffect(() => {
    for (const visit of visits) {
      if (visit.turn <= told.current.visit) continue;
      told.current.visit = visit.turn;
      waiting.current.push({ ...visit, since: Date.now() });
    }
  }, [visits]);
  useEffect(() => {
    garden.current?.setPaused(paused || document.hidden);
  }, [paused]);

  // A postcard: first the picture, which the screen shows on a card, then the finished card when it is shared or saved.
  useEffect(() => {
    if (!garden.current || told.current.snap === snap) return;
    told.current.snap = snap;
    let address: string;
    try {
      address = garden.current.snapshot();
    } catch {
      void latest.current.onSnapshot(null);
      return;
    }
    loadPicture(address).then(
      (image) => {
        try {
          picture.current = cutForPostcard(image);
          void latest.current.onSnapshot(picture.current.toDataURL('image/jpeg', 0.9));
        } catch {
          void latest.current.onSnapshot(null);
        }
      },
      () => void latest.current.onSnapshot(null),
    );
  }, [snap]);
  useEffect(() => {
    if (!card || told.current.card === card.turn) return;
    told.current.card = card.turn;
    try {
      if (!picture.current) throw new Error('No picture has been taken.');
      void latest.current.onCard(drawPostcard(picture.current, card.name, card.line));
    } catch {
      void latest.current.onCard(null);
    }
  }, [card]);

  const { sound: soundOn } = props;
  useEffect(() => {
    sound.current?.setNight(time === 'night');
  }, [time]);
  useEffect(() => {
    sound.current?.toggle(soundOn);
  }, [soundOn]);
  useEffect(() => {
    if (!chime || told.current.chime === chime.turn) return;
    told.current.chime = chime.turn;
    sound.current?.play(chime.name);
  }, [chime]);

  return (
    <div
      style={
        {
          ...fill,
          position: IN_APP ? 'fixed' : 'absolute',
          overflow: 'hidden',
          userSelect: 'none',
          WebkitUserSelect: 'none',
          WebkitTouchCallout: 'none',
          WebkitTapHighlightColor: 'transparent',
          touchAction: 'none',
          '--garden-card': props.tag.card,
          '--garden-ink': props.tag.ink,
        } as CSSProperties
      }>
      <div
        ref={host}
        role="img"
        aria-label={house ? 'Inside the house: a hallway where every finished idea hangs in a frame' : "The group's garden: a house on a hill, with a flower in the yard for each idea"}
        style={fill}
      />
      <div ref={labels} style={{ ...fill, pointerEvents: 'none', overflow: 'hidden' }} />
      {/* The same flowers as a list nobody sees, so the garden can be used with a keyboard or a screen
          reader: each can be reached, shows its name when it is, and opens when pressed. Inside the
          house the list of finished ideas, which the screen draws, does the same job. */}
      {house ? null : (
        <ul aria-label="Ideas in the garden" style={{ ...unseen, listStyle: 'none' }}>
          {flowers
            .filter((f) => !f.fly)
            .map((f) => (
              <li key={f.id}>
                <button type="button" onFocus={() => garden.current?.focus(f.id)} onBlur={() => garden.current?.focus(null)} onClick={() => void props.onSelect(f.id)}>
                  {f.title}. {STAGE_SAYS[f.stage]}
                </button>
              </li>
            ))}
        </ul>
      )}
    </div>
  );
}
