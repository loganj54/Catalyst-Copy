-- ============================================================================
-- PROBLEM-LEVEL STRUCTURE CACHING SYSTEM (GRANULAR)
-- ============================================================================
-- Caches learning structures at the PROBLEM/SECTION level, not entire documents.
-- This dramatically improves cache hit rates because similar problems across
-- different documents can reuse the same learning structure.
-- 
-- EXAMPLE: Two different homework assignments both have a "Fourier Transform" 
-- problem - the second one can reuse the cached learning structure from the first.
-- ============================================================================

-- Create the problem-level cached structures table
CREATE TABLE IF NOT EXISTS cached_section_structures (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Vector embeddings for semantic matching of INDIVIDUAL problems/sections
  concepts_embedding VECTOR(1536),          -- Main concepts tested/taught
  problem_type_embedding VECTOR(1536),      -- Type of problem/section
  context_embedding VECTOR(1536),           -- Additional context
  
  -- Metadata for filtering (searchable, no copyright issues)
  subject_area TEXT NOT NULL,               -- 'Physics', 'Math', 'Engineering', etc.
  section_type TEXT NOT NULL,               -- 'problem' or 'topic'
  concepts JSONB,                           -- Array of concept strings
  problem_category TEXT,                    -- 'calculation', 'derivation', 'conceptual', etc.
  difficulty_level TEXT,                    -- 'introductory', 'intermediate', 'advanced'
  has_equations BOOLEAN DEFAULT false,
  
  -- The cached learning structure (OUR generated content, NOT copyrighted)
  -- This is the learning_units array for this specific problem/section
  learning_structure JSONB NOT NULL,
  
  -- Quality metrics
  times_used INTEGER DEFAULT 0,
  quality_score FLOAT DEFAULT 0.5,
  avg_user_rating FLOAT,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_used_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Optional: track source
  source_section_id TEXT,                   -- e.g., "Problem 1", "Topic 2"
  source_analysis_id UUID REFERENCES document_analyses(id) ON DELETE SET NULL
);

-- Create vector similarity indexes
CREATE INDEX IF NOT EXISTS cached_section_concepts_embedding_idx 
  ON cached_section_structures 
  USING ivfflat (concepts_embedding vector_cosine_ops)
  WITH (lists = 100);

CREATE INDEX IF NOT EXISTS cached_section_problem_type_embedding_idx 
  ON cached_section_structures 
  USING ivfflat (problem_type_embedding vector_cosine_ops)
  WITH (lists = 100);

CREATE INDEX IF NOT EXISTS cached_section_context_embedding_idx 
  ON cached_section_structures 
  USING ivfflat (context_embedding vector_cosine_ops)
  WITH (lists = 100);

-- Create indexes for filtering and sorting
CREATE INDEX IF NOT EXISTS cached_section_subject_area_idx 
  ON cached_section_structures(subject_area);

CREATE INDEX IF NOT EXISTS cached_section_section_type_idx 
  ON cached_section_structures(section_type);

CREATE INDEX IF NOT EXISTS cached_section_difficulty_idx 
  ON cached_section_structures(difficulty_level);

CREATE INDEX IF NOT EXISTS cached_section_quality_idx 
  ON cached_section_structures(quality_score DESC);

CREATE INDEX IF NOT EXISTS cached_section_times_used_idx 
  ON cached_section_structures(times_used DESC);

-- ============================================================================
-- SEARCH FOR SIMILAR SECTION STRUCTURE
-- ============================================================================
-- Searches for cached learning structures for similar problems/sections
-- Uses weighted combination of concept, problem type, and context embeddings
-- ============================================================================

CREATE OR REPLACE FUNCTION search_similar_section_structures(
  query_concepts_embedding VECTOR(1536),
  query_problem_type_embedding VECTOR(1536),
  query_context_embedding VECTOR(1536),
  p_subject_area TEXT,
  p_section_type TEXT,
  similarity_threshold FLOAT DEFAULT 0.88,
  max_results INTEGER DEFAULT 3
)
RETURNS TABLE (
  id UUID,
  learning_structure JSONB,
  concepts JSONB,
  problem_category TEXT,
  similarity FLOAT,
  times_used INTEGER,
  quality_score FLOAT,
  last_used_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    css.id,
    css.learning_structure,
    css.concepts,
    css.problem_category,
    -- Weighted similarity score (concepts 50%, problem type 30%, context 20%)
    (
      (1 - (css.concepts_embedding <=> query_concepts_embedding)) * 0.5 +
      (1 - (css.problem_type_embedding <=> query_problem_type_embedding)) * 0.3 +
      (1 - (css.context_embedding <=> query_context_embedding)) * 0.2
    ) AS similarity,
    css.times_used,
    css.quality_score,
    css.last_used_at
  FROM cached_section_structures css
  WHERE 
    -- Filter by exact matches first for performance
    css.subject_area = p_subject_area
    AND css.section_type = p_section_type
    -- Then filter by similarity threshold
    AND (
      (1 - (css.concepts_embedding <=> query_concepts_embedding)) * 0.5 +
      (1 - (css.problem_type_embedding <=> query_problem_type_embedding)) * 0.3 +
      (1 - (css.context_embedding <=> query_context_embedding)) * 0.2
    ) >= similarity_threshold
  ORDER BY 
    -- Prioritize: similarity first, then quality, then usage
    similarity DESC,
    quality_score DESC,
    times_used DESC
  LIMIT max_results;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================================
-- UPDATE SECTION CACHE USAGE STATS
-- ============================================================================

CREATE OR REPLACE FUNCTION increment_section_cache_usage(cache_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE cached_section_structures
  SET 
    times_used = times_used + 1,
    last_used_at = NOW()
  WHERE id = cache_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- UPDATE SECTION CACHE QUALITY
-- ============================================================================

CREATE OR REPLACE FUNCTION update_section_cache_quality(
  cache_id UUID,
  new_quality_score FLOAT
)
RETURNS VOID AS $$
BEGIN
  UPDATE cached_section_structures
  SET 
    quality_score = (
      -- Exponential moving average: 70% old, 30% new
      COALESCE(quality_score, 0.5) * 0.7 + new_quality_score * 0.3
    ),
    avg_user_rating = new_quality_score
  WHERE id = cache_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- TRACK CACHE SOURCES IN CONTENT_SECTIONS
-- ============================================================================
-- Add columns to content_sections in blueprint_structures to track which
-- sections came from cache vs AI generation
-- ============================================================================

-- Note: blueprint_structures.structure is JSONB containing content_sections array
-- We'll track cache info at the section level within the JSONB structure itself
-- This is done in the application layer when building the structure

-- ============================================================================
-- CACHE STATISTICS VIEWS
-- ============================================================================

CREATE OR REPLACE VIEW section_cache_statistics AS
SELECT
  COUNT(*) as total_cached_sections,
  COUNT(DISTINCT subject_area) as unique_subjects,
  COUNT(DISTINCT problem_category) as unique_problem_types,
  AVG(times_used) as avg_times_used,
  AVG(quality_score) as avg_quality_score,
  MAX(times_used) as max_times_used,
  SUM(CASE WHEN times_used > 0 THEN 1 ELSE 0 END) as used_sections,
  SUM(CASE WHEN times_used = 0 THEN 1 ELSE 0 END) as unused_sections,
  SUM(times_used * 3000) as estimated_tokens_saved  -- ~3,000 tokens saved per section reuse
FROM cached_section_structures;

CREATE OR REPLACE VIEW section_cache_performance_by_subject AS
SELECT
  subject_area,
  section_type,
  COUNT(*) as structure_count,
  SUM(times_used) as total_uses,
  AVG(times_used) as avg_uses_per_structure,
  AVG(quality_score) as avg_quality,
  MAX(last_used_at) as most_recent_use,
  SUM(times_used * 3000) as estimated_tokens_saved
FROM cached_section_structures
GROUP BY subject_area, section_type
ORDER BY total_uses DESC;

-- ============================================================================
-- MOST VALUABLE CACHED SECTIONS
-- ============================================================================

CREATE OR REPLACE VIEW most_valuable_cached_sections AS
SELECT
  id,
  subject_area,
  section_type,
  concepts,
  problem_category,
  times_used,
  quality_score,
  times_used * 3000 as estimated_tokens_saved,
  created_at,
  last_used_at
FROM cached_section_structures
WHERE times_used > 0
ORDER BY times_used DESC, quality_score DESC
LIMIT 50;

-- ============================================================================
-- ENABLE ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE cached_section_structures ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read cached structures (they contain no private data)
CREATE POLICY "Anyone can read cached section structures"
  ON cached_section_structures
  FOR SELECT
  TO authenticated
  USING (true);

-- Only service role can insert/update (done by Edge Functions)
CREATE POLICY "Service role can manage cached section structures"
  ON cached_section_structures
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- ADD COMMENTS FOR DOCUMENTATION
-- ============================================================================

COMMENT ON TABLE cached_section_structures IS 
  'Caches learning structures at the PROBLEM/SECTION level (not entire documents) for granular reuse. Stores OUR generated content, NOT copyrighted material.';

COMMENT ON COLUMN cached_section_structures.learning_structure IS 
  'Our AI-generated learning structure for this specific problem/section. Contains learning_units array with search queries and guidance.';

COMMENT ON COLUMN cached_section_structures.concepts IS 
  'Array of concepts tested/taught in this section, used for semantic matching.';

COMMENT ON FUNCTION search_similar_section_structures IS 
  'Searches for cached learning structures for similar problems/sections using weighted vector similarity (concepts 50%, type 30%, context 20%).';

COMMENT ON VIEW section_cache_statistics IS 
  'Overall statistics about the section-level cache performance and token savings.';

-- ============================================================================
-- MIGRATION COMPLETE - PROBLEM-LEVEL CACHING
-- ============================================================================
-- 
-- This system allows:
-- 1. Each problem/section to be cached independently
-- 2. Similar problems across different documents to reuse structures
-- 3. Much higher cache hit rates (don't need identical documents)
-- 4. Granular quality tracking per problem type
-- 5. ~3,000 tokens saved per section cache hit
-- 
-- Example: Homework 1 has 7 problems, Homework 2 has 7 different problems
-- If 3 problems are similar (e.g., both have Fourier Transform problems),
-- those 3 can reuse cached structures, saving ~9,000 tokens.
-- ============================================================================

