// Provider adapter: strict product matching, exact cents, bounded sale samples.
import assert from 'node:assert/strict';
export const finishCodes = {normal:'NF',foil:'FO',etched:'EF'};
export function cents(value) {
  assert.ok(Number.isSafeInteger(value) && value>=0,'Invalid integer cents');
  return `${Math.floor(value/100)}.${String(value%100).padStart(2,'0')}`;
}
export const gradeNames={NM:'near_mint',LP:'lightly_played',MP:'moderately_played',HP:'heavily_played',DMG:'damaged'};
export function matchProduct(lot, parent, grade='NM') {
  assert.ok(gradeNames[grade],'Unknown provider grade');
  if (!parent) return {reason:'missing_catalog_parent'};
  if (parent.scryfall_id!==lot.source_scryfall_id || parent.set_code.toLowerCase()!==lot.set_code || parent.number!==lot.collector_number)
    return {reason:'parent_identity_conflict'};
  // A provider-grade comparison is not a physical condition assertion about this lot.
  const matches=parent.variants.filter(v=>v.product_type==='mtg_single' && v.language_id.toLowerCase()===lot.printed_language && v.finish_id===finishCodes[lot.finish] && v.condition_id===grade);
  if(matches.length!==1) return {reason:matches.length?'ambiguous_variant':'missing_exact_variant'};
  return {product:matches[0]};
}
export function observations(product, capturedAt) {
  assert.ok(Number.isSafeInteger(product.available_quantity) && product.available_quantity>=0,'Invalid available quantity');
  cents(product.low_price);
  assert.ok(Array.isArray(product.recent_sales) && product.recent_sales.length<=20,'Unexpected sale sample format or limit');
  const result=[{locator:'available_quantity',metric:'available_quantity',kind:'source_signal',value:String(product.available_quantity),currency:null,unit:'copies',time:null,quantity:product.available_quantity,raw:{available_quantity:product.available_quantity,low_price:product.low_price}}];
  // Catalog uses 0 for unavailable prices. Never turn that sentinel into a free card.
  if(product.available_quantity>0 && product.low_price>0)result.push({locator:'low_price',metric:'lowest_asking_price',kind:'asking_price',value:cents(product.low_price),currency:'USD',unit:'reported_price',time:null,quantity:null,raw:{low_price:product.low_price,available_quantity:product.available_quantity}});
  for(const [i,sale] of product.recent_sales.entries()) {
    assert.ok(Number.isSafeInteger(sale.quantity) && sale.quantity>0,'Invalid sale quantity');
    const time=new Date(sale.created_at);
    assert.ok(Number.isFinite(+time) && /(?:Z|[+-]\d\d:\d\d)$/.test(sale.created_at) && +time<=+new Date(capturedAt),'Invalid/future sale timestamp');
    result.push({locator:`recent_sales/${i}`,metric:'reported_sale_price',kind:'completed_sale',value:cents(sale.price),currency:'USD',unit:'reported_price',time:time.toISOString(),quantity:sale.quantity,raw:sale});
  }
  return result;
}
export const limitations='Mana Pool only. Recent sales are up to 20 records per exact variant, not complete market history. No stable sale ID; overlapping captures must not be summed. Price is reported cents; unit-versus-line-total and shipping, fee, tax, cancellation/refund treatment are not fully documented. Not seller net or a buy offer. Available quantity is offered copies, not seller count or demand. Capture time is local download completion, not provider publication.';
