# Current state

As of: 2026-10-04

## Later identity clarifications

See `identity-clarifications.md`: owner confirms Japanese SOA rows are intentional
Japanese cards from English packs, and Gigantosaurus M19 #185 is Japanese.
The eight Phyrexian-treatment rows were overflagged as physical uncertainty.
Preserve raw scan values and separate holdings; remaining product mapping is
distinct from physical-language confirmation. Earlier literal-match counts and
baseline script flags have not been recomputed or applied as database corrections.

## Market-source research checkpoint

- Owner targets MagicCon Atlanta in November; organizer dates November 13–15, 2026.
- Broad 56-entry source registry and survey: `market-source-registry.json` and
  `market-source-survey.md`. Verification levels distinguish tested data from claims.
- Proposed demand dimensions, lineage, sample limits and event quote workflow:
  `synthesis-design.md`. No implementation or migration.
- Read-only Mana Pool catalog probe: 723 ID candidates, 707 variant candidates,
  699 with sale records, 436 at a 20-record sample cap. Candidate identity is not
  accepted physical reconciliation. Private raw catalog and probe retained under
  `.local/source-survey/`; no private inventory or source bulk added to Git.
- No product UI, subscriptions, vendor contact, appointments or sales added.

## Accepted direction

- Personal card-selling workspace, desktop first and mobile capable.
- Local PostgreSQL initially; hosted web access later.
- Methodical correctness and practical safeguards, without enterprise ceremony.
- Next.js/React/TypeScript and Drizzle foundation authorized for setup.

## Foundation scope

Separate loopback database, development commands, versioned SQL migrations,
checksum ledger, backup/restore check, server-only database connection, health
endpoint, and plain development status page. The first source handoff is now
imported. Product views and a new recommendation model have not been implemented.

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
- A styled placeholder exceeded environment setup scope and was removed after
  the owner's correction. Only a plain development status page remains. Product
  interface design, branding, navigation, and workflows have not been selected.
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

## Source handoff ingested

The original bundle and Scryfall bulk file are retained in ignored private intake.
Manifest hashes, structured source rows, sale quantities, observations, and printing
identities were verified against the database. Sell.csv alone defines current
inventory; the historical workbook remains background. All bulk reference records
are retained. Raw evidence, typed observations, and historical interpretations are
separate. Repeated dealer evidence is deduplicated through provenance links.

Reimport was checked using full content fingerprints of every public table and
made no changes. The private receipt records totals and unresolved reconciliation
issues. Historical recommendations require reassessment, including choices that
selected a Card Kingdom bid with zero buying capacity. Dealer quantity differences,
foreign/finish mismatches, and missing exact dealer matches remain explicit.

A fresh post-import backup was restored into an isolated temporary database;
every public table's row count and full content fingerprint matched the live
database. Ten migration/import tests, production build, and TypeScript passed.

An initial finish validator incorrectly compared ManaBox normal with Scryfall
nonfoil. The validator and regression test were corrected; false issue records
retain their original audit history with an explicit resolution. Holdings were
unchanged. The prior chat's schema proposals, categories, and five-view navigation
are not frozen requirements. PDF/screenshots remain source artifacts; no new facts
were inferred from them during ingestion.

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

The adversarial reanalysis is captured in docs/product-plan.md, assumptions.json,
sources.json, data-model.json and decision.schema.json. These are a proposed
normalized contract, not an applied migration. The current owner confirms patient
timing and an effort ceiling, with worthwhile net cash preferred to penny chasing.

A fresh full TCGSentry export is retained under data/private/reanalysis/2026-10-04.
The read-only scripts/reanalyze.mjs compares every canonical holding against it
and emits private analytical tasks and sensitivity results in .local/reanalysis.
Fresh export data has not been added to canonical tables or adopted as stock.
Prior recommendations are preserved; no new sale instruction has been accepted.

Live source review clarified the percentage-only marketplace estimate and omitted
order costs, documented quote/grading distinctions, and challenged historical
holding claims. The initial identity check validated catalog set/number/finish,
not physical language. Language/treatment, order economics and shared capacity
are explicit gates in the proposed contract.

Next implement the reviewed lot/provenance/reconciliation contract, then order
economics and structured judgment, and measure a small real-world pilot before
expanding fulfillment or designing product views. Detailed private findings and
the user-facing report remain outside Git.
