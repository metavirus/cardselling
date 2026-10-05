export type Settings = { postage:number; tracked:number; materials:number; trackedMaterials?:number; batch:number; basis:"ask"|"median" };
export const shippingModelVersion='integrated-letter-v2';
// One-copy machinable <=1 oz scenario, pending packed-envelope calibration.
// Materials: 35c integrated envelope + 1c sleeve + 2c packing slip.
// Tracked postage/materials remain separate provisional allowances.
export const defaultSettings:Settings={postage:82,tracked:550,materials:38,trackedMaterials:25,batch:1000,basis:'median'};
export function migrateShippingSettings(settings:Settings,version?:string):Settings{
 if(version===shippingModelVersion)return settings;
 return {...settings,postage:settings.postage===135?82:settings.postage,materials:settings.materials===25?38:settings.materials,trackedMaterials:settings.trackedMaterials??settings.materials};
}
type CardPrices = {askCents:number|null;medianCents:number|null;ckCapacity:number|null;ckCents:number|null;quantity:number};
export function estimate(card:CardPrices, settings:Settings) {
  const price=settings.basis==="ask"?card.askCents:card.medianCents;
  if(price===null)return {price,net:null,gap:null,credit:0,marketFee:0,processing:0,postage:0,materials:settings.materials};
  const credit=price<6000?135:0;
  const marketFee=Math.round(price*.05),processing=Math.round((price+credit)*.029)+30;
  const postage=price<6000?settings.postage:settings.tracked;
  const materials=price<6000?settings.materials:settings.trackedMaterials??settings.materials;
  const net=price+credit-marketFee-processing-postage-materials;
  const usableBid=card.ckCapacity!==null&&card.ckCapacity>=card.quantity&&card.ckCents!==null&&card.ckCents>0;
  return {price,net,gap:usableBid?(net-card.ckCents!)*card.quantity:null,credit,marketFee,processing,postage,materials};
}
