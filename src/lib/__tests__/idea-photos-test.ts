import { ideaPhoto, NO_IDEA_PHOTOS, photoForIdea, samePhoto, type IdeaPhoto } from '../idea-photos';
import type { FoundPhoto } from '../photo-search';

const photo: IdeaPhoto = {
  url: 'https://images.unsplash.com/photo-1?ixid=abc123&w=1080&q=80&fit=max',
  credit: 'Photo by Ann Example on Unsplash',
  creditUrl: 'https://unsplash.com/@ann?utm_source=somedaisy&utm_medium=referral',
};

describe('ideaPhoto', () => {
  it('reads a found photo as the database holds it', () => {
    expect(ideaPhoto(photo)).toEqual(photo);
  });

  it('passes on nothing but the address, the credit and where the credit leads', () => {
    expect(ideaPhoto({ ...photo, report: 'https://api.unsplash.com/photos/x/download', other: 1 })).toEqual(photo);
  });

  it('is nothing for an idea with no found photo', () => {
    for (const none of [null, undefined, '', 'words', 5, [], {}]) expect(ideaPhoto(none)).toBeNull();
  });

  it('never shows a photo from anywhere but Unsplash, whatever the database holds', () => {
    for (const url of ['https://example.com/a.jpg', 'https://unsplash.com.example.com/a.jpg', 'http://images.unsplash.com/photo-1', 'https://images.unsplash.com@example.com/a.jpg', 'javascript:alert(1)', 12]) {
      expect(ideaPhoto({ ...photo, url })).toBeNull();
    }
  });

  it('wants a credit that leads back to Unsplash', () => {
    for (const creditUrl of ['https://example.com/@ann', 'https://images.unsplash.com/@ann', 'http://unsplash.com/@ann', null]) {
      expect(ideaPhoto({ ...photo, creditUrl })).toBeNull();
    }
    for (const credit of ['', '   ', 'a'.repeat(121), null, 7]) {
      expect(ideaPhoto({ ...photo, credit })).toBeNull();
    }
  });
});

describe('photoForIdea', () => {
  it('keeps the address and the credit of a photo found by a search, and nothing else', () => {
    const found: FoundPhoto = {
      id: 'LBI7cgq3pbM',
      thumb: 'https://images.unsplash.com/photo-1?w=400',
      url: photo.url,
      alt: 'a beach at sunset',
      name: 'Ann Example',
      credit: photo.credit,
      creditUrl: photo.creditUrl,
      report: 'https://api.unsplash.com/photos/LBI7cgq3pbM/download?ixid=abc123',
    };
    expect(photoForIdea(found)).toEqual(photo);
    // What is kept can be read back.
    expect(ideaPhoto(photoForIdea(found))).toEqual(photo);
  });
});

describe('samePhoto', () => {
  it('goes by the address', () => {
    expect(samePhoto(photo, { ...photo, credit: 'Photo by Someone Else on Unsplash' })).toBe(true);
    expect(samePhoto(photo, { ...photo, url: 'https://images.unsplash.com/photo-2' })).toBe(false);
    expect(samePhoto(photo, null)).toBe(false);
    expect(samePhoto(null, null)).toBe(true);
  });
});

describe('NO_IDEA_PHOTOS', () => {
  it('names the update that is missing, with no dash in it', () => {
    expect(NO_IDEA_PHOTOS).toContain('update 022');
    expect(NO_IDEA_PHOTOS).not.toMatch(/[–—]/);
  });
});
