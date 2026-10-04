// Independent read-only reconstruction of the saved first buylist tranche.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {appClient,root} from './database.mjs';
import {manaPoolOrder} from './order-economics.mjs';

const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const cents=value=>Math.round(Number(value)*100);
const median=values=>{const sorted=values.toSorted((a,b)=>a-b);return sorted.length%2?sorted[(sorted.length-1)/2]:(sorted[sorted.length/2-1]+sorted[sorted.length/2])/2;};
const sameSet=(a,b)=>assert.deepEqual([...new Set(a)].sort(),[...new Set(b)].sort());
const c=await appClient();
try{
 await c.query('BEGIN READ ONLY');
 const runs=(await c.query("SELECT * FROM canonical_decision_runs WHERE prompt_version='human-requested-just-sell-first-pass-v1' ORDER BY created_at DESC")).rows;
 assert.equal(runs.length,1,'Expected one saved reviewed first-pass run');
 const run=runs[0],manifest=run.input_manifest,asOf=Date.parse(manifest.report_as_of);
 assert.ok(Number.isFinite(asOf));
 const reportPath=resolve(root,manifest.private_report_path);
 assert.ok(reportPath.startsWith(resolve(root,'data/private/decisions')+'\\'));
 const bytes=readFileSync(reportPath),report=JSON.parse(bytes);
 assert.equal(sha(bytes),manifest.report_sha256);
 assert.equal(report.as_of,manifest.report_as_of);
 assert.equal(report.live_source_sha256,manifest.live_source_sha256);
 assert.equal(sha(readFileSync(join(root,'data/private/market/2026-10-04/ck-buylist-checks.json'))),manifest.live_source_sha256);
 assert.equal(report.coverage.lots,723);assert.equal(report.coverage.copies,817);
 const t=report.thresholds;
 assert.equal(t.minimum_bid_cents,100);assert.equal(t.priority_bid_cents,500);
 assert.equal(t.max_marginal_retail_gain_cents,200);assert.equal(t.max_total_lot_retail_gain_cents,500);
 assert.equal(t.bid_max_age_days,14);assert.equal(t.minimum_single_copy_sale_samples_120d,3);
 assert.equal(t.status,'proposed_for_triage_not_owner_accepted');
 const policy=(await c.query('SELECT * FROM canonical_policies WHERE id=$1',[manifest.policy_id])).rows[0];
 assert.ok(policy);assert.equal(policy.kind,'buylist_first_pass_review');assert.equal(policy.version,'1');
 assert.equal(policy.status,'proposed');assert.equal(policy.source_refs.report_sha256,manifest.report_sha256);
 for(const key of Object.keys(t))assert.deepEqual(policy.rules[key],t[key],`Policy ${key} differs`);
 const stock=(await c.query('SELECT count(*)::int lots,sum(owned_quantity)::int owned,sum(available_quantity)::int available FROM canonical_inventory')).rows[0];
 assert.deepEqual(stock,{lots:723,owned:817,available:817});assert.deepEqual(stock,manifest.stock);
 const decisions=(await c.query('SELECT * FROM canonical_decisions WHERE run_id=$1 ORDER BY lot_id',[run.id])).rows;
 assert.equal(decisions.length,20);assert.equal(manifest.reviewed_lots,20);
 assert.equal(decisions.reduce((sum,d)=>sum+d.quantity,0),29);assert.equal(manifest.reviewed_copies,29);
 assert.equal(decisions.reduce((sum,d)=>sum+d.proposal.gross_cents,0),18100);assert.equal(manifest.reviewed_gross_cents,18100);
 const selected=report.lots.filter(r=>['priority_buylist_research','batch_addon_research'].includes(r.classification)&&r.bid.live?.status==='listed');
 assert.equal(selected.length,20);sameSet(selected.map(r=>r.lot_id),decisions.map(d=>d.lot_id));
 const reportByLot=new Map(selected.map(r=>[r.lot_id,r]));
 const capacityUsed=new Map();let checkedSamples=0;
 for(const d of decisions){
  const p=d.proposal,r=reportByLot.get(d.lot_id),s=p.source_snapshot;
  assert.deepEqual(s,r,'Saved proposal snapshot differs from pinned report');
  assert.equal(p.disposition,'JUST_SELL_TO_BUYLIST');assert.equal(p.status,'analyst_recommendation_pending_owner_execution');
  assert.equal(p.policy_id,manifest.policy_id);assert.equal(p.quantity,d.quantity);
  const lot=(await c.query('SELECT * FROM canonical_inventory WHERE lot_id=$1',[d.lot_id])).rows[0];
  assert.ok(lot);assert.equal(lot.variant_id,r.variant_id);assert.equal(lot.available_quantity,r.available_quantity);
  assert.equal(lot.condition_normalized,r.condition);assert.equal(lot.name,r.name);
  assert.equal(lot.set_code,r.set_code);assert.equal(lot.collector_number,r.collector_number);
  assert.equal(lot.finish,r.finish);assert.equal(lot.printed_language,r.printed_language);
  const live=(await c.query(`SELECT e.id,e.metric,e.numeric_value,e.quantity,e.capture_id,m.product_id,m.variant_id
    FROM canonical_eligible_evidence e JOIN canonical_product_mappings m ON m.id=e.mapping_id
    WHERE e.capture_id=$1 AND m.provider='Card Kingdom/public_buylist' AND m.variant_id=$2
      AND m.product_id=$3 AND e.metric IN ('public_cash_buylist_indication','public_max_wanted_quantity')`,
   [manifest.live_capture_id,lot.variant_id,r.bid.live.source_product_id])).rows;
  assert.equal(live.length,2);const bid=live.find(x=>x.metric==='public_cash_buylist_indication'),cap=live.find(x=>x.metric==='public_max_wanted_quantity');
  assert.ok(bid&&cap);assert.equal(cents(bid.numeric_value),r.bid.selected_cash_cents);
  assert.equal(Number(cap.numeric_value),r.bid.live.capacity);assert.equal(cap.quantity,r.bid.live.capacity);
  assert.ok(r.bid.live.capacity>0);assert.ok(r.available_quantity<=r.bid.live.capacity);
  const used=(capacityUsed.get(bid.product_id)||0)+r.available_quantity;assert.ok(used<=Number(cap.numeric_value));capacityUsed.set(bid.product_id,used);
  assert.equal(p.per_copy_cash_cents,cents(bid.numeric_value));assert.equal(p.gross_cents,p.per_copy_cash_cents*d.quantity);
  assert.equal(p.gross_cents,r.bid.selected_lot_gross_cents);
  const bidAge=(asOf-Date.parse(r.bid.selected_date))/86400000;
  assert.ok(bidAge>=-1&&bidAge<=t.bid_max_age_days);
  // Exact lot + owner grade via the curated view; this blocks a foreign product's ask or samples.
  const ask=(await c.query(`SELECT id,numeric_value,market_product_id,captured_at FROM canonical_lot_market_evidence
     WHERE lot_id=$1 AND id=$2 AND metric='lowest_asking_price' AND condition_scope=$3`,
    [d.lot_id,r.retail.manapool_observation_id,lot.condition_normalized])).rows;
  assert.equal(ask.length,1);assert.equal(cents(ask[0].numeric_value),r.retail.manapool_ask_cents);
  assert.equal(ask[0].market_product_id,r.retail.manapool_product_id);
  const tcg=(await c.query(`SELECT e.id,e.numeric_value FROM canonical_eligible_evidence e
    JOIN canonical_product_mappings m ON m.id=e.mapping_id
    WHERE e.id=$1 AND m.variant_id=$2 AND m.provider='MTGJSON/tcgplayer'
      AND e.metric='daily_retail_reference'`,[r.retail.tcg_observation_id,lot.variant_id])).rows;
  assert.equal(tcg.length,1);assert.equal(cents(tcg[0].numeric_value),r.retail.tcg_reference_cents);
  const allSales=(await c.query(`SELECT id,numeric_value,quantity,observed_at FROM canonical_lot_market_evidence
    WHERE lot_id=$1 AND metric='reported_sale_price' AND condition_scope=$2`,[d.lot_id,lot.condition_normalized])).rows;
  const samples=allSales.filter(x=>x.quantity===1&&Number.isFinite(Date.parse(x.observed_at))
   &&(asOf-Date.parse(x.observed_at))/86400000>=0&&(asOf-Date.parse(x.observed_at))/86400000<=120);
  sameSet(samples.map(x=>x.id),r.retail.sample_observation_ids);
  assert.ok(samples.length>=t.minimum_single_copy_sale_samples_120d);
  assert.equal(samples.length,r.retail.single_copy_samples_120d);checkedSamples+=samples.length;
  assert.equal(Math.round(median(samples.map(x=>cents(x.numeric_value)))),r.retail.sample_median_cents);
  const price=Math.max(r.retail.manapool_ask_cents,r.retail.tcg_reference_cents,r.retail.sample_median_cents);
  assert.equal(price,r.retail.optimistic_price_cents);
  const shipping=price<6000?135:0;assert.equal(shipping,r.retail.shipping_credit_cents);
  const econ=manaPoolOrder({items:[{unitPriceCents:price,quantity:1}],shippingCreditCents:shipping,
   postageCents:0,materialsCents:0,lossReserveCents:0});
  assert.deepEqual(econ,r.retail.optimistic_order_economics);
  const gain=econ.netCents-cents(bid.numeric_value);
  assert.equal(gain,r.retail.estimated_marginal_gain_cents);
  assert.equal(gain*d.quantity,r.retail.estimated_total_lot_gain_cents);
  assert.ok(gain<=t.max_marginal_retail_gain_cents&&gain*d.quantity<=t.max_total_lot_retail_gain_cents);
  assert.ok(cents(bid.numeric_value)>=t.minimum_bid_cents);
  assert.equal(r.classification,cents(bid.numeric_value)>=t.priority_bid_cents?'priority_buylist_research':'batch_addon_research');
  assert.ok(p.evidence_ids.includes(bid.id)&&p.evidence_ids.includes(cap.id));
  assert.ok(p.evidence_ids.includes(ask[0].id)&&p.evidence_ids.includes(tcg[0].id));
  for(const sample of samples)assert.ok(p.evidence_ids.includes(sample.id));
 }
 // These proposals have not been promoted to owner choice, quote, transaction or stock movement.
 assert.equal((await c.query('SELECT count(*)::int n FROM canonical_owner_choices WHERE lot_id=ANY($1)',[decisions.map(d=>d.lot_id)])).rows[0].n,0);
 assert.equal((await c.query('SELECT count(*)::int n FROM canonical_transactions')).rows[0].n,0);
 assert.equal((await c.query('SELECT count(*)::int n FROM canonical_quotes')).rows[0].n,0);
 console.log(JSON.stringify({status:'verified',run_id:run.id,lots:decisions.length,copies:29,gross_cents:18100,sale_samples_checked:checkedSamples,shared_products:capacityUsed.size,inventory:stock}));
}finally{await c.query('ROLLBACK');await c.end();}
