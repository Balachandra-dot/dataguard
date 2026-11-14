import json
import pandas as pd

def duplicate_report(df: pd.DataFrame) -> dict:
    # keep=False marks ALL copies, so we can show both rows involved
    mask = df.duplicated(keep=False)
    dup_rows = df[mask].copy()

    # row_number matches the spreadsheet row (header is row 1)
    dup_rows.insert(0, "row_number", dup_rows.index + 2)

    return {
        "duplicate_count": int(df.duplicated().sum()),  # extra copies only
        "rows_involved": int(mask.sum()),                # every row in a duplicate group
        "rows": json.loads(dup_rows.head(100).to_json(orient="records")),
    }