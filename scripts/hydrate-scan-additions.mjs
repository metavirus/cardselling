// Exact-scope enrichment of an accepted additive ManaBox scan. Inventory is read-only.
// --extract-only prepares retained-bulk subsets; default SQL trial rolls back.
// --apply requires the caller's verified pre-ingestion backup.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync,mkdirSync,existsSync,createReadStream} from 'node:fs';
import {join} from 'node:path';
import {appClient,root} from './database.mjs';
import {exactLots,normalizeDays,nativeId,collisionKeys} from './mtgjson-extra-history.mjs';
import {matchProduct,observations,limitations,gradeNames} from './manapool-evidence.mjs';
import {normalizeFactRows} from './scan-market-rows.mjs';
const sha=v=>createHash('sha256').update(v).digest('hex');
const uuid=v=>{const h=sha(v);return `${h.slice(0,8)}-${h.slice(8,12)}-5${h.slice(13,16)}-a${h.slice(17,20)}-${h.slice(20,32)}`;};
const fileHash=async p=>{const h=createHash('sha256');for await(const b of createReadStream(p))h.update(b);return h.digest('hex');};
const diffPath=join(root,process.argv.find(a=>a.startsWith('--diff='))?.slice(7)||'.local/scan-diff.json');
const diff=JSON.parse(readFileSync(diffPath));assert.ok(diff.added?.length);assert.equal(diff.changed.length,0);assert.equal(diff.missing.length,0);
const scopeHash=sha(JSON.stringify(diff.added));
const retained=join(root,'data/private/market/2026-10-04');
const work=join(root,'.local/market-ingestion/scan-additions',scopeHash);mkdirSync(work,{recursive:true});
const wantedPath=join(work,'wanted.json');writeFileSync(wantedPath,JSON.stringify([...new Set(diff.added.map(r=>r['Scryfall ID']))]));
// Stream original files, preserving original record ordinals. Extraction is not
// a new market capture and never advances an observation's freshness.
const extractor=String.raw`
import gzip,json,re,hashlib,sys
from pathlib import Path
base,out,wanted_path=map(Path,sys.argv[1:]);wanted=set(json.loads(wanted_path.read_text()))
decoder=json.JSONDecoder()
def object_entries(path):
 with gzip.open(path,'rt',encoding='utf8') as stream:
  buf=stream.read(64*1024);m=re.match(r'\s*\{\s*"meta"\s*:\s*(\{[^}]*\})\s*,\s*"data"\s*:\s*\{',buf)
  assert m,'Unexpected MTGJSON envelope';yield 'meta',json.loads(m.group(1)),0;buf=buf[m.end():];n=0
  while True:
   buf=buf.lstrip(' \r\n,')
   if buf.startswith('}'):break
   try:key,end=decoder.raw_decode(buf);after=buf[end:].lstrip(' \r\n:');value,used=decoder.raw_decode(after)
   except json.JSONDecodeError:
    more=stream.read(64*1024)
    if not more:raise
    buf+=more;continue
   n+=1;buf=after[used:];yield key,value,n
  stream.read()
ids=set();summary={}
with (out/'identifiers.jsonl').open('w',encoding='utf8') as dest:
 for key,value,n in object_entries(base/'AllIdentifiers.json.gz'):
  if key=='meta':summary['identity_meta']=value;continue
  if value.get('identifiers',{}).get('scryfallId') in wanted:
   ids.add(key);dest.write(json.dumps({'record_number':n,'uuid':key,'raw':value},ensure_ascii=False)+'\n')
with (out/'prices.jsonl').open('w',encoding='utf8') as dest:
 for key,value,n in object_entries(base/'AllPrices.json.gz'):
  if key=='meta':summary['price_meta']=value;continue
  if key in ids:dest.write(json.dumps({'record_number':n,'uuid':key,'raw':value},ensure_ascii=False)+'\n')
with gzip.open(base/'manapool-singles.json.gz','rt',encoding='utf8') as stream,(out/'catalog.jsonl').open('w',encoding='utf8') as dest:
 buf=stream.read(64*1024);assert buf.startswith('{"data":[');buf=buf[len('{"data":['):];n=0;kept=0
 while True:
  buf=buf.lstrip(' \r\n,')
  if buf.startswith(']'):break
  try:value,end=decoder.raw_decode(buf)
  except json.JSONDecodeError:
   more=stream.read(64*1024)
   if not more:raise
   buf+=more;continue
  n+=1;buf=buf[end:]
  if value.get('scryfall_id') in wanted:dest.write(json.dumps({'record_number':n,'raw':value},ensure_ascii=False)+'\n');kept+=1
 stream.read();summary['catalog_matched']=kept
summary['identity_matched']=len(ids)
for name in ['AllIdentifiers.json.gz','AllPrices.json.gz','manapool-singles.json.gz']:
 with (base/name).open('rb') as f:summary.setdefault('source_hashes',{})[name]=hashlib.file_digest(f,'sha256').hexdigest()
for name in ['identifiers.jsonl','prices.jsonl','catalog.jsonl']:
 with (out/name).open('rb') as f:summary.setdefault('extract_hashes',{})[name]=hashlib.file_digest(f,'sha256').hexdigest()
(out/'extraction.json').write_text(json.dumps(summary,indent=2));print(json.dumps(summary))
`;
if(!existsSync(join(work,'extraction.json'))){const py=join(work,'extract.py');writeFileSync(py,extractor);console.log(execFileSync('python',[py,retained,work,wantedPath],{encoding:'utf8',maxBuffer:64*1024,timeout:600000}));}
const info=JSON.parse(readFileSync(join(work,'extraction.json')));
for(const [name,digest]of Object.entries(info.source_hashes))assert.equal(await fileHash(join(retained,name)),digest);
for(const [name,digest]of Object.entries(info.extract_hashes))assert.equal(await fileHash(join(work,name)),digest);
if(process.argv.includes('--extract-only')){console.log(JSON.stringify({status:'extracted',scope_hash:scopeHash,...info}));process.exit(0);}
const jsonl=name=>{const s=readFileSync(join(work,name),'utf8').trim();return s?s.split('\n').map(JSON.parse):[];};
const ids=jsonl('identifiers.jsonl'),prices=jsonl('prices.jsonl'),catalogRows=jsonl('catalog.jsonl');
const priceById=new Map(prices.map(r=>[r.uuid,r]));
const parentById=new Map(catalogRows.map(r=>[r.raw.scryfall_id,r]));
const catalogByUuid=new Map(catalogRows.map(r=>[r.raw.card_id,r.raw]));
const conflicts=collisionKeys(ids,catalogByUuid);
const c=await appClient(),apply=process.argv.includes('--apply');
const allowed=new Set(['source_records','canonical_captures','canonical_product_mappings','canonical_observations']);
const correctedObservations=new Set();
async function insert(table,rows){assert.ok(allowed.has(table));const normalized=normalizeFactRows(rows),keys=normalized.keys;rows=normalized.rows;for(let i=0;i<rows.length;i+=150){const batch=rows.slice(i,i+150),cols=keys.map(k=>`"${k}"`).join(','),q=`SELECT ${cols} FROM jsonb_populate_recordset(NULL::${table},$1::jsonb)`,payload=JSON.stringify(batch);await c.query(`INSERT INTO ${table}(${cols}) ${q} ON CONFLICT DO NOTHING`,[payload]);const differences=(await c.query(`SELECT * FROM (${q} EXCEPT SELECT ${cols} FROM ${table} WHERE id=ANY($2)) d`,[payload,batch.map(r=>r.id)])).rows;
 // Forward repair for v1's mixed-row column loss. Original immutable records
 // remain; explicit replacement carries the full date/currency scope. Future
 // rows use the union of every row's columns and cannot silently lose fields.
 if(differences.length&&table==='canonical_observations'&&differences.every(r=>!r.supersedes_id)){
  const permittedLoss=new Set(['window_start','window_end','currency','observed_at','sample_count','quantity','text_value']);
  for(const expected of differences){const actual=(await c.query(`SELECT ${cols} FROM canonical_observations WHERE id=$1`,[expected.id])).rows[0];assert.ok(actual);for(const k of keys){const same=JSON.stringify(actual[k])===JSON.stringify(expected[k]);assert.ok(same||(actual[k]===null&&expected[k]!==null&&permittedLoss.has(k)),`Refusing non-column-loss immutable conflict ${k}`);}}
  const replacements=differences.map(r=>{correctedObservations.add(r.id);return {...r,id:uuid(`scan-additions-row-repair-v2:${r.id}`),source_locator:`repair-v2/${r.source_locator}`,supersedes_id:r.id};});await insert(table,replacements);
 }else assert.equal(differences.length,0,`Immutable replay ${table}`);
}}
try{
 await c.query('BEGIN');await c.query("SELECT pg_advisory_xact_lock(hashtext('scan-additions-market-v1'))");
 const protectedSql=`SELECT (SELECT md5(string_agg(row_to_json(i)::text,'|' ORDER BY lot_id)) FROM canonical_inventory i) stock,(SELECT md5(string_agg(row_to_json(d)::text,'|' ORDER BY id)) FROM canonical_decisions d) decisions,(SELECT md5(string_agg(row_to_json(o)::text,'|' ORDER BY id)) FROM canonical_owner_choices o) owner_choices`;
 const before=(await c.query(protectedSql)).rows[0];
 const scanLots=(await c.query("SELECT i.*,r.raw FROM canonical_inventory i JOIN source_records r ON r.id=i.origin_record_id")).rows.filter(l=>diff.added.some(r=>r['ManaBox ID']===l.raw['ManaBox ID']&&r.Added===l.raw.Added));
 assert.equal(scanLots.length,diff.added.length,'Accepted additions must be present');
 const identityMappings=[];let validatedReferences=0;
 for(const lot of scanLots){const ref=(await c.query('SELECT * FROM card_reference_snapshots WHERE scryfall_id=$1',[lot.raw['Scryfall ID']])).rows;assert.equal(ref.length,1,`Missing/ambiguous Scryfall bulk identity ${lot.name}`);const raw=ref[0].raw;assert.equal(raw.id,lot.raw['Scryfall ID']);assert.equal(raw.set,lot.set_code);assert.equal(raw.collector_number,lot.collector_number);assert.equal(raw.lang,lot.printed_language);assert.ok(raw.finishes.includes(lot.finish==='normal'?'nonfoil':lot.finish));assert.equal(raw.name,lot.name);validatedReferences++;
  const active=(await c.query("SELECT * FROM canonical_product_mappings m WHERE variant_id=$1 AND provider='Scryfall' AND NOT EXISTS(SELECT 1 FROM canonical_product_mappings n WHERE n.supersedes_id=m.id)",[lot.variant_id])).rows;assert.equal(active.length,1);if(active[0].status==='accepted')continue;assert.equal(active[0].status,'candidate');assert.equal(active[0].product_id,raw.id);
  const id=uuid(`scan-additions-scryfall-v1:${ref[0].source_file_id}:${lot.variant_id}:${active[0].id}`);identityMappings.push({id,variant_id:lot.variant_id,provider:'Scryfall',product_id:raw.id,condition_scope:'not_applicable',finish_scope:lot.finish,language_scope:lot.printed_language,status:'accepted',basis:`Retained Scryfall exact-printing bulk ${ref[0].source_file_id}: ID, name, set, collector number, explicit language and available finish agree with accepted scan. Existing retained full card_reference_snapshots supplies images, traits, artist, oracle and release metadata.`,source_record_id:lot.origin_record_id,capture_id:null,supersedes_id:active[0].id});
 }
 await insert('canonical_product_mappings',identityMappings);
 const allLots=(await c.query("SELECT i.*,m.product_id source_scryfall_id FROM canonical_inventory i JOIN canonical_product_mappings m ON m.variant_id=i.variant_id AND m.provider='Scryfall' AND m.status='accepted' AND NOT EXISTS(SELECT 1 FROM canonical_product_mappings n WHERE n.supersedes_id=m.id)")).rows;
 const targets=allLots.filter(l=>diff.added.some(r=>r['Scryfall ID']===l.source_scryfall_id&&r['Set code'].toLowerCase()===l.set_code&&r['Collector number']===l.collector_number&&r.Foil===l.finish&&r.Language===l.printed_language&&r.Condition===l.condition_normalized));
 assert.ok(targets.length,'Accepted scan inventory must be ingested before hydration');
 const coveredIds=new Set(targets.map(l=>l.source_scryfall_id));for(const row of diff.added)assert.ok(coveredIds.has(row['Scryfall ID']),`Added identity unavailable: ${row.Name}`);
 const originalCaptures=async hash=>(await c.query('SELECT * FROM canonical_captures WHERE source_file_id=$1 ORDER BY captured_at LIMIT 1',[hash])).rows[0];
 const originals={};for(const [name,hash]of Object.entries(info.source_hashes)){assert.equal((await c.query('SELECT count(*)::int n FROM source_files WHERE id=$1',[hash])).rows[0].n,1,`Retained source not registered ${name}`);originals[name]=await originalCaptures(hash);assert.ok(originals[name]);}
 const mpCap=originals['manapool-singles.json.gz'];assert.equal(mpCap.provider,'Mana Pool');
 const histHash=info.source_hashes['AllPrices.json.gz'],idHash=info.source_hashes['AllIdentifiers.json.gz'],mpHash=info.source_hashes['manapool-singles.json.gz'];
 const capture={id:uuid(`scan-additions-market-v1:${scopeHash}:${histHash}`),provider:'MTGJSON/scan-additions',upstream_provider:'Card Kingdom, TCGplayer, Mana Pool; distinct upstreams via MTGJSON',source_file_id:histHash,source_url:'https://mtgjson.com/api/v5/AllPrices.json.gz',content_hash:histHash,captured_at:originals['AllPrices.json.gz'].captured_at.toISOString(),source_observed_at:null,source_time_text:info.price_meta.date,use_state:'eligible',sample_kind:'daily_provider_price_reference_rolling_90_days',sample_limit:90,completeness:'unknown',metadata:{parser_version:'scan-additions-market-v1',identity_file_id:idHash,source_date:info.price_meta.date,original_capture_preserved:true,inventory_authority:false,scope_hash:scopeHash,currency_policy:'USD only'}};
 const rankCap={...capture,id:uuid(`scan-additions-rank-v1:${scopeHash}:${idHash}`),provider:'MTGJSON/EDHREC/scan-additions',upstream_provider:'EDHREC gameplay rank via MTGJSON',source_file_id:idHash,source_url:'https://mtgjson.com/api/v5/AllIdentifiers.json.gz',content_hash:idHash,captured_at:originals['AllIdentifiers.json.gz'].captured_at.toISOString(),source_time_text:info.identity_meta.date,sample_kind:'ordinal_gameplay_rank',sample_limit:null,metadata:{scope:'Functional gameplay rank; not premium-printing demand or transaction volume',original_capture_preserved:true,inventory_authority:false,scope_hash:scopeHash}};
 const sourceRows=[...ids.map(r=>({id:`${idHash}:${r.record_number}`,source_file_id:idHash,record_number:r.record_number,raw:r.raw})),...prices.map(r=>({id:`${histHash}:${r.record_number}`,source_file_id:histHash,record_number:r.record_number,raw:r.raw})),...catalogRows.map(r=>({id:`${mpHash}:${r.record_number}`,source_file_id:mpHash,record_number:r.record_number,raw:r.raw}))];
 const mappings=new Map(),facts=new Map(),coverage=targets.map(l=>({lot_id:l.lot_id,name:l.name,set:l.set_code,number:l.collector_number,finish:l.finish,language:l.printed_language,grade:l.condition_normalized,mp:null,history:{},edhrec:null}));
 const existingMaps=(await c.query("SELECT * FROM canonical_product_mappings WHERE status='accepted' AND NOT EXISTS(SELECT 1 FROM canonical_product_mappings n WHERE n.supersedes_id=canonical_product_mappings.id)")).rows;
 const map=(cap,lot,provider,subject,condition,sourceRecord,basis)=>{const existing=existingMaps.find(m=>m.variant_id===lot.variant_id&&m.provider===provider&&m.product_id===subject&&m.capture_id===cap.id&&m.condition_scope===condition);if(existing)return {id:existing.id,existing:true};const id=uuid(`${cap.id}:${provider}:${lot.variant_id}:${subject}:${condition}`);mappings.set(id,{id,variant_id:lot.variant_id,provider,product_id:subject,condition_scope:condition,finish_scope:lot.finish,language_scope:lot.printed_language,status:'accepted',basis,source_record_id:sourceRecord,capture_id:cap.id});return {id,existing:false};};
 for(const lot of targets){const v=coverage.find(v=>v.lot_id===lot.lot_id),record=parentById.get(lot.source_scryfall_id);for(const grade of Object.keys(gradeNames)){const match=matchProduct(lot,record?.raw,grade);if(!match.product){if(gradeNames[grade]===lot.condition_normalized)v.mp={gap:match.reason};continue;}const p=match.product,m=map(mpCap,lot,'Mana Pool',p.product_id,gradeNames[grade],`${mpHash}:${record.record_number}`,'Exact accepted Scryfall/set/collector/finish/language/provider grade; comparison scope does not alter physical grading.');if(!m.existing)for(const o of observations(p,mpCap.captured_at.toISOString())){const locator=`${lot.variant_id}/${p.product_id}/${o.locator}`,id=uuid(`${m.id}:${o.locator}`);facts.set(id,{id,capture_id:mpCap.id,mapping_id:m.id,source_locator:locator,provider_subject:p.product_id,metric:o.metric,evidence_kind:o.kind,numeric_value:o.value,currency:o.currency,unit:o.unit,price_basis:'unknown',observed_at:o.time,quantity:o.quantity,sample_count:o.kind==='completed_sale'?p.recent_sales.length:null,limitations,raw:o.raw});}if(gradeNames[grade]===lot.condition_normalized)v.mp={product_id:p.product_id,sales:p.recent_sales.length,available_quantity:p.available_quantity,asking_price:p.available_quantity>0&&p.low_price>0?p.low_price/100:null};}}
 const seen=new Map();
 for(const identity of ids){const i=identity.raw,matched=exactLots(i,targets),price=priceById.get(identity.uuid);if(!matched.length)continue;
  if(Number.isSafeInteger(i.edhrecRank)&&i.edhrecRank>0){const ms=matched.map(l=>map(rankCap,l,'MTGJSON/EDHREC',identity.uuid,'not_applicable',`${idHash}:${identity.record_number}`,'Exact printing identity; rank describes functional card gameplay interest.'));const locator=`${identity.uuid}/edhrecRank`,id=uuid(`${rankCap.id}:${locator}`);facts.set(id,{id,capture_id:rankCap.id,mapping_id:ms[0].id,provider_subject:identity.uuid,source_locator:locator,metric:'edhrec_rank',evidence_kind:'source_signal',numeric_value:i.edhrecRank,unit:'ordinal_rank_lower_is_more_popular',price_basis:'not_a_price',limitations:'EDHREC gameplay rank; no count, denominator, printing-specific demand or independent sale evidence.',raw:{rank:i.edhrecRank,mtgjson_uuid:identity.uuid,source_date:info.identity_meta.date}});for(const l of matched)coverage.find(v=>v.lot_id===l.lot_id).edhrec=i.edhrecRank;}
  if(!price)continue;
  for(const [key,side]of [['cardkingdom','buylist'],['cardkingdom','retail'],['tcgplayer','retail'],['manapool','retail']]){const data=price.raw.paper?.[key];if(!data?.[side]||data.currency!=='USD')continue;
   for(const [finish,days]of Object.entries(data[side])){const lots=matched.filter(l=>l.finish===finish&&(side!=='buylist'||l.condition_normalized==='near_mint'));if(!lots.length)continue;
    const native=key==='tcgplayer'?i.identifiers?.tcgplayerProductId:nativeId(i,key,finish,catalogByUuid);if(!native||conflicts.has(`${key}/${native}/${finish}`))continue;
    const subject=`${native}/${finish}/${side}`,provider=`MTGJSON/${key}`,condition=side==='buylist'?'near_mint':'not_applicable';
    // Reject native products already mapped to another printing. Do not blend.
    if(existingMaps.some(m=>m.provider===provider&&m.product_id===subject&&m.finish_scope===finish&&m.language_scope!==lots[0].printed_language))continue;
    const ms=lots.map(l=>map(capture,l,provider,subject,condition,`${idHash}:${identity.record_number}`,`Exact accepted Scryfall/set/collector/finish/language + native ${key} ID ${native}. ${side==='buylist'?'English NM indicative bid; capacity unknown.':'USD broad retail reference; exact upstream grade/language mix unknown.'}`));
    const points=normalizeDays(days,'USD','USD',info.price_meta.date).filter(p=>p.value!=='0.00');
    for(const p of points){const locator=`${key}/${subject}/${p.date}`;if(seen.has(locator)){assert.equal(seen.get(locator),p.value,'Conflicting same-product/day');continue;}seen.set(locator,p.value);const id=uuid(`${capture.id}:${locator}`);facts.set(id,{id,capture_id:capture.id,mapping_id:ms[0].id,provider_subject:subject,source_locator:locator,metric:side==='buylist'?'indicated_nm_buylist':'daily_retail_reference',evidence_kind:side==='buylist'?'bid':'source_signal',numeric_value:p.value,currency:'USD',unit:'reported_per_card_price',price_basis:side==='buylist'?'indicative_nm_base_buylist':'unspecified_retail_reference',observed_at:null,window_start:p.start,window_end:p.end,limitations:side==='buylist'?'Indicative Card Kingdom NM base bid; no capacity, locked quote or final grading acceptance.':'Daily upstream reference; not individual sale, exact-grade ask or seller net. Same upstream is not independent corroboration.',raw:{date:p.date,value:Number(p.value),mtgjson_uuid:identity.uuid,upstream:key,side,finish,native_id:String(native),independence_group:key,source_record_id:`${histHash}:${price.record_number}`}});}
    for(const lot of lots)coverage.find(v=>v.lot_id===lot.lot_id).history[`${key}/${side}`]={points:points.length,first:points[0]?.date,last:points.at(-1)?.date};
   }
  }
 }
 const batches=[['source_records',sourceRows],['canonical_captures',[capture,rankCap]],['canonical_product_mappings',[...mappings.values()]],['canonical_observations',[...facts.values()]]];for(const [table,rows]of batches)await insert(table,rows);for(const [table,rows]of batches)await insert(table,rows);
 const activeHistory=(await c.query(`SELECT m.variant_id,m.provider,o.metric,count(*)::int points,count(*) FILTER (WHERE o.window_start IS NULL OR o.window_end IS NULL OR o.currency IS DISTINCT FROM 'USD')::int invalid FROM canonical_observations o JOIN canonical_product_mappings m ON m.id=o.mapping_id WHERE o.capture_id=$1 AND NOT EXISTS(SELECT 1 FROM canonical_observations n WHERE n.supersedes_id=o.id) AND o.metric IN ('daily_retail_reference','indicated_nm_buylist') GROUP BY m.variant_id,m.provider,o.metric`,[capture.id])).rows;
 for(const h of activeHistory)assert.equal(h.invalid,0,'Daily history lost its date/currency scope');
 for(const lot of targets){const v=coverage.find(v=>v.lot_id===lot.lot_id);for(const [key,data]of Object.entries(v.history)){if(!data.points)continue;const [provider,side]=key.split('/');assert.ok(activeHistory.some(h=>h.variant_id===lot.variant_id&&h.provider===`MTGJSON/${provider}`&&h.metric===(side==='buylist'?'indicated_nm_buylist':'daily_retail_reference')&&h.points>0),`Missing renderable history ${lot.name}/${key}`);}}
 assert.deepEqual((await c.query(protectedSql)).rows[0],before,'Hydration changed protected stock/decision/owner data');
 await insert('canonical_product_mappings',identityMappings);
 const receipt={status:apply?'applied':'trial_rolled_back',scope_hash:scopeHash,original_capture_times:Object.fromEntries(Object.entries(originals).map(([k,v])=>[k,v.captured_at.toISOString()])),source_hashes:info.source_hashes,requested_rows:diff.added.length,matched_lots:targets.length,validated_scryfall_references:validatedReferences,superseded_identity_candidates:identityMappings.length,source_records:sourceRows.length,mappings:mappings.size,observations:facts.size,forward_corrected_observations:correctedObservations.size,coverage,protected_data:'unchanged',replay:'verified'};
 await c.query(apply?'COMMIT':'ROLLBACK');writeFileSync(join(work,apply?'applied.json':'trial.json'),JSON.stringify(receipt,null,2));writeFileSync(join(root,'.local/market-ingestion/scan-additions-latest.json'),JSON.stringify(receipt,null,2));console.log(JSON.stringify(receipt));
}catch(e){await c.query('ROLLBACK');throw e;}finally{await c.end();}
