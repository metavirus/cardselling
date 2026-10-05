# Collection decision workspace

The owner requested a basic interface for deciding what to do with **all cards**.
Buylist selection is one view within that broader workflow. This local prototype
uses current canonical holdings and retained evidence, not placeholder card data.

The primary surface is a compact comparison table. Every row includes exact
printing, finish, grade and quantity; CK and SCG bid indications; working
self-sale price and net; whole-lot incremental self-sale dollars; and the owner's
working direction. Search, sorting and paging apply to the complete inventory.
Unknown values stay absent. A CK numeric bid with zero wanted quantity is visible
as unavailable rather than usable proceeds. SCG capacity remains unknown.

Working directions are Undecided, Buylist, Sell myself, MagicCon and Hold.
Owner draft directions are separate from stored analyst proposals. Only the
existing reviewed decisions have a suggested channel; the rest remain unassessed.
No numerical screen silently classifies the whole collection. Hold notes prompt
for a thesis/review trigger; event notes prompt for convention buyer questions.

A card detail dialog opens from the card name and keeps source figures, evidence
limits, analyst reasoning, counterarguments and owner notes available on demand. Bulk selection can
assign a direction. The selection tray reports subtotal coverage explicitly;
missing prices do not become zero-dollar bids. Whole-lot plans are the initial
interaction; splitting physical quantities across channels is a later workflow.

Self-sale assumptions are editable: current asking price or sampled sale median,
letter/tracked postage, materials, and dealer batch shipment cost. Published fee
estimates remain explicit. The default shipment allowances are illustrations,
not measured costs; one-copy orders differ from combined orders. Labor, returns,
losses and possible high-value fee rebates are not silently estimated.

This is a design preview. Plans, notes and assumptions persist in local browser
storage and can be exported as JSON; they are not canonical owner choices and
do not reserve or sell stock. Database-backed draft persistence, multi-device
sync, split quantities, chart histories, richer demand signals and event quotes
remain implementation work. The local SQL database supplies inventory and
evidence through a server-only reader. No remote deployment is authorized.

Desktop uses the full-width table with no initially selected card or persistent
detail pane. Card details open in a native modal dialog with Escape, close-button,
and backdrop dismissal. Native modal focus handling returns to the trigger.
Narrow layouts use the same dialog with a scrollable interior. Keep numeric
columns comparable rather than hiding them on phones.

The owner requested inspiration from TCGSentry's live collection UI. Inspected
its list, sell-signal popover and card-grid view in the signed-in Chrome tab.
Adopted compact summary/rows, direct key-column sorting and inline plan selectors.
The useful general pattern is to expose explanations on demand while keeping
the collection comparison prominent. The card-grid toggle is a potential later
addition; its presence in TCGSentry is not a requirement to copy its scoring.
Verified the dialog at desktop and 390px width, Escape/close dismissal, direct
sorting, and nested artwork enlargement. Existing plan storage is preserved.

The comparison table now shows a card thumbnail and the detail panel shows a
larger image. Hovering a thumbnail previews the card on pointer devices;
clicking or tapping opens a larger image with face navigation when the printing
has multiple pictured faces. Image URLs come from the retained Scryfall bulk
reference joined by accepted printing ID; one accepted printing absent from that
bulk snapshot uses Scryfall's exact-ID image endpoint. Artwork requires an
internet connection and describes the printing, not the condition of the
owner's individual physical copy. The app does not store image binaries.

Image interaction was checked at desktop and 390px mobile widths: thumbnails
load, the enlarged image opens and closes, and a two-faced card switches faces.

Each card's detail panel also presents read-only selling signals: Scryfall
printing traits and type, bounded Mana Pool exact-product sale records in
30-/90-day windows anchored to the latest evidence capture per lot, same-grade listed supply,
and Scryfall-transmitted EDHREC rank when present. It offers separately labeled
channel research leads, with source limitations shown nearby. These leads do
not assign owner plans or change stored analyst proposals. The experimental
effort thresholds and collection-wide coverage are documented in
`semantic-signal-audit.md`.

The October 4 substantive redesign supersedes that signals-first layout. Card
details now lead with a next-move prompt and side-by-side dealer/self-sale
proceeds. The view adds asking-price versus sale-median scenarios, an itemized
net receipt, real retained price-history lines and sale dots with range/series
controls, and immediate working-plan buttons. Long methodological caveats live
under Sources & calculation details. See `card-decision-audit.md` for the live
TCGSentry comparison, adopted patterns, data coverage and remaining workflows.

Verified at desktop 1440x1000 and mobile 390x844: all 723 lots / 817 copies are accessible; filters, search, draft persistence, and editable estimates work. The 20-proposal selection reconciles to 29 copies, 181.00 dollars in CK bids and 132.37 dollars in modeled self-sale net. Raising postage by 0.50 dollars reduces that net by 14.50 dollars. Production build and TypeScript checks pass.
