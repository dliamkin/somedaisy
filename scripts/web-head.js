// What the website tells search engines and link previews about itself.
//
// The site is one page that the app then fills in, so everything a search engine or a chat app
// reads without running the app has to be in that page's <head>. Expo writes a bare one; this
// adds the rest after the site is built. Used by scripts/deploy-web.js.
//
// A link pasted into WhatsApp, iMessage, Slack and the like shows SHARE.title, SHARE.description
// and the picture at public/og.png (1200 x 630). Every address on the site shows the same
// preview, an invite link included, because they all serve this one page.

const SITE = 'https://somedaisy.com';

const SHARE = {
  name: 'SomeDaisy',
  title: 'SomeDaisy: turn someday into a day',
  description:
    "Collect ideas for things to do with friends, family or a partner, see who's in, and pick a date. Movies, places, trips and more, for free.",
  image: `${SITE}/og.png`,
  imageAlt: 'The SomeDaisy flower beside the words: Turn someday into a day.',
  // The colour a phone browser tints its bars with: the app's own background.
  themeColor: '#F6F0FB',
};

const escape = (text) => text.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** The tags to add inside <head>, one per line. */
function headTags() {
  const about = {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: SHARE.name,
    url: `${SITE}/`,
    description: SHARE.description,
    applicationCategory: 'LifestyleApplication',
    operatingSystem: 'Android, iOS, Web',
    image: SHARE.image,
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
  };
  return [
    `<meta name="description" content="${escape(SHARE.description)}" />`,
    `<meta name="application-name" content="${SHARE.name}" />`,
    `<meta name="apple-mobile-web-app-title" content="${SHARE.name}" />`,
    `<meta name="theme-color" content="${SHARE.themeColor}" />`,
    `<link rel="canonical" href="${SITE}/" />`,
    `<link rel="manifest" href="/manifest.json" />`,
    `<link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:site_name" content="${SHARE.name}" />`,
    `<meta property="og:title" content="${escape(SHARE.title)}" />`,
    `<meta property="og:description" content="${escape(SHARE.description)}" />`,
    `<meta property="og:url" content="${SITE}/" />`,
    `<meta property="og:image" content="${SHARE.image}" />`,
    `<meta property="og:image:type" content="image/png" />`,
    `<meta property="og:image:width" content="1200" />`,
    `<meta property="og:image:height" content="630" />`,
    `<meta property="og:image:alt" content="${escape(SHARE.imageAlt)}" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${escape(SHARE.title)}" />`,
    `<meta name="twitter:description" content="${escape(SHARE.description)}" />`,
    `<meta name="twitter:image" content="${SHARE.image}" />`,
    `<meta name="twitter:image:alt" content="${escape(SHARE.imageAlt)}" />`,
    // "<" is written as \u003c so nothing in the text can end the script tag early.
    `<script type="application/ld+json">${JSON.stringify(about).replace(/</g, '\\u003c')}</script>`,
  ];
}

/**
 * The built page with its title replaced, the tags above added, and a few plain words for
 * anything that reads the page without running the app. Throws when the page is not shaped as
 * expected, so a change in what Expo writes stops the deploy instead of quietly dropping the tags.
 */
function withHead(html) {
  if (!/<title>[^<]*<\/title>/.test(html) || !html.includes('</head>')) throw new Error('The built page has no <title> or no </head> to add the sharing tags to.');
  if (html.includes('property="og:title"')) return html;
  let out = html.replace(/<title>[^<]*<\/title>/, `<title>${escape(SHARE.title)}</title>`);
  out = out.replace('</head>', `  ${headTags().join('\n    ')}\n  </head>`);
  const words = `<noscript><h1>${escape(SHARE.title)}</h1><p>${escape(SHARE.description)}</p><p>SomeDaisy needs JavaScript switched on to run.</p></noscript>`;
  return /<noscript>[\s\S]*?<\/noscript>/.test(out) ? out.replace(/<noscript>[\s\S]*?<\/noscript>/, words) : out.replace('<body>', `<body>\n    ${words}`);
}

module.exports = { SITE, SHARE, headTags, withHead };
