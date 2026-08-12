from __future__ import annotations

import html
import re
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import (
    HRFlowable,
    Image,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

ROOT = Path(__file__).resolve().parents[1]
DOCS = ROOT / "docs" / "product-manual"
NAVY = colors.HexColor("#09253b")
TEAL = colors.HexColor("#007f7b")
MUTED = colors.HexColor("#526273")
WARNING = colors.HexColor("#fff6e8")

styles = getSampleStyleSheet()
styles.add(ParagraphStyle(name="BrandTitle", parent=styles["Title"], textColor=NAVY, fontSize=25, leading=30, spaceAfter=10))
styles.add(ParagraphStyle(name="Section", parent=styles["Heading2"], textColor=NAVY, fontSize=16, leading=20, spaceBefore=14, spaceAfter=7))
styles.add(ParagraphStyle(name="Subsection", parent=styles["Heading3"], textColor=TEAL, fontSize=12, leading=16, spaceBefore=10, spaceAfter=5))
styles.add(ParagraphStyle(name="BodyCopy", parent=styles["BodyText"], textColor=colors.HexColor("#263746"), fontSize=9.5, leading=14, spaceAfter=7))
styles.add(ParagraphStyle(name="Callout", parent=styles["BodyCopy"], backColor=WARNING, borderColor=colors.HexColor("#d98922"), borderWidth=1, borderPadding=8, spaceBefore=5, spaceAfter=9))
styles.add(ParagraphStyle(name="Caption", parent=styles["BodyCopy"], textColor=MUTED, fontSize=8, leading=11, alignment=1))
styles.add(ParagraphStyle(name="TableCell", parent=styles["BodyCopy"], fontSize=8.5, leading=12, spaceAfter=0))
styles.add(ParagraphStyle(name="ListCopy", parent=styles["BodyCopy"], leftIndent=14, firstLineIndent=-10, spaceAfter=4))


def ascii_punctuation(value: str) -> str:
    return value.translate(str.maketrans({
        "\u2010": "-", "\u2011": "-", "\u2012": "-", "\u2013": "-", "\u2014": " - ",
        "\u2018": "'", "\u2019": "'", "\u201c": '"', "\u201d": '"', "\u2026": "...",
        "\u2192": "->", "\u2713": "complete",
    }))


def inline_markdown(value: str) -> str:
    code_spans = []
    def hold_code(match):
        code_spans.append(html.escape(ascii_punctuation(match.group(1))))
        return f"@@CODE{len(code_spans) - 1}@@"

    value = re.sub(r"`([^`]+)`", hold_code, ascii_punctuation(value.strip()))
    value = html.escape(value)
    value = re.sub(r"\[([^\]]+)\]\(([^)]+)\)", r'<link href="\2" color="#007f7b"><u>\1</u></link>', value)
    value = re.sub(r"\*\*([^*]+)\*\*", r"<b>\1</b>", value)
    value = re.sub(r"(?<!\*)\*([^*]+)\*(?!\*)", r"<i>\1</i>", value)
    for index, code in enumerate(code_spans):
        value = value.replace(f"@@CODE{index}@@", f'<font name="Courier">{code}</font>')
    return value


def inline_html(value: str) -> str:
    code_spans = []
    def hold_code(match):
        code_spans.append(html.escape(ascii_punctuation(match.group(1))))
        return f"@@CODE{len(code_spans) - 1}@@"

    value = re.sub(r"`([^`]+)`", hold_code, ascii_punctuation(value.strip()))
    value = html.escape(value)
    value = re.sub(r"\[([^\]]+)\]\(([^)]+)\)", r'<a href="\2">\1</a>', value)
    value = re.sub(r"\*\*([^*]+)\*\*", r"<strong>\1</strong>", value)
    value = re.sub(r"(?<!\*)\*([^*]+)\*(?!\*)", r"<em>\1</em>", value)
    for index, code in enumerate(code_spans):
        value = value.replace(f"@@CODE{index}@@", f"<code>{code}</code>")
    return value


def footer(canvas, document):
    canvas.saveState()
    canvas.setFillColor(MUTED)
    canvas.setFont("Helvetica", 8)
    canvas.drawString(0.7 * inch, 0.42 * inch, "Capture Tracker - Private pilot - V2.4")
    canvas.drawRightString(7.8 * inch, 0.42 * inch, str(document.page))
    canvas.restoreState()


def markdown_flowables(source: Path):
    lines = source.read_text(encoding="utf-8").splitlines()
    story = []
    index = 0
    first_heading = True
    while index < len(lines):
        line = lines[index].strip()
        if not line:
            index += 1
            continue
        if line == "---":
            story.extend([Spacer(1, 4), HRFlowable(width="100%", thickness=0.5, color=colors.HexColor("#d7dee5")), Spacer(1, 4)])
            index += 1
            continue
        image_match = re.match(r"!\[([^]]*)\]\(([^)]+)\)", line)
        if image_match:
            image_path = source.parent / image_match.group(2)
            if image_path.exists():
                graphic = Image(str(image_path))
                max_width, max_height = 6.7 * inch, 4.3 * inch
                ratio = min(max_width / graphic.imageWidth, max_height / graphic.imageHeight)
                graphic.drawWidth = graphic.imageWidth * ratio
                graphic.drawHeight = graphic.imageHeight * ratio
                story.extend([Spacer(1, 7), graphic, Paragraph(inline_markdown(image_match.group(1)), styles["Caption"])])
            index += 1
            continue
        if line.startswith("#"):
            level = len(line) - len(line.lstrip("#"))
            title = line[level:].strip()
            style = styles["BrandTitle"] if first_heading else styles["Section"] if level == 2 else styles["Subsection"]
            story.append(Paragraph(inline_markdown(title), style))
            first_heading = False
            index += 1
            continue
        if line.startswith(">"):
            block = []
            while index < len(lines) and lines[index].strip().startswith(">"):
                block.append(lines[index].strip().lstrip("> "))
                index += 1
            story.append(Paragraph(inline_markdown(" ".join(block)), styles["Callout"]))
            continue
        if line.startswith("|") and index + 1 < len(lines) and re.match(r"^\|?[\s:|-]+\|", lines[index + 1].strip()):
            rows = []
            while index < len(lines) and lines[index].strip().startswith("|"):
                cells = [cell.strip() for cell in lines[index].strip().strip("|").split("|")]
                if not all(re.fullmatch(r"[: -]+", cell) for cell in cells):
                    rows.append([Paragraph(inline_markdown(cell), styles["TableCell"]) for cell in cells])
                index += 1
            widths = [2.15 * inch, 4.55 * inch] if rows and len(rows[0]) == 2 else None
            table = Table(rows, colWidths=widths, repeatRows=1, hAlign="LEFT")
            table.setStyle(TableStyle([
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#e9f6f5")),
                ("TEXTCOLOR", (0, 0), (-1, 0), NAVY),
                ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#ccd6df")),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 6), ("RIGHTPADDING", (0, 0), (-1, -1), 6),
                ("TOPPADDING", (0, 0), (-1, -1), 5), ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
            ]))
            story.extend([table, Spacer(1, 8)])
            continue
        list_match = re.match(r"^(?:[-*]|\d+\.)\s+(.+)", line)
        if list_match:
            ordered = bool(re.match(r"^\d+\.", line))
            item_number = 1
            while index < len(lines):
                current = lines[index].strip()
                match = re.match(r"^(?:[-*]|\d+\.)\s+(.+)", current)
                if not match:
                    break
                label = f"{item_number}." if ordered else "-"
                story.append(Paragraph(f"{label} {inline_markdown(match.group(1))}", styles["ListCopy"]))
                item_number += 1
                index += 1
            story.append(Spacer(1, 2))
            continue
        paragraph = [line]
        index += 1
        while index < len(lines) and lines[index].strip() and not re.match(r"^(#|>|!\[|\||[-*]\s|\d+\.\s|---$)", lines[index].strip()):
            paragraph.append(lines[index].strip())
            index += 1
        story.append(Paragraph(inline_markdown(" ".join(paragraph)), styles["BodyCopy"]))
    return story


def build(markdown_name: str, pdf_name: str):
    document = SimpleDocTemplate(
        str(DOCS / pdf_name),
        pagesize=letter,
        rightMargin=0.7 * inch,
        leftMargin=0.7 * inch,
        topMargin=0.6 * inch,
        bottomMargin=0.68 * inch,
        title=pdf_name.replace("_", " ").removesuffix(".pdf").title(),
        author="Capture Tracker",
    )
    document.build(markdown_flowables(DOCS / markdown_name), onFirstPage=footer, onLaterPages=footer)


def build_html(markdown_name: str, html_name: str):
    lines = (DOCS / markdown_name).read_text(encoding="utf-8").splitlines()
    body = []
    index = 0
    while index < len(lines):
        line = lines[index].strip()
        if not line:
            index += 1
            continue
        if line == "---":
            body.append("<hr>")
            index += 1
            continue
        if line.startswith("#"):
            level = min(3, len(line) - len(line.lstrip("#")))
            body.append(f"<h{level}>{inline_html(line[level:].strip())}</h{level}>")
            index += 1
            continue
        if line.startswith(">"):
            block = []
            while index < len(lines) and lines[index].strip().startswith(">"):
                block.append(lines[index].strip().lstrip("> "))
                index += 1
            body.append(f"<aside>{inline_html(' '.join(block))}</aside>")
            continue
        if line.startswith("|") and index + 1 < len(lines) and re.match(r"^\|?[\s:|-]+\|", lines[index + 1].strip()):
            rows = []
            while index < len(lines) and lines[index].strip().startswith("|"):
                cells = [cell.strip() for cell in lines[index].strip().strip("|").split("|")]
                if not all(re.fullmatch(r"[: -]+", cell) for cell in cells):
                    rows.append(cells)
                index += 1
            table_rows = []
            for row_index, row in enumerate(rows):
                tag = "th" if row_index == 0 else "td"
                table_rows.append("<tr>" + "".join(f"<{tag}>{inline_html(cell)}</{tag}>" for cell in row) + "</tr>")
            body.append("<table>" + "".join(table_rows) + "</table>")
            continue
        list_match = re.match(r"^(?:[-*]|\d+\.)\s+(.+)", line)
        if list_match:
            ordered = bool(re.match(r"^\d+\.", line))
            items = []
            while index < len(lines):
                match = re.match(r"^(?:[-*]|\d+\.)\s+(.+)", lines[index].strip())
                if not match:
                    break
                items.append(f"<li>{inline_html(match.group(1))}</li>")
                index += 1
            tag = "ol" if ordered else "ul"
            body.append(f"<{tag}>{''.join(items)}</{tag}>")
            continue
        paragraph = [line]
        index += 1
        while index < len(lines) and lines[index].strip() and not re.match(r"^(#|>|\||[-*]\s|\d+\.\s|---$)", lines[index].strip()):
            paragraph.append(lines[index].strip())
            index += 1
        body.append(f"<p>{inline_html(' '.join(paragraph))}</p>")

    page = """<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Capture Tracker Product Manual</title><style>
body{margin:0;background:#f4f7f9;color:#263746;font:16px/1.6 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}main{box-sizing:border-box;max-width:980px;margin:auto;background:white;min-height:100vh;padding:48px 64px 72px}h1,h2,h3{color:#09253b;line-height:1.2}h1{font-size:2.5rem}h2{margin-top:2.2rem;padding-bottom:.4rem;border-bottom:2px solid #13a6a0}h3{color:#007f7b}a{color:#007f7b}aside{border-left:5px solid #d98922;background:#fff6e8;padding:14px 18px;margin:1rem 0}table{width:100%;border-collapse:collapse;margin:1rem 0}th,td{border:1px solid #ccd6df;padding:9px;text-align:left;vertical-align:top}th{background:#e9f6f5;color:#09253b}code{background:#eef2f5;padding:.1rem .25rem;border-radius:.2rem}@media(max-width:640px){main{padding:28px 20px}h1{font-size:2rem}table{font-size:.86rem}}
</style></head><body><main>""" + "".join(body) + "</main></body></html>\n"
    (DOCS / html_name).write_text(page, encoding="utf-8")


build("CAPTURE_TRACKER_PRODUCT_MANUAL.md", "CAPTURE_TRACKER_PRODUCT_MANUAL.pdf")
build("CAPTURE_TRACKER_QUICK_START.md", "CAPTURE_TRACKER_QUICK_START.pdf")
build_html("CAPTURE_TRACKER_PRODUCT_MANUAL.md", "CAPTURE_TRACKER_PRODUCT_MANUAL.html")
