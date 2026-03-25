"""
============================================
ADMIN DASHBOARD ROUTES - CORRECTED VERSION
Matches your actual database schema (status, not order_status)
============================================
"""

from flask import Blueprint, request, jsonify
from database.db import get_db
from utils.auth_middleware import admin_required
from datetime import datetime, timedelta
import pymysql.cursors

admin_dashboard_bp = Blueprint('admin_dashboard', __name__, url_prefix='/api/admin/dashboard')


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


@admin_dashboard_bp.route('/stats', methods=['GET', 'OPTIONS'])
@admin_required
def get_dashboard_stats(current_user):
    """Get comprehensive dashboard statistics"""
    if request.method == 'OPTIONS':
        return '', 204
    
    try:
        db = get_db()
        cursor = db.connection.cursor(pymysql.cursors.DictCursor)
        
        # === USERS STATISTICS ===
        cursor.execute("SELECT COUNT(*) as total FROM users WHERE is_admin = 0")
        total_users = cursor.fetchone()['total']
        
        cursor.execute("SELECT COUNT(*) as total FROM users WHERE is_admin = 0 AND is_active = 1")
        active_users = cursor.fetchone()['total']
        
        # New users this month
        cursor.execute("""
            SELECT COUNT(*) as total 
            FROM users 
            WHERE is_admin = 0 
            AND MONTH(created_at) = MONTH(CURRENT_DATE()) 
            AND YEAR(created_at) = YEAR(CURRENT_DATE())
        """)
        new_users_this_month = cursor.fetchone()['total']
        
        # === ORDERS STATISTICS (FIXED: using 'status' not 'order_status') ===
        cursor.execute("SELECT COUNT(*) as total FROM orders")
        total_orders = cursor.fetchone()['total']
        
        cursor.execute("SELECT COUNT(*) as total FROM orders WHERE status = 'pending'")
        pending_orders = cursor.fetchone()['total']
        
        cursor.execute("SELECT COUNT(*) as total FROM orders WHERE status = 'delivered'")
        completed_orders = cursor.fetchone()['total']
        
        cursor.execute("SELECT COUNT(*) as total FROM orders WHERE status = 'cancelled'")
        cancelled_orders = cursor.fetchone()['total']
        
        cursor.execute("SELECT COUNT(*) as total FROM orders WHERE status = 'processing'")
        processing_orders = cursor.fetchone()['total']
        
        # Orders today
        cursor.execute("""
            SELECT COUNT(*) as total 
            FROM orders 
            WHERE DATE(created_at) = CURRENT_DATE()
        """)
        orders_today = cursor.fetchone()['total']
        
        # === REVENUE STATISTICS ===
        cursor.execute("""
            SELECT COALESCE(SUM(total_amount), 0) as total 
            FROM orders 
            WHERE status != 'cancelled'
        """)
        total_revenue = float(cursor.fetchone()['total'])
        
        # Revenue this month
        cursor.execute("""
            SELECT COALESCE(SUM(total_amount), 0) as total 
            FROM orders 
            WHERE MONTH(created_at) = MONTH(CURRENT_DATE()) 
            AND YEAR(created_at) = YEAR(CURRENT_DATE())
            AND status != 'cancelled'
        """)
        monthly_revenue = float(cursor.fetchone()['total'])
        
        # Revenue today
        cursor.execute("""
            SELECT COALESCE(SUM(total_amount), 0) as total 
            FROM orders 
            WHERE DATE(created_at) = CURRENT_DATE()
            AND status != 'cancelled'
        """)
        daily_revenue = float(cursor.fetchone()['total'])
        
        # === SERVICES STATISTICS ===
        cursor.execute("SELECT COUNT(*) as total FROM services WHERE is_active = 1")
        active_services = cursor.fetchone()['total']
        
        cursor.execute("SELECT COUNT(*) as total FROM categories WHERE is_active = 1")
        active_categories = cursor.fetchone()['total']
        
        # === REVIEWS STATISTICS ===
        cursor.execute("SELECT COUNT(*) as total FROM reviews WHERE is_approved = 1")
        approved_reviews = cursor.fetchone()['total']
        
        cursor.execute("SELECT COUNT(*) as total FROM reviews WHERE is_approved = 0")
        pending_reviews = cursor.fetchone()['total']
        
        cursor.execute("SELECT COALESCE(AVG(rating), 0) as avg_rating FROM reviews WHERE is_approved = 1")
        average_rating = float(cursor.fetchone()['avg_rating'])
        
        # === RECENT ORDERS (Last 10) - FIXED: using 'status' ===
        cursor.execute("""
            SELECT 
                o.order_id,
                o.order_number,
                o.total_amount,
                o.status as order_status,
                o.created_at,
                u.full_name as customer_name,
                u.email as customer_email
            FROM orders o
            LEFT JOIN users u ON o.user_id = u.user_id
            ORDER BY o.created_at DESC
            LIMIT 10
        """)
        recent_orders = cursor.fetchall()
        
        # === RECENT ACTIVITY (Last 10 admin actions) ===
        cursor.execute("""
            SELECT 
                al.log_id as activity_id,
                al.action_type,
                al.action_description,
                al.created_at,
                u.full_name as admin_name
            FROM admin_activity_logs al
            LEFT JOIN users u ON al.admin_id = u.user_id
            ORDER BY al.created_at DESC
            LIMIT 10
        """)
        recent_activity = cursor.fetchall()
        
        # === REVENUE CHART DATA (Last 7 days) ===
        cursor.execute("""
            SELECT 
                DATE(created_at) as date,
                COALESCE(SUM(total_amount), 0) as revenue,
                COUNT(*) as order_count
            FROM orders
            WHERE created_at >= DATE_SUB(CURRENT_DATE(), INTERVAL 7 DAY)
            AND status != 'cancelled'
            GROUP BY DATE(created_at)
            ORDER BY date ASC
        """)
        revenue_chart = cursor.fetchall()
        
        # === ORDER STATUS DISTRIBUTION ===
        cursor.execute("""
            SELECT 
                status as order_status,
                COUNT(*) as count
            FROM orders
            GROUP BY status
        """)
        order_status_distribution = cursor.fetchall()
        
        cursor.close()
        
        # Compile all statistics
        stats = {
            'users': {
                'total': total_users,
                'active': active_users,
                'newThisMonth': new_users_this_month
            },
            'orders': {
                'total': total_orders,
                'pending': pending_orders,
                'processing': processing_orders,
                'completed': completed_orders,
                'cancelled': cancelled_orders,
                'today': orders_today
            },
            'revenue': {
                'total': total_revenue,
                'monthly': monthly_revenue,
                'daily': daily_revenue
            },
            'services': {
                'active': active_services,
                'categories': active_categories
            },
            'reviews': {
                'approved': approved_reviews,
                'pending': pending_reviews,
                'averageRating': round(average_rating, 2)
            },
            'recentOrders': recent_orders,
            'recentActivity': recent_activity,
            'revenueChart': revenue_chart,
            'orderStatusDistribution': order_status_distribution
        }
        
        print(f"✅ Dashboard stats retrieved successfully for {current_user['full_name']}")
        
        return APIResponse.success(stats, 'Dashboard statistics retrieved successfully')
        
    except Exception as e:
        print(f"❌ Dashboard stats error: {e}")
        import traceback
        traceback.print_exc()
        return APIResponse.error('Failed to retrieve dashboard statistics', None, 500)


@admin_dashboard_bp.route('/analytics', methods=['GET', 'OPTIONS'])
@admin_required
def get_analytics(current_user):
    """Get detailed analytics data"""
    if request.method == 'OPTIONS':
        return '', 204
    
    try:
        period = request.args.get('period', '30days')  # 7days, 30days, 90days, year
        
        db = get_db()
        cursor = db.connection.cursor(pymysql.cursors.DictCursor)
        
        # Determine date range
        if period == '7days':
            days = 7
        elif period == '30days':
            days = 30
        elif period == '90days':
            days = 90
        else:
            days = 365
        
        # Daily revenue and orders
        cursor.execute("""
            SELECT 
                DATE(created_at) as date,
                COUNT(*) as orders,
                COALESCE(SUM(total_amount), 0) as revenue
            FROM orders
            WHERE created_at >= DATE_SUB(CURRENT_DATE(), INTERVAL %s DAY)
            AND status != 'cancelled'
            GROUP BY DATE(created_at)
            ORDER BY date ASC
        """, (days,))
        
        daily_stats = cursor.fetchall()
        
        # Top services by orders
        cursor.execute("""
            SELECT 
                s.service_name,
                COUNT(oi.item_id) as order_count,
                COALESCE(SUM(oi.total_price), 0) as total_revenue
            FROM order_items oi
            JOIN services s ON oi.service_id = s.service_id
            JOIN orders o ON oi.order_id = o.order_id
            WHERE o.created_at >= DATE_SUB(CURRENT_DATE(), INTERVAL %s DAY)
            AND o.status != 'cancelled'
            GROUP BY s.service_id, s.service_name
            ORDER BY order_count DESC
            LIMIT 10
        """, (days,))
        
        top_services = cursor.fetchall()
        
        # Top customers
        cursor.execute("""
            SELECT 
                u.full_name,
                u.email,
                COUNT(o.order_id) as order_count,
                COALESCE(SUM(o.total_amount), 0) as total_spent
            FROM users u
            JOIN orders o ON u.user_id = o.user_id
            WHERE o.created_at >= DATE_SUB(CURRENT_DATE(), INTERVAL %s DAY)
            AND o.status != 'cancelled'
            GROUP BY u.user_id, u.full_name, u.email
            ORDER BY total_spent DESC
            LIMIT 10
        """, (days,))
        
        top_customers = cursor.fetchall()
        
        cursor.close()
        
        analytics = {
            'period': period,
            'dailyStats': daily_stats,
            'topServices': top_services,
            'topCustomers': top_customers
        }
        
        return APIResponse.success(analytics, 'Analytics retrieved successfully')
        
    except Exception as e:
        print(f"❌ Analytics error: {e}")
        import traceback
        traceback.print_exc()
        return APIResponse.error('Failed to retrieve analytics', None, 500)