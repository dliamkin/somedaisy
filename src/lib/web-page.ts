import { Platform } from 'react-native';

/**
 * Website only. Two things a phone browser can do to the page that the app's screens cannot fix
 * from inside:
 *
 * 1. Show the page behind the app. The app fills the height the browser reports, and a phone
 *    browser changes its mind about that height as its address bar and the keyboard come and go.
 *    Whatever is left over used to show as a white band along the bottom. The page behind is now
 *    the same colour as the app (see `paintWebPage`), so there is nothing to see.
 * 2. Leave the page nudged upwards. The app scrolls inside itself, never the page, but a browser
 *    still moves the page to bring a text box above the keyboard and does not always move it back.
 *    Once nothing is being typed in, the page is put back at the top.
 */
/**
 * Website only. Colours the page behind the app, and tells the browser which mode it is in so
 * its own parts (scroll bars, the keyboard's suggestions) match.
 */
export function paintWebPage(background: string, dark: boolean): void {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return;
  document.documentElement.style.backgroundColor = background;
  document.body.style.backgroundColor = background;
  document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
  // The colour a phone browser tints its own bars with. The built page starts with the light one
  // (see scripts/web-head.js). This keeps it the same as the page in dark mode too.
  let tint = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (!tint) {
    tint = document.createElement('meta');
    tint.name = 'theme-color';
    document.head.appendChild(tint);
  }
  tint.content = background;
}

export function steadyWebPage(): void {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return;

  const typing = () => {
    const el = document.activeElement;
    return el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement;
  };
  const settle = () => {
    if (!typing() && (window.scrollX !== 0 || window.scrollY !== 0)) window.scrollTo(0, 0);
  };
  // A moment after a text box is left, so that tapping from one box to the next does not count.
  document.addEventListener('focusout', () => setTimeout(settle, 120));
  window.addEventListener('scroll', settle, { passive: true });
}
