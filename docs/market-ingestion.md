# Market ingestion and research — 2026-10-04

The canonical store now contains the first normalized market capture. Inventory
remains exactly **723 lots / 817 copies**. No physical fields, owner choices or
stock events changed. No UI, listings, vendor messages or sales were created.

## What was imported

- Retained Mana Pool catalog: 106,515 parent objects in the original hashed gzip;
  667 full parent objects relevant to inventory are additionally registered as
  queryable source records. All original variants remain in those raw records.
- **718/723** canonical printing/finish/language combinations match. Across five
  provider grades: **3,590 product mappings**, **22,089 sale-sample records**,
  **1,894 asking-price observations**, and **3,590 offered-quantity observations**.
- Six newly registered artifacts include the catalog, API schema, Japanese
  Scryfall response, two sourced-research files, and later TCGSentry export.
  All 718 rows of that export are retained and explicitly retired from current use.
- Ten sourced findings are stored as provider facts, separate from owner choices.
  Earlier probe files remain superseded diagnostic artifacts, not live inputs.

| Provider grade | Products with sale samples | Sample records | At the 20-record cap | Products with asks |
|---|---:|---:|---:|---:|
| NM | 710 | 11,336 | 442 | 716 |
| LP | 694 | 9,177 | 283 | 707 |
| MP | 365 | 1,321 | 19 | 382 |
| HP | 63 | 135 | 0 | 46 |
| DMG | 90 | 120 | 0 | 43 |

Each grade has 718 mapped products. These are comparison scenarios, **not five
versions of owned inventory**. They must not be added together as portfolio value.

## Findings that change our assumptions

**Grade translation is a real integration hazard.** Mana Pool documents its
ManaBox import translation as mint→NM, near_mint→LP, excellent/good→MP,
light_played/played→HP, poor→DMG. This supersedes the initial research impression
that no mapping existed. The three good/excellent rows now have an evidenced MP
import scenario, but this does not establish their physical grade. Likewise, the
720 near_mint inventory rows must not silently become LP holdings. Keep original
condition, provider import convention and eventual listing grade separate.
[Official conversion](https://support.manapool.com/hc/en-us/articles/26131255560855-CSV-Inventory-Export-ManaBox-Format),
[grading guidelines](https://support.manapool.com/hc/en-us/articles/37104256330391-Card-Grading-Guidelines).

**ManaBox prices are broad references.** Its documentation says language,
condition and location are not incorporated into its displayed prices. Physical
inventory authority does not make those prices exact-card valuation evidence.
[ManaBox pricing](https://www.manabox.app/guides/general/prices-in-the-app/).

**Identity progress:** Japanese Gigantosaurus M19 #185 now maps to Scryfall
`c7f7445d-0412-4aeb-b4a7-376b430e075b`, superseding the earlier English enrichment
candidate. Its Japanese Mana Pool NM product has an ask but no sale sample.
All eight Phyrexian variants match explicit PH catalog products.
[Scryfall response](https://api.scryfall.com/cards/m19/185/ja).

**Five SOA conflicts remain:** English-labelled Daze #80, Crop Rotation #116,
Prismatic Ending #72, Triumph of the Hordes #124 and Bring to Light #126 have
Japanese-only corresponding catalog variants. Wizards confirms those Japanese
treatments appear in Collector Boosters of all languages. Preserve the accepted
rows and withhold incompatible matches; this is not a renewed rescan request.
[Wizards product guide](https://magic.wizards.com/en/news/feature/collecting-secrets-of-strixhaven).

**Download freshness is not observation freshness.** Download completion was
October 4 at 20:07:55 UTC; latest sampled sale is October 2 at 11:10:23 UTC.
There are 257 sample records older than one year, reaching back to August 2024.
Those dates do not prove the absence of more recent market activity. Provider
publication time is unknown. Each sample is at most 20 records, with no stable
sale identifier or completeness guarantee. Repeated captures cannot be summed
as unique sales; the adapter stores reported cents and quantity separately,
without assuming sale price means a unit price or settled seller proceeds.
[Mana Pool API](https://manapool.com/api/docs/v1).

**Dealer eligibility and desirability need their own evidence.** Card Kingdom's
general policy restricts ordinary buylist submissions to English cards; non-English
items use a buyer-approved channel. Special Phyrexian treatments need exact
product evidence or an explicit exception, rather than a blanket assumption.
[Card Kingdom policy](https://cardkingdom.freshdesk.com/support/solutions/articles/3000037537-do-you-buy-non-english-language-cards-complete-sets-sealed-products-magic-memorabilia-or-any-othe).
EDHREC measures deck inclusion with eligibility/filter-dependent denominators,
not purchases of premium printings. Treat it as a distinct gameplay-interest
signal, not sales velocity. [EDHREC FAQ](https://edhrec.com/faq).

## Remaining boundaries

The store supports source-backed research and grade comparisons. It does not yet
support confident channel recommendations: current executable dealer quotes,
grade acceptance, order-level net costs, broader history and popularity captures
remain to be integrated. The eligible-evidence view deliberately includes all
comparison grades and retained captures; it is not a current lot-price view.
Future consumers must select a specific capture and justified provider grade.
No historical dealer export has been promoted into a fresh bid.

## Reproduction and verification

`prepare-market-evidence.mjs` reads canonical inventory and preserves the retained
source files; `extract-manapool-evidence.py` streams the catalog and records
source/scope/extract hashes. `ingest-market-evidence.mjs` defaults to a rolled-back
trial; `--apply` persists atomically. Run `verify-market-evidence.mjs` afterwards.
The script is a controlled first-capture adapter, not a scheduled refresh service.

Replay verifies supplied immutable fields and full database content fingerprints.
The successful replay made no database changes. Thirteen adapter/unit and existing
unit tests, 13 market database checks, 20 canonical invariant checks and TypeScript
validation passed. The pre-ingestion backup was restored and compared in isolation.
The final database backup and source recovery bundle are verified separately; see
the accompanying recovery receipt. Private source bytes stay out of Git.
