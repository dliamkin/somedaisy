import { getNotificationSettings, NO_NUDGES, saveNotificationSettings } from '../push';
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
    expect(await getNotificationSettings()).toEqual({ reactions: true, comments: true, reminders: true, nudges: true });
    expect(client.from).toHaveBeenCalledWith('notification_settings');
  });

  it('returns what the person chose', async () => {
    stored({ data: { reactions: false, comments: true, reminders: true, nudges: true } });
    expect(await getNotificationSettings()).toEqual({ reactions: false, comments: true, reminders: true, nudges: true });
    stored({ data: { reactions: true, comments: false, reminders: false, nudges: false } });
    expect(await getNotificationSettings()).toEqual({ reactions: true, comments: false, reminders: false, nudges: false });
  });

  it('treats comments and nudges as on when the database does not have those choices yet', async () => {
    stored({ data: { reactions: true, reminders: false } });
    expect(await getNotificationSettings()).toEqual({ reactions: true, comments: true, reminders: false, nudges: true });
  });

  it('fails with the database message, so the screen can show it', async () => {
    stored({ error: { message: 'relation "notification_settings" does not exist' } });
    await expect(getNotificationSettings()).rejects.toThrow('does not exist');
  });
});

describe('saveNotificationSettings', () => {
  it('saves every choice for the signed-in person', async () => {
    client.rpc.mockResolvedValue({ error: null });
    await saveNotificationSettings({ reactions: false, comments: true, reminders: true, nudges: false });
    expect(client.rpc).toHaveBeenCalledWith('set_notification_settings', { p_reactions: false, p_reminders: true, p_comments: true, p_nudges: false });
  });

  it('still saves the other choices when the database does not know about nudges yet', async () => {
    client.rpc.mockReset();
    client.rpc.mockResolvedValueOnce({ error: { code: 'PGRST202', message: 'Could not find the function' } }).mockResolvedValueOnce({ error: null });
    await saveNotificationSettings({ reactions: false, comments: true, reminders: true, nudges: true });
    expect(client.rpc).toHaveBeenLastCalledWith('set_notification_settings', { p_reactions: false, p_reminders: true, p_comments: true });
  });

  it('says so when nudges cannot be switched off because the database does not know about them', async () => {
    client.rpc.mockReset();
    client.rpc.mockResolvedValueOnce({ error: { code: 'PGRST202', message: 'Could not find the function' } }).mockResolvedValueOnce({ error: null });
    await expect(saveNotificationSettings({ reactions: true, comments: true, reminders: true, nudges: false })).rejects.toThrow(NO_NUDGES);
  });

  it('fails when the database refuses, so the switch can flip back', async () => {
    client.rpc.mockResolvedValue({ error: { message: 'Set your name first' } });
    await expect(saveNotificationSettings({ reactions: true, comments: true, reminders: true, nudges: true })).rejects.toThrow('Set your name first');
  });
});
