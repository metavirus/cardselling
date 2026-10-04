// Controlled first market capture. No inventory, owner assertion, or sale writes.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync,mkdirSync,copyFileSync,existsSync} from 'node:fs';
import {join,relative} from 'node:path';
import {parse} from 'csv-parse/sync';
import {appClient,root} from './database.mjs';
import {contentFingerprint} from './content-fingerprint.mjs';
import {matchProduct,observations,limitations,gradeNames} from './manapool-evidence.mjs';
const dir=join(root,'data/private/market/2026-10-04');
const json=p=>JSON.parse(readFileSync(p,'utf8'));
const hash=v=>createHash('sha256').update(v).digest('hex');
const uuid=v=>{const h=hash(v);return `${h.slice(0,8)}-${h.slice(8,12)}-5${h.slice(13,16)}-a${h.slice(17,20)}-${h.slice(20,32)}`;};
const provider='Mana Pool';
const provenance=json(join(dir,'download-provenance.json'));
const capturedAt=provenance.download_file_modified_utc;
const scope=json(join(dir,'inventory-scope.json'));
const records=readFileSync(join(dir,'inventory-catalog.jsonl'),'utf8').trim().split('\n').map(JSON.parse);
const byId=new Map(records.map(r=>[r.raw.scryfall_id,r]));
assert.equal(byId.size,records.length,'Duplicate catalog parent');
const fileRows=[];const sourceRows=[];const captures=[];const mappings=[];const facts=[];const policies=[];
function file(path,classification,metadata={}) {
 const bytes=readFileSync(path),id=hash(bytes);
 fileRows.push({id,path:relative(root,path).replaceAll('\\','/'),classification,byte_size:bytes.length,metadata});
 return {id,bytes};
}
const catalog=file(join(dir,'manapool-singles.json.gz'),'market_catalog',{url:provenance.url,captured_at:capturedAt,time_basis:'Local download completion; provider publication unknown',extraction:json(join(dir,'extraction.json')),extracted_sha256:hash(readFileSync(join(dir,'inventory-catalog.jsonl')))});
assert.equal(catalog.id,provenance.sha256,'Catalog differs from retained download');
const extraction=json(join(dir,'extraction.json'));
assert.equal(extraction.catalog_sha256,catalog.id);
assert.equal(extraction.scope_sha256,hash(readFileSync(join(dir,'inventory-scope.json'))));
assert.equal(extraction.extracted_sha256,hash(readFileSync(join(dir,'inventory-catalog.jsonl'))));
assert.equal(extraction.retained_parent_records,records.length);
const spec=file(join(dir,'manapool-openapi.json'),'provider_schema',{url:'https://manapool.com/api/docs/v1/openapi.json'});
const captureId=uuid(`manapool:${catalog.id}`);
captures.push({id:captureId,provider,upstream_provider:'Mana Pool marketplace; catalog identity depends on Scryfall/MTGJSON',source_file_id:catalog.id,source_url:provenance.url,content_hash:catalog.id,captured_at:capturedAt,use_state:'eligible',sample_kind:'recent_sales_per_variant_and_inventory_snapshot',sample_limit:20,completeness:'unknown',metadata:{schema_file_id:spec.id,api_version:json(join(dir,'manapool-openapi.json')).info.version,price_unit:'cents',sample_limit_scope:'per exact product',observed_at_policy:'Sale created_at only; listing source timestamps unknown',condition_policy:'Provider-grade comparisons; accepted mapping does not assert lot condition',sale_price_basis:'Reported price, unit-versus-line-total unverified',no_sale_ids:true}});
for(const record of records)sourceRows.push({id:`${catalog.id}:${record.record_number}`,source_file_id:catalog.id,record_number:record.record_number,raw:record.raw});
const coverage=[];
for(const lot of scope) {
 const record=byId.get(lot.source_scryfall_id);
 const item={lot_id:lot.lot_id,name:lot.name,set:lot.set_code,number:lot.collector_number,finish:lot.finish,language:lot.printed_language,inventory_condition:lot.condition_raw,grades:{}};
 for(const grade of Object.keys(gradeNames)) {
  const match=matchProduct(lot,record?.raw,grade);
  if(!match.product){item.grades[grade]={reason:match.reason};continue;}
  const p=match.product,mappingId=uuid(`${captureId}:${lot.variant_id}:${p.product_id}`);
  mappings.push({id:mappingId,variant_id:lot.variant_id,provider,product_id:p.product_id,condition_scope:gradeNames[grade],finish_scope:lot.finish,language_scope:lot.printed_language,status:'accepted',basis:'Source Scryfall ID, set and collector number agree; explicit catalog finish/language/provider grade. Condition scope describes comparison product, not a new physical grading assertion.',source_record_id:`${catalog.id}:${record.record_number}`,capture_id:captureId});
  const extracted=observations(p,capturedAt);
  for(const o of extracted)facts.push({id:uuid(`${mappingId}:${o.locator}`),capture_id:captureId,mapping_id:mappingId,source_locator:`${lot.variant_id}/${p.product_id}/${o.locator}`,provider_subject:p.product_id,metric:o.metric,evidence_kind:o.kind,numeric_value:o.value,currency:o.currency,unit:o.unit,price_basis:'unknown',observed_at:o.time,quantity:o.quantity,sample_count:o.kind==='completed_sale'?p.recent_sales.length:null,limitations,raw:o.raw});
  item.grades[grade]={product_id:p.product_id,sales:p.recent_sales.length,sample_at_cap:p.recent_sales.length===20,available_quantity:p.available_quantity,asking_price:p.available_quantity>0&&p.low_price>0?p.low_price/100:null};
 }
 coverage.push(item);
}
// Resolve an enrichment identity only; the owner-confirmed Japanese inventory is untouched.
const gigaPath=join(dir,'gigantosaurus-ja.json');
const giga=file(gigaPath,'provider_identity',{url:'https://api.scryfall.com/cards/m19/185/ja'});
const g=JSON.parse(giga.bytes),gCapture=uuid(`scryfall:${giga.id}`);
assert.equal(g.lang,'ja');assert.equal(g.set,'m19');assert.equal(g.collector_number,'185');assert.equal(g.name,'Gigantosaurus');
sourceRows.push({id:`${giga.id}:1`,source_file_id:giga.id,record_number:1,raw:g});
captures.push({id:gCapture,provider:'Scryfall',upstream_provider:'Scryfall',source_file_id:giga.id,source_url:'https://api.scryfall.com/cards/m19/185/ja',content_hash:giga.id,captured_at:json(join(dir,'identity-provenance.json')).captured_at,use_state:'eligible',sample_kind:'identity_lookup',completeness:'complete',metadata:{scope:'One Japanese printing; not market evidence'}});
// Register the later dealer export, but explicitly retire it from current evidence.
const tcg=file(join(root,'data/private/reanalysis/2026-10-04/tcgsentry-collection-2026-10-04-1243.csv'),'historical_hydration',{authority:'Historical hydration only; never inventory',source_time_text:'2026-10-04 12:43 filename; timezone unverified'});
const tcgRows=parse(tcg.bytes,{columns:true,bom:true,skip_empty_lines:true});
tcgRows.forEach((raw,i)=>sourceRows.push({id:`${tcg.id}:${i+1}`,source_file_id:tcg.id,record_number:i+1,raw}));
for(const researchName of ['market-ingestion-research.json','market-signal-research.json']) {
const researchSource=join(root,'docs',researchName);
const researchPath=join(dir,`research-${hash(readFileSync(researchSource))}.json`);
if(!existsSync(researchPath))copyFileSync(researchSource,researchPath);
const research=file(researchPath,'sourced_research',{authority:'Primary source findings and separate analytical implications'});
json(researchPath).findings.forEach((r,i)=>{
 sourceRows.push({id:`${research.id}:${i+1}`,source_file_id:research.id,record_number:i+1,raw:r});
 policies.push({id:uuid(`source-finding:${r.id}:${research.id}`),kind:`source_fact:${r.id}`,version:research.id,status:'accepted',rules:{scope:'Sourced provider fact; not an owner choice or inventory correction',finding:r.finding,implication:r.implication},source_refs:r.urls});
});
}
// Reproducible parameterized bulk inserts. Replays check every supplied field.
const allowed=new Set(['source_files','source_records','canonical_captures','canonical_product_mappings','canonical_observations','canonical_policies','canonical_source_retirements']);
async function insert(c,table,rows) {
 assert.ok(allowed.has(table));
 for(let offset=0;offset<rows.length;offset+=100) {
  const batch=rows.slice(offset,offset+100),keys=Object.keys(batch[0]);
  for(const row of batch)assert.deepEqual(Object.keys(row),keys,'Inconsistent row shape');
  const cols=keys.map(k=>`"${k}"`).join(','),payload=JSON.stringify(batch);
  const input=`SELECT ${cols} FROM jsonb_populate_recordset(NULL::${table},$1::jsonb)`;
  await c.query(`INSERT INTO ${table}(${cols}) ${input} ON CONFLICT DO NOTHING`,[payload]);
  const difference=await c.query(`SELECT * FROM (${input} EXCEPT SELECT ${cols} FROM ${table}) differences LIMIT 1`,[payload]);
  assert.equal(difference.rowCount,0,`Conflicting existing immutable row in ${table}`);
 }
}
const c=await appClient();
try {
 await c.query('BEGIN');await c.query("SELECT pg_advisory_xact_lock(hashtext('canonical-market-ingestion'))");
 const beforeInventory=(await c.query('SELECT * FROM canonical_inventory ORDER BY lot_id')).rows;
 const current=(await c.query(`SELECT i.*,r.raw->>'Scryfall ID' AS source_scryfall_id FROM canonical_inventory i JOIN source_records r ON r.id=i.origin_record_id ORDER BY lot_id`)).rows;
 assert.deepEqual(current,scope,'Prepared scope is stale; prepare and extract again');
 const before=await contentFingerprint(c);
 const old=(await c.query(`SELECT m.* FROM canonical_product_mappings m JOIN canonical_variants v ON v.id=m.variant_id WHERE v.name='Gigantosaurus' AND v.set_code='m19' AND v.collector_number='185' AND m.provider='Scryfall' AND m.status='candidate'`)).rows;
 assert.equal(old.length,1);assert.ok(g.finishes.includes(old[0].finish_scope==='normal'?'nonfoil':old[0].finish_scope));
 mappings.push({id:uuid(`giga:${giga.id}:${old[0].variant_id}`),variant_id:old[0].variant_id,provider:'Scryfall',product_id:g.id,condition_scope:'not_applicable',finish_scope:old[0].finish_scope,language_scope:'ja',status:'accepted',basis:'Official language-specific Scryfall response matches owner-confirmed Japanese M19 #185; supersedes default English enrichment candidate only',source_record_id:`${giga.id}:1`,capture_id:gCapture});
 // All mapping rows share one shape for bulk verification.
 for(const m of mappings)m.supersedes_id=m.provider==='Scryfall'?old[0].id:null;
 await insert(c,'source_files',fileRows);await insert(c,'source_records',sourceRows);
 // Captures have provider-specific metadata but identical columns.
 for(const capture of captures)capture.sample_limit??=null;
 const captureKeys=Object.keys(captures[0]);
 await insert(c,'canonical_captures',captures.map(r=>Object.fromEntries(captureKeys.map(k=>[k,r[k]]))));
 await insert(c,'canonical_product_mappings',mappings);await insert(c,'canonical_observations',facts);
 await insert(c,'canonical_policies',policies);
 await insert(c,'canonical_source_retirements',[{source_file_id:tcg.id,reason:'Later TCGSentry export retained only as historical hydration; canonical store supersedes spreadsheets'}]);
 assert.deepEqual((await c.query('SELECT * FROM canonical_inventory ORDER BY lot_id')).rows,beforeInventory,'Inventory changed');
 const after=await contentFingerprint(c);
 const counts={lots:scope.length,copies:scope.reduce((n,r)=>n+r.owned_quantity,0),catalog_parents:records.length,matched_printing_finish_language:coverage.filter(r=>Object.values(r.grades).some(g=>g.product_id)).length,provider_grade_mappings:mappings.length-1,observations:facts.length,sale_sample_records:facts.filter(f=>f.evidence_kind==='completed_sale').length,asking_prices:facts.filter(f=>f.evidence_kind==='asking_price').length,source_files:fileRows.length,retired_dealer_rows:tcgRows.length};
 const report={status:process.argv.includes('--apply')?'applied':'dry_run_rolled_back',captured_at:capturedAt,capture_id:captureId,counts,inventory_unchanged:true,replay_unchanged:JSON.stringify(before)===JSON.stringify(after),limitations,coverage,registered_files:fileRows.map(({metadata,...r})=>r)};
 await c.query(process.argv.includes('--apply')?'COMMIT':'ROLLBACK');
 mkdirSync(join(root,'.local/market-ingestion'),{recursive:true});
 writeFileSync(join(root,'.local/market-ingestion',process.argv.includes('--apply')?'receipt.json':'dry-run.json'),JSON.stringify(report,null,2));
 console.log(JSON.stringify({status:report.status,counts,inventory_unchanged:report.inventory_unchanged,replay_unchanged:report.replay_unchanged},null,2));
}catch(e){await c.query('ROLLBACK');throw e;}finally{await c.end();}
