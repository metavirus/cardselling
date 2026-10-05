# Card decision UI audit — October 4, 2026

October 5 quote resolution: a fresh, verified exact-product public CK check is
the operational cash quote. A different same-day MTGJSON daily-history point no
longer causes a "Confirm CK quote" alert after that direct check; it remains a
dated chart observation. Unknown capacity, stale checks and unresolved aggregator
quotes retain their applicable alerts. Newer compatible captures still supersede
older quotes; direct checks are not pinned indefinitely.

The owner rejected the previous card detail as bland, mostly descriptive, and
cluttered by repeated source caveats. This is an accepted product preference,
recorded in AGENTS.md. Useful distinctions belong in short labels; extended
methodology belongs in an optional disclosure.

## Live TCGSentry inspection

Inspected the signed-in collection, home dashboard, full Freyalise #1598 and
foil Island #0032 card panels, expanded fee breakdown, price-history controls,
and the available plan/cart/alert actions. Research used a separate browser tab
and did not create orders, alerts, or inventory changes.

| Dimension | Previous app | TCGSentry observation | Implemented response |
| --- | --- | --- | --- |
| Decision hierarchy | Metadata and sample counters first | Recommendation and dealer first | Concrete next-move prompt with its dollar reason |
| Proceeds | Figures buried below long text | Dealer and retail amounts adjacent | Three offer cards, proportional bars, whole-lot/per-copy switch |
| Evidence over time | No chart | Multiple price series, range selection | Retained CK/TCG history and Mana Pool sale dots; 1M/3M and series controls |
| Cost understanding | General assumptions elsewhere | Expandable fee receipt | Price, shipping credit, fees, postage, materials, and modeled net receipt |
| Execution | Plan selector far below | Actions near recommendation | One-click working-plan action plus four direction buttons and notes |
| Uncertainty | Repeated warnings in primary content | Mostly compact labels/disclosures | Labels for quote capacity, asking/sampled basis; methodology collapsed |
| Visual hierarchy | Equally weighted statistic boxes | Art, prominent amount, colored recommendation, chart | Compact art header, tinted decision, offer bars, interactive history |

## Substance we should not copy blindly

TCGSentry's foil Island panel said to sell to SCG at $80 because it was at the
top of its range, while displaying about $189.17 marketplace proceeds before
shipping/fixed processing. Our owner has no cash deadline. A high dealer bid
relative to its own past is useful evidence, but insufficient by itself to choose
that sale. The new Island prompt asks for exact-treatment comps and specialist
quotes; the view compares $52 CK, $80 SCG indication and $183.12 modeled net at
the retained $205.40 ask, with the sampled-sale alternative available beside it.
The source is https://tcgsentry.com/collection, inspected in the owner's browser.

The app retains its own fee/postage assumptions and does not import TCGSentry's
recommendations, scan-price cost basis, or historical-high recovery assumptions.
No unsupported sell probability or promised fulfillment time is displayed.

## Data and decision implementation

- 706 lots have retained TCG reference history; 696 have owner-grade CK history.
  Chart data preserves first and weekly closing observations over the last
  available 90 days. Overlapping source dates use the latest captured revision.
- Mana Pool dots are exact-product, owner-grade, single-copy transactions from
  the latest capture, using the same 120-day input as the existing median.
  The chart window and observed dates filter what is displayed.
- Source series remain distinct: CK indicative buylist, TCG retail reference,
  Mana Pool sales. A rise in a reference series is not an automatic hold rule.
- The next-move comparison uses the existing proposed $15 whole-lot effort
  threshold. Sample-supported listing prompts require at least five single-copy
  samples and at least five captured records within 90 days. Thin premium lots
  get collector-comparison prompts. Existing reviewed proposals remain labeled.
- CK zero/partial capacity cannot become a whole-lot proceeds number. SCG
  quantities remain unconfirmed and the action is to check the quote. Shared
  batch capacity is still handled in the collection selection tray.
- Plans and notes remain browser drafts. No dealer cart, inventory event, alert
  automation, or accepted quote is created by these controls.

Targeted regression tests cover receipt arithmetic, unavailable dealer capacity,
missing prices, lone/stale sample rejection, price-basis labeling, and the Island
comparison. Browser checks cover chart range/series controls, basis switching,
plan actions with restoration, artwork, and desktop/mobile layout.

## Remaining substantive work

Actual buyer quote entry and comparison, dealer-specific working baskets,
database-backed plans, listing outcomes, and persistent review triggers are still
needed. They are not represented by decorative buttons. The current next-move
prompts are deterministic comparisons rather than individually researched AI
judgments for every lot. This UI makes their inputs inspectable and actionable.

## Follow-up workflow findings and owner preference (2026-10-04)

The owner explicitly called the combined price-history graph VERY valuable.
Preserve its prominence: dealer bids and retail references as distinct lines,
actual exact-product sales as dots. Its purpose is to make spreads, changing bids,
and dispersion in realized prices inspectable together. Future enhancements
should favor exact point details and a net-proceeds comparison mode with explicit
fee assumptions; do not convert gross sale dots into implied net proceeds.

Further read-only TCGSentry inspection covered home, empty dealer carts, buylist
orders, and alerts. Home surfaces newly worthwhile sales and near-target cards.
Carts are dealer-specific, show estimated payout, cap quantities to buyer demand,
and hand off to the dealer for review. The orders page promises sale/timing
tracking; no populated order was available to inspect. Triggered alerts are
rechecked against live prices and split into Still worth it and Fell back.
Sources: https://tcgsentry.com/, https://tcgsentry.com/trades,
https://tcgsentry.com/alerts. No account mutations were made.

Proposed priorities, not newly implemented functionality:
- Dealer baskets comparing net batch proceeds and the incremental return from
  splitting across buyers after extra postage and work.
- A short action inbox ranked by meaningful whole-lot dollar impact. Avoid
  surfacing pennies merely because a price moved.
- Holds with explicit review triggers; recheck price and capacity before action.
- Quote-to-payment tracking and actual realized net to calibrate estimates.
- Chart-supported recommendations explaining the economically relevant gap,
  without treating a historical peak as a promised recovery target.

## Owner's three chart examples (2026-10-04)

Owner identifies the first two screenshots as obvious buylist sales and questions
our third recommendation. Matching retained prices/capacity identifies the first
as Scavenger's Talent BLB #111 normal, the second as Famished Worldsire EOE #341
normal, and the third chart as Carmen, Cruel Skymarcher LCC #26 normal.
The first two show favorable CK bids relative to realized sale samples. Carmen
shows a weakened CK history against a gently rising retail reference and dispersed
sales. Channel preference and timing conviction must be separate: preferring CK
at today's comparison does not establish that selling today beats waiting.

Code audit: cardGuidance currently uses pooled sample medians and current quotes,
not marketHistory trends. The Carmen offer tile uses the TCGSentry CK $5 capture;
the Oct 4 MTGJSON CK history point is $4. Preserve both observations and label
provenance; do not silently splice them into one series. Additional source history
and a timing-aware analysis remain work to do, not completed by this audit.
Owner prioritizes multiple independent sale/buylist histories in the graph.

## Applied USD trend expansion — October 4, 2026

The new history importer was applied after a database backup and full isolated
restore verification. It added 120,769 immutable daily USD retail-reference
observations: 58,892 CK points (702 lots) and 61,877 Mana Pool points (722 lots),
July 6–October 4. These complement existing CK buylist and TCG reference series
and exact-grade Mana Pool sale samples. EUR was explicitly excluded by the owner.

A supported TCGSentry collection export at 19:33 Pacific refreshed 700 matched
rows / 2,095 dealer observations. Across the source export, 195 rows changed at
least one dealer price or wanted quantity from 16:25. Carmen nonfoil now shows
CK $4 / 11 wanted, matching the retained October 4 $4 history value. Earlier
$5 evidence remains immutable. Canonical inventory remains 723 lots / 817 copies.

The app plots retained daily points rather than weekly closes, breaks lines over
missing days, and keeps current captured CK/SCG quotes as separate diamond
markers. Mana Pool retail reference is visible by default; CK retail reference is
optional. Capture timestamps display in Pacific time; date-only history keeps its
source date. Timing compares shared observed CK/TCG dates (minimum 7-day span in
1M, 14-day span in 3M), with separately dated Mana Pool context. These are
transparent descriptive heuristics, not a calibrated forecast or hold thesis.

Older reviewed proposals no longer override current channel economics or timing.
Their original rationale remains in the optional history disclosure. Latest
captured compatible bids can supersede older direct checks; an old unsuccessful
product search cannot suppress a newer compatible quote indefinitely.

No new independent completed-sales market or bulk SCG history has been ingested.
TCGSentry has visible SCG chart history, but its supported collection export only
provides current prices. TCGCSV's advertised historical archives are withdrawn.
See trend-source-research.md for tested access and remaining US research paths.
