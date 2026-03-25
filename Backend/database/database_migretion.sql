-- ============================================
-- DATABASE MIGRATION FOR GOOGLE OAUTH
-- Run this in MySQL Workbench
-- ============================================

USE quick_laundry_db;

-- Add Google OAuth columns to users table
ALTER TABLE users
ADD COLUMN google_id VARCHAR(255) NULL UNIQUE AFTER email,
ADD COLUMN profile_picture VARCHAR(500) NULL AFTER google_id,
ADD INDEX idx_google_id (google_id);

-- Update existing table comment
ALTER TABLE users COMMENT = 'User accounts with email/password and Google OAuth support';

-- Verify the changes
DESC users;

-- Check existing data
SELECT 
    user_id,
    full_name,
    email,
    google_id,
    profile_picture,
    is_verified,
    email_verified,
    created_at
FROM users
ORDER BY created_at DESC
LIMIT 10;

COMMIT;

-- ============================================
-- ROLLBACK (If needed)
-- ============================================

-- To rollback these changes, uncomment and run:
-- ALTER TABLE users
-- DROP COLUMN google_id,
-- DROP COLUMN profile_picture;
-- COMMIT;