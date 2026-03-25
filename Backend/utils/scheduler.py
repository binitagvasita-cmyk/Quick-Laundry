"""
============================================
BACKGROUND TASK SCHEDULER
Cleanup expired sessions automatically
============================================
"""

import threading
import time
from datetime import datetime


class SessionCleanupScheduler:
    """Background scheduler for cleaning expired sessions"""
    
    def __init__(self, interval_hours=1):
        """
        Initialize scheduler
        
        Args:
            interval_hours (int): Hours between cleanup runs
        """
        self.interval_hours = interval_hours
        self.interval_seconds = interval_hours * 3600
        self.running = False
        self.thread = None
    
    def cleanup_task(self):
        """Run the cleanup task"""
        from models.session import LoginSession
        
        while self.running:
            try:
                print(f"\n🧹 Running session cleanup at {datetime.utcnow()}")
                
                # Clean expired sessions
                cleaned = LoginSession.cleanup_expired_sessions()
                
                if cleaned > 0:
                    print(f"✅ Cleaned {cleaned} expired sessions")
                else:
                    print("✅ No expired sessions to clean")
                
                # Wait for next run
                time.sleep(self.interval_seconds)
                
            except Exception as e:
                print(f"❌ Cleanup task error: {e}")
                import traceback
                traceback.print_exc()
                
                # Wait before retrying
                time.sleep(60)
    
    def start(self):
        """Start the background scheduler"""
        if self.running:
            print("⚠️ Scheduler already running")
            return
        
        self.running = True
        self.thread = threading.Thread(target=self.cleanup_task, daemon=True)
        self.thread.start()
        
        print(f"✅ Session cleanup scheduler started (runs every {self.interval_hours} hour(s))")
    
    def stop(self):
        """Stop the background scheduler"""
        if not self.running:
            print("⚠️ Scheduler not running")
            return
        
        self.running = False
        if self.thread:
            self.thread.join(timeout=5)
        
        print("✅ Session cleanup scheduler stopped")


# ============================================
# GLOBAL SCHEDULER INSTANCE
# ============================================

session_scheduler = SessionCleanupScheduler(interval_hours=1)


# ============================================
# HELPER FUNCTIONS
# ============================================

def start_session_cleanup():
    """Start the session cleanup scheduler"""
    session_scheduler.start()


def stop_session_cleanup():
    """Stop the session cleanup scheduler"""
    session_scheduler.stop()


# ============================================
# MANUAL CLEANUP FUNCTION
# ============================================

def manual_cleanup():
    """Manually trigger session cleanup"""
    from models.session import LoginSession
    
    print("🧹 Running manual session cleanup...")
    cleaned = LoginSession.cleanup_expired_sessions()
    
    if cleaned > 0:
        print(f"✅ Cleaned {cleaned} expired sessions")
    else:
        print("✅ No expired sessions to clean")
    
    return cleaned


# ============================================
# TEST SCHEDULER
# ============================================

if __name__ == "__main__":
    from database.db import init_database
    
    print("=" * 50)
    print("SESSION CLEANUP SCHEDULER TEST")
    print("=" * 50)
    
    # Initialize database
    init_database()
    
    # Run manual cleanup
    print("\n🧹 Testing manual cleanup:")
    cleaned = manual_cleanup()
    print(f"Cleaned: {cleaned}")
    
    # Test scheduler (run for 10 seconds)
    print("\n⏰ Testing scheduler (will run for 10 seconds):")
    
    # Create test scheduler with short interval
    test_scheduler = SessionCleanupScheduler(interval_hours=0.001)  # Very short for testing
    test_scheduler.start()
    
    # Wait 10 seconds
    time.sleep(10)
    
    # Stop scheduler
    test_scheduler.stop()
    
    print("\n" + "=" * 50)
    print("✅ Scheduler test completed!")