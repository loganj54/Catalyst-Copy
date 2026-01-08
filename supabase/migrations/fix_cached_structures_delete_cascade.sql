-- Add ON DELETE CASCADE to source_blueprint_id in cached_blueprint_structures
-- This fixes the issue where blueprints cannot be deleted if they have associated cached sections

-- First, drop the existing constraint
ALTER TABLE cached_blueprint_structures
DROP CONSTRAINT IF EXISTS cached_blueprint_structures_source_blueprint_id_fkey;

-- Re-add the constraint with ON DELETE CASCADE
ALTER TABLE cached_blueprint_structures
ADD CONSTRAINT cached_blueprint_structures_source_blueprint_id_fkey
FOREIGN KEY (source_blueprint_id)
REFERENCES blueprints(id)
ON DELETE CASCADE;
