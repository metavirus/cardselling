# Trend source research: tested delivery and normalization

Checked October 4, 2026. This supplements the earlier broad survey with actual
delivery probes. No canonical database or inventory was changed. Raw public
downloads are retained under `data/private/market/2026-10-04/trend-probes/`.

**Owner scope decision:** Exclude EUR/Cardmarket from the application because it
is a different market. Cardmarket findings below are retained research only,
not an integration recommendation. No Cardmarket normalizer, importer or database
staging was retained. Prioritize independent US completed-sale evidence.

## What we can actually obtain

| Source | Verified access | Appropriate use |
| --- | --- | --- |
| Cardmarket daily guide + singles catalog | Both official JSON files downloaded successfully (HTTP 200) | Independent EUR market context; start retaining daily observations now |
| TCGCSV current products/prices | Magic groups and LCC price feed returned HTTP 200 | TCGplayer market/low/mid snapshots and feed cross-checks |
| TCGCSV historical archive | Two dated archive probes returned HTTP 403 with a deliberate removal notice | Unavailable; do not promise a two-year backfill based on stale FAQ |
| TCGplayer official API | Current official documentation says no new API access | Manual completed-sale research until usable supported access exists |
| eBay Product Research | Official documentation verifies three years and actual accepted-offer prices | Reviewed premium-printing comps; not a public bulk integration |
| MTGGoldfish | Premium page advertises per-card full-history CSV | Potential paid convenience, not downloaded or purchased |
| MTGStocks | Indexed primary card pages show multi-provider price charts | Useful research and visual comparator; supported bulk history route not verified |
| Cardsphere | Official FAQ documents last ten completed trades and top ten offers | Independent trade comps if exact variant can be inspected; no bulk collector verified |
| Card Conduit | Public price checker and collection estimates | Additional executable-channel research; no public historical feed verified |

## Cardmarket: useful new evidence, correctly scoped

Official downloads:

- https://downloads.s3.cardmarket.com/productCatalog/priceGuide/price_guide_1.json
- https://downloads.s3.cardmarket.com/productCatalog/productList/products_singles_1.json

The 26,185,888-byte guide contains **128,084 price rows**, `version: 1`, and
`createdAt: 2026-10-04T02:40:40+0200`. The 20,445,546-byte singles catalog contains
**122,986 products**, created at `2026-10-04T10:17:12+0200`. Guide includes categories
beyond singles; join against singles product catalog/category rather than assuming
every guide record is a card.

Guide schema observed: `idProduct`, `idCategory`, `avg`, `low`, `trend`, `avg1`,
`avg7`, `avg30`, with `-foil` counterparts. Singles catalog has product ID, name,
category ID/name, expansion ID, metacard ID and date added. It does not supply
collector number, Scryfall ID, finish-specific language, condition or sale counts.

Use retained MTGJSON `identifiers.mcmId` as the primary crosswalk, with printing
checks. All **698** mcmId values in the retained 700-row identifier extraction
were found in the guide. This is crosswalk-candidate coverage, **not an assertion
that 698 canonical lots have exact NM English transaction comparables**.

Store EUR minor units, Cardmarket as underlying market, original metric, source
publication timestamp and our capture timestamp. Product-level grade/language
scope remains unspecified. Foil metrics are not automatically etched metrics.
Do not plot avg1/avg7/avg30 as observations on three different historical dates:
they are overlapping rolling-window aggregates as of one publication. Daily
retention grows a real time series. These aggregates provide no volume numerator.

Carmen LCC 26 (`mcmId: 743405`) illustrates why finish matters: nonfoil avg1/7/30
are EUR 4.74/4.72/4.82, while foil is 6.44/6.01/5.28 in this capture. They imply
different recent context; neither is an exact US seller-net estimate.

Official semantics and availability:
[daily public downloads](https://news.cardmarket.com/en/Magic/were-making-the-price-guide-and-product-catalogue-available-for-download),
[expanded guide categories](https://news.cardmarket.com/en/Magic/adding-non-singles-and-accessories-to-the-price-guide),
[price field definitions](https://api.cardmarket.com/ws/documentation/API_2.0%3APriceGuide).
The older API endpoint is deprecated; the static downloads succeeded even though
the interactive download landing pages returned 403 in web research.

## TCGCSV: current feed works; archive documentation is stale

The [official FAQ](https://tcgcsv.com/faq) advertises daily archives starting
February 8, 2024. Actual requests for the documented February 8, 2024 archive and
a July 1, 2026 archive both returned 403. The response explicitly says the archive
was temporarily removed for server-cost/moderation reasons pending clarification
from TCGplayer, while archival recording continues privately. No workaround was
attempted. This is a provider restriction, not a missing local decompressor.

`https://tcgcsv.com/tcgplayer/1/groups` returned 454 Magic groups. The discovered
LCC group 23316 price endpoint returned 451 price rows. Carmen product 526260:

| Subtype | Market | Low | Mid | Direct low |
| --- | ---: | ---: | ---: | ---: |
| Normal | $5.97 | $3.57 | $5.85 | $6.57 |
| Foil | $7.10 | $6.40 | $7.99 | $8.67 |

Schema: productId, lowPrice, midPrice, highPrice, marketPrice, directLowPrice,
subTypeName. No sales records, sale count, grade or language dimension. Null is
unknown, not zero. Keep these metric kinds separate. `highPrice` is not a plausible
upside comp. Use an identifiable User-Agent, cache each price file for at least
24 hours, and follow provider pacing guidance. [API documentation](https://tcgcsv.com/docs).

This is **TCGplayer evidence delivered by TCGCSV**, not an independent marketplace.
It cannot corroborate MTGJSON's TCGplayer series as a second independent source.
It can expose different metric definitions or capture times and extend retention
from now forward.

## Other channels: what is genuinely new versus another delivery wrapper

- **TCGplayer:** [official API access](https://docs.tcgplayer.com/docs/getting-started)
  remains closed to new applicants. Do not present documentation as working access.
- **eBay:** [Product Research](https://www.ebay.com/help/selling/selling-tools/research?id=4853)
  offers three years, accepted Best Offer amounts, shipping context and selected
  sell-through metrics. Review exact printing, raw/graded status, quantity and
  shipping before importing comps. [Marketplace Insights](https://www.developer.ebay.com/api-docs/buy/static/ref-marketplace-supported.html)
  is restricted and closed to new users; Browse availability is not sold history.
- **MTGGoldfish:** [Premium](https://www.mtggoldfish.com/premium) currently lists
  $5.99 monthly / $59.88 annual and complete per-card history CSV. Purchase and
  coverage validation are still required; no evidence that these are individual
  sales or independent of the markets already tracked.
- **MTGStocks:** [example primary card page](https://www.mtgstocks.com/prints/15390-swords-to-plowshares)
  exposes TCGplayer, Cardmarket, CK and SCG chart choices. Retail vendor pricing
  must not become dealer buylist history. No supported downloadable historical
  dataset was verified. Treat as research rather than an assumed ingestion API.
- **Cardsphere:** [official FAQ](https://www.cardsphere.com/tutorials) describes
  ten recent trades and ten best offers; its index blends undisclosed retailer
  sources and derives non-NM/non-English index adjustments. Actual trades are
  potentially independent; the index is not an exact-variant comp by itself.
- **Card Conduit:** [price checker](https://cardconduit.com/card-price-check) and
  [FAQ](https://cardconduit.com/faq) support channel comparison. Its optimized
  wholesale amount mixes partners and is not a new independent dealer-history
  series. Price is determined on processing; estimate is not a locked bid.

## Collector contract to avoid misleading charts

Preserve source document/hash, distributor, underlying market, source product,
finish, currency, metric kind, condition/language scope, effective time, capture
time and aggregation window. Keep direct bids, aggregator-indicated bids, retail
references, asks and completed sales in distinct series. Never join one source's
last historical point to another source's latest quote as one continuous line.

Draw sales as points; draw rolling aggregates as labelled curves; draw current
dealer quotes as separately sourced markers with capacity. Missing data should
break a line rather than imply a flat market. EUR data is excluded from operational charts and recommendations because it represents a different market. In the primary decision view, show dollars and a short actionable
interpretation; lineage and data-method details remain in optional disclosure.

## Additional US follow-up

Cardsphere's public [Bulk Data](https://www.cardsphere.com/bulk-data) page documents daily JSONL with Scryfall and Cardsphere identities, finish, cents, set and collector number. This is index pricing, not completed trades. The download was not verified in this pass. Its individual-card trade records were not captured. No second completed-sales marketplace was ingested.
