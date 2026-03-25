"""
============================================
SECURITY MODULE - FIXED
OTP Manager with proper UTC timezone handling
============================================
"""

import secrets
import string
from datetime import datetime, timedelta
from config import get_config

try:
    import jwt
except ImportError:
    print("❌ PyJWT not installed. Run: pip install PyJWT")
    raise

config = get_config()


class Security:
    """Security utilities for authentication"""
    
    @staticmethod
    def generate_jwt_token(user_id, email):
        """Generate JWT access token"""
        try:
            payload = {
                'user_id': user_id,
                'email': email,
                'iat': datetime.utcnow(),
                'exp': datetime.utcnow() + config.JWT_ACCESS_TOKEN_EXPIRES
            }
            
            token = jwt.encode(
                payload,
                config.JWT_SECRET_KEY,
                algorithm=config.JWT_ALGORITHM
            )
            
            if isinstance(token, bytes):
                token = token.decode('utf-8')
            
            print(f"✅ JWT token generated for user {user_id}")
            return token
            
        except Exception as e:
            print(f"❌ JWT generation error: {e}")
            import traceback
            traceback.print_exc()
            return None
    
    @staticmethod
    def verify_jwt_token(token):
        """Verify and decode JWT token"""
        try:
            payload = jwt.decode(
                token,
                config.JWT_SECRET_KEY,
                algorithms=[config.JWT_ALGORITHM]
            )
            return payload
            
        except jwt.ExpiredSignatureError:
            print("❌ Token has expired")
            return None
        except jwt.InvalidTokenError as e:
            print(f"❌ Invalid token: {e}")
            return None
    
    @staticmethod
    def generate_otp(length=None):
        """Generate random OTP code"""
        if length is None:
            length = config.OTP_LENGTH
        
        otp = ''.join(secrets.choice(string.digits) for _ in range(length))
        return otp
    
    @staticmethod
    def generate_reset_token(length=32):
        """Generate secure random token for password reset"""
        return secrets.token_urlsafe(length)
    
    @staticmethod
    def get_otp_expiry_time():
        """Get OTP expiry timestamp (UTC)"""
        return datetime.utcnow() + timedelta(minutes=config.OTP_EXPIRY_MINUTES)
    
    @staticmethod
    def get_reset_token_expiry_time():
        """Get password reset token expiry timestamp (24 hours)"""
        return datetime.utcnow() + timedelta(hours=24)
    
    @staticmethod
    def is_token_expired(expiry_time):
        """Check if token/OTP has expired"""
        return datetime.utcnow() > expiry_time
    
    @staticmethod
    def extract_token_from_header(auth_header):
        """Extract JWT token from Authorization header"""
        if not auth_header:
            return None
        
        parts = auth_header.split()
        
        if len(parts) != 2 or parts[0].lower() != 'bearer':
            return None
        
        return parts[1]
    
    @staticmethod
    def generate_session_id():
        """Generate unique session ID"""
        return secrets.token_hex(16)
    
    @staticmethod
    def hash_token(token):
        """Hash token for storage"""
        import hashlib
        return hashlib.sha256(token.encode()).hexdigest()
    
    @staticmethod
    def generate_api_key(length=32):
        """Generate API key"""
        return secrets.token_urlsafe(length)
    
    @staticmethod
    def create_auth_response(user, token):
        """Create standardized authentication response"""
        return {
            'token': token,
            'token_type': 'Bearer',
            'expires_in': int(config.JWT_ACCESS_TOKEN_EXPIRES.total_seconds()),
            'user': {
                'user_id': user['user_id'],
                'full_name': user['full_name'],
                'email': user['email'],
                'phone': user['phone'],
                'is_verified': user.get('is_verified', False),
                'email_verified': user.get('email_verified', False),
                'phone_verified': user.get('phone_verified', False)
            }
        }
    
    @staticmethod
    def validate_token_payload(payload):
        """Validate JWT token payload structure"""
        required_fields = ['user_id', 'email', 'exp']
        
        for field in required_fields:
            if field not in payload:
                return False
        
        return True
    
    @staticmethod
    def mask_email(email):
        """Mask email for privacy"""
        if not email or '@' not in email:
            return email
        
        local, domain = email.split('@')
        
        if len(local) <= 2:
            masked_local = local[0] + '*'
        else:
            masked_local = local[:2] + '*' * (len(local) - 2)
        
        return f"{masked_local}@{domain}"
    
    @staticmethod
    def mask_phone(phone):
        """Mask phone number for privacy"""
        if not phone or len(phone) < 4:
            return phone
        
        return '*' * (len(phone) - 4) + phone[-4:]
    
    @staticmethod
    def generate_verification_code():
        """Generate email verification code"""
        return ''.join(secrets.choice(string.ascii_uppercase + string.digits) 
                      for _ in range(8))
    
    @staticmethod
    def sanitize_user_agent(user_agent):
        """Sanitize and truncate user agent string"""
        if not user_agent:
            return "Unknown"
        
        max_length = 255
        if len(user_agent) > max_length:
            user_agent = user_agent[:max_length]
        
        return user_agent.strip()
    
    @staticmethod
    def get_token_info(token):
        """Get token information without verifying"""
        try:
            payload = jwt.decode(
                token,
                options={"verify_signature": False}
            )
            
            return {
                'user_id': payload.get('user_id'),
                'email': payload.get('email'),
                'issued_at': payload.get('iat'),
                'expires_at': payload.get('exp'),
                'is_expired': datetime.utcnow().timestamp() > payload.get('exp', 0)
            }
            
        except Exception as e:
            print(f"❌ Token info error: {e}")
            return None


# ============================================
# OTP MANAGER - FIXED WITH UTC TIMESTAMP
# ============================================

class OTPManager:
    """Manage OTP verification codes with proper timezone handling"""
    
    @staticmethod
    def store_otp(db, user_id, otp_code, otp_type='registration'):
        """
        Store OTP in database
        
        🔥 CRITICAL FIX: Uses UTC_TIMESTAMP() instead of NOW()
        """
        try:
            # Mark all previous OTPs as used
            expire_query = """
                UPDATE otp_verifications 
                SET is_used = TRUE 
                WHERE user_id = %s AND otp_type = %s AND is_used = FALSE
            """
            db.execute_update(expire_query, (user_id, otp_type))
            
            # Insert new OTP with UTC expiry
            query = """
                INSERT INTO otp_verifications (user_id, otp_code, otp_type, expires_at)
                VALUES (%s, %s, %s, %s)
            """
            
            expiry_time = Security.get_otp_expiry_time()
            
            result = db.execute_update(
                query,
                (user_id, otp_code, otp_type, expiry_time)
            )
            
            if result:
                print(f"✅ OTP stored for user {user_id}: {otp_code}")
                print(f"   Expires at (UTC): {expiry_time}")
            
            return result is not None
            
        except Exception as e:
            print(f"❌ Store OTP error: {e}")
            import traceback
            traceback.print_exc()
            return False
    
    @staticmethod
    def verify_otp(db, user_id, otp_code, otp_type='registration'):
        """
        Verify OTP code
        
        🔥 CRITICAL FIX: Uses UTC_TIMESTAMP() for timezone consistency
        """
        try:
            print(f"🔍 Verifying OTP for user {user_id}: {otp_code} (type: {otp_type})")
            
            # 🔥 THE FIX: Use UTC_TIMESTAMP() instead of NOW()
            query = """
                SELECT *, 
                       TIMESTAMPDIFF(MINUTE, UTC_TIMESTAMP(), expires_at) as minutes_remaining,
                       UTC_TIMESTAMP() as current_utc_time
                FROM otp_verifications
                WHERE user_id = %s 
                AND otp_code = %s 
                AND otp_type = %s
                AND is_used = FALSE
                ORDER BY created_at DESC
                LIMIT 1
            """
            
            result = db.fetch_one(query, (user_id, otp_code, otp_type))
            
            print(f"🔍 OTP query result: {result}")
            
            if result:
                minutes_remaining = result.get('minutes_remaining', 0)
                print(f"⏱️ Minutes remaining: {minutes_remaining}")
                print(f"🕐 Current UTC time: {result.get('current_utc_time')}")
                print(f"⏰ OTP expires at: {result.get('expires_at')}")
                
                # Check if expired
                if minutes_remaining < 0:
                    print(f"❌ OTP has expired ({abs(minutes_remaining)} minutes ago)")
                    return False
                
                # Mark OTP as used
                update_query = """
                    UPDATE otp_verifications
                    SET is_used = TRUE
                    WHERE otp_id = %s
                """
                db.execute_update(update_query, (result['otp_id'],))
                
                print(f"✅ OTP verified successfully for user {user_id}")
                return True
            else:
                print(f"❌ OTP verification failed - no matching OTP found")
                
                # Debug: Show recent OTPs
                debug_query = """
                    SELECT otp_code, is_used, 
                           expires_at, created_at,
                           TIMESTAMPDIFF(MINUTE, UTC_TIMESTAMP(), expires_at) as minutes_remaining,
                           UTC_TIMESTAMP() as current_utc
                    FROM otp_verifications
                    WHERE user_id = %s AND otp_type = %s
                    ORDER BY created_at DESC
                    LIMIT 5
                """
                debug_results = db.execute_query(debug_query, (user_id, otp_type))
                print(f"🔍 Recent OTPs for debugging:")
                for otp in debug_results:
                    print(f"   - Code: {otp['otp_code']}, Used: {otp['is_used']}, "
                          f"Minutes left: {otp.get('minutes_remaining', 'N/A')}")
                
                return False
            
        except Exception as e:
            print(f"❌ Verify OTP error: {e}")
            import traceback
            traceback.print_exc()
            return False


# ============================================
# TEST SECURITY MODULE
# ============================================

if __name__ == "__main__":
    print("=" * 50)
    print("SECURITY MODULE TEST")
    print("=" * 50)
    
    # Test JWT token generation
    print("\n🔑 Testing JWT token generation:")
    token = Security.generate_jwt_token(1, "test@example.com")
    if token:
        print(f"Generated token: {token[:50]}...")
    else:
        print("❌ Token generation failed")
    
    # Test token verification
    if token:
        print("\n✅ Testing token verification:")
        payload = Security.verify_jwt_token(token)
        print(f"Decoded payload: {payload}")
    
    # Test OTP generation
    print("\n📱 Testing OTP generation:")
    otp = Security.generate_otp()
    print(f"Generated OTP: {otp}")
    
    # Test reset token
    print("\n🔑 Testing reset token:")
    reset_token = Security.generate_reset_token()
    print(f"Reset token: {reset_token}")
    
    # Test email masking
    print("\n👁️ Testing email masking:")
    masked = Security.mask_email("john.doe@example.com")
    print(f"Masked email: {masked}")
    
    # Test phone masking
    print("\n📞 Testing phone masking:")
    masked_phone = Security.mask_phone("9876543210")
    print(f"Masked phone: {masked_phone}")
    
    print("\n" + "=" * 50)
    print("✅ Security module tests completed!")