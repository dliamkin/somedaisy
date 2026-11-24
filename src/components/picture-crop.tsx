import { Image } from 'expo-image';
import { useEffect, useRef, useState, type ComponentRef } from 'react';
import { Modal, Platform, useWindowDimensions, View, type GestureResponderEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { clampView, cropOf, MOST_ZOOM, moveView, PICTURE_SHAPE, shownSize, startView, zoomView, type CropRect, type CropView } from '@/lib/picture-crop';
import type { PickedPhoto } from '@/lib/picture-files';
import { useTheme } from '@/lib/theme';

import { Button, CircleButton, T } from './ui';

// How much each press of a zoom button changes the size, and how far an arrow key moves the picture.
const ZOOM_STEP = 1.25;
const KEY_STEP = 24;

/**
 * Choosing which part of a photo an idea shows. The photo sits behind a frame the shape an idea's
 * picture is shown in. Dragging moves it, and pinching, the two round buttons or a mouse's wheel
 * make it bigger and smaller, until the frame holds what the person wants. "Use this picture"
 * answers with that part, in the photo's own dots, and where the photo was left, so the same
 * photo can be adjusted again from there.
 *
 * It opens over the whole screen, so that dragging the photo up and down never scrolls the form
 * underneath. With a keyboard, the arrow keys move the photo and plus and minus change its size.
 *
 * The frame is the shape of an idea's picture unless `shape` says otherwise, which is how the
 * garden's house asks for the taller shape of its card. `shows` finishes the sentence "The part
 * inside the frame is what".
 */
export function PictureCrop({
  photo,
  start,
  busy,
  shape = PICTURE_SHAPE,
  shows = 'the idea shows',
  onUse,
  onCancel,
}: {
  photo: PickedPhoto;
  /** How much wider than tall the frame is. */
  shape?: number;
  shows?: string;
  /** Where the photo was left the last time, if this is a second look at it. */
  start?: CropView | null;
  /** True while the chosen part is being cut out. */
  busy: boolean;
  onUse: (part: CropRect, view: CropView) => void;
  onCancel: () => void;
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const window = useWindowDimensions();
  // The frame is as wide as an idea's card, and the shape its picture is shown in. A tall frame
  // is made narrower on a short screen, so the buttons under it stay on the screen.
  const widest = Math.max(200, Math.min(window.width, 480) - 32);
  const tallest = Math.max(160, window.height - insets.top - insets.bottom - 350);
  const height = Math.round(Math.min(widest / shape, tallest));
  const frame = { width: Math.round(Math.min(widest, height * shape)), height };
  // Where the person has put the photo. Until they touch it, it is where it started.
  const [moved, setMoved] = useState<CropView | null>(start ?? null);
  const view = clampView(photo, frame, moved ?? startView(photo, frame));
  const shown = shownSize(photo, frame, view.zoom);

  // What the drag handlers need, kept where they can read the newest of it.
  const now = useRef({ photo, frame, view });
  useEffect(() => {
    now.current = { photo, frame, view };
  });
  const box = useRef<ComponentRef<typeof View>>(null);
  // Where the frame is on the screen, to place the spot between two fingers.
  const corner = useRef({ x: 0, y: 0 });
  // Where a drag started from. It starts afresh each time a finger is added or lifted.
  const drag = useRef<{ fingers: number; view: CropView; x: number; y: number; apart: number } | null>(null);

  // One finger, or the mouse, moves the photo. Two fingers make it bigger or smaller.
  const fingersOf = (event: GestureResponderEvent) => Math.min(2, Math.max(1, event.nativeEvent.touches?.length ?? 1));
  const firstOf = (event: GestureResponderEvent) => event.nativeEvent.touches?.[0] ?? event.nativeEvent;
  const apartOf = (event: GestureResponderEvent) => {
    const [a, b] = event.nativeEvent.touches;
    return Math.hypot(a.pageX - b.pageX, a.pageY - b.pageY);
  };
  const begin = (event: GestureResponderEvent) => {
    const fingers = fingersOf(event);
    const first = firstOf(event);
    drag.current = { fingers, view: now.current.view, x: first.pageX, y: first.pageY, apart: fingers === 2 ? apartOf(event) : 0 };
  };
  const onGrant = (event: GestureResponderEvent) => {
    box.current?.measureInWindow((x, y) => {
      corner.current = { x, y };
    });
    begin(event);
  };
  const onMove = (event: GestureResponderEvent) => {
    const fingers = fingersOf(event);
    if (!drag.current || drag.current.fingers !== fingers) begin(event);
    const from = drag.current;
    if (!from) return;
    const { photo: p, frame: f } = now.current;
    if (fingers === 2 && from.apart > 0) {
      // Bigger or smaller about the spot between the two fingers.
      const [a, b] = event.nativeEvent.touches;
      const between = { x: (a.pageX + b.pageX) / 2 - corner.current.x, y: (a.pageY + b.pageY) / 2 - corner.current.y };
      setMoved(zoomView(p, f, from.view, (from.view.zoom * apartOf(event)) / from.apart, between));
    } else {
      const first = firstOf(event);
      setMoved(moveView(p, f, from.view, first.pageX - from.x, first.pageY - from.y));
    }
  };
  const onEnd = () => {
    drag.current = null;
  };

  const zoomBy = (times: number) => setMoved(zoomView(photo, frame, view, view.zoom * times));

  // On a computer: the wheel makes the photo bigger and smaller about the pointer, the arrow keys move it, and plus and minus change its size.
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    const element = box.current as unknown as HTMLElement | null;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const { photo: p, frame: f, view: v } = now.current;
      const at = element?.getBoundingClientRect();
      const about = at ? { x: event.clientX - at.left, y: event.clientY - at.top } : undefined;
      setMoved(zoomView(p, f, v, v.zoom * (event.deltaY < 0 ? 1.1 : 1 / 1.1), about));
    };
    const onKey = (event: KeyboardEvent) => {
      const { photo: p, frame: f, view: v } = now.current;
      const moves: Record<string, [number, number]> = { ArrowLeft: [KEY_STEP, 0], ArrowRight: [-KEY_STEP, 0], ArrowUp: [0, KEY_STEP], ArrowDown: [0, -KEY_STEP] };
      const move = moves[event.key];
      if (move) setMoved(moveView(p, f, v, move[0], move[1]));
      else if (event.key === '+' || event.key === '=') setMoved(zoomView(p, f, v, v.zoom * ZOOM_STEP));
      else if (event.key === '-') setMoved(zoomView(p, f, v, v.zoom / ZOOM_STEP));
      else return;
      event.preventDefault();
    };
    element?.addEventListener('wheel', onWheel, { passive: false });
    document.addEventListener('keydown', onKey);
    return () => {
      element?.removeEventListener('wheel', onWheel);
      document.removeEventListener('keydown', onKey);
    };
  }, []);

  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent onRequestClose={busy ? undefined : onCancel}>
      <View style={{ flex: 1, backgroundColor: colors.background, alignItems: 'center' }}>
        <View style={{ flex: 1, width: '100%', maxWidth: 480, paddingHorizontal: 16, paddingTop: insets.top + 24, paddingBottom: Math.max(16, insets.bottom + 8), gap: 16 }}>
          <View style={{ gap: 4 }}>
            <T size={26} weight="black" style={{ lineHeight: 30, letterSpacing: -0.5 }}>
              Choose what shows
            </T>
            <T size={15} weight="medium" color={colors.textMuted}>
              Drag the picture to move it. {Platform.OS === 'web' ? 'Use the buttons to' : 'Pinch, or use the buttons, to'} make it bigger or smaller. The part inside the frame is what {shows}.
            </T>
          </View>
          <View style={{ width: frame.width, height: frame.height, alignSelf: 'center' }}>
            <View
              ref={box}
              onStartShouldSetResponder={() => true}
              onMoveShouldSetResponder={() => true}
              onResponderTerminationRequest={() => false}
              onResponderGrant={onGrant}
              onResponderMove={onMove}
              onResponderRelease={onEnd}
              onResponderTerminate={onEnd}
              accessible
              accessibilityLabel="The part of the picture that will show. Drag to move the picture."
              style={[
                { width: frame.width, height: frame.height, borderRadius: 16, overflow: 'hidden', backgroundColor: colors.card },
                // On a phone's browser, a drag here moves the picture and not the page.
                Platform.OS === 'web' ? ({ touchAction: 'none', cursor: 'grab', userSelect: 'none' } as object) : null,
              ]}>
              <View pointerEvents="none" style={{ position: 'absolute', left: view.x, top: view.y, width: shown.width, height: shown.height }}>
                <Image source={{ uri: photo.uri }} style={{ width: '100%', height: '100%' }} contentFit="fill" />
              </View>
            </View>
            {/* The frame's edge is drawn round the outside, so that all of what is inside it is kept. */}
            <View pointerEvents="none" style={{ position: 'absolute', left: -3, top: -3, right: -3, bottom: -3, borderRadius: 19, borderWidth: 3, borderColor: colors.button }} />
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 14 }}>
            <CircleButton label="Make the picture smaller" onPress={() => zoomBy(1 / ZOOM_STEP)}>
              <T size={24} weight="black" color={view.zoom <= 1 ? colors.textDisabled : colors.link} style={{ lineHeight: 26 }}>
                −
              </T>
            </CircleButton>
            <T size={14} weight="extra" color={colors.textMuted} style={{ minWidth: 52, textAlign: 'center' }}>
              {Math.round(view.zoom * 100)}%
            </T>
            <CircleButton label="Make the picture bigger" onPress={() => zoomBy(ZOOM_STEP)}>
              <T size={24} weight="black" color={view.zoom >= MOST_ZOOM ? colors.textDisabled : colors.link} style={{ lineHeight: 26 }}>
                +
              </T>
            </CircleButton>
          </View>
          <View style={{ flex: 1 }} />
          <View style={{ gap: 8 }}>
            <Button label="Use this picture" busy={busy} onPress={() => onUse(cropOf(photo, frame, view), view)} />
            <Button label="Cancel" kind="ghost" small disabled={busy} onPress={onCancel} />
          </View>
        </View>
      </View>
    </Modal>
  );
}
