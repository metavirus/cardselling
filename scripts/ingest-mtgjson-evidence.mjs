// Official 90-day MTGJSON capture: Card Kingdom indicated NM buylist and
// TCGplayer retail reference. Dealer capacity/grade acceptance are not inferred.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createReadStream,readFileSync,writeFileSync,mkdirSync,statSync} from 'node:fs';
import {join,relative} from 'node:path';
import {appClient,root} from './database.mjs';
const dir=join(root,'data/private/market/2026-10-04');
const info=JSON.parse(readFileSync(join(dir,'mtgjson-extraction.json')));
const scope=JSON.parse(readFileSync(join(dir,'inventory-scope.json')));
const byScryfall=new Map();
for(const lot of scope){if(!byScryfall.has(lot.source_scryfall_id))byScryfall.set(lot.source_scryfall_id,[]);byScryfall.get(lot.source_scryfall_id).push(lot);}
const uuid=v=>{const h=createHash('sha256').update(v).digest('hex');return `${h.slice(0,8)}-${h.slice(8,12)}-5${h.slice(13,16)}-a${h.slice(17,20)}-${h.slice(20,32)}`;};
const digest=async path=>{const h=createHash('sha256');for await(const chunk of createReadStream(path))h.update(chunk);return h.digest('hex');};
const originals=['AllIdentifiers.json.gz','AllPrices.json.gz'];
const fileRows=[];
for(const name of originals){const path=join(dir,name),id=await digest(path);assert.equal(id,info.source_hashes[name]);fileRows.push({id,path:relative(root,path).replaceAll('\\','/'),classification:name.startsWith('AllPrices')?'market_history':'provider_identity',byte_size:statSync(path).size,metadata:{url:`https://mtgjson.com/api/v5/${name}`,source_date:info.price_meta.date,version:info.price_meta.version,scope:'Original complete published file; extracted inventory records stored in source_records',time_basis:'Local download completion'}});}
for(const name of ['mtgjson-identifiers.jsonl','mtgjson-prices.jsonl'])assert.equal(await digest(join(dir,name)),info.extract_hashes[name]);
assert.equal(await digest(join(dir,'inventory-scope.json')),info.scope_sha256);
const identifiers=readFileSync(join(dir,'mtgjson-identifiers.jsonl'),'utf8').trim().split('\n').map(JSON.parse);
const prices=readFileSync(join(dir,'mtgjson-prices.jsonl'),'utf8').trim().split('\n').map(JSON.parse);
assert.equal(identifiers.length,info.matched_identifiers);assert.equal(prices.length,info.matched_prices);
const identities=new Map(identifiers.map(r=>[r.uuid,r]));
assert.equal(identities.size,identifiers.length);
const sourceRows=[...identifiers.map(r=>({id:`${fileRows[0].id}:${r.record_number}`,source_file_id:fileRows[0].id,record_number:r.record_number,raw:r.raw})),...prices.map(r=>({id:`${fileRows[1].id}:${r.record_number}`,source_file_id:fileRows[1].id,record_number:r.record_number,raw:r.raw}))];
const captureId=uuid(`mtgjson-prices:${fileRows[1].id}`);
const capturedAt=statSync(join(dir,'AllPrices.json.gz')).mtime.toISOString();
const capture={id:captureId,provider:'MTGJSON',upstream_provider:'Card Kingdom and TCGplayer; separate upstreams, same MTGJSON redistribution',source_file_id:fileRows[1].id,source_url:'https://mtgjson.com/api/v5/AllPrices.json.gz',content_hash:fileRows[1].id,captured_at:capturedAt,source_observed_at:null,source_time_text:info.price_meta.date,use_state:'eligible',sample_kind:'daily_provider_price_reference_rolling_90_days',sample_limit:90,completeness:'unknown',metadata:{version:info.price_meta.version,identity_file_id:fileRows[0].id,source_date:info.price_meta.date,source_date_precision:'day',upstream_lineage:{cardkingdom:'Indicative NM base buylist; capacity, eligibility, payout and grading unverified',tcgplayer:'Retail price reference; grade and sale/listing methodology not asserted'},no_transaction_count:true}};
const finishType={normal:'nonfoil',foil:'foil',etched:'etched'};
const languageCode={English:'en',Japanese:'ja',Phyrexian:'ph'};
const mappings=new Map(),facts=[],coverage={inventory_lots:scope.length,matched_identifiers:0,ck_lots_with_latest:0,tcg_lots_with_latest:0,unmatched:[]};
for(const price of prices){
 const ident=identities.get(price.uuid)?.raw;
 assert.ok(ident,'Missing identity for price record');
 const scryfall=ident.identifiers?.scryfallId,lots=byScryfall.get(scryfall)||[];
 const language=languageCode[ident.language];
 if(!language)continue;
 const exact=lots.filter(l=>l.set_code===ident.setCode.toLowerCase()&&l.collector_number===ident.number&&l.printed_language===language&&ident.finishes.includes(finishType[l.finish]));
 if(exact.length===0)continue;
 coverage.matched_identifiers++;
 for(const {key,side,kind,metric,condition} of [
  {key:'cardkingdom',side:'buylist',kind:'bid',metric:'indicated_nm_buylist',condition:'near_mint'},
  {key:'tcgplayer',side:'retail',kind:'source_signal',metric:'daily_retail_reference',condition:'not_applicable'}]){
  const upstream=price.raw.paper?.[key]?.[side];if(!upstream)continue;
  const currency=price.raw.paper[key].currency;
  assert.match(currency,/^[A-Z]{3}$/);
  for(const [finish,days] of Object.entries(upstream)){
   if(!['normal','foil','etched'].includes(finish))continue;
   const matchingLots=exact.filter(l=>l.finish===finish);
   if(!matchingLots.length)continue;
   // CK's ordinary buylist is English-only; specialized treatments require
   // actual product/approval evidence. Other-language data stays in raw source.
   if(key==='cardkingdom'&&language!=='en')continue;
   const nativeId=key==='cardkingdom'?(finish==='foil'?ident.identifiers.cardKingdomFoilId:finish==='etched'?ident.identifiers.cardKingdomEtchedId:ident.identifiers.cardKingdomId):ident.identifiers.tcgplayerProductId;
   if(!nativeId)continue;
   const provider=`MTGJSON/${key}`,subject=`${price.uuid}/${finish}/${side}`;
   for(const lot of matchingLots){
    const id=uuid(`${captureId}:${provider}:${lot.variant_id}:${subject}`);
    mappings.set(id,{id,variant_id:lot.variant_id,provider,product_id:subject,condition_scope:condition,finish_scope:finish,language_scope:language,status:'accepted',basis:`Exact Scryfall ID, set, collector number, language, finish and MTGJSON UUID; upstream native ID ${nativeId}. ${key==='cardkingdom'?'English NM buylist basis; no capacity or guaranteed acceptance.':'Retail reference has no exact grade; do not treat as a sale or quote.'}`,source_record_id:`${fileRows[0].id}:${identities.get(price.uuid).record_number}`,capture_id:captureId});
   }
   // Duplicate lots share one upstream product and one historical series.
   const mapping=[...mappings.values()].find(m=>m.provider===provider&&m.product_id===subject);
   for(const [date,value] of Object.entries(days)){
    assert.match(date,/^\d{4}-\d{2}-\d{2}$/);assert.ok(Number.isFinite(value)&&value>=0);
    const cents=Math.round(value*100);assert.ok(Math.abs(cents/100-value)<0.00001,'Unexpected subcent price');
    const locator=`${subject}/${key}/${date}`;
    facts.push({id:uuid(`${captureId}:${locator}`),capture_id:captureId,mapping_id:mapping.id,source_locator:locator,provider_subject:subject,metric,evidence_kind:kind,numeric_value:(cents/100).toFixed(2),text_value:null,currency,unit:'reported_per_card_price',price_basis:key==='cardkingdom'?'indicative_nm_base_buylist':'unspecified_retail_reference',observed_at:null,window_start:`${date}T00:00:00Z`,window_end:new Date(Date.parse(`${date}T00:00:00Z`)+86400000).toISOString(),quantity:null,sample_count:null,limitations:key==='cardkingdom'?'MTGJSON redistribution of Card Kingdom NM base buylist. No wanted quantity, individual seller eligibility, final grade, locked quote or approved cash. Day precision only. Published daily values may repeat; not transactions.':'MTGJSON redistribution of TCGplayer retail reference. Method, exact grade and language distribution not established. Not a completed sale, quantity, firm bid or seller net. Day precision only.',raw:{date,value,mtgjson_uuid:price.uuid,upstream:key,side,finish,native_id:String(nativeId)}});
   }
  }
 }
}
assert.equal(new Set(facts.map(f=>f.source_locator)).size,facts.length,'Duplicate price points');
const allowed=new Set(['source_files','source_records','canonical_captures','canonical_product_mappings','canonical_observations']);
async function insert(c,table,rows){
 assert.ok(allowed.has(table));
 for(let offset=0;offset<rows.length;offset+=200){
  const batch=rows.slice(offset,offset+200),keys=Object.keys(batch[0]),columns=keys.map(k=>`"${k}"`).join(',');
  const input=`SELECT ${columns} FROM jsonb_populate_recordset(NULL::${table},$1::jsonb)`;
  await c.query(`INSERT INTO ${table}(${columns}) ${input} ON CONFLICT DO NOTHING`,[JSON.stringify(batch)]);
  const diff=await c.query(`SELECT * FROM (${input} EXCEPT SELECT ${columns} FROM ${table} WHERE id=ANY($2)) d LIMIT 1`,[JSON.stringify(batch),batch.map(r=>r.id)]);
  assert.equal(diff.rowCount,0,`Immutable replay differs for ${table}`);
 }
}
const c=await appClient();
try{
 await c.query('BEGIN');await c.query("SELECT pg_advisory_xact_lock(hashtext('mtgjson-price-ingestion'))");
 const current=(await c.query(`SELECT i.*,r.raw->>'Scryfall ID' AS source_scryfall_id FROM canonical_inventory i JOIN source_records r ON r.id=i.origin_record_id ORDER BY lot_id`)).rows;
 assert.deepEqual(current,scope,'Prepared scope changed');
 const stock=(await c.query('SELECT count(*)::int lots,sum(owned_quantity)::int copies,sum(available_quantity)::int available FROM canonical_inventory')).rows[0];
 assert.deepEqual(stock,{lots:723,copies:817,available:817});
 await insert(c,'source_files',fileRows);await insert(c,'source_records',sourceRows);
 await insert(c,'canonical_captures',[capture]);await insert(c,'canonical_product_mappings',[...mappings.values()]);await insert(c,'canonical_observations',facts);
 assert.deepEqual((await c.query('SELECT count(*)::int lots,sum(owned_quantity)::int copies,sum(available_quantity)::int available FROM canonical_inventory')).rows[0],stock);
 const counts=(await c.query('SELECT count(*)::int observations,count(*) FILTER (WHERE evidence_kind=$2)::int indicative_bids,count(*) FILTER (WHERE metric=$3)::int retail_reference_points FROM canonical_observations WHERE capture_id=$1',[captureId,'bid','daily_retail_reference'])).rows[0];
 const receipt={status:process.argv.includes('--apply')?'applied':'trial_rolled_back',capture_id:captureId,source_date:info.price_meta.date,captured_at:capturedAt,source_hashes:info.source_hashes,matched_identifiers:coverage.matched_identifiers,source_records:sourceRows.length,mappings:mappings.size,...counts,inventory:stock,limits:'Card Kingdom series is indicative NM base, no wanted quantity or firm quote. TCGplayer series is retail reference, with unknown grade/method. Both date-only and not transaction volume.'};
 await c.query(process.argv.includes('--apply')?'COMMIT':'ROLLBACK');
 mkdirSync(join(root,'.local/market-ingestion'),{recursive:true});writeFileSync(join(root,'.local/market-ingestion/mtgjson-receipt.json'),JSON.stringify(receipt,null,2));
 console.log(JSON.stringify(receipt));
}catch(error){await c.query('ROLLBACK');throw error;}finally{await c.end();}
