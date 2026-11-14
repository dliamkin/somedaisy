import { getNotificationSettings, saveNotificationSettings } from '../push';
import { supabase } from '../supabase';

jest.mock('../supabase', () => ({ supabase: { from: jest.fn(), rpc: jest.fn() } }));

const client = supabase as unknown as { from: jest.Mock; rpc: jest.Mock };

/** Make the database answer the settings lookup with the given row (or failure). */
function stored(result: { data?: unknown; error?: { message: string } | null }) {
  const maybeSingle = jest.fn(async () => ({ data: null, error: null, ...result }));
  const select = jest.fn((_columns: string) => ({ maybeSingle }));
  client.from.mockReturnValue({ select });
  return select;
}

describe('getNotificationSettings', () => {
  it('has everything on for someone who never chose', async () => {
    stored({ data: null });
    expect(await getNotificationSettings()).toEqual({ reactions: true, reminders: true });
    expect(client.from).toHaveBeenCalledWith('notification_settings');
  });

  it('returns what the person chose', async () => {
    stored({ data: { reactions: false, reminders: true } });
    expect(await getNotificationSettings()).toEqual({ reactions: false, reminders: true });
    stored({ data: { reactions: true, reminders: false } });
    expect(await getNotificationSettings()).toEqual({ reactions: true, reminders: false });
  });

  it('fails with the database message, so the screen can show it', async () => {
    stored({ error: { message: 'relation "notification_settings" does not exist' } });
    await expect(getNotificationSettings()).rejects.toThrow('does not exist');
  });
});

describe('saveNotificationSettings', () => {
  it('saves both choices for the signed-in person', async () => {
    client.rpc.mockResolvedValue({ error: null });
    await saveNotificationSettings({ reactions: false, reminders: true });
    expect(client.rpc).toHaveBeenCalledWith('set_notification_settings', { p_reactions: false, p_reminders: true });
  });

  it('fails when the database refuses, so the switch can flip back', async () => {
    client.rpc.mockResolvedValue({ error: { message: 'Set your name first' } });
    await expect(saveNotificationSettings({ reactions: true, reminders: true })).rejects.toThrow('Set your name first');
  });
});
