// Turns a drawn card into a picture and hands it over: to the phone's share sheet in the app,
// and on the website to the browser's own share sheet where it has one, or else as a download.
// The picture is made on the device and is not stored or sent anywhere by SomeDaisy.

import * as Sharing from 'expo-sharing';
import type { ComponentRef, RefObject } from 'react';
import { PixelRatio, Platform, type View } from 'react-native';
import { captureRef } from 'react-native-view-shot';

/** The picture's size in pixels: four wide to five tall, the shape that fits chats and stories. */
export const PICTURE = { width: 1080, height: 1350 };

/** What happened: handed to a share sheet, saved as a download, or the person backed out. */
export type Shared = 'shared' | 'saved' | 'cancelled';

/** A reference to the card on screen, which is how its picture is taken. */
export type CardRef = RefObject<ComponentRef<typeof View> | null>;

export async function sharePicture(card: CardRef, name: string, title: string): Promise<Shared> {
  if (Platform.OS === 'web') {
    // In a browser the card is an ordinary page element. It is drawn enlarged, so the picture is
    // sharp at its full size whatever the screen. (The phone library's own browser path draws it
    // at screen size and stretches it, which comes out blurred.)
    const element = card.current as unknown as HTMLElement | null;
    if (!element) throw new Error('The card is not on screen.');
    const { default: html2canvas } = await import('html2canvas-pro');
    const canvas = await html2canvas(element, { useCORS: true, backgroundColor: null, scale: PICTURE.width / element.offsetWidth });
    const dataUri = canvas.toDataURL('image/png');
    const blob = await (await fetch(dataUri)).blob();
    const file = new File([blob], `${name}.png`, { type: 'image/png' });
    // Phones' browsers can pass a picture to other apps. Most desktop browsers cannot, so they save it.
    if (typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title });
        return 'shared';
      } catch (e) {
        if ((e as { name?: string } | null)?.name === 'AbortError') return 'cancelled';
        // Anything else: fall through and save it instead.
      }
    }
    const link = document.createElement('a');
    link.href = dataUri;
    link.download = `${name}.png`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    return 'saved';
  }

  // On a phone the size is asked for in the screen's own units, which the phone multiplies up.
  const scale = PixelRatio.get();
  const uri = await captureRef(card, {
    format: 'png',
    result: 'tmpfile',
    fileName: name,
    width: PICTURE.width / scale,
    height: PICTURE.height / scale,
  });
  if (!(await Sharing.isAvailableAsync())) throw new Error('Sharing is not available on this phone.');
  await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: title, UTI: 'public.png' });
  return 'shared';
}
