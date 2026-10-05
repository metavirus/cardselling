"""Stream fresh public bulk files, retaining exact inventory identity subsets."""
import gzip, json, re, sys
from pathlib import Path

base = Path(sys.argv[1])
mode = sys.argv[2]
wanted = set(json.loads((base / 'wanted.json').read_text()))
decoder = json.JSONDecoder()

def entries(path, array=False):
    with gzip.open(path, 'rt', encoding='utf8') as stream:
        buf = stream.read(65536)
        if array:
            match = re.match(r'\s*\{\s*"data"\s*:\s*\[', buf)
        else:
            match = re.match(r'\s*\{\s*"meta"\s*:\s*(\{[^}]*\})\s*,\s*"data"\s*:\s*\{', buf)
            assert match, 'Unexpected MTGJSON envelope'
            yield 'meta', json.loads(match.group(1)), 0
        assert match, 'Unexpected bulk envelope'
        buf = buf[match.end():]
        n = 0
        while True:
            buf = buf.lstrip(' \r\n,')
            if buf.startswith(']' if array else '}'):
                break
            try:
                value, end = decoder.raw_decode(buf)
                key = None
                if not array:
                    key = value
                    after = buf[end:].lstrip(' \r\n:')
                    value, used = decoder.raw_decode(after)
                    rest = after[used:]
                else:
                    rest = buf[end:]
            except json.JSONDecodeError:
                more = stream.read(65536)
                if not more:
                    raise
                buf += more
                continue
            n += 1
            buf = rest
            yield key, value, n
        # Force gzip footer/checksum validation, including bytes after data.
        stream.read()

summary = {}
if mode == 'manapool':
    with (base / 'catalog.jsonl').open('w', encoding='utf8') as out:
        for _, value, n in entries(base / 'manapool-singles.json.gz', True):
            if value.get('scryfall_id') in wanted:
                out.write(json.dumps({'record_number': n, 'raw': value}) + '\n')
else:
    ids = set()
    with (base / 'identifiers.jsonl').open('w', encoding='utf8') as out:
        for key, value, n in entries(base / 'AllIdentifiers.json.gz'):
            if key == 'meta':
                summary['identity_meta'] = value
            elif value.get('identifiers', {}).get('scryfallId') in wanted:
                ids.add(key)
                out.write(json.dumps({'record_number': n, 'uuid': key, 'raw': value}) + '\n')
    with (base / 'prices.jsonl').open('w', encoding='utf8') as out:
        for key, value, n in entries(base / 'AllPrices.json.gz'):
            if key == 'meta':
                summary['price_meta'] = value
            elif key in ids:
                out.write(json.dumps({'record_number': n, 'uuid': key, 'raw': value}) + '\n')
    (base / 'mtgjson-meta.json').write_text(json.dumps(summary))
print(json.dumps({'status': 'extracted', 'source': mode, **summary}))
