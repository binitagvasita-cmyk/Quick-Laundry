"""
============================================
CART ROUTES - CART MANAGEMENT API
Complete cart functionality with status tracking
============================================
"""

from flask import Blueprint, request, make_response
from middleware.auth_middleware import token_required
from utils.response import APIResponse
from database.db import get_db
import traceback
from datetime import datetime
import random
import string
import os
import requests as req
import pymysql
import pymysql.cursors

cart_bp = Blueprint('cart', __name__)


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
        return False, "Pincode is required"
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
# CART ENDPOINTS
# ============================================

@cart_bp.route('/api/cart/add', methods=['POST'])
@token_required
def add_to_cart(current_user):
    try:
        data = request.get_json()
        print("Adding to cart for user " + str(current_user['user_id']))

        required_fields = ['serviceId', 'serviceName', 'quantity', 'unitPrice', 'unit',
                           'pickupDate', 'pickupTime', 'pickupAddress']
        missing_fields = [f for f in required_fields if f not in data]
        if missing_fields:
            return APIResponse.error(message='Missing required fields',
                                     errors={'missing_fields': missing_fields}, status_code=400)

        cart_pincode = data.get('pincode') or extract_pincode_from_address(data.get('pickupAddress', ''))
        if cart_pincode:
            serviceable, area_or_msg = is_pincode_serviceable(cart_pincode)
            if not serviceable:
                return APIResponse.error(message=area_or_msg,
                                         errors={'pincode': cart_pincode, 'serviceable': False}, status_code=400)

        conn   = get_db()
        cursor = conn.connection.cursor(pymysql.cursors.DictCursor)
        try:
            cursor.callproc('sp_add_to_cart', [
                current_user['user_id'], data['serviceId'], data['serviceName'],
                int(data['quantity']), float(data['unitPrice']), data['unit'],
                data['pickupDate'], data['pickupTime'], data['pickupAddress'],
                data.get('specialInstructions', ''), 0
            ])
            cursor.execute("SELECT @_sp_add_to_cart_10 as cart_id")
            result  = cursor.fetchone()
            cart_id = result['cart_id']
            conn.connection.commit()
            return APIResponse.success(message='Item added to cart successfully', data={'cartId': cart_id})
        except Exception as e:
            conn.rollback()
            raise e
        finally:
            cursor.close()

    except Exception as e:
        print("Error adding to cart: " + str(e))
        print(traceback.format_exc())
        return APIResponse.error(message='Failed to add item to cart', errors=str(e), status_code=500)


@cart_bp.route('/api/cart', methods=['GET'])
@token_required
def get_cart_items(current_user):
    try:
        conn   = get_db()
        cursor = conn.connection.cursor(pymysql.cursors.DictCursor)
        cursor.execute("""
            SELECT cart_id, service_id, service_name, quantity, unit_price, total_price,
                   unit, pickup_date, pickup_time, pickup_address, special_instructions,
                   status, created_at, updated_at
            FROM cart WHERE user_id = %s ORDER BY created_at DESC
        """, (current_user['user_id'],))
        cart_items = cursor.fetchall()
        formatted  = []
        for item in cart_items:
            formatted.append({
                'cartId': item['cart_id'], 'serviceId': item['service_id'],
                'serviceName': item['service_name'], 'quantity': item['quantity'],
                'unitPrice': float(item['unit_price']), 'totalPrice': float(item['total_price']),
                'unit': item['unit'], 'pickupDate': item['pickup_date'].strftime('%Y-%m-%d'),
                'pickupTime': item['pickup_time'], 'pickupAddress': item['pickup_address'],
                'specialInstructions': item['special_instructions'], 'status': item['status'],
                'createdAt': item['created_at'].isoformat(), 'updatedAt': item['updated_at'].isoformat()
            })
        cursor.close()
        return APIResponse.success(message='Retrieved cart items', data={'cartItems': formatted})
    except Exception as e:
        print("Error fetching cart: " + str(e))
        print(traceback.format_exc())
        return APIResponse.error(message='Failed to fetch cart items', errors=str(e), status_code=500)


@cart_bp.route('/api/cart/<int:cart_id>', methods=['DELETE'])
@token_required
def remove_from_cart(current_user, cart_id):
    try:
        conn   = get_db()
        cursor = conn.connection.cursor(pymysql.cursors.DictCursor)
        cursor.execute("SELECT * FROM cart WHERE cart_id = %s AND user_id = %s",
                       (cart_id, current_user['user_id']))
        if not cursor.fetchone():
            cursor.close()
            return APIResponse.error(message='Cart item not found or access denied', status_code=404)
        cursor.execute("DELETE FROM cart WHERE cart_id = %s", (cart_id,))
        conn.connection.commit()
        cursor.close()
        return APIResponse.success(message='Item removed from cart successfully', data={'cartId': cart_id})
    except Exception as e:
        print("Error removing from cart: " + str(e))
        return APIResponse.error(message='Failed to remove item from cart', errors=str(e), status_code=500)


@cart_bp.route('/api/cart/<int:cart_id>', methods=['PUT'])
@token_required
def update_cart_item(current_user, cart_id):
    try:
        data   = request.get_json()
        conn   = get_db()
        cursor = conn.connection.cursor(pymysql.cursors.DictCursor)
        cursor.execute("SELECT * FROM cart WHERE cart_id = %s AND user_id = %s",
                       (cart_id, current_user['user_id']))
        item = cursor.fetchone()
        if not item:
            cursor.close()
            return APIResponse.error(message='Cart item not found', status_code=404)
        if 'quantity' in data:
            new_quantity = int(data['quantity'])
            new_total    = item['unit_price'] * new_quantity
            cursor.execute(
                "UPDATE cart SET quantity = %s, total_price = %s, updated_at = CURRENT_TIMESTAMP WHERE cart_id = %s",
                (new_quantity, new_total, cart_id)
            )
        conn.connection.commit()
        cursor.close()
        return APIResponse.success(message='Cart item updated successfully', data={'cartId': cart_id})
    except Exception as e:
        print("Error updating cart: " + str(e))
        return APIResponse.error(message='Failed to update cart item', errors=str(e), status_code=500)


@cart_bp.route('/api/cart/<int:cart_id>/status', methods=['GET'])
@token_required
def get_cart_status_history(current_user, cart_id):
    try:
        conn   = get_db()
        cursor = conn.connection.cursor(pymysql.cursors.DictCursor)
        cursor.execute("SELECT * FROM cart WHERE cart_id = %s AND user_id = %s",
                       (cart_id, current_user['user_id']))
        if not cursor.fetchone():
            cursor.close()
            return APIResponse.error(message='Cart item not found', status_code=404)
        cursor.execute("""
            SELECT h.*, u.full_name as changed_by_name
            FROM cart_status_history h
            LEFT JOIN users u ON h.changed_by = u.user_id
            WHERE h.cart_id = %s ORDER BY h.created_at DESC
        """, (cart_id,))
        history  = cursor.fetchall()
        formatted = [{'oldStatus': h['old_status'], 'newStatus': h['new_status'],
                      'changedBy': h['changed_by_name'], 'notes': h['notes'],
                      'timestamp': h['created_at'].isoformat()} for h in history]
        cursor.close()
        return APIResponse.success(message='Status history retrieved', data={'history': formatted})
    except Exception as e:
        print("Error fetching history: " + str(e))
        return APIResponse.error(message='Failed to fetch status history', errors=str(e), status_code=500)


@cart_bp.route('/api/cart/clear', methods=['DELETE'])
@token_required
def clear_cart(current_user):
    try:
        conn   = get_db()
        cursor = conn.connection.cursor()
        cursor.execute("DELETE FROM cart WHERE user_id = %s AND status = 'pending'",
                       (current_user['user_id'],))
        deleted_count = cursor.rowcount
        conn.connection.commit()
        cursor.close()
        return APIResponse.success(message='Cart cleared', data={'deletedCount': deleted_count})
    except Exception as e:
        print("Error clearing cart: " + str(e))
        return APIResponse.error(message='Failed to clear cart', errors=str(e), status_code=500)


@cart_bp.route('/api/cart/summary', methods=['GET'])
@token_required
def get_cart_summary(current_user):
    try:
        conn   = get_db()
        cursor = conn.connection.cursor(pymysql.cursors.DictCursor)
        cursor.execute("""
            SELECT COUNT(*) as total_items, COALESCE(SUM(total_price), 0) as total_price
            FROM cart WHERE user_id = %s AND status = 'pending'
        """, (current_user['user_id'],))
        summary = cursor.fetchone()
        cursor.close()
        return APIResponse.success(message='Cart summary retrieved',
                                   data={'totalItems': summary['total_items'],
                                         'totalPrice': float(summary['total_price'])})
    except Exception as e:
        print("Error fetching cart summary: " + str(e))
        return APIResponse.error(message='Failed to fetch cart summary', errors=str(e), status_code=500)


# ============================================
# ADMIN ROUTES
# ============================================

@cart_bp.route('/api/admin/cart/<int:cart_id>/status', methods=['PUT'])
@token_required
def update_cart_status_admin(current_user, cart_id):
    try:
        data = request.get_json()
        if 'status' not in data:
            return APIResponse.error(message='Status is required', status_code=400)
        conn   = get_db()
        cursor = conn.connection.cursor()
        cursor.callproc('sp_update_cart_status', [
            cart_id, data['status'], current_user['user_id'],
            data.get('notes', 'Status updated to ' + data['status'])
        ])
        conn.connection.commit()
        cursor.close()
        return APIResponse.success(message='Status updated successfully',
                                   data={'cartId': cart_id, 'newStatus': data['status']})
    except Exception as e:
        print("Error updating status: " + str(e))
        return APIResponse.error(message='Failed to update status', errors=str(e), status_code=500)


@cart_bp.route('/api/admin/cart/all', methods=['GET'])
@token_required
def get_all_cart_items_admin(current_user):
    try:
        conn   = get_db()
        cursor = conn.connection.cursor(pymysql.cursors.DictCursor)
        status = request.args.get('status')
        if status:
            cursor.execute("""
                SELECT c.*, u.full_name, u.email, u.phone
                FROM cart c JOIN users u ON c.user_id = u.user_id
                WHERE c.status = %s ORDER BY c.created_at DESC
            """, (status,))
        else:
            cursor.execute("""
                SELECT c.*, u.full_name, u.email, u.phone
                FROM cart c JOIN users u ON c.user_id = u.user_id
                ORDER BY c.created_at DESC
            """)
        items     = cursor.fetchall()
        formatted = []
        for item in items:
            formatted.append({
                'cartId': item['cart_id'], 'userId': item['user_id'],
                'userName': item['full_name'], 'userEmail': item['email'], 'userPhone': item['phone'],
                'serviceId': item['service_id'], 'serviceName': item['service_name'],
                'quantity': item['quantity'], 'unitPrice': float(item['unit_price']),
                'totalPrice': float(item['total_price']), 'unit': item['unit'],
                'pickupDate': item['pickup_date'].strftime('%Y-%m-%d'), 'pickupTime': item['pickup_time'],
                'pickupAddress': item['pickup_address'], 'specialInstructions': item['special_instructions'],
                'status': item['status'], 'createdAt': item['created_at'].isoformat(),
                'updatedAt': item['updated_at'].isoformat()
            })
        cursor.close()
        return APIResponse.success(message='Retrieved cart items', data={'cartItems': formatted})
    except Exception as e:
        print("Error fetching all cart items: " + str(e))
        return APIResponse.error(message='Failed to fetch cart items', errors=str(e), status_code=500)


# ============================================
# CART CHECKOUT
# ============================================

def _generate_order_number():
    date_str = datetime.now().strftime('%Y%m%d')
    suffix   = ''.join(random.choices(string.ascii_uppercase + string.digits, k=6))
    return 'CL-' + date_str + '-' + suffix


def _build_cart_email_html(user_name, order_number, items, total_amount, payment_method, delivery_type):
    """Build cart confirmation email HTML without nested f-strings."""
    payment_label  = 'Cash on Delivery' if payment_method == 'cod' else 'Online / UPI'
    payment_icon   = '💵' if payment_method == 'cod' else '📱'
    delivery_map   = {'express': 'Express (24 hrs)', 'standard': 'Standard (48 hrs)', 'economy': 'Economy (72 hrs)'}
    delivery_label = delivery_map.get(delivery_type, delivery_type)
    placed_at      = datetime.now().strftime('%d %b %Y, %I:%M %p')

    # Build items rows
    items_rows = ''
    for item in items:
        items_rows += (
            '<tr style="border-bottom:1px solid #e5e7eb;">'
            '<td style="padding:10px 14px;color:#374151;font-size:13px;">🧺 ' + str(item['service_name']) + '</td>'
            '<td style="padding:10px 14px;text-align:center;color:#374151;font-size:13px;">'
            + str(item['quantity']) + ' ' + str(item['unit']) + '</td>'
            '<td style="padding:10px 14px;text-align:right;font-weight:700;color:#7c3aed;font-size:13px;">'
            '&#8377;' + str(item['total_price']) + '</td>'
            '</tr>'
        )

    # Build steps rows
    steps = [
        ('1', 'Order Confirmed',   "We've received your cart order and it's being processed."),
        ('2', 'Pickup Scheduled',  'Our team will arrive at your scheduled pickup time.'),
        ('3', 'Expert Cleaning',   'Premium cleaning with professional care.'),
        ('4', 'Delivery',          'Your fresh laundry delivered back to you.'),
    ]
    steps_rows = ''
    for num, title, desc in steps:
        steps_rows += (
            '<tr>'
            '<td style="vertical-align:top;padding-right:12px;width:36px;">'
            '<div style="width:30px;height:30px;background:linear-gradient(135deg,#7c3aed,#a855f7);'
            'border-radius:50%;text-align:center;line-height:30px;color:#fff;font-weight:800;font-size:13px;">'
            + num + '</div></td>'
            '<td style="padding-bottom:12px;">'
            '<div style="font-weight:700;color:#1e1b4b;font-size:13px;">' + title + '</div>'
            '<div style="color:#6b7280;font-size:12px;margin-top:1px;">' + desc + '</div>'
            '</td></tr>'
        )

    html = (
        '<!DOCTYPE html><html lang="en">'
        '<head><meta charset="UTF-8"></head>'
        '<body style="margin:0;padding:0;background:#f0f4ff;font-family:Arial,sans-serif;">'
        '<table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f4ff;padding:30px 0;">'
        '<tr><td align="center">'
        '<table width="560" cellpadding="0" cellspacing="0" '
        'style="background:#fff;border-radius:20px;overflow:hidden;'
        'box-shadow:0 8px 40px rgba(124,58,237,0.15);max-width:560px;">'

        # Header
        '<tr><td style="background:linear-gradient(135deg,#7c3aed,#a855f7,#c084fc);'
        'padding:36px 30px;text-align:center;">'
        '<h1 style="margin:0 0 4px;color:#fff;font-size:24px;font-weight:800;">Quick Laundry</h1>'
        '<p style="margin:0;color:rgba(255,255,255,0.85);font-size:13px;">Premium Laundry &amp; Dry Cleaning</p>'
        '</td></tr>'

        # Success
        '<tr><td style="padding:28px 30px 0;text-align:center;">'
        '<h2 style="margin:0 0 6px;color:#1e1b4b;font-size:22px;font-weight:800;">'
        'Thank You, ' + user_name + '!</h2>'
        '<p style="margin:0;color:#6b7280;font-size:14px;">Your cart order has been placed successfully.</p>'
        '</td></tr>'

        # Order number
        '<tr><td style="padding:20px 30px 0;">'
        '<div style="background:#ede9fe;border-radius:12px;padding:16px 20px;border-left:4px solid #7c3aed;">'
        '<table width="100%" cellpadding="0" cellspacing="0"><tr>'
        '<td><span style="color:#7c3aed;font-size:11px;font-weight:600;">ORDER NUMBER</span><br>'
        '<span style="color:#1e1b4b;font-size:20px;font-weight:800;">' + order_number + '</span></td>'
        '<td align="right"><span style="color:#7c3aed;font-size:11px;font-weight:600;">PLACED ON</span><br>'
        '<span style="color:#374151;font-size:12px;">' + placed_at + '</span></td>'
        '</tr></table></div></td></tr>'

        # Items
        '<tr><td style="padding:20px 30px 0;">'
        '<h3 style="margin:0 0 12px;color:#1e1b4b;font-size:15px;font-weight:700;">Items Ordered</h3>'
        '<table width="100%" cellpadding="0" cellspacing="0" '
        'style="border:1px solid #e5e7eb;border-radius:10px;overflow:hidden;">'
        '<tr style="background:#f9fafb;">'
        '<th style="padding:10px 14px;text-align:left;font-size:12px;color:#6b7280;">Service</th>'
        '<th style="padding:10px 14px;text-align:center;font-size:12px;color:#6b7280;">Qty</th>'
        '<th style="padding:10px 14px;text-align:right;font-size:12px;color:#6b7280;">Price</th>'
        '</tr>'
        + items_rows +
        '</table></td></tr>'

        # Delivery & payment info
        '<tr><td style="padding:16px 30px 0;">'
        '<table width="100%" cellpadding="0" cellspacing="0" '
        'style="border:1px solid #e5e7eb;border-radius:10px;overflow:hidden;">'
        '<tr style="background:#f9fafb;">'
        '<td style="padding:9px 14px;color:#6b7280;font-size:13px;width:45%;">Delivery Type</td>'
        '<td style="padding:9px 14px;color:#111827;font-size:13px;font-weight:600;">' + delivery_label + '</td></tr>'
        '<tr style="border-top:1px solid #e5e7eb;">'
        '<td style="padding:9px 14px;color:#6b7280;font-size:13px;">' + payment_icon + ' Payment</td>'
        '<td style="padding:9px 14px;color:#111827;font-size:13px;font-weight:600;">' + payment_label + '</td></tr>'
        '</table></td></tr>'

        # Total
        '<tr><td style="padding:16px 30px 0;">'
        '<div style="background:linear-gradient(135deg,#1e1b4b,#3730a3);border-radius:12px;padding:16px 20px;">'
        '<table width="100%" cellpadding="0" cellspacing="0"><tr>'
        '<td style="color:rgba(255,255,255,0.75);font-size:13px;">Total Amount Payable</td>'
        '<td align="right" style="color:#fff;font-size:24px;font-weight:800;">&#8377;' + str(total_amount) + '</td>'
        '</tr></table></div></td></tr>'

        # Steps
        '<tr><td style="padding:22px 30px 0;">'
        '<h3 style="margin:0 0 14px;color:#1e1b4b;font-size:15px;font-weight:700;">What Happens Next?</h3>'
        '<table width="100%" cellpadding="0" cellspacing="0">' + steps_rows + '</table>'
        '</td></tr>'

        # Footer
        '<tr><td style="padding:24px 30px 28px;text-align:center;border-top:1px solid #f3f4f6;">'
        '<p style="margin:0;color:#9ca3af;font-size:12px;">Quick Laundry - Premium Laundry Services</p>'
        '</td></tr>'

        '</table></td></tr></table></body></html>'
    )
    return html


def _send_cart_order_email(user_email, user_name, order_number, items, total_amount, payment_method, delivery_type):
    try:
        html_body = _build_cart_email_html(user_name, order_number, items, total_amount, payment_method, delivery_type)
        return _brevo_send(user_email, 'Order Confirmed #' + order_number + ' - Quick Laundry', html_body)
    except Exception as e:
        print("Cart email failed (non-critical): " + str(e))
        return False


@cart_bp.route('/api/cart/checkout', methods=['OPTIONS'])
def cart_checkout_preflight():
    return make_response('', 200)


@cart_bp.route('/api/cart/checkout', methods=['POST'])
@token_required
def cart_checkout(current_user):
    try:
        data           = request.get_json(silent=True) or {}
        user_id        = current_user['user_id']
        payment_method = str(data.get('paymentMethod', 'cod'))
        delivery_type  = str(data.get('deliveryType', 'standard'))
        special_notes  = str(data.get('specialInstructions', ''))

        if payment_method not in ('cod', 'online', 'wallet'):
            payment_method = 'cod'
        if delivery_type not in ('express', 'standard', 'economy'):
            delivery_type = 'standard'

        conn   = get_db()
        cursor = conn.connection.cursor(pymysql.cursors.DictCursor)

        try:
            cursor.execute("""
                SELECT cart_id, service_id, service_name, quantity,
                       unit_price, total_price, unit,
                       pickup_date, pickup_time, pickup_address, special_instructions
                FROM cart WHERE user_id = %s AND status = 'pending' ORDER BY created_at ASC
            """, (user_id,))
            pending_items = cursor.fetchall()

            if not pending_items:
                return APIResponse.error(message='No pending items in cart', status_code=400)

            first_pincode = (
                data.get('pincode') or
                extract_pincode_from_address(pending_items[0].get('pickup_address', ''))
            )
            if first_pincode:
                serviceable, area_or_msg = is_pincode_serviceable(first_pincode)
                if not serviceable:
                    return APIResponse.error(message=area_or_msg,
                                             errors={'pincode': first_pincode, 'serviceable': False},
                                             status_code=400)

            subtotal        = sum(float(i['total_price']) for i in pending_items)
            delivery_charge = 50.0 if delivery_type == 'express' else (-30.0 if delivery_type == 'economy' else 0.0)
            total_amount    = round(subtotal + delivery_charge, 2)
            order_number    = _generate_order_number()

            first_item     = pending_items[0]
            pickup_address = first_item['pickup_address']
            pickup_date    = first_item['pickup_date']
            pickup_time    = first_item['pickup_time']

            cursor.execute("""
                INSERT INTO orders
                  (user_id, order_number, pickup_address, pickup_date, pickup_time,
                   delivery_type, special_instructions, payment_method,
                   subtotal, delivery_charge, total_amount, status, payment_status)
                VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,'pending','pending')
            """, (
                user_id, order_number, pickup_address, pickup_date, pickup_time,
                delivery_type,
                special_notes or first_item.get('special_instructions', ''),
                payment_method, subtotal, delivery_charge, total_amount
            ))
            order_id = cursor.lastrowid

            for item in pending_items:
                cursor.execute("""
                    INSERT INTO order_items
                      (order_id, service_id, service_name, quantity, unit_price, total_price, unit)
                    VALUES (%s,%s,%s,%s,%s,%s,%s)
                """, (order_id, item['service_id'], item['service_name'],
                      item['quantity'], item['unit_price'], item['total_price'], item['unit']))

            cursor.execute("""
                INSERT INTO order_status_history (order_id, old_status, new_status, changed_by, notes)
                VALUES (%s, NULL, 'pending', %s, 'Cart checkout by customer')
            """, (order_id, user_id))

            try:
                cursor.execute("""
                    INSERT INTO admin_notifications (notification_type, title, message, related_id)
                    VALUES ('new_order','New Cart Order',%s,%s)
                """, ('Order #' + order_number + ' - ' + str(len(pending_items)) + ' items', order_id))
            except Exception as notif_err:
                print("Admin notification skipped: " + str(notif_err))

            cart_ids = [str(i['cart_id']) for i in pending_items]
            cursor.execute(
                'DELETE FROM cart WHERE cart_id IN (' + ','.join(['%s'] * len(cart_ids)) + ')',
                cart_ids
            )

            conn.connection.commit()
            print("Cart checkout complete: #" + order_number)

            try:
                cursor.execute("SELECT full_name, email FROM users WHERE user_id = %s", (user_id,))
                user_row = cursor.fetchone()
                if user_row:
                    items_for_mail = [
                        {'service_name': i['service_name'], 'quantity': i['quantity'],
                         'unit': i['unit'], 'total_price': float(i['total_price'])}
                        for i in pending_items
                    ]
                    _send_cart_order_email(
                        user_email=user_row['email'],
                        user_name=user_row['full_name'],
                        order_number=order_number,
                        items=items_for_mail,
                        total_amount=total_amount,
                        payment_method=payment_method,
                        delivery_type=delivery_type
                    )
            except Exception as mail_err:
                print("Email step failed (non-critical): " + str(mail_err))

            return APIResponse.success(
                message='Order placed successfully',
                data={
                    'orderId': order_id, 'orderNumber': order_number,
                    'itemsCount': len(pending_items), 'subtotal': subtotal,
                    'deliveryCharge': delivery_charge, 'totalAmount': total_amount,
                    'status': 'pending', 'paymentStatus': 'pending'
                }
            )

        except Exception as e:
            conn.rollback()
            raise e
        finally:
            cursor.close()

    except Exception as e:
        print("cart_checkout error: " + str(e))
        print(traceback.format_exc())
        return APIResponse.error(message='Failed to place order. Please try again.',
                                 errors=str(e), status_code=500)


@cart_bp.route('/api/cart/info', methods=['GET'])
def cart_routes_info():
    routes = {
        'customer_routes': {
            'add_to_cart':        {'method': 'POST',   'path': '/api/cart/add'},
            'get_cart':           {'method': 'GET',    'path': '/api/cart'},
            'remove_item':        {'method': 'DELETE', 'path': '/api/cart/<cart_id>'},
            'update_item':        {'method': 'PUT',    'path': '/api/cart/<cart_id>'},
            'get_status_history': {'method': 'GET',    'path': '/api/cart/<cart_id>/status'},
            'clear_cart':         {'method': 'DELETE', 'path': '/api/cart/clear'},
            'get_summary':        {'method': 'GET',    'path': '/api/cart/summary'},
        },
        'admin_routes': {
            'update_status': {'method': 'PUT', 'path': '/api/admin/cart/<cart_id>/status'},
            'get_all_items': {'method': 'GET', 'path': '/api/admin/cart/all'},
        }
    }
    return APIResponse.success(data=routes, message='Cart routes information')