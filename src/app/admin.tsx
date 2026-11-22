import { Unmatched, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';

import { AdminGroupPage, AdminHome, AdminPersonPage } from '@/components/admin';
import { Loading } from '@/components/ui';
import { amAdmin, isId } from '@/lib/admin';
import { useSession } from '@/lib/session';
import { hideFromSearch } from '@/lib/web-page';

/**
 * A page for whoever runs SomeDaisy: how many people and groups there are, who they are, and how
 * far people get. It only shows. Nothing in the app leads here, and search engines are asked to
 * leave it out.
 *
 * Who may see it is decided in the database (supabase/updates/020-admin.sql), which refuses
 * everyone else whatever this page does. To anyone else the address looks like any other that
 * leads nowhere.
 */
export default function Admin() {
  const { ready, userId, email } = useSession();
  const { person, group } = useLocalSearchParams<{ person?: string; group?: string }>();
  // Whether the database said this person is an admin, and which person it said it about.
  const [checked, setChecked] = useState<{ user: string; yes: boolean } | null>(null);

  useEffect(() => hideFromSearch(), []);

  // Only an account can be an admin, so a guest and a visitor are not even asked about.
  const asking = ready && userId && email ? userId : null;
  useEffect(() => {
    if (!asking) return;
    let alive = true;
    void amAdmin().then((yes) => alive && setChecked({ user: asking, yes }));
    return () => {
      alive = false;
    };
  }, [asking]);

  if (!ready) return <Loading />;
  if (!asking) return <Unmatched />;
  if (checked?.user !== asking) return <Loading />;
  if (!checked.yes) return <Unmatched />;
  if (isId(person)) return <AdminPersonPage id={person} />;
  if (isId(group)) return <AdminGroupPage id={group} />;
  return <AdminHome />;
}
