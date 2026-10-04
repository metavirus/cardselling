"""Stream retained public catalog; preserve full parent records for inventory IDs."""
import gzip,json,hashlib
from pathlib import Path
base=Path(__file__).resolve().parents[1]/'data/private/market/2026-10-04'
wanted={r['source_scryfall_id'] for r in json.loads((base/'inventory-scope.json').read_text())}
decoder=json.JSONDecoder();count=0;kept=0
with gzip.open(base/'manapool-singles.json.gz','rt',encoding='utf8') as f, (base/'inventory-catalog.jsonl').open('w',encoding='utf8') as output:
    buf=f.read(1024*1024)
    assert buf.startswith('{"data":[')
    buf=buf[len('{"data":['):]
    while True:
        buf=buf.lstrip(' \r\n,')
        if buf.startswith(']'):break
        try:item,end=decoder.raw_decode(buf)
        except json.JSONDecodeError:
            more=f.read(1024*1024)
            if not more:raise
            buf+=more;continue
        count+=1
        if item.get('scryfall_id') in wanted:
            output.write(json.dumps({'record_number':count,'raw':item},ensure_ascii=False)+'\n');kept+=1
        buf=buf[end:]
def sha(path):
    with path.open('rb') as f:return hashlib.file_digest(f,'sha256').hexdigest()
(base/'extraction.json').write_text(json.dumps({'catalog_records':count,'retained_parent_records':kept,'catalog_sha256':sha(base/'manapool-singles.json.gz'),'scope_sha256':sha(base/'inventory-scope.json'),'extracted_sha256':sha(base/'inventory-catalog.jsonl'),'selection':'Canonical inventory source Scryfall IDs; full parent variants retained. Identity/finish/language/grade validated at ingestion.'},indent=2))
print(json.dumps({'catalog_records':count,'retained_parent_records':kept}))
