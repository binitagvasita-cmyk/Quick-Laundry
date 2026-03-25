"""
============================================
GOOGLE AUTHENTICATION ROUTES
Handles Google OAuth 2.0 login flow
============================================
"""

from flask import Blueprint, request, redirect, session, url_for
from models.user import User
from utils.google_auth import GoogleOAuth, generate_state_token
from utils.security import Security
from utils.response import APIResponse, ErrorMessages, SuccessMessages
from models.session import LoginSession, LoginActivity
from config import get_config
import traceback

google_auth_bp = Blueprint('google_auth', __name__, url_prefix='/api/auth/google')

config = get_config()


# ============================================
# GOOGLE LOGIN INITIATION
# ============================================

@google_auth_bp.route('/login', methods=['GET'])
def google_login():
    """
    Initiate Google OAuth login
    Redirects user to Google consent screen
    
    Returns:
        Redirect to Google authorization URL
    """
    try:
        print("🔵 Google login initiated")
        
        # Validate Google OAuth configuration
        is_valid, error = GoogleOAuth.validate_google_config()
        if not is_valid:
            print(f"❌ Google OAuth not configured: {error}")
            return APIResponse.internal_error(
                "Google login is not available at this time. Please use email/password login."
            )
        
        # Generate state token for CSRF protection
        state = generate_state_token()
        session['google_oauth_state'] = state
        
        # Store return URL if provided
        return_url = request.args.get('return_url', '/home.html')
        session['google_return_url'] = return_url
        
        print(f"🔑 Generated state token: {state[:20]}...")
        print(f"🔙 Return URL: {return_url}")
        
        # Generate authorization URL
        auth_url = GoogleOAuth.get_authorization_url(state)
        
        print(f"🔗 Redirecting to Google: {auth_url[:100]}...")
        
        # Redirect to Google
        return redirect(auth_url)
        
    except Exception as e:
        print(f"❌ Google login initiation error: {e}")
        traceback.print_exc()
        return APIResponse.internal_error("Failed to initiate Google login")


# ============================================
# GOOGLE OAUTH CALLBACK
# ============================================

@google_auth_bp.route('/callback', methods=['GET'])
def google_callback():
    """
    Handle Google OAuth callback
    Exchanges code for token, gets user info, creates/logs in user
    
    Query params:
        code: Authorization code from Google
        state: State parameter for CSRF protection
        error: Error from Google (if any)
    
    Returns:
        Redirect to frontend with status
    """
    try:
        print("🔄 Google OAuth callback received")
        
        # Get return URL from session
        return_url = session.get('google_return_url', '/home.html')
        frontend_base = config.FRONTEND_URL or 'http://localhost:5500'
        
        # Check for errors from Google
        error = request.args.get('error')
        if error:
            print(f"❌ Google OAuth error: {error}")
            error_url = f"{frontend_base}/login.html?error=google_auth_failed&reason={error}"
            return redirect(error_url)
        
        # Get authorization code
        code = request.args.get('code')
        if not code:
            print("❌ Missing authorization code")
            error_url = f"{frontend_base}/login.html?error=missing_code"
            return redirect(error_url)
        
        # Verify state (CSRF protection)
        received_state = request.args.get('state')
        stored_state = session.get('google_oauth_state')
        
        if not GoogleOAuth.verify_state(received_state, stored_state):
            print("❌ State verification failed - possible CSRF attack")
            error_url = f"{frontend_base}/login.html?error=invalid_state"
            return redirect(error_url)
        
        # Exchange code for token
        token_data = GoogleOAuth.exchange_code_for_token(code)
        if not token_data:
            print("❌ Failed to exchange code for token")
            error_url = f"{frontend_base}/login.html?error=token_exchange_failed"
            return redirect(error_url)
        
        access_token = token_data.get('access_token')
        if not access_token:
            print("❌ No access token in response")
            error_url = f"{frontend_base}/login.html?error=no_access_token"
            return redirect(error_url)
        
        # Get user info from Google
        google_user = GoogleOAuth.get_user_info(access_token)
        if not google_user:
            print("❌ Failed to get user info from Google")
            error_url = f"{frontend_base}/login.html?error=user_info_failed"
            return redirect(error_url)
        
        # Normalize user data
        normalized_user = GoogleOAuth.normalize_google_user_data(google_user)
        email = normalized_user['email']
        google_id = normalized_user['google_id']
        
        print(f"✅ Google user retrieved: {email}")
        print(f"   Google ID: {google_id}")
        print(f"   Name: {normalized_user['full_name']}")
        
        # Check if user exists
        existing_user = User.get_user_by_email(email)
        
        if existing_user:
            # USER EXISTS - UPDATE AND LOGIN
            print(f"👤 Existing user found: {existing_user['user_id']}")
            
            # Update Google ID if not set
            if not existing_user.get('google_id'):
                User.update_google_id(existing_user['user_id'], google_id)
                print(f"🔗 Linked Google account to user {existing_user['user_id']}")
            
            # Update profile picture if available
            if normalized_user.get('picture'):
                User.update_profile_picture(existing_user['user_id'], normalized_user['picture'])
            
            user = existing_user
            
        else:
            # NEW USER - CREATE ACCOUNT
            print(f"➕ Creating new user from Google account")
            
            user_data = {
                'full_name': normalized_user['full_name'],
                'email': email,
                'phone': '',  # Optional - Google doesn't provide phone
                'password': Security.generate_reset_token(16),  # Random password
                'address': '',
                'city': '',
                'pincode': '',
                'google_id': google_id,
                'profile_picture': normalized_user.get('picture', ''),
                'comm_email': True,
                'comm_whatsapp': False,
                'comm_phone': False
            }
            
            # Create user
            user = User.create_user_from_google(user_data)
            
            if not user:
                print("❌ Failed to create user")
                error_url = f"{frontend_base}/login.html?error=user_creation_failed"
                return redirect(error_url)
            
            # Mark email as verified (trust Google's verification)
            User.mark_email_verified(user['user_id'])
            
            print(f"✅ New user created: {user['user_id']}")
        
        # Generate JWT token
        token = Security.generate_jwt_token(user['user_id'], user['email'])
        
        if not token:
            print("❌ Failed to generate JWT token")
            error_url = f"{frontend_base}/login.html?error=token_generation_failed"
            return redirect(error_url)
        
        # Create login session
        device_info = request.headers.get('User-Agent', 'Unknown Device')
        ip_address = request.remote_addr or 'Unknown IP'
        
        try:
            session_id = LoginSession.create_session(
                user_id=user['user_id'],
                jwt_token=token,
                device_info=device_info[:255],
                ip_address=ip_address[:45]
            )
            print(f"✅ Login session created: {session_id}")
        except Exception as session_error:
            print(f"⚠️ Session creation error: {session_error}")
        
        # Log successful login
        LoginActivity.log_success(user['user_id'], ip_address, "Google OAuth")
        
        # Clear OAuth session data
        session.pop('google_oauth_state', None)
        session.pop('google_return_url', None)
        
        # Redirect to frontend with token
        success_url = (
            f"{frontend_base}{return_url}"
            f"?token={token}"
            f"&user_name={user['full_name']}"
            f"&user_email={user['email']}"
            f"&google_login=true"
        )
        
        print(f"✅ Google login successful for {email}")
        print(f"🔙 Redirecting to: {success_url[:100]}...")
        
        return redirect(success_url)
        
    except Exception as e:
        print(f"❌ Google callback error: {e}")
        traceback.print_exc()
        
        frontend_base = config.FRONTEND_URL or 'http://localhost:5500'
        error_url = f"{frontend_base}/login.html?error=callback_exception"
        return redirect(error_url)


# ============================================
# LINK GOOGLE ACCOUNT (FOR EXISTING USERS)
# ============================================

@google_auth_bp.route('/link', methods=['POST'])
def link_google_account():
    """
    Link Google account to existing user
    Requires authentication
    
    Headers:
        Authorization: Bearer <token>
    
    Body:
        google_token: Google access token
    
    Returns:
        200: Account linked successfully
        401: Unauthorized
        409: Google account already linked to another user
        500: Server error
    """
    try:
        # Get JWT token
        auth_header = request.headers.get('Authorization')
        if not auth_header:
            return APIResponse.unauthorized("Authorization header required")
        
        token = Security.extract_token_from_header(auth_header)
        if not token:
            return APIResponse.unauthorized("Invalid authorization format")
        
        # Verify JWT token
        payload = Security.verify_jwt_token(token)
        if not payload:
            return APIResponse.unauthorized("Invalid or expired token")
        
        user_id = payload.get('user_id')
        
        # Get request data
        data = request.get_json()
        if not data:
            return APIResponse.bad_request("Request body required")
        
        google_token = data.get('google_token')
        if not google_token:
            return APIResponse.bad_request("google_token required")
        
        # Get user info from Google
        google_user = GoogleOAuth.get_user_info(google_token)
        if not google_user:
            return APIResponse.bad_request("Invalid Google token")
        
        normalized_user = GoogleOAuth.normalize_google_user_data(google_user)
        google_id = normalized_user['google_id']
        
        # Check if Google account is already linked to another user
        existing = User.get_user_by_google_id(google_id)
        if existing and existing['user_id'] != user_id:
            return APIResponse.conflict(
                "This Google account is already linked to another user"
            )
        
        # Link Google account
        success = User.update_google_id(user_id, google_id)
        
        if not success:
            return APIResponse.internal_error("Failed to link Google account")
        
        # Update profile picture if available
        if normalized_user.get('picture'):
            User.update_profile_picture(user_id, normalized_user['picture'])
        
        print(f"✅ Google account linked to user {user_id}")
        
        return APIResponse.success(
            {
                'google_id': google_id,
                'email': normalized_user['email'],
                'linked': True
            },
            "Google account linked successfully"
        )
        
    except Exception as e:
        print(f"❌ Link Google account error: {e}")
        traceback.print_exc()
        return APIResponse.internal_error(ErrorMessages.SERVER_ERROR)


# ============================================
# UNLINK GOOGLE ACCOUNT
# ============================================

@google_auth_bp.route('/unlink', methods=['POST'])
def unlink_google_account():
    """
    Unlink Google account from user
    Requires authentication
    
    Headers:
        Authorization: Bearer <token>
    
    Returns:
        200: Account unlinked successfully
        401: Unauthorized
        500: Server error
    """
    try:
        # Get JWT token
        auth_header = request.headers.get('Authorization')
        if not auth_header:
            return APIResponse.unauthorized("Authorization header required")
        
        token = Security.extract_token_from_header(auth_header)
        if not token:
            return APIResponse.unauthorized("Invalid authorization format")
        
        # Verify JWT token
        payload = Security.verify_jwt_token(token)
        if not payload:
            return APIResponse.unauthorized("Invalid or expired token")
        
        user_id = payload.get('user_id')
        
        # Unlink Google account
        success = User.unlink_google_account(user_id)
        
        if not success:
            return APIResponse.internal_error("Failed to unlink Google account")
        
        print(f"✅ Google account unlinked from user {user_id}")
        
        return APIResponse.success(
            {'linked': False},
            "Google account unlinked successfully"
        )
        
    except Exception as e:
        print(f"❌ Unlink Google account error: {e}")
        traceback.print_exc()
        return APIResponse.internal_error(ErrorMessages.SERVER_ERROR)


# ============================================
# CHECK GOOGLE AUTH STATUS
# ============================================

@google_auth_bp.route('/status', methods=['GET'])
def google_auth_status():
    """
    Check if Google OAuth is configured and available
    
    Returns:
        200: Status information
    """
    is_valid, error = GoogleOAuth.validate_google_config()
    
    return APIResponse.success(
        {
            'available': is_valid,
            'configured': is_valid,
            'error': error if not is_valid else None
        },
        "Google OAuth status"
    )


# ============================================
# TEST ENDPOINT
# ============================================

@google_auth_bp.route('/test', methods=['GET'])
def test():
    """Test endpoint"""
    return APIResponse.success(
        {
            'message': 'Google auth routes are working!',
            'available_endpoints': [
                'GET /api/auth/google/login',
                'GET /api/auth/google/callback',
                'POST /api/auth/google/link',
                'POST /api/auth/google/unlink',
                'GET /api/auth/google/status'
            ]
        },
        "Test successful"
    )