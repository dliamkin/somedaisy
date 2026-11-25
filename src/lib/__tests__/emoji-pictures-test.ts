import { EMOJI_PICTURES } from '../emoji-pictures';
import { COMMENT_REACTIONS, MORE_REACTIONS } from '../theme';

// Loading the pictures above already fails if one of the files in assets/emoji is missing.
describe('EMOJI_PICTURES', () => {
  it('has a picture for every emoji that can be picked, so none is left to the device to draw', () => {
    expect(MORE_REACTIONS.filter((e) => EMOJI_PICTURES[e] === undefined)).toEqual([]);
    expect(COMMENT_REACTIONS.filter((e) => EMOJI_PICTURES[e] === undefined)).toEqual([]);
  });

  it('has no picture for an emoji that cannot be picked', () => {
    expect(Object.keys(EMOJI_PICTURES).filter((e) => !MORE_REACTIONS.includes(e) && !COMMENT_REACTIONS.includes(e))).toEqual([]);
  });

  it('offers on a comment everything offered on an idea, with the everyday ones first and none twice', () => {
    expect(COMMENT_REACTIONS.slice(0, 5)).toEqual(['👍', '❤️', '😂', '😮', '😢']);
    expect(MORE_REACTIONS.filter((e) => !COMMENT_REACTIONS.includes(e))).toEqual([]);
    expect(new Set(COMMENT_REACTIONS).size).toBe(COMMENT_REACTIONS.length);
    expect(COMMENT_REACTIONS).toHaveLength(MORE_REACTIONS.length + 2);
    // A thumbs down is not offered on something a friend said.
    expect(COMMENT_REACTIONS).not.toContain('👎');
  });
});
