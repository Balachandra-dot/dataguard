import pandas as pd

def quality_score(df: pd.DataFrame, missing: dict, duplicates: dict,
                  anomalies: dict, ml_anomalies: dict) -> dict:
    rows = len(df)
    cells = rows * len(df.columns)
    if rows == 0 or cells == 0:
        return {"overall": 0, "completeness": 0, "uniqueness": 0, "validity": 0}

    # Completeness: how many cells are filled
    completeness = 100 - missing["total_missing_cells"] / cells * 100

    # Uniqueness: how many rows are not duplicate copies
    uniqueness = 100 - duplicates["duplicate_count"] / rows * 100

    # Validity: rows NOT flagged by either anomaly method
    bad_rows = {a["row_number"] for a in anomalies["anomalies"]}
    if ml_anomalies.get("ran"):
        bad_rows |= {a["row_number"] for a in ml_anomalies["anomalies"]}
    validity = 100 - len(bad_rows) / rows * 100

    overall = 0.4 * completeness + 0.3 * uniqueness + 0.3 * validity

    return {
        "overall": round(overall, 1),
        "completeness": round(completeness, 1),
        "uniqueness": round(uniqueness, 1),
        "validity": round(validity, 1),
        "flagged_rows": len(bad_rows),
    }