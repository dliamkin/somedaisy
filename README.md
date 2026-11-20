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

### Counting visits to the website

The website's visits are counted by Cloudflare Web Analytics. Nothing in this project turns it
on: it is a switch in Cloudflare (Workers & Pages > somedaisy > Metrics > Web Analytics), and
Cloudflare adds its small script to the page each time the website is published. The numbers are
on Cloudflare's Web Analytics page for the account. It uses no cookies, and the phone apps have
none of it.

Those are not the numbers under the domain's own Analytics page. That page counts every request
that reaches the website, crawlers included, so it runs far higher.

The count lists the page that was opened, so the addresses of groups and of invite links show up
in it. Only someone signed in to the Cloudflare account can see them. The privacy policy says
what is counted; change it there before adding any other way of counting.

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
inside Supabase's own network), and returns nothing but a picture's address and the page's title.
The title is what fills in the name when an idea is started from a pasted link ("Paste a link" on
the New idea screen). A helper deployed before it learned to read titles still works: the picture
shows and the name is left for the person to type. To get titles, deploy the current file again. Its rules are
tested in `src/lib/__tests__/link-preview-test.ts`. The picture is looked up in the background
While a link is being typed on the form for an idea, the picture is looked up once the typing
pauses and shown under the link box, so the person knows what the card will get. On saving, a
picture found that way is used as it is; otherwise it is looked up in the background and
appears on the card a few seconds later. A page with no picture, or a picture that will not
load, leaves the card as it was.

Some pages give less than others, and the helper says why in its log:

- **A result shared from Google** (a `share.google` link, or a `google.com/search` address).
  Google's pages name no picture and call themselves only "Google Search". The helper takes the
  words that were searched for as the name (`searchedFor`), and gives no picture. A Google page
  that does not say what it shows, such as `google.com/searchviewer`, gives nothing at all.
- **Facebook.** The name is read. The picture Facebook names is one it hands only to its own
  link reader, so it is passed over. The photos inside the page have addresses that stop working
  within a week, so they are not used either. A picture of the person's own can be added instead.
- **A site that only lets browsers in** gives nothing.

### A picture of your own on an idea

Any idea can have a picture that someone in the group adds, whatever its list asks for and
whether or not it has a link. The forms for a new idea and for editing one show two dashed chips,
beside the ones that add a link or a note:

- **"+ Add a picture"** opens the phone's or computer's own photo chooser. The app never sees
  any photo but the one chosen.
- **"Find one on the web"** opens a picture search for the idea's name in the person's browser
  (`pictureSearch` in `src/lib/pictures.ts`). They save a picture they like, come back, and add
  it. There is no search inside the app: that needs a paid search service, and none is set up.

The chosen picture is made small on the device before it is sent: no more than 1280 dots along
its longer side, as a JPEG, which comes to a few hundred kilobytes
(`choosePicture` in `src/lib/picture-files.ts`). It is kept in Supabase Storage, in a place
called `idea-pictures`, under `<group id>/<a new random id>.jpg`, and the idea remembers where
in its `picture` column. An idea's own picture is the one its card shows. Without one, the card
shows the preview picture of the page the idea links to, as before (`cardPicture`).

It needs three things:

1. **Database.** Run `supabase/updates/017-idea-pictures.sql`. It adds the column, makes the
   place in Storage, and sets its rules: only members of a group can add to, list or remove from
   the group's folder, a file is a JPEG of at most 1 MB, and nothing is replaced in place.
   Without it the app says pictures cannot be saved yet, and the idea is not saved without its
   picture (`NO_PICTURES`).
2. **Two packages**, both from Expo: `expo-image-picker` (the photo chooser) and
   `expo-image-manipulator` (makes the picture small). They are native code, so the phone app
   needs a build made after they were added. The website needs only a deploy.
3. **Nothing else.** No keys, and no setting in the dashboard.

Who can open a picture: the place is "public" in Supabase's sense. Anyone who has a picture's
full web address can open it, signed in or not, which is what lets it show on a card like any
picture on the web. The address holds two long random ids, the app gives it only to the group,
and nobody outside the group can list the folder. The privacy policy says so.

A picture's file is removed when the picture is taken off or replaced, or its idea is removed.
Two cases leave a file behind, wasting a little room and nothing else: a group that is deleted
when its last member leaves, and an idea removed by a copy of the app from before pictures. Clear
those from the Storage page of the Supabase dashboard, never by deleting rows from
`storage.objects`, which leaves the files in place. Supabase's free plan has 1 GB of Storage,
room for several thousand pictures of this size.

### Typing on a phone

Every text box in the app is one component (`Field` in `src/components/ui.tsx`), and two things
about it are deliberate:

- **Password managers are kept away from it.** A phone offers to save what was typed as a sign-in
  ("Save sign-in info to Samsung Pass?") whenever it takes a form for one. Only the email box and
  the code box on the sign-in screen are for signing in. Every other box says so
  (`autoComplete="off"`, and `importantForAutofill="no"` on Android), so the name of an idea, a
  link, a note or a comment is never offered for saving.
- **The box being typed in stays in view.** In the app, the page (`Screen`) scrolls it back above
  the keyboard whenever the room for the page changes. On the website the page is told to get
  shorter for the keyboard (`interactive-widget=resizes-content`), so the buttons pinned to the
  bottom ride above it, and the box is scrolled into view when it is not
  (`steadyWebPage` in `src/lib/web-page.ts`). A box that can already be seen is not moved.

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
group's name with "Grow your group's petals!" above it (each rank is a petal on the group's
daisy), the title shows on the home screen, and the stamps page lists everything done.
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

A plan is marked as done from its card at the top of the group's page, or from the idea's own
card on its list, which shows the same button once the idea has a date. Whoever has just given
an idea a date comes back to that card, often with the top of the page out of sight. Before the
plan's time the button is a quiet "Did it early"; from then on it is "We did it!". Both ask to be
sure first (`DoneButtons` in `src/components/coming-up.tsx`).

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
want all of that; a list such as "Song titles" can be a list of names only. The choice is put as
two kinds of list. "Things to do" can be given dates, and starts with the link and the note on.
"Just a list" cannot, and starts with only the name. The link and the note each have a switch
under the kind, so either can be changed. The kind is not stored by itself: it is whether the
list gives dates (`kindOf` and `withKind`). The choices are made
when adding a list and changed under Group settings, by any member. They need
`supabase/updates/015-list-options.sql`; without it every list has everything turned on, as
before. Turning something off only changes what the app offers: an idea that already has a
date, a link or a note keeps it, and can still have it changed or taken off. The rules are in
`src/lib/list-options.ts`.

A list without dates is for keeping things, not for making plans, and its ideas are shown that
way. Instead of the "I'm in" and "Eh" votes there is a thumbs up and a thumbs down beside the
comment, share and edit icons. There is no "Plan it" button, nobody is said to be waited on, a
thumbs up from everyone is not celebrated, and the form for a new idea has no "Count me in". The
votes are stored the same either way, so turning dates on or off loses nothing.

A list's kind is never dropped quietly. If update 015 has not been run, a list with anything
turned off is not made at all, and the "New list" page says the database is missing the update
(`NO_LIST_OPTIONS` in `src/lib/data.ts`). To check the database, run this in the SQL editor. It
should list `dates`, `links` and `notes`:

```sql
select column_name from information_schema.columns
where table_schema = 'public' and table_name = 'lists' order by 1;
```

A box the list leaves off can still be added to one idea: the forms for a new idea and for
editing one show "+ Add a link" and "+ Add a note" for whatever is not on show. That changes the
idea only, not the list.

### Finding and making lists

The group's page shows its lists as one row of tabs that slides sideways
(`src/components/list-strip.tsx`), so the row stays one line tall however many lists there are.
From four lists up, a button at the start of the row opens a page of every list
(`src/app/group/[id]/lists.tsx`): one under the other in order of name, each with its icon and how
many ideas it holds, and from eight lists up a box to type part of a name in. Tapping a list there shuts the
page and shows that list, and the row of tabs moves to bring its tab into view. On a computer the
mouse wheel slides the row, since a wheel only turns up and down.

"+ List" opens a page of its own (`src/app/group/[id]/new-list.tsx`) with the name, the kind and
the look, an X to shut it and "Add list" pinned at the bottom. Both pages tell the group page which
list to show by leaving word in `openList` (`src/lib/data.ts`), which the group page reads when it
comes back into view. No form opens the keyboard by itself, so the whole form is seen first.

"Which list?" on the forms for an idea (`ListChooser` in `src/components/list-chooser.tsx`) is a
row of chips for up to six lists. With more, the form shows only the chosen list, and tapping it
opens every list in order of name, with the same box to find one by name.

### Reaction emoji

The emoji under "+ emoji" are drawn from pictures kept in the app (`assets/emoji`, one 72 by 72
PNG for each), so a reaction looks the same on every phone and in every browser. Left to the
device, Apple, Google, Samsung and Windows each draw their own. The pictures are Google's Noto
Emoji, used under the Apache licence, which is kept beside them in `assets/emoji/LICENSE`.
`src/lib/emoji-pictures.ts` maps each emoji to its picture and `src/components/emoji.tsx` shows
one. The emoji itself is still what is stored and what a notification says. To offer a new one,
add it to `MORE_REACTIONS` in `src/lib/theme.ts` and add its picture: a test fails if one is
missing.

On a list that is just a list, the thumbs, the emoji people have used and the icon that adds one
all sit on the one line with the comment, share and edit icons. They run on to a second line only
when there are more than fit.

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
| `src/app/account.tsx` | Add an email, continue with Google, sign in, sign out, delete the account, and choose light or dark mode |
| `src/app/privacy.tsx` | The privacy policy, at `/privacy`. Its words are in `src/lib/privacy.ts` |
| `src/app/notifications.tsx` | Choose which notifications to get |
| `src/app/profile.tsx` | Change your name and colour, and show or hide your Google photo |
| `src/app/join/[code].tsx` | Join by invite link |
| `src/app/group/[id]/index.tsx` | Group page: lists, ideas, reactions |
| `src/app/group/[id]/add.tsx` | Add an idea, by typing it or from a pasted link, with a picture of your own if you like |
| `src/app/group/[id]/edit.tsx` | Change an idea or remove it |
| `src/app/group/[id]/plan.tsx` | Pick a date for an idea |
| `src/app/group/[id]/calendar.tsx` | The group's calendar: plans and done things, a month at a time |
| `src/app/group/[id]/comments.tsx` | The conversation about an idea |
| `src/app/group/[id]/done.tsx` | Things we did: the do-again shelf, and done ideas with the do-again question |
| `src/app/group/[id]/stamps.tsx` | The group's rank, the ladder of ranks, points and stamps |
| `src/app/group/[id]/pick.tsx` | Pick for us |
| `src/app/group/[id]/share.tsx` | Share an idea as a picture |
| `src/app/group/[id]/invite.tsx` | Invite link, a QR code of it, and members |
| `src/app/group/[id]/settings.tsx` | Rename the group, tidy its lists, remove people, replace the invite link, leave |
| `src/components/` | Shared interface pieces (buttons, cards, logo) |
| `src/lib/` | Theme colors, Supabase client, session, data access, plan dates |
| `src/lib/theme.ts` | Every colour in the app, for light and dark mode. Screens read them with `useTheme()` |
| `src/lib/appearance.tsx` | Which mode the app is in, and the saved choice of Auto, Light or Dark |
| `src/lib/pictures.ts`, `src/lib/picture-files.ts` | An idea's own picture: the rules, and choosing, shrinking and keeping it |
| `supabase/schema.sql` | Tables, access rules and functions |
| `supabase/functions/` | Server-side helpers that run on Supabase (link previews) |

## Checks

```bash
npx tsc --noEmit         # type-check
npx expo export -p web   # production web build into dist/
```

## Colours, and light and dark mode

No screen or component has a colour value of its own. They are all in `src/lib/theme.ts`, as two
sets with the same names (`light` and `dark`) plus the colours that never change (the pastels, the
daisy, the logo tile). A screen gets the right set from `useTheme()`. The names and values come from
`docs/POLISH-AND-DARK-MODE.md`, and `src/lib/__tests__/theme-test.ts` checks that both sets have the
same names and that text can be read on what it sits on.

The mode is chosen under **Appearance** on the account screen: Auto (follow the phone or browser),
Light or Dark. The choice is kept on the device, not the account, so guests have it too. Two things
are always light: the picture made for sharing, and the QR code on the invite screen.

`app.json` allows both modes (`userInterfaceStyle`), and the `expo-navigation-bar` entry there stops
Android drawing its own see-through strip behind the bottom buttons. Both are native settings, so
they need a new build to take effect on a phone.

## Not built yet

Apple and Facebook sign-in, and the app store listings.

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
