import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import dotenv from 'dotenv';

export const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const configPath = join(root, '.local', 'database.json');
const pgBin = 'C:/Program Files/PostgreSQL/18/bin';
const databaseHome = 'C:/Users/kavig/Documents/Codex/cardselling-local';
const expectedData = join(databaseHome, 'postgres');
const port = 5440;
const databaseName = 'cardselling';

function runPg(name, args, options = {}) {
  return execFileSync(join(pgBin, `${name}.exe`), args, { stdio: 'pipe', timeout: 35000, ...options });
}
function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });
}
export function config() {
  if (!existsSync(configPath)) throw new Error('Database is not configured. Run npm run db:setup.');
  const value = JSON.parse(readFileSync(configPath, 'utf8'));
  if (resolve(value.data) !== resolve(expectedData) || value.port !== port || value.database !== databaseName) {
    throw new Error('Local database identity differs from the configured cardselling target.');
  }
  if (!existsSync(join(value.data, 'PG_VERSION'))) throw new Error('Existing cluster is missing. Restore it; do not reinitialize.');
  const disk = runPg('pg_controldata', [value.data], { encoding: 'utf8', env: { ...process.env, LC_ALL: 'C' } });
  const identifier = disk.match(/Database system identifier:\s*(\d+)/)?.[1];
  if (!identifier || identifier !== value.systemIdentifier) throw new Error('PostgreSQL cluster identity does not match.');
  return value;
}
function adminOptions(value, db = databaseName) {
  const admin = JSON.parse(readFileSync(join(databaseHome, 'admin.json'), 'utf8'));
  return { host: '127.0.0.1', port, user: 'cardselling_admin', password: admin.password, database: db, connectionTimeoutMillis: 4000 };
}
export async function appClient() {
  const value = config();
  const localEnv = dotenv.parse(readFileSync(join(root, '.env.local')));
  const url = new URL(localEnv.DATABASE_URL);
  if (url.hostname !== '127.0.0.1' || Number(url.port) !== port || url.pathname !== `/${databaseName}` || url.username !== 'cardselling_app') {
    throw new Error('Refusing connection outside the pinned local cardselling database.');
  }
  const client = new pg.Client({ connectionString: localEnv.DATABASE_URL, connectionTimeoutMillis: 4000 });
  await client.connect();
  try {
    const result = await client.query('select current_database() as name, current_user as role, oid::text from pg_database where datname = current_database()');
    const row = result.rows[0];
    if (row.name !== databaseName || row.role !== 'cardselling_app' || row.oid !== value.databaseOid) {
      throw new Error('Connected database identity differs from the pinned target.');
    }
    return client;
  } catch (error) { await client.end(); throw error; }
}
export async function start() {
  const value = config();
  try {
    const existing = await appClient();
    await existing.end();
    console.log(`Cardselling database ready on 127.0.0.1:${port}.`);
    return;
  } catch (error) {
    // A wrong password or identity is not a stopped database. Never mask it.
    if (error.code !== 'ECONNREFUSED') throw error;
    runPg('pg_ctl', ['-D', value.data, '-l', join(databaseHome, 'postgres.log'), '-w', '-t', '30', 'start'], { stdio: 'ignore' });
  }
  const client = await appClient();
  await client.end();
  console.log(`Cardselling database ready on 127.0.0.1:${port}.`);
}
async function setup() {
  if (existsSync(configPath)) { await start(); return; }
  const resumeAdminOnly = process.argv.includes('--resume-admin-only');
  if (existsSync(expectedData) || existsSync(join(root, '.env.local')) || (existsSync(join(databaseHome, 'admin.json')) && !resumeAdminOnly)) {
    throw new Error('Partial or existing setup found. Inspect and resume explicitly; no automatic replacement.');
  }
  mkdirSync(databaseHome, { recursive: true });
  const adminPassword = resumeAdminOnly ? JSON.parse(readFileSync(join(databaseHome, 'admin.json'), 'utf8')).password : randomBytes(32).toString('base64url');
  const appPassword = randomBytes(32).toString('base64url');
  const passwordFile = join(databaseHome, 'bootstrap-password.txt');
  if (!resumeAdminOnly) writeJson(join(databaseHome, 'admin.json'), { password: adminPassword });
  writeFileSync(passwordFile, adminPassword, { flag: 'wx' });
  try {
    runPg('initdb', ['-D', expectedData, '-U', 'cardselling_admin', '--pwfile', passwordFile, '--auth=scram-sha-256', '--encoding=UTF8', '--locale=C']);
  } catch (error) {
    throw new Error(`initdb failed: ${String(error.stderr || error.stdout || 'unknown failure').replaceAll(adminPassword, '[redacted]').trim()}`);
  } finally { if (existsSync(passwordFile)) unlinkSync(passwordFile); }
  writeFileSync(join(expectedData, 'postgresql.auto.conf'), `# Cardselling only\nlisten_addresses = '127.0.0.1'\nport = ${port}\npassword_encryption = 'scram-sha-256'\n`);
  runPg('pg_ctl', ['-D', expectedData, '-l', join(databaseHome, 'postgres.log'), '-w', '-t', '30', 'start'], { stdio: 'ignore' });
  const admin = new pg.Client(adminOptions({}, 'postgres'));
  await admin.connect();
  let oid;
  try {
    await admin.query(`CREATE ROLE cardselling_app LOGIN PASSWORD '${appPassword}' NOSUPERUSER NOCREATEDB NOCREATEROLE`);
    await admin.query('CREATE DATABASE cardselling OWNER cardselling_app');
    oid = (await admin.query("select oid::text from pg_database where datname = 'cardselling'")).rows[0].oid;
  } finally { await admin.end(); }
  const disk = runPg('pg_controldata', [expectedData], { encoding: 'utf8', env: { ...process.env, LC_ALL: 'C' } });
  const identifier = disk.match(/Database system identifier:\s*(\d+)/)?.[1];
  if (!identifier) throw new Error('Unable to identify new PostgreSQL cluster.');
  writeJson(configPath, { data: expectedData, port, database: databaseName, databaseOid: oid, systemIdentifier: identifier });
  writeFileSync(join(root, '.env.local'), `DATABASE_URL=postgresql://cardselling_app:${appPassword}@127.0.0.1:${port}/cardselling\n`, { flag: 'wx' });
  await start();
}
export async function backup() {
  const value = config();
  const client = await appClient();
  await client.end();
  const dir = join(databaseHome, 'backups');
  mkdirSync(dir, { recursive: true });
  const path = join(dir, `cardselling-${new Date().toISOString().replaceAll(':', '-')}-${randomBytes(3).toString('hex')}.dump`);
  const options = adminOptions(value);
  runPg('pg_dump', ['-h', options.host, '-p', String(port), '-U', options.user, '-d', databaseName, '-Fc', '--no-owner', '--no-acl', '-f', path], { env: { ...process.env, PGPASSWORD: options.password } });
  console.log(`Backup saved: ${path}`);
  return path;
}
async function verifyBackup(path) {
  if (!path) throw new Error('Pass a backup path: npm run db:verify-backup -- <path>');
  const value = config();
  const options = adminOptions(value, 'postgres');
  const scratch = `cardselling_restore_${randomBytes(6).toString('hex')}`;
  const admin = new pg.Client(options);
  await admin.connect();
  let created = false;
  try {
    await admin.query(`CREATE DATABASE "${scratch}" OWNER cardselling_app`);
    created = true;
    runPg('pg_restore', ['-h', options.host, '-p', String(port), '-U', options.user, '-d', scratch, '--no-owner', '--no-acl', '--exit-on-error', '--single-transaction', resolve(path)], { env: { ...process.env, PGPASSWORD: options.password } });
    const restored = new pg.Client(adminOptions(value, scratch));
    await restored.connect();
    try {
      const result = await restored.query('select application from application_info');
      if (result.rows.length !== 1 || result.rows[0].application !== databaseName) throw new Error('Restored application identity is incorrect.');
      const ledger = await restored.query('select count(*)::int as count from app_migrations');
      if (ledger.rows[0].count < 1) throw new Error('Restored migration ledger is empty.');
      console.log('Backup successfully restored into an isolated temporary database; application identity and migration ledger verified.');
    } finally { await restored.end(); }
  } finally {
    if (created) await admin.query(`DROP DATABASE "${scratch}"`);
    await admin.end();
  }
}
async function check() {
  const client = await appClient();
  try {
    const identity = await client.query('select application from application_info');
    if (identity.rows.length !== 1 || identity.rows[0].application !== databaseName) throw new Error('Application marker missing or incorrect.');
    await client.query('BEGIN');
    await client.query("INSERT INTO application_info (id, application) VALUES (gen_random_uuid(), 'rollback-check')");
    await client.query('ROLLBACK');
    const after = await client.query('select count(*)::int as count from application_info');
    if (after.rows[0].count !== 1) throw new Error('Rollback did not preserve the initial record count.');
    const role = await client.query('select rolsuper, rolcreatedb, rolcreaterole from pg_roles where rolname = current_user');
    if (Object.values(role.rows[0]).some(Boolean)) throw new Error('Application role has unexpected administrative privileges.');
    console.log('Database identity, write/rollback, and non-admin app role verified.');
  } finally { await client.end(); }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    switch (process.argv[2]) {
      case 'setup': await setup(); break;
      case 'start': await start(); break;
      case 'status': { const client = await appClient(); await client.end(); console.log('Pinned cardselling database is reachable.'); break; }
      case 'stop': runPg('pg_ctl', ['-D', config().data, '-m', 'fast', '-w', 'stop'], { stdio: 'ignore' }); console.log('Cardselling database stopped.'); break;
      case 'backup': await backup(); break;
      case 'verify-backup': await verifyBackup(process.argv[3]); break;
      case 'check': await check(); break;
      default: throw new Error('Unknown database command.');
    }
  } catch (error) {
    // Never print a child-process error object: it can contain authentication arguments.
    const safeMessage = String(error.message).replace(/postgres(?:ql)?:\/\/\S+/g, '[redacted connection]');
    console.error(safeMessage.split('\n')[0]);
    process.exitCode = 1;
  }
}
