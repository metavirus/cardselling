# Identity clarifications — October 4, 2026

These later clarifications supersede the physical-language uncertainty wording
in the earlier reanalysis and source survey. Historical probe counts describe
literal export matching, not current counts of unidentified cards.

## Phyrexian treatments

ONE 283, 326, 365–369 and 429 identify the Phyrexian-script printings discussed
with the owner. Eight inventory rows were overflagged because their export says
English while the catalog says Phyrexian. Treat these as printing-specific
language normalization, not a request to inspect the physical cards merely
because those fields differ. Preserve raw export values and exact treatments.

## Owner confirmation: Japanese cards

The owner explains that the SOA Japanese cards came in English Secrets of
Strixhaven packs and were scanned as Japanese. Pack language is not printed-card
language. The existing Japanese SOA rows are intentional; their language alone
does not require another owner confirmation.

The owner explicitly confirms Gigantosaurus M19 #185 is Japanese. The English
default catalog reference does not override that physical-language confirmation.

This statement does not authorize merging English and Japanese SOA holdings or
changing their quantities. Preserve separate rows. Resolve catalog/product IDs
using printed language and treatment; English-labelled rows linked to Japanese
catalog records still need source mapping reconciliation. Do not infer that
every SOA copy is Japanese from an explanation about the Japanese copies.

## Implementation status

Recorded as accepted owner context, not yet applied as a database correction.
The frozen baseline script `scripts/reanalyze.mjs` still uses literal language
comparison and flags all non-English holdings for acceptance. Its historical
flags must not be presented as current unresolved physical questions. A future
normalization pass must consume these clarifications and distinguish source-ID
mapping from physical identity and dealer acceptance.
