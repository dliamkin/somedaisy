const fs = require('fs');
const path = require('path');

const { SHARE, SITE, headTags, withHead } = require('../web-head');

const root = path.join(__dirname, '..', '..');
// The page as Expo writes it for the website.
const built = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>SomeDaisy</title>
  <link rel="icon" href="/favicon.ico"/></head>

  <body>
    <noscript> You need to enable JavaScript to run this app. </noscript>
    <div id="root"></div>
  <script src="/_expo/static/js/web/entry.js" defer></script>
</body>
</html>`;

describe('withHead', () => {
  const page = withHead(built);

  it('sets the title and adds a description, the address and the sharing tags', () => {
    expect(page).toContain(`<title>${SHARE.title}</title>`);
    expect(page).not.toContain('<title>SomeDaisy</title>');
    expect(page).toContain('<meta name="description" content="Collect ideas');
    expect(page).toContain(`<link rel="canonical" href="${SITE}/" />`);
    expect(page).toContain(`<meta property="og:image" content="${SITE}/og.png" />`);
    expect(page).toContain('<meta name="twitter:card" content="summary_large_image" />');
    expect(page.match(/<\/head>/g)).toHaveLength(1);
    expect(page.indexOf('og:title')).toBeLessThan(page.indexOf('</head>'));
  });

  it('keeps everything the app needs to start', () => {
    expect(page).toContain('<div id="root"></div>');
    expect(page).toContain('<script src="/_expo/static/js/web/entry.js" defer></script>');
    expect(page).toContain('<link rel="icon" href="/favicon.ico"/>');
  });

  it('says what the site is to anything that does not run the app', () => {
    expect(page).toContain(`<noscript><h1>${SHARE.title}</h1>`);
    expect(page).not.toContain('You need to enable JavaScript to run this app.');
  });

  it('changes nothing the second time', () => {
    expect(withHead(page)).toBe(page);
  });

  it('refuses a page it does not recognise, so a deploy cannot quietly lose the tags', () => {
    expect(() => withHead('<html><body></body></html>')).toThrow('no <title>');
  });
});

describe('the sharing tags', () => {
  it('escape quotes and carry structured data that reads back as written', () => {
    const tags = headTags();
    for (const tag of tags.filter((t) => t.startsWith('<meta'))) expect(tag.match(/"/g).length % 2).toBe(0);
    const data = JSON.parse(tags.find((t) => t.includes('ld+json')).replace(/<\/?script[^>]*>/g, ''));
    expect(data).toMatchObject({ '@type': 'WebApplication', name: 'SomeDaisy', url: `${SITE}/` });
  });

  it('keep the title and description within what previews and search results show', () => {
    expect(SHARE.title.length).toBeLessThanOrEqual(60);
    expect(SHARE.description.length).toBeLessThanOrEqual(160);
  });
});

describe('the files the tags point at', () => {
  const size = (file) => {
    const png = fs.readFileSync(path.join(root, 'public', file));
    return [png.readUInt32BE(16), png.readUInt32BE(20)];
  };

  it('are all there, at the sizes the tags and the manifest promise', () => {
    expect(size('og.png')).toEqual([1200, 630]);
    expect(size('icons/apple-touch-icon.png')).toEqual([180, 180]);
    const manifest = JSON.parse(fs.readFileSync(path.join(root, 'public', 'manifest.json'), 'utf8'));
    expect(manifest.name).toBe('SomeDaisy');
    for (const icon of manifest.icons) {
      const [w, h] = icon.sizes.split('x').map(Number);
      expect(size(icon.src.replace(/^\//, ''))).toEqual([w, h]);
    }
  });

  it('tint the phone browser bars the same in the page and in the home-screen app, so no strip of another colour shows', () => {
    const manifest = JSON.parse(fs.readFileSync(path.join(root, 'public', 'manifest.json'), 'utf8'));
    expect(manifest.theme_color).toBe(SHARE.themeColor);
    expect(manifest.background_color).toBe(SHARE.themeColor);
  });

  it('include a sitemap and a robots file that point at the real address', () => {
    expect(fs.readFileSync(path.join(root, 'public', 'robots.txt'), 'utf8')).toContain(`Sitemap: ${SITE}/sitemap.xml`);
    expect(fs.readFileSync(path.join(root, 'public', 'sitemap.xml'), 'utf8')).toContain(`<loc>${SITE}/</loc>`);
  });

  it('keep the admin page out of search engines, without pointing anyone at it', () => {
    const headers = fs.readFileSync(path.join(root, 'public', '_headers'), 'utf8').replace(/\r/g, '');
    expect(headers).toContain('\n/admin\n  X-Robots-Tag: noindex, nofollow\n');
    expect(headers).toContain('\n/admin/*\n  X-Robots-Tag: noindex, nofollow\n');
    // Naming it in these two would advertise it, and robots.txt would stop the rule above being read.
    expect(fs.readFileSync(path.join(root, 'public', 'robots.txt'), 'utf8')).not.toMatch(/admin/i);
    expect(fs.readFileSync(path.join(root, 'public', 'sitemap.xml'), 'utf8')).not.toMatch(/admin/i);
  });
});
