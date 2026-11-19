import { useState, type ReactNode } from 'react';
import { Pressable, View } from 'react-native';

import { listsByName, type List } from '@/lib/data';
import { kindOf, optionsOf } from '@/lib/list-options';
import { lookFor } from '@/lib/looks';
import { useTheme } from '@/lib/theme';

import { CheckIcon } from './daisy';
import { ListTile } from './list-tile';
import { Card, Chip, Field, T } from './ui';

/** Up to this many lists are offered as chips, all on show. More than that would fill the page. */
const CHIPS_UP_TO = 6;
/** From this many lists up, there is a box to type part of a name in. */
export const FIND_FROM = 8;

/** A list's own tile, small, for a row. `all` is every list of the group in its usual order, which decides a list's colour. */
export function RowTile({ list, all }: { list: List; all: List[] }) {
  const look = lookFor(
    list,
    Math.max(
      0,
      all.findIndex((l) => l.id === list.id),
    ),
  );
  return <ListTile flat icon={look.icon} color={look.color} size={44} />;
}

/** One list as a row that can be tapped: its picture, its name, a few words under it. */
export function ListRow({
  picture,
  name,
  about,
  on,
  onPress,
  right,
}: {
  picture: ReactNode;
  name: string;
  about: string;
  /** The one that is chosen now. */
  on?: boolean;
  onPress: () => void;
  /** Something for the end of the row, in place of the tick a chosen row gets. */
  right?: ReactNode;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${name}. ${about}`}
      accessibilityState={{ selected: Boolean(on) }}
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        minHeight: 60,
        padding: 8,
        borderRadius: 18,
        borderWidth: 2,
        borderColor: on ? colors.button : 'transparent',
        backgroundColor: on ? colors.voteOn : 'transparent',
        opacity: pressed ? 0.6 : 1,
      })}>
      {picture}
      <View style={{ flex: 1 }}>
        <T size={16} weight="extra" lines={1}>
          {name}
        </T>
        <T size={13} color={colors.textMuted} lines={1}>
          {about}
        </T>
      </View>
      {right ?? (on ? <CheckIcon color={colors.link} size={18} /> : null)}
    </Pressable>
  );
}

/**
 * "Which list?" on the form for an idea. A few lists are chips, all on show, and one tap picks.
 * With many lists that would push the rest of the form off the page, so then the form shows only
 * the list that is chosen. Tapping it opens every list, in order of name, with a box to find one
 * by name once there are a lot.
 *
 * `lists` are the ones on offer. `all` is every list of the group, which decides each one's colour.
 */
export function ListChooser({ all, lists, chosenId, onChoose }: { all: List[]; lists: List[]; chosenId: string | null; onChoose: (listId: string) => void }) {
  const { colors } = useTheme();
  const [open, setOpen] = useState(false);
  const [find, setFind] = useState('');

  const heading = (
    <T size={16} weight="extra">
      Which list?
    </T>
  );

  if (lists.length <= CHIPS_UP_TO) {
    return (
      <View style={{ gap: 8 }}>
        {heading}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {lists.map((l) => (
            <Chip key={l.id} label={l.name} selected={l.id === chosenId} onPress={() => onChoose(l.id)} />
          ))}
        </View>
      </View>
    );
  }

  const chosen = lists.find((l) => l.id === chosenId) ?? null;
  const kind = (l: List) => (kindOf(optionsOf(l)) === 'keep' ? 'Just a list' : 'Things to do');

  if (!open) {
    return (
      <View style={{ gap: 8 }}>
        {heading}
        <Card style={{ padding: 8 }}>
          <ListRow
            picture={chosen ? <RowTile list={chosen} all={all} /> : null}
            name={chosen?.name ?? 'Choose a list'}
            about={chosen ? kind(chosen) : `${lists.length} lists`}
            onPress={() => setOpen(true)}
            right={
              <T size={14} weight="extra" color={colors.link} style={{ paddingRight: 6 }}>
                Change
              </T>
            }
          />
        </Card>
      </View>
    );
  }

  const wanted = find.trim().toLowerCase();
  const sorted = listsByName(lists);
  const shown = wanted ? sorted.filter((l) => l.name.toLowerCase().includes(wanted)) : sorted;
  return (
    <View style={{ gap: 8 }}>
      {heading}
      <Card style={{ padding: 8, gap: 2 }}>
        {lists.length >= FIND_FROM ? (
          <View style={{ padding: 6 }}>
            <Field label="Find a list" value={find} onChangeText={setFind} placeholder="Type part of its name" maxLength={40} />
          </View>
        ) : null}
        {shown.map((l) => (
          <ListRow
            key={l.id}
            picture={<RowTile list={l} all={all} />}
            name={l.name}
            about={kind(l)}
            on={l.id === chosenId}
            onPress={() => {
              onChoose(l.id);
              setOpen(false);
              setFind('');
            }}
          />
        ))}
        {shown.length === 0 ? (
          <View style={{ padding: 12 }}>
            <T size={14} weight="medium" color={colors.textMuted}>
              No list has that in its name.
            </T>
          </View>
        ) : null}
      </Card>
    </View>
  );
}

/**
 * For the boxes a list leaves off the form: a way to add one to this idea all the same. A list
 * that is just names may now and then hold one that wants a link or a few words with it. The
 * list itself is not changed.
 */
export function AddBoxes({ link, note, onLink, onNote }: { link: boolean; note: boolean; onLink: () => void; onNote: () => void }) {
  if (!link && !note) return null;
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      {link ? <Chip label="+ Add a link" dashed onPress={onLink} /> : null}
      {note ? <Chip label="+ Add a note" dashed onPress={onNote} /> : null}
    </View>
  );
}
