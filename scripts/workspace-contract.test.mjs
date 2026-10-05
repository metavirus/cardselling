import test from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
registerHooks({resolve(s,c,n){return n(s==='./selling-economics'?s+'.ts':s,c);}});
const {validateWorkspaceRequest,importedSettings}=await import('../src/lib/workspace-contract.ts');
const id='12345678-1234-1234-1234-123456789012';
const request={kind:'patch',requestId:id,baseRevision:0};
test('workspace rejects invalid lot, direction, currency and revision before database writes',()=>{
 for(const bad of [{baseRevision:-1},{drafts:{bad:{plan:'hold',note:''}}},{drafts:{[id]:{plan:'sold',note:''}}},{settings:{postage:82.5}},{settings:{postage:-1}},{settings:{basis:'high'}},{settings:{secret:'x'}}])assert.throws(()=>validateWorkspaceRequest({...request,...bad}));
});
test('workspace granular writes preserve exact notes and only supplied settings',()=>{
 const x=validateWorkspaceRequest({...request,drafts:{[id]:{plan:'buylist',note:'Keep exact printing\nConfirm cash.'}},settings:{postage:82},preferences:{selected:[id],search:'dragon'}});
 assert.deepEqual(x.settings,{postage:82});assert.equal(x.drafts[id].note,'Keep exact printing\nConfirm cash.');assert.deepEqual(x.preferences.selected,[id]);
});
test('browser import repairs known old shipping costs while preserving custom settings',()=>{
 assert.equal(importedSettings({postage:135,materials:25},'tracked-pilot-v3').postage,82);
 assert.equal(importedSettings({postage:111,materials:44},'tracked-pilot-v3').materials,44);
});
