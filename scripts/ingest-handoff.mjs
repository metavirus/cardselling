import { createReadStream, readFileSync, readdirSync, statSync, mkdirSync, writeFileSync } from 'node:fs';
import { createGunzip } from 'node:zlib';
import { createInterface } from 'node:readline';
import { execFileSync } from 'node:child_process';
import { join, relative, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { appClient, backup, root, start } from './database.mjs';
import { csv, decimal, integer, identity, variantKey, match, hash, ckExecutableQuantity, bulkIdentityMatches } from './import-domain.mjs';
import { requireLegacyMode } from './legacy-guard.mjs';
await requireLegacyMode();

const intake = resolve(root, process.argv[2] || 'data/private/intake/2026-10-04/handoff');
if (!intake.startsWith(resolve(root, 'data/private') + '\\') && !intake.startsWith(resolve(root, 'data/private') + '/')) throw new Error('Intake must be inside ignored data/private.');
const privateWork = join(root, '.local', 'import');
mkdirSync(privateWork, { recursive: true });
const reportPath = join(privateWork, 'handoff-ingestion-report.json');
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const tables = {
  source_files: { id: 'text', path: 'text', classification: 'text', byte_size: 'integer', metadata: 'jsonb' },
  source_records: { id: 'text', source_file_id: 'text', record_number: 'integer', raw: 'jsonb' },
  inventory_snapshots: { id: 'text', row_count: 'integer', copy_count: 'integer', scope: 'text' },
  inventory_holdings: { id: 'text', snapshot_id: 'text', scryfall_id: 'uuid', name: 'text', set_code: 'text', collector_number: 'text', finish: 'text', language: 'text', condition: 'text', quantity: 'integer', scan_reference_price: 'numeric', currency: 'text', added_at: 'timestamptz', flags: 'jsonb' },
  card_reference_snapshots: { source_file_id: 'text', scryfall_id: 'uuid', raw: 'jsonb' },
  market_observations: { id: 'text', source_record_id: 'text', holding_id: 'text', match_status: 'text', provider: 'text', evidence_class: 'text', metric: 'text', value_text: 'text', numeric_value: 'numeric', units: 'text', observed_date_text: 'text', historical_period: 'text', source_url: 'text', limitations: 'text' },
  observation_evidence: { observation_id: 'text', source_record_id: 'text' },
  interpretation_checkpoints: { id: 'text', holding_id: 'text', match_status: 'text', kind: 'text', disposition: 'text', timing_signal: 'text', confidence_label: 'text', reason: 'text', observed_date_text: 'text', review_required: 'boolean' },
  reconciliation_issues: { id: 'text', source_record_id: 'text', holding_id: 'text', code: 'text', details: 'jsonb' },
  import_batches: { id: 'text', inventory_snapshot_id: 'text', report: 'jsonb' }
};

async function insert(client, table, rows, size = 500) {
  const definition = tables[table];
  if (!definition) throw new Error('Unknown import table');
  const columns = Object.keys(definition).map(c => `"${c}"`).join(', ');
  const types = Object.entries(definition).map(([c, t]) => `"${c}" ${t}`).join(', ');
  for (let offset = 0; offset < rows.length; offset += size) {
    await client.query(`INSERT INTO "${table}" (${columns}) SELECT ${columns} FROM jsonb_to_recordset($1::jsonb) AS input(${types}) ON CONFLICT DO NOTHING`, [JSON.stringify(rows.slice(offset, offset + size))]);
  }
}
async function digestFile(path) {
  const digest = createHash('sha256');
  for await (const chunk of createReadStream(path)) digest.update(chunk);
  return digest.digest('hex');
}
function listFiles(path) {
  return readdirSync(path, { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? listFiles(join(path, entry.name)) : [join(path, entry.name)]);
}
function numericOrNull(text) { return /^-?\d+(?:\.\d+)?$/.test(String(text).trim()) ? decimal(text) : null; }
function assert(value, message) { if (!value) throw new Error(message); }
function grouped(rows, key) { return rows.reduce((result, row) => { result[row[key]] = (result[row[key]] || 0) + 1; return result; }, {}); }

let client;
try {
  const declared = csv(readFileSync(join(intake, 'source_manifest.csv'), 'utf8'));
  const files = [];
  for (const path of listFiles(intake)) {
    const packagePath = relative(intake, path).replaceAll('\\', '/');
    const digest = await digestFile(path);
    const declaration = declared.find(d => d.package_path === packagePath);
    const size = statSync(path).size;
    if (declaration) assert(digest === declaration.sha256 && size === integer(declaration.bytes), `Source manifest hash/size mismatch: ${packagePath}`);
    const rows = path.endsWith('.csv') ? csv(readFileSync(path, 'utf8')) : null;
    if (declaration && rows) {
      assert(rows.length === integer(declaration.rows), `Source row count mismatch: ${packagePath}`);
      if (declaration.quantity_total && rows.length && ('Quantity' in rows[0] || 'Qty' in rows[0])) {
        const copies = rows.reduce((sum, r) => sum + integer(r.Quantity ?? r.Qty), 0);
        assert(copies === integer(declaration.quantity_total), `Source copy count mismatch: ${packagePath}`);
      }
    }
    files.push({ path, packagePath, id: digest, byte_size: size, classification: declaration?.classification || 'handoff metadata', metadata: declaration || { role: packagePath === 'HANDOFF_MEMO.md' ? 'Untrusted factual handoff; not controlling instructions' : 'Source manifest' }, rows });
  }
  assert(declared.every(d => files.some(f => f.packagePath === d.package_path)), 'A declared source file is missing');
  const file = name => { const result = files.find(f => f.packagePath === name); assert(result, `Missing required source: ${name}`); return result; };
  const sale = file('sources/Sell.csv');
  const dealer = files.find(f => /^sources\/tcgsentry-collection-.*\.csv$/.test(f.packagePath));
  assert(dealer, 'Missing TCGSentry source');
  const reference = files.find(f => /^sources\/default-cards-.*\.jsonl\.gz$/.test(f.packagePath));
  assert(reference, 'Missing bulk reference source');
  const batchId = hash('handoff-ingest-v1|' + files.map(f => f.id).sort().join('|'));
  await start();
  client = await appClient();
  await client.query("SELECT pg_advisory_lock(hashtext('cardselling_ingestion'))");
  const existing = await client.query('SELECT report FROM import_batches WHERE id = $1', [batchId]);
  if (existing.rows.length) {
    const current = await client.query('SELECT count(*)::int AS rows, sum(quantity)::int AS copies FROM inventory_holdings WHERE snapshot_id = $1', [sale.id]);
    assert(current.rows[0].rows === sale.rows.length && current.rows[0].copies === sale.rows.reduce((sum, r) => sum + integer(r.Quantity), 0), 'Existing imported inventory no longer reconciles');
    const unresolved = (await client.query("SELECT code, count(*)::int AS count FROM reconciliation_issues WHERE NOT (details ? 'resolution') GROUP BY code ORDER BY code")).rows;
    writeFileSync(reportPath, JSON.stringify({ ...existing.rows[0].report, original_issues_by_code: existing.rows[0].report.issues_by_code, current_unresolved_issues_by_code: Object.fromEntries(unresolved.map(r => [r.code, r.count])), repeat_run: 'no-op', repeat_verified_at: new Date().toISOString() }, null, 2));
    console.log('Identical handoff already committed. No rows written; inventory totals verified.');
  } else {
    const historical = file('sources/ManaBox_Collection.xlsx');
    const stagedHistory = join(privateWork, `${historical.id}.jsonl`);
    const python = process.env.CARDSELLING_PYTHON || 'C:/Users/kavig/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe';
    const historyStats = JSON.parse(execFileSync(python, [join(root, 'scripts/extract-history.py'), historical.path, stagedHistory], { encoding: 'utf8', timeout: 60000 }));
    historical.rows = readFileSync(stagedHistory, 'utf8').trimEnd().split('\n').map(line => JSON.parse(line));
    assert(historyStats.rows === integer(historical.metadata.rows) && historyStats.copies === integer(historical.metadata.quantity_total), 'Historical workbook totals do not match manifest');
    console.log(`Validated ${files.length} source files and source hashes. Historical workbook remains background evidence.`);

    const records = files.flatMap(f => (f.rows || []).map((raw, index) => ({ id: `${f.id}:${index + 1}`, source_file_id: f.id, record_number: index + 1, raw })));
    const recordsFor = f => records.filter(r => r.source_file_id === f.id);
    const holdings = recordsFor(sale);
    const seen = new Set();
    for (const record of holdings) {
      const key = variantKey(identity(record.raw));
      assert(!seen.has(key), 'Duplicate exact inventory variant; refusing automatic merge'); seen.add(key);
      assert(uuidPattern.test(record.raw['Scryfall ID']), 'Invalid inventory Scryfall identity');
      assert(integer(record.raw.Quantity) > 0, 'Inventory quantity must be positive');
      assert(['normal', 'foil', 'etched'].includes(record.raw.Foil), 'Unrecognized inventory finish');
      assert(['Misprint', 'Altered', 'Signed', 'Proxy'].every(k => ['true', 'false'].includes(record.raw[k])), 'Invalid inventory flags');
      assert(!Number.isNaN(Date.parse(record.raw.Added)) && /Z$/.test(record.raw.Added), 'Inventory added timestamp is not explicit UTC');
    }
    const issueRows = [];
    function issue(record, holdingId, code, details) {
      issueRows.push({ id: hash(`${record.id}|${code}`), source_record_id: record.id, holding_id: holdingId, code, details });
    }
    const observations = [];
    const links = [];
    const dealerMatchCounts = {};
    const normalizedLookup = new Map();
    const dealerRows = recordsFor(dealer);
    const dateMatch = dealer.packagePath.match(/(\d{4}-\d{2}-\d{2})-(\d{2})(\d{2})\.csv$/);
    assert(dateMatch, 'Dealer observation filename does not identify its date/time');
    const dealerDate = `${dateMatch[1]} ${dateMatch[2]}:${dateMatch[3]} (filename; timezone not encoded)`;
    const fields = [
      ['CardKingdom price', 'cardkingdom_bid', 'dealer_bid', 'USD/card'],
      ['CardKingdom qty', 'cardkingdom_wanted_qty', 'wanted_quantity', 'copies'],
      ['Star City Games price', 'star_city_games_bid', 'dealer_bid', 'USD/card'],
      ['TCGplayer estimated net', 'tcgplayer_estimated_net', 'modeled_proceeds', 'USD/card'],
      ['ManaPool estimated net', 'mana_pool_estimated_net', 'modeled_proceeds', 'USD/card'],
      ['Sell signal', 'tcgsentry_sell_signal', 'source_signal', 'label']
    ];
    for (const record of dealerRows) {
      const matched = match(record.raw, holdings);
      dealerMatchCounts[matched.status] = (dealerMatchCounts[matched.status] || 0) + 1;
      if (matched.status !== 'exact') issue(record, matched.holdingId, 'dealer_identity_requires_review', matched);
      const holding = holdings.find(h => h.id === matched.holdingId);
      if (holding && integer(record.raw.Quantity) !== integer(holding.raw.Quantity)) issue(record, holding.id, 'dealer_inventory_quantity_difference', { source_quantity: integer(record.raw.Quantity), inventory_quantity: integer(holding.raw.Quantity) });
      const eligible = matched.status === 'exact' && holding?.raw.Language === 'en' && holding?.raw.Condition === 'near_mint';
      const capacity = ckExecutableQuantity(holding ? integer(holding.raw.Quantity) : 0, record.raw['CardKingdom qty'] || null, eligible);
      if (record.raw['CardKingdom price'] && record.raw['CardKingdom qty'] === '0') issue(record, matched.holdingId, 'cardkingdom_zero_demand', { quoted_price: record.raw['CardKingdom price'], executable_quantity: capacity });
      for (const [column, metric, evidenceClass, units] of fields) {
        const value = record.raw[column];
        if (value === '') continue;
        const observed = { id: hash(`${record.id}|${metric}`), source_record_id: record.id, holding_id: matched.holdingId, match_status: matched.status, provider: 'TCGSentry export', evidence_class: evidenceClass, metric, value_text: value, numeric_value: units === 'label' ? null : decimal(value), units, observed_date_text: dealerDate, historical_period: 'point-in-time unless metric is TCGSentry sell signal', source_url: record.raw['TCGplayer product ID'] ? `https://tcgsentry.com/product/${record.raw['TCGplayer product ID']}` : null, limitations: metric === 'cardkingdom_bid' ? 'Quoted price; zero wanted quantity means no indicated capacity. Subject to condition/grading. Language/finish matching must be exact.' : metric === 'star_city_games_bid' ? 'Wanted quantity is unavailable; executable capacity is unknown. Subject to grading and exact identity.' : evidenceClass === 'modeled_proceeds' ? 'Source-provided estimate; fee formula, shipping, packaging, and labor have not been independently verified.' : 'Source assertion, not executed sale or canonical inventory.' };
        observations.push(observed); links.push({ observation_id: observed.id, source_record_id: record.id });
        const lookupKey = [variantKey(identity(record.raw)), metric, observed.numeric_value ?? value].join('|');
        assert(!normalizedLookup.has(lookupKey), 'Ambiguous dealer observation fingerprint');
        normalizedLookup.set(lookupKey, observed);
      }
    }
    let deduplicatedEvidence = 0;
    const research = recordsFor(file('evidence/research_observations.csv'));
    for (const record of research) {
      const raw = record.raw;
      if (raw.source_file === dealer.packagePath.split('/').at(-1)) {
        const key = [variantKey(identity(raw)), raw.metric, numericOrNull(raw.value) ?? raw.value].join('|');
        const original = normalizedLookup.get(key);
        assert(original && original.observed_date_text === raw.observation_date, 'Normalized dealer evidence does not reconcile to original export');
        links.push({ observation_id: original.id, source_record_id: record.id }); deduplicatedEvidence++;
        continue;
      }
      const matched = match(raw, holdings);
      if (!matched.holdingId) issue(record, null, 'research_identity_requires_review', matched);
      assert(raw.value !== '', 'Blank normalized evidence must remain absent, not a value');
      const observed = { id: hash(`${record.id}|${raw.metric}`), source_record_id: record.id, holding_id: matched.holdingId, match_status: matched.status, provider: raw.source, evidence_class: raw.evidence_class, metric: raw.metric, value_text: raw.value, numeric_value: numericOrNull(raw.value), units: raw.units || 'unspecified', observed_date_text: raw.observation_date, historical_period: raw.historical_period, source_url: raw.source_url || null, limitations: raw.limitations || 'Imported research assertion; not independently refreshed or verified.' };
      observations.push(observed); links.push({ observation_id: observed.id, source_record_id: record.id });
    }
    for (const holding of holdings) {
      if (!dealerRows.some(r => match(r.raw, [holding]).status === 'exact')) issue(holding, holding.id, 'inventory_without_exact_dealer_match', { identity: identity(holding.raw) });
    }
    const interpretations = [];
    const finalRows = recordsFor(file('derived/final_disposition_data.csv'));
    const linkedFinal = new Set();
    for (const record of finalRows) {
      const matched = match(record.raw, holdings);
      assert(matched.status === 'exact', 'Final workbook row does not exactly match sale inventory');
      assert(!linkedFinal.has(matched.holdingId), 'Final workbook duplicates an inventory row'); linkedFinal.add(matched.holdingId);
      const holding = holdings.find(h => h.id === matched.holdingId);
      assert(integer(record.raw.Qty) === integer(holding.raw.Quantity), 'Final workbook quantity differs from source inventory');
      if (record.raw['Best store'] === 'Card Kingdom' && decimal(record.raw['CK wanted qty']) === '0') issue(record, holding.id, 'checkpoint_selected_unavailable_ck_bid', { disposition: record.raw['Final disposition'], quoted_price: record.raw['Best cash buylist'], indicated_capacity: 0 });
      interpretations.push({ id: record.id, holding_id: matched.holdingId, match_status: matched.status, kind: 'imported_exploration_recommendation', disposition: record.raw['Final disposition'], timing_signal: record.raw['Timing signal'] || null, confidence_label: record.raw.Confidence || null, reason: record.raw.Reason, observed_date_text: record.raw.Observed, review_required: true });
    }
    assert(linkedFinal.size === holdings.length, 'Final workbook does not cover all inventory rows');
    for (const record of recordsFor(file('evidence/manual_interpretations.csv'))) {
      const matched = match(record.raw, holdings);
      if (!matched.holdingId) issue(record, null, 'manual_interpretation_identity_requires_review', matched);
      interpretations.push({ id: record.id, holding_id: matched.holdingId, match_status: matched.status, kind: 'imported_manual_judgment', disposition: record.raw.history_adjusted_action, timing_signal: record.raw.timing_signal || null, confidence_label: null, reason: record.raw.research_note, observed_date_text: record.raw.observed, review_required: true });
    }
    // Preserve all original/derived rows, but only Sell.csv creates physical holdings.
    const before = await backup();
    await client.query('BEGIN');
    await insert(client, 'source_files', files.map(f => ({ id: f.id, path: relative(root, f.path).replaceAll('\\', '/'), classification: f.classification, byte_size: f.byte_size, metadata: f.metadata })));
    await insert(client, 'source_records', records);
    const copyCount = holdings.reduce((sum, h) => sum + integer(h.raw.Quantity), 0);
    await insert(client, 'inventory_snapshots', [{ id: sale.id, row_count: holdings.length, copy_count: copyCount, scope: 'Verified sale tranche only; historical collection is background evidence' }]);
    await insert(client, 'inventory_holdings', holdings.map(h => ({ id: h.id, snapshot_id: sale.id, scryfall_id: h.raw['Scryfall ID'], name: h.raw.Name, set_code: h.raw['Set code'], collector_number: h.raw['Collector number'], finish: h.raw.Foil, language: h.raw.Language, condition: h.raw.Condition, quantity: integer(h.raw.Quantity), scan_reference_price: decimal(h.raw['Purchase price']), currency: h.raw['Purchase price currency'], added_at: h.raw.Added, flags: Object.fromEntries(['Misprint', 'Altered', 'Signed', 'Proxy'].map(k => [k.toLowerCase(), h.raw[k] === 'true'])) })));
    const needed = new Map(holdings.map(h => [h.raw['Scryfall ID'], null]));
    let referenceCount = 0;
    let buffer = [];
    const lines = createInterface({ input: createReadStream(reference.path).pipe(createGunzip()), crlfDelay: Infinity });
    for await (const line of lines) {
      if (!line.trim()) continue;
      const raw = JSON.parse(line);
      assert(raw.object === 'card' && uuidPattern.test(raw.id), 'Malformed bulk reference record');
      if (needed.has(raw.id)) needed.set(raw.id, raw);
      buffer.push({ source_file_id: reference.id, scryfall_id: raw.id, raw }); referenceCount++;
      if (buffer.length === 500) { await insert(client, 'card_reference_snapshots', buffer); buffer = []; }
      if (referenceCount % 20000 === 0) console.log(`Loaded ${referenceCount} bulk reference records into the pending transaction.`);
    }
    if (buffer.length) await insert(client, 'card_reference_snapshots', buffer);
    assert(referenceCount === integer(reference.metadata.rows), 'Bulk reference count differs from source manifest');
    const persistedReferences = await client.query('select count(*)::int as count from card_reference_snapshots where source_file_id=$1', [reference.id]);
    assert(persistedReferences.rows[0].count === referenceCount, 'Duplicate or missing bulk reference identities');
    for (const holding of holdings) {
      const card = needed.get(holding.raw['Scryfall ID']);
      if (!card) { issue(holding, holding.id, 'inventory_missing_bulk_reference', { bulk_snapshot: reference.metadata.date_or_scope }); continue; }
      const actual = identity(holding.raw);
      if (!bulkIdentityMatches(holding.raw, card)) issue(holding, holding.id, 'inventory_bulk_identity_conflict', { source_identity: actual, reference_set: card.set, reference_collector: card.collector_number, reference_finishes: card.finishes });
    }
    for (const record of finalRows) {
      const holding = holdings.find(h => h.id === match(record.raw, holdings).holdingId);
      const card = needed.get(holding.raw['Scryfall ID']);
      const priceField = { normal: 'usd', foil: 'usd_foil', etched: 'usd_etched' }[holding.raw.Foil];
      if (card && decimal(record.raw['Scryfall exact USD']) !== decimal(card.prices?.[priceField])) issue(record, holding.id, 'checkpoint_bulk_price_difference', { checkpoint_value: record.raw['Scryfall exact USD'] || null, reference_value: card.prices?.[priceField] ?? null });
    }
    await insert(client, 'market_observations', observations);
    await insert(client, 'observation_evidence', links);
    await insert(client, 'interpretation_checkpoints', interpretations);
    await insert(client, 'reconciliation_issues', issueRows);
    // Read back every structured source row and holding, not just aggregate counts.
    for (const f of files.filter(f => f.rows)) {
      const stored = await client.query('SELECT raw FROM source_records WHERE source_file_id=$1 ORDER BY record_number', [f.id]);
      assert(isDeepStrictEqual(stored.rows.map(r => r.raw), f.rows), `Structured source readback differs: ${f.packagePath}`);
    }
    const storedHoldings = await client.query('SELECT id, scryfall_id, finish, language, condition, quantity, scan_reference_price, currency FROM inventory_holdings WHERE snapshot_id=$1 ORDER BY id', [sale.id]);
    assert(storedHoldings.rows.length === holdings.length && storedHoldings.rows.reduce((s, r) => s + r.quantity, 0) === copyCount, 'Inventory readback totals differ');
    for (const row of storedHoldings.rows) {
      const raw = holdings.find(h => h.id === row.id).raw;
      assert(row.scryfall_id === raw['Scryfall ID'] && row.finish === raw.Foil && row.language === raw.Language && row.condition === raw.Condition && row.quantity === integer(raw.Quantity) && decimal(row.scan_reference_price) === decimal(raw['Purchase price']) && row.currency === raw['Purchase price currency'], 'Typed inventory readback differs');
    }
    const storedObservations = await client.query('SELECT count(*)::int AS count FROM market_observations WHERE source_record_id=ANY($1::text[])', [records.map(r => r.id)]);
    assert(storedObservations.rows[0].count === observations.length, 'Market observation readback count differs');
    const report = { batch_id: batchId, imported_at: new Date().toISOString(), source_files: files.length, source_records: records.length, sale_rows: holdings.length, sale_copies: copyCount, historical_rows: historyStats.rows, historical_copies: historyStats.copies, historical_role: 'background only', bulk_reference_records: referenceCount, dealer_source_rows: dealerRows.length, dealer_source_copies: dealerRows.reduce((s, r) => s + integer(r.raw.Quantity), 0), dealer_matches: dealerMatchCounts, research_source_rows: research.length, normalized_dealer_evidence_deduplicated: deduplicatedEvidence, market_observations: observations.length, imported_recommendations: finalRows.length, imported_manual_judgments: interpretations.length - finalRows.length, issues_by_code: grouped(issueRows, 'code'), pre_import_backup: before, interpretation_status: 'Historical exploration; all checkpoints require reassessment before execution', unparsed_artifacts: files.filter(f => !f.rows && f !== reference).map(f => f.packagePath), verification: 'All structured source rows and canonical holdings read back; source hashes, row/copy counts, reference count, and observation count reconcile.' };
    await insert(client, 'import_batches', [{ id: batchId, inventory_snapshot_id: sale.id, report }]);
    await client.query('COMMIT');
    writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n');
    console.log(JSON.stringify({ sale_rows: report.sale_rows, sale_copies: report.sale_copies, reference_records: referenceCount, market_observations: observations.length, issues_by_code: report.issues_by_code }, null, 2));
    console.log('Import committed after readback validation. Private receipt: .local/import/handoff-ingestion-report.json');
  }
} catch (error) {
  if (client) await client.query('ROLLBACK').catch(() => {});
  console.error(String(error.message).replace(/postgres(?:ql)?:\/\/\S+/g, '[redacted connection]').split('\n')[0]);
  process.exitCode = 1;
} finally { if (client) await client.end(); }
