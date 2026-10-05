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
 const recent=card.recentSales.filter(p=>Date.parse(p.date)<=end&&Date.parse(p.date)>=end-30*86400000).map(p=>p.cents).sort((a,b)=>a-b);
 const recentMedian=recent.length?recent.length%2?recent[(recent.length-1)/2]:(recent[recent.length/2-1]+recent[recent.length/2])/2:null;
 const warnings:string[]=[];
 if(recentMedian!==null&&card.medianCents!==null&&recentMedian>card.medianCents*1.2)warnings.push(recent.length<3?'Recent higher sale · thin sample':'Recent sales above older median');
 const scenario=card.analystReview?.current?card.analystReview.priceScenario?.grossCents:null;
 if(scenario!=null&&card.medianCents!==null&&scenario>card.medianCents*1.2)warnings.push('AI uses a higher price test');
 if(card.analystReview?.current&&card.analystReview.channel==='patient_self_sale')warnings.push('AI favors patient self-sale');
 if(timingReadout(card,asOf).regime==='diverging')warnings.push('Bid weakening vs market');
 return {usable,gap,net:comparison.net,median:card.medianCents,competitive:gap!==null&&gap<=200,beatsNet:gap!==null&&gap<=0,nearHigh:position!==null&&position>=.8,position,low,high,recentMedian,recentCount:recent.length,warnings};
}
