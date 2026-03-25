"""
============================================
AUTHENTICATION ROUTES - COMPLETE WITH TOKEN VALIDATION
User registration, login, OTP verification, password reset, and token validation
============================================
"""

from flask import Blueprint, request
from models.user import User
from models.session import LoginSession, LoginActivity
from utils.validators import Validator
from utils.security import Security, OTPManager
from utils.response import APIResponse, ErrorMessages, SuccessMessages
from database.db import db
from utils.email_sender import send_otp_email, send_password_reset_email
import json
from datetime import datetime
import traceback

auth_bp = Blueprint('auth', __name__, url_prefix='/api/auth')


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
    """Check if pincode is within Cleanify Laundry's 10 km delivery zone."""
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
        f"Navrangpura & nearby Ahmedabad areas. Call us: +91 98765 43210"
    )


# ============================================
# TEMPORARY OTP STORAGE TABLE
# ============================================
pending_registrations = {}


# ============================================
# ✅ VALIDATE TOKEN ENDPOINT (CRITICAL FOR PRICING PAGE)
# ============================================
@auth_bp.route('/validate-token', methods=['POST', 'OPTIONS'])
def validate_token():
    """
    Validate JWT token and return user info
    Used by frontend to check if user is authenticated
    
    Returns:
        200: Token valid with user data
        401: Invalid/expired token
    """
    
    # Handle preflight CORS request
    if request.method == 'OPTIONS':
        return '', 204
    
    try:
        # Get token from Authorization header
        auth_header = request.headers.get('Authorization')
        
        if not auth_header:
            return APIResponse.error('No authorization token provided', None, 401)
        
        try:
            # Extract token from "Bearer <token>"
            token = auth_header.split(' ')[1]
        except IndexError:
            return APIResponse.error('Invalid token format', None, 401)
        
        print(f"🔐 Validating token: {token[:30]}...")
        
        # Verify token using Security utility
        payload = Security.verify_jwt_token(token)
        
        if not payload:
            print("❌ Token verification failed - invalid or expired")
            return APIResponse.error('Invalid or expired token', None, 401)
        
        user_id = payload.get('user_id')
        
        print(f"✅ Token payload verified for user_id: {user_id}")
        
        # Verify session exists and is active
        session = LoginSession.get_session_by_token(token)
        
        if not session:
            print("❌ Session not found for token")
            return APIResponse.error('Session not found or expired', None, 401)
        
        # Check if session is active
        if not session.get('is_active', False):
            print("❌ Session is inactive")
            return APIResponse.error('Session is no longer active', None, 401)
        
        print(f"✅ Session is active: {session.get('session_id')}")
        
        # Get user data
        user = User.get_user_by_id(user_id)
        
        if not user:
            print("❌ User not found")
            return APIResponse.error('User not found', None, 401)
        
        # Check if user is active
        if not user.get('is_active', True):
            print("❌ User account is deactivated")
            return APIResponse.error('Account is deactivated', None, 401)
        
        print(f"✅ Token validation successful for: {user['email']}")
        
        # Return user info
        user_data = {
            'user_id': user['user_id'],
            'email': user['email'],
            'full_name': user['full_name'],
            'phone': user['phone'],
            'is_verified': user.get('email_verified', False),
            'is_active': user.get('is_active', True)
        }
        
        return APIResponse.success(
            {
                'valid': True,
                'user': user_data,
                'session': {
                    'session_id': session.get('session_id'),
                    'expires_at': session.get('expires_at').isoformat() if session.get('expires_at') else None
                }
            },
            'Token is valid'
        )
        
    except Exception as e:
        print(f"❌ Token validation error: {e}")
        traceback.print_exc()
        return APIResponse.error('Token validation failed', None, 401)


# ============================================
# CHECK EMAIL AVAILABILITY
# ============================================
@auth_bp.route('/check-email', methods=['POST'])
def check_email():
    """Check if email is available"""
    try:
        data = request.get_json()
        
        if not data:
            return APIResponse.bad_request("Request body is required")
        
        email = data.get('email', '').strip()
        
        if not email:
            return APIResponse.bad_request(ErrorMessages.EMAIL_REQUIRED)
        
        is_valid, error, normalized = Validator.validate_email_address(email)
        if not is_valid:
            return APIResponse.bad_request(error)
        
        exists = User.email_exists(normalized)
        
        response_data = {
            'available': not exists,
            'email': normalized
        }
        
        return APIResponse.success(response_data, "Email checked successfully")
        
    except Exception as e:
        print(f"❌ Check email error: {e}")
        return APIResponse.internal_error(ErrorMessages.SERVER_ERROR)


# ============================================
# CHECK PHONE AVAILABILITY
# ============================================
@auth_bp.route('/check-phone', methods=['POST'])
def check_phone():
    """Check if phone is available"""
    try:
        data = request.get_json()
        
        if not data:
            return APIResponse.bad_request("Request body is required")
        
        phone = data.get('phone', '').strip()
        
        if not phone:
            return APIResponse.bad_request("Phone number is required")
        
        is_valid, error = Validator.validate_phone_number(phone)
        if not is_valid:
            return APIResponse.bad_request(error)
        
        exists = User.phone_exists(phone)
        
        response_data = {
            'available': not exists,
            'phone': phone
        }
        
        return APIResponse.success(response_data, "Phone checked successfully")
        
    except Exception as e:
        print(f"❌ Check phone error: {e}")
        return APIResponse.internal_error(ErrorMessages.SERVER_ERROR)


# ============================================
# REGISTRATION ENDPOINT - STEP 1
# ============================================
@auth_bp.route('/register', methods=['POST'])
def register():
    """
    Register a new user (Step 1 - Validate & Send OTP)
    User data is NOT stored in database yet
    
    Returns:
        200: OTP sent (user data stored temporarily)
        400: Validation error
        409: Email/phone already exists
        500: Server error
    """
    try:
        data = request.get_json()
        
        if not data:
            return APIResponse.bad_request("Request body is required")
        
        # Validate registration data
        is_valid, errors = Validator.validate_registration_data(data)
        
        if not is_valid:
            return APIResponse.validation_error(errors, "Validation failed")
        
        # ── SERVICE AREA CHECK — Block if pincode outside Satellite zone ──
        pincode = str(data.get('pincode', '')).strip()
        serviceable, area_or_msg = is_pincode_serviceable(pincode)
        if not serviceable:
            print(f"🚫 Registration blocked — pincode {pincode} outside service area")
            return APIResponse.error(
                message=area_or_msg,
                errors={
                    'pincode': area_or_msg,
                    'serviceable': False,
                    'shop': 'Cleanify Laundry, Satellite, Ahmedabad'
                },
                status_code=400
            )
        print(f"✅ Pincode {pincode} is serviceable — area: {area_or_msg}")
        # ─────────────────────────────────────────────────────────────────

        # Check if email already exists
        if User.email_exists(data['email']):
            return APIResponse.conflict(ErrorMessages.EMAIL_EXISTS)
        
        # Check if phone already exists
        if User.phone_exists(data['phone']):
            return APIResponse.conflict(ErrorMessages.PHONE_EXISTS)
        
        # Generate OTP
        otp_code = Security.generate_otp()
        
        # Store registration data temporarily
        temp_user_id = f"temp_{data['email']}_{Security.generate_otp()}"
        
        pending_registrations[temp_user_id] = {
            'user_data': data,
            'otp_code': otp_code,
            'otp_expires_at': Security.get_otp_expiry_time().isoformat(),
            'created_at': datetime.utcnow().isoformat()
        }
        
        # Send OTP email
        email_sent = send_otp_email(data['email'], otp_code, data['full_name'])
        
        if not email_sent:
            print("⚠️ Warning: Failed to send OTP email")
        
        print(f"📱 OTP for registration {data['email']}: {otp_code}")
        print(f"🔑 Temp User ID: {temp_user_id}")
        
        # Return response with temp_user_id
        response_data = {
            'temp_user_id': temp_user_id,
            'email': data['email'],
            'otp_sent_to': Security.mask_email(data['email']),
            'otp_required': True,
            'otp_expires_in_minutes': 5
        }
        
        return APIResponse.success(
            response_data,
            "Registration initiated. Please verify OTP to complete signup."
        )
        
    except Exception as e:
        print(f"❌ Registration error: {e}")
        traceback.print_exc()
        return APIResponse.internal_error(ErrorMessages.SERVER_ERROR)


# ============================================
# VERIFY OTP ENDPOINT - STEP 2
# ============================================
@auth_bp.route('/verify-otp', methods=['POST'])
def verify_otp():
    """
    Verify OTP code (Step 2 - Create user WITHOUT auto-login)
    User is created in database after successful OTP verification
    NO JWT TOKEN IS GENERATED - user must login separately
    
    Returns:
        200: OTP verified, user created (no token, redirect to login)
        400: Validation error
        401: Invalid OTP
        500: Server error
    """
    try:
        data = request.get_json()
        
        if not data:
            return APIResponse.bad_request("Request body is required")
        
        temp_user_id = data.get('temp_user_id')
        otp_code = data.get('otp_code', '').strip()
        
        print(f"🔐 OTP Verification Request:")
        print(f"   temp_user_id: {temp_user_id}")
        print(f"   otp_code: {otp_code}")
        
        if not temp_user_id:
            return APIResponse.bad_request("temp_user_id is required")
        
        # Validate OTP format
        is_valid, error = Validator.validate_otp(otp_code)
        if not is_valid:
            return APIResponse.bad_request(error)
        
        # Check if temp registration exists
        if temp_user_id not in pending_registrations:
            print(f"❌ temp_user_id '{temp_user_id}' not found")
            return APIResponse.unauthorized("Registration session expired or invalid. Please try registering again.")
        
        registration_data = pending_registrations[temp_user_id]
        
        # Verify OTP
        if registration_data['otp_code'] != otp_code:
            print(f"❌ OTP mismatch!")
            return APIResponse.unauthorized(ErrorMessages.OTP_INVALID)
        
        # Check if OTP expired
        otp_expires_at = datetime.fromisoformat(registration_data['otp_expires_at'])
        if datetime.utcnow() > otp_expires_at:
            del pending_registrations[temp_user_id]
            print(f"❌ OTP expired!")
            return APIResponse.unauthorized(ErrorMessages.OTP_EXPIRED)
        
        print(f"✅ OTP verified successfully!")
        
        # Create user in database
        user_data = registration_data['user_data']
        
        try:
            user = User.create_user(user_data)
            
            if not user:
                print("❌ User.create_user returned None/False")
                return APIResponse.internal_error("Failed to create user account")
            
            print(f"✅ User created in database: {user.get('user_id', 'NO_ID')}")
            
        except Exception as create_error:
            print(f"❌ Create user error: {type(create_error).__name__}")
            print(f"❌ Error details: {str(create_error)}")
            traceback.print_exc()
            return APIResponse.internal_error(f"Failed to create user account")
        
        # Mark email as verified
        try:
            User.mark_email_verified(user['user_id'])
            print(f"✅ Email marked as verified for user: {user['user_id']}")
        except Exception as verify_error:
            print(f"⚠️ Failed to mark email as verified: {verify_error}")
        
        # Get updated user
        try:
            user = User.get_user_by_id(user['user_id'])
            print(f"✅ Retrieved updated user data")
        except Exception as get_error:
            print(f"⚠️ Failed to retrieve updated user: {get_error}")
        
        # Clean up temporary registration
        del pending_registrations[temp_user_id]
        print(f"🧹 Cleaned up temporary registration: {temp_user_id}")
        
        # Return success WITHOUT token (user must login)
        response_data = {
            'user': {
                'full_name': user['full_name'],
                'email': user['email'],
                'user_id': user['user_id']
            },
            'verified': True,
            'registration_complete': True,
            'next_step': 'login',
            'message': 'Please login with your credentials to continue'
        }
        
        print(f"✅ User created and verified: {user['email']}")
        print(f"📌 User should now LOGIN separately")
        
        return APIResponse.success(
            response_data,
            "Registration completed successfully! Please login to continue."
        )
        
    except Exception as e:
        print(f"❌ OTP verification error: {e}")
        traceback.print_exc()
        return APIResponse.internal_error(ErrorMessages.SERVER_ERROR)


# ============================================
# RESEND OTP ENDPOINT
# ============================================
@auth_bp.route('/resend-otp', methods=['POST'])
def resend_otp():
    """Resend OTP code for pending registration"""
    try:
        data = request.get_json()
        
        if not data:
            return APIResponse.bad_request("Request body is required")
        
        temp_user_id = data.get('temp_user_id')
        
        if not temp_user_id:
            return APIResponse.bad_request("temp_user_id is required")
        
        # Check if temp registration exists
        if temp_user_id not in pending_registrations:
            return APIResponse.not_found("Registration session not found or expired. Please start registration again.")
        
        registration_data = pending_registrations[temp_user_id]
        user_data = registration_data['user_data']
        
        # Generate new OTP
        otp_code = Security.generate_otp()
        
        # Update stored OTP
        pending_registrations[temp_user_id]['otp_code'] = otp_code
        pending_registrations[temp_user_id]['otp_expires_at'] = Security.get_otp_expiry_time().isoformat()
        
        # Send OTP email
        email_sent = send_otp_email(user_data['email'], otp_code, user_data['full_name'])
        
        if not email_sent:
            print("⚠️ Warning: Failed to send OTP email")
        
        print(f"📱 New OTP for {user_data['email']}: {otp_code}")
        
        return APIResponse.otp_sent_response(
            masked_email=Security.mask_email(user_data['email']),
            masked_phone=Security.mask_phone(user_data['phone'])
        )
        
    except Exception as e:
        print(f"❌ Resend OTP error: {e}")
        traceback.print_exc()
        return APIResponse.internal_error(ErrorMessages.SERVER_ERROR)


# ============================================
# LOGIN ENDPOINT - WITH SESSION TRACKING
# ============================================
@auth_bp.route('/login', methods=['POST'])
def login():
    """
    User login with session tracking
    
    Returns:
        200: Login successful with JWT token
        400: Validation error
        401: Invalid credentials
        403: Account deactivated/not verified
        500: Server error
    """
    try:
        data = request.get_json()
        
        if not data:
            return APIResponse.bad_request("Request body is required")
        
        email = data.get('email', '').strip()
        password = data.get('password', '')
        
        if not email:
            return APIResponse.bad_request(ErrorMessages.EMAIL_REQUIRED)
        
        if not password:
            return APIResponse.bad_request(ErrorMessages.PASSWORD_REQUIRED)
        
        # Get device and IP information
        device_info = request.headers.get('User-Agent', 'Unknown Device')
        ip_address = request.remote_addr or 'Unknown IP'
        
        print(f"🔐 Login attempt: {email}")
        print(f"   IP: {ip_address}")
        
        # Verify credentials
        user = User.verify_password(email, password)
        
        if not user:
            # Log failed attempt
            LoginActivity.log_failure(email, ip_address, "Invalid credentials")
            return APIResponse.unauthorized(ErrorMessages.INVALID_CREDENTIALS)
        
        print(f"✅ User found: {user['full_name']} (ID: {user['user_id']})")
        
        # Check if user is active
        if not user.get('is_active', True):
            LoginActivity.log_failure(email, ip_address, "Account deactivated")
            return APIResponse.forbidden("Your account has been deactivated. Please contact support.")
        
        # Check if email is verified
        if not user.get('email_verified', False):
            LoginActivity.log_failure(email, ip_address, "Email not verified")
            return APIResponse.forbidden(
                "Please verify your email before logging in. Check your inbox for the verification link."
            )
        
        # Generate JWT token
        token = Security.generate_jwt_token(user['user_id'], user['email'])
        
        if not token:
            print("❌ JWT token generation failed")
            return APIResponse.internal_error("Failed to generate authentication token")
        
        print(f"✅ JWT token generated")
        
        # CREATE LOGIN SESSION IN DATABASE
        session_id = None
        try:
            session_id = LoginSession.create_session(
                user_id=user['user_id'],
                jwt_token=token,
                device_info=device_info[:255],
                ip_address=ip_address[:45]
            )
            
            if session_id:
                print(f"✅ Login session created: {session_id}")
            else:
                print("⚠️ Warning: Session creation failed (continuing anyway)")
        
        except Exception as session_error:
            print(f"⚠️ Session creation error: {session_error}")
            traceback.print_exc()
        
        # Log successful login
        LoginActivity.log_success(user['user_id'], ip_address, device_info[:50])
        
        # Get configuration
        from config import get_config
        config = get_config()
        
        # Prepare response data
        response_data = {
            'token': token,
            'token_type': 'Bearer',
            'expires_in': int(config.JWT_ACCESS_TOKEN_EXPIRES.total_seconds()),
            'user': User.remove_sensitive_data(user.copy()),
            'session': {
                'session_id': session_id,
                'ip_address': ip_address,
                'device': device_info[:50] + '...' if len(device_info) > 50 else device_info
            }
        }
        
        print(f"✅ Login successful for: {user['email']}")
        
        return APIResponse.success(
            response_data,
            f"Welcome back, {user['full_name']}!"
        )
        
    except Exception as e:
        print(f"❌ Login error: {e}")
        traceback.print_exc()
        return APIResponse.internal_error(ErrorMessages.SERVER_ERROR)


# ============================================
# LOGOUT ENDPOINT
# ============================================
@auth_bp.route('/logout', methods=['POST'])
def logout():
    """Logout user and invalidate session"""
    try:
        # Get token from Authorization header
        auth_header = request.headers.get('Authorization')
        
        if not auth_header:
            return APIResponse.success(None, SuccessMessages.LOGOUT_SUCCESS)
        
        token = Security.extract_token_from_header(auth_header)
        
        if not token:
            return APIResponse.success(None, SuccessMessages.LOGOUT_SUCCESS)
        
        # Verify token
        payload = Security.verify_jwt_token(token)
        
        if payload:
            user_id = payload.get('user_id')
            
            # Invalidate session
            try:
                LoginSession.invalidate_session_by_token(token)
                print(f"✅ Session invalidated for user: {user_id}")
            except Exception as session_error:
                print(f"⚠️ Session invalidation error: {session_error}")
            
            # Log logout
            LoginActivity.log_logout(user_id, "session")
        
        return APIResponse.success(None, SuccessMessages.LOGOUT_SUCCESS)
        
    except Exception as e:
        print(f"❌ Logout error: {e}")
        traceback.print_exc()
        return APIResponse.internal_error(ErrorMessages.SERVER_ERROR)


# ============================================
# GET ACTIVE SESSIONS
# ============================================
@auth_bp.route('/sessions', methods=['GET'])
def get_sessions():
    """Get all active sessions for logged-in user"""
    try:
        auth_header = request.headers.get('Authorization')
        
        if not auth_header:
            return APIResponse.unauthorized("Authorization header required")
        
        token = Security.extract_token_from_header(auth_header)
        
        if not token:
            return APIResponse.unauthorized("Invalid authorization format")
        
        payload = Security.verify_jwt_token(token)
        
        if not payload:
            return APIResponse.unauthorized("Invalid or expired token")
        
        user_id = payload.get('user_id')
        
        # Get active sessions
        sessions = LoginSession.get_active_sessions(user_id)
        
        # Format sessions
        formatted_sessions = []
        for session in sessions:
            formatted_sessions.append({
                'session_id': session['session_id'],
                'device': session['device_info'],
                'ip_address': session['ip_address'],
                'login_time': session['created_at'].isoformat() if session['created_at'] else None,
                'expires_at': session['expires_at'].isoformat() if session['expires_at'] else None,
                'is_current': session['jwt_token'] == token
            })
        
        return APIResponse.success(
            {
                'sessions': formatted_sessions,
                'total_active': len(formatted_sessions)
            },
            "Active sessions retrieved"
        )
        
    except Exception as e:
        print(f"❌ Get sessions error: {e}")
        traceback.print_exc()
        return APIResponse.internal_error(ErrorMessages.SERVER_ERROR)


# ============================================
# LOGOUT FROM ALL DEVICES
# ============================================
@auth_bp.route('/logout-all', methods=['POST'])
def logout_all():
    """Logout from all devices (invalidate all sessions)"""
    try:
        auth_header = request.headers.get('Authorization')
        
        if not auth_header:
            return APIResponse.unauthorized("Authorization header required")
        
        token = Security.extract_token_from_header(auth_header)
        
        if not token:
            return APIResponse.unauthorized("Invalid authorization format")
        
        payload = Security.verify_jwt_token(token)
        
        if not payload:
            return APIResponse.unauthorized("Invalid or expired token")
        
        user_id = payload.get('user_id')
        
        # Invalidate all sessions
        count = LoginSession.invalidate_all_sessions(user_id)
        
        print(f"✅ All sessions invalidated for user {user_id}: {count} sessions")
        
        return APIResponse.success(
            {'sessions_invalidated': count},
            f"Logged out from {count} device(s) successfully"
        )
        
    except Exception as e:
        print(f"❌ Logout all error: {e}")
        traceback.print_exc()
        return APIResponse.internal_error(ErrorMessages.SERVER_ERROR)


# ============================================
# PASSWORD RESET - FORGOT PASSWORD
# ============================================
@auth_bp.route('/forgot-password', methods=['POST'])
def forgot_password():
    """Request password reset (Step 1 - Send reset email)"""
    try:
        data = request.get_json()
        
        if not data:
            return APIResponse.bad_request("Request body is required")
        
        email = data.get('email', '').strip().lower()
        
        if not email:
            return APIResponse.bad_request(ErrorMessages.EMAIL_REQUIRED)
        
        # Validate email format
        is_valid, error, normalized_email = Validator.validate_email_address(email)
        if not is_valid:
            return APIResponse.bad_request(error)
        
        print(f"🔐 Password reset request for: {normalized_email}")
        
        # Check if user exists
        user = User.get_user_by_email(normalized_email)
        
        if not user:
            # Security: Don't reveal if email exists
            return APIResponse.success(
                {
                    'email': Security.mask_email(normalized_email),
                    'message': 'If this email exists, a reset link has been sent.'
                },
                "If this email is registered, you will receive a password reset link shortly."
            )
        
        # Check if account is active
        if not user.get('is_active', True):
            return APIResponse.forbidden("Your account has been deactivated. Please contact support.")
        
        # Get request metadata
        ip_address = request.remote_addr or 'Unknown'
        user_agent = request.headers.get('User-Agent', 'Unknown')[:255]
        
        # Create password reset token
        reset_token = User.create_password_reset_token(
            user_id=user['user_id'],
            ip_address=ip_address,
            user_agent=user_agent
        )
        
        if not reset_token:
            return APIResponse.internal_error("Failed to generate reset token. Please try again.")
        
        # Send password reset email
        email_sent = send_password_reset_email(
            to_email=user['email'],
            reset_token=reset_token,
            user_name=user['full_name']
        )
        
        if not email_sent:
            print("⚠️ Warning: Failed to send reset email")
        
        print(f"✅ Password reset email sent to: {user['email']}")
        
        return APIResponse.success(
            {
                'email': Security.mask_email(user['email']),
                'message': 'Password reset email sent',
                'expires_in_hours': 24
            },
            "Password reset link has been sent to your email address."
        )
        
    except Exception as e:
        print(f"❌ Forgot password error: {e}")
        traceback.print_exc()
        return APIResponse.internal_error(ErrorMessages.SERVER_ERROR)


# ============================================
# VERIFY RESET TOKEN
# ============================================
@auth_bp.route('/verify-reset-token', methods=['GET'])
def verify_reset_token():
    """Verify if password reset token is valid"""
    try:
        reset_token = request.args.get('token', '').strip()
        
        if not reset_token:
            return APIResponse.bad_request("Reset token is required")
        
        # Verify token
        token_data = User.verify_reset_token(reset_token)
        
        if not token_data:
            token_info = User.get_reset_token_info(reset_token)
            
            if token_info:
                if token_info['is_used']:
                    return APIResponse.unauthorized("This reset link has already been used.")
                elif token_info['is_expired']:
                    return APIResponse.unauthorized("This reset link has expired.")
            
            return APIResponse.unauthorized("Invalid or expired reset link.")
        
        return APIResponse.success(
            {
                'valid': True,
                'email': Security.mask_email(token_data['email']),
                'expires_at': token_data['expires_at'].isoformat() if token_data.get('expires_at') else None
            },
            "Reset token is valid"
        )
        
    except Exception as e:
        print(f"❌ Verify token error: {e}")
        traceback.print_exc()
        return APIResponse.internal_error(ErrorMessages.SERVER_ERROR)


# ============================================
# RESET PASSWORD
# ============================================
@auth_bp.route('/reset-password', methods=['POST'])
def reset_password():
    """Reset password using reset token"""
    try:
        data = request.get_json()
        
        if not data:
            return APIResponse.bad_request("Request body is required")
        
        reset_token = data.get('token', '').strip()
        new_password = data.get('new_password', '')
        confirm_password = data.get('confirm_password', '')
        
        # Validate inputs
        if not reset_token:
            return APIResponse.bad_request("Reset token is required")
        
        if not new_password:
            return APIResponse.bad_request("New password is required")
        
        if not confirm_password:
            return APIResponse.bad_request("Password confirmation is required")
        
        if new_password != confirm_password:
            return APIResponse.bad_request("Passwords do not match")
        
        # Validate password strength
        is_valid, error = Validator.validate_password(new_password)
        if not is_valid:
            return APIResponse.bad_request(error)
        
        # Reset password
        success, message, user = User.reset_password_with_token(reset_token, new_password)
        
        if not success:
            token_info = User.get_reset_token_info(reset_token)
            
            if token_info:
                if token_info['is_used']:
                    return APIResponse.unauthorized("This reset link has already been used.")
                elif token_info['is_expired']:
                    return APIResponse.unauthorized("This reset link has expired.")
            
            return APIResponse.unauthorized(message)
        
        # Invalidate all sessions for security
        try:
            invalidated = LoginSession.invalidate_all_sessions(user['user_id'])
            print(f"🔒 Invalidated {invalidated} active sessions")
        except Exception as session_error:
            print(f"⚠️ Failed to invalidate sessions: {session_error}")
        
        print(f"✅ Password reset successful for: {user['email']}")
        
        return APIResponse.success(
            {
                'email': Security.mask_email(user['email']),
                'message': 'Password has been reset successfully',
                'next_step': 'login'
            },
            "Your password has been reset successfully! You can now login with your new password."
        )
        
    except Exception as e:
        print(f"❌ Reset password error: {e}")
        traceback.print_exc()
        return APIResponse.internal_error(ErrorMessages.SERVER_ERROR)


# ============================================
# RESEND RESET EMAIL
# ============================================
@auth_bp.route('/resend-reset-email', methods=['POST'])
def resend_reset_email():
    """Resend password reset email"""
    try:
        data = request.get_json()
        
        if not data:
            return APIResponse.bad_request("Request body is required")
        
        email = data.get('email', '').strip().lower()
        
        if not email:
            return APIResponse.bad_request(ErrorMessages.EMAIL_REQUIRED)
        
        # Validate email
        is_valid, error, normalized_email = Validator.validate_email_address(email)
        if not is_valid:
            return APIResponse.bad_request(error)
        
        print(f"🔄 Resend reset email request for: {normalized_email}")
        
        # Check if user exists
        user = User.get_user_by_email(normalized_email)
        
        if not user:
            # Security: Don't reveal if email exists
            return APIResponse.success(
                {
                    'email': Security.mask_email(normalized_email),
                    'message': 'If this email exists, a reset link has been sent.'
                },
                "If this email is registered, you will receive a password reset link shortly."
            )
        
        # Get request metadata
        ip_address = request.remote_addr or 'Unknown'
        user_agent = request.headers.get('User-Agent', 'Unknown')[:255]
        
        # Create new reset token
        reset_token = User.create_password_reset_token(
            user_id=user['user_id'],
            ip_address=ip_address,
            user_agent=user_agent
        )
        
        if not reset_token:
            return APIResponse.internal_error("Failed to generate reset token")
        
        # Send email
        email_sent = send_password_reset_email(
            to_email=user['email'],
            reset_token=reset_token,
            user_name=user['full_name']
        )
        
        if not email_sent:
            print("⚠️ Warning: Failed to send reset email")
        
        print(f"✅ Reset email resent to: {user['email']}")
        
        return APIResponse.success(
            {
                'email': Security.mask_email(user['email']),
                'message': 'Reset email sent'
            },
            "Password reset link has been sent to your email address."
        )
        
    except Exception as e:
        print(f"❌ Resend reset email error: {e}")
        traceback.print_exc()
        return APIResponse.internal_error(ErrorMessages.SERVER_ERROR)


# ============================================
# CLEANUP EXPIRED REGISTRATIONS
# ============================================
def cleanup_expired_registrations():
    """Remove expired pending registrations from memory"""
    from datetime import datetime
    
    expired_keys = []
    for temp_user_id, data in pending_registrations.items():
        otp_expires_at = datetime.fromisoformat(data['otp_expires_at'])
        if datetime.utcnow() > otp_expires_at:
            expired_keys.append(temp_user_id)
    
    for key in expired_keys:
        del pending_registrations[key]
        print(f"🧹 Cleaned up expired registration: {key}")
    
    return len(expired_keys)


# ============================================
# DEBUG ENDPOINT - REMOVE IN PRODUCTION
# ============================================
@auth_bp.route('/debug/pending', methods=['GET'])
def debug_pending():
    """Debug endpoint to view pending registrations"""
    pending_list = []
    for temp_id, data in pending_registrations.items():
        pending_list.append({
            'temp_user_id': temp_id,
            'email': data['user_data']['email'],
            'otp_code': data['otp_code'],
            'expires_at': data['otp_expires_at']
        })
    
    return APIResponse.success({
        'count': len(pending_registrations),
        'pending': pending_list
    }, "Pending registrations")


# ============================================
# HEALTH CHECK
# ============================================
@auth_bp.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    cleaned = cleanup_expired_registrations()
    
    return APIResponse.success(
        {
            'status': 'healthy',
            'service': 'auth',
            'pending_registrations': len(pending_registrations),
            'cleaned_expired': cleaned
        },
        "Authentication service is running"
    )


# ============================================
# TEST ROUTE
# ============================================
@auth_bp.route('/test', methods=['GET'])
def test():
    """Test endpoint"""
    return APIResponse.success(
        {
            'message': 'Auth routes are working!',
            'available_endpoints': [
                'POST /api/auth/register',
                'POST /api/auth/login',
                'POST /api/auth/logout',
                'POST /api/auth/verify-otp',
                'POST /api/auth/resend-otp',
                'POST /api/auth/validate-token (CRITICAL)',
                'POST /api/auth/check-email',
                'POST /api/auth/check-phone',
                'POST /api/auth/forgot-password',
                'GET /api/auth/verify-reset-token',
                'POST /api/auth/reset-password',
                'POST /api/auth/resend-reset-email',
                'GET /api/auth/sessions',
                'POST /api/auth/logout-all',
                'GET /api/auth/health'
            ]
        },
        "Test successful"
    )