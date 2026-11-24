import { HOUSE_PAINTS } from '../../garden/palette';
import { DEFAULT_LOOK, earnedWords, EXTRAS, extrasOut, gardenLook, houseGrew, houseLevel, HOUSES, houseWords, LAWNS, lockedWords, newlyEarned, PAINT_NAMES, seasonFor, southern } from '../garden-look';
import { TITLES } from '../points';

const NONE_OUT = { bench: false, bath: false, lights: false, picnic: false, wood: false, fire: false, pond: false };

describe("a group's choices for its garden", () => {
  it('is the garden as it first was when nothing is saved', () => {
    expect(gardenLook(null)).toEqual(DEFAULT_LOOK);
    expect(gardenLook(undefined)).toEqual(DEFAULT_LOOK);
    expect(gardenLook('mown')).toEqual(DEFAULT_LOOK);
    expect(DEFAULT_LOOK).toEqual({ roof: '#8A4BE6', walls: '#FFFFFF', door: '#6D2FC4', lawn: 'soft', bench: true, bath: true, lights: true, picnic: true, wood: true, fire: true, pond: true });
  });

  it('reads what a group chose', () => {
    const saved = { roof: '#1FA98A', walls: '#FFD9C7', door: '#E8B923', lawn: 'meadow', bench: false, bath: true, lights: false, picnic: true, wood: false, fire: true, pond: false };
    expect(gardenLook(saved)).toEqual(saved);
  });

  it('reads a garden saved before the four newer extras as having them switched on', () => {
    const old = { roof: '#1FA98A', walls: '#FFD9C7', door: '#E8B923', lawn: 'meadow', bench: false, bath: true, lights: false };
    expect(gardenLook(old)).toEqual({ ...old, picnic: true, wood: true, fire: true, pond: true });
  });

  it('offers twenty-four colours for each part of the house, none of them twice', () => {
    for (const part of [HOUSE_PAINTS.roof, HOUSE_PAINTS.walls, HOUSE_PAINTS.door]) {
      expect(part).toHaveLength(24);
      expect(new Set(part).size).toBe(24);
      for (const color of part) expect(color).toMatch(/^#[0-9A-F]{6}$/);
    }
  });

  it('keeps a saved look within what the database allows', () => {
    // The check in update 023 allows 400 characters.
    expect(JSON.stringify(DEFAULT_LOOK).length).toBeLessThan(400);
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
  it('earns a bench at 5 things done, a birdbath at 10 and string lights at 20, then a picnic at 30, a woodpile at 40, a fire pit at 60 and a pond at 80', () => {
    expect(EXTRAS.map((e) => [e.key, e.at])).toEqual([
      ['bench', 5],
      ['bath', 10],
      ['lights', 20],
      ['picnic', 30],
      ['wood', 40],
      ['fire', 60],
      ['pond', 80],
    ]);
  });

  it('puts out only what is earned and switched on', () => {
    expect(extrasOut(DEFAULT_LOOK, 4)).toEqual(NONE_OUT);
    expect(extrasOut(DEFAULT_LOOK, 5)).toEqual({ ...NONE_OUT, bench: true });
    expect(extrasOut(DEFAULT_LOOK, 20)).toEqual({ ...NONE_OUT, bench: true, bath: true, lights: true });
    expect(extrasOut({ ...DEFAULT_LOOK, bench: false }, 20)).toEqual({ ...NONE_OUT, bath: true, lights: true });
    expect(extrasOut(DEFAULT_LOOK, 59)).toEqual({ ...NONE_OUT, bench: true, bath: true, lights: true, picnic: true, wood: true });
    expect(extrasOut({ ...DEFAULT_LOOK, fire: false }, 80)).toEqual({ bench: true, bath: true, lights: true, picnic: true, wood: true, fire: false, pond: true });
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
    expect(earnedWords(30, EXTRAS[3])).toBe('30 things done. Picnic blanket unlocked');
    expect(lockedWords(58, EXTRAS[5])).toBe('Do 2 more things together to unlock the fire pit');
  });
});

describe('the house growing with rank', () => {
  it('has six levels, from a cottage to a mansion', () => {
    expect(HOUSES.map((h) => h.name)).toEqual(['Cottage', 'Cottage with a garage', 'Two-story home', 'Home with a lanai', 'Home with a patio', 'Mansion']);
  });

  it('gives each of the first six ranks a level, and holds at the mansion after that', () => {
    expect(TITLES.map((t) => [t.title, houseLevel(t.at)])).toEqual([
      ['Homebodies', 1],
      ['Dabblers', 2],
      ['Weekenders', 3],
      ['Go-Getters', 4],
      ['Thrill Seekers', 5],
      ['Trailblazers', 6],
      ['Daredevils', 6],
      ['Legends', 6],
    ]);
    expect(houseLevel(29)).toBe(1);
    expect(houseLevel(100000)).toBe(6);
  });

  it('is the cottage when the points are not known', () => {
    expect(houseLevel(null)).toBe(1);
  });

  it('says what the house is and what the next rank adds', () => {
    expect(houseWords(1)).toEqual({ name: 'Cottage', rest: ' · rank level 1 of 6. The next rank adds a garage.' });
    expect(houseWords(3)).toEqual({ name: 'Two-story home', rest: ' · rank level 3 of 6. The next rank adds a lanai across the front.' });
    expect(houseWords(5).rest).toBe(' · rank level 5 of 6. The next rank adds a room over the garage and a cupola with a pennant.');
    expect(houseWords(6)).toEqual({ name: 'Mansion', rest: ' · rank level 6 of 6. As grand as it gets.' });
    // Anything out of range is held within it.
    expect(houseWords(0).name).toBe('Cottage');
    expect(houseWords(9).name).toBe('Mansion');
  });

  it('says so when the house grows, and only then', () => {
    expect(houseGrew(1, 2)).toBe('Level up! The house grew: a garage');
    expect(houseGrew(4, 5)).toBe('Level up! The house grew: a patio with an umbrella');
    expect(houseGrew(2, 2)).toBeNull();
    expect(houseGrew(3, 2)).toBeNull();
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
