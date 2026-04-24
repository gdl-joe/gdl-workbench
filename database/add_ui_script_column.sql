-- Add script_ui column to gdl_objects table
USE `gdl_ui_studio_db`;

ALTER TABLE `gdl_objects`
ADD COLUMN `script_ui` LONGTEXT NULL COMMENT 'UI Script';
