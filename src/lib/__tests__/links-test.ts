import { Linking, Platform } from 'react-native';

import { inviteLink, LINK_MAX, openLink, tidyLink } from '../links';

jest.mock('react-native', () => ({ Platform: { OS: 'android' }, Linking: { openURL: jest.fn(() => Promise.resolve()) } }));
jest.mock('expo-linking', () => ({ createURL: (path: string) => `http://localhost:8081${path}` }));

const on = (os: string) => {
  (Platform as { OS: string }).OS = os;
};

describe('inviteLink', () => {
  it('is a web address on a phone, so it works for people without the app', () => {
    on('android');
    expect(inviteLink('abc123')).toBe('https://somedaisy.com/join/abc123');
    on('ios');
    expect(inviteLink('abc123')).toBe('https://somedaisy.com/join/abc123');
  });

  it('uses the address the website is being served from', () => {
    on('web');
    expect(inviteLink('abc123')).toBe('http://localhost:8081/join/abc123');
  });

  it('matches the path the Android app is registered to open', () => {
    const { expo } = jest.requireActual<{ expo: { android: { package: string; intentFilters: { autoVerify: boolean; data: { scheme: string; host: string; pathPrefix: string }[] }[] } } }>('../../../app.json');
    const [filter] = expo.android.intentFilters;
    const [data] = filter.data;
    on('android');
    const link = inviteLink('abc123');
    expect(filter.autoVerify).toBe(true);
    expect(link.startsWith(`${data.scheme}://${data.host}${data.pathPrefix}`)).toBe(true);

    // The website vouches for the same app the link opens.
    const [statement] = jest.requireActual<{ target: { package_name: string; sha256_cert_fingerprints: string[] } }[]>('../../../public/.well-known/assetlinks.json');
    expect(statement.target.package_name).toBe(expo.android.package);
    expect(statement.target.sha256_cert_fingerprints[0]).toMatch(/^([0-9A-F]{2}:){31}[0-9A-F]{2}$/);
  });
});

describe('tidyLink', () => {
  it('treats an empty box as no link', () => {
    expect(tidyLink('')).toEqual({ ok: true, link: null });
    expect(tidyLink('   ')).toEqual({ ok: true, link: null });
  });

  it('keeps a full web address as it is, trimmed', () => {
    expect(tidyLink('  https://example.com/menu?x=1#top ')).toEqual({ ok: true, link: 'https://example.com/menu?x=1#top' });
    expect(tidyLink('http://example.com')).toEqual({ ok: true, link: 'http://example.com' });
    expect(tidyLink('HTTPS://Example.com/A')).toEqual({ ok: true, link: 'https://Example.com/A' });
  });

  it('adds https:// when it was left off', () => {
    expect(tidyLink('youtube.com/watch?v=abc')).toEqual({ ok: true, link: 'https://youtube.com/watch?v=abc' });
    expect(tidyLink('www.example.co.uk')).toEqual({ ok: true, link: 'https://www.example.co.uk' });
    expect(tidyLink('maps.example.com:8080/pin')).toEqual({ ok: true, link: 'https://maps.example.com:8080/pin' });
  });

  it('refuses anything that is not a web address', () => {
    for (const bad of ['tel:5551234', 'mailto:a@b.com', 'javascript:alert(1)', 'intent://scan/#Intent;end', 'somedaisy://join/abc', 'file:///etc/passwd', 'data:text/html,hi']) {
      expect(tidyLink(bad)).toEqual({ ok: false, link: null });
    }
  });

  it('refuses words that are not an address at all', () => {
    expect(tidyLink('the taco place')).toEqual({ ok: false, link: null });
    expect(tidyLink('tacos')).toEqual({ ok: false, link: null });
    expect(tidyLink('https://')).toEqual({ ok: false, link: null });
    expect(tidyLink('https://user@example.com')).toEqual({ ok: false, link: null });
  });

  it('refuses a link that is too long to save', () => {
    expect(tidyLink(`https://example.com/${'a'.repeat(LINK_MAX)}`).ok).toBe(false);
  });
});

describe('openLink', () => {
  const opened = jest.mocked(Linking.openURL);
  beforeEach(() => opened.mockClear());

  it('opens a web address', () => {
    openLink('https://example.com/a');
    expect(opened).toHaveBeenCalledWith('https://example.com/a');
  });

  it('repairs a link saved without https://', () => {
    openLink('example.com/a');
    expect(opened).toHaveBeenCalledWith('https://example.com/a');
  });

  it('does nothing with a link that is not a web address', () => {
    openLink('tel:5551234');
    openLink('javascript:alert(1)');
    expect(opened).not.toHaveBeenCalled();
  });

  it('stays quiet when the phone cannot open it', async () => {
    opened.mockRejectedValueOnce(new Error('no browser'));
    expect(() => openLink('https://example.com')).not.toThrow();
    await Promise.resolve();
  });
});
