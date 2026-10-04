import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {join} from 'node:path';
import {appClient,root} from './database.mjs';
const receipt=JSON.parse(readFileSync(join(root,'.local/market-ingestion/receipt.json'),'utf8'));
const c=await appClient();let checks=0;
async function count(sql,expected,args=[]) {assert.equal((await c.query(sql,args)).rows[0].n,expected);checks++;}
try {
 await c.query('BEGIN READ ONLY');
 await count('SELECT count(*)::int n FROM canonical_inventory',723);
 await count('SELECT sum(owned_quantity)::int n FROM canonical_inventory',817);
 await count('SELECT count(*)::int n FROM canonical_observations WHERE capture_id=$1',receipt.counts.observations,[receipt.capture_id]);
 await count('SELECT count(*)::int n FROM canonical_eligible_evidence WHERE capture_id=$1',receipt.counts.observations,[receipt.capture_id]);
 await count(`SELECT count(*)::int n FROM canonical_product_mappings m JOIN canonical_variants v ON v.id=m.variant_id WHERE m.provider='Mana Pool' AND (m.finish_scope<>v.finish OR m.language_scope<>v.printed_language)`,0);
 await count(`SELECT count(*)::int n FROM canonical_product_mappings m JOIN source_records r ON r.id=m.source_record_id WHERE m.provider='Mana Pool' AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(r.raw->'variants') p WHERE p->>'product_id'=m.product_id AND lower(p->>'language_id')=m.language_scope AND p->>'finish_id'=CASE m.finish_scope WHEN 'normal' THEN 'NF' WHEN 'foil' THEN 'FO' ELSE 'EF' END AND p->>'condition_id'=CASE m.condition_scope WHEN 'near_mint' THEN 'NM' WHEN 'lightly_played' THEN 'LP' WHEN 'moderately_played' THEN 'MP' WHEN 'heavily_played' THEN 'HP' WHEN 'damaged' THEN 'DMG' END)`,0);
 await count(`SELECT count(*)::int n FROM canonical_observations WHERE capture_id=$1 AND evidence_kind='asking_price' AND (numeric_value<=0 OR (raw->>'available_quantity')::int<=0)`,0,[receipt.capture_id]);
 await count(`SELECT count(*)::int n FROM canonical_observations o JOIN canonical_captures c ON c.id=o.capture_id WHERE o.capture_id=$1 AND evidence_kind='completed_sale' AND (o.observed_at>c.captured_at OR quantity<=0 OR sample_count>20 OR numeric_value<>(raw->>'price')::numeric/100 OR quantity<>(raw->>'quantity')::int)`,0,[receipt.capture_id]);
 await count(`SELECT count(*)::int n FROM canonical_product_mappings m WHERE provider='Scryfall' AND status='candidate' AND NOT EXISTS(SELECT 1 FROM canonical_product_mappings newer WHERE newer.supersedes_id=m.id)`,0);
 await count(`SELECT count(*)::int n FROM canonical_product_mappings m JOIN canonical_variants v ON v.id=m.variant_id WHERE m.provider='Scryfall' AND v.name='Gigantosaurus' AND m.product_id='c7f7445d-0412-4aeb-b4a7-376b430e075b' AND m.status='accepted' AND m.language_scope='ja'`,1);
 await count('SELECT count(*)::int n FROM canonical_decisions',0);
 await count('SELECT count(*)::int n FROM canonical_transactions',0);
 await count('SELECT count(*)::int n FROM canonical_quotes',0);
 await count("SELECT count(*)::int n FROM canonical_lot_market_evidence WHERE condition_scope<>condition_normalized OR printed_language='en' AND set_code='soa' AND collector_number IN ('72','80','116','124','126')",0);
 await count("SELECT count(*)::int n FROM canonical_inventory WHERE condition_normalized='near_mint'",720);
 await count("SELECT count(*)::int n FROM canonical_inventory WHERE condition_normalized='lightly_played'",3);
 const gradeCoverage=Object.fromEntries(['NM','LP','MP','HP','DMG'].map(grade=>{
  const rows=[...new Map(receipt.coverage.map(r=>r.grades[grade]).filter(r=>r.product_id).map(r=>[r.product_id,r])).values()];
  return [grade,{products:rows.length,with_sales:rows.filter(r=>r.sales>0).length,at_cap:rows.filter(r=>r.sample_at_cap).length,sample_records:rows.reduce((n,r)=>n+r.sales,0),with_asking_price:rows.filter(r=>r.asking_price!==null).length}];
 }));
 const age=(await c.query(`SELECT m.condition_scope,count(*)::int AS sample_records,min(o.observed_at) AS oldest_sale,max(o.observed_at) AS newest_sale,count(*) FILTER (WHERE o.observed_at<c.captured_at-interval '1 year')::int AS records_older_than_year FROM canonical_observations o JOIN canonical_product_mappings m ON m.id=o.mapping_id JOIN canonical_captures c ON c.id=o.capture_id WHERE o.capture_id=$1 AND o.evidence_kind='completed_sale' GROUP BY m.condition_scope ORDER BY m.condition_scope`,[receipt.capture_id])).rows;
 const summary={verified_at:new Date().toISOString(),checks_passed:checks,counts:receipt.counts,grade_coverage:gradeCoverage,sale_date_coverage:age,unmatched:receipt.coverage.filter(r=>!r.grades.NM.product_id).map(({grades,...r})=>r),inventory_unchanged:receipt.inventory_unchanged,replay_unchanged:receipt.replay_unchanged,limits:{physical_grade_acceptance:'Provider-grade scenarios are not physical regrading. ManaBox import convention differs from same-name NM.',price_basis:'Reported cents; not verified net or per-copy sale basis',sample_completeness:'Unknown, at most 20 per variant; not full velocity',no_current_dealer_quotes:true}};
 const out=join(root,'../outputs/market-ingestion');mkdirSync(out,{recursive:true});
 writeFileSync(join(out,'verification.json'),JSON.stringify(summary,null,2)+'\n');
 writeFileSync(join(out,'grade-coverage.json'),JSON.stringify(receipt.coverage,null,2)+'\n');
 console.log(JSON.stringify(summary,null,2));
}finally{await c.query('ROLLBACK');await c.end();}
