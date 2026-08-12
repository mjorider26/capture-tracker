"""Render the checked-in customer Markdown guides to branded PDF/HTML artifacts."""

from __future__ import annotations

import html
import re
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import (
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

ROOT = Path(__file__).resolve().parents[1]
DOCS = ROOT / "docs" / "product-manual"
NAVY = colors.HexColor("#09253B")
TEAL = colors.HexColor("#008F89")
INK = colors.HexColor("#263746")
MUTED = colors.HexColor("#536675")
PALE_TEAL = colors.HexColor("#E9F6F5")
PALE_GOLD = colors.HexColor("#FFF6E8")
BORDER = colors.HexColor("#CCD6DF")


def ascii_text(value: str) -> str:
    replacements = {
        "\u2192": " -> ", "\u2014": " - ", "\u2013": "-", "\u2011": "-",
        "\u2018": "'", "\u2019": "'", "\u201c": '"', "\u201d": '"',
        "\u2026": "...", "\u00b7": " - ", "\u00a0": " ",
    }
    for source, target in replacements.items():
        value = value.replace(source, target)
    return value


def inline(value: str) -> str:
    escaped = html.escape(ascii_text(value), quote=False)
    return re.sub(r"\*\*(.+?)\*\*", r"<b>\1</b>", escaped)


def parse_table(lines: list[str]) -> list[list[str]]:
    return [[cell.strip() for cell in line.strip().strip("|").split("|")] for line in lines]


def markdown_blocks(source: str):
    lines = source.replace("\r\n", "\n").split("\n")
    index = 0
    paragraph: list[str] = []

    def flush():
        nonlocal paragraph
        if paragraph:
            yield ("paragraph", " ".join(part.strip() for part in paragraph))
            paragraph = []

    while index < len(lines):
        line = lines[index].rstrip()
        if not line.strip():
            yield from flush()
            index += 1
            continue
        if line.startswith("| "):
            yield from flush()
            table_lines = []
            while index < len(lines) and lines[index].lstrip().startswith("|"):
                table_lines.append(lines[index])
                index += 1
            rows = parse_table(table_lines)
            if len(rows) > 1 and all(re.fullmatch(r":?-{3,}:?", cell) for cell in rows[1]):
                rows.pop(1)
            yield ("table", rows)
            continue
        if line.startswith("# "):
            yield from flush()
            yield ("h1", line[2:].strip())
        elif line.startswith("## "):
            yield from flush()
            yield ("h2", line[3:].strip())
        elif line.startswith("### "):
            yield from flush()
            yield ("h3", line[4:].strip())
        elif line.startswith("> "):
            yield from flush()
            quote = [line[2:].strip()]
            index += 1
            while index < len(lines) and lines[index].startswith("> "):
                quote.append(lines[index][2:].strip())
                index += 1
            yield ("aside", " ".join(quote))
            continue
        elif re.match(r"^- ", line):
            yield from flush()
            yield ("bullet", line[2:].strip())
        elif re.match(r"^\d+\. ", line):
            yield from flush()
            number, content = line.split(". ", 1)
            yield ("number", f"{number}. {content}")
        else:
            paragraph.append(line)
        index += 1
    yield from flush()


def styles():
    base = getSampleStyleSheet()
    return {
        "h1": ParagraphStyle("CT H1", parent=base["Title"], fontName="Helvetica-Bold", fontSize=23, leading=28, textColor=NAVY, spaceAfter=15),
        "h2": ParagraphStyle("CT H2", parent=base["Heading2"], fontName="Helvetica-Bold", fontSize=14.5, leading=18, textColor=NAVY, spaceBefore=12, spaceAfter=7, borderColor=TEAL, borderWidth=0, borderPadding=0, keepWithNext=True),
        "h3": ParagraphStyle("CT H3", parent=base["Heading3"], fontName="Helvetica-Bold", fontSize=11.5, leading=15, textColor=TEAL, spaceBefore=8, spaceAfter=4),
        "body": ParagraphStyle("CT Body", parent=base["BodyText"], fontName="Helvetica", fontSize=8.65, leading=12.1, textColor=INK, spaceAfter=6),
        "bullet": ParagraphStyle("CT Bullet", parent=base["BodyText"], fontName="Helvetica", fontSize=8.55, leading=11.7, textColor=INK, leftIndent=13, firstLineIndent=-9, spaceAfter=3),
        "aside": ParagraphStyle("CT Aside", parent=base["BodyText"], fontName="Helvetica", fontSize=8.35, leading=11.5, textColor=INK, backColor=PALE_GOLD, borderColor=colors.HexColor("#D98922"), borderWidth=0.7, borderPadding=8, spaceBefore=3, spaceAfter=8),
        "table": ParagraphStyle("CT Table", parent=base["BodyText"], fontName="Helvetica", fontSize=7.35, leading=9.6, textColor=INK),
        "table_head": ParagraphStyle("CT Table Head", parent=base["BodyText"], fontName="Helvetica-Bold", fontSize=7.4, leading=9.6, textColor=NAVY),
    }


def footer(canvas, document):
    canvas.saveState()
    canvas.setStrokeColor(colors.HexColor("#D8E2E8"))
    canvas.line(0.7 * inch, 0.48 * inch, 7.8 * inch, 0.48 * inch)
    canvas.setFont("Helvetica", 7)
    canvas.setFillColor(MUTED)
    canvas.drawString(0.7 * inch, 0.31 * inch, "Capture Tracker - SPENDING TRACKED. BUSINESS GROWN.")
    canvas.drawRightString(7.8 * inch, 0.31 * inch, f"Page {document.page}")
    canvas.restoreState()


def render_pdf(markdown_path: Path, pdf_path: Path, title: str):
    sheet = styles()
    story = []
    for kind, value in markdown_blocks(markdown_path.read_text(encoding="utf-8")):
        if kind in {"h1", "h2", "h3"}:
            story.append(Paragraph(inline(value), sheet[kind]))
            if kind == "h2":
                rule = Table([[""]], colWidths=[7.1 * inch], rowHeights=[1.2], style=TableStyle([("BACKGROUND", (0, 0), (-1, -1), TEAL), ("LINEBELOW", (0, 0), (-1, -1), 0, TEAL)]))
                rule.keepWithNext = True
                gap = Spacer(1, 4)
                gap.keepWithNext = True
                story.extend([rule, gap])
        elif kind == "paragraph":
            story.append(Paragraph(inline(value), sheet["body"]))
        elif kind == "aside":
            story.append(Paragraph(inline(value), sheet["aside"]))
        elif kind == "bullet":
            story.append(Paragraph(inline(value), sheet["bullet"], bulletText="-"))
        elif kind == "number":
            story.append(Paragraph(inline(value), sheet["bullet"]))
        elif kind == "table":
            rows = [[Paragraph(inline(cell), sheet["table_head"] if row_index == 0 else sheet["table"]) for cell in row] for row_index, row in enumerate(value)]
            columns = len(rows[0]) if rows else 1
            widths = [7.1 * inch / columns] * columns
            table = Table(rows, colWidths=widths, repeatRows=1, hAlign="LEFT")
            table.setStyle(TableStyle([
                ("BACKGROUND", (0, 0), (-1, 0), PALE_TEAL),
                ("GRID", (0, 0), (-1, -1), 0.35, BORDER),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 5),
                ("RIGHTPADDING", (0, 0), (-1, -1), 5),
                ("TOPPADDING", (0, 0), (-1, -1), 4),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ]))
            story.extend([table, Spacer(1, 7)])
    document = SimpleDocTemplate(str(pdf_path), pagesize=letter, title=title, author="Capture Tracker", rightMargin=0.7 * inch, leftMargin=0.7 * inch, topMargin=0.62 * inch, bottomMargin=0.62 * inch)
    document.build(story, onFirstPage=footer, onLaterPages=footer)


def render_html(markdown_path: Path, html_path: Path, title: str):
    body = []
    in_list = False
    for kind, value in markdown_blocks(markdown_path.read_text(encoding="utf-8")):
        if kind == "bullet":
            if not in_list:
                body.append("<ul>")
                in_list = True
            body.append(f"<li>{inline(value)}</li>")
            continue
        if in_list:
            body.append("</ul>")
            in_list = False
        if kind in {"h1", "h2", "h3"}:
            body.append(f"<{kind}>{inline(value)}</{kind}>")
        elif kind == "paragraph" or kind == "number":
            body.append(f"<p>{inline(value)}</p>")
        elif kind == "aside":
            body.append(f"<aside>{inline(value)}</aside>")
        elif kind == "table":
            body.append("<table>")
            for row_index, row in enumerate(value):
                tag = "th" if row_index == 0 else "td"
                body.append("<tr>" + "".join(f"<{tag}>{inline(cell)}</{tag}>" for cell in row) + "</tr>")
            body.append("</table>")
    if in_list:
        body.append("</ul>")
    css = 'body{margin:0;background:#f4f7f9;color:#263746;font:16px/1.6 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}main{box-sizing:border-box;max-width:980px;margin:auto;background:white;min-height:100vh;padding:48px 64px 72px}h1,h2,h3{color:#09253b;line-height:1.2}h1{font-size:2.5rem}h2{margin-top:2.2rem;padding-bottom:.4rem;border-bottom:2px solid #13a6a0}h3{color:#007f7b}aside{border-left:5px solid #d98922;background:#fff6e8;padding:14px 18px;margin:1rem 0}table{width:100%;border-collapse:collapse;margin:1rem 0}th,td{border:1px solid #ccd6df;padding:9px;text-align:left;vertical-align:top}th{background:#e9f6f5;color:#09253b}@media(max-width:640px){main{padding:28px 20px}h1{font-size:2rem}table{font-size:.86rem}}'
    html_path.write_text(f'<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>{html.escape(title)}</title><style>{css}</style></head><body><main>{"".join(body)}</main></body></html>\n', encoding="utf-8")


def main():
    manual = DOCS / "CAPTURE_TRACKER_PRODUCT_MANUAL.md"
    quick = DOCS / "CAPTURE_TRACKER_QUICK_START.md"
    render_pdf(manual, DOCS / "CAPTURE_TRACKER_PRODUCT_MANUAL.pdf", "Capture Tracker Product Manual")
    render_html(manual, DOCS / "CAPTURE_TRACKER_PRODUCT_MANUAL.html", "Capture Tracker Product Manual")
    render_pdf(quick, DOCS / "CAPTURE_TRACKER_QUICK_START.pdf", "How to Run Your Books")


if __name__ == "__main__":
    main()
