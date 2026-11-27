import { useState } from 'react';
import { Pressable } from 'react-native';

import { markChanged } from '@/lib/data';
import { removePicture } from '@/lib/picture-files';
import { useTheme } from '@/lib/theme';
import { deleteDone } from '@/lib/together';

import { Dialog } from './dialog';
import { Button, ErrorNote, T } from './ui';

/** Something the group did, as far as deleting it goes: which one, what to call it, and where its own picture is kept. */
export type Deletable = { id: string; title: string; picture?: string | null };

/**
 * The quiet "Delete" under something the group did. It only asks: `DeleteDoneDialog` makes sure
 * first. `color` is for when it sits on something that is not a card, such as the dimmed garden.
 */
export function DeleteDoneLink({ title, onPress, disabled, color }: { title: string; onPress: () => void; disabled?: boolean; color?: string }) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Delete ${title}`}
      accessibilityState={{ disabled: Boolean(disabled) }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => ({ minHeight: 44, justifyContent: 'center', opacity: disabled ? 0.45 : pressed ? 0.7 : 1 })}>
      <T size={14} weight="extra" color={color ?? colors.danger} style={color ? { textDecorationLine: 'underline' } : undefined}>
        Delete
      </T>
    </Pressable>
  );
}

/**
 * "Delete this?" for something the group did, and the deleting itself once the answer is yes
 * (`deleteDone`, update 027). It goes for everyone, from "Things we did", the calendar and the
 * garden's house, and the group keeps the points it earned.
 *
 * `onDeleted` is told once it has gone, to read the page afresh. It is told the same when the
 * thing turns out to be gone already, or back on its list, because somebody else got there
 * first: either way it is no longer something to delete here.
 *
 * Like any dialog, it has to be placed last in the page's outermost box.
 */
export function DeleteDoneDialog({ groupId, idea, onDeleted, onClose }: { groupId: string; idea: Deletable; onDeleted: () => void | Promise<void>; onClose: () => void }) {
  const { colors } = useTheme();
  const [busy, setBusy] = useState(false);
  const [refused, setRefused] = useState<string | null>(null);

  const goAhead = async () => {
    if (busy) return;
    setBusy(true);
    setRefused(null);
    try {
      let gone = false;
      try {
        gone = await deleteDone(idea.id);
      } catch (e) {
        // The database says this of an idea that is not there, which is what one already deleted is.
        if (!(e instanceof Error && e.message.includes('not in that group'))) throw e;
      }
      // Its own picture is a file, which nothing shows any more.
      if (gone) void removePicture(idea.picture);
      // The group's page tells the other members when it is next looked at.
      markChanged(groupId);
      await onDeleted();
    } catch (e) {
      setRefused(e instanceof Error ? e.message : 'Could not delete it.');
      setBusy(false);
    }
  };

  return (
    <Dialog title={`Delete ${idea.title}?`} onClose={onClose} locked={busy}>
      <T size={15} weight="medium">
        It goes for everyone in the group: from &quot;Things we did&quot;, from the calendar and from the wall in the garden&apos;s house.
      </T>
      <T size={15} weight="medium">
        Its stamp, comments, picture and everyone&apos;s answers go with it. Your group keeps the points it earned.
      </T>
      <T size={15} weight="extra" color={colors.danger}>
        This cannot be undone.
      </T>
      <ErrorNote message={refused} />
      <Button label="Yes, delete it" kind="danger" onPress={() => void goAhead()} busy={busy} />
      <Button label="Cancel" kind="ghost" small onPress={onClose} disabled={busy} />
    </Dialog>
  );
}
