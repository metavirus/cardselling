# Card decision UI audit — October 4, 2026

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
