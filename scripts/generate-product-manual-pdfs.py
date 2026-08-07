from pathlib import Path
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, PageBreak, Image

root=Path(__file__).resolve().parents[1]
out=root/'docs'/'product-manual'
styles=getSampleStyleSheet(); styles.add(ParagraphStyle(name='Brand',parent=styles['Title'],textColor=colors.HexColor('#09253b'),fontSize=26,leading=31)); styles.add(ParagraphStyle(name='H',parent=styles['Heading2'],textColor=colors.HexColor('#09253b'),spaceBefore=14)); styles.add(ParagraphStyle(name='Note',parent=styles['BodyText'],backColor=colors.HexColor('#fff6e8'),borderColor=colors.HexColor('#d98922'),borderWidth=1,borderPadding=8))
def footer(canvas,doc):
 canvas.saveState();canvas.setFillColor(colors.HexColor('#526273'));canvas.setFont('Helvetica',8);canvas.drawString(.7*inch,.45*inch,'Capture Tracker · Private pilot · Source f2f00e9');canvas.drawRightString(7.8*inch,.45*inch,str(doc.page));canvas.restoreState()
def build(path, quick=False):
 d=SimpleDocTemplate(str(path),pagesize=letter,rightMargin=.7*inch,leftMargin=.7*inch,topMargin=.65*inch,bottomMargin=.7*inch); s=[]
 s+=[Paragraph('CAPTURE TRACKER',styles['Heading3']),Paragraph('Product Manual' if not quick else 'Quick Start',styles['Brand']),Paragraph('SPENDING TRACKED. BUSINESS GROWN.',styles['Heading3']),Paragraph('Private-pilot client guide · Published 2026-08-06 · Source f2f00e9b4828180ad1a5d109243e7be3a0f430cb',styles['BodyText']),Spacer(1,12),Paragraph('<b>Private-pilot boundary.</b> Capture Tracker organizes recorded financial facts. It is not a CPA; it does not file taxes, send payments, run payroll, invoice, manage inventory, or offer public self-service onboarding. Upload trusted files only: malware scanning and quarantine are not currently performed.',styles['Note'])]
 sections=[('Start here','Sign in at the private URL supplied by the workspace owner. In an initialized production workspace, Create account is intentionally unavailable. There is no self-service password reset; contact the owner for access help.'),('Today','Use the read-only briefing for available business cash, tax planning, review work, documents, Weekly Review, and recent activity.'),('Money and Documents','Money records balanced activity. Documents stores private evidence. Upload PDF, JPEG, or PNG up to 10 MiB; review extraction and matching suggestions before linking. Suggestions never change accounting automatically.'),('Reports','Profit and Loss, Balance Sheet, Trial Balance, and Cash Activity use complete database-backed totals. Supporting detail may paginate without reducing totals. CSV protects formula-like content and can safely refuse a large export.'),('Taxes, Weekly Review, Reconciliation','Taxes is planning only. Weekly Review records acknowledgement but leaves unresolved work visible. Reconciliation finalizes only at $0.00 difference; matching does not create another transaction.'),('Ask AI, Activity, Settings','Ask AI is read-only and unavailable in real-data production until an approved provider exists. Activity is read-only history. Settings supports default report period, Weekly Review day, and document-retention target.'),('Mobile and safety','Add the site to Home Screen as a browser shortcut, not an app. Allow the camera only for trusted receipts. Sign out on shared devices.')]
 if quick: sections=sections[:4]+[sections[-1]]
 for h,t in sections:s+=[Paragraph(h,styles['H']),Paragraph(t,styles['BodyText'])]
 img=out/'images'/'local-demo-today-desktop.png'
 if img.exists():s += [Spacer(1,12),Image(str(img),width=6.6*inch,height=4.49*inch),Paragraph('Local fictional demo capture; all business data is synthetic.',styles['BodyText'])]
 d.build(s,onFirstPage=footer,onLaterPages=footer)
build(out/'CAPTURE_TRACKER_PRODUCT_MANUAL.pdf');build(out/'CAPTURE_TRACKER_QUICK_START.pdf',True)
