-- Migration: Add unique constraint to prevent duplicate parameter names per object
-- Path: database/migrations/002_add_unique_parameter_names.sql

-- IMPORTANT:
-- This migration will add a UNIQUE constraint on (gdl_object_id, gdl_name).
-- If duplicate parameter names already exist for the same object, the ALTER TABLE will fail.
-- Run the following query first to find duplicates:
--
-- SELECT gdl_object_id, gdl_name, COUNT(*) AS cnt
-- FROM parameters
-- GROUP BY gdl_object_id, gdl_name
-- HAVING cnt > 1;
--
-- Resolve duplicates manually (rename or remove) before running this migration.

ALTER TABLE parameters
  ADD CONSTRAINT uq_parameters_object_name UNIQUE (gdl_object_id, gdl_name);

-- Note: MySQL's default collations are usually case-insensitive, so this constraint
-- will treat names case-insensitively. If you need case-sensitive uniqueness, adjust
-- the column collation (e.g. utf8_bin) or add a functional index on LOWER(gdl_name)
-- (requires MySQL 8.0+ with expression indexes).
