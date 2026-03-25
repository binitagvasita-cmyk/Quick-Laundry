"""
============================================
CART ROUTES - CART MANAGEMENT API
Complete cart functionality with status tracking
============================================
"""

from flask import Blueprint, request, make_response
from middleware.auth_middleware import token_required
from utils.response import APIResponse
from database.db_connection import get_db_connection
import traceback
from datetime import datetime
import random
import string
import os

cart_bp = Blueprint('cart', __name__)


# ============================================
# CLEANIFY LAUNDRY — SERVICE AREA CONFIG
# Shop: Satellite, Ahmedabad | Radius: ~10 km
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
    """Check if a pincode is within Cleanify Laundry's 10 km delivery zone."""
    if not pincode:
        return False, "Pincode is required"
    pincode = str(pincode).strip()
    if not pincode.isdigit() or len(pincode) != 6:
        return False, "Please enter a valid 6-digit pincode"
    if pincode in SERVICEABLE_PINCODES:
        return True, SERVICEABLE_PINCODES[pincode]
    return False, (
        f"Sorry! Pincode {pincode} is outside our 10 km delivery zone. "
        f"We serve Satellite, Bodakdev, Vastrapur, Prahlad Nagar, Thaltej, "
        f"Navrangpura & nearby Ahmedabad areas. Call: +91 98765 43210"
    )

def extract_pincode_from_address(address_str):
    """Extract a 6-digit pincode from an address string."""
    import re
    match = re.search(r'\b(\d{6})\b', str(address_str))
    return match.group(1) if match else None


@cart_bp.route('/api/cart/add', methods=['POST'])
@token_required
def add_to_cart(current_user):
    """
    Add item to cart
    Required: Authentication token
    """
    try:
        data = request.get_json()
        
        print(f"🛒 Adding to cart for user {current_user['user_id']}")
        print(f"   Data: {data}")
        
        # Validate required fields
        required_fields = [
            'serviceId', 'serviceName', 'quantity', 'unitPrice', 'unit',
            'pickupDate', 'pickupTime', 'pickupAddress'
        ]
        
        missing_fields = [field for field in required_fields if field not in data]
        if missing_fields:
            return APIResponse.error(
                message='Missing required fields',
                errors={'missing_fields': missing_fields},
                status_code=400
            )

        # ── SERVICE AREA CHECK ───────────────────────────────────────────
        cart_pincode = data.get('pincode') or extract_pincode_from_address(data.get('pickupAddress', ''))
        if cart_pincode:
            serviceable, area_or_msg = is_pincode_serviceable(cart_pincode)
            if not serviceable:
                print(f"🚫 Cart blocked — pincode {cart_pincode} outside service zone")
                return APIResponse.error(
                    message=area_or_msg,
                    errors={'pincode': cart_pincode, 'serviceable': False},
                    status_code=400
                )
            print(f"✅ Cart pincode {cart_pincode} → {area_or_msg}")
        # ────────────────────────────────────────────────────────────────

        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        
        try:
            # Call stored procedure
            cursor.callproc('sp_add_to_cart', [
                current_user['user_id'],
                data['serviceId'],
                data['serviceName'],
                int(data['quantity']),
                float(data['unitPrice']),
                data['unit'],
                data['pickupDate'],
                data['pickupTime'],
                data['pickupAddress'],
                data.get('specialInstructions', ''),
                0  # OUT parameter for cart_id
            ])
            
            # Get the OUT parameter (cart_id)
            cursor.execute("SELECT @_sp_add_to_cart_10 as cart_id")
            result = cursor.fetchone()
            cart_id = result['cart_id']
            
            conn.commit()
            
            print(f"✅ Item added to cart! Cart ID: {cart_id}")
            
            return APIResponse.success(
                message='Item added to cart successfully',
                data={'cartId': cart_id}
            )
            
        except Exception as e:
            conn.rollback()
            raise e
        finally:
            cursor.close()
            conn.close()
        
    except Exception as e:
        print(f"❌ Error adding to cart: {str(e)}")
        print(traceback.format_exc())
        return APIResponse.error(
            message='Failed to add item to cart',
            errors=str(e),
            status_code=500
        )


@cart_bp.route('/api/cart', methods=['GET'])
@token_required
def get_cart_items(current_user):
    """
    Get all cart items for current user
    """
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        
        query = """
            SELECT 
                cart_id,
                service_id,
                service_name,
                quantity,
                unit_price,
                total_price,
                unit,
                pickup_date,
                pickup_time,
                pickup_address,
                special_instructions,
                status,
                created_at,
                updated_at
            FROM cart
            WHERE user_id = %s
            ORDER BY created_at DESC
        """
        
        cursor.execute(query, (current_user['user_id'],))
        cart_items = cursor.fetchall()
        
        # Format response
        formatted_items = []
        for item in cart_items:
            formatted_items.append({
                'cartId': item['cart_id'],
                'serviceId': item['service_id'],
                'serviceName': item['service_name'],
                'quantity': item['quantity'],
                'unitPrice': float(item['unit_price']),
                'totalPrice': float(item['total_price']),
                'unit': item['unit'],
                'pickupDate': item['pickup_date'].strftime('%Y-%m-%d'),
                'pickupTime': item['pickup_time'],
                'pickupAddress': item['pickup_address'],
                'specialInstructions': item['special_instructions'],
                'status': item['status'],
                'createdAt': item['created_at'].isoformat(),
                'updatedAt': item['updated_at'].isoformat()
            })
        
        cursor.close()
        conn.close()
        
        print(f"✅ Retrieved {len(formatted_items)} cart items for user {current_user['user_id']}")
        
        return APIResponse.success(
            message=f'Retrieved {len(formatted_items)} cart items',
            data={'cartItems': formatted_items}
        )
        
    except Exception as e:
        print(f"❌ Error fetching cart: {str(e)}")
        print(traceback.format_exc())
        return APIResponse.error(
            message='Failed to fetch cart items',
            errors=str(e),
            status_code=500
        )


@cart_bp.route('/api/cart/<int:cart_id>', methods=['DELETE'])
@token_required
def remove_from_cart(current_user, cart_id):
    """
    Remove item from cart
    """
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        
        # Verify ownership
        cursor.execute("""
            SELECT * FROM cart 
            WHERE cart_id = %s AND user_id = %s
        """, (cart_id, current_user['user_id']))
        
        item = cursor.fetchone()
        
        if not item:
            cursor.close()
            conn.close()
            return APIResponse.error(
                message='Cart item not found or access denied',
                status_code=404
            )
        
        # Delete item
        cursor.execute("DELETE FROM cart WHERE cart_id = %s", (cart_id,))
        conn.commit()
        
        cursor.close()
        conn.close()
        
        print(f"✅ Item removed from cart: {cart_id}")
        
        return APIResponse.success(
            message='Item removed from cart successfully',
            data={'cartId': cart_id}
        )
        
    except Exception as e:
        print(f"❌ Error removing from cart: {str(e)}")
        return APIResponse.error(
            message='Failed to remove item from cart',
            errors=str(e),
            status_code=500
        )


@cart_bp.route('/api/cart/<int:cart_id>', methods=['PUT'])
@token_required
def update_cart_item(current_user, cart_id):
    """
    Update cart item quantity
    """
    try:
        data = request.get_json()
        
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        
        # Verify ownership
        cursor.execute("""
            SELECT * FROM cart 
            WHERE cart_id = %s AND user_id = %s
        """, (cart_id, current_user['user_id']))
        
        item = cursor.fetchone()
        
        if not item:
            cursor.close()
            conn.close()
            return APIResponse.error(
                message='Cart item not found',
                status_code=404
            )
        
        # Update quantity and total
        if 'quantity' in data:
            new_quantity = int(data['quantity'])
            new_total = item['unit_price'] * new_quantity
            
            cursor.execute("""
                UPDATE cart 
                SET quantity = %s, total_price = %s, updated_at = CURRENT_TIMESTAMP
                WHERE cart_id = %s
            """, (new_quantity, new_total, cart_id))
        
        conn.commit()
        cursor.close()
        conn.close()
        
        print(f"✅ Cart item updated: {cart_id}")
        
        return APIResponse.success(
            message='Cart item updated successfully',
            data={'cartId': cart_id}
        )
        
    except Exception as e:
        print(f"❌ Error updating cart: {str(e)}")
        return APIResponse.error(
            message='Failed to update cart item',
            errors=str(e),
            status_code=500
        )


@cart_bp.route('/api/cart/<int:cart_id>/status', methods=['GET'])
@token_required
def get_cart_status_history(current_user, cart_id):
    """
    Get status history for a cart item
    """
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        
        # Verify ownership
        cursor.execute("""
            SELECT * FROM cart 
            WHERE cart_id = %s AND user_id = %s
        """, (cart_id, current_user['user_id']))
        
        if not cursor.fetchone():
            cursor.close()
            conn.close()
            return APIResponse.error(
                message='Cart item not found',
                status_code=404
            )
        
        # Get history
        cursor.execute("""
            SELECT 
                h.*,
                u.full_name as changed_by_name
            FROM cart_status_history h
            LEFT JOIN users u ON h.changed_by = u.user_id
            WHERE h.cart_id = %s
            ORDER BY h.created_at DESC
        """, (cart_id,))
        
        history = cursor.fetchall()
        
        formatted_history = [{
            'oldStatus': h['old_status'],
            'newStatus': h['new_status'],
            'changedBy': h['changed_by_name'],
            'notes': h['notes'],
            'timestamp': h['created_at'].isoformat()
        } for h in history]
        
        cursor.close()
        conn.close()
        
        print(f"✅ Retrieved {len(formatted_history)} history records for cart {cart_id}")
        
        return APIResponse.success(
            message='Status history retrieved',
            data={'history': formatted_history}
        )
        
    except Exception as e:
        print(f"❌ Error fetching history: {str(e)}")
        return APIResponse.error(
            message='Failed to fetch status history',
            errors=str(e),
            status_code=500
        )


@cart_bp.route('/api/cart/clear', methods=['DELETE'])
@token_required
def clear_cart(current_user):
    """
    Clear all items from user's cart
    """
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        cursor.execute("""
            DELETE FROM cart 
            WHERE user_id = %s AND status = 'pending'
        """, (current_user['user_id'],))
        
        deleted_count = cursor.rowcount
        conn.commit()
        
        cursor.close()
        conn.close()
        
        print(f"✅ Cleared {deleted_count} items from cart for user {current_user['user_id']}")
        
        return APIResponse.success(
            message=f'Cleared {deleted_count} items from cart',
            data={'deletedCount': deleted_count}
        )
        
    except Exception as e:
        print(f"❌ Error clearing cart: {str(e)}")
        return APIResponse.error(
            message='Failed to clear cart',
            errors=str(e),
            status_code=500
        )


@cart_bp.route('/api/cart/summary', methods=['GET'])
@token_required
def get_cart_summary(current_user):
    """
    Get cart summary (total items, total price)
    """
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        
        cursor.execute("""
            SELECT 
                COUNT(*) as total_items,
                COALESCE(SUM(total_price), 0) as total_price
            FROM cart
            WHERE user_id = %s AND status = 'pending'
        """, (current_user['user_id'],))
        
        summary = cursor.fetchone()
        
        cursor.close()
        conn.close()
        
        return APIResponse.success(
            message='Cart summary retrieved',
            data={
                'totalItems': summary['total_items'],
                'totalPrice': float(summary['total_price'])
            }
        )
        
    except Exception as e:
        print(f"❌ Error fetching cart summary: {str(e)}")
        return APIResponse.error(
            message='Failed to fetch cart summary',
            errors=str(e),
            status_code=500
        )


# ============================================
# ADMIN ROUTES
# ============================================

@cart_bp.route('/api/admin/cart/<int:cart_id>/status', methods=['PUT'])
@token_required
def update_cart_status_admin(current_user, cart_id):
    """
    Update cart item status (Admin only)
    """
    try:
        data = request.get_json()
        
        if 'status' not in data:
            return APIResponse.error(
                message='Status is required',
                status_code=400
            )
        
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Update status using stored procedure
        cursor.callproc('sp_update_cart_status', [
            cart_id,
            data['status'],
            current_user['user_id'],
            data.get('notes', f"Status updated to {data['status']}")
        ])
        
        conn.commit()
        cursor.close()
        conn.close()
        
        print(f"✅ Cart status updated: {cart_id} -> {data['status']}")
        
        return APIResponse.success(
            message='Status updated successfully',
            data={'cartId': cart_id, 'newStatus': data['status']}
        )
        
    except Exception as e:
        print(f"❌ Error updating status: {str(e)}")
        return APIResponse.error(
            message='Failed to update status',
            errors=str(e),
            status_code=500
        )


@cart_bp.route('/api/admin/cart/all', methods=['GET'])
@token_required
def get_all_cart_items_admin(current_user):
    """
    Get all cart items from all users (Admin only)
    """
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        
        # Get status filter if provided
        status = request.args.get('status')
        
        if status:
            query = """
                SELECT 
                    c.*,
                    u.full_name,
                    u.email,
                    u.phone
                FROM cart c
                JOIN users u ON c.user_id = u.user_id
                WHERE c.status = %s
                ORDER BY c.created_at DESC
            """
            cursor.execute(query, (status,))
        else:
            query = """
                SELECT 
                    c.*,
                    u.full_name,
                    u.email,
                    u.phone
                FROM cart c
                JOIN users u ON c.user_id = u.user_id
                ORDER BY c.created_at DESC
            """
            cursor.execute(query)
        
        items = cursor.fetchall()
        
        formatted_items = []
        for item in items:
            formatted_items.append({
                'cartId': item['cart_id'],
                'userId': item['user_id'],
                'userName': item['full_name'],
                'userEmail': item['email'],
                'userPhone': item['phone'],
                'serviceId': item['service_id'],
                'serviceName': item['service_name'],
                'quantity': item['quantity'],
                'unitPrice': float(item['unit_price']),
                'totalPrice': float(item['total_price']),
                'unit': item['unit'],
                'pickupDate': item['pickup_date'].strftime('%Y-%m-%d'),
                'pickupTime': item['pickup_time'],
                'pickupAddress': item['pickup_address'],
                'specialInstructions': item['special_instructions'],
                'status': item['status'],
                'createdAt': item['created_at'].isoformat(),
                'updatedAt': item['updated_at'].isoformat()
            })
        
        cursor.close()
        conn.close()
        
        return APIResponse.success(
            message=f'Retrieved {len(formatted_items)} cart items',
            data={'cartItems': formatted_items}
        )
        
    except Exception as e:
        print(f"❌ Error fetching all cart items: {str(e)}")
        return APIResponse.error(
            message='Failed to fetch cart items',
            errors=str(e),
            status_code=500
        )


# ============================================
# ROUTE INFORMATION
# ============================================

# ============================================================
# ✅ CART CHECKOUT — Place order for all pending cart items
# ============================================================

def _generate_order_number():
    date_str = datetime.now().strftime('%Y%m%d')
    suffix = ''.join(random.choices(string.ascii_uppercase + string.digits, k=6))
    return f"CL-{date_str}-{suffix}"


def _send_cart_order_email(user_email, user_name, order_number, items, total_amount, payment_method, delivery_type):
    """Send attractive HTML confirmation email for cart checkout."""
    try:
        payment_label = "Cash on Delivery" if payment_method == 'cod' else "Online / UPI"
        payment_icon  = "💵" if payment_method == 'cod' else "📱"
        delivery_map  = {'express': 'Express (24 hrs)', 'standard': 'Standard (48 hrs)', 'economy': 'Economy (72 hrs)'}
        delivery_label = delivery_map.get(delivery_type, delivery_type)
        placed_at     = datetime.now().strftime('%d %b %Y, %I:%M %p')

        # Build items table rows
        items_rows = ""
        for item in items:
            items_rows += f"""
            <tr style="border-bottom:1px solid #e5e7eb;">
              <td style="padding:10px 14px;color:#374151;font-size:13px;">🧺 {item['service_name']}</td>
              <td style="padding:10px 14px;text-align:center;color:#374151;font-size:13px;">{item['quantity']} {item['unit']}</td>
              <td style="padding:10px 14px;text-align:right;font-weight:700;color:#7c3aed;font-size:13px;">₹{item['total_price']}</td>
            </tr>"""

        html_body = f"""
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f0f4ff;font-family:'Segoe UI',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f4ff;padding:30px 0;">
  <tr><td align="center">
    <table width="560" cellpadding="0" cellspacing="0"
           style="background:#fff;border-radius:20px;overflow:hidden;
                  box-shadow:0 8px 40px rgba(124,58,237,0.15);max-width:560px;">

      <!-- HEADER -->
      <tr>
        <td style="background:linear-gradient(135deg,#7c3aed,#a855f7,#c084fc);padding:36px 30px;text-align:center;">
          <div style="font-size:40px;margin-bottom:10px;">👕</div>
          <h1 style="margin:0 0 4px;color:#fff;font-size:24px;font-weight:800;">Cleanify Laundry</h1>
          <p style="margin:0;color:rgba(255,255,255,0.85);font-size:13px;">Premium Laundry & Dry Cleaning Services</p>
        </td>
      </tr>

      <!-- SUCCESS -->
      <tr>
        <td style="padding:28px 30px 0;text-align:center;">
          <div style="display:inline-block;background:#dcfce7;border-radius:50px;padding:7px 20px;margin-bottom:14px;">
            <span style="color:#16a34a;font-weight:700;font-size:12px;">✅ &nbsp; ORDER CONFIRMED</span>
          </div>
          <h2 style="margin:0 0 6px;color:#1e1b4b;font-size:22px;font-weight:800;">Thank You, {user_name}! 🎉</h2>
          <p style="margin:0;color:#6b7280;font-size:14px;line-height:1.6;">
            Your cart order has been placed successfully.<br>We'll be there at pickup time!
          </p>
        </td>
      </tr>

      <!-- ORDER NUMBER -->
      <tr>
        <td style="padding:20px 30px 0;">
          <div style="background:linear-gradient(135deg,#ede9fe,#f3e8ff);border-radius:12px;
                      padding:16px 20px;border-left:4px solid #7c3aed;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td>
                  <span style="color:#7c3aed;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:1px;">Order Number</span><br>
                  <span style="color:#1e1b4b;font-size:20px;font-weight:800;">{order_number}</span>
                </td>
                <td align="right">
                  <span style="color:#7c3aed;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:1px;">Placed On</span><br>
                  <span style="color:#374151;font-size:12px;font-weight:600;">{placed_at}</span>
                </td>
              </tr>
            </table>
          </div>
        </td>
      </tr>

      <!-- ITEMS TABLE -->
      <tr>
        <td style="padding:20px 30px 0;">
          <h3 style="margin:0 0 12px;color:#1e1b4b;font-size:15px;font-weight:700;">📋 Items Ordered</h3>
          <table width="100%" cellpadding="0" cellspacing="0"
                 style="border:1px solid #e5e7eb;border-radius:10px;overflow:hidden;">
            <tr style="background:#f9fafb;">
              <th style="padding:10px 14px;text-align:left;font-size:12px;color:#6b7280;font-weight:600;">Service</th>
              <th style="padding:10px 14px;text-align:center;font-size:12px;color:#6b7280;font-weight:600;">Qty</th>
              <th style="padding:10px 14px;text-align:right;font-size:12px;color:#6b7280;font-weight:600;">Price</th>
            </tr>
            {items_rows}
          </table>
        </td>
      </tr>

      <!-- ORDER INFO -->
      <tr>
        <td style="padding:16px 30px 0;">
          <table width="100%" cellpadding="0" cellspacing="0"
                 style="border:1px solid #e5e7eb;border-radius:10px;overflow:hidden;">
            <tr style="background:#f9fafb;"><td style="padding:9px 14px;color:#6b7280;font-size:13px;width:45%;">🚚 Delivery Type</td><td style="padding:9px 14px;color:#111827;font-size:13px;font-weight:600;">{delivery_label}</td></tr>
            <tr style="border-top:1px solid #e5e7eb;"><td style="padding:9px 14px;color:#6b7280;font-size:13px;">{payment_icon} Payment</td><td style="padding:9px 14px;color:#111827;font-size:13px;font-weight:600;">{payment_label}</td></tr>
          </table>
        </td>
      </tr>

      <!-- TOTAL -->
      <tr>
        <td style="padding:16px 30px 0;">
          <div style="background:linear-gradient(135deg,#1e1b4b,#3730a3);border-radius:12px;padding:16px 20px;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="color:rgba(255,255,255,0.75);font-size:13px;">Total Amount Payable</td>
                <td align="right" style="color:#fff;font-size:24px;font-weight:800;">₹{total_amount}</td>
              </tr>
            </table>
          </div>
        </td>
      </tr>

      <!-- WHAT NEXT -->
      <tr>
        <td style="padding:22px 30px 0;">
          <h3 style="margin:0 0 14px;color:#1e1b4b;font-size:15px;font-weight:700;">🚀 What Happens Next?</h3>
          <table width="100%" cellpadding="0" cellspacing="0">
            {''.join([f'''<tr><td style="vertical-align:top;padding-right:12px;width:36px;">
              <div style="width:30px;height:30px;background:linear-gradient(135deg,#7c3aed,#a855f7);
                          border-radius:50%;text-align:center;line-height:30px;color:#fff;font-weight:800;font-size:13px;">{s[0]}</div>
            </td><td style="padding-bottom:12px;">
              <div style="font-weight:700;color:#1e1b4b;font-size:13px;">{s[1]}</div>
              <div style="color:#6b7280;font-size:12px;margin-top:1px;">{s[2]}</div>
            </td></tr>''' for s in [
              (1,"Order Confirmed","We've received your cart order and it's being processed."),
              (2,"Pickup Scheduled","Our team will arrive at your scheduled pickup time."),
              (3,"Expert Cleaning","Premium cleaning with professional care."),
              (4,"Delivery","Your fresh laundry delivered back to you. ✨"),
            ]])}
          </table>
        </td>
      </tr>

      <!-- FOOTER -->
      <tr>
        <td style="padding:24px 30px 28px;text-align:center;border-top:1px solid #f3f4f6;margin-top:16px;">
          <p style="margin:0 0 4px;color:#374151;font-size:13px;font-weight:600;">Questions? We're here!</p>
          <p style="margin:0 0 16px;color:#6b7280;font-size:12px;">
           Contact us at <a href="mailto:support@quicklaundry.com" style="color:#7c3aed;">support@quicklaundry.com</a>
          </p>
          <p style="margin:0;color:#c4b5fd;font-size:20px;">👕 ✨ 🧺</p>
        </td>
      </tr>
    </table>
  </td></tr>
</table>
</body>
</html>"""

        import requests as req
        resend_api_key = os.getenv('RESEND_API_KEY', '')
        email_from     = os.getenv('EMAIL_FROM', 'onboarding@resend.dev')

        if not resend_api_key:
            print("⚠️ RESEND_API_KEY not set — skipping email")
            return False

        response = req.post(
            "https://api.resend.com/emails",
            headers={
                "Authorization": f"Bearer {resend_api_key}",
                "Content-Type": "application/json"
            },
            json={
                "from": f"Cleanify Laundry <{email_from}>",
                "to": [user_email],
                "subject": f"✅ Cart Order Confirmed #{order_number} – Cleanify Laundry",
                "html": html_body
            },
            timeout=10
        )

        if response.status_code in (200, 201):
            print(f"✅ Cart checkout email sent to {user_email} for order {order_number}")
            return True
        else:
            print(f"❌ Cart email failed: {response.status_code} - {response.text}")
            return False

        print(f"✅ Cart checkout email sent to {user_email} for order {order_number}")
        return True

    except Exception as e:
        print(f"⚠️ Cart email failed (non-critical): {e}")
        return False


@cart_bp.route('/api/cart/checkout', methods=['OPTIONS'])
def cart_checkout_preflight():
    return make_response('', 200)


@cart_bp.route('/api/cart/checkout', methods=['POST'])
@token_required
def cart_checkout(current_user):
    """
    Checkout all pending cart items — create one order per item,
    send confirmation email, and clear the cart.
    """
    try:
        data         = request.get_json(silent=True) or {}
        user_id      = current_user['user_id']
        payment_method  = str(data.get('paymentMethod', 'cod'))
        delivery_type   = str(data.get('deliveryType', 'standard'))
        special_notes   = str(data.get('specialInstructions', ''))

        if payment_method not in ('cod', 'online', 'wallet'):
            payment_method = 'cod'
        if delivery_type not in ('express', 'standard', 'economy'):
            delivery_type = 'standard'

        conn   = get_db_connection()
        cursor = conn.cursor(dictionary=True)

        try:
            # Fetch pending cart items
            cursor.execute("""
                SELECT cart_id, service_id, service_name, quantity,
                       unit_price, total_price, unit,
                       pickup_date, pickup_time, pickup_address, special_instructions
                FROM cart
                WHERE user_id = %s AND status = 'pending'
                ORDER BY created_at ASC
            """, (user_id,))
            pending_items = cursor.fetchall()

            if not pending_items:
                return APIResponse.error(message='No pending items in cart', status_code=400)

            # ── SERVICE AREA CHECK — validate pincode of first item's address ──
            first_pincode = (
                data.get('pincode') or
                extract_pincode_from_address(pending_items[0].get('pickup_address', ''))
            )
            if first_pincode:
                serviceable, area_or_msg = is_pincode_serviceable(first_pincode)
                if not serviceable:
                    print(f"🚫 Checkout blocked — pincode {first_pincode} outside service zone")
                    return APIResponse.error(
                        message=area_or_msg,
                        errors={'pincode': first_pincode, 'serviceable': False},
                        status_code=400
                    )
                print(f"✅ Checkout pincode {first_pincode} → {area_or_msg}")
            # ─────────────────────────────────────────────────────────────────

            # Compute totals
            subtotal      = sum(float(i['total_price']) for i in pending_items)
            delivery_charge = 50.0 if delivery_type == 'express' else (-30.0 if delivery_type == 'economy' else 0.0)
            total_amount  = round(subtotal + delivery_charge, 2)
            order_number  = _generate_order_number()

            # Use the pickup details from the first cart item
            first_item = pending_items[0]
            pickup_address = first_item['pickup_address']
            pickup_date    = first_item['pickup_date']
            pickup_time    = first_item['pickup_time']

            # Create ONE order for all cart items
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

            # Insert each cart item as an order item
            for item in pending_items:
                cursor.execute("""
                    INSERT INTO order_items
                      (order_id, service_id, service_name, quantity, unit_price, total_price, unit)
                    VALUES (%s,%s,%s,%s,%s,%s,%s)
                """, (
                    order_id,
                    item['service_id'], item['service_name'],
                    item['quantity'], item['unit_price'],
                    item['total_price'], item['unit']
                ))

            # Status history
            cursor.execute("""
                INSERT INTO order_status_history
                  (order_id, old_status, new_status, changed_by, notes)
                VALUES (%s, NULL, 'pending', %s, 'Cart checkout by customer')
            """, (order_id, user_id))

            # Admin notification (non-critical)
            try:
                cursor.execute("""
                    INSERT INTO admin_notifications
                      (notification_type, title, message, related_id)
                    VALUES ('new_order','New Cart Order',%s,%s)
                """, (
                    f"Order #{order_number} — {len(pending_items)} items — ₹{total_amount}",
                    order_id
                ))
            except Exception as notif_err:
                print(f"⚠️ Admin notification skipped: {notif_err}")

            # Clear the pending cart items
            cart_ids = [str(i['cart_id']) for i in pending_items]
            cursor.execute(
                f"DELETE FROM cart WHERE cart_id IN ({','.join(['%s']*len(cart_ids))})",
                cart_ids
            )

            conn.commit()

            print(f"✅ Cart checkout: #{order_number} | {len(pending_items)} items | ₹{total_amount} | user:{user_id}")

            # Send confirmation email (non-blocking)
            try:
                cursor.execute(
                    "SELECT full_name, email FROM users WHERE user_id = %s", (user_id,)
                )
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
                print(f"⚠️ Email step failed (non-critical): {mail_err}")

            return APIResponse.success(
                message='Order placed successfully',
                data={
                    'orderId':      order_id,
                    'orderNumber':  order_number,
                    'itemsCount':   len(pending_items),
                    'subtotal':     subtotal,
                    'deliveryCharge': delivery_charge,
                    'totalAmount':  total_amount,
                    'status':       'pending',
                    'paymentStatus':'pending'
                }
            )

        except Exception as e:
            conn.rollback()
            raise e

        finally:
            cursor.close()
            conn.close()

    except Exception as e:
        print(f"❌ cart_checkout error: {e}")
        print(traceback.format_exc())
        return APIResponse.error(
            message='Failed to place order. Please try again.',
            errors=str(e),
            status_code=500
        )


@cart_bp.route('/api/cart/info', methods=['GET'])
def cart_routes_info():
    """
    Get information about available cart routes
    """
    routes = {
        'customer_routes': {
            'add_to_cart': {
                'method': 'POST',
                'path': '/api/cart/add',
                'auth': 'required',
                'description': 'Add item to cart'
            },
            'get_cart': {
                'method': 'GET',
                'path': '/api/cart',
                'auth': 'required',
                'description': 'Get all cart items'
            },
            'remove_item': {
                'method': 'DELETE',
                'path': '/api/cart/<cart_id>',
                'auth': 'required',
                'description': 'Remove item from cart'
            },
            'update_item': {
                'method': 'PUT',
                'path': '/api/cart/<cart_id>',
                'auth': 'required',
                'description': 'Update cart item quantity'
            },
            'get_status_history': {
                'method': 'GET',
                'path': '/api/cart/<cart_id>/status',
                'auth': 'required',
                'description': 'Get status history'
            },
            'clear_cart': {
                'method': 'DELETE',
                'path': '/api/cart/clear',
                'auth': 'required',
                'description': 'Clear all pending items'
            },
            'get_summary': {
                'method': 'GET',
                'path': '/api/cart/summary',
                'auth': 'required',
                'description': 'Get cart summary'
            }
        },
        'admin_routes': {
            'update_status': {
                'method': 'PUT',
                'path': '/api/admin/cart/<cart_id>/status',
                'auth': 'admin',
                'description': 'Update cart item status'
            },
            'get_all_items': {
                'method': 'GET',
                'path': '/api/admin/cart/all',
                'auth': 'admin',
                'description': 'Get all cart items (all users)'
            }
        }
    }
    
    return APIResponse.success(
        data=routes,
        message='Cart routes information'
    )