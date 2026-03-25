"""
============================================
PASSWORD RESET SCRIPT FOR ADMIN
Reset admin password in database
============================================
"""

import bcrypt
import mysql.connector
from getpass import getpass
import os
from dotenv import load_dotenv

load_dotenv()

# Database configuration
DB_CONFIG = {
    'host': os.getenv('DB_HOST', 'localhost'),
    'user': os.getenv('DB_USER', 'root'),
    'password': os.getenv('DB_PASSWORD', ''),
    'database': os.getenv('DB_NAME', 'quick_laundry_db'),
    'port': int(os.getenv('DB_PORT', 3306))
}

def generate_password_hash(password):
    """Generate bcrypt hash for a password"""
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(password.encode('utf-8'), salt)
    return hashed.decode('utf-8')

def reset_admin_password(email, new_password):
    """Reset admin password in database"""
    try:
        # Connect to database
        print(f"Connecting to database: {DB_CONFIG['database']}...")
        conn = mysql.connector.connect(**DB_CONFIG)
        cursor = conn.cursor(dictionary=True)
        
        # Check if user exists and is admin
        print(f"Checking for admin user: {email}...")
        cursor.execute(
            "SELECT user_id, email, full_name, is_admin FROM users WHERE email = %s",
            (email,)
        )
        user = cursor.fetchone()
        
        if not user:
            print(f"❌ User not found: {email}")
            return False
        
        if not user['is_admin']:
            print(f"❌ User is not an admin: {email}")
            return False
        
        print(f"✅ Admin user found: {user['full_name']}")
        print(f"   User ID: {user['user_id']}")
        
        # Generate new password hash
        print("Generating new password hash...")
        new_hash = generate_password_hash(new_password)
        
        # Update password
        print("Updating password in database...")
        cursor.execute(
            "UPDATE users SET password_hash = %s WHERE user_id = %s",
            (new_hash, user['user_id'])
        )
        conn.commit()
        
        # Verify update
        cursor.execute(
            "SELECT password_hash FROM users WHERE user_id = %s",
            (user['user_id'],)
        )
        result = cursor.fetchone()
        
        cursor.close()
        conn.close()
        
        print("✅ Password updated successfully!")
        print()
        print("=" * 70)
        print("🎉 ADMIN PASSWORD RESET COMPLETE")
        print("=" * 70)
        print(f"Email: {email}")
        print(f"New Password: {new_password}")
        print()
        print("⚠️ IMPORTANT: Please change this password after first login!")
        print("=" * 70)
        
        return True
        
    except mysql.connector.Error as e:
        print(f"❌ Database error: {e}")
        return False
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
        return False

def main():
    print("=" * 70)
    print("🔐 ADMIN PASSWORD RESET")
    print("=" * 70)
    print()
    
    # Get admin email
    email = input("Enter admin email (default: binitagvasita@gmail.com): ").strip()
    if not email:
        email = "binitagvasita@gmail.com"
    
    print()
    print("Choose password reset method:")
    print("1. Use default password: Admin123")
    print("2. Enter custom password")
    choice = input("Enter choice (1 or 2): ").strip()
    
    if choice == "1":
        new_password = "Admin123"
        print(f"Using default password: {new_password}")
    else:
        new_password = getpass("Enter new password: ")
        confirm_password = getpass("Confirm new password: ")
        
        if new_password != confirm_password:
            print("❌ Passwords don't match!")
            return
        
        if len(new_password) < 6:
            print("❌ Password must be at least 6 characters!")
            return
    
    print()
    print("=" * 70)
    print("READY TO RESET PASSWORD")
    print("=" * 70)
    print(f"Email: {email}")
    print(f"New Password: {'*' * len(new_password)}")
    print()
    confirm = input("Continue? (yes/no): ").strip().lower()
    
    if confirm != 'yes':
        print("❌ Password reset cancelled")
        return
    
    print()
    print("=" * 70)
    
    # Reset password
    success = reset_admin_password(email, new_password)
    
    if success:
        print()
        print("✅ You can now login with:")
        print(f"   Email: {email}")
        print(f"   Password: {new_password}")
    else:
        print()
        print("❌ Password reset failed")

if __name__ == "__main__":
    main()