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

With `supabase/updates/024-nudges.sql` there is a fourth kind, and it is the only one a person
sends on purpose: in the garden, watering an idea nudges the members who have not voted on it
(see "The garden" below). A person gets at most one nudge about the same idea in 24 hours, whoever
waters it, and "Nudges" on the Notification settings page switches them off. Run updates 001 and
003 before it.

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

### The menu on a group's card, and deleting a group

On Home, each group's card has a small round button at its top left. It opens a sheet with
"Share group", which goes to the invite page, and one more row that depends on who is asking:

- **The owner** gets "Delete group". It asks first, in a box over the page that says plainly what
  goes: how many ideas, how many pictures the group added, the record of what it did, and who
  else loses the group. "Yes, delete it" deletes the group for everyone. It cannot be undone.
- **Anyone else** gets "Leave group", which asks in the same way and does what leaving from the
  group's settings does.

Deleting needs `supabase/updates/025-delete-group.sql`, which adds `delete_group`. Only the owner
is allowed, and the database is what says so. The database cannot remove a stored file, so the
app does it in three steps (`deleteGroup` in `src/lib/group-files.ts`): it asks the database
whether this person may, without deleting anything, then removes the pictures on the group's
ideas and its cover photo, and only then deletes the group. In that order, a refusal never leaves
a group behind with its pictures gone. Without the update the app says which one is missing.

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
- **"Search free photos"** opens a search under the chips, starting from the idea's name. It is
  the same search a group's cover uses, and tapping a result makes it the idea's picture. See
  "A found photo on an idea" under "Photo search for covers". For what free photos do not have,
  such as a film's poster, "Not there? Look on the web" under the results opens a picture search
  for the idea's name in the person's browser (`pictureSearch` in `src/lib/pictures.ts`). They
  save a picture they like, come back, and add it.

An idea's picture is shown as a strip twice as wide as it is tall, across the top of its card,
and a photo from a phone is nothing like that shape. So after choosing a photo the person
chooses which part of it shows (`src/components/picture-crop.tsx`): the photo sits behind a frame
of that shape, dragging moves it, and pinching, two round buttons or a mouse's wheel make it
bigger or smaller. With a keyboard, the arrow keys move it and plus and minus change its size.
"Use this picture" keeps only the part inside the frame. Until the idea is saved, "Adjust" goes
back to the same photo to choose a different part. The sums are in `src/lib/picture-crop.ts`.
A photo found by search, and a link's preview picture, are not the group's to cut: they still
show their middle.

The chosen part is made small on the device before it is sent: no more than 1280 dots wide, as a
JPEG, which comes to a few hundred kilobytes
(`pickPhoto` and `cropPicture` in `src/lib/picture-files.ts`). It is kept in Supabase Storage, in a place
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
When a group is deleted, because its last member leaves or deletes their account, every file in
the group's folder is removed first, while that person is still allowed to
(`removeGroupPictures` in `src/lib/group-files.ts`). The database cannot remove a stored file
itself. Two cases still leave a file behind, wasting a little room and nothing else: a group
deleted by a copy of the app from before 21 November 2026, and an idea removed by a copy from
before pictures. Clear those from the Storage page of the Supabase dashboard, never by deleting
rows from `storage.objects`, which leaves the files in place. Supabase's free plan has 1 GB of Storage,
room for several thousand pictures of this size.

### Group covers

A group's cover is drawn by the app, not kept as an image: a colour, two round shapes, the
flower pattern, the daisy that grows with the group's rank, and the group's name. One component
draws it everywhere it shows (`src/components/cover.tsx`), and the rules are in
`src/lib/covers.ts`. The design is `docs/REDESIGN-HOME-AND-GROUP-2.md`, section 1.

A cover is one of three kinds:

- **Classic:** one of the four colours the app has always had, with the flower pattern.
- **Look:** three colours (background and two shapes). Eight are ready-made (`LOOKS`), and
  `surpriseLook` makes a new one each time from one random hue, so the three never clash.
- **Photo:** a photo of the group's own, or one found by searching Unsplash, with a dark fade
  under the name (see "Cover photos" and "Photo search for covers").

Two things are worked out and never chosen, so any cover stays readable. The name is dark ink or
white, whichever stands out more against the background by the standard contrast sum (`textOn`).
And the name is drawn smaller the longer it is: full size up to 14 letters, about 80% up to 24,
about 68% after that, on two lines at most (`nameSize`). New and edited names stop at 50 letters.

Choosing one: "Change cover" in the group's settings opens the cover picker
(`src/app/group/[id]/cover.tsx`). The cover at its top is a preview with the group's real name
and daisy, and changes with every tap. Under it are the four classic colours, the eight looks with
"Surprise me" beside them, three colours of the group's own (each picked from a grid of 24,
`OWN_COLORS`), and a switch for the flower pattern (`src/components/cover-colors.tsx`). Nothing
changes for anyone else until "Save cover" is tapped, and any member can change it. The form that
makes a group shows the same preview and choices, without the three colours of its own.

How it is kept: every group still has the word for its classic colour in `cover`, as before.
Everything newer is in `cover_style`, which is empty until a group picks something the word
cannot say (`coverOf` reads the two together, `coverChange` writes them). That needs
`supabase/updates/018-group-covers.sql`. Without it the app shows and saves classic colours as
it always did, and says the update is missing if anything else is saved (`NO_COVERS`). Copies
of the app from before the update only know the word: when one of them changes a group's colour,
the database empties `cover_style`, so every copy shows the colour that was just chosen.

### Cover photos

A group can use one photo of its own as its cover. It is chosen on the Photo half of the cover
picker, shown in the preview straight from the device, and only sent when "Save cover" is tapped
(`chooseCoverPhoto` and `uploadCover` in `src/lib/picture-files.ts`). The rules are in
`src/lib/cover-photos.ts`.

- **Small.** The photo is made no wider than 1200 dots and saved as a JPEG at about 70%. If that
  is over 400 KB it is squeezed once more. Saving it afresh also leaves out where and with what it
  was taken. The place it is kept refuses anything over 512 KB.
- **One per group.** It is always the file `<group id>/cover.jpg` in the storage place
  `group-covers`, so a new photo takes the place of the old one. The cover on the group's row
  carries a version taken from the clock, which is what tells each phone its kept copy is out of
  date (`nextVersion`).
- **Private.** Unlike pictures on ideas, the place is not public, because a cover can be a photo
  of people. Only members can add, see, replace or remove a group's photo. To show one, the app
  asks storage, as the signed-in member, for an address that works for a day
  (`useCoverPhotos` in `src/lib/cover-addresses.ts`): one request for every group on Home, and
  each address is used again for the rest of the session. The photo is kept on the device under
  its place and version, not its address, so a new address does not fetch it again.
- **Tidied up.** The file is removed when the group goes back to colours, or on to a photo found
  by search. The database cannot
  remove a stored file, so when the last member leaves, or deletes their account, the app removes
  the photo first. A copy of the app from before this would leave the file behind.
- **While it loads, or if it will not,** the cover shows the colour and pattern it had, with the
  name in a colour that can be read on them.

It needs `supabase/updates/019-cover-photos.sql` (the place and its rules) as well as update
018. Without 019 the app says cover photos cannot be saved yet (`NO_COVER_PHOTOS`). It uses the
two packages that pictures on ideas already brought in, so nothing new is installed.

### Photo search for covers

The Photo half of the cover picker also has "Search free photos": a box to type in and a grid of
up to twelve results (`src/components/photo-search.tsx`). Tapping one shows it in the preview, and
"Save cover" keeps it. The photos come from [Unsplash](https://unsplash.com). Nothing is copied:
the cover keeps only the photo's web address and its credit, in `cover_style` (update 018, no new
update). The rules are in `src/lib/photo-search.ts`.

Setting it up, once. Until both steps are done the app says photo search is not set up, and
everything else works:

1. **A key from Unsplash.** Make a developer account at unsplash.com/developers, make a new
   application there, and copy its **Access Key**. In the Supabase dashboard open **Edge
   Functions**, then **Secrets**, and add a secret named exactly `UNSPLASH_ACCESS_KEY` with that
   key as its value. The key goes nowhere else: never in the app, and never in an `EXPO_PUBLIC_`
   value.
2. **Server-side helper.** In **Edge Functions**, choose **Deploy a new function**, then **Via
   Editor**. Name it exactly `photo-search`, replace the sample code with the whole of
   `supabase/functions/photo-search/index.ts`, and press **Deploy function**. To change it later,
   paste the new version and press **Deploy updates**.
3. **A share for each person.** Run `supabase/updates/021-photo-search-limit.sql`. Without it
   search works, with nothing to stop one person using up the hour. The order of steps 2 and 3
   does not matter.

A new Unsplash application is allowed 50 requests an hour, across everyone using the app. A search
is one request, and saving a cover with a found photo is one more. Loading the photos themselves
is not counted. When the hour is used up the app says search is busy. To get 1,000 an hour, apply
for production on the application's page at Unsplash, showing that the rules below are followed.

So that one person cannot use up that hour, each person has a share of it: 12 searches and 12
saved photos an hour. Before it calls Unsplash, the helper asks the database, as that person,
whether they are still within it (`take_photo_search`, update 021). Past it, the app says "You
have searched a lot in the last hour" and Unsplash is not called. The database keeps who asked
and when, never the words, and removes each row once it is over an hour old. The two numbers
are in `take_photo_search`: once Unsplash approves the app for production there is room to
raise them, by changing them there and running the file again. If the count cannot be kept (the
update is not run, or the database cannot be reached) search carries on without one.

**A found photo on an idea.** The same search is on the forms for a new idea and for editing one
(`IdeaPicture` in `src/components/idea-picture.tsx`). It needs
`supabase/updates/022-idea-photos.sql`, which adds a `photo` column to ideas holding the photo's
web address and its credit, and nothing else. No file is kept. Without the update the app says
which update is missing, and the idea is not saved without its photo (`NO_IDEA_PHOTOS`). The
rules are in `src/lib/idea-photos.ts`:

- An idea has its own picture or a found photo, not both. Choosing one takes the other off.
- A card shows the idea's own picture first, then a found photo, then the picture from its link
  (`cardPicture` in `src/lib/pictures.ts`).
- The credit is under the photo on the idea's card and on the forms (`PhotoCredit`), and
  Unsplash is told when an idea is saved with the photo.
- Only a photo on Unsplash's own servers is ever shown as a found photo, whatever is in the
  database (`ideaPhoto`).

Unsplash's rules, and where each is followed:

- **Photos are shown from Unsplash's own servers,** at the addresses it gives, unchanged. The app
  refuses to show a searched cover from anywhere else (`searchedPhotoAddress` in
  `src/lib/covers.ts`), whatever is in the database.
- **The credit shows wherever the photo does:** "Photo by (name) on Unsplash", with the name
  linked to the photographer's page and "Unsplash" linked to Unsplash, and every link saying it
  came from this app (`CoverCredit` in `src/components/cover-credit.tsx`). It is on the group's
  card on Home, under the cover on the group's page, in the group's settings and in the cover
  picker. Each photo in the search results has its photographer's name under it.
- **Unsplash is told when a photo is put to use,** which here is when a cover with it is saved
  (`reportChosen`). The helper only ever calls the address Unsplash gave with that photo.

The helper only answers signed-in people, only talks to Unsplash, and its log says how many photos
were found, never what was searched for. Searches are wide photos only, with Unsplash's stricter
filter on what they show. What each search found is kept for the session, so the same words are
not asked for twice, and the photos in the results are not kept on the device. The helper's rules
are tested in `src/lib/__tests__/photo-search-helper-test.ts`.

### The admin page

The website has a page at `/admin` for whoever runs SomeDaisy (`src/app/admin.tsx`, with its
pieces in `src/components/admin.tsx` and its rules in `src/lib/admin.ts`). It only shows. Changing
or removing anything is still done in the Supabase dashboard.

- **Overview:** how many people, groups and ideas there are, what happened in the last seven days,
  new people for each of the last eight weeks, how far people get (picked a name, in a group, added
  an idea, in a group that did something), how many groups are shared and how many last, and which
  kinds of cover are in use.
- **People:** everyone with a name, newest first, found by name or email. Opening one shows how
  they sign in, when they joined and the groups they are in.
- **Groups:** busiest, newest or biggest first, found by name. Opening one shows its people and
  its lists.

It shows names, email addresses, dates and counts. It never shows the words of an idea, a note or
a comment, or anyone's pictures, and the privacy policy says all of this.

Setting it up, once:

1. Run `supabase/updates/020-admin.sql` in the Supabase SQL editor. That lets nobody in.
2. Let yourself in by running this one line there, with your own email in it. Do not save your
   email into a file in this repository.

   ```sql
   insert into public.admins (user_id)
   select id from auth.users where lower(email) = lower('you@example.com')
   on conflict do nothing;
   ```

   "INSERT 0 1" means it found you. "INSERT 0 0" means no account has that email yet: sign in to
   SomeDaisy with it once and run the line again.
3. Sign in to the website with that account and open `/admin`.

To let someone else in later, run the same line with their email. To shut someone out, delete
their row from `admins` (the line for that is at the top of the update).

How it is kept shut:

- **The database decides, not the page.** Each thing the page asks for is a database function that
  first checks the `admins` table and refuses everyone else, so reading the app's code or calling
  the functions by hand gets nothing. The app cannot read or change `admins` at all. A guest is
  never an admin.
- **Nothing leads to it.** No screen links to `/admin`. To anyone who is not an admin, signed in or
  not, the address shows the same "not found" page as any address that leads nowhere.
- **Search engines are asked to leave it out,** by `public/_headers` (read by Cloudflare Pages)
  and by a tag the page adds while it is open. It is deliberately not named in `robots.txt`.

Being hard to find is not what protects it: this repository is public, so the address is no
secret. The check in the database is the protection.

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
title if the group reached one, and the question "Would you do it again?". Someone who leaves
that screen without answering, or who was not the one to mark it done, is asked on the group's
page instead, for anything done in the last 30 days: a card under "Coming up" with the idea's
picture (or its list's icon) with a green tick, when it was done, and the two answers
(`src/components/did-it-card.tsx`). Its X puts the question off until the page is next opened.
Each group has one
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

### The group's page

The design is `docs/REDESIGN-HOME-AND-GROUP-2.md`, sections 3 to 5. The page is put together in
`src/app/group/[id]/index.tsx` from these parts:

- **The cover** across the top, edge to edge and under the clock and battery
  (`src/components/cover-page.tsx`). Back, Invite and Settings are round white buttons on it, with
  the group's name and members under them. The clock and battery are drawn dark over a pale cover
  and light over a dark one. The cover scrolls away with the page. Once it has gone, a small bar
  with the way back, the name and the same buttons stays at the top.
- **A panel** in the page's colour that rides up over the bottom of the cover and holds the rest.
- **The rank line**, which opens the stamps, with the garden (see "The garden" below), Calendar and
  "Things we did" beside it. The garden's button is there once the group has an idea.
- **Coming up** (`src/components/coming-up.tsx`). One plan is a card with its buttons on it. More
  than one go in a row that slides sideways, and tapping one opens it on a sheet that slides up
  (`src/components/sheet.tsx`), which is where "Change date", "Did it early" and "We did it!" are
  then. With no plans the whole block is left out.
- **The row of lists** (see below).
- **The ideas** (`src/components/idea-card.tsx`). An idea with a picture gets a picture card: the
  picture across the top, the name in white over its darkened foot, and small labels for its list,
  its date and "Everyone's in". The picture is always twice as wide as it is tall. An idea with no
  picture, or one that will not load, gets a compact card with its list's icon. Both end the same
  way: the votes with "Plan it" at the right, then a row that shows the newest comment.
  Tapping a card anywhere that is not a button of its own opens the idea's page
  (`src/app/group/[id]/comments.tsx`): its picture, name, note, link and date, then its comments,
  with the box to add one at the bottom. A picture that came with a link opens the link instead.
  Sharing and editing are behind the "..." button, which opens a sheet.
- **The bottom bar**: "Pick for us" and "Add an idea" on the band of flowers.

### Finding and making lists

The group's page shows its lists as one row of tabs that slides sideways
(`src/components/list-strip.tsx`), so the row stays one line tall however many lists there are.
Each tab says how many ideas its list holds. A round button at the start of the row stays put
while the tabs slide, and opens a page of every list (`src/app/group/[id]/lists.tsx`): one under
the other in order of name, each with its icon and how many ideas it holds, and from eight lists
up a box to type part of a name in. Tapping a list there shuts the page and shows that list, and
the row of tabs moves to bring its tab into view.

How the row is moved depends on what it is moved with. With a finger (the phone app, and the
website on a device with no mouse) there is no scrollbar, and the tabs fade out at the right edge
to say there are more. With a mouse the wheel slides the row, since a wheel only turns up and
down, and a slim scrollbar under the tabs can be dragged. The website hides that bar with a CSS
rule only where the device has no fine pointer.

"New list", at the bottom of the page of every list, opens a page of its own
(`src/app/group/[id]/new-list.tsx`) with the name, the kind and
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

### Big groups: loading, long lists and search

Three things keep a group with hundreds of ideas working.

- **Loading all of it.** Supabase gives back at most 1,000 rows for one request and says nothing
  when it stops there. Five people voting on 250 ideas is already 1,250 reactions. So ideas,
  reactions, comments, done things and do-again answers are read a page at a time until the
  count the database gives has arrived (`everyRow` in `src/lib/every-row.ts`). A small group
  still makes one request for each. Anything new that can grow past 1,000 rows should be read the
  same way, in an order no two rows share.
- **"Show more".** The group's page and "Things we did" draw 25 cards, then a "Show more" button
  that adds 25. Everything is already loaded, so the button asks the database for nothing.
- **Search.** Once a group has six ideas its page has a search box. It looks through names,
  notes, links, tags and list names as each letter is typed (`src/lib/search.ts`), in the list
  that is picked, or in every list on "Newest". It asks the database for nothing either. Ideas
  that are done are not searched.

### Live updates

When someone changes something in a group, the others looking at that group see it without
refreshing. The group's page listens on a channel of Supabase's Realtime for a "something
changed" signal and loads the group again when one arrives. The signal carries no data, so who
may read what is still decided by the usual loading.

The signal is sent twice over. The database sends it as part of saving any change to the group
(`supabase/updates/016-live-updates.sql`), so it does not depend on the phone that made the
change. That phone also sends one itself, which is all there is until update 016 is run.
Signals that arrive together are answered with one load (`src/lib/live.ts`).

The garden opens on top of the group's page and listens to the same channel. Supabase hands out one
channel for each name, so the two screens share it through `listenToGroup` in `src/lib/live.ts`,
which closes the channel only when the last of them has gone. A screen that makes a change tells
the other one directly, since a channel does not play a signal back to the app that sent it.

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

### The garden

Another way to look at a group's ideas, reached from the round tulip button on the group's page.
Instead of a list, the group sees a little house on a hilltop, and every idea is a daisy in the
yard. It sits beside the list and replaces nothing: the arrow at the top goes back to the list.
The design came in two handoffs, `design_handoff_garden_a/` and `design_handoff_garden_a_v2/`
(working prototypes and their notes), whose colours, sizes and timings are final.

How to read a flower:

- **Its shape** is how far the idea has come. A closed bud is new. A half-open cup has some
  answers. A full bloom means everyone is in. A date marker behind the bloom means it is planned,
  with the day of the month on it.
- **Its petals** are the colour of its list.
- **Its leaves** are the members, each in that member's colour: a full leaf for "I'm in", a
  smaller one for "Eh", a green nub for no answer yet. A flower has up to six leaves. In a bigger
  group they are the six who joined first, with the person looking always among them.
- **The daisy in the sky** is the group's rank: one petal filled in for each rank reached.

Tapping a flower moves the camera in on it and opens a sheet with who has answered and what can be
done next: "I'm in" and "Eh" until everyone is in, then "Plan it", then "We did it!". "We did it!"
sends the flower into the house, and the usual "You did it" screen follows, where a mistaken tap
can be undone. "Pick for us" sends a bee to choose a flower, and "Add an idea" opens the usual
form: the new idea comes up as a bud in the front row.

What else is in it:

- **The house can be walked into.** Tap the door, or the book at the top. Inside is a hallway
  where every finished idea hangs in a frame: a pressed flower in its list's colour, or the idea's
  own picture if the group gave it one. (A photo found by search is not framed: it has to carry its
  credit wherever it shows, and a small frame cannot.) A wall holds twelve frames and covers whole
  months. Quiet months share a wall and a busy month runs on to the next, and walls fill from the
  oldest forward, so only the newest wall ever changes. Swipe sideways or use the arrows to walk
  along, tap a frame to lean in, and use the list button to see everything and walk straight to
  one. The link at the foot of that list opens the full "Things we did" page. The rule for the
  walls is `buildWalls` in `src/lib/garden-house.ts`.
- **"Our garden"**, the round button left of "Pick for us": paint the roof, walls and door, and
  choose a soft, mown or meadow lawn. Everyone in the group sees the same garden, and any member
  can change it. It needs `supabase/updates/023-garden-look.sql`. Without it the garden still
  opens, as it first was, and a change says which update is missing.
- **Things to earn.** A bench at 5 things done, a birdbath at 10 and string lights at 20
  (`EXTRAS` in `src/lib/garden-look.ts`). Each can be switched off and on in "Our garden".
- **Seasons** follow the date: blossom in spring, turning leaves in autumn, snow in winter. The
  device's time zone decides which half of the world it is in, so December is summer in Sydney.
  Nothing about where anyone is gets kept.
- **Water to nudge.** While an idea is waiting on someone, its sheet has "Water to nudge" with
  their names. The watering can tips, and the members who have not voted get a notification on
  their phones. Someone who said "Eh" is never nudged. It needs `supabase/updates/024-nudges.sql`
  (see "Push notifications"). Without it the can still pours and the app says nudges cannot be
  sent yet.
- **Friends drop by.** When another member says "I'm in" while you have the garden open, their
  butterfly flies in under their name and lands on that flower, and their leaf unfurls as it
  does. Only votes that arrive while the garden is open do this.
- **A postcard.** The camera at the top takes a picture of the garden as it is. "Share" opens the
  share sheet with it. "Save picture" downloads it on the website. In the phone app it opens the
  share sheet too, which is where a phone offers to keep a picture: saving straight into the
  phone's photos would mean asking for access to them, and the app does not.
- **Sounds**, off until someone turns them on in "Our garden", and remembered on that device only:
  wind, birds by day, crickets at night, and a few notes when things happen. They are made as they
  play. There are no sound files.

What it shows, and what it leaves to the list:

- Only things to go and do. Ideas on a list that is just a list have nothing to plan.
- Twelve flowers at a time, newest first, which is what the yard holds. A group with more gets
  "Bed 1 of 3" and two arrows above the bottom bar.
- Dark mode is night, with stars, a shooting star now and then, fireflies and a lit window. Light
  mode is day, and dusk from five until nine in the evening.
- People who have asked their device for less motion get a garden that stands still: nothing
  sways, the walk into the house is a quick cut, and a friend's vote simply shows.
- The flowers are also there as a list nobody sees, so a keyboard or a screen reader can reach
  each one and open it. Inside the house the list of finished ideas does that job. The list view
  remains the fuller way to do everything.

How it is built:

- **The scene** is in `src/garden/`, drawn with three.js: `scene.ts` (flowers, camera, taps and
  each frame), `land.ts` (hill, house), `sky.ts` (sky, stars, clouds, the valley round the hill),
  `plants.ts` (trees, shrubs, grass, wildflowers), `extras.ts` (bench, birdbath, lights, snow),
  `hallway.ts` (inside the house), `creatures.ts` (butterflies, the bee, fireflies, the watering
  can), `sound.ts`, and three files with no drawing in them that the tests cover: `ground.ts`,
  `plan.ts` and `palette.ts`. Nothing is loaded from an image file except a group's own pictures
  in frames. Trees and grass are worked out from the same run of made-up numbers every time, so it
  is always the same garden.
- **It is web code.** `src/components/garden-view.tsx` starts with `'use dom'`, which makes it an
  Expo DOM component: on the website it is drawn straight into the page, and in the phone app Expo
  puts it in a web view of its own. Nothing extra needs installing for that. The screen passes it
  plain values (the flowers, the walls of the house, the season) and hears back through functions.
- **Everything over the garden** (header, sheets, the bar inside the house, the postcard) is the
  app's own, in `src/components/garden-chrome.tsx`, put together by
  `src/app/group/[id]/garden.tsx`.
- **The rules** are in `src/lib/garden.ts` (an idea's stage, who gets a leaf, who is nudged),
  `src/lib/garden-look.ts` (paint, lawn, what is earned, the season) and
  `src/lib/garden-house.ts` (which frames hang on which wall).
- **A phone draws less.** In the app, and on the website with a finger for a pointer, the garden
  has about half the leaves and grass, softer shadows and fewer dots to the screen (`QUALITY` in
  `src/garden/kit.ts`). It stops drawing while another screen is over it or the app is in the
  background, the garden is not drawn while the camera is inside the house, and only three walls of
  the hallway are ever built.

Of the options in the prototypes' side panels, this is the Meadow layout, petals in the list's
colour, daisy-shaped petals and vote leaves on. The Path and Tall stems layouts are not built, and
the side panel itself is a review tool, not part of the app.

Checked against the prototypes in a browser on a computer, where they look alike and the garden
holds 60 frames a second, in every season and time of day, and with 0, 1, 3, 12, 40 and 320 things
done in the house. Not yet seen on a phone, and not yet timed on one.

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
| `src/app/admin.tsx` | The admin page, at `/admin`. Only for the people in the `admins` table |
| `src/app/profile.tsx` | Change your name and colour, and show or hide your Google photo |
| `src/app/join/[code].tsx` | Join by invite link |
| `src/app/group/[id]/index.tsx` | Group page: lists, ideas, reactions |
| `src/app/group/[id]/add.tsx` | Add an idea, by typing it or from a pasted link, with a picture of your own if you like |
| `src/app/group/[id]/edit.tsx` | Change an idea or remove it |
| `src/app/group/[id]/plan.tsx` | Pick a date for an idea |
| `src/app/group/[id]/calendar.tsx` | The group's calendar: plans and done things, a month at a time |
| `src/app/group/[id]/comments.tsx` | An idea's own page: its details, and the conversation about it |
| `src/app/group/[id]/done.tsx` | Things we did: the do-again shelf, and done ideas with the do-again question |
| `src/app/group/[id]/stamps.tsx` | The group's rank, the ladder of ranks, points and stamps |
| `src/app/group/[id]/pick.tsx` | Pick for us |
| `src/app/group/[id]/garden.tsx` | The garden: a group's ideas as flowers round a little house |
| `src/app/group/[id]/share.tsx` | Share an idea as a picture |
| `src/app/group/[id]/invite.tsx` | Invite link, a QR code of it, and members |
| `src/app/group/[id]/settings.tsx` | Rename the group, tidy its lists, remove people, replace the invite link, leave |
| `src/components/` | Shared interface pieces (buttons, cards, logo) |
| `src/lib/` | Theme colors, Supabase client, session, data access, plan dates |
| `src/lib/theme.ts` | Every colour in the app, for light and dark mode. Screens read them with `useTheme()` |
| `src/lib/appearance.tsx` | Which mode the app is in, and the saved choice of Auto, Light or Dark |
| `src/lib/pictures.ts`, `src/lib/picture-files.ts` | An idea's own picture: the rules, and choosing, shrinking and keeping it |
| `src/lib/picture-crop.ts`, `src/components/picture-crop.tsx` | Choosing which part of a photo an idea shows: the sums, and the frame to drag it behind |
| `src/lib/idea-photos.ts` | A photo found by search as an idea's picture: only its address and credit are kept |
| `src/lib/every-row.ts` | Reading past the 1,000 rows one request gives |
| `src/lib/group-files.ts` | Clearing out a group's idea pictures before the group is deleted, and deleting a group |
| `src/lib/search.ts` | Finding an idea in a group by typing part of it |
| `src/garden/` | The garden's 3D scene, drawn with three.js. Web code, shown through `src/components/garden-view.tsx` |
| `src/lib/garden.ts` | What each idea looks like as a flower, the words on its sheet, and who a watering nudges |
| `src/lib/garden-look.ts` | A garden's paint and lawn, what a group has earned for its yard, and the season |
| `src/lib/garden-house.ts` | Inside the house: which finished ideas hang on which wall |
| `src/lib/postcard.ts`, `src/lib/garden-sound.ts` | Sharing a postcard of the garden, and whether its sounds are on |
| `supabase/schema.sql` | Tables, access rules and functions |
| `supabase/functions/` | Server-side helpers that run on Supabase (link previews, photo search) |

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

The one exception is the garden. Its scene is a picture of a place, with greens, bark and sky of
its own that follow the time of day, not the mode. Those are all in `src/garden/palette.ts`, and a
test checks the ones it shares with the brand against the theme. The buttons and sheets over the
garden use the theme like everything else.

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
