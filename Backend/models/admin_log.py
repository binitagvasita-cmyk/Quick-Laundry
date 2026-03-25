"""
============================================
ADMIN ACTIVITY LOG MODEL
Tracks all admin actions for audit trail
============================================
"""

from database.db import get_db
from datetime import datetime


class AdminActivityLog:
    """Model for admin activity logging"""
    
    @staticmethod
    def log_activity(admin_id, action_type, action_description, 
                    target_type=None, target_id=None, 
                    ip_address=None, user_agent=None):
        """
        Log an admin activity
        
        Args:
            admin_id (int): ID of the admin performing the action
            action_type (str): Type of action (e.g., 'order_updated', 'user_deleted')
            action_description (str): Human-readable description
            target_type (str): Type of target entity (e.g., 'order', 'user')
            target_id (int): ID of the target entity
            ip_address (str): IP address of the admin
            user_agent (str): User agent string
            
        Returns:
            int: Log ID if successful, None otherwise
        """
        try:
            db = get_db()
            
            query = """
                INSERT INTO admin_activity_logs 
                (admin_id, action_type, action_description, target_type, target_id, ip_address, user_agent)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
            """
            
            log_id = db.execute_update(
                query,
                (admin_id, action_type, action_description, target_type, target_id, ip_address, user_agent)
            )
            
            if log_id:
                print(f"✅ Activity logged: {action_type} - {action_description}")
                return log_id
            else:
                print(f"❌ Failed to log activity: {action_type}")
                return None
                
        except Exception as e:
            print(f"❌ Activity log error: {e}")
            import traceback
            traceback.print_exc()
            return None
    
    @staticmethod
    def get_logs(admin_id=None, action_type=None, limit=50, offset=0):
        """
        Get activity logs with optional filters
        
        Args:
            admin_id (int): Filter by admin ID
            action_type (str): Filter by action type
            limit (int): Number of logs to return
            offset (int): Offset for pagination
            
        Returns:
            list: List of log entries
        """
        try:
            db = get_db()
            
            query = """
                SELECT 
                    l.*,
                    u.full_name as admin_name,
                    u.email as admin_email
                FROM admin_activity_logs l
                LEFT JOIN users u ON l.admin_id = u.user_id
                WHERE 1=1
            """
            
            params = []
            
            if admin_id:
                query += " AND l.admin_id = %s"
                params.append(admin_id)
            
            if action_type:
                query += " AND l.action_type = %s"
                params.append(action_type)
            
            query += " ORDER BY l.created_at DESC LIMIT %s OFFSET %s"
            params.extend([limit, offset])
            
            logs = db.fetch_all(query, tuple(params))
            
            return logs or []
            
        except Exception as e:
            print(f"❌ Get logs error: {e}")
            return []
    
    @staticmethod
    def get_logs_by_target(target_type, target_id, limit=20):
        """
        Get activity logs for a specific target entity
        
        Args:
            target_type (str): Type of target (e.g., 'order', 'user')
            target_id (int): ID of the target
            limit (int): Number of logs to return
            
        Returns:
            list: List of log entries
        """
        try:
            db = get_db()
            
            query = """
                SELECT 
                    l.*,
                    u.full_name as admin_name,
                    u.email as admin_email
                FROM admin_activity_logs l
                LEFT JOIN users u ON l.admin_id = u.user_id
                WHERE l.target_type = %s AND l.target_id = %s
                ORDER BY l.created_at DESC
                LIMIT %s
            """
            
            logs = db.fetch_all(query, (target_type, target_id, limit))
            
            return logs or []
            
        except Exception as e:
            print(f"❌ Get target logs error: {e}")
            return []
    
    @staticmethod
    def get_recent_activities(hours=24, limit=50):
        """
        Get recent admin activities within specified hours
        
        Args:
            hours (int): Number of hours to look back
            limit (int): Number of logs to return
            
        Returns:
            list: List of recent log entries
        """
        try:
            db = get_db()
            
            query = """
                SELECT 
                    l.*,
                    u.full_name as admin_name,
                    u.email as admin_email
                FROM admin_activity_logs l
                LEFT JOIN users u ON l.admin_id = u.user_id
                WHERE l.created_at >= DATE_SUB(NOW(), INTERVAL %s HOUR)
                ORDER BY l.created_at DESC
                LIMIT %s
            """
            
            logs = db.fetch_all(query, (hours, limit))
            
            return logs or []
            
        except Exception as e:
            print(f"❌ Get recent activities error: {e}")
            return []
    
    @staticmethod
    def get_activity_stats(days=30):
        """
        Get activity statistics for the past N days
        
        Args:
            days (int): Number of days to analyze
            
        Returns:
            dict: Statistics dictionary
        """
        try:
            db = get_db()
            
            query = """
                SELECT 
                    action_type,
                    COUNT(*) as count,
                    DATE(created_at) as date
                FROM admin_activity_logs
                WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL %s DAY)
                GROUP BY action_type, DATE(created_at)
                ORDER BY date DESC, count DESC
            """
            
            results = db.fetch_all(query, (days,))
            
            # Get total activities
            total_query = """
                SELECT COUNT(*) as total
                FROM admin_activity_logs
                WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL %s DAY)
            """
            
            total_result = db.fetch_one(total_query, (days,))
            
            # Get unique admins
            admins_query = """
                SELECT COUNT(DISTINCT admin_id) as count
                FROM admin_activity_logs
                WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL %s DAY)
            """
            
            admins_result = db.fetch_one(admins_query, (days,))
            
            stats = {
                'total_activities': total_result['total'] if total_result else 0,
                'unique_admins': admins_result['count'] if admins_result else 0,
                'activity_breakdown': results or [],
                'period_days': days
            }
            
            return stats
            
        except Exception as e:
            print(f"❌ Get activity stats error: {e}")
            return {
                'total_activities': 0,
                'unique_admins': 0,
                'activity_breakdown': [],
                'period_days': days
            }


# ============================================
# HELPER FUNCTIONS
# ============================================

def log_admin_login(admin_id, ip_address=None, user_agent=None):
    """Helper to log admin login"""
    return AdminActivityLog.log_activity(
        admin_id=admin_id,
        action_type='admin_login',
        action_description='Admin logged in',
        ip_address=ip_address,
        user_agent=user_agent
    )


def log_admin_logout(admin_id, ip_address=None, user_agent=None):
    """Helper to log admin logout"""
    return AdminActivityLog.log_activity(
        admin_id=admin_id,
        action_type='admin_logout',
        action_description='Admin logged out',
        ip_address=ip_address,
        user_agent=user_agent
    )


def log_order_update(admin_id, order_id, action_description, ip_address=None, user_agent=None):
    """Helper to log order updates"""
    return AdminActivityLog.log_activity(
        admin_id=admin_id,
        action_type='order_updated',
        action_description=action_description,
        target_type='order',
        target_id=order_id,
        ip_address=ip_address,
        user_agent=user_agent
    )


def log_user_update(admin_id, user_id, action_description, ip_address=None, user_agent=None):
    """Helper to log user updates"""
    return AdminActivityLog.log_activity(
        admin_id=admin_id,
        action_type='user_updated',
        action_description=action_description,
        target_type='user',
        target_id=user_id,
        ip_address=ip_address,
        user_agent=user_agent
    )


# ============================================
# TEST FUNCTION
# ============================================

if __name__ == "__main__":
    print("=" * 50)
    print("ADMIN ACTIVITY LOG TEST")
    print("=" * 50)
    
    # Test logging an activity
    log_id = AdminActivityLog.log_activity(
        admin_id=1,
        action_type='test_action',
        action_description='This is a test activity log',
        target_type='test',
        target_id=123,
        ip_address='127.0.0.1',
        user_agent='Test Agent'
    )
    
    if log_id:
        print(f"✅ Test log created with ID: {log_id}")
    else:
        print("❌ Failed to create test log")
    
    # Test getting recent activities
    recent = AdminActivityLog.get_recent_activities(hours=24, limit=10)
    print(f"\n📊 Recent activities (last 24 hours): {len(recent)}")
    
    # Test getting stats
    stats = AdminActivityLog.get_activity_stats(days=30)
    print(f"\n📈 Activity stats (last 30 days):")
    print(f"   Total activities: {stats['total_activities']}")
    print(f"   Unique admins: {stats['unique_admins']}")