"""
============================================
AUTHENTICATION MIDDLEWARE - PYMYSQL VERSION
✅ Fixed for PyMySQL DictCursor
============================================
"""

from functools import wraps
from flask import request
from database.db import get_db
import jwt
import os
from datetime import datetime, timedelta
from dotenv import load_dotenv
import pymysql.cursors

load_dotenv()

# Get JWT secret from environment
JWT_SECRET = os.getenv('JWT_SECRET_KEY', 'your-secret-key-change-this')
JWT_EXPIRATION_HOURS = int(os.getenv('JWT_EXPIRATION_HOURS', '24'))


class APIResponse:
    """API Response helper"""
    
    @staticmethod
    def success(message, data=None, status_code=200):
        """Success response"""
        response = {
            'success': True,
            'message': message
        }
        if data is not None:
            response['data'] = data
        return response, status_code
    
    @staticmethod
    def error(message, data=None, status_code=400):
        """Error response"""
        response = {
            'success': False,
            'error': message
        }
        if data is not None:
            response['data'] = data
        return response, status_code


def generate_jwt_token(user_data, expiration_hours=None):
    """Generate JWT token"""
    hours = expiration_hours or JWT_EXPIRATION_HOURS
    
    payload = {
        'user_id': user_data['user_id'],
        'email': user_data['email'],
        'full_name': user_data.get('full_name', ''),
        'iat': datetime.utcnow(),
        'exp': datetime.utcnow() + timedelta(hours=hours)
    }
    
    token = jwt.encode(payload, JWT_SECRET, algorithm='HS256')
    return token


def generate_token(payload_data, expiration_hours=None):
    """
    Generate JWT token (used by admin routes)
    Accepts any payload data and adds expiration
    """
    hours = expiration_hours or JWT_EXPIRATION_HOURS
    
    payload = {
        **payload_data,
        'iat': datetime.utcnow(),
        'exp': datetime.utcnow() + timedelta(hours=hours)
    }
    
    token = jwt.encode(payload, JWT_SECRET, algorithm='HS256')
    return token


def verify_token(token):
    """
    Verify JWT token and return payload
    Returns None if token is invalid
    """
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=['HS256'])
        return payload
    except jwt.ExpiredSignatureError:
        print("❌ Token has expired")
        return None
    except jwt.InvalidTokenError as e:
        print(f"❌ Invalid token: {e}")
        return None
    except Exception as e:
        print(f"❌ Token verification error: {e}")
        return None


def admin_required(f):
    """
    Decorator to protect admin routes
    ✅ FIXED FOR PYMYSQL: Uses pymysql.cursors.DictCursor
    """
    @wraps(f)
    def decorated(*args, **kwargs):
        token = None
        
        # Get token from Authorization header
        auth_header = request.headers.get('Authorization')
        
        if auth_header:
            try:
                token = auth_header.split(' ')[1]
            except IndexError:
                return APIResponse.error('Invalid token format. Use: Bearer <token>', None, 401)
        
        if not token:
            return APIResponse.error('Authentication token is missing', None, 401)
        
        try:
            # Decode JWT token
            data = jwt.decode(token, JWT_SECRET, algorithms=['HS256'])
            
            # ✅ FIX: Use PyMySQL DictCursor
            db = get_db()
            cursor = db.connection.cursor(pymysql.cursors.DictCursor)
            
            cursor.execute(
                """
                SELECT user_id, email, full_name, is_admin, admin_role, is_active
                FROM users 
                WHERE user_id = %s
                """,
                (data.get('user_id'),)
            )
            
            user = cursor.fetchone()
            cursor.close()
            
            if not user:
                return APIResponse.error('User not found', None, 401)
            
            # Check if user is admin
            if not user.get('is_admin'):
                return APIResponse.error('Admin access required', None, 403)
            
            # Check if admin account is active
            if not user.get('is_active'):
                return APIResponse.error('Admin account is deactivated', None, 403)
            
            # Pass admin data to the route
            current_user = {
                'user_id': user['user_id'],
                'email': user['email'],
                'full_name': user['full_name'],
                'is_admin': True,
                'admin_role': user.get('admin_role')
            }
            
        except jwt.ExpiredSignatureError:
            return APIResponse.error('Token has expired. Please login again', None, 401)
        
        except jwt.InvalidTokenError as e:
            print(f"❌ Invalid token error: {e}")
            return APIResponse.error('Invalid token. Please login again', None, 401)
        
        except Exception as e:
            print(f"❌ Token validation error: {e}")
            import traceback
            traceback.print_exc()
            return APIResponse.error('Authentication failed', None, 401)
        
        # Call the original function with current_user
        return f(current_user, *args, **kwargs)
    
    return decorated


def token_required(f):
    """
    Decorator to protect user routes (non-admin)
    ✅ FIXED FOR PYMYSQL
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
        
        try:
            data = jwt.decode(token, JWT_SECRET, algorithms=['HS256'])
            
            db = get_db()
            cursor = db.connection.cursor(pymysql.cursors.DictCursor)
            
            cursor.execute(
                "SELECT user_id, email, full_name FROM users WHERE user_id = %s",
                (data.get('user_id'),)
            )
            
            user = cursor.fetchone()
            cursor.close()
            
            if not user:
                return APIResponse.error('User not found', None, 401)
            
            current_user = {
                'user_id': user['user_id'],
                'email': user['email'],
                'full_name': user['full_name']
            }
            
        except jwt.ExpiredSignatureError:
            return APIResponse.error('Token has expired', None, 401)
        except jwt.InvalidTokenError:
            return APIResponse.error('Invalid token', None, 401)
        except Exception as e:
            print(f"❌ Token validation error: {e}")
            return APIResponse.error('Authentication failed', None, 401)
        
        return f(current_user, *args, **kwargs)
    
    return decorated