# Shipping model and fulfillment choices

This is the maintained shipping reference for the personal card-selling app. It supersedes both October 4, 2026 ChatGPT shipping handoffs as working guidance. The audit documents retain the history of corrections; future work should start here and use the app's current settings. Evidence checked October 4, 2026.

The central rule is to calculate proceeds per order: include buyer-paid shipping, apply fees to their correct bases, and subtract actual physical fulfillment once. Current card comparisons model one copy per order. They do not predict how cards will combine into real customer orders.

## Owner choices

The routine letter workflow is penny sleeve → commercial integrated three-pocket envelope → packing slip → postage. The owner ordered a five-pack sample. Separate cardboard protectors, top loaders and team bags are excluded from that lane. The sample needs weighing and testing before card-count weight breakpoints can be established.

The tracked workflow is penny sleeve → top loader → resealable team bag → purchased 6×10 kraft bubble mailer → Pirate Ship USPS Ground Advantage label. The owner purchased 100 BCW team bags, a ZENOWICK bundle of 100 top loaders and 100 sleeves, and 100 Fuxury mailers. A 6% Amazon-card rebate was reported. The postal scale and laser printer are already owned; a thermal printer was deferred. No printer purchase or amortization is included.

This is personal liquidation. The owner's available time is a ceiling, not a production target. No hourly wage or obligation to maximize order volume is assumed. Extra net dollars, preparation and fulfillment work should be shown together when comparing self-sale, buylist, holding and MagicCon offers.

## Verified platform rules

Mana Pool charges 5% of merchandise, excluding shipping, and 2.9% of merchandise plus shipping with a single $0.30 processing charge per order. The seller receives buyer-paid shipping less its processing charge. [Fee policy](https://support.manapool.com/hc/en-us/articles/21779686206615-Fees-Mana-Pool-and-Credit-Card-Fees).

For US domestic singles packages below $60: 1–14 cards use a $1.35 letter rate, 15–199 use a $6.49 tracked bubble rate, and 200+ use a $9.99 tracked box rate. At $60 or more, shipping is free to the buyer and tracked. A buyer can upgrade a letter-eligible shipment to tracking. The owner is not modeled as a tracked-only seller. Card-count routing is not a guarantee of USPS weight or machinability. [Rate schedule](https://manapool.com/shipping-rates).

Tracking-required shipments must use USPS Ground Advantage or better in a bubble mailer or box; letter-tracking products are insufficient. Guarantee eligibility for the chosen integrated letter product has not been established. [Shipping requirements](https://support.manapool.com/hc/en-us/articles/20931944865559-Shipping-Rates-and-Methods).

## Routine letter costs

| Input | Current value | Evidence status |
| --- | ---: | --- |
| Stamped postage, finished weight ≤1 oz | $0.82 | USPS rate |
| Stamped postage, ≤2 / ≤3 / ≤3.5 oz | $1.11 / $1.40 / $1.69 | USPS rates |
| Nonmachinable surcharge | $0.49 | USPS rate; not assumed in base case |
| Integrated envelope | $0.35 | Planning estimate; reported bulk range $0.30–$0.35 |
| Sleeve | $0.01/card | Planning allowance |
| Packing-slip paper/toner | $0.02/order | Planning allowance |
| One-card base materials | $0.38 | Sum of planning allowances |

USPS metered rates are $0.04 lower at each listed weight tier; stamps remain the default. Letters have a maximum thickness of 1/4 inch and additional machinability requirements. Merely fitting the dimensions does not establish machinability. [USPS Notice 123 effective October 4, 2026](https://pe.usps.com/TEXT/dmm300/Notice123.htm).

`letter physical cost = actual weight-tier postage + envelope + sleeves used + slip consumables`

For the one-card ≤1 oz base case, physical cost is $1.20. The $1.35 shipping receipt contributes $1.31085 after percentage processing, leaving about $0.11 before the order-level fixed fee, labor and claims. At the $0.30 envelope assumption that balance is about $0.16. A 2 oz letter adds $0.29 to expense; a nonmachinable letter adds $0.49. Actual measured classification controls.

## Tracked costs

Purchased-supply arithmetic uses the reported rebate and quantities:

| Component | Reported purchase | Cost per unit after rebate |
| --- | --- | ---: |
| Team bag | $4.99 / 100 | $0.046906 |
| Top loader plus sleeve pair | $12.99 / 100 pairs | $0.122106 |
| 6×10 bubble mailer | $23.99 / 100 | $0.225506 |
| Basic single-card package | One of each above | $0.394518 |

These are reported purchase facts; invoices were not independently inspected. The app rounds basic tracked packaging to $0.40. It adds a separate configurable $0.05 label/paper/toner/tape allowance. That five-cent allowance is a provisional implementation assumption, not a measured cost. No thermal-label expense is introduced.

Pirate Ship postage remains a configurable $5.50 scenario. The handoff's $4.75–$6.50 range is a sensitivity range, not a guaranteed tariff. Actual rates depend on origin/destination, packed weight, dimensions, zone, rate date and possible Cubic eligibility. Use a current quote when available; do not add a surcharge twice. Holiday increases began October 4. [Pirate Ship rate information](https://www.pirateship.com/usps/ground-advantage-weight-based), [holiday changes](https://support.pirateship.com/en/articles/16977249-usps-temporary-rate-increase-for-the-2026-holiday-season).

`tracked physical cost = quoted postage + actual protective materials + mailer + label/slip consumables + optional extra insurance`

For the one-card default, physical cost is $5.95. A buyer-paid $6.49 shipment contributes $6.30179 after percentage processing, about $0.35 above physical expense before the single fixed fee. With free tracked shipping, the seller absorbs the $5.95. Ground Advantage includes $100 USPS liability coverage; this does not eliminate loss exposure or determine extra insurance above $100. Insurance, claims friction and expected losses remain unquantified.

Do not assume a fixed count of top loaders for multi-card shipments. Use actual sleeves, protectors and bags consumed. The pair purchase price is convenient for a one-card package, but does not establish individual component costs for every mixed packing configuration. Larger shipments may need a box; no box cost has been validated here.

## Proceeds and channel decisions

Let M be order merchandise, S buyer shipping receipt, P postage, K protective packaging and C printing/label consumables:

`net = M + S − 0.05M − [0.029(M + S) + 0.30] − P − K − C`

The app rounds each fee to cents. Examples use current planning costs and exclude labor, claims, additional insurance and taxes:

| One-card scenario | Modeled net |
| --- | ---: |
| $10 sale, ≤1 oz letter | $9.02 |
| $50 sale, buyer pays tracked upgrade | $46.10 |
| $60 sale, free tracked shipping | $49.01 |
| $75 sale, free tracked shipping | $62.82 |

The $60 break is an order subtotal threshold. An extra card can change the entire order's routing and shipping receipt. Multiplying one-card net by quantity models separate orders, not combined fulfillment. Buyer upgrades are available as a scenario; their frequency is unknown.

TCGSentry's estimated Mana Pool net is hydration context, not the base for another unexplained postage deduction. App proceeds are computed from gross price and explicit fees/receipts/costs. Unknown price stays unknown. Retained sale samples, asks and history indications remain distinct from executable offers.

Compare net dollars against a fresh exact buylist quote with accepted quantity, condition and shared batch shipment costs. Self-sale fulfillment does not determine buylist shipping. MagicCon handoffs have separate marginal costs. A tiny self-sale advantage may not justify the work; a favorable dealer channel does not by itself settle whether to sell now or wait for a supported demand change. No universal owner wage, claims reserve or required premium is embedded.

## Implementation and provenance

Current defaults and migration live in src/lib/selling-economics.ts, model version tracked-pilot-v3. App settings expose postage, letter materials, tracked packaging, tracked consumables and shipping scenario. Known legacy defaults migrate once; plans and notes remain untouched. Custom costs persist. Dynamic estimates and filters recompute; older immutable written AI reviews remain marked earlier cost assumptions rather than silently rewritten.

Historical correction receipts: routine-shipping-audit.md and tracked-shipping-audit.md. Those record prior model values and tests; this document is the maintained reference. Raw handoffs are retired input artifacts, not required operating documentation. Their hashes are retained in the audit receipts. Current code was verified with 57 tests, build and typecheck at the tracked audit checkpoint.

## Measurements still worth collecting

1. Integrated-envelope invoice cost, empty weight and completed weights with actual slips/sleeves, plus flexibility and thickness. Record safety margins at USPS boundaries.
2. Whether that integrated product meets Mana Pool guarantee requirements.
3. Actual packed tracked weight/dimensions and Pirate Ship quotes across destinations, then paid label receipts.
4. Actual multi-card packaging consumption and laser-label/tape costs.
5. Cards per order, fulfillment minutes, shipping receipts/costs, fees, days to sell and claims outcomes. Keep realized facts separate from estimates.

For eventual order telemetry, retain merchandise subtotal, card count, shipping lane and receipt, fee bases, actual label amount, weight/dimensions, actual material counts/costs, optional insurance and labor, final proceeds and source/date. This is a proposed data contract; it does not claim an order ledger or Pirate Ship integration is already implemented.
