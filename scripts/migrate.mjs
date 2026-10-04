import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { appClient, backup, root } from './database.mjs';
import { checksum, pendingMigrations } from './migration-plan.mjs';

let client;
try {
  const files = readdirSync(join(root, 'migrations')).filter(name => /^\d+.*\.sql$/.test(name)).sort().map(name => ({ name, sql: readFileSync(join(root, 'migrations', name), 'utf8') }));
  client = await appClient();
  await client.query("SELECT pg_advisory_lock(hashtext('cardselling_migrations'))");
  await client.query('CREATE TABLE IF NOT EXISTS app_migrations (name text PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())');
  const applied = (await client.query('SELECT name, checksum FROM app_migrations ORDER BY name')).rows;
  const pending = pendingMigrations(files, applied);
  if (pending.length && applied.length) await backup();
  await client.query('BEGIN');
  for (const file of pending) {
    await client.query(file.sql);
    await client.query('INSERT INTO app_migrations (name, checksum) VALUES ($1, $2)', [file.name, checksum(file.sql)]);
  }
  await client.query('COMMIT');
  console.log(pending.length ? `Applied ${pending.length} migration(s).` : 'Migrations already up to date; no changes.');
} catch (error) {
  if (client) await client.query('ROLLBACK').catch(() => {});
  console.error(String(error.message).replace(/postgres(?:ql)?:\/\/\S+/g, '[redacted connection]'));
  process.exitCode = 1;
} finally {
  if (client) await client.end();
}
