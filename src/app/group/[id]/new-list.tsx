import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';

import { ListLookPicker, type LookChoice } from '@/components/list-look-picker';
import { ListOptionsPicker } from '@/components/list-options-picker';
import { Button, Card, ErrorNote, Field, Loading, Screen, TopBar } from '@/components/ui';
import { addList, fetchLists, keepsListOptions, markChanged, NO_LIST_OPTIONS, openList, type List } from '@/lib/data';
import { ALL_ON, type ListOptions } from '@/lib/list-options';

/**
 * Make a list, on a page of its own: its name, what kind of list it is, and how it looks. The
 * page shuts with the X, or by adding the list, and the group then shows the new list.
 */
export default function NewList() {
  const { id } = useLocalSearchParams<{ id: string }>();
  // The group's lists so far: the new one goes after them, and takes the next colour along.
  const [lists, setLists] = useState<List[] | null>(null);
  const [name, setName] = useState('');
  const [options, setOptions] = useState<ListOptions>(ALL_ON);
  const [look, setLook] = useState<LookChoice>({ icon: null, color: null });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    fetchLists(id).then(setLists, (e: Error) => {
      setError(e.message);
      setLists([]);
    });
  }, [id]);

  const back = () => (router.canGoBack() ? router.back() : router.replace(`/group/${id}` as never));

  const save = async () => {
    const clean = name.trim();
    if (!id || !lists || !clean || busy) return;
    setBusy(true);
    setError(null);
    try {
      await addList(id, clean, lists.length + 1, look, options);
      markChanged(id);
      // The group page opens the new list.
      openList(id, { name: clean });
      back();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not add the list.');
      setBusy(false);
    }
  };

  if (lists === null) return <Loading />;

  return (
    <Screen footer={<Button label="Add list" onPress={() => void save()} disabled={!name.trim()} busy={busy} />}>
      <TopBar title="New list" backTo={`/group/${id}`} close />
      {/* The keyboard does not open by itself, so the whole form shows first. Its Done key only
          puts the keyboard away: the list is added with the button pinned at the bottom. */}
      <Field label="List name" value={name} onChangeText={setName} placeholder="Shows, Games, Band names..." maxLength={40} />
      {/* Said before anything is chosen, where it can be told: the lists there are carry no kind. */}
      {keepsListOptions(lists) === false ? <ErrorNote message={`${NO_LIST_OPTIONS} Until it is run, every list is a list of things to do.`} /> : null}
      <Card>
        <ListOptionsPicker fresh value={options} onChange={setOptions} />
      </Card>
      <Card>
        <ListLookPicker name={name} place={lists.length} value={look} onChange={setLook} />
      </Card>
      <ErrorNote message={error} />
    </Screen>
  );
}
