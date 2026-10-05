import test from 'node:test';
import assert from 'node:assert/strict';
import {summarizePriceTrend,timingReadout,priceRegime} from '../src/lib/price-trends.ts';
const point=(date,cents)=>({date,cents});
test('History ignores invalid points and sorts before calculating change',()=>{
 const s=summarizePriceTrend([point('2026-10-04',400),point('invalid',900),point('2026-07-10',500),point('2026-09-10',null)]);
 assert.equal(s.changePercent,-20);assert.equal(s.latest.cents,400);
});
test('Carmen separates channel from timing and preserves quote conflict',()=>{
 const s=timingReadout({ckCents:500,ckSourceDate:'2026-10-04',marketHistory:{ck:[point('2026-07-10',500),point('2026-10-04',400)],tcg:[point('2026-07-10',550),point('2026-10-04',610)]}},'2026-10-04');
 assert.match(s.title,/different directions/);assert.match(s.conflict,/\$5.00.*\$4.00/);assert.match(s.reason,/does not establish/);
});

test('Fresh direct CK check resolves the cash quote without rewriting daily history',()=>{
 const card={ckCents:500,ckSource:'direct_public',ckSourceDate:'2026-10-04T18:00:00Z',marketHistory:{ck:[point('2026-07-10',500),point('2026-10-04',400)],tcg:[point('2026-07-10',550),point('2026-10-04',610)]}};
 const original=structuredClone(card);
 const readout=timingReadout(card,'2026-10-04T20:00:00Z');
 assert.equal(readout.conflict,null);
 assert.equal(readout.regime,'diverging');
 assert.deepEqual(card,original);
 assert.match(timingReadout({...card,ckSource:'tcgsentry_export'},'2026-10-04T20:00:00Z').conflict,/\$5.00.*\$4.00/);
 assert.match(timingReadout(card,'2026-10-12T20:00:00Z').conflict,/Verify/);
 assert.match(timingReadout(card,'2026-10-04T17:00:00Z').conflict,/Verify/);
});
test('Stronger dealer against weaker reference supports checking a sale, not forecasting',()=>{
 const s=timingReadout({ckCents:700,ckSourceDate:'2026-10-04',marketHistory:{ck:[point('2026-07-10',300),point('2026-10-04',700)],tcg:[point('2026-07-10',800),point('2026-10-04',700)]}},'2026-10-04');
 assert.match(s.title,/strengthened/);assert.equal(s.conflict,null);
});
test('Single historical point cannot support a timing direction',()=>{
 assert.equal(summarizePriceTrend([point('2026-10-04',400)]).changePercent,null);
});

test('An older history value and a newer quote are dated observations, not a same-day conflict',()=>{
 const s=timingReadout({ckCents:500,ckSourceDate:'2026-10-04T10:00:00Z',marketHistory:{ck:[point('2026-10-03',400)],tcg:[]}},'2026-10-04T12:00:00Z');
 assert.equal(s.conflict,null);assert.match(s.datedDifference,/Oct 4.*Oct 3/);
});
test('Regime keeps diverging timing distinct from dealer strengthening',()=>{
 assert.equal(priceRegime(-20,11),'diverging');assert.equal(priceRegime(40,-12),'dealer_strengthening');assert.equal(priceRegime(null,11),'limited');
});

test('Different date coverage cannot create a false diverging regime',()=>{
 const s=timingReadout({ckCents:400,ckSourceDate:'2026-10-04',marketHistory:{ck:[point('2026-07-10',600),point('2026-09-01',400)],tcg:[point('2026-09-10',500),point('2026-10-04',600)]}},'2026-10-04');
 assert.equal(s.regime,'limited');
});
test('Short shared span stays limited; sufficient overlap reports its actual dates',()=>{
 const c={ckCents:400,ckSourceDate:'2026-10-04',marketHistory:{ck:[point('2026-09-30',600),point('2026-10-04',400)],tcg:[point('2026-09-30',500),point('2026-10-04',600)]}};
 assert.equal(timingReadout(c,'2026-10-04',30).regime,'limited');
 c.marketHistory.ck.unshift(point('2026-09-10',600));c.marketHistory.tcg.unshift(point('2026-09-10',500));
 const s=timingReadout(c,'2026-10-04',90);assert.equal(s.regime,'diverging');assert.match(s.reason,/Sep 10.*Oct 4.*24 days/);
});

test('Mana Pool adds independent reference direction only over shared sufficient dates',()=>{
 const c={ckCents:700,ckSourceDate:'2026-10-04',marketHistory:{ck:[point('2026-09-01',600),point('2026-10-04',700)],tcg:[point('2026-09-01',800),point('2026-10-04',700)],manaPoolRetail:[point('2026-09-01',400),point('2026-10-04',600)]}};
 const s=timingReadout(c,'2026-10-04');assert.match(s.marketContext,/\+50%/);assert.match(s.title,/TCG/);
 c.marketHistory.manaPoolRetail=[point('2026-10-04',600)];assert.equal(timingReadout(c,'2026-10-04').marketContext,null);
});
