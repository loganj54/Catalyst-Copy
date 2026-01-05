-- Add unique constraint to prevent duplicate structures for the same blueprint
-- This ensures only one structure per blueprint

-- First, delete any duplicate structures (keep the newest one)
DELETE FROM blueprint_structures
WHERE id NOT IN (
  SELECT DISTINCT ON (blueprint_id) id
  FROM blueprint_structures
  ORDER BY blueprint_id, created_at DESC
);

-- Add unique constraint
ALTER TABLE blueprint_structures
ADD CONSTRAINT blueprint_structures_blueprint_id_unique 
UNIQUE (blueprint_id);

-- Add comment
COMMENT ON CONSTRAINT blueprint_structures_blueprint_id_unique ON blueprint_structures IS 
  'Ensures only one structure per blueprint';

