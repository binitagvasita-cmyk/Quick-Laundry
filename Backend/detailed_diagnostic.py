"""
============================================
REVIEW SYSTEM - DETAILED ERROR DIAGNOSTIC
Find the exact issue preventing reviews from being stored
============================================
"""

import mysql.connector
from mysql.connector import Error
import requests
import json

# Database configuration
DB_CONFIG = {
    'host': 'localhost',
    'user': 'root',
    'password': '',  # Add your password if needed
    'database': 'quick_laundry_db'
}

API_BASE_URL = 'http://localhost:5000'

def test_database_connection():
    """Test basic database connectivity"""
    print("\n" + "=" * 70)
    print("TEST 1: DATABASE CONNECTION")
    print("=" * 70)
    
    try:
        conn = mysql.connector.connect(**DB_CONFIG)
        cursor = conn.cursor(dictionary=True)
        
        # Test basic query
        cursor.execute("SELECT 1 as test")
        result = cursor.fetchone()
        
        print("✅ Database connection: WORKING")
        print(f"   Host: {DB_CONFIG['host']}")
        print(f"   Database: {DB_CONFIG['database']}")
        
        cursor.close()
        conn.close()
        return True
        
    except Error as e:
        print(f"❌ Database connection: FAILED")
        print(f"   Error: {e}")
        return False

def test_reviews_table():
    """Check reviews table structure and data"""
    print("\n" + "=" * 70)
    print("TEST 2: REVIEWS TABLE")
    print("=" * 70)
    
    try:
        conn = mysql.connector.connect(**DB_CONFIG)
        cursor = conn.cursor(dictionary=True)
        
        # Check if table exists
        cursor.execute("SHOW TABLES LIKE 'reviews'")
        if not cursor.fetchone():
            print("❌ Reviews table: DOES NOT EXIST")
            cursor.close()
            conn.close()
            return False
        
        print("✅ Reviews table: EXISTS")
        
        # Get table structure
        cursor.execute("DESCRIBE reviews")
        columns = cursor.fetchall()
        
        print("\n📋 Table Columns:")
        required_columns = ['review_id', 'user_id', 'rating', 'review_text', 
                          'service_type', 'images', 'is_approved', 'is_featured', 
                          'like_count', 'created_at', 'updated_at']
        
        existing_columns = [col['Field'] for col in columns]
        
        for col_name in required_columns:
            if col_name in existing_columns:
                print(f"   ✅ {col_name}")
            else:
                print(f"   ❌ {col_name} - MISSING!")
        
        # Check foreign key
        cursor.execute("""
            SELECT * FROM information_schema.KEY_COLUMN_USAGE 
            WHERE TABLE_SCHEMA='quick_laundry_db' 
            AND TABLE_NAME='reviews' 
            AND REFERENCED_TABLE_NAME='users'
        """)
        fk = cursor.fetchone()
        
        if fk:
            print("✅ Foreign key to users table: EXISTS")
        else:
            print("⚠️ Foreign key to users table: MISSING")
        
        # Count existing reviews
        cursor.execute("SELECT COUNT(*) as total FROM reviews")
        count = cursor.fetchone()
        print(f"\n📊 Existing reviews: {count['total']}")
        
        # Check approved reviews
        cursor.execute("SELECT COUNT(*) as approved FROM reviews WHERE is_approved = 1")
        approved = cursor.fetchone()
        print(f"   Approved: {approved['approved']}")
        
        cursor.close()
        conn.close()
        return True
        
    except Error as e:
        print(f"❌ Error checking reviews table: {e}")
        return False

def test_user_exists():
    """Check if test user exists"""
    print("\n" + "=" * 70)
    print("TEST 3: USER EXISTENCE")
    print("=" * 70)
    
    try:
        conn = mysql.connector.connect(**DB_CONFIG)
        cursor = conn.cursor(dictionary=True)
        
        # Check user with ID 3 (commonly used in examples)
        cursor.execute("SELECT user_id, full_name, email FROM users WHERE user_id = 3")
        user = cursor.fetchone()
        
        if user:
            print(f"✅ User found:")
            print(f"   ID: {user['user_id']}")
            print(f"   Name: {user['full_name']}")
            print(f"   Email: {user['email']}")
            
            # Check if user has JWT token
            cursor.execute("""
                SELECT COUNT(*) as active_sessions 
                FROM user_sessions 
                WHERE user_id = %s AND is_active = 1
            """, (user['user_id'],))
            sessions = cursor.fetchone()
            print(f"   Active sessions: {sessions['active_sessions']}")
            
        else:
            print("⚠️ No user with ID 3 found")
            print("   Checking all users...")
            cursor.execute("SELECT user_id, full_name, email FROM users LIMIT 5")
            users = cursor.fetchall()
            for u in users:
                print(f"   User {u['user_id']}: {u['full_name']} ({u['email']})")
        
        cursor.close()
        conn.close()
        return True
        
    except Error as e:
        print(f"❌ Error checking users: {e}")
        return False

def test_flask_server():
    """Check if Flask server is running"""
    print("\n" + "=" * 70)
    print("TEST 4: FLASK SERVER")
    print("=" * 70)
    
    try:
        # Test health endpoint
        response = requests.get(f"{API_BASE_URL}/health", timeout=5)
        
        if response.status_code == 200:
            print("✅ Flask server: RUNNING")
            data = response.json()
            
            if 'data' in data:
                print(f"   Database: {data['data'].get('database', 'unknown')}")
                print(f"   Review table: {data['data'].get('review_table', 'unknown')}")
                print(f"   Review API: {data['data'].get('review_api', 'unknown')}")
            
            return True
        else:
            print(f"⚠️ Flask server responding but status: {response.status_code}")
            return False
            
    except requests.exceptions.ConnectionError:
        print("❌ Flask server: NOT RUNNING")
        print("   Please start the server: python app.py")
        return False
    except Exception as e:
        print(f"❌ Error connecting to Flask: {e}")
        return False

def test_review_api_endpoints():
    """Test review API endpoints"""
    print("\n" + "=" * 70)
    print("TEST 5: REVIEW API ENDPOINTS")
    print("=" * 70)
    
    # Test GET reviews
    try:
        response = requests.get(f"{API_BASE_URL}/api/reviews", timeout=5)
        print(f"\n📡 GET /api/reviews")
        print(f"   Status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            if data.get('success'):
                reviews = data.get('data', {}).get('reviews', [])
                print(f"   ✅ Reviews fetched: {len(reviews)} reviews")
                if len(reviews) > 0:
                    print(f"   Sample review: {reviews[0].get('reviewText', '')[:50]}...")
            else:
                print(f"   ❌ Response not successful: {data.get('message')}")
        else:
            print(f"   ❌ Failed with status {response.status_code}")
            print(f"   Response: {response.text[:200]}")
            
    except Exception as e:
        print(f"   ❌ Error: {e}")
    
    # Test GET stats
    try:
        response = requests.get(f"{API_BASE_URL}/api/reviews/stats", timeout=5)
        print(f"\n📡 GET /api/reviews/stats")
        print(f"   Status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            if data.get('success'):
                stats = data.get('data', {})
                print(f"   ✅ Stats fetched:")
                print(f"      Total: {stats.get('totalReviews', 0)}")
                print(f"      Average: {stats.get('averageRating', 0)}")
            else:
                print(f"   ❌ Response not successful: {data.get('message')}")
        else:
            print(f"   ❌ Failed with status {response.status_code}")
            
    except Exception as e:
        print(f"   ❌ Error: {e}")

def test_manual_insert():
    """Try to insert a test review directly into database"""
    print("\n" + "=" * 70)
    print("TEST 6: MANUAL DATABASE INSERT")
    print("=" * 70)
    
    try:
        conn = mysql.connector.connect(**DB_CONFIG)
        cursor = conn.cursor()
        
        # Try to insert a test review
        test_review = {
            'user_id': 3,
            'rating': 5,
            'review_text': 'Test review from diagnostic script',
            'service_type': 'Test Service',
            'is_approved': 1
        }
        
        cursor.execute("""
            INSERT INTO reviews 
            (user_id, rating, review_text, service_type, is_approved, created_at)
            VALUES (%s, %s, %s, %s, %s, NOW())
        """, (
            test_review['user_id'],
            test_review['rating'],
            test_review['review_text'],
            test_review['service_type'],
            test_review['is_approved']
        ))
        
        conn.commit()
        review_id = cursor.lastrowid
        
        print(f"✅ Direct insert: SUCCESS")
        print(f"   Review ID: {review_id}")
        print("   This proves the database and table structure are correct!")
        
        # Now delete the test review
        cursor.execute("DELETE FROM reviews WHERE review_id = %s", (review_id,))
        conn.commit()
        print("   Test review cleaned up")
        
        cursor.close()
        conn.close()
        return True
        
    except Error as e:
        print(f"❌ Direct insert: FAILED")
        print(f"   Error: {e}")
        print("   This indicates a table structure problem")
        return False

def check_flask_logs():
    """Instructions for checking Flask logs"""
    print("\n" + "=" * 70)
    print("TEST 7: CHECK FLASK SERVER LOGS")
    print("=" * 70)
    
    print("""
📋 To see the actual error, please:

1. Look at your Flask server terminal window
2. Try to submit a review from the frontend
3. Check for error messages in the Flask terminal
4. Look for lines like:
   ❌ Error adding review: ...
   or any Python traceback

Common errors to look for:
- Column name mismatches
- Data type errors
- Foreign key violations
- Missing fields in request
- File upload errors

Please share the EXACT error message from Flask terminal!
    """)

def test_api_with_token():
    """Test API with authentication token"""
    print("\n" + "=" * 70)
    print("TEST 8: AUTHENTICATED API CALL")
    print("=" * 70)
    
    try:
        # Get token from database
        conn = mysql.connector.connect(**DB_CONFIG)
        cursor = conn.cursor(dictionary=True)
        
        cursor.execute("""
            SELECT jwt_token FROM user_sessions 
            WHERE is_active = 1 
            ORDER BY created_at DESC 
            LIMIT 1
        """)
        
        session = cursor.fetchone()
        
        if not session:
            print("⚠️ No active session found in database")
            print("   Please login through the frontend first")
            cursor.close()
            conn.close()
            return False
        
        token = session['jwt_token']
        print(f"✅ Found active session token")
        print(f"   Token: {token[:50]}...")
        
        # Try to add a review with this token
        headers = {
            'Authorization': f'Bearer {token}',
            'Content-Type': 'application/json'
        }
        
        test_data = {
            'rating': 5,
            'reviewText': 'Test review from diagnostic script',
            'serviceType': 'Test Service'
        }
        
        print("\n📡 Attempting POST /api/reviews/add")
        response = requests.post(
            f"{API_BASE_URL}/api/reviews/add",
            headers=headers,
            json=test_data,
            timeout=10
        )
        
        print(f"   Status: {response.status_code}")
        print(f"   Response: {response.text[:500]}")
        
        if response.status_code == 200:
            print("   ✅ API call successful!")
            data = response.json()
            if data.get('success'):
                print(f"   Review ID: {data.get('data', {}).get('reviewId')}")
            return True
        else:
            print(f"   ❌ API call failed")
            return False
        
        cursor.close()
        conn.close()
        
    except Exception as e:
        print(f"❌ Error testing API: {e}")
        import traceback
        traceback.print_exc()
        return False

def main():
    """Run all diagnostic tests"""
    print("\n")
    print("╔" + "=" * 68 + "╗")
    print("║" + " " * 15 + "REVIEW SYSTEM - ERROR DIAGNOSTIC" + " " * 20 + "║")
    print("╚" + "=" * 68 + "╝")
    
    results = {
        'database': test_database_connection(),
        'reviews_table': test_reviews_table(),
        'user': test_user_exists(),
        'flask': test_flask_server(),
    }
    
    if results['flask']:
        test_review_api_endpoints()
    
    if results['database'] and results['reviews_table']:
        results['manual_insert'] = test_manual_insert()
    
    check_flask_logs()
    
    if results['flask'] and results['user']:
        test_api_with_token()
    
    # Summary
    print("\n" + "=" * 70)
    print("📊 DIAGNOSTIC SUMMARY")
    print("=" * 70)
    
    for test, result in results.items():
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{test.upper().replace('_', ' '):<20} {status}")
    
    print("\n" + "=" * 70)
    print("🔍 NEXT STEPS")
    print("=" * 70)
    
    if not results['database']:
        print("❌ FIX DATABASE CONNECTION FIRST")
        print("   - Check MySQL is running")
        print("   - Verify credentials in config")
    
    elif not results['reviews_table']:
        print("❌ CREATE REVIEWS TABLE")
        print("   - Run: create_reviews_table.sql")
    
    elif not results['flask']:
        print("❌ START FLASK SERVER")
        print("   - Run: python app.py")
    
    else:
        print("✅ All infrastructure checks passed!")
        print("\n📋 If reviews still don't save:")
        print("   1. Check Flask terminal for error messages")
        print("   2. Try submitting a review from frontend")
        print("   3. Share the EXACT error from Flask terminal")
        print("   4. Check browser console for errors")
        print("\n💡 The issue might be:")
        print("   - Form data not reaching backend correctly")
        print("   - File upload path issues")
        print("   - Token validation failing")
        print("   - CORS or request format issues")

if __name__ == "__main__":
    main()