"""
============================================
ADMIN CUSTOMER MANAGEMENT ROUTES
============================================
"""

from flask import Blueprint

admin_customers_bp = Blueprint('admin_customers', __name__, url_prefix='/api/admin/customers')

# Routes will be implemented later