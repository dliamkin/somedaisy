import { Platform } from 'react-native';

import { inviteLink } from '../links';

jest.mock('react-native', () => ({ Platform: { OS: 'android' } }));
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
