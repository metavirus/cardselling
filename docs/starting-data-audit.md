# Starting data audit — October 4, 2026

**Verdict: the inventory foundation is sound. The market evidence layer is not
yet ready for trustworthy monetary recommendations.** Useful original data is
preserved, but it would be inaccurate to say that all of it is already normalized
and available to the new engine. This audit made no database changes and did not
refresh any external prices.

## What was independently verified

| Check | Result |
|---|---|
| Original handoff ZIP | All 16 members retained byte-for-byte; archive CRC check passed |
| Retained file hashes | All 16 registered files match database hashes/sizes and applicable manifest declarations |
| Structured import | All 27,017 stored source rows compared to original CSVs and a fresh extraction of the historical workbook |
| Catalog import | Every one of 118,406 Scryfall objects compared structurally with the original compressed source; no differences |
| Canonical inventory | All 723 lots / 817 copies compared field-by-field with original ManaBox rows; no unexplained differences |
| Catalog identity | All 723 scan rows match catalog set, collector number and supported finish |
| Owner corrections | Nonfoil Psychic Frog #433, Japanese Gigantosaurus and Japanese SOA rows preserved; eight known Phyrexian treatments normalized with retained raw values |
| Workbook detail | 37,515 cells across whole-inventory, subset, priority and reconciliation sheets match the retained CSV values; set casing/collector leading zeros normalized for comparison |
| Workbook arithmetic | All 14 disposition summary groups reconcile to their detail rows using the historical calculation convention |
| Research links | All 3,718 research rows accounted for through typed observations and provenance links; no lost research rows |
| Interpretations | 723 historical dispositions plus 61 manual research interpretations retained |
| Read-only execution | Database transaction explicitly read-only; full content fingerprints unchanged within the audit snapshot |

The 32 database checks passed. The workbook is a static historical artifact: no
formulas were found on its 10 sheets. Its subsets overlap and are not extra stock.
The historical collection's 20,999 rows / 37,971 copies remain background only.

## Preservation is different from readiness

| Material | Preserved where | Ready for current engine? |
|---|---|---|
| Accepted ManaBox holdings | Canonical variants/lots/assertions/opening events, plus original raw rows | Yes for inventory |
| Scan metadata, reference price, flags and added timestamp | Original raw rows and legacy holdings reachable from each canonical origin | Preserved; not all exposed by the flat canonical inventory view |
| Scryfall identities, oracle IDs, rarity, colors, legalities and historical price fields | Full retained catalog JSON objects | Useful for targeted hydration; historic prices are not current quotes |
| Original dealer/research observations | 3,718 archived typed observations and original rows | Historical only; not automatically eligible |
| Workbook classifications/timing | 784 archived interpretations and detailed source rows | Historical reasoning, not new decisions or sales |
| Newer 12:43 TCGSentry export | Private retained CSV | Not registered in DB; retire as evidence, not a master or required live dependency |
| Mana Pool public catalog and inventory probe | Private retained gzip/JSON files | Not ingested into canonical captures/observations yet |
| Memo, source notes, PDF and screenshots | Hash-verified original artifacts; prior text review retained | Context/evidence, not fully structured facts |

There are currently **zero canonical captures, observations, eligible evidence,
quotes, decisions and transactions**. That prevents old spreadsheet guesses from
masquerading as fresh facts, but also means there is no operational recommendation
dataset yet. Twenty-seven policy records preserve baseline assumptions and the
inventory-authority rule, with proposed assumptions kept distinct.

The research count should not be confused with independent market coverage:
3,563 rows repeat the TCGSentry export, 154 are other research assertions, and one
is a Card Kingdom sell-cart screenshot assertion. Repeated dealer assertions are
linked, not counted as separate markets. Of 61 manual interpretations, 60 have
partial identity links and one is unmatched; these remain historical. The source
memo identifies the incompatible foil Psychic Frog research as a known exception.

## Problems and gaps that matter

### 1. Useful newer market data is staged, not imported

The public Mana Pool catalog, its 723-row probe and the later TCGSentry export
are not entries in the database's source registry. Their files exist and were
hashed in this audit. They need durable capture provenance and careful extraction
before the new engine consumes them. This is unfinished integration, not missing
physical stock or a reason to continue using spreadsheet outputs as authority.

The old Mana Pool probe matched the original language column. Therefore its 707
variant candidates, 699 sale-covered rows and 436 capped samples are historical
probe results, not coverage of the canonical normalized language model. Rebuild
the match against canonical variants before quoting new coverage. Use the retained
catalog; another large download is not necessary merely to correct this join.

### 2. Six provider mappings remain incomplete

These are Scryfall object/language mappings, not requests to rescan cards:

| Canonical holding | External mapping issue |
|---|---|
| Bring to Light SOA #126, English row | Referenced catalog object is Japanese |
| Daze SOA #80, English row | Same |
| Prismatic Ending SOA #72, English row | Same |
| Crop Rotation SOA #116, English row | Same |
| Triumph of the Hordes SOA #124, English row | Same |
| Gigantosaurus M19 #185, confirmed Japanese | Referenced default-catalog object is English |

717 Scryfall mappings are accepted; six are candidates. This does not mean 717
dealer price mappings are ready: no marketplace/dealer mappings have yet been
promoted into the canonical evidence pipeline. Preserve every inventory row and
quantity while resolving these joins. The owner has already settled the physical
authority and Japanese-card explanation.

### 3. Three raw grades need channel-specific handling

Words of Wind ONS #122 and Words of Wilding ONS #305 are `good`; Pride Sovereign
HOU #126 is `excellent`. Those source conditions are preserved. Their normalized
grades are null. NM is not a permissible fallback. This is a vocabulary/pricing
scope issue unless later physical grading supplies a correction.

### 4. Historical summaries are arithmetically consistent but not decision-ready

The workbook aggregates seven missing dealer values and 22 missing modeled-net
values as zero contributions. Its foreign-language and Psychic Frog categories
therefore display zero totals even though that does not mean the cards are worth
zero. A future output must report missing coverage alongside any subtotal.

Other known defects remain quarantined: 64 historical recommendations selected
CK as best store while wanted quantity was zero; 127 original dealer rows had
zero CK demand; SCG capacity was absent; modeled Mana Pool net omitted fixed and
shipping costs; and the reference-value fallback mixes market/history/scan prices.
“49/61 velocity/trend/supply coverage” is not 49 measured sale rates. Actual-sale
samples, listing counts, price movement and deck adoption must stay distinct.

The buyer-side Mana Pool PDF is retained, but its substituted products and buyer
fees do not make it an exact seller-net price source. Existing screenshot evidence
is historical; a sell-cart estimate is not a completed transaction. No stock has
been marked sold and no realized proceeds have been invented.

### 5. Operational context is preserved but not fully structured

All lot locations are null. The source scan does not contain shelf/bin locations.
The memo retains general binder/drawer/color arrangements and historical sleeve
price bands, plus preferences for a three-pocket envelope, Pirate Ship, existing
equipment and packaging. Those statements need source-labelled operational
context if used; they must not be converted into guessed per-card locations or
current values. This is not a blocker for market research, but matters for picking
and fulfillment.

All Misprint/Altered/Signed/Proxy flags in the sale scan are false. They are retained
in raw provenance rather than silently discarded. One scan reference price is
missing: Domri Rade Emblem TRVR #20 foil. Keep it null; neither identity nor quantity
is missing, and scan price is not acquisition cost.

### 6. Recovery and source time need explicit boundaries

Database backups contain the imported rows/catalog and canonical tables, not every
filesystem-only source byte. The original ZIP and research files remain on disk;
their capture manifests/raw bytes must be included in recovery planning. The newer
research files' lack of registration is especially worth resolving before use.

The workbook labels its dealer snapshot PT, while the filename itself does not
encode timezone. Preserve those separate source claims rather than inventing an
instant from the filename. The Mana Pool probe's `captured_at` is processing
completion time, not the publication time of every sale. Preserve event time,
capture time and unknown sample completeness separately.

## Readiness decision

**Proceed:** inventory inspection and controlled evidence normalization. The
accepted inventory and retained originals pass the checks; no owner rescan is
required by this audit.

**Do not yet rely on:** automatic sell/hold recommendations, a collection cash-out
total, complete velocity claims, or execution-ready dealer offers. Their active
evidence dataset has not been built.

Before recommendation work, register the staged captures, rematch them against
canonical variants, resolve provider-specific mappings/grades where relevant,
and populate timestamped evidence with explicit coverage and sampling semantics.
Carry forward useful factual context; leave old scores, decisions and stale quotes
historical. No UI or selling workflow should obscure that readiness boundary.

Machine-readable findings: `data-readiness.json`. Reproducible audit scripts:
`audit-starting-data.mjs` and `audit-workbook-sources.py`; private receipts and
source comparisons are under `.local/starting-data-audit/`.
