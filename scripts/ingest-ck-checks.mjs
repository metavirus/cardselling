// Read-only public Card Kingdom buylist checks; trial by default.
// Cash and wanted quantities are indicative, not approved quotes or inventory moves.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync,statSync} from 'node:fs';
import {join,relative} from 'node:path';
import {appClient,root} from './database.mjs';

const inputAt=process.argv.indexOf('--input');
const path=join(root,inputAt>=0?process.argv[inputAt+1]:'data/private/market/2026-10-04/ck-buylist-checks.json');
const bytes=readFileSync(path),raw=JSON.parse(bytes);
const sha=value=>createHash('sha256').update(value).digest('hex');
const uuid=value=>{const h=sha(value);return `${h.slice(0,8)}-${h.slice(8,12)}-5${h.slice(13,16)}-a${h.slice(17,20)}-${h.slice(20,32)}`;};
assert.equal(raw.provider,'Card Kingdom');assert.ok(raw.checks.length>0);
const listed=raw.checks.filter(r=>r.status==='listed');
const absent=raw.checks.filter(r=>r.status==='not_listed');
assert.equal(listed.length+absent.length,raw.checks.length);
assert.equal(new Set(raw.checks.map(r=>r.lot_id)).size,raw.checks.length);
const captureTime=raw.checks[0].captured_at,sourceDay=raw.checks[0].observed_date;
assert.match(captureTime,/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/);
assert.match(sourceDay,/^\d{4}-\d{2}-\d{2}$/);
assert.equal(new Date(captureTime).toISOString().slice(0,10),sourceDay);
const sourceId=sha(bytes),captureId=uuid(`ck-public-buylist:${sourceId}`);
const detailedTimes=raw.checks.every(r=>typeof r.page_read_at==='string');
const sourceFile={id:sourceId,path:relative(root,path).replaceAll('\\','/'),classification:'targeted_public_buylist_checks',byte_size:statSync(path).size,metadata:{provider:'Card Kingdom',scope:`${raw.checks.length} targeted read-only ${detailedTimes?'lot checks':'title searches'}, ${listed.length} exact listings and ${absent.length} exact printings absent from visible results`,time_basis:detailedTimes?raw.checks[0].timestamp_basis:'Transcription time; exact page-read times not retained',source_date:sourceDay}};
const sourceRecords=raw.checks.map((check,i)=>({id:`${sourceId}:${i+1}`,source_file_id:sourceId,record_number:i+1,raw:check}));
const capture={id:captureId,provider:'Card Kingdom',upstream_provider:'Card Kingdom public buylist website',source_file_id:sourceId,source_url:'https://www.cardkingdom.com/purchasing/mtg_singles',content_hash:sourceId,captured_at:captureTime,source_observed_at:null,source_time_text:sourceDay,use_state:'eligible',sample_kind:'targeted_public_buylist_snapshot',sample_limit:null,completeness:'unknown',metadata:{checks:raw.checks.length,listed:listed.length,not_listed:absent.length,date_precision:'day',timestamp_basis:detailedTimes?raw.checks[0].timestamp_basis:'Browser page read during task; exact page-read time not retained; captured_at is transcription time',not_order:true,condition_basis:'English NM base; final grade and approval may differ'}};
const c=await appClient();let checks=0;
const allowed=new Set(['source_files','source_records','canonical_captures','canonical_product_mappings','canonical_observations']);
async function insert(table,rows){
 assert.ok(allowed.has(table));if(!rows.length)return;
 const keys=Object.keys(rows[0]);for(const row of rows)assert.deepEqual(Object.keys(row),keys);
 const columns=keys.map(k=>`"${k}"`).join(',');
 const input=`SELECT ${columns} FROM jsonb_populate_recordset(NULL::${table},$1::jsonb)`;
 const payload=JSON.stringify(rows);
 await c.query(`INSERT INTO ${table}(${columns}) ${input} ON CONFLICT DO NOTHING`,[payload]);
 const diff=await c.query(`SELECT * FROM (${input} EXCEPT SELECT ${columns} FROM ${table} WHERE id=ANY($2)) d LIMIT 1`,[payload,rows.map(r=>r.id)]);
 assert.equal(diff.rowCount,0,`Immutable ${table} replay differs`);
}
try{
 await c.query('BEGIN');await c.query("SELECT pg_advisory_xact_lock(hashtext('ck-public-buylist-checks'))");
 const stock=(await c.query('SELECT count(*)::int lots,sum(owned_quantity)::int copies,sum(available_quantity)::int available FROM canonical_inventory')).rows[0];
 assert.ok(stock.lots>0&&stock.copies>=stock.available);
 const inventory=(await c.query('SELECT * FROM canonical_inventory WHERE lot_id=ANY($1)',[raw.checks.map(r=>r.lot_id)])).rows;
 assert.equal(inventory.length,raw.checks.length);const byLot=new Map(inventory.map(r=>[r.lot_id,r]));
 const mappings=[],observations=[];
 for(let i=0;i<raw.checks.length;i++){
  const row=raw.checks[i],lot=byLot.get(row.lot_id),recordId=sourceRecords[i].id;
  assert.ok(lot,`Missing lot ${row.lot_id}`);
  for(const field of ['name','set_code','collector_number','finish','printed_language','condition_normalized'])assert.equal(row[field],lot[field],`Lot ${row.lot_id}: ${field}`);
  assert.equal(row.captured_at,captureTime);assert.equal(row.observed_date,sourceDay);
  assert.equal(row.timestamp_basis,raw.checks[0].timestamp_basis);
  assert.ok(row.verification_basis?.includes('Read-only public Card Kingdom buylist DOM'));
  const search=new URL(row.source_url);
  assert.equal(search.origin,'https://www.cardkingdom.com');assert.equal(search.pathname,'/purchasing/mtg_singles');
  assert.equal(search.searchParams.get('filter[name]'),row.name);
  const locator=`${i+1}/${row.lot_id}`;
  if(row.status==='listed'){
   assert.equal(row.printed_language,'en');assert.equal(row.condition_normalized,'near_mint');
   assert.ok(Number.isFinite(row.cash_usd)&&row.cash_usd>0&&Math.round(row.cash_usd*100)/100===row.cash_usd);
   assert.ok(Number.isSafeInteger(row.max_quantity)&&row.max_quantity>=0);
   const product=new URL(row.product_url);
   assert.equal(product.origin,'https://www.cardkingdom.com');assert.match(product.pathname,/^\/mtg\/[^/?#]+\/[^/?#]+$/);
   assert.ok(row.product_title?.trim());
   const mappingId=uuid(`${captureId}:mapping:${row.lot_id}:${row.product_url}`);
   mappings.push({id:mappingId,variant_id:lot.variant_id,provider:'Card Kingdom/public_buylist',product_id:row.product_url,condition_scope:'near_mint',finish_scope:lot.finish,language_scope:lot.printed_language,status:'accepted',basis:`Public listing matched title, edition, collector number and finish to canonical lot; ${row.verification_basis}`,source_record_id:recordId,capture_id:captureId});
   observations.push({id:uuid(`${captureId}:${locator}:cash`),capture_id:captureId,mapping_id:mappingId,source_locator:locator,provider_subject:row.product_url,metric:'public_cash_buylist_indication',evidence_kind:'bid',numeric_value:row.cash_usd.toFixed(2),text_value:null,currency:'USD',unit:'usd_per_copy',price_basis:'indicative_english_nm_cash',observed_at:null,window_start:`${sourceDay}T00:00:00Z`,window_end:new Date(Date.parse(`${sourceDay}T00:00:00Z`)+86400000).toISOString(),quantity:null,sample_count:null,limitations:row.limitations,raw:{source_url:row.source_url,product_url:row.product_url,product_title:row.product_title,cash_usd:row.cash_usd,timestamp_basis:row.timestamp_basis}});
   observations.push({id:uuid(`${captureId}:${locator}:wanted`),capture_id:captureId,mapping_id:mappingId,source_locator:locator,provider_subject:row.product_url,metric:'public_max_wanted_quantity',evidence_kind:'demand',numeric_value:row.max_quantity,text_value:null,currency:null,unit:'copies_wanted_at_page_read',price_basis:'not_a_price',observed_at:null,window_start:`${sourceDay}T00:00:00Z`,window_end:new Date(Date.parse(`${sourceDay}T00:00:00Z`)+86400000).toISOString(),quantity:row.max_quantity,sample_count:null,limitations:row.limitations,raw:{source_url:row.source_url,product_url:row.product_url,product_title:row.product_title,max_quantity:row.max_quantity,timestamp_basis:row.timestamp_basis}});
  } else {
   assert.equal(row.status,'not_listed');assert.equal(row.cash_usd,null);assert.equal(row.max_quantity,null);assert.equal(row.product_url,null);
   observations.push({id:uuid(`${captureId}:${locator}:absent`),capture_id:captureId,mapping_id:null,source_locator:locator,provider_subject:row.lot_id,metric:'exact_printing_not_visible_in_title_search',evidence_kind:'qualitative',numeric_value:null,text_value:'not_listed_in_visible_search_results',currency:null,unit:'search_result_presence',price_basis:'not_a_price',observed_at:null,window_start:`${sourceDay}T00:00:00Z`,window_end:new Date(Date.parse(`${sourceDay}T00:00:00Z`)+86400000).toISOString(),quantity:null,sample_count:null,limitations:row.limitations,raw:{source_url:row.source_url,lot_id:row.lot_id,product_title:row.product_title,timestamp_basis:row.timestamp_basis}});
  }
  checks++;
 }
 await insert('source_files',[sourceFile]);await insert('source_records',sourceRecords);await insert('canonical_captures',[capture]);
 await insert('canonical_product_mappings',mappings);await insert('canonical_observations',observations);
 assert.equal(sha(readFileSync(path)),sourceId,'Source file changed during ingestion');
 assert.equal((await c.query('SELECT count(*)::int n FROM source_files WHERE id=$1 AND byte_size=$2',[sourceId,bytes.length])).rows[0].n,1);
 assert.equal((await c.query('SELECT count(*)::int n FROM source_records WHERE source_file_id=$1',[sourceId])).rows[0].n,raw.checks.length);
 assert.equal((await c.query('SELECT count(*)::int n FROM canonical_product_mappings WHERE capture_id=$1',[captureId])).rows[0].n,listed.length);
 assert.deepEqual((await c.query('SELECT count(*)::int lots,sum(owned_quantity)::int copies,sum(available_quantity)::int available FROM canonical_inventory')).rows[0],stock);
 assert.equal((await c.query('SELECT count(*)::int n FROM canonical_observations WHERE capture_id=$1',[captureId])).rows[0].n,listed.length*2+absent.length);
 assert.equal((await c.query('SELECT count(*)::int n FROM canonical_quotes WHERE capture_id=$1',[captureId])).rows[0].n,0);
 await c.query(process.argv.includes('--apply')?'COMMIT':'ROLLBACK');
 console.log(JSON.stringify({status:process.argv.includes('--apply')?'applied':'trial_rolled_back',capture_id:captureId,source_sha256:sourceId,checks,listed:mappings.length,indicative_bids:listed.length,wanted_quantities:listed.length,qualitative_not_listed:absent.length,observations:observations.length,inventory:stock}));
}catch(error){await c.query('ROLLBACK');throw error;}finally{await c.end();}
