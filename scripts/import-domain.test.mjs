import test from 'node:test';
import assert from 'node:assert/strict';
import { csv, decimal, collector, match, ckExecutableQuantity, bulkIdentityMatches } from './import-domain.mjs';
const base = { 'Scryfall ID': 'same-id', 'Set code': 'SLD', 'Collector number': '1596★', Foil: 'foil', Language: 'en', Condition: 'near_mint' };
const holdings = [{ id: 'english-foil', raw: base }, { id: 'japanese-foil', raw: { ...base, Language: 'ja' } }, { id: 'english-normal', raw: { ...base, Foil: 'normal' } }];
test('CSV keeps quoted commas, newlines, Unicode, and rejects duplicate headers', () => {
  assert.deepEqual(csv('Name,Note\r\n"A, B","line 1\nline 2 ★"\r\n'), [{ Name: 'A, B', Note: 'line 1\nline 2 ★' }]);
  assert.throws(() => csv('Name,Name\nA,B'), /duplicate/);
});
test('prices distinguish missing and zero without floating-point changes', () => {
  assert.equal(decimal(''), null); assert.equal(decimal('0.00'), '0'); assert.equal(decimal('19.9900'), '19.99');
  assert.throws(() => decimal('unavailable'));
});
test('identity never joins finishes, languages, or conditions by UUID alone', () => {
  assert.equal(match(base, holdings).holdingId, 'english-foil');
  assert.equal(match({ ...base, Language: '' }, holdings).status, 'ambiguous');
  assert.equal(match({ ...base, Condition: 'good' }, holdings).status, 'unmatched');
  assert.equal(match({ ...base, 'Collector number': '1597★' }, holdings).status, 'identity_fields_conflict');
});
test('collector normalization retains special suffixes', () => {
  assert.equal(collector('001596★'), '1596★'); assert.notEqual(collector('1596★'), collector('1596'));
});
test('zero dealer demand yields zero capacity and absent demand is unknown', () => {
  assert.equal(ckExecutableQuantity(3, '0', true), 0);
  assert.equal(ckExecutableQuantity(3, '1', true), 1);
  assert.equal(ckExecutableQuantity(3, null, true), null);
  assert.equal(ckExecutableQuantity(3, '4', false), null);
});
test('ManaBox normal maps to Scryfall nonfoil while foil and etched stay distinct', () => {
  const card = { set: 'sld', collector_number: '1596★', finishes: ['nonfoil', 'foil'] };
  assert.equal(bulkIdentityMatches({ ...base, Foil: 'normal' }, card), true);
  assert.equal(bulkIdentityMatches(base, card), true);
  assert.equal(bulkIdentityMatches({ ...base, Foil: 'etched' }, card), false);
});
