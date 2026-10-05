# Durable owner workspace

Migration0004 makes SQL authoritative for owner plans, notes, cost settings and
workspace preferences. Directions append to `canonical_owner_choices`; a later
choice supersedes its predecessor without modifying earlier history. Choosing
Buylist does not record a sale or reduce stock.

`canonical_workspace_state` stores current economics and filters/selections, with
a revision counter. `canonical_workspace_requests` preserves original request
payloads and receipts immutably. Saves lock the workspace head in a transaction;
stale revisions return409 instead of replacing newer choices. The conflicting
payload remains in the database for reconciliation. Repeated request IDs are
idempotent; reusing an ID with different changes is rejected.

GET `/api/workspace` returns revision, drafts, settings, preferences and shipping
model version. POST supports granular patch or legacy browser import. Import
fills missing choices/settings, gives existing SQL values priority and retains
the full browser payload plus conflict IDs. Browser data should be removed only
after a successful import receipt. An unavailable database must show unsaved
status and retain pending edits; it is never replaced with an empty workspace.

The schema was backed up and verified by restoring into an isolated temporary
database before migration. Contract tests cover invalid identifiers, directions,
cost units and migration of known stale shipping defaults. Initial live API
smoke checks verified GET, repeat-request idempotency and stale revision409
without creating owner choices. Smoke-test initialization of default settings
was cleared so a subsequent browser import can preserve the owner's settings.

Existing browser choices still require the owning browser to load the new
interface. Automated browser access was denied by policy during this pass; no
claim is made that those legacy choices have already transferred to SQL.
