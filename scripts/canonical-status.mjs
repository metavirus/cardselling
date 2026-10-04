import { appClient } from './database.mjs';
import { canonicalSummary } from './canonical-store.mjs';
const c=await appClient();
try { console.log(JSON.stringify(await canonicalSummary(c),null,2)); }
finally {await c.end();}
