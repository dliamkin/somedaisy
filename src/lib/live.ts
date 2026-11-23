// Live updates: helpers for reacting to "something changed" signals.
//
// A signal says only that a group changed, never what changed. The screen answers by loading
// the group again. Signals can arrive in a burst: one change is announced both by the phone
// that made it and by the database, and a person tapping quickly makes several changes in a
// second. Loading once for the burst is enough.

import type { SupabaseClient } from '@supabase/supabase-js';

type Channel = ReturnType<SupabaseClient['channel']>;
type Listener = { heard: () => void };

// One channel for each group, however many screens are listening to it. The group's page stays
// open underneath its garden, and Supabase hands out the same channel to both: if each closed
// "its own" on the way out, the first to go would cut the other off.
const open = new Map<string, { channel: Channel; listeners: Set<Listener> }>();

export type Listening = {
  /** Tell the other members, and any other screen here that is listening, that the group changed. */
  tell: () => void;
  /** Stop listening. The channel is closed once nobody is. */
  stop: () => void;
};

/**
 * Listen for "something changed" on a group's channel. `heard` runs for a change made by another
 * member, by the database (update 016), or by another screen in this app that called `tell`.
 */
export function listenToGroup(client: SupabaseClient, groupId: string, heard: () => void): Listening {
  let entry = open.get(groupId);
  if (!entry) {
    const listeners = new Set<Listener>();
    const channel = client.channel(`group:${groupId}`, { config: { broadcast: { self: false } } });
    channel.on('broadcast', { event: 'changed' }, () => {
      for (const listener of [...listeners]) listener.heard();
    });
    channel.subscribe();
    entry = { channel, listeners };
    open.set(groupId, entry);
  }
  const { channel, listeners } = entry;
  const me: Listener = { heard };
  listeners.add(me);
  return {
    tell: () => {
      if (!listeners.has(me)) return;
      void channel.send({ type: 'broadcast', event: 'changed', payload: {} });
      // The channel does not play a signal back to the app that sent it, so other screens here are told directly.
      for (const listener of [...listeners]) if (listener !== me) listener.heard();
    },
    stop: () => {
      if (!listeners.delete(me) || listeners.size > 0) return;
      if (open.get(groupId)?.channel === channel) open.delete(groupId);
      void client.removeChannel(channel);
    },
  };
}

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
