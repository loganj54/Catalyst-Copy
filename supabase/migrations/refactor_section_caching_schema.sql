-- ============================================================================
-- REFACTOR SECTION-LEVEL CACHING SCHEMA
-- ============================================================================
-- This migration refactors the cached_blueprint_structures table to properly
-- store ONE ROW PER SECTION with clear, meaningful columns.
-- ============================================================================

-- ============================================================================
-- STEP 1: DROP OLD UNNECESSARY COLUMNS
-- ============================================================================

ALTER TABLE cached_blueprint_structures 
DROP COLUMN IF EXISTS subject_embedding CASCADE;

ALTER TABLE cached_blueprint_structures 
DROP COLUMN IF EXISTS topics_embedding CASCADE;

ALTER TABLE cached_blueprint_structures 
DROP COLUMN IF EXISTS characteristics_embedding CASCADE;

ALTER TABLE cached_blueprint_structures 
DROP COLUMN IF EXISTS topics CASCADE;

ALTER TABLE cached_blueprint_structures 
DROP COLUMN IF EXISTS num_sections CASCADE;

ALTER TABLE cached_blueprint_structures 
DROP COLUMN IF EXISTS num_problems CASCADE;

ALTER TABLE cached_blueprint_structures 
DROP COLUMN IF EXISTS has_equations CASCADE;

ALTER TABLE cached_blueprint_structures 
DROP COLUMN IF EXISTS user_satisfaction CASCADE;

-- Keep the old 'structure' column for backwards compatibility during migration
-- but we'll primarily use 'cached_unit' going forward

-- ============================================================================
-- STEP 2: ADD NEW CLEAR COLUMNS
-- ============================================================================

-- Section/Problem identification
ALTER TABLE cached_blueprint_structures 
ADD COLUMN IF NOT EXISTS section_title TEXT;

COMMENT ON COLUMN cached_blueprint_structures.section_title IS 
  'The title/name of the section or problem (e.g., "Problem 1: Thermodynamics", "Topic: Newton''s Laws")';

-- Problem-specific fields (for section_type = 'problem')
ALTER TABLE cached_blueprint_structures 
ADD COLUMN IF NOT EXISTS problem_statement_text TEXT;

ALTER TABLE cached_blueprint_structures 
ADD COLUMN IF NOT EXISTS problem_statement_embedding VECTOR(1536);

COMMENT ON COLUMN cached_blueprint_structures.problem_statement_text IS 
  'The complete problem statement text (for problems only). NULL for topics.';

COMMENT ON COLUMN cached_blueprint_structures.problem_statement_embedding IS 
  'Vector embedding of the problem statement (for problems only). NULL for topics.';

-- Topic-specific fields (for section_type = 'topic')
ALTER TABLE cached_blueprint_structures 
ADD COLUMN IF NOT EXISTS topic_summary_text TEXT;

ALTER TABLE cached_blueprint_structures 
ADD COLUMN IF NOT EXISTS topic_summary_embedding VECTOR(1536);

COMMENT ON COLUMN cached_blueprint_structures.topic_summary_text IS 
  'The topic summary text (for topics only). NULL for problems.';

COMMENT ON COLUMN cached_blueprint_structures.topic_summary_embedding IS 
  'Vector embedding of topic_summary + concepts_tested (for topics only). NULL for problems.';

-- Concepts tested (common to both)
ALTER TABLE cached_blueprint_structures 
ADD COLUMN IF NOT EXISTS concepts_tested TEXT[];

COMMENT ON COLUMN cached_blueprint_structures.concepts_tested IS 
  'Array of concepts tested/covered in this section (both problems and topics)';

-- Rename section_embedding to primary_embedding for clarity (if it exists)
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'cached_blueprint_structures' 
    AND column_name = 'section_embedding'
  ) THEN
    ALTER TABLE cached_blueprint_structures 
    RENAME COLUMN section_embedding TO primary_embedding;
  ELSE
    -- If section_embedding doesn't exist, create primary_embedding directly
    ALTER TABLE cached_blueprint_structures 
    ADD COLUMN IF NOT EXISTS primary_embedding VECTOR(1536);
  END IF;
END $$;

COMMENT ON COLUMN cached_blueprint_structures.primary_embedding IS 
  'Primary embedding used for similarity search. 
  For problems: same as problem_statement_embedding.
  For topics: same as topic_summary_embedding.';

-- ============================================================================
-- STEP 3: UPDATE INDEXES
-- ============================================================================

-- Drop old indexes if they exist
DROP INDEX IF EXISTS cached_structures_section_embedding_idx;
DROP INDEX IF EXISTS cached_structures_subject_embedding_idx;
DROP INDEX IF EXISTS cached_structures_topics_embedding_idx;
DROP INDEX IF EXISTS cached_structures_characteristics_embedding_idx;

-- Create new index on primary_embedding
CREATE INDEX IF NOT EXISTS cached_structures_primary_embedding_idx 
  ON cached_blueprint_structures 
  USING ivfflat (primary_embedding vector_cosine_ops)
  WITH (lists = 100);

-- Create indexes for problem-specific searches
CREATE INDEX IF NOT EXISTS cached_structures_problem_embedding_idx 
  ON cached_blueprint_structures 
  USING ivfflat (problem_statement_embedding vector_cosine_ops)
  WITH (lists = 100)
  WHERE problem_statement_embedding IS NOT NULL;

-- Create indexes for topic-specific searches
CREATE INDEX IF NOT EXISTS cached_structures_topic_embedding_idx 
  ON cached_blueprint_structures 
  USING ivfflat (topic_summary_embedding vector_cosine_ops)
  WITH (lists = 100)
  WHERE topic_summary_embedding IS NOT NULL;

-- Add index for section title searches
CREATE INDEX IF NOT EXISTS cached_structures_section_title_idx 
  ON cached_blueprint_structures(section_title);

-- Add GIN index for concepts_tested array searches
CREATE INDEX IF NOT EXISTS cached_structures_concepts_tested_idx 
  ON cached_blueprint_structures USING GIN(concepts_tested);

-- ============================================================================
-- STEP 4: UPDATE SEARCH FUNCTION
-- ============================================================================

DROP FUNCTION IF EXISTS search_similar_sections CASCADE;

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
  section_title TEXT,
  problem_statement_text TEXT,
  topic_summary_text TEXT,
  concepts_tested TEXT[],
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
    cbs.section_title,
    cbs.problem_statement_text,
    cbs.topic_summary_text,
    cbs.concepts_tested,
    -- Calculate cosine similarity using primary_embedding
    (1 - (cbs.primary_embedding <=> query_embedding)) AS similarity,
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
    AND (1 - (cbs.primary_embedding <=> query_embedding)) >= similarity_threshold
    -- Ensure we have a cached unit
    AND cbs.cached_unit IS NOT NULL
    -- Ensure we have the primary embedding
    AND cbs.primary_embedding IS NOT NULL
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
  Returns the most similar cached unit for a given section embedding with full section details.';

-- ============================================================================
-- STEP 5: CREATE HELPER FUNCTION TO EXTRACT SECTION DETAILS
-- ============================================================================

CREATE OR REPLACE FUNCTION get_section_cache_details(cache_id UUID)
RETURNS TABLE (
  section_id TEXT,
  section_type TEXT,
  section_title TEXT,
  problem_statement_text TEXT,
  topic_summary_text TEXT,
  concepts_tested TEXT[],
  subject_area TEXT,
  times_used INTEGER,
  quality_score FLOAT,
  created_at TIMESTAMP WITH TIME ZONE,
  last_used_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    cbs.section_id,
    cbs.section_type,
    cbs.section_title,
    cbs.problem_statement_text,
    cbs.topic_summary_text,
    cbs.concepts_tested,
    cbs.subject_area,
    cbs.times_used,
    cbs.quality_score,
    cbs.created_at,
    cbs.last_used_at
  FROM cached_blueprint_structures cbs
  WHERE cbs.id = cache_id;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION get_section_cache_details IS 
  'Retrieves detailed information about a cached section by its ID.';

-- ============================================================================
-- STEP 6: UPDATE STATISTICS VIEWS
-- ============================================================================

DROP VIEW IF EXISTS section_cache_statistics CASCADE;

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
  SUM(times_used) * 1000 as estimated_tokens_saved,
  -- Count sections with embeddings
  COUNT(*) FILTER (WHERE primary_embedding IS NOT NULL) as sections_with_embeddings,
  COUNT(*) FILTER (WHERE problem_statement_embedding IS NOT NULL) as problems_with_embeddings,
  COUNT(*) FILTER (WHERE topic_summary_embedding IS NOT NULL) as topics_with_embeddings
FROM cached_blueprint_structures
WHERE cached_unit IS NOT NULL;

COMMENT ON VIEW section_cache_statistics IS 
  'Provides overview statistics for section-level caching system with embedding counts.';

DROP VIEW IF EXISTS section_cache_performance CASCADE;

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
  SUM(times_used) * 1000 as estimated_tokens_saved,
  -- Most common concepts
  (
    SELECT array_agg(DISTINCT concept)
    FROM (
      SELECT unnest(concepts_tested) as concept
      FROM cached_blueprint_structures cbs2
      WHERE cbs2.subject_area = cbs.subject_area 
        AND cbs2.section_type = cbs.section_type
      LIMIT 10
    ) concepts
  ) as common_concepts
FROM cached_blueprint_structures cbs
WHERE cached_unit IS NOT NULL
GROUP BY subject_area, section_type
ORDER BY total_uses DESC;

COMMENT ON VIEW section_cache_performance IS 
  'Shows cache performance broken down by subject area and section type with common concepts.';

-- ============================================================================
-- STEP 7: CREATE VIEW FOR DEBUGGING/INSPECTION
-- ============================================================================

CREATE OR REPLACE VIEW section_cache_inspection AS
SELECT
  id,
  section_id,
  section_type,
  section_title,
  subject_area,
  specific_topic,
  document_type,
  CASE 
    WHEN section_type = 'problem' THEN 
      substring(problem_statement_text, 1, 100) || '...'
    WHEN section_type = 'topic' THEN 
      substring(topic_summary_text, 1, 100) || '...'
    ELSE NULL
  END as content_preview,
  concepts_tested,
  times_used,
  quality_score,
  primary_embedding IS NOT NULL as has_primary_embedding,
  problem_statement_embedding IS NOT NULL as has_problem_embedding,
  topic_summary_embedding IS NOT NULL as has_topic_embedding,
  cached_unit IS NOT NULL as has_cached_unit,
  created_at,
  last_used_at
FROM cached_blueprint_structures
ORDER BY created_at DESC;

COMMENT ON VIEW section_cache_inspection IS 
  'Inspection view for debugging cached sections with content previews and embedding status.';

-- ============================================================================
-- STEP 8: ADD CONSTRAINTS FOR DATA INTEGRITY
-- ============================================================================

-- Ensure problem sections have problem-specific fields
ALTER TABLE cached_blueprint_structures
ADD CONSTRAINT check_problem_fields 
CHECK (
  section_type != 'problem' OR (
    problem_statement_text IS NOT NULL AND
    problem_statement_embedding IS NOT NULL
  )
);

-- Ensure topic sections have topic-specific fields
ALTER TABLE cached_blueprint_structures
ADD CONSTRAINT check_topic_fields 
CHECK (
  section_type != 'topic' OR (
    topic_summary_text IS NOT NULL AND
    topic_summary_embedding IS NOT NULL
  )
);

-- Ensure primary_embedding matches the appropriate specific embedding
-- (This is enforced in application logic, but we document it here)

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

-- Summary of changes:
-- ✅ Removed unnecessary columns (old embeddings, topics, num_sections, etc.)
-- ✅ Added clear, meaningful columns (section_title, problem_statement_text, etc.)
-- ✅ Separated problem and topic embeddings for clarity
-- ✅ Added concepts_tested array
-- ✅ Updated indexes for better performance
-- ✅ Updated search function to return full section details
-- ✅ Created helper functions and views
-- ✅ Added data integrity constraints

-- Next steps:
-- 1. Update Edge Functions to populate new columns
-- 2. Test with sample sections
-- 3. Verify one row per section is created



