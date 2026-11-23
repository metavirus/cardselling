# Card Spotter schema contracts

These contracts describe Card Spotter's local scanner and its version 1 batch
handoff. Card Sniper owns selling inventory and imports only when explicitly
authorized. Automatic acceptance is off.

## Batch review and handoff

The live scanner writes the same envelope shape to `review.json` on review and
`handoff.json` on completion. The files live alongside `session.json` in the
selected scanner session.

| Field | Type and meaning |
| --- | --- |
| `schema` | Integer literal `1` |
| `sessionId` | Numeric string identifying the source batch |
| `createdAt` | Unix timestamp in seconds |
| `automaticAcceptance` | Boolean literal `false` |
| `copies`, `keepers`, `leaveAside` | Totals by **physical quantity**, not row count. Keep includes `aside` and `good`. |
| `processing` | Count of outstanding checks or active pending retries |
| `questions` | Array of `{id, kind, question}` for outstanding review items |
| `rows` | Active staged card rows, including leave-asides |

Each row contains `id` (capture ID), `cardId` (stable ID within the session,
falling back to the capture ID), `name`, `printing` (set and collector
number), `scryfallId`, `finish`, `quantity`, `cue`, `category`, and
`needsReview`. The printing can be absent or null. The Scryfall ID can be
omitted if neither the operator nor a recognition pass supplied one. Collector
numbers are strings and can contain suffixes. Finish is recorded per capture.

`POST /batch/finish` writes the handoff only when `processing` is zero and
`questions` is empty. An empty queue does not guarantee every row has an exact
identity. Before importing approved keeper copies, check the exact printing and
finish, plus language and condition from the authorized intake. Keep
`(sessionId, cardId)` as source lineage. The same printing can occur in multiple
rows and a retry can change the capture ID without adding copies.

### Cue values

| Cue | Physical sorting |
| --- | --- |
| `aside` | Keep, including some protective holds |
| `good` | Keep, good find |
| `low` | Leave aside |
| `pending` | Await an answer or review |

`category` explains how the cue was reached. In particular, `hold` is a
protective Keep rather than a positive price finding.

## Capture records

`session.json` is a JSON array of capture attempts. New captures have a string
`id`, `cardId`, `quantity`, `finish`, and Unix-second `capturedAt`.
`printing`, `fastEvidence`, `market`, and `cue` describe the fast pass.
`proposal`, `combined`, `proposedMarket`, and `proposedCue` describe the
background pass. `sorting` is the derived physical route. `soundDelivery`
retains the original delivery receipt. Operator printing and sorting choices
have separate fields. Capture file references in `debugCapture` resolve locally.

A retry links to its original via `rescanOf` and inherits its `cardId`. While
`attemptState` is `pending`, only the original counts. A successful retry is
`selected` with `replaces`; the old row records `replacedBy` and `removedAt`.
A failed or undone retry is `rejected`. Active card totals exclude removed rows,
pending and rejected attempts, and `kind: "card_back"`. Quantity can exceed one
when the operator records identical extra copies.

## Selected-finish pricing evidence

`market.sortingDecision` and `proposedMarket.sortingDecision`, when present,
carry `schema: 1`, `complete`, `finishes`, and `outcomes`. Each outcome is
keyed by Scryfall `id` and `finish`. It contains `rarity`,
`selfsaleMinCents`, `priceCents`, `priceAt`, `fresh`, `ckKeeper`,
`conflict`, and `cue`. The route evaluates the selected finish. Missing cents
are null. A Leave aside cue requires covered, fresh, nonconflicting prices below
the applicable cutoff with no qualifying Card Kingdom bid. Mana Pool market
price and lowest stocked ask are distinct evidence fields.

Broad SQLite facts use an internal card ID plus finish, provider, and kind.
The card maps to its Scryfall ID, set code, and collector number. Card Kingdom
quotes and Mana Pool variant rows use Scryfall ID plus finish. All three stores
are scanner-local public market evidence, separate from Card Sniper stock.

Implementation references in the scanner workspace are
`scripts/scanner-batch-review.mjs`, `scripts/scanner_attempts.py`,
`scripts/scanner-live.py`, `scripts/scanner-economic.mjs`, and
`scripts/scanner-routing.mjs`.
