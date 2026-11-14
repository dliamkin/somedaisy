import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { View } from 'react-native';

import { Avatar, Button, Card, ErrorNote, Field, Loading, Screen, T, TopBar } from '@/components/ui';
import { addComment, cleanComment, COMMENT_MAX, fetchComments, removeComment, timeAgo, type Comment } from '@/lib/comments';
import { fetchGroup, markChanged, type Idea, type Member } from '@/lib/data';
import { useSession } from '@/lib/session';
import { supabase } from '@/lib/supabase';
import { colors } from '@/lib/theme';

type Thread = { idea: Idea | null; members: Member[]; comments: Comment[] };

/** The conversation about one idea. */
export default function IdeaComments() {
  const { id, idea: ideaId } = useLocalSearchParams<{ id: string; idea?: string }>();
  const { userId } = useSession();
  const [thread, setThread] = useState<Thread | undefined>(undefined);
  const [now, setNow] = useState(() => new Date());
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const notifyRef = useRef<() => void>(() => {});

  const load = useCallback(async () => {
    if (!id || !ideaId) return;
    try {
      const [group, comments] = await Promise.all([fetchGroup(id), fetchComments(ideaId)]);
      setThread({ idea: group?.ideas.find((i) => i.id === ideaId) ?? null, members: group?.members ?? [], comments });
      setNow(new Date());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load the comments.');
      setThread((current) => current ?? { idea: null, members: [], comments: [] });
    }
  }, [id, ideaId]);

  // Live updates: people reading the same idea ping each other, and everyone reloads.
  useEffect(() => {
    if (!supabase || !ideaId) return;
    const client = supabase;
    const channel = client.channel(`idea:${ideaId}`, { config: { broadcast: { self: false } } });
    channel.on('broadcast', { event: 'changed' }, () => {
      void load();
    });
    channel.subscribe();
    notifyRef.current = () => {
      void channel.send({ type: 'broadcast', event: 'changed', payload: {} });
    };
    return () => {
      notifyRef.current = () => {};
      void client.removeChannel(channel);
    };
  }, [ideaId, load]);

  // Reload when the screen comes into view, and every 20 seconds as a safety net.
  useFocusEffect(
    useCallback(() => {
      void load();
      const timer = setInterval(() => void load(), 20000);
      return () => clearInterval(timer);
    }, [load]),
  );

  // Tell the others, here and on the group page (which shows the comment count).
  const changed = async () => {
    if (id) markChanged(id);
    await load();
    notifyRef.current();
  };

  const send = async () => {
    if (!id || !ideaId || !userId || busy || !cleanComment(text)) return;
    setBusy(true);
    setError(null);
    try {
      await addComment({ groupId: id, ideaId, userId, text });
      setText('');
      await changed();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not send your comment.');
    } finally {
      setBusy(false);
    }
  };

  const remove = async (comment: Comment) => {
    setError(null);
    try {
      await removeComment(comment.id);
      await changed();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not remove the comment.');
    }
  };

  const back = () => (router.canGoBack() ? router.back() : router.replace(`/group/${id}` as never));

  if (thread === undefined) return <Loading />;
  if (!thread.idea || !userId) {
    return (
      <Screen footer={<Button label="Back to the group" kind="soft" onPress={back} />}>
        <TopBar title="Comments" backTo={`/group/${id}`} />
        <ErrorNote message={error} />
        <T weight="medium" color={colors.muted}>
          That idea is no longer in the group.
        </T>
      </Screen>
    );
  }

  const { idea, members, comments } = thread;
  const who = (uid: string) => members.find((m) => m.user_id === uid);

  return (
    <Screen
      footer={
        <>
          <Field
            label="Your comment"
            value={text}
            onChangeText={setText}
            placeholder="Say something about this idea"
            maxLength={COMMENT_MAX}
            onSubmit={send}
          />
          <Button label="Send" onPress={send} disabled={!cleanComment(text)} busy={busy} />
        </>
      }>
      <TopBar title="Comments" backTo={`/group/${id}`} />
      <Card>
        <T size={17} weight="extra">
          {idea.title}
        </T>
        {idea.note ? (
          <T size={14} weight="medium" color={colors.muted}>
            {idea.note}
          </T>
        ) : null}
      </Card>
      <ErrorNote message={error} />

      {comments.length === 0 ? (
        <T weight="medium" color={colors.muted} center style={{ paddingVertical: 24 }}>
          No comments yet. Be the first to say something.
        </T>
      ) : null}

      {comments.map((comment) => {
        const author = who(comment.user_id);
        const mine = comment.user_id === userId;
        return (
          <View key={comment.id} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
            <Avatar name={author?.name ?? '?'} color={author?.color ?? colors.line} />
            <Card style={{ flex: 1, gap: 4, backgroundColor: mine ? colors.today : colors.white }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
                <T size={14} weight="extra" lines={1} style={{ flexShrink: 1 }}>
                  {mine ? 'You' : (author?.name ?? 'Someone who left')}
                </T>
                <T size={12} color={colors.muted}>
                  {timeAgo(comment.created_at, now)}
                </T>
              </View>
              <T size={15} weight="medium">
                {comment.body}
              </T>
              {mine ? (
                <Button label="Remove" kind="ghost" small onPress={() => remove(comment)} style={{ alignSelf: 'flex-start', height: 32, paddingHorizontal: 0 }} />
              ) : null}
            </Card>
          </View>
        );
      })}
    </Screen>
  );
}
