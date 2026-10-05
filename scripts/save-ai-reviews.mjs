// Save model-written per-lot reviews as immutable analytical proposals, never owner choices.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {appClient} from './database.mjs';
const inputBytes=readFileSync('.local/analysis/full-input.json'),input=JSON.parse(inputBytes);
const partial=process.argv.includes('--soa');
const reviews=partial?JSON.parse(readFileSync('.local/analysis/analyst-soa.json','utf8')):[0,1,2].flatMap(i=>JSON.parse(readFileSync(`.local/analysis/analyst-${i}.json`,'utf8')));
const ids=new Set(input.cards.map(c=>c.lotId));
if(!partial)assert.equal(reviews.length,input.cards.length);
assert.equal(new Set(reviews.map(r=>r.lotId)).size,reviews.length);
if(partial){const soa=input.cards.filter(c=>c.setCode==='soa'&&c.printedLanguage==='ja'&&['80','116','72','124','126'].includes(c.collectorNumber));assert.deepEqual(reviews.map(r=>r.lotId).sort(),soa.map(c=>c.lotId).sort());}
for(const r of reviews){assert.ok(ids.has(r.lotId));for(const k of ['headline','commentary','nextStep'])assert.ok(typeof r[k]==='string'&&r[k].length>10&&r[k].length<6000,`${r.lotId} ${k}`);}
const hash=x=>createHash('sha256').update(x).digest('hex');
const combined=JSON.stringify(reviews),fingerprint=hash(Buffer.concat([inputBytes,Buffer.from(combined)]));
const id=`${fingerprint.slice(0,8)}-${fingerprint.slice(8,12)}-5${fingerprint.slice(13,16)}-a${fingerprint.slice(17,20)}-${fingerprint.slice(20,32)}`;
const manifest={asOf:input.asOf,input_sha256:hash(inputBytes),review_sha256:hash(combined),lot_count:reviews.length,copy_count:reviews.reduce((n,r)=>n+input.cards.find(c=>c.lotId===r.lotId).quantity,0),analysis_version:'collection-synthesis-v1',settings:{postage:135,tracked:550,materials:25,batch:1000,basis:'median'},review_origin:'Codex agents individually reviewed each lot; primary agent audited examples and collection coverage',detector_source_sha256:hash(readFileSync('src/lib/card-insights.ts'))};
const c=await appClient();
try{
 await c.query('BEGIN');
 const stock=(await c.query('SELECT lot_id,variant_id,condition_normalized,available_quantity FROM canonical_inventory ORDER BY lot_id')).rows;
 assert.equal(stock.length,input.cards.length);
 for(const lot of stock){const source=input.cards.find(x=>x.lotId===lot.lot_id);assert.ok(source);assert.equal(source.variantId,lot.variant_id);assert.equal(source.grade,lot.condition_normalized);assert.equal(source.quantity,lot.available_quantity);}
 const latest=(await c.query("SELECT max(captured_at) latest FROM canonical_captures WHERE use_state='eligible'")).rows[0].latest;
 assert.equal(new Date(latest).toISOString(),input.asOf,'Market capture changed; review new evidence before saving');
 const before=(await c.query('SELECT count(*)::int n FROM canonical_owner_choices')).rows[0];
 const previous=(await c.query('SELECT input_manifest FROM canonical_decision_runs WHERE id=$1',[id])).rows[0];
 if(previous)assert.deepEqual(previous.input_manifest,manifest);
 else await c.query("INSERT INTO canonical_decision_runs(id,input_manifest,code_version,model_id,prompt_version) VALUES($1,$2,$3,'codex-session-model-assisted-review','collection-ai-review-v1')",[id,manifest,manifest.detector_source_sha256]);
 for(const r of reviews){
  const card=input.cards.find(x=>x.lotId===r.lotId),proposal={...r,status:'analyst_insight_not_owner_decision',input_snapshot:card};
  const old=(await c.query('SELECT proposal FROM canonical_decisions WHERE run_id=$1 AND lot_id=$2',[id,r.lotId])).rows;
  assert.ok(old.length<=1);
  if(old.length)assert.deepEqual(old[0].proposal,proposal);
  else await c.query('INSERT INTO canonical_decisions(run_id,lot_id,quantity,proposal) VALUES($1,$2,$3,$4)',[id,r.lotId,card.quantity,proposal]);
 }
 assert.deepEqual((await c.query('SELECT lot_id,variant_id,condition_normalized,available_quantity FROM canonical_inventory ORDER BY lot_id')).rows,stock);
 assert.deepEqual((await c.query('SELECT count(*)::int n FROM canonical_owner_choices')).rows[0],before);
 assert.equal((await c.query('SELECT count(*)::int n FROM canonical_decisions WHERE run_id=$1',[id])).rows[0].n,reviews.length);
 await c.query(process.argv.includes('--apply')?'COMMIT':'ROLLBACK');
 const receipt={status:process.argv.includes('--apply')?'applied':'trial_rolled_back',run_id:id,...manifest};
 writeFileSync('.local/analysis/review-receipt.json',JSON.stringify(receipt,null,2));
 console.log(JSON.stringify(receipt));
} catch(e){await c.query('ROLLBACK');throw e;}finally{await c.end();}
