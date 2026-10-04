// Read-only analysis of the frozen October 4 baseline, not a general import pipeline.
// Source assertions are never promoted to accepted sale decisions.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import assert from 'node:assert/strict';
import { appClient, root } from './database.mjs';
import { csv, identity, variantKey, match, hash } from './import-domain.mjs';

const freshPath = resolve(root, process.argv[2] || 'data/private/reanalysis/2026-10-04/tcgsentry-collection-2026-10-04-1243.csv');
assert(freshPath.startsWith(resolve(root, 'data/private') + '\\'), 'Use private source directory');
const freshBytes = readFileSync(freshPath);
const fresh = csv(freshBytes.toString('utf8'));
const out = join(root, '.local/reanalysis');
mkdirSync(out, { recursive: true });
const number = x => {
  if (x === '' || x === null || x === undefined) return null;
  const value = Number(x);
  assert(Number.isFinite(value) && value >= 0, 'Expected finite nonnegative source number');
  return value;
};
const money = x => Math.round((x + Number.EPSILON) * 100) / 100;
const sum = (rows, fn) => money(rows.reduce((s, r) => s + (fn(r) ?? 0), 0));
const c = await appClient();
try {
  await c.query('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
  const holdings = (await c.query(`SELECT h.*,r.raw,b.raw->>'lang' AS reference_language
    FROM inventory_holdings h JOIN source_records r ON r.id=h.id
    JOIN inventory_snapshots snap ON snap.id=h.snapshot_id
    JOIN import_batches batch ON batch.inventory_snapshot_id=snap.id
    JOIN source_files sf ON sf.path LIKE '%default-cards-20260929210547.jsonl.gz'
    JOIN card_reference_snapshots b ON b.scryfall_id=h.scryfall_id AND b.source_file_id=sf.id`)).rows;
  const old = (await c.query("SELECT r.raw FROM source_records r JOIN source_files f ON f.id=r.source_file_id WHERE f.path LIKE '%tcgsentry-collection-2026-10-04-0956.csv'")).rows.map(r=>r.raw);
  const research = (await c.query("SELECT * FROM market_observations WHERE provider<>'TCGSentry export'")).rows;
  const judgments = (await c.query("SELECT p.*,r.raw FROM interpretation_checkpoints p JOIN source_records r ON r.id=p.id WHERE kind='imported_manual_judgment'")).rows;
  for (const row of [...old, ...fresh]) {
    assert(Number.isInteger(number(row.Quantity)) && number(row.Quantity) > 0, 'Positive integer inventory quantity required');
    const capacity = number(row['CardKingdom qty']);
    assert(capacity === null || Number.isInteger(capacity), 'Buying capacity must be integer or unknown');
  }
  assert.equal(holdings.length,723); assert.equal(sum(holdings,h=>h.quantity),817);
  assert.equal(fresh.length,718); assert.equal(sum(fresh,r=>number(r.Quantity)),815);
  const unique = rows => new Map(rows.map(r=>[variantKey(identity(r)),r]));
  const oldMap=unique(old), newMap=unique(fresh);
  assert.equal(oldMap.size,old.length);assert.equal(newMap.size,fresh.length);
  assert.deepEqual([...oldMap.keys()].sort(),[...newMap.keys()].sort());
  for(const [key,row] of newMap)assert.equal(row.Quantity,oldMap.get(key).Quantity);
  const changeFields=['CardKingdom price','CardKingdom qty','Star City Games price','ManaPool estimated net','Sell signal'];
  const changes=fresh.flatMap(r=>changeFields.filter(field=>r[field]!==oldMap.get(variantKey(identity(r)))[field]).map(field=>({name:r.Name,set:r['Set code'],collector:r.Number,finish:r.Finish,language:r.Language,field,old:oldMap.get(variantKey(identity(r)))[field],fresh:r[field]})));
  const findings=holdings.map(h=>{
    const dealer=fresh.filter(r=>match(r,[h]).status==='exact'); assert(dealer.length<=1);
    const d=dealer[0];const ck=number(d?.['CardKingdom price']),capacity=number(d?.['CardKingdom qty']),scg=number(d?.['Star City Games price']),mp=number(d?.['ManaPool estimated net']);
    const gates=[];
    if(h.language!=='en')gates.push('physical_language_acceptance');
    if(h.reference_language!==h.language)gates.push('catalog_vs_scan_language');
    if(h.condition!=='near_mint')gates.push('condition_assessment');
    if(!d)gates.push('no_exact_dealer_identity');
    const eligible=gates.length===0;
    const ckCopies=eligible&&capacity!==null&&ck!==null?Math.min(h.quantity,capacity):null;
    const gap=ckCopies>0&&mp!==null?money(mp-ck):null;
    const evidence=research.filter(r=>r.holding_id===h.id);
    const priorJudgment=judgments.find(r=>r.holding_id===h.id);
    let task;
    if(gates.some(g=>g!=='no_exact_dealer_identity'))task='resolve_identity_or_condition';
    else if(!d)task='obtain_exact_quote';
    else if(!ckCopies)task='verify_alternative_dealer_or_wait_for_capacity';
    else if(mp===null)task='obtain_retail_comparator';
    else if(gap<=0)task='buylist_candidate_before_timing_review';
    else if(gap<=3)task='small_spread_batch_comparison';
    else task='retail_spread_worth_investigating';
    return {holding_id:h.id,name:h.name,set:h.set_code,collector:h.collector_number,finish:h.finish,language:h.language,reference_language:h.reference_language,condition:h.condition,quantity:h.quantity,gates,analysis_task:task,
      ck_quoted_per_card:ck,ck_indicated_capacity:capacity,ck_candidate_copies:ckCopies,scg_quoted_per_card:scg,scg_capacity:null,mp_percentage_fee_only_estimate:mp,
      mp_minus_ck_per_card:gap,mp_minus_ck_extended:gap===null?null:money(gap*ckCopies),research_observation_ids:evidence.map(r=>r.id),
      prior_timing_claim:priorJudgment?.timing_signal??null,hold_thesis_accepted:false,execution_ready:false,
      provenance:{inventory_source_record:h.id,dealer_snapshot_sha256:hash(freshBytes),dealer_row:d?fresh.indexOf(d)+1:null}};
  });
  const grouped={};for(const r of findings){grouped[r.analysis_task]??={rows:0,copies:0};grouped[r.analysis_task].rows++;grouped[r.analysis_task].copies+=r.quantity;}
  const compared=findings.filter(r=>r.mp_minus_ck_extended!==null);
  const positive=compared.filter(r=>r.mp_minus_ck_extended>0).sort((a,b)=>b.mp_minus_ck_extended-a.mp_minus_ck_extended);
  const dealerStats=rows=>({rows:rows.length,copies:sum(rows,r=>number(r.Quantity)),quoted_max:sum(rows,r=>Math.max(number(r['CardKingdom price'])??0,number(r['Star City Games price'])??0)*number(r.Quantity)),modeled_mp:sum(rows,r=>(number(r['ManaPool estimated net'])??0)*number(r.Quantity)),sell_rows:rows.filter(r=>r['Sell signal']==='SELL').length});
  const sensitivity=[];
  for(const hourly of [15,30,60])for(const incrementalMinutes of [5,10,20]){
    const cutoff=hourly*incrementalMinutes/60;
    const rows=compared.filter(r=>r.mp_minus_ck_extended>cutoff);
    sensitivity.push({hourly_effort_value:hourly,incremental_minutes_per_holding:incrementalMinutes,required_incremental_dollars:money(cutoff),rows_above_threshold:rows.length,
      note:'Illustrative effort-only screen. Excludes postage, fixed fees, unsold risk, batch savings and timing; not a sale recommendation.'});
  }
  const summary={generated_at:new Date().toISOString(),source_sha256:hash(freshBytes),source_filename:freshPath.split(/[\\/]/).at(-1),source_time:'2026-10-04 12:43 filename local time; source timezone unencoded',original:dealerStats(old),fresh:dealerStats(fresh),
    change_counts:Object.fromEntries(changeFields.map(field=>[field,changes.filter(x=>x.field===field).length])),rows_changed:new Set(changes.map(r=>[r.name,r.set,r.collector,r.finish,r.language].join('|'))).size,
    physical_inventory:{rows:holdings.length,copies:sum(holdings,h=>h.quantity)},tasks:grouped,
    compared_rows:compared.length,compared_copies:sum(compared,r=>r.quantity),ck_candidate_total:sum(findings,r=>(r.ck_candidate_copies??0)*(r.ck_quoted_per_card??0)),
    positive_spread_rows:positive.length,positive_spread_before_omitted_costs:sum(positive,r=>r.mp_minus_ck_extended),concentration:[10,25,50,100].map(count=>({top_rows:Math.min(count,positive.length),positive_spread:sum(positive.slice(0,count),r=>r.mp_minus_ck_extended)})),
    sensitivity,limits:['Analytical task bands are proposed, not dispositions.','SCG unknown capacity is not zero.','Catalog/scan language differences held for reconciliation, not declared misidentified.','Prior timing claims retained as unaccepted hypotheses.','No probabilities or future price appreciation are inferred.']};
  await c.query('COMMIT');
  for(const [name,data] of Object.entries({summary,findings,changes}))writeFileSync(join(out,`${name}.json`),JSON.stringify(data,null,2)+'\n');
  assert.equal(findings.length,723); assert.equal(sum(Object.values(grouped),r=>r.copies),817);
  console.log(JSON.stringify(summary,null,2));
  console.log('Highest positive spread candidates',JSON.stringify(positive.slice(0,12).map(r=>({name:r.name,set:r.set,collector:r.collector,finish:r.finish,spread:r.mp_minus_ck_extended,prior_timing:r.prior_timing_claim}))));
}finally{await c.end();}
