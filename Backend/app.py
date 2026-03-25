"""
============================================
QUICK LAUNDRY - FLASK APPLICATION
Main application entry point - SAFELY UPDATED with Admin Panel
============================================
"""

from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from config import get_config
from database.db import init_database, close_db_connection
from utils.response import APIResponse
from utils.scheduler import start_session_cleanup, stop_session_cleanup
import os
from routes.admin_manage_services import admin_manage_services_bp
# ============================================
# CREATE FLASK APP
# ============================================

def create_app():
    """Create and configure Flask application"""
    
    app = Flask(__name__)
    
    # Load configuration
    config = get_config()
    app.config.from_object(config)
    
    # Configure Flask session (needed for Google OAuth state)
    app.config['SESSION_TYPE'] = 'filesystem'
    
    print("=" * 70)
    print("🚀 QUICK LAUNDRY API SERVER")
    print("=" * 70)
    print(f"Environment: {os.getenv('FLASK_ENV', 'development').upper()}")
    print(f"Debug Mode: {config.DEBUG}")
    print(f"Database: {config.DB_NAME}")
    print(f"Google OAuth: {'✅ Enabled' if config.GOOGLE_CLIENT_ID else '❌ Disabled'}")
    print("=" * 70)
    
    # ============================================
    # INITIALIZE DATABASE
    # ============================================
    
    print("\n🔄 Initializing database connection...")
    if init_database():
        print("✅ Database initialized successfully!")
    else:
        print("❌ Database initialization failed!")
    
    # ============================================
    # START SESSION CLEANUP SCHEDULER
    # ============================================
    
    print("\n⏰ Starting session cleanup scheduler...")
    try:
        start_session_cleanup()
        print("✅ Session cleanup scheduler started")
    except Exception as e:
        print(f"⚠️ Failed to start scheduler: {e}")
    
    # ============================================
    # CONFIGURE CORS
    # ============================================
    
    #CORS(app,
#      resources={r"/api/*": {"origins": "*"}},
#      allow_headers=["Content-Type", "Authorization"],
#      methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
#      supports_credentials=False)   # MUST be False when origins="*"
    CORS(app, resources={r"/api/*": {
    "origins": os.getenv("FRONTEND_URL", "*")
    }},
    allow_headers=["Content-Type", "Authorization"],
    methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    supports_credentials=False)
    print(f"✅ CORS enabled for: {config.CORS_ORIGINS}")
    
    # ============================================
    # REGISTER EXISTING USER BLUEPRINTS (UNCHANGED)
    # ============================================
    
    print("\n📦 Registering User Blueprints...")
    
    # Import existing blueprints - EXACTLY as they were
    from routes.auth import auth_bp
    from routes.google_auth_routes import google_auth_bp
    from routes.services_routes import services_bp
    from routes.cart_routes import cart_bp
    from routes.review_routs import review_bp
    from routes.profile_routes import profile_bp
    from routes.orders_routes import orders_bp        # ✅ NEW: Direct order placement
    from routes.email_routes import email_bp          # ✅ NEW: Email notifications
    
    # Register existing blueprints - NO CHANGES
    app.register_blueprint(auth_bp)
    app.register_blueprint(google_auth_bp)
    app.register_blueprint(services_bp)
    app.register_blueprint(cart_bp)
    app.register_blueprint(review_bp)
    app.register_blueprint(profile_bp)
    app.register_blueprint(orders_bp)    
    app.register_blueprint(email_bp)                  # ✅ NEW
    app.register_blueprint(admin_manage_services_bp)             # ✅ NEW
    
    print("✅ User Blueprints registered:")
    print("   ✓ /api/auth/* (Authentication routes)")
    print("   ✓ /api/auth/google/* (Google OAuth routes)")
    print("   ✓ /api/services/* (Services routes)")
    print("   ✓ /api/cart/* (Cart Management) 🛒")
    print("   ✓ /api/reviews/* (Reviews System) ⭐")
    print("   ✓ /api/profile/* (Profile Management) 👤")
    print("   ✓ /api/orders/* (Orders - Place & View) 📦")
    
    # ============================================
    # REGISTER ADMIN BLUEPRINTS (NEW - SAFE ADDITION)
    # ============================================
    
    print("\n👑 Registering Admin Panel Blueprints...")
    
    try:
        # Import admin blueprints - wrapped in try-except for safety
        from routes.admin_auth import admin_auth_bp
        from routes.admin_dashboard import admin_dashboard_bp
        from routes.admin_order import admin_orders_bp
        from routes.admin_customer import admin_customers_bp
        from routes.admin_service_reviews import admin_services_bp, admin_reviews_bp
        from routes.admin_setting import admin_settings_bp
        from routes.admin_users import admin_users_bp
        from routes.admin_categories import admin_categories_bp
        from routes.admin_notifications import admin_notifications_bp
        from routes.invoice_routes import invoice_bp              # ✅ NEW: Invoice system
        from routes.admin_delivery_boys import admin_delivery_boys_bp # ✅ NEW: Delivery Boys Management


        # Register admin blueprints
        app.register_blueprint(admin_auth_bp)
        app.register_blueprint(admin_dashboard_bp)
        app.register_blueprint(admin_orders_bp)
        app.register_blueprint(admin_customers_bp)
        app.register_blueprint(admin_services_bp)
        app.register_blueprint(admin_settings_bp)
        app.register_blueprint(admin_users_bp)
        app.register_blueprint(admin_categories_bp)
        app.register_blueprint(admin_reviews_bp)
        app.register_blueprint(admin_notifications_bp)
        app.register_blueprint(invoice_bp)                        # ✅ NEW: Invoice system
        app.register_blueprint(admin_delivery_boys_bp)            # ✅ NEW: Delivery Boys Management
        
        
        print("✅ Admin Blueprints registered:")
        print("   ✓ /api/admin/auth/* (Admin Authentication)")
        print("   ✓ /api/admin/dashboard/* (Dashboard Analytics)")
        print("   ✓ /api/admin/orders/* (Order Management)")
        print("   ✓ /api/admin/customers/* (Customer Management)")
        print("   ✓ /api/admin/services/* (Service Management)")
        print("   ✓ /api/admin/reviews/* (Review Management)")
        print("   ✓ /api/admin/settings/* (System Settings)")
        print("   ✓ /api/admin/users/* (User Management)")
        print("   ✓ /api/admin/categories/* (Category Management)")
        print("   ✓ /api/admin/invoices/*   (Invoice Generation)")
        print("   ✓ /api/invoices/*         (User Invoice Download)")
        print("   ✓ /api/admin/delivery-boys/* (Delivery Boys Management)")
        
    except ImportError as e:
        print(f"⚠️ Admin routes not available: {e}")
        print("⚠️ Server will run without admin panel")
    except Exception as e:
        print(f"⚠️ Error loading admin routes: {e}")
        print("⚠️ Server will continue without admin features")

    # ============================================
    # REGISTER DELIVERY BOY BLUEPRINTS ← NEW ADDITION
    # Safe: wrapped in try-except, will not break anything if files missing
    # ============================================

    print("\n🚴 Registering Delivery Boy Blueprints...")

    try:
        from routes.delivery_auth   import delivery_auth_bp
        from routes.delivery_routes import delivery_bp
        from routes.admin_delivery  import admin_delivery_bp

        app.register_blueprint(delivery_auth_bp)
        app.register_blueprint(delivery_bp)
        app.register_blueprint(admin_delivery_bp)

        print("✅ Delivery Blueprints registered:")
        print("   ✓ /api/delivery/auth/*  (Delivery Login/Verify/Logout)")
        print("   ✓ /api/delivery/*       (Dashboard, Orders, Status, Availability)")
        print("   ✓ /api/admin/delivery/* (Admin: Create boys, Assign orders)")

    except ImportError as e:
        print(f"⚠️ Delivery routes not available: {e}")
        print("⚠️ Server will run without delivery module")
    except Exception as e:
        print(f"⚠️ Error loading delivery routes: {e}")
        print("⚠️ Server will continue without delivery features")
    
    # ============================================
    # SERVE UPLOADED FILES (EXISTING FUNCTIONALITY)
    # ============================================
    
    @app.route('/uploads/<path:filename>')
    def serve_uploads(filename):
        # Local uploads no longer used — files are on Cloudinary
        return APIResponse.error(
            "Local file serving disabled. Files are served via Cloudinary.", 
            None, 410
        )
    
    print("✅ Upload serving configured: /uploads/*")
    
    # ============================================
    # ADMIN STATIC PAGES (NEW - SAFE ADDITION)
    # ============================================
    @app.route('/admin')
    def admin_login_page():
        """Serve admin login page"""
        try:
            # Try multiple possible locations
            possible_paths = [
                ('static/admin/templates', 'admin-login.html'),
                ('static/admin', 'admin-login.html'),
                ('static', 'admin-login.html'),
                ('templates/admin', 'admin-login.html'),
                ('templates', 'admin-login.html'),
                ('.', 'admin-login.html'),  # Current directory
            ]
            
            for directory, filename in possible_paths:
                try:
                    filepath = os.path.join(directory, filename)
                    if os.path.exists(filepath):
                        print(f"✅ Found admin login at: {filepath}")
                        return send_from_directory(directory, filename)
                except:
                    continue
            
            # If not found, return error
            print(f"⚠️ Admin login page not found in any location")
            return jsonify({
                'success': False,
                'message': 'Admin login page not found. Please place admin-login.html in one of these locations: static/admin/templates/, static/admin/, static/, or templates/'
            }), 404
            
        except Exception as e:
            print(f"⚠️ Error serving admin login: {e}")
            return jsonify({
                'success': False,
                'message': f'Error loading admin login page: {str(e)}'
            }), 404
    
    @app.route('/admin/dashboard')
    def admin_dashboard_page():
        """Serve admin dashboard page"""
        try:
            # Try multiple possible locations
            possible_paths = [
                ('static/admin/templates', 'admin-dashboard.html'),
                ('static/admin', 'admin-dashboard.html'),
                ('static', 'admin-dashboard.html'),
                ('templates/admin', 'admin-dashboard.html'),
                ('templates', 'admin-dashboard.html'),
                ('.', 'admin-dashboard.html'),  # Current directory
            ]
            
            for directory, filename in possible_paths:
                try:
                    filepath = os.path.join(directory, filename)
                    if os.path.exists(filepath):
                        print(f"✅ Found admin dashboard at: {filepath}")
                        return send_from_directory(directory, filename)
                except:
                    continue
            
            # If not found, return error
            print(f"⚠️ Admin dashboard page not found in any location")
            return jsonify({
                'success': False,
                'message': 'Admin dashboard not configured. Please place admin-dashboard.html in one of these locations: static/admin/templates/, static/admin/, static/, or templates/'
            }), 404
            
        except Exception as e:
            print(f"⚠️ Error serving admin dashboard: {e}")
            return jsonify({
                'success': False,
                'message': f'Error loading admin dashboard: {str(e)}'
            }), 404

    print("✅ Admin pages configured with auto-detection: /admin & /admin/dashboard")

    @app.route('/admin/users')
    def admin_users_page():
        """Serve admin users management page"""
        try:
            # Try multiple possible locations
            possible_paths = [
                ('static/admin/templates', 'admin-users.html'),
                ('static/admin', 'admin-users.html'),
                ('static', 'admin-users.html'),
                ('templates/admin', 'admin-users.html'),
                ('templates', 'admin-users.html'),
                ('.', 'admin-users.html'),  # Current directory
            ]
            
            for directory, filename in possible_paths:
                try:
                    filepath = os.path.join(directory, filename)
                    if os.path.exists(filepath):
                        print(f"✅ Found admin users page at: {filepath}")
                        return send_from_directory(directory, filename)
                except:
                    continue
            
            # If not found, return error
            print(f"⚠️ Admin users page not found in any location")
            return jsonify({
                'success': False,
                'message': 'Admin users page not found. Please place admin-users.html in one of these locations: static/admin/templates/, static/admin/, static/, or templates/'
            }), 404
            
        except Exception as e:
            print(f"⚠️ Error serving admin users page: {e}")
            return jsonify({
                'success': False,
                'message': f'Error loading admin users page: {str(e)}'
            }), 404
    # ADD THIS ROUTE TO app.py (after the /admin/users route, around line 282)

    @app.route('/admin/categories')
    def admin_categories_page():
        """Serve admin categories management page"""
        try:
            # Try multiple possible locations
            possible_paths = [
                ('static/admin/templates', 'admin-categories.html'),
                ('static/admin', 'admin-categories.html'),
                ('static', 'admin-categories.html'),
                ('templates/admin', 'admin-categories.html'),
                ('templates', 'admin-categories.html'),
                ('.', 'admin-categories.html'),  # Current directory
            ]
            
            for directory, filename in possible_paths:
                try:
                    filepath = os.path.join(directory, filename)
                    if os.path.exists(filepath):
                        print(f"✅ Found admin categories page at: {filepath}")
                        return send_from_directory(directory, filename)
                except:
                    continue
            
            # If not found, return error
            print(f"⚠️ Admin categories page not found in any location")
            return jsonify({
                'success': False,
                'message': 'Admin categories page not found. Please place admin-categories.html in one of these locations: static/admin/templates/, static/admin/, static/, or templates/'
            }), 404
            
        except Exception as e:
            print(f"⚠️ Error serving admin categories page: {e}")
            return jsonify({
                'success': False,
                'message': f'Error loading admin categories page: {str(e)}'
            }), 404
    @app.route('/admin/reviews')
    def admin_reviews_page():
        """Serve admin reviews management page"""
        try:
            possible_paths = [
                ('static/admin/templates', 'admin-reviews.html'),
                ('static/admin', 'admin-reviews.html'),
                ('static', 'admin-reviews.html'),
                ('templates/admin', 'admin-reviews.html'),
                ('templates', 'admin-reviews.html'),
                ('.', 'admin-reviews.html'),
            ]
            
            for directory, filename in possible_paths:
                try:
                    filepath = os.path.join(directory, filename)
                    if os.path.exists(filepath):
                        print(f"✅ Found admin reviews page at: {filepath}")
                        return send_from_directory(directory, filename)
                except:
                    continue
            
            print(f"⚠️ Admin reviews page not found")
            return jsonify({
                'success': False,
                'message': 'Admin reviews page not found. Place admin-reviews.html in static/admin/ or templates/'
            }), 404
            
        except Exception as e:
            print(f"❌ Error serving admin reviews page: {e}")
            return APIResponse.error(str(e), None, 500)
    
    @app.route('/admin/orders')
    def admin_orders_page():
        """Serve admin orders management page"""
        try:
            possible_paths = [
                ('static/admin/templates', 'admin-orders.html'),
                ('static/admin', 'admin-orders.html'),
                ('static', 'admin-orders.html'),
                ('templates/admin', 'admin-orders.html'),
                ('templates', 'admin-orders.html'),
                ('.', 'admin-orders.html'),
            ]
            for directory, filename in possible_paths:
                try:
                    filepath = os.path.join(directory, filename)
                    if os.path.exists(filepath):
                        return send_from_directory(directory, filename)
                except:
                    continue
            return jsonify({'success': False, 'message': 'Admin orders page not found.'}), 404
        except Exception as e:
            return jsonify({'success': False, 'message': str(e)}), 500

    @app.route('/admin/services')
    def admin_services_page():
        """Serve admin services management page"""
        try:
            possible_paths = [
                ('static/admin/templates', 'admin-services.html'),
                ('static/admin', 'admin-services.html'),
                ('static', 'admin-services.html'),
                ('templates/admin', 'admin-services.html'),
                ('templates', 'admin-services.html'),
            ]
            for directory, filename in possible_paths:
                filepath = os.path.join(directory, filename)
                if os.path.exists(filepath):
                    return send_from_directory(directory, filename)
            return 'Admin services page not found.', 404
        except Exception as e:
            print(f"❌ Error serving admin services page: {e}")
            return f'Error: {str(e)}', 500

    @app.route('/admin/notifications')
    def admin_notifications_page():
        """Serve admin Notifications page"""
        try:
            possible_paths = [
                ('static/admin/templates', 'admin-notifications.html'),
                ('static/admin', 'admin-notifications.html'),
                ('static', 'admin-notifications.html'),
                ('templates/admin', 'admin-notifications.html'),
                ('templates', 'admin-notifications.html'),
                ('.', 'admin-notifications.html'),
            ]
            for directory, filename in possible_paths:
                try:
                    filepath = os.path.join(directory, filename)
                    if os.path.exists(filepath):
                        print(f"✅ Found admin notifications page at: {filepath}")
                        return send_from_directory(directory, filename)
                except:
                    continue
            return jsonify({'success': False, 'message': 'admin-notifications.html not found'}), 404
        except Exception as e:
            return jsonify({'success': False, 'message': str(e)}), 500

    @app.route('/admin/activity-logs')
    def admin_analytics_page():
        """Serve admin Reports & Analytics page"""
        try:
            possible_paths = [
                ('static/admin/templates', 'admin-analytics.html'),
                ('static/admin', 'admin-analytics.html'),
                ('static', 'admin-analytics.html'),
                ('templates/admin', 'admin-analytics.html'),
                ('templates', 'admin-analytics.html'),
                ('.', 'admin-analytics.html'),
            ]
            for directory, filename in possible_paths:
                try:
                    filepath = os.path.join(directory, filename)
                    if os.path.exists(filepath):
                        print(f"✅ Found admin analytics page at: {filepath}")
                        return send_from_directory(directory, filename)
                except:
                    continue
            return jsonify({'success': False, 'message': 'admin-analytics.html not found'}), 404
        except Exception as e:
            return jsonify({'success': False, 'message': str(e)}), 500


    @app.route('/admin/delivery-boys')
    def admin_delivery_boys_page():
        """Serve admin delivery boys management page"""
        try:
            possible_paths = [
                ('static/admin/templates', 'admin-delivery-boys.html'),
                ('static/admin', 'admin-delivery-boys.html'),
                ('static', 'admin-delivery-boys.html'),
                ('templates/admin', 'admin-delivery-boys.html'),
                ('templates', 'admin-delivery-boys.html'),
                ('.', 'admin-delivery-boys.html'),
            ]
            for directory, filename in possible_paths:
                try:
                    filepath = os.path.join(directory, filename)
                    if os.path.exists(filepath):
                        return send_from_directory(directory, filename)
                except:
                    continue
            return jsonify({'success': False, 'message': 'admin-delivery-boys.html not found'}), 404
        except Exception as e:
            return jsonify({'success': False, 'message': str(e)}), 500

    @app.route('/admin/sidebar')
    def admin_sidebar():
        """Serve shared admin sidebar component"""
        try:
            possible_paths = [
                ('static/admin/templates', 'admin-sidebar.html'),
                ('static/admin', 'admin-sidebar.html'),
                ('static', 'admin-sidebar.html'),
                ('templates/admin', 'admin-sidebar.html'),
                ('templates', 'admin-sidebar.html'),
                ('.', 'admin-sidebar.html'),
            ]
            for directory, filename in possible_paths:
                try:
                    filepath = os.path.join(directory, filename)
                    if os.path.exists(filepath):
                        print(f"✅ Found admin sidebar at: {filepath}")
                        return send_from_directory(directory, filename)
                except:
                    continue
            print("⚠️ Admin sidebar not found in any location")
            return jsonify({'success': False, 'message': 'admin-sidebar.html not found'}), 404
        except Exception as e:
            print(f"❌ Error serving admin sidebar: {e}")
            return jsonify({'success': False, 'message': str(e)}), 500

    # ============================================
    # DELIVERY BOY STATIC PAGES ← NEW ADDITION
    # Your files are already in static/admin/templates/ ✅
    # ============================================

    @app.route('/delivery')
    def delivery_login_page():
        """Serve delivery boy login page"""
        try:
            possible_paths = [
                ('static/admin/templates', 'delivery-login.html'),
                ('static/admin', 'delivery-login.html'),
                ('static/delivery', 'delivery-login.html'),
                ('static', 'delivery-login.html'),
                ('templates', 'delivery-login.html'),
                ('.', 'delivery-login.html'),
            ]
            for directory, filename in possible_paths:
                try:
                    filepath = os.path.join(directory, filename)
                    if os.path.exists(filepath):
                        print(f"✅ Found delivery login at: {filepath}")
                        return send_from_directory(directory, filename)
                except:
                    continue
            return jsonify({'success': False, 'message': 'delivery-login.html not found'}), 404
        except Exception as e:
            return jsonify({'success': False, 'message': str(e)}), 500

    @app.route('/delivery/dashboard')
    def delivery_dashboard_page():
        """Serve delivery boy dashboard page"""
        try:
            possible_paths = [
                ('static/admin/templates', 'delivery-dashboard.html'),
                ('static/admin', 'delivery-dashboard.html'),
                ('static/delivery', 'delivery-dashboard.html'),
                ('static', 'delivery-dashboard.html'),
                ('templates', 'delivery-dashboard.html'),
                ('.', 'delivery-dashboard.html'),
            ]
            for directory, filename in possible_paths:
                try:
                    filepath = os.path.join(directory, filename)
                    if os.path.exists(filepath):
                        print(f"✅ Found delivery dashboard at: {filepath}")
                        return send_from_directory(directory, filename)
                except:
                    continue
            return jsonify({'success': False, 'message': 'delivery-dashboard.html not found'}), 404
        except Exception as e:
            return jsonify({'success': False, 'message': str(e)}), 500

    print("✅ Delivery pages configured: /delivery & /delivery/dashboard")

    # ============================================
    # ROOT ENDPOINT (UPDATED WITH ADMIN INFO)
    # ============================================
    @app.route('/')
    def root():
        """Serve frontend homepage"""
        frontend_dir = os.path.join(os.path.dirname(__file__), 'Frontend')
        return send_from_directory(frontend_dir, 'home-content.html')
    # ============================================
    # HEALTH CHECK ENDPOINT (ENHANCED)
    # ============================================
    
    @app.route('/health', methods=['GET'])
    def health_check():
        """Health check endpoint"""
        from database.db import get_db
        
        # Check database connection
        db_healthy = False
        try:
            db = get_db()
            if db.connection and db.connection.open:
                db_healthy = True
            else:
                db.connect()
                db_healthy = db.connection.open if db.connection else False
        except:
            db_healthy = False
        
        # Check Google OAuth configuration
        google_configured = bool(config.GOOGLE_CLIENT_ID and config.GOOGLE_CLIENT_SECRET)
        
        # Check if services tables exist
        services_tables_exist = False
        cart_table_exists = False
        reviews_table_exists = False
        orders_table_exists = False
        addresses_table_exists = False
        admin_tables_exist = False
        
        # Check upload folders exist
        upload_folders_exist = os.path.exists('uploads/profile_pictures')
        
        try:
            db = get_db()
            cursor = db.connection.cursor()
            
            # Check user tables
            cursor.execute("SHOW TABLES LIKE 'services'")
            if cursor.fetchone():
                services_tables_exist = True
            
            cursor.execute("SHOW TABLES LIKE 'cart'")
            if cursor.fetchone():
                cart_table_exists = True
            
            cursor.execute("SHOW TABLES LIKE 'reviews'")
            if cursor.fetchone():
                reviews_table_exists = True
            
            cursor.execute("SHOW TABLES LIKE 'orders'")
            if cursor.fetchone():
                orders_table_exists = True
            
            cursor.execute("SHOW TABLES LIKE 'user_addresses'")
            if cursor.fetchone():
                addresses_table_exists = True
            
            # Check admin tables
            cursor.execute("SHOW TABLES LIKE 'admin_settings'")
            if cursor.fetchone():
                admin_tables_exist = True
                
            cursor.close()
        except:
            pass
        
        status = {
            'status': 'healthy' if db_healthy else 'unhealthy',
            'database': 'connected' if db_healthy else 'disconnected',
            'google_oauth': 'configured' if google_configured else 'not configured',
            'services_api': 'enabled',
            'services_tables': 'exists' if services_tables_exist else 'missing',
            'cart_api': 'enabled',
            'cart_table': 'exists' if cart_table_exists else 'missing',
            'review_api': 'enabled',
            'review_table': 'exists' if reviews_table_exists else 'missing',
            'profile_api': 'enabled',
            'orders_table': 'exists' if orders_table_exists else 'missing',
            'addresses_table': 'exists' if addresses_table_exists else 'missing',
            'upload_folders': 'exists' if upload_folders_exist else 'missing',
            'admin_panel': 'enabled' if admin_tables_exist else 'not configured',
            'timestamp': APIResponse.success.__defaults__[0]
        }
        
        if db_healthy:
            return APIResponse.success(status, "Service is healthy")
        else:
            return APIResponse.error("Service is unhealthy", status, 503)
    
    # ============================================
    # API DOCUMENTATION ENDPOINT (ENHANCED)
    # ============================================
    
    @app.route('/api/docs', methods=['GET'])
    def api_docs():
        """API documentation endpoint"""
        docs = {
            'title': 'Quick Laundry API Documentation',
            'version': config.APP_VERSION,
            'base_url': request.host_url,
            'endpoints': {
                'authentication': {
                    'register': {
                        'method': 'POST',
                        'path': '/api/auth/register',
                        'description': 'Register new user account',
                        'body': {
                            'full_name': 'string (required)',
                            'email': 'string (required)',
                            'phone': 'string (required)',
                            'password': 'string (required)',
                            'address': 'string (required)',
                            'city': 'string (required)',
                            'pincode': 'string (required)',
                            'comm_email': 'boolean (optional)',
                            'comm_whatsapp': 'boolean (optional)',
                            'comm_phone': 'boolean (optional)'
                        }
                    },
                    'login': {
                        'method': 'POST',
                        'path': '/api/auth/login',
                        'description': 'Login with email and password',
                        'body': {
                            'email': 'string (required)',
                            'password': 'string (required)'
                        }
                    },
                    'google_login': {
                        'method': 'GET',
                        'path': '/api/auth/google/login',
                        'description': 'Initiate Google OAuth login',
                        'query_params': {
                            'return_url': 'string (optional, default: /home.html)'
                        }
                    },
                    'verify_otp': {
                        'method': 'POST',
                        'path': '/api/auth/verify-otp',
                        'description': 'Verify OTP code',
                        'body': {
                            'temp_user_id': 'string (required)',
                            'otp_code': 'string (required)'
                        }
                    },
                    'logout': {
                        'method': 'POST',
                        'path': '/api/auth/logout',
                        'description': 'Logout user',
                        'headers': {
                            'Authorization': 'Bearer <token>'
                        }
                    }
                },
                'google_oauth': {
                    'status': {
                        'method': 'GET',
                        'path': '/api/auth/google/status',
                        'description': 'Check Google OAuth availability'
                    },
                    'link': {
                        'method': 'POST',
                        'path': '/api/auth/google/link',
                        'description': 'Link Google account to existing user',
                        'headers': {
                            'Authorization': 'Bearer <token>'
                        }
                    }
                },
                'services': {
                    'get_all': {
                        'method': 'GET',
                        'path': '/api/services',
                        'description': 'Get all active services',
                        'query_params': {
                            'category': 'integer (optional) - Filter by category ID'
                        }
                    },
                    'get_by_id': {
                        'method': 'GET',
                        'path': '/api/services/<id>',
                        'description': 'Get service details by ID'
                    },
                    'get_featured': {
                        'method': 'GET',
                        'path': '/api/services/featured',
                        'description': 'Get featured services'
                    }
                },
                'categories': {
                    'get_all': {
                        'method': 'GET',
                        'path': '/api/categories',
                        'description': 'Get all categories with service count'
                    }
                },
                'cart': {
                    'add_to_cart': {
                        'method': 'POST',
                        'path': '/api/cart/add',
                        'description': 'Add item to cart',
                        'headers': {
                            'Authorization': 'Bearer <token>'
                        },
                        'body': {
                            'serviceId': 'integer (required)',
                            'serviceName': 'string (required)',
                            'quantity': 'integer (required)',
                            'unitPrice': 'decimal (required)',
                            'unit': 'string (required)',
                            'pickupDate': 'date (required, YYYY-MM-DD)',
                            'pickupTime': 'string (required)',
                            'pickupAddress': 'string (required)',
                            'specialInstructions': 'string (optional)'
                        }
                    },
                    'get_cart': {
                        'method': 'GET',
                        'path': '/api/cart',
                        'description': 'Get all cart items for current user',
                        'headers': {
                            'Authorization': 'Bearer <token>'
                        }
                    },
                    'remove_item': {
                        'method': 'DELETE',
                        'path': '/api/cart/<cart_id>',
                        'description': 'Remove item from cart',
                        'headers': {
                            'Authorization': 'Bearer <token>'
                        }
                    },
                    'update_item': {
                        'method': 'PUT',
                        'path': '/api/cart/<cart_id>',
                        'description': 'Update cart item quantity',
                        'headers': {
                            'Authorization': 'Bearer <token>'
                        },
                        'body': {
                            'quantity': 'integer (required)'
                        }
                    },
                    'get_status_history': {
                        'method': 'GET',
                        'path': '/api/cart/<cart_id>/status',
                        'description': 'Get status history for cart item',
                        'headers': {
                            'Authorization': 'Bearer <token>'
                        }
                    }
                },
                'reviews': {
                    'add_review': {
                        'method': 'POST',
                        'path': '/api/reviews/add',
                        'description': 'Add a review',
                        'headers': {
                            'Authorization': 'Bearer <token>'
                        },
                        'body': {
                            'rating': 'integer (required, 1-5)',
                            'review_text': 'string (required)',
                            'service_name': 'string (optional)'
                        }
                    },
                    'get_all_reviews': {
                        'method': 'GET',
                        'path': '/api/reviews',
                        'description': 'Get all reviews'
                    },
                    'get_user_reviews': {
                        'method': 'GET',
                        'path': '/api/reviews/user',
                        'description': 'Get reviews by current user',
                        'headers': {
                            'Authorization': 'Bearer <token>'
                        }
                    }
                },
                'profile': {
                    'get_profile': {
                        'method': 'GET',
                        'path': '/api/profile/',
                        'description': 'Get complete user profile data',
                        'headers': {
                            'Authorization': 'Bearer <token>'
                        }
                    },
                    'update_profile': {
                        'method': 'PUT',
                        'path': '/api/profile/update',
                        'description': 'Update personal information',
                        'headers': {
                            'Authorization': 'Bearer <token>'
                        },
                        'body': {
                            'full_name': 'string (optional)',
                            'phone': 'string (optional)',
                            'date_of_birth': 'date (optional)',
                            'gender': 'string (optional)'
                        }
                    },
                    'get_orders': {
                        'method': 'GET',
                        'path': '/api/profile/orders',
                        'description': 'Get user order history',
                        'headers': {
                            'Authorization': 'Bearer <token>'
                        },
                        'query_params': {
                            'status': 'string (optional) - all, pending, processing, completed, cancelled',
                            'limit': 'integer (optional, default: 20)',
                            'offset': 'integer (optional, default: 0)'
                        }
                    },
                    'get_addresses': {
                        'method': 'GET',
                        'path': '/api/profile/addresses',
                        'description': 'Get user saved addresses',
                        'headers': {
                            'Authorization': 'Bearer <token>'
                        }
                    },
                    'add_address': {
                        'method': 'POST',
                        'path': '/api/profile/addresses',
                        'description': 'Add new address',
                        'headers': {
                            'Authorization': 'Bearer <token>'
                        },
                        'body': {
                            'type': 'string (required) - home, work, other',
                            'name': 'string (required)',
                            'phone': 'string (required)',
                            'street': 'string (required)',
                            'city': 'string (required)',
                            'state': 'string (required)',
                            'zip': 'string (required)',
                            'landmark': 'string (optional)',
                            'isDefault': 'boolean (optional)'
                        }
                    },
                    'delete_address': {
                        'method': 'DELETE',
                        'path': '/api/profile/addresses/<address_id>',
                        'description': 'Delete an address',
                        'headers': {
                            'Authorization': 'Bearer <token>'
                        }
                    },
                    'update_preferences': {
                        'method': 'PUT',
                        'path': '/api/profile/preferences',
                        'description': 'Update user preferences',
                        'headers': {
                            'Authorization': 'Bearer <token>'
                        },
                        'body': {
                            'emailNotif': 'boolean (optional)',
                            'smsNotif': 'boolean (optional)',
                            'promoNotif': 'boolean (optional)',
                            'darkMode': 'boolean (optional)'
                        }
                    },
                    'upload_picture': {
                        'method': 'POST',
                        'path': '/api/profile/upload-picture',
                        'description': 'Upload profile picture',
                        'headers': {
                            'Authorization': 'Bearer <token>'
                        },
                        'content_type': 'multipart/form-data',
                        'body': {
                            'image': 'file (required)'
                        }
                    }
                },
                'uploads': {
                    'serve_file': {
                        'method': 'GET',
                        'path': '/uploads/<path:filename>',
                        'description': 'Serve uploaded files (profile pictures, documents)',
                        'example': '/uploads/profile_pictures/user_1_20260201_150000_photo.jpg'
                    }
                }
            },
            'authentication': {
                'type': 'Bearer Token (JWT)',
                'header': 'Authorization: Bearer <token>',
                'description': 'Include JWT token in Authorization header for protected routes'
            },
            'response_format': {
                'success': {
                    'success': True,
                    'message': 'string',
                    'data': 'object',
                    'timestamp': 'ISO datetime'
                },
                'error': {
                    'success': False,
                    'message': 'string',
                    'errors': 'object',
                    'timestamp': 'ISO datetime'
                }
            }
        }
        
        # Add admin documentation if admin routes are available
        try:
            from routes.admin_auth import admin_auth_bp
            docs['endpoints']['admin_authentication'] = {
                'login': {
                    'method': 'POST',
                    'path': '/api/admin/auth/login',
                    'description': 'Admin login with email and password'
                },
                'logout': {
                    'method': 'POST',
                    'path': '/api/admin/auth/logout',
                    'description': 'Admin logout'
                },
                'verify': {
                    'method': 'GET',
                    'path': '/api/admin/auth/verify',
                    'description': 'Verify admin authentication token'
                }
            }
            docs['endpoints']['admin_dashboard'] = {
                'stats': {
                    'method': 'GET',
                    'path': '/api/admin/dashboard/stats',
                    'description': 'Get dashboard statistics and analytics'
                }
            }
        except:
            pass
        
        return APIResponse.success(docs, "API Documentation")
    
    # ============================================
    # ERROR HANDLERS (UNCHANGED)
    # ============================================
    @app.route('/<path:path>')
    def serve_frontend(path):
        """Serve frontend static files"""
        frontend_dir = os.path.join(os.path.dirname(__file__), 'Frontend')
        full_path = os.path.join(frontend_dir, path)
        if os.path.exists(full_path):
            return send_from_directory(frontend_dir, path)
        # If file not found, return 404 JSON (don't serve index.html for missing API routes)
        return APIResponse.error("Resource not found", None, 404)
    @app.errorhandler(404)
    def not_found(error):
        """Handle 404 errors"""
        return APIResponse.error("The requested endpoint does not exist", None, 404)
    
    @app.errorhandler(405)
    def method_not_allowed(error):
        """Handle 405 errors"""
        return APIResponse.error("Method not allowed for this endpoint", None, 405)
    
    @app.errorhandler(500)
    def internal_error(error):
        """Handle 500 errors"""
        print(f"❌ Internal server error: {error}")
        return APIResponse.error("An internal server error occurred", None, 500)
    
    @app.errorhandler(Exception)
    def handle_exception(error):
        """Handle unexpected exceptions"""
        print(f"❌ Unhandled exception: {error}")
        import traceback
        traceback.print_exc()
        return APIResponse.error("An unexpected error occurred", None, 500)
    
    # ============================================
    # REQUEST LOGGING MIDDLEWARE (UNCHANGED)
    # ============================================
    
    @app.before_request
    def log_request():
        """Log incoming requests"""
        if request.path != '/health':  # Don't log health checks
            print(f"📥 {request.method} {request.path} - {request.remote_addr}")
    
    @app.after_request
    def after_request(response):
        """Add security headers to response"""
        response.headers['X-Content-Type-Options'] = 'nosniff'
        response.headers['X-Frame-Options'] = 'DENY'
        response.headers['X-XSS-Protection'] = '1; mode=block'
        return response
    
    # ============================================
    # SHUTDOWN HANDLER (UNCHANGED)
    # ============================================
    
    @app.teardown_appcontext
    def shutdown_session(exception=None):
        """Close database connection on shutdown"""
        if exception:
            print(f"⚠️ Teardown exception: {exception}")
        
        # Stop scheduler on shutdown
        try:
            stop_session_cleanup()
            print("✅ Session cleanup scheduler stopped")
        except Exception as e:
            print(f"⚠️ Error stopping scheduler: {e}")
    
    return app


# ============================================
# CREATE APP INSTANCE
# ============================================

app = create_app()


# ============================================
# RUN SERVER
# ============================================

if __name__ == '__main__':
    config = get_config()
    
    print("\n" + "=" * 70)
    print("🌐 Starting Flask server...")
    print("=" * 70)
    print(f"🔗 Server: http://{config.HOST}:{config.PORT}")
    print(f"📖 API Docs: http://{config.HOST}:{config.PORT}/api/docs")
    print(f"💚 Health Check: http://{config.HOST}:{config.PORT}/health")
    print(f"🛍️ Services API: http://{config.HOST}:{config.PORT}/api/services")
    print(f"📂 Categories API: http://{config.HOST}:{config.PORT}/api/categories")
    print(f"🛒 Cart API: http://{config.HOST}:{config.PORT}/api/cart")
    print(f"⭐ Reviews API: http://{config.HOST}:{config.PORT}/api/reviews")
    print(f"👤 Profile API: http://{config.HOST}:{config.PORT}/api/profile")
    print(f"📁 Uploads: http://{config.HOST}:{config.PORT}/uploads/*")
    
    if config.GOOGLE_CLIENT_ID:
        print(f"🔵 Google OAuth: http://{config.HOST}:{config.PORT}/api/auth/google/login")
    
    # Show admin endpoints if available
    try:
        from routes.admin_auth import admin_auth_bp
        print("\n" + "=" * 70)
        print("👑 ADMIN PANEL AVAILABLE:")
        print("=" * 70)
        print(f"🔐 Admin Login: http://{config.HOST}:{config.PORT}/admin")
        print(f"📊 Admin Dashboard: http://{config.HOST}:{config.PORT}/admin/dashboard")
        print(f"🔑 Admin API: http://{config.HOST}:{config.PORT}/api/admin/*")
    except:
        print("\n⚠️ Admin panel not configured (optional)")

    # Show delivery endpoints if available
    try:
        from routes.delivery_auth import delivery_auth_bp
        print("\n" + "=" * 70)
        print("🚴 DELIVERY BOY PORTAL AVAILABLE:")
        print("=" * 70)
        print(f"🔐 Delivery Login: http://{config.HOST}:{config.PORT}/delivery")
        print(f"📦 Delivery Dashboard: http://{config.HOST}:{config.PORT}/delivery/dashboard")
        print(f"🔑 Delivery API: http://{config.HOST}:{config.PORT}/api/delivery/*")
        print(f"👮 Admin Delivery API: http://{config.HOST}:{config.PORT}/api/admin/delivery/*")
    except:
        print("\n⚠️ Delivery module not configured (optional)")
    
    print("=" * 70)
    print("\n💡 Quick Test Commands:")
    print(f"   curl http://{config.HOST}:{config.PORT}/api/services")
    print(f"   curl http://{config.HOST}:{config.PORT}/api/categories")
    print(f"   curl http://{config.HOST}:{config.PORT}/api/cart")
    print(f"   curl http://{config.HOST}:{config.PORT}/api/reviews")
    print(f"   curl http://{config.HOST}:{config.PORT}/api/profile")
    print("=" * 70)
    print("\n🎉 Press CTRL+C to stop the server\n")
    
    try:
        # Run Flask app
        app.run(
            host=config.HOST,
            port=int(os.environ.get('PORT', config.PORT)),
            debug=config.DEBUG
        )
    except KeyboardInterrupt:
        print("\n\n🛑 Server shutting down...")
        stop_session_cleanup()
        print("✅ Cleanup completed. Goodbye!")
    except Exception as e:
        print(f"\n❌ Server error: {e}")
        stop_session_cleanup()