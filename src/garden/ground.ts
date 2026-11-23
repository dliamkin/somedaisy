// The lie of the land in the garden, as plain sums: how high the hill is at any spot, where the
// path runs, how the wind blows, and the noise the lawn is painted from. Nothing here draws
// anything, so it gives the same answers in tests as on a screen.
//
// The numbers come from the design handoff (design_handoff_garden_a/garden3d.js) and are final.
// Units are roughly metres. Y is up, and the camera looks toward negative Z.

/** The hill is the top of a ball this big, centred this far back. */
export const HILL = 16;
export const HILL_Z = -1;

/** How high the ground is at a spot. Everything in the garden is stood on this. */
export function groundY(x: number, z: number): number {
  return Math.sqrt(Math.max(0, HILL * HILL - x * x - (z - HILL_Z) * (z - HILL_Z))) - HILL;
}

export function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

/** Where the path is, side to side, at a given distance down the garden. It wanders, then bends to the door. */
export function pathX(z: number): number {
  return 0.4 * Math.sin(z * 0.8) - 0.5 * clamp((-z - 1) / 3, 0, 1);
}

/** Moves `a` toward `b` at `rate` a second, smoothly, whatever the time between frames. */
export function damp(a: number, b: number, rate: number, dt: number): number {
  return a + (b - a) * (1 - Math.exp(-rate * dt));
}

/**
 * The wind at a spot and a moment. Flowers ask this here, and the grass and leaves ask the same
 * sum on the graphics card (`WIND_GLSL` in kit.ts), so everything sways together. `amp` is 0 for
 * a still garden and 1 for a gentle one.
 */
export function wind(x: number, z: number, t: number, amp: number): number {
  return amp * (Math.sin(t * 1.15 + x * 0.7 + z * 0.45) * 0.6 + Math.sin(t * 2.4 + x * 1.4 - z * 0.3) * 0.25 + Math.pow(Math.max(0, Math.sin(t * 0.23 + x * 0.2)), 6) * 0.8);
}

/**
 * Numbers from 0 to 1 that look random but come out the same every time, so the trees, shrubs and
 * grass are the same garden on every visit.
 */
export function seeded(seed = 7): () => number {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
}

function hash(x: number, y: number): number {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return s - Math.floor(s);
}

/** Soft blotches from 0 to 1 that change smoothly from place to place. */
export function noise(x: number, y: number): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  return (hash(xi, yi) * (1 - u) + hash(xi + 1, yi) * u) * (1 - v) + (hash(xi, yi + 1) * (1 - u) + hash(xi + 1, yi + 1) * u) * v;
}

/** A speckle from 0 to 1 that is different at every spot. */
export const speckle = hash;

/** Three sizes of blotch laid over each other. */
export function blotches(x: number, y: number): number {
  return noise(x, y) * 0.5 + noise(x * 2.1 + 5.2, y * 2.1 + 1.3) * 0.3 + noise(x * 4.3 + 1.7, y * 4.3 + 9.2) * 0.2;
}

export type Rgb = [number, number, number];

export function mix3(a: Rgb, b: Rgb, t: number): Rgb {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

/**
 * What the lawn is like at a spot: how light its green is, how dry it is, and how far outside the
 * garden it is (0 inside, rising to 1 beyond the edges). The painted ground and the blades of
 * grass both read this, so they agree.
 */
export function lawn(x: number, z: number): { light: number; dry: number; out: number } {
  const light = blotches(x * 0.42 + 3.1, z * 0.42 + 7.7);
  const out = clamp(Math.max(Math.abs(x) - 3.4, z - 5, -6.5 - z) / 1.6, 0, 1);
  const dry = Math.min(1, Math.max(0, (noise(x * 0.8 + 31, z * 0.8 + 12) - 0.6) / 0.4) + out * 0.4);
  return { light, dry, out };
}

/** The stepping stones down the path, from the front of the garden to the door: where each one lies. */
export function steppingStones(): [number, number][] {
  const stones: [number, number][] = [];
  let i = 0;
  for (let z = 3.5; z > -3.8; z -= 0.62, i++) stones.push([pathX(z) + (i % 2 ? 0.09 : -0.09), z]);
  return stones;
}
