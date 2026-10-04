// Read-only research screen. Thresholds here are proposed triage, not owner
// policy, executable quotes, canonical decisions, or inventory actions.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { appClient, root } from './database.mjs';
import { manaPoolOrder } from './order-economics.mjs';

const asOf = new Date();
const dayMs = 86_400_000;
const quotePath = join(root, 'data/private/market/2026-10-04/ck-buylist-checks.json');
const outDir = join(root, '../outputs/buylist-first-pass');
const cents = value => value == null ? null : Math.round(Number(value) * 100);
const dollars = value => value == null ? null : (value / 100).toFixed(2);
const ageDays = date => date == null ? null : (asOf.getTime() - Date.parse(date)) / dayMs;
const median = values => { const s = values.toSorted((a,b) => a-b); return s.length ? (s.length % 2 ? s[(s.length-1)/2] : (s[s.length/2-1]+s[s.length/2])/2) : null; };
const quoteRows = () => {
  if (!existsSync(quotePath)) return [];
  const data = JSON.parse(readFileSync(quotePath, 'utf8'));
  const rows = Array.isArray(data) ? data : data.checks;
  if (!Array.isArray(rows)) throw new Error('CK checks must be an array or an object with checks array');
  return rows;
};
function liveQuote(row, lot) {
  if (String(row.lot_id) !== lot.lot_id) return null;
  if (!['listed','not_listed'].includes(row.status)) throw new Error(`Live check ${lot.lot_id} needs listed/not_listed status`);
  if (row.name != null && String(row.name).trim().toLowerCase() !== lot.name.trim().toLowerCase()) throw new Error(`Live check ${lot.lot_id} mismatches name`);
  for (const [key, field] of [['set_code','set_code'],['collector_number','collector_number'],['finish','finish'],['printed_language','printed_language']]) {
    if (row[key] != null && String(row[key]).toLowerCase() !== String(lot[field]).toLowerCase()) throw new Error(`Live quote ${lot.lot_id} mismatches ${key}`);
  }
  if (row.condition_normalized != null && row.condition_normalized !== lot.condition_normalized) throw new Error(`Live check ${lot.lot_id} mismatches grade`);
  const cash = Number.isSafeInteger(row.cash_cents) ? row.cash_cents : row.cash_usd != null ? cents(row.cash_usd) : row.cash != null ? cents(row.cash) : null;
  if (row.status !== 'not_listed' && (cash == null || cash < 0)) throw new Error(`Live quote ${lot.lot_id} lacks valid cash price`);
  if (row.status === 'not_listed' && (cash !== null || row.max_quantity != null)) throw new Error(`Not-listed check ${lot.lot_id} must leave price and capacity unknown`);
  const captured = row.captured_at ?? row.observed_at;
  if (!captured || !Number.isFinite(Date.parse(captured))) throw new Error(`Live quote ${lot.lot_id} lacks captured_at`);
  const capacity = row.max_quantity ?? row.wanted_quantity ?? null;
  if (capacity !== null && (!Number.isSafeInteger(capacity) || capacity < 0)) throw new Error(`Live quote ${lot.lot_id} invalid max_quantity`);
  return {status:row.status,price_cents:row.status==='not_listed'?null:cash, captured_at:captured, capacity, source_url:row.source_url ?? null,
    source_product_id:row.product_url ?? row.product_id ?? row.source_product_id ?? null, source_title:row.product_title ?? row.source_title ?? null,
    source_file:quotePath, evidence_type:'public_live_buylist_listing_not_accepted_quote'};
}
const c = await appClient();
try {
  const lots = (await c.query(`SELECT i.lot_id,i.variant_id,i.origin_record_id,i.name,i.set_code,i.collector_number,
    i.finish,i.printed_language,i.condition_normalized,i.available_quantity,
    ck.id AS ck_observation_id,ck.capture_id AS ck_capture_id,ck.numeric_value AS ck_bid,ck.window_start AS ck_date,
    tcg.id AS tcg_observation_id,tcg.capture_id AS tcg_capture_id,tcg.numeric_value AS tcg_price,tcg.window_start AS tcg_date,
    mp.id AS mp_observation_id,mp.capture_id AS mp_capture_id,mp.numeric_value AS mp_ask,mp.captured_at AS mp_date,
    mp.market_product_id AS mp_product_id
   FROM canonical_inventory i
   LEFT JOIN LATERAL (SELECT e.id,e.capture_id,e.numeric_value,e.window_start FROM canonical_eligible_evidence e
     JOIN canonical_product_mappings m ON m.id=e.mapping_id
     WHERE m.variant_id=i.variant_id AND m.provider='MTGJSON/cardkingdom'
       AND m.condition_scope=i.condition_normalized AND e.metric='indicated_nm_buylist'
     ORDER BY e.window_start DESC,e.id LIMIT 1) ck ON true
   LEFT JOIN LATERAL (SELECT e.id,e.capture_id,e.numeric_value,e.window_start FROM canonical_eligible_evidence e
     JOIN canonical_product_mappings m ON m.id=e.mapping_id
     WHERE m.variant_id=i.variant_id AND m.provider='MTGJSON/tcgplayer'
       AND e.metric='daily_retail_reference'
     ORDER BY e.window_start DESC,e.id LIMIT 1) tcg ON true
   LEFT JOIN LATERAL (SELECT e.id,e.capture_id,e.numeric_value,e.captured_at,e.market_product_id
     FROM canonical_lot_market_evidence e WHERE e.lot_id=i.lot_id AND e.metric='lowest_asking_price'
     ORDER BY e.captured_at DESC,e.id LIMIT 1) mp ON true
   ORDER BY i.name,i.set_code,i.collector_number,i.finish,i.lot_id`)).rows;
  const saleRows = (await c.query(`SELECT lot_id,id,capture_id,numeric_value,quantity,observed_at
    FROM canonical_lot_market_evidence WHERE metric='reported_sale_price'`)).rows;
  const salesByLot = new Map();
  for (const s of saleRows) { if (!salesByLot.has(s.lot_id)) salesByLot.set(s.lot_id, []); salesByLot.get(s.lot_id).push(s); }
  const byId = new Map(lots.map(l => [l.lot_id,l]));
  const liveByLot = new Map();
  const liveSourceHash = existsSync(quotePath) ? createHash('sha256').update(readFileSync(quotePath)).digest('hex') : null;
  for (const raw of quoteRows()) {
    const lot = byId.get(String(raw.lot_id));
    if (!lot) throw new Error(`Live quote references unknown lot_id ${raw.lot_id}`);
    if (liveByLot.has(lot.lot_id)) throw new Error(`Duplicate live quote for lot_id ${lot.lot_id}`);
    liveByLot.set(lot.lot_id, liveQuote(raw,lot));
  }
  const report = lots.map(lot => {
    const historicalBidCents = cents(lot.ck_bid);
    const liveChecked = liveByLot.has(lot.lot_id);
    const live = liveByLot.get(lot.lot_id) ?? null;
    const bidCents = liveChecked ? live.price_cents : historicalBidCents;
    const bidDate = liveChecked ? live.captured_at : lot.ck_date;
    const bidAge = ageDays(bidDate);
    const fresh = bidAge !== null && bidAge >= -1 && bidAge <= 14;
    const saleSamples = (salesByLot.get(lot.lot_id) ?? []).filter(s =>
      s.quantity === 1 && Number.isFinite(Date.parse(s.observed_at)) &&
      ageDays(s.observed_at) >= 0 && ageDays(s.observed_at) <= 120);
    const saleCents = saleSamples.map(s => cents(s.numeric_value)).filter(Number.isSafeInteger);
    const saleMedian = saleCents.length ? Math.round(median(saleCents)) : null;
    const askCents = cents(lot.mp_ask), tcgCents = cents(lot.tcg_price);
    const completeComparison = askCents !== null && tcgCents !== null && saleCents.length >= 3;
    const retailPriceCents = completeComparison ? Math.max(askCents,tcgCents,saleMedian) : null;
    // Deliberately favorable to the single-card retail alternative: no
    // postage, materials or loss reserve. This is not a forecast or upper
    // bound for future prices, and a multi-card order changes fixed costs.
    const shippingCreditCents = retailPriceCents !== null && retailPriceCents < 6000 ? 135 : 0;
    const economics = retailPriceCents === null ? null : manaPoolOrder({
      items:[{unitPriceCents:retailPriceCents,quantity:1}],shippingCreditCents,
      postageCents:0,materialsCents:0,lossReserveCents:0});
    const gainCents = economics === null || bidCents === null ? null : economics.netCents-bidCents;
    const lotGainCents = gainCents === null ? null : gainCents*lot.available_quantity;
    const sensitivity = Object.fromEntries([100,200,300].map(threshold => [String(threshold),
      fresh && bidCents >= 100 && completeComparison && gainCents <= threshold && lotGainCents <= 500]));
    let classification;
    if (lot.available_quantity <= 0) classification='unavailable';
    else if (bidCents === null) classification=liveChecked?'live_not_listed':'no_bid_evidence';
    else if (liveChecked && live.capacity === 0) classification='live_zero_capacity';
    else if (!fresh) classification='stale_bid';
    else if (bidCents < 100) classification='below_one_dollar';
    else if (!completeComparison) classification='insufficient_retail_evidence';
    else if (gainCents > 200 || lotGainCents > 500) classification='retail_gap_exceeds_screen';
    else classification=bidCents >= 500 ? 'priority_buylist_research' : 'batch_addon_research';
    return {
      lot_id:lot.lot_id,variant_id:lot.variant_id,origin_record_id:lot.origin_record_id,
      name:lot.name,set_code:lot.set_code,collector_number:lot.collector_number,
      finish:lot.finish,printed_language:lot.printed_language,condition:lot.condition_normalized,
      available_quantity:lot.available_quantity,classification,
      bid:{selected_source:liveChecked?'live_public_listing_check':'MTGJSON_historical_indication',selected_cash_cents:bidCents,
        selected_lot_gross_cents:bidCents===null?null:bidCents*lot.available_quantity,
        selected_date:bidDate,age_days:bidAge == null ? null : Math.round(bidAge*10)/10,
        current_for_screen:fresh,live, historical:{cash_cents:historicalBidCents,date:lot.ck_date,
          observation_id:lot.ck_observation_id,capture_id:lot.ck_capture_id}},
      retail:{manapool_ask_cents:askCents,manapool_observation_id:lot.mp_observation_id,
        manapool_capture_id:lot.mp_capture_id,manapool_product_id:lot.mp_product_id,
        manapool_captured_at:lot.mp_date,tcg_reference_cents:tcgCents,
        tcg_observation_id:lot.tcg_observation_id,tcg_capture_id:lot.tcg_capture_id,tcg_date:lot.tcg_date,
        single_copy_samples_120d:saleCents.length,sample_observation_ids:saleSamples.map(s=>s.id),
        sample_capture_ids:[...new Set(saleSamples.map(s=>s.capture_id))],sample_median_cents:saleMedian,
        optimistic_price_cents:retailPriceCents,shipping_credit_cents:shippingCreditCents,
        optimistic_order_economics:economics,estimated_marginal_gain_cents:gainCents,
        estimated_total_lot_gain_cents:lotGainCents},
      sensitivity_pass_at_marginal_gain_cents:sensitivity
    };
  });
  const counts = Object.fromEntries([...new Set(report.map(r=>r.classification))].sort().map(k =>
    [k,{lots:report.filter(r=>r.classification===k).length,copies:report.filter(r=>r.classification===k).reduce((n,r)=>n+r.available_quantity,0)}]));
  const selected=report.filter(r=>['priority_buylist_research','batch_addon_research'].includes(r.classification));
  const liveSelected=selected.filter(r=>r.bid.live);
  const result={as_of:asOf.toISOString(),kind:'proposed_read_only_buylist_research_screen',
    live_source_sha256:liveSourceHash,
    thresholds:{minimum_bid_cents:100,priority_bid_cents:500,max_marginal_retail_gain_cents:200,
      max_total_lot_retail_gain_cents:500,bid_max_age_days:14,minimum_single_copy_sale_samples_120d:3,
      sensitivity_marginal_gain_cents:[100,200,300],status:'proposed_for_triage_not_owner_accepted'},
    evidence_semantics:'MTGJSON CK is an indicative historical NM base price with no capacity. A public live listing is still not an accepted quote. Mana Pool asks are offers; up-to-20 sale samples have unknown completeness and may overlap. TCGplayer reference is not completed-sales evidence. Sample price basis is unverified.',
    scenario:'One-card Mana Pool sale at max(exact-grade current ask, median of at least 3 qty-one sampled sales in 120 days, TCG reference). Standard published fee estimate, $1.35 seller shipping credit below $60, zero postage/materials/loss. Favorable to retail for these omitted costs, not a future-price upper bound; multi-item basket economics can differ.',
    prerequisites:'No automatic sell/hold classification. Dealer batch postage, grade acceptance, exact capacity/product match, checkout quote, actual order composition and fulfillment costs still require verification.',
    coverage:{lots:lots.length,copies:lots.reduce((n,r)=>n+r.available_quantity,0),live_public_checks:liveByLot.size,selected_lots:selected.length,
      selected_copies:selected.reduce((n,r)=>n+r.available_quantity,0),classifications:counts,
      live_checked_selected_lots:liveSelected.length,live_checked_selected_copies:liveSelected.reduce((n,r)=>n+r.available_quantity,0),
      live_checked_selected_gross_cents:liveSelected.reduce((n,r)=>n+r.bid.selected_lot_gross_cents,0),
      sensitivity:Object.fromEntries([100,200,300].map(t=>[String(t),{lots:report.filter(r=>r.sensitivity_pass_at_marginal_gain_cents[String(t)]).length,
        copies:report.filter(r=>r.sensitivity_pass_at_marginal_gain_cents[String(t)]).reduce((n,r)=>n+r.available_quantity,0)}]))},
    lots:report};
  mkdirSync(outDir,{recursive:true});
  writeFileSync(join(outDir,'buylist-first-pass.json'),JSON.stringify(result,null,2)+'\n');
  const money = c => c == null ? '—' : `$${dollars(c)}`;
  const md=[`# Buylist first-pass research screen`,``,
    `Generated ${result.as_of}. This is a proposed research shortlist, not a sale instruction or canonical decision.`,
    ``, `Classified ${result.coverage.lots} lots / ${result.coverage.copies} available copies; ${result.coverage.live_public_checks} public live buylist checks.`,
    ``, `| Classification | Lots | Copies |`, `|---|---:|---:|`,
    ...Object.entries(counts).map(([k,v])=>`| ${k} | ${v.lots} | ${v.copies} |`),
    ``, `Retail-gap sensitivity (same evidence gates and $5 total-lot limit): $1 = ${result.coverage.sensitivity['100'].lots} lots; $2 = ${result.coverage.sensitivity['200'].lots}; $3 = ${result.coverage.sensitivity['300'].lots}.`,
    ``, `## Live-checked research shortlist`, ``,
    `${liveSelected.length} lots / ${result.coverage.live_checked_selected_copies} copies, ${money(result.coverage.live_checked_selected_gross_cents)} gross indicative cash before dealer shipping, grading or other costs. Sorted by lot gross.`, ``,
    `| Card | Lot | Qty | Bid/copy | Lot gross | Ask | 120d median (n) | TCG reference | Favorable retail net | Gain/copy | Class |`,
    `|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---|`,
    ...liveSelected.toSorted((a,b)=>b.bid.selected_lot_gross_cents-a.bid.selected_lot_gross_cents).map(r=>
      `| ${r.name.replaceAll('|','\\|')} ${r.set_code.toUpperCase()} #${r.collector_number} ${r.finish} ${r.printed_language} | ${r.lot_id} | ${r.available_quantity} | ${money(r.bid.selected_cash_cents)} | ${money(r.bid.selected_lot_gross_cents)} | ${money(r.retail.manapool_ask_cents)} | ${money(r.retail.sample_median_cents)} (${r.retail.single_copy_samples_120d}) | ${money(r.retail.tcg_reference_cents)} | ${money(r.retail.optimistic_order_economics.netCents)} | ${money(r.retail.estimated_marginal_gain_cents)} | ${r.classification} |`),
    ``, `## Historical-indication screen passes`, ``,
    `${selected.length-liveSelected.length} additional lots pass using dated MTGJSON bid indications; these require a live exact-product and capacity check. Their rows and source IDs are in the JSON.`,
    ``, `The screen uses bids of at least $1, at least three single-copy reported Mana Pool sales from the last 120 days, exact-grade ask and TCG reference, plus a bid no older than 14 days. Retail comparison takes the highest of those three prices and assumes one card per order, published standard fee estimates, $1.35 shipping credit below $60, and zero postage, materials and loss. This favors the retail alternative on omitted costs; it does not bound future prices. Sale samples are capped at 20 per product with unknown completeness and unverified price basis.`,
    ``, `Historical indications and live public listings are distinct. Public wanted quantity is not approved capacity, and neither is an accepted quote. Confirm exact product/grade, shared capacity, dealer batch costs and checkout terms before any sale. The JSON file retains source IDs, dates and all 723 lot classifications.`,``];
  writeFileSync(join(outDir,'buylist-first-pass.md'),md.join('\n'));
  console.log(JSON.stringify({outDir,coverage:result.coverage}));
} finally { await c.end(); }
