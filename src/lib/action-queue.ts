import type {ReviewCard} from './review-data';
import type {CardInsight} from './card-insights';
import {estimate,type Settings} from './selling-economics';
import {timingReadout} from './price-trends';
import {buylistScreen} from './buylist-screen';

export type ActionKind='ck'|'quote'|'list'|'watch'|'verify';
export const actionLabels:Record<ActionKind,string>={ck:'Batch with CK',quote:'Cash quotes / add-ons',list:'List patiently',watch:'Hold / watch',verify:'Needs a closer comparison'};
export type ActionReadout={kind:ActionKind;label:string;reason:string;dollars:number|null;timing:string;alerts:string[];comparisonBasis:string};
// A next research/action queue, never an owner plan or a sale instruction.
export function actionFor(card:ReviewCard,insight:CardInsight,settings:Settings,asOf:string):ActionReadout{
 const timing=timingReadout(card,asOf),has=(id:string)=>insight.findings.some(f=>f.id===id);
 const net=estimate(card,{...settings,basis:'median'}).net;
 const gap=card.ckCents!==null&&net!==null&&!has('capacity')?(net-card.ckCents)*card.quantity:null;
 const alerts:string[]=[];
 const end=Date.parse(asOf),history=card.marketHistory.ck.filter(p=>p.cents>0&&Date.parse(p.date)<=end&&Date.parse(p.date)>=end-90*86400000);
 const span=history.length?(Math.max(...history.map(p=>Date.parse(p.date)))-Math.min(...history.map(p=>Date.parse(p.date))))/86400000:0;
 const peak=history.length?Math.max(...history.map(p=>p.cents)):null;
 const quoteAge=card.ckSourceDate===null?Infinity:(end-Date.parse(card.ckSourceDate))/86400000;
 if(quoteAge>=0&&quoteAge<=7&&span>=14&&peak!==null&&card.ckCents!==null&&card.ckCents>=peak*.95)alerts.push('CK near captured 90-day high');
 if(timing.regime==='dealer_strengthening')alerts.push('Dealer bid gaining against market');
 if(has('sales-above-reference'))alerts.push('Repeated sales above reference');
 if(insight.findings.some(f=>f.id==='sale-shift'&&f.tone==='watch'))alerts.push('Recent sale sample weakened');
 let kind:ActionKind='verify',reason='Check the missing current cash or comparable sale evidence.';
 if(timing.conflict){reason='Resolve the conflicting dealer evidence before choosing a channel.';}
 else if(has('dealer-history-candidate')){reason='History favors CK; confirm current cash and wanted quantity.';}
 else if(insight.category==='dealer'&&timing.regime==='diverging'){kind='watch';reason='CK is the easier channel, but its bid weakened while the market reference rose. Recheck before releasing the card.';}
 else if(insight.category==='dealer'){kind='ck';reason=has('dealer-dominates')||has('dealer-net-dominates')?'CK beats captured selling alternatives; verify and combine into a shipment.':'Self-sale adds little under current costs; confirm the bid and batch.';}
 else if(insight.category==='patient'){kind='list';reason='Captured sales support a patient listing test; compare the extra whole-lot proceeds.';}
 else if(insight.category==='specialist'){kind='quote';reason='Seek an exact-treatment advance cash offer; buyer acceptance remains unconfirmed.';}
 const review=card.analystReview;
 const cashReady=quoteAge>=0&&quoteAge<=7&&(card.ckCents??0)>0&&card.ckCapacity!==null&&card.ckCapacity>=card.quantity&&!has('capacity')&&!timing.conflict;
 let dollars=kind==='ck'?gap===null?null:-gap:kind==='list'?insight.upperExtra??gap:null;
 // Current authored judgment can recognize a newer price regime that a full-window
 // median misses. It cannot bypass a missing/stale/shared-capacity dealer gate.
 if(review?.current&&review.channel){
  if(review.channel==='ck_buylist'){kind=cashReady?(timing.regime==='diverging'?'watch':'ck'):'verify';}
  else if(review.channel==='patient_self_sale'){kind=card.recentSales.length||card.askCents!==null?'list':'verify';}
  else if(['magiccon_quote','alternative_buylist','batch_bundle','advance_quote'].includes(review.channel)){kind='quote';}
  else if(['hold','hold_watch'].includes(review.channel)){kind='watch';}
  else if(review.channel==='verify'){kind='verify';}
  if(timing.conflict)kind='verify';
  reason=kind==='verify'?'Confirm current exact-product cash, capacity or comparable evidence.':kind==='watch'&&review.channel==='ck_buylist'?'CK is the preferred channel, but its weaker trajectory against a rising reference warrants a fresh timing comparison.':review.nextStep;
  const scenario=review.priceScenario?.grossCents;
  const reviewedNet=scenario==null?null:estimate({...card,medianCents:scenario},{...settings,basis:'median'}).net;
  const reviewedGap=cashReady&&reviewedNet!==null?(reviewedNet-card.ckCents!)*card.quantity:null;
  dollars=kind==='ck'?reviewedGap===null?null:-reviewedGap:kind==='list'?reviewedGap:null;
 }
 let label=kind==='quote'?(review?.current&&review.channel==='batch_bundle'?'Optional batch add-on':review?.current&&review.channel==='alternative_buylist'?'Compare other buylists':'Seek advance quote'):actionLabels[kind];
 if(kind==='verify'){
  dollars=null;
  if(timing.conflict){label='Confirm CK quote';reason=timing.conflict;}
  else if(card.ckCents===null){label='No current CK quote';reason='A current exact-product cash bid is missing; this does not mean the card has no market data.';}
  else if(card.ckCapacity===0){label='CK not currently buying';reason='The captured CK buying quantity is zero.';}
  else if(card.ckCapacity===null){label='Confirm CK buying quantity';reason='A cash bid is captured, but the quantity CK will accept is unknown.';}
  else if(card.ckCapacity<card.quantity||has('capacity')){label='CK cannot cover this lot';reason='Captured buying capacity does not cover the lot or the shared copies competing for that capacity.';}
  else if(quoteAge<0||quoteAge>7){label='Refresh CK quote';reason='The CK quote is undated or outside the seven-day freshness window.';}
  else if(card.medianCents===null){label='No comparable sale samples';reason='The cash quote is available, but a compatible sale median is missing. Asking prices remain a separate comparison.';}
  else {
   const screen=buylistScreen(card,settings,asOf,has('capacity'));
   if(screen.decision==='win'||screen.decision==='batch'){
    label=screen.decision==='win'?'CK favored · limited evidence':'Small self-sale upside';
    reason=`${screen.basis} favors ${screen.decision==='win'?'CK':'a convenience tradeoff'}, but the broader analysis remains cautious. ${insight.recentSales??0} comparable sales captured in 30 days; inspect the sale distribution before treating the median as definitive.`;
   }else if(screen.label!=='Check price evidence'){label=screen.label;reason=screen.explanation;}
   else {label='Compare cash and sale evidence';reason='Both cash and market data are available; the captured patterns do not establish a clear channel preference.';}
  }
 }
 return {kind,label,reason,dollars,timing:review?.current&&review.timing?review.timing:timing.title,alerts,comparisonBasis:review?.current&&review.priceScenario?review.priceScenario.basis:kind==='list'&&insight.upperExtra!==null?'Repeated higher-price band · scenario':'Captured sale median'};
}

