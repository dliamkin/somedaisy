import type { SupabaseClient } from '@supabase/supabase-js';

import { gather, GATHER_MS, listenToGroup } from '../live';

describe('gather', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('does the work once for a burst of asks', () => {
    const work = jest.fn();
    const g = gather(work);
    g.ask();
    g.ask();
    g.ask();
    expect(work).not.toHaveBeenCalled();
    jest.advanceTimersByTime(GATHER_MS);
    expect(work).toHaveBeenCalledTimes(1);
  });

  it('does not keep putting the work off while asks keep coming', () => {
    const work = jest.fn();
    const g = gather(work, 200);
    g.ask();
    jest.advanceTimersByTime(150);
    g.ask();
    jest.advanceTimersByTime(50);
    expect(work).toHaveBeenCalledTimes(1);
  });

  it('runs again for an ask that comes after the work was done', () => {
    const work = jest.fn();
    const g = gather(work, 200);
    g.ask();
    jest.advanceTimersByTime(200);
    g.ask();
    jest.advanceTimersByTime(200);
    expect(work).toHaveBeenCalledTimes(2);
  });

  it('an ask made while the work runs is not lost', () => {
    const g = gather(() => {
      calls += 1;
      if (calls === 1) g.ask();
    }, 100);
    let calls = 0;
    g.ask();
    jest.advanceTimersByTime(100);
    expect(calls).toBe(1);
    jest.advanceTimersByTime(100);
    expect(calls).toBe(2);
  });

  it('cancel drops a run that is waiting', () => {
    const work = jest.fn();
    const g = gather(work);
    g.ask();
    g.cancel();
    jest.advanceTimersByTime(GATHER_MS * 4);
    expect(work).not.toHaveBeenCalled();
    // And it can be used again afterwards.
    g.ask();
    jest.advanceTimersByTime(GATHER_MS);
    expect(work).toHaveBeenCalledTimes(1);
  });
});

describe('listenToGroup', () => {
  // A stand-in for Supabase: it hands out one channel for each name, as the real one does.
  type FakeChannel = { heard: (() => void) | null; send: jest.Mock; subscribe: jest.Mock; on: jest.Mock };
  function fakeClient() {
    const channels = new Map<string, FakeChannel>();
    const removed: unknown[] = [];
    const client = {
      channel: jest.fn((name: string) => {
        let channel = channels.get(name);
        if (!channel) {
          const made: FakeChannel = { heard: null, send: jest.fn(() => Promise.resolve('ok')), subscribe: jest.fn(), on: jest.fn() };
          made.on.mockImplementation((_type: string, _filter: unknown, callback: () => void) => {
            made.heard = callback;
            return made;
          });
          channel = made;
          channels.set(name, made);
        }
        return channel;
      }),
      removeChannel: jest.fn((channel: unknown) => {
        removed.push(channel);
        for (const [name, c] of channels) if (c === channel) channels.delete(name);
        return Promise.resolve('ok');
      }),
    };
    return { client: client as unknown as SupabaseClient, raw: client, channels, removed };
  }

  it('opens one channel for a group, however many screens listen', () => {
    const { client, raw, channels } = fakeClient();
    const page = listenToGroup(client, 'g1', jest.fn());
    const garden = listenToGroup(client, 'g1', jest.fn());
    expect(raw.channel).toHaveBeenCalledTimes(1);
    expect(channels.get('group:g1')?.subscribe).toHaveBeenCalledTimes(1);
    page.stop();
    garden.stop();
  });

  it('tells every screen when a signal arrives', () => {
    const { client, channels } = fakeClient();
    const page = jest.fn();
    const garden = jest.fn();
    const a = listenToGroup(client, 'g2', page);
    const b = listenToGroup(client, 'g2', garden);
    channels.get('group:g2')?.heard?.();
    expect(page).toHaveBeenCalledTimes(1);
    expect(garden).toHaveBeenCalledTimes(1);
    a.stop();
    b.stop();
  });

  it('keeps the channel open for the screen that is left, and closes it after the last', () => {
    const { client, raw, channels } = fakeClient();
    const page = jest.fn();
    const a = listenToGroup(client, 'g3', page);
    const b = listenToGroup(client, 'g3', jest.fn());
    const channel = channels.get('group:g3');
    b.stop();
    expect(raw.removeChannel).not.toHaveBeenCalled();
    channel?.heard?.();
    expect(page).toHaveBeenCalledTimes(1);
    a.stop();
    expect(raw.removeChannel).toHaveBeenCalledTimes(1);
    expect(raw.removeChannel).toHaveBeenCalledWith(channel);
  });

  it('sends the signal to the other members, and tells the other screens here directly', () => {
    const { client, channels } = fakeClient();
    const page = jest.fn();
    const garden = jest.fn();
    const a = listenToGroup(client, 'g4', page);
    const b = listenToGroup(client, 'g4', garden);
    b.tell();
    expect(channels.get('group:g4')?.send).toHaveBeenCalledWith({ type: 'broadcast', event: 'changed', payload: {} });
    expect(page).toHaveBeenCalledTimes(1);
    expect(garden).not.toHaveBeenCalled();
    a.stop();
    b.stop();
  });

  it('does nothing once it has stopped, even if asked twice', () => {
    const { client, raw, channels } = fakeClient();
    const a = listenToGroup(client, 'g5', jest.fn());
    const channel = channels.get('group:g5');
    a.stop();
    a.stop();
    a.tell();
    expect(raw.removeChannel).toHaveBeenCalledTimes(1);
    expect(channel?.send).not.toHaveBeenCalled();
  });

  it('opens a fresh channel for a group that is listened to again later', () => {
    const { client, raw } = fakeClient();
    listenToGroup(client, 'g6', jest.fn()).stop();
    const again = listenToGroup(client, 'g6', jest.fn());
    expect(raw.channel).toHaveBeenCalledTimes(2);
    again.stop();
  });

  it('keeps groups apart', () => {
    const { client, channels } = fakeClient();
    const one = jest.fn();
    const two = jest.fn();
    const a = listenToGroup(client, 'g7', one);
    const b = listenToGroup(client, 'g8', two);
    channels.get('group:g7')?.heard?.();
    expect(one).toHaveBeenCalledTimes(1);
    expect(two).not.toHaveBeenCalled();
    a.stop();
    b.stop();
  });
});
