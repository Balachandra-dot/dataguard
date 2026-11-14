from sklearn.ensemble import IsolationForest
import pandas as pd

def anomaly_report(df: pd.DataFrame) -> dict:
    numeric = df.select_dtypes(include="number")
    results = []

    for col in numeric.columns:
        values = numeric[col].dropna()
        q1 = values.quantile(0.25)
        q3 = values.quantile(0.75)
        iqr = q3 - q1
        low = q1 - 1.5 * iqr
        high = q3 + 1.5 * iqr

        outliers = numeric[(numeric[col] < low) | (numeric[col] > high)]
        for idx, val in outliers[col].items():
            results.append({
                "row_number": int(idx) + 2,
                "column": col,
                "value": float(val),
                "expected_range": [round(float(low), 2), round(float(high), 2)],
            })

    return {"anomaly_count": len(results), "anomalies": results}
def ml_anomaly_report(df: pd.DataFrame, contamination: float = 0.01) -> dict:
    numeric = df.select_dtypes(include="number")
    # ID columns carry no meaning for anomaly detection
    numeric = numeric.drop(columns=[c for c in numeric.columns if c.lower() == "id"])

    if numeric.shape[1] == 0 or len(numeric) < 50:
        return {"ran": False, "reason": "Need numeric columns and at least 50 rows"}

    filled = numeric.fillna(numeric.median())

    model = IsolationForest(contamination=contamination, random_state=42)
    labels = model.fit_predict(filled)          # -1 = anomaly, 1 = normal
    scores = model.decision_function(filled)    # lower = more suspicious

    flagged = []
    for idx in filled.index[labels == -1]:
        flagged.append({
            "row_number": int(idx) + 2,
            "anomaly_score": round(float(scores[idx]), 4),
            "values": {c: float(filled.loc[idx, c]) for c in filled.columns},
        })

    flagged.sort(key=lambda r: r["anomaly_score"])
    return {"ran": True, "anomaly_count": len(flagged), "anomalies": flagged[:100]}