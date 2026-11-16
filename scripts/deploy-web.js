// Builds the web version and publishes it to Cloudflare Pages (project "somedaisy").
// Run with: npm run deploy:web
// The Supabase URL and key are read from .env at build time and baked into the site.

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const dist = path.join(root, 'dist');
const run = (cmd) => execSync(cmd, { cwd: root, stdio: 'inherit' });

fs.rmSync(dist, { recursive: true, force: true });
run('npx expo export -p web --clear');

// Cloudflare's uploader skips any folder named node_modules, and Expo puts the images that ship
// with its libraries in dist/assets/node_modules. Rename that folder and update the references.
const skipped = path.join(dist, 'assets', 'node_modules');
if (fs.existsSync(skipped)) {
  fs.renameSync(skipped, path.join(dist, 'assets', 'vendor'));
  const jsDir = path.join(dist, '_expo', 'static', 'js', 'web');
  for (const file of fs.readdirSync(jsDir)) {
    if (!file.endsWith('.js')) continue;
    const full = path.join(jsDir, file);
    const before = fs.readFileSync(full, 'utf8');
    const after = before.split('/assets/node_modules/').join('/assets/vendor/');
    if (after !== before) fs.writeFileSync(full, after);
  }
}

// The title, description and link-preview tags (see scripts/web-head.js).
const { withHead } = require('./web-head');
const page = path.join(dist, 'index.html');
fs.writeFileSync(page, withHead(fs.readFileSync(page, 'utf8')));
for (const file of ['og.png', 'manifest.json', 'robots.txt', 'sitemap.xml', 'icons/apple-touch-icon.png']) {
  if (!fs.existsSync(path.join(dist, file))) throw new Error(`The built site is missing ${file}, which the page's tags point at.`);
}

run('npx wrangler@latest pages deploy dist --project-name somedaisy --branch main --commit-dirty=true');
