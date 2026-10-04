// Read-only coverage and triage. These figures are evidence, not disposition decisions.
import {mkdirSync,writeFileSync} from 'node:fs';import {join} from 'node:path';
import {appClient,root} from './database.mjs';
const c=await appClient();
try{
 const rows=(await c.query(`SELECT i.lot_id,i.name,i.set_code,i.collector_number,i.finish,i.printed_language,
  i.condition_normalized,i.available_quantity,
  ck.numeric_value AS ck_indicated_nm_buylist,ck.window_start AS ck_date,
  tcg.numeric_value AS tcg_retail_reference,tcg.window_start AS tcg_date,
  mp.numeric_value AS manapool_low_ask,mp.captured_at AS manapool_capture,
  rank.numeric_value AS edhrec_rank
  FROM canonical_inventory i
  LEFT JOIN LATERAL (SELECT e.numeric_value,e.window_start FROM canonical_eligible_evidence e
    JOIN canonical_product_mappings m ON m.id=e.mapping_id
    WHERE m.variant_id=i.variant_id AND m.provider='MTGJSON/cardkingdom' AND m.condition_scope=i.condition_normalized
      AND e.metric='indicated_nm_buylist' ORDER BY e.window_start DESC LIMIT 1) ck ON true
  LEFT JOIN LATERAL (SELECT e.numeric_value,e.window_start FROM canonical_eligible_evidence e
    JOIN canonical_product_mappings m ON m.id=e.mapping_id
    WHERE m.variant_id=i.variant_id AND m.provider='MTGJSON/tcgplayer' AND e.metric='daily_retail_reference'
    ORDER BY e.window_start DESC LIMIT 1) tcg ON true
  LEFT JOIN LATERAL (SELECT e.numeric_value,e.captured_at FROM canonical_lot_market_evidence e
    WHERE e.lot_id=i.lot_id AND e.metric='lowest_asking_price' ORDER BY e.captured_at DESC LIMIT 1) mp ON true
  LEFT JOIN LATERAL (SELECT e.numeric_value FROM canonical_eligible_evidence e
    JOIN canonical_product_mappings m ON m.id=e.mapping_id
    WHERE m.variant_id=i.variant_id AND m.provider='MTGJSON/EDHREC' AND e.metric='edhrec_rank' LIMIT 1) rank ON true
  ORDER BY i.name,i.set_code,i.collector_number,i.finish,i.lot_id`)).rows;
 const positive=r=>r!==null&&Number(r)>0;
 const coverage={lots:rows.length,copies:rows.reduce((n,r)=>n+r.available_quantity,0),condition_nm:rows.filter(r=>r.condition_normalized==='near_mint').length,condition_lp:rows.filter(r=>r.condition_normalized==='lightly_played').length,ck_positive_indication:rows.filter(r=>positive(r.ck_indicated_nm_buylist)).length,ck_zero_or_missing:rows.filter(r=>!positive(r.ck_indicated_nm_buylist)).length,tcg_reference:rows.filter(r=>r.tcg_retail_reference!==null).length,manapool_exact_grade_ask:rows.filter(r=>r.manapool_low_ask!==null).length,edhrec_rank:rows.filter(r=>r.edhrec_rank!==null).length};
 const comparison=rows.filter(r=>positive(r.ck_indicated_nm_buylist)&&positive(r.manapool_low_ask)).map(r=>({lot_id:r.lot_id,name:r.name,set:r.set_code,number:r.collector_number,finish:r.finish,condition:r.condition_normalized,ck_indicated_nm_buylist:Number(r.ck_indicated_nm_buylist),ck_date:r.ck_date,manapool_low_ask:Number(r.manapool_low_ask),manapool_capture:r.manapool_capture,tcg_retail_reference:r.tcg_retail_reference===null?null:Number(r.tcg_retail_reference),edhrec_rank:r.edhrec_rank===null?null:Number(r.edhrec_rank),asking_minus_indication:(Math.round(Number(r.manapool_low_ask)*100)-Math.round(Number(r.ck_indicated_nm_buylist)*100))/100}));
 const flagged=comparison.filter(r=>r.asking_minus_indication>=10&&r.manapool_low_ask>=1.5*r.ck_indicated_nm_buylist).sort((a,b)=>b.asking_minus_indication-a.asking_minus_indication).slice(0,30);
 const result={as_of:new Date().toISOString(),coverage,readiness:{current_dealer_capacity:'unknown',firm_cash_quotes:0,price_history_days_max:90,observed_sale_samples_max_per_product:20,order_net:'requires actual or scenario postage, materials and loss inputs',recommendations:'not generated'},interpretation:'Card Kingdom indications are NM base without wanted quantity or approval. Mana Pool asks are listings; the asking-minus-indication difference is not achievable profit or a disposition recommendation. EDHREC rank is functional-card gameplay interest, not exact-printing sales.',review_queue:flagged};
 const out=join(root,'../outputs/market-ingestion');mkdirSync(out,{recursive:true});writeFileSync(join(out,'current-market-insights.json'),JSON.stringify(result,null,2)+'\n');
 console.log(JSON.stringify({coverage,review_queue_count:flagged.length,examples:flagged.slice(0,3).map(r=>({name:r.name,set:r.set,number:r.number,asking_minus_indication:r.asking_minus_indication}))},null,2));
}finally{await c.end();}
