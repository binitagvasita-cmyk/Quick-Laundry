"""
============================================
ROLL PRESS ROUTES - NEW BLUEPRINT
GET services by category & category info for Roll Press
All existing functionality preserved - SAFE ADDITION
============================================
"""

from flask import Blueprint, jsonify
from database.db import get_db
from utils.response import APIResponse
import pymysql.cursors

# Create Blueprint
roll_press_bp = Blueprint('roll_press', __name__, url_prefix='/api/roll-press')


# ============================================
# GET ROLL PRESS SERVICES
# GET /api/roll-press/services
# Returns all active services for Roll Press category (category_id = 12)
# ============================================
@roll_press_bp.route('/services', methods=['GET'])
def get_roll_press_services():
    """
    Get all active Roll Press services with their details.
    No authentication required - public endpoint.
    """
    try:
        db = get_db()
        cursor = db.connection.cursor(pymysql.cursors.DictCursor)

        cursor.execute("""
            SELECT 
                s.service_id,
                s.service_name,
                s.description,
                s.base_price,
                s.price_unit,
                s.icon,
                s.image_path,
                s.is_featured,
                s.display_order,
                c.category_name,
                c.category_id,
                GROUP_CONCAT(sf.feature_text ORDER BY sf.display_order SEPARATOR '|||') AS features
            FROM services s
            INNER JOIN categories c ON s.category_id = c.category_id
            LEFT JOIN service_features sf ON s.service_id = sf.service_id
            WHERE s.category_id = 12
              AND s.is_active = 1
              AND c.is_active = 1
            GROUP BY s.service_id
            ORDER BY s.is_featured DESC, s.display_order ASC, s.service_id ASC
        """)

        services = cursor.fetchall()
        cursor.close()

        # Process features list
        for service in services:
            if service.get('features'):
                service['features'] = service['features'].split('|||')
            else:
                service['features'] = []
            # Convert Decimal to float for JSON serialization
            service['base_price'] = float(service['base_price'])
            service['is_featured'] = bool(service['is_featured'])

        return APIResponse.success(
            "Roll Press services retrieved successfully",
            {
                'services': services,
                'total': len(services),
                'category': 'Roll Press'
            }
        )

    except Exception as e:
        print(f"❌ Error fetching roll press services: {e}")
        import traceback
        traceback.print_exc()
        return APIResponse.error("Failed to fetch roll press services", None, 500)


# ============================================
# GET ROLL PRESS CATEGORY INFO
# GET /api/roll-press/category
# Returns Roll Press category metadata
# ============================================
@roll_press_bp.route('/category', methods=['GET'])
def get_roll_press_category():
    """
    Get Roll Press category information.
    No authentication required - public endpoint.
    """
    try:
        db = get_db()
        cursor = db.connection.cursor(pymysql.cursors.DictCursor)

        cursor.execute("""
            SELECT 
                category_id,
                category_name,
                description,
                icon,
                is_active,
                display_order,
                base_price
            FROM categories
            WHERE category_id = 12
              AND is_active = 1
        """)

        category = cursor.fetchone()
        cursor.close()

        if not category:
            return APIResponse.error("Roll Press category not found", None, 404)

        category['base_price'] = float(category['base_price'])
        category['is_active'] = bool(category['is_active'])

        return APIResponse.success(
            "Roll Press category retrieved successfully",
            category
        )

    except Exception as e:
        print(f"❌ Error fetching roll press category: {e}")
        return APIResponse.error("Failed to fetch category info", None, 500)


# ============================================
# GET SINGLE ROLL PRESS SERVICE
# GET /api/roll-press/services/<service_id>
# ============================================
@roll_press_bp.route('/services/<int:service_id>', methods=['GET'])
def get_roll_press_service_detail(service_id):
    """
    Get details of a specific Roll Press service.
    No authentication required - public endpoint.
    """
    try:
        db = get_db()
        cursor = db.connection.cursor(pymysql.cursors.DictCursor)

        # Get service (must belong to Roll Press category = 12)
        cursor.execute("""
            SELECT 
                s.service_id,
                s.service_name,
                s.description,
                s.base_price,
                s.price_unit,
                s.icon,
                s.image_path,
                s.is_featured,
                s.display_order,
                c.category_name,
                c.category_id
            FROM services s
            INNER JOIN categories c ON s.category_id = c.category_id
            WHERE s.service_id = %s
              AND s.category_id = 12
              AND s.is_active = 1
        """, (service_id,))

        service = cursor.fetchone()

        if not service:
            cursor.close()
            return APIResponse.error("Service not found or not a Roll Press service", None, 404)

        # Get features for this service
        cursor.execute("""
            SELECT feature_text
            FROM service_features
            WHERE service_id = %s
            ORDER BY display_order ASC
        """, (service_id,))

        features = cursor.fetchall()
        cursor.close()

        service['base_price'] = float(service['base_price'])
        service['is_featured'] = bool(service['is_featured'])
        service['features'] = [f['feature_text'] for f in features]

        return APIResponse.success(
            "Service details retrieved successfully",
            service
        )

    except Exception as e:
        print(f"❌ Error fetching service detail: {e}")
        return APIResponse.error("Failed to fetch service details", None, 500)


print("✅ Roll Press Routes Blueprint Loaded")