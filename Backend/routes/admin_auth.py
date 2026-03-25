"""
============================================
ADMIN AUTHENTICATION ROUTES - PYMYSQL VERSION
✅ Fixed for PyMySQL (not MySQL Connector)
✅ Uses DictCursor from pymysql.cursors
============================================
"""

from flask import Blueprint, request, jsonify
from database.db import get_db
from utils.auth_middleware import admin_required
import jwt
import os
from datetime import datetime, timedelta
import pymysql.cursors

admin_auth_bp = Blueprint('admin_auth', __name__, url_prefix='/api/admin/auth')

JWT_SECRET = os.getenv('JWT_SECRET_KEY', 'your-secret-key-change-this')
JWT_EXPIRATION_HOURS = int(os.getenv('JWT_EXPIRATION_HOURS', '24'))


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


def generate_token(payload_data, expiration_hours=None):
    hours = expiration_hours or JWT_EXPIRATION_HOURS
    payload = {
        **payload_data,
        'iat': datetime.utcnow(),
        'exp': datetime.utcnow() + timedelta(hours=hours)
    }
    token = jwt.encode(payload, JWT_SECRET, algorithm='HS256')
    return token


def verify_password(plain_password, password_hash):
    try:
        import bcrypt
        if isinstance(plain_password, str):
            plain_password = plain_password.encode('utf-8')
        if isinstance(password_hash, str):
            password_hash = password_hash.encode('utf-8')
        return bcrypt.checkpw(plain_password, password_hash)
    except Exception as e:
        print(f"❌ Password verification error: {e}")
        return False


@admin_auth_bp.route('/login', methods=['POST', 'OPTIONS'])
def admin_login():
    """
    Admin login endpoint
    ✅ FIXED FOR PYMYSQL: Uses pymysql.cursors.DictCursor
    """
    if request.method == 'OPTIONS':
        response = jsonify({'status': 'ok'})
        response.headers.add('Access-Control-Allow-Origin', '*')
        response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization')
        response.headers.add('Access-Control-Allow-Methods', 'POST,OPTIONS')
        return response, 204
    
    try:
        print("\n" + "="*50)
        print("🔐 ADMIN LOGIN ATTEMPT")
        print("="*50)
        
        data = request.get_json()
        
        if not data:
            print("❌ No data provided in request")
            return APIResponse.error('No data provided', None, 400)
        
        email = data.get('email', '').strip()
        password = data.get('password', '')
        
        print(f"📧 Email: {email}")
        print(f"🔑 Password length: {len(password)}")
        
        if not email or not password:
            print("❌ Missing email or password")
            return APIResponse.error('Email and password are required', None, 400)
        
        # ✅ FIX FOR PYMYSQL: Use DictCursor
        db = get_db()
        cursor = db.connection.cursor(pymysql.cursors.DictCursor)
        
        print(f"🔍 Querying database for admin: {email}")
        cursor.execute(
            """
            SELECT user_id, email, full_name, password_hash, is_admin, admin_role, is_active
            FROM users 
            WHERE email = %s AND is_admin = 1
            """,
            (email,)
        )
        
        # ✅ Now returns a dictionary
        admin = cursor.fetchone()
        
        if not admin:
            print("❌ Admin user not found in database")
            print(f"   - Searched for: {email}")
            print(f"   - With is_admin = 1")
            cursor.close()
            return APIResponse.error('Invalid credentials', None, 401)
        
        print(f"✅ Admin user found!")
        print(f"   - Name: {admin['full_name']}")
        print(f"   - User ID: {admin['user_id']}")
        print(f"   - Admin Role: {admin.get('admin_role', 'N/A')}")
        print(f"   - Is Active: {admin.get('is_active', False)}")
        
        # Check if admin account is active
        if not admin.get('is_active'):
            print("❌ Admin account is deactivated")
            cursor.close()
            return APIResponse.error('Your admin account has been deactivated', None, 403)
        
        # Verify password
        print("🔐 Verifying password...")
        password_hash = admin['password_hash']
        
        # Enhanced debug logging
        print(f"   - Stored hash starts with: {password_hash[:20]}...")
        print(f"   - Password starts with: '{password[:3]}...'")
        print(f"   - Password length: {len(password)}")
        
        if not verify_password(password, password_hash):
            print("❌ Password verification FAILED")
            print("   💡 Possible issues:")
            print("      1. Wrong password entered")
            print("      2. Password hash in database doesn't match")
            print("      3. Password encoding issue")
            cursor.close()
            return APIResponse.error('Invalid credentials', None, 401)
        
        print("✅ Password verified successfully!")
        
        # Generate JWT token
        token_payload = {
            'user_id': admin['user_id'],
            'email': admin['email'],
            'full_name': admin['full_name'],
            'is_admin': True,
            'admin_role': admin.get('admin_role', 'admin')
        }
        
        token = generate_token(token_payload)
        print("✅ JWT token generated successfully")
        print(f"   - Token expires in: {JWT_EXPIRATION_HOURS} hours")
        
        # Log admin login activity
        try:
            cursor.execute(
                """
                INSERT INTO admin_activity_logs 
                (admin_id, action_type, action_description, ip_address, user_agent)
                VALUES (%s, %s, %s, %s, %s)
                """,
                (
                    admin['user_id'],
                    'login',
                    'Admin logged in successfully',
                    request.remote_addr,
                    request.headers.get('User-Agent', '')[:255]
                )
            )
            db.connection.commit()
            print("✅ Login activity logged")
        except Exception as log_error:
            print(f"⚠️ Failed to log admin login activity: {log_error}")
            # Don't fail login if logging fails
        
        cursor.close()
        
        # Prepare response
        response_data = {
            'token': token,
            'admin': {
                'userId': admin['user_id'],
                'email': admin['email'],
                'fullName': admin['full_name'],
                'adminRole': admin.get('admin_role', 'admin')
            }
        }
        
        print("✅ LOGIN SUCCESSFUL!")
        print("="*50 + "\n")
        
        return APIResponse.success(response_data, 'Login successful')
        
    except Exception as e:
        print(f"\n❌ ADMIN LOGIN ERROR")
        print(f"Error type: {type(e).__name__}")
        print(f"Error message: {str(e)}")
        import traceback
        traceback.print_exc()
        print("="*50 + "\n")
        return APIResponse.error(f'An error occurred during login: {str(e)}', None, 500)


@admin_auth_bp.route('/logout', methods=['POST', 'OPTIONS'])
@admin_required
def admin_logout(current_user):
    """Admin logout endpoint"""
    if request.method == 'OPTIONS':
        return '', 204
    
    try:
        db = get_db()
        cursor = db.connection.cursor(pymysql.cursors.DictCursor)
        
        try:
            cursor.execute(
                """
                INSERT INTO admin_activity_logs 
                (admin_id, action_type, action_description, ip_address, user_agent)
                VALUES (%s, %s, %s, %s, %s)
                """,
                (
                    current_user['user_id'],
                    'logout',
                    'Admin logged out',
                    request.remote_addr,
                    request.headers.get('User-Agent', '')[:255]
                )
            )
            db.connection.commit()
        except:
            pass
        
        cursor.close()
        return APIResponse.success(None, 'Logged out successfully')
        
    except Exception as e:
        print(f"❌ Logout error: {e}")
        return APIResponse.error('Logout error', None, 500)


@admin_auth_bp.route('/verify', methods=['GET', 'OPTIONS'])
@admin_required
def verify_admin(current_user):
    """Verify admin token endpoint"""
    if request.method == 'OPTIONS':
        return '', 204
    
    return APIResponse.success(
        {
            'admin': {
                'userId': current_user['user_id'],
                'email': current_user['email'],
                'fullName': current_user['full_name'],
                'adminRole': current_user.get('admin_role', 'admin')
            }
        },
        'Token is valid'
    )


@admin_auth_bp.route('/status', methods=['GET'])
def admin_status():
    """Check if admin panel is available"""
    return APIResponse.success(
        {
            'admin_panel_enabled': True,
            'version': '1.0.0',
            'database_driver': 'PyMySQL',
            'endpoints': {
                'login': '/api/admin/auth/login',
                'logout': '/api/admin/auth/logout',
                'verify': '/api/admin/auth/verify'
            }
        },
        'Admin panel is available'
    )