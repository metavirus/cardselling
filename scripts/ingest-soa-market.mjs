// Narrow verified Japanese-only SOA interpretation; default transaction rolls back.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {join} from 'node:path';
import {parse} from 'csv-parse/sync';
import {appClient,root} from './database.mjs';
import {exactLots,normalizeDays} from './mtgjson-extra-history.mjs';
const dir=join(root,'data/private/market/2026-10-04');
const sha=x=>createHash('sha256').update(x).digest('hex');
const uuid=x=>{const h=sha(x);return `${h.slice(0,8)}-${h.slice(8,12)}-5${h.slice(13,16)}-a${h.slice(17,20)}-${h.slice(20,32)}`;};
const json=n=>JSON.parse(readFileSync(join(dir,n),'utf8'));
const jsonl=n=>readFileSync(join(dir,n),'utf8').trim().split('\n').map(JSON.parse);
const proof=new Map([['80',['Daze','325881','688905']],['116',['Crop Rotation','325887','688888']],['72',['Prismatic Ending','325842','688911']],['124',['Triumph of the Hordes','325934','689365']],['126',['Bring to Light','325961','689384']]]);
const info=json('mtgjson-extraction.json');
for(const [name,h]of Object.entries({...info.source_hashes,...info.extract_hashes}))assert.equal(sha(readFileSync(join(dir,name))),h,`Source hash changed ${name}`);
const identities=jsonl('mtgjson-identifiers.jsonl').filter(x=>x.raw.setCode==='SOA'&&proof.has(x.raw.number));
assert.equal(identities.length,5);
const prices=new Map(jsonl('mtgjson-prices.jsonl').map(x=>[x.uuid,x]));
const manifest=json('tcgsentry-collection-2026-10-04-1933.manifest.json');
const csvBytes=readFileSync(join(root,manifest.file));assert.equal(sha(csvBytes),manifest.sha256);
const csv=parse(csvBytes,{columns:true,bom:true,skip_empty_lines:true});assert.equal(csv.length,manifest.expected_rows);
const c=await appClient(),apply=process.argv.includes('--apply');
const allowed=new Set(['canonical_captures','canonical_product_mappings','canonical_observations']);
async function insert(table,items){assert.ok(allowed.has(table));for(let i=0;i<items.length;i+=200){const batch=items.slice(i,i+200),keys=Object.keys(batch[0]),cols=keys.map(k=>`"${k}"`).join(','),payload=JSON.stringify(batch),q=`SELECT ${cols} FROM jsonb_populate_recordset(NULL::${table},$1::jsonb)`;await c.query(`INSERT INTO ${table}(${cols}) ${q} ON CONFLICT DO NOTHING`,[payload]);assert.equal((await c.query(`SELECT * FROM (${q} EXCEPT SELECT ${cols} FROM ${table} WHERE id=ANY($2)) d LIMIT 1`,[payload,batch.map(x=>x.id)])).rowCount,0,`Immutable replay ${table}`);}}
try{
 await c.query('BEGIN');await c.query("SELECT pg_advisory_xact_lock(hashtext('soa-verified-market-v1'))");
 const protectedSql=`SELECT (SELECT md5(string_agg(row_to_json(i)::text,'|' ORDER BY lot_id)) FROM canonical_inventory i) stock,(SELECT md5(string_agg(row_to_json(d)::text,'|' ORDER BY id)) FROM canonical_decisions d) decisions`;
 const before=(await c.query(protectedSql)).rows[0];
 const lots=(await c.query("SELECT i.*,m.product_id source_scryfall_id FROM canonical_inventory i JOIN canonical_product_mappings m ON m.variant_id=i.variant_id AND m.provider='Scryfall' AND m.status='accepted' AND NOT EXISTS(SELECT 1 FROM canonical_product_mappings n WHERE n.supersedes_id=m.id)")).rows;
 const original=(await c.query("SELECT captured_at FROM canonical_captures WHERE provider='MTGJSON' AND source_file_id=$1 ORDER BY captured_at LIMIT 1",[info.source_hashes['AllPrices.json.gz']])).rows[0];assert.ok(original);
 const capture=(provider,file,time,kind)=>({id:uuid(`soa-verified-market-v1:${provider}:${file}:${time}`),provider,upstream_provider:'Card Kingdom',source_file_id:file,source_url:provider==='MTGJSON/SOA-verified-history'?'https://mtgjson.com/api/v5/AllPrices.json.gz':'https://tcgsentry.com/collection',content_hash:file,captured_at:time,source_observed_at:null,source_time_text:'Original archived capture; upstream date retained on each fact',use_state:'eligible',sample_kind:kind,sample_limit:null,completeness:'unknown',metadata:{parser_version:'soa-verified-market-v1',verified_japanese_only_product_policy:true,inventory_authority:false,identity_file_id:info.source_hashes['AllIdentifiers.json.gz'],proof:'Exact SOA Japanese Scryfall/set/number/nonfoil + verified native CK and TCG product allowlist; source export language label is not used to overwrite owner language'}});
 const history=capture('MTGJSON/SOA-verified-history',info.source_hashes['AllPrices.json.gz'],original.captured_at.toISOString(),'daily_exact_japanese_treatment_history');
 const dealer=capture('TCGSentry/SOA-verified',manifest.sha256,manifest.captured_at,'dated_exact_japanese_treatment_export');
 const mappings=[],facts=[],seen=new Map();let lotCount=0;
 const mapping=(cap,lot,provider,subject,record,scope)=>{const id=uuid(`${cap.id}:${provider}:${lot.variant_id}:${subject}`);mappings.push({id,variant_id:lot.variant_id,provider,product_id:subject,condition_scope:scope,finish_scope:'normal',language_scope:'ja',status:'accepted',basis:'Verified Japanese-only SOA treatment: exact accepted Scryfall/set/collector/nonfoil and native CK/TCG IDs. Export Language=en is source metadata error; owner identity remains ja. Original rejected interpretation retained.',source_record_id:record,capture_id:cap.id});return id;};
 const fact=(cap,map,subject,locator,metric,kind,value,currency,start,end,quantity,raw,basis)=>({id:uuid(`${cap.id}:${locator}`),capture_id:cap.id,mapping_id:map,provider_subject:subject,source_locator:locator,metric,evidence_kind:kind,numeric_value:value,text_value:null,currency,unit:currency?'usd_per_copy':'copies_wanted_at_export',price_basis:basis,observed_at:null,window_start:start,window_end:end,quantity,sample_count:null,limitations:'Indicative source-reported market evidence. Grade acceptance and executable dealer quote are not established.',raw});
 for(const ident of identities){
  const r=ident.raw,[name,ck,tcg]=proof.get(r.number);assert.equal(r.name,name);assert.equal(r.language,'Japanese');assert.equal(r.identifiers.cardKingdomId,ck);assert.equal(r.identifiers.tcgplayerProductId,tcg);assert.ok(r.finishes.includes('nonfoil'));
  const matched=exactLots(r,lots).filter(l=>l.finish==='normal'&&l.condition_normalized==='near_mint');assert.ok(matched.length);lotCount+=matched.length;
  const pr=prices.get(ident.uuid);assert.ok(pr);const idRecord=`${info.source_hashes['AllIdentifiers.json.gz']}:${ident.record_number}`,priceRecord=`${info.source_hashes['AllPrices.json.gz']}:${pr.record_number}`;
  for(const [record,raw]of [[idRecord,r],[priceRecord,pr.raw]])assert.deepEqual((await c.query('SELECT raw FROM source_records WHERE id=$1',[record])).rows[0]?.raw,raw);
  for(const side of ['buylist','retail']){const data=pr.raw.paper.cardkingdom;assert.equal(data.currency,'USD');const days=normalizeDays(data[side]?.normal||{},'USD','USD',info.price_meta.date),subject=`${ck}/normal/${side}`;const mapIds=matched.map(l=>mapping(history,l,'MTGJSON/cardkingdom',subject,idRecord,side==='buylist'?'near_mint':'not_applicable'));
   for(const p of days){if(p.value==='0.00')continue;const locator=`cardkingdom/${subject}/${p.date}`;if(seen.has(locator)){assert.equal(seen.get(locator),p.value);continue;}seen.set(locator,p.value);facts.push(fact(history,mapIds[0],subject,locator,side==='buylist'?'indicated_nm_buylist':'daily_retail_reference',side==='buylist'?'bid':'source_signal',p.value,'USD',p.start,p.end,null,{date:p.date,source_record_id:priceRecord,mtgjson_uuid:ident.uuid,native_id:ck,identity_language:'Japanese',finish:'normal',side,upstream:'cardkingdom'},side==='buylist'?'source_reported_indicative_cash':'unspecified_retail_reference'));}
  }
  const candidates=csv.map((raw,i)=>({raw,index:i+1})).filter(x=>x.raw['Scryfall ID']===r.identifiers.scryfallId);assert.equal(candidates.length,1);const {raw:row,index}=candidates[0];assert.equal(row['Set code'],'soa');assert.equal(row.Number,r.number);assert.equal(row.Name,name);assert.equal(row.Finish,'normal');assert.equal(row.Condition,'NM');assert.equal(row['TCGplayer product ID'],tcg);assert.ok(['en','ja'].includes(row.Language));assert.equal(row['Star City Games price'],'');
  const record=`${manifest.sha256}:${index}`;assert.deepEqual((await c.query('SELECT raw FROM source_records WHERE id=$1',[record])).rows[0]?.raw,row);
  const subject=`${ck}/normal`,maps=matched.map(l=>mapping(dealer,l,'TCGSentry/Card Kingdom',subject,record,'near_mint'));
  assert.match(row['CardKingdom price'],/^\d+(?:\.\d{1,2})?$/);const qty=Number(row['CardKingdom qty']);assert.ok(Number.isSafeInteger(qty)&&qty>=0);
  facts.push(fact(dealer,maps[0],subject,`${index}/ck-price`,'exported_ck_cash_buylist_indication','bid',Number(row['CardKingdom price']).toFixed(2),'USD',null,null,null,{source_record_id:record,source_language:row.Language,accepted_language:'ja',native_ck_id:ck,tcgplayer_product_id:tcg,source_condition:'NM',source_quoted_quantity:qty},'source_reported_indicative_cash'));
  facts.push(fact(dealer,maps[0],subject,`${index}/ck-quantity`,'exported_ck_wanted_quantity','demand',qty,null,null,null,qty,{source_record_id:record,native_ck_id:ck,tcgplayer_product_id:tcg,source_quantity:row['CardKingdom qty']},'not_a_price'));
 }
 assert.equal(lotCount,8);assert.equal(new Set(mappings.map(m=>m.id)).size,mappings.length);
 const batches=[['canonical_captures',[history,dealer]],['canonical_product_mappings',mappings],['canonical_observations',facts]];for(const [table,items]of batches)await insert(table,items);for(const [table,items]of batches)await insert(table,items);
 assert.deepEqual((await c.query(protectedSql)).rows[0],before);
 for(const cap of [history,dealer])assert.equal((await c.query('SELECT count(*)::int n FROM canonical_observations WHERE capture_id=$1',[cap.id])).rows[0].n,facts.filter(f=>f.capture_id===cap.id).length);
 const receipt={status:apply?'applied':'trial_rolled_back',captures:[history.id,dealer.id],lots:lotCount,products:5,mappings:mappings.length,observations:facts.length,history_points:facts.filter(f=>f.capture_id===history.id).length,dealer_facts:10,replay:'verified',inventory_and_decisions:'unchanged',source_hashes:info.source_hashes,dealer_sha256:manifest.sha256};
 await c.query(apply?'COMMIT':'ROLLBACK');mkdirSync(join(root,'.local/market-ingestion'),{recursive:true});writeFileSync(join(root,`.local/market-ingestion/soa-${apply?'applied':'trial'}.json`),JSON.stringify(receipt,null,2));console.log(JSON.stringify(receipt));
}catch(e){await c.query('ROLLBACK');throw e;}finally{await c.end();}
