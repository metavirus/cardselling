import test from 'node:test';
import assert from 'node:assert/strict';
import { sampledSalesActivity } from '../src/lib/sales-activity.ts';
const now='2026-10-05T12:00:00Z';
const row={capturedAt:now,soldAt:'2026-10-01T00:00:00Z',cents:100,quantity:3};
test('overlapping captures do not inflate observed units; identical rows within capture survive',()=>{
 const earlier={...row,capturedAt:'2026-10-02T00:00:00Z'};
 const a=sampledSalesActivity([earlier,earlier,row,row],[],now);
 assert.equal(a.observedRecords,2);assert.equal(a.observedUnits,6);
});
test('new captured sale expands lower bound and bins sum exactly',()=>{
 const a=sampledSalesActivity([row,{...row,soldAt:'2026-10-04T00:00:00Z',quantity:1}],[],now);
 assert.equal(a.observedUnits,4);assert.equal(a.bins.reduce((s,b)=>s+b.observedUnits,0),4);
 assert.equal(a.trend,'unmeasured');
});
test('empty fresh capture means checked sample, not complete zero volume',()=>{
 const a=sampledSalesActivity([],[{capturedAt:now,records:0,limit:20}],now);
 assert.equal(a.lastChecked,now);assert.equal(a.observedUnits,0);assert.equal(a.completeness,'sample_lower_bound');
});
test('cap, window and future captures remain explicit',()=>{
 const a=sampledSalesActivity([row,{...row,soldAt:'2026-01-01T00:00:00Z'},{...row,capturedAt:'2026-10-06T00:00:00Z',quantity:10}],[{capturedAt:now,records:20,limit:20}],now);
 assert.equal(a.observedUnits,3);assert.equal(a.capped,true);
});
test('invalid quantity and future sale fail instead of inventing units',()=>{
 assert.throws(()=>sampledSalesActivity([{...row,quantity:0}],[],now));
 assert.throws(()=>sampledSalesActivity([{...row,soldAt:'2026-10-06T00:00:00Z'}],[],now));
});
