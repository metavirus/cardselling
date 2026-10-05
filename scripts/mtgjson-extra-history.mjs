import assert from 'node:assert/strict';
export const finishNames={normal:'nonfoil',foil:'foil',etched:'etched'};
export const languages={English:'en',Japanese:'ja',Phyrexian:'ph'};
export const specs=[{key:'cardkingdom',currency:'USD'},{key:'manapool',currency:'USD'}];
export function exactLots(identity,lots){
 return lots.filter(l=>l.source_scryfall_id===identity.identifiers?.scryfallId && l.set_code===identity.setCode?.toLowerCase() && l.collector_number===identity.number && l.printed_language===languages[identity.language] && identity.finishes?.includes(finishNames[l.finish]));
}
export function nativeId(identity,provider,finish,catalog){
 if(provider==='cardkingdom')return identity.language==='English'?identity.identifiers?.[{normal:'cardKingdomId',foil:'cardKingdomFoilId',etched:'cardKingdomEtchedId'}[finish]]:undefined;
 if(provider==='manapool'){
  const parent=catalog?.get(identity.uuid);
  if(!parent||parent.scryfall_id!==identity.identifiers?.scryfallId||parent.set_code.toLowerCase()!==identity.setCode.toLowerCase()||parent.number!==identity.number)return;
  // A catalog product proves the printing/finish exists, not the grade/language
  // mix of the historical provider price. History remains a broad reference.
  if(!parent.variants.some(v=>v.language_id.toLowerCase()===languages[identity.language]&&v.finish_id==={normal:'NF',foil:'FO',etched:'EF'}[finish]))return;
  return parent.card_id;
 }
}
export function normalizeDays(days,currency,expectedCurrency,publicationDate){
 assert.equal(currency,expectedCurrency,'Unexpected provider currency');
 return Object.entries(days).map(([date,value])=>{
  assert.match(date,/^\d{4}-\d{2}-\d{2}$/);
  const time=Date.parse(date+'T00:00:00Z');
  assert.ok(Number.isFinite(time)&&new Date(time).toISOString().slice(0,10)===date&&date<=publicationDate,'Invalid/future source date');
  assert.ok(typeof value==='number'&&Number.isFinite(value)&&value>=0,'Invalid price');
  const cents=Math.round(value*100);
  assert.ok(Number.isSafeInteger(cents)&&Math.abs(cents/100-value)<0.00001,'Unexpected subcent price');
  return {date,value:(cents/100).toFixed(2),currency,start:new Date(time).toISOString(),end:new Date(time+86400000).toISOString()};
 });
}
// Independent price records may share a provider ID accidentally. Do not silently
// map one upstream product to different printings/treatments.
export function collisionKeys(identities,catalog){
 const seen=new Map(),bad=new Set();
 for(const {raw:i}of identities)for(const {key}of specs)for(const finish of Object.keys(finishNames)){
  if(!i.finishes?.includes(finishNames[finish]))continue;
  const native=nativeId(i,key,finish,catalog);if(!native)continue;
  const subject=`${key}/${native}/${finish}`,printing=i.identifiers.scryfallId;
  if(seen.has(subject)&&seen.get(subject)!==printing)bad.add(subject);else seen.set(subject,printing);
 }
 return bad;
}

// Deduplicate same native product/day across multiple MTGJSON face UUIDs.
// Conflicting copies must be reviewed, never averaged or arbitrarily selected.
export function acceptNativePoint(seen,key,value){
 if(seen.has(key)){assert.equal(seen.get(key),value,'Conflicting same-product/day reference');return false;}
 seen.set(key,value);return true;
}
