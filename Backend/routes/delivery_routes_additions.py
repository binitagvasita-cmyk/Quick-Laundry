"""
============================================================
QUICK LAUNDRY - DELIVERY BOY ROUTES  (additions only)
Add these 3 routes to your existing delivery_routes.py

New endpoints:
  PUT /api/delivery/profile    — delivery boy edits own profile
  PUT /api/delivery/location   — delivery boy updates current area (admin can see)
  PUT /api/delivery/password   — delivery boy changes password

Paste these functions at the bottom of your delivery_routes.py,
above the last blank line. No other changes needed.
============================================================
"""

import bcrypt
from flask import Blueprint, request
from database.db import get_db
from utils.response import APIResponse
from routes.delivery_auth import delivery_required

# (These are already imported in your delivery_routes.py — shown for reference)
delivery_bp = Blueprint('delivery', __name__, url_prefix='/api/delivery')


# ─────────────────────────────────────────────
# PUT /api/delivery/profile
# Delivery boy edits own contact / vehicle info
# ─────────────────────────────────────────────
@delivery_bp.route('/profile', methods=['PUT'])
@delivery_required
def update_profile():
    """
    Allowed fields:
      phone, city, address, pincode, vehicle_number, vehicle_type
    Email is NOT changeable (admin sets it).
    Full name is NOT changeable here (admin manages it).
    """
    try:
        uid  = request.delivery_user_id
        data = request.get_json()

        # ── Users table fields ──
        phone   = data.get('phone',   '').strip()
        city    = data.get('city',    '').strip()
        address = data.get('address', '').strip()
        pincode = data.get('pincode', '').strip()

        # ── Delivery_boys table fields ──
        vehicle_type   = data.get('vehicle_type',   '').strip()
        vehicle_number = data.get('vehicle_number', '').strip()

        db     = get_db()
        cursor = db.connection.cursor(dictionary=True)

        # Check phone uniqueness if provided
        if phone:
            cursor.execute(
                "SELECT user_id FROM users WHERE phone=%s AND user_id != %s",
                (phone, uid)
            )
            if cursor.fetchone():
                cursor.close()
                return APIResponse.error('Phone number already in use by another account', None, 409)

        # Update users table
        user_fields = {}
        if phone:           user_fields['phone']   = phone
        if city:            user_fields['city']     = city
        if address:         user_fields['address']  = address
        if pincode:         user_fields['pincode']  = pincode

        if user_fields:
            set_clause = ', '.join(f'{k}=%s' for k in user_fields)
            cursor.execute(
                f"UPDATE users SET {set_clause}, updated_at=NOW() WHERE user_id=%s",
                list(user_fields.values()) + [uid]
            )

        # Update delivery_boys table
        db_fields = {}
        if vehicle_type:   db_fields['vehicle_type']   = vehicle_type
        if vehicle_number: db_fields['vehicle_number']  = vehicle_number

        if db_fields:
            set_clause = ', '.join(f'{k}=%s' for k in db_fields)
            cursor.execute(
                f"UPDATE delivery_boys SET {set_clause} WHERE user_id=%s",
                list(db_fields.values()) + [uid]
            )

        db.connection.commit()
        cursor.close()

        return APIResponse.success(None, 'Profile updated successfully ✅')

    except Exception as e:
        print(f'❌ Update profile error: {e}')
        import traceback; traceback.print_exc()
        return APIResponse.error('Failed to update profile', None, 500)


# ─────────────────────────────────────────────
# PUT /api/delivery/location
# Delivery boy reports current working area.
# Admin can query this to know who is where.
# ─────────────────────────────────────────────
@delivery_bp.route('/location', methods=['PUT'])
@delivery_required
def update_location():
    """
    Saves the delivery boy's self-reported current area.
    Admin sees this in the delivery boy list.

    Requires in delivery_boys table:
      current_area    VARCHAR(255)  DEFAULT NULL
      location_notes  TEXT          DEFAULT NULL
      location_updated_at DATETIME  DEFAULT NULL

    SQL to add columns (run once):
      ALTER TABLE delivery_boys
        ADD COLUMN current_area         VARCHAR(255) DEFAULT NULL,
        ADD COLUMN location_notes       TEXT         DEFAULT NULL,
        ADD COLUMN location_updated_at  DATETIME     DEFAULT NULL;
    """
    try:
        uid          = request.delivery_user_id
        data         = request.get_json()
        current_area = (data.get('current_area') or '').strip()
        notes        = (data.get('notes') or '').strip()

        if not current_area:
            return APIResponse.error('current_area is required', None, 400)

        db     = get_db()
        cursor = db.connection.cursor(dictionary=True)

        cursor.execute("""
            UPDATE delivery_boys
            SET current_area        = %s,
                location_notes      = %s,
                location_updated_at = NOW()
            WHERE user_id = %s
        """, (current_area, notes or None, uid))

        db.connection.commit()
        cursor.close()

        return APIResponse.success({
            'current_area': current_area,
            'notes':        notes,
        }, f'Location updated to "{current_area}" ✅')

    except Exception as e:
        print(f'❌ Update location error: {e}')
        import traceback; traceback.print_exc()
        return APIResponse.error('Failed to update location', None, 500)


# ─────────────────────────────────────────────
# PUT /api/delivery/password
# Delivery boy changes own password
# ─────────────────────────────────────────────
@delivery_bp.route('/password', methods=['PUT'])
@delivery_required
def change_password():
    try:
        uid  = request.delivery_user_id
        data = request.get_json()

        old_password = data.get('old_password', '')
        new_password = data.get('new_password', '')

        if not old_password or not new_password:
            return APIResponse.error('old_password and new_password are required', None, 400)

        if len(new_password) < 6:
            return APIResponse.error('New password must be at least 6 characters', None, 400)

        db     = get_db()
        cursor = db.connection.cursor(dictionary=True)

        cursor.execute("SELECT password_hash FROM users WHERE user_id=%s", (uid,))
        user = cursor.fetchone()
        if not user:
            cursor.close()
            return APIResponse.error('User not found', None, 404)

        if not bcrypt.checkpw(old_password.encode('utf-8'), user['password_hash'].encode('utf-8')):
            cursor.close()
            return APIResponse.error('Current password is incorrect', None, 401)

        new_hash = bcrypt.hashpw(new_password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
        cursor.execute(
            "UPDATE users SET password_hash=%s, updated_at=NOW() WHERE user_id=%s",
            (new_hash, uid)
        )
        db.connection.commit()
        cursor.close()

        return APIResponse.success(None, 'Password changed successfully ✅')

    except Exception as e:
        print(f'❌ Change password error: {e}')
        import traceback; traceback.print_exc()
        return APIResponse.error('Failed to change password', None, 500)