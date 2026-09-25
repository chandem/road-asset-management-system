"""PDF export for RoadMI portfolio reports."""

from io import BytesIO
from datetime import date

from fastapi.responses import StreamingResponse
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle


def _table(headers, rows):
    data = [headers] + (rows or [["No records"]] if not rows else rows)
    style = TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1f3b4d")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 8),
        ("GRID", (0, 0), (-1, -1), 0.25, colors.grey),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f4f7f8")]),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 4),
        ("RIGHTPADDING", (0, 0), (-1, -1), 4),
    ])
    table = Table(data, repeatRows=1)
    table.setStyle(style)
    return table


def build_reports_pdf(maint: dict, condition: dict, defects: dict, costs: dict) -> StreamingResponse:
    buffer = BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4, leftMargin=14 * mm, rightMargin=14 * mm, topMargin=14 * mm, bottomMargin=14 * mm)
    styles = getSampleStyleSheet()
    story = [
        Paragraph("RoadMI — Road Asset Management System", styles["Title"]),
        Paragraph(f"Portfolio report — {date.today().isoformat()}", styles["Normal"]),
        Spacer(1, 8),
    ]

    ms = maint.get("summary") or {}
    story.append(Paragraph("Maintenance summary", styles["Heading2"]))
    story.append(_table(
        ["Activities", "Completed", "Estimated", "Actual"],
        [[ms.get("activity_count"), ms.get("completed_count"), ms.get("estimated_cost"), ms.get("actual_cost")]],
    ))
    story.append(Spacer(1, 8))
    story.append(_table(
        ["Road", "Activity", "Priority", "Status", "Estimated", "Actual"],
        [
            [i.get("road_code"), i.get("activity_type"), i.get("priority") or "—", i.get("status"), i.get("estimated_cost"), i.get("actual_cost")]
            for i in (maint.get("items") or [])[:80]
        ],
    ))

    story.append(Paragraph("Road condition", styles["Heading2"]))
    story.append(_table(
        ["Road", "Sections", "Average", "Min", "Max"],
        [
            [f"{i.get('road_code')} {i.get('road_name') or ''}".strip(), i.get("section_count"), i.get("average_condition"), i.get("minimum_condition"), i.get("maximum_condition")]
            for i in (condition.get("items") or [])
        ],
    ))

    ds = defects.get("summary") or {}
    story.append(Paragraph(f"Defects ({ds.get('defect_count', 0)})", styles["Heading2"]))
    story.append(_table(
        ["Road", "Type", "Severity", "Chainage", "Detected by"],
        [
            [i.get("road_code") or "—", i.get("defect_type"), i.get("severity") or "—", i.get("chainage_km"), i.get("detected_by")]
            for i in (defects.get("items") or [])[:80]
        ],
    ))

    cs = costs.get("summary") or {}
    story.append(Paragraph("Costs & budget", styles["Heading2"]))
    story.append(_table(
        ["Budget", "Estimated", "Actual", "Remaining", "Utilization %"],
        [[cs.get("budget"), cs.get("estimated_cost"), cs.get("actual_cost"), cs.get("remaining_budget"), cs.get("budget_utilization_percent")]],
    ))

    doc.build(story)
    buffer.seek(0)
    return StreamingResponse(
        buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": "attachment; filename=roadams-reports.pdf"},
    )
