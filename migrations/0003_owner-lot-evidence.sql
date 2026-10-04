-- Map a lot to observations for its owner-normalized condition and exact
-- provider product. Two physical lots can share a printing/product without
-- duplicating source sale observations in the evidence store.
CREATE VIEW canonical_lot_market_evidence AS
 SELECT i.lot_id,i.origin_record_id,i.name,i.set_code,i.collector_number,
        i.finish,i.printed_language,i.condition_raw,i.condition_normalized,
        i.available_quantity,i.owned_quantity,
        own_map.product_id AS market_product_id,own_map.condition_scope,
        e.*
 FROM canonical_inventory i
 JOIN canonical_product_mappings own_map
   ON own_map.variant_id=i.variant_id AND own_map.provider='Mana Pool'
  AND own_map.status='accepted'
  AND own_map.finish_scope=i.finish
  AND own_map.language_scope=i.printed_language
  AND own_map.condition_scope=i.condition_normalized
  AND NOT EXISTS(SELECT 1 FROM canonical_product_mappings newer WHERE newer.supersedes_id=own_map.id)
 JOIN canonical_product_mappings evidence_map
   ON evidence_map.provider=own_map.provider
  AND evidence_map.product_id=own_map.product_id
  AND evidence_map.condition_scope=own_map.condition_scope
 JOIN canonical_eligible_evidence e
   ON e.mapping_id=evidence_map.id AND e.capture_id=own_map.capture_id;
