# Collection-wide analysis contract

October 4, 2026. Applied detector plus model-written per-printing reviews.

The owner wants the app to find the patterns across all holdings, rather than
requiring manual chart inspection. Every canonical lot receives a saved review;
list alerts and filters expose the most actionable evidence. AI commentary is
written against a dated input checkpoint. Current arithmetic and pattern findings
recalculate with editable cost settings. Analytical reviews do not assign owner
plans, reserve inventory, or execute sales.

## What is compared

- Dealer cash versus captured sale gross, separately from modeled sale net.
  A current bid requires a capture within seven days and capacity covering all
  lots sharing variant and grade. Gross dominance requires at least five
  comparable 90-day sales, three recent sales, three observed days, both fresh
  TCG and Mana Pool references, and a 10% margin above every captured price.
  Net dominance is labelled separately and uses even the highest captured sale.
  Conflicting same-day dealer sources block the compelling alert.
- Exact-grade single-copy transactions versus the Mana Pool retail reference on
  the same observed UTC day. At least three transactions across three days must
  exceed it by 20%. Missing or zero references are excluded. The retail reference
  has unspecified condition scope; divergence is a discrepancy, not proof of
  undervaluation or a new arbitrage guarantee.
- An upper-price scenario requires three sale dates in a 20% price band, at least
  two transactions within 30 days, and a band median at least 10% above the full
  90-day captured median. A maximum or arbitrary percentile alone is inadequate.
  Show the band, counts, modeled net and whole-lot extra dollars.
- Recent sampled sale medians versus days 31–90 require five transactions and
  three days in each group. This is a transaction-sample shift, not total velocity.
- Treatment and play interest explain buyer audience; they do not establish a
  printing premium, scarcity, a catalyst, or future recovery on their own.

The $15 whole-lot effort comparison, seven-day capture window and signal margins
are reviewable analyst defaults, not owner-confirmed economic preferences.
One-copy orders use the existing fees/postage/materials assumptions. Dealer prices
exclude shared batch shipping and final grading. USD only.

## Persistence and reproduction

`node scripts/build-analysis-input.mjs` exports eligible database inputs and
pattern results to ignored `.local/analysis/`. Model-written narrative reviews
are separately authored against those lot IDs. `node scripts/save-ai-reviews.mjs`
validates complete coverage and identity/stock, stages immutable run/decision
records, and rolls back by default. `--apply` persists the review. Exact replay is
idempotent. Full input and narrative hashes, detector source hash, assumptions,
model-review provenance, and per-lot input snapshots accompany the run.

The canonical decision run uses prompt version `collection-ai-review-v1`; prior
buylist checkpoints remain intact. Saved narratives identify their checkpoint
and baseline costs; live scenario cards recalculate. New market evidence needs a
new model review, not silent editing of the existing review.
