"""
============================================
DRY CLEAN ROUTES — NEW BLUEPRINT
Category ID: 2 (Dry Cleaning)
Safe addition — does NOT modify any existing routes
============================================
"""

from flask import Blueprint
from database.db import get_db
from utils.response import APIResponse
import pymysql.cursors

# Blueprint
dry_clean_bp = Blueprint('dry_clean', __name__, url_prefix='/api/dry-clean')


# ============================================
# GET ALL DRY CLEAN SERVICES
# GET /api/dry-clean/services
# Public — no auth required
# ============================================
@dry_clean_bp.route('/services', methods=['GET'])
def get_dry_clean_services():
    """
    Returns all active services under Dry Cleaning category (category_id = 2).
    Includes features list per service.
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
                c.category_id,
                c.category_name,
                GROUP_CONCAT(
                    sf.feature_text
                    ORDER BY sf.display_order
                    SEPARATOR '|||'
                ) AS features
            FROM services s
            INNER JOIN categories c ON s.category_id = c.category_id
            LEFT  JOIN service_features sf ON s.service_id = sf.service_id
            WHERE s.category_id = 2
              AND s.is_active   = 1
              AND c.is_active   = 1
            GROUP BY s.service_id
            ORDER BY
                s.is_featured  DESC,
                s.display_order ASC,
                s.service_id   ASC
        """)

        rows = cursor.fetchall()
        cursor.close()

        services = []
        for row in rows:
            row['base_price']  = float(row['base_price'])
            row['is_featured'] = bool(row['is_featured'])
            row['features']    = row['features'].split('|||') if row.get('features') else []
            services.append(row)

        return APIResponse.success(
            "Dry Clean services retrieved successfully",
            {
                'services': services,
                'total':    len(services),
                'category': 'Dry Cleaning'
            }
        )

    except Exception as e:
        print(f"❌ get_dry_clean_services error: {e}")
        import traceback; traceback.print_exc()
        return APIResponse.error("Failed to fetch Dry Clean services", None, 500)


# ============================================
# GET DRY CLEAN CATEGORY INFO
# GET /api/dry-clean/category
# Public — no auth required
# ============================================
@dry_clean_bp.route('/category', methods=['GET'])
def get_dry_clean_category():
    """Returns metadata for the Dry Cleaning category."""
    try:
        db = get_db()
        cursor = db.connection.cursor(pymysql.cursors.DictCursor)

        cursor.execute("""
            SELECT
                category_id, category_name, description,
                icon, is_active, display_order, base_price
            FROM categories
            WHERE category_id = 2 AND is_active = 1
        """)

        cat = cursor.fetchone()
        cursor.close()

        if not cat:
            return APIResponse.error("Dry Clean category not found", None, 404)

        cat['base_price'] = float(cat['base_price'])
        cat['is_active']  = bool(cat['is_active'])

        return APIResponse.success("Dry Clean category retrieved", cat)

    except Exception as e:
        print(f"❌ get_dry_clean_category error: {e}")
        return APIResponse.error("Failed to fetch category info", None, 500)


# ============================================
# GET SINGLE DRY CLEAN SERVICE DETAIL
# GET /api/dry-clean/services/<service_id>
# Public — no auth required
# ============================================
@dry_clean_bp.route('/services/<int:service_id>', methods=['GET'])
def get_dry_clean_service_detail(service_id):
    """
    Returns details + features for one Dry Clean service.
    Only returns the service if it belongs to Dry Cleaning (category_id = 2).
    """
    try:
        db = get_db()
        cursor = db.connection.cursor(pymysql.cursors.DictCursor)

        cursor.execute("""
            SELECT
                s.service_id, s.service_name, s.description,
                s.base_price, s.price_unit, s.icon, s.image_path,
                s.is_featured, s.display_order,
                c.category_id, c.category_name
            FROM services s
            INNER JOIN categories c ON s.category_id = c.category_id
            WHERE s.service_id = %s
              AND s.category_id = 2
              AND s.is_active   = 1
        """, (service_id,))

        service = cursor.fetchone()

        if not service:
            cursor.close()
            return APIResponse.error("Service not found", None, 404)

        cursor.execute("""
            SELECT feature_text
            FROM   service_features
            WHERE  service_id = %s
            ORDER  BY display_order ASC
        """, (service_id,))

        features = cursor.fetchall()
        cursor.close()

        service['base_price']  = float(service['base_price'])
        service['is_featured'] = bool(service['is_featured'])
        service['features']    = [f['feature_text'] for f in features]

        return APIResponse.success("Service details retrieved", service)

    except Exception as e:
        print(f"❌ get_dry_clean_service_detail error: {e}")
        return APIResponse.error("Failed to fetch service details", None, 500)


print("✅ Dry Clean Routes Blueprint Loaded")