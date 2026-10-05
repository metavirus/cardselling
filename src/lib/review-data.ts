import "server-only";
import {sql} from "drizzle-orm";
import {database} from "@/db/client";

export type PricePoint={date:string;cents:number};
export type ReviewCard={
 lotId:string;variantId:string;name:string;setCode:string;collectorNumber:string;finish:string;printedLanguage:string;grade:string;quantity:number;
 images:{thumb:string;normal:string;large:string}[];
 marketHistory:{tcg:PricePoint[];ck:PricePoint[]};recentSales:PricePoint[];
 semantic:{traits:string[];typeLine:string|null;edhrecRank:number|null;releasedAt:string|null;
  observedSales30:number;observedSales90:number;saleSampleCapped:boolean;latestObservedSaleAt:string|null;
  competingQuantity:number|null};
 proposal:"buylist"|null;ckCents:number|null;ckCapacity:number|null;ckSource:"direct_public"|"tcgsentry_export"|null;
 ckSourceDate:string|null;ckProductUrl:string|null;ckDirectNotListed:boolean;
 scgCents:number|null;scgSourceDate:string|null;askCents:number|null;askCapturedAt:string|null;
 medianCents:number|null;sampleCount:number;tcgCents:number|null;tcgSourceDate:string|null;
 optimisticNetCents:number|null;rationale:string|null;counterargument:string|null;
};
export type ReviewData={runId:string;asOf:string;evidenceAsOf:string;reviewAsOf:string;
 inventoryLots:number;inventoryCopies:number;reviewedLots:number;reviewedCopies:number;reviewedGrossCents:number;cards:ReviewCard[]};

type Run={id:string;input_manifest:{report_as_of:string;reviewed_lots:number;reviewed_copies:number;reviewed_gross_cents:number}};
type Lot={lot_id:string;variant_id:string;name:string;set_code:string;collector_number:string;finish:string;printed_language:string;
 condition_normalized:string;available_quantity:number;proposal:{disposition:string;status:string;quantity:number;gross_cents:number;
 rationale:string;counterargument:string;source_snapshot:{retail:{optimistic_order_economics:{netCents:number|null}|null}}}|null};
type Evidence={variant_id:string;condition_scope:string;provider:string;product_id:string;capture_id:string;mapping_id:string;metric:string;numeric_value:string;
 quantity:number|null;captured_at:Date|string;source_date:Date|string|null};
type Ask={lot_id:string;numeric_value:string;captured_at:Date|string};
type Sale={lot_id:string;numeric_value:string;quantity:number;observed_at:Date|string;capture_id:string;captured_at:Date|string};
type Absent={provider_subject:string};
type ImageRow={variant_id:string;product_id:string;raw:{image_uris?:Record<string,string>;card_faces?:{image_uris?:Record<string,string>}[];
 promo_types?:string[];frame_effects?:string[];full_art?:boolean;textless?:boolean;border_color?:string;
 set_type?:string;type_line?:string;edhrec_rank?:number;released_at?:string}|null};
type Supply={lot_id:string;numeric_value:string};
type History={variant_id:string;condition_scope:string;provider:string;numeric_value:string;source_date:Date|string};
const iso=(x:Date|string|null|undefined)=>x==null?null:new Date(x).toISOString();
function cardImages(row:ImageRow|undefined){
 const source=row?.raw;
 const faces=source?.image_uris?[source.image_uris]:source?.card_faces?.map(face=>face.image_uris).filter((x):x is Record<string,string>=>!!x)??[];
 const result=faces.map(face=>({thumb:face.small??face.thumb,normal:face.normal??face.large,large:face.large??face.normal}))
  .filter(face=>Object.values(face).every(url=>typeof url==="string"&&url.startsWith("https://cards.scryfall.io/")));
 if(result.length||!row?.product_id)return result;
 // One accepted language-specific printing is absent from the retained bulk snapshot.
 const id=row.product_id;
 return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(id)?[{
  thumb:`https://api.scryfall.com/cards/${id}?format=image&version=small`,
  normal:`https://api.scryfall.com/cards/${id}?format=image&version=normal`,
  large:`https://api.scryfall.com/cards/${id}?format=image&version=large`
 }]:[];
}
const traitNames:Record<string,string>={showcase:"Showcase",extendedart:"Extended art",retro:"Retro frame",
 raisedfoil:"Raised foil",surgefoil:"Surge foil",rainbowfoil:"Rainbow foil",halofoil:"Halo foil",
 ripplefoil:"Ripple foil",textured:"Textured foil",stepandcompleat:"Step-and-compleat foil",
 oilslick:"Oil slick foil",poster:"Poster treatment",shatteredglass:"Shattered glass art",
 godzillaseries:"Godzilla series",boosterfun:"Booster Fun",
 firstplacefoil:"First-place foil",boxtopper:"Box topper",sldbonus:"Secret Lair bonus",
 serialized:"Serialized",datestamped:"Date-stamped",prerelease:"Prerelease promo"};
function printingTraits(row:ImageRow|undefined,finish:string,setCode:string){
 const card=row?.raw;if(!card)return [];
 const tags=new Set<string>();
 if(setCode==='sld')tags.add('Secret Lair');
 if(card.border_color==='borderless')tags.add('Borderless');
 if(card.full_art)tags.add('Full art');
 if(card.textless)tags.add('Textless');
 if(finish==='etched')tags.add('Etched foil');
 for(const tag of [...card.frame_effects??[],...card.promo_types??[]])if(traitNames[tag])tags.add(traitNames[tag]);
 if(card.promo_types?.includes('universesbeyond'))tags.add('Universes Beyond');
 return [...tags];
}
function cents(x:string|null|undefined):number|null{if(x==null)return null;const n=Math.round(Number(x)*100);if(!Number.isSafeInteger(n)||n<0)throw new Error("Invalid source price");return n;}
function median(values:number[]):number|null{if(!values.length)return null;const s=values.toSorted((a,b)=>a-b),m=Math.floor(s.length/2);return Math.round(s.length%2?s[m]:(s[m-1]+s[m])/2);}
const key=(variant:string,grade:string)=>`${variant}|${grade}`;

export async function getReviewData():Promise<ReviewData>{
 const db=database();
 const run=(await db.execute(sql`SELECT id,input_manifest FROM canonical_decision_runs
  WHERE prompt_version='human-requested-just-sell-first-pass-v1' ORDER BY created_at DESC LIMIT 1`)).rows[0] as unknown as Run|undefined;
 if(!run)throw new Error("No reviewed buylist run is available");
 const [stockResult,lotsResult,capturesResult,bidsResult,absentResult,asksResult,salesResult,tcgResult,imagesResult,supplyResult,historyResult]=await Promise.all([
  db.execute(sql`SELECT count(*)::int lots,coalesce(sum(available_quantity),0)::int copies FROM canonical_inventory`),
  db.execute(sql`SELECT i.lot_id,i.variant_id,i.name,i.set_code,i.collector_number,i.finish,i.printed_language,
    i.condition_normalized,i.available_quantity,d.proposal FROM canonical_inventory i
    LEFT JOIN canonical_decisions d ON d.lot_id=i.lot_id AND d.run_id=${run.id}
    ORDER BY i.name,i.set_code,i.collector_number,i.finish,i.lot_id`),
  db.execute(sql`SELECT max(captured_at) latest FROM canonical_captures WHERE use_state='eligible'`),
  db.execute(sql`SELECT e.variant_id,m.condition_scope,m.provider,m.product_id,e.capture_id,e.mapping_id,e.metric,e.numeric_value,e.quantity,
    e.captured_at,e.window_start AS source_date FROM canonical_eligible_evidence e
    JOIN canonical_product_mappings m ON m.id=e.mapping_id
    WHERE (m.provider='Card Kingdom/public_buylist' AND e.metric IN ('public_cash_buylist_indication','public_max_wanted_quantity'))
       OR (m.provider='TCGSentry/Card Kingdom' AND e.metric IN ('exported_ck_cash_buylist_indication','exported_ck_wanted_quantity'))
       OR (m.provider='TCGSentry/Star City Games' AND e.metric='exported_scg_cash_buylist_indication')`),
  db.execute(sql`SELECT o.provider_subject FROM canonical_observations o JOIN canonical_captures c ON c.id=o.capture_id
    WHERE c.provider='Card Kingdom' AND c.use_state='eligible' AND o.metric='exact_printing_not_visible_in_title_search'`),
  db.execute(sql`SELECT DISTINCT ON (lot_id) lot_id,numeric_value,captured_at FROM canonical_lot_market_evidence
    WHERE metric='lowest_asking_price' AND condition_scope=condition_normalized
    ORDER BY lot_id,captured_at DESC,id DESC`),
  db.execute(sql`SELECT lot_id,numeric_value,quantity,observed_at,capture_id,captured_at FROM canonical_lot_market_evidence
    WHERE metric='reported_sale_price' AND condition_scope=condition_normalized AND observed_at IS NOT NULL`),
  db.execute(sql`SELECT DISTINCT ON (m.variant_id) m.variant_id,e.numeric_value,e.window_start AS source_date
    FROM canonical_eligible_evidence e JOIN canonical_product_mappings m ON m.id=e.mapping_id
    WHERE m.provider='MTGJSON/tcgplayer' AND e.metric='daily_retail_reference'
    ORDER BY m.variant_id,e.window_start DESC,e.id DESC`),
  db.execute(sql`SELECT DISTINCT ON (m.variant_id) m.variant_id,m.product_id,r.raw
    FROM canonical_product_mappings m
    LEFT JOIN LATERAL (SELECT raw FROM card_reference_snapshots
      WHERE scryfall_id=m.product_id::uuid LIMIT 1) r ON true
    WHERE m.provider='Scryfall' AND m.status='accepted'
    ORDER BY m.variant_id,m.id`),
  db.execute(sql`SELECT DISTINCT ON (lot_id) lot_id,numeric_value FROM canonical_lot_market_evidence
    WHERE metric='available_quantity' AND condition_scope=condition_normalized
    ORDER BY lot_id,captured_at DESC,id DESC`),
  // Keep the first and last source day plus weekly closing points. Latest capture
  // wins an overlapping source day; historical references never become quotes.
  db.execute(sql`WITH daily AS (
    SELECT DISTINCT ON (m.variant_id,m.provider,m.condition_scope,e.window_start)
      m.variant_id,m.provider,m.condition_scope,e.numeric_value,e.window_start AS source_date
    FROM canonical_eligible_evidence e JOIN canonical_product_mappings m ON m.id=e.mapping_id
    WHERE (m.provider='MTGJSON/tcgplayer' AND e.metric='daily_retail_reference')
       OR (m.provider='MTGJSON/cardkingdom' AND e.metric='indicated_nm_buylist')
    ORDER BY m.variant_id,m.provider,m.condition_scope,e.window_start,e.captured_at DESC,e.id DESC
  ), bounded AS (
    SELECT *,max(source_date) OVER (PARTITION BY variant_id,provider,condition_scope) latest FROM daily
  ), ranked AS (
    SELECT *,row_number() OVER (PARTITION BY variant_id,provider,condition_scope,date_trunc('week',source_date AT TIME ZONE 'UTC') ORDER BY source_date DESC) week_rank,
      row_number() OVER (PARTITION BY variant_id,provider,condition_scope ORDER BY source_date) first_rank
    FROM bounded WHERE source_date>=latest-interval '90 days'
  ) SELECT variant_id,provider,condition_scope,numeric_value,source_date FROM ranked
    WHERE week_rank=1 OR first_rank=1 ORDER BY source_date`)
 ]);
 const stock=stockResult.rows[0] as unknown as {lots:number;copies:number}|undefined;
 const lots=lotsResult.rows as unknown as Lot[];
 const evidenceAsOf=iso((capturesResult.rows[0] as {latest:Date|string|null}|undefined)?.latest);
 if(!stock||!evidenceAsOf||lots.length!==stock.lots)throw new Error("Canonical inventory/evidence is unavailable or duplicated");
 const bidRows=bidsResult.rows as unknown as Evidence[];
 const direct=new Map<string,{price:Evidence;capacity:Evidence}>(),exported=new Map<string,{price:Evidence;capacity:Evidence}>(),scg=new Map<string,Evidence>();
 const grouped=new Map<string,Evidence[]>();
 for(const e of bidRows){
  const k=`${e.provider}|${e.variant_id}|${e.condition_scope}|${e.product_id}|${e.capture_id}|${e.mapping_id}`;
  if(!grouped.has(k))grouped.set(k,[]);grouped.get(k)!.push(e);
 }
 for(const rows of grouped.values()){
  const e=rows[0],k=key(e.variant_id,e.condition_scope),time=Date.parse(String(e.captured_at));
  if(e.provider==='TCGSentry/Star City Games'){
   const previous=scg.get(k);if(!previous||time>Date.parse(String(previous.captured_at)))scg.set(k,e);
   continue;
  }
  const price=rows.find(x=>x.metric==='public_cash_buylist_indication'||x.metric==='exported_ck_cash_buylist_indication');
  const capacity=rows.find(x=>x.metric==='public_max_wanted_quantity'||x.metric==='exported_ck_wanted_quantity');
  if(!price||!capacity)continue;
  const target=e.provider==='Card Kingdom/public_buylist'?direct:exported,previous=target.get(k);
  if(!previous||time>Date.parse(String(previous.price.captured_at)))target.set(k,{price,capacity});
 }
 const absent=new Set((absentResult.rows as unknown as Absent[]).map(x=>x.provider_subject));
 const asks=new Map((asksResult.rows as unknown as Ask[]).map(x=>[x.lot_id,x]));
 const tcg=new Map((tcgResult.rows as unknown as {variant_id:string;numeric_value:string;source_date:Date|string}[]).map(x=>[x.variant_id,x]));
 const imageRows=new Map((imagesResult.rows as unknown as ImageRow[]).map(x=>[x.variant_id,x]));
 const supply=new Map((supplyResult.rows as unknown as Supply[]).map(x=>[x.lot_id,Number(x.numeric_value)]));
 const histories=new Map<string,PricePoint[]>();
 for(const row of historyResult.rows as unknown as History[]){
  const historyKey=`${row.variant_id}|${row.provider}|${row.condition_scope}`,price=cents(row.numeric_value);
  if(price===null)continue;
  if(!histories.has(historyKey))histories.set(historyKey,[]);
  histories.get(historyKey)!.push({date:iso(row.source_date)!,cents:price});
 }
 const recentSales=new Map<string,PricePoint[]>();
 const now=Date.parse(evidenceAsOf),samples=new Map<string,number[]>();
 const activity=new Map<string,{all:number;last:Date|string|null;d30:number;d90:number}>();
 const saleRows=salesResult.rows as unknown as Sale[];
 const latestSaleCapture=new Map<string,{id:string;time:number}>();
 for(const sale of saleRows){
  const time=Date.parse(String(sale.captured_at)),prior=latestSaleCapture.get(sale.lot_id);
  if(!prior||time>prior.time||(time===prior.time&&sale.capture_id>prior.id))latestSaleCapture.set(sale.lot_id,{id:sale.capture_id,time});
 }
 for(const sale of saleRows){
  if(sale.capture_id!==latestSaleCapture.get(sale.lot_id)?.id)continue;
  const observed=Date.parse(String(sale.observed_at)),age=(now-observed)/86_400_000;
  const prior=activity.get(sale.lot_id)??{all:0,last:null,d30:0,d90:0};
  prior.all++;
  if(!prior.last||observed>Date.parse(String(prior.last)))prior.last=sale.observed_at;
  if(Number.isFinite(observed)&&age>=0&&age<=30)prior.d30++;
  if(Number.isFinite(observed)&&age>=0&&age<=90)prior.d90++;
  activity.set(sale.lot_id,prior);
  if(sale.quantity!==1||!Number.isFinite(observed)||age<0||age>120)continue;
  const price=cents(sale.numeric_value);if(price==null)continue;
  if(!recentSales.has(sale.lot_id))recentSales.set(sale.lot_id,[]);
  recentSales.get(sale.lot_id)!.push({date:iso(sale.observed_at)!,cents:price});
  if(!samples.has(sale.lot_id))samples.set(sale.lot_id,[]);samples.get(sale.lot_id)!.push(price);
 }
 const cards:ReviewCard[]=lots.map(lot=>{
  const proposal=lot.proposal;
  if(proposal&&(proposal.disposition!=="JUST_SELL_TO_BUYLIST"||proposal.status!=="analyst_recommendation_pending_owner_execution"||proposal.quantity!==lot.available_quantity))
   throw new Error(`Stored proposal/current stock mismatch for ${lot.lot_id}`);
  const k=key(lot.variant_id,lot.condition_normalized),notListed=absent.has(lot.lot_id);
  const ck=direct.get(k)??(notListed?undefined:exported.get(k));
  const ckSource=direct.has(k)?"direct_public":ck?"tcgsentry_export":null;
  const wanted=ck?.capacity.quantity??null;
  if(wanted!==null&&(!Number.isSafeInteger(wanted)||wanted<0))throw new Error("Invalid dealer wanted quantity");
  const ask=asks.get(lot.lot_id),tcgValue=tcg.get(lot.variant_id),sample=samples.get(lot.lot_id)??[];
  const scgValue=scg.get(k);
  const cardRef=imageRows.get(lot.variant_id),raw=cardRef?.raw,activityRow=activity.get(lot.lot_id);
  return {lotId:lot.lot_id,variantId:lot.variant_id,name:lot.name,setCode:lot.set_code,collectorNumber:lot.collector_number,finish:lot.finish,
   images:cardImages(cardRef),
   marketHistory:{tcg:histories.get(`${lot.variant_id}|MTGJSON/tcgplayer|not_applicable`)??[],
    ck:histories.get(`${lot.variant_id}|MTGJSON/cardkingdom|${lot.condition_normalized}`)??[]},
   recentSales:(recentSales.get(lot.lot_id)??[]).toSorted((a,b)=>a.date.localeCompare(b.date)),
   semantic:{traits:printingTraits(cardRef,lot.finish,lot.set_code),typeLine:raw?.type_line??null,
    edhrecRank:Number.isSafeInteger(raw?.edhrec_rank)?raw!.edhrec_rank!:null,releasedAt:raw?.released_at??null,
    observedSales30:activityRow?.d30??0,observedSales90:activityRow?.d90??0,
    saleSampleCapped:(activityRow?.all??0)>=20,latestObservedSaleAt:iso(activityRow?.last),
    competingQuantity:supply.get(lot.lot_id)??null},
   printedLanguage:lot.printed_language,grade:lot.condition_normalized,quantity:lot.available_quantity,
   proposal:proposal?"buylist":null,ckCents:cents(ck?.price.numeric_value),ckCapacity:wanted,ckSource,
   ckSourceDate:iso(ck?.price.captured_at),ckProductUrl:ckSource==='direct_public'?ck?.price.product_id??null:null,
   ckDirectNotListed:notListed,scgCents:cents(scgValue?.numeric_value),scgSourceDate:iso(scgValue?.captured_at),
   askCents:cents(ask?.numeric_value),askCapturedAt:iso(ask?.captured_at),medianCents:median(sample),sampleCount:sample.length,
   tcgCents:cents(tcgValue?.numeric_value),tcgSourceDate:iso(tcgValue?.source_date),
   optimisticNetCents:proposal?.source_snapshot.retail.optimistic_order_economics?.netCents??null,
   rationale:proposal?.rationale??null,counterargument:proposal?.counterargument??null};
 });
 const reviewed=lots.filter(x=>x.proposal),reviewedCopies=reviewed.reduce((sum,x)=>sum+x.available_quantity,0);
 const reviewedGrossCents=reviewed.reduce((sum,x)=>sum+(x.proposal?.gross_cents??0),0);
 if(reviewed.length!==run.input_manifest.reviewed_lots||reviewedCopies!==run.input_manifest.reviewed_copies||reviewedGrossCents!==run.input_manifest.reviewed_gross_cents)
  throw new Error("Saved review totals differ from run manifest");
 return {runId:run.id,asOf:evidenceAsOf,evidenceAsOf,reviewAsOf:run.input_manifest.report_as_of,
  inventoryLots:stock.lots,inventoryCopies:stock.copies,reviewedLots:reviewed.length,reviewedCopies,reviewedGrossCents,cards};
}
