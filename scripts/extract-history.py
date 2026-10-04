"""Read historical XLSX as source evidence, never as active sale inventory."""
import datetime
import json
import pathlib
import sys

import openpyxl

source, target = map(pathlib.Path, sys.argv[1:3])
workbook = openpyxl.load_workbook(source, read_only=True, data_only=True)
try:
    if len(workbook.worksheets) != 1:
        raise ValueError("Historical workbook layout changed; inspect before importing")
    rows = workbook.worksheets[0].iter_rows(values_only=True)
    headers = next(rows)
    if any(not isinstance(h, str) for h in headers) or len(set(headers)) != len(headers):
        raise ValueError("Missing or duplicate workbook headers")
    target.parent.mkdir(parents=True, exist_ok=True)
    count = 0
    copies = 0
    with target.open("w", encoding="utf-8", newline="\n") as output:
        for row in rows:
            if all(value is None for value in row):
                continue
            record = dict(zip(headers, row, strict=True))
            for key, value in record.items():
                if isinstance(value, (datetime.datetime, datetime.date)):
                    record[key] = value.isoformat()
            output.write(json.dumps(record, ensure_ascii=False, allow_nan=False) + "\n")
            count += 1
            copies += int(record["Quantity"] or 0)
    print(json.dumps({"rows": count, "copies": copies}))
finally:
    workbook.close()
