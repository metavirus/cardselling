// Controlled hydration of a dated TCGSentry export. Inventory remains canonical.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {join,relative,resolve} from 'node:path';
import {parse} from 'csv-parse/sync';
import {appClient,root} from './database.mjs';

const manifestPath=process.argv.find(x=>x.endsWith('.manifest.json'));
assert.ok(manifestPath,'Pass a capture .manifest.json with file, sha256, captured_at, expected_rows');
const manifest=JSON.parse(readFileSync(resolve(root,manifestPath),'utf8'));
const path=resolve(root,manifest.file);
assert.ok(Number.isSafeInteger(manifest.expected_rows)&&manifest.expected_rows>0);
assert.match(manifest.captured_at,/^\d{4}-\d{2}-\d{2}T/);
assert.ok(Number.isFinite(Date.parse(manifest.captured_at)));
const bytes=readFileSync(path),rows=parse(bytes,{columns:true,bom:true,skip_empty_lines:true});
const sha=value=>createHash('sha256').update(value).digest('hex');
const uuid=value=>{const h=sha(value);return `${h.slice(0,8)}-${h.slice(8,12)}-5${h.slice(13,16)}-a${h.slice(17,20)}-${h.slice(20,32)}`;};
const normNumber=n=>/^0*\d+[A-Za-z]*$/.test(n)?n.replace(/^0+(?=\d)/,'').toLowerCase():n.toLowerCase();
const cents=(s,label)=>{assert.match(s,/^\d+(?:\.\d{1,2})?$/,label);const n=Math.round(Number(s)*100);assert.ok(Number.isSafeInteger(n)&&n>=0,label);return n;};
assert.equal(rows.length,manifest.expected_rows);
const sourceId=sha(bytes);
let captureId=uuid(`tcgsentry-collection-refresh:${sourceId}:${new Date(manifest.captured_at).toISOString()}`);
// Retain the original download timestamp even if a backup restore changes mtime.
assert.equal(sourceId,manifest.sha256);
const fileMtime=new Date(manifest.captured_at).toISOString(),sourceDate=fileMtime.slice(0,10);
const file={id:sourceId,path:relative(root,path).replaceAll('\\','/'),classification:'dated_dealer_hydration',byte_size:bytes.length,metadata:{provider:'TCGSentry collection export',source_time_text:'Timestamped download; vendor refresh times unknown',capture_time_basis:'Local downloaded file last-write time; not upstream dealer observation time',inventory_authority:false,source_date:sourceDate}};
const sourceRecords=rows.map((raw,i)=>({id:`${sourceId}:${i+1}`,source_file_id:sourceId,record_number:i+1,raw}));
const capture={id:captureId,provider:'TCGSentry',upstream_provider:'Card Kingdom and Star City Games values redistributed in TCGSentry collection export',source_file_id:sourceId,source_url:'https://tcgsentry.com/collection',content_hash:sourceId,captured_at:fileMtime,source_observed_at:null,source_time_text:'Timestamped download; upstream refresh unknown',use_state:'eligible',sample_kind:'dated_dealer_export_hydration',sample_limit:null,completeness:'unknown',metadata:{source_date:sourceDate,date_precision:'day',inventory_authority:false,condition_basis:'Source NM/EX/VG preserved; dealer final grade not verified',price_basis:'Indicative source-reported dealer cash, not approved checkout quote',no_native_dealer_product_id:true,net_estimates_excluded:true}};
const allowed=new Set(['source_files','source_records','canonical_captures','canonical_product_mappings','canonical_observations']);
async function insert(c,table,items){
 assert.ok(allowed.has(table));if(!items.length)return;
 for(let start=0;start<items.length;start+=100){
  const batch=items.slice(start,start+100),keys=Object.keys(batch[0]).sort();for(const row of batch)assert.deepEqual(Object.keys(row).sort(),keys);
  const columns=keys.map(k=>`"${k}"`).join(','),payload=JSON.stringify(batch);
  const input=`SELECT ${columns} FROM jsonb_populate_recordset(NULL::${table},$1::jsonb)`;
  await c.query(`INSERT INTO ${table}(${columns}) ${input} ON CONFLICT DO NOTHING`,[payload]);
  assert.equal((await c.query(`SELECT * FROM (${input} EXCEPT SELECT ${columns} FROM ${table} WHERE id=ANY($2)) d LIMIT 1`,[payload,batch.map(x=>x.id)])).rowCount,0,`Immutable ${table} replay differs`);
 }
}
const c=await appClient();
try{
 await c.query('BEGIN');await c.query("SELECT pg_advisory_xact_lock(hashtext('tcgsentry-current-hydration'))");
 const priorCapture=(await c.query("SELECT id FROM canonical_captures WHERE provider='TCGSentry' AND content_hash=$1 AND captured_at=$2 AND sample_kind='dated_dealer_export_hydration'",[sourceId,fileMtime])).rows;
 assert.ok(priorCapture.length<=1,'Ambiguous duplicate capture');
 if(priorCapture.length){captureId=priorCapture[0].id;capture.id=captureId;}
 const stock=(await c.query('SELECT count(*)::int lots,sum(owned_quantity)::int owned,sum(available_quantity)::int available FROM canonical_inventory')).rows[0];
 assert.deepEqual(stock,{lots:723,owned:817,available:817});
 const inventory=(await c.query(`SELECT i.*,r.raw->>'Scryfall ID' AS raw_sid,s.product_id AS accepted_sid
  FROM canonical_inventory i JOIN source_records r ON r.id=i.origin_record_id
  JOIN canonical_product_mappings s ON s.variant_id=i.variant_id AND s.provider='Scryfall' AND s.status='accepted'
   AND NOT EXISTS(SELECT 1 FROM canonical_product_mappings next WHERE next.supersedes_id=s.id)`)).rows;
 assert.equal(inventory.length,723);
 const byAccepted=new Map(),byRaw=new Map();for(const lot of inventory){for(const [map,key] of [[byAccepted,lot.accepted_sid],[byRaw,lot.raw_sid]]){if(!map.has(key))map.set(key,[]);map.get(key).push(lot);}}
 const mappings=[],observations=[],rejected=[];let acceptedRows=0,ckBids=0,ckCapacity=0,scgBids=0;
 for(let i=0;i<rows.length;i++){
  const row=rows[i],index=i+1,sourceRecordId=sourceRecords[i].id;
  const possible=byAccepted.get(row['Scryfall ID'])||[];
  const rawCandidates=byRaw.get(row['Scryfall ID'])||[];
  assert.ok(possible.length||rawCandidates.length,`Unknown Scryfall ID in export row ${index}`);
  const core=possible.filter(l=>l.set_code===row['Set code'].toLowerCase()&&normNumber(l.collector_number)===normNumber(row.Number)&&l.finish===row.Finish);
  const exact=core.filter(l=>l.printed_language===row.Language);
  // A source scan quantity is neither a new lot nor a stock update.
  assert.ok(Number.isSafeInteger(Number(row.Quantity))&&Number(row.Quantity)>0);
  const reason=!possible.length?'Export Scryfall ID conflicts with accepted language-specific printing':!core.length?'Set, collector number or finish conflicts with canonical printing':!exact.length?'Export English language conflicts with owner-confirmed printed language':(row.Condition!=='NM'||exact.some(l=>l.condition_normalized!=='near_mint'))?'Non-NM source condition has no verified translation to canonical owner grade':null;
  if(reason){
   const target=(exact.length?exact:core.length?core:possible.length?possible:rawCandidates)[0];
   mappings.push({id:uuid(`${captureId}:rejected:${index}`),variant_id:target.variant_id,provider:'TCGSentry/dealer_export',product_id:`export-row:${index}`,condition_scope:`source_${row.Condition.toLowerCase()}`,finish_scope:row.Finish,language_scope:row.Language,status:'rejected',basis:`${reason}; source row retained, no dealer price/capacity promoted. Original export set=${row['Set code']} number=${row.Number} finish=${row.Finish} language=${row.Language} condition=${row.Condition}.`,source_record_id:sourceRecordId,capture_id:captureId});
   rejected.push({row:index,name:row.Name,reason,canonical:(possible.length?possible:rawCandidates).map(l=>({set:l.set_code,number:l.collector_number,finish:l.finish,language:l.printed_language,accepted_scryfall_id:l.accepted_sid}))});
   continue;
  }
  assert.equal(exact.length,1,`Ambiguous exact physical lot for export row ${index}`);
  const lot=exact[0];assert.ok(lot.name===row.Name||lot.name.startsWith(`${row.Name} // `),`Name differs for export row ${index}`);
  acceptedRows++;
  const ckPrice=cents(row['CardKingdom price'],'CardKingdom price');
  const qty=Number(row['CardKingdom qty']);assert.ok(Number.isSafeInteger(qty)&&qty>=0);
  const ckMappingId=uuid(`${captureId}:ck:${index}`),ckSubject=`tcgsentry-export:${sourceId}:${index}:ck`;
  mappings.push({id:ckMappingId,variant_id:lot.variant_id,provider:'TCGSentry/Card Kingdom',product_id:ckSubject,condition_scope:lot.condition_normalized,finish_scope:lot.finish,language_scope:lot.printed_language,status:'accepted',basis:'Exact source Scryfall ID, set, normalized collector number, finish, language and name match canonical lot. Dealer product SKU is not independently verified; quote/grade/capacity are source-export indications only.',source_record_id:sourceRecordId,capture_id:captureId});
  const base={capture_id:captureId,mapping_id:ckMappingId,provider_subject:ckSubject,currency:'USD',observed_at:null,window_start:null,window_end:null,sample_count:null,limitations:'TCGSentry export redistributes dealer data. Vendor refresh time, exact dealer SKU, final grade, quote lock and execution terms unknown. Export file date is not a price-validity window.'};
  observations.push({id:uuid(`${captureId}:${index}:ck-price`),...base,source_locator:`${index}/cardkingdom_price`,metric:'exported_ck_cash_buylist_indication',evidence_kind:'bid',numeric_value:(ckPrice/100).toFixed(2),text_value:null,unit:'usd_per_copy',price_basis:'source_reported_indicative_cash',quantity:null,raw:{source_record_id:sourceRecordId,source_condition:row.Condition,source_price:row['CardKingdom price'],source_date:sourceDate,source_quoted_quantity:qty,tcgplayer_product_id:row['TCGplayer product ID']}});ckBids++;
  observations.push({id:uuid(`${captureId}:${index}:ck-quantity`),...base,source_locator:`${index}/cardkingdom_qty`,metric:'exported_ck_wanted_quantity',evidence_kind:'demand',numeric_value:qty,text_value:null,currency:null,unit:'copies_wanted_at_export',price_basis:'not_a_price',quantity:qty,raw:{source_record_id:sourceRecordId,source_condition:row.Condition,source_quantity:row['CardKingdom qty'],source_date:sourceDate,tcgplayer_product_id:row['TCGplayer product ID']}});ckCapacity++;
  if(row['Star City Games price']!==''){
   const scgPrice=cents(row['Star City Games price'],'Star City Games price');
   const scgMappingId=uuid(`${captureId}:scg:${index}`),subject=`tcgsentry-export:${sourceId}:${index}:scg`;
   mappings.push({id:scgMappingId,variant_id:lot.variant_id,provider:'TCGSentry/Star City Games',product_id:subject,condition_scope:lot.condition_normalized,finish_scope:lot.finish,language_scope:lot.printed_language,status:'accepted',basis:'Exact source Scryfall ID, set, normalized collector number, finish, language and name match canonical lot. Native SCG product SKU, wanted quantity, grade basis and executable quote are unknown.',source_record_id:sourceRecordId,capture_id:captureId});
   observations.push({id:uuid(`${captureId}:${index}:scg-price`),capture_id:captureId,mapping_id:scgMappingId,source_locator:`${index}/star_city_games_price`,provider_subject:subject,metric:'exported_scg_cash_buylist_indication',evidence_kind:'bid',numeric_value:(scgPrice/100).toFixed(2),text_value:null,currency:'USD',unit:'usd_per_copy',price_basis:'source_reported_indicative_cash',observed_at:null,window_start:null,window_end:null,quantity:null,sample_count:null,limitations:'TCGSentry export redistributes SCG price; native product SKU, capacity, vendor refresh time and final grade unknown. Zero reported price is retained, not treated as executable cash.',raw:{source_record_id:sourceRecordId,source_condition:row.Condition,source_price:row['Star City Games price'],source_date:sourceDate,tcgplayer_product_id:row['TCGplayer product ID']}});scgBids++;
  }
 }
 assert.equal(acceptedRows+rejected.length,rows.length);
 assert.equal(ckBids,acceptedRows);assert.equal(ckCapacity,acceptedRows);
 assert.equal(sha(readFileSync(path)),sourceId,'Source changed during ingestion');
 // Identical bytes can be captured again later without rewriting the first
 // archived file record. The new capture retains its distinct capture time.
 const archivedFile=(await c.query('SELECT byte_size FROM source_files WHERE id=$1',[sourceId])).rows[0];
 if(archivedFile)assert.equal(Number(archivedFile.byte_size),bytes.length);
 else await insert(c,'source_files',[file]);
 await insert(c,'source_records',sourceRecords);
 await insert(c,'canonical_captures',[capture]);await insert(c,'canonical_product_mappings',mappings);await insert(c,'canonical_observations',observations);
 assert.deepEqual((await c.query('SELECT count(*)::int lots,sum(owned_quantity)::int owned,sum(available_quantity)::int available FROM canonical_inventory')).rows[0],stock);
 assert.equal((await c.query('SELECT count(*)::int n FROM source_records WHERE source_file_id=$1',[sourceId])).rows[0].n,rows.length);
 assert.equal((await c.query('SELECT count(*)::int n FROM canonical_observations WHERE capture_id=$1',[captureId])).rows[0].n,observations.length);
 assert.equal((await c.query("SELECT count(*)::int n FROM canonical_product_mappings WHERE capture_id=$1 AND status='rejected'",[captureId])).rows[0].n,rejected.length);
 assert.equal((await c.query('SELECT count(*)::int n FROM canonical_quotes WHERE capture_id=$1',[captureId])).rows[0].n,0);
 await c.query(process.argv.includes('--apply')?'COMMIT':'ROLLBACK');
 console.log(JSON.stringify({status:process.argv.includes('--apply')?'applied':'trial_rolled_back',source_sha256:sourceId,capture_id:captureId,rows:rows.length,accepted_rows:acceptedRows,rejected_matches:rejected,ck_bids:ckBids,ck_quantities:ckCapacity,ck_zero_capacity:observations.filter(o=>o.metric==='exported_ck_wanted_quantity'&&o.quantity===0).length,scg_bids:scgBids,observations:observations.length,stock}));
}catch(error){await c.query('ROLLBACK');throw error;}finally{await c.end();}
