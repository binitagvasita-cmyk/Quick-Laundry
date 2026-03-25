"""
============================================
USER MODEL - COMPLETE WITH PASSWORD RESET
Handles all user-related database operations
Fixed: Boolean to tinyint conversion for MySQL
Added: Password reset functionality
============================================
"""

import bcrypt
from datetime import datetime, timedelta
from database.db import db
from utils.security import Security


class User:
    """User model for registration and authentication"""
    
    @staticmethod
    def create_user(user_data):
        """
        Create a new user in the database
        
        Args:
            user_data (dict): User registration data
            
        Returns:
            dict: Created user info or None if failed
        """
        try:
            print(f"📧 User.create_user called")
            print(f"   full_name: {user_data.get('full_name')}")
            print(f"   email: {user_data.get('email')}")
            print(f"   phone: {user_data.get('phone')}")
            
            # Hash password
            password_hash = bcrypt.hashpw(
                user_data['password'].encode('utf-8'),
                bcrypt.gensalt()
            ).decode('utf-8')
            
            print(f"✅ Password hashed successfully")
            
            # 🔥 FIX: Convert Python booleans to MySQL tinyint (0 or 1)
            comm_email = 1 if user_data.get('comm_email', True) else 0
            comm_whatsapp = 1 if user_data.get('comm_whatsapp', False) else 0
            comm_phone = 1 if user_data.get('comm_phone', False) else 0
            
            print(f"   comm_email: {comm_email} (type: {type(comm_email)})")
            print(f"   comm_whatsapp: {comm_whatsapp} (type: {type(comm_whatsapp)})")
            print(f"   comm_phone: {comm_phone} (type: {type(comm_phone)})")
            
            # Insert query
            query = """
                INSERT INTO users (
                    full_name, email, phone, password_hash,
                    address, city, pincode,
                    comm_email, comm_whatsapp, comm_phone
                ) VALUES (
                    %s, %s, %s, %s, %s, %s, %s, %s, %s, %s
                )
            """
            
            params = (
                user_data['full_name'],
                user_data['email'],
                user_data['phone'],
                password_hash,
                user_data['address'],
                user_data['city'],
                user_data['pincode'],
                comm_email,
                comm_whatsapp,
                comm_phone
            )
            
            print(f"🔍 Executing INSERT query...")
            print(f"   Params types: {[type(p).__name__ for p in params]}")
            
            # Execute insert
            user_id = db.execute_update(query, params)
            
            if user_id:
                print(f"✅ User created with ID: {user_id}")
                
                # Fetch and return created user
                return User.get_user_by_id(user_id)
            else:
                print("❌ Failed to create user - execute_update returned None/0")
                return None
                
        except Exception as e:
            print(f"❌ Create user error: {type(e).__name__}")
            print(f"❌ Error message: {str(e)}")
            print(f"❌ Error args: {e.args}")
            
            import traceback
            traceback.print_exc()
            return None
    
    @staticmethod
    def get_user_by_email(email):
        """
        Get user by email address
        
        Args:
            email (str): User email
            
        Returns:
            dict: User data or None
        """
        query = "SELECT * FROM users WHERE email = %s"
        return db.fetch_one(query, (email,))
    
    @staticmethod
    def get_user_by_phone(phone):
        """
        Get user by phone number
        
        Args:
            phone (str): User phone
            
        Returns:
            dict: User data or None
        """
        query = "SELECT * FROM users WHERE phone = %s"
        return db.fetch_one(query, (phone,))
    
    @staticmethod
    def get_user_by_id(user_id):
        """
        Get user by ID
        
        Args:
            user_id (int): User ID
            
        Returns:
            dict: User data or None
        """
        query = "SELECT * FROM users WHERE user_id = %s"
        return db.fetch_one(query, (user_id,))
    
    @staticmethod
    def email_exists(email):
        """
        Check if email already exists
        
        Args:
            email (str): Email to check
            
        Returns:
            bool: True if exists
        """
        user = User.get_user_by_email(email)
        return user is not None
    
    @staticmethod
    def phone_exists(phone):
        """
        Check if phone already exists
        
        Args:
            phone (str): Phone to check
            
        Returns:
            bool: True if exists
        """
        user = User.get_user_by_phone(phone)
        return user is not None
    
    @staticmethod
    def verify_password(email, password):
        """
        Verify user password for login
        
        Args:
            email (str): User email
            password (str): Plain text password
            
        Returns:
            dict: User data if valid, None if invalid
        """
        try:
            user = User.get_user_by_email(email)
            
            if not user:
                return None
            
            # Check password
            password_match = bcrypt.checkpw(
                password.encode('utf-8'),
                user['password_hash'].encode('utf-8')
            )
            
            if password_match:
                # Update last login time
                User.update_last_login(user['user_id'])
                return user
            else:
                return None
                
        except Exception as e:
            print(f"❌ Password verification error: {e}")
            return None
    
    @staticmethod
    def cleanup_unverified_users():
        """
        Delete unverified users older than 24 hours
        
        Returns:
            int: Number of users deleted
        """
        query = """
            DELETE FROM users 
            WHERE is_verified = 0 
            AND email_verified = 0 
            AND created_at < DATE_SUB(UTC_TIMESTAMP(), INTERVAL 24 HOUR)
        """
        result = db.execute_update(query)
        
        if result:
            print(f"🧹 Cleaned up {result} unverified users")
        
        return result if result else 0
    
    @staticmethod
    def update_last_login(user_id):
        """
        Update user's last login timestamp
        
        Args:
            user_id (int): User ID
            
        Returns:
            bool: Success status
        """
        query = "UPDATE users SET last_login = NOW() WHERE user_id = %s"
        result = db.execute_update(query, (user_id,))
        return result is not None
    
    @staticmethod
    def update_user_profile(user_id, update_data):
        """
        Update user profile information
        
        Args:
            user_id (int): User ID
            update_data (dict): Fields to update
            
        Returns:
            bool: Success status
        """
        try:
            # Build dynamic UPDATE query
            fields = []
            values = []
            
            allowed_fields = [
                'full_name', 'phone', 'address', 'city', 'pincode',
                'comm_email', 'comm_whatsapp', 'comm_phone'
            ]
            
            for field in allowed_fields:
                if field in update_data:
                    fields.append(f"{field} = %s")
                    
                    # 🔥 FIX: Convert booleans to integers for comm_ fields
                    if field.startswith('comm_'):
                        values.append(1 if update_data[field] else 0)
                    else:
                        values.append(update_data[field])
            
            if not fields:
                return False
            
            # Add user_id to values
            values.append(user_id)
            
            query = f"UPDATE users SET {', '.join(fields)} WHERE user_id = %s"
            result = db.execute_update(query, tuple(values))
            
            return result is not None
            
        except Exception as e:
            print(f"❌ Update profile error: {e}")
            return False
    
    @staticmethod
    def update_password(user_id, new_password):
        """
        Update user password
        
        Args:
            user_id (int): User ID
            new_password (str): New plain text password
            
        Returns:
            bool: Success status
        """
        try:
            # Hash new password
            password_hash = bcrypt.hashpw(
                new_password.encode('utf-8'),
                bcrypt.gensalt()
            ).decode('utf-8')
            
            query = "UPDATE users SET password_hash = %s WHERE user_id = %s"
            result = db.execute_update(query, (password_hash, user_id))
            
            return result is not None
            
        except Exception as e:
            print(f"❌ Update password error: {e}")
            return False
    
    @staticmethod
    def mark_email_verified(user_id):
        """
        Mark user email as verified
        
        Args:
            user_id (int): User ID
            
        Returns:
            bool: Success status
        """
        query = """
            UPDATE users 
            SET email_verified = 1, is_verified = 1 
            WHERE user_id = %s
        """
        result = db.execute_update(query, (user_id,))
        
        if result:
            print(f"✅ Email marked as verified for user_id: {user_id}")
        else:
            print(f"⚠️ Failed to mark email as verified for user_id: {user_id}")
        
        return result is not None
    
    @staticmethod
    def mark_phone_verified(user_id):
        """
        Mark user phone as verified
        
        Args:
            user_id (int): User ID
            
        Returns:
            bool: Success status
        """
        query = "UPDATE users SET phone_verified = 1 WHERE user_id = %s"
        result = db.execute_update(query, (user_id,))
        return result is not None
    
    @staticmethod
    def deactivate_user(user_id):
        """
        Deactivate user account
        
        Args:
            user_id (int): User ID
            
        Returns:
            bool: Success status
        """
        query = "UPDATE users SET is_active = 0 WHERE user_id = %s"
        result = db.execute_update(query, (user_id,))
        return result is not None
    
    @staticmethod
    def activate_user(user_id):
        """
        Activate user account
        
        Args:
            user_id (int): User ID
            
        Returns:
            bool: Success status
        """
        query = "UPDATE users SET is_active = 1 WHERE user_id = %s"
        result = db.execute_update(query, (user_id,))
        return result is not None
    
    @staticmethod
    def get_all_users(limit=100, offset=0):
        """
        Get all users (for admin)
        
        Args:
            limit (int): Number of users to fetch
            offset (int): Offset for pagination
            
        Returns:
            list: List of users
        """
        query = """
            SELECT user_id, full_name, email, phone, city, 
                   is_active, is_verified, created_at 
            FROM users 
            ORDER BY created_at DESC 
            LIMIT %s OFFSET %s
        """
        return db.execute_query(query, (limit, offset))
    
    @staticmethod
    def get_user_count():
        """
        Get total number of users
        
        Returns:
            int: Total user count
        """
        query = "SELECT COUNT(*) as count FROM users"
        result = db.fetch_one(query)
        return result['count'] if result else 0
    
    @staticmethod
    def search_users(search_term):
        """
        Search users by name, email, or phone
        
        Args:
            search_term (str): Search term
            
        Returns:
            list: Matching users
        """
        query = """
            SELECT user_id, full_name, email, phone, city, 
                   is_active, created_at 
            FROM users 
            WHERE full_name LIKE %s 
               OR email LIKE %s 
               OR phone LIKE %s
            ORDER BY created_at DESC
            LIMIT 50
        """
        search_pattern = f"%{search_term}%"
        return db.execute_query(query, (search_pattern, search_pattern, search_pattern))
    
    @staticmethod
    def remove_sensitive_data(user):
        """
        Remove sensitive data from user object (for API response)
        
        Args:
            user (dict): User data
            
        Returns:
            dict: User data without sensitive fields
        """
        if not user:
            return None
        
        # Remove password hash
        if 'password_hash' in user:
            del user['password_hash']
        
        # Convert datetime to string
        if 'created_at' in user and isinstance(user['created_at'], datetime):
            user['created_at'] = user['created_at'].isoformat()
        
        if 'updated_at' in user and isinstance(user['updated_at'], datetime):
            user['updated_at'] = user['updated_at'].isoformat()
        
        if 'last_login' in user and user['last_login']:
            if isinstance(user['last_login'], datetime):
                user['last_login'] = user['last_login'].isoformat()
        
        # 🔥 FIX: Convert tinyint to boolean for frontend
        if 'comm_email' in user:
            user['comm_email'] = bool(user['comm_email'])
        if 'comm_whatsapp' in user:
            user['comm_whatsapp'] = bool(user['comm_whatsapp'])
        if 'comm_phone' in user:
            user['comm_phone'] = bool(user['comm_phone'])
        if 'is_active' in user:
            user['is_active'] = bool(user['is_active'])
        if 'is_verified' in user:
            user['is_verified'] = bool(user['is_verified'])
        if 'email_verified' in user:
            user['email_verified'] = bool(user['email_verified'])
        if 'phone_verified' in user:
            user['phone_verified'] = bool(user['phone_verified'])
        
        return user
    
    # ============================================
    # PASSWORD RESET METHODS
    # ============================================
    
    @staticmethod
    def create_password_reset_token(user_id, ip_address=None, user_agent=None):
        """
        Create password reset token for user
        
        Args:
            user_id (int): User ID
            ip_address (str): IP address of requester
            user_agent (str): User agent string
            
        Returns:
            str: Reset token or None if failed
        """
        try:
            # Generate secure reset token
            reset_token = Security.generate_reset_token()
            
            # Hash the token for storage
            token_hash = Security.hash_token(reset_token)
            
            # Token expires in 24 hours
            expires_at = Security.get_reset_token_expiry_time()
            
            # Invalidate all previous reset tokens for this user
            invalidate_query = """
                UPDATE password_reset_tokens 
                SET is_used = 1 
                WHERE user_id = %s AND is_used = 0
            """
            db.execute_update(invalidate_query, (user_id,))
            
            # Insert new reset token
            insert_query = """
                INSERT INTO password_reset_tokens 
                (user_id, reset_token, token_hash, expires_at, ip_address, user_agent)
                VALUES (%s, %s, %s, %s, %s, %s)
            """
            
            result = db.execute_update(
                insert_query,
                (user_id, reset_token, token_hash, expires_at, ip_address, user_agent)
            )
            
            if result:
                print(f"✅ Password reset token created for user {user_id}")
                print(f"   Expires at (UTC): {expires_at}")
                return reset_token
            else:
                print(f"❌ Failed to create reset token for user {user_id}")
                return None
                
        except Exception as e:
            print(f"❌ Create reset token error: {e}")
            import traceback
            traceback.print_exc()
            return None
    
    @staticmethod
    def verify_reset_token(reset_token):
        """
        Verify password reset token and return user info
        
        Args:
            reset_token (str): Reset token to verify
            
        Returns:
            dict: User data if token is valid, None otherwise
        """
        try:
            print(f"🔍 Verifying reset token: {reset_token[:20]}...")
            
            # Query to find the token
            query = """
                SELECT 
                    prt.*,
                    u.user_id, u.email, u.full_name,
                    TIMESTAMPDIFF(MINUTE, UTC_TIMESTAMP(), prt.expires_at) as minutes_remaining
                FROM password_reset_tokens prt
                INNER JOIN users u ON prt.user_id = u.user_id
                WHERE prt.reset_token = %s 
                AND prt.is_used = 0
                ORDER BY prt.created_at DESC
                LIMIT 1
            """
            
            result = db.fetch_one(query, (reset_token,))
            
            if not result:
                print("❌ Reset token not found or already used")
                return None
            
            minutes_remaining = result.get('minutes_remaining', 0)
            print(f"⏱️ Token expires in {minutes_remaining} minutes")
            
            # Check if token has expired
            if minutes_remaining < 0:
                print(f"❌ Token has expired ({abs(minutes_remaining)} minutes ago)")
                return None
            
            print(f"✅ Reset token is valid for user: {result['email']}")
            
            return {
                'user_id': result['user_id'],
                'email': result['email'],
                'full_name': result['full_name'],
                'token_id': result['token_id'],
                'expires_at': result['expires_at']
            }
            
        except Exception as e:
            print(f"❌ Verify reset token error: {e}")
            import traceback
            traceback.print_exc()
            return None
    
    @staticmethod
    def reset_password_with_token(reset_token, new_password):
        """
        Reset user password using reset token
        
        Args:
            reset_token (str): Valid reset token
            new_password (str): New password (plain text)
            
        Returns:
            tuple: (success: bool, message: str, user_data: dict)
        """
        try:
            # Verify token first
            token_data = User.verify_reset_token(reset_token)
            
            if not token_data:
                return False, "Invalid or expired reset token", None
            
            user_id = token_data['user_id']
            
            # Update password
            password_updated = User.update_password(user_id, new_password)
            
            if not password_updated:
                return False, "Failed to update password", None
            
            # Mark token as used
            mark_used_query = """
                UPDATE password_reset_tokens 
                SET is_used = 1, used_at = UTC_TIMESTAMP()
                WHERE reset_token = %s
            """
            db.execute_update(mark_used_query, (reset_token,))
            
            # Get updated user data
            user = User.get_user_by_id(user_id)
            
            print(f"✅ Password reset successful for user: {token_data['email']}")
            
            return True, "Password reset successful", user
            
        except Exception as e:
            print(f"❌ Reset password error: {e}")
            import traceback
            traceback.print_exc()
            return False, "An error occurred during password reset", None
    
    @staticmethod
    def invalidate_all_reset_tokens(user_id):
        """
        Invalidate all password reset tokens for a user
        
        Args:
            user_id (int): User ID
            
        Returns:
            bool: Success status
        """
        try:
            query = """
                UPDATE password_reset_tokens 
                SET is_used = 1 
                WHERE user_id = %s AND is_used = 0
            """
            result = db.execute_update(query, (user_id,))
            
            if result:
                print(f"✅ All reset tokens invalidated for user {user_id}")
            
            return result is not None
            
        except Exception as e:
            print(f"❌ Invalidate tokens error: {e}")
            return False
    
    @staticmethod
    def get_reset_token_info(reset_token):
        """
        Get information about a reset token without verifying expiry
        
        Args:
            reset_token (str): Reset token
            
        Returns:
            dict: Token info or None
        """
        try:
            query = """
                SELECT 
                    prt.*,
                    u.email,
                    TIMESTAMPDIFF(MINUTE, UTC_TIMESTAMP(), prt.expires_at) as minutes_remaining
                FROM password_reset_tokens prt
                INNER JOIN users u ON prt.user_id = u.user_id
                WHERE prt.reset_token = %s
                ORDER BY prt.created_at DESC
                LIMIT 1
            """
            
            result = db.fetch_one(query, (reset_token,))
            
            if result:
                return {
                    'token_id': result['token_id'],
                    'email': Security.mask_email(result['email']),
                    'is_used': bool(result['is_used']),
                    'is_expired': result['minutes_remaining'] < 0,
                    'minutes_remaining': result['minutes_remaining'],
                    'created_at': result['created_at']
                }
            
            return None
            
        except Exception as e:
            print(f"❌ Get token info error: {e}")
            return None
    
    @staticmethod
    def cleanup_expired_reset_tokens():
        """
        Delete expired password reset tokens (older than 48 hours)
        
        Returns:
            int: Number of tokens deleted
        """
        try:
            query = """
                DELETE FROM password_reset_tokens 
                WHERE expires_at < DATE_SUB(UTC_TIMESTAMP(), INTERVAL 48 HOUR)
            """
            result = db.execute_update(query)
            
            if result and result > 0:
                print(f"🧹 Cleaned up {result} expired reset tokens")
            
            return result if result else 0
            
        except Exception as e:
            print(f"❌ Cleanup tokens error: {e}")
            return 0
    
    # ============================================
    # GOOGLE OAUTH METHODS
    # ============================================
    
    @staticmethod
    def create_user_from_google(user_data):
        """
        Create user from Google OAuth data
        
        Args:
            user_data (dict): User data from Google
            
        Returns:
            dict: Created user info or None
        """
        try:
            print(f"🔵 Creating user from Google OAuth")
            print(f"   email: {user_data.get('email')}")
            print(f"   google_id: {user_data.get('google_id')}")
            
            # Hash a random password
            password_hash = bcrypt.hashpw(
                user_data['password'].encode('utf-8'),
                bcrypt.gensalt()
            ).decode('utf-8')
            
            # Convert booleans to integers
            comm_email = 1 if user_data.get('comm_email', True) else 0
            comm_whatsapp = 1 if user_data.get('comm_whatsapp', False) else 0
            comm_phone = 1 if user_data.get('comm_phone', False) else 0
            
            # Insert query
            query = """
                INSERT INTO users (
                    full_name, email, phone, password_hash,
                    address, city, pincode,
                    google_id, profile_picture,
                    comm_email, comm_whatsapp, comm_phone,
                    is_verified, email_verified
                ) VALUES (
                    %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, 1, 1
                )
            """
            
            params = (
                user_data['full_name'],
                user_data['email'],
                user_data.get('phone', ''),
                password_hash,
                user_data.get('address', ''),
                user_data.get('city', ''),
                user_data.get('pincode', ''),
                user_data.get('google_id', ''),
                user_data.get('profile_picture', ''),
                comm_email,
                comm_whatsapp,
                comm_phone
            )
            
            user_id = db.execute_update(query, params)
            
            if user_id:
                print(f"✅ Google user created with ID: {user_id}")
                return User.get_user_by_id(user_id)
            else:
                print("❌ Failed to create Google user")
                return None
                
        except Exception as e:
            print(f"❌ Create Google user error: {e}")
            import traceback
            traceback.print_exc()
            return None
    
    @staticmethod
    def get_user_by_google_id(google_id):
        """Get user by Google ID"""
        query = "SELECT * FROM users WHERE google_id = %s"
        return db.fetch_one(query, (google_id,))
    
    @staticmethod
    def update_google_id(user_id, google_id):
        """Link Google account to user"""
        try:
            query = "UPDATE users SET google_id = %s WHERE user_id = %s"
            result = db.execute_update(query, (google_id, user_id))
            
            if result:
                print(f"✅ Google ID linked to user {user_id}")
            
            return result is not None
            
        except Exception as e:
            print(f"❌ Update Google ID error: {e}")
            return False
    
    @staticmethod
    def update_profile_picture(user_id, picture_url):
        """Update user's profile picture"""
        try:
            query = "UPDATE users SET profile_picture = %s WHERE user_id = %s"
            result = db.execute_update(query, (picture_url, user_id))
            return result is not None
            
        except Exception as e:
            print(f"❌ Update profile picture error: {e}")
            return False
    
    @staticmethod
    def unlink_google_account(user_id):
        """Unlink Google account from user"""
        try:
            query = "UPDATE users SET google_id = NULL WHERE user_id = %s"
            result = db.execute_update(query, (user_id,))
            
            if result:
                print(f"✅ Google account unlinked from user {user_id}")
            
            return result is not None
            
        except Exception as e:
            print(f"❌ Unlink Google account error: {e}")
            return False
    
    @staticmethod
    def has_google_account(user_id):
        """Check if user has linked Google account"""
        user = User.get_user_by_id(user_id)
        if not user:
            return False
        
        return bool(user.get('google_id'))


# ============================================
# TEST USER MODEL
# ============================================

if __name__ == "__main__":
    from database.db import init_database
    
    print("=" * 50)
    print("USER MODEL TEST")
    print("=" * 50)
    
    # Initialize database
    init_database()
    
    # Test: Check if email exists
    email = "john@example.com"
    exists = User.email_exists(email)
    print(f"\n📧 Email '{email}' exists: {exists}")
    
    # Test: Get user by email
    user = User.get_user_by_email(email)
    if user:
        print(f"✅ Found user: {user['full_name']}")
        
        # Test password reset
        print("\n🔑 Testing password reset...")
        reset_token = User.create_password_reset_token(
            user['user_id'],
            ip_address="127.0.0.1",
            user_agent="Test Browser"
        )
        
        if reset_token:
            print(f"✅ Reset token created: {reset_token[:30]}...")
            
            # Verify token
            token_data = User.verify_reset_token(reset_token)
            if token_data:
                print(f"✅ Token verified for: {token_data['email']}")
            else:
                print("❌ Token verification failed")
        else:
            print("❌ Failed to create reset token")
    
    # Test: Get user count
    count = User.get_user_count()
    print(f"\n📊 Total users: {count}")
    
    print("\n" + "=" * 50)
    print("✅ User model test completed!")