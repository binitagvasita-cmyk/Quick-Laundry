"""
============================================
REVIEW ROUTES - PRODUCTION READY VERSION
100% Dynamic Data from Database - No Static Content
Complete review functionality with image upload support
FIX: Added missing pymysql import
============================================
"""

# ✅ CRITICAL FIX: Import pymysql at the top!
import pymysql

from flask import Blueprint, request, current_app
from werkzeug.utils import secure_filename
from middleware.auth_middleware import token_required, admin_required
from utils.response import APIResponse
from database.db import get_db
import traceback
import os
import cloudinary
import cloudinary.uploader

cloudinary.config(
    cloud_name = os.getenv('CLOUDINARY_CLOUD_NAME', 'didrdetea'),
    api_key    = os.getenv('CLOUDINARY_API_KEY', ''),
    api_secret = os.getenv('CLOUDINARY_API_SECRET', '')
)
import uuid
from datetime import datetime

review_bp = Blueprint('review', __name__)

# ============================================
# CONFIGURATION
# ============================================

# Allowed image extensions
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'webp'}
MAX_FILE_SIZE = 5 * 1024 * 1024  # 5MB
MAX_IMAGES = 5

def allowed_file(filename):
    """Check if file extension is allowed"""
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

# ============================================
# PUBLIC ROUTES - Get Reviews (Dynamic from DB)
# ============================================

@review_bp.route('/api/reviews', methods=['GET'])
def get_reviews():
    """
    Get all approved reviews with images (Public Route)
    100% Dynamic - Fetches real data from database
    """
    try:
        conn = get_db()
        cursor = conn.connection.cursor(pymysql.cursors.DictCursor)
        
        # Get only approved reviews with user information
        # This is 100% dynamic - pulls from database in real-time
        cursor.execute("""
            SELECT 
                r.review_id,
                r.rating,
                r.review_text,
                r.service_type,
                r.images,
                r.is_featured,
                r.like_count,
                r.created_at,
                u.full_name,
                u.email
            FROM reviews r
            JOIN users u ON r.user_id = u.user_id
            WHERE r.is_approved = TRUE
            ORDER BY r.is_featured DESC, r.created_at DESC
        """)
        
        reviews = cursor.fetchall()
        
        # Format response - parsing dynamic data
        formatted_reviews = []
        for review in reviews:
            # Parse images (stored as comma-separated string in DB)
            images = []
            if review['images']:
                images = [url.strip() for url in review['images'].split(',') if url.strip()]
            
            # Build dynamic review object
            formatted_reviews.append({
                'reviewId': review['review_id'],
                'rating': review['rating'],
                'reviewText': review['review_text'],
                'serviceType': review['service_type'],
                'isFeatured': bool(review['is_featured']),
                'userName': review['full_name'],
                'userEmail': review['email'],
                'likeCount': review['like_count'],
                'images': images,
                'createdAt': review['created_at'].isoformat()
            })
        
        cursor.close()

        
        print(f"✅ Retrieved {len(formatted_reviews)} approved reviews from database")
        
        return APIResponse.success(
            message=f'Retrieved {len(formatted_reviews)} reviews',
            data={'reviews': formatted_reviews}
        )
        
    except Exception as e:
        print(f"❌ Error fetching reviews: {str(e)}")
        print(traceback.format_exc())
        return APIResponse.error(
            message='Failed to fetch reviews',
            errors=str(e),
            status_code=500
        )


@review_bp.route('/api/reviews/stats', methods=['GET'])
def get_review_stats():
    """
    Get review statistics (Public Route)
    100% Dynamic - Calculated from real database data
    """
    try:
        conn = get_db()
        cursor = conn.connection.cursor(pymysql.cursors.DictCursor)
        
        # Calculate statistics dynamically from database
        # No hardcoded values - everything calculated in real-time
        cursor.execute("""
            SELECT 
                COUNT(*) as total_reviews,
                AVG(rating) as average_rating,
                SUM(CASE WHEN rating = 5 THEN 1 ELSE 0 END) as five_star,
                SUM(CASE WHEN rating = 4 THEN 1 ELSE 0 END) as four_star,
                SUM(CASE WHEN rating = 3 THEN 1 ELSE 0 END) as three_star,
                SUM(CASE WHEN rating = 2 THEN 1 ELSE 0 END) as two_star,
                SUM(CASE WHEN rating = 1 THEN 1 ELSE 0 END) as one_star
            FROM reviews
            WHERE is_approved = TRUE
        """)
        
        stats = cursor.fetchone()
        
        cursor.close()

        
        # Handle case when no reviews exist yet
        if not stats or stats['total_reviews'] == 0:
            return APIResponse.success(
                message='No reviews yet',
                data={
                    'totalReviews': 0,
                    'averageRating': 0,
                    'ratingDistribution': {
                        'fiveStar': 0,
                        'fourStar': 0,
                        'threeStar': 0,
                        'twoStar': 0,
                        'oneStar': 0
                    }
                }
            )
        
        # Build dynamic response from calculated stats
        response_data = {
            'totalReviews': stats['total_reviews'],
            'averageRating': round(float(stats['average_rating']), 1) if stats['average_rating'] else 0,
            'ratingDistribution': {
                'fiveStar': stats['five_star'],
                'fourStar': stats['four_star'],
                'threeStar': stats['three_star'],
                'twoStar': stats['two_star'],
                'oneStar': stats['one_star']
            }
        }
        
        print(f"✅ Review stats: {stats['total_reviews']} total, {response_data['averageRating']:.1f} avg")
        
        return APIResponse.success(
            message='Review statistics retrieved',
            data=response_data
        )
        
    except Exception as e:
        print(f"❌ Error fetching stats: {str(e)}")
        print(traceback.format_exc())
        return APIResponse.error(
            message='Failed to fetch review statistics',
            errors=str(e),
            status_code=500
        )


# ============================================
# USER ROUTES - Add, View, Delete Own Reviews
# ============================================

@review_bp.route('/api/reviews/add', methods=['POST'])
@token_required
def add_review(current_user):
    """
    Add new review with optional images (Authentication required)
    Stores review in database dynamically
    """
    try:
        # Get form data from request
        rating = request.form.get('rating')
        review_text = request.form.get('reviewText')
        service_type = request.form.get('serviceType', '')
        
        print(f"⭐ Adding review from user {current_user['user_id']}")
        print(f"   Rating: {rating}, Service: {service_type}")
        
        # Validate required fields
        if not rating or not review_text:
            return APIResponse.error(
                message='Rating and review text are required',
                status_code=400
            )
        
        rating = int(rating)
        
        # Validate rating range
        if rating < 1 or rating > 5:
            return APIResponse.error(
                message='Rating must be between 1 and 5',
                status_code=400
            )
        
        # Validate review text length
        if len(review_text) < 20:
            return APIResponse.error(
                message='Review must be at least 20 characters long',
                status_code=400
            )
        
        if len(review_text) > 1000:
            return APIResponse.error(
                message='Review must not exceed 1000 characters',
                status_code=400
            )
        
        # Handle image uploads dynamically
        image_urls = []
        if 'images' in request.files:
            files = request.files.getlist('images')
            
            # Limit number of images
            if len(files) > MAX_IMAGES:
                return APIResponse.error(
                    message=f'Maximum {MAX_IMAGES} images allowed',
                    status_code=400
                )
            
            # Create upload directory if it doesn't exist
            for file in files:
                if file and file.filename:
                    file.seek(0, os.SEEK_END)
                    file_size = file.tell()
                    file.seek(0)
                    if file_size > MAX_FILE_SIZE:
                        return APIResponse.error(
                            message=f'Image {file.filename} exceeds 5MB limit',
                            status_code=400
                        )
                    if allowed_file(file.filename):
                        upload_result = cloudinary.uploader.upload(
                            file,
                            folder="quicklaundry/reviews",
                            resource_type="image"
                        )
                        image_urls.append(upload_result['secure_url'])
                        print(f"   ✅ Uploaded to Cloudinary: {upload_result['secure_url']}")
                        
                        print(f"   ✅ Saved image: {file.filename}")
                    else:
                        return APIResponse.error(
                            message=f'Invalid file type for {file.filename}. Allowed: PNG, JPG, JPEG, WEBP',
                            status_code=400
                        )
        
        # Convert image URLs to comma-separated string for database
        images_json = ','.join(image_urls) if image_urls else None
        
        conn = get_db()
        cursor = conn.connection.cursor(pymysql.cursors.DictCursor)
        
        try:
            # Insert review into database (dynamic insertion)
            cursor.execute("""
                INSERT INTO reviews 
                (user_id, rating, review_text, service_type, images, created_at)
                VALUES (%s, %s, %s, %s, %s, NOW())
            """, (current_user['user_id'], rating, review_text, service_type, images_json))

            
            review_id = cursor.lastrowid
            conn.connection.commit()
            
            print(f"✅ Review added to database! Review ID: {review_id} with {len(image_urls)} images")
            
            return APIResponse.success(
                message='Thank you for your review! It will be published after approval.',
                data={
                    'reviewId': review_id, 
                    'imageCount': len(image_urls),
                    'status': 'pending_approval'
                }
            )
            
        except Exception as e:
            conn.rollback()
            # Clean up uploaded images if database insert fails
            for image_url in image_urls:
                try:
                    filepath = os.path.join(current_app.root_path, image_url.lstrip('/'))
                    if os.path.exists(filepath):
                        os.remove(filepath)
                        print(f"   🗑️ Cleaned up image: {image_url}")
                except:
                    pass
            raise e
        finally:
            cursor.close()

        
    except Exception as e:
        print(f"❌ Error adding review: {str(e)}")
        print(traceback.format_exc())
        return APIResponse.error(
            message='Failed to add review',
            errors=str(e),
            status_code=500
        )


@review_bp.route('/api/reviews/my-reviews', methods=['GET'])
@token_required
def get_my_reviews(current_user):
    """
    Get current user's reviews with images
    100% Dynamic - Fetches user-specific data from database
    """
    try:
        conn = get_db()
        cursor = conn.connection.cursor(pymysql.cursors.DictCursor)
        
        # Get reviews for the logged-in user (dynamic query)
        cursor.execute("""
            SELECT 
                review_id,
                rating,
                review_text,
                service_type,
                images,
                is_approved,
                is_featured,
                created_at,
                updated_at
            FROM reviews
            WHERE user_id = %s
            ORDER BY created_at DESC
        """, (current_user['user_id'],))
        
        reviews = cursor.fetchall()
        
        # Format response dynamically
        formatted_reviews = []
        for review in reviews:
            # Parse images
            images = []
            if review['images']:
                images = review['images'].split(',')
            
            formatted_reviews.append({
                'reviewId': review['review_id'],
                'rating': review['rating'],
                'reviewText': review['review_text'],
                'serviceType': review['service_type'],
                'images': images,
                'isApproved': bool(review['is_approved']),
                'isFeatured': bool(review['is_featured']),
                'createdAt': review['created_at'].isoformat(),
                'updatedAt': review['updated_at'].isoformat()
            })
        
        cursor.close()

        
        print(f"✅ Retrieved {len(formatted_reviews)} reviews for user {current_user['user_id']}")
        
        return APIResponse.success(
            message=f'Retrieved {len(formatted_reviews)} reviews',
            data={'reviews': formatted_reviews}
        )
        
    except Exception as e:
        print(f"❌ Error fetching user reviews: {str(e)}")
        print(traceback.format_exc())
        return APIResponse.error(
            message='Failed to fetch your reviews',
            errors=str(e),
            status_code=500
        )


@review_bp.route('/api/reviews/<int:review_id>', methods=['DELETE'])
@token_required
def delete_review(current_user, review_id):
    """
    Delete own review (User must own the review)
    Dynamically deletes from database and removes associated images
    """
    try:
        conn = get_db()
        cursor = conn.connection.cursor(pymysql.cursors.DictCursor)
        
        # Check ownership and get review details (dynamic check)
        cursor.execute("""
            SELECT * FROM reviews 
            WHERE review_id = %s AND user_id = %s
        """, (review_id, current_user['user_id']))
        
        review = cursor.fetchone()
        
        if not review:
            cursor.close()

            return APIResponse.error(
                message='Review not found or access denied',
                status_code=404
            )
        
        # Delete associated images from filesystem
        if review['images']:
            images = review['images'].split(',')
            for image_url in images:
                try:
                    filepath = os.path.join(current_app.root_path, image_url.lstrip('/'))
                    if os.path.exists(filepath):
                        os.remove(filepath)
                        print(f"   🗑️ Deleted image: {image_url}")
                except Exception as e:
                    print(f"   ⚠️ Could not delete image {image_url}: {str(e)}")
        
        # Delete review from database (dynamic deletion)
        cursor.execute("DELETE FROM reviews WHERE review_id = %s", (review_id,))
        conn.connection.commit()
        
        cursor.close()

        
        print(f"✅ Review deleted from database: {review_id}")
        
        return APIResponse.success(
            message='Review deleted successfully',
            data={'reviewId': review_id}
        )
        
    except Exception as e:
        print(f"❌ Error deleting review: {str(e)}")
        print(traceback.format_exc())
        return APIResponse.error(
            message='Failed to delete review',
            errors=str(e),
            status_code=500
        )


# ============================================
# ADMIN ROUTES - Manage All Reviews
# ============================================

@review_bp.route('/api/admin/reviews', methods=['GET'])
@token_required
@admin_required
def get_all_reviews_admin(current_user):
    """
    Get all reviews with images (Admin only)
    100% Dynamic - Fetches all reviews from database with filtering
    """
    try:
        conn = get_db()
        cursor = conn.connection.cursor(pymysql.cursors.DictCursor)
        
        # Get filter parameters from query string
        status = request.args.get('status')  # 'pending', 'approved', 'all'
        
        # Build dynamic query based on filter
        if status == 'pending':
            query = """
                SELECT 
                    r.*,
                    u.full_name,
                    u.email
                FROM reviews r
                JOIN users u ON r.user_id = u.user_id
                WHERE r.is_approved = FALSE
                ORDER BY r.created_at DESC
            """
        elif status == 'approved':
            query = """
                SELECT 
                    r.*,
                    u.full_name,
                    u.email
                FROM reviews r
                JOIN users u ON r.user_id = u.user_id
                WHERE r.is_approved = TRUE
                ORDER BY r.created_at DESC
            """
        else:
            # Get all reviews
            query = """
                SELECT 
                    r.*,
                    u.full_name,
                    u.email
                FROM reviews r
                JOIN users u ON r.user_id = u.user_id
                ORDER BY r.created_at DESC
            """
        
        cursor.execute(query)
        reviews = cursor.fetchall()
        
        # Format response dynamically
        formatted_reviews = []
        for review in reviews:
            # Parse images
            images = []
            if review['images']:
                images = review['images'].split(',')
            
            formatted_reviews.append({
                'reviewId': review['review_id'],
                'userId': review['user_id'],
                'userName': review['full_name'],
                'userEmail': review['email'],
                'rating': review['rating'],
                'reviewText': review['review_text'],
                'serviceType': review['service_type'],
                'images': images,
                'isApproved': bool(review['is_approved']),
                'isFeatured': bool(review['is_featured']),
                'likeCount': review['like_count'],
                'createdAt': review['created_at'].isoformat(),
                'updatedAt': review['updated_at'].isoformat()
            })
        
        cursor.close()

        
        print(f"✅ Admin retrieved {len(formatted_reviews)} reviews (filter: {status or 'all'})")
        
        return APIResponse.success(
            message=f'Retrieved {len(formatted_reviews)} reviews',
            data={'reviews': formatted_reviews}
        )
        
    except Exception as e:
        print(f"❌ Error fetching admin reviews: {str(e)}")
        print(traceback.format_exc())
        return APIResponse.error(
            message='Failed to fetch reviews',
            errors=str(e),
            status_code=500
        )


@review_bp.route('/api/admin/reviews/<int:review_id>/approve', methods=['PUT'])
@token_required
@admin_required
def approve_review(current_user, review_id):
    """
    Approve/reject/feature review (Admin only)
    Dynamically updates review status in database
    """
    try:
        data = request.get_json()
        
        is_approved = data.get('isApproved', False)
        is_featured = data.get('isFeatured', False)
        
        conn = get_db()
        cursor = conn.connection.cursor()
        
        # Check if review exists
        cursor.execute("SELECT review_id FROM reviews WHERE review_id = %s", (review_id,))
        if not cursor.fetchone():
            cursor.close()

            return APIResponse.error(
                message='Review not found',
                status_code=404
            )
        
        # Update review status dynamically in database
        cursor.execute("""
            UPDATE reviews 
            SET is_approved = %s, is_featured = %s, updated_at = NOW()
            WHERE review_id = %s
        """, (is_approved, is_featured, review_id))
        
        conn.connection.commit()
        cursor.close()

        
        status = "approved" if is_approved else "rejected"
        featured_text = " and featured" if is_featured else ""
        
        print(f"✅ Review {status}{featured_text}: {review_id}")
        
        return APIResponse.success(
            message=f'Review {status}{featured_text} successfully',
            data={
                'reviewId': review_id, 
                'isApproved': is_approved, 
                'isFeatured': is_featured
            }
        )
        
    except Exception as e:
        print(f"❌ Error updating review: {str(e)}")
        print(traceback.format_exc())
        return APIResponse.error(
            message='Failed to update review',
            errors=str(e),
            status_code=500
        )


@review_bp.route('/api/admin/reviews/<int:review_id>', methods=['DELETE'])
@token_required
@admin_required
def delete_review_admin(current_user, review_id):
    """
    Delete any review (Admin only)
    Dynamically deletes from database and removes associated images
    """
    try:
        conn = get_db()
        cursor = conn.connection.cursor(pymysql.cursors.DictCursor)
        
        # Get review details
        cursor.execute("SELECT * FROM reviews WHERE review_id = %s", (review_id,))
        review = cursor.fetchone()
        
        if not review:
            cursor.close()

            return APIResponse.error(
                message='Review not found',
                status_code=404
            )
        
        # Delete associated images from filesystem
        if review['images']:
            images = review['images'].split(',')
            for image_url in images:
                try:
                    filepath = os.path.join(current_app.root_path, image_url.lstrip('/'))
                    if os.path.exists(filepath):
                        os.remove(filepath)
                        print(f"   🗑️ Deleted image: {image_url}")
                except Exception as e:
                    print(f"   ⚠️ Could not delete image {image_url}: {str(e)}")
        
        # Delete review from database
        cursor.execute("DELETE FROM reviews WHERE review_id = %s", (review_id,))
        conn.connection.commit()
        
        cursor.close()

        
        print(f"✅ Admin deleted review from database: {review_id}")
        
        return APIResponse.success(
            message='Review deleted successfully',
            data={'reviewId': review_id}
        )
        
    except Exception as e:
        print(f"❌ Error deleting review: {str(e)}")
        print(traceback.format_exc())
        return APIResponse.error(
            message='Failed to delete review',
            errors=str(e),
            status_code=500
        )


# ============================================
# ROUTE INFORMATION
# ============================================

@review_bp.route('/api/reviews/info', methods=['GET'])
def review_routes_info():
    """
    Get information about available review routes
    """
    routes = {
        'public_routes': {
            'get_reviews': {
                'method': 'GET',
                'path': '/api/reviews',
                'auth': 'none',
                'description': 'Get all approved reviews with images (100% dynamic from database)'
            },
            'get_stats': {
                'method': 'GET',
                'path': '/api/reviews/stats',
                'auth': 'none',
                'description': 'Get review statistics (100% calculated from database)'
            }
        },
        'user_routes': {
            'add_review': {
                'method': 'POST',
                'path': '/api/reviews/add',
                'auth': 'required',
                'description': 'Add new review with images (saves to database)',
                'fields': {
                    'rating': 'integer (1-5) - required',
                    'reviewText': 'string (20-1000 chars) - required',
                    'serviceType': 'string - optional',
                    'images': 'file[] - optional (max 5 images, 5MB each)'
                }
            },
            'my_reviews': {
                'method': 'GET',
                'path': '/api/reviews/my-reviews',
                'auth': 'required',
                'description': 'Get your reviews (fetched from database)'
            },
            'delete_review': {
                'method': 'DELETE',
                'path': '/api/reviews/<review_id>',
                'auth': 'required',
                'description': 'Delete your review (removes from database and filesystem)'
            }
        },
        'admin_routes': {
            'get_all': {
                'method': 'GET',
                'path': '/api/admin/reviews',
                'auth': 'admin',
                'query_params': {
                    'status': 'pending | approved | all (optional)'
                },
                'description': 'Get all reviews (fetched from database with filters)'
            },
            'approve': {
                'method': 'PUT',
                'path': '/api/admin/reviews/<review_id>/approve',
                'auth': 'admin',
                'body': {
                    'isApproved': 'boolean',
                    'isFeatured': 'boolean'
                },
                'description': 'Approve/reject/feature review (updates database)'
            },
            'delete_admin': {
                'method': 'DELETE',
                'path': '/api/admin/reviews/<review_id>',
                'auth': 'admin',
                'description': 'Delete any review (removes from database and filesystem)'
            }
        },
        'note': 'All data is 100% dynamic from MySQL database - no static content'
    }
    
    return APIResponse.success(
        data=routes,
        message='Review routes information - All data fetched dynamically from database'
    )


# ============================================
# EXPORT BLUEPRINT
# ============================================

print("✅ Review routes loaded - 100% dynamic data from database - WITH pymysql FIX")