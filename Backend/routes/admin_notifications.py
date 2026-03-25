"""
============================================
ADMIN NOTIFICATIONS ROUTES
Shows new orders, new users, new reviews
from the admin_notifications table
============================================
"""

from flask import Blueprint, request, jsonify
from database.db import get_db
from utils.auth_middleware import admin_required
from datetime import datetime
import pymysql.cursors

admin_notifications_bp = Blueprint('admin_notifications', __name__, url_prefix='/api/admin/notifications')


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


@admin_notifications_bp.route('/list', methods=['GET', 'OPTIONS'])
@admin_required
def get_notifications(current_user):
    """
    Get all notifications with extra detail joined from
    orders / users / reviews tables.
    Supports ?type=all|new_order|new_user|new_review&limit=50
    """
    if request.method == 'OPTIONS':
        return '', 204

    try:
        notif_type = request.args.get('type', 'all')
        limit      = int(request.args.get('limit', 50))

        db     = get_db()
        cursor = db.connection.cursor(pymysql.cursors.DictCursor)

        # Base query — pulls everything from admin_notifications
        query = """
            SELECT
                n.notification_id,
                n.notification_type,
                n.title,
                n.message,
                n.related_id,
                n.is_read,
                n.read_at,
                n.created_at
            FROM admin_notifications n
            WHERE 1=1
        """
        params = []

        if notif_type != 'all':
            query += " AND n.notification_type = %s"
            params.append(notif_type)

        query += " ORDER BY n.created_at DESC LIMIT %s"
        params.append(limit)

        cursor.execute(query, params)
        notifications = cursor.fetchall()

        # ── Enrich each notification with extra detail ──────────────
        for n in notifications:
            rid = n.get('related_id')

            if n['notification_type'] == 'new_order' and rid:
                try:
                    cursor.execute("""
                        SELECT o.order_number, o.total_amount, o.status,
                               u.full_name as customer_name, u.email as customer_email
                        FROM orders o
                        LEFT JOIN users u ON o.user_id = u.user_id
                        WHERE o.order_id = %s
                    """, (rid,))
                    order = cursor.fetchone()
                    n['extra'] = order or {}
                except Exception:
                    n['extra'] = {}

            elif n['notification_type'] == 'new_user' and rid:
                try:
                    cursor.execute("""
                        SELECT full_name, email, phone, created_at
                        FROM users WHERE user_id = %s
                    """, (rid,))
                    user = cursor.fetchone()
                    n['extra'] = user or {}
                except Exception:
                    n['extra'] = {}

            elif n['notification_type'] == 'new_review' and rid:
                try:
                    cursor.execute("""
                        SELECT r.rating, r.review_text, r.service_type,
                               u.full_name as reviewer_name
                        FROM reviews r
                        LEFT JOIN users u ON r.user_id = u.user_id
                        WHERE r.review_id = %s
                    """, (rid,))
                    review = cursor.fetchone()
                    n['extra'] = review or {}
                except Exception:
                    n['extra'] = {}
            else:
                n['extra'] = {}

        # ── Counts ──────────────────────────────────────────────────
        cursor.execute("SELECT COUNT(*) as total FROM admin_notifications")
        total = cursor.fetchone()['total']

        cursor.execute("SELECT COUNT(*) as unread FROM admin_notifications WHERE is_read = 0")
        unread = cursor.fetchone()['unread']

        cursor.execute("SELECT COUNT(*) as cnt FROM admin_notifications WHERE notification_type='new_order'")
        orders_count = cursor.fetchone()['cnt']

        cursor.execute("SELECT COUNT(*) as cnt FROM admin_notifications WHERE notification_type='new_user'")
        users_count = cursor.fetchone()['cnt']

        cursor.execute("SELECT COUNT(*) as cnt FROM admin_notifications WHERE notification_type='new_review'")
        reviews_count = cursor.fetchone()['cnt']

        cursor.close()

        return APIResponse.success({
            'notifications': notifications,
            'counts': {
                'total':   total,
                'unread':  unread,
                'orders':  orders_count,
                'users':   users_count,
                'reviews': reviews_count
            }
        }, 'Notifications retrieved successfully')

    except Exception as e:
        print(f"❌ Get notifications error: {e}")
        import traceback
        traceback.print_exc()
        return APIResponse.error('Failed to retrieve notifications', None, 500)


@admin_notifications_bp.route('/<int:notification_id>/read', methods=['PUT', 'OPTIONS'])
@admin_required
def mark_as_read(current_user, notification_id):
    """Mark a single notification as read"""
    if request.method == 'OPTIONS':
        return '', 204
    try:
        db     = get_db()
        cursor = db.connection.cursor(pymysql.cursors.DictCursor)
        cursor.execute("""
            UPDATE admin_notifications
            SET is_read = 1, read_at = NOW()
            WHERE notification_id = %s
        """, (notification_id,))
        db.connection.commit()
        cursor.close()
        return APIResponse.success(None, 'Notification marked as read')
    except Exception as e:
        print(f"❌ Mark read error: {e}")
        return APIResponse.error('Failed to mark notification as read', None, 500)


@admin_notifications_bp.route('/mark-all-read', methods=['PUT', 'OPTIONS'])
@admin_required
def mark_all_read(current_user):
    """Mark all notifications as read"""
    if request.method == 'OPTIONS':
        return '', 204
    try:
        db     = get_db()
        cursor = db.connection.cursor(pymysql.cursors.DictCursor)
        cursor.execute("""
            UPDATE admin_notifications
            SET is_read = 1, read_at = NOW()
            WHERE is_read = 0
        """)
        db.connection.commit()
        affected = cursor.rowcount
        cursor.close()
        return APIResponse.success({'marked': affected}, f'{affected} notifications marked as read')
    except Exception as e:
        print(f"❌ Mark all read error: {e}")
        return APIResponse.error('Failed to mark all notifications as read', None, 500)


@admin_notifications_bp.route('/<int:notification_id>/delete', methods=['DELETE', 'OPTIONS'])
@admin_required
def delete_notification(current_user, notification_id):
    """Delete a notification"""
    if request.method == 'OPTIONS':
        return '', 204
    try:
        db     = get_db()
        cursor = db.connection.cursor(pymysql.cursors.DictCursor)
        cursor.execute("DELETE FROM admin_notifications WHERE notification_id = %s", (notification_id,))
        db.connection.commit()
        cursor.close()
        return APIResponse.success(None, 'Notification deleted successfully')
    except Exception as e:
        print(f"❌ Delete notification error: {e}")
        return APIResponse.error('Failed to delete notification', None, 500)


@admin_notifications_bp.route('/unread-count', methods=['GET', 'OPTIONS'])
@admin_required
def get_unread_count(current_user):
    """Quick endpoint — returns only the unread count (used by sidebar badge)"""
    if request.method == 'OPTIONS':
        return '', 204
    try:
        db     = get_db()
        cursor = db.connection.cursor(pymysql.cursors.DictCursor)
        cursor.execute("SELECT COUNT(*) as unread FROM admin_notifications WHERE is_read = 0")
        unread = cursor.fetchone()['unread']
        cursor.close()
        return APIResponse.success({'unread': unread}, 'Unread count retrieved')
    except Exception as e:
        print(f"❌ Unread count error: {e}")
        return APIResponse.error('Failed to get unread count', None, 500)