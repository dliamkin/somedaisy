import { deviceTimeZone, routeFromPush, stateFromPermissions } from '../push';

jest.mock('../supabase', () => ({ supabase: null }));

describe('stateFromPermissions', () => {
  it('is on when the phone allows notifications', () => {
    expect(stateFromPermissions({ granted: true, canAskAgain: true })).toBe('on');
  });

  it('counts quiet (provisional) delivery on iPhone as on', () => {
    expect(stateFromPermissions({ granted: false, canAskAgain: true, ios: { status: 3 } })).toBe('on');
  });

  it('is ask while the person has not decided', () => {
    expect(stateFromPermissions({ granted: false, canAskAgain: true })).toBe('ask');
    expect(stateFromPermissions({ granted: false, canAskAgain: true, ios: { status: 0 } })).toBe('ask');
  });

  it('is blocked once the phone will not ask again', () => {
    expect(stateFromPermissions({ granted: false, canAskAgain: false })).toBe('blocked');
    expect(stateFromPermissions({ granted: false, canAskAgain: false, ios: { status: 1 } })).toBe('blocked');
  });
});

describe('routeFromPush', () => {
  const group = '/group/9d455cbc-1f6f-4f35-9436-8f2488aff2dd';

  it('opens the group a push points at', () => {
    expect(routeFromPush({ url: group })).toBe(group);
  });

  it('opens the comments of the idea a comment push is about', () => {
    const idea = '0b9f6a1e-52a4-4f0e-9c0b-6c7f0f1f2a33';
    expect(routeFromPush({ url: group, idea })).toBe(`${group}/comments?idea=${idea}`);
  });

  it('falls back to the group when the idea is missing or not an id', () => {
    expect(routeFromPush({ url: group, idea: null })).toBe(group);
    expect(routeFromPush({ url: group, idea: 42 })).toBe(group);
    expect(routeFromPush({ url: group, idea: 'x&next=https://example.com' })).toBe(group);
    expect(routeFromPush({ url: group, idea: '../../account' })).toBe(group);
  });

  it('opens nothing for an idea without a group', () => {
    expect(routeFromPush({ idea: '0b9f6a1e-52a4-4f0e-9c0b-6c7f0f1f2a33' })).toBeNull();
  });

  it('ignores a push with no link or a malformed one', () => {
    expect(routeFromPush(undefined)).toBeNull();
    expect(routeFromPush(null)).toBeNull();
    expect(routeFromPush({})).toBeNull();
    expect(routeFromPush({ url: 42 })).toBeNull();
    expect(routeFromPush({ url: '/group/not-an-id' })).toBeNull();
  });

  it('refuses to open anything other than a group, such as an outside website', () => {
    expect(routeFromPush({ url: 'https://example.com/phish' })).toBeNull();
    expect(routeFromPush({ url: '/account' })).toBeNull();
    expect(routeFromPush({ url: `${group}/../../account` })).toBeNull();
    expect(routeFromPush({ url: `https://evil.example${group}` })).toBeNull();
  });
});

describe('deviceTimeZone', () => {
  it('gives a time zone name the database can use', () => {
    expect(deviceTimeZone()).toMatch(/^[A-Za-z_]+(\/[A-Za-z0-9_+-]+)*$/);
  });
});
