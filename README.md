# SomeDaisy

A shared place for friends to collect ideas for things to do, vote on them, and stop forgetting the good ones.
One codebase (Expo / React Native) for the web, Android and iPhone. Supabase is the backend.

This is Phase 1: groups, join by link with just a name, lists, ideas, thumbs and emoji reactions,
the "Everyone's in" moment, and live updates between members.

Phase 2 so far: plans. Any idea can be given a day and a time of day, planned ideas show under
"Coming up" at the top of the group, and marking a plan as done takes it off the lists.

## First-time setup

1. **Database.** In your Supabase project, open the SQL editor, paste in `supabase/schema.sql`, and run it once.
2. **Guest sign-in.** In Supabase under Authentication, turn on **Anonymous sign-ins**.
3. **Settings.** Copy `.env.example` to `.env` and fill in the project URL and the publishable key.
   (If `.env` is already present, this is done.)
4. **Install.** `npm install`

## Run it

```bash
npm run web        # opens in your browser
npm run android    # needs Android Studio or the Expo Go app on your phone
```

To try it with a friend: start a group, copy the invite link from the Invite screen, and open it in a
private browser window or on another device.

## Where things are

| Path | What it holds |
| --- | --- |
| `src/app/` | Screens. Each file is a page (Expo Router). |
| `src/app/index.tsx` | Welcome (name entry) and Home (your groups) |
| `src/app/new-group.tsx` | Create a group |
| `src/app/join/[code].tsx` | Join by invite link |
| `src/app/group/[id]/index.tsx` | Group page: lists, ideas, reactions |
| `src/app/group/[id]/add.tsx` | Add an idea |
| `src/app/group/[id]/plan.tsx` | Pick a date for an idea |
| `src/app/group/[id]/invite.tsx` | Invite link and members |
| `src/components/` | Shared interface pieces (buttons, cards, logo) |
| `src/lib/` | Theme colors, Supabase client, session, data access, plan dates |
| `supabase/schema.sql` | Tables, access rules and functions |

## Checks

```bash
npx tsc --noEmit         # type-check
npx expo export -p web   # production web build into dist/
```

## Not built yet

Planning and calendar, Done Together, Google / Apple / Facebook sign-in, profile editing, notifications,
dark mode, and the app store builds. See the build plan for the phases.
