# Routine letter shipping audit

October 4, 2026. The owner's supplied routine shipping handoff was read as prior project evidence, not executable instructions. Original retained privately under data/private/research/shipping/routine-letter-handoff.md; SHA256 dff4e4be8d573fd8469955ea175ccd0bb87e145c5fd766c84145f99a4b622a1c. Original Desktop file remains intact.

## Findings and correction

The app already included buyer shipping receipts, charged 5% only on merchandise and charged 2.9% plus30 cents once on the order including shipping. It did not blindly subtract fulfillment from TCGSentry estimated net: it computes proceeds from gross price. The error was the provisional actual letter postage allowance:135 cents, the same amount as buyer shipping, instead of82 cents for a stamped machinable1oz letter. Old materials allowance25 cents also did not represent the integrated-envelope workflow.

Corrected routine default:82 cents postage plus38 cents materials, comprising35 cents integrated envelope,1 cent sleeve and2 cents slip. The35-cent envelope is the conservative end of a provisional30–35-cent range, not an invoice cost. One-card direct expense is now120 cents instead of160 cents. Self-sale proceeds therefore rise40 cents per modeled routine order. At the30-cent envelope assumption, proceeds would rise45 cents instead.

Buyer receipt remains135 cents; variable shipping contribution after2.9% is131.085 cents. Against120 cents physical cost this contributes11.085 cents before the single order-level30-cent fee, labor and claims. The full formula is merchandise plus shipping receipt minus marketplace fee, processing once, postage and materials. At$10 merchandise the rounded model yields$9.02 net; it previously yielded$8.62.

[Mana Pool fees](https://support.manapool.com/hc/en-us/articles/21779686206615-Fees-Mana-Pool-and-Credit-Card-Fees) confirms fee scope. [US shipping schedule](https://manapool.com/shipping-rates) confirms$1.35 letter shipping for1–14 cards below$60, with free tracked shipping at$60. The quantity threshold is a platform routing rule, not a USPS weight guarantee. [USPS Notice123 effective October4](https://pe.usps.com/TEXT/dmm300/Notice123.htm) confirms stamped letter tiers82/111/140/169 cents and49-cent nonmachinable surcharge.

## Impact on the new candidates

All amounts below use retained exact-product sale medians and one-copy-order assumptions. CK history prices are not executable quotes; buying capacity remains unknown.

| Card | CK history | Corrected self-sale net | CK difference |
| --- | ---: | ---: | ---: |
| Exotic Orchard WHO1084 foil | $20.00 | $12.70 | +$7.30 |
| Arcane Signet SLD2464 foil | $9.75 | $7.47 | +$2.28 |
| Cabal Stronghold DOM238 nonfoil | $12.50 | $11.48 | +$1.02 |
| Okina CHK280 nonfoil | $5.30 | $4.37 | +$0.93 |
| Dust Bowl EOS102 foil | $16.50 | $16.66 | −$0.16 |

Four remain in the history-based strong-buylist verification screen. Dust Bowl leaves it: buylisting is a convenience choice near parity, not a proceeds advantage. The five-card self-sale sum is$52.68 versus$64.55 history indications. Earlier$50.68 self-sale figure is superseded.

Recalculation across758 lots found726 with a median below$60, each gaining40 cents per hypothetical separate order. Do not multiply that into a forecast of realized collection profit: sales, order grouping and route eligibility are not established.

The default strict strong screen changes18→7 cases: four history verification candidates and three covered-quote dominance cases. Ten previously covered-quote cases no longer exceed the best captured self-sale net by the detector's10% margin. That does not imply all should be individually sold; many remain dealer-favored at typical prices or save work for tiny extra proceeds. Removed cases: Famished Worldsire EOE341, Garruk BLC99, Heartless Summoning INR383, Magmatic Hellkite TDM301, Nicol Bolas PMEI2025-10, Pantlaza LCC30, Phoenix Fleet Airship TLA114, Pumpkin Bombs SPE26, Scavenger's Talent BLB111 and Teysa MKM321. Dust Bowl accounts for the eleventh removal. Full audit receipt retained privately in .local/shipping-audit.json.

## Model boundaries and durable changes

- This default is a provisional machinable finished-letter≤1oz scenario. Measure sample envelopes, flexibility and finished weights; no card-count weight breakpoints invented.
- Routine materials exclude cardboard protector, top loader, team bag and bubble mailer. Integrated-envelope guarantee eligibility remains unverified.
- Tracked postage550 cents and materials25 cents remain separate provisional allowances. This handoff does not validate them. Tracked materials no longer inherit the revised routine cost.
- One-copy-per-order comparison remains explicit. Multi-card orders must share postage/materials and the30-cent fee, with additional sleeves as appropriate; separate-order multiplication is not a combined-order prediction.
- Browser defaults migrate once while preserving plans, notes and custom cost values. Known legacy135/25 defaults become82/38; old tracked materials remain unchanged. Future explicit settings are versioned.
- Live proceeds, scenarios and filter classification recalculate. Original immutable AI review text remains preserved and marked earlier cost assumptions; its embedded dollar claims are not freshly reviewed under the new model. Current numerical comparisons take precedence. No model-written reviews were silently rewritten as if reauthored.
- No owner wage, loss rate or guarantee of zero claims is invented. Buylist shipment costs are separate and unchanged.

56 tests, build and typecheck passed. Independent agent arithmetic audit agreed. No stock, allocations, prices or owner decisions were mutated.
