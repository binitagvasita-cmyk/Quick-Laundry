#!/usr/bin/env python3
"""
Quick Laundry - Reviews Diagnostic Script
This script checks why reviews aren't showing up in the admin panel
"""

import requests
import json

# Configuration
BASE_URL = "http://127.0.0.1:5000"
ADMIN_TOKEN = "YOUR_ADMIN_TOKEN_HERE"  # Replace with your actual admin token

print("=" * 70)
print("🔍 QUICK LAUNDRY - REVIEWS DIAGNOSTIC TOOL")
print("=" * 70)

# Test 1: Check if the API endpoint exists
print("\n📋 Test 1: Checking API endpoint availability...")
try:
    response = requests.get(f"{BASE_URL}/api/admin/reviews/stats", 
                           headers={"Authorization": f"Bearer {ADMIN_TOKEN}"},
                           timeout=5)
    print(f"   Status Code: {response.status_code}")
    print(f"   Response: {response.text[:200]}")
except requests.exceptions.ConnectionRefused:
    print("   ❌ ERROR: Server is not running at http://127.0.0.1:5000")
    print("   Please start your Flask server first!")
    exit(1)
except Exception as e:
    print(f"   ❌ ERROR: {e}")
    exit(1)

# Test 2: Check reviews list endpoint
print("\n📋 Test 2: Checking reviews list endpoint...")
try:
    response = requests.get(f"{BASE_URL}/api/admin/reviews",
                           headers={"Authorization": f"Bearer {ADMIN_TOKEN}"},
                           timeout=5)
    print(f"   Status Code: {response.status_code}")
    data = response.json()
    print(f"   Success: {data.get('success')}")
    if data.get('data'):
        print(f"   Reviews Count: {len(data['data'].get('reviews', []))}")
        print(f"   Pagination: {data['data'].get('pagination')}")
except Exception as e:
    print(f"   ❌ ERROR: {e}")

# Test 3: Direct database check (requires MySQL)
print("\n📋 Test 3: Database check suggestions...")
print("   Run these SQL commands in your MySQL client:")
print("   ")
print("   1. Check if reviews table exists:")
print("      USE quick_laundry_db;")
print("      SHOW TABLES LIKE 'reviews';")
print("   ")
print("   2. Count total reviews:")
print("      SELECT COUNT(*) as total FROM reviews;")
print("   ")
print("   3. Check review details:")
print("      SELECT review_id, user_id, rating, LEFT(review_text, 30) as text, ")
print("             is_approved, is_featured, created_at FROM reviews LIMIT 5;")
print("   ")
print("   4. Check if users exist:")
print("      SELECT r.review_id, r.rating, u.full_name, u.email ")
print("      FROM reviews r LEFT JOIN users u ON r.user_id = u.user_id LIMIT 5;")

# Test 4: Check frontend JavaScript console
print("\n📋 Test 4: Frontend debugging steps...")
print("   Open your browser's Developer Console (F12) and check:")
print("   ")
print("   1. Network tab - Look for these requests:")
print("      - GET /api/admin/reviews/stats")
print("      - GET /api/admin/reviews")
print("   ")
print("   2. Console tab - Look for JavaScript errors")
print("   ")
print("   3. Check if token is stored:")
print("      localStorage.getItem('adminToken')")
print("      localStorage.getItem('admin_token')")

print("\n" + "=" * 70)
print("🔧 COMMON ISSUES AND FIXES:")
print("=" * 70)

print("\n1️⃣  ISSUE: 'The requested endpoint does not exist' (404)")
print("   FIX: Make sure admin_reviews_bp is registered in app.py")
print("   Check app.py line 132: app.register_blueprint(admin_reviews_bp)")

print("\n2️⃣  ISSUE: 'Unauthorized' or 'Token expired' (401)")
print("   FIX: Login again to get a fresh admin token")
print("   Visit: http://127.0.0.1:5000/admin")

print("\n3️⃣  ISSUE: Reviews show 0 but database has data")
print("   FIX: Check SQL JOIN in admin_reviews.py:")
print("   - Line should be: INNER JOIN users u ON r.user_id = u.user_id")
print("   - Check if all reviews have valid user_id")

print("\n4️⃣  ISSUE: Frontend loads but shows empty")
print("   FIX: Check browser console (F12) for JavaScript errors")
print("   - API URL might be wrong")
print("   - Token might not be saved")

print("\n" + "=" * 70)
print("📝 MANUAL VERIFICATION STEPS:")
print("=" * 70)

print("\n✅ Step 1: Verify Flask server is running")
print("   Command: curl http://127.0.0.1:5000/health")

print("\n✅ Step 2: Test admin authentication")
print("   1. Login at: http://127.0.0.1:5000/admin")
print("   2. Open browser console (F12)")
print("   3. Run: localStorage.getItem('adminToken')")
print("   4. Copy the token")

print("\n✅ Step 3: Test API directly with curl")
print("   Replace YOUR_TOKEN with the token from Step 2:")
print('   curl -H "Authorization: Bearer YOUR_TOKEN" http://127.0.0.1:5000/api/admin/reviews/stats')

print("\n✅ Step 4: Check database directly")
print("   mysql -u root -p quick_laundry_db")
print("   SELECT COUNT(*) FROM reviews;")

print("\n" + "=" * 70)
print("Need the actual error? Run this script with a valid admin token!")
print("=" * 70 + "\n")