# Market evidence — October 4, 2026

The canonical inventory is unchanged at **723 lots / 817 copies**. Owner
clarifications and external evidence are separate, durable records. This is
research evidence, not an executable disposition engine.

## Retained Mana Pool catalog

The hashed public catalog is retained privately. Exact printing, finish and
printed-language reconciliation covers all 723 lots. Five condition scenarios
produce 3,615 provider-grade mappings, 27,649 typed observations, 22,151
bounded sale-sample records and 1,898 asks. Three separate SOA physical lots
share products already mapped by other lots, so observations are not multiplied
by lot count. Use `canonical_lot_market_evidence` to select the owner-normalized
grade and provider product. The other grades are comparison evidence, not extra
stock or interchangeable valuations.

The owner grades 720 lots NM and three LP. [Mana Pool's ManaBox CSV grade
translation](https://support.manapool.com/hc/en-us/articles/26131255560855-CSV-Inventory-Export-ManaBox-Format)
is an import convention; it is not a physical grading decision. Original
condition strings are preserved. [Grading guidelines](https://support.manapool.com/hc/en-us/articles/37104256330391-Card-Grading-Guidelines).

Sale samples have an up-to-20-record cap per product, unknown completeness and
no stable transaction identity. Some overlap between captures may be invisible.
The reported sale-price unit basis and seller net are unverified. The original
catalog's latest sampled sale was October 2 and some records predate October
2025. Count samples as bounded evidence, never complete market velocity.

## Dated MTGJSON evidence

The official October 4 [AllPrices](https://www.mtgjson.net/downloads/all-files/)
and [AllIdentifiers](https://www.mtgjson.net/data-models/identifiers/) files are
retained as hashed private source artifacts. Exact Scryfall/set/collector/
finish/language mapping accepts 699 identity-matched inventory variants;
Japanese Gigantosaurus is deliberately excluded where MTGJSON defaults to an
English product. The resulting 115,943 dated observations comprise 52,184
indicative Card Kingdom NM buylist points and 63,759 TCGplayer retail price
references. These are rolling historical price points, neither dealer quotes
with wanted quantities nor transaction prices. CK base NM points are mapped
only where the language scope is English. TCGplayer price scope has no condition
guarantee. [Price-list semantics](https://www.mtgjson.net/data-models/price/price-list/),
[price-point semantics](https://www.mtgjson.net/data-models/price/price-points/).

The same identity file transmits EDHREC rank for 662 unique ranks / 717 exact
variant mappings. Rank measures functional-card gameplay interest, not buyer
count, exact-printing popularity or completed-sale velocity.
[MTGJSON card-set model](https://www.mtgjson.com/data-models/card/card-set/),
[EDHREC FAQ](https://edhrec.com/faq).

## Questions that still matter

- A public buylist amount is an indicative base-grade signal. A dealer's current
  wanted quantity, exact product eligibility, accepted grade and checkout terms
  must be captured separately before calling it an actionable quote. Card
  Kingdom's ordinary submissions are generally English-language and bulk
  purchasing is currently paused; other languages may require buyer approval.
  [How to sell](https://www.cardkingdom.com/purchasing/how_to_sell),
  [CSV import](https://www.cardkingdom.com/static/csvImport).
- Marketplace proceeds require actual order composition, postage, materials,
  fee settlement and any return/loss costs. `scripts/order-economics.mjs` keeps
  those inputs explicit and can leave net unknown. It does not establish a
  card-level take-home amount or a probability of sale.
- Price gaps and EDHREC rank can prioritize research. They do not alone justify
  “Just Sell,” MagicCon, retail or hold. MagicCon quotes need vendor, event,
  condition, quantity and expiry recorded; no such quote exists yet.

## Reproduction

`prepare-market-evidence.mjs` and `extract-manapool-evidence.py` prepare the
retained catalog; `ingest-market-evidence.mjs` defaults to a rolled-back trial
and `--apply` persists it atomically. `extract-mtgjson-evidence.py` streams the
official gzip files; `ingest-mtgjson-evidence.mjs` and
`ingest-edhrec-rank.mjs` likewise support trial and `--apply`. All source bytes
and structured extracts stay in ignored `data/private/`.
`verify-market-evidence.mjs` and `verify-canonical.mjs` check lot, mapping and
stock invariants. Replays were checked for no duplicate observations. Older
capture counts in historical audit files are not current coverage figures.
