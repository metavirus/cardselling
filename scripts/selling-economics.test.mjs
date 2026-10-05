import test from 'node:test';
import assert from 'node:assert/strict';
import {estimate,defaultSettings,migrateShippingSettings,shippingModelVersion} from '../src/lib/selling-economics.ts';
test('routine letter credits shipping and charges fixed processing once',()=>{
 const r=estimate({askCents:1000,medianCents:1000,ckCents:null,ckCapacity:null,quantity:1},defaultSettings);
 assert.equal(r.net,902);assert.equal(r.credit,135);assert.equal(r.postage+r.materials,120);assert.equal(r.processing,63);
 const old=estimate({askCents:1000,medianCents:1000,ckCents:null,ckCapacity:null,quantity:1},{...defaultSettings,postage:135,materials:25});assert.equal(r.net-old.net,40);
 const tracked=estimate({askCents:6000,medianCents:6000,ckCents:null,ckCapacity:null,quantity:1},defaultSettings);assert.equal(tracked.materials,45);assert.equal(tracked.credit,0);
});
test('legacy defaults migrate once and custom costs remain intact',()=>{
 const old={postage:135,materials:25,tracked:550,batch:1000,basis:'ask'};
 const migrated=migrateShippingSettings(old);assert.equal(migrated.postage,82);assert.equal(migrated.materials,38);assert.equal(migrated.trackedMaterials,40);
 assert.deepEqual(migrateShippingSettings(migrated,shippingModelVersion),migrated);
 assert.equal(migrateShippingSettings({...old,postage:111,materials:50}).postage,111);assert.equal(migrateShippingSettings({...old,materials:50}).materials,50);
});
test('versioned stale letter default pair is repaired and sub-dollar sale remains positive',()=>{
 const old={...defaultSettings,postage:135,materials:25};
 for(const version of ['tracked-pilot-v3','integrated-letter-v2']){
  const repaired=migrateShippingSettings(old,version);
  assert.equal(repaired.postage,82);assert.equal(repaired.materials,38);
  const mabel={askCents:47,medianCents:47,ckCents:72,ckCapacity:24,quantity:1};
  assert.equal(estimate(mabel,old).net,-15);assert.equal(estimate(mabel,repaired).net,25);
  assert.equal(estimate({...mabel,medianCents:100},repaired).net,73);
 }
 assert.equal(migrateShippingSettings({...old,postage:111},'tracked-pilot-v3').postage,111);
 assert.deepEqual(migrateShippingSettings(old,shippingModelVersion),old);
});
const settings={postage:135,tracked:550,materials:25,batch:1000,basis:'ask'};
test('buyer-paid tracking and free tracking have distinct cash flows',()=>{
 const c={askCents:5000,medianCents:5000,ckCents:null,ckCapacity:null,quantity:1};
 const paid=estimate(c,{...defaultSettings,shippingMode:'tracked'});
 assert.equal(paid.credit,649);assert.equal(paid.net,4610);assert.equal(paid.postage,550);assert.equal(paid.materials,45);
 const free=estimate({...c,medianCents:6000},defaultSettings);
 assert.equal(free.credit,0);assert.equal(free.net,4901);
 const at75=estimate({...c,medianCents:7500},defaultSettings);assert.equal(at75.net,6282);
 assert.equal(migrateShippingSettings({...defaultSettings,trackedMaterials:25,trackedConsumables:undefined},'integrated-letter-v2').trackedMaterials,40);
});
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

