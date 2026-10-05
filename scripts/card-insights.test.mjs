import test from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
registerHooks({resolve(s,c,n){if(s==='./selling-economics'||s==='./price-trends')return n(s+'.ts',c);return n(s,c);}});
const {analyzeCard,analyzeCollection,analysisDefaults:S}=await import('../src/lib/card-insights.ts');
const asOf='2026-10-04T20:00:00Z',p=(date,cents)=>({date,cents});
const card=(changes={})=>({lotId:'a',variantId:'v',grade:'near_mint',name:'Test',finish:'normal',quantity:1,ckCents:200,ckCapacity:20,ckSourceDate:asOf,scgCents:null,scgSourceDate:null,askCents:150,medianCents:150,semantic:{traits:[],competingQuantity:10,saleSampleCapped:true,edhrecRank:null},marketHistory:{tcg:[p('2026-10-04',150)],ck:[],manaPoolRetail:[p('2026-10-04',100)]},recentSales:[],...changes});
test('same-day reference comparisons exclude unmatched and zero days',()=>{
 const c=card({recentSales:[p('2026-10-01',200),p('2026-10-02',200),p('2026-10-03',200)],marketHistory:{tcg:[],ck:[],manaPoolRetail:[p('2026-10-01',100),p('2026-10-02',0)]}});
 const a=analyzeCard(c,S,asOf);assert.equal(a.pairedSales,1);assert.ok(!a.findings.some(f=>f.id==='sales-above-reference'));
});
test('isolated upper sale is not a supported upper band',()=>{
 const a=analyzeCard(card({recentSales:[p('2026-09-28',100),p('2026-09-29',100),p('2026-09-30',100),p('2026-10-01',1000)]}),S,asOf);assert.notEqual(a.upperPrice,1000);
});
test('higher cluster requires multiple dates and recent repeats',()=>{
 const a=analyzeCard(card({recentSales:[p('2026-08-01',100),p('2026-08-02',100),p('2026-08-03',100),p('2026-08-04',100),p('2026-09-28',300),p('2026-09-29',310),p('2026-09-30',320)]}),S,asOf);assert.equal(a.upperPrice,310);assert.equal(a.upperNet,estimateNet(310));
});
function estimateNet(p){return p+135-Math.round(p*.05)-Math.round((p+135)*.029)-30-S.postage-S.materials;}
test('old cluster cannot promise a current upper opportunity',()=>{
 const a=analyzeCard(card({recentSales:[p('2026-08-01',300),p('2026-08-02',310),p('2026-08-03',320)]}),S,asOf);assert.equal(a.upperPrice,null);
});
test('dominance needs recent sales, positive covered fresh bid, and both references',()=>{
 const sales=Array.from({length:5},(_,i)=>p(`2026-09-${20+i}`,100));
 const c=card({recentSales:sales});assert.ok(analyzeCard(c,S,asOf).findings.some(f=>f.id==='dealer-dominates'));
 for(const change of [{ckCapacity:0},{ckSourceDate:'2026-08-01'},{ckCents:0},{marketHistory:{tcg:[],ck:[],manaPoolRetail:[]}}])assert.ok(!analyzeCard({...c,...change},S,asOf).findings.some(f=>f.id==='dealer-dominates'));
});
test('capacity shared by duplicated inventory lots is not counted twice',()=>{
 const c=card({quantity:2,ckCapacity:3,recentSales:Array.from({length:5},(_,i)=>p(`2026-09-${20+i}`,100))});
 const a=analyzeCollection([c,{...c,lotId:'b'}],S,asOf);assert.ok(a.get('a').findings.some(f=>f.id==='capacity'));assert.equal(a.get('a').breakEven,null);
});
test('higher prices can remain economically inferior after fixed order costs',()=>{
 const c=card({ckCents:160,recentSales:[p('2026-09-20',180),p('2026-09-21',190),p('2026-09-22',198),p('2026-09-23',140),p('2026-09-24',140),p('2026-09-25',140)]});
 const a=analyzeCard(c,S,asOf);assert.ok(a.upperExtra<0);assert.ok(a.breakEven>198);
});
test('same-day dealer conflict blocks compelling conclusion and no premium is invented',()=>{
 const c=card({semantic:{traits:['Borderless'],competingQuantity:2,saleSampleCapped:false,edhrecRank:10},marketHistory:{tcg:[p('2026-10-04',100)],ck:[p('2026-10-04',150)],manaPoolRetail:[p('2026-10-04',100)]},recentSales:Array.from({length:5},(_,i)=>p(`2026-09-${20+i}`,100))});
 const a=analyzeCard(c,S,asOf);assert.equal(a.category,'review');assert.ok(!a.findings.some(f=>f.id==='dealer-dominates'||f.id==='dealer-net-dominates'));assert.ok(a.findings.some(f=>f.id==='quote-conflict'));assert.match(a.findings.find(f=>f.id==='printing').detail,/does not establish/);
});

test('flat repeated prices do not become a higher-price opportunity',()=>{
 const c=card({recentSales:Array.from({length:8},(_,i)=>p(`2026-09-${20+i}`,200))});assert.equal(analyzeCard(c,S,asOf).upperPrice,null);
});
