import { HOUSE_PAINTS } from '../../garden/palette';
import { DEFAULT_LOOK, earnedWords, EXTRAS, extrasOut, gardenLook, LAWNS, lockedWords, newlyEarned, PAINT_NAMES, seasonFor, southern } from '../garden-look';

describe("a group's choices for its garden", () => {
  it('is the garden as it first was when nothing is saved', () => {
    expect(gardenLook(null)).toEqual(DEFAULT_LOOK);
    expect(gardenLook(undefined)).toEqual(DEFAULT_LOOK);
    expect(gardenLook('mown')).toEqual(DEFAULT_LOOK);
    expect(DEFAULT_LOOK).toEqual({ roof: '#8A4BE6', walls: '#FFFFFF', door: '#6D2FC4', lawn: 'soft', bench: true, bath: true, lights: true });
  });

  it('reads what a group chose', () => {
    const saved = { roof: '#1FA98A', walls: '#FFD9C7', door: '#E8B923', lawn: 'meadow', bench: false, bath: true, lights: false };
    expect(gardenLook(saved)).toEqual(saved);
  });

  it('takes a colour whichever way its letters are written', () => {
    expect(gardenLook({ roof: '#1fa98a' }).roof).toBe('#1FA98A');
  });

  it('falls back, part by part, on anything that is not on offer', () => {
    const look = gardenLook({ roof: '#000000', walls: 42, door: '#E8B923', lawn: 'astroturf', bench: 'no' });
    expect(look).toEqual({ ...DEFAULT_LOOK, door: '#E8B923' });
  });

  it('has a name to read out for every colour on offer', () => {
    for (const color of [...HOUSE_PAINTS.roof, ...HOUSE_PAINTS.walls, ...HOUSE_PAINTS.door]) expect(PAINT_NAMES[color]).toBeTruthy();
    expect(LAWNS.map((l) => l.key)).toEqual(['soft', 'mown', 'meadow']);
  });
});

describe('what a group earns', () => {
  it('earns a bench at 5 things done, a birdbath at 10 and string lights at 20', () => {
    expect(EXTRAS.map((e) => [e.key, e.at])).toEqual([
      ['bench', 5],
      ['bath', 10],
      ['lights', 20],
    ]);
  });

  it('puts out only what is earned and switched on', () => {
    expect(extrasOut(DEFAULT_LOOK, 4)).toEqual({ bench: false, bath: false, lights: false });
    expect(extrasOut(DEFAULT_LOOK, 5)).toEqual({ bench: true, bath: false, lights: false });
    expect(extrasOut(DEFAULT_LOOK, 20)).toEqual({ bench: true, bath: true, lights: true });
    expect(extrasOut({ ...DEFAULT_LOOK, bench: false }, 20)).toEqual({ bench: false, bath: true, lights: true });
  });

  it('notices an extra the moment its number is reached, and only then', () => {
    expect(newlyEarned(4, 5).map((e) => e.key)).toEqual(['bench']);
    expect(newlyEarned(5, 6)).toEqual([]);
    expect(newlyEarned(9, 20).map((e) => e.key)).toEqual(['bath', 'lights']);
    // Undoing something earns nothing.
    expect(newlyEarned(5, 4)).toEqual([]);
  });

  it('says what was earned, and how far off a locked one is', () => {
    expect(earnedWords(5, EXTRAS[0])).toBe('5 things done. Bench unlocked');
    expect(earnedWords(20, EXTRAS[2])).toBe('20 things done. String lights unlocked');
    expect(lockedWords(3, EXTRAS[0])).toBe('Do 2 more things together to unlock the bench');
    expect(lockedWords(9, EXTRAS[1])).toBe('Do 1 more thing together to unlock the birdbath');
    expect(lockedWords(0, EXTRAS[2])).toBe('Do 20 more things together to unlock the string lights');
  });
});

describe('the season', () => {
  const on = (month: number) => new Date(2026, month, 15);

  it('follows the months in the north', () => {
    expect([11, 0, 1].map((m) => seasonFor(on(m), 'Europe/London'))).toEqual(['winter', 'winter', 'winter']);
    expect([2, 3, 4].map((m) => seasonFor(on(m), 'America/New_York'))).toEqual(['spring', 'spring', 'spring']);
    expect([5, 6, 7].map((m) => seasonFor(on(m), 'Asia/Tokyo'))).toEqual(['summer', 'summer', 'summer']);
    expect([8, 9, 10].map((m) => seasonFor(on(m), 'UTC'))).toEqual(['autumn', 'autumn', 'autumn']);
  });

  it('is the other way round in the south', () => {
    expect(seasonFor(on(0), 'Australia/Sydney')).toBe('summer');
    expect(seasonFor(on(6), 'Pacific/Auckland')).toBe('winter');
    expect(seasonFor(on(10), 'America/Argentina/Buenos_Aires')).toBe('spring');
    expect(seasonFor(on(3), 'Africa/Johannesburg')).toBe('autumn');
  });

  it('tells north from south by the time zone alone', () => {
    expect(southern('Australia/Perth')).toBe(true);
    expect(southern('America/Sao_Paulo')).toBe(true);
    expect(southern('America/Chicago')).toBe(false);
    expect(southern('Pacific/Honolulu')).toBe(false);
    expect(southern('')).toBe(false);
  });
});
