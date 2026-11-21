import { useEffect, useRef, useState, type ComponentRef } from 'react';
import { Platform, ScrollView, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { useTheme } from '@/lib/theme';

import { ActionIcon } from './action-icons';
import { Chip, CircleButton } from './ui';

const NEWEST = 'newest';
// How much of the next tab stays in view when the row moves to show one.
const PEEK = 24;
// How wide the fade at the right edge is, on a phone.
const FADE = 28;
// The name the row goes by on the website, for the rules that draw its scrollbar.
const WEB_NAME = 'data-list-row';

type Span = { x: number; width: number };
type Scroller = ComponentRef<typeof ScrollView>;

/** Move the row, if it has to, so that a tab is wholly in view. */
function bringIntoView(scroller: Scroller | null, tab: Span | undefined, view: Span) {
  if (!scroller || !tab || view.width === 0) return;
  if (tab.x < view.x) scroller.scrollTo({ x: Math.max(0, tab.x - PEEK), animated: true });
  else if (tab.x + tab.width > view.x + view.width) scroller.scrollTo({ x: tab.x + tab.width - view.width + PEEK, animated: true });
}

/**
 * Whether the row is being used with a finger: always on a phone app, and on the website when the
 * device has no mouse. A finger slides the row and needs no scrollbar. A mouse needs one to drag.
 */
function useFinger(): boolean {
  const [finger, setFinger] = useState(() => Platform.OS !== 'web');
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const query = window.matchMedia('(hover: none) and (pointer: coarse)');
    const tell = () => setFinger(query.matches);
    tell();
    query.addEventListener?.('change', tell);
    return () => query.removeEventListener?.('change', tell);
  }, []);
  return finger;
}

/**
 * The row of list tabs on a group's page: a button for the page of every list, then "Newest" and
 * each list with how many ideas it holds. The button stays put and the tabs slide sideways beside
 * it, so the row never takes more height however many lists there are.
 *
 * A sideways row is hard to search and, with a mouse, hard to move. So the button opens the page
 * of every list, the row moves by itself to show the list that is picked, and on a computer the
 * mouse wheel slides it and a slim scrollbar under it can be dragged. With a finger there is no
 * bar: the tabs fade out at the right edge, which says there are more.
 */
export function ListStrip({
  lists,
  counts,
  total,
  activeId,
  onPick,
  onAll,
}: {
  lists: { id: string; name: string }[];
  /** How many ideas each list holds, by list id. */
  counts: Record<string, number>;
  /** How many ideas there are in all, for "Newest". */
  total: number;
  /** The list on show. Null is "Newest". */
  activeId: string | null;
  onPick: (listId: string | null) => void;
  onAll: () => void;
}) {
  const { colors, dark } = useTheme();
  const finger = useFinger();
  const scroller = useRef<Scroller>(null);
  // Where each tab sits in the row, and the part of the row that is in view.
  const tabs = useRef(new Map<string, Span>());
  const view = useRef<Span>({ x: 0, width: 0 });
  const active = activeId ?? NEWEST;

  // A list picked somewhere else, such as on the page of every list, may be out of view here.
  useEffect(() => {
    bringIntoView(scroller.current, tabs.current.get(active), view.current);
  }, [active]);

  // On the website: the mouse wheel slides the row, and the row is given a name so its scrollbar can be drawn.
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const held = scroller.current as unknown as { getScrollableNode?: () => unknown } | null;
    const node = (held?.getScrollableNode?.() ?? held) as HTMLElement | null;
    if (!node || typeof node.addEventListener !== 'function') return;
    node.setAttribute(WEB_NAME, '');
    // A mouse wheel turns up and down, which a sideways row ignores, leaving the tabs past the
    // edge out of reach. Over this row the wheel slides it instead. At either end the wheel goes
    // back to moving the page.
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

  // The scrollbar's look, on the website: slim and rounded, in the page's own line colours. It is
  // hidden only where there is no mouse to drag it with. The colours change with the mode.
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    const id = 'list-row-scrollbar';
    const style = document.getElementById(id) ?? document.head.appendChild(Object.assign(document.createElement('style'), { id }));
    const row = `[${WEB_NAME}]`;
    style.textContent = [
      `${row}{padding-bottom:8px}`,
      `${row}::-webkit-scrollbar{height:8px}`,
      `${row}::-webkit-scrollbar-track{background:${colors.line};border-radius:4px}`,
      `${row}::-webkit-scrollbar-thumb{background:${colors.outline};border-radius:4px}`,
      `@supports not selector(::-webkit-scrollbar){${row}{scrollbar-width:thin;scrollbar-color:${colors.outline} ${colors.line}}}`,
      `@media (hover:none) and (pointer:coarse){${row}{padding-bottom:0;scrollbar-width:none}${row}::-webkit-scrollbar{display:none}}`,
    ].join('');
  }, [colors.line, colors.outline]);

  if (lists.length === 0) return null;

  const all = [{ key: NEWEST, label: 'Newest', id: null as string | null, count: undefined as number | undefined }, ...lists.map((l) => ({ key: l.id, label: l.name, id: l.id as string | null, count: counts[l.id] ?? 0 }))];
  const fadeId = dark ? 'list-row-fade-dark' : 'list-row-fade';

  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
      <CircleButton edged label={lists.length === 1 ? 'All lists, and new list' : `All ${lists.length} lists, and new list`} onPress={onAll}>
        <ActionIcon name="lists" color={colors.text} />
      </CircleButton>
      <View style={{ flex: 1, minWidth: 0 }}>
        <ScrollView
          ref={scroller}
          horizontal
          // On the website the bar is drawn by the rules above, which hide it where there is no mouse.
          showsHorizontalScrollIndicator={Platform.OS === 'web'}
          scrollEventThrottle={32}
          onScroll={(event) => {
            view.current.x = event.nativeEvent.contentOffset.x;
          }}
          onLayout={(event) => {
            view.current.width = event.nativeEvent.layout.width;
          }}
          contentContainerStyle={{ gap: 8, paddingRight: finger ? FADE : 8 }}>
          {all.map((tab) => (
            <View
              key={tab.key}
              onLayout={(event) => {
                const { x, width } = event.nativeEvent.layout;
                tabs.current.set(tab.key, { x, width });
                // A list that was only just made gets its tab after it was picked.
                if (tab.key === active) bringIntoView(scroller.current, { x, width }, view.current);
              }}>
              <Chip
                label={tab.label}
                count={tab.count}
                dark
                selected={tab.key === active}
                accessibilityLabel={tab.count === undefined ? `${tab.label}, all ${total} ideas` : `${tab.label}, ${tab.count === 1 ? '1 idea' : `${tab.count} ideas`}`}
                onPress={() => onPick(tab.id)}
              />
            </View>
          ))}
        </ScrollView>
        {finger ? (
          // The tabs fade into the page at the right edge. It takes no taps: the tab under it still can be tapped.
          <View pointerEvents="none" style={{ position: 'absolute', top: 0, right: 0, width: FADE, height: 44 }}>
            <Svg width="100%" height="100%" viewBox="0 0 1 1" preserveAspectRatio="none">
              <Defs>
                <LinearGradient id={fadeId} x1="0" y1="0" x2="1" y2="0">
                  <Stop offset="0" stopColor={colors.background} stopOpacity={0} />
                  <Stop offset="1" stopColor={colors.background} stopOpacity={1} />
                </LinearGradient>
              </Defs>
              <Rect width={1} height={1} fill={`url(#${fadeId})`} />
            </Svg>
          </View>
        ) : null}
      </View>
    </View>
  );
}
