-- ============================================
-- QUICK LAUNDRY DATABASE SCHEMA
-- MySQL Database for User Registration
-- ============================================

-- Create Database (if not exists)
CREATE DATABASE IF NOT EXISTS quick_laundry_db 
CHARACTER SET utf8mb4 
COLLATE utf8mb4_unicode_ci;

USE quick_laundry_db;

-- ============================================
-- USERS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS users (
    -- Primary Key
    user_id INT AUTO_INCREMENT PRIMARY KEY,
    
    -- Account Information (from Step 1)
    full_name VARCHAR(100) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    phone VARCHAR(15) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    
    -- Address Information (from Step 2)
    address TEXT NOT NULL,
    city VARCHAR(100) NOT NULL,
    pincode VARCHAR(6) NOT NULL,
    
    -- Communication Preferences (from Step 3)
    comm_email BOOLEAN DEFAULT TRUE,
    comm_whatsapp BOOLEAN DEFAULT FALSE,
    comm_phone BOOLEAN DEFAULT FALSE,
    
    -- Account Status
    is_active BOOLEAN DEFAULT TRUE,
    is_verified BOOLEAN DEFAULT FALSE,
    email_verified BOOLEAN DEFAULT FALSE,
    phone_verified BOOLEAN DEFAULT FALSE,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    last_login TIMESTAMP NULL,
    
    -- Indexes for Performance
    INDEX idx_email (email),
    INDEX idx_phone (phone),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- OTP VERIFICATION TABLE (for email/phone verification)
-- ============================================
CREATE TABLE IF NOT EXISTS otp_verifications (
    otp_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    otp_code VARCHAR(6) NOT NULL,
    otp_type ENUM('email', 'phone', 'registration') NOT NULL,
    is_used BOOLEAN DEFAULT FALSE,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Foreign Key
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    
    -- Index
    INDEX idx_user_otp (user_id, otp_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- PASSWORD RESET TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS password_resets (
    reset_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    reset_token VARCHAR(255) NOT NULL UNIQUE,
    is_used BOOLEAN DEFAULT FALSE,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Foreign Key
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    
    -- Index
    INDEX idx_reset_token (reset_token)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- USER SESSIONS TABLE (Optional - for JWT tracking)
-- ============================================
CREATE TABLE IF NOT EXISTS user_sessions (
    session_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    jwt_token TEXT NOT NULL,
    device_info VARCHAR(255),
    ip_address VARCHAR(45),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NOT NULL,
    
    -- Foreign Key
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    
    -- Index
    INDEX idx_user_session (user_id, is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- INSERT SAMPLE DATA (for testing)
-- ============================================
-- Sample User 1
INSERT INTO users (
    full_name, email, phone, password_hash, 
    address, city, pincode,
    comm_email, comm_whatsapp, comm_phone,
    is_verified, email_verified
) VALUES (
    'John Doe',
    'john@example.com',
    '9876543210',
    '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5uW3MuJXFSqcy', -- password: Test@123
    '123 Main Street, Apartment 4B',
    'Mumbai',
    '400001',
    TRUE,
    TRUE,
    FALSE,
    TRUE,
    TRUE
);

-- Sample User 2
INSERT INTO users (
    full_name, email, phone, password_hash,
    address, city, pincode,
    comm_email, comm_whatsapp, comm_phone
) VALUES (
    'Jane Smith',
    'jane@example.com',
    '9876543211',
    '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5uW3MuJXFSqcy', -- password: Test@123
    '456 Park Avenue, Floor 2',
    'Delhi',
    '110001',
    TRUE,
    FALSE,
    TRUE
);

-- ============================================
-- DISPLAY TABLE STRUCTURE
-- ============================================
DESCRIBE users;
DESCRIBE otp_verifications;
DESCRIBE password_resets;
DESCRIBE user_sessions;

-- ============================================
-- USEFUL QUERIES FOR TESTING
-- ============================================

-- View all users
-- SELECT * FROM users;

-- View user with email
-- SELECT * FROM users WHERE email = 'john@example.com';

-- Count total users
-- SELECT COUNT(*) as total_users FROM users;

-- View active users
-- SELECT * FROM users WHERE is_active = TRUE;

-- View verified users
-- SELECT * FROM users WHERE is_verified = TRUE AND email_verified = TRUE;
