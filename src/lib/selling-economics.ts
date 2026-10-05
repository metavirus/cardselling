export type Settings = { postage:number; tracked:number; materials:number; batch:number; basis:"ask"|"median" };
type CardPrices = {askCents:number|null;medianCents:number|null;ckCapacity:number|null;ckCents:number|null;quantity:number};
export function estimate(card:CardPrices, settings:Settings) {
  const price=settings.basis==="ask"?card.askCents:card.medianCents;
  if(price===null)return {price,net:null,gap:null,credit:0,marketFee:0,processing:0,postage:0,materials:settings.materials};
  const credit=price<6000?135:0;
  const marketFee=Math.round(price*.05),processing=Math.round((price+credit)*.029)+30;
  const postage=price<6000?settings.postage:settings.tracked;
  const net=price+credit-marketFee-processing-postage-settings.materials;
  const usableBid=card.ckCapacity!==null&&card.ckCapacity>=card.quantity&&card.ckCents!==null&&card.ckCents>0;
  return {price,net,gap:usableBid?(net-card.ckCents!)*card.quantity:null,credit,marketFee,processing,postage,materials:settings.materials};
}
