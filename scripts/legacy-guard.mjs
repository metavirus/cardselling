import { appClient } from './database.mjs';
export async function requireLegacyMode() {
  const c=await appClient();
  try {
    if((await c.query("SELECT to_regclass('public.canonical_cutovers') AS name")).rows[0].name &&
       (await c.query("SELECT 1 FROM canonical_cutovers WHERE name='initial_manabox'")).rowCount)
      throw new Error('Retired spreadsheet workflow: canonical database is authoritative. Use db:canonical-status; future imports require explicit reconciliation. Historical artifacts remain archived.');
  } finally {await c.end();}
}
