import type {ReviewCard} from './review-data';
import {estimate,type Settings} from './selling-economics';
import {timingReadout} from './price-trends';

export const insightVersion='collection-synthesis-v1';
export const analysisDefaults:Settings={postage:135,tracked:550,materials:25,batch:1000,basis:'median'};
export type Finding={id:string;label:string;tone:'sell'|'opportunity'|'watch'|'neutral';detail:string};
export type CardInsight={version:string;headline:string;summary:string;nextStep:string;category:'dealer'|'patient'|'specialist'|'review'|'compare';confidence:'strong'|'moderate'|'limited';findings:Finding[];median:number|null;upperPrice:number|null;upperNet:number|null;upperExtra:number|null;breakEven:number|null;pairedSales:number;aboveReference:number;recentSales:number;priority:number};
const money=(n:number)=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(n/100);
const median=(v:number[])=>{const a=v.toSorted((x,y)=>x-y);return a.length?Math.round((a[Math.floor((a.length-1)/2)]+a[Math.floor(a.length/2)])/2):null;};
const day=(s:string)=>s.slice(0,10);
const age=(date:string,asOf:string)=>(Date.parse(asOf)-Date.parse(date))/86400000;

export function analyzeCard(card:ReviewCard,settings:Settings,asOf:string,collectionQuantity=card.quantity):CardInsight{
 const findings:Finding[]=[];
 const timing=timingReadout(card,asOf);
 const sales=card.recentSales.filter(p=>p.cents>0&&Number.isFinite(p.cents)&&age(p.date,asOf)>=0&&age(p.date,asOf)<=90);
 const recent=sales.filter(p=>age(p.date,asOf)<=30),values=sales.map(p=>p.cents),mid=median(values);
 const quoteFresh=card.ckSourceDate!==null&&age(card.ckSourceDate,asOf)>=0&&age(card.ckSourceDate,asOf)<=7;
 const ckReady=quoteFresh&&(card.ckCents??0)>0&&(card.ckCapacity??0)>=collectionQuantity;
 const priceNet=(price:number)=>estimate({...card,medianCents:price},{...settings,basis:'median'}).net!;
 const net=mid===null?null:priceNet(mid);
 // An upper cluster is a scenario supported by repeated recent transactions, not a maximum sale.
 const candidates=values.toSorted((a,b)=>b-a).map(floor=>sales.filter(p=>p.cents>=floor&&p.cents<=floor*1.2));
 const upper=candidates.find(group=>mid!==null&&median(group.map(p=>p.cents))!>=mid*1.1&&group.length>=3&&new Set(group.map(p=>day(p.date))).size>=3&&group.filter(p=>age(p.date,asOf)<=30).length>=2)??[];
 const upperRecent=upper.filter(p=>age(p.date,asOf)<=30);
 const repeated=upper.length>=3;
 const upperPrice=repeated?median(upper.map(p=>p.cents)):null;
 const upperNet=upperPrice===null?null:priceNet(upperPrice);
 const upperExtra=upperNet!==null&&ckReady?(upperNet-card.ckCents!)*card.quantity:null;
 const mp=new Map((card.marketHistory.manaPoolRetail??[]).map(p=>[day(p.date),p.cents]));
 const paired=sales.filter(p=>mp.has(day(p.date))&&mp.get(day(p.date))!>0);
 const above=paired.filter(p=>p.cents>=mp.get(day(p.date))!*1.2);
 const ratios=above.map(p=>p.cents/mp.get(day(p.date))!);
 if(above.length>=3&&new Set(above.map(p=>day(p.date))).size>=3){
  findings.push({id:'sales-above-reference',label:'Repeated sales above reference',tone:'opportunity',detail:`${above.length} of ${paired.length} sales with a same-day Mana Pool reference sold at least 20% higher. The median premium among those sales was ${Math.round((median(ratios.map(x=>x*1000))!/1000-1)*100)}%. ${above.filter(p=>age(p.date,asOf)<=30).length} occurred in the last 30 days. The condition-unspecified reference is lower than these same-grade transactions; use the sale distribution when pricing.`});
 }
 const latestRef=(p:{date:string;cents:number}[])=>p.filter(x=>x.cents>0&&age(x.date,asOf)>=0&&age(x.date,asOf)<=7).toSorted((a,b)=>a.date.localeCompare(b.date)).at(-1)?.cents??null;
 const tcg=latestRef(card.marketHistory.tcg),mpNow=latestRef(card.marketHistory.manaPoolRetail??[]);
 const robustSales=sales.length>=5&&recent.length>=3&&new Set(sales.map(p=>day(p.date))).size>=3;
 const saleCeiling=robustSales?Math.max(...values):null;
 const prevailing=[tcg,mpNow,saleCeiling].filter((x):x is number=>x!==null);
 const dominant=!timing.conflict&&ckReady&&robustSales&&tcg!==null&&mpNow!==null&&prevailing.every(p=>card.ckCents!>=p*1.1);
 const bestCapturedNet=robustSales?Math.max(...values.map(priceNet)):null;
 const netDominant=!timing.conflict&&ckReady&&robustSales&&(card.ckCents??0)>=100&&bestCapturedNet!==null&&card.ckCents!>=bestCapturedNet*1.1;
 if(netDominant&&!dominant)findings.push({id:'dealer-net-dominates',label:'SELL · CK beats captured self-sale net',tone:'sell',detail:`CK pays ${money(card.ckCents!)} per copy. The best modeled net across captured sale prices is ${money(bestCapturedNet!)} after one-copy-order costs (highest captured gross ${money(saleCeiling!)}). CK adds ${money((card.ckCents!-bestCapturedNet!)*card.quantity)} across this lot versus that high-sale scenario, while saving fulfillment work. Verify the bid and share dealer shipping across a batch.`});
 if(dominant)findings.push({id:'dealer-dominates',label:'SELL · CK above captured market',tone:'sell',detail:`CK's ${money(card.ckCents!)} cash bid exceeds even the highest captured 90-day sale (${money(saleCeiling!)}) and both recent TCG (${money(tcg!)}) and Mana Pool (${money(mpNow!)}) references by at least 10%. ${card.ckCapacity} wanted covers all ${collectionQuantity} copies of this variant/grade in your collection. This is a compelling current offer to verify and batch.`});
 else if(ckReady&&robustSales&&mid!==null&&card.ckCents!>=mid*1.1)findings.push({id:'dealer-above-median',label:'CK above typical captured sale',tone:'sell',detail:`CK pays ${money(card.ckCents!)} versus a ${money(mid)} captured-sale median before self-sale costs. ${saleCeiling!==null&&saleCeiling>card.ckCents!?`The highest captured sale was ${money(saleCeiling)}; the bid does not beat every transaction. `:''}Its wanted quantity covers your collection's ${collectionQuantity} copies.`});
 if(upperPrice!==null)findings.push({id:'upper-cluster',label:'Repeated higher-price sales',tone:'opportunity',detail:`${upper.length} sales on ${new Set(upper.map(p=>day(p.date))).size} days in a ${money(Math.min(...upper.map(p=>p.cents)))}–${money(Math.max(...upper.map(p=>p.cents)))} band support an upper-range scenario at ${money(upperPrice)}; ${upperRecent.length} were within 30 days. That models ${money(upperNet!)} net per copy${upperExtra===null?'':`, ${upperExtra>=0?'adding':'losing'} ${money(Math.abs(upperExtra))} across your lot versus CK`}. This is a patient-listing test price, not an expected average or promised outcome.`});
 findings.push({id:'timing',label:timing.title,tone:timing.regime==='diverging'?'watch':'neutral',detail:timing.reason+(timing.marketContext?` ${timing.marketContext}.`:'')});
 if(timing.conflict)findings.push({id:'quote-conflict',label:'Dealer sources disagree',tone:'watch',detail:timing.conflict});
 if((card.scgCents??0)>(card.ckCents??0)&&card.scgSourceDate&&age(card.scgSourceDate,asOf)<=7)findings.push({id:'scg-higher',label:'Higher SCG quote to check',tone:'opportunity',detail:`SCG indicates ${money(card.scgCents!)} per copy${card.ckCents!==null?`, ${money((card.scgCents!-card.ckCents)*card.quantity)} more across this lot than CK`:''}. Confirm buying quantity before treating it as a whole-lot option.`});
 if(!ckReady)findings.push({id:'capacity',label:quoteFresh?'CK does not cover this holding':'Refresh the CK offer',tone:'watch',detail:quoteFresh?`${card.ckCapacity??'Unknown'} wanted versus ${collectionQuantity} copies of this variant/grade across your collection. A quoted price alone does not establish an available whole-lot exit.`:'A compatible CK quote from the last seven days is needed for a current cash comparison.'});
 const older=sales.filter(p=>age(p.date,asOf)>30);
 if(recent.length>=5&&older.length>=5&&new Set(recent.map(p=>day(p.date))).size>=3&&new Set(older.map(p=>day(p.date))).size>=3){
  const recentMedian=median(recent.map(p=>p.cents))!,olderMedian=median(older.map(p=>p.cents))!,change=Math.round((recentMedian/olderMedian-1)*100);
  if(Math.abs(change)>=10)findings.push({id:'sale-shift',label:change>0?'Recent sale sample strengthened':'Recent sale sample weakened',tone:change>0?'opportunity':'watch',detail:`The last-30-day captured median is ${money(recentMedian)} from ${recent.length} transactions, versus ${money(olderMedian)} from ${older.length} transactions in days 31–90 (${change>0?'+':''}${change}%). This compares transaction samples, not a complete market index. Recheck recent pricing before anchoring to the full-window median.`});
 }
 const special=card.semantic.traits.length>0;
 if(special)findings.push({id:'printing',label:'Exact-treatment buyer fit',tone:'neutral',detail:`${card.semantic.traits.join(', ')} · ${card.finish==='normal'?'nonfoil':card.finish}. ${sales.length?`${sales.length} exact-product, same-grade single-copy transactions provide printing-specific evidence.`:'No comparable single-copy sale was captured in this window.'} ${card.semantic.edhrecRank!==null?`EDHREC rank #${card.semantic.edhrecRank.toLocaleString()} provides functional-card play context; it does not establish this treatment's premium.`:''} ${!robustSales?'Seek exact-treatment comps or a specialist MagicCon quote before valuing a collector premium.':'A specialist buyer is worth comparing when the dollar premium justifies the effort.'}`});
 if(!robustSales)findings.push({id:'thin-sales',label:'Limited recent sale evidence',tone:'watch',detail:`${sales.length} comparable sales in 90 days, ${recent.length} in 30 days. ${card.askCents!==null?`The captured ask is ${money(card.askCents)}.`:'No compatible asking price is captured.'} A few sales or an asking price cannot support a confident expected sale price.`});
 const gap=ckReady&&net!==null?(net-card.ckCents!)*card.quantity:null;
 let category:CardInsight['category']='compare',headline='Compare the available channels',nextStep='Check a current buyer quote against comparable sale proceeds.';
 if(timing.conflict){category='review';headline='Resolve the conflicting dealer quote';nextStep='Open the exact dealer product and verify its cash bid before acting.';}
 else if(dominant||netDominant){category='dealer';headline=dominant?'Compelling CK cash opportunity':'CK beats even the high-sale net scenario';nextStep='Verify the exact bid and wanted quantity, then include this lot in a worthwhile dealer batch.';}
 else if(upperExtra!==null&&upperExtra>=1500){category='patient';headline='Patient self-sale has meaningful upside';nextStep=`Test ${money(upperPrice!)} per copy, grounded in repeated sales; review results before lowering the price.`;}
 else if(ckReady&&robustSales&&gap!==null&&gap<1500&&(upperExtra===null||upperExtra<1500)){category='dealer';headline=timing.regime==='diverging'?'Buylist fits; timing deserves a look':'Buylist saves work for little sacrifice';nextStep=timing.regime==='diverging'?'Compare the recent sale direction before accepting a bid; there is no cash deadline.':'Verify the bid and batch this with other dealer sales; the observed upside does not justify a separate listing.';}
 else if(robustSales&&net!==null&&((gap!==null&&gap>=1500)||(!ckReady&&net*card.quantity>=3000))){category='patient';headline='Comparable sales support self-selling';nextStep=`Use the ${money(mid!)} captured median as a starting comparison and test a listing if the extra dollars justify fulfillment.`;}
 else if(special&&((card.askCents??0)>=5000||(mid??0)>=5000)){category='specialist';headline='Compare specialist and MagicCon offers';nextStep='Get an exact-treatment cash quote, with current dealer proceeds as your fallback.';}
 else if(!robustSales||!ckReady){category='review';headline='Evidence needs a targeted check';}
 let breakEven:number|null=null;
 if(ckReady){
  const crossings:number[]=[];
  for(const [floor,ceiling] of [[1,5999],[6000,Math.max(100000,card.ckCents!*2)]]){
   if(priceNet(ceiling)<card.ckCents!)continue;
   let low=floor,high=ceiling;
   while(low<high){const m=Math.floor((low+high)/2);if(priceNet(m)>=card.ckCents!)high=m;else low=m+1;}
   crossings.push(low);
  }
  breakEven=crossings.length?Math.min(...crossings):null;
 }
 const economics=mid===null?'No recent comparable sale median is available.':`The 90-day sale median is ${money(mid)}, modeling ${money(net!)} net per copy. ${gap===null?'A fully covered current CK comparison is unavailable.':`Across ${card.quantity} ${card.quantity===1?'copy':'copies'}, that is ${gap>=0?money(gap)+' more':money(-gap)+' less'} than CK.`}`;
 const summary=`${economics} ${upperExtra!==null&&upperExtra>0&&upperExtra<1500?`Even the repeated higher-price scenario adds only ${money(upperExtra)} across this lot; avoid chasing that small margin. `:''}${special?'The printing treatment matters, so generic card popularity alone should not drive the decision. ':''}${recent.length} comparable sales were captured in the last 30 days${card.semantic.competingQuantity!==null?` against ${card.semantic.competingQuantity} currently listed same-grade copies`:''}.`;
 const confidence:CardInsight['confidence']=dominant||netDominant?'strong':robustSales&&quoteFresh&&!timing.conflict?'moderate':'limited';
 // Sorting groups compelling cases first; no opaque blended confidence score.
 const priority=dominant||netDominant?5:category==='patient'?4:findings.some(f=>f.id==='sales-above-reference')?3:category==='specialist'?2:category==='dealer'?1:0;
 return {version:insightVersion,headline,summary,nextStep,category,confidence,findings,median:mid,upperPrice,upperNet,upperExtra,breakEven,pairedSales:paired.length,aboveReference:above.length,recentSales:recent.length,priority};
}

export function analyzeCollection(cards:ReviewCard[],settings:Settings,asOf:string){
 const holdings=new Map<string,number>();
 for(const c of cards){const k=(c.printingKey??c.variantId)+'|'+c.grade;holdings.set(k,(holdings.get(k)??0)+c.quantity);}
 return new Map(cards.map(c=>[c.lotId,analyzeCard(c,settings,asOf,holdings.get((c.printingKey??c.variantId)+'|'+c.grade))]));
}
