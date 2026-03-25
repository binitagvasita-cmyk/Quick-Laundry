"""
============================================
ADMIN SERVICES MANAGEMENT ROUTES
Handles CRUD operations for services
============================================
"""

from flask import Blueprint, request, jsonify
from database.db import get_db
from utils.auth_middleware import admin_required
from datetime import datetime
import pymysql.cursors

# NOTE: This blueprint must be named differently from the existing admin_services_bp
# In app.py, the existing admin_services_bp comes from admin_service_reviews.py
# Add THIS file as routes/admin_manage_services.py and register as shown below

admin_manage_services_bp = Blueprint('admin_manage_services', __name__, url_prefix='/api/admin/manage-services')


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
# GET ALL SERVICES (with optional category filter)
# ============================================

@admin_manage_services_bp.route('/list', methods=['GET', 'OPTIONS'])
@admin_required
def get_services(current_user):
    """Get all services with category info"""
    if request.method == 'OPTIONS':
        return '', 204

    try:
        category_id = request.args.get('category_id', None)

        db = get_db()
        cursor = db.connection.cursor(pymysql.cursors.DictCursor)

        query = """
            SELECT
                s.service_id,
                s.service_name,
                s.description,
                s.base_price,
                s.price_unit,
                s.icon,
                s.image_path,
                s.is_featured,
                s.is_active,
                s.display_order,
                s.created_at,
                s.updated_at,
                s.category_id,
                c.category_name
            FROM services s
            LEFT JOIN categories c ON s.category_id = c.category_id
        """
        params = []

        if category_id:
            query += " WHERE s.category_id = %s"
            params.append(category_id)

        query += " ORDER BY s.category_id ASC, s.display_order ASC, s.created_at DESC"

        cursor.execute(query, params)
        services = cursor.fetchall()
        cursor.close()

        return APIResponse.success({'services': services}, 'Services retrieved successfully')

    except Exception as e:
        print(f"❌ Get services error: {e}")
        import traceback
        traceback.print_exc()
        return APIResponse.error('Failed to retrieve services', None, 500)


# ============================================
# GET SINGLE SERVICE
# ============================================

@admin_manage_services_bp.route('/<int:service_id>', methods=['GET', 'OPTIONS'])
@admin_required
def get_service(current_user, service_id):
    """Get single service details"""
    if request.method == 'OPTIONS':
        return '', 204

    try:
        db = get_db()
        cursor = db.connection.cursor(pymysql.cursors.DictCursor)

        cursor.execute("""
            SELECT
                s.*,
                c.category_name
            FROM services s
            LEFT JOIN categories c ON s.category_id = c.category_id
            WHERE s.service_id = %s
        """, (service_id,))

        service = cursor.fetchone()
        cursor.close()

        if not service:
            return APIResponse.error('Service not found', None, 404)

        return APIResponse.success(service, 'Service retrieved successfully')

    except Exception as e:
        print(f"❌ Get service error: {e}")
        return APIResponse.error('Failed to retrieve service', None, 500)


# ============================================
# CREATE SERVICE
# ============================================

@admin_manage_services_bp.route('/create', methods=['POST', 'OPTIONS'])
@admin_required
def create_service(current_user):
    """Create a new service"""
    if request.method == 'OPTIONS':
        return '', 204

    try:
        data = request.get_json()

        service_name = data.get('service_name', '').strip()
        category_id = data.get('category_id')
        description = data.get('description', '').strip()
        base_price = data.get('base_price')
        price_unit = data.get('price_unit', 'piece').strip()
        icon = data.get('icon', 'fas fa-tshirt').strip()
        image_path = data.get('image_path', '').strip()
        is_featured = data.get('is_featured', False)
        is_active = data.get('is_active', True)
        display_order = data.get('display_order', 0)

        # Validation
        if not service_name:
            return APIResponse.error('Service name is required', None, 400)
        if not category_id:
            return APIResponse.error('Category is required', None, 400)
        if base_price is None:
            return APIResponse.error('Base price is required', None, 400)

        db = get_db()
        cursor = db.connection.cursor(pymysql.cursors.DictCursor)

        # Check category exists
        cursor.execute("SELECT category_id FROM categories WHERE category_id = %s", (category_id,))
        if not cursor.fetchone():
            cursor.close()
            return APIResponse.error('Selected category does not exist', None, 400)

        # Check duplicate name in same category
        cursor.execute("""
            SELECT service_id FROM services 
            WHERE service_name = %s AND category_id = %s
        """, (service_name, category_id))
        if cursor.fetchone():
            cursor.close()
            return APIResponse.error('A service with this name already exists in this category', None, 400)

        cursor.execute("""
            INSERT INTO services 
            (category_id, service_name, description, base_price, price_unit, 
             icon, image_path, is_featured, is_active, display_order, created_at, updated_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, NOW(), NOW())
        """, (category_id, service_name, description, base_price, price_unit,
              icon, image_path, is_featured, is_active, display_order))

        db.connection.commit()
        service_id = cursor.lastrowid

        # Log activity
        try:
            cursor.execute("""
                INSERT INTO admin_activity_logs 
                (admin_id, action_type, action_description, ip_address)
                VALUES (%s, %s, %s, %s)
            """, (
                current_user['user_id'],
                'service_create',
                f"Created service: {service_name}",
                request.remote_addr
            ))
            db.connection.commit()
        except:
            pass

        cursor.close()

        return APIResponse.success({
            'service_id': service_id,
            'service_name': service_name
        }, 'Service created successfully', 201)

    except Exception as e:
        print(f"❌ Create service error: {e}")
        import traceback
        traceback.print_exc()
        return APIResponse.error('Failed to create service', None, 500)


# ============================================
# UPDATE SERVICE
# ============================================

@admin_manage_services_bp.route('/<int:service_id>/update', methods=['PUT', 'OPTIONS'])
@admin_required
def update_service(current_user, service_id):
    """Update a service"""
    if request.method == 'OPTIONS':
        return '', 204

    try:
        data = request.get_json()

        db = get_db()
        cursor = db.connection.cursor(pymysql.cursors.DictCursor)

        # Check service exists
        cursor.execute("SELECT service_id FROM services WHERE service_id = %s", (service_id,))
        if not cursor.fetchone():
            cursor.close()
            return APIResponse.error('Service not found', None, 404)

        # Build dynamic update
        update_fields = []
        params = []

        field_map = {
            'service_name': str,
            'category_id': int,
            'description': str,
            'base_price': float,
            'price_unit': str,
            'icon': str,
            'image_path': str,
            'is_featured': bool,
            'is_active': bool,
            'display_order': int,
        }

        for field, ftype in field_map.items():
            if field in data:
                val = data[field]
                if ftype == str:
                    val = val.strip() if val else ''
                update_fields.append(f"{field} = %s")
                params.append(val)

        if not update_fields:
            cursor.close()
            return APIResponse.error('No fields to update', None, 400)

        update_fields.append("updated_at = NOW()")
        params.append(service_id)

        query = f"UPDATE services SET {', '.join(update_fields)} WHERE service_id = %s"
        cursor.execute(query, params)
        db.connection.commit()

        # Log activity
        try:
            cursor.execute("""
                INSERT INTO admin_activity_logs 
                (admin_id, action_type, action_description, ip_address)
                VALUES (%s, %s, %s, %s)
            """, (
                current_user['user_id'],
                'service_update',
                f"Updated service ID: {service_id}",
                request.remote_addr
            ))
            db.connection.commit()
        except:
            pass

        cursor.close()

        return APIResponse.success(None, 'Service updated successfully')

    except Exception as e:
        print(f"❌ Update service error: {e}")
        import traceback
        traceback.print_exc()
        return APIResponse.error('Failed to update service', None, 500)


# ============================================
# DELETE SERVICE
# ============================================

@admin_manage_services_bp.route('/<int:service_id>/delete', methods=['DELETE', 'OPTIONS'])
@admin_required
def delete_service(current_user, service_id):
    """Delete a service (only if not in any active orders)"""
    if request.method == 'OPTIONS':
        return '', 204

    try:
        db = get_db()
        cursor = db.connection.cursor(pymysql.cursors.DictCursor)

        cursor.execute("SELECT service_name FROM services WHERE service_id = %s", (service_id,))
        service = cursor.fetchone()

        if not service:
            cursor.close()
            return APIResponse.error('Service not found', None, 404)

        # Check if used in active orders
        cursor.execute("""
            SELECT COUNT(*) as count FROM order_items oi
            JOIN orders o ON oi.order_id = o.order_id
            WHERE oi.service_id = %s AND o.status NOT IN ('cancelled', 'delivered')
        """, (service_id,))
        result = cursor.fetchone()

        if result['count'] > 0:
            cursor.close()
            return APIResponse.error(
                f'Cannot delete: this service is part of {result["count"]} active order(s)',
                None, 400
            )

        cursor.execute("DELETE FROM services WHERE service_id = %s", (service_id,))
        db.connection.commit()

        # Log activity
        try:
            cursor.execute("""
                INSERT INTO admin_activity_logs 
                (admin_id, action_type, action_description, ip_address)
                VALUES (%s, %s, %s, %s)
            """, (
                current_user['user_id'],
                'service_delete',
                f"Deleted service: {service['service_name']}",
                request.remote_addr
            ))
            db.connection.commit()
        except:
            pass

        cursor.close()

        return APIResponse.success(None, 'Service deleted successfully')

    except Exception as e:
        print(f"❌ Delete service error: {e}")
        import traceback
        traceback.print_exc()
        return APIResponse.error('Failed to delete service', None, 500)


# ============================================
# TOGGLE SERVICE STATUS
# ============================================

@admin_manage_services_bp.route('/<int:service_id>/toggle-status', methods=['PUT', 'OPTIONS'])
@admin_required
def toggle_service_status(current_user, service_id):
    """Toggle service active/inactive status"""
    if request.method == 'OPTIONS':
        return '', 204

    try:
        db = get_db()
        cursor = db.connection.cursor(pymysql.cursors.DictCursor)

        cursor.execute("SELECT is_active, service_name FROM services WHERE service_id = %s", (service_id,))
        service = cursor.fetchone()

        if not service:
            cursor.close()
            return APIResponse.error('Service not found', None, 404)

        new_status = not service['is_active']

        cursor.execute("""
            UPDATE services SET is_active = %s, updated_at = NOW()
            WHERE service_id = %s
        """, (new_status, service_id))

        db.connection.commit()

        # Log activity
        try:
            action = 'Activated' if new_status else 'Deactivated'
            cursor.execute("""
                INSERT INTO admin_activity_logs 
                (admin_id, action_type, action_description, ip_address)
                VALUES (%s, %s, %s, %s)
            """, (
                current_user['user_id'],
                'service_status_change',
                f"{action} service: {service['service_name']}",
                request.remote_addr
            ))
            db.connection.commit()
        except:
            pass

        cursor.close()

        return APIResponse.success({
            'service_id': service_id,
            'is_active': new_status
        }, f'Service {"activated" if new_status else "deactivated"} successfully')

    except Exception as e:
        print(f"❌ Toggle service status error: {e}")
        return APIResponse.error('Failed to update service status', None, 500)


# ============================================
# GET CATEGORIES (for dropdowns in frontend)
# ============================================

@admin_manage_services_bp.route('/categories/all', methods=['GET', 'OPTIONS'])
@admin_required
def get_categories_for_services(current_user):
    """Get all active categories for service form dropdowns"""
    if request.method == 'OPTIONS':
        return '', 204

    try:
        db = get_db()
        cursor = db.connection.cursor(pymysql.cursors.DictCursor)

        cursor.execute("""
            SELECT category_id, category_name, icon
            FROM categories
            WHERE is_active = 1
            ORDER BY display_order ASC, category_name ASC
        """)

        categories = cursor.fetchall()
        cursor.close()

        return APIResponse.success({'categories': categories}, 'Categories retrieved successfully')

    except Exception as e:
        print(f"❌ Get categories error: {e}")
        return APIResponse.error('Failed to retrieve categories', None, 500)