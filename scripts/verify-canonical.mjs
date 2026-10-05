import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { appClient, root } from './database.mjs';
import { adoptCanonical, canonicalSummary } from './canonical-store.mjs';
const c=await appClient();
let checks=0;
async function rejected(sql,values,pattern) {
  await c.query('SAVEPOINT invalid_case');
  let error;
  try {await c.query(sql,values);} catch(e) {error=e;}
  await c.query('ROLLBACK TO SAVEPOINT invalid_case');
  assert.ok(error,'Expected SQL rejection');
  assert.match(error.message,pattern); checks++;
}
try {
  await c.query('BEGIN');
  if(process.argv.includes('--prepare')) await c.query(readFileSync(join(root,'migrations/0002_canonical_store.sql'),'utf8'));
  const assumptions=JSON.parse(readFileSync(join(root,'docs/assumptions.json'),'utf8'));
  await adoptCanonical(c,assumptions);
  const before=await canonicalSummary(c);
  const additions=(await c.query("SELECT count(*)::int lots,coalesce(sum((value->>'quantity')::int),0)::int copies FROM canonical_assertions WHERE field_name='inventory_addition' AND authority='accepted_inventory'")).rows[0];
  assert.equal(before.lots,723+additions.lots); assert.equal(before.owned,817+additions.copies); assert.equal(before.available,before.owned); checks++;
  const replay=await adoptCanonical(c,assumptions);
  assert.equal(replay.alreadyAdopted,true); assert.deepEqual(await canonicalSummary(c),before); checks++;
  const differences=(await c.query(`SELECT count(*)::int AS n FROM canonical_inventory i JOIN inventory_holdings h ON h.id=i.origin_record_id
    WHERE i.owned_quantity<>h.quantity OR i.finish<>h.finish OR i.collector_number<>h.collector_number
    OR i.set_code<>lower(h.set_code) OR (i.printed_language<>h.language AND NOT(i.set_code='one' AND i.printed_language='ph')
      AND NOT EXISTS(SELECT 1 FROM canonical_assertions a WHERE a.lot_id=i.lot_id AND a.field_name='printed_language'
        AND a.authority='owner' AND a.value=to_jsonb(i.printed_language)))`)).rows[0].n;
  assert.equal(differences,0); checks++;
  assert.equal((await c.query("SELECT count(*)::int n FROM canonical_inventory WHERE printed_language='ph'")).rows[0].n,8); checks++;
  const frog=(await c.query("SELECT * FROM canonical_inventory WHERE set_code='mh3' AND collector_number='433'")).rows[0];
  assert.equal(frog.finish,'normal'); assert.equal(frog.owned_quantity,1); checks++;
  assert.equal((await c.query("SELECT printed_language FROM canonical_inventory WHERE name='Gigantosaurus'")).rows[0].printed_language,'ja'); checks++;
  assert.ok(before.eligible_observations>=0);
  // Preparation starts empty; live adoption replay must preserve later proposals.
  // Their evidence and arithmetic are checked by the decision-specific verifier.
  if(process.argv.includes('--prepare')) assert.equal(before.new_decisions,0);
  checks++;
  await rejected('UPDATE inventory_holdings SET quantity=quantity+1 WHERE id=$1',[frog.origin_record_id],/historical after canonical cutover/);
  await rejected('UPDATE source_records SET raw=raw WHERE id=$1',[frog.origin_record_id],/append-only/);
  await rejected(`INSERT INTO canonical_stock_movements(lot_id,quantity,from_state,to_state,reason,idempotency_key)
    VALUES($1,2,'available','reserved','constraint test','test-over-reserve')`,[frog.lot_id],/Insufficient stock/);
  await c.query(`INSERT INTO canonical_stock_movements(lot_id,quantity,from_state,to_state,reason,idempotency_key)
    VALUES($1,1,'available','reserved','constraint test','test-reserve')`,[frog.lot_id]);
  const reserved=(await c.query('SELECT available_quantity,owned_quantity FROM canonical_inventory WHERE lot_id=$1',[frog.lot_id])).rows[0];
  assert.deepEqual(reserved,{available_quantity:0,owned_quantity:1}); checks++;
  await rejected(`INSERT INTO canonical_stock_movements(lot_id,quantity,from_state,to_state,reason,idempotency_key)
    VALUES($1,1,'available','reserved','constraint test','test-second-reserve')`,[frog.lot_id],/Insufficient stock/);
  await rejected("UPDATE canonical_stock_movements SET quantity=2 WHERE lot_id=$1",[frog.lot_id],/append-only/);
  await rejected(`INSERT INTO canonical_stock_movements(lot_id,quantity,from_state,to_state,reason,idempotency_key)
    VALUES($1,1,'external','available','duplicate','test-reserve')`,[frog.lot_id],/unique constraint/);
  await c.query(`INSERT INTO canonical_stock_movements(lot_id,quantity,from_state,to_state,reason,idempotency_key)
    VALUES($1,1,'reserved','available','release test','test-release')`,[frog.lot_id]);
  assert.deepEqual(await canonicalSummary(c),before); checks++;
  const map=(await c.query("SELECT id FROM canonical_product_mappings WHERE variant_id=$1 AND status='accepted'",[frog.variant_id])).rows[0];
  assert.ok(map);
  const capture=(await c.query(`INSERT INTO canonical_captures(provider,upstream_provider,content_hash,captured_at,use_state,sample_kind,completeness)
    VALUES('test','test','test',now(),'historical','unknown','unknown') RETURNING id`)).rows[0].id;
  await c.query(`INSERT INTO canonical_observations(capture_id,mapping_id,source_locator,provider_subject,metric,evidence_kind,numeric_value,currency,unit,limitations,raw)
    VALUES($1,$2,'test','test','price','asking_price',999,'USD','per_copy','historical test','{}')`,[capture,map.id]);
  assert.equal((await canonicalSummary(c)).eligible_observations,before.eligible_observations); checks++;
  await rejected('UPDATE canonical_observations SET numeric_value=1000 WHERE capture_id=$1',[capture],/append-only/);
  const liveCapture=(await c.query(`INSERT INTO canonical_captures(provider,upstream_provider,content_hash,captured_at,use_state,sample_kind,completeness)
    VALUES('test','test','new',now(),'eligible','fixed_count','capped') RETURNING id`)).rows[0].id;
  const wrongMap=(await c.query(`INSERT INTO canonical_product_mappings(variant_id,provider,product_id,condition_scope,finish_scope,language_scope,status,basis)
    VALUES($1,'test','foil','near_mint','foil','en','accepted','deliberately incompatible test') RETURNING id`,[frog.variant_id])).rows[0].id;
  await c.query(`INSERT INTO canonical_observations(capture_id,mapping_id,source_locator,provider_subject,metric,evidence_kind,numeric_value,currency,unit,limitations,raw)
    VALUES($1,$2,'foil','foil','price','asking_price',999,'USD','per_copy','wrong finish test','{}')`,[liveCapture,wrongMap]);
  assert.equal((await canonicalSummary(c)).eligible_observations,before.eligible_observations); checks++;
  await c.query(`INSERT INTO canonical_observations(capture_id,mapping_id,source_locator,provider_subject,metric,evidence_kind,numeric_value,currency,unit,limitations,raw)
    VALUES($1,$2,'normal','normal','price','asking_price',9,'USD','per_copy','correct finish test','{}')`,[liveCapture,map.id]);
  assert.equal((await canonicalSummary(c)).eligible_observations,before.eligible_observations+1); checks++;
  assert.equal((await canonicalSummary(c)).owned,before.owned); checks++;
  console.log(`PASS: ${checks} canonical adoption/inventory/evidence checks; all test writes rolled back.`);
} finally {await c.query('ROLLBACK'); await c.end();}
