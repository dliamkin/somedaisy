import { base64Size, bytesFromBase64, cardPicture, fitWithin, ownPicture, pictureAddress, picturePath, pictureSearch, PICTURE_SIDE } from '../pictures';

const GROUP = '0f0e0d0c-0b0a-4908-8706-050403020100';
const FILE = '11111111-2222-4333-8444-555555555555';
const PATH = `${GROUP}/${FILE}.jpg`;
const BASE = 'https://abc.supabase.co';
const ADDRESS = `${BASE}/storage/v1/object/public/idea-pictures/${PATH}`;

describe('fitWithin', () => {
  it('brings the longer side down to the limit and keeps the shape', () => {
    expect(fitWithin(4000, 3000)).toEqual({ width: PICTURE_SIDE, height: 960 });
    expect(fitWithin(3000, 4000)).toEqual({ width: 960, height: PICTURE_SIDE });
    expect(fitWithin(2000, 2000)).toEqual({ width: PICTURE_SIDE, height: PICTURE_SIDE });
  });

  it('never makes a small picture bigger', () => {
    expect(fitWithin(800, 600)).toBeNull();
    expect(fitWithin(PICTURE_SIDE, 10)).toBeNull();
  });

  it('keeps at least one dot on the short side of a very long picture', () => {
    expect(fitWithin(20000, 5)).toEqual({ width: PICTURE_SIDE, height: 1 });
  });

  it('leaves a picture of unknown size alone', () => {
    expect(fitWithin(0, 0)).toBeNull();
    expect(fitWithin(Number.NaN, 100)).toBeNull();
  });
});

describe('where a picture is kept', () => {
  it('is the group\'s folder and a file id, as a JPEG', () => {
    expect(picturePath(GROUP, FILE)).toBe(PATH);
    expect(picturePath(GROUP.toUpperCase(), FILE.toUpperCase())).toBe(PATH);
  });

  it('is only accepted when shaped that way', () => {
    expect(ownPicture(PATH)).toBe(PATH);
    for (const bad of [null, undefined, 42, '', `${GROUP}/photo.jpg`, `${GROUP}/${FILE}.png`, `${FILE}.jpg`, `${GROUP}/../${GROUP}/${FILE}.jpg`, `https://example.org/${PATH}`, `${PATH}?x=1`]) {
      expect(ownPicture(bad)).toBeNull();
    }
  });
});

describe('pictureAddress', () => {
  it('is the public web address of the kept file', () => {
    expect(pictureAddress(PATH, BASE)).toBe(ADDRESS);
    expect(pictureAddress(PATH, `${BASE}/`)).toBe(ADDRESS);
  });

  it('is nothing for a place that is not one of ours, or with nowhere to serve it from', () => {
    expect(pictureAddress(`${GROUP}/photo.jpg`, BASE)).toBeNull();
    expect(pictureAddress(null, BASE)).toBeNull();
    expect(pictureAddress(PATH, '')).toBeNull();
    // Only a secure address is ever shown as a picture.
    expect(pictureAddress(PATH, 'http://abc.supabase.co')).toBeNull();
  });
});

describe('cardPicture', () => {
  const linked = 'https://cdn.example.org/a.jpg';

  it('shows the idea\'s own picture before the one from its link', () => {
    expect(cardPicture({ picture: PATH, image_url: linked, link: 'https://example.org' }, BASE)).toBe(ADDRESS);
  });

  it('shows its own picture on an idea with no link', () => {
    expect(cardPicture({ picture: PATH, link: null }, BASE)).toBe(ADDRESS);
  });

  it('falls back to the link\'s picture, and only while there is a link', () => {
    expect(cardPicture({ picture: null, image_url: linked, link: 'https://example.org' }, BASE)).toBe(linked);
    expect(cardPicture({ image_url: linked, link: null }, BASE)).toBeNull();
    expect(cardPicture({ picture: 'nonsense', image_url: linked, link: 'https://example.org' }, BASE)).toBe(linked);
  });

  it('is nothing for an idea with no picture at all', () => {
    expect(cardPicture({ link: 'https://example.org' }, BASE)).toBeNull();
    expect(cardPicture({}, BASE)).toBeNull();
  });
});

describe('bytesFromBase64', () => {
  const text = (bytes: Uint8Array) => String.fromCharCode(...bytes);

  it('unpacks text of every length, with or without its padding', () => {
    expect(text(bytesFromBase64('TWFu'))).toBe('Man');
    expect(text(bytesFromBase64('TWE='))).toBe('Ma');
    expect(text(bytesFromBase64('TQ=='))).toBe('M');
    expect(text(bytesFromBase64('TWE'))).toBe('Ma');
    expect(text(bytesFromBase64('SGVsbG8sIHdvcmxkIQ=='))).toBe('Hello, world!');
  });

  it('keeps every byte value, not only letters', () => {
    expect([...bytesFromBase64('/9j/4AAQ')]).toEqual([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
    expect([...bytesFromBase64('AAECAwT+/w==')]).toEqual([0, 1, 2, 3, 4, 254, 255]);
  });

  it('takes a "data:" address apart, and skips line breaks', () => {
    expect(text(bytesFromBase64('data:image/jpeg;base64,TWFu'))).toBe('Man');
    expect(text(bytesFromBase64('SGVs\nbG8s\r\nIHdvcmxkIQ=='))).toBe('Hello, world!');
  });

  it('is empty for nothing', () => {
    expect(bytesFromBase64('').length).toBe(0);
  });

  it('agrees with base64Size about how big the file is', () => {
    for (const sample of ['', 'TQ==', 'TWE=', 'TWFu', 'SGVsbG8sIHdvcmxkIQ==', 'data:image/jpeg;base64,/9j/4AAQ']) {
      expect(base64Size(sample)).toBe(bytesFromBase64(sample).length);
    }
  });
});

describe('pictureSearch', () => {
  it('is a picture search for the idea\'s name', () => {
    expect(pictureSearch('Dune: Part Two')).toBe('https://www.google.com/search?q=Dune%3A%20Part%20Two&udm=2');
    expect(pictureSearch('  Taco   Spot & Bar ')).toBe('https://www.google.com/search?q=Taco%20Spot%20%26%20Bar&udm=2');
  });

  it('is nothing until the idea has a name', () => {
    expect(pictureSearch('')).toBeNull();
    expect(pictureSearch('   ')).toBeNull();
  });
});
