// Read-only comparison of a fresh aggregator export with canonical stock and
// the pinned first-pass report. Never overwrites the reviewed input report.
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {join} from 'node:path';
import {parse} from 'csv-parse/sync';
import {appClient,root} from './database.mjs';

const sourcePath=process.argv[2] ?? join(root,'data/private/market/2026-10-04/tcgsentry-collection-2026-10-04-1625.csv');
const outputDir=join(root,'../outputs/buylist-first-pass');
const pinnedPath=join(outputDir,'buylist-first-pass.json');
const sourceBytes=readFileSync(sourcePath),sourceSha=createHash('sha256').update(sourceBytes).digest('hex');
const csv=parse(sourceBytes,{columns:true,skip_empty_lines:true,bom:true});
const pinnedBytes=readFileSync(pinnedPath),pinnedSha=createHash('sha256').update(pinnedBytes).digest('hex');
const pinned=JSON.parse(pinnedBytes);
const pinnedByLot=new Map(pinned.lots.map(r=>[r.lot_id,r]));
const cents=v=>v===''||v==null?null:Math.round(Number(v)*100);
const cash=c=>c==null?'—':`$${(c/100).toFixed(2)}`;
const num=v=>v===''||v==null?null:Number(v);
const norm=v=>String(v??'').trim().toLowerCase();
const number=v=>norm(v).replace(/^0+(?=\d)/,'');
const grade=v=>({nm:'near_mint',lp:'lightly_played',mp:'moderately_played',hp:'heavily_played',dmg:'damaged'})[norm(v)]??null;
const c=await appClient();
try{
 const storedRun=(await c.query('SELECT input_manifest FROM canonical_decision_runs WHERE id=$1',['8ee01bb3-77a9-53c6-a36c-f9b739f34193'])).rows[0];
 if(!storedRun || storedRun.input_manifest.report_sha256!==pinnedSha) throw new Error('First-pass report differs from immutable reviewed run manifest; use the pinned private snapshot before comparison');
 const inventory=(await c.query(`SELECT i.*,r.raw->>'Scryfall ID' AS raw_scryfall_id,
   s.product_id AS accepted_scryfall_id
   FROM canonical_inventory i
   JOIN source_records r ON r.id=i.origin_record_id
   LEFT JOIN LATERAL (SELECT m.product_id FROM canonical_product_mappings m
     WHERE m.variant_id=i.variant_id AND m.provider='Scryfall' AND m.status='accepted'
       AND NOT EXISTS(SELECT 1 FROM canonical_product_mappings n WHERE n.supersedes_id=m.id)
     ORDER BY m.recorded_at DESC LIMIT 1) s ON true
   ORDER BY i.lot_id`)).rows;
 const byScryfall=new Map();
 for(const row of csv){const id=norm(row['Scryfall ID']);if(!byScryfall.has(id))byScryfall.set(id,[]);byScryfall.get(id).push(row);}
 const matchIssues=[],matched=[],identityMatchedIds=new Set();
 for(const lot of inventory){
  const id=norm(lot.accepted_scryfall_id ?? lot.raw_scryfall_id);
  const candidates=byScryfall.get(id)??[];
  const identityExact=candidates.filter(r=>norm(r['Set code'])===norm(lot.set_code)&&number(r.Number)===number(lot.collector_number)&&norm(r.Finish)===norm(lot.finish)&&norm(r.Language)===norm(lot.printed_language));
  if(identityExact.length===1)identityMatchedIds.add(id);
  const exact=identityExact.filter(r=>grade(r.Condition)===lot.condition_normalized);
  if(exact.length!==1){matchIssues.push({lot_id:lot.lot_id,name:lot.name,set:lot.set_code,number:lot.collector_number,finish:lot.finish,language:lot.printed_language,accepted_scryfall_id:id,rows_same_id:candidates.length,exact_rows:exact.length,reason:identityExact.length===1?'condition_mismatch':identityExact.length?'duplicate_exact_export_rows':candidates.length?'identity_or_language_mismatch':'no_accepted_id_in_export'});continue;}
  const row=exact[0];
  // Export is hydration only: duplicate provider rows may map to distinct lots,
  // but it never changes their physical quantities or grade.
  const ck=cents(row['CardKingdom price']),scg=cents(row['Star City Games price']);
  const ckQty=num(row['CardKingdom qty']);
  const pinnedLot=pinnedByLot.get(lot.lot_id);
  const liveStatus=pinnedLot?.bid?.live?.status??null;
  const live=liveStatus==='listed'?pinnedLot.bid.live:null;
  const ckLive=live?.price_cents??null;
  const ckLiveQty=live?.capacity??null;
  const ckEffective=liveStatus==='not_listed'?null:live?ckLive:(ckQty!==null&&ckQty>0?ck:null);
  const ckBasis=liveStatus==='not_listed'?'direct_public_search_not_listed_conflicts_with_aggregator':live?'direct_public_page':ckEffective!==null?'tcgsentry_aggregator':'unavailable_or_zero_capacity';
  matched.push({lot_id:lot.lot_id,name:lot.name,set:lot.set_code,number:lot.collector_number,finish:lot.finish,language:lot.printed_language,condition:lot.condition_normalized,
   quantity:lot.available_quantity,scryfall_id:id,export_qty:num(row.Quantity),ck_aggregator_cents:ck,ck_aggregator_capacity:ckQty,
   ck_direct_cents:ckLive,ck_direct_capacity:ckLiveQty,ck_comparison_cents:ckEffective,ck_basis:ckBasis,
   direct_check_status:liveStatus,
   scg_aggregator_cents:scg,scg_capacity:null,scg_minus_ck_per_copy_cents:scg!==null&&ckEffective!==null?scg-ckEffective:null,
   pinned_classification:pinnedLot?.classification??null,pinned_retail_gap_cents:pinnedLot?.retail?.estimated_marginal_gain_cents??null,
   evidence:{canonical_lot_id:lot.lot_id,accepted_scryfall_id:id,pinned_report_as_of:pinned.as_of,export_source_sha256:sourceSha,
     ck_direct_product_url:live?.source_product_id??null}});
 }
 const exportOnly=csv.filter(r=>!identityMatchedIds.has(norm(r['Scryfall ID']))).map(r=>({name:r.Name,set:r['Set code'],number:r.Number,finish:r.Finish,language:r.Language,scryfall_id:r['Scryfall ID']}));
 const reviewed=matched.filter(r=>r.ck_direct_cents!==null&&['priority_buylist_research','batch_addon_research'].includes(r.pinned_classification));
 const allReviewedIds=new Set(pinned.lots.filter(r=>r.bid.live?.status==='listed'&&['priority_buylist_research','batch_addon_research'].includes(r.classification)).map(r=>r.lot_id));
 const reviewedMissing=[...allReviewedIds].filter(id=>!reviewed.some(r=>r.lot_id===id));
 const ckGross=reviewed.reduce((n,r)=>n+r.ck_direct_cents*r.quantity,0);
 const scgMissing=reviewed.filter(r=>r.scg_aggregator_cents===null);
 const scgGross=scgMissing.length?null:reviewed.reduce((n,r)=>n+r.scg_aggregator_cents*r.quantity,0);
 const scgWins=reviewed.filter(r=>r.scg_aggregator_cents!==null&&r.scg_aggregator_cents>r.ck_direct_cents)
   .toSorted((a,b)=>(b.scg_aggregator_cents-b.ck_direct_cents)*b.quantity-(a.scg_aggregator_cents-a.ck_direct_cents)*a.quantity);
 const splitGross=reviewed.reduce((n,r)=>n+Math.max(r.ck_direct_cents,r.scg_aggregator_cents??0)*r.quantity,0);
 const splitIncrement=splitGross-ckGross;
 // No assumed shipping costs. The SCG help center states seller-paid postage
 // and a typical $1 domestic PayPal fee; check option has a $10 minimum.
 const scgPayPalTypicalCents=100;
 const scgSecondShipmentBreakEvenCents=splitIncrement-scgPayPalTypicalCents;
 const scgWholeBasketBreakEvenShippingDeltaCents=scgGross===null?null:scgGross-ckGross-scgPayPalTypicalCents;
 const capacityProblems=matched.filter(r=>r.ck_aggregator_capacity===0&&r.ck_aggregator_cents!==null);
 const preliminaryScgUpside=matched.filter(r=>r.scg_minus_ck_per_copy_cents>0)
   .toSorted((a,b)=>b.scg_minus_ck_per_copy_cents*b.quantity-a.scg_minus_ck_per_copy_cents*a.quantity)
   .slice(0,30);
 // A bounded, non-executable expansion queue. Exclude direct-page absences,
 // stale/zero-capacity CK rows, unknown grade matches and shared-product groups
 // whose requested copies exceed the provider's displayed total capacity.
 const groupQty=new Map();
 for(const r of matched){const k=`${r.scryfall_id}|${r.finish}|${r.language}|${r.condition}`;groupQty.set(k,(groupQty.get(k)??0)+r.quantity);}
 const ckAddonQueue=matched.filter(r=>r.ck_basis==='tcgsentry_aggregator'&&r.ck_aggregator_cents>=100&&r.ck_aggregator_capacity>0&&
   groupQty.get(`${r.scryfall_id}|${r.finish}|${r.language}|${r.condition}`)<=r.ck_aggregator_capacity&&r.quantity>0&&
   !allReviewedIds.has(r.lot_id))
   .map(r=>({...r,indicative_lot_gross_cents:r.ck_aggregator_cents*r.quantity,
     retail_screen_gate:r.pinned_classification==='batch_addon_research'||r.pinned_classification==='priority_buylist_research'?'passed_proposed_retail_screen':'not_established'}))
   .toSorted((a,b)=>b.indicative_lot_gross_cents-a.indicative_lot_gross_cents);
 const boundedAddonTop=ckAddonQueue.slice(0,30);
 const lowDollarBatchAddons=ckAddonQueue.filter(r=>r.ck_aggregator_cents<500).slice(0,30);
 const scgOnlyQueue=matched.filter(r=>r.scg_aggregator_cents>=500&&r.ck_comparison_cents===null&&r.quantity>0)
   .toSorted((a,b)=>b.scg_aggregator_cents*b.quantity-a.scg_aggregator_cents*a.quantity).slice(0,20);
 const comparisonGate=r=>{const p=pinnedByLot.get(r.lot_id);return p?.retail?.manapool_ask_cents!=null&&
   p.retail.tcg_reference_cents!=null&&p.retail.single_copy_samples_120d>=3&&
   p.retail.optimistic_order_economics?.netCents!=null;};
 const ckStrictRaw=matched.filter(r=>r.quantity>0&&r.ck_comparison_cents>=100&&comparisonGate(r)&&
   (r.ck_basis==='direct_public_page' ? r.ck_direct_capacity>=r.quantity : r.ck_aggregator_capacity>=r.quantity)&&
   pinnedByLot.get(r.lot_id).retail.optimistic_order_economics.netCents-r.ck_comparison_cents<=200&&
   (pinnedByLot.get(r.lot_id).retail.optimistic_order_economics.netCents-r.ck_comparison_cents)*r.quantity<=500);
 const ckStrictGroupQty=new Map();
 for(const r of ckStrictRaw){const k=`${r.scryfall_id}|${r.finish}|${r.language}|${r.condition}`;ckStrictGroupQty.set(k,(ckStrictGroupQty.get(k)??0)+r.quantity);}
 const ckStrict=ckStrictRaw.filter(r=>ckStrictGroupQty.get(`${r.scryfall_id}|${r.finish}|${r.language}|${r.condition}`)<=
   (r.ck_basis==='direct_public_page'?r.ck_direct_capacity:r.ck_aggregator_capacity));
 const ckStrictRemovedCapacity=ckStrictRaw.filter(r=>!ckStrict.includes(r));
 const ckStrictGross=ckStrict.reduce((n,r)=>n+r.ck_comparison_cents*r.quantity,0);
 const ckStrictNew=ckStrict.filter(r=>!allReviewedIds.has(r.lot_id));
 ckStrictNew.sort((a,b)=>b.ck_comparison_cents*b.quantity-a.ck_comparison_cents*a.quantity);
 const scgStrict=matched.filter(r=>r.quantity>0&&r.scg_aggregator_cents>=100&&comparisonGate(r)&&
   pinnedByLot.get(r.lot_id).retail.optimistic_order_economics.netCents-r.scg_aggregator_cents<=200&&
   (pinnedByLot.get(r.lot_id).retail.optimistic_order_economics.netCents-r.scg_aggregator_cents)*r.quantity<=500);
 const scgStrictGross=scgStrict.reduce((n,r)=>n+r.scg_aggregator_cents*r.quantity,0);
 const ckStrictScgMissing=ckStrict.filter(r=>r.scg_aggregator_cents===null);
 const ckStrictScgGross=ckStrictScgMissing.length?null:ckStrict.reduce((n,r)=>n+r.scg_aggregator_cents*r.quantity,0);
 const result={as_of:new Date().toISOString(),kind:'read_only_fresh_aggregator_buyer_comparison',
   source:{path:sourcePath,sha256:sourceSha,export_rows:csv.length,provider:'TCGSentry',timing:'filename local time only; provider quote freshness and direct approval unknown'},
   scope:{canonical_lots:inventory.length,exact_identity_matched_lots:matched.length+matchIssues.filter(r=>r.reason==='condition_mismatch').length,
     grade_compatible_matched_lots:matched.length,condition_holdout_lots:matchIssues.filter(r=>r.reason==='condition_mismatch').length,
     unmatched_lots:matchIssues.length,export_only_rows:exportOnly.length,
     pinned_reviewed_lots:allReviewedIds.size,pinned_reviewed_matched:reviewed.length,pinned_reviewed_unmatched:reviewedMissing,
     ck_positive_price_zero_export_capacity_lots:capacityProblems.length},
   semantics:'ManaBox/canonical identity and quantity control. Exact accepted Scryfall ID plus set, collector, finish and language required. TCGSentry CK and SCG numbers are aggregator indications. CK direct public checks supersede aggregator CK for checked lots; neither is checkout approval. CK export quantity zero blocks its numeric price; SCG capacity is unknown. No source can silently remap a canonical lot.',
   reviewed_batch:{lots:reviewed.length,copies:reviewed.reduce((n,r)=>n+r.quantity,0),ck_direct_gross_cents:ckGross,
     scg_aggregator_gross_cents:scgGross,split_max_indicative_gross_cents:splitGross,
     scg_aggregator_higher_lots:scgWins.length,scg_missing_price_lots:scgMissing.map(r=>r.lot_id),
     scg_whole_basket_coverage:scgMissing.length?'incomplete':'complete_aggregator_prices_only',
     split_increment_over_all_ck_cents:splitIncrement,
     scg_second_shipment_cost_break_even_after_typical_paypal_fee_cents:scgSecondShipmentBreakEvenCents,
     scg_whole_basket_shipping_delta_break_even_after_typical_paypal_fee_cents:scgWholeBasketBreakEvenShippingDeltaCents,
     method:'Net CK = CK gross - actual CK shipment/packing. Net SCG = SCG gross - actual SCG shipment/packing - payment fee if applicable. Split adds a second shipment. Break-even figures are cost differences, not modeled final cash.'},
   reviewed_scg_higher:scgWins,preliminary_scg_upside:preliminaryScgUpside,
   bounded_ck_aggregator_addon_queue:boundedAddonTop,low_dollar_ck_batch_addon_queue:lowDollarBatchAddons,
   scg_only_research_queue:scgOnlyQueue,
   expanded_strict_screen:{status:'research_candidates_only',basis:'Same proposed pinned retail scenario and $2/copy, $5/lot limits; fresh exact source CK/SCG indications. CK positive capacity shared across same Scryfall/finish/language/grade group; SCG capacity unknown.',
     ck_lots:ckStrict.length,ck_copies:ckStrict.reduce((n,r)=>n+r.quantity,0),ck_gross_indicative_cents:ckStrictGross,
     ck_direct_reviewed_lots:ckStrict.length-ckStrictNew.length,ck_new_aggregator_lots:ckStrictNew.length,
     ck_new_aggregator_copies:ckStrictNew.reduce((n,r)=>n+r.quantity,0),ck_new_aggregator_gross_cents:ckStrictNew.reduce((n,r)=>n+r.ck_comparison_cents*r.quantity,0),
     ck_capacity_excluded_lots:ckStrictRemovedCapacity.length,
     scg_lots:scgStrict.length,scg_copies:scgStrict.reduce((n,r)=>n+r.quantity,0),scg_gross_indicative_cents:scgStrictGross,
     scg_capacity:'unknown_not_checked',ck_strict_same_basket_scg_gross_cents:ckStrictScgGross,
     ck_strict_same_basket_scg_missing_lots:ckStrictScgMissing.map(r=>r.lot_id),
     ck_candidates:ckStrict.toSorted((a,b)=>b.ck_comparison_cents*b.quantity-a.ck_comparison_cents*a.quantity),
     scg_candidates:scgStrict.toSorted((a,b)=>b.scg_aggregator_cents*b.quantity-a.scg_aggregator_cents*a.quantity)},
   match_issues:matchIssues,export_only:exportOnly,ck_zero_capacity_rows:capacityProblems,
   matched_lots:matched};
 mkdirSync(outputDir,{recursive:true});
 writeFileSync(join(outputDir,'tcgsentry-buyer-comparison.json'),JSON.stringify(result,null,2)+'\n');
 const md=[
  '# Fresh TCGSentry buyer comparison','',`Generated ${result.as_of}. Exact canonical matching only; no inventory or stored proposal changed.`,
  '',`Fresh export: ${csv.length} rows; ${result.scope.exact_identity_matched_lots} canonical lots match identity, ${matched.length} also match owner grade, ${result.scope.condition_holdout_lots} identity matches are grade-mismatched and excluded from economics. ${exportOnly.length} export rows have no exact canonical identity match. CK positive-price/zero-capacity conflicts: ${capacityProblems.length}; their numeric CK prices are excluded.`,
  '',`## Reviewed ${reviewed.length}-lot direct-CK tranche`,'',
  `Existing direct CK public-page indications total ${cash(ckGross)} across ${result.reviewed_batch.copies} cards. ${scgGross===null?'SCG has missing price lines, so a whole-basket SCG total is unavailable.':`The same basket at TCGSentry's SCG indicative prices totals ${cash(scgGross)} before SCG shipment and payment costs, assuming acceptance and sufficient unknown SCG capacity.`} Choosing each larger indication would yield ${cash(splitGross)} gross, but requires two dealer shipments when both are used. This is a comparison, not an approved split.`,
  '',`SCG exceeds direct CK on ${scgWins.length} reviewed lot${scgWins.length===1?'':'s'}. The possible gross increment from sending only those to SCG is ${cash(splitIncrement)}. That does not cover SCG's typical $1 domestic PayPal fee, even before paying for a second parcel. ${scgGross===null?'A whole-basket SCG comparison is incomplete.':'The all-SCG indicative gross is also below all-CK by '+cash(ckGross-scgGross)+', before shipment or fees.'}`,
  '', '| SCG-higher reviewed lot | Qty | Direct CK each | SCG aggregator each | Lot increment |', '|---|---:|---:|---:|---:|',
  ...scgWins.map(r=>`| ${r.name.replaceAll('|','\\|')} ${r.set.toUpperCase()} #${r.number} ${r.finish} | ${r.quantity} | ${cash(r.ck_direct_cents)} | ${cash(r.scg_aggregator_cents)} | ${cash((r.scg_aggregator_cents-r.ck_direct_cents)*r.quantity)} |`),
  '', '## Expanded fresh-bid screen — research only','',
  `Reapplying the pinned transparent retail comparison to the fresh, exact-matched export produces ${ckStrict.length} CK candidate lots / ${result.expanded_strict_screen.ck_copies} copies at ${cash(ckStrictGross)} gross indications. This includes the 20 direct-checked reviewed lots and ${ckStrictNew.length} **new aggregator-only** lots / ${result.expanded_strict_screen.ck_new_aggregator_copies} copies at ${cash(result.expanded_strict_screen.ck_new_aggregator_gross_cents)}. None of those new lots is a stored recommendation or checkout-ready quote. Positive CK displayed quantity covers the selected copies after grouping shared exact products; ${ckStrictRemovedCapacity.length} preliminary lot matches failed that shared-capacity check.`,
  '',`The same proposed screen yields ${scgStrict.length} SCG candidate lots / ${result.expanded_strict_screen.scg_copies} copies at ${cash(scgStrictGross)} gross aggregator prices, but SCG capacity is unknown. A whole-basket SCG comparison for the ${ckStrict.length} CK candidates is incomplete because ${ckStrictScgMissing.length} SCG price line${ckStrictScgMissing.length===1?' is':'s are'} missing. No sale probability, actual dealer net or shipment cost is inferred.`,
  '', '| Newly added CK candidate | Qty | CK each | Lot gross | Displayed capacity |', '|---|---:|---:|---:|---:|',
  ...ckStrictNew.map(r=>`| ${r.name.replaceAll('|','\\|')} ${r.set.toUpperCase()} #${r.number} ${r.finish} | ${r.quantity} | ${cash(r.ck_comparison_cents)} | ${cash(r.ck_comparison_cents*r.quantity)} | ${r.ck_aggregator_capacity} |`),
  '', '## Other SCG price leads needing verification','',
  'These are ranked by indicative lot spread, not approved recommendations. Confirm exact product, current SCG price, quantity accepted and condition. A high SCG number does not by itself justify a second parcel.',
  '', '| Card | Qty | CK basis | CK each | SCG each | Lot spread |', '|---|---:|---|---:|---:|---:|',
  ...preliminaryScgUpside.slice(0,15).map(r=>`| ${r.name.replaceAll('|','\\|')} ${r.set.toUpperCase()} #${r.number} ${r.finish} | ${r.quantity} | ${r.ck_basis} | ${cash(r.ck_comparison_cents)} | ${cash(r.scg_aggregator_cents)} | ${cash(r.scg_minus_ck_per_copy_cents*r.quantity)} |`),
  '', '## Bounded CK batch-addition research','',
  'The next low-dollar additions are exact identity/grade matches with positive export CK capacity and $1–$4.99 indications, ranked by whole-lot gross. They are research candidates only: the aggregator price and capacity need a fresh direct check, and sparse retail samples are not an automatic hold or sell decision.',
  '', '| Card | Qty | CK indication each | Displayed capacity | Lot gross | Prior retail screen |', '|---|---:|---:|---:|---:|---|',
  ...lowDollarBatchAddons.slice(0,15).map(r=>`| ${r.name.replaceAll('|','\\|')} ${r.set.toUpperCase()} #${r.number} ${r.finish} | ${r.quantity} | ${cash(r.ck_aggregator_cents)} | ${r.ck_aggregator_capacity} | ${cash(r.indicative_lot_gross_cents)} | ${r.retail_screen_gate} |`),
  '', '## SCG-only leads','',
  'For these exact identity/grade matches, current CK comparison is unavailable or blocked by displayed zero quantity while SCG has a positive aggregator price. SCG capacity remains unknown; obtain a direct SCG check before planning a basket.',
  '', '| Card | Qty | SCG indication each | CK status |', '|---|---:|---:|---|',
  ...scgOnlyQueue.slice(0,10).map(r=>`| ${r.name.replaceAll('|','\\|')} ${r.set.toUpperCase()} #${r.number} ${r.finish} | ${r.quantity} | ${cash(r.scg_aggregator_cents)} | ${r.ck_basis} |`),
  '', 'Conservative working subset: keep the existing direct-checked CK 20-lot candidate basket, then price-check material SCG leads before choosing one or two shipments. Neither company has accepted an order. New exact-matched export rows are not silently promoted to canonical decisions.',
  '', 'The SCG [payment policy](https://help.starcitygames.com/en-US/receiving-payment-1056898) describes a $10 check minimum and a typical $1 domestic PayPal fee; [shipping instructions](https://help.starcitygames.com/en-US/approval-shipping-instructions-1056762) say the seller pays shipment, with approval and timing requirements. Card Kingdom [selling terms](https://www.cardkingdom.com/purchasing/how_to_sell) also require checkout and final grading. Source data and matching details are in the JSON companion.',''];
 writeFileSync(join(outputDir,'tcgsentry-buyer-comparison.md'),md.join('\n'));
 console.log(JSON.stringify({source_rows:csv.length,matched:matched.length,unmatched:matchIssues.length,export_only:exportOnly.length,reviewed:reviewed.length,reviewed_missing:reviewedMissing.length,ck_gross_cents:ckGross,scg_gross_cents:scgGross,split_increment_cents:splitIncrement,scg_wins:scgWins.length}));
}finally{await c.end()}
