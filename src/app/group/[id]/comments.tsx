import { Image } from 'expo-image';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Pressable, View } from 'react-native';

import { ActionIcon } from '@/components/action-icons';
import { PhotoCredit } from '@/components/cover-credit';
import { Avatar, Button, Card, ErrorNote, Field, Loading, Screen, T, TopBar } from '@/components/ui';
import { addComment, cleanComment, COMMENT_MAX, fetchComments, removeComment, timeAgo, type Comment } from '@/lib/comments';
import { fetchGroup, markChanged, type Idea, type List, type Member } from '@/lib/data';
import { openLink, siteName } from '@/lib/links';
import { gather } from '@/lib/live';
import { PICTURE_SHAPE } from '@/lib/picture-crop';
import { cardCredit, cardPicture } from '@/lib/pictures';
import { formatPlan } from '@/lib/plans';
import { useSession } from '@/lib/session';
import { somedayLabel } from '@/lib/someday';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/lib/theme';

type Thread = { idea: Idea | null; members: Member[]; lists: List[]; comments: Comment[] };

// The corners of the card the idea is shown on, which its picture is cut to.
const RADIUS = 26;

/**
 * An idea's own page: what it is (its picture, its name, who added it, its note, its link and its
 * date), then the conversation about it, with the box to add to that pinned at the bottom.
 * Tapping an idea's card on the group's page opens this.
 */
export default function IdeaComments() {
  const { colors } = useTheme();
  const { id, idea: ideaId } = useLocalSearchParams<{ id: string; idea?: string }>();
  const { userId } = useSession();
  const [thread, setThread] = useState<Thread | undefined>(undefined);
  const [now, setNow] = useState(() => new Date());
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // The picture that would not load, so the card is not left with an empty frame.
  const [broken, setBroken] = useState<string | null>(null);
  const notifyRef = useRef<() => void>(() => {});

  const load = useCallback(async () => {
    if (!id || !ideaId) return;
    try {
      const [group, comments] = await Promise.all([fetchGroup(id), fetchComments(ideaId)]);
      setThread({ idea: group?.ideas.find((i) => i.id === ideaId) ?? null, members: group?.members ?? [], lists: group?.lists ?? [], comments });
      setNow(new Date());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load the comments.');
      setThread((current) => current ?? { idea: null, members: [], lists: [], comments: [] });
    }
  }, [id, ideaId]);

  // Live updates: a signal arrives when a comment here changes, from the database (update 016)
  // and from the phone that wrote it, and the comments are loaded again.
  useEffect(() => {
    if (!supabase || !ideaId) return;
    const client = supabase;
    const reload = gather(() => void load());
    const channel = client.channel(`idea:${ideaId}`, { config: { broadcast: { self: false } } });
    channel.on('broadcast', { event: 'changed' }, reload.ask);
    channel.subscribe();
    notifyRef.current = () => {
      void channel.send({ type: 'broadcast', event: 'changed', payload: {} });
    };
    return () => {
      notifyRef.current = () => {};
      reload.cancel();
      void client.removeChannel(channel);
    };
  }, [ideaId, load]);

  // Reload when the screen comes into view, and every 20 seconds as a safety net.
  useFocusEffect(
    useCallback(() => {
      void load();
      const timer = setInterval(() => void load(), 20000);
      // And when the person comes back to the app or the browser tab, having missed what was sent meanwhile.
      const back = AppState.addEventListener('change', (state) => {
        if (state === 'active') void load();
      });
      return () => {
        clearInterval(timer);
        back.remove();
      };
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
        <T weight="medium" color={colors.textMuted}>
          That idea is no longer in the group.
        </T>
      </Screen>
    );
  }

  const { idea, members, lists, comments } = thread;
  const who = (uid: string) => members.find((m) => m.user_id === uid);
  const shown = cardPicture(idea);
  const picture = shown && broken !== shown ? shown : null;
  // Who to credit, when the picture is a photo found by search.
  const credit = picture ? cardCredit(idea) : null;
  const listName = lists.find((l) => l.id === idea.list_id)?.name ?? null;
  const adder = idea.added_by === userId ? 'you' : (who(idea.added_by ?? '')?.name ?? 'someone');
  // How long it has waited, until it has a date. Then the date is what matters.
  const clock = idea.planned_for ? null : somedayLabel(idea.created_at, now);
  const about = [listName, `Added by ${adder}`, clock].filter(Boolean).join(' · ');
  const link = idea.link;

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
      <Card style={{ padding: 0, gap: 0, borderRadius: RADIUS }}>
        {picture ? (
          <View style={{ aspectRatio: PICTURE_SHAPE, borderTopLeftRadius: RADIUS, borderTopRightRadius: RADIUS, overflow: 'hidden', backgroundColor: colors.background }}>
            <Image source={{ uri: picture }} style={{ width: '100%', height: '100%' }} contentFit="cover" accessibilityLabel={`The picture for ${idea.title}`} onError={() => setBroken(picture)} />
          </View>
        ) : null}
        <View style={{ padding: 14, gap: 6 }}>
          {credit ? <PhotoCredit photo={credit} size={11} lines={1} /> : null}
          <T size={20} weight="black" style={{ lineHeight: 24, letterSpacing: -0.3 }}>
            {idea.title}
          </T>
          <T size={13} color={colors.textMuted}>
            {about}
          </T>
          {idea.planned_for ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <ActionIcon name="date" size={16} color={colors.link} />
              <T size={14} weight="extra" color={colors.link}>
                {formatPlan(idea.planned_for, now)}
              </T>
            </View>
          ) : null}
          {idea.note ? (
            <T size={15} weight="medium">
              {idea.note}
            </T>
          ) : null}
          {link ? (
            <Pressable accessibilityRole="link" accessibilityLabel={`Open the link for ${idea.title}`} onPress={() => openLink(link)} hitSlop={8} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 32 }}>
              <ActionIcon name="link" size={16} />
              <T size={14} color={colors.link} lines={1} style={{ flexShrink: 1, textDecorationLine: 'underline' }}>
                {siteName(link)}
              </T>
            </Pressable>
          ) : null}
        </View>
      </Card>
      <ErrorNote message={error} />

      {comments.length === 0 ? (
        <T weight="medium" color={colors.textMuted} center style={{ paddingVertical: 24 }}>
          No comments yet. Be the first to say something.
        </T>
      ) : null}

      {comments.map((comment) => {
        const author = who(comment.user_id);
        const mine = comment.user_id === userId;
        return (
          <View key={comment.id} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
            <Avatar name={author?.name ?? '?'} color={author?.color ?? colors.line} photo={author?.photo} />
            <Card style={{ flex: 1, gap: 4, backgroundColor: mine ? colors.today : colors.card }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
                <T size={14} weight="extra" lines={1} style={{ flexShrink: 1 }}>
                  {mine ? 'You' : (author?.name ?? 'Someone who left')}
                </T>
                <T size={12} color={colors.textMuted}>
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
