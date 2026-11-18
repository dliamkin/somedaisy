// Where the flowers go in a flowery background. The flowers are laid out for the exact size of
// the box they sit in, always at the same size, so a tall card and a short button show flowers
// of the same scale and nothing is stretched, repeated or cut along a seam. The same box always
// gets the same flowers.

export type FieldFlower = { kind: 'daisy' | 'bloom' | 'bud'; x: number; y: number; r: number; turn: number };

/** The size of the patch of ground each flower has to itself. */
export const PATCH = 46;

/** How far a flower's lines reach from its centre. A bud has a stem, so it reaches further than its size. */
export function reach(flower: Pick<FieldFlower, 'kind' | 'r'>): number {
  return flower.kind === 'bud' ? flower.r * 2 : flower.r;
}

// A number from 0 up to (not including) 1 that depends only on the patch and on `salt`.
function chance(col: number, row: number, salt: number): number {
  let h = Math.imul(col, 374761393) ^ Math.imul(row, 668265263) ^ Math.imul(salt + 1, 2147483647);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/**
 * The flowers for a box `width` by `height`. One flower per patch, placed loosely inside it so
 * the patches do not show and no two flowers touch. `shift` moves along to a different stretch
 * of the field, so boxes side by side do not show the same flowers.
 */
export function flowerField(width: number, height: number, shift = 0): FieldFlower[] {
  if (!(width > 0) || !(height > 0)) return [];
  const flowers: FieldFlower[] = [];
  // Start half a patch outside the box, so flowers run off every edge the same way.
  const rows = Math.ceil(height / PATCH + 0.5);
  const cols = Math.ceil(width / PATCH + 1);
  for (let row = 0; row < rows; row++) {
    // Every other row sits half a patch along, so the flowers do not line up in columns.
    const lean = row % 2 === 0 ? 0 : PATCH / 2;
    for (let c = 0; c < cols; c++) {
      const col = c + shift;
      const pick = chance(col, row, 0);
      const kind: FieldFlower['kind'] = pick < 0.42 ? 'daisy' : pick < 0.76 ? 'bloom' : 'bud';
      const size = chance(col, row, 1);
      const r = Math.round(kind === 'daisy' ? 12 + size * 7 : kind === 'bloom' ? 10 + size * 6 : 7 + size * 2);
      // How far the flower can wander and still stay clear of its neighbours.
      const room = Math.max(0, PATCH / 2 - reach({ kind, r }) - 1.5);
      const x = (c - 0.5) * PATCH + lean + PATCH / 2 + (chance(col, row, 2) * 2 - 1) * room;
      const y = (row - 0.5) * PATCH + PATCH / 2 + (chance(col, row, 3) * 2 - 1) * room;
      const turn = Math.round(chance(col, row, 4) * 72 - 36);
      flowers.push({ kind, x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10, r, turn });
    }
  }
  return flowers;
}
