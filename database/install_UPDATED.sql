-- ============================================================================
-- GDL-UI-Studio Database Schema (UPDATED - 9. Dezember 2024)
-- ============================================================================
-- Korrekte 3-stufige Hierarchie: Project → GDL Object → Parameter → Translations
-- ============================================================================

CREATE DATABASE IF NOT EXISTS `gdl_ui_studio_db` 
    CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE `gdl_ui_studio_db`;

-- ============================================================================
-- TABELLE 1: projects - Hauptprojekte
-- ============================================================================
CREATE TABLE IF NOT EXISTS `projects` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `name` VARCHAR(255) NOT NULL COMMENT 'Projektname (z.B. Bürogebäude_2024)',
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX `idx_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- TABELLE 2: gdl_objects - GDL-Objekte pro Projekt (NEU!)
-- ============================================================================
CREATE TABLE IF NOT EXISTS `gdl_objects` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `project_id` INT NOT NULL COMMENT 'Fremdschlüssel zu projects',
    `name` VARCHAR(255) NOT NULL COMMENT 'GDL-Objektname (z.B. Fenster_Standard.gsm)',
    `description` TEXT NULL COMMENT 'Optionale Beschreibung',
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON DELETE CASCADE,
    UNIQUE KEY `unique_object_per_project` (`project_id`, `name`),
    INDEX `idx_project_id` (`project_id`),
    INDEX `idx_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- TABELLE 3: parameters - GDL-Parameter
-- WICHTIG: Verwendet gdl_object_id statt project_id!
-- ============================================================================
CREATE TABLE IF NOT EXISTS `parameters` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `gdl_object_id` INT NOT NULL COMMENT 'Fremdschlüssel zu gdl_objects',
    `gdl_name` VARCHAR(255) NOT NULL COMMENT 'GDL-Parametername (z.B. A, B, iWindowType)',
    `gdl_type` VARCHAR(50) NOT NULL COMMENT 'GDL-Typ (Length, String, Integer, etc.)',
    `function_group` VARCHAR(100) NULL COMMENT 'Funktionsgruppe (Geometrie, Produktdaten, etc.)',
    
    -- Array Properties
    `array_type` ENUM('None', '1D', '2D') DEFAULT 'None',
    `array_first_dim` INT DEFAULT 0,
    `array_second_dim` INT DEFAULT 0,
    
    -- Default Value
    `default_value_json` JSON NULL COMMENT 'Standardwert als JSON',
    
    -- GDL Flags
    `is_fix_name` BOOLEAN DEFAULT FALSE COMMENT 'Fix Name Flag',
    `flag_bold` BOOLEAN DEFAULT FALSE COMMENT 'ParFlg_BoldName',
    `flag_child` BOOLEAN DEFAULT FALSE COMMENT 'ParFlg_Child (eingerückt)',
    `flag_hidden` BOOLEAN DEFAULT FALSE COMMENT 'ParFlg_Hidden',
    `flag_unique` BOOLEAN DEFAULT FALSE COMMENT 'ParFlg_Unique',
    
    -- UI Properties
    `ui_page` INT DEFAULT 0 COMMENT 'UI-Seite (0 = nicht im UI)',
    `is_ui_element` BOOLEAN DEFAULT FALSE COMMENT 'Wird im UI verwendet',
    `ui_code` TEXT NULL COMMENT 'Zusätzlicher UI-Code',
    
    -- Sorting
    `sort_order` INT NOT NULL COMMENT 'Sortierreihenfolge',
    
    -- Timestamps
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    -- Constraints
    FOREIGN KEY (`gdl_object_id`) REFERENCES `gdl_objects`(`id`) ON DELETE CASCADE,
    UNIQUE KEY `unique_param_per_object` (`gdl_object_id`, `gdl_name`),
    INDEX `idx_gdl_object_id` (`gdl_object_id`),
    INDEX `idx_gdl_name` (`gdl_name`),
    INDEX `idx_sort_order` (`sort_order`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- TABELLE 4: parameter_translations - Mehrsprachige Übersetzungen
-- ============================================================================
CREATE TABLE IF NOT EXISTS `parameter_translations` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `param_id` INT NOT NULL COMMENT 'Fremdschlüssel zu parameters',
    `language_code` VARCHAR(5) NOT NULL COMMENT 'Sprache (de, en, fr, es, it)',
    `description` TEXT NULL COMMENT 'Beschreibung in dieser Sprache',
    `values_list` TEXT NULL COMMENT 'VALUES-Liste (komma-getrennt)',
    `ui_tooltip` TEXT NULL COMMENT 'UI_TOOLTIP Text',
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    -- Constraints
    FOREIGN KEY (`param_id`) REFERENCES `parameters`(`id`) ON DELETE CASCADE,
    UNIQUE KEY `unique_translation_per_param_lang` (`param_id`, `language_code`),
    INDEX `idx_param_id` (`param_id`),
    INDEX `idx_language_code` (`language_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- BEISPIEL-DATEN (zum Testen)
-- ============================================================================

INSERT INTO `projects` (`name`) VALUES ('Demo_Projekt_Bürogebäude');

INSERT INTO `gdl_objects` (`project_id`, `name`, `description`) 
VALUES (1, 'Fenster_Standard.gsm', 'Standard-Fenster mit Basis-Parametern');

INSERT INTO `parameters` (
    `gdl_object_id`, `gdl_name`, `gdl_type`, `function_group`, 
    `default_value_json`, `sort_order`
) VALUES 
    (1, 'A', 'Length', 'Geometrie', '1000', 1),
    (1, 'B', 'Length', 'Geometrie', '1200', 2),
    (1, 'iWindowType', 'Integer', 'Produktdaten', '1', 3);

INSERT INTO `parameter_translations` (`param_id`, `language_code`, `description`) VALUES
    (1, 'de', 'Breite'),
    (1, 'en', 'Width'),
    (2, 'de', 'Höhe'),
    (2, 'en', 'Height'),
    (3, 'de', 'Fenstertyp'),
    (3, 'en', 'Window Type');

-- ============================================================================
-- ÜBERPRÜFUNG
-- ============================================================================

SHOW TABLES;

SELECT 
    p.name AS Projekt,
    o.name AS Objekt,
    COUNT(param.id) AS Parameter_Anzahl
FROM projects p
LEFT JOIN gdl_objects o ON p.id = o.project_id
LEFT JOIN parameters param ON o.id = param.gdl_object_id
GROUP BY p.id, o.id;

SELECT 'Schema erfolgreich erstellt!' AS Status;
