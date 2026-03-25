"""
============================================================
QUICK LAUNDRY - DELIVERY BOY MAIN ROUTES
Updated: New status flow with assigned_to_laundry + COD cash_collected
Status transitions for delivery boy:
  confirmed → picked_up → assigned_to_laundry
  ready → out_for_delivery → delivered
  COD: delivery boy marks cash_collected after delivery
============================================================
"""

from flask import Blueprint, request
from database.db import get_db
from utils.response import APIResponse
from routes.delivery_auth import delivery_required

delivery_bp = Blueprint('delivery', __name__, url_prefix='/api/delivery')

# Transitions the delivery boy is allowed to make
ALLOWED_TRANSITIONS = {
    'pending':            ['picked_up'],
    'confirmed':          ['picked_up'],
    'picked_up':          ['assigned_to_laundry'],
    'assigned_to_laundry': [],          # Admin moves to ready
    'ready':              ['out_for_delivery'],
    'out_for_delivery':   ['delivered'],
}


# ─────────────────────────────────────────────
# GET /api/delivery/dashboard
# ─────────────────────────────────────────────
@delivery_bp.route('/dashboard', methods=['GET'])
@delivery_required
def dashboard():
    try:
        uid    = request.delivery_user_id
        db     = get_db()
        cursor = db.connection.cursor()

        cursor.execute("""
            SELECT
                COUNT(*) AS total_assigned,
                SUM(CASE WHEN status IN ('confirmed','pending') THEN 1 ELSE 0 END) AS pending_pickup,
                SUM(CASE WHEN status = 'picked_up' THEN 1 ELSE 0 END)             AS picked_up,
                SUM(CASE WHEN status = 'assigned_to_laundry' THEN 1 ELSE 0 END)   AS at_laundry,
                SUM(CASE WHEN status = 'ready' THEN 1 ELSE 0 END)                 AS ready_for_delivery,
                SUM(CASE WHEN status = 'out_for_delivery' THEN 1 ELSE 0 END)      AS out_for_delivery,
                SUM(CASE WHEN status = 'delivered' THEN 1 ELSE 0 END)             AS completed_today
            FROM orders
            WHERE delivery_boy_id = %s AND DATE(created_at) = CURDATE()
        """, (uid,))
        today_stats = cursor.fetchone()

        cursor.execute("""
            SELECT COUNT(*) AS total_all_time,
                   SUM(CASE WHEN status = 'delivered' THEN 1 ELSE 0 END) AS total_delivered,
                   SUM(CASE WHEN payment_status = 'cash_collected' THEN total_amount ELSE 0 END) AS pending_cash
            FROM orders
            WHERE delivery_boy_id = %s
        """, (uid,))
        all_time = cursor.fetchone()

        cursor.execute("""
            SELECT o.order_id, o.order_number, o.status, o.payment_method, o.payment_status,
                   o.pickup_address, o.pickup_date, o.pickup_time,
                   o.total_amount, o.created_at,
                   u.full_name AS customer_name, u.phone AS customer_phone
            FROM orders o JOIN users u ON o.user_id = u.user_id
            WHERE o.delivery_boy_id = %s
            ORDER BY o.updated_at DESC LIMIT 10
        """, (uid,))
        recent = cursor.fetchall()
        cursor.close()

        for r in recent:
            if r.get('total_amount'):
                r['total_amount'] = float(r['total_amount'])
            for k in ['pickup_date', 'created_at']:
                if r.get(k):
                    r[k] = str(r[k])

        # Convert decimals in stats
        if all_time and all_time.get('pending_cash'):
            all_time['pending_cash'] = float(all_time['pending_cash'])

        return APIResponse.success({
            'today':         today_stats,
            'all_time':      all_time,
            'recent_orders': recent
        }, 'Dashboard loaded')

    except Exception as e:
        print(f'❌ Dashboard error: {e}')
        import traceback; traceback.print_exc()
        return APIResponse.error('Failed to load dashboard', None, 500)


# ─────────────────────────────────────────────
# GET /api/delivery/orders
# ─────────────────────────────────────────────
@delivery_bp.route('/orders', methods=['GET'])
@delivery_required
def get_my_orders():
    try:
        uid      = request.delivery_user_id
        status   = request.args.get('status', '')
        page     = int(request.args.get('page', 1))
        per_page = int(request.args.get('per_page', 20))
        offset   = (page - 1) * per_page

        db     = get_db()
        cursor = db.connection.cursor()

        where  = "o.delivery_boy_id = %s"
        params = [uid]
        if status:
            where  += " AND o.status = %s"
            params.append(status)

        cursor.execute(f"SELECT COUNT(*) AS cnt FROM orders o WHERE {where}", params)
        total = cursor.fetchone()['cnt']

        cursor.execute(f"""
            SELECT o.order_id, o.order_number, o.status,
                   o.pickup_address, o.pickup_date, o.pickup_time,
                   o.delivery_type, o.total_amount, o.payment_method,
                   o.payment_status, o.special_instructions,
                   o.created_at, o.updated_at,
                   u.full_name AS customer_name, u.phone AS customer_phone,
                   u.address   AS customer_address
            FROM orders o JOIN users u ON o.user_id = u.user_id
            WHERE {where}
            ORDER BY o.created_at DESC LIMIT %s OFFSET %s
        """, params + [per_page, offset])
        orders = cursor.fetchall()

        for order in orders:
            if order.get('total_amount'):
                order['total_amount'] = float(order['total_amount'])
            for dk in ['pickup_date', 'created_at', 'updated_at']:
                if order.get(dk):
                    order[dk] = str(order[dk])

            cursor.execute("""
                SELECT service_name, quantity, unit_price, total_price, unit
                FROM order_items WHERE order_id = %s
            """, (order['order_id'],))
            items = cursor.fetchall()
            for item in items:
                item['unit_price']  = float(item['unit_price'])  if item.get('unit_price')  else 0
                item['total_price'] = float(item['total_price']) if item.get('total_price') else 0
            order['items'] = items

        cursor.close()
        return APIResponse.success({
            'orders': orders, 'total': total, 'page': page,
            'per_page': per_page, 'pages': (total + per_page - 1) // per_page
        }, 'Orders fetched')

    except Exception as e:
        print(f'❌ Get orders error: {e}')
        import traceback; traceback.print_exc()
        return APIResponse.error('Failed to fetch orders', None, 500)


# ─────────────────────────────────────────────
# GET /api/delivery/orders/<order_id>
# ─────────────────────────────────────────────
@delivery_bp.route('/orders/<int:order_id>', methods=['GET'])
@delivery_required
def get_order_detail(order_id):
    try:
        uid    = request.delivery_user_id
        db     = get_db()
        cursor = db.connection.cursor()

        cursor.execute("""
            SELECT o.*, u.full_name AS customer_name, u.phone AS customer_phone,
                   u.address AS customer_address, u.email AS customer_email
            FROM orders o JOIN users u ON o.user_id = u.user_id
            WHERE o.order_id = %s AND o.delivery_boy_id = %s
        """, (order_id, uid))
        order = cursor.fetchone()
        if not order:
            cursor.close()
            return APIResponse.error('Order not found', None, 404)

        for key in ['subtotal', 'delivery_charge', 'total_amount']:
            if order.get(key) is not None:
                order[key] = float(order[key])
        for key in ['pickup_date', 'created_at', 'updated_at', 'delivered_at',
                    'cash_collected_at', 'cash_received_at']:
            if order.get(key) is not None:
                order[key] = str(order[key])

        cursor.execute("""
            SELECT service_name, quantity, unit_price, total_price, unit
            FROM order_items WHERE order_id = %s
        """, (order_id,))
        items = cursor.fetchall()
        for item in items:
            item['unit_price']  = float(item['unit_price'])  if item.get('unit_price')  else 0
            item['total_price'] = float(item['total_price']) if item.get('total_price') else 0
        order['items'] = items

        cursor.execute("""
            SELECT osh.old_status, osh.new_status, osh.notes, osh.created_at,
                   u.full_name AS changed_by_name
            FROM order_status_history osh
            LEFT JOIN users u ON osh.changed_by = u.user_id
            WHERE osh.order_id = %s ORDER BY osh.created_at ASC
        """, (order_id,))
        history = cursor.fetchall()
        for h in history:
            if h.get('created_at'):
                h['created_at'] = str(h['created_at'])
        order['status_history'] = history
        cursor.close()

        return APIResponse.success(order, 'Order details fetched')

    except Exception as e:
        print(f'❌ Order detail error: {e}')
        import traceback; traceback.print_exc()
        return APIResponse.error('Failed to fetch order details', None, 500)


# ─────────────────────────────────────────────
# PUT /api/delivery/orders/<order_id>/status
# ─────────────────────────────────────────────
@delivery_bp.route('/orders/<int:order_id>/status', methods=['PUT'])
@delivery_required
def update_order_status(order_id):
    try:
        uid        = request.delivery_user_id
        data       = request.get_json()
        new_status = data.get('status', '').strip()
        notes      = data.get('notes', '')

        if not new_status:
            return APIResponse.error('Status is required', None, 400)

        db     = get_db()
        cursor = db.connection.cursor()

        cursor.execute("""
            SELECT status FROM orders
            WHERE order_id = %s AND delivery_boy_id = %s
        """, (order_id, uid))
        order = cursor.fetchone()
        if not order:
            cursor.close()
            return APIResponse.error('Order not found or not assigned to you', None, 404)

        current = order['status']
        allowed = ALLOWED_TRANSITIONS.get(current, [])

        if new_status not in allowed:
            cursor.close()
            return APIResponse.error(
                f'Cannot change from "{current}" to "{new_status}". '
                f'Allowed next: {allowed if allowed else "No transitions available (waiting for admin)"}',
                None, 400
            )

        extra_fields = ""
        if new_status == 'delivered':
            extra_fields = ", delivered_at = NOW()"

        cursor.execute(f"""
            UPDATE orders
            SET status = %s, updated_at = NOW() {extra_fields}
            WHERE order_id = %s
        """, (new_status, order_id))

        cursor.execute("""
            INSERT INTO order_status_history
              (order_id, old_status, new_status, changed_by, notes)
            VALUES (%s, %s, %s, %s, %s)
        """, (order_id, current, new_status, uid,
              notes or f'Status updated by delivery boy to {new_status}'))

        if new_status == 'delivered':
            cursor.execute("""
                UPDATE delivery_boys SET total_delivered = total_delivered + 1
                WHERE user_id = %s
            """, (uid,))

        db.connection.commit()
        cursor.close()

        return APIResponse.success({'new_status': new_status},
            f'Order status updated to {new_status} ✅')

    except Exception as e:
        print(f'❌ Update status error: {e}')
        import traceback; traceback.print_exc()
        return APIResponse.error('Failed to update status', None, 500)


# ─────────────────────────────────────────────
# PUT /api/delivery/orders/<order_id>/cash-collected  (COD only)
# ─────────────────────────────────────────────
@delivery_bp.route('/orders/<int:order_id>/cash-collected', methods=['PUT'])
@delivery_required
def mark_cash_collected(order_id):
    """Delivery boy marks cash collected from customer after COD delivery"""
    try:
        uid    = request.delivery_user_id
        db     = get_db()
        cursor = db.connection.cursor()

        cursor.execute("""
            SELECT status, payment_method, payment_status
            FROM orders WHERE order_id = %s AND delivery_boy_id = %s
        """, (order_id, uid))
        order = cursor.fetchone()
        if not order:
            cursor.close()
            return APIResponse.error('Order not found or not assigned to you', None, 404)

        if order['payment_method'] != 'cod':
            cursor.close()
            return APIResponse.error('This action is only for COD orders', None, 400)

        if order['status'] != 'delivered':
            cursor.close()
            return APIResponse.error('Order must be delivered before marking cash collected', None, 400)

        if order['payment_status'] == 'cash_collected':
            cursor.close()
            return APIResponse.error('Cash already marked as collected', None, 400)

        cursor.execute("""
            UPDATE orders
            SET payment_status = 'cash_collected', cash_collected_at = NOW(), updated_at = NOW()
            WHERE order_id = %s
        """, (order_id,))
        db.connection.commit()
        cursor.close()

        return APIResponse.success(None, 'Cash collected marked ✅. Admin will confirm receipt.')

    except Exception as e:
        print(f'❌ Cash collected error: {e}')
        return APIResponse.error('Failed to mark cash collected', None, 500)


# ─────────────────────────────────────────────
# PUT /api/delivery/availability
# ─────────────────────────────────────────────
@delivery_bp.route('/availability', methods=['PUT'])
@delivery_required
def toggle_availability():
    try:
        data      = request.get_json()
        available = bool(data.get('is_available', True))
        uid       = request.delivery_user_id
        db        = get_db()
        cursor    = db.connection.cursor()
        cursor.execute(
            "UPDATE delivery_boys SET is_available = %s WHERE user_id = %s",
            (available, uid)
        )
        db.connection.commit()
        cursor.close()
        status = 'On Duty 🟢' if available else 'Off Duty 🔴'
        return APIResponse.success({'is_available': available}, f'You are now {status}')
    except Exception as e:
        print(f'❌ Availability error: {e}')
        return APIResponse.error('Failed to update availability', None, 500)


# ─────────────────────────────────────────────
# GET /api/delivery/profile
# ─────────────────────────────────────────────
@delivery_bp.route('/profile', methods=['GET'])
@delivery_required
def get_profile():
    try:
        uid    = request.delivery_user_id
        db     = get_db()
        cursor = db.connection.cursor()
        cursor.execute("""
            SELECT u.user_id, u.full_name, u.email, u.phone,
                   u.address, u.city, u.pincode, u.profile_picture, u.created_at,
                   db2.delivery_id, db2.vehicle_type, db2.vehicle_number,
                   db2.is_available, db2.total_delivered, db2.joined_at
            FROM users u JOIN delivery_boys db2 ON u.user_id = db2.user_id
            WHERE u.user_id = %s
        """, (uid,))
        profile = cursor.fetchone()
        cursor.close()
        if profile:
            for key in ['created_at', 'joined_at']:
                if profile.get(key):
                    profile[key] = str(profile[key])
        return APIResponse.success(profile, 'Profile fetched')
    except Exception as e:
        print(f'❌ Profile error: {e}')
        return APIResponse.error('Failed to fetch profile', None, 500)