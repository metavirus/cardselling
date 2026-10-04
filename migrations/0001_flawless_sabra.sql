CREATE TABLE "card_reference_snapshots" (
	"source_file_id" text NOT NULL,
	"scryfall_id" uuid NOT NULL,
	"raw" jsonb NOT NULL,
	CONSTRAINT "card_reference_snapshots_source_file_id_scryfall_id_pk" PRIMARY KEY("source_file_id","scryfall_id")
);
--> statement-breakpoint
CREATE TABLE "import_batches" (
	"id" text PRIMARY KEY NOT NULL,
	"inventory_snapshot_id" text NOT NULL,
	"report" jsonb NOT NULL,
	"committed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "interpretation_checkpoints" (
	"id" text PRIMARY KEY NOT NULL,
	"holding_id" text,
	"match_status" text NOT NULL,
	"kind" text NOT NULL,
	"disposition" text,
	"timing_signal" text,
	"confidence_label" text,
	"reason" text NOT NULL,
	"observed_date_text" text NOT NULL,
	"review_required" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inventory_holdings" (
	"id" text PRIMARY KEY NOT NULL,
	"snapshot_id" text NOT NULL,
	"scryfall_id" uuid NOT NULL,
	"name" text NOT NULL,
	"set_code" text NOT NULL,
	"collector_number" text NOT NULL,
	"finish" text NOT NULL,
	"language" text NOT NULL,
	"condition" text NOT NULL,
	"quantity" integer NOT NULL,
	"scan_reference_price" numeric,
	"currency" text NOT NULL,
	"added_at" timestamp with time zone NOT NULL,
	"flags" jsonb NOT NULL,
	CONSTRAINT "snapshot_variant" UNIQUE("snapshot_id","scryfall_id","finish","language","condition"),
	CONSTRAINT "positive_inventory_quantity" CHECK ("inventory_holdings"."quantity" > 0),
	CONSTRAINT "inventory_finish" CHECK ("inventory_holdings"."finish" IN ('normal', 'foil', 'etched'))
);
--> statement-breakpoint
CREATE TABLE "inventory_snapshots" (
	"id" text PRIMARY KEY NOT NULL,
	"row_count" integer NOT NULL,
	"copy_count" integer NOT NULL,
	"scope" text NOT NULL,
	"imported_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "market_observations" (
	"id" text PRIMARY KEY NOT NULL,
	"source_record_id" text NOT NULL,
	"holding_id" text,
	"match_status" text NOT NULL,
	"provider" text NOT NULL,
	"evidence_class" text NOT NULL,
	"metric" text NOT NULL,
	"value_text" text NOT NULL,
	"numeric_value" numeric,
	"units" text NOT NULL,
	"observed_date_text" text NOT NULL,
	"historical_period" text NOT NULL,
	"source_url" text,
	"limitations" text NOT NULL,
	CONSTRAINT "source_record_metric" UNIQUE("source_record_id","metric")
);
--> statement-breakpoint
CREATE TABLE "observation_evidence" (
	"observation_id" text NOT NULL,
	"source_record_id" text NOT NULL,
	CONSTRAINT "observation_evidence_observation_id_source_record_id_pk" PRIMARY KEY("observation_id","source_record_id")
);
--> statement-breakpoint
CREATE TABLE "reconciliation_issues" (
	"id" text PRIMARY KEY NOT NULL,
	"source_record_id" text NOT NULL,
	"holding_id" text,
	"code" text NOT NULL,
	"details" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "source_files" (
	"id" text PRIMARY KEY NOT NULL,
	"path" text NOT NULL,
	"classification" text NOT NULL,
	"byte_size" integer NOT NULL,
	"metadata" jsonb NOT NULL,
	"imported_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "source_records" (
	"id" text PRIMARY KEY NOT NULL,
	"source_file_id" text NOT NULL,
	"record_number" integer NOT NULL,
	"raw" jsonb NOT NULL,
	CONSTRAINT "source_record_number" UNIQUE("source_file_id","record_number")
);
--> statement-breakpoint
ALTER TABLE "card_reference_snapshots" ADD CONSTRAINT "card_reference_snapshots_source_file_id_source_files_id_fk" FOREIGN KEY ("source_file_id") REFERENCES "public"."source_files"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "import_batches" ADD CONSTRAINT "import_batches_inventory_snapshot_id_inventory_snapshots_id_fk" FOREIGN KEY ("inventory_snapshot_id") REFERENCES "public"."inventory_snapshots"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interpretation_checkpoints" ADD CONSTRAINT "interpretation_checkpoints_id_source_records_id_fk" FOREIGN KEY ("id") REFERENCES "public"."source_records"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interpretation_checkpoints" ADD CONSTRAINT "interpretation_checkpoints_holding_id_inventory_holdings_id_fk" FOREIGN KEY ("holding_id") REFERENCES "public"."inventory_holdings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_holdings" ADD CONSTRAINT "inventory_holdings_id_source_records_id_fk" FOREIGN KEY ("id") REFERENCES "public"."source_records"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_holdings" ADD CONSTRAINT "inventory_holdings_snapshot_id_inventory_snapshots_id_fk" FOREIGN KEY ("snapshot_id") REFERENCES "public"."inventory_snapshots"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_snapshots" ADD CONSTRAINT "inventory_snapshots_id_source_files_id_fk" FOREIGN KEY ("id") REFERENCES "public"."source_files"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "market_observations" ADD CONSTRAINT "market_observations_source_record_id_source_records_id_fk" FOREIGN KEY ("source_record_id") REFERENCES "public"."source_records"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "market_observations" ADD CONSTRAINT "market_observations_holding_id_inventory_holdings_id_fk" FOREIGN KEY ("holding_id") REFERENCES "public"."inventory_holdings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "observation_evidence" ADD CONSTRAINT "observation_evidence_observation_id_market_observations_id_fk" FOREIGN KEY ("observation_id") REFERENCES "public"."market_observations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "observation_evidence" ADD CONSTRAINT "observation_evidence_source_record_id_source_records_id_fk" FOREIGN KEY ("source_record_id") REFERENCES "public"."source_records"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reconciliation_issues" ADD CONSTRAINT "reconciliation_issues_source_record_id_source_records_id_fk" FOREIGN KEY ("source_record_id") REFERENCES "public"."source_records"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reconciliation_issues" ADD CONSTRAINT "reconciliation_issues_holding_id_inventory_holdings_id_fk" FOREIGN KEY ("holding_id") REFERENCES "public"."inventory_holdings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "source_records" ADD CONSTRAINT "source_records_source_file_id_source_files_id_fk" FOREIGN KEY ("source_file_id") REFERENCES "public"."source_files"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "reference_scryfall_id" ON "card_reference_snapshots" USING btree ("scryfall_id");--> statement-breakpoint
CREATE INDEX "observation_holding" ON "market_observations" USING btree ("holding_id");