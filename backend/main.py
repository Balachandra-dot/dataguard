import os
from fastapi import FastAPI, UploadFile, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
import pandas as pd

from accounts import router as accounts_router
from auth import current_user
from services.profiling import missing_report
from services.duplicates import duplicate_report
from services.anomalies import anomaly_report, ml_anomaly_report
from services.scoring import quality_score
from services.recommendations import build_recommendations
from services.report import build_pdf
from services.pdf_reader import pdf_to_dataframe

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


def load_dataframe(file: UploadFile) -> pd.DataFrame:
    name = file.filename.lower()
    if name.endswith(".csv"):
        return pd.read_csv(file.file)
    if name.endswith(".xlsx"):
        return pd.read_excel(file.file)
    if name.endswith(".pdf"):
        return pdf_to_dataframe(file.file)
    raise HTTPException(status_code=400, detail="Only CSV, XLSX or PDF files allowed")


def run_analysis(df: pd.DataFrame, filename: str) -> dict:
    missing = missing_report(df)
    duplicates = duplicate_report(df)
    anomalies = anomaly_report(df)
    ml_anomalies = ml_anomaly_report(df)
    return {
        "filename": filename,
        "rows": len(df),
        "columns": list(df.columns),
        "score": quality_score(df, missing, duplicates, anomalies, ml_anomalies),
        "missing": missing,
        "duplicates": duplicates,
        "anomalies": anomalies,
        "ml_anomalies": ml_anomalies,
        "recommendations": build_recommendations(df, missing, duplicates, anomalies, ml_anomalies),
    }


@app.get("/")
def home():
    return {"message": "Data Quality API is running"}


@app.post("/analyze")
async def analyze(file: UploadFile, user: dict = Depends(current_user)):
    df = load_dataframe(file)
    return run_analysis(df, file.filename)


@app.post("/report")
async def report(file: UploadFile, user: dict = Depends(current_user)):
    df = load_dataframe(file)
    result = run_analysis(df, file.filename)
    pdf_bytes = build_pdf(result)
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": 'attachment; filename="audit_report.pdf"'},
    )