-- Add source_blueprint_id to cached_blueprint_structures
-- This allows us to uniquely identify which blueprint a cached section came from
-- Prevents mixing up sections with the same section_id from different blueprints

ALTER TABLE cached_blueprint_structures
ADD COLUMN IF NOT EXISTS source_blueprint_id UUID REFERENCES blueprints(id);

CREATE INDEX IF NOT EXISTS idx_cached_sections_source_blueprint
ON cached_blueprint_structures(source_blueprint_id);

-- Add composite index for fast lookups by section_id + blueprint_id
CREATE INDEX IF NOT EXISTS idx_cached_sections_section_blueprint
ON cached_blueprint_structures(section_id, source_blueprint_id);

COMMENT ON COLUMN cached_blueprint_structures.source_blueprint_id IS 
'The blueprint ID that this cached section originally came from. Used with section_id for unique identification.';

