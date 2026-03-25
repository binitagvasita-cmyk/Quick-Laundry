"""
============================================
SERVICES ROUTES - ENHANCED WITH PRICE LOOKUP
Complete backend integration with database
✅ Added dedicated price lookup endpoint
============================================
"""

from flask import Blueprint, request, jsonify
from middleware.auth_middleware import token_required, optional_token
from utils.response import APIResponse
from database.db_connection import get_db_connection
import traceback

services_bp = Blueprint('services', __name__)


@services_bp.route('/api/services', methods=['GET'])
def get_all_services():
    """
    Get all active services with their features
    Optional filtering by category
    """
    try:
        category_id = request.args.get('category')
        
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        
        query = """
            SELECT 
                s.service_id as id,
                s.category_id,
                s.service_name as name,
                s.description,
                s.base_price as price,
                s.price_unit as unit,
                s.icon,
                s.image_path,
                s.is_featured,
                s.is_active,
                s.display_order,
                s.created_at,
                s.updated_at,
                GROUP_CONCAT(sf.feature_text ORDER BY sf.display_order SEPARATOR '|||') as features
            FROM services s
            LEFT JOIN service_features sf ON s.service_id = sf.service_id
            WHERE s.is_active = TRUE
        """
        
        params = []
        
        # Add category filter if provided
        if category_id and category_id != 'all':
            query += " AND s.category_id = %s"
            params.append(category_id)
        
        query += """
            GROUP BY s.service_id
            ORDER BY s.is_featured DESC, s.display_order ASC, s.service_name ASC
        """
        
        cursor.execute(query, params)
        services = cursor.fetchall()
        
        # Process features - convert from string to list
        for service in services:
            if service['features']:
                service['features'] = service['features'].split('|||')
            else:
                service['features'] = []
        
        cursor.close()
        conn.close()
        
        return APIResponse.success(
            message=f'Retrieved {len(services)} services successfully',
            data={'services': services}
        )
        
    except Exception as e:
        print(f"❌ Error fetching services: {str(e)}")
        print(traceback.format_exc())
        return APIResponse.error(
            message='Failed to fetch services',
            errors=str(e),
            status_code=500
        )


@services_bp.route('/api/services/<int:service_id>', methods=['GET'])
def get_service_by_id(service_id):
    """
    Get detailed information about a specific service
    """
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        
        query = """
            SELECT 
                s.service_id as id,
                s.category_id,
                s.service_name as name,
                s.description,
                s.base_price as price,
                s.price_unit as unit,
                s.icon,
                s.image_path,
                s.is_featured,
                s.is_active,
                s.display_order,
                s.created_at,
                s.updated_at
            FROM services s
            WHERE s.service_id = %s AND s.is_active = TRUE
        """
        
        cursor.execute(query, (service_id,))
        service = cursor.fetchone()
        
        if not service:
            cursor.close()
            conn.close()
            return APIResponse.error(
                message='Service not found',
                status_code=404
            )
        
        # Get service features separately
        features_query = """
            SELECT 
                feature_id,
                feature_text,
                display_order
            FROM service_features
            WHERE service_id = %s
            ORDER BY display_order ASC
        """
        
        cursor.execute(features_query, (service_id,))
        features = cursor.fetchall()
        
        # Add features to service
        service['features'] = [f['feature_text'] for f in features]
        
        cursor.close()
        conn.close()
        
        return APIResponse.success(
            message='Service retrieved successfully',
            data={'service': service}
        )
        
    except Exception as e:
        print(f"❌ Error fetching service {service_id}: {str(e)}")
        print(traceback.format_exc())
        return APIResponse.error(
            message='Failed to fetch service details',
            errors=str(e),
            status_code=500
        )


@services_bp.route('/api/services/<int:service_id>/price', methods=['GET'])
def get_service_price(service_id):
    """
    ✅ NEW: Get price information for a specific service
    Lightweight endpoint for dynamic price updates
    """
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        
        query = """
            SELECT 
                service_id as id,
                service_name as name,
                base_price as price,
                price_unit as unit
            FROM services
            WHERE service_id = %s AND is_active = TRUE
        """
        
        cursor.execute(query, (service_id,))
        service = cursor.fetchone()
        
        cursor.close()
        conn.close()
        
        if not service:
            return APIResponse.error(
                message='Service not found',
                status_code=404
            )
        
        return APIResponse.success(
            message='Price retrieved successfully',
            data={
                'serviceId': service['id'],
                'serviceName': service['name'],
                'price': float(service['price']),
                'unit': service['unit'] or 'piece'
            }
        )
        
    except Exception as e:
        print(f"❌ Error fetching price for service {service_id}: {str(e)}")
        print(traceback.format_exc())
        return APIResponse.error(
            message='Failed to fetch service price',
            errors=str(e),
            status_code=500
        )


@services_bp.route('/api/services/category/<int:category_id>', methods=['GET'])
def get_services_by_category(category_id):
    """
    ✅ NEW: Get all services for a specific category
    Optimized for category-specific pages (wash+iron, dry clean, etc.)
    """
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        
        # Get category info
        category_query = """
            SELECT 
                category_id as id,
                category_name as name,
                description,
                icon
            FROM categories
            WHERE category_id = %s AND is_active = TRUE
        """
        
        cursor.execute(category_query, (category_id,))
        category = cursor.fetchone()
        
        if not category:
            cursor.close()
            conn.close()
            return APIResponse.error(
                message='Category not found',
                status_code=404
            )
        
        # Get services for this category
        services_query = """
            SELECT 
                service_id as id,
                service_name as name,
                description,
                base_price as price,
                price_unit as unit,
                icon,
                image_path,
                is_featured
            FROM services
            WHERE category_id = %s AND is_active = TRUE
            ORDER BY is_featured DESC, display_order ASC, service_name ASC
        """
        
        cursor.execute(services_query, (category_id,))
        services = cursor.fetchall()
        
        cursor.close()
        conn.close()
        
        return APIResponse.success(
            message=f'Retrieved {len(services)} services for category {category["name"]}',
            data={
                'category': category,
                'services': services
            }
        )
        
    except Exception as e:
        print(f"❌ Error fetching services for category {category_id}: {str(e)}")
        print(traceback.format_exc())
        return APIResponse.error(
            message='Failed to fetch category services',
            errors=str(e),
            status_code=500
        )


@services_bp.route('/api/services/featured', methods=['GET'])
def get_featured_services():
    """
    Get only featured services (for homepage or highlights)
    """
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        
        query = """
            SELECT 
                s.service_id as id,
                s.category_id,
                s.service_name as name,
                s.description,
                s.base_price as price,
                s.price_unit as unit,
                s.icon,
                s.image_path,
                s.is_featured,
                s.display_order,
                GROUP_CONCAT(sf.feature_text ORDER BY sf.display_order SEPARATOR '|||') as features
            FROM services s
            LEFT JOIN service_features sf ON s.service_id = sf.service_id
            WHERE s.is_active = TRUE AND s.is_featured = TRUE
            GROUP BY s.service_id
            ORDER BY s.display_order ASC, s.service_name ASC
            LIMIT 6
        """
        
        cursor.execute(query)
        services = cursor.fetchall()
        
        # Process features
        for service in services:
            if service['features']:
                service['features'] = service['features'].split('|||')
            else:
                service['features'] = []
        
        cursor.close()
        conn.close()
        
        return APIResponse.success(
            message=f'Retrieved {len(services)} featured services',
            data={'services': services}
        )
        
    except Exception as e:
        print(f"❌ Error fetching featured services: {str(e)}")
        print(traceback.format_exc())
        return APIResponse.error(
            message='Failed to fetch featured services',
            errors=str(e),
            status_code=500
        )


@services_bp.route('/api/categories', methods=['GET'])
def get_categories():
    """
    Get all active categories
    """
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        
        query = """
            SELECT 
                c.category_id as id,
                c.category_name as name,
                c.description,
                c.icon,
                c.display_order,
                COUNT(DISTINCT s.service_id) as service_count
            FROM categories c
            LEFT JOIN services s ON c.category_id = s.category_id AND s.is_active = TRUE
            WHERE c.is_active = TRUE
            GROUP BY c.category_id
            ORDER BY c.display_order ASC, c.category_name ASC
        """
        
        cursor.execute(query)
        categories = cursor.fetchall()
        
        cursor.close()
        conn.close()
        
        return APIResponse.success(
            message=f'Retrieved {len(categories)} categories',
            data={'categories': categories}
        )
        
    except Exception as e:
        print(f"❌ Error fetching categories: {str(e)}")
        print(traceback.format_exc())
        return APIResponse.error(
            message='Failed to fetch categories',
            errors=str(e),
            status_code=500
        )


@services_bp.route('/api/services/bulk-price', methods=['POST'])
def get_bulk_prices():
    """
    ✅ NEW: Get prices for multiple services at once
    Useful for cart calculations and multi-item displays
    
    Request body:
    {
        "serviceIds": [7, 8, 20, 21]
    }
    """
    try:
        data = request.get_json()
        
        if not data or 'serviceIds' not in data:
            return APIResponse.error(
                message='serviceIds array is required',
                status_code=400
            )
        
        service_ids = data['serviceIds']
        
        if not isinstance(service_ids, list) or len(service_ids) == 0:
            return APIResponse.error(
                message='serviceIds must be a non-empty array',
                status_code=400
            )
        
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        
        # Create placeholders for IN clause
        placeholders = ','.join(['%s'] * len(service_ids))
        
        query = f"""
            SELECT 
                service_id as id,
                service_name as name,
                base_price as price,
                price_unit as unit
            FROM services
            WHERE service_id IN ({placeholders}) AND is_active = TRUE
        """
        
        cursor.execute(query, service_ids)
        services = cursor.fetchall()
        
        cursor.close()
        conn.close()
        
        # Convert to dict for easy lookup
        price_map = {}
        for service in services:
            price_map[service['id']] = {
                'name': service['name'],
                'price': float(service['price']),
                'unit': service['unit'] or 'piece'
            }
        
        return APIResponse.success(
            message=f'Retrieved prices for {len(services)} services',
            data={'prices': price_map}
        )
        
    except Exception as e:
        print(f"❌ Error fetching bulk prices: {str(e)}")
        print(traceback.format_exc())
        return APIResponse.error(
            message='Failed to fetch service prices',
            errors=str(e),
            status_code=500
        )


# ============================================
# ADMIN ROUTES (Optional - for managing services)
# ============================================

@services_bp.route('/api/admin/services', methods=['POST'])
@token_required
def create_service(current_user):
    """
    Create a new service (Admin only)
    """
    try:
        data = request.get_json()
        
        # Validate required fields
        required_fields = ['service_name', 'base_price', 'price_unit']
        for field in required_fields:
            if field not in data:
                return APIResponse.error(
                    message=f'Missing required field: {field}',
                    status_code=400
                )
        
        conn = get_db_connection()
        cursor = conn.cursor()
        
        query = """
            INSERT INTO services 
            (service_name, description, base_price, price_unit, icon, 
             image_path, is_featured, is_active, display_order, category_id)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """
        
        values = (
            data['service_name'],
            data.get('description', ''),
            data['base_price'],
            data['price_unit'],
            data.get('icon', 'fas fa-tshirt'),
            data.get('image_path', None),
            data.get('is_featured', False),
            data.get('is_active', True),
            data.get('display_order', 0),
            data.get('category_id')
        )
        
        cursor.execute(query, values)
        service_id = cursor.lastrowid
        
        # Insert features if provided
        if 'features' in data and data['features']:
            features_query = """
                INSERT INTO service_features 
                (service_id, feature_text, display_order)
                VALUES (%s, %s, %s)
            """
            
            for idx, feature in enumerate(data['features']):
                cursor.execute(features_query, (service_id, feature, idx))
        
        conn.commit()
        cursor.close()
        conn.close()
        
        return APIResponse.success(
            message='Service created successfully',
            data={'service_id': service_id}
        )
        
    except Exception as e:
        print(f"❌ Error creating service: {str(e)}")
        print(traceback.format_exc())
        return APIResponse.error(
            message='Failed to create service',
            errors=str(e),
            status_code=500
        )


@services_bp.route('/api/admin/services/<int:service_id>', methods=['PUT'])
@token_required
def update_service(current_user, service_id):
    """
    Update an existing service (Admin only)
    """
    try:
        data = request.get_json()
        
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Build dynamic update query
        update_fields = []
        values = []
        
        allowed_fields = ['service_name', 'description', 'base_price', 'price_unit', 
                         'icon', 'image_path', 'is_featured', 'is_active', 'display_order', 'category_id']
        
        for field in allowed_fields:
            if field in data:
                update_fields.append(f"{field} = %s")
                values.append(data[field])
        
        if not update_fields:
            return APIResponse.error(
                message='No fields to update',
                status_code=400
            )
        
        values.append(service_id)
        
        query = f"""
            UPDATE services 
            SET {', '.join(update_fields)}, updated_at = CURRENT_TIMESTAMP
            WHERE service_id = %s
        """
        
        cursor.execute(query, values)
        
        # Update features if provided
        if 'features' in data:
            # Delete existing features
            cursor.execute("DELETE FROM service_features WHERE service_id = %s", (service_id,))
            
            # Insert new features
            if data['features']:
                features_query = """
                    INSERT INTO service_features 
                    (service_id, feature_text, display_order)
                    VALUES (%s, %s, %s)
                """
                
                for idx, feature in enumerate(data['features']):
                    cursor.execute(features_query, (service_id, feature, idx))
        
        conn.commit()
        cursor.close()
        conn.close()
        
        return APIResponse.success(
            message='Service updated successfully'
        )
        
    except Exception as e:
        print(f"❌ Error updating service: {str(e)}")
        print(traceback.format_exc())
        return APIResponse.error(
            message='Failed to update service',
            errors=str(e),
            status_code=500
        )


@services_bp.route('/api/admin/services/<int:service_id>', methods=['DELETE'])
@token_required
def delete_service(current_user, service_id):
    """
    Soft delete a service (Admin only)
    """
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Soft delete - set is_active to False
        query = """
            UPDATE services 
            SET is_active = FALSE, updated_at = CURRENT_TIMESTAMP
            WHERE service_id = %s
        """
        
        cursor.execute(query, (service_id,))
        conn.commit()
        
        cursor.close()
        conn.close()
        
        return APIResponse.success(
            message='Service deleted successfully'
        )
        
    except Exception as e:
        print(f"❌ Error deleting service: {str(e)}")
        print(traceback.format_exc())
        return APIResponse.error(
            message='Failed to delete service',
            errors=str(e),
            status_code=500
        )


# ============================================
# ROUTE INFORMATION
# ============================================

@services_bp.route('/api/services/info', methods=['GET'])
def services_routes_info():
    """
    Get information about available service routes
    """
    routes = {
        'public_routes': {
            'get_all_services': {
                'method': 'GET',
                'path': '/api/services',
                'params': 'category (optional)',
                'description': 'Get all active services, optionally filtered by category'
            },
            'get_service_by_id': {
                'method': 'GET',
                'path': '/api/services/<service_id>',
                'description': 'Get detailed information about a specific service'
            },
            'get_service_price': {
                'method': 'GET',
                'path': '/api/services/<service_id>/price',
                'description': '✅ NEW: Get price for a specific service (lightweight)'
            },
            'get_services_by_category': {
                'method': 'GET',
                'path': '/api/services/category/<category_id>',
                'description': '✅ NEW: Get all services for a specific category'
            },
            'get_featured_services': {
                'method': 'GET',
                'path': '/api/services/featured',
                'description': 'Get featured services only'
            },
            'get_categories': {
                'method': 'GET',
                'path': '/api/categories',
                'description': 'Get all active categories'
            },
            'get_bulk_prices': {
                'method': 'POST',
                'path': '/api/services/bulk-price',
                'body': '{"serviceIds": [7, 8, 20]}',
                'description': '✅ NEW: Get prices for multiple services at once'
            }
        },
        'admin_routes': {
            'create_service': {
                'method': 'POST',
                'path': '/api/admin/services',
                'auth': 'required',
                'description': 'Create a new service'
            },
            'update_service': {
                'method': 'PUT',
                'path': '/api/admin/services/<service_id>',
                'auth': 'required',
                'description': 'Update an existing service'
            },
            'delete_service': {
                'method': 'DELETE',
                'path': '/api/admin/services/<service_id>',
                'auth': 'required',
                'description': 'Soft delete a service'
            }
        }
    }
    
    return APIResponse.success(
        data=routes,
        message='Service routes information'
    )