import test from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
registerHooks({resolve(s,c,n){if(s==='./selling-economics'||s==='./price-trends'||s==='./buylist-screen')return n(s+'.ts',c);return n(s,c);}});
const {actionFor}=await import('../src/lib/action-queue.ts');
const {analyzeCollection,analysisDefaults:S}=await import('../src/lib/card-insights.ts');
const asOf='2026-10-04T20:00:00Z',p=(date,cents)=>({date,cents});
const base={lotId:'a',variantId:'v',grade:'near_mint',quantity:1,ckCents:200,ckCapacity:20,ckSourceDate:asOf,scgCents:null,scgSourceDate:null,askCents:150,medianCents:100,semantic:{traits:[],competingQuantity:10,saleSampleCapped:true,edhrecRank:null},marketHistory:{tcg:[p('2026-10-04',150)],ck:[p('2026-07-07',190),p('2026-10-04',200)],manaPoolRetail:[p('2026-10-04',100)]},recentSales:Array.from({length:5},(_,i)=>p(`2026-09-${20+i}`,100))};
const read=c=>actionFor(c,analyzeCollection([c],S,asOf).get(c.lotId),S,asOf);
test('covered compelling dealer case exposes dollars and dated high context',()=>{const a=read(base);assert.equal(a.kind,'ck');assert.ok(a.dollars>0);assert.ok(a.alerts.includes('CK near captured 90-day high'));});
test('history-only and unknown capacity never become shipment actions',()=>{for(const c of [{...base,ckCents:null,ckSourceDate:null,ckCapacity:null},{...base,ckCapacity:null},{...base,ckSourceDate:'2026-08-01'}])assert.equal(read(c).kind,'verify');});
test('shared inventory capacity is respected by the queue',()=>{const cards=[{...base,quantity:2,ckCapacity:3},{...base,lotId:'b',quantity:2,ckCapacity:3}],insights=analyzeCollection(cards,S,asOf);for(const c of cards)assert.equal(actionFor(c,insights.get(c.lotId),S,asOf).kind,'verify');});
test('short historical coverage cannot claim proximity to a ninety-day high',()=>{assert.ok(!read({...base,marketHistory:{...base.marketHistory,ck:[p('2026-10-03',200),p('2026-10-04',200)]}}).alerts.includes('CK near captured 90-day high'));});
test('dealer-channel preference does not imply sell now when trajectories diverge',()=>{const c={...base,marketHistory:{...base.marketHistory,ck:[p('2026-07-07',300),p('2026-10-04',200)],tcg:[p('2026-07-07',100),p('2026-10-04',150)]}};const a=read(c);assert.equal(a.kind,'watch');assert.match(a.reason,/Recheck/);assert.equal(a.dollars,null);});

test('current individual judgment can replace a stale median with a newer realized-price scenario',()=>{
 const c={...base,ckCents:960,medianCents:800,marketHistory:{...base.marketHistory,ck:[p('2026-07-07',800),p('2026-10-04',960)]},analystReview:{current:true,channel:'patient_self_sale',nextStep:'Test the newer exact-foil range.',timing:'Patient listing now.',priceScenario:{grossCents:2374,basis:'Two recent exact-foil sale captures'}}};
 const a=read(c);assert.equal(a.kind,'list');assert.equal(a.dollars,1207);assert.equal(a.reason,c.analystReview.nextStep);
 assert.notEqual(read({...c,analystReview:{...c.analystReview,current:false}}).kind,'list');
});
test('model-authored buylist preference cannot bypass unavailable dealer capacity',()=>{
 const c={...base,ckCapacity:0,analystReview:{current:true,channel:'ck_buylist',nextStep:'Add to a CK batch.',priceScenario:{grossCents:100,basis:'Captured median'}}};
 assert.equal(read(c).kind,'verify');assert.equal(read(c).dollars,null);
});


test('limited evidence distinguishes a favorable cash comparison from missing data',()=>{
 const insight={category:'review',upperExtra:null,findings:[{id:'thin-sales'}]};
 const c={...base,semantic:{...base.semantic,observedSales30:2}};
 const result=actionFor(c,insight,S,asOf);
 assert.equal(result.label,'CK favored · limited evidence');assert.doesNotMatch(result.reason,/missing/);
 assert.equal(actionFor({...c,medianCents:null},insight,S,asOf).label,'No comparable sale samples');
 assert.equal(actionFor({...c,ckCapacity:null},insight,S,asOf).label,'Confirm CK buying quantity');
 assert.equal(actionFor({...c,ckCents:null},insight,S,asOf).label,'No current CK quote');
});
