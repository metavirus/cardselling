import { createHash } from 'node:crypto';

export function checksum(sql) { return createHash('sha256').update(sql.replaceAll('\r\n', '\n')).digest('hex'); }
export function pendingMigrations(files, applied) {
  const byName = new Map(files.map(file => [file.name, file]));
  for (const record of applied) {
    const file = byName.get(record.name);
    if (!file || checksum(file.sql) !== record.checksum) throw new Error(`Applied migration was removed or changed: ${record.name}`);
  }
  const names = new Set(applied.map(record => record.name));
  let pendingFound = false;
  for (const file of files) {
    if (!names.has(file.name)) pendingFound = true;
    else if (pendingFound) throw new Error(`Migration order was changed before ${file.name}`);
  }
  return files.filter(file => !names.has(file.name));
}
