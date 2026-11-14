import pandas as pd

def missing_report(df: pd.DataFrame) -> dict:
    total_rows = len(df)
    columns = {}

    for col in df.columns:
        missing_count = int(df[col].isnull().sum())
        columns[col] = {
            "missing_count": missing_count,
            "missing_percent": round(missing_count / total_rows * 100, 2),
        }

    return {
        "total_missing_cells": int(df.isnull().sum().sum()),
        "columns": columns,
    }