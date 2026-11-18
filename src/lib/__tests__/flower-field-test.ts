import { flowerField, PATCH, reach } from '../flower-field';

describe('flowerField', () => {
  it('gives the same flowers for the same box every time', () => {
    expect(flowerField(320, 150)).toEqual(flowerField(320, 150));
  });

  it('has nothing to draw until the box has a size', () => {
    expect(flowerField(0, 0)).toEqual([]);
    expect(flowerField(320, 0)).toEqual([]);
    expect(flowerField(Number.NaN, 100)).toEqual([]);
  });

  it('keeps every flower the same size whatever the shape of the box', () => {
    const sizes = (w: number, h: number) => flowerField(w, h).map((f) => f.r);
    for (const [w, h] of [
      [110, 60],
      [320, 150],
      [480, 100],
      [320, 600],
    ]) {
      expect(Math.max(...sizes(w, h))).toBeLessThanOrEqual(19);
      expect(Math.min(...sizes(w, h))).toBeGreaterThanOrEqual(7);
    }
  });

  it('starts a taller box with the same flowers as a shorter one, so nothing repeats or restarts', () => {
    const short = flowerField(320, 100);
    const tall = flowerField(320, 400);
    expect(tall.slice(0, short.length)).toEqual(short);
    // The rows further down are not copies of the rows above.
    const rowOf = (n: number) => tall.filter((f) => Math.floor((f.y + PATCH / 2) / PATCH) === n).map((f) => `${f.kind}${f.r}${f.turn}`).join();
    expect(rowOf(0)).not.toEqual(rowOf(2));
    expect(rowOf(2)).not.toEqual(rowOf(4));
  });

  it('reaches every edge of the box', () => {
    for (const [w, h] of [
      [110, 60],
      [327, 163],
      [480, 96],
    ]) {
      const field = flowerField(w, h);
      expect(Math.min(...field.map((f) => f.x))).toBeLessThan(PATCH / 2);
      expect(Math.max(...field.map((f) => f.x))).toBeGreaterThan(w - PATCH);
      expect(Math.min(...field.map((f) => f.y))).toBeLessThan(PATCH / 2);
      expect(Math.max(...field.map((f) => f.y))).toBeGreaterThan(h - PATCH);
    }
  });

  it('never lets two flowers touch', () => {
    const field = flowerField(480, 400);
    for (let a = 0; a < field.length; a++) {
      for (let b = a + 1; b < field.length; b++) {
        const gap = Math.hypot(field[a].x - field[b].x, field[a].y - field[b].y);
        expect(gap).toBeGreaterThan(reach(field[a]) + reach(field[b]));
      }
    }
  });

  it('shows different flowers when shifted along', () => {
    const look = (shift: number) => flowerField(110, 60, shift).map((f) => `${f.kind}${f.r}${f.turn}`).join();
    expect(look(0)).not.toEqual(look(7));
    expect(look(7)).not.toEqual(look(14));
  });

  it('mixes all three kinds of flower', () => {
    const kinds = new Set(flowerField(480, 300).map((f) => f.kind));
    expect([...kinds].sort()).toEqual(['bloom', 'bud', 'daisy']);
  });
});
