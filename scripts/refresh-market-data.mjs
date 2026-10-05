// Public-feed refresh: validated evidence applies automatically; inventory and owner plans are read-only.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { createWriteStream, createReadStream, existsSync, readFileSync, mkdirSync, writeFileSync, renameSync, rmSync, statSync, linkSync } from 'node:fs';
import { join, relative } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { setTimeout as delay } from 'node:timers/promises';
import { appClient, root, start } from './database.mjs';
import { matchProduct, observations, gradeNames, limitations } from './manapool-evidence.mjs';
import { exactLots, nativeId, normalizeDays, collisionKeys } from './mtgjson-extra-history.mjs';
import { normalizeFactRows } from './scan-market-rows.mjs';

export const sha = v => createHash('sha256').update(v).digest('hex');
export const uuid = v => { const h = sha(v); return `${h.slice(0,8)}-${h.slice(8,12)}-5${h.slice(13,16)}-a${h.slice(17,20)}-${h.slice(20,32)}`; };
export function validatePublication(date, now = new Date()) {
  assert.match(date ?? '', /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(new Date(`${date}T00:00:00Z`).toISOString().slice(0,10), date);
  assert.ok(Date.parse(date) <= +now && +now - Date.parse(date) < 7 * 86400000, 'Feed publication is future-dated or more than 7 days old');
  return date;
}
export async function retry(operation, attempts = 3, sleep = delay) {
  for (let n = 0; ; n++) {
    try { return await operation(n); }
    catch (error) { if (n + 1 >= attempts) throw error; await sleep(1000 * 2 ** n); }
  }
}
const urls = {
  'manapool-singles.json.gz': 'https://storage.googleapis.com/manapool-prod-catalog/singles.json.gz',
  'AllIdentifiers.json.gz': 'https://mtgjson.com/api/v5/AllIdentifiers.json.gz',
  'AllPrices.json.gz': 'https://mtgjson.com/api/v5/AllPrices.json.gz',
};
async function fileHash(path) { const h = createHash('sha256'); for await (const b of createReadStream(path)) h.update(b); return h.digest('hex'); }
async function download(name, dir) {
  return retry(async () => {
    const path = join(dir,name), partial = path + '.partial';
    rmSync(partial,{force:true});
    const response = await fetch(urls[name], { signal: AbortSignal.timeout(300000) });
    assert.ok(response.ok, `Feed HTTP ${response.status}`);
    assert.ok(response.body, 'Feed body absent');
    await pipeline(Readable.fromWeb(response.body), createWriteStream(partial));
    const size = statSync(partial).size;
    assert.ok(size > 100000, 'Unexpectedly small bulk feed');
    const expected = Number(response.headers.get('content-length'));
    if (expected && !response.headers.get('content-encoding')) assert.equal(size, expected, 'Incomplete bulk download');
    renameSync(partial,path);
    return {name, path, sha256:await fileHash(path), byte_size:size, checked_at:new Date().toISOString(), provider_published_at:response.headers.get('last-modified'), etag:response.headers.get('etag')};
  });
}
async function extract(dir, mode) {
  await new Promise((resolve,reject) => {
    const child = spawn('python',[join(root,'scripts/extract-refresh.py'),dir,mode],{windowsHide:true,stdio:['ignore','pipe','pipe']});
    let error = ''; child.stderr.on('data',b=>{error += b;});
    const timer = setTimeout(()=>{child.kill();reject(new Error('Bulk extraction timed out'));},600000);
    child.on('error',e=>{clearTimeout(timer);reject(e);});
    child.on('close',code=>{clearTimeout(timer);code===0?resolve():reject(new Error(`Extraction failed: ${error.slice(-600)}`));});
  });
}
async function importDealerManifest(path) {
  return new Promise((resolve,reject)=>{
    const child=spawn(process.execPath,[join(root,'scripts/ingest-dealer-refresh.mjs'),path,'--apply'],{windowsHide:true,stdio:['ignore','pipe','pipe']});
    let output='',error='';child.stdout.on('data',b=>{output+=b;});child.stderr.on('data',b=>{error+=b;});
    const timer=setTimeout(()=>{child.kill();reject(new Error('Dealer import timed out'));},120000);
    child.on('error',e=>{clearTimeout(timer);reject(e);});child.on('close',code=>{clearTimeout(timer);if(code!==0)reject(new Error(error.slice(-600)));else {try{resolve(JSON.parse(output.trim()));}catch(e){reject(e);}}});
  });
}
const jsonl = (dir,name) => { const s=readFileSync(join(dir,name),'utf8').trim(); return s?s.split('\n').map(JSON.parse):[]; };
const allowed = new Set(['source_files','source_records','canonical_captures','canonical_product_mappings','canonical_observations']);
async function insert(c,table,rows) {
  assert.ok(allowed.has(table)); if(!rows.length)return;
  const normalized=normalizeFactRows(rows),keys=normalized.keys,cols=keys.map(k=>`"${k}"`).join(',');
  for(let i=0;i<normalized.rows.length;i+=150){
    const batch=normalized.rows.slice(i,i+150),payload=JSON.stringify(batch);
    const input=`SELECT ${cols} FROM jsonb_populate_recordset(NULL::${table},$1::jsonb)`;
    await c.query(`INSERT INTO ${table}(${cols}) ${input} ON CONFLICT DO NOTHING`,[payload]);
    assert.equal((await c.query(`SELECT * FROM (${input} EXCEPT SELECT ${cols} FROM ${table} WHERE id=ANY($2)) d LIMIT 1`,[payload,batch.map(r=>r.id)])).rowCount,0,`Immutable replay conflict: ${table}`);
  }
}
async function registerFile(c, file, classification) {
  const prior=(await c.query('SELECT id FROM source_files WHERE id=$1',[file.sha256])).rows[0];
  if(!prior)await insert(c,'source_files',[{id:file.sha256,path:relative(root,file.path).replaceAll('\\','/'),classification,byte_size:file.byte_size,metadata:{url:urls[file.name],downloaded_at:file.checked_at,provider_published_at:file.provider_published_at,etag:file.etag}}]);
}
async function protectedState(c) {
  const tables=['canonical_inventory','canonical_owner_choices','canonical_assertions','canonical_stock_movements','canonical_decisions','canonical_decision_runs','canonical_transactions'];
  const result={};
  for(const name of tables)result[name]=(await c.query(`SELECT encode(sha256(convert_to(coalesce(string_agg(row_json,'' ORDER BY row_json),''),'UTF8')),'hex') fingerprint FROM (SELECT row_to_json(t)::text row_json FROM ${name} t) s`)).rows[0].fingerprint;
  return result;
}
function capture(file, key, scopeHash, metadata={}) {
  return {id:uuid(`daily-refresh-v1:${key}:${file.sha256}:${scopeHash}`),provider:key==='manapool'?'Mana Pool':'MTGJSON/daily-refresh',upstream_provider:key==='manapool'?'Mana Pool':'Card Kingdom, TCGplayer and Mana Pool via MTGJSON',source_file_id:file.sha256,source_url:urls[file.name],content_hash:file.sha256,captured_at:file.checked_at,use_state:'eligible',sample_kind:key==='manapool'?'recent_sales_per_variant_and_inventory_snapshot':'daily_provider_price_reference_rolling_90_days',sample_limit:key==='manapool'?20:90,completeness:'unknown',metadata:{parser_version:'daily-refresh-v1',scope_hash:scopeHash,provider_published_at:file.provider_published_at,inventory_authority:false,...metadata}};
}
function mapping(cap,lot,provider,product,condition,sourceRecord,basis) {
  return {id:uuid(`${cap.id}:${lot.variant_id}:${provider}:${product}:${condition}`),variant_id:lot.variant_id,provider,product_id:String(product),condition_scope:condition,finish_scope:lot.finish,language_scope:lot.printed_language,status:'accepted',basis,source_record_id:sourceRecord,capture_id:cap.id};
}
async function persist(c,cap,mappings,facts) {
  const prior=(await c.query('SELECT * FROM canonical_captures WHERE id=$1',[cap.id])).rows[0];
  if(prior) { cap.captured_at=prior.captured_at.toISOString(); cap.metadata=prior.metadata; }
  await insert(c,'canonical_captures',[cap]);
  await insert(c,'canonical_product_mappings',[...mappings.values()]);
  await insert(c,'canonical_observations',[...facts.values()]);
  return {capture_id:cap.id,applied_at:cap.captured_at,observations:facts.size,mappings:mappings.size,replay:!!prior};
}
async function importManaPool(c,dir,file,lots,scopeHash) {
  const records=jsonl(dir,'catalog.jsonl'),byId=new Map(records.map(r=>[r.raw.scryfall_id,r]));
  assert.equal(records.length,byId.size,'Duplicate Mana Pool identity');
  assert.ok(records.length,'No exact inventory catalog parents');
  const cap=capture(file,'manapool',scopeHash),mappings=new Map(),facts=new Map(),covered=new Set();
  await registerFile(c,file,'market_catalog');
  await insert(c,'source_records',records.map(r=>({id:`${file.sha256}:${r.record_number}`,source_file_id:file.sha256,record_number:r.record_number,raw:r.raw})));
  for(const lot of lots)for(const grade of Object.keys(gradeNames)){
    const r=byId.get(lot.source_scryfall_id),match=matchProduct(lot,r?.raw,grade); if(!match.product)continue;
    const p=match.product,m=mapping(cap,lot,'Mana Pool',p.product_id,gradeNames[grade],`${file.sha256}:${r.record_number}`,'Exact accepted Scryfall/set/collector/finish/language/provider grade. Evidence comparison does not regrade owned cards.');
    mappings.set(m.id,m);if(gradeNames[grade]===lot.condition_normalized)covered.add(lot.lot_id);
    for(const o of observations(p,file.checked_at)){
      const locator=`${p.product_id}/${o.locator}`,id=uuid(`${cap.id}:${locator}`);
      if(facts.has(id))continue;
      facts.set(id,{id,capture_id:cap.id,mapping_id:m.id,source_locator:locator,provider_subject:p.product_id,metric:o.metric,evidence_kind:o.kind,numeric_value:o.value,currency:o.currency,unit:o.unit,price_basis:'unknown',observed_at:o.time,quantity:o.quantity,sample_count:o.kind==='completed_sale'?p.recent_sales.length:null,limitations,raw:o.raw});
    }
  }
  return {...await persist(c,cap,mappings,facts),coverage:{exact_grade_lots:covered.size,total_lots:lots.length},source_date:null,provider_published_at:file.provider_published_at};
}
async function importMTGJSON(c,dir,files,lots,scopeHash,catalogRows) {
  const ids=jsonl(dir,'identifiers.jsonl'),prices=jsonl(dir,'prices.jsonl'),meta=JSON.parse(readFileSync(join(dir,'mtgjson-meta.json')));
  validatePublication(meta.price_meta.date); validatePublication(meta.identity_meta.date);
  const identityFile=files[0],priceFile=files[1],cap=capture(priceFile,'mtgjson',scopeHash,{source_date:meta.price_meta.date,identity_file_id:identityFile.sha256,source_date_precision:'day',currency_policy:'USD only'});
  const pricesById=new Map(prices.map(r=>[r.uuid,r])),catalog=new Map(catalogRows.map(r=>[r.raw.card_id,r.raw])),collisions=collisionKeys(ids,catalog);
  const mappings=new Map(),facts=new Map(),seen=new Map(),coverage={},excluded={native_collision:0,unknown_product:0,missing_identity:lots.length-new Set(ids.flatMap(r=>exactLots(r.raw,lots).map(l=>l.lot_id))).size};
  for(const file of files)await registerFile(c,file,file.name==='AllPrices.json.gz'?'market_history':'provider_identity');
  await insert(c,'source_records',[...ids.map(r=>({id:`${identityFile.sha256}:${r.record_number}`,source_file_id:identityFile.sha256,record_number:r.record_number,raw:r.raw})),...prices.map(r=>({id:`${priceFile.sha256}:${r.record_number}`,source_file_id:priceFile.sha256,record_number:r.record_number,raw:r.raw}))]);
  const existing=(await c.query("SELECT m.provider,m.product_id,m.finish_scope,m.language_scope,identity.product_id scryfall_id FROM canonical_product_mappings m JOIN canonical_product_mappings identity ON identity.variant_id=m.variant_id AND identity.provider='Scryfall' AND identity.status='accepted' AND NOT EXISTS(SELECT 1 FROM canonical_product_mappings n WHERE n.supersedes_id=identity.id) WHERE m.status='accepted'")).rows;
  for(const r of ids){
    const ident=r.raw,matched=exactLots(ident,lots),price=pricesById.get(r.uuid);if(!price||!matched.length)continue;
    for(const [key,side]of [['cardkingdom','buylist'],['cardkingdom','retail'],['tcgplayer','retail'],['manapool','retail']]){
      const data=price.raw.paper?.[key];if(data?.currency!=='USD'||!data[side])continue;
      for(const [finish,days]of Object.entries(data[side])){
        const targets=matched.filter(l=>l.finish===finish&&(side!=='buylist'||(l.condition_normalized==='near_mint'&&l.printed_language==='en')));if(!targets.length)continue;
        const native=key==='tcgplayer'?ident.identifiers?.tcgplayerProductId:nativeId(ident,key,finish,catalog);
        if(!native){excluded.unknown_product++;continue;}
        const provider=`MTGJSON/${key}`,subject=`${native}/${finish}/${side}`;
        if(collisions.has(`${key}/${native}/${finish}`)||existing.some(m=>m.provider===provider&&m.product_id===subject&&(m.language_scope!==targets[0].printed_language||m.scryfall_id!==ident.identifiers.scryfallId))){excluded.native_collision++;continue;}
        const ms=targets.map(l=>mapping(cap,l,provider,subject,side==='buylist'?'near_mint':'not_applicable',`${identityFile.sha256}:${r.record_number}`,`Exact accepted printing/finish/language and native ${key} product. ${side==='buylist'?'Indicative NM bid; no capacity, lock or final acceptance.':'Broad USD retail reference; upstream grade aggregation unspecified.'}`));
        ms.forEach(m=>mappings.set(m.id,m));
        const points=normalizeDays(days,'USD','USD',meta.price_meta.date).filter(p=>p.value!=='0.00');
        const coverageKey=`${key}/${side}`;coverage[coverageKey]??={points:0,lots:new Set(),latest_source_date:null};
        for(const p of points){
          const locator=`${key}/${subject}/${p.date}`;if(seen.has(locator)){assert.equal(seen.get(locator),p.value,'Conflicting native-product daily prices');continue;}seen.set(locator,p.value);
          const id=uuid(`${cap.id}:${locator}`);facts.set(id,{id,capture_id:cap.id,mapping_id:ms[0].id,provider_subject:subject,source_locator:locator,metric:side==='buylist'?'indicated_nm_buylist':'daily_retail_reference',evidence_kind:side==='buylist'?'bid':'source_signal',numeric_value:p.value,currency:'USD',unit:'reported_per_card_price',price_basis:side==='buylist'?'indicative_nm_base_buylist':'unspecified_retail_reference',observed_at:null,window_start:p.start,window_end:p.end,limitations:'Daily upstream price redistributed by MTGJSON. No individual transaction count; retail is not a completed sale or seller net. Buylist capacity and final grade not supplied.',raw:{date:p.date,value:Number(p.value),mtgjson_uuid:r.uuid,upstream:key,side,finish,native_id:String(native),independence_group:key,source_record_id:`${priceFile.sha256}:${price.record_number}`}});
          coverage[coverageKey].points++;coverage[coverageKey].latest_source_date=!coverage[coverageKey].latest_source_date||p.date>coverage[coverageKey].latest_source_date?p.date:coverage[coverageKey].latest_source_date;
        }
        if(points.length)targets.forEach(l=>coverage[coverageKey].lots.add(l.lot_id));
      }
    }
  }
  assert.ok(facts.size,'No eligible USD history points');
  return {...await persist(c,cap,mappings,facts),source_date:meta.price_meta.date,coverage:Object.fromEntries(Object.entries(coverage).map(([k,v])=>[k,{...v,lots:v.lots.size}])),excluded};
}
export async function main() {
  await start(); const c=await appClient();let locked=false;
  const started_at=new Date().toISOString(),run_id=started_at.replaceAll(':','-'),dir=join(root,'data/private/market/daily',run_id),reportDir=join(root,'.local/market-ingestion');
  mkdirSync(dir,{recursive:true});mkdirSync(reportDir,{recursive:true});
  const report={version:'daily-refresh-v1',run_id,started_at,status:'running',sources:[]};
  try{
    locked=(await c.query("SELECT pg_try_advisory_lock(hashtext('cardselling-daily-refresh')) locked")).rows[0].locked;
    if(!locked){console.log(JSON.stringify({status:'already_running'}));return;}
    const lots=(await c.query("SELECT i.*,m.product_id source_scryfall_id FROM canonical_inventory i JOIN canonical_product_mappings m ON m.variant_id=i.variant_id AND m.provider='Scryfall' AND m.status='accepted' AND NOT EXISTS(SELECT 1 FROM canonical_product_mappings n WHERE n.supersedes_id=m.id) ORDER BY lot_id")).rows;
    assert.ok(lots.length);assert.equal(new Set(lots.map(l=>l.lot_id)).size,lots.length,'Ambiguous active identity mappings');
    const stockCount=(await c.query('SELECT count(*)::int n FROM canonical_inventory')).rows[0].n;assert.equal(lots.length,stockCount,'Some lots lack an accepted identity');
    const scopeHash=sha(JSON.stringify(lots.map(l=>[l.lot_id,l.variant_id,l.source_scryfall_id,l.finish,l.printed_language,l.condition_normalized])));
    writeFileSync(join(dir,'wanted.json'),JSON.stringify([...new Set(lots.map(l=>l.source_scryfall_id))]));
    const before=await protectedState(c);
    const reuse=process.argv.find(a=>a.startsWith('--reuse-run='))?.slice(12);
    const downloads=reuse?await Promise.allSettled(JSON.parse(readFileSync(join(reuse,'downloads.json'))).map(async f=>{
      assert.equal(await fileHash(f.path),f.sha256,'Retained download changed');
      assert.ok(Date.now()-Date.parse(f.checked_at)<86400000,'Retained download is older than 24 hours');
      // Recovery/replay preserves original download/capture times, rather than claiming a new online check.
      linkSync(f.path,join(dir,f.name));return {...f,path:join(dir,f.name)};
    })):await Promise.allSettled(Object.keys(urls).map(name=>download(name,dir)));
    const byName=new Map(downloads.filter(r=>r.status==='fulfilled').map(r=>[r.value.name,r.value]));
    // Repeated identical feeds share retained bytes; immutable registered originals remain intact.
    for(const file of byName.values()){
      const archived=(await c.query('SELECT path FROM source_files WHERE id=$1',[file.sha256])).rows[0];
      if(archived&&existsSync(join(root,archived.path))&&join(root,archived.path)!==file.path){
        rmSync(file.path);linkSync(join(root,archived.path),file.path);
      }
    }
    writeFileSync(join(dir,'downloads.json'),JSON.stringify([...byName.values()],null,2));
    let catalogRows=[];
    for(const key of ['manapool','mtgjson']){
      const sourceNames=key==='manapool'?['manapool-singles.json.gz']:['AllIdentifiers.json.gz','AllPrices.json.gz'];
      const checkedTimes=sourceNames.map(n=>byName.get(n)?.checked_at).filter(Boolean).sort();
      const item={key,status:'failed',checked_at:checkedTimes.at(-1)??new Date().toISOString()};report.sources.push(item);
      try{
        const names=key==='manapool'?['manapool-singles.json.gz']:['AllIdentifiers.json.gz','AllPrices.json.gz'];
        for(const name of names){if(!byName.has(name)){const reason=downloads[Object.keys(urls).indexOf(name)].reason;throw new Error(`Download ${name}: ${reason?.message??'failed'}`);}}
        await extract(dir,key);
        if(key==='manapool')catalogRows=jsonl(dir,'catalog.jsonl');
        if(key==='mtgjson'&&!catalogRows.length){catalogRows=(await c.query("SELECT DISTINCT ON (r.raw->>'scryfall_id') r.raw FROM source_records r JOIN canonical_captures cap ON cap.source_file_id=r.source_file_id WHERE cap.provider='Mana Pool' AND r.raw ? 'variants' ORDER BY r.raw->>'scryfall_id',cap.captured_at DESC")).rows.map(r=>({raw:r.raw}));}
        await c.query('BEGIN');
        const result=key==='manapool'?await importManaPool(c,dir,byName.get(names[0]),lots,scopeHash):await importMTGJSON(c,dir,names.map(n=>byName.get(n)),lots,scopeHash,catalogRows);
        assert.deepEqual(await protectedState(c),before,'Refresh changed protected stock or owner decisions');
        await c.query('COMMIT');Object.assign(item,result,{status:'applied',completed_at:new Date().toISOString()});
        // Bulk additions change planner cardinalities substantially. Keep daily
        // read plans current instead of waiting for the next autovacuum cycle.
        for(const table of ['canonical_observations','canonical_product_mappings','canonical_captures'])await c.query(`ANALYZE ${table}`);
      }catch(error){await c.query('ROLLBACK');item.error=String(error.message).replace(/postgres(?:ql)?:\/\/\S+/g,'[redacted]').slice(0,700);item.completed_at=new Date().toISOString();}
      // Each source is independent: one failed feed does not withhold valid others.
    }
    const dealerManifest=process.argv.find(a=>a.startsWith('--dealer-manifest='))?.slice(18);
    if(dealerManifest){
      const item={key:'tcgsentry',status:'failed',checked_at:new Date().toISOString()};report.sources.push(item);
      try{Object.assign(item,await importDealerManifest(dealerManifest),{status:'applied',completed_at:new Date().toISOString()});}
      catch(error){item.error=String(error.message).replace(/postgres(?:ql)?:\/\/\S+/g,'[redacted]').slice(0,700);item.completed_at=new Date().toISOString();}
    }
    assert.deepEqual(await protectedState(c),before);
    report.protected_data='unchanged';report.completed_at=new Date().toISOString();report.status=report.sources.every(s=>s.status==='applied')?'applied':report.sources.some(s=>s.status==='applied')?'partial':'failed';
    const priorPath=join(reportDir,'daily-refresh-latest.json'),prior=existsSync(priorPath)?JSON.parse(readFileSync(priorPath)):null;
    report.last_good=Object.fromEntries(report.sources.map(s=>[s.key,s.status==='applied'?s:prior?.last_good?.[s.key]??null]));
    writeFileSync(join(reportDir,`daily-refresh-${run_id}.json`),JSON.stringify(report,null,2));
    writeFileSync(priorPath+'.tmp',JSON.stringify(report,null,2));renameSync(priorPath+'.tmp',priorPath);
    console.log(JSON.stringify(report,null,2));if(report.status!=='applied')process.exitCode=1;
  }finally{if(locked)await c.query("SELECT pg_advisory_unlock(hashtext('cardselling-daily-refresh'))");await c.end();}
}
if(process.argv[1]?.replaceAll('\\','/').endsWith('/refresh-market-data.mjs'))main().catch(error=>{console.error(String(error.message).replace(/postgres(?:ql)?:\/\/\S+/g,'[redacted]'));process.exitCode=1;});
