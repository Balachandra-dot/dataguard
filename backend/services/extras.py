import json

import pandas as pd


def _num(x):
    return None if pd.isna(x) else round(float(x), 2)


def data_preview(df: pd.DataFrame, n: int = 20) -> list:
    # to_json turns NaN into null, which is valid JSON
    return json.loads(df.head(n).to_json(orient="records", date_format="iso"))


def column_profile(df: pd.DataFrame) -> list:
    out = []
    for col in df.columns:
        s = df[col]
        item = {
            "column": str(col),
            "type": str(s.dtype),
            "unique": int(s.nunique()),
            "missing": int(s.isnull().sum()),
            "min": None,
            "max": None,
            "mean": None,
        }
        if pd.api.types.is_numeric_dtype(s) and not pd.api.types.is_bool_dtype(s):
            item["min"] = _num(s.min())
            item["max"] = _num(s.max())
            item["mean"] = _num(s.mean())
        out.append(item)
    return out


def clean_dataframe(df: pd.DataFrame) -> pd.DataFrame:
    """Remove duplicate rows and fill missing values. Outliers are NOT changed."""
    out = df.drop_duplicates().copy()
    for col in out.columns:
        if out[col].isnull().any():
            if pd.api.types.is_numeric_dtype(out[col]):
                out[col] = out[col].fillna(out[col].median())
            else:
                out[col] = out[col].fillna("Unknown")
    return out