# Current state

As of: 2026-10-04

## Accepted direction

- Personal card-selling workspace, desktop first and mobile capable.
- Local PostgreSQL initially; hosted web access later.
- Methodical correctness and practical safeguards, without enterprise ceremony.
- Next.js/React/TypeScript and Drizzle foundation authorized for setup.

## Foundation scope

Separate loopback database, development commands, versioned SQL migrations,
checksum ledger, backup/restore check, server-only database connection, health
endpoint, and responsive empty page. Application identity is the only domain
record. Inventory and recommendation work has not begun.

## Verified foundation

- Node 24, pinned Next.js 16.3.8, React, TypeScript, Drizzle, PostgreSQL 18.4.
- Dedicated cluster on 127.0.0.1:5440; no other app database or service changed.
- Initial migration applied; repeated setup and migration leave state unchanged.
- Cluster stop/restart, live identity, application identity, transaction rollback,
  and non-administrator app-role checks passed.
- Backup restored into a disposable isolated database; marker and ledger verified.
- Four migration-history safety tests, production build, and TypeScript passed.
- npm audit after refreshed dependency resolution reports zero vulnerabilities.
- /api/health returned application=cardselling and database=ready.
- Empty page inspected at desktop and 390px phone widths; phone scroll width
  equals viewport width. This verifies the scaffold, not a final product design.
- Development app runs locally at http://127.0.0.1:3010. No hosting or physical
  phone connection is configured. Git checkpoint is separate from deployment.

## Environment corrections

Package downloads use Node's system CA store; TLS verification stays enabled.
Initial PostgreSQL bootstrap required the outside-sandbox execution lane and was
resumed from the admin-only state after confirming no cluster existed. For
startup, probe the pinned live connection first instead of relying on pg_ctl
process inspection. Only connection refusal permits starting the existing
cluster; credential/identity failures are surfaced. PostgreSQL child commands
have finite timeouts. Use the host lane when a stopped cluster must be started.

## Waiting for source handoff

The final exploration workbook was inspected read-only for structure. Original
Sell.csv/ManaBox and TCGSentry exports, calculation rules, evidence observations,
corrections, and open questions are being prepared in the selling chat.
No sale inventory has been imported. No source totals or recommendations have
been independently verified. The prior chat's proposed schema, categories, and
five-view navigation are not frozen requirements.

## Import acceptance requirements

- Separate source rows, exact variants, and physical copies.
- Preserve finish, language, condition, and collector-number variants.
- Missing prices remain unknown; valid zero remains distinct.
- Preserve observations, dates, conflicts, and owner corrections.
- Reimport is safe and does not duplicate stock or erase decisions.
- Reconcile excluded, corrected, duplicated, and unmatched rows.
- Compare calculations against representative workbook examples. Expose manual
  judgment and omitted costs rather than inventing reproducible formulas.
- Historical scan value supports storage location; current value supports sale
  decisions. Preserve location overrides and the physical workflow.

## Next step

Inspect the original exports and handoff, define a bounded first import, then
design the inventory schema and verify reconciliation before product views.
