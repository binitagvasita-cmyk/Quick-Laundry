"""
============================================
INVOICE ROUTES  -  Quick Laundry
Admin : POST /api/admin/invoices/generate/<order_id>
Admin : GET  /api/admin/invoices/status/<order_id>
User  : GET  /api/invoices/<order_id>/check
User  : GET  /api/invoices/<order_id>/download

Pattern mirrors:
  admin_order.py   -> admin_required  + get_db + pymysql.cursors
  orders_routes.py -> token_required  + get_db_connection
============================================
"""

from flask import Blueprint, request, jsonify, make_response
from database.db import get_db                              # same as admin_order.py
from database.db import get_db        # same as orders_routes.py
from utils.auth_middleware import admin_required            # same as admin_order.py
from middleware.auth_middleware import token_required       # same as orders_routes.py
from datetime import datetime
import pymysql.cursors
import traceback
import io

invoice_bp = Blueprint('invoice', __name__)


# =============================================================
#  PDF BUILDER  (pip install reportlab)
# =============================================================

def _build_pdf(inv, order, items):
    from reportlab.lib.pagesizes import A4
    from reportlab.lib import colors
    from reportlab.lib.units import mm
    from reportlab.platypus import (
        SimpleDocTemplate, Paragraph, Spacer,
        Table, TableStyle, HRFlowable, KeepTogether
    )
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.enums import TA_CENTER, TA_RIGHT, TA_LEFT
    from reportlab.platypus.flowables import HRFlowable

    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4,
        leftMargin=15*mm, rightMargin=15*mm,
        topMargin=0*mm,   bottomMargin=12*mm)

    # ── Palette ───────────────────────────────────────────────
    INDIGO     = colors.HexColor('#6366f1')
    INDIGO_DK  = colors.HexColor('#4338ca')
    PURPLE     = colors.HexColor('#8b5cf6')
    SLATE      = colors.HexColor('#1e293b')
    DARK       = colors.HexColor('#0f172a')
    MUTED      = colors.HexColor('#64748b')
    LIGHT_BG   = colors.HexColor('#f8faff')
    INDIGO_BG  = colors.HexColor('#eef2ff')
    BORDER     = colors.HexColor('#e0e7ff')
    GREEN      = colors.HexColor('#059669')
    GREEN_BG   = colors.HexColor('#d1fae5')
    AMBER      = colors.HexColor('#d97706')
    AMBER_BG   = colors.HexColor('#fef3c7')
    WHITE      = colors.white

    W, _H = A4
    CW = W - 30*mm      # usable content width
    SS = getSampleStyleSheet()

    # unique name counter to avoid ParagraphStyle name conflicts
    _uid = [0]
    def ps(**kw):
        _uid[0] += 1
        name = f'ql_style_{_uid[0]}'
        base = kw.pop('parent', 'Normal')
        return ParagraphStyle(name, parent=SS[base], **kw)

    elems = []

    # ══════════════════════════════════════════════════════════
    # 1. HERO HEADER  — full-width gradient-look banner
    # ══════════════════════════════════════════════════════════
    # Top accent strip
    accent = Table([['']], colWidths=[CW])
    accent.setStyle(TableStyle([
        ('BACKGROUND',   (0,0),(-1,-1), PURPLE),
        ('TOPPADDING',   (0,0),(-1,-1), 3),
        ('BOTTOMPADDING',(0,0),(-1,-1), 3),
        ('LEFTPADDING',  (0,0),(-1,-1), 0),
        ('RIGHTPADDING', (0,0),(-1,-1), 0),
    ]))

    # Main header band
    hdr_inner = Table([
        [Paragraph('Quick Laundry',
                   ps(fontSize=28, textColor=WHITE, fontName='Helvetica-Bold',
                      alignment=TA_CENTER, spaceAfter=2))],
        [Paragraph('Premium Laundry &amp; Dry Cleaning Services',
                   ps(fontSize=10, textColor=colors.HexColor('#c7d2fe'),
                      alignment=TA_CENTER))],
    ], colWidths=[CW])
    hdr_inner.setStyle(TableStyle([
        ('BACKGROUND',    (0,0),(-1,-1), INDIGO),
        ('TOPPADDING',    (0,0),(-1,-1), 18),
        ('BOTTOMPADDING', (0,0),(-1,-1), 6),
        ('LEFTPADDING',   (0,0),(-1,-1), 0),
        ('RIGHTPADDING',  (0,0),(-1,-1), 0),
    ]))

    # Invoice badge inside header
    issued = (inv['created_at'].strftime('%d %b %Y')
              if hasattr(inv.get('created_at'), 'strftime')
              else str(inv.get('created_at', '')))
    pay_st_raw = inv.get('payment_status') or 'pending'
    pay_st     = pay_st_raw.replace('_', ' ').upper()
    is_paid    = pay_st_raw in ('paid', 'cash_received')
    st_color   = GREEN   if is_paid else AMBER
    st_bg      = GREEN_BG if is_paid else AMBER_BG

    badge_row = Table([[
        Paragraph('INVOICE',
                  ps(fontSize=13, textColor=colors.HexColor('#c7d2fe'),
                     fontName='Helvetica-Bold', alignment=TA_CENTER)),
        Paragraph(inv['invoice_number'],
                  ps(fontSize=13, textColor=WHITE,
                     fontName='Helvetica-Bold', alignment=TA_CENTER)),
        Paragraph(issued,
                  ps(fontSize=10, textColor=colors.HexColor('#c7d2fe'),
                     alignment=TA_CENTER)),
    ]], colWidths=[CW*0.25, CW*0.45, CW*0.30])
    badge_row.setStyle(TableStyle([
        ('BACKGROUND',    (0,0),(-1,-1), INDIGO_DK),
        ('TOPPADDING',    (0,0),(-1,-1), 10),
        ('BOTTOMPADDING', (0,0),(-1,-1), 10),
        ('LEFTPADDING',   (0,0),(-1,-1), 8),
        ('RIGHTPADDING',  (0,0),(-1,-1), 8),
        ('LINEABOVE',     (0,0),(-1,0), 0.5, colors.HexColor('#818cf8')),
    ]))

    elems += [accent, hdr_inner, badge_row, Spacer(1, 6*mm)]

    # ══════════════════════════════════════════════════════════
    # 2. CUSTOMER + PAYMENT STATUS  (side by side)
    # ══════════════════════════════════════════════════════════
    cn   = order.get('customer_name',  'N/A')
    ce   = order.get('customer_email', 'N/A')
    cp   = order.get('customer_phone', 'N/A')
    addr = order.get('pickup_address', 'N/A')

    lbl_s = ps(fontSize=7.5, textColor=INDIGO, fontName='Helvetica-Bold',
               spaceAfter=3, spaceBefore=0)
    val_s = ps(fontSize=10,  textColor=DARK,   fontName='Helvetica-Bold')
    sub_s = ps(fontSize=8.5, textColor=MUTED,  leading=13)

    # Payment status pill
    status_pill = Table([[
        Paragraph(f'&#9679; {pay_st}',
                  ps(fontSize=10, textColor=st_color,
                     fontName='Helvetica-Bold', alignment=TA_CENTER))
    ]], colWidths=[CW*0.42])
    status_pill.setStyle(TableStyle([
        ('BACKGROUND',    (0,0),(-1,-1), st_bg),
        ('ROUNDEDCORNERS',[8]),
        ('TOPPADDING',    (0,0),(-1,-1), 6),
        ('BOTTOMPADDING', (0,0),(-1,-1), 6),
        ('LEFTPADDING',   (0,0),(-1,-1), 10),
        ('RIGHTPADDING',  (0,0),(-1,-1), 10),
    ]))

    order_num_box = Table([[
        Paragraph('ORDER', lbl_s)],
        [Paragraph(order['order_number'],
                   ps(fontSize=9, textColor=DARK, fontName='Helvetica-Bold'))],
    ], colWidths=[CW*0.42])
    order_num_box.setStyle(TableStyle([
        ('TOPPADDING',   (0,0),(-1,-1), 4),
        ('BOTTOMPADDING',(0,0),(-1,-1), 4),
        ('LEFTPADDING',  (0,0),(-1,-1), 0),
        ('RIGHTPADDING', (0,0),(-1,-1), 0),
    ]))

    right_col = Table([
        [Paragraph('PAYMENT STATUS', lbl_s)],
        [status_pill],
        [Spacer(1, 3*mm)],
        [order_num_box],
    ], colWidths=[CW*0.44])
    right_col.setStyle(TableStyle([
        ('TOPPADDING',   (0,0),(-1,-1), 0),
        ('BOTTOMPADDING',(0,0),(-1,-1), 0),
        ('LEFTPADDING',  (0,0),(-1,-1), 0),
        ('RIGHTPADDING', (0,0),(-1,-1), 0),
    ]))

    info_2col = Table([[
        # Left: billed to
        Table([
            [Paragraph('BILLED TO', lbl_s)],
            [Paragraph(f'<b>{cn}</b>', ps(fontSize=11, textColor=DARK, fontName='Helvetica-Bold'))],
            [Paragraph(ce, sub_s)],
            [Paragraph(cp, sub_s)],
            [Spacer(1, 3*mm)],
            [Paragraph('PICKUP ADDRESS', lbl_s)],
            [Paragraph(addr, ps(fontSize=8.5, textColor=SLATE, leading=13))],
        ], colWidths=[CW*0.52]),
        # Right: status + order
        right_col,
    ]], colWidths=[CW*0.56, CW*0.44])
    info_2col.setStyle(TableStyle([
        ('BACKGROUND',   (0,0),(0,-1), LIGHT_BG),
        ('BACKGROUND',   (1,0),(1,-1), INDIGO_BG),
        ('BOX',          (0,0),(0,-1), 0.5, BORDER),
        ('BOX',          (1,0),(1,-1), 0.5, BORDER),
        ('ROUNDEDCORNERS',[6]),
        ('TOPPADDING',   (0,0),(-1,-1), 10),
        ('BOTTOMPADDING',(0,0),(-1,-1), 10),
        ('LEFTPADDING',  (0,0),(-1,-1), 12),
        ('RIGHTPADDING', (0,0),(-1,-1), 12),
        ('VALIGN',       (0,0),(-1,-1), 'TOP'),
    ]))
    elems += [info_2col, Spacer(1, 6*mm)]

    # ══════════════════════════════════════════════════════════
    # 3. ITEMS TABLE
    # ══════════════════════════════════════════════════════════
    th  = ps(fontSize=8.5, textColor=WHITE, fontName='Helvetica-Bold')
    thl = ps(fontSize=8.5, textColor=WHITE, fontName='Helvetica-Bold', alignment=TA_LEFT)
    td  = ps(fontSize=9,   textColor=SLATE)
    tdr = ps(fontSize=9,   textColor=SLATE,  alignment=TA_RIGHT)
    tdi = ps(fontSize=9,   textColor=INDIGO, fontName='Helvetica-Bold', alignment=TA_RIGHT)
    tdc = ps(fontSize=9,   textColor=SLATE,  alignment=TA_CENTER)
    thc = ps(fontSize=8.5, textColor=WHITE,  fontName='Helvetica-Bold', alignment=TA_CENTER)

    rows = [[
        Paragraph('#',          thc),
        Paragraph('Service',    thl),
        Paragraph('Unit',       thc),
        Paragraph('Qty',        thc),
        Paragraph('Unit Price', th),
        Paragraph('Amount',     th),
    ]]

    COL_W = [8*mm, CW - 8*mm - 20*mm - 14*mm - 26*mm - 26*mm, 20*mm, 14*mm, 26*mm, 26*mm]

    for i, item in enumerate(items, 1):
        qty = item.get('quantity', 0)
        up  = float(item.get('unit_price', 0))
        tp  = float(item.get('total_price', up * qty))
        bg  = WHITE if i % 2 == 1 else LIGHT_BG
        rows.append([
            Paragraph(str(i),                        tdc),
            Paragraph(item.get('service_name', 'N/A'), td),
            Paragraph(item.get('unit', 'piece'),     tdc),
            Paragraph(str(qty),                      tdc),
            Paragraph(f'Rs. {up:.2f}',               tdr),
            Paragraph(f'Rs. {tp:.2f}',               tdi),
        ])

    it = Table(rows, colWidths=COL_W, repeatRows=1)
    n  = len(rows)
    row_colors = [('BACKGROUND', (0, r), (-1, r),
                   WHITE if r % 2 == 1 else LIGHT_BG) for r in range(1, n)]
    it.setStyle(TableStyle([
        ('BACKGROUND',    (0,0),(-1,0),  SLATE),
        ('BOX',           (0,0),(-1,-1), 0.8, BORDER),
        ('LINEBELOW',     (0,0),(-1,0),  1.5, INDIGO),
        ('INNERGRID',     (0,1),(-1,-1), 0.3, BORDER),
        ('TOPPADDING',    (0,0),(-1,-1), 8),
        ('BOTTOMPADDING', (0,0),(-1,-1), 8),
        ('LEFTPADDING',   (0,0),(-1,-1), 8),
        ('RIGHTPADDING',  (0,0),(-1,-1), 8),
        ('VALIGN',        (0,0),(-1,-1), 'MIDDLE'),
    ] + row_colors))
    elems += [it, Spacer(1, 4*mm)]

    # ══════════════════════════════════════════════════════════
    # 4. TOTALS BLOCK  (right-aligned subtotals + grand total)
    # ══════════════════════════════════════════════════════════
    sub = float(order.get('subtotal', 0))
    dlv = float(order.get('delivery_charge', 0))
    tot = float(order.get('total_amount', 0))

    lbl_tot = ps(fontSize=9,  textColor=MUTED)
    val_tot = ps(fontSize=9,  textColor=DARK,  alignment=TA_RIGHT)
    lbl_sep = ps(fontSize=8,  textColor=BORDER)

    sub_table = Table([
        [Paragraph('Subtotal',        lbl_tot), Paragraph(f'Rs. {sub:.2f}', val_tot)],
        [Paragraph('Delivery Charge', lbl_tot), Paragraph(f'Rs. {dlv:.2f}', val_tot)],
    ], colWidths=[CW*0.35, CW*0.20])
    sub_table.setStyle(TableStyle([
        ('TOPPADDING',    (0,0),(-1,-1), 5),
        ('BOTTOMPADDING', (0,0),(-1,-1), 5),
        ('LEFTPADDING',   (0,0),(-1,-1), 12),
        ('RIGHTPADDING',  (0,0),(-1,-1), 12),
        ('LINEBELOW',     (0,-1),(-1,-1), 0.5, BORDER),
        ('BACKGROUND',    (0,0),(-1,-1), LIGHT_BG),
        ('BOX',           (0,0),(-1,-1), 0.5, BORDER),
    ]))

    # Right-align the subtotals
    totals_wrapper = Table([[Paragraph('', lbl_sep), sub_table]],
                           colWidths=[CW*0.45, CW*0.55])
    totals_wrapper.setStyle(TableStyle([
        ('LEFTPADDING',  (0,0),(-1,-1), 0),
        ('RIGHTPADDING', (0,0),(-1,-1), 0),
        ('TOPPADDING',   (0,0),(-1,-1), 0),
        ('BOTTOMPADDING',(0,0),(-1,-1), 0),
    ]))
    elems += [totals_wrapper, Spacer(1, 2*mm)]

    # Grand total banner
    grand = Table([[
        Paragraph('TOTAL AMOUNT PAYABLE',
                  ps(fontSize=11, textColor=WHITE, fontName='Helvetica-Bold')),
        Paragraph(f'Rs. {tot:.2f}',
                  ps(fontSize=20, textColor=WHITE, fontName='Helvetica-Bold',
                     alignment=TA_RIGHT)),
    ]], colWidths=[CW*0.55, CW*0.45])
    grand.setStyle(TableStyle([
        ('BACKGROUND',    (0,0),(-1,-1), INDIGO),
        ('ROUNDEDCORNERS',[6]),
        ('TOPPADDING',    (0,0),(-1,-1), 14),
        ('BOTTOMPADDING', (0,0),(-1,-1), 14),
        ('LEFTPADDING',   (0,0),(-1,-1), 16),
        ('RIGHTPADDING',  (0,0),(-1,-1), 16),
        ('VALIGN',        (0,0),(-1,-1), 'MIDDLE'),
    ]))
    elems += [grand, Spacer(1, 6*mm)]

    # ══════════════════════════════════════════════════════════
    # 5. ORDER DETAILS STRIP  (4 columns)
    # ══════════════════════════════════════════════════════════
    pm  = (order.get('payment_method') or 'cod').upper()
    dtp = (order.get('delivery_type')  or 'standard').capitalize()
    pd  = str(order.get('pickup_date', ''))
    pt  = str(order.get('pickup_time', ''))
    ic  = CW / 4

    det_lbl = ps(fontSize=7.5, textColor=INDIGO, fontName='Helvetica-Bold', spaceAfter=3)
    det_val = ps(fontSize=10,  textColor=DARK,   fontName='Helvetica-Bold')

    det = Table([
        [Paragraph('PAYMENT METHOD', det_lbl), Paragraph('DELIVERY TYPE', det_lbl),
         Paragraph('PICKUP DATE',    det_lbl), Paragraph('PICKUP TIME',   det_lbl)],
        [Paragraph(pm,  det_val), Paragraph(dtp, det_val),
         Paragraph(pd,  det_val), Paragraph(pt,  det_val)],
    ], colWidths=[ic]*4)
    det.setStyle(TableStyle([
        ('BACKGROUND',    (0,0),(-1,-1), INDIGO_BG),
        ('BOX',           (0,0),(-1,-1), 0.5, BORDER),
        ('LINEAFTER',     (0,0),(2,-1),  0.5, BORDER),
        ('ROUNDEDCORNERS',[6]),
        ('TOPPADDING',    (0,0),(-1,-1), 10),
        ('BOTTOMPADDING', (0,0),(-1,-1), 10),
        ('LEFTPADDING',   (0,0),(-1,-1), 12),
        ('RIGHTPADDING',  (0,0),(-1,-1), 12),
        ('VALIGN',        (0,0),(-1,-1), 'MIDDLE'),
    ]))
    elems += [det, Spacer(1, 7*mm)]

    # ══════════════════════════════════════════════════════════
    # 6. FOOTER
    # ══════════════════════════════════════════════════════════
    foot_s  = ps(fontSize=8,  textColor=MUTED, alignment=TA_CENTER)
    foot_b  = ps(fontSize=8.5, textColor=INDIGO, fontName='Helvetica-Bold', alignment=TA_CENTER)

    elems += [
        HRFlowable(width=CW, color=BORDER, thickness=0.8, spaceAfter=4),
        Paragraph('Thank you for choosing <b>Quick Laundry</b>! '
                  'We hope you enjoy your fresh, clean laundry. &#128085;', foot_s),
        Spacer(1, 2*mm),
        Paragraph('support@quicklaundry.com  &bull;  quicklaundry.com', foot_b),
    ]

    doc.build(elems)
    buf.seek(0)
    return buf.read()


# =============================================================
#  ADMIN — Generate Invoice
#  POST /api/admin/invoices/generate/<order_id>
# =============================================================

@invoice_bp.route('/api/admin/invoices/generate/<int:order_id>',
                  methods=['POST', 'OPTIONS'])
@admin_required
def admin_generate_invoice(current_user, order_id):
    if request.method == 'OPTIONS':
        return '', 204
    try:
        db     = get_db()
        cursor = db.connection.cursor(pymysql.cursors.DictCursor)

        # Already exists?
        cursor.execute(
            'SELECT invoice_id, invoice_number FROM invoices WHERE order_id = %s',
            (order_id,)
        )
        existing = cursor.fetchone()
        if existing:
            cursor.close()
            return jsonify({
                'success': True,
                'message': 'Invoice already exists',
                'data': {
                    'invoice_id':     existing['invoice_id'],
                    'invoice_number': existing['invoice_number'],
                    'already_existed': True
                }
            }), 200

        # Fetch order
        cursor.execute("""
            SELECT o.*, u.full_name AS customer_name,
                   u.email AS customer_email, u.phone AS customer_phone
            FROM orders o
            LEFT JOIN users u ON o.user_id = u.user_id
            WHERE o.order_id = %s
        """, (order_id,))
        order = cursor.fetchone()
        if not order:
            cursor.close()
            return jsonify({'success': False, 'message': 'Order not found'}), 404

        # Invoice number e.g. INV-20260307-00042
        today = datetime.now().strftime('%Y%m%d')
        cursor.execute('SELECT COUNT(*) AS cnt FROM invoices')
        cnt            = cursor.fetchone()['cnt'] + 1
        invoice_number = f'INV-{today}-{cnt:05d}'

        cursor.execute("""
            INSERT INTO invoices
              (order_id, invoice_number, subtotal, delivery_charge,
               total_amount, payment_status, generated_by, created_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s, NOW())
        """, (order_id, invoice_number,
              order['subtotal'], order['delivery_charge'], order['total_amount'],
              order['payment_status'], current_user['user_id']))
        db.connection.commit()
        invoice_id = cursor.lastrowid

        # Notify customer (non-critical)
        try:
            cursor.execute("""
                INSERT INTO user_notifications
                  (user_id, title, message, related_order_id)
                VALUES (%s, %s, %s, %s)
            """, (order['user_id'],
                  'Invoice Ready!',
                  f'Your invoice {invoice_number} for order '
                  f'{order["order_number"]} is ready. Download it from My Orders.',
                  order_id))
            db.connection.commit()
        except Exception:
            pass

        cursor.close()
        return jsonify({
            'success': True,
            'message': f'Invoice {invoice_number} generated successfully',
            'data': {
                'invoice_id':     invoice_id,
                'invoice_number': invoice_number,
                'already_existed': False
            }
        }), 201

    except Exception as e:
        traceback.print_exc()
        return jsonify({'success': False, 'message': str(e)}), 500


# =============================================================
#  ADMIN — Invoice Status
#  GET /api/admin/invoices/status/<order_id>
# =============================================================

@invoice_bp.route('/api/admin/invoices/status/<int:order_id>',
                  methods=['GET', 'OPTIONS'])
@admin_required
def admin_invoice_status(current_user, order_id):
    if request.method == 'OPTIONS':
        return '', 204
    try:
        db     = get_db()
        cursor = db.connection.cursor(pymysql.cursors.DictCursor)
        cursor.execute(
            'SELECT invoice_id, invoice_number, created_at FROM invoices WHERE order_id = %s',
            (order_id,)
        )
        inv = cursor.fetchone()
        cursor.close()
        if inv and hasattr(inv.get('created_at'), 'isoformat'):
            inv['created_at'] = inv['created_at'].isoformat()
        return jsonify({
            'success': True,
            'data': {'has_invoice': bool(inv), 'invoice': inv}
        }), 200
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


# =============================================================
#  USER — Check invoice availability (OPTIONS + GET)
#  GET /api/invoices/<order_id>/check
# =============================================================

@invoice_bp.route('/api/invoices/<int:order_id>/check', methods=['OPTIONS'])
def check_invoice_preflight(order_id):
    return make_response('', 200)


@invoice_bp.route('/api/invoices/<int:order_id>/check', methods=['GET'])
@token_required
def check_invoice(current_user, order_id):
    try:
        conn   = get_db_connection()
        cursor = conn.connection.cursor(pymysql.cursors.DictCursor)
        cursor.execute("""
            SELECT i.invoice_id, i.invoice_number, i.created_at
            FROM invoices i
            JOIN orders o ON i.order_id = o.order_id
            WHERE i.order_id = %s AND o.user_id = %s
        """, (order_id, current_user['user_id']))
        inv = cursor.fetchone()
        cursor.close()
        if inv and hasattr(inv.get('created_at'), 'isoformat'):
            inv['created_at'] = inv['created_at'].isoformat()
        return jsonify({
            'success': True,
            'data': {'has_invoice': bool(inv), 'invoice': inv}
        }), 200
    except Exception as e:
        traceback.print_exc()
        return jsonify({'success': False, 'message': str(e)}), 500


# =============================================================
#  USER — Download Invoice PDF (OPTIONS + GET)
#  GET /api/invoices/<order_id>/download
# =============================================================

@invoice_bp.route('/api/invoices/<int:order_id>/download', methods=['OPTIONS'])
def download_invoice_preflight(order_id):
    return make_response('', 200)


@invoice_bp.route('/api/invoices/<int:order_id>/download', methods=['GET'])
@token_required
def download_invoice(current_user, order_id):
    try:
        conn   = get_db_connection()
        cursor = conn.connection.cursor(pymysql.cursors.DictCursor)
        cursor.execute("""
            SELECT i.invoice_id, i.invoice_number, i.created_at, i.payment_status,
                   o.order_number,  o.pickup_address,  o.pickup_date,
                   o.pickup_time,   o.delivery_type,   o.payment_method,
                   o.subtotal,      o.delivery_charge, o.total_amount,
                   u.full_name  AS customer_name,
                   u.email      AS customer_email,
                   u.phone      AS customer_phone
            FROM invoices i
            JOIN orders o ON i.order_id = o.order_id
            JOIN users  u ON o.user_id  = u.user_id
            WHERE i.order_id = %s AND o.user_id = %s
        """, (order_id, current_user['user_id']))
        row = cursor.fetchone()
        if not row:
            cursor.close(); conn.close()
            return jsonify({
                'success': False,
                'message': 'Invoice not found or not yet generated by admin'
            }), 404

        cursor.execute(
            'SELECT * FROM order_items WHERE order_id = %s ORDER BY item_id',
            (order_id,)
        )
        items = cursor.fetchall()
        cursor.close(); conn.close()

        inv = {
            'invoice_id':     row['invoice_id'],
            'invoice_number': row['invoice_number'],
            'created_at':     row['created_at'],
            'payment_status': row.get('payment_status'),
        }

        try:
            pdf_bytes = _build_pdf(inv, row, items)
        except ImportError:
            return jsonify({
                'success': False,
                'message': 'ReportLab not installed. Run: pip install reportlab'
            }), 500

        resp = make_response(pdf_bytes)
        resp.headers['Content-Type']        = 'application/pdf'
        resp.headers['Content-Disposition'] = (
            f'attachment; filename="QuickLaundry_{row["order_number"]}.pdf"'
        )
        resp.headers['Content-Length'] = len(pdf_bytes)
        return resp

    except Exception as e:
        traceback.print_exc()
        return jsonify({'success': False, 'message': str(e)}), 500