"""
============================================
AUTHENTICATION MIDDLEWARE - COMPLETE & FIXED
JWT token validation with database admin check.

KEY FIX: Every decorator now calls db.disconnect() in a finally block
so each request's connection is returned/closed after use.
This eliminates "Packet sequence number wrong" on concurrent requests.
============================================
"""

from functools import wraps
from flask import request
from database.db import get_db
from utils.response import APIResponse
import jwt
import os
from datetime import datetime, timedelta
from dotenv import load_dotenv

load_dotenv()

JWT_SECRET = os.getenv('JWT_SECRET_KEY', 'your-secret-key-change-this')
JWT_EXPIRATION_HOURS = int(os.getenv('JWT_EXPIRATION_HOURS', '24'))


def generate_jwt_token(user_data, expiration_hours=None):
    """Generate JWT token with custom expiration."""
    hours = expiration_hours or JWT_EXPIRATION_HOURS
    payload = {
        'user_id':   user_data['user_id'],
        'email':     user_data['email'],
        'full_name': user_data.get('full_name', ''),
        'iat':       datetime.utcnow(),
        'exp':       datetime.utcnow() + timedelta(hours=hours)
    }
    token = jwt.encode(payload, JWT_SECRET, algorithm='HS256')
    print(f"✅ JWT token generated for user {user_data['user_id']} (expires in {hours}h)")
    return token


# ─────────────────────────────────────────────────────────────────────────────
def token_required(f):
    """
    Decorator to protect user routes (non-admin).
    Opens a fresh DB connection per request and always closes it.
    """
    @wraps(f)
    def decorated(*args, **kwargs):
        token = None
        auth_header = request.headers.get('Authorization')

        if auth_header:
            try:
                token = auth_header.split(' ')[1]
            except IndexError:
                return APIResponse.error('Invalid token format', None, 401)

        if not token:
            return APIResponse.error('Authentication token is missing', None, 401)

        db = None
        try:
            data = jwt.decode(token, JWT_SECRET, algorithms=['HS256'])

            db = get_db()                          # ← fresh connection
            user = db.fetch_one(
                "SELECT user_id, email, full_name, is_active FROM users WHERE user_id = %s",
                (data.get('user_id'),)
            )

            if not user:
                return APIResponse.error('User not found', None, 401)
            if not user.get('is_active'):
                return APIResponse.error('Account is deactivated', None, 403)

            current_user = {
                'user_id':   user['user_id'],
                'email':     user['email'],
                'full_name': user['full_name'],
            }

        except jwt.ExpiredSignatureError:
            return APIResponse.error('Token has expired', None, 401)
        except jwt.InvalidTokenError:
            return APIResponse.error('Invalid token', None, 401)
        except Exception as e:
            print(f"❌ Token validation error: {e}")
            return APIResponse.error('Authentication failed', None, 401)
        finally:
            if db:
                db.disconnect()                    # ← always close

        return f(current_user, *args, **kwargs)

    return decorated


# ─────────────────────────────────────────────────────────────────────────────
def optional_token(f):
    """
    Allows both authenticated and anonymous access.
    If token is valid → passes user data; otherwise passes None.
    """
    @wraps(f)
    def decorated(*args, **kwargs):
        current_user = None
        auth_header  = request.headers.get('Authorization')

        if auth_header:
            db = None
            try:
                token = auth_header.split(' ')[1]
                data  = jwt.decode(token, JWT_SECRET, algorithms=['HS256'])

                db   = get_db()
                user = db.fetch_one(
                    "SELECT user_id, email, full_name FROM users WHERE user_id = %s",
                    (data.get('user_id'),)
                )
                if user:
                    current_user = {
                        'user_id':   user['user_id'],
                        'email':     user['email'],
                        'full_name': user['full_name'],
                    }
            except Exception:
                pass                               # anonymous on any error
            finally:
                if db:
                    db.disconnect()

        return f(current_user, *args, **kwargs)

    return decorated


# Alias
def optional_auth(f):
    """Alias for optional_token — for compatibility."""
    return optional_token(f)


# ─────────────────────────────────────────────────────────────────────────────
def admin_required(f):
    """
    Decorator to protect admin-only routes.
    Checks is_admin from DATABASE (not env vars).
    Opens a fresh DB connection per request and always closes it.
    """
    @wraps(f)
    def decorated(*args, **kwargs):
        token = None
        auth_header = request.headers.get('Authorization')

        if auth_header:
            try:
                token = auth_header.split(' ')[1]
            except IndexError:
                return APIResponse.error('Invalid token format. Use: Bearer <token>', None, 401)

        if not token:
            return APIResponse.error('Authentication token is missing', None, 401)

        db = None
        try:
            data = jwt.decode(token, JWT_SECRET, algorithms=['HS256'])

            db   = get_db()                        # ← fresh connection
            user = db.fetch_one(
                """
                SELECT user_id, email, full_name, is_admin, admin_role, is_active
                FROM users
                WHERE user_id = %s
                """,
                (data.get('user_id'),)
            )

            if not user:
                return APIResponse.error('User not found', None, 401)
            if not user.get('is_admin'):
                return APIResponse.error('Admin access required', None, 403)
            if not user.get('is_active'):
                return APIResponse.error('Admin account is deactivated', None, 403)

            current_user = {
                'user_id':    user['user_id'],
                'email':      user['email'],
                'full_name':  user['full_name'],
                'is_admin':   True,
                'admin_role': user.get('admin_role'),
            }

        except jwt.ExpiredSignatureError:
            return APIResponse.error('Token has expired. Please login again', None, 401)
        except jwt.InvalidTokenError as e:
            print(f"❌ Invalid token error: {e}")
            return APIResponse.error('Invalid token. Please login again', None, 401)
        except Exception as e:
            print(f"❌ Token validation error: {e}")
            import traceback; traceback.print_exc()
            return APIResponse.error('Authentication failed', None, 401)
        finally:
            if db:
                db.disconnect()                    # ← always close

        return f(current_user, *args, **kwargs)

    return decorated


# ─────────────────────────────────────────────────────────────────────────────
def refresh_token_endpoint(f):
    """Decorator for token refresh endpoint."""
    @wraps(f)
    def decorated(*args, **kwargs):
        token = None
        auth_header = request.headers.get('Authorization')

        if auth_header:
            try:
                token = auth_header.split(' ')[1]
            except IndexError:
                return APIResponse.error('Invalid token format', None, 401)

        if not token:
            return APIResponse.error('Token required for refresh', None, 401)

        try:
            data = jwt.decode(
                token, JWT_SECRET, algorithms=['HS256'],
                options={'verify_exp': False}
            )

            try:
                from models.session import LoginSession

                session = LoginSession.get_session_by_token(token)
                if session:
                    new_token = generate_jwt_token({
                        'user_id':   data['user_id'],
                        'email':     data['email'],
                        'full_name': data.get('full_name', '')
                    })
                    LoginSession.invalidate_session_by_token(token)
                    LoginSession.create_session(
                        user_id=data['user_id'],
                        jwt_token=new_token,
                        device_info=session.get('device_info'),
                        ip_address=session.get('ip_address')
                    )
                    current_user = {**data, 'new_token': new_token}
                    return f(current_user, *args, **kwargs)
                else:
                    return APIResponse.error('Session not found. Please login again', None, 401)

            except ImportError:
                new_token = generate_jwt_token({
                    'user_id':   data['user_id'],
                    'email':     data['email'],
                    'full_name': data.get('full_name', '')
                })
                current_user = {**data, 'new_token': new_token}
                return f(current_user, *args, **kwargs)

        except Exception as e:
            print(f"❌ Token refresh error: {e}")
            import traceback; traceback.print_exc()
            return APIResponse.error('Token refresh failed', None, 401)

    return decorated