export type Settings = { postage:number; tracked:number; materials:number; trackedMaterials?:number; trackedConsumables?:number; shippingMode?:'auto'|'tracked'; batch:number; basis:"ask"|"median" };
export const shippingModelVersion='letter-default-repair-v4';
// One-copy machinable <=1 oz scenario, pending packed-envelope calibration.
// Materials: 35c integrated envelope + 1c sleeve + 2c packing slip.
// Tracked postage/materials remain separate provisional allowances.
export const defaultSettings:Settings={postage:82,tracked:550,materials:38,trackedMaterials:40,trackedConsumables:5,shippingMode:'auto',batch:1000,basis:'median'};
export function migrateShippingSettings(settings:Settings,version?:string):Settings{
 if(version===shippingModelVersion)return settings;
 // Earlier clients stamped the old default pair as v2/v3 before migrating it.
 // Repair only that known pair; retain other explicitly customized costs.
 if((version==='tracked-pilot-v3'||version==='integrated-letter-v2')&&settings.postage===135&&settings.materials===25){
  return {...settings,postage:82,materials:38,trackedMaterials:settings.trackedMaterials===25?40:settings.trackedMaterials??40,trackedConsumables:settings.trackedConsumables??5,shippingMode:settings.shippingMode??'auto'};
 }
 const oldTracked=settings.trackedMaterials??settings.materials;
 return {...settings,postage:(version==='integrated-letter-v2'||version==='tracked-pilot-v3')?settings.postage:settings.postage===135?82:settings.postage,materials:(version==='integrated-letter-v2'||version==='tracked-pilot-v3')?settings.materials:settings.materials===25?38:settings.materials,trackedMaterials:oldTracked===25?40:oldTracked,trackedConsumables:settings.trackedConsumables??5,shippingMode:settings.shippingMode??'auto'};
}
type CardPrices = {askCents:number|null;medianCents:number|null;ckCapacity:number|null;ckCents:number|null;quantity:number};
export function estimate(card:CardPrices, settings:Settings) {
  const price=settings.basis==="ask"?card.askCents:card.medianCents;
  if(price===null)return {price,net:null,gap:null,credit:0,marketFee:0,processing:0,postage:0,materials:settings.materials};
  const tracked=price>=6000||settings.shippingMode==='tracked';
  const credit=price>=6000?0:tracked?649:135;
  const marketFee=Math.round(price*.05),processing=Math.round((price+credit)*.029)+30;
  const postage=tracked?settings.tracked:settings.postage;
  const materials=tracked?(settings.trackedMaterials??settings.materials)+(settings.trackedConsumables??0):settings.materials;
  const net=price+credit-marketFee-processing-postage-materials;
  const usableBid=card.ckCapacity!==null&&card.ckCapacity>=card.quantity&&card.ckCents!==null&&card.ckCents>0;
  return {price,net,gap:usableBid?(net-card.ckCents!)*card.quantity:null,credit,marketFee,processing,postage,materials};
}
