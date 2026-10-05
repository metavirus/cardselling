import test from 'node:test';
import assert from 'node:assert/strict';
import { retry, validatePublication, uuid } from './refresh-market-data.mjs';

test('publication guard rejects future, invalid and stale source days',()=>{
  const now=new Date('2026-10-05T16:00:00Z');
  assert.equal(validatePublication('2026-10-05',now),'2026-10-05');
  for(const day of ['2026-10-06','2026-09-20','2026-02-30','wrong'])assert.throws(()=>validatePublication(day,now));
});
test('transient retry succeeds automatically and persistent failure is bounded',async()=>{
  const waits=[];let calls=0;
  assert.equal(await retry(async()=>{if(++calls<3)throw new Error('transient');return 'applied';},3,async ms=>waits.push(ms)),'applied');
  assert.deepEqual(waits,[1000,2000]);assert.equal(calls,3);
  calls=0;await assert.rejects(retry(async()=>{calls++;throw new Error('persistent');},3,async()=>{}),/persistent/);assert.equal(calls,3);
});
test('stable evidence IDs support replay without duplicate stock or observations',()=>{
  assert.equal(uuid('feed:sha:scope'),uuid('feed:sha:scope'));
  assert.notEqual(uuid('feed:sha:scope'),uuid('feed:newsha:scope'));
  assert.match(uuid('feed:sha:scope'),/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-a[0-9a-f]{3}-[0-9a-f]{12}$/);
});
