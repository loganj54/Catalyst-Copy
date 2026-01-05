-- Drop the old 'structure' column from cached_blueprint_structures
-- This column has a NOT NULL constraint that's causing insert errors
-- The new schema uses 'cached_unit' instead

ALTER TABLE cached_blueprint_structures 
DROP COLUMN IF EXISTS structure CASCADE;

