# Sales activity and volume — October 5, 2026

The owner's TCGplayer screenshot is the target: exact-product price history with
units-sold bars, plus a 90-day total. Its visible example has 193 units sold in
three months, about two units/day, and seven units in the September 11–13 bucket.
Units are copies, not orders or distinct buyers. The screenshot does not establish
which printing or SKU it depicts; do not attach its 193 to a card without verifying
product, finish, language and selected condition.

## Dependable source lanes

TCGplayer's actual product-page history is the strongest currently visible volume
lead. Capture the selected SKU identity and displayed window, units sold, average
daily sold and dated chart buckets through the authorized browser. Store these as
dated TCGplayer volume evidence, separately from its price-reference observations.
Record bucket start/end, not a fictitious sale timestamp. Preserve the source's
rounded daily figure; calculate a precise daily figure separately from total/window.
Never use TCG Low/Mid/High or a price history's number of dates as sale volume.

The official [pricing API documentation](https://docs.tcgplayer.com/reference/pricing)
describes market, low/mid/high and buylist price endpoints; it does not establish a
supported all-market sold-volume history endpoint. The official
[getting-started guide](https://docs.tcgplayer.com/docs/getting-started) says new API
access is no longer granted. Consequently an automated full-collection TCGplayer
volume feed is not yet verified. Undocumented third-party endpoint recipes are not
the same as a supported provider feed. Browser captures can immediately support
priority cards without pretending the bulk MTGJSON prices contain volume.

Mana Pool's provider OpenAPI schema, retained in
`.local/source-survey/manapool-openapi.json`, documents `recentSale.quantity` as
quantity sold and `lookupVariant.recent_sales` as up to 20 records. Its public
`/api/v1/products/singles` catalog gives exact-condition/language/finish samples.
Existing canonical observations retain quantity, timestamp and original raw record.
They have no stable sale identifier. Every daily capture is retained, so activity
history can grow beyond the latest 20 records without summing overlapping captures.
This yields **observed activity**, not total platform volume. High-volume products
can rotate through more than 20 records between checks and hide sales permanently.

## Working implementation

`src/lib/sales-activity.ts` calculates retained observed records and observed units,
weekly bars, latest observed sale, last successful sample check, and whether any
capture reached its cap. It deduplicates timestamp/price/quantity fingerprints
across captures using maximum within-capture multiplicity. Thus two indistinguishable
rows in one capture remain two rows, while repeated downloads do not double count.
Without provider IDs, collisions can still hide genuinely separate sales; the count
remains a lower bound. Invoke it for one exact mapped product/condition only; never
combine conditions or language editions. Do not invoke separately for physical lots
and add the totals when lots share a product.

The main-view label should be **Observed units · 90d**, with Mana Pool provenance
beside it. Weekly bars may show observed units but must not label an empty bucket
“no sales.” The helper explicitly leaves acceleration unmeasured: sampling cap and
capture frequency can produce false growth/decline. Source details can explain the
sampling once, without boilerplate in the primary view.

For verified TCGplayer complete-window bucket evidence, show **TCG units sold · 90d**
and **Units/day**, and calculate last-30 versus prior-30 activity only from matching
SKU filters and complete, comparable bins. Price rising with sustained/rising units
supports a patient-sale test; price rising on isolated units calls for caution.
Current offered quantity divided by verified same-market daily units can provide a
rough supply/flow ratio, explicitly a market ratio rather than the owner's sell time.
Listing disappearance, dealer wanted quantity, EDHREC popularity and stock depletion
remain distinct signals; none is a counted completed sale.

No external feed was enabled, inventory changed, or unsupported volume asserted by
this research. Five focused helper tests cover overlap, multiplicity, units, empty
captures, the cap, windowing and malformed/future records.

## Live Warden inspection, October 5

Product625028 Foil view reports52 total sold in its3MonthSnapshot. The earlier normal screenshot reports193; these are different finishes. Visible latestsales include bothNM andLP because Condition was unfiltered, so do not sum the mixed table into anNM-only count. NM foil individual displayed prices include$3.00,$3.20,$5.72,$6.78. No separate shipping amount is displayed there. Shipping inclusion in aggregateMarketPrice remains unverified. Keep the aggregate reference, individual sale prices, shipping receipts and seller net distinct.
