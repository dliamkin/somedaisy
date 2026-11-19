import { EMOJI_PICTURES } from '../emoji-pictures';
import { MORE_REACTIONS } from '../theme';

// Loading the pictures above already fails if one of the files in assets/emoji is missing.
describe('EMOJI_PICTURES', () => {
  it('has a picture for every emoji that can be picked, so none is left to the device to draw', () => {
    expect(MORE_REACTIONS.filter((e) => EMOJI_PICTURES[e] === undefined)).toEqual([]);
  });

  it('has no picture for an emoji that cannot be picked', () => {
    expect(Object.keys(EMOJI_PICTURES).filter((e) => !MORE_REACTIONS.includes(e))).toEqual([]);
  });
});
