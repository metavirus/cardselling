# First buylist tranche — October 4, 2026

This is an analyst-reviewed, **proposed** `JUST_SELL_TO_BUYLIST` tranche,
pending the owner's execution decision and a real dealer checkout. It is not
an instruction to mail cards or an accepted Card Kingdom offer. Run
`8ee01bb3-77a9-53c6-a36c-f9b739f34193` stores 20 exact lots, 29 available
copies and $181 gross **indicative** cash. No owner-choice, reservation,
transaction, stock or cash record changed. The private per-lot report retains
identifiers, dated observations and arithmetic; this repository document omits
the private item list.

The owner explicitly requested selling directly to companies with buylists for
this task. Retail prices are only comparison evidence; this tranche does not
ask the owner to list cards individually. Card Kingdom is the verified buyer
for this first batch, not a claim that it pays the best bid across companies.

## Fresh comparison across companies

The owner identified the live TCGSentry collection as the best available dealer
comparison. A new October 4, 16:25 local export is retained separately from the
retired exports. Its dealer fields hydrate canonical evidence; its quantities,
cost fields and sell signals do not control inventory or recommendations.
Underlying dealer refresh times are unknown. Export time is capture time only.

Across the same reviewed 29 copies, SCG's exported indications total $115.82,
assuming acceptance and sufficient capacity. The direct-checked CK indications
remain $181. SCG exceeds CK only on Show and Tell, by $0.50. Keep this batch
together at CK rather than creating a second shipment for that difference.
The broader buyer-comparison report separately evaluates additional candidates.
These findings do not establish that CK is the best buyer for every card.

Compare whole dealer baskets, including incremental shipping, packing, payment
fees and active work. SCG export capacity is unknown. Its published payment
options include a check for qualifying totals and PayPal with seller-paid fees;
the typical domestic PayPal fee is $1. Current source policies:
[SCG payment](https://help.starcitygames.com/en-US/receiving-payment-1056898),
[SCG approval and shipping](https://help.starcitygames.com/en-US/approval-shipping-instructions-1056762).

The $2-per-copy and $5-per-lot thresholds below define a conservative first
screen, not an exhaustive selling policy. Sparse retail samples and sub-$1 bids
do not automatically mean hold or retail. Evaluate worthwhile additions against
their marginal contribution and handling within an existing dealer shipment.

## Evidence and screen

The canonical 723 lots / 817 copies were screened. A hashed transcript of public Card Kingdom
buylist checks covers 24 exact lots: 22 listed with displayed cash and wanted
quantities, two absent. Historical MTGJSON Card Kingdom indications remain
distinct. The screen found 98 lots / 114 copies that meet **proposed** research
thresholds, of which 78 lots have historical-only bid indications and still need
live exact-product checks. Only the 20 live-checked passing lots became stored
analyst proposals. Of those, 15 have bids of at least $5 each; five smaller
lots are possible additions to a dealer batch. The live shortlist is 29 copies:
15 singletons plus batches of 6, 2, 2, 2 and 2 copies.

The transparent triage asks for a cash indication of at least $1, an exact-grade
Mana Pool ask, a TCGplayer retail reference, at least three reported quantity-one
Mana Pool sale samples dated within 120 days, and a bid no more than 14 days old.
It compares the dealer indication with an intentionally retail-favorable
single-card scenario: price is the maximum of the ask, sample median and TCG
reference; standard published Mana Pool fee estimates apply; seller shipping
credit is $1.35 below $60; postage, materials and loss are set to zero. Passing
means this scenario exceeds the bid by at most $2 per copy and $5 across the
lot. The $5 bid threshold distinguishes priority research from batch additions.
Sensitivity at $1/$2/$3 per-copy limits was calculated, but no threshold here is
an accepted owner policy or calibrated profit target.

The zero-cost assumptions favor retail on **omitted costs**. They are not an
upper bound on future retail prices, a forecast of sell-through, or a claim
that single-card and combined-order economics match. Mana Pool samples are
capped at 20 per product, have unknown completeness/overlap, and their unit
price basis is unverified. TCGplayer is a reference price, not a completed sale.
EDHREC rank does not measure demand for a particular premium printing. The
screen neither auto-holds nor classifies the other 703 lots as sell-now failures.

## Before execution

Recheck exact product, finish, grade-adjusted cash, live wanted quantity and
combined capacity at dealer checkout. Estimate or record actual batch postage,
packing and any deductions; $181 excludes them. Confirm the owner's choice
before creating reservations or sale records. Public wanted quantity is not
approved capacity, and an absent listing is not a zero-dollar bid.

`scripts/buylist-first-pass.mjs` regenerates the read-only report from current
observations; `scripts/save-buylist-review.mjs` persisted the reviewed **v1
snapshot** and its SHA-256 manifest. The report output path can be overwritten
by a new analysis run. Do not blindly rerun the save command against a changed
report: review and version the policy, source manifest and comparison first.
The stored run is immutable evidence of what was proposed at this point in time.

## Fresh aggregator buyer comparison

A later October 4 TCGSentry export was matched by accepted Scryfall ID, set,
collector number, finish and printed language. Of 718 source rows, 703 match
canonical identities; three of those disagree with the owner's LP grade and
are withheld from economic use. Fifteen source rows have no accepted exact
canonical counterpart. Numeric Card Kingdom prices with displayed zero wanted
quantity are unavailable, not sellable bids.

Reapplying the transparent screen with fresh exact-identity CK indications and
shared displayed capacity yields 93 **research candidate** lots / 109 copies
at $365.05 gross indications. Seventy-three lots / 80 copies / $184.05 of that
total are newly surfaced by aggregator data and have not received direct dealer
checks or analyst recommendations. A separate SCG screen finds 24 lots / 29
copies at $58.50 gross indications, with unknown SCG capacity. These are
prioritized research baskets, not additions to the stored 20-lot proposal.
The private comparison report records the exact matches, rejected conflicts,
missing prices, buyer alternatives and bounded batch-addition queue.
