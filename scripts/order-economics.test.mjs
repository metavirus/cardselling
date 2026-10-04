import test from 'node:test';import assert from 'node:assert/strict';
import {manaPoolOrder} from './order-economics.mjs';
test('One order shares the fixed processing charge and postage',()=>{
 const together=manaPoolOrder({items:[{unitPriceCents:1000,quantity:2}],shippingCreditCents:0,postageCents:100,materialsCents:20,lossReserveCents:0});
 const separate=2*manaPoolOrder({items:[{unitPriceCents:1000,quantity:1}],shippingCreditCents:0,postageCents:100,materialsCents:20,lossReserveCents:0}).netCents;
 assert.equal(together.netCents-separate,150); // one less fixed fee and one set of postage/materials
});
test('Unknown actual costs keep net unknown; buyer fees are absent',()=>{
 const result=manaPoolOrder({items:[{unitPriceCents:1000,quantity:1}],shippingCreditCents:135});
 assert.equal(result.netCents,null);assert.equal(result.marketplaceFeeCents,50);
 assert.equal(result.processingEstimateCents,63);
 assert.throws(()=>manaPoolOrder({items:[{unitPriceCents:1.5,quantity:1}],shippingCreditCents:0}));
});
test('Multi-copy fee and item cap use the same per-card rounding',()=>{
 const result=manaPoolOrder({items:[{unitPriceCents:100001,quantity:2}],shippingCreditCents:0});
 assert.equal(result.marketplaceFeeCents,10000);
 assert.equal(result.possibleCapRebateCents,0);
});
