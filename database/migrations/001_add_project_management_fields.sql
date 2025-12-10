-- Migration: Add Project Management Features
-- Date: 2024-12-10

USE gdl_ui_studio_db;

-- Add new fields to projects table
ALTER TABLE projects
ADD COLUMN description TEXT AFTER name,
ADD COLUMN status ENUM('active', 'archive', 'wip', 'urgent') DEFAULT 'active' AFTER description,
ADD COLUMN folder_path VARCHAR(500) NULL AFTER status,
ADD COLUMN last_modified_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER updated_at;

-- Add new fields to gdl_objects table
ALTER TABLE gdl_objects
ADD COLUMN status ENUM('active', 'archive', 'wip', 'urgent') DEFAULT 'active' AFTER description,
ADD COLUMN file_path VARCHAR(500) NULL AFTER status,
ADD COLUMN last_modified_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER updated_at;

-- Add color field to parameters table for type coloring
ALTER TABLE parameters
ADD COLUMN type_color VARCHAR(7) NULL AFTER gdl_type;

-- Create table for parameter type colors (global settings)
CREATE TABLE IF NOT EXISTS parameter_type_colors (
    id INT AUTO_INCREMENT PRIMARY KEY,
    gdl_type VARCHAR(50) NOT NULL UNIQUE,
    color VARCHAR(7) NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_gdl_type (gdl_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Insert default colors for parameter types
INSERT INTO parameter_type_colors (gdl_type, color) VALUES
('STRING', '#3498db'),
('INTEGER', '#2ecc71'),
('LENGTH', '#e74c3c'),
('ANGLE', '#f39c12'),
('BOOLEAN', '#9b59b6'),
('MATERIAL', '#1abc9c'),
('FILL', '#e67e22'),
('PEN', '#34495e'),
('STYLE', '#16a085'),
('REAL', '#27ae60')
ON DUPLICATE KEY UPDATE color=VALUES(color);
