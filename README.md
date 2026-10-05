# Card Selling

A personal card-selling workspace using Next.js, React, TypeScript, Drizzle, and
local PostgreSQL. Desktop first, with a responsive mobile layout.

## Status

Current readiness: `docs/CURRENT_STATE.md` and `docs/data-readiness.json`.
The original starting-data audit is a historical checkpoint. Controlled Mana Pool,
MTGJSON and EDHREC evidence is ingested: see `docs/market-ingestion.md` for source
scope and limits.

The canonical database is adopted and verified locally: 723 inventory lots and
817 copies. Owner corrections are persisted: 720 lots are NM, three LP; five
SOA Japanese-only printings have accepted language and Scryfall mappings, with
distinct lots preserved. Prior exports/workbooks are historical evidence, not
operational inputs. Read `docs/canonical-store.md` and `docs/CURRENT_STATE.md`.
The first analyst-reviewed buylist proposal covers 20 exact lots / 29 copies at
$181 gross indicative cash from direct public Card Kingdom checks. It is pending
checkout, actual batch costs and owner execution; no stock or sale changed. See
`docs/buylist-first-pass.md`. Refresh collectors and product workflows remain to
be built.

## Local development

Requirements: Node 24, npm, and PostgreSQL 18 binaries. On this machine:

```powershell
$env:NODE_OPTIONS = '--use-system-ca'
npm.cmd ci
npm.cmd run db:setup
npm.cmd run db:migrate
npm.cmd run dev
```

Open http://127.0.0.1:3010. The database has its own cluster on 127.0.0.1:5440.
Setup generates credentials; repeat setup verifies the existing target.
Startup never initializes a replacement. Missing/partial state needs inspection.
The local page is an all-collection decision design preview. It reads canonical
inventory and evidence, compares dealer/self-sale amounts, and keeps working
plans and notes in this browser. See `docs/interface-design.md` for scope and
the distinction between browser drafts and canonical owner decisions.
Card thumbnails and larger click/tap views use exact-printing Scryfall art;
the images load from Scryfall while online.
The server-only `/api/health` endpoint reports readiness without connection details.

## Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start verified database and development app |
| `npm run check` | Migration safety tests, production build, TypeScript |
| `npm run db:status` | Verify pinned cluster and live database identity |
| `npm run db:check` | Verify app identity, rollback, and app-role privileges |
| `npm run db:canonical-status` | Read canonical stock and evidence counts |
| `npm run db:ingest-market` | Trial retained-capture ingestion; add `-- --apply` to persist |
| `npm run db:verify-market` | Verify exact provider mappings, evidence semantics and coverage |
| `npm run db:ingest-mtgjson` | Trial retained MTGJSON ingestion; add `-- --apply` to persist |
| `npm run db:ingest-edhrec` | Trial EDHREC rank extraction from retained MTGJSON identifiers |
| `npm run db:verify-mtgjson` | Verify dated price and rank evidence against exact source and variant identities |
| `npm run market:insights` | Produce a read-only research queue; no sell recommendations |
| `npm run db:ingest-ck-checks` | Trial targeted public CK page capture; `-- --apply` persists sourced observations |
| `npm run market:buylist-screen` | Regenerate read-only first-pass screen; output is not the pinned reviewed snapshot |
| `npm run market:export-buylist-review` | Export the stored analyst-reviewed decision run |
| `npm run db:verify-buylist-review` | Verify the pinned review and unchanged inventory |
| `npm run db:ingest-tcgsentry-current` | Trial fresh export hydration; source cannot change physical inventory |
| `npm run market:compare-buyers` | Read-only exact-lot CK/SCG basket comparison against the pinned reviewed screen |
| `npm run db:apply-owner-clarifications` | Replay the accepted, idempotent owner corrections |
| `npm run db:verify-canonical` | Verify canonical invariants with rolled-back test writes |
| `npm run db:adopt-canonical` | One-time accepted baseline adoption; repeat is a no-op |
| `npm run db:ingest` / `db:verify-ingestion` | Historical bootstrap only; blocked after canonical adoption |
| `npm run db:generate` | Generate legacy Drizzle changes; canonical tables use reviewed custom SQL |
| `npm run db:migrate` | Apply reviewed SQL atomically with a checksum ledger |
| `npm run db:backup` | Save a custom-format PostgreSQL backup |
| `npm run db:verify-backup -- <path>` | Restore into an isolated temporary database |
| `npm run db:stop` | Stop only the cardselling cluster |
| `npm run build` | Build the app without database access |
| `npm start` | Run the production build locally |

Migrations are sorted SQL files in migrations/. Review generated SQL and add
required initialization before applying it. Never edit applied SQL or use
drizzle push. The runner refuses changed, missing, or reordered history; repeated
runs are no-ops. Noninitial migration batches take a backup before applying.

## Storage and recovery

- Cluster: C:/Users/kavig/Documents/Codex/cardselling-local/postgres.
- Administrator credentials: sibling admin.json outside the repository.
- Backups: sibling backups/ directory outside the repository.
- Local target identity: ignored .local/database.json.
- App credentials: ignored .env.local, generated by setup.
- Private exports: ignored data/private/ when intake begins.

Keep the live cluster out of cloud-sync directories. Backups here are plaintext
on this computer: protection against migration mistakes, not computer loss.
Arrange an independent backup before relying on irreplaceable data. Do not copy
or synchronize a running PostgreSQL directory as a backup.

Backup verification creates a fresh cardselling_restore_* database, restores the
dump, verifies the application marker, migration ledger, and full contents of
every public table against the live database, then removes only that temporary
database. Use a fresh backup with writes paused for this comparison. For actual recovery, stop app activity,
preserve existing data, restore the chosen backup to a separate target, reconcile
contents/history, and explicitly update the pinned configuration. Never blindly
restore over the canonical database or use setup as a recovery command.

No Docker, hosting, public access, auth service, scraping pipeline, or offline
write system is needed for this foundation. Phone access needs a deliberate next
step; the app currently listens on loopback only.

## Source ingestion

The default intake is `data/private/intake/2026-10-04/handoff`. An alternate
handoff directory may be passed to `db:ingest` after `--`; it must remain inside
ignored `data/private/`. File digests and declared totals are checked before
writes. The historical workbook reader uses bundled Python/openpyxl; set
`CARDSELLING_PYTHON` to another compatible interpreter if needed.

Sell.csv defines the current sale tranche. Scryfall identifies printing; finish,
language, and condition distinguish holdings. Scan reference price is not cost
basis. Historical ManaBox rows remain background evidence, not additional stock.
TCGSentry and research observations retain raw rows, provenance, dates, and
conflicts. Repeated normalized dealer evidence links to its original observation.
Unknown remains distinct from zero; dealer capacity is separate from price.

Prior recommendations and manual judgments are review-required checkpoints.
Modeled Mana Pool proceeds remain source estimates. The separate order-economics
calculator requires actual cost inputs before estimating net. PDF, screenshots,
and the final workbook are
registered source artifacts; their contents are not separately parsed into market
facts. The final CSV carries the corresponding interpretation checkpoint.

Private verification receipts are in `.local/import/`. Original sources, receipts,
credentials, and database backups stay out of Git. No recommendation recalculation,
scraping, or sale execution is performed by ingestion.

## Planning the first version

Use the imported evidence and retained handoff to determine:

- Exact card/holding identity, quantities, and reconciliation boundaries.
- The first useful inventory and selling workflow.
- Verified selling economics, assumptions, and recommendation rules.
- Desktop and mobile tasks, and any required integrations.

Read `docs/product-plan.md` for the reanalysis baseline and linked assumption/data
contracts. Confirmed preferences and proposed policy choices are labeled separately.
The canonical database now replaces snapshot-driven operations. Read
`docs/canonical-store.md`; use `npm run db:canonical-status` and
`npm run db:verify-canonical`. The old reanalysis and handoff importer refuse to
run after cutover. Prior files/results remain historical evidence only.

## Development

Market research: `docs/market-source-survey.md` summarizes the October 4 survey,
`docs/market-source-registry.json` records source semantics and access, and
`docs/synthesis-design.md` proposes the evidence and recommendation workflow.
These are research/design artifacts. Controlled one-time evidence ingesters exist;
automated refresh collectors and product views are not implemented.

Clone the repository:

```sh
git clone https://github.com/metavirus/cardselling.git
cd cardselling
```

Use coherent Git checkpoints and `codex/` names when creating development
branches. Work locally through ordinary iterations; hosting is not configured.

Keep credentials and local environment files out of Git. An `.env.example` file may contain placeholder values when configuration is needed.
