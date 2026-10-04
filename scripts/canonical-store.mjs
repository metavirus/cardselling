import assert from 'node:assert/strict';

// Called inside a transaction; reads accepted database provenance, never CSV/XLSX.
export async function adoptCanonical(client, assumptions) {
  await client.query("SELECT pg_advisory_xact_lock(hashtext('cardselling_canonical_adoption'))");
  const prior = await client.query("SELECT * FROM canonical_cutovers WHERE name='initial_manabox'");
  if (prior.rowCount) return { alreadyAdopted: true, lots: prior.rows[0].lot_count, copies: prior.rows[0].copy_count };
  const snapshots = (await client.query(`SELECT s.* FROM inventory_snapshots s JOIN source_files f ON f.id=s.id
    WHERE replace(f.path,chr(92),'/') LIKE '%/sources/Sell.csv'`)).rows;
  assert.equal(snapshots.length, 1, 'Exactly one accepted ManaBox baseline required');
  const snapshot = snapshots[0];
  const rows = (await client.query(`SELECT h.*,r.raw FROM inventory_holdings h
    JOIN source_records r ON r.id=h.id WHERE h.snapshot_id=$1 ORDER BY h.id`, [snapshot.id])).rows;
  assert.equal(rows.length, 723, 'Baseline must contain 723 rows');
  assert.equal(rows.reduce((s,r)=>s+r.quantity,0),817,'Baseline must contain 817 copies');
  assert.equal((await client.query('SELECT count(*)::int AS n FROM canonical_lots')).rows[0].n,0,'Refuse to seed over existing canonical lots');
  const references = (await client.query(`SELECT scryfall_id,raw FROM card_reference_snapshots WHERE source_file_id IN
    (SELECT id FROM source_files WHERE path LIKE '%default-cards-20260929210547.jsonl.gz')`)).rows;
  const catalog = new Map(references.map(r=>[r.scryfall_id,r.raw]));
  const variants = new Map();
  let normalized = 0;
  for (const h of rows) {
    const reference = catalog.get(h.scryfall_id);
    const phyrexian = h.set_code.toLowerCase()==='one' && ['283','326','365','366','367','368','369','429'].includes(h.collector_number);
    if (phyrexian) assert.equal(reference?.lang,'ph','Verified Phyrexian normalization requires catalog evidence');
    const language = phyrexian ? 'ph' : h.language;
    const basis = phyrexian ? 'Known Phyrexian-script printing; raw English export preserved' : 'Accepted ManaBox inventory; enrichment cannot override';
    const key = JSON.stringify([h.set_code.toLowerCase(),h.collector_number,h.finish,language,h.scryfall_id]);
    let variantId=variants.get(key);
    if(!variantId) {
      variantId=(await client.query(`INSERT INTO canonical_variants(name,set_code,collector_number,finish,treatment,printed_language,identity_basis)
        VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id`,[h.name,h.set_code.toLowerCase(),h.collector_number,h.finish,phyrexian?'Phyrexian script':null,language,basis])).rows[0].id;
      variants.set(key,variantId);
      await client.query(`INSERT INTO canonical_product_mappings(variant_id,provider,product_id,condition_scope,finish_scope,language_scope,status,basis,source_record_id)
        VALUES($1,'Scryfall',$2,'not_applicable',$3,$4,$5,$6,$7)`,[variantId,h.scryfall_id,h.finish,reference?.lang??h.language,
          reference?.lang===language?'accepted':'candidate',reference?.lang===language?'Inventory ID and catalog language agree':'Source catalog object needs language-specific mapping; inventory remains authoritative',h.id]);
    }
    const lotId=(await client.query(`INSERT INTO canonical_lots(variant_id,origin_record_id,condition_raw,condition_normalized,notes)
      VALUES($1,$2,$3,$4,$5) RETURNING id`,[variantId,h.id,h.condition,h.condition==='near_mint'?'near_mint':null,'Opening inventory adopted from accepted ManaBox scan; scan reference price is not cost basis'])).rows[0].id;
    await client.query(`INSERT INTO canonical_assertions(lot_id,variant_id,field_name,value,authority,basis,source_record_id)
      VALUES($1,$2,'opening_inventory',$3,'accepted_inventory',$4,$5)`,[lotId,variantId,JSON.stringify({finish:h.finish,language:h.language,condition:h.condition,quantity:h.quantity,scryfall_id:h.scryfall_id}),basis,h.id]);
    if(phyrexian) {
      normalized++;
      await client.query(`INSERT INTO canonical_assertions(lot_id,variant_id,field_name,value,authority,basis,source_record_id)
        VALUES($1,$2,'printed_language','"ph"','normalization',$3,$4)`,[lotId,variantId,basis,h.id]);
    }
    const ownerConfirmed = (h.name==='Gigantosaurus'&&h.set_code.toLowerCase()==='m19'&&h.collector_number==='185') ||
      (h.set_code.toLowerCase()==='soa'&&h.language==='ja') ||
      (h.name==='Psychic Frog'&&h.set_code.toLowerCase()==='mh3'&&h.collector_number==='433');
    if(ownerConfirmed) await client.query(`INSERT INTO canonical_assertions(lot_id,variant_id,field_name,value,authority,basis,source_record_id)
      VALUES($1,$2,'owner_confirmation',$3,'owner','Owner chat October 4, 2026: Japanese SOA and Gigantosaurus intentional; Psychic Frog 433 nonfoil',$4)`,[lotId,variantId,JSON.stringify({language:h.language,finish:h.finish}),h.id]);
    await client.query(`INSERT INTO canonical_stock_movements(lot_id,quantity,from_state,to_state,reason,idempotency_key,source_record_id)
      VALUES($1,$2,'external','available','Accepted opening ManaBox baseline',$3,$4)`,[lotId,h.quantity,`opening:${h.id}`,h.id]);
  }
  assert.equal(normalized,8,'Expected eight known Phyrexian rows');
  // Raw historical observations remain where they were. Nothing is silently promoted.
  await client.query(`INSERT INTO canonical_source_retirements(source_file_id,reason)
    SELECT id,'Historical import evidence only after canonical cutover; not a live operational input' FROM source_files`);
  for(const a of assumptions.assumptions) await client.query(`INSERT INTO canonical_policies(kind,version,status,rules,source_refs)
    VALUES($1,'baseline-2026-10-04',$2,$3,$4)`,[a.id,a.status.startsWith('proposed')||a.status==='unknown'?'proposed':'accepted',JSON.stringify(a),JSON.stringify(a.sources??[])]);
  await client.query(`INSERT INTO canonical_policies(kind,version,status,rules,source_refs)
    VALUES('inventory_authority','2026-10-04','accepted',$1,'[]')`,[JSON.stringify({system_of_record:'canonical database after adoption',opening_authority:'accepted ManaBox scan',enrichment:'never changes holdings',future_scans:'explicit reconciliation, never replacement',legacy_artifacts:'historical only'})]);
  await client.query(`INSERT INTO canonical_cutovers(name,source_file_id,lot_count,copy_count,details)
    VALUES('initial_manabox',$1,723,817,$2)`,[snapshot.id,JSON.stringify({normalizedPhyrexianRows:normalized,inventoryAuthority:'ManaBox accepted baseline plus owner corrections; database authoritative thereafter',retired:'All prior import artifacts; retained for provenance'})]);
  return {alreadyAdopted:false,lots:rows.length,copies:817,variants:variants.size,normalizedPhyrexianRows:normalized};
}

export async function canonicalSummary(client) {
  const inventory=(await client.query(`SELECT count(*)::int AS lots,coalesce(sum(owned_quantity),0)::int AS owned,
    coalesce(sum(available_quantity),0)::int AS available FROM canonical_inventory`)).rows[0];
  const counts=(await client.query(`SELECT
    (SELECT count(*)::int FROM canonical_source_retirements) AS retired_artifacts,
    (SELECT count(*)::int FROM canonical_eligible_evidence) AS eligible_observations,
    (SELECT count(*)::int FROM canonical_decisions) AS new_decisions,
    (SELECT count(*)::int FROM market_observations) AS archived_observations,
    (SELECT count(*)::int FROM interpretation_checkpoints) AS archived_interpretations`)).rows[0];
  return {...inventory,...counts};
}
