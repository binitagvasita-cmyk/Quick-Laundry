-- Services Database Schema for Laundry Website
-- File: services_schema.sql

-- Categories Table
CREATE TABLE IF NOT EXISTS categories (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    icon VARCHAR(255),
    display_order INT DEFAULT 0,
    is_active TINYINT(1) DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Services Table
CREATE TABLE IF NOT EXISTS services (
    id INT AUTO_INCREMENT PRIMARY KEY,
    category_id INT NOT NULL,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    image_path VARCHAR(255),
    base_price DECIMAL(10, 2) NOT NULL,
    unit VARCHAR(50) DEFAULT 'per kg',
    min_quantity DECIMAL(10, 2) DEFAULT 1.00,
    estimated_time VARCHAR(100),
    is_featured TINYINT(1) DEFAULT 0,
    is_active TINYINT(1) DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
);

-- Service Features Table
CREATE TABLE IF NOT EXISTS service_features (
    id INT AUTO_INCREMENT PRIMARY KEY,
    service_id INT NOT NULL,
    feature_name VARCHAR(200) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE CASCADE
);

CREATE TABLE bookings (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,

    user_id INT UNSIGNED NOT NULL,
    service_id INT UNSIGNED NOT NULL,

    quantity DECIMAL(10,2) NOT NULL,
    total_price DECIMAL(10,2) NOT NULL,

    pickup_date DATE NOT NULL,
    pickup_time VARCHAR(20) NOT NULL,
    delivery_date DATE,

    address TEXT NOT NULL,
    phone VARCHAR(15) NOT NULL,
    special_instructions TEXT,

    status ENUM(
        'pending','confirmed','picked_up',
        'in_process','ready','delivered','cancelled'
    ) DEFAULT 'pending',

    payment_status ENUM(
        'pending','paid','failed','refunded'
    ) DEFAULT 'pending',

    payment_method VARCHAR(50),

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT fk_booking_user
        FOREIGN KEY (user_id) REFERENCES users(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_booking_service
        FOREIGN KEY (service_id) REFERENCES services(id)
        ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Insert Sample Categories
INSERT INTO categories (name, description, icon, display_order) VALUES
('Wash & Fold', 'Regular washing and folding service for everyday clothes', 'frontend/uploads/categories/wash-fold.png', 1),
('Dry Cleaning', 'Professional dry cleaning for delicate and formal wear', 'frontend/uploads/categories/dry-clean.png', 2),
('Iron & Press', 'Professional ironing and pressing service', 'frontend/uploads/categories/iron.png', 3),
('Wash & Iron', 'Complete wash and iron service', 'frontend/uploads/categories/wash-iron.png', 4),
('Premium Care', 'Special care for delicate fabrics and designer wear', 'frontend/uploads/categories/premium.png', 5);

-- Insert Sample Services
INSERT INTO services (category_id, name, description, image_path, base_price, unit, estimated_time, is_featured) VALUES
-- Wash & Fold Services
(1, 'Regular Wash & Fold', 'Basic washing and folding service for everyday wear', 'frontend/uploads/services/wash-fold-regular.png', 50.00, 'per kg', '24-48 hours', 1),
(1, 'Express Wash & Fold', 'Quick washing and folding service', 'frontend/uploads/services/wash-fold-express.png', 80.00, 'per kg', '12-24 hours', 0),
(1, 'Bedding & Linen', 'Washing service for bed sheets, blankets, and towels', 'frontend/uploads/services/bedding.png', 60.00, 'per kg', '24-48 hours', 0),

-- Dry Cleaning Services
(2, 'Suit Dry Cleaning', 'Professional dry cleaning for formal suits', 'frontend/uploads/services/suit-cleaning.png', 250.00, 'per piece', '48-72 hours', 1),
(2, 'Dress Dry Cleaning', 'Gentle dry cleaning for dresses and gowns', 'frontend/uploads/services/dress-cleaning.png', 200.00, 'per piece', '48-72 hours', 0),
(2, 'Shirt Dry Cleaning', 'Professional dry cleaning for formal shirts', 'frontend/uploads/services/shirt-cleaning.png', 80.00, 'per piece', '24-48 hours', 0),

-- Iron & Press Services
(3, 'Regular Ironing', 'Professional ironing service for everyday clothes', 'frontend/uploads/services/iron-regular.png', 30.00, 'per kg', '12-24 hours', 0),
(3, 'Premium Ironing', 'Expert ironing for delicate and formal wear', 'frontend/uploads/services/iron-premium.png', 50.00, 'per kg', '12-24 hours', 0),

-- Wash & Iron Services
(4, 'Complete Wash & Iron', 'Full service washing and ironing', 'frontend/uploads/services/wash-iron-complete.png', 70.00, 'per kg', '24-48 hours', 1),
(4, 'Express Wash & Iron', 'Quick wash and iron service', 'frontend/uploads/services/wash-iron-express.png', 100.00, 'per kg', '12-24 hours', 0),

-- Premium Care Services
(5, 'Silk & Delicates', 'Special care for silk and delicate fabrics', 'frontend/uploads/services/silk-care.png', 150.00, 'per kg', '48-72 hours', 1),
(5, 'Designer Wear Care', 'Premium care for designer and luxury garments', 'frontend/uploads/services/designer-care.png', 300.00, 'per piece', '72-96 hours', 1),
(5, 'Leather & Suede', 'Professional cleaning for leather and suede items', 'frontend/uploads/services/leather-care.png', 400.00, 'per piece', '5-7 days', 0);

-- Insert Sample Service Features
INSERT INTO service_features (service_id, feature_name) VALUES
-- Regular Wash & Fold (id: 1)
(1, 'High-quality detergents'),
(1, 'Fabric softener included'),
(1, 'Neatly folded and packed'),
-- Express Wash & Fold (id: 2)
(2, 'Same-day delivery available'),
(2, 'Premium detergents'),
(2, 'Priority processing'),
-- Suit Dry Cleaning (id: 4)
(4, 'Professional stain removal'),
(4, 'Steam pressing included'),
(4, 'Protective garment bag'),
-- Designer Wear Care (id: 12)
(12, 'Hand washing available'),
(12, 'Specialized cleaning agents'),
(12, 'Individual garment attention');