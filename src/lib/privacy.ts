// The words of the privacy policy, shown at /privacy (src/app/privacy.tsx).
//
// Keep this true. When the app starts keeping something new, or sends information to a new
// company, say so here in the same change and move UPDATED forward.

/** Where people write to about their information. This address has to reach a person. */
export const CONTACT = 'hello@somedaisy.com';

export const UPDATED = '20 November 2026';

/** A paragraph is a string. A list of points is an array of strings. */
export type Block = string | string[];
export type Section = { title: string; blocks: Block[] };

export const INTRO: string[] = [
  'SomeDaisy helps groups of friends collect ideas for things to do and pick the ones they want. This page says what the app keeps about you, why, and what you can do about it.',
  'The short version: we keep what the app needs to work. There are no ads. We do not sell your information or pass it on for advertising. The website counts its visits, but not who makes them.',
];

export const SECTIONS: Section[] = [
  {
    title: 'What we keep',
    blocks: [
      [
        'Your name and colour. You choose them, and the people in your groups see them.',
        'Your email address, if you add one. It is how you sign in. Other people never see it.',
        'If you continue with Google: your name, email address and profile picture from your Google account. The picture is shown as your circle unless you switch that off where you change your name. We never see your Google password.',
        'What you add to a group: the group itself, its lists, ideas (with any link or note), reactions, comments, the dates you plan things for, what you mark as done, the points and stamps your group earns for it, and your answer when asked whether you would do something again.',
        'If an idea has a link: the web address of that page\'s preview picture, so the idea\'s card can show it. We keep the address, not the picture.',
        'A picture you add to an idea yourself. You choose it from your photos, your device makes a smaller copy, and we keep that copy with the idea. The app never sees your other photos.',
        'If you turn on notifications: an address that lets us send notifications to your phone, whether it is an Android phone or an iPhone, your time zone, and which kinds of notification you want.',
        'A sign-in kept on your phone or in your browser, so you stay signed in.',
      ],
      'You can use SomeDaisy without an email. The app then gives your device its own account, known only by the name you type in, so that your groups are yours.',
      'The website counts its visits, so we can see how many there are and which pages get used. For each page opened it notes the page, the site you came from, your country, and the kind of device and browser. The count uses no cookies and is not tied to your name or your account. The phone apps do no counting of this kind.',
      'We do not collect your contacts, or where you are beyond the country in that count. The only photos we keep are the ones you add to an idea. The app has no advertising tools in it, and it sets no advertising cookies.',
    ],
  },
  {
    title: 'Who can see what',
    blocks: [
      [
        'People in your groups see your name, colour and picture, and everything added to the groups you share.',
        'Anyone who has a group\'s invite link can see that group\'s name, its colour and how many people are in it, and can join it. Share invite links only with people you want in the group.',
        'A picture added to an idea is shown to the group. It also has a long web address of its own that nobody could guess, and anyone who is given that address can open the picture. The app only gives it to the group.',
        'Nobody else can see your groups.',
      ],
    ],
  },
  {
    title: 'Companies that help run SomeDaisy',
    blocks: [
      'A few companies handle information for us so that the app can work. They may use it only for that.',
      [
        'Supabase stores the app\'s information, the pictures added to ideas included, and handles signing in.',
        'Cloudflare delivers the website and counts its visits. Like any web host, it sees the internet address your device connects from.',
        'Resend sends the emails with sign-in codes, so it receives your email address.',
        'Google signs you in if you choose Continue with Google, and delivers notifications to Android phones. If you tap "Find one on the web" for a picture, your own browser opens a Google search for the idea\'s name.',
        'Expo passes notifications on to phones. It receives the address for your phone and the words of the notification, which can include a friend\'s name, the title of an idea and the words of a comment.',
      ],
      'These companies may keep information in countries other than yours, including the United States.',
      'When an idea has a link, our server reads that page once to find its preview picture. The picture itself comes from the website it lives on each time someone in the group looks at the idea, so that website sees the internet address of whoever is looking, as it would for any picture on the web.',
    ],
  },
  {
    title: 'How long we keep it',
    blocks: [
      'We keep your information for as long as you use SomeDaisy. When you delete your account it is removed straight away, as described below. Sign-in codes stop working after a short time.',
    ],
  },
  {
    title: 'Your choices',
    blocks: [
      [
        'Change your name or colour, or hide your Google picture, from your account.',
        'Turn notifications off in the app, or in your phone\'s settings.',
        'Sign out on a device from your account.',
        'Delete your account, from your account in the app or at somedaisy.com/account. If you use SomeDaisy without an email, the same place lets you delete your data.',
        'Ask for a copy of your information, or ask us to correct it.',
      ],
      'When you delete your account, your name, email address, picture, reactions, comments, do-again answers and notification details are removed straight away, and this cannot be undone. Ideas you added stay in the group for your friends, without your name on them and with any picture you put on them, and so does the record of what the group has done. To take a picture away first, remove it from its idea. A group where you are the only member is deleted with everything in it.',
      `For a copy or a correction, or if you cannot get into your account to delete it, write to ${CONTACT} from the email address on your account. We aim to answer within 30 days.`,
      'Depending on where you live, the law may give you further rights over your information, including the right to complain to your data protection authority.',
    ],
  },
  {
    title: 'Children',
    blocks: [
      `SomeDaisy is not meant for children under 13, and we do not knowingly keep information about them. If you believe a child has given us information, write to ${CONTACT} and we will remove it.`,
    ],
  },
  {
    title: 'Keeping it safe',
    blocks: [
      'Information travels between your device and SomeDaisy over an encrypted connection, and the database only lets each person reach their own groups. No service can promise perfect security, but we take care with yours.',
    ],
  },
  {
    title: 'Changes to this page',
    blocks: [
      'If what we keep or who we share it with changes, we will update this page and the date at the top. If the change is a big one we will say so in the app.',
    ],
  },
];
