# Market evidence and recommendation design

Research checkpoint: 2026-10-04. Proposed design, not an implemented model or authorization to sell. Extends the existing product plan, assumptions and decision contract. Source capabilities and access limitations are in `market-source-registry.json`.

## Objective

Choose worthwhile net proceeds with proportionate effort. Cash timing is flexible; holding needs a forward-looking thesis. A historical high is neither a target nor proof of recovery. Evaluate a batch as well as each card: fixed order fees, shipping, grading work and vendor queues can reverse the apparent best channel.

## Keep seven kinds of evidence separate

| Dimension | Useful evidence | What it does not establish |
|---|---|---|
| Gameplay adoption | Deck inclusion, copies per deck, format share, dated tournament results | Demand for this premium printing |
| Exact-variant liquidity | Recent completed sales with finish, language, condition and treatment | Our probability of sale at an arbitrary price |
| Supply competition | Available quantity, seller count, executable asking prices | Sales volume; a removed listing may be withdrawn |
| Dealer appetite | Current cash quote, wanted quantity, hotlist, conditional acceptance | Universal desirability or a guaranteed future quote |
| Collector premium | Comparable treatment sales and specialist quotes | Value inferred from the cheapest playable copy |
| Catalysts and risks | Announced releases, legality changes, format adoption, identifiable collector drivers | A numeric expected return without calibration |
| Evidence quality and event fit | Freshness, identity, completeness, buyer specialization and event confirmation | Additional independent market demand |

Do not compress these into an opaque integer. Present the recommendation, net alternatives, supporting observations, strongest counterargument and missing evidence. Optional sorting scores must retain components and policy versions. AI interprets evidence and proposes decisions; deterministic code handles identity, quantities, fees, currency and arithmetic.

## Observation contract additions

Retain raw captures and existing immutable observation concepts. Add explicit metadata rather than immediately inventing another database architecture:

- Source, upstream market, provider record ID if present, capture hash, parser version and source URL.
- Capture time, source publication time, transaction time and window start/end as separate fields; unknown remains null.
- Scope: oracle card, printing, variant, inventory lot, vendor, event, market or order. Deck data generally belongs to the oracle card; physical sale comparisons belong to a variant.
- Currency, integer minor units, price basis (merchandise, delivered, buyer total, seller net or unknown), quantity basis, tax/fee/shipping inclusion and grade mapping provenance.
- Sample kind, cap, whether cap was reached, oldest/newest returned transaction, and completeness status. A fixed-count sample is not a fixed-period census.
- Upstream lineage and independence group. Two websites quoting TCGplayer are one market signal; distinct analyses may still be useful without being independent observations.
- Identity confidence and unresolved exceptions. Scryfall ID alone does not verify physical language, finish, grade or treatment.

### Mana Pool collector specifics

The public catalog was locally tested. Recent sales are capped at 20 per variant and contain time, price and quantity, but no documented sale ID. Save each response as a sample. Repeated snapshots overlap: never append and sum their sale rows as new transactions. A time/price/quantity fingerprint can identify possible overlap, but cannot distinguish two genuinely identical transactions. Preserve ambiguity rather than silently deduplicating real sales or manufacturing volume.

Calculate observed units in a specified window as a lower bound, with cap/completeness flags. Do not publish units/day as complete velocity, even when fewer than 20 rows return, unless provider semantics establish completeness. Time to accumulate 20 reported sales can be a labeled comparative activity indicator, not market-wide velocity. Missing rows do not prove zero demand. Zero low price with zero stock is unavailable pricing, not a free card.

## Recommendation procedure

1. Resolve usable variant identity and inventory availability. Exclude ambiguous matches from automatic price comparisons.
2. Establish the best feasible low-effort baseline: current dealer cash quotes, batch shipping and quantity limits. Store credit remains distinct from cash.
3. Model patient self-sale using defensible transaction comps and competing stock, with order-level fees, shipping and actual effort scenarios. Show uncertainty rather than inventing sale probabilities or loss rates.
4. Estimate incremental dollars and incremental work against the baseline. Tiny per-card differences may matter in one efficient batch; a large percentage on a cheap card may not.
5. For Atlanta, match suitable tranches to confirmed buyers and request comparable quotes only when authorized. Record quote expiry, cash/credit, grade, accepted quantity and payment terms. A hotlist is buyer-specific and may cease when capacity fills.
6. Hold only with a stated thesis, counterthesis, evidence, review trigger and exit conditions. No urgency does not imply automatic holding or constant monitoring.
7. Defer low-value uncertainty. Research further only when plausible decision improvement exceeds its effort. High-value identity or treatment conflicts deserve attention first.

Recommended event tranches: liquid staples for competitive broad-dealer quotes; premium/collector cards for specialist comparison; low-value fillers only when batching adds useful net; unresolved identities kept separate. These are routing proposals, not fixed dispositions. Popularity can make a card attractive to a buyer, but only current quotes reveal that buyer's actual willingness to pay.

## Atlanta 2026

Owner selected Atlanta in November. Organizer dates are November 13–15, 2026. Three for One also publishes an event-specific buying and appointment page. The current organizer directory lists SCG, Three for One, TOAMagic, Jeux Face a Face, Pro-Play Games, Strike Zone and others. Listing is evidence of exhibition, not proof of buying terms. The directory has a ManaTrust entry containing Pro-Play copy and some shared booth numbers; do not build a precise route or resolve dealer identity from those fields alone.

Sources: [organizer directory](https://mcatlanta.mtgfestivals.com/en-us/experience/exhibitors.html), [Three for One Atlanta buying](https://www.threeforonetrading.com/en/sell-your-cards-atlanta-11-2026). Event-specific quotes, hotlists and floor plan should be rechecked near the event; no reminder or monitoring job has been created.

## Integration order

1. Public Mana Pool catalog as immutable samples; existing Scryfall identity and MTGJSON provider-separated history. Preserve current TCGSentry/CK/SCG evidence and import refreshes with their real semantics.
2. Targeted EDHREC and competitive-deck context for relevant holdings. Use TopDeck's documented API only if tournament evidence materially helps; do not collect unnecessary player details.
3. Atlanta buyer profiles and manual quote capture. Manual exact-treatment eBay/TCGplayer comps for expensive or conflicting cases.
4. Capture our actual listing, quote, grading, rejection, fulfillment and settlement outcomes. These calibrate recommendations better than adding many correlated price websites.
5. Consider paid transaction/history feeds only after a specific unresolved decision justifies their cost and sample validation establishes coverage. No subscription is presently authorized.

Public visibility is not a bulk-use license. Before a collector is implemented, record documented access, rate limits, retention/usage terms and cost. TCGplayer and Cardmarket official APIs are closed to new applications; use permitted existing surfaces and published downloads. Paid third-party proxies are not official access and require independent validation.

## Acceptance checks before implementation is trusted

- Replaying a sample changes neither holdings nor cumulative sales volume.
- A 20-sale sample cannot produce an unlabeled complete monthly volume.
- A popular oracle card does not grant its rare foil the cheapest-printing velocity.
- A sold-out zero price cannot become a zero-dollar comp or quote.
- TCGplayer-derived prices from several aggregators do not count as several independent markets.
- Cash and credit, raw and graded, foil and etched, EN and other languages, paper and MTGO remain distinct.
- Dealer wanted quantity limits proceeds; an old or exhausted quote cannot become executable cash.
- A new quote or an actual settlement can change a decision while preserving its earlier rationale.
- Hold proposals include a thesis and falsification trigger; old highs alone fail this check.
- Backtests use only evidence available at decision time. Report missingness, source coverage, censoring and channel selection bias. Track outcomes by price band/treatment/channel; do not claim calibrated probabilities from a tiny pilot.

These are proposed acceptance requirements, not tests already implemented or passed.
