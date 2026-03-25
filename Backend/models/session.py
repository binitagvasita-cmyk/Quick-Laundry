"""
============================================
LOGIN SESSION MODEL - FIXED
Handles user login sessions and tracking
============================================
"""

from datetime import datetime, timedelta
from database.db import db
import jwt
import os
from dotenv import load_dotenv

load_dotenv()

class LoginSession:
    """Login session tracking model"""
    
    @staticmethod
    def create_session(user_id, jwt_token, device_info=None, ip_address=None):
        """
        Create a new login session
        
        Args:
            user_id (int): User ID
            jwt_token (str): JWT token
            device_info (str): Device information
            ip_address (str): IP address
            
        Returns:
            int: Session ID or None
        """
        try:
            # Get JWT secret from environment
            JWT_SECRET = os.getenv('JWT_SECRET_KEY', 'your-secret-key-change-this')
            
            # Decode JWT to get expiry
            payload = jwt.decode(
                jwt_token,
                JWT_SECRET,
                algorithms=["HS256"]
            )

            expires_at = datetime.utcfromtimestamp(payload["exp"])

            query = """
                INSERT INTO user_sessions (
                    user_id, jwt_token, device_info, ip_address, expires_at
                ) VALUES (%s, %s, %s, %s, %s)
            """

            result = db.execute_update(
                query,
                (user_id, jwt_token, device_info, ip_address, expires_at)
            )
            
            if result:
                print(f"✅ Session created for user {user_id}")
                print(f"   Expires at: {expires_at}")
            
            return result

        except jwt.ExpiredSignatureError:
            print("❌ Cannot create session: JWT token already expired")
            return None
        except jwt.InvalidTokenError as e:
            print(f"❌ Cannot create session: Invalid JWT token - {e}")
            return None
        except Exception as e:
            print(f"❌ Create session error: {e}")
            import traceback
            traceback.print_exc()
            return None

    
    @staticmethod
    def get_active_sessions(user_id):
        """
        Get all active sessions for a user
        
        Args:
            user_id (int): User ID
            
        Returns:
            list: Active sessions
        """
        query = """
            SELECT * FROM user_sessions
            WHERE user_id = %s 
            AND is_active = TRUE
            AND expires_at > UTC_TIMESTAMP()
            ORDER BY created_at DESC
        """
        
        result = db.execute_query(query, (user_id,))
        return result if result else []
    
    @staticmethod
    def get_session_by_token(jwt_token):
        """
        Get session by JWT token
        
        Args:
            jwt_token (str): JWT token
            
        Returns:
            dict: Session data or None
        """
        query = """
            SELECT * FROM user_sessions
            WHERE jwt_token = %s
            AND is_active = TRUE
            AND expires_at > UTC_TIMESTAMP()
        """
        
        return db.fetch_one(query, (jwt_token,))
    
    @staticmethod
    def invalidate_session(session_id):
        """
        Invalidate/logout a specific session
        
        Args:
            session_id (int): Session ID
            
        Returns:
            bool: Success status
        """
        query = """
            UPDATE user_sessions
            SET is_active = FALSE
            WHERE session_id = %s
        """
        
        result = db.execute_update(query, (session_id,))
        
        if result:
            print(f"✅ Session invalidated: {session_id}")
        
        return result is not None
    
    @staticmethod
    def invalidate_all_sessions(user_id):
        """
        Invalidate all sessions for a user (logout from all devices)
        
        Args:
            user_id (int): User ID
            
        Returns:
            int: Number of sessions invalidated
        """
        query = """
            UPDATE user_sessions
            SET is_active = FALSE
            WHERE user_id = %s
            AND is_active = TRUE
        """
        
        result = db.execute_update(query, (user_id,))
        
        if result:
            print(f"✅ All sessions invalidated for user: {user_id} ({result} sessions)")
        
        return result if result else 0
    
    @staticmethod
    def invalidate_session_by_token(jwt_token):
        """
        Invalidate session by JWT token (for logout)
        
        Args:
            jwt_token (str): JWT token
            
        Returns:
            bool: Success status
        """
        query = """
            UPDATE user_sessions
            SET is_active = FALSE
            WHERE jwt_token = %s
        """
        
        result = db.execute_update(query, (jwt_token,))
        
        if result:
            print(f"✅ Session invalidated by token")
        
        return result is not None
    
    @staticmethod
    def cleanup_expired_sessions():
        """
        Remove expired sessions from database
        
        Returns:
            int: Number of sessions cleaned
        """
        query = """
            DELETE FROM user_sessions
            WHERE expires_at < UTC_TIMESTAMP()
            OR (is_active = FALSE AND created_at < DATE_SUB(UTC_TIMESTAMP(), INTERVAL 30 DAY))
        """
        
        result = db.execute_update(query)
        
        if result and result > 0:
            print(f"🧹 Cleaned {result} expired sessions")
        
        return result if result else 0
    
    @staticmethod
    def get_session_count(user_id):
        """
        Get total active session count for user
        
        Args:
            user_id (int): User ID
            
        Returns:
            int: Active session count
        """
        query = """
            SELECT COUNT(*) as count
            FROM user_sessions
            WHERE user_id = %s
            AND is_active = TRUE
            AND expires_at > UTC_TIMESTAMP()
        """
        
        result = db.fetch_one(query, (user_id,))
        return result['count'] if result else 0
    
    @staticmethod
    def get_last_login(user_id):
        """
        Get user's last login time and device
        
        Args:
            user_id (int): User ID
            
        Returns:
            dict: Last login info or None
        """
        query = """
            SELECT created_at as last_login, device_info, ip_address
            FROM user_sessions
            WHERE user_id = %s
            ORDER BY created_at DESC
            LIMIT 1
        """
        
        return db.fetch_one(query, (user_id,))
    
    @staticmethod
    def get_login_history(user_id, limit=10):
        """
        Get login history for a user
        
        Args:
            user_id (int): User ID
            limit (int): Number of records to fetch
            
        Returns:
            list: Login history
        """
        query = """
            SELECT 
                session_id,
                created_at as login_time,
                device_info,
                ip_address,
                is_active,
                expires_at
            FROM user_sessions
            WHERE user_id = %s
            ORDER BY created_at DESC
            LIMIT %s
        """
        
        result = db.execute_query(query, (user_id, limit))
        return result if result else []
    
    @staticmethod
    def is_session_valid(jwt_token):
        """
        Check if session is still valid
        
        Args:
            jwt_token (str): JWT token
            
        Returns:
            bool: True if valid
        """
        session = LoginSession.get_session_by_token(jwt_token)
        return session is not None
    
    @staticmethod
    def extend_session(session_id, hours=1):
        """
        Extend session expiry time
        
        Args:
            session_id (int): Session ID
            hours (int): Hours to extend
            
        Returns:
            bool: Success status
        """
        query = """
            UPDATE user_sessions
            SET expires_at = DATE_ADD(UTC_TIMESTAMP(), INTERVAL %s HOUR)
            WHERE session_id = %s
            AND is_active = TRUE
        """
        
        result = db.execute_update(query, (hours, session_id))
        return result is not None
    
    @staticmethod
    def get_sessions_by_ip(ip_address, limit=50):
        """
        Get sessions from a specific IP (for security monitoring)
        
        Args:
            ip_address (str): IP address
            limit (int): Max results
            
        Returns:
            list: Sessions from this IP
        """
        query = """
            SELECT s.*, u.email, u.full_name
            FROM user_sessions s
            JOIN users u ON s.user_id = u.user_id
            WHERE s.ip_address = %s
            ORDER BY s.created_at DESC
            LIMIT %s
        """
        
        result = db.execute_query(query, (ip_address, limit))
        return result if result else []
    
    @staticmethod
    def get_concurrent_logins(user_id):
        """
        Get number of concurrent active sessions
        
        Args:
            user_id (int): User ID
            
        Returns:
            int: Concurrent login count
        """
        query = """
            SELECT COUNT(DISTINCT ip_address) as count
            FROM user_sessions
            WHERE user_id = %s
            AND is_active = TRUE
            AND expires_at > UTC_TIMESTAMP()
        """
        
        result = db.fetch_one(query, (user_id,))
        return result['count'] if result else 0


# ============================================
# LOGIN ACTIVITY LOGGER
# ============================================

class LoginActivity:
    """Log login attempts and activities"""
    
    @staticmethod
    def log_success(user_id, ip_address, device_info):
        """Log successful login"""
        print(f"✅ LOGIN SUCCESS: User {user_id} from {ip_address}")
        print(f"   Device: {device_info}")
        # You can create a separate login_logs table for detailed tracking
    
    @staticmethod
    def log_failure(email, ip_address, reason="Invalid credentials"):
        """Log failed login attempt"""
        print(f"❌ LOGIN FAILED: {email} from {ip_address}")
        print(f"   Reason: {reason}")
        # You can create a login_attempts table to track failed logins
    
    @staticmethod
    def log_logout(user_id, session_id):
        """Log logout"""
        print(f"🚪 LOGOUT: User {user_id}, Session {session_id}")


# ============================================
# HELPER FUNCTIONS
# ============================================

def create_login_session(user_id, jwt_token, request_data):
    """
    Helper to create session from Flask request
    
    Args:
        user_id (int): User ID
        jwt_token (str): JWT token
        request_data (dict): Request object data
        
    Returns:
        int: Session ID
    """
    device_info = request_data.get('user_agent', 'Unknown Device')
    ip_address = request_data.get('ip_address', 'Unknown IP')
    
    return LoginSession.create_session(
        user_id,
        jwt_token,
        device_info,
        ip_address
    )