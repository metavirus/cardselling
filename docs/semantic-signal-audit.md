# Card-level selling signals — October 4, 2026

This read-only audit covers the **723 current inventory lots / 817 copies**. It
asks what we can infer about channel fit for the *exact printing*, especially
collector treatments. It does not change a plan, reserve stock, or claim a
probability of sale.

## What is useful now

The existing data can identify a printing's treatment and provide a bounded
activity signal, competing stock, and dealer interest. That is enough to decide
which **quote or sale comparison to research next** for each lot. It is not yet
enough to label a winning channel for every card. Actual accepted buyer quotes,
our own listing outcomes, and exact-treatment comps are the largest missing
pieces.

| Signal | Current lot coverage | Correct reading |
| --- | ---: | --- |
| Accepted Scryfall printing identity | 723 | Joins traits and artwork to accepted printing/finish/language. Exact retained bulk object is available for 722; the remaining accepted printing has a separate exact-ID source. |
| Mana Pool same-grade listed quantity | 723 | Competing supply snapshot, not completed sales. |
| Mana Pool same-grade low ask | 721 | Listing floor, not realized price or seller net. |
| Mana Pool returned sale records | 715 have any; 645 have ≥1 in 30 days; 698 have ≥1 in 90 days | Bounded exact-product samples. A zero returned count is not market-wide zero demand. |
| CK export bid with positive wanted quantity | 576 | Indicative cash and capacity at capture; vendor refresh time unknown. |
| SCG export bid | 695 | Indicative cash; buying quantity unknown. |
| Scryfall-transmitted EDHREC rank | 684 through accepted printing records | Functional-card play interest, not demand for a specific treatment. |

These counts are lot coverage, not independent transactions. One provider product
can serve more than one physical lot. Mana Pool's returned sales are capped at
20 records per product and may omit other sales; repeated captures may overlap.
The app pins 30- and 90-day windows to the evidence snapshot date so old data
does not silently appear to become new evidence as time passes. It selects the
latest capture per lot, so a future overlapping refresh does not inflate the
returned-record counts. The sale median shown elsewhere uses single-copy
records, so its sample count can differ from the activity count.

Scryfall metadata identifies 274 borderless lots, 97 extended-art lots, 73
showcase lots, 77 full-art lots, 69 Secret Lair lots, 10 raised-foil lots, and
7 surge-foil lots. Categories overlap. These are **printing descriptions**, not
scarcity or collector-premium measurements. The app presents the individual
traits and avoids a single “special card” score.

I also tested a price ratio between each exact printing and the cheapest
nonfoil printing of the same functional card. It has a reference price for 683
lots, but it is a poor automatic desirability score: a $0.08 basic Island makes
premium treatments appear hundreds or thousands of times dearer, while some
special printings have no exact reference price at all. Keep the raw price
comparison available for targeted research; do not use the ratio to infer sale
speed, profit, or channel.

## Examples that challenge simple rules

All prices and bids below are indications from the retained October 4 evidence.
The `30d / 90d` column is the number of **returned Mana Pool records** for the
same product and owner grade, not total market sales or units per day.

| Exact lot | Mana Pool low ask | 30d / 90d | Dealer indications | Best next comparison |
| --- | ---: | ---: | --- | --- |
| Foil Island, SLP #32 | $205.40 | 0 / 1 | CK $52, 5 wanted; SCG $80, capacity unknown | Exact-treatment sold comps and firm specialist/event bids. The high ask and thin sample cannot establish achievable proceeds or speed. |
| Foil Sol Ring, SLD #1604 | $111.99 | 5 / 15 | CK $45, **zero** wanted; SCG $45, capacity unknown | Retail test economics and a confirmed specialist quote. The CK number is not an available buying opportunity. |
| Demonic Tutor, CMM #696 | $101.37 | 6 / 18 | CK $75, 10 wanted; SCG $70, capacity unknown | Compare a refreshed CK cash quote with exact-sale median net after fulfillment. The broad bid creates a strong low-effort baseline. |
| Harmonize, SLD #1596★ | $79.23 | 0 / 10 | No usable exact dealer indication | Refresh exact-treatment comps and get a buyer quote. Earlier sample activity does not prove current velocity. |
| Astral Dragon, CLB #613 | $23.57 | 20 / 20, capped | CK $20.50, 26 wanted; SCG $12, capacity unknown | Avoid chasing a tiny apparent retail increment: the existing ask-based one-copy net is about $21.12 before labor or returns. |

## Channel evidence hierarchy

1. **Firm cash buylist or event quote:** exact printing, finish, language, grade,
   wanted quantity, expiry, fees and actual acceptance. We currently have
   indicative bids, not accepted checkout quotes. SCG capacity and convention
   quotes are missing.
2. **Exact-treatment completed sales:** dated, condition-matched transactions,
   delivered-price basis and sample scope. Mana Pool samples are the best
   retained broad signal, with a 20-record cap. Mana Pool now documents that
   its derived Market Price weights recent completed sales, starts from a
   median and excludes certain issue-reported or unique-photo listings; that
   derived figure is context rather than a transaction log.
   [Mana Pool methodology](https://support.manapool.com/hc/en-us/articles/42613350706327-How-Market-Price-is-Calculated)
3. **Other exact-product retail checks:** TCGplayer says its product-page Market
   Price uses recent completed sales and follows selected printing/condition
   filters; Most Recent Sale also follows those filters. It is useful for a
   targeted independent spot check, while a price point alone gives no unit
   count, sale probability or seller net.
   [TCGplayer price-point definitions](https://help.tcgplayer.com/hc/en-us/articles/222376867-What-do-the-different-price-points-on-TCGplayer-com-mean)
4. **A further buyer pool:** Cardsphere says card pages show ten recent
   completed trades and ten current offers. Its 3% send fee, sender-paid
   shipping, and withdrawal charge mean that a top offer is not take-home cash;
   exact printing and language still need checking.
   [Cardsphere tutorials and FAQ](https://www.cardsphere.com/tutorials)
5. **Collector comps outside card marketplaces:** eBay Product Research offers
   sold-price ranges, actual accepted Best Offer prices, shipping averages and
   90-day sell-through for searches. Magic variants still require manual title,
   image, condition and lot review; a broad search can mix treatments.
   [eBay Product Research](https://www.ebay.com/help/selling/selling-tools/product-research?id=4853)
6. **Gameplay interest and printing traits:** EDHREC rank, format legality,
   card type, Scryfall treatment tags and brand/IP context help decide which
   buyer may care. They are explanatory context, not exact-printing liquidity.
   [EDHREC methodology](https://edhrec.com/faq)

## First app interpretation

The detail panel now shows, for each lot, printing traits, returned 30-/90-day
sale-record counts, same-grade listed supply and card-level EDHREC rank. It
offers transparent **research leads**, separate from the owner plan and analyst
proposal:

- CK appears as a cash baseline only when its wanted quantity covers the lot.
- SCG is a quote lead when CK is unavailable or SCG's indicated whole-lot amount
  is at least $10 higher; its unknown capacity stays visible.
- Self-sale research appears when there are at least five returned 90-day records
  and sample-median modeled net clears CK by at least $15 for the whole lot, or
  reaches $30 without a usable CK bid. These are *effort triage thresholds*,
  not calibrated expected returns.
- A $50+ asking price with a tagged collector treatment triggers a MagicCon
  specialist-quote lead. The ask is only a screening input, not the event value.

The panel never automatically assigns a sale or hold direction. Holding needs
a card-specific thesis and review trigger. The current UI's self-sale column is
an ask-based scenario; the research lead uses sampled sale median instead.
Both remain sensitive to fees, postage, market depth and condition.

## Highest-value next telemetry

For special printings with large ask/bid gaps or thin exact-sale samples,
selectively capture a TCGplayer exact-product page and an eBay Product Research
sold search with manual treatment verification. For MagicCon, record actual
buyer-specific cash quotes, quantities, grading and expiry. Log our own listing
prices, time to sale, shipping/materials, buyer fees, returns and final net. That
outcome log will eventually calibrate whether a channel truly performs better
for this collection. Broad play or price feeds should be added only where they
can change a decision; more correlated reference prices will not replace
exact-sale and quote evidence.
