import { CONTACT, INTRO, SECTIONS, UPDATED } from '../privacy';

const words = [...INTRO, ...SECTIONS.flatMap((s) => [s.title, ...s.blocks.flat()])].join('\n');

describe('the privacy policy', () => {
  it('names every company the app sends information to', () => {
    for (const company of ['Supabase', 'Cloudflare', 'Resend', 'Google', 'Expo']) {
      expect(words).toContain(company);
    }
  });

  it('covers what the app keeps', () => {
    for (const thing of ['name', 'email address', 'picture', 'reactions', 'comments', 'notifications', 'time zone']) {
      expect(words).toContain(thing);
    }
  });

  it('says that the website counts its visits, who does the counting, and that the apps do not', () => {
    expect(words).toContain('The website counts its visits');
    expect(words).toContain('Cloudflare delivers the website and counts its visits');
    expect(words).toContain('uses no cookies');
    expect(words).toContain('The phone apps do no counting of this kind');
    expect(words).not.toContain('no advertising or analytics tools');
  });

  it('says that pictures added to ideas are kept, who keeps them and who can open them', () => {
    expect(words).toContain('A picture you add to an idea yourself');
    expect(words).toContain('The only photos we keep are the ones you add to an idea or as a group');
    expect(words).toContain('anyone who is given that address can open the picture');
    expect(words).toContain('the pictures added to ideas and the photos used as covers included');
    expect(words).not.toContain('We do not collect your contacts or your photos');
  });

  it('says that a cover photo is kept, that only the group sees it, and what becomes of it', () => {
    expect(words).toContain('A photo you add as a group');
    expect(words).toContain('A group keeps one cover photo');
    expect(words).toContain('shown only to the people in that group');
    expect(words).toContain('its cover photo included');
  });

  it('says what a cover photo found by search means: what is kept, and what Unsplash learns', () => {
    expect(words).toContain('the web address of that photo and the name of the person who took it');
    expect(words).toContain('Unsplash provides the photos that can be searched for');
    expect(words).toContain('without your name or anything else about you');
    expect(words).toContain('Unsplash sees the internet address of whoever is looking');
  });

  it('says that photo searches are counted for each person, and what is kept of them', () => {
    expect(words).toContain('we count how many photo searches each person makes in an hour');
    expect(words).toContain('We keep when each one was made, not the words, and remove it within a day');
  });

  it('says what the people who run the app can see, and what their page leaves out', () => {
    expect(words).toContain('The people who run SomeDaisy can open a page that lists the people and groups using it');
    expect(words).toContain('names, email addresses, when each person joined');
    expect(words).toContain('It does not show ideas, notes, comments or pictures');
    expect(words).toContain('they can also reach the database itself');
    // Neither of these is true of the people who run it, so both say who they are about.
    expect(words).toContain('Other people using SomeDaisy never see it');
    expect(words).toContain('Nobody else using SomeDaisy can see your groups');
  });

  it('says how to have an account deleted, and gives a way to write in', () => {
    expect(words).toContain('delete your account');
    expect(words).toContain(CONTACT);
    expect(CONTACT).toMatch(/^[^@\s]+@somedaisy\.com$/);
  });

  it('has a date, and no empty sections', () => {
    expect(UPDATED).toMatch(/^\d{1,2} [A-Z][a-z]+ \d{4}$/);
    for (const section of SECTIONS) {
      expect(section.blocks.length).toBeGreaterThan(0);
      for (const text of section.blocks.flat()) expect(text.trim().length).toBeGreaterThan(20);
    }
  });
});
