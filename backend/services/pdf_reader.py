import numpy as np
import pandas as pd
import pdfplumber
from fastapi import HTTPException


def pdf_to_dataframe(file) -> pd.DataFrame:
    header = None
    rows = []

    with pdfplumber.open(file) as pdf:
        for page in pdf.pages:
            for table in page.extract_tables():
                for raw in table:
                    row = [str(c).strip() if c is not None else "" for c in raw]
                    if header is None:
                        header = [c if c else f"col_{i}" for i, c in enumerate(row)]
                        continue
                    if row == header:  # header repeated on every page
                        continue
                    row = (row + [""] * len(header))[: len(header)]
                    rows.append(row)

    if header is None or not rows:
        raise HTTPException(
            status_code=400,
            detail="No table found in this PDF. Scanned PDFs (images) are not supported.",
        )

    df = pd.DataFrame(rows, columns=header)
    df = df.replace(r"^\s*$", np.nan, regex=True)  # empty cells become missing

    # Turn columns that are mostly numbers into numeric columns
    for col in df.columns:
        converted = pd.to_numeric(df[col], errors="coerce")
        filled = df[col].notna().sum()
        if filled > 0 and converted.notna().sum() >= 0.8 * filled:
            df[col] = converted

    return df