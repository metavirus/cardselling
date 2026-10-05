// A source fact batch can mix sales, daily histories and nonprice ranks.
// Derive its columns from the entire batch, never just its first fact.
export function normalizeFactRows(rows){
 const keys=[...new Set(rows.flatMap(r=>Object.keys(r)))];
 return {keys,rows:rows.map(r=>Object.fromEntries(keys.map(k=>[k,r[k]??null])))};
}
