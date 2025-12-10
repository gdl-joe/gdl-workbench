-- SQL Script für die Erstellung der GDL-UI-Studio Datenbank

-- 1. Datenbank erstellen (falls nicht vorhanden)
CREATE DATABASE IF NOT EXISTS `gdl_ui_studio_db` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 2. Datenbank auswählen
USE `gdl_ui_studio_db`;

-- 3. Tabelle `projects` erstellen
CREATE TABLE IF NOT EXISTS `projects` (
	`id` INT AUTO_INCREMENT PRIMARY KEY,
	`name` VARCHAR(255) NOT NULL COMMENT 'Name des GDL-Objekts (z.B. Mein_GDL_Objekt.gsm)',
	`created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
	`updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Tabelle `parameters` erstellen
CREATE TABLE IF NOT EXISTS `parameters` (
	`id` INT AUTO_INCREMENT PRIMARY KEY,
	`project_id` INT NOT NULL COMMENT 'Fremdschlüssel zu projects.id',
	`gdl_name` VARCHAR(255) NOT NULL COMMENT 'Interner GDL-Parametername (z.B. A, AC_show2DHotspotsIn3D)',
	`gdl_type` VARCHAR(50) NOT NULL COMMENT 'GDL-Datentyp (z.B. Length, String, Boolean, Separator, Title, Dictionary)',
	`function_group` VARCHAR(100) NULL COMMENT 'Funktionsgruppe des Parameters (z.B. Geometrie, Produktdaten)',
	`array_type` ENUM('None', '1D', '2D') DEFAULT 'None' COMMENT 'Art des Arrays',
	`array_first_dim` INT DEFAULT 0 COMMENT 'Erste Dimension für Arrays (0 wenn kein Array oder 1D)',
	`array_second_dim` INT DEFAULT 0 COMMENT 'Zweite Dimension für Arrays (0 wenn kein Array oder 1D)',
	`default_value_json` JSON NULL COMMENT 'Standardwert oder serialisierte komplexe Werte (JSON)',
	`is_fix_name` BOOLEAN DEFAULT FALSE COMMENT 'GDL Flag: Fix',
	`flag_bold` BOOLEAN DEFAULT FALSE COMMENT 'GDL Flag: ParFlg_BoldName',
	`flag_child` BOOLEAN DEFAULT FALSE COMMENT 'GDL Flag: ParFlg_Child',
	`flag_hidden` BOOLEAN DEFAULT FALSE COMMENT 'GDL Flag: ParFlg_Hidden',
	`flag_unique` BOOLEAN DEFAULT FALSE COMMENT 'GDL Flag: ParFlg_Unique',
	`ui_page` INT DEFAULT 0 COMMENT 'UI-Seite, auf der der Parameter angezeigt wird (0 = nicht im UI)',
	`is_ui_element` BOOLEAN DEFAULT FALSE COMMENT 'Kennzeichnet, ob der Parameter in der UI verwendet wird',
	`ui_code` TEXT NULL COMMENT 'Codewert für sonstige UI-Eigenschaften',
	`sort_order` INT NOT NULL COMMENT 'Sortierreihenfolge in der Parameterliste',
	`created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
	`updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON DELETE CASCADE,
	UNIQUE KEY `unique_param_per_project` (`project_id`, `gdl_name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. Tabelle `parameter_translations` erstellen
CREATE TABLE IF NOT EXISTS `parameter_translations` (
	`id` INT AUTO_INCREMENT PRIMARY KEY,
	`param_id` INT NOT NULL COMMENT 'Fremdschlüssel zu parameters.id',
	`language_code` VARCHAR(5) NOT NULL COMMENT 'Sprachkürzel (z.B. de, en, fr)',
	`description` TEXT NULL COMMENT 'Beschreibung des Parameters',
	`values_list` TEXT NULL COMMENT 'Komma-getrennte Werte für die VALUES-Liste (GDL-VALUES)',
	`ui_tooltip` TEXT NULL COMMENT 'GDL-UI_TOOLTIP Text',
	`created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
	`updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
	FOREIGN KEY (`param_id`) REFERENCES `parameters`(`id`) ON DELETE CASCADE,
	UNIQUE KEY `unique_translation_per_param_lang` (`param_id`, `language_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Optional: Initialdaten für Sprachen, falls eine feste Liste von Sprachen unterstützt wird
-- INSERT INTO `languages` (`code`, `name`) VALUES ('de', 'Deutsch'), ('en', 'English'), ...

