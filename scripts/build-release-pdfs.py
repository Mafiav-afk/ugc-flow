from pathlib import Path
import re

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_RIGHT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    BaseDocTemplate,
    Frame,
    PageTemplate,
    Paragraph,
    Spacer,
    KeepTogether,
)

ROOT = Path(__file__).resolve().parents[1]
DOCS = ROOT / "docs"
SOURCES = [
    "UGC-Flow-软件操作说明",
    "UGC-Flow-API接入说明",
    "UGC-Flow-视频讲解脚本",
]

FONT_PATH = "/System/Library/Fonts/Supplemental/Arial Unicode.ttf"
FONT = "UGCFlowCJK"
RED = colors.HexColor("#D94236")
DARK = colors.HexColor("#20292F")
MUTED = colors.HexColor("#68727A")
PALE = colors.HexColor("#FFF3F1")

pdfmetrics.registerFont(TTFont(FONT, FONT_PATH))


def esc(text):
    return (text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;"))


def inline(text):
    text = esc(text)
    text = re.sub(r"`([^`]+)`", r'<font color="#9A332B">\1</font>', text)
    text = re.sub(r"\*\*([^*]+)\*\*", r"<b>\1</b>", text)
    return text


def styles():
    base = getSampleStyleSheet()
    return {
        "title": ParagraphStyle("title", parent=base["Title"], fontName=FONT, fontSize=22,
                                leading=29, textColor=DARK, spaceAfter=5 * mm),
        "strap": ParagraphStyle("strap", parent=base["Normal"], fontName=FONT, fontSize=8.5,
                                leading=11, textColor=RED, spaceAfter=2 * mm),
        "sub": ParagraphStyle("sub", parent=base["Normal"], fontName=FONT, fontSize=9.5,
                              leading=13, textColor=MUTED, spaceAfter=8 * mm),
        "h1": ParagraphStyle("h1", parent=base["Heading1"], fontName=FONT, fontSize=14,
                             leading=19, textColor=RED, spaceBefore=5 * mm, spaceAfter=2.5 * mm,
                             keepWithNext=True),
        "h2": ParagraphStyle("h2", parent=base["Heading2"], fontName=FONT, fontSize=11.5,
                             leading=16, textColor=DARK, spaceBefore=3.5 * mm, spaceAfter=1.8 * mm,
                             keepWithNext=True),
        "body": ParagraphStyle("body", parent=base["BodyText"], fontName=FONT, fontSize=9.1,
                               leading=13.6, textColor=DARK, spaceAfter=1.8 * mm),
        "bullet": ParagraphStyle("bullet", parent=base["BodyText"], fontName=FONT, fontSize=9.1,
                                 leading=13.6, textColor=DARK, leftIndent=5 * mm,
                                 firstLineIndent=-3.5 * mm, spaceAfter=1.2 * mm),
        "quote": ParagraphStyle("quote", parent=base["BodyText"], fontName=FONT, fontSize=9,
                                leading=14, textColor=DARK, backColor=PALE, borderPadding=6,
                                leftIndent=4 * mm, rightIndent=4 * mm, spaceBefore=2 * mm,
                                spaceAfter=3 * mm),
        "code": ParagraphStyle("code", parent=base["Code"], fontName=FONT, fontSize=7.4,
                               leading=10.8, textColor=DARK, backColor=colors.HexColor("#F5F6F8"),
                               borderPadding=6, leftIndent=2 * mm, rightIndent=2 * mm,
                               spaceBefore=2 * mm, spaceAfter=3 * mm),
    }


def header_footer(canvas, doc):
    canvas.saveState()
    canvas.setFont(FONT, 7.5)
    canvas.setFillColor(MUTED)
    canvas.drawString(18 * mm, A4[1] - 12 * mm, "UGC FLOW · 发布资料")
    canvas.drawRightString(A4[0] - 18 * mm, 10 * mm, f"第 {doc.page} 页")
    canvas.setStrokeColor(RED)
    canvas.setLineWidth(0.7)
    canvas.line(18 * mm, A4[1] - 16 * mm, A4[0] - 18 * mm, A4[1] - 16 * mm)
    canvas.restoreState()


def build(source):
    path = DOCS / f"{source}.md"
    lines = path.read_text(encoding="utf-8").splitlines()
    title = lines[0].removeprefix("# ").strip()
    st = styles()
    story = [
        Spacer(1, 4 * mm),
        Paragraph("UGC FLOW OPERATOR GUIDE", st["strap"]),
        Paragraph(esc(title), st["title"]),
        Paragraph("Mac 版 1.3.1 · Codex / Claude 智能体 + 图片与视频 API", st["sub"]),
    ]
    code = []
    in_code = False
    list_index = 0
    for raw in lines[1:]:
        line = raw.rstrip()
        if line.startswith("```"):
            if in_code:
                story.append(Paragraph(esc("\n".join(code)).replace("\n", "<br/>"), st["code"]))
                code = []
            in_code = not in_code
            continue
        if in_code:
            code.append(line)
            continue
        if not line:
            continue
        if line.startswith("## "):
            list_index = 0
            story.append(Paragraph(inline(line[3:]), st["h1"]))
        elif line.startswith("### "):
            list_index = 0
            story.append(Paragraph(inline(line[4:]), st["h2"]))
        elif re.match(r"^\d+\. ", line):
            list_index += 1
            body = re.sub(r"^\d+\. ", "", line)
            story.append(Paragraph(f"{list_index}.&nbsp;&nbsp;{inline(body)}", st["bullet"]))
        elif line.startswith("- "):
            story.append(Paragraph(f"•&nbsp;&nbsp;{inline(line[2:])}", st["bullet"]))
        elif line.startswith("> "):
            story.append(Paragraph(inline(line[2:]), st["quote"]))
        else:
            list_index = 0
            story.append(Paragraph(inline(line), st["body"]))

    out = DOCS / f"{source}.pdf"
    doc = BaseDocTemplate(str(out), pagesize=A4, leftMargin=18 * mm, rightMargin=18 * mm,
                          topMargin=19 * mm, bottomMargin=12 * mm,
                          title=title, author="UGC Flow")
    frame = Frame(doc.leftMargin, doc.bottomMargin, doc.width, doc.height, id="normal")
    doc.addPageTemplates([PageTemplate(id="guide", frames=frame, onPage=header_footer)])
    doc.build(story)
    print(out)


if __name__ == "__main__":
    for name in SOURCES:
        build(name)
