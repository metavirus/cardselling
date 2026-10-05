import {csv,hash,integer} from './import-domain.mjs';
export function scanKey(r){return JSON.stringify([r['ManaBox ID'],r.Added,r['Scryfall ID'],r.Foil,r.Language,r.Condition]);}
export function reconcileScan(text,existing){
 const rows=csv(text);const seen=new Set();
 for(const r of rows){const k=scanKey(r);if(seen.has(k))throw Error('Duplicate scan identity');seen.add(k);if(!r.Added||!r['ManaBox ID']||!r['Scryfall ID'])throw Error('Missing stable scan identity');if(integer(r.Quantity)<1)throw Error('Quantity must be positive');if(!['normal','foil','etched'].includes(r.Foil))throw Error('Unsupported finish');if([r.Proxy,r.Misprint,r.Altered,r.Signed].some(x=>x!=='false'))throw Error('Special physical attributes need explicit reconciliation');}
 const by=new Map(existing.map(x=>[scanKey(x.raw),x]));if(by.size!==existing.length)throw Error('Existing scan identities ambiguous');
 const missing=existing.filter(x=>!seen.has(scanKey(x.raw)));
 const changed=rows.filter(r=>by.has(scanKey(r))&&integer(r.Quantity)!==integer(by.get(scanKey(r)).raw.Quantity));
 if(missing.length||changed.length)throw Error(`Not additions-only: ${missing.length} missing, ${changed.length} quantity changes`);
 return {rows,added:rows.filter(r=>!by.has(scanKey(r))),sourceHash:hash(text)};
}
