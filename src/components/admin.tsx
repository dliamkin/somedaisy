import { useRouter } from 'expo-router';
import { useEffect, useState, type ReactNode } from 'react';
import { Pressable, View } from 'react-native';

import {
  ago,
  barWidth,
  cleanFind,
  countOf,
  coverSays,
  dayOf,
  GROUP_SORTS,
  loadGroup,
  loadGroups,
  loadOverview,
  loadPeople,
  loadPerson,
  NOT_LOADED,
  SEARCH_MAX,
  share,
  signsInWith,
  weekLabel,
  type AdminGroup,
  type AdminPerson,
  type GroupDetail,
  type GroupSort,
  type Listed,
  type Overview,
  type PersonDetail,
} from '@/lib/admin';
import { DEFAULT_AVATAR, useTheme } from '@/lib/theme';

import { Avatar, Button, Card, ErrorNote, Field, Loading, Screen, Segmented, T, TopBar } from './ui';

// The pieces of the admin page (src/app/admin.tsx). They only show what the database hands over,
// and the database hands it over to nobody but an admin (supabase/updates/020-admin.sql).

type Tab = 'overview' | 'people' | 'groups';
const TABS: { key: Tab; label: string }[] = [
  { key: 'overview', label: 'Overview' },
  { key: 'people', label: 'People' },
  { key: 'groups', label: 'Groups' },
];

const said = (e: unknown) => (e instanceof Error ? e.message : NOT_LOADED);
const personPage = (id: string) => `/admin?person=${id}`;
const groupPage = (id: string) => `/admin?group=${id}`;

/** The page itself: the overview, and the lists of people and groups. */
export function AdminHome() {
  const [tab, setTab] = useState<Tab>('overview');
  return (
    <Screen>
      <TopBar title="Admin" subtitle="Only you can see this" backTo="/" />
      <Segmented label="What to look at" options={TABS} value={tab} onChange={setTab} />
      {tab === 'overview' ? <AdminOverview /> : tab === 'people' ? <AdminPeople /> : <AdminGroups />}
    </Screen>
  );
}

// ---------- Small pieces ----------

function Section({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
  const { colors } = useTheme();
  return (
    <Card style={{ padding: 16, gap: 12 }}>
      <View style={{ gap: 2 }}>
        <T size={16} weight="extra">
          {title}
        </T>
        {note ? (
          <T size={13} weight="medium" color={colors.textMuted} style={{ lineHeight: 18 }}>
            {note}
          </T>
        ) : null}
      </View>
      {children}
    </Card>
  );
}

/** Numbers side by side, three to a row, each with what it counts under it. */
function Tiles({ items }: { items: { value: number; label: string }[] }) {
  const { colors } = useTheme();
  const rows: { value: number; label: string }[][] = [];
  for (let at = 0; at < items.length; at += 3) rows.push(items.slice(at, at + 3));
  return (
    <View style={{ gap: 12 }}>
      {rows.map((row) => (
        <View key={row[0].label} style={{ flexDirection: 'row', gap: 8 }}>
          {row.map((item) => (
            <View key={item.label} accessible accessibilityLabel={`${item.label}: ${item.value}`} style={{ flex: 1, minWidth: 0, gap: 1 }}>
              <T size={24} weight="black">
                {item.value.toLocaleString('en-US')}
              </T>
              <T size={12} weight="medium" color={colors.textMuted} style={{ lineHeight: 16 }}>
                {item.label}
              </T>
            </View>
          ))}
          {/* An unfinished row keeps its numbers in line with the rows above. */}
          {Array.from({ length: 3 - row.length }, (_, gap) => (
            <View key={gap} style={{ flex: 1 }} />
          ))}
        </View>
      ))}
    </View>
  );
}

/**
 * One line of a bar chart that is also a table: what is counted, the count, and a bar as long as
 * the count is big beside the others in its set. Every number is written out, so nothing is told
 * by the bar alone.
 */
function BarRow({ label, value, most, note }: { label: string; value: number; most: number; note?: string }) {
  const { colors } = useTheme();
  return (
    <View accessible accessibilityLabel={`${label}: ${value}${note ? `, ${note}` : ''}`} style={{ gap: 5 }}>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
        <T size={14} style={{ flex: 1 }} lines={1}>
          {label}
        </T>
        {note ? (
          <T size={12} weight="medium" color={colors.textMuted}>
            {note}
          </T>
        ) : null}
        <T size={14} weight="extra" style={{ minWidth: 28, textAlign: 'right' }}>
          {value.toLocaleString('en-US')}
        </T>
      </View>
      <View style={{ height: 8, borderRadius: 4, backgroundColor: colors.today, overflow: 'hidden' }}>
        <View style={{ height: 8, borderRadius: 4, backgroundColor: colors.button, width: `${Math.round(barWidth(value, most) * 100)}%` }} />
      </View>
    </View>
  );
}

/** A fact and its value on one line, such as "Joined" and a date. */
function Fact({ label, value }: { label: string; value: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: 'row', gap: 12, justifyContent: 'space-between' }}>
      <T size={14} weight="medium" color={colors.textMuted}>
        {label}
      </T>
      <T size={14} style={{ flexShrink: 1, textAlign: 'right' }}>
        {value}
      </T>
    </View>
  );
}

/** A row that opens something, with a line between it and the next. */
function OpenRow({ label, onPress, last, children }: { label: string; onPress: () => void; last?: boolean; children: ReactNode }) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => ({ paddingVertical: 12, borderBottomWidth: last ? 0 : 1, borderColor: colors.line, opacity: pressed ? 0.7 : 1 })}>
      {children}
    </Pressable>
  );
}

function Quiet({ children }: { children: ReactNode }) {
  const { colors } = useTheme();
  return (
    <T size={13} weight="medium" color={colors.textMuted} style={{ lineHeight: 18 }}>
      {children}
    </T>
  );
}

/** "12 people", or "Showing 50 of 120 people" when there are more than are on show. */
function shown(rows: number, total: number, one: string, many: string): string {
  return rows < total ? `Showing ${rows} of ${total} ${many}` : countOf(total, one, many);
}

// ---------- Overview ----------

function AdminOverview() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let alive = true;
    loadOverview().then(
      (o) => alive && setOverview(o),
      (e: unknown) => alive && setError(said(e)),
    );
    return () => {
      alive = false;
    };
  }, [attempt]);

  if (error) {
    return (
      <>
        <ErrorNote message={error} />
        <Button
          label="Try again"
          kind="outline"
          small
          onPress={() => {
            setError(null);
            setAttempt((n) => n + 1);
          }}
        />
      </>
    );
  }
  if (!overview) return <Loading />;

  const { totals, week, weeks, funnel, lasting, covers } = overview;
  const mostInAWeek = Math.max(...weeks.map((w) => w.people), 0);
  const mostCovers = Math.max(covers.classic, covers.look, covers.uploaded, covers.searched);
  return (
    <>
      <Section title="Now">
        <Tiles
          items={[
            { value: totals.people, label: 'People' },
            { value: totals.groups, label: 'Groups' },
            { value: totals.ideas, label: 'Ideas' },
            { value: totals.accounts, label: 'With an account' },
            { value: totals.guests, label: 'Guests' },
            { value: totals.phones, label: 'With notifications on' },
            { value: totals.plans, label: 'Plans coming up' },
            { value: totals.done, label: 'Things done' },
            { value: totals.comments, label: 'Comments' },
          ]}
        />
      </Section>
      <Section title="Last 7 days" note="A person or group is active when an idea was added, someone reacted, commented or joined, or something was done.">
        <Tiles
          items={[
            { value: week.new_people, label: 'New people' },
            { value: week.new_groups, label: 'New groups' },
            { value: week.ideas, label: 'Ideas added' },
            { value: week.active_people, label: 'Active people' },
            { value: week.active_groups, label: 'Active groups' },
            { value: week.done, label: 'Things done' },
          ]}
        />
      </Section>
      <Section title="New people each week" note="The last eight weeks. A week starts on Monday.">
        {weeks.map((w) => (
          <BarRow key={w.start} label={`Week of ${weekLabel(w.start)}`} value={w.people} most={mostInAWeek} note={w.groups > 0 ? countOf(w.groups, 'new group', 'new groups') : undefined} />
        ))}
      </Section>
      <Section title="How far people get" note="Out of everyone who has picked a name.">
        <BarRow label="Picked a name" value={funnel.named} most={funnel.named} />
        <BarRow label="Are in a group" value={funnel.in_group} most={funnel.named} note={share(funnel.in_group, funnel.named)} />
        <BarRow label="Added an idea" value={funnel.added_idea} most={funnel.named} note={share(funnel.added_idea, funnel.named)} />
        <BarRow label="Are in a group that did something" value={funnel.did_one} most={funnel.named} note={share(funnel.did_one, funnel.named)} />
      </Section>
      <Section title="Sharing and lasting">
        <Fact label="Groups with two or more people" value={`${totals.shared_groups} of ${totals.groups} (${share(totals.shared_groups, totals.groups)})`} />
        <Fact label="People who joined with an invite" value={String(overview.invited)} />
        <Fact label="Groups made four weeks ago or more" value={String(lasting.old_groups)} />
        <Fact label="Still used four weeks after they were made" value={`${lasting.still_used} (${share(lasting.still_used, lasting.old_groups)})`} />
      </Section>
      <Section title="Covers and pictures">
        <BarRow label="A classic colour" value={covers.classic} most={mostCovers} />
        <BarRow label="A three-colour look" value={covers.look} most={mostCovers} />
        <BarRow label="An uploaded photo" value={covers.uploaded} most={mostCovers} />
        <BarRow label="A photo from search" value={covers.searched} most={mostCovers} />
        <Fact label="Ideas with a picture of their own" value={String(overview.idea_pictures)} />
        <Fact label="Reactions" value={totals.reactions.toLocaleString('en-US')} />
      </Section>
      <Quiet>This page only shows. To change or remove anything, use the Supabase dashboard.</Quiet>
    </>
  );
}

// ---------- People ----------

function PersonLine({ person }: { person: AdminPerson }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      <Avatar name={person.name} color={person.color || DEFAULT_AVATAR} size={36} />
      <View style={{ flex: 1, minWidth: 0, gap: 1 }}>
        <T size={15} weight="extra" lines={1}>
          {person.name}
        </T>
        <T size={13} weight="medium" color={colors.textMuted} lines={1}>
          {person.email ?? 'Guest'}
        </T>
        <T size={12} weight="medium" color={colors.textMuted} lines={1}>
          {`Joined ${dayOf(person.joined)} · ${countOf(person.groups, 'group', 'groups')} · ${countOf(person.ideas, 'idea', 'ideas')}`}
        </T>
      </View>
    </View>
  );
}

function AdminPeople() {
  const router = useRouter();
  const [typed, setTyped] = useState('');
  // What the list on show was searched for.
  const [asked, setAsked] = useState('');
  const [found, setFound] = useState<Listed<AdminPerson> | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    loadPeople('')
      .then(
        (first) => alive && setFound(first),
        (e: unknown) => alive && setError(said(e)),
      )
      .finally(() => alive && setBusy(false));
    return () => {
      alive = false;
    };
  }, []);

  // A new search starts the list again. "Show more" adds to the one on show.
  const load = async (search: string, after: AdminPerson[]) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const next = await loadPeople(search, after.length);
      const have = new Set(after.map((p) => p.id));
      setFound({ rows: [...after, ...next.rows.filter((p) => !have.has(p.id))], total: next.total });
      setAsked(search);
    } catch (e) {
      setError(said(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Field
        label="Find a person"
        value={typed}
        onChangeText={setTyped}
        placeholder="Name or email"
        maxLength={SEARCH_MAX}
        onSubmit={() => void load(typed, [])}
        after={<Button label="Search" small onPress={() => void load(typed, [])} busy={busy && found !== null} />}
      />
      <ErrorNote message={error} />
      {!found ? (
        busy ? (
          <Loading />
        ) : null
      ) : (
        <>
          <Quiet>
            {found.rows.length === 0 ? `Nobody found${cleanFind(asked) ? ` for "${cleanFind(asked)}"` : ''}.` : `${shown(found.rows.length, found.total, 'person', 'people')}, newest first.`}
          </Quiet>
          {found.rows.length > 0 ? (
            <Card style={{ paddingVertical: 2, paddingHorizontal: 14, gap: 0 }}>
              {found.rows.map((person, i) => (
                <OpenRow key={person.id} label={`Open ${person.name}`} onPress={() => router.push(personPage(person.id) as never)} last={i === found.rows.length - 1}>
                  <PersonLine person={person} />
                </OpenRow>
              ))}
            </Card>
          ) : null}
          {found.rows.length < found.total ? <Button label="Show more" kind="outline" small onPress={() => void load(asked, found.rows)} busy={busy} /> : null}
        </>
      )}
    </>
  );
}

// ---------- Groups ----------

function AdminGroups() {
  const router = useRouter();
  const [sort, setSort] = useState<GroupSort>('busy');
  const [typed, setTyped] = useState('');
  const [asked, setAsked] = useState('');
  const [found, setFound] = useState<Listed<AdminGroup> | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [now] = useState(() => new Date());

  useEffect(() => {
    let alive = true;
    loadGroups('busy', '')
      .then(
        (first) => alive && setFound(first),
        (e: unknown) => alive && setError(said(e)),
      )
      .finally(() => alive && setBusy(false));
    return () => {
      alive = false;
    };
  }, []);

  const load = async (order: GroupSort, search: string, after: AdminGroup[]) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const next = await loadGroups(order, search, after.length);
      const have = new Set(after.map((g) => g.id));
      setFound({ rows: [...after, ...next.rows.filter((g) => !have.has(g.id))], total: next.total });
      setAsked(search);
      setSort(order);
    } catch (e) {
      setError(said(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Segmented label="Which groups come first" options={GROUP_SORTS} value={sort} onChange={(order) => void load(order, asked, [])} />
      <Field
        label="Find a group"
        value={typed}
        onChangeText={setTyped}
        placeholder="Group name"
        maxLength={SEARCH_MAX}
        onSubmit={() => void load(sort, typed, [])}
        after={<Button label="Search" small onPress={() => void load(sort, typed, [])} busy={busy && found !== null} />}
      />
      <ErrorNote message={error} />
      {!found ? (
        busy ? (
          <Loading />
        ) : null
      ) : (
        <>
          <Quiet>
            {found.rows.length === 0
              ? `No groups found${cleanFind(asked) ? ` for "${cleanFind(asked)}"` : ''}.`
              : `${shown(found.rows.length, found.total, 'group', 'groups')}. ${sort === 'busy' ? 'The most going on in the last four weeks comes first.' : sort === 'new' ? 'The newest comes first.' : 'The most people comes first.'}`}
          </Quiet>
          {found.rows.length > 0 ? (
            <Card style={{ paddingVertical: 2, paddingHorizontal: 14, gap: 0 }}>
              {found.rows.map((group, i) => (
                <OpenRow key={group.id} label={`Open ${group.name}`} onPress={() => router.push(groupPage(group.id) as never)} last={i === found.rows.length - 1}>
                  <View style={{ gap: 1 }}>
                    <T size={15} weight="extra" lines={1}>
                      {group.name}
                    </T>
                    <Quiet>{`${countOf(group.members, 'person', 'people')} · ${countOf(group.ideas, 'idea', 'ideas')} · ${group.done} done · ${countOf(group.points, 'point', 'points')}`}</Quiet>
                    <Quiet>{`Made ${dayOf(group.created_at)} · Last used: ${ago(group.last_active, now).toLowerCase()}`}</Quiet>
                  </View>
                </OpenRow>
              ))}
            </Card>
          ) : null}
          {found.rows.length < found.total ? <Button label="Show more" kind="outline" small onPress={() => void load(sort, asked, found.rows)} busy={busy} /> : null}
        </>
      )}
    </>
  );
}

// ---------- One person, one group ----------

/** What a page about one person or group shows while it loads, when it fails, and when there is nothing there. */
function Detail({ title, loading, error, missing, children }: { title: string; loading: boolean; error: string | null; missing: string | null; children: ReactNode }) {
  return (
    <Screen>
      <TopBar title={title} backTo="/admin" />
      <ErrorNote message={error} />
      {error ? null : loading ? <Loading /> : missing ? <Quiet>{missing}</Quiet> : children}
    </Screen>
  );
}

export function AdminPersonPage({ id }: { id: string }) {
  const router = useRouter();
  const { colors } = useTheme();
  const [loaded, setLoaded] = useState<{ id: string; person: PersonDetail | null } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [now] = useState(() => new Date());

  useEffect(() => {
    let alive = true;
    loadPerson(id).then(
      (person) => alive && setLoaded({ id, person }),
      (e: unknown) => alive && setError(said(e)),
    );
    return () => {
      alive = false;
    };
  }, [id]);

  const person = loaded?.id === id ? loaded.person : null;
  return (
    <Detail title={person?.name ?? 'Person'} loading={loaded?.id !== id} error={error} missing={person ? null : 'There is nobody here. They may have deleted their account.'}>
      {person ? (
        <>
          <Card style={{ padding: 16, gap: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <Avatar name={person.name} color={person.color || DEFAULT_AVATAR} size={48} />
              <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                <T size={18} weight="extra" lines={1}>
                  {person.name}
                </T>
                <T size={14} weight="medium" color={colors.textMuted}>
                  {person.email ?? 'A guest, with no email'}
                </T>
              </View>
            </View>
            <Fact label="Signs in with" value={signsInWith(person)} />
            <Fact label="Joined" value={dayOf(person.joined)} />
            {person.guest ? null : <Fact label="Last signed in" value={person.last_sign_in ? `${dayOf(person.last_sign_in)} (${ago(person.last_sign_in, now).toLowerCase()})` : 'Not known'} />}
            <Fact label="Last did something" value={ago(person.last_active, now)} />
          </Card>
          <Section title="What they have added">
            <Tiles
              items={[
                { value: person.ideas, label: 'Ideas' },
                { value: person.reactions, label: 'Reactions' },
                { value: person.comments, label: 'Comments' },
              ]}
            />
            <Fact label="Phones with notifications on" value={String(person.phones)} />
          </Section>
          <Section title={person.in.length === 0 ? 'In no groups' : `In ${countOf(person.in.length, 'group', 'groups')}`}>
            {person.in.length > 0 ? (
              <View>
                {person.in.map((group, i) => (
                  <OpenRow key={group.id} label={`Open ${group.name}`} onPress={() => router.push(groupPage(group.id) as never)} last={i === person.in.length - 1}>
                    <View style={{ gap: 1 }}>
                      <T size={15} weight="extra" lines={1}>
                        {group.name}
                      </T>
                      <Quiet>{`${countOf(group.members, 'person', 'people')} · ${group.started ? 'Started it' : 'Joined'} ${dayOf(group.joined)}`}</Quiet>
                    </View>
                  </OpenRow>
                ))}
              </View>
            ) : null}
          </Section>
          <Quiet>{`To change or remove this account, find it in the Supabase dashboard by this id: ${person.id}`}</Quiet>
        </>
      ) : null}
    </Detail>
  );
}

export function AdminGroupPage({ id }: { id: string }) {
  const router = useRouter();
  const [loaded, setLoaded] = useState<{ id: string; group: GroupDetail | null } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [now] = useState(() => new Date());

  useEffect(() => {
    let alive = true;
    loadGroup(id).then(
      (group) => alive && setLoaded({ id, group }),
      (e: unknown) => alive && setError(said(e)),
    );
    return () => {
      alive = false;
    };
  }, [id]);

  const group = loaded?.id === id ? loaded.group : null;
  return (
    <Detail title={group?.name ?? 'Group'} loading={loaded?.id !== id} error={error} missing={group ? null : 'There is no group here. It may have been deleted.'}>
      {group ? (
        <>
          <Section title="This group">
            <Tiles
              items={[
                { value: group.members.length, label: 'People' },
                { value: group.ideas, label: 'Ideas' },
                { value: group.plans, label: 'Plans coming up' },
                { value: group.done, label: 'Things done' },
                { value: group.points, label: 'Points' },
                { value: group.comments, label: 'Comments' },
              ]}
            />
            <Fact label="Made" value={dayOf(group.created_at)} />
            <Fact label="Last used" value={ago(group.last_active, now)} />
            <Fact label="Reactions" value={String(group.reactions)} />
            <Fact label="Cover" value={coverSays(group.cover)} />
          </Section>
          <Section title={countOf(group.members.length, 'person', 'people')}>
            <View>
              {group.members.map((member, i) => (
                <OpenRow key={member.id} label={`Open ${member.name}`} onPress={() => router.push(personPage(member.id) as never)} last={i === group.members.length - 1}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    <Avatar name={member.name} color={member.color || DEFAULT_AVATAR} size={32} />
                    <View style={{ flex: 1, minWidth: 0, gap: 1 }}>
                      <T size={15} weight="extra" lines={1}>
                        {member.name}
                      </T>
                      <Quiet>{`${member.guest ? 'Guest · ' : ''}${member.started ? 'Started it' : 'Joined'} ${dayOf(member.joined)}`}</Quiet>
                    </View>
                  </View>
                </OpenRow>
              ))}
            </View>
          </Section>
          <Section title={countOf(group.lists.length, 'list', 'lists')}>
            {group.lists.map((list) => (
              <Fact key={list.id} label={list.name} value={countOf(list.ideas, 'idea', 'ideas')} />
            ))}
          </Section>
          <Quiet>{`To change or remove this group, find it in the Supabase dashboard by this id: ${group.id}`}</Quiet>
        </>
      ) : null}
    </Detail>
  );
}
