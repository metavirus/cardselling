import {mkdirSync,writeFileSync,copyFileSync,existsSync,statSync} from 'node:fs';
import {join} from 'node:path';
import {appClient,root} from './database.mjs';
const dir=join(root,'data/private/market/2026-10-04');mkdirSync(dir,{recursive:true});
const c=await appClient();
try {
 const lots=(await c.query(`SELECT i.*,r.raw->>'Scryfall ID' AS source_scryfall_id FROM canonical_inventory i JOIN source_records r ON r.id=i.origin_record_id ORDER BY lot_id`)).rows;
 writeFileSync(join(dir,'inventory-scope.json'),JSON.stringify(lots));
 for(const name of ['manapool-singles.json.gz','manapool-openapi.json','gigantosaurus-ja.json'])if(!existsSync(join(dir,name)))copyFileSync(join(root,'.local/source-survey',name),join(dir,name));
 if(!existsSync(join(dir,'download-provenance.json')))copyFileSync(join(root,'../outputs/mtg-market-source-survey/download-provenance.json'),join(dir,'download-provenance.json'));
 if(!existsSync(join(dir,'identity-provenance.json')))writeFileSync(join(dir,'identity-provenance.json'),JSON.stringify({url:'https://api.scryfall.com/cards/m19/185/ja',captured_at:statSync(join(root,'.local/source-survey/gigantosaurus-ja.json')).mtime.toISOString(),time_basis:'Local download completion'}));
 console.log(`Prepared canonical scope of ${lots.length} lots and retained public source files.`);
}finally{await c.end();}
