// Runs every database test file in this folder against an in-memory Postgres.
// Usage: npm run test:db
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { summary } from './harness.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
for (const file of fs.readdirSync(here).filter((f) => f.endsWith('.test.mjs')).sort()) {
  console.log(`
== ${file} ==`);
  await import(pathToFileURL(path.join(here, file)).href);
}
summary();
