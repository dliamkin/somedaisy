// Hands over a postcard of the garden: to the phone's share sheet in the app, and on the website
// to the browser's own share sheet where it has one, or else as a download. The picture is made on
// the device (src/components/garden-view.tsx) and is not stored or sent anywhere by SomeDaisy.
//
// On a phone, "Save picture" opens the share sheet as well, which is where a phone offers to keep a
// picture. Saving straight into the phone's photos would need the app to ask for access to them,
// which it does not.

import { Platform } from 'react-native';

import { bytesFromBase64 } from './pictures';

/** The file's name wherever it lands. */
const FILE = 'somedaisy-garden.jpg';

/**
 * What happened: `shared` and `saved` are certain. `handed` means the phone's share sheet was
 * opened, and the phone does not say what the person did there. `cancelled` means they backed out.
 */
export type Sent = 'shared' | 'saved' | 'handed' | 'cancelled';

function download(card: string): void {
  const link = document.createElement('a');
  link.href = card;
  link.download = FILE;
  document.body.appendChild(link);
  link.click();
  link.remove();
}

/** On a phone: write the card to a file the share sheet can be given, and open the sheet. */
async function hand(card: string, title: string): Promise<Sent> {
  const [{ File, Paths }, Sharing] = await Promise.all([import('expo-file-system'), import('expo-sharing')]);
  if (!(await Sharing.isAvailableAsync())) throw new Error('Sharing is not available on this phone.');
  const file = new File(Paths.cache, FILE);
  if (file.exists) file.delete();
  file.create();
  await file.write(bytesFromBase64(card));
  await Sharing.shareAsync(file.uri, { mimeType: 'image/jpeg', dialogTitle: title, UTI: 'public.jpeg' });
  return 'handed';
}

/**
 * Share a postcard, given as a JPEG's data address. `title` is the group's name and `text` goes
 * with the picture where the share sheet takes words.
 */
export async function sharePostcard(card: string, title: string, text: string): Promise<Sent> {
  if (Platform.OS !== 'web') return hand(card, title);
  const blob = new Blob([bytesFromBase64(card) as BlobPart], { type: 'image/jpeg' });
  const file = new File([blob], FILE, { type: 'image/jpeg' });
  // Phones' browsers can pass a picture to other apps. Most desktop browsers cannot, so they save it.
  if (typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title, text });
      return 'shared';
    } catch (e) {
      if ((e as { name?: string } | null)?.name === 'AbortError') return 'cancelled';
      // Anything else: fall through and save it instead.
    }
  }
  download(card);
  return 'saved';
}

/** Keep a postcard, given as a JPEG's data address. */
export async function savePostcard(card: string, title: string): Promise<Sent> {
  if (Platform.OS !== 'web') return hand(card, title);
  download(card);
  return 'saved';
}
