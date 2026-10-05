import test from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
registerHooks({resolve(s,c,n){if(s==='./selling-economics')return n(s+'.ts',c);return n(s,c);}});
const {reviewCheckpointCurrent}=await import('../src/lib/review-checkpoint.ts');
const {defaultSettings,shippingModelVersion}=await import('../src/lib/selling-economics.ts');
const asOf='2026-10-05T05:00:00.000Z',manifest={asOf,shipping_model_version:shippingModelVersion,settings:{...defaultSettings}};
test('a current individual review must match every cost assumption and evidence checkpoint',()=>{
 assert.equal(reviewCheckpointCurrent(manifest,asOf),true);
 for(const field of ['postage','materials','tracked','trackedMaterials','trackedConsumables','shippingMode','batch','basis']){
  assert.equal(reviewCheckpointCurrent({...manifest,settings:{...manifest.settings,[field]:null}},asOf),false,field);
 }
 assert.equal(reviewCheckpointCurrent(manifest,'2026-10-05T06:00:00.000Z'),false);
 assert.equal(reviewCheckpointCurrent({...manifest,shipping_model_version:'old'},asOf),false);
});
