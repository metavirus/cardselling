// Money in integer cents. Inputs describe one proposed order, not one card in isolation.
import assert from 'node:assert/strict';
function money(value,name){assert.ok(Number.isSafeInteger(value)&&value>=0,`${name} must be nonnegative integer cents`);return value;}
export function manaPoolOrder({items,shippingCreditCents,postageCents=null,materialsCents=null,lossReserveCents=null,activeMinutes=null}) {
 assert.ok(Array.isArray(items)&&items.length>0,'At least one order line is required');
 const merchandise=items.reduce((sum,item)=>sum+money(item.unitPriceCents,'unitPriceCents')*money(item.quantity,'quantity'),0);
 assert.ok(items.every(i=>i.quantity>0),'Quantities must be positive');
 money(merchandise,'merchandise');money(shippingCreditCents,'shippingCreditCents');
 // Published 5% item fee cap still needs rebate until automated. Keep the
 // ordinary charge and possible cap rebate separate.
 const marketplaceFee=items.reduce((sum,item)=>sum+item.quantity*Math.round(item.unitPriceCents*0.05),0);
 const capRebate=items.reduce((sum,item)=>sum+item.quantity*Math.max(0,Math.round(item.unitPriceCents*0.05)-5000),0);
 const processingEstimate=Math.round((merchandise+shippingCreditCents)*0.029)+30;
 const beforeFulfillment=merchandise+shippingCreditCents-marketplaceFee-processingEstimate;
 const costs=[postageCents,materialsCents,lossReserveCents];
 costs.forEach((v,i)=>{if(v!==null)money(v,['postageCents','materialsCents','lossReserveCents'][i]);});
 if(activeMinutes!==null)assert.ok(Number.isFinite(activeMinutes)&&activeMinutes>=0);
 return {merchandiseCents:merchandise,shippingCreditCents,marketplaceFeeCents:marketplaceFee,
  processingEstimateCents:processingEstimate,possibleCapRebateCents:capRebate,
  beforeFulfillmentCents:beforeFulfillment,
  netCents:costs.every(v=>v!==null)?beforeFulfillment-costs.reduce((a,b)=>a+b,0):null,
  activeMinutes,limitations:'Seller fee and processing estimates from published policy; exact processor base, rounding, cap rebate and realized loss require settlement evidence. Buyer fee excluded. Postage/materials/loss need user-supplied order values.'};
}
