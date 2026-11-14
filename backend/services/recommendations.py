import pandas as pd

def build_recommendations(df, missing, duplicates, anomalies, ml_anomalies) -> list:
    recs = []

    # 1. Missing values
    for col, info in missing["columns"].items():
        if info["missing_count"] == 0:
            continue
        pct = info["missing_percent"]
        if pct > 50:
            action, severity = "Over half is empty. Consider dropping this column.", "high"
        elif pd.api.types.is_numeric_dtype(df[col]):
            action = f"Fill with the median ({round(float(df[col].median()), 2)})."
            severity = "high" if pct > 20 else "medium"
        else:
            action = "Fill with 'Unknown' or the most common value, or request it from the source."
            severity = "high" if pct > 20 else "medium"
        recs.append({
            "issue": "missing_values",
            "target": col,
            "severity": severity,
            "detail": f"{info['missing_count']} missing ({pct}%)",
            "action": action,
        })

    # 2. Duplicates
    if duplicates["duplicate_count"] > 0:
        recs.append({
            "issue": "duplicates",
            "target": "all columns",
            "severity": "high",
            "detail": f"{duplicates['duplicate_count']} duplicate row(s)",
            "action": "Remove duplicates and keep the first occurrence.",
        })

    # 3. Outliers (IQR)
    for a in anomalies["anomalies"][:50]:
        lo, hi = a["expected_range"]
        recs.append({
            "issue": "outlier",
            "target": f"row {a['row_number']}, {a['column']}",
            "severity": "medium",
            "detail": f"value {a['value']} is outside {lo} to {hi}",
            "action": "Verify with the source. Correct it, or cap it to the valid range.",
        })

    # 4. ML anomalies (summary only)
    if ml_anomalies.get("ran") and ml_anomalies["anomaly_count"] > 0:
        top = [a["row_number"] for a in ml_anomalies["anomalies"][:5]]
        recs.append({
            "issue": "unusual_combination",
            "target": f"rows {top}",
            "severity": "low",
            "detail": f"{ml_anomalies['anomaly_count']} rows look unusual overall",
            "action": "Review manually. These may be valid but rare records.",
        })

    return recs