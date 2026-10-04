// Gameplay-interest context from the same MTGJSON identity capture.
import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync,mkdirSync,statSync} from 'node:fs';import {join} from 'node:path';
import {appClient,root} from './database.mjs';
const dir=join(root,'data/private/market/2026-10-04');
const info=JSON.parse(readFileSync(join(dir,'mtgjson-extraction.json')));
const rows=readFileSync(join(dir,'mtgjson-identifiers.jsonl'),'utf8').trim().split('\n').map(JSON.parse);
const digest=v=>createHash('sha256').update(v).digest('hex');
const uuid=v=>{const h=digest(v);return `${h.slice(0,8)}-${h.slice(8,12)}-5${h.slice(13,16)}-a${h.slice(17,20)}-${h.slice(20,32)}`;};
const sourceId=info.source_hashes['AllIdentifiers.json.gz'];
const captureId=uuid(`mtgjson-edhrec-rank:${sourceId}`);
const languages={English:'en',Japanese:'ja',Phyrexian:'ph'};
const finishes={normal:'nonfoil',foil:'foil',etched:'etched'};
const c=await appClient();
try{
 await c.query('BEGIN');await c.query("SELECT pg_advisory_xact_lock(hashtext('mtgjson-edhrec-rank'))");
 const inventory=(await c.query(`SELECT i.*,r.raw->>'Scryfall ID' AS source_scryfall_id FROM canonical_inventory i JOIN source_records r ON r.id=i.origin_record_id`)).rows;
 const byId=new Map();for(const r of inventory){if(!byId.has(r.source_scryfall_id))byId.set(r.source_scryfall_id,[]);byId.get(r.source_scryfall_id).push(r);}
 const capture={id:captureId,provider:'MTGJSON',upstream_provider:'EDHREC gameplay-deck rank via MTGJSON',source_file_id:sourceId,source_url:'https://mtgjson.com/api/v5/AllIdentifiers.json.gz',content_hash:sourceId,captured_at:statSync(join(dir,'AllIdentifiers.json.gz')).mtime.toISOString(),source_observed_at:null,source_time_text:info.identity_meta.date,use_state:'eligible',sample_kind:'ordinal_gameplay_rank',sample_limit:null,completeness:'unknown',metadata:{version:info.identity_meta.version,metric:'edhrecRank',scope:'Functional card gameplay interest, not printing-specific buyer demand, deck count or sale volume'}};
 await c.query(`INSERT INTO canonical_captures(id,provider,upstream_provider,source_file_id,source_url,content_hash,captured_at,source_time_text,use_state,sample_kind,completeness,metadata)
  VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) ON CONFLICT(id) DO NOTHING`,[capture.id,capture.provider,capture.upstream_provider,capture.source_file_id,capture.source_url,capture.content_hash,capture.captured_at,capture.source_time_text,capture.use_state,capture.sample_kind,capture.completeness,capture.metadata]);
 assert.equal((await c.query(`SELECT count(*)::int n FROM canonical_captures WHERE id=$1 AND provider=$2 AND upstream_provider=$3 AND source_file_id=$4 AND source_url=$5 AND content_hash=$6 AND captured_at=$7 AND source_time_text=$8 AND use_state=$9 AND sample_kind=$10 AND completeness=$11 AND metadata=$12::jsonb`,[capture.id,capture.provider,capture.upstream_provider,capture.source_file_id,capture.source_url,capture.content_hash,capture.captured_at,capture.source_time_text,capture.use_state,capture.sample_kind,capture.completeness,JSON.stringify(capture.metadata)])).rows[0].n,1,'EDHREC capture replay differs');
 let mapped=0,signals=0;
 for(const entry of rows){
  const raw=entry.raw,rank=raw.edhrecRank;
  if(rank===undefined||rank===null)continue;
  assert.ok(Number.isSafeInteger(rank)&&rank>0);
  const options=(byId.get(raw.identifiers?.scryfallId)||[]).filter(r=>r.set_code===raw.setCode.toLowerCase()&&r.collector_number===raw.number&&r.printed_language===languages[raw.language]&&raw.finishes.includes(finishes[r.finish]));
  if(!options.length)continue;
  let selected;
  for(const lot of options){
   const id=uuid(`${captureId}:${lot.variant_id}:${entry.uuid}`);
   await c.query(`INSERT INTO canonical_product_mappings(id,variant_id,provider,product_id,condition_scope,finish_scope,language_scope,status,basis,source_record_id,capture_id)
    VALUES($1,$2,'MTGJSON/EDHREC',$3,'not_applicable',$4,$5,'accepted',$6,$7,$8) ON CONFLICT(id) DO NOTHING`,[id,lot.variant_id,entry.uuid,lot.finish,lot.printed_language,'Exact printing mapping. EDHREC rank describes the functional card, not its premium printing, grade, language-specific liquidity or sales.',`${sourceId}:${entry.record_number}`,captureId]);
   assert.equal((await c.query(`SELECT count(*)::int n FROM canonical_product_mappings WHERE id=$1 AND variant_id=$2 AND provider='MTGJSON/EDHREC' AND product_id=$3 AND condition_scope='not_applicable' AND finish_scope=$4 AND language_scope=$5 AND status='accepted' AND basis=$6 AND source_record_id=$7 AND capture_id=$8`,[id,lot.variant_id,entry.uuid,lot.finish,lot.printed_language,'Exact printing mapping. EDHREC rank describes the functional card, not its premium printing, grade, language-specific liquidity or sales.',`${sourceId}:${entry.record_number}`,captureId])).rows[0].n,1,'EDHREC mapping replay differs');
   selected??=id;mapped++;
  }
  const locator=`${entry.uuid}/edhrecRank`;
  await c.query(`INSERT INTO canonical_observations(id,capture_id,mapping_id,source_locator,provider_subject,metric,evidence_kind,numeric_value,unit,price_basis,limitations,raw)
   VALUES($1,$2,$3,$4,$5,'edhrec_rank','source_signal',$6,'ordinal_rank_lower_is_more_popular','not_a_price',$7,$8) ON CONFLICT(id) DO NOTHING`,[
   uuid(`${captureId}:${locator}`),captureId,selected,locator,entry.uuid,rank,'Gameplay deck rank from EDHREC redistributed by MTGJSON. No count, denominator, exact printing demand, dealer capacity, causal price effect or independent sales evidence.',{rank,mtgjson_uuid:entry.uuid,source_date:info.identity_meta.date}]);
  assert.equal((await c.query(`SELECT count(*)::int n FROM canonical_observations WHERE id=$1 AND capture_id=$2 AND mapping_id=$3 AND source_locator=$4 AND provider_subject=$5 AND metric='edhrec_rank' AND evidence_kind='source_signal' AND numeric_value=$6 AND unit='ordinal_rank_lower_is_more_popular' AND price_basis='not_a_price' AND limitations=$7 AND raw=$8::jsonb`,[
   uuid(`${captureId}:${locator}`),captureId,selected,locator,entry.uuid,rank,'Gameplay deck rank from EDHREC redistributed by MTGJSON. No count, denominator, exact printing demand, dealer capacity, causal price effect or independent sales evidence.',JSON.stringify({rank,mtgjson_uuid:entry.uuid,source_date:info.identity_meta.date})])).rows[0].n,1,'EDHREC observation replay differs');
  signals++;
 }
 const observed=(await c.query('SELECT count(*)::int n FROM canonical_observations WHERE capture_id=$1',[captureId])).rows[0].n;
 assert.equal(observed,signals);
 await c.query(process.argv.includes('--apply')?'COMMIT':'ROLLBACK');
 const receipt={status:process.argv.includes('--apply')?'applied':'trial_rolled_back',capture_id:captureId,source_date:info.identity_meta.date,mappings:mapped,unique_rank_signals:signals,lot_count:inventory.length};
 mkdirSync(join(root,'.local/market-ingestion'),{recursive:true});writeFileSync(join(root,'.local/market-ingestion/edhrec-receipt.json'),JSON.stringify(receipt,null,2));console.log(JSON.stringify(receipt));
}catch(e){await c.query('ROLLBACK');throw e;}finally{await c.end();}
