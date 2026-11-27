import { COVER_SHAPE, COVER_WIDTH, fromPhotoKey, nextVersion, photoKey, uploadedPhoto, versioned } from '../cover-photos';
import { coverPath, type Cover } from '../covers';
import { keptSize } from '../picture-crop';

const GROUP = '0f0e0d0c-0b0a-4908-8706-050403020100';

describe('the part of a photo kept as a cover', () => {
  it('is cut down to the widest a cover is kept, in the shape a cover is kept in', () => {
    // The most a working copy can hold in that shape.
    expect(keptSize({ width: 2400, height: 2400 / COVER_SHAPE }, COVER_WIDTH)).toEqual({ width: COVER_WIDTH, height: 800 });
  });

  it('is never made bigger', () => {
    expect(keptSize({ width: COVER_WIDTH, height: 800 }, COVER_WIDTH)).toBeNull();
    expect(keptSize({ width: 600, height: 400 }, COVER_WIDTH)).toBeNull();
  });

  it('is taller than the card on Home and the preview in the picker, which show its middle', () => {
    // A card on a phone 390 wide: 358 by 96. The preview: 358 by 132.
    expect(COVER_SHAPE).toBeLessThan(358 / 132);
    expect(COVER_SHAPE).toBeLessThan(358 / 96);
  });
});

describe('nextVersion', () => {
  it('goes up with the clock, a second at a time', () => {
    const at = Date.UTC(2026, 10, 21, 12, 0, 0);
    expect(nextVersion(at + 1000)).toBe(nextVersion(at) + 1);
    expect(nextVersion(at + 60000)).toBeGreaterThan(nextVersion(at));
  });

  it('is a whole number the database accepts: at least 1, and no more than nine digits for decades', () => {
    for (const at of [Date.UTC(2026, 10, 21), Date.UTC(2040, 0, 1), Date.UTC(2055, 0, 1)]) {
      const version = nextVersion(at);
      expect(Number.isInteger(version)).toBe(true);
      expect(String(version)).toMatch(/^[1-9][0-9]{0,8}$/);
    }
    // A clock set far in the past still gives a version that can be saved.
    expect(nextVersion(0)).toBe(1);
  });
});

describe('uploadedPhoto', () => {
  it('is the photo on a cover that has an uploaded one', () => {
    const cover: Cover = { kind: 'photo', background: '#CDEFE0', pattern: true, photo: { source: 'upload', path: coverPath(GROUP), version: 7 } };
    expect(uploadedPhoto(cover)).toEqual({ path: `${GROUP}/cover.jpg`, version: 7 });
  });

  it('is nothing for colours, or for a photo found by search', () => {
    expect(uploadedPhoto({ kind: 'classic', background: '#CDEFE0', pattern: true })).toBeNull();
    expect(uploadedPhoto({ kind: 'look', background: '#CDEFE0', shape1: '#CFE3FF', shape2: '#FFE08A', pattern: true })).toBeNull();
    expect(uploadedPhoto({ kind: 'photo', background: '#CDEFE0', pattern: true, photo: { source: 'search', url: 'https://images.example.org/a', credit: 'Photo by Ann', creditUrl: 'https://example.org/@ann' } })).toBeNull();
  });
});

describe('what a photo is kept under', () => {
  it('changes with the version, and can be read back', () => {
    const photo = { path: `${GROUP}/cover.jpg`, version: 42 };
    expect(photoKey(photo)).toBe(`${GROUP}/cover.jpg#42`);
    expect(photoKey({ ...photo, version: 43 })).not.toBe(photoKey(photo));
    expect(fromPhotoKey(photoKey(photo))).toEqual(photo);
  });

  it('is not read back from anything else', () => {
    for (const bad of ['', 'cover.jpg', `${GROUP}/cover.jpg#`, `${GROUP}/cover.jpg#0`, `${GROUP}/cover.jpg#x`, '#3']) expect(fromPhotoKey(bad)).toBeNull();
  });
});

describe('versioned', () => {
  it('adds the version to an address, whether or not it already has a question mark', () => {
    expect(versioned('https://x.example/storage/v1/object/sign/group-covers/a/cover.jpg?token=abc', 9)).toBe('https://x.example/storage/v1/object/sign/group-covers/a/cover.jpg?token=abc&cacheNonce=9');
    expect(versioned('https://x.example/a.jpg', 9)).toBe('https://x.example/a.jpg?cacheNonce=9');
  });
});
