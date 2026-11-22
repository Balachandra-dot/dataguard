import json

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from auth import current_user
from db import Analysis, get_db
from services.report import build_pdf

router = APIRouter(tags=["history"])


def uid(claims: dict) -> int:
    user_id = claims.get("id")
    if user_id is None:
        raise HTTPException(status_code=401, detail="Please sign in again.")
    return int(user_id)


def iso(dt) -> str:
    return dt.replace(tzinfo=None).isoformat() + "Z"


def summary(a: Analysis) -> dict:
    return {
        "id": a.id,
        "filename": a.filename,
        "rows": a.rows,
        "columns": a.cols,
        "score": a.score,
        "issues": a.issues,
        "created_at": iso(a.created_at),
    }


def save_analysis(db: Session, user_id: int, result: dict) -> int:
    issues = (
        result["missing"]["total_missing_cells"]
        + result["duplicates"]["duplicate_count"]
        + result["anomalies"]["anomaly_count"]
    )
    row = Analysis(
        user_id=user_id,
        filename=result["filename"][:255],
        rows=result["rows"],
        cols=len(result["columns"]),
        score=float(result["score"]["overall"]),
        issues=int(issues),
        result_json=json.dumps(result, default=str),
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row.id


def owned(db: Session, claims: dict, analysis_id: int) -> Analysis:
    a = db.get(Analysis, analysis_id)
    if a is None or a.user_id != uid(claims):
        raise HTTPException(status_code=404, detail="Analysis not found.")
    return a


@router.get("/analyses")
def list_analyses(q: str = "", claims: dict = Depends(current_user), db: Session = Depends(get_db)):
    stmt = select(Analysis).where(Analysis.user_id == uid(claims))
    if q.strip():
        stmt = stmt.where(Analysis.filename.ilike(f"%{q.strip()}%"))
    rows = db.scalars(stmt.order_by(Analysis.created_at.desc()).limit(200)).all()
    return [summary(a) for a in rows]


@router.get("/analyses/{analysis_id}")
def get_analysis(analysis_id: int, claims: dict = Depends(current_user), db: Session = Depends(get_db)):
    a = owned(db, claims, analysis_id)
    result = json.loads(a.result_json)
    result["analysis_id"] = a.id
    result["created_at"] = iso(a.created_at)
    return result


@router.get("/analyses/{analysis_id}/report")
def analysis_report(analysis_id: int, claims: dict = Depends(current_user), db: Session = Depends(get_db)):
    a = owned(db, claims, analysis_id)
    pdf_bytes = build_pdf(json.loads(a.result_json))
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": 'attachment; filename="audit_report.pdf"'},
    )


@router.delete("/analyses/{analysis_id}")
def delete_analysis(analysis_id: int, claims: dict = Depends(current_user), db: Session = Depends(get_db)):
    a = owned(db, claims, analysis_id)
    db.delete(a)
    db.commit()
    return {"ok": True}


@router.delete("/analyses")
def clear_history(claims: dict = Depends(current_user), db: Session = Depends(get_db)):
    db.execute(delete(Analysis).where(Analysis.user_id == uid(claims)))
    db.commit()
    return {"ok": True}