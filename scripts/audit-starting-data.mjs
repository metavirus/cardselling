// Read-only audit of retained source bytes, archived rows and adopted inventory.
import { readFileSync, writeFileSync, mkdirSync, createReadStream, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createGunzip } from 'node:zlib';
import { createInterface } from 'node:readline';
import { isDeepStrictEqual } from 'node:util';
import { join, resolve } from 'node:path';
import { appClient, root } from './database.mjs';
import { csv, decimal, bulkIdentityMatches } from './import-domain.mjs';
import { contentFingerprint } from './content-fingerprint.mjs';
const out=join(root,'.local/starting-data-audit');mkdirSync(out,{recursive:true});
const intake=join(root,'data/private/intake/2026-10-04/handoff');
const result={audited_at:new Date().toISOString(),checks:[],issues:[],files:[],coverage:{}};
const check=(name,ok,details)=>{result.checks.push({name,pass:!!ok,details});};
const group=(rows,key)=>Object.fromEntries([...new Set(rows.map(r=>r[key]))].map(k=>[k,rows.filter(r=>r[key]===k).length]));
async function digest(path){const h=createHash('sha256');for await(const b of createReadStream(path))h.update(b);return h.digest('hex');}
const c=await appClient();
try {
 await c.query('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
 const initial=await contentFingerprint(c);
 const files=(await c.query('SELECT * FROM source_files ORDER BY path')).rows;
 const manifest=csv(readFileSync(join(intake,'source_manifest.csv'),'utf8'));
 for(const f of files) {
  const path=resolve(root,f.path),sha=await digest(path),declaration=manifest.find(r=>path.replaceAll('\\','/').endsWith(r.package_path));
  check(`bytes:${f.path}`,sha===f.id&&statSync(path).size===f.byte_size&&(!declaration||sha===declaration.sha256),'SHA-256 and size against database and handoff declaration');
  const dbRows=(await c.query('SELECT id,record_number,raw FROM source_records WHERE source_file_id=$1 ORDER BY record_number',[f.id])).rows;
  let fileRows;
  if(path.endsWith('.csv')) fileRows=csv(readFileSync(path,'utf8'));
  if(path.endsWith('ManaBox_Collection.xlsx')) fileRows=readFileSync(join(out,'historical-fresh.jsonl'),'utf8').trim().split('\n').map(JSON.parse);
  if(fileRows) {
   check(`rows:${f.path}`,fileRows.length===dbRows.length&&fileRows.every((r,i)=>isDeepStrictEqual(r,dbRows[i]?.raw)),{source:fileRows.length,database:dbRows.length});
  }
  result.files.push({path:f.path,sha256:sha,bytes:f.byte_size,rows:dbRows.length,role:f.metadata.role??f.classification,structured:!!fileRows});
 }
 check('manifest files retained',manifest.every(m=>files.some(f=>f.id===m.sha256)),{declared:manifest.length,registered:files.length});
 const scan=csv(readFileSync(join(intake,'sources/Sell.csv'),'utf8'));
 const lots=(await c.query(`SELECT i.*,l.condition_normalized,l.notes,r.raw,m.product_id AS scryfall_id,m.status AS mapping_status,m.language_scope
 FROM canonical_inventory i JOIN canonical_lots l ON l.id=i.lot_id JOIN source_records r ON r.id=i.origin_record_id
 JOIN canonical_product_mappings m ON m.variant_id=i.variant_id AND m.provider='Scryfall'`)).rows;
 const byOrigin=new Map(lots.map(l=>[l.origin_record_id,l]));
 const scanHash=await digest(join(intake,'sources/Sell.csv'));
 const physicalDiffs=[];
 for(const [index,r] of scan.entries()) {
  const lot=byOrigin.get(`${scanHash}:${index+1}`);
  if(!lot){physicalDiffs.push({row:index+2,issue:'missing lot'});continue;}
  const ph=r['Set code'].toLowerCase()==='one'&&['283','326','365','366','367','368','369','429'].includes(r['Collector number']);
  const expected={name:r.Name,set_code:r['Set code'].toLowerCase(),collector_number:r['Collector number'],finish:r.Foil,printed_language:ph?'ph':r.Language,condition_raw:r.Condition,owned_quantity:Number(r.Quantity),available_quantity:Number(r.Quantity),scryfall_id:r['Scryfall ID']};
  for(const [field,value]of Object.entries(expected))if(lot[field]!==value)physicalDiffs.push({row:index+2,name:r.Name,field,source:value,database:lot[field]});
 }
 check('all canonical physical fields vs original scan',physicalDiffs.length===0,physicalDiffs);
 check('row and copy conservation',lots.length===723&&lots.reduce((s,l)=>s+l.owned_quantity,0)===817,{lots:lots.length,copies:lots.reduce((s,l)=>s+l.owned_quantity,0)});
 const movement=(await c.query(`SELECT from_state,to_state,count(*)::int rows,sum(quantity)::int copies FROM canonical_stock_movements GROUP BY 1,2`)).rows;
 check('only opening stock movements',movement.length===1&&movement[0].from_state==='external'&&movement[0].to_state==='available'&&movement[0].rows===723&&movement[0].copies===817,movement);
 result.coverage.inventory={rows:scan.length,copies:817,finish:group(scan,'Foil'),condition:group(scan,'Condition'),raw_language:group(scan,'Language'),canonical_language:group(lots,'printed_language'),mapping_status:group(lots,'mapping_status'),unmapped:lots.filter(l=>l.mapping_status!=='accepted').map(l=>({name:l.name,set:l.set_code,number:l.collector_number,finish:l.finish,canonical_language:l.printed_language,provider_language:l.language_scope})),non_nm:lots.filter(l=>l.condition_raw!=='near_mint').map(l=>({name:l.name,set:l.set_code,number:l.collector_number,condition:l.condition_raw,normalized:l.condition_normalized})),locations_populated:lots.filter(l=>l.location).length,positive_flags:Object.fromEntries(['Misprint','Altered','Signed','Proxy'].map(k=>[k,scan.filter(r=>r[k]==='true').length])),scan_price_blank:scan.filter(r=>!r['Purchase price']).length};
 const refFile=files.find(f=>f.path.endsWith('default-cards-20260929210547.jsonl.gz'));
 let total=0,bad=0,batch=[];
 const inventoryIds=new Set(scan.map(r=>r['Scryfall ID'])),inventoryRefs=new Map();
 async function compareBatch(){
  const stored=new Map((await c.query('SELECT scryfall_id,raw FROM card_reference_snapshots WHERE source_file_id=$1 AND scryfall_id=ANY($2::uuid[])',[refFile.id,batch.map(r=>r.id)])).rows.map(r=>[r.scryfall_id,r.raw]));
  for(const raw of batch){if(!isDeepStrictEqual(raw,stored.get(raw.id)))bad++;if(inventoryIds.has(raw.id))inventoryRefs.set(raw.id,raw);}
  total+=batch.length;batch=[];
 }
 for await(const line of createInterface({input:createReadStream(resolve(root,refFile.path)).pipe(createGunzip()),crlfDelay:Infinity})){if(line.trim())batch.push(JSON.parse(line));if(batch.length===1000)await compareBatch();}
 if(batch.length)await compareBatch();
 const refCount=(await c.query('SELECT count(*)::int n FROM card_reference_snapshots WHERE source_file_id=$1',[refFile.id])).rows[0].n;
 check('entire Scryfall bulk equals retained database objects',bad===0&&total===refCount,{source:total,database:refCount,differences:bad});
 const refConflicts=scan.filter(r=>!bulkIdentityMatches(r,inventoryRefs.get(r['Scryfall ID'])??{}));
 check('all scan set/collector/finish matches catalog',refConflicts.length===0,{matches:scan.length-refConflicts.length,conflicts:refConflicts.map(r=>r.Name)});
 result.coverage.catalog={objects:total,distinctInventoryScryfallIds:inventoryIds.size,oracle_ids_available:lots.filter(l=>inventoryRefs.get(l.scryfall_id)?.oracle_id).length};
 const researchFile=files.find(f=>f.path.endsWith('research_observations.csv'));
 const research=(await c.query('SELECT id,raw FROM source_records WHERE source_file_id=$1',[researchFile.id])).rows;
 const links=(await c.query(`SELECT e.source_record_id AS evidence_record_id,o.* FROM observation_evidence e JOIN market_observations o ON o.id=e.observation_id
 WHERE e.source_record_id IN (SELECT id FROM source_records WHERE source_file_id=$1)`,[researchFile.id])).rows;
 const researchLost=research.filter(r=>!links.some(l=>l.evidence_record_id===r.id&&l.metric===r.raw.metric&&
   (l.value_text===r.raw.value||(l.numeric_value!==null&&decimal(l.numeric_value)===decimal(r.raw.value)))));
 check('every research row has matching typed evidence link',researchLost.length===0,{source:research.length,links:links.length,unmatched:researchLost.length});
 result.coverage.research={rows:research.length,providers:group(research.map(r=>r.raw),'source'),evidence_classes:group(research.map(r=>r.raw),'evidence_class'),lost:researchLost.map(r=>({id:r.id,metric:r.raw.metric}))};
 result.coverage.tables=initial;
 result.coverage.interpretations=(await c.query(`SELECT kind,match_status,count(*)::int n FROM interpretation_checkpoints GROUP BY 1,2 ORDER BY 1,2`)).rows;
 result.coverage.legacy_issues=(await c.query(`SELECT code,count(*)::int n FROM reconciliation_issues WHERE NOT(details?'resolution') GROUP BY 1 ORDER BY 1`)).rows;
 result.coverage.active=(await c.query(`SELECT (SELECT count(*) FROM canonical_captures)::int captures,(SELECT count(*) FROM canonical_observations)::int observations,(SELECT count(*) FROM canonical_eligible_evidence)::int eligible,(SELECT count(*) FROM canonical_decisions)::int decisions,(SELECT count(*) FROM canonical_quotes)::int quotes,(SELECT count(*) FROM canonical_transactions)::int transactions,(SELECT count(*) FROM canonical_policies)::int policies,(SELECT count(*) FROM canonical_source_retirements)::int retired_artifacts`)).rows[0];
 result.coverage.policies=(await c.query('SELECT kind,version,status,rules FROM canonical_policies ORDER BY kind')).rows;
 result.coverage.mapping_candidates=lots.filter(l=>l.mapping_status==='candidate').map(l=>({name:l.name,set:l.set_code,number:l.collector_number,language:l.printed_language,provider_language:l.language_scope}));
 result.coverage.staged_files=[];
 for(const relative of ['data/private/reanalysis/2026-10-04/tcgsentry-collection-2026-10-04-1243.csv','.local/source-survey/manapool-singles.json.gz','.local/source-survey/manapool-inventory-probe.json']) {
  const sha=await digest(join(root,relative));result.coverage.staged_files.push({path:relative,sha256:sha,registered:files.some(f=>f.id===sha)});
 }
 const final=await contentFingerprint(c);
 check('audit changed no database rows',isDeepStrictEqual(initial,final),'Full content fingerprints in read-only repeatable-read transaction');
 writeFileSync(join(out,'database-audit.json'),JSON.stringify(result,null,2)+'\n');
 if(result.checks.some(r=>!r.pass))process.exitCode=1;
 console.log(JSON.stringify({checks:result.checks.length,failed:result.checks.filter(r=>!r.pass),inventory:result.coverage.inventory,active:result.coverage.active,staged:result.coverage.staged_files},null,2));
} finally {await c.query('ROLLBACK');await c.end();}
