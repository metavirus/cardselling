import {mkdirSync,writeFileSync} from 'node:fs';import {join} from 'node:path';
import {appClient,root} from './database.mjs';
const c=await appClient();
try{
 const run=(await c.query("SELECT * FROM canonical_decision_runs WHERE prompt_version='human-requested-just-sell-first-pass-v1' ORDER BY created_at DESC LIMIT 1")).rows[0];
 if(!run)throw new Error('No reviewed buylist run');
 const rows=(await c.query('SELECT * FROM canonical_decisions WHERE run_id=$1',[run.id])).rows.map(d=>({...d.proposal,decision_id:d.id})).sort((a,b)=>b.gross_cents-a.gross_cents);
 const gross=rows.reduce((n,r)=>n+r.gross_cents,0),copies=rows.reduce((n,r)=>n+r.quantity,0);
 const money=c=>`$${(c/100).toFixed(2)}`;
 const table=rows.map(r=>{const s=r.source_snapshot;return `| ${s.name} | ${s.set_code.toUpperCase()} #${s.collector_number} | ${s.finish==='normal'?'Nonfoil':s.finish} | ${r.quantity} | ${money(r.per_copy_cash_cents)} | ${money(r.gross_cents)} |`;});
 const md=[
 '# First recommended buylist batch — October 4, 2026','',
 `I recommend putting these **${rows.length} lots / ${copies} cards** into one buylist batch. Card Kingdom displayed **${money(gross)} cash in total**, with enough wanted quantity for every selected lot, when checked on October 4. These are public bids, subject to checkout and final grading; they are not an accepted sell order. All selected lots are owner-graded Near Mint.`,
 '', '| Card | Printing | Finish | Qty | Cash each | Gross |','|---|---|---|---:|---:|---:|',...table,
 '', `**Total: ${copies} cards, ${money(gross)} before shipment costs or any grade adjustments.** A $10 total shipment/packing cost would leave $171; that is an illustration, not a postage quote.`,
 '', 'Why this batch: for each card I compared the current dealer bid with a deliberately favorable self-sale scenario. The comparison uses the highest of the exact-grade Mana Pool low ask, recent single-copy sale-sample median, and TCGplayer reference. It includes ordinary seller fees and shipping credit but gives retail zero postage, packing and loss costs. Even then, the modeled extra proceeds are at most $2 per copy and $5 across a lot. Those cutoffs are an initial analyst judgment for your low-effort objective, not a preference attributed to you or a forecast of future prices.',
 '', 'The strongest cases include Valley Floodcaller, Baeloth Barrityl, Pantlaza, Famished Worldsire and Smuggler\'s Surprise. The six Avacyn\'s Pilgrims make a useful $23.70 batch contribution without creating six small retail sales. Modest recent price appreciation on a few cards does not, by itself, establish a reason to hold them. A specific catalyst or a materially better competing bid would change the decision.',
 '', 'The analysis screened all 723 lots. Another 78 lots passed the proposed economics screen using dated buylist indications, but are still research candidates because current exact-product bids and capacity were not checked. They are listed separately in the broad screen. Cards outside these groups have not been labeled “hold” or “retail” by default.',
 '', 'Two originally screened products were absent from current title-search results; two more fell outside the proposed spread limits after live prices changed. They are excluded from this recommended batch. This illustrates why a price-feed indication alone is not enough.',
 '', 'Before sending: combine the batch, recheck current cash prices and wanted quantities, and compare total proceeds with actual shipment costs. There is no need to rush or accept a worse bid merely because a card appears here. The database stores the evidence and these recommendations; it contains no owner sale choice, reservation or stock movement from this analysis.',
 '', 'Mana Pool sale samples are capped and incomplete. Quantity-one samples avoid multi-copy price ambiguity, but their reported-price basis remains unverified. Prices are useful comparisons, not proof of a realizable selling price or market-wide velocity.',
 '', 'Sources: [Card Kingdom selling and grading terms](https://www.cardkingdom.com/purchasing/how_to_sell), [Mana Pool seller fees](https://support.manapool.com/hc/en-us/articles/21779686206615-Fees-Mana-Pool-and-Credit-Card-Fees). The JSON companion preserves each checked product URL, public capacity, evidence IDs, comparisons, reasoning and counterargument.',
 '', `Canonical review run: ${run.id}.`,''
 ];
 const out=join(root,'../outputs/buylist-first-pass');mkdirSync(out,{recursive:true});
 writeFileSync(join(out,'recommended-buylist-batch.md'),md.join('\n'));
 writeFileSync(join(out,'recommended-buylist-batch.json'),JSON.stringify({run_id:run.id,input_manifest:run.input_manifest,lots:rows.length,copies,gross_cents:gross,decisions:rows},null,2)+'\n');
 console.log(JSON.stringify({run_id:run.id,lots:rows.length,copies,gross_cents:gross}));
}finally{await c.end();}
