import {mkdirSync,writeFileSync} from 'node:fs';import {join} from 'node:path';
import {appClient,root} from './database.mjs';
import {manaPoolOrder} from './order-economics.mjs';
const c=await appClient();
try{
 const run=(await c.query("SELECT * FROM canonical_decision_runs WHERE prompt_version='human-requested-just-sell-first-pass-v1' ORDER BY created_at DESC LIMIT 1")).rows[0];
 if(!run)throw new Error('No reviewed buylist run');
 const rows=(await c.query('SELECT * FROM canonical_decisions WHERE run_id=$1',[run.id])).rows.map(d=>({...d.proposal,decision_id:d.id})).sort((a,b)=>b.gross_cents-a.gross_cents);
 const gross=rows.reduce((n,r)=>n+r.gross_cents,0),copies=rows.reduce((n,r)=>n+r.quantity,0);
 const money=c=>`${c<0?'-':''}$${(Math.abs(c)/100).toFixed(2)}`;
 const selfSaleAssumptions={status:'illustrative_working_estimate_not_verified_expected_value',price_basis:'Exact-grade Mana Pool current low ask; recent sale median and TCGplayer reference shown separately',postage_cents:135,materials_cents:25,loss_reserve_cents:0,shipping_credit_cents:135,order_basis:'Each copy sold in a separate domestic letter order below $60; combined orders differ',labor:'Not monetized',dealer_shipping:'Not allocated per card; subtract once from dealer batch'};
 const comparisons=rows.map(r=>{const s=r.source_snapshot,t=s.retail;
  const price=t.manapool_ask_cents;
  if(!Number.isSafeInteger(price)||price<0||price>=6000)throw new Error('Review fulfillment scenario for this price');
  const economics=manaPoolOrder({items:[{unitPriceCents:price,quantity:1}],shippingCreditCents:135,postageCents:135,materialsCents:25,lossReserveCents:0});
  return {lot_id:s.lot_id,name:s.name,quantity:r.quantity,working_sale_price_cents:price,estimated_self_sale_net_each_cents:economics.netCents,estimated_self_sale_net_lot_cents:economics.netCents*r.quantity,extra_vs_dealer_before_batch_shipping_cents:(economics.netCents-r.per_copy_cash_cents)*r.quantity,economics,source_retail:t};
 });
 const selfNet=comparisons.reduce((n,r)=>n+r.estimated_self_sale_net_lot_cents,0);
 const table=rows.map((r,i)=>{const s=r.source_snapshot,x=comparisons[i];return `| ${s.name} | ${s.set_code.toUpperCase()} #${s.collector_number} ${s.finish==='normal'?'nonfoil':s.finish} | ${r.quantity} | ${money(r.per_copy_cash_cents)} | ${money(x.working_sale_price_cents)} | ${money(x.estimated_self_sale_net_each_cents)} | ${money(x.extra_vs_dealer_before_batch_shipping_cents)} |`;});
 const md=[
 '# First recommended buylist batch — October 4, 2026','',
 `I recommend putting these **${rows.length} lots / ${copies} cards** into one buylist batch. Card Kingdom displayed **${money(gross)} cash in total**, with enough wanted quantity for every selected lot, when checked on October 4. These are public bids, subject to checkout and final grading; they are not an accepted sell order. All selected lots are owner-graded Near Mint.`,
 '', '## Dealer bid beside self-sale estimate','',
 'All price columns are per copy except the final whole-lot difference. Self-sale net is a working estimate conditional on a sale, not a guaranteed payout or a forecast of when it sells. A negative difference favors the dealer before allocating dealer batch shipping.',
 '', '| Card | Printing / finish | Qty | CK bid each | Self-sale price estimate | Self-sale net estimate | Extra self-sale cash, whole lot |','|---|---|---:|---:|---:|---:|---:|',...table,
 '', `Estimated self-sale proceeds total **${money(selfNet)}**, compared with **${money(gross)}** in dealer bids before dealer shipment costs. Under an illustrative $10 dealer shipment, the comparison is ${money(selfNet)} versus ${money(gross-1000)}. This assumes ${copies} individual self-sale orders; combined orders change fixed fees and shipping.`,
 '', 'Working self-sale price matches the exact-grade Mana Pool current low ask. It estimates proceeds if a buyer purchases at that competitive asking price; asks do not prove a sale will occur. Recent sampled sales and TCGplayer references are shown separately below so low asks, historical sales and market references can be challenged rather than blended. It is a proposed estimate, not a calibrated expected value. The original recommendation screen instead used the highest of ask, sample median and TCGplayer reference to challenge whether retail could plausibly pay materially more.',
 '', 'Self-sale net includes 5% marketplace fees, approximate 2.9% + $0.30 payment processing, $1.35 buyer shipping credit, and illustrative $1.35 postage + $0.25 materials per separate order. Postage/materials are modeling allowances, not verified postal quotes or your measured costs. No dollar value is deducted for labor, losses or returns. Every $0.50 change in fulfillment cost changes net by $0.50 per separate order. Dealer shipping is charged once per batch and is not hidden inside the per-card bid.',
 '', '## Evidence behind each estimate','',
 'Captured October 4, 2026. Sale samples are exact-product, owner-grade, quantity-one records from the preceding 120 days. The source is capped and incomplete; these are neither market-wide volume nor a guarantee of future prices. TCGplayer figures are reference prices, not completed sales.',
 '', '| Card / printing / finish | Mana Pool low ask | Sample sale median | Samples | TCGplayer reference | Original favorable-retail net before fulfillment |','|---|---:|---:|---:|---:|---:|',
 ...rows.map(r=>{const s=r.source_snapshot,t=s.retail;return `| ${s.name} ${s.set_code.toUpperCase()} #${s.collector_number} ${s.finish} | ${money(t.manapool_ask_cents)} | ${money(t.sample_median_cents)} | ${t.single_copy_samples_120d} | ${money(t.tcg_reference_cents)} | ${money(t.optimistic_order_economics.netCents)} |`;}),
 '', `**Total: ${copies} cards, ${money(gross)} before shipment costs or any grade adjustments.** A $10 total shipment/packing cost would leave $171; that is an illustration, not a postage quote.`,
 '', 'Why this batch: for each card I compared the current dealer bid with a deliberately favorable self-sale scenario. The comparison uses the highest of the exact-grade Mana Pool low ask, recent single-copy sale-sample median, and TCGplayer reference. It includes ordinary seller fees and shipping credit but gives retail zero postage, packing and loss costs. Even then, the modeled extra proceeds are at most $2 per copy and $5 across a lot. Those cutoffs are an initial analyst judgment for your low-effort objective, not a preference attributed to you or a forecast of future prices.',
 '', 'The strongest cases include Valley Floodcaller, Baeloth Barrityl, Pantlaza, Famished Worldsire and Smuggler\'s Surprise. The six Avacyn\'s Pilgrims make a useful $23.70 batch contribution without creating six small retail sales. Modest recent price appreciation on a few cards does not, by itself, establish a reason to hold them. A specific catalyst or a materially better competing bid would change the decision.',
 '', 'The analysis screened all 723 lots. The subsequent fresh TCGSentry comparison identifies another 73 lots / 80 copies with $184.05 in CK indications under the conservative screen; those remain separate research candidates. Cards outside these groups have not been labeled “hold” or “retail” by default.',
 '', 'Two originally screened products were absent from current title-search results; two more fell outside the proposed spread limits after live prices changed. They are excluded from this recommended batch. This illustrates why a price-feed indication alone is not enough.',
 '', 'Before sending: combine the batch, recheck current cash prices and wanted quantities, and compare total proceeds with actual shipment costs. There is no need to rush or accept a worse bid merely because a card appears here. The database stores the evidence and these recommendations; it contains no owner sale choice, reservation or stock movement from this analysis.',
 '', 'Mana Pool sale samples are capped and incomplete. Quantity-one samples avoid multi-copy price ambiguity, but their reported-price basis remains unverified. Prices are useful comparisons, not proof of a realizable selling price or market-wide velocity.',
 '', 'Sources: [Card Kingdom selling and grading terms](https://www.cardkingdom.com/purchasing/how_to_sell), [Mana Pool seller fees](https://support.manapool.com/hc/en-us/articles/21779686206615-Fees-Mana-Pool-and-Credit-Card-Fees). The JSON companion preserves each checked product URL, public capacity, evidence IDs, comparisons, reasoning and counterargument.',
 '', `Canonical review run: ${run.id}.`,''
 ];
 const out=join(root,'../outputs/buylist-first-pass');mkdirSync(out,{recursive:true});
 writeFileSync(join(out,'recommended-buylist-batch.md'),md.join('\n'));
 writeFileSync(join(out,'recommended-buylist-batch.json'),JSON.stringify({run_id:run.id,input_manifest:run.input_manifest,lots:rows.length,copies,gross_cents:gross,self_sale_assumptions:selfSaleAssumptions,self_sale_estimated_total_cents:selfNet,self_sale_comparisons:comparisons,decisions:rows},null,2)+'\n');
 console.log(JSON.stringify({run_id:run.id,lots:rows.length,copies,gross_cents:gross}));
}finally{await c.end();}
