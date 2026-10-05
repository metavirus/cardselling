# Additional historical normalization — October 4, 2026

This is additive evidence ingestion, not a sale decision or inventory change.
The owner excludes European/Cardmarket prices from this workflow; they remain
only in the unchanged original bulk archive and are not imported by this adapter.

## Genuine histories recovered from retained sources

The complete official MTGJSON `AllPrices.json.gz` already retained in private
storage contains more useful USD history than the earlier adapter selected.
A rolled-back trial of `scripts/ingest-mtgjson-extra-history.mjs` validated:

| Series | Daily points | Covered inventory lots | Source dates |
|---|---:|---:|---|
| Card Kingdom retail reference, USD | 58,892 | 702 | July 6–October 4, 2026 |
| Mana Pool retail reference, USD | 61,877 | 722 | July 6–October 4, 2026 |
| Total | 120,769 | Coverage overlaps | |

There are 1,424 accepted product mappings. Stock stays 723 lots / 817 owned and
available copies. Source date precision is one day, not a timed quote. These are
retail reference histories, **not additional transaction records**. They have
unknown aggregate grade/language composition and must not substitute for an
exact-grade executable offer or seller net. Mana Pool reference and Mana Pool
sales share an upstream market and do not count as independent confirmations.
CK retail and CK buylist are distinct sides of one dealer's pricing.

Provider/metric keys are `MTGJSON/cardkingdom` and `MTGJSON/manapool`, each with
`daily_retail_reference`, currency USD, `source_signal`, and condition scope
`not_applicable`. They fit the existing canonical schema without a migration.

## Import and identity contract

- Validate original compressed source hashes and inventory extract hashes against
  the retained extraction receipt. Match every source record to its archived JSON.
- Read the current accepted, unsuperseded Scryfall mapping for each canonical lot.
  Never treat a stale original scan ID as authority over accepted corrections.
- Require Scryfall ID, set code, collector number, printed language and finish to
  match the MTGJSON identity. Card Kingdom requires the finish-specific native
  product ID and English ordinary-stock language gate.
- Mana Pool additionally requires the MTGJSON UUID to match its catalog `card_id`,
  and independently checks Scryfall/set/number and existence of the exact
  finish/language variant. That crosswalk verifies identity, not the reference's
  grade. Validate the catalog extract hash against its previously archived source.
- Reject a native product/finish ID reused for different Scryfall printings.
  Multiple MTGJSON face UUIDs for the same printing use one native-product subject;
  duplicate native-product/day values deduplicate, conflicting values fail closed.
- Validate real calendar days, dates no later than publication, finite nonnegative
  cent values and USD currency. Zero references stay in raw evidence but are not
  plotted/imported as valid free-card prices. Missing days are not interpolated.
- Record immutable capture, mappings and facts with source lineage, native product,
  MTGJSON UUID, date-only intervals, parser version and upstream independence key.
  Quote timestamps, capacity, transaction counts and seller proceeds remain null.
- Capture time reuses the original download's retained capture time; extracting
  another series today does not make old observations newly fresh.
- The current trial excludes 1 unmatched identity/finish record and 52 provider /
  finish combinations without an eligible native product. These are source-series
  exclusions, not new physical inventory problems. No native identity collision,
  duplicate price conflict or zero reference point was encountered.

## Commands and verification

`node scripts/ingest-mtgjson-extra-history.mjs` performs a transaction and rolls
it back. `--apply` explicitly commits; the delegated normalization work did not
apply it. Separate trial/applied receipts live in `.local/market-ingestion/`.

Trial verifies exact raw-source replay, all expected facts in eligible evidence,
identical replay inside the transaction, unchanged stock, and exact fact totals.
Six tests in `scripts/mtgjson-extra-history.test.mjs` cover wrong identities,
finish-specific native IDs, cross-source UUID matching, provider collisions,
invalid dates/prices/currency, exclusion of EUR, and duplicate/conflicting faces.

Applied observations remain immutable. A later source revision must be a new
capture; the plotting layer should select the latest applicable observation for
each provider/native-product/day while preserving earlier captures for audit.
Never average conflicts between TCGSentry and MTGJSON CK quotes: provider capture
age and semantics remain distinct, and the user should see the disagreement.

## Source semantics

Official [MTGJSON Price List](https://mtgjson.com/data-models/price/price-list/)
and [Price Formats](https://mtgjson.com/data-models/price/price-formats/) describe
provider-separated retail/buylist histories. The published schema does not make
these exact-condition executed sales. Integration conservatively preserves that
limitation in provenance rather than manufacturing sale or net labels.

Root applied the verified importer during this task: 120,769 USD observations,
1,424 mappings. Pre-apply backup was restored to a temporary database and verified
against full public-table content fingerprints. The applied receipt is
.local/market-ingestion/mtgjson-extra-applied.json. Inventory remained unchanged.

For subsequent TCGSentry downloads, scripts/ingest-dealer-refresh.mjs accepts a
.manifest.json containing file, sha256, captured_at and expected_rows. Default
execution rolls back; --apply persists only eligible market evidence. Same capture
replays are idempotent; identical bytes captured at a later time get a separate
capture without rewriting archived source bytes. The accepted inventory and
owner choices are never read from the exported spreadsheet.
