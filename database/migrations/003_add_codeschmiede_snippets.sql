-- Migration 003: Codeschmiede Snippets
-- Stores reusable form-value presets per GDL command

CREATE TABLE IF NOT EXISTS codeschmiede_snippets (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    command_id  VARCHAR(100)  NOT NULL COMMENT 'GDL_COMMANDS key, e.g. hotspot2_movable',
    name        VARCHAR(255)  NOT NULL,
    params_json JSON          NOT NULL COMMENT 'Serialized form values',
    created_at  TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_command_id (command_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
