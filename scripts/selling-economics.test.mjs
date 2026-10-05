import test from 'node:test';
import assert from 'node:assert/strict';
import {estimate} from '../src/lib/selling-economics.ts';
const settings={postage:135,tracked:550,materials:25,batch:1000,basis:'ask'};
test('Decision receipt matches existing Astral Dragon economics and whole-lot difference',()=>{
 const result=estimate({askCents:2357,medianCents:null,ckCents:2050,ckCapacity:26,quantity:2},settings);
 assert.equal(result.net,2112);assert.equal(result.gap,124);
 assert.equal(result.price+result.credit-result.marketFee-result.processing-result.postage-result.materials,result.net);
});
test('Missing price stays unknown and unavailable dealer capacity gives no gap',()=>{
 assert.equal(estimate({askCents:null,medianCents:null,ckCents:4500,ckCapacity:0,quantity:1},settings).net,null);
 const r=estimate({askCents:11199,medianCents:10700,ckCents:4500,ckCapacity:0,quantity:1},settings);
 assert.equal(r.net,9709);assert.equal(r.gap,null);assert.equal(r.credit,0);assert.equal(r.postage,550);
});
