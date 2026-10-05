// Add genuine retained histories without changing stock or existing observations.
// Default is a fully rolled-back trial; --apply is explicit persistence.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createReadStream,readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {join} from 'node:path';
import {appClient,root} from './database.mjs';
import {exactLots,nativeId,normalizeDays,collisionKeys,specs,acceptNativePoint} from './mtgjson-extra-history.mjs';
const dir=join(root,'data/private/market/2026-10-04');
const json=name=>JSON.parse(readFileSync(join(dir,name),'utf8'));
const jsonl=name=>readFileSync(join(dir,name),'utf8').trim().split('\n').map(JSON.parse);
const hash=async path=>{const h=createHash('sha256');for await(const chunk of createReadStream(path))h.update(chunk);return h.digest('hex');};
const uuid=s=>{const h=createHash('sha256').update(s).digest('hex');return `${h.slice(0,8)}-${h.slice(8,12)}-5${h.slice(13,16)}-a${h.slice(17,20)}-${h.slice(20,32)}`;};
const info=json('mtgjson-extraction.json');
for(const [name,digest]of Object.entries({...info.source_hashes,...info.extract_hashes}))assert.equal(await hash(join(dir,name)),digest,`Changed retained input: ${name}`);
const ids=jsonl('mtgjson-identifiers.jsonl'),prices=jsonl('mtgjson-prices.jsonl');
assert.equal(ids.length,info.matched_identifiers);assert.equal(prices.length,info.matched_prices);
const identities=new Map(ids.map(r=>[r.uuid,r]));assert.equal(identities.size,ids.length);
const catalogRows=jsonl('inventory-catalog.jsonl');
const catalog=new Map(catalogRows.map(r=>[r.raw.card_id,r.raw]));assert.equal(catalog.size,catalogRows.length);
const catalogHash=await hash(join(dir,'inventory-catalog.jsonl'));
const conflicts=collisionKeys(ids,catalog),sourceHash=info.source_hashes['AllPrices.json.gz'];
const captureId=uuid(`mtgjson-extra-history-v1:${sourceHash}:${catalogHash}`);
const c=await appClient();
const apply=process.argv.includes('--apply');
const allowed=new Set(['canonical_captures','canonical_product_mappings','canonical_observations']);
async function insert(table,rows){
 assert.ok(allowed.has(table));
 for(let i=0;i<rows.length;i+=200){
  const batch=rows.slice(i,i+200),keys=Object.keys(batch[0]),columns=keys.map(k=>`"${k}"`).join(',');
  const input=`SELECT ${columns} FROM jsonb_populate_recordset(NULL::${table},$1::jsonb)`;
  await c.query(`INSERT INTO ${table}(${columns}) ${input} ON CONFLICT DO NOTHING`,[JSON.stringify(batch)]);
  assert.equal((await c.query(`SELECT * FROM (${input} EXCEPT SELECT ${columns} FROM ${table} WHERE id=ANY($2)) difference LIMIT 1`,[JSON.stringify(batch),batch.map(r=>r.id)])).rowCount,0,`Immutable replay differs: ${table}`);
 }
}
try{
 await c.query('BEGIN');await c.query("SELECT pg_advisory_xact_lock(hashtext('mtgjson-extra-history'))");
 assert.equal((await c.query("SELECT count(*)::int n FROM source_files WHERE metadata->>'extracted_sha256'=$1",[catalogHash])).rows[0].n,1,'Mana Pool catalog extraction no longer matches archived evidence');
 const stockSql='SELECT count(*)::int lots,sum(owned_quantity)::int copies,sum(available_quantity)::int available FROM canonical_inventory';
 const stock=(await c.query(stockSql)).rows[0];
 const lots=(await c.query("SELECT i.*,m.product_id source_scryfall_id FROM canonical_inventory i JOIN canonical_product_mappings m ON m.variant_id=i.variant_id AND m.provider='Scryfall' AND m.status='accepted' AND NOT EXISTS(SELECT 1 FROM canonical_product_mappings newer WHERE newer.supersedes_id=m.id) ORDER BY lot_id")).rows;
 // Source bytes and identity records must already be archived. Never quietly
 // attach new interpretations to a different or unregistered raw source.
 for(const r of [...ids.map(r=>({...r,file:info.source_hashes['AllIdentifiers.json.gz']})),...prices.map(r=>({...r,file:sourceHash}))]){
  const archived=(await c.query('SELECT raw FROM source_records WHERE id=$1',[`${r.file}:${r.record_number}`])).rows[0];
  assert.deepEqual(archived?.raw,r.raw,'Source evidence missing or changed');
 }
 const captured=(await c.query("SELECT captured_at FROM canonical_captures WHERE source_file_id=$1 AND provider='MTGJSON' ORDER BY captured_at LIMIT 1",[sourceHash])).rows[0];assert.ok(captured);
 const capture={id:captureId,provider:'MTGJSON/additional-history',upstream_provider:'Card Kingdom and Mana Pool; distinct markets redistributed by MTGJSON',source_file_id:sourceHash,source_url:'https://mtgjson.com/api/v5/AllPrices.json.gz',content_hash:sourceHash,captured_at:captured.captured_at.toISOString(),source_observed_at:null,source_time_text:info.price_meta.date,use_state:'eligible',sample_kind:'daily_provider_retail_reference_rolling_90_days',sample_limit:90,completeness:'unknown',metadata:{parser_version:'mtgjson-extra-history-v1',identity_file_id:info.source_hashes['AllIdentifiers.json.gz'],source_date:info.price_meta.date,source_date_precision:'day',catalog_extract_sha256:catalogHash,no_transaction_count:true,currency_policy:'USD only; owner excludes Cardmarket/EUR from operational comparisons',condition_language_policy:'Identity language matched; upstream aggregate grade and language composition unknown. Reference only.'}};
 assert.equal(lots.length,stock.lots,'Missing or duplicate active Scryfall mapping');
 const seenPoints=new Map();
 const mappings=new Map(),facts=[],coverage={},excluded={identity_or_finish:0,missing_native_product:0,native_product_collision:0,zero_reference_points:0,duplicate_face_points:0};
 for(const price of prices){
  const identRow=identities.get(price.uuid);assert.ok(identRow);const ident=identRow.raw;
  assert.equal(ident.uuid,price.uuid);
  const matched=exactLots(ident,lots);if(!matched.length){excluded.identity_or_finish++;continue;}
  for(const spec of specs){
   const data=price.raw.paper?.[spec.key];if(!data?.retail)continue;
   for(const [finish,days]of Object.entries(data.retail)){
    const exact=matched.filter(l=>l.finish===finish);if(!exact.length)continue;
    const native=nativeId(ident,spec.key,finish,catalog);if(!native){excluded.missing_native_product++;continue;}
    if(conflicts.has(`${spec.key}/${native}/${finish}`)){excluded.native_product_collision++;continue;}
    const points=normalizeDays(days,data.currency,spec.currency,info.price_meta.date);
    const provider=`MTGJSON/${spec.key}`,subject=`${native}/${finish}/retail`;
    for(const lot of exact){
     const id=uuid(`${captureId}:${provider}:${lot.variant_id}:${subject}`);
     mappings.set(id,{id,variant_id:lot.variant_id,provider,product_id:subject,condition_scope:'not_applicable',finish_scope:finish,language_scope:lot.printed_language,status:'accepted',basis:`Exact MTGJSON/Scryfall/set/collector/finish/catalog language and native product ${native}. Upstream retail reference grade/language mixture unknown; not an exact-condition sale, ask, cash bid or seller net.`,source_record_id:`${info.source_hashes['AllIdentifiers.json.gz']}:${identRow.record_number}`,capture_id:captureId});
    }
    const mapping=[...mappings.values()].find(m=>m.provider===provider&&m.product_id===subject);
    coverage[provider]??={points:0,lots:new Set(),first:null,last:null,currency:spec.currency};
    for(const p of points){
     // Retain zero in source bytes only: without availability semantics it is
     // not a reliable free-card price or meaningful return denominator.
     if(p.value==='0.00'){excluded.zero_reference_points++;continue;}
     const locator=`${spec.key}/${subject}/${p.date}`;
     if(!acceptNativePoint(seenPoints,locator,p.value)){excluded.duplicate_face_points++;continue;}
     facts.push({id:uuid(`${captureId}:${locator}`),capture_id:captureId,mapping_id:mapping.id,source_locator:locator,provider_subject:subject,metric:'daily_retail_reference',evidence_kind:'source_signal',numeric_value:p.value,text_value:null,currency:p.currency,unit:'reported_per_card_price',price_basis:'unspecified_retail_reference',observed_at:null,window_start:p.start,window_end:p.end,quantity:null,sample_count:null,limitations:'Daily provider retail reference redistributed by MTGJSON. Exact grade, upstream language aggregation, availability and calculation methodology unestablished. Not an individual sale, firm bid, seller proceeds or independent signal from the same upstream marketplace. Day precision only.',raw:{date:p.date,value:Number(p.value),mtgjson_uuid:price.uuid,upstream:spec.key,side:'retail',finish,native_id:String(native),independence_group:spec.key,grade_scope:'unknown_aggregate',upstream_language_scope:'unknown_aggregate',identity_language:ident.language,parser_version:'mtgjson-extra-history-v1'}});
     const v=coverage[provider];v.points++;v.first=!v.first||p.date<v.first?p.date:v.first;v.last=!v.last||p.date>v.last?p.date:v.last;for(const lot of exact)v.lots.add(lot.lot_id);
    }
   }
  }
 }
 assert.equal(new Set(facts.map(f=>f.source_locator)).size,facts.length);
 const batches=[['canonical_captures',[capture]],['canonical_product_mappings',[...mappings.values()]],['canonical_observations',facts]];
 for(const [table,rows]of batches)await insert(table,rows);
 const before=(await c.query('SELECT count(*)::int n FROM canonical_observations WHERE capture_id=$1',[captureId])).rows[0].n;
 // Replay inside the same transaction verifies immutable idempotency in trial.
 for(const [table,rows]of batches)await insert(table,rows);
 assert.equal((await c.query('SELECT count(*)::int n FROM canonical_observations WHERE capture_id=$1',[captureId])).rows[0].n,before);
 assert.equal(before,facts.length);
 assert.equal((await c.query('SELECT count(*)::int n FROM canonical_eligible_evidence WHERE capture_id=$1',[captureId])).rows[0].n,facts.length);
 assert.deepEqual((await c.query(stockSql)).rows[0],stock);
 const receipt={status:apply?'applied':'trial_rolled_back',capture_id:captureId,source_date:info.price_meta.date,observations:facts.length,mappings:mappings.size,coverage:Object.fromEntries(Object.entries(coverage).map(([k,v])=>[k,{...v,lots:v.lots.size}])),excluded,collision_keys:[...conflicts],inventory:stock,replay:'verified_same_transaction',source_hashes:info.source_hashes};
 await c.query(apply?'COMMIT':'ROLLBACK');
 mkdirSync(join(root,'.local/market-ingestion'),{recursive:true});writeFileSync(join(root,`.local/market-ingestion/mtgjson-extra-${apply?'applied':'trial'}.json`),JSON.stringify(receipt,null,2));console.log(JSON.stringify(receipt));
}catch(error){await c.query('ROLLBACK');throw error;}finally{await c.end();}
