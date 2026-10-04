# Canonical database and artifact retirement

The local PostgreSQL database is the operational source of truth after the
`initial_manabox` adoption. ManaBox's accepted scan supplies the opening physical
inventory. Later owner corrections and explicit inventory transactions belong in
the database. No spreadsheet or enrichment export continuously overrides it.

## Authority

| Domain | Authoritative record | Supporting evidence |
|---|---|---|
| Printed variant | `canonical_variants` and `canonical_assertions` | Accepted ManaBox fields, owner corrections, evidenced normalization |
| Physical stock | `canonical_lots`, `canonical_stock_movements`, `canonical_inventory` view | Opening source rows; later accepted reconciliation/events |
| Provider product match | `canonical_product_mappings` | Candidate/accepted/rejected mappings with finish, language, condition scope and basis |
| Market facts | `canonical_captures`, `canonical_observations` | Timestamped original source captures, upstream lineage and sample limitations |
| Dealer offers | `canonical_quotes`, `canonical_quote_lines` | Cash/credit distinction, capacity, conditions, expiry and event context |
| Assumptions | `canonical_policies` | Versioned accepted/proposed rules and source references |
| Recommendations | `canonical_decision_runs`, `canonical_decisions` | Pinned input manifest, code/model versions and explainable proposal |
| Owner choices | `canonical_owner_choices` | Separate from model suggestions |
| Actual sales/cash | `canonical_transactions`, `canonical_transaction_lines`, `canonical_cash_entries` | Allocated copies, settlement and costs; payouts are not extra revenue |
| Historical artifacts | Existing `source_files`, `source_records` and legacy snapshot/evidence tables | Retained original bytes, hashes and interpretations, with retirement records |

Authoritative SQL is `migrations/0002_canonical_store.sql` plus forward migration
`migrations/0003_owner-lot-evidence.sql`, which adds the exact lot-to-market view.
The earlier
`data-model.json` is a superseded logical exploration, not a second live schema.
These custom SQL objects are intentionally outside the legacy Drizzle table
snapshot. Future canonical changes use reviewed custom forward SQL migrations;
never use `drizzle push`. The database migration checksum ledger covers them.
`canonical-schema.json` is an introspected documentation export of the applied
columns, constraints and views, not a separate editable schema authority.

## Adoption and retirement

`scripts/adopt-canonical.mjs` adopts the already-ingested accepted ManaBox baseline
in a transaction. It requires one baseline, 723 rows and 817 copies. It creates
local UUIDs, a provenance assertion and one opening stock event per lot, with
unique source/idempotency keys. It preserves separate holdings and conditions.
It does not read CSV/XLSX, use the dealer export, or infer quantities from prices.
Repeating adoption returns the recorded receipt without reseeding or resetting.

Eight known ONE Phyrexian-script rows get `printed_language=ph` with an explicit
normalization assertion; raw English export values remain preserved. Japanese
SOA rows and Gigantosaurus retain Japanese. Psychic Frog MH3 #433 stays nonfoil.
Five formerly English-labelled SOA rows now carry accepted Japanese printed
language and Scryfall mappings through owner-backed assertions. Raw ManaBox rows,
separate physical lots and quantities remain intact. The other SOA rows retain
their own recorded languages. See `identity-clarifications.md`.

Every existing source artifact is marked historical-only at adoption. The original
files stay in ignored private storage; no destructive deletion or relocation is
needed. Existing observations and workbook interpretations stay in their legacy
tables and are not copied into current eligible evidence or new recommendations.
Historical counts and prior analysis outputs remain historical checkpoints.

The old ingestion and reanalysis commands refuse to run after adoption. Database
triggers also freeze the legacy snapshot/evidence tables against writes, including
truncate, after cutover. Source files/rows may receive new captures but existing
rows cannot be updated or deleted. Refreshes belong in the new evidence tables.

At cutover, eligible market evidence and new recommendation counts were zero.
The first controlled ingestion is documented in `market-ingestion.md`; market
evidence is now populated and recommendations remain empty. A future decision
can cite historical evidence explicitly with its age and limitations, but nothing
in the ordinary eligible-evidence view revives retired artifacts automatically.

## Required operating rules

- Read stock through `canonical_inventory`; never sum imported snapshots.
- Stock movements serialize on the lot and cannot spend a negative balance.
  Reservations reduce available quantity, not owned quantity. Events are append-only.
- Corrections preserve source assertions and record their basis. Do not infer
  physical uncertainty merely from a hydration mismatch.
- Capture time, source time and transaction time are distinct. Unknown is null.
  Prices are exact numeric values with currency and unit; zero remains zero.
- An accepted enrichment mapping still must agree with finish and printed language
  to enter `canonical_eligible_evidence`. Condition scope must be checked for each
  lot by the future comparison service. Eligible does not mean fresh or executable.
- Mana Pool mappings include each provider grade as separate comparison
  evidence. Never sum or blend grades into lot values. Owner-normalized condition
  is 720 NM / 3 LP; its published ManaBox CSV grade conversion is only a file
  import convention. `canonical_lot_market_evidence` scopes exact product and
  owner grade for lot research. Three separate SOA lots share provider products;
  do not duplicate their market observations or merge the physical lots.
- Preserve source sample caps/completeness. Repeated last-20 sale samples are not
  independent sales and must not be summed into fabricated volume.
- A quote's unknown capacity is null; zero is zero. Cash and store credit differ.
- Proposed assumptions and historical recommendations are not owner decisions.
  AI proposals cannot move stock. Pin evidence and policy IDs in run manifests.
- Future imports stage a comparison against current lots and need accepted
  reconciliation before generating stock events. Reimporting a snapshot cannot
  reset sales, resurrect missing copies or create duplicate inventory.
- CSV/XLSX output is a dated view for portability or a dealer, never a second master.

## Scope of this implementation

Implemented: schema, one-time inventory adoption, owner corrections, stored
baseline policies, provenance, artifact retirement, current-stock and exact
lot-market views, eligible-evidence view, append-only fact constraints,
nonnegative stock checks and retirement guards. Controlled Mana Pool and MTGJSON
historical evidence ingestion and EDHREC-rank hydration have also run.

The quote, recommendation and transaction tables establish the replacement schema;
they do not constitute working sales workflows. No UI, collector or sale action
is enabled. Future services must implement full decision-schema validation,
accepted correction/reconciliation workflows, policy/evidence manifest validation,
cross-lot dealer-capacity allocation, quote expiry, condition compatibility,
transaction state transitions and order-level cash calculations before execution.
Those are bounded follow-on capabilities, not assertions of completed features.

## Verification and commands

`npm run db:canonical-status` reads current counts. `npm run db:verify-canonical`
tests baseline adoption idempotency, physical fields, preservation of 817 copies,
owner language/finish confirmations, retirement guards, nonnegative stock,
reservation accounting, immutable evidence and incompatible enrichment exclusion.
All test writes roll back. `--prepare` validates the pending migration and adoption
in a rolled-back transaction before deployment; do not use it after migration.

Backup and isolated restore verification precede cutover. `db:migrate` creates an
additional backup and applies reviewed SQL transactionally. A subsequent restore
check must cover canonical tables as well as the retained archive. The existing
content fingerprint checks every public table, including these canonical tables.

Verified at cutover: 20 canonical database checks, 10 existing tests, TypeScript,
repeat adoption and migration, both legacy CLI guards, and pre/post-cutover backup
restores with matching full table-content fingerprints. Live counts: 723 lots,
817 available/owned copies, 16 retired artifacts, 3,718 archived observations,
784 archived interpretations, zero new eligible observations and decisions.
