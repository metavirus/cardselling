"""Read-only original workbook/ZIP audit. Does not edit or recalculate sources."""
import csv, json, hashlib, zipfile, re
from pathlib import Path
from decimal import Decimal, InvalidOperation
import openpyxl
root=Path(__file__).resolve().parents[1]
base=root/'data/private/intake/2026-10-04/handoff'
out=root/'.local/starting-data-audit'; out.mkdir(parents=True,exist_ok=True)
def csvrows(path):
    with path.open(encoding='utf-8-sig',newline='') as f:return list(csv.DictReader(f))
def key(r):return (str(r.get('Name') or ''),str(r.get('Set') or '').lower(),re.sub(r'^0+(?=\d)','',str(r.get('Collector #') or '')),str(r.get('Finish') or ''),str(r.get('Language') or ''))
def same(a,b):
    if a is None:a=''
    if b is None:b=''
    if str(a)==str(b):return True
    try:return abs(Decimal(str(a))-Decimal(str(b)))<=Decimal('0.000000001')
    except InvalidOperation:return False
final=csvrows(base/'derived/final_disposition_data.csv')
priority=csvrows(base/'derived/priority61_final_data.csv')
finalmap={key(r):r for r in final};prioritymap={key(r):r for r in priority}
result={'workbook':{},'zip':{},'notes':[]}
wb=openpyxl.load_workbook(base/'derived/MTG_Sellability_Final_Exploration_2026-10-04.xlsx',read_only=True,data_only=False)
for sheet in wb:
    rows=list(sheet.iter_rows(values_only=True));headers=rows[0]
    records=[dict(zip(headers,r)) for r in rows[1:] if any(v is not None for v in r)]
    formulas=sum(isinstance(v,str) and v.startswith('=') for r in rows for v in r)
    errors=[];tested=0
    source=prioritymap if sheet.title=='Priority 61 Research' else finalmap if 'Scryfall ID' in headers else None
    if source is not None:
        for rownum,r in enumerate(records,2):
            match=source.get(key(r))
            if match is None:errors.append({'row':rownum,'name':r.get('Name'),'reason':'No matching CSV row'});continue
            for h,v in r.items():
                if h not in match:errors.append({'row':rownum,'field':h,'reason':'Column not in CSV'});continue
                tested+=1
                equivalent=same(v,match[h]) or (h=='Set' and str(v).lower()==str(match[h]).lower())
                if not equivalent:errors.append({'row':rownum,'name':r.get('Name'),'field':h,'workbook':v,'csv':match[h]})
    result['workbook'][sheet.title]={'populated_rows':len(records),'columns':len(headers),'formulas':formulas,'cells_compared_to_csv':tested,'differences':errors}
    if sheet.title in ['Source Notes','Research Coverage','FINAL Summary']:result['workbook'][sheet.title]['content']=records
wb.close()
summary_checks=[]
for summary in result['workbook']['FINAL Summary']['content']:
    if not isinstance(summary.get('Rows'),(int,float)):continue
    subset=[r for r in final if r['Final disposition']==summary['Disposition']]
    counts_ok=len(subset)==summary['Rows'] and sum(int(r['Qty']) for r in subset)==summary['Copies']
    sums={
      'Current dealer cash':sum(Decimal(r['Best cash buylist'] or '0')*Decimal(r['Qty']) for r in subset),
      'Modeled Mana Pool net':sum(Decimal(r['Mana Pool modeled net'] or '0')*Decimal(r['Qty']) for r in subset),
      'Current/exact market reference':sum(Decimal(r['Historic / consumer market'] or r['Scryfall exact USD'] or r['Fresh ManaBox price'] or '0')*Decimal(r['Qty']) for r in subset)
    }
    summary_checks.append({'disposition':summary['Disposition'],'counts_match':counts_ok,'amounts_match':all(abs(v-Decimal(str(summary[k])))<=Decimal('0.005') for k,v in sums.items()),'missing_dealer_rows':sum(not r['Best cash buylist'] for r in subset),'missing_net_rows':sum(not r['Mana Pool modeled net'] for r in subset)})
result['summary_recalculation']=summary_checks
result['notes'].append('Summary reconciliation reproduces the historical workbook convention of treating missing amounts as zero in aggregate sums. This verifies arithmetic, not valuation completeness or executable proceeds.')
zip_path=base.parent/'codex_card_selling_handoff_2026-10-04.zip'
with zipfile.ZipFile(zip_path) as z:
    result['zip']['crc_error']=z.testzip()
    result['zip']['members']=[]
    for info in z.infolist():
        if info.is_dir():continue
        target=base/info.filename
        if not target.exists():
            # Some handoff zips have an enclosing directory; use only observed paths.
            candidates=[p for p in base.rglob(Path(info.filename).name) if p.is_file()]
            target=candidates[0] if len(candidates)==1 else target
        with z.open(info) as f:sha=hashlib.file_digest(f,'sha256').hexdigest()
        result['zip']['members'].append({'name':info.filename,'retained':target.exists(),'identical':target.exists() and hashlib.sha256(target.read_bytes()).hexdigest()==sha})
result['notes']=['Numeric workbook/CSV comparisons tolerate only 1e-9 representation noise; identity fields additionally checked against canonical inventory by database audit.','Workbook views overlap; subset counts are not additional inventory.','Source Notes, coverage and summaries are artifact-only context; raw XLSX remains retained.']
(out/'workbook-audit.json').write_text(json.dumps(result,indent=2,default=str),encoding='utf8')
print(json.dumps({'sheets':{k:{n:v[n] for n in ['populated_rows','formulas','cells_compared_to_csv','differences']} for k,v in result['workbook'].items()},'zip':result['zip']},default=str))
if any(s['differences'] for s in result['workbook'].values()) or result['zip']['crc_error'] or any(not m['identical'] for m in result['zip']['members']) or any(not r['counts_match'] or not r['amounts_match'] for r in summary_checks):
    raise SystemExit(1)
