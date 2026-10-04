# Card selling product and decision baseline

The October 4 market-source survey extends this baseline: see
`market-source-survey.md`, `market-source-registry.json` and `synthesis-design.md`
for source access, independent demand signals, capped transaction samples and the
Atlanta November 13–15, 2026 quote workflow. These remain proposed implementation
requirements; research did not apply a migration or change inventory decisions.

Reanalysis dated 2026-10-04. This replaces the old workbook's rules as the proposed
implementation specification. Owner preferences below are confirmed; proposed
policy defaults and schemas remain reviewable. This document is not an applied
database migration or a set of accepted sales. Source identifiers refer to
`sources.json`; assumptions have stable identifiers in `assumptions.json`.

## Objective and limits

Earn worthwhile cash from the available personal collection with limited active
effort. There is no immediate cash deadline. Six to ten hours per week is a ceiling,
not a target. Patient selling and holding are appropriate when evidence supports
them. Extra proceeds must justify the work; automatic buylisting and automatic
holding are both inadequate defaults.

Cash proceeds, active effort, elapsed time, uncertainty, and retained inventory are
separate outputs. Do not optimize a blended integer score. A Pareto comparison of
cash and effort is more useful: reject an option when another gives at least as
much credible net cash with no more work and no worse relevant risk. When estimates
overlap, prefer the easier option or gather evidence only if it can change the choice.

The fresh scan defines the sale tranche as an owner assertion of physical stock.
It is not a verification by the app of every physical card. The historical loose
collection informs locating cards, not present quantities. Decks are excluded by
the handoff; do not expand scope into deck dismantling. Keep the existing local
PostgreSQL/Next foundation. Desktop first, mobile for lookup, physical confirmation,
quotes and fulfillment. Hosted access later; offline writes and native packaging
are not accepted requirements. Product layout remains undecided.

## Conclusions that replace earlier assumptions

1. A bid displayed by an aggregator is an indication. Wanted quantity, identity,
   condition, grading, freshness and quote acceptance determine its usefulness.
   A missing capacity is unknown; zero indicates no capacity in that snapshot.
2. The TCGSentry Mana Pool figure is a percentage-fee estimate assuming a sale,
   before shipping and the fixed per-order charge [S1, S2]. It is not final net cash.
3. Scan reference price is not cost basis. Ignore source profit/loss calculated
   from that field. Preserve it for reference and locating historical inventory.
4. Prior highs and upward charts do not prove future recovery. Strong current
   liquidity can favor listing now; it does not logically imply holding.
5. Thin market means a wider uncertainty interval and greater unsold risk. It
   supports neither an automatic discount to a dubious aggregate nor an automatic hold.
6. Page-title identity is insufficient for premium treatments. Inspect underlying
   sale titles and exclude mixed treatments before accepting a series [S8].
7. Time-insensitive sale timing does not permit slow fulfillment after an order:
   a live marketplace shop introduces a prompt shipping obligation [S5].
8. A convention quote is a channel opportunity. Compare its marginal handling and
   lost event time to mailed buylist/retail alternatives. Already-planned travel
   is not automatically a cost of selling; extra travel or lost enjoyment can be.
9. Existing source snapshots and recommendations remain historical records. New
   interpretations supersede them explicitly and do not edit source facts.

## Decision sequence

### Establish what can be sold

Resolve printing, treatment, finish, printed language, source language conventions,
condition, ownership availability, and location. Preserve ambiguous candidates.
Foreign or Phyrexian text does not inherently make a card unsellable. Reconcile
catalog conventions and channel acceptance instead of using a blanket exclusion.
Unresolved identity blocks execution, but should still allow bounded research.
Separate normal/foil/etched from treatments such as textured, surge or rainbow foil.
Condition mappings express vocabulary equivalence only; they never certify a grade.

### Build independent alternatives

For each available lot or group, create candidates for buylist, retail listing,
vendor quote, and waiting. Include quantity coverage and the origin of each price.
Cash, store credit, indicative quotes, approved quotes, and realized payments are
distinct. Do not sum alternative offers on the same copies. Allocate shared dealer
demand across all lots of the same accepted product, not once per lot.

Low-value stock belongs in a batch comparison: incremental pick/pack effort can
be low in an existing basket, but hundreds of new singles orders can be costly.
Track outstanding live listings and the ability to fulfill them, not just nominal
weekly hours. A break in availability should pause new orders rather than delay
already-accepted ones.

### Calculate comparable cash

For a domestic Mana Pool order, define merchandise M, seller shipping credit S,
marketplace fee Fm, actual processor fee Fp, postage P, consumables C, and expected
unreimbursed losses/refunds L. Then:

`cash_net = M + S - Fm - Fp - P - C - L`

Current published standard policy [S2-S4]: `Fm = 0.05*M` for ordinary items and
`Fp ≈ 0.029*(M+S)+0.30`. The processor's exact base, including any buyer fee or
tax treatment in settlement, must be checked against a real payout before treating
the approximation as accounting truth. Do not deduct buyer singles fees as seller
expenses by default. Do not deduct percentage fees twice from TCGSentry's estimate.
The $50/item marketplace-fee cap is documented as requiring a rebate while being
automated; model it as policy, not a guaranteed immediate deduction [S10].

Domestic shipping policy is piecewise [S3]: below $60 merchandise, 1-14 cards use
the letter tier ($1.35 buyer charge); 15-199 use tracked bubble ($6.49); 200+ use
tracked box ($9.99). At $60 and above, shipping is free to the buyer and tracked.
These are buyer charges, not the seller's actual postage. Method/size/weight and
buyer upgrades must also satisfy the current policy. Do not assume a purpose-built
envelope qualifies as ordinary letter mail without checking its packed dimensions.

The threshold can reduce seller net: moving from $59.99 to $60 loses shipping
credit and may require tracked postage. Therefore marginal card contribution must
be calculated at order level. Per-card allocation is for explanation only and
must reconcile back to the order once; avoid phantom additional fixed fees.

For a dealer shipment, use accepted quantity × grade-adjusted cash, less the
shipment's actual postage, packing, payment fees and expected unreimbursed loss.
Grade deductions are channel-specific [S6-S7]. A source number may already include
a condition adjustment; record its basis before applying another deduction.

Report active work separately. For sensitivity only:
`effort_adjusted_net = cash_net - proposed_hourly_value*active_minutes/60`.
No hourly value has been chosen by the owner. Show $15/$30/$60 scenarios, measured
minutes when available, and break-even minutes. Time to payment is a separate field.
Do not treat the owner's savings as permission to ignore downside.

### Apply AI judgment where it earns its cost

The AI interprets evidence and challenges hypotheses; deterministic code performs
arithmetic, quantity allocation and required checks. A recommendation contains:

- best plausible alternative and credible incremental dollars;
- evidence IDs with exact scope, dates and upstream origin;
- active effort and uncertainty range, with assumptions visible;
- strongest argument against the recommendation;
- missing fact most likely to change the choice;
- concrete next action, review trigger and stopping rule.

Hold requires a thesis: demand catalyst or supply constraint, evidence, horizon,
downside, sale trigger and falsifier. Reprint risk, metagame changes, new substitutes,
or disagreement between dealers and actual sales are reasons to challenge it.
Those risks are hypotheses unless current evidence establishes an event. Never
invent a catalyst, a price target or calibrated probability. A failed/stale thesis
returns to comparison; it does not force a sale on an arbitrary date.

Waiting is compatible with a patient retail listing at a defensible price. The
choice is not limited to immediate dumping versus keeping a card off the market.
Test whether listing preserves useful upside without creating unacceptable work.
Use partial sale/hold allocations when there are multiple copies and a reason.

Research priority follows potential decision value, not maximum card value alone.
Investigate a large uncertain spread first, then test whether further research could
change the decision. Stop when the plausible upside is smaller than extra work,
the remaining sources cannot resolve the question, or an easy option dominates.
Do not pay for data subscriptions under the current preference. Browsing/tool/model
expense and the owner's review time count toward the benefit of more investigation.

## Evidence and freshness

Store source observation time, capture time, underlying event period and expiry
separately. A page read today does not make its historical market value current.
A source filename with no timezone stays a local string plus uncertainty. Date
precision is explicit. Same-day dealer demand can change while the aggregate value
appears stable. Recheck on preparation and again at acceptance; use documented
dealer quote validity once actually approved. Do not invent a universal 24h guarantee.

Scryfall default bulk is a catalog subset by language; its own documentation warns
against using aged bulk prices for sales [S9]. Keep catalog and pricing freshness
separate. For exact foreign objects use targeted lookup or all-language data when
needed, rather than replacing every object's language from a bulk default.

Do not count several aggregators consuming the same TCGplayer feed as independent
corroboration. Save upstream origin, sample window, sample count, price statistic,
condition, treatment, shipping inclusion and outlier decisions. If unavailable,
say so. Completed-sale counts without a window cannot become sales/day. Observation
coverage, successful identity mapping and decision readiness need separate counts.

## Workflow and implementation order

1. Finish the source/lot contract and read-only reconciliation. Show changed rows,
   ambiguous identity and candidate resolutions before accepting a new stock count.
2. Add immutable observations and mappings under the proposed contract. Refresh
   market evidence without changing physical stock. Keep captured private data local.
3. Add deterministic channel and order calculations, then structured AI review.
   Initial analysis bands are triage only; pilot evidence chooses useful thresholds.
4. Run a small, deliberately varied pilot: easy dealer batch, a handful of meaningful
   retail candidates, one basket case, and a few evidence-backed hold theses.
   Record preparation/fulfillment minutes, actual fees, grading and realized cash.
   Owner chooses whether and when to execute; current work authorizes analysis.
5. Add reservations, fulfillment and payments before enabling actual transaction
   recording. Vendor quote comparisons must allocate the same physical copies once.
6. Shape the desktop/mobile views around the accepted workflow and physical tasks.
   Add one data integration at a time. Avoid building an entire storefront engine
   when ordinary exports, a local ledger and focused AI review do the job.

Success is worthwhile net cash with tolerable work, reconciled remaining stock,
useful explanations and fewer repeated decisions. Full research of every low-value
card, a large codebase, or an always-busy agent is not a success metric.

## Acceptance examples

| Challenge | Required result |
| --- | --- |
| CK $20, wanted 0, SCG $18 with no capacity | CK unavailable in snapshot; SCG indicative and needs confirmation; no executable $20 baseline |
| Demand 5 across two lots holding 4 each | Maximum five copies allocated to that quote in total |
| Japanese and English rows share exported UUID | Preserve both holdings; resolve language/product mapping before transfer of economics |
| Two differently located lots have identical variant/condition | Two lots; one market variant; no lost location or forced merge |
| Reordered CSV / changed reference price / repeat download | No additional stock without accepted reconciliation; new market capture is allowed |
| Missing row in a subset export | No sale or disposal inferred |
| Old full snapshot imported after newer one | Historical evidence only unless explicitly adopted through reconciliation |
| Observation corrected or provider removes a product | Preserve old assertion and invalidation; do not silently relink history |
| SCG price higher by $1 but requires a second shipment | Compare incremental shipment and handling cost before splitting |
| Retail source figure already deducts percentage fees | Deduct only remaining applicable charges, or rebuild from gross; never both |
| $59.99 basket gains one cent | Recompute shipping tier, buyer credit and fulfillment cost |
| Sparse page contains a textured-foil sale | Quarantine mixed observation; no averaged premium price |
| Previous bid was $75, current $45 | Prior-high reference alone cannot create an accepted recovery thesis |
| AI recommends sell while physical identity unresolved | Execution readiness stays blocked; explanation and research remain available |
| Dealer quote accepted, cards mailed, payment pending | Copies reserved/outbound; record finalized sale and payment separately |
| Partial grading rejection/return | Only accepted copies sell; returned copies reconcile into a reviewed physical state |
| User overrides recommendation | Preserve model output and record owner choice/reason separately |
| Event attendance already planned | Include incremental selling work and avoidable costs; do not allocate the entire vacation |
| TCGSentry says loss on scan reference value | No acquisition loss or tax basis asserted |

## Concrete specification files

- `assumptions.json`: authority, status, units and review triggers.
- `data-model.json`: proposed relational grains, keys, types and invariants.
- `decision.schema.json`: structured AI decision output, separate from stock actions.
- `sources.json`: source registry and what each can establish.
- `scripts/reanalyze.mjs`: reproducible read-only full-inventory screening using the
  separately retained fresh dealer export. Private results remain in `.local/`.

Unresolved inputs are bounded: confirmed physical language/treatment for flagged
cards, a real seller settlement, actual packed postage/materials, observed effort,
and stronger evidence for high-value timing theses. None requires inventing a
universal score or assuming every card needs manual research before progress.
