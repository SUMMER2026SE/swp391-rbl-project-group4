-- Migration 009: Add description and level fields to units table
-- Supports the new unit edit page (Chỉnh sửa bài học)

ALTER TABLE content_module.units
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS level       VARCHAR(10);
