import test from 'node:test';
import assert from 'node:assert/strict';
import { checksum, pendingMigrations } from './migration-plan.mjs';
const first = { name: '0000_initial.sql', sql: 'create table first (id integer);' };
const second = { name: '0001_second.sql', sql: 'create table second (id integer);' };
const appliedFirst = { name: first.name, checksum: checksum(first.sql) };

test('Windows line-ending changes do not alter migration identity', () => {
  assert.equal(checksum('SELECT 1;\r\n'), checksum('SELECT 1;\n'));
});

test('repeat migration runs are no-ops', () => {
  assert.deepEqual(pendingMigrations([first], [appliedFirst]), []);
});
test('changed or removed applied migrations are rejected', () => {
  assert.throws(() => pendingMigrations([{ ...first, sql: 'drop table first;' }], [appliedFirst]), /changed/);
  assert.throws(() => pendingMigrations([], [appliedFirst]), /removed/);
});
test('forward migrations apply once and out-of-order history is rejected', () => {
  assert.deepEqual(pendingMigrations([first, second], [appliedFirst]), [second]);
  assert.throws(() => pendingMigrations([first, second], [{ name: second.name, checksum: checksum(second.sql) }]), /order/);
});
