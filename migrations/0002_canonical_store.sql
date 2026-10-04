-- Canonical domain store. SQL owns these tables/views/triggers; the Drizzle
-- snapshot continues to describe legacy archive tables only. Never drizzle push.
CREATE TABLE canonical_variants (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL,
 set_code text NOT NULL, collector_number text NOT NULL,
 finish text NOT NULL CHECK (finish IN ('normal','foil','etched')),
 treatment text, printed_language text NOT NULL,
 identity_basis text NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE canonical_lots (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 variant_id uuid NOT NULL REFERENCES canonical_variants,
 origin_record_id text UNIQUE REFERENCES source_records,
 condition_raw text NOT NULL, condition_normalized text,
 location text, notes text, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX canonical_lots_variant ON canonical_lots(variant_id);
CREATE TABLE canonical_assertions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 lot_id uuid REFERENCES canonical_lots, variant_id uuid REFERENCES canonical_variants,
 field_name text NOT NULL, value jsonb NOT NULL,
 authority text NOT NULL CHECK(authority IN ('accepted_inventory','owner','normalization')),
 basis text NOT NULL, source_record_id text REFERENCES source_records,
 supersedes_id uuid UNIQUE REFERENCES canonical_assertions,
 recorded_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX canonical_assertions_lot ON canonical_assertions(lot_id);
CREATE TABLE canonical_captures (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), provider text NOT NULL,
 upstream_provider text NOT NULL, source_file_id text REFERENCES source_files,
 source_url text, content_hash text NOT NULL, captured_at timestamptz NOT NULL,
 source_observed_at timestamptz, source_time_text text,
 use_state text NOT NULL CHECK(use_state IN ('historical','eligible','rejected')),
 sample_kind text NOT NULL, sample_limit integer CHECK(sample_limit>0),
 completeness text NOT NULL CHECK(completeness IN ('complete','capped','unknown')),
 window_start timestamptz, window_end timestamptz,
 metadata jsonb NOT NULL DEFAULT '{}',
 CHECK(window_end IS NULL OR window_start IS NULL OR window_end>=window_start)
);
CREATE INDEX canonical_captures_provider_time ON canonical_captures(provider,captured_at DESC);
CREATE TABLE canonical_product_mappings (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 variant_id uuid NOT NULL REFERENCES canonical_variants,
 provider text NOT NULL, product_id text NOT NULL,
 condition_scope text NOT NULL, finish_scope text NOT NULL, language_scope text NOT NULL,
 status text NOT NULL CHECK(status IN ('candidate','accepted','rejected')),
 basis text NOT NULL, source_record_id text REFERENCES source_records,
 capture_id uuid REFERENCES canonical_captures,
 supersedes_id uuid UNIQUE REFERENCES canonical_product_mappings,
 recorded_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX canonical_mappings_subject ON canonical_product_mappings(provider,product_id);
CREATE INDEX canonical_mappings_variant ON canonical_product_mappings(variant_id);
CREATE TABLE canonical_observations (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 capture_id uuid NOT NULL REFERENCES canonical_captures,
 mapping_id uuid REFERENCES canonical_product_mappings,
 source_locator text NOT NULL, provider_subject text NOT NULL,
 metric text NOT NULL,
 evidence_kind text NOT NULL CHECK(evidence_kind IN
 ('asking_price','completed_sale','sale_aggregate','bid','demand','modeled_proceeds',
 'listing_count','source_signal','qualitative','policy','deck_adoption')),
 numeric_value numeric, text_value text, currency text CHECK(currency ~ '^[A-Z]{3}$'),
 unit text NOT NULL, price_basis text NOT NULL DEFAULT 'unknown',
 observed_at timestamptz, window_start timestamptz, window_end timestamptz,
 quantity integer CHECK(quantity>=0), sample_count integer CHECK(sample_count>=0),
 limitations text NOT NULL, raw jsonb NOT NULL,
 supersedes_id uuid UNIQUE REFERENCES canonical_observations,
 CHECK(numeric_value IS NOT NULL OR text_value IS NOT NULL),
 CHECK(window_end IS NULL OR window_start IS NULL OR window_end>=window_start),
 UNIQUE(capture_id,source_locator,metric)
);
CREATE INDEX canonical_observations_mapping ON canonical_observations(mapping_id);
CREATE TABLE canonical_policies (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), kind text NOT NULL,
 version text NOT NULL, status text NOT NULL CHECK(status IN ('proposed','accepted','superseded')),
 rules jsonb NOT NULL, source_refs jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(kind,version)
);
CREATE TABLE canonical_decision_runs (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), input_manifest jsonb NOT NULL,
 code_version text NOT NULL, model_id text, prompt_version text,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE canonical_decisions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), run_id uuid NOT NULL REFERENCES canonical_decision_runs,
 lot_id uuid NOT NULL REFERENCES canonical_lots, quantity integer NOT NULL CHECK(quantity>0),
 proposal jsonb NOT NULL CHECK(jsonb_typeof(proposal)='object'),
 supersedes_id uuid UNIQUE REFERENCES canonical_decisions,
 recorded_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX canonical_decisions_lot ON canonical_decisions(lot_id);
CREATE TABLE canonical_owner_choices (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), decision_id uuid REFERENCES canonical_decisions,
 lot_id uuid NOT NULL REFERENCES canonical_lots, choice text NOT NULL, reason text NOT NULL,
 supersedes_id uuid UNIQUE REFERENCES canonical_owner_choices,
 recorded_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE canonical_quotes (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), capture_id uuid NOT NULL REFERENCES canonical_captures,
 provider text NOT NULL, channel text NOT NULL CHECK(channel IN ('mailed_buylist','event_vendor','local_buyer')),
 event_name text, event_start date, event_end date,
 state text NOT NULL CHECK(state IN ('indicative','requested','approved','expired','declined','finalized')),
 payment_kind text NOT NULL CHECK(payment_kind IN ('cash','store_credit','other')),
 currency text NOT NULL CHECK(currency ~ '^[A-Z]{3}$'), valid_until timestamptz,
 conditions text NOT NULL, supersedes_id uuid UNIQUE REFERENCES canonical_quotes,
 recorded_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE canonical_quote_lines (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), quote_id uuid NOT NULL REFERENCES canonical_quotes,
 mapping_id uuid NOT NULL REFERENCES canonical_product_mappings,
 price numeric NOT NULL CHECK(price>=0), price_scope text NOT NULL CHECK(price_scope IN ('per_copy','bundle_total')),
 capacity integer CHECK(capacity>=0), grade_basis text NOT NULL, bundle_scope jsonb,
 CHECK(price_scope<>'bundle_total' OR bundle_scope IS NOT NULL)
);
CREATE INDEX canonical_quote_lines_quote ON canonical_quote_lines(quote_id);
CREATE TABLE canonical_transactions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), provider text NOT NULL, external_order_id text,
 channel text NOT NULL, currency text NOT NULL CHECK(currency ~ '^[A-Z]{3}$'),
 state text NOT NULL CHECK(state IN ('proposed','reserved','shipped','partially_finalized','finalized','cancelled')),
 active_minutes numeric CHECK(active_minutes>=0), created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(provider,external_order_id)
);
CREATE TABLE canonical_transaction_lines (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), transaction_id uuid NOT NULL REFERENCES canonical_transactions,
 lot_id uuid NOT NULL REFERENCES canonical_lots, quote_line_id uuid REFERENCES canonical_quote_lines,
 quantity integer NOT NULL CHECK(quantity>0), unit_price numeric CHECK(unit_price>=0),
 accepted_quantity integer CHECK(accepted_quantity>=0), returned_quantity integer CHECK(returned_quantity>=0),
 CHECK(coalesce(accepted_quantity,0)+coalesce(returned_quantity,0)<=quantity)
);
CREATE INDEX canonical_transaction_lines_lot ON canonical_transaction_lines(lot_id);
CREATE INDEX canonical_transaction_lines_transaction ON canonical_transaction_lines(transaction_id);
CREATE TABLE canonical_cash_entries (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), transaction_id uuid NOT NULL REFERENCES canonical_transactions,
 kind text NOT NULL CHECK(kind IN ('merchandise','shipping_credit','marketplace_fee','processing_fee','postage','materials','refund','other','payout')),
 amount numeric NOT NULL, currency text NOT NULL CHECK(currency ~ '^[A-Z]{3}$'),
 basis text NOT NULL CHECK(basis IN ('estimate','actual')), source_record_id text REFERENCES source_records,
 event_at timestamptz, recorded_at timestamptz NOT NULL DEFAULT now(),
 reverses_id uuid UNIQUE REFERENCES canonical_cash_entries, external_id text,
 UNIQUE(transaction_id,external_id)
);
CREATE INDEX canonical_cash_transaction ON canonical_cash_entries(transaction_id);
CREATE TABLE canonical_stock_movements (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), lot_id uuid NOT NULL REFERENCES canonical_lots,
 quantity integer NOT NULL CHECK(quantity>0),
 from_state text NOT NULL CHECK(from_state IN ('external','available','reserved','outbound','quarantine','sold','removed')),
 to_state text NOT NULL CHECK(to_state IN ('available','reserved','outbound','quarantine','sold','removed')),
 reason text NOT NULL, idempotency_key text NOT NULL UNIQUE,
 source_record_id text REFERENCES source_records, transaction_line_id uuid REFERENCES canonical_transaction_lines,
 event_at timestamptz, recorded_at timestamptz NOT NULL DEFAULT now(),
 CHECK(from_state<>to_state)
);
CREATE INDEX canonical_stock_lot ON canonical_stock_movements(lot_id);
CREATE TABLE canonical_cutovers (
 name text PRIMARY KEY CHECK(name='initial_manabox'),
 source_file_id text NOT NULL REFERENCES source_files,
 lot_count integer NOT NULL, copy_count integer NOT NULL,
 adopted_at timestamptz NOT NULL DEFAULT now(), details jsonb NOT NULL
);
CREATE TABLE canonical_source_retirements (
 source_file_id text PRIMARY KEY REFERENCES source_files,
 reason text NOT NULL, retired_at timestamptz NOT NULL DEFAULT now()
);

-- Immutable facts get replacements or compensating events, not silent rewrites.
CREATE FUNCTION canonical_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Canonical evidence is append-only; record a replacement or compensating event'; END $$;
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['canonical_assertions','canonical_captures','canonical_product_mappings',
 'canonical_observations','canonical_decision_runs','canonical_decisions','canonical_owner_choices',
 'canonical_stock_movements','canonical_cash_entries','canonical_cutovers','canonical_source_retirements'] LOOP
 EXECUTE format('CREATE TRIGGER immutable_fact BEFORE UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION canonical_immutable()',t);
 END LOOP;
END $$;

CREATE FUNCTION canonical_check_stock() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE balance bigint; linked_lot uuid;
BEGIN
 PERFORM 1 FROM canonical_lots WHERE id=NEW.lot_id FOR UPDATE;
 IF NEW.from_state<>'external' THEN
 SELECT coalesce(sum(CASE WHEN to_state=NEW.from_state THEN quantity ELSE 0 END
 - CASE WHEN from_state=NEW.from_state THEN quantity ELSE 0 END),0)
 INTO balance FROM canonical_stock_movements WHERE lot_id=NEW.lot_id;
 IF balance<NEW.quantity THEN RAISE EXCEPTION 'Insufficient stock in %', NEW.from_state; END IF;
 END IF;
 IF NEW.transaction_line_id IS NOT NULL THEN
 SELECT lot_id INTO linked_lot FROM canonical_transaction_lines WHERE id=NEW.transaction_line_id;
 IF linked_lot IS DISTINCT FROM NEW.lot_id THEN RAISE EXCEPTION 'Transaction line belongs to another lot'; END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER stock_balance BEFORE INSERT ON canonical_stock_movements
 FOR EACH ROW EXECUTE FUNCTION canonical_check_stock();

CREATE FUNCTION canonical_freeze_legacy() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF EXISTS(SELECT 1 FROM canonical_cutovers WHERE name='initial_manabox') THEN
 RAISE EXCEPTION 'Legacy snapshot tables are historical after canonical cutover';
 END IF;
 RETURN NULL;
END $$;
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['inventory_snapshots','inventory_holdings','market_observations',
 'observation_evidence','interpretation_checkpoints','reconciliation_issues','import_batches','card_reference_snapshots'] LOOP
 EXECUTE format('CREATE TRIGGER freeze_legacy BEFORE INSERT OR UPDATE OR DELETE OR TRUNCATE ON %I FOR EACH STATEMENT EXECUTE FUNCTION canonical_freeze_legacy()',t);
 END LOOP;
 -- New evidence may be archived, but retained bytes/rows cannot be rewritten.
 FOREACH t IN ARRAY ARRAY['source_files','source_records'] LOOP
 EXECUTE format('CREATE TRIGGER immutable_source BEFORE UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION canonical_immutable()',t);
 END LOOP;
END $$;

CREATE VIEW canonical_inventory AS
 SELECT l.id AS lot_id,l.origin_record_id,v.id AS variant_id,v.name,v.set_code,v.collector_number,
 v.finish,v.treatment,v.printed_language,l.condition_raw,l.condition_normalized,l.location,
 coalesce(sum(CASE WHEN m.to_state='available' THEN m.quantity ELSE 0 END
 - CASE WHEN m.from_state='available' THEN m.quantity ELSE 0 END),0)::integer AS available_quantity,
 coalesce(sum(CASE WHEN m.to_state IN ('available','reserved','outbound','quarantine') THEN m.quantity ELSE 0 END
 - CASE WHEN m.from_state IN ('available','reserved','outbound','quarantine') THEN m.quantity ELSE 0 END),0)::integer AS owned_quantity
 FROM canonical_lots l JOIN canonical_variants v ON v.id=l.variant_id
 LEFT JOIN canonical_stock_movements m ON m.lot_id=l.id
 GROUP BY l.id,v.id;

-- Eligible means fit for analysis, never guaranteed fresh or executable cash.
CREATE VIEW canonical_eligible_evidence AS
 SELECT o.*,m.variant_id,c.provider,c.upstream_provider,c.captured_at,
 c.sample_kind,c.sample_limit,c.completeness
 FROM canonical_observations o JOIN canonical_captures c ON c.id=o.capture_id
 JOIN canonical_product_mappings m ON m.id=o.mapping_id
 JOIN canonical_variants v ON v.id=m.variant_id
 WHERE c.use_state='eligible' AND m.status='accepted'
 AND m.finish_scope=v.finish AND m.language_scope=v.printed_language
 AND NOT EXISTS(SELECT 1 FROM canonical_product_mappings next WHERE next.supersedes_id=m.id)
 AND NOT EXISTS(SELECT 1 FROM canonical_observations next WHERE next.supersedes_id=o.id)
 AND NOT EXISTS(SELECT 1 FROM canonical_source_retirements r WHERE r.source_file_id=c.source_file_id);
