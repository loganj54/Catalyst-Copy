-- ============================================================================
-- SECTION-LEVEL BLUEPRINT STRUCTURE CACHING SYSTEM V2
-- ============================================================================
-- Transforms the cached_blueprint_structures table from full-structure caching
-- to granular section-level caching. This enables reuse of individual learning
-- units (problems or topics) across different documents.
--
-- KEY CHANGES:
-- - Add section-level fields (section_id, section_type, section_embedding)
-- - Repurpose 'structure' column to store single learning units
-- - Create new vector index for section_embedding
-- - Add new search function for section-level similarity matching
-- ============================================================================

-- ============================================================================
-- STEP 1: ADD NEW COLUMNS FOR SECTION-LEVEL CACHING
-- ============================================================================

-- Section identification
ALTER TABLE cached_blueprint_structures 
ADD COLUMN IF NOT EXISTS section_id TEXT;

ALTER TABLE cached_blueprint_structures 
ADD COLUMN IF NOT EXISTS section_type TEXT CHECK (section_type IN ('problem', 'topic'));

-- Primary embedding for cache lookup (replaces the 3 separate embeddings)
ALTER TABLE cached_blueprint_structures 
ADD COLUMN IF NOT EXISTS section_embedding VECTOR(1536);

-- Track what was used to create the embedding
ALTER TABLE cached_blueprint_structures 
ADD COLUMN IF NOT EXISTS embedding_source TEXT;

-- Rename 'structure' to 'cached_unit' for clarity (stores single learning unit)
-- Note: We'll keep both columns during migration for backwards compatibility
ALTER TABLE cached_blueprint_structures 
ADD COLUMN IF NOT EXISTS cached_unit JSONB;

-- Add indexes for new columns
CREATE INDEX IF NOT EXISTS cached_structures_section_id_idx 
  ON cached_blueprint_structures(section_id);

CREATE INDEX IF NOT EXISTS cached_structures_section_type_idx 
  ON cached_blueprint_structures(section_type);

-- ============================================================================
-- STEP 2: CREATE VECTOR INDEX FOR SECTION EMBEDDINGS
-- ============================================================================

-- Drop old vector indexes (we'll recreate them if needed for backwards compat)
DROP INDEX IF EXISTS cached_structures_subject_embedding_idx;
DROP INDEX IF EXISTS cached_structures_topics_embedding_idx;
DROP INDEX IF EXISTS cached_structures_characteristics_embedding_idx;

-- Create new high-performance vector index for section embeddings
-- Using IVFFlat with cosine distance for fast similarity search
CREATE INDEX IF NOT EXISTS cached_structures_section_embedding_idx 
  ON cached_blueprint_structures 
  USING ivfflat (section_embedding vector_cosine_ops)
  WITH (lists = 100);

-- ============================================================================
-- STEP 3: CREATE SECTION-LEVEL SIMILARITY SEARCH FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION search_similar_sections(
  query_embedding VECTOR(1536),
  p_section_type TEXT,
  p_subject_area TEXT,
  p_document_type TEXT,
  similarity_threshold FLOAT DEFAULT 0.95,
  max_results INTEGER DEFAULT 1
)
RETURNS TABLE (
  id UUID,
  cached_unit JSONB,
  section_id TEXT,
  section_type TEXT,
  similarity FLOAT,
  times_used INTEGER,
  quality_score FLOAT,
  last_used_at TIMESTAMP WITH TIME ZONE,
  embedding_source TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    cbs.id,
    cbs.cached_unit,
    cbs.section_id,
    cbs.section_type,
    -- Calculate cosine similarity (1 - cosine distance)
    (1 - (cbs.section_embedding <=> query_embedding)) AS similarity,
    cbs.times_used,
    cbs.quality_score,
    cbs.last_used_at,
    cbs.embedding_source
  FROM cached_blueprint_structures cbs
  WHERE 
    -- Filter by section type (problem vs topic)
    cbs.section_type = p_section_type
    -- Filter by subject area for relevance
    AND cbs.subject_area = p_subject_area
    -- Filter by document type for context matching
    AND cbs.document_type = p_document_type
    -- Only return results above similarity threshold
    AND (1 - (cbs.section_embedding <=> query_embedding)) >= similarity_threshold
    -- Ensure we have a cached unit
    AND cbs.cached_unit IS NOT NULL
  ORDER BY 
    -- Prioritize: similarity first, then quality, then usage
    similarity DESC,
    quality_score DESC,
    times_used DESC
  LIMIT max_results;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION search_similar_sections IS 
  'Searches for similar cached learning units at the section level using vector similarity.
  Returns the most similar cached unit for a given section embedding.
  Threshold of 0.95 ensures very strict matching (only nearly identical sections).';

-- ============================================================================
-- STEP 4: UPDATE CACHE USAGE TRACKING FUNCTIONS
-- ============================================================================

-- Update the increment function to work with section-level cache
CREATE OR REPLACE FUNCTION increment_section_cache_usage(cache_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE cached_blueprint_structures
  SET 
    times_used = times_used + 1,
    last_used_at = NOW()
  WHERE id = cache_id;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION increment_section_cache_usage IS 
  'Increments usage counter when a cached section is reused.';

-- ============================================================================
-- STEP 5: CREATE HELPER FUNCTION TO MIGRATE OLD CACHE ENTRIES
-- ============================================================================

-- This function can be used to extract individual sections from old full-structure caches
-- and create new section-level cache entries (optional, for data migration)
CREATE OR REPLACE FUNCTION migrate_full_structure_to_sections(
  old_cache_id UUID
)
RETURNS TABLE (
  new_cache_id UUID,
  section_id TEXT,
  migrated BOOLEAN
) AS $$
DECLARE
  old_record RECORD;
  learning_unit JSONB;
  new_id UUID;
BEGIN
  -- Get the old cache record
  SELECT * INTO old_record
  FROM cached_blueprint_structures
  WHERE id = old_cache_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cache record not found: %', old_cache_id;
  END IF;
  
  -- Note: This is a placeholder for manual migration if needed
  -- The actual migration logic would need to parse the old 'structure' JSONB
  -- and extract individual learning units
  
  RAISE NOTICE 'Migration function is a placeholder. Manual migration required.';
  
  RETURN;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- STEP 6: UPDATE STATISTICS VIEWS FOR SECTION-LEVEL CACHING
-- ============================================================================

-- Drop old views
DROP VIEW IF EXISTS cache_statistics;
DROP VIEW IF EXISTS cache_performance_by_subject;

-- Create new section-level cache statistics view
CREATE OR REPLACE VIEW section_cache_statistics AS
SELECT
  COUNT(*) as total_cached_sections,
  COUNT(DISTINCT subject_area) as unique_subjects,
  COUNT(DISTINCT document_type) as unique_document_types,
  COUNT(*) FILTER (WHERE section_type = 'problem') as cached_problems,
  COUNT(*) FILTER (WHERE section_type = 'topic') as cached_topics,
  AVG(times_used) as avg_times_used,
  AVG(quality_score) as avg_quality_score,
  MAX(times_used) as max_times_used,
  SUM(CASE WHEN times_used > 0 THEN 1 ELSE 0 END) as used_sections,
  SUM(CASE WHEN times_used = 0 THEN 1 ELSE 0 END) as unused_sections,
  -- Estimate token savings (assuming ~1000 tokens per cached section)
  SUM(times_used) * 1000 as estimated_tokens_saved
FROM cached_blueprint_structures
WHERE cached_unit IS NOT NULL;

COMMENT ON VIEW section_cache_statistics IS 
  'Provides overview statistics for section-level caching system.';

-- Create performance view by subject and section type
CREATE OR REPLACE VIEW section_cache_performance AS
SELECT
  subject_area,
  section_type,
  COUNT(*) as section_count,
  SUM(times_used) as total_uses,
  AVG(times_used) as avg_uses_per_section,
  AVG(quality_score) as avg_quality,
  MAX(last_used_at) as most_recent_use,
  -- Token savings estimate
  SUM(times_used) * 1000 as estimated_tokens_saved
FROM cached_blueprint_structures
WHERE cached_unit IS NOT NULL
GROUP BY subject_area, section_type
ORDER BY total_uses DESC;

COMMENT ON VIEW section_cache_performance IS 
  'Shows cache performance broken down by subject area and section type.';

-- ============================================================================
-- STEP 7: ADD COMMENTS FOR DOCUMENTATION
-- ============================================================================

COMMENT ON COLUMN cached_blueprint_structures.section_id IS 
  'Original section ID from document analysis (e.g., "Problem 1", "Topic 2")';

COMMENT ON COLUMN cached_blueprint_structures.section_type IS 
  'Type of section: "problem" (homework problem) or "topic" (lecture content)';

COMMENT ON COLUMN cached_blueprint_structures.section_embedding IS 
  'Vector embedding of the section content for similarity matching. 
  For problems: embedding of problem_statement. 
  For topics: embedding of topic_summary + concepts_tested.';

COMMENT ON COLUMN cached_blueprint_structures.embedding_source IS 
  'Indicates what was used to create the embedding: "problem_statement" or "topic_summary+concepts_tested"';

COMMENT ON COLUMN cached_blueprint_structures.cached_unit IS 
  'The generated learning unit structure (single unit, not full structure). 
  This is our AI-generated educational content, not copyrighted material.';

COMMENT ON COLUMN cached_blueprint_structures.structure IS 
  'DEPRECATED: Previously stored full structures. Now use cached_unit for single learning units.';

-- ============================================================================
-- STEP 8: CREATE CACHE HIT RATE TRACKING
-- ============================================================================

-- Table to track cache hit/miss statistics per blueprint generation
CREATE TABLE IF NOT EXISTS section_cache_metrics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  blueprint_id UUID REFERENCES blueprints(id) ON DELETE CASCADE,
  structure_id UUID REFERENCES blueprint_structures(id) ON DELETE CASCADE,
  
  -- Cache performance metrics
  total_sections INTEGER NOT NULL,
  cached_sections INTEGER NOT NULL,
  generated_sections INTEGER NOT NULL,
  cache_hit_rate FLOAT GENERATED ALWAYS AS (
    CASE 
      WHEN total_sections > 0 THEN cached_sections::FLOAT / total_sections::FLOAT
      ELSE 0
    END
  ) STORED,
  
  -- Token savings estimate
  estimated_tokens_saved INTEGER,
  estimated_time_saved_ms INTEGER,
  
  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS section_cache_metrics_blueprint_idx 
  ON section_cache_metrics(blueprint_id);

CREATE INDEX IF NOT EXISTS section_cache_metrics_structure_idx 
  ON section_cache_metrics(structure_id);

CREATE INDEX IF NOT EXISTS section_cache_metrics_hit_rate_idx 
  ON section_cache_metrics(cache_hit_rate DESC);

COMMENT ON TABLE section_cache_metrics IS 
  'Tracks cache hit/miss statistics for each blueprint structure generation.
  Used to measure the effectiveness of section-level caching.';

-- ============================================================================
-- STEP 9: CREATE FUNCTION TO LOG CACHE METRICS
-- ============================================================================

CREATE OR REPLACE FUNCTION log_section_cache_metrics(
  p_blueprint_id UUID,
  p_structure_id UUID,
  p_total_sections INTEGER,
  p_cached_sections INTEGER,
  p_generated_sections INTEGER,
  p_estimated_tokens_saved INTEGER DEFAULT NULL,
  p_estimated_time_saved_ms INTEGER DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  metric_id UUID;
BEGIN
  INSERT INTO section_cache_metrics (
    blueprint_id,
    structure_id,
    total_sections,
    cached_sections,
    generated_sections,
    estimated_tokens_saved,
    estimated_time_saved_ms
  ) VALUES (
    p_blueprint_id,
    p_structure_id,
    p_total_sections,
    p_cached_sections,
    p_generated_sections,
    p_estimated_tokens_saved,
    p_estimated_time_saved_ms
  )
  RETURNING id INTO metric_id;
  
  RETURN metric_id;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION log_section_cache_metrics IS 
  'Logs cache performance metrics for a blueprint structure generation.
  Call this after structure generation completes.';

-- ============================================================================
-- STEP 10: UPDATE RLS POLICIES (if needed)
-- ============================================================================

-- The existing RLS policies should still work, but let's ensure they're correct

-- Ensure authenticated users can read cached sections
DROP POLICY IF EXISTS "Anyone can read cached structures" ON cached_blueprint_structures;
CREATE POLICY "Authenticated users can read cached sections"
  ON cached_blueprint_structures
  FOR SELECT
  TO authenticated
  USING (true);

-- Ensure service role can manage cached sections
DROP POLICY IF EXISTS "Service role can manage cached structures" ON cached_blueprint_structures;
CREATE POLICY "Service role can manage cached sections"
  ON cached_blueprint_structures
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- RLS for metrics table
ALTER TABLE section_cache_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read their own cache metrics"
  ON section_cache_metrics
  FOR SELECT
  TO authenticated
  USING (
    blueprint_id IN (
      SELECT id FROM blueprints WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Service role can manage cache metrics"
  ON section_cache_metrics
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

-- Summary of changes:
-- ✅ Added section-level columns (section_id, section_type, section_embedding, etc.)
-- ✅ Created new vector index for section_embedding
-- ✅ Created search_similar_sections() function for cache lookup
-- ✅ Updated cache usage tracking functions
-- ✅ Created new statistics views for section-level caching
-- ✅ Created section_cache_metrics table for tracking performance
-- ✅ Updated RLS policies
-- ✅ Added comprehensive documentation

-- Next steps:
-- 1. Update Edge Functions to use new section-level caching
-- 2. Test with sample documents
-- 3. Monitor cache hit rates and token savings

-- ============================================================================
-- ROLLBACK SCRIPT (if needed)
-- ============================================================================

-- To rollback this migration, run:
-- DROP VIEW IF EXISTS section_cache_statistics CASCADE;
-- DROP VIEW IF EXISTS section_cache_performance CASCADE;
-- DROP TABLE IF EXISTS section_cache_metrics CASCADE;
-- DROP FUNCTION IF EXISTS search_similar_sections CASCADE;
-- DROP FUNCTION IF EXISTS increment_section_cache_usage CASCADE;
-- DROP FUNCTION IF EXISTS log_section_cache_metrics CASCADE;
-- DROP FUNCTION IF EXISTS migrate_full_structure_to_sections CASCADE;
-- ALTER TABLE cached_blueprint_structures DROP COLUMN IF EXISTS section_id;
-- ALTER TABLE cached_blueprint_structures DROP COLUMN IF EXISTS section_type;
-- ALTER TABLE cached_blueprint_structures DROP COLUMN IF EXISTS section_embedding;
-- ALTER TABLE cached_blueprint_structures DROP COLUMN IF EXISTS embedding_source;
-- ALTER TABLE cached_blueprint_structures DROP COLUMN IF EXISTS cached_unit;


