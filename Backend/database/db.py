"""
============================================
DATABASE CONNECTION MODULE
Thread-safe: each request gets its OWN connection.
Fixes: "Packet sequence number wrong" caused by shared singleton.
============================================
"""

import pymysql
import pymysql.cursors
import os
from urllib.parse import urlparse
from dotenv import load_dotenv

load_dotenv()


def _get_config():
    """Read DB config once."""
    database_url = os.getenv('DATABASE_URL')
    if database_url:
        parsed = urlparse(database_url)
        print(f"✅ Parsed DATABASE_URL: {parsed.hostname}:{parsed.port or 3306}/{parsed.path.lstrip('/')}")
        return {
            'host':     parsed.hostname,
            'port':     parsed.port or 3306,
            'user':     parsed.username,
            'password': parsed.password or '',
            'database': parsed.path.lstrip('/'),
        }
    return {
        'host':     os.getenv('DB_HOST', 'localhost'),
        'port':     int(os.getenv('DB_PORT', 3306)),
        'user':     os.getenv('DB_USER', 'root'),
        'password': os.getenv('DB_PASSWORD', ''),
        'database': os.getenv('DB_NAME', 'quick_laundry_db'),
    }

_CONFIG = _get_config()


class Database:
    """
    Wraps one freshly-opened pymysql connection.
    get_db() creates a NEW instance every call so concurrent
    requests NEVER share a socket — no more packet collisions.
    """

    def __init__(self):
        self.connection = pymysql.connect(
            host            = _CONFIG['host'],
            port            = _CONFIG['port'],
            user            = _CONFIG['user'],
            password        = _CONFIG['password'],
            database        = _CONFIG['database'],
            charset         = 'utf8mb4',
            cursorclass     = pymysql.cursors.DictCursor,
            autocommit      = False,
            connect_timeout = 10,
        )
        print(f"✅ Database connected: {_CONFIG['database']}")

    # ── cursor helper (routes use db.connection.cursor() directly) ───────────

    def _cursor(self):
        return self.connection.cursor(pymysql.cursors.DictCursor)

    # ── high-level helpers (used by some routes / middleware) ────────────────

    def fetch_one(self, query, params=None):
        with self._cursor() as cur:
            cur.execute(query, params or ())
            return cur.fetchone()

    def fetch_all(self, query, params=None):
        with self._cursor() as cur:
            cur.execute(query, params or ())
            return cur.fetchall()

    def execute_query(self, query, params=None):
        return self.fetch_all(query, params)

    def execute_update(self, query, params=None):
        with self._cursor() as cur:
            cur.execute(query, params or ())
            self.connection.commit()
            if query.strip().upper().startswith('INSERT'):
                return cur.lastrowid
            return cur.rowcount

    def execute_many(self, query, params_list):
        with self._cursor() as cur:
            cur.executemany(query, params_list)
            self.connection.commit()
            return cur.rowcount

    # ── cleanup ──────────────────────────────────────────────────────────────

    def disconnect(self):
        try:
            self.connection.close()
        except Exception:
            pass

    def ensure_connection(self):
        """Legacy compatibility — connection is always fresh so always True."""
        return self.connection.open

    def table_exists(self, table_name):
        result = self.fetch_one(
            """SELECT COUNT(*) as count FROM information_schema.tables
               WHERE table_schema = %s AND table_name = %s""",
            (_CONFIG['database'], table_name)
        )
        return result and result['count'] > 0

    def create_tables_if_not_exist(self):
        """Create database tables from schema.sql if it exists."""
        try:
            schema_path = os.path.join(os.path.dirname(__file__), 'schema.sql')
            if not os.path.exists(schema_path):
                print("⚠️ schema.sql file not found")
                return False

            with open(schema_path, 'r', encoding='utf-8') as f:
                schema = f.read()

            with self._cursor() as cur:
                for statement in schema.split(';'):
                    statement = statement.strip()
                    if statement and not statement.startswith('--'):
                        try:
                            cur.execute(statement)
                        except pymysql.Error as e:
                            if 'USE' not in statement.upper():
                                print(f"⚠️ Schema warning: {e}")

            self.connection.commit()
            print("✅ Database tables created/verified")
            return True

        except Exception as e:
            print(f"❌ Create tables error: {e}")
            try:
                self.connection.rollback()
            except Exception:
                pass
            return False


# ============================================
# PUBLIC API  — import these everywhere
# ============================================

def get_db() -> Database:
    """
    Returns a brand-new Database (= fresh MySQL connection) for THIS request.
    Never reuses a connection across requests — eliminates packet collisions.
    """
    return Database()


# ── Legacy shim ───────────────────────────────────────────────────────────────
# Many model files do:  from database.db import db
# This proxy object forwards every attribute access to a fresh connection,
# so those imports keep working without any code changes in models/.
class _LazyDBProxy:
    """
    Proxy that looks like the old singleton 'db' object but opens a
    fresh connection for every method call — thread-safe by design.

    Supports:
        db.fetch_one(...)
        db.fetch_all(...)
        db.execute_query(...)
        db.execute_update(...)
        db.execute_many(...)
        db.connection   ← returns the underlying pymysql connection
                          (caller must close it themselves)
    """

    def fetch_one(self, query, params=None):
        conn = Database()
        try:
            return conn.fetch_one(query, params)
        finally:
            conn.disconnect()

    def fetch_all(self, query, params=None):
        conn = Database()
        try:
            return conn.fetch_all(query, params)
        finally:
            conn.disconnect()

    def execute_query(self, query, params=None):
        return self.fetch_all(query, params)

    def execute_update(self, query, params=None):
        conn = Database()
        try:
            return conn.execute_update(query, params)
        finally:
            conn.disconnect()

    def execute_many(self, query, params_list):
        conn = Database()
        try:
            return conn.execute_many(query, params_list)
        finally:
            conn.disconnect()

    def connect(self):
        """No-op — connections are created on demand."""
        return True

    def disconnect(self):
        """No-op at proxy level."""
        pass

    def ensure_connection(self):
        return True

    # If a model grabs db.connection directly, give it a live connection.
    # WARNING: the caller is responsible for closing it via .close()
    @property
    def connection(self):
        return Database().connection


db = _LazyDBProxy()


def get_db_connection():
    """Alias kept for backward compatibility."""
    return get_db()


def close_db_connection():
    """Nothing global to close in the per-request model."""
    pass


def init_database():
    """Smoke-test: open one connection, optionally create tables, then close."""
    print("📄 Initializing database...")
    try:
        db = Database()
        db.create_tables_if_not_exist()
        db.disconnect()
        return True
    except Exception as e:
        print(f"❌ Failed to initialize database: {e}")
        return False


# ============================================
# TEST (python database/db.py)
# ============================================
if __name__ == "__main__":
    print("=" * 50)
    print("DATABASE CONNECTION TEST")
    print("=" * 50)
    if init_database():
        print("\n✅ Database initialized successfully!")
        db = get_db()
        result = db.fetch_one("SELECT COUNT(*) as count FROM users")
        if result:
            print(f"📊 Total users: {result['count']}")
        db.disconnect()
    else:
        print("\n❌ Database initialization failed!")