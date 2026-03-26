"""
============================================
ORDERS ROUTES - ORDER MANAGEMENT
Complete order creation and management
============================================
"""

from flask import Blueprint, request, make_response
from middleware.auth_middleware import token_required
from utils.response import APIResponse
from database.db import get_db
import traceback
import json
from datetime import datetime
import random
import string
import os
import requests as req
import pymysql
import pymysql.cursors

orders_bp = Blueprint('orders', __name__)


# ============================================
# BREVO EMAIL HELPER
# ============================================

BREVO_API_URL = "https://api.brevo.com/v3/smtp/email"

def _brevo_send(to_email, subject, html_body):
    """Send email via Brevo HTTP API. Works on Railway."""
    api_key    = os.getenv("BREVO_API_KEY", "")
    from_email = os.getenv("EMAIL_FROM", "noreply@quicklaundry.shop")
    from_name  = os.getenv("APP_NAME", "Quick Laundry")

    if not api_key:
        print("BREVO_API_KEY not set - skipping email")
        return False

    payload = {
        "sender":      {"name": from_name, "email": from_email},
        "to":          [{"email": to_email}],
        "subject":     subject,
        "htmlContent": html_body,
    }
    headers = {
        "accept":       "application/json",
        "content-type": "application/json",
        "api-key":      api_key,
    }

    try:
        resp = req.post(BREVO_API_URL, json=payload, headers=headers, timeout=10)
        if resp.status_code in (200, 201):
            print("Email sent to " + to_email)
            return True
        print("Brevo error " + str(resp.status_code) + ": " + resp.text)
        return False
    except Exception as exc:
        print("Brevo send exception: " + str(exc))
        return False


# ============================================
# SERVICE AREA CONFIG
# ============================================

SERVICEABLE_PINCODES = {
    "380015": "Satellite / Prahlad Nagar / Jodhpur Village",
    "380054": "Bodakdev",
    "380051": "Vastrapur",
    "380061": "Anandnagar",
    "380059": "Thaltej",
    "380013": "Shyamal / Paldi",
    "380009": "Navrangpura",
    "380006": "Ambawadi",
    "380007": "Maninagar",
    "380058": "Science City Road",
    "380060": "Gota",
}

def is_pincode_serviceable(pincode):
    if not pincode:
        return False, "Pincode is required to verify delivery zone"
    pincode = str(pincode).strip()
    if not pincode.isdigit() or len(pincode) != 6:
        return False, "Please enter a valid 6-digit pincode"
    if pincode in SERVICEABLE_PINCODES:
        return True, SERVICEABLE_PINCODES[pincode]
    return False, (
        "Sorry! Pincode " + pincode + " is outside our 10 km delivery zone. "
        "We serve Satellite, Bodakdev, Vastrapur, Prahlad Nagar, Thaltej, "
        "Navrangpura & nearby Ahmedabad areas. Call: +91 98765 43210"
    )

def extract_pincode_from_address(address_str):
    import re
    match = re.search(r'\b(\d{6})\b', str(address_str))
    return match.group(1) if match else None


# ============================================
# ORDER ENDPOINTS
# ============================================

@orders_bp.route('/api/orders/create', methods=['POST'])
@token_required
def create_order(current_user):
    try:
        data = request.get_json()
        print("Creating order for user " + str(current_user['user_id']))

        required_fields = ['items', 'pickupAddress', 'pickupDate', 'pickupTime',
                           'deliveryType', 'paymentMethod', 'subtotal', 'totalAmount']
        missing_fields  = [f for f in required_fields if f not in data]
        if missing_fields:
            return APIResponse.error(message='Missing required fields',
                                     errors={'missing_fields': missing_fields}, status_code=400)

        if not data['items'] or not isinstance(data['items'], list):
            return APIResponse.error(message='Items must be a non-empty array', status_code=400)

        if data['deliveryType'] not in ['express', 'standard', 'economy']:
            return APIResponse.error(message='Invalid delivery type', status_code=400)

        if data['paymentMethod'] not in ['cod', 'online', 'wallet']:
            return APIResponse.error(message='Invalid payment method', status_code=400)

        conn   = get_db()
        cursor = conn.connection.cursor(pymysql.cursors.DictCursor)
        try:
            items_json = json.dumps(data['items'])
            cursor.callproc('sp_create_order', [
                current_user['user_id'], data['pickupAddress'], data['pickupDate'],
                data['pickupTime'], data['deliveryType'], data.get('specialInstructions', ''),
                data['paymentMethod'], float(data['subtotal']),
                float(data.get('deliveryCharge', 0)), float(data['totalAmount']),
                items_json, 0, ''
            ])
            cursor.execute("SELECT @_sp_create_order_11 as order_id, @_sp_create_order_12 as order_number")
            result = cursor.fetchone()
            if not result:
                raise Exception("Failed to create order - no result from stored procedure")
            order_id     = result['order_id']
            order_number = result['order_number']
            conn.connection.commit()

            cursor.execute("""
                SELECT o.*, u.full_name, u.email, u.phone
                FROM orders o JOIN users u ON o.user_id = u.user_id
                WHERE o.order_id = %s
            """, (order_id,))
            order_details = cursor.fetchone()

            cursor.execute("SELECT * FROM order_items WHERE order_id = %s", (order_id,))
            order_items = cursor.fetchall()

            return APIResponse.success(message='Order created successfully', data={
                'orderId': order_id, 'orderNumber': order_number,
                'status': order_details['status'], 'paymentStatus': order_details['payment_status'],
                'totalAmount': float(order_details['total_amount']),
                'pickupDate': order_details['pickup_date'].strftime('%Y-%m-%d'),
                'pickupTime': order_details['pickup_time'],
                'deliveryType': order_details['delivery_type'],
                'items': [{'serviceName': i['service_name'], 'quantity': i['quantity'],
                           'unitPrice': float(i['unit_price']), 'totalPrice': float(i['total_price']),
                           'unit': i['unit']} for i in order_items],
                'createdAt': order_details['created_at'].isoformat()
            })
        except Exception as e:
            conn.rollback()
            raise e
        finally:
            cursor.close()

    except Exception as e:
        print("Error creating order: " + str(e))
        print(traceback.format_exc())
        return APIResponse.error(message='Failed to create order', errors=str(e), status_code=500)


@orders_bp.route('/api/orders', methods=['OPTIONS'])
def get_orders_preflight():
    return make_response('', 200)


@orders_bp.route('/api/orders', methods=['GET'])
@token_required
def get_user_orders(current_user):
    try:
        conn   = get_db()
        cursor = conn.connection.cursor(pymysql.cursors.DictCursor)
        cursor.execute("""
            SELECT o.order_id, o.order_number, o.pickup_address, o.pickup_date,
                   o.pickup_time, o.delivery_type, o.special_instructions,
                   o.payment_method, o.subtotal, o.delivery_charge, o.total_amount,
                   o.status, o.payment_status, o.created_at, o.updated_at,
                   COUNT(oi.item_id) as items_count,
                   COALESCE(SUM(oi.quantity), 0) as total_quantity
            FROM orders o
            LEFT JOIN order_items oi ON o.order_id = oi.order_id
            WHERE o.user_id = %s
            GROUP BY o.order_id, o.order_number, o.pickup_address, o.pickup_date,
                     o.pickup_time, o.delivery_type, o.special_instructions,
                     o.payment_method, o.subtotal, o.delivery_charge, o.total_amount,
                     o.status, o.payment_status, o.created_at, o.updated_at
            ORDER BY o.created_at DESC
        """, (current_user['user_id'],))
        orders = cursor.fetchall()

        formatted = []
        for order in orders:
            formatted.append({
                'orderId': order['order_id'], 'orderNumber': order['order_number'],
                'pickupAddress': order['pickup_address'],
                'pickupDate': order['pickup_date'].strftime('%Y-%m-%d') if order['pickup_date'] else None,
                'pickupTime': order['pickup_time'], 'deliveryType': order['delivery_type'],
                'specialInstructions': order['special_instructions'],
                'paymentMethod': order['payment_method'], 'subtotal': float(order['subtotal']),
                'deliveryCharge': float(order['delivery_charge']), 'totalAmount': float(order['total_amount']),
                'status': order['status'], 'paymentStatus': order['payment_status'],
                'itemsCount': int(order['items_count']) if order['items_count'] else 0,
                'totalQuantity': int(order['total_quantity']) if order['total_quantity'] else 0,
                'createdAt': order['created_at'].isoformat(), 'updatedAt': order['updated_at'].isoformat()
            })
        cursor.close()
        return APIResponse.success(message='Retrieved orders', data={'orders': formatted})

    except Exception as e:
        print("Error fetching orders: " + str(e))
        print(traceback.format_exc())
        return APIResponse.error(message='Failed to fetch orders', errors=str(e), status_code=500)


@orders_bp.route('/api/orders/<int:order_id>', methods=['OPTIONS'])
def get_order_detail_preflight(order_id):
    return make_response('', 200)


@orders_bp.route('/api/orders/<int:order_id>', methods=['GET'])
@token_required
def get_order_details(current_user, order_id):
    try:
        conn   = get_db()
        cursor = conn.connection.cursor(pymysql.cursors.DictCursor)
        cursor.execute("""
            SELECT o.*, u.full_name, u.email, u.phone
            FROM orders o JOIN users u ON o.user_id = u.user_id
            WHERE o.order_id = %s AND o.user_id = %s
        """, (order_id, current_user['user_id']))
        order = cursor.fetchone()
        if not order:
            cursor.close()
            return APIResponse.error(message='Order not found or access denied', status_code=404)

        cursor.execute("SELECT * FROM order_items WHERE order_id = %s ORDER BY item_id", (order_id,))
        items = cursor.fetchall()

        cursor.execute("""
            SELECT osh.*, u.full_name as changed_by_name
            FROM order_status_history osh
            LEFT JOIN users u ON osh.changed_by = u.user_id
            WHERE osh.order_id = %s ORDER BY osh.created_at DESC
        """, (order_id,))
        history = cursor.fetchall()
        cursor.close()

        return APIResponse.success(message='Order details retrieved', data={'order': {
            'orderId': order['order_id'], 'orderNumber': order['order_number'],
            'pickupAddress': order['pickup_address'],
            'pickupDate': order['pickup_date'].strftime('%Y-%m-%d'),
            'pickupTime': order['pickup_time'], 'deliveryType': order['delivery_type'],
            'specialInstructions': order['special_instructions'],
            'paymentMethod': order['payment_method'], 'subtotal': float(order['subtotal']),
            'deliveryCharge': float(order['delivery_charge']), 'totalAmount': float(order['total_amount']),
            'status': order['status'], 'paymentStatus': order['payment_status'],
            'customer': {'name': order['full_name'], 'email': order['email'], 'phone': order['phone']},
            'items': [{'itemId': i['item_id'], 'serviceId': i['service_id'],
                       'serviceName': i['service_name'], 'quantity': i['quantity'],
                       'unitPrice': float(i['unit_price']), 'totalPrice': float(i['total_price']),
                       'unit': i['unit']} for i in items],
            'statusHistory': [{'status': h['new_status'], 'previousStatus': h['old_status'],
                               'changedBy': h['changed_by_name'], 'notes': h['notes'],
                               'timestamp': h['created_at'].isoformat()} for h in history],
            'createdAt': order['created_at'].isoformat(), 'updatedAt': order['updated_at'].isoformat()
        }})

    except Exception as e:
        print("Error fetching order details: " + str(e))
        print(traceback.format_exc())
        return APIResponse.error(message='Failed to fetch order details', errors=str(e), status_code=500)


@orders_bp.route('/api/orders/<int:order_id>/cancel', methods=['OPTIONS'])
def cancel_order_preflight(order_id):
    return make_response('', 200)


@orders_bp.route('/api/orders/<int:order_id>/cancel', methods=['POST'])
@token_required
def cancel_order(current_user, order_id):
    try:
        data          = request.get_json()
        cancel_reason = data.get('reason', 'Cancelled by customer')

        conn   = get_db()
        cursor = conn.connection.cursor(pymysql.cursors.DictCursor)
        cursor.execute("SELECT * FROM orders WHERE order_id = %s AND user_id = %s",
                       (order_id, current_user['user_id']))
        order = cursor.fetchone()

        if not order:
            cursor.close()
            return APIResponse.error(message='Order not found or access denied', status_code=404)

        if order['status'] not in ['pending', 'confirmed']:
            cursor.close()
            return APIResponse.error(message="Cannot cancel order with status '" + order['status'] + "'",
                                     status_code=400)

        from datetime import timezone
        created_at = order['created_at']
        if created_at.tzinfo is None:
            created_at = created_at.replace(tzinfo=timezone.utc)
        hours_since = (datetime.now(timezone.utc) - created_at).total_seconds() / 3600
        if hours_since > 24:
            cursor.close()
            return APIResponse.error(
                message='Cancellation window has expired. Orders can only be cancelled within 24 hours.',
                status_code=400
            )

        cursor.execute("""
            UPDATE orders SET status = 'cancelled', cancelled_reason = %s,
            cancelled_at = NOW(), updated_at = NOW() WHERE order_id = %s
        """, (cancel_reason, order_id))

        cursor.execute("""
            INSERT INTO order_status_history (order_id, old_status, new_status, changed_by, notes)
            VALUES (%s, %s, 'cancelled', %s, %s)
        """, (order_id, order['status'], current_user['user_id'], cancel_reason))

        try:
            cursor.execute("SELECT order_number FROM orders WHERE order_id = %s", (order_id,))
            ord_row = cursor.fetchone()
            ord_num = ord_row['order_number'] if ord_row else '#' + str(order_id)
            cursor.execute("""
                INSERT INTO admin_notifications (notification_type, title, message, related_id)
                VALUES ('new_order', 'Order Cancelled by Customer', %s, %s)
            """, ('Order ' + ord_num + ' cancelled. Reason: ' + cancel_reason, order_id))
        except Exception as notif_err:
            print("Admin cancel notification skipped: " + str(notif_err))

        conn.connection.commit()
        cursor.close()
        return APIResponse.success(message='Order cancelled successfully',
                                   data={'orderId': order_id, 'status': 'cancelled'})

    except Exception as e:
        print("Error cancelling order: " + str(e))
        print(traceback.format_exc())
        return APIResponse.error(message='Failed to cancel order', errors=str(e), status_code=500)


@orders_bp.route('/api/admin/orders', methods=['GET'])
@token_required
def get_all_orders_admin(current_user):
    try:
        status_filter  = request.args.get('status')
        payment_status = request.args.get('payment_status')
        limit          = int(request.args.get('limit', 50))
        offset         = int(request.args.get('offset', 0))

        conn   = get_db()
        cursor = conn.connection.cursor(pymysql.cursors.DictCursor)
        query  = """
            SELECT o.*, u.full_name, u.email, u.phone, COUNT(oi.item_id) as items_count
            FROM orders o JOIN users u ON o.user_id = u.user_id
            LEFT JOIN order_items oi ON o.order_id = oi.order_id WHERE 1=1
        """
        params = []
        if status_filter:
            query += " AND o.status = %s"
            params.append(status_filter)
        if payment_status:
            query += " AND o.payment_status = %s"
            params.append(payment_status)
        query += " GROUP BY o.order_id ORDER BY o.created_at DESC LIMIT %s OFFSET %s"
        params.extend([limit, offset])

        cursor.execute(query, params)
        orders    = cursor.fetchall()
        formatted = [{
            'orderId': o['order_id'], 'orderNumber': o['order_number'],
            'customer': {'name': o['full_name'], 'email': o['email'], 'phone': o['phone']},
            'totalAmount': float(o['total_amount']), 'status': o['status'],
            'paymentStatus': o['payment_status'], 'itemsCount': o['items_count'],
            'pickupDate': o['pickup_date'].strftime('%Y-%m-%d'),
            'createdAt': o['created_at'].isoformat()
        } for o in orders]
        cursor.close()
        return APIResponse.success(message='Retrieved orders', data={'orders': formatted})

    except Exception as e:
        print("Error fetching all orders: " + str(e))
        return APIResponse.error(message='Failed to fetch orders', errors=str(e), status_code=500)


# ============================================
# HELPERS
# ============================================

def _generate_order_number():
    date_str = datetime.now().strftime('%Y%m%d')
    suffix   = ''.join(random.choices(string.ascii_uppercase + string.digits, k=6))
    return 'CL-' + date_str + '-' + suffix


def _build_order_email_html(user_name, order_number, order_data):
    """Build order confirmation email HTML without nested f-strings."""
    payment_method = order_data.get('payment_method', 'cod')
    payment_label  = 'Cash on Delivery' if payment_method == 'cod' else 'Online / UPI'
    payment_icon   = '💵' if payment_method == 'cod' else '📱'
    placed_at      = datetime.now().strftime('%d %b %Y, %I:%M %p')
    service_name   = str(order_data.get('service_name', 'Laundry Service'))
    quantity       = str(order_data.get('quantity', 1))
    unit           = str(order_data.get('unit', 'piece'))
    pickup_date    = str(order_data.get('pickup_date', ''))
    pickup_time    = str(order_data.get('pickup_time', ''))
    pickup_address = str(order_data.get('pickup_address', ''))
    total_price    = str(order_data.get('total_price', 0))

    # Build detail rows
    detail_rows = ''
    rows_data = [
        ('Service',      service_name),
        ('Quantity',     quantity + ' ' + unit),
        ('Pickup Date',  pickup_date),
        ('Pickup Time',  pickup_time),
        ('Address',      pickup_address),
        (payment_icon + ' Payment', payment_label),
    ]
    for idx, (label, value) in enumerate(rows_data):
        bg = '#f9fafb' if idx % 2 == 0 else '#ffffff'
        detail_rows += (
            '<tr style="background:' + bg + ';">'
            '<td style="padding:12px 18px;color:#6b7280;font-size:14px;width:42%;">' + label + '</td>'
            '<td style="padding:12px 18px;color:#111827;font-size:14px;font-weight:600;">' + value + '</td>'
            '</tr>'
        )

    # Build steps rows
    steps = [
        ('1', 'Order Confirmed',     "We've received your order and it's being processed."),
        ('2', 'Pickup Scheduled',    'Our team arrives on ' + pickup_date + ' at ' + pickup_time + '.'),
        ('3', 'Cleaning in Progress','Expert cleaning with premium products.'),
        ('4', 'Delivery',            'Your fresh laundry will be delivered back to you.'),
    ]
    steps_rows = ''
    for num, title, desc in steps:
        steps_rows += (
            '<tr>'
            '<td style="vertical-align:top;padding-right:14px;width:40px;">'
            '<div style="width:34px;height:34px;background:linear-gradient(135deg,#7c3aed,#a855f7);'
            'border-radius:50%;text-align:center;line-height:34px;color:#fff;font-weight:800;font-size:14px;">'
            + num + '</div></td>'
            '<td style="padding-bottom:14px;">'
            '<div style="font-weight:700;color:#1e1b4b;font-size:14px;">' + title + '</div>'
            '<div style="color:#6b7280;font-size:13px;margin-top:2px;">' + desc + '</div>'
            '</td></tr>'
        )

    html = (
        '<!DOCTYPE html><html lang="en">'
        '<head><meta charset="UTF-8"></head>'
        '<body style="margin:0;padding:0;background:#f0f4ff;font-family:Arial,sans-serif;">'
        '<table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f4ff;padding:30px 0;">'
        '<tr><td align="center">'
        '<table width="580" cellpadding="0" cellspacing="0" '
        'style="background:#fff;border-radius:20px;overflow:hidden;'
        'box-shadow:0 8px 40px rgba(124,58,237,0.15);max-width:580px;">'

        # Header
        '<tr><td style="background:linear-gradient(135deg,#7c3aed 0%,#a855f7 60%,#c084fc 100%);'
        'padding:40px 30px;text-align:center;">'
        '<h1 style="margin:0 0 6px;color:#fff;font-size:26px;font-weight:800;">Quick Laundry</h1>'
        '<p style="margin:0;color:rgba(255,255,255,0.85);font-size:14px;">Premium Laundry &amp; Dry Cleaning</p>'
        '</td></tr>'

        # Success
        '<tr><td style="padding:32px 30px 0;text-align:center;">'
        '<h2 style="margin:0 0 8px;color:#1e1b4b;font-size:24px;font-weight:800;">'
        'Thank You, ' + user_name + '!</h2>'
        '<p style="margin:0;color:#6b7280;font-size:15px;line-height:1.6;">'
        'Your laundry order has been placed successfully.</p>'
        '</td></tr>'

        # Order number
        '<tr><td style="padding:24px 30px 0;">'
        '<div style="background:linear-gradient(135deg,#ede9fe,#f3e8ff);'
        'border-radius:14px;padding:18px 24px;border-left:4px solid #7c3aed;">'
        '<table width="100%" cellpadding="0" cellspacing="0"><tr>'
        '<td><span style="color:#7c3aed;font-size:12px;font-weight:600;text-transform:uppercase;">Order Number</span><br>'
        '<span style="color:#1e1b4b;font-size:22px;font-weight:800;">' + order_number + '</span></td>'
        '<td align="right"><span style="color:#7c3aed;font-size:12px;font-weight:600;text-transform:uppercase;">Placed On</span><br>'
        '<span style="color:#374151;font-size:13px;font-weight:600;">' + placed_at + '</span></td>'
        '</tr></table></div></td></tr>'

        # Order details table
        '<tr><td style="padding:24px 30px 0;">'
        '<h3 style="margin:0 0 14px;color:#1e1b4b;font-size:16px;font-weight:700;">Order Details</h3>'
        '<table width="100%" cellpadding="0" cellspacing="0" '
        'style="border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;">'
        + detail_rows +
        '</table></td></tr>'

        # Total
        '<tr><td style="padding:20px 30px 0;">'
        '<div style="background:linear-gradient(135deg,#1e1b4b,#3730a3);border-radius:14px;padding:18px 24px;">'
        '<table width="100%" cellpadding="0" cellspacing="0"><tr>'
        '<td style="color:rgba(255,255,255,0.75);font-size:14px;">Total Amount Payable</td>'
        '<td align="right" style="color:#fff;font-size:26px;font-weight:800;">&#8377;' + total_price + '</td>'
        '</tr></table></div></td></tr>'

        # Steps
        '<tr><td style="padding:28px 30px 0;">'
        '<h3 style="margin:0 0 16px;color:#1e1b4b;font-size:16px;font-weight:700;">What Happens Next?</h3>'
        '<table width="100%" cellpadding="0" cellspacing="0">' + steps_rows + '</table>'
        '</td></tr>'

        # Footer
        '<tr><td style="padding:28px 30px 30px;text-align:center;border-top:1px solid #f3f4f6;">'
        '<p style="margin:0;color:#9ca3af;font-size:12px;">Quick Laundry - Premium Laundry Services</p>'
        '</td></tr>'

        '</table></td></tr></table></body></html>'
    )
    return html


def send_order_confirmation_email(user_email, user_name, order_number, order_data):
    """Send order confirmation email via Brevo."""
    try:
        html_body = _build_order_email_html(user_name, order_number, order_data)
        return _brevo_send(user_email, 'Order Confirmed #' + order_number + ' - Quick Laundry', html_body)
    except Exception as e:
        print("Failed to send confirmation email: " + str(e))
        return False


@orders_bp.route('/api/orders/place', methods=['OPTIONS'])
def place_order_preflight():
    return make_response('', 200)


@orders_bp.route('/api/orders/place', methods=['POST'])
@token_required
def place_order(current_user):
    try:
        data    = request.get_json(silent=True) or {}
        user_id = current_user['user_id']

        required = ['serviceId', 'serviceName', 'quantity', 'unitPrice',
                    'pickupDate', 'pickupTime', 'pickupAddress']
        missing  = [f for f in required if not data.get(f)]
        if missing:
            return APIResponse.error(message='Missing required fields: ' + ', '.join(missing),
                                     errors={'missing': missing}, status_code=400)

        service_id           = int(data['serviceId'])
        service_name         = str(data['serviceName'])[:100]
        service_type         = str(data.get('serviceType', 'standard'))
        quantity             = int(data['quantity'])
        unit_price           = float(data['unitPrice'])
        total_price          = round(unit_price * quantity, 2)
        unit                 = str(data.get('unit', 'piece'))[:20]
        pickup_date          = data['pickupDate']
        pickup_time          = data['pickupTime']
        pickup_address       = str(data['pickupAddress'])
        special_instructions = str(data.get('specialInstructions', ''))
        payment_method       = str(
            data.get('payment_method') or data.get('paymentMode') or data.get('paymentMethod') or 'cod'
        )

        # Service area check
        order_pincode = data.get('pincode') or extract_pincode_from_address(pickup_address)
        if order_pincode:
            serviceable, area_or_msg = is_pincode_serviceable(order_pincode)
            if not serviceable:
                return APIResponse.error(message=area_or_msg,
                                         errors={'pincode': order_pincode, 'serviceable': False},
                                         status_code=400)

        if payment_method not in ('cod', 'online', 'wallet'):
            payment_method = 'cod'

        delivery_type   = 'express' if service_type == 'urgent' else 'standard'
        subtotal        = total_price
        delivery_charge = 0.00
        total_amount    = round(subtotal + delivery_charge, 2)
        order_number    = _generate_order_number()

        conn   = get_db()
        cursor = conn.connection.cursor(pymysql.cursors.DictCursor)

        try:
            cursor.execute("""
                INSERT INTO orders
                  (user_id, order_number, pickup_address, pickup_date, pickup_time,
                   delivery_type, special_instructions, payment_method,
                   subtotal, delivery_charge, total_amount, status, payment_status)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, 'pending', 'pending')
            """, (
                user_id, order_number, pickup_address, pickup_date, pickup_time,
                delivery_type, special_instructions, payment_method,
                subtotal, delivery_charge, total_amount
            ))
            order_id = cursor.lastrowid

            cursor.execute("""
                INSERT INTO order_items
                  (order_id, service_id, service_name, quantity, unit_price, total_price, unit)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
            """, (order_id, service_id, service_name, quantity, unit_price, total_price, unit))

            cursor.execute("""
                INSERT INTO order_status_history
                  (order_id, old_status, new_status, changed_by, notes)
                VALUES (%s, NULL, 'pending', %s, 'Order placed by customer via service page')
            """, (order_id, user_id))

            try:
                cursor.execute("""
                    INSERT INTO admin_notifications (notification_type, title, message, related_id)
                    VALUES ('new_order', 'New Order Received', %s, %s)
                """, ('Order #' + order_number + ' - ' + service_name + ' x' + str(quantity), order_id))
            except Exception as notif_err:
                print("Admin notification skipped: " + str(notif_err))

            conn.connection.commit()

            # Send confirmation email (non-blocking)
            try:
                cursor.execute("SELECT full_name, email FROM users WHERE user_id = %s", (user_id,))
                user_row = cursor.fetchone()
                if user_row:
                    send_order_confirmation_email(
                        user_email=user_row['email'],
                        user_name=user_row['full_name'],
                        order_number=order_number,
                        order_data={
                            'service_name':   service_name,
                            'quantity':       quantity,
                            'unit':           unit,
                            'pickup_date':    pickup_date,
                            'pickup_time':    pickup_time,
                            'pickup_address': pickup_address,
                            'payment_method': payment_method,
                            'total_price':    total_amount,
                        }
                    )
            except Exception as mail_err:
                print("Email step failed (non-critical): " + str(mail_err))

            print("Order placed: #" + order_number + " ID:" + str(order_id))
            return APIResponse.success(
                message='Order placed successfully',
                data={'orderId': order_id, 'orderNumber': order_number,
                      'totalAmount': total_amount, 'status': 'pending', 'paymentStatus': 'pending'}
            )

        except Exception as e:
            conn.rollback()
            raise e
        finally:
            cursor.close()

    except Exception as e:
        print("place_order error: " + str(e))
        print(traceback.format_exc())
        return APIResponse.error(message='Failed to place order. Please try again.',
                                 errors=str(e), status_code=500)


# ============================================
# USER NOTIFICATIONS
# ============================================

@orders_bp.route('/api/orders/notifications', methods=['OPTIONS'])
def user_notifications_preflight():
    return make_response('', 200)


@orders_bp.route('/api/orders/notifications', methods=['GET'])
@token_required
def get_user_notifications(current_user):
    try:
        conn   = get_db()
        cursor = conn.connection.cursor(pymysql.cursors.DictCursor)
        cursor.execute("""
            SELECT notification_id, title, message, is_read, created_at
            FROM user_notifications
            WHERE user_id = %s AND is_read = 0
            ORDER BY created_at DESC LIMIT 10
        """, (current_user['user_id'],))
        notifs = cursor.fetchall()

        if notifs:
            ids          = [n['notification_id'] for n in notifs]
            placeholders = ','.join(['%s'] * len(ids))
            cursor.execute(
                'UPDATE user_notifications SET is_read = 1, read_at = NOW() WHERE notification_id IN (' + placeholders + ')',
                ids
            )
            conn.connection.commit()

        for n in notifs:
            if hasattr(n.get('created_at'), 'isoformat'):
                n['created_at'] = n['created_at'].isoformat()
        cursor.close()
        return APIResponse.success(data={'notifications': notifs})

    except Exception as e:
        print("get_user_notifications error: " + str(e))
        return APIResponse.error(message='Failed to fetch notifications', errors=str(e), status_code=500)


@orders_bp.route('/api/orders/notifications/read-all', methods=['POST', 'OPTIONS'])
@token_required
def mark_all_notifications_read(current_user):
    if request.method == 'OPTIONS':
        return make_response('', 200)
    try:
        conn   = get_db()
        cursor = conn.connection.cursor()
        cursor.execute("""
            UPDATE user_notifications SET is_read = 1, read_at = NOW()
            WHERE user_id = %s AND is_read = 0
        """, (current_user['user_id'],))
        conn.connection.commit()
        cursor.close()
        return APIResponse.success(message='All notifications marked as read')
    except Exception as e:
        return APIResponse.error(message='Failed', errors=str(e), status_code=500)