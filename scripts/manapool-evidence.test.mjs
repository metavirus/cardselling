import test from 'node:test';
import assert from 'node:assert/strict';
import {matchProduct,observations,cents} from './manapool-evidence.mjs';
const lot={source_scryfall_id:'id',set_code:'one',collector_number:'367',printed_language:'ph',finish:'foil',condition_normalized:'near_mint'};
const product={product_type:'mtg_single',language_id:'PH',finish_id:'FO',condition_id:'NM',available_quantity:0,low_price:0,recent_sales:[]};
const parent={scryfall_id:'id',set_code:'ONE',number:'367',variants:[product]};
test('Exact language, finish, condition and printing are independently required',()=>{
  assert.equal(matchProduct(lot,parent).product,product);
  for(const change of [{printed_language:'en'},{finish:'normal'},{collector_number:'368'},{source_scryfall_id:'other'}])assert.ok(matchProduct({...lot,...change},parent).reason);
  assert.ok(matchProduct(lot,parent,'LP').reason);
  assert.equal(matchProduct({...lot,condition_normalized:null},parent,'NM').product,product);
  assert.equal(matchProduct(lot,{...parent,variants:[product,product]}).reason,'ambiguous_variant');
});
test('Unavailable price stays absent; stock zero is a real observation',()=>{
  assert.equal(observations(product,'2026-10-04T20:00:00Z').length,1);
  assert.equal(observations({...product,available_quantity:3},'2026-10-04T20:00:00Z').length,1);
  assert.equal(cents(12345),'123.45');assert.equal(cents(1),'0.01');assert.throws(()=>cents(1.2));
});
test('Sale sample preserves quantity, exact cents and timestamp without inventing unit totals',()=>{
  const p={...product,recent_sales:[{price:123,quantity:3,created_at:'2026-10-03T12:30:00+00:00'}]};
  const sale=observations(p,'2026-10-04T20:00:00Z')[1];
  assert.equal(sale.value,'1.23');assert.equal(sale.quantity,3);assert.equal(sale.unit,'reported_price');
  assert.throws(()=>observations(p,'2026-10-02T00:00:00Z'));
  assert.throws(()=>observations({...p,recent_sales:Array(21).fill(p.recent_sales[0])},'2026-10-04T20:00:00Z'));
});
