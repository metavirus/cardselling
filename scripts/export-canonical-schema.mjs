// Documentation export: definitions/counts only, never private inventory or secrets.
import { mkdirSync, writeFileSync, copyFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { appClient, root } from './database.mjs';
import { canonicalSummary } from './canonical-store.mjs';
const c=await appClient();
try {
  const tables=(await c.query(`SELECT table_name,column_name,data_type,is_nullable,column_default
    FROM information_schema.columns WHERE table_schema='public' AND table_name LIKE 'canonical_%'
    ORDER BY table_name,ordinal_position`)).rows;
  const constraints=(await c.query(`SELECT cls.relname AS table_name,con.conname AS name,pg_get_constraintdef(con.oid) AS definition
    FROM pg_constraint con JOIN pg_class cls ON cls.oid=con.conrelid JOIN pg_namespace n ON n.oid=cls.relnamespace
    WHERE n.nspname='public' AND cls.relname LIKE 'canonical_%' ORDER BY cls.relname,con.conname`)).rows;
  const views=(await c.query(`SELECT viewname,definition FROM pg_views WHERE schemaname='public' AND viewname LIKE 'canonical_%' ORDER BY viewname`)).rows;
  const schema={status:'Applied canonical schema; workflow service limitations documented in canonical-store.md',generated_at:new Date().toISOString(),authority:'Reviewed custom SQL migrations, not this documentation export',columns:tables,constraints,views};
  writeFileSync(join(root,'docs/canonical-schema.json'),JSON.stringify(schema,null,2)+'\n');
  const out=resolve(root,'../outputs/canonical-store'); mkdirSync(out,{recursive:true});
  copyFileSync(join(root,'docs/canonical-schema.json'),join(out,'canonical-schema.json'));
  copyFileSync(join(root,'docs/canonical-store.md'),join(out,'canonical-store.md'));
  copyFileSync(join(root,'migrations/0002_canonical_store.sql'),join(out,'0002_canonical_store.sql'));
  writeFileSync(join(out,'cutover-summary.json'),JSON.stringify(await canonicalSummary(c),null,2)+'\n');
  console.log('Exported schema definitions, guide, SQL and cutover summary; no private inventory rows.');
} finally {await c.end();}
