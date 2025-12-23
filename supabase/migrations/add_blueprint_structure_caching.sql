-- ============================================================================
-- BLUEPRINT STRUCTURE CACHING SYSTEM
-- ============================================================================
-- Caches generated blueprint structures using vector embeddings to dramatically
-- reduce token usage by reusing structures for similar documents.
-- 
-- IMPORTANT: This stores OUR GENERATED CONTENT (learning structures), NOT
-- copyrighted material. We store metadata (subjects, topics) and our AI-generated
-- learning paths, which is 100% legal and copyright-safe.
-- ============================================================================

-- Create the cached structures table
CREATE TABLE IF NOT EXISTS cached_blueprint_structures (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Vector embeddings for semantic matching
  subject_embedding VECTOR(1536),
  topics_embedding VECTOR(1536),
  characteristics_embedding VECTOR(1536),
  
  -- Metadata (searchable, no copyright issues)
  subject_area TEXT NOT NULL,
  specific_topic TEXT,
  topics JSONB,  -- Array of topic strings
  course_level TEXT,  -- 'introductory', 'intermediate', 'advanced', 'graduate'
  document_type TEXT NOT NULL,  -- 'problem_set', 'lecture', 'hybrid', 'textbook', 'study_guide'
  num_sections INTEGER,
  num_problems INTEGER,
  has_equations BOOLEAN DEFAULT false,
  
  -- The cached structure (our generated content, NOT copyrighted)
  structure JSONB NOT NULL,
  
  -- Quality metrics
  times_used INTEGER DEFAULT 0,
  quality_score FLOAT DEFAULT 0.5,
  user_satisfaction FLOAT,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_used_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Optional: track which analysis it came from (not the document text)
  source_analysis_id UUID REFERENCES document_analyses(id) ON DELETE SET NULL
);

-- Create vector similarity indexes
CREATE INDEX IF NOT EXISTS cached_structures_subject_embedding_idx 
  ON cached_blueprint_structures 
  USING ivfflat (subject_embedding vector_cosine_ops)
  WITH (lists = 100);

CREATE INDEX IF NOT EXISTS cached_structures_topics_embedding_idx 
  ON cached_blueprint_structures 
  USING ivfflat (topics_embedding vector_cosine_ops)
  WITH (lists = 100);

CREATE INDEX IF NOT EXISTS cached_structures_characteristics_embedding_idx 
  ON cached_blueprint_structures 
  USING ivfflat (characteristics_embedding vector_cosine_ops)
  WITH (lists = 100);

-- Create indexes for filtering and sorting
CREATE INDEX IF NOT EXISTS cached_structures_subject_area_idx 
  ON cached_blueprint_structures(subject_area);

CREATE INDEX IF NOT EXISTS cached_structures_document_type_idx 
  ON cached_blueprint_structures(document_type);

CREATE INDEX IF NOT EXISTS cached_structures_course_level_idx 
  ON cached_blueprint_structures(course_level);

CREATE INDEX IF NOT EXISTS cached_structures_quality_idx 
  ON cached_blueprint_structures(quality_score DESC);

CREATE INDEX IF NOT EXISTS cached_structures_times_used_idx 
  ON cached_blueprint_structures(times_used DESC);

CREATE INDEX IF NOT EXISTS cached_structures_last_used_idx 
  ON cached_blueprint_structures(last_used_at DESC);

-- ============================================================================
-- VECTOR SIMILARITY SEARCH FUNCTION
-- ============================================================================
-- Searches for similar blueprint structures using weighted combination of
-- subject, topics, and characteristics embeddings.
-- ============================================================================

CREATE OR REPLACE FUNCTION search_similar_blueprint_structures(
  query_subject_embedding VECTOR(1536),
  query_topics_embedding VECTOR(1536),
  query_characteristics_embedding VECTOR(1536),
  p_subject_area TEXT,
  p_document_type TEXT,
  similarity_threshold FLOAT DEFAULT 0.90,
  max_results INTEGER DEFAULT 3
)
RETURNS TABLE (
  id UUID,
  structure JSONB,
  subject_area TEXT,
  specific_topic TEXT,
  topics JSONB,
  similarity FLOAT,
  times_used INTEGER,
  quality_score FLOAT,
  last_used_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    cbs.id,
    cbs.structure,
    cbs.subject_area,
    cbs.specific_topic,
    cbs.topics,
    -- Weighted similarity score (subject 40%, topics 40%, characteristics 20%)
    (
      (1 - (cbs.subject_embedding <=> query_subject_embedding)) * 0.4 +
      (1 - (cbs.topics_embedding <=> query_topics_embedding)) * 0.4 +
      (1 - (cbs.characteristics_embedding <=> query_characteristics_embedding)) * 0.2
    ) AS similarity,
    cbs.times_used,
    cbs.quality_score,
    cbs.last_used_at
  FROM cached_blueprint_structures cbs
  WHERE 
    -- Filter by exact matches first for performance
    cbs.subject_area = p_subject_area
    AND cbs.document_type = p_document_type
    -- Then filter by similarity threshold
    AND (
      (1 - (cbs.subject_embedding <=> query_subject_embedding)) * 0.4 +
      (1 - (cbs.topics_embedding <=> query_topics_embedding)) * 0.4 +
      (1 - (cbs.characteristics_embedding <=> query_characteristics_embedding)) * 0.2
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
-- UPDATE CACHE USAGE STATS
-- ============================================================================

CREATE OR REPLACE FUNCTION increment_cache_usage(cache_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE cached_blueprint_structures
  SET 
    times_used = times_used + 1,
    last_used_at = NOW()
  WHERE id = cache_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- UPDATE CACHE QUALITY SCORE
-- ============================================================================
-- Updates quality score using exponential moving average
-- ============================================================================

CREATE OR REPLACE FUNCTION update_cache_quality(
  cache_id UUID,
  new_quality_score FLOAT
)
RETURNS VOID AS $$
BEGIN
  UPDATE cached_blueprint_structures
  SET 
    quality_score = (
      -- Exponential moving average: 70% old, 30% new
      COALESCE(quality_score, 0.5) * 0.7 + new_quality_score * 0.3
    ),
    user_satisfaction = new_quality_score
  WHERE id = cache_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- ADD COLUMN TO blueprint_structures TO TRACK CACHE SOURCE
-- ============================================================================

ALTER TABLE blueprint_structures 
ADD COLUMN IF NOT EXISTS from_cache BOOLEAN DEFAULT false;

ALTER TABLE blueprint_structures 
ADD COLUMN IF NOT EXISTS cache_source_id UUID REFERENCES cached_blueprint_structures(id) ON DELETE SET NULL;

ALTER TABLE blueprint_structures 
ADD COLUMN IF NOT EXISTS cache_similarity FLOAT;

-- Create index for tracking cache usage
CREATE INDEX IF NOT EXISTS blueprint_structures_cache_source_idx 
  ON blueprint_structures(cache_source_id) 
  WHERE cache_source_id IS NOT NULL;

-- ============================================================================
-- ENABLE ROW LEVEL SECURITY (Optional - for multi-tenant safety)
-- ============================================================================

ALTER TABLE cached_blueprint_structures ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read cached structures (they contain no private data)
CREATE POLICY "Anyone can read cached structures"
  ON cached_blueprint_structures
  FOR SELECT
  TO authenticated
  USING (true);

-- Only service role can insert/update (done by Edge Functions)
CREATE POLICY "Service role can manage cached structures"
  ON cached_blueprint_structures
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- CACHE STATISTICS VIEW
-- ============================================================================

CREATE OR REPLACE VIEW cache_statistics AS
SELECT
  COUNT(*) as total_cached_structures,
  COUNT(DISTINCT subject_area) as unique_subjects,
  AVG(times_used) as avg_times_used,
  AVG(quality_score) as avg_quality_score,
  MAX(times_used) as max_times_used,
  SUM(CASE WHEN times_used > 0 THEN 1 ELSE 0 END) as used_structures,
  SUM(CASE WHEN times_used = 0 THEN 1 ELSE 0 END) as unused_structures
FROM cached_blueprint_structures;

-- ============================================================================
-- CACHE PERFORMANCE BY SUBJECT
-- ============================================================================

CREATE OR REPLACE VIEW cache_performance_by_subject AS
SELECT
  subject_area,
  COUNT(*) as structure_count,
  SUM(times_used) as total_uses,
  AVG(times_used) as avg_uses_per_structure,
  AVG(quality_score) as avg_quality,
  MAX(last_used_at) as most_recent_use
FROM cached_blueprint_structures
GROUP BY subject_area
ORDER BY total_uses DESC;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

-- Add comments for documentation
COMMENT ON TABLE cached_blueprint_structures IS 
  'Caches generated blueprint structures (OUR content, not copyrighted material) for reuse across similar documents. Dramatically reduces token usage.';

COMMENT ON COLUMN cached_blueprint_structures.structure IS 
  'Our AI-generated learning structure. Does NOT contain copyrighted problem text.';

COMMENT ON COLUMN cached_blueprint_structures.subject_embedding IS 
  'Vector embedding of subject area for semantic similarity matching.';

COMMENT ON COLUMN cached_blueprint_structures.topics_embedding IS 
  'Vector embedding of topics list for semantic similarity matching.';

COMMENT ON FUNCTION search_similar_blueprint_structures IS 
  'Searches for similar cached blueprint structures using weighted vector similarity.';

