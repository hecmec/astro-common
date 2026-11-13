// Writes a consistent copy of the database: node src/backup.ts [target-file]
// Default target: <database dir>/backups/comments-<date>.db. Keeps the last 14 copies.
import { mkdirSync, readdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { loadConfig } from './config.ts';

const config = loadConfig();
const dir = join(dirname(config.databasePath), 'backups');
const target = process.argv[2] ?? join(dir, `comments-${new Date().toISOString().slice(0, 10)}.db`);
mkdirSync(dirname(target), { recursive: true });
rmSync(target, { force: true });

const db = new DatabaseSync(config.databasePath, { readOnly: true });
db.prepare('VACUUM INTO ?').run(target);
db.close();
console.log(`Backup written to ${target}`);

if (!process.argv[2]) {
  const old = readdirSync(dir).filter((f) => /^comments-\d{4}-\d{2}-\d{2}\.db$/.test(f)).sort().slice(0, -14);
  for (const f of old) rmSync(join(dir, f));
}
