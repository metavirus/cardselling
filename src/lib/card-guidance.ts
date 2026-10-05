import type {ReviewCard} from "./review-data";
type Plan="undecided"|"buylist"|"self"|"event"|"hold";
const cash=(n:number|null)=>n===null?"—":new Intl.NumberFormat("en-US",{style:"currency",currency:"USD"}).format(n/100);
// These prompts prioritize the next comparison. They do not assign owner plans.
export function cardGuidance(card:ReviewCard,e:{net:number|null;gap:number|null},sample:{net:number|null},basis:"ask"|"median") {
 const ckReady=card.ckCents!==null&&card.ckCents>0&&(card.ckCapacity??0)>=card.quantity;
 const scgHigher=card.scgCents!==null&&card.scgCents>0&&(!ckReady||card.scgCents>(card.ckCents??0));
 const dealer=scgHigher?card.scgCents:ckReady?card.ckCents:null,dealerName=scgHigher?"SCG":"CK";
 const gap=e.net!==null&&dealer!==null?(e.net-dealer)*card.quantity:null;
 const sampleGap=sample.net!==null&&dealer!==null?(sample.net-dealer)*card.quantity:null;
 const sampleCkGap=sample.net!==null&&ckReady?(sample.net-card.ckCents!)*card.quantity:null;
 const premium=card.semantic.traits.length>0&&(card.askCents??0)>=5000;
 const thin=card.semantic.observedSales90<5;
 let title="Get a firm buyer quote",reason="Compare a buyer's offer with the self-sale proceeds below before choosing a route.",suggested:Plan="undecided",tone="research";
 if(premium&&thin){title="Compare collector offers first";reason=`${dealer!==null?`${dealerName} indicates ${cash(dealer)}. `:""}${card.askCents!==null?`The ${cash(card.askCents)} ask has `:"There is "}${card.semantic.observedSales90} captured sale${card.semantic.observedSales90===1?"":"s"} in 90 days. Get exact-treatment comps and a MagicCon quote before accepting a dealer bid.`;suggested="event";}
 else if(scgHigher&&dealer!==null&&card.sampleCount>=5&&sampleGap!==null&&sampleGap<1500){title="Check the higher SCG offer";reason=`SCG indicates ${cash(dealer)} per copy${ckReady?`, ${cash((dealer-card.ckCents!)*card.quantity)} more for your lot than CK`:""}. Confirm how many they want; the sampled self-sale comparison leaves little extra for the work.`;suggested="buylist";tone="buylist";}
 else if(ckReady&&((sampleCkGap!==null&&card.sampleCount>=5&&sampleCkGap<1500)||(e.gap!==null&&e.gap<=500))){
  const useSample=sampleCkGap!==null&&card.sampleCount>=5&&sampleCkGap<1500;
  const extra=useSample?sampleCkGap!:e.gap!;
  const label=useSample||basis==="median"?"sampled-sale":"current-ask";
  title="Keep this one simple: buylist";
  reason=extra<=0?`At ${label} pricing, CK pays ${cash(-extra)} more across your lot. Buylisting also saves listing, packing and fulfillment work.`:`At ${label} pricing, self-selling adds just ${cash(extra)} across your lot versus CK. That is a small reward for listing, packing and fulfillment.`;
  suggested="buylist";tone="buylist";
 }
 else if(card.sampleCount>=5&&card.semantic.observedSales90>=5&&sample.net!==null&&((sampleGap!==null&&sampleGap>=1500)||(dealer===null&&sample.net*card.quantity>=3000))){title="Self-sale is worth considering";reason=`The sampled-sale median models ${cash(sample.net)} net per copy${sampleGap!==null?`—${cash(sampleGap)} extra across your lot versus ${dealerName}${scgHigher?"'s unconfirmed quote":""}`:""}. ${card.semantic.observedSales90} captured sales in 90 days support testing a listing.`;suggested="self";tone="self";}
 else if(premium){title="Take this printing to specialist buyers";reason=`Compare a MagicCon cash quote with ${e.net!==null?`${cash(e.net)} modeled self-sale net`:"recent exact-treatment sales"}. The treatment gives you a reason to seek a collector-focused buyer.`;suggested="event";}
 return {title,reason,suggested,tone,ckReady,scgHigher,dealer,dealerName,gap};
}
