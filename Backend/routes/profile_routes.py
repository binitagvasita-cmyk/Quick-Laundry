"""
============================================
PROFILE ROUTES - FIXED VERSION
Handles DictCursor properly
============================================
"""

from flask import Blueprint, request, jsonify
from middleware.auth_middleware import token_required
from database.db import get_db
from utils.response import APIResponse
from werkzeug.utils import secure_filename
import os
from datetime import datetime, date
import traceback
import sys

# Create Blueprint
profile_bp = Blueprint('profile', __name__, url_prefix='/api/profile')


# ============================================
# CLEANIFY LAUNDRY — SERVICE AREA CONFIG
# Shop: Satellite, Ahmedabad | Radius: ~10 km
# ============================================
SERVICEABLE_PINCODES = {
    "380015": "Satellite / Prahlad Nagar / Jodhpur Village",
    "380054": "Bodakdev",
    "380051": "Vastrapur",
    "380061": "Anandnagar",
    "380059": "Thaltej",
    "380013": "Shyamal / Paldi",
    "380009": "Navrangpura",
    "380006": "Ambawadi",
    "380007": "Maninagar",
    "380058": "Science City Road",
    "380060": "Gota",
}

def is_pincode_serviceable(pincode):
    """Check if a pincode is within Cleanify Laundry's 10 km delivery zone."""
    if not pincode:
        return False, "Pincode is required"
    pincode = str(pincode).strip()
    if not pincode.isdigit() or len(pincode) != 6:
        return False, "Please enter a valid 6-digit pincode"
    if pincode in SERVICEABLE_PINCODES:
        return True, SERVICEABLE_PINCODES[pincode]
    return False, (
        f"Sorry! Pincode {pincode} is outside our 10 km delivery zone. "
        f"We serve Satellite, Bodakdev, Vastrapur, Prahlad Nagar, Thaltej, "
        f"Navrangpura & nearby Ahmedabad areas. Call: +91 98765 43210"
    )

# ============================================
# UPLOAD CONFIGURATION
# ============================================

import cloudinary
import cloudinary.uploader

cloudinary.config(
    cloud_name = os.getenv('CLOUDINARY_CLOUD_NAME', 'didrdetea'),
    api_key    = os.getenv('CLOUDINARY_API_KEY', ''),
    api_secret = os.getenv('CLOUDINARY_API_SECRET', '')
)

ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'webp'}
MAX_FILE_SIZE = 5 * 1024 * 1024

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

# ============================================
# ULTRA-SAFE VALUE CONVERSION
# ============================================

def safe_value(value):
    """Convert any value to JSON-safe format"""
    try:
        if value is None:
            return None
        if isinstance(value, (datetime, date)):
            return value.isoformat()
        if isinstance(value, bytes):
            return value.decode('utf-8', errors='ignore')
        if isinstance(value, (int, float, str, bool)):
            return value
        # For any other type, convert to string
        return str(value)
    except Exception as e:
        print(f"⚠️ Error converting value {value}: {e}")
        return None

def row_to_dict(cursor, row):
    """
    ULTRA-SAFE: Convert database row to dictionary
    Handles BOTH DictCursor (returns dict) and regular cursor (returns tuple)
    """
    if row is None:
        return None
    
    try:
        # If row is already a dictionary (DictCursor), just convert values
        if isinstance(row, dict):
            print("✅ Row is already a dictionary (DictCursor)")
            result = {}
            for key, value in row.items():
                result[key] = safe_value(value)
            return result
        
        # If row is a tuple/list (regular cursor), convert using cursor.description
        if not cursor.description:
            print("❌ ERROR: cursor.description is None or empty")
            return None
        
        columns = [desc[0] for desc in cursor.description]
        
        if len(columns) != len(row):
            print(f"❌ ERROR: Column count mismatch - columns={len(columns)}, row={len(row)}")
            return None
        
        result = {}
        for i, column_name in enumerate(columns):
            try:
                result[column_name] = safe_value(row[i])
            except Exception as e:
                print(f"⚠️ Error converting column {column_name}[{i}]: {e}")
                result[column_name] = None
        
        return result
        
    except Exception as e:
        print(f"❌ CRITICAL ERROR in row_to_dict:")
        print(f"   Exception: {e}")
        print(f"   Row type: {type(row)}")
        print(f"   Row value: {row}")
        traceback.print_exc()
        return None

def rows_to_dict_list(cursor, rows):
    """Convert list of rows to list of dictionaries"""
    if not rows:
        return []
    
    try:
        result = []
        for row in rows:
            row_dict = row_to_dict(cursor, row)
            if row_dict:
                result.append(row_dict)
        return result
        
    except Exception as e:
        print(f"❌ ERROR in rows_to_dict_list: {e}")
        traceback.print_exc()
        return []

# ============================================
# GET COMPLETE PROFILE DATA
# ============================================


# ✅ FIX: OPTIONS preflight MUST return 200 without @token_required
# Otherwise: browser sends OPTIONS → 401 returned → CORS blocked → address never loads
@profile_bp.route('/', methods=['OPTIONS'], strict_slashes=False)
def profile_preflight():
    from flask import make_response
    return make_response('', 200)


@profile_bp.route('/', methods=['GET'])
@token_required
def get_profile(current_user):
    """
    Get complete user profile
    FIXED version with proper DictCursor handling
    """
    
    print("\n" + "="*70)
    print("🔍 PROFILE REQUEST RECEIVED")
    print("="*70)
    
    cursor = None
    db = None
    
    try:
        # Step 1: Validate current_user
        print("\n📋 Step 1: Validating current_user...")
        if not current_user:
            print("❌ ERROR: current_user is None")
            return APIResponse.error("Authentication failed", "No user data", 401)
        
        if 'user_id' not in current_user:
            print("❌ ERROR: current_user has no user_id")
            print(f"   current_user keys: {current_user.keys()}")
            return APIResponse.error("Authentication failed", "No user_id", 401)
        
        user_id = current_user['user_id']
        print(f"✅ User authenticated: user_id={user_id}")
        
        # Step 2: Get database connection
        print("\n📋 Step 2: Getting database connection...")
        try:
            db = get_db()
            if not db:
                print("❌ ERROR: get_db() returned None")
                return APIResponse.error("Database connection failed", "db is None", 500)
            
            if not hasattr(db, 'connection'):
                print("❌ ERROR: db object has no 'connection' attribute")
                return APIResponse.error("Database connection failed", "No connection attr", 500)
            
            if not db.connection:
                print("❌ ERROR: db.connection is None")
                return APIResponse.error("Database connection failed", "connection is None", 500)
            
            print(f"✅ Database connection obtained: {type(db)}")
            
        except Exception as db_error:
            print(f"❌ ERROR getting database: {db_error}")
            traceback.print_exc()
            return APIResponse.error("Database connection failed", str(db_error), 500)
        
        # Step 3: Create cursor
        print("\n📋 Step 3: Creating cursor...")
        try:
            cursor = db.connection.cursor()
            if not cursor:
                print("❌ ERROR: cursor() returned None")
                return APIResponse.error("Database cursor failed", "cursor is None", 500)
            
            print(f"✅ Cursor created: {type(cursor)}")
            
        except Exception as cursor_error:
            print(f"❌ ERROR creating cursor: {cursor_error}")
            traceback.print_exc()
            return APIResponse.error("Database cursor failed", str(cursor_error), 500)
        
        # Step 4: Query user data
        print(f"\n📋 Step 4: Querying user data for user_id={user_id}...")
        
        try:
            query = """
                SELECT 
                    user_id,
                    full_name,
                    email,
                    phone,
                    profile_picture,
                    address,
                    city,
                    pincode,
                    date_of_birth,
                    gender,
                    comm_email,
                    comm_whatsapp,
                    comm_phone,
                    is_verified,
                    email_verified,
                    phone_verified,
                    created_at,
                    last_login
                FROM users
                WHERE user_id = %s
            """
            
            print(f"   Executing query...")
            cursor.execute(query, (user_id,))
            
            print(f"   Fetching row...")
            user_row = cursor.fetchone()
            
            if not user_row:
                print(f"❌ ERROR: No user found with user_id={user_id}")
                if cursor:
                    cursor.close()
                return APIResponse.error("User not found", f"No user with id {user_id}", 404)
            
            print(f"✅ User row fetched:")
            print(f"   Row type: {type(user_row)}")
            
        except Exception as query_error:
            print(f"❌ ERROR executing user query: {query_error}")
            traceback.print_exc()
            if cursor:
                cursor.close()
            return APIResponse.error("Database query failed", str(query_error), 500)
        
        # Step 5: Convert user row to dict
        print("\n📋 Step 5: Converting user row to dictionary...")
        
        try:
            user_data = row_to_dict(cursor, user_row)
            
            if not user_data:
                print("❌ ERROR: row_to_dict returned None")
                if cursor:
                    cursor.close()
                return APIResponse.error("Data conversion failed", "Could not convert user data", 500)
            
            print(f"✅ User data converted successfully:")
            print(f"   Keys: {list(user_data.keys())}")
            print(f"   full_name: {user_data.get('full_name')}")
            print(f"   email: {user_data.get('email')}")
            print(f"   phone: {user_data.get('phone')}")
            
        except Exception as convert_error:
            print(f"❌ ERROR converting user data: {convert_error}")
            traceback.print_exc()
            if cursor:
                cursor.close()
            return APIResponse.error("Data conversion failed", str(convert_error), 500)
        
        # Step 6: Get orders
        print("\n📋 Step 6: Getting orders...")
        
        orders = []
        try:
            cursor.execute("""
                SELECT 
                    cart_id,
                    service_id,
                    service_name,
                    quantity,
                    unit_price,
                    total_price,
                    unit,
                    pickup_date,
                    pickup_time,
                    status,
                    created_at
                FROM cart
                WHERE user_id = %s
                ORDER BY created_at DESC
                LIMIT 20
            """, (user_id,))
            
            orders_rows = cursor.fetchall()
            orders = rows_to_dict_list(cursor, orders_rows)
            print(f"✅ Orders retrieved: {len(orders)} orders")
            
        except Exception as orders_error:
            print(f"⚠️ Warning: Could not get orders: {orders_error}")
            orders = []
        
        # Step 7: Get addresses
        print("\n📋 Step 7: Getting addresses...")
        
        addresses = []
        try:
            cursor.execute("""
                SELECT 
                    address_id,
                    type,
                    name,
                    phone,
                    street,
                    city,
                    state,
                    zip,
                    landmark,
                    is_default,
                    created_at
                FROM user_addresses
                WHERE user_id = %s
                ORDER BY is_default DESC, created_at DESC
            """, (user_id,))
            
            addresses_rows = cursor.fetchall()
            addresses = rows_to_dict_list(cursor, addresses_rows)
            print(f"✅ Addresses retrieved: {len(addresses)} addresses")
            
        except Exception as addr_error:
            print(f"⚠️ Warning: Could not get addresses: {addr_error}")
            addresses = []
        
        # Step 8: Close cursor
        print("\n📋 Step 8: Closing cursor...")
        if cursor:
            cursor.close()
            print("✅ Cursor closed")
        
        # Step 9: Prepare response
        print("\n📋 Step 9: Preparing response...")
        
        profile_data = {
            'user': user_data,
            'orders': orders,
            'addresses': addresses,
            'stats': {
                'total_orders': len(orders),
                'total_addresses': len(addresses)
            }
        }
        
        print(f"✅ Response data prepared successfully")
        print("="*70)
        print("✅ PROFILE REQUEST COMPLETED SUCCESSFULLY")
        print("="*70 + "\n")
        
        return APIResponse.success(profile_data, "Profile data retrieved successfully")
        
    except Exception as e:
        print("\n" + "="*70)
        print("❌ UNEXPECTED ERROR IN get_profile:")
        print("="*70)
        print(f"Exception type: {type(e).__name__}")
        print(f"Exception message: {str(e)}")
        print("\nFull traceback:")
        print("-"*70)
        traceback.print_exc()
        print("="*70 + "\n")
        
        if cursor:
            try:
                cursor.close()
            except:
                pass
        
        return APIResponse.error("Failed to fetch profile data", str(e), 500)

# ============================================
# UPDATE PERSONAL INFORMATION
# ============================================

@profile_bp.route('/update', methods=['PUT'])
@token_required
def update_profile(current_user):
    """Update user personal information"""
    try:
        data = request.get_json()
        user_id = current_user['user_id']
        
        print(f"\n📝 Updating profile for user_id={user_id}")
        
        if not data.get('full_name'):
            return APIResponse.error("Full name is required", None, 400)
        
        if not data.get('phone'):
            return APIResponse.error("Phone number is required", None, 400)
        
        db = get_db()
        cursor = db.connection.cursor()
        
        cursor.execute("""
            UPDATE users
            SET 
                full_name = %s,
                phone = %s,
                date_of_birth = %s,
                gender = %s,
                address = %s,
                city = %s,
                pincode = %s,
                updated_at = CURRENT_TIMESTAMP
            WHERE user_id = %s
        """, (
            data.get('full_name'),
            data.get('phone'),
            data.get('date_of_birth'),
            data.get('gender'),
            data.get('address'),
            data.get('city'),
            data.get('pincode'),
            user_id
        ))
        
        db.connection.commit()
        cursor.close()
        
        print(f"✅ Profile updated successfully")
        
        return APIResponse.success({'user_id': user_id}, "Profile updated successfully")
        
    except Exception as e:
        print(f"❌ Error updating profile: {e}")
        traceback.print_exc()
        db.connection.rollback()
        return APIResponse.error("Failed to update profile", str(e), 500)

# ============================================
# OTHER ENDPOINTS (SIMPLIFIED FOR SPACE)
# ============================================

@profile_bp.route('/orders', methods=['GET'])
@token_required
def get_orders(current_user):
    """Get user order history"""
    try:
        user_id = current_user['user_id']
        status = request.args.get('status', 'all')
        limit = int(request.args.get('limit', 20))
        offset = int(request.args.get('offset', 0))
        
        db = get_db()
        cursor = db.connection.cursor()
        
        query = """SELECT cart_id, service_id, service_name, quantity, unit_price, 
                   total_price, unit, pickup_date, pickup_time, pickup_address, 
                   special_instructions, status, created_at, updated_at 
                   FROM cart WHERE user_id = %s"""
        
        params = [user_id]
        
        if status != 'all':
            query += " AND status = %s"
            params.append(status)
        
        query += " ORDER BY created_at DESC LIMIT %s OFFSET %s"
        params.extend([limit, offset])
        
        cursor.execute(query, params)
        orders_rows = cursor.fetchall()
        orders = rows_to_dict_list(cursor, orders_rows)
        cursor.close()
        
        return APIResponse.success({'orders': orders, 'count': len(orders)}, "Orders retrieved successfully")
        
    except Exception as e:
        print(f"❌ Error fetching orders: {e}")
        traceback.print_exc()
        return APIResponse.error("Failed to fetch orders", str(e), 500)

@profile_bp.route('/addresses', methods=['GET'])
@token_required
def get_addresses(current_user):
    """Get all saved addresses"""
    try:
        user_id = current_user['user_id']
        db = get_db()
        cursor = db.connection.cursor()
        
        cursor.execute("""SELECT address_id, type, name, phone, street, city, state, 
                         zip, landmark, is_default, created_at 
                         FROM user_addresses WHERE user_id = %s 
                         ORDER BY is_default DESC, created_at DESC""", (user_id,))
        
        addresses_rows = cursor.fetchall()
        addresses = rows_to_dict_list(cursor, addresses_rows)
        cursor.close()
        
        return APIResponse.success({'addresses': addresses}, "Addresses retrieved successfully")
        
    except Exception as e:
        print(f"❌ Error fetching addresses: {e}")
        traceback.print_exc()
        return APIResponse.error("Failed to fetch addresses", str(e), 500)

@profile_bp.route('/addresses', methods=['POST'])
@token_required
def add_address(current_user):
    """Add new address"""
    try:
        data = request.get_json()
        user_id = current_user['user_id']
        
        required_fields = ['type', 'name', 'phone', 'street', 'city', 'state', 'zip']
        for field in required_fields:
            if not data.get(field):
                return APIResponse.error(f"{field} is required", None, 400)

        # ── SERVICE AREA CHECK — block address if pincode outside zone ──
        address_pincode = str(data.get('zip', '')).strip()
        serviceable, area_or_msg = is_pincode_serviceable(address_pincode)
        if not serviceable:
            print(f"🚫 Address save blocked — pincode {address_pincode} outside service zone")
            return APIResponse.error(
                message=area_or_msg,
                errors={'zip': address_pincode, 'serviceable': False},
                status_code=400
            )
        print(f"✅ Address pincode {address_pincode} is valid → {area_or_msg}")
        # ────────────────────────────────────────────────────────────────
        
        db = get_db()
        cursor = db.connection.cursor()
        
        if data.get('isDefault'):
            cursor.execute("UPDATE user_addresses SET is_default = 0 WHERE user_id = %s", (user_id,))
        
        cursor.execute("""INSERT INTO user_addresses 
                         (user_id, type, name, phone, street, city, state, zip, landmark, is_default) 
                         VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)""", 
                      (user_id, data.get('type'), data.get('name'), data.get('phone'), 
                       data.get('street'), data.get('city'), data.get('state'), data.get('zip'),
                       data.get('landmark'), 1 if data.get('isDefault') else 0))
        
        address_id = cursor.lastrowid
        db.connection.commit()
        cursor.close()
        
        return APIResponse.success({'address_id': address_id}, "Address added successfully")
        
    except Exception as e:
        print(f"❌ Error adding address: {e}")
        traceback.print_exc()
        db.connection.rollback()
        return APIResponse.error("Failed to add address", str(e), 500)

@profile_bp.route('/addresses/<int:address_id>', methods=['PUT'])
@token_required
def update_address(current_user, address_id):
    """Update address"""
    try:
        data = request.get_json()
        user_id = current_user['user_id']
        db = get_db()
        cursor = db.connection.cursor()
        
        cursor.execute("SELECT address_id FROM user_addresses WHERE address_id = %s AND user_id = %s", 
                      (address_id, user_id))
        
        if not cursor.fetchone():
            cursor.close()
            return APIResponse.error("Address not found", None, 404)

        # ── SERVICE AREA CHECK — block update if new pincode outside zone ──
        if data.get('zip'):
            serviceable, area_or_msg = is_pincode_serviceable(str(data.get('zip', '')))
            if not serviceable:
                print(f"🚫 Address update blocked — pincode {data.get('zip')} outside service zone")
                cursor.close()
                return APIResponse.error(
                    message=area_or_msg,
                    errors={'zip': data.get('zip'), 'serviceable': False},
                    status_code=400
                )
            print(f"✅ Update pincode {data.get('zip')} valid → {area_or_msg}")
        # ────────────────────────────────────────────────────────────────

        if data.get('isDefault'):
            cursor.execute("UPDATE user_addresses SET is_default = 0 WHERE user_id = %s", (user_id,))
        
        cursor.execute("""UPDATE user_addresses SET type = %s, name = %s, phone = %s, 
                         street = %s, city = %s, state = %s, zip = %s, landmark = %s, 
                         is_default = %s, updated_at = CURRENT_TIMESTAMP 
                         WHERE address_id = %s AND user_id = %s""",
                      (data.get('type'), data.get('name'), data.get('phone'), data.get('street'),
                       data.get('city'), data.get('state'), data.get('zip'), data.get('landmark'),
                       1 if data.get('isDefault') else 0, address_id, user_id))
        
        db.connection.commit()
        cursor.close()
        
        return APIResponse.success({'address_id': address_id}, "Address updated successfully")
        
    except Exception as e:
        print(f"❌ Error updating address: {e}")
        traceback.print_exc()
        db.connection.rollback()
        return APIResponse.error("Failed to update address", str(e), 500)

@profile_bp.route('/addresses/<int:address_id>', methods=['DELETE'])
@token_required
def delete_address(current_user, address_id):
    """Delete address"""
    try:
        user_id = current_user['user_id']
        db = get_db()
        cursor = db.connection.cursor()
        
        cursor.execute("SELECT address_id FROM user_addresses WHERE address_id = %s AND user_id = %s",
                      (address_id, user_id))
        
        if not cursor.fetchone():
            cursor.close()
            return APIResponse.error("Address not found", None, 404)
        
        cursor.execute("DELETE FROM user_addresses WHERE address_id = %s AND user_id = %s",
                      (address_id, user_id))
        
        db.connection.commit()
        cursor.close()
        
        return APIResponse.success({'address_id': address_id}, "Address deleted successfully")
        
    except Exception as e:
        print(f"❌ Error deleting address: {e}")
        traceback.print_exc()
        db.connection.rollback()
        return APIResponse.error("Failed to delete address", str(e), 500)

@profile_bp.route('/preferences', methods=['PUT'])
@token_required
def update_preferences(current_user):
    """Update preferences"""
    try:
        data = request.get_json()
        user_id = current_user['user_id']
        db = get_db()
        cursor = db.connection.cursor()
        
        cursor.execute("""UPDATE users SET comm_email = %s, comm_phone = %s, 
                         comm_whatsapp = %s, updated_at = CURRENT_TIMESTAMP 
                         WHERE user_id = %s""",
                      (1 if data.get('emailNotif') else 0,
                       1 if data.get('smsNotif') else 0,
                       1 if data.get('promoNotif') else 0,
                       user_id))
        
        db.connection.commit()
        cursor.close()
        
        return APIResponse.success({'user_id': user_id}, "Preferences updated successfully")
        
    except Exception as e:
        print(f"❌ Error updating preferences: {e}")
        traceback.print_exc()
        db.connection.rollback()
        return APIResponse.error("Failed to update preferences", str(e), 500)

@profile_bp.route('/upload-picture', methods=['POST'])
@token_required
def upload_profile_picture(current_user):
    """Upload profile picture"""
    try:
        user_id = current_user['user_id']
        
        if 'image' not in request.files:
            return APIResponse.error("No image file provided", None, 400)
        
        file = request.files['image']
        
        if file.filename == '':
            return APIResponse.error("No file selected", None, 400)
        
        if not allowed_file(file.filename):
            return APIResponse.error("Invalid file type", None, 400)
        
        file.seek(0, os.SEEK_END)
        file_size = file.tell()
        file.seek(0)
        
        if file_size > MAX_FILE_SIZE:
            return APIResponse.error("File size exceeds 5MB limit", None, 400)
        
        upload_result = cloudinary.uploader.upload(
            file,
            folder="quicklaundry/profiles",
            public_id=f"user_{user_id}",
            overwrite=True,
            resource_type="image"
        )
        db_path = upload_result['secure_url']

        db = get_db()
        cursor = db.connection.cursor()
        cursor.execute(
            "UPDATE users SET profile_picture = %s, updated_at = CURRENT_TIMESTAMP WHERE user_id = %s",
            (db_path, user_id)
        )
        db.connection.commit()
        cursor.close()
        
        return APIResponse.success({'profile_picture': db_path}, "Profile picture updated successfully")
        
    except Exception as e:
        print(f"❌ Error uploading picture: {e}")
        traceback.print_exc()
        return APIResponse.error("Failed to upload picture", str(e), 500)

@profile_bp.route('/stats', methods=['GET'])
@token_required
def get_profile_stats(current_user):
    """Get profile statistics"""
    try:
        user_id = current_user['user_id']
        db = get_db()
        cursor = db.connection.cursor()
        
        cursor.execute("""SELECT COUNT(*) as total_orders,
                         SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_orders,
                         SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending_orders,
                         SUM(total_price) as total_spent FROM cart WHERE user_id = %s""", (user_id,))
        
        stats_row = cursor.fetchone()
        stats = row_to_dict(cursor, stats_row)
        cursor.close()
        
        return APIResponse.success(stats, "Statistics retrieved successfully")
        
    except Exception as e:
        print(f"❌ Error fetching statistics: {e}")
        traceback.print_exc()
        return APIResponse.error("Failed to fetch statistics", str(e), 500)

print("✅ Profile routes (FIXED VERSION) loaded successfully!")