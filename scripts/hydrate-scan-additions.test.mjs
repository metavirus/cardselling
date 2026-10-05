import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeFactRows} from './scan-market-rows.mjs';
test('mixed sales, rank and history retain dates and currency regardless of first-row shape',()=>{
 const sale={id:'sale',numeric_value:'10.00',currency:'USD',observed_at:'2026-10-01T12:00:00Z',sample_count:20};
 const rank={id:'rank',numeric_value:3,unit:'ordinal_rank'};
 const price={id:'price',numeric_value:'9.75',currency:'USD',window_start:'2026-10-04T00:00:00Z',window_end:'2026-10-05T00:00:00Z'};
 for(const input of [[sale,rank,price],[rank,price,sale],[price,sale,rank]]){
  const {keys,rows}=normalizeFactRows(input),parsed=JSON.parse(JSON.stringify(rows));
  assert.ok(keys.includes('window_start'));assert.ok(keys.includes('currency'));
  assert.equal(parsed.find(r=>r.id==='price').window_start,price.window_start);
  assert.equal(parsed.find(r=>r.id==='price').window_end,price.window_end);
  assert.equal(parsed.find(r=>r.id==='price').currency,'USD');
  assert.equal(parsed.find(r=>r.id==='sale').observed_at,sale.observed_at);
  assert.equal(parsed.find(r=>r.id==='rank').currency,null);
  for(const row of parsed)assert.deepEqual(Object.keys(row),keys);
 }
});
