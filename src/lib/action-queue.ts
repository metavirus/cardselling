import type {ReviewCard} from './review-data';
import type {CardInsight} from './card-insights';
import {estimate,type Settings} from './selling-economics';
import {timingReadout} from './price-trends';

export type ActionKind='ck'|'quote'|'list'|'watch'|'verify';
export const actionLabels:Record<ActionKind,string>={ck:'Batch with CK',quote:'Cash quotes / add-ons',list:'List patiently',watch:'Hold / watch',verify:'Verify evidence'};
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
 const cashReady=quoteAge>=0&&quoteAge<=7&&(card.ckCents??0)>0&&!has('capacity')&&!timing.conflict;
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
  reason=kind==='verify'?'Confirm current exact-product cash, capacity or comparable evidence.':kind==='watch'?'CK is the preferred channel, but its weaker trajectory against a rising reference warrants a fresh timing comparison.':review.nextStep;
  const scenario=review.priceScenario?.grossCents;
  const reviewedNet=scenario==null?null:estimate({...card,medianCents:scenario},{...settings,basis:'median'}).net;
  const reviewedGap=cashReady&&reviewedNet!==null?(reviewedNet-card.ckCents!)*card.quantity:null;
  dollars=kind==='ck'?reviewedGap===null?null:-reviewedGap:kind==='list'?reviewedGap:null;
 }
 const label=kind==='quote'?(review?.current&&review.channel==='batch_bundle'?'Optional batch add-on':review?.current&&review.channel==='alternative_buylist'?'Compare other buylists':'Seek advance quote'):actionLabels[kind];
 return {kind,label,reason,dollars,timing:review?.current&&review.timing?review.timing:timing.title,alerts,comparisonBasis:review?.current&&review.priceScenario?review.priceScenario.basis:kind==='list'&&insight.upperExtra!==null?'Repeated higher-price band · scenario':'Captured sale median'};
}
