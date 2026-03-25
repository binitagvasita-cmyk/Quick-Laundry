"""
============================================
GOOGLE OAUTH HELPER MODULE
Handles Google OAuth 2.0 authentication flow
============================================
"""

import requests
from urllib.parse import urlencode
from config import get_config

config = get_config()


class GoogleOAuth:
    """Google OAuth 2.0 authentication utilities"""
    
    # Google OAuth endpoints
    AUTHORIZATION_URL = "https://accounts.google.com/o/oauth2/v2/auth"
    TOKEN_URL = "https://oauth2.googleapis.com/token"
    USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo"
    
    @staticmethod
    def get_authorization_url(state):
        """
        Generate Google OAuth authorization URL
        
        Args:
            state (str): Random state parameter for CSRF protection
            
        Returns:
            str: Authorization URL to redirect user to
        """
        params = {
            'client_id': config.GOOGLE_CLIENT_ID,
            'redirect_uri': config.GOOGLE_REDIRECT_URI,
            'response_type': 'code',
            'scope': 'openid email profile',
            'state': state,
            'access_type': 'offline',
            'prompt': 'consent'
        }
        
        url = f"{GoogleOAuth.AUTHORIZATION_URL}?{urlencode(params)}"
        print(f"🔗 Generated Google OAuth URL")
        return url
    
    @staticmethod
    def exchange_code_for_token(code):
        """
        Exchange authorization code for access token
        
        Args:
            code (str): Authorization code from Google
            
        Returns:
            dict: Token response or None if failed
        """
        try:
            data = {
                'code': code,
                'client_id': config.GOOGLE_CLIENT_ID,
                'client_secret': config.GOOGLE_CLIENT_SECRET,
                'redirect_uri': config.GOOGLE_REDIRECT_URI,
                'grant_type': 'authorization_code'
            }
            
            print("🔄 Exchanging authorization code for token...")
            
            response = requests.post(GoogleOAuth.TOKEN_URL, data=data, timeout=10)
            
            if response.status_code == 200:
                token_data = response.json()
                print("✅ Token exchange successful")
                return token_data
            else:
                print(f"❌ Token exchange failed: {response.status_code}")
                print(f"   Response: {response.text}")
                return None
                
        except requests.exceptions.RequestException as e:
            print(f"❌ Token exchange error: {e}")
            return None
        except Exception as e:
            print(f"❌ Unexpected error in token exchange: {e}")
            return None
    
    @staticmethod
    def get_user_info(access_token):
        """
        Get user information from Google
        
        Args:
            access_token (str): Google access token
            
        Returns:
            dict: User info or None if failed
        """
        try:
            headers = {
                'Authorization': f'Bearer {access_token}'
            }
            
            print("👤 Fetching user info from Google...")
            
            response = requests.get(
                GoogleOAuth.USERINFO_URL,
                headers=headers,
                timeout=10
            )
            
            if response.status_code == 200:
                user_info = response.json()
                print(f"✅ User info retrieved: {user_info.get('email')}")
                return user_info
            else:
                print(f"❌ Failed to get user info: {response.status_code}")
                return None
                
        except requests.exceptions.RequestException as e:
            print(f"❌ User info request error: {e}")
            return None
        except Exception as e:
            print(f"❌ Unexpected error getting user info: {e}")
            return None
    
    @staticmethod
    def verify_state(received_state, stored_state):
        """
        Verify state parameter for CSRF protection
        
        Args:
            received_state (str): State received from Google
            stored_state (str): State stored in session
            
        Returns:
            bool: True if states match
        """
        if not received_state or not stored_state:
            print("❌ State verification failed: Missing state")
            return False
        
        if received_state != stored_state:
            print("❌ State verification failed: State mismatch")
            return False
        
        print("✅ State verified successfully")
        return True
    
    @staticmethod
    def normalize_google_user_data(google_user):
        """
        Normalize Google user data to match our User model
        
        Args:
            google_user (dict): User data from Google
            
        Returns:
            dict: Normalized user data
        """
        return {
            'email': google_user.get('email', '').strip().lower(),
            'full_name': google_user.get('name', ''),
            'google_id': google_user.get('id', ''),
            'picture': google_user.get('picture', ''),
            'email_verified': google_user.get('verified_email', False),
            'given_name': google_user.get('given_name', ''),
            'family_name': google_user.get('family_name', '')
        }
    
    @staticmethod
    def validate_google_config():
        """
        Validate that Google OAuth is properly configured
        
        Returns:
            tuple: (is_valid, error_message)
        """
        if not config.GOOGLE_CLIENT_ID:
            return False, "GOOGLE_CLIENT_ID is not configured"
        
        if not config.GOOGLE_CLIENT_SECRET:
            return False, "GOOGLE_CLIENT_SECRET is not configured"
        
        if not config.GOOGLE_REDIRECT_URI:
            return False, "GOOGLE_REDIRECT_URI is not configured"
        
        return True, None


# ============================================
# HELPER FUNCTIONS
# ============================================

def generate_state_token():
    """Generate random state token for CSRF protection"""
    import secrets
    return secrets.token_urlsafe(32)


def is_valid_email(email):
    """Quick email validation"""
    import re
    pattern = r'^[^\s@]+@[^\s@]+\.[^\s@]+$'
    return bool(re.match(pattern, email))


# ============================================
# TEST GOOGLE AUTH MODULE
# ============================================

if __name__ == "__main__":
    print("=" * 50)
    print("GOOGLE OAUTH MODULE TEST")
    print("=" * 50)
    
    # Test configuration validation
    print("\n🔧 Testing configuration validation:")
    is_valid, error = GoogleOAuth.validate_google_config()
    if is_valid:
        print("✅ Google OAuth configuration is valid")
    else:
        print(f"❌ Configuration error: {error}")
    
    # Test state token generation
    print("\n🔑 Testing state token generation:")
    state = generate_state_token()
    print(f"Generated state token: {state[:20]}...")
    
    # Test authorization URL generation
    if is_valid:
        print("\n🔗 Testing authorization URL generation:")
        auth_url = GoogleOAuth.get_authorization_url(state)
        print(f"Authorization URL: {auth_url[:100]}...")
    
    # Test user data normalization
    print("\n👤 Testing user data normalization:")
    mock_google_user = {
        'id': '123456789',
        'email': 'test@gmail.com',
        'name': 'Test User',
        'picture': 'https://example.com/photo.jpg',
        'verified_email': True
    }
    normalized = GoogleOAuth.normalize_google_user_data(mock_google_user)
    print(f"Normalized user: {normalized}")
    
    print("\n" + "=" * 50)
    print("✅ Google OAuth module test completed!")