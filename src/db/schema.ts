import { boolean, check, index, integer, jsonb, numeric, pgTable, primaryKey, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const applicationInfo = pgTable("application_info", {
  id: uuid("id").primaryKey(),
  application: text("application").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
});

export const sourceFiles = pgTable("source_files", {
  id: text("id").primaryKey(), // SHA-256 of original bytes
  path: text("path").notNull(),
  classification: text("classification").notNull(),
  byteSize: integer("byte_size").notNull(),
  metadata: jsonb("metadata").notNull(),
  importedAt: timestamp("imported_at", { withTimezone: true }).notNull().defaultNow()
});

export const sourceRecords = pgTable("source_records", {
  id: text("id").primaryKey(),
  sourceFileId: text("source_file_id").notNull().references(() => sourceFiles.id),
  recordNumber: integer("record_number").notNull(),
  raw: jsonb("raw").notNull()
}, table => [unique("source_record_number").on(table.sourceFileId, table.recordNumber)]);

export const inventorySnapshots = pgTable("inventory_snapshots", {
  id: text("id").primaryKey().references(() => sourceFiles.id),
  rowCount: integer("row_count").notNull(),
  copyCount: integer("copy_count").notNull(),
  scope: text("scope").notNull(),
  importedAt: timestamp("imported_at", { withTimezone: true }).notNull().defaultNow()
});

export const inventoryHoldings = pgTable("inventory_holdings", {
  id: text("id").primaryKey().references(() => sourceRecords.id),
  snapshotId: text("snapshot_id").notNull().references(() => inventorySnapshots.id),
  scryfallId: uuid("scryfall_id").notNull(),
  name: text("name").notNull(),
  setCode: text("set_code").notNull(),
  collectorNumber: text("collector_number").notNull(),
  finish: text("finish").notNull(),
  language: text("language").notNull(),
  condition: text("condition").notNull(),
  quantity: integer("quantity").notNull(),
  scanReferencePrice: numeric("scan_reference_price"),
  currency: text("currency").notNull(),
  addedAt: timestamp("added_at", { withTimezone: true }).notNull(),
  flags: jsonb("flags").notNull()
}, table => [
  unique("snapshot_variant").on(table.snapshotId, table.scryfallId, table.finish, table.language, table.condition),
  check("positive_inventory_quantity", sql`${table.quantity} > 0`),
  check("inventory_finish", sql`${table.finish} IN ('normal', 'foil', 'etched')`)
]);

export const cardReferenceSnapshots = pgTable("card_reference_snapshots", {
  sourceFileId: text("source_file_id").notNull().references(() => sourceFiles.id),
  scryfallId: uuid("scryfall_id").notNull(),
  raw: jsonb("raw").notNull()
}, table => [primaryKey({ columns: [table.sourceFileId, table.scryfallId] }), index("reference_scryfall_id").on(table.scryfallId)]);

export const marketObservations = pgTable("market_observations", {
  id: text("id").primaryKey(),
  sourceRecordId: text("source_record_id").notNull().references(() => sourceRecords.id),
  holdingId: text("holding_id").references(() => inventoryHoldings.id),
  matchStatus: text("match_status").notNull(),
  provider: text("provider").notNull(),
  evidenceClass: text("evidence_class").notNull(),
  metric: text("metric").notNull(),
  valueText: text("value_text").notNull(),
  numericValue: numeric("numeric_value"),
  units: text("units").notNull(),
  observedDateText: text("observed_date_text").notNull(),
  historicalPeriod: text("historical_period").notNull(),
  sourceUrl: text("source_url"),
  limitations: text("limitations").notNull()
}, table => [unique("source_record_metric").on(table.sourceRecordId, table.metric), index("observation_holding").on(table.holdingId)]);

export const observationEvidence = pgTable("observation_evidence", {
  observationId: text("observation_id").notNull().references(() => marketObservations.id),
  sourceRecordId: text("source_record_id").notNull().references(() => sourceRecords.id)
}, table => [primaryKey({ columns: [table.observationId, table.sourceRecordId] })]);

export const interpretationCheckpoints = pgTable("interpretation_checkpoints", {
  id: text("id").primaryKey().references(() => sourceRecords.id),
  holdingId: text("holding_id").references(() => inventoryHoldings.id),
  matchStatus: text("match_status").notNull(),
  kind: text("kind").notNull(),
  disposition: text("disposition"),
  timingSignal: text("timing_signal"),
  confidenceLabel: text("confidence_label"),
  reason: text("reason").notNull(),
  observedDateText: text("observed_date_text").notNull(),
  reviewRequired: boolean("review_required").notNull().default(true)
});

export const reconciliationIssues = pgTable("reconciliation_issues", {
  id: text("id").primaryKey(),
  sourceRecordId: text("source_record_id").notNull().references(() => sourceRecords.id),
  holdingId: text("holding_id").references(() => inventoryHoldings.id),
  code: text("code").notNull(),
  details: jsonb("details").notNull()
});

export const importBatches = pgTable("import_batches", {
  id: text("id").primaryKey(),
  inventorySnapshotId: text("inventory_snapshot_id").notNull().references(() => inventorySnapshots.id),
  report: jsonb("report").notNull(),
  committedAt: timestamp("committed_at", { withTimezone: true }).notNull().defaultNow()
});
