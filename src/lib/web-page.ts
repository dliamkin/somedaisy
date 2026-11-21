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
 * 3. Cover the box being typed in with the keyboard. The page is told to get shorter when the
 *    keyboard comes up, so the buttons pinned to the bottom ride above it, and the box is
 *    scrolled into view whenever it is not (see `steadyWebPage`).
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

/**
 * Website only. Asks search engines to leave the page on show out of their results, and gives
 * back what takes the request away again when the page is left. This reaches the search engines
 * that run the app. The ones that do not are told by public/_headers.
 */
export function hideFromSearch(): () => void {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return () => {};
  const tag = document.createElement('meta');
  tag.name = 'robots';
  tag.content = 'noindex, nofollow';
  document.head.appendChild(tag);
  return () => tag.remove();
}

/**
 * Whether a box is out of sight, or so near the edge of what can be seen that its label or the
 * line being typed is cut off. `area` is the part of the screen its page shows through.
 */
export function outOfSight(box: { top: number; bottom: number }, area: { top: number; bottom: number }, above = 40, below = 16): boolean {
  return box.top < area.top + above || box.bottom > area.bottom - below;
}

/** The viewport setting with the keyboard told to take its room from the page, not to cover it. */
export function withKeyboardRoom(viewport: string): string {
  return /interactive-widget/i.test(viewport) ? viewport : `${viewport}, interactive-widget=resizes-content`;
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

  // Left to itself a phone browser lays the keyboard over the bottom of the page. Asked this way,
  // it makes the page shorter instead, as a phone app's page gets shorter.
  const viewport = document.querySelector<HTMLMetaElement>('meta[name="viewport"]');
  if (viewport) viewport.content = withKeyboardRoom(viewport.content);

  // Bring the box being typed in back into view when it is not: under the keyboard, or pushed
  // off by something that appeared above it. A box that can be seen is left where it is.
  const reveal = () => {
    const box = document.activeElement;
    if (!(box instanceof HTMLInputElement || box instanceof HTMLTextAreaElement)) return;
    const view = window.visualViewport;
    const top = view?.offsetTop ?? 0;
    let area = { top, bottom: top + (view?.height ?? window.innerHeight) };
    // What can be seen of the box is also cut off by the part of the page it scrolls in.
    for (let up = box.parentElement; up; up = up.parentElement) {
      const flow = getComputedStyle(up).overflowY;
      if ((flow === 'auto' || flow === 'scroll') && up.scrollHeight > up.clientHeight) {
        const edge = up.getBoundingClientRect();
        area = { top: Math.max(area.top, edge.top), bottom: Math.min(area.bottom, edge.bottom) };
        break;
      }
    }
    if (!outOfSight(box.getBoundingClientRect(), area)) return;
    const still = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    box.scrollIntoView({ block: 'center', behavior: still ? 'auto' : 'smooth' });
  };
  // After the keyboard has had time to come up, and again each time the room for the page changes.
  document.addEventListener('focusin', () => setTimeout(reveal, 350));
  window.visualViewport?.addEventListener('resize', () => setTimeout(reveal, 60));
}
