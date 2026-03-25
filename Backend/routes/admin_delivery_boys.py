"""
============================================================
QUICK LAUNDRY - ADMIN DELIVERY BOYS MANAGEMENT ROUTES
Fix: pymysql returns Decimal/datetime types that crash
     Flask's JSON serializer → added _safe() deep-converter.
FIX 2: Added phone-uniqueness check in create_delivery_boy.
FIX 3: Added IntegrityError catch so any DB unique violation
        returns a clean 409 instead of a raw 500.
============================================================

"""

from flask import Blueprint, request
from database.db import get_db
from utils.response import APIResponse
from routes.admin_auth import admin_required
import bcrypt
import pymysql.cursors
import decimal
import datetime
import pymysql          # ← needed for IntegrityError
import pymysql.cursors  # ← needed for DictCursor

admin_delivery_boys_bp = Blueprint(
    'admin_delivery_boys',
    __name__,
    url_prefix='/api/admin/delivery-boys'
)


# ─────────────────────────────────────────────────────────
# _safe() — deep-convert pymysql types to JSON-serializable
# ─────────────────────────────────────────────────────────
def _safe(obj):
    if isinstance(obj, dict):
        return {k: _safe(v) for k, v in obj.items()}
    if isinstance(obj, (list, tuple)):
        return [_safe(i) for i in obj]
    if isinstance(obj, decimal.Decimal):
        return int(obj) if obj == obj.to_integral_value() else float(obj)
    if isinstance(obj, (datetime.datetime, datetime.date)):
        return str(obj)
    return obj


# ─────────────────────────────────────────────────────────
# _run() — open fresh connection, run fn(cursor), always
#           commit/rollback and close properly
# ─────────────────────────────────────────────────────────
def _run(fn):
    db = get_db()
    cursor = db.connection.cursor(pymysql.cursors.DictCursor)
    try:
        result = fn(cursor)
        db.connection.commit()
        return result
    except Exception:
        try:
            db.connection.rollback()
        except Exception:
            pass
        raise
    finally:
        try:
            cursor.close()
        except Exception:
            pass
        try:
            db.disconnect()
        except Exception:
            pass


# ─────────────────────────────────────────────────────────
# GET /api/admin/delivery-boys/stats
# ─────────────────────────────────────────────────────────
@admin_delivery_boys_bp.route('/stats', methods=['GET'])
@admin_required
def get_stats(current_user):
    try:
        def _query(cursor):
            cursor.execute("""
                SELECT
                    COUNT(*)                                              AS total,
                    SUM(CASE WHEN is_active    = 1 THEN 1 ELSE 0 END)   AS active,
                    SUM(CASE WHEN is_available = 1
                              AND is_active    = 1 THEN 1 ELSE 0 END)   AS available,
                    COALESCE(SUM(total_delivered), 0)                    AS total_deliveries
                FROM delivery_boys
            """)
            return cursor.fetchone()

        row = _safe(_run(_query))
        return APIResponse.success({
            'total':            int(row['total']            or 0),
            'active':           int(row['active']           or 0),
            'available':        int(row['available']        or 0),
            'total_deliveries': int(row['total_deliveries'] or 0),
        }, 'Stats fetched')

    except Exception as e:
        print(f'❌ Delivery boys stats error: {e}')
        import traceback; traceback.print_exc()
        return APIResponse.error('Failed to fetch stats', None, 500)


# ─────────────────────────────────────────────────────────
# GET /api/admin/delivery-boys/list
# ─────────────────────────────────────────────────────────
@admin_delivery_boys_bp.route('/list', methods=['GET'])
@admin_required
def list_delivery_boys(current_user):
    try:
        page   = max(1, int(request.args.get('page',  1)))
        limit  = max(1, int(request.args.get('limit', 10)))
        search = request.args.get('search', '').strip()
        status = request.args.get('status', '')
        avail  = request.args.get('available', '')
        offset = (page - 1) * limit

        conditions, params = [], []

        if search:
            conditions.append(
                "(u.full_name LIKE %s OR u.email LIKE %s "
                "OR u.phone LIKE %s OR db2.vehicle_number LIKE %s)"
            )
            like = f'%{search}%'
            params += [like, like, like, like]

        if status == 'active':
            conditions.append('db2.is_active = 1')
        elif status == 'blocked':
            conditions.append('db2.is_active = 0')

        if avail == '1':
            conditions.append('db2.is_available = 1')
        elif avail == '0':
            conditions.append('db2.is_available = 0')

        where = ('WHERE ' + ' AND '.join(conditions)) if conditions else ''

        def _query(cursor):
            cursor.execute(
                f"SELECT COUNT(*) AS cnt FROM delivery_boys db2 "
                f"JOIN users u ON u.user_id = db2.user_id {where}",
                params
            )
            total = int(cursor.fetchone()['cnt'] or 0)

            cursor.execute(f"""
                SELECT
                    db2.delivery_id,
                    db2.vehicle_type,
                    db2.vehicle_number,
                    db2.is_active,
                    db2.is_available,
                    db2.total_delivered,
                    db2.joined_at,
                    u.user_id,
                    u.full_name,
                    u.email,
                    u.phone,
                    u.city,
                    u.address,
                    u.last_login
                FROM delivery_boys db2
                JOIN users u ON u.user_id = db2.user_id
                {where}
                ORDER BY db2.joined_at DESC
                LIMIT %s OFFSET %s
            """, params + [limit, offset])

            rows = _safe(cursor.fetchall())
            return {
                'delivery_boys': rows,
                'pagination': {
                    'total': total,
                    'page':  page,
                    'limit': limit,
                    'pages': max(1, (total + limit - 1) // limit),
                }
            }

        result = _run(_query)
        return APIResponse.success(result, 'Delivery boys fetched')

    except Exception as e:
        print(f'❌ List delivery boys error: {e}')
        import traceback; traceback.print_exc()
        return APIResponse.error('Failed to fetch delivery boys', None, 500)


# ─────────────────────────────────────────────────────────
# POST /api/admin/delivery-boys/create
# FIX: Added phone uniqueness check before INSERT.
#      Added IntegrityError catch for any other DB constraint.
# ─────────────────────────────────────────────────────────
@admin_delivery_boys_bp.route('/create', methods=['POST'])
@admin_required
def create_delivery_boy(current_user):
    try:
        body = request.get_json() or {}

        for field in ('full_name', 'email', 'phone', 'password'):
            if not str(body.get(field, '')).strip():
                return APIResponse.error(f'Field "{field}" is required', None, 400)

        password = body['password'].strip()
        if len(password) < 6:
            return APIResponse.error('Password must be at least 6 characters', None, 400)

        hashed = bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()

        # ── Normalize vehicle_type to lowercase (DB ENUM is lowercase) ──
        vehicle_type   = body.get('vehicle_type', 'bike').strip().lower()
        vehicle_number = body.get('vehicle_number', '').strip()
        city           = body.get('city', 'Ahmedabad').strip() or 'Ahmedabad'
        address        = body.get('address', '').strip() or ''

        # Validate vehicle_type against allowed ENUM values
        allowed_vehicles = ('bike', 'bicycle', 'scooter', 'other')
        if vehicle_type not in allowed_vehicles:
            vehicle_type = 'bike'

        def _query(cursor):
            # ── Check email uniqueness ──────────────────
            cursor.execute(
                'SELECT user_id FROM users WHERE email = %s',
                (body['email'].strip(),)
            )
            if cursor.fetchone():
                raise ValueError('EMAIL_EXISTS')

            # ── Check phone uniqueness ──────────────────
            cursor.execute(
                'SELECT user_id FROM users WHERE phone = %s',
                (body['phone'].strip(),)
            )
            if cursor.fetchone():
                raise ValueError('PHONE_EXISTS')

            # ── Insert user ─────────────────────────────
            cursor.execute("""
                INSERT INTO users
                  (full_name, email, phone, password_hash,
                   city, address, is_delivery_boy, is_active,
                   is_verified, email_verified, is_admin, created_at)
                VALUES (%s, %s, %s, %s, %s, %s, 1, 1, 1, 1, 0, NOW())
            """, (
                body['full_name'].strip(),
                body['email'].strip(),
                body['phone'].strip(),
                hashed,
                city,
                address,
            ))
            user_id = cursor.lastrowid

            # ── Insert delivery boy profile ─────────────
            cursor.execute("""
                INSERT INTO delivery_boys
                  (user_id, vehicle_type, vehicle_number,
                   is_active, is_available, total_delivered, joined_at)
                VALUES (%s, %s, %s, 1, 1, 0, NOW())
            """, (
                user_id,
                vehicle_type,
                vehicle_number,
            ))
            return {'user_id': user_id, 'delivery_id': cursor.lastrowid}

        try:
            result = _run(_query)
        except ValueError as ve:
            if str(ve) == 'EMAIL_EXISTS':
                return APIResponse.error('Email already in use', None, 409)
            if str(ve) == 'PHONE_EXISTS':
                return APIResponse.error('Phone number already in use', None, 409)
            raise
        except pymysql.err.IntegrityError as ie:
            # FIX: catch any remaining DB unique/FK violations gracefully
            print(f'❌ DB IntegrityError on create: {ie}')
            msg = str(ie)
            if 'email' in msg.lower():
                return APIResponse.error('Email already in use', None, 409)
            if 'phone' in msg.lower():
                return APIResponse.error('Phone number already in use', None, 409)
            return APIResponse.error('A record with these details already exists', None, 409)

        return APIResponse.success(result, 'Delivery boy created successfully')

    except Exception as e:
        print(f'❌ Create delivery boy error: {e}')
        import traceback; traceback.print_exc()
        return APIResponse.error('Failed to create delivery boy', None, 500)


# ─────────────────────────────────────────────────────────
# GET /api/admin/delivery-boys/<delivery_id>
# ─────────────────────────────────────────────────────────
@admin_delivery_boys_bp.route('/<int:delivery_id>', methods=['GET'])
@admin_required
def get_delivery_boy(current_user, delivery_id):
    try:
        def _query(cursor):
            cursor.execute("""
                SELECT
                    db2.delivery_id, db2.vehicle_type, db2.vehicle_number,
                    db2.is_active, db2.is_available, db2.total_delivered,
                    db2.joined_at,
                    u.user_id, u.full_name, u.email, u.phone,
                    u.city, u.address, u.last_login
                FROM delivery_boys db2
                JOIN users u ON u.user_id = db2.user_id
                WHERE db2.delivery_id = %s
            """, (delivery_id,))
            boy = cursor.fetchone()
            if not boy:
                raise ValueError('NOT_FOUND')

            boy = _safe(boy)

            cursor.execute("""
                SELECT
                    COUNT(*)  AS total_assigned,
                    SUM(CASE WHEN status NOT IN ('delivered','cancelled')
                             THEN 1 ELSE 0 END)            AS total_active,
                    SUM(CASE WHEN status = 'cancelled'
                             THEN 1 ELSE 0 END)            AS total_cancelled
                FROM orders
                WHERE delivery_boy_id = %s
            """, (boy['user_id'],))
            stats = _safe(cursor.fetchone()) or {}
            boy['order_statistics'] = {
                'total_assigned':  int(stats.get('total_assigned')  or 0),
                'total_active':    int(stats.get('total_active')    or 0),
                'total_cancelled': int(stats.get('total_cancelled') or 0),
            }
            return boy

        try:
            boy = _run(_query)
        except ValueError as ve:
            if str(ve) == 'NOT_FOUND':
                return APIResponse.error('Delivery boy not found', None, 404)
            raise

        return APIResponse.success(boy, 'Delivery boy fetched')

    except Exception as e:
        print(f'❌ Get delivery boy error: {e}')
        import traceback; traceback.print_exc()
        return APIResponse.error('Failed to fetch delivery boy', None, 500)


# ─────────────────────────────────────────────────────────
# PUT /api/admin/delivery-boys/<delivery_id>
# ─────────────────────────────────────────────────────────
@admin_delivery_boys_bp.route('/<int:delivery_id>', methods=['PUT'])
@admin_required
def update_delivery_boy(current_user, delivery_id):
    try:
        body = request.get_json() or {}

        def _query(cursor):
            cursor.execute(
                'SELECT user_id FROM delivery_boys WHERE delivery_id = %s',
                (delivery_id,)
            )
            row = cursor.fetchone()
            if not row:
                raise ValueError('NOT_FOUND')
            user_id = row['user_id']

            cursor.execute("""
                UPDATE users
                SET full_name=%s, phone=%s, city=%s, address=%s, updated_at=NOW()
                WHERE user_id=%s
            """, (
                body.get('full_name', '').strip(),
                body.get('phone', '').strip(),
                body.get('city', 'Ahmedabad').strip() or 'Ahmedabad',
                body.get('address', '').strip() or '',
                user_id,
            ))
            vtype = body.get('vehicle_type', 'bike').strip().lower()
            if vtype not in ('bike', 'bicycle', 'scooter', 'other'):
                vtype = 'bike'
            cursor.execute("""
                UPDATE delivery_boys
                SET vehicle_type=%s, vehicle_number=%s, updated_at=NOW()
                WHERE delivery_id=%s
            """, (
                vtype,
                body.get('vehicle_number', '').strip(),
                delivery_id,
            ))

        try:
            _run(_query)
        except ValueError as ve:
            if str(ve) == 'NOT_FOUND':
                return APIResponse.error('Delivery boy not found', None, 404)
            raise
        except pymysql.err.IntegrityError as ie:
            # FIX: phone already taken by another user on update
            print(f'❌ DB IntegrityError on update: {ie}')
            if 'phone' in str(ie).lower():
                return APIResponse.error('Phone number already in use by another user', None, 409)
            return APIResponse.error('Update failed: duplicate value', None, 409)

        return APIResponse.success(None, 'Delivery boy updated successfully')

    except Exception as e:
        print(f'❌ Update delivery boy error: {e}')
        import traceback; traceback.print_exc()
        return APIResponse.error('Failed to update delivery boy', None, 500)


# ─────────────────────────────────────────────────────────
# PUT /api/admin/delivery-boys/<delivery_id>/toggle-status
# ─────────────────────────────────────────────────────────
@admin_delivery_boys_bp.route('/<int:delivery_id>/toggle-status', methods=['PUT'])
@admin_required
def toggle_status(current_user, delivery_id):
    try:
        def _query(cursor):
            cursor.execute(
                'SELECT user_id, is_active FROM delivery_boys WHERE delivery_id = %s',
                (delivery_id,)
            )
            row = cursor.fetchone()
            if not row:
                raise ValueError('NOT_FOUND')

            new_active    = 0 if int(row['is_active']) else 1
            new_available = new_active

            cursor.execute("""
                UPDATE delivery_boys
                SET is_active=%s, is_available=%s, updated_at=NOW()
                WHERE delivery_id=%s
            """, (new_active, new_available, delivery_id))
            cursor.execute(
                'UPDATE users SET is_active=%s WHERE user_id=%s',
                (new_active, row['user_id'])
            )
            return new_active

        try:
            new_active = _run(_query)
        except ValueError as ve:
            if str(ve) == 'NOT_FOUND':
                return APIResponse.error('Delivery boy not found', None, 404)
            raise

        action = 'unblocked' if new_active else 'blocked'
        return APIResponse.success(
            {'action': action, 'is_active': bool(new_active)},
            f'Delivery boy {action} successfully'
        )

    except Exception as e:
        print(f'❌ Toggle status error: {e}')
        import traceback; traceback.print_exc()
        return APIResponse.error('Failed to toggle status', None, 500)


# ─────────────────────────────────────────────────────────
# PUT /api/admin/delivery-boys/<delivery_id>/change-password
# ─────────────────────────────────────────────────────────
@admin_delivery_boys_bp.route('/<int:delivery_id>/change-password', methods=['PUT'])
@admin_required
def change_password(current_user, delivery_id):
    try:
        body = request.get_json() or {}
        new_password = str(body.get('new_password', '')).strip()

        if len(new_password) < 6:
            return APIResponse.error('Password must be at least 6 characters', None, 400)

        hashed = bcrypt.hashpw(new_password.encode(), bcrypt.gensalt()).decode()

        def _query(cursor):
            cursor.execute(
                'SELECT user_id FROM delivery_boys WHERE delivery_id = %s',
                (delivery_id,)
            )
            row = cursor.fetchone()
            if not row:
                raise ValueError('NOT_FOUND')
            cursor.execute(
                'UPDATE users SET password_hash=%s WHERE user_id=%s',
                (hashed, row['user_id'])
            )

        try:
            _run(_query)
        except ValueError as ve:
            if str(ve) == 'NOT_FOUND':
                return APIResponse.error('Delivery boy not found', None, 404)
            raise

        return APIResponse.success(None, 'Password changed successfully')

    except Exception as e:
        print(f'❌ Change password error: {e}')
        import traceback; traceback.print_exc()
        return APIResponse.error('Failed to change password', None, 500)