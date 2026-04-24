-- Add script columns to gdl_objects table
USE `gdl_ui_studio_db`;

ALTER TABLE `gdl_objects`
ADD COLUMN `script_parameter` LONGTEXT NULL COMMENT 'Parameter Script',
ADD COLUMN `script_master` LONGTEXT NULL COMMENT 'Master Script',
ADD COLUMN `script_2d` LONGTEXT NULL COMMENT '2D Script',
ADD COLUMN `script_3d` LONGTEXT NULL COMMENT '3D Script',
ADD COLUMN `script_properties` LONGTEXT NULL COMMENT 'Properties Script',
ADD COLUMN `script_migration_forward` LONGTEXT NULL COMMENT 'Forward Migration Script',
ADD COLUMN `script_migration_backward` LONGTEXT NULL COMMENT 'Backward Migration Script';
