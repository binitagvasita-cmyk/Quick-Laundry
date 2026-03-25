"""
============================================
ADMIN CATEGORIES MANAGEMENT ROUTES
============================================
"""

from flask import Blueprint, request, jsonify
from database.db import get_db
from utils.auth_middleware import admin_required
from datetime import datetime
import pymysql.cursors

admin_categories_bp = Blueprint('admin_categories', __name__, url_prefix='/api/admin/categories')


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


@admin_categories_bp.route('/list', methods=['GET', 'OPTIONS'])
@admin_required
def get_categories(current_user):
    """Get all categories with service count"""
    if request.method == 'OPTIONS':
        return '', 204
    
    try:
        db = get_db()
        cursor = db.connection.cursor(pymysql.cursors.DictCursor)
        
        cursor.execute("""
            SELECT 
                c.category_id,
                c.category_name,
                c.description,
                c.icon,
                c.is_active,
                c.display_order,
                c.created_at,
                c.updated_at,
                COUNT(s.service_id) as service_count
            FROM categories c
            LEFT JOIN services s ON c.category_id = s.category_id
            GROUP BY c.category_id
            ORDER BY c.display_order ASC, c.created_at DESC
        """)
        
        categories = cursor.fetchall()
        cursor.close()
        
        return APIResponse.success({'categories': categories}, 'Categories retrieved successfully')
        
    except Exception as e:
        print(f"❌ Get categories error: {e}")
        import traceback
        traceback.print_exc()
        return APIResponse.error('Failed to retrieve categories', None, 500)


@admin_categories_bp.route('/<int:category_id>', methods=['GET', 'OPTIONS'])
@admin_required
def get_category(current_user, category_id):
    """Get single category details"""
    if request.method == 'OPTIONS':
        return '', 204
    
    try:
        db = get_db()
        cursor = db.connection.cursor(pymysql.cursors.DictCursor)
        
        cursor.execute("""
            SELECT 
                c.*,
                COUNT(s.service_id) as service_count
            FROM categories c
            LEFT JOIN services s ON c.category_id = s.category_id
            WHERE c.category_id = %s
            GROUP BY c.category_id
        """, (category_id,))
        
        category = cursor.fetchone()
        cursor.close()
        
        if not category:
            return APIResponse.error('Category not found', None, 404)
        
        return APIResponse.success(category, 'Category retrieved successfully')
        
    except Exception as e:
        print(f"❌ Get category error: {e}")
        import traceback
        traceback.print_exc()
        return APIResponse.error('Failed to retrieve category', None, 500)


@admin_categories_bp.route('/create', methods=['POST', 'OPTIONS'])
@admin_required
def create_category(current_user):
    """Create a new category"""
    if request.method == 'OPTIONS':
        return '', 204
    
    try:
        data = request.get_json()
        
        category_name = data.get('category_name', '').strip()
        description = data.get('description', '').strip()
        icon = data.get('icon', '').strip()
        display_order = data.get('display_order', 0)
        is_active = data.get('is_active', True)
        
        if not category_name:
            return APIResponse.error('Category name is required', None, 400)
        
        db = get_db()
        cursor = db.connection.cursor(pymysql.cursors.DictCursor)
        
        # Check if category name already exists
        cursor.execute("SELECT category_id FROM categories WHERE category_name = %s", (category_name,))
        if cursor.fetchone():
            cursor.close()
            return APIResponse.error('Category name already exists', None, 400)
        
        cursor.execute("""
            INSERT INTO categories 
            (category_name, description, icon, display_order, is_active, created_at, updated_at)
            VALUES (%s, %s, %s, %s, %s, NOW(), NOW())
        """, (category_name, description, icon, display_order, is_active))
        
        db.connection.commit()
        category_id = cursor.lastrowid
        
        # Log activity
        try:
            cursor.execute("""
                INSERT INTO admin_activity_logs 
                (admin_id, action_type, action_description, ip_address)
                VALUES (%s, %s, %s, %s)
            """, (
                current_user['user_id'],
                'category_create',
                f"Created category: {category_name}",
                request.remote_addr
            ))
            db.connection.commit()
        except:
            pass
        
        cursor.close()
        
        return APIResponse.success({
            'category_id': category_id,
            'category_name': category_name
        }, 'Category created successfully', 201)
        
    except Exception as e:
        print(f"❌ Create category error: {e}")
        import traceback
        traceback.print_exc()
        return APIResponse.error('Failed to create category', None, 500)


@admin_categories_bp.route('/<int:category_id>/update', methods=['PUT', 'OPTIONS'])
@admin_required
def update_category(current_user, category_id):
    """Update a category"""
    if request.method == 'OPTIONS':
        return '', 204
    
    try:
        data = request.get_json()
        
        db = get_db()
        cursor = db.connection.cursor(pymysql.cursors.DictCursor)
        
        # Check if category exists
        cursor.execute("SELECT category_id FROM categories WHERE category_id = %s", (category_id,))
        if not cursor.fetchone():
            cursor.close()
            return APIResponse.error('Category not found', None, 404)
        
        # Build update query dynamically
        update_fields = []
        params = []
        
        if 'category_name' in data:
            update_fields.append("category_name = %s")
            params.append(data['category_name'].strip())
        
        if 'description' in data:
            update_fields.append("description = %s")
            params.append(data['description'].strip())
        
        if 'icon' in data:
            update_fields.append("icon = %s")
            params.append(data['icon'].strip())
        
        if 'display_order' in data:
            update_fields.append("display_order = %s")
            params.append(data['display_order'])
        
        if 'is_active' in data:
            update_fields.append("is_active = %s")
            params.append(data['is_active'])
        
        if not update_fields:
            cursor.close()
            return APIResponse.error('No fields to update', None, 400)
        
        update_fields.append("updated_at = NOW()")
        params.append(category_id)
        
        query = f"UPDATE categories SET {', '.join(update_fields)} WHERE category_id = %s"
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
                'category_update',
                f"Updated category ID: {category_id}",
                request.remote_addr
            ))
            db.connection.commit()
        except:
            pass
        
        cursor.close()
        
        return APIResponse.success(None, 'Category updated successfully')
        
    except Exception as e:
        print(f"❌ Update category error: {e}")
        import traceback
        traceback.print_exc()
        return APIResponse.error('Failed to update category', None, 500)


@admin_categories_bp.route('/<int:category_id>/delete', methods=['DELETE', 'OPTIONS'])
@admin_required
def delete_category(current_user, category_id):
    """Delete a category (if no services are associated)"""
    if request.method == 'OPTIONS':
        return '', 204
    
    try:
        db = get_db()
        cursor = db.connection.cursor(pymysql.cursors.DictCursor)
        
        # Check if category exists
        cursor.execute("SELECT category_name FROM categories WHERE category_id = %s", (category_id,))
        category = cursor.fetchone()
        
        if not category:
            cursor.close()
            return APIResponse.error('Category not found', None, 404)
        
        # Check if category has services
        cursor.execute("SELECT COUNT(*) as count FROM services WHERE category_id = %s", (category_id,))
        result = cursor.fetchone()
        
        if result['count'] > 0:
            cursor.close()
            return APIResponse.error('Cannot delete category with associated services', None, 400)
        
        # Delete category
        cursor.execute("DELETE FROM categories WHERE category_id = %s", (category_id,))
        db.connection.commit()
        
        # Log activity
        try:
            cursor.execute("""
                INSERT INTO admin_activity_logs 
                (admin_id, action_type, action_description, ip_address)
                VALUES (%s, %s, %s, %s)
            """, (
                current_user['user_id'],
                'category_delete',
                f"Deleted category: {category['category_name']}",
                request.remote_addr
            ))
            db.connection.commit()
        except:
            pass
        
        cursor.close()
        
        return APIResponse.success(None, 'Category deleted successfully')
        
    except Exception as e:
        print(f"❌ Delete category error: {e}")
        import traceback
        traceback.print_exc()
        return APIResponse.error('Failed to delete category', None, 500)


@admin_categories_bp.route('/<int:category_id>/toggle-status', methods=['PUT', 'OPTIONS'])
@admin_required
def toggle_category_status(current_user, category_id):
    """Toggle category active status"""
    if request.method == 'OPTIONS':
        return '', 204
    
    try:
        db = get_db()
        cursor = db.connection.cursor(pymysql.cursors.DictCursor)
        
        cursor.execute("SELECT is_active, category_name FROM categories WHERE category_id = %s", (category_id,))
        category = cursor.fetchone()
        
        if not category:
            cursor.close()
            return APIResponse.error('Category not found', None, 404)
        
        new_status = not category['is_active']
        
        cursor.execute("""
            UPDATE categories 
            SET is_active = %s, updated_at = NOW()
            WHERE category_id = %s
        """, (new_status, category_id))
        
        db.connection.commit()
        
        # Log activity
        try:
            action = 'activated' if new_status else 'deactivated'
            cursor.execute("""
                INSERT INTO admin_activity_logs 
                (admin_id, action_type, action_description, ip_address)
                VALUES (%s, %s, %s, %s)
            """, (
                current_user['user_id'],
                'category_status_change',
                f"{action.capitalize()} category: {category['category_name']}",
                request.remote_addr
            ))
            db.connection.commit()
        except:
            pass
        
        cursor.close()
        
        return APIResponse.success({
            'category_id': category_id,
            'is_active': new_status
        }, f'Category {"activated" if new_status else "deactivated"} successfully')
        
    except Exception as e:
        print(f"❌ Toggle category status error: {e}")
        import traceback
        traceback.print_exc()
        return APIResponse.error('Failed to update category status', None, 500)