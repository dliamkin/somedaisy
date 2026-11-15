# SomeDaisy

A shared place for friends to collect ideas for things to do, vote on them, and stop forgetting the good ones.
One codebase (Expo / React Native) for the web, Android and iPhone. Supabase is the backend.

This is Phase 1: groups, join by link with just a name, lists, ideas, thumbs and emoji reactions,
the "Everyone's in" moment, and live updates between members.

Phase 2 so far: plans. Any idea can be given a day and a time of day, planned ideas show under
"Coming up" at the top of the group, and marking a plan as done moves it from the lists to
"Things we did", where it can be put back.
And accounts: a guest can add an email, or continue with Google on the website, to keep their groups and sign in on other devices.
And push notifications on phones, kept deliberately few: a reaction to or comment on an idea you
added, and a reminder before a plan. Each person can switch any of them off.
And comments: every idea has a conversation any member of the group can add to.

## First-time setup

1. **Database.** In your Supabase project, open the SQL editor, paste in `supabase/schema.sql`, and run it once.
   Then run each file in `supabase/updates/` in number order. Each says at the top what it needs,
   and is safe to run again.
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
   `<p>Your SomeDaisy code is {{ .Token }}</p>`. The templates in use are kept in `supabase/emails/`. Without this the emails contain a link, which the
   app does not use.
3. **Your own email service.** Under Emails > SMTP Settings, connect an email provider. Supabase's
   built-in sender only delivers to the project's own team members, at two emails an hour, so
   nobody else can receive a code until this is done.
4. **Rate limit.** With your own email service connected, raise the emails-per-hour limit under
   Rate Limits to suit the number of people signing in.

When someone who has been using a phone as a guest signs in to an account they already have, the
guest's groups, ideas and reactions move into the account. That needs
`supabase/updates/002-account-transfer.sql` to have been run; without it sign-in still works, but
the guest's groups stay behind and the app says so.

### Google sign-in

On the website, the account screen also offers **Continue with Google**, using Google's own button.
It signs in to the account with that Google address, creating one the first time, and brings the
groups of the guest on this device along (the same move as above, so it needs update 002). Someone
who already has an email account with the same address lands in that same account. Phones do not
offer it yet.

It needs three things set up once:

1. **Google.** In the Google Cloud console, open Google Auth Platform, fill in the branding and
   audience pages, then create an OAuth client of type **Web application**. Under Authorized
   JavaScript origins add `https://somedaisy.com` (and `http://localhost:8081` to try it locally).
2. **Supabase provider.** Under Authentication > Sign In / Providers > Google, turn it on, paste in
   the client ID and client secret from step 1, and add the same client ID under **Client IDs**.
   Leave "Skip nonce check" off. The secret goes nowhere else.
3. **Settings.** Put the client ID in `.env` as `EXPO_PUBLIC_GOOGLE_CLIENT_ID`. It is a public
   value. Without it the button is not shown.

Someone signed in with Google has their Google picture as their circle, in place of their initial,
and friends in their groups see it too. They can switch it off where they change their name. This
needs `supabase/updates/004-profile-photo.sql`; without it everyone keeps their initial.

### Push notifications

Only three things send a notification: someone else reacting to an idea you added (one per person
per ten minutes, however many emoji they tap), someone else commenting on an idea you added (again
one per person per ten minutes, unless you have answered in between), and a reminder to the group
about two hours before a plan. Adding ideas and picking dates stay quiet. Comments need
`supabase/updates/003-comments.sql`. Each person can switch any kind off under
Notification settings, reached from the home screen or the account screen; the choice follows them
to every phone. The database sends the notifications through Expo's push service; there is no
separate server to run.

Notifications only work in a built copy of the app on Android or iPhone. They do not work on the
web or inside Expo Go; there the app simply does not offer them.

1. **Database.** In Supabase under Database > Extensions, turn on **pg_net** and **pg_cron**. Then
   run `supabase/updates/001-push-notifications.sql` in the SQL editor.
2. **Expo project.** Run `npx eas-cli@latest init` and sign in to (or create) an Expo account. This
   adds a project ID to `app.json`, which the app needs to get a phone's push address. Commit that change.
3. **Android.** Create a Firebase project and add an Android app to it with the same package name
   the build uses. Download its `google-services.json` into this folder and point
   `expo.android.googleServicesFile` in `app.json` at it. Then, in Firebase under Project settings >
   Service accounts, generate a private key and upload it with `npx eas-cli@latest credentials`
   (Android > Google Service Account > FCM V1). Keep that key file out of git.
4. **iPhone.** Needs a paid Apple Developer account. The first `eas build` for iOS offers to set up
   push notifications and create the key; say yes to both.
5. **Build.** `npx eas-cli@latest build --profile preview --platform android` (or `ios`) makes an
   installable app. The first run asks a few questions and creates `eas.json`.

To check it end to end: install the build on two phones, join the same group, turn on notifications
on both from the home screen, add an idea on one and react to it on the other. Expo's push tool at
https://expo.dev/notifications can also send a test to a single phone.

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
| `src/app/account.tsx` | Add an email, continue with Google, sign in, sign out |
| `src/app/notifications.tsx` | Choose which notifications to get |
| `src/app/profile.tsx` | Change your name and colour, and show or hide your Google photo |
| `src/app/join/[code].tsx` | Join by invite link |
| `src/app/group/[id]/index.tsx` | Group page: lists, ideas, reactions |
| `src/app/group/[id]/add.tsx` | Add an idea |
| `src/app/group/[id]/plan.tsx` | Pick a date for an idea |
| `src/app/group/[id]/comments.tsx` | The conversation about an idea |
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
