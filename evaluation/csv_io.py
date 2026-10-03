"""Read evaluate.py results CSVs, including copies re-saved by Excel.

Excel on Windows with Hungarian (or other European) regional settings saves CSV files
with ";" as the separator and often in the Windows-1250 code page instead of UTF-8.
"""

import csv


def read_results_csv(path):
    """Return (rows, encoding). Detects UTF-8 / Windows-1250 and "," / ";" separators."""
    raw = open(path, "rb").read()
    for encoding in ("utf-8-sig", "cp1250"):
        try:
            text = raw.decode(encoding)
            break
        except UnicodeDecodeError:
            continue
    else:
        raise ValueError(f"{path}: cannot decode as UTF-8 or Windows-1250")
    first_line = text.split("\n", 1)[0]
    delimiter = ";" if first_line.count(";") > first_line.count(",") else ","
    rows = list(csv.DictReader(text.splitlines(keepends=True), delimiter=delimiter))
    if not rows or "id" not in rows[0]:
        raise ValueError(f"{path}: not a results CSV from evaluate.py (no 'id' column)")
    return rows, encoding
