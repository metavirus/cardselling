// Apply the owner's settled language and grade corrections; raw scan records stay intact.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {appClient} from './database.mjs';
const uuid=value=>{const h=createHash('sha256').update(value).digest('hex');return `${h.slice(0,8)}-${h.slice(8,12)}-5${h.slice(13,16)}-a${h.slice(17,20)}-${h.slice(20,32)}`;};
const c=await appClient();
const soaNumbers=['72','80','116','124','126'];
try {
 await c.query('BEGIN');await c.query("SELECT pg_advisory_xact_lock(hashtext('owner-clarifications-2026-10-04'))");
 const before=(await c.query('SELECT sum(owned_quantity)::int owned,sum(available_quantity)::int available,count(*)::int lots FROM canonical_inventory')).rows[0];
 assert.deepEqual(before,{owned:817,available:817,lots:723});
 const rows=(await c.query(`SELECT i.*,r.raw->>'Language' source_language FROM canonical_inventory i JOIN source_records r ON r.id=i.origin_record_id WHERE i.set_code='soa' AND i.collector_number=ANY($1) AND i.finish='normal' ORDER BY i.collector_number,i.lot_id`,[soaNumbers])).rows;
 // Collector #72/#80/#126 have two distinct scan lots, already including one JA lot.
 assert.equal(rows.length,8);assert.equal(rows.filter(r=>r.printed_language==='en').length===5 || rows.filter(r=>r.printed_language==='en').length===0,true);
 let languages=0,grades=0;
 for(const row of rows.filter(r=>r.printed_language==='en')) {
  assert.equal(row.source_language,'en');
  const candidate=(await c.query(`SELECT * FROM canonical_product_mappings WHERE variant_id=$1 AND provider='Scryfall' AND status='candidate' AND language_scope='ja' AND NOT EXISTS(SELECT 1 FROM canonical_product_mappings newer WHERE newer.supersedes_id=canonical_product_mappings.id)`,[row.variant_id])).rows;
  assert.equal(candidate.length,1);
  const source=(await c.query("SELECT raw->>'Scryfall ID' id FROM source_records WHERE id=$1",[row.origin_record_id])).rows[0];
  assert.equal(candidate[0].product_id,source.id);
  await c.query("UPDATE canonical_variants SET printed_language='ja',identity_basis=identity_basis || '; owner-confirmed Japanese-only SOA treatment, English pack/export label retained in source' WHERE id=$1 AND printed_language='en'",[row.variant_id]);
  await c.query(`INSERT INTO canonical_assertions(id,lot_id,variant_id,field_name,value,authority,basis,source_record_id) VALUES($1,$2,$3,'printed_language',$4,'owner',$5,$6) ON CONFLICT(id) DO NOTHING`,[
   uuid(`owner-soa-language:${row.lot_id}`),row.lot_id,row.variant_id,JSON.stringify('ja'),
   'Owner confirms Japanese-language SOA alternate-art cards can come from English packs; Scryfall ID/collector treatment is Japanese-only. The scan’s English label and separate physical lot are retained.',row.origin_record_id]);
  await c.query(`INSERT INTO canonical_product_mappings(id,variant_id,provider,product_id,condition_scope,finish_scope,language_scope,status,basis,source_record_id,capture_id,supersedes_id)
   VALUES($1,$2,'Scryfall',$3,'not_applicable','normal','ja','accepted',$4,$5,$6,$7) ON CONFLICT(id) DO NOTHING`,[
   uuid(`owner-soa-mapping:${candidate[0].id}`),row.variant_id,candidate[0].product_id,'Owner-confirmed Japanese-only SOA printing; exact source Scryfall ID, finish and collector number agree',row.origin_record_id,candidate[0].capture_id,candidate[0].id]);
  languages++;
 }
 const lower=(await c.query(`SELECT * FROM canonical_inventory WHERE (name='Words of Wind' AND set_code='ons' AND collector_number='122') OR (name='Words of Wilding' AND set_code='ons' AND collector_number='305') OR (name='Pride Sovereign' AND set_code='hou' AND collector_number='126') ORDER BY name`)).rows;
 assert.equal(lower.length,3);assert.deepEqual(lower.map(r=>r.condition_raw).sort(),['excellent','good','good']);
 for(const row of lower) {
  if(row.condition_normalized==='lightly_played')continue;
  assert.equal(row.condition_normalized,null);
  await c.query("UPDATE canonical_lots SET condition_normalized='lightly_played' WHERE id=$1 AND condition_normalized IS NULL",[row.lot_id]);
  await c.query(`INSERT INTO canonical_assertions(id,lot_id,variant_id,field_name,value,authority,basis,source_record_id) VALUES($1,$2,$3,'condition_normalized',$4,'owner',$5,$6) ON CONFLICT(id) DO NOTHING`,[
   uuid(`owner-condition-lp:${row.lot_id}`),row.lot_id,row.variant_id,JSON.stringify('lightly_played'),
   'Owner clarifies nearly all cards are highest Near Mint and the few cards with issues are one level below, Lightly Played. Raw ManaBox good/excellent labels remain as source evidence.',row.origin_record_id]);
  grades++;
 }
 const after=(await c.query('SELECT sum(owned_quantity)::int owned,sum(available_quantity)::int available,count(*)::int lots FROM canonical_inventory')).rows[0];
 assert.deepEqual(after,before);
 assert.equal((await c.query("SELECT count(*)::int n FROM canonical_inventory WHERE condition_normalized='near_mint'")).rows[0].n,720);
 assert.equal((await c.query("SELECT count(*)::int n FROM canonical_inventory WHERE condition_normalized='lightly_played'")).rows[0].n,3);
 assert.equal((await c.query("SELECT count(*)::int n FROM canonical_inventory WHERE set_code='soa' AND collector_number=ANY($1) AND printed_language='en' AND finish='normal'",[soaNumbers])).rows[0].n,0);
 assert.equal((await c.query("SELECT count(*)::int n FROM canonical_product_mappings m JOIN canonical_variants v ON v.id=m.variant_id WHERE v.set_code='soa' AND v.collector_number=ANY($1) AND m.provider='Scryfall' AND m.status='candidate' AND NOT EXISTS(SELECT 1 FROM canonical_product_mappings later WHERE later.supersedes_id=m.id)",[soaNumbers])).rows[0].n,0);
 await c.query(process.argv.includes('--apply')?'COMMIT':'ROLLBACK');
 console.log(JSON.stringify({status:process.argv.includes('--apply')?'applied':'rolled_back',corrected_languages:languages,corrected_grades:grades,inventory:after}));
}catch(error){await c.query('ROLLBACK');throw error;}finally{await c.end();}
