"""
============================================
ADMIN SETTINGS ROUTES
============================================
"""

from flask import Blueprint

admin_settings_bp = Blueprint('admin_settings', __name__, url_prefix='/api/admin/settings')

# Routes will be implemented later