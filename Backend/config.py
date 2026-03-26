"""
============================================
CONFIGURATION MODULE - UPDATED WITH BREVO
Added Brevo HTTP API email configuration (not Resend SMTP)
============================================
"""

import os
from datetime import timedelta
from dotenv import load_dotenv

# Load environment variables
load_dotenv()


class Config:
    """Base configuration class"""
    
    # ============================================
    # FLASK CONFIGURATION
    # ============================================
    SECRET_KEY = os.getenv('SECRET_KEY', 'dev-secret-key-change-in-production')
    FLASK_APP = os.getenv('FLASK_APP', 'app.py')
    FLASK_ENV = os.getenv('FLASK_ENV', 'development')
    DEBUG = os.getenv('DEBUG', 'True').lower() == 'true'
    
    # ============================================
    # SERVER CONFIGURATION
    # ============================================
    HOST = os.getenv('HOST', '0.0.0.0')
    PORT = int(os.getenv('PORT', 5000))
    
    # ============================================
    # FRONTEND CONFIGURATION
    # ============================================
    FRONTEND_URL = os.getenv('FRONTEND_URL', 'http://localhost:5500')
    
    # ============================================
    # DATABASE CONFIGURATION
    # ============================================
    # Railway format (priority)
    DATABASE_URL = os.getenv('DATABASE_URL')
    
    # Individual credentials (fallback for local)
    DB_HOST = os.getenv('DB_HOST', 'localhost')
    DB_PORT = int(os.getenv('DB_PORT', 3306))
    DB_USER = os.getenv('DB_USER', 'root')
    DB_PASSWORD = os.getenv('DB_PASSWORD', '')
    DB_NAME = os.getenv('DB_NAME', 'quick_laundry_db')
    
    # ============================================
    # JWT CONFIGURATION
    # ============================================
    JWT_SECRET_KEY = os.getenv('JWT_SECRET_KEY', 'jwt-secret-key-change-in-production')
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(
        seconds=int(os.getenv('JWT_ACCESS_TOKEN_EXPIRES', 3600))
    )
    JWT_ALGORITHM = 'HS256'
    
    # ============================================
    # GOOGLE OAUTH CONFIGURATION
    # ============================================
    GOOGLE_CLIENT_ID = os.getenv('GOOGLE_CLIENT_ID', '')
    GOOGLE_CLIENT_SECRET = os.getenv('GOOGLE_CLIENT_SECRET', '')
    GOOGLE_REDIRECT_URI = os.getenv(
        'GOOGLE_REDIRECT_URI',
        'http://localhost:5000/api/auth/google/callback'
    )
    
    # ============================================
    # CORS CONFIGURATION
    # ============================================
    CORS_ORIGINS = os.getenv(
        'CORS_ORIGINS',
        'http://localhost:5500,http://127.0.0.1:5500,http://localhost:3000'
    ).split(',')
    
    # ============================================
    # PASSWORD REQUIREMENTS
    # ============================================
    MIN_PASSWORD_LENGTH = int(os.getenv('MIN_PASSWORD_LENGTH', 8))
    REQUIRE_UPPERCASE = os.getenv('REQUIRE_UPPERCASE', 'True').lower() == 'true'
    REQUIRE_LOWERCASE = os.getenv('REQUIRE_LOWERCASE', 'True').lower() == 'true'
    REQUIRE_DIGIT = os.getenv('REQUIRE_DIGIT', 'True').lower() == 'true'
    REQUIRE_SPECIAL = os.getenv('REQUIRE_SPECIAL', 'False').lower() == 'true'
    
    # ============================================
    # OTP CONFIGURATION
    # ============================================
    OTP_EXPIRY_MINUTES = int(os.getenv('OTP_EXPIRY_MINUTES', 5))
    OTP_LENGTH = int(os.getenv('OTP_LENGTH', 6))
    
    # ============================================
    # EMAIL CONFIGURATION - BREVO HTTP API
    # ✅ Uses Brevo (HTTP API) - Works on Railway!
    # NOT Resend (SMTP) which is blocked on Railway
    # ============================================
    BREVO_API_KEY = os.getenv('BREVO_API_KEY', '')
    EMAIL_FROM = os.getenv('EMAIL_FROM', 'noreply@quicklaundry.shop')
    
    # Keep for backward compatibility (but not used anymore)
    SMTP_HOST = os.getenv('SMTP_HOST', 'smtp.gmail.com')
    SMTP_PORT = int(os.getenv('SMTP_PORT', 587))
    SMTP_USER = os.getenv('SMTP_USER', '')
    SMTP_PASSWORD = os.getenv('SMTP_PASSWORD', '')
    
    # ============================================
    # SESSION CONFIGURATION
    # ============================================
    SESSION_COOKIE_SECURE = os.getenv('SESSION_COOKIE_SECURE', 'False').lower() == 'true'
    SESSION_COOKIE_HTTPONLY = os.getenv('SESSION_COOKIE_HTTPONLY', 'True').lower() == 'true'
    SESSION_COOKIE_SAMESITE = os.getenv('SESSION_COOKIE_SAMESITE', 'Lax')
    PERMANENT_SESSION_LIFETIME = timedelta(days=7)
    
    # ============================================
    # RATE LIMITING
    # ============================================
    RATE_LIMIT_ENABLED = os.getenv('RATE_LIMIT_ENABLED', 'False').lower() == 'true'
    RATE_LIMIT_PER_MINUTE = int(os.getenv('RATE_LIMIT_PER_MINUTE', 60))
    
    # ============================================
    # APPLICATION SETTINGS
    # ============================================
    APP_NAME = os.getenv('APP_NAME', 'Quick Laundry')
    APP_VERSION = os.getenv('APP_VERSION', '1.0.0')
    
    # File Upload Settings
    MAX_CONTENT_LENGTH = 16 * 1024 * 1024  # 16MB max file size
    UPLOAD_FOLDER = 'uploads'
    ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'pdf'}
    
    # Cloudinary Configuration
    CLOUDINARY_CLOUD_NAME = os.getenv('CLOUDINARY_CLOUD_NAME', 'didrdetea')
    CLOUDINARY_API_KEY = os.getenv('CLOUDINARY_API_KEY', '')
    CLOUDINARY_API_SECRET = os.getenv('CLOUDINARY_API_SECRET', '')
    
    # Pagination
    ITEMS_PER_PAGE = 20
    
    # ============================================
    # SECURITY HEADERS
    # ============================================
    SECURITY_HEADERS = {
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'X-XSS-Protection': '1; mode=block',
        'Strict-Transport-Security': 'max-age=31536000; includeSubDomains'
    }

    # ============================================
    # SHOP CREDENTIALS — Quick Laundry, Satellite Ahmedabad
    # ============================================
    SHOP_NAME        = "Quick Laundry"
    SHOP_TAGLINE     = "Premium Dry Cleaning & Laundry Service"
    SHOP_ADDRESS     = "Satellite, Ahmedabad, Gujarat - 380015"
    SHOP_PHONE       = "+91 98765 43210"
    SHOP_WHATSAPP    = "919876543210"
    SHOP_EMAIL       = "noreply@quicklaundry.shop"
    SHOP_HOURS       = "Mon-Sat: 9AM-7PM | Sun: 10AM-5PM"
    SHOP_LAT         = 23.0225
    SHOP_LNG         = 72.5714
    SERVICE_RADIUS_KM = 10

    # Pincodes we can deliver to (within ~10 km of Satellite)
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

class DevelopmentConfig(Config):
    """Development configuration"""
    DEBUG = True
    TESTING = False


class ProductionConfig(Config):
    """Production configuration"""
    DEBUG = False
    TESTING = False
    SESSION_COOKIE_SECURE = True
    
    # Override with production values
    SECRET_KEY = os.getenv('SECRET_KEY')
    JWT_SECRET_KEY = os.getenv('JWT_SECRET_KEY')
    
    # Ensure production secrets are set
    if not SECRET_KEY or SECRET_KEY == 'dev-secret-key-change-in-production':
        SECRET_KEY = os.getenv('SECRET_KEY', 'fallback-key')
    
    if not JWT_SECRET_KEY or JWT_SECRET_KEY == 'jwt-secret-key-change-in-production':
        JWT_SECRET_KEY = os.getenv('JWT_SECRET_KEY', 'fallback-jwt-key')


class TestingConfig(Config):
    """Testing configuration"""
    DEBUG = True
    TESTING = True
    DB_NAME = 'quick_laundry_test_db'


# ============================================
# CONFIG DICTIONARY
# ============================================

config = {
    'development': DevelopmentConfig,
    'production': ProductionConfig,
    'testing': TestingConfig,
    'default': DevelopmentConfig
}


# ============================================
# GET CURRENT CONFIG
# ============================================

def get_config():
    """Get configuration based on FLASK_ENV"""
    env = os.getenv('FLASK_ENV', 'development')
    return config.get(env, config['default'])


# ============================================
# PRINT CONFIG (for debugging)
# ============================================

def print_config():
    """Print current configuration (hide sensitive data)"""
    current_config = get_config()
    
    print("=" * 50)
    print(f"CONFIGURATION: {os.getenv('FLASK_ENV', 'development').upper()}")
    print("=" * 50)
    print(f"App Name: {current_config.APP_NAME}")
    print(f"Version: {current_config.APP_VERSION}")
    print(f"Debug Mode: {current_config.DEBUG}")
    print(f"Host: {current_config.HOST}")
    print(f"Port: {current_config.PORT}")
    print(f"Database: {current_config.DB_NAME}")
    print(f"JWT Expires: {current_config.JWT_ACCESS_TOKEN_EXPIRES}")
    print(f"CORS Origins: {current_config.CORS_ORIGINS}")
    print(f"OTP Expiry: {current_config.OTP_EXPIRY_MINUTES} minutes")
    print(f"Email Service: {'Brevo (HTTP API)' if current_config.BREVO_API_KEY else 'Not configured'}")
    print(f"Google OAuth: {'Configured' if current_config.GOOGLE_CLIENT_ID else 'Not Configured'}")
    print("=" * 50)


# ============================================
# TEST CONFIG
# ============================================

if __name__ == "__main__":
    print_config()
    
    # Test config access
    cfg = get_config()
    print(f"\n✅ Configuration loaded successfully!")
    print(f"🔧 Environment: {os.getenv('FLASK_ENV', 'development')}")
    print(f"📧 Email Service: {'Brevo (HTTP API - Works on Railway!)' if cfg.BREVO_API_KEY else 'Not configured'}")