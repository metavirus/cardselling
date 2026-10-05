import test from 'node:test';
import assert from 'node:assert/strict';
import {cardGuidance} from '../src/lib/card-guidance.ts';
const base={quantity:1,ckCents:2000,ckCapacity:10,scgCents:null,askCents:3000,sampleCount:6,proposal:null,semantic:{traits:[],observedSales90:6}};
test('A lone sale cannot support the higher-SCG comparison',()=>{
 const result=cardGuidance({...base,ckCapacity:0,scgCents:2500,sampleCount:1},{net:4000,gap:null},{net:2600},'ask');
 assert.equal(result.suggested,'undecided');
});
test('Stale samples do not become a recent-activity listing recommendation',()=>{
 const result=cardGuidance({...base,semantic:{traits:[],observedSales90:0}},{net:5000,gap:3000},{net:5000},'median');
 assert.equal(result.suggested,'undecided');
});
test('Buylist rationale names the selected price basis and compares to CK',()=>{
 const result=cardGuidance(base,{net:1900,gap:-100},{net:1900},'median');
 assert.match(result.reason,/sampled-sale/);assert.equal(result.suggested,'buylist');
});
test('Thin premium Island goes to collector comparison, despite high ask',()=>{
 const result=cardGuidance({...base,ckCents:5200,scgCents:8000,askCents:20540,sampleCount:1,semantic:{traits:['Full art'],observedSales90:1}},{net:18312,gap:13112},{net:17814},'ask');
 assert.equal(result.suggested,'event');assert.equal(result.gap,10312);assert.match(result.reason,/SCG indicates \$80.00/);
});

test('Historical buylist proposal cannot override lost capacity or improved self-sale economics',()=>{
 const card={...base,proposal:'buylist',rationale:'Old recommendation',ckCapacity:0,scgCents:null};
 const result=cardGuidance(card,{net:4000,gap:null},{net:4000},'median');
 assert.equal(result.suggested,'self');assert.doesNotMatch(result.reason,/Old recommendation/);
});
