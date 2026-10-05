# Accepted scan additions — October 4, 2026

Sell (1).csv is an additions-only owner-authorized reconciliation, not a new
master inventory. SHA-256: 6b0b766915d6da943aa4f34012de5c64417ee4288d7f29bc5221f6aace938f6e.

All 723 prior lot source identities and quantities remain present. Added 35 lots
with 36 copies: current canonical inventory 758 lots / 853 copies. Stable scan
identity uses ManaBox ID, Added timestamp, Scryfall ID, finish, raw language and
raw condition; accepted owner normalization remains separate and unchanged.
Scan reference price changes do not mutate acquisition costs or market facts.

The reusable importer stages a transaction and rolls back by default. Missing
prior source rows, changed quantities, duplicated stable identities, unsupported
finishes or special physical flags stop reconciliation for explicit review.
Only accepted new rows create external-to-available stock movements. Hash-based
source records, stable movement idempotency and an immediate repeat verify that
replay creates zero stock. Snapshot source is retired after reconciliation; raw
rows and hash persist in SQL even after original CSV disposal.

Backup full-content restoration passed before application. Canonical verifier
now includes accepted additions rather than hardcoding opening stock totals;
20 checks and 52 unit tests passed. No owner choices or prior source corrections
changed. Build-analysis-input partitions now cover arbitrary collection size;
partial AI review save validates the exact additions set by source hash.

Hydration reads retained structured catalogs with original observation/capture
dates. Missing evidence remains unknown; scan reference prices are not substitutes
for dealer demand or transaction evidence. Coverage receipt follows completion.

## Applied enrichment coverage

All 35 lots validated against retained full Scryfall records; accepted mappings
supersede their intake candidates. Exact owner-grade Mana Pool products cover
35/35, as do retained CK buylist/retail, TCG and Mana Pool USD reference histories
and EDHREC ranks. 105 additional raw source records, 350 market mappings and
12,733 observations were persisted. Source capture dates remain original:
Mana Pool 2026-10-04 20:07 UTC; MTGJSON 22:08 UTC. This is enrichment from
retained captures, not a new live refresh. New-item dealer wanted quantity is
unknown. Hydration trial/replay protected inventory, owner choices and existing
reviews. Precise coverage/hashes retained in .local/market-ingestion.

Verification caught a mixed-column bulk serialization defect affecting 132
observations’ date/currency fields. Forward replacements supersede the originals;
no immutable facts were edited. The serializer now unions all row columns, with
a regression test covering price-history date windows and nonprice ranks. All
35 additions have nonempty date-renderable history series and card metadata.
Final verification: 53 unit tests and 20 canonical checks pass.

All 35 added lots /36 copies now have individually authored immutable AI reviews, run a345fa5a-1daf-5b4f-ad75-6131ab369c9a. Existing reviews and owner choices are unchanged.

Post-ingestion backup restored with every public table’s full content fingerprint matching the completed database. Original D:/Repository/Desktop/Sell (1).csv was hash-checked and discarded as requested; its758 raw rows,35 accepted additions and source hash remain in SQL and verified backup.
