import { createHash } from 'node:crypto';
import { parse } from 'csv-parse/sync';

export function hash(value) { return createHash('sha256').update(value).digest('hex'); }
export function csv(text) {
  return parse(text, { bom: true, skip_empty_lines: true, columns(headers) {
    if (headers.some(h => !h) || new Set(headers).size !== headers.length) throw new Error('Missing or duplicate CSV headers');
    return headers;
  } });
}
export function decimal(value) {
  if (value === '' || value === null || value === undefined) return null;
  const text = String(value).trim();
  if (!/^-?\d+(?:\.\d+)?$/.test(text)) throw new Error('Invalid decimal input');
  const negative = text.startsWith('-');
  let [integer, fraction = ''] = text.replace(/^-/, '').split('.');
  integer = integer.replace(/^0+(?=\d)/, '');
  fraction = fraction.replace(/0+$/, '');
  const normalized = integer + (fraction ? '.' + fraction : '');
  return negative && normalized !== '0' ? '-' + normalized : normalized;
}
export function integer(value) {
  const normalized = decimal(value);
  if (normalized === null || !/^\d+$/.test(normalized) || !Number.isSafeInteger(Number(normalized))) throw new Error('Invalid nonnegative integer input');
  return Number(normalized);
}
export function collector(value) {
  return String(value).replace(/^0+(?=\d)/, ''); // Preserve stars and suffixes.
}
export function condition(value) {
  return ({ NM: 'near_mint', EX: 'excellent', VG: 'good' })[value] ?? value;
}
export function identity(row) {
  return {
    id: row['Scryfall ID'] || row.scryfall_id || null,
    name: row.Name || row.name,
    set: (row['Set code'] || row.Set || row.set_code || '').toLowerCase(),
    collector: collector(row['Collector number'] || row['Collector #'] || row.Number || row.collector_number || ''),
    finish: row.Foil || row.Finish || row.finish || '',
    language: row.Language || row.language || '',
    condition: condition(row.Condition || row.condition || '')
  };
}
export function variantKey(value) { return [value.id, value.finish, value.language, value.condition].join('|'); }
export function match(row, holdings) {
  const wanted = identity(row);
  const candidates = holdings.filter(h => {
    const actual = identity(h.raw);
    return (wanted.id ? actual.id === wanted.id : actual.set === wanted.set && actual.collector === wanted.collector)
      && actual.finish === wanted.finish
      && (!wanted.language || actual.language === wanted.language)
      && (!wanted.condition || actual.condition === wanted.condition);
  });
  if (candidates.length === 1) {
    const actual = identity(candidates[0].raw);
    if (wanted.id && ((wanted.set && wanted.set !== actual.set) || (wanted.collector && wanted.collector !== actual.collector))) {
      return { holdingId: null, status: 'identity_fields_conflict', candidates: [candidates[0].id] };
    }
    return { holdingId: candidates[0].id, status: wanted.language && wanted.condition && wanted.id ? 'exact' : 'unique_partial_identity', candidates: [candidates[0].id] };
  }
  return { holdingId: null, status: candidates.length ? 'ambiguous' : 'unmatched', candidates: candidates.map(h => h.id) };
}
export function ckExecutableQuantity(quantity, wanted, eligible) {
  return eligible && wanted !== null ? Math.min(quantity, integer(wanted)) : null;
}
export function bulkIdentityMatches(raw, card) {
  const actual = identity(raw);
  const referenceFinish = actual.finish === 'normal' ? 'nonfoil' : actual.finish;
  return card.set === actual.set && collector(card.collector_number) === actual.collector
    && card.finishes.includes(referenceFinish);
}
