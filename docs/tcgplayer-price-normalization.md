# TCGplayer price and shipping normalization

Research checkpoint: October 5, 2026. Owner requests apples-to-apples comparisons; this extends the Warden audit without rewriting historical observations.

## Confirmed definitions

TCGplayer Best Practices for Pricing Your Items explicitly defines seller-tool TCG Last Sold Listing as Price + Shipping of the last completed sale. TCG Lowest Listing similarly refers to lowest combined Price + Shipping. Market Price is described as average recent sales for a specific product and condition; this page does not explicitly define its shipping basis. Public Most Recent Sale and Latest Sales rows must not automatically inherit the differently named seller-tool definition.

CSV export distinguishes TCG Low Price from TCG Low w/ Shipping and states TCG Marketplace Price excludes shipping/handling values. TCGplayer Tips For Pricing explicitly discusses embedding shipping costs into card prices. Thus even item-only amounts can reflect different seller shipping strategies.

Direct orders below $50 carry $3.99 package shipping; above $50 ship free. Consequently the Warden $3.10 Direct offer is not necessarily $3.10 delivered for an isolated purchase. For one otherwise empty domestic Direct package, its illustrated total would be $7.09 before tax. A larger qualifying package changes that comparison. This is a documented scenario, not an actual checkout observation.

## Warden screenshot comparison

All dollar amounts USD, before tax. Compare NM foil only; exclude damaged and LP from NM alternatives.

- Novo: $3.10 item + $1.49 shipping = $4.59 single-copy delivered.
- GitGud: $5.02 with shipping included = $5.02 delivered.
- Imhaze: $4.98 + $1.49 = $6.47 for a single copy below its free-shipping threshold.
- Mojo Direct: $3.10 merchandise; package shipping depends on the Direct cart, not zero merely because no charge appears next to the headline price.

Novo versus GitGud is a $0.43 delivered difference, despite a $1.92 item-price difference. Current listings are asking prices; they do not establish completed-sale distributions or explain the entire Market Price gap.

## Operational normalization contract

Retain exact product/printing, finish, language, condition, currency, quantity, source, metric name, capture timestamp, sale timestamp when known, seller fulfillment channel, and raw amount. Add explicit price_basis enum: merchandise_only, merchandise_plus_shipping, delivered_before_tax, aggregate_basis_unverified. Keep shipping_amount nullable (unknown is not zero), shipping_scope (order/package/item/unknown), free_shipping_threshold, merchandise_subtotal, delivered_total_before_tax, and allocation_method.

For a one-item completed order with known item price P and buyer shipping S, delivered total is P + S. For multi-card packages, retain package shipping separately; use an explicitly labeled allocation scenario if needed, never charge the full package shipping to every card. Included shipping means buyer charge zero; do not infer or subtract the seller's embedded postage cost from merchandise revenue.

Compare buyer alternatives using delivered total for the same cart scenario. Compute our seller proceeds using our own marketplace fees, buyer shipping receipt, postage and packaging. If a source reports delivered total, do not add a second shipping receipt when modeling proceeds. Do not apply Mana Pool's $1.35 receipt to an unnormalized TCG delivered amount.

Unknown-basis aggregate TCG references remain trend/context signals, not direct self-sale gross inputs or proof of a premium. Our current net estimator uses Mana Pool ask/sale evidence; the TCG line is a separate provider reference. Cross-source percentage gaps must identify their basis and cannot alone establish an achievable selling price.

## Remaining uncertainty and resolution

Inspected public latest-sales table exposes price and quantity but no separate shipping amount. Official inspected Market Price documentation does not settle shipping inclusion/allocation. Preserve the ambiguity rather than subtracting a generic $1.49 or $3.99. A supported feed exposing transaction merchandise and shipping separately, or a direct clarification from TCGplayer, is needed to settle that metric. No support message has been sent.

## Sources

- https://help.tcgplayer.com/hc/en-us/articles/201914668-Best-Practices-for-Pricing-Your-Items
- https://help.tcgplayer.com/hc/en-us/articles/115002358027-Importing-and-Exporting-CSVs-to-Mass-Update-Prices-and-Quantities
- https://seller.tcgplayer.com/blog/articles/tips-for-pricing
- https://help.tcgplayer.com/hc/en-us/articles/201996857-Buying-from-TCGplayer-Direct
- https://help.tcgplayer.com/hc/en-us/articles/222376867-What-do-the-different-price-points-on-TCGplayer-com-mean
