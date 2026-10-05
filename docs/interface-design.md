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

A card detail panel keeps source figures, evidence limits, analyst reasoning,
counterarguments and owner notes next to the comparison. Bulk selection can
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

Desktop uses the table and a side detail panel. Narrow layouts stack the detail
panel below a horizontally scrollable comparison table; inspecting a card moves
to its details. Keep numeric columns comparable rather than hiding them on phones.

Verified at desktop 1440x1000 and mobile 390x844: all 723 lots / 817 copies are accessible; filters, search, draft persistence, and editable estimates work. The 20-proposal selection reconciles to 29 copies, 181.00 dollars in CK bids and 132.37 dollars in modeled self-sale net. Raising postage by 0.50 dollars reduces that net by 14.50 dollars. Production build and TypeScript checks pass.
