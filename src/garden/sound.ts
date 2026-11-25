// The garden's sounds: a soft bed of wind, birdsong by day and crickets at night, short runs of
// notes when things happen, and the small noises of the things that answer a tap (a rustle, a
// footstep, a creak). All of it is made here as it plays. There are no sound files.
//
// It is web code, like the rest of this folder: it needs a browser's Web Audio. A browser only
// lets a page make sound once the person has touched it, so `wake` is called on every touch.
//
// Ported from the design handoff (design_handoff_garden_a_v2), where it is a guide to what plays
// and when. The notes are a triangle wave with a quiet octave above, half a second long and 90ms
// apart, in a major scale on G.

import { STEP_EVERY } from './plan';

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

/**
 * The noise of something in the garden or the house that was tapped (see toys.ts): leaves shaken,
 * footsteps up the path, the attic window and whoever is behind it, the chimney, water, the fire,
 * the daisy in the sky, a lamp, a page, and the daisies in the vase opening.
 */
export type Effect = 'rustle' | 'steps' | 'attic' | 'chimney' | 'splash' | 'plop' | 'crackle' | 'sun' | 'lamp' | 'page' | 'petals';

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
  /** Hiss, for the sounds that are not notes: a second of it, made once and played through a filter each time. */
  let hissing: AudioBuffer | null = null;
  const hiss = (at: number, lasts: number, loud: number, kind: BiquadFilterType, from: number, to: number, sharp = 1) => {
    if (!context || !master) return;
    if (!hissing) {
      hissing = context.createBuffer(1, context.sampleRate, context.sampleRate);
      const samples = hissing.getChannelData(0);
      for (let i = 0; i < samples.length; i++) samples[i] = Math.random() * 2 - 1;
    }
    const source = context.createBufferSource();
    const filter = context.createBiquadFilter();
    const gain = context.createGain();
    source.buffer = hissing;
    source.loop = true;
    filter.type = kind;
    filter.Q.value = sharp;
    filter.frequency.setValueAtTime(from, at);
    filter.frequency.exponentialRampToValueAtTime(to, at + lasts);
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.linearRampToValueAtTime(loud, at + Math.min(0.02, lasts / 3));
    gain.gain.exponentialRampToValueAtTime(0.0001, at + lasts);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    // Started somewhere different in the second of hiss each time, so no two sound quite alike.
    source.start(at, Math.random() * 0.9);
    source.stop(at + lasts + 0.05);
  };
  /** One note of the scale on G, as the runs of notes are played. */
  const note = (step: number, at: number, loud = 0.16) => {
    const pitch = 392 * Math.pow(2, step / 12);
    tone(pitch, pitch * 0.999, at, 0.5, loud, 'triangle');
    tone(pitch * 2, pitch * 1.998, at, 0.18, loud * 0.3);
  };
  /** What each tapped thing sounds like. `detail` is how many footsteps, or which colour a lamp has turned to. */
  const EFFECTS: Record<Effect, (at: number, detail: number) => void> = {
    // Leaves: three soft swishes, each a little lower.
    rustle: (at) => {
      for (let i = 0; i < 3; i++) hiss(at + i * 0.16, 0.3, 0.13 - i * 0.02, 'bandpass', 5200 - i * 600, 2400, 0.8);
    },
    // Footsteps up the path, one to a stone, and the door at the end of them.
    steps: (at, count) => {
      for (let i = 0; i < count; i++) {
        const t = at + i * STEP_EVERY;
        tone(i % 2 ? 150 : 170, 70, t, 0.1, 0.22);
        hiss(t, 0.06, 0.05, 'lowpass', 900, 300);
      }
      const door = at + count * STEP_EVERY + 0.1;
      tone(310, 430, door, 0.32, 0.03, 'sawtooth');
      tone(430, 300, door + 0.75, 0.3, 0.025, 'sawtooth');
    },
    // The attic window creaks open, and whoever is there says hello in two notes.
    attic: (at) => {
      tone(380, 560, at, 0.34, 0.03, 'sawtooth');
      note(7, at + 0.62, 0.13);
      note(12, at + 0.8, 0.13);
      tone(520, 360, at + 2.45, 0.3, 0.025, 'sawtooth');
    },
    // Three chuffs, then a soft hoot for the ring of smoke.
    chimney: (at) => {
      for (let i = 0; i < 3; i++) hiss(at + i * 0.13, 0.2, 0.3, 'lowpass', 700, 180);
      tone(260, 390, at + 0.55, 0.5, 0.06);
    },
    splash: (at) => {
      hiss(at, 0.36, 0.2, 'bandpass', 2600, 700, 0.7);
      for (let i = 0; i < 3; i++) tone(900 + i * 260, 1500 + i * 300, at + 0.12 + i * 0.09, 0.07, 0.06);
    },
    plop: (at) => {
      tone(520, 170, at, 0.13, 0.2);
      tone(300, 760, at + 0.11, 0.09, 0.12);
    },
    crackle: (at) => {
      for (let i = 0; i < 9; i++) hiss(at + Math.random() * 0.7, 0.02, 0.12 + Math.random() * 0.14, 'highpass', 2600, 3400);
      hiss(at, 0.5, 0.05, 'lowpass', 500, 220);
    },
    // The daisy in the sky spins: a quick run up the scale.
    sun: (at) => {
      [0, 4, 7, 12, 16].forEach((step, i) => note(step, at + i * 0.07, 0.11));
    },
    // A lamp: the click of its switch, and a note that goes up with each colour.
    lamp: (at, color) => {
      hiss(at, 0.012, 0.25, 'highpass', 3000, 3600);
      note([0, 2, 4, 7, 9, 12][Math.max(0, color) % 6], at + 0.03, 0.12);
    },
    page: (at) => {
      hiss(at + 0.45, 0.24, 0.1, 'bandpass', 1400, 4200, 0.9);
      hiss(at + 0.95, 0.24, 0.1, 'bandpass', 1600, 4600, 0.9);
      hiss(at + 2.3, 0.04, 0.12, 'lowpass', 500, 200);
    },
    // The daisies in the vase open one after another. `detail` is 0 when they close again.
    petals: (at, opening) => {
      (opening ? [4, 7, 12] : [12, 7, 4]).forEach((step, i) => note(step, at + i * 0.13, 0.1));
    },
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
        NOTES[name].forEach((step, i) => note(step, now + i * 0.09));
      } catch {
        // As above.
      }
    },
    /** The noise of something that was tapped. Silent while the sounds are off, like everything else. */
    effect(name: Effect, detail = 0) {
      if (!on || !context || context.state !== 'running') return;
      try {
        EFFECTS[name](context.currentTime, detail);
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
      hissing = null;
    },
  };
}
