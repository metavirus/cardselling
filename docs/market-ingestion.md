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

## Targeted Card Kingdom public capture

A read-only October 4 public buylist check covers 24 selected exact lots.
Twenty-two were listed with cash indications and displayed maximum wanted
quantities; two exact products were not listed. The retained, hashed private
capture generated 46 observations. A missing listing is not a zero-dollar bid
or proof of zero demand. These page readings are more recent than MTGJSON's
historical CK series, but prices and capacities may change before checkout.
Neither the page nor the resulting records constitute an approved dealer order.
The historical CK observations remain available alongside, rather than being
overwritten. See `buylist-first-pass.md` for how this capture was used.

## Fresh TCGSentry dealer hydration

The October 4 16:25 local collection export is retained as a new source, separate
from retired exports. Source SHA-256 is
`61cd4b4ab90e6a4958183b45b7a28422ee5d446282aaa3a4faa97b03987ede1e`;
capture ID is `8377a4df-188a-50c4-ac57-58641ab340d1`.
The 718 original rows are preserved. Exact accepted identity and grade gates
permit 700 CK bid/quantity pairs and 695 SCG bid indications (2,095 observations).
Eighteen incompatible or unsupported rows retain rejected mappings. This does
not reopen owner inventory assertions. Raw modeled net, source cost and sell
signal fields remain source context, not accepted prices, cost basis or decisions.

Vendor refresh times are unknown: observed-at and market-window fields are null.
Captured-at records the download; filename time is retained with its local basis.
SCG capacity is unknown. CK has 124 positive-price rows with zero wanted quantity;
the comparison excludes those bids from available alternatives. Native dealer
SKUs are not independently established by an exact aggregator row match.

`ingest-tcgsentry-current.mjs` is a scoped trial/apply importer with immutable
replay checks. It cannot change stock, accept a quote or execute a sale.
`compare-tcgsentry-buyers.mjs` compares the retained export against canonical
stock and the pinned first-pass economics without overwriting that prior report.

## Remaining decision inputs

- A public buylist amount and displayed wanted quantity are indicative signals.
  Exact checkout capacity, eligibility, accepted grade and terms must be
  confirmed before calling it an actionable quote. Card
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
`ingest-ck-checks.mjs` ingests the private exact-product page checks with trial
and `--apply` modes; it does not change stock. No broad Card Kingdom collector
or automated checkout has been implemented.
