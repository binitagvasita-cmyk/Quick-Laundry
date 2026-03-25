"""
============================================
ADMIN ORDER MANAGEMENT ROUTES
Updated: New status flow with assigned_to_laundry + COD cash tracking
Status Flow:
  pending → confirmed → picked_up → assigned_to_laundry → ready → out_for_delivery → delivered
  COD: delivery boy marks cash_collected, admin confirms cash_received
============================================
"""

from flask import Blueprint, request, jsonify
from database.db import get_db
from utils.auth_middleware import admin_required
from datetime import datetime
import pymysql.cursors

admin_orders_bp = Blueprint('admin_orders', __name__, url_prefix='/api/admin/orders')

# Valid status flow
STATUS_FLOW = [
    'pending', 'confirmed', 'picked_up', 'assigned_to_laundry',
    'ready', 'out_for_delivery', 'delivered', 'cancelled'
]

VALID_PAYMENT_STATUSES = ['pending', 'paid', 'failed', 'refunded', 'cash_collected', 'cash_received']


class APIResponse:
    @staticmethod
    def success(data=None, message="Success", status_code=200):
        response = {
            'success': True,
            'message': message,
            'timestamp': datetime.utcnow().isoformat()
        }
        if data is not None:
            response['data'] = data
        return jsonify(response), status_code

    @staticmethod
    def error(message, data=None, status_code=400):
        response = {
            'success': False,
            'message': message,
            'timestamp': datetime.utcnow().isoformat()
        }
        if data is not None:
            response['data'] = data
        return jsonify(response), status_code


# ============================================
# GET ALL ORDERS (with filters + pagination)
# ============================================

@admin_orders_bp.route('/list', methods=['GET', 'OPTIONS'])
@admin_required
def get_orders(current_user):
    if request.method == 'OPTIONS':
        return '', 204
    try:
        page           = int(request.args.get('page', 1))
        limit          = int(request.args.get('limit', 15))
        status         = request.args.get('status', '').strip()
        payment_status = request.args.get('payment_status', '').strip()
        search         = request.args.get('search', '').strip()
        date_from      = request.args.get('date_from', '').strip()
        date_to        = request.args.get('date_to', '').strip()
        offset         = (page - 1) * limit

        db = get_db()
        cursor = db.connection.cursor(pymysql.cursors.DictCursor)

        query = """
            SELECT
                o.order_id, o.order_number, o.status, o.payment_status,
                o.payment_method, o.delivery_type, o.subtotal,
                o.delivery_charge, o.total_amount, o.pickup_date, o.pickup_time,
                o.pickup_address, o.special_instructions, o.notes,
                o.cancelled_reason, o.created_at, o.updated_at, o.delivered_at,
                o.delivery_boy_id, o.cash_collected_at, o.cash_received_at,
                u.full_name   AS customer_name,
                u.email       AS customer_email,
                u.phone       AS customer_phone,
                db_u.full_name AS delivery_boy_name
            FROM orders o
            LEFT JOIN users u    ON o.user_id         = u.user_id
            LEFT JOIN users db_u ON o.delivery_boy_id = db_u.user_id
            WHERE 1=1
        """
        params = []

        if status:
            query += " AND o.status = %s"
            params.append(status)
        if payment_status:
            query += " AND o.payment_status = %s"
            params.append(payment_status)
        if search:
            query += " AND (o.order_number LIKE %s OR u.full_name LIKE %s OR u.email LIKE %s OR u.phone LIKE %s)"
            s = f"%{search}%"
            params.extend([s, s, s, s])
        if date_from:
            query += " AND DATE(o.created_at) >= %s"
            params.append(date_from)
        if date_to:
            query += " AND DATE(o.created_at) <= %s"
            params.append(date_to)

        count_q = f"SELECT COUNT(*) as total FROM ({query}) as t"
        cursor.execute(count_q, params)
        total = cursor.fetchone()['total']

        query += " ORDER BY o.created_at DESC LIMIT %s OFFSET %s"
        params.extend([limit, offset])
        cursor.execute(query, params)
        orders = cursor.fetchall()

        for order in orders:
            for key, val in order.items():
                if hasattr(val, 'isoformat'):
                    order[key] = val.isoformat()
        cursor.close()

        return APIResponse.success({
            'orders': orders,
            'pagination': {
                'page': page, 'limit': limit, 'total': total,
                'pages': max(1, (total + limit - 1) // limit)
            }
        }, 'Orders retrieved successfully')

    except Exception as e:
        print(f"❌ Get orders error: {e}")
        import traceback; traceback.print_exc()
        return APIResponse.error('Failed to retrieve orders', None, 500)


# ============================================
# GET ORDER STATS
# ============================================

@admin_orders_bp.route('/stats', methods=['GET', 'OPTIONS'])
@admin_required
def get_order_stats(current_user):
    if request.method == 'OPTIONS':
        return '', 204
    try:
        db = get_db()
        cursor = db.connection.cursor(pymysql.cursors.DictCursor)
        cursor.execute("""
            SELECT
                COUNT(*) AS total,
                SUM(status = 'pending')              AS pending,
                SUM(status = 'confirmed')             AS confirmed,
                SUM(status = 'picked_up')             AS picked_up,
                SUM(status = 'assigned_to_laundry')   AS assigned_to_laundry,
                SUM(status = 'ready')                 AS ready,
                SUM(status = 'out_for_delivery')       AS out_for_delivery,
                SUM(status = 'delivered')             AS delivered,
                SUM(status = 'cancelled')             AS cancelled,
                SUM(payment_status = 'paid')          AS payment_paid,
                SUM(payment_status = 'pending')       AS payment_pending,
                SUM(payment_status = 'cash_collected') AS cash_collected,
                SUM(payment_status = 'cash_received')  AS cash_received,
                COALESCE(SUM(CASE WHEN status != 'cancelled' THEN total_amount END), 0) AS total_revenue,
                COALESCE(SUM(CASE WHEN payment_status IN ('paid','cash_received') THEN total_amount END), 0) AS paid_revenue
            FROM orders
        """)
        stats = cursor.fetchone()
        cursor.close()
        return APIResponse.success(stats, 'Stats retrieved')
    except Exception as e:
        print(f"❌ Order stats error: {e}")
        return APIResponse.error('Failed to get stats', None, 500)


# ============================================
# GET SINGLE ORDER DETAIL
# ============================================

@admin_orders_bp.route('/<int:order_id>', methods=['GET', 'OPTIONS'])
@admin_required
def get_order_detail(current_user, order_id):
    if request.method == 'OPTIONS':
        return '', 204
    try:
        db = get_db()
        cursor = db.connection.cursor(pymysql.cursors.DictCursor)

        cursor.execute("""
            SELECT o.*,
                   u.full_name   AS customer_name,
                   u.email       AS customer_email,
                   u.phone       AS customer_phone,
                   db_u.full_name AS delivery_boy_name
            FROM orders o
            LEFT JOIN users u    ON o.user_id         = u.user_id
            LEFT JOIN users db_u ON o.delivery_boy_id = db_u.user_id
            WHERE o.order_id = %s
        """, (order_id,))
        order = cursor.fetchone()
        if not order:
            cursor.close()
            return APIResponse.error('Order not found', None, 404)

        for key, val in order.items():
            if hasattr(val, 'isoformat'):
                order[key] = val.isoformat()

        cursor.execute("""
            SELECT oi.*, s.icon, s.image_path
            FROM order_items oi
            LEFT JOIN services s ON oi.service_id = s.service_id
            WHERE oi.order_id = %s ORDER BY oi.item_id ASC
        """, (order_id,))
        items = cursor.fetchall()
        for item in items:
            for k, v in item.items():
                if hasattr(v, 'isoformat'):
                    item[k] = v.isoformat()

        cursor.execute("""
            SELECT osh.*, u.full_name AS changed_by_name
            FROM order_status_history osh
            LEFT JOIN users u ON osh.changed_by = u.user_id
            WHERE osh.order_id = %s ORDER BY osh.created_at ASC
        """, (order_id,))
        history = cursor.fetchall()
        for h in history:
            for k, v in h.items():
                if hasattr(v, 'isoformat'):
                    h[k] = v.isoformat()

        cursor.close()
        order['items']          = items
        order['status_history'] = history
        return APIResponse.success(order, 'Order detail retrieved')

    except Exception as e:
        print(f"❌ Get order detail error: {e}")
        import traceback; traceback.print_exc()
        return APIResponse.error('Failed to retrieve order detail', None, 500)


# ============================================
# UPDATE ORDER STATUS
# ============================================

@admin_orders_bp.route('/<int:order_id>/status', methods=['PUT', 'OPTIONS'])
@admin_required
def update_order_status(current_user, order_id):
    if request.method == 'OPTIONS':
        return '', 204
    try:
        data       = request.get_json()
        new_status = data.get('status', '').strip()
        notes      = data.get('notes', '').strip()

        if not new_status:
            return APIResponse.error('Status is required', None, 400)
        if new_status not in STATUS_FLOW:
            return APIResponse.error(f'Invalid status. Valid: {", ".join(STATUS_FLOW)}', None, 400)

        db = get_db()
        cursor = db.connection.cursor(pymysql.cursors.DictCursor)

        cursor.execute(
            "SELECT status, payment_method, payment_status, order_number FROM orders WHERE order_id = %s",
            (order_id,)
        )
        order = cursor.fetchone()
        if not order:
            cursor.close()
            return APIResponse.error('Order not found', None, 404)

        old_status = order['status']

        update_fields = ["status = %s", "updated_at = NOW()"]
        update_params = [new_status]

        if new_status == 'delivered':
            update_fields.append("delivered_at = NOW()")
            if order['payment_method'] == 'cod' and order['payment_status'] == 'pending':
                update_fields.append("payment_status = 'paid'")

        if notes:
            update_fields.append("notes = %s")
            update_params.append(notes)

        update_params.append(order_id)
        cursor.execute(
            f"UPDATE orders SET {', '.join(update_fields)} WHERE order_id = %s",
            update_params
        )

        cursor.execute("""
            INSERT INTO order_status_history
              (order_id, old_status, new_status, changed_by, notes, created_at)
            VALUES (%s, %s, %s, %s, %s, NOW())
        """, (order_id, old_status, new_status, current_user['user_id'],
              notes or f"Status changed from {old_status} to {new_status}"))

        db.connection.commit()

        # Admin activity log
        try:
            cursor.execute("""
                INSERT INTO admin_activity_logs
                  (admin_id, action_type, action_description, ip_address)
                VALUES (%s, %s, %s, %s)
            """, (current_user['user_id'], 'order_status_change',
                  f"Order {order['order_number']}: {old_status} → {new_status}",
                  request.remote_addr))
            db.connection.commit()
        except:
            pass

        # Notify user on confirmed
        if new_status == 'confirmed':
            try:
                cursor.execute("SELECT user_id FROM orders WHERE order_id = %s", (order_id,))
                row = cursor.fetchone()
                if row:
                    cursor.execute("""
                        INSERT INTO user_notifications (user_id, title, message, related_order_id)
                        VALUES (%s, %s, %s, %s)
                    """, (row['user_id'], '✅ Order Accepted!',
                          f"Your order {order['order_number']} has been accepted. We will soon pick up your clothes!",
                          order_id))
                    db.connection.commit()
            except Exception as un_err:
                print(f"⚠️ User notification skipped: {un_err}")

        # Notify user when ready
        if new_status == 'ready':
            try:
                cursor.execute("SELECT user_id FROM orders WHERE order_id = %s", (order_id,))
                row = cursor.fetchone()
                if row:
                    cursor.execute("""
                        INSERT INTO user_notifications (user_id, title, message, related_order_id)
                        VALUES (%s, %s, %s, %s)
                    """, (row['user_id'], '🧺 Laundry Ready!',
                          f"Your order {order['order_number']} is clean and ready for delivery!",
                          order_id))
                    db.connection.commit()
            except Exception as un_err:
                print(f"⚠️ User notification skipped: {un_err}")

        cursor.close()
        return APIResponse.success({
            'order_id': order_id, 'old_status': old_status, 'new_status': new_status
        }, f'Order status updated to {new_status}')

    except Exception as e:
        print(f"❌ Update order status error: {e}")
        import traceback; traceback.print_exc()
        return APIResponse.error('Failed to update order status', None, 500)


# ============================================
# UPDATE PAYMENT STATUS
# ============================================

@admin_orders_bp.route('/<int:order_id>/payment', methods=['PUT', 'OPTIONS'])
@admin_required
def update_payment_status(current_user, order_id):
    if request.method == 'OPTIONS':
        return '', 204
    try:
        data               = request.get_json()
        new_payment_status = data.get('payment_status', '').strip()

        if not new_payment_status:
            return APIResponse.error('payment_status is required', None, 400)
        if new_payment_status not in VALID_PAYMENT_STATUSES:
            return APIResponse.error(f'Invalid payment status. Valid: {", ".join(VALID_PAYMENT_STATUSES)}', None, 400)

        db = get_db()
        cursor = db.connection.cursor(pymysql.cursors.DictCursor)

        cursor.execute(
            "SELECT payment_status, payment_method, order_number FROM orders WHERE order_id = %s",
            (order_id,)
        )
        order = cursor.fetchone()
        if not order:
            cursor.close()
            return APIResponse.error('Order not found', None, 404)

        old_payment_status = order['payment_status']
        update_fields      = ["payment_status = %s", "updated_at = NOW()"]
        update_params      = [new_payment_status]

        # Track cash_received timestamp
        if new_payment_status == 'cash_received':
            update_fields.append("cash_received_at = NOW()")

        update_params.append(order_id)
        cursor.execute(
            f"UPDATE orders SET {', '.join(update_fields)} WHERE order_id = %s",
            update_params
        )
        db.connection.commit()

        try:
            cursor.execute("""
                INSERT INTO admin_activity_logs
                  (admin_id, action_type, action_description, ip_address)
                VALUES (%s, %s, %s, %s)
            """, (current_user['user_id'], 'payment_status_change',
                  f"Order {order['order_number']}: payment {old_payment_status} → {new_payment_status}",
                  request.remote_addr))
            db.connection.commit()
        except:
            pass

        try:
            if new_payment_status in ('paid', 'cash_received'):
                cursor.execute("""
                    INSERT INTO admin_notifications
                      (notification_type, title, message, related_id)
                    VALUES ('payment_received', %s, %s, %s)
                """, (
                    f"Payment Confirmed — Order #{order['order_number']}",
                    f"Payment confirmed for order {order['order_number']} via {order['payment_method'].upper()}",
                    order_id
                ))
                db.connection.commit()
        except:
            pass

        cursor.close()
        return APIResponse.success({
            'order_id': order_id,
            'old_payment_status': old_payment_status,
            'new_payment_status': new_payment_status
        }, f'Payment status updated to {new_payment_status}')

    except Exception as e:
        print(f"❌ Update payment status error: {e}")
        import traceback; traceback.print_exc()
        return APIResponse.error('Failed to update payment status', None, 500)


# ============================================
# CONFIRM CASH RECEIVED FROM DELIVERY BOY (COD)
# ============================================

@admin_orders_bp.route('/<int:order_id>/cash-received', methods=['PUT', 'OPTIONS'])
@admin_required
def confirm_cash_received(current_user, order_id):
    """Admin confirms cash received from delivery boy for COD orders"""
    if request.method == 'OPTIONS':
        return '', 204
    try:
        db = get_db()
        cursor = db.connection.cursor(pymysql.cursors.DictCursor)

        cursor.execute(
            "SELECT payment_status, payment_method, order_number, status FROM orders WHERE order_id = %s",
            (order_id,)
        )
        order = cursor.fetchone()
        if not order:
            cursor.close()
            return APIResponse.error('Order not found', None, 404)

        if order['payment_method'] != 'cod':
            cursor.close()
            return APIResponse.error('This action is only for COD orders', None, 400)

        if order['payment_status'] != 'cash_collected':
            cursor.close()
            return APIResponse.error(
                'Delivery boy has not marked cash as collected yet', None, 400
            )

        cursor.execute("""
            UPDATE orders
            SET payment_status = 'cash_received', cash_received_at = NOW(),
                updated_at = NOW()
            WHERE order_id = %s
        """, (order_id,))
        db.connection.commit()

        try:
            cursor.execute("""
                INSERT INTO admin_activity_logs
                  (admin_id, action_type, action_description, ip_address)
                VALUES (%s, 'cash_received', %s, %s)
            """, (current_user['user_id'],
                  f"Cash received from delivery boy for order {order['order_number']}",
                  request.remote_addr))
            db.connection.commit()
        except:
            pass

        cursor.close()
        return APIResponse.success(None,
            f"Cash received confirmed for order {order['order_number']} ✅")

    except Exception as e:
        print(f"❌ Cash received error: {e}")
        return APIResponse.error('Failed to confirm cash received', None, 500)


# ============================================
# ADD ADMIN NOTE
# ============================================

@admin_orders_bp.route('/<int:order_id>/note', methods=['PUT', 'OPTIONS'])
@admin_required
def add_order_note(current_user, order_id):
    if request.method == 'OPTIONS':
        return '', 204
    try:
        data = request.get_json()
        note = data.get('notes', '').strip()
        db = get_db()
        cursor = db.connection.cursor(pymysql.cursors.DictCursor)
        cursor.execute("SELECT order_id FROM orders WHERE order_id = %s", (order_id,))
        if not cursor.fetchone():
            cursor.close()
            return APIResponse.error('Order not found', None, 404)
        cursor.execute(
            "UPDATE orders SET notes = %s, updated_at = NOW() WHERE order_id = %s",
            (note, order_id)
        )
        db.connection.commit()
        cursor.close()
        return APIResponse.success(None, 'Note saved successfully')
    except Exception as e:
        print(f"❌ Add note error: {e}")
        return APIResponse.error('Failed to save note', None, 500)


# ============================================
# CANCEL ORDER
# ============================================

@admin_orders_bp.route('/<int:order_id>/cancel', methods=['PUT', 'OPTIONS'])
@admin_required
def cancel_order(current_user, order_id):
    if request.method == 'OPTIONS':
        return '', 204
    try:
        data   = request.get_json()
        reason = data.get('reason', 'Cancelled by admin').strip()
        db     = get_db()
        cursor = db.connection.cursor(pymysql.cursors.DictCursor)

        cursor.execute(
            "SELECT status, payment_status, order_number FROM orders WHERE order_id = %s", (order_id,)
        )
        order = cursor.fetchone()
        if not order:
            cursor.close()
            return APIResponse.error('Order not found', None, 404)
        if order['status'] == 'delivered':
            cursor.close()
            return APIResponse.error('Cannot cancel a delivered order', None, 400)
        if order['status'] == 'cancelled':
            cursor.close()
            return APIResponse.error('Order is already cancelled', None, 400)

        old_status         = order['status']
        new_payment_status = 'refunded' if order['payment_status'] in ('paid', 'cash_received') else order['payment_status']

        cursor.execute("""
            UPDATE orders
            SET status = 'cancelled', cancelled_reason = %s,
                cancelled_at = NOW(), updated_at = NOW(), payment_status = %s
            WHERE order_id = %s
        """, (reason, new_payment_status, order_id))

        cursor.execute("""
            INSERT INTO order_status_history
              (order_id, old_status, new_status, changed_by, notes, created_at)
            VALUES (%s, %s, 'cancelled', %s, %s, NOW())
        """, (order_id, old_status, current_user['user_id'], f"Cancelled: {reason}"))

        db.connection.commit()

        try:
            cursor.execute("""
                INSERT INTO admin_activity_logs
                  (admin_id, action_type, action_description, ip_address)
                VALUES (%s, 'order_cancel', %s, %s)
            """, (current_user['user_id'],
                  f"Cancelled order {order['order_number']}: {reason}",
                  request.remote_addr))
            db.connection.commit()
        except:
            pass

        cursor.close()
        return APIResponse.success(None, 'Order cancelled successfully')

    except Exception as e:
        print(f"❌ Cancel order error: {e}")
        import traceback; traceback.print_exc()
        return APIResponse.error('Failed to cancel order', None, 500)


# ============================================
# GET AVAILABLE DELIVERY BOYS
# ============================================

@admin_orders_bp.route('/delivery-boys', methods=['GET', 'OPTIONS'])
@admin_required
def get_delivery_boys(current_user):
    if request.method == 'OPTIONS':
        return '', 204
    try:
        db = get_db()
        cursor = db.connection.cursor(pymysql.cursors.DictCursor)
        cursor.execute("""
            SELECT u.user_id, u.full_name, u.phone,
                   db2.vehicle_type, db2.vehicle_number, db2.is_available,
                   (SELECT COUNT(*) FROM orders
                    WHERE delivery_boy_id = u.user_id
                      AND status NOT IN ('delivered','cancelled')) AS active_orders
            FROM users u
            JOIN delivery_boys db2 ON u.user_id = db2.user_id
            WHERE u.is_delivery_boy = 1 AND u.is_active = 1
            ORDER BY db2.is_available DESC, u.full_name ASC
        """)
        boys = cursor.fetchall()
        cursor.close()
        return APIResponse.success(boys, f'{len(boys)} delivery boys found')
    except Exception as e:
        print(f"❌ Get delivery boys error: {e}")
        return APIResponse.error('Failed to fetch delivery boys', None, 500)


# ============================================
# ASSIGN DELIVERY BOY TO ORDER
# ============================================

@admin_orders_bp.route('/<int:order_id>/assign', methods=['PUT', 'OPTIONS'])
@admin_required
def assign_delivery_boy(current_user, order_id):
    if request.method == 'OPTIONS':
        return '', 204
    try:
        data            = request.get_json()
        delivery_boy_id = data.get('delivery_boy_id')
        if not delivery_boy_id:
            return APIResponse.error('delivery_boy_id is required', None, 400)

        db = get_db()
        cursor = db.connection.cursor(pymysql.cursors.DictCursor)

        cursor.execute(
            "SELECT order_id, user_id, status, order_number, delivery_boy_id FROM orders WHERE order_id = %s",
            (order_id,)
        )
        order = cursor.fetchone()
        if not order:
            cursor.close()
            return APIResponse.error('Order not found', None, 404)
        if order['status'] in ('delivered', 'cancelled'):
            cursor.close()
            return APIResponse.error('Cannot assign a delivered or cancelled order', None, 400)

        cursor.execute("""
            SELECT u.user_id, u.full_name
            FROM users u JOIN delivery_boys db2 ON u.user_id = db2.user_id
            WHERE u.user_id = %s AND u.is_delivery_boy = 1 AND u.is_active = 1
        """, (delivery_boy_id,))
        boy = cursor.fetchone()
        if not boy:
            cursor.close()
            return APIResponse.error('Delivery boy not found or inactive', None, 404)

        old_status = order['status']
        cursor.execute("""
            UPDATE orders
            SET delivery_boy_id = %s, status = 'confirmed', updated_at = NOW()
            WHERE order_id = %s
        """, (delivery_boy_id, order_id))

        cursor.execute("""
            INSERT INTO order_status_history
              (order_id, old_status, new_status, changed_by, notes, created_at)
            VALUES (%s, %s, 'confirmed', %s, %s, NOW())
        """, (order_id, old_status, current_user['user_id'],
              f"Assigned to delivery boy: {boy['full_name']}"))

        db.connection.commit()

        try:
            cursor.execute("""
                INSERT INTO admin_activity_logs
                  (admin_id, action_type, action_description, ip_address)
                VALUES (%s, 'order_assign', %s, %s)
            """, (current_user['user_id'],
                  f"Order {order['order_number']} assigned to {boy['full_name']}",
                  request.remote_addr))
            db.connection.commit()
        except:
            pass

        # Notify the customer that a delivery boy has been assigned
        try:
            cursor.execute("""
                INSERT INTO user_notifications (user_id, title, message, related_order_id)
                VALUES (%s, %s, %s, %s)
            """, (
                order['user_id'],
                '🚴 Delivery Boy Assigned!',
                f"{boy['full_name']} has been assigned to collect your clothes. He will arrive soon at your pickup address!",
                order_id
            ))
            db.connection.commit()
        except Exception as notif_err:
            print(f"⚠️ Could not insert user notification: {notif_err}")

        cursor.close()
        return APIResponse.success({
            'order_id': order_id, 'delivery_boy_id': delivery_boy_id,
            'delivery_boy': boy['full_name'], 'new_status': 'confirmed'
        }, f"Order assigned to {boy['full_name']} ✅")

    except Exception as e:
        print(f"❌ Assign delivery boy error: {e}")
        import traceback; traceback.print_exc()
        return APIResponse.error('Failed to assign delivery boy', None, 500)