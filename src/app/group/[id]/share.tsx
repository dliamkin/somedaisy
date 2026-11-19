import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';

import { CARD, ShareCard } from '@/components/share-card';
import { Button, ErrorNote, Loading, Screen, T, TopBar } from '@/components/ui';
import { fetchIdea, fetchLists, type List, type SharedIdea } from '@/lib/data';
import { lookFor } from '@/lib/looks';
import { shareFileName, shareWords } from '@/lib/share';
import { sharePicture, type CardRef } from '@/lib/share-picture';
import { useTheme } from '@/lib/theme';

/** Share an idea as a picture: shows the card, and hands its picture to the phone's share sheet. */
export default function ShareIdea() {
  const { colors, shadow } = useTheme();
  const { id, idea: ideaId } = useLocalSearchParams<{ id: string; idea?: string }>();
  const [now] = useState(() => new Date());
  const [idea, setIdea] = useState<SharedIdea | null | undefined>(undefined);
  const [lists, setLists] = useState<List[]>([]);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const card: CardRef = useRef(null);

  useEffect(() => {
    if (!id || !ideaId) return;
    // Without the lists the card still works: its icon is guessed and it names no list.
    Promise.all([fetchIdea(ideaId), fetchLists(id).catch(() => [] as List[])]).then(
      ([found, l]) => {
        setLists(l);
        setIdea(found && found.group_id === id ? found : null);
      },
      (e: Error) => {
        setError(e.message);
        setIdea(null);
      },
    );
  }, [id, ideaId]);

  const back = () => (router.canGoBack() ? router.back() : router.replace(`/group/${id}` as never));

  if (idea === undefined && ideaId) return <Loading />;
  if (!idea) {
    return (
      <Screen footer={<Button label="Back to the group" kind="soft" onPress={back} />}>
        <TopBar title="Share" backTo={`/group/${id}`} />
        <ErrorNote message={error} />
        <T weight="medium" color={colors.textMuted}>
          {error ? 'The idea could not be loaded. Check your connection, then try again.' : 'That idea is no longer in the group.'}
        </T>
      </Screen>
    );
  }

  const place = lists.findIndex((l) => l.id === idea.list_id);
  const list = place === -1 ? null : lists[place];

  const share = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    setNote(null);
    try {
      const outcome = await sharePicture(card, shareFileName(idea.title), idea.title);
      if (outcome === 'saved') setNote('The picture was saved to your downloads.');
    } catch (e) {
      setError(e instanceof Error && e.message ? `Could not make the picture. ${e.message}` : 'Could not make the picture.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen footer={<Button label="Share picture" onPress={() => void share()} busy={busy} />}>
      <TopBar title="Share" subtitle="A picture for a chat or a story" backTo={`/group/${id}`} />
      <View style={{ alignItems: 'center', paddingVertical: 8 }}>
        {/* The shadow and rounded corners are on this frame, not on the card, so the picture itself has square corners. */}
        <View style={[{ width: CARD.width, height: CARD.height, borderRadius: 20, backgroundColor: colors.card }, shadow]}>
          <View style={{ borderRadius: 20, overflow: 'hidden' }}>
            <ShareCard cardRef={card} title={idea.title} listName={list?.name ?? null} look={lookFor(list, Math.max(0, place))} words={shareWords(idea, now)} />
          </View>
        </View>
      </View>
      <T size={14} weight="medium" color={colors.textMuted} center>
        Only the idea&apos;s name, its list and its date are on the picture. No names, notes or links.
      </T>
      {/* A picture is easy to mistake for an invitation. It is not one, so say so and offer the real thing. */}
      <View style={{ alignItems: 'center', gap: 2 }}>
        <T size={14} weight="medium" color={colors.textMuted} center>
          A picture cannot let anyone join the group. For that, send the invite link.
        </T>
        <Button label="Invite someone instead" kind="ghost" small onPress={() => router.push(`/group/${id}/invite` as never)} />
      </View>
      {note ? (
        <T size={14} weight="extra" color={colors.good} center>
          {note}
        </T>
      ) : null}
      <ErrorNote message={error} />
    </Screen>
  );
}
