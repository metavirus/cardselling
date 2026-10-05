export type HistoryPoint={date:string;cents:number};
export function summarizePriceTrend(points:HistoryPoint[]){
 const sorted=points.filter(p=>Number.isFinite(Date.parse(p.date))&&Number.isFinite(p.cents)&&p.cents>0).toSorted((a,b)=>Date.parse(a.date)-Date.parse(b.date));
 const first=sorted[0]??null,latest=sorted.at(-1)??null;
 return {points:sorted,first,latest,changePercent:first&&latest&&sorted.length>1?Math.round((latest.cents/first.cents-1)*100):null};
}
const money=(n:number)=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(n/100);
type TimingCard={ckCents:number|null;ckSourceDate:string|null;marketHistory:{ck:HistoryPoint[];tcg:HistoryPoint[];manaPoolRetail?:HistoryPoint[]}};
export function priceRegime(ckChange:number|null,tcgChange:number|null){
 if(ckChange===null||tcgChange===null)return "limited";
 if(ckChange<0&&tcgChange>0)return "diverging";
 if(ckChange>0&&tcgChange<=5)return "dealer_strengthening";
 return "mixed";
}
const utcDay=(s:string|null)=>s&&Number.isFinite(Date.parse(s))?new Date(s).toISOString().slice(0,10):null;
const dateLabel=(s:string,timeZone="UTC")=>new Date(s).toLocaleDateString("en-US",{month:"short",day:"numeric",timeZone});
export function timingReadout(card:TimingCard,asOf:string,days=90){
 const end=Date.parse(asOf),start=end-days*86400000;
 const window=(p:HistoryPoint)=>Date.parse(p.date)>=start&&Date.parse(p.date)<=end;
 const ckRaw=summarizePriceTrend(card.marketHistory.ck.filter(window)),tcgRaw=summarizePriceTrend(card.marketHistory.tcg.filter(window));
 // Pair only observed calendar days. Never fill a missing provider observation.
 const ckDays=new Map(ckRaw.points.map(p=>[utcDay(p.date)!,p]));
 const tcgDays=new Map(tcgRaw.points.map(p=>[utcDay(p.date)!,p]));
 const sharedDays=[...ckDays.keys()].filter(d=>tcgDays.has(d)).sort();
 const ck=summarizePriceTrend(sharedDays.map(d=>({date:d,cents:ckDays.get(d)!.cents}))),tcg=summarizePriceTrend(sharedDays.map(d=>({date:d,cents:tcgDays.get(d)!.cents})));
 const spanDays=sharedDays.length>1?Math.round((Date.parse(sharedDays.at(-1)!)-Date.parse(sharedDays[0]))/86400000):0;
 const minimumSpan=days<=30?7:14;
 const spanLabel=spanDays?`${dateLabel(sharedDays[0])}–${dateLabel(sharedDays.at(-1)!)} (${spanDays} days)`:null;
 const mpDays=new Map(summarizePriceTrend((card.marketHistory.manaPoolRetail??[]).filter(window)).points.map(p=>[utcDay(p.date)!,p]));
 const mpShared=sharedDays.filter(d=>mpDays.has(d));
 const mpSpan=mpShared.length>1?(Date.parse(mpShared.at(-1)!)-Date.parse(mpShared[0]))/86400000:0;
 const mp=mpSpan>=minimumSpan?summarizePriceTrend(mpShared.map(d=>({date:d,cents:mpDays.get(d)!.cents}))):null;
 const marketContext=mp?.changePercent!==null&&mp?.changePercent!==undefined?`Mana Pool retail reference ${mp.changePercent>=0?"+":""}${mp.changePercent}% · ${dateLabel(mpShared[0])}–${dateLabel(mpShared.at(-1)!)}`:null;
 const latest=ckRaw.latest;
 const unequal=latest&&card.ckCents!==null&&latest.cents!==card.ckCents;
 const sameDay=latest&&utcDay(card.ckSourceDate)!==null&&utcDay(card.ckSourceDate)===utcDay(latest.date);
 const conflict=unequal&&sameDay?`Same-day CK sources differ: captured quote ${money(card.ckCents!)} · history ${money(latest!.cents)}. Verify the quote before acting.`:null;
 const datedDifference=unequal&&!sameDay?`CK quote ${money(card.ckCents!)}${card.ckSourceDate?` (${dateLabel(card.ckSourceDate,"America/Los_Angeles")})`:""} · history ${money(latest!.cents)} (${dateLabel(latest!.date)}). Separate dated observations.`:null;
 const regime=spanDays<minimumSpan?"limited":priceRegime(ck.changePercent,tcg.changePercent);
 const period=spanLabel?`Across shared dates ${spanLabel}, `:"";
 if(regime==="limited")return {title:'Timing evidence is limited',reason:`${spanLabel?`Shared dates cover ${spanLabel}. `:""}Compare the available quotes and sales; at least ${minimumSpan} days of shared CK and TCG history are needed to judge their direction together.`,conflict,datedDifference,regime,marketContext};
 if(regime==="dealer_strengthening")return {title:'Dealer bid strengthened against TCG',reason:`${period}CK history rose ${ck.changePercent}% while the TCG reference ${(tcg.changePercent??0)<0?`fell ${Math.abs(tcg.changePercent??0)}%`:`changed +${tcg.changePercent}%`}. This strengthens the CK offer relative to that reference.`,conflict,datedDifference,regime,marketContext};
 if(regime==="diverging")return {title:'Channel and timing point in different directions',reason:`${period}CK history fell ${Math.abs(ck.changePercent??0)}% while the TCG reference rose ${tcg.changePercent}%. A buylist may still pay best today; this history does not establish that today is the best time to sell.`,conflict,datedDifference,regime,marketContext};
 return {title:'Timing remains a separate decision',reason:`${period}CK history ${(ck.changePercent??0)>=0?'rose':'fell'} ${Math.abs(ck.changePercent??0)}% and the TCG reference ${(tcg.changePercent??0)>=0?'rose':'fell'} ${Math.abs(tcg.changePercent??0)}%. Compare the latest sales with the current quote before choosing when to sell.`,conflict,datedDifference,regime,marketContext};
}
