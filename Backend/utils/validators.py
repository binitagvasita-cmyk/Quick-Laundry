"""
============================================
INPUT VALIDATION MODULE
Validates user input data for registration and updates
============================================
"""

import re
from email_validator import validate_email, EmailNotValidError
from config import get_config

config = get_config()


class Validator:
    """Input validation utilities"""
    
    @staticmethod
    def validate_full_name(full_name):
        """
        Validate full name
        
        Args:
            full_name (str): User's full name
            
        Returns:
            tuple: (is_valid, error_message)
        """
        if not full_name or not full_name.strip():
            return False, "Full name is required"
        
        full_name = full_name.strip()
        
        if len(full_name) < 3:
            return False, "Full name must be at least 3 characters"
        
        if len(full_name) > 100:
            return False, "Full name must not exceed 100 characters"
        
        # Only letters and spaces allowed
        if not re.match(r'^[a-zA-Z\s]+$', full_name):
            return False, "Full name can only contain letters and spaces"
        
        return True, None
    
    @staticmethod
    def validate_email_address(email):
        """
        Validate email address
        
        Args:
            email (str): Email address
            
        Returns:
            tuple: (is_valid, error_message, normalized_email)
        """
        if not email or not email.strip():
            return False, "Email is required", None
        
        try:
            # Validate and normalize email
            valid = validate_email(email, check_deliverability=False)
            normalized_email = valid.normalized
            
            return True, None, normalized_email
            
        except EmailNotValidError as e:
            return False, str(e), None
    
    @staticmethod
    def validate_phone_number(phone):
        """
        Validate Indian phone number (10 digits starting with 6-9)
        
        Args:
            phone (str): Phone number
            
        Returns:
            tuple: (is_valid, error_message)
        """
        if not phone or not phone.strip():
            return False, "Phone number is required"
        
        phone = phone.strip()
        
        # Remove spaces, dashes, and parentheses
        phone_clean = re.sub(r'[\s\-\(\)]', '', phone)
        
        # Check if it's 10 digits
        if not re.match(r'^\d{10}$', phone_clean):
            return False, "Phone number must be 10 digits"
        
        # Indian mobile numbers start with 6, 7, 8, or 9
        if not phone_clean[0] in ['6', '7', '8', '9']:
            return False, "Phone number must start with 6, 7, 8, or 9"
        
        return True, None
    
    @staticmethod
    def validate_password(password):
        """
        Validate password strength
        
        Args:
            password (str): Password
            
        Returns:
            tuple: (is_valid, error_message)
        """
        if not password:
            return False, "Password is required"
        
        min_length = config.MIN_PASSWORD_LENGTH
        
        if len(password) < min_length:
            return False, f"Password must be at least {min_length} characters"
        
        if len(password) > 128:
            return False, "Password must not exceed 128 characters"
        
        # Check for uppercase
        if config.REQUIRE_UPPERCASE and not re.search(r'[A-Z]', password):
            return False, "Password must contain at least one uppercase letter"
        
        # Check for lowercase
        if config.REQUIRE_LOWERCASE and not re.search(r'[a-z]', password):
            return False, "Password must contain at least one lowercase letter"
        
        # Check for digit
        if config.REQUIRE_DIGIT and not re.search(r'\d', password):
            return False, "Password must contain at least one number"
        
        # Check for special character (optional)
        if config.REQUIRE_SPECIAL and not re.search(r'[!@#$%^&*(),.?":{}|<>]', password):
            return False, "Password must contain at least one special character"
        
        return True, None
    
    @staticmethod
    def validate_address(address):
        """
        Validate address
        
        Args:
            address (str): Full address
            
        Returns:
            tuple: (is_valid, error_message)
        """
        if not address or not address.strip():
            return False, "Address is required"
        
        address = address.strip()
        
        if len(address) < 10:
            return False, "Address must be at least 10 characters"
        
        if len(address) > 500:
            return False, "Address must not exceed 500 characters"
        
        return True, None
    
    @staticmethod
    def validate_city(city):
        """
        Validate city name
        
        Args:
            city (str): City name
            
        Returns:
            tuple: (is_valid, error_message)
        """
        if not city or not city.strip():
            return False, "City is required"
        
        city = city.strip()
        
        if len(city) < 2:
            return False, "City name must be at least 2 characters"
        
        if len(city) > 100:
            return False, "City name must not exceed 100 characters"
        
        # Only letters and spaces allowed
        if not re.match(r'^[a-zA-Z\s]+$', city):
            return False, "City name can only contain letters and spaces"
        
        return True, None
    
    @staticmethod
    def validate_pincode(pincode):
        """
        Validate Indian PIN code (6 digits)
        
        Args:
            pincode (str): PIN code
            
        Returns:
            tuple: (is_valid, error_message)
        """
        if not pincode or not pincode.strip():
            return False, "PIN code is required"
        
        pincode = pincode.strip()
        
        # Must be exactly 6 digits
        if not re.match(r'^\d{6}$', pincode):
            return False, "PIN code must be exactly 6 digits"
        
        return True, None
    
    @staticmethod
    def validate_otp(otp):
        """
        Validate OTP code
        
        Args:
            otp (str): OTP code
            
        Returns:
            tuple: (is_valid, error_message)
        """
        if not otp or not otp.strip():
            return False, "OTP is required"
        
        otp = otp.strip()
        
        otp_length = config.OTP_LENGTH
        
        if not re.match(rf'^\d{{{otp_length}}}$', otp):
            return False, f"OTP must be exactly {otp_length} digits"
        
        return True, None
    
    @staticmethod
    def validate_registration_data(data):
        """
        Validate complete registration data
        
        Args:
            data (dict): Registration data
            
        Returns:
            tuple: (is_valid, errors_dict)
        """
        errors = {}
        
        # Validate full name
        is_valid, error = Validator.validate_full_name(data.get('full_name', ''))
        if not is_valid:
            errors['full_name'] = error
        
        # Validate email
        is_valid, error, normalized = Validator.validate_email_address(data.get('email', ''))
        if not is_valid:
            errors['email'] = error
        else:
            # Update with normalized email
            data['email'] = normalized
        
        # Validate phone
        is_valid, error = Validator.validate_phone_number(data.get('phone', ''))
        if not is_valid:
            errors['phone'] = error
        
        # Validate password
        is_valid, error = Validator.validate_password(data.get('password', ''))
        if not is_valid:
            errors['password'] = error
        
        # Validate address
        is_valid, error = Validator.validate_address(data.get('address', ''))
        if not is_valid:
            errors['address'] = error
        
        # Validate city
        is_valid, error = Validator.validate_city(data.get('city', ''))
        if not is_valid:
            errors['city'] = error
        
        # Validate pincode
        is_valid, error = Validator.validate_pincode(data.get('pincode', ''))
        if not is_valid:
            errors['pincode'] = error
        
        # Return validation result
        if errors:
            return False, errors
        else:
            return True, None
    
    @staticmethod
    def sanitize_string(text):
        """
        Sanitize string input (remove dangerous characters)
        
        Args:
            text (str): Input text
            
        Returns:
            str: Sanitized text
        """
        if not text:
            return ""
        
        # Remove leading/trailing whitespace
        text = text.strip()
        
        # Remove null bytes
        text = text.replace('\x00', '')
        
        # Remove excessive whitespace
        text = ' '.join(text.split())
        
        return text
    
    @staticmethod
    def validate_profile_update(data):
        """
        Validate profile update data
        
        Args:
            data (dict): Update data
            
        Returns:
            tuple: (is_valid, errors_dict)
        """
        errors = {}
        
        # Only validate fields that are being updated
        if 'full_name' in data:
            is_valid, error = Validator.validate_full_name(data['full_name'])
            if not is_valid:
                errors['full_name'] = error
        
        if 'phone' in data:
            is_valid, error = Validator.validate_phone_number(data['phone'])
            if not is_valid:
                errors['phone'] = error
        
        if 'address' in data:
            is_valid, error = Validator.validate_address(data['address'])
            if not is_valid:
                errors['address'] = error
        
        if 'city' in data:
            is_valid, error = Validator.validate_city(data['city'])
            if not is_valid:
                errors['city'] = error
        
        if 'pincode' in data:
            is_valid, error = Validator.validate_pincode(data['pincode'])
            if not is_valid:
                errors['pincode'] = error
        
        if errors:
            return False, errors
        else:
            return True, None


# ============================================
# TEST VALIDATORS
# ============================================

if __name__ == "__main__":
    print("=" * 50)
    print("VALIDATORS TEST")
    print("=" * 50)
    
    # Test data
    test_data = {
        'full_name': 'John Doe',
        'email': 'john.doe@example.com',
        'phone': '9876543210',
        'password': 'Test@123',
        'address': '123 Main Street, Apartment 4B, Near Central Park',
        'city': 'Mumbai',
        'pincode': '400001'
    }
    
    print("\n📝 Testing registration data validation:")
    print(f"Data: {test_data}")
    
    is_valid, errors = Validator.validate_registration_data(test_data.copy())
    
    if is_valid:
        print("\n✅ All validation passed!")
    else:
        print(f"\n❌ Validation errors: {errors}")
    
    # Test individual validators
    print("\n" + "=" * 50)
    print("INDIVIDUAL VALIDATOR TESTS")
    print("=" * 50)
    
    # Test email
    print("\n📧 Email validation:")
    is_valid, error, normalized = Validator.validate_email_address("test@gmail.com")
    print(f"  Result: {is_valid}, Normalized: {normalized}, Error: {error}")
    
    # Test phone
    print("\n📱 Phone validation:")
    is_valid, error = Validator.validate_phone_number("9876543210")
    print(f"  Result: {is_valid}, Error: {error}")
    
    # Test password
    print("\n🔒 Password validation:")
    is_valid, error = Validator.validate_password("Test@123")
    print(f"  Result: {is_valid}, Error: {error}")
    
    # Test weak password
    print("\n🔒 Weak password validation:")
    is_valid, error = Validator.validate_password("123")
    print(f"  Result: {is_valid}, Error: {error}")
    
    print("\n" + "=" * 50)
    print("✅ Validator tests completed!")