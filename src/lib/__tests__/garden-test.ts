import type { Idea, List, Member, Reaction } from '../data';
import {
  arrivals,
  BED,
  bedCount,
  bedOf,
  beeChoices,
  beePick,
  gardenIdeas,
  holdBack,
  leafMembers,
  MAX_LEAVES,
  newlyPlanted,
  nudgeNames,
  postcardLine,
  rankWords,
  sheetButtons,
  sheetLine,
  shortName,
  stageCounts,
  stageOf,
  tallyWords,
  timeOfDay,
  toFlower,
  voteOf,
  voteWords,
  waitingOn,
  withVote,
} from '../garden';
import { LIST_COLORS } from '../theme';

// Dates are built from local parts, so these tests give the same result in any time zone.
// "Now" is Sunday 22 November 2026, 3:30 PM.
const now = new Date(2026, 10, 22, 15, 30);
const at = (...parts: [number, number, number, number?, number?]) => new Date(...parts).toISOString();

const member = (id: string, name = id, color = '#CFE3FF'): Member => ({ user_id: id, name, color, photo: null });
const sam = member('sam', 'Sam', '#CFE3FF');
const alex = member('alex', 'Alex', '#FFD9C7');
const jo = member('jo', 'Jo', '#F7C9EA');
const crew = [sam, alex, jo];

const idea = (id: string, more: Partial<Idea> = {}): Idea => ({
  id,
  list_id: 'movies',
  title: `Idea ${id}`,
  link: null,
  note: null,
  added_by: 'sam',
  planned_for: null,
  created_at: at(2026, 10, 22, 9, 0),
  ...more,
});
const up = (ideaId: string, userId: string): Reaction => ({ idea_id: ideaId, user_id: userId, emoji: '👍' });
const down = (ideaId: string, userId: string): Reaction => ({ idea_id: ideaId, user_id: userId, emoji: '👎' });

describe('voteOf', () => {
  it('reads a thumbs up as in, a thumbs down as eh, and anything else as no answer', () => {
    const reactions = [up('a', 'sam'), down('a', 'alex'), { idea_id: 'a', user_id: 'jo', emoji: '🔥' }];
    expect(voteOf('a', 'sam', reactions)).toBe(1);
    expect(voteOf('a', 'alex', reactions)).toBe(2);
    expect(voteOf('a', 'jo', reactions)).toBe(0);
  });

  it('only counts answers on that idea', () => {
    expect(voteOf('b', 'sam', [up('a', 'sam')])).toBe(0);
  });
});

describe('stageOf', () => {
  it('is a bud with no answers', () => {
    expect(stageOf(idea('a'), crew, [])).toBe(1);
  });

  it('is waiting once anyone has answered, whichever way', () => {
    expect(stageOf(idea('a'), crew, [up('a', 'sam')])).toBe(2);
    expect(stageOf(idea('a'), crew, [down('a', 'jo')])).toBe(2);
    expect(stageOf(idea('a'), crew, [up('a', 'sam'), up('a', 'alex'), down('a', 'jo')])).toBe(2);
  });

  it('is in bloom when every member is in', () => {
    expect(stageOf(idea('a'), crew, [up('a', 'sam'), up('a', 'alex'), up('a', 'jo')])).toBe(3);
  });

  it('is planned once it has a date, whatever the answers', () => {
    expect(stageOf(idea('a', { planned_for: at(2026, 10, 28, 19, 0) }), crew, [])).toBe(4);
  });

  it('lets someone alone in a group bring an idea into bloom', () => {
    expect(stageOf(idea('a'), [jo], [up('a', 'jo')])).toBe(3);
    expect(stageOf(idea('a'), [jo], [])).toBe(1);
  });

  it('does not count answers from people who have left', () => {
    expect(stageOf(idea('a'), [sam, alex], [up('a', 'gone')])).toBe(1);
    expect(stageOf(idea('a'), [sam, alex], [up('a', 'sam'), up('a', 'alex'), down('a', 'gone')])).toBe(3);
  });
});

describe('leafMembers', () => {
  const many = Array.from({ length: 9 }, (_, i) => member(`m${i}`));

  it('gives everyone a leaf in a group of up to six', () => {
    expect(leafMembers(crew, 'jo')).toEqual(crew);
    expect(leafMembers(many.slice(0, MAX_LEAVES), 'm0')).toHaveLength(MAX_LEAVES);
  });

  it('gives the six who joined first a leaf in a bigger group', () => {
    expect(leafMembers(many, 'm2').map((m) => m.user_id)).toEqual(['m0', 'm1', 'm2', 'm3', 'm4', 'm5']);
  });

  it('always includes the person looking', () => {
    expect(leafMembers(many, 'm8').map((m) => m.user_id)).toEqual(['m0', 'm1', 'm2', 'm3', 'm4', 'm8']);
  });
});

describe('gardenIdeas', () => {
  const lists: List[] = [
    { id: 'movies', name: 'Movies', position: 0 },
    { id: 'names', name: 'Band names', position: 1, dates: false },
  ];

  it('leaves out ideas that are only kept on a list', () => {
    const ideas = [idea('a'), idea('b', { list_id: 'names' })];
    expect(gardenIdeas({ ideas, lists }).map((i) => i.id)).toEqual(['a']);
  });

  it('keeps one that has a date from before its list stopped giving them', () => {
    const ideas = [idea('b', { list_id: 'names', planned_for: at(2026, 10, 28, 19, 0) })];
    expect(gardenIdeas({ ideas, lists })).toHaveLength(1);
  });

  it('puts the newest first', () => {
    const ideas = [idea('old', { created_at: at(2026, 5, 1) }), idea('new', { created_at: at(2026, 10, 21) }), idea('mid', { created_at: at(2026, 8, 1) })];
    expect(gardenIdeas({ ideas, lists }).map((i) => i.id)).toEqual(['new', 'mid', 'old']);
  });
});

describe('beds', () => {
  const thirty = Array.from({ length: 30 }, (_, i) => i);

  it('holds twelve flowers each', () => {
    expect(BED).toBe(12);
    expect(bedCount(0)).toBe(1);
    expect(bedCount(12)).toBe(1);
    expect(bedCount(13)).toBe(2);
    expect(bedCount(30)).toBe(3);
  });

  it('shows the right twelve', () => {
    expect(bedOf(thirty, 0)).toEqual(thirty.slice(0, 12));
    expect(bedOf(thirty, 2)).toEqual([24, 25, 26, 27, 28, 29]);
  });

  it('falls back to the last bed when the one asked for has gone', () => {
    expect(bedOf(thirty, 7)).toEqual([24, 25, 26, 27, 28, 29]);
    expect(bedOf([], 3)).toEqual([]);
  });
});

describe('shortName', () => {
  it('leaves a short name alone', () => {
    expect(shortName('Mini golf')).toBe('Mini golf');
    expect(shortName('  Hot   springs ')).toBe('Hot springs');
  });

  it('cuts a long one at a space', () => {
    expect(shortName('Botanic gardens at night')).toBe('Botanic gardens at…');
    expect(shortName('Dune: Part Two and the sequel')).toBe('Dune: Part Two and…');
    expect(shortName('That new ramen place downtown')).toBe('That new ramen…');
  });

  it('cuts mid-word when there is no space to cut at', () => {
    expect(shortName('Supercalifragilisticexpialidocious')).toBe('Supercalifragilist…');
  });
});

describe('toFlower', () => {
  const lists: List[] = [
    { id: 'movies', name: 'Movies', position: 0 },
    { id: 'food', name: 'Food', position: 1, color: '#E0489E' },
  ];
  const group = { lists, members: crew, reactions: [up('a', 'sam'), down('a', 'jo')] };

  it('takes its petal colour from its list', () => {
    expect(toFlower(idea('a'), group, crew).color).toBe(LIST_COLORS[0]);
    expect(toFlower(idea('a', { list_id: 'food' }), group, crew).color).toBe('#E0489E');
  });

  it('has one answer for each leaf, in order', () => {
    expect(toFlower(idea('a'), group, crew).votes).toEqual([1, 0, 2]);
    expect(toFlower(idea('a'), group, [jo, sam]).votes).toEqual([2, 1]);
  });

  it('carries the day of the month once it is planned', () => {
    expect(toFlower(idea('a'), group, crew).day).toBeNull();
    const planned = toFlower(idea('a', { planned_for: at(2026, 10, 28, 19, 0) }), group, crew);
    expect(planned.day).toBe('28');
    expect(planned.stage).toBe(4);
  });
});

describe('stageCounts', () => {
  it('counts the flowers at each stage', () => {
    expect(stageCounts([{ stage: 1 }, { stage: 2 }, { stage: 2 }, { stage: 4 }])).toEqual({ 1: 1, 2: 2, 3: 0, 4: 1 });
  });
});

describe('sheetLine', () => {
  it('says who added a new idea, and "today" on its first day', () => {
    expect(sheetLine(idea('a'), crew, [], 'jo', now)).toBe('Added by Sam today');
    expect(sheetLine(idea('a', { added_by: 'jo' }), crew, [], 'jo', now)).toBe('Added by you today');
    expect(sheetLine(idea('a', { created_at: at(2026, 10, 20, 9, 0) }), crew, [], 'jo', now)).toBe('Added by Sam · Someday for 2 days');
  });

  it('says who an idea is waiting on', () => {
    expect(sheetLine(idea('a'), crew, [up('a', 'sam')], 'jo', now)).toBe('Waiting on Alex, you');
    expect(sheetLine(idea('a', { created_at: at(2026, 6, 2, 9, 0) }), crew, [up('a', 'sam'), up('a', 'alex')], 'sam', now)).toBe('Waiting on Jo · Someday for 143 days');
  });

  it('says so when everyone has answered but not all are in', () => {
    expect(sheetLine(idea('a'), crew, [up('a', 'sam'), up('a', 'alex'), down('a', 'jo')], 'jo', now)).toBe('Not everyone is in yet');
  });

  it('names only a few of a long wait', () => {
    const many = Array.from({ length: 7 }, (_, i) => member(`m${i}`, `M${i}`));
    expect(sheetLine(idea('a'), many, [up('a', 'm0')], 'm0', now)).toBe('Waiting on M1, M2, M3 and 3 more');
  });

  it('says everyone is in, in the words for the size of the group', () => {
    const allIn = (members: Member[]) => members.map((m) => up('a', m.user_id));
    expect(sheetLine(idea('a'), crew, allIn(crew), 'jo', now)).toBe("Everyone's in");
    expect(sheetLine(idea('a'), [sam, jo], allIn([sam, jo]), 'jo', now)).toBe('Both in');
    expect(sheetLine(idea('a'), [jo], allIn([jo]), 'jo', now)).toBe("You're in");
  });

  it('gives the date of a plan, and stops the clock', () => {
    const planned = idea('a', { planned_for: at(2026, 10, 28, 19, 0), created_at: at(2026, 6, 2, 9, 0) });
    expect(sheetLine(planned, crew, [], 'jo', now)).toBe('Sat 28 Nov, 7 PM');
  });
});

describe('the sheet', () => {
  it('names each answer', () => {
    expect(voteWords(0)).toBe("hasn't voted");
    expect(voteWords(1)).toBe("I'm in");
    expect(voteWords(2)).toBe('Eh');
  });

  it('counts answers up for a big group', () => {
    expect(tallyWords([1, 1, 1, 1, 2, 0, 0, 0])).toBe('4 in · 1 eh · 3 yet to vote');
    expect(tallyWords([1, 1])).toBe('2 in');
  });

  it('offers a vote until this person is in or everyone is', () => {
    expect(sheetButtons(1, 0)).toEqual({ vote: true, plan: false, done: false });
    expect(sheetButtons(2, 2)).toEqual({ vote: true, plan: false, done: false });
    expect(sheetButtons(2, 1)).toEqual({ vote: false, plan: false, done: false });
  });

  it('offers a date once everyone is in, and "We did it!" once there is one', () => {
    expect(sheetButtons(3, 1)).toEqual({ vote: false, plan: true, done: false });
    expect(sheetButtons(4, 0)).toEqual({ vote: false, plan: false, done: true });
  });
});

describe('withVote', () => {
  it('adds this person\'s answer', () => {
    expect(withVote([], 'a', 'jo', 1)).toEqual([up('a', 'jo')]);
  });

  it('replaces their earlier answer and leaves everything else', () => {
    const fire: Reaction = { idea_id: 'a', user_id: 'jo', emoji: '🔥' };
    const before = [down('a', 'jo'), fire, up('a', 'sam'), down('b', 'jo')];
    expect(withVote(before, 'a', 'jo', 1)).toEqual([fire, up('a', 'sam'), down('b', 'jo'), up('a', 'jo')]);
  });

  it('brings the flower on a stage when it is the last answer needed', () => {
    const before = [up('a', 'sam'), up('a', 'alex')];
    expect(stageOf(idea('a'), crew, before)).toBe(2);
    expect(stageOf(idea('a'), crew, withVote(before, 'a', 'jo', 1))).toBe(3);
  });
});

describe('the bee', () => {
  const f = (id: string, stage: 1 | 2 | 3 | 4, fly = false) => ({ id, stage, fly });

  it('picks among the flowers everyone is in on', () => {
    expect(beeChoices([f('a', 1), f('b', 3), f('c', 4), f('d', 3)])).toEqual(['b', 'd']);
  });

  it('falls back to the ones still gathering answers, then to anything growing', () => {
    expect(beeChoices([f('a', 1), f('b', 2), f('c', 4)])).toEqual(['a', 'b']);
    expect(beeChoices([f('c', 4)])).toEqual(['c']);
  });

  it('never picks a flower that is flying into the house', () => {
    expect(beeChoices([f('a', 3, true), f('b', 2)])).toEqual(['b']);
    expect(beeChoices([f('a', 3, true)])).toEqual([]);
  });

  it('does not go to the same flower twice running while there is another', () => {
    const flowers = [f('a', 3), f('b', 3)];
    expect(beePick(flowers, 'a', () => 0)).toBe('b');
    expect(beePick(flowers, 'b', () => 0.99)).toBe('a');
    expect(beePick([f('a', 3)], 'a', () => 0)).toBe('a');
  });

  it('has nothing to pick in an empty garden', () => {
    expect(beePick([], null)).toBeNull();
  });
});

describe('timeOfDay', () => {
  const hour = (h: number) => new Date(2026, 10, 22, h, 0);

  it('is night in dark mode, whatever the clock says', () => {
    expect(timeOfDay(true, hour(12))).toBe('night');
  });

  it('is day in light mode, with dusk from five until nine in the evening', () => {
    expect(timeOfDay(false, hour(9))).toBe('day');
    expect(timeOfDay(false, hour(16))).toBe('day');
    expect(timeOfDay(false, hour(17))).toBe('dusk');
    expect(timeOfDay(false, hour(20))).toBe('dusk');
    expect(timeOfDay(false, hour(21))).toBe('day');
  });
});

describe('rankWords', () => {
  it('names the rank and how far the next one is', () => {
    expect(rankWords(290)).toBe('Thrill Seekers · 30 to go');
    expect(rankWords(0)).toBe('Homebodies · 30 to go');
  });

  it('says so at the top', () => {
    expect(rankWords(700)).toBe('Legends · Top rank');
  });

  it('says nothing for a group with no points to go by', () => {
    expect(rankWords(null)).toBeNull();
  });
});

describe('newlyPlanted', () => {
  it('finds nothing new on the first look', () => {
    expect(newlyPlanted(null, [{ id: 'a' }])).toEqual([]);
  });

  it('finds the ideas that were not there before', () => {
    expect(newlyPlanted(new Set(['a']), [{ id: 'b' }, { id: 'a' }])).toEqual([{ id: 'b' }]);
    expect(newlyPlanted(new Set(['a', 'b']), [{ id: 'a' }])).toEqual([]);
  });
});

describe('water to nudge', () => {
  const up = (ideaId: string, who: string): Reaction => ({ idea_id: ideaId, user_id: who, emoji: '👍' });
  const down = (ideaId: string, who: string): Reaction => ({ idea_id: ideaId, user_id: who, emoji: '👎' });

  it('is waiting on the members who have said neither "I\'m in" nor "Eh", and never on the person looking', () => {
    const golf = idea('golf');
    expect(waitingOn(golf, crew, [], 'jo').map((m) => m.name)).toEqual(['Sam', 'Alex']);
    expect(waitingOn(golf, crew, [up('golf', 'sam')], 'jo').map((m) => m.name)).toEqual(['Alex']);
    // An "Eh" is an answer.
    expect(waitingOn(golf, crew, [up('golf', 'sam'), down('golf', 'alex')], 'jo')).toEqual([]);
    // A heart is not.
    expect(waitingOn(golf, crew, [{ idea_id: 'golf', user_id: 'sam', emoji: '❤️' }], 'jo').map((m) => m.name)).toEqual(['Sam', 'Alex']);
  });

  it('is waiting on nobody once everyone is in, or the idea is planned', () => {
    const golf = idea('golf');
    expect(waitingOn(golf, crew, crew.map((m) => up('golf', m.user_id)), 'jo')).toEqual([]);
    expect(waitingOn(idea('golf', { planned_for: at(2026, 10, 28, 19) }), crew, [], 'jo')).toEqual([]);
  });

  it('says a few names, and counts a crowd', () => {
    expect(nudgeNames(['Sam'])).toBe('Sam');
    expect(nudgeNames(['Sam', 'Alex'])).toBe('Sam and Alex');
    expect(nudgeNames(['Sam', 'Alex', 'Jo'])).toBe('Sam, Alex and Jo');
    expect(nudgeNames(['Sam', 'Alex', 'Jo', 'Di'])).toBe('4 people');
  });
});

describe('friends dropping by', () => {
  const up = (ideaId: string, who: string): Reaction => ({ idea_id: ideaId, user_id: who, emoji: '👍' });
  const down = (ideaId: string, who: string): Reaction => ({ idea_id: ideaId, user_id: who, emoji: '👎' });

  it('sees nothing new on the first look', () => {
    expect(arrivals(null, [up('golf', 'sam')], ['golf'], crew, 'jo')).toEqual([]);
  });

  it('notices another member saying "I\'m in" since the last look', () => {
    expect(arrivals([], [up('golf', 'sam')], ['golf'], crew, 'jo')).toEqual([{ ideaId: 'golf', userId: 'sam', was: 0 }]);
    expect(arrivals([down('golf', 'alex')], [up('golf', 'alex')], ['golf'], crew, 'jo')).toEqual([{ ideaId: 'golf', userId: 'alex', was: 2 }]);
  });

  it('does not count an "Eh", a vote that was already there, the person looking, or an idea that is not growing', () => {
    expect(arrivals([], [down('golf', 'sam')], ['golf'], crew, 'jo')).toEqual([]);
    expect(arrivals([up('golf', 'sam')], [up('golf', 'sam')], ['golf'], crew, 'jo')).toEqual([]);
    expect(arrivals([], [up('golf', 'jo')], ['golf'], crew, 'jo')).toEqual([]);
    expect(arrivals([], [up('ramen', 'sam')], ['golf'], crew, 'jo')).toEqual([]);
  });

  it('holds a friend\'s vote back until their butterfly has landed', () => {
    const after = [up('golf', 'sam'), up('golf', 'alex'), up('ramen', 'sam')];
    const held = holdBack(after, [{ ideaId: 'golf', userId: 'sam', was: 0 }]);
    expect(voteOf('golf', 'sam', held)).toBe(0);
    expect(voteOf('golf', 'alex', held)).toBe(1);
    expect(voteOf('ramen', 'sam', held)).toBe(1);
    // Someone who had said "Eh" goes on showing that until they land.
    expect(voteOf('golf', 'alex', holdBack(after, [{ ideaId: 'golf', userId: 'alex', was: 2 }]))).toBe(2);
    expect(holdBack(after, [])).toBe(after);
  });
});

describe('a postcard', () => {
  it('says the day and how many ideas are growing', () => {
    expect(postcardLine(new Date(2026, 10, 23, 9), 9)).toBe('Mon, Nov 23 · 9 ideas growing');
    expect(postcardLine(new Date(2026, 0, 1, 9), 1)).toBe('Thu, Jan 1 · 1 idea growing');
    expect(postcardLine(new Date(2026, 0, 1, 9), 0)).toBe('Thu, Jan 1 · 0 ideas growing');
  });
});
