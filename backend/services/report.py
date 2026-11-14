from io import BytesIO
from datetime import datetime
from xml.sax.saxutils import escape

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import cm
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle

styles = getSampleStyleSheet()
cell = ParagraphStyle("cell", parent=styles["BodyText"], fontSize=8, leading=10)


def P(text):
    # Paragraph lets long text wrap inside table cells
    return Paragraph(escape(str(text)), cell)


def make_table(rows, widths):
    t = Table(rows, colWidths=widths, repeatRows=1)
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1f3a5f")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
        ("FONTSIZE", (0, 0), (-1, -1), 8),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
    ]))
    return t


def build_pdf(result: dict) -> bytes:
    buffer = BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4, leftMargin=2 * cm,
                            rightMargin=2 * cm, topMargin=2 * cm, bottomMargin=2 * cm)
    s = []

    # Title and basic info
    s.append(Paragraph("Data Quality Audit Report", styles["Title"]))
    s.append(Paragraph(f"File: {escape(result['filename'])}", styles["Normal"]))
    s.append(Paragraph(f"Generated: {datetime.now():%d %b %Y, %H:%M}", styles["Normal"]))
    s.append(Paragraph(f"Rows: {result['rows']} | Columns: {len(result['columns'])}", styles["Normal"]))
    s.append(Spacer(1, 14))

    # Score
    sc = result["score"]
    s.append(Paragraph("1. Data Quality Score", styles["Heading2"]))
    s.append(make_table([
        ["Overall", "Completeness", "Uniqueness", "Validity", "Flagged rows"],
        [sc["overall"], sc["completeness"], sc["uniqueness"], sc["validity"], sc.get("flagged_rows", 0)],
    ], [3.4 * cm] * 5))
    s.append(Spacer(1, 12))

    # Missing values
    s.append(Paragraph("2. Missing Values", styles["Heading2"]))
    rows = [["Column", "Missing count", "Missing %"]]
    for col, info in result["missing"]["columns"].items():
        rows.append([P(col), info["missing_count"], info["missing_percent"]])
    s.append(make_table(rows, [7 * cm, 4 * cm, 4 * cm]))
    s.append(Spacer(1, 12))

    # Duplicates
    d = result["duplicates"]
    s.append(Paragraph("3. Duplicate Records", styles["Heading2"]))
    s.append(Paragraph(
        f"{d['duplicate_count']} duplicate row(s); {d['rows_involved']} rows involved.",
        styles["Normal"]))
    s.append(Spacer(1, 12))

    # Anomalies
    a = result["anomalies"]
    s.append(Paragraph("4. Anomalies (statistical outliers)", styles["Heading2"]))
    if a["anomaly_count"] == 0:
        s.append(Paragraph("None found.", styles["Normal"]))
    else:
        rows = [["Row", "Column", "Value", "Expected range"]]
        for x in a["anomalies"][:30]:
            rows.append([x["row_number"], P(x["column"]), x["value"],
                         f"{x['expected_range'][0]} to {x['expected_range'][1]}"])
        s.append(make_table(rows, [2 * cm, 4 * cm, 4 * cm, 5 * cm]))
        if a["anomaly_count"] > 30:
            s.append(Paragraph(f"Showing 30 of {a['anomaly_count']}.", styles["Italic"]))
    s.append(Spacer(1, 12))

    # ML
    ml = result["ml_anomalies"]
    s.append(Paragraph("5. Unusual Records (machine learning)", styles["Heading2"]))
    if ml.get("ran"):
        s.append(Paragraph(f"Isolation Forest flagged {ml['anomaly_count']} unusual row(s).",
                           styles["Normal"]))
        rows = [["Row", "Anomaly score", "Values"]]
        for x in ml["anomalies"][:15]:
            rows.append([x["row_number"], x["anomaly_score"], P(x["values"])])
        s.append(make_table(rows, [2 * cm, 3 * cm, 11 * cm]))
    else:
        s.append(Paragraph(f"Not run: {escape(ml.get('reason', ''))}", styles["Normal"]))
    s.append(Spacer(1, 12))

    # Recommendations
    s.append(Paragraph("6. Recommendations", styles["Heading2"]))
    recs = result["recommendations"]
    if not recs:
        s.append(Paragraph("No issues found.", styles["Normal"]))
    else:
        rows = [["Severity", "Target", "Detail", "Action"]]
        for r in recs[:60]:
            rows.append([r["severity"], P(r["target"]), P(r["detail"]), P(r["action"])])
        s.append(make_table(rows, [2 * cm, 3.5 * cm, 4.5 * cm, 7 * cm]))

    doc.build(s)
    return buffer.getvalue()