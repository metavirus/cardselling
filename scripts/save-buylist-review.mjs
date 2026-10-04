// Store the reviewed first tranche as proposals, never owner choices or stock actions.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync,mkdirSync,writeFileSync,existsSync} from 'node:fs';
import {join} from 'node:path';
import {appClient,root} from './database.mjs';
const hash=x=>createHash('sha256').update(x).digest('hex');
const uuid=x=>{const h=hash(x);return `${h.slice(0,8)}-${h.slice(8,12)}-5${h.slice(13,16)}-a${h.slice(17,20)}-${h.slice(20,32)}`;};
const bytes=readFileSync(join(root,'../outputs/buylist-first-pass/buylist-first-pass.json'));
const report=JSON.parse(bytes),reportHash=hash(bytes);
const checked=report.lots.filter(r=>['priority_buylist_research','batch_addon_research'].includes(r.classification)&&r.bid.live?.status==='listed');
assert.equal(checked.length,20);assert.equal(checked.reduce((n,r)=>n+r.available_quantity,0),29);
assert.equal(checked.reduce((n,r)=>n+r.available_quantity*r.bid.selected_cash_cents,0),18100);
const sourceBytes=readFileSync(join(root,'data/private/market/2026-10-04/ck-buylist-checks.json'));
assert.equal(hash(sourceBytes),report.live_source_sha256);
const policyId=uuid('buylist-first-pass-reviewed:v1');
const runId=uuid(`buylist-first-pass-reviewed:${reportHash}`);
const codeHash=hash(Buffer.concat(['buylist-first-pass.mjs','order-economics.mjs','save-buylist-review.mjs'].map(f=>readFileSync(join(root,'scripts',f)))));
const median=a=>{const s=a.toSorted((x,y)=>x-y);return s.length?(s[Math.floor((s.length-1)/2)]+s[Math.ceil((s.length-1)/2)])/2:null;};
const specific={
 'pf25/1F/foil':'Six copies can leave in one dealer shipment; the public capacity covers all six. Repeated retail fulfillment offers little additional cash at current comparison prices.',
 'blb/308/foil':'The $19 bid is close to the $20.11 reference and above the sampled sale median. The collectible foil treatment is already reflected in exact-product comparisons; it is not a reason by itself to hold.',
 'clb/627/normal':'The live $16 bid improved on the earlier $14.50 indication and leaves almost no modeled retail advantage.',
 'lcc/30/normal':'The live $8 bid improved on the earlier $7.50 indication. Recent reference appreciation is already reflected in a dealer bid above the current reference price.',
 'mh3/384/normal':'The recent reference rose modestly, which is the main argument for patience. That movement alone is not a forward catalyst; current absolute upside from self-sale remains small.',
 'iko/350/normal':'Only four recent single-copy samples support the comparison. Confidence is moderate; the current asking price and retail reference also keep the incremental dollars small.',
 'sld/2491/foil':'This exact Secret Lair foil has only five recent single-copy samples. A collector could pay more, but the available comparisons do not justify a separate listing for the small spread.',
 'sld/2498/foil':'Exact Secret Lair foil comparisons still leave less than $2 per copy before postage and materials. Retaining a collector premium is the counterargument, not an established appreciation thesis.'
};
const c=await appClient();
async function immutable(table,row){
 const keys=Object.keys(row),cols=keys.map(k=>`"${k}"`).join(',');
 const input=`SELECT ${cols} FROM jsonb_populate_record(NULL::${table},$1::jsonb)`;
 await c.query(`INSERT INTO ${table}(${cols}) ${input} ON CONFLICT DO NOTHING`,[JSON.stringify(row)]);
 assert.equal((await c.query(`SELECT * FROM (${input} EXCEPT SELECT ${cols} FROM ${table} WHERE id=$2) d`,[JSON.stringify(row),row.id])).rowCount,0,`Immutable ${table} differs`);
}
try{
 await c.query('BEGIN');await c.query("SELECT pg_advisory_xact_lock(hashtext('buylist-first-pass-review'))");
 const stock=(await c.query('SELECT count(*)::int lots,sum(owned_quantity)::int owned,sum(available_quantity)::int available FROM canonical_inventory')).rows[0];
 assert.deepEqual(stock,{lots:723,owned:817,available:817});
 const captures=(await c.query('SELECT id FROM canonical_captures WHERE content_hash=$1 AND provider=$2',[report.live_source_sha256,'Card Kingdom'])).rows;
 assert.equal(captures.length,1);const captureId=captures[0].id;
 const rules={...report.thresholds,review_status:'analyst_proposed',scenario:report.scenario,owner_objective:'Worthwhile cash with low active effort; no immediate cash need; hold only for an evidence-backed thesis',execution:'Combined dealer batch subject to current checkout quantities, grade and actual shipment cost; no sale authorization'};
 await immutable('canonical_policies',{id:policyId,kind:'buylist_first_pass_review',version:'1',status:'proposed',rules,source_refs:{report_sha256:reportHash,fee_policy:'https://support.manapool.com/hc/en-us/articles/21779686206615-Fees-Mana-Pool-and-Credit-Card-Fees',dealer_policy:'https://www.cardkingdom.com/purchasing/how_to_sell'}});
 const manifest={report_sha256:reportHash,report_as_of:report.as_of,policy_id:policyId,live_source_sha256:report.live_source_sha256,live_capture_id:captureId,stock,screened_lots:723,reviewed_lots:20,reviewed_copies:29,reviewed_gross_cents:18100,limitations:report.evidence_semantics,private_report_path:`data/private/decisions/${reportHash}.json`};
 await immutable('canonical_decision_runs',{id:runId,input_manifest:manifest,code_version:`sha256:${codeHash}`,model_id:null,prompt_version:'human-requested-just-sell-first-pass-v1'});
 const capacityUsed=new Map();
 for(const r of checked){
  const lot=(await c.query('SELECT * FROM canonical_inventory WHERE lot_id=$1',[r.lot_id])).rows[0];
  assert.equal(lot.variant_id,r.variant_id);assert.equal(lot.available_quantity,r.available_quantity);
  assert.equal(lot.condition_normalized,r.condition);
  const liveObs=(await c.query(`SELECT o.id,o.metric,o.numeric_value,m.product_id FROM canonical_eligible_evidence o JOIN canonical_product_mappings m ON m.id=o.mapping_id WHERE o.capture_id=$1 AND m.variant_id=$2`,[captureId,r.variant_id])).rows;
  const bid=liveObs.find(o=>o.metric==='public_cash_buylist_indication'),cap=liveObs.find(o=>o.metric==='public_max_wanted_quantity');
  assert.ok(bid&&cap);assert.equal(Math.round(Number(bid.numeric_value)*100),r.bid.selected_cash_cents);
  const allocated=(capacityUsed.get(bid.product_id)||0)+r.available_quantity;capacityUsed.set(bid.product_id,allocated);assert.ok(allocated<=Number(cap.numeric_value));
  const evidenceIds=[bid.id,cap.id,r.retail.manapool_observation_id,r.retail.tcg_observation_id,...r.retail.sample_observation_ids];
  const trends=(await c.query(`SELECT o.id,o.numeric_value,o.window_start,
    o.window_start >= $2::date-interval '7 days' AS recent
    FROM canonical_eligible_evidence o JOIN canonical_product_mappings m ON m.id=o.mapping_id
    WHERE m.variant_id=$1 AND m.provider='MTGJSON/tcgplayer' AND o.metric='daily_retail_reference'
    AND (o.window_start >= $2::date-interval '7 days' OR
      (o.window_start >= $2::date-interval '37 days' AND o.window_start < $2::date-interval '29 days'))
    AND o.window_start <= $2::date`,[r.variant_id,report.as_of.slice(0,10)])).rows;
  evidenceIds.push(...trends.map(t=>t.id));
  assert.equal((await c.query('SELECT count(*)::int n FROM canonical_eligible_evidence WHERE id=ANY($1)',[[...new Set(evidenceIds)]])).rows[0].n,new Set(evidenceIds).size);
  const proposal={disposition:'JUST_SELL_TO_BUYLIST',status:'analyst_recommendation_pending_owner_execution',channel:'mailed_buylist',dealer:'Card Kingdom',cash_kind:'public_indicative_nm_cash',quantity:r.available_quantity,per_copy_cash_cents:r.bid.selected_cash_cents,gross_cents:r.bid.selected_cash_cents*r.available_quantity,
   rationale:specific[`${r.set_code}/${r.collector_number}/${r.finish}`]||'The current dealer bid leaves at most $2 per copy and $5 across this lot versus a deliberately favorable retail scenario before postage, materials and active work. Include in a combined shipment.',
   counterargument:'Patient retail or a future demand catalyst could pay more; the finite sampled prices and current reference values do not bound future value. A substantially higher competing dealer or event bid could improve proceeds.',
   uncertainty:'Moderate recommendation confidence; exact current public product and capacity checked, but no checkout quote or final dealer grading. Sale sample completeness and reported price basis remain limited.',
   next_action:'Combine with the rest of this tranche; recheck exact cash prices and quantities at checkout, calculate actual batch costs, and submit only when the owner chooses to sell.',
   review_trigger:'Recompute if bid changes, capacity falls, another credible comparable materially exceeds the scenario price, or a specific demand/supply catalyst appears.',
   evidence_ids:[...new Set(evidenceIds)],policy_id:policyId,source_snapshot:r,
   trend_context:{recent_week_median:median(trends.filter(t=>t.recent).map(t=>Number(t.numeric_value))),around_30_days_ago_median:median(trends.filter(t=>!t.recent).map(t=>Number(t.numeric_value))),meaning:'Reference-price context only; neither a forecast nor proof of a hold catalyst.'}};
  await immutable('canonical_decisions',{id:uuid(`${runId}:${r.lot_id}`),run_id:runId,lot_id:r.lot_id,quantity:r.available_quantity,proposal});
 }
 assert.equal((await c.query('SELECT count(*)::int n FROM canonical_decisions WHERE run_id=$1',[runId])).rows[0].n,20);
 assert.deepEqual((await c.query('SELECT count(*)::int lots,sum(owned_quantity)::int owned,sum(available_quantity)::int available FROM canonical_inventory')).rows[0],stock);
 if(process.argv.includes('--apply')){
  const path=join(root,manifest.private_report_path);mkdirSync(join(root,'data/private/decisions'),{recursive:true});
  if(existsSync(path))assert.equal(hash(readFileSync(path)),reportHash);else writeFileSync(path,bytes,{flag:'wx'});
  await c.query('COMMIT');
 }else await c.query('ROLLBACK');
 console.log(JSON.stringify({status:process.argv.includes('--apply')?'applied':'trial_rolled_back',run_id:runId,decisions:20,copies:29,gross_cents:18100,inventory_unchanged:true}));
}catch(e){await c.query('ROLLBACK');throw e;}finally{await c.end();}
