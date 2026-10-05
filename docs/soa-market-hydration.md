# Verified SOA Japanese market hydration

October 4, 2026: the five accepted Japanese-only alternate-art SOA nonfoil
products have market activity and exact native catalog matches. Their physical
identity is settled. Missing dealer data resulted from an English-only CK
normalization guard and rejected `Language=en` metadata in the TCGSentry export.
No owner language or inventory correction is required.

| Printing | CK native product | TCG native product |
|---|---:|---:|
| Daze #80 | 325881 | 688905 |
| Crop Rotation #116 | 325887 | 688888 |
| Prismatic Ending #72 | 325842 | 688911 |
| Triumph of the Hordes #124 | 325934 | 689365 |
| Bring to Light #126 | 325961 | 689384 |

The retained AllIdentifiers records explicitly identify Japanese language,
Scryfall printing, set, number, finish and native CK/TCG products. Exact retained
AllPrices UUIDs contain USD CK buylist and retail histories. The
[CK Daze catalog page](https://www.cardkingdom.com/mtg%2Fsecrets-of-strixhaven-mystical-archive-jpn%2Fdaze-0080-jpn-alternate-art?partner=dawnglare)
identifies the JPN edition and #0080, with related exact Crop Rotation #0116
and Prismatic Ending #0072 catalog entries. Exact primary marketplace pages
include [Daze](https://www.tcgplayer.com/product/688905),
[Prismatic Ending](https://www.tcgplayer.com/product/688911), and
[Triumph](https://www.tcgplayer.com/product/689365).
Search-index catalog prices are not imported as current quotes.

## Targeted policy

`scripts/ingest-soa-market.mjs` leaves generic historical importers unchanged.
It accepts only the five products above, Japanese, nonfoil, near mint and active
accepted Scryfall mappings. The dated export must match exact Scryfall ID,
set, number, finish, NM condition, name and native TCG product. Its incorrect
English label is retained verbatim in source records and fact metadata, while
the independently established product identity supplies the correct Japanese
market mapping. Original rejected mappings remain immutable.

The original source hashes and extraction hashes are checked against
`mtgjson-extraction.json` and the dated TCGSentry manifest. Every used source
record must already be archived and equal the retained raw bytes. Source capture
times are reused, never replaced with parser execution time. Historical points
preserve day precision. Zero wanted quantity is retained; blank SCG is unknown.
Native product/day observations are stored once, with accepted mappings for all
eight physical lots. App evidence fanout must use those shared product mappings.

Trial result: **809 historical points + 10 dealer facts = 819 observations**, with
24 mappings across eight lots. Historical bids remain source indications;
current export bids/capacity retain aggregator provenance. No quote, sale,
reservation, inventory movement or owner choice is created.

## Execution

```
node scripts/ingest-soa-market.mjs
node scripts/ingest-soa-market.mjs --apply
```

Default mode rolls back. Root must perform the verified backup before apply.
Trial verifies immutable replay and full canonical inventory and decision
fingerprints. Receipts are written under `.local/market-ingestion/soa-*.json`.

The latest retained 19:33 Pacific export reports: Daze $2 / 16 wanted,
Prismatic Ending $2.75 / 23 wanted, Triumph $7.25 / 15 wanted,
Bring to Light $0.45 / 12 wanted, and Crop Rotation $11.50 / **0 wanted**.
Crop Rotation's earlier $13 historical bid must not imply present capacity.
