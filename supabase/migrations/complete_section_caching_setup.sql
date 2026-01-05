-- ============================================================================
-- COMPLETE SECTION-LEVEL CACHING SETUP
-- ============================================================================
-- This migration sets up section-level caching from scratch OR updates existing.
-- Safe to run on both new and existing databases.
-- ============================================================================

-- ============================================================================
-- STEP 1: ENSURE TABLE EXISTS
-- ============================================================================

CREATE TABLE IF NOT EXISTS cached_blueprint_structures (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- STEP 2: REMOVE OLD UNNECESSARY COLUMNS (if they exist)
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

ALTER TABLE cached_blueprint_structures 
DROP COLUMN IF EXISTS structure CASCADE;

-- ============================================================================
-- STEP 3: ADD ALL REQUIRED COLUMNS
-- ============================================================================

-- Core identification
ALTER TABLE cached_blueprint_structures 
ADD COLUMN IF NOT EXISTS section_id TEXT;

ALTER TABLE cached_blueprint_structures 
ADD COLUMN IF NOT EXISTS section_type TEXT CHECK (section_type IN ('problem', 'topic'));

ALTER TABLE cached_blueprint_structures 
ADD COLUMN IF NOT EXISTS section_title TEXT;

-- Primary embedding (rename from section_embedding if it exists, or create new)
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
    ALTER TABLE cached_blueprint_structures 
    ADD COLUMN IF NOT EXISTS primary_embedding VECTOR(1536);
  END IF;
END $$;

-- Problem-specific fields
ALTER TABLE cached_blueprint_structures 
ADD COLUMN IF NOT EXISTS problem_statement_text TEXT;

ALTER TABLE cached_blueprint_structures 
ADD COLUMN IF NOT EXISTS problem_statement_embedding VECTOR(1536);

-- Topic-specific fields
ALTER TABLE cached_blueprint_structures 
ADD COLUMN IF NOT EXISTS topic_summary_text TEXT;

ALTER TABLE cached_blueprint_structures 
ADD COLUMN IF NOT EXISTS topic_summary_embedding VECTOR(1536);

-- Common fields
ALTER TABLE cached_blueprint_structures 
ADD COLUMN IF NOT EXISTS concepts_tested TEXT[];

ALTER TABLE cached_blueprint_structures 
ADD COLUMN IF NOT EXISTS embedding_source TEXT;

ALTER TABLE cached_blueprint_structures 
ADD COLUMN IF NOT EXISTS cached_unit JSONB;

-- Metadata fields
ALTER TABLE cached_blueprint_structures 
ADD COLUMN IF NOT EXISTS subject_area TEXT;

ALTER TABLE cached_blueprint_structures 
ADD COLUMN IF NOT EXISTS specific_topic TEXT;

ALTER TABLE cached_blueprint_structures 
ADD COLUMN IF NOT EXISTS document_type TEXT;

ALTER TABLE cached_blueprint_structures 
ADD COLUMN IF NOT EXISTS course_level TEXT;

-- Quality metrics
ALTER TABLE cached_blueprint_structures 
ADD COLUMN IF NOT EXISTS times_used INTEGER DEFAULT 0;

ALTER TABLE cached_blueprint_structures 
ADD COLUMN IF NOT EXISTS quality_score FLOAT DEFAULT 1.0;

ALTER TABLE cached_blueprint_structures 
ADD COLUMN IF NOT EXISTS last_used_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Source tracking
ALTER TABLE cached_blueprint_structures 
ADD COLUMN IF NOT EXISTS source_analysis_id UUID;

-- Keep old 'structure' column for backwards compatibility
ALTER TABLE cached_blueprint_structures 
ADD COLUMN IF NOT EXISTS structure JSONB;

-- ============================================================================
-- STEP 4: ADD COMMENTS
-- ============================================================================

COMMENT ON TABLE cached_blueprint_structures IS 
  'Stores cached learning units at the section level (one row per section).
  Each section (problem or topic) is cached individually for granular reuse.';

COMMENT ON COLUMN cached_blueprint_structures.section_id IS 
  'Original section ID from document analysis (e.g., "Problem 1", "Topic 2")';

COMMENT ON COLUMN cached_blueprint_structures.section_type IS 
  'Type of section: "problem" (homework problem) or "topic" (lecture content)';

COMMENT ON COLUMN cached_blueprint_structures.section_title IS 
  'The title/name of the section or problem (e.g., "Problem 1: Thermodynamics")';

COMMENT ON COLUMN cached_blueprint_structures.primary_embedding IS 
  'Primary embedding used for similarity search. 
  For problems: same as problem_statement_embedding.
  For topics: same as topic_summary_embedding.';

COMMENT ON COLUMN cached_blueprint_structures.problem_statement_text IS 
  'The complete problem statement text (for problems only). NULL for topics.';

COMMENT ON COLUMN cached_blueprint_structures.problem_statement_embedding IS 
  'Vector embedding of the problem statement (for problems only). NULL for topics.';

COMMENT ON COLUMN cached_blueprint_structures.topic_summary_text IS 
  'The topic summary text (for topics only). NULL for problems.';

COMMENT ON COLUMN cached_blueprint_structures.topic_summary_embedding IS 
  'Vector embedding of topic_summary + concepts_tested (for topics only). NULL for problems.';

COMMENT ON COLUMN cached_blueprint_structures.concepts_tested IS 
  'Array of concepts tested/covered in this section (both problems and topics)';

COMMENT ON COLUMN cached_blueprint_structures.cached_unit IS 
  'The generated learning unit structure (single unit or multiple units). 
  This is our AI-generated educational content, not copyrighted material.';

-- ============================================================================
-- STEP 5: CREATE/UPDATE INDEXES
-- ============================================================================

-- Drop old indexes if they exist
DROP INDEX IF EXISTS cached_structures_section_embedding_idx;
DROP INDEX IF EXISTS cached_structures_subject_embedding_idx;
DROP INDEX IF EXISTS cached_structures_topics_embedding_idx;
DROP INDEX IF EXISTS cached_structures_characteristics_embedding_idx;

-- Create new indexes
CREATE INDEX IF NOT EXISTS cached_structures_primary_embedding_idx 
  ON cached_blueprint_structures 
  USING ivfflat (primary_embedding vector_cosine_ops)
  WITH (lists = 100);

CREATE INDEX IF NOT EXISTS cached_structures_problem_embedding_idx 
  ON cached_blueprint_structures 
  USING ivfflat (problem_statement_embedding vector_cosine_ops)
  WITH (lists = 100)
  WHERE problem_statement_embedding IS NOT NULL;

CREATE INDEX IF NOT EXISTS cached_structures_topic_embedding_idx 
  ON cached_blueprint_structures 
  USING ivfflat (topic_summary_embedding vector_cosine_ops)
  WITH (lists = 100)
  WHERE topic_summary_embedding IS NOT NULL;

CREATE INDEX IF NOT EXISTS cached_structures_section_id_idx 
  ON cached_blueprint_structures(section_id);

CREATE INDEX IF NOT EXISTS cached_structures_section_type_idx 
  ON cached_blueprint_structures(section_type);

CREATE INDEX IF NOT EXISTS cached_structures_section_title_idx 
  ON cached_blueprint_structures(section_title);

CREATE INDEX IF NOT EXISTS cached_structures_subject_area_idx 
  ON cached_blueprint_structures(subject_area);

CREATE INDEX IF NOT EXISTS cached_structures_document_type_idx 
  ON cached_blueprint_structures(document_type);

CREATE INDEX IF NOT EXISTS cached_structures_concepts_tested_idx 
  ON cached_blueprint_structures USING GIN(concepts_tested);

CREATE INDEX IF NOT EXISTS cached_structures_times_used_idx 
  ON cached_blueprint_structures(times_used DESC);

CREATE INDEX IF NOT EXISTS cached_structures_last_used_idx 
  ON cached_blueprint_structures(last_used_at DESC);

-- ============================================================================
-- STEP 6: ADD DATA INTEGRITY CONSTRAINTS
-- ============================================================================

-- Drop existing constraints if they exist
ALTER TABLE cached_blueprint_structures
DROP CONSTRAINT IF EXISTS check_problem_fields;

ALTER TABLE cached_blueprint_structures
DROP CONSTRAINT IF EXISTS check_topic_fields;

-- Add constraints
ALTER TABLE cached_blueprint_structures
ADD CONSTRAINT check_problem_fields 
CHECK (
  section_type != 'problem' OR (
    problem_statement_text IS NOT NULL AND
    problem_statement_embedding IS NOT NULL
  )
);

ALTER TABLE cached_blueprint_structures
ADD CONSTRAINT check_topic_fields 
CHECK (
  section_type != 'topic' OR (
    topic_summary_text IS NOT NULL AND
    topic_summary_embedding IS NOT NULL
  )
);

-- ============================================================================
-- STEP 7: CREATE/UPDATE FUNCTIONS
-- ============================================================================

-- Drop existing functions
DROP FUNCTION IF EXISTS search_similar_sections CASCADE;
DROP FUNCTION IF EXISTS increment_section_cache_usage CASCADE;
DROP FUNCTION IF EXISTS get_section_cache_details CASCADE;

-- Create search function
CREATE FUNCTION search_similar_sections(
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
    (1 - (cbs.primary_embedding <=> query_embedding)) AS similarity,
    cbs.times_used,
    cbs.quality_score,
    cbs.last_used_at,
    cbs.embedding_source
  FROM cached_blueprint_structures cbs
  WHERE 
    cbs.section_type = p_section_type
    AND cbs.subject_area = p_subject_area
    AND cbs.document_type = p_document_type
    AND (1 - (cbs.primary_embedding <=> query_embedding)) >= similarity_threshold
    AND cbs.cached_unit IS NOT NULL
    AND cbs.primary_embedding IS NOT NULL
  ORDER BY 
    similarity DESC,
    quality_score DESC,
    times_used DESC
  LIMIT max_results;
END;
$$ LANGUAGE plpgsql STABLE;

-- Create increment usage function
CREATE FUNCTION increment_section_cache_usage(cache_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE cached_blueprint_structures
  SET 
    times_used = times_used + 1,
    last_used_at = NOW()
  WHERE id = cache_id;
END;
$$ LANGUAGE plpgsql;

-- Create details retrieval function
CREATE FUNCTION get_section_cache_details(cache_id UUID)
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

-- ============================================================================
-- STEP 8: CREATE CACHE METRICS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS section_cache_metrics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  blueprint_id UUID,
  structure_id UUID,
  total_sections INTEGER NOT NULL,
  cached_sections INTEGER NOT NULL,
  generated_sections INTEGER NOT NULL,
  cache_hit_rate FLOAT GENERATED ALWAYS AS (
    CASE 
      WHEN total_sections > 0 THEN cached_sections::FLOAT / total_sections::FLOAT
      ELSE 0
    END
  ) STORED,
  estimated_tokens_saved INTEGER,
  estimated_time_saved_ms INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS section_cache_metrics_blueprint_idx 
  ON section_cache_metrics(blueprint_id);

CREATE INDEX IF NOT EXISTS section_cache_metrics_structure_idx 
  ON section_cache_metrics(structure_id);

CREATE INDEX IF NOT EXISTS section_cache_metrics_hit_rate_idx 
  ON section_cache_metrics(cache_hit_rate DESC);

-- Create logging function
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

-- ============================================================================
-- STEP 9: CREATE VIEWS
-- ============================================================================

DROP VIEW IF EXISTS section_cache_statistics CASCADE;
DROP VIEW IF EXISTS section_cache_performance CASCADE;
DROP VIEW IF EXISTS section_cache_inspection CASCADE;

CREATE VIEW section_cache_statistics AS
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
  SUM(times_used) * 1000 as estimated_tokens_saved,
  COUNT(*) FILTER (WHERE primary_embedding IS NOT NULL) as sections_with_embeddings,
  COUNT(*) FILTER (WHERE problem_statement_embedding IS NOT NULL) as problems_with_embeddings,
  COUNT(*) FILTER (WHERE topic_summary_embedding IS NOT NULL) as topics_with_embeddings
FROM cached_blueprint_structures
WHERE cached_unit IS NOT NULL;

CREATE VIEW section_cache_performance AS
SELECT
  subject_area,
  section_type,
  COUNT(*) as section_count,
  SUM(times_used) as total_uses,
  AVG(times_used) as avg_uses_per_section,
  AVG(quality_score) as avg_quality,
  MAX(last_used_at) as most_recent_use,
  SUM(times_used) * 1000 as estimated_tokens_saved
FROM cached_blueprint_structures
WHERE cached_unit IS NOT NULL
GROUP BY subject_area, section_type
ORDER BY total_uses DESC;

CREATE VIEW section_cache_inspection AS
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

-- ============================================================================
-- STEP 10: ENABLE RLS
-- ============================================================================

ALTER TABLE cached_blueprint_structures ENABLE ROW LEVEL SECURITY;
ALTER TABLE section_cache_metrics ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "Authenticated users can read cached sections" ON cached_blueprint_structures;
DROP POLICY IF EXISTS "Service role can manage cached sections" ON cached_blueprint_structures;
DROP POLICY IF EXISTS "Users can read their own cache metrics" ON section_cache_metrics;
DROP POLICY IF EXISTS "Service role can manage cache metrics" ON section_cache_metrics;

-- Create policies
CREATE POLICY "Authenticated users can read cached sections"
  ON cached_blueprint_structures
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Service role can manage cached sections"
  ON cached_blueprint_structures
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role can manage cache metrics"
  ON section_cache_metrics
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

-- Verify setup
DO $$
DECLARE
  column_count INTEGER;
  index_count INTEGER;
  function_count INTEGER;
  view_count INTEGER;
BEGIN
  -- Count columns
  SELECT COUNT(*) INTO column_count
  FROM information_schema.columns
  WHERE table_name = 'cached_blueprint_structures'
    AND column_name IN (
      'section_id', 'section_type', 'section_title',
      'primary_embedding', 'problem_statement_text', 'problem_statement_embedding',
      'topic_summary_text', 'topic_summary_embedding', 'concepts_tested'
    );
  
  -- Count indexes
  SELECT COUNT(*) INTO index_count
  FROM pg_indexes
  WHERE tablename = 'cached_blueprint_structures'
    AND indexname LIKE '%embedding%';
  
  -- Count functions
  SELECT COUNT(*) INTO function_count
  FROM pg_proc
  WHERE proname IN ('search_similar_sections', 'increment_section_cache_usage', 'log_section_cache_metrics');
  
  -- Count views
  SELECT COUNT(*) INTO view_count
  FROM pg_views
  WHERE viewname IN ('section_cache_statistics', 'section_cache_performance', 'section_cache_inspection');
  
  RAISE NOTICE 'Migration verification:';
  RAISE NOTICE '  - Columns created: %', column_count;
  RAISE NOTICE '  - Indexes created: %', index_count;
  RAISE NOTICE '  - Functions created: %', function_count;
  RAISE NOTICE '  - Views created: %', view_count;
  
  IF column_count >= 9 AND index_count >= 3 AND function_count >= 3 AND view_count >= 3 THEN
    RAISE NOTICE '✅ Migration completed successfully!';
  ELSE
    RAISE WARNING '⚠️  Migration may be incomplete. Please verify manually.';
  END IF;
END $$;


