import { useState } from 'react';
import { Pressable } from 'react-native';

import { cleanComment, COMMENT_MAX } from '@/lib/comments';
import { useTheme } from '@/lib/theme';

import { ActionIcon } from './action-icons';
import { hangingPill } from './comment-reactions';
import { Sheet } from './sheet';
import { Button, ErrorNote, Field, T } from './ui';

/**
 * The small pencil on one of your own comments, which opens it to be changed or deleted. A pill
 * like the face for reacting, hanging off the comment's bottom edge beside it. The room to tap
 * round it stops short on the left, where the face's own begins.
 */
export function EditCommentPill({ label, onPress }: { label: string; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={{ top: 9, bottom: 9, left: 4, right: 9 }}
      style={({ pressed }) => [hangingPill(colors, pressed), { paddingHorizontal: 8 }]}>
      <ActionIcon name="edit" size={16} />
    </Pressable>
  );
}

/**
 * One of your own comments, opened from its pencil: its words in a box to change them, "Save",
 * and "Delete comment", which asks once more before it does.
 *
 * `onSave` is given the new words and `onDelete` nothing. Each shuts this once it has worked.
 * When one fails, what went wrong is shown here and the words typed are kept.
 *
 * Like any sheet, it has to be placed last in the page's outermost box.
 */
export function CommentEditor({ body, onSave, onDelete, onClose }: { body: string; onSave: (words: string) => Promise<void>; onDelete: () => Promise<void>; onClose: () => void }) {
  const { colors } = useTheme();
  const [words, setWords] = useState(body);
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [refused, setRefused] = useState<string | null>(null);

  const cleaned = cleanComment(words);
  const changed = cleaned !== null && cleaned !== body;

  const run = async (what: () => Promise<void>, otherwise: string) => {
    if (busy) return;
    setBusy(true);
    setRefused(null);
    try {
      await what();
    } catch (e) {
      setRefused(e instanceof Error ? e.message : otherwise);
      setBusy(false);
    }
  };

  if (asking) {
    return (
      <Sheet title="Delete this comment?" onClose={onClose}>
        <T size={15} weight="medium" lines={4} color={colors.textMuted} style={{ paddingHorizontal: 4 }}>
          {body}
        </T>
        <T size={15} weight="medium" style={{ paddingHorizontal: 4 }}>
          It goes for everyone in the group, along with the reactions to it. This cannot be undone.
        </T>
        <ErrorNote message={refused} />
        <Button label="Yes, delete it" kind="danger" onPress={() => void run(onDelete, 'Could not delete the comment.')} busy={busy} />
        <Button label="No, keep it" kind="ghost" small onPress={() => setAsking(false)} disabled={busy} />
      </Sheet>
    );
  }

  return (
    <Sheet title="Your comment" onClose={onClose}>
      {/* A long comment scrolls in its box, so the sheet stays on the screen with the keyboard up. */}
      <Field label="What it says" value={words} onChangeText={setWords} multiline maxLength={COMMENT_MAX} maxHeight={132} />
      <T size={13} color={colors.textMuted} style={{ paddingHorizontal: 4 }}>
        A comment you change says &quot;edited&quot; under it.
      </T>
      <ErrorNote message={refused} />
      <Button label="Save" onPress={() => void run(() => onSave(words), 'Could not save your comment.')} disabled={!changed} busy={busy} />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Delete comment"
        accessibilityState={{ disabled: busy }}
        disabled={busy}
        onPress={() => {
          setRefused(null);
          setAsking(true);
        }}
        style={({ pressed }) => ({ minHeight: 44, alignItems: 'center', justifyContent: 'center', opacity: busy ? 0.45 : pressed ? 0.7 : 1 })}>
        <T size={15} weight="extra" color={colors.danger}>
          Delete comment
        </T>
      </Pressable>
    </Sheet>
  );
}
