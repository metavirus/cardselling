# Daily pricing hydration

Run `npm run data:refresh` from the repository. See `canonical-store.md` for
the maintained source contract, automatic ingestion, retries and replay checks.
The active Codex heartbeat runs every day at 8 AM America/Los_Angeles.
The local computer must be awake and Codex running.

Valid public-source updates apply directly to canonical market evidence. A
failed source retains its last good data and timestamps while other sources
continue. The command never changes inventory, owner choices or transactions.
TCGSentry current dealer quotes require its authenticated browser CSV export;
use the validated hash/timestamp manifest and `--dealer-manifest=PATH` to apply
that lane. Public history is not an executable quote or buying capacity.

The footer reports the latest successful pricing capture, with individual source
dates under Source freshness. Replaying identical feeds preserves original
capture dates. Provider publication dates and dated historical points remain
distinct from download times. The open interface refreshes on focus and every
five minutes while visible without resetting plans or scroll position.

October 5 checkpoint: current TCGSentry hydration applied 700 CK quotes and
695 SCG quotes. Mana Pool applied 28,883 observations with exact owner-grade
coverage for 757 of 758 lots. MTGJSON applied 245,249 USD historical observations
through October 5: CK buylist 731 lots, CK retail 737, TCGplayer 744, Mana Pool
757. Inventory remains 758 lots / 853 copies. Source coverage is not universal.

The broad buylist screen uses meaningful decision badges: green check for
buylist advantage, neutral batch for a small convenience tradeoff, amber warning
for newer prices that deserve inspection, blue upward arrow for supported
self-sale upside. Dollars refer to the whole lot under the owner's shipping
settings. Repeated higher recent sales can challenge an older median; asking
prices trigger review rather than becoming completed-sale evidence.

The app reads the latest eligible Mana Pool capture for each exact owned grade,
including empty sales/offer samples. It does not revive older asks when the
newest capture has no offer. Evidence scopes are materialized before alias joins
to prevent repeated source captures from multiplying collection queries.
