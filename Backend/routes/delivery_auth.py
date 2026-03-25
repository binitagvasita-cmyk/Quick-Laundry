"""
============================================================
QUICK LAUNDRY - DELIVERY BOY AUTH ROUTES
File: routes/delivery_auth.py

FIXES APPLIED:
  1. fetch_one_as_dict() — works with ALL DB drivers
     (flask-mysqldb tuple rows, mysql-connector dict rows, pymysql DictCursor)
  2. Hash format validation before bcrypt to avoid cryptic errors
  3. Graceful handling of $2y$ (PHP) → $2b$ (Python) conversion
============================================================
"""

from flask import Blueprint, request
from database.db import get_db
from utils.response import APIResponse
import bcrypt
import jwt
import os
from datetime import datetime, timedelta
from functools import wraps

delivery_auth_bp = Blueprint('delivery_auth', __name__, url_prefix='/api/delivery/auth')

SECRET_KEY = os.getenv('JWT_SECRET_KEY', 'your-secret-key-change-in-production')


def generate_delivery_token(user_id, delivery_id):
    payload = {
        'user_id':     user_id,
        'delivery_id': delivery_id,
        'role':        'delivery_boy',
        'exp':         datetime.utcnow() + timedelta(hours=24)
    }
    return jwt.encode(payload, SECRET_KEY, algorithm='HS256')


def delivery_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        auth_header = request.headers.get('Authorization', '')
        if not auth_header.startswith('Bearer '):
            return APIResponse.error('Unauthorized: No token provided', None, 401)
        token = auth_header.split(' ')[1]
        try:
            payload = jwt.decode(token, SECRET_KEY, algorithms=['HS256'])
            if payload.get('role') != 'delivery_boy':
                return APIResponse.error('Access denied: Not a delivery boy account', None, 403)
            request.delivery_user_id = payload['user_id']
            request.delivery_id      = payload['delivery_id']
        except jwt.ExpiredSignatureError:
            return APIResponse.error('Token expired, please login again', None, 401)
        except jwt.InvalidTokenError:
            return APIResponse.error('Invalid token', None, 401)
        return f(*args, **kwargs)
    return decorated


def fetch_one_as_dict(db, sql, params):
    """
    Execute a SELECT and return exactly one row as a dict.
    Works with flask-mysqldb (tuple rows), mysql-connector (dict rows),
    and pymysql DictCursor — tries all three drivers in order.
    """
    # ── Try mysql-connector dictionary=True ─────────────────────────────
    try:
        cursor = db.connection.cursor(dictionary=True)
        cursor.execute(sql, params)
        row = cursor.fetchone()
        cursor.close()
        if row is None or isinstance(row, dict):
            return row
        # Came back as tuple — fall through
    except Exception:
        pass

    # ── Try pymysql DictCursor ───────────────────────────────────────────
    try:
        import pymysql.cursors
        cursor = db.connection.cursor(pymysql.cursors.DictCursor)
        cursor.execute(sql, params)
        row = cursor.fetchone()
        cursor.close()
        return row
    except Exception:
        pass

    # ── Last resort: plain tuple cursor, map via description ─────────────
    cursor = db.connection.cursor()
    cursor.execute(sql, params)
    row = cursor.fetchone()
    if row is None:
        cursor.close()
        return None
    cols = [d[0] for d in cursor.description]
    cursor.close()
    return dict(zip(cols, row))


# ─────────────────────────────────────────────
# POST /api/delivery/auth/login
# ─────────────────────────────────────────────
@delivery_auth_bp.route('/login', methods=['POST'])
def delivery_login():
    try:
        data = request.get_json()
        if not data:
            return APIResponse.error('Request body required', None, 400)

        email    = data.get('email', '').strip().lower()
        password = data.get('password', '')

        if not email or not password:
            return APIResponse.error('Email and password are required', None, 400)

        db = get_db()

        sql = """
            SELECT u.user_id, u.full_name, u.email, u.password_hash,
                   u.phone, u.is_active, u.is_delivery_boy,
                   u.profile_picture,
                   db2.delivery_id, db2.vehicle_type, db2.vehicle_number,
                   db2.is_available, db2.total_delivered
            FROM users u
            JOIN delivery_boys db2 ON u.user_id = db2.user_id
            WHERE u.email = %s AND u.is_delivery_boy = 1
        """
        user = fetch_one_as_dict(db, sql, (email,))

        print(f"🚴 Delivery login attempt: {email}")
        print(f"🚴 User found: {user is not None}")

        if not user:
            return APIResponse.error('Invalid credentials or not a delivery account', None, 401)

        if not user.get('is_active'):
            return APIResponse.error('Your account has been deactivated. Contact admin.', None, 403)

        # Fix PHP bcrypt $2y$ → $2b$ compatibility
        password_hash = user.get('password_hash', '') or ''
        if isinstance(password_hash, str) and password_hash.startswith('$2y$'):
            password_hash = '$2b$' + password_hash[4:]

        print(f"🚴 Hash prefix: {password_hash[:7] if password_hash else 'None'}")

        # Validate hash looks like a real bcrypt hash before calling bcrypt
        if not password_hash or not password_hash.startswith('$2'):
            print(f"❌ Invalid/corrupt hash stored for user {email}. Re-run generate_hash.py")
            return APIResponse.error('Invalid email or password', None, 401)

        try:
            pw_match = bcrypt.checkpw(
                password.encode('utf-8'),
                password_hash.encode('utf-8')
            )
        except Exception as e:
            print(f"❌ bcrypt error: {e}")
            return APIResponse.error('Invalid email or password', None, 401)

        print(f"🚴 Password match: {pw_match}")

        if not pw_match:
            return APIResponse.error('Invalid email or password', None, 401)

        token = generate_delivery_token(user['user_id'], user['delivery_id'])

        return APIResponse.success({
            'token': token,
            'user': {
                'user_id':         user['user_id'],
                'delivery_id':     user['delivery_id'],
                'full_name':       user['full_name'],
                'email':           user['email'],
                'phone':           user['phone'],
                'profile_picture': user.get('profile_picture'),
                'vehicle_type':    user.get('vehicle_type'),
                'vehicle_number':  user.get('vehicle_number'),
                'is_available':    bool(user.get('is_available', True)),
                'total_delivered': user.get('total_delivered', 0),
            }
        }, 'Login successful! Welcome back 🚴')

    except Exception as e:
        print(f'❌ Delivery login error: {e}')
        import traceback; traceback.print_exc()
        return APIResponse.error('Login failed due to server error', None, 500)


# ─────────────────────────────────────────────
# GET /api/delivery/auth/verify
# ─────────────────────────────────────────────
@delivery_auth_bp.route('/verify', methods=['GET'])
@delivery_required
def verify_token():
    try:
        db  = get_db()
        sql = """
            SELECT u.user_id, u.full_name, u.email, u.phone, u.profile_picture,
                   db2.delivery_id, db2.vehicle_type, db2.vehicle_number,
                   db2.is_available, db2.total_delivered
            FROM users u
            JOIN delivery_boys db2 ON u.user_id = db2.user_id
            WHERE u.user_id = %s AND u.is_delivery_boy = 1
        """
        user = fetch_one_as_dict(db, sql, (request.delivery_user_id,))

        if not user:
            return APIResponse.error('User not found', None, 404)

        return APIResponse.success(user, 'Token valid')
    except Exception as e:
        print(f'❌ Verify error: {e}')
        return APIResponse.error('Verification failed', None, 500)


# ─────────────────────────────────────────────
# POST /api/delivery/auth/logout
# ─────────────────────────────────────────────
@delivery_auth_bp.route('/logout', methods=['POST'])
@delivery_required
def delivery_logout():
    return APIResponse.success(None, 'Logged out successfully')