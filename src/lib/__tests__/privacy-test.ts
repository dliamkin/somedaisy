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
    expect(words).toContain('The only photos we keep are the ones you add to an idea');
    expect(words).toContain('anyone who is given that address can open the picture');
    expect(words).toContain('the pictures added to ideas included');
    expect(words).not.toContain('We do not collect your contacts or your photos');
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
