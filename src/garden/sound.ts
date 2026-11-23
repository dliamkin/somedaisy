// The garden's sounds: a soft bed of wind, birdsong by day and crickets at night, and short runs
// of notes when things happen. All of it is made here as it plays. There are no sound files.
//
// It is web code, like the rest of this folder: it needs a browser's Web Audio. A browser only
// lets a page make sound once the person has touched it, so `wake` is called on every touch.
//
// Ported from the design handoff (design_handoff_garden_a_v2), where it is a guide to what plays
// and when. The notes are a triangle wave with a quiet octave above, half a second long and 90ms
// apart, in a major scale on G.

/** What can be played: each is a run of notes. */
export type Chime = 'tap' | 'in' | 'bloom' | 'plan' | 'done' | 'add' | 'water' | 'visit' | 'snap' | 'door';

/** Each run, as steps of the scale above (or below) G. */
const NOTES: Record<Chime, number[]> = {
  /** Tapping a flower, a frame or a choice, and the bee arriving. */
  tap: [0],
  /** "I'm in" or "Eh". */
  in: [0, 4],
  /** A flower opens because everyone is in, or an extra is earned. */
  bloom: [0, 4, 7, 12],
  plan: [7, 12],
  /** A finished flower lands in the house. */
  done: [0, 7, 12, 16, 19],
  /** A new idea is planted. */
  add: [-5, 0],
  water: [12, 9, 7, 4],
  /** A friend's butterfly lands. */
  visit: [9, 12],
  /** The postcard's shutter. */
  snap: [19],
  door: [-5, 2, 7],
};

type AudioWindow = Window & { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext };

export type GardenSound = ReturnType<typeof makeSound>;

export function makeSound() {
  let context: AudioContext | null = null;
  let master: GainNode | null = null;
  let on = false;
  let night = false;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const tone = (from: number, to: number, at: number, lasts: number, loud: number, type: OscillatorType = 'sine') => {
    if (!context || !master) return;
    const voice = context.createOscillator();
    const gain = context.createGain();
    voice.type = type;
    voice.frequency.setValueAtTime(from, at);
    voice.frequency.exponentialRampToValueAtTime(to, at + lasts);
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.linearRampToValueAtTime(loud, at + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + lasts);
    voice.connect(gain);
    gain.connect(master);
    voice.start(at);
    voice.stop(at + lasts + 0.05);
  };
  /** Two to four quick rising chirps. */
  const chirp = () => {
    if (!context) return;
    const t = context.currentTime;
    const count = 2 + ((Math.random() * 3) | 0);
    const pitch = 2400 + Math.random() * 1400;
    for (let i = 0; i < count; i++) tone(pitch * (1 + 0.12 * Math.random()), pitch * (1.25 + 0.2 * Math.random()), t + i * 0.13, 0.09, 0.05);
  };
  /** A short pulsed burst. */
  const cricket = () => {
    if (!context) return;
    const t = context.currentTime;
    for (let i = 0; i < 3; i++) for (let j = 0; j < 4; j++) tone(4300, 4250, t + i * 0.22 + j * 0.03, 0.022, 0.02);
  };
  const stopTimer = () => {
    if (timer !== null) clearTimeout(timer);
    timer = null;
  };
  /** Birdsong every 1.8 to 6 seconds by day and at dusk. Crickets every 0.9 to 2.4 seconds at night. */
  const creatures = () => {
    stopTimer();
    if (!on) return;
    // Nothing is sung into a page that has not been allowed to make sound yet.
    if (context?.state === 'running') (night ? cricket : chirp)();
    timer = setTimeout(creatures, night ? 900 + Math.random() * 1500 : 1800 + Math.random() * 4200);
  };

  const start = () => {
    const Maker = (window as AudioWindow).AudioContext ?? (window as AudioWindow).webkitAudioContext;
    if (!Maker) return;
    context = context ?? new Maker();
    void context.resume();
    if (!master) {
      master = context.createGain();
      master.gain.value = 0;
      master.connect(context.destination);
      // The wind: four seconds of soft noise, played round and round through a filter that slowly opens and closes.
      const length = context.sampleRate * 4;
      const buffer = context.createBuffer(1, length, context.sampleRate);
      const samples = buffer.getChannelData(0);
      let b = 0;
      for (let i = 0; i < length; i++) {
        b = b * 0.985 + (Math.random() * 2 - 1) * 0.015;
        samples[i] = b * 5 * Math.min(1, i / 4000, (length - i) / 4000);
      }
      const source = context.createBufferSource();
      const filter = context.createBiquadFilter();
      const wind = context.createGain();
      const slow = context.createOscillator();
      const depth = context.createGain();
      source.buffer = buffer;
      source.loop = true;
      filter.type = 'lowpass';
      filter.frequency.value = 520;
      wind.gain.value = 0.5;
      slow.frequency.value = 0.13;
      depth.gain.value = 260;
      source.connect(filter);
      filter.connect(wind);
      wind.connect(master);
      slow.connect(depth);
      depth.connect(filter.frequency);
      source.start();
      slow.start();
    }
    master.gain.cancelScheduledValues(context.currentTime);
    master.gain.linearRampToValueAtTime(0.6, context.currentTime + 0.6);
    on = true;
    creatures();
  };

  return {
    /** Switch the sounds on or off. They fade in and out. */
    toggle(next: boolean) {
      try {
        if (next) start();
        else {
          on = false;
          stopTimer();
          if (context && master) {
            master.gain.cancelScheduledValues(context.currentTime);
            master.gain.linearRampToValueAtTime(0, context.currentTime + 0.3);
          }
        }
      } catch {
        // A browser that will not make sound simply stays quiet.
      }
    },
    /** Night has crickets where the day has birds. */
    setNight(next: boolean) {
      night = next;
    },
    /** The person has touched the page, which is when a browser lets it start making sound. */
    wake() {
      if (on && context && context.state === 'suspended') void context.resume();
    },
    play(name: Chime) {
      if (!on || !context || context.state !== 'running') return;
      try {
        const now = context.currentTime;
        NOTES[name].forEach((step, i) => {
          const pitch = 392 * Math.pow(2, step / 12);
          const at = now + i * 0.09;
          tone(pitch, pitch * 0.999, at, 0.5, 0.16, 'triangle');
          tone(pitch * 2, pitch * 1.998, at, 0.18, 0.05);
        });
      } catch {
        // As above.
      }
    },
    dispose() {
      on = false;
      stopTimer();
      void context?.close().catch(() => {});
      context = null;
      master = null;
    },
  };
}
