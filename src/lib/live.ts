// Live updates: helpers for reacting to "something changed" signals.
//
// A signal says only that a group changed, never what changed. The screen answers by loading
// the group again. Signals can arrive in a burst: one change is announced both by the phone
// that made it and by the database, and a person tapping quickly makes several changes in a
// second. Loading once for the burst is enough.

/** How long to wait for more signals before loading. Short enough to feel instant. */
export const GATHER_MS = 250;

export type Gathered = {
  /** Ask for the work to be done soon. Asking again before it runs does not add a second run. */
  ask: () => void;
  /** Drop a run that is waiting, for when the screen goes away. */
  cancel: () => void;
};

/** Runs `work` once, shortly after it is first asked for, however many times it is asked in between. */
export function gather(work: () => void, wait: number = GATHER_MS): Gathered {
  let timer: ReturnType<typeof setTimeout> | null = null;
  return {
    ask: () => {
      if (timer !== null) return;
      timer = setTimeout(() => {
        timer = null;
        work();
      }, wait);
    },
    cancel: () => {
      if (timer !== null) clearTimeout(timer);
      timer = null;
    },
  };
}
