# MTG market-source survey and synthesis plan

Checked October 4, 2026. Prepared for a patient, effort-conscious personal seller targeting MagicCon Atlanta, November 13–15, 2026. This is a broad survey of 56 source entries, including grouped services and dealer discovery; it is not a claim that every website exists in this list or that every advertised feed was tested.

## Main finding

We can build a materially better evidence base without starting with paid feeds. Mana Pool exposes actual recent variant sales in a public daily catalog. Combine that with provider-separated price history, current dealer bids, and carefully scoped gameplay/collector demand. Additional aggregators often repeat the same underlying market; adding them does not necessarily add independent evidence.

Your goal is worthwhile net cash for reasonable work, with flexibility to wait. Therefore desirability should influence which buyers see a card and how hard we negotiate, but should never substitute for a defensible exact-printing comp or an actual cash quote.

## Best sources for the first version

| Role | First choice | Why / boundary |
|---|---|---|
| Identity | Scryfall and MTGJSON | Printing and provider crosswalks; still resolve physical finish/language/condition |
| Direct sale evidence | Mana Pool public catalog | Actual recent sales by variant; capped sample, not complete velocity |
| Price trend | MTGJSON plus original market pages | Provider-separated snapshots; no synthetic transaction counts |
| Dealer demand | TCGSentry export plus current CK/SCG/direct quotes | Cash, wanted quantity and grade constraints; retain capture times |
| Casual constructed demand | EDHREC | Oracle-card adoption; not a premium-printing purchase count |
| Competitive demand | MTGGoldfish, MTGTop8, MTGDecks, TopDeck/EDHTop16, official decklists | Format/time/denominator matter; overlapping events must not be counted twice |
| Premium/ambiguous comps | eBay Product Research; reviewed PriceCharting/130point records | Exact treatment and shipping review; underlying eBay records may overlap |
| Atlanta fit | Organizer roster, event hotlists and actual quotes | Dealer-specific appetite, not general market popularity |

Source URLs, verification levels and access limitations appear in the registry below. Full proposal: `synthesis-design.md`; machine-readable source inventory: `market-source-registry.json`.

## A real inventory probe, not just a list of websites

I downloaded the [documented public Mana Pool catalog](https://manapool.com/api/docs/v1) and matched it locally against the existing 723-row sale scan. No inventory was uploaded to Mana Pool. The download contained 106,515 catalog records.

| Check | Inventory rows |
|---|---:|
| Scryfall-ID catalog candidates | 723 |
| Candidate with matching exported language, condition and finish | 707 |
| Candidate with returned recent-sale records | 699 |
| At least one candidate sample at the 20-record cap | 436 |
| No exact variant candidate | 16 |

These are candidate matches, not new accepted identity corrections. The 16 exceptions comprise 13 language mismatches and three grades that should not be guessed into a marketplace grade. The prior physical-language audit remains unresolved, including cases where a marketplace variant happens to match the scan. Quantity remains 817 copies.

The feed returns up to 20 sales per variant, with timestamps, unit prices in cents and quantity. It does not document a complete observation window or expose sale IDs in these records. Repeated downloads overlap. We must retain snapshots, not append them and manufacture volume. Fewer than 20 records also does not establish complete history.

Two examples explain why this changes our thinking:

- The candidate EN/NM foil Island SLP 32 has only two returned sales: $199.99 on July 19 and $61.68 on February 2, 2026. Current low asking price is $205.40 with two available. This supports possible premium value but gives weak evidence of fast turnover or an immediately achievable $205 sale. [Exact printing page](https://manapool.com/card/slp/32/island).
- The candidate EN/NM foil Tyvar, the Pummeler DSK 353 has 17 returned sale records, with substantial price variation; latest reported September 25 sales are $23.74 per unit. Current low ask is $23.99 with five available. Use these exact-variant records to challenge stale or mixed-treatment history, not average everything together. [Exact printing page](https://manapool.com/card/dsk/353/tyvar-the-pummeler).

This probe did not modify the app database or assign new sale dispositions. The accompanying JSON retains the candidate evidence. The summary field `captured_at` records probe completion time, not the publication time of every underlying transaction; raw download provenance is separate.

## Important traps uncovered

1. **Price movement is not popularity.** MTGStocks “Interests” measures price changes. Its regular/foil and market/market-foil tabs also have different pricing semantics. EDHREC inclusion and tournament usage answer different questions.
2. **Popularity is not exact-printing liquidity.** Players may want an inexpensive functional copy while collectors value a scarce treatment. A rare foil basic land is not explained by general Island usage.
3. **A quantity decline is not a sale.** Listings disappear through withdrawals, edits and transfers. Stock is supply; transaction counts are activity; wanted quantity is dealer appetite.
4. **Many websites are the same evidence repackaged.** TCGplayer-derived values through Scryfall, MTGJSON, TCGCSV and trackers should not multiply confidence. EDHREC draws on deck hosts; tournament aggregators may reuse the same events.
5. **API documentation does not mean access.** TCGplayer is not granting new API access; Cardmarket currently accepts no new API applications, but publishes daily guide/catalog downloads. eBay Marketplace Insights is closed to new users even though Seller Hub research is available to eligible users.
6. **Paid access may not provide the data we need.** PriceCharting’s API explicitly excludes historical prices and individual historical sales. Several newer services advertise transaction histories; treat those as claims until exact variants, timestamps, sample caps and delivered-price semantics are tested.
7. **Low asking prices, seller net and dealer cash are different amounts.** Shipping, fixed order fees, grade adjustments, credit bonuses and quantity caps can reverse rankings. Regional EUR/JPY prices are context, not directly executable US cash.

References: [MTGStocks methodology](https://www.mtgstocks.com/docs/interests), [TCGplayer access](https://docs.tcgplayer.com/docs/getting-started), [Cardmarket access](https://help.cardmarket.com/en/cardmarket-api), [eBay research](https://www.ebay.com/help/selling/selling-tools/research?id=4853), [PriceCharting API](https://www.pricecharting.com/api-documentation).

## Atlanta buyer strategy

The [official directory](https://mcatlanta.mtgfestivals.com/en-us/experience/exhibitors.html) lists Star City Games, Three for One Trading, TOAMagic, Jeux Face a Face, Pro-Play Games, Strike Zone and additional dealers. Three for One has an [Atlanta-specific buying page](https://www.threeforonetrading.com/en/sell-your-cards-atlanta-11-2026) with advance estimates and appointments. These are useful starting points, not guaranteed quotes.

The organizer directory contains a quality issue: ManaTrust’s entry uses Pro-Play’s description, while Pro-Play also has its own entry. Some booths are shared. Preserve those inconsistencies and verify final dealer identity/location before creating a route. A generic Face to Face hotlist is not automatically an Atlanta hotlist.

Prepare separate tranches for liquid staples, premium/collector treatments and efficient batch fillers. Route premium cards to buyers with evidence of relevant specialization; seek competitive cash quotes for liquid staples. Keep unresolved identities separate. Compare each quote with an achievable alternative net and effort, not a percentage of an inflated retail listing. Record actual accepted quantity, grading, expiry and payment method. Event presence does not establish buying capacity.

## What to build next

Start with immutable Mana Pool samples and safe candidate reconciliation, then add price-history lineage and a manual buyer-quote workflow. Add deck/format context selectively where it could change a decision. Record actual effort and settlements to calibrate the economics. Evaluate paid feeds only for a specific missing decision input with enough likely value to justify the cost.

The recommendation should show: best feasible cash baseline, patient self-sale net range, additional work, evidence for demand, strongest counterargument, and a hold thesis when applicable. It should also be allowed to say “not worth researching further.” No arbitrary weighted score or uncalibrated sale probability is warranted yet.

## Source registry

Verification labels: **tested** means structured public data downloaded and inspected; **documented** means first-party capability documentation inspected; **observed** means page content inspected; **claimed** means provider marketing not independently validated; **limited** means incomplete access/verification. A source can be useful without being suitable for automated collection. Entries are checked as of the date above; pricing and access can change.

### Transactions and supply

**MS01 — Mana Pool** (tested; core). Exact variant sale evidence and supply; later actual order calibration

Access: Daily public gzip catalog; documented API; private seller endpoints require token. Limit: Recent sales capped at 20 per variant; no sale ID or complete time window documented. Not total market volume. Zero low price can mean no stock.

[Source 1](https://manapool.com/api/docs/v1) · [Source 2](https://manapool.com/api/docs/v1/openapi.json) · [Source 3](https://storage.googleapis.com/manapool-prod-catalog/singles.json.gz) · [Source 4](https://blog.manapool.com/)

**MS02 — TCGplayer** (documented; core_manual). US transaction comparator and exact-SKU spot checks

Access: Website research; official API is closed to new applicants. Limit: Market Price is an aggregate, not a firm bid or complete volume series. Do not assume documented recent-sales endpoint is accessible.

[Source 1](https://help.tcgplayer.com/hc/en-us/articles/213588017-TCGplayer-Market-Price) · [Source 2](https://docs.tcgplayer.com/docs/getting-started) · [Source 3](https://api.tcgplayer.com/help//index)

**MS03 — Cardmarket** (documented; core_secondary_region). Independent European pricing and supply context; buyer geography

Access: Published daily price-guide/catalog downloads; website; current help says no new API applications. Limit: Do not treat EUR prices as US cash offers or average-price windows as volume. Official help is stricter than older professional-seller API documentation.

[Source 1](https://news.cardmarket.com/en/StarWarsUnlimited/were-making-the-price-guide-and-product-catalogue-available-for-download) · [Source 2](https://news.cardmarket.com/en/Magic/adding-non-singles-and-accessories-to-the-price-guide) · [Source 3](https://help.cardmarket.com/en/cardmarket-api)

**MS04 — eBay Product Research** (documented; core_manual). Premium, unusual treatment and collector comps

Access: Seller Hub research; account eligibility applies; Marketplace Insights API closed to new users. Limit: Query/title contamination, lots, condition, accepted offers and shipping require review. Research offers up to three years; reported sell-through only for eligible recent windows. No automatic market-wide API assumed.

[Source 1](https://www.ebay.com/help/selling/selling-tools/research?id=4853) · [Source 2](https://developer.ebay.com/api-docs/buy/ref-marketplace-supported.html)

**MS05 — CardTrader** (documented; secondary). Independent supply/asking-price comparison, international buyer context

Access: Documented account-token API. Limit: API listings are not completed market sales; direct and Zero fulfillment economics differ; preserve currency and seller region.

[Source 1](https://www.cardtrader.com/en/docs/api/full/reference)

**MS06 — Cardsphere** (documented; secondary). Bid-side demand and an alternative channel where batch economics work

Access: Website/account workflow; no bulk market API verified. Limit: Offers are not completed sales; fees, shipping and cash withdrawal reduce realizable cash. Index starts with NM English and models other conditions/languages.

[Source 1](https://www.cardsphere.com/tutorials) · [Source 2](https://blog.cardsphere.com/how-to-create-and-manage-a-buylist-on-cardsphere/)

### Dealers and events

**MS07 — Card Kingdom** (documented; core). Practical dealer baseline; buying depth

Access: Direct buylist and CSV cart import; retained TCGSentry export. Limit: NM quote and quantity are conditional; English acceptance and thresholds matter. Do not assume undocumented endpoints are supported integration contracts.

[Source 1](https://www.cardkingdom.com/purchasing/how_to_sell) · [Source 2](https://www.cardkingdom.com/static/csvImport)

**MS08 — Star City Games** (documented; core). Second dealer comparator and event candidate after attendance verification

Access: Direct sell list, CSV workflow, existing TCGSentry export. Limit: Capacity unknown in current export; approval and grade are separate. An old event article does not verify the next event.

[Source 1](https://help.starcitygames.com/en-US/articles/sell-to-us-229858) · [Source 2](https://help.starcitygames.com/en-US/approval-shipping-instructions-1056762) · [Source 3](https://articles.starcitygames.com/magic-the-gathering/star-city-games-is-headed-to-magiccon-atlanta/) · [Source 4](https://mcatlanta.mtgfestivals.com/en-us/experience/exhibitors.html)

**MS09 — ABU Games** (observed; secondary). Additional bid competition and played-card options

Access: Public buylist UI. Limit: Cash and trade prices differ materially; do not rank store credit as cash. Integration not tested.

[Source 1](https://abugames.com/buylist?language=%5B%22English%22%5D&magic_edition=%5B%22Alpha%22%5D)

**MS10 — CoolStuffInc** (documented; secondary). Additional dealer offers when incremental postage is justified

Access: Public sell list and approval workflow. Limit: Cash versus credit distinct; bulk language/condition restrictions; final approval needed.

[Source 1](https://www.coolstuffinc.com/main_selllist.php) · [Source 2](https://www.coolstuffinc.com/page/5485)

**MS11 — Strike Zone** (limited; candidate). Additional bid candidate if direct verification finds worthwhile coverage

Access: Listed by current comparison providers; direct current workflow not verified in this survey. Limit: Do not rely on old buylisting articles or aggregator quantities without checking the dealer.

[Source 1](https://yestcg.com/sell-your-cards/magic) · [Source 2](https://mcatlanta.mtgfestivals.com/en-us/experience/exhibitors.html)

**MS12 — Card Conduit** (documented; core_manual). Low-effort service baseline against doing our own splitting

Access: Public estimate/service information; collection upload not performed. Limit: Estimated prices are not locked until processing. Service fees and preparation differ. Marketing average uplift is not a forecast for this collection.

[Source 1](https://cardconduit.com/estimates/create) · [Source 2](https://cardconduit.com/faq/how-card-value-determined) · [Source 3](https://cardconduit.com/buylisting)

**MS13 — Three for One Trading** (observed; event_core). Event-specific desirability and quote workflow

Access: Event pages and optional quote/appointment workflow; no contact made. Limit: Atlanta November 13–15, 2026 buying page and organizer listing verified. Estimates remain conditional on identity, grade, capacity and final quote; specialist interest is not a guaranteed premium.

[Source 1](https://www.threeforonetrading.com/en/sell-your-cards-atlanta-11-2026) · [Source 2](https://www.threeforonetrading.com/en/sell-your-cards-las-vegas-05-2026)

**MS14 — Face to Face Games** (observed; event_core). Specific buyer demand and event shortlist

Access: Public event hotlist and sell-card pages. Limit: Hotlist cards are partly images; confirm identity, currency, event and update date. Prices may change without notice. Atlanta directory lists Jeux Face a Face; generic hotlist is not yet validated as Atlanta-specific.

[Source 1](https://facetofacegames.com/pages/magiccon-hotlist) · [Source 2](https://support.facetofacegames.com/en-US/articles/how-to-sell-cards-344162)

**MS15 — Hareruya** (observed; specialist). Japanese/collector-printing context and specialist comparisons

Access: Public Japanese purchase pages linked by official site. Limit: JPY and regional terms; not automatically a US sell channel or confirmed event buyer. Expired campaigns are not current bonuses.

[Source 1](https://www.hareruyamtg.com/ja/purchase/) · [Source 2](https://www.hareruyamtg.com/en/user_data/16th_anniversary_campaign)

**MS16 — Grey Ogre Games** (observed; specialist). Regional demand example and buyer-specific constraints

Access: Public store buying page. Limit: Not an independent CK price corroboration. Store buying status is not event attendance or global demand.

[Source 1](https://www.greyogregames.com/pages/sell-us-your-cards-cash)

**MS17 — MagicCon official event sites** (observed; event_core). Establish actual vendor universe before optimizing a route

Access: Public event-specific pages. Limit: Exhibitor does not necessarily buy. Current directory contains a ManaTrust heading with Pro-Play copy and shared booth numbers; verify dealer identity and final routing.

[Source 1](https://mcatlanta.mtgfestivals.com/en-us/experience/exhibitors.html) · [Source 2](https://mcatlanta.mtgfestivals.com/en-us/industry/exhibitor-manual.html)

**MS18 — Tales of Adventure / TOAMagic** (observed; candidate). Potential Atlanta quote comparison

Access: Listed as TOAMagic in current Atlanta organizer directory; direct site fetch unavailable. Limit: Attendance listing observed; current buying policy and usable structured price feed not validated.

[Source 1](https://toamagic.com/) · [Source 2](https://mcatlanta.mtgfestivals.com/en-us/experience/exhibitors.html)

**MS19 — Ninety Five / 95MTG** (limited; candidate). Check only if confirmed on target event roster

Access: Direct site fetch unavailable in this survey. Limit: No current price feed, buying policy or attendance validated; old community mentions are insufficient.

[Source 1](https://www.95mtg.com/)

**MS56 — Additional Atlanta exhibitors / dealer discovery** (observed; event_candidate). Pro-Play Games, Propaganda, Collector Legion, Hotsauce Games, Good Games, Journey’s End Games, Nerd Gear Gaming, Pink Bunny Games, The Mana Vault MKE and others form a wider quote-discovery pool.

Access: Current public organizer directory. Limit: Not each dealer’s direct data feed or buying policy tested. Directory presence does not establish a cash bid. ManaTrust/Pro-Play description conflict retained.

[Source 1](https://mcatlanta.mtgfestivals.com/en-us/experience/exhibitors.html)

### Catalog and delivery

**MS20 — Scryfall** (documented; core). Identity and crosswalk backbone

Access: Documented API and bulk files; existing bulk retained. Limit: Reference prices and popularity ranks are not new independent observations; default-language scope and stale bulk prices matter.

[Source 1](https://scryfall.com/docs/api/bulk-data) · [Source 2](https://scryfall.com/docs/api/cards)

**MS21 — MTGJSON** (documented; core). Reproducible daily price history and provider-ID joins

Access: Public compressed bulk; AllPrices covers past 90 days, AllPricesToday current day. Limit: Price history is not transaction history or complete volume. Keep paper/MTGO separate; optional providers can be absent.

[Source 1](https://mtgjson.com/downloads/all-files/) · [Source 2](https://mtgjson.com/data-models/price/price-list/) · [Source 3](https://mtgjson.com/data-models/price/price-formats/) · [Source 4](https://www.mtgjson.com/license/)

**MS22 — TCGCSV** (documented; secondary). Alternative delivery of TCGplayer reference pricing

Access: Public JSON/CSV; once daily, custom user agent, documented throttling. Limit: Same underlying marketplace as TCGplayer; not a sales-volume API. Avoid redundant full refreshes.

[Source 1](https://tcgcsv.com/) · [Source 2](https://tcgcsv.com/docs)

### Aggregators and research

**MS23 — TCGSentry** (observed; core). Convenient repeatable dealer capture; source model is a comparison hypothesis

Access: Existing authenticated collection and CSV export. Limit: Not physical inventory truth; no independent sales sample. Modeled net omits order costs and old-high logic does not establish recovery.

[Source 1](https://tcgsentry.com/) · [Source 2](https://tcgsentry.com/collection)

**MS24 — MTGStocks** (observed; secondary). Detect anomalies and investigate treatment-specific trends

Access: Public browser pages; premium features; bulk integration not verified. Limit: Interests means price movement, not wishlist counts or popularity. Listing tabs and market tabs must not be mixed.

[Source 1](https://www.mtgstocks.com/docs/interests) · [Source 2](https://www.mtgstocks.com/interests)

**MS25 — MTGGoldfish** (documented; core_manual). Format demand context plus convenient historical reference

Access: Public pages; premium per-card price-history CSV advertised. Limit: Tournament sample is not population census; price-history CSV is not sales history. Paid export not purchased.

[Source 1](https://www.mtggoldfish.com/format-staples/modern) · [Source 2](https://www.mtggoldfish.com/premium)

**MS26 — Quiet Speculation Trader Tools** (observed; secondary). Comparator for dealer coverage; possible paid convenience

Access: Public limited views; merchant/quantity values hidden in inspected page. Limit: Do not rely on decade-old articles for current automation or merchant coverage. Underlying bids must be rechecked.

[Source 1](https://tradertools.quietspeculation.com/prices/sets/Fate%20Reforged/Palace%20Siege/foil?variant=367945dd-871a-46c9-b047-c701e664d2afa)

**MS27 — MTGBAN** (observed; secondary). Broader buylist discovery and outlier checking

Access: Public limited pages; login/paid export prompts observed. Limit: Source-specific scopes and access tiers must be checked; aggregate estimates are not guaranteed execution.

[Source 1](https://mtgban.com/sealed?q=container%3A%22Sunken+Hollow%22) · [Source 2](https://mtgban.com/)

**MS28 — MTGPrice** (claimed; secondary). Historical inventory-context lead and hypotheses

Access: Public and paid ProTrader features advertised. Limit: Freshness and actual per-card coverage require testing; marketing arbitrage claims are not evidence of realizable profit.

[Source 1](https://www.mtgprice.com/signup.jsp) · [Source 2](https://www.mtgprice.com/try-protrader.htm)

**MS29 — EchoMTG** (documented; defer). Potential reference UI, not a default engine backend

Access: Account API and subscription tiers; current terms restrict external reuse. Limit: API existence does not grant unrestricted repurposing; endpoint and permitted personal-app use need clarification before integration.

[Source 1](https://www.echomtg.com/api/) · [Source 2](https://www.echomtg.com/legal/terms-and-conditions/)

### Collector comps

**MS30 — PriceCharting** (documented; secondary_manual). Collector comps with exact-title review

Access: Public card pages; paid API/CSV. Limit: API explicitly excludes historical prices and historical sales; treatment contamination already found. Annual volume is not current velocity.

[Source 1](https://www.pricecharting.com/api-documentation) · [Source 2](https://www.pricecharting.com/game/magic-duskmourn-house-of-horror/tyvar-the-pummeler-borderless-foil-353)

**MS31 — 130 Point** (documented; secondary_manual). Premium-printing and unusual-card spot checks

Access: Free research UI; no supported bulk API verified. Limit: Duplicates underlying marketplace events; title and lot filtering required.

[Source 1](https://130point.com/about) · [Source 2](https://130point.com/search)

**MS32 — Card Ladder** (documented; defer_paid). Escalation for valuable collector pieces if free evidence fails

Access: Free limited tools; sales history in paid Pro. Limit: Magic exact-printing coverage not tested; graded market differs from raw play copies; no subscription purchased.

[Source 1](https://www.cardladder.com/) · [Source 2](https://cardladder.com/pricing)

**MS33 — Heritage Auctions** (observed; specialist). Rare, graded, artist-proof and exceptional items

Access: Public sold archive; detail access may vary. Limit: Match grade/provenance and distinguish buyer premium from seller proceeds. Ordinary singles need different comparators.

[Source 1](https://www.ha.com/c/search/results.zx?archive_state=5327&layout=gallery&mode=archive&sb=1&si=1&sold_status=1526&term=Magic+The+Gathering)

**MS34 — PSA Auction Prices / Population** (observed; specialist). Graded comparators only when relevant

Access: Public product/grade pages. Limit: Graded population is neither print run nor actively available stock. Raw NM cannot be valued as a numerical grade.

[Source 1](https://www.psacard.com/auctionprices/tcg-cards/2023-magic-gathering-tales-middle-earth/tom-bombadil/8962774)

### Popularity and play

**MS35 — EDHREC** (documented; core_manual). Commander demand at card/oracle level

Access: Public pages; supported bulk/API route not verified. Limit: Deck inclusion is not purchases or exact-printing demand. Updated deck populations and eligibility affect denominators; avoid double-counting source sites.

[Source 1](https://edhrec.com/faq) · [Source 2](https://edhrec.com/top/week)

**MS36 — MTGTop8** (observed; secondary). Competitive staple demand and event context

Access: Public search and event pages. Limit: Selected/reported results bias sample; event overlap with other aggregators; no market transactions.

[Source 1](https://www.mtgtop8.com/search?player=Derrick) · [Source 2](https://www.mtgtop8.com/search.php?cards=Misdirection&format=LE)

**MS37 — MTGDecks** (observed; secondary). Cross-check competitive adoption by format

Access: Public pages; no supported bulk route verified. Limit: Deduplicate events against Goldfish/Top8; web sample is not paper ownership or sales.

[Source 1](https://mtgdecks.net/Modern/metagame%3Arecent-major-events) · [Source 2](https://mtgdecks.net/prices/edition/ISD/Standard)

**MS38 — EDHTop16** (observed; secondary). Competitive Commander demand and buyer fit

Access: Public filtered pages. Limit: Conversion is tournament success, not sales conversion. Minimum entries, time window and event size are necessary context.

[Source 1](https://edhtop16.com/?minEntries=120&sortBy=CONVERSION&timePeriod=POST_BAN)

**MS39 — TopDeck.gg** (documented; secondary_api). Structured tournament input if it adds independent coverage

Access: Documented free API key; attribution and rate limits required. Limit: Public visibility rules apply; no private player contact fields needed. Tournament usage does not identify preferred printing.

[Source 1](https://topdeck.gg/docs/tournaments-v2)

**MS40 — Melee** (limited; secondary_manual). Primary event cross-check when a relevant tournament publishes records

Access: Event-specific public pages; general data API not verified. Limit: Coverage and visibility vary; no unrestricted bulk capability established.

[Source 1](https://melee.gg/) · [Source 2](https://help.melee.gg/docs/game-changing-entry-fee-and-payment-policies-update-more-freedom-more-flexibility/)

**MS41 — Magic Online decklists** (observed; secondary). Primary competitive adoption signal

Access: Official public decklist downloads. Limit: Digital play sample; never import ticket prices as paper USD or assume every listed deck represents a new purchase.

[Source 1](https://www.mtgo.com/decklists/)

**MS42 — Magic.gg / official coverage** (observed; core_manual). Explain tournament-driven demand with known denominators

Access: Public coverage articles and event pages. Limit: Published events are not all play. Separate mirror/byes/draw handling and event date; no automatic sales effect.

[Source 1](https://magic.gg/news/metagame-mentor-modern-across-the-worlds-regional-championships)

**MS43 — Deckbox** (observed; secondary). Distinct expressed-interest proxy and supply of trade copies

Access: Public card pages. Limit: Stale/nonfunded wishes are not bids; counts can have different printing/card scopes; no time window means no velocity.

[Source 1](https://deckbox.org/mtg/Tin%20Street%20Market?printing=20880) · [Source 2](https://deckbox.org/mtg/High%20Market?printing=78182)

**MS44 — Moxfield and Archidekt** (documented; defer_duplicate). Explain specific deck context when needed

Access: Public deck pages and user exports; general approved aggregation API not established here. Limit: Do not count alongside EDHREC as independent popularity; deck versions, proxies and aspirational lists differ from purchases.

[Source 1](https://edhrec.com/faq) · [Source 2](https://sorcery.moxfield.com/help/terms)

**MS45 — 17Lands** (documented; low). Narrow new-set research context

Access: Public anonymized datasets under stated attribution license. Limit: Limited performance is not constructed demand, premium appeal or paper-card velocity; not a core feature for this tranche.

[Source 1](https://www.17lands.com/public_datasets)

### Catalysts

**MS46 — Wizards announcements** (observed; core_manual). Dated catalyst and downside evidence

Access: Official articles and product announcements. Limit: Announcement is factual; price impact remains a hypothesis. Always check the latest effective announcement rather than a cached prior one.

[Source 1](https://magic.wizards.com/en/news/archive?author=3FBvNHrcf8dKhvZGWTxm9J) · [Source 2](https://magic.wizards.com/en/news/announcements/banned-and-restricted-may-18-2026)

### New data services

**MS47 — SpellBook Finance** (documented; experimental). Low-cost alert/research trigger if sample quality passes

Access: Advertised free keyless signals API and RSS. Limit: Signals are derived, not independent transactions. Broad sold-price claims need exact variant/lineage testing; ATH alone is not a hold reason.

[Source 1](https://spellbook-finance.com/developers) · [Source 2](https://spellbook-finance.com/mtgstocks-alternative)

**MS48 — ValueMyCard** (claimed; experimental_manual). Possible convenient long-history reference

Access: Free history UI; comparison page places completed sales in Pro. Limit: Do not interpret broad free-data wording as free completed-sales access. API, quality and exact treatment coverage untested.

[Source 1](https://www.valuemycard.com/about)

**MS49 — TCGAPIs** (claimed; defer_paid). Potential solution if documented full-window volume remains unavailable

Access: Documented commercial tiers; sales endpoints Business+. Limit: Advertised recent feed is capped; historic archive uses buckets. Verify completeness, units, shipping and reuse rights using samples before any purchase.

[Source 1](https://tcgapis.com/tcgplayer-api) · [Source 2](https://tcgapis.com/v2-api)

**MS50 — TCGGraph** (claimed; defer_paid). Possible convenience delivery layer

Access: Commercial REST/GraphQL service advertised. Limit: Not independent market evidence; quote capacity and exact identity still need validation. No need to pay just to duplicate free feed history.

[Source 1](https://tcggraph.com/buylist)

**MS51 — Mythic Index** (claimed; experimental). Potential price-history delivery alternative

Access: Advertised account-key API and up to 365-day history. Limit: No authentication or response testing performed; actual rights/availability need verification. Cardhoarder digital prices must remain separate.

[Source 1](https://api.mythic-index.com/mtg-api)

**MS52 — YesTCG** (claimed; secondary). Compare proposed batch optimizer against an existing tool

Access: Public explanation; optimizer advertised in paid Pro. Limit: NM assumptions and sample postage are not this owner's costs. Reported sample uplift is not a universal result; no collection upload performed.

[Source 1](https://yestcg.com/sell-your-cards/magic)

**MS53 — ManaRite** (limited; candidate). Track as an alternate buylist-comparison lead

Access: Indexed provider description; live fetch failed. Limit: Do not make it a dependency until availability, freshness and access are verified.

[Source 1](https://manarite.com/)

**MS54 — OtterDex** (limited; defer). Preserve old assertion only

Access: Earlier same-day browser check returned paused deployment. Limit: Unavailable source; cannot currently refresh or substantiate the prior rising-price claim.

[Source 1](https://otterdex.com/cards/mtg/slp/32)

**MS55 — Third-party Cardmarket-branded API services** (claimed; defer). Fallback candidates only if official downloads are insufficient

Access: API-key commercial services; separate from Cardmarket. Limit: Domain names do not establish official affiliation or data rights; validate actual provenance and coverage before relying on them.

[Source 1](https://cardmarketapi.com/docs) · [Source 2](https://www.tcg-cardmarket-api.com/docs/cards)

## Coverage boundary and deliberately lower-priority material

This covers major marketplaces, transaction research, dealers, price/history aggregators, gameplay adoption, event sources, collectors and emerging APIs. Social posts, Reddit, Discord, YouTube, Facebook groups, Whatnot streams and search trends can surface a catalyst or a buyer, but unaudited anecdotes are not transaction volume. Individual local stores and small regional buylists remain expandable candidates rather than a claim of exhaustive global coverage. Auction/slab sources matter selectively for collector items, not as a blanket model for ordinary raw cards.

No paid feed was purchased, no vendor was contacted, and no sell order, appointment or new account was created. This research adds documentation and a private read-only probe; it does not implement collectors, revise physical holdings or build a product interface.
