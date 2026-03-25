"""
============================================
ADMIN REVIEW MANAGEMENT ROUTES
Comprehensive review management for admin panel
============================================
"""

from flask import Blueprint, request, jsonify
from database.db import get_db
from utils.auth_middleware import admin_required
from datetime import datetime
import pymysql.cursors

admin_services_bp = Blueprint('admin_services', __name__, url_prefix='/api/admin/services')
admin_reviews_bp = Blueprint('admin_reviews', __name__, url_prefix='/api/admin/reviews')


class APIResponse:
    @staticmethod
    def success(data=None, message="Success", status_code=200):
        response = {
            'success': True,
            'message': message,
            'timestamp': datetime.utcnow().isoformat()
        }
        if data is not None:
            response['data'] = data
        return jsonify(response), status_code
    
    @staticmethod
    def error(message, data=None, status_code=400):
        response = {
            'success': False,
            'message': message,
            'timestamp': datetime.utcnow().isoformat()
        }
        if data is not None:
            response['data'] = data
        return jsonify(response), status_code


# ============================================
# REVIEW ROUTES
# ============================================

@admin_reviews_bp.route('/list', methods=['GET', 'OPTIONS'])
@admin_required
def get_reviews_list(current_user):
    """Get all reviews with filtering and pagination"""
    if request.method == 'OPTIONS':
        return '', 204
    
    try:
        # Get query parameters
        page = int(request.args.get('page', 1))
        limit = int(request.args.get('limit', 10))
        search = request.args.get('search', '').strip()
        rating_filter = request.args.get('rating', '')  # 1-5 or empty
        status_filter = request.args.get('status', '')  # approved, pending, featured
        sort_by = request.args.get('sort', 'newest')  # newest, oldest, rating_high, rating_low, likes
        
        offset = (page - 1) * limit
        
        db = get_db()
        cursor = db.connection.cursor(pymysql.cursors.DictCursor)
        
        # Build query
        query = """
            SELECT 
                r.review_id,
                r.user_id,
                r.rating,
                r.review_text,
                r.service_type,
                r.like_count,
                r.is_approved,
                r.is_featured,
                r.created_at,
                r.updated_at,
                u.full_name as user_name,
                u.email as user_email,
                u.profile_picture
            FROM reviews r
            LEFT JOIN users u ON r.user_id = u.user_id
            WHERE 1=1
        """
        params = []
        
        # Search filter
        if search:
            query += " AND (r.review_text LIKE %s OR u.full_name LIKE %s OR u.email LIKE %s OR r.service_type LIKE %s)"
            search_term = f"%{search}%"
            params.extend([search_term, search_term, search_term, search_term])
        
        # Rating filter
        if rating_filter and rating_filter.isdigit():
            query += " AND r.rating = %s"
            params.append(int(rating_filter))
        
        # Status filter
        if status_filter == 'approved':
            query += " AND r.is_approved = 1"
        elif status_filter == 'pending':
            query += " AND r.is_approved = 0"
        elif status_filter == 'featured':
            query += " AND r.is_featured = 1"
        
        # Get total count before pagination
        count_query = f"SELECT COUNT(*) as total FROM ({query}) as filtered_reviews"
        cursor.execute(count_query, params)
        total = cursor.fetchone()['total']
        
        # Sorting
        if sort_by == 'oldest':
            query += " ORDER BY r.created_at ASC"
        elif sort_by == 'rating_high':
            query += " ORDER BY r.rating DESC, r.created_at DESC"
        elif sort_by == 'rating_low':
            query += " ORDER BY r.rating ASC, r.created_at DESC"
        elif sort_by == 'likes':
            query += " ORDER BY r.like_count DESC, r.created_at DESC"
        else:  # newest
            query += " ORDER BY r.created_at DESC"
        
        # Add pagination
        query += " LIMIT %s OFFSET %s"
        params.extend([limit, offset])
        
        cursor.execute(query, params)
        reviews = cursor.fetchall()
        
        # Get statistics
        cursor.execute("""
            SELECT 
                COUNT(*) as total_reviews,
                COUNT(CASE WHEN is_approved = 1 THEN 1 END) as approved_count,
                COUNT(CASE WHEN is_approved = 0 THEN 1 END) as pending_count,
                COUNT(CASE WHEN is_featured = 1 THEN 1 END) as featured_count,
                COALESCE(AVG(rating), 0) as average_rating,
                COUNT(CASE WHEN rating = 5 THEN 1 END) as five_star,
                COUNT(CASE WHEN rating = 4 THEN 1 END) as four_star,
                COUNT(CASE WHEN rating = 3 THEN 1 END) as three_star,
                COUNT(CASE WHEN rating = 2 THEN 1 END) as two_star,
                COUNT(CASE WHEN rating = 1 THEN 1 END) as one_star
            FROM reviews
        """)
        stats = cursor.fetchone()
        
        cursor.close()
        
        return APIResponse.success({
            'reviews': reviews,
            'pagination': {
                'page': page,
                'limit': limit,
                'total': total,
                'pages': (total + limit - 1) // limit
            },
            'statistics': stats
        }, 'Reviews retrieved successfully')
        
    except Exception as e:
        print(f"❌ Get reviews error: {e}")
        import traceback
        traceback.print_exc()
        return APIResponse.error('Failed to retrieve reviews', None, 500)


@admin_reviews_bp.route('/<int:review_id>', methods=['GET', 'OPTIONS'])
@admin_required
def get_review_details(current_user, review_id):
    """Get single review details"""
    if request.method == 'OPTIONS':
        return '', 204
    
    try:
        db = get_db()
        cursor = db.connection.cursor(pymysql.cursors.DictCursor)
        
        cursor.execute("""
            SELECT 
                r.*,
                u.full_name as user_name,
                u.email as user_email,
                u.phone as user_phone,
                u.profile_picture
            FROM reviews r
            LEFT JOIN users u ON r.user_id = u.user_id
            WHERE r.review_id = %s
        """, (review_id,))
        
        review = cursor.fetchone()
        cursor.close()
        
        if not review:
            return APIResponse.error('Review not found', None, 404)
        
        return APIResponse.success(review, 'Review details retrieved successfully')
        
    except Exception as e:
        print(f"❌ Get review details error: {e}")
        import traceback
        traceback.print_exc()
        return APIResponse.error('Failed to retrieve review details', None, 500)


@admin_reviews_bp.route('/<int:review_id>/approve', methods=['PUT', 'OPTIONS'])
@admin_required
def approve_review(current_user, review_id):
    """Approve a review"""
    if request.method == 'OPTIONS':
        return '', 204
    
    db = None
    cursor = None
    
    try:
        db = get_db()
        cursor = db.connection.cursor(pymysql.cursors.DictCursor)
        
        # Check if review exists
        cursor.execute("SELECT review_id, review_text FROM reviews WHERE review_id = %s", (review_id,))
        review = cursor.fetchone()
        
        if not review:
            if cursor:
                cursor.close()
            return APIResponse.error('Review not found', None, 404)
        
        # Update review approval status
        cursor.execute("""
            UPDATE reviews 
            SET is_approved = 1, updated_at = NOW()
            WHERE review_id = %s
        """, (review_id,))
        
        # Commit the main transaction
        db.connection.commit()
        
        # Try to log activity (non-critical, won't fail the main operation)
        try:
            cursor.execute("""
                INSERT INTO admin_activity_logs 
                (admin_id, action_type, action_description, ip_address)
                VALUES (%s, %s, %s, %s)
            """, (
                current_user.get('user_id'),
                'review_approve',
                f"Approved review ID: {review_id}",
                request.remote_addr
            ))
            db.connection.commit()
            print(f"✅ Activity logged: Review {review_id} approved by admin {current_user.get('user_id')}")
        except Exception as log_error:
            print(f"⚠️ Activity log failed (non-critical): {log_error}")
            # Rollback only the activity log, not the main operation
            db.connection.rollback()
        
        if cursor:
            cursor.close()
        
        return APIResponse.success({
            'review_id': review_id, 
            'is_approved': True
        }, 'Review approved successfully')
        
    except Exception as e:
        print(f"❌ Approve review error: {e}")
        import traceback
        traceback.print_exc()
        
        if db and db.connection:
            try:
                db.connection.rollback()
            except:
                pass
        
        if cursor:
            cursor.close()
            
        return APIResponse.error(f'Failed to approve review: {str(e)}', None, 500)


@admin_reviews_bp.route('/<int:review_id>/reject', methods=['PUT', 'OPTIONS'])
@admin_required
def reject_review(current_user, review_id):
    """Reject/unapprove a review"""
    if request.method == 'OPTIONS':
        return '', 204
    
    db = None
    cursor = None
    
    try:
        db = get_db()
        cursor = db.connection.cursor(pymysql.cursors.DictCursor)
        
        cursor.execute("SELECT review_id FROM reviews WHERE review_id = %s", (review_id,))
        review = cursor.fetchone()
        
        if not review:
            if cursor:
                cursor.close()
            return APIResponse.error('Review not found', None, 404)
        
        cursor.execute("""
            UPDATE reviews 
            SET is_approved = 0, updated_at = NOW()
            WHERE review_id = %s
        """, (review_id,))
        
        db.connection.commit()
        
        # Log activity (non-critical)
        try:
            cursor.execute("""
                INSERT INTO admin_activity_logs 
                (admin_id, action_type, action_description, ip_address)
                VALUES (%s, %s, %s, %s)
            """, (
                current_user.get('user_id'),
                'review_reject',
                f"Rejected review ID: {review_id}",
                request.remote_addr
            ))
            db.connection.commit()
        except Exception as log_error:
            print(f"⚠️ Activity log failed (non-critical): {log_error}")
            db.connection.rollback()
        
        if cursor:
            cursor.close()
        
        return APIResponse.success({
            'review_id': review_id, 
            'is_approved': False
        }, 'Review rejected successfully')
        
    except Exception as e:
        print(f"❌ Reject review error: {e}")
        import traceback
        traceback.print_exc()
        
        if db and db.connection:
            try:
                db.connection.rollback()
            except:
                pass
        
        if cursor:
            cursor.close()
            
        return APIResponse.error(f'Failed to reject review: {str(e)}', None, 500)


@admin_reviews_bp.route('/<int:review_id>/feature', methods=['PUT', 'OPTIONS'])
@admin_required
def toggle_feature_review(current_user, review_id):
    """Toggle review featured status"""
    if request.method == 'OPTIONS':
        return '', 204
    
    db = None
    cursor = None
    
    try:
        db = get_db()
        cursor = db.connection.cursor(pymysql.cursors.DictCursor)
        
        cursor.execute("SELECT is_featured FROM reviews WHERE review_id = %s", (review_id,))
        review = cursor.fetchone()
        
        if not review:
            if cursor:
                cursor.close()
            return APIResponse.error('Review not found', None, 404)
        
        new_status = not review['is_featured']
        
        cursor.execute("""
            UPDATE reviews 
            SET is_featured = %s, updated_at = NOW()
            WHERE review_id = %s
        """, (new_status, review_id))
        
        db.connection.commit()
        
        # Log activity (non-critical)
        try:
            action = 'featured' if new_status else 'unfeatured'
            cursor.execute("""
                INSERT INTO admin_activity_logs 
                (admin_id, action_type, action_description, ip_address)
                VALUES (%s, %s, %s, %s)
            """, (
                current_user.get('user_id'),
                'review_feature',
                f"{action.capitalize()} review ID: {review_id}",
                request.remote_addr
            ))
            db.connection.commit()
        except Exception as log_error:
            print(f"⚠️ Activity log failed (non-critical): {log_error}")
            db.connection.rollback()
        
        if cursor:
            cursor.close()
        
        return APIResponse.success({
            'review_id': review_id,
            'is_featured': new_status
        }, f'Review {"featured" if new_status else "unfeatured"} successfully')
        
    except Exception as e:
        print(f"❌ Toggle feature error: {e}")
        import traceback
        traceback.print_exc()
        
        if db and db.connection:
            try:
                db.connection.rollback()
            except:
                pass
        
        if cursor:
            cursor.close()
            
        return APIResponse.error(f'Failed to update review feature status: {str(e)}', None, 500)


@admin_reviews_bp.route('/<int:review_id>/delete', methods=['DELETE', 'OPTIONS'])
@admin_required
def delete_review(current_user, review_id):
    """Delete a review"""
    if request.method == 'OPTIONS':
        return '', 204
    
    db = None
    cursor = None
    
    try:
        db = get_db()
        cursor = db.connection.cursor(pymysql.cursors.DictCursor)
        
        cursor.execute("SELECT review_text FROM reviews WHERE review_id = %s", (review_id,))
        review = cursor.fetchone()
        
        if not review:
            if cursor:
                cursor.close()
            return APIResponse.error('Review not found', None, 404)
        
        cursor.execute("DELETE FROM reviews WHERE review_id = %s", (review_id,))
        db.connection.commit()
        
        # Log activity (non-critical)
        try:
            cursor.execute("""
                INSERT INTO admin_activity_logs 
                (admin_id, action_type, action_description, ip_address)
                VALUES (%s, %s, %s, %s)
            """, (
                current_user.get('user_id'),
                'review_delete',
                f"Deleted review ID: {review_id}",
                request.remote_addr
            ))
            db.connection.commit()
        except Exception as log_error:
            print(f"⚠️ Activity log failed (non-critical): {log_error}")
            db.connection.rollback()
        
        if cursor:
            cursor.close()
        
        return APIResponse.success(None, 'Review deleted successfully')
        
    except Exception as e:
        print(f"❌ Delete review error: {e}")
        import traceback
        traceback.print_exc()
        
        if db and db.connection:
            try:
                db.connection.rollback()
            except:
                pass
        
        if cursor:
            cursor.close()
            
        return APIResponse.error(f'Failed to delete review: {str(e)}', None, 500)


@admin_reviews_bp.route('/bulk-action', methods=['POST', 'OPTIONS'])
@admin_required
def bulk_action(current_user):
    """Perform bulk actions on reviews"""
    if request.method == 'OPTIONS':
        return '', 204
    
    db = None
    cursor = None
    
    try:
        data = request.get_json()
        action = data.get('action')  # approve, reject, delete, feature
        review_ids = data.get('review_ids', [])
        
        if not action or not review_ids:
            return APIResponse.error('Action and review IDs are required', None, 400)
        
        db = get_db()
        cursor = db.connection.cursor(pymysql.cursors.DictCursor)
        
        affected = 0
        
        if action == 'approve':
            for review_id in review_ids:
                cursor.execute("UPDATE reviews SET is_approved = 1, updated_at = NOW() WHERE review_id = %s", (review_id,))
                affected += cursor.rowcount
            message = f'{affected} reviews approved'
            
        elif action == 'reject':
            for review_id in review_ids:
                cursor.execute("UPDATE reviews SET is_approved = 0, updated_at = NOW() WHERE review_id = %s", (review_id,))
                affected += cursor.rowcount
            message = f'{affected} reviews rejected'
            
        elif action == 'feature':
            for review_id in review_ids:
                cursor.execute("UPDATE reviews SET is_featured = 1, updated_at = NOW() WHERE review_id = %s", (review_id,))
                affected += cursor.rowcount
            message = f'{affected} reviews featured'
            
        elif action == 'delete':
            for review_id in review_ids:
                cursor.execute("DELETE FROM reviews WHERE review_id = %s", (review_id,))
                affected += cursor.rowcount
            message = f'{affected} reviews deleted'
        else:
            if cursor:
                cursor.close()
            return APIResponse.error('Invalid action', None, 400)
        
        db.connection.commit()
        
        # Log activity (non-critical)
        try:
            cursor.execute("""
                INSERT INTO admin_activity_logs 
                (admin_id, action_type, action_description, ip_address)
                VALUES (%s, %s, %s, %s)
            """, (
                current_user.get('user_id'),
                f'review_bulk_{action}',
                f"Bulk {action}: {affected} reviews",
                request.remote_addr
            ))
            db.connection.commit()
        except Exception as log_error:
            print(f"⚠️ Activity log failed (non-critical): {log_error}")
            db.connection.rollback()
        
        if cursor:
            cursor.close()
        
        return APIResponse.success({'affected': affected}, message)
        
    except Exception as e:
        print(f"❌ Bulk action error: {e}")
        import traceback
        traceback.print_exc()
        
        if db and db.connection:
            try:
                db.connection.rollback()
            except:
                pass
        
        if cursor:
            cursor.close()
            
        return APIResponse.error(f'Failed to perform bulk action: {str(e)}', None, 500)