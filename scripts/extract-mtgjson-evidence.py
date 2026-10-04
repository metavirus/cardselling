"""Stream official MTGJSON bulk JSON and retain the exact inventory ID subset."""
import gzip,json,hashlib,re
from pathlib import Path
base=Path(__file__).resolve().parents[1]/'data/private/market/2026-10-04'
scope=json.loads((base/'inventory-scope.json').read_text())
wanted={x['source_scryfall_id'] for x in scope}
def entries(path):
    decoder=json.JSONDecoder()
    with gzip.open(path,'rt',encoding='utf8') as stream:
        buf=stream.read(1024*1024)
        m=re.match(r'\s*\{\s*"meta"\s*:\s*(\{[^}]*\})\s*,\s*"data"\s*:\s*\{',buf)
        if not m:raise ValueError('Unexpected MTGJSON envelope')
        meta=json.loads(m.group(1));buf=buf[m.end():]
        yield 'meta',meta,0
        number=0
        while True:
            buf=buf.lstrip(' \r\n,')
            if buf.startswith('}'):
                break
            try:
                key,end=decoder.raw_decode(buf)
                after=buf[end:].lstrip(' \r\n:')
                value,used=decoder.raw_decode(after)
                buf=after[used:]
            except json.JSONDecodeError:
                more=stream.read(1024*1024)
                if not more:raise
                buf+=more;continue
            number+=1
            yield key,value,number
        assert buf.startswith('}'), 'Incomplete object'
        # Reading to EOF verifies the gzip footer/checksum.
        stream.read()
def sha(path):
    with path.open('rb') as f:return hashlib.file_digest(f,'sha256').hexdigest()
matches={};identity_count=0
with (base/'mtgjson-identifiers.jsonl').open('w',encoding='utf8') as out:
    for key,value,number in entries(base/'AllIdentifiers.json.gz'):
        if key=='meta':identity_meta=value;continue
        identity_count+=1
        if value.get('identifiers',{}).get('scryfallId') in wanted:
            matches[key]=value['identifiers']['scryfallId']
            out.write(json.dumps({'record_number':number,'uuid':key,'raw':value},ensure_ascii=False)+'\n')
print(json.dumps({'phase':'identifiers','total':identity_count,'matched':len(matches),'meta':identity_meta}),flush=True)
price_count=0;matched_prices=0
with (base/'mtgjson-prices.jsonl').open('w',encoding='utf8') as out:
    for key,value,number in entries(base/'AllPrices.json.gz'):
        if key=='meta':price_meta=value;continue
        price_count+=1
        if key in matches:
            matched_prices+=1
            out.write(json.dumps({'record_number':number,'uuid':key,'raw':value},ensure_ascii=False)+'\n')
report={'identity_meta':identity_meta,'price_meta':price_meta,'identifier_records':identity_count,'matched_identifiers':len(matches),'price_records':price_count,'matched_prices':matched_prices,'source_hashes':{n:sha(base/n) for n in ['AllIdentifiers.json.gz','AllPrices.json.gz']},'extract_hashes':{n:sha(base/n) for n in ['mtgjson-identifiers.jsonl','mtgjson-prices.jsonl']},'scope_sha256':sha(base/'inventory-scope.json')}
(base/'mtgjson-extraction.json').write_text(json.dumps(report,indent=2))
print(json.dumps(report),flush=True)
