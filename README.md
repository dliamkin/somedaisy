# SomeDaisy

A shared place for friends to collect ideas for things to do, vote on them, and stop forgetting the good ones.
One codebase (Expo / React Native) for the web, Android and iPhone. Supabase is the backend.

This is Phase 1: groups, join by link with just a name, lists, ideas, thumbs and emoji reactions,
the "Everyone's in" moment, and live updates between members.

Phase 2 so far: plans. Any idea can be given a day and a time of day, planned ideas show under
"Coming up" at the top of the group, and marking a plan as done moves it from the lists to
"Things we did", where it can be put back.
And accounts: a guest can add an email to keep their groups and sign in on other devices.

## First-time setup

1. **Database.** In your Supabase project, open the SQL editor, paste in `supabase/schema.sql`, and run it once.
2. **Guest sign-in.** In Supabase under Authentication, turn on **Anonymous sign-ins**.
3. **Settings.** Copy `.env.example` to `.env` and fill in the project URL and the publishable key.
   (If `.env` is already present, this is done.)
4. **Install.** `npm install`

### Email accounts

Everyone starts as a guest. Adding an email turns that guest into an account, so their groups can be
reached from any device. Sign-in is by a code sent to the email, with no passwords. This needs four
things set in the Supabase dashboard under Authentication:

1. **Email provider.** Under Sign In / Providers, turn on **Email**, and turn on **Manual linking**
   (this is what lets a guest gain an email).
2. **Codes in the emails.** Under Emails, edit the **Magic link or OTP** template and the
   **Change email address** template so each shows the code, for example
   `<p>Your SomeDaisy code is {{ .Token }}</p>`. Without this the emails contain a link, which the
   app does not use.
3. **Your own email service.** Under Emails > SMTP Settings, connect an email provider. Supabase's
   built-in sender only delivers to the project's own team members, at two emails an hour, so
   nobody else can receive a code until this is done.
4. **Rate limit.** With your own email service connected, raise the emails-per-hour limit under
   Rate Limits to suit the number of people signing in.

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
| `src/app/account.tsx` | Add an email, sign in, sign out |
| `src/app/join/[code].tsx` | Join by invite link |
| `src/app/group/[id]/index.tsx` | Group page: lists, ideas, reactions |
| `src/app/group/[id]/add.tsx` | Add an idea |
| `src/app/group/[id]/plan.tsx` | Pick a date for an idea |
| `src/app/group/[id]/done.tsx` | Things we did: done ideas, with a way to put one back |
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
