"""
============================================
API RESPONSE MODULE
Standardized API response helpers for Flask
============================================
"""

from flask import jsonify
from datetime import datetime


class APIResponse:
    """Standardized API response utilities"""
    
    @staticmethod
    def success(data=None, message="Success", status_code=200):
        """
        Success response
        
        Args:
            data: Response data
            message (str): Success message
            status_code (int): HTTP status code
            
        Returns:
            tuple: (response, status_code)
        """
        response = {
            'success': True,
            'message': message,
            'data': data,
            'timestamp': datetime.utcnow().isoformat()
        }
        
        return jsonify(response), status_code
    
    @staticmethod
    def error(message="An error occurred", errors=None, status_code=400):
        """
        Error response
        
        Args:
            message (str): Error message
            errors (dict): Detailed error information
            status_code (int): HTTP status code
            
        Returns:
            tuple: (response, status_code)
        """
        response = {
            'success': False,
            'message': message,
            'errors': errors,
            'timestamp': datetime.utcnow().isoformat()
        }
        
        return jsonify(response), status_code
    
    @staticmethod
    def created(data=None, message="Resource created successfully", status_code=201):
        """
        Resource created response
        
        Args:
            data: Created resource data
            message (str): Success message
            status_code (int): HTTP status code
            
        Returns:
            tuple: (response, status_code)
        """
        return APIResponse.success(data, message, status_code)
    
    @staticmethod
    def no_content(message="Operation successful"):
        """
        No content response (204)
        
        Args:
            message (str): Success message
            
        Returns:
            tuple: (response, status_code)
        """
        return '', 204
    
    @staticmethod
    def bad_request(message="Bad request", errors=None):
        """
        Bad request response (400)
        
        Args:
            message (str): Error message
            errors (dict): Validation errors
            
        Returns:
            tuple: (response, status_code)
        """
        return APIResponse.error(message, errors, 400)
    
    @staticmethod
    def unauthorized(message="Unauthorized access"):
        """
        Unauthorized response (401)
        
        Args:
            message (str): Error message
            
        Returns:
            tuple: (response, status_code)
        """
        return APIResponse.error(message, None, 401)
    
    @staticmethod
    def forbidden(message="Access forbidden"):
        """
        Forbidden response (403)
        
        Args:
            message (str): Error message
            
        Returns:
            tuple: (response, status_code)
        """
        return APIResponse.error(message, None, 403)
    
    @staticmethod
    def not_found(message="Resource not found"):
        """
        Not found response (404)
        
        Args:
            message (str): Error message
            
        Returns:
            tuple: (response, status_code)
        """
        return APIResponse.error(message, None, 404)
    
    @staticmethod
    def conflict(message="Resource already exists"):
        """
        Conflict response (409)
        
        Args:
            message (str): Error message
            
        Returns:
            tuple: (response, status_code)
        """
        return APIResponse.error(message, None, 409)
    
    @staticmethod
    def validation_error(errors, message="Validation failed"):
        """
        Validation error response (422)
        
        Args:
            errors (dict): Validation errors
            message (str): Error message
            
        Returns:
            tuple: (response, status_code)
        """
        return APIResponse.error(message, errors, 422)
    
    @staticmethod
    def internal_error(message="Internal server error"):
        """
        Internal server error response (500)
        
        Args:
            message (str): Error message
            
        Returns:
            tuple: (response, status_code)
        """
        return APIResponse.error(message, None, 500)
    
    @staticmethod
    def paginated_response(data, page, per_page, total_items, message="Success"):
        """
        Paginated response with metadata
        
        Args:
            data (list): Page data
            page (int): Current page number
            per_page (int): Items per page
            total_items (int): Total number of items
            message (str): Success message
            
        Returns:
            tuple: (response, status_code)
        """
        total_pages = (total_items + per_page - 1) // per_page
        
        response_data = {
            'items': data,
            'pagination': {
                'current_page': page,
                'per_page': per_page,
                'total_items': total_items,
                'total_pages': total_pages,
                'has_next': page < total_pages,
                'has_prev': page > 1
            }
        }
        
        return APIResponse.success(response_data, message, 200)
    
    @staticmethod
    def auth_response(token, user, message="Authentication successful"):
        """
        Authentication response with token
        
        Args:
            token (str): JWT token
            user (dict): User data
            message (str): Success message
            
        Returns:
            tuple: (response, status_code)
        """
        from utils.security import Security
        
        auth_data = Security.create_auth_response(user, token)
        
        return APIResponse.success(auth_data, message, 200)
    
    @staticmethod
    def otp_sent_response(masked_email=None, masked_phone=None):
        """
        OTP sent response
        
        Args:
            masked_email (str): Masked email
            masked_phone (str): Masked phone
            
        Returns:
            tuple: (response, status_code)
        """
        data = {
            'otp_sent': True,
            'masked_email': masked_email,
            'masked_phone': masked_phone,
            'expires_in_minutes': 5
        }
        
        return APIResponse.success(data, "OTP sent successfully", 200)
    
    @staticmethod
    def custom_response(success, message, data=None, status_code=200):
        """
        Custom response with flexible structure
        
        Args:
            success (bool): Success status
            message (str): Response message
            data: Response data
            status_code (int): HTTP status code
            
        Returns:
            tuple: (response, status_code)
        """
        response = {
            'success': success,
            'message': message,
            'data': data,
            'timestamp': datetime.utcnow().isoformat()
        }
        
        return jsonify(response), status_code


# ============================================
# RESPONSE DECORATORS (Optional)
# ============================================

def handle_exceptions(func):
    """
    Decorator to handle exceptions in route handlers
    
    Usage:
        @app.route('/api/endpoint')
        @handle_exceptions
        def endpoint():
            ...
    """
    from functools import wraps
    
    @wraps(func)
    def wrapper(*args, **kwargs):
        try:
            return func(*args, **kwargs)
        except ValueError as e:
            return APIResponse.bad_request(str(e))
        except PermissionError as e:
            return APIResponse.forbidden(str(e))
        except KeyError as e:
            return APIResponse.bad_request(f"Missing required field: {e}")
        except Exception as e:
            print(f"❌ Unexpected error: {e}")
            return APIResponse.internal_error("An unexpected error occurred")
    
    return wrapper


# ============================================
# RESPONSE BUILDERS (Helper Classes)
# ============================================

class ResponseBuilder:
    """Fluent API for building complex responses"""
    
    def __init__(self):
        self.response_data = {}
        self.status_code = 200
        self.success = True
        self.message = "Success"
    
    def set_success(self, success):
        """Set success status"""
        self.success = success
        return self
    
    def set_message(self, message):
        """Set response message"""
        self.message = message
        return self
    
    def set_data(self, data):
        """Set response data"""
        self.response_data = data
        return self
    
    def add_field(self, key, value):
        """Add field to response data"""
        self.response_data[key] = value
        return self
    
    def set_status(self, status_code):
        """Set HTTP status code"""
        self.status_code = status_code
        return self
    
    def build(self):
        """Build and return response"""
        if self.success:
            return APIResponse.success(self.response_data, self.message, self.status_code)
        else:
            return APIResponse.error(self.message, self.response_data, self.status_code)


# ============================================
# ERROR MESSAGE CONSTANTS
# ============================================

class ErrorMessages:
    """Common error messages"""
    
    # Authentication
    INVALID_CREDENTIALS = "Invalid email or password"
    TOKEN_EXPIRED = "Token has expired"
    TOKEN_INVALID = "Invalid or malformed token"
    UNAUTHORIZED = "You must be logged in to access this resource"
    
    # Validation
    VALIDATION_ERROR = "Please check your input and try again"
    EMAIL_REQUIRED = "Email address is required"
    PASSWORD_REQUIRED = "Password is required"
    INVALID_EMAIL = "Please enter a valid email address"
    WEAK_PASSWORD = "Password does not meet security requirements"
    
    # Resources
    USER_NOT_FOUND = "User not found"
    RESOURCE_NOT_FOUND = "Requested resource not found"
    EMAIL_EXISTS = "Email address is already registered"
    PHONE_EXISTS = "Phone number is already registered"
    
    # OTP
    OTP_INVALID = "Invalid or expired OTP"
    OTP_EXPIRED = "OTP has expired. Please request a new one"
    OTP_REQUIRED = "OTP code is required"
    
    # Server
    SERVER_ERROR = "An internal server error occurred"
    DATABASE_ERROR = "Database operation failed"
    
    # Operations
    UPDATE_FAILED = "Failed to update resource"
    DELETE_FAILED = "Failed to delete resource"
    CREATE_FAILED = "Failed to create resource"


class SuccessMessages:
    """Common success messages"""
    
    # Authentication
    LOGIN_SUCCESS = "Login successful"
    LOGOUT_SUCCESS = "Logged out successfully"
    REGISTRATION_SUCCESS = "Account created successfully"
    
    # OTP
    OTP_SENT = "OTP sent successfully"
    OTP_VERIFIED = "OTP verified successfully"
    
    # Profile
    PROFILE_UPDATED = "Profile updated successfully"
    PASSWORD_UPDATED = "Password updated successfully"
    EMAIL_VERIFIED = "Email verified successfully"
    PHONE_VERIFIED = "Phone verified successfully"
    
    # Resources
    CREATED = "Resource created successfully"
    UPDATED = "Resource updated successfully"
    DELETED = "Resource deleted successfully"


# ============================================
# TEST RESPONSE MODULE
# ============================================

if __name__ == "__main__":
    print("=" * 50)
    print("API RESPONSE MODULE TEST")
    print("=" * 50)
    
    # Test success response
    print("\n✅ Testing success response:")
    response, status = APIResponse.success({'user_id': 1}, "User fetched")
    print(f"Status: {status}, Response: {response.json}")
    
    # Test error response
    print("\n❌ Testing error response:")
    response, status = APIResponse.error("Something went wrong", {'field': 'error'})
    print(f"Status: {status}, Response: {response.json}")
    
    # Test validation error
    print("\n📝 Testing validation error:")
    errors = {'email': 'Invalid email', 'password': 'Too weak'}
    response, status = APIResponse.validation_error(errors)
    print(f"Status: {status}, Response: {response.json}")
    
    # Test paginated response
    print("\n📄 Testing paginated response:")
    items = [{'id': 1}, {'id': 2}, {'id': 3}]
    response, status = APIResponse.paginated_response(items, 1, 10, 50)
    print(f"Status: {status}, Response: {response.json}")
    
    # Test response builder
    print("\n🔨 Testing response builder:")
    builder_response = (ResponseBuilder()
        .set_message("Custom message")
        .add_field('custom_field', 'custom_value')
        .set_status(200)
        .build())
    print(f"Builder response: {builder_response[0].json}")
    
    # Test error messages
    print("\n📋 Testing error messages:")
    print(f"Invalid credentials: {ErrorMessages.INVALID_CREDENTIALS}")
    print(f"Login success: {SuccessMessages.LOGIN_SUCCESS}")
    
    print("\n" + "=" * 50)
    print("✅ Response module tests completed!")