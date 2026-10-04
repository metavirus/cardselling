# Current state — October 4, 2026

The local PostgreSQL canonical store is operational. The accepted ManaBox Sell.csv
baseline remains **723 physical lots / 817 copies**. Subsequent owner corrections
are stored in canonical assertions and normalized fields; source rows are
preserved. The database, not a spreadsheet, owns stock. Retired TCGSentry exports
are hydration/history only. `canonical_inventory` is the current-stock view.

## Accepted facts

- 720 lots are owner-graded Near Mint; three are Lightly Played. Mana Pool's
  ManaBox CSV import translation does not regrade the cards.
- Five SOA Japanese-only printings are normalized to Japanese, despite English
  labels in original ManaBox rows and English booster packaging. The five
  physical lots, quantities and raw records remain distinct. Japanese
  Gigantosaurus, eight Phyrexian treatments and nonfoil Psychic Frog #433 are
  settled. See `identity-clarifications.md`. Do not reopen these from retired
  source flags or conflicting enrichment.
- No active Scryfall identity candidates or Mana Pool exact-product mismatches
  remain for the 723 lots. Three SOA lots share provider products with other
  separate lots; market observations are stored once per provider product.

## Market evidence available

- The retained Mana Pool catalog maps every lot by printing, finish and printed
  language. Five grade scenarios yield 3,615 product-grade mappings, 27,649
  observations, including 22,151 bounded sale-sample records and 1,898 asks.
  The same product's samples are not duplicated for separate physical lots.
- An official dated MTGJSON capture adds 52,184 Card Kingdom indicative NM
  buylist points and 63,759 TCGplayer retail reference points from its rolling
  price history. These are provider observations, not fresh executable quotes,
  dealer capacity or completed sales. Exact identity and language gates apply.
- MTGJSON-transmitted EDHREC ranks add gameplay-interest context. A rank is not
  exact-printing liquidity or a sale count.
- `canonical_lot_market_evidence` joins lot, owner grade and exact Mana Pool
  product. `scripts/market-insights.mjs` produces a read-only research queue,
  not sell/hold recommendations. See `market-ingestion.md`.

## Still needed for decisions

Current actionable dealer bids and wanted quantities, physical grade acceptance,
order-level shipping/material costs, fee settlement, comparable completed sales
coverage and evidence-based disposition logic are incomplete. Mana Pool samples
are capped and of unknown completeness; MTGJSON TCG prices are reference prices.
Do not infer market-wide velocity, realized proceeds or profit from them. The
order-economics module can calculate scenarios with explicit inputs; it does not
supply unknown postage, labor or sell-through probability. MagicCon Atlanta in
November is a planned workflow; no vendor quote or transaction is recorded.

No product interface, collector service, automatic recommendation, sale workflow,
vendor communication or hosting is complete. The visible app is a local
development status page. Desktop-first and mobile-capable remain the direction.

## Operational checks

Use `npm run db:canonical-status`, `npm run db:verify-canonical` and
`npm run db:verify-market`. Custom SQL migrations are authoritative; do not use
`drizzle push` or rerun retired bootstrap/import commands as live stock updates.
The original starting-data audit and older reanalysis are historical checkpoints;
their unresolved flags and counts no longer describe current state.
