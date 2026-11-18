# SomeDaisy

A shared place for friends to collect ideas for things to do, vote on them, and stop forgetting the good ones.
One codebase (Expo / React Native) for the web, Android and iPhone. Supabase is the backend.

Phase 1: groups, join by link with just a name, lists, ideas, thumbs and emoji reactions,
the "Everyone's in" moment, and live updates between members.

Phase 2 so far: plans. Any idea can be given a day and a time of day, planned ideas show under
"Coming up" at the top of the group, and marking a plan as done moves it from the lists to
"Things we did" and earns the group points and a stamp.
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

The account screen also offers **Continue with Google**: on the website with Google's own button,
in the Android app with Android's account sheet. It signs in to the account with that Google address, creating one the first time, and brings the
groups of the guest on this device along (the same move as above, so it needs update 002). Someone
who already has an email account with the same address lands in that same account. iPhones do not
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
4. **Android app.** In the same Google Cloud project, create a second OAuth client of type
   **Android** with the package name `com.somedaisy.app` and the SHA-1 fingerprint of the key the
   build is signed with (`npx eas-cli@latest credentials -p android` shows it). Nothing from it
   goes into the code: the app keeps using the Web client ID from step 3, and Google only checks
   that this one exists. Without it the account sheet closes as if the person had cancelled. An
   app installed from the Play Store is signed with a different key, so it will need one more
   Android client with that key's SHA-1 (Play Console > Setup > App signing).

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
2. **Expo project.** Create a free account at expo.dev, then run `npx eas-cli@latest login` and
   `npx eas-cli@latest init`. This adds a project ID and owner to `app.json`, which the app needs
   to get a phone's push address. Commit that change.
3. **Android.** Create a Firebase project and add an Android app to it with the package name
   `com.somedaisy.app` (the one in `app.json`). Download its `google-services.json` into this
   folder, next to `app.json`, and commit it; it holds only public identifiers. Then, in Firebase
   under Project settings > Service accounts, generate a private key and upload it at expo.dev
   under the project's Credentials > Android > FCM V1 service account key. That key is a secret:
   keep it out of this folder and out of git.
4. **iPhone.** Needs a paid Apple Developer account. The first `eas build` for iOS offers to set up
   push notifications and create the key; say yes to both.
5. **Build.** `npx eas-cli@latest build --profile preview --platform android` makes an APK that
   installs straight onto a phone from the link or QR code it prints. The first run offers to
   create a signing key; say yes. Builds are set up in `eas.json`. `.env` is sent along with the
   project (see `.easignore`), so the build talks to the same Supabase project as the website.

The small picture in a notification is `assets/images/notification-icon.png`, which has to be
all white on a see-through background. It and the app icon are part of the build, so changing
either needs a new one.

With `supabase/updates/010-notification-polish.sql`, each person can mute a single group from
its settings (no notifications from that group, for them only), and tapping a notification
about a comment opens that idea's comments instead of the group.

To check it end to end: install the build on two phones, join the same group, turn on notifications
on both from the home screen, add an idea on one and react to it on the other. Expo's push tool at
https://expo.dev/notifications can also send a test to a single phone.

### Invite links that open the app

An invite link is a web address, `https://somedaisy.com/join/<code>`. On an Android phone with the
app installed it opens the app; everywhere else it opens the website. Two things make that work,
and they have to agree:

- `intentFilters` in `app.json` tells Android the app handles `somedaisy.com/join/` links.
- `public/.well-known/assetlinks.json` is the website saying which app may do so. It names the
  package and the SHA-256 fingerprint of the key the build is signed with.

Android checks the website when the app is installed, so publish the website
(`npm run deploy:web`) before installing a new build. A Play Store build is signed with a
different key; add that key's SHA-256 to the list in `assetlinks.json` when the time comes.

### Privacy policy

The policy is the page at `https://somedaisy.com/privacy`, linked from the welcome and account
screens. That address is the one to give the Play Store and Google's sign-in branding page. Its
words live in `src/lib/privacy.ts`: when the app starts keeping something new, or sends
information to a new company, update them in the same change and move the date forward.

It promises one thing that needs doing by hand: mail sent to `hello@somedaisy.com` has to reach
someone (Cloudflare > Email > Email Routing can forward it).

### Deleting an account

The account screen has **Delete my account** (for a guest, **Delete my data**), with a second
step to confirm. It needs `supabase/updates/005-delete-account.sql`; without it the app says the
account could not be deleted. It removes the person's sign-in, name, email, picture, memberships,
reactions, comments and notification details. Ideas they added stay in the group with no name on
them, and a group where they were the only member is deleted. The website has the same button, so
`https://somedaisy.com/account` is the address to give the Play Store as the way to delete an
account outside the app.

Someone who cannot get in can still ask by email; delete them in Supabase under Authentication >
Users, which removes the same things.

### Links on ideas

A link on an idea has to be a web address. The app adds a missing `https://` and asks the
person to fix anything else. `supabase/updates/006-idea-links.sql` makes the database tidy
links the same way, for older copies of the app that send them as typed: what cannot be made
into a web address is dropped, and the idea is saved without a link. It also tidies links saved
before it. Without that update the app still tidies new links; the database just does not.

### Group settings

Any member can rename a group, change its cover, rename its lists and leave. The group's owner
can also remove someone and replace the invite link, which stops the old link working. The
owner is whoever started the group, or, once they have gone, whoever has been in it longest.
Leaving, removing and replacing the link need `supabase/updates/007-group-settings.sql`; without
it the app says they are not available yet.

### Link previews

An idea with a link shows that page's preview picture on its card: the same picture a chat app
shows for the link. Only the picture's web address is saved, never the picture. It needs two
things, and without either the app simply shows no pictures:

1. **Database.** Run `supabase/updates/011-link-previews.sql`.
2. **Server-side helper.** A browser cannot read another site's page, so a small helper on
   Supabase does it. In the Supabase dashboard open **Edge Functions**, choose **Deploy a new
   function**, then **Via Editor**. Name it exactly `link-preview`, replace the sample code with
   the whole of `supabase/functions/link-preview/index.ts`, and press **Deploy function**. It needs
   no keys or settings. To change it later, paste the new version and press **Deploy updates**
   (the dashboard keeps no history; this repository is the record).

The helper only answers signed-in people, only reads ordinary web addresses (never addresses
inside Supabase's own network), and returns nothing but a picture's address. Its rules are
tested in `src/lib/__tests__/link-preview-test.ts`. The picture is looked up in the background
While a link is being typed on the form for an idea, the picture is looked up once the typing
pauses and shown under the link box, so the person knows what the card will get. On saving, a
picture found that way is used as it is; otherwise it is looked up in the background and
appears on the card a few seconds later. A page with no picture, or a picture that will not
load, leaves the card as it was.

### Guests

Nobody is signed in just for opening the app or the website. A person becomes a guest when
they pick a name or open an invite link, so visitors who only look leave nothing behind.
`supabase/updates/009-guest-cleanup.sql` adds a daily job that removes guests who never picked
a name and are more than 30 days old (older copies of the app made one for every visitor).
Guests with a name, and accounts with an email, are never removed by it.

### Points, stamps and the do-again shelf

Marking a plan as done opens one "You did it" screen: the points it earned, the stamp, a new
title if the group reached one, and the question "Would you do it again?". Each group has one
shared bar and rises through eight titles, from Homebodies to Legends (shown in the app as the
group's rank). The bar sits under the
group's name, the title shows on the home screen, and the stamps page lists everything done.
A stamp has the icon and colour its list has today (`stampLook` in `src/lib/looks.ts`); if the
list has been removed, both are worked out from the name the list had.

Points come only from doing things: 10 for an idea (5 for a repeat), 5 for everyone being there
(always given for now; the app does not ask who came), 5 for the first thing done from a list,
and 10 if the idea had waited more than 90 days. They never go down. The database works them
out when an idea is marked as done, so older copies of the app earn them too. The numbers live
in `supabase/updates/008-you-did-it.sql`, and the titles in `src/lib/points.ts`.

When everyone in a group says they would do something again, it goes on the do-again shelf in
Things we did. "Do it again" there puts it back on its list, to be planned and done once more.
That is the only way a done idea goes back, apart from undo.

A "We did it" tapped by mistake can be undone for 10 minutes, from the celebration screen or from
Things we did, by anyone in the group. The idea returns to its list and the points and stamp it
has just earned are removed. This is the one case where points go down, and it needs
`supabase/updates/013-undo-done.sql`; without it the app says undo is not set up yet.

All of this needs update 008. Without it the app works as before: no bar, no stamps, and done
ideas keep their plain "Put it back on the list".

### Shareable idea cards

"Share" on an idea's card, and "Share as a picture" in Things we did, open a card with the idea's
name, its list and its date: "We're finally doing this" for a plan, "We did it!" for something
done, "Who's in?" otherwise (`src/lib/share.ts`). An idea with no date that was added today says
"On our someday list", so the card is never bare. No names, notes or links are on it. The
picture is made on the device, 1080 by 1350, and nothing is uploaded or stored
(`src/lib/share-picture.ts`). In the app it goes to the phone's share sheet through
`react-native-view-shot` and `expo-sharing`, which are native code, so this needs a build made
after they were added. On the website it goes to the browser's share sheet where there is one,
and is saved as a download otherwise.

### What each list asks for

Every idea needs a name, and nothing else. Each list says whether its ideas can be given a date,
and whether the form for a new idea shows the link box and the note box. Movies, Places and Food
want all of that; a list such as "Song titles" can be a list of names only. The choices are made
when adding a list and changed under Group settings, by any member. They need
`supabase/updates/015-list-options.sql`; without it every list has everything turned on, as
before. Turning something off only changes what the app offers: an idea that already has a
date, a link or a note keeps it, and can still have it changed or taken off. The rules are in
`src/lib/list-options.ts`.

### Live updates

When someone changes something in a group, the others looking at that group see it without
refreshing. The group's page listens on a channel of Supabase's Realtime for a "something
changed" signal and loads the group again when one arrives. The signal carries no data, so who
may read what is still decided by the usual loading.

The signal is sent twice over. The database sends it as part of saving any change to the group
(`supabase/updates/016-live-updates.sql`), so it does not depend on the phone that made the
change. That phone also sends one itself, which is all there is until update 016 is run.
Signals that arrive together are answered with one load (`src/lib/live.ts`).

A phone or a browser tab stops listening while it is in the background, so the group is also
loaded again when the person comes back to it, and every 20 seconds while it is open. If
Realtime is turned off or unreachable, nothing breaks: changes still save, and the 20 seconds
is the fallback. The channels are public ones, so Realtime must allow public access (Supabase
dashboard, Realtime, Settings).

### Inviting people

Making a group has two steps: name it, then invite people. The second step is the Invite
screen with one big button, which hands the invite link to the phone's share sheet (or copies
it, in a browser without one), and a small "Skip for now". While a group has only one person
in it, its page shows a card saying so with an "Invite" button. The screen for sharing an idea
as a picture says that a picture cannot let anyone join, and links to the Invite screen.

### Pick for us

For when the group is free and cannot decide. "Pick for us" on a group's page asks how much time
there is, staying in or going out, and which list, then picks one idea by chance from those
everyone is in on that have no date yet. It can also take in ideas still waiting on someone, but
never one somebody said "Eh" to. The rules are in `src/lib/pick.ts`.

An idea can carry two optional tags, set when adding or editing it: how long it takes and
staying in or going out. An idea without a tag is never left out because of it. The tags need
`supabase/updates/014-idea-tags.sql`; without it the screen still works, on every idea, and
tags chosen on the forms are simply not kept.

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
| `src/app/account.tsx` | Add an email, continue with Google, sign in, sign out, delete the account |
| `src/app/privacy.tsx` | The privacy policy, at `/privacy`. Its words are in `src/lib/privacy.ts` |
| `src/app/notifications.tsx` | Choose which notifications to get |
| `src/app/profile.tsx` | Change your name and colour, and show or hide your Google photo |
| `src/app/join/[code].tsx` | Join by invite link |
| `src/app/group/[id]/index.tsx` | Group page: lists, ideas, reactions |
| `src/app/group/[id]/add.tsx` | Add an idea |
| `src/app/group/[id]/edit.tsx` | Change an idea or remove it |
| `src/app/group/[id]/plan.tsx` | Pick a date for an idea |
| `src/app/group/[id]/calendar.tsx` | The group's calendar: plans and done things, a month at a time |
| `src/app/group/[id]/comments.tsx` | The conversation about an idea |
| `src/app/group/[id]/done.tsx` | Things we did: the do-again shelf, and done ideas with the do-again question |
| `src/app/group/[id]/stamps.tsx` | The group's title, points and stamps |
| `src/app/group/[id]/pick.tsx` | Pick for us |
| `src/app/group/[id]/share.tsx` | Share an idea as a picture |
| `src/app/group/[id]/invite.tsx` | Invite link and members |
| `src/app/group/[id]/settings.tsx` | Rename the group, tidy its lists, remove people, replace the invite link, leave |
| `src/components/` | Shared interface pieces (buttons, cards, logo) |
| `src/lib/` | Theme colors, Supabase client, session, data access, plan dates |
| `supabase/schema.sql` | Tables, access rules and functions |
| `supabase/functions/` | Server-side helpers that run on Supabase (link previews) |

## Checks

```bash
npx tsc --noEmit         # type-check
npx expo export -p web   # production web build into dist/
```

## Not built yet

Apple and Facebook sign-in,
dark mode, and the app store listings.

## Splash screen, icons and link previews

The phone shows `assets/images/splash-icon.png` on violet while the app starts (set in `app.json`
under `expo-splash-screen`), and `src/components/launch.tsx` carries on from there with the name
and tagline. The colour and the width of the mark are written in both places and must match. A
phone cannot show a full-screen picture at this point, so the artwork in `assets/splash/` is a
reference only. Test the splash in a preview or production build: Expo Go does not show it.

What a shared link looks like, and what search engines read, is set in `scripts/web-head.js` and
added to the site by `npm run deploy:web`. The picture is `public/og.png` (1200 x 630). The files
in `public/` (the picture, `manifest.json`, `robots.txt`, `sitemap.xml`, the home-screen icons)
are published as they are.
