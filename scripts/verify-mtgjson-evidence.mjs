// Independent, read-only checks for the MTGJSON price and EDHREC captures.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {appClient,root} from './database.mjs';

const dir=join(root,'.local/market-ingestion');
const price=JSON.parse(readFileSync(join(dir,'mtgjson-receipt.json'),'utf8'));
const rank=JSON.parse(readFileSync(join(dir,'edhrec-receipt.json'),'utf8'));
assert.equal(price.status,'applied');assert.equal(rank.status,'applied');
const c=await appClient();let checks=0;
async function check(sql,expected,params=[]){
 const actual=(await c.query(sql,params)).rows[0].n;
 assert.equal(actual,expected,`Evidence verification failed: ${sql}`);checks++;
}
try{
 await c.query('BEGIN READ ONLY');
 await check('SELECT count(*)::int n FROM canonical_inventory',price.inventory.lots);
 await check('SELECT sum(owned_quantity)::int n FROM canonical_inventory',price.inventory.copies);
 await check('SELECT sum(available_quantity)::int n FROM canonical_inventory',price.inventory.available);
 await check('SELECT count(*)::int n FROM canonical_observations WHERE capture_id=$1',price.observations,[price.capture_id]);
 await check('SELECT count(*)::int n FROM canonical_eligible_evidence WHERE capture_id=$1',price.observations,[price.capture_id]);
 await check('SELECT count(*)::int n FROM canonical_product_mappings WHERE capture_id=$1',price.mappings,[price.capture_id]);
 await check("SELECT count(*)::int n FROM canonical_observations WHERE capture_id=$1 AND evidence_kind='bid'",price.indicative_bids,[price.capture_id]);
 await check("SELECT count(*)::int n FROM canonical_observations WHERE capture_id=$1 AND metric='daily_retail_reference'",price.retail_reference_points,[price.capture_id]);
 await check('SELECT count(*)::int n FROM canonical_observations WHERE capture_id=$1',rank.unique_rank_signals,[rank.capture_id]);
 await check('SELECT count(*)::int n FROM canonical_eligible_evidence WHERE capture_id=$1',rank.unique_rank_signals,[rank.capture_id]);
 await check('SELECT count(*)::int n FROM canonical_product_mappings WHERE capture_id=$1',rank.mappings,[rank.capture_id]);
 // Source record, accepted mapping, variant and current physical lot must agree.
 await check(`SELECT count(*)::int n FROM canonical_product_mappings m
 JOIN canonical_variants v ON v.id=m.variant_id
 JOIN source_records r ON r.id=m.source_record_id
 WHERE m.capture_id=ANY($1) AND (m.status<>'accepted' OR m.finish_scope<>v.finish OR m.language_scope<>v.printed_language
 OR lower(r.raw->>'setCode')<>v.set_code OR r.raw->>'number'<>v.collector_number
 OR r.raw->>'language'<>CASE v.printed_language WHEN 'en' THEN 'English' WHEN 'ja' THEN 'Japanese' WHEN 'ph' THEN 'Phyrexian' ELSE 'unsupported' END
 OR NOT (r.raw->'finishes' ? CASE v.finish WHEN 'normal' THEN 'nonfoil' ELSE v.finish END)
 OR NOT EXISTS (SELECT 1 FROM canonical_inventory i JOIN source_records origin ON origin.id=i.origin_record_id
   WHERE i.variant_id=m.variant_id AND origin.raw->>'Scryfall ID'=r.raw->'identifiers'->>'scryfallId'))`,0,[[price.capture_id,rank.capture_id]]);
 // A single price date is a UTC-day interval, never an individual sale timestamp.
 await check(`SELECT count(*)::int n FROM canonical_observations o
 JOIN canonical_product_mappings m ON m.id=o.mapping_id
 JOIN canonical_captures cap ON cap.id=o.capture_id
 WHERE o.capture_id=$1 AND (o.observed_at IS NOT NULL OR o.window_start IS NULL OR o.window_end<>o.window_start+interval '1 day'
 OR (o.raw->>'date')::date<>(o.window_start AT TIME ZONE 'UTC')::date OR o.numeric_value<0 OR o.quantity IS NOT NULL OR o.sample_count IS NOT NULL
 OR cap.source_time_text<>$2 OR m.capture_id<>o.capture_id OR o.raw->>'mtgjson_uuid'<>split_part(o.provider_subject,'/',1)
 OR (o.metric='indicated_nm_buylist' AND (o.evidence_kind<>'bid' OR m.provider<>'MTGJSON/cardkingdom' OR m.condition_scope<>'near_mint' OR m.language_scope<>'en'))
 OR (o.metric='daily_retail_reference' AND (o.evidence_kind<>'source_signal' OR m.provider<>'MTGJSON/tcgplayer' OR m.condition_scope<>'not_applicable'))
 OR o.metric NOT IN ('indicated_nm_buylist','daily_retail_reference'))`,0,[price.capture_id,price.source_date]);
 await check(`SELECT count(*)::int n FROM canonical_observations o
 JOIN canonical_product_mappings m ON m.id=o.mapping_id
 JOIN canonical_captures cap ON cap.id=o.capture_id
 WHERE o.capture_id=$1 AND (o.metric<>'edhrec_rank' OR o.evidence_kind<>'source_signal' OR o.unit<>'ordinal_rank_lower_is_more_popular'
 OR o.observed_at IS NOT NULL OR o.window_start IS NOT NULL OR o.numeric_value<=0 OR o.numeric_value<>trunc(o.numeric_value)
 OR m.provider<>'MTGJSON/EDHREC' OR m.capture_id<>o.capture_id OR cap.source_time_text<>$2
 OR o.raw->>'source_date'<>$2 OR (o.raw->>'rank')::numeric<>o.numeric_value)`,0,[rank.capture_id,rank.source_date]);
 console.log(JSON.stringify({status:'verified',checks_passed:checks,price_observations:price.observations,rank_signals:rank.unique_rank_signals,inventory_lots:price.inventory.lots}));
}finally{await c.query('ROLLBACK');await c.end();}
