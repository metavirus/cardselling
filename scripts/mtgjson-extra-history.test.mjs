import test from 'node:test';
import assert from 'node:assert/strict';
import {exactLots,nativeId,normalizeDays,collisionKeys,specs} from './mtgjson-extra-history.mjs';
const identity={uuid:'uuid-a',identifiers:{scryfallId:'sf-a',cardKingdomId:'ck-normal',cardKingdomFoilId:'ck-foil'},setCode:'SLD',number:'123',language:'English',finishes:['nonfoil','foil']};
const lot={source_scryfall_id:'sf-a',set_code:'sld',collector_number:'123',printed_language:'en',finish:'normal'};
test('exact mapping rejects same-name variants, wrong language, missing finish and collector drift',()=>{
 assert.equal(exactLots(identity,[lot]).length,1);
 for(const change of [{source_scryfall_id:'sf-b'},{set_code:'sld2'},{collector_number:'123a'},{printed_language:'ja'},{finish:'etched'}])assert.equal(exactLots(identity,[{...lot,...change}]).length,0);
});
test('native CK product depends on finish and excludes non-English ordinary stock',()=>{
 assert.equal(nativeId(identity,'cardkingdom','normal'),'ck-normal');assert.equal(nativeId(identity,'cardkingdom','foil'),'ck-foil');assert.equal(nativeId(identity,'cardkingdom','etched'),undefined);
 assert.equal(nativeId({...identity,language:'Japanese'},'cardkingdom','normal'),undefined);
});
test('Mana Pool requires catalog UUID, Scryfall identity and exact language/finish existence',()=>{
 const parent={card_id:'uuid-a',scryfall_id:'sf-a',set_code:'SLD',number:'123',variants:[{language_id:'EN',finish_id:'NF'}]};
 const catalog=new Map([['uuid-a',parent]]);
 assert.equal(nativeId(identity,'manapool','normal',catalog),'uuid-a');assert.equal(nativeId(identity,'manapool','foil',catalog),undefined);
 assert.equal(nativeId({...identity,identifiers:{scryfallId:'other'}},'manapool','normal',catalog),undefined);
});
test('same upstream product cannot silently cover different printings',()=>{
 const conflicting={...identity,uuid:'uuid-b',identifiers:{...identity.identifiers,scryfallId:'sf-b'}};
 const bad=collisionKeys([{raw:identity},{raw:conflicting}],new Map());assert.ok(bad.has('cardkingdom/ck-normal/normal'));
 assert.equal(collisionKeys([{raw:identity},{raw:identity}],new Map()).size,0);
});
test('normalization preserves exact cents and date-only precision; rejects invalid or future days and currency drift',()=>{
 assert.deepEqual(normalizeDays({'2026-10-01':1.3},'USD','USD','2026-10-04')[0],{date:'2026-10-01',value:'1.30',currency:'USD',start:'2026-10-01T00:00:00.000Z',end:'2026-10-02T00:00:00.000Z'});
 for(const days of [{'2026-02-30':1},{'2026-10-05':1},{'2026-10-01':-1},{'2026-10-01':1.234}])assert.throws(()=>normalizeDays(days,'USD','USD','2026-10-04'));
 assert.throws(()=>normalizeDays({'2026-10-01':1},'EUR','USD','2026-10-04'));
 assert.ok(specs.every(s=>s.currency==='USD'));assert.ok(!specs.some(s=>s.key==='cardmarket'));
});
test('duplicate face UUID prices count once and conflicting values fail closed',async()=>{
 const {acceptNativePoint}=await import('./mtgjson-extra-history.mjs');const seen=new Map();
 assert.equal(acceptNativePoint(seen,'ck/id/foil/2026-10-01','2.00'),true);
 assert.equal(acceptNativePoint(seen,'ck/id/foil/2026-10-01','2.00'),false);
 assert.throws(()=>acceptNativePoint(seen,'ck/id/foil/2026-10-01','3.00'));
});
