"""
Backward-compatibility shim.
All real DB logic is in database/db.py (PyMySQL).
"""
from database.db import get_db, Database

def get_db_connection():
    """Returns a fresh Database instance (PyMySQL). Same as get_db()."""
    return get_db()

def test_connection():
    try:
        db = get_db()
        result = db.fetch_one("SELECT 1 as val")
        db.disconnect()
        return result is not None
    except Exception as e:
        print(f"❌ Connection test failed: {e}")
        return False