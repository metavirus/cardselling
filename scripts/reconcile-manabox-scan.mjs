import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {appClient} from './database.mjs';
import {hash} from './import-domain.mjs';
import {reconcileScan} from './scan-reconciliation.mjs';
const path=process.argv[2];if(!path)throw Error('Pass ManaBox CSV path; optional --apply');
const bytes=readFileSync(path),text=bytes.toString('utf8'),fileId=hash(bytes);const apply=process.argv.includes('--apply');
const c=await appClient();
try{
 await c.query('BEGIN');await c.query("select pg_advisory_xact_lock(hashtext('canonical-inventory-reconciliation'))");
 const existing=(await c.query('select i.*,r.raw from canonical_inventory i join source_records r on r.id=i.origin_record_id')).rows;
 const before=(await c.query('select count(*)::int lots,sum(owned_quantity)::int copies from canonical_inventory')).rows[0];
 const plan=reconcileScan(text,existing);
 mkdirSync('.local/import',{recursive:true});if(plan.added.length){const diff={source_hash:fileId,added:plan.added,missing:[],changed:[]};writeFileSync(`.local/import/scan-${fileId}-diff.json`,JSON.stringify(diff,null,2));writeFileSync('.local/scan-diff.json',JSON.stringify(diff,null,2));}
 const choices=(await c.query('select count(*)::int n from canonical_owner_choices')).rows[0].n;
 if(plan.added.length){
 await c.query('insert into source_files(id,path,classification,byte_size,metadata) values($1,$2,$3,$4,$5) on conflict do nothing',[fileId,resolve(path),'accepted_inventory_additions',bytes.length,JSON.stringify({sha256:fileId,authority:'Owner authorized additions-only reconciliation; source rows retained in SQL; CSV disposable',mode:'additions_only'})]);
 for(let n=0;n<plan.rows.length;n++)await c.query('insert into source_records(id,source_file_id,record_number,raw) values($1,$2,$3,$4) on conflict do nothing',[`${fileId}:${n+1}`,fileId,n+1,JSON.stringify(plan.rows[n])]);
 for(const r of plan.added){
 const recordId=`${fileId}:${plan.rows.indexOf(r)+1}`;
 const candidates=(await c.query(`select distinct v.id from canonical_variants v join canonical_product_mappings m on m.variant_id=v.id where m.provider='Scryfall' and m.product_id=$1 and m.status='accepted' and v.finish=$2 and v.printed_language=$3 and v.set_code=$4 and v.collector_number=$5`,[r['Scryfall ID'],r.Foil,r.Language,r['Set code'].toLowerCase(),r['Collector number']])).rows;
 assert.ok(candidates.length<=1,'Ambiguous existing variant');
 const vid=candidates[0]?.id??(await c.query('insert into canonical_variants(name,set_code,collector_number,finish,printed_language,identity_basis) values($1,$2,$3,$4,$5,$6) returning id',[r.Name,r['Set code'].toLowerCase(),r['Collector number'],r.Foil,r.Language,'Owner accepted new ManaBox scan; exact catalog hydration separate'])).rows[0].id;
 if(!candidates.length)await c.query(`insert into canonical_product_mappings(variant_id,provider,product_id,condition_scope,finish_scope,language_scope,status,basis,source_record_id) values($1,'Scryfall',$2,'not_applicable',$3,$4,'candidate',$5,$6)`,[vid,r['Scryfall ID'],r.Foil,r.Language,'Accepted scan identity pending independent catalog validation',recordId]);
 const lid=(await c.query('insert into canonical_lots(variant_id,origin_record_id,condition_raw,condition_normalized,notes) values($1,$2,$3,$3,$4) returning id',[vid,recordId,r.Condition,'Added by owner-authorized additions-only scan reconciliation; scan price is not acquisition cost'])).rows[0].id;
 await c.query(`insert into canonical_assertions(lot_id,variant_id,field_name,value,authority,basis,source_record_id) values($1,$2,'inventory_addition',$3,'accepted_inventory',$4,$5)`,[lid,vid,JSON.stringify({quantity:Number(r.Quantity),scan_identity:r['ManaBox ID'],added:r.Added,source_hash:fileId}), 'Owner October 4 authorized new scanned cards; prior rows and corrections preserved',recordId]);
 await c.query(`insert into canonical_stock_movements(lot_id,quantity,from_state,to_state,reason,idempotency_key,source_record_id,event_at) values($1,$2,'external','available',$3,$4,$5,$6)`,[lid,Number(r.Quantity),'Accepted additions-only ManaBox reconciliation',`manabox-addition:${hash(JSON.stringify([r['ManaBox ID'],r.Added,r['Scryfall ID'],r.Foil,r.Language,r.Condition]))}`,recordId,r.Added]);
 }
 await c.query('insert into canonical_source_retirements(source_file_id,reason) values($1,$2) on conflict do nothing',[fileId,'Reconciled additions accepted into canonical SQL; snapshot retired, original CSV disposable; raw rows and hash retained in SQL']);
 }
 const after=(await c.query('select count(*)::int lots,sum(owned_quantity)::int copies from canonical_inventory')).rows[0];
 assert.equal(after.lots,before.lots+plan.added.length);assert.equal(after.copies,before.copies+plan.added.reduce((a,r)=>a+Number(r.Quantity),0));
 assert.equal((await c.query('select count(*)::int n from canonical_owner_choices')).rows[0].n,choices);
 const receipt={source_hash:fileId,mode:apply?'applied':'trial_rolled_back',before,after,added_lots:plan.added.length,added_copies:after.copies-before.copies,owner_choices_unchanged:true};
 await c.query(apply?'COMMIT':'ROLLBACK');mkdirSync('.local/import',{recursive:true});writeFileSync(`.local/import/scan-${fileId}-${apply?(plan.added.length?'applied':'replay'):'trial'}.json`,JSON.stringify(receipt,null,2));console.log(JSON.stringify(receipt));
}catch(e){await c.query('ROLLBACK');throw e;}finally{await c.end();}
