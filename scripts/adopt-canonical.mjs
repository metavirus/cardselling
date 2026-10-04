import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { appClient, root, backup } from './database.mjs';
import { adoptCanonical, canonicalSummary } from './canonical-store.mjs';
const c=await appClient();
try {
  if(!(await c.query("SELECT 1 FROM canonical_cutovers WHERE name='initial_manabox'")).rowCount) await backup();
  await c.query('BEGIN');
  const result=await adoptCanonical(c,JSON.parse(readFileSync(join(root,'docs/assumptions.json'),'utf8')));
  await c.query('COMMIT');
  console.log(JSON.stringify({adoption:result,current:await canonicalSummary(c)},null,2));
} catch(e) { await c.query('ROLLBACK'); console.error(e.message); process.exitCode=1; }
finally {await c.end();}
