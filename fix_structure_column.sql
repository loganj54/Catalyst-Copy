-- Drop the old 'structure' column from cached_blueprint_structures
-- This column has a NOT NULL constraint that's causing insert errors

ALTER TABLE cached_blueprint_structures 
DROP COLUMN IF EXISTS structure CASCADE;

-- Verify the column is gone
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'cached_blueprint_structures'
ORDER BY ordinal_position;

