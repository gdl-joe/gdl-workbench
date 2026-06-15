-- ============================================================================
-- GDL-Workbench – vollständiges Datenbank-Schema
-- Erzeugt aus dem laufenden, code-konformen Schema (ersetzt die verteilten
-- install_UPDATED.sql + add_*.sql + migrations/*).
-- Einspielen:  mysql -h127.0.0.1 -P<port> -u<user> -p < database/install.sql
-- ============================================================================

CREATE DATABASE IF NOT EXISTS `gdl-workbench` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `gdl-workbench`;


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;
DROP TABLE IF EXISTS `codeschmiede_snippets`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `codeschmiede_snippets` (
  `id` int NOT NULL AUTO_INCREMENT,
  `command_id` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'GDL_COMMANDS key, e.g. hotspot2_movable',
  `name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `params_json` json NOT NULL COMMENT 'Serialized form values',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_command_id` (`command_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `gdl_objects`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `gdl_objects` (
  `id` int NOT NULL AUTO_INCREMENT,
  `project_id` int NOT NULL COMMENT 'FremdschlÃ¼ssel zu projects',
  `name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'GDL-Objektname (z.B. Fenster_Standard.gsm)',
  `description` text COLLATE utf8mb4_unicode_ci COMMENT 'Optionale Beschreibung',
  `status` enum('active','archive','wip','urgent') COLLATE utf8mb4_unicode_ci DEFAULT 'active',
  `file_path` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `local_file_path` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `is_local_sync` tinyint(1) DEFAULT '0',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `last_modified_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `last_sync_time` datetime DEFAULT NULL,
  `script_parameter` longtext COLLATE utf8mb4_unicode_ci COMMENT 'Parameter Script',
  `script_master` longtext COLLATE utf8mb4_unicode_ci COMMENT 'Master Script',
  `script_2d` longtext COLLATE utf8mb4_unicode_ci COMMENT '2D Script',
  `script_3d` longtext COLLATE utf8mb4_unicode_ci COMMENT '3D Script',
  `script_properties` longtext COLLATE utf8mb4_unicode_ci COMMENT 'Properties Script',
  `script_migration_forward` longtext COLLATE utf8mb4_unicode_ci COMMENT 'Forward Migration Script',
  `script_migration_backward` longtext COLLATE utf8mb4_unicode_ci COMMENT 'Backward Migration Script',
  `script_ui` longtext COLLATE utf8mb4_unicode_ci COMMENT 'UI Script',
  `ui_config` longtext COLLATE utf8mb4_unicode_ci,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_object_per_project` (`project_id`,`name`),
  KEY `idx_project_id` (`project_id`),
  KEY `idx_name` (`name`),
  CONSTRAINT `gdl_objects_ibfk_1` FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `parameter_translations`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `parameter_translations` (
  `id` int NOT NULL AUTO_INCREMENT,
  `param_id` int NOT NULL COMMENT 'FremdschlÃ¼ssel zu parameters',
  `language_code` varchar(5) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Sprache (de, en, fr, es, it)',
  `description` text COLLATE utf8mb4_unicode_ci COMMENT 'Beschreibung in dieser Sprache',
  `values_list` text COLLATE utf8mb4_unicode_ci COMMENT 'VALUES-Liste (komma-getrennt)',
  `ui_tooltip` text COLLATE utf8mb4_unicode_ci COMMENT 'UI_TOOLTIP Text',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_translation_per_param_lang` (`param_id`,`language_code`),
  KEY `idx_param_id` (`param_id`),
  KEY `idx_language_code` (`language_code`),
  CONSTRAINT `parameter_translations_ibfk_1` FOREIGN KEY (`param_id`) REFERENCES `parameters` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=69 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `parameter_type_colors`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `parameter_type_colors` (
  `id` int NOT NULL AUTO_INCREMENT,
  `gdl_type` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `color` varchar(7) COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `gdl_type` (`gdl_type`),
  KEY `idx_gdl_type` (`gdl_type`)
) ENGINE=InnoDB AUTO_INCREMENT=11 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `parameters`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `parameters` (
  `id` int NOT NULL AUTO_INCREMENT,
  `gdl_object_id` int NOT NULL COMMENT 'FremdschlÃ¼ssel zu gdl_objects',
  `gdl_name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'GDL-Parametername (z.B. A, B, iWindowType)',
  `gdl_type` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'GDL-Typ (Length, String, Integer, etc.)',
  `type_color` varchar(7) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `function_group` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Funktionsgruppe (Geometrie, Produktdaten, etc.)',
  `array_type` enum('None','1D','2D') COLLATE utf8mb4_unicode_ci DEFAULT 'None',
  `array_first_dim` int DEFAULT '0',
  `array_second_dim` int DEFAULT '0',
  `default_value_json` json DEFAULT NULL COMMENT 'Standardwert als JSON',
  `is_fix_name` tinyint(1) DEFAULT '0' COMMENT 'Fix Name Flag',
  `flag_bold` tinyint(1) DEFAULT '0' COMMENT 'ParFlg_BoldName',
  `flag_child` tinyint(1) DEFAULT '0' COMMENT 'ParFlg_Child (eingerÃ¼ckt)',
  `flag_hidden` tinyint(1) DEFAULT '0' COMMENT 'ParFlg_Hidden',
  `flag_unique` tinyint(1) DEFAULT '0' COMMENT 'ParFlg_Unique',
  `ui_page` int DEFAULT '0' COMMENT 'UI-Seite (0 = nicht im UI)',
  `is_ui_element` tinyint(1) DEFAULT '0' COMMENT 'Wird im UI verwendet',
  `ui_code` text COLLATE utf8mb4_unicode_ci COMMENT 'ZusÃ¤tzlicher UI-Code',
  `sort_order` int NOT NULL COMMENT 'Sortierreihenfolge',
  `display_order` int DEFAULT '0',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_param_per_object` (`gdl_object_id`,`gdl_name`),
  UNIQUE KEY `uq_parameters_object_name` (`gdl_object_id`,`gdl_name`),
  KEY `idx_gdl_object_id` (`gdl_object_id`),
  KEY `idx_gdl_name` (`gdl_name`),
  KEY `idx_sort_order` (`sort_order`),
  CONSTRAINT `parameters_ibfk_1` FOREIGN KEY (`gdl_object_id`) REFERENCES `gdl_objects` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=66 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `projects`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `projects` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Projektname (z.B. BÃ¼rogebÃ¤ude_2024)',
  `description` text COLLATE utf8mb4_unicode_ci,
  `status` enum('active','archive','wip','urgent') COLLATE utf8mb4_unicode_ci DEFAULT 'active',
  `folder_path` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `last_modified_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_name` (`name`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Standard-Farben für Parameter-Typen
INSERT INTO `parameter_type_colors` VALUES (1,'STRING','#3498db','2026-06-15 20:58:06','2026-06-15 20:58:06'),(2,'INTEGER','#2ecc71','2026-06-15 20:58:06','2026-06-15 20:58:06'),(3,'LENGTH','#e74c3c','2026-06-15 20:58:06','2026-06-15 20:58:06'),(4,'ANGLE','#f39c12','2026-06-15 20:58:06','2026-06-15 20:58:06'),(5,'BOOLEAN','#9b59b6','2026-06-15 20:58:06','2026-06-15 20:58:06'),(6,'MATERIAL','#1abc9c','2026-06-15 20:58:06','2026-06-15 20:58:06'),(7,'FILL','#e67e22','2026-06-15 20:58:06','2026-06-15 20:58:06'),(8,'PEN','#34495e','2026-06-15 20:58:06','2026-06-15 20:58:06'),(9,'STYLE','#16a085','2026-06-15 20:58:06','2026-06-15 20:58:06'),(10,'REAL','#27ae60','2026-06-15 20:58:06','2026-06-15 20:58:06');
