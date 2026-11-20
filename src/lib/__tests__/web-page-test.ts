import { outOfSight, withKeyboardRoom } from '../web-page';

describe('outOfSight', () => {
  // What can be seen runs from 100 down to 500: the page's own part of the screen, above the keyboard.
  const area = { top: 100, bottom: 500 };

  it('leaves alone a box that can be seen, with room for its label', () => {
    expect(outOfSight({ top: 200, bottom: 252 }, area)).toBe(false);
    expect(outOfSight({ top: 140, bottom: 192 }, area)).toBe(false);
    expect(outOfSight({ top: 432, bottom: 484 }, area)).toBe(false);
  });

  it('catches a box under the keyboard, or partly under it', () => {
    expect(outOfSight({ top: 600, bottom: 652 }, area)).toBe(true);
    expect(outOfSight({ top: 470, bottom: 522 }, area)).toBe(true);
  });

  it('catches a box hard against the bottom edge, where the line being typed is cut off', () => {
    expect(outOfSight({ top: 440, bottom: 492 }, area)).toBe(true);
  });

  it('catches a box above what can be seen, or with its label cut off', () => {
    expect(outOfSight({ top: 20, bottom: 72 }, area)).toBe(true);
    expect(outOfSight({ top: 120, bottom: 172 }, area)).toBe(true);
  });
});

describe('withKeyboardRoom', () => {
  it('asks the browser to make the page shorter for the keyboard', () => {
    expect(withKeyboardRoom('width=device-width, initial-scale=1, shrink-to-fit=no')).toBe('width=device-width, initial-scale=1, shrink-to-fit=no, interactive-widget=resizes-content');
  });

  it('does not ask twice, or change what the page already says', () => {
    const asked = 'width=device-width, interactive-widget=resizes-visual';
    expect(withKeyboardRoom(asked)).toBe(asked);
    expect(withKeyboardRoom(withKeyboardRoom('width=device-width'))).toBe('width=device-width, interactive-widget=resizes-content');
  });
});
