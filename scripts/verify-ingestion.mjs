import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { isDeepStrictEqual } from 'node:util';
import { appClient, root } from './database.mjs';
import { contentFingerprint } from './content-fingerprint.mjs';
import { bulkIdentityMatches } from './import-domain.mjs';

async function fingerprint() {
  const client = await appClient();
  try { return await contentFingerprint(client); }
  finally { await client.end(); }
}
const before = await fingerprint();
execFileSync(process.execPath, [join(root, 'scripts/ingest-handoff.mjs')], { stdio: 'inherit', timeout: 60000 });
const after = await fingerprint();
if (!isDeepStrictEqual(before, after)) throw new Error('Repeated import changed database contents');
const client = await appClient();
try {
  const inventory = await client.query('SELECT records.raw AS inventory, reference.raw AS reference FROM inventory_holdings holdings JOIN source_records records ON records.id=holdings.id LEFT JOIN card_reference_snapshots reference ON reference.scryfall_id=holdings.scryfall_id');
  if (inventory.rows.some(row => !row.reference || !bulkIdentityMatches(row.inventory, row.reference))) throw new Error('Inventory does not reconcile to bulk printing/finish identities');
  const issues = await client.query("SELECT code, count(*)::int AS count FROM reconciliation_issues WHERE NOT (details ? 'resolution') GROUP BY code ORDER BY code");
  const dangerousRecommendations = await client.query("SELECT count(*)::int AS rows FROM reconciliation_issues issues JOIN interpretation_checkpoints checkpoints ON checkpoints.id=issues.source_record_id WHERE issues.code='checkpoint_selected_unavailable_ck_bid' AND checkpoints.disposition='JUST SELL TO BUYLIST'");
  const receiptPath = join(root, '.local/import/handoff-ingestion-report.json');
  const receipt = JSON.parse(readFileSync(receiptPath, 'utf8'));
  receipt.repeat_import_full_content_verified = true;
  receipt.bulk_identity_verified_rows = inventory.rows.length;
  receipt.unavailable_ck_just_sell_recommendations = dangerousRecommendations.rows[0].rows;
  receipt.current_unresolved_issues_by_code = Object.fromEntries(issues.rows.map(r => [r.code, r.count]));
  writeFileSync(receiptPath, JSON.stringify(receipt, null, 2) + '\n');
  writeFileSync(join(root, '.local/import/verified-database-fingerprint.json'), JSON.stringify(after, null, 2) + '\n');
  console.log(JSON.stringify({ repeat_import: 'All table contents unchanged', exact_bulk_identity_rows: inventory.rows.length, unresolved_issues: receipt.current_unresolved_issues_by_code, unavailable_ck_just_sell_recommendations: receipt.unavailable_ck_just_sell_recommendations }, null, 2));
} finally { await client.end(); }
