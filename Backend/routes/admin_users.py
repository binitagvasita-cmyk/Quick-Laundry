"""
============================================
ADMIN USERS MANAGEMENT ROUTES
Manages both regular users and admin users
============================================
"""

from flask import Blueprint, request, jsonify
from database.db import get_db
from utils.auth_middleware import admin_required
from datetime import datetime
import pymysql.cursors

admin_users_bp = Blueprint('admin_users', __name__, url_prefix='/api/admin/users')


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


@admin_users_bp.route('/list', methods=['GET', 'OPTIONS'])
@admin_required
def get_users_list(current_user):
    """Get all users with pagination and filtering"""
    if request.method == 'OPTIONS':
        return '', 204
    
    try:
        # Get query parameters
        page = int(request.args.get('page', 1))
        limit = int(request.args.get('limit', 10))
        search = request.args.get('search', '').strip()
        status = request.args.get('status', '')  # active, inactive, all
        user_type = request.args.get('type', 'customer')  # customer, admin, all
        
        offset = (page - 1) * limit
        
        db = get_db()
        cursor = db.connection.cursor(pymysql.cursors.DictCursor)
        
        # Build query - using 'phone' column as it exists in your database
        query = """
            SELECT 
                user_id, 
                email, 
                full_name, 
                phone,
                city,
                pincode,
                profile_picture,
                is_admin, 
                admin_role,
                is_active, 
                email_verified,
                phone_verified,
                created_at,
                last_login
            FROM users 
            WHERE 1=1
        """
        params = []
        
        # Filter by user type
        if user_type == 'customer':
            query += " AND is_admin = 0"
        elif user_type == 'admin':
            query += " AND is_admin = 1"
        
        # Filter by status
        if status == 'active':
            query += " AND is_active = 1"
        elif status == 'inactive':
            query += " AND is_active = 0"
        
        # Search filter
        if search:
            query += " AND (email LIKE %s OR full_name LIKE %s OR phone LIKE %s)"
            search_term = f"%{search}%"
            params.extend([search_term, search_term, search_term])
        
        # Get total count
        count_query = f"SELECT COUNT(*) as total FROM ({query}) as filtered_users"
        cursor.execute(count_query, params)
        total = cursor.fetchone()['total']
        
        # Add pagination
        query += " ORDER BY created_at DESC LIMIT %s OFFSET %s"
        params.extend([limit, offset])
        
        cursor.execute(query, params)
        users = cursor.fetchall()
        
        cursor.close()
        
        return APIResponse.success({
            'users': users,
            'pagination': {
                'page': page,
                'limit': limit,
                'total': total,
                'pages': (total + limit - 1) // limit
            }
        }, 'Users retrieved successfully')
        
    except Exception as e:
        print(f"❌ Get users error: {e}")
        import traceback
        traceback.print_exc()
        return APIResponse.error('Failed to retrieve users', None, 500)


@admin_users_bp.route('/<int:user_id>', methods=['GET', 'OPTIONS'])
@admin_required
def get_user_details(current_user, user_id):
    """Get detailed information about a specific user"""
    if request.method == 'OPTIONS':
        return '', 204
    
    try:
        db = get_db()
        cursor = db.connection.cursor(pymysql.cursors.DictCursor)
        
        # Get user details
        cursor.execute("""
            SELECT 
                user_id, email, full_name, phone, 
                is_admin, admin_role, is_active, email_verified, phone_verified,
                profile_picture, city, pincode, address,
                created_at, last_login, date_of_birth, gender
            FROM users 
            WHERE user_id = %s
        """, (user_id,))
        
        user = cursor.fetchone()
        
        if not user:
            cursor.close()
            return APIResponse.error('User not found', None, 404)
        
        # Get user addresses (if user_addresses table exists)
        try:
            cursor.execute("""
                SELECT address_id, address_type, address_line1, address_line2,
                       city, state, postal_code, is_default
                FROM user_addresses
                WHERE user_id = %s
                ORDER BY is_default DESC, created_at DESC
            """, (user_id,))
            addresses = cursor.fetchall()
        except:
            addresses = []
        
        # Get user order statistics (if orders table exists)
        try:
            cursor.execute("""
                SELECT 
                    COUNT(*) as total_orders,
                    COALESCE(SUM(total_amount), 0) as total_spent,
                    COUNT(CASE WHEN status = 'delivered' THEN 1 END) as completed_orders,
                    COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled_orders,
                    MAX(created_at) as last_order_date
                FROM orders
                WHERE user_id = %s
            """, (user_id,))
            order_stats = cursor.fetchone()
        except:
            order_stats = {
                'total_orders': 0,
                'total_spent': 0,
                'completed_orders': 0,
                'cancelled_orders': 0,
                'last_order_date': None
            }
        
        cursor.close()
        
        user['addresses'] = addresses
        user['order_statistics'] = order_stats
        
        return APIResponse.success(user, 'User details retrieved successfully')
        
    except Exception as e:
        print(f"❌ Get user details error: {e}")
        import traceback
        traceback.print_exc()
        return APIResponse.error('Failed to retrieve user details', None, 500)


@admin_users_bp.route('/<int:user_id>/toggle-status', methods=['PUT', 'OPTIONS'])
@admin_required
def toggle_user_status(current_user, user_id):
    """Activate or deactivate a user account"""
    if request.method == 'OPTIONS':
        return '', 204
    
    try:
        db = get_db()
        cursor = db.connection.cursor(pymysql.cursors.DictCursor)
        
        # Get current status
        cursor.execute("SELECT is_active, full_name FROM users WHERE user_id = %s", (user_id,))
        user = cursor.fetchone()
        
        if not user:
            cursor.close()
            return APIResponse.error('User not found', None, 404)
        
        # Prevent admin from deactivating themselves
        if user_id == current_user['user_id']:
            cursor.close()
            return APIResponse.error('You cannot deactivate your own account', None, 400)
        
        # Toggle status
        new_status = not user['is_active']
        
        cursor.execute("""
            UPDATE users 
            SET is_active = %s 
            WHERE user_id = %s
        """, (new_status, user_id))
        
        db.connection.commit()
        
        # Log activity
        action = 'activated' if new_status else 'deactivated'
        try:
            cursor.execute("""
                INSERT INTO admin_activity_logs 
                (admin_id, action_type, action_description, ip_address)
                VALUES (%s, %s, %s, %s)
            """, (
                current_user['user_id'],
                'user_status_change',
                f"{action.capitalize()} user: {user['full_name']} (ID: {user_id})",
                request.remote_addr
            ))
            db.connection.commit()
        except:
            pass
        
        cursor.close()
        
        return APIResponse.success({
            'user_id': user_id,
            'is_active': new_status
        }, f'User {action} successfully')
        
    except Exception as e:
        print(f"❌ Toggle user status error: {e}")
        import traceback
        traceback.print_exc()
        return APIResponse.error('Failed to update user status', None, 500)


@admin_users_bp.route('/<int:user_id>', methods=['DELETE', 'OPTIONS'])
@admin_required
def delete_user(current_user, user_id):
    """Delete a user account (soft delete)"""
    if request.method == 'OPTIONS':
        return '', 204
    
    try:
        # Prevent admin from deleting themselves
        if user_id == current_user['user_id']:
            return APIResponse.error('You cannot delete your own account', None, 400)
        
        db = get_db()
        cursor = db.connection.cursor(pymysql.cursors.DictCursor)
        
        cursor.execute("SELECT full_name FROM users WHERE user_id = %s", (user_id,))
        user = cursor.fetchone()
        
        if not user:
            cursor.close()
            return APIResponse.error('User not found', None, 404)
        
        # Soft delete by deactivating
        cursor.execute("""
            UPDATE users 
            SET is_active = 0 
            WHERE user_id = %s
        """, (user_id,))
        
        db.connection.commit()
        
        # Log activity
        try:
            cursor.execute("""
                INSERT INTO admin_activity_logs 
                (admin_id, action_type, action_description, ip_address)
                VALUES (%s, %s, %s, %s)
            """, (
                current_user['user_id'],
                'user_delete',
                f"Deleted user: {user['full_name']} (ID: {user_id})",
                request.remote_addr
            ))
            db.connection.commit()
        except:
            pass
        
        cursor.close()
        
        return APIResponse.success(None, 'User deleted successfully')
        
    except Exception as e:
        print(f"❌ Delete user error: {e}")
        import traceback
        traceback.print_exc()
        return APIResponse.error('Failed to delete user', None, 500)


@admin_users_bp.route('/admins/list', methods=['GET', 'OPTIONS'])
@admin_required
def get_admin_list(current_user):
    """Get list of all admin users"""
    if request.method == 'OPTIONS':
        return '', 204
    
    try:
        db = get_db()
        cursor = db.connection.cursor(pymysql.cursors.DictCursor)
        
        cursor.execute("""
            SELECT 
                user_id, email, full_name, phone,
                admin_role, is_active, created_at, last_login
            FROM users
            WHERE is_admin = 1
            ORDER BY created_at DESC
        """)
        
        admins = cursor.fetchall()
        cursor.close()
        
        return APIResponse.success({'admins': admins}, 'Admin users retrieved successfully')
        
    except Exception as e:
        print(f"❌ Get admin list error: {e}")
        import traceback
        traceback.print_exc()
        return APIResponse.error('Failed to retrieve admin users', None, 500)


@admin_users_bp.route('/admins/create', methods=['POST', 'OPTIONS'])
@admin_required
def create_admin(current_user):
    """Create a new admin user"""
    if request.method == 'OPTIONS':
        return '', 204
    
    try:
        import bcrypt
        
        data = request.get_json()
        
        # Validate required fields
        required_fields = ['email', 'full_name', 'password', 'admin_role']
        for field in required_fields:
            if not data.get(field):
                return APIResponse.error(f'{field} is required', None, 400)
        
        email = data['email'].strip().lower()
        full_name = data['full_name'].strip()
        password = data['password']
        admin_role = data['admin_role']  # admin, super_admin, etc.
        phone = data.get('phone', '').strip()
        
        db = get_db()
        cursor = db.connection.cursor(pymysql.cursors.DictCursor)
        
        # Check if email already exists
        cursor.execute("SELECT user_id FROM users WHERE email = %s", (email,))
        if cursor.fetchone():
            cursor.close()
            return APIResponse.error('Email already exists', None, 400)
        
        # Hash password
        password_hash = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt())
        
        # Create admin user
        cursor.execute("""
            INSERT INTO users 
            (email, full_name, phone, password_hash, is_admin, admin_role, 
             is_active, email_verified, address, city, created_at)
            VALUES (%s, %s, %s, %s, 1, %s, 1, 1, 'N/A', 'N/A', NOW())
        """, (email, full_name, phone, password_hash, admin_role))
        
        db.connection.commit()
        new_admin_id = cursor.lastrowid
        
        # Log activity
        try:
            cursor.execute("""
                INSERT INTO admin_activity_logs 
                (admin_id, action_type, action_description, ip_address)
                VALUES (%s, %s, %s, %s)
            """, (
                current_user['user_id'],
                'admin_create',
                f"Created new admin: {full_name} ({email})",
                request.remote_addr
            ))
            db.connection.commit()
        except:
            pass
        
        cursor.close()
        
        return APIResponse.success({
            'user_id': new_admin_id,
            'email': email,
            'full_name': full_name,
            'admin_role': admin_role
        }, 'Admin user created successfully', 201)
        
    except Exception as e:
        print(f"❌ Create admin error: {e}")
        import traceback
        traceback.print_exc()
        return APIResponse.error('Failed to create admin user', None, 500)