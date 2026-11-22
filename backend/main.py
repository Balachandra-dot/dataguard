import os
import re

from fastapi import FastAPI, UploadFile, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from sqlalchemy.orm import Session
import pandas as pd

from accounts import router as accounts_router
from auth import current_user
from db import get_db
from history import router as history_router, save_analysis, uid
from services.profiling import missing_report
from services.duplicates import duplicate_report
from services.anomalies import anomaly_report, ml_anomaly_report
from services.scoring import quality_score
from services.recommendations import build_recommendations
from services.report import build_pdf
from services.pdf_reader import pdf_to_dataframe
from services.extras import data_preview, column_profile, clean_dataframe

MAX_MB = 25

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        o.strip()
        for o in os.getenv("FRONTEND_ORIGINS", "http://localhost:5173").split(",")
        if o.strip()
    ],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(accounts_router)
app.include_router(history_router)


def load_dataframe(file: UploadFile) -> pd.DataFrame:
    # Size guard (the free server has little memory)
    file.file.seek(0, 2)
    size = file.file.tell()
    file.file.seek(0)
    if size > MAX_MB * 1024 * 1024:
        raise HTTPException(status_code=413, detail=f"File too large (limit {MAX_MB} MB).")

    name = (file.filename or "").lower()
    try:
        if name.endswith(".csv"):
            df = pd.read_csv(file.file)
        elif name.endswith(".xlsx"):
            df = pd.read_excel(file.file)
        elif name.endswith(".pdf"):
            df = pdf_to_dataframe(file.file)
        else:
            raise HTTPException(status_code=400, detail="Only CSV, XLSX or PDF files allowed")
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(
            status_code=400,
            detail="Could not read this file. Check that it is a valid CSV, XLSX or PDF table.",
        )

    if df.empty or len(df.columns) == 0:
        raise HTTPException(status_code=400, detail="The file has no data rows.")
    return df


def run_analysis(df: pd.DataFrame, filename: str) -> dict:
    missing = missing_report(df)
    duplicates = duplicate_report(df)
    anomalies = anomaly_report(df)
    ml_anomalies = ml_anomaly_report(df)
    return {
        "filename": filename,
        "rows": len(df),
        "columns": [str(c) for c in df.columns],
        "score": quality_score(df, missing, duplicates, anomalies, ml_anomalies),
        "missing": missing,
        "duplicates": duplicates,
        "anomalies": anomalies,
        "ml_anomalies": ml_anomalies,
        "recommendations": build_recommendations(df, missing, duplicates, anomalies, ml_anomalies),
        "preview": data_preview(df),
        "profile": column_profile(df),
    }


@app.get("/")
def home():
    return {"message": "Data Quality API is running"}


# Plain "def" (not "async def") lets FastAPI run the heavy pandas work in a
# worker thread, so one analysis doesn't freeze logins for everyone else.
@app.post("/analyze")
def analyze(file: UploadFile, user: dict = Depends(current_user), db: Session = Depends(get_db)):
    user_id = uid(user)
    df = load_dataframe(file)
    result = run_analysis(df, file.filename)
    result["analysis_id"] = save_analysis(db, user_id, result)
    return result


@app.post("/report")
def report(file: UploadFile, user: dict = Depends(current_user)):
    uid(user)
    df = load_dataframe(file)
    pdf_bytes = build_pdf(run_analysis(df, file.filename))
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": 'attachment; filename="audit_report.pdf"'},
    )


@app.post("/clean")
def clean(file: UploadFile, user: dict = Depends(current_user)):
    uid(user)
    df = load_dataframe(file)
    cleaned = clean_dataframe(df)
    stem = re.sub(r"[^A-Za-z0-9_-]", "_", (file.filename or "data").rsplit(".", 1)[0]) or "data"
    return Response(
        content=cleaned.to_csv(index=False),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="cleaned_{stem}.csv"'},
    )