import type {ReviewCard} from './review-data';
import {estimate,type Settings} from './selling-economics';
import {timingReadout} from './price-trends';

// A broad comparison screen, separate from authored channel/timing decisions.
export function buylistScreen(card:ReviewCard,settings:Settings,asOf:string,capacityConflict=false){
 const end=Date.parse(asOf),age=card.ckSourceDate===null?Infinity:(end-Date.parse(card.ckSourceDate))/86400000;
 const usable=(card.ckCents??0)>0&&card.ckCapacity!==null&&card.ckCapacity>=card.quantity&&!capacityConflict&&age>=0&&age<=7&&!timingReadout(card,asOf).conflict;
 const comparison=estimate(card,{...settings,basis:'median'});
 const gap=usable?comparison.gap:null;
 const history=card.marketHistory.ck.filter(p=>p.cents>0&&Date.parse(p.date)<=end&&Date.parse(p.date)>=end-90*86400000);
 const span=history.length?(Math.max(...history.map(p=>Date.parse(p.date)))-Math.min(...history.map(p=>Date.parse(p.date))))/86400000:0;
 const low=history.length?Math.min(...history.map(p=>p.cents)):null,high=history.length?Math.max(...history.map(p=>p.cents)):null;
 const position=span>=14&&low!==null&&high!==null&&high>low&&card.ckCents!==null?(card.ckCents-low)/(high-low):null;
 const recentPoints=card.recentSales.filter(p=>p.cents>0&&Date.parse(p.date)<=end&&Date.parse(p.date)>=end-30*86400000);
 const recent=recentPoints.map(p=>p.cents).sort((a,b)=>a-b);
 const recentMedian=recent.length?recent.length%2?recent[(recent.length-1)/2]:(recent[recent.length/2-1]+recent[recent.length/2])/2:null;
 const warnings:string[]=[];
 if(recentMedian!==null&&card.medianCents!==null&&recentMedian>card.medianCents*1.2)warnings.push(recent.length<3?'Recent higher sale · thin sample':'Recent sales above older median');
 const scenario=card.analystReview?.current?card.analystReview.priceScenario?.grossCents:null;
 if(scenario!=null&&card.medianCents!==null&&scenario>card.medianCents*1.2)warnings.push('AI uses a higher price test');
 if(card.analystReview?.current&&card.analystReview.channel==='patient_self_sale')warnings.push('AI favors patient self-sale');
 if(timingReadout(card,asOf).regime==='diverging')warnings.push('Bid weakening vs market');
 const netAt=(price:number)=>estimate({...card,medianCents:price},{...settings,basis:'median'}).net!;
 const repeatedHigher=recentMedian!==null&&card.medianCents!==null&&recentMedian>card.medianCents*1.2&&recent.length>=3&&new Set(recentPoints.map(p=>p.date.slice(0,10))).size>=2;
 const thinHigher=recentMedian!==null&&card.medianCents!==null&&recentMedian>card.medianCents*1.2&&!repeatedHigher;
 // Asking references only challenge certainty; they never become realized proceeds.
 const askAge=card.askCapturedAt?(end-Date.parse(card.askCapturedAt))/86400000:Infinity;
 const askGap=usable&&card.askCents!==null&&askAge>=0&&askAge<=7?(netAt(card.askCents)-card.ckCents!)*card.quantity:null;
 const supportedPrice=Math.max(card.medianCents??0,repeatedHigher?recentMedian!:0,scenario??0);
 const supportedGap=usable&&supportedPrice>0?(netAt(supportedPrice)-card.ckCents!)*card.quantity:null;
 let decision:'win'|'batch'|'review'|'self'='review',label='Check price evidence',icon='?',dollars:number|null=null;
 let basis='90-day sale median';
 if(repeatedHigher&&supportedPrice===recentMedian)basis='Repeated recent sale median';
 else if(scenario!=null&&supportedPrice===scenario)basis=card.analystReview!.priceScenario!.basis;
 if(usable&&supportedGap!==null){
  if(thinHigher){label='Check newer sales';icon='!';}
  else if(supportedGap>200){decision='self';label='Consider self-sale';icon='↗';dollars=supportedGap;}
  else if(askGap!==null&&askGap>200){label='Check current price';icon='!';}
  else if(timingReadout(card,asOf).regime==='diverging'){label='Recheck weakening bid';icon='!';}
  else if(supportedGap<=0){decision='win';label='Buylist wins';icon='✓';dollars=-supportedGap;}
  else {decision='batch';label='Easy batch addition';icon='▤';dollars=supportedGap;}
 }
 const explanation=decision==='review'&&thinHigher?'A higher recent sale could make the older median obsolete; the sample does not establish a repeatable price.':decision==='review'&&askGap!==null&&askGap>200?'Current asking reference offers more upside than the older sale median. Check completed sales before treating this as a buylist win.':`${basis}, recomputed with your current fees and shipping. Comparison covers the whole lot; dealer shipment cost is separate.`;
 return {decision,label,icon,dollars,basis,explanation,supportedGap,askGap,repeatedHigher,usable,gap,net:comparison.net,median:card.medianCents,competitive:gap!==null&&gap<=200,beatsNet:gap!==null&&gap<=0,nearHigh:position!==null&&position>=.8,position,low,high,recentMedian,recentCount:recent.length,warnings};
}
