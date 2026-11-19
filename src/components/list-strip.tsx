import { useEffect, useRef, type ComponentRef } from 'react';
import { Platform, ScrollView, View } from 'react-native';

import { useTheme } from '@/lib/theme';

import { ActionIcon } from './action-icons';
import { Chip, CircleButton } from './ui';

const NEWEST = 'newest';
// From this many lists up, the row gets a button that opens the page of every list.
const ALL_FROM = 4;
// How much of the next tab stays in view when the row moves to show one.
const PEEK = 24;

type Span = { x: number; width: number };
type Scroller = ComponentRef<typeof ScrollView>;

/** Move the row, if it has to, so that a tab is wholly in view. */
function bringIntoView(scroller: Scroller | null, tab: Span | undefined, view: Span) {
  if (!scroller || !tab || view.width === 0) return;
  if (tab.x < view.x) scroller.scrollTo({ x: Math.max(0, tab.x - PEEK), animated: true });
  else if (tab.x + tab.width > view.x + view.width) scroller.scrollTo({ x: tab.x + tab.width - view.width + PEEK, animated: true });
}

/**
 * The row of list tabs on a group's page: "Newest", each list, and "+ List". It is one row that
 * slides sideways, so it never takes more height however many lists there are.
 *
 * A sideways row is hard to search and, with a mouse, hard to move. So once there are a few
 * lists a button at the start opens the page of every list, the row moves by itself to show the
 * list that is picked, and on a computer the mouse wheel slides it.
 */
export function ListStrip({
  lists,
  activeId,
  onPick,
  onAll,
  onNew,
}: {
  lists: { id: string; name: string }[];
  /** The list on show. Null is "Newest". */
  activeId: string | null;
  onPick: (listId: string | null) => void;
  onAll: () => void;
  onNew: () => void;
}) {
  const { colors } = useTheme();
  const scroller = useRef<Scroller>(null);
  // Where each tab sits in the row, and the part of the row that is in view.
  const tabs = useRef(new Map<string, Span>());
  const view = useRef<Span>({ x: 0, width: 0 });
  const active = activeId ?? NEWEST;

  // A list picked somewhere else, such as on the page of every list, may be out of view here.
  useEffect(() => {
    bringIntoView(scroller.current, tabs.current.get(active), view.current);
  }, [active]);

  // A mouse wheel turns up and down, which a sideways row ignores, leaving the tabs past the
  // edge out of reach. Over this row the wheel slides it instead. At either end the wheel goes
  // back to moving the page.
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const held = scroller.current as unknown as { getScrollableNode?: () => unknown } | null;
    const node = (held?.getScrollableNode?.() ?? held) as HTMLElement | null;
    if (!node || typeof node.addEventListener !== 'function') return;
    const onWheel = (event: WheelEvent) => {
      // Already sideways: a trackpad, or the wheel with Shift held.
      if (Math.abs(event.deltaX) >= Math.abs(event.deltaY)) return;
      const room = node.scrollWidth - node.clientWidth;
      if (room <= 0) return;
      // Some browsers count the wheel in lines, not dots.
      const step = event.deltaMode === 1 ? event.deltaY * 16 : event.deltaY;
      const to = Math.max(0, Math.min(room, node.scrollLeft + step));
      if (to === node.scrollLeft) return;
      node.scrollLeft = to;
      event.preventDefault();
    };
    node.addEventListener('wheel', onWheel, { passive: false });
    return () => node.removeEventListener('wheel', onWheel);
  }, []);

  const all = [...(lists.length > 0 ? [{ key: NEWEST, label: 'Newest', id: null }] : []), ...lists.map((l) => ({ key: l.id, label: l.name, id: l.id as string | null }))];

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      {lists.length >= ALL_FROM ? (
        <CircleButton flat label={`All ${lists.length} lists`} onPress={onAll}>
          <ActionIcon name="lists" color={colors.link} />
        </CircleButton>
      ) : null}
      <ScrollView
        ref={scroller}
        horizontal
        showsHorizontalScrollIndicator={false}
        scrollEventThrottle={32}
        onScroll={(event) => {
          view.current.x = event.nativeEvent.contentOffset.x;
        }}
        onLayout={(event) => {
          view.current.width = event.nativeEvent.layout.width;
        }}
        contentContainerStyle={{ gap: 8, paddingRight: 8 }}
        style={{ flex: 1, flexGrow: 1 }}>
        {all.map((tab) => (
          <View
            key={tab.key}
            onLayout={(event) => {
              const { x, width } = event.nativeEvent.layout;
              tabs.current.set(tab.key, { x, width });
              // A list that was only just made gets its tab after it was picked.
              if (tab.key === active) bringIntoView(scroller.current, { x, width }, view.current);
            }}>
            <Chip label={tab.label} dark selected={tab.key === active} onPress={() => onPick(tab.id)} />
          </View>
        ))}
        <Chip label="+ List" dashed accessibilityLabel="Add a list" onPress={onNew} />
      </ScrollView>
    </View>
  );
}
